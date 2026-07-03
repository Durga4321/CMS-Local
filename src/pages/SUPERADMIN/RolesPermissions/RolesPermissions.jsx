import React, { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Header from "../../../components/superadmin/Header";
import DataTable from "../../../components/superadmin/DataTable";
import PermissionMatrix from "../../../components/superadmin/PermissionMatrix";
import {
  deleteRole,
  fetchAdmins,
  fetchRole,
  fetchRoles,
  fetchUsers,
  saveRole,
  updateRolePermissions,
} from "../superAdminApi";
import { onlyAlpha, validateAlpha } from "../../../utils/validation";

const permissionOptions = ["View", "Create", "Edit", "Delete"];
const DEFAULT_SYSTEM_ROLES = ["Admin", "Doctor", "Patient", "Receptionist"];
const withViewPermission = (permissions = []) =>
  Array.from(new Set(["View", ...(Array.isArray(permissions) ? permissions : [])]));

const isDefaultRole = (role = {}) => {
  const roleName = String(role.name || role.roleName || "").toLowerCase();
  return DEFAULT_SYSTEM_ROLES.some(r => r.toLowerCase() === roleName);
};

const emptyRole = {
  name: "Admin",
  roleName: "Admin",
  module: "General",
  status: "Active",
  permissions: ["View"],
};

const getRoleKey = (role = {}) => role.id || role.key || role.roleName || role.name;

const isAdminRole = (role = {}) =>
  String(role.roleName || role.name || "").trim().toLowerCase() === "admin";

function RolesPermissions() {
  const [showForm, setShowForm] = useState(false);
  const [roles, setRoles] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState(emptyRole);
  const [editingRoleId, setEditingRoleId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingPermission, setUpdatingPermission] = useState("");
  const [error, setError] = useState("");

  const getAdminRowKey = (admin = {}) =>
    String(admin.email || admin.id || admin.name || admin.raw?.email || admin.raw?.id || "")
      .trim()
      .toLowerCase();

  const mergeAdminRows = useCallback((adminRows = [], userRows = []) => {
    const rows = new Map();

    adminRows.forEach((admin) => {
      const key = getAdminRowKey(admin);
      if (!key) return;
      rows.set(key, { ...admin, source: admin.source || "admins" });
    });

    userRows
      .filter((user) => {
        const role = String(user.role || user.type || "").trim().toLowerCase();
        return role === "admin" || role === "clinicadmin" || role === "clinic admin";
      })
      .map((user) => ({
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
      }))
      .forEach((admin) => {
        const key = getAdminRowKey(admin);
        if (!key) return;
        rows.set(key, { ...rows.get(key), ...admin });
      });

    return Array.from(rows.values());
  }, []);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    setError("");

    const [rolesResult, adminsResult, usersResult] = await Promise.allSettled([
      fetchRoles(),
      fetchAdmins(),
      fetchUsers(),
    ]);

    if (rolesResult.status === "fulfilled") {
      const loadedRoles = rolesResult.value;
      setRoles(loadedRoles);
    } else {
      setRoles([]);
      setError(rolesResult.reason?.message || "Unable to load roles.");
    }

    const adminRows = adminsResult.status === "fulfilled" ? adminsResult.value : [];
    const userRows = usersResult.status === "fulfilled" ? usersResult.value : [];
    setAdmins(mergeAdminRows(adminRows, userRows));

    setLoading(false);
  }, [mergeAdminRows]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const openCreateForm = () => {
    setEditingRoleId("");
    setForm(emptyRole);
    setShowForm(true);
    setError("");
  };

  const visibleRoles = roles.filter(isAdminRole);

  const getRoleAdminNames = (role) => {
    const roleName = String(role.roleName || role.name || "").trim().toLowerCase();
    return admins
      .filter((admin) => String(admin.role || "").trim().toLowerCase() === roleName)
      .map((admin) => admin.name)
      .filter(Boolean);
  };

  const getRoleUserCount = (role) => {
    const adminNames = getRoleAdminNames(role);
    if (adminNames.length > 0) return adminNames.length;
    return role.users || 0;
  };

  const openEditForm = async (role) => {
    setEditingRoleId(role.id);
    setForm({
      ...emptyRole,
      ...role,
      name: role.name || role.roleName || "",
      roleName: role.roleName || role.name || "",
      module: role.module || "General",
      permissions: withViewPermission(role.permissions),
    });
    setShowForm(true);
    setError("");

    try {
      const remoteRole = await fetchRole(role.id);
      setForm({
        ...emptyRole,
        ...remoteRole,
        name: remoteRole.name || remoteRole.roleName || "",
        roleName: remoteRole.roleName || remoteRole.name || "",
        module: remoteRole.module || "General",
        permissions: withViewPermission(remoteRole.permissions),
      });
    } catch {
      setForm({
        ...emptyRole,
        ...role,
        name: role.name || role.roleName || "",
        roleName: role.roleName || role.name || "",
        module: role.module || "General",
        permissions: withViewPermission(role.permissions),
      });
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRoleId("");
    setForm(emptyRole);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    const nextValue = ["name", "roleName", "module"].includes(name)
      ? onlyAlpha(value)
      : value;
    setForm((current) => ({ ...current, [name]: nextValue }));
  };

  const handlePermissionChange = (permission) => {
    if (permission === "View") return;

    setForm((current) => {
      const permissions = current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission];

      return { ...current, permissions: withViewPermission(permissions) };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const roleNameError = validateAlpha(form.roleName || form.name, "Role name");
    if (roleNameError) {
      setError(roleNameError);
      return;
    }

    const moduleError = validateAlpha(form.module, "Module");
    if (moduleError) {
      setError(moduleError);
      return;
    }

    setSaving(true);
    setError("");

    try {
      await saveRole(
        {
          ...form,
          roleName: form.roleName || form.name,
          name: form.name || form.roleName,
          permissions: withViewPermission(form.permissions),
        },
        editingRoleId || undefined
      );
      closeForm();
      await loadRoles();
    } catch (requestError) {
      setError(requestError.message || "Unable to save role.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role) => {
    if (isDefaultRole(role)) {
      setError(`Cannot delete system-defined role: ${role.name}`);
      return;
    }

    const confirmed = window.confirm(`Delete ${role.name || "this role"}?`);
    if (!confirmed) return;

    setError("");

    try {
      await deleteRole(role.id);
      if (editingRoleId === role.id) closeForm();
      await loadRoles();
    } catch (requestError) {
      setError(requestError.message || "Unable to delete role.");
    }
  };

  const handleMatrixPermissionToggle = async (role, permission) => {
    if (permission === "View") return;

    const roleKey = getRoleKey(role);
    if (!roleKey) return;

    const currentPermissions = withViewPermission(role.permissions);
    const nextPermissions = withViewPermission(
      currentPermissions.includes(permission)
        ? currentPermissions.filter((item) => item !== permission)
        : [...currentPermissions, permission]
    );
    const updateKey = `${roleKey}:${permission}`;

    setUpdatingPermission(updateKey);
    setError("");
    setRoles((currentRoles) =>
      currentRoles.map((item) =>
        getRoleKey(item) === roleKey ? { ...item, permissions: nextPermissions } : item
      )
    );
    if (role.canPersistPermissions === false || !role.id) {
      setUpdatingPermission("");
      setError("Backend role id is unavailable, so permissions cannot sync to other systems.");
      return;
    }

    try {
      await updateRolePermissions(role.id, {
        ...role,
        permissions: nextPermissions,
      });
      await loadRoles();
    } catch (requestError) {
      setError(requestError.message || "Unable to update permissions.");
      setRoles((currentRoles) =>
        currentRoles.map((item) =>
          getRoleKey(item) === roleKey ? { ...item, permissions: nextPermissions } : item
        )
      );
    } finally {
      setUpdatingPermission("");
    }
  };

  const columns = [
    {
      key: "serial",
      label: "S.No.",
      width: "minmax(60px, 0.4fr)",
      render: (_role, index) => index + 1,
    },
    { key: "name", label: "Role" },
    { key: "module", label: "Module" },
    {
      key: "users",
      label: "Assigned Users",
      width: "minmax(140px, 1fr)",
      cellClassName: "sa-table-cell--wrap",
      render: (role) => {
        const adminNames = getRoleAdminNames(role);
        const userCount = getRoleUserCount(role);
        if (adminNames.length > 0) {
          return (
            <div className="sa-role-admin-list">
              <div>{`${adminNames.length} admin${adminNames.length !== 1 ? "s" : ""}`}</div>
              <div className="sa-role-admin-names">
                {adminNames.map((name) => (
                  <div key={name} className="sa-role-admin-name">
                    {name}
                  </div>
                ))}
              </div>
            </div>
          );
        }
        return userCount === 0 ? "0 admins" : `${userCount} admin${userCount !== 1 ? "s" : ""}`;
      },
    },
    {
      key: "permissions",
      label: "Permissions",
      width: "minmax(220px, 1.3fr)",
      render: (role) => {
        const perms = Array.isArray(role.permissions) && role.permissions.length > 0
          ? role.permissions.join(", ")
          : "View";
        return perms;
      },
    },
    {
      key: "actions",
      label: "Actions",
      width: "minmax(112px, 0.7fr)",
      render: (role) => {
        const canUseRemoteActions = role.canPersistPermissions !== false && role.id;
        const isSystemRole = isDefaultRole(role);
        const canDelete = canUseRemoteActions && !isSystemRole;

        return (
          <div className="sa-actions">
            <button
              className="sa-icon-btn"
              disabled={!canUseRemoteActions}
              onClick={() => openEditForm(role)}
              title={canUseRemoteActions ? "Edit role" : "Backend id unavailable"}
            >
              <Pencil size={15} />
            </button>
            <button
              className="sa-icon-btn"
              disabled={!canDelete}
              onClick={() => handleDelete(role)}
              title={isSystemRole ? "Cannot delete system-defined role" : canUseRemoteActions ? "Delete role" : "Backend id unavailable"}
            >
              <Trash2 size={15} />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <Header
        title="Roles & Permissions"
        subtitle="Create roles and assign View, Create, Edit, and Delete permissions."
        action={
          <button className="sa-btn sa-btn-primary" onClick={openCreateForm}>
            <Plus size={16} />
            Create Role
          </button>
        }
      />

      {showForm ? (
        <form className="sa-form-card" style={{ marginBottom: 16 }} onSubmit={handleSubmit} noValidate>
          <h3>{editingRoleId ? "Edit Role" : "Create Role"}</h3>
          {error ? <div className="sa-state sa-state--error">{error}</div> : null}
          <div className="sa-form-grid">
            <div className="sa-form-field">
              <label>Role Name</label>
              <input
                name="roleName"
                value={form.roleName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                    roleName: event.target.value,
                  }))
                }
                placeholder="Admin"
                required
                disabled
              />
            </div>
            <div className="sa-form-field">
              <label>Module</label>
              <input
                name="module"
                value={form.module}
                onChange={handleChange}
                placeholder="Enter module name"
                required
              />
            </div>
            <div className="sa-form-field">
              <label>Status</label>
              <select name="status" value={form.status} onChange={handleChange}>
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>
            <div className="sa-form-field sa-form-field-full">
              <label>Permissions</label>
              <div className="sa-page-actions">
                {permissionOptions.map((permission) => (
                  <label className="sa-checkbox" key={permission}>
                    <input
                      type="checkbox"
                      checked={permission === "View" || form.permissions.includes(permission)}
                      onChange={() => handlePermissionChange(permission)}
                      disabled={permission === "View"}
                    />
                    <span>{permission}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="sa-page-actions" style={{ marginTop: 14 }}>
            <button type="button" className="sa-btn" onClick={closeForm}>Close</button>
            <button className="sa-btn sa-btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Role"}
            </button>
          </div>
        </form>
      ) : null}

      <DataTable
        columns={columns}
        rows={visibleRoles}
        loading={loading}
        error={!showForm ? error : ""}
        emptyMessage="No roles found."
      />

      <div className="sa-panel" style={{ marginTop: 16 }}>
        <h3>Assign Permissions</h3>
        <p>Permission matrix for the current Admin role only.</p>
        <PermissionMatrix
          roles={visibleRoles}
          onToggle={handleMatrixPermissionToggle}
          updatingKey={updatingPermission}
        />
      </div>
    </>
  );
}

export default RolesPermissions;
