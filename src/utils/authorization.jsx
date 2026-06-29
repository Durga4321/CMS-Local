import { apiUrl } from "../config/api";

const STORAGE_KEY = "adminPermissions";

const normalize = (text = "") => String(text || "").trim().toLowerCase().replace(/[_\s-]+/g, "");

const PERMISSION_KEYS = {
  view: "canView",
  create: "canCreate",
  edit: "canEdit",
  delete: "canDelete",
};

const readStored = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || null;
  } catch {
    return null;
  }
};

const writeStored = (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value || null));
  } catch {}
};

export const getStoredRolePermissions = () => {
  const data = readStored();
  return Array.isArray(data?.permissions) ? data.permissions : [];
};

export const getStoredRolePermissionRecord = () => readStored();

export const canUsePermission = (record, permission) => {
  if (!permission) return false;
  if (String(permission).trim().toLowerCase() === "view") return true; // view is always allowed
  const normalizedPermission = String(permission || "").trim().toLowerCase();
  const booleanKey = PERMISSION_KEYS[normalizedPermission];
  if (booleanKey && typeof record?.[booleanKey] === "boolean") {
    return record[booleanKey];
  }

  const perms = (Array.isArray(record?.permissions) ? record.permissions : [])
    .map((p) => String(p || "").trim().toLowerCase());
  return perms.includes(normalizedPermission);
};

export const hasPermission = (permission) =>
  canUsePermission(readStored(), permission);

const getCurrentPermissionRoleName = (roleName) => {
  const storedRole =
    roleName ||
    localStorage.getItem("adminRole") ||
    localStorage.getItem("userRole") ||
    "";

  return normalize(storedRole) === "superadmin" ? "Admin" : storedRole;
};

const getRoleBoolean = (role = {}, key) => {
  const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
  return role[key] === true || role[pascalKey] === true;
};

const getRolePermissions = (role = {}) => {
  const rawPermissions = role.permissions || role.permissionNames || role.claims || [];
  const permissions = [];

  if (Array.isArray(rawPermissions)) {
    rawPermissions.forEach((permission) => {
      const value =
        typeof permission === "string"
          ? permission
          : permission?.name ||
            permission?.permission ||
            permission?.claimValue ||
            permission?.value;
      if (value) permissions.push(String(value).trim());
    });
  } else if (rawPermissions && typeof rawPermissions === "object") {
    Object.entries(rawPermissions).forEach(([permission, enabled]) => {
      if (enabled === true) permissions.push(permission);
    });
  }

  Object.entries(PERMISSION_KEYS).forEach(([permission, booleanKey]) => {
    if (getRoleBoolean(role, booleanKey)) permissions.push(permission);
  });

  return Array.from(
    new Set(
      permissions
        .map((permission) => String(permission || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
};

export const fetchAndStoreRolePermissions = async (roleName) => {
  try {
    const targetRoleName = getCurrentPermissionRoleName(roleName);
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("adminToken") ||
      localStorage.getItem("superAdminToken");

    const headers = {
      "ngrok-skip-browser-warning": "true",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const res = await fetch(apiUrl("roles"), { headers });
    if (!res.ok) {
      writeStored(null);
      return null;
    }

    const payload = await res.json().catch(() => null);
    const roles = Array.isArray(payload) ? payload : payload?.roles || payload?.data || [];
    const normalizedTarget = normalize(targetRoleName);

    const matched = (roles || []).find((r) => {
      const name = (r.roleName || r.name || r.Role || r.RoleName || "");
      return normalize(name) === normalizedTarget;
    });

    if (!matched) {
      writeStored(null);
      return null;
    }

    const permissions = getRolePermissions(matched);

    const record = {
      roleName: matched.roleName || matched.name || targetRoleName,
      permissions,
      canView: getRoleBoolean(matched, "canView") || permissions.includes("view"),
      canCreate: getRoleBoolean(matched, "canCreate") || permissions.includes("create"),
      canEdit: getRoleBoolean(matched, "canEdit") || permissions.includes("edit"),
      canDelete: getRoleBoolean(matched, "canDelete") || permissions.includes("delete"),
      raw: matched,
    };

    writeStored(record);
    return record;
  } catch (e) {
    writeStored(null);
    return null;
  }
};

const authorization = {
  fetchAndStoreRolePermissions,
  canUsePermission,
  getStoredRolePermissionRecord,
  getStoredRolePermissions,
  hasPermission,
};

export default authorization;
