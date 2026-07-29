import React, { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import { apiUrl } from "../../../config/api";

const PERMISSIONS = ["View", "Create", "Edit", "Delete"];
const GENERAL_MODULE = "General";
const DEFAULT_BACKEND_MODULES = ["Dashboard", "Appointments", "Patients", "Billing", "Reports", "Schedule", "Prescriptions", "Doctor", "Receptionist"];
const STAFF_ROLE_KEYS = new Set(["doctor", "receptionist"]);

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("adminToken") ||
  localStorage.getItem("receptionistToken") ||
  "";

const parseList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.modules)) return data.modules;
  return [];
};

const parseEligibleUsers = (data) => {
  const directList = parseList(data);
  if (directList.length) return directList;

  const source = data?.data && typeof data.data === "object" ? data.data : data;
  return [
    ...(Array.isArray(source?.doctors) ? source.doctors.map((user) => ({ role: "Doctor", ...user })) : []),
    ...(Array.isArray(source?.Doctors) ? source.Doctors.map((user) => ({ role: "Doctor", ...user })) : []),
    ...(Array.isArray(source?.receptionists) ? source.receptionists.map((user) => ({ role: "Receptionist", ...user })) : []),
    ...(Array.isArray(source?.Receptionists) ? source.Receptionists.map((user) => ({ role: "Receptionist", ...user })) : []),
  ];
};

const requestJson = async (path, options = {}) => {
  const token = getToken();
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      "ngrok-skip-browser-warning": "true",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const validationMessage =
      data?.errors && typeof data.errors === "object"
        ? Object.values(data.errors).flat().filter(Boolean).join(" ")
        : "";
    throw new Error(
      data?.message ||
        validationMessage ||
        data?.title ||
        (typeof data === "string" ? data : "") ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
};

const normalizeKey = (value = "") =>
  String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const normalizePermissionList = (permissions = []) =>
  Array.from(
    new Set([
      "View",
      ...(Array.isArray(permissions) ? permissions : []).flatMap((permission) => {
        if (typeof permission === "string") return permission;
        const dto = permission?.dto || permission?.Dto;
        const dtoPermissions = Array.isArray(dto?.permissions)
          ? dto.permissions
          : Array.isArray(dto?.permissionNames)
            ? dto.permissionNames
            : [];
        const flagPermissions = [
          permission?.canView || permission?.CanView || dto?.canView || dto?.CanView ? "View" : "",
          permission?.canCreate || permission?.CanCreate || dto?.canCreate || dto?.CanCreate ? "Create" : "",
          permission?.canEdit || permission?.CanEdit || dto?.canEdit || dto?.CanEdit ? "Edit" : "",
          permission?.canDelete || permission?.CanDelete || dto?.canDelete || dto?.CanDelete ? "Delete" : "",
        ].filter(Boolean);
        if (dtoPermissions.length || flagPermissions.length) {
          return [...dtoPermissions, ...flagPermissions];
        }
        return getValue(
          permission,
          ["dto", "Dto", "name", "Name", "permission", "Permission", "permissionName", "PermissionName"],
          ""
        );
      }),
    ])
  ).filter((permission) => PERMISSIONS.includes(permission));

const normalizeModuleName = (module, index) => {
  const value =
    typeof module === "string"
      ? module
      : getValue(module, ["module", "Module", "name", "Name", "moduleName", "ModuleName"], "");
  const name = String(value || "").trim();
  return name || `Module ${index + 1}`;
};

const normalizeModuleList = (modules = []) =>
  Array.from(
    new Set(
      (Array.isArray(modules) && modules.length ? modules : DEFAULT_BACKEND_MODULES)
        .map(normalizeModuleName)
        .map((module) => String(module || "").trim())
        .filter(Boolean)
    )
  );

function getValue(record = {}, keys = [], fallback = "") {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return fallback;
}

const normalizeUser = (user = {}) => {
  const role = String(getValue(user, ["role", "Role", "roleName", "RoleName", "type", "Type"], "")).trim();
  const id = String(
    getValue(user, [
      "id",
      "Id",
      "userId",
      "UserId",
      "doctorId",
      "DoctorId",
      "receptionistId",
      "ReceptionistId",
    ])
  ).trim();

  return {
    id,
    name: String(getValue(user, ["name", "Name", "fullName", "FullName", "userName", "UserName"], "")).trim(),
    email: String(getValue(user, ["email", "Email", "emailAddress", "EmailAddress"], "")).trim(),
    role,
    module: GENERAL_MODULE,
    permissions: normalizePermissionList(
      Array.isArray(user.permissions)
        ? user.permissions
        : [
            user.canView || user.CanView ? "View" : "",
            user.canCreate || user.CanCreate ? "Create" : "",
            user.canEdit || user.CanEdit ? "Edit" : "",
            user.canDelete || user.CanDelete ? "Delete" : "",
          ].filter(Boolean)
    ),
    raw: user,
  };
};

const emptyForm = {
  userId: "",
  role: "Doctor",
  module: GENERAL_MODULE,
  permissions: ["View"],
};

const emptyRoleMatrix = {
  Doctor: ["View"],
  Receptionist: ["View"],
};

const buildPermissionPayload = (
  form,
  user,
  { dtoMode = "object", backendModules = DEFAULT_BACKEND_MODULES, omitModule = false } = {}
) => {
  const permissions = normalizePermissionList(form.permissions);
  const hasPermission = (permission) => permissions.includes(permission);
  const modules = normalizeModuleList(backendModules);
  const buildPermissionItem = (module) => {
    const permissionDto = {
      moduleName: module,
      permissions,
      permissionNames: permissions,
      canView: hasPermission("View"),
      canCreate: hasPermission("Create"),
      canEdit: hasPermission("Edit"),
      canDelete: hasPermission("Delete"),
    };
    if (!omitModule) {
      permissionDto.module = module;
    }

    return {
      dto: dtoMode === "value" ? module : permissionDto,
      ...permissionDto,
    };
  };

  return {
    userId: Number(form.userId) || form.userId,
    role: form.role,
    roleName: form.role,
    module: modules[0],
    moduleName: modules[0],
    displayModule: GENERAL_MODULE,
    permissions: modules.map(buildPermissionItem),
    permissionNames: permissions,
    canView: hasPermission("View"),
    canCreate: hasPermission("Create"),
    canEdit: hasPermission("Edit"),
    canDelete: hasPermission("Delete"),
    userName: user?.name || "",
    email: user?.email || "",
  };
};

const saveUserPermissions = async (userId, form, selectedUser, backendModules) => {
  const path = `user-permissions/users/${encodeURIComponent(userId)}`;
  const modules = normalizeModuleList(backendModules);
  const payloadOptions = [
    { dtoMode: "object", backendModules: modules },
    { dtoMode: "value", backendModules: modules },
    { dtoMode: "object", backendModules: modules, omitModule: true },
    { dtoMode: "value", backendModules: modules, omitModule: true },
  ];
  let lastError = null;

  for (const payloadOption of payloadOptions) {
    try {
      return await requestJson(path, {
        method: "PUT",
        body: JSON.stringify(buildPermissionPayload(form, selectedUser, payloadOption)),
      });
    } catch (error) {
      lastError = error;
      const message = String(error.message || "").toLowerCase();
      if (
        !message.includes("dto") &&
        !message.includes("convert") &&
        !message.includes("module")
      ) {
        throw error;
      }
    }
  }

  throw lastError || new Error("Unable to save permissions.");
};

function AdminRolesPermissions() {
  const [backendModules, setBackendModules] = useState(DEFAULT_BACKEND_MODULES);
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [roleMatrix, setRoleMatrix] = useState(emptyRoleMatrix);
  const [savingRole, setSavingRole] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const eligibleUsers = useMemo(
    () => users.filter((user) => STAFF_ROLE_KEYS.has(normalizeKey(user.role))),
    [users]
  );

  const selectedUser = useMemo(
    () => eligibleUsers.find((user) => String(user.id) === String(form.userId)),
    [eligibleUsers, form.userId]
  );

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [moduleResult, userResult] = await Promise.allSettled([
        requestJson("user-permissions/modules"),
        requestJson("user-permissions/eligible-users"),
      ]);

      if (moduleResult.status === "fulfilled") {
        const nextModules = normalizeModuleList(parseList(moduleResult.value));
        if (nextModules.length) setBackendModules(nextModules);
      }

      if (userResult.status !== "fulfilled") {
        throw userResult.reason;
      }

      const nextUsers = parseEligibleUsers(userResult.value).map(normalizeUser).filter((user) => user.id);
      setUsers(nextUsers);

      const detailedAssignments = await Promise.all(
        nextUsers.map(async (user) => {
          try {
            const details = await requestJson(`user-permissions/users/${encodeURIComponent(user.id)}`);
            return normalizeUser({ ...user.raw, ...user, ...(details || {}) });
          } catch {
            return user;
          }
        })
      );

      setAssignments(detailedAssignments);
      setRoleMatrix({
        Doctor: normalizePermissionList(
          detailedAssignments
            .filter((assignment) => normalizeKey(assignment.role) === "doctor")
            .flatMap((assignment) => assignment.permissions || [])
        ),
        Receptionist: normalizePermissionList(
          detailedAssignments
            .filter((assignment) => normalizeKey(assignment.role) === "receptionist")
            .flatMap((assignment) => assignment.permissions || [])
        ),
      });
    } catch (loadError) {
      setUsers([]);
      setAssignments([]);
      setError(loadError.message || "Unable to load roles and permissions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateForm = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
      ...(field === "userId"
        ? {
            role: eligibleUsers.find((user) => String(user.id) === String(value))?.role || previous.role,
          }
        : {}),
    }));
    setError("");
    setSuccess("");
  };

  const openAdd = () => {
    const firstUser = eligibleUsers[0];
    setForm({
      ...emptyForm,
      userId: firstUser?.id || "",
      role: firstUser?.role || "Doctor",
      module: GENERAL_MODULE,
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEdit = (assignment) => {
    setForm({
      userId: assignment.id,
      role: assignment.role || "Doctor",
      module: GENERAL_MODULE,
      permissions: normalizePermissionList(assignment.permissions),
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

  const togglePermission = (permission) => {
    setForm((previous) => {
      if (permission === "View") return previous;

      const exists = previous.permissions.includes(permission);
      return {
        ...previous,
        permissions: normalizePermissionList(
          exists
            ? previous.permissions.filter((item) => item !== permission)
            : [...previous.permissions, permission]
        ),
      };
    });
  };

  const toggleRolePermission = (role, permission) => {
    if (permission === "View" || savingRole) return;

    setRoleMatrix((previous) => {
      const currentPermissions = normalizePermissionList(previous[role] || []);
      const exists = currentPermissions.includes(permission);
      return {
        ...previous,
        [role]: normalizePermissionList(
          exists
            ? currentPermissions.filter((item) => item !== permission)
            : [...currentPermissions, permission]
        ),
      };
    });
    setError("");
    setSuccess("");
  };

  const handleSaveRolePermissions = async (role) => {
    const roleUsers = eligibleUsers.filter((user) => normalizeKey(user.role) === normalizeKey(role));

    if (!roleUsers.length) {
      setError(`No ${role.toLowerCase()} users found.`);
      return;
    }

    setSavingRole(role);
    setError("");
    setSuccess("");

    try {
      const permissions = normalizePermissionList(roleMatrix[role]);
      await Promise.all(
        roleUsers.map((user) =>
          saveUserPermissions(
            user.id,
            {
              ...emptyForm,
              userId: user.id,
              role,
              module: GENERAL_MODULE,
              permissions,
            },
            user,
            backendModules
          )
        )
      );
      setSuccess(`${role} permissions assigned successfully.`);
      await loadData();
    } catch (saveError) {
      setError(saveError.message || `Unable to assign ${role.toLowerCase()} permissions.`);
    } finally {
      setSavingRole("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.userId) {
      setError("Select a doctor or receptionist.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await saveUserPermissions(form.userId, form, selectedUser, backendModules);
      setSuccess("Permissions saved successfully.");
      await loadData();
      closeForm();
    } catch (saveError) {
      setError(saveError.message || "Unable to save permissions.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (assignment) => {
    if (!assignment?.id) {
      setError("User id is missing.");
      return;
    }

    if (!window.confirm(`Remove permissions for ${assignment.name || assignment.email || "this user"}?`)) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await requestJson(`user-permissions/users/${encodeURIComponent(assignment.id)}`, {
        method: "DELETE",
      });
      setSuccess("Permissions removed successfully.");
      await loadData();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to remove permissions.");
    }
  };

  return (
    <div>
      <div className="sa-page-header">
        <div>
          <h1>Roles & Permissions</h1>
          <p>Create roles for doctors and receptionists, then assign View, Create, Edit, and Delete permissions.</p>
        </div>
        <div className="sa-page-actions">
          <button className="sa-btn sa-btn-primary" type="button" onClick={openAdd} disabled={loading || !eligibleUsers.length}>
            <Plus size={16} /> Create Role
          </button>
          <button className="sa-btn" type="button" onClick={loadData} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {success ? <div className="sa-state">{success}</div> : null}
      {error ? <div className="sa-state sa-state--error">{error}</div> : null}

      {showForm ? (
        <form className="sa-form-card" onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
          <div className="sa-modal-header">
            <div>
              <h3>{assignments.some((item) => String(item.id) === String(form.userId)) ? "Edit Role" : "Create Role"}</h3>
              <p className="sa-form-subtitle">Select a doctor or receptionist and assign general permissions.</p>
            </div>
            <button className="sa-icon-btn" type="button" onClick={closeForm} disabled={saving} aria-label="Close role form">
              <X size={18} />
            </button>
          </div>

          <div className="sa-form-grid">
            <div className="sa-form-field">
              <label>Staff</label>
              <select value={form.userId} onChange={(event) => updateForm("userId", event.target.value)}>
                <option value="">Select staff</option>
                {eligibleUsers.map((user) => (
                  <option value={user.id} key={user.id}>
                    {user.name || user.email || user.id} - {user.role || "Staff"}
                  </option>
                ))}
              </select>
            </div>

            <div className="sa-form-field">
              <label>Role</label>
              <select value={form.role} onChange={(event) => updateForm("role", event.target.value)}>
                <option value="Doctor">Doctor</option>
                <option value="Receptionist">Receptionist</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <label className="sa-form-field" style={{ gap: 10 }}>
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

          <div className="sa-page-actions" style={{ marginTop: 18 }}>
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

      <div className="sa-table">
        <div
          className="sa-table-head"
          style={{ gridTemplateColumns: "70px minmax(140px,.7fr) minmax(150px,.8fr) minmax(190px,1fr) minmax(220px,1fr) 120px" }}
        >
          <span>S.No.</span>
          <span>Role</span>
          <span>Module</span>
          <span>Assigned Staff</span>
          <span>Permissions</span>
          <span>Actions</span>
        </div>

        {loading ? <div className="sa-state">Loading roles...</div> : null}
        {!loading && assignments.length === 0 ? <div className="sa-empty">No staff permissions found.</div> : null}

        {assignments.map((assignment, index) => (
          <div
            className="sa-table-row"
            key={assignment.id || `${assignment.email}-${index}`}
            style={{ gridTemplateColumns: "70px minmax(140px,.7fr) minmax(150px,.8fr) minmax(190px,1fr) minmax(220px,1fr) 120px" }}
          >
            <span className="sa-table-cell">{index + 1}</span>
            <span className="sa-table-cell">
              <b>{assignment.role || "-"}</b>
            </span>
            <span className="sa-table-cell">{assignment.module || "-"}</span>
            <span className="sa-table-cell">
              <span className="sa-role-admin-list">
                <b>{assignment.name || assignment.email || "-"}</b>
                <span className="sa-role-admin-names">{assignment.email || assignment.id}</span>
              </span>
            </span>
            <span className="sa-table-cell">{normalizePermissionList(assignment.permissions).join(", ")}</span>
            <span className="sa-actions">
              <button className="sa-icon-btn" type="button" onClick={() => openEdit(assignment)} title="Edit permissions">
                <Pencil size={15} />
              </button>
              <button className="sa-icon-btn sa-icon-btn--danger" type="button" onClick={() => handleDelete(assignment)} title="Delete permissions">
                <Trash2 size={15} />
              </button>
            </span>
          </div>
        ))}
      </div>

      <div className="sa-form-card" style={{ marginTop: 24 }}>
        <h3>Assign Permissions</h3>
        <p className="sa-form-subtitle">Permission matrix for doctor and receptionist users.</p>
        <div className="sa-permission-matrix sa-permission-matrix--assign">
          <div className="sa-permission-head">
            <span>Role</span>
            {PERMISSIONS.map((permission) => (
              <span key={permission}>{permission}</span>
            ))}
            <span>Actions</span>
          </div>
          {["Doctor", "Receptionist"].map((role) => {
            const permissions = normalizePermissionList(roleMatrix[role]);

            return (
              <div className="sa-permission-row" key={role}>
                <span>
                  <ShieldCheck size={15} /> {role}
                </span>
                {PERMISSIONS.map((permission) => (
                  <label className="sa-checkbox" key={permission}>
                    <input
                      type="checkbox"
                      checked={permissions.includes(permission)}
                      disabled={permission === "View" || Boolean(savingRole)}
                      onChange={() => toggleRolePermission(role, permission)}
                    />
                    {permission}
                  </label>
                ))}
                <button
                  className="sa-btn sa-btn-primary"
                  type="button"
                  onClick={() => handleSaveRolePermissions(role)}
                  disabled={Boolean(savingRole) || loading}
                >
                  <Check size={16} />
                  {savingRole === role ? "Saving..." : "Assign"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default AdminRolesPermissions;
