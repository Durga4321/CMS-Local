import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, CheckCircle, Clock, HeartPulse, ListChecks, Users } from "lucide-react";
import { parseList, requestJson } from "./nurseApi";
import { getNurseScope, scopeNurseRecords } from "./nurseScope";

const firstValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");

const normalizeStatus = (value = "") => {
  const status = String(value || "").trim().toLowerCase();
  if (status.includes("complete") || status.includes("done")) return "Completed";
  if (status.includes("consult") || status.includes("progress")) return "In Consultation";
  if (status.includes("cancel")) return "Cancelled";
  if (status.includes("wait") || status.includes("book") || status.includes("pending")) return "Waiting";
  return value ? String(value) : "Waiting";
};

const getAppointmentId = (appointment = {}) =>
  firstValue(appointment.appointmentId, appointment.AppointmentId, appointment.id, appointment.Id) || "";

const getAppointmentPatientName = (appointment = {}) =>
  firstValue(
    appointment.patientName,
    appointment.PatientName,
    appointment.patient?.name,
    appointment.patient?.fullName,
    appointment.Patient?.Name,
    appointment.Patient?.FullName,
    appointment.name,
    appointment.Name
  ) || "Patient";

const getAppointmentDoctorName = (appointment = {}) =>
  firstValue(
    appointment.doctorName,
    appointment.DoctorName,
    appointment.doctor?.name,
    appointment.Doctor?.Name,
    appointment.providerName
  ) || "-";

const getAppointmentTime = (appointment = {}) =>
  firstValue(appointment.time, appointment.Time, appointment.slot, appointment.Slot, appointment.startTime, appointment.StartTime) || "-";

const getAppointmentStatus = (appointment = {}) =>
  normalizeStatus(
    firstValue(
      appointment.status,
      appointment.Status,
      appointment.appointmentStatus,
      appointment.AppointmentStatus,
      appointment.queueStatus,
      appointment.QueueStatus
    )
  );

const getAppointmentDate = (appointment = {}) =>
  firstValue(
    appointment.appointmentDate,
    appointment.AppointmentDate,
    appointment.date,
    appointment.Date,
    appointment.slotDate,
    appointment.SlotDate,
    appointment.createdAt,
    appointment.CreatedAt
  ) || "";

const formatToday = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

const isTodayAppointment = (appointment = {}, today = formatToday()) => {
  const rawDate = String(getAppointmentDate(appointment) || "").trim();
  if (!rawDate) return false;
  if (rawDate.startsWith(today)) return true;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === today;
};

const dedupeAppointments = (rows = []) => {
  const map = new Map();
  rows.forEach((row, index) => {
    const key = String(getAppointmentId(row) || `${getAppointmentPatientName(row)}-${getAppointmentDate(row)}-${index}`).trim();
    if (!map.has(key)) map.set(key, row);
  });
  return Array.from(map.values());
};

function NurseDashboard() {
  const navigate = useNavigate();
  const nurseScope = useMemo(() => getNurseScope(), []);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError("");
      try {
        const results = await Promise.allSettled([
          requestJson("Appointment"),
          requestJson("Nurse/print-queue"),
        ]);
        const rows = dedupeAppointments(
          results.flatMap((result) => (result.status === "fulfilled" ? parseList(result.value) : []))
        );
        const scopedRows = scopeNurseRecords(rows, nurseScope, {
          allowMissingClinic: false,
          allowMissingBranch: false,
        });
        const todayRows = scopedRows
          .filter((appointment) => isTodayAppointment(appointment))
          .sort((a, b) => String(getAppointmentTime(a)).localeCompare(String(getAppointmentTime(b))));

        if (active) setAppointments(todayRows);
      } catch (loadError) {
        if (active) {
          setAppointments([]);
          setError(loadError.message || "Unable to load nurse dashboard.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDashboard();
    const refresh = () => {
      if (document.visibilityState === "visible") loadDashboard();
    };
    window.addEventListener("focus", loadDashboard);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      active = false;
      window.removeEventListener("focus", loadDashboard);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [nurseScope]);

  const stats = useMemo(() => {
    const waiting = appointments.filter((item) => getAppointmentStatus(item) === "Waiting").length;
    const completed = appointments.filter((item) => getAppointmentStatus(item) === "Completed").length;
    const inConsultation = appointments.filter((item) => getAppointmentStatus(item) === "In Consultation").length;
    return {
      today: appointments.length,
      waiting,
      completed,
      inConsultation,
    };
  }, [appointments]);

  return (
    <section className="rc-page">
      <div className="rc-page-head">
        <div>
          <h2>Nurse Dashboard</h2>
          <p>Today&apos;s assigned appointments, queue, and patient-care actions.</p>
        </div>
      </div>

      {error ? <div className="rc-error">{error}</div> : null}
      {loading ? <div className="rc-card">Loading nurse dashboard...</div> : null}

      <div className="rc-stat-grid">
        <article className="rc-stat-card">
          <div className="rc-stat-icon blue"><CalendarCheck size={22} /></div>
          <span>Today</span>
          <p>Today&apos;s Appointments</p>
          <strong>{stats.today}</strong>
        </article>
        <article className="rc-stat-card">
          <div className="rc-stat-icon amber"><Clock size={22} /></div>
          <span>Queue</span>
          <p>Waiting Patients</p>
          <strong>{stats.waiting}</strong>
        </article>
        <article className="rc-stat-card">
          <div className="rc-stat-icon blue"><Users size={22} /></div>
          <span>Queue</span>
          <p>In Consultation</p>
          <strong>{stats.inConsultation}</strong>
        </article>
        <article className="rc-stat-card">
          <div className="rc-stat-icon green"><CheckCircle size={22} /></div>
          <span>Today</span>
          <p>Completed</p>
          <strong>{stats.completed}</strong>
        </article>
      </div>

      <div className="rc-action-grid">
        <button type="button" onClick={() => navigate("/nurse/patients")}>
          <Users size={22} />
          <span><strong>Patients</strong> View assigned branch patients</span>
        </button>
        <button type="button" onClick={() => navigate("/nurse/medical-history")}>
          <HeartPulse size={22} />
          <span><strong>Medical History</strong> Update patient care records</span>
        </button>
        <button type="button" onClick={() => navigate("/nurse/appointments/online")}>
          <ListChecks size={22} />
          <span><strong>Online Bookings</strong> Review online appointment queue</span>
        </button>
      </div>

      <div className="rc-card">
        <div className="rc-card-head">
          <div>
            <h3>Today&apos;s Appointment List</h3>
            <p>{formatToday()}</p>
          </div>
          <button className="rc-btn small" type="button" onClick={() => navigate("/nurse/appointments/online")}>
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
          {appointments.length ? (
            appointments.map((item, index) => (
              <div className="rc-table-row four" key={getAppointmentId(item) || index}>
                <span>{index + 1}</span>
                <span>{getAppointmentPatientName(item)}</span>
                <span>{getAppointmentDoctorName(item)}</span>
                <span>{getAppointmentTime(item)}</span>
                <span>{getAppointmentStatus(item)}</span>
              </div>
            ))
          ) : (
            <div className="rc-empty">No appointments found for your branch today.</div>
          )}
        </div>
      </div>
    </section>
  );
}

export default NurseDashboard;
