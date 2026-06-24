import React, { useState } from "react";

function NotificationPanel({ items = [] }) {
  const [activeNotification, setActiveNotification] = useState(null);

  if (!items.length) {
    return <div className="sa-state">No notifications available.</div>;
  }

  const isRead = (item = {}) => String(item.status || "").toLowerCase() === "read";
  const getNotificationKey = (item = {}) =>
    item.id || [item.title, item.message, item.targetUsers].join("|");

  return (
    <>
      {activeNotification ? (
        <div className="sa-notification-detail">
          <div className="sa-notification-detail-header">
            <div>
              <b>{activeNotification.title}</b>
              <span>{activeNotification.targetUsers}</span>
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

      <div className="sa-notification-list">
        {items.map((item) => (
          <button
            className="sa-notification-item"
            key={getNotificationKey(item)}
            type="button"
            onClick={() => setActiveNotification(item)}
          >
            <div>
              <b>{item.title}</b>
              <p>{item.message}</p>
              <span>{item.targetUsers}</span>
            </div>
            <span className={`sa-badge ${isRead(item) ? "is-muted" : "is-active"}`}>
              {isRead(item) ? "Read" : "Unread"}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

export default NotificationPanel;

