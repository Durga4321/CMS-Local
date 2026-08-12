import React, { useMemo } from "react";
import { Navigate } from "react-router-dom";
import { getRoleProfile } from "../profile/sessionProfile";
import { getLabProfile } from "../Lab/labSession";
import { getNurseProfile } from "../Nurse/nurseSession";
import { getReceptionistProfile } from "../Recepitionist/receptionSession";
import { getLoggedInDoctor } from "../doctors/utils/doctorSession";
import { hasAnySavedModulePermissions, hasModulePermission } from "../utils/rolePermissions";

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

function PermissionRoute({ roleType, module, children }) {
  const profile = useMemo(() => getPermissionProfile(roleType), [roleType]);
  const hasSavedPermissions = hasAnySavedModulePermissions(profile);
  const allowed = !hasSavedPermissions || hasModulePermission(profile, module, "View");

  if (!allowed) {
    return <Navigate to="dashboard" replace />;
  }

  return children;
}

export default PermissionRoute;
