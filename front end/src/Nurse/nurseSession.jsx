import { decodeJwtPayload, getClaim } from "../Recepitionist/receptionSession";

export const NURSE_ROLE = "nurse";

const sessionValue = (key) => sessionStorage.getItem(key) || localStorage.getItem(key) || "";

export const getNurseToken = () => sessionValue("nurseToken") || sessionValue("token");

export const getNurseProfile = () => {
  const token = getNurseToken();
  const claims = decodeJwtPayload(token);
  const email = sessionValue("nurseEmail") || getClaim(claims, "email") || "";
  const name =
    sessionValue("nurseName") ||
    getClaim(claims, "name", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name") ||
    email ||
    "Nurse";
  const hospitalName =
    sessionValue("hospitalName") ||
    sessionValue("clinicName") ||
    getClaim(claims, "HospitalName", "hospitalName", "ClinicName", "clinicName") ||
    "";
  const hospitalId =
    getClaim(claims, "HospitalId", "hospitalId", "ClinicId", "clinicId") ||
    sessionValue("nurseHospitalId") ||
    sessionValue("hospitalId") ||
    sessionValue("clinicId") ||
    "";
  const branchName =
    getClaim(claims, "BranchName", "branchName", "Branch", "branch") ||
    sessionValue("nurseBranchName") ||
    sessionValue("branchName") ||
    sessionValue("BranchName") ||
    "";
  const branchId =
    getClaim(claims, "BranchId", "branchId", "BranchID", "branchID") ||
    sessionValue("nurseBranchId") ||
    sessionValue("branchId") ||
    "";
  const id =
    sessionValue("nurseId") ||
    sessionValue("userId") ||
    getClaim(claims, "NurseId", "nurseId", "UserId", "userId", "sub") ||
    "";

  return {
    token,
    id: String(id),
    userId: String(id),
    email,
    name,
    role: sessionValue("nurseRole") || "Nurse",
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
    sessionValue("nurseRole") ||
    sessionValue("userRole") ||
    getClaim(claims, "role", "http://schemas.microsoft.com/ws/2008/06/identity/claims/role");

  return String(role || "").toLowerCase() === NURSE_ROLE;
};
