import React, { useEffect, useState } from "react";
import {
  Bell,
  CalendarClock,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import "./DoctorSettings.css";
import { getClinicDisplayName } from "../../utils/clinicDisplay";
import { useToast } from "../../components/ToastProvider";
import {
  validateNumeric,
  validateRequired,
  validateTimeRange,
} from "../../utils/validation";

const storageKey = "doctorSettings";

const defaultSettings = {
  appointmentDuration: "30",
  startTime: "09:00",
  endTime: "17:00",
  consultationFee: "600",
  specialtyNote: "",
  notifyAppointments: true,
  notifyReports: true,
  autoOpenConsultation: false,
};

function DoctorSettings() {
  const toast = useToast();
  const doctorName = localStorage.getItem("doctorName") || "Doctor";
  const doctorEmail = localStorage.getItem("doctorEmail") || "doctor account";
  const hospitalName = getClinicDisplayName({}, "Hospital");
  const [settings, setSettings] = useState(defaultSettings);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      setSettings({ ...defaultSettings, ...saved });
    } catch {
      setSettings(defaultSettings);
    }
  }, []);

  const updateField = (name, value) => {
    setSettings((previous) => ({
      ...previous,
      [name]: value,
    }));
    setFieldErrors((previous) => ({ ...previous, [name]: "" }));
    setMessage("");
  };

  const validateSettings = () => {
    const timeError = validateTimeRange(
      settings.startTime,
      settings.endTime,
      "Start time",
      "End time"
    );
    const nextErrors = {
      appointmentDuration: validateRequired(
        settings.appointmentDuration,
        "Appointment duration"
      ),
      startTime: timeError,
      endTime: timeError,
      consultationFee: validateNumeric(
        settings.consultationFee,
        "Consultation fee"
      ),
    };

    Object.keys(nextErrors).forEach((key) => {
      if (!nextErrors[key]) delete nextErrors[key];
    });

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const saveSettings = (event) => {
    event.preventDefault();
    if (!validateSettings()) {
      const text = "Please fix the highlighted fields.";
      setMessage(text);
      toast.error(text);
      return;
    }

    localStorage.setItem(storageKey, JSON.stringify(settings));
    setMessage("Settings saved successfully.");
    toast.success("Settings saved successfully.");
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    setFieldErrors({});
    localStorage.removeItem(storageKey);
    setMessage("Settings reset to default values.");
    toast.success("Settings reset to default values.");
  };

  return (
    <section className="doctor-settings-page">
      <div className="doctor-settings-header">
        <div>
          <h2>Settings</h2>
          <p>Manage consultation preferences, schedule defaults, and doctor alerts.</p>
        </div>
        <div className="doctor-settings-badge">
          <Settings size={17} />
          Doctor Settings
        </div>
      </div>

      <div className="doctor-settings-grid">
        <aside className="doctor-settings-profile">
          <div className="doctor-settings-avatar">
            {(doctorName || "D").charAt(0).toUpperCase()}
          </div>
          <h3>Dr. {doctorName}</h3>
          <p>{doctorEmail}</p>
          <div className="doctor-settings-meta">
            <span>
              <Stethoscope size={16} />
              Consultation
            </span>
            <span>
              <ShieldCheck size={16} />
              {hospitalName}
            </span>
          </div>
        </aside>

        <form className="doctor-settings-card" onSubmit={saveSettings} noValidate>
          <div className="doctor-settings-section-head">
            <CalendarClock size={18} />
            <div>
              <h3>Schedule Defaults</h3>
              <p>These values are used as your preferred clinic timings.</p>
            </div>
          </div>

          <div className="doctor-settings-form-grid">
            <label>
              <span>Appointment Duration</span>
              <select
                value={settings.appointmentDuration}
                onChange={(event) => updateField("appointmentDuration", event.target.value)}
                className={fieldErrors.appointmentDuration ? "is-invalid" : ""}
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
              </select>
              {fieldErrors.appointmentDuration ? (
                <small className="doctor-settings-field-error">
                  {fieldErrors.appointmentDuration}
                </small>
              ) : null}
            </label>
            <label>
              <span>Start Time</span>
              <input
                type="time"
                value={settings.startTime}
                onChange={(event) => updateField("startTime", event.target.value)}
                className={fieldErrors.startTime ? "is-invalid" : ""}
              />
              {fieldErrors.startTime ? (
                <small className="doctor-settings-field-error">{fieldErrors.startTime}</small>
              ) : null}
            </label>
            <label>
              <span>End Time</span>
              <input
                type="time"
                value={settings.endTime}
                onChange={(event) => updateField("endTime", event.target.value)}
                className={fieldErrors.endTime ? "is-invalid" : ""}
              />
              {fieldErrors.endTime ? (
                <small className="doctor-settings-field-error">{fieldErrors.endTime}</small>
              ) : null}
            </label>
            <label>
              <span>Consultation Fee</span>
              <input
                type="number"
                min="0"
                value={settings.consultationFee}
                readOnly
                aria-readonly="true"
                className={fieldErrors.consultationFee ? "is-invalid" : ""}
              />
              {fieldErrors.consultationFee ? (
                <small className="doctor-settings-field-error">
                  {fieldErrors.consultationFee}
                </small>
              ) : null}
            </label>
          </div>

          <label className="doctor-settings-wide-field">
            <span>Default Consultation Note</span>
            <textarea
              value={settings.specialtyNote}
              onChange={(event) => updateField("specialtyNote", event.target.value)}
              placeholder="Add a short default instruction or note..."
            />
          </label>

          <div className="doctor-settings-section-head">
            <Bell size={18} />
            <div>
              <h3>Alerts</h3>
              <p>Choose the alerts visible in your doctor dashboard.</p>
            </div>
          </div>

          <div className="doctor-settings-toggles">
            <label>
              <input
                type="checkbox"
                checked={settings.notifyAppointments}
                onChange={(event) => updateField("notifyAppointments", event.target.checked)}
              />
              <span>New appointment alerts</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.notifyReports}
                onChange={(event) => updateField("notifyReports", event.target.checked)}
              />
              <span>Lab report alerts</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.autoOpenConsultation}
                onChange={(event) => updateField("autoOpenConsultation", event.target.checked)}
              />
              <span>Open consultation screen after selecting patient</span>
            </label>
          </div>

          {message ? <p className="doctor-settings-message">{message}</p> : null}

          <div className="doctor-settings-actions">
            <button type="button" className="doctor-settings-reset" onClick={resetSettings}>
              <RotateCcw size={16} /> Reset
            </button>
            <button type="submit" className="doctor-settings-save">
              <Save size={16} /> Save Settings
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default DoctorSettings;

