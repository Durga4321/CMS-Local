import React, { useEffect } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";

function LabToast({ toast, onClose }) {
  useEffect(() => {
    if (!toast?.message) return undefined;
    const timeout = window.setTimeout(onClose, 3200);
    return () => window.clearTimeout(timeout);
  }, [onClose, toast]);

  if (!toast?.message) return null;

  const isSuccess = toast.type === "success";
  const Icon = isSuccess ? CheckCircle : XCircle;

  return (
    <div className={`lab-toast ${isSuccess ? "success" : "error"}`} role="status" aria-live="polite">
      <Icon size={18} />
      <span>{toast.message}</span>
      <button type="button" onClick={onClose} aria-label="Close notification">
        <X size={15} />
      </button>
    </div>
  );
}

export default LabToast;
