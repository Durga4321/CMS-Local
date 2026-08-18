import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  Stethoscope,
} from "lucide-react";
import "./DoctorSidebar.css";
import { getRoleProfile } from "../profile/sessionProfile";
import { getClinicDisplayName } from "../utils/clinicDisplay";
import { getDefaultClinicLogo, useClinicInvoiceBranding } from "../utils/clinicBranding";
import { apiUrl } from "../config/api";
import { getAuthToken, getLoggedInDoctor } from "./utils/doctorSession";
import { filterItemsByViewPermission, hasAnySavedModulePermissions, useRolePermissionsSync } from "../utils/rolePermissions";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/doctor/dashboard" },
  { label: "Consultation", icon: Stethoscope, path: "/doctor/consultation" },
  { label: "Prescription", icon: ClipboardList, path: "/doctor/prescription" },
  { label: "Appointments", icon: ClipboardList, path: "/doctor/appointments" },
  { label: "My Schedule", icon: CalendarClock, path: "/doctor/schedule" },
];

const getInitials = (name) =>
  String(name || "D")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "D";

const parseList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.branches)) return data.branches;
  return [];
};

const getBranchId = (branch = {}) =>
  String(
    typeof branch === "object"
      ? branch.branchId ?? branch.BranchId ?? branch.id ?? branch.Id ?? branch.clinicBranchId ?? ""
      : branch
  ).trim();

const getBranchName = (branch = {}) =>
  String(
    typeof branch === "object"
      ? branch.branchName ?? branch.BranchName ?? branch.name ?? branch.Name ?? branch.branch ?? ""
      : branch
  ).trim();

const rememberDoctorBranch = (branch = {}) => {
  const branchId = getBranchId(branch);
  const branchName = getBranchName(branch);
  if (!branchId) return;

  localStorage.setItem("doctorBranchId", branchId);
  localStorage.setItem("DoctorBranchId", branchId);
  localStorage.setItem("branchId", branchId);
  localStorage.setItem("BranchId", branchId);
  if (branchName) {
    localStorage.setItem("doctorBranchName", branchName);
    localStorage.setItem("DoctorBranchName", branchName);
    localStorage.setItem("branchName", branchName);
    localStorage.setItem("BranchName", branchName);
  }

  window.dispatchEvent(
    new CustomEvent("doctorBranchChanged", {
      detail: { branchId, branchName },
    })
  );
};

function DoctorSidebar() {
  const profile = getRoleProfile("doctor");
  const hospitalName = getClinicDisplayName(profile, "Clinic Name");
  const doctor = getLoggedInDoctor();
  const [branchOptions, setBranchOptions] = useState([]);
  const [activeBranchId, setActiveBranchId] = useState(String(doctor.branchId || "").trim());
  const branchName = useMemo(() => {
    const selectedBranch = branchOptions.find((branch) => getBranchId(branch) === String(activeBranchId));
    return getBranchName(selectedBranch) || String(localStorage.getItem("doctorBranchName") || profile.branchName || "").trim();
  }, [activeBranchId, branchOptions, profile.branchName]);
  const displayName = profile.name || "Dr. Doctor";
  const permissionProfile = {
    ...profile,
    id: profile.id || doctor.id,
    userId: profile.userId || profile.id || doctor.id,
    doctorId: doctor.id || profile.doctorId,
    email: doctor.email || profile.email,
    name: doctor.name || profile.name,
    role: "Doctor",
  };
  const { loading: permissionsLoading } = useRolePermissionsSync(permissionProfile);
  const navItems =
    permissionsLoading && !hasAnySavedModulePermissions(permissionProfile)
      ? []
      : filterItemsByViewPermission(NAV_ITEMS, permissionProfile);
  const clinicBranding = useClinicInvoiceBranding({
    clinicId: profile.clinicId || profile.hospitalId || localStorage.getItem("hospitalId") || localStorage.getItem("clinicId") || "",
    clinicName: hospitalName,
  });

  useEffect(() => {
    let isCurrent = true;
    const loadBranches = async () => {
      const doctorId = doctor.id;
      if (!doctorId) return;
      const token = getAuthToken();
      const headers = { "ngrok-skip-browser-warning": "true" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(apiUrl(`Doctor/${encodeURIComponent(doctorId)}/branches`), { headers }).catch(() => null);
      if (!response?.ok) return;
      const data = await response.json().catch(() => null);
      const branches = parseList(data)
        .map((branch) => ({
          ...((branch && typeof branch === "object") ? branch : {}),
          id: getBranchId(branch),
          branchId: getBranchId(branch),
          name: getBranchName(branch) || getBranchId(branch),
          branchName: getBranchName(branch) || getBranchId(branch),
        }))
        .filter((branch) => branch.id);
      if (!isCurrent) return;
      setBranchOptions(branches);
      const storedBranchId = String(localStorage.getItem("doctorBranchId") || localStorage.getItem("branchId") || "").trim();
      const matchedBranch = branches.find((branch) => String(branch.id) === storedBranchId);
      const nextBranch = matchedBranch || branches[0];
      if (nextBranch && (!storedBranchId || !matchedBranch)) {
        rememberDoctorBranch(nextBranch);
      }
      if (nextBranch) setActiveBranchId(String(nextBranch.id));
    };

    loadBranches();
    return () => {
      isCurrent = false;
    };
  }, [doctor.id]);

  useEffect(() => {
    const handleBranchChanged = (event) => {
      const nextBranchId = String(event.detail?.branchId || localStorage.getItem("doctorBranchId") || "").trim();
      if (nextBranchId) setActiveBranchId(nextBranchId);
    };

    window.addEventListener("doctorBranchChanged", handleBranchChanged);
    return () => window.removeEventListener("doctorBranchChanged", handleBranchChanged);
  }, []);

  return (
    <aside className="dr-sidebar">
      <div className="dr-brand">
        <div className="dr-brand-icon dr-clinic-logo dr-clinic-logo--emerald">
          <img src={clinicBranding.logoUrl} alt="" onError={(event) => { event.currentTarget.src = getDefaultClinicLogo(hospitalName, profile.clinicId || profile.hospitalId || ""); }} />
        </div>
        <div>
          <p className="dr-brand-sub">Clinic Name</p>
          <p className="dr-brand-name">{hospitalName}</p>
          {branchName ? <p className="dr-brand-branch">{branchName}</p> : null}
        </div>
      </div>

      <nav className="dr-nav">
        {navItems.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              isActive ? "dr-nav-link active" : "dr-nav-link"
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="dr-sidebar-profile">
        <div className="dr-sidebar-avatar">{getInitials(displayName)}</div>
        <div className="dr-sidebar-profile-info">
          <p className="dr-sidebar-profile-name">{displayName}</p>
          <p className="dr-sidebar-profile-role">{hospitalName}</p>
          {branchName ? (
            <p className="dr-sidebar-profile-branch">{branchName}</p>
          ) : null}
          <p className="dr-sidebar-profile-status">
            <span className="dr-status-dot" /> Online
          </p>
        </div>
      </div>
    </aside>
  );
}

export default DoctorSidebar;
