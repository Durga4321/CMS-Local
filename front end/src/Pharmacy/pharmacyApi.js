import { API_ENDPOINTS, apiUrl, replacePathParams } from "../config/api";
import { getPharmacistToken } from "./pharmacySession";

export const field = (record, ...keys) => {
  for (const key of keys) {
    const actual = Object.keys(record || {}).find((name) => name.toLowerCase() === key.toLowerCase());
    if (actual && record[actual] !== null && record[actual] !== undefined) return record[actual];
  }
  return "";
};
export function collection(payload, keys = []) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return null;
  for (const key of [...keys, "data", "items", "results", "records", "$values"]) {
    const nested = field(payload, key);
    if (nested && nested !== payload) {
      const result = collection(nested, keys);
      if (result) return result;
    }
  }
  return null;
}
export const unwrap = (payload) => field(payload, "data") || payload;
export async function pharmacyRequest(path, { method = "GET", body, params } = {}) {
  const token = getPharmacistToken();
  if (!token) throw new Error("Your pharmacist session is missing. Sign in again.");
  const response = await fetch(apiUrl(replacePathParams(path, params)), {
    method, cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "ngrok-skip-browser-warning": "true", ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!response.ok) {
    const validation = field(payload, "errors");
    const message = field(payload, "message", "detail", "error", "title") || (validation && Object.values(validation).flat().join(" ")) || (typeof payload === "string" ? payload : "");
    throw new Error(message || (response.status === 403 ? "Your account does not have billing permission. Billing APIs require an authorized billing role." : `Request failed (HTTP ${response.status}).`));
  }
  return payload;
}
export { API_ENDPOINTS };
