// import React, { useState } from "react";
// import "./Modal.css";
// import { useNavigate } from "react-router-dom";
// import { X } from "lucide-react";

// const DOCTORS_API_URL =
//   "/api/Doctor";

// function AddDoctor() {
//   const navigate = useNavigate();
//   const [form, setForm] = useState({
//     name: "",
//     specialization: "",
//     experience: "0",
//     fees: "0",
//     email: "",
//     phone: "",
//   });
//   const [image, setImage] = useState(null);
//   const [saving, setSaving] = useState(false);
//   const [error, setError] = useState("");

//   const handleChange = (event) => {
//     const { name, value } = event.target;
//     setForm((previous) => ({
//       ...previous,
//       [name]: value,
//     }));
//   };

//   const handleImageChange = (event) => {
//     setImage(event.target.files?.[0] || null);
//   };

//   const parseErrorMessage = async (response) => {
//     const fallback = "Unable to add doctor right now.";

//     try {
//       const text = await response.text();
//       if (!text) return fallback;

//       try {
//         const data = JSON.parse(text);
//         return data?.message || data?.title || text;
//       } catch {
//         return text;
//       }
//     } catch {
//       return fallback;
//     }
//   };

//   const handleSubmit = async (event) => {
//     event.preventDefault();
//     setSaving(true);
//     setError("");

//     const body = new FormData();
//     body.append("Name", form.name.trim());
//     body.append("Specialization", form.specialization.trim());
//     body.append("Experience", String(Number(form.experience) || 0));
//     body.append("Fees", String(Number(form.fees) || 0));
//     body.append("Email", form.email.trim());
//     body.append("Phone", form.phone.trim());
//     body.append("IsActive", "true");

//     if (image) {
//       body.append("Image", image);
//     }

//     try {
//       const response = await fetch(DOCTORS_API_URL, {
//         method: "POST",
//         headers: {
//           "ngrok-skip-browser-warning": "true",
//         },
//         body,
//       });

//       if (!response.ok) {
//         throw new Error(await parseErrorMessage(response));
//       }

//       navigate("/doctors");
//     } catch (submitError) {
//       setError(submitError.message || "Unable to add doctor right now.");
//     } finally {
//       setSaving(false);
//     }
//   };

//   return (
//     <div className="add-doctor-page">
//       <div className="add-doctor-card">
//         <button
//           className="add-doctor-close-button"
//           type="button"
//           aria-label="Close add doctor form"
//           onClick={() => navigate(-1)}
//           disabled={saving}
//         >
//           <X size={22} strokeWidth={2} />
//         </button>

//         <div className="add-doctor-header">
//           <h2>Add Doctor</h2>
//           <p>Enter doctor details below. All fields marked are required.</p>
//         </div>

//         <form className="add-doctor-form" onSubmit={handleSubmit}>
//           <div className="add-doctor-grid">
//             <div className="add-doctor-input-group">
//               <label>Doctor Name</label>
//               <input
//                 name="name"
//                 value={form.name}
//                 onChange={handleChange}
//                 required
//                 autoFocus
//               />
//             </div>

//             <div className="add-doctor-input-group">
//               <label>Specialization</label>
//               <input
//                 name="specialization"
//                 value={form.specialization}
//                 onChange={handleChange}
//                 required
//               />
//             </div>

//             <div className="add-doctor-input-group">
//               <label>Experience (years)</label>
//               <input
//                 name="experience"
//                 type="number"
//                 min="0"
//                 value={form.experience}
//                 onChange={handleChange}
//                 required
//               />
//             </div>

//             <div className="add-doctor-input-group">
//               <label>Consultation Fee ($)</label>
//               <input
//                 name="fees"
//                 type="number"
//                 min="0"
//                 step="0.01"
//                 value={form.fees}
//                 onChange={handleChange}
//                 required
//               />
//             </div>

//             <div className="add-doctor-input-group">
//               <label>Email</label>
//               <input
//                 name="email"
//                 type="email"
//                 value={form.email}
//                 onChange={handleChange}
//                 required
//               />
//             </div>

//             <div className="add-doctor-input-group">
//               <label>Phone</label>
//               <input
//                 name="phone"
//                 value={form.phone}
//                 onChange={handleChange}
//                 required
//               />
//             </div>

//             <div className="add-doctor-input-group add-doctor-input-group-half">
//               <label>Image</label>
//               <input
//                 type="file"
//                 name="Image"
//                 accept="image/*"
//                 onChange={handleImageChange}
//               />
//             </div>
//           </div>

//           {error ? <p className="add-doctor-form-error">{error}</p> : null}

//           <div className="add-doctor-actions">
//             <button
//               className="add-doctor-cancel"
//               type="button"
//               onClick={() => navigate(-1)}
//               disabled={saving}
//             >
//               Cancel
//             </button>
//             <button className="add-doctor-primary" type="submit" disabled={saving}>
//               {saving ? "Adding..." : "Add Doctor"}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }

// export default AddDoctor;




import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Modal.css";
import { useNavigate } from "react-router-dom";
import { Camera, X } from "lucide-react";
import { apiUrl } from "../../config/api";
import { useToast } from "../../components/ToastProvider";
import { getClinicDisplayName } from "../../utils/clinicDisplay";
import {
  onlyAlpha,
  onlyIndianMobileValue,
  onlyNumberValue,
  validateAlpha,
  validateGmail,
  validateImageFile,
  validateMobile,
  validateNumeric,
  validateRequired,
  validateText,
} from "../../utils/validation";
import {
  canUsePermission,
  fetchAndStoreRolePermissions,
} from "../../utils/authorization";
import {
  validateUniqueMobileNumber,
} from "../../utils/mobileUniqueness";
const DOCTORS_API_URL =
  apiUrl("Doctor");

const DEFAULT_DOCTOR_IMAGE_URL =
  "https://posological-bea-subacademically.ngrok-free.dev/images/doctors/c65cac75-3f85-4caa-87db-56cd02670c07.png";

const DOCTOR_SPECIALIZATIONS_API_URL =
  apiUrl("Doctor/specializations");

const DOCTOR_QUALIFICATIONS_API_URL =
  apiUrl("Doctor/qualifications");

const SPECIALIZATION_OPTIONS = [
  "Cardiology",
  "Dermatology",
  "ENT",
  "General Medicine",
  "Gynecology",
  "Neurology",
  "Orthopedics",
  "Pediatrics",
  "Psychiatry",
  "Radiology",
];

const QUALIFICATION_OPTIONS = [
  { value: "MBBS", label: "Bachelor of Medicine and Bachelor of Surgery (MBBS)" },
  { value: "BDS", label: "Bachelor of Dental Surgery (BDS)" },
  { value: "BAMS", label: "Bachelor of Ayurvedic Medicine and Surgery (BAMS)" },
  { value: "BHMS", label: "Bachelor of Homeopathic Medicine and Surgery (BHMS)" },
  { value: "MD", label: "Doctor of Medicine (MD)" },
  { value: "MS", label: "Master of Surgery (MS)" },
  { value: "DNB", label: "Diplomate of National Board (DNB)" },
  { value: "DM", label: "Doctorate of Medicine (DM)" },
  { value: "MCh", label: "Master of Chirurgiae (MCh)" },
  { value: "MCA", label: "Master of Computer Applications (MCA)" },
];

const parseOptionList = (data) => {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;

  return [];
};

const normalizeTextOption = (item) => {
  if (typeof item === "string") return item.trim();
  if (!item || typeof item !== "object") return "";

  return String(
    item.name ||
    item.specialization ||
    item.title ||
    item.label ||
    item.value ||
    ""
  ).trim();
};

const normalizeQualificationOption = (item) => {
  if (typeof item === "string") {
    const valueMatch = item.match(/\(([^)]+)\)\s*$/);
    const value = valueMatch?.[1] || item;
    return {
      value: value.trim(),
      label: item.trim(),
    };
  }

  if (!item || typeof item !== "object") return null;

  const abbreviation = String(
    item.abbreviation ||
    item.code ||
    item.value ||
    item.qualification ||
    item.name ||
    ""
  ).trim();

  const name = String(
    item.name ||
    item.qualificationName ||
    item.title ||
    item.label ||
    item.qualification ||
    abbreviation
  ).trim();

  const label = abbreviation && !name.includes(`(${abbreviation})`)
    ? `${name} (${abbreviation})`
    : name;

  return abbreviation && label
    ? {
      value: abbreviation,
      label,
    }
    : null;
};

const uniqueByValue = (options) => {
  const seen = new Set();

  return options.filter((option) => {
    const value = String(option?.value ?? option ?? "").trim().toLowerCase();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

const formatFeeValue = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const numberValue = Number(text);
  return Number.isNaN(numberValue) ? text : numberValue.toFixed(2);
};

const appendDoctorFormData = (body, values) => {
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      body.append(key, value);
    }
  });
};

function AddDoctor() {
  const navigate = useNavigate();
  const toast = useToast();
  const clinicName = getClinicDisplayName({}, "Clinic");
  const imageInputRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    specialization: "",
    areaofExpertise: "",
    qualification: "",
    experience: "0",
    fees: "0",
    email: "",
    phone: "",
    isActive: "true",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [specializationOptions, setSpecializationOptions] =
    useState(SPECIALIZATION_OPTIONS);
  const [qualificationOptions, setQualificationOptions] =
    useState(QUALIFICATION_OPTIONS);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsWarning, setOptionsWarning] = useState("");
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [permissionRecord, setPermissionRecord] = useState(null);
  const canCreateDoctor = !permissionsLoading && canUsePermission(permissionRecord, "create");

  const doctorInitials = useMemo(
    () =>
      (form.name || "D")
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "D",
    [form.name]
  );

  useEffect(() => {
    let active = true;

    const loadDoctorOptions = async () => {
      try {
        setLoadingOptions(true);
        setOptionsWarning("");

        const [specializationsResponse, qualificationsResponse] =
          await Promise.all([
            fetch(DOCTOR_SPECIALIZATIONS_API_URL, {
              headers: {
                "ngrok-skip-browser-warning": "true",
              },
            }),
            fetch(DOCTOR_QUALIFICATIONS_API_URL, {
              headers: {
                "ngrok-skip-browser-warning": "true",
              },
            }),
          ]);

        if (!active) return;

        if (specializationsResponse.ok) {
          const data = await specializationsResponse.json();
          const options = parseOptionList(data)
            .map(normalizeTextOption)
            .filter(Boolean);

          if (options.length) {
            setSpecializationOptions(
              uniqueByValue(options)
            );
          }
        } else {
          setOptionsWarning("Using saved dropdown options.");
        }

        if (qualificationsResponse.ok) {
          const data = await qualificationsResponse.json();
          const options = parseOptionList(data)
            .map(normalizeQualificationOption)
            .filter(Boolean);

          if (options.length) {
            setQualificationOptions(uniqueByValue(options));
          }
        } else {
          setOptionsWarning("Using saved dropdown options.");
        }
      } catch {
        if (active) {
          setSpecializationOptions(SPECIALIZATION_OPTIONS);
          setQualificationOptions(QUALIFICATION_OPTIONS);
          setOptionsWarning("Using saved dropdown options.");
        }
      } finally {
        if (active) setLoadingOptions(false);
      }
    };

    loadDoctorOptions();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  useEffect(() => {
    let active = true;

    const loadPermissions = async () => {
      setPermissionsLoading(true);
      const record = await fetchAndStoreRolePermissions();
      if (active) {
        setPermissionRecord(record);
        setPermissionsLoading(false);
      }
    };

    loadPermissions();

    return () => {
      active = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name } = event.target;
    let { value } = event.target;

    if (["name", "specialization"].includes(name)) {
      value = onlyAlpha(value);
    }

    if (name === "phone") {
      value = onlyIndianMobileValue(value);
    }

    if (["experience", "fees"].includes(name)) {
      value = onlyNumberValue(value);
      if (name === "experience") {
        value = value.slice(0, 2);
      }
    }

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
    setFieldErrors((previous) => ({ ...previous, [name]: "" }));
    setError("");
  };

  const handleFeeBlur = () => {
    setForm((previous) => ({
      ...previous,
      fees: formatFeeValue(previous.fees),
    }));
  };

  const handleImageChange = (event) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;

    const imageError = validateImageFile(nextFile, "Profile image");
    if (imageError) {
      setFieldErrors((previous) => ({ ...previous, image: imageError }));
      setError("");
      toast.error(imageError);
      return;
    }

    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(nextFile);
    setImagePreview(URL.createObjectURL(nextFile));
    setFieldErrors((previous) => ({ ...previous, image: "" }));
  };

  const parseErrorMessage = async (response) => {
    const fallback = "Unable to add doctor right now.";

    try {
      const text = await response.text();

      if (!text) return fallback;

      try {
        const data = JSON.parse(text);
        return data?.message || data?.title || text;
      } catch {
        return text;
      }
    } catch {
      return fallback;
    }
  };

  const validateForm = (values = form) => {
    const nextErrors = {
      name: validateAlpha(values.name, "Doctor name"),
      specialization: validateAlpha(values.specialization, "Specialization"),
      areaofExpertise: validateText(values.areaofExpertise, "Area of expertise"),
      qualification: validateRequired(values.qualification, "Qualification"),
      experience: validateNumeric(values.experience, "Experience", {
        integer: true,
        max: 99,
      }),
      fees: validateNumeric(values.fees, "Consultation fee"),
      email: validateGmail(values.email, 'Email', { strict: false }),
      phone: validateMobile(values.phone, "Phone"),
      image: validateImageFile(imageFile, "Profile image"),
    };

    Object.keys(nextErrors).forEach((key) => {
      if (!nextErrors[key]) delete nextErrors[key];
    });

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formattedForm = {
      ...form,
      fees: formatFeeValue(form.fees),
    };

    if (formattedForm.fees !== form.fees) {
      setForm(formattedForm);
    }

    if (!canCreateDoctor) {
      const message = permissionsLoading
        ? "Loading permissions. Please try again."
        : "Create permission is disabled by Super Admin.";
      setError(message);
      toast.error(message);
      return;
    }

    if (!validateForm(formattedForm)) {
      setError("Please fix the highlighted fields.");
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const duplicateMobileMessage = await validateUniqueMobileNumber(
      formattedForm.phone
    );

    if (duplicateMobileMessage) {
      setFieldErrors((previous) => ({
        ...previous,
        phone: duplicateMobileMessage,
      }));
      setError(duplicateMobileMessage);
      toast.error(duplicateMobileMessage);
      return;
    }

    setSaving(true);
    setError("");

    const body = {
      name: form.name.trim(),
      specialization: form.specialization.trim(),
      experience: String(Number(form.experience) || 0),
      qualification: form.qualification.trim(),
      consultationFee: Number(formattedForm.fees) || 0,
      areaofExpertise: form.areaofExpertise.trim(),
      email: form.email.trim(),
      phoneNumber: form.phone.trim(),
      isActive: form.isActive === "true",
    };
    const requestPayload = {
      ...body,
      Name: body.name,
      Specialization: body.specialization,
      Experience: body.experience,
      Qualification: body.qualification,
      ConsultationFee: body.consultationFee,
      AreaofExpertise: body.areaofExpertise,
      Email: body.email,
      PhoneNumber: body.phoneNumber,
      IsActive: String(body.isActive),
      image: DEFAULT_DOCTOR_IMAGE_URL,
      imageUrl: DEFAULT_DOCTOR_IMAGE_URL,
      Image: DEFAULT_DOCTOR_IMAGE_URL,
    };
    const requestOptions = imageFile
      ? (() => {
        const formData = new FormData();
        appendDoctorFormData(formData, requestPayload);
        formData.append("Image", imageFile);
        return {
          method: "POST",
          headers: {
            "ngrok-skip-browser-warning": "true",
          },
          body: formData,
        };
      })()
      : {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify(requestPayload),
      };

    try {
      const response = await fetch(DOCTORS_API_URL, {
        ...requestOptions,
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      toast.success("Doctor added successfully");

      navigate("/doctors");
    } catch (submitError) {
      const message = submitError.message || "Unable to add doctor right now.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="add-doctor-page">
      <div className="add-doctor-card">
        <button
          className="add-doctor-close-button"
          type="button"
          aria-label="Close add doctor form"
          onClick={() => navigate("/doctors")}
          disabled={saving}
        >
          <X size={22} strokeWidth={2} />
        </button>

        <div className="add-doctor-header">
          <h2>Add Doctor</h2>
          <p>Enter doctor details below.</p>
        </div>

        <div className="add-doctor-clinic-banner">
          <span>Clinic Name</span>
          <strong>{clinicName}</strong>
        </div>

        <form className="add-doctor-form" onSubmit={handleSubmit} noValidate>
          <div className="doctor-image-upload-area">
            <div className="doctor-image-circle">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Doctor profile preview"
                  className="doctor-image-preview"
                />
              ) : (
                <span>{doctorInitials}</span>
              )}
              <button
                type="button"
                className="doctor-image-picker-btn"
                onClick={() => imageInputRef.current?.click()}
                title="Upload profile image"
                aria-label="Upload profile image"
              >
                <Camera size={18} />
              </button>
              <input
                ref={imageInputRef}
                type="file"
                className="doctor-image-input"
                accept="image/*"
                onChange={handleImageChange}
              />
            </div>
          </div>
          {fieldErrors.image ? (
            <p className="add-doctor-form-error">{fieldErrors.image}</p>
          ) : null}

          <div className="add-doctor-grid">

            <div className="add-doctor-input-group">
              <label>Name</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                className={fieldErrors.name ? "is-invalid" : ""}
                required
              />
              {fieldErrors.name ? (
                <span className="add-doctor-field-error">{fieldErrors.name}</span>
              ) : null}
            </div>

            <div className="add-doctor-input-group">
              <label>Specialization</label>
              <input
                name="specialization"
                list="doctor-specialization-options"
                value={form.specialization}
                onChange={handleChange}
                className={fieldErrors.specialization ? "is-invalid" : ""}
                placeholder={loadingOptions ? "Loading specializations..." : "Type or select specialization"}
                required
              />
              <datalist id="doctor-specialization-options">
                {specializationOptions.map((specialization) => (
                  <option key={specialization} value={specialization}>
                    {specialization}
                  </option>
                ))}
              </datalist>
              {fieldErrors.specialization ? (
                <span className="add-doctor-field-error">
                  {fieldErrors.specialization}
                </span>
              ) : null}
            </div>

            <div className="add-doctor-input-group">
              <label>Experience</label>
              <input
                name="experience"
                type="number"
                min="0"
                max="99"
                step="1"
                value={form.experience}
                onChange={handleChange}
                className={fieldErrors.experience ? "is-invalid" : ""}
                required
              />
              {fieldErrors.experience ? (
                <span className="add-doctor-field-error">
                  {fieldErrors.experience}
                </span>
              ) : null}
            </div>

            <div className="add-doctor-input-group">
              <label>Area of Expertise</label>
              <input
                name="areaofExpertise"
                value={form.areaofExpertise}
                onChange={handleChange}
                className={fieldErrors.areaofExpertise ? "is-invalid" : ""}
                required
              />
              {fieldErrors.areaofExpertise ? (
                <span className="add-doctor-field-error">
                  {fieldErrors.areaofExpertise}
                </span>
              ) : null}
            </div>

            <div className="add-doctor-input-group">
              <label>Qualification</label>
              <input
                name="qualification"
                list="doctor-qualification-options"
                value={form.qualification}
                onChange={handleChange}
                className={fieldErrors.qualification ? "is-invalid" : ""}
                placeholder={loadingOptions ? "Loading qualifications..." : "Type or select qualification"}
                required
              />
              <datalist id="doctor-qualification-options">
                {qualificationOptions.map((qualification) => (
                  <option key={qualification.value} value={qualification.value}>
                    {qualification.label}
                  </option>
                ))}
              </datalist>
              {fieldErrors.qualification ? (
                <span className="add-doctor-field-error">
                  {fieldErrors.qualification}
                </span>
              ) : null}
            </div>

            <div className="add-doctor-input-group">
              <label>Consultation Fee</label>
              <input
                name="fees"
                type="text"
                inputMode="decimal"
                value={form.fees}
                onChange={handleChange}
                onBlur={handleFeeBlur}
                className={`add-doctor-fee-input${fieldErrors.fees ? " is-invalid" : ""}`}
                required
              />
              {fieldErrors.fees ? (
                <span className="add-doctor-field-error">{fieldErrors.fees}</span>
              ) : null}
            </div>

            <div className="add-doctor-input-group">
              <label>Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                className={fieldErrors.email ? "is-invalid" : ""}
                required
              />
              {fieldErrors.email ? (
                <span className="add-doctor-field-error">{fieldErrors.email}</span>
              ) : null}
            </div>

            <div className="add-doctor-input-group">
              <label>Phone Number</label>
              <input
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                inputMode="numeric"
                pattern="^(?!([0-9])\\1{9})[6-9][0-9]{9}$"
                maxLength={10}
                placeholder="10-digit Indian mobile number"
                title="Enter a 10-digit Indian mobile number starting with 6-9 and not all identical digits"
                className={fieldErrors.phone ? "is-invalid" : ""}
                required
              />
              {fieldErrors.phone ? (
                <span className="add-doctor-field-error">{fieldErrors.phone}</span>
              ) : null}
            </div>

            <div className="add-doctor-input-group">
              <label htmlFor="add-doctor-is-active">Is Active</label>
              <select
                id="add-doctor-is-active"
                name="isActive"
                value={form.isActive}
                onChange={handleChange}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

          </div>

          {optionsWarning ? (
            <p className="add-doctor-form-note">{optionsWarning}</p>
          ) : null}

          {error ? (
            <p className="add-doctor-form-error">{error}</p>
          ) : null}

          <div className="add-doctor-actions">
            <button
              className="add-doctor-primary"
              type="submit"
              disabled={saving || !canCreateDoctor}
              title={
                canCreateDoctor
                  ? "Add doctor"
                  : permissionsLoading
                    ? "Loading permissions"
                    : "Permission disabled by Super Admin"
              }
            >
              {saving ? "Adding..." : "Add Doctor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddDoctor;
