const CLINIC_ID_NAME_OVERRIDES = {
  3: "NRI",
};

const cleanText = (value) => {
  const text = String(value ?? "").trim();
  return text && text.toLowerCase() !== "string" ? text : "";
};

export const formatClinicName = (value, fallback = "") => {
  const text = cleanText(value) || cleanText(fallback);
  if (!text) return "";

  const alwaysUpper = new Set(["nri", "vims", "cms", "opd", "icu", "ent"]);
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => {
      const lower = word.toLowerCase();
      if (alwaysUpper.has(lower)) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
};

export const getStoredClinicName = () =>
  formatClinicName(
    cleanText(localStorage.getItem("hospitalName")) ||
      cleanText(localStorage.getItem("clinicName")) ||
      cleanText(localStorage.getItem("assignedClinic"))
  );

export const getClinicNameFromRecord = (record = {}) =>
  formatClinicName(
    cleanText(record.hospitalName) ||
      cleanText(record.clinicName) ||
      cleanText(record.clinic) ||
      cleanText(record.assignedClinic) ||
      cleanText(record.hospital?.name) ||
      cleanText(record.clinicDetails?.name)
  );

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
    return formatClinicName(CLINIC_ID_NAME_OVERRIDES[id]);
  }

  return formatClinicName(fallback, "Clinic") || "Clinic";
};
