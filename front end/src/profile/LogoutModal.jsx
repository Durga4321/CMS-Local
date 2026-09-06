import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { LogOut } from "lucide-react";
import "./LogoutModal.css";

export function LogoutModal({
  isOpen,
  onClose,
  onConfirm,
  userName = "",
  userRole = "",
}) {
  const cancelBtnRef = useRef(null);

  // Focus Cancel button on open for safe keyboard navigation
  useEffect(() => {
    if (isOpen && cancelBtnRef.current) {
      cancelBtnRef.current.focus();
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="hc-logout-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hc-logout-title"
      aria-describedby="hc-logout-desc"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="hc-logout-modal-card">
        {/* Blood-shaded 3D teardrop emergency icon */}
        <div className="hc-logout-modal-icon-wrap">
          <div className="hc-logout-modal-droplet">
            <LogOut size={22} className="hc-logout-icon" />
          </div>
        </div>

        {/* Modal Title and Prompt */}
        <h3 id="hc-logout-title" className="hc-logout-modal-title">
          Logout?
        </h3>
        <p id="hc-logout-desc" className="hc-logout-modal-message">
          Are you sure you want to sign out of your account?
        </p>

        {/* Active Account Identity Pill */}
        {userName && (
          <div className="hc-logout-user-badge">
            <span className="hc-logout-user-dot" />
            <strong className="hc-logout-user-name">{userName}</strong>
            {userRole && <span className="hc-logout-user-role">({userRole})</span>}
          </div>
        )}

        {/* Interactive Actions */}
        <div className="hc-logout-modal-actions">
          <button
            ref={cancelBtnRef}
            type="button"
            className="hc-logout-btn hc-logout-btn--cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="hc-logout-btn hc-logout-btn--confirm"
            onClick={onConfirm}
          >
            Logout
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default LogoutModal;
