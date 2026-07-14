import { apiUrl } from "../config/api";
import { getReceptionToken } from "./receptionSession";

export const receptionApiUrl = (path) => apiUrl(path);

export const parseList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

export const requestJson = async (path, options = {}) => {
  const token = getReceptionToken();
  const headers = {
    "ngrok-skip-browser-warning": "true",
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(receptionApiUrl(path), {
    ...options,
    headers,
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

  if (!response.ok) {
    const validationMessage =
      data?.errors && typeof data.errors === "object"
        ? Object.entries(data.errors)
            .flatMap(([key, messages]) => {
              const list = Array.isArray(messages) ? messages : [messages];
              return list.filter(Boolean).map((message) => `${key}: ${message}`);
            })
            .join(" ")
        : "";
    const message =
      data?.message ||
      validationMessage ||
      data?.title ||
      (typeof data === "string" ? data : "") ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
};

export const formatToday = () => new Date().toISOString().slice(0, 10);

