import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./DoctorSchedule.css";
import { apiUrl } from "../../config/api";
import { formatDateMMDDYYYY } from "../../utils/dateFormat";

const DOCTORS_API = apiUrl("Doctor");
const SCHEDULE_API = apiUrl("Schedule");
const SCHEDULE_SETTINGS_API = apiUrl("ScheduleSettings");

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
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallback;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return fallback;

  return `${padNumber(hours)}:${padNumber(minutes)}`;
};

const timeToMinutes = (value) => {
  const [hours, minutes] = String(value || "")
    .split(":")
    .map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes)
    ? hours * 60 + minutes
    : 0;
};

const minutesToTime = (value) =>
  `${padNumber(Math.floor(value / 60))}:${padNumber(value % 60)}`;

const formatTimeForApi = (value) => `${normalizeTime(value, "00:00")}:00`;

const isTodayDate = (value) => value === toDateInputValue(new Date());

const isCompletedSlot = (slotEnd, date) => {
  if (!isTodayDate(date)) return false;

  const endMinutes = timeToMinutes(slotEnd);
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

const normalizeDoctor = (doctor = {}) => ({
  id:
    doctor.id ??
    doctor.doctorId ??
    doctor.DoctorId ??
    doctor.doctorID ??
    doctor.userId ??
    "",
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
});

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

function Schedule() {
  const navigate = useNavigate();
  const today = useMemo(() => toDateInputValue(new Date()), []);
  const defaultEndDate = useMemo(
    () => toDateInputValue(addDays(new Date(), 30)),
    []
  );

  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState("");
  const [days, setDays] = useState(DEFAULT_WORKING_DAYS);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [workStart, setWorkStart] = useState(
    DEFAULT_SCHEDULE_SETTINGS.clinicOpen
  );
  const [workEnd, setWorkEnd] = useState(
    DEFAULT_SCHEDULE_SETTINGS.clinicClose
  );
  const [breakStart, setBreakStart] = useState("13:00");
  const [breakEnd, setBreakEnd] = useState("14:00");
  const [slotDuration, setSlotDuration] = useState(
    String(DEFAULT_SCHEDULE_SETTINGS.slotDuration)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [hasSaveError, setHasSaveError] = useState(false);
  const [previewDate, setPreviewDate] = useState(today);
  const [previewSlots, setPreviewSlots] = useState([]);
  const [isFetchingSlots, setIsFetchingSlots] = useState(false);
  const [slotRefreshKey, setSlotRefreshKey] = useState(0);

  const scheduledDates = useMemo(
    () => buildScheduledDates(startDate, endDate, days),
    [days, endDate, startDate]
  );

  useEffect(() => {
    Promise.allSettled([
      fetch(DOCTORS_API, {
        headers: { "ngrok-skip-browser-warning": "true" },
      }).then(async (response) => {
        if (!response.ok) throw new Error("Unable to load doctors.");
        return response.json();
      }),
      fetch(SCHEDULE_SETTINGS_API, {
        headers: { "ngrok-skip-browser-warning": "true" },
      }).then(async (response) => {
        if (!response.ok) throw new Error("Unable to load schedule settings.");
        return response.json();
      }),
    ]).then(([doctorResult, settingsResult]) => {
      if (doctorResult.status === "fulfilled") {
        const rows = parseListResponse(doctorResult.value)
          .map(normalizeDoctor)
          .filter((doctor) => doctor.id !== "");
        setDoctors(rows);
        if (rows.length > 0) setDoctorId(String(rows[0].id));
      }

      if (settingsResult.status === "fulfilled") {
        const settings =
          settingsResult.value?.data || settingsResult.value || {};
        setWorkStart(
          normalizeTime(
            settings.clinicOpen,
            DEFAULT_SCHEDULE_SETTINGS.clinicOpen
          )
        );
        setWorkEnd(
          normalizeTime(
            settings.clinicClose,
            DEFAULT_SCHEDULE_SETTINGS.clinicClose
          )
        );
        setSlotDuration(
          String(
            settings.slotDuration || DEFAULT_SCHEDULE_SETTINGS.slotDuration
          )
        );
      }
    });
  }, []);

  useEffect(() => {
    if (!doctorId || !previewDate) return;

    setIsFetchingSlots(true);
    fetch(
      `${SCHEDULE_API}/day-slots?doctorId=${encodeURIComponent(
        doctorId
      )}&date=${encodeURIComponent(previewDate)}`,
      { headers: { "ngrok-skip-browser-warning": "true" } }
    )
      .then((response) => {
        if (!response.ok) throw new Error("Failed to fetch slots");
        return response.json();
      })
      .then((data) => setPreviewSlots(parseListResponse(data)))
      .catch(() => setPreviewSlots([]))
      .finally(() => setIsFetchingSlots(false));
  }, [doctorId, previewDate, slotRefreshKey]);

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
    setSaveMessage("");
    if (!endDate || value > endDate) setEndDate(value);
  };

  const handleSave = async () => {
    setHasSaveError(true);

    if (!doctorId || !startDate || !endDate || days.length === 0) {
      setSaveMessage(
        "Select a doctor, at least one working day, and a date range."
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
      doctorId: Number(doctorId),
      days,
      startDate,
      endDate,
      workStart: formatTimeForApi(resolvedTimes.workStart),
      workEnd: formatTimeForApi(resolvedTimes.workEnd),
      breakStart: formatTimeForApi(resolvedTimes.breakStart),
      breakEnd: formatTimeForApi(resolvedTimes.breakEnd),
      slotDuration: resolvedTimes.slotDuration,
    };

    try {
      const response = await fetch(SCHEDULE_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(response, "Unable to create the schedule.")
        );
      }

      const data = await response.json().catch(() => ({}));
      setHasSaveError(false);
      setSaveMessage(
        data?.message ||
          `Schedule created for ${scheduledDates.length} working days.`
      );
      setPreviewDate(scheduledDates[0].value);
      setSlotRefreshKey((value) => value + 1);
      navigate("/doctors", { replace: true });
    } catch (error) {
      setHasSaveError(true);
      setSaveMessage(error.message || "Unable to create the schedule.");
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
      <h2>Doctor Schedule</h2>
      <p>Create availability from working days and a date range</p>

      <div className="schedule-container">
        <div className="left">
          <label htmlFor="schedule-doctor">Doctor</label>
          <select
            id="schedule-doctor"
            value={doctorId}
            onChange={(event) => setDoctorId(event.target.value)}
          >
            {!doctors.length ? <option value="">No doctors found</option> : null}
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                Dr. {doctor.name || doctor.id}
                {doctor.specialization ? ` - ${doctor.specialization}` : ""}
              </option>
            ))}
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
                type="time"
                value={workStart}
                onChange={(event) => {
                  setWorkStart(event.target.value);
                  setSaveMessage("");
                }}
              />
            </div>

            <div>
              <label htmlFor="schedule-work-end">End Time</label>
              <input
                id="schedule-work-end"
                type="time"
                value={workEnd}
                onChange={(event) => {
                  setWorkEnd(event.target.value);
                  setSaveMessage("");
                }}
              />
            </div>

            <div>
              <label htmlFor="schedule-break-start">Break Start</label>
              <input
                id="schedule-break-start"
                type="time"
                value={breakStart}
                onChange={(event) => {
                  setBreakStart(event.target.value);
                  setSaveMessage("");
                }}
              />
            </div>

            <div>
              <label htmlFor="schedule-break-end">Break End</label>
              <input
                id="schedule-break-end"
                type="time"
                value={breakEnd}
                onChange={(event) => {
                  setBreakEnd(event.target.value);
                  setSaveMessage("");
                }}
              />
            </div>

            <div>
              <label htmlFor="schedule-slot-duration">Slot Duration</label>
              <select
                id="schedule-slot-duration"
                value={slotDuration}
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
            disabled={isSaving || !doctorId}
          >
            {isSaving
              ? "Saving..."
              : `Save Schedule (${scheduledDates.length} days)`}
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
            ) : previewSlots.length > 0 ? (
              previewSlots.map((slot, index) => {
                const slotStart = String(
                  slot.start || slot.startTime || ""
                ).slice(0, 5);
                const slotEnd = String(slot.end || slot.endTime || "").slice(
                  0,
                  5
                );
                const isBooked = isBookedSlot(slot);
                const isCompleted = !isBooked && (isTimeOutSlot(slot) || isCompletedSlot(slotEnd, previewDate));
                const statusClass = isBooked
                  ? "booked"
                  : isCompleted
                    ? "completed"
                    : "available";
                const statusLabel = isBooked
                  ? "Booked"
                  : isCompleted
                    ? "Time Out"
                    : "Available";

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
