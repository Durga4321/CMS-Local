const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const readValue = (source, key) => {
  if (!source || typeof source !== "object") return "";
  const parts = String(key).split(".");
  let current = source;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return "";
    }
    current = current[part];
  }

  return current ?? "";
};

export const getAppointmentValue = (item, keys, fallback = "") => {
  for (const key of keys) {
    const value = readValue(item, key);
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return fallback;
};

export const getBookingType = (item) => {
  const value = getAppointmentValue(item, ["bookingType", "BookingType", "type", "Type"], "");
  const normalized = normalizeText(value);

  if (normalized === "online") return "Online";
  if (normalized === "offline") return "Offline";
  return value || "Unknown";
};

export const filterAppointments = (appointments = [], filters = {}) => {
  const search = normalizeText(filters.search || "");
  const doctor = normalizeText(filters.doctor || "");
  const status = normalizeText(filters.status || "");
  const date = normalizeText(filters.date || "");

  return appointments.filter((item) => {
    if (doctor && normalizeText(getAppointmentValue(item, ["doctorName", "doctor.name", "DoctorName", "doctor", "doctorDetails.name"], "")) !== doctor) {
      return false;
    }

    if (status && normalizeText(getAppointmentValue(item, ["status", "appointmentStatus", "AppointmentStatus", "Status"], "")) !== status) {
      return false;
    }

    if (date) {
      const appointmentDate = normalizeText(
        getAppointmentValue(item, ["date", "appointmentDate", "AppointmentDate", "scheduledDate", "slotDate"], "")
      );
      if (!appointmentDate.includes(date)) {
        return false;
      }
    }

    if (!search) return true;

    const searchable = [
      getAppointmentValue(item, ["tokenNumber", "token", "tokenNo", "TokenNumber"], ""),
      getAppointmentValue(item, ["patientCode", "patient.code", "PatientCode"], ""),
      getAppointmentValue(item, ["patientName", "patient.name", "PatientName"], ""),
      getAppointmentValue(item, ["doctorName", "doctor.name", "DoctorName"], ""),
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(search);
  });
};
