import React, { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, ShieldCheck, Trash2, UsersRound, X } from "lucide-react";
import {
  deleteRole,
  fetchAdmins,
  fetchRoles,
  saveRole,
} from "../superAdminApi";

const PERMISSIONS = ["View", "Create", "Edit", "Delete"];
const ADMIN_ROLE_KEYS = new Set(["admin", "clinicadmin", "superadmin"]);

const normalizeKey = (value = "") =>
  String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const isAdminControlRole = (role = {}) => {
  const roleKey = normalizeKey(role.roleName || role.name);
  const moduleKey = normalizeKey(role.module || role.moduleName);

  return (
    ADMIN_ROLE_KEYS.has(roleKey) ||
    roleKey.includes("admin") ||
    moduleKey.includes("admin")
  );
};

const emptyForm = {
  id: "",
  roleName: "Admin",
  module: "All Modules",
  users: "0",
  status: "Active",
  permissions: ["View"],
};

const normalizePermissionList = (permissions = []) =>
  Array.from(new Set(["View", ...permissions])).filter((permission) =>
    PERMISSIONS.includes(permission)
  );

function RolesPermissions() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [admins, setAdmins] = useState([]);

  const activeRoles = useMemo(
    () =>
      roles.filter(
        (role) =>
          isAdminControlRole(role) &&
          String(role.status || "").toLowerCase() !== "deleted"
      ),
    [roles]
  );

  const loadRoles = async () => {
    setLoading(true);
    setError("");

    try {
      setRoles(await fetchRoles());
      setAdmins(await fetchAdmins().catch(() => []));
    } catch (loadError) {
      setError(loadError.message || "Unable to load roles and permissions.");
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const openAdd = () => {
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEdit = (role) => {
    setForm({
      id: role.id || "",
      roleName: role.roleName || role.name || "",
      module: role.module || "",
      users: String(role.users || 0),
      status: role.status || "Active",
      permissions: normalizePermissionList(role.permissions || []),
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
    setForm(emptyForm);
  };

  const updateForm = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
    setError("");
    setSuccess("");
  };

  const togglePermission = (permission) => {
    setForm((previous) => {
      if (permission === "View") {
        return {
          ...previous,
          permissions: normalizePermissionList(previous.permissions),
        };
      }

      const exists = previous.permissions.includes(permission);
      const permissions = exists
        ? previous.permissions.filter((item) => item !== permission)
        : [...previous.permissions, permission];

      return {
        ...previous,
        permissions: normalizePermissionList(permissions),
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const roleName = form.roleName.trim();
    if (!roleName) {
      setError("Role name is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await saveRole({
        ...form,
        name: roleName,
        roleName,
        module: form.module.trim() || "Admin Management",
        targetRole: "Admin",
        appliesTo: "Admin",
        scope: "Admin",
        users: Number(form.users || 0) || 0,
        permissions: normalizePermissionList(form.permissions),
      });
      setSuccess(form.id ? "Role updated successfully." : "Role created successfully.");
      await loadRoles();
      closeForm();
    } catch (saveError) {
      setError(saveError.message || "Unable to save role.");
    } finally {
      setSaving(false);
    }
  };

  const getAssignedAdmins = (role) => {
    const roleKey = normalizeKey(role.roleName || role.name || "Admin");
    return admins.filter((admin) => normalizeKey(admin.role || "Admin") === roleKey);
  };

  const displayAdmins = (role) => getAssignedAdmins(role).slice(0, 4);
  const hiddenAdminCount = (role) => Math.max(0, getAssignedAdmins(role).length - 4);

  const matrixRole = activeRoles[0] || {
    roleName: "Admin",
    module: "General",
    permissions: ["View", "Create", "Edit", "Delete"],
  };

  const handleDelete = async (role) => {
    if (!role?.id) {
      setError("This role cannot be deleted because it does not have an id.");
      return;
    }

    const confirmed = window.confirm(`Delete role ${role.roleName || role.name}?`);
    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await deleteRole(role.id);
      setSuccess("Role deleted successfully.");
      await loadRoles();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete role.");
    }
  };

  return (
    <div>
      <div className="sa-page-header">
        <div>
          <h1>Roles & Permissions</h1>
          <p>Create roles and assign View, Create, Edit, and Delete permissions.</p>
        </div>
        <div className="sa-page-actions">
          <button className="sa-btn sa-btn-primary" type="button" onClick={openAdd}>
            <Plus size={16} /> Create Role
          </button>
        </div>
      </div>

      {success ? <div className="sa-state">{success}</div> : null}
      {error ? <div className="sa-state sa-state--error">{error}</div> : null}

      {showForm ? (
        <form className="sa-form-card sa-role-form" onSubmit={handleSubmit}>
          <div className="sa-modal-header">
            <div>
              <h3>{form.id ? "Edit Role" : "Create Role"}</h3>
            </div>
            <button className="sa-icon-btn" type="button" onClick={closeForm} disabled={saving} aria-label="Close role form">
              <X size={18} />
            </button>
          </div>

          <div className="sa-form-grid">
            <div className="sa-form-field">
              <label>Role Name</label>
              <input
                value={form.roleName}
                onChange={(event) => updateForm("roleName", event.target.value)}
                autoFocus
              />
            </div>
            <div className="sa-form-field">
              <label>Module</label>
              <input
                value={form.module}
                onChange={(event) => updateForm("module", event.target.value)}
                placeholder="General"
              />
            </div>
            <div className="sa-form-field">
              <label>Status</label>
              <select
                value={form.status}
                onChange={(event) => updateForm("status", event.target.value)}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="sa-form-section">
            <label className="sa-form-field sa-permissions-field">
              <span style={{ fontWeight: 700 }}>Permissions</span>
              <span className="sa-actions" style={{ justifyContent: "flex-end" }}>
                {PERMISSIONS.map((permission) => (
                  <label className="sa-checkbox" key={permission}>
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(permission)}
                      disabled={permission === "View"}
                      onChange={() => togglePermission(permission)}
                    />
                    {permission}
                  </label>
                ))}
              </span>
            </label>
          </div>

          <div className="sa-page-actions sa-form-actions">
            <button className="sa-btn" type="button" onClick={closeForm} disabled={saving}>
              Close
            </button>
            <button className="sa-btn sa-btn-primary" type="submit" disabled={saving}>
              <Check size={16} />
              {saving ? "Saving..." : "Save Role"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="sa-table sa-table--roles">
        <div
          className="sa-table-head"
          style={{ gridTemplateColumns: "44px minmax(130px,.7fr) minmax(120px,.65fr) minmax(170px,.9fr) minmax(230px,1fr) 88px" }}
        >
          <span>S.No.</span>
          <span>Role</span>
          <span>Module</span>
          <span>Assigned Users</span>
          <span>Permissions</span>
          <span>Actions</span>
        </div>

        {loading ? <div className="sa-state">Loading roles...</div> : null}
        {!loading && activeRoles.length === 0 ? (
          <div className="sa-empty">No admin roles found.</div>
        ) : null}

        {activeRoles.map((role, index) => (
          <div
            className="sa-table-row"
            key={role.key || role.id || `${role.roleName}-${index}`}
            style={{ gridTemplateColumns: "44px minmax(130px,.7fr) minmax(120px,.65fr) minmax(170px,.9fr) minmax(230px,1fr) 88px" }}
          >
            <span className="sa-table-cell">{index + 1}</span>
            <span className="sa-table-cell">
              <span className="sa-role-main">
                <span className="sa-role-logo">
                  <ShieldCheck size={24} />
                </span>
                <span>
                  <b>{role.roleName || role.name || "Admin"}</b>
                  <em>System Role</em>
                </span>
              </span>
            </span>
            <span className="sa-table-cell">
              <span className="sa-role-module">
                <b>{role.module || "All Modules"}</b>
                <span>Full Access</span>
              </span>
            </span>
            <span className="sa-table-cell">
              <span className="sa-role-admin-list">
                <b><UsersRound size={15} /> {getAssignedAdmins(role).length} admins</b>
                <span className="sa-role-admin-names">
                  {displayAdmins(role).map((admin) => (
                    <span className="sa-role-admin-name" key={admin.id || admin.email || admin.name}>
                      {admin.name || admin.email}
                    </span>
                  ))}
                  {hiddenAdminCount(role) ? (
                    <span className="sa-role-admin-name sa-role-admin-more">+{hiddenAdminCount(role)} more</span>
                  ) : null}
                </span>
              </span>
            </span>
            <span className="sa-table-cell">
              <span className="sa-role-permissions">
                {normalizePermissionList(role.permissions || []).map((permission) => (
                  <span key={permission}>
                    <Check size={11} />
                    {permission}
                  </span>
                ))}
              </span>
            </span>
            <span className="sa-actions">
              <button className="sa-icon-btn" type="button" onClick={() => openEdit(role)} title="Edit role">
                <Pencil size={15} />
              </button>
              <button className="sa-icon-btn sa-icon-btn--danger" type="button" onClick={() => handleDelete(role)} title="Delete role">
                <Trash2 size={15} />
              </button>
            </span>
          </div>
        ))}
      </div>

      <div className="sa-form-card sa-permission-card">
        <h3>Assign Permissions</h3>
        <p className="sa-form-subtitle">Permission matrix for the current Admin role only.</p>
        <div className="sa-permission-matrix">
          <div className="sa-permission-head">
            <span>Role</span>
            {PERMISSIONS.map((permission) => (
              <span key={permission}>{permission}</span>
            ))}
          </div>
          <div className="sa-permission-row">
            <span>{matrixRole.roleName || matrixRole.name || "Admin"}</span>
            {PERMISSIONS.map((permission) => (
              <label className="sa-checkbox" key={permission}>
                <input
                  type="checkbox"
                  checked={normalizePermissionList(matrixRole.permissions || []).includes(permission)}
                  disabled
                  readOnly
                />
                {permission}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RolesPermissions;
