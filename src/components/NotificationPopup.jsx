import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fetchNotifications, markNotificationRead, deleteNotification } from "../pages/SUPERADMIN/superAdminApi";
import { Trash2 } from "lucide-react";
import "./NotificationPopup.css";

const getCurrentRole = () =>
  localStorage.getItem("superAdminRole") ||
  localStorage.getItem("adminRole") ||
  localStorage.getItem("doctorRole") ||
  localStorage.getItem("receptionistRole") ||
  localStorage.getItem("userRole") ||
  "";

const normalizeRole = (role = "") =>
  String(role).trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const getCurrentUserKey = () =>
  [
    localStorage.getItem("userEmail"),
    localStorage.getItem("adminEmail"),
    localStorage.getItem("doctorEmail"),
    localStorage.getItem("receptionistEmail"),
    localStorage.getItem("email"),
    getCurrentRole(),
  ]
    .filter(Boolean)
    .join("_")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_") || "current_user";

const getReadStorageKey = () => `read_notifications_${getCurrentUserKey()}`;

const getNotificationKey = (notification = {}) =>
  String(
    notification.id ||
    [
      notification.title,
      notification.message,
      notification.targetUsers,
      notification.createdAt,
    ].join("|")
  );

const readNotificationKeys = () => {
  try {
    const value = JSON.parse(localStorage.getItem(getReadStorageKey()) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const saveReadNotificationKey = (notification) => {
  const key = getNotificationKey(notification);
  const keys = new Set(readNotificationKeys());
  keys.add(key);
  localStorage.setItem(getReadStorageKey(), JSON.stringify(Array.from(keys)));
};

const isSentNotification = (notification = {}) =>
  String(notification.status || "").toLowerCase() === "sent";

const isReadNotification = (notification = {}) =>
  String(notification.status || "").toLowerCase() === "read";

const getStatusLabel = (notification = {}) =>
  isReadNotification(notification) ? "Read" : "Unread";

const isVisibleNotification = (notification = {}) =>
  isSentNotification(notification) || isReadNotification(notification);

const ADMIN_ROLES = ["admin", "clinicadmin"];
const ACTIVE_USER_ROLES = [
  ...ADMIN_ROLES,
  "doctor",
  "receptionist",
  "user",
  "patient",
];

const matchesTargetUsers = (notification = {}, role = "") => {
  const target = String(notification.targetUsers || "all active users").trim().toLowerCase();
  const r = normalizeRole(role);

  if (!target) return true;

  if (target.includes("all active user") || target === "active users") {
    return ACTIVE_USER_ROLES.includes(r);
  }

  if (target.includes("admin")) {
    return ADMIN_ROLES.includes(r);
  }

  if (target.includes("doctor")) {
    return r === "doctor";
  }

  if (target.includes("receptionist") || target.includes("reception")) {
    return r === "receptionist";
  }

  if (target.includes("user") || target.includes("patient")) {
    return ["user", "patient"].includes(r);
  }

  // fallback: show to everyone
  return true;
};

function NotificationPopup({ isSuperAdmin = false }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [activeNotification, setActiveNotification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef(null);
  const navigate = useNavigate();
  const role = useMemo(() => normalizeRole(getCurrentRole()), []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const items = await fetchNotifications();
      const readKeys = new Set(readNotificationKeys());
      const filtered = items
        .filter((item) => isVisibleNotification(item) && (isSuperAdmin || matchesTargetUsers(item, role)))
        .map((item) =>
          readKeys.has(getNotificationKey(item)) && !isReadNotification(item)
            ? { ...item, status: "Read" }
            : item
        );
      setNotifications(filtered);
    } catch (requestError) {
      setError(requestError.message || "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    loadNotifications();

    const interval = window.setInterval(() => {
      loadNotifications();
    }, 30000);

    const onFocus = () => loadNotifications();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadNotifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const visibleNotifications = notifications;
  const notificationCount = visibleNotifications.filter((item) => !isReadNotification(item)).length;

  const handleToggle = () => {
    setOpen((current) => !current);
  };

  const handleViewAll = () => {
    setOpen(false);
    if (isSuperAdmin) {
      navigate("/superadmin/notifications");
    }
  };

  return (
    <div className="notification-popup" ref={ref}>
      <button
        type="button"
        className="notification-trigger"
        onClick={handleToggle}
        aria-label="Open notifications"
      >
        <Bell size={18} />
        {notificationCount > 0 ? (
          <span className="notification-badge">
            {notificationCount > 99 ? "99+" : notificationCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <span>Notifications</span>
            {isSuperAdmin ? (
              <button
                type="button"
                className="notification-view-all"
                onClick={handleViewAll}
              >
                View All
                <ExternalLink size={14} />
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="notification-empty">Loading notifications...</div>
          ) : error ? (
            <div className="notification-empty notification-error">{error}</div>
          ) : visibleNotifications.length === 0 && !activeNotification ? (
            <div className="notification-empty">No notifications available.</div>
          ) : (
            <div className="notification-items">
              <div className="notification-list">
                {visibleNotifications.map((item) => (
                  <button
                    type="button"
                    key={getNotificationKey(item)}
                    className={`notification-item-button ${
                      activeNotification &&
                      getNotificationKey(activeNotification) === getNotificationKey(item)
                        ? "is-active"
                        : ""
                    }`}
                    onClick={async () => {
                      const readItem = { ...item, status: "Read" };
                      setActiveNotification(readItem);
                      saveReadNotificationKey(item);
                      try {
                        if (item.id) await markNotificationRead(item.id);
                      } catch {}
                      setNotifications((current) =>
                        current.map((n) =>
                          getNotificationKey(n) === getNotificationKey(item)
                            ? { ...n, status: "Read" }
                            : n
                        )
                      );
                    }}
                  >
                    <div>
                      <b>{item.title}</b>
                      <p>{item.message}</p>
                    </div>
                    <span
                      className={`notification-status ${
                        isReadNotification(item) ? "is-muted" : "is-active"
                      }`}
                    >
                      {getStatusLabel(item)}
                    </span>
                  </button>
                ))}
                {!visibleNotifications.length ? (
                  <div className="notification-empty">No notifications available.</div>
                ) : null}
              </div>

              <div className="notification-detail">
                {activeNotification ? (
                  <>
                    <div className="notification-detail-header">
                      <div>
                        <h4>{activeNotification.title}</h4>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button
                          type="button"
                          className="notification-close"
                          onClick={() => setActiveNotification(null)}
                        >
                          Close
                        </button>
                        <button
                          type="button"
                          className="notification-delete-icon"
                          onClick={async () => {
                            try {
                              if (activeNotification?.id) await deleteNotification(activeNotification.id);
                              setNotifications((current) => current.filter((n) => getNotificationKey(n) !== getNotificationKey(activeNotification)));
                              setActiveNotification(null);
                            } catch {}
                          }}
                          aria-label="Delete notification"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <p>{activeNotification.message}</p>
                  </>
                ) : (
                  <div className="notification-detail-empty">
                    Select a message to view its full content.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default NotificationPopup;
