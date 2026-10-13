import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Eye, EyeOff, HeartPulse, Pencil, Pill, Plus, RefreshCw, Search, Trash2, UserPlus, X } from "lucide-react";
import { API_ENDPOINTS, apiUrl, replacePathParams } from "../../config/api";
import { useToast } from "../../components/ToastProvider";
import {
  buildBranchOptions,
  fetchBranchesForHospital,
  getApiHeaders,
  getStoredHospitalId,
} from "../../utils/branchApi";
import { getClinicDisplayName } from "../../utils/clinicDisplay";
import "./Pharmacists.css";

const emptyForm = {
  name: "",
  email: "",
  mobileNumber: "",
  password: "",
  branchId: "",
};

const getResponseError = (payload, fallback) => {
  const validation = payload?.errors && typeof payload.errors === "object"
    ? Object.values(payload.errors).flat().filter(Boolean).join(" ")
    : "";
  return payload?.message || validation || payload?.title || payload?.error ||
    (typeof payload === "string" ? payload : "") || fallback;
};

const parsePharmacistList = (payload) => {
  const value = payload?.data ?? payload;
  if (Array.isArray(value)) return value;
  for (const key of ["items", "results", "records", "pharmacists", "users"]) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
};

const getPharmacistValue = (pharmacist, ...keys) => {
  for (const key of keys) {
    const value = key.split(".").reduce((current, part) => current?.[part], pharmacist);
    if (value !== null && value !== undefined && String(value).trim() !== "") return value;
  }
  return "";
};

const getBranchDisplayName = (pharmacist, branches = []) => {
  const branchName = getPharmacistValue(pharmacist, "branchName", "BranchName", "branch.name", "branch.Name");
  if (branchName && !/^\d+$/.test(String(branchName).trim())) return branchName;

  const branchId = getPharmacistValue(pharmacist, "branchId", "BranchId", "branchID", "BranchID", "clinicBranchId", "branch.id", "branch.Id");
  if (!branchId) return "-";
  return branches.find((branch) => String(branch.id) === String(branchId))?.name || "-";
};

export default function Pharmacists() {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState([]);
  const [allBranches, setAllBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [branchesError, setBranchesError] = useState("");
  const [error, setError] = useState("");
  const [createdPharmacist, setCreatedPharmacist] = useState(null);
  const [pharmacists, setPharmacists] = useState([]);
  const [loadingPharmacists, setLoadingPharmacists] = useState(true);
  const [pharmacistsError, setPharmacistsError] = useState("");
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingPharmacist, setEditingPharmacist] = useState(null);
  const [viewingPharmacist, setViewingPharmacist] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState("");

  const loadPharmacists = useCallback(async () => {
    setLoadingPharmacists(true);
    setPharmacistsError("");
    try {
      const response = await fetch(apiUrl(API_ENDPOINTS.pharmacists.list), {
        method: "GET",
        headers: getApiHeaders(),
        cache: "no-store",
      });
      const text = await response.text();
      let result = null;
      if (text) {
        try {
          result = JSON.parse(text);
        } catch {
          result = text;
        }
      }
      if (!response.ok) {
        throw new Error(getResponseError(result, `Unable to load pharmacists (HTTP ${response.status}).`));
      }
      setPharmacists(parsePharmacistList(result));
    } catch (requestError) {
      setPharmacists([]);
      setPharmacistsError(requestError.message || "Unable to load pharmacists.");
    } finally {
      setLoadingPharmacists(false);
    }
  }, []);

  useEffect(() => {
    loadPharmacists();
  }, [loadPharmacists]);

  const filteredPharmacists = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return pharmacists;
    return pharmacists.filter((pharmacist) =>
      [
        getPharmacistValue(pharmacist, "name", "Name", "fullName", "FullName"),
        getPharmacistValue(pharmacist, "email", "Email", "emailAddress", "EmailAddress"),
        getPharmacistValue(pharmacist, "mobileNumber", "MobileNumber", "phone", "Phone", "phoneNumber", "PhoneNumber"),
        getBranchDisplayName(pharmacist, allBranches),
      ].join(" ").toLowerCase().includes(term)
    );
  }, [allBranches, pharmacists, search]);

  const openCreateForm = () => {
    setEditingPharmacist(null);
    setForm({ ...emptyForm });
    setError("");
    setCreatedPharmacist(null);
    setShowCreateForm(true);
  };

  const openEditForm = (pharmacist) => {
    setEditingPharmacist(pharmacist);
    setForm({
      name: getPharmacistValue(pharmacist, "name", "Name", "fullName", "FullName"),
      email: getPharmacistValue(pharmacist, "email", "Email", "emailAddress", "EmailAddress"),
      mobileNumber: String(getPharmacistValue(pharmacist, "mobileNumber", "MobileNumber", "phone", "Phone", "phoneNumber", "PhoneNumber")),
      password: "",
      branchId: String(getPharmacistValue(pharmacist, "branchId", "BranchId")),
    });
    setError("");
    setCreatedPharmacist(null);
    setShowCreateForm(true);
  };

  useEffect(() => {
    let active = true;
    const clinicName = getClinicDisplayName({
      hospitalName: localStorage.getItem("hospitalName"),
      clinicName: localStorage.getItem("clinicName"),
    }, "Clinic");
    fetchBranchesForHospital(getStoredHospitalId(), clinicName)
      .then((items) => {
        if (!active) return;
        const branchOptions = buildBranchOptions(items);
        const availableBranches = branchOptions.filter((branch) => branch.isActive);
        setAllBranches(branchOptions);
        setBranches(availableBranches);
        if (!availableBranches.length) {
          setBranchesError("No active branches were found for this clinic. Create or activate a branch before adding a pharmacist.");
        }
      })
      .catch((branchError) => {
        if (active) setBranchesError(branchError.message || "Unable to load clinic branches.");
      })
      .finally(() => {
        if (active) setLoadingBranches(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
    setCreatedPharmacist(null);
  };

  const createPharmacist = async (event) => {
    event.preventDefault();
    if (saving) return;

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      mobileNumber: form.mobileNumber.trim(),
    };
    if (!payload.name || payload.name.length > 100) {
      setError("Enter a name with no more than 100 characters.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(payload.mobileNumber)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (!editingPharmacist && form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    const userId = getPharmacistValue(editingPharmacist, "userId", "UserId", "id", "Id", "pharmacistId", "PharmacistId");
    const branchId = Number(form.branchId);
    if (!editingPharmacist && (!Number.isInteger(branchId) || branchId < 1)) {
      setError("Select a valid branch for this pharmacist.");
      return;
    }
    if (editingPharmacist && !userId) {
      setError("This pharmacist record does not include a user ID required for updates.");
      return;
    }

    setSaving(true);
    setError("");
    setCreatedPharmacist(null);
    try {
      const isEditing = Boolean(editingPharmacist);
      const currentStatus = getPharmacistValue(editingPharmacist, "status", "Status", "isActive", "IsActive", "active", "Active");
      const normalizedCurrentStatus = String(currentStatus).trim().toLowerCase();
      const requestPayload = isEditing
        ? {
            ...payload,
            phone: payload.mobileNumber,
            type: "Pharmacist",
            role: getPharmacistValue(editingPharmacist, "role", "Role", "roleName", "RoleName") || "Pharmacist",
            status: currentStatus === true || ["true", "active"].includes(normalizedCurrentStatus)
              ? "Active"
              : currentStatus === false || ["false", "inactive"].includes(normalizedCurrentStatus)
                ? "Inactive"
                : String(currentStatus || "Active"),
            clinic: getPharmacistValue(editingPharmacist, "clinic", "Clinic", "hospitalName", "HospitalName", "clinicName", "ClinicName") || localStorage.getItem("clinicName") || localStorage.getItem("hospitalName") || "",
            hospitalId: Number(getPharmacistValue(editingPharmacist, "hospitalId", "HospitalId", "clinicId", "ClinicId") || getStoredHospitalId()) || null,
            clinicId: Number(getPharmacistValue(editingPharmacist, "clinicId", "ClinicId", "hospitalId", "HospitalId") || getStoredHospitalId()) || null,
          }
        : {
            ...payload,
            password: form.password,
            branchId,
          };
      const response = await fetch(apiUrl(isEditing
        ? replacePathParams(API_ENDPOINTS.users.byId, { id: userId })
        : API_ENDPOINTS.pharmacists.create), {
        method: isEditing ? "PUT" : "POST",
        headers: {
          ...getApiHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });
      const text = await response.text();
      let result = null;
      if (text) {
        try {
          result = JSON.parse(text);
        } catch {
          result = text;
        }
      }
      if (!response.ok) {
        throw new Error(getResponseError(result, `${isEditing ? "Unable to update" : "Unable to create"} pharmacist (HTTP ${response.status}).`));
      }
      setCreatedPharmacist(result && typeof result === "object" ? result : { name: payload.name, email: payload.email });
      setForm({ ...emptyForm, branchId: isEditing ? "" : String(branchId) });
      setEditingPharmacist(null);
      toast.success(`Pharmacist ${isEditing ? "updated" : "created"} successfully.`);
      await loadPharmacists();
      setShowCreateForm(false);
    } catch (requestError) {
      const message = requestError.message || `Unable to ${editingPharmacist ? "update" : "create"} pharmacist.`;
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const updatePharmacistStatus = async (pharmacist) => {
    const userId = getPharmacistValue(pharmacist, "userId", "UserId", "id", "Id", "pharmacistId", "PharmacistId");
    const rawStatus = getPharmacistValue(pharmacist, "status", "Status", "isActive", "IsActive", "active", "Active");
    const normalizedStatus = String(rawStatus).trim().toLowerCase();
    const active = rawStatus === true || normalizedStatus === "true" || normalizedStatus === "active";
    const inactive = rawStatus === false || normalizedStatus === "false" || normalizedStatus === "inactive";
    if (!userId || (!active && !inactive)) {
      toast.error("This pharmacist record does not include a user ID or an active status.");
      return;
    }

    setActionLoadingId(String(userId));
    try {
      const response = await fetch(apiUrl(replacePathParams(API_ENDPOINTS.users.status, { id: userId })), {
        method: "PUT",
        headers: {
          ...getApiHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: active ? "Inactive" : "Active" }),
      });
      const text = await response.text();
      let result = null;
      if (text) {
        try {
          result = JSON.parse(text);
        } catch {
          result = text;
        }
      }
      if (!response.ok) {
        throw new Error(getResponseError(result, `Unable to update pharmacist status (HTTP ${response.status}).`));
      }
      toast.success(`Pharmacist ${active ? "deactivated" : "activated"} successfully.`);
      await loadPharmacists();
    } catch (requestError) {
      toast.error(requestError.message || "Unable to update pharmacist status.");
    } finally {
      setActionLoadingId("");
    }
  };

  const deletePharmacist = async (pharmacist) => {
    const userId = getPharmacistValue(pharmacist, "userId", "UserId", "id", "Id", "pharmacistId", "PharmacistId");
    const name = getPharmacistValue(pharmacist, "name", "Name", "fullName", "FullName") || "this pharmacist";
    if (!userId) {
      toast.error("This pharmacist record does not include a user ID required for deletion.");
      return;
    }
    if (!window.confirm(`Delete pharmacist ${name}? This action cannot be undone.`)) return;

    setActionLoadingId(String(userId));
    try {
      const response = await fetch(apiUrl(replacePathParams(API_ENDPOINTS.users.byId, { id: userId })), {
        method: "DELETE",
        headers: getApiHeaders(),
      });
      const text = await response.text();
      let result = null;
      if (text) {
        try {
          result = JSON.parse(text);
        } catch {
          result = text;
        }
      }
      if (!response.ok) {
        throw new Error(getResponseError(result, `Unable to delete pharmacist (HTTP ${response.status}).`));
      }
      toast.success("Pharmacist deleted successfully.");
      await loadPharmacists();
    } catch (requestError) {
      toast.error(requestError.message || "Unable to delete pharmacist.");
    } finally {
      setActionLoadingId("");
    }
  };

  return (
    <main className="admin-pharmacists-page">
      <header className="admin-pharmacists-header">
        <div>
          <h1>Pharmacists</h1>
          <p>{loadingPharmacists ? "Loading pharmacists..." : `${filteredPharmacists.length} pharmacists listed`}</p>
        </div>
        <div className="admin-pharmacists-header-actions">
          <button type="button" className="admin-pharmacists-refresh" onClick={loadPharmacists} disabled={loadingPharmacists} title="Refresh pharmacists" aria-label="Refresh pharmacists">
            <RefreshCw size={17} />
          </button>
          <button type="button" className="admin-pharmacists-add" onClick={openCreateForm}>
            <Plus size={17} /> Add Pharmacist
          </button>
        </div>
      </header>

      {error ? <div className="admin-pharmacists-message is-error" role="alert">{error}</div> : null}
      {pharmacistsError ? <div className="admin-pharmacists-message is-error" role="alert">{pharmacistsError}</div> : null}
      {createdPharmacist ? (
        <div className="admin-pharmacists-message is-success" role="status">
          Pharmacist created successfully
          {createdPharmacist.email ? `: ${createdPharmacist.email}` : "."}
        </div>
      ) : null}

      <section className="admin-pharmacists-list-card">
        <div className="admin-pharmacists-search">
          <Search size={18} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search pharmacists..."
            aria-label="Search pharmacists"
          />
        </div>
        <div className="admin-pharmacists-table-scroll">
          <div className="admin-pharmacists-table">
            <div className="admin-pharmacists-thead">
              <span>S.NO.</span>
              <span>NAME</span>
              <span>BRANCH</span>
              <span>EMAIL</span>
              <span>PHONE</span>
              <span>STATUS</span>
              <span className="admin-pharmacists-actions-head">ACTIONS</span>
            </div>

            {loadingPharmacists ? <div className="admin-pharmacists-empty">Loading pharmacists...</div> : null}
            {!loadingPharmacists && !pharmacistsError && filteredPharmacists.length === 0 ? (
              <div className="admin-pharmacists-empty">{search ? "No pharmacists match your search." : "No pharmacists found."}</div>
            ) : null}
            {!loadingPharmacists && filteredPharmacists.map((pharmacist, index) => {
              const name = getPharmacistValue(pharmacist, "name", "Name", "fullName", "FullName") || "-";
              const branch = getBranchDisplayName(pharmacist, allBranches);
              const userId = getPharmacistValue(pharmacist, "userId", "UserId", "id", "Id", "pharmacistId", "PharmacistId");
              const rawStatus = getPharmacistValue(pharmacist, "status", "Status", "isActive", "IsActive", "active", "Active");
              const normalizedStatus = String(rawStatus).trim().toLowerCase();
              const active = rawStatus === true || normalizedStatus === "true" || normalizedStatus === "active";
              const inactive = rawStatus === false || normalizedStatus === "false" || normalizedStatus === "inactive";
              const status = active ? "Active" : inactive ? "Inactive" : rawStatus || "-";
              const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "P";
              return (
                <div className="admin-pharmacists-row" key={getPharmacistValue(pharmacist, "id", "Id", "pharmacistId", "PharmacistId", "userId", "UserId") || index}>
                  <span className="admin-pharmacists-sno">{index + 1}</span>
                  <div className="admin-pharmacists-name">
                    <span className="admin-pharmacists-avatar">{initials}</span>
                    <b>{name}</b>
                  </div>
                  <span className="admin-pharmacists-cell">{branch}</span>
                  <span className="admin-pharmacists-cell admin-pharmacists-email">{getPharmacistValue(pharmacist, "email", "Email", "emailAddress", "EmailAddress") || "-"}</span>
                  <span className="admin-pharmacists-cell">{getPharmacistValue(pharmacist, "mobileNumber", "MobileNumber", "phone", "Phone", "phoneNumber", "PhoneNumber") || "-"}</span>
                  <span className="admin-pharmacists-cell admin-pharmacists-status-cell">
                    <span className={`admin-pharmacists-status${active ? " is-active" : inactive ? " is-inactive" : ""}`}>
                      {active || inactive ? <span className="admin-pharmacists-status-dot" aria-hidden="true" /> : null}
                      {status}
                      {active ? <Activity className="admin-pharmacists-status-pulse" size={15} aria-hidden="true" /> : null}
                    </span>
                  </span>
                  <div className="admin-pharmacists-row-actions" aria-label={`Actions for ${name}`}>
                    <button type="button" className="admin-pharmacists-action is-view" onClick={() => setViewingPharmacist(pharmacist)} title="View pharmacist details" aria-label="View pharmacist details">
                      <Eye size={18} />
                    </button>
                    <button type="button" className="admin-pharmacists-action is-edit" onClick={() => openEditForm(pharmacist)} disabled={!userId || actionLoadingId === String(userId)} title="Edit pharmacist" aria-label="Edit pharmacist">
                      <Pencil size={18} />
                    </button>
                    <button type="button" className="admin-pharmacists-action is-status" onClick={() => updatePharmacistStatus(pharmacist)} disabled={!userId || (!active && !inactive) || actionLoadingId === String(userId)} title={active ? "Deactivate pharmacist" : "Activate pharmacist"} aria-label={active ? "Deactivate pharmacist" : "Activate pharmacist"}>
                      <HeartPulse size={18} />
                    </button>
                    <button type="button" className="admin-pharmacists-action is-delete" onClick={() => deletePharmacist(pharmacist)} disabled={!userId || actionLoadingId === String(userId)} title="Delete pharmacist" aria-label="Delete pharmacist">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {showCreateForm ? (
        <div className="admin-pharmacists-modal-overlay" onClick={() => !saving && setShowCreateForm(false)}>
          <section className="admin-pharmacists-modal" role="dialog" aria-modal="true" aria-labelledby="pharmacist-form-title" onClick={(event) => event.stopPropagation()}>
            <header className="admin-pharmacists-modal-header">
              <div className="admin-pharmacists-card-title">
                <span><Pill size={20} /></span>
                <div>
                  <h2 id="pharmacist-form-title">{editingPharmacist ? "Edit Pharmacist" : "Add Pharmacist"}</h2>
                  <p>{editingPharmacist ? "Update pharmacist account details." : "Provide the credentials the pharmacist will use to sign in."}</p>
                </div>
              </div>
              <button type="button" className="admin-pharmacists-close" onClick={() => !saving && setShowCreateForm(false)} disabled={saving} aria-label="Close pharmacist form">
                <X size={20} />
              </button>
            </header>
            <form className="admin-pharmacists-form" onSubmit={createPharmacist}>
              <div className="admin-pharmacists-form-grid">
                <label className="admin-pharmacists-field">
                  <span>Full name</span>
                  <input type="text" value={form.name} onChange={(event) => updateField("name", event.target.value)} maxLength={100} autoComplete="name" required disabled={saving} />
                </label>
                <label className="admin-pharmacists-field">
                  <span>Email</span>
                  <input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} autoComplete="email" required disabled={saving} />
                </label>
                <label className="admin-pharmacists-field">
                  <span>Mobile number</span>
                  <input type="tel" value={form.mobileNumber} onChange={(event) => updateField("mobileNumber", event.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} autoComplete="tel" required disabled={saving} />
                </label>
                <label className="admin-pharmacists-field">
                  <span>Temporary password</span>
                  <span className="admin-pharmacists-password-control">
                    <input type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => updateField("password", event.target.value)} minLength={8} autoComplete="new-password" required={!editingPharmacist} disabled={saving} placeholder={editingPharmacist ? "Leave blank to keep unchanged" : ""} />
                    <button type="button" className="admin-pharmacists-password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide temporary password" : "Show temporary password"} aria-pressed={showPassword} disabled={saving}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
                {editingPharmacist ? (
                  <div className="admin-pharmacists-field">
                    <span>Branch</span>
                    <div className="admin-pharmacists-readonly">{getBranchDisplayName(editingPharmacist, allBranches)}</div>
                    <small>Branch cannot be changed with the available user-update API.</small>
                  </div>
                ) : (
                  <label className="admin-pharmacists-field">
                    <span>Branch</span>
                    <select value={form.branchId} onChange={(event) => updateField("branchId", event.target.value)} required disabled={saving || loadingBranches || !branches.length}>
                      <option value="">{loadingBranches ? "Loading branches..." : "Select branch"}</option>
                      {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                    </select>
                  </label>
                )}
              </div>
              {branchesError ? <div className="admin-pharmacists-branch-error" role="alert">{branchesError}</div> : null}
              <div className="admin-pharmacists-actions">
                <button type="button" className="admin-pharmacists-cancel" onClick={() => { setShowCreateForm(false); setEditingPharmacist(null); }} disabled={saving}>Cancel</button>
                <button type="submit" className="admin-pharmacists-submit" disabled={saving || (!editingPharmacist && (loadingBranches || !branches.length))}>
                  <UserPlus size={17} />{saving ? (editingPharmacist ? "Saving..." : "Creating...") : (editingPharmacist ? "Save Changes" : "Create Pharmacist")}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {viewingPharmacist ? (
        <div className="admin-pharmacists-modal-overlay" onClick={() => setViewingPharmacist(null)}>
          <section className="admin-pharmacists-modal admin-pharmacists-view-modal" role="dialog" aria-modal="true" aria-labelledby="pharmacist-details-title" onClick={(event) => event.stopPropagation()}>
            <header className="admin-pharmacists-modal-header">
              <div className="admin-pharmacists-card-title">
                <span><Pill size={20} /></span>
                <div>
                  <h2 id="pharmacist-details-title">Pharmacist details</h2>
                  <p>{getPharmacistValue(viewingPharmacist, "name", "Name", "fullName", "FullName") || "Pharmacist account"}</p>
                </div>
              </div>
              <button type="button" className="admin-pharmacists-close" onClick={() => setViewingPharmacist(null)} aria-label="Close pharmacist details">
                <X size={20} />
              </button>
            </header>
            <div className="admin-pharmacists-details-grid">
              <div><span>Name</span><strong>{getPharmacistValue(viewingPharmacist, "name", "Name", "fullName", "FullName") || "-"}</strong></div>
              <div><span>Email</span><strong>{getPharmacistValue(viewingPharmacist, "email", "Email", "emailAddress", "EmailAddress") || "-"}</strong></div>
              <div><span>Mobile number</span><strong>{getPharmacistValue(viewingPharmacist, "mobileNumber", "MobileNumber", "phone", "Phone", "phoneNumber", "PhoneNumber") || "-"}</strong></div>
              <div><span>Branch</span><strong>{getBranchDisplayName(viewingPharmacist, allBranches)}</strong></div>
              <div><span>Status</span><strong>{getPharmacistValue(viewingPharmacist, "status", "Status") || (viewingPharmacist.isActive === true || viewingPharmacist.IsActive === true ? "Active" : viewingPharmacist.isActive === false || viewingPharmacist.IsActive === false ? "Inactive" : "-")}</strong></div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
