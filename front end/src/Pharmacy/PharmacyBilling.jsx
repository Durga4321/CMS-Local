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
  const [busy, setBusy] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [billFilter, setBillFilter] = useState("all");
  const [createdBillId, setCreatedBillId] = useState("");
  const [savedBill, setSavedBill] = useState(null);
  const [billNotice, setBillNotice] = useState("");
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
  const chooseAppointment = async (value) => {
    const version = ++selectionVersion.current;
    setAppointmentId(value); setPrescription(null); setRows([]); setCreatedBillId(""); setSavedBill(null); setBillNotice(""); setSelected(null); setPayments(null); setError("");
    if (!value) return;
    setDetailLoading(true);
    try {
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
      if (prescriptionId) {
        try {
          const details = unwrap(await pharmacyRequest(API_ENDPOINTS.pharmacy.prescriptionById, { params: { id: prescriptionId } }));
          if (version !== selectionVersion.current) return;
          const dispensingItems = collection(details, ["medicines", "items", "prescriptionItems"]) || [];
          list = list.map((item) => {
            const id = field(item, "medicineId", "catalogueMedicineId");
            const matches = dispensingItems.filter((candidate) => id ? String(field(candidate, "medicineId", "catalogueMedicineId")) === String(id) : nameKey(lineName(candidate)) === nameKey(lineName(item)));
            return matches.length === 1 ? { ...item, ...matches[0] } : item;
          });
        } catch {
          // The saved bill remains authoritative when dispensing details are unavailable.
        }
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
  const view = async (bill) => { setPayments(null); setSelected(await hydrateBill(bill)); };
  const recordPayment = async (bill) => {
    const fresh = await hydrateBill(bill);
    setSelected(fresh);
    if (isPaid(fresh)) return fresh;
    try {
      await pharmacyRequest(API_ENDPOINTS.billing.payment, {
        method: "PATCH", params: { billId: idOf(fresh) }, body: { paymentMethod },
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
    const items = pricedRows.map((row) => ({ medicineId: row.medicineId || row.medicine?.medicineId, prescriptionItemId: row.prescriptionItemId || undefined, medicineName: row.medicineName, quantity: Number(row.quantity), prescribedQuantity: number(row.prescribedQuantity) ?? Number(row.quantity), unitPrice: row.price, sellingPrice: row.price, gstPercentage: row.gst, amount: row.subtotal, taxAmount: row.tax, totalAmount: row.total }));
    const response = unwrap(await pharmacyRequest(API_ENDPOINTS.billing.pharmacy, { method: "POST", body: {
      appointmentId: Number(appointmentId), patientId: Number(patientId),
      prescriptionId: field(prescription, "prescriptionId", "id") || undefined,
      branchId: Number(field(appointment, "branchId") || profile.branchId) || undefined,
      billingType: "Pharmacy", paymentMethod, paymentMode: paymentMethod,
      medicines: items, lineItems: items, medicineCharge: totals.subtotal, taxAmount: totals.tax, totalAmount: totals.total,
    } }));
    const result = field(response, "bill", "billing", "invoice") || response;
    const id = idOf(result);
    setCreatedBillId(id ? String(id) : "saved-without-id");
    await load();
    if (!id) throw new Error("Bill creation was accepted, but its ID was not returned. Check the saved bills below before creating another bill.");
    const bill = await hydrateBill(result);
    setSelected(bill); setSavedBill(bill); setPayments(null);

    if (number(amountOf(bill)) !== null && Math.abs(Number(amountOf(bill)) - totals.total) > .01) {
      setBillNotice(`Bill saved. The preview was ${money(totals.total)}; the saved invoice total is ${money(amountOf(bill))}. The server uses recorded dispensing quantities and its billing rules. Payment uses the saved invoice total.`);
    }
    try {
      const paidBill = await recordPayment(bill);
      setSavedBill(paidBill);
      toast.success("Payment successful. Pharmacy bill " + invoiceOf(paidBill) + " is paid via " + paymentMethod + ".");
    } finally { await load(); }
  });
  const collectPayment = () => run(async () => {
    try {
      const paidBill = await recordPayment(selected);
      if (String(idOf(paidBill)) === createdBillId) setSavedBill(paidBill);
      toast.success("Payment successful. The paid bill is saved in the ledger.");
    } finally { await load(); }
  });
  const printBill = () => {
    const popup = window.open("", "_blank");
    if (!popup) { toast.error("Allow popups to print the bill."); return; }
    const branding = getClinicInvoiceBranding({ clinicId: profile.hospitalId, clinicName: profile.hospitalName });
    const lines = billLines(selected);
    popup.document.write(`<!doctype html><html><head><title>Pharmacy bill ${escapeHtml(invoiceOf(selected))}</title><style>body{font:14px Arial;color:#17243b;padding:30px}header{display:flex;gap:16px;align-items:center;border-bottom:2px solid #0f766e;padding-bottom:20px}img{width:60px;height:60px;object-fit:contain}h1{font-size:23px}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{padding:12px;text-align:left;border-bottom:1px solid #ddd}.total{text-align:right;font-size:20px}button{padding:10px 20px}@media print{button{display:none}}</style></head><body><header><img src="${escapeHtml(branding.logoUrl)}" alt="Clinic logo"><div><h1>${escapeHtml(branding.headerTitle)}</h1>Pharmacy Invoice</div></header><p>Bill: ${escapeHtml(invoiceOf(selected))}</p><p>Patient: ${escapeHtml(field(selected, "patientName") || field(appointment, "patientName"))}</p><p>Payment: ${escapeHtml(statusOf(selected))} | ${escapeHtml(field(selected, "paymentMethod", "paymentMode"))}</p><table><thead><tr><th>Medicine</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${lines.map((row) => `<tr><td>${escapeHtml(lineName(row))}</td><td>${escapeHtml(field(row, "quantity", "dispensedQuantity", "prescribedQuantity"))}</td><td>${escapeHtml(money(field(row, "unitPrice", "sellingPrice", "price")))}</td><td>${escapeHtml(money(field(row, "totalAmount", "amount", "lineTotal")))}</td></tr>`).join("")}</tbody></table><p class="total">Total: ${escapeHtml(money(amountOf(selected)))}</p><button onclick="window.print()">Print bill</button></body></html>`);
    popup.document.close();
  };
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
        <div className="phb-form"><label>Patient / Appointment<select value={appointmentId} disabled={busy || loading} onChange={(event) => chooseAppointment(event.target.value)}><option value="">Select patient appointment</option>{appointments.map((item) => { const id = field(item, "appointmentId", "id"); return <option key={id} value={id}>{field(item, "displayText") || `${field(item, "patientName")} — Appointment ${id}`}</option>; })}</select></label><label>Payment method<select disabled={busy} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{["Cash", "UPI", "Card", "Bank Transfer"].map((method) => <option key={method}>{method}</option>)}</select></label></div>
        {appointment && <div className="phb-patient-strip"><span>Patient<strong>{field(appointment, "patientName") || "—"}</strong></span><span>Patient ID<strong>{field(appointment, "patientId") || "—"}</strong></span><span>Doctor<strong>{field(appointment, "doctorName") || "—"}</strong></span></div>}
        <div className="phb-item-heading"><strong>Medicine Items</strong><span>Price × selected quantity</span></div>
        <div className="phb-table-scroll"><table className="phb-table phb-items"><thead><tr><th>Prescribed Medicine</th><th>Qty</th><th>Unit price</th><th>GST</th><th>Amount</th></tr></thead><tbody>{detailLoading ? <tr><td colSpan={5}>Loading the doctor's prescription...</td></tr> : !pricedRows.length ? <tr><td colSpan={5}>Select an appointment to load the doctor's prescribed medicines.</td></tr> : pricedRows.map((row) => <tr key={row.key}><td><strong className="phb-prescribed-name">{row.medicineName}</strong><small>{[row.dosage, row.frequency, row.duration].filter(Boolean).join(" | ")}</small><small>Doctor's quantity: {row.prescribedQuantity === "" ? "Not returned by backend" : row.prescribedQuantity}</small>{row.dispensedQuantity > 0 && <small>Dispensed: {row.dispensedQuantity} units. Quantity is fixed after dispensing.</small>}{!(row.medicineId || row.medicine?.medicineId) && <small className="phb-invalid">Medicine ID missing from the backend prescription.</small>}</td><td><input type="number" min={1} step={1} aria-label={`Quantity for ${row.medicineName}`} disabled={busy || Boolean(createdBillId) || row.dispensedQuantity > 0} value={row.quantity} onChange={(event) => updateRow(row.key, { quantity: event.target.value })} /></td><td>{money(row.price)}{row.price === null && <small className="phb-invalid">Backend price unavailable</small>}</td><td>{row.gst}%</td><td><strong>{money(row.total)}</strong></td></tr>)}</tbody></table></div>
        <div className="phb-item-footer"><span>Only medicines from the doctor's saved prescription.</span><span>{rows.length} prescribed medicine{rows.length === 1 ? "" : "s"}</span></div>
      </section>
      <aside className="phb-panel phb-summary"><h3>Bill Summary</h3><p>{savedBill ? "Saved invoice amounts" : "Selected medicine estimate"}</p><dl><div><dt>Medicine items</dt><dd>{savedBill ? savedLines.length || "?" : rows.length}</dd></div><div><dt>Stock units</dt><dd>{savedBill ? savedLines.length ? savedLines.reduce((sum, row) => sum + (number(field(row, "dispensedQuantity", "quantity", "prescribedQuantity")) ?? 0), 0) : "?" : pricedRows.reduce((sum, row) => sum + (number(row.quantity) ?? 0), 0)}</dd></div><div><dt>Subtotal</dt><dd>{money(summary.subtotal)}</dd></div><div><dt>GST</dt><dd>{money(summary.tax)}</dd></div><div className="phb-grand-total"><dt>{savedBill ? "Saved bill total" : "Estimated total"}</dt><dd>{money(summary.total)}</dd></div></dl><p className="phb-summary-note">The saved invoice uses the backend's final charges and dispensing records.</p><button className="phb-button phb-button-primary" disabled={busy || loading || detailLoading || !appointmentId || !rows.length || invalidRows || Boolean(createdBillId)} onClick={create}><ReceiptText size={18} />{busy ? "Processing payment..." : savedBill && isPaid(savedBill) ? "Payment successful" : createdBillId ? "Bill saved" : "Generate Bill & Record Payment"}</button>{createdBillId && <p className="phb-summary-note">{savedBill && isPaid(savedBill) ? "Payment successful. The paid invoice is saved below." : "Invoice saved. Check its payment status below before retrying."}</p>}</aside>
    </div>
    {selected && <section className="phb-panel phb-saved-detail"><header className="phb-panel-title"><span><ReceiptText size={20} />Invoice {invoiceOf(selected)}</span><button className="phb-icon-button" aria-label="Close bill details" disabled={busy} onClick={() => setSelected(null)}><X size={18} /></button></header><div className="phb-invoice-summary"><div><small>Patient</small><strong>{field(selected, "patientName") || "—"}</strong></div><div><small>Saved total</small><strong>{money(amountOf(selected))}</strong></div><span className={`phb-status ${isPaid(selected) ? "is-paid" : ""}`}>{statusOf(selected)}</span></div>{selectedLines.length > 0 && <div className="phb-table-scroll"><table className="phb-table"><thead><tr><th>Medicine</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{selectedLines.map((row, index) => <tr key={index}><td>{lineName(row)}</td><td>{field(row, "quantity", "dispensedQuantity", "prescribedQuantity")}</td><td>{money(field(row, "unitPrice", "sellingPrice", "price"))}</td><td>{money(field(row, "totalAmount", "amount", "lineTotal"))}</td></tr>)}</tbody></table></div>}<div className="phb-detail-actions"><button className="phb-button phb-button-light" disabled={busy} onClick={() => run(() => view(selected))}><RefreshCw size={16} />Refresh status</button><button className="phb-button phb-button-light" disabled={busy} onClick={printBill}><Printer size={16} />Print Bill</button><button className="phb-button phb-button-light" disabled={busy} onClick={() => run(async () => { const result = await pharmacyRequest(API_ENDPOINTS.billing.paymentHistory, { params: { billId: idOf(selected) } }); const list = collection(result, ["payments", "transactions", "paymentTransactions"]); if (!list) throw new Error("Unexpected payment history response."); setPayments(list); })}><History size={16} />Payment history</button><button className="phb-button phb-button-primary" disabled={busy || isPaid(selected) || number(amountOf(selected)) === null} onClick={collectPayment}><CreditCard size={17} />{isPaid(selected) ? "Paid" : `Record collected payment · ${paymentMethod}`}</button></div>{payments !== null && <div className="phb-history"><h4>Payment Transactions</h4>{payments.length ? payments.map((payment, index) => <div key={index}><span>{field(payment, "paymentMethod", "method") || "Payment"}</span><strong>{money(field(payment, "amount", "paidAmount", "paymentAmount"))}</strong><span>{field(payment, "paymentDate", "paidDate", "createdAt")}</span><span>{field(payment, "transactionId", "reference")}</span></div>) : <p>No payment transactions recorded.</p>}</div>}</section>}
    <section className="phb-panel phb-ledger"><header className="phb-panel-title"><span><ReceiptText size={20} />Saved Pharmacy Bills</span><small>{paidBills.length} paid · {bills.length - paidBills.length} pending</small></header><div className="phb-ledger-toolbar"><label><Search size={17} /><input type="search" aria-label="Search pharmacy bills" placeholder="Search patient or invoice..." value={search} onChange={(event) => setSearch(event.target.value)} /></label><select aria-label="Filter payment status" value={billFilter} onChange={(event) => setBillFilter(event.target.value)}><option value="all">All bills</option><option value="paid">Paid bills</option><option value="pending">Pending bills</option></select></div><div className="phb-table-scroll"><table className="phb-table"><thead><tr><th>Patient & Invoice</th><th>Date</th><th>Payment Status</th><th>Total Amount</th><th>Actions</th></tr></thead><tbody>{loading ? <tr><td colSpan={5}>Loading saved bills...</td></tr> : !filteredBills.length ? <tr><td colSpan={5}>No pharmacy bills found.</td></tr> : filteredBills.map((bill, index) => <tr key={idOf(bill) || index}><td><strong>{field(bill, "patientName") || "—"}</strong><small>#{invoiceOf(bill)}</small></td><td>{String(field(bill, "createdAt", "billDate", "invoiceDate") || "—").slice(0, 10)}</td><td><span className={`phb-status ${isPaid(bill) ? "is-paid" : ""}`}>{statusOf(bill)}</span></td><td><strong>{money(amountOf(bill))}</strong></td><td><button className="phb-button phb-button-light" disabled={busy || !idOf(bill)} onClick={() => run(() => view(bill))}><Eye size={16} />View Bill</button></td></tr>)}</tbody></table></div></section>
  </section>;
}
