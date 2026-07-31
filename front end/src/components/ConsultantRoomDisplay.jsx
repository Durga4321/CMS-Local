import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { apiUrl } from "../config/api";
import { getReceptionistScope, scopeReceptionistRecords } from "../Recepitionist/receptionScope";
import "./ConsultantRoomDisplay.css";

const appointmentKeys = {
  id: ["appointmentId", "AppointmentId", "id", "Id"],
  doctorId: ["doctorId", "DoctorId", "doctor.id", "doctor.doctorId"],
  doctorName: ["doctorName", "DoctorName", "doctor.name", "doctor.fullName"],
  doctorEmail: ["doctorEmail", "DoctorEmail", "doctor.email", "doctor.emailAddress"],
  patientName: ["patientName", "PatientName", "patient.name", "patient.fullName"],
  room: ["roomNumber", "RoomNumber", "roomNo", "RoomNo", "room", "Room", "consultationRoom", "ConsultationRoom", "consultationRoomNumber", "ConsultationRoomNumber", "doctor.roomNumber", "doctor.RoomNumber", "doctor.roomNo", "doctor.room", "doctor.consultationRoom"],
  date: ["date", "appointmentDate", "AppointmentDate", "scheduledDate", "slotDate", "SlotDate"],
  time: ["time", "slot", "Slot", "startTime", "StartTime", "slotTime", "SlotTime", "appointmentTime", "AppointmentTime"],
  status: ["status", "appointmentStatus", "AppointmentStatus", "Status"],
};

const doctorKeys = {
  id: ["doctorId", "DoctorId", "id", "Id"],
  name: ["name", "doctorName", "DoctorName", "fullName", "doctor.fullName"],
  email: ["email", "Email", "emailAddress", "EmailAddress"],
  room: ["roomNumber", "RoomNumber", "roomNo", "RoomNo", "room", "Room", "consultationRoom", "ConsultationRoom", "consultationRoomNumber", "ConsultationRoomNumber"],
  status: ["status", "Status", "loginStatus", "LoginStatus", "availabilityStatus", "AvailabilityStatus"],
  isOnline: ["isOnline", "IsOnline", "online", "Online", "isLoggedIn", "IsLoggedIn", "loggedIn", "LoggedIn"],
  loginTime: ["loginTime", "LoginTime", "lastLogin", "LastLogin", "lastLoginAt", "LastLoginAt"],
  logoutTime: ["logoutTime", "LogoutTime", "loggedOutAt", "LoggedOutAt", "logoutAt", "LogoutAt"],
  workStart: ["workStart", "WorkStart", "startTime", "StartTime", "clinicOpen", "ClinicOpen"],
  workEnd: ["workEnd", "WorkEnd", "endTime", "EndTime", "clinicClose", "ClinicClose"],
};

const loginKeys = {
  doctorId: ["doctorId", "DoctorId", "userId", "UserId", "id", "Id"],
  name: ["doctorName", "DoctorName", "userName", "UserName", "name", "Name"],
  email: ["doctorEmail", "DoctorEmail", "email", "Email", "emailAddress", "EmailAddress"],
  role: ["role", "Role", "roleName", "RoleName"],
  status: ["status", "Status"],
  isOnline: ["isOnline", "IsOnline", "online", "Online"],
  loginTime: ["loginTime", "LoginTime", "lastLogin", "LastLogin", "timestamp", "Timestamp", "createdAt", "CreatedAt"],
  logoutTime: ["logoutTime", "LogoutTime", "loggedOutAt", "LoggedOutAt", "logoutAt", "LogoutAt"],
};

const scheduleKeys = {
  doctorId: ["doctorId", "DoctorId", "doctor.id", "doctor.doctorId"],
  doctorName: ["doctorName", "DoctorName", "doctor.name", "name", "Name"],
  date: ["date", "Date", "scheduledDate", "ScheduledDate", "slotDate", "SlotDate", "workDate", "WorkDate"],
  dates: ["dates", "Dates", "scheduledDates", "ScheduledDates"],
  workStart: ["workStart", "WorkStart", "startTime", "StartTime", "clinicOpen", "ClinicOpen"],
  workEnd: ["workEnd", "WorkEnd", "endTime", "EndTime", "clinicClose", "ClinicClose"],
};

const readValue = (source, key) => {
  const parts = String(key).split(".");
  let current = source;

  for (const part of parts) {
    if (!current || typeof current !== "object") return "";
    current = current[part];
  }

  return current ?? "";
};

const readFirst = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = readValue(source, key);
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }

  return fallback;
};

const parseList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.appointments)) return data.data.appointments;
  if (Array.isArray(data?.data?.doctors)) return data.data.doctors;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.result?.appointments)) return data.result.appointments;
  if (Array.isArray(data?.result?.doctors)) return data.result.doctors;
  if (Array.isArray(data?.appointments)) return data.appointments;
  if (Array.isArray(data?.doctors)) return data.doctors;
  return [];
};

const getAuthHeaders = () => {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("receptionistToken") ||
    localStorage.getItem("adminToken") ||
    "";

  return {
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const normalizeDate = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toISOString().slice(0, 10);
};

const todayKey = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseTimeToMinutes = (value) => {
  const text = String(value || "").trim();
  if (!text) return Number.MAX_SAFE_INTEGER;
  const start = text.split(/\s*[-–]\s*/)[0].trim();
  const match = start.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return Number.MAX_SAFE_INTEGER;

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = (match[3] || "").toLowerCase();
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

const normalizeIdentity = (value) =>
  String(value || "")
    .trim()
    .replace(/^dr\.\s*/i, "")
    .toLowerCase();

const isTruthyStatus = (value) => {
  const normalized = normalizeStatus(value);
  return value === true || ["true", "active", "online", "in", "1", "yes"].includes(normalized);
};

const isOfflineStatus = (value) => {
  const normalized = normalizeStatus(value);
  return value === false || ["false", "inactive", "offline", "out", "0", "no"].includes(normalized);
};

const isTodayTimestamp = (value) => {
  const text = String(value || "").trim();
  if (!text) return false;
  const date = normalizeDate(text);
  return date === todayKey();
};

const isLoginActive = (record = {}) => {
  const status = readFirst(record, loginKeys.status, "");
  const isOnline = readFirst(record, loginKeys.isOnline, "");
  const loginTime = readFirst(record, loginKeys.loginTime, "");
  const logoutTime = readFirst(record, loginKeys.logoutTime, "");
  const action = normalizeStatus(readFirst(record, ["action", "Action", "systemAction", "SystemAction"], ""));

  if (logoutTime || action.includes("logout") || action.includes("logged out")) return false;
  if (isOfflineStatus(status) || isOfflineStatus(isOnline)) return false;
  if (isTruthyStatus(status) || isTruthyStatus(isOnline)) return true;
  return isTodayTimestamp(loginTime);
};

const sameDoctor = (doctor = {}, record = {}, recordKeys = loginKeys) => {
  const doctorId = String(readFirst(doctor, doctorKeys.id, "")).trim();
  const doctorName = normalizeIdentity(readFirst(doctor, doctorKeys.name, ""));
  const doctorEmail = normalizeIdentity(readFirst(doctor, doctorKeys.email, ""));
  const recordId = String(readFirst(record, [recordKeys.doctorId, recordKeys.id].flat().filter(Boolean), "")).trim();
  const recordName = normalizeIdentity(readFirst(record, [recordKeys.doctorName, recordKeys.name].flat().filter(Boolean), ""));
  const recordEmail = normalizeIdentity(readFirst(record, [recordKeys.doctorEmail, recordKeys.email].flat().filter(Boolean), ""));

  return Boolean(
    (doctorId && recordId && doctorId === recordId) ||
    (doctorEmail && recordEmail && doctorEmail === recordEmail) ||
    (doctorName && recordName && doctorName === recordName)
  );
};

const isWithinWorkingTime = (doctor = {}, schedule = null) => {
  const start = readFirst(schedule || {}, scheduleKeys.workStart, readFirst(doctor, doctorKeys.workStart, ""));
  const end = readFirst(schedule || {}, scheduleKeys.workEnd, readFirst(doctor, doctorKeys.workEnd, ""));
  if (!start || !end) return true;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= parseTimeToMinutes(start) && nowMinutes <= parseTimeToMinutes(end);
};

const scheduleAppliesToday = (schedule = {}) => {
  const today = todayKey();
  const date = readFirst(schedule, scheduleKeys.date, "");
  if (date) return normalizeDate(date) === today;

  const dates = readFirst(schedule, scheduleKeys.dates, "");
  if (Array.isArray(dates)) return dates.some((item) => normalizeDate(item?.value || item?.date || item) === today);

  return true;
};

const isCompleted = (appointment) =>
  ["completed", "complete", "cancelled", "canceled"].includes(
    normalizeStatus(readFirst(appointment, appointmentKeys.status, ""))
  );

const displayStatus = (status, hasPatient, isDoctorIn) => {
  const normalized = normalizeStatus(status);
  if (normalized === "completed") return "Completed";
  if (!isDoctorIn && hasPatient) return "Out";
  if (normalized.includes("progress") || normalized.includes("procedure")) return "In Procedure";
  if (isDoctorIn) return "In";
  return normalized ? status : "--";
};

const statusClass = (status) => {
  const normalized = normalizeStatus(status);
  if (normalized.includes("procedure") || normalized.includes("progress")) return "is-procedure";
  if (normalized === "completed") return "is-completed";
  if (normalized === "in") return "is-in";
  if (normalized === "out") return "is-out";
  return "";
};

const buildRooms = (doctors, appointments, logins = [], schedules = []) => {
  const today = todayKey();
  const todaysAppointments = appointments
    .filter((appointment) => normalizeDate(readFirst(appointment, appointmentKeys.date, "")) === today)
    .sort((left, right) => parseTimeToMinutes(readFirst(left, appointmentKeys.time, "")) - parseTimeToMinutes(readFirst(right, appointmentKeys.time, "")));

  const groups = new Map();
  doctors.forEach((doctor) => {
    const doctorId = readFirst(doctor, doctorKeys.id, "");
    const doctorName = readFirst(doctor, doctorKeys.name, "Doctor");
    const key = doctorId || doctorName;
    groups.set(key, {
      key,
      doctorName,
      doctor,
      room: readFirst(doctor, doctorKeys.room, "--"),
      appointments: [],
    });
  });

  todaysAppointments.forEach((appointment) => {
    const doctorId = readFirst(appointment, appointmentKeys.doctorId, "");
    const doctorName = readFirst(appointment, appointmentKeys.doctorName, "Doctor");
    const key = doctorId || doctorName;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        doctorName,
        doctor: appointment,
        room: readFirst(appointment, appointmentKeys.room, "--"),
        appointments: [],
      });
    }
    const group = groups.get(key);
    if (!group.room || group.room === "--") group.room = readFirst(appointment, appointmentKeys.room, "--");
    group.appointments.push(appointment);
  });

  return Array.from(groups.values())
    .map((room) => {
      const doctor = room.doctor || {};
      const doctorLogin = logins.find((login) => {
        const role = normalizeStatus(readFirst(login, loginKeys.role, ""));
        return (!role || role.includes("doctor")) && sameDoctor(doctor, login, loginKeys);
      });
      const doctorSchedule = schedules.find((schedule) => sameDoctor(doctor, schedule, scheduleKeys) && scheduleAppliesToday(schedule));
      const hasDoctorLoggedIn = doctorLogin ? isLoginActive(doctorLogin) : isTruthyStatus(readFirst(doctor, doctorKeys.isOnline, readFirst(doctor, doctorKeys.status, "")));
      const isDoctorIn = hasDoctorLoggedIn && isWithinWorkingTime(doctor, doctorSchedule);
      const active =
        room.appointments.find((appointment) => normalizeStatus(readFirst(appointment, appointmentKeys.status, "")).includes("progress")) ||
        room.appointments.find((appointment) => !isCompleted(appointment));
      const status = displayStatus(readFirst(active, appointmentKeys.status, ""), Boolean(active), isDoctorIn);

      return {
        ...room,
        currentPatient: active ? readFirst(active, appointmentKeys.patientName, "--") : "--",
        status,
      };
    })
    .sort((left, right) => left.doctorName.localeCompare(right.doctorName));
};

function ConsultantRoomDisplay({ audience = "doctor" }) {
  const receptionistScope = useMemo(() => getReceptionistScope(), []);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [logins, setLogins] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDisplay = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      const headers = getAuthHeaders();
      const branchId = String(receptionistScope.branchId || "").trim();
      const doctorsUrl = branchId
        ? apiUrl(`Doctor/branch/${encodeURIComponent(branchId)}`)
        : apiUrl("Doctor");

      const loginUrl = branchId
        ? apiUrl(`Dashboard/today-logins?branchId=${encodeURIComponent(branchId)}`)
        : apiUrl("Dashboard/today-logins");

      const [doctorResponse, appointmentResponse, loginResult, scheduleResult] = await Promise.all([
        fetch(doctorsUrl, { headers }),
        fetch(apiUrl("Appointment"), { headers }),
        fetch(loginUrl, { headers }).then((response) => response.ok ? response.json() : []),
        fetch(apiUrl("Schedule"), { headers }).then((response) => response.ok ? response.json() : []),
      ]);

      if (!doctorResponse.ok) throw new Error("Unable to load branch doctors.");
      if (!appointmentResponse.ok) throw new Error("Unable to load consultant room display.");

      const doctorList = parseList(await doctorResponse.json());
      const appointmentList = parseList(await appointmentResponse.json());

      setDoctors(scopeReceptionistRecords(doctorList, receptionistScope, { allowMissingClinic: true }));
      setAppointments(scopeReceptionistRecords(appointmentList, receptionistScope, { allowMissingClinic: true }));
      setLogins(scopeReceptionistRecords(parseList(loginResult), receptionistScope, { allowMissingClinic: true }));
      setSchedules(scopeReceptionistRecords(parseList(scheduleResult), receptionistScope, { allowMissingClinic: true }));
    } catch (err) {
      setError(err.message || "Unable to load consultant room display.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [receptionistScope]);

  useEffect(() => {
    loadDisplay();
    const timer = window.setInterval(() => loadDisplay({ silent: true }), 15000);
    return () => window.clearInterval(timer);
  }, [loadDisplay]);

  const rooms = useMemo(() => buildRooms(doctors, appointments, logins, schedules), [appointments, doctors, logins, schedules]);

  return (
    <section className={`cr-display cr-display--${audience}`}>
      <div className="cr-toolbar">
        <div>
          <h2>Consultant Room Display</h2>
          <p>Live doctor and current patient queue for today.</p>
        </div>
        <button type="button" onClick={() => loadDisplay({ silent: true })} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? "cr-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="cr-board">
        <div className="cr-board-head">
          <div>Consultant Room</div>
          <div>Now</div>
        </div>

        {error ? <div className="cr-state">{error}</div> : null}
        {loading ? <div className="cr-state">Loading display...</div> : null}
        {!loading && !error && rooms.length === 0 ? <div className="cr-state">No appointments found for today.</div> : null}

        {!loading && !error && rooms.map((room) => (
          <div className="cr-row" key={room.key}>
            <div className="cr-consultant">
              <p>
                {room.doctorName} <span className={statusClass(room.status)}>{room.status}</span>
              </p>
              <strong>Room {room.room || "--"}</strong>
            </div>
            <div className="cr-now">{room.currentPatient}</div>
          </div>
        ))}

        <div className="cr-footer">
          <span>Grievance Number : 9091922233</span>
          <span>Grievance Email ID : grievance@vimshospitals.com</span>
        </div>
      </div>
    </section>
  );
}

export default ConsultantRoomDisplay;
