import { apiUrl } from "../config/api";

const STORAGE_KEY = "adminPermissions";

const normalize = (text = "") => String(text || "").trim().toLowerCase().replace(/[_\s-]+/g, "");

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

export const hasPermission = (permission) => {
  if (!permission) return false;
  if (String(permission).trim().toLowerCase() === "view") return true; // view is always allowed
  const perms = getStoredRolePermissions().map((p) => String(p || "").trim().toLowerCase());
  return perms.includes(String(permission || "").trim().toLowerCase());
};

export const fetchAndStoreRolePermissions = async (roleName) => {
  try {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("adminToken") ||
      localStorage.getItem("superAdminToken");

    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(apiUrl("roles"), { headers });
    if (!res.ok) {
      writeStored(null);
      return null;
    }

    const payload = await res.json().catch(() => null);
    const roles = Array.isArray(payload) ? payload : payload?.roles || payload?.data || [];
    const normalizedTarget = normalize(roleName || localStorage.getItem("adminRole") || "");

    const matched = (roles || []).find((r) => {
      const name = (r.roleName || r.name || r.Role || r.RoleName || "");
      return normalize(name) === normalizedTarget;
    });

    if (!matched) {
      writeStored(null);
      return null;
    }

    const permissions = (matched.permissions || matched.permissionNames || matched.claims || [])
      .filter(Boolean)
      .map((p) => String(p).trim());

    const record = {
      roleName: matched.roleName || matched.name || roleName,
      permissions,
      canView: matched.canView === true || permissions.map((p) => p.toLowerCase()).includes("view"),
      canCreate: matched.canCreate === true || permissions.map((p) => p.toLowerCase()).includes("create"),
      canEdit: matched.canEdit === true || permissions.map((p) => p.toLowerCase()).includes("edit"),
      canDelete: matched.canDelete === true || permissions.map((p) => p.toLowerCase()).includes("delete"),
      raw: matched,
    };

    writeStored(record);
    return record;
  } catch (e) {
    writeStored(null);
    return null;
  }
};

export default {
  fetchAndStoreRolePermissions,
  getStoredRolePermissions,
  hasPermission,
};
