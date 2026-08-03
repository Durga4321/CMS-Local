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
import { formatTitleCase } from "../../utils/format";
import { getClinicDisplayName } from "../../utils/clinicDisplay";
import {
  buildBranchOptions,
  fetchBranchesForHospital,
  getApiHeaders,
  getJsonHeaders,
  getStoredHospitalId,
} from "../../utils/branchApi";
import {
  onlyAlpha,
  onlyIndianMobileValue,
  onlyNumberValue,
  validateAlpha,
  validateGmail,
  validateImageFile,
  validateMobile,
  validateNumeric,
  validateSelected,
  validateText,
} from "../../utils/validation";
import {
  validateUniqueMobileNumber,
} from "../../utils/mobileUniqueness";
import {
  SPECIALIZATION_OPTIONS,
  getExpertiseOptionsForSpecialization,
  getSpecializationDisplayName,
} from "./doctorExpertiseOptions";
const DOCTORS_API_URL =
  apiUrl("Doctor");

const DOCTOR_SPECIALIZATIONS_API_URL =
  apiUrl("Doctor/specializations");

const DOCTOR_QUALIFICATIONS_API_URL =
  apiUrl("Doctor/qualifications");

const getBranchAssignmentId = (branch = {}) => {
  if (branch === null || branch === undefined) return 0;
  if (typeof branch !== "object") return Number(branch) || 0;
  return Number(
    branch.id ??
      branch.Id ??
      branch.branchId ??
      branch.BranchId ??
      branch.branchID ??
      branch.BranchID ??
      branch.clinicBranchId ??
      branch.ClinicBranchId ??
      0
  ) || 0;
};

const readBranchAssignmentIds = (data) => {
  if (Array.isArray(data)) {
    return data.map(getBranchAssignmentId).filter((id) => id > 0);
  }

  if (Array.isArray(data?.branchIds)) {
    return data.branchIds.map(getBranchAssignmentId).filter((id) => id > 0);
  }

  if (Array.isArray(data?.Branches)) {
    return data.Branches.map(getBranchAssignmentId).filter((id) => id > 0);
  }

  if (Array.isArray(data?.branches)) {
    return data.branches.map(getBranchAssignmentId).filter((id) => id > 0);
  }

  return [];
};

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

const isApprovedSpecializationOption = (value) =>
  SPECIALIZATION_OPTIONS.some(
    (option) => option.toLowerCase() === String(value || "").trim().toLowerCase()
  );

const formatValidationMessage = (message) =>
  String(message || "")
    .replace(/^The\s+/i, "")
    .replace(/\s+field\s+is\s+required\.?$/i, " is required.")
    .trim();

const getApiErrorKey = (key) => {
  const normalized = String(key || "")
    .split(".")
    .pop()
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

  const map = {
      branchid: "branchIds",
      branchids: "branchIds",
    email: "email",
    phonenumber: "phone",
    phone: "phone",
    image: "image",
  };

  return map[normalized] || "form";
};

function AddDoctor() {
  const navigate = useNavigate();
  const toast = useToast();
  const hospitalId = getStoredHospitalId();
  const clinicName = getClinicDisplayName({}, "Clinic");
  const imageInputRef = useRef(null);

  const [form, setForm] = useState({
    branchIds: [],
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
  const [fieldErrors, setFieldErrors] = useState({});
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [specializationOptions, setSpecializationOptions] =
    useState(SPECIALIZATION_OPTIONS);
  const [qualificationOptions, setQualificationOptions] =
    useState(QUALIFICATION_OPTIONS);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsWarning, setOptionsWarning] = useState("");
  const [branchOptions, setBranchOptions] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [branchWarning, setBranchWarning] = useState("");
  useEffect(() => {
    const firstErrorKey = Object.keys(fieldErrors).find((key) => fieldErrors[key]);
    if (!firstErrorKey) return;

    const selector =
      firstErrorKey === "image"
        ? ".doctor-image-circle"
        : `[name="${firstErrorKey === "fees" ? "fees" : firstErrorKey}"]`;
    const field = document.querySelector(selector);
    field?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [fieldErrors]);

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

  const expertiseOptions = useMemo(
    () => getExpertiseOptionsForSpecialization(form.specialization),
    [form.specialization]
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
              uniqueByValue([
                ...SPECIALIZATION_OPTIONS,
                ...options.filter(isApprovedSpecializationOption),
              ])
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
    let active = true;

    const loadBranches = async () => {
      setLoadingBranches(true);
      setBranchWarning("");

      try {
        const branches = await fetchBranchesForHospital(hospitalId);
        if (!active) return;

        const options = buildBranchOptions(branches).filter((branch) => branch.isActive);
        setBranchOptions(options);

        if (options.length === 1) {
          setForm((previous) => ({
            ...previous,
            branchIds: previous.branchIds.length ? previous.branchIds : [options[0].id],
          }));
        }
      } catch {
        if (active) {
          setBranchOptions([]);
          setBranchWarning("Unable to load branches. Please try again later.");
        }
      } finally {
        if (active) setLoadingBranches(false);
      }
    };

    loadBranches();

    return () => {
      active = false;
    };
  }, [hospitalId]);

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleChange = (event) => {
    const { name } = event.target;
    let value = event.target.value;

    if (name === "name") {
      value = formatTitleCase(onlyAlpha(value));
    }

    if (name === "qualification") {
      value = value
        .split(" ")
        .map((part) =>
          part.length <= 5 && part === part.toUpperCase()
            ? part
            : formatTitleCase(onlyAlpha(part))
        )
        .join(" ")
        .trimStart();
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

    setForm((previous) => {
      const nextForm = {
        ...previous,
        [name]: value,
      };

      if (name === "specialization") {
        const nextExpertiseOptions = getExpertiseOptionsForSpecialization(value);
        nextForm.areaofExpertise = nextExpertiseOptions.includes(previous.areaofExpertise)
          ? previous.areaofExpertise
          : "";
      }

      return nextForm;
    });
    setFieldErrors((previous) => ({ ...previous, [name]: "" }));
  };

  const handleBranchCheckboxChange = (event) => {
    const branchId = String(event.target.value);
    setForm((previous) => {
      const nextBranchIds = previous.branchIds.includes(branchId)
        ? previous.branchIds.filter((id) => id !== branchId)
        : [...previous.branchIds, branchId];

      return {
        ...previous,
        branchIds: nextBranchIds,
      };
    });
    setFieldErrors((previous) => ({ ...previous, branchIds: "" }));
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
  try {
    const data = await response.json();

    if (data.errors) {
      const apiFieldErrors = {};

      Object.entries(data.errors).forEach(([key, messages]) => {
        const errorKey = getApiErrorKey(key);
        const message = Array.isArray(messages) ? messages[0] : messages;
        apiFieldErrors[errorKey] = formatValidationMessage(message);
      });

      setFieldErrors((previous) => ({
        ...previous,
        ...apiFieldErrors,
      }));

      return Object.values(apiFieldErrors).filter(Boolean).join("\n");
    }

    return (
      data.message ||
      data.title ||
      "Unable to add doctor right now."
    );
  } catch {
    return "Unable to add doctor right now.";
  }
};
const validateBranchSelection = (values = form) => {
    if (!Array.isArray(values.branchIds) || values.branchIds.length === 0) {
      return "Select at least one branch.";
    }
    return "";
  };

  const validateForm = (values = form) => {
    const nextErrors = {
      branchIds: validateBranchSelection(values),
    name: validateAlpha(values.name, "Doctor Name"),
    specialization: validateText(values.specialization, "Specialization"),
    areaofExpertise: validateText(values.areaofExpertise, "Area of Expertise"),
    qualification: validateText(values.qualification, "Qualification"),
    experience: validateNumeric(values.experience, "Experience", {
      integer: true,
      max: 99,
    }),
    fees: validateNumeric(values.fees, "Consultation Fee"),
    email: validateGmail(values.email),
    phone: validateMobile(values.phone),
  };

  if (imageFile) {
    const imageError = validateImageFile(imageFile, "Doctor Image");
    if (imageError) {
      nextErrors.image = imageError;
    }
  }

  Object.keys(nextErrors).forEach((key) => {
    if (!nextErrors[key]) {
      delete nextErrors[key];
    }
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

    if (!validateForm(formattedForm)) {
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
      toast.error(duplicateMobileMessage);
      return;
    }

    setSaving(true);

    const requestPayload = {
      branchIds: Array.isArray(formattedForm.branchIds)
        ? formattedForm.branchIds.map((id) => Number(id) || 0).filter((id) => id > 0)
        : [],
      name: formatTitleCase(formattedForm.name).trim(),
      specialization: formattedForm.specialization.trim(),
      experience: String(Number(formattedForm.experience) || 0),
      qualification: formattedForm.qualification.trim(),
      consultationFee: Number(formattedForm.fees) || 0,
      areaofExpertise: formattedForm.areaofExpertise.trim(),
      email: formattedForm.email.trim(),
      phoneNumber: formattedForm.phone.trim(),
      isActive: formattedForm.isActive === "true",
    };
    const formData = new FormData();

    formData.append("Name", requestPayload.name);
    formData.append("Specialization", requestPayload.specialization);
    formData.append("Experience", requestPayload.experience);
    formData.append("Qualification", requestPayload.qualification);
    formData.append("ConsultationFee", requestPayload.consultationFee);
    formData.append("Fees", requestPayload.consultationFee);
    formData.append("AreaofExpertise", requestPayload.areaofExpertise);
    formData.append("AreaOfExpertise", requestPayload.areaofExpertise);
    formData.append("Email", requestPayload.email);
    formData.append("PhoneNumber", requestPayload.phoneNumber);
    formData.append("Phone", requestPayload.phoneNumber);
    formData.append("IsActive", requestPayload.isActive);

    if (imageFile) {
      formData.append("Image", imageFile);
    }

    try {
      const response = await fetch(DOCTORS_API_URL, {
        method: "POST",
        headers: getApiHeaders(),
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const responseData = await response.json().catch(() => null);
      let doctorId =
        responseData?.id ||
        responseData?.doctorId ||
        responseData?.DoctorId ||
        responseData?.Id ||
        responseData?.ID ||
        responseData?.doctor?.id ||
        responseData?.data?.id ||
        responseData?.data?.doctorId ||
        "";

      if (!doctorId) {
        const locationHeader =
          response.headers.get("location") || response.headers.get("Location") || "";
        if (locationHeader) {
          const parsedId = String(locationHeader).trim().split("/").filter(Boolean).pop();
          if (parsedId) {
            doctorId = parsedId;
          }
        }
      }

      if (requestPayload.branchIds.length > 0 && !doctorId) {
        throw new Error(
          "Doctor created, but branch assignment could not proceed because the new doctor ID was not returned."
        );
      }

      if (requestPayload.branchIds.length > 0 && doctorId) {
        const payloadBranchIds = requestPayload.branchIds.map((id) => Number(id) || 0).filter((id) => id > 0);

        const assignResponse = await fetch(
          apiUrl(`Doctor/${encodeURIComponent(doctorId)}/branches`),
          {
            method: "PUT",
            headers: getJsonHeaders(),
            body: JSON.stringify({ branchIds: payloadBranchIds }),
          }
        );

        if (!assignResponse.ok) {
          throw new Error(await parseErrorMessage(assignResponse));
        }

        // Verify the server persisted multiple branches
        try {
          const verifyResp = await fetch(
            apiUrl(`Doctor/${encodeURIComponent(doctorId)}/branches`),
            { headers: getApiHeaders() }
          );
          if (verifyResp.ok) {
            const serverBranches = await verifyResp.json().catch(() => null);
            const serverBranchIds = readBranchAssignmentIds(serverBranches);

            const missing = payloadBranchIds.filter((id) => !serverBranchIds.includes(id));
            if (missing.length > 0) {
              throw new Error(
                `Branch assignment incomplete. Server saved branches: ${serverBranchIds.join(", ")}`
              );
            }
          }
        } catch (verifyError) {
          throw new Error(verifyError.message || "Branch verification failed after create.");
        }
      }

      toast.success("Doctor added successfully");
      navigate("/doctors");
    } catch (submitError) {
      const message = submitError.message || "Unable to add doctor right now.";
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
            <div className="add-doctor-input-group add-doctor-input-group-full">
              <label>Branches (select multiple)</label>
              <div className="branch-checkbox-grid">
                {branchOptions.map((branch) => (
                  <label
                    key={branch.id}
                    className="branch-checkbox-item"
                  >
                    <input
                      type="checkbox"
                      name="branchIds"
                      value={String(branch.id)}
                      checked={form.branchIds.includes(String(branch.id))}
                      onChange={handleBranchCheckboxChange}
                      disabled={loadingBranches || saving}
                    />
                    {branch.name}
                  </label>
                ))}
              </div>
              {fieldErrors.branchIds ? (
                <span className="add-doctor-field-error">{fieldErrors.branchIds}</span>
              ) : null}
              <small>{form.branchIds.length} branch(es) selected.</small>
            </div>

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
              <select
                name="specialization"
                value={form.specialization}
                onChange={handleChange}
                className={fieldErrors.specialization ? "is-invalid" : ""}
                required
                disabled={loadingOptions && !specializationOptions.length}
              >
                <option value="">
                  {loadingOptions ? "Loading specializations..." : "Select specialization"}
                </option>
                {specializationOptions.map((specialization) => (
                  <option key={specialization} value={specialization}>
                    {getSpecializationDisplayName(specialization)}
                  </option>
                ))}
              </select>
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
              <select
                name="areaofExpertise"
                value={form.areaofExpertise}
                onChange={handleChange}
                className={fieldErrors.areaofExpertise ? "is-invalid" : ""}
                disabled={!expertiseOptions.length}
                required
              >
                <option value="">
                  {form.specialization
                    ? "Select area of expertise"
                    : "Select specialization first"}
                </option>
                {expertiseOptions.map((expertise) => (
                  <option key={expertise} value={expertise}>
                    {expertise}
                  </option>
                ))}
              </select>
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

          {branchWarning ? (
            <p className="add-doctor-form-note">{branchWarning}</p>
          ) : null}

          <div className="add-doctor-actions">
            <button
              className="add-doctor-primary"
              type="submit"
              disabled={saving || loadingBranches}
              title="Add doctor"
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
