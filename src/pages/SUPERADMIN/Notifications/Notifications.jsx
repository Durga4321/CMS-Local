import React, { useEffect, useState } from "react";
import { Send } from "lucide-react";
import Header from "../../../components/superadmin/Header";
import NotificationPanel from "../../../components/superadmin/NotificationPanel";
import {
  createNotification,
  fetchNotificationTargetOptions,
  fetchNotifications,
} from "../superAdminApi";
import { validateSelected, validateText } from "../../../utils/validation";

const defaultTargetOptions = [
  { value: "All Active Users", label: "All Active Users" },
  { value: "Active Admins", label: "Active Admins" },
];

const emptyNotification = {
  title: "",
  targetUsers: "All Active Users",
  message: "",
};

function Notifications() {
  const [showForm, setShowForm] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [form, setForm] = useState(emptyNotification);
  const [loading, setLoading] = useState(true);
  const [targetOptions, setTargetOptions] = useState(defaultTargetOptions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const loadNotifications = async () => {
    setLoading(true);
    setError("");

    try {
      setNotifications(await fetchNotifications());
    } catch (requestError) {
      setError(requestError.message || "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();

    const loadTargetOptions = async () => {
      try {
        const options = await fetchNotificationTargetOptions();
        setTargetOptions(options.length ? options : defaultTargetOptions);
      } catch {
        setTargetOptions(defaultTargetOptions);
      }
    };

    loadTargetOptions();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
    setError("");
  };

  const handleSubmit = async () => {
    const nextErrors = {
      title: validateText(form.title, "Title"),
      targetUsers: validateSelected(form.targetUsers, "target users"),
      message: validateText(form.message, "Message"),
    };

    Object.keys(nextErrors).forEach((key) => {
      if (!nextErrors[key]) delete nextErrors[key];
    });

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      setError("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await createNotification({ ...form, status: "Sent" });
      setForm(emptyNotification);
      setFieldErrors({});
      setShowForm(false);
      await loadNotifications();
    } catch (requestError) {
      setError(requestError.message || "Unable to save notification.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Header
        title="Notifications"
        subtitle="Create and send platform notifications."
        action={
          <button className="sa-btn sa-btn-primary" onClick={() => setShowForm((value) => !value)}>
            <Send size={16} />
            Send Notification
          </button>
        }
      />

      {showForm ? (
        <div className="sa-form-card" style={{ marginBottom: 16 }}>
          {error ? <div className="sa-state sa-state--error">{error}</div> : null}
          <div className="sa-form-grid">
            <div className="sa-form-field">
              <label>Title</label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Notification title"
                className={fieldErrors.title ? "is-invalid" : ""}
                required
              />
              {fieldErrors.title ? <span className="sa-field-error">{fieldErrors.title}</span> : null}
            </div>
            <div className="sa-form-field">
              <label>Target Users</label>
              <select
                name="targetUsers"
                value={form.targetUsers}
                onChange={handleChange}
                className={fieldErrors.targetUsers ? "is-invalid" : ""}
              >
                {targetOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.count !== undefined
                      ? `${option.label} (${option.count})`
                      : option.label}
                  </option>
                ))}
              </select>
              {fieldErrors.targetUsers ? <span className="sa-field-error">{fieldErrors.targetUsers}</span> : null}
            </div>
            <div className="sa-form-field sa-form-field-full">
              <label>Message</label>
              <textarea
                name="message"
                value={form.message}
                onChange={handleChange}
                placeholder="Write the notification message"
                className={fieldErrors.message ? "is-invalid" : ""}
                required
              />
              {fieldErrors.message ? <span className="sa-field-error">{fieldErrors.message}</span> : null}
            </div>
          </div>
          <div className="sa-page-actions" style={{ marginTop: 14 }}>
            <button className="sa-btn sa-btn-primary" type="button" disabled={saving} onClick={handleSubmit}>
              {saving ? "Sending..." : "Send Now"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="sa-panel">
        <h3>Notification List</h3>
        <p>Recent messages and delivery status.</p>
        {loading ? <div className="sa-state">Loading notifications...</div> : null}
        {!loading && error && !showForm ? <div className="sa-state sa-state--error">{error}</div> : null}
        {!loading && !error ? <NotificationPanel items={notifications} /> : null}
      </div>
    </>
  );
}

export default Notifications;
