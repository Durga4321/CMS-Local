import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const originalFetch = window.fetch.bind(window);
const INVALID_STATIC_TOKENS = new Set(["static-superadmin-token"]);

const clearInvalidStoredTokens = () => {
  [
    "token",
    "adminToken",
    "doctorToken",
    "receptionistToken",
  ].forEach((key) => {
    if (INVALID_STATIC_TOKENS.has(localStorage.getItem(key))) {
      localStorage.removeItem(key);
    }
  });
};

const getRequestPath = (input) => {
  const url =
    typeof input === "string"
      ? input
      : input?.url;

  if (!url) {
    return "";
  }

  try {
    return new URL(url, window.location.origin).pathname.toLowerCase();
  } catch {
    return "";
  }
};

const PUBLIC_AUTH_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/forgot-password",
  "/api/auth/verify-otp",
  "/api/auth/reset-password",
]);

const isPublicAuthRequest = (input) => {
  const path = getRequestPath(input);
  return PUBLIC_AUTH_PATHS.has(path);
};

window.fetch = (input, init = {}) => {
  clearInvalidStoredTokens();

  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("doctorToken") ||
    localStorage.getItem("receptionistToken");

  const requestHeaders =
    typeof Request !== "undefined" &&
    input instanceof Request
      ? input.headers
      : undefined;

  const headers = new Headers(
    init.headers ||
    requestHeaders ||
    {}
  );

  headers.set(
    "ngrok-skip-browser-warning",
    "true"
  );

  const hasAuthorization = headers.has("Authorization");

  if (isPublicAuthRequest(input)) {
    headers.delete("Authorization");
  } else if (token && !hasAuthorization) {
    headers.set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  return originalFetch(input, {
    ...init,
    headers,
  });
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
