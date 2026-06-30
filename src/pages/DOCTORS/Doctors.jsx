import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Doctors.css";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import AuthImage, {
  resolveApiImageUrl,
} from "../../utils/AuthImage";
import { apiUrl } from "../../config/api";
import {
  canUsePermission,
  fetchAndStoreRolePermissions,
} from "../../utils/authorization";
import { useToast } from "../../components/ToastProvider";
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
import { getClinicDisplayName } from "../../utils/clinicDisplay";
import { formatIndianCurrency } from "../../utils/format";

const DOCTORS_API_URL =
  apiUrl("Doctor");

const DOCTOR_DELETE_CONFLICT_MESSAGE =
  "This doctor has linked appointments and cannot be deleted. Set the doctor to Inactive instead.";

const getSafeApiErrorMessage = (message, fallbackMessage) => {
  const text = String(message || "").trim();
  if (!text) return fallbackMessage;

  const isAppointmentConstraint =
    /FK_Appointments_Doctors_DoctorId/i.test(text) ||
    (
      /DELETE statement conflicted with the REFERENCE constraint/i.test(text) &&
      /Appointments/i.test(text) &&
      /DoctorId/i.test(text)
    );

  if (isAppointmentConstraint) {
    return DOCTOR_DELETE_CONFLICT_MESSAGE;
  }

  const containsServerInternals =
    /Microsoft\.EntityFrameworkCore|Microsoft\.Data\.SqlClient|SqlException|DbUpdateException|HEADERS\s*=+|stack trace/i.test(
      text
    );

  if (containsServerInternals || text.length > 500) {
    return fallbackMessage;
  }

  return text;
};

const parseDoctorsResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const getDoctorIsActive = (doctor) => {
  if (typeof doctor?.isActive === "boolean") return doctor.isActive;
  return String(doctor?.status || "").toLowerCase() === "active";
};

const cleanFormValue = (value) => {
  const text = String(value ?? "").trim();
  return text.toLowerCase() === "string" ? "" : text;
};

const cleanDisplayText = (value) => {
  const text = String(value ?? "").trim();
  return text && text.toLowerCase() !== "string" ? text : "-";
};

const getImageUrl = (entity = {}) => String(entity.imageUrl || "").trim();

const getDoctorFee = (doctor = {}) =>
  doctor.consultationFee ?? doctor.fees ?? doctor.Fees ?? "";

const formatFeeValue = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const numberValue = Number(text);
  return Number.isNaN(numberValue) ? text : numberValue.toFixed(2);
};

const getDoctorPhone = (doctor = {}) =>
  doctor.phoneNumber ?? doctor.phone ?? doctor.Phone ?? "";

const getInitialEditForm = (doctor = {}) => ({

  name: cleanFormValue(doctor.name),
  specialization: cleanFormValue(doctor.specialization),
  areaofExpertise: cleanFormValue(doctor.areaofExpertise ?? doctor.areaOfExpertise),
  experience:
    doctor.experience !== undefined && doctor.experience !== null
      ? String(doctor.experience)
      : "",
  fees:
    getDoctorFee(doctor) !== undefined && getDoctorFee(doctor) !== null
      ? String(getDoctorFee(doctor))
      : "",
  email: cleanFormValue(doctor.email),
  phone: cleanFormValue(getDoctorPhone(doctor)),
  isActive: getDoctorIsActive(doctor),
});

const getEmptyEditErrors = () => ({});

const formatValidationMessage = (message) => {
  return String(message || "")
    .replace(/^The\s+/i, "")
    .replace(/\s+field\s+is\s+required\.?$/i, " is required.")
    .trim();
};

const getErrorKey = (key) => {
  const normalized = String(key || "")
    .split(".")
    .pop()
    .toLowerCase();

  const map = {
    name: "name",
    specialization: "specialization",
    experience: "experience",
    fees: "fees",
    email: "email",
    phone: "phone",
    password: "password",
    isactive: "isActive",
    image: "image",
  };

  return map[normalized] || "form";
};

const getValidationMessages = (data) => {
  if (!data?.errors || typeof data.errors !== "object") {
    return [];
  }

  return Object.entries(data.errors)
    .flatMap(([key, messages]) => {
      const values = Array.isArray(messages) ? messages : [messages];
      return values
        .filter(Boolean)
        .map((message) => `${key}: ${formatValidationMessage(message)}`);
    })
    .filter(Boolean);
};

const validateEditForm = (form) => {
  const errors = getEmptyEditErrors();
  errors.name = validateAlpha(form.name, "Name");
  errors.specialization = validateAlpha(form.specialization, "Specialization");
  errors.areaofExpertise = validateText(form.areaofExpertise, "Area of expertise");
  errors.experience = validateNumeric(form.experience, "Experience", {
    integer: true,
  });
  errors.fees = validateNumeric(form.fees, "Fees");
  errors.email = validateGmail(form.email, 'Email', { strict: false });
  errors.phone = validateMobile(form.phone, "Phone");
  errors.isActive = validateSelected(String(form.isActive), "a status");

  Object.keys(errors).forEach((key) => {
    if (!errors[key]) delete errors[key];
  });

  return errors;
};

const buildDoctorUpdateBody = ({
  doctor = {},
  form = {},
  isActive,
}) => {
  const nextIsActive =
    typeof isActive === "boolean"
      ? isActive
      : typeof form.isActive === "boolean"
        ? form.isActive
        : getDoctorIsActive(doctor);

  const body = {
    name: cleanFormValue(form.name ?? doctor.name),
    specialization: cleanFormValue(form.specialization ?? doctor.specialization),
    areaofExpertise: cleanFormValue(
      form.areaofExpertise ?? doctor.areaofExpertise ?? doctor.areaOfExpertise
    ),
    experience: String(Number(form.experience ?? doctor.experience ?? 0) || 0),
    qualification: cleanFormValue(form.qualification ?? doctor.qualification),
    consultationFee: Number(form.fees ?? getDoctorFee(doctor) ?? 0) || 0,
    email: cleanFormValue(form.email ?? doctor.email),
    phoneNumber: cleanFormValue(form.phone ?? getDoctorPhone(doctor)),
    isActive: nextIsActive,
  };

  const hospitalId = localStorage.getItem("hospitalId") || "";
  const clinicName = getClinicDisplayName({ ...doctor, hospitalId }, "");
  if (hospitalId) {
    body.hospitalId = Number(hospitalId) || hospitalId;
    body.clinicId = Number(hospitalId) || hospitalId;
  }
  if (clinicName) {
    body.hospitalName = clinicName;
    body.clinicName = clinicName;
  }

  return body;
};

function Doctors() {
  const navigate = useNavigate();
  const toast = useToast();
  const editImageInputRef = useRef(null);
  const [searchText, setSearchText] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [permissionRecord, setPermissionRecord] = useState(null);


  const [editingDoctor, setEditingDoctor] = useState(null);
  const [editForm, setEditForm] = useState(getInitialEditForm());
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [editFieldErrors, setEditFieldErrors] =
    useState(getEmptyEditErrors());

  const [toggleLoadingId, setToggleLoadingId] = useState(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);
  const clinicName = getClinicDisplayName({}, "Clinic");
  const canCreateDoctor = !permissionsLoading && canUsePermission(permissionRecord, "create");
  const canEditDoctor = !permissionsLoading && canUsePermission(permissionRecord, "edit");
  const canDeleteDoctor = !permissionsLoading && canUsePermission(permissionRecord, "delete");
  const permissionDisabledTitle = permissionsLoading
    ? "Loading permissions"
    : "Permission disabled by Super Admin";

  const openAddDoctor = () => {
    if (!canCreateDoctor) {
      toast.error("Create permission is disabled by Super Admin.");
      return;
    }

    navigate("/doctors/add");
  };

  const fetchDoctors = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(DOCTORS_API_URL, {
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      });

      if (!response.ok) {
        throw new Error("Unable to load doctors right now.");
      }

      const data = await response.json();
      setDoctors(parseDoctorsResponse(data));

    } catch (fetchError) {
      setError(fetchError.message || "Unable to load doctors right now.");
    } finally {
      setLoading(false);
    }
  };

  const parseErrorMessage = async (response, fallbackMessage) => {
    try {
      const text = await response.text();
      if (!text) return fallbackMessage;

      try {
        const errorBody = JSON.parse(text);
        const validationMessages = getValidationMessages(errorBody);
        return getSafeApiErrorMessage(
          errorBody?.message ||
          validationMessages.join(" ") ||
          errorBody?.title ||
          text,
          fallbackMessage
        );
      } catch {
        return getSafeApiErrorMessage(text, fallbackMessage);
      }
    } catch {
      return fallbackMessage;
    }
  };

  const parseEditError = async (response) => {
    const fallbackMessage = "Unable to update doctor right now.";

    try {
      const text = await response.text();
      if (!text) {
        return {
          message: fallbackMessage,
          fieldErrors: getEmptyEditErrors(),
        };
      }

      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        return {
          message: text,
          fieldErrors: getEmptyEditErrors(),
        };
      }

      const fieldErrors = getEmptyEditErrors();

      if (data?.errors && typeof data.errors === "object") {
        Object.entries(data.errors).forEach(([key, messages]) => {
          const errorKey = getErrorKey(key);
          const value = Array.isArray(messages)
            ? messages[0]
            : messages;

          fieldErrors[errorKey] = formatValidationMessage(value);
        });
      }

      return {
        message:
          data?.message ||
          getValidationMessages(data).join(" ") ||
          data?.title ||
          fallbackMessage,
        fieldErrors,
      };
    } catch {
      return {
        message: fallbackMessage,
        fieldErrors: getEmptyEditErrors(),
      };
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

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

  useEffect(() => {
    return () => {
      if (editImagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(editImagePreview);
      }
    };
  }, [editImagePreview]);

  const filteredDoctors = useMemo(() => {
    const value = searchText.trim().toLowerCase();
    if (!value) return doctors;

    return doctors.filter((doctor) =>
      [
        doctor.name,
        doctor.specialization,
        doctor.areaofExpertise ?? doctor.areaOfExpertise,
        doctor.email,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value))
    );
  }, [doctors, searchText]);

  const editInitial = useMemo(() => {
    return (editForm.name.trim()[0] || "D").toUpperCase();
  }, [editForm.name]);

  // const handleDoctorImageError = (doctorId) => {
  //   if (doctorId === undefined || doctorId === null) return;
  //   setBrokenImageIds((previous) => ({
  //     ...previous,
  //     [String(doctorId)]: true,
  //   }));
  // };

  const openEditDoctor = (doctor) => {
    if (!doctor?.id) return;
    if (!canEditDoctor) {
      toast.error("Edit permission is disabled by Super Admin.");
      return;
    }

    if (editImagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(editImagePreview);
    }

    setEditingDoctor(doctor);
    setEditForm(getInitialEditForm(doctor));
    setEditImageFile(null);
    setEditImagePreview(
      resolveApiImageUrl(
        getImageUrl(doctor)
      )
    );
    setEditError("");
    setEditFieldErrors(getEmptyEditErrors());
  };

  const closeEditDoctor = () => {
    if (editImagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(editImagePreview);
    }

    setEditingDoctor(null);
    setEditForm(getInitialEditForm());
    setEditImageFile(null);
    setEditImagePreview("");
    setEditError("");
    setEditFieldErrors(getEmptyEditErrors());
    setSavingEdit(false);
  };

  const handleEditFieldChange = (event) => {
    const { name, value } = event.target;
    let nextValue = value;

    if (["name", "specialization"].includes(name)) {
      nextValue = onlyAlpha(value);
    }

    if (name === "phone") {
      nextValue = onlyIndianMobileValue(value);
    }

    if (["experience", "fees"].includes(name)) {
      nextValue = onlyNumberValue(value);
    }

    setEditForm((previous) => ({
      ...previous,
      [name]: name === "isActive" ? value === "true" : nextValue,
    }));

    setEditFieldErrors((previous) => ({
      ...previous,
      [name]: "",
      form: "",
    }));
    setEditError("");
  };

  const handleEditFeeBlur = () => {
    setEditForm((previous) => ({
      ...previous,
      fees: formatFeeValue(previous.fees),
    }));
  };

  const handleEditImageChange = (event) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;

    const imageError = validateImageFile(nextFile);
    if (imageError) {
      setEditFieldErrors((previous) => ({
        ...previous,
        image: imageError,
        form: "",
      }));
      setEditError("");
      toast.error(imageError);
      return;
    }

    if (editImagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(editImagePreview);
    }

    setEditImageFile(nextFile);
    setEditImagePreview(URL.createObjectURL(nextFile));
    setEditFieldErrors((previous) => ({
      ...previous,
      image: "",
      form: "",
    }));
  };

  const handleSaveEditDoctor = async (event) => {
    event.preventDefault();

    if (!editingDoctor?.id) return;
    if (!canEditDoctor) {
      setEditError("Edit permission is disabled by Super Admin.");
      toast.error("Edit permission is disabled by Super Admin.");
      return;
    }

    const validationErrors = {
      ...validateEditForm(editForm),
      image: validateImageFile(editImageFile),
    };
    Object.keys(validationErrors).forEach((key) => {
      if (!validationErrors[key]) delete validationErrors[key];
    });
    if (Object.keys(validationErrors).length > 0) {
      setEditFieldErrors(validationErrors);
      setEditError("Please fix the highlighted fields.");
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSavingEdit(true);
    setEditError("");
    setEditFieldErrors(getEmptyEditErrors());

    const requestBody = buildDoctorUpdateBody({
      doctor: editingDoctor,
      form: editForm,
    });

    try {
      const response = await fetch(`${DOCTORS_API_URL}/${editingDoctor.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const apiError =
          await parseEditError(response);

        setEditFieldErrors(apiError.fieldErrors);
        throw new Error(apiError.message);
      }

      await fetchDoctors();
      toast.success("Doctor updated successfully");
      closeEditDoctor();
    } catch (updateError) {
      const message = updateError.message || "Unable to update doctor right now.";
      setEditError(message);
      toast.error(message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleDoctorStatus = async (doctor) => {
    if (!doctor?.id) return;
    if (!canEditDoctor) {
      toast.error("Edit permission is disabled by Super Admin.");
      return;
    }

    const nextIsActive = !getDoctorIsActive(doctor);

    setToggleLoadingId(doctor.id);
    setError("");

    try {
      const response = await fetch(`${DOCTORS_API_URL}/${doctor.id}/toggle-status`, {
        method: "PATCH",
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      });

      if (!response.ok) {
        const message = await parseErrorMessage(
          response,
          "Unable to toggle doctor status right now."
        );
        throw new Error(message);
      }

      setDoctors((previousDoctors) =>
        previousDoctors.map((item) =>
          item.id === doctor.id
            ? {
              ...item,
              isActive: nextIsActive,
              status: nextIsActive ? "Active" : "Inactive",
            }
            : item
        )
      );
      toast.success(nextIsActive ? "Doctor activated successfully" : "Doctor disabled successfully");
    } catch (toggleError) {
      const message =
        toggleError.message || "Unable to toggle doctor status right now.";
      setError(message);
      toast.error(message);
    } finally {
      setToggleLoadingId(null);
    }
  };

  const handleDeleteDoctor = async (doctorId) => {
    if (!doctorId) return;
    if (!canDeleteDoctor) {
      toast.error("Delete permission is disabled by Super Admin.");
      return;
    }

    const shouldDelete = window.confirm("Delete this doctor?");
    if (!shouldDelete) return;

    setDeleteLoadingId(doctorId);
    setError("");

    try {
      const response = await fetch(`${DOCTORS_API_URL}/${doctorId}`, {
        method: "DELETE",
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      });

      if (!response.ok) {
        const message = await parseErrorMessage(
          response,
          "Unable to delete doctor right now."
        );
        throw new Error(message);
      }

      setDoctors((previousDoctors) =>
        previousDoctors.filter((doctor) => doctor.id !== doctorId)
      );
      toast.success("Doctor deleted successfully");
    } catch (deleteError) {
      const message = deleteError.message || "Unable to delete doctor right now.";
      setError(message);
      toast.error(message);
    } finally {
      setDeleteLoadingId(null);
    }
  };

  return (
    <div className="doctors-page">
      <div className="doctors-page-header">
        <div>
          <h2>Doctors</h2>
          <p>
            {loading
              ? "Loading doctors..."
              : `${filteredDoctors.length} clinicians registered`}
          </p>
        </div>

        <div className="doctors-header-actions">
          <button
            className="doctors-btn doctors-btn-light"
            onClick={() => navigate("/doctors/schedule")}
            title="Manage schedule"
          >
            <Calendar size={16} /> Manage Schedule
          </button>

          <button
            className="doctors-btn doctors-btn-primary"
            onClick={openAddDoctor}
            disabled={!canCreateDoctor}
            title={canCreateDoctor ? "Add doctor" : permissionDisabledTitle}
          >
            <Plus size={16} /> Add Doctor
          </button>
        </div>
      </div>

      <div className="doctors-clinic-banner">
        <span>Clinic Name</span>
        <strong>{clinicName}</strong>
      </div>

      <div className="doctors-search-bar">
        <Search size={16} />
        <input
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search by name, specialty, email..."
        />
      </div>

      {error ? <div className="doctors-error">{error}</div> : null}

      <div className="doctors-table">
        <div className="doctors-thead">
          <span>Name</span>
          <span>Specialization</span>
          <span>Area of Expertise</span>
          <span>Experience</span>
          <span className="doctors-fee-heading">Doctor Fees</span>
          <span>Contact</span>
          <span>Status</span>
          <span>Available Time</span>
          <span>Actions</span>
        </div>

        {!loading && filteredDoctors.length === 0 ? (
          <div className="doctors-empty">No doctors found.</div>
        ) : null}

        {filteredDoctors.map((doc) => {
          const doctorImageUrl = getImageUrl(doc);


          const initials =
            (doc.name || "D")
              .split(" ")
              .filter(Boolean)
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() || "D";
          const isActive = getDoctorIsActive(doc);
          const isStatusUpdating = toggleLoadingId === doc.id;
          const isDeleting = deleteLoadingId === doc.id;

          return (
            <div className="doctors-row" key={doc.id ?? `${doc.name}-${doc.email}`}>
              <div className="doctors-cell doctors-name-cell">
                <b>{doc.name || "-"}</b>
              </div>

              <div className="doctors-cell">{doc.specialization || "-"}</div>

              <div className="doctors-cell">
                {cleanDisplayText(doc.areaofExpertise ?? doc.areaOfExpertise)}
              </div>

              <div className="doctors-cell">
                {doc.experience !== undefined && doc.experience !== null
                  ? `${doc.experience} yrs`
                  : "-"}
              </div>

              <div className="doctors-cell doctors-fee">
                {getDoctorFee(doc) !== undefined && getDoctorFee(doc) !== null && getDoctorFee(doc) !== ""
                  ? formatIndianCurrency(getDoctorFee(doc))
                  : "-"}
              </div>

              <div className="doctors-contact-cell">
                <span>{cleanDisplayText(doc.phone)}</span>
                <span>{cleanDisplayText(doc.email)}</span>
              </div>

              <div className="doctors-cell doctors-status-cell">
                <button
                  type="button"
                  className="doctors-status-button"
                  onClick={() => handleToggleDoctorStatus(doc)}
                  disabled={!doc.id || !canEditDoctor || isStatusUpdating || isDeleting}
                  title={canEditDoctor ? "Toggle status" : permissionDisabledTitle}
                >
                  <span
                    className={`doctors-status ${isActive ? "doctors-status-active" : "doctors-status-inactive"
                      } ${isStatusUpdating ? "doctors-status-updating" : ""}`}
                  >
                    {isStatusUpdating
                      ? "Updating..."
                      : isActive
                        ? "Active"
                        : "Inactive"}
                  </span>
                </button>
              </div>

              <div className="doctors-cell doctors-time-cell">
                {doc.availableTime || "9:00 AM - 5:00 PM"}
              </div>

              <div className="doctors-action-cell">
                <button
                  type="button"
                  className="doctors-action-icon"
                  onClick={() => openEditDoctor(doc)}
                  disabled={!doc.id || !canEditDoctor || isDeleting}
                  title={canEditDoctor ? "Edit doctor" : permissionDisabledTitle}
                >
                  <Pencil size={14} />
                </button>

                <button
                  type="button"
                  className="doctors-action-icon doctors-action-icon-delete"
                  onClick={() => handleDeleteDoctor(doc.id)}
                  disabled={!doc.id || !canDeleteDoctor || isDeleting || isStatusUpdating}
                  title={canDeleteDoctor ? "Delete doctor" : permissionDisabledTitle}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {editingDoctor ? (
        <div className="doctor-edit-overlay" onClick={closeEditDoctor}>
          <div
            className="doctor-edit-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="doctor-edit-header">
              <h3>Edit Doctor</h3>
              <button
                type="button"
                className="doctor-edit-close"
                onClick={closeEditDoctor}
                aria-label="Close edit doctor form"
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSaveEditDoctor} noValidate>
              <div className="doctor-edit-image-wrap">
                <div className="doctor-edit-image-circle">
                  <AuthImage
                    src={editImagePreview}
                    alt="Doctor preview"
                    className="doctor-edit-image-preview"
                    fallback={<span>{editInitial}</span>}
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      objectFit: "cover",
                      display: "flex",
                    }}
                  />
                </div>
              </div>

              <div className="doctor-edit-grid">
                <div className="doctor-edit-field">
                  <label htmlFor="edit-name">Name</label>
                  <input
                    id="edit-name"
                    name="name"
                    value={editForm.name}
                    onChange={handleEditFieldChange}
                    className={editFieldErrors.name ? "is-invalid" : ""}
                    aria-invalid={Boolean(editFieldErrors.name)}
                  />
                  {editFieldErrors.name ? (
                    <span className="doctor-edit-field-error">
                      {editFieldErrors.name}
                    </span>
                  ) : null}
                </div>

                <div className="doctor-edit-field">
                  <label htmlFor="edit-specialization">Specialization</label>
                  <input
                    id="edit-specialization"
                    name="specialization"
                    value={editForm.specialization}
                    onChange={handleEditFieldChange}
                    className={editFieldErrors.specialization ? "is-invalid" : ""}
                    aria-invalid={Boolean(editFieldErrors.specialization)}
                  />
                  {editFieldErrors.specialization ? (
                    <span className="doctor-edit-field-error">
                      {editFieldErrors.specialization}
                    </span>
                  ) : null}
                </div>

                <div className="doctor-edit-field">
                  <label htmlFor="edit-areaofExpertise">Area of Expertise</label>
                  <input
                    id="edit-areaofExpertise"
                    name="areaofExpertise"
                    value={editForm.areaofExpertise}
                    onChange={handleEditFieldChange}
                    className={editFieldErrors.areaofExpertise ? "is-invalid" : ""}
                    aria-invalid={Boolean(editFieldErrors.areaofExpertise)}
                  />
                  {editFieldErrors.areaofExpertise ? (
                    <span className="doctor-edit-field-error">
                      {editFieldErrors.areaofExpertise}
                    </span>
                  ) : null}
                </div>

                <div className="doctor-edit-field">
                  <label htmlFor="edit-experience">Experience</label>
                  <input
                    id="edit-experience"
                    name="experience"
                    type="number"
                    min="0"
                    value={editForm.experience}
                    onChange={handleEditFieldChange}
                    className={editFieldErrors.experience ? "is-invalid" : ""}
                    aria-invalid={Boolean(editFieldErrors.experience)}
                  />
                  {editFieldErrors.experience ? (
                    <span className="doctor-edit-field-error">
                      {editFieldErrors.experience}
                    </span>
                  ) : null}
                </div>

                <div className="doctor-edit-field">
                  <label htmlFor="edit-fees">Doctor Fees</label>
                  <input
                    id="edit-fees"
                    name="fees"
                    type="text"
                    inputMode="decimal"
                    value={editForm.fees}
                    onChange={handleEditFieldChange}
                    onBlur={handleEditFeeBlur}
                    className={`doctor-edit-fee-input${editFieldErrors.fees ? " is-invalid" : ""}`}
                    aria-invalid={Boolean(editFieldErrors.fees)}
                  />
                  {editFieldErrors.fees ? (
                    <span className="doctor-edit-field-error">
                      {editFieldErrors.fees}
                    </span>
                  ) : null}
                </div>

                <div className="doctor-edit-field">
                  <label htmlFor="edit-phone">Phone</label>
                  <input
                    id="edit-phone"
                    name="phone"
                    type="tel"
                    value={editForm.phone}
                    onChange={handleEditFieldChange}
                    inputMode="numeric"
                    pattern="^(?!([0-9])\\1{9})[6-9][0-9]{9}$"
                    maxLength={10}
                    placeholder="10-digit Indian mobile number"
                    title="Enter a 10-digit Indian mobile number starting with 6-9 and not all identical digits"
                    className={editFieldErrors.phone ? "is-invalid" : ""}
                    aria-invalid={Boolean(editFieldErrors.phone)}
                  />
                  {editFieldErrors.phone ? (
                    <span className="doctor-edit-field-error">
                      {editFieldErrors.phone}
                    </span>
                  ) : null}
                </div>

                <div className="doctor-edit-field">
                  <label htmlFor="edit-email">Email</label>
                  <input
                    id="edit-email"
                    name="email"
                    type="email"
                    value={editForm.email}
                    onChange={handleEditFieldChange}
                    className={editFieldErrors.email ? "is-invalid" : ""}
                    aria-invalid={Boolean(editFieldErrors.email)}
                  />
                  {editFieldErrors.email ? (
                    <span className="doctor-edit-field-error">
                      {editFieldErrors.email}
                    </span>
                  ) : null}
                </div>

                <div className="doctor-edit-field">
                  <label htmlFor="edit-status">Status</label>
                  <select
                    id="edit-status"
                    name="isActive"
                    value={String(editForm.isActive)}
                    onChange={handleEditFieldChange}
                    className={editFieldErrors.isActive ? "is-invalid" : ""}
                    aria-invalid={Boolean(editFieldErrors.isActive)}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                  {editFieldErrors.isActive ? (
                    <span className="doctor-edit-field-error">
                      {editFieldErrors.isActive}
                    </span>
                  ) : null}
                </div>
              </div>

              {editFieldErrors.image ? (
                <p className="doctor-edit-error">{editFieldErrors.image}</p>
              ) : null}

              {editError ? <p className="doctor-edit-error">{editError}</p> : null}

              <div className="doctor-edit-actions">
                <button
                  type="button"
                  className="doctor-edit-cancel"
                  onClick={closeEditDoctor}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="doctor-edit-save"
                  disabled={savingEdit}
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Doctors;
