import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./DoctorSchedule.css";
import { apiUrl } from "../../config/api";
import { formatDateMMDDYYYY } from "../../utils/dateFormat";
import {
  fetchBranchesForHospital,
  buildBranchOptions,
  getStoredHospitalId,
  getAuthToken,
} from "../../utils/branchApi";
import {
  clearDoctorBranchLeaveDates,
  isDoctorBranchLeaveDate,
  saveDoctorBranchLeaveDates,
} from "../../utils/doctorBranchLeave";
import { getSpecializationDisplayName } from "./doctorExpertiseOptions";
import { getLoggedInDoctor, normalizeDoctorName } from "../../doctors/utils/doctorSession";

const DOCTORS_API = apiUrl("Doctor");
const SCHEDULE_API = apiUrl("Schedule");
const SCHEDULE_SETTINGS_API = apiUrl("ScheduleSettings");
const DOCTOR_BRANCH_SCHEDULE_DRAFTS_KEY = "doctorBranchScheduleDrafts";

const DAY_MAPPING = [
  { short: "Mon", full: "Monday", dayIndex: 1 },
  { short: "Tue", full: "Tuesday", dayIndex: 2 },
  { short: "Wed", full: "Wednesday", dayIndex: 3 },
  { short: "Thu", full: "Thursday", dayIndex: 4 },
  { short: "Fri", full: "Friday", dayIndex: 5 },
  { short: "Sat", full: "Saturday", dayIndex: 6 },
  { short: "Sun", full: "Sunday", dayIndex: 0 },
];

const DEFAULT_WORKING_DAYS = DAY_MAPPING.slice(0, 5).map((day) => day.full);
const DEFAULT_SCHEDULE_SETTINGS = {
  clinicOpen: "09:00",
  clinicClose: "18:00",
  slotDuration: 30,
};

const padNumber = (value) => String(value).padStart(2, "0");

const toDateInputValue = (date) =>
  `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(
    date.getDate()
  )}`;

const parseDateInput = (value) => {
  const [year, month, day] = String(value || "")
    .split("-")
    .map(Number);

  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const addDays = (date, numberOfDays) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + numberOfDays);
  return nextDate;
};

const normalizeTime = (value, fallback) => {
  const timeValue = String(value || "").trim();
  const match = timeValue.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return fallback;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem) {
    if (hours < 1 || hours > 12 || minutes > 59) return fallback;
    if (meridiem === "AM") hours = hours === 12 ? 0 : hours;
    if (meridiem === "PM") hours = hours === 12 ? 12 : hours + 12;
  } else if (hours > 23 || minutes > 59) {
    return fallback;
  }

  return `${padNumber(hours)}:${padNumber(minutes)}`;
};

const timeToMinutes = (value) => {
  const normalizedTime = normalizeTime(value, "");
  const [hours, minutes] = String(normalizedTime || "")
    .split(":")
    .map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes)
    ? hours * 60 + minutes
    : null;
};

const minutesToTime = (value) =>
  `${padNumber(Math.floor(value / 60))}:${padNumber(value % 60)}`;

const formatTime12Hour = (value, fallback = "12:00 AM") => {
  const normalizedTime = normalizeTime(value, "");
  if (!normalizedTime) return fallback;

  const [hours, minutes] = normalizedTime.split(":").map(Number);
  const meridiem = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${padNumber(displayHours)}:${padNumber(minutes)} ${meridiem}`;
};

const formatTimeForApi = (value) => formatTime12Hour(value);

const formatSlotTime = (value) => formatTime12Hour(value, "");

const formatScheduleTimeInput = (value, fallback) =>
  formatTime12Hour(value, fallback);

const getSlotStartValue = (slot = {}) =>
  slot.start || slot.startTime || slot.StartTime || slot.workStart || slot.WorkStart || "";

const getSlotEndValue = (slot = {}) =>
  slot.end || slot.endTime || slot.EndTime || slot.workEnd || slot.WorkEnd || "";

const isTodayDate = (value) => value === toDateInputValue(new Date());

const isCompletedSlot = (slotEnd, date) => {
  if (!isTodayDate(date)) return false;

  const endMinutes = timeToMinutes(slotEnd);
  if (endMinutes === null) return false;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return endMinutes <= nowMinutes;
};

const getSlotStatus = (slot) => String(slot?.status || "").trim().toLowerCase();

const isTimeOutSlot = (slot) => {
  const status = getSlotStatus(slot);
  return status === "time out" || status === "timeout" || status === "completed";
};

const isBookedSlot = (slot) => getSlotStatus(slot) === "booked" || slot?.isBooked;

const getRecordBranchId = (record = {}) =>
  String(
    record.branchId ??
      record.BranchId ??
      record.branchID ??
      record.clinicBranchId ??
      record.ClinicBranchId ??
      record.branch?.id ??
      record.Branch?.Id ??
      record.appointment?.branchId ??
      record.appointment?.BranchId ??
      ""
  ).trim();

const slotBelongsToBranch = (slot = {}, selectedBranchId = "") => {
  const slotBranchId = getRecordBranchId(slot);
  return Boolean(slotBranchId) && slotBranchId === String(selectedBranchId || "").trim();
};

const getDoctorBranchScheduleKey = (doctorId, branchId) =>
  `${String(doctorId || "").trim()}::${String(branchId || "").trim()}`;

const readScheduleDrafts = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(DOCTOR_BRANCH_SCHEDULE_DRAFTS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const readScheduleDraft = (doctorId, branchId) =>
  readScheduleDrafts()[getDoctorBranchScheduleKey(doctorId, branchId)] || null;

const saveScheduleDraft = (doctorId, branchId, payload) => {
  if (!doctorId || !branchId) return;
  const drafts = readScheduleDrafts();
  drafts[getDoctorBranchScheduleKey(doctorId, branchId)] = {
    ...payload,
    branchId: String(branchId),
    doctorId: String(doctorId),
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(DOCTOR_BRANCH_SCHEDULE_DRAFTS_KEY, JSON.stringify(drafts));
};

const resolveScheduleTimes = ({
  workStart,
  workEnd,
  breakStart,
  breakEnd,
  slotDuration,
}) => {
  let resolvedStart = normalizeTime(
    workStart,
    DEFAULT_SCHEDULE_SETTINGS.clinicOpen
  );
  let resolvedEnd = normalizeTime(
    workEnd,
    DEFAULT_SCHEDULE_SETTINGS.clinicClose
  );
  let startMinutes = timeToMinutes(resolvedStart);
  let endMinutes = timeToMinutes(resolvedEnd);
  const duration = Math.max(15, Number(slotDuration) || 30);

  // In an End Time field, 12:00 AM means midnight after the working day.
  if (endMinutes <= startMinutes) {
    resolvedEnd = "23:59";
    endMinutes = timeToMinutes(resolvedEnd);
  }

  if (endMinutes - startMinutes < duration) {
    resolvedStart = DEFAULT_SCHEDULE_SETTINGS.clinicOpen;
    resolvedEnd = DEFAULT_SCHEDULE_SETTINGS.clinicClose;
    startMinutes = timeToMinutes(resolvedStart);
    endMinutes = timeToMinutes(resolvedEnd);
  }

  let resolvedBreakStart = normalizeTime(breakStart, "13:00");
  let resolvedBreakEnd = normalizeTime(breakEnd, "14:00");
  const breakStartMinutes = timeToMinutes(resolvedBreakStart);
  const breakEndMinutes = timeToMinutes(resolvedBreakEnd);
  const breakIsInsideWorkingHours =
    breakStartMinutes >= startMinutes &&
    breakEndMinutes <= endMinutes &&
    breakStartMinutes < breakEndMinutes;

  if (!breakIsInsideWorkingHours) {
    const workingMinutes = endMinutes - startMinutes;
    const breakMinutes = Math.min(
      60,
      Math.max(15, duration),
      Math.max(15, Math.floor(workingMinutes / 3))
    );
    const centeredBreakStart =
      startMinutes + Math.floor((workingMinutes - breakMinutes) / 2);

    resolvedBreakStart = minutesToTime(centeredBreakStart);
    resolvedBreakEnd = minutesToTime(centeredBreakStart + breakMinutes);
  }

  return {
    workStart: resolvedStart,
    workEnd: resolvedEnd,
    breakStart: resolvedBreakStart,
    breakEnd: resolvedBreakEnd,
    slotDuration: duration,
  };
};

const parseListResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.slots)) return data.slots;
  return [];
};

const getDoctorIdValue = (doctor = {}) =>
  String(
    doctor.id ??
      doctor.Id ??
      doctor.doctorId ??
      doctor.DoctorId ??
      doctor.doctorID ??
      doctor.userId ??
      ""
  ).trim();

const getBranchAssignmentId = (branch = {}) => {
  if (branch === null || branch === undefined) return "";
  if (typeof branch !== "object") return String(branch).trim();
  return String(
    branch.id ??
      branch.Id ??
      branch.branchId ??
      branch.BranchId ??
      branch.branchID ??
      branch.BranchID ??
      branch.clinicBranchId ??
      branch.ClinicBranchId ??
      ""
  ).trim();
};

const getBranchAssignmentName = (branch = {}) => {
  if (!branch || typeof branch !== "object") return "";
  return String(
    branch.name ??
      branch.Name ??
      branch.branchName ??
      branch.BranchName ??
      branch.branch ??
      branch.Branch ??
      ""
  ).trim();
};

const readDoctorBranchAssignments = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.branches)) return data.branches;
  if (Array.isArray(data?.Branches)) return data.Branches;
  if (Array.isArray(data?.branchIds)) return data.branchIds;
  if (Array.isArray(data?.BranchIds)) return data.BranchIds;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.result)) return data.result;
  return [];
};

const fetchDoctorBranchAssignments = async (doctorId, token) => {
  if (!doctorId) return [];
  try {
    const response = await fetch(apiUrl(`Doctor/${encodeURIComponent(doctorId)}/branches`), {
      headers: {
        "ngrok-skip-browser-warning": "true",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) return [];
    return readDoctorBranchAssignments(await response.json().catch(() => []));
  } catch {
    return [];
  }
};

const mergeDoctorBranches = (doctor = {}, branchAssignments = []) => {
  const branchIds = branchAssignments.map(getBranchAssignmentId).filter(Boolean);
  const branchObjects = branchAssignments
    .map((branch) => ({
      id: getBranchAssignmentId(branch),
      branchId: getBranchAssignmentId(branch),
      name: getBranchAssignmentName(branch),
      branchName: getBranchAssignmentName(branch),
    }))
    .filter((branch) => branch.id || branch.name);

  return {
    ...doctor,
    branchIds: branchIds.length ? branchIds : doctor.branchIds,
    BranchIds: branchIds.length ? branchIds : doctor.BranchIds,
    branches: branchObjects.length ? branchObjects : doctor.branches,
    Branches: branchObjects.length ? branchObjects : doctor.Branches,
  };
};

const buildDoctorBranchOptions = (doctor = {}, allBranches = []) => {
  const assignments = [
    ...(Array.isArray(doctor.branches) ? doctor.branches : []),
    ...(Array.isArray(doctor.Branches) ? doctor.Branches : []),
  ];
  const branchIds = [
    ...(Array.isArray(doctor.branchIds) ? doctor.branchIds : []),
    ...(Array.isArray(doctor.BranchIds) ? doctor.BranchIds : []),
    ...assignments.map(getBranchAssignmentId),
    doctor.branchId,
    doctor.BranchId,
  ].map((value) => String(value || "").trim()).filter(Boolean);

  const optionsById = new Map();
  branchIds.forEach((id) => {
    const branch =
      allBranches.find((item) => String(item.id) === id) ||
      assignments.find((item) => getBranchAssignmentId(item) === id) ||
      null;
    const name = branch?.name || branch?.branchName || getBranchAssignmentName(branch) || id;
    optionsById.set(id, { id, name });
  });

  assignments.forEach((branch) => {
    const id = getBranchAssignmentId(branch);
    const name = getBranchAssignmentName(branch);
    if (id && !optionsById.has(id)) optionsById.set(id, { id, name: name || id });
  });

  return Array.from(optionsById.values()).filter((branch) => branch.id);
};

const rememberDoctorBranch = (branch = {}) => {
  if (!branch?.id) return;
  localStorage.setItem("doctorBranchId", String(branch.id));
  localStorage.setItem("DoctorBranchId", String(branch.id));
  if (branch.name) {
    localStorage.setItem("doctorBranchName", String(branch.name));
    localStorage.setItem("DoctorBranchName", String(branch.name));
  }
};

const getScheduleValue = (schedule = {}, keys = [], fallback = "") => {
  for (const key of keys) {
    const value = schedule?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return fallback;
};

const parseScheduleDays = (schedule = {}) => {
  const raw =
    schedule?.Days ??
    schedule?.days ??
    schedule?.workingDays ??
    schedule?.WorkingDays ??
    schedule?.DayList ??
    schedule?.daysList ??
    schedule?.selectedDays ??
    "";

  if (Array.isArray(raw)) {
    return raw.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof raw === "string") {
    return raw
      .split(/[,;|]/)
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  return [];
};

const parseScheduleDateValue = (schedule = {}, keys = []) => {
  const value = getScheduleValue(schedule, keys, "");
  return value ? String(value).slice(0, 10) : "";
};

const parseScheduleTimeValue = (schedule = {}, keys = [], fallback = "") =>
  normalizeTime(getScheduleValue(schedule, keys, ""), fallback);

const parseDoctorSchedule = (data) => {
  if (!data) return null;
  if (Array.isArray(data) && data.length > 0) {
    return data[0];
  }
  if (data?.data && typeof data.data === "object") {
    return data.data;
  }
  if (data?.result && typeof data.result === "object") {
    return data.result;
  }
  if (typeof data === "object") {
    return data;
  }
  return null;
};

const getScheduleId = (schedule = {}) =>
  String(
    schedule?.id ||
      schedule?.Id ||
      schedule?._id ||
      schedule?.scheduleId ||
      schedule?.ScheduleId ||
      schedule?.ScheduleID ||
      schedule?.doctorScheduleId ||
      schedule?.DoctorScheduleId ||
      schedule?.availabilityId ||
      schedule?.AvailabilityId ||
      ""
  ).trim();

const getExplicitScheduleId = (schedule = {}) =>
  String(
    schedule?.scheduleId ||
      schedule?.ScheduleId ||
      schedule?.ScheduleID ||
      schedule?.doctorScheduleId ||
      schedule?.DoctorScheduleId ||
      schedule?.availabilityId ||
      schedule?.AvailabilityId ||
      ""
  ).trim();

const getScheduleIdFromRows = (rows = []) => {
  for (const row of rows) {
    const scheduleId = getScheduleId(row);
    if (scheduleId) return scheduleId;
  }
  return "";
};

const getScheduleIdsFromRows = (rows = []) =>
  Array.from(
    new Set(
      rows
        .map((row) => getExplicitScheduleId(row))
        .filter((id) => id && id !== "0")
    )
  );

const fetchDaySlots = async (doctorId, branchId, date, token) => {
  if (!doctorId || !branchId || !date) return [];

  const query = new URLSearchParams({
    doctorId: String(doctorId),
    branchId: String(branchId),
    date,
  }).toString();
  const response = await fetch(`${SCHEDULE_API}/day-slots?${query}`, {
    headers: {
      "ngrok-skip-browser-warning": "true",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) return [];

  const rows = parseListResponse(await response.json().catch(() => []));
  return rows.filter((slot) => !getRecordBranchId(slot) || slotBelongsToBranch(slot, branchId));
};

const fetchSlotsForDates = async (doctorId, branchId, dates = [], token) => {
  const results = await Promise.all(
    dates.map((date) => fetchDaySlots(doctorId, branchId, date, token).catch(() => []))
  );
  return results.flat();
};

const buildPreviewSlotsFromPayload = (payload) => {
  const startMinutes = timeToMinutes(payload.workStart);
  const endMinutes = timeToMinutes(payload.workEnd);
  const breakStartMinutes = timeToMinutes(payload.breakStart);
  const breakEndMinutes = timeToMinutes(payload.breakEnd);
  const duration = Number(payload.slotDuration) || 15;
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return [];

  const slots = [];
  for (let current = startMinutes; current + duration <= endMinutes; current += duration) {
    const slotEnd = current + duration;
    const overlapsBreak =
      breakStartMinutes !== null &&
      breakEndMinutes !== null &&
      current < breakEndMinutes &&
      slotEnd > breakStartMinutes;
    if (overlapsBreak) continue;
    slots.push({
      startTime: minutesToTime(current),
      endTime: minutesToTime(slotEnd),
      status: "Available",
      branchId: payload.branchId,
      doctorId: payload.doctorId,
    });
  }
  return slots;
};

const fetchDoctorSchedule = async (doctorId, branchId, token) => {
  const candidateUrls = [
    `${SCHEDULE_API}/${encodeURIComponent(doctorId)}?branchId=${encodeURIComponent(branchId)}`,
    `${SCHEDULE_API}?doctorId=${encodeURIComponent(doctorId)}&branchId=${encodeURIComponent(branchId)}`,
    `${SCHEDULE_API}/doctor/${encodeURIComponent(doctorId)}?branchId=${encodeURIComponent(branchId)}`,
  ].filter(Boolean);

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        headers: {
          "ngrok-skip-browser-warning": "true",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) continue;

      const data = await response.json().catch(() => null);
      const schedule = parseDoctorSchedule(data);
      if (schedule && getRecordBranchId(schedule) === String(branchId)) return schedule;

      const rows = parseListResponse(data).filter((row) => slotBelongsToBranch(row, branchId));
      const scheduleId = getScheduleIdFromRows(rows);
      if (scheduleId) {
        return {
          id: scheduleId,
          Id: scheduleId,
          branchId,
          BranchId: branchId,
        };
      }
    } catch {
      // Try the next candidate URL.
    }
  }

  return null;
};

const normalizeDoctor = (doctor = {}) => ({
  id:
    getDoctorIdValue(doctor),
  name:
    doctor.name ||
    doctor.doctorName ||
    doctor.DoctorName ||
    doctor.fullName ||
    "",
  specialization:
    doctor.specialization ||
    doctor.Specialization ||
    doctor.doctorSpecialization ||
    "",
  branchId:
    doctor.branchId ??
    doctor.BranchId ??
    doctor.branchID ??
    doctor.clinicBranchId ??
    "",
  branchName:
    doctor.branchName ||
    doctor.BranchName ||
    doctor.branch?.name ||
    doctor.branch?.branchName ||
    "",
  raw: doctor,
});

const fetchDoctorsForBranch = async (branchId, token) => {
  const headers = {
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(DOCTORS_API, { headers });
  if (!response.ok) throw new Error("Unable to load doctors.");

  const selectedBranchId = String(branchId);
  const allDoctors = parseListResponse(await response.json().catch(() => []));
  const enrichedDoctors = await Promise.all(
    allDoctors.map(async (doctor) => {
      const assignments = await fetchDoctorBranchAssignments(getDoctorIdValue(doctor), token);
      return mergeDoctorBranches(doctor, assignments);
    })
  );

  return enrichedDoctors.filter((doctor) => {
    const assignmentIds = [
      ...(Array.isArray(doctor.branchIds) ? doctor.branchIds : []),
      ...(Array.isArray(doctor.BranchIds) ? doctor.BranchIds : []),
      ...(Array.isArray(doctor.branches) ? doctor.branches.map(getBranchAssignmentId) : []),
      ...(Array.isArray(doctor.Branches) ? doctor.Branches.map(getBranchAssignmentId) : []),
    ].map((id) => String(id || "").trim());
    const directBranchId = String(
      doctor.branchId ??
        doctor.BranchId ??
        doctor.branchID ??
        doctor.clinicBranchId ??
        ""
    ).trim();
    return assignmentIds.includes(selectedBranchId) || directBranchId === selectedBranchId;
  });
};

const getApiErrorMessage = async (response, fallback) => {
  try {
    const text = await response.text();
    if (!text) return fallback;

    try {
      const data = JSON.parse(text);
      const validationMessage =
        data?.errors && typeof data.errors === "object"
          ? Object.values(data.errors).flat().filter(Boolean).join(" ")
          : "";

      return data?.message || validationMessage || data?.title || fallback;
    } catch {
      return text;
    }
  } catch {
    return fallback;
  }
};

const shouldTryNextScheduleSave = (message) => {
  const text = String(message || "").toLowerCase();
  return (
    !text ||
    text.includes("unable to create") ||
    text.includes("already") ||
    text.includes("overlap") ||
    text.includes("overlapping") ||
    text.includes("exist") ||
    text.includes("duplicate") ||
    text.includes("conflict") ||
    text.includes("not found") ||
    text.includes("not allowed") ||
    text.includes("method")
  );
};

const saveSchedulePayload = async (
  payload,
  token,
  { replaceExisting = false, scheduleId = "" } = {}
) => {
  const headers = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const bodyPayload = {
    ...payload,
    id: scheduleId || payload.id || payload.Id,
    Id: scheduleId || payload.id || payload.Id,
    BranchId: payload.branchId,
    DoctorId: payload.doctorId,
    branchID: payload.branchId,
    doctorID: payload.doctorId,
    Days: payload.days,
    days: payload.days,
    WorkingDays: payload.days,
    workingDays: payload.days,
    StartDate: payload.startDate,
    startDate: payload.startDate,
    Date: payload.startDate,
    date: payload.startDate,
    ScheduleDate: payload.startDate,
    scheduleDate: payload.startDate,
    EndDate: payload.endDate,
    endDate: payload.endDate,
    WorkStart: payload.workStart,
    workStart: payload.workStart,
    StartTime: payload.workStart,
    startTime: payload.workStart,
    WorkEnd: payload.workEnd,
    workEnd: payload.workEnd,
    EndTime: payload.workEnd,
    endTime: payload.workEnd,
    BreakStart: payload.breakStart,
    breakStart: payload.breakStart,
    BreakStartTime: payload.breakStart,
    breakStartTime: payload.breakStart,
    BreakEnd: payload.breakEnd,
    breakEnd: payload.breakEnd,
    BreakEndTime: payload.breakEnd,
    breakEndTime: payload.breakEnd,
    SlotDuration: payload.slotDuration,
    slotDuration: payload.slotDuration,
    IsLeave: Boolean(payload.isLeave),
    isLeave: Boolean(payload.isLeave),
    Leave: Boolean(payload.isLeave),
    leave: Boolean(payload.isLeave),
    Status: payload.status || (payload.isLeave ? "Leave" : "Available"),
    status: payload.status || (payload.isLeave ? "Leave" : "Available"),
    dates: payload.dates,
    Dates: payload.dates,
    scheduledDates: payload.dates,
    ScheduledDates: payload.dates,
    updateExisting: true,
    UpdateExisting: true,
    replaceExisting,
    ReplaceExisting: replaceExisting,
    overwrite: replaceExisting,
    Overwrite: replaceExisting,
  };
  const body = JSON.stringify(bodyPayload);
  const query = new URLSearchParams({
    doctorId: String(payload.doctorId),
    branchId: String(payload.branchId),
    date: payload.startDate,
    startDate: payload.startDate,
    endDate: payload.endDate,
  }).toString();
  const attempts = [
    ...(scheduleId
      ? [
          { url: `${SCHEDULE_API}/${encodeURIComponent(scheduleId)}`, method: "PUT" },
          { url: `${SCHEDULE_API}/${encodeURIComponent(scheduleId)}?${query}`, method: "PUT" },
        ]
      : []),
    ...(!replaceExisting || !scheduleId
      ? [{ url: SCHEDULE_API, method: "POST" }]
      : []),
  ];
  let lastError = "";
  let firstSpecificError = "";

  for (const attempt of attempts) {
    const response = await fetch(attempt.url, {
      method: attempt.method,
      headers,
      body,
    });

    if (response.ok) {
      return response.json().catch(() => ({}));
    }

    lastError = await getApiErrorMessage(
      response,
      replaceExisting
        ? "Unable to update the schedule."
        : "Unable to create the schedule."
    );
    if (
      lastError &&
      !firstSpecificError &&
      !lastError.toLowerCase().startsWith("unable to ")
    ) {
      firstSpecificError = lastError;
    }

    if (!shouldTryNextScheduleSave(lastError)) {
      throw new Error(lastError);
    }
  }

  throw new Error(firstSpecificError || lastError || "Unable to save the schedule.");
};

const buildScheduledDates = (startDate, endDate, workingDays) => {
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  if (!start || !end || start > end || workingDays.length === 0) return [];

  const selectedDayIndexes = new Set(
    DAY_MAPPING.filter((day) => workingDays.includes(day.full)).map(
      (day) => day.dayIndex
    )
  );
  const dates = [];

  for (
    let currentDate = new Date(start);
    currentDate <= end;
    currentDate = addDays(currentDate, 1)
  ) {
    if (selectedDayIndexes.has(currentDate.getDay())) {
      dates.push({
        value: toDateInputValue(currentDate),
        weekday: DAY_MAPPING.find(
          (day) => day.dayIndex === currentDate.getDay()
        )?.full,
        label: formatDateMMDDYYYY(currentDate),
      });
    }
  }

  return dates;
};

const fetchAllDoctors = async (token) => {
  const response = await fetch(DOCTORS_API, {
    headers: {
      "ngrok-skip-browser-warning": "true",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) throw new Error("Unable to load doctors.");
  return parseListResponse(await response.json().catch(() => []));
};

const findLoggedInDoctorRecord = (doctors, sessionDoctor) => {
  const sessionDoctorId = String(sessionDoctor?.id || "").trim();
  const sessionDoctorName = normalizeDoctorName(sessionDoctor?.name);

  return doctors.map(normalizeDoctor).find((doctor) => {
    if (sessionDoctorId && String(doctor.id) === sessionDoctorId) return true;
    return sessionDoctorName && normalizeDoctorName(doctor.name) === sessionDoctorName;
  });
};

const getStoredDoctorBranchName = () =>
  String(
    localStorage.getItem("branchName") ||
      localStorage.getItem("BranchName") ||
      localStorage.getItem("doctorBranchName") ||
      localStorage.getItem("DoctorBranchName") ||
      ""
  ).trim();

const getStoredDoctorBranchId = () =>
  String(
    localStorage.getItem("branchId") ||
      localStorage.getItem("BranchId") ||
      localStorage.getItem("doctorBranchId") ||
      localStorage.getItem("DoctorBranchId") ||
      ""
  ).trim();

const resolveSelfDoctorBranch = (doctor = {}, branchOptions = []) => {
  const storedBranchId = getStoredDoctorBranchId();
  const storedBranchName = getStoredDoctorBranchName();
  const branchId = String(doctor.branchId || storedBranchId || "").trim();
  const branchName = String(doctor.branchName || storedBranchName || "").trim();

  const matchedBranch =
    branchOptions.find((branch) => String(branch.id) === branchId) ||
    branchOptions.find(
      (branch) =>
        branchName &&
        String(branch.name || "").trim().toLowerCase() === branchName.toLowerCase()
    ) ||
    (branchOptions.length === 1 ? branchOptions[0] : null);

  return {
    id: String(branchId || matchedBranch?.id || "").trim(),
    name: String(branchName || matchedBranch?.name || "").trim(),
  };
};

function Schedule({ selfMode = false } = {}) {
  const sessionDoctor = useMemo(() => getLoggedInDoctor(), []);
  const today = useMemo(() => toDateInputValue(new Date()), []);
  const defaultEndDate = useMemo(
    () => toDateInputValue(addDays(new Date(), 30)),
    []
  );

  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState("");
  const [branchOptions, setBranchOptions] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [days, setDays] = useState(DEFAULT_WORKING_DAYS);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [workStart, setWorkStart] = useState(
    formatTime12Hour(DEFAULT_SCHEDULE_SETTINGS.clinicOpen)
  );
  const [workEnd, setWorkEnd] = useState(
    formatTime12Hour(DEFAULT_SCHEDULE_SETTINGS.clinicClose)
  );
  const [breakStart, setBreakStart] = useState(formatTime12Hour("13:00"));
  const [breakEnd, setBreakEnd] = useState(formatTime12Hour("14:00"));
  const [slotDuration, setSlotDuration] = useState(
    String(DEFAULT_SCHEDULE_SETTINGS.slotDuration)
  );
  const [scheduleType, setScheduleType] = useState("available");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [hasSaveError, setHasSaveError] = useState(false);
  const [previewDate, setPreviewDate] = useState(today);
  const [previewSlots, setPreviewSlots] = useState([]);
  const [existingScheduleId, setExistingScheduleId] = useState("");
  const [hasSavedSchedule, setHasSavedSchedule] = useState(false);
  const [isFetchingSlots, setIsFetchingSlots] = useState(false);
  const [slotRefreshKey, setSlotRefreshKey] = useState(0);
  const [selfDoctor, setSelfDoctor] = useState(null);

  const selectedDoctor = useMemo(
    () => doctors.find((doctor) => String(doctor.id) === String(doctorId)) || null,
    [doctorId, doctors]
  );

  const selectedDoctorBranchNames = useMemo(() => {
    if (!selectedDoctor) return [];
    const names = [
      ...(Array.isArray(selectedDoctor.branches)
        ? selectedDoctor.branches.map(getBranchAssignmentName)
        : []),
      ...(Array.isArray(selectedDoctor.Branches)
        ? selectedDoctor.Branches.map(getBranchAssignmentName)
        : []),
      selectedDoctor.branchName,
      selectedDoctor.BranchName,
    ].filter(Boolean);
    return Array.from(new Set(names));
  }, [selectedDoctor]);

  const scheduledDates = useMemo(
    () => buildScheduledDates(startDate, endDate, days),
    [days, endDate, startDate]
  );

  const visiblePreviewSlots = useMemo(
    () =>
      previewSlots.filter((slot) => {
        const slotEnd = formatSlotTime(getSlotEndValue(slot));
        return isBookedSlot(slot) || (!isTimeOutSlot(slot) && !isCompletedSlot(slotEnd, previewDate));
      }),
    [previewDate, previewSlots]
  );

  useEffect(() => {
    const hospitalId = getStoredHospitalId();
    Promise.allSettled([
      fetch(SCHEDULE_SETTINGS_API, {
        headers: { "ngrok-skip-browser-warning": "true" },
      }).then(async (response) => {
        if (!response.ok) throw new Error("Unable to load schedule settings.");
        return response.json();
      }),
      fetchBranchesForHospital(hospitalId),
      selfMode ? fetchAllDoctors(getAuthToken()) : Promise.resolve([]),
    ]).then(async ([settingsResult, branchesResult, doctorsResult]) => {
      if (settingsResult.status === "fulfilled") {
        const settings =
          settingsResult.value?.data || settingsResult.value || {};
        setWorkStart(
          formatTime12Hour(
            settings.clinicOpen,
            formatTime12Hour(DEFAULT_SCHEDULE_SETTINGS.clinicOpen)
          )
        );
        setWorkEnd(
          formatTime12Hour(
            settings.clinicClose,
            formatTime12Hour(DEFAULT_SCHEDULE_SETTINGS.clinicClose)
          )
        );
        setSlotDuration(
          String(
            settings.slotDuration || DEFAULT_SCHEDULE_SETTINGS.slotDuration
          )
        );
      }

      const nextBranchOptions =
        branchesResult.status === "fulfilled"
          ? buildBranchOptions(branchesResult.value)
          : [];

      if (branchesResult.status === "fulfilled") {
        const options = nextBranchOptions;
        setBranchOptions(options);
        if (!selfMode && options.length > 0) setBranchId(String(options[0].id));
      }

      if (selfMode) {
        const token = getAuthToken();
        const doctor =
          doctorsResult?.status === "fulfilled"
            ? findLoggedInDoctorRecord(doctorsResult.value, sessionDoctor)
            : null;
        const fallbackDoctor = {
          id: sessionDoctor.id,
          name: sessionDoctor.name,
          branchId: getStoredDoctorBranchId(),
          branchName: getStoredDoctorBranchName(),
        };
        const baseDoctor = doctor || fallbackDoctor;
        const branchAssignments = await fetchDoctorBranchAssignments(getDoctorIdValue(baseDoctor), token);
        const mergedDoctor = mergeDoctorBranches(baseDoctor, branchAssignments);
        const selfBranchOptions = buildDoctorBranchOptions(mergedDoctor, nextBranchOptions);
        if (selfBranchOptions.length) setBranchOptions(selfBranchOptions);
        const resolvedBranch = resolveSelfDoctorBranch(
          mergedDoctor,
          selfBranchOptions.length ? selfBranchOptions : nextBranchOptions
        );
        const resolvedDoctor = {
          ...mergedDoctor,
          branchId: resolvedBranch.id,
          branchName: resolvedBranch.name,
        };
        setSelfDoctor(resolvedDoctor);
        setDoctors(resolvedDoctor.id ? [resolvedDoctor] : []);
        setDoctorId(String(resolvedDoctor.id || ""));
        setBranchId(String(resolvedDoctor.branchId || ""));
      }
      setLoadingBranches(false);
    });
  }, [selfMode, sessionDoctor]);

  useEffect(() => {
    let isActive = true;

    if (!selfMode) {
      setDoctorId("");
      setDoctors([]);
    }
    setPreviewSlots([]);
    setSaveMessage("");

    if (selfMode) {
      setLoadingDoctors(false);
      return () => {
        isActive = false;
      };
    }

    if (!branchId) {
      setLoadingDoctors(false);
      return () => {
        isActive = false;
      };
    }

    setLoadingDoctors(true);
    fetchDoctorsForBranch(branchId, getAuthToken())
      .then((rows) => {
        if (!isActive) return;

        const branchDoctors = rows
          .map(normalizeDoctor)
          .filter((doctor) => doctor.id !== "");
        setDoctors(branchDoctors);
        setDoctorId(branchDoctors.length ? String(branchDoctors[0].id) : "");
      })
      .catch(() => {
        if (!isActive) return;
        setDoctors([]);
        setDoctorId("");
      })
      .finally(() => {
        if (isActive) setLoadingDoctors(false);
      });

    return () => {
      isActive = false;
    };
  }, [branchId, selfMode]);

  useEffect(() => {
    if (!branchId || !doctorId) {
      setPreviewSlots([]);
      setExistingScheduleId("");
      setHasSavedSchedule(false);
      return;
    }

    const token = getAuthToken();
    let isActive = true;

    const loadDoctorSchedule = async () => {
      setExistingScheduleId("");
      setHasSavedSchedule(false);
      setDays(DEFAULT_WORKING_DAYS);
      setStartDate(today);
      setEndDate(defaultEndDate);
      setPreviewDate(today);
      setWorkStart(formatTime12Hour(DEFAULT_SCHEDULE_SETTINGS.clinicOpen));
      setWorkEnd(formatTime12Hour(DEFAULT_SCHEDULE_SETTINGS.clinicClose));
      setBreakStart(formatTime12Hour("13:00"));
      setBreakEnd(formatTime12Hour("14:00"));
      setSlotDuration(String(DEFAULT_SCHEDULE_SETTINGS.slotDuration));
      setScheduleType("available");

      const draft = readScheduleDraft(doctorId, branchId);
      if (draft) {
        setScheduleType(draft.isLeave ? "leave" : "available");
        const draftDays = Array.isArray(draft.days) ? draft.days : parseScheduleDays(draft);
        if (draftDays.length) setDays(draftDays);
        if (draft.startDate) {
          setStartDate(draft.startDate);
          setPreviewDate(draft.startDate);
        }
        if (draft.endDate) setEndDate(draft.endDate);
        if (draft.workStart) setWorkStart(formatTime12Hour(draft.workStart));
        if (draft.workEnd) setWorkEnd(formatTime12Hour(draft.workEnd));
        if (draft.breakStart) setBreakStart(formatTime12Hour(draft.breakStart));
        if (draft.breakEnd) setBreakEnd(formatTime12Hour(draft.breakEnd));
        if (draft.slotDuration) setSlotDuration(String(draft.slotDuration));
      }

      const schedule = await fetchDoctorSchedule(doctorId, branchId, token).catch(() => null);
      if (!isActive || !schedule) return;

      const scheduleDays = parseScheduleDays(schedule);
      const resolvedStartDate = parseScheduleDateValue(schedule, ["StartDate", "startDate", "start"]);
      const resolvedEndDate = parseScheduleDateValue(schedule, ["EndDate", "endDate", "end"]);
      const resolvedWorkStart = parseScheduleTimeValue(schedule, ["WorkStart", "workStart", "startTime", "start"]);
      const resolvedWorkEnd = parseScheduleTimeValue(schedule, ["WorkEnd", "workEnd", "endTime", "end"]);
      const resolvedBreakStart = parseScheduleTimeValue(schedule, ["BreakStart", "breakStart", "breakStartTime", "breakStart"]);
      const resolvedBreakEnd = parseScheduleTimeValue(schedule, ["BreakEnd", "breakEnd", "breakEndTime", "breakEnd"]);
      const resolvedSlotDuration = String(
        Number(getScheduleValue(schedule, ["SlotDuration", "slotDuration", "slot"])) || DEFAULT_SCHEDULE_SETTINGS.slotDuration
      );
      const scheduleId = getScheduleId(schedule);

      if (scheduleDays.length) setDays(scheduleDays);
      if (resolvedStartDate) {
        setStartDate(resolvedStartDate);
        setPreviewDate(resolvedStartDate);
      }
      if (resolvedEndDate) setEndDate(resolvedEndDate);
      if (resolvedWorkStart) setWorkStart(formatTime12Hour(resolvedWorkStart));
      if (resolvedWorkEnd) setWorkEnd(formatTime12Hour(resolvedWorkEnd));
      if (resolvedBreakStart) setBreakStart(formatTime12Hour(resolvedBreakStart));
      if (resolvedBreakEnd) setBreakEnd(formatTime12Hour(resolvedBreakEnd));
      if (resolvedSlotDuration) setSlotDuration(resolvedSlotDuration);
      setExistingScheduleId(scheduleId);
      setHasSavedSchedule(true);
    };

    loadDoctorSchedule();

    return () => {
      isActive = false;
    };
  }, [branchId, defaultEndDate, doctorId, today]);

  useEffect(() => {
    if (!branchId || !doctorId || !previewDate) {
      setPreviewSlots([]);
      return;
    }

      setIsFetchingSlots(true);
    const token = getAuthToken();
    const resolvedTimes = resolveScheduleTimes({
      workStart,
      workEnd,
      breakStart,
      breakEnd,
      slotDuration,
    });
    const previewPayload = {
      branchId: Number(branchId),
      doctorId: Number(doctorId),
      workStart: formatTimeForApi(resolvedTimes.workStart),
      workEnd: formatTimeForApi(resolvedTimes.workEnd),
      breakStart: formatTimeForApi(resolvedTimes.breakStart),
      breakEnd: formatTimeForApi(resolvedTimes.breakEnd),
      slotDuration: resolvedTimes.slotDuration,
    };
    const generatedSlots = buildPreviewSlotsFromPayload(previewPayload);
    const isLeaveDate = scheduleType === "leave" || isDoctorBranchLeaveDate(doctorId, branchId, previewDate);
    setPreviewSlots(isLeaveDate ? [] : generatedSlots);
    fetchDaySlots(doctorId, branchId, previewDate, token)
      .then((rows) => {
        setHasSavedSchedule(rows.length > 0);
        if (isLeaveDate) {
          setPreviewSlots([]);
        } else if (rows.length > 0) {
          setPreviewSlots(rows);
        }
      })
      .catch(() => {})
      .finally(() => setIsFetchingSlots(false));
  }, [branchId, doctorId, previewDate, workStart, workEnd, breakStart, breakEnd, slotDuration, scheduleType, slotRefreshKey]);

  useEffect(() => {
    if (!branchId || !doctorId || scheduledDates.length === 0) {
      setHasSavedSchedule(false);
      return;
    }

    const token = getAuthToken();
    let isActive = true;
    fetchSlotsForDates(
      doctorId,
      branchId,
      scheduledDates.map((date) => date.value),
      token
    )
      .then((rows) => {
        if (isActive) setHasSavedSchedule(rows.length > 0);
      })
      .catch(() => {
        if (isActive) setHasSavedSchedule(false);
      });

    return () => {
      isActive = false;
    };
  }, [branchId, doctorId, scheduledDates, slotRefreshKey]);

  const toggleDay = (fullDay) => {
    setSaveMessage("");
    setDays((currentDays) =>
      currentDays.includes(fullDay)
        ? currentDays.filter((day) => day !== fullDay)
        : [...currentDays, fullDay]
    );
  };

  const handleStartDateChange = (value) => {
    setStartDate(value);
    setPreviewDate(value);
    setSaveMessage("");
    if (!endDate || value > endDate) setEndDate(value);
  };

  const handleSave = async () => {
    setHasSaveError(true);

    if (!doctorId || !branchId || !startDate || !endDate || days.length === 0) {
      setSaveMessage(
        "Select a doctor, branch, at least one working day, and a date range."
      );
      return;
    }

    if (startDate > endDate) {
      setSaveMessage("The end date must be on or after the start date.");
      return;
    }

    if (scheduledDates.length === 0) {
      setSaveMessage("No selected working days fall inside this date range.");
      return;
    }

    setIsSaving(true);
    setSaveMessage("");

    const resolvedTimes = resolveScheduleTimes({
      workStart,
      workEnd,
      breakStart,
      breakEnd,
      slotDuration,
    });

    const payload = {
      branchId: Number(branchId),
      doctorId: Number(doctorId),
      days,
      startDate,
      endDate,
      workStart: formatTimeForApi(resolvedTimes.workStart),
      workEnd: formatTimeForApi(resolvedTimes.workEnd),
      breakStart: formatTimeForApi(resolvedTimes.breakStart),
      breakEnd: formatTimeForApi(resolvedTimes.breakEnd),
      slotDuration: resolvedTimes.slotDuration,
      dates: scheduledDates.map((date) => date.value),
      isLeave: scheduleType === "leave",
      IsLeave: scheduleType === "leave",
      status: scheduleType === "leave" ? "Leave" : "Available",
      Status: scheduleType === "leave" ? "Leave" : "Available",
    };

    const token = getAuthToken();
    try {
      const existingRows = await fetchSlotsForDates(
        doctorId,
        branchId,
        scheduledDates.map((date) => date.value),
        token
      ).catch(() => []);
      const rowScheduleIds = getScheduleIdsFromRows(existingRows);
      const shouldUpdate = Boolean(hasSavedSchedule || existingScheduleId || rowScheduleIds.length);
      const resolvedScheduleId = existingScheduleId || rowScheduleIds[0] || "";

      const data = await saveSchedulePayload(payload, token, {
        replaceExisting: shouldUpdate,
        scheduleId: resolvedScheduleId || (shouldUpdate ? String(doctorId) : ""),
      });
      if (scheduleType === "leave") {
        saveDoctorBranchLeaveDates(doctorId, branchId, payload.dates);
      } else {
        clearDoctorBranchLeaveDates(doctorId, branchId, payload.dates);
      }
      rememberDoctorBranch(branchOptions.find((branch) => String(branch.id) === String(branchId)));
      saveScheduleDraft(doctorId, branchId, payload);
      setHasSaveError(false);
      setHasSavedSchedule(true);
      setExistingScheduleId(getScheduleId(data) || resolvedScheduleId);
      setPreviewSlots(scheduleType === "leave" ? [] : buildPreviewSlotsFromPayload(payload));
      setSaveMessage(
        data?.message ||
          `${scheduleType === "leave" ? "Leave" : "Schedule"} ${shouldUpdate ? "updated" : "saved"} for ${scheduledDates.length} working days.`
      );
      setPreviewDate(scheduledDates[0].value);
      setSlotRefreshKey((value) => value + 1);
    } catch (error) {
      const message = String(error.message || "");
      const canReplaceAfterOverlap = /overlap|overlapping|already|exist|duplicate|conflict/i.test(message);

      if (canReplaceAfterOverlap) {
        try {
          const rowsByDates = await fetchSlotsForDates(
            doctorId,
            branchId,
            scheduledDates.map((date) => date.value),
            token
          );
          const ids = getScheduleIdsFromRows(rowsByDates);
          const updateId = ids[0] || existingScheduleId || String(doctorId);
          const data = await saveSchedulePayload(payload, token, {
            replaceExisting: true,
            scheduleId: updateId,
          });
          if (scheduleType === "leave") {
            saveDoctorBranchLeaveDates(doctorId, branchId, payload.dates);
          } else {
            clearDoctorBranchLeaveDates(doctorId, branchId, payload.dates);
          }
          rememberDoctorBranch(branchOptions.find((branch) => String(branch.id) === String(branchId)));
          saveScheduleDraft(doctorId, branchId, payload);
          setHasSaveError(false);
          setHasSavedSchedule(true);
          setExistingScheduleId(getScheduleId(data) || updateId);
          setPreviewSlots(scheduleType === "leave" ? [] : buildPreviewSlotsFromPayload(payload));
          setSaveMessage(
            data?.message ||
              `${scheduleType === "leave" ? "Leave" : "Schedule"} updated for ${scheduledDates.length} working days.`
          );
          setPreviewDate(scheduledDates[0].value);
          setSlotRefreshKey((value) => value + 1);
          return;
        } catch (retryError) {
          setHasSaveError(true);
          setSaveMessage(retryError.message || message || "Unable to update the schedule.");
          return;
        }
      }

      setHasSaveError(true);
      setSaveMessage(message || "Unable to create the schedule.");
    } finally {
      setIsSaving(false);
    }
  };

  const changePreviewDate = (direction) => {
    const currentDate = parseDateInput(previewDate) || new Date();
    setPreviewDate(toDateInputValue(addDays(currentDate, direction)));
  };

  const previewDateValue = parseDateInput(previewDate);
  const previewDateLabel = previewDateValue
    ? formatDateMMDDYYYY(previewDateValue)
    : previewDate;

  return (
    <div className="schedule-page">
      <h2>{selfMode ? "My Schedule" : "Doctor Schedule"}</h2>
      <p>{selfMode ? "Update your availability from working days and timings" : "Create availability from working days and a date range"}</p>

      <div className="schedule-container">
        <div className="left">
          {selfMode ? (
            <>
              <label>Branch</label>
              {branchOptions.length > 1 ? (
                <select
                  value={branchId}
                  onChange={(event) => {
                    const nextBranchId = event.target.value;
                    const nextBranch = branchOptions.find((branch) => String(branch.id) === String(nextBranchId));
                    setBranchId(nextBranchId);
                    setSelfDoctor((doctor) => ({
                      ...(doctor || {}),
                      branchId: nextBranchId,
                      branchName: nextBranch?.name || "",
                    }));
                    rememberDoctorBranch(nextBranch);
                    setSaveMessage("");
                  }}
                >
                  {branchOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="schedule-static-field">
                  {selfDoctor?.branchName ||
                    branchOptions.find((branch) => String(branch.id) === String(branchId))?.name ||
                    "Assigned branch"}
                </div>
              )}

              <label>Doctor</label>
              <div className="schedule-static-field">
                Dr. {selfDoctor?.name || sessionDoctor.name || "Doctor"}
                {selfDoctor?.specialization ? ` - ${getSpecializationDisplayName(selfDoctor.specialization)}` : ""}
              </div>
            </>
          ) : (
            <>
              <label htmlFor="schedule-branch">Branch</label>
              <select
                id="schedule-branch"
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                disabled={loadingBranches}
              >
                {loadingBranches ? <option value="">Loading branches...</option> : null}
                {!loadingBranches && !branchOptions.length ? (
                  <option value="">No branches found</option>
                ) : null}
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>

              <label htmlFor="schedule-doctor">Doctor</label>
              <select
                id="schedule-doctor"
                value={doctorId}
                onChange={(event) => setDoctorId(event.target.value)}
                disabled={!branchId || loadingDoctors}
              >
                {!branchId ? <option value="">Select branch first</option> : null}
                {branchId && loadingDoctors ? (
                  <option value="">Loading doctors...</option>
                ) : null}
                {branchId && !loadingDoctors && !doctors.length ? (
                  <option value="">No doctors found for this branch</option>
                ) : null}
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    Dr. {doctor.name || doctor.id}
                    {doctor.specialization ? ` - ${getSpecializationDisplayName(doctor.specialization)}` : ""}
                  </option>
                ))}
              </select>
              {selectedDoctorBranchNames.length > 1 ? (
                <p className="schedule-assignment-note">
                  Assigned branches: {selectedDoctorBranchNames.join(", ")}
                </p>
              ) : null}
            </>
          )}

          <label htmlFor="schedule-type">Availability</label>
          <select
            id="schedule-type"
            value={scheduleType}
            onChange={(event) => {
              setScheduleType(event.target.value);
              setSaveMessage("");
            }}
          >
            <option value="available">Available slots</option>
            <option value="leave">Leave - no slots</option>
          </select>

          <h4>Working Days</h4>
          <div className="days" aria-label="Working days">
            {DAY_MAPPING.map((day) => (
              <button
                key={day.short}
                type="button"
                className={days.includes(day.full) ? "active" : "off"}
                aria-pressed={days.includes(day.full)}
                onClick={() => toggleDay(day.full)}
              >
                {day.short}
              </button>
            ))}
          </div>

          <div className="grid schedule-date-grid">
            <div>
              <label htmlFor="schedule-start-date">Start Date</label>
              <input
                id="schedule-start-date"
                type="date"
                min={today}
                value={startDate}
                onChange={(event) => handleStartDateChange(event.target.value)}
              />
            </div>

            <div>
              <label htmlFor="schedule-end-date">End Date</label>
              <input
                id="schedule-end-date"
                type="date"
                min={startDate || today}
                value={endDate}
                onChange={(event) => {
                  setEndDate(event.target.value);
                  setSaveMessage("");
                }}
              />
            </div>
          </div>

          <div className="grid">
            <div>
              <label htmlFor="schedule-work-start">Start Time</label>
              <input
                id="schedule-work-start"
                type="text"
                placeholder="09:00 AM"
                value={workStart}
                disabled={scheduleType === "leave"}
                onChange={(event) => {
                  setWorkStart(event.target.value);
                  setSaveMessage("");
                }}
                onBlur={(event) =>
                  setWorkStart(
                    formatScheduleTimeInput(event.target.value, formatTime12Hour(DEFAULT_SCHEDULE_SETTINGS.clinicOpen))
                  )
                }
              />
            </div>

            <div>
              <label htmlFor="schedule-work-end">End Time</label>
              <input
                id="schedule-work-end"
                type="text"
                placeholder="06:00 PM"
                value={workEnd}
                disabled={scheduleType === "leave"}
                onChange={(event) => {
                  setWorkEnd(event.target.value);
                  setSaveMessage("");
                }}
                onBlur={(event) =>
                  setWorkEnd(
                    formatScheduleTimeInput(event.target.value, formatTime12Hour(DEFAULT_SCHEDULE_SETTINGS.clinicClose))
                  )
                }
              />
            </div>

            <div>
              <label htmlFor="schedule-break-start">Break Start</label>
              <input
                id="schedule-break-start"
                type="text"
                placeholder="01:00 PM"
                value={breakStart}
                disabled={scheduleType === "leave"}
                onChange={(event) => {
                  setBreakStart(event.target.value);
                  setSaveMessage("");
                }}
                onBlur={(event) =>
                  setBreakStart(formatScheduleTimeInput(event.target.value, "01:00 PM"))
                }
              />
            </div>

            <div>
              <label htmlFor="schedule-break-end">Break End</label>
              <input
                id="schedule-break-end"
                type="text"
                placeholder="02:00 PM"
                value={breakEnd}
                disabled={scheduleType === "leave"}
                onChange={(event) => {
                  setBreakEnd(event.target.value);
                  setSaveMessage("");
                }}
                onBlur={(event) =>
                  setBreakEnd(formatScheduleTimeInput(event.target.value, "02:00 PM"))
                }
              />
            </div>

            <div>
              <label htmlFor="schedule-slot-duration">Slot Duration</label>
              <select
                id="schedule-slot-duration"
                value={slotDuration}
                disabled={scheduleType === "leave"}
                onChange={(event) => {
                  setSlotDuration(event.target.value);
                  setSaveMessage("");
                }}
              >
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            className="save"
            onClick={handleSave}
            disabled={isSaving || loadingDoctors || !branchId || !doctorId}
          >
            {isSaving
              ? "Saving..."
              : `${existingScheduleId || hasSavedSchedule ? "Update" : "Save"} ${scheduleType === "leave" ? "Leave" : "Schedule"} (${scheduledDates.length} days)`}
          </button>

          {saveMessage && (
            <p className={`save-message ${hasSaveError ? "error" : ""}`}>
              {saveMessage}
            </p>
          )}
        </div>

        <div className="right">
          <div className="preview-header">
            <div>
              <h3>Preview</h3>
              <p>Generated time slots</p>
            </div>
            <div className="date-pagination">
              <button
                type="button"
                title="Previous day"
                aria-label="Previous day"
                onClick={() => changePreviewDate(-1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span>{previewDateLabel}</span>
              <button
                type="button"
                title="Next day"
                aria-label="Next day"
                onClick={() => changePreviewDate(1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="slots">
            {isFetchingSlots ? (
              <p className="slots-msg">Loading slots...</p>
            ) : loadingDoctors ? (
              <p className="slots-msg">Loading doctors for this branch...</p>
            ) : !branchId ? (
              <p className="slots-msg">Select a branch to view slots.</p>
            ) : !doctorId ? (
              <p className="slots-msg">Select a doctor to view slots.</p>
            ) : visiblePreviewSlots.length > 0 ? (
              visiblePreviewSlots.map((slot, index) => {
                const slotStart = formatSlotTime(getSlotStartValue(slot));
                const slotEnd = formatSlotTime(getSlotEndValue(slot));
                const isBooked = isBookedSlot(slot);
                const statusClass = isBooked ? "booked" : "available";
                const statusLabel = isBooked ? "Booked" : "Available";

                return (
                  <div className="slot" key={`${slotStart}-${slotEnd}-${index}`}>
                    <span>
                      {slotStart}
                      {slotEnd ? ` - ${slotEnd}` : ""}
                    </span>
                    <span className={statusClass}>
                      {statusLabel}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="slots-msg">
                No saved slots for this date yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Schedule;
