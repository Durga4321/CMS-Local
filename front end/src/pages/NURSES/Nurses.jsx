import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle, Eye, Pencil, Plus, RefreshCw, Search, ShieldPlus, Trash2, ToggleLeft, ToggleRight, X, HeartPulse, Syringe, Activity, Stethoscope, Mail, Phone, MapPin, LayoutGrid, List } from "lucide-react";
import { ActionsGroup } from "../../components/ActionsGroup";
import "./Nurses.css";
import { apiUrl } from "../../config/api";
import { useToast } from "../../components/ToastProvider";
import { getNurses as fetchStaffNurses } from "../../Nurse/nurseApi";
import {
  buildBranchOptions,
  fetchBranchesForHospital,
  getApiHeaders,
  getStoredHospitalId,
  recordBelongsToClinicScope,
} from "../../utils/branchApi";
import { getClinicDisplayName } from "../../utils/clinicDisplay";
import { useAdminModulePermissions } from "../../utils/rolePermissions";
import {
  onlyAlpha,
  onlyIndianMobileValue,
  validateAlpha,
  validateGmail,
  validateMobile,
  validateSelected,
  validateStrongPassword,
} from "../../utils/validation";

const STAFF_URL = apiUrl("Staff");
const NURSES_URL = apiUrl("Nurses");
const STAFF_TOGGLE_STATUS = (id) => apiUrl(`Staff/${encodeURIComponent(id)}/toggle-status`);
const NURSE_URL = apiUrl("Nurse");

const readFirst = (record = {}, keys = [], fallback = "") => {
  for (const key of keys) {
    const value = String(key)
      .split(".")
      .reduce((current, part) => (current && typeof current === "object" ? current[part] : undefined), record);
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return fallback;
};

const getNurseId = (nurse) => readFirst(nurse, ["id", "Id", "nurseId", "NurseId", "userId", "UserId"]);
const getNurseName = (nurse) => readFirst(nurse, ["name", "Name", "nurseName", "NurseName", "fullName"], "-");
const getNurseEmail = (nurse) => readFirst(nurse, ["email", "Email", "emailAddress"], "-");
const getNursePhone = (nurse) => readFirst(nurse, ["phone", "Phone", "phoneNumber", "PhoneNumber", "mobile"], "-");
const getNurseBranchId = (nurse) => readFirst(nurse, ["branchId", "BranchId", "branch.id", "branch.branchId"]);
const getNurseBranchName = (nurse, branchNameById) =>
  readFirst(nurse, ["branchName", "BranchName", "branch.name", "branch.branchName"], branchNameById[String(getNurseBranchId(nurse) || "")] || "-");

const getNurseStatus = (nurse) => {
  const active = readFirst(nurse, ["isActive", "IsActive", "active", "Active"], "");
  if (typeof active === "boolean") return active ? "Active" : "Inactive";
  const status = String(readFirst(nurse, ["status", "Status"], "")).trim();
  if (status) return status;
  return "Active";
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const getErrorMessage = async (response, fallback) => {
  const text = await response.text().catch(() => "");
  if (!text) return fallback;
  try {
    const data = JSON.parse(text);
    const validation = data?.errors && typeof data.errors === "object"
      ? Object.entries(data.errors).flatMap(([key, values]) =>
          (Array.isArray(values) ? values : [values]).map((value) => `${key}: ${value}`)
        ).join(" ")
      : "";
    return data?.message || validation || data?.title || text;
  } catch {
    return text;
  }
};

const buildStaffFormData = (payload = {}, imageFile = null) => {
  const body = new FormData();
  body.append("Name", payload.Name || "");
  body.append("Email", payload.Email || "");
  body.append("Phone", payload.Phone || "");
  body.append("Role", payload.Role || "Nurse");
  body.append("Password", payload.Password || "");
  body.append("IsActive", String(payload.IsActive ?? true));
  body.append("BranchId", String(payload.BranchId || ""));
  body.append("Image", imageFile || new Blob([]), imageFile?.name || "");
  return body;
};

const requestNurseSave = async ({ urls = [], method, payload, imageFile, fallbackMessage }) => {
  let lastError = null;

  for (const url of urls) {
    try {
      const body = buildStaffFormData(payload, imageFile);
      const response = await fetch(url, {
        method,
        headers: {
          ...getApiHeaders(),
        },
        body,
      });

      if (response.ok) {
        return response.json().catch(() => ({}));
      }

      lastError = new Error(await getErrorMessage(response, fallbackMessage));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(fallbackMessage);
};

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  branchId: "",
  isActive: true,
};

function Nurses() {
  const toast = useToast();
  const { canCreate, canEdit, canDelete } = useAdminModulePermissions("Nurses");
  const hospitalId = getStoredHospitalId();
  const clinicName = getClinicDisplayName({
    hospitalName: localStorage.getItem("hospitalName"),
    clinicName: localStorage.getItem("clinicName"),
  }, "Clinic");
  const [nurses, setNurses] = useState([]);
  const [activeActionState, setActiveActionState] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [editingNurse, setEditingNurse] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [viewMode, setViewMode] = useState("grid");
  const imageInputRef = useRef(null);

  const branchNameById = useMemo(
    () => branches.reduce((lookup, branch) => ({ ...lookup, [String(branch.id)]: branch.name }), {}),
    [branches]
  );
  const scopedBranchIds = useMemo(() => branches.map((branch) => branch.id), [branches]);

  const fetchNurses = async () => {
    return fetchStaffNurses();
  };

  const loadNurses = useCallback(async () => {
    setLoading(true);
    try {
      setNurses(await fetchNurses());
    } catch (error) {
      toast.error(error.message || "Unable to load nurses.");
    } finally {
      setLoading(false);
    }
  }, [hospitalId, toast]);

  useEffect(() => {
    loadNurses();
    setLoadingBranches(true);
    fetchBranchesForHospital(hospitalId, clinicName)
      .then((data) => setBranches(buildBranchOptions(data)))
      .catch(() => setBranches([]))
      .finally(() => setLoadingBranches(false));
  }, [hospitalId, clinicName, loadNurses]);

  const filteredNurses = useMemo(() => {
    const scopedNurses = nurses.filter((nurse) =>
      recordBelongsToClinicScope(nurse, {
        hospitalId,
        clinicName,
        branchIds: scopedBranchIds,
      })
    );
    const term = search.trim().toLowerCase();
    if (!term) return scopedNurses;
    return scopedNurses.filter((nurse) =>
      [getNurseName(nurse), getNurseEmail(nurse), getNursePhone(nurse), getNurseBranchName(nurse, branchNameById)]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [branchNameById, nurses, search, hospitalId, clinicName, scopedBranchIds]);

  const updateField = (field, value) => {
    const nextValue = field === "name" ? onlyAlpha(value) : field === "phone" ? onlyIndianMobileValue(value) : value;
    setForm((current) => ({ ...current, [field]: nextValue }));
    setFieldErrors((current) => ({ ...current, [field]: "", form: "" }));
    setMessage("");
  };

  const validateForm = () => {
    const errors = {
      name: validateAlpha(form.name, "Name"),
      email: validateGmail(form.email, "Email"),
      phone: validateMobile(form.phone, "Phone"),
      password: validateStrongPassword(form.password, "Password"),
      branchId: validateSelected(form.branchId, "a branch"),
    };
    Object.keys(errors).forEach((key) => {
      if (!errors[key]) delete errors[key];
    });
    if (!hospitalId) errors.form = "Clinic not found. Please login again.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openModal = () => {
    if (!canCreate) {
      toast.error("You do not have permission to create nurses.");
      return;
    }
    setEditingNurse(null);
    setForm(emptyForm);
    setImageFile(null);
    setFieldErrors({});
    setMessage("");
    setModalOpen(true);
  };

  const openEditModal = (nurse) => {
    if (!canEdit) {
      toast.error("You do not have permission to edit nurses.");
      return;
    }
    setEditingNurse(nurse);
    setForm({
      name: getNurseName(nurse) || "",
      email: getNurseEmail(nurse) || "",
      phone: getNursePhone(nurse) || "",
      password: "",
      branchId: String(getNurseBranchId(nurse) || ""),
      isActive: !getNurseStatus(nurse).toLowerCase().includes("inactive"),
    });
    setImageFile(null);
    setFieldErrors({});
    setMessage("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setEditingNurse(null);
    setModalOpen(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (editingNurse ? !canEdit : !canCreate) {
      toast.error(`You do not have permission to ${editingNurse ? "edit" : "create"} nurses.`);
      return;
    }
    if (!validateForm()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        Name: form.name.trim(),
        nurseName: form.name.trim(),
        NurseName: form.name.trim(),
        fullName: form.name.trim(),
        FullName: form.name.trim(),
        email: form.email.trim(),
        Email: form.email.trim(),
        emailAddress: form.email.trim(),
        EmailAddress: form.email.trim(),
        nurseEmail: form.email.trim(),
        NurseEmail: form.email.trim(),
        userEmail: form.email.trim(),
        UserEmail: form.email.trim(),
        phone: form.phone.trim(),
        Phone: form.phone.trim(),
        phoneNumber: form.phone.trim(),
        PhoneNumber: form.phone.trim(),
        mobile: form.phone.trim(),
        Mobile: form.phone.trim(),
        mobileNumber: form.phone.trim(),
        MobileNumber: form.phone.trim(),
        nursePhone: form.phone.trim(),
        NursePhone: form.phone.trim(),
        contactNumber: form.phone.trim(),
        ContactNumber: form.phone.trim(),
        password: form.password || undefined,
        Password: form.password || undefined,
        hospitalId: Number(hospitalId) || hospitalId,
        HospitalId: Number(hospitalId) || hospitalId,
        clinicId: Number(hospitalId) || hospitalId,
        ClinicId: Number(hospitalId) || hospitalId,
        branchId: Number(form.branchId) || form.branchId,
        BranchId: Number(form.branchId) || form.branchId,
        role: "Nurse",
        Role: "Nurse",
        roleName: "Nurse",
        RoleName: "Nurse",
        type: "Nurse",
        Type: "Nurse",
        staffRole: "Nurse",
        StaffRole: "Nurse",
        IsActive: Boolean(form.isActive),
      };
      const editingId = getNurseId(editingNurse || {});
      const isEditing = Boolean(editingId);
      const encodedId = encodeURIComponent(editingId);
      const result = await requestNurseSave({
        urls: isEditing
          ? [
              `${NURSES_URL}/${encodedId}`,
              `${NURSE_URL}/${encodedId}`,
              `${STAFF_URL}/${encodedId}`,
            ]
          : [
              NURSES_URL,
              NURSE_URL,
              STAFF_URL,
            ],
        method: isEditing ? "PUT" : "POST",
        payload,
        imageFile,
        fallbackMessage: isEditing ? "Unable to update nurse." : "Unable to create nurse.",
      });
      const saved = result || {};
      if (isEditing) {
        setNurses((previous) =>
          previous.map((item) =>
            String(getNurseId(item)) === String(editingId)
              ? { ...item, ...saved, branchId: payload.branchId, name: payload.name, email: payload.email, phone: payload.phone }
              : item
          )
        );
        toast.success("Nurse updated successfully.");
        setMessage("Nurse updated successfully.");
      } else {
        toast.success("Nurse created successfully.");
        setMessage("Nurse created successfully.");
        await loadNurses();
      }

      setModalOpen(false);
      setEditingNurse(null);
      setImageFile(null);
    } catch (error) {
      setFieldErrors({ form: error.message || (editingNurse ? "Unable to update nurse." : "Unable to create nurse.") });
      toast.error(error.message || (editingNurse ? "Unable to update nurse." : "Unable to create nurse."));
    } finally {
      setSaving(false);
    }
  };

  const toggleNurseStatus = async (nurse) => {
    if (!canEdit) {
      toast.error("You do not have permission to edit nurses.");
      return;
    }
    const nurseId = getNurseId(nurse);
    if (!nurseId || deletingId) return;
    setDeletingId(nurseId);
    setMessage("");
    try {
      const response = await fetch(STAFF_TOGGLE_STATUS(nurseId), {
        method: "PATCH",
        headers: {
          ...getApiHeaders(),
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response, "Unable to update nurse status."));
      }

      const updated = await response.json().catch(() => null);
      setNurses((previous) =>
        previous.map((item) =>
          String(getNurseId(item)) === String(nurseId)
            ? { ...item, ...(updated || {}), isActive: updated?.isActive ?? !item.isActive }
            : item
        )
      );
      const nextStatus = updated?.isActive ? "Active" : updated?.isActive === false ? "Inactive" : getNurseStatus(nurse).toLowerCase().includes("inactive") ? "Active" : "Inactive";
      toast.success(`Nurse status updated to ${nextStatus}.`);
      setMessage(`Nurse status updated to ${nextStatus}.`);
    } catch (error) {
      toast.error(error.message || "Unable to update nurse status.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteNurse = async (nurse) => {
    if (!canDelete) {
      toast.error("You do not have permission to delete nurses.");
      return;
    }
    const nurseId = getNurseId(nurse);
    if (!nurseId || deletingId) return;
    const name = getNurseName(nurse);
    const confirmed = window.confirm(`Delete nurse ${name || "this nurse"}?`);
    if (!confirmed) return;
    setDeletingId(nurseId);
    setMessage("");
    try {
      const response = await fetch(`${STAFF_URL}/${encodeURIComponent(nurseId)}`, {
        method: "DELETE",
        headers: getApiHeaders(),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response, "Unable to delete nurse."));
      }

      setNurses((previous) => previous.filter((item) => String(getNurseId(item)) !== String(nurseId)));
      toast.success("Nurse deleted successfully.");
      setMessage("Nurse deleted successfully.");
    } catch (error) {
      toast.error(error.message || "Unable to delete nurse.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="nurses-page">
      <div className="nurses-header">
        <div>
          <h2>Nurses</h2>
          <p>{loading ? "Loading nurses..." : `${filteredNurses.length} nurses registered for ${clinicName}`}</p>
        </div>
        <div className="nurses-header-actions">
          <button type="button" className="nurses-icon-button" onClick={loadNurses} disabled={loading} title="Refresh nurses">
            <RefreshCw size={16} />
          </button>
          <button type="button" className="nurses-primary-button" onClick={openModal} disabled={!canCreate}>
            <Plus size={16} /> Add Nurse
          </button>
        </div>
      </div>

      {message ? <div className="nurses-success">{message}</div> : null}

      <div className="nurses-table-card">
        <div className="nurses-toolbar">
          <label className="nurses-search">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search nurses..."
            />
          </label>
        </div>

        <div className="nurses-table">
          <div className="nurses-thead">
            <span>S.NO.</span>
            <span>NAME</span>
            <span>BRANCH</span>
            <span>EMAIL</span>
            <span>PHONE</span>
            <span className="nurses-status-head">STATUS</span>
            <span className="nurses-actions-head">ACTIONS</span>
          </div>

          {!loading && filteredNurses.length === 0 ? (
            <div className="nurses-empty">No nurses found.</div>
          ) : null}

          {filteredNurses.map((nurse, index) => {
            const name = getNurseName(nurse);
            const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "N";
            const status = getNurseStatus(nurse);
            const isActive = !status.toLowerCase().includes("inactive");

            return (
              <div className="nurses-row" key={getNurseId(nurse) || `${name}-${index}`}>
                <span className="nurses-sno">{index + 1}</span>

                <div className="nurses-name-cell">
                  <span className="nurses-avatar"><span>{initials}</span></span>
                  <span className="nurses-name-highlight">
                    <b>{name}</b>
                  </span>
                </div>

                <span className="nurses-cell nurses-branch-cell">{getNurseBranchName(nurse, branchNameById)}</span>
                <span className="nurses-cell nurses-email-cell">{getNurseEmail(nurse)}</span>
                <span className="nurses-cell nurses-phone-cell">{getNursePhone(nurse)}</span>

                <span className="nurses-cell nurses-status-cell">
                  <span className={`nurses-status ${isActive ? "nurses-status-active" : "nurses-status-inactive"}`}>
                    {status}
                  </span>
                </span>

                <div className="nurses-actions">
                  <ActionsGroup
                    rowId={getNurseId(nurse)}
                    activeActionState={activeActionState}
                    setActiveActionState={setActiveActionState}
                    canView={true}
                    canEdit={canEdit}
                    canStatus={canEdit}
                    canDelete={canDelete}
                    statusChecked={isActive}
                    statusDisabled={deletingId === String(getNurseId(nurse))}
                    statusTitle={isActive ? "Deactivate nurse" : "Activate nurse"}
                    onView={() => window.alert(`Nurse: ${name || "-"}\nBranch: ${getNurseBranchName(nurse, branchNameById) || "-"}\nEmail: ${getNurseEmail(nurse) || "-"}\nPhone: ${getNursePhone(nurse) || "-"}\nStatus: ${status || "-"}`)}
                    onEdit={() => openEditModal(nurse)}
                    onStatus={() => toggleNurseStatus(nurse)}
                    onDelete={() => handleDeleteNurse(nurse)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modalOpen ? (
        <div className="nurses-modal-overlay" onClick={closeModal}>
          <div className="nurses-modal" onClick={(event) => event.stopPropagation()}>
            <div className="nurses-modal-header">
              <div className="nurses-modal-title">
                <div className="nurses-modal-icon"><ShieldPlus size={20} /></div>
                <div>
                  <h3>{editingNurse ? "Edit Nurse" : "Add Nurse"}</h3>
                  <p>{clinicName}</p>
                </div>
              </div>
              <button type="button" className="nurses-modal-close" onClick={closeModal} disabled={saving} aria-label="Close nurse form">
                <X size={20} />
              </button>
            </div>

            <form className="nurses-form" onSubmit={handleSubmit} noValidate>
              <div className="nurses-image-upload">
                <button
                  type="button"
                  className="nurses-image-circle"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={saving}
                  title="Upload nurse image"
                >
                  <span>{(form.name || "N").slice(0, 1).toUpperCase()}</span>
                  <Camera size={18} className="nurses-image-button" />
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(event) => setImageFile(event.target.files?.[0] || null)}
                  disabled={saving}
                />
                {imageFile ? <span className="nurses-image-filename">{imageFile.name}</span> : null}
              </div>

              <div className="nurses-field">
                <label htmlFor="nurse-name">Name</label>
                <input id="nurse-name" value={form.name} onChange={(event) => updateField("name", event.target.value)} className={fieldErrors.name ? "is-invalid" : ""} disabled={saving} autoFocus />
                {fieldErrors.name ? <span className="nurses-field-error">{fieldErrors.name}</span> : null}
              </div>
              <div className="nurses-field">
                <label htmlFor="nurse-email">Email</label>
                <input id="nurse-email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} className={fieldErrors.email ? "is-invalid" : ""} disabled={saving} />
                {fieldErrors.email ? <span className="nurses-field-error">{fieldErrors.email}</span> : null}
              </div>
              <div className="nurses-field">
                <label htmlFor="nurse-phone">Phone</label>
                <input id="nurse-phone" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} inputMode="numeric" maxLength={10} className={fieldErrors.phone ? "is-invalid" : ""} disabled={saving} />
                {fieldErrors.phone ? <span className="nurses-field-error">{fieldErrors.phone}</span> : null}
              </div>
              <div className="nurses-field">
                <label htmlFor="nurse-password">Password</label>
                <input id="nurse-password" type="password" value={form.password} onChange={(event) => updateField("password", event.target.value)} className={fieldErrors.password ? "is-invalid" : ""} disabled={saving} />
                {fieldErrors.password ? <span className="nurses-field-error">{fieldErrors.password}</span> : null}
              </div>
              <div className="nurses-field">
                <label htmlFor="nurse-branch">Branch</label>
                <select id="nurse-branch" value={form.branchId} onChange={(event) => updateField("branchId", event.target.value)} className={fieldErrors.branchId ? "is-invalid" : ""} disabled={loadingBranches || saving}>
                  <option value="">{loadingBranches ? "Loading branches..." : "Select branch"}</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
                {fieldErrors.branchId ? <span className="nurses-field-error">{fieldErrors.branchId}</span> : null}
              </div>
              <div className="nurses-field">
                <label htmlFor="nurse-is-active">Is Active</label>
                <select
                  id="nurse-is-active"
                  value={form.isActive ? "Active" : "Inactive"}
                  onChange={(event) => updateField("isActive", event.target.value === "Active")}
                  disabled={saving}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              {fieldErrors.form ? <div className="nurses-error nurses-form-message">{fieldErrors.form}</div> : null}

              <div className="nurses-modal-actions">
                <button type="button" className="nurses-secondary-button" onClick={closeModal} disabled={saving}>Cancel</button>
                <button type="submit" className="nurses-save-button" disabled={saving || (editingNurse ? !canEdit : !canCreate)}>
                  <CheckCircle size={16} />
                  {saving ? "Saving..." : editingNurse ? "Update Nurse" : "Create Nurse"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Nurses;
