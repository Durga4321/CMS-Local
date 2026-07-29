import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
// Register service worker for PWA in production builds
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `${process.env.PUBLIC_URL || ''}/sw.js`;
    navigator.serviceWorker.register(swUrl).then((registration) => {
      // eslint-disable-next-line no-console
      console.log('ServiceWorker registered: ', registration.scope);
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('ServiceWorker registration failed: ', err);
    });
  });
}

const originalFetch = window.fetch.bind(window);
const INVALID_STATIC_TOKENS = new Set(["static-superadmin-token"]);
const API_GET_TIMEOUT_MS = 3000;
const API_MUTATION_TIMEOUT_MS = 10000;
const API_GET_CACHE_TTL_MS = 60 * 1000;
const apiResponseCache = new Map();

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

const getRequestMethod = (input, init = {}) =>
  String(
    init.method ||
      (typeof Request !== "undefined" && input instanceof Request ? input.method : "") ||
      "GET"
  ).toUpperCase();

const getRequestUrl = (input) =>
  typeof input === "string"
    ? input
    : input?.url || "";

const isApiRequest = (input) => getRequestPath(input).startsWith("/api/");

const getApiCacheKey = (input, init = {}) => {
  const url = getRequestUrl(input);
  if (!url) return "";

  const tokenScope =
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("doctorToken") ||
    localStorage.getItem("receptionistToken") ||
    "";

  return `${getRequestMethod(input, init)}:${url}:${tokenScope.slice(-16)}`;
};

const getCachedApiResponse = (cacheKey) => {
  const cached = apiResponseCache.get(cacheKey);
  if (!cached || Date.now() - cached.at > API_GET_CACHE_TTL_MS) {
    apiResponseCache.delete(cacheKey);
    return null;
  }

  return cached.response.clone();
};

const cacheApiResponse = (cacheKey, response) => {
  if (!cacheKey || !response?.ok) return;

  apiResponseCache.set(cacheKey, {
    at: Date.now(),
    response: response.clone(),
  });
};

const clearApiResponseCache = () => {
  apiResponseCache.clear();
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

  const method = getRequestMethod(input, init);
  const shouldLimitApiRequest = isApiRequest(input);
  const shouldCacheApiGet = shouldLimitApiRequest && method === "GET";
  const cacheKey = shouldCacheApiGet ? getApiCacheKey(input, init) : "";

  if (shouldLimitApiRequest && method !== "GET" && method !== "HEAD") {
    clearApiResponseCache();
  }

  const controller =
    shouldLimitApiRequest && typeof AbortController !== "undefined"
      ? new AbortController()
      : null;
  const timeoutMs =
    method === "GET" || method === "HEAD"
      ? API_GET_TIMEOUT_MS
      : API_MUTATION_TIMEOUT_MS;
  const timeoutId = controller
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : null;

  const externalSignal = init.signal;
  const abortFromExternalSignal = () => controller?.abort();
  if (externalSignal && controller) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
    }
  }

  const fetchPromise = originalFetch(input, {
    ...init,
    headers,
    ...(controller ? { signal: controller.signal } : {}),
  });

  return fetchPromise
    .then((response) => {
      if (shouldCacheApiGet) cacheApiResponse(cacheKey, response);
      return response;
    })
    .catch((error) => {
      const cachedResponse = shouldCacheApiGet ? getCachedApiResponse(cacheKey) : null;
      if (cachedResponse) return cachedResponse;
      throw error;
    })
    .finally(() => {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (externalSignal && controller) {
        externalSignal.removeEventListener("abort", abortFromExternalSignal);
      }
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
