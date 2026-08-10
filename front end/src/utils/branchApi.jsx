import { apiUrl } from "../config/api";

export const BRANCH_API_URL = apiUrl("Branch");
const BRANCH_CACHE_TTL_MS = 2 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 3500;
const branchCache = new Map();
const branchRequests = new Map();

export const clearBranchCache = (hospitalId) => {
  if (hospitalId === undefined || hospitalId === null || hospitalId === "") {
    branchCache.clear();
    return;
  }

  const keyPrefix = `${String(hospitalId).trim() || "__all__"}:`;
  Array.from(branchCache.keys()).forEach((key) => {
    if (String(key).startsWith(keyPrefix)) branchCache.delete(key);
  });
};

export const getAuthToken = () =>
  localStorage.getItem("adminToken") ||
  localStorage.getItem("token") ||
  localStorage.getItem("superAdminToken") ||
  "";

const decodeJwtPayload = (token) => {
  try {
    const payload = token?.split(".")?.[1];
    if (!payload || typeof atob !== "function") return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(normalized + padding));
  } catch {
    return null;
  }
};

export const getStoredHospitalId = () => {
  const storedHospitalId = localStorage.getItem("hospitalId");
  if (storedHospitalId) return Number(storedHospitalId) || storedHospitalId;

  const claims = decodeJwtPayload(getAuthToken());
  const claimHospitalId = claims?.HospitalId || claims?.hospitalId;
  return claimHospitalId ? Number(claimHospitalId) || claimHospitalId : "";
};

export const getJsonHeaders = () => {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const getApiHeaders = () => {
  const token = getAuthToken();
  return {
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const parseApiList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.branches)) return data.branches;
  if (Array.isArray(data?.Branches)) return data.Branches;
  if (Array.isArray(data?.data?.branches)) return data.data.branches;
  if (Array.isArray(data?.data?.Branches)) return data.data.Branches;
  return [];
};

export const normalizeScopeText = (value) =>
  String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const readBranchClinicName = (branch = {}) =>
  branch.hospitalName ??
  branch.HospitalName ??
  branch.clinicName ??
  branch.ClinicName ??
  branch.assignedClinic ??
  branch.AssignedClinic ??
  branch.hospital?.name ??
  branch.hospital?.hospitalName ??
  branch.clinic?.name ??
  branch.clinic?.clinicName ??
  "";

export const getRecordClinicId = (record = {}) =>
  record.hospitalId ??
  record.HospitalId ??
  record.hospitalID ??
  record.HospitalID ??
  record.clinicId ??
  record.ClinicId ??
  record.clinicID ??
  record.ClinicID ??
  record.hospital?.id ??
  record.hospital?.hospitalId ??
  record.clinic?.id ??
  record.clinic?.clinicId ??
  "";

export const getRecordClinicName = (record = {}) =>
  record.hospitalName ??
  record.HospitalName ??
  record.clinicName ??
  record.ClinicName ??
  record.assignedClinic ??
  record.AssignedClinic ??
  record.hospital?.name ??
  record.hospital?.hospitalName ??
  record.clinic?.name ??
  record.clinic?.clinicName ??
  "";

export const getRecordBranchIds = (record = {}) => {
  const directIds = [
    record.branchId,
    record.BranchId,
    record.branchID,
    record.BranchID,
    record.clinicBranchId,
    record.ClinicBranchId,
    record.branch?.id,
    record.branch?.branchId,
    record.Branch?.id,
    record.Branch?.branchId,
  ];

  const arrayIds = [record.branchIds, record.BranchIds, record.branches, record.Branches]
    .filter(Array.isArray)
    .flatMap((items) =>
      items.map((item) =>
        typeof item === "object" && item !== null
          ? item.id ?? item.Id ?? item.branchId ?? item.BranchId ?? item.branchID ?? item.BranchID
          : item
      )
    );

  return [...directIds, ...arrayIds]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
};

const fetchWithTimeout = (url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timeoutId));
};

export const getBranchId = (branch) => {
  const b = branch || {};
  return b.id ?? b.Id ?? b.branchId ?? b.BranchId ?? b.BranchID ?? b.branchID ?? b._id ?? "";
};

export const getBranchName = (branch) => {
  const b = branch || {};
  return b.name ?? b.Name ?? b.branchName ?? b.BranchName ?? b.branch ?? b.Branch ?? b.locationName ?? "";
};

export const getBranchHospitalId = (branch) => {
  const b = branch || {};
  return (
    b.hospitalId ??
    b.HospitalId ??
    b.hospitalID ??
    b.HospitalID ??
    b.clinicId ??
    b.ClinicId ??
    b.clinicID ??
    b.ClinicID ??
    b.hospital?.id ??
    b.hospital?.hospitalId ??
    b.clinic?.id ??
    b.clinic?.clinicId ??
    ""
  );
};

export const branchBelongsToHospital = (branch = {}, hospitalId = getStoredHospitalId(), clinicName = "") => {
  const targetHospitalId = String(hospitalId || "").trim();
  const targetClinicName = normalizeScopeText(clinicName);
  const branchHospitalId = String(getBranchHospitalId(branch) || "").trim();
  const branchClinicName = normalizeScopeText(readBranchClinicName(branch));

  if (!targetHospitalId && !targetClinicName) return true;
  if (targetHospitalId && branchHospitalId && branchHospitalId !== targetHospitalId) return false;
  if (targetClinicName && branchClinicName && branchClinicName !== targetClinicName) return false;
  if (targetHospitalId && branchHospitalId === targetHospitalId) return true;
  if (targetClinicName && branchClinicName === targetClinicName) return true;

  return false;
};

export const recordBelongsToClinicScope = (
  record = {},
  { hospitalId = getStoredHospitalId(), clinicName = "", branchIds = [] } = {}
) => {
  const targetHospitalId = String(hospitalId || "").trim();
  const targetClinicName = normalizeScopeText(clinicName);
  const branchIdSet = new Set(branchIds.map((value) => String(value ?? "").trim()).filter(Boolean));
  const recordHospitalId = String(getRecordClinicId(record) || "").trim();
  const recordClinicName = normalizeScopeText(getRecordClinicName(record));
  const recordBranchIds = getRecordBranchIds(record);

  if (!targetHospitalId && !targetClinicName && branchIdSet.size === 0) return true;
  if (targetHospitalId && recordHospitalId && recordHospitalId !== targetHospitalId) return false;
  if (targetClinicName && recordClinicName && recordClinicName !== targetClinicName) return false;
  if (targetHospitalId && recordHospitalId === targetHospitalId) return true;
  if (targetClinicName && recordClinicName === targetClinicName) return true;
  if (branchIdSet.size && recordBranchIds.length) {
    return recordBranchIds.some((branchId) => branchIdSet.has(branchId));
  }

  return false;
};

export const getBranchIsActive = (branch) => {
  const b = branch || {};
  if (typeof b.isActive === "boolean") return b.isActive;
  if (typeof b.IsActive === "boolean") return b.IsActive;

  const status = String(b.status ?? b.Status ?? "").trim().toLowerCase();
  if (!status) return true;
  return !["inactive", "disabled", "false", "0"].includes(status);
};

export const parseErrorMessage = async (response, fallback) => {
  try {
    const text = await response.text();
    if (!text) return fallback;

    try {
      const data = JSON.parse(text);
      const validationMessages =
        data?.errors && typeof data.errors === "object"
          ? Object.entries(data.errors)
              .flatMap(([key, messages]) =>
                (Array.isArray(messages) ? messages : [messages])
                  .filter(Boolean)
                  .map((message) => `${key}: ${message}`)
              )
              .join(" ")
          : "";

      return data?.message || validationMessages || data?.title || text;
    } catch {
      return text;
    }
  } catch {
    return fallback;
  }
};

export const fetchBranchesForHospital = async (hospitalId = getStoredHospitalId(), clinicName = "") => {
  const targetHospitalId = hospitalId ? String(hospitalId).trim() : "";
  const targetClinicName = normalizeScopeText(clinicName);
  const cacheKey = `${targetHospitalId || "__all__"}:${targetClinicName || "__name_all__"}`;
  const cached = branchCache.get(cacheKey);

  if (cached && Date.now() - cached.at < BRANCH_CACHE_TTL_MS) {
    return cached.data;
  }

  if (branchRequests.has(cacheKey)) {
    return branchRequests.get(cacheKey);
  }

  const request = (async () => {
  const headers = getApiHeaders();

  if (targetHospitalId) {
    const encodedId = encodeURIComponent(targetHospitalId);
    const scopedUrls = [
      apiUrl(`Branch/hospital/${encodedId}`),
      apiUrl(`Branches/hospital/${encodedId}`),
      apiUrl(`Branch/clinic/${encodedId}`),
      apiUrl(`Branches/clinic/${encodedId}`),
      apiUrl(`Branch?hospitalId=${encodedId}`),
      apiUrl(`Branches?hospitalId=${encodedId}`),
      apiUrl(`Branch?clinicId=${encodedId}`),
      apiUrl(`Branches?clinicId=${encodedId}`),
    ];

    for (const url of scopedUrls) {
      try {
        const response = await fetchWithTimeout(url, { headers });

        if (response.ok) {
          const data = parseApiList(await response.json().catch(() => []));
          const scopedData = data.filter((branch) =>
            branchBelongsToHospital(branch, targetHospitalId, targetClinicName)
          );
          const hasScopeMetadata = data.some(
            (branch) => getBranchHospitalId(branch) || readBranchClinicName(branch)
          );
          if (scopedData.length || (data.length && !hasScopeMetadata)) {
            const scopedResult = scopedData.length ? scopedData : data;
            branchCache.set(cacheKey, { data: scopedResult, at: Date.now() });
            return scopedResult;
          }
        }
      } catch {
        // Try the next endpoint shape.
      }
    }
  }

  const allBranchUrls = [BRANCH_API_URL, apiUrl("Branches")];
  let branches = [];
  let lastError = null;

  for (const url of allBranchUrls) {
    try {
      const response = await fetchWithTimeout(url, { headers });
      if (!response.ok) {
        lastError = new Error(await parseErrorMessage(response, "Unable to load branches."));
        continue;
      }

      branches = parseApiList(await response.json().catch(() => []));
      if (branches.length) break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!branches.length && lastError) {
    throw lastError;
  }

  const filtered = branches.filter((branch) =>
    branchBelongsToHospital(branch, targetHospitalId, targetClinicName)
  );

  branchCache.set(cacheKey, { data: filtered, at: Date.now() });
  return filtered;
  })();

  branchRequests.set(cacheKey, request);
  try {
    return await request;
  } finally {
    branchRequests.delete(cacheKey);
  }
};

export const buildBranchOptions = (branches = []) =>
  branches
    .map((branch) => {
      const id = String(getBranchId(branch) || "").trim();
      const name = String(getBranchName(branch) || "").trim();
      return {
        id: id || name,
        name: name || id,
        isActive: getBranchIsActive(branch),
        raw: branch,
      };
    })
    .filter((branch) => branch.id && branch.name);
