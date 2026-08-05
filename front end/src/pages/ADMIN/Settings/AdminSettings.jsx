import React, { useMemo, useState } from "react";
import { FileUp, ImagePlus, Save, Settings2 } from "lucide-react";
import { getRoleProfile } from "../../../profile/sessionProfile";
import { getClinicDisplayName } from "../../../utils/clinicDisplay";
import {
  getClinicBrandingScope,
  getClinicInvoiceBranding,
  readClinicBrandingMap,
  saveClinicBranding,
} from "../../../utils/clinicBranding";
import "./AdminSettings.css";

const BUILT_IN_TEMPLATES = [
  { value: "professional", label: "Professional" },
  { value: "compact", label: "Compact" },
  { value: "letterhead", label: "Letterhead" },
];

const getProfileClinicId = (profile = {}) =>
  profile.clinicId ||
  profile.hospitalId ||
  profile.assignedClinicId ||
  localStorage.getItem("hospitalId") ||
  localStorage.getItem("clinicId") ||
  "";

const readStoredBranding = (scope) => readClinicBrandingMap()[getClinicBrandingScope(scope)] || {};

function AdminSettings() {
  const profile = getRoleProfile("admin");
  const clinicName = getClinicDisplayName(profile, localStorage.getItem("clinicName") || "Clinic");
  const clinicId = getProfileClinicId(profile);
  const scope = useMemo(() => ({ clinicId, clinicName }), [clinicId, clinicName]);
  const existing = readStoredBranding(scope);
  const defaults = getClinicInvoiceBranding(scope);
  const [form, setForm] = useState({
    template: existing.template || defaults.template,
    headerTitle: existing.headerTitle || clinicName,
    headerSubtitle: existing.headerSubtitle || defaults.headerSubtitle,
    footerNote: existing.footerNote || defaults.footerNote,
    clinicAddress: existing.clinicAddress || defaults.clinicAddress || "",
    clinicPhone: existing.clinicPhone || defaults.clinicPhone || "",
    clinicEmail: existing.clinicEmail || defaults.clinicEmail || "",
    gstNumber: existing.gstNumber || defaults.gstNumber || "",
    registrationNumber: existing.registrationNumber || defaults.registrationNumber || "",
    accentColor: existing.accentColor || defaults.accentColor,
    logoDataUrl: existing.logoDataUrl || "",
    customTemplateName: existing.customTemplateName || "",
    customTemplateDataUrl: existing.customTemplateDataUrl || "",
    customTemplates: Array.isArray(existing.customTemplates) ? existing.customTemplates : defaults.customTemplates || [],
    selectedCustomTemplateId: existing.selectedCustomTemplateId || defaults.selectedCustomTemplateId || "",
    pendingTemplateName: "",
    pendingTemplateDataUrl: "",
    pendingTemplateFileName: "",
  });
  const [status, setStatus] = useState("");

  const previewBranding = {
    ...getClinicInvoiceBranding(scope),
    ...form,
    logoUrl: form.logoDataUrl || getClinicInvoiceBranding({ ...scope, clinicName: form.headerTitle }).logoUrl,
    watermarkUrl: form.logoDataUrl || getClinicInvoiceBranding({ ...scope, clinicName: form.headerTitle }).watermarkUrl,
  };

  const updateField = (name, value) => {
    setStatus("");
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateField("logoDataUrl", String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const handleTemplateUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setStatus("");
      setForm((prev) => ({
        ...prev,
        template: "custom-new",
        pendingTemplateName: file.name.replace(/\.[^.]+$/, "") || file.name,
        pendingTemplateFileName: file.name,
        pendingTemplateDataUrl: String(reader.result || ""),
      }));
    };
    reader.readAsDataURL(file);
  };

  const saveUploadedTemplate = () => {
    if (!form.pendingTemplateDataUrl) {
      setStatus("Upload a template file first.");
      return;
    }

    const templateId = `custom-${Date.now()}`;
    const templateName =
      String(form.pendingTemplateName || form.pendingTemplateFileName || "Custom Template").trim() ||
      "Custom Template";
    const nextTemplate = {
      id: templateId,
      name: templateName,
      fileName: form.pendingTemplateFileName || templateName,
      dataUrl: form.pendingTemplateDataUrl,
      savedAt: new Date().toISOString(),
    };

    setForm((prev) => ({
      ...prev,
      template: templateId,
      selectedCustomTemplateId: templateId,
      customTemplateName: nextTemplate.name,
      customTemplateDataUrl: nextTemplate.dataUrl,
      customTemplates: [...(Array.isArray(prev.customTemplates) ? prev.customTemplates : []), nextTemplate],
      pendingTemplateName: "",
      pendingTemplateFileName: "",
      pendingTemplateDataUrl: "",
    }));
    setStatus("Template saved. Save settings to apply it.");
  };

  const selectTemplate = (value) => {
    const selectedCustom = (form.customTemplates || []).find((template) => template.id === value);
    setStatus("");
    setForm((prev) => ({
      ...prev,
      template: value,
      selectedCustomTemplateId: selectedCustom ? selectedCustom.id : "",
      customTemplateName: selectedCustom ? selectedCustom.name : prev.customTemplateName,
      customTemplateDataUrl: selectedCustom ? selectedCustom.dataUrl : prev.customTemplateDataUrl,
    }));
  };

  const saveSettings = (event) => {
    event.preventDefault();
    const selectedCustom = (form.customTemplates || []).find((template) => template.id === form.template);
    saveClinicBranding(
      {
        ...form,
        selectedCustomTemplateId: selectedCustom ? selectedCustom.id : "",
        customTemplateName: selectedCustom ? selectedCustom.name : form.customTemplateName,
        customTemplateDataUrl: selectedCustom ? selectedCustom.dataUrl : form.customTemplateDataUrl,
      },
      scope
    );
    setStatus("Clinic invoice settings saved.");
  };

  return (
    <div className="admin-settings-page">
      <div className="admin-settings-header">
        <div>
          <p>Clinic Settings</p>
          <h1>Invoice Branding</h1>
          <span>These settings apply to every new billing invoice generated under this clinic.</span>
        </div>
        <Settings2 size={34} />
      </div>

      <form className="admin-settings-grid" onSubmit={saveSettings}>
        <section className="admin-settings-panel">
          <h2>Template</h2>
          <label>
            Invoice Template
            <select value={form.template} onChange={(event) => selectTemplate(event.target.value)}>
              {BUILT_IN_TEMPLATES.map((template) => (
                <option key={template.value} value={template.value}>
                  {template.label}
                </option>
              ))}
              {(form.customTemplates || []).map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
              <option value="custom-new">Upload new template</option>
            </select>
          </label>
          {form.template === "custom-new" ? (
            <div className="admin-settings-template-box">
              <label>
                Template Name
                <input
                  value={form.pendingTemplateName}
                  onChange={(event) => updateField("pendingTemplateName", event.target.value)}
                  placeholder="Enter template name"
                />
              </label>
              <label>
                Upload Template
              <span className="admin-settings-template-upload">
                <FileUp size={16} />
                  <span>{form.pendingTemplateFileName || "Choose template file"}</span>
                <input type="file" accept=".html,.htm,.pdf,.doc,.docx,image/*" onChange={handleTemplateUpload} />
              </span>
              </label>
              <button className="admin-settings-secondary" type="button" onClick={saveUploadedTemplate}>
                <Save size={16} />
                Save Template
              </button>
            </div>
          ) : null}
          <label>
            Header Title
            <input value={form.headerTitle} onChange={(event) => updateField("headerTitle", event.target.value)} />
          </label>
          <label>
            Header Subtitle
            <input value={form.headerSubtitle} onChange={(event) => updateField("headerSubtitle", event.target.value)} />
          </label>
          <label>
            Clinic Address
            <textarea rows={3} value={form.clinicAddress} onChange={(event) => updateField("clinicAddress", event.target.value)} />
          </label>
          <label>
            Clinic Phone
            <input value={form.clinicPhone} onChange={(event) => updateField("clinicPhone", event.target.value)} />
          </label>
          <label>
            Clinic Email
            <input value={form.clinicEmail} onChange={(event) => updateField("clinicEmail", event.target.value)} />
          </label>
          <label>
            GST Number
            <input value={form.gstNumber} onChange={(event) => updateField("gstNumber", event.target.value)} />
          </label>
          <label>
            Registration Number
            <input value={form.registrationNumber} onChange={(event) => updateField("registrationNumber", event.target.value)} />
          </label>
          <label>
            Footer Note
            <textarea rows={4} value={form.footerNote} onChange={(event) => updateField("footerNote", event.target.value)} />
          </label>
          <label>
            Accent Color
            <span className="admin-settings-color-row">
              <input type="color" value={form.accentColor} onChange={(event) => updateField("accentColor", event.target.value)} />
              <input value={form.accentColor} onChange={(event) => updateField("accentColor", event.target.value)} />
            </span>
          </label>
        </section>

        <section className="admin-settings-panel">
          <h2>Clinic Logo</h2>
          <div className="admin-settings-logo-drop">
            <img src={previewBranding.logoUrl} alt="Clinic logo preview" />
            <label className="admin-settings-upload">
              <ImagePlus size={18} />
              Upload Logo
              <input type="file" accept="image/*" onChange={handleLogoChange} />
            </label>
          </div>
          <button className="admin-settings-save" type="submit">
            <Save size={18} />
            Save Settings
          </button>
          {status ? <p className="admin-settings-status">{status}</p> : null}
        </section>

        <section className={`admin-settings-preview admin-settings-preview--${form.template}`}>
          <div className="admin-settings-preview-watermark">
            <img src={previewBranding.watermarkUrl} alt="" />
          </div>
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
            <strong>INV-0001</strong>
          </div>
          <div className="admin-settings-preview-table">
            <span>Consultation Fee</span>
            <b>₹500.00</b>
          </div>
          <p>{previewBranding.footerNote}</p>
        </section>
      </form>
    </div>
  );
}

export default AdminSettings;
