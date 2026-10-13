import { decodeJwtPayload, getClaim } from "../Recepitionist/receptionSession";

export const getPharmacistToken = () =>
  localStorage.getItem("pharmacistToken") || localStorage.getItem("token") || "";

export const getPharmacistProfile = () => {
  const token = getPharmacistToken();
  const claims = decodeJwtPayload(token);
  const email = localStorage.getItem("pharmacistEmail") || getClaim(claims, "email") || "";
  const name =
    localStorage.getItem("pharmacistName") ||
    getClaim(claims, "name", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name") ||
    email ||
    "Pharmacist";
  const hospitalName =
    localStorage.getItem("hospitalName") ||
    localStorage.getItem("clinicName") ||
    getClaim(claims, "HospitalName", "hospitalName", "ClinicName", "clinicName") ||
    "";
  const hospitalId =
    localStorage.getItem("hospitalId") ||
    localStorage.getItem("clinicId") ||
    getClaim(claims, "HospitalId", "hospitalId", "ClinicId", "clinicId") ||
    "";
  const branchName =
    localStorage.getItem("branchName") ||
    localStorage.getItem("BranchName") ||
    getClaim(claims, "BranchName", "branchName", "Branch", "branch") ||
    "";
  const branchId =
    localStorage.getItem("branchId") ||
    getClaim(claims, "BranchId", "branchId", "BranchID", "branchID") ||
    "";
  const id =
    localStorage.getItem("pharmacistId") ||
    localStorage.getItem("userId") ||
    getClaim(claims, "PharmacistId", "pharmacistId", "UserId", "userId", "sub") ||
    "";

  return {
    token,
    id: String(id),
    userId: String(id),
    pharmacistId: String(id),
    email,
    name,
    role: localStorage.getItem("pharmacistRole") || "Pharmacist",
    hospitalId: String(hospitalId),
    hospitalName,
    branchName,
    branchId: String(branchId),
  };
};

export const isPharmacistSession = () => {
  const token = getPharmacistToken();
  const claims = decodeJwtPayload(token);
  const role =
    localStorage.getItem("pharmacistRole") ||
    localStorage.getItem("userRole") ||
    getClaim(claims, "role", "http://schemas.microsoft.com/ws/2008/06/identity/claims/role");
  return String(role || "").toLowerCase().replace(/[^a-z0-9]+/g, "") === "pharmacist";
};
