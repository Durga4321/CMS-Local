import {
  API_ENDPOINTS,
  apiUrl,
  replacePathParams
} from "../config/api";
 
import {
  getPharmacistToken
} from "./pharmacySession";
 
// Get a field from an object (case-insensitive).
export const field = (record, ...keys) => {
  for (const key of keys) {
    const actual = Object.keys(record || {}).find(
      (name) => name.toLowerCase() === key.toLowerCase()
    );
 
    if (
      actual &&
      record[actual] !== null &&
      record[actual] !== undefined
    ) {
      return record[actual];
    }
  }
 
  return "";
};
 
// Extract arrays from different backend response formats.
export function collection(payload, keys = []) {
  if (Array.isArray(payload)) {
    return payload;
  }
 
  if (!payload || typeof payload !== "object") {
    return null;
  }
 
  for (const key of [
    ...keys,
    "data",
    "items",
    "results",
    "records",
    "$values"
  ]) {
    const nested = field(payload, key);
 
    if (nested && nested !== payload) {
      const result = collection(nested, keys);
 
      if (result) {
        return result;
      }
    }
  }
 
  return null;
}
 
// Unwrap common API response envelopes.
export const unwrap = (payload) =>
  field(payload, "data") || payload;
 
// Custom API error with HTTP status.
export class PharmacyApiError extends Error {
  constructor(message, status, payload = null) {
    super(message);
 
    this.name = "PharmacyApiError";
    this.status = status;
    this.payload = payload;
  }
}
 
// Build a readable error message from backend responses.
const getErrorMessage = (payload, status) => {
  const validation = field(payload, "errors");
 
  const validationMessage =
    validation && typeof validation === "object"
      ? Object.values(validation)
          .flat()
          .map(String)
          .join(" ")
      : "";
 
  const backendMessage = field(
    payload,
    "message",
    "detail",
    "error",
    "title"
  );
 
  if (backendMessage) {
    return String(backendMessage);
  }
 
  if (validationMessage) {
    return validationMessage;
  }
 
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }
 
  switch (status) {
    case 400:
      return "Invalid request. Check the submitted data.";
 
    case 401:
      return "Your pharmacist session has expired or is invalid. Please sign in again.";
 
    case 403:
      return "Your account does not have permission to perform this operation.";
 
    case 404:
      return "The requested resource was not found.";
 
    case 405:
      return "This API endpoint does not support the requested HTTP method. Verify the backend route in Swagger.";
 
    case 409:
      return "This operation conflicts with existing records. The prescription may already have a pharmacy bill.";
 
    case 422:
      return "The backend could not process the submitted data.";
 
    case 500:
      return "An internal server error occurred. Please check the backend logs.";
 
    default:
      return `Request failed (HTTP ${status}).`;
  }
};
 
// Main API request helper.
export async function pharmacyRequest(
  path,
  {
    method = "GET",
    body,
    params,
    signal
  } = {}
) {
  const token = getPharmacistToken();
 
  if (!token) {
    throw new PharmacyApiError(
      "Your pharmacist session is missing. Sign in again.",
      401
    );
  }
 
  const resolvedPath = replacePathParams(
    path,
    params
  );
 
  const url = apiUrl(resolvedPath);
 
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "ngrok-skip-browser-warning": "true"
  };
 
  if (body !== undefined && body !== null) {
    headers["Content-Type"] = "application/json";
  }
 
  let response;
 
  try {
    response = await fetch(url, {
      method: String(method).toUpperCase(),
      cache: "no-store",
      headers,
      ...(body !== undefined && body !== null
        ? { body: JSON.stringify(body) }
        : {}),
      ...(signal ? { signal } : {})
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }
 
    throw new PharmacyApiError(
      "Unable to connect to the CMS backend. Check the API URL, server availability, and network connection.",
      0
    );
  }
 
  const responseText = await response.text();
 
  let payload = null;
 
  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = responseText;
    }
  }
 
  if (!response.ok) {
    throw new PharmacyApiError(
      getErrorMessage(payload, response.status),
      response.status,
      payload
    );
  }
 
  return payload;
}
 
// OTC sales remain separate from prescription dispensing.
export const createOtcSaleDraft = (payload) => pharmacyRequest(
  API_ENDPOINTS.pharmacy.createOtcSaleDraft,
  { method: "POST", body: payload }
);

export const getOtcSale = (id) => {
  if (id === undefined || id === null || !String(id).trim()) {
    throw new Error("An OTC sale ID is required.");
  }
  return pharmacyRequest(API_ENDPOINTS.pharmacy.otcSaleById, {
    method: "GET", params: { id },
  });
};

// Call only after the pharmacist confirms the draft; this deducts stock.
export const confirmOtcSale = (id, payload) => {
  if (id === undefined || id === null || !String(id).trim()) {
    throw new Error("An OTC sale ID is required.");
  }
  return pharmacyRequest(API_ENDPOINTS.pharmacy.confirmOtcSale, {
    method: "POST", params: { id },
    ...(payload === undefined ? {} : { body: payload }),
  });
};

// Export the existing API endpoint configuration.
export { API_ENDPOINTS };