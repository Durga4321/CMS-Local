const DATE_FIELD_KEYS = [
  "date",
  "Date",
  "appointmentDate",
  "AppointmentDate",
  "scheduledDate",
  "ScheduledDate",
  "slotDate",
  "SlotDate",
  "bookingDate",
  "BookingDate",
  "visitDate",
  "VisitDate",
];

const DOCTOR_ID_KEYS = ["doctorId", "DoctorId", "doctor.id", "doctor.doctorId", "Doctor.Id", "Doctor.DoctorId"];
const DOCTOR_NAME_KEYS = ["doctorName", "DoctorName", "doctor.name", "doctor.doctorName", "Doctor.Name", "Doctor.DoctorName"];
const PATIENT_ID_KEYS = ["patientId", "PatientId", "patient.id", "patient.patientId", "Patient.Id", "Patient.PatientId"];
const PATIENT_NAME_KEYS = ["patientName", "PatientName", "name", "Name", "patient.name", "patient.patientName", "Patient.Name"];
const PATIENT_PHONE_KEYS = [
  "phone",
  "Phone",
  "phoneNumber",
  "PhoneNumber",
  "mobile",
  "Mobile",
  "mobileNumber",
  "MobileNumber",
  "patient.phone",
  "patient.Phone",
  "patient.phoneNumber",
  "patient.PhoneNumber",
  "patient.mobile",
  "patient.mobileNumber",
  "Patient.Phone",
  "Patient.PhoneNumber",
  "Patient.MobileNumber",
];

const getNestedValue = (record, path) => {
  if (!record || typeof record !== "object") return undefined;
  return String(path)
    .split(".")
    .reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), record);
};

const readFirst = (record, keys) => {
  for (const key of keys) {
    const value = getNestedValue(record, key);
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
};

export const normalizeAppointmentPhone = (value) => String(value || "").replace(/\D/g, "").slice(-10);

export const normalizeAppointmentName = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

export const normalizeAppointmentDoctor = (value) =>
  String(value || "")
    .trim()
    .replace(/^dr\.?\s+/i, "")
    .replace(/\s+/g, " ")
    .toLowerCase();

export const normalizeAppointmentDateKey = (value) => {
  if (!value) return "";
  const text = String(value).trim();
  const dmyMatch = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const isoPrefix = text.match(/^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.0+)?(?:Z)?$/i);
  if (isoPrefix) return isoPrefix[1];
  const parsed = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : `${text}Z`);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return text.split("T")[0];
};

export const getAppointmentDateKey = (appointment) =>
  normalizeAppointmentDateKey(readFirst(appointment, DATE_FIELD_KEYS));

export const hasDuplicateAppointmentForPatientDoctorDate = (
  appointments = [],
  { patientId, patientName, phone, doctorId, doctorName, date } = {}
) => {
  const targetDate = normalizeAppointmentDateKey(date);
  const targetDoctorId = String(doctorId || "").trim();
  const targetDoctorName = normalizeAppointmentDoctor(doctorName);
  const targetPatientId = String(patientId || "").trim();
  const targetPatientName = normalizeAppointmentName(patientName);
  const targetPhone = normalizeAppointmentPhone(phone);

  if (!targetDate || (!targetDoctorId && !targetDoctorName)) return false;
  if (!targetPatientId && (!targetPatientName || !targetPhone)) return false;

  return (Array.isArray(appointments) ? appointments : []).some((appointment) => {
    const appointmentDate = getAppointmentDateKey(appointment);
    if (appointmentDate !== targetDate) return false;

    const appointmentDoctorId = String(readFirst(appointment, DOCTOR_ID_KEYS) || "").trim();
    const appointmentDoctorName = normalizeAppointmentDoctor(readFirst(appointment, DOCTOR_NAME_KEYS));
    const sameDoctor =
      (targetDoctorId && appointmentDoctorId && targetDoctorId === appointmentDoctorId) ||
      (targetDoctorName && appointmentDoctorName && targetDoctorName === appointmentDoctorName);
    if (!sameDoctor) return false;

    const appointmentPatientId = String(readFirst(appointment, PATIENT_ID_KEYS) || "").trim();
    if (targetPatientId && appointmentPatientId && targetPatientId === appointmentPatientId) {
      return true;
    }

    const appointmentPatientName = normalizeAppointmentName(readFirst(appointment, PATIENT_NAME_KEYS));
    const appointmentPhone = normalizeAppointmentPhone(readFirst(appointment, PATIENT_PHONE_KEYS));
    return Boolean(
      targetPatientName &&
        targetPhone &&
        appointmentPatientName &&
        appointmentPhone &&
        targetPatientName === appointmentPatientName &&
        targetPhone === appointmentPhone
    );
  });
};

export const DUPLICATE_APPOINTMENT_MESSAGE =
  "This patient already has an appointment with the same doctor on this date.";
