import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CheckCircle, CreditCard, Eye, History, Pill, Printer, ReceiptText, RefreshCw, Search, X } from "lucide-react";

import { API_ENDPOINTS, collection, field, pharmacyRequest, unwrap } from "./pharmacyApi";

import { normalizeMedicine } from "./medicineColumns";

import { useToast } from "../components/ToastProvider";

import { getPharmacistProfile } from "./pharmacySession";

import { getClinicInvoiceBranding } from "../utils/clinicBranding";

import "./PharmacyBilling.css";



const idOf = (bill) => field(bill, "billId", "billingId", "id");

const medicineIdOf = (row) => field(row, "medicineId", "catalogueMedicineId", "id");

const number = (value) => value === "" || value == null || !Number.isFinite(Number(value)) ? null : Number(value);

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const money = (value) => number(value) === null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value));

const statusOf = (bill) => String(field(bill, "paymentStatus", "status") || "Pending");

const isPaid = (bill) => ["paid", "completed", "success"].includes(statusOf(bill).toLowerCase());

const amountOf = (bill) => field(bill, "totalAmount", "netAmount", "grandTotal", "amount");

const invoiceOf = (bill) => field(bill, "invoiceNo", "invoiceNumber", "billNumber") || idOf(bill);

const nameKey = (value) => String(value || "").trim().toLowerCase();

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

const billLines = (bill) => collection(bill, ["medicines", "lineItems", "items", "billingItems", "details"]) || [];

const lineName = (row) => field(row, "medicineName", "name", "item", "description") || "Medicine";
// The appointment-scoped GET is verified; GET on /dispense previously returned HTTP 405.
// Do not call the POST-only dispensing route with GET.
const readAppointmentDispensing = (appointmentId) => pharmacyRequest(
  "Billing/appointments/{appointmentId}/dispensed-medicines",
  { method: "GET", params: { appointmentId } }
);
const createDispensing = (id, items) => pharmacyRequest(
  "pharmacy/prescriptions/{id}/dispense",
  { method: "POST", params: { id }, body: { items } }
);
const updateDispensingQuantities = (id, items) => pharmacyRequest(
  "pharmacy/prescriptions/{id}/dispense/quantities",
  { method: "PUT", params: { id }, body: { items } }
);
const matchingItemId = (row) => field(row, "prescriptionItemId");
const savedQuantity = (row) => number(field(row, "dispensedQuantity", "quantityDispensed", "quantity"));
// A medicine may be dispensed from multiple stock batches. Sum all batches per prescription item.
const quantitiesByPrescriptionItem = (items) => {
  const grouped = new Map();
  for (const item of items) {
    const key = String(matchingItemId(item) ?? "");
    const qty = savedQuantity(item);
    if (!key || !Number.isInteger(qty) || qty <= 0) continue;
    grouped.set(key, (grouped.get(key) || 0) + qty);
  }
  return grouped;
};
const billForAppointment = (list, id) => list.find((bill) =>
  String(field(bill, "appointmentId")) === String(id)
);
const dispensingItemsOf = (payload) => collection(unwrap(payload),
  ["dispensedMedicines", "dispensingItems", "medicines", "items", "prescriptionItems", "lineItems"]) || [];



export default function PharmacyBilling() {

  const toast = useToast();

  const [bills, setBills] = useState([]);

  const [appointments, setAppointments] = useState([]);

  const [catalogue, setCatalogue] = useState([]);

  const [appointmentId, setAppointmentId] = useState("");

  const [prescription, setPrescription] = useState(null);

  const [rows, setRows] = useState([]);

  const [selected, setSelected] = useState(null);

  const [payments, setPayments] = useState(null);

  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentReference, setPaymentReference] = useState("");

  const [busy, setBusy] = useState(false);

  const [detailLoading, setDetailLoading] = useState(false);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [billFilter, setBillFilter] = useState("all");

  const [createdBillId, setCreatedBillId] = useState("");

  const [savedBill, setSavedBill] = useState(null);

  const [billNotice, setBillNotice] = useState("");
  const [existingAppointmentBill, setExistingAppointmentBill] = useState(null);
  const [paymentReviewBlockedId, setPaymentReviewBlockedId] = useState(null);

  const selectionVersion = useRef(0);

  const actionLock = useRef(false);

  const profile = getPharmacistProfile();

  const load = useCallback(async () => {

    setLoading(true);

    const sources = [

      [API_ENDPOINTS.billing.pharmacy, ["bills", "billings"], setBills, "Pharmacy bills"],

      [API_ENDPOINTS.billing.appointments, ["appointments"], setAppointments, "Appointments"],

      [API_ENDPOINTS.pharmacy.medicines, ["medicines", "catalogue", "catalog"], setCatalogue, "Medicine catalogue"],

    ];

    const results = await Promise.allSettled(sources.map(([path]) => pharmacyRequest(path)));

    const failures = [];

    results.forEach((result, index) => {

      const [, keys, setter, label] = sources[index];

      if (result.status === "fulfilled") {

        const records = collection(result.value, keys);

        if (!records) failures.push(`${label}: unexpected response format.`);

        setter(records || []);

      } else { failures.push(`${label}: ${result.reason.message}`); setter([]); }

    });

    setError(failures.join(" ")); setLoading(false);

  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (action) => {

    if (actionLock.current) return;

    actionLock.current = true; setBusy(true); setError("");

    try { await action(); } catch (failure) { setError(failure.message); toast.error(failure.message); }

    finally { actionLock.current = false; setBusy(false); }

  };

  const medicines = useMemo(() => catalogue.map((raw) => ({ ...normalizeMedicine(raw), medicineId: medicineIdOf(raw) })).filter((item) => item.medicineId !== "" && item.Name), [catalogue]);

  const appointment = appointments.find((item) => String(field(item, "appointmentId", "id")) === appointmentId);

  const resolveMedicine = (row) => {

    if (row.medicineId) return medicines.find((item) => String(item.medicineId) === String(row.medicineId));

    const matches = medicines.filter((item) => nameKey(item.Name) === nameKey(row.medicineName));

    return matches.length === 1 ? matches[0] : null;

  };

  const pricedRows = rows.map((row) => {

    const medicine = resolveMedicine(row);

    const price = row.unitPrice ?? number(medicine?.SellingPrice);

    const quantity = number(row.quantity);

    const gst = row.gstPercentage ?? number(medicine?.GST) ?? 0;

    const subtotal = price !== null && quantity !== null ? round(price * quantity) : 0;

    const tax = round(subtotal * gst / 100);

    return { ...row, medicine, price, gst, subtotal, tax, total: round(subtotal + tax) };

  });

  const totals = pricedRows.reduce((sum, row) => ({ subtotal: round(sum.subtotal + row.subtotal), tax: round(sum.tax + row.tax), total: round(sum.total + row.total) }), { subtotal: 0, tax: 0, total: 0 });

  const invalidRows = pricedRows.some((row) => !(row.medicineId || row.medicine?.medicineId) || row.price === null || row.price < 0 || !Number.isInteger(Number(row.quantity)) || Number(row.quantity) <= 0 || row.gst < 0 || row.gst > 100);

  // Extra prescription quantities use the dispensing API, never an OTC draft.
  const chooseAppointment = async (value) => {

    const version = ++selectionVersion.current;

    setAppointmentId(value); setPrescription(null); setRows([]); setCreatedBillId(""); setSavedBill(null); setBillNotice(""); setExistingAppointmentBill(null); setPaymentReviewBlockedId(null); setSelected(null); setPayments(null); setError("");

    if (!value) return;

    setDetailLoading(true);

    try {

      // Fetch the current invoice list, not just potentially stale React state.
      const freshBillsPayload = await pharmacyRequest(API_ENDPOINTS.billing.pharmacy);
      const freshBills = collection(freshBillsPayload, ["bills", "billings"]);
      if (!freshBills) throw new Error("Cannot verify existing invoices. Billing is blocked until the invoice list loads.");
      if (version !== selectionVersion.current) return;
      setBills(freshBills);
      const existing = billForAppointment(freshBills, value);
      setExistingAppointmentBill(existing || null);
      let result = unwrap(await pharmacyRequest(API_ENDPOINTS.billing.appointmentPrescription, { params: { appointmentId: value } }));

      if (version !== selectionVersion.current) return;

      let list = collection(result, ["medicines", "items", "prescriptionItems"]) || [];

      // Older billing responses omit quantities; read the saved doctor prescription rather than defaulting to one.

      const missingDetails = !list.length || list.some((item) => field(item, "prescribedQuantity", "quantity", "qty") === "" || !field(item, "medicineId", "catalogueMedicineId"));

      if (missingDetails) {

        try {

          const doctorResult = unwrap(await pharmacyRequest(API_ENDPOINTS.prescription.byAppointment, { params: { appointmentId: value } }));

          if (version !== selectionVersion.current) return;

          const prescriptions = Array.isArray(doctorResult) ? doctorResult : collection(doctorResult, ["prescriptions"]);

          const doctorPrescription = prescriptions ? prescriptions.find((item) => String(field(item, "appointmentId")) === String(value)) || prescriptions[0] : doctorResult;

          if (!field(result, "prescriptionId") && field(doctorPrescription, "prescriptionId", "id")) result = { ...result, prescriptionId: field(doctorPrescription, "prescriptionId", "id") };

          const doctorItems = collection(doctorPrescription, ["medicines", "items", "prescriptionItems"]) || [];

          if (!list.length) {

            list = doctorItems;

            result = { ...doctorPrescription, ...result };

          }

          list = list.map((item) => {

            const id = field(item, "medicineId", "catalogueMedicineId");

            const matches = doctorItems.filter((candidate) => id ? String(field(candidate, "medicineId", "catalogueMedicineId")) === String(id) : nameKey(lineName(candidate)) === nameKey(lineName(item)));

            if (matches.length !== 1) return item;

            return { ...item, ...matches[0] };

          });

        } catch {

          // Missing quantities remain empty and block billing until entered; no invented prescription values.

        }

      }

      const prescriptionId = field(result, "prescriptionId", "id");

      // Read actual saved dispensing using the verified appointment endpoint.
      // Never replace prescriptionItemId with a dispenseItemId.
      try {
        const details = await readAppointmentDispensing(value);
        if (version !== selectionVersion.current) return;
        const dispensingItems = dispensingItemsOf(details);
        list = list.map((item) => {
          const itemId = field(item, "prescriptionItemId", "id");
          const matches = dispensingItems.filter((candidate) =>
            itemId && String(field(candidate, "prescriptionItemId")) === String(itemId)
          );
          if (!matches.length) return item;
          const saved = matches[0];
          return {
            ...item,
            prescriptionItemId: itemId,
            medicineId: field(item, "medicineId", "catalogueMedicineId") || field(saved, "medicineId"),
            dispensedQuantity: matches.reduce((total, entry) => total + (savedQuantity(entry) ?? 0), 0),
            unitPrice: field(saved, "unitPrice", "sellingPrice", "price") || field(item, "unitPrice", "sellingPrice", "price"),
          };
        });
      } catch (failure) {
        if (version !== selectionVersion.current) return;
        // Billing still loads the prescription, but save/verify will fail closed.
        setBillNotice("Saved dispensing could not be loaded: " + failure.message);
      }

      if (version !== selectionVersion.current) return;

      setPrescription(result);

      setRows(list.map((item, index) => {

        const prescribedQuantity = field(item, "prescribedQuantity", "quantity", "qty");

        const dispensedQuantity = number(field(item, "dispensedQuantity", "quantityDispensed"));

        return {

          key: `rx-${index}`, prescriptionItemId: field(item, "prescriptionItemId", "id"),

          medicineId: field(item, "medicineId", "catalogueMedicineId"), medicineName: lineName(item),

          prescribedQuantity, dispensedQuantity, quantity: dispensedQuantity > 0 ? dispensedQuantity : prescribedQuantity,

          unitPrice: number(field(item, "unitPrice", "sellingPrice", "price")),

          gstPercentage: number(field(item, "gstPercentage", "gst", "gstRate")),

          dosage: field(item, "dosage"), frequency: field(item, "frequency"), duration: field(item, "duration"),

        };

      }));

      if (!list.length) setError("No prescribed medicines were returned for this appointment.");

    } catch (failure) { if (version === selectionVersion.current) { setError(failure.message); toast.error(failure.message); } }

    finally { if (version === selectionVersion.current) setDetailLoading(false); }

  };

  const updateRow = (key, patch) => { setRows((previous) => previous.map((row) => row.key === key ? { ...row, ...patch } : row)); };

  const hydrateBill = async (bill) => {

    const id = idOf(bill);

    if (!id) throw new Error("The backend did not return a bill ID. Refresh the ledger before recording payment.");

    const payload = unwrap(await pharmacyRequest(API_ENDPOINTS.billing.byId, { params: { id } }));

    const result = field(payload, "bill", "billing", "invoice") || payload;

    return { ...bill, ...result };

  };

  const view = async (bill) => {
    setPayments(null);
    const saved = await hydrateBill(bill);
    const appointmentId = field(saved, "appointmentId");
    if (!billLines(saved).length && appointmentId) {
      const details = await readAppointmentDispensing(appointmentId);
      const detailed = { ...saved, medicines: dispensingItemsOf(details) };
      setSelected(detailed);
      return detailed;
    } else {
      setSelected(saved);
      return saved;
    }
  };

  const recordPayment = async (bill) => {

    const fresh = await hydrateBill(bill);

    setSelected(fresh);

    if (isPaid(fresh)) return fresh;

    try {

      await pharmacyRequest(API_ENDPOINTS.billing.payment, {

        method: "PATCH", params: { billId: idOf(fresh) }, body: { paymentMode: paymentMethod, referenceNumber: paymentMethod === "Cash" ? "" : paymentReference.trim() },

      });

      const confirmed = await hydrateBill(fresh);

      setSelected(confirmed); setPayments(null);

      if (!isPaid(confirmed)) throw new Error("The backend has not confirmed Paid status. Refresh this invoice before retrying payment.");

      return confirmed;

    } catch (failure) {

      throw new Error("Invoice " + invoiceOf(fresh) + " is saved, but payment could not be confirmed. " + failure.message + " Use the saved invoice to retry; do not generate another bill.");

    }

  };

  const create = () => run(async () => {

    if (!appointment || !prescription || !pricedRows.length || invalidRows) throw new Error("Select an appointment with prescribed medicines and enter positive whole quantities. Medicine IDs and prices must be available from the backend.");

    const patientId = field(appointment, "patientId") || field(prescription, "patientId");

    if (!patientId) throw new Error("The appointment is missing a patient ID. A patient-linked bill is required for the patient portal.");

    if (existingAppointmentBill) throw new Error(`Appointment ${appointmentId} already has invoice ${invoiceOf(existingAppointmentBill)}. Open the existing invoice; do not generate another bill.`);
    // Recheck immediately before creating an invoice; a previous list may be stale.
    const currentInvoices = collection(await pharmacyRequest(API_ENDPOINTS.billing.pharmacy), ["bills", "billings"]);
    if (!currentInvoices) throw new Error("Could not verify existing invoices. Billing was not attempted.");
    const duplicate = billForAppointment(currentInvoices, appointmentId);
    if (duplicate) { setExistingAppointmentBill(duplicate); throw new Error(`Invoice ${invoiceOf(duplicate)} already exists for this appointment. Billing was not attempted.`); }
    const prescriptionId = field(prescription, "prescriptionId", "id");
    if (!prescriptionId) throw new Error("Prescription ID is missing. Cannot save dispensing quantities.");
    if (pricedRows.some((row) => !row.prescriptionItemId)) throw new Error("A prescriptionItemId is missing. Cannot safely match and save quantities.");

    const selectedItems = pricedRows.map((row) => {
      const prescribed = number(row.prescribedQuantity);
      if (!Number.isInteger(prescribed) || prescribed <= 0)
        throw new Error("A valid doctor's prescribed quantity is required.");
      return { prescriptionItemId: Number(row.prescriptionItemId), quantity: Number(row.quantity) };
    });
    // Check the current server record. 404 means initial dispensing has not occurred.
    let saved = [];
    try {
      saved = dispensingItemsOf(await readAppointmentDispensing(appointmentId));
    } catch (failure) {
      if (failure.status !== 404) throw failure;
    }
    const quantities = quantitiesByPrescriptionItem(saved);
    if (!saved.length) {
      await createDispensing(prescriptionId, selectedItems);
    } else if (selectedItems.some((item) => quantities.get(String(item.prescriptionItemId)) !== item.quantity)) {
      await updateDispensingQuantities(prescriptionId, selectedItems);
    }
    // Dispensing POST/PUT is the only place where prescription stock is deducted/adjusted.
    saved = dispensingItemsOf(await readAppointmentDispensing(appointmentId));
    const confirmed = quantitiesByPrescriptionItem(saved);
    if (selectedItems.some((item) => confirmed.get(String(item.prescriptionItemId)) !== item.quantity))
      throw new Error("The backend did not confirm the selected dispensing quantities. Billing was not attempted.");
    // Calculate expected charge from the actual saved batch prices, not catalogue estimates.
    const confirmedCharge = round(saved.reduce((sum, item) =>
      sum + (savedQuantity(item) ?? 0) * (number(field(item, "unitPrice")) ?? 0), 0));
    if (confirmedCharge <= 0) throw new Error("Saved dispensing has no valid medicine charge.");


    const response = unwrap(await pharmacyRequest(API_ENDPOINTS.billing.pharmacy, { method: "POST", body: {

      appointmentId: Number(appointmentId), patientId: Number(patientId),

      prescriptionId: field(prescription, "prescriptionId", "id") || undefined,

      branchId: Number(field(appointment, "branchId") || profile.branchId) || undefined,

      billingType: "Pharmacy", paymentMethod, paymentMode: paymentMethod,

      gstPercentage: 0, discount: 0,

    } }));

    const result = field(response, "bill", "billing", "invoice") || response;

    const id = idOf(result);

    setCreatedBillId(id ? String(id) : "saved-without-id");

    await load();

    if (!id) throw new Error("Bill creation was accepted, but its ID was not returned. Check the saved bills below before creating another bill.");

    const bill = await hydrateBill(result);

    setSelected(bill); setSavedBill(bill); setPayments(null);



    const invoiceLines = billLines(bill);
    const invoiceQuantities = quantitiesByPrescriptionItem(invoiceLines);
    const quantitiesMatch = selectedItems.every((item) =>
      invoiceQuantities.get(String(item.prescriptionItemId)) === item.quantity);
    if (!invoiceLines.length || !quantitiesMatch || number(amountOf(bill)) === null ||
        Math.abs(Number(amountOf(bill)) - confirmedCharge) > .01) {
      setPaymentReviewBlockedId(String(id));
      setBillNotice(`Invoice ${invoiceOf(bill)} was saved, but its saved quantities or total could not be verified. Payment is blocked for this session; review the invoice. No payment was recorded.`);
      return;
    }
    if (!invoiceLines.length || number(amountOf(bill)) === null || Math.abs(Number(amountOf(bill)) - totals.total) > .01) {
      setPaymentReviewBlockedId(String(id));
      setBillNotice(`Invoice ${invoiceOf(bill)} was saved, but its line items or total cannot be verified. Payment is blocked for this session. No payment was recorded.`);
      return;
    }
    setBillNotice(`Invoice ${invoiceOf(bill)} saved and quantities verified. Review the invoice and click Record collected payment to complete payment.`);
    toast.success(`Invoice ${invoiceOf(bill)} created. Payment has not been recorded.`);
    await load();
  });

  const collectPayment = () => run(async () => {
    if (selected && String(idOf(selected)) === paymentReviewBlockedId) {
      throw new Error("This invoice failed quantity or amount verification. Resolve the mismatch before payment.");
    }
    try {

      const paidBill = await recordPayment(selected);

      if (String(idOf(paidBill)) === createdBillId) setSavedBill(paidBill);

      toast.success("Payment successful. The paid bill is saved in the ledger.");

    } finally { await load(); }

  });

  const printBill = (invoice) => run(async () => {
    const bill = await view(invoice);
    const branding = getClinicInvoiceBranding({ clinicId: profile.hospitalId, clinicName: profile.hospitalName });
    const lines = billLines(bill);
    const frame = document.createElement("iframe");
    frame.title = "Pharmacy invoice print";
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;left:-10000px;top:0;width:800px;height:1px;border:0;pointer-events:none";
    frame.onload = async () => {
      try {
        const doc = frame.contentDocument;
        await Promise.all(Array.from(doc.images, (img) => img.complete ? Promise.resolve() : new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
          setTimeout(resolve, 3000);
        })));
        if (doc.fonts) await doc.fonts.ready;
        frame.contentWindow.addEventListener("afterprint", () => frame.remove(), { once: true });
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch {
        frame.remove();
        toast.error("Unable to open the print dialog.");
      }
    };
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>Pharmacy bill ${escapeHtml(invoiceOf(bill))}</title><style>
      @page{size:A4;margin:16mm}
      *{box-sizing:border-box}body{margin:0;font:13px/1.5 Arial,sans-serif;color:#17243b;background:#fff}
      header{display:flex;align-items:center;gap:16px;padding-bottom:20px;border-bottom:3px solid #0f766e}
      header img{width:64px;height:64px;object-fit:contain}h1{margin:0 0 4px;font-size:24px;line-height:1.25}
      .subtitle{margin:0;color:#64748b;font-size:13px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px 24px;padding:20px 0}
      .meta p{margin:0;overflow-wrap:anywhere}.label{display:block;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px}
      table{width:100%;border-collapse:collapse;table-layout:fixed;margin:8px 0 20px}thead{display:table-header-group}
      th,td{border:1px solid #dbe4ed;padding:11px 12px;vertical-align:top;overflow-wrap:anywhere}
      th{background:#eef7f7;font-size:11px;text-transform:uppercase;letter-spacing:.3px;text-align:left}
      th:first-child,td:first-child{width:7%;text-align:center}th:nth-child(2){width:43%}
      th:nth-child(3),td:nth-child(3){width:12%;text-align:center}th:nth-child(4),td:nth-child(4),th:nth-child(5),td:nth-child(5){width:19%;text-align:right}
      tr{break-inside:avoid}.total{display:flex;justify-content:space-between;align-items:center;gap:24px;margin-left:auto;width:45%;padding:14px 16px;border:1px solid #cce5e2;border-radius:6px;background:#f0fdfa;font-weight:bold}
      .total strong{font-size:20px;white-space:nowrap}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
    </style></head><body>
      <header>${branding.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" alt="Clinic logo">` : ""}<div><h1>${escapeHtml(branding.headerTitle)}</h1><p class="subtitle">Pharmacy Invoice</p></div></header>
      <div class="meta"><p><span class="label">Invoice number</span><strong>${escapeHtml(invoiceOf(bill))}</strong></p><p><span class="label">Patient</span><strong>${escapeHtml(field(bill, "patientName") || field(appointment, "patientName"))}</strong></p><p><span class="label">Payment status</span>${escapeHtml(statusOf(bill))}</p><p><span class="label">Payment mode</span>${escapeHtml(field(bill, "paymentMethod", "paymentMode"))}</p></div>
      <table><thead><tr><th>No.</th><th>Medicine</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${lines.map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(lineName(row))}</td><td>${escapeHtml(field(row, "quantity", "dispensedQuantity", "prescribedQuantity"))}</td><td>${escapeHtml(money(field(row, "unitPrice", "sellingPrice", "price")))}</td><td>${escapeHtml(money(field(row, "totalAmount", "amount", "lineTotal")))}</td></tr>`).join("")}</tbody></table>
      <div class="total"><span>Total amount</span><strong>${escapeHtml(money(amountOf(bill)))}</strong></div>
    </body></html>`;
    document.body.appendChild(frame);
  });
  const paidBills = bills.filter(isPaid);

  const filteredBills = bills.filter((bill) => (billFilter === "all" || (billFilter === "paid" ? isPaid(bill) : !isPaid(bill))) && [invoiceOf(bill), field(bill, "patientName"), field(bill, "patientId")].some((value) => String(value).toLowerCase().includes(search.toLowerCase())));

  const selectedLines = selected ? billLines(selected) : [];

  const savedLines = savedBill ? billLines(savedBill) : [];

  const summary = savedBill ? {

    subtotal: number(field(savedBill, "subtotal", "medicineCharge", "medicineCharges")),

    tax: number(field(savedBill, "taxAmount", "gstAmount", "totalGst")),

    total: number(amountOf(savedBill)),

  } : totals;

  return <section className="pharmacy-billing-page">

    <header className="phb-page-head"><div><span>PHARMACY CASHIER</span><h2>Pharmacy Billing & Payments</h2><p>Catalogue prices, patient invoices, and payment history.</p></div><button className="phb-button phb-button-light" disabled={busy || loading} onClick={load}><RefreshCw size={17} />Refresh</button></header>

    <div className="phb-stats"><div><span className="phb-stat-icon"><ReceiptText size={23} /></span><div><small>Total invoices</small><strong>{bills.length}</strong></div></div><div><span className="phb-stat-icon phb-green"><CheckCircle size={23} /></span><div><small>Paid bills</small><strong>{paidBills.length}</strong></div></div><div><span className="phb-stat-icon phb-purple"><CreditCard size={23} /></span><div><small>Payments collected</small><strong>{money(paidBills.reduce((sum, bill) => sum + (number(amountOf(bill)) ?? 0), 0))}</strong></div></div></div>

    {error && <div className="pharmacy-import-message is-error" role="alert">{error}</div>}

    {billNotice && <div className="phb-bill-notice" role="status">{billNotice}</div>}

    <div className="phb-composer">

      <section className="phb-panel"><header className="phb-panel-title"><span><Pill size={20} />Create Pharmacy Bill</span><small>Medicine dispensary</small></header>

        <div className="phb-form"><label>Patient / Appointment<select value={appointmentId} disabled={busy || loading} onChange={(event) => chooseAppointment(event.target.value)}><option value="">Select patient appointment</option>{appointments.map((item) => { const id = field(item, "appointmentId", "id"); return <option key={id} value={id}>{field(item, "displayText") || `${field(item, "patientName")} — Appointment ${id}`}</option>; })}</select></label><label>Payment method<select disabled={busy} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{["Cash", "UPI", "Card"].map((method) => <option key={method}>{method}</option>)}</select></label>{paymentMethod !== "Cash" && <label>Payment reference number<input type="text" value={paymentReference} disabled={busy} placeholder="Transaction / UTR / reference number" onChange={(event) => setPaymentReference(event.target.value)} /></label>}</div>

        {existingAppointmentBill && <div className="phb-bill-notice" role="status">This appointment already has invoice {invoiceOf(existingAppointmentBill)}. Quantity changes and duplicate billing are blocked. Find the invoice below to view or collect payment.</div>}
          {appointment && <div className="phb-patient-strip"><span>Patient<strong>{field(appointment, "patientName") || "—"}</strong></span><span>Patient ID<strong>{field(appointment, "patientId") || "—"}</strong></span><span>Doctor<strong>{field(appointment, "doctorName") || "—"}</strong></span></div>}

        <div className="phb-item-heading"><strong>Medicine Items</strong><span>Price × selected quantity</span></div>

        <div className="phb-table-scroll"><table className="phb-table phb-items"><thead><tr><th>Prescribed Medicine</th><th>Prescribed Qty</th><th>Dispensed Qty</th><th>Extra Qty</th><th>Unit price</th><th>GST</th><th>Amount</th></tr></thead><tbody>{detailLoading ? <tr><td colSpan={7}>Loading the doctor's prescription...</td></tr> : !pricedRows.length ? <tr><td colSpan={7}>Select an appointment to load the doctor's prescribed medicines.</td></tr> : pricedRows.map((row) => <tr key={row.key}><td><strong className="phb-prescribed-name">{row.medicineName}</strong><small>{[row.dosage, row.frequency, row.duration].filter(Boolean).join(" | ")}</small><small>Doctor's quantity: {row.prescribedQuantity === "" ? "Not returned by backend" : row.prescribedQuantity}</small>{row.dispensedQuantity > 0 && <small>Dispensed: {row.dispensedQuantity} units. Quantity can be corrected before billing.</small>}{!(row.medicineId || row.medicine?.medicineId) && <small className="phb-invalid">Medicine ID missing from the backend prescription.</small>}</td><td>{row.prescribedQuantity}</td><td><input type="number" min={1} step={1} aria-label={`Dispensed quantity for ${row.medicineName}`} disabled={busy || Boolean(createdBillId) || Boolean(existingAppointmentBill)} value={row.quantity} onChange={(event) => updateRow(row.key, { quantity: event.target.value })} /></td><td><strong>{Math.max(0, (number(row.quantity) ?? 0) - (number(row.prescribedQuantity) ?? 0))}</strong></td><td>{money(row.price)}{row.price === null && <small className="phb-invalid">Backend price unavailable</small>}</td><td>{row.gst}%</td><td><strong>{money(row.total)}</strong></td></tr>)}</tbody></table></div>

        <div className="phb-item-footer"><span>Extra Qty is for tracking only; prescription-only increases still require a valid prescription. Stock is deducted once for actual dispensing.</span><span>{rows.length} prescribed medicine{rows.length === 1 ? "" : "s"}</span></div>

      </section>

      <aside className="phb-panel phb-summary"><h3>Bill Summary</h3><p>{savedBill ? "Saved invoice amounts" : "Selected medicine estimate"}</p><dl><div><dt>Medicine items</dt><dd>{savedBill ? savedLines.length || "?" : rows.length}</dd></div><div><dt>Stock units</dt><dd>{savedBill ? savedLines.length ? savedLines.reduce((sum, row) => sum + (number(field(row, "dispensedQuantity", "quantity", "prescribedQuantity")) ?? 0), 0) : "?" : pricedRows.reduce((sum, row) => sum + (number(row.quantity) ?? 0), 0)}</dd></div><div><dt>Subtotal</dt><dd>{money(summary.subtotal)}</dd></div><div><dt>GST</dt><dd>{money(summary.tax)}</dd></div><div className="phb-grand-total"><dt>{savedBill ? "Saved bill total" : "Estimated total"}</dt><dd>{money(summary.total)}</dd></div></dl><p className="phb-summary-note">The saved invoice uses the backend's final charges and dispensing records.</p><button className="phb-button phb-button-primary" disabled={busy || loading || detailLoading || !appointmentId || !rows.length || invalidRows || Boolean(createdBillId) || Boolean(existingAppointmentBill)} onClick={create}><ReceiptText size={18} />{busy ? "Processing payment..." : savedBill && isPaid(savedBill) ? "Payment successful" : createdBillId ? "Bill saved" : "Verify Dispensing & Generate Bill"}</button>{createdBillId && <p className="phb-summary-note">{savedBill && isPaid(savedBill) ? "Payment successful. The paid invoice is saved below." : "Invoice saved. Check its payment status below before retrying."}</p>}</aside>

    </div>

    <section className="phb-panel phb-ledger"><header className="phb-panel-title"><span><ReceiptText size={20} />Saved Pharmacy Bills</span><small>{paidBills.length} paid · {bills.length - paidBills.length} pending</small></header><div className="phb-ledger-toolbar"><label><Search size={17} /><input type="search" aria-label="Search pharmacy bills" placeholder="Search patient or invoice..." value={search} onChange={(event) => setSearch(event.target.value)} /></label><select aria-label="Filter payment status" value={billFilter} onChange={(event) => setBillFilter(event.target.value)}><option value="all">All bills</option><option value="paid">Paid bills</option><option value="pending">Pending bills</option></select></div><div className="phb-table-scroll"><table className="phb-table"><thead><tr><th>Patient & Invoice</th><th>Date</th><th>Payment Status</th><th>Total Amount</th><th style={{ textAlign: "center" }}>Actions</th></tr></thead><tbody>{loading ? <tr><td colSpan={5}>Loading saved bills...</td></tr> : !filteredBills.length ? <tr><td colSpan={5}>No pharmacy bills found.</td></tr> : filteredBills.map((bill, index) => <React.Fragment key={idOf(bill) || index}><tr className={selected && String(idOf(selected)) === String(idOf(bill)) ? "phb-history-owner" : ""}><td><strong>{field(bill, "patientName") || "—"}</strong><small>#{invoiceOf(bill)}</small></td><td>{String(field(bill, "createdAt", "billDate", "invoiceDate") || "—").slice(0, 10)}</td><td><span className={`phb-status ${isPaid(bill) ? "is-paid" : ""}`}>{statusOf(bill)}</span></td><td><strong>{money(amountOf(bill))}</strong></td><td><div className="phb-ledger-actions"><button className="phb-button phb-button-light" disabled={busy || !idOf(bill)} onClick={() => run(() => view(bill))}><Eye size={16} />View Bill</button><button className="phb-button phb-button-light" disabled={busy || !idOf(bill)} onClick={() => printBill(bill)}><Printer size={16} />Print Bill</button><button className="phb-button phb-button-light" disabled={busy || !idOf(bill)} onClick={() => run(async () => { await view(bill); const result = await pharmacyRequest(API_ENDPOINTS.billing.paymentHistory, { params: { billId: idOf(bill) } }); const list = collection(result, ["payments", "transactions", "paymentTransactions"]); if (!list) throw new Error("Unexpected payment history response."); setPayments(list); })}><History size={16} />Payment history</button></div></td></tr>{payments !== null && String(idOf(selected)) === String(idOf(bill)) && <tr className="phb-history-expansion"><td colSpan={5}><div className="phb-history phb-row-history"><header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "12px" }}><h4 style={{ margin: 0 }}>Payment Transactions</h4><button type="button" className="phb-icon-button" aria-label="Close payment history" title="Close payment history" disabled={busy} onClick={() => { setPayments(null); setSelected(null); }}><X size={18} /></button></header>{payments.length ? payments.map((payment, index) => <div key={index}><span>{field(payment, "paymentMethod", "method") || "Payment"}</span><strong>{money(field(payment, "amount", "paidAmount", "paymentAmount"))}</strong><span>{field(payment, "paymentDate", "paidDate", "createdAt")}</span><span>{field(payment, "transactionId", "reference")}</span></div>) : <p>No payment transactions recorded.</p>}</div></td></tr>}{selected && payments === null && String(idOf(selected)) === String(idOf(bill)) && <tr className="phb-bill-expansion"><td colSpan={5}><section className="phb-panel phb-saved-detail"><header className="phb-panel-title"><span><ReceiptText size={20} />Invoice {invoiceOf(selected)}</span><button className="phb-icon-button" aria-label="Close bill details" disabled={busy} onClick={() => setSelected(null)}><X size={18} /></button></header><div className="phb-invoice-summary"><div><small>Patient</small><strong>{field(selected, "patientName") || "—"}</strong></div><div><small>Saved total</small><strong>{money(amountOf(selected))}</strong></div><span className={`phb-status ${isPaid(selected) ? "is-paid" : ""}`}>{statusOf(selected)}</span></div>{selectedLines.length > 0 && <div className="phb-table-scroll"><table className="phb-table"><thead><tr><th>Medicine</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{selectedLines.map((row, index) => <tr key={index}><td>{lineName(row)}</td><td>{field(row, "quantity", "dispensedQuantity", "prescribedQuantity")}</td><td>{money(field(row, "unitPrice", "sellingPrice", "price"))}</td><td>{money(field(row, "totalAmount", "amount", "lineTotal"))}</td></tr>)}</tbody></table></div>}<div className="phb-detail-actions"><button className="phb-button phb-button-light" disabled={busy} onClick={() => run(() => view(selected))}><RefreshCw size={16} />Refresh status</button><button className="phb-button phb-button-primary" disabled={busy || isPaid(selected) || number(amountOf(selected)) === null || String(idOf(selected)) === paymentReviewBlockedId} onClick={collectPayment}><CreditCard size={17} />{isPaid(selected) ? "Paid" : `Record collected payment · ${paymentMethod}`}</button></div></section></td></tr>}</React.Fragment>)}</tbody></table></div></section>

  </section>;

}