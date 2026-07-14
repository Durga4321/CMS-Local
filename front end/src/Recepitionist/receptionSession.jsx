export const RECEPTIONIST_ROLE = "receptionist";

export const getReceptionToken = () =>
  localStorage.getItem("receptionistToken") || localStorage.getItem("token");

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

export const getClaim = (claims, ...keys) => {
  for (const key of keys) {
    if (claims?.[key] !== undefined && claims?.[key] !== null) return claims[key];
  }

  return "";
};

export const getReceptionistProfile = () => {
  const token = getReceptionToken();
  const claims = decodeJwtPayload(token);
  const email =
    localStorage.getItem("receptionistEmail") || getClaim(claims, "email") || "";
  const name =
    localStorage.getItem("receptionistName") ||
    getClaim(
      claims,
      "name",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
    ) ||
    email;
  const hospitalName =
    localStorage.getItem("hospitalName") ||
    localStorage.getItem("clinicName") ||
    getClaim(claims, "HospitalName", "hospitalName", "ClinicName", "clinicName") ||
    "";
  const hospitalId =
    localStorage.getItem("hospitalId") ||
    localStorage.getItem("clinicId") ||
    getClaim(
      claims,
      "HospitalId",
      "hospitalId",
      "ClinicId",
      "clinicId",
      "hospital_id",
      "clinic_id"
    ) ||
    "";

  return {
    token,
    email,
    name,
    role: localStorage.getItem("receptionistRole") || "Receptionist",
    hospitalId: String(hospitalId),
    hospitalName,
  };
};

export const isReceptionistSession = () => {
  const token = getReceptionToken();
  const claims = decodeJwtPayload(token);
  const role =
    localStorage.getItem("receptionistRole") ||
    localStorage.getItem("userRole") ||
    getClaim(
      claims,
      "role",
      "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
    );

  return String(role || "").toLowerCase() === RECEPTIONIST_ROLE;
};

