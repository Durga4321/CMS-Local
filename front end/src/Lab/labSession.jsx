import { decodeJwtPayload, getClaim } from "../Recepitionist/receptionSession";

export const LAB_ROLE = "labtechnician";

export const getLabToken = () =>
  localStorage.getItem("labToken") || localStorage.getItem("token") || "";

export const getLabProfile = () => {
  const token = getLabToken();
  const claims = decodeJwtPayload(token);
  const email = localStorage.getItem("labEmail") || getClaim(claims, "email") || "";
  const name =
    localStorage.getItem("labName") ||
    getClaim(claims, "name", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name") ||
    email ||
    "Lab Technician";
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
    localStorage.getItem("labTechnicianId") ||
    localStorage.getItem("labId") ||
    localStorage.getItem("userId") ||
    getClaim(claims, "LabTechnicianId", "labTechnicianId", "LabId", "labId", "UserId", "userId", "sub") ||
    "";

  return {
    token,
    id: String(id),
    userId: String(id),
    email,
    name,
    role: localStorage.getItem("labRole") || "Lab Technician",
    hospitalId: String(hospitalId),
    hospitalName,
    hospitalAddress: localStorage.getItem("hospitalAddress") || localStorage.getItem("clinicAddress") || "",
    hospitalPhone: localStorage.getItem("hospitalPhone") || localStorage.getItem("clinicPhone") || localStorage.getItem("contactNumber") || "",
    hospitalEmail: localStorage.getItem("hospitalEmail") || localStorage.getItem("clinicEmail") || "",
    branchName,
    branchId: String(branchId),
    branchAddress: localStorage.getItem("branchAddress") || "",
    branchPhone: localStorage.getItem("branchPhone") || "",
  };
};

export const isLabSession = () => {
  const token = getLabToken();
  const claims = decodeJwtPayload(token);
  const role =
    localStorage.getItem("labRole") ||
    localStorage.getItem("userRole") ||
    getClaim(claims, "role", "http://schemas.microsoft.com/ws/2008/06/identity/claims/role");
  const normalized = String(role || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

  return normalized === LAB_ROLE || normalized === "lab" || normalized === "laboratory";
};
