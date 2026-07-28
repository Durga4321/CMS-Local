import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { apiUrl } from "../config/api";
import { getReceptionistScope, scopeReceptionistRecords } from "../Recepitionist/receptionScope";
import "./ConsultantRoomDisplay.css";

const appointmentKeys = {
  id: ["appointmentId", "AppointmentId", "id", "Id"],
  doctorId: ["doctorId", "DoctorId", "doctor.id", "doctor.doctorId"],
  doctorName: ["doctorName", "DoctorName", "doctor.name", "doctor.fullName"],
  patientName: ["patientName", "PatientName", "patient.name", "patient.fullName"],
  room: ["roomNumber", "RoomNumber", "room", "Room", "doctor.roomNumber", "doctor.room"],
  date: ["date", "appointmentDate", "AppointmentDate", "scheduledDate", "slotDate", "SlotDate"],
  time: ["time", "slot", "Slot", "startTime", "StartTime", "slotTime", "SlotTime", "appointmentTime", "AppointmentTime"],
  status: ["status", "appointmentStatus", "AppointmentStatus", "Status"],
};

const doctorKeys = {
  id: ["doctorId", "DoctorId", "id", "Id"],
  name: ["name", "doctorName", "DoctorName", "fullName", "doctor.fullName"],
  room: ["roomNumber", "RoomNumber", "room", "Room"],
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

const isCompleted = (appointment) =>
  ["completed", "complete", "cancelled", "canceled"].includes(
    normalizeStatus(readFirst(appointment, appointmentKeys.status, ""))
  );

const displayStatus = (status, hasPatient) => {
  const normalized = normalizeStatus(status);
  if (normalized.includes("progress") || normalized.includes("procedure")) return "In Procedure";
  if (normalized === "completed") return "Completed";
  if (hasPatient) return "In";
  return normalized ? status : "--";
};

const statusClass = (status) => {
  const normalized = normalizeStatus(status);
  if (normalized.includes("procedure") || normalized.includes("progress")) return "is-procedure";
  if (normalized === "completed") return "is-completed";
  if (normalized === "in") return "is-in";
  return "";
};

const buildRooms = (doctors, appointments) => {
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
        room: readFirst(appointment, appointmentKeys.room, "--"),
        appointments: [],
      });
    }
    groups.get(key).appointments.push(appointment);
  });

  return Array.from(groups.values())
    .map((room) => {
      const active =
        room.appointments.find((appointment) => normalizeStatus(readFirst(appointment, appointmentKeys.status, "")).includes("progress")) ||
        room.appointments.find((appointment) => !isCompleted(appointment));
      const status = displayStatus(readFirst(active, appointmentKeys.status, ""), Boolean(active));

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

      const [doctorResponse, appointmentResponse] = await Promise.all([
        fetch(doctorsUrl, { headers }),
        fetch(apiUrl("Appointment"), { headers }),
      ]);

      if (!doctorResponse.ok) throw new Error("Unable to load branch doctors.");
      if (!appointmentResponse.ok) throw new Error("Unable to load consultant room display.");

      const doctorList = parseList(await doctorResponse.json());
      const appointmentList = parseList(await appointmentResponse.json());

      setDoctors(scopeReceptionistRecords(doctorList, receptionistScope, { allowMissingClinic: true }));
      setAppointments(scopeReceptionistRecords(appointmentList, receptionistScope, { allowMissingClinic: true }));
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

  const rooms = useMemo(() => buildRooms(doctors, appointments), [appointments, doctors]);

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
