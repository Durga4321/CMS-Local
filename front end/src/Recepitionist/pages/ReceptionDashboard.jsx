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
import { formatToday, parseList, requestJson as defaultRequestJson } from "../receptionApi";
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
      ]) ??
      ""
  ).trim();

const getLocalDateKey = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "";

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const dmyMatch = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:$|[\s,])/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${String(dmyMatch[2]).padStart(2, "0")}-${String(dmyMatch[1]).padStart(2, "0")}`;
  }

  const parsedDate = new Date(text);
  if (Number.isNaN(parsedDate.getTime())) return "";
  return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}`;
};

const isTodayAppointment = (appointment = {}, todayDate = formatToday()) => {
  if (appointment.__dashboardToday) return true;

  return getLocalDateKey(getAppointmentDate(appointment)) === todayDate;
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

function ReceptionDashboard({
  hideActions = false,
  hideCards = false,
  title = "Reception Dashboard",
  apiRequest = defaultRequestJson,
  getScope = getReceptionistScope,
  scopeRecords = scopeReceptionistRecords,
}) {
  const navigate = useNavigate();
  const receptionistScope = useMemo(() => getScope(), [getScope]);
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState({ today: 0, waiting: 0, completed: 0 });

  useEffect(() => {
    const buildDashboardState = (appointmentSources) => {
      const appointmentList = dedupeAppointments(scopeRecords(
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
          apiRequest("ReceptionistDashboard"),
          apiRequest("Appointment").catch(() => []),
          apiRequest("Appointment/offline").catch(() => []),
          apiRequest("Appointment/online").catch(() => []),
        ]);
        buildDashboardState([
          getDashboardAppointmentSources(dashboardData),
          appointmentData,
          offlineAppointmentData,
          onlineAppointmentData,
        ]);
      } catch (dashboardError) {
        Promise.all([
          apiRequest("Appointment").catch(() => []),
          apiRequest("Appointment/offline").catch(() => []),
          apiRequest("Appointment/online").catch(() => []),
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
          <h2>{title}</h2>
          <p>View today's schedule, waiting queue, and front desk actions.</p>
        </div>
        {!hideActions && (
          <div className="rc-head-actions">
            <button className="rc-btn" onClick={() => navigate("/reception/appointments")}>
              <CalendarPlus size={16} /> Book Appointment
            </button>
            <button className="rc-btn primary" onClick={() => navigate("/reception/patients")}>
              <UserPlus size={16} /> Add Patient
            </button>
          </div>
        )}
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

      {!hideCards && (
        <div className="rc-action-grid">
          <button onClick={() => navigate("/reception/appointments")}> 
            <ClipboardList size={22} />
            <span>
              <strong>OP Billing</strong> Book and manage outpatient billing (open appointment)
            </span>
          </button>
          <button onClick={() => navigate("/reception/billing?mode=diagnostic")}>
            <ClipboardList size={22} />
            <span>
              <strong>Diagnostic Billing</strong> Create diagnostic invoices
            </span>
          </button>
          <button onClick={() => navigate("/reception/billing?mode=pharmacy")}>
            <ClipboardList size={22} />
            <span>
              <strong>Pharmacy Billing</strong> Create pharmacy invoices
            </span>
          </button>
        </div>
      )}

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

