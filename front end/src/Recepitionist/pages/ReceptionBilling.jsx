import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle, Edit3, Eye, FileText, Minus, Printer, Trash2 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { parseList, requestJson } from "../receptionApi";
import { getReceptionistProfile } from "../receptionSession";
import {
  belongsToReceptionistScope,
  getReceptionistScope,
  scopeReceptionistRecords,
} from "../receptionScope";
import { useToast } from "../../components/ToastProvider";
import {
  onlyNumberValue,
  validateNumeric,
  validateSelected,
} from "../../utils/validation";
import { formatIndianCurrency } from "../../utils/format";
import { getClinicDisplayName } from "../../utils/clinicDisplay";
import { getClinicInvoiceBranding } from "../../utils/clinicBranding";
import { fetchLabMasterTests, normalizeLabTests } from "../../utils/labMaster";
import { clearPendingDiagnosticRequest, getPendingDiagnosticRequest } from "../../utils/diagnosticRequests";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const firstValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "" && value !== 0);

const formatAmountInput = (value, { emptyValue = "0.00" } = {}) => {
  if (value === "" || value === undefined || value === null) return emptyValue;

  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : emptyValue;
};

const formatCurrency = (value) => formatIndianCurrency(value);
const amountFormat = (value) => (Number(value) || 0).toFixed(2);
const LAST_INVOICE_STORAGE_KEY = "receptionLatestInvoice";
const RECENT_SERVICE_BILLS_STORAGE_KEY = "receptionRecentServiceBills";
const HALF_GST_RATE = 0.09;

const PHARMACY_PRICE_LIST = [
  { diagnosis: "Viral Fever", item: "Paracetamol 500 mg", price: 30 },
  { diagnosis: "Hypertension", item: "Amlodipine 5 mg", price: 60 },
  { diagnosis: "Diabetes Mellitus", item: "Metformin 500 mg", price: 80 },
  { diagnosis: "Anemia", item: "Ferrous Sulfate", price: 120 },
  { diagnosis: "Asthma", item: "Salbutamol Inhaler", price: 250 },
  { diagnosis: "COPD", item: "Tiotropium Inhaler", price: 450 },
  { diagnosis: "Pneumonia", item: "Amoxicillin + Clavulanate", price: 350 },
  { diagnosis: "Tuberculosis", item: "Anti-TB Drug Kit", price: 800 },
  { diagnosis: "Dengue", item: "Oral Rehydration Salts (ORS)", price: 25 },
  { diagnosis: "Malaria", item: "Artemether + Lumefantrine", price: 180 },
  { diagnosis: "Gastritis", item: "Pantoprazole 40 mg", price: 90 },
  { diagnosis: "GERD", item: "Omeprazole 20 mg", price: 70 },
  { diagnosis: "Peptic Ulcer", item: "Pantoprazole + Sucralfate", price: 180 },
  { diagnosis: "Kidney Stones", item: "Tamsulosin 0.4 mg", price: 220 },
  { diagnosis: "Urinary Tract Infection", item: "Nitrofurantoin", price: 180 },
  { diagnosis: "Arthritis", item: "Diclofenac Tablets", price: 100 },
  { diagnosis: "Osteoarthritis", item: "Aceclofenac + Paracetamol", price: 150 },
  { diagnosis: "Migraine", item: "Sumatriptan", price: 200 },
  { diagnosis: "Epilepsy", item: "Sodium Valproate", price: 250 },
  { diagnosis: "Depression", item: "Sertraline", price: 220 },
  { diagnosis: "Anxiety Disorder", item: "Escitalopram", price: 180 },
  { diagnosis: "Hypothyroidism", item: "Levothyroxine", price: 90 },
  { diagnosis: "Hyperthyroidism", item: "Carbimazole", price: 140 },
  { diagnosis: "Skin Infection", item: "Mupirocin Ointment", price: 120 },
  { diagnosis: "Acne", item: "Benzoyl Peroxide Gel", price: 180 },
  { diagnosis: "Eczema", item: "Hydrocortisone Cream", price: 100 },
  { diagnosis: "Psoriasis", item: "Clobetasol Cream", price: 180 },
  { diagnosis: "Heart Failure", item: "Furosemide", price: 80 },
  { diagnosis: "Coronary Artery Disease", item: "Aspirin 75 mg", price: 50 },
  { diagnosis: "Heart Attack", item: "Aspirin + Clopidogrel", price: 180 },
  { diagnosis: "Arrhythmia", item: "Amiodarone", price: 250 },
  { diagnosis: "Pregnancy", item: "Folic Acid Tablets", price: 60 },
];

const AMOUNT_KEYS = {
  consultation: [
    "consultationCharge",
    "ConsultationCharge",
    "consultationCharges",
    "ConsultationCharges",
    "consultationFee",
    "ConsultationFee",
    "doctorFee",
    "DoctorFee",
  ],
  medicine: [
    "medicineCharge",
    "MedicineCharge",
    "medicineCharges",
    "MedicineCharges",
    "medicineAmount",
    "MedicineAmount",
    "medicineFee",
    "MedicineFee",
    "medicationCharge",
    "MedicationCharge",
    "medicationCharges",
    "MedicationCharges",
    "medicationAmount",
    "MedicationAmount",
    "pharmacyCharge",
    "PharmacyCharge",
    "pharmacyCharges",
    "PharmacyCharges",
    "pharmacyAmount",
    "PharmacyAmount",
  ],
  lab: [
    "labCharge",
    "LabCharge",
    "labCharges",
    "LabCharges",
    "labAmount",
    "LabAmount",
    "laboratoryCharge",
    "LaboratoryCharge",
    "laboratoryCharges",
    "LaboratoryCharges",
    "laboratoryAmount",
    "LaboratoryAmount",
    "labFee",
    "LabFee",
    "testCharge",
    "TestCharge",
    "testCharges",
    "TestCharges",
    "labTestCharge",
    "LabTestCharge",
    "labTestCharges",
    "LabTestCharges",
    "diagnosticCharge",
    "DiagnosticCharge",
    "diagnosticCharges",
    "DiagnosticCharges",
  ],
  total: [
    "totalAmount",
    "TotalAmount",
    "total",
    "Total",
    "grandTotal",
    "GrandTotal",
    "netAmount",
    "NetAmount",
    "paidAmount",
    "PaidAmount",
    "amount",
    "Amount",
  ],
};

const readAmount = (source, keys, fallback = 0) => {
  if (!source || typeof source !== "object") return Number(fallback || 0);

  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") {
      const amount = Number(value);
      if (Number.isFinite(amount)) return amount;
    }
  }

  for (const nestedKey of ["billing", "bill", "invoice", "payment", "charges", "amounts", "totals"]) {
    const nestedValue = source[nestedKey] || source[nestedKey.charAt(0).toUpperCase() + nestedKey.slice(1)];
    if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
      const amount = readAmount(nestedValue, keys, NaN);
      if (Number.isFinite(amount)) return amount;
    }
  }

  return Number(fallback || 0);
};

const getItemLabel = (item = {}) =>
  String(
    firstValue(
      item.label,
      item.Label,
      item.name,
      item.Name,
      item.title,
      item.Title,
      item.description,
      item.Description,
      item.serviceName,
      item.ServiceName,
      item.chargeType,
      item.ChargeType,
      item.type,
      item.Type,
      item.category,
      item.Category
    ) || ""
  ).toLowerCase();

const getItemAmount = (item = {}) =>
  readAmount(
    item,
    [
      "amount",
      "Amount",
      "charge",
      "Charge",
      "charges",
      "Charges",
      "price",
      "Price",
      "fee",
      "Fee",
      "total",
      "Total",
      "totalAmount",
      "TotalAmount",
      "lineTotal",
      "LineTotal",
    ],
    0
  );

const readItemizedAmount = (source, keywords = []) => {
  if (!source || typeof source !== "object") return 0;

  const arrayKeys = [
    "items",
    "Items",
    "lineItems",
    "LineItems",
    "billItems",
    "BillItems",
    "billingItems",
    "BillingItems",
    "billingDetails",
    "BillingDetails",
    "chargeDetails",
    "ChargeDetails",
    "charges",
    "Charges",
    "services",
    "Services",
    "particulars",
    "Particulars",
  ];

  for (const key of arrayKeys) {
    const value = source[key];
    if (!Array.isArray(value)) continue;

    const sum = value.reduce((amount, item) => {
      const label = getItemLabel(item);
      const matches = keywords.some((keyword) => label.includes(keyword));
      return matches ? amount + getItemAmount(item) : amount;
    }, 0);

    if (sum > 0) return sum;
  }

  for (const nestedKey of ["billing", "bill", "invoice", "payment", "details", "data", "result"]) {
    const nestedValue = source[nestedKey] || source[nestedKey.charAt(0).toUpperCase() + nestedKey.slice(1)];
    if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
      const amount = readItemizedAmount(nestedValue, keywords);
      if (amount > 0) return amount;
    }
  }

  return 0;
};

const formatInvoiceDate = (value = new Date()) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toLocaleDateString("en-IN");

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const createBillingRow = (priceList) => {
  const item = priceList[0] || { diagnosis: "", item: "", price: 0 };
  return {
    ...item,
    id: Date.now() + Math.random(),
    diagnosis: item.diagnosis,
    item: item.item,
    unitPrice: item.price,
    quantity: 1,
  };
};

const splitDiagnosticTests = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const readAppointmentDiagnosticTests = (appointment = {}) => {
  const explicitTests = firstValue(
    appointment.diagnosisTests,
    appointment.DiagnosisTests,
    appointment.diagnosticTests,
    appointment.DiagnosticTests,
    appointment.tests,
    appointment.Tests,
    appointment.consultation?.diagnosisTests,
    appointment.Consultation?.DiagnosisTests,
    appointment.consultation?.diagnosticTests,
    appointment.Consultation?.DiagnosticTests,
    appointment.latestConsultation?.diagnosisTests,
    appointment.LatestConsultation?.DiagnosisTests
  );
  if (explicitTests) return explicitTests;

  const notes = String(
    firstValue(
      appointment.clinicalNotes,
      appointment.ClinicalNotes,
      appointment.notes,
      appointment.Notes,
      appointment.consultation?.clinicalNotes,
      appointment.Consultation?.ClinicalNotes,
      appointment.latestConsultation?.clinicalNotes,
      appointment.LatestConsultation?.ClinicalNotes,
      ""
    ) || ""
  );
  return notes.match(/Diagnosis Tests\s*:\s*([^\n\r]+)/i)?.[1] || "";
};

const readAppointmentDiagnosis = (appointment = {}) =>
  firstValue(
    appointment.diagnosis,
    appointment.Diagnosis,
    appointment.consultation?.diagnosis,
    appointment.Consultation?.Diagnosis,
    appointment.latestConsultation?.diagnosis,
    appointment.LatestConsultation?.Diagnosis
  );

const getPriceListItemName = (item = {}) =>
  String(firstValue(item.item, item.testName, item.TestName, item.name, item.Name, item.serviceName, item.testCode, item.TestCode, "") || "").trim();

const getPriceListItemKey = (item = {}, index = 0) =>
  String(firstValue(item.id, item.testId, item.labTestId, item.testCode, item.TestCode, getPriceListItemName(item), index) || index);

const getBillingTotals = (rows = []) => {
  const subtotal = rows.reduce(
    (sum, row) => sum + (Number(row.unitPrice) || 0) * (Number(row.quantity) || 0),
    0
  );
  const cgst = subtotal * HALF_GST_RATE;
  const sgst = subtotal * HALF_GST_RATE;
  return {
    subtotal,
    cgst,
    sgst,
    gst: cgst + sgst,
    total: subtotal + cgst + sgst,
  };
};

const printServiceInvoice = ({
  type,
  invoiceNo: providedInvoiceNo,
  rows,
  totals,
  patientName,
  patientId,
  doctorName,
  paymentMode,
  clinicName,
  clinicId,
  clinicPhone,
  clinicEmail,
  receptionistName,
  autoPrint = true,
}) => {
  const invoiceNo = providedInvoiceNo || `${type === "pharmacy" ? "PH" : "DT"}-${String(Date.now()).slice(-8)}`;
  const invoiceDate = new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const title = type === "pharmacy" ? "Pharmacy GST Invoice" : "Diagnostic Test GST Invoice";
  const itemHeader = type === "pharmacy" ? "Product / Medicine" : "Diagnostic Test";
  const branding = getClinicInvoiceBranding({ clinicId, clinicName });
  const logoUrl = branding.logoUrl;
  const headerTitle = branding.headerTitle || clinicName;
  const headerSubtitle = branding.headerSubtitle || "Clinic Billing";
  const footerNote = branding.footerNote;
  const accentColor = branding.accentColor || "#0f9d9d";
  const printWindow = window.open("", "_blank", "width=980,height=720");
  if (!printWindow) return false;

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(title)} ${escapeHtml(invoiceNo)}</title>
        <style>
          @page { size: A4; margin: 14mm; }
          body { margin: 0; color: #111827; font-family: Arial, Helvetica, sans-serif; background: #f3f8fb; }
          .invoice { max-width: 940px; min-height: 100vh; margin: 0 auto; background: #fff; padding: 28px; border-top: 8px solid ${escapeHtml(accentColor)}; box-sizing: border-box; position: relative; overflow: hidden; }
          .invoice > *:not(.watermark) { position: relative; z-index: 1; }
          .watermark { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; z-index: 0; }
          .watermark img { width: 410px; height: 410px; object-fit: contain; opacity: .18; filter: saturate(1.35) contrast(1.08); }
          .head { display: grid; grid-template-columns: 1fr auto; gap: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 14px; }
          .clinic-title { display: flex; align-items: center; gap: 12px; }
          .clinic-title img { width: 54px; height: 54px; object-fit: contain; border-radius: 12px; }
          .head h1 { margin: 0; font-size: 21px; color: #0f172a; }
          .head p { margin: 4px 0 0; color: #475569; font-size: 12px; }
          .badge { text-align: right; }
          .badge strong { display: block; font-size: 18px; margin-top: 7px; }
          .badge span { display: inline-flex; background: #e6fffb; color: #087d7d; border: 1px solid #9bdad7; border-radius: 999px; padding: 5px 10px; font-size: 11px; font-weight: 900; text-transform: uppercase; }
          .party { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin: 18px 0; }
          .panel { border: 1px solid #d9e6ea; border-radius: 10px; padding: 14px; background: #fbfeff; }
          .panel h2 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; color: #0f172a; }
          .info { display: grid; grid-template-columns: 104px 1fr; gap: 7px; font-size: 12px; }
          .info span { color: #64748b; font-weight: 700; }
          .info b { color: #111827; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #d6e1e7; padding: 9px 8px; font-size: 12px; text-align: left; }
          th { background: #eaf8f6; color: #0f172a; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; }
          td.num, th.num { text-align: center; }
          td.money, th.money { text-align: right; font-variant-numeric: tabular-nums; }
          tfoot td { background: #f0fdfa; border-top: 2px solid ${escapeHtml(accentColor)}; color: #0f172a; font-weight: 900; }
          tfoot td:last-child { background: #d9f7f3; color: #0f172a; }
          .foot { display: flex; justify-content: space-between; align-items: end; gap: 24px; margin-top: 28px; border-top: 1px dashed #94a3b8; padding-top: 14px; color: #475569; font-size: 12px; }
          .sign { color: #0f172a; font-weight: 900; text-align: center; min-width: 190px; padding-top: 28px; border-top: 1px solid #64748b; }
          @media print { body { background: #fff; } .invoice { border-top-color: #111827; padding: 0; } }
        </style>
      </head>
      <body>
        <main class="invoice">
          <div class="watermark"><img src="${escapeHtml(logoUrl)}" alt="" /></div>
          <section class="head">
            <div>
              <div class="clinic-title">
                <img src="${escapeHtml(logoUrl)}" alt="Clinic logo" />
                <h1>${escapeHtml(headerTitle)} ${type === "pharmacy" ? "Pharmacy" : "Diagnostics"}</h1>
              </div>
              <p>${escapeHtml([headerSubtitle, clinicPhone, clinicEmail].filter(Boolean).join(" | "))}</p>
              <p>GSTIN: 37AAATC0000Z1Z0</p>
            </div>
            <div class="badge">
              <span>${escapeHtml(title)}</span>
              <strong>${escapeHtml(invoiceNo)}</strong>
              <p>Inv. Date: ${escapeHtml(invoiceDate)}</p>
            </div>
          </section>
          <section class="party">
            <div class="panel">
              <h2>Patient</h2>
              <div class="info">
                <span>Name</span><b>${escapeHtml(patientName || "-")}</b>
                <span>Patient ID</span><b>${escapeHtml(patientId || "-")}</b>
                <span>Ref. Doctor</span><b>${escapeHtml(doctorName || "-")}</b>
              </div>
            </div>
            <div class="panel">
              <h2>Payment</h2>
              <div class="info">
                <span>Mode</span><b>${escapeHtml(paymentMode || "-")}</b>
                <span>Generated By</span><b>${escapeHtml(receptionistName || "-")}</b>
                <span>GST</span><b>CGST 9% + SGST 9%</b>
              </div>
            </div>
          </section>
          <table>
            <thead>
              <tr>
                <th class="num">SNo</th>
                <th>${escapeHtml(itemHeader)}</th>
                ${type === "pharmacy" ? '<th class="num">Qty</th>' : ""}
                <th class="money">Amount</th>
                <th class="money">CGST</th>
                <th class="money">SGST</th>
                <th class="money">Net Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map((row, index) => {
                  const amount = (Number(row.unitPrice) || 0) * (Number(row.quantity) || 0);
                  const cgst = amount * HALF_GST_RATE;
                  const sgst = amount * HALF_GST_RATE;
                  return `
                    <tr>
                      <td class="num">${index + 1}</td>
                      <td>${escapeHtml(row.item)}</td>
                      ${type === "pharmacy" ? `<td class="num">${Number(row.quantity) || 1}</td>` : ""}
                      <td class="money">${amountFormat(amount)}</td>
                      <td class="money">${amountFormat(cgst)}</td>
                      <td class="money">${amountFormat(sgst)}</td>
                      <td class="money">${amountFormat(amount + cgst + sgst)}</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="${type === "pharmacy" ? 3 : 2}">Total</td>
                <td class="money">${amountFormat(totals.subtotal)}</td>
                <td class="money">${amountFormat(totals.cgst)}</td>
                <td class="money">${amountFormat(totals.sgst)}</td>
                <td class="money">${amountFormat(totals.total)}</td>
              </tr>
            </tfoot>
          </table>
          <section class="foot">
            <p>${escapeHtml(footerNote)}<br />Print on: ${escapeHtml(invoiceDate)}</p>
            <div class="sign">Authorized Signature</div>
          </section>
        </main>
        ${autoPrint ? "<script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };</script>" : ""}
      </body>
    </html>
  `);
  printWindow.document.close();
  return true;
};

const getInvoiceNumber = (invoice) =>
  firstValue(
    invoice?.invoiceNo,
    invoice?.invoiceNumber,
    invoice?.billNo,
    invoice?.billNumber,
    invoice?.billingId,
    invoice?.billId,
    invoice?.paymentId,
    invoice?.transactionId,
    invoice?.id,
    invoice?.appointmentId ? `APT-${invoice.appointmentId}` : ""
  ) || "-";

const getInvoiceId = (invoice) =>
  firstValue(
    invoice?.id,
    invoice?.Id,
    invoice?.billingId,
    invoice?.BillingId,
    invoice?.billId,
    invoice?.BillId,
    invoice?.invoiceId,
    invoice?.InvoiceId
  ) || "";

const hasBackendBillingId = (invoice) =>
  Boolean(
    firstValue(
      invoice?.billingId,
      invoice?.BillingId,
      invoice?.billId,
      invoice?.BillId,
      invoice?.invoiceId,
      invoice?.InvoiceId,
      invoice?.backendSynced ? invoice?.id : "",
      invoice?.backendSynced ? invoice?.Id : ""
    )
  );

const updateBillingPayment = async (bill, payment = {}) => {
  const billId = getInvoiceId(bill);
  if (!billId) return null;
  try {
    return await requestJson(`Billing/${billId}/payment`, {
      method: "PATCH",
      body: JSON.stringify({
        billId,
        BillId: billId,
        paymentStatus: payment.paymentStatus || bill.paymentStatus || "Paid",
        status: payment.status || bill.status || "Paid",
        paymentMode: payment.paymentMode || bill.paymentMode || bill.PaymentMode || "UPI",
        PaymentMode: payment.paymentMode || bill.paymentMode || bill.PaymentMode || "UPI",
        paidAmount: Number(payment.paidAmount ?? bill.paidAmount ?? bill.totalAmount ?? 0) || 0,
        PaidAmount: Number(payment.paidAmount ?? bill.paidAmount ?? bill.totalAmount ?? 0) || 0,
        paymentAmount: Number(payment.paymentAmount ?? bill.paymentAmount ?? bill.totalAmount ?? 0) || 0,
        PaymentAmount: Number(payment.paymentAmount ?? bill.paymentAmount ?? bill.totalAmount ?? 0) || 0,
        paidAt: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.warn("Unable to update billing payment status:", error.message);
    return null;
  }
};

const updateBillingBill = async (bill, payload = {}) => {
  const billId = getInvoiceId(bill);
  if (!billId) return null;

  return requestJson(`Billing/${billId}`, {
    method: "PUT",
    body: JSON.stringify({
      ...payload,
      id: billId,
      Id: billId,
      billId,
      BillId: billId,
    }),
  });
};

const deleteBillingBill = async (bill) => {
  const billId = getInvoiceId(bill);
  if (!billId) return false;

  await requestJson(`Billing/${billId}`, {
    method: "DELETE",
  });
  return true;
};

const getInvoiceStatus = (invoice) =>
  firstValue(invoice?.paymentStatus, invoice?.invoiceStatus, invoice?.billingStatus, invoice?.status) ||
  "Paid";

const getInvoiceDate = (invoice) =>
  firstValue(invoice?.createdAt, invoice?.createdOn, invoice?.invoiceDate, invoice?.date) ||
  new Date();

const getAppointmentId = (appointment) =>
  firstValue(
    appointment?.appointmentId,
    appointment?.AppointmentId,
    appointment?.id,
    appointment?.Id,
    appointment?.appointment?.id,
    appointment?.appointment?.appointmentId
  ) || "";

const getAppointmentStatus = (appointment = {}) => {
  const source = appointment || {};
  return String(
    source.status ??
    source.Status ??
    source.appointmentStatus ??
    source.AppointmentStatus ??
    source.billingStatus ??
    source.BillingStatus ??
    source.paymentStatus ??
    source.PaymentStatus ??
    source.appointment?.status ??
    source.appointment?.Status ??
    source.appointment?.appointmentStatus ??
    source.Appointment?.Status ??
    source.Appointment?.AppointmentStatus ??
    source.state ??
    source.State ??
    ""
  )
    .trim()
    .toLowerCase();
};

const getAppointmentPatientName = (appointment = {}) => {
  const source = appointment || {};
  return (
    firstValue(
      source.patientName,
      source.PatientName,
      source.patient?.name,
      source.Patient?.Name,
      source.patient?.fullName,
      source.Patient?.FullName
    ) || "-"
  );
};

const getAppointmentPatientId = (appointment = {}) => {
  const source = appointment || {};
  return (
    firstValue(
      source.patientId,
      source.PatientId,
      source.pid,
      source.PID,
      source.patientCode,
      source.PatientCode,
      source.patient?.id,
      source.Patient?.Id,
      source.patient?.patientId,
      source.Patient?.PatientId,
      source.patient?.pid,
      source.Patient?.PID,
      source.patient?.patientCode,
      source.Patient?.PatientCode
    ) || "-"
  );
};

const getAppointmentDoctorName = (appointment = {}) => {
  const source = appointment || {};
  return (
    firstValue(
      source.doctorName,
      source.DoctorName,
      source.doctor?.name,
      source.Doctor?.Name,
      source.doctor?.fullName,
      source.Doctor?.FullName
    ) || "-"
  );
};

const getAppointmentTime = (appointment = {}) => {
  const source = appointment || {};
  return (
    firstValue(
      source.time,
      source.Time,
      source.slot,
      source.Slot,
      source.startTime,
      source.StartTime
    ) || "-"
  );
};

const getAppointmentDate = (appointment = {}) =>
  firstValue(
    appointment?.createdAt,
    appointment?.CreatedAt,
    appointment?.appointmentDate,
    appointment?.AppointmentDate,
    appointment?.date,
    appointment?.Date,
    appointment?.slotDate,
    appointment?.SlotDate
  ) || new Date();

const getAppointmentPaidAmount = (appointment = {}) =>
  readAmount(
    appointment,
    [
      "paidAmount",
      "PaidAmount",
      "consultationFee",
      "ConsultationFee",
      "consultationCharge",
      "ConsultationCharge",
      "amount",
      "Amount",
      "totalAmount",
      "TotalAmount",
    ],
    0
  );

const isPaidAppointmentBooking = (appointment = {}) => {
  const status = String(
    firstValue(
      appointment.paymentStatus,
      appointment.PaymentStatus,
      appointment.payment?.status,
      appointment.Payment?.Status,
      appointment.status,
      appointment.Status
    ) || ""
  ).toLowerCase();

  return status.includes("paid") || getAppointmentPaidAmount(appointment) > 0;
};

const appointmentToOpBill = (appointment = {}) => {
  const appointmentId = getAppointmentId(appointment);
  const amount = getAppointmentPaidAmount(appointment);
  const createdAt = getAppointmentDate(appointment);

  return normalizeServiceBill({
    ...appointment,
    type: "consultation",
    invoiceType: "consultation",
    billingType: "Consultation",
    serviceType: "OP Billing",
    invoiceNo:
      appointment.invoiceNo ||
      appointment.invoiceNumber ||
      appointment.receiptNo ||
      appointment.ReceiptNo ||
      appointment.transactionId ||
      appointment.TransactionId ||
      (appointmentId ? `OP-${appointmentId}` : ""),
    appointmentId,
    patientId: getAppointmentPatientId(appointment),
    patientName: getAppointmentPatientName(appointment),
    doctorName: getAppointmentDoctorName(appointment),
    createdAt,
    billDate: createdAt,
    invoiceDate: createdAt,
    consultationCharge: amount,
    consultationCharges: amount,
    totalAmount: amount,
    grandTotal: amount,
    netAmount: amount,
    paidAmount: amount,
    amount,
    paymentStatus: "Paid",
    status: "Paid",
    paymentMode:
      appointment.paymentMode ||
      appointment.PaymentMode ||
      appointment.payment?.mode ||
      appointment.Payment?.Mode ||
      "-",
  });
};

const fetchBillingAppointments = async () => {
  const [appointments, billingAppointments] = await Promise.all([
    requestJson("Appointment").catch(() => null),
    requestJson("Billing/appointments").catch(() => null),
  ]);
  const byAppointmentId = new Map();

  [...parseList(billingAppointments), ...parseList(appointments)].forEach((appointment) => {
    const key = String(getAppointmentId(appointment) || JSON.stringify(appointment));
    const existing = byAppointmentId.get(key);
    byAppointmentId.set(key, existing ? { ...existing, ...appointment } : appointment);
  });

  return Array.from(byAppointmentId.values());
};

const getPatientId = (patient = {}) => {
  const source = patient || {};
  return (
    firstValue(
      source.id,
      source.Id,
      source.patientId,
      source.PatientId,
      source.pid,
      source.PID,
      source.patientCode,
      source.PatientCode
    ) || ""
  );
};

const attachPatientToAppointment = (appointment = {}, patientsById = new Map()) => {
  const patient =
    patientsById.get(String(getAppointmentPatientId(appointment))) ||
    patientsById.get(String(appointment.patientCode || appointment.PatientCode || "")) ||
    appointment.patient ||
    appointment.Patient ||
    null;

  if (!patient) return appointment;

  return {
    ...appointment,
    patient,
    Patient: appointment.Patient || patient,
    patientName: getAppointmentPatientName(appointment) !== "-"
      ? getAppointmentPatientName(appointment)
      : firstValue(patient.name, patient.Name, patient.fullName, patient.FullName),
    patientId: firstValue(appointment.patientId, appointment.PatientId, getPatientId(patient)),
    branchId: firstValue(appointment.branchId, appointment.BranchId, patient.branchId, patient.BranchId),
    branchName: firstValue(
      appointment.branchName,
      appointment.BranchName,
      appointment.branch,
      appointment.Branch,
      patient.branchName,
      patient.BranchName,
      patient.branch,
      patient.Branch
    ),
    hospitalId: firstValue(
      appointment.hospitalId,
      appointment.HospitalId,
      appointment.clinicId,
      appointment.ClinicId,
      patient.hospitalId,
      patient.HospitalId,
      patient.clinicId,
      patient.ClinicId
    ),
  };
};

const appointmentBelongsToBillingScope = (appointment, scope) => {
  if (belongsToReceptionistScope(appointment, scope)) return true;

  const patient = appointment?.patient || appointment?.Patient;
  if (patient && belongsToReceptionistScope(patient, scope)) {
    return true;
  }

  return false;
};

const getInvoiceAmounts = ({ invoice, form, selectedAppointment, total }) => {
  let medicine =
    readAmount(invoice, AMOUNT_KEYS.medicine, 0) ||
    readItemizedAmount(invoice, ["medicine", "medication", "pharmacy", "drug"]) ||
    Number(form.medicineCharges || 0);
  const lab =
    readAmount(invoice, AMOUNT_KEYS.lab, 0) ||
    readItemizedAmount(invoice, ["lab", "laboratory", "test", "diagnostic"]) ||
    Number(form.labCharges || 0);
  const lineTotal = medicine + lab;
  const invoiceTotal = readAmount(invoice, AMOUNT_KEYS.total, total);
  const unitemizedBalance = invoiceTotal - lineTotal;

  if (invoice && invoiceTotal > 0 && unitemizedBalance > 0 && medicine === 0 && lab === 0) {
    medicine = unitemizedBalance;
  }

  return {
    medicine,
    lab,
    total: medicine + lab,
  };
};

const getLatestInvoice = (data) => {
  const invoices = parseList(data);
  return invoices.sort((a, b) => {
    const bDate = new Date(b?.createdAt || 0).getTime();
    const aDate = new Date(a?.createdAt || 0).getTime();
    if (bDate !== aDate) return bDate - aDate;
    return Number(b?.id || 0) - Number(a?.id || 0);
  })[0] || null;
};

const readStoredLatestInvoice = () => {
  try {
    const invoice = JSON.parse(localStorage.getItem(LAST_INVOICE_STORAGE_KEY) || "null");
    return invoice && typeof invoice === "object" ? invoice : null;
  } catch {
    return null;
  }
};

const storeLatestInvoice = (invoice) => {
  if (!invoice || typeof invoice !== "object") return;

  try {
    localStorage.setItem(LAST_INVOICE_STORAGE_KEY, JSON.stringify(invoice));
  } catch {
    // Ignore storage quota/privacy failures; backend invoice remains the source of truth.
  }
};

const readRecentServiceBills = () => {
  try {
    const bills = JSON.parse(localStorage.getItem(RECENT_SERVICE_BILLS_STORAGE_KEY) || "[]");
    return Array.isArray(bills) ? bills : [];
  } catch {
    return [];
  }
};

const storeRecentServiceBill = (bill) => {
  if (!bill || typeof bill !== "object") return [];

  const billId = getInvoiceId(bill);
  const nextBills = [
    bill,
    ...readRecentServiceBills().filter((item) => {
      const sameId = billId && String(getInvoiceId(item)) === String(billId);
      const sameInvoice =
        String(item.invoiceNo || item.invoiceNumber || item.billNumber || "") ===
        String(bill.invoiceNo || bill.invoiceNumber || bill.billNumber || "");
      return !(sameId || sameInvoice);
    }),
  ].slice(0, 12);

  try {
    localStorage.setItem(RECENT_SERVICE_BILLS_STORAGE_KEY, JSON.stringify(nextBills));
  } catch {
    // Local recent bills are a convenience; Billing API remains the source for revenue.
  }

  return nextBills;
};

const removeRecentServiceBill = (bill) => {
  const billId = getInvoiceId(bill);
  const invoiceNo = bill?.invoiceNo || bill?.invoiceNumber || bill?.billNumber || "";
  const nextBills = readRecentServiceBills().filter((item) => {
    const sameId = billId && String(getInvoiceId(item)) === String(billId);
    const sameInvoice =
      invoiceNo &&
      String(item.invoiceNo || item.invoiceNumber || item.billNumber || "") === String(invoiceNo);
    return !(sameId || sameInvoice);
  });

  try {
    localStorage.setItem(RECENT_SERVICE_BILLS_STORAGE_KEY, JSON.stringify(nextBills));
  } catch {
    // Billing API is the source of truth; local latest-bills cache is best-effort.
  }

  return nextBills;
};

const getServiceBillType = (bill = {}) => {
  const rawType = String(
    bill.type ||
      bill.invoiceType ||
      bill.billingType ||
      bill.serviceType ||
      bill.BillingType ||
      bill.InvoiceType ||
      ""
  ).toLowerCase();

  if (rawType.includes("pharmacy") || rawType.includes("medicine")) return "pharmacy";
  if (rawType.includes("diagnostic") || rawType.includes("diagnosis") || rawType.includes("lab") || rawType.includes("test")) return "diagnostic";
  if (rawType.includes("consultation") || rawType.includes("op")) return "consultation";

  const medicine = readAmount(bill, AMOUNT_KEYS.medicine, 0);
  const lab = readAmount(bill, AMOUNT_KEYS.lab, 0);
  if (medicine > 0 && lab === 0) return "pharmacy";
  if (lab > 0 && medicine === 0) return "diagnostic";
  return "consultation";
};

const normalizeServiceBill = (bill = {}) => {
  const type = getServiceBillType(bill);
  const consultationCharge = readAmount(bill, AMOUNT_KEYS.consultation, 0);
  const medicineCharge = readAmount(bill, AMOUNT_KEYS.medicine, 0);
  const labCharge = readAmount(bill, AMOUNT_KEYS.lab, 0);
  const totalAmount = readAmount(bill, AMOUNT_KEYS.total, bill.totalAmount || bill.paidAmount || 0);
  const cgstAmount = readAmount(bill, ["cgstAmount", "CGSTAmount", "cgst", "CGST"], 0);
  const sgstAmount = readAmount(bill, ["sgstAmount", "SGSTAmount", "sgst", "SGST"], 0);
  const gstAmount = readAmount(bill, ["gstAmount", "GSTAmount", "gst", "GST", "taxAmount", "TaxAmount"], cgstAmount + sgstAmount);
  return {
    ...bill,
    type,
    invoiceType: type,
    billingType:
      type === "pharmacy"
        ? "Pharmacy"
        : type === "diagnostic"
          ? "Diagnostic"
          : "Consultation",
    invoiceNo: bill.invoiceNo || bill.invoiceNumber || bill.billNumber || bill.billNo,
    invoiceNumber: bill.invoiceNumber || bill.invoiceNo || bill.billNumber || bill.billNo,
    billNumber: bill.billNumber || bill.invoiceNumber || bill.invoiceNo || bill.billNo,
    patientName: bill.patientName || bill.PatientName || bill.patient?.name || bill.Patient?.Name,
    patientId: bill.patientId || bill.PatientId || bill.patient?.patientId || bill.Patient?.PatientId,
    doctorName: bill.doctorName || bill.DoctorName || bill.doctor?.name || bill.Doctor?.Name,
    createdAt: bill.createdAt || bill.CreatedAt || bill.invoiceDate || bill.billDate,
    consultationCharge,
    consultationCharges: consultationCharge,
    medicineCharge,
    medicineCharges: medicineCharge,
    labCharge,
    labCharges: labCharge,
    cgstAmount,
    CGSTAmount: cgstAmount,
    sgstAmount,
    SGSTAmount: sgstAmount,
    gstAmount,
    GSTAmount: gstAmount,
    totalAmount,
    grandTotal: readAmount(bill, ["grandTotal", "GrandTotal"], totalAmount),
    netAmount: readAmount(bill, ["netAmount", "NetAmount"], totalAmount),
    payableAmount: readAmount(bill, ["payableAmount", "PayableAmount"], totalAmount),
    paymentAmount: readAmount(bill, ["paymentAmount", "PaymentAmount"], totalAmount),
    paidAmount: readAmount(bill, ["paidAmount", "PaidAmount"], totalAmount),
    amount: readAmount(bill, ["amount", "Amount"], totalAmount),
    revenue: readAmount(bill, ["revenue", "Revenue"], totalAmount),
  };
};

const mergeRecentServiceBills = (...billGroups) => {
  const byInvoice = new Map();

  billGroups.flat().filter(Boolean).map(normalizeServiceBill).forEach((bill) => {
    const key = String(bill.invoiceNo || bill.invoiceNumber || bill.billNumber || `${bill.type}-${bill.createdAt}-${bill.patientId}`);
    if (!key) return;
    byInvoice.set(key, { ...(byInvoice.get(key) || {}), ...bill });
  });

  return Array.from(byInvoice.values())
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 30);
};

const syncRecentServiceBillsToBackend = async () => {
  const bills = readRecentServiceBills();
  let changed = false;
  const nextBills = [];

  for (const bill of bills) {
    if (bill.backendSynced) {
      nextBills.push(bill);
      continue;
    }

    try {
      await requestJson("Billing", {
        method: "POST",
        body: JSON.stringify({
          ...bill,
          invoiceNo: bill.invoiceNo || bill.invoiceNumber || bill.billNumber,
          invoiceNumber: bill.invoiceNumber || bill.invoiceNo || bill.billNumber,
          billNumber: bill.billNumber || bill.invoiceNumber || bill.invoiceNo,
          patientId: bill.patientId || bill.PatientId,
          PatientId: bill.PatientId || bill.patientId,
          patientName: bill.patientName || bill.PatientName,
          PatientName: bill.PatientName || bill.patientName,
          appointmentId: bill.appointmentId || bill.AppointmentId || 0,
          AppointmentId: bill.AppointmentId || bill.appointmentId || 0,
        }),
      });
      nextBills.push({ ...bill, backendSynced: true });
      changed = true;
    } catch {
      nextBills.push(bill);
    }
  }

  if (changed) {
    try {
      localStorage.setItem(RECENT_SERVICE_BILLS_STORAGE_KEY, JSON.stringify(nextBills.slice(0, 12)));
    } catch {
      // Keep unsynced local bills available if storage update fails.
    }
  }

  return nextBills;
};

const fetchInvoiceDetails = async (invoice) => {
  const invoiceId = getInvoiceId(invoice);
  if (!invoiceId) return invoice;

  const detailPaths = [
    `Billing/${invoiceId}`,
  ];

  for (const path of detailPaths) {
    try {
      const details = await requestJson(path);
      if (details && typeof details === "object") {
        return {
          ...invoice,
          ...(Array.isArray(details) ? details[0] : details),
        };
      }
    } catch {
      // Try the next supported detail shape.
    }
  }

  return invoice;
};

function ReceptionBilling() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const receptionistProfile = getReceptionistProfile();
  const receptionistScope = useMemo(() => getReceptionistScope(), []);
  const clinicName = getClinicDisplayName(receptionistProfile, "CMS Clinic");
  const clinicId = receptionistProfile.hospitalId || localStorage.getItem("hospitalId") || "";
  const clinicEmail =
    localStorage.getItem("clinicEmail") ||
    localStorage.getItem("hospitalEmail") ||
    receptionistProfile.email ||
    "";
  const clinicPhone =
    localStorage.getItem("clinicPhone") ||
    localStorage.getItem("hospitalPhone") ||
    localStorage.getItem("contactNumber") ||
    "";
  const amountFormatTimers = useRef({});
  const messageTimer = useRef(null);
  const [appointments, setAppointments] = useState([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [invoice, setInvoice] = useState(null);
  const getInitialBillingMode = () => {
    try {
      const qp = new URLSearchParams(location?.search || window.location.search || "");
      const q = (qp.get("mode") || qp.get("type") || (location && location.state && location.state.mode) || "").toString().toLowerCase();
      if (q === "pharmacy") return "pharmacy";
      if (q === "diagnostic" || q === "diagnosis") return "diagnostic";
      return "consultation";
    } catch {
      return "consultation";
    }
  };

  const [billingMode, setBillingMode] = useState(getInitialBillingMode);
  const [diagnosticRows, setDiagnosticRows] = useState([]);
  const [labMasterPriceList, setLabMasterPriceList] = useState([]);
  const [labMasterLoading, setLabMasterLoading] = useState(false);
  const [pharmacyRows, setPharmacyRows] = useState([]);
  const [recentServiceBills, setRecentServiceBills] = useState(() => readRecentServiceBills());
  const [editingBill, setEditingBill] = useState(null);
  const [serviceSearch, setServiceSearch] = useState("");
  const [form, setForm] = useState({
    appointmentId: "",
    paymentMode: "UPI",
    medicineCharges: "",
    labCharges: "",
  });

  useEffect(() => {
    const qp = new URLSearchParams(location?.search || window.location.search || "");
    const q = (qp.get("mode") || qp.get("type") || (location?.state && location.state.mode) || "").toString().toLowerCase();
    if (q === "pharmacy") setBillingMode("pharmacy");
    else if (q === "diagnostic" || q === "diagnosis") setBillingMode("diagnostic");
    else if (q === "consultation" || q === "appointment" || !q) setBillingMode("consultation");

    const loadBillingData = async () => {
      try {
        const [appointmentsResult, invoicesResult] = await Promise.allSettled([
          fetchBillingAppointments(),
          requestJson("Billing"),
        ]);
        const patientsData = await requestJson("Patient").catch(() => []);

        const appointmentsResultData =
          appointmentsResult.status === "fulfilled" ? appointmentsResult.value : [];
        const invoicesData =
          invoicesResult.status === "fulfilled" ? invoicesResult.value : [];
        const scopedPatients = scopeReceptionistRecords(parseList(patientsData), receptionistScope);
        const patientsById = new Map();

        scopedPatients.forEach((patient) => {
          const id = getPatientId(patient);
          if (id) patientsById.set(String(id), patient);
          if (patient.patientCode || patient.PatientCode) {
            patientsById.set(String(patient.patientCode || patient.PatientCode), patient);
          }
          if (patient.pid || patient.PID) {
            patientsById.set(String(patient.pid || patient.PID), patient);
          }
        });

        const bookedAppointments = parseList(appointmentsResultData)
          .map((appointment) => attachPatientToAppointment(appointment, patientsById));
        const strictList = bookedAppointments.filter((appointment) =>
          appointmentBelongsToBillingScope(appointment, receptionistScope)
        );
        const list = strictList.length
          ? strictList
          : scopeReceptionistRecords(bookedAppointments, receptionistScope, {
              allowMissingBranch: true,
            });
        const invoiceList = parseList(invoicesData).map((bill) => normalizeServiceBill({ ...bill, backendSynced: true }));
        const scopedInvoices = scopeReceptionistRecords(invoiceList, receptionistScope);
        const fallbackScopedInvoices = scopeReceptionistRecords(invoiceList, receptionistScope, {
          allowMissingClinic: true,
          allowMissingBranch: true,
        });

        if (invoicesResult.status !== "fulfilled") {
          console.warn("Unable to load invoices:", invoicesResult.reason);
        }

        const latestInvoice =
          getLatestInvoice(scopedInvoices) ||
          getLatestInvoice(fallbackScopedInvoices) ||
          (invoicesResult.status !== "fulfilled" ? readStoredLatestInvoice() : null);
        const latestInvoiceDetails = latestInvoice
          ? await fetchInvoiceDetails(latestInvoice)
          : null;

        setAppointments(list);
        setForm((prev) => ({
          ...prev,
          appointmentId: String(getAppointmentId(list[0]) || ""),
        }));
        setInvoice(latestInvoiceDetails);
        const syncedRecentBills = await syncRecentServiceBillsToBackend();
        setRecentServiceBills(mergeRecentServiceBills(invoiceList, syncedRecentBills));
      } catch (error) {
        setMessage(error.message);
        setMessageType("error");
        toast.error(error.message || "Unable to load billing details.");
      }
    };

    loadBillingData();

    const handleRefresh = () => {
      if (document.visibilityState === "visible") {
        loadBillingData();
      }
    };

    window.addEventListener("focus", loadBillingData);
    document.addEventListener("visibilitychange", handleRefresh);

    return () => {
      window.removeEventListener("focus", loadBillingData);
      document.removeEventListener("visibilitychange", handleRefresh);
    };
  }, [toast, receptionistScope]);

  useEffect(() => {
    const timers = amountFormatTimers.current;

    return () => {
      Object.values(timers).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      if (messageTimer.current) {
        window.clearTimeout(messageTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    setServiceSearch("");
  }, [billingMode]);

  useEffect(() => {
    let isActive = true;
    setLabMasterLoading(true);

    const loadLabMasterTests = async () => {
      try {
        return await fetchLabMasterTests();
      } catch (primaryError) {
        console.warn("Unable to load lab master with shared helper.", primaryError);
        const data = await requestJson("Lab/master");
        return normalizeLabTests(data);
      }
    };

    loadLabMasterTests()
      .then((tests) => {
        if (!isActive) return;
        setLabMasterPriceList(
          tests.map((test) => ({
            ...test,
            diagnosis: test.diagnosis || test.category || "Lab",
            item: getPriceListItemName(test),
            price: Number(test.price) || 0,
          })).filter((test) => test.item)
        );
      })
      .catch((err) => {
        console.warn("Unable to load lab master tests.", err);
        if (isActive) setLabMasterPriceList([]);
      })
      .finally(() => {
        if (isActive) setLabMasterLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const clearMessageTimer = () => {
    if (messageTimer.current) {
      window.clearTimeout(messageTimer.current);
      messageTimer.current = null;
    }
  };

  const showMessage = (text, type = "error", { autoHide = false } = {}) => {
    clearMessageTimer();
    setMessage(text);
    setMessageType(type);

    if (autoHide) {
      messageTimer.current = window.setTimeout(() => {
        setMessage("");
        setMessageType("");
        messageTimer.current = null;
      }, 2000);
    }
  };

  const selectedAppointment = useMemo(() => {
    return appointments.find(
      (item) => String(getAppointmentId(item)) === String(form.appointmentId)
    );
  }, [appointments, form.appointmentId]);

  useEffect(() => {
    if (billingMode !== "diagnostic" || !selectedAppointment || !labMasterPriceList.length) return;

    const pendingRequest = getPendingDiagnosticRequest({
      appointmentId: getAppointmentId(selectedAppointment),
      patientId: getAppointmentPatientId(selectedAppointment),
      patientName: getAppointmentPatientName(selectedAppointment),
    });
    const requestedTests = [
      ...splitDiagnosticTests(readAppointmentDiagnosticTests(selectedAppointment)),
      ...(Array.isArray(pendingRequest?.tests) ? pendingRequest.tests : splitDiagnosticTests(pendingRequest?.tests)),
    ];
    if (!requestedTests.length) return;

    const diagnosis = readAppointmentDiagnosis(selectedAppointment) || pendingRequest?.diagnosis || "Lab";
    setDiagnosticRows((rows) => {
      const existing = new Set(rows.map((row) => String(row.item || "").trim().toLowerCase()));
      const nextRows = requestedTests
        .map((testName) => {
          const matched = labMasterPriceList.find(
            (test) => getPriceListItemName(test).toLowerCase() === String(testName).trim().toLowerCase()
          );
          if (!matched || existing.has(String(matched.item || "").trim().toLowerCase())) return null;
          existing.add(String(matched.item || "").trim().toLowerCase());
          return createBillingRow([{ ...matched, diagnosis: matched.diagnosis || diagnosis }]);
        })
        .filter(Boolean);

      return nextRows.length ? [...rows, ...nextRows] : rows;
    });
  }, [billingMode, labMasterPriceList, selectedAppointment]);

  const medicineCharges = Number(form.medicineCharges || 0);
  const labCharges = Number(form.labCharges || 0);
  const total = medicineCharges + labCharges;
  const activeServiceRows = billingMode === "pharmacy" ? pharmacyRows : diagnosticRows;
  const activePriceList = billingMode === "pharmacy" ? PHARMACY_PRICE_LIST : labMasterPriceList;
  const serviceDisplayRows = activeServiceRows.map((row) => ({
    ...row,
    quantity: billingMode === "pharmacy" ? Number(row.quantity) || 1 : 1,
  }));
  const serviceDisplayTotals = getBillingTotals(serviceDisplayRows);
  const visibleRecentServiceBills = useMemo(
    () => {
      if (billingMode === "consultation") {
        const backendOpBills = recentServiceBills.filter(
          (bill) => getServiceBillType(bill) === "consultation"
        );
        const appointmentOpBills = appointments
          .filter(isPaidAppointmentBooking)
          .map(appointmentToOpBill);
        return mergeRecentServiceBills(backendOpBills, appointmentOpBills)
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          .slice(0, 30);
      }

      return recentServiceBills.filter(
        (bill) => getServiceBillType(bill) === billingMode
      );
    },
    [appointments, billingMode, recentServiceBills]
  );
  const getValidServiceRows = () =>
    activeServiceRows
      .filter((row) => row.diagnosis && row.item && Number(row.quantity || 1) > 0)
      .map((row) => ({
        ...row,
        quantity: billingMode === "pharmacy" ? Number(row.quantity) || 1 : 1,
      }));

  const buildServiceInvoiceDetails = () => {
    const rows = getValidServiceRows();
    const totals = getBillingTotals(rows);
    const hasAppointment = Boolean(selectedAppointment);
    const invoiceNo = `${billingMode === "pharmacy" ? "PH" : "DT"}-${String(Date.now()).slice(-8)}`;
    const createdAt = new Date().toISOString();
    const appointmentPatientId = hasAppointment ? getAppointmentPatientId(selectedAppointment) : "DIRECT";
    const appointmentPatientName = hasAppointment ? getAppointmentPatientName(selectedAppointment) : "Walk-in Patient";
    const appointmentId = hasAppointment ? getAppointmentId(selectedAppointment) : "";
    const appointmentBranchId = firstValue(selectedAppointment?.branchId, selectedAppointment?.BranchId, receptionistScope.branchId);
    const appointmentBranchName = firstValue(
      selectedAppointment?.branchName,
      selectedAppointment?.BranchName,
      selectedAppointment?.branch?.name,
      selectedAppointment?.Branch?.Name,
      receptionistScope.branchName
    );
    return {
      type: billingMode,
      invoiceNo,
      createdAt,
      rows,
      totals,
      patientName: appointmentPatientName,
      patientId: appointmentPatientId,
      appointmentId,
      doctorName: hasAppointment ? getAppointmentDoctorName(selectedAppointment) : "Direct Billing",
      paymentMode: form.paymentMode,
      clinicName,
      clinicId,
      clinicPhone,
      clinicEmail,
      branchId: appointmentBranchId,
      branchName: appointmentBranchName,
      receptionistName: receptionistProfile.name,
    };
  };

  const buildServiceBillingPayload = (details) => {
    const isPharmacy = details.type === "pharmacy";
    const serviceItems = details.rows.map((row) => ({
      labTestId: row.id || row.testId || row.labTestId || "",
      LabTestId: row.id || row.testId || row.labTestId || "",
      diagnosis: row.diagnosis,
      item: row.item,
      testName: row.item,
      TestName: row.item,
      name: row.item,
      quantity: Number(row.quantity) || 1,
      unitPrice: Number(row.unitPrice) || 0,
      price: Number(row.unitPrice) || 0,
      amount: (Number(row.unitPrice) || 0) * (Number(row.quantity) || 1),
    }));

    return {
      appointmentId: details.appointmentId ? Number(details.appointmentId) : 0,
      AppointmentId: details.appointmentId ? Number(details.appointmentId) : 0,
      appointmentNumber: details.appointmentId,
      patientId: details.patientId,
      PatientId: details.patientId,
      patientCode: details.patientId,
      patientName: details.patientName,
      PatientName: details.patientName,
      patient: {
        id: details.patientId,
        patientId: details.patientId,
        name: details.patientName,
      },
      appointment: {
        id: details.appointmentId,
        appointmentId: details.appointmentId,
        patientId: details.patientId,
        patientName: details.patientName,
      },
      doctorName: details.doctorName,
      clinicId: details.clinicId,
      ClinicId: details.clinicId,
      hospitalId: details.clinicId,
      HospitalId: details.clinicId,
      clinicName: details.clinicName,
      hospitalName: details.clinicName,
      branchId: details.branchId,
      BranchId: details.branchId,
      branchName: details.branchName,
      BranchName: details.branchName,
      invoiceNumber: details.invoiceNo,
      invoiceNo: details.invoiceNo,
      billNumber: details.invoiceNo,
      billNo: details.invoiceNo,
      invoiceType: details.type,
      InvoiceType: details.type,
      billingType: isPharmacy ? "Pharmacy" : "Diagnostic",
      BillingType: isPharmacy ? "Pharmacy" : "Diagnostic",
      serviceType: isPharmacy ? "Pharmacy Billing" : "Diagnosis Test Billing",
      ServiceType: isPharmacy ? "Pharmacy Billing" : "Diagnosis Test Billing",
      consultationCharge: 0,
      consultationCharges: 0,
      opRevenue: 0,
      medicineCharge: isPharmacy ? details.totals.total : 0,
      medicineCharges: isPharmacy ? details.totals.total : 0,
      pharmacyRevenue: isPharmacy ? details.totals.total : 0,
      labCharge: isPharmacy ? 0 : details.totals.total,
      labCharges: isPharmacy ? 0 : details.totals.total,
      diagnosticRevenue: isPharmacy ? 0 : details.totals.total,
      subtotal: details.totals.subtotal,
      taxableAmount: details.totals.subtotal,
      cgstAmount: details.totals.cgst,
      CGSTAmount: details.totals.cgst,
      sgstAmount: details.totals.sgst,
      SGSTAmount: details.totals.sgst,
      gstAmount: details.totals.gst,
      GSTAmount: details.totals.gst,
      gstPercentage: 18,
      totalAmount: details.totals.total,
      grandTotal: details.totals.total,
      netAmount: details.totals.total,
      payableAmount: details.totals.total,
      paymentAmount: details.totals.total,
      paidAmount: details.totals.total,
      amount: details.totals.total,
      revenue: details.totals.total,
      source: "reception",
      billingSource: "reception",
      bookingSource: "offline",
      paymentMode: details.paymentMode,
      PaymentMode: details.paymentMode,
      paymentStatus: "Paid",
      PaymentStatus: "Paid",
      status: "Paid",
      Status: "Paid",
      createdAt: details.createdAt,
      billDate: details.createdAt,
      invoiceDate: details.createdAt,
      items: serviceItems,
      billItems: serviceItems,
      serviceItems,
    };
  };

  const openServiceInvoice = async ({ autoPrint = true, save = false } = {}) => {
    const details = buildServiceInvoiceDetails();
    if (!details.rows.length) {
      const text = "Select at least one billable item.";
      showMessage(text, "error");
      toast.error(text);
      return false;
    }

    let savedInvoice = {};
    if (save) {
      const payload = buildServiceBillingPayload(details);
      const canUpdate = editingBill && getInvoiceId(editingBill) && getServiceBillType(editingBill) === details.type;
      const response = canUpdate
        ? await updateBillingBill(editingBill, payload)
        : await requestJson("Billing", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      savedInvoice = Array.isArray(response) ? response[0] || {} : response || {};

      const invoiceShape = {
        ...payload,
        ...(canUpdate ? editingBill : {}),
        ...savedInvoice,
        invoiceNo: savedInvoice.invoiceNo || savedInvoice.invoiceNumber || savedInvoice.billNumber || editingBill?.invoiceNo || editingBill?.invoiceNumber || editingBill?.billNumber || details.invoiceNo,
        invoiceNumber: savedInvoice.invoiceNumber || savedInvoice.billNumber || editingBill?.invoiceNumber || editingBill?.billNumber || editingBill?.invoiceNo || details.invoiceNo,
        billNumber: savedInvoice.billNumber || savedInvoice.invoiceNumber || editingBill?.billNumber || editingBill?.invoiceNumber || editingBill?.invoiceNo || details.invoiceNo,
        createdAt: savedInvoice.createdAt || savedInvoice.billDate || details.createdAt,
        type: details.type,
        rows: details.rows,
        totals: details.totals,
        patientName: details.patientName,
        patientId: details.patientId,
        doctorName: details.doctorName,
        paymentMode: details.paymentMode,
        invoiceType: details.type,
        totalAmount: details.totals.total,
        paidAmount: details.totals.total,
        backendSynced: true,
      };
      const paymentUpdate = await updateBillingPayment(invoiceShape, {
        paymentMode: details.paymentMode,
        paidAmount: details.totals.total,
      });
      if (paymentUpdate && typeof paymentUpdate === "object") {
        Object.assign(invoiceShape, Array.isArray(paymentUpdate) ? paymentUpdate[0] || {} : paymentUpdate);
      }
      setInvoice(invoiceShape);
      storeLatestInvoice(invoiceShape);
      setRecentServiceBills((prev) =>
        mergeRecentServiceBills([invoiceShape], storeRecentServiceBill(invoiceShape), prev)
      );
      if (details.type === "diagnostic") {
        clearPendingDiagnosticRequest({
          appointmentId: details.appointmentId,
          patientId: details.patientId,
          patientName: details.patientName,
        });
      }
      setEditingBill(null);
      showMessage(`${billingMode === "pharmacy" ? "Pharmacy" : "Diagnostic test"} bill ${canUpdate ? "updated" : "generated"} successfully`, "success", { autoHide: true });
      printServiceInvoice({ ...details, invoiceNo: invoiceShape.invoiceNo, autoPrint });
      return true;
    }

    printServiceInvoice({ ...details, autoPrint });
    return true;
  };

  const validateForm = () => {
    const nextErrors = {
      appointmentId: validateSelected(form.appointmentId, "an appointment"),
      paymentMode: validateSelected(form.paymentMode, "a payment mode"),
      medicineCharges: validateNumeric(form.medicineCharges || 0, "Medicine charges"),
      labCharges: validateNumeric(form.labCharges || 0, "Lab charges"),
    };

    Object.keys(nextErrors).forEach((key) => {
      if (!nextErrors[key]) delete nextErrors[key];
    });

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const generate = async (event) => {
    event.preventDefault();
    if (billingMode !== "consultation") {
      await openServiceInvoice({ autoPrint: true, save: true });
      return;
    }

    if (!validateForm()) {
      const text = "Please fix the highlighted fields.";
      showMessage(text, "error");
      toast.error(text);
      return;
    }

    const invoiceWindow = window.open("", "_blank", "width=860,height=980");
    if (invoiceWindow) {
      invoiceWindow.document.write(`
        <!doctype html>
        <html>
          <head>
            <title>Generating invoice</title>
            <style>
              body {
                margin: 0;
                min-height: 100vh;
                display: grid;
                place-items: center;
                color: #0f172a;
                font-family: Arial, sans-serif;
              }
              .loader {
                border: 1px solid #d9e5ea;
                border-radius: 12px;
                padding: 24px 28px;
                box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
              }
              strong { display: block; margin-bottom: 6px; }
              span { color: #506172; font-size: 13px; }
            </style>
          </head>
          <body>
            <div class="loader">
              <strong>Preparing invoice</strong>
              <span>Please wait while the bill is generated.</span>
            </div>
          </body>
        </html>
      `);
      invoiceWindow.document.close();
    }

    const consultationCharge = Number(form.medicineCharges || 0) + Number(form.labCharges || 0);
    const subtotal = consultationCharge;
    const cgstAmount = subtotal * HALF_GST_RATE;
    const sgstAmount = subtotal * HALF_GST_RATE;
    const gstAmount = cgstAmount + sgstAmount;
    const totalAmount = subtotal + gstAmount;

    const body = {
      appointmentId: Number(form.appointmentId),
      AppointmentId: Number(form.appointmentId),
      appointmentNumber: form.appointmentId,
      patientId: getAppointmentPatientId(selectedAppointment),
      PatientId: getAppointmentPatientId(selectedAppointment),
      patientCode: getAppointmentPatientId(selectedAppointment),
      patientName: getAppointmentPatientName(selectedAppointment),
      PatientName: getAppointmentPatientName(selectedAppointment),
      patient: {
        id: getAppointmentPatientId(selectedAppointment),
        patientId: getAppointmentPatientId(selectedAppointment),
        name: getAppointmentPatientName(selectedAppointment),
      },
      appointment: {
        id: form.appointmentId,
        appointmentId: form.appointmentId,
        patientId: getAppointmentPatientId(selectedAppointment),
        patientName: getAppointmentPatientName(selectedAppointment),
      },
      doctorName: getAppointmentDoctorName(selectedAppointment),
      clinicId,
      ClinicId: clinicId,
      hospitalId: clinicId,
      HospitalId: clinicId,
      clinicName,
      hospitalName: clinicName,
      branchId: firstValue(selectedAppointment?.branchId, selectedAppointment?.BranchId, receptionistScope.branchId),
      BranchId: firstValue(selectedAppointment?.branchId, selectedAppointment?.BranchId, receptionistScope.branchId),
      branchName: firstValue(selectedAppointment?.branchName, selectedAppointment?.BranchName, receptionistScope.branchName),
      BranchName: firstValue(selectedAppointment?.branchName, selectedAppointment?.BranchName, receptionistScope.branchName),
      consultationCharge,
      consultationCharges: consultationCharge,
      opRevenue: consultationCharge,
      medicineCharge: 0,
      medicineCharges: 0,
      pharmacyRevenue: 0,
      labCharge: 0,
      labCharges: 0,
      diagnosticRevenue: 0,
      subtotal,
      taxableAmount: subtotal,
      cgstAmount,
      CGSTAmount: cgstAmount,
      sgstAmount,
      SGSTAmount: sgstAmount,
      gstAmount,
      GSTAmount: gstAmount,
      gstPercentage: 18,
      totalAmount,
      grandTotal: totalAmount,
      netAmount: totalAmount,
      payableAmount: totalAmount,
      paymentAmount: totalAmount,
      paidAmount: totalAmount,
      amount: totalAmount,
      revenue: totalAmount,
      invoiceNo: editingBill?.invoiceNo || editingBill?.invoiceNumber || editingBill?.billNumber,
      invoiceNumber: editingBill?.invoiceNumber || editingBill?.billNumber || editingBill?.invoiceNo,
      billNumber: editingBill?.billNumber || editingBill?.invoiceNumber || editingBill?.invoiceNo,
      billingType: "Consultation",
      BillingType: "Consultation",
      invoiceType: "consultation",
      InvoiceType: "consultation",
      serviceType: "Consultation Billing",
      ServiceType: "Consultation Billing",
      source: "reception",
      billingSource: "reception",
      bookingSource: "offline",
      paymentMode: String(form.paymentMode || ""),
      PaymentMode: String(form.paymentMode || ""),
      paymentStatus: "Paid",
      PaymentStatus: "Paid",
      status: "Paid",
      Status: "Paid",
      createdAt: new Date().toISOString(),
      billDate: new Date().toISOString(),
      invoiceDate: new Date().toISOString(),
    };

    try {
      const canUpdate = editingBill && getInvoiceId(editingBill) && getServiceBillType(editingBill) === "consultation";
      const data = canUpdate
        ? await updateBillingBill(editingBill, body)
        : await requestJson("Billing", {
            method: "POST",
            body: JSON.stringify(body),
          });

      const invoiceData = Array.isArray(data) ? data[0] : data;
      const nextInvoice = {
        ...(invoiceData || {}),
        ...(canUpdate ? editingBill : {}),
        ...body,
        invoiceNo: invoiceData?.invoiceNo || invoiceData?.invoiceNumber || editingBill?.invoiceNo || editingBill?.invoiceNumber || editingBill?.billNumber,
        invoiceNumber: invoiceData?.invoiceNumber || invoiceData?.billNumber || editingBill?.invoiceNumber || editingBill?.billNumber || editingBill?.invoiceNo,
        billNumber: invoiceData?.billNumber || invoiceData?.invoiceNumber || editingBill?.billNumber || editingBill?.invoiceNumber || editingBill?.invoiceNo,
        consultationCharge,
        consultationCharges: consultationCharge,
        medicineCharge: 0,
        medicineCharges: 0,
        labCharge: 0,
        labCharges: 0,
        subtotal,
        taxableAmount: subtotal,
        cgstAmount,
        sgstAmount,
        gstAmount,
        totalAmount,
        grandTotal: totalAmount,
        netAmount: totalAmount,
        payableAmount: totalAmount,
        paymentAmount: totalAmount,
        paidAmount: totalAmount,
        amount: totalAmount,
        revenue: totalAmount,
        patientName:
          invoiceData?.patientName ||
          getAppointmentPatientName(selectedAppointment),
        doctorName:
          invoiceData?.doctorName ||
          getAppointmentDoctorName(selectedAppointment),
        backendSynced: true,
      };
      const paymentUpdate = await updateBillingPayment(nextInvoice, {
        paymentMode: form.paymentMode,
        paidAmount: totalAmount,
      });
      if (paymentUpdate && typeof paymentUpdate === "object") {
        Object.assign(nextInvoice, Array.isArray(paymentUpdate) ? paymentUpdate[0] || {} : paymentUpdate);
      }
      setInvoice(nextInvoice);
      storeLatestInvoice(nextInvoice);
      setRecentServiceBills((prev) =>
        mergeRecentServiceBills([nextInvoice], storeRecentServiceBill(nextInvoice), prev)
      );
      setEditingBill(null);
      const text = invoiceData?.message || `Bill ${canUpdate ? "updated" : "generated"} successfully`;
      showMessage(text, "success", { autoHide: true });
      downloadInvoicePdf(nextInvoice, invoiceWindow);
    } catch (error) {
      if (invoiceWindow) invoiceWindow.close();
      showMessage(error.message, "error");
      toast.error(error.message || "Unable to generate invoice.");
      setInvoice(null);
    }
  };

  const addSelectedServiceItem = (value) => {
    const normalizedValue = String(value || "").trim().toLowerCase();
      const matched =
      activePriceList.find(
        (item) =>
          getPriceListItemName(item).toLowerCase() === normalizedValue ||
          String(item.diagnosis || "").trim().toLowerCase() === normalizedValue
      ) || null;

    if (!matched) return false;

    const setter = billingMode === "pharmacy" ? setPharmacyRows : setDiagnosticRows;
    setter((rows) => [...rows, createBillingRow([matched])]);
    setServiceSearch("");
    return true;
  };

  const updateServiceSearch = (value) => {
    setServiceSearch(value);
    addSelectedServiceItem(value);
  };

  const removeServiceRow = (rowId) => {
    const setter = billingMode === "pharmacy" ? setPharmacyRows : setDiagnosticRows;
    setter((rows) => rows.filter((row) => row.id !== rowId));
  };

  const updatePharmacyQuantity = (rowId, value) => {
    const quantity = Math.max(1, Number.parseInt(value, 10) || 1);
    setPharmacyRows((rows) =>
      rows.map((row) => (row.id === rowId ? { ...row, quantity } : row))
    );
  };

  const updateServiceUnitPrice = (rowId, value) => {
    const amount = Math.max(0, Number(value) || 0);
    const setter = billingMode === "pharmacy" ? setPharmacyRows : setDiagnosticRows;
    setter((rows) =>
      rows.map((row) => (row.id === rowId ? { ...row, unitPrice: amount, price: amount } : row))
    );
  };

  const viewRecentServiceBill = (bill) => {
    const billType = getServiceBillType(bill);
    if (billType === "consultation") {
      setInvoice(bill);
      downloadInvoicePdf(bill);
      return;
    }

    const rows = Array.isArray(bill.rows)
      ? bill.rows
      : Array.isArray(bill.serviceItems)
        ? bill.serviceItems
        : Array.isArray(bill.items)
          ? bill.items
          : [];
    const normalizedRows = rows.map((row) => ({
      id: row.id || Date.now() + Math.random(),
      diagnosis: row.diagnosis || row.Diagnosis || "",
      item: row.item || row.name || row.Name || row.medicine || row.test || "Item",
      unitPrice: Number(row.unitPrice ?? row.price ?? row.rate ?? row.amount) || 0,
      quantity: Number(row.quantity ?? row.qty) || 1,
    }));
    const totals =
      bill.totals ||
      getBillingTotals(
        normalizedRows.map((row) => ({
          ...row,
          quantity: billType === "pharmacy" ? row.quantity : 1,
        }))
      );

    printServiceInvoice({
      type: billType === "pharmacy" ? "pharmacy" : "diagnostic",
      invoiceNo: bill.invoiceNo || bill.invoiceNumber || bill.billNumber,
      rows: normalizedRows,
      totals,
      patientName: bill.patientName,
      patientId: bill.patientId,
      doctorName: bill.doctorName,
      paymentMode: bill.paymentMode,
      clinicName: bill.clinicName || clinicName,
      clinicPhone,
      clinicEmail,
      receptionistName: bill.receptionistName || receptionistProfile.name,
      autoPrint: false,
    });
  };

  const editRecentServiceBill = (bill) => {
    const nextMode = getServiceBillType(bill);
    setEditingBill(bill);
    if (nextMode === "consultation") {
      setBillingMode("consultation");
      setForm((prev) => ({
        ...prev,
        appointmentId: bill.appointmentId ? String(bill.appointmentId) : prev.appointmentId,
        paymentMode: bill.paymentMode || prev.paymentMode,
        medicineCharges: formatAmountInput(readAmount(bill, AMOUNT_KEYS.medicine, 0), { emptyValue: "" }),
        labCharges: formatAmountInput(readAmount(bill, AMOUNT_KEYS.lab, 0), { emptyValue: "" }),
      }));
      showMessage("OP bill loaded for editing. Submit again to generate the updated invoice.", "success", { autoHide: true });
      return;
    }

    const rows = Array.isArray(bill.rows) ? bill.rows : Array.isArray(bill.serviceItems) ? bill.serviceItems : [];
    const normalizedRows = rows.map((row) => ({
      id: Date.now() + Math.random(),
      diagnosis: row.diagnosis || row.Diagnosis || "",
      item: row.item || row.name || row.Name || "Item",
      unitPrice: Number(row.unitPrice ?? row.price ?? row.rate) || Number(row.amount) || 0,
      quantity: Number(row.quantity ?? row.qty) || 1,
    }));

    setBillingMode(nextMode === "pharmacy" ? "pharmacy" : "diagnostic");
    if (nextMode === "pharmacy") {
      setPharmacyRows(normalizedRows);
    } else {
      setDiagnosticRows(normalizedRows);
    }
    setForm((prev) => ({
      ...prev,
      appointmentId: bill.appointmentId ? String(bill.appointmentId) : prev.appointmentId,
      paymentMode: bill.paymentMode || prev.paymentMode,
    }));
    showMessage("Bill loaded for editing. Submit again to generate the updated invoice.", "success", { autoHide: true });
  };

  const deleteRecentServiceBill = async (bill) => {
    const billId = getInvoiceId(bill);
    if (!billId) {
      showMessage("Bill id is not available for delete.", "error");
      toast.error("Bill id is not available for delete.");
      return;
    }

    const confirmed = window.confirm("Delete this bill permanently?");
    if (!confirmed) return;

    try {
      await deleteBillingBill(bill);
      const nextStoredBills = removeRecentServiceBill(bill);
      setRecentServiceBills((prev) =>
        mergeRecentServiceBills(
          prev.filter((item) => String(getInvoiceId(item)) !== String(billId)),
          nextStoredBills
        )
      );
      if (String(getInvoiceId(invoice)) === String(billId)) {
        setInvoice(null);
      }
      if (String(getInvoiceId(editingBill)) === String(billId)) {
        setEditingBill(null);
      }
      showMessage("Bill deleted successfully.", "success", { autoHide: true });
      toast.success("Bill deleted successfully.");
    } catch (error) {
      showMessage(error.message || "Unable to delete bill.", "error");
      toast.error(error.message || "Unable to delete bill.");
    }
  };

  const setField = (name, value) => {
    const isAmountField = ["medicineCharges", "labCharges"].includes(name);
    const nextValue = ["medicineCharges", "labCharges"].includes(name)
      ? onlyNumberValue(value)
      : value;

    if (isAmountField && amountFormatTimers.current[name]) {
      window.clearTimeout(amountFormatTimers.current[name]);
    }

    setForm((prev) => ({ ...prev, [name]: nextValue }));
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    setMessage("");
    setMessageType("");
    clearMessageTimer();

    if (isAmountField && nextValue && !String(nextValue).endsWith(".")) {
      amountFormatTimers.current[name] = window.setTimeout(() => {
        formatAmountField(name);
      }, 500);
    }
  };

  const formatAmountField = (name) => {
    if (amountFormatTimers.current[name]) {
      window.clearTimeout(amountFormatTimers.current[name]);
    }

    setForm((prev) => ({
      ...prev,
      [name]: formatAmountInput(prev[name], { emptyValue: "" }),
    }));
  };

  const downloadInvoicePdf = (invoiceOverride = invoice, targetWindow = null) => {
    const activeInvoice = invoiceOverride || invoice;
    if (!activeInvoice) return;

    const invoiceNumber = getInvoiceNumber(activeInvoice);
    const patientName = activeInvoice.patientName || getAppointmentPatientName(selectedAppointment);
    const patientId =
      activeInvoice.patientId ||
      activeInvoice.PatientId ||
      getAppointmentPatientId(selectedAppointment);
    const doctorName = activeInvoice.doctorName || getAppointmentDoctorName(selectedAppointment);
    const status = getInvoiceStatus(activeInvoice);
    const paymentMode = activeInvoice.paymentMode || form.paymentMode || "-";
    const appointmentId = activeInvoice.appointmentId || form.appointmentId || "-";
    const invoiceDate = formatInvoiceDate(getInvoiceDate(activeInvoice));
    const branding = getClinicInvoiceBranding({ clinicId, clinicName });
    const logoUrl = branding.logoUrl;
    const headerTitle = branding.headerTitle || clinicName;
    const headerSubtitle = branding.headerSubtitle || "Clinic Management System";
    const footerNote = branding.footerNote;
    const accentColor = branding.accentColor || "#12a4a1";
    const invoiceAmounts = getInvoiceAmounts({
      invoice: activeInvoice,
      form,
      selectedAppointment,
      total,
    });

    const printWindow = targetWindow || window.open("", "_blank", "width=860,height=980");
    if (!printWindow) {
      const text = "Please allow popups to download the invoice PDF.";
      showMessage(text, "error");
      toast.error(text);
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Invoice ${escapeHtml(invoiceNumber)}</title>
          <style>
            @page {
              margin: 16mm;
              size: A4;
            }
            body {
              margin: 0;
              background: #edf5f7;
              color: #0f172a;
              font-family: Arial, Helvetica, sans-serif;
            }
            .invoice {
              max-width: 820px;
              margin: 0 auto;
              background: #ffffff;
              min-height: calc(100vh - 64px);
              padding: 34px;
              box-sizing: border-box;
              position: relative;
              overflow: hidden;
            }
            .invoice > *:not(.watermark) {
              position: relative;
              z-index: 1;
            }
            .watermark {
              position: absolute;
              inset: 0;
              display: grid;
              place-items: center;
              pointer-events: none;
              z-index: 0;
            }
            .watermark img {
              width: 390px;
              height: 390px;
              object-fit: contain;
              opacity: .18;
              filter: saturate(1.35) contrast(1.08);
            }
            .brand-row {
              display: flex;
              justify-content: space-between;
              gap: 22px;
              padding-bottom: 24px;
              border-bottom: 3px solid ${escapeHtml(accentColor)};
            }
            .brand {
              display: flex;
              gap: 14px;
              align-items: center;
            }
            .brand img {
              width: 54px;
              height: 54px;
              border-radius: 14px;
              object-fit: contain;
              background: #e9fbfb;
              padding: 8px;
            }
            .brand h1 {
              margin: 0;
              font-size: 25px;
              line-height: 1.15;
              color: #071120;
            }
            .brand p,
            .invoice-id p,
            .foot-note {
              margin: 5px 0 0;
              color: #536273;
              font-size: 12px;
              line-height: 1.5;
            }
            .invoice-id {
              text-align: right;
              min-width: 190px;
            }
            .invoice-id span {
              display: inline-block;
              padding: 6px 10px;
              border-radius: 999px;
              background: #ecfeff;
              color: #0f8f8d;
              font-size: 11px;
              font-weight: 800;
              letter-spacing: .5px;
              text-transform: uppercase;
            }
            .invoice-id strong {
              display: block;
              margin-top: 10px;
              font-size: 24px;
              color: #071120;
            }
            .details {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 14px;
              margin: 26px 0;
            }
            .panel {
              border: 1px solid #d9e5ea;
              border-radius: 12px;
              padding: 16px;
              background: #fbfdff;
            }
            .panel h2 {
              margin: 0 0 14px;
              font-size: 13px;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: .6px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 10px 14px;
            }
            .info span {
              display: block;
              color: #66778a;
              font-size: 11px;
              margin-bottom: 4px;
              text-transform: uppercase;
              letter-spacing: .35px;
            }
            .info strong {
              color: #111827;
              font-size: 14px;
              line-height: 1.35;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              overflow: hidden;
              border-radius: 12px;
              border: 1px solid #d9e5ea;
            }
            th,
            td {
              padding: 14px 16px;
              border-bottom: 1px solid #e4edf2;
              text-align: left;
              font-size: 14px;
            }
            th {
              background: #071120;
              color: #ffffff;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: .5px;
            }
            td:last-child,
            th:last-child {
              text-align: right;
            }
            tbody tr:last-child td {
              border-bottom: 0;
            }
            .total {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: 20px;
              padding: 18px 20px;
              border-radius: 14px;
              background: #071120;
              color: #ffffff;
              font-size: 22px;
              font-weight: 800;
            }
            .payment {
              display: flex;
              justify-content: space-between;
              gap: 14px;
              margin-top: 18px;
              padding: 14px 16px;
              border: 1px dashed #9ec8ce;
              border-radius: 12px;
              color: #334155;
              font-size: 13px;
            }
            .footer {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              gap: 24px;
              margin-top: 34px;
              padding-top: 18px;
              border-top: 1px solid #d9e5ea;
            }
            .signature {
              min-width: 170px;
              text-align: center;
              color: #0f172a;
              font-weight: 800;
              font-size: 13px;
            }
            .signature::before {
              content: "";
              display: block;
              border-top: 1px solid #8ba0b4;
              margin-bottom: 8px;
            }
            @media print {
              body {
                background: #ffffff;
              }
              .invoice {
                min-height: auto;
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <main class="invoice">
            <div class="watermark"><img src="${escapeHtml(logoUrl)}" alt="" /></div>
            <section class="brand-row">
              <div class="brand">
                <img src="${escapeHtml(logoUrl)}" alt="Clinic logo" />
                <div>
                  <h1>${escapeHtml(headerTitle)}</h1>
                  <p>${escapeHtml([headerSubtitle, clinicId ? `Clinic ID: ${clinicId}` : "", clinicPhone, clinicEmail].filter(Boolean).join(" | "))}</p>
                </div>
              </div>
              <div class="invoice-id">
                <span>Billing Invoice</span>
                <strong>${escapeHtml(invoiceNumber)}</strong>
                <p>${escapeHtml(invoiceDate)}</p>
              </div>
            </section>

            <section class="details">
              <div class="panel">
                <h2>Patient Details</h2>
                <div class="info-grid">
                  <div class="info"><span>Patient</span><strong>${escapeHtml(patientName)}</strong></div>
                  <div class="info"><span>Patient ID</span><strong>${escapeHtml(patientId)}</strong></div>
                  <div class="info"><span>Doctor</span><strong>${escapeHtml(doctorName)}</strong></div>
                  <div class="info"><span>Appointment ID</span><strong>${escapeHtml(appointmentId)}</strong></div>
                </div>
              </div>
              <div class="panel">
                <h2>Billing Details</h2>
                <div class="info-grid">
                  <div class="info"><span>Status</span><strong>${escapeHtml(status)}</strong></div>
                  <div class="info"><span>Payment Mode</span><strong>${escapeHtml(paymentMode)}</strong></div>
                  <div class="info"><span>Generated By</span><strong>${escapeHtml(receptionistProfile.name || "Reception")}</strong></div>
                  <div class="info"><span>Generated On</span><strong>${escapeHtml(invoiceDate)}</strong></div>
                </div>
              </div>
            </section>

            <table>
              <thead>
                <tr><th>Description</th><th>Amount</th></tr>
              </thead>
              <tbody>
                <tr><td>Medicine Charges</td><td>${escapeHtml(formatCurrency(invoiceAmounts.medicine))}</td></tr>
                <tr><td>Lab Charges</td><td>${escapeHtml(formatCurrency(invoiceAmounts.lab))}</td></tr>
              </tbody>
            </table>

            <div class="total"><span>Total</span><span>${escapeHtml(formatCurrency(invoiceAmounts.total))}</span></div>

            <div class="payment">
              <span>Payment received via <strong>${escapeHtml(paymentMode)}</strong></span>
              <span>Status: <strong>${escapeHtml(status)}</strong></span>
            </div>

            <section class="footer">
              <p class="foot-note">${escapeHtml(footerNote)}</p>
              <div class="signature">Authorized Signature</div>
            </section>
          </main>
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <section className="rc-page">
      <div className="rc-page-head">
        <div>
          <h2>Billing</h2>
          <p>Create diagnostic and pharmacy invoices for direct counter billing.</p>
        </div>
        <button className="rc-btn" onClick={() => navigate("/reception/dashboard")}>
          <ArrowLeft size={16} /> Dashboard
        </button>
      </div>

      {message ? <div className={`rc-alert ${messageType}`}>{message}</div> : null}

      <div className="rc-billing-tabs" role="tablist" aria-label="Billing module">
        {[
          ["consultation", "OP Billing"],
          ["diagnostic", "Diagnosis Test Billing"],
          ["pharmacy", "Pharmacy Billing"],
        ].map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            className={billingMode === mode ? "active" : ""}
            onClick={() => {
              setBillingMode(mode);
              setMessage("");
              setMessageType("");
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rc-billing-layout">
        {billingMode !== "consultation" ? (
        <form className="rc-card rc-billing-form" onSubmit={generate} noValidate>
          <div className="rc-billing-card-head">
            <div>
              <h3>
                {billingMode === "pharmacy"
                  ? "Generate Pharmacy Bill"
                  : "Generate Diagnosis Test Bill"}
              </h3>
              <p>
                Select items and collect payment without appointment access.
              </p>
            </div>
          </div>
        {selectedAppointment ? (
          <div className="rc-patient-summary">
            <strong>
              {getAppointmentPatientName(selectedAppointment)}
            </strong>
            <span>
              {getAppointmentPatientId(selectedAppointment)} |{" "}
              {getAppointmentDoctorName(selectedAppointment)}
            </span>
          </div>
        ) : null}
        <div className="rc-billing-fields">
          <label className="rc-field-wide">
            <span>{billingMode === "consultation" ? "Appointment" : "Booked Appointment"}</span>
            <select
              value={form.appointmentId}
              onChange={(e) => setField("appointmentId", e.target.value)}
              className={billingMode === "consultation" && fieldErrors.appointmentId ? "is-invalid" : ""}
            >
              {billingMode !== "consultation" ? (
                <option value="">Walk-in / No appointment</option>
              ) : null}
              {appointments.length === 0 ? (
                <option value="">
                  {billingMode === "consultation" ? "No billable appointments found" : "No booked appointments found"}
                </option>
              ) : null}
              {appointments.map((a) => (
                <option value={getAppointmentId(a)} key={getAppointmentId(a)}>
                  {getAppointmentPatientName(a)} - {getAppointmentTime(a)} -{" "}
                  {getAppointmentStatus(a) || "-"}
                </option>
              ))}
            </select>
            {billingMode === "consultation" && fieldErrors.appointmentId ? <small className="rc-field-error">{fieldErrors.appointmentId}</small> : null}
          </label>
        <label>
          <span>Payment Mode</span>
          <select
            value={form.paymentMode}
            onChange={(e) => setField("paymentMode", e.target.value)}
            className={fieldErrors.paymentMode ? "is-invalid" : ""}
          >
            <option value="UPI">UPI</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
          </select>
          {fieldErrors.paymentMode ? <small className="rc-field-error">{fieldErrors.paymentMode}</small> : null}
        </label>
        {billingMode === "consultation" ? (
          <>
            <label>
              <span>Medicine Charges</span>
              <input
                type="text"
                inputMode="decimal"
                value={form.medicineCharges}
                placeholder="0.00"
                onChange={(e) => setField("medicineCharges", e.target.value)}
                onBlur={() => formatAmountField("medicineCharges")}
                className={`rc-amount-input ${fieldErrors.medicineCharges ? "is-invalid" : ""}`}
              />
              {fieldErrors.medicineCharges ? <small className="rc-field-error">{fieldErrors.medicineCharges}</small> : null}
            </label>
            <label>
              <span>Lab Charges</span>
              <input
                type="text"
                inputMode="decimal"
                value={form.labCharges}
                placeholder="0.00"
                onChange={(e) => setField("labCharges", e.target.value)}
                onBlur={() => formatAmountField("labCharges")}
                className={`rc-amount-input ${fieldErrors.labCharges ? "is-invalid" : ""}`}
              />
              {fieldErrors.labCharges ? <small className="rc-field-error">{fieldErrors.labCharges}</small> : null}
            </label>
          </>
        ) : null}
        </div>
        {billingMode !== "consultation" ? (
          <div className="rc-service-billing">
            <div className="rc-service-head">
              <strong>{billingMode === "pharmacy" ? "Medicine Items" : "Diagnostic Test Items"}</strong>
            </div>
            <label className="rc-service-picker">
              <span>{billingMode === "pharmacy" ? "Medicine" : "Test Name"}</span>
              <input
                value={serviceSearch}
                list={`${billingMode}-billing-items`}
                placeholder={
                  billingMode === "diagnostic"
                    ? activePriceList.length
                      ? "Search or select lab test"
                      : labMasterLoading
                        ? "Loading lab tests..."
                        : "No lab file tests available"
                    : "Search or select medicine"
                }
                onChange={(event) => updateServiceSearch(event.target.value)}
                disabled={billingMode === "diagnostic" && labMasterLoading && !activePriceList.length}
              />
            </label>
            <div className="rc-service-table">
              <datalist id={`${billingMode}-billing-items`}>
                {activePriceList.map((item, index) => (
                  <option key={`${item.diagnosis}-${getPriceListItemKey(item, index)}`} value={getPriceListItemName(item)} />
                ))}
              </datalist>
              <div className={`rc-service-grid rc-service-grid-head ${billingMode === "diagnostic" ? "is-diagnostic" : ""}`}>
                <span>{billingMode === "pharmacy" ? "Selected Medicine" : "Selected Test"}</span>
                {billingMode === "pharmacy" ? <span>Qty</span> : null}
                <span>Amount</span>
                <span>CGST</span>
                <span>SGST</span>
                <span>Net Amount</span>
                <span />
              </div>
              {activeServiceRows.map((row) => {
                const rowQuantity = billingMode === "pharmacy" ? Number(row.quantity) || 1 : 1;
                const lineAmount = (Number(row.unitPrice) || 0) * rowQuantity;
                const lineCgst = lineAmount * HALF_GST_RATE;
                const lineSgst = lineAmount * HALF_GST_RATE;
                const lineTotal = lineAmount + lineCgst + lineSgst;
                return (
                  <div className={`rc-service-grid ${billingMode === "diagnostic" ? "is-diagnostic" : ""}`} key={row.id}>
                    <strong className="rc-service-item-name">{row.item}</strong>
                    {billingMode === "pharmacy" ? (
                      <input
                        className="rc-service-qty"
                        type="number"
                        min="1"
                        value={rowQuantity}
                        onChange={(event) => updatePharmacyQuantity(row.id, event.target.value)}
                        aria-label={`Quantity for ${row.item}`}
                      />
                    ) : null}
                    <input
                      className="rc-service-amount-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={Number(row.unitPrice) || 0}
                      onChange={(event) => updateServiceUnitPrice(row.id, event.target.value)}
                      aria-label={`Amount for ${row.item}`}
                    />
                    <strong>{formatCurrency(lineCgst)}</strong>
                    <strong>{formatCurrency(lineSgst)}</strong>
                    <strong>{formatCurrency(lineTotal)}</strong>
                    <button
                      type="button"
                      className="rc-service-remove-btn"
                      onClick={() => removeServiceRow(row.id)}
                      aria-label="Remove item"
                    >
                      <Minus size={16} />
                    </button>
                  </div>
                );
              })}
              <div className={`rc-service-grid rc-service-total-row ${billingMode === "diagnostic" ? "is-diagnostic" : ""}`}>
                <strong className="rc-service-total-label">Total</strong>
                {billingMode === "pharmacy" ? <span /> : null}
                <strong>{formatCurrency(serviceDisplayTotals.subtotal)}</strong>
                <strong>{formatCurrency(serviceDisplayTotals.cgst)}</strong>
                <strong>{formatCurrency(serviceDisplayTotals.sgst)}</strong>
                <strong>{formatCurrency(serviceDisplayTotals.total)}</strong>
                <span />
              </div>
            </div>
          </div>
        ) : (
          <div className="rc-total">
            <span>Total</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
        )}
        {billingMode !== "consultation" ? (
          <div className="rc-service-actions">
            <button type="button" className="rc-service-preview" onClick={() => openServiceInvoice({ autoPrint: false })}>
              <Eye size={15} /> Preview
            </button>
            <button type="button" className="rc-service-print" onClick={() => openServiceInvoice({ autoPrint: true })}>
              <Printer size={15} /> Print
            </button>
            <button className="rc-confirm" type="submit">
              <CheckCircle size={15} /> Submit
            </button>
          </div>
        ) : (
          <button className="rc-confirm" type="submit">
            <FileText size={15} /> Generate Invoice
          </button>
        )}
      </form>
        ) : null}

        <section className="rc-card rc-latest-bills">
          <div className="rc-latest-bills-head">
            <div>
              <h3>Latest Bills</h3>
              <p>
                Submitted{" "}
                {billingMode === "pharmacy"
                  ? "pharmacy"
                  : billingMode === "diagnostic"
                    ? "diagnostic"
                    : "OP"}{" "}
                invoices.
              </p>
            </div>
          </div>
          {visibleRecentServiceBills.length ? (
            <div className="rc-latest-bills-list">
              {visibleRecentServiceBills.map((bill, index) => {
                const billType = getServiceBillType(bill);
                const invoiceNo = bill.invoiceNo || bill.invoiceNumber || bill.billNumber || `BILL-${index + 1}`;
                const amount = Number(bill.totalAmount ?? bill.netAmount ?? bill.grandTotal ?? bill.paidAmount) || 0;
                const createdAt = bill.createdAt || bill.invoiceDate || bill.billDate;
                const canManageBill = hasBackendBillingId(bill);
                return (
                  <article className="rc-latest-bill-row" key={`${invoiceNo}-${index}`}>
                    <div className="rc-latest-bill-pdf">
                      <FileText size={20} />
                    </div>
                    <div className="rc-latest-bill-main">
                      <strong>{bill.patientName || "Walk-in Patient"}</strong>
                      <span>
                        {invoiceNo} | {billType === "pharmacy" ? "Pharmacy" : billType === "diagnostic" ? "Diagnostic" : "OP"} |{" "}
                        {createdAt ? formatInvoiceDate(createdAt) : "Just now"}
                      </span>
                    </div>
                    <b>{formatCurrency(amount)}</b>
                    <div className="rc-latest-bill-actions">
                      <button type="button" onClick={() => viewRecentServiceBill(bill)} aria-label="View bill PDF">
                        <FileText size={16} />
                      </button>
                      {canManageBill ? (
                        <>
                          <button type="button" onClick={() => editRecentServiceBill(bill)} aria-label="Edit bill">
                            <Edit3 size={16} />
                          </button>
                          <button type="button" onClick={() => deleteRecentServiceBill(bill)} aria-label="Delete bill">
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rc-latest-bills-empty">
              No submitted {billingMode === "pharmacy" ? "pharmacy" : billingMode === "diagnostic" ? "diagnostic" : "OP"} bills yet.
            </div>
          )}
        </section>

      </div>
    </section>
  );
}

export default ReceptionBilling;
