import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  ToggleLeft,
  ToggleRight,
  UserCheck,
  X,
} from "lucide-react";
import "./Receptionists.css";
import { apiUrl } from "../../config/api";
import { useToast } from "../../components/ToastProvider";
import {
  canUsePermission,
  fetchAndStoreRolePermissions,
} from "../../utils/authorization";
import {
  onlyAlpha,
  onlyIndianMobileValue,
  validateAlpha,
  validateGmail,
  validateMobile,
} from "../../utils/validation";
import {
  getClinicDisplayName,
  getStoredClinicName,
} from "../../utils/clinicDisplay";
const RECEPTIONIST_API = apiUrl("Receptionist");

const getAuthToken = () =>
  localStorage.getItem("adminToken") || localStorage.getItem("token");

const decodeJwtPayload = (token) => {
  try {
    const payload = token?.split(".")?.[1];
    if (!payload || typeof atob !== "function") return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(normalized + padding));
  } catch {
    return null;
  }
};

const getHospitalId = () => {
  const storedHospitalId = localStorage.getItem("hospitalId");
  if (storedHospitalId) return Number(storedHospitalId);

  const claims = decodeJwtPayload(getAuthToken());
  return Number(claims?.HospitalId || claims?.hospitalId || 0);
};

const getEmptyForm = () => ({
  name: "",
  email: "",
  phone: "",
});

const parseReceptionistsResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const getValidationMessages = (data) => {
  if (!data?.errors || typeof data.errors !== "object") return [];

  return Object.entries(data.errors)
    .flatMap(([key, messages]) => {
      const list = Array.isArray(messages) ? messages : [messages];
      return list.filter(Boolean).map((message) => `${key}: ${message}`);
    })
    .filter(Boolean);
};

const parseErrorMessage = async (response, fallback) => {
  try {
    const text = await response.text();
    if (!text) return fallback;

    try {
      const data = JSON.parse(text);
      return (
        data?.message ||
        getValidationMessages(data).join(" ") ||
        data?.title ||
        text
      );
    } catch {
      return text;
    }
  } catch {
    return fallback;
  }
};

function Receptionists() {
  const toast = useToast();
  const [receptionists, setReceptionists] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReceptionist, setEditingReceptionist] = useState(null);
  const [form, setForm] = useState(getEmptyForm());
  const [fieldErrors, setFieldErrors] = useState({});
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [permissionRecord, setPermissionRecord] = useState(null);

  const hospitalId = getHospitalId();
  const clinicDisplayName =
    getStoredClinicName() || getClinicDisplayName({ hospitalId }, "Clinic");
  const canCreateReceptionist = !permissionsLoading && canUsePermission(permissionRecord, "create");
  const canEditReceptionist = !permissionsLoading && canUsePermission(permissionRecord, "edit");
  const canDeleteReceptionist = !permissionsLoading && canUsePermission(permissionRecord, "delete");
  const permissionDisabledTitle = permissionsLoading
    ? "Loading permissions"
    : "Permission disabled by Super Admin";

  const fetchReceptionists = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(RECEPTIONIST_API, {
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      });

      if (!response.ok) {
        throw new Error(
          await parseErrorMessage(response, "Unable to load receptionists.")
        );
      }

      const data = await response.json();
      setReceptionists(parseReceptionistsResponse(data));
    } catch (fetchError) {
      setError(fetchError.message || "Unable to load receptionists.");
      setReceptionists([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceptionists();
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

  const filteredReceptionists = useMemo(() => {
    const value = searchText.trim().toLowerCase();
    if (!value) return receptionists;

    return receptionists.filter((item) =>
      [item.name, item.email, item.phone]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value))
    );
  }, [receptionists, searchText]);

  const openAddModal = () => {
    if (!canCreateReceptionist) {
      toast.error("Create permission is disabled by Super Admin.");
      return;
    }

    setEditingReceptionist(null);
    setForm(getEmptyForm());
    setFieldErrors({});
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const openEditModal = (receptionist) => {
    if (!canEditReceptionist) {
      toast.error("Edit permission is disabled by Super Admin.");
      return;
    }

    setEditingReceptionist(receptionist);
    setForm({
      name: receptionist?.name || "",
      email: receptionist?.email || "",
      phone: receptionist?.phone || "",
    });
    setFieldErrors({});
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const closeModal = ({ force = false } = {}) => {
    if (saving && !force) return;

    setModalOpen(false);
    setEditingReceptionist(null);
    setForm(getEmptyForm());
    setFieldErrors({});
  };

  const updateField = (name, value) => {
    let nextValue = value;

    if (name === "name") {
      nextValue = onlyAlpha(value);
    }

    if (name === "phone") {
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

  const validateForm = () => {
    const nextErrors = {};

    nextErrors.name = validateAlpha(form.name, "Name");
    nextErrors.email = validateGmail(form.email);
    nextErrors.phone = validateMobile(form.phone, "Phone");

    if (!hospitalId) {
      nextErrors.form = "Clinic not found. Please login again.";
    }

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

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      hospitalId,
    };

    try {
      const isEditing = Boolean(editingReceptionist?.id);
      if (isEditing && !canEditReceptionist) {
        throw new Error("Edit permission is disabled by Super Admin.");
      }
      if (!isEditing && !canCreateReceptionist) {
        throw new Error("Create permission is disabled by Super Admin.");
      }

      const response = await fetch(
        isEditing
          ? `${RECEPTIONIST_API}/${editingReceptionist.id}`
          : RECEPTIONIST_API,
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(
          await parseErrorMessage(
            response,
            isEditing
              ? "Unable to update receptionist."
              : "Unable to create receptionist."
          )
        );
      }

      const data = await response.json().catch(() => ({}));
      const message =
        data?.message ||
        (isEditing
          ? "Receptionist updated successfully"
          : "Receptionist created successfully");
      setSuccess(message);
      toast.success(message);
      await fetchReceptionists();
      closeModal({ force: true });
    } catch (submitError) {
      const message = submitError.message || "Unable to save receptionist.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const toggleReceptionistStatus = async (receptionist) => {
    if (!receptionist?.id || deletingId) return;
    if (!canEditReceptionist) {
      toast.error("Edit permission is disabled by Super Admin.");
      return;
    }

    const nextStatus = receptionist.isActive ? "Inactive" : "Active";
    setDeletingId(receptionist.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${RECEPTIONIST_API}/${receptionist.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          ...receptionist,
          isActive: nextStatus === "Active",
          status: nextStatus,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await parseErrorMessage(response, "Unable to update receptionist status.")
        );
      }

      setReceptionists((previous) =>
        previous.map((item) =>
          String(item.id) === String(receptionist.id)
            ? { ...item, isActive: nextStatus === "Active" }
            : item
        )
      );
      setSuccess(
        nextStatus === "Active"
          ? "Receptionist activated successfully"
          : "Receptionist deactivated successfully"
      );
      toast.success(
        nextStatus === "Active"
          ? "Receptionist activated successfully"
          : "Receptionist deactivated successfully"
      );
    } catch (toggleError) {
      const message =
        toggleError.message || "Unable to update receptionist status.";
      setError(message);
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDelete = async (receptionist) => {
    if (!receptionist?.id || deletingId) return;
    if (!canDeleteReceptionist) {
      toast.error("Delete permission is disabled by Super Admin.");
      return;
    }

    const shouldDelete = window.confirm(
      `Delete receptionist ${receptionist.name || ""}?`
    );
    if (!shouldDelete) return;

    setDeletingId(receptionist.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${RECEPTIONIST_API}/${receptionist.id}`, {
        method: "DELETE",
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      });

      if (!response.ok) {
        throw new Error(
          await parseErrorMessage(response, "Unable to delete receptionist.")
        );
      }

      setReceptionists((previous) =>
        previous.filter((item) => item.id !== receptionist.id)
      );
      setSuccess("Receptionist deleted successfully");
      toast.success("Receptionist deleted successfully");
    } catch (deleteError) {
      const message =
        deleteError.message || "Unable to delete receptionist.";
      setError(message);
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="receptionists-page">
      <div className="receptionists-header">
        <div>
          <h2>Receptionists</h2>
          <p>
            {loading
              ? "Loading receptionists..."
              : `${filteredReceptionists.length} receptionist records`}
          </p>
        </div>

        <div className="receptionists-header-actions">
          <button
            type="button"
            className="receptionists-icon-button"
            onClick={fetchReceptionists}
            disabled={loading || saving}
            title="Refresh receptionist list"
          >
            <RefreshCw size={16} />
          </button>

          <button
            type="button"
            className="receptionists-primary-button"
            onClick={openAddModal}
            disabled={!canCreateReceptionist}
            title={canCreateReceptionist ? "Add receptionist" : permissionDisabledTitle}
          >
            <Plus size={16} />
            Add Receptionist
          </button>
        </div>
      </div>

      <div className="receptionists-toolbar">
        <div className="receptionists-search">
          <Search size={16} />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search name, email, phone..."
          />
        </div>
      </div>

      {success ? <div className="receptionists-success">{success}</div> : null}
      {error ? <div className="receptionists-error">{error}</div> : null}

      <div className="receptionists-table">
        <div className="receptionists-thead">
          <span>S.No.</span>
          <span>Name</span>
          <span>Email</span>
          <span>Phone</span>
          <span>Status</span>
          <span>Created</span>
          <span>Actions</span>
        </div>

        {!loading && filteredReceptionists.length === 0 ? (
          <div className="receptionists-empty">No receptionists found.</div>
        ) : null}

        {filteredReceptionists.map((receptionist, index) => {
          const initials =
            (receptionist.name || "R")
              .split(" ")
              .filter(Boolean)
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() || "R";
          const isDeleting = deletingId === receptionist.id;
          const receptionistClinicName = getClinicDisplayName(
            { ...receptionist, hospitalId: receptionist.hospitalId || hospitalId },
            clinicDisplayName
          );

          return (
            <div className="receptionists-row" key={receptionist.id}>
              <span>{index + 1}</span>
              <div className="receptionists-name-cell">
                <div className="receptionists-avatar">{initials}</div>
                <div>
                  <b>{receptionist.name || "-"}</b>
                  <span>{receptionistClinicName}</span>
                </div>
              </div>

              <span className="receptionists-cell">{receptionist.email || "-"}</span>
              <span className="receptionists-cell">{receptionist.phone || "-"}</span>

              <span className="receptionists-cell">
                <span
                  className={`receptionists-status ${receptionist.isActive
                      ? "receptionists-status-active"
                      : "receptionists-status-inactive"
                    }`}
                >
                  {receptionist.isActive ? "Active" : "Inactive"}
                </span>
              </span>

              <span className="receptionists-cell">
                {formatDate(receptionist.createdAt)}
              </span>

              <div className="receptionists-actions">
                <button
                  type="button"
                  className="receptionists-action-button"
                  onClick={() => openEditModal(receptionist)}
                  disabled={!canEditReceptionist || isDeleting}
                  title={canEditReceptionist ? "Edit receptionist" : permissionDisabledTitle}
                >
                  <Pencil size={14} />
                </button>

                <button
                  type="button"
                  className="receptionists-action-button"
                  onClick={() => toggleReceptionistStatus(receptionist)}
                  disabled={!canEditReceptionist || isDeleting}
                  title={canEditReceptionist ? (receptionist.isActive ? "Deactivate receptionist" : "Activate receptionist") : permissionDisabledTitle}
                >
                  {receptionist.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                </button>

                <button
                  type="button"
                  className="receptionists-action-button receptionists-action-danger"
                  onClick={() => handleDelete(receptionist)}
                  disabled={!canDeleteReceptionist || isDeleting}
                  title={canDeleteReceptionist ? "Delete receptionist" : permissionDisabledTitle}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen ? (
        <div className="receptionists-modal-overlay" onClick={closeModal}>
          <div
            className="receptionists-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="receptionists-modal-header">
              <div className="receptionists-modal-title">
                <div className="receptionists-modal-icon">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3>
                    {editingReceptionist ? "Edit Receptionist" : "Add Receptionist"}
                  </h3>
                  <p>{clinicDisplayName}</p>
                </div>
              </div>

              <button
                type="button"
                className="receptionists-modal-close"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close receptionist form"
              >
                <X size={20} />
              </button>
            </div>

            <form className="receptionists-form" onSubmit={handleSubmit} noValidate>
              <div className="receptionists-field">
                <label htmlFor="receptionist-name">Name</label>
                <input
                  id="receptionist-name"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  className={fieldErrors.name ? "is-invalid" : ""}
                  disabled={saving}
                  autoFocus
                />
                {fieldErrors.name ? (
                  <span className="receptionists-field-error">
                    {fieldErrors.name}
                  </span>
                ) : null}
              </div>

              <div className="receptionists-field">
                <label htmlFor="receptionist-email">Email</label>
                <input
                  id="receptionist-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  className={fieldErrors.email ? "is-invalid" : ""}
                  disabled={saving}
                />
                {fieldErrors.email ? (
                  <span className="receptionists-field-error">
                    {fieldErrors.email}
                  </span>
                ) : null}
              </div>

              <div className="receptionists-field">
                <label htmlFor="receptionist-phone">Phone</label>
                <input
                  id="receptionist-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  inputMode="numeric"
                  pattern="^(?!([0-9])\\1{9})[6-9][0-9]{9}$"
                  maxLength={10}
                  placeholder="10-digit Indian mobile number"
                  title="Enter a 10-digit Indian mobile number starting with 6-9 and not all identical digits"
                  className={fieldErrors.phone ? "is-invalid" : ""}
                  disabled={saving}
                />
                {fieldErrors.phone ? (
                  <span className="receptionists-field-error">
                    {fieldErrors.phone}
                  </span>
                ) : null}
              </div>

              {fieldErrors.form ? (
                <div className="receptionists-error receptionists-form-message">
                  {fieldErrors.form}
                </div>
              ) : null}

              <div className="receptionists-modal-actions">
                <button
                  type="button"
                  className="receptionists-secondary-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="receptionists-save-button"
                  disabled={
                    saving ||
                    (editingReceptionist
                      ? !canEditReceptionist
                      : !canCreateReceptionist)
                  }
                >
                  <CheckCircle size={16} />
                  {saving
                    ? "Saving..."
                    : editingReceptionist
                      ? "Update Receptionist"
                      : "Create Receptionist"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Receptionists;
