import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle, X, XCircle } from "lucide-react";
import "./ToastProvider.css";

const ToastContext = createContext(null);

const normalizeToast = (message, type) => {
  if (message && typeof message === "object") {
    return {
      title: message.title || message.message || (type === "error" ? "Something went wrong" : "Success"),
      description: message.description || message.subtitle || "",
    };
  }

  const title = String(message || (type === "error" ? "Something went wrong" : "Success")).trim();
  const lowerTitle = title.toLowerCase();
  const description =
    type === "success" && lowerTitle === "login successful"
      ? "Welcome back, Super Admin!"
      : "";

  return { title, description };
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = "success") => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((current) => [...current, { id, ...normalizeToast(message, type), type }]);
      window.setTimeout(() => removeToast(id), 3500);
    },
    [removeToast]
  );

  const value = useMemo(
    () => ({
      success: (message) => showToast(message, "success"),
      error: (message) => showToast(message, "error"),
      showToast,
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = toast.type === "error" ? XCircle : CheckCircle;
          return (
            <div className={`app-toast app-toast-${toast.type}`} key={toast.id}>
              <span className="app-toast-icon">
                <Icon size={18} />
              </span>
              <span className="app-toast-copy">
                <b>{toast.title}</b>
                {toast.description ? <small>{toast.description}</small> : null}
              </span>
              <button
                type="button"
                aria-label="Close notification"
                onClick={() => removeToast(toast.id)}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      success: () => {},
      error: () => {},
      showToast: () => {},
    };
  }
  return context;
};
