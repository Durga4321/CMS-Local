import { useEffect, useSyncExternalStore } from "react";
import { apiUrl, assetUrl } from "../config/api";
import { formatClinicName } from "./clinicDisplay";

export const CLINIC_BRANDING_STORAGE_KEY = "clinicInvoiceBrandingSettings";
export const CLINIC_BRANDING_UPDATED_EVENT = "clinic-branding-updated";

const escapeSvgText = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const normalizeKey = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const getClinicBrandingScope = ({ clinicId = "", clinicName = "" } = {}) =>
  normalizeKey(clinicId) || normalizeKey(clinicName) || "default-clinic";

const hashText = (value = "") =>
  String(value || "")
    .split("")
    .reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) >>> 0, 2166136261);

const pickSeeded = (items = [], seed = 0) => items[seed % items.length];

const LOGO_COLORS = [
  { accent: "#0f8f8d", soft: "#ecfeff", border: "#67e8f9", text: "#0f766e" },
  { accent: "#2563eb", soft: "#eff6ff", border: "#93c5fd", text: "#1d4ed8" },
  { accent: "#7c3aed", soft: "#f5f3ff", border: "#c4b5fd", text: "#6d28d9" },
  { accent: "#dc2626", soft: "#fff1f2", border: "#fda4af", text: "#be123c" },
  { accent: "#16a34a", soft: "#f0fdf4", border: "#86efac", text: "#15803d" },
  { accent: "#ea580c", soft: "#fff7ed", border: "#fdba74", text: "#c2410c" },
  { accent: "#0891b2", soft: "#ecfeff", border: "#67e8f9", text: "#0e7490" },
  { accent: "#4f46e5", soft: "#eef2ff", border: "#a5b4fc", text: "#4338ca" },
];

const LOGO_SYMBOLS = [
  '<path d="M214 86h52c11 0 20 9 20 20v88h88c11 0 20 9 20 20v52c0 11-9 20-20 20h-88v88c0 11-9 20-20 20h-52c-11 0-20-9-20-20v-88h-88c-11 0-20-9-20-20v-52c0-11 9-20 20-20h88v-88c0-11 9-20 20-20Z" fill="none" stroke="currentColor" stroke-width="24" stroke-linejoin="round"/>',
  '<path d="M240 410c-72-58-132-107-132-184 0-44 35-80 79-80 25 0 45 11 53 27 8-16 28-27 53-27 44 0 79 36 79 80 0 77-60 126-132 184Z" fill="none" stroke="currentColor" stroke-width="24" stroke-linejoin="round"/>',
  '<path d="M357 79c-93 0-168 36-213 96-43 57-55 132-30 200 64 24 139 11 196-32 60-45 96-120 96-213 0-28-22-51-49-51Z" fill="none" stroke="currentColor" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/><path d="M263 173c-64 27-113 75-146 143" fill="none" stroke="currentColor" stroke-width="24" stroke-linecap="round"/>',
  '<circle cx="240" cy="238" r="72" fill="none" stroke="currentColor" stroke-width="24"/><path d="M240 58v62M240 356v62M60 238h62M358 238h62M113 111l44 44M323 321l44 44M367 111l-44 44M157 321l-44 44" fill="none" stroke="currentColor" stroke-width="24" stroke-linecap="round"/>',
  '<path d="M145 79c35-15 68-8 92 5 25 14 55 14 80 0 24-13 57-20 92-5 64 28 91 95 70 171l-45 170c-13 49-37 137-88 137-36 0-38-43-49-90-5-23-13-40-21-40s-16 17-21 40c-11 47-13 90-49 90-51 0-75-88-88-137L73 250C52 174 79 107 145 79Z" fill="none" stroke="currentColor" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>',
  '<path d="M130 288c46-80 87-120 123-120 35 0 51 38 82 38 25 0 42-25 63-62" fill="none" stroke="currentColor" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/><path d="M90 350h300" fill="none" stroke="currentColor" stroke-width="24" stroke-linecap="round"/>',
];

const isGeneratedClinicLogoDataUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw.startsWith("data:image/svg+xml")) return false;
  try {
    return decodeURIComponent(raw).includes('viewBox="0 0 480 560"');
  } catch {
    return raw.includes("480%20560") || raw.includes("480 560");
  }
};

export const getDefaultClinicLogo = (clinicName = "Clinic", clinicId = "") => {
  const displayName = formatClinicName(clinicName, "Clinic") || "Clinic";
  const name = displayName.toLowerCase();
  const seed = hashText(`${displayName}|${clinicId || ""}`);
  const palette = pickSeeded(LOGO_COLORS, seed);
  const fallbackText = displayName
    .replace(/[^a-z0-9\s]/gi, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const logo = name.includes("dental")
    ? { text: fallbackText, path: LOGO_SYMBOLS[4] }
    : name.includes("pragathi")
      ? { text: fallbackText || "P", path: LOGO_SYMBOLS[2] }
      : name.includes("sai ram") || name.includes("primo") || name.includes("pirnav")
        ? { text: fallbackText, path: LOGO_SYMBOLS[3] }
        : { text: name.includes("vims") ? "VIMS" : name.includes("nri") ? "NRI" : fallbackText || "CL", path: pickSeeded(LOGO_SYMBOLS, seed + fallbackText.length) };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 560" color="${palette.accent}"><rect x="72" y="44" width="336" height="336" rx="72" fill="${palette.soft}" stroke="${palette.border}" stroke-width="12"/><g>${logo.path}</g>${logo.text ? `<text x="240" y="455" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="50" font-weight="900" fill="${palette.text}">${escapeSvgText(logo.text)}</text>` : ""}</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const readClinicBrandingMap = () => {
  try {
    const value = JSON.parse(localStorage.getItem(CLINIC_BRANDING_STORAGE_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
};

export const saveClinicBranding = (branding = {}, scope = {}) => {
  const key = getClinicBrandingScope(scope);
  const map = readClinicBrandingMap();
  const next = {
    ...map,
    [key]: {
      ...map[key],
      ...branding,
      clinicId: scope.clinicId || branding.clinicId || "",
      clinicName: formatClinicName(scope.clinicName || branding.clinicName || ""),
      updatedAt: new Date().toISOString(),
    },
  };
  localStorage.setItem(CLINIC_BRANDING_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(CLINIC_BRANDING_UPDATED_EVENT, { detail: { key, branding: next[key] } }));
  return next[key];
};

const resolveAssetUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (isGeneratedClinicLogoDataUrl(raw)) return "";
  return assetUrl(raw);
};

const getAuthHeaders = () => {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("doctorToken") ||
    localStorage.getItem("receptionistToken") ||
    localStorage.getItem("nurseToken") ||
    localStorage.getItem("labToken") ||
    "";
  return {
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const parseApiPayload = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const unwrapApiData = (data) => {
  if (typeof data === "string") return { url: data };
  if (Array.isArray(data)) return data[0] || {};
  if (Array.isArray(data?.data)) return data.data[0] || {};
  if (typeof data?.data === "string") return { url: data.data };
  if (typeof data?.logo === "string") return { logo: data.logo };
  return data?.data && typeof data.data === "object" ? data.data : data || {};
};

const normalizeRemoteBranding = (data = {}) => {
  const source = unwrapApiData(data);
  const logoValue =
    source.logoDataUrl ||
    source.LogoDataUrl ||
    source.logoUrl ||
    source.LogoUrl ||
    source.logoPath ||
    source.LogoPath ||
    source.logoFilePath ||
    source.LogoFilePath ||
    source.logoFileName ||
    source.LogoFileName ||
    source.logo ||
    source.Logo ||
    source.fileUrl ||
    source.FileUrl ||
    source.url ||
    source.Url ||
    "";

  return {
    settingsId: source.id || source.Id || source.invoiceSettingsId || source.InvoiceSettingsId || "",
    headerTitle: source.headerTitle || source.HeaderTitle || "",
    headerSubtitle: source.headerSubtitle || source.HeaderSubtitle || "",
    clinicAddress: source.clinicAddress || source.ClinicAddress || "",
    clinicPhone: source.clinicPhone || source.ClinicPhone || "",
    clinicEmail: source.clinicEmail || source.ClinicEmail || "",
    gstNumber: source.gstNumber || source.GstNumber || "",
    registrationNumber: source.registrationNumber || source.RegistrationNumber || "",
    footerNote: source.footerNote || source.FooterNote || "",
    accentColor: source.accentColor || source.AccentColor || "",
    logoDataUrl: resolveAssetUrl(logoValue),
  };
};

const fetchPublicClinicLogoBranding = async (scope = {}) => {
  const clinicId = String(scope.clinicId || "").trim();
  if (!clinicId) return null;

  const logoUrl = getPublicClinicLogoUrl(clinicId);
  const response = await fetch(logoUrl, {
    method: "GET",
    headers: {
      "ngrok-skip-browser-warning": "true",
    },
  }).catch(() => null);
  if (!response?.ok) return null;

  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (contentType.startsWith("image/")) {
    return {
      logoDataUrl: logoUrl,
    };
  }

  const data = await parseApiPayload(response);
  const branding = normalizeRemoteBranding(data);
  return branding.logoDataUrl ? branding : null;
};

export const getPublicClinicLogoUrl = (clinicId = "") => {
  const id = String(clinicId || "").trim();
  return id ? apiUrl(`public/clinics/${encodeURIComponent(id)}/logo`) : "";
};

export const syncClinicBrandingFromBackend = async (scope = {}) => {
  if (scope.enabled === false) return null;

  const publicLogoBranding = await fetchPublicClinicLogoBranding(scope);
  if (publicLogoBranding?.logoDataUrl) {
    saveClinicBranding(publicLogoBranding, scope);
  }

  if (!localStorage.getItem("adminToken") && !sessionStorage.getItem("adminToken")) {
    return publicLogoBranding ? saveClinicBranding(publicLogoBranding, scope) : null;
  }

  const response = await fetch(apiUrl("InvoiceSettings"), {
    method: "GET",
    headers: getAuthHeaders(),
  }).catch(() => null);
  if (!response?.ok) return publicLogoBranding ? saveClinicBranding(publicLogoBranding, scope) : null;
  const data = await parseApiPayload(response);
  const branding = normalizeRemoteBranding(data);
  if (!branding.logoDataUrl && publicLogoBranding?.logoDataUrl) {
    branding.logoDataUrl = publicLogoBranding.logoDataUrl;
  }
  if (!Object.values(branding).some(Boolean)) return null;
  return saveClinicBranding(branding, scope);
};

export const getClinicInvoiceBranding = ({ clinicId = "", clinicName = "" } = {}) => {
  const map = readClinicBrandingMap();
  const direct = map[getClinicBrandingScope({ clinicId, clinicName })];
  const byName = map[getClinicBrandingScope({ clinicName })];
  const branding = direct || byName || {};
  const displayName = formatClinicName(branding.headerTitle || branding.clinicName || clinicName || "Clinic");
  const logoUrl = resolveAssetUrl(branding.logoDataUrl) || getDefaultClinicLogo(displayName, clinicId);

  return {
    template: branding.template || "professional",
    headerTitle: displayName,
    headerSubtitle: branding.headerSubtitle || "Consultation and Patient Care Centre",
    footerNote: branding.footerNote || "Thank you for choosing our clinic. Please retain this invoice for your records.",
    clinicAddress: branding.clinicAddress || localStorage.getItem("clinicAddress") || localStorage.getItem("hospitalAddress") || "",
    clinicPhone: branding.clinicPhone || localStorage.getItem("clinicPhone") || localStorage.getItem("hospitalPhone") || localStorage.getItem("contactNumber") || "",
    clinicEmail: branding.clinicEmail || localStorage.getItem("clinicEmail") || localStorage.getItem("hospitalEmail") || "",
    gstNumber: branding.gstNumber || localStorage.getItem("clinicGst") || localStorage.getItem("gstNumber") || "",
    registrationNumber: branding.registrationNumber || localStorage.getItem("clinicRegistration") || "",
    logoUrl,
    watermarkUrl: logoUrl,
    accentColor: branding.accentColor || "#0f9d9d",
    customTemplateName: branding.customTemplateName || "",
    customTemplateDataUrl: branding.customTemplateDataUrl || "",
    customTemplates: Array.isArray(branding.customTemplates) ? branding.customTemplates : [],
    selectedCustomTemplateId: branding.selectedCustomTemplateId || "",
    opTemplate: branding.opTemplate || null,
    diagnosticTemplate: branding.diagnosticTemplate || null,
  };
};

export const subscribeClinicBranding = (callback) => {
  window.addEventListener(CLINIC_BRANDING_UPDATED_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CLINIC_BRANDING_UPDATED_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
};

export const useClinicInvoiceBranding = (scope = {}) => {
  const scopeKey = getClinicBrandingScope(scope);
  const enabled = scope.enabled !== false;
  const version = useSyncExternalStore(
    subscribeClinicBranding,
    () => localStorage.getItem(CLINIC_BRANDING_STORAGE_KEY) || "",
    () => ""
  );
  useEffect(() => {
    if (!enabled) return undefined;
    syncClinicBrandingFromBackend(scope).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, enabled]);
  return getClinicInvoiceBranding({ ...scope, version });
};
