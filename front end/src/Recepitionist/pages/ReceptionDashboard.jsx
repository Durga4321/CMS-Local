import DashboardCards from "../../components/superadmin/DashboardCards";
import { DashboardGreeting, useDashboardLayout, DashboardPager } from "../../components/superadmin/DashboardCards";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  CalendarPlus,
  CheckCircle,
  Clock,
  ClipboardList,
  UserPlus,
  Users,
  Stethoscope,
  Calendar,
  Activity,
  FileText,
  ChevronRight,
} from "lucide-react";
import { formatToday, parseList, requestJson as defaultRequestJson } from "../receptionApi";
import { getReceptionistScope, scopeReceptionistRecords } from "../receptionScope";
import { isDeletedPatient, patientBelongsToReceptionistPatientList } from "./ReceptionPatients";

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
  const layout = useDashboardLayout();
  const navigate = useNavigate();
  const receptionistScope = useMemo(() => getScope(), [getScope]);
  const [appointments, setAppointments] = useState([]);
  const [totalPatients, setTotalPatients] = useState(null);
  const [stats, setStats] = useState({ today: 0, waiting: 0, completed: 0 });

  useEffect(() => {
    let active = true;
    apiRequest("Patient")
      .then((data) => {
        const patients = parseList(data)
          .filter((patient) => !isDeletedPatient(patient))
          .filter((patient) => scopeRecords !== scopeReceptionistRecords
            ? scopeRecords([patient], receptionistScope).length > 0
            : patientBelongsToReceptionistPatientList(patient, new Set(), new Set(), receptionistScope));
        if (active) setTotalPatients(patients.length);
      })
      .catch(() => {
        if (active) setTotalPatients(null);
      });
    return () => { active = false; };
  }, [apiRequest, receptionistScope, scopeRecords]);

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
    <section className="rc-page rc-dashboard-page role-single-screen" ref={layout.ref}>
      {/* 3D Hospital Theme Animated Background Overlays */}
      <div className="db-3d-bg-overlay" />
      <div className="db-3d-floating-particle p1" />
      <div className="db-3d-floating-particle p2" />
      <div className="db-3d-floating-particle p3" />
      <div className="db-3d-ecg-wave">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="db-ecg-svg">
          <path
            d="M0 60 L300 60 L310 40 L320 80 L330 20 L345 100 L355 60 L370 60 L400 60 L700 60 L710 35 L720 85 L730 15 L745 105 L755 60 L770 60 L1200 60"
            fill="none"
            stroke="color-mix(in srgb, var(--theme-primary) 25%, transparent)"
            strokeWidth="2.5"
            strokeDasharray="1200"
            strokeDashoffset="1200"
            className="ecg-path"
          />
        </svg>
      </div>

      {/* PAGE HEADER */}
      <div className="rc-dash-header" data-page-header>
        <DashboardGreeting role="Receptionist" />
        {!hideActions && (
          <div className="rc-dash-head-actions">
            <button
              type="button"
              className="rc-head-action-btn btn-secondary"
              onClick={() => navigate("/reception/appointments")}
              title="Book Appointment"
            >
              <CalendarPlus size={16} />
              <span>Book Appointment</span>
            </button>
            <button
              type="button"
              className="rc-head-action-btn btn-primary"
              onClick={() => navigate("/reception/patients")}
              title="Add Patient"
            >
              <UserPlus size={16} />
              <span>Add Patient</span>
            </button>
          </div>
        )}
      </div>

      {/* TOP 5 RADIANT KPI STAT CARDS */}
      <div className="reception-overview-metrics"><DashboardCards cards={[
        { label: "Total Patients", value: totalPatients ?? "—", icon: Users, onClick: () => navigate("/reception/patients") },
        { label: "Today's Appointments", value: stats.today, icon: CalendarCheck },
        { label: "Waiting Patients", value: stats.waiting, icon: Clock },
        { label: "In Consultation", value: appointments.filter((item) => getAppointmentStatus(item) === "In Progress").length, icon: Stethoscope },
        { label: "Completed Appointments", value: stats.completed, icon: CheckCircle },
      ].map(card => ({ ...card, tone: "teal", onClick: card.onClick || (() => navigate("/reception/appointments")) }))} /></div>

      {/* QUICK BILLING ACTIONS */}
      {!hideCards && (
        <div className="rc-dash-action-grid">
          <button
            type="button"
            className="rc-dash-action-tile qa-op-billing"
            onClick={() => navigate("/reception/appointments")}
          >
            <div className="rc-dash-action-icon-wrap icon-cyan">
              <ClipboardList size={22} />
            </div>
            <div className="rc-dash-action-content">
              <div className="rc-dash-action-top-row">
                <span className="rc-dash-action-tag tag-cyan">Outpatient</span>
                <span className="rc-dash-action-title">OP Billing</span>
              </div>
              <p className="rc-dash-action-desc">
                Book and manage outpatient billing (open appointment)
              </p>
            </div>
            <div className="rc-dash-action-chevron">
              <ChevronRight size={18} />
            </div>
          </button>

          <button
            type="button"
            className="rc-dash-action-tile qa-diagnostic-billing"
            onClick={() => navigate("/reception/billing?mode=diagnostic")}
          >
            <div className="rc-dash-action-icon-wrap icon-purple">
              <Activity size={22} />
            </div>
            <div className="rc-dash-action-content">
              <div className="rc-dash-action-top-row">
                <span className="rc-dash-action-tag tag-purple">Lab & Scans</span>
                <span className="rc-dash-action-title">Diagnostic Billing</span>
              </div>
              <p className="rc-dash-action-desc">
                Create diagnostic and laboratory invoices
              </p>
            </div>
            <div className="rc-dash-action-chevron">
              <ChevronRight size={18} />
            </div>
          </button>

          <button
            type="button"
            className="rc-dash-action-tile qa-pharmacy-billing"
            onClick={() => navigate("/reception/billing?mode=pharmacy")}
          >
            <div className="rc-dash-action-icon-wrap icon-emerald">
              <FileText size={22} />
            </div>
            <div className="rc-dash-action-content">
              <div className="rc-dash-action-top-row">
                <span className="rc-dash-action-tag tag-emerald">Medications</span>
                <span className="rc-dash-action-title">Pharmacy Billing</span>
              </div>
              <p className="rc-dash-action-desc">
                Create pharmacy invoices & prescription dispenses
              </p>
            </div>
            <div className="rc-dash-action-chevron">
              <ChevronRight size={18} />
            </div>
          </button>
        </div>
      )}

      {/* APPOINTMENT LIST TABLE CARD */}
      <div className="rc-dash-table-card">
        <div className="rc-dash-table-head">
          <div className="rc-dash-table-head-left">
            <div className="rc-dash-panel-icon">
              <Calendar size={18} />
            </div>
            <div>
              <h3>Appointment List</h3>
              <div className="rc-dash-meta-badges">
                <span className="rc-dash-date-pill">
                  <Calendar size={12} />
                  {todayDate}
                </span>
                <span className="rc-dash-count-pill">
                  {latest.length} {latest.length === 1 ? "Patient" : "Patients"}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="rc-dash-manage-btn"
            onClick={() => navigate("/reception/appointments")}
          >
            <span>Manage</span>
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="rc-dash-table-container">
          <div className="rc-dash-table-header">
            <span className="col-sno">
              <span className="rc-th-capsule rc-th-sno">S.No.</span>
            </span>
            <span className="col-patient">
              <span className="rc-th-capsule rc-th-name">Patient</span>
            </span>
            <span className="col-doctor">
              <span className="rc-th-capsule rc-th-doctor">Doctor</span>
            </span>
            <span className="col-time">
              <span className="rc-th-capsule rc-th-time">Time</span>
            </span>
            <span className="col-status">
              <span className="rc-th-capsule rc-th-status">Status</span>
            </span>
          </div>

          <div className="rc-dash-table-body">
            {latest.length ? (
              layout.rows(latest).map((item, index) => {
                const patientName = getAppointmentPatientName(item);
                const doctorName = getAppointmentDoctorName(item);
                const timeStr = getAppointmentTime(item);
                const statusText = getAppointmentStatus(item) || "Waiting";
                const statusClass = statusText.toLowerCase().replace(/\s+/g, "-");
                const initials = patientName
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0].toUpperCase())
                  .join("") || "PT";

                return (
                  <div
                    className="rc-dash-table-row"
                    key={item.id || item.appointmentId || index}
                  >
                    <span className="col-sno">
                      <span className="rc-dash-sno-badge">{index + 1}</span>
                    </span>

                    <span className="col-patient">
                      <div className="rc-dash-patient-cell">
                        <div className="rc-dash-patient-avatar">{initials}</div>
                        <span className="rc-dash-patient-name">{patientName}</span>
                      </div>
                    </span>

                    <span className="col-doctor">
                      <div className="rc-dash-doctor-cell">
                        <Stethoscope size={14} className="rc-dash-doc-icon" />
                        <span>{doctorName}</span>
                      </div>
                    </span>

                    <span className="col-time">
                      <div className="rc-dash-time-cell">
                        <Clock size={13} className="rc-dash-time-icon" />
                        <span>{timeStr}</span>
                      </div>
                    </span>

                    <span className="col-status rc-status-cell">
                      <span className={`rc-status ${statusClass}`}>
                        {statusText}
                      </span>
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="rc-dash-empty">
                <Calendar size={32} />
                <p>No appointments scheduled for today.</p>
                <button
                  type="button"
                  className="rc-dash-empty-btn"
                  onClick={() => navigate("/reception/appointments")}
                >
                  <CalendarPlus size={14} />
                  <span>Book New Appointment</span>
                </button>
              </div>
            )}
          </div>
        </div>
        <DashboardPager layout={layout} total={latest.length} />
      </div>
    </section>
  );
}

export default ReceptionDashboard;

