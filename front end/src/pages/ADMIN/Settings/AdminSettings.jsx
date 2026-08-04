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
    accentColor: existing.accentColor || defaults.accentColor,
    logoDataUrl: existing.logoDataUrl || "",
    customTemplateName: existing.customTemplateName || "",
    customTemplateDataUrl: existing.customTemplateDataUrl || "",
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
        template: "custom",
        customTemplateName: file.name,
        customTemplateDataUrl: String(reader.result || ""),
      }));
    };
    reader.readAsDataURL(file);
  };

  const saveSettings = (event) => {
    event.preventDefault();
    saveClinicBranding(form, scope);
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
            <select value={form.template} onChange={(event) => updateField("template", event.target.value)}>
              <option value="professional">Professional</option>
              <option value="compact">Compact</option>
              <option value="letterhead">Letterhead</option>
              <option value="custom">Custom upload</option>
            </select>
          </label>
          {form.template === "custom" ? (
            <label>
              Upload Template
              <span className="admin-settings-template-upload">
                <FileUp size={16} />
                <span>{form.customTemplateName || "Choose template file"}</span>
                <input type="file" accept=".html,.htm,.pdf,.doc,.docx,image/*" onChange={handleTemplateUpload} />
              </span>
            </label>
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
