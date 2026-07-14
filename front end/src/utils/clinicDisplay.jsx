const CLINIC_ID_NAME_OVERRIDES = {
  3: "NRI",
};

const cleanText = (value) => {
  const text = String(value ?? "").trim();
  return text && text.toLowerCase() !== "string" ? text : "";
};

export const getStoredClinicName = () =>
  cleanText(localStorage.getItem("hospitalName")) ||
  cleanText(localStorage.getItem("clinicName")) ||
  cleanText(localStorage.getItem("assignedClinic"));

export const getClinicNameFromRecord = (record = {}) =>
  cleanText(record.hospitalName) ||
  cleanText(record.clinicName) ||
  cleanText(record.clinic) ||
  cleanText(record.assignedClinic) ||
  cleanText(record.hospital?.name) ||
  cleanText(record.clinicDetails?.name);

export const getClinicIdFromRecord = (record = {}) =>
  cleanText(record.hospitalId) ||
  cleanText(record.clinicId) ||
  cleanText(record.assignedClinicId) ||
  cleanText(record.hospitalID) ||
  cleanText(record.clinicID);

export const getClinicDisplayName = (record = {}, fallback = "Clinic") => {
  const directName = getClinicNameFromRecord(record) || getStoredClinicName();
  if (directName) return directName;

  const id = getClinicIdFromRecord(record) || cleanText(localStorage.getItem("hospitalId"));
  if (id && CLINIC_ID_NAME_OVERRIDES[id]) {
    return CLINIC_ID_NAME_OVERRIDES[id];
  }

  return fallback;
};
