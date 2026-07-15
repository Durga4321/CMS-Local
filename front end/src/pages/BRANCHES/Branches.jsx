import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";
import "./Branches.css";
import { useToast } from "../../components/ToastProvider";
import {
  BRANCH_API_URL,
  fetchBranchesForHospital,
  getApiHeaders,
  getBranchId,
  getBranchIsActive,
  getBranchName,
  getJsonHeaders,
  getStoredHospitalId,
  parseErrorMessage,
} from "../../utils/branchApi";
import {
  onlyAddressText,
  onlyAlpha,
  onlyDigits,
  onlyIndianMobileValue,
  validateGmail,
  validateMobile,
  validateRequired,
  validateText,
} from "../../utils/validation";
import { getStoredClinicName } from "../../utils/clinicDisplay";

const getEmptyForm = (hospitalId = getStoredHospitalId()) => ({
  name: "",
  hospitalId: hospitalId ? String(hospitalId) : "",
  phone: "",
  email: "",
  address: "",
  city: "",
  district: "",
  state: "",
  country: "India",
  postalCode: "",
});

const readBranchField = (branch, ...keys) => {
  for (const key of keys) {
    const value = branch?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
};

const getBranchForm = (branch, hospitalId) => ({
  name: String(getBranchName(branch) || ""),
  hospitalId: String(readBranchField(branch, "hospitalId", "HospitalId") || hospitalId || ""),
  phone: String(readBranchField(branch, "phone", "Phone") || ""),
  email: String(readBranchField(branch, "email", "Email") || ""),
  address: String(readBranchField(branch, "address", "Address") || ""),
  city: String(readBranchField(branch, "city", "City") || ""),
  district: String(readBranchField(branch, "district", "District") || ""),
  state: String(readBranchField(branch, "state", "State") || ""),
  country: String(readBranchField(branch, "country", "Country") || "India"),
  postalCode: String(readBranchField(branch, "postalCode", "PostalCode", "pincode") || ""),
});

const buildBranchPayload = (form) => ({
  name: form.name.trim(),
  hospitalId: Number(form.hospitalId) || 0,
  phone: form.phone.trim(),
  email: form.email.trim(),
  address: form.address.trim(),
  city: form.city.trim(),
  district: form.district.trim(),
  state: form.state.trim(),
  country: form.country.trim(),
  postalCode: form.postalCode.trim(),
});

const formatBranchAddress = (branch) =>
  [
    readBranchField(branch, "address", "Address"),
    readBranchField(branch, "city", "City"),
    readBranchField(branch, "district", "District"),
    readBranchField(branch, "state", "State"),
    readBranchField(branch, "postalCode", "PostalCode"),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ") || "-";

function Branches() {
  const toast = useToast();
  const hospitalId = getStoredHospitalId();
  const clinicName = getStoredClinicName() || localStorage.getItem("hospitalName") || "Clinic";

  const [branches, setBranches] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [form, setForm] = useState(getEmptyForm(hospitalId));
  const [fieldErrors, setFieldErrors] = useState({});

  const fetchBranches = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const data = await fetchBranchesForHospital(hospitalId);
      setBranches(data);
    } catch (fetchError) {
      const message = fetchError.message || "Unable to load branches.";
      setBranches([]);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const filteredBranches = useMemo(() => {
    const value = searchText.trim().toLowerCase();
    if (!value) return branches;

    return branches.filter((branch) =>
      [
        getBranchName(branch),
        readBranchField(branch, "phone", "Phone"),
        readBranchField(branch, "email", "Email"),
        readBranchField(branch, "city", "City"),
        readBranchField(branch, "district", "District"),
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value))
    );
  }, [branches, searchText]);

  const openAddModal = () => {
    setEditingBranch(null);
    setForm(getEmptyForm(hospitalId));
    setFieldErrors({});
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const openEditModal = (branch) => {
    setEditingBranch(branch);
    setForm(getBranchForm(branch, hospitalId));
    setFieldErrors({});
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const closeModal = ({ force = false } = {}) => {
    if (saving && !force) return;

    setModalOpen(false);
    setEditingBranch(null);
    setForm(getEmptyForm(hospitalId));
    setFieldErrors({});
  };

  const updateField = (name, value) => {
    let nextValue = value;

    if (["city", "district", "state", "country"].includes(name)) {
      nextValue = onlyAlpha(value);
    }

    if (name === "phone") {
      nextValue = onlyIndianMobileValue(value);
    }

    if (name === "postalCode") {
      nextValue = onlyDigits(value).slice(0, 6);
    }

    if (name === "address") {
      nextValue = onlyAddressText(value);
    }

    setForm((previous) => ({
      ...previous,
      [name]: nextValue,
    }));

    setFieldErrors((previous) => ({
      ...previous,
      [name]: "",
      form: "",
    }));
    setError("");
    setSuccess("");
  };

  const validateForm = () => {
    const nextErrors = {
      name: validateText(form.name, "Branch name"),
      hospitalId: validateRequired(form.hospitalId, "Hospital"),
      phone: validateMobile(form.phone, "Phone"),
      email: validateGmail(form.email, "Email", { strict: false }),
      address: validateRequired(form.address, "Address"),
      city: validateText(form.city, "City"),
      district: validateText(form.district, "District"),
      state: validateText(form.state, "State"),
      country: validateText(form.country, "Country"),
      postalCode: validateRequired(form.postalCode, "Postal code"),
    };

    if (!nextErrors.postalCode && !/^\d{5,6}$/.test(form.postalCode.trim())) {
      nextErrors.postalCode = "Postal code must be 5 or 6 digits.";
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

    const branchId = getBranchId(editingBranch);
    const isEditing = Boolean(branchId);

    try {
      const response = await fetch(
        isEditing ? `${BRANCH_API_URL}/${branchId}` : BRANCH_API_URL,
        {
          method: isEditing ? "PUT" : "POST",
          headers: getJsonHeaders(),
          body: JSON.stringify(buildBranchPayload(form)),
        }
      );

      if (!response.ok) {
        throw new Error(
          await parseErrorMessage(
            response,
            isEditing ? "Unable to update branch." : "Unable to create branch."
          )
        );
      }

      const data = await response.json().catch(() => ({}));
      const message =
        data?.message ||
        (isEditing ? "Branch updated successfully" : "Branch created successfully");
      setSuccess(message);
      toast.success(message);
      await fetchBranches();
      closeModal({ force: true });
    } catch (submitError) {
      const message = submitError.message || "Unable to save branch.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const toggleBranchStatus = async (branch) => {
    const branchId = getBranchId(branch);
    if (!branchId || updatingStatusId) return;

    const nextIsActive = !getBranchIsActive(branch);
    setUpdatingStatusId(branchId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${BRANCH_API_URL}/${branchId}/status`, {
        method: "PATCH",
        headers: getApiHeaders(),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response, "Unable to update branch status."));
      }

      setBranches((previous) =>
        previous.map((item) =>
          String(getBranchId(item)) === String(branchId)
            ? {
                ...item,
                isActive: nextIsActive,
                status: nextIsActive ? "Active" : "Inactive",
              }
            : item
        )
      );
      const message = nextIsActive
        ? "Branch activated successfully"
        : "Branch disabled successfully";
      setSuccess(message);
      toast.success(message);
    } catch (statusError) {
      const message = statusError.message || "Unable to update branch status.";
      setError(message);
      toast.error(message);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  return (
    <div className="branches-page">
      <div className="branches-header">
        <div>
          <h2>Branches</h2>
          <p>
            {loading
              ? "Loading branches..."
              : `${filteredBranches.length} branch records for ${clinicName}`}
          </p>
        </div>

        <div className="branches-header-actions">
          <button
            type="button"
            className="branches-icon-button"
            onClick={fetchBranches}
            disabled={loading || saving}
            title="Refresh branches"
          >
            <RefreshCw size={16} />
          </button>
          <button
            type="button"
            className="branches-primary-button"
            onClick={openAddModal}
            disabled={saving}
            title="Add branch"
          >
            <Plus size={16} />
            Add Branch
          </button>
        </div>
      </div>

      <div className="branches-clinic-band">
        <Building2 size={17} />
        <span>Hospital ID</span>
        <b>{hospitalId || "-"}</b>
        <span>Clinic</span>
        <b>{clinicName}</b>
      </div>

      <div className="branches-toolbar">
        <div className="branches-search">
          <Search size={16} />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search branch, city, email, phone..."
          />
        </div>
      </div>

      {success ? <div className="branches-success">{success}</div> : null}
      {error ? <div className="branches-error">{error}</div> : null}

      <div className="branches-table">
        <div className="branches-thead">
          <span>S.No.</span>
          <span>Branch</span>
          <span>Contact</span>
          <span>Location</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {!loading && filteredBranches.length === 0 ? (
          <div className="branches-empty">No branches found.</div>
        ) : null}

        {filteredBranches.map((branch, index) => {
          const branchId = getBranchId(branch);
          const isActive = getBranchIsActive(branch);
          const isUpdating = String(updatingStatusId) === String(branchId);

          return (
            <div className="branches-row" key={branchId || `${getBranchName(branch)}-${index}`}>
              <span>{index + 1}</span>
              <div className="branches-name-cell">
                <div className="branches-avatar">
                  <MapPin size={17} />
                </div>
                <div>
                  <b>{getBranchName(branch) || "-"}</b>
                  <span>ID: {branchId || "-"}</span>
                </div>
              </div>
              <div className="branches-cell">
                <b>{readBranchField(branch, "phone", "Phone") || "-"}</b>
                <span>{readBranchField(branch, "email", "Email") || "-"}</span>
              </div>
              <span className="branches-cell">{formatBranchAddress(branch)}</span>
              <span className="branches-cell">
                <span
                  className={`branches-status ${
                    isActive ? "branches-status-active" : "branches-status-inactive"
                  }`}
                >
                  {isUpdating ? "Updating..." : isActive ? "Active" : "Inactive"}
                </span>
              </span>
              <div className="branches-actions">
                <button
                  type="button"
                  className="branches-action-button"
                  onClick={() => openEditModal(branch)}
                  disabled={saving || isUpdating}
                  title="Edit branch"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="branches-action-button"
                  onClick={() => toggleBranchStatus(branch)}
                  disabled={saving || isUpdating}
                  title={isActive ? "Disable branch" : "Activate branch"}
                >
                  {isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen ? (
        <div className="branches-modal-overlay" onClick={() => closeModal()}>
          <div className="branches-modal" onClick={(event) => event.stopPropagation()}>
            <div className="branches-modal-header">
              <div className="branches-modal-title">
                <div className="branches-modal-icon">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3>{editingBranch ? "Edit Branch" : "Add Branch"}</h3>
                  <p>{clinicName}</p>
                </div>
              </div>
              <button
                type="button"
                className="branches-modal-close"
                onClick={() => closeModal()}
                disabled={saving}
                aria-label="Close branch form"
              >
                <X size={20} />
              </button>
            </div>

            <form className="branches-form" onSubmit={handleSubmit} noValidate>
              <div className="branches-field">
                <label htmlFor="branch-name">Branch Name</label>
                <input
                  id="branch-name"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  className={fieldErrors.name ? "is-invalid" : ""}
                  disabled={saving}
                  autoFocus
                />
                {fieldErrors.name ? (
                  <span className="branches-field-error">{fieldErrors.name}</span>
                ) : null}
              </div>

              <div className="branches-field">
                <label htmlFor="branch-hospital">Hospital ID</label>
                <input
                  id="branch-hospital"
                  value={form.hospitalId}
                  onChange={(event) => updateField("hospitalId", onlyDigits(event.target.value))}
                  className={fieldErrors.hospitalId ? "is-invalid" : ""}
                  disabled={saving}
                  inputMode="numeric"
                />
                {fieldErrors.hospitalId ? (
                  <span className="branches-field-error">{fieldErrors.hospitalId}</span>
                ) : null}
              </div>

              <div className="branches-field">
                <label htmlFor="branch-phone">Phone</label>
                <input
                  id="branch-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  className={fieldErrors.phone ? "is-invalid" : ""}
                  disabled={saving}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit Indian mobile number"
                />
                {fieldErrors.phone ? (
                  <span className="branches-field-error">{fieldErrors.phone}</span>
                ) : null}
              </div>

              <div className="branches-field">
                <label htmlFor="branch-email">Email</label>
                <input
                  id="branch-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  className={fieldErrors.email ? "is-invalid" : ""}
                  disabled={saving}
                />
                {fieldErrors.email ? (
                  <span className="branches-field-error">{fieldErrors.email}</span>
                ) : null}
              </div>

              <div className="branches-field branches-field-full">
                <label htmlFor="branch-address">Address</label>
                <input
                  id="branch-address"
                  value={form.address}
                  onChange={(event) => updateField("address", event.target.value)}
                  className={fieldErrors.address ? "is-invalid" : ""}
                  disabled={saving}
                />
                {fieldErrors.address ? (
                  <span className="branches-field-error">{fieldErrors.address}</span>
                ) : null}
              </div>

              <div className="branches-field">
                <label htmlFor="branch-city">City</label>
                <input
                  id="branch-city"
                  value={form.city}
                  onChange={(event) => updateField("city", event.target.value)}
                  className={fieldErrors.city ? "is-invalid" : ""}
                  disabled={saving}
                />
                {fieldErrors.city ? (
                  <span className="branches-field-error">{fieldErrors.city}</span>
                ) : null}
              </div>

              <div className="branches-field">
                <label htmlFor="branch-district">District</label>
                <input
                  id="branch-district"
                  value={form.district}
                  onChange={(event) => updateField("district", event.target.value)}
                  className={fieldErrors.district ? "is-invalid" : ""}
                  disabled={saving}
                />
                {fieldErrors.district ? (
                  <span className="branches-field-error">{fieldErrors.district}</span>
                ) : null}
              </div>

              <div className="branches-field">
                <label htmlFor="branch-state">State</label>
                <input
                  id="branch-state"
                  value={form.state}
                  onChange={(event) => updateField("state", event.target.value)}
                  className={fieldErrors.state ? "is-invalid" : ""}
                  disabled={saving}
                />
                {fieldErrors.state ? (
                  <span className="branches-field-error">{fieldErrors.state}</span>
                ) : null}
              </div>

              <div className="branches-field">
                <label htmlFor="branch-country">Country</label>
                <input
                  id="branch-country"
                  value={form.country}
                  onChange={(event) => updateField("country", event.target.value)}
                  className={fieldErrors.country ? "is-invalid" : ""}
                  disabled={saving}
                />
                {fieldErrors.country ? (
                  <span className="branches-field-error">{fieldErrors.country}</span>
                ) : null}
              </div>

              <div className="branches-field">
                <label htmlFor="branch-postal">Postal Code</label>
                <input
                  id="branch-postal"
                  value={form.postalCode}
                  onChange={(event) => updateField("postalCode", event.target.value)}
                  className={fieldErrors.postalCode ? "is-invalid" : ""}
                  disabled={saving}
                  inputMode="numeric"
                  maxLength={6}
                />
                {fieldErrors.postalCode ? (
                  <span className="branches-field-error">{fieldErrors.postalCode}</span>
                ) : null}
              </div>

              {fieldErrors.form ? (
                <div className="branches-error branches-form-message">
                  {fieldErrors.form}
                </div>
              ) : null}

              <div className="branches-modal-actions">
                <button
                  type="button"
                  className="branches-secondary-button"
                  onClick={() => closeModal()}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="branches-save-button" disabled={saving}>
                  <CheckCircle size={16} />
                  {saving ? "Saving..." : editingBranch ? "Update Branch" : "Create Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Branches;
