import { recordAuditLog } from "../pages/SUPERADMIN/superAdminApi";

const getSessionValue = (key) =>
  sessionStorage.getItem(key) || localStorage.getItem(key) || "";

export const clearAllSessions = () => {
  [
    "token",
    "adminToken",
    "doctorToken",
    "receptionistToken",
    "nurseToken",
    "labToken",
    "adminEmail",
    "adminName",
    "doctorEmail",
    "receptionistEmail",
    "nurseEmail",
    "labEmail",
    "adminRole",
    "adminId",
    "adminUserId",
    "doctorRole",
    "receptionistRole",
    "nurseRole",
    "labRole",
    "userRole",
    "doctorId",
    "doctorName",
    "receptionistName",
    "nurseName",
    "nurseId",
    "labName",
    "labId",
    "hospitalId",
    "hospitalName",
    "clinicName",
    "assignedClinic",
    "branchId",
    "branchName",
    "BranchName",
    "patientToken",
    "patientRole",
    "patientEmail",
    "patientName",
    "patientId",
    "loginIpAddress",
  ].forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
};

export const logoutAndClearSessions = async (roleType = "admin") => {
  const role = String(getSessionValue("adminRole") || getSessionValue("doctorRole") || getSessionValue("receptionistRole") || getSessionValue("nurseRole") || getSessionValue("labRole") || getSessionValue("patientRole") || getSessionValue("userRole") || "").trim();
  const name = String(
    getSessionValue("adminName") ||
      getSessionValue("doctorName") ||
      getSessionValue("receptionistName") ||
      getSessionValue("nurseName") ||
      getSessionValue("labName") ||
      getSessionValue("patientName") ||
      getSessionValue("adminEmail") ||
      getSessionValue("doctorEmail") ||
      getSessionValue("receptionistEmail") ||
      getSessionValue("nurseEmail") ||
      getSessionValue("labEmail") ||
      getSessionValue("patientEmail") ||
      "User"
  ).trim();
  const ipAddress = String(getSessionValue("loginIpAddress") || "").trim();
  const payload = {
      userName: name,
      action: `${name} logged out`,
      systemAction: "Logout",
      role: role || roleType,
      ipAddress,
      timestamp: new Date().toISOString(),
  };

  clearAllSessions();
  window.setTimeout(() => {
    recordAuditLog(payload).catch(() => {});
  }, 0);
};

const decodeJwtPayload = (token) => {
  try {
    const payload = String(token || "").split(".")[1];
    if (!payload || typeof atob !== "function") return {};

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(normalized + padding));
  } catch {
    return {};
  }
};

const getClaim = (claims, ...keys) => {
  for (const key of keys) {
    const value = String(claims?.[key] || "").trim();
    if (value) return value;
  }

  return "";
};

const getSessionClaims = (roleType) => {
  const roleToken =
    roleType === "doctor"
      ? getSessionValue("doctorToken")
      : roleType === "receptionist"
        ? getSessionValue("receptionistToken")
        : roleType === "nurse"
          ? getSessionValue("nurseToken")
          : roleType === "lab"
            ? getSessionValue("labToken")
        : getSessionValue("adminToken");

  return decodeJwtPayload(roleToken || getSessionValue("token"));
};

const getProfileEmail = (storedKey, claims, fallback) =>
  getSessionValue(storedKey) ||
  getClaim(
    claims,
    "email",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
  ) ||
  fallback;

const getProfileName = (storedKey, email, claims, fallback) => {
  const storedName = String(getSessionValue(storedKey) || "").trim();
  const tokenName = getClaim(
    claims,
    "name",
    "unique_name",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
  );
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (storedName && storedName.toLowerCase() !== normalizedEmail) return storedName;
  if (tokenName && tokenName.toLowerCase() !== normalizedEmail) return tokenName;
  return fallback;
};

const getProfileBranchName = (claims) =>
  getSessionValue("doctorBranchName") ||
  getSessionValue("DoctorBranchName") ||
  getSessionValue("branchName") ||
  getSessionValue("BranchName") ||
  getClaim(claims, "BranchName", "branchName", "Branch", "branch") ||
  "";

export const getRoleProfile = (roleType = "admin") => {
  if (roleType === "doctor") {
    const claims = getSessionClaims(roleType);
    const email = getProfileEmail("doctorEmail", claims, "doctor account");
    const name = getProfileName("doctorName", email, claims, "Doctor");
    const id =
      getSessionValue("userId") ||
      getSessionValue("doctorId") ||
      getClaim(claims, "doctorId", "DoctorId", "userId", "UserId", "sub", "nameid", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
    const doctorId = getSessionValue("doctorId") || getClaim(claims, "doctorId", "DoctorId");
    return {
      roleType,
      roleLabel: "Doctor",
      id,
      userId: id,
      doctorId,
      name: `Dr. ${name}`.replace(/^Dr\. Dr\./, "Dr."),
      email,
      branchName: getProfileBranchName(claims),
      profilePath: "/doctor/profile",
      passwordPath: "/doctor/profile?tab=password",
    };
  }

  if (roleType === "receptionist") {
    const claims = getSessionClaims(roleType);
    const email = getProfileEmail("receptionistEmail", claims, "receptionist account");
    const id =
      getSessionValue("userId") ||
      getSessionValue("receptionistId") ||
      getClaim(claims, "receptionistId", "ReceptionistId", "userId", "UserId", "sub", "nameid", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
    const receptionistId = getSessionValue("receptionistId") || getClaim(claims, "receptionistId", "ReceptionistId");
    return {
      roleType,
      roleLabel: "Receptionist",
      id,
      userId: id,
      receptionistId,
      name: getProfileName("receptionistName", email, claims, "Receptionist"),
      email,
      branchName: getProfileBranchName(claims),
      profilePath: "/reception/profile",
      passwordPath: "/reception/profile?tab=password",
    };
  }

  if (roleType === "nurse") {
    const claims = getSessionClaims(roleType);
    const email = getProfileEmail("nurseEmail", claims, "nurse account");
    const id =
      getSessionValue("userId") ||
      getSessionValue("nurseId") ||
      getClaim(claims, "nurseId", "NurseId", "userId", "UserId", "sub", "nameid", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
    const nurseId = getSessionValue("nurseId") || getClaim(claims, "nurseId", "NurseId");
    return {
      roleType,
      roleLabel: "Nurse",
      id,
      userId: id,
      nurseId,
      name: getProfileName("nurseName", email, claims, "Nurse"),
      email,
      branchName: getProfileBranchName(claims),
      profilePath: "/nurse/profile",
      passwordPath: "/nurse/profile?tab=password",
    };
  }

  if (roleType === "lab") {
    const claims = getSessionClaims(roleType);
    const email = getProfileEmail("labEmail", claims, "lab account");
    const id =
      getSessionValue("userId") ||
      getSessionValue("labTechnicianId") ||
      getSessionValue("labId") ||
      getClaim(claims, "labTechnicianId", "LabTechnicianId", "labId", "LabId", "userId", "UserId", "sub", "nameid", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
    const labId = getSessionValue("labTechnicianId") || getSessionValue("labId") || getClaim(claims, "labTechnicianId", "LabTechnicianId", "labId", "LabId");
    return {
      roleType,
      roleLabel: "Lab Technician",
      id,
      userId: id,
      labId,
      labTechnicianId: labId,
      name: getProfileName("labName", email, claims, "Lab Technician"),
      email,
      branchName: getProfileBranchName(claims),
      profilePath: "/lab/profile",
      passwordPath: "/lab/profile?tab=password",
    };
  }

  const claims = getSessionClaims(roleType);
  const email = getProfileEmail("adminEmail", claims, "admin account");
  const role = getSessionValue("adminRole") || "Admin";
  const normalizedRole = String(role).toLowerCase();
  const roleLabel =
    normalizedRole === "superadmin" || normalizedRole === "super_admin"
      ? "Super Admin"
      : "Admin";
  const adminUserId =
    getSessionValue("adminUserId") ||
    getSessionValue("adminId") ||
    getSessionValue("userId") ||
    getClaim(
      claims,
      "adminUserId",
      "AdminUserId",
      "adminUserID",
      "AdminUserID",
      "adminId",
      "AdminId",
      "userId",
      "UserId",
      "sub",
      "nameid",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
    );

  return {
    roleType: "admin",
    roleLabel,
    id: adminUserId,
    adminUserId,
    userId:
      getSessionValue("userId") ||
      adminUserId,
    hospitalId:
      getSessionValue("hospitalId") ||
      getSessionValue("clinicId") ||
      getClaim(claims, "hospitalId", "HospitalId", "clinicId", "ClinicId"),
    name: getProfileName("adminName", email, claims, roleLabel),
    email,
    branchName: getProfileBranchName(claims),
    profilePath: "/profile",
    passwordPath: "/profile?tab=password",
  };
};

export const getInitials = (value) =>
  String(value || "U")
    .replace(/^Dr\.\s*/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

