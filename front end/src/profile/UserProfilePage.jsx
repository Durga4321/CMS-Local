import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  HeartPulse,
  KeyRound,
  LogOut,
  Mail,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Thermometer,
  UserRound,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiUrl } from "../config/api";
import { validateStrongPassword } from "../utils/validation";
import { getInitials, getRoleProfile, logoutAndClearSessions } from "./sessionProfile";
import LogoutModal from "./LogoutModal";
import "./UserProfile.css";

const PASSWORD_REQUIREMENTS = [
  { label: "Minimum 8 characters", test: (value) => value.length >= 8 },
  { label: "At least 1 uppercase letter (A-Z)", test: (value) => /[A-Z]/.test(value) },
  { label: "At least 1 lowercase letter (a-z)", test: (value) => /[a-z]/.test(value) },
  { label: "At least 1 number (0-9)", test: (value) => /\d/.test(value) },
  {
    label: "At least 1 special character (@, #, $, %, etc.)",
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
];

const PROFILE_BACK_FALLBACKS = {
  admin: "/dashboard",
  doctor: "/doctor/dashboard",
  receptionist: "/reception/dashboard",
  nurse: "/nurse/dashboard",
  lab: "/lab/dashboard",
};

function UserProfilePage({ roleType = "admin" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const profile = useMemo(() => getRoleProfile(roleType), [roleType]);
  const [activeTab, setActiveTab] = useState("profile");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [visiblePasswords, setVisiblePasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [saving, setSaving] = useState(false);

  const newPasswordRequirements = useMemo(
    () =>
      PASSWORD_REQUIREMENTS.map((requirement) => ({
        ...requirement,
        met: requirement.test(form.newPassword),
      })),
    [form.newPassword]
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setActiveTab(params.get("tab") === "password" ? "password" : "profile");
  }, [location.search]);

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = async () => {
    setShowLogoutModal(false);
    await logoutAndClearSessions(roleType);
    navigate("/login", { replace: true });
  };

  const handleCancelLogout = () => {
    setShowLogoutModal(false);
  };

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    const fallback =
      profile.roleLabel === "Super Admin"
        ? "/superadmin/dashboard"
        : PROFILE_BACK_FALLBACKS[roleType] || PROFILE_BACK_FALLBACKS.admin;
    navigate(fallback);
  };

  const togglePasswordVisibility = (field) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setMessage("");
    setMessageType("");

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setMessage("Please fill all password fields.");
      setMessageType("error");
      return;
    }

    const currentPasswordError = validateStrongPassword(
      form.currentPassword,
      "Current Password"
    );
    if (currentPasswordError) {
      setMessage(currentPasswordError);
      setMessageType("error");
      return;
    }

    const newPasswordError = validateStrongPassword(
      form.newPassword,
      "New Password"
    );
    if (newPasswordError) {
      setMessage(newPasswordError);
      setMessageType("error");
      return;
    }

    if (form.currentPassword === form.newPassword) {
      setMessage("New password must be different from current password.");
      setMessageType("error");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setMessage("New password and confirm password must match.");
      setMessageType("error");
      return;
    }

    setSaving(true);
    try {
      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("adminToken") ||
        localStorage.getItem("doctorToken") ||
        localStorage.getItem("receptionistToken") ||
        localStorage.getItem("nurseToken") ||
        localStorage.getItem("labToken");
      const response = await fetch(apiUrl("Auth/change-password"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          oldPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Request failed with status ${response.status}`);
      setMessage(data.message || "Password changed successfully.");
      setMessageType("success");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setVisiblePasswords({ currentPassword: false, newPassword: false, confirmPassword: false });
    } catch (error) {
      setMessage(error.message || "Unable to change password right now.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="profile-page">
      {/* Hospital Theme Backdrop with subtle medical instruments floating */}
      <div className="profile-hospital-backdrop" aria-hidden="true">
        <div className="profile-hospital-bg-img" />
        <div className="profile-floating-instruments">
          <div className="profile-float-instrument float-1" title="Stethoscope">
            <Stethoscope size={28} />
          </div>
          <div className="profile-float-instrument float-2" title="Syringe">
            <Syringe size={22} />
          </div>
          <div className="profile-float-instrument float-3" title="Thermometer">
            <Thermometer size={24} />
          </div>
          <div className="profile-float-instrument float-4" title="Heart Pulse">
            <HeartPulse size={26} />
          </div>
        </div>
      </div>

      {/* Hero Header Card with Hospital Station Identity & Telemetry */}
      <div className="profile-hero">
        <button
          type="button"
          className="profile-back-btn profile-med-instrument-btn"
          onClick={goBack}
          aria-label="Go back"
          title="Return to previous screen"
        >
          <span className="profile-btn-instrument-model model--back">
            <ArrowLeft size={16} />
          </span>
          <span className="profile-btn-label">Back</span>
        </button>

        <div className="profile-hero-avatar-wrap">
          <div className="profile-hero-avatar">{getInitials(profile.name)}</div>
          <span className="profile-hero-role-badge" title="Medical Practitioner">
            <Activity size={12} />
          </span>
        </div>

        <div className="profile-hero-info">
          <div className="profile-hero-top-tag">
            <span className="profile-med-cross-tag">
              <ShieldCheck size={12} /> Hospital Staff Profile
            </span>
            <span className="profile-station-status">
              <span className="status-pulse-dot" /> Station Active
            </span>
          </div>
          <h2>{profile.name}</h2>
          <p className="profile-hero-email">
            <Mail size={13} /> {profile.email}
          </p>
        </div>

        {/* ECG telemetry wave running across hero header */}
        <div className="profile-hero-ecg" aria-hidden="true">
          <svg viewBox="0 0 200 24" className="profile-ecg-svg" preserveAspectRatio="none">
            <path
              d="M0,12 L45,12 L52,12 L58,3 L64,19 L70,5 L76,14 L82,12 L138,12 L144,3 L150,19 L156,6 L162,14 L168,12 L200,12"
              fill="none"
              stroke="rgba(13, 148, 136, 0.45)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="82" cy="12" r="2.5" fill="#0d9488" className="profile-ecg-runner" />
          </svg>
        </div>
      </div>

      <div className="profile-layout">
        {/* Left Navigation Tabs with 3D Medical Instrument Models */}
        <aside className="profile-tabs">
          <div className="profile-tabs-header">
            <Activity size={14} />
            <span>Staff Controls</span>
          </div>

          <button
            type="button"
            className={`profile-tab-btn ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
            title="View staff medical profile"
          >
            <span className="profile-btn-instrument-model model--stethoscope">
              <Stethoscope size={18} />
            </span>
            <span className="profile-tab-text">
              <strong>My Profile</strong>
              <small>Clinical ID & Credentials</small>
            </span>
            <span className="profile-tab-indicator" />
          </button>

          <button
            type="button"
            className={`profile-tab-btn ${activeTab === "password" ? "active" : ""}`}
            onClick={() => setActiveTab("password")}
            title="Update access password"
          >
            <span className="profile-btn-instrument-model model--keycard">
              <KeyRound size={18} />
            </span>
            <span className="profile-tab-text">
              <strong>Change Password</strong>
              <small>Security & HIPAA Vault</small>
            </span>
            <span className="profile-tab-indicator" />
          </button>

          <button
            type="button"
            className="profile-tab-btn danger"
            onClick={handleLogoutClick}
            title="End current clinical session"
          >
            <span className="profile-btn-instrument-model model--emergency">
              <LogOut size={18} />
            </span>
            <span className="profile-tab-text">
              <strong>Logout</strong>
              <small>End Hospital Session</small>
            </span>
          </button>
        </aside>

        {/* Right Content Panel */}
        <div className="profile-panel">
          {activeTab === "profile" ? (
            /* SCREEN 1: My Profile with Hospital Credentials Cards */
            <div className="profile-view-screen">
              <div className="profile-panel-header">
                <div className="profile-panel-title-wrap">
                  <div className="profile-panel-icon-badge">
                    <Stethoscope size={20} />
                  </div>
                  <div>
                    <h3>Staff Medical Credentials</h3>
                    <p>Verified hospital profile and station assignments</p>
                  </div>
                </div>
                <span className="profile-verified-badge">
                  <ShieldCheck size={13} /> Verified Staff
                </span>
              </div>

              <div className="profile-info-grid">
                <div className="profile-info-card card--email">
                  <div className="profile-card-instrument-badge">
                    <Mail size={22} />
                  </div>
                  <div className="profile-card-content">
                    <span className="profile-card-label">Official Email</span>
                    <strong className="profile-card-value">{profile.email}</strong>
                    <em className="profile-card-subtag">Primary Communication Channel</em>
                  </div>
                </div>

                <div className="profile-info-card card--role">
                  <div className="profile-card-instrument-badge">
                    <ShieldCheck size={22} />
                  </div>
                  <div className="profile-card-content">
                    <span className="profile-card-label">Clinical Role</span>
                    <strong className="profile-card-value">{profile.roleLabel}</strong>
                    <em className="profile-card-subtag">Authorized Medical Access</em>
                  </div>
                </div>

                <div className="profile-info-card card--name">
                  <div className="profile-card-instrument-badge">
                    <UserRound size={22} />
                  </div>
                  <div className="profile-card-content">
                    <span className="profile-card-label">Staff Full Name</span>
                    <strong className="profile-card-value">{profile.name}</strong>
                    <em className="profile-card-subtag">Licensed Healthcare Personnel</em>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* SCREEN 2: Change Password with Medical Security Form & Syringe Button */
            <form onSubmit={changePassword} noValidate className="profile-form-hospital">
              <div className="profile-panel-header">
                <div className="profile-panel-title-wrap">
                  <div className="profile-panel-icon-badge badge--security">
                    <KeyRound size={20} />
                  </div>
                  <div>
                    <h3>Hospital Security Credentials</h3>
                    <p>Update access key with HIPAA & NABH compliant standards</p>
                  </div>
                </div>
                <span className="profile-security-badge">
                  <ShieldCheck size={13} /> Encrypted Hospital Vault
                </span>
              </div>

              <label className="profile-field-label">
                <span className="field-label-text">
                  <KeyRound size={14} className="field-label-icon" /> Current Password
                </span>
                <div className="profile-password-field">
                  <input
                    type={visiblePasswords.currentPassword ? "text" : "password"}
                    value={form.currentPassword}
                    minLength={8}
                    required
                    placeholder="Enter current password..."
                    autoComplete="current-password"
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                    }
                  />
                  {/* Medical Precision Optical Lens Model Toggle Button */}
                  <button
                    type="button"
                    className="profile-password-toggle profile-lens-toggle"
                    onClick={() => togglePasswordVisibility("currentPassword")}
                    aria-label={visiblePasswords.currentPassword ? "Hide current password" : "Show current password"}
                    title={visiblePasswords.currentPassword ? "Hide password (Lens Active)" : "Show password (Focus Medical Lens)"}
                  >
                    <span className="profile-lens-rim">
                      {visiblePasswords.currentPassword ? <Eye size={17} /> : <EyeOff size={17} />}
                    </span>
                  </button>
                </div>
              </label>

              <label className="profile-field-label">
                <span className="field-label-text">
                  <KeyRound size={14} className="field-label-icon" /> New Password
                </span>
                <div className="profile-password-field">
                  <input
                    type={visiblePasswords.newPassword ? "text" : "password"}
                    value={form.newPassword}
                    minLength={8}
                    required
                    placeholder="Enter strong new password..."
                    autoComplete="new-password"
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, newPassword: event.target.value }))
                    }
                  />
                  {/* Medical Precision Optical Lens Model Toggle Button */}
                  <button
                    type="button"
                    className="profile-password-toggle profile-lens-toggle"
                    onClick={() => togglePasswordVisibility("newPassword")}
                    aria-label={visiblePasswords.newPassword ? "Hide new password" : "Show new password"}
                    title={visiblePasswords.newPassword ? "Hide password (Lens Active)" : "Show password (Focus Medical Lens)"}
                  >
                    <span className="profile-lens-rim">
                      {visiblePasswords.newPassword ? <Eye size={17} /> : <EyeOff size={17} />}
                    </span>
                  </button>
                </div>

                {/* Password Vital Requirements Checklist */}
                <ul className="profile-password-requirements" aria-label="Password requirements">
                  {newPasswordRequirements.map((requirement) => (
                    <li
                      key={requirement.label}
                      className={requirement.met ? "met" : ""}
                    >
                      <span className="requirement-vital-indicator">
                        {requirement.met ? (
                          <CheckCircle2 size={15} aria-hidden="true" />
                        ) : (
                          <Circle size={15} aria-hidden="true" />
                        )}
                      </span>
                      <span>{requirement.label}</span>
                    </li>
                  ))}
                </ul>
              </label>

              <label className="profile-field-label">
                <span className="field-label-text">
                  <KeyRound size={14} className="field-label-icon" /> Confirm Password
                </span>
                <div className="profile-password-field">
                  <input
                    type={visiblePasswords.confirmPassword ? "text" : "password"}
                    value={form.confirmPassword}
                    minLength={8}
                    required
                    placeholder="Confirm new password..."
                    autoComplete="new-password"
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                    }
                  />
                  {/* Medical Precision Optical Lens Model Toggle Button */}
                  <button
                    type="button"
                    className="profile-password-toggle profile-lens-toggle"
                    onClick={() => togglePasswordVisibility("confirmPassword")}
                    aria-label={visiblePasswords.confirmPassword ? "Hide confirm password" : "Show confirm password"}
                    title={visiblePasswords.confirmPassword ? "Hide password (Lens Active)" : "Show password (Focus Medical Lens)"}
                  >
                    <span className="profile-lens-rim">
                      {visiblePasswords.confirmPassword ? <Eye size={17} /> : <EyeOff size={17} />}
                    </span>
                  </button>
                </div>
              </label>

              {message ? (
                <p className={`profile-message profile-message--${messageType}`}>
                  <Activity size={15} />
                  <span>{message}</span>
                </p>
              ) : null}

              {/* Action Buttons: Cancel and Update Password */}
              <div className="profile-form-actions">
                <button
                  type="button"
                  className="profile-cancel-btn"
                  onClick={() => {
                    setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                    setMessage("");
                    setActiveTab("profile");
                  }}
                  title="Cancel and return to profile view"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="profile-save profile-submit-instrument-btn"
                  disabled={saving}
                  title="Click to encrypt and update password"
                >
                  <span className="profile-btn-instrument-model model--syringe">
                    <Syringe size={17} className="profile-submit-syringe-icon" />
                    <span className="profile-submit-drip-bead" />
                  </span>
                  <span className="profile-submit-label">
                    {saving ? "Encrypting & Updating..." : "Update Password"}
                  </span>
                  <span className="profile-submit-pulse-beam" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Professional Logout Confirmation Dialog */}
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={handleCancelLogout}
        onConfirm={handleConfirmLogout}
        userName={profile.name}
        userRole={profile.roleLabel}
      />
    </section>
  );
}

export default UserProfilePage;

