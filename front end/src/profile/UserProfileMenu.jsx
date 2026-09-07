import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, KeyRound, LogOut, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getInitials, getRoleProfile, logoutAndClearSessions } from "./sessionProfile";
import { apiUrl } from "../config/api";
import { getAuthToken, getLoggedInDoctor } from "../doctors/utils/doctorSession";
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

function UserProfileMenu({ roleType = "admin" }) {
  const navigate = useNavigate();
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [branchOptions, setBranchOptions] = useState([]);
  const [activeBranchId, setActiveBranchId] = useState(
    String(localStorage.getItem("doctorBranchId") || localStorage.getItem("branchId") || "").trim()
  );
  const [profileTick, setProfileTick] = useState(0);
  const profile = getRoleProfile(roleType);

  useEffect(() => {
    const close = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
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

  const logout = async () => {
    await logoutAndClearSessions(roleType);
    navigate("/login", { replace: true });
  };

  const goTo = (path) => {
    setOpen(false);
    navigate(path);
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
    <div className="user-profile-wrap" ref={wrapRef}>
      <button
        className={`user-profile-chip${open ? " open" : ""}`}
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={`${profile.name} ${profile.email}`.trim()}
      >
        <span className="user-profile-avatar-shell">
          <span className="user-profile-avatar">{getInitials(profile.name || profile.email)}</span>
          <span className="user-profile-online-dot" />
        </span>
        <span className="user-profile-copy">
          <strong>{profile.name}</strong>
          <em>{profile.email}</em>
        </span>
        <ChevronDown size={18} className="user-profile-chevron" />
      </button>

      {open ? (
        <div className="user-profile-dropdown">
          <div className="user-profile-head">
            <span className="user-profile-head-avatar">{getInitials(profile.name || profile.email)}</span>
            <span className="user-profile-head-copy">
              <strong>{profile.name}</strong>
              <span>{profile.email}</span>
              <em>{profile.roleLabel}</em>
            </span>
          </div>
          {roleType === "doctor" && branchOptions.length > 0 ? (
            <label className="user-profile-branch-switch">
              <span>Branch</span>
              {branchOptions.length > 1 ? (
                <select value={activeBranchId} onChange={handleBranchChange}>
                  {branchOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              ) : (
                <strong>{activeBranchName}</strong>
              )}
            </label>
          ) : null}
          <button type="button" onClick={() => goTo(profile.profilePath)}>
            <span className="user-profile-menu-icon">
              <UserRound size={20} />
            </span>
            <span className="user-profile-menu-copy">
              <b>My Profile</b>
              <small>View and edit your profile</small>
            </span>
            <ChevronRight size={17} className="user-profile-menu-arrow" />
          </button>
          <button type="button" onClick={() => goTo(profile.passwordPath)}>
            <span className="user-profile-menu-icon">
              <KeyRound size={20} />
            </span>
            <span className="user-profile-menu-copy">
              <b>Change Password</b>
              <small>Update your password</small>
            </span>
            <ChevronRight size={17} className="user-profile-menu-arrow" />
          </button>
          <button type="button" className="danger" onClick={logout}>
            <span className="user-profile-menu-icon danger">
              <LogOut size={20} />
            </span>
            <span className="user-profile-menu-copy">
              <b>Logout</b>
              <small>Sign out from your account</small>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default UserProfileMenu;

