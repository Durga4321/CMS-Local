import React, { useEffect, useRef, useState } from "react";
import { Megaphone, Send } from "lucide-react";
import Header from "../../../components/superadmin/Header";
import NotificationPanel from "../../../components/superadmin/NotificationPanel";
import {
  createNotification,
  fetchNotificationTargetOptions,
  fetchNotificationStats,
  fetchNotifications,
  deleteNotification,
} from "../superAdminApi";
import { validateSelected, validateText } from "../../../utils/validation";

const defaultTargetOptions = [
  { value: "Active Admins", label: "Active Admins" },
];

const getCurrentUserKey = () =>
  [
    localStorage.getItem("userEmail"),
    localStorage.getItem("adminEmail"),
    localStorage.getItem("doctorEmail"),
    localStorage.getItem("receptionistEmail"),
    localStorage.getItem("email"),
    localStorage.getItem("superAdminRole"),
    localStorage.getItem("adminRole"),
    localStorage.getItem("doctorRole"),
    localStorage.getItem("receptionistRole"),
    localStorage.getItem("userRole"),
  ]
    .filter(Boolean)
    .join("_")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_") || "current_user";

const getDeletedStorageKey = () => `deleted_notifications_${getCurrentUserKey()}`;
const getReadStorageKey = () => `read_notifications_${getCurrentUserKey()}`;

const getNotificationKey = (notification = {}) =>
  String(
    notification.id ||
      [notification.title, notification.message, notification.targetUsers, notification.createdAt].join("|")
  );

const readDeletedNotificationKeys = () => {
  try {
    const value = JSON.parse(localStorage.getItem(getDeletedStorageKey()) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const saveDeletedNotificationKey = (notification = {}) => {
  const key = getNotificationKey(notification);
  const keys = new Set(readDeletedNotificationKeys());
  keys.add(key);
  localStorage.setItem(getDeletedStorageKey(), JSON.stringify(Array.from(keys)));
};

const isDeletedNotification = (notification = {}) => {
  const keys = new Set(readDeletedNotificationKeys());
  return keys.has(getNotificationKey(notification));
};

const emptyNotification = {
  title: "",
  targetUsers: "Active Admins",
  message: "",
};

const readNotificationKeys = () => {
  try {
    const value = JSON.parse(localStorage.getItem(getReadStorageKey()) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const saveReadNotificationKey = (notification = {}) => {
  const key = getNotificationKey(notification);
  const keys = new Set(readNotificationKeys());
  keys.add(key);
  localStorage.setItem(getReadStorageKey(), JSON.stringify(Array.from(keys)));
};

function Notifications() {
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [form, setForm] = useState(emptyNotification);
  const [loading, setLoading] = useState(true);
  const [targetOptions, setTargetOptions] = useState(defaultTargetOptions);
  const [stats, setStats] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const loadNotifications = async () => {
    setLoading(true);
    setError("");

    try {
      const items = await fetchNotifications();
      fetchNotificationStats()
        .then(setStats)
        .catch(() => setStats(null));

      // apply same visibility rules as the popup (only show sent/read and matching role)
      const getCurrentRole = () =>
        localStorage.getItem("superAdminRole") ||
        localStorage.getItem("adminRole") ||
        localStorage.getItem("doctorRole") ||
        localStorage.getItem("receptionistRole") ||
        localStorage.getItem("userRole") ||
        "";

      const normalizeRole = (role = "") => String(role).trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

      const matchesTargetUsers = (notification = {}, role = "") => {
        const target = String(notification.targetUsers || "active admins").trim().toLowerCase();
        const r = normalizeRole(role);

        if (!target) return true;

        if (target.includes("all active user") || target === "active users") {
          return ["admin", "clinicadmin"].includes(r);
        }

        if (target.includes("admin")) return ["admin", "clinicadmin"].includes(r);
        if (target.includes("doctor")) return r === "doctor";
        if (target.includes("receptionist") || target.includes("reception")) return r === "receptionist";
        if (target.includes("user") || target.includes("patient")) return ["user", "patient"].includes(r);

        return true;
      };

      const isSentNotification = (notification = {}) =>
        String(notification.status || "").toLowerCase() === "sent";

      const isReadNotification = (notification = {}) =>
        String(notification.status || "").toLowerCase() === "read";

      const isUnreadNotification = (notification = {}) =>
        !isSentNotification(notification) && !isReadNotification(notification);

      const isVisibleNotification = (notification = {}) =>
        isSentNotification(notification) || isReadNotification(notification) || isUnreadNotification(notification);

      const role = normalizeRole(getCurrentRole());
      const isSuper = role === "superadmin";

      const filtered = items.filter(
        (it) => !isDeletedNotification(it) && isVisibleNotification(it) && (isSuper || matchesTargetUsers(it, role))
      );
      const readKeys = new Set(readNotificationKeys());

      setNotifications(
        filtered.map((item) =>
          readKeys.has(getNotificationKey(item)) && String(item.status || "").toLowerCase() !== "read"
            ? { ...item, status: "Read" }
            : item
        )
      );
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
        const adminOptions = options.filter((option) =>
          String(option.value || option.label || "").toLowerCase().includes("admin")
        );
        setTargetOptions(adminOptions.length ? adminOptions : defaultTargetOptions);
      } catch {
        setTargetOptions(defaultTargetOptions);
      }
    };

    loadTargetOptions();
  }, []);

  useEffect(() => {
    const handleNotificationRead = (event) => {
      const readKey = event.detail?.key;
      if (!readKey) return;

      setNotifications((current) =>
        current.map((item) =>
          getNotificationKey(item) === readKey ? { ...item, status: "Read" } : item
        )
      );
    };

    window.addEventListener("cms:notification-read", handleNotificationRead);
    return () => window.removeEventListener("cms:notification-read", handleNotificationRead);
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
          <button
            className="sa-btn sa-btn-primary"
            onClick={() => {
              setShowForm(true);
              window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
            }}
          >
            <Send size={16} />
            Send Notification
          </button>
        }
      />

      {showForm ? (
        <div className="sa-form-card sa-notification-send-card" style={{ marginBottom: 16 }} ref={formRef}>
          <div className="sa-notification-send-header">
            <span className="sa-notification-send-icon">
              <Megaphone size={22} />
            </span>
            <div>
              <h3>Send Notification</h3>
              <p>Compose a message from Super Admin to the selected audience.</p>
            </div>
          </div>
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
        <p>
          Recent messages and delivery status
          {stats ? ` · ${Number(stats.total || stats.totalNotifications || notifications.length) || notifications.length} total` : ""}.
        </p>
        {loading ? <div className="sa-state">Loading notifications...</div> : null}
        {!loading && error && !showForm ? <div className="sa-state sa-state--error">{error}</div> : null}
        {!loading && !error ? (
          <NotificationPanel
              items={notifications}
              onDelete={async (item) => {
                try {
                  if (item.id) await deleteNotification(item.id);
                } catch (err) {
                  // still hide the notification for this user if remote delete fails
                  saveDeletedNotificationKey(item);
                }
                saveDeletedNotificationKey(item);
                setNotifications((current) => current.filter((n) => getNotificationKey(n) !== getNotificationKey(item)));
              }}
              onRead={(item) => {
                saveReadNotificationKey(item);
                setNotifications((current) =>
                  current.map((n) =>
                    getNotificationKey(n) === getNotificationKey(item) ? { ...n, status: "Read" } : n
                  )
                );
              }}
            />
        ) : null}
      </div>
    </>
  );
}

export default Notifications;
