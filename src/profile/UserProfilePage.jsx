import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiUrl } from "../config/api";
import { validateStrongPassword } from "../utils/validation";
import { clearAllSessions, getInitials, getRoleProfile } from "./sessionProfile";
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

function UserProfilePage({ roleType = "admin" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const profile = useMemo(() => getRoleProfile(roleType), [roleType]);
  const [activeTab, setActiveTab] = useState("profile");
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

  const logout = () => {
    clearAllSessions();
    navigate("/login", { replace: true });
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
        localStorage.getItem("receptionistToken");
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
      <div className="profile-hero">
        <div className="profile-hero-avatar">{getInitials(profile.name)}</div>
        <div>
          <h2>{profile.name}</h2>
          <p>{profile.email}</p>
        </div>
      </div>

      <div className="profile-layout">
        <aside className="profile-tabs">
          <button
            type="button"
            className={activeTab === "profile" ? "active" : ""}
            onClick={() => setActiveTab("profile")}
          >
            <UserRound size={18} /> My Profile
          </button>
          <button
            type="button"
            className={activeTab === "password" ? "active" : ""}
            onClick={() => setActiveTab("password")}
          >
            <KeyRound size={18} /> Change Password
          </button>
          <button type="button" className="danger" onClick={logout}>
            <LogOut size={18} /> Logout
          </button>
        </aside>

        <div className="profile-panel">
          {activeTab === "profile" ? (
            <>
              <h3>My Profile</h3>
              <div className="profile-info-grid">
                <div>
                  <Mail size={19} />
                  <span>Email</span>
                  <strong>{profile.email}</strong>
                </div>
                <div>
                  <ShieldCheck size={19} />
                  <span>Role</span>
                  <strong>{profile.roleLabel}</strong>
                </div>
                <div>
                  <UserRound size={19} />
                  <span>Name</span>
                  <strong>{profile.name}</strong>
                </div>
              </div>
            </>
          ) : (
            <form onSubmit={changePassword} noValidate>
              <h3>Change Password</h3>
              <label>
                <span>Current Password</span>
                <div className="profile-password-field">
                  <input
                    type={visiblePasswords.currentPassword ? "text" : "password"}
                    value={form.currentPassword}
                    minLength={8}
                    required
                    autoComplete="current-password"
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="profile-password-toggle"
                    onClick={() => togglePasswordVisibility("currentPassword")}
                    aria-label={visiblePasswords.currentPassword ? "Hide current password" : "Show current password"}
                    title={visiblePasswords.currentPassword ? "Hide password" : "Show password"}
                  >
                    {visiblePasswords.currentPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </label>
              <label>
                <span>New Password</span>
                <div className="profile-password-field">
                  <input
                    type={visiblePasswords.newPassword ? "text" : "password"}
                    value={form.newPassword}
                    minLength={8}
                    required
                    autoComplete="new-password"
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, newPassword: event.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="profile-password-toggle"
                    onClick={() => togglePasswordVisibility("newPassword")}
                    aria-label={visiblePasswords.newPassword ? "Hide new password" : "Show new password"}
                    title={visiblePasswords.newPassword ? "Hide password" : "Show password"}
                  >
                    {visiblePasswords.newPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
                <ul className="profile-password-requirements" aria-label="Password requirements">
                  {newPasswordRequirements.map((requirement) => (
                    <li
                      key={requirement.label}
                      className={requirement.met ? "met" : ""}
                    >
                      {requirement.met ? (
                        <CheckCircle2 size={15} aria-hidden="true" />
                      ) : (
                        <Circle size={15} aria-hidden="true" />
                      )}
                      {requirement.label}
                    </li>
                  ))}
                </ul>
              </label>
              <label>
                <span>Confirm Password</span>
                <div className="profile-password-field">
                  <input
                    type={visiblePasswords.confirmPassword ? "text" : "password"}
                    value={form.confirmPassword}
                    minLength={8}
                    required
                    autoComplete="new-password"
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="profile-password-toggle"
                    onClick={() => togglePasswordVisibility("confirmPassword")}
                    aria-label={visiblePasswords.confirmPassword ? "Hide confirm password" : "Show confirm password"}
                    title={visiblePasswords.confirmPassword ? "Hide password" : "Show password"}
                  >
                    {visiblePasswords.confirmPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </label>
              {message ? (
                <p className={`profile-message profile-message--${messageType}`}>
                  {message}
                </p>
              ) : null}
              <button type="submit" className="profile-save" disabled={saving}>
                {saving ? "Updating..." : "Update Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

export default UserProfilePage;

