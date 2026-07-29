import React, { useMemo, useState } from "react";
import { CalendarDays, Trash2, UsersRound } from "lucide-react";
import { markNotificationRead } from "../../pages/SUPERADMIN/superAdminApi";

function NotificationPanel({ items = [], onDelete = () => {}, onRead = () => {} }) {
  const [activeNotification, setActiveNotification] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");

  const isRead = (item = {}) => String(item.status || "").toLowerCase() === "read";
  const getNotificationKey = (item = {}) =>
    item.id || [item.title, item.message, item.targetUsers].join("|");
  const getAudienceLabel = () => "Active Admins";
  const getCreatedAt = (item = {}) => {
    const value = item.createdAt || item.date || item.timestamp;
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const filteredItems = useMemo(() => {
    if (statusFilter === "Unread") return items.filter((item) => !isRead(item));
    if (statusFilter === "Read") return items.filter(isRead);
    if (statusFilter === "Sent") return items.filter((item) => String(item.status || "").toLowerCase() === "sent");
    if (statusFilter === "Scheduled" || statusFilter === "Drafts") return [];
    return items;
  }, [items, statusFilter]);
  const unreadCount = items.filter((item) => !isRead(item)).length;
  const tabs = [
    { label: "All" },
    { label: "Unread", count: unreadCount },
    { label: "Read" },
    { label: "Sent" },
    { label: "Scheduled" },
    { label: "Drafts" },
  ];

  if (!items.length) {
    return <div className="sa-state">No notifications available.</div>;
  }

  return (
    <>
      {activeNotification ? (
        <div className="sa-notification-detail">
          <div className="sa-notification-detail-header">
            <div>
              <b>{activeNotification.title}</b>
              <span>{getAudienceLabel(activeNotification)}</span>
            </div>
            <button
              className="sa-notification-close"
              type="button"
              onClick={() => setActiveNotification(null)}
            >
              Close
            </button>
          </div>
          <p>{activeNotification.message}</p>
        </div>
      ) : null}

      <div className="sa-notification-toolbar">
        <div className="sa-notification-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.label}
              type="button"
              className={`sa-notification-tab${statusFilter === tab.label ? " active" : ""}`}
              onClick={() => setStatusFilter(tab.label)}
            >
              {tab.label}
              {tab.count ? <span>{tab.count}</span> : null}
            </button>
          ))}
        </div>
        <div className="sa-notification-audience">
          <UsersRound size={15} />
          Active Admins
        </div>
      </div>

      <div className="sa-notification-list">
        {filteredItems.map((item, index) => (
          <div className="sa-notification-item" key={getNotificationKey(item)}>
            <span className={`sa-notification-icon sa-notification-icon--${index % 4}`}>
              <CalendarDays size={22} />
            </span>
            <button
              className="sa-notification-item-btn"
              type="button"
              onClick={async () => {
                setActiveNotification(item);
                try {
                  if (item.id) await markNotificationRead(item.id);
                } catch {}
                onRead(item);
              }}
            >
              <div>
                <b>{item.title}</b>
                <p>{item.message}</p>
                <span><UsersRound size={13} /> {getAudienceLabel(item)}</span>
              </div>
            </button>
            <div className="sa-notification-actions">
              <span className={`sa-badge ${isRead(item) ? "is-muted" : "is-active"}`}>
                {isRead(item) ? "Read" : "Unread"}
              </span>
              <span className="sa-notification-date">
                <CalendarDays size={14} />
                {getCreatedAt(item)}
              </span>
              <button
                type="button"
                className="sa-delete-icon"
                onClick={() => onDelete(item)}
                aria-label="Delete notification"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {!filteredItems.length ? <div className="sa-state">No notifications match this filter.</div> : null}
      </div>
    </>
  );
}

export default NotificationPanel;

