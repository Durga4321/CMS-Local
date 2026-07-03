import React, { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Plus, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import Header from "../../../components/superadmin/Header";
import DataTable from "../../../components/superadmin/DataTable";
import SearchFilter from "../../../components/superadmin/SearchFilter";
import {
  deleteAdmin,
  deleteUser,
  fetchAdmins,
  fetchClinics,
  fetchUsers,
  saveAdmin,
  syncAdminStaffClinic,
  updateUserStatus,
} from "../superAdminApi";
import PasswordField from "../../../components/PasswordField";
import { useToast } from "../../../components/ToastProvider";
import {
  onlyAlpha,
  onlyIndianMobileValue,
  validateAlpha,
  validateGmail,
  validateMobile,
  validateStrongPassword,
} from "../../../utils/validation";

const emptyAdmin = {
  fullName: "",
  email: "",
  phone: "",
  temporaryPassword: "",
  role: "Admin",
  assignedClinicId: "",
  sendWelcomeEmail: true,
  // on create we require a temporary password; on edit the form will set resetPassword:false
  resetPassword: true,
};

const emptyAdminClinic = {
  id: "",
  name: "",
};

const getAdminClinicId = (admin, clinics = []) =>
  clinics.find((clinic) => clinic.name === admin?.assignedClinic)?.id ||
  admin?.assignedClinicId ||
  admin?.raw?.clinicId ||
  admin?.raw?.hospitalId ||
  admin?.raw?.assignedClinicId ||
  "";

const getAdminClinicName = (admin, clinics = []) =>
  admin?.assignedClinic ||
  clinics.find((clinic) => String(clinic.id) === String(getAdminClinicId(admin, clinics)))?.name ||
  "";

const getAdminKey = (admin = {}) =>
  String(admin.email || admin.id || admin.name || admin.raw?.email || admin.raw?.id || "")
    .trim()
    .toLowerCase();

const isCurrentAdmin = (admin = {}) =>
  String(admin.email || admin.raw?.adminEmail || admin.raw?.AdminEmail || "").toLowerCase() ===
  String(localStorage.getItem("adminEmail") || "").toLowerCase();

const updateCurrentAdminClinicSession = (admin, clinicId, clinicName) => {
  if (!isCurrentAdmin(admin)) return;

  localStorage.setItem("hospitalId", String(clinicId || ""));
  localStorage.setItem("hospitalName", clinicName || "");
  localStorage.setItem("clinicName", clinicName || "");
  localStorage.setItem("assignedClinic", clinicName || "");
};

const isAdminType = (value = "") => {
  const role = String(value).trim().toLowerCase();
  return role === "admin" || role === "clinic admin";
};

const getUserAdminRole = (user = {}) =>
  [user.type, user.role, user.raw?.type, user.raw?.role, user.raw?.roleName]
    .find(isAdminType) || "";

const normalizeUserAdmin = (user = {}) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone || user.mobileNumber,
  assignedClinic: user.clinic,
  assignedClinicId: user.clinicId || user.hospitalId,
  role: "Admin",
  status: user.status,
  raw: user.raw || user,
  source: "users",
});

const mergeAdmins = (adminRows = [], userRows = []) => {
  const rows = new Map();

  adminRows.forEach((admin) => {
    const key = getAdminKey(admin);
    if (!key) return;
    rows.set(key, { ...admin, source: admin.source || "admins" });
  });

  userRows
    .filter((user) => !user.isDeleted && getUserAdminRole(user))
    .map(normalizeUserAdmin)
    .forEach((admin) => {
      const key = getAdminKey(admin);
      if (!key) return;
      rows.set(key, { ...rows.get(key), ...admin });
    });

  return Array.from(rows.values());
};


function Admins() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [form, setForm] = useState(emptyAdmin);
  const [originalAdminClinic, setOriginalAdminClinic] = useState(emptyAdminClinic);
  const [editingAdminId, setEditingAdminId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const ADMIN_SECRETS_KEY = "admin_secrets";

  const readAdminSecrets = () => {
    try {
      const raw = localStorage.getItem(ADMIN_SECRETS_KEY) || "{}";
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  };

  const saveAdminSecret = (email, { temporaryPassword = "", phone = "" } = {}) => {
    if (!email) return;
    try {
      const key = String(email).trim().toLowerCase();
      const all = readAdminSecrets();
      all[key] = { temporaryPassword: String(temporaryPassword || ""), phone: String(phone || "") };
      localStorage.setItem(ADMIN_SECRETS_KEY, JSON.stringify(all));
    } catch {
      // ignore
    }
  };

  const getAdminSecret = (email) => {
    if (!email) return null;
    const key = String(email).trim().toLowerCase();
    const all = readAdminSecrets();
    return all[key] || null;
  };

  const loadAdmins = async () => {
    setLoading(true);
    setError("");

    try {
      const [adminsResult, usersResult] = await Promise.allSettled([
        fetchAdmins(),
        fetchUsers(),
      ]);
      const adminRows = adminsResult.status === "fulfilled" ? adminsResult.value : [];
      const userRows = usersResult.status === "fulfilled" ? usersResult.value : [];
      const mergedRows = mergeAdmins(adminRows, userRows);

      // Merge locally stored admin secrets (temporary password, phone) so
      // table and edit views can display phone numbers provided at creation
      const mergedWithSecrets = mergedRows.map((admin) => {
        const secret = getAdminSecret(admin.email) || {};
        return {
          ...admin,
          phone: admin.phone || admin.mobileNumber || admin.raw?.phone || admin.raw?.mobileNumber || secret.phone || "",
        };
      });

      setAdmins(mergedWithSecrets);

      if (!mergedRows.length && adminsResult.status === "rejected" && usersResult.status === "rejected") {
        setError(adminsResult.reason?.message || "Unable to load admins.");
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to load admins.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  useEffect(() => {
    const loadClinics = async () => {
      try {
        setClinics(await fetchClinics());
      } catch {
        setClinics([]);
      }
    };

    loadClinics();
  }, []);

  const openCreateForm = () => {
    setSelectedAdmin(null);
    setEditingAdminId("");
    setForm(emptyAdmin);
    setOriginalAdminClinic(emptyAdminClinic);
    setShowForm(true);
    setError("");
  };

  const openEditForm = async (admin) => {
    setSelectedAdmin(null);
    setEditingAdminId(admin.id);
    // prefer secrets stored locally (from create) when backend doesn't provide them
    const secrets = getAdminSecret(admin.email) || {};
    setForm({
      fullName: admin.name || "",
      email: admin.email || "",
        phone:
        admin.phone ||
        admin.mobileNumber ||
        admin.raw?.phone ||
        admin.raw?.mobileNumber ||
        secrets.phone ||
        "",
      temporaryPassword:
        admin.temporaryPassword ||
        admin.password ||
        admin.raw?.temporaryPassword ||
        admin.raw?.TemporaryPassword ||
        secrets.temporaryPassword ||
        "",
      role: admin.role || "Admin",
      // don't require password change by default when editing
      resetPassword: false,
      assignedClinicId: getAdminClinicId(admin, clinics) || "",
      sendWelcomeEmail: false,
    });
    setOriginalAdminClinic({
      id: getAdminClinicId(admin, clinics) || "",
      name: getAdminClinicName(admin, clinics) || "",
    });
    setShowForm(true);
    setError("");
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingAdminId("");
    setForm(emptyAdmin);
    setOriginalAdminClinic(emptyAdminClinic);
  };

  const handleChange = (event) => {
    const { checked, name, type, value } = event.target;
    let nextValue = value;

    if (["fullName", "role"].includes(name)) {
      nextValue = onlyAlpha(value);
    }

    if (name === "phone") {
      nextValue = onlyIndianMobileValue(value);
    }

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : nextValue,
    }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
    setError("");
  };

  const validateForm = () => {
    const nextErrors = {
      fullName: validateAlpha(form.fullName, "Full name"),
      email: validateGmail(form.email),
      phone: validateMobile(form.phone, "Phone"),
      temporaryPassword: !editingAdminId
        ? validateStrongPassword(form.temporaryPassword, "Temporary password")
        : form.resetPassword
        ? validateStrongPassword(form.temporaryPassword, "Temporary password")
        : "",
      role: validateAlpha(form.role, "Role"),
      assignedClinicId: form.assignedClinicId ? "" : "Assigned clinic is required.",
    };

    Object.keys(nextErrors).forEach((key) => {
      if (!nextErrors[key]) delete nextErrors[key];
    });

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleCreateAdmin = async (event) => {
    event.preventDefault();
    if (!validateForm()) {
      setError("Please fix the highlighted fields.");
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const selectedClinic = clinics.find((clinic) => String(clinic.id) === String(form.assignedClinicId));
      const clinicId = Number(form.assignedClinicId) || form.assignedClinicId;
      const previousAdmin = admins.find((admin) => String(admin.id) === String(editingAdminId));
      const previousClinicId =
        originalAdminClinic.id ||
        getAdminClinicId(previousAdmin, clinics) ||
        (isCurrentAdmin(previousAdmin) ? localStorage.getItem("hospitalId") : "");
      const previousClinicName =
        originalAdminClinic.name ||
        getAdminClinicName(previousAdmin, clinics) ||
        (isCurrentAdmin(previousAdmin) ? localStorage.getItem("clinicName") : "");
      const adminName = form.fullName.trim();
      const adminEmail = form.email.trim();
      const adminPhone = form.phone.trim();
      const clinicName = selectedClinic?.name || "";
      const temporaryPassword = form.temporaryPassword;
      await saveAdmin({
        name: adminName,
        fullName: adminName,
        phone: adminPhone,
        email: adminEmail,
        ...( !editingAdminId || form.resetPassword ? { password: temporaryPassword, temporaryPassword } : {} ),
        role: form.role,
        hospitalId: clinicId,
        sendWelcomeEmail: form.sendWelcomeEmail,
      }, editingAdminId || undefined);
      // Persist temporary password and phone locally so edit view can show them
      saveAdminSecret(adminEmail, { temporaryPassword, phone: adminPhone });
      updateCurrentAdminClinicSession(
        previousAdmin || { email: adminEmail },
        clinicId,
        clinicName
      );
      if (editingAdminId) {
        try {
          const syncResult = await syncAdminStaffClinic({
            admin: previousAdmin || {
              id: editingAdminId,
              name: adminName,
              email: adminEmail,
              assignedClinic: previousClinicName,
              assignedClinicId: previousClinicId,
            },
            previousClinicId,
            previousClinicName,
            clinicId,
            clinicName,
          });

          if (syncResult.updated) {
            toast.success(`Updated ${syncResult.updated} staff clinic assignments`);
          }
        } catch (syncError) {
          toast.error(syncError.message || "Admin updated, but staff clinic sync failed.");
        }
      }
      closeForm();
      toast.success(editingAdminId ? "Admin updated successfully" : "Admin created successfully");
      await loadAdmins();
    } catch (requestError) {
      const message = requestError.message || "Unable to create admin.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return admins.map((admin) => ({
      ...admin,
      assignedClinic: getAdminClinicName(admin, clinics),
      phone:
        admin.phone || admin.mobileNumber || admin.raw?.phone || admin.raw?.mobileNumber || "",
    })).filter((admin) => {
      const matchesSearch = [admin.name, admin.email, admin.assignedClinic, admin.phone]
        .some((value) => String(value).toLowerCase().includes(query));
      const matchesStatus = status === "All" || admin.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [admins, clinics, search, status]);

  const handleDelete = async (admin) => {
    const confirmed = window.confirm(`Delete ${admin.name || "this admin"}?`);
    if (!confirmed) return;

    setError("");

    try {
      if (admin.source === "users") {
        await deleteUser(admin.id);
      } else {
        await deleteAdmin(admin.id);
      }
      if (selectedAdmin?.id === admin.id) setSelectedAdmin(null);
      if (editingAdminId === admin.id) closeForm();
      toast.success("Admin deleted successfully");
      await loadAdmins();
    } catch (requestError) {
      const message = requestError.message || "Unable to delete admin.";
      setError(message);
      toast.error(message);
    }
  };

  const toggleAdminStatus = async (admin) => {
    const currentStatus = String(admin.status || "").trim().toLowerCase();
    const nextStatus = currentStatus === "active" ? "Inactive" : "Active";
    setError("");

    try {
      if (admin.source === "users") {
        await updateUserStatus(admin.id, nextStatus);
      } else {
        await saveAdmin({
          ...admin,
          status: nextStatus,
          Status: nextStatus,
          isActive: nextStatus === "Active",
          IsActive: nextStatus === "Active",
          active: nextStatus === "Active",
        }, admin.id);
      }

      setAdmins((currentAdmins) =>
        currentAdmins.map((item) =>
          String(item.id) === String(admin.id)
            ? { ...item, status: nextStatus }
            : item
        )
      );
      if (selectedAdmin?.id === admin.id) {
        setSelectedAdmin((current) =>
          current ? { ...current, status: nextStatus } : current
        );
      }
      await loadAdmins();
    } catch (requestError) {
      setError(requestError.message || "Unable to update admin status.");
      toast.error(requestError.message || "Unable to update admin status.");
    }
  };

  const columns = [
    {
      key: "serial",
      label: "S.No.",
      width: "minmax(60px, 0.4fr)",
      render: (_admin, index) => index + 1,
    },
    { key: "name", label: "Name" },
    { key: "email", label: "Email", width: "minmax(220px, 1.5fr)", cellClassName: "sa-table-cell--wrap" },
            { key: "assignedClinic", label: "Assigned Clinic" },
            { key: "phone", label: "Mobile Number", render: (admin) => (admin.phone || admin.raw?.phone || admin.raw?.mobileNumber || "-") },
            {
              key: "status",
              label: "Status",
              width: "minmax(90px, 0.6fr)",
              render: (admin) => (
                <span className={`sa-badge ${admin.status === "Active" ? "is-active" : "is-danger"}`}>
                  {admin.status}
                </span>
              ),
            },
    {
      key: "actions",
      label: "Actions",
      width: "minmax(155px, 1fr)",
      render: (admin) => (
        <div className="sa-actions">
          <button className="sa-icon-btn" onClick={() => setSelectedAdmin(admin)} title="View admin">
            <Eye size={15} />
          </button>
          <button className="sa-icon-btn" onClick={() => openEditForm(admin)} title="Edit admin">
            <Pencil size={15} />
          </button>
          <button
            className="sa-icon-btn"
            onClick={() => toggleAdminStatus(admin)}
            title={admin.status === "Active" ? "Deactivate admin" : "Activate admin"}
          >
            {admin.status === "Active" ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
          </button>
          <button className="sa-icon-btn" onClick={() => handleDelete(admin)} title="Delete admin">
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Header
        title="Admin Management"
        subtitle={`${rows.length} admins found`}
        action={
          <button
            className="sa-btn sa-btn-primary"
            onClick={showForm ? closeForm : openCreateForm}
          >
            <Plus size={16} />
            Create Admin
          </button>
        }
      />

      <SearchFilter
        value={search}
        onChange={setSearch}
        placeholder="Search admins by name, email, clinic, or role..."
        filters={["All", "Active", "Inactive"]}
        selectedFilter={status}
        onFilterChange={setStatus}
      />

      {showForm ? (
        <form className="sa-form-card" style={{ marginBottom: 16 }} onSubmit={handleCreateAdmin} noValidate>
          <h3>{editingAdminId ? "Edit admin" : "Create new admin"}</h3>
          <p className="sa-form-subtitle">Manage administrator access for a clinic.</p>
          {error ? <div className="sa-state sa-state--error">{error}</div> : null}
          <div className="sa-form-grid">
            <div className="sa-form-field">
              <label htmlFor="admin-full-name">Full name</label>
              <input
                id="admin-full-name"
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                className={fieldErrors.fullName ? "is-invalid" : ""}
                placeholder="Jane Smith"
                required
              />
              {fieldErrors.fullName ? (
                <span className="sa-field-error">{fieldErrors.fullName}</span>
              ) : null}
            </div>
            <div className="sa-form-field">
              <label htmlFor="admin-email">Email</label>
              <input
                id="admin-email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                className={fieldErrors.email ? "is-invalid" : ""}
                placeholder="superadmin@gmail.com"
                required
              />
              {fieldErrors.email ? (
                <span className="sa-field-error">{fieldErrors.email}</span>
              ) : null}
            </div>
            <div className="sa-form-field">
              <label htmlFor="admin-phone">Phone</label>
              <input
                id="admin-phone"
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
                <span className="sa-field-error">{fieldErrors.phone}</span>
              ) : null}
            </div>
            <div className="sa-form-field">
              <label htmlFor="admin-temporary-password">Temporary password</label>
              <PasswordField
                id="admin-temporary-password"
                name="temporaryPassword"
                value={form.temporaryPassword}
                onChange={handleChange}
                className={fieldErrors.temporaryPassword ? "is-invalid" : ""}
                placeholder="Enter temporary password"
                autoComplete="new-password"
                required={!editingAdminId || !!form.resetPassword}
                disabled={editingAdminId && !form.resetPassword}
              />
              {fieldErrors.temporaryPassword ? (
                <span className="sa-field-error">
                  {fieldErrors.temporaryPassword}
                </span>
              ) : null}
            </div>
            {editingAdminId ? (
              <label className="sa-toggle-row sa-form-field-full">
                <span>
                  <b>Reset password</b>
                  <small>Allow changing the password for this admin</small>
                </span>
                <input
                  type="checkbox"
                  name="resetPassword"
                  checked={!!form.resetPassword}
                  onChange={handleChange}
                />
              </label>
            ) : null}
            <div className="sa-form-field">
              <label htmlFor="admin-role">Role</label>
              <input
                id="admin-role"
                name="role"
                value={form.role}
                className={fieldErrors.role ? "is-invalid" : ""}
                readOnly
                required
              />
              {fieldErrors.role ? (
                <span className="sa-field-error">{fieldErrors.role}</span>
              ) : null}
            </div>
            <div className="sa-form-field sa-form-field-full">
              <label htmlFor="admin-assigned-clinic">Assigned clinic</label>
              <select
                id="admin-assigned-clinic"
                name="assignedClinicId"
                value={form.assignedClinicId}
                onChange={handleChange}
                className={fieldErrors.assignedClinicId ? "is-invalid" : ""}
                required
              >
                <option value="">Select clinic</option>
                {clinics.map((clinic) => (
                  <option key={clinic.id || clinic.name} value={clinic.id || ""}>
                    {clinic.name}
                  </option>
                ))}
              </select>
              {fieldErrors.assignedClinicId ? (
                <span className="sa-field-error">
                  {fieldErrors.assignedClinicId}
                </span>
              ) : null}
            </div>
            <label className="sa-toggle-row sa-form-field-full">
              <span>
                <b>Send welcome email</b>
                <small>With login instructions</small>
              </span>
              <input
                type="checkbox"
                name="sendWelcomeEmail"
                checked={form.sendWelcomeEmail}
                onChange={handleChange}
              />
            </label>
          </div>
          <div className="sa-page-actions" style={{ marginTop: 14 }}>
            <button type="button" className="sa-btn" onClick={closeForm}>
              Cancel
            </button>
            <button className="sa-btn sa-btn-primary" disabled={saving}>
              {saving ? "Saving..." : editingAdminId ? "Save admin" : "Create admin"}
            </button>
          </div>
        </form>
      ) : null}

      {selectedAdmin ? (
        <div className="sa-form-card" style={{ marginBottom: 16 }}>
          <Header
            title="View Admin"
            subtitle={selectedAdmin.id}
            action={
              <button className="sa-btn" onClick={() => setSelectedAdmin(null)}>
                Close
              </button>
            }
          />
          <div className="sa-form-grid">
            {["name", "email", "assignedClinic", "role", "status"].map((key) => (
              <div className="sa-form-field" key={key}>
                <label>{key === "assignedClinic" ? "Assigned Clinic" : key.replace(/^\w/, (letter) => letter.toUpperCase())}</label>
                <input value={selectedAdmin?.[key] || ""} readOnly />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={!showForm ? error : ""}
        emptyMessage="No admins match your filters."
      />
    </>
  );
}

export default Admins;
