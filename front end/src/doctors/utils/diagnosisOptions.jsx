import { apiUrl } from "../../config/api";
import { getAuthToken } from "./doctorSession";

const DIAGNOSIS_DROPDOWN_API = apiUrl("Consultation/diagnosis-dropdown");

const getDiagnosisText = (item) => {
  if (typeof item === "string") return item;

  return item?.diagnosis || item?.name || item?.value || "";
};

export const normalizeDiagnosisOptions = (data) => {
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.diagnoses)
        ? data.diagnoses
        : [];

  const seen = new Set();

  return list.reduce((options, item) => {
    const value = String(getDiagnosisText(item) || "").trim();
    const key = value.toLowerCase();

    if (!value || seen.has(key)) return options;

    seen.add(key);
    return [...options, value];
  }, []);
};

export const mergeDiagnosisOption = (options, diagnosis) => {
  const value = String(diagnosis || "").trim();
  if (!value) return Array.isArray(options) ? options : [];

  const list = Array.isArray(options) ? options : [];
  const exists = list.some(
    (option) => option.trim().toLowerCase() === value.toLowerCase()
  );

  return exists ? list : [value, ...list];
};

export const fetchDiagnosisOptions = async () => {
  const token = getAuthToken();
  const headers = {
    "ngrok-skip-browser-warning": "true",
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(DIAGNOSIS_DROPDOWN_API, {
    headers,
  });
  const data = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error(data.message || "Unable to load diagnosis list.");
  }

  return normalizeDiagnosisOptions(data);
};
