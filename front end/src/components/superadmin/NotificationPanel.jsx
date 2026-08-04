import React, { useMemo, useState } from "react";
import { BellRing, CalendarDays, CheckCircle2, CreditCard, Megaphone, Send, Trash2 } from "lucide-react";
import { markNotificationRead } from "../../pages/SUPERADMIN/superAdminApi";

function NotificationPanel({ items = [], onDelete = () => {}, onRead = () => {} }) {
  const [activeNotification, setActiveNotification] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");

  const isRead = (item = {}) => String(item.status || "").toLowerCase() === "read";
  const isSent = (item = {}) => String(item.status || "").toLowerCase() === "sent";
  const getNotificationKey = (item = {}) =>
    item.id || [item.title, item.message, item.targetUsers].join("|");
  const getNotificationTone = (item = {}, index = 0) => {
    const text = `${item.title || ""} ${item.message || ""}`.toLowerCase();
    if (text.includes("payment") || text.includes("paid") || text.includes("invoice") || text.includes("bill")) {
      return { tone: "payment", Icon: CreditCard };
    }
    if (text.includes("maintenance") || text.includes("system") || text.includes("notice") || text.includes("alert")) {
      return { tone: "system", Icon: Megaphone };
    }
    if (text.includes("cancel")) {
      return { tone: "cancelled", Icon: CalendarDays };
    }
    if (text.includes("appointment") || text.includes("booked") || text.includes("schedule")) {
      return { tone: `appointment-${index % 4}`, Icon: CalendarDays };
    }
    if (isSent(item)) return { tone: "sent", Icon: Megaphone };
    if (isRead(item)) return { tone: "read", Icon: CheckCircle2 };
    return { tone: "default", Icon: BellRing };
  };
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
    if (statusFilter === "Unread") return items.filter((item) => !isRead(item) && !isSent(item));
    if (statusFilter === "Read") return items.filter((item) => isRead(item) && !isSent(item));
    if (statusFilter === "Sent") return items.filter(isSent);
    return items;
  }, [items, statusFilter]);
  const unreadCount = items.filter((item) => !isRead(item) && !isSent(item)).length;
  const sentCount = items.filter(isSent).length;
  const tabs = [
    { label: "All", tone: "all", icon: BellRing },
    { label: "Unread", count: unreadCount, tone: "unread", icon: BellRing },
    { label: "Read", tone: "read", icon: CheckCircle2 },
    { label: "Sent", count: sentCount, tone: "sent", icon: Send },
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
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            return (
            <button
              key={tab.label}
              type="button"
              className={`sa-notification-tab sa-notification-tab--${tab.tone}${statusFilter === tab.label ? " active" : ""}`}
              onClick={() => setStatusFilter(tab.label)}
            >
              <TabIcon size={14} />
              {tab.label}
              {tab.count ? <span>{tab.count}</span> : null}
            </button>
            );
          })}
        </div>
      </div>

      <div className="sa-notification-list">
        {filteredItems.map((item, index) => {
          const { tone, Icon } = getNotificationTone(item, index);
          return (
          <div className={`sa-notification-item sa-notification-item--${tone}`} key={getNotificationKey(item)}>
            <span className={`sa-notification-icon sa-notification-icon--${tone}`}>
              <Icon size={22} />
            </span>
            <button
              className="sa-notification-item-btn"
              type="button"
              onClick={async () => {
                setActiveNotification(item);
                if (!isSent(item)) {
                  try {
                    if (item.id) await markNotificationRead(item.id);
                  } catch {}
                  onRead(item);
                }
              }}
            >
              <div>
                <b>{item.title}</b>
                <p>{item.message}</p>
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
          );
        })}
        {!filteredItems.length ? <div className="sa-state">No notifications match this filter.</div> : null}
      </div>
    </>
  );
}

export default NotificationPanel;

