import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import clinicBg from "../../assests/clinic-bg.jpg";
// Using shared auth styles for registration layout
import { apiUrl, patientApiUrl, PATIENT_API } from "../../config/api";
import { useToast } from "../../components/ToastProvider";
import PasswordField from "../../components/PasswordField";
import { buildAddress, emptyAddressParts, onlyPincodeValue } from "../../utils/address";
import { INDIA_COUNTRY } from "../../utils/indianLocations";
import { fetchPincodeLocation } from "../../utils/pincodeLocation";
import "./PatientRegister.css";

function PatientRegister() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dob: "",
    mobile: "",
    email: "",
    address: "",
    addressParts: emptyAddressParts,
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    document.body.classList.add('auth-page-no-scroll');
    return () => {
      document.body.classList.remove('auth-page-no-scroll');
    };
  }, []);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [areaOptions, setAreaOptions] = useState([]);

  const visibleAreaOptions = Array.from(
    [form.addressParts?.area, ...areaOptions].filter(Boolean)
  );

  const handleChange = (event) => {
    const { name } = event.target;
    let { value } = event.target;

    if (name === "mobile") {
      value = value.replace(/\D/g, "").slice(0, 10);
    }

    if (name === "firstName" || name === "lastName") {
      value = value.replace(/[^a-zA-Z\s]/g, "");
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
      return next;
    });
    setSuccess(false);
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
    setSuccess(false);
  };

  const validate = () => {
    const nextErrors = {};
    const requiredFields = {
      firstName: "First name is required.",
      lastName: "Last name is required.",
      gender: "Please select gender.",
      dob: "Date of birth is required.",
      mobile: "Mobile number is required.",
      email: "Email is required.",
      streetVillage: "Street / Village is required.",
      area: "Area is required.",
      pincode: "Pincode is required.",
      address: "Address is required.",
      password: "Password is required.",
      confirmPassword: "Confirm password is required.",
    };

    Object.entries(requiredFields).forEach(([field, message]) => {
      if (field === 'streetVillage' || field === 'area' || field === 'pincode') {
        const value = form.addressParts?.[field] || "";
        if (!String(value).trim()) {
          nextErrors[field] = message;
        }
      } else {
        const value = form[field];
        if (!String(value || "").trim()) {
          nextErrors[field] = message;
        }
      }
    });

    if (form.firstName && !/^[a-zA-Z\s]+$/.test(form.firstName)) {
      nextErrors.firstName = "Only alphabets are allowed.";
    }

    if (form.lastName && !/^[a-zA-Z\s]+$/.test(form.lastName)) {
      nextErrors.lastName = "Only alphabets are allowed.";
    }

    if (form.mobile && !/^\d{10}$/.test(form.mobile)) {
      nextErrors.mobile = "Enter a valid 10 digit mobile number.";
    }

    if (form.addressParts?.pincode && !/^\d{6}$/.test(form.addressParts.pincode)) {
      nextErrors.pincode = "Pincode must be exactly 6 digits.";
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (form.password && form.password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters.";
    }

    if (form.password && form.confirmPassword && form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const PATIENT_REGISTER_PATHS = [
    PATIENT_API.register,
    PATIENT_API.registerAlt,
    PATIENT_API.registerUser,
    PATIENT_API.patientRegister,
    PATIENT_API.patientsRegister,
  ];

  useEffect(() => {
    const pincode = form.addressParts?.pincode || "";
    if (pincode.length !== 6) {
      setAreaOptions([]);
      return undefined;
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
        setErrors((current) => ({
          ...current,
          pincode: "",
        }));
      })
      .catch((lookupError) => {
        if (!active) return;
        setAreaOptions([]);
        setErrors((current) => ({
          ...current,
          pincode: lookupError.message || "Unable to fetch pincode location.",
        }));
      });

    return () => {
      active = false;
    };
  }, [form.addressParts?.pincode]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validate()) {
      setSuccess(false);
      return;
    }

    const doRegister = async () => {
      try {
        const payload = {
          firstName: form.firstName,
          lastName: form.lastName,
          gender: form.gender,
          dateOfBirth: form.dob,
          mobileNumber: form.mobile,
          email: form.email,
          streetVillage: form.addressParts?.streetVillage,
          area: form.addressParts?.area,
          address: form.address,
          pincode: form.addressParts?.pincode || "",
          password: form.password,
          confirmPassword: form.confirmPassword,
        };

        let finalResponse = null;
        let finalData = {};
        let endpointUsed = null;

        for (const path of PATIENT_REGISTER_PATHS) {
          endpointUsed = path;
          const resp = await fetch(apiUrl(path), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          finalData = await resp.json().catch(() => ({}));
          if (resp.ok) {
            finalResponse = resp;
            break;
          }

          if (resp.status !== 404) {
            finalResponse = resp;
            break;
          }
        }

        if (!finalResponse || !finalResponse.ok) {
          const message = finalData.message || finalData.error || 'Registration failed. Please try again.';
          toast?.error ? toast.error(message) : setErrors({ api: message });
          setSuccess(false);
          return;
        }

        setSuccess(true);
        toast?.success ? toast.success('Registration successful. Please login.') : null;
        navigate('/login', { replace: true, state: { message: 'Registration successful. Please login.', email: form.email } });
      } catch (err) {
        const message = err?.message || 'Unable to reach server. Try again later.';
        toast?.error ? toast.error(message) : setErrors({ api: message });
        setSuccess(false);
      }
    };

    doRegister();
  };

  return (
    <div className="auth-container register-page">
      <div
        className="auth-bg"
        style={{ backgroundImage: `url(${clinicBg})` }}
        aria-hidden="true"
      />
      <div className="auth-veil" aria-hidden="true" />

      <div className="auth-card auth-card--wide patient-register-card">
        <div className="patient-register-header">
          <h2>Create account</h2>
          <p className="subtitle">Create your account and reveal the hospital fields when Admin is selected.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="register-grid">
            <div className="form-group">
              <label htmlFor="firstName">First Name</label>
              <input id="firstName" name="firstName" value={form.firstName} onChange={handleChange} placeholder="First Name" />
              {errors.firstName ? <span className="error-message">{errors.firstName}</span> : null}
            </div>

            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <input id="lastName" name="lastName" value={form.lastName} onChange={handleChange} placeholder="Last Name" />
              {errors.lastName ? <span className="error-message">{errors.lastName}</span> : null}
            </div>

            <div className="form-group">
              <label htmlFor="gender">Select Gender</label>
              <select id="gender" name="gender" value={form.gender} onChange={handleChange}>
                <option value="">Select Gender</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
              {errors.gender ? <span className="error-message">{errors.gender}</span> : null}
            </div>

            <div className="form-group">
              <label htmlFor="dob">Date of birth</label>
              <input id="dob" type="date" name="dob" value={form.dob} onChange={handleChange} />
              {errors.dob ? <span className="error-message">{errors.dob}</span> : null}
            </div>
          </div>

          <div className="register-grid register-grid--spaced">
                <div className="form-group">
              <label htmlFor="mobile">Mobile Number</label>
              <input id="mobile" name="mobile" value={form.mobile} onChange={handleChange} placeholder="Mobile Number" inputMode="numeric" maxLength={10} />
              {errors.mobile ? <span className="error-message">{errors.mobile}</span> : null}
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" name="email" value={form.email} onChange={handleChange} placeholder="Email" />
              {errors.email ? <span className="error-message">{errors.email}</span> : null}
            </div>

            <div className="form-group">
              <label htmlFor="streetVillage">Street / Village</label>
              <input id="streetVillage" name="streetVillage" value={form.addressParts.streetVillage} onChange={handleChange} placeholder="Street / Village" />
              {errors.streetVillage ? <span className="error-message">{errors.streetVillage}</span> : null}
            </div>

            <div className="form-group">
              <label htmlFor="area">Area</label>
              <select
                id="area"
                name="area"
                value={form.addressParts.area}
                onChange={handleChange}
                disabled={!visibleAreaOptions.length}
              >
                <option value="">Select Area</option>
                {visibleAreaOptions.map((option, index) => (
                  <option key={`${option}-${index}`} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {errors.area ? <span className="error-message">{errors.area}</span> : null}
            </div>

            <div className="form-group">
              <label htmlFor="pincode">Pincode</label>
              <input id="pincode" name="pincode" value={form.addressParts.pincode} onChange={(event) => handlePincodeChange(event.target.value)} placeholder="Pincode" inputMode="numeric" maxLength={6} />
              {errors.pincode ? <span className="error-message">{errors.pincode}</span> : null}
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="address">Address</label>
              <textarea id="address" name="address" value={form.address} onChange={handleChange} placeholder="Address" />
              {errors.address ? <span className="error-message">{errors.address}</span> : null}
            </div>
          </div>

          <div className="register-grid register-grid--spaced">
              <div className="form-group">
              <label htmlFor="password">Password</label>
              <PasswordField
                id="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Password"
              />
              {errors.password ? <span className="error-message">{errors.password}</span> : null}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <PasswordField
                id="confirmPassword"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm Password"
              />
              {errors.confirmPassword ? <span className="error-message">{errors.confirmPassword}</span> : null}
            </div>
          </div>

          {success ? <div className="register-success">Registration completed successfully.</div> : null}

          <div className="register-terms">
            <label>
              <input type="checkbox" name="agree" />
              <span>I agree to the terms & conditions</span>
            </label>
          </div>

          <div className="register-actions">
            <button type="submit" className="submit-btn submit-btn--block">Register</button>
          </div>

          <div className="register-login-link">
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>Already have account? <Link to="/login" className="login-link">Login</Link></p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PatientRegister;
