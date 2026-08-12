import { useEffect, useState } from "react";
import { apiUrl } from "../config/api";

export const ROLE_PERMISSIONS_STORAGE_KEY = "cmsRoleModulePermissions";
const syncingKeys = new Set();

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

const getAuthToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("adminToken") ||
  localStorage.getItem("doctorToken") ||
  localStorage.getItem("receptionistToken") ||
  localStorage.getItem("nurseToken") ||
  localStorage.getItem("labToken") ||
  "";

const parseList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.users)) return data.users;
  return [];
};

const requestPermissionsJson = async (path) => {
  const token = getAuthToken();
  const response = await fetch(apiUrl(path), {
    headers: {
      "ngrok-skip-browser-warning": "true",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    throw new Error(data?.message || data?.title || `Unable to load permissions (${response.status})`);
  }
  return data;
};

const getValue = (record = {}, keys = [], fallback = "") => {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return fallback;
};

const normalizeRole = (role = "") => {
  const key = normalizeKey(role);
  if (key === "doctor") return "Doctor";
  if (key === "receptionist" || key === "reception") return "Receptionist";
  if (key === "nurse") return "Nurse";
  if (key === "labtechnician" || key === "labtech" || key === "lab" || key === "laboratory") return "LabTechnician";
  return String(role || "").trim();
};

const normalizeModuleName = (module, index = 0) => {
  const value =
    typeof module === "string"
      ? module
      : getValue(module, ["module", "Module", "name", "Name", "moduleName", "ModuleName"], "");
  return String(value || "").trim() || `Module ${index + 1}`;
};

const normalizePermissionRows = (permissions = []) =>
  normalizePermissions(
    (Array.isArray(permissions) ? permissions : []).flatMap((permission) => {
      if (typeof permission === "string") return permission;
      const dto = permission?.dto || permission?.Dto || {};
      return [
        ...(Array.isArray(permission?.permissions) ? permission.permissions : []),
        ...(Array.isArray(permission?.Permissions) ? permission.Permissions : []),
        ...(Array.isArray(permission?.permissionNames) ? permission.permissionNames : []),
        ...(Array.isArray(permission?.PermissionNames) ? permission.PermissionNames : []),
        ...(Array.isArray(dto?.permissions) ? dto.permissions : []),
        ...(Array.isArray(dto?.permissionNames) ? dto.permissionNames : []),
        permission?.canView || permission?.CanView || dto?.canView || dto?.CanView ? "View" : "",
        permission?.canCreate || permission?.CanCreate || dto?.canCreate || dto?.CanCreate ? "Create" : "",
        permission?.canEdit || permission?.CanEdit || dto?.canEdit || dto?.CanEdit ? "Edit" : "",
        permission?.canDelete || permission?.CanDelete || dto?.canDelete || dto?.CanDelete ? "Delete" : "",
        getValue(permission, ["name", "Name", "permission", "Permission", "permissionName", "PermissionName"], ""),
      ];
    })
  ).filter((permission) => ["View", "Create", "Edit", "Delete"].some((item) => normalizeKey(item) === normalizeKey(permission)));

const extractModulePermissions = (assignment = {}) => {
  const map = {};
  const direct =
    assignment.modulePermissions ||
    assignment.ModulePermissions ||
    assignment.raw?.modulePermissions ||
    assignment.raw?.ModulePermissions;
  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    Object.entries(direct).forEach(([module, permissions]) => {
      const normalized = normalizePermissionRows(permissions);
      if (module && normalized.length) map[module] = normalized;
    });
  }

  [
    ...(Array.isArray(assignment.permissionModules) ? assignment.permissionModules : []),
    ...(Array.isArray(assignment.PermissionModules) ? assignment.PermissionModules : []),
    ...(Array.isArray(assignment.raw?.permissionModules) ? assignment.raw.permissionModules : []),
    ...(Array.isArray(assignment.raw?.PermissionModules) ? assignment.raw.PermissionModules : []),
  ].forEach((permissionModule, index) => {
    const module = normalizeModuleName(permissionModule, index);
    const permissions = normalizePermissionRows(
      permissionModule.permissions ||
        permissionModule.Permissions ||
        permissionModule.permissionNames ||
        permissionModule.PermissionNames ||
        []
    );
    if (module && permissions.length) map[module] = permissions;
  });

  (Array.isArray(assignment.permissions) ? assignment.permissions : []).forEach((permission, index) => {
    if (typeof permission === "string") return;
    const dto = permission?.dto || permission?.Dto || {};
    const module = normalizeModuleName(
      permission?.moduleName || permission?.ModuleName || permission?.module || permission?.Module || dto?.moduleName || dto?.ModuleName || dto?.module || dto?.Module,
      index
    );
    const permissions = normalizePermissionRows([permission]);
    if (module && permissions.length) map[module] = permissions;
  });

  return map;
};

const assignmentMatchesProfile = (assignment = {}, profile = {}) => {
  const assignmentKeys = permissionIdentityKeys({
    id: assignment.id || assignment.Id,
    userId: assignment.userId || assignment.UserId,
    doctorId: assignment.doctorId || assignment.DoctorId,
    receptionistId: assignment.receptionistId || assignment.ReceptionistId,
    nurseId: assignment.nurseId || assignment.NurseId,
    labTechnicianId: assignment.labTechnicianId || assignment.LabTechnicianId,
    labId: assignment.labId || assignment.LabId,
    email: assignment.email || assignment.Email,
    name: assignment.name || assignment.Name || assignment.fullName || assignment.FullName,
  }).map(normalizeKey);
  const profileKeys = permissionIdentityKeys(profile).map(normalizeKey);
  return profileKeys.some((key) => assignmentKeys.includes(key));
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

export const syncRolePermissionsFromBackend = async (profile = {}) => {
  const keys = permissionIdentityKeys(profile);
  const syncKey = keys.join("|");
  if (!syncKey || syncingKeys.has(syncKey)) return getRoleModulePermissions(profile);

  syncingKeys.add(syncKey);
  try {
    const candidateIds = keys.filter((key) => /^\d+$/.test(String(key)));
    const responses = [];
    for (const id of candidateIds.slice(0, 3)) {
      try {
        responses.push(await requestPermissionsJson(`user-permissions/users/${encodeURIComponent(id)}`));
        break;
      } catch {
        // Some backends only expose permissions through eligible-users.
      }
    }

    if (!responses.length) {
      try {
        responses.push(await requestPermissionsJson("user-permissions/eligible-users"));
      } catch {
        return getRoleModulePermissions(profile);
      }
    }

    const assignments = responses.flatMap((data) => {
      const list = parseList(data);
      return list.length ? list : [data?.data || data].filter(Boolean);
    });
    const matched = assignments.find((assignment) => assignmentMatchesProfile(assignment, profile)) || assignments[0];
    const modulePermissions = extractModulePermissions(matched);
    if (Object.keys(modulePermissions).length) {
      saveRoleModulePermissions(profile, normalizeRole(profile.role || matched.role || matched.Role), modulePermissions);
      return modulePermissions;
    }
  } finally {
    syncingKeys.delete(syncKey);
  }

  return getRoleModulePermissions(profile);
};

export const useRolePermissionsSync = (profile = {}) => {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (active) setVersion((value) => value + 1);
    };
    window.addEventListener("rolePermissionsUpdated", refresh);
    syncRolePermissionsFromBackend(profile).then(refresh).catch(() => {});
    return () => {
      active = false;
      window.removeEventListener("rolePermissionsUpdated", refresh);
    };
  }, [profile?.id, profile?.userId, profile?.email, profile?.name, profile?.role]);

  return version;
};

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
