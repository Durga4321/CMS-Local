import { decodeJwtPayload, getClaim } from "../Recepitionist/receptionSession";

export const NURSE_ROLE = "nurse";

export const getNurseToken = () =>
  localStorage.getItem("nurseToken") || localStorage.getItem("token") || "";

export const getNurseProfile = () => {
  const token = getNurseToken();
  const claims = decodeJwtPayload(token);
  const email = localStorage.getItem("nurseEmail") || getClaim(claims, "email") || "";
  const name =
    localStorage.getItem("nurseName") ||
    getClaim(claims, "name", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name") ||
    email ||
    "Nurse";
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

  return {
    token,
    email,
    name,
    role: localStorage.getItem("nurseRole") || "Nurse",
    hospitalId: String(hospitalId),
    hospitalName,
    branchName,
    branchId: String(branchId),
  };
};

export const isNurseSession = () => {
  const token = getNurseToken();
  const claims = decodeJwtPayload(token);
  const role =
    localStorage.getItem("nurseRole") ||
    localStorage.getItem("userRole") ||
    getClaim(claims, "role", "http://schemas.microsoft.com/ws/2008/06/identity/claims/role");

  return String(role || "").toLowerCase() === NURSE_ROLE;
};
