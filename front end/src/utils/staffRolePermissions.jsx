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

export const getStaffRolePermissionRecord = (roleName = "") => {
  const roleKey = normalize(roleName);
  if (!roleKey) return null;

  return readRoles().find((role) =>
    normalize(role.roleName || role.name || role.id) === roleKey
  ) || null;
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
