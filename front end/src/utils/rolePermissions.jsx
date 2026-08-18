import { useEffect, useState } from "react";
import { apiUrl } from "../config/api";
import { getRoleProfile } from "../profile/sessionProfile";

const syncingKeys = new Set();
const syncedKeys = new Set();
let permissionStore = {};
const PERMISSION_CACHE_KEY = "cms_role_permissions_cache";

const getSessionValue = (key) =>
  sessionStorage.getItem(key) || localStorage.getItem(key) || "";

const normalizeKey = (value = "") =>
  String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const MODULE_ALIASES = {
  appointments: ["appointment", "bookappointment", "appointments"],
};

const getModuleLookupKeys = (module = "") => {
  const key = normalizeKey(module);
  return Array.from(new Set([key, ...(MODULE_ALIASES[key] || [])])).filter(Boolean);
};

export const normalizePermissions = (permissions = []) =>
  Array.from(
    new Set(
      (Array.isArray(permissions) ? permissions : [])
        .map((permission) => String(permission || "").trim())
        .filter(Boolean)
    )
  );

const readCache = () => {
  try {
    const localCache = JSON.parse(localStorage.getItem(PERMISSION_CACHE_KEY) || "{}");
    const sessionCache = JSON.parse(sessionStorage.getItem(PERMISSION_CACHE_KEY) || "{}");
    return {
      ...(localCache && typeof localCache === "object" && !Array.isArray(localCache) ? localCache : {}),
      ...(sessionCache && typeof sessionCache === "object" && !Array.isArray(sessionCache) ? sessionCache : {}),
    };
  } catch {
    try {
      return JSON.parse(localStorage.getItem(PERMISSION_CACHE_KEY) || "{}");
    } catch {
      return {};
    }
  }
};

const writeCache = (store) => {
  try {
    const value = JSON.stringify(store || {});
    localStorage.setItem(PERMISSION_CACHE_KEY, value);
    sessionStorage.setItem(PERMISSION_CACHE_KEY, value);
  } catch {
    // Storage can fail in restricted browser modes; in-memory store still works.
  }
};

const readStore = () => {
  if (Object.keys(permissionStore).length) return permissionStore;
  permissionStore = readCache();
  return permissionStore;
};

const getAuthToken = (profile = {}) => {
  const roleKey = normalizeKey(profile.roleType || profile.roleLabel || profile.role);
  const roleToken =
    roleKey.includes("doctor")
      ? getSessionValue("doctorToken")
      : roleKey.includes("reception")
        ? getSessionValue("receptionistToken")
        : roleKey.includes("nurse")
          ? getSessionValue("nurseToken")
          : roleKey.includes("lab")
            ? getSessionValue("labToken")
            : getSessionValue("adminToken");

  return (
    roleToken ||
    getSessionValue("token") ||
    getSessionValue("adminToken") ||
    getSessionValue("doctorToken") ||
    getSessionValue("receptionistToken") ||
    getSessionValue("nurseToken") ||
    getSessionValue("labToken") ||
    ""
  );
};

const parseList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.roles)) return data.roles;
  if (Array.isArray(data?.Roles)) return data.Roles;
  if (Array.isArray(data?.permissions)) return data.permissions;
  if (Array.isArray(data?.Permissions)) return data.Permissions;
  if (Array.isArray(data?.modulePermissions)) return data.modulePermissions;
  if (Array.isArray(data?.ModulePermissions)) return data.ModulePermissions;
  const source = data?.data && typeof data.data === "object" ? data.data : data;
  if (Array.isArray(source?.roles)) return source.roles;
  if (Array.isArray(source?.Roles)) return source.Roles;
  if (Array.isArray(source?.permissions)) return source.permissions;
  if (Array.isArray(source?.Permissions)) return source.Permissions;
  if (Array.isArray(source?.modulePermissions)) return source.modulePermissions;
  if (Array.isArray(source?.ModulePermissions)) return source.ModulePermissions;
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

const hasExplicitPermissionFields = (record = {}) =>
  [
    "canView",
    "CanView",
    "canCreate",
    "CanCreate",
    "canEdit",
    "CanEdit",
    "canDelete",
    "CanDelete",
  ].some((key) => Object.prototype.hasOwnProperty.call(record || {}, key));

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

const isAdminPermissionProfile = (profile = {}) => {
  const role = normalizeKey(profile.role || profile.roleLabel || profile.roleType);
  return role.includes("admin") || role.includes("superadmin");
};

const isSuperAdminPermissionProfile = (profile = {}) => {
  const role = normalizeKey(profile.role || profile.roleLabel || profile.roleType);
  const path = String(window.location?.pathname || "").toLowerCase();
  return role.includes("superadmin") || path.startsWith("/superadmin");
};

const isAdminAppPath = () => {
  const path = String(window.location?.pathname || "").toLowerCase();
  return Boolean(
    path &&
      !path.startsWith("/superadmin") &&
      !path.startsWith("/doctor") &&
      !path.startsWith("/reception") &&
      !path.startsWith("/nurse") &&
      !path.startsWith("/lab") &&
      !path.startsWith("/patient")
  );
};

const shouldSkipAdminPermissionSync = (profile = {}) =>
  !isSuperAdminPermissionProfile(profile) && !isAdminPermissionProfile(profile) && isAdminAppPath();

const normalizeModuleName = (module, index = 0) => {
  const value =
    typeof module === "string"
      ? module
      : getValue(module, ["module", "Module", "name", "Name", "moduleName", "ModuleName"], "");
  return String(value || "").trim() || `Module ${index + 1}`;
};

const roleRecordOwnerId = (record = {}) =>
  String(
    record.adminUserId ||
      record.AdminUserId ||
      record.adminUserID ||
      record.AdminUserID ||
      record.adminId ||
      record.AdminId ||
      record.assignedAdminId ||
      record.AssignedAdminId ||
      record.userId ||
      record.UserId ||
      record.id ||
      record.Id ||
      record.assignedUserId ||
      record.AssignedUserId ||
      ""
  ).trim();

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

const resolveAdminPermissionProfile = async (profile = {}) => {
  if (!isAdminPermissionProfile(profile) || isSuperAdminPermissionProfile(profile)) return profile;

  const resolvedAdminUserId =
    profile.adminUserId ||
    profile.AdminUserId ||
    profile.adminId ||
    profile.AdminId ||
    profile.userId ||
    profile.UserId ||
    profile.id ||
    profile.Id ||
    getSessionValue("adminUserId") ||
    getSessionValue("adminId") ||
    getSessionValue("userId");

  if (!resolvedAdminUserId) return profile;

  sessionStorage.setItem("adminUserId", String(resolvedAdminUserId));
  sessionStorage.setItem("adminId", String(resolvedAdminUserId));
  sessionStorage.setItem("userId", String(resolvedAdminUserId));

  return {
    ...profile,
    id: resolvedAdminUserId,
    adminUserId: resolvedAdminUserId,
    adminId: resolvedAdminUserId,
    userId: resolvedAdminUserId,
  };
};

const extractRoleRowsPermissions = (rows = []) => {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  const moduleRows = normalizedRows.filter((row) => {
    const module = normalizeKey(row?.module || row?.Module || row?.moduleName || row?.ModuleName || "");
    return module && module !== normalizeKey("All Modules");
  });
  const rowsToRead = moduleRows.length ? moduleRows : normalizedRows;

  return rowsToRead.reduce((map, row, index) => {
    const modulePermissionMap = extractModulePermissions(row);
    Object.entries(modulePermissionMap).forEach(([module, permissions]) => {
      if (module) map[module] = permissions;
    });

    const module = normalizeModuleName(row.module || row.Module || row.moduleName || row.ModuleName, index);
    const permissions = normalizePermissionRows([row]);
    if (module && (permissions.length || hasExplicitPermissionFields(row))) map[module] = permissions;
    return map;
  }, {});
};

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
  if (flatModule && (flatPermissions.length || hasExplicitPermissionFields(assignment))) {
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
      if (module) map[module] = normalized;
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
    const rowPermissions = permissions.length ? permissions : normalizePermissionRows([permissionModule]);
    if (module && (rowPermissions.length || hasExplicitPermissionFields(permissionModule))) {
      map[module] = rowPermissions;
    }
  });

  (Array.isArray(assignment.permissions) ? assignment.permissions : []).forEach((permission, index) => {
    if (typeof permission === "string") return;
    const dto = permission?.dto || permission?.Dto || {};
    const module = normalizeModuleName(
      permission?.moduleName || permission?.ModuleName || permission?.module || permission?.Module || dto?.moduleName || dto?.ModuleName || dto?.module || dto?.Module,
      index
    );
    const permissions = normalizePermissionRows([permission]);
    if (module && (permissions.length || hasExplicitPermissionFields(permission))) map[module] = permissions;
  });

  return map;
};

const assignmentMatchesProfile = (assignment = {}, profile = {}) => {
  const assignmentKeys = permissionIdentityKeys({
    id: assignment.id || assignment.Id,
    adminUserId: assignment.adminUserId || assignment.AdminUserId || assignment.adminUserID || assignment.AdminUserID,
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
  writeCache(permissionStore);
  window.dispatchEvent(new CustomEvent("rolePermissionsUpdated"));
};

export const permissionIdentityKeys = (user = {}) =>
  [
    user.id,
    user.adminUserId,
    user.AdminUserId,
    user.adminUserID,
    user.AdminUserID,
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

export const clearRoleModulePermissions = (user = {}) => {
  removeRoleModulePermissions(user);
  const syncKey = permissionIdentityKeys(user).join("|");
  if (syncKey) syncedKeys.delete(syncKey);
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
      merged[existingKey] = normalizePermissions(Array.isArray(permissions) ? permissions : [permissions]);
    });
    return merged;
  }, {});

const collectPermissionRows = (data) => {
  const rows = [
    ...parseList(data),
    ...parseList(data?.data),
    ...parseList(data?.role),
    ...parseList(data?.Role),
    ...parseList(data?.adminRole),
    ...parseList(data?.AdminRole),
    ...parseList(data?.user),
    ...parseList(data?.User),
    ...parseList(data?.admin),
    ...parseList(data?.Admin),
    ...parseList(data?.roles),
    ...parseList(data?.Roles),
    ...parseList(data?.permissions),
    ...parseList(data?.Permissions),
    ...parseList(data?.modulePermissions),
    ...parseList(data?.ModulePermissions),
  ];

  [
    data,
    data?.data,
    data?.role,
    data?.Role,
    data?.adminRole,
    data?.AdminRole,
    data?.user,
    data?.User,
    data?.admin,
    data?.Admin,
  ].forEach((item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const hasModule = normalizeModuleName(item.module || item.Module || item.moduleName || item.ModuleName, 0);
      const hasNestedPermissions =
        item.modulePermissions ||
        item.ModulePermissions ||
        item.permissionModules ||
        item.PermissionModules ||
        item.rolePermissions ||
        item.RolePermissions;
      if (hasModule || hasNestedPermissions || hasExplicitPermissionFields(item)) rows.push(item);
    }
  });

  return rows.filter(Boolean);
};

const extractPermissionMapFromResponse = (data) => {
  const list = parseList(data);
  return mergeModulePermissionMaps(
    ...(list.length
      ? list.map((item) => extractModulePermissions(item))
      : [extractModulePermissions(data?.data && typeof data.data === "object" ? data.data : data || {})])
  );
};

export const syncRolePermissionsFromBackend = async (profile = {}) => {
  if (shouldSkipAdminPermissionSync(profile)) return getRoleModulePermissions(profile);

  const effectiveProfile = await resolveAdminPermissionProfile(profile);
  const keys = permissionIdentityKeys(effectiveProfile);
  const syncKey = keys.join("|");
  if (!syncKey || syncingKeys.has(syncKey)) return getRoleModulePermissions(effectiveProfile);
  const isSuperAdminProfile = isSuperAdminPermissionProfile(effectiveProfile);
  const isAdminProfile = isAdminPermissionProfile(effectiveProfile);
  const shouldUseAdminRolesOnly = isAdminProfile && !isSuperAdminProfile;

  syncingKeys.add(syncKey);
  const responses = [];
  const existingModulePermissions = getRoleModulePermissions(effectiveProfile);
  const collectedPermissionMaps = [];
  let loadedAdminRoleRows = false;
  let loadedStaffPermissionRows = false;
  try {
    if (isAdminProfile) {
      try {
        const mePermissions = await requestPermissionsJson("user-permissions/me", effectiveProfile);
        const permissions = extractPermissionMapFromResponse(mePermissions);
        if (Object.keys(permissions).length) {
          collectedPermissionMaps.push(permissions);
          loadedAdminRoleRows = true;
        }
      } catch {
        // Admin module pages should not call protected roles/admins endpoints.
      }
    }

    if (!isAdminProfile && !isSuperAdminProfile && !loadedAdminRoleRows) {
      try {
        const mePermissions = await requestPermissionsJson("user-permissions/me", effectiveProfile);
        loadedStaffPermissionRows = true;
        const permissions = extractPermissionMapFromResponse(mePermissions);
        if (Object.keys(permissions).length) collectedPermissionMaps.push(permissions);
      } catch {
        // Some backend builds only expose per-user permission lookup.
      }
    }

    if (!isAdminProfile && !isSuperAdminProfile && !loadedAdminRoleRows && !collectedPermissionMaps.length) {
      const candidateIds = keys.filter((key) => /^\d+$/.test(String(key)));
      for (const id of candidateIds.slice(0, 3)) {
        try {
          const userPermissions = await requestPermissionsJson(`user-permissions/users/${encodeURIComponent(id)}`, effectiveProfile);
          loadedStaffPermissionRows = true;
          const permissions = extractPermissionMapFromResponse(userPermissions);
          if (Object.keys(permissions).length) collectedPermissionMaps.push(permissions);
          break;
        } catch {
          // Staff tokens may not be allowed on some older deployments.
        }
      }
    }

    const assignments = responses.flatMap((data) => {
      const list = parseList(data);
      return list.length ? list : [data?.data || data].filter(Boolean);
    });
    const matchedAssignments = assignments.filter((assignment) => assignmentMatchesProfile(assignment, effectiveProfile));
    matchedAssignments
      .forEach((assignment) => collectedPermissionMaps.push(extractModulePermissions(assignment)));
    if (!isAdminProfile && !collectedPermissionMaps.length && assignments[0]) {
      collectedPermissionMaps.push(extractModulePermissions(assignments[0]));
    }

    const modulePermissions = mergeModulePermissionMaps(...collectedPermissionMaps);
    if (Object.keys(modulePermissions).length) {
      saveRoleModulePermissions(effectiveProfile, normalizeRole(effectiveProfile.role || effectiveProfile.roleLabel), modulePermissions);
      if (effectiveProfile !== profile) {
        saveRoleModulePermissions(profile, normalizeRole(profile.role || profile.roleLabel), modulePermissions);
      }
      return modulePermissions;
    }

    if (!isAdminProfile && !isSuperAdminProfile && loadedStaffPermissionRows) {
      removeRoleModulePermissions(effectiveProfile);
      if (effectiveProfile !== profile) removeRoleModulePermissions(profile);
      return {};
    }
  } finally {
    syncedKeys.add(syncKey);
    syncingKeys.delete(syncKey);
  }

  if (shouldUseAdminRolesOnly) {
    removeRoleModulePermissions(effectiveProfile);
    if (effectiveProfile !== profile) removeRoleModulePermissions(profile);
    return {};
  }

  return Object.keys(existingModulePermissions || {}).length
    ? existingModulePermissions
    : getRoleModulePermissions(effectiveProfile);
};

export const syncAdminRoleMatrixFromBackend = async (profile = {}, seedData = null) => {
  const roleRows = collectPermissionRows(seedData);
  const matchedRoleRows = roleRows.filter((row) => roleRecordMatchesProfile(row, profile));

  const modulePermissions = extractRoleRowsPermissions(matchedRoleRows);
  if (Object.keys(modulePermissions).length) {
    saveRoleModulePermissions(profile, normalizeRole(profile.role || profile.roleLabel || "Admin"), modulePermissions);
  }

  return getRoleModulePermissions(profile);
};

export const hasSyncedRolePermissions = (profile = {}) => {
  const syncKey = permissionIdentityKeys(profile).join("|");
  return Boolean(syncKey && syncedKeys.has(syncKey));
};

export const hasPermissionSyncFinished = (profile = {}) => hasSyncedRolePermissions(profile);

export const shouldFailClosedForPermissions = () => false;

export const useRolePermissionsSync = (profile = {}) => {
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(() => !shouldSkipAdminPermissionSync(profile) && !hasSyncedRolePermissions(profile));

  useEffect(() => {
    if (shouldSkipAdminPermissionSync(profile)) {
      setLoading(false);
      return undefined;
    }

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
  }, [
    profile?.id,
    profile?.adminUserId,
    profile?.AdminUserId,
    profile?.adminUserID,
    profile?.AdminUserID,
    profile?.userId,
    profile?.email,
    profile?.name,
    profile?.role,
  ]);

  return { version, loading };
};

export const hasModulePermission = (profile = {}, module = "", permission = "View") => {
  const modulePermissions = getRoleModulePermissions(profile);
  const moduleKeys = getModuleLookupKeys(module);
  const matchedKey = Object.keys(modulePermissions).find((key) =>
    moduleKeys.includes(normalizeKey(key))
  );
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

export const useAdminModulePermissions = (module = "") => {
  const profile = getRoleProfile("admin");
  const hasSavedPermissions = hasAnySavedModulePermissions(profile);
  const savedPermissions = getModulePermissionSet(profile, module);
  const permissions = hasSavedPermissions
    ? savedPermissions
    : {
        view: true,
        create: true,
        edit: true,
        delete: true,
      };

  return {
    profile,
    permissions,
    canCreate: permissions.create,
    canEdit: permissions.edit,
    canDelete: permissions.delete,
  };
};

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
