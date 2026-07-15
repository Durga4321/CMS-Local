import { apiUrl } from "../config/api";

export const BRANCH_API_URL = apiUrl("Branch");

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
  const headers = getApiHeaders();

  if (targetHospitalId) {
    try {
      const response = await fetch(apiUrl(`Branch/hospital/${encodeURIComponent(targetHospitalId)}`), {
        headers,
      });

      if (response.ok) {
        return parseApiList(await response.json().catch(() => []));
      }
    } catch (e) {
      // Ignore network/CORS error and fall back to fetching all branches
    }
  }

  const response = await fetch(BRANCH_API_URL, { headers });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Unable to load branches."));
  }

  const branches = parseApiList(await response.json().catch(() => []));
  if (!targetHospitalId) return branches;

  return branches.filter((branch) => {
    const branchHospitalId = String(getBranchHospitalId(branch) || "").trim();
    return !branchHospitalId || branchHospitalId === targetHospitalId;
  });
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
