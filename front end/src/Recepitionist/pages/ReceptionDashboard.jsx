import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  CalendarPlus,
  CheckCircle,
  Clock,
  ClipboardList,
  UserPlus,
} from "lucide-react";
import { formatToday, parseList, requestJson } from "../receptionApi";
import { getReceptionistScope, scopeReceptionistRecords } from "../receptionScope";

const normalizeKey = (key) => String(key || "").toLowerCase();

const getNestedValueByKey = (source, keys = []) => {
  if (!source || typeof source !== "object") return "";
  const wantedKeys = new Set(keys.map(normalizeKey));
  const queue = [source];
  const seen = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);

    for (const [key, value] of Object.entries(current)) {
      if (wantedKeys.has(normalizeKey(key)) && value !== undefined && value !== null && String(value).trim() !== "") {
        return value;
      }
      if (value && typeof value === "object") queue.push(value);
    }
  }

  return "";
};

const getAppointmentDate = (appointment = {}) =>
  String(
    appointment.date ??
      appointment.appointmentDate ??
      appointment.AppointmentDate ??
      appointment.appointment?.date ??
      appointment.appointment?.Date ??
      appointment.Appointment?.Date ??
      appointment.bookingDate ??
      appointment.BookingDate ??
      appointment.Date ??
      appointment.scheduledDate ??
      appointment.ScheduledDate ??
      appointment.slotDate ??
      appointment.SlotDate ??
      appointment.appointment?.slotDate ??
      appointment.Appointment?.SlotDate ??
      getNestedValueByKey(appointment, [
        "appointmentDate",
        "date",
        "scheduledDate",
        "slotDate",
        "bookingDate",
        "appointmentDateTime",
        "dateTime",
        "createdAt",
      ]) ??
      ""
  ).trim();

const isTodayAppointment = (appointment = {}, todayDate = formatToday()) => {
  if (appointment.__dashboardToday) return true;

  const value = getAppointmentDate(appointment);
  if (!value) return false;

  if (value.startsWith(todayDate)) return true;

  const isoDateTimeMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (isoDateTimeMatch) {
    const [, year, month, day, hour, minute, second = "00"] = isoDateTimeMatch;
    if (hour === "00" && minute === "00" && second === "00") {
      return `${year}-${month}-${day}` === todayDate;
    }

    const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value);
    const date = new Date(hasTimezone ? value : `${value}Z`);
    if (!Number.isNaN(date.getTime())) {
      const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return localDate === todayDate;
    }
  }

  const [dateDay, dateMonth, dateYear] = value.split(/[/-]/).map((part) => part.trim());
  if (dateYear?.length === 4 && dateMonth && dateDay) {
    const normalizedDate = `${dateYear}-${dateMonth.padStart(2, "0")}-${dateDay.padStart(2, "0")}`;
    if (normalizedDate === todayDate) return true;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return false;

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` === todayDate;
};

const getAppointmentPatientName = (appointment = {}) =>
  appointment.patientName ??
  appointment.PatientName ??
  appointment.name ??
  appointment.Name ??
  appointment.patient?.name ??
  appointment.patient?.fullName ??
  appointment.patient?.patientName ??
  appointment.Patient?.Name ??
  appointment.Patient?.FullName ??
  appointment.Patient?.PatientName ??
  getNestedValueByKey(appointment, [
    "patientName",
    "fullName",
    "name",
    "patient",
  ]) ??
  "-";

const getAppointmentDoctorName = (appointment = {}) =>
  appointment.doctorName ??
  appointment.DoctorName ??
  appointment.doctorFullName ??
  appointment.DoctorFullName ??
  appointment.doctor?.name ??
  appointment.doctor?.fullName ??
  appointment.Doctor?.Name ??
  appointment.Doctor?.FullName ??
  getNestedValueByKey(appointment, [
    "doctorName",
    "doctorFullName",
    "doctor",
    "name",
  ]) ??
  "-";

const getAppointmentTime = (appointment = {}) =>
  appointment.time ??
  appointment.Time ??
  appointment.startTime ??
  appointment.StartTime ??
  appointment.slotTime ??
  appointment.SlotTime ??
  appointment.timeSlot ??
  appointment.TimeSlot ??
  appointment.slot ??
  appointment.Slot ??
  getNestedValueByKey(appointment, [
    "time",
    "startTime",
    "slotTime",
    "timeSlot",
    "slot",
  ]) ??
  "-";

const getAppointmentStatus = (appointment = {}) => {
  const rawStatus = String(
    appointment.status ??
      appointment.Status ??
      appointment.appointmentStatus ??
      appointment.AppointmentStatus ??
      getNestedValueByKey(appointment, ["status", "appointmentStatus"]) ??
      ""
  )
    .trim()
    .toLowerCase();

  if (["completed", "complete", "consulted", "done"].includes(rawStatus)) return "Completed";
  if (["in progress", "in-progress", "progress", "ongoing", "consulting"].includes(rawStatus)) return "In Progress";
  return "Waiting";
};

const getAppointmentId = (appointment = {}) =>
  String(
    appointment.id ??
      appointment.Id ??
      appointment.appointmentId ??
      appointment.AppointmentId ??
      appointment.appointmentID ??
      appointment.AppointmentID ??
      ""
  ).trim();

const dedupeAppointments = (appointments = []) => {
  const seen = new Set();

  return appointments.filter((appointment, index) => {
    const id = getAppointmentId(appointment);
    const key = id || `${getAppointmentPatientName(appointment)}-${getAppointmentDoctorName(appointment)}-${getAppointmentDate(appointment)}-${getAppointmentTime(appointment)}-${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getDashboardAppointmentSources = (dashboardData) => {
  const direct = parseList(dashboardData);
  const nestedKeys = [
    "appointments",
    "todayAppointments",
    "todaysAppointments",
    "todayAppointmentList",
    "appointmentList",
    "waitingAppointments",
    "waitingPatients",
    "queue",
  ];
  const nested = nestedKeys.flatMap((key) => parseList(dashboardData?.[key] ?? dashboardData?.data?.[key] ?? dashboardData?.result?.[key]));

  return [...direct, ...nested].map((appointment) =>
    appointment && typeof appointment === "object"
      ? { ...appointment, __dashboardToday: true }
      : appointment
  );
};

function ReceptionDashboard() {
  const navigate = useNavigate();
  const receptionistScope = useMemo(() => getReceptionistScope(), []);
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState({ today: 0, waiting: 0, completed: 0 });

  useEffect(() => {
    const buildDashboardState = (appointmentSources) => {
      const appointmentList = dedupeAppointments(scopeReceptionistRecords(
        appointmentSources.flatMap((source) => parseList(source)),
        receptionistScope,
        { allowMissingClinic: true, allowMissingBranch: true }
      ));
      const todayDate = formatToday();
      const todays = appointmentList.filter((item) => isTodayAppointment(item, todayDate));

      setStats({
        today: todays.length,
        waiting: todays.filter((item) =>
          getAppointmentStatus(item) === "Waiting"
        ).length,
        completed: todays.filter((item) =>
          getAppointmentStatus(item) === "Completed"
        ).length,
      });
      setAppointments(todays);
    };

    const loadDashboard = async () => {
      try {
        const [dashboardData, appointmentData, offlineAppointmentData, onlineAppointmentData] = await Promise.all([
          requestJson("ReceptionistDashboard"),
          requestJson("Appointment").catch(() => []),
          requestJson("Appointment/offline").catch(() => []),
          requestJson("Appointment/online").catch(() => []),
        ]);
        buildDashboardState([
          getDashboardAppointmentSources(dashboardData),
          appointmentData,
          offlineAppointmentData,
          onlineAppointmentData,
        ]);
      } catch (dashboardError) {
        Promise.all([
          requestJson("Appointment").catch(() => []),
          requestJson("Appointment/offline").catch(() => []),
          requestJson("Appointment/online").catch(() => []),
        ])
          .then(buildDashboardState)
          .catch(() => {
            setStats({ today: 0, waiting: 0, completed: 0 });
            setAppointments([]);
          });
      }
    };

    loadDashboard();
  }, [receptionistScope]);

  const todayDate = formatToday();
  const latest = appointments;

  return (
    <section className="rc-page">
      <div className="rc-page-head">
        <div>
          <h2>Reception Dashboard</h2>
          <p>View today's schedule, waiting queue, and front desk actions.</p>
        </div>
        <div className="rc-head-actions">
          <button className="rc-btn" onClick={() => navigate("/reception/appointments")}>
            <CalendarPlus size={16} /> Book Appointment
          </button>
          <button className="rc-btn primary" onClick={() => navigate("/reception/patients")}>
            <UserPlus size={16} /> Add Patient
          </button>
        </div>
      </div>

      <div className="rc-stat-grid">
        <article className="rc-stat-card">
          <div className="rc-stat-icon blue">
            <CalendarCheck size={22} />
          </div>
          <span>Today</span>
          <p>Today's Appointments</p>
          <strong>{stats.today}</strong>
        </article>
        <article className="rc-stat-card">
          <div className="rc-stat-icon amber">
            <Clock size={22} />
          </div>
          <span>Today</span>
          <p>Waiting Patients</p>
          <strong>{stats.waiting}</strong>
        </article>
        <article className="rc-stat-card">
          <div className="rc-stat-icon green">
            <CheckCircle size={22} />
          </div>
          <span>Today</span>
          <p>Completed Appointments</p>
          <strong>{stats.completed}</strong>
        </article>
      </div>

      <div className="rc-action-grid">
        <button onClick={() => navigate("/reception/patients")}>
          <UserPlus size={22} />
          <span>
            <strong>Patients</strong>View and register patients
          </span>
        </button>
        <button onClick={() => navigate("/reception/appointments")}>
          <CalendarPlus size={22} />
          <span>
            <strong>Appointments</strong>Book and manage appointments
          </span>
        </button>
        <button onClick={() => navigate("/reception/billing")}>
          <ClipboardList size={22} />
          <span>
            <strong>Billing</strong>Create and review invoices
          </span>
        </button>
      </div>

      <div className="rc-card">
        <div className="rc-card-head">
          <div>
            <h3>Appointment List</h3>
            <p>{todayDate}</p>
          </div>
          <button className="rc-btn small" onClick={() => navigate("/reception/appointments")}>
            Manage
          </button>
        </div>
        <div className="rc-table compact">
          <div className="rc-table-head four">
            <span>S.No.</span>
            <span>Patient</span>
            <span>Doctor</span>
            <span>Time</span>
            <span>Status</span>
          </div>
          {latest.length ? (
            latest.map((item, index) => (
              <div className="rc-table-row four" key={item.id || item.appointmentId}>
                <span>{index + 1}</span>
                <span>{getAppointmentPatientName(item)}</span>
                <span>{getAppointmentDoctorName(item)}</span>
                <span>{getAppointmentTime(item)}</span>
                <span>{getAppointmentStatus(item)}</span>
              </div>
            ))
          ) : (
            <div className="rc-empty">No appointments found.</div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ReceptionDashboard;

