import React, { useEffect, useRef, useState, useCallback } from "react";
import { Activity, CalendarHeart, ChevronDown, KeyRound, ListChecks, LogOut, Syringe, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getInitials, getRoleProfile, logoutAndClearSessions } from "./sessionProfile";
import { apiUrl } from "../config/api";
import { getAuthToken, getLoggedInDoctor } from "../doctors/utils/doctorSession";
import { DropdownMenu, DropdownItem } from "../components/dropdown";
import "./UserProfile.css";

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

export function UserProfileMenu({ roleType = "admin" }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [branchOptions, setBranchOptions] = useState([]);
  const [activeBranchId, setActiveBranchId] = useState(
    String(localStorage.getItem("doctorBranchId") || localStorage.getItem("branchId") || "").trim()
  );
  const [profileTick, setProfileTick] = useState(0);
  const profile = getRoleProfile(roleType);

  const handleOpenChange = useCallback((open) => {
    setIsOpen(open);
  }, []);

  useEffect(() => {
    if (roleType !== "doctor") return undefined;

    let isCurrent = true;
    const loadBranches = async () => {
      const doctor = getLoggedInDoctor();
      if (!doctor.id) return;

      const token = getAuthToken();
      const headers = { "ngrok-skip-browser-warning": "true" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(apiUrl(`Doctor/${encodeURIComponent(doctor.id)}/branches`), { headers }).catch(() => null);
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
      if (nextBranch) {
        setActiveBranchId(String(nextBranch.id));
        if (!storedBranchId || !matchedBranch) {
          rememberDoctorBranch(nextBranch);
          setProfileTick((value) => value + 1);
        }
      }
    };

    loadBranches();

    const handleBranchChanged = (event) => {
      const nextBranchId = String(event.detail?.branchId || localStorage.getItem("doctorBranchId") || "").trim();
      if (nextBranchId) setActiveBranchId(nextBranchId);
      setProfileTick((value) => value + 1);
    };

    window.addEventListener("doctorBranchChanged", handleBranchChanged);
    return () => {
      isCurrent = false;
      window.removeEventListener("doctorBranchChanged", handleBranchChanged);
    };
  }, [roleType]);

  // 1. My Profile Navigation: Closes dropdown and navigates smoothly
  const handleProfileNavigation = () => {
    handleOpenChange(false);
    navigate(profile.profilePath);
  };

  // 2. Change Password Navigation: Closes dropdown and navigates smoothly
  const handleChangePasswordNavigation = () => {
    handleOpenChange(false);
    navigate(profile.passwordPath);
  };

  // 3. Logout Flow: Closes dropdown, clears all session tokens, logs out from module and redirects to login
  const handleLogoutClick = async (e) => {
    if (e?.stopPropagation) e.stopPropagation();
    handleOpenChange(false);
    await logoutAndClearSessions(roleType);
    navigate("/login", { replace: true });
  };

  const handleBranchChange = (event) => {
    const nextBranchId = event.target.value;
    const nextBranch = branchOptions.find((branch) => String(branch.id) === String(nextBranchId));
    setActiveBranchId(String(nextBranchId));
    rememberDoctorBranch(nextBranch || { branchId: nextBranchId });
    setProfileTick((value) => value + 1);
  };

  const activeBranch = branchOptions.find((branch) => String(branch.id) === String(activeBranchId));
  const activeBranchName = getBranchName(activeBranch) || profile.branchName;
  void profileTick;

  return (
    <>
      <DropdownMenu
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
        placement="bottom-end"
        variant="light"
        ariaLabel="User Profile Menu"
        trigger={({ toggle }) => (
          <button
            className={`user-profile-chip ${isOpen ? "is-open" : ""}`}
            type="button"
            onClick={toggle}
            title={`${profile.name} • ${profile.email}`}
            aria-expanded={isOpen}
            aria-haspopup="true"
          >
            {/* Avatar Shell with Online Indicator */}
            <span className="user-profile-avatar-shell">
              <span className="user-profile-avatar">
                {getInitials(profile.name || profile.email)}
              </span>
              <span className="user-profile-online-dot" />
            </span>

            {/* Clean Vertically Stacked User Name & Role/Email */}
            <span className="user-profile-copy">
              <strong>{profile.name}</strong>
              <em>{profile.email}</em>
            </span>

            {/* Clean Dropdown Arrow */}
            <ChevronDown
              size={16}
              className={`user-profile-dropdown-arrow ${isOpen ? "is-open" : ""}`}
            />
          </button>
        )}
      >
        {/* 1. Profile Header: Interactive accessible button navigating to Profile Page */}
        <button
          type="button"
          className="hc-profile-header"
          onClick={handleProfileNavigation}
          title="View Profile"
          aria-label={`View Profile: ${profile.name}`}
        >
          <div className="hc-profile-avatar-box">
            <div className="hc-profile-avatar-circle">
              {getInitials(profile.name || profile.email)}
            </div>
          </div>

          <div className="hc-profile-info">
            <h4 className="hc-profile-name">{profile.name}</h4>
            <span className="hc-profile-email">{profile.email}</span>
            <span className="hc-profile-badge">{profile.roleLabel}</span>
          </div>
        </button>

        {/* Doctor Branch Switcher (if applicable for doctor role) */}
        {roleType === "doctor" && branchOptions.length > 0 && (
          <div className="hc-branch-selector-pill">
            <span className="hc-branch-pill-label">Branch:</span>
            {branchOptions.length > 1 ? (
              <select
                value={activeBranchId}
                onChange={handleBranchChange}
                className="hc-branch-select-input"
              >
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            ) : (
              <strong className="hc-branch-pill-name">{activeBranchName}</strong>
            )}
          </div>
        )}

        {/* 2. Menu Items: Clean, professional circular badge design */}
        <div className="hc-dropdown-list" role="menu">
          {/* Card 1: My Profile (Click anywhere on card navigates to profile) */}
          <DropdownItem
            variant="pink"
            leftBadgeType="circle"
            icon={UserRound}
            title="My Profile"
            subtitle="View and edit your profile"
            tag="ONLINE"
            tagVariant="pink"
            onClick={handleProfileNavigation}
          />

          {/* Card 2: Change Password (Click anywhere on card navigates to password management) */}
          <DropdownItem
            variant="orange"
            leftBadgeType="circle"
            icon={KeyRound}
            title="Change Password"
            subtitle="Update your password"
            tag="SECURITY"
            tagVariant="white"
            onClick={handleChangePasswordNavigation}
          />

          {/* Card 3: Logout (Click anywhere on card opens confirmation modal) */}
          <DropdownItem
            variant="danger"
            leftBadgeType="circle"
            icon={LogOut}
            title="Logout"
            subtitle="Sign out from your account"
            tag="EXIT"
            tagVariant="white"
            onClick={handleLogoutClick}
          />
        </div>
      </DropdownMenu>
    </>
  );
}

export default UserProfileMenu;
