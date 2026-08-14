import { apiUrl } from "../config/api";
import { getLabToken } from "./labSession";

export const parseList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.tests)) return data.tests;
  if (Array.isArray(data?.samples)) return data.samples;
  if (Array.isArray(data?.patients)) return data.patients;
  return [];
};

const formatErrorData = (data, fallback) => {
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.map((item) => formatErrorData(item, "")).filter(Boolean).join(", ") || fallback;

  const directMessage =
    data.message ||
    data.Message ||
    data.title ||
    data.Title ||
    data.detail ||
    data.Detail ||
    data.error ||
    data.Error;

  if (typeof directMessage === "string" && directMessage.trim()) return directMessage;

  const errors = data.errors || data.Errors;
  if (errors && typeof errors === "object") {
    const messages = Object.entries(errors).flatMap(([field, value]) => {
      const values = Array.isArray(value) ? value : [value];
      return values
        .map((item) => (typeof item === "string" ? item : formatErrorData(item, "")))
        .filter(Boolean)
        .map((message) => (field ? `${field}: ${message}` : message));
    });
    if (messages.length) return messages.join(", ");
  }

  try {
    return JSON.stringify(data);
  } catch {
    return fallback;
  }
};

export const requestJson = async (path, options = {}) => {
  const token = getLabToken();
  const response = await fetch(apiUrl(String(path || "").replace(/^\/+/, "")), {
    ...options,
    headers: {
      "ngrok-skip-browser-warning": "true",
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) throw new Error(formatErrorData(data, `Request failed with status ${response.status}`));
  return data;
};

export const firstSuccessfulList = async (paths = []) => {
  let lastError = null;
  for (const path of paths) {
    try {
      return parseList(await requestJson(path));
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  return [];
};

export const downloadBlob = async (path, filename = "lab-export") => {
  const token = getLabToken();
  const response = await fetch(apiUrl(String(path || "").replace(/^\/+/, "")), {
    headers: {
      "ngrok-skip-browser-warning": "true",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let data = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    throw new Error(formatErrorData(data, `Download failed with status ${response.status}`));
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const postFile = async (path, file) => {
  const body = new FormData();
  body.append("file", file);
  return requestJson(path, { method: "POST", body });
};
