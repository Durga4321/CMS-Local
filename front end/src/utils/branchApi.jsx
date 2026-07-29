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

  branchCache.delete(String(hospitalId).trim() || "__all__");
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
  return [];
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
  return b.id ?? b.branchId ?? b.BranchId ?? b.BranchID ?? "";
};

export const getBranchName = (branch) => {
  const b = branch || {};
  return b.name ?? b.branchName ?? b.BranchName ?? "";
};

export const getBranchHospitalId = (branch) => {
  const b = branch || {};
  return b.hospitalId ?? b.HospitalId ?? b.clinicId ?? b.ClinicId ?? "";
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

export const fetchBranchesForHospital = async (hospitalId = getStoredHospitalId()) => {
  const targetHospitalId = hospitalId ? String(hospitalId).trim() : "";
  const cacheKey = targetHospitalId || "__all__";
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
    try {
      const response = await fetchWithTimeout(apiUrl(`Branch/hospital/${encodeURIComponent(targetHospitalId)}`), {
        headers,
      });

      if (response.ok) {
        const data = parseApiList(await response.json().catch(() => []));
        branchCache.set(cacheKey, { data, at: Date.now() });
        return data;
      }
    } catch (e) {
      // Ignore network/CORS error and fall back to fetching all branches
    }
  }

  const response = await fetchWithTimeout(BRANCH_API_URL, { headers });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Unable to load branches."));
  }

  const branches = parseApiList(await response.json().catch(() => []));
  if (!targetHospitalId) {
    branchCache.set(cacheKey, { data: branches, at: Date.now() });
    return branches;
  }

  const filtered = branches.filter((branch) => {
    const branchHospitalId = String(getBranchHospitalId(branch) || "").trim();
    return !branchHospitalId || branchHospitalId === targetHospitalId;
  });

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
    .map((branch) => ({
      id: String(getBranchId(branch) || "").trim(),
      name: String(getBranchName(branch) || "").trim(),
      isActive: getBranchIsActive(branch),
      raw: branch,
    }))
    .filter((branch) => branch.id && branch.name);
