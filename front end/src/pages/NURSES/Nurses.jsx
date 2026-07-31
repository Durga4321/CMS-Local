import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle, Pencil, Plus, RefreshCw, Search, ShieldPlus, Trash2, UserRoundCheck, X } from "lucide-react";
import "../RECEPTIONISTS/Receptionists.css";
import { apiUrl } from "../../config/api";
import { useToast } from "../../components/ToastProvider";
import { buildBranchOptions, fetchBranchesForHospital, getApiHeaders, getStoredHospitalId } from "../../utils/branchApi";
import { getClinicDisplayName } from "../../utils/clinicDisplay";
import {
  onlyAlpha,
  onlyIndianMobileValue,
  validateAlpha,
  validateGmail,
  validateMobile,
  validateSelected,
  validateStrongPassword,
} from "../../utils/validation";

const REGISTER_NURSE_API = apiUrl("Auth/register-nurse");

const parseList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.nurses)) return data.nurses;
  if (Array.isArray(data?.Nurses)) return data.Nurses;
  if (Array.isArray(data?.staff)) return data.staff;
  if (Array.isArray(data?.Staff)) return data.Staff;
  return [];
};

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

const fetchNurses = async () => {
  const endpoints = [apiUrl("Nurse"), apiUrl("Nurses"), apiUrl("Staff")];
  for (const endpoint of endpoints) {
    const response = await fetch(endpoint, { headers: getApiHeaders() }).catch(() => null);
    if (response?.ok) return parseList(await response.json().catch(() => []));
  }
  return [];
};

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  branchId: "",
};

function Nurses() {
  const toast = useToast();
  const hospitalId = getStoredHospitalId();
  const clinicName = getClinicDisplayName({
    hospitalName: localStorage.getItem("hospitalName"),
    clinicName: localStorage.getItem("clinicName"),
  }, "Clinic");
  const [nurses, setNurses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState("");

  const branchNameById = useMemo(
    () => branches.reduce((lookup, branch) => ({ ...lookup, [String(branch.id)]: branch.name }), {}),
    [branches]
  );

  const loadNurses = useCallback(async () => {
    setLoading(true);
    try {
      setNurses(await fetchNurses());
    } catch (error) {
      toast.error(error.message || "Unable to load nurses.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadNurses();
    setLoadingBranches(true);
    fetchBranchesForHospital(hospitalId)
      .then((data) => setBranches(buildBranchOptions(data)))
      .catch(() => setBranches([]))
      .finally(() => setLoadingBranches(false));
  }, [hospitalId, loadNurses]);

  const filteredNurses = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return nurses;
    return nurses.filter((nurse) =>
      [getNurseName(nurse), getNurseEmail(nurse), getNursePhone(nurse), getNurseBranchName(nurse, branchNameById)]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [branchNameById, nurses, search]);

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
    setForm(emptyForm);
    setFieldErrors({});
    setMessage("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        hospitalId: Number(hospitalId) || hospitalId,
        branchId: Number(form.branchId) || form.branchId,
      };
      const response = await fetch(REGISTER_NURSE_API, {
        method: "POST",
        headers: getApiHeaders()["Authorization"]
          ? { ...getApiHeaders(), "Content-Type": "application/json" }
          : { ...getApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response, "Unable to register nurse."));
      toast.success("Nurse registered successfully.");
      setMessage("Nurse registered successfully.");
      setModalOpen(false);
      await loadNurses();
    } catch (error) {
      setFieldErrors({ form: error.message || "Unable to register nurse." });
      toast.error(error.message || "Unable to register nurse.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="receptionists-page">
      <div className="receptionists-header">
        <div>
          <h2>Nurses</h2>
          <p>{loading ? "Loading nurses..." : `${filteredNurses.length} nurses registered for ${clinicName}`}</p>
        </div>
        <div className="receptionists-header-actions">
          <button type="button" className="receptionists-icon-button" onClick={loadNurses} disabled={loading} title="Refresh nurses">
            <RefreshCw size={16} />
          </button>
          <button type="button" className="receptionists-primary-button" onClick={openModal}>
            <Plus size={16} /> Add Nurse
          </button>
        </div>
      </div>

      <div className="receptionists-toolbar">
        <label className="receptionists-search">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search nurses..." />
        </label>
      </div>

      {message ? <div className="receptionists-success">{message}</div> : null}

      <div className="receptionists-table">
        <div className="receptionists-thead">
          <span>Nurse</span>
          <span>Branch</span>
          <span>Email</span>
          <span>Phone</span>
          <span>Status</span>
          <span>Created</span>
        </div>
        {!loading && filteredNurses.length === 0 ? (
          <div className="receptionists-empty">No nurses found.</div>
        ) : null}
        {filteredNurses.map((nurse, index) => {
          const name = getNurseName(nurse);
          const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "N";
          const status = getNurseStatus(nurse);
          return (
            <div className="receptionists-row" key={getNurseId(nurse) || `${name}-${index}`}>
              <span style={{ display: "none" }} />
              <div className="receptionists-name-cell">
                <span className="receptionists-avatar"><span>{initials}</span></span>
                <span>
                  <b>{name}</b>
                  <span>{clinicName}</span>
                </span>
              </div>
              <span className="receptionists-cell">{getNurseBranchName(nurse, branchNameById)}</span>
              <span className="receptionists-cell receptionists-email">{getNurseEmail(nurse)}</span>
              <span className="receptionists-cell">{getNursePhone(nurse)}</span>
              <span className="receptionists-cell receptionists-status-cell">
                <span className={`receptionists-status ${status.toLowerCase().includes("inactive") ? "receptionists-status-inactive" : "receptionists-status-active"}`}>
                  {status}
                </span>
              </span>
              <span className="receptionists-cell">{formatDate(readFirst(nurse, ["createdAt", "CreatedAt", "createdOn", "CreatedOn", "created", "Created", "createdDate", "CreatedDate"]))}</span>
              <div className="receptionists-actions">
                <button
                  type="button"
                  className="receptionists-action-button"
                  onClick={() => toast.info("Edit nurse coming soon")}
                  title="Edit nurse"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className="receptionists-action-button"
                  onClick={() => toast.info("View nurse details coming soon")}
                  title="View nurse"
                >
                  <CheckCircle size={16} />
                </button>
                <button
                  type="button"
                  className="receptionists-action-button receptionists-action-danger"
                  onClick={() => toast.info("Delete nurse coming soon")}
                  title="Delete nurse"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen ? (
        <div className="receptionists-modal-overlay" onClick={closeModal}>
          <div className="receptionists-modal" onClick={(event) => event.stopPropagation()}>
            <div className="receptionists-modal-header">
              <div className="receptionists-modal-title">
                <div className="receptionists-modal-icon"><ShieldPlus size={20} /></div>
                <div>
                  <h3>Add Nurse</h3>
                  <p>{clinicName}</p>
                </div>
              </div>
              <button type="button" className="receptionists-modal-close" onClick={closeModal} disabled={saving} aria-label="Close nurse form">
                <X size={20} />
              </button>
            </div>

            <form className="receptionists-form" onSubmit={handleSubmit} noValidate>
              <div className="receptionists-image-upload">
                <div className="receptionists-image-circle">
                  <span>{(form.name || "N").slice(0, 1).toUpperCase()}</span>
                  <UserRoundCheck size={18} className="receptionists-image-button" />
                </div>
              </div>

              <div className="receptionists-field">
                <label htmlFor="nurse-name">Name</label>
                <input id="nurse-name" value={form.name} onChange={(event) => updateField("name", event.target.value)} className={fieldErrors.name ? "is-invalid" : ""} disabled={saving} autoFocus />
                {fieldErrors.name ? <span className="receptionists-field-error">{fieldErrors.name}</span> : null}
              </div>
              <div className="receptionists-field">
                <label htmlFor="nurse-email">Email</label>
                <input id="nurse-email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} className={fieldErrors.email ? "is-invalid" : ""} disabled={saving} />
                {fieldErrors.email ? <span className="receptionists-field-error">{fieldErrors.email}</span> : null}
              </div>
              <div className="receptionists-field">
                <label htmlFor="nurse-phone">Phone</label>
                <input id="nurse-phone" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} inputMode="numeric" maxLength={10} className={fieldErrors.phone ? "is-invalid" : ""} disabled={saving} />
                {fieldErrors.phone ? <span className="receptionists-field-error">{fieldErrors.phone}</span> : null}
              </div>
              <div className="receptionists-field">
                <label htmlFor="nurse-password">Password</label>
                <input id="nurse-password" type="password" value={form.password} onChange={(event) => updateField("password", event.target.value)} className={fieldErrors.password ? "is-invalid" : ""} disabled={saving} />
                {fieldErrors.password ? <span className="receptionists-field-error">{fieldErrors.password}</span> : null}
              </div>
              <div className="receptionists-field">
                <label htmlFor="nurse-branch">Branch</label>
                <select id="nurse-branch" value={form.branchId} onChange={(event) => updateField("branchId", event.target.value)} className={fieldErrors.branchId ? "is-invalid" : ""} disabled={loadingBranches || saving}>
                  <option value="">{loadingBranches ? "Loading branches..." : "Select branch"}</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
                {fieldErrors.branchId ? <span className="receptionists-field-error">{fieldErrors.branchId}</span> : null}
              </div>

              {fieldErrors.form ? <div className="receptionists-error receptionists-form-message">{fieldErrors.form}</div> : null}

              <div className="receptionists-modal-actions">
                <button type="button" className="receptionists-secondary-button" onClick={closeModal} disabled={saving}>Cancel</button>
                <button type="submit" className="receptionists-save-button" disabled={saving}>
                  <CheckCircle size={16} />
                  {saving ? "Saving..." : "Create Nurse"}
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
