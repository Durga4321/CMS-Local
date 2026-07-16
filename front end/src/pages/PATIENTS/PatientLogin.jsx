import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useToast } from "../../components/ToastProvider";
import { validateGmail } from "../../utils/validation";
import { formatTitleCase } from "../../utils/format";
import {
  Heart, Eye, EyeOff, Stethoscope, Plus, Pill, Activity,
  Building2, Thermometer, Syringe,
} from "lucide-react";
import { apiUrl } from "../../config/api";
import "./PatientLogin.css";

const LOGIN_API = apiUrl("Auth/login");

/* ─── JWT helpers ─── */
const decodeJwtPayload = (token) => {
  try {
    const payload = token.split(".")[1];
    if (!payload || typeof atob !== "function") return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(normalized + padding));
  } catch {
    return null;
  }
};

const getClaim = (claims, ...keys) => {
  for (const key of keys) {
    if (claims?.[key] !== undefined && claims?.[key] !== null) return claims[key];
  }
  return "";
};

const loginRequestBodies = (email, password) => [
  { email, password, role: "Patient" },
  { Email: email, Password: password, Role: "Patient" },
  { email, password },
  { Email: email, Password: password },
];

/* ─── Twinkling stars ─── */
const StarsBackground = () => {
  const stars = useMemo(
    () =>
      Array.from({ length: 50 }).map((_, i) => ({
        id: i,
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        size: `${Math.random() * 2 + 1}px`,
        duration: `${Math.random() * 3 + 2}s`,
        delay: `${Math.random() * 5}s`,
      })),
    []
  );
  return (
    <div className="stars-container">
      {stars.map((s) => (
        <div
          key={s.id}
          className="star"
          style={{
            top: s.top, left: s.left,
            width: s.size, height: s.size,
            animationDuration: s.duration, animationDelay: s.delay,
          }}
        />
      ))}
    </div>
  );
};

/* ─── Hospital symbol orbit system ─── */
const INNER_RING = [
  { Icon: Heart,        color: "#f43f5e", label: "Heart" },
  { Icon: Stethoscope,  color: "#2dd4bf", label: "Stethoscope" },
  { Icon: Plus,         color: "#34d399", label: "Cross" },
  { Icon: Building2,    color: "#60a5fa", label: "Hospital" },
];

const OUTER_RING = [
  { Icon: Pill,         color: "#a78bfa", label: "Pill" },
  { Icon: Activity,     color: "#fbbf24", label: "Activity" },
  { Icon: Thermometer,  color: "#fb923c", label: "Thermometer" },
  { Icon: Heart,        color: "#f43f5e", label: "Heart2" },
  { Icon: Stethoscope,  color: "#2dd4bf", label: "Stethoscope2" },
  { Icon: Plus,         color: "#34d399", label: "Cross2" },
];

const MedicalOrbits = () => (
  <div className="orbit-system" aria-hidden="true">
    {/* ── Inner ring (clockwise, 22s) ── */}
    <div className="orbit-ring orbit-ring--inner">
      {INNER_RING.map(({ Icon, color, label }, i) => (
        <div
          key={label}
          className="orbit-slot orbit-slot--inner"
          style={{ transform: `rotate(${i * 90}deg)` }}
        >
          <div
            className="orbit-icon orbit-icon--counter-cw"
            style={{ "--icon-color": color, "--icon-border": `${color}55` }}
          >
            <Icon size={18} />
          </div>
        </div>
      ))}
    </div>

    {/* ── Outer ring (counter-clockwise, 30s) ── */}
    <div className="orbit-ring orbit-ring--outer">
      {OUTER_RING.map(({ Icon, color, label }, i) => (
        <div
          key={label}
          className="orbit-slot orbit-slot--outer"
          style={{ transform: `rotate(${i * 60}deg)` }}
        >
          <div
            className="orbit-icon orbit-icon--counter-ccw orbit-icon--sm"
            style={{ "--icon-color": color, "--icon-border": `${color}44` }}
          >
            <Icon size={14} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ─── Main component ─── */
function PatientLogin() {
  const toast     = useToast();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [email,            setEmail]            = useState("");
  const [password,         setPassword]         = useState("");
  const [passwordVisible,  setPasswordVisible]  = useState(false);
  const [errors,           setErrors]           = useState({});
  const [isLoading,        setIsLoading]        = useState(false);
  const [successMessage,   setSuccessMessage]   = useState("");

  useEffect(() => {
    if (location.state?.message) setSuccessMessage(location.state.message);
    if (location.state?.email)   setEmail(location.state.email);
  }, [location.state]);

  const validate = () => {
    const newErrors = {};
    const emailError = validateGmail(email, "Email ID", { strict: false });
    if (emailError) newErrors.email = emailError;
    if (!password)  newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsLoading(true);
    setErrors({});
    setSuccessMessage("");

    try {
      const trimmedEmail = email.trim();
      let response = null;
      let data = {};

      for (const body of loginRequestBodies(trimmedEmail, password)) {
        response = await fetch(LOGIN_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        data = await response.json().catch(() => ({}));
        if (response.ok) break;
      }

      if (!response.ok) {
        const errorMsg = data.message || data.error || "Invalid email or password.";
        setErrors({ api: errorMsg });
        toast.error(errorMsg);
        return;
      }

      const authData = data.data || data.result || data.user || data;
      const token    = authData.token || authData.accessToken || authData.jwtToken || "";

      if (!token) {
        setErrors({ api: "Token not received from server." });
        toast.error("Token not received from server.");
        return;
      }

      const claims = decodeJwtPayload(token);
      const role   = authData.role ||
        getClaim(claims, "role", "http://schemas.microsoft.com/ws/2008/06/identity/claims/role") ||
        "Patient";
      const normalizedRole = String(role).trim().toLowerCase().replace(/[^a-z]/g, "");

      if (normalizedRole !== "patient") {
        setErrors({ api: "Access denied. This page is dedicated to patients." });
        toast.error("Access denied. Please use the Admin/Staff login page.");
        return;
      }

      const displayName = formatTitleCase(
        authData.name || authData.firstName ||
        getClaim(claims, "name", "unique_name") || "Patient"
      );
      const patientId = authData.patientId ||
        getClaim(claims, "PatientId", "patientId") || "";

      ["token","userRole","patientToken","patientRole","patientEmail","patientName","patientId"]
        .forEach((k) => localStorage.removeItem(k));

      localStorage.setItem("token",        token);
      localStorage.setItem("patientToken", token);
      localStorage.setItem("userRole",     role);
      localStorage.setItem("patientRole",  role);
      localStorage.setItem("patientEmail", trimmedEmail);
      localStorage.setItem("patientName",  displayName);
      localStorage.setItem("patientId",    String(patientId));

      toast.success("Welcome to your Patient Portal!");
      navigate("/patient/dashboard", { replace: true });
    } catch {
      setErrors({ api: "Unable to connect to the server." });
      toast.error("Unable to connect to the server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="patient-login-page">
      <StarsBackground />

      {/* Hospital orbit rings */}
      <MedicalOrbits />

      {/* Centered login card */}
      <div className="login-card-wrapper">
        {/* Logo badge */}
        {/* <div className="login-logo-badge">
          <Heart size={20} />
        </div>
        <p className="login-brand-name">CMS Patient Portal</p> */}

        <div className="patient-login-card">
          <div className="card-header">
            <h2>Patient Login</h2>
            <br/><br/>
            <p>Enter your patient account details below</p>
          </div>

          {successMessage && (
            <div className="login-success-banner">{successMessage}</div>
          )}

          <form onSubmit={handleLogin} noValidate>
            <div className="input-group">
              <label htmlFor="login-email">Email Address</label>
              <input
                id="login-email"
                type="email"
                placeholder="patient@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={errors.email ? "input-error" : ""}
                disabled={isLoading}
              />
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>

            <div className="input-group">
              <label htmlFor="login-password">Password</label>
              <div className="password-input-wrapper">
                <input
                  id="login-password"
                  type={passwordVisible ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={errors.password ? "input-error" : ""}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible(!passwordVisible)}
                  className="password-toggle-btn"
                >
                  {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <span className="error-message">{errors.password}</span>}
            </div>

            {errors.api && <div className="api-error-banner">{errors.api}</div>}

            <button type="submit" className="login-btn" disabled={isLoading}>
              {isLoading ? "Signing in…" : "Login to Portal"}
            </button>
          </form>

          <div className="card-footer">
            <p>
              New patient?{" "}
              <Link to="/register/patient" className="register-link">
                Register here
              </Link>
            </p>
            <p className="admin-link-p">
              Are you a staff member?{" "}
              <Link to="/login" className="admin-link">
                Staff Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PatientLogin;
