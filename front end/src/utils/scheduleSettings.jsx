import { apiUrl } from "../config/api";

export const SCHEDULE_SETTINGS_CACHE_KEY = "scheduleSettings";
export const DEFAULT_SLOT_DURATION = 30;

const parseDuration = (value) => {
  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 ? duration : null;
};

export const normalizeScheduleSettings = (settings = {}) => ({
  ...settings,
  slotDuration: parseDuration(settings.slotDuration ?? settings.SlotDuration) || DEFAULT_SLOT_DURATION,
  clinicOpen: settings.clinicOpen ?? settings.ClinicOpen ?? "09:00:00",
  clinicClose: settings.clinicClose ?? settings.ClinicClose ?? "18:00:00",
});

export const cacheScheduleSettings = (settings = {}) => {
  const normalized = normalizeScheduleSettings(settings);
  try {
    localStorage.setItem(SCHEDULE_SETTINGS_CACHE_KEY, JSON.stringify(normalized));
  } catch (_) {
    // localStorage may be unavailable in restricted browsers.
  }
  return normalized;
};

export const getCachedScheduleSettings = () => {
  try {
    const cached = JSON.parse(localStorage.getItem(SCHEDULE_SETTINGS_CACHE_KEY) || "null");
    return cached ? normalizeScheduleSettings(cached) : null;
  } catch (_) {
    return null;
  }
};

export const getCachedScheduleSlotDuration = () =>
  parseDuration(getCachedScheduleSettings()?.slotDuration) || DEFAULT_SLOT_DURATION;

export const fetchScheduleSettings = async () => {
  const response = await fetch(apiUrl("ScheduleSettings"), {
    headers: { "ngrok-skip-browser-warning": "true" },
  });
  if (!response.ok) throw new Error("Unable to load schedule settings.");
  const data = await response.json();
  return cacheScheduleSettings(data);
};