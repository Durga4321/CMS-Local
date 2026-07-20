import React, { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Header from "../../components/superadmin/Header";
import DataTable from "../../components/superadmin/DataTable";
import PermissionMatrix from "../../components/superadmin/PermissionMatrix";
import { apiUrl } from "../../config/api";
import { onlyAlpha, validateAlpha } from "../../utils/validation";

const STORAGE_KEY = "admin_staff_roles_permissions";
const permissionOptions = ["View", "Create", "Edit", "Delete"];
const defaultRoles = [
  {
    id: "doctor",
    name: "Doctor",
    roleName: "Doctor",
    module: "Clinical",
    status: "Active",
    permissions: ["View"],
    system: true,
  },
  {
    id: "receptionist",
    name: "Receptionist",
    roleName: "Receptionist",
    module: "Front Desk",
    status: "Active",
    permissions: ["View"],
    system: true,
  },
];

const emptyRole = {
  name: "Doctor",
  roleName: "Doctor",
  module: "General",
  status: "Active",
  permissions: ["View"],
};

const readList = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const writeList = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const parseApiList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const getStaffName = (staff = {}) =>
  staff.name ||
  staff.fullName ||
  staff.doctorName ||
  staff.receptionistName ||
  staff.userName ||
  staff.email ||
  "";

const normalizeStaff = (staff = {}, fallbackRole = "") => ({
  id: staff.id || staff.userId || staff.doctorId || staff.receptionistId || staff.email || getStaffName(staff),
  name: getStaffName(staff),
  role: staff.role || staff.roleName || staff.type || fallbackRole,
});

const normalizeRoleKey = (value = "") =>
  String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const withViewPermission = (permissions = []) =>
  Array.from(new Set(["View", ...(Array.isArray(permissions) ? permissions : [])]));

const getRoleKey = (role = {}) => role.id || role.key || role.roleName || role.name;

const mergeRoles = (storedRoles = []) => {
  const rows = new Map(defaultRoles.map((role) => [normalizeRoleKey(role.name), role]));

  storedRoles.forEach((role) => {
    const key = normalizeRoleKey(role.roleName || role.name);
    if (!key) return;
    rows.set(key, {
      ...rows.get(key),
      ...role,
      permissions: withViewPermission(role.permissions),
    });
  });

  return Array.from(rows.values());
};

function AdminRolesPermissions() {
  const [roles, setRoles] = useState([]);
  const [staff, setStaff] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyRole);
  const [editingRoleId, setEditingRoleId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const persistRoles = (nextRoles) => {
    setRoles(nextRoles);
    writeList(STORAGE_KEY, nextRoles);
  };

  useEffect(() => {
    persistRoles(mergeRoles(readList(STORAGE_KEY)));

    let active = true;
    Promise.allSettled([
      fetch(apiUrl("Doctor"), { headers: { "ngrok-skip-browser-warning": "true" } })
        .then((response) => (response.ok ? response.json() : [])),
      fetch(apiUrl("Receptionist"), { headers: { "ngrok-skip-browser-warning": "true" } })
        .then((response) => (response.ok ? response.json() : [])),
    ]).then(([doctorResult, receptionistResult]) => {
      if (!active) return;

      const doctors = doctorResult.status === "fulfilled"
        ? parseApiList(doctorResult.value).map((item) => normalizeStaff(item, "Doctor"))
        : [];
      const receptionists = receptionistResult.status === "fulfilled"
        ? parseApiList(receptionistResult.value).map((item) => normalizeStaff(item, "Receptionist"))
        : [];

      setStaff([...doctors, ...receptionists].filter((item) => item.id && item.name));
    });

    return () => {
      active = false;
    };
  }, []);

  const getAssignedStaff = (role) => {
    const roleKey = normalizeRoleKey(role.roleName || role.name);
    return staff.filter((item) => normalizeRoleKey(item.role) === roleKey);
  };

  const openCreateForm = () => {
    setEditingRoleId("");
    setForm(emptyRole);
    setError("");
    setShowForm(true);
  };

  const openEditForm = (role) => {
    setEditingRoleId(getRoleKey(role));
    setForm({
      ...emptyRole,
      ...role,
      name: role.name || role.roleName || "",
      roleName: role.roleName || role.name || "",
      permissions: withViewPermission(role.permissions),
    });
    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRoleId("");
    setForm(emptyRole);
    setError("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    const nextValue = ["name", "roleName", "module"].includes(name) ? onlyAlpha(value) : value;
    setForm((current) => ({ ...current, [name]: nextValue }));
    setError("");
  };

  const handlePermissionChange = (permission) => {
    if (permission === "View") return;
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : withViewPermission([...current.permissions, permission]),
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const roleName = form.roleName || form.name;
    const roleNameError = validateAlpha(roleName, "Role name");
    const moduleError = validateAlpha(form.module, "Module");
    if (roleNameError || moduleError) {
      setError(roleNameError || moduleError);
      return;
    }

    setSaving(true);
    const id = editingRoleId || normalizeRoleKey(roleName) || `role-${Date.now()}`;
    const nextRole = {
      ...form,
      id,
      name: roleName,
      roleName,
      permissions: withViewPermission(form.permissions),
    };
    const nextRoles = roles.some((role) => String(getRoleKey(role)) === String(id))
      ? roles.map((role) => (String(getRoleKey(role)) === String(id) ? { ...role, ...nextRole } : role))
      : [...roles, nextRole];

    persistRoles(mergeRoles(nextRoles));
    setSaving(false);
    closeForm();
  };

  const handleDelete = (role) => {
    if (role.system) {
      setError(`Cannot delete system role: ${role.name}`);
      return;
    }

    if (!window.confirm(`Delete ${role.name || "this role"}?`)) return;
    persistRoles(mergeRoles(roles.filter((item) => getRoleKey(item) !== getRoleKey(role))));
    if (editingRoleId === getRoleKey(role)) closeForm();
  };

  const handleMatrixPermissionToggle = (role, permission) => {
    if (permission === "View") return;

    const roleKey = getRoleKey(role);
    const currentPermissions = withViewPermission(role.permissions);
    const permissions = currentPermissions.includes(permission)
      ? currentPermissions.filter((item) => item !== permission)
      : withViewPermission([...currentPermissions, permission]);

    persistRoles(
      roles.map((item) =>
        getRoleKey(item) === roleKey ? { ...item, permissions } : item
      )
    );
  };

  const columns = [
      {
        key: "serial",
        label: "S.No.",
        width: "minmax(52px, 0.25fr)",
        render: (_role, index) => index + 1,
      },
      { key: "name", label: "Role", width: "minmax(120px, 0.65fr)" },
      { key: "module", label: "Module", width: "minmax(120px, 0.7fr)" },
      {
        key: "users",
        label: "Assigned Staff",
        width: "minmax(170px, 0.9fr)",
        cellClassName: "sa-table-cell--wrap",
        render: (role) => {
          const assigned = getAssignedStaff(role);
          if (!assigned.length) return "0 staff";
          return (
            <div className="sa-role-admin-list">
              <div>{`${assigned.length} ${assigned.length === 1 ? "staff" : "staff"}`}</div>
              <div className="sa-role-admin-names">
                {assigned.map((item) => (
                  <div key={item.id} className="sa-role-admin-name">
                    {item.name}
                  </div>
                ))}
              </div>
            </div>
          );
        },
      },
      {
        key: "permissions",
        label: "Permissions",
        width: "minmax(190px, 1fr)",
        render: (role) => withViewPermission(role.permissions).join(", "),
      },
      {
        key: "actions",
        label: "Actions",
        width: "minmax(100px, 0.45fr)",
        render: (role) => (
          <div className="sa-actions">
            <button className="sa-icon-btn" type="button" onClick={() => openEditForm(role)} title="Edit role">
              <Pencil size={15} />
            </button>
            <button
              className="sa-icon-btn sa-icon-btn--danger"
              type="button"
              onClick={() => handleDelete(role)}
              disabled={role.system}
              title={role.system ? "System role cannot be deleted" : "Delete role"}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ),
      },
    ];

  return (
    <>
      <Header
        title="Roles & Permissions"
        subtitle="Create roles for doctors and receptionists, then assign View, Create, Edit, and Delete permissions."
        action={
          <button className="sa-btn sa-btn-primary" type="button" onClick={openCreateForm}>
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
              <select
                name="roleName"
                value={form.roleName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                    roleName: event.target.value,
                  }))
                }
              >
                <option>Doctor</option>
                <option>Receptionist</option>
              </select>
            </div>
            <div className="sa-form-field">
              <label>Module</label>
              <input name="module" value={form.module} onChange={handleChange} placeholder="General" />
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
                      disabled={permission === "View"}
                      onChange={() => handlePermissionChange(permission)}
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
      ) : error ? (
        <div className="sa-state sa-state--error">{error}</div>
      ) : null}

      <DataTable
        columns={columns}
        rows={roles}
        emptyMessage="No staff roles found."
      />

      <div className="sa-panel" style={{ marginTop: 16 }}>
        <h3>Assign Permissions</h3>
        <p>Permission matrix for doctor and receptionist roles.</p>
        <PermissionMatrix roles={roles} onToggle={handleMatrixPermissionToggle} />
      </div>
    </>
  );
}

export default AdminRolesPermissions;
