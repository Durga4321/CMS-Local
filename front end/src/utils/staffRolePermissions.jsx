import { apiUrl } from "../config/api";

const STORAGE_KEY = "admin_staff_roles_permissions";

const normalize = (value = "") =>
  String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const readRoles = () => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const writeRoles = (roles = []) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(roles));
  } catch {}
};

const getRoleName = (role = {}) =>
  String(role.roleName || role.name || role.Role || role.RoleName || "").trim();

const getRoleBoolean = (role = {}, key) =>
  role[key] === true || role[key.charAt(0).toUpperCase() + key.slice(1)] === true;

const withViewPermission = (permissions = []) =>
  Array.from(new Set(["view", ...((Array.isArray(permissions) ? permissions : []).map((permission) => String(permission || "").trim().toLowerCase()))]));

const getRolePermissions = (role = {}) => {
  const rawPermissions = role.permissions || role.permissionNames || role.claims || [];
  const permissions = [];

  if (Array.isArray(rawPermissions)) {
    rawPermissions.forEach((permission) => {
      const value =
        typeof permission === "string"
          ? permission
          : permission?.name || permission?.permission || permission?.claimValue || permission?.value;
      if (value) permissions.push(String(value).trim());
    });
  } else if (rawPermissions && typeof rawPermissions === "object") {
    Object.entries(rawPermissions).forEach(([permission, enabled]) => {
      if (enabled === true) permissions.push(permission);
    });
  }

  ["view", "create", "edit", "delete"].forEach((permission) => {
    if (getRoleBoolean(role, `can${permission.charAt(0).toUpperCase() + permission.slice(1)}`)) {
      permissions.push(permission);
    }
  });

  return Array.from(
    new Set(
      permissions
        .map((permission) => String(permission || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
};

const mergeStoredWithRemoteRoles = (remoteRoles = []) => {
  const storedRoles = readRoles();
  const rows = new Map();

  [...remoteRoles, ...storedRoles].forEach((role) => {
    const roleKey = normalize(role.roleName || role.name || role.id);
    if (!roleKey) return;
    rows.set(roleKey, {
      roleName: role.roleName || role.name || role.id || "",
      permissions: withViewPermission(getRolePermissions(role)),
    });
  });

  return Array.from(rows.values());
};

export const getStaffRolePermissionRecord = (roleName = "") => {
  const roleKey = normalize(roleName);
  if (!roleKey) return null;

  return readRoles().find((role) =>
    normalize(role.roleName || role.name || role.id) === roleKey
  ) || null;
};

export const fetchAndStoreStaffRolePermissions = async () => {
  try {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("adminToken") ||
      localStorage.getItem("superAdminToken");

    const headers = {
      "ngrok-skip-browser-warning": "true",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const response = await fetch(apiUrl("roles"), { headers });
    if (!response.ok) {
      throw new Error("Unable to load staff role permissions from server.");
    }

    const payload = await response.json().catch(() => null);
    const roles = Array.isArray(payload)
      ? payload
      : payload?.roles || payload?.data || [];

    const normalizedRoles = (roles || [])
      .map((role) => ({
        roleName: getRoleName(role),
        permissions: getRolePermissions(role),
      }))
      .filter((role) => ["doctor", "receptionist"].includes(normalize(role.roleName)));

    const mergedRoles = mergeStoredWithRemoteRoles(normalizedRoles);
    if (mergedRoles.length > 0) {
      writeRoles(mergedRoles);
    }

    return mergedRoles;
  } catch (error) {
    return readRoles();
  }
};

export const canUseStaffRolePermission = (roleName = "", permission = "") => {
  const permissionKey = normalize(permission);
  if (permissionKey === "view") return true;

  const record = getStaffRolePermissionRecord(roleName);
  const permissions = Array.isArray(record?.permissions) ? record.permissions : [];

  return permissions.some((item) => normalize(item) === permissionKey);
};

export const getStaffPermissionDisabledTitle = (roleName = "", permission = "") =>
  canUseStaffRolePermission(roleName, permission)
    ? ""
    : `${permission} permission is disabled by Admin.`;

export const loadStaffRolePermissions = async () => {
  await fetchAndStoreStaffRolePermissions();
};
