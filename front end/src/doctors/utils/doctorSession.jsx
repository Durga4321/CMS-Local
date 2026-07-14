export const getAuthToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("doctorToken") ||
  localStorage.getItem("adminToken");

export const decodeJwtPayload = (token) => {
  try {
    const payload = token?.split(".")?.[1];
    if (!payload || typeof atob !== "function") return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(normalized + padding));
  } catch {
    return null;
  }
};

const getClaim = (claims, ...keys) => {
  for (const key of keys) {
    if (claims?.[key] !== undefined && claims?.[key] !== null) {
      return claims[key];
    }
  }

  return "";
};

export const getLoggedInDoctor = () => {
  const token = getAuthToken();
  const claims = decodeJwtPayload(token);

  const id =
    localStorage.getItem("doctorId") ||
    getClaim(claims, "DoctorId", "doctorId");

  const name =
    localStorage.getItem("doctorName") ||
    getClaim(
      claims,
      "name",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
    );

  return {
    id: String(id || "").trim(),
    name: String(name || "").trim(),
    email: localStorage.getItem("doctorEmail") || "",
  };
};

export const normalizeDoctorName = (value) =>
  String(value || "")
    .replace(/^dr\.?\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export const getRecordDoctorId = (record) =>
  record?.doctorId ??
  record?.DoctorId ??
  record?.doctor?.id ??
  record?.doctor?.doctorId ??
  record?.appointment?.doctorId ??
  record?.appointment?.doctor?.id ??
  "";

export const getRecordDoctorName = (record) =>
  record?.doctorName ||
  record?.DoctorName ||
  record?.doctor?.name ||
  record?.doctor?.doctorName ||
  record?.appointment?.doctorName ||
  record?.appointment?.doctor?.name ||
  "";

export const hasDoctorReference = (record) =>
  Boolean(getRecordDoctorId(record) || getRecordDoctorName(record));

export const isAssignedToLoggedInDoctor = (
  record,
  doctor = getLoggedInDoctor()
) => {
  const sessionDoctorId = String(doctor?.id || "").trim();
  const recordDoctorId = String(getRecordDoctorId(record) || "").trim();

  if (sessionDoctorId && recordDoctorId) {
    return recordDoctorId === sessionDoctorId;
  }

  const sessionDoctorName = normalizeDoctorName(doctor?.name);
  const recordDoctorName = normalizeDoctorName(getRecordDoctorName(record));

  if (sessionDoctorName && recordDoctorName) {
    return recordDoctorName === sessionDoctorName;
  }

  return false;
};

export const filterByLoggedInDoctor = (
  records,
  doctor = getLoggedInDoctor()
) => {
  const list = Array.isArray(records) ? records : [];
  if (!doctor?.id && !doctor?.name) return list;

  return list.filter((record) => isAssignedToLoggedInDoctor(record, doctor));
};
