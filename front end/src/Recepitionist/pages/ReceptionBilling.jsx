import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Banknote, CreditCard, Download, FileText, ReceiptText } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
const LAST_INVOICE_STORAGE_KEY = "receptionLatestInvoice";

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

const getAppointmentStatus = (appointment = {}) =>
  String(
    appointment.status ??
    appointment.Status ??
    appointment.appointmentStatus ??
    appointment.AppointmentStatus ??
    appointment.billingStatus ??
    appointment.BillingStatus ??
    appointment.paymentStatus ??
    appointment.PaymentStatus ??
    appointment.appointment?.status ??
    appointment.appointment?.Status ??
    appointment.appointment?.appointmentStatus ??
    appointment.Appointment?.Status ??
    appointment.Appointment?.AppointmentStatus ??
    appointment.state ??
    appointment.State ??
    ""
  )
    .trim()
    .toLowerCase();

const isBillableAppointment = (appointment = {}) => {
  const status = getAppointmentStatus(appointment);
  return (
    ["completed", "consulted", "complete"].includes(status) ||
    status.includes("completed") ||
    status.includes("consulted")
  );
};

const getAppointmentPatientName = (appointment = {}) =>
  firstValue(
    appointment.patientName,
    appointment.PatientName,
    appointment.patient?.name,
    appointment.Patient?.Name,
    appointment.patient?.fullName,
    appointment.Patient?.FullName
  ) || "-";

const getAppointmentPatientId = (appointment = {}) =>
  firstValue(
    appointment.patientId,
    appointment.PatientId,
    appointment.pid,
    appointment.PID,
    appointment.patientCode,
    appointment.PatientCode,
    appointment.patient?.id,
    appointment.Patient?.Id,
    appointment.patient?.patientId,
    appointment.Patient?.PatientId,
    appointment.patient?.pid,
    appointment.Patient?.PID,
    appointment.patient?.patientCode,
    appointment.Patient?.PatientCode
  ) || "-";

const getAppointmentDoctorName = (appointment = {}) =>
  firstValue(
    appointment.doctorName,
    appointment.DoctorName,
    appointment.doctor?.name,
    appointment.Doctor?.Name,
    appointment.doctor?.fullName,
    appointment.Doctor?.FullName
  ) || "-";

const getAppointmentTime = (appointment = {}) =>
  firstValue(
    appointment.time,
    appointment.Time,
    appointment.slot,
    appointment.Slot,
    appointment.startTime,
    appointment.StartTime
  ) || "-";

const getAppointmentConsultationCharge = (appointment = {}) =>
  firstValue(
    appointment.consultationCharge,
    appointment.ConsultationCharge,
    appointment.consultationCharges,
    appointment.ConsultationCharges,
    appointment.doctor?.consultationCharge,
    appointment.Doctor?.ConsultationCharge,
    appointment.doctor?.fee,
    appointment.Doctor?.Fee
  ) || 0;

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

const getPatientId = (patient = {}) =>
  firstValue(
    patient.id,
    patient.Id,
    patient.patientId,
    patient.PatientId,
    patient.pid,
    patient.PID,
    patient.patientCode,
    patient.PatientCode
  ) || "";

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
  const consultation = readAmount(
    invoice,
    AMOUNT_KEYS.consultation,
    readAmount(selectedAppointment, AMOUNT_KEYS.consultation, 0)
  );
  let medicine =
    readAmount(invoice, AMOUNT_KEYS.medicine, 0) ||
    readItemizedAmount(invoice, ["medicine", "medication", "pharmacy", "drug"]) ||
    Number(form.medicineCharges || 0);
  const lab =
    readAmount(invoice, AMOUNT_KEYS.lab, 0) ||
    readItemizedAmount(invoice, ["lab", "laboratory", "test", "diagnostic"]) ||
    Number(form.labCharges || 0);
  const lineTotal = consultation + medicine + lab;
  const invoiceTotal = readAmount(invoice, AMOUNT_KEYS.total, total);
  const unitemizedBalance = invoiceTotal - lineTotal;

  if (invoice && invoiceTotal > 0 && unitemizedBalance > 0 && medicine === 0 && lab === 0) {
    medicine = unitemizedBalance;
  }

  return {
    consultation,
    medicine,
    lab,
    total: consultation + medicine + lab,
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

const fetchInvoiceDetails = async (invoice) => {
  const invoiceId = getInvoiceId(invoice);
  if (!invoiceId) return invoice;

  const detailPaths = [
    `Billing/${invoiceId}`,
    `Billing/details/${invoiceId}`,
    `Billing/invoice/${invoiceId}`,
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
  const [appointmentDetails, setAppointmentDetails] = useState(null);
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

        const completedAppointments = parseList(appointmentsResultData)
          .map((appointment) => attachPatientToAppointment(appointment, patientsById))
          .filter(isBillableAppointment);
        const strictList = completedAppointments.filter((appointment) =>
          appointmentBelongsToBillingScope(appointment, receptionistScope)
        );
        const list = strictList.length
          ? strictList
          : scopeReceptionistRecords(completedAppointments, receptionistScope, {
              allowMissingBranch: true,
            });
        const invoiceList = parseList(invoicesData);
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
          readStoredLatestInvoice();
        const latestInvoiceDetails = latestInvoice
          ? await fetchInvoiceDetails(latestInvoice)
          : null;

        setAppointments(list);
        setForm((prev) => ({
          ...prev,
          appointmentId: String(getAppointmentId(list[0]) || ""),
        }));
        setInvoice(latestInvoiceDetails);
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

  const fetchAppointmentDetails = useCallback(
    async (appointmentId) => {
      if (!appointmentId) {
        setAppointmentDetails(null);
        return;
      }

      try {
        const details = await requestJson(`Billing/appointment/${appointmentId}`);
        setAppointmentDetails(details);
      } catch {
        setAppointmentDetails(null);
      }
    },
    []
  );

  useEffect(() => {
    fetchAppointmentDetails(form.appointmentId);
  }, [form.appointmentId, fetchAppointmentDetails]);

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

  const activeAppointment = appointmentDetails || selectedAppointment;
  const consultationCharge = Number(getAppointmentConsultationCharge(activeAppointment));
  const medicineCharges = Number(form.medicineCharges || 0);
  const labCharges = Number(form.labCharges || 0);
  const payableTotal = medicineCharges + labCharges;
  const total = consultationCharge + payableTotal;

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

    const body = {
      appointmentId: Number(form.appointmentId),
      consultationCharge,
      medicineCharge: Number(form.medicineCharges || 0),
      labCharge: Number(form.labCharges || 0),
      totalAmount: total,
      grandTotal: total,
      payableAmount: payableTotal,
      paymentAmount: payableTotal,
      paidAmount: payableTotal,
      paymentMode: String(form.paymentMode || ""),
      PaymentMode: String(form.paymentMode || ""),
    };

    try {
      const data = await requestJson("Billing", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const invoiceData = Array.isArray(data) ? data[0] : data;
      const nextInvoice = {
        ...(invoiceData || {}),
        ...body,
        consultationCharge,
        medicineCharge: Number(form.medicineCharges || 0),
        labCharge: Number(form.labCharges || 0),
        totalAmount: total,
        grandTotal: total,
        payableAmount: payableTotal,
        paymentAmount: payableTotal,
        paidAmount: payableTotal,
        patientName:
          invoiceData?.patientName ||
          getAppointmentPatientName(selectedAppointment),
        doctorName:
          invoiceData?.doctorName ||
          getAppointmentDoctorName(selectedAppointment),
      };
      setInvoice(nextInvoice);
      storeLatestInvoice(nextInvoice);
      setShowInvoiceActions(false);
      const text = invoiceData?.message || "Bill generated successfully";
      showMessage(text, "success", { autoHide: true });
      downloadInvoicePdf(nextInvoice, invoiceWindow);
    } catch (error) {
      if (invoiceWindow) invoiceWindow.close();
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
    const logoUrl = `${window.location.origin}/logo192.png`;
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
            }
            .brand-row {
              display: flex;
              justify-content: space-between;
              gap: 22px;
              padding-bottom: 24px;
              border-bottom: 3px solid #12a4a1;
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
            <section class="brand-row">
              <div class="brand">
                <img src="${escapeHtml(logoUrl)}" alt="Clinic logo" />
                <div>
                  <h1>${escapeHtml(clinicName)}</h1>
                  <p>${escapeHtml([clinicId ? `Clinic ID: ${clinicId}` : "", clinicPhone, clinicEmail].filter(Boolean).join(" | ") || "Clinic Management System")}</p>
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
                <tr><td>Consultation Charge</td><td>${escapeHtml(formatCurrency(invoiceAmounts.consultation))}</td></tr>
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
              <p class="foot-note">Thank you for choosing ${escapeHtml(clinicName)}. This is a computer-generated invoice.</p>
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
    setShowInvoiceActions(false);
  };

  const invoiceAppointment = useMemo(() => {
    if (!invoice) return null;

    return appointments.find(
      (item) => String(getAppointmentId(item)) === String(invoice.appointmentId || invoice.AppointmentId)
    );
  }, [appointments, invoice]);
  const invoiceAmounts = getInvoiceAmounts({
    invoice,
    form: {},
    selectedAppointment: invoice ? invoiceAppointment : null,
    total: 0,
  });
  const latestInvoicePatientName =
    invoice?.patientName ||
    invoice?.PatientName ||
    getAppointmentPatientName(invoiceAppointment);

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
            {getAppointmentPatientName(selectedAppointment)}
          </strong>
          <span>
            {getAppointmentPatientId(selectedAppointment)} |{" "}
            {getAppointmentDoctorName(selectedAppointment)}
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
            {appointments.length === 0 ? (
              <option value="">No billable appointments found</option>
            ) : null}
            {appointments.map((a) => (
              <option value={getAppointmentId(a)} key={getAppointmentId(a)}>
                {getAppointmentPatientName(a)} - {getAppointmentTime(a)} -{" "}
                {getAppointmentStatus(a) || "-"}
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
              {invoice ? latestInvoicePatientName : "-"}
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
                  <button type="button" onClick={() => downloadInvoicePdf()}>
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

