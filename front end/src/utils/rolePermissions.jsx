export const ROLE_PERMISSIONS_STORAGE_KEY = "cmsRoleModulePermissions";

const normalizeKey = (value = "") =>
  String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

export const normalizePermissions = (permissions = []) =>
  Array.from(
    new Set(
      (Array.isArray(permissions) ? permissions : [])
        .map((permission) => String(permission || "").trim())
        .filter(Boolean)
    )
  );

const readStore = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(ROLE_PERMISSIONS_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const writeStore = (store) => {
  try {
    localStorage.setItem(ROLE_PERMISSIONS_STORAGE_KEY, JSON.stringify(store || {}));
    window.dispatchEvent(new CustomEvent("rolePermissionsUpdated"));
  } catch {
    // Permission cache is a UI convenience; backend save remains the source.
  }
};

export const permissionIdentityKeys = (user = {}) =>
  [
    user.id,
    user.userId,
    user.UserId,
    user.doctorId,
    user.DoctorId,
    user.receptionistId,
    user.ReceptionistId,
    user.nurseId,
    user.NurseId,
    user.labTechnicianId,
    user.LabTechnicianId,
    user.labId,
    user.LabId,
    user.email,
    user.Email,
    user.name,
    user.Name,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

export const saveRoleModulePermissions = (user = {}, role = "", modulePermissions = {}) => {
  const store = readStore();
  const value = {
    role,
    modulePermissions: Object.entries(modulePermissions || {}).reduce((map, [module, permissions]) => ({
      ...map,
      [module]: normalizePermissions(permissions),
    }), {}),
  };

  permissionIdentityKeys(user).forEach((key) => {
    store[key] = value;
  });
  writeStore(store);
};

export const removeRoleModulePermissions = (user = {}) => {
  const store = readStore();
  permissionIdentityKeys(user).forEach((key) => {
    delete store[key];
  });
  writeStore(store);
};

export const getRoleModulePermissions = (profile = {}) => {
  const store = readStore();
  const keys = permissionIdentityKeys(profile);
  const matched = keys.map((key) => store[key]).find(Boolean);
  return matched?.modulePermissions || {};
};

export const readRoleModulePermissionsStore = () => readStore();

export const hasModulePermission = (profile = {}, module = "", permission = "View") => {
  const modulePermissions = getRoleModulePermissions(profile);
  const matchedKey = Object.keys(modulePermissions).find((key) => normalizeKey(key) === normalizeKey(module));
  if (!matchedKey) return false;
  return normalizePermissions(modulePermissions[matchedKey]).some(
    (item) => normalizeKey(item) === normalizeKey(permission)
  );
};

export const hasAnySavedModulePermissions = (profile = {}) =>
  Object.keys(getRoleModulePermissions(profile)).length > 0;

export const getModulePermissionSet = (profile = {}, module = "") => ({
  view: hasModulePermission(profile, module, "View"),
  create: hasModulePermission(profile, module, "Create"),
  edit: hasModulePermission(profile, module, "Edit"),
  delete: hasModulePermission(profile, module, "Delete"),
});

export const canUseModulePermission = (profile = {}, module = "", permission = "View") =>
  !hasAnySavedModulePermissions(profile) || hasModulePermission(profile, module, permission);

export const filterItemsByViewPermission = (items = [], profile = {}) => {
  const modulePermissions = getRoleModulePermissions(profile);
  if (!Object.keys(modulePermissions).length) return items;

  return items
    .map((item) => {
      if (Array.isArray(item.children)) {
        const children = item.children.filter((child) => hasModulePermission(profile, child.label, "View"));
        const groupVisible = hasModulePermission(profile, item.label, "View") || children.length > 0;
        return groupVisible ? { ...item, children } : null;
      }
      return hasModulePermission(profile, item.label, "View") ? item : null;
    })
    .filter(Boolean);
};
