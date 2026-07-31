import { apiUrl } from "../config/api";
import { getReceptionToken } from "./receptionSession";
import { getNurseToken, isNurseSession } from "../Nurse/nurseSession";

export const receptionApiUrl = (path) => apiUrl(path);

const nurseApiPath = (path, method = "GET") => {
  const raw = String(path || "").replace(/^\/+/, "");
  if (!isNurseSession()) return raw;
  if (/^Patient\/([^/?]+)$/i.test(raw) && method.toUpperCase() === "PUT") {
    return raw.replace(/^Patient\/([^/?]+)$/i, "Nurse/patients/$1");
  }
  if (/^Appointment\/online\/([^/]+)\/vitals/i.test(raw)) {
    return raw.replace(/^Appointment\/online\/([^/]+)\/vitals/i, "Nurse/appointments/$1/vitals");
  }
  return raw;
};

export const parseList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.appointments)) return data.data.appointments;
  if (Array.isArray(data?.data?.patients)) return data.data.patients;
  if (Array.isArray(data?.data?.printQueue)) return data.data.printQueue;
  if (Array.isArray(data?.data?.queue)) return data.data.queue;
  if (Array.isArray(data?.data?.records)) return data.data.records;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.result?.appointments)) return data.result.appointments;
  if (Array.isArray(data?.result?.patients)) return data.result.patients;
  if (Array.isArray(data?.result?.printQueue)) return data.result.printQueue;
  if (Array.isArray(data?.result?.queue)) return data.result.queue;
  if (Array.isArray(data?.result?.records)) return data.result.records;
  if (Array.isArray(data?.appointments)) return data.appointments;
  if (Array.isArray(data?.patients)) return data.patients;
  if (Array.isArray(data?.printQueue)) return data.printQueue;
  if (Array.isArray(data?.queue)) return data.queue;
  if (Array.isArray(data?.records)) return data.records;

  if (data && typeof data === "object") {
    const queue = [data];
    const seen = new Set();
    while (queue.length) {
      const current = queue.shift();
      if (!current || typeof current !== "object" || seen.has(current)) continue;
      seen.add(current);

      for (const value of Object.values(current)) {
        if (Array.isArray(value)) return value;
        if (value && typeof value === "object") queue.push(value);
      }
    }
  }

  return [];
};

export const requestJson = async (path, options = {}) => {
  const token = isNurseSession() ? getNurseToken() : getReceptionToken();
  const headers = {
    "ngrok-skip-browser-warning": "true",
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(receptionApiUrl(nurseApiPath(path, options.method || "GET")), {
    ...options,
    headers,
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const validationMessage =
      data?.errors && typeof data.errors === "object"
        ? Object.entries(data.errors)
            .flatMap(([key, messages]) => {
              const list = Array.isArray(messages) ? messages : [messages];
              return list.filter(Boolean).map((message) => `${key}: ${message}`);
            })
            .join(" ")
        : "";
    const message =
      data?.message ||
      validationMessage ||
      data?.title ||
      (typeof data === "string" ? data : "") ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
};

const requestJsonFallback = async (paths = [], options = {}) => {
  let lastError = null;

  for (const path of paths) {
    try {
      return await requestJson(path, options);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Request failed.");
};

const readAppointmentId = (appointment = {}) =>
  String(
    appointment.id ??
      appointment.Id ??
      appointment.appointmentId ??
      appointment.AppointmentId ??
      appointment.appointmentID ??
      appointment.AppointmentID ??
      appointment.appointment?.id ??
      appointment.Appointment?.Id ??
      ""
  ).trim();

const readPatientId = (record = {}) =>
  String(
    record.patientId ??
      record.PatientId ??
      record.pid ??
      record.PID ??
      record.patient?.id ??
      record.patient?.patientId ??
      record.Patient?.Id ??
      record.Patient?.PatientId ??
      record.id ??
      record.Id ??
      ""
  ).trim();

const readPatientPhone = (record = {}) =>
  String(
    record.phone ??
      record.Phone ??
      record.phoneNumber ??
      record.PhoneNumber ??
      record.mobile ??
      record.Mobile ??
      record.mobileNumber ??
      record.MobileNumber ??
      record.patientPhone ??
      record.PatientPhone ??
      record.patient?.phone ??
      record.patient?.Phone ??
      record.patient?.phoneNumber ??
      record.Patient?.Phone ??
      record.Patient?.PhoneNumber ??
      ""
  ).replace(/\D/g, "");

const normalizeFingerprintText = (value) => String(value ?? "").trim().toLowerCase();

const readFirstText = (record = {}, keys = []) => {
  for (const key of keys) {
    const parts = String(key).split(".");
    let current = record;

    for (const part of parts) {
      if (!current || typeof current !== "object") {
        current = "";
        break;
      }
      current = current[part];
    }

    if (current !== undefined && current !== null && String(current).trim() !== "") {
      return String(current).trim();
    }
  }

  return "";
};

const normalizeAppointmentDate = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const dmyMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, "0")}-${dmyMatch[1].padStart(2, "0")}`;

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  }

  return normalizeFingerprintText(text);
};

const normalizeAppointmentTime = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/^0(\d:)/, "$1");

const getAppointmentFingerprint = (record = {}) => {
  const appointmentId = readAppointmentId(record);
  if (appointmentId) return `appointment:${appointmentId}`;

  const patientId = readPatientId(record);
  const patientPhone = readPatientPhone(record);
  const patientName = readFirstText(record, [
    "patientName",
    "PatientName",
    "patient.name",
    "patient.fullName",
    "Patient.Name",
    "name",
    "Name",
  ]);
  const doctorName = readFirstText(record, [
    "doctorName",
    "DoctorName",
    "doctor.name",
    "doctor.fullName",
    "Doctor.Name",
    "doctor",
  ]);
  const date = normalizeAppointmentDate(
    readFirstText(record, [
      "date",
      "appointmentDate",
      "AppointmentDate",
      "scheduledDate",
      "slotDate",
      "SlotDate",
      "bookingDate",
      "BookingDate",
    ])
  );
  const time = normalizeAppointmentTime(
    readFirstText(record, [
      "time",
      "slot",
      "Slot",
      "startTime",
      "StartTime",
      "slotTime",
      "SlotTime",
      "timeSlot",
      "TimeSlot",
      "appointmentTime",
      "AppointmentTime",
    ])
  );
  const complaint = normalizeFingerprintText(
    readFirstText(record, ["chiefComplaint", "chiefComplaints", "ChiefComplaint", "complaint", "reason"])
  );
  const patientKey = patientId || patientPhone || normalizeFingerprintText(patientName);

  return [
    "fingerprint",
    patientKey,
    normalizeFingerprintText(doctorName),
    date,
    time,
    complaint,
  ].join("|");
};

const mergeRecordsByIdentity = (records = []) => {
  const merged = [];
  const byAppointmentId = new Map();
  const byPatientId = new Map();
  const byPatientPhone = new Map();
  const byFingerprint = new Map();

  records.forEach((record) => {
    if (!record || typeof record !== "object") return;

    const appointmentId = readAppointmentId(record);
    const patientId = readPatientId(record);
    const patientPhone = readPatientPhone(record);
    const fingerprint = getAppointmentFingerprint(record);
    const existing =
      (appointmentId && byAppointmentId.get(appointmentId)) ||
      (fingerprint && byFingerprint.get(fingerprint)) ||
      (patientId && byPatientId.get(patientId)) ||
      (patientPhone && byPatientPhone.get(patientPhone));

    if (existing) {
      Object.assign(existing, { ...existing, ...record });
      return;
    }

    const next = { ...record };
    merged.push(next);
    if (appointmentId) byAppointmentId.set(appointmentId, next);
    if (fingerprint) byFingerprint.set(fingerprint, next);
    if (patientId) byPatientId.set(patientId, next);
    if (patientPhone) byPatientPhone.set(patientPhone, next);
  });

  return merged;
};

const requestAppointmentSources = async (paths = []) => {
  const results = await Promise.allSettled(paths.map((path) => requestJson(path)));
  return mergeRecordsByIdentity(
    results.flatMap((result) => (result.status === "fulfilled" ? parseList(result.value) : []))
  );
};

const withBookingTypeFallback = (appointments = [], bookingType = "") =>
  appointments.map((appointment) => ({
    ...appointment,
    bookingType:
      appointment.bookingType ||
      appointment.BookingType ||
      appointment.type ||
      appointment.Type ||
      bookingType,
  }));

export const formatToday = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getOnlineAppointments = async () =>
  withBookingTypeFallback(
    isNurseSession()
      ? await requestAppointmentSources(["Appointment/online", "Appointment", "Nurse/print-queue", "ReceptionistDashboard"])
      : parseList(await requestJsonFallback(["Appointment/online"])),
    "Online"
  );

export const getOfflineAppointments = async () =>
  withBookingTypeFallback(
    isNurseSession()
      ? await requestAppointmentSources(["Appointment/offline", "Appointment", "Nurse/print-queue", "ReceptionistDashboard"])
      : parseList(await requestJsonFallback(["Appointment/offline"])),
    "Offline"
  );
