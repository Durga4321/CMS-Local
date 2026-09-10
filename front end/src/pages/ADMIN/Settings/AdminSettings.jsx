import React, { useEffect, useMemo, useState } from "react";
import {
  Eye,
  FileUp,
  ImagePlus,
  RotateCw,
  Save,
  Settings2,
  Trash2,
  Receipt,
  Sliders,
  Building2,
  FileText,
  Palette,
  Phone,
  Mail,
  MapPin,
  Hash,
  ShieldCheck,
  CheckCircle,
  FileCheck,
  Stethoscope,
  HeartPulse,
  Sparkles,
  Camera,
} from "lucide-react";
import { apiUrl, assetUrl } from "../../../config/api";
import { getRoleProfile } from "../../../profile/sessionProfile";
import { getClinicDisplayName } from "../../../utils/clinicDisplay";
import {
  getClinicBrandingScope,
  getDefaultClinicLogo,
  getPublicClinicLogoUrl,
  readClinicBrandingMap,
  saveClinicBranding,
  useClinicInvoiceBranding,
} from "../../../utils/clinicBranding";
import "./AdminSettings.css";

const BUILT_IN_TEMPLATES = [
  { value: "op", label: "OP Invoice" },
  { value: "diagnostic", label: "Diagnostic Invoice" },
];

const normalizeTemplateValue = (value = "") =>
  String(value || "professional").trim().toLowerCase() === "diagnotic" ? "diagnostic" : value || "professional";

const normalizeTemplateKey = (value = "") =>
  String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const normalizeHexColor = (value = "", fallback = "#0f9d9d") => {
  const raw = String(value || "").trim();
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  if (/^#[0-9a-f]{6}$/i.test(withHash)) return withHash.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(withHash)) {
    return `#${withHash[1]}${withHash[1]}${withHash[2]}${withHash[2]}${withHash[3]}${withHash[3]}`.toLowerCase();
  }
  return fallback;
};

const parseInvoiceTemplate = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return { selected: "op", templates: {} };
  try {
    const parsed = JSON.parse(raw);
    return {
      selected: normalizeTemplateValue(parsed.selected || parsed.template || "op"),
      templates: parsed.templates && typeof parsed.templates === "object" ? parsed.templates : {},
    };
  } catch {
    return { selected: normalizeTemplateValue(raw), templates: {} };
  }
};

const stringifyInvoiceTemplate = (settings = {}) =>
  JSON.stringify({
    selected: normalizeTemplateValue(settings.template || "op"),
    templates: {
      op: settings.opTemplate || null,
      diagnostic: settings.diagnosticTemplate || null,
    },
  });

const INVOICE_SETTINGS_PATH = "InvoiceSettings";
const INVOICE_LOGO_PATH = "InvoiceSettings/logo";

const withCacheBust = (url = "") => {
  const raw = String(url || "").trim();
  if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return raw;
  const separator = raw.includes("?") ? "&" : "?";
  return `${raw}${separator}v=${Date.now()}`;
};

const isGeneratedClinicLogoDataUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw.startsWith("data:image/svg+xml")) return false;
  try {
    return decodeURIComponent(raw).includes('viewBox="0 0 480 560"');
  } catch {
    return raw.includes("480%20560") || raw.includes("480 560");
  }
};

const resolveAssetUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (isGeneratedClinicLogoDataUrl(raw)) return "";
  return assetUrl(raw);
};

const optimizeLogoImage = (file, maxWidth = 800, maxHeight = 400) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl) return resolve("");
      if (dataUrl.startsWith("data:image/svg") || (file.size && file.size < 120 * 1024)) {
        return resolve(dataUrl);
      }
      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width || maxWidth;
          let height = img.naturalHeight || img.height || maxHeight;
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.max(1, Math.round(width * ratio));
            height = Math.max(1, Math.round(height * ratio));
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(dataUrl);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);
          const optimized = canvas.toDataURL("image/png", 0.92);
          resolve(optimized || dataUrl);
        } catch {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
};

const getAuthHeaders = (contentType = "application/json") => {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("receptionistToken") ||
    "";
  return {
    "ngrok-skip-browser-warning": "true",
    ...(contentType ? { "Content-Type": contentType } : {}),
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

const normalizeApiSettings = (data = {}) => {
  const source = unwrapApiData(data);
  const templateSettings = parseInvoiceTemplate(source.invoiceTemplate || source.InvoiceTemplate || source.template || source.Template || "op");
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
    id: source.id || source.Id || source.invoiceSettingsId || source.InvoiceSettingsId || "",
    template: templateSettings.selected,
    opTemplate: templateSettings.templates.op || null,
    diagnosticTemplate: templateSettings.templates.diagnostic || null,
    headerTitle: source.headerTitle || source.HeaderTitle || "",
    headerSubtitle: source.headerSubtitle || source.HeaderSubtitle || "",
    clinicAddress: source.clinicAddress || source.ClinicAddress || "",
    clinicPhone: source.clinicPhone || source.ClinicPhone || "",
    clinicEmail: source.clinicEmail || source.ClinicEmail || "",
    gstNumber: source.gstNumber || source.GstNumber || "",
    registrationNumber: source.registrationNumber || source.RegistrationNumber || "",
    footerNote: source.footerNote || source.FooterNote || "",
    accentColor: normalizeHexColor(source.accentColor || source.AccentColor || "#0f9d9d"),
    logoDataUrl: resolveAssetUrl(logoValue),
  };
};

const buildInvoiceSettingsPayload = (settings = {}) => ({
  clinicId: settings.clinicId || settings.hospitalId || "",
  hospitalId: settings.hospitalId || settings.clinicId || "",
  invoiceTemplate: stringifyInvoiceTemplate(settings),
  headerTitle: settings.headerTitle,
  headerSubtitle: settings.headerSubtitle,
  clinicAddress: settings.clinicAddress,
  clinicPhone: settings.clinicPhone,
  clinicEmail: settings.clinicEmail,
  gstNumber: settings.gstNumber,
  registrationNumber: settings.registrationNumber,
  footerNote: settings.footerNote,
  accentColor: normalizeHexColor(settings.accentColor),
});

const withClinicQuery = (path, clinicId = "") => {
  const id = String(clinicId || "").trim();
  if (!id) return apiUrl(path);
  const separator = String(path).includes("?") ? "&" : "?";
  return apiUrl(`${path}${separator}clinicId=${encodeURIComponent(id)}&hospitalId=${encodeURIComponent(id)}`);
};

const requestInvoiceSettings = async (method = "GET", body, clinicId = "") => {
  const response = await fetch(withClinicQuery(INVOICE_SETTINGS_PATH, clinicId || body?.clinicId || body?.hospitalId), {
    method,
    headers: getAuthHeaders(body ? "application/json" : ""),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await parseApiPayload(response);
  if (!response.ok) {
    throw new Error(data?.message || data?.title || (typeof data === "string" ? data : "") || `Invoice settings ${method} failed.`);
  }
  return data;
};

const isImageResponseUrl = async (url = "") => {
  const raw = String(url || "").trim();
  if (!raw) return false;
  const response = await fetch(raw, {
    method: "GET",
    headers: {
      "ngrok-skip-browser-warning": "true",
    },
  }).catch(() => null);
  if (!response?.ok) return false;
  return String(response.headers.get("content-type") || "").toLowerCase().startsWith("image/");
};

const requestInvoiceLogoUpload = async (file, clinicId = "") => {
  const id = String(clinicId || "").trim();
  const formData = new FormData();
  formData.append("logo", file);
  formData.append("file", file);
  formData.append("logoFile", file);
  formData.append("LogoFile", file);
  if (id) {
    formData.append("clinicId", id);
    formData.append("hospitalId", id);
    formData.append("ClinicId", id);
    formData.append("HospitalId", id);
  }
  const response = await fetch(apiUrl(INVOICE_LOGO_PATH), {
    method: "POST",
    headers: getAuthHeaders(""),
    body: formData,
  });
  const data = await parseApiPayload(response);
  if (!response.ok) {
    throw new Error(data?.message || data?.title || (typeof data === "string" ? data : "") || "Logo upload failed.");
  }
  return data;
};

const isInvoiceSettingsMissingError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("invoice settings") && (message.includes("not found") || message.includes("create"));
};

const requestInvoiceLogoDelete = async (clinicId = "") => {
  const response = await fetch(withClinicQuery(INVOICE_LOGO_PATH, clinicId), {
    method: "DELETE",
    headers: getAuthHeaders(""),
  });
  const data = await parseApiPayload(response);
  if (!response.ok) {
    throw new Error(data?.message || data?.title || (typeof data === "string" ? data : "") || "Logo delete failed.");
  }
  return data;
};

const clearLocalInvoiceSettings = () => {
  localStorage.removeItem("clinicInvoiceBrandingSettings");
  window.dispatchEvent(new CustomEvent("clinic-branding-updated"));
};

const readStoredBranding = (scope) => readClinicBrandingMap()[getClinicBrandingScope(scope)] || {};

const getProfileClinicId = (profile = {}) =>
  profile.clinicId ||
  profile.hospitalId ||
  profile.assignedClinicId ||
  localStorage.getItem("hospitalId") ||
  localStorage.getItem("clinicId") ||
  "";

function AdminSettings() {
  const canCreate = true;
  const canEdit = true;
  const canDelete = true;
  const profile = getRoleProfile("admin");
  const clinicName = getClinicDisplayName(profile, localStorage.getItem("clinicName") || "Clinic");
  const clinicId = getProfileClinicId(profile);
  const scope = useMemo(() => ({ clinicId, clinicName }), [clinicId, clinicName]);
  const liveBranding = useClinicInvoiceBranding(scope);
  const publicLogoUrl = getPublicClinicLogoUrl(clinicId);
  const defaultLogoUrl = getDefaultClinicLogo(clinicName, clinicId);
  const storedBranding = readStoredBranding(scope);
  const storedLogoDataUrl = resolveAssetUrl(storedBranding.logoDataUrl);
  const initialForm = {
    settingsId: "",
    template: normalizeTemplateValue(storedBranding.template || "op"),
    headerTitle: storedBranding.headerTitle || clinicName,
    headerSubtitle: storedBranding.headerSubtitle || "Consultation and Patient Care Centre",
    footerNote: storedBranding.footerNote || "Thank you for choosing our clinic. Please retain this invoice for your records.",
    clinicAddress: storedBranding.clinicAddress || localStorage.getItem("clinicAddress") || localStorage.getItem("hospitalAddress") || "",
    clinicPhone: storedBranding.clinicPhone || localStorage.getItem("clinicPhone") || localStorage.getItem("hospitalPhone") || localStorage.getItem("contactNumber") || "",
    clinicEmail: storedBranding.clinicEmail || localStorage.getItem("clinicEmail") || localStorage.getItem("hospitalEmail") || "",
    gstNumber: storedBranding.gstNumber || localStorage.getItem("clinicGst") || localStorage.getItem("gstNumber") || "",
    registrationNumber: storedBranding.registrationNumber || localStorage.getItem("clinicRegistration") || "",
    accentColor: normalizeHexColor(storedBranding.accentColor || "#0f9d9d"),
    logoDataUrl: storedLogoDataUrl || "",
    opTemplate: storedBranding.opTemplate || null,
    diagnosticTemplate: storedBranding.diagnosticTemplate || null,
  };
  const [form, setForm] = useState({
    ...initialForm,
  });
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("success");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasRemoteSettings, setHasRemoteSettings] = useState(false);

  const showStatus = (message, type = "success") => {
    setStatus(message);
    setStatusType(type);
  };

  const applyRemoteSettings = (settings = {}) => {
    setForm((prev) => ({
      ...prev,
      settingsId: settings.id || prev.settingsId,
      template: normalizeTemplateValue(settings.template || prev.template),
      headerTitle: settings.headerTitle || prev.headerTitle,
      headerSubtitle: settings.headerSubtitle || prev.headerSubtitle,
      clinicAddress: settings.clinicAddress || prev.clinicAddress,
      clinicPhone: settings.clinicPhone || prev.clinicPhone,
      clinicEmail: settings.clinicEmail || prev.clinicEmail,
      gstNumber: settings.gstNumber || prev.gstNumber,
      registrationNumber: settings.registrationNumber || prev.registrationNumber,
      footerNote: settings.footerNote || prev.footerNote,
      accentColor: normalizeHexColor(settings.accentColor || prev.accentColor),
      logoDataUrl: settings.logoDataUrl || prev.logoDataUrl,
      opTemplate: settings.opTemplate || prev.opTemplate,
      diagnosticTemplate: settings.diagnosticTemplate || prev.diagnosticTemplate,
    }));
  };

  const syncBrandingCache = (settings = form) =>
    saveClinicBranding(
      {
        ...settings,
        settingsId: settings.settingsId || settings.id || "",
        template: settings.template,
        logoDataUrl: settings.logoDataUrl || "",
        opTemplate: settings.opTemplate || null,
        diagnosticTemplate: settings.diagnosticTemplate || null,
      },
      scope
    );

  const loadInvoiceSettings = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    if (!quiet) showStatus("Loading invoice settings...", "info");
    try {
      const data = await requestInvoiceSettings("GET", undefined, clinicId);
      const remoteSettings = normalizeApiSettings(data);
      const hasSettings = Object.values(remoteSettings).some(Boolean);
      if (hasSettings) {
        setForm((prev) => {
          const mergedRemote = {
            ...remoteSettings,
            logoDataUrl: remoteSettings.logoDataUrl || prev.logoDataUrl || storedBranding.logoDataUrl || "",
            opTemplate: remoteSettings.opTemplate || storedBranding.opTemplate || prev.opTemplate,
            diagnosticTemplate: remoteSettings.diagnosticTemplate || storedBranding.diagnosticTemplate || prev.diagnosticTemplate,
          };
          syncBrandingCache({ ...prev, ...mergedRemote, settingsId: remoteSettings.id || prev.settingsId });
          return { ...prev, ...mergedRemote };
        });
        setHasRemoteSettings(true);
      } else {
        setHasRemoteSettings(false);
      }
      if (!quiet) showStatus(hasSettings ? "Invoice settings loaded." : "No invoice settings found yet.", "success");
    } catch (error) {
      if (!quiet) showStatus(error.message || "Unable to load invoice settings.", "error");
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoiceSettings({ quiet: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!liveBranding.logoUrl || liveBranding.logoUrl === defaultLogoUrl) return;
    setForm((prev) => {
      if (prev.logoDataUrl) return prev;
      const currentLogo = resolveAssetUrl(prev.logoDataUrl);
      if (currentLogo && currentLogo === liveBranding.logoUrl) return prev;
      return { ...prev, logoDataUrl: liveBranding.logoUrl };
    });
  }, [defaultLogoUrl, liveBranding.logoUrl]);

  const previewBranding = {
    ...initialForm,
    ...form,
    accentColor: normalizeHexColor(form.accentColor),
    logoUrl: resolveAssetUrl(form.logoDataUrl) || liveBranding.logoUrl || defaultLogoUrl,
    watermarkUrl: resolveAssetUrl(form.logoDataUrl) || liveBranding.logoUrl || defaultLogoUrl,
  };
  const effectiveTemplateValue = form.template;
  const builtInTemplate = BUILT_IN_TEMPLATES.find((template) => template.value === form.template);
  const templatePreview = builtInTemplate;
  const selectedTemplateKey = normalizeTemplateKey(templatePreview?.name || effectiveTemplateValue);
  const invoiceKind = selectedTemplateKey.includes("diagnostic") || selectedTemplateKey.includes("lab") || selectedTemplateKey.includes("test")
    ? "diagnostic"
    : "op";
  const activeUploadedTemplate = invoiceKind === "diagnostic" ? form.diagnosticTemplate : form.opTemplate;
  const invoiceTitle = invoiceKind === "diagnostic" ? "Diagnostic GST Invoice" : "OP Billing Invoice";
  const invoiceRows = invoiceKind === "diagnostic"
    ? [
        { name: "Complete Blood Count", amount: 450 },
        { name: "Thyroid Profile", amount: 850 },
      ]
    : [
        { name: "Consultation Fee", amount: 500 },
        { name: "Registration Charges", amount: 100 },
      ];
  const invoiceSubtotal = invoiceRows.reduce((sum, row) => sum + row.amount, 0);
  const invoiceCgst = Math.round(invoiceSubtotal * 0.09 * 100) / 100;
  const invoiceSgst = Math.round(invoiceSubtotal * 0.09 * 100) / 100;
  const invoiceTotal = invoiceSubtotal + invoiceCgst + invoiceSgst;
  const invoiceDiscount = invoiceKind === "diagnostic" ? 120 : 0;
  const invoiceNetAmount = invoiceTotal - invoiceDiscount;

  const updateField = (name, value) => {
    setStatus("");
    setForm((prev) => ({ ...prev, [name]: name === "accentColor" ? normalizeHexColor(value, prev.accentColor) : value }));
  };

  const readTemplateFile = (file, type) => {
    const reader = new FileReader();
    reader.onload = () => {
      const nextTemplate = {
        type,
        name: file.name.replace(/\.[^.]+$/, "") || file.name,
        fileName: file.name,
        dataUrl: String(reader.result || ""),
        updatedAt: new Date().toISOString(),
      };
      setForm((prev) => ({ ...prev, [`${type}Template`]: nextTemplate, template: type }));
      showStatus(`${type === "op" ? "OP" : "Diagnostic"} template ready. Click Save beside the template.`, "info");
    };
    reader.readAsDataURL(file);
  };

  const handleTemplateUpload = (type, event) => {
    if (!canCreate) {
      showStatus("You do not have permission to upload templates.", "error");
      event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    if (file) readTemplateFile(file, type);
    event.target.value = "";
  };

  const openTemplatePreview = (template) => {
    if (!template?.dataUrl) return;
    const win = window.open("", "_blank", "width=900,height=760");
    if (!win) return;
    const isImage = String(template.dataUrl).startsWith("data:image/");
    win.document.write(`<!doctype html><html><head><title>${template.fileName || template.name}</title><style>body{margin:0;background:#f8fafc;display:grid;place-items:center;min-height:100vh}img,iframe{width:96vw;height:94vh;object-fit:contain;border:0;background:white}</style></head><body>${isImage ? `<img src="${template.dataUrl}" alt="">` : `<iframe src="${template.dataUrl}" title="Template preview"></iframe>`}</body></html>`);
    win.document.close();
  };

  const saveBillingTemplate = async (type) => {
    if (!canEdit) {
      showStatus("You do not have permission to save templates.", "error");
      return;
    }
    const template = form[`${type}Template`];
    if (!template?.dataUrl) {
      showStatus(`Upload a ${type === "op" ? "OP" : "Diagnostic"} template first.`, "error");
      return;
    }

    const nextForm = {
      ...form,
      template: type,
      [`${type}Template`]: {
        ...template,
        savedAt: new Date().toISOString(),
      },
    };

    setSaving(true);
    showStatus(`Saving ${type === "op" ? "OP" : "Diagnostic"} template...`, "info");
    try {
      const data = await requestInvoiceSettings(
        hasRemoteSettings ? "PUT" : "POST",
        buildInvoiceSettingsPayload({ ...nextForm, clinicId, hospitalId: clinicId }),
        clinicId
      );
      const remoteSettings = normalizeApiSettings(data);
      const mergedSettings = {
        ...nextForm,
        ...remoteSettings,
        logoDataUrl: remoteSettings.logoDataUrl || nextForm.logoDataUrl,
        opTemplate: remoteSettings.opTemplate || nextForm.opTemplate,
        diagnosticTemplate: remoteSettings.diagnosticTemplate || nextForm.diagnosticTemplate,
        settingsId: remoteSettings.id || nextForm.settingsId,
      };
      setForm((prev) => ({ ...prev, ...mergedSettings }));
      setHasRemoteSettings(true);
      syncBrandingCache(mergedSettings);
      showStatus(`${type === "op" ? "OP" : "Diagnostic"} template saved in backend.`);
    } catch (error) {
      showStatus(error.message || `Unable to save ${type === "op" ? "OP" : "Diagnostic"} template.`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = async (event) => {
    if (!canCreate && !canEdit) {
      showStatus("You do not have permission to upload logo.", "error");
      event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      showStatus("Processing logo...", "info");
      const localLogo = await optimizeLogoImage(file);
      if (!localLogo) {
        showStatus("Invalid image file selected.", "error");
        return;
      }

      // Step 1: Immediately persist locally so the logo NEVER disappears!
      setForm((prev) => ({ ...prev, logoDataUrl: localLogo }));
      syncBrandingCache({ ...form, logoDataUrl: localLogo });
      showStatus("Logo updated successfully.", "success");

      // Step 2: Attempt remote backend synchronization in background
      setSaving(true);
      try {
        let nextForm = { ...form, logoDataUrl: localLogo };
        if (!hasRemoteSettings) {
          const settingsData = await requestInvoiceSettings(
            "POST",
            buildInvoiceSettingsPayload({ ...nextForm, clinicId, hospitalId: clinicId }),
            clinicId
          );
          const remoteSettings = normalizeApiSettings(settingsData);
          nextForm = {
            ...nextForm,
            ...remoteSettings,
            logoDataUrl: remoteSettings.logoDataUrl || nextForm.logoDataUrl,
            settingsId: remoteSettings.id || nextForm.settingsId,
          };
          setHasRemoteSettings(true);
        }

        let data = null;
        try {
          data = await requestInvoiceLogoUpload(file, clinicId);
        } catch (logoError) {
          if (isInvoiceSettingsMissingError(logoError)) {
            showStatus("Creating invoice settings before retrying logo upload...", "info");
            const settingsData = await requestInvoiceSettings(
              "POST",
              buildInvoiceSettingsPayload({ ...nextForm, clinicId, hospitalId: clinicId }),
              clinicId
            );
            const remoteSettings = normalizeApiSettings(settingsData);
            nextForm = {
              ...nextForm,
              ...remoteSettings,
              logoDataUrl: remoteSettings.logoDataUrl || nextForm.logoDataUrl,
              settingsId: remoteSettings.id || nextForm.settingsId,
            };
            setHasRemoteSettings(true);
            data = await requestInvoiceLogoUpload(file, clinicId);
          } else {
            throw logoError;
          }
        }

        const uploadedLogo = normalizeApiSettings(data).logoDataUrl;
        const refreshedSettings = await requestInvoiceSettings("GET", undefined, clinicId)
          .then(normalizeApiSettings)
          .catch(() => ({}));
        const refreshedLogo = refreshedSettings.logoDataUrl;
        const publicLogo = withCacheBust(publicLogoUrl);
        const publicLogoReady = await isImageResponseUrl(publicLogo);
        const verifiedRemoteLogo = publicLogoReady
          ? publicLogo
          : (refreshedLogo && (await isImageResponseUrl(refreshedLogo)))
          ? refreshedLogo
          : "";

        const effectiveLogo = verifiedRemoteLogo || localLogo;
        const syncedSettings = {
          ...nextForm,
          ...refreshedSettings,
          logoDataUrl: effectiveLogo,
          settingsId: refreshedSettings.id || nextForm.settingsId,
        };
        setForm((prev) => ({ ...prev, ...syncedSettings, logoDataUrl: effectiveLogo }));
        syncBrandingCache(syncedSettings);
        showStatus("Logo uploaded and saved successfully.", "success");
      } catch (remoteError) {
        // Backend sync failed or unavailable; KEEP local logo in form and cache!
        console.warn("Backend logo sync unavailable/failed; preserving local logo:", remoteError);
        setForm((prev) => ({ ...prev, logoDataUrl: localLogo }));
        syncBrandingCache({ ...form, logoDataUrl: localLogo });
        showStatus("Logo saved locally for invoices and branding.", "success");
      } finally {
        setSaving(false);
      }
    } catch (err) {
      showStatus(err.message || "Unable to read logo file.", "error");
    } finally {
      event.target.value = "";
    }
  };

  const selectTemplate = (value) => {
    const nextValue = normalizeTemplateValue(value);
    setStatus("");
    setForm((prev) => ({
      ...prev,
      template: nextValue,
    }));
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    if (hasRemoteSettings ? !canEdit : !canCreate) {
      showStatus(`You do not have permission to ${hasRemoteSettings ? "update" : "create"} settings.`, "error");
      return;
    }
    const nextForm = {
      ...form,
      template: effectiveTemplateValue,
    };
    setSaving(true);
    showStatus(hasRemoteSettings ? "Updating invoice settings..." : "Creating invoice settings...", "info");
    syncBrandingCache(nextForm);
    try {
      const data = await requestInvoiceSettings(
        hasRemoteSettings ? "PUT" : "POST",
        buildInvoiceSettingsPayload({ ...nextForm, clinicId, hospitalId: clinicId }),
        clinicId
      );
      const remoteSettings = normalizeApiSettings(data);
      const mergedSettings = {
        ...nextForm,
        ...remoteSettings,
        logoDataUrl: remoteSettings.logoDataUrl || nextForm.logoDataUrl,
        settingsId: remoteSettings.id || nextForm.settingsId,
      };
      setForm((prev) => ({ ...prev, ...mergedSettings }));
      setHasRemoteSettings(true);
      syncBrandingCache(mergedSettings);
      showStatus("Clinic invoice settings saved.");
    } catch (error) {
      syncBrandingCache(nextForm);
      showStatus("Invoice settings saved locally. (" + (error.message || "remote sync skipped") + ")", "info");
    } finally {
      setSaving(false);
    }
  };

  const deleteSettings = async () => {
    if (!canDelete) {
      showStatus("You do not have permission to delete settings.", "error");
      return;
    }
    setSaving(true);
    showStatus("Deleting invoice settings...", "info");
    try {
      await requestInvoiceSettings("DELETE", undefined, clinicId);
      setForm(initialForm);
      setHasRemoteSettings(false);
      clearLocalInvoiceSettings();
      showStatus("Invoice settings deleted.");
    } catch (error) {
      showStatus(error.message || "Unable to delete invoice settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteLogo = async () => {
    if (!canDelete) {
      showStatus("You do not have permission to delete logo.", "error");
      return;
    }
    setSaving(true);
    showStatus("Deleting logo...", "info");
    setForm((prev) => ({ ...prev, logoDataUrl: "" }));
    syncBrandingCache({ ...form, logoDataUrl: "" });
    try {
      await requestInvoiceLogoDelete(clinicId);
      showStatus("Logo deleted.");
    } catch (error) {
      console.warn("Backend logo delete skipped/failed:", error);
      showStatus("Logo deleted.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-settings-page">
      <div className="admin-settings-header">
        <div className="admin-settings-header-left">
          <div className="admin-settings-header-badge">
            <Receipt size={15} />
            <span>Hospital Billing & Invoices</span>
          </div>
          <h2>Billing & Invoice Settings</h2>
          <p>Configure hospital invoice formats, clinic logo branding, tax identification numbers, and receipt customization</p>
        </div>
        <div className="admin-settings-header-actions">
          <button
            type="button"
            className="admin-settings-header-btn admin-settings-refresh-btn"
            onClick={() => loadInvoiceSettings()}
            disabled={loading || saving}
            title="Refresh billing settings"
          >
            <RotateCw size={16} className={loading ? "admin-settings-spin" : ""} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="admin-settings-header-btn admin-settings-danger-btn"
            onClick={deleteSettings}
            disabled={loading || saving || !canDelete}
            title="Delete all custom billing settings"
          >
            <Trash2 size={16} />
            <span>Delete Settings</span>
          </button>
        </div>
      </div>

      <form className="admin-settings-grid" onSubmit={saveSettings}>
        {/* PANEL 1: INVOICE TEMPLATES & FORMATS */}
        <section className="admin-settings-panel">
          <div className="admin-settings-panel-head">
            <div className="admin-settings-panel-icon admin-settings-panel-icon--teal">
              <Receipt size={22} />
            </div>
            <div>
              <h3>Billing Templates</h3>
              <p>Choose your primary invoice layout and manage OP/Diagnostic templates</p>
            </div>
          </div>

          <div className="admin-settings-field">
            <label htmlFor="invoice-template-select">
              <span className="admin-settings-field-label">
                <FileText size={15} /> Primary Invoice Template
              </span>
            </label>
            <select
              id="invoice-template-select"
              value={effectiveTemplateValue}
              onChange={(event) => selectTemplate(event.target.value)}
              className="admin-settings-select"
            >
              {BUILT_IN_TEMPLATES.map((template) => (
                <option key={template.value} value={template.value}>
                  {template.label}
                </option>
              ))}
            </select>
          </div>

          {builtInTemplate ? (
            <div className="admin-settings-template-preview admin-settings-template-preview--builtin">
              <div className="admin-settings-builtin-badge">
                <Sparkles size={14} />
                <strong>Active System Format:</strong>
                <span>{builtInTemplate.label}</span>
              </div>
              <div className="admin-settings-builtin-template">
                <div className="admin-settings-builtin-template-head" style={{ borderColor: previewBranding.accentColor }}>
                  <span>{builtInTemplate.label}</span>
                  <b>INV-0001</b>
                </div>
                <div className="admin-settings-builtin-template-row">
                  <span>{form.template === "diagnostic" ? "Diagnostic Test" : "Consultation Fee"}</span>
                  <b>Rs. 500.00</b>
                </div>
              </div>
            </div>
          ) : null}

          <div className="admin-settings-template-list">
            <div className="admin-settings-template-list-head">
              <strong>Uploaded Custom Billing Templates</strong>
              <span>Support for HTML, PDF, DOCX and Images</span>
            </div>
            {[
              { type: "op", label: "OP Billing Template", template: form.opTemplate, desc: "Outpatient consultation & medicine receipts" },
              { type: "diagnostic", label: "Diagnostic Billing Template", template: form.diagnosticTemplate, desc: "Laboratory, pathology & diagnostic invoices" },
            ].map((item) => (
              <article className="admin-settings-template-card" key={item.type}>
                <div className="admin-settings-template-card-preview">
                  {item.template?.dataUrl ? (
                    String(item.template.dataUrl).startsWith("data:image/") ? (
                      <img src={item.template.dataUrl} alt={`${item.label} preview`} />
                    ) : (
                      <iframe title={`${item.label} preview`} src={item.template.dataUrl} />
                    )
                  ) : (
                    <div className="admin-settings-empty-template">
                      <FileText size={28} className="admin-settings-empty-icon" />
                      <span>No custom template</span>
                      <small>Using system format</small>
                    </div>
                  )}
                </div>
                <div className="admin-settings-template-card-meta">
                  <div className="admin-settings-template-card-header">
                    <button className="admin-settings-template-name" type="button" onClick={() => item.template?.dataUrl && openTemplatePreview(item.template)}>
                      {item.label}
                    </button>
                    <span className="admin-settings-template-desc">{item.template?.fileName || item.desc}</span>
                  </div>
                  <div className="admin-settings-template-actions">
                    <label className="admin-settings-template-action admin-settings-template-action--upload">
                      <FileUp size={15} />
                      <span>Upload</span>
                      <input type="file" accept=".html,.htm,.pdf,.doc,.docx,image/*" onChange={(event) => handleTemplateUpload(item.type, event)} disabled={!canCreate} />
                    </label>
                    <button
                      className="admin-settings-template-action admin-settings-template-action--save"
                      type="button"
                      onClick={() => saveBillingTemplate(item.type)}
                      disabled={!item.template?.dataUrl || saving || !canEdit}
                    >
                      <Save size={15} />
                      <span>Save</span>
                    </button>
                    <button className="admin-settings-template-action admin-settings-template-action--preview" type="button" onClick={() => openTemplatePreview(item.template)} disabled={!item.template?.dataUrl}>
                      <Eye size={15} />
                      <span>Preview</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="admin-settings-field">
            <label htmlFor="invoice-footer-note">
              <span className="admin-settings-field-label">
                <FileCheck size={15} /> Invoice Footer Terms & Medical Disclaimer
              </span>
            </label>
            <textarea
              id="invoice-footer-note"
              rows={4}
              value={form.footerNote}
              onChange={(event) => updateField("footerNote", event.target.value)}
              placeholder="e.g. Please bring this invoice for follow-up visits. Prescribed medicines once sold cannot be returned."
              className="admin-settings-textarea"
            />
          </div>
        </section>

        {/* PANEL 2: CLINIC BRANDING & BILLING DETAILS */}
        <section className="admin-settings-panel">
          <div className="admin-settings-panel-head">
            <div className="admin-settings-panel-icon admin-settings-panel-icon--blue">
              <Building2 size={22} />
            </div>
            <div>
              <h3>Clinic Branding & Identity</h3>
              <p>Hospital logo, billing tax identification, and contact details</p>
            </div>
          </div>

          {/* Logo upload dropzone */}
          <div className="admin-settings-logo-drop">
            <div className="admin-settings-logo-frame">
              {form.logoDataUrl && form.logoDataUrl !== defaultLogoUrl ? (
                <img
                  src={resolveAssetUrl(form.logoDataUrl)}
                  alt="Clinic logo preview"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="admin-settings-logo-empty" title="No logo uploaded - Click Upload Logo to add">
                  <Camera size={42} strokeWidth={1.8} className="admin-settings-camera-icon" />
                </div>
              )}
            </div>
            <div className="admin-settings-logo-actions">
              <label className="admin-settings-upload-btn">
                <ImagePlus size={16} />
                <span>Upload Logo</span>
                <input type="file" accept="image/*" onChange={handleLogoChange} disabled={!(canCreate || canEdit)} />
              </label>
              <button
                className="admin-settings-delete-logo-btn"
                type="button"
                onClick={deleteLogo}
                disabled={loading || saving || !canDelete || !form.logoDataUrl || form.logoDataUrl === defaultLogoUrl}
              >
                <Trash2 size={15} />
                <span>Delete Logo</span>
              </button>
            </div>
            <small className="admin-settings-logo-hint">Recommended: Transparent PNG or SVG (approx. 300x120px)</small>
          </div>

          {/* Accent Color theme */}
          <div className="admin-settings-field">
            <label htmlFor="invoice-accent-color">
              <span className="admin-settings-field-label">
                <Palette size={15} /> Invoice Accent Color Theme
              </span>
            </label>
            <div className="admin-settings-color-row">
              <input
                id="invoice-accent-color"
                type="color"
                value={form.accentColor}
                onChange={(event) => updateField("accentColor", event.target.value)}
                className="admin-settings-color-picker"
              />
              <input
                type="text"
                value={form.accentColor}
                onChange={(event) => updateField("accentColor", event.target.value)}
                placeholder="#0f9d9d"
                className="admin-settings-input admin-settings-color-input"
              />
            </div>

            {/* Curated Hospital & Healthcare Color Theme Presets */}
            <div className="admin-settings-color-presets">
              <span className="admin-settings-color-presets-label">Hospital Theme Presets:</span>
              {[
                { name: "Hospital Teal", hex: "#0f766e" },
                { name: "Clinical Blue", hex: "#0284c7" },
                { name: "Health Emerald", hex: "#059669" },
                { name: "Medical Cyan", hex: "#0891b2" },
                { name: "Diagnostic Teal", hex: "#0f9d9d" },
                { name: "Care Indigo", hex: "#4f46e5" },
                { name: "Vital Rose", hex: "#be123c" },
              ].map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  className={`admin-settings-preset-chip ${form.accentColor?.toLowerCase() === preset.hex ? "admin-settings-preset-chip--active" : ""}`}
                  onClick={() => updateField("accentColor", preset.hex)}
                  title={preset.name}
                >
                  <span className="admin-settings-preset-dot" style={{ background: preset.hex }} />
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Clinic Name & Subtitle */}
          <div className="admin-settings-field">
            <label htmlFor="invoice-header-title">
              <span className="admin-settings-field-label">
                <Building2 size={15} /> Hospital / Clinic Title on Invoice
              </span>
            </label>
            <input
              id="invoice-header-title"
              value={form.headerTitle}
              onChange={(event) => updateField("headerTitle", event.target.value)}
              placeholder="e.g. City Care Multispeciality Hospital"
              className="admin-settings-input"
            />
          </div>

          <div className="admin-settings-field">
            <label htmlFor="invoice-header-subtitle">
              <span className="admin-settings-field-label">
                <Stethoscope size={15} /> Department / Tagline
              </span>
            </label>
            <input
              id="invoice-header-subtitle"
              value={form.headerSubtitle}
              onChange={(event) => updateField("headerSubtitle", event.target.value)}
              placeholder="e.g. Comprehensive 24/7 Healthcare & Diagnostic Services"
              className="admin-settings-input"
            />
          </div>

          {/* 2-col Contact row */}
          <div className="admin-settings-fields-row">
            <div className="admin-settings-field">
              <label htmlFor="invoice-clinic-phone">
                <span className="admin-settings-field-label">
                  <Phone size={14} /> Clinic Phone
                </span>
              </label>
              <input
                id="invoice-clinic-phone"
                value={form.clinicPhone}
                onChange={(event) => updateField("clinicPhone", event.target.value)}
                placeholder="+91 98765 43210"
                className="admin-settings-input"
              />
            </div>
            <div className="admin-settings-field">
              <label htmlFor="invoice-clinic-email">
                <span className="admin-settings-field-label">
                  <Mail size={14} /> Clinic Email
                </span>
              </label>
              <input
                id="invoice-clinic-email"
                type="email"
                value={form.clinicEmail}
                onChange={(event) => updateField("clinicEmail", event.target.value)}
                placeholder="billing@hospital.com"
                className="admin-settings-input"
              />
            </div>
          </div>

          {/* 2-col Tax row */}
          <div className="admin-settings-fields-row">
            <div className="admin-settings-field">
              <label htmlFor="invoice-gst-number">
                <span className="admin-settings-field-label">
                  <Hash size={14} /> GST / Tax Number
                </span>
              </label>
              <input
                id="invoice-gst-number"
                value={form.gstNumber}
                onChange={(event) => updateField("gstNumber", event.target.value)}
                placeholder="37AAAAA0000A1Z5"
                className="admin-settings-input"
              />
            </div>
            <div className="admin-settings-field">
              <label htmlFor="invoice-registration-number">
                <span className="admin-settings-field-label">
                  <ShieldCheck size={14} /> Reg. / License No.
                </span>
              </label>
              <input
                id="invoice-registration-number"
                value={form.registrationNumber}
                onChange={(event) => updateField("registrationNumber", event.target.value)}
                placeholder="CLINIC-REG-2026"
                className="admin-settings-input"
              />
            </div>
          </div>

          {/* Clinic Address */}
          <div className="admin-settings-field">
            <label htmlFor="invoice-clinic-address">
              <span className="admin-settings-field-label">
                <MapPin size={14} /> Hospital / Clinic Address
              </span>
            </label>
            <textarea
              id="invoice-clinic-address"
              rows={3}
              value={form.clinicAddress}
              onChange={(event) => updateField("clinicAddress", event.target.value)}
              placeholder="e.g. Door No. 4-12, Main Road, Medical Center, City, State - 530001"
              className="admin-settings-textarea"
            />
          </div>

          {/* Primary Save Button */}
          <button
            className="admin-settings-primary-save-btn"
            type="submit"
            disabled={saving || (hasRemoteSettings ? !canEdit : !canCreate)}
            style={{ background: previewBranding.accentColor }}
          >
            <Save size={18} />
            <span>{saving ? "Saving Settings..." : hasRemoteSettings ? "Update Invoice Settings" : "Save Invoice Settings"}</span>
          </button>

          {status ? (
            <div className={`admin-settings-status-box admin-settings-status-box--${statusType}`}>
              <CheckCircle size={16} />
              <span>{status}</span>
            </div>
          ) : null}
        </section>

        {/* SECTION 3: LIVE PATIENT INVOICE PREVIEW */}
        <section className={`admin-settings-preview admin-settings-preview--${invoiceKind}`}>
          <div className="admin-settings-preview-header-bar">
            <div className="admin-settings-panel-icon admin-settings-panel-icon--purple">
              <FileCheck size={22} />
            </div>
            <div>
              <h3>Real-Time Invoice & Receipt Preview</h3>
              <p>Live visualization of the patient bill generated with your active hospital branding & template</p>
            </div>
            <div className="admin-settings-live-badge">
              <span className="admin-settings-pulse-dot" />
              <span>Live Patient Preview</span>
            </div>
          </div>
          <div className="admin-settings-preview-watermark">
            <img src={previewBranding.watermarkUrl} alt="" />
          </div>
          {activeUploadedTemplate?.dataUrl ? (
            <div className={`admin-settings-mapped-invoice admin-settings-mapped-invoice--${invoiceKind}`}>
              <header style={{ borderColor: previewBranding.accentColor }}>
                <div className="admin-settings-mapped-brand">
                  <img src={previewBranding.logoUrl} alt="" />
                  <div>
                    <span>{invoiceKind === "diagnostic" ? "Diagnostic Invoice" : "OP Invoice"}</span>
                    <h2>{previewBranding.headerTitle}</h2>
                    <p>{previewBranding.headerSubtitle}</p>
                    <p>{[previewBranding.clinicAddress, previewBranding.clinicPhone, previewBranding.clinicEmail].filter(Boolean).join(" | ")}</p>
                  </div>
                </div>
                <div className="admin-settings-mapped-number">
                  <strong>{invoiceKind === "diagnostic" ? "BILL-1" : "INV-0001"}</strong>
                  <small>Created: 11/08/2026, 06:09 PM</small>
                  <small>Print: 11/08/2026, 06:09 PM</small>
                  {invoiceKind === "op" ? <small>Token No: 26</small> : null}
                </div>
              </header>
              <section className="admin-settings-mapped-fields">
                <div><span>Patient Name</span><b>Somi</b></div>
                <div><span>Patient ID</span><b>P-86625</b></div>
                <div><span>Age / Sex</span><b>21Y / Female</b></div>
                <div><span>Phone</span><b>8096555145</b></div>
                <div><span>{invoiceKind === "diagnostic" ? "Diagnostic Bill No" : "OP / Cons No"}</span><b>{invoiceKind === "diagnostic" ? "BILL-1" : "INV-0001"}</b></div>
                <div><span>Token No</span><b>{invoiceKind === "op" ? "26" : "-"}</b></div>
                <div><span>Created Date</span><b>11/08/2026, 06:09 PM</b></div>
                <div><span>Print Date</span><b>11/08/2026, 06:09 PM</b></div>
                <div><span>{invoiceKind === "diagnostic" ? "Ref. Doctor" : "Consultant"}</span><b>Dr. Prasad Pilla</b></div>
                <div><span>Department</span><b>General Medicine & Surgery</b></div>
                <div><span>Visit Type</span><b>Normal</b></div>
                <div><span>Payment Mode</span><b>UPI</b></div>
                <div><span>Generated By</span><b>Durga Pilla</b></div>
                <div><span>GST</span><b>CGST 9% + SGST 9%</b></div>
              </section>
              <section className="admin-settings-mapped-table">
                <div className="admin-settings-mapped-row admin-settings-mapped-row--head">
                  <span>SNo</span>
                  <span>{invoiceKind === "diagnostic" ? "Diagnostic Test" : "Particulars"}</span>
                  <span>Amount</span>
                  <span>CGST</span>
                  <span>SGST</span>
                  <span>Net</span>
                </div>
                {invoiceRows.map((row, index) => {
                  const cgst = Math.round(row.amount * 0.09 * 100) / 100;
                  const sgst = Math.round(row.amount * 0.09 * 100) / 100;
                  return (
                    <div className="admin-settings-mapped-row" key={row.name}>
                      <span>{index + 1}</span>
                      <span>{row.name}</span>
                      <span>Rs. {row.amount.toFixed(2)}</span>
                      <span>Rs. {cgst.toFixed(2)}</span>
                      <span>Rs. {sgst.toFixed(2)}</span>
                      <span>Rs. {(row.amount + cgst + sgst).toFixed(2)}</span>
                    </div>
                  );
                })}
                <div className="admin-settings-mapped-total" style={{ background: `${previewBranding.accentColor}22` }}>
                  <span>Receipt / Net Amount</span>
                  <b>Rs. {invoiceNetAmount.toFixed(2)}</b>
                </div>
              </section>
              <footer>
                <p>{previewBranding.footerNote}</p>
                <strong>Authorized Signature</strong>
              </footer>
            </div>
          ) : invoiceKind === "diagnostic" ? (
            <div className="admin-settings-generated-invoice admin-settings-generated-invoice--diagnostic">
              <div className="admin-settings-diagnostic-head" style={{ borderColor: previewBranding.accentColor }}>
                <div>
                  <img src={previewBranding.logoUrl} alt="" />
                  <div>
                    <h2>{previewBranding.headerTitle} Diagnostics</h2>
                    <p>{previewBranding.headerSubtitle}</p>
                    <p>{[previewBranding.clinicAddress, previewBranding.clinicPhone, previewBranding.clinicEmail].filter(Boolean).join(" | ")}</p>
                  </div>
                </div>
                <div>
                  <span>{invoiceTitle}</span>
                  <strong>BILL-1</strong>
                  <small>Inv. Date: 11/08/2026, 06:09 PM</small>
                </div>
              </div>
              <div className="admin-settings-diagnostic-cards">
                <div>
                  <h3>Patient</h3>
                  <p><span>Name</span><b>Somi</b></p>
                  <p><span>Patient ID</span><b>P-86625</b></p>
                  <p><span>Ref. Doctor</span><b>Dr. Prasad Pilla</b></p>
                </div>
                <div>
                  <h3>Payment</h3>
                  <p><span>Mode</span><b>UPI</b></p>
                  <p><span>Generated By</span><b>Durga Pilla</b></p>
                  <p><span>GST</span><b>CGST 9% + SGST 9%</b></p>
                </div>
              </div>
              <div className="admin-settings-diagnostic-table">
                <div className="admin-settings-diagnostic-row admin-settings-diagnostic-row--head">
                  <span>SNo</span>
                  <span>Diagnostic Test</span>
                  <span>Amount</span>
                  <span>CGST</span>
                  <span>SGST</span>
                  <span>Net Amount</span>
                </div>
                {invoiceRows.map((row, index) => {
                  const cgst = Math.round(row.amount * 0.09 * 100) / 100;
                  const sgst = Math.round(row.amount * 0.09 * 100) / 100;
                  return (
                    <div className="admin-settings-diagnostic-row" key={row.name}>
                      <span>{index + 1}</span>
                      <span>{row.name}</span>
                      <span>Rs. {row.amount.toFixed(2)}</span>
                      <span>Rs. {cgst.toFixed(2)}</span>
                      <span>Rs. {sgst.toFixed(2)}</span>
                      <span>Rs. {(row.amount + cgst + sgst).toFixed(2)}</span>
                    </div>
                  );
                })}
                <div className="admin-settings-diagnostic-summary">
                  <span>Sub Total</span>
                  <b>Rs. {invoiceTotal.toFixed(2)}</b>
                </div>
                <div className="admin-settings-diagnostic-summary">
                  <span>Discount</span>
                  <b>- Rs. {invoiceDiscount.toFixed(2)}</b>
                </div>
                <div className="admin-settings-diagnostic-summary admin-settings-diagnostic-summary--net">
                  <span>Net Amount</span>
                  <b>Rs. {invoiceNetAmount.toFixed(2)}</b>
                </div>
              </div>
              <div className="admin-settings-generated-footer">
                <p>{previewBranding.footerNote}<br />Print on: 11/08/2026, 06:09 PM</p>
                <strong>Authorized Signature</strong>
              </div>
            </div>
          ) : (
            <div className="admin-settings-generated-invoice admin-settings-generated-invoice--op">
              <div className="admin-settings-op-head" style={{ borderColor: previewBranding.accentColor }}>
                <div>
                  <img src={previewBranding.logoUrl} alt="" />
                  <div>
                    <span>OP Invoice</span>
                    <h2>{previewBranding.headerTitle}</h2>
                    <p>{previewBranding.headerSubtitle}</p>
                    <p>{[previewBranding.clinicAddress, previewBranding.clinicPhone, previewBranding.clinicEmail].filter(Boolean).join(" | ")}</p>
                  </div>
                </div>
                <div>
                  <strong>INV-0001</strong>
                  <small>11/08/2026, 06:09 PM</small>
                </div>
              </div>
              <div className="admin-settings-op-details">
                <div><span>Patient Name</span><b>Somi</b></div>
                <div><span>Patient ID</span><b>P-86625</b></div>
                <div><span>Doctor</span><b>Dr. Prasad Pilla</b></div>
                <div><span>Payment</span><b>UPI</b></div>
              </div>
              <div className="admin-settings-op-table">
                {invoiceRows.map((row) => (
                  <div key={row.name}>
                    <span>{row.name}</span>
                    <b>Rs. {row.amount.toFixed(2)}</b>
                  </div>
                ))}
                <div><span>CGST 9%</span><b>Rs. {invoiceCgst.toFixed(2)}</b></div>
                <div><span>SGST 9%</span><b>Rs. {invoiceSgst.toFixed(2)}</b></div>
              <div className="admin-settings-op-total" style={{ background: `${previewBranding.accentColor}22` }}>
                  <span>Total Amount</span>
                  <b>Rs. {invoiceTotal.toFixed(2)}</b>
                </div>
              </div>
              <div className="admin-settings-generated-footer">
                <p>{previewBranding.footerNote}</p>
                <strong>Authorized Signature</strong>
              </div>
            </div>
          )}
          <div className="admin-settings-preview-head" style={{ borderColor: previewBranding.accentColor }}>
            <div>
              <img src={previewBranding.logoUrl} alt="" />
              <div>
                <h2>{previewBranding.headerTitle}</h2>
                <p>{previewBranding.headerSubtitle}</p>
                <p>{[previewBranding.clinicAddress, previewBranding.clinicPhone, previewBranding.clinicEmail].filter(Boolean).join(" | ")}</p>
                <p>{[previewBranding.gstNumber ? `GST: ${previewBranding.gstNumber}` : "", previewBranding.registrationNumber ? `Reg: ${previewBranding.registrationNumber}` : ""].filter(Boolean).join(" | ")}</p>
              </div>
            </div>
            <div className="admin-settings-preview-meta">
              <span>{invoiceTitle}</span>
              <strong>INV-0001</strong>
              <small>11/08/2026, 06:09 PM</small>
            </div>
          </div>
          <div className="admin-settings-preview-info-grid">
            <div>
              <span>Patient</span>
              <b>Somi</b>
              <small>Patient ID: P-86625</small>
              <small>Ref. Doctor: Dr. Prasad Pilla</small>
            </div>
            <div>
              <span>Payment</span>
              <b>UPI</b>
              <small>Generated By: Durga Pilla</small>
              <small>GST: CGST 9% + SGST 9%</small>
            </div>
          </div>
          <div className="admin-settings-preview-table admin-settings-preview-table--legacy">
            <span>Consultation Fee</span>
            <b>₹500.00</b>
          </div>
          <div className="admin-settings-preview-table admin-settings-preview-table--invoice">
            <div className="admin-settings-preview-table-head">
              <span>SNo</span>
              <span>{invoiceKind === "diagnostic" ? "Diagnostic Test" : "Particulars"}</span>
              <span>Amount</span>
              <span>CGST</span>
              <span>SGST</span>
              <span>Net</span>
            </div>
            {invoiceRows.map((row, index) => {
              const cgst = Math.round(row.amount * 0.09 * 100) / 100;
              const sgst = Math.round(row.amount * 0.09 * 100) / 100;
              return (
                <div className="admin-settings-preview-table-row" key={row.name}>
                  <span>{index + 1}</span>
                  <span>{row.name}</span>
                  <span>Rs. {row.amount.toFixed(2)}</span>
                  <span>Rs. {cgst.toFixed(2)}</span>
                  <span>Rs. {sgst.toFixed(2)}</span>
                  <span>Rs. {(row.amount + cgst + sgst).toFixed(2)}</span>
                </div>
              );
            })}
            <div className="admin-settings-preview-total-row">
              <span>Subtotal</span>
              <b>Rs. {invoiceSubtotal.toFixed(2)}</b>
              <span>CGST</span>
              <b>Rs. {invoiceCgst.toFixed(2)}</b>
              <span>SGST</span>
              <b>Rs. {invoiceSgst.toFixed(2)}</b>
            </div>
            <div className="admin-settings-preview-net-row">
              <span>Net Amount</span>
              <b>Rs. {invoiceTotal.toFixed(2)}</b>
            </div>
          </div>
          <div className="admin-settings-preview-footer">
            <p>{previewBranding.footerNote}</p>
            <strong>Authorized Signature</strong>
          </div>
        </section>
      </form>
    </div>
  );
}

export default AdminSettings;
