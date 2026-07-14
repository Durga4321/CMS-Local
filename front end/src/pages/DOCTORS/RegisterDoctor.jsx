import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import "./RegisterDoctor.css";
import { apiUrl } from "../../config/api";
import PasswordField from "../../components/PasswordField";
import { useToast } from "../../components/ToastProvider";
import {
  onlyAlpha,
  onlyIndianMobileValue,
  validateAlpha,
  validateGmail,
  validateMobile,
  validateSelected,
  validateStrongPassword,
} from "../../utils/validation";
import { getClinicDisplayName } from "../../utils/clinicDisplay";

const DOCTORS_API = apiUrl("Doctor");
const REGISTER_DOCTOR_API = apiUrl("Auth/register-doctor");

const getAdminToken = () =>
  localStorage.getItem("adminToken") || localStorage.getItem("token");

const parseDoctorsResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const getDoctorId = (doctor) => doctor?.id ?? doctor?.doctorId ?? "";

const getDoctorPhone = (doctor) =>
  doctor?.mobileNumber || doctor?.phone || doctor?.mobile || "";

const getEmptyForm = () => ({
  doctorId: "",
  name: "",
  mobileNumber: "",
  email: "",
  password: "",
  role: "Doctor",
});

const parseErrorMessage = async (response, fallback) => {
  try {
    const text = await response.text();
    if (!text) {
      if (response.status === 401) {
        return "Admin session expired. Please login again.";
      }

      return fallback;
    }

    try {
      const data = JSON.parse(text);
      const validationMessages =
        data?.errors && typeof data.errors === "object"
          ? Object.values(data.errors).flat().filter(Boolean).join(" ")
          : "";

      return data?.message || validationMessages || data?.title || text;
    } catch {
      return text;
    }
  } catch {
    return fallback;
  }
};

function RegisterDoctor() {
  const navigate = useNavigate();
  const toast = useToast();
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [doctorError, setDoctorError] = useState("");
  const [form, setForm] = useState(getEmptyForm());
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const selectedDoctor = useMemo(
    () =>
      doctors.find(
        (doctor) => String(getDoctorId(doctor)) === String(form.doctorId)
      ) || null,
    [doctors, form.doctorId]
  );
  const hospitalId = localStorage.getItem("hospitalId") || "";
  const clinicName = getClinicDisplayName({ ...selectedDoctor, hospitalId }, "");

  const fetchDoctors = useCallback(async () => {
    setLoadingDoctors(true);
    setDoctorError("");

    try {
      const token = getAdminToken();
      const headers = {
        "ngrok-skip-browser-warning": "true",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(DOCTORS_API, { headers });
      if (!response.ok) {
        throw new Error(
          await parseErrorMessage(response, "Unable to load doctors.")
        );
      }

      const data = await response.json();
      setDoctors(parseDoctorsResponse(data));
    } catch (fetchError) {
      setDoctorError(fetchError.message || "Unable to load doctors.");
      setDoctors([]);
    } finally {
      setLoadingDoctors(false);
    }
  }, []);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const updateField = (name, value) => {
    let nextValue = value;

    if (name === "name") {
      nextValue = onlyAlpha(value);
    }

    if (name === "mobileNumber") {
      nextValue = onlyIndianMobileValue(value);
    }

    setForm((previous) => ({
      ...previous,
      [name]: nextValue,
    }));

    setFieldErrors((previous) => ({
      ...previous,
      [name]: "",
    }));
    setError("");
    setSuccess("");
  };

  const handleDoctorChange = (event) => {
    const value = event.target.value;
    const doctor = doctors.find(
      (item) => String(getDoctorId(item)) === String(value)
    );

    setForm((previous) => ({
      ...previous,
      doctorId: value,
      name: doctor?.name || "",
      mobileNumber: getDoctorPhone(doctor),
      email: doctor?.email || "",
      role: "Doctor",
    }));
    setFieldErrors({});
    setError("");
    setSuccess("");
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!form.doctorId) {
      nextErrors.doctorId = "Select a doctor.";
    }

    nextErrors.name = validateAlpha(form.name, "Name");
    nextErrors.mobileNumber = validateMobile(form.mobileNumber, "Mobile number");
    nextErrors.email = validateGmail(form.email);
    nextErrors.password = validateStrongPassword(form.password);
    nextErrors.role = validateSelected(form.role, "a role");

    Object.keys(nextErrors).forEach((key) => {
      if (!nextErrors[key]) delete nextErrors[key];
    });

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      setError("Please fix the highlighted fields.");
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const token = getAdminToken();
    if (!token) {
      setSaving(false);
      setError("Admin session missing. Please login again.");
      toast.error("Admin session missing. Please login again.");
      return;
    }

    const doctorId = Number(form.doctorId);
    const name = form.name.trim();
    const mobileNumber = form.mobileNumber.trim();
    const email = form.email.trim();
    const clinicId = hospitalId ? Number(hospitalId) || hospitalId : undefined;

    const payload = {
      doctorId,
      DoctorId: doctorId,
      name,
      Name: name,
      userName: email,
      UserName: email,
      mobileNumber,
      MobileNumber: mobileNumber,
      phone: mobileNumber,
      Phone: mobileNumber,
      phoneNumber: mobileNumber,
      PhoneNumber: mobileNumber,
      email,
      Email: email,
      emailAddress: email,
      EmailAddress: email,
      password: form.password,
      Password: form.password,
      role: "Doctor",
      Role: "Doctor",
      roleName: "Doctor",
      RoleName: "Doctor",
      hospitalId: clinicId,
      HospitalId: clinicId,
      clinicId,
      ClinicId: clinicId,
      hospitalName: clinicName || undefined,
      HospitalName: clinicName || undefined,
      clinicName: clinicName || undefined,
      ClinicName: clinicName || undefined,
    };

    try {
      const headers = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(REGISTER_DOCTOR_API, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          await parseErrorMessage(
            response,
            "Unable to register doctor login right now."
          )
        );
      }

      const data = await response.json().catch(() => ({}));
      const message = data?.message || "Doctor registered successfully";
      setSuccess(message);
      toast.success(message);
      setForm((previous) => ({
        ...previous,
        password: "",
      }));
      navigate("/doctors");
    } catch (submitError) {
      const message =
        submitError.message || "Unable to register doctor login right now.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="register-doctor-page">
      <div className="register-doctor-topbar">
        <button
          type="button"
          className="register-doctor-refresh"
          onClick={fetchDoctors}
          disabled={loadingDoctors || saving}
        >
          <RefreshCw size={16} />
          {loadingDoctors ? "Loading" : "Refresh Doctors"}
        </button>
      </div>

      <div className="register-doctor-header">
        <div className="register-doctor-icon">
          <UserPlus size={24} />
        </div>
        <div>
          <h2>Register Doctor</h2>
          <p>Create the login account for an existing doctor profile.</p>
        </div>
      </div>

      <div className="register-doctor-layout">
        <section className="register-doctor-panel">
          <form className="register-doctor-form" onSubmit={handleSubmit} noValidate>
            <div className="register-doctor-field register-doctor-field-full">
              <label htmlFor="doctorId">Doctor</label>
              <select
                id="doctorId"
                name="doctorId"
                value={form.doctorId}
                onChange={handleDoctorChange}
                disabled={loadingDoctors || saving}
                className={fieldErrors.doctorId ? "is-invalid" : ""}
              >
                <option value="">
                  {loadingDoctors ? "Loading doctors..." : "Select doctor"}
                </option>
                {doctors.map((doctor) => {
                  const id = getDoctorId(doctor);
                  return (
                    <option key={id || doctor.email} value={id}>
                      {doctor.name || "Doctor"} {doctor.email ? `- ${doctor.email}` : ""}
                    </option>
                  );
                })}
              </select>
              {fieldErrors.doctorId ? (
                <span className="register-doctor-field-error">
                  {fieldErrors.doctorId}
                </span>
              ) : null}
              {doctorError ? (
                <span className="register-doctor-field-error">
                  {doctorError}
                </span>
              ) : null}
            </div>

            <div className="register-doctor-field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                name="name"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                className={fieldErrors.name ? "is-invalid" : ""}
                disabled={saving}
              />
              {fieldErrors.name ? (
                <span className="register-doctor-field-error">
                  {fieldErrors.name}
                </span>
              ) : null}
            </div>

            <div className="register-doctor-field">
              <label htmlFor="mobileNumber">Mobile Number</label>
              <input
                id="mobileNumber"
                name="mobileNumber"
                type="tel"
                value={form.mobileNumber}
                onChange={(event) =>
                  updateField("mobileNumber", event.target.value)
                }
                inputMode="numeric"
                pattern="^(?!([0-9])\\1{9})[6-9][0-9]{9}$"
                maxLength={10}
                placeholder="10-digit Indian mobile number"
                title="Enter a 10-digit Indian mobile number starting with 6-9 and not all identical digits"
                className={fieldErrors.mobileNumber ? "is-invalid" : ""}
                disabled={saving}
              />
              {fieldErrors.mobileNumber ? (
                <span className="register-doctor-field-error">
                  {fieldErrors.mobileNumber}
                </span>
              ) : null}
            </div>

            <div className="register-doctor-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className={fieldErrors.email ? "is-invalid" : ""}
                disabled={saving}
              />
              {fieldErrors.email ? (
                <span className="register-doctor-field-error">
                  {fieldErrors.email}
                </span>
              ) : null}
            </div>

            <div className="register-doctor-field">
              <label htmlFor="password">Password</label>
              <PasswordField
                id="password"
                name="password"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                className={fieldErrors.password ? "is-invalid" : ""}
                disabled={saving}
                autoComplete="new-password"
              />
              {fieldErrors.password ? (
                <span className="register-doctor-field-error">
                  {fieldErrors.password}
                </span>
              ) : null}
            </div>

            <div className="register-doctor-field register-doctor-role-field">
              <label htmlFor="role">Role</label>
              <input
                id="role"
                name="role"
                value={form.role}
                readOnly
                className={fieldErrors.role ? "is-invalid" : ""}
              />
              {fieldErrors.role ? (
                <span className="register-doctor-field-error">
                  {fieldErrors.role}
                </span>
              ) : null}
            </div>

            {success ? (
              <div className="register-doctor-success">{success}</div>
            ) : null}

            {error ? <div className="register-doctor-error">{error}</div> : null}

            <div className="register-doctor-actions">
              <button
                type="submit"
                className="register-doctor-submit"
                disabled={saving || loadingDoctors}
              >
                <UserPlus size={16} />
                {saving ? "Registering..." : "Register Doctor"}
              </button>
            </div>
          </form>
        </section>

        <aside className="register-doctor-summary">
          <div className="register-doctor-summary-icon">
            <ShieldCheck size={22} />
          </div>
          <h3>Selected Doctor</h3>
          {selectedDoctor ? (
            <div className="register-doctor-summary-list">
              <div>
                <span>Name</span>
                <b>{selectedDoctor.name || "-"}</b>
              </div>
              <div>
                <span>Email</span>
                <b>{selectedDoctor.email || "-"}</b>
              </div>
              <div>
                <span>Mobile</span>
                <b>{getDoctorPhone(selectedDoctor) || "-"}</b>
              </div>
              <div>
                <span>Doctor ID</span>
                <b>{getDoctorId(selectedDoctor) || "-"}</b>
              </div>
            </div>
          ) : (
            <p className="register-doctor-muted">
              Choose a doctor from the dropdown to fill the account details.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

export default RegisterDoctor;
