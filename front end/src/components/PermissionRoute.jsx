import React, { useMemo } from "react";
import { Navigate } from "react-router-dom";
import { getRoleProfile } from "../profile/sessionProfile";
import { getLabProfile } from "../Lab/labSession";
import { getNurseProfile } from "../Nurse/nurseSession";
import { getReceptionistProfile } from "../Recepitionist/receptionSession";
import { getLoggedInDoctor } from "../doctors/utils/doctorSession";
import {
  hasAnyModulePermission,
  hasAnySavedModulePermissions,
  useRolePermissionsSync,
} from "../utils/rolePermissions";

const ROLE_FALLBACK_ROUTES = {
  doctor: [
    { module: "Dashboard", to: "/doctor/dashboard" },
    { module: "Consultation", to: "/doctor/consultation" },
    { module: "Prescription", to: "/doctor/prescription" },
    { module: "Appointments", to: "/doctor/appointments" },
    { module: "My Schedule", to: "/doctor/schedule" },
  ],
  receptionist: [
    { module: "Reception Dashboard", to: "/reception/dashboard" },
    { module: "Patients", to: "/reception/patients" },
    { module: ["Appointments", "Book Appointment"], to: "/reception/appointments" },
    { module: "Billing", to: "/reception/billing" },
  ],
  nurse: [
    { module: "Nurse Dashboard", to: "/nurse/dashboard" },
    { module: "Patients", to: "/nurse/patients" },
    { module: "Medical History", to: "/nurse/medical-history" },
    { module: ["Appointments", "Book Appointment"], to: "/nurse/appointments" },
    { module: "Online Bookings", to: "/nurse/appointments/online" },
    { module: "Offline Bookings", to: "/nurse/appointments/offline" },
    { module: "Billing", to: "/nurse/billing" },
  ],
  lab: [
    { module: "Lab Dashboard", to: "/lab/dashboard" },
    { module: "Patients", to: "/lab/patients" },
    { module: "Diagnosis Tests", to: "/lab/diagnosis-tests" },
    { module: "Sample Collection", to: "/lab/sample-collection" },
    { module: "Create Report", to: "/lab/report-create" },
    { module: "Reports", to: "/lab/reports" },
  ],
  admin: [
    { module: "Dashboard", to: "/dashboard" },
    { module: "Receptionists", to: "/receptionists" },
    { module: "Nurses", to: "/nurses" },
    { module: "Lab Technicians", to: "/lab-technicians" },
    { module: "Patients", to: "/patients" },
    { module: "Appointments", to: "/appointments" },
    { module: "Reports", to: "/reports" },
  ],
};

const getPermissionProfile = (roleType = "admin") => {
  if (roleType === "receptionist") return getReceptionistProfile();
  if (roleType === "nurse") return getNurseProfile();
  if (roleType === "lab") return getLabProfile();
  if (roleType === "doctor") {
    const profile = getRoleProfile("doctor");
    const doctor = getLoggedInDoctor();
    return {
      ...profile,
      id: doctor.id || profile.id,
      userId: doctor.id || profile.userId,
      email: doctor.email || profile.email,
      name: doctor.name || profile.name,
    };
  }
  return getRoleProfile(roleType);
};

const getFallbackPath = (roleType = "admin", profile = {}) => {
  const routes = ROLE_FALLBACK_ROUTES[roleType] || ROLE_FALLBACK_ROUTES.admin;
  return routes.find((route) => hasAnyModulePermission(profile, route.module, "View"))?.to || null;
};

function PermissionRoute({ roleType, module, children }) {
  const profile = useMemo(() => getPermissionProfile(roleType), [roleType]);
  const { loading: permissionsLoading } = useRolePermissionsSync(profile);
  const hasSavedPermissions = hasAnySavedModulePermissions(profile);
  if (permissionsLoading && !hasSavedPermissions) {
    return <div className="app-route-loading">Loading...</div>;
  }
  const allowed = !hasSavedPermissions || hasAnyModulePermission(profile, module, "View");

  if (!allowed) {
    return <Navigate to={getFallbackPath(roleType, profile) || "/"} replace />;
  }

  return children;
}

export default PermissionRoute;
