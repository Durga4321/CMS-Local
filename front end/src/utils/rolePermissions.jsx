import { useEffect, useState } from "react";
import { apiUrl } from "../config/api";

const syncingKeys = new Set();
const syncedKeys = new Set();
let permissionStore = {};

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
  return permissionStore;
};

const getAuthToken = (profile = {}) => {
  const roleKey = normalizeKey(profile.roleType || profile.roleLabel || profile.role);
  const roleToken =
    roleKey.includes("doctor")
      ? localStorage.getItem("doctorToken")
      : roleKey.includes("reception")
        ? localStorage.getItem("receptionistToken")
        : roleKey.includes("nurse")
          ? localStorage.getItem("nurseToken")
          : roleKey.includes("lab")
            ? localStorage.getItem("labToken")
            : localStorage.getItem("adminToken");

  return (
    roleToken ||
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("doctorToken") ||
    localStorage.getItem("receptionistToken") ||
    localStorage.getItem("nurseToken") ||
    localStorage.getItem("labToken") ||
    ""
  );
};

const parseList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.users)) return data.users;
  const source = data?.data && typeof data.data === "object" ? data.data : data;
  const staffRows = [
    ...(Array.isArray(source?.doctors) ? source.doctors.map((user) => ({ role: "Doctor", ...user })) : []),
    ...(Array.isArray(source?.Doctors) ? source.Doctors.map((user) => ({ role: "Doctor", ...user })) : []),
    ...(Array.isArray(source?.receptionists) ? source.receptionists.map((user) => ({ role: "Receptionist", ...user })) : []),
    ...(Array.isArray(source?.Receptionists) ? source.Receptionists.map((user) => ({ role: "Receptionist", ...user })) : []),
    ...(Array.isArray(source?.nurses) ? source.nurses.map((user) => ({ role: "Nurse", ...user })) : []),
    ...(Array.isArray(source?.Nurses) ? source.Nurses.map((user) => ({ role: "Nurse", ...user })) : []),
    ...(Array.isArray(source?.labTechnicians) ? source.labTechnicians.map((user) => ({ role: "LabTechnician", ...user })) : []),
    ...(Array.isArray(source?.LabTechnicians) ? source.LabTechnicians.map((user) => ({ role: "LabTechnician", ...user })) : []),
    ...(Array.isArray(source?.labtechnicians) ? source.labtechnicians.map((user) => ({ role: "LabTechnician", ...user })) : []),
    ...(Array.isArray(source?.staff) ? source.staff : []),
    ...(Array.isArray(source?.Staff) ? source.Staff : []),
  ];
  if (staffRows.length) return staffRows;
  return [];
};

const requestPermissionsJson = async (path, profile = {}) => {
  const token = getAuthToken(profile);
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

const roleRecordOwnerId = (record = {}) =>
  String(record.adminId || record.AdminId || record.assignedAdminId || record.AssignedAdminId || record.userId || record.UserId || record.assignedUserId || record.AssignedUserId || "").trim();

const roleRecordName = (record = {}) =>
  String(record.roleName || record.RoleName || record.name || record.Name || "").trim();

const normalizePermissionRows = (permissions = []) =>
  normalizePermissions(
    (Array.isArray(permissions) ? permissions : [permissions]).flatMap((permission) => {
      if (typeof permission === "string") return permission.split(/[,|;/]+/);
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

const roleRecordMatchesProfile = (record = {}, profile = {}) => {
  const profileKeys = permissionIdentityKeys(profile).map(normalizeKey);
  const ownerId = roleRecordOwnerId(record);
  const roleName = roleRecordName(record);
  if (ownerId && profileKeys.includes(normalizeKey(ownerId))) return true;
  if (profileKeys.some((key) => roleName.endsWith(`-${key}`))) return true;
  const email = String(profile.email || profile.Email || "").trim();
  const name = String(profile.name || profile.Name || "").trim();
  const normalizedRoleName = normalizeKey(roleName);
  return Boolean(
    (email && normalizedRoleName.includes(normalizeKey(email))) ||
    (name && normalizedRoleName.includes(normalizeKey(name)))
  );
};

const extractRoleRowsPermissions = (rows = []) =>
  rows.reduce((map, row, index) => {
    const module = normalizeModuleName(row.module || row.Module || row.moduleName || row.ModuleName, index);
    const permissions = normalizePermissionRows([row]);
    if (module && permissions.length) map[module] = permissions;
    return map;
  }, {});

const extractModulePermissions = (assignment = {}) => {
  const map = {};
  const flatModule = normalizeModuleName(
    assignment.module ||
      assignment.Module ||
      assignment.moduleName ||
      assignment.ModuleName ||
      assignment.name ||
      assignment.Name,
    0
  );
  const flatPermissions = normalizePermissionRows([assignment]);
  if (flatModule && flatPermissions.length) {
    map[flatModule] = flatPermissions;
  }

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
    ...(Array.isArray(assignment.rolePermissions) ? assignment.rolePermissions : []),
    ...(Array.isArray(assignment.RolePermissions) ? assignment.RolePermissions : []),
    ...(Array.isArray(assignment.selectedModules) ? assignment.selectedModules : []),
    ...(Array.isArray(assignment.SelectedModules) ? assignment.SelectedModules : []),
    ...(Array.isArray(assignment.raw?.permissionModules) ? assignment.raw.permissionModules : []),
    ...(Array.isArray(assignment.raw?.PermissionModules) ? assignment.raw.PermissionModules : []),
    ...(Array.isArray(assignment.raw?.rolePermissions) ? assignment.raw.rolePermissions : []),
    ...(Array.isArray(assignment.raw?.RolePermissions) ? assignment.raw.RolePermissions : []),
    ...(Array.isArray(assignment.raw?.selectedModules) ? assignment.raw.selectedModules : []),
    ...(Array.isArray(assignment.raw?.SelectedModules) ? assignment.raw.SelectedModules : []),
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
  permissionStore = store && typeof store === "object" && !Array.isArray(store) ? store : {};
  window.dispatchEvent(new CustomEvent("rolePermissionsUpdated"));
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
  const profileRole = normalizeRole(profile.role || profile.roleLabel || profile.roleType);
  const matched = keys
    .map((key) => store[key])
    .find((value) => {
      if (!value) return false;
      const storedRole = normalizeRole(value.role || "");
      return !storedRole || !profileRole || normalizeKey(storedRole) === normalizeKey(profileRole);
    });
  return matched?.modulePermissions || {};
};

export const readRoleModulePermissionsStore = () => readStore();

const mergeModulePermissionMaps = (...maps) =>
  maps.reduce((merged, map) => {
    Object.entries(map || {}).forEach(([module, permissions]) => {
      const existingKey = Object.keys(merged).find((key) => normalizeKey(key) === normalizeKey(module)) || module;
      merged[existingKey] = normalizePermissions([
        ...(Array.isArray(merged[existingKey]) ? merged[existingKey] : []),
        ...(Array.isArray(permissions) ? permissions : [permissions]),
      ]);
    });
    return merged;
  }, {});

export const syncRolePermissionsFromBackend = async (profile = {}) => {
  const keys = permissionIdentityKeys(profile);
  const syncKey = keys.join("|");
  if (!syncKey || syncingKeys.has(syncKey)) return getRoleModulePermissions(profile);

  syncingKeys.add(syncKey);
  const responses = [];
  const existingModulePermissions = getRoleModulePermissions(profile);
  const collectedPermissionMaps = [existingModulePermissions].filter((map) => Object.keys(map || {}).length);
  try {
    try {
      const rolesData = await requestPermissionsJson("roles", profile);
      const roleRows = parseList(rolesData);
      const matchedRoleRows = roleRows.filter((row) => roleRecordMatchesProfile(row, profile));
      const roleModulePermissions = extractRoleRowsPermissions(matchedRoleRows);
      if (Object.keys(roleModulePermissions).length) collectedPermissionMaps.push(roleModulePermissions);
    } catch {
      // Older deployments may not expose role permissions for the current token.
    }

    try {
      responses.push(await requestPermissionsJson("user-permissions/me", profile));
    } catch {
      // Fall back to user-specific lookup for admin screens or older tokens.
    }

    const candidateIds = keys.filter((key) => /^\d+$/.test(String(key)));
    for (const id of candidateIds.slice(0, 3)) {
      try {
        responses.push(await requestPermissionsJson(`user-permissions/users/${encodeURIComponent(id)}`, profile));
        break;
      } catch {
        // Some profiles do not carry the backend integer user id.
      }
    }

    try {
      responses.push(await requestPermissionsJson("user-permissions/eligible-users", profile));
    } catch {
      // Staff tokens may not be allowed to read the eligible users list.
    }

    const assignments = responses.flatMap((data) => {
      const list = parseList(data);
      return list.length ? list : [data?.data || data].filter(Boolean);
    });
    assignments
      .filter((assignment) => assignmentMatchesProfile(assignment, profile))
      .forEach((assignment) => collectedPermissionMaps.push(extractModulePermissions(assignment)));
    if (!collectedPermissionMaps.length && assignments[0]) {
      collectedPermissionMaps.push(extractModulePermissions(assignments[0]));
    }

    const modulePermissions = mergeModulePermissionMaps(...collectedPermissionMaps);
    if (Object.keys(modulePermissions).length) {
      const safeModulePermissions =
        Object.keys(existingModulePermissions || {}).length > Object.keys(modulePermissions || {}).length
          ? existingModulePermissions
          : modulePermissions;
      saveRoleModulePermissions(profile, normalizeRole(profile.role || profile.roleLabel), safeModulePermissions);
      return safeModulePermissions;
    }
  } finally {
    syncedKeys.add(syncKey);
    syncingKeys.delete(syncKey);
  }

  return getRoleModulePermissions(profile);
};

export const hasSyncedRolePermissions = (profile = {}) => {
  const syncKey = permissionIdentityKeys(profile).join("|");
  return Boolean(syncKey && syncedKeys.has(syncKey));
};

export const useRolePermissionsSync = (profile = {}) => {
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(() => !hasSyncedRolePermissions(profile));

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (active) setVersion((value) => value + 1);
    };
    setLoading(!hasSyncedRolePermissions(profile));
    window.addEventListener("rolePermissionsUpdated", refresh);
    syncRolePermissionsFromBackend(profile)
      .then(refresh)
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      window.removeEventListener("rolePermissionsUpdated", refresh);
    };
  }, [profile?.id, profile?.userId, profile?.email, profile?.name, profile?.role]);

  return { version, loading };
};

export const hasModulePermission = (profile = {}, module = "", permission = "View") => {
  const modulePermissions = getRoleModulePermissions(profile);
  const matchedKey = Object.keys(modulePermissions).find((key) => normalizeKey(key) === normalizeKey(module));
  if (!matchedKey) return false;
  return normalizePermissions(modulePermissions[matchedKey]).some(
    (item) => normalizeKey(item) === normalizeKey(permission)
  );
};

export const hasAnyModulePermission = (profile = {}, modules = [], permission = "View") =>
  (Array.isArray(modules) ? modules : [modules]).some((module) =>
    hasModulePermission(profile, module, permission)
  );

export const hasAnySavedModulePermissions = (profile = {}) =>
  Object.keys(getRoleModulePermissions(profile)).length > 0;

export const getModulePermissionSet = (profile = {}, module = "") => ({
  view: hasAnyModulePermission(profile, module, "View"),
  create: hasAnyModulePermission(profile, module, "Create"),
  edit: hasAnyModulePermission(profile, module, "Edit"),
  delete: hasAnyModulePermission(profile, module, "Delete"),
});

export const canUseModulePermission = (profile = {}, module = "", permission = "View") =>
  !hasAnySavedModulePermissions(profile) || hasAnyModulePermission(profile, module, permission);

export const filterItemsByViewPermission = (items = [], profile = {}) => {
  const modulePermissions = getRoleModulePermissions(profile);
  if (!Object.keys(modulePermissions).length) return items;

  return items
    .map((item) => {
      const itemModules = item.modules || item.module || item.label;
      if (Array.isArray(item.children)) {
        const children = item.children.filter((child) =>
          hasAnyModulePermission(profile, child.modules || child.module || child.label, "View")
        );
        const groupVisible = hasAnyModulePermission(profile, itemModules, "View") || children.length > 0;
        return groupVisible ? { ...item, children } : null;
      }
      return hasAnyModulePermission(profile, itemModules, "View") ? item : null;
    })
    .filter(Boolean);
};
