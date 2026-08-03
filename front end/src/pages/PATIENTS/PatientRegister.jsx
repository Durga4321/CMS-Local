import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiUrl, patientApiUrl, PATIENT_API } from "../../config/api";
import { useToast } from "../../components/ToastProvider";
import PasswordField from "../../components/PasswordField";
import { buildAddress, emptyAddressParts, onlyPincodeValue } from "../../utils/address";
import { INDIA_COUNTRY } from "../../utils/indianLocations";
import { fetchPincodeLocation } from "../../utils/pincodeLocation";
import { formatTitleCase } from "../../utils/format";
import { validateStrongPassword, validateEmail, validateName, validateText } from "../../utils/validation";
import { validateUniqueMobileNumber } from "../../utils/mobileUniqueness";
import { ChevronRight, ChevronLeft, Check, Heart } from "lucide-react";
import clinicBg from '../../assests/clinic-bg.jpg';
import "../../Login/styles/Auth.css";

const REGISTER_API = apiUrl("patient-portal/register");

const DOB_REGEX = /^(\d{2})\/(\d{2})\/(\d{2,4})$/;
const MAX_DOB_AGE = 100;
const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export const validateDobValue = (value) => {
  if (!value?.trim()) return "Date of birth is required.";

  const input = String(value).trim();
  let date = null;

  if (DOB_REGEX.test(input)) {
    const [, day, month, yearPart] = input.match(DOB_REGEX);
    const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
    date = new Date(`${year}-${month}-${day}T00:00:00`);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    date = new Date(`${input}T00:00:00`);
  } else {
    return "Use DD/MM/YYYY or browser date picker.";
  }

  if (!date || Number.isNaN(date.getTime())) return "Enter a valid date of birth.";

  const parsedYear = date.getFullYear();
  const parsedMonth = String(date.getMonth() + 1).padStart(2, "0");
  const parsedDay = String(date.getDate()).padStart(2, "0");

  if (DOB_REGEX.test(input)) {
    const [, day, month, yearPart] = input.match(DOB_REGEX);
    const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
    if (parsedDay !== day || parsedMonth !== month || String(parsedYear) !== year) {
      return "Enter a valid date of birth.";
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date > today) return "Date of birth cannot be in the future.";

  const age = today.getFullYear() - date.getFullYear() -
    (today.getMonth() < date.getMonth() ||
    (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())
      ? 1
      : 0);

  if (age > MAX_DOB_AGE) {
    return `Enter a realistic date of birth. Age must be ${MAX_DOB_AGE} years or less.`;
  }

  return "";
};

function PatientRegister() {
  const navigate = useNavigate();
  const toast = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    bloodGroup: "",
    dob: "",
    mobile: "",
    email: "",
    address: "",
    hospitalId: "",
    addressParts: emptyAddressParts,
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [areaOptions, setAreaOptions] = useState([]);
  const [clinics, setClinics] = useState([]);

  const normalizeDobInput = (value) => {
    const input = String(value || "").trim();
    if (DOB_REGEX.test(input)) {
      const [, day, month, yearPart] = input.match(DOB_REGEX);
      const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
      return `${year}-${month}-${day}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      return input;
    }
    return input;
  };

  const getDobPayloadValue = (value) => {
    const input = String(value || "").trim();
    if (DOB_REGEX.test(input)) {
      const [, day, month, yearPart] = input.match(DOB_REGEX);
      const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
      return `${year}-${month}-${day}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      return input;
    }
    return value;
  };

  const [loadingClinics, setLoadingClinics] = useState(true);

  const visibleAreaOptions = Array.from(
    [form.addressParts?.area, ...areaOptions].filter(Boolean)
  );

  const extractArrayFromResponse = (value) => {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "object") return null;

    const preferredKeys = [
      "clinics",
      "items",
      "data",
      "result",
      "results",
      "branches",
      "values",
    ];

    for (const key of preferredKeys) {
      const extracted = extractArrayFromResponse(value[key]);
      if (Array.isArray(extracted)) return extracted;
    }

    for (const key of Object.keys(value)) {
      const extracted = extractArrayFromResponse(value[key]);
      if (Array.isArray(extracted)) return extracted;
    }

    return null;
  };

  const fetchClinicList = async (url, headers, signal) => {
    try {
      const response = await fetch(url, { headers, signal });
      console.debug("loadClinics: fetching", url, { status: response?.status });
      if (!response?.ok) {
        console.warn("loadClinics: non-ok status", response?.status, url);
        return null;
      }
      const data = await response.json().catch(() => null);
      console.debug("loadClinics: response data", { url, data });
      const list = extractArrayFromResponse(data) || [];
      return Array.isArray(list) ? list : [];
    } catch (err) {
      if (err && err.name === "AbortError") {
        console.warn("loadClinics: request aborted (timeout)");
      } else {
        console.error("loadClinics: fetch error", err, url);
      }
      return null;
    }
  };

  // Fetch clinics on mount
  useEffect(() => {
    let mounted = true;
    const loadClinics = async () => {
      setLoadingClinics(true);
      const token = localStorage.getItem("patientToken") || localStorage.getItem("token") || "";
      const headers = { "ngrok-skip-browser-warning": "true" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        const primaryUrl = patientApiUrl(PATIENT_API.clinics);
        let list = await fetchClinicList(primaryUrl, headers, controller.signal);

        if (list === null || list.length === 0) {
          const fallbackUrl = apiUrl("Clinics");
          console.debug("loadClinics: primary endpoint returned no data, trying fallback", fallbackUrl);
          const fallbackList = await fetchClinicList(fallbackUrl, headers, controller.signal);
          if (Array.isArray(fallbackList) && fallbackList.length > 0) {
            list = fallbackList;
          }
        }

        if (!mounted) return;

        const normalized = (list || []).map((c) => {
          const id = c?.id || c?.clinicId || c?.hospitalId || c?.branchId || c?._id || "";
          const name = c?.name || c?.clinicName || c?.hospitalName || c?.branchName || c?.label || "Clinic";
          return { id: String(id), name };
        }).filter((x) => x && x.id);

        setClinics(normalized);
      } finally {
        clearTimeout(timeoutId);
        if (mounted) setLoadingClinics(false);
      }
    };

    loadClinics();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch location from pincode
  useEffect(() => {
    const pincode = form.addressParts?.pincode || "";
    if (pincode.length !== 6) {
      setAreaOptions([]);
      return;
    }

    let active = true;
    fetchPincodeLocation(pincode)
      .then((location) => {
        if (!active) return;
        setAreaOptions(location.areaOptions);
        setForm((current) => {
          const previousParts = current.addressParts || emptyAddressParts;
          if (previousParts.pincode !== pincode) return current;

          const addressParts = {
            ...previousParts,
            area: previousParts.area || location.area,
            city: location.city || previousParts.city,
            state: location.state || previousParts.state,
            country: location.country || INDIA_COUNTRY,
            pincode,
          };
          return {
            ...current,
            addressParts,
            address: buildAddress(addressParts),
          };
        });
        setErrors((current) => ({ ...current, pincode: "" }));
      })
      .catch((lookupError) => {
        if (!active) return;
        setAreaOptions([]);
        setErrors((current) => ({
          ...current,
          pincode: lookupError.message || "Invalid pincode.",
        }));
      });

    return () => {
      active = false;
    };
  }, [form.addressParts?.pincode]);

  const handleChange = (event) => {
    const { name } = event.target;
    let { value } = event.target;

    if (name === "mobile") {
      value = value.replace(/\D/g, "").slice(0, 10);
    }

    if (name === "dob") {
      value = normalizeDobInput(value);
    }

    if (name === "firstName" || name === "lastName") {
      value = formatTitleCase(value.replace(/[^a-zA-Z\s]/g, ""));
    }

    if (name === "streetVillage" || name === "area") {
      setForm((current) => {
        const addressParts = {
          ...current.addressParts,
          [name]: value,
        };
        return {
          ...current,
          addressParts,
          address: buildAddress(addressParts),
        };
      });
    } else {
      setForm((current) => ({ ...current, [name]: value }));
    }

    setErrors((current) => {
      const next = { ...current };
      delete next[name];
      delete next.api;

      if (name === "email") {
        const emailError = validateEmail(value.trim(), "Email");
        if (emailError) {
          next.email = emailError;
        }
      }

      if (name === "firstName" || name === "lastName") {
        const fieldLabel = name === "firstName" ? "First name" : "Last name";
        const nameError = validateName(value, fieldLabel);
        if (nameError) {
          next[name] = nameError;
        }
      }

      if (name === "mobile" && value && !/^\d{10}$/.test(value)) {
        next.mobile = "Enter a valid 10 digit mobile number.";
      }

      if (name === "streetVillage" && value.trim()) {
        const streetError = validateText(value, "Street/Village");
        if (streetError) {
          next.streetVillage = streetError;
        }
      }

      if (name === "address" && value.trim()) {
        const addressError = validateText(value, "Full address");
        if (addressError) {
          next.address = addressError;
        }
      }

      return next;
    });
  };

  const handleBlur = (event) => {
    const { name, value } = event.target;
    if (name === "email") {
      const emailError = validateEmail(value, "Email");
      setErrors((current) => {
        const next = { ...current };
        if (emailError) {
          next.email = emailError;
        } else {
          delete next.email;
        }
        return next;
      });
    }
  };

  const handlePincodeChange = (value) => {
    const nextValue = onlyPincodeValue(value);
    setForm((current) => {
      const previousParts = current.addressParts || emptyAddressParts;
      const addressParts = {
        ...previousParts,
        pincode: nextValue,
        country: INDIA_COUNTRY,
      };

      if (previousParts.pincode !== nextValue) {
        addressParts.area = "";
      }

      return {
        ...current,
        addressParts,
        address: buildAddress(addressParts),
      };
    });
    setAreaOptions([]);
    setErrors((current) => ({
      ...current,
      address: "",
      pincode: "",
    }));
  };

  const validateStep = (step) => {
    const nextErrors = {};

    if (step === 1) {
      if (!form.hospitalId) nextErrors.hospitalId = "Please select a clinic.";
      const firstNameError = validateName(form.firstName, "First name");
      if (firstNameError) nextErrors.firstName = firstNameError;
      const lastNameError = validateName(form.lastName, "Last name");
      if (lastNameError) nextErrors.lastName = lastNameError;
      if (!form.gender) nextErrors.gender = "Please select gender.";
      if (!form.bloodGroup) nextErrors.bloodGroup = "Please select a blood group.";
      const dobError = validateDobValue(form.dob);
      if (dobError) nextErrors.dob = dobError;
    }

    if (step === 2) {
      if (!form.mobile) nextErrors.mobile = "Mobile number is required.";
      if (!form.email.trim()) nextErrors.email = "Email is required.";
      if (!form.addressParts?.streetVillage?.trim()) nextErrors.streetVillage = "Street/Village is required.";
      if (!form.addressParts?.area) nextErrors.area = "Area is required.";
      if (!form.addressParts?.pincode) nextErrors.pincode = "Pincode is required.";
      if (!form.address.trim()) nextErrors.address = "Full address is required.";

      if (form.mobile && !/^\d{10}$/.test(form.mobile)) {
        nextErrors.mobile = "Enter a valid 10 digit mobile number.";
      }
      if (form.addressParts?.pincode && !/^\d{6}$/.test(form.addressParts.pincode)) {
        nextErrors.pincode = "Pincode must be exactly 6 digits.";
      }
      if (form.email) {
        const emailError = validateEmail(form.email.trim(), "Email");
        if (emailError) nextErrors.email = emailError;
      }
      if (form.addressParts?.streetVillage?.trim()) {
        const streetError = validateText(form.addressParts.streetVillage, "Street/Village");
        if (streetError) nextErrors.streetVillage = streetError;
      }
      if (form.address.trim()) {
        const addressError = validateText(form.address, "Full address");
        if (addressError) nextErrors.address = addressError;
      }
    }

    if (step === 3) {
      const passwordError = validateStrongPassword(form.password, "Password");
      if (passwordError) nextErrors.password = passwordError;

      if (!form.confirmPassword) {
        nextErrors.confirmPassword = "Confirm password is required.";
      } else if (form.password && form.confirmPassword && form.password !== form.confirmPassword) {
        nextErrors.confirmPassword = "Passwords do not match.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => prev + 1);
    } else {
      toast.error("Please fill in all details correctly.");
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleBackNavigation = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/login/patient");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateStep(3)) {
      toast.error("Please check your passwords.");
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    const payload = {
      firstName: formatTitleCase(form.firstName.trim()),
      lastName: formatTitleCase(form.lastName.trim()),
      gender: form.gender,
      bloodGroup: form.bloodGroup,
      dateOfBirth: getDobPayloadValue(form.dob),
      mobileNumber: form.mobile,
      email: form.email.trim(),
      address: form.address.trim(),
      hospitalId: Number(form.hospitalId) || 0,
      password: form.password,
      confirmPassword: form.confirmPassword,
    };

    try {
      const duplicateMobileMessage = await validateUniqueMobileNumber(payload.mobileNumber, {
        localSource: "Patient",
      });
      if (duplicateMobileMessage) {
        setErrors({ mobile: duplicateMobileMessage });
        toast.error(duplicateMobileMessage);
        setIsSubmitting(false);
        setCurrentStep(2);
        return;
      }

      const response = await fetch(REGISTER_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = data.message || data.error || "Registration failed. Try again.";
        setErrors({ api: message });
        toast.error(message);
        return;
      }

      toast.success("Account created successfully! Please login.");
      navigate("/login/patient", {
        replace: true,
        state: { message: "Registration successful. Please login.", email: form.email },
      });
    } catch (err) {
      const message = err?.message || "Unable to reach server. Try again later.";
      setErrors({ api: message });
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div
        className="auth-bg"
        style={{ backgroundImage: `url(${clinicBg})` }}
        aria-hidden="true"
      />
      <div className="auth-veil" aria-hidden="true" />

      <div className={`auth-card auth-card--compact-register`}>
        {/* <div className="auth-logo" aria-hidden="true">
          <Heart size={20} />
        </div> */}

        <h2>Register Here</h2>
        <p className="subtitle">Step {currentStep} of 3</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {/* STEP 1 */}
          {currentStep === 1 && (
            <div>
              <div className="form-group">
                <label htmlFor="reg-clinic">Select Clinic/Hospital</label>
                <select id="reg-clinic" name="hospitalId" value={form.hospitalId} onChange={handleChange} disabled={loadingClinics}>
                  {loadingClinics ? (
                    <option value="">Loading clinics...</option>
                  ) : clinics && clinics.length > 0 ? (
                    <>
                      <option value="">Select Clinic</option>
                      {clinics.map((clinic) => (
                        <option key={clinic.id} value={clinic.id}>{clinic.name}</option>
                      ))}
                    </>
                  ) : (
                    <option value="">No clinics available</option>
                  )}
                </select>
                {errors.hospitalId && <span className="error-message">{errors.hospitalId}</span>}
              </div>

              <div className="register-grid">
                <div className="form-group">
                  <label htmlFor="reg-first">First Name</label>
                  <input id="reg-first" name="firstName" value={form.firstName} onChange={handleChange} placeholder="John" />
                  {errors.firstName && <span className="error-message">{errors.firstName}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="reg-last">Last Name</label>
                  <input id="reg-last" name="lastName" value={form.lastName} onChange={handleChange} placeholder="Doe" />
                  {errors.lastName && <span className="error-message">{errors.lastName}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="reg-gender">Gender</label>
                  <select id="reg-gender" name="gender" value={form.gender} onChange={handleChange}>
                    <option value="">Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.gender && <span className="error-message">{errors.gender}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="reg-blood-group">Blood Group</label>
                  <select
                    id="reg-blood-group"
                    name="bloodGroup"
                    value={form.bloodGroup}
                    onChange={handleChange}
                  >
                    <option value="">Select blood group</option>
                    {BLOOD_GROUP_OPTIONS.map((bloodGroup) => (
                      <option key={bloodGroup} value={bloodGroup}>{bloodGroup}</option>
                    ))}
                  </select>
                  {errors.bloodGroup && <span className="error-message">{errors.bloodGroup}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="reg-dob">DOB</label>
                  <input id="reg-dob" type="date" name="dob" value={form.dob} onChange={handleChange} placeholder="dd-mm-yyyy" />
                  {errors.dob && <span className="error-message">{errors.dob}</span>}
                </div>
              </div>

              <div className="form-actions-row form-actions-row--end">
                <button type="button" className="submit-btn submit-btn--block" onClick={handleNext}>Next Step</button>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {currentStep === 2 && (
            <div>
              <div className="register-grid">
                <div className="form-group">
                  <label htmlFor="reg-mobile">Mobile</label>
                  <input id="reg-mobile" name="mobile" value={form.mobile} onChange={handleChange} placeholder="9876543210" maxLength={10} />
                  {errors.mobile && <span className="error-message">{errors.mobile}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="reg-pincode">Pincode</label>
                  <input id="reg-pincode" name="pincode" value={form.addressParts.pincode} onChange={(e) => handlePincodeChange(e.target.value)} placeholder="50123" maxLength={6} />
                  {errors.pincode && <span className="error-message">{errors.pincode}</span>}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="reg-email">Email Address</label>
                <input id="reg-email" type="email" name="email" value={form.email} onChange={handleChange} onBlur={handleBlur} placeholder="john.doe@gmail.com" />
                {errors.email && <span className="error-message">{errors.email}</span>}
              </div>

              <div className="register-grid">
                <div className="form-group">
                  <label htmlFor="reg-street">Street / Village</label>
                  <input id="reg-street" name="streetVillage" value={form.addressParts.streetVillage} onChange={handleChange} placeholder="Street name" />
                  {errors.streetVillage && <span className="error-message">{errors.streetVillage}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="reg-area">Area</label>
                  <select id="reg-area" name="area" value={form.addressParts.area} onChange={handleChange} disabled={!visibleAreaOptions.length}>
                    <option value="">Select Area</option>
                    {visibleAreaOptions.map((option, idx) => <option key={idx} value={option}>{option}</option>)}
                  </select>
                  {errors.area && <span className="error-message">{errors.area}</span>}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="reg-address">Full Address</label>
                <textarea id="reg-address" name="address" value={form.address} onChange={handleChange} placeholder="Building, street details" rows={2} />
                {errors.address && <span className="error-message">{errors.address}</span>}
              </div>

              <div className="form-actions-row">
                <button type="button" className="back-button" onClick={handleBack} disabled={isSubmitting}>Back</button>
                <button type="button" className="submit-btn submit-btn--block" onClick={handleNext}>Next Step</button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {currentStep === 3 && (
            <div>
              <div className="form-group">
                <label htmlFor="reg-pass">Password</label>
                <PasswordField id="reg-pass" name="password" value={form.password} onChange={handleChange} placeholder="Enter strong password" />
                {errors.password && <span className="error-message">{errors.password}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="reg-confirm">Confirm Password</label>
                <PasswordField id="reg-confirm" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} placeholder="Re-enter password" />
                {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
              </div>

              {errors.api && <div className="api-error-banner">{errors.api}</div>}

              <div className="form-actions-row">
                <button type="button" className="back-button" onClick={handleBack} disabled={isSubmitting}>Back</button>
                <button type="submit" className="submit-btn submit-btn--block" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Complete Registration'}</button>
              </div>
            </div>
          )}
        </form>

        <div className="auth-register-row">
          <p className="auth-register">Already have account? <Link to="/login/patient" className="create-account-link">Login here</Link></p>
        </div>
      </div>
    </div>
  );
}

export default PatientRegister;
