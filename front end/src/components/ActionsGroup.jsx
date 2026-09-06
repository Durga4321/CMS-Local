import React, { useState } from "react";
import { Eye, Syringe, HeartPulse, Scissors } from "lucide-react";
import { StatusToggle } from "./StatusToggle";
import "./ActionsGroup.css";

export const MobileToggleRight = ({ size = 20, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="2" y="6" width="20" height="12" rx="6" ry="6" />
    <circle cx="16" cy="12" r="3" />
  </svg>
);

export const MobileToggleLeft = ({ size = 20, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="2" y="6" width="20" height="12" rx="6" ry="6" />
    <circle cx="8" cy="12" r="3" />
  </svg>
);

export const ActionsGroup = ({
  rowId,
  onView,
  onEdit,
  onStatus,
  onDelete,
  canView = true,
  canEdit = true,
  canStatus = true,
  canDelete = true,
  statusChecked = false,
  useToggleSwitch = false,
  statusDisabled = false,
  statusIcon,
  statusTitle,
  activeActionState,
  setActiveActionState,
}) => {
  const [activeEffect, setActiveEffect] = useState(null);

  const isRowActive = activeActionState?.rowId === rowId;
  const currentAction = isRowActive ? activeActionState?.action : null;
  const isEnabled = Boolean(statusChecked);

  const defaultStatusTitle = isEnabled ? "Active Status (Click to Disable)" : "Disabled Status (Click to Enable)";
  const defaultStatusAria = isEnabled ? "Disable item" : "Enable item";

  const handleAction = (actionName, handler) => (e) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    setActiveEffect(actionName);
    setTimeout(() => {
      setActiveEffect((current) => (current === actionName ? null : current));
    }, 650);

    if (setActiveActionState) {
      setActiveActionState({ rowId, action: actionName });
    }
    if (handler) {
      handler(e);
    }
  };

  return (
    <div className="actions-group">
      {canView && (
        <button
          type="button"
          className={`action-btn medical-instrument-btn view-instrument-btn ${
            activeEffect === "view" || currentAction === "view" ? "is-effecting effect-eye" : ""
          }`}
          title="View Details"
          aria-label="View Details"
          onClick={handleAction("view", onView)}
        >
          <span className="instrument-led led-blue" />
          <span className="instrument-ripple" />
          <Eye size={18} className="instrument-icon icon-eye" />
        </button>
      )}

      {canEdit && (
        <button
          type="button"
          className={`action-btn medical-instrument-btn edit-instrument-btn ${
            activeEffect === "edit" || currentAction === "edit" ? "is-effecting effect-syringe" : ""
          }`}
          title="Edit Record"
          aria-label="Edit Record"
          onClick={handleAction("edit", onEdit)}
        >
          <span className="instrument-led led-purple" />
          <span className="instrument-ripple" />
          <Syringe size={18} className="instrument-icon icon-syringe" />
        </button>
      )}

      {canStatus && (
        useToggleSwitch ? (
          <StatusToggle
            checked={isEnabled}
            onChange={(newVal, e) => handleAction("status", onStatus)(e)}
            disabled={statusDisabled}
            title={statusTitle || defaultStatusTitle}
          />
        ) : (
          <button
            type="button"
            className={`action-btn medical-instrument-btn status-instrument-btn ${
              isEnabled ? "status-enabled" : "status-disabled"
            } ${activeEffect === "status" || currentAction === "status" ? "is-effecting effect-heartpulse" : ""}`}
            title={statusTitle || defaultStatusTitle}
            aria-label={statusTitle || defaultStatusAria}
            onClick={handleAction("status", onStatus)}
            disabled={statusDisabled}
          >
            <span className={`instrument-led ${isEnabled ? "led-green" : "led-red"}`} />
            <span className="instrument-ripple" />
            {statusIcon ? (
              React.createElement(statusIcon, { size: 19, className: "instrument-icon" })
            ) : (
              <HeartPulse size={19} className="instrument-icon icon-heartpulse" />
            )}
          </button>
        )
      )}

      {canDelete && (
        <button
          type="button"
          className={`action-btn medical-instrument-btn delete-instrument-btn ${
            activeEffect === "delete" || currentAction === "delete" ? "is-effecting effect-scissors" : ""
          }`}
          title="Delete Record"
          aria-label="Delete Record"
          onClick={handleAction("delete", onDelete)}
        >
          <span className="instrument-led led-red" />
          <span className="instrument-ripple" />
          <Scissors size={18} className="instrument-icon icon-scissors" />
        </button>
      )}
    </div>
  );
};

export default ActionsGroup;
