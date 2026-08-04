import { useSyncExternalStore } from "react";

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

export const getDefaultClinicLogo = (clinicName = "Clinic") => {
  const name = String(clinicName || "").toLowerCase();
  const fallbackText = String(clinicName || "CLINIC")
    .replace(/[^a-z0-9\s]/gi, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const logo = name.includes("dental")
    ? { text: "", color: "#0f8f8d", path: '<path d="M145 79c35-15 68-8 92 5 25 14 55 14 80 0 24-13 57-20 92-5 64 28 91 95 70 171l-45 170c-13 49-37 137-88 137-36 0-38-43-49-90-5-23-13-40-21-40s-16 17-21 40c-11 47-13 90-49 90-51 0-75-88-88-137L73 250C52 174 79 107 145 79Z" fill="none" stroke="currentColor" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>' }
    : name.includes("pragathi")
      ? { text: "PRAGATHI", color: "#00a86b", path: '<path d="M357 79c-93 0-168 36-213 96-43 57-55 132-30 200 64 24 139 11 196-32 60-45 96-120 96-213 0-28-22-51-49-51Z" fill="none" stroke="currentColor" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/><path d="M263 173c-64 27-113 75-146 143" fill="none" stroke="currentColor" stroke-width="24" stroke-linecap="round"/>' }
      : name.includes("sai ram") || name.includes("primo") || name.includes("pirnav")
        ? { text: name.includes("sai ram") ? "SAI RAM" : name.includes("primo") ? "PRIMO" : "PIRNAV", color: "#d97706", path: '<circle cx="240" cy="238" r="72" fill="none" stroke="currentColor" stroke-width="24"/><path d="M240 58v62M240 356v62M60 238h62M358 238h62M113 111l44 44M323 321l44 44M367 111l-44 44M157 321l-44 44" fill="none" stroke="currentColor" stroke-width="24" stroke-linecap="round"/>' }
        : { text: name.includes("vims") ? "VIMS" : name.includes("nri") ? "NC" : fallbackText || "CL", color: "#00a884", path: '<path d="M214 86h52c11 0 20 9 20 20v88h88c11 0 20 9 20 20v52c0 11-9 20-20 20h-88v88c0 11-9 20-20 20h-52c-11 0-20-9-20-20v-88h-88c-11 0-20-9-20-20v-52c0-11 9-20 20-20h88v-88c0-11 9-20 20-20Z" fill="none" stroke="currentColor" stroke-width="24" stroke-linejoin="round"/>' };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 560" color="${logo.color}"><rect x="72" y="44" width="336" height="336" rx="72" fill="#f0fdfa" stroke="#7dd3fc" stroke-width="12"/><g>${logo.path}</g>${logo.text ? `<text x="240" y="455" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="50" font-weight="900" fill="#075eea">${escapeSvgText(logo.text)}</text>` : ""}</svg>`;
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
      clinicName: scope.clinicName || branding.clinicName || "",
      updatedAt: new Date().toISOString(),
    },
  };
  localStorage.setItem(CLINIC_BRANDING_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(CLINIC_BRANDING_UPDATED_EVENT, { detail: { key, branding: next[key] } }));
  return next[key];
};

export const getClinicInvoiceBranding = ({ clinicId = "", clinicName = "" } = {}) => {
  const map = readClinicBrandingMap();
  const direct = map[getClinicBrandingScope({ clinicId, clinicName })];
  const byName = map[getClinicBrandingScope({ clinicName })];
  const branding = direct || byName || {};
  const displayName = branding.headerTitle || branding.clinicName || clinicName || "Clinic";

  return {
    template: branding.template || "professional",
    headerTitle: displayName,
    headerSubtitle: branding.headerSubtitle || "Consultation and Patient Care Centre",
    footerNote: branding.footerNote || "Thank you for choosing our clinic. Please retain this invoice for your records.",
    logoUrl: branding.logoDataUrl || getDefaultClinicLogo(displayName),
    watermarkUrl: branding.logoDataUrl || getDefaultClinicLogo(displayName),
    accentColor: branding.accentColor || "#0f9d9d",
    customTemplateName: branding.customTemplateName || "",
    customTemplateDataUrl: branding.customTemplateDataUrl || "",
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
  const version = useSyncExternalStore(
    subscribeClinicBranding,
    () => localStorage.getItem(CLINIC_BRANDING_STORAGE_KEY) || "",
    () => ""
  );
  return getClinicInvoiceBranding({ ...scope, version });
};
