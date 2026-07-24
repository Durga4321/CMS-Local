const STORAGE_KEY = "cmsAppointmentVitals";

export const getAppointmentRecordId = (appointment = {}) =>
  String(
    appointment.appointmentId ??
      appointment.AppointmentId ??
      appointment.id ??
      appointment.Id ??
      appointment.appointment?.id ??
      appointment.appointment?.appointmentId ??
      appointment.Appointment?.Id ??
      appointment.Appointment?.AppointmentId ??
      ""
  ).trim();

const firstValue = (...values) =>
  values
    .map((value) => String(value ?? "").trim())
    .find(Boolean) || "";

const getAppointmentDate = (appointment = {}) =>
  firstValue(
    appointment.date,
    appointment.appointmentDate,
    appointment.AppointmentDate,
    appointment.scheduledDate,
    appointment.appointment?.date,
    appointment.Appointment?.Date
  ).slice(0, 10);

const normalizeKeyText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

export const getAppointmentVitalKeys = (appointment = {}) => {
  const keys = new Set();
  const appointmentId = getAppointmentRecordId(appointment);
  const token = firstValue(
    appointment.tokenNumber,
    appointment.TokenNumber,
    appointment.token,
    appointment.tokenNo,
    appointment.appointment?.tokenNumber,
    appointment.Appointment?.TokenNumber
  );
  const patientId = firstValue(
    appointment.patientId,
    appointment.PatientId,
    appointment.patient?.id,
    appointment.Patient?.Id,
    appointment.patient?.patientId,
    appointment.Patient?.PatientId
  );
  const patientCode = firstValue(
    appointment.patientCode,
    appointment.PatientCode,
    appointment.pid,
    appointment.PID,
    appointment.patient?.patientCode,
    appointment.Patient?.PatientCode,
    appointment.patient?.pid,
    appointment.Patient?.PID
  );
  const patientName = normalizeKeyText(
    firstValue(
      appointment.patientName,
      appointment.PatientName,
      appointment.name,
      appointment.patient?.name,
      appointment.patient?.fullName,
      appointment.Patient?.Name,
      appointment.Patient?.FullName
    )
  );
  const doctorId = firstValue(
    appointment.doctorId,
    appointment.DoctorId,
    appointment.doctor?.id,
    appointment.Doctor?.Id,
    appointment.doctor?.doctorId,
    appointment.Doctor?.DoctorId
  );
  const date = getAppointmentDate(appointment);

  [appointmentId, token].filter(Boolean).forEach((value) => keys.add(value));
  if (patientId && date) keys.add(`patient:${patientId}:${date}`);
  if (patientCode && date) keys.add(`patient-code:${patientCode}:${date}`);
  if (patientName) keys.add(`patient-name:${patientName}`);
  if (patientName && date) keys.add(`patient-name:${patientName}:${date}`);
  if (patientId && doctorId && date) keys.add(`patient:${patientId}:doctor:${doctorId}:${date}`);
  if (patientCode && doctorId && date) keys.add(`patient-code:${patientCode}:doctor:${doctorId}:${date}`);
  if (patientName && doctorId && date) keys.add(`patient-name:${patientName}:doctor:${doctorId}:${date}`);

  return Array.from(keys);
};

const readVitalsStore = () => {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
};

const writeVitalsStore = (store) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage failures; callers still keep the in-memory updated record.
  }
};

export const getStoredAppointmentVitals = (appointmentId) => {
  const key = String(appointmentId || "").trim();
  if (!key) return null;

  return readVitalsStore()[key] || null;
};

export const saveStoredAppointmentVitals = (appointmentOrId, vitals) => {
  const keys =
    typeof appointmentOrId === "object"
      ? getAppointmentVitalKeys(appointmentOrId)
      : [String(appointmentOrId || "").trim()].filter(Boolean);
  if (!keys.length || !vitals || typeof vitals !== "object") return;

  const store = readVitalsStore();
  keys.forEach((key) => {
    store[key] = {
      ...(store[key] || {}),
      ...vitals,
      vitals: {
        ...(store[key]?.vitals || {}),
        ...(vitals.vitals || vitals),
      },
      updatedAt: new Date().toISOString(),
    };
  });
  writeVitalsStore(store);
};

export const mergeStoredAppointmentVitals = (appointment = {}) => {
  const store = readVitalsStore();
  const storedVitals = getAppointmentVitalKeys(appointment)
    .map((key) => store[key])
    .find(Boolean);

  return storedVitals ? { ...appointment, ...storedVitals } : appointment;
};
