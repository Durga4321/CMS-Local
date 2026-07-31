import { recordAuditLog } from "../pages/SUPERADMIN/superAdminApi";

export const clearAllSessions = () => {
  [
    "token",
    "adminToken",
    "doctorToken",
    "receptionistToken",
    "nurseToken",
    "adminEmail",
    "adminName",
    "doctorEmail",
    "receptionistEmail",
    "nurseEmail",
    "adminRole",
    "doctorRole",
    "receptionistRole",
    "nurseRole",
    "userRole",
    "doctorId",
    "doctorName",
    "receptionistName",
    "nurseName",
    "nurseId",
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
  ].forEach((key) => localStorage.removeItem(key));
};

export const logoutAndClearSessions = async (roleType = "admin") => {
  const role = String(localStorage.getItem("adminRole") || localStorage.getItem("doctorRole") || localStorage.getItem("receptionistRole") || localStorage.getItem("nurseRole") || localStorage.getItem("patientRole") || localStorage.getItem("userRole") || "").trim();
  const name = String(
    localStorage.getItem("adminName") ||
      localStorage.getItem("doctorName") ||
      localStorage.getItem("receptionistName") ||
      localStorage.getItem("nurseName") ||
      localStorage.getItem("patientName") ||
      localStorage.getItem("adminEmail") ||
      localStorage.getItem("doctorEmail") ||
      localStorage.getItem("receptionistEmail") ||
      localStorage.getItem("nurseEmail") ||
      localStorage.getItem("patientEmail") ||
      "User"
  ).trim();
  const ipAddress = String(localStorage.getItem("loginIpAddress") || "").trim();
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
      ? localStorage.getItem("doctorToken")
      : roleType === "receptionist"
        ? localStorage.getItem("receptionistToken")
        : roleType === "nurse"
          ? localStorage.getItem("nurseToken")
        : localStorage.getItem("adminToken");

  return decodeJwtPayload(roleToken || localStorage.getItem("token"));
};

const getProfileEmail = (storedKey, claims, fallback) =>
  localStorage.getItem(storedKey) ||
  getClaim(
    claims,
    "email",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
  ) ||
  fallback;

const getProfileName = (storedKey, email, claims, fallback) => {
  const storedName = String(localStorage.getItem(storedKey) || "").trim();
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
  localStorage.getItem("branchName") ||
  localStorage.getItem("BranchName") ||
  getClaim(claims, "BranchName", "branchName", "Branch", "branch") ||
  "";

export const getRoleProfile = (roleType = "admin") => {
  if (roleType === "doctor") {
    const claims = getSessionClaims(roleType);
    const email = getProfileEmail("doctorEmail", claims, "doctor account");
    const name = getProfileName("doctorName", email, claims, "Doctor");
    return {
      roleType,
      roleLabel: "Doctor",
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
    return {
      roleType,
      roleLabel: "Receptionist",
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
    return {
      roleType,
      roleLabel: "Nurse",
      name: getProfileName("nurseName", email, claims, "Nurse"),
      email,
      branchName: getProfileBranchName(claims),
      profilePath: "/nurse/profile",
      passwordPath: "/nurse/profile?tab=password",
    };
  }

  const claims = getSessionClaims(roleType);
  const email = getProfileEmail("adminEmail", claims, "admin account");
  const role = localStorage.getItem("adminRole") || "Admin";
  const normalizedRole = String(role).toLowerCase();
  const roleLabel =
    normalizedRole === "superadmin" || normalizedRole === "super_admin"
      ? "Super Admin"
      : "Admin";

  return {
    roleType: "admin",
    roleLabel,
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

