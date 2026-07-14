import React, { useEffect, useState } from "react";
import Header from "../../../components/superadmin/Header";
import {
  fetchSettings,
  updateEmailSettings,
  updateGeneralSettings,
  updatePaymentSettings,
  updateSmsSettings,
} from "../superAdminApi";
import {
  validateEmailCom,
  validateNumeric,
  validateText,
} from "../../../utils/validation";

const tabs = ["General Settings", "Email Settings", "SMS Settings", "Payment Settings"];

const sectionByTab = {
  "General Settings": "general",
  "Email Settings": "email",
  "SMS Settings": "sms",
  "Payment Settings": "payment",
};

const updateBySection = {
  general: updateGeneralSettings,
  email: updateEmailSettings,
  sms: updateSmsSettings,
  payment: updatePaymentSettings,
};

const defaultSettings = {
  general: {
    appName: "CMS Platform",
    timezone: "Asia/Kolkata",
    currency: "INR",
    name: "CMS Platform",
    status: "Enabled",
    notes: "Update general settings used across all clinics.",
  },
  email: {
    name: "CMS Notifications",
    fromEmail: "",
    smtpHost: "",
    smtpPort: "587",
    username: "",
    password: "",
    status: "Enabled",
    notes: "Update email settings used across all clinics.",
  },
  sms: {
    name: "SMS Provider",
    provider: "",
    senderId: "",
    apiKey: "",
    apiSecret: "",
    status: "Enabled",
    notes: "Update sms settings used across all clinics.",
  },
  payment: {
    name: "Payment Gateway",
    provider: "",
    merchantId: "",
    publicKey: "",
    secretKey: "",
    mode: "Test",
    status: "Enabled",
    notes: "Update payment settings used across all clinics.",
  },
};

const timezones = ["Asia/Kolkata", "UTC", "Asia/Dubai", "Europe/London", "America/New_York"];
const currencies = ["INR", "USD", "AED", "EUR", "GBP"];
const humanReadableSettingsFields = new Set([
  "appName",
  "name",
  "provider",
  "notes",
]);

const fieldsBySection = {
  general: [
    { name: "appName", label: "App Name", required: true },
    { name: "timezone", label: "Timezone", type: "select", options: timezones },
    { name: "currency", label: "Currency", type: "select", options: currencies },
    { name: "status", label: "Status", type: "select", options: ["Enabled", "Disabled"] },
    { name: "notes", label: "Configuration Notes", type: "textarea", full: true },
  ],
  email: [
    { name: "name", label: "Sender Name", required: true },
    { name: "fromEmail", label: "From Email", type: "email", required: true },
    { name: "smtpHost", label: "SMTP Host", required: true },
    { name: "smtpPort", label: "SMTP Port", type: "number", required: true },
    { name: "username", label: "SMTP Username" },
    { name: "password", label: "SMTP Password", type: "password" },
    { name: "status", label: "Status", type: "select", options: ["Enabled", "Disabled"] },
    { name: "notes", label: "Configuration Notes", type: "textarea", full: true },
  ],
  sms: [
    { name: "name", label: "Configuration Name", required: true },
    { name: "provider", label: "Provider", required: true },
    { name: "senderId", label: "Sender ID" },
    { name: "apiKey", label: "API Key", required: true },
    { name: "apiSecret", label: "API Secret", type: "password" },
    { name: "status", label: "Status", type: "select", options: ["Enabled", "Disabled"] },
    { name: "notes", label: "Configuration Notes", type: "textarea", full: true },
  ],
  payment: [
    { name: "name", label: "Configuration Name", required: true },
    { name: "provider", label: "Gateway Provider", required: true },
    { name: "merchantId", label: "Merchant ID" },
    { name: "publicKey", label: "Public Key" },
    { name: "secretKey", label: "Secret Key", type: "password" },
    { name: "mode", label: "Mode", type: "select", options: ["Test", "Live"] },
    { name: "status", label: "Status", type: "select", options: ["Enabled", "Disabled"] },
    { name: "notes", label: "Configuration Notes", type: "textarea", full: true },
  ],
};

function Settings() {
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeSection = sectionByTab[activeTab];
  const activeSettings = settings[activeSection] || defaultSettings[activeSection];

  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await fetchSettings();
        if (active) {
          setSettings({
            general: { ...defaultSettings.general, ...data.general },
            email: { ...defaultSettings.email, ...data.email },
            sms: { ...defaultSettings.sms, ...data.sms },
            payment: { ...defaultSettings.payment, ...data.payment },
          });
        }
      } catch (requestError) {
        if (active) setError(requestError.message || "Unable to load settings.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadSettings();

    return () => {
      active = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setSuccess("");
    setSettings((current) => ({
      ...current,
      [activeSection]: {
        ...current[activeSection],
        [name]: value,
      },
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const requiredField = fieldsBySection[activeSection].find((field) => {
      if (!field.required) return false;
      return !String(activeSettings[field.name] || "").trim();
    });

    if (requiredField) {
      setError(`${requiredField.label} is required.`);
      setSuccess("");
      return;
    }

    const textField = fieldsBySection[activeSection].find((field) => {
      if (field.type === "select" || field.type === "password" || !activeSettings[field.name]) {
        return false;
      }

      if (field.type === "email") {
        return Boolean(validateEmailCom(activeSettings[field.name], field.label));
      }

      if (field.type === "number") {
        return Boolean(validateNumeric(activeSettings[field.name], field.label));
      }

      if (!humanReadableSettingsFields.has(field.name)) return false;

      return Boolean(validateText(activeSettings[field.name], field.label));
    });

    if (textField) {
      const value = activeSettings[textField.name];
      const message =
        textField.type === "email"
          ? validateEmailCom(value, textField.label)
          : textField.type === "number"
            ? validateNumeric(value, textField.label)
            : humanReadableSettingsFields.has(textField.name)
              ? validateText(value, textField.label)
              : "";
      setError(message);
      setSuccess("");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await updateBySection[activeSection](activeSettings);
      // Reload settings to confirm they were saved
      const updatedSettings = await fetchSettings();
      setSettings({
        general: { ...defaultSettings.general, ...updatedSettings.general },
        email: { ...defaultSettings.email, ...updatedSettings.email },
        sms: { ...defaultSettings.sms, ...updatedSettings.sms },
        payment: { ...defaultSettings.payment, ...updatedSettings.payment },
      });
      setSuccess(`${activeTab} saved and applied system-wide.`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (requestError) {
      setError(requestError.message || "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="sa-state">Loading settings...</div>;
  }

  return (
    <>
      <Header title="System Settings" subtitle="Configure global platform preferences." />

      <form className="sa-panel" onSubmit={handleSave} noValidate>
        <div className="sa-tabs">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab}
              className={`sa-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => {
                setActiveTab(tab);
                setError("");
                setSuccess("");
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {error ? <div className="sa-state sa-state--error">{error}</div> : null}
        {success ? <div className="sa-state">{success}</div> : null}

        <div className="sa-form-grid">
          {fieldsBySection[activeSection].map((field) => (
            <div
              className={`sa-form-field ${field.full ? "sa-form-field-full" : ""}`}
              key={`${activeSection}-${field.name}`}
            >
              <label>{field.label}</label>
              {field.type === "textarea" ? (
                <textarea name={field.name} value={activeSettings[field.name] || ""} onChange={handleChange} />
              ) : field.type === "select" ? (
                <select name={field.name} value={activeSettings[field.name] || field.options[0]} onChange={handleChange}>
                  {field.options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              ) : (
                <input
                  name={field.name}
                  type={field.type || "text"}
                  value={activeSettings[field.name] || ""}
                  onChange={handleChange}
                  required={field.required}
                />
              )}
            </div>
          ))}
        </div>

        <div className="sa-page-actions" style={{ marginTop: 14 }}>
          <button className="sa-btn sa-btn-primary" disabled={saving}>
            {saving ? "Applying..." : "Save Config"}
          </button>
        </div>
      </form>
    </>
  );
}

export default Settings;
