import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Calendar,
  CalendarCheck,
  CheckCircle,
  Clock,
  HeartPulse,
  ListChecks,
  Stethoscope,
  Users,
} from "lucide-react";
import { parseList, requestJson } from "./nurseApi";
import { getNurseScope, scopeNurseRecords } from "./nurseScope";
import "./Nurse.css";

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
    appointment.scheduledDate,
    appointment.ScheduledDate,
    appointment.bookingDate,
    appointment.BookingDate
  ) || "";

const formatToday = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

const getLocalDateKey = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "";

  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;

  const dmyDate = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:$|[\s,])/);
  if (dmyDate) {
    return `${dmyDate[3]}-${String(dmyDate[2]).padStart(2, "0")}-${String(dmyDate[1]).padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
};

const isTodayAppointment = (appointment = {}, today = formatToday()) => {
  return getLocalDateKey(getAppointmentDate(appointment)) === today;
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
    <div className="nurse-dashboard-page">
      {/* Hero Care Station Banner */}
      <div className="nd-hero-banner">
        <div className="nd-hero-left">
          <div className="nd-hero-pill-row">
            <span className="nd-station-badge">
              <Activity size={12} /> Clinical Station
            </span>
            <span className="nd-live-pulse-badge">
              <span className="nd-live-dot" /> Live Patient Queue
            </span>
          </div>
          <h2 className="nd-hero-title">Nurse Care Station</h2>
          <p className="nd-hero-subtitle">
            Real-time patient vitals triage, assigned appointments queue, and clinical care actions.
          </p>
        </div>
        <div className="nd-hero-right">
          <div className="nd-hero-date-badge">
            <Calendar size={14} />
            <span>{formatToday()}</span>
          </div>
        </div>
      </div>

      {error ? <div className="rc-error">{error}</div> : null}
      {loading ? <div className="rc-card">Loading nurse dashboard telemetry...</div> : null}

      {/* Vector Medical Instrument Stat Cards (No 3D Images) */}
      <div className="nd-stat-grid">
        {/* Card 1: Today's Appointments */}
        <article className="nd-stat-card nd-card--cyan">
          <div className="nd-stat-card-glow" />
          <div className="nd-stat-head">
            <div className="nd-stat-icon-box cyan">
              <CalendarCheck size={24} />
            </div>
            <span className="nd-stat-pill">Today</span>
          </div>
          <div className="nd-stat-body">
            <span className="nd-stat-label">Today&apos;s Appointments</span>
            <div className="nd-stat-count">
              <strong>{stats.today}</strong>
              <span className="nd-stat-hint">Scheduled</span>
            </div>
          </div>
        </article>

        {/* Card 2: Waiting Patients */}
        <article className="nd-stat-card nd-card--amber">
          <div className="nd-stat-card-glow" />
          <div className="nd-stat-head">
            <div className="nd-stat-icon-box amber">
              <Clock size={24} />
            </div>
            <span className="nd-stat-pill">Queue</span>
          </div>
          <div className="nd-stat-body">
            <span className="nd-stat-label">Waiting Patients</span>
            <div className="nd-stat-count">
              <strong>{stats.waiting}</strong>
              <span className="nd-stat-hint">In Waiting Room</span>
            </div>
          </div>
        </article>

        {/* Card 3: In Consultation */}
        <article className="nd-stat-card nd-card--indigo">
          <div className="nd-stat-card-glow" />
          <div className="nd-stat-head">
            <div className="nd-stat-icon-box indigo">
              <Stethoscope size={24} />
            </div>
            <span className="nd-stat-pill">Consult</span>
          </div>
          <div className="nd-stat-body">
            <span className="nd-stat-label">In Consultation</span>
            <div className="nd-stat-count">
              <strong>{stats.inConsultation}</strong>
              <span className="nd-stat-hint">With Doctor</span>
            </div>
          </div>
        </article>

        {/* Card 4: Completed Care */}
        <article className="nd-stat-card nd-card--emerald">
          <div className="nd-stat-card-glow" />
          <div className="nd-stat-head">
            <div className="nd-stat-icon-box emerald">
              <CheckCircle size={24} />
            </div>
            <span className="nd-stat-pill">Complete</span>
          </div>
          <div className="nd-stat-body">
            <span className="nd-stat-label">Completed Care</span>
            <div className="nd-stat-count">
              <strong>{stats.completed}</strong>
              <span className="nd-stat-hint">Processed</span>
            </div>
          </div>
        </article>
      </div>

      {/* Quick Action Shortcuts (Vector Icons) */}
      <div className="nd-action-section-title">
        <h3><Activity size={16} /> Clinical Quick Actions</h3>
      </div>

      <div className="nd-action-grid">
        <button
          type="button"
          className="nd-action-card nd-act--cyan"
          onClick={() => navigate("/nurse/patients")}
        >
          <div className="nd-action-icon-box cyan">
            <Users size={22} />
          </div>
          <div className="nd-action-text">
            <strong>Branch Patients</strong>
            <p>View assigned patients &amp; record clinical vitals</p>
          </div>
          <span className="nd-action-arrow">
            <ArrowRight size={15} />
          </span>
        </button>

        <button
          type="button"
          className="nd-action-card nd-act--rose"
          onClick={() => navigate("/nurse/medical-history")}
        >
          <div className="nd-action-icon-box rose">
            <HeartPulse size={22} />
          </div>
          <div className="nd-action-text">
            <strong>Medical History</strong>
            <p>Access longitudinal patient care records</p>
          </div>
          <span className="nd-action-arrow">
            <ArrowRight size={15} />
          </span>
        </button>

        <button
          type="button"
          className="nd-action-card nd-act--indigo"
          onClick={() => navigate("/nurse/appointments/online")}
        >
          <div className="nd-action-icon-box indigo">
            <ListChecks size={22} />
          </div>
          <div className="nd-action-text">
            <strong>Online Bookings</strong>
            <p>Review online appointment queue &amp; triage</p>
          </div>
          <span className="nd-action-arrow">
            <ArrowRight size={15} />
          </span>
        </button>
      </div>

      {/* Clinical Table Card */}
      <div className="nd-table-card">
        <div className="nd-table-header">
          <div className="nd-table-title-wrap">
            <div className="nd-table-title-icon">
              <CalendarCheck size={20} />
            </div>
            <div>
              <h3>Today&apos;s Clinical Queue</h3>
              <p>{formatToday()} &bull; {appointments.length} Total Patients Scheduled</p>
            </div>
          </div>
          <button
            className="nd-btn-manage"
            type="button"
            onClick={() => navigate("/nurse/appointments/online")}
          >
            <ListChecks size={16} /> Manage Queue
          </button>
        </div>

        {appointments.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="nd-clinical-table">
              <thead>
                <tr className="nd-table-row-head">
                  <th style={{ width: "60px" }}>S.No.</th>
                  <th>Patient Name</th>
                  <th>Assigned Doctor</th>
                  <th>Scheduled Time</th>
                  <th style={{ textAlign: "center" }}>Queue Status</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((item, index) => {
                  const patientName = getAppointmentPatientName(item);
                  const doctorName = getAppointmentDoctorName(item);
                  const time = getAppointmentTime(item);
                  const statusText = getAppointmentStatus(item) || "Waiting";
                  const statusKey = statusText.toLowerCase().replace(/\s+/g, "-");

                  return (
                    <tr className="nd-table-row-body" key={getAppointmentId(item) || index}>
                      <td style={{ fontWeight: 700, color: "#64748b" }}>{index + 1}</td>
                      <td>
                        <div className="nd-patient-chip">
                          <div className="nd-patient-avatar">
                            {patientName.charAt(0).toUpperCase()}
                          </div>
                          <span className="nd-patient-name">{patientName}</span>
                        </div>
                      </td>
                      <td>
                        <span className="nd-doctor-badge">
                          <Stethoscope size={14} color="#0284c7" /> Dr. {doctorName.replace(/^Dr\.?\s*/i, "")}
                        </span>
                      </td>
                      <td>
                        <span className="nd-time-capsule">
                          <Clock size={12} /> {time}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className={`nd-status-pill status-${statusKey}`}>
                          {statusText === "Waiting" && <Clock size={11} />}
                          {statusText === "In Consultation" && <Activity size={11} />}
                          {statusText === "Completed" && <CheckCircle size={11} />}
                          {statusText}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="nd-empty-state">
            <div className="nd-empty-icon">
              <CalendarCheck size={28} />
            </div>
            <strong>No appointments found for your branch today</strong>
            <p>Assigned appointments and walk-in queues will automatically display here in real-time.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default NurseDashboard;
