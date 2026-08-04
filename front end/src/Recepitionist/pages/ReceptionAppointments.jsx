import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle, CreditCard, Eye, Printer } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../../components/ToastProvider";
import { formatToday, parseList, requestJson } from "../receptionApi";
import { getReceptionistProfile } from "../receptionSession";
import {
  getRecordBranchId,
  getRecordBranchName,
  getRecordClinicId,
  scopeReceptionistRecords,
} from "../receptionScope";
import { validateText } from "../../utils/validation";
import { formatIndianCurrency } from "../../utils/format";
import { getClinicDisplayName } from "../../utils/clinicDisplay";
import { getClinicInvoiceBranding } from "../../utils/clinicBranding";
import {
  DUPLICATE_APPOINTMENT_MESSAGE,
  hasDuplicateAppointmentForPatientDoctorDate,
} from "../../utils/appointmentDuplicateValidation";
import { isDoctorBranchLeaveDate } from "../../utils/doctorBranchLeave";
import { getSpecializationDisplayName } from "../../pages/DOCTORS/doctorExpertiseOptions";

const parseSlotLabel = (slot) => {
  if (!slot) return "";
  if (typeof slot === "string") return slot;
  if (typeof slot === "object") {
    if (slot.slotLabel) return String(slot.slotLabel);
    if (slot.timeSlot) return String(slot.timeSlot);
    if (slot.slotTime) return String(slot.slotTime);
    if (slot.time && typeof slot.time === "string") return String(slot.time);
    if (slot.start && slot.end)
      return `${String(slot.start).slice(0, 5)} - ${String(slot.end).slice(0, 5)}`;
    if (slot.startTime && slot.endTime)
      return `${String(slot.startTime).slice(0, 5)} - ${String(slot.endTime).slice(0, 5)}`;
    if (slot.start_time && slot.end_time)
      return `${String(slot.start_time).slice(0, 5)} - ${String(slot.end_time).slice(0, 5)}`;
    if (slot.slot) return String(slot.slot);
    if (slot.label) return String(slot.label);
  }
  return String(slot);
};

const getSlotStart = (slot) => String(parseSlotLabel(slot) || "").split(" - ")[0].trim();

const formatTo12Hour = (time) => {
  if (!time) return "";
  const text = String(time || "").trim();
  if (/\b(am|pm)\b/i.test(text)) return text;
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return text;
  let hours = Number(match[1]);
  const minutes = match[2];
  const meridiem = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, "0")}:${minutes} ${meridiem}`;
};

const normalizeAppointmentDate = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const isoDateTimeMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (isoDateTimeMatch) {
    const [, year, month, day, hour, minute, second = "00"] = isoDateTimeMatch;
    if (hour === "00" && minute === "00" && second === "00") return `${year}-${month}-${day}`;

    const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(text);
    const date = new Date(hasTimezone ? text : `${text}Z`);
    if (!Number.isNaN(date.getTime())) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }
  }

  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const dmyMatch = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, "0")}-${dmyMatch[1].padStart(2, "0")}`;
  }

  return text;
};

const normalizeSlotStart = (value) => {
  const text = String(value || "").trim();
  const start = text.split(" - ")[0].trim();
  const match = start.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
  if (!match) return start.toLowerCase();

  let hours = Number(match[1]);
  const minutes = match[2];
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  return `${String(hours).padStart(2, "0")}:${minutes}`;
};

const getSlotStatus = (slot) => String(slot?.status || "").trim().toLowerCase();

const isTimeOutSlot = () => false;

const isBookedSlot = (slot) => {
  const status = getSlotStatus(slot);
  return status === "booked" || slot?.isBooked;
};

const getRecordHospitalId = (record = {}) =>
  record.hospitalId ??
  record.HospitalId ??
  record.clinicId ??
  record.ClinicId ??
  record.hospital?.id ??
  record.clinic?.id ??
  "";

const getDoctorId = (doctor = {}) =>
  doctor.doctorId ?? doctor.DoctorId ?? doctor.id ?? doctor.Id ?? "";

const getDoctorName = (doctor = {}) =>
  String(doctor.doctorName || doctor.DoctorName || doctor.name || doctor.Name || "").trim();

const getAppointmentPatientId = (appointment = {}) =>
  appointment.patientId ??
  appointment.PatientId ??
  appointment.pid ??
  appointment.PID ??
  appointment.patient?.id ??
  appointment.patient?.patientId ??
  appointment.patient?.PatientId ??
  appointment.Patient?.Id ??
  appointment.Patient?.PatientId ??
  "";

const normalizePhone = (value) => String(value ?? "").replace(/\D/g, "");

const getAppointmentPatientPhone = (appointment = {}) =>
  normalizePhone(
    appointment.phone ??
      appointment.Phone ??
      appointment.phoneNumber ??
      appointment.PhoneNumber ??
      appointment.mobileNumber ??
      appointment.MobileNumber ??
      appointment.patientPhone ??
      appointment.PatientPhone ??
      appointment.patient?.phone ??
      appointment.patient?.Phone ??
      appointment.patient?.phoneNumber ??
      appointment.patient?.PhoneNumber ??
      appointment.Patient?.phone ??
      appointment.Patient?.Phone ??
      appointment.Patient?.phoneNumber ??
      appointment.Patient?.PhoneNumber ??
      ""
  );

const getPatientRecordId = (patient = {}) =>
  patient.id ?? patient.patientId ?? patient.PatientId ?? patient.PID ?? "";

const getPatientPhone = (patient = {}) => normalizePhone(patient.phone ?? patient.Phone ?? "");

const OFFLINE_PATIENT_SCOPE_KEY = "reception_offline_patient_scope_v2";

const readOfflinePatientScope = () => {
  try {
    const data = JSON.parse(localStorage.getItem(OFFLINE_PATIENT_SCOPE_KEY) || "{}");
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
};

const getOfflinePatientScopeKeys = (patient = {}) => {
  const id = String(getPatientRecordId(patient) || "").trim();
  const phone = getPatientPhone(patient);
  return [id ? `id:${id}` : "", phone ? `phone:${phone}` : ""].filter(Boolean);
};

const hasRememberedOfflinePatientScope = (patient = {}, scope = {}) => {
  const scopeData = readOfflinePatientScope();
  const clinicId = String(scope.clinicId || "");
  const branchId = String(scope.branchId || "");
  const branchName = String(scope.branchName || "");

  return getOfflinePatientScopeKeys(patient).some((key) => {
    const saved = scopeData[key];
    if (!saved) return false;

    const savedClinicId = String(saved.clinicId || "");
    const savedBranchId = String(saved.branchId || "");
    const savedBranchName = String(saved.branchName || "");

    return (
      (!clinicId || savedClinicId === clinicId) &&
      (!branchId || savedBranchId === branchId || (branchName && savedBranchName === branchName))
    );
  });
};

const patientBelongsToBookingBranch = (
  patient = {},
  branchPatientIds = new Set(),
  branchPatientPhones = new Set(),
  scope = {}
) => {
  if (branchPatientIds.has(String(getPatientRecordId(patient) || "").trim())) return true;
  if (branchPatientPhones.has(getPatientPhone(patient))) return true;

  const clinicId = getRecordClinicId(patient);
  const branchId = getRecordBranchId(patient);
  const branchName = getRecordBranchName(patient);

  if (clinicId || branchId || branchName) {
    return scopeReceptionistRecords([patient], scope).length > 0;
  }

  return hasRememberedOfflinePatientScope(patient, scope);
};

const getDoctorBranchId = (doctor = {}) =>
  doctor.branchId ??
  doctor.BranchId ??
  doctor.branchID ??
  doctor.BranchID ??
  doctor.branch?.id ??
  doctor.branch?.branchId ??
  doctor.Branch?.Id ??
  "";

const getDoctorFee = (doctor = {}) =>
  Number(
    doctor.consultationFee ??
      doctor.ConsultationFee ??
      doctor.fees ??
      doctor.Fees ??
      doctor.fee ??
      doctor.Fee ??
      0
  ) || 0;

const isActiveDoctor = (doctor = {}) => {
  if (typeof doctor.isActive === "boolean") return doctor.isActive;
  const status = String(doctor.status || "").trim().toLowerCase();
  return !status || status === "active";
};

const CHIEF_COMPLAINT_OPTIONS = [
  "Fever",
  "Cough",
  "Headache",
  "Cold",
  "Body pain",
  "Stomach pain",
  "Chest pain",
  "Back pain",
  "Vomiting",
  "Dizziness",
  "Other",
];

const validateChiefComplaintsLive = (value) => {
  const text = String(value || "").trim();
  return text ? validateText(text, "Chief complaints") : "";
};

const escapeReceiptHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const readFirst = (source = {}, keys = [], fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((record, part) => record?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const formatReceiptDateTime = (value = new Date()) => {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return String(value || "");
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatReceiptDate = (value = new Date()) => {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return String(value || "");
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const numberToWordsUnderOneLakh = (value) => {
  const amount = Math.round(Number(value) || 0);
  if (amount === 0) return "Zero";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const belowHundred = (num) =>
    num < 20 ? ones[num] : `${tens[Math.floor(num / 10)]}${num % 10 ? ` ${ones[num % 10]}` : ""}`;
  const belowThousand = (num) =>
    num >= 100
      ? `${ones[Math.floor(num / 100)]} Hundred${num % 100 ? ` ${belowHundred(num % 100)}` : ""}`
      : belowHundred(num);

  if (amount >= 1000) {
    return `${belowThousand(Math.floor(amount / 1000))} Thousand${amount % 1000 ? ` ${belowThousand(amount % 1000)}` : ""}`;
  }
  return belowThousand(amount);
};

const buildReceiptReference = (prefix) =>
  `${prefix}${String(Date.now()).slice(-7)}${String(Math.floor(Math.random() * 90) + 10)}`;

const printConsultationReceipt = ({
  appointment = {},
  patient = {},
  doctor = {},
  receptionist = {},
  branchName = "",
  fee = 0,
  paymentMode = "",
  slot = "",
  vitals = {},
  chiefComplaints = "",
}) => {
  const printWindow = window.open("", "_blank", "width=920,height=720");
  if (!printWindow) return false;

  const clinicName = getClinicDisplayName(
    {
      hospitalName: receptionist.hospitalName,
      clinicName: receptionist.hospitalName,
      hospitalId: receptionist.hospitalId,
    },
    "Clinic"
  );
  const clinicId = receptionist.hospitalId || receptionist.clinicId || localStorage.getItem("hospitalId") || localStorage.getItem("clinicId") || "";
  const branding = getClinicInvoiceBranding({ clinicId, clinicName });
  const logoUrl = branding.logoUrl;
  const patientName = readFirst(appointment, ["patientName", "PatientName"], "") || readFirst(patient, ["name", "fullName", "patientName"], "Patient");
  const patientId = readFirst(appointment, ["patientId", "PatientId"], "") || readFirst(patient, ["id", "patientId", "PatientId", "PID"], "-");
  const phone = readFirst(appointment, ["phone", "patientPhone", "PatientPhone"], "") || readFirst(patient, ["phone", "Phone", "phoneNumber", "PhoneNumber"], "-");
  const age = readFirst(patient, ["age", "Age", "patientAge", "PatientAge"], "-");
  const gender = readFirst(patient, ["gender", "Gender", "sex", "Sex"], "-");
  const address = readFirst(patient, ["address", "Address", "location", "Location"], "-");
  const doctorName = readFirst(appointment, ["doctorName", "DoctorName"], "") || getDoctorName(doctor) || "Doctor";
  const specialization = getSpecializationDisplayName(readFirst(doctor, ["specialization", "Specialization"], "")) || "-";
  const receiptNo = readFirst(appointment, ["receiptNo", "ReceiptNo", "transactionId", "TransactionId"], "") || buildReceiptReference("OP");
  const umrNo = `UMR${String(patientId || Date.now()).replace(/\D/g, "").padStart(7, "0").slice(-7)}`;
  const amount = Number(fee) || 0;
  const now = new Date();

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>OP Consultation Receipt - ${escapeReceiptHtml(receiptNo)}</title>
        <style>
          @page { size: A5 landscape; margin: 10mm; }
          body { margin: 0; color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
          .bill { border: 1px solid #111; padding: 12px 14px; min-height: 128mm; box-sizing: border-box; }
          .top { display: grid; grid-template-columns: 1.35fr 1fr; border-bottom: 1px solid #111; }
          .clinic { text-align: center; padding: 6px 12px 10px; border-right: 1px solid #111; }
          .clinic-logo { width: 58px; height: 58px; object-fit: contain; display: block; margin: 0 auto 5px; }
          .clinic h1 { margin: 0 0 5px; font-size: 18px; text-transform: uppercase; }
          .clinic p { margin: 2px 0; line-height: 1.35; }
          .title { margin-top: 5px; font-weight: 800; text-decoration: underline; font-size: 15px; }
          .patient { padding: 6px 0 8px 12px; }
          .row { display: grid; grid-template-columns: 90px 10px 1fr; gap: 4px; margin: 4px 0; align-items: start; }
          .section { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; padding: 12px 0 6px; }
          .label { color: #333; }
          .value { font-weight: 700; }
          .amounts { width: 42%; margin-left: auto; margin-top: 8px; }
          .amount-row { display: grid; grid-template-columns: 1fr 90px; gap: 12px; margin: 7px 0; }
          .amount-row strong { text-align: right; }
          .validity { margin-top: 10px; line-height: 1.55; }
          .footer { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 14px; align-items: end; }
          .barcode { font-family: "Libre Barcode 39", "Courier New", monospace; letter-spacing: 2px; font-size: 30px; line-height: 1; }
          .barcode-text { font-size: 13px; margin-top: 2px; letter-spacing: 1px; }
          .sign { text-align: right; font-weight: 800; padding-top: 34px; }
          .stamp { border: 2px solid #111; border-radius: 999px; display: inline-flex; min-width: 54px; min-height: 38px; align-items: center; justify-content: center; font-size: 18px; font-weight: 900; margin-left: 10px; }
          @media print { button { display: none; } body { print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="bill">
          <div class="top">
            <div class="clinic">
              <img class="clinic-logo" src="${escapeReceiptHtml(logoUrl)}" alt="Clinic logo" />
              <h1>${escapeReceiptHtml(branding.headerTitle || clinicName)}</h1>
              <p>${escapeReceiptHtml(branchName || receptionist.branchName || "Branch")}</p>
              <p>Reg. No: ${escapeReceiptHtml(String(receptionist.hospitalId || "-"))}</p>
              <div class="title">Consultation Bill - Cum - Receipt</div>
            </div>
            <div class="patient">
              <div class="row"><span class="label">Pt. Name</span><span>:</span><span class="value">${escapeReceiptHtml(patientName)}</span></div>
              <div class="row"><span class="label">UMR No</span><span>:</span><span class="value">${escapeReceiptHtml(umrNo)}</span></div>
              <div class="row"><span class="label">Cons No</span><span>:</span><span>${escapeReceiptHtml(receiptNo)}</span></div>
              <div class="row"><span class="label">Age/Sex</span><span>:</span><span>${escapeReceiptHtml(age)} / ${escapeReceiptHtml(gender)}</span></div>
              <div class="row"><span class="label">Cons Dt</span><span>:</span><span>${escapeReceiptHtml(formatReceiptDate(appointment.date || appointment.appointmentDate || new Date()))}</span></div>
              <div class="row"><span class="label">Phone</span><span>:</span><span>${escapeReceiptHtml(phone)}</span></div>
            </div>
          </div>

          <div class="section">
            <div>
              <div class="row"><span class="label">Consultant</span><span>:</span><span class="value">Dr. ${escapeReceiptHtml(doctorName)}</span></div>
              <div class="row"><span class="label">Ref By</span><span>:</span><span>WALKIN</span></div>
              <div class="row"><span class="label">Visit Type</span><span>:</span><span>Normal</span></div>
              <div class="row"><span class="label">Pay mode</span><span>:</span><span>${escapeReceiptHtml(paymentMode || "-")}</span></div>
              <div class="row"><span class="label">Slot</span><span>:</span><span>${escapeReceiptHtml(slot || "-")}</span></div>
              <div class="row"><span class="label">Complaint</span><span>:</span><span>${escapeReceiptHtml(chiefComplaints || "-")}</span></div>
            </div>
            <div>
              <div class="row"><span class="label">Address</span><span>:</span><span>${escapeReceiptHtml(address)}</span></div>
              <div class="row"><span class="label">Department</span><span>:</span><span>${escapeReceiptHtml(specialization)}</span></div>
              <div class="row"><span class="label">Cons Fee</span><span>:</span><span class="value">${escapeReceiptHtml(formatIndianCurrency(amount))}</span></div>
            </div>
          </div>

          <div class="amounts">
            <div class="amount-row"><span>Recpt Amt</span><strong>${amount.toFixed(2)}</strong></div>
            <div class="amount-row"><span>Cash Amt</span><strong>${amount.toFixed(2)}</strong></div>
            <div class="amount-row"><span>Due Amt</span><strong>0.00</strong></div>
          </div>

          <div class="validity">
            <div>Validity: &lt; PAY &gt; Validity: consultation before ${escapeReceiptHtml(formatReceiptDate(new Date(Date.now() + 29 * 24 * 60 * 60 * 1000)))}</div>
            <div>Received with thanks from ${escapeReceiptHtml(patientName)}. A sum of ${escapeReceiptHtml(formatIndianCurrency(amount))}/-</div>
            <div>In Words: ${escapeReceiptHtml(numberToWordsUnderOneLakh(amount))} Rupees Only</div>
          </div>

          <div class="footer">
            <div>
              <div class="row"><span class="label">Create By</span><span>:</span><span>${escapeReceiptHtml(receptionist.name || "-")}</span></div>
              <div class="row"><span class="label">Print By</span><span>:</span><span>${escapeReceiptHtml(receptionist.name || "-")}</span></div>
              <div class="row"><span class="label">Create Dt</span><span>:</span><span>${escapeReceiptHtml(formatReceiptDateTime(now))}</span></div>
              <div class="row"><span class="label">Print Dt</span><span>:</span><span>${escapeReceiptHtml(formatReceiptDateTime(now))}</span></div>
            </div>
            <div>
              <div class="barcode">*${escapeReceiptHtml(umrNo)}*</div>
              <div class="barcode-text">${escapeReceiptHtml(umrNo)}</div>
              <div class="barcode">*${escapeReceiptHtml(receiptNo)}*</div>
              <div class="barcode-text">${escapeReceiptHtml(receiptNo)}</div>
              <div class="sign">(Authorised Signatory)<span class="stamp">OP</span></div>
            </div>
          </div>
        </div>
        <script>
          window.onload = () => {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
  return true;
};

function ReceptionAppointments({ hideActions = false }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const receptionistProfile = getReceptionistProfile();
  const requestedPatientId = String(searchParams.get("patientId") || "").trim();
  const receptionistHospitalId = String(
    receptionistProfile.hospitalId || ""
  ).trim();
  const receptionistBranchId = String(
    receptionistProfile.branchId || ""
  ).trim();
  const receptionistBranchName = String(
    receptionistProfile.branchName || receptionistProfile.branch || ""
  ).trim();
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [isPatientMenuOpen, setIsPatientMenuOpen] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [doctorLoadMessage, setDoctorLoadMessage] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [paymentStep, setPaymentStep] = useState(false);
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [form, setForm] = useState({
    patientId: "",
    doctorId: "",
    date: formatToday(),
    chiefComplaints: "",
  });

  const refresh = useCallback(() => {
    setDoctorLoadMessage("");

    const doctorRequest = receptionistBranchId
      ? requestJson(`Doctor/branch/${encodeURIComponent(receptionistBranchId)}`)
          .then((data) => ({ data, error: "", source: "branch" }))
          .catch((error) =>
            requestJson("Doctor")
              .then((data) => ({
                data,
                error:
                  error.message ||
                  "Unable to load branch doctors. Showing matching local records.",
                source: "fallback",
              }))
              .catch((fallbackError) => ({
                data: [],
                error:
                  fallbackError.message ||
                  error.message ||
                  "Unable to load doctors.",
                source: "fallback",
              }))
          )
      : requestJson("Doctor")
          .then((data) => ({ data, error: "", source: "all" }))
          .catch((error) => ({
            data: [],
            error: error.message || "Unable to load doctors.",
            source: "all",
          }));

    Promise.all([
      requestJson("Patient").catch(() => []),
      doctorRequest,
      requestJson("Appointment").catch(() => []),
      requestJson("Appointment/offline").catch(() => []),
      requestJson("Appointment/online").catch(() => []),
    ]).then(([patientData, doctorResult, appointmentData, offlineAppointmentData, onlineAppointmentData]) => {
      const scope = {
        clinicId: receptionistHospitalId,
        branchId: receptionistBranchId,
        branchName: receptionistBranchName,
      };
      const appointmentRecords = [
        ...parseList(appointmentData),
        ...parseList(offlineAppointmentData),
        ...parseList(onlineAppointmentData),
      ];
      const scopedAppointments = scopeReceptionistRecords(appointmentRecords, scope);
      const branchPatientIds = new Set(
        scopedAppointments
          .map(getAppointmentPatientId)
          .map((id) => String(id || "").trim())
          .filter(Boolean)
      );
      const branchPatientPhones = new Set(
        scopedAppointments
          .map(getAppointmentPatientPhone)
          .filter(Boolean)
      );
      const nextPatients = parseList(patientData).filter((patient) =>
        patientBelongsToBookingBranch(patient, branchPatientIds, branchPatientPhones, scope)
      );
      const activeDoctors = parseList(doctorResult.data).filter(isActiveDoctor);
      const branchDoctors =
        receptionistBranchId && doctorResult.source !== "branch"
          ? activeDoctors.filter(
              (doctor) =>
                String(getDoctorBranchId(doctor)).trim() ===
                receptionistBranchId
            )
          : activeDoctors;
      const nextDoctors = receptionistHospitalId
        ? branchDoctors.filter(
            (doctor) =>
              String(getRecordHospitalId(doctor)).trim() ===
                receptionistHospitalId ||
              !String(getRecordHospitalId(doctor)).trim()
          )
        : branchDoctors;

      if (doctorResult.error) {
        setDoctorLoadMessage(doctorResult.error);
      } else if (nextDoctors.length === 0) {
        setDoctorLoadMessage(
          receptionistHospitalId
            ? `No active doctors are assigned to this branch.`
            : "No active doctors are available for this receptionist."
        );
      } else {
        setDoctorLoadMessage("");
      }

      setPatients(nextPatients);
      setDoctors(nextDoctors);
      setAppointments(scopedAppointments);
      setForm((prev) => ({
        ...prev,
        patientId: nextPatients.some(
          (patient) => String(getPatientId(patient)) === requestedPatientId
        )
          ? requestedPatientId
          : nextPatients.some(
              (patient) => String(getPatientId(patient)) === String(prev.patientId)
            )
            ? prev.patientId
            : "",
        doctorId: nextDoctors.some(
          (doctor) => String(getDoctorId(doctor)) === String(prev.doctorId)
        )
          ? prev.doctorId
          : String(getDoctorId(nextDoctors[0]) || ""),
      }));
    });
  }, [receptionistBranchId, receptionistBranchName, receptionistHospitalId, requestedPatientId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getPatientId = (patient = {}) =>
    patient.id ?? patient.patientId ?? patient.PatientId ?? patient.PID ?? "";

  const getPatientName = (patient = {}) =>
    String(patient.name || patient.fullName || patient.patientName || "").trim();

  const selectedDoctor = useMemo(
    () => doctors.find((d) => String(getDoctorId(d)) === String(form.doctorId)),
    [doctors, form.doctorId]
  );

  const selectedPatient = useMemo(
    () => patients.find((patient) => String(getPatientId(patient)) === String(form.patientId)),
    [patients, form.patientId]
  );

  const consultationFee = getDoctorFee(selectedDoctor);

  const patientCount = patients.length;

  const matchingPatients = useMemo(() => {
    const search = patientSearch.trim().toLowerCase();
    if (!search) return patients.slice(0, 8);

    return patients
      .filter((patient) => {
        const name = getPatientName(patient).toLowerCase();
        const id = String(getPatientId(patient) || "").toLowerCase();
        return name.includes(search) || id.includes(search);
      })
      .slice(0, 8);
  }, [patientSearch, patients]);

  const parseSlots = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.slots)) return data.slots;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.result)) return data.result;
    return [];
  };

  const parseSlotLabel = (slot) => {
    if (!slot) return "";
    if (typeof slot === "string") return slot;
    if (typeof slot === "object") {
      if (slot.slotLabel) return String(slot.slotLabel).trim();
      if (slot.timeSlot) return String(slot.timeSlot).trim();
      if (slot.slotTime) return String(slot.slotTime).trim();
      if (slot.label) return String(slot.label).trim();
      if (slot.time && typeof slot.time === "string") return String(slot.time).trim();
      if (slot.start && slot.end)
        return `${String(slot.start).trim()} - ${String(slot.end).trim()}`;
      if (slot.startTime && slot.endTime)
        return `${String(slot.startTime).trim()} - ${String(slot.endTime).trim()}`;
      if (slot.start_time && slot.end_time)
        return `${String(slot.start_time).trim()} - ${String(slot.end_time).trim()}`;
      if (slot.slot) return String(slot.slot).trim();
    }
    return String(slot).trim();
  };

  const getSlotBranchId = (slot) =>
    String(
      slot?.branchId ??
        slot?.BranchId ??
        slot?.clinicBranchId ??
        slot?.ClinicBranchId ??
        ""
    ).trim();

  const bookedSlots = useMemo(() => {
    return new Set(
      appointments
        .filter((item) =>
          normalizeAppointmentDate(
            item.date ||
              item.Date ||
              item.appointmentDate ||
              item.AppointmentDate ||
              item.scheduledDate ||
              item.ScheduledDate ||
              item.slotDate ||
              item.SlotDate ||
              item.bookingDate ||
              item.BookingDate ||
              ""
          ) === form.date
        )
        .filter(
          (item) =>
            String(item.doctorId || item.DoctorId || item.doctor?.doctorId || item.doctor?.id || "") ===
            String(form.doctorId)
        )
        .map((item) =>
          normalizeSlotStart(
            item.slot ||
              item.Slot ||
              item.startTime ||
              item.StartTime ||
              item.time ||
              item.Time ||
              item.appointmentTime ||
              item.AppointmentTime ||
              item.slotTime ||
              item.SlotTime ||
              item.timeSlot ||
              item.TimeSlot ||
              ""
          )
        )
        .filter(Boolean)
    );
  }, [appointments, form.date, form.doctorId]);

  const visibleSlots = useMemo(() => {
    return availableSlots.filter((slot) => {
      const label = parseSlotLabel(slot);
      return Boolean(label);
    });
  }, [availableSlots]);

  useEffect(() => {
    if (!form.doctorId || !form.date) {
      setAvailableSlots([]);
      setSelectedSlot("");
      return;
    }

    setSlotLoading(true);
    const query = new URLSearchParams({
      doctorId: String(form.doctorId),
      date: form.date,
    });
    if (receptionistBranchId) query.set("branchId", receptionistBranchId);

    if (isDoctorBranchLeaveDate(form.doctorId, receptionistBranchId, form.date)) {
      setAvailableSlots([]);
      setSelectedSlot("");
      setSlotLoading(false);
      return;
    }

    requestJson(`Schedule/day-slots?${query.toString()}`)
      .then((data) => {
        const slots = parseSlots(data).filter((slot) => {
          const slotBranchId = getSlotBranchId(slot);
          return !receptionistBranchId || !slotBranchId || slotBranchId === receptionistBranchId;
        });
        setAvailableSlots(slots);
        setSelectedSlot("");
      })
      .catch(() => {
        setAvailableSlots([]);
      })
      .finally(() => setSlotLoading(false));
  }, [form.doctorId, form.date, receptionistBranchId]);

  const validateBookingForm = () => {
    if (!form.patientId || !form.doctorId || !selectedSlot) {
      setMessage("Please select patient, doctor, date, and time slot.");
      toast.error("Please select patient, doctor, date, and time slot.");
      return false;
    }

    if (
      hasDuplicateAppointmentForPatientDoctorDate(appointments, {
        patientId: form.patientId,
        patientName: getPatientName(selectedPatient),
        phone: getPatientPhone(selectedPatient),
        doctorId: form.doctorId,
        doctorName: getDoctorName(selectedDoctor),
        date: form.date,
      })
    ) {
      setMessage(DUPLICATE_APPOINTMENT_MESSAGE);
      toast.error(DUPLICATE_APPOINTMENT_MESSAGE);
      return false;
    }

    const nextFieldErrors = {};

    const chiefComplaintsError = validateText(
      form.chiefComplaints,
      "Chief complaints"
    );
    if (chiefComplaintsError) {
      nextFieldErrors.chiefComplaints = chiefComplaintsError;
    }

    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors);
      setMessage("Please fix the highlighted fields.");
      toast.error("Please fix the highlighted fields.");
      return false;
    }

    setFieldErrors({});
    return true;
  };

  const openPaymentStep = (event) => {
    event.preventDefault();
    if (!validateBookingForm()) return;

    setPaymentStep(true);
    setMessage("");
  };

  const submit = async () => {
    if (!validateBookingForm()) return;

    const selectedSlotObject = availableSlots.find(
      (slot) => parseSlotLabel(slot) === selectedSlot
    );
    const selectedSlotStart = getSlotStart(selectedSlot);
    const branchIdForAppointment =
      Number(getSlotBranchId(selectedSlotObject)) ||
      Number(receptionistBranchId) ||
      Number(getDoctorBranchId(selectedDoctor)) ||
      0;
    const branchNameForAppointment =
      getRecordBranchName(selectedSlotObject) ||
      getRecordBranchName(selectedDoctor) ||
      receptionistBranchName ||
      "";
    const transactionId = `CONS-${Date.now()}`;
    const vitals = {};
    const body = {
      hospitalId: Number(receptionistHospitalId) || 0,
      clinicId: Number(receptionistHospitalId) || 0,
      branchId: branchIdForAppointment,
      BranchId: branchIdForAppointment,
      branchName: branchNameForAppointment,
      BranchName: branchNameForAppointment,
      doctorId: Number(form.doctorId),
      patientId: Number(form.patientId),
      patientName: getPatientName(selectedPatient),
      phone: getPatientPhone(selectedPatient),
      patientPhone: getPatientPhone(selectedPatient),
      doctorName: getDoctorName(selectedDoctor),
      date: form.date,
      appointmentDate: form.date,
      slotDate: form.date,
      startTime: selectedSlotStart ? formatTo12Hour(selectedSlotStart) : "",
      paymentMode,
      transactionId,
      paidAmount: consultationFee,
      paymentStatus: "Paid",
      status: "Scheduled",
      chiefComplaints: form.chiefComplaints.trim(),
      vitals,
    };

    try {
      setBookingLoading(true);
      console.debug("Booking payload", { selectedDoctor, branchIdForAppointment, body });
      const savedAppointment = await requestJson("Appointment", { method: "POST", body: JSON.stringify(body) });
      const receiptData = {
        appointment: { ...body, ...(savedAppointment || {}) },
        patient: selectedPatient,
        doctor: selectedDoctor,
        receptionist: receptionistProfile,
        branchName: branchNameForAppointment,
        fee: consultationFee,
        paymentMode,
        slot: selectedSlot,
        vitals,
        chiefComplaints: form.chiefComplaints.trim(),
      };
      setLastReceipt(receiptData);
      setShowReceiptPreview(false);
      setMessage("Payment received. Appointment booked successfully.");
      toast.success("Payment received. Appointment booked successfully");
      setSelectedSlot("");
      setPaymentStep(false);
      try {
        localStorage.setItem("appointments:updatedAt", String(Date.now()));
      } catch (e) {
        // ignore storage errors
      }
      refresh();
    } catch (error) {
      console.error("Booking failed", { error, selectedDoctor, branchIdForAppointment, body });
      const text = error.message || "Unable to book appointment.";
      setMessage(text);
      toast.error(text);
    } finally {
      setBookingLoading(false);
    }
  };

  const setField = (name, value) => {
    const nextValue = value;

    setForm((prev) => ({ ...prev, [name]: nextValue }));
    if (["patientId", "doctorId", "date"].includes(name)) {
      setPaymentStep(false);
      setLastReceipt(null);
      setShowReceiptPreview(false);
    }

    if (name === "chiefComplaints") {
      setFieldErrors((prev) => ({
        ...prev,
        chiefComplaints: validateChiefComplaintsLive(nextValue),
      }));
    }
  };

  const selectPatient = (patient) => {
    setField("patientId", String(getPatientId(patient)));
    setPatientSearch("");
    setIsPatientMenuOpen(false);
  };

  const handlePatientSearch = (value) => {
    setPatientSearch(value);
    setIsPatientMenuOpen(true);

    const exactMatch = patients.find((patient) => {
      const nameMatches =
        getPatientName(patient).toLowerCase() === value.trim().toLowerCase();
      const idMatches =
        String(getPatientId(patient)).toLowerCase() === value.trim().toLowerCase();
      return nameMatches || idMatches;
    });

    setField("patientId", exactMatch ? String(getPatientId(exactMatch)) : "");
  };

  const openPatientMenu = () => {
    setPatientSearch("");
    setIsPatientMenuOpen(true);
  };

  const printLastReceipt = () => {
    if (!lastReceipt) return;
    const printed = printConsultationReceipt(lastReceipt);
    if (!printed) {
      toast.error("Unable to open print preview. Please allow pop-ups and try again.");
    }
  };

  const receiptAppointment = lastReceipt?.appointment || {};
  const receiptPatient = lastReceipt?.patient || {};
  const receiptDoctor = lastReceipt?.doctor || {};
  const receiptPatientName =
    readFirst(receiptAppointment, ["patientName", "PatientName"], "") ||
    readFirst(receiptPatient, ["name", "fullName", "patientName"], "Patient");
  const receiptPatientId =
    readFirst(receiptAppointment, ["patientId", "PatientId"], "") ||
    readFirst(receiptPatient, ["id", "patientId", "PatientId", "PID"], "-");
  const receiptPhone =
    readFirst(receiptAppointment, ["phone", "patientPhone", "PatientPhone"], "") ||
    readFirst(receiptPatient, ["phone", "Phone", "phoneNumber", "PhoneNumber"], "-");
  const receiptDoctorName =
    readFirst(receiptAppointment, ["doctorName", "DoctorName"], "") ||
    getDoctorName(receiptDoctor) ||
    "Doctor";
  const receiptDate = receiptAppointment.date || receiptAppointment.appointmentDate || "";

  return (
    <section className="rc-page">
      <div className="rc-page-head">
        <div>
          <h2>Appointment Booking</h2>
          <p>Select patient, doctor, date, lock a slot, and confirm booking.</p>
          <p>{patientCount} registered patient{patientCount === 1 ? "" : "s"} available for booking.</p>
        </div>
        {!hideActions && (
          <div className="rc-head-actions">
            <button className="rc-btn" onClick={() => navigate("/reception/dashboard") }>
              <ArrowLeft size={16} /> Dashboard
            </button>
          </div>
        )}
      </div>

      {message ? <div className="rc-alert">{message}</div> : null}

      <form className="rc-card rc-booking-form" onSubmit={openPaymentStep} noValidate>
        <div className="rc-booking-fields">
          <h3>Book Appointment</h3>
          <label>
            <span>Patient</span>
            <div className="rc-patient-autocomplete">
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => handlePatientSearch(e.target.value)}
                onFocus={openPatientMenu}
                onBlur={() => setTimeout(() => setIsPatientMenuOpen(false), 150)}
                placeholder="Select Patient"
                autoComplete="off"
                role="combobox"
                aria-label="Search patient by name"
                aria-autocomplete="list"
                aria-controls="reception-patient-options"
                aria-expanded={isPatientMenuOpen}
              />
              {isPatientMenuOpen ? (
                <div
                  id="reception-patient-options"
                  className="rc-patient-autocomplete-menu"
                  role="listbox"
                >
                  {matchingPatients.length > 0 ? (
                    matchingPatients.map((patient) => (
                      <button
                        key={getPatientId(patient)}
                        type="button"
                        role="option"
                        aria-selected={String(getPatientId(patient)) === String(form.patientId)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectPatient(patient)}
                      >
                        <strong>{getPatientName(patient) || "Unnamed patient"}</strong>
                        <span>Patient ID: {getPatientId(patient)}</span>
                      </button>
                    ))
                  ) : (
                    <div className="rc-patient-autocomplete-empty">No matching patients found.</div>
                  )}
                </div>
              ) : null}
            </div>
          </label>
          <label>
            <span>Doctor</span>
            <select value={form.doctorId} onChange={(e) => setField("doctorId", e.target.value)}>
              {doctors.length === 0 ? (
                <option value="">
                  {doctorLoadMessage || "No doctors available"}
                </option>
              ) : null}
              {doctors.map((d) => (
                <option key={getDoctorId(d)} value={getDoctorId(d)}>
                  {d.name}
                    {d.specialization ? ` - ${getSpecializationDisplayName(d.specialization)}` : ""}
                </option>
              ))}
            </select>
            {doctorLoadMessage ? (
              <small className="rc-field-message">{doctorLoadMessage}</small>
            ) : null}
          </label>
          <label>
            <span>Date</span>
            <input type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} />
          </label>
          <label>
            <span>Chief Complaints</span>
            <input
              list="chief-complaint-options"
              value={form.chiefComplaints}
              onChange={(e) => setField("chiefComplaints", e.target.value)}
              placeholder="Select or type complaint"
              autoComplete="off"
              className={fieldErrors.chiefComplaints ? "is-invalid" : ""}
            />
            <datalist id="chief-complaint-options">
              {CHIEF_COMPLAINT_OPTIONS.map((complaint) => (
                <option key={complaint} value={complaint} />
              ))}
            </datalist>
            {fieldErrors.chiefComplaints ? (
              <small className="rc-field-error">
                {fieldErrors.chiefComplaints}
              </small>
            ) : null}
          </label>
        </div>

        <div className="rc-slot-panel">
          <div className="rc-slot-head">
            <strong>Time Slots</strong>
            <span>Available&nbsp;&nbsp; Selected&nbsp;&nbsp; Booked</span>
          </div>
          <div className="rc-slots">
            {slotLoading ? (
              <div className="rc-slot-loading">Loading slots...</div>
            ) : visibleSlots.length > 0 ? (
              visibleSlots.map((slot) => {
                const label = parseSlotLabel(slot);
                const slotStart = normalizeSlotStart(label);
                const isBooked = Boolean(isBookedSlot(slot) || bookedSlots.has(slotStart));
                const isSelected = selectedSlot && normalizeSlotStart(selectedSlot) === slotStart;
                const isCompleted = !isBooked && isTimeOutSlot(slot, form.date);
                const statusLabel = isBooked
                  ? "BOOKED"
                  : isSelected
                    ? "SELECTED"
                    : isCompleted
                      ? "TIME OUT"
                      : "AVAILABLE";
                const buttonClass = [
                  isBooked ? "booked" : isCompleted ? "completed" : "available",
                  isSelected && !isBooked && !isCompleted ? "selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <button
                    type="button"
                    key={`${label}-${slotStart}`}
                    disabled={isBooked || isCompleted}
                    className={buttonClass}
                    aria-pressed={Boolean(isSelected)}
                    onClick={() => {
                      setSelectedSlot(label);
                      setPaymentStep(false);
                    }}
                  >
                    {label} - {statusLabel}
                  </button>
                );
              })
            ) : (
              <div className="rc-slot-empty">No slots available for this doctor on the selected date.</div>
            )}
          </div>
          <button type="submit" className="rc-confirm">
            <CheckCircle size={16} /> Confirm Booking
          </button>
          {paymentStep ? (
            <div className="rc-consult-payment">
              <div className="rc-consult-payment-head">
                <CreditCard size={18} />
                <div>
                  <strong>Consultation Payment</strong>
                  <span>{selectedDoctor?.name || "Doctor"} fee only</span>
                </div>
              </div>
              <div className="rc-payment-row">
                <span>Consultation Fee</span>
                <strong>{formatIndianCurrency(consultationFee)}</strong>
              </div>
              <label>
                <span>Payment Mode</span>
                <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                </select>
              </label>
              <button
                type="button"
                className="rc-confirm"
                onClick={submit}
                disabled={bookingLoading}
              >
                <CreditCard size={16} /> {bookingLoading ? "Processing..." : "Pay Now"}
              </button>
            </div>
          ) : null}
          {lastReceipt ? (
            <div className="rc-booking-receipt-actions">
              <div>
                <strong>Booking confirmed</strong>
                <span>{receiptPatientName} with Dr. {receiptDoctorName}</span>
              </div>
              <div className="rc-booking-receipt-buttons">
                <button
                  type="button"
                  className="rc-receipt-preview-btn"
                  onClick={() => setShowReceiptPreview((value) => !value)}
                >
                  <Eye size={16} /> {showReceiptPreview ? "Hide Preview" : "Preview"}
                </button>
                <button type="button" className="rc-receipt-print-btn" onClick={printLastReceipt}>
                  <Printer size={16} /> Print
                </button>
              </div>
            </div>
          ) : null}
          {lastReceipt && showReceiptPreview ? (
            <div className="rc-booking-receipt-preview">
              <div className="rc-receipt-preview-head">
                <strong>Consultation Receipt Preview</strong>
                <span>{formatReceiptDate(receiptDate || new Date())}</span>
              </div>
              <div className="rc-receipt-preview-grid">
                <span>Patient</span>
                <strong>{receiptPatientName}</strong>
                <span>Patient ID</span>
                <strong>{receiptPatientId}</strong>
                <span>Phone</span>
                <strong>{receiptPhone || "-"}</strong>
                <span>Doctor</span>
                <strong>Dr. {receiptDoctorName}</strong>
                <span>Slot</span>
                <strong>{lastReceipt.slot || "-"}</strong>
                <span>Payment</span>
                <strong>{lastReceipt.paymentMode || "-"} - {formatIndianCurrency(lastReceipt.fee)}</strong>
                <span>Complaint</span>
                <strong>{lastReceipt.chiefComplaints || "-"}</strong>
              </div>
            </div>
          ) : null}
        </div>
      </form>
    </section>
  );
}

export default ReceptionAppointments;
