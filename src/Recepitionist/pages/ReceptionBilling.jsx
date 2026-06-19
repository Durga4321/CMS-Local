import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Banknote, CreditCard, Download, FileText, ReceiptText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { parseList, requestJson } from "../receptionApi";
import { useToast } from "../../components/ToastProvider";
import {
  onlyNumberValue,
  validateNumeric,
  validateSelected,
} from "../../utils/validation";
import { formatIndianCurrency } from "../../utils/format";

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

const getInvoiceStatus = (invoice) =>
  firstValue(invoice?.paymentStatus, invoice?.invoiceStatus, invoice?.billingStatus, invoice?.status) ||
  "Paid";

const getAppointmentId = (appointment) =>
  appointment?.appointmentId ?? appointment?.id ?? "";

const getAppointmentStatus = (appointment = {}) =>
  String(
    appointment.status ??
    appointment.appointmentStatus ??
    appointment.billingStatus ??
    appointment.paymentStatus ??
    ""
  )
    .trim()
    .toLowerCase();

const isBillableAppointment = (appointment = {}) => {
  const status = getAppointmentStatus(appointment);
  return !["completed", "complete", "cancelled", "canceled", "billed", "paid"].includes(status);
};

const getInvoiceAmounts = ({ invoice, form, selectedAppointment, total }) => ({
  consultation:
    invoice?.consultationCharge ??
    invoice?.consultationCharges ??
    selectedAppointment?.consultationCharge ??
    0,
  medicine: invoice?.medicineCharge ?? invoice?.medicineCharges ?? form.medicineCharges ?? 0,
  lab: invoice?.labCharge ?? invoice?.labCharges ?? form.labCharges ?? 0,
  total: invoice?.totalAmount ?? invoice?.total ?? total,
});

const getLatestInvoice = (data) => {
  const invoices = parseList(data);
  return invoices.sort((a, b) => {
    const bDate = new Date(b?.createdAt || 0).getTime();
    const aDate = new Date(a?.createdAt || 0).getTime();
    if (bDate !== aDate) return bDate - aDate;
    return Number(b?.id || 0) - Number(a?.id || 0);
  })[0] || null;
};

function ReceptionBilling() {
  const navigate = useNavigate();
  const toast = useToast();
  const amountFormatTimers = useRef({});
  const messageTimer = useRef(null);
  const [appointments, setAppointments] = useState([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [invoice, setInvoice] = useState(null);
  const [showInvoiceActions, setShowInvoiceActions] = useState(false);
  const [form, setForm] = useState({
    appointmentId: "",
    paymentMode: "UPI",
    medicineCharges: "",
    labCharges: "",
  });

  useEffect(() => {
    Promise.all([requestJson("Billing/appointments"), requestJson("Billing")])
      .then((data) => {
        const [appointmentsData, invoicesData] = data;
        const list = parseList(appointmentsData).filter(isBillableAppointment);
        setAppointments(list);
        setForm((prev) => ({
          ...prev,
          appointmentId: String(getAppointmentId(list[0]) || ""),
        }));
        setInvoice(getLatestInvoice(invoicesData));
      })
      .catch((error) => {
        setMessage(error.message);
        setMessageType("error");
        toast.error(error.message || "Unable to load billing details.");
      });
  }, []);

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

  const consultationCharge = Number(selectedAppointment?.consultationCharge || 0);
  const medicineCharges = Number(form.medicineCharges || 0);
  const labCharges = Number(form.labCharges || 0);
  const total =
    consultationCharge +
    medicineCharges +
    labCharges;

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
    if (!validateForm()) {
      const text = "Please fix the highlighted fields.";
      showMessage(text, "error");
      toast.error(text);
      return;
    }

    const body = {
      appointmentId: Number(form.appointmentId),
      medicineCharge: Number(form.medicineCharges || 0),
      labCharge: Number(form.labCharges || 0),
      paymentMode: String(form.paymentMode || ""),
      PaymentMode: String(form.paymentMode || ""),
    };

    try {
      const data = await requestJson("Billing", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const invoiceData = Array.isArray(data) ? data[0] : data;
      setInvoice({
        ...body,
        ...(invoiceData || {}),
        consultationCharge,
        patientName:
          invoiceData?.patientName ||
          selectedAppointment?.patientName ||
          selectedAppointment?.patient?.name ||
          "-",
        doctorName:
          invoiceData?.doctorName ||
          selectedAppointment?.doctorName ||
          selectedAppointment?.doctor?.name ||
          "-",
      });
      setShowInvoiceActions(false);
      const text = invoiceData?.message || "Bill generated successfully";
      showMessage(text, "success", { autoHide: true });
    } catch (error) {
      showMessage(error.message, "error");
      toast.error(error.message || "Unable to generate invoice.");
      setInvoice(null);
      setShowInvoiceActions(false);
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

  const downloadInvoicePdf = () => {
    if (!invoice) return;

    const invoiceNumber = getInvoiceNumber(invoice);
    const patientName = invoice.patientName || "-";
    const doctorName = invoice.doctorName || "-";
    const status = getInvoiceStatus(invoice);
    const paymentMode = invoice.paymentMode || form.paymentMode || "-";
    const invoiceAmounts = getInvoiceAmounts({
      invoice,
      form,
      selectedAppointment,
      total,
    });

    const printWindow = window.open("", "_blank", "width=760,height=920");
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
            body {
              margin: 0;
              padding: 32px;
              color: #071120;
              font-family: Arial, sans-serif;
            }
            .invoice {
              max-width: 720px;
              margin: 0 auto;
              border: 1px solid #d9e1ec;
              border-radius: 10px;
              padding: 28px;
            }
            h1 {
              margin: 0 0 8px;
              font-size: 24px;
            }
            .muted {
              color: #40516a;
              font-size: 13px;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 12px;
              margin: 24px 0;
            }
            .field {
              border: 1px solid #e3e9f1;
              border-radius: 8px;
              padding: 12px;
            }
            .field span {
              display: block;
              color: #40516a;
              font-size: 12px;
              margin-bottom: 6px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 12px;
            }
            th,
            td {
              padding: 12px;
              border-bottom: 1px solid #e3e9f1;
              text-align: left;
            }
            td:last-child,
            th:last-child {
              text-align: right;
            }
            .total {
              display: flex;
              justify-content: space-between;
              margin-top: 22px;
              padding-top: 18px;
              border-top: 2px solid #071120;
              font-size: 20px;
              font-weight: 800;
            }
          </style>
        </head>
        <body>
          <main class="invoice">
            <h1>Invoice</h1>
            <div class="muted">Generated from billing</div>
            <section class="grid">
              <div class="field"><span>Invoice No</span><strong>${escapeHtml(invoiceNumber)}</strong></div>
              <div class="field"><span>Status</span><strong>${escapeHtml(status)}</strong></div>
              <div class="field"><span>Patient</span><strong>${escapeHtml(patientName)}</strong></div>
              <div class="field"><span>Doctor</span><strong>${escapeHtml(doctorName)}</strong></div>
              <div class="field"><span>Payment Mode</span><strong>${escapeHtml(paymentMode)}</strong></div>
              <div class="field"><span>Appointment ID</span><strong>${escapeHtml(invoice.appointmentId || form.appointmentId || "-")}</strong></div>
            </section>
            <table>
              <thead>
                <tr><th>Charge</th><th>Amount</th></tr>
              </thead>
              <tbody>
                <tr><td>Consultation</td><td>${escapeHtml(formatCurrency(invoiceAmounts.consultation))}</td></tr>
                <tr><td>Medicine</td><td>${escapeHtml(formatCurrency(invoiceAmounts.medicine))}</td></tr>
                <tr><td>Lab</td><td>${escapeHtml(formatCurrency(invoiceAmounts.lab))}</td></tr>
              </tbody>
            </table>
            <div class="total"><span>Total</span><span>${escapeHtml(formatCurrency(invoiceAmounts.total))}</span></div>
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
    setShowInvoiceActions(false);
  };

  const invoiceAmounts = getInvoiceAmounts({
    invoice,
    form,
    selectedAppointment,
    total,
  });

  return (
    <section className="rc-page">
      <div className="rc-page-head">
        <div>
          <h2>Billing</h2>
          <p>Create invoices from appointments and collect payments.</p>
        </div>
        <button className="rc-btn" onClick={() => navigate("/reception/dashboard")}>
          <ArrowLeft size={16} /> Dashboard
        </button>
      </div>

      {message ? <div className={`rc-alert ${messageType}`}>{message}</div> : null}

      <div className="rc-billing-stats">
        <div className="rc-billing-stat">
          <ReceiptText size={18} />
          <span>Appointments</span>
          <strong>{appointments.length}</strong>
        </div>
        <div className="rc-billing-stat">
          <Banknote size={18} />
          <span>Current Total</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
        <div className="rc-billing-stat">
          <CreditCard size={18} />
          <span>Payment Mode</span>
          <strong>{form.paymentMode}</strong>
        </div>
      </div>

      <div className="rc-billing-layout">
      <form className="rc-card rc-billing-form" onSubmit={generate} noValidate>
        <div className="rc-billing-card-head">
          <div>
            <h3>Generate Bill</h3>
            <p>Review patient and charge details before creating the invoice.</p>
          </div>
          <FileText size={20} />
        </div>
        <div className="rc-patient-summary">
          <strong>
            {selectedAppointment?.patientName || selectedAppointment?.patient?.name || "-"}
          </strong>
          <span>
            {selectedAppointment?.patientId || selectedAppointment?.patient?.id || "-"} |{" "}
            {selectedAppointment?.doctorName || selectedAppointment?.doctor?.name || "-"}
          </span>
        </div>
        <div className="rc-billing-fields">
        <label className="rc-field-wide">
          <span>Appointment</span>
          <select
            value={form.appointmentId}
            onChange={(e) => setField("appointmentId", e.target.value)}
            className={fieldErrors.appointmentId ? "is-invalid" : ""}
          >
            {appointments.map((a) => (
              <option value={getAppointmentId(a)} key={getAppointmentId(a)}>
                {a.patientName || a.patient?.name || "-"} - {a.time || "-"} -{" "}
                {a.status || "-"}
              </option>
            ))}
          </select>
          {fieldErrors.appointmentId ? <small className="rc-field-error">{fieldErrors.appointmentId}</small> : null}
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
            <option value="Insurance">Insurance</option>
          </select>
          {fieldErrors.paymentMode ? <small className="rc-field-error">{fieldErrors.paymentMode}</small> : null}
        </label>
        <label>
          <span>Consultation Charge</span>
          <input
            type="text"
            inputMode="decimal"
            value={formatAmountInput(consultationCharge)}
            readOnly
            className="rc-amount-input"
          />
        </label>
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
        </div>
        <div className="rc-total">
          <span>Total</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
        <button className="rc-confirm" type="submit">
          <FileText size={15} /> Generate Invoice
        </button>
      </form>

      <div className="rc-card rc-invoice">
        <h3>Latest Invoice</h3>
        <div className="rc-invoice-box">
          <div>
            <strong>
              {invoice?.patientName || selectedAppointment?.patientName || selectedAppointment?.patient?.name || "-"}
            </strong>
            <span>{invoice ? "Invoice generated" : "No invoice generated yet"}</span>
            {invoice ? (
              <span>Status: {getInvoiceStatus(invoice)}</span>
            ) : null}
          </div>
          <div className="rc-invoice-meta">
            <div className="rc-invoice-file">
              <button
                type="button"
                className="rc-icon-btn"
                aria-label="Invoice file options"
                aria-expanded={showInvoiceActions}
                disabled={!invoice}
                onClick={() => setShowInvoiceActions((prev) => !prev)}
              >
                <FileText size={18} />
              </button>
              {invoice && showInvoiceActions ? (
                <div className="rc-invoice-menu">
                  <button type="button" onClick={downloadInvoicePdf}>
                    <Download size={15} /> Download PDF
                  </button>
                </div>
              ) : null}
            </div>
            <div className="rc-invoice-lines">
              <p>
                <span>Consultation</span>
                <b>{formatCurrency(invoiceAmounts.consultation)}</b>
              </p>
              <p>
                <span>Medicine</span>
                <b>{formatCurrency(invoiceAmounts.medicine)}</b>
              </p>
              <p>
                <span>Lab</span>
                <b>{formatCurrency(invoiceAmounts.lab)}</b>
              </p>
              <p className="rc-invoice-total-row">
                <span>Total</span>
                <b>{formatCurrency(invoiceAmounts.total)}</b>
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}

export default ReceptionBilling;

