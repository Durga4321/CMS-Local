import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Activity,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  Filter,
  HeartPulse,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Stethoscope,
  Timer,
  X,
} from "lucide-react";
import "./DoctorDashboard.css";
import { apiUrl } from "../../config/api";
import {
  filterByLoggedInDoctor,
  getAuthToken,
  getLoggedInDoctor,
} from "../utils/doctorSession";
import { canUseModulePermission, useRolePermissionsSync } from "../../utils/rolePermissions";

const DASHBOARD_API = apiUrl("Doctor/dashboard");
const APPOINTMENTS_API = apiUrl("Appointment");
const CONSULTATION_API = apiUrl("Consultation");

const STATUS_CLASS = {
  waiting: "status--waiting",
  "in progress": "status--inprogress",
  inprogress: "status--inprogress",
  "prescription added": "status--prescription",
  completed: "status--completed",
};

const getStatusClass = (status) =>
  STATUS_CLASS[String(status || "").trim().toLowerCase()] || "status--waiting";

const parseList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const getAppointmentId = (item) => item?.appointmentId || item?.id || "";

const toLocalDateKey = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDateKey = (value) => {
  if (!value) return "";

  const raw = String(value);
  const isoDate = raw.split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;

  return toLocalDateKey(new Date(raw));
};

const getCurrentDateKey = () => toLocalDateKey(new Date());

const getStatusKey = (status) =>
  String(status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

const countByStatus = (queue, statusKeys) =>
  queue.filter((item) => statusKeys.includes(getStatusKey(item.status))).length;

const sortQueue = (queue) =>
  [...queue].sort((a, b) => {
    const left = `${getDateKey(a.date)} ${a.time || ""}`;
    const right = `${getDateKey(b.date)} ${b.time || ""}`;
    return left.localeCompare(right);
  });

const buildDoctorDashboard = (data, appointments, doctor) => {
  const dashboardQueue = Array.isArray(data?.todayQueue) ? data.todayQueue : [];
  const dashboardAppointmentIds = new Set(
    dashboardQueue.map(getAppointmentId).filter(Boolean).map(String)
  );
  const dashboardDateKeys = new Set(
    dashboardQueue.map((item) => getDateKey(item.date)).filter(Boolean)
  );

  let todayQueue = [];

  if (Array.isArray(appointments)) {
    const doctorAppointments = filterByLoggedInDoctor(appointments, doctor);

    if (dashboardAppointmentIds.size > 0) {
      todayQueue = doctorAppointments.filter((item) =>
        dashboardAppointmentIds.has(String(getAppointmentId(item)))
      );
    }

    if (todayQueue.length === 0 && dashboardDateKeys.size > 0) {
      todayQueue = doctorAppointments.filter((item) =>
        dashboardDateKeys.has(getDateKey(item.date || item.appointmentDate))
      );
    }

    if (todayQueue.length === 0) {
      const todayKey = getCurrentDateKey();
      todayQueue = doctorAppointments.filter(
        (item) => getDateKey(item.date || item.appointmentDate) === todayKey
      );
    }
  } else {
    todayQueue = filterByLoggedInDoctor(dashboardQueue, doctor);
  }

  const sortedQueue = sortQueue(todayQueue);

  return {
    ...data,
    todayQueue: sortedQueue,
    totalAppointments: sortedQueue.length,
    waiting: countByStatus(sortedQueue, ["waiting"]),
    inProgress: countByStatus(sortedQueue, ["inprogress"]),
    completed: countByStatus(sortedQueue, ["completed"]),
  };
};

const formatTime = (value) => {
  if (!value) return "-";

  const raw = String(value).trim();

  // Detect if the input already contains an AM/PM suffix and strip it
  const ampmMatch = raw.match(/\b(am|pm)\b$/i);
  let suffix = "";
  let timePart = raw;

  if (ampmMatch) {
    suffix = ampmMatch[1].toUpperCase();
    timePart = raw.replace(/\b(am|pm)\b$/i, "").trim();
  }

  const [hourValue, minuteValueRaw = "00"] = String(timePart).split(":");
  const hour = Number(hourValue);

  if (Number.isNaN(hour)) return raw;

  if (!suffix) suffix = hour >= 12 ? "PM" : "AM";

  const displayHour = hour % 12 || 12;
  const minuteValue = String(minuteValueRaw).replace(/[^0-9]/g, "");

  return `${String(displayHour).padStart(2, "0")}:${minuteValue.padStart(2, "0")} ${suffix}`;
};

const normalizeQueue = (queue) =>
  (Array.isArray(queue) ? queue : []).map((item) => ({
    appointmentId: item.appointmentId || item.id,
    patientId: item.patientId,
    tokenNumber: item.tokenNumber || "-",
    patientName: item.patientName || "-",
    ageGender: `${item.age ?? "-"} / ${item.gender || "-"}`,
    time: formatTime(item.time),
    status: item.status || "Waiting",
    raw: item,
  }));

const isAbortLikeError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return error?.name === "AbortError" || message.includes("aborted") || message.includes("signal");
};

function DoctorDashboard() {
  const navigate = useNavigate();
  const permissionDoctor = getLoggedInDoctor();
  useRolePermissionsSync({ ...permissionDoctor, role: "Doctor" });
  const canCreateConsultation = canUseModulePermission({ ...permissionDoctor, role: "Doctor" }, "Consultation", "Create");
  const [dashboard, setDashboard] = useState(null);
  const dashboardRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  // Support shared search state from layout via Outlet context (fallback to local state)
  const outlet = useOutletContext?.() || {};
  const [localSearch, setLocalSearch] = useState("");
  const search = outlet.doctorSearch !== undefined ? outlet.doctorSearch : localSearch;
  const setSearch = outlet.setDoctorSearch !== undefined ? outlet.setDoctorSearch : setLocalSearch;
  const [notes, setNotes] = useState(null);
  const [notesLoading, setNotesLoading] = useState(false);
  const [patientOverview, setPatientOverview] = useState(null);

  const fetchDashboard = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const token = getAuthToken();
      const headers = {
        "ngrok-skip-browser-warning": "true",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const doctor = getLoggedInDoctor();
      const params = new URLSearchParams();
      if (doctor.id) params.set("doctorId", doctor.id);
      if (doctor.branchId) params.set("branchId", doctor.branchId);
      const dashboardUrl = params.toString()
        ? `${DASHBOARD_API}?${params.toString()}`
        : DASHBOARD_API;

      const [response, appointmentsResponse] = await Promise.all([
        fetch(dashboardUrl, { headers }),
        fetch(
          params.toString() ? `${APPOINTMENTS_API}?${params.toString()}` : APPOINTMENTS_API,
          { headers }
        ).catch(() => null),
      ]);

      if (!response.ok) {
        throw new Error("Unable to load appointments.");
      }

      const data = await response.json();
      let appointments = null;
      if (appointmentsResponse?.ok) {
        appointments = parseList(await appointmentsResponse.json());
      }

      const nextDashboard = buildDoctorDashboard(data, appointments, doctor);
      dashboardRef.current = nextDashboard;
      setDashboard(nextDashboard);
    } catch (err) {
      if (isAbortLikeError(err) && (silent || dashboardRef.current)) {
        return;
      }
      console.error(err);
      setError(isAbortLikeError(err) ? "Unable to load dashboard right now. Please try again." : err.message || "Unable to load appointments.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const refreshTimer = window.setInterval(
      () => fetchDashboard({ silent: true }),
      30000
    );

    return () => window.clearInterval(refreshTimer);
  }, [fetchDashboard]);

  useEffect(() => {
    const handleBranchChanged = () => fetchDashboard({ silent: true });
    window.addEventListener("doctorBranchChanged", handleBranchChanged);
    return () => window.removeEventListener("doctorBranchChanged", handleBranchChanged);
  }, [fetchDashboard]);

  const [statusFilter, setStatusFilter] = useState("all");

  const patients = useMemo(
    () => normalizeQueue(dashboard?.todayQueue),
    [dashboard]
  );

  const waitingCount = useMemo(
    () => patients.filter((p) => getStatusKey(p.status) === "waiting").length,
    [patients]
  );
  const inProgressCount = useMemo(
    () => patients.filter((p) => {
      const key = getStatusKey(p.status);
      return key === "inprogress" || key === "in progress";
    }).length,
    [patients]
  );
  const completedCount = useMemo(
    () => patients.filter((p) => {
      const key = getStatusKey(p.status);
      return key === "completed" || key === "prescriptionadded" || key === "prescription added";
    }).length,
    [patients]
  );

  const filteredPatients = useMemo(() => {
    let list = patients;

    if (statusFilter !== "all") {
      list = list.filter((patient) => {
        const key = getStatusKey(patient.status);
        if (statusFilter === "waiting") return key === "waiting";
        if (statusFilter === "inprogress") return key === "inprogress" || key === "in progress";
        if (statusFilter === "completed") return key === "completed" || key === "prescriptionadded" || key === "prescription added";
        return true;
      });
    }

    const query = search.trim().toLowerCase();
    if (!query) return list;

    return list.filter((patient) =>
      [
        patient.tokenNumber,
        patient.patientName,
        patient.ageGender,
        patient.time,
        patient.status,
        patient.raw?.patientCode,
        patient.raw?.chiefComplaints,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [patients, search, statusFilter]);

  const stats = [
    {
      id: "appt",
      label: "Total Appointments",
      value: dashboard?.totalAppointments ?? 0,
      sub: "Scheduled today",
      icon: Calendar,
      color: "blue",
      badge: "REGISTRY",
      trend: "Daily Intake",
    },
    {
      id: "waiting",
      label: "Waiting Queue",
      value: dashboard?.waiting ?? 0,
      sub: "Awaiting examination",
      icon: Clock,
      color: "amber",
      badge: "TRIAGE",
      trend: "Priority Triage",
    },
    {
      id: "progress",
      label: "In Consultation",
      value: dashboard?.inProgress ?? 0,
      sub: "Active clinical examination",
      icon: Timer,
      color: "violet",
      badge: "EXAM ROOM",
      trend: "Active Exam",
    },
    {
      id: "done",
      label: "Completed Care",
      value: dashboard?.completed ?? 0,
      sub: "Finished today",
      icon: CheckCircle,
      color: "green",
      badge: "DISCHARGED",
      trend: "Consulted",
    },
  ];

  const openPatient = (patient) => {
    if (!patient.patientId) return;
    setPatientOverview(patient);
  };

  const openFullPatientDetails = (patient) => {
    if (!patient?.patientId) return;
    navigate(`/doctor/patient-details/${patient.patientId}`, {
      state: {
        patient: patient.raw,
      },
    });
  };

  const startConsultation = (patient) => {
    if (!canCreateConsultation) return;
    navigate("/doctor/consultation", {
      state: {
        appointmentId: patient.appointmentId,
        patientId: patient.patientId,
        appointment: patient.raw,
        patient: patient.raw,
      },
    });
  };

  const openNotes = async (patient) => {
    setNotes({
      patient,
      consultation: null,
      error: "",
    });

    if (!patient.appointmentId) return;

    try {
      setNotesLoading(true);
      const token = getAuthToken();
      const headers = { "ngrok-skip-browser-warning": "true" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(
        `${CONSULTATION_API}/appointment/${patient.appointmentId}`,
        { headers }
      );

      if (!response.ok) {
        throw new Error("No consultation notes found.");
      }

      const consultation = await response.json();
      setNotes({ patient, consultation, error: "" });
    } catch (requestError) {
      setNotes({
        patient,
        consultation: null,
        error: requestError.message || "Unable to load notes.",
      });
    } finally {
      setNotesLoading(false);
    }
  };

  if (loading) {
    return <div className="dd-state-card">Loading doctor dashboard...</div>;
  }

  return (
    <div className="dd-page">
      {error ? (
        <div className="dd-alert">
          <span>{error}</span>
          <button type="button" onClick={() => fetchDashboard()}>
            Try again
          </button>
        </div>
      ) : null}

      {/* Medical Telemetry Banner */}
      <div className="dd-header-banner">
        <div className="dd-header-copy">
          <div className="dd-header-badge">
            <Activity size={14} className="dd-pulse-icon" />
            <span>CLINICAL TRIAGE CONSOLE</span>
          </div>
          <h2 className="dd-header-title">Doctor Workstation</h2>
          <p className="dd-header-subtitle">Real-time patient triage, consultation queue, and diagnostic telemetry</p>
        </div>
        <div className="dd-header-telemetry">
          <div className="dd-telemetry-pill">
            <span className="dd-telemetry-led" />
            <span>LIVE SYSTEM SYNC</span>
          </div>
        </div>
      </div>

      {/* Medical Instrument Telemetry Cards */}
      <div className="dd-stats">
        {stats.map(({ id, label, value, sub, icon: Icon, color, badge, trend }) => (
          <div key={id} className={`dd-stat-card dd-stat-card--${color}`}>
            <div className="dd-stat-top">
              <div className={`dd-stat-icon-bezel dd-stat-icon-bezel--${color}`}>
                <Icon size={22} className="dd-stat-icon" />
              </div>
              <span className={`dd-stat-badge dd-stat-badge--${color}`}>{badge}</span>
            </div>
            <div className="dd-stat-body">
              <p className="dd-stat-label">{label}</p>
              <div className="dd-stat-value-row">
                <h2 className="dd-stat-value">{value}</h2>
                <span className={`dd-stat-trend dd-stat-trend--${color}`}>{trend}</span>
              </div>
              <p className="dd-stat-sub">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Queue Console Card */}
      <div className="dd-queue-card">
        <div className="dd-queue-header">
          <div className="dd-queue-title-wrap">
            <h3 className="dd-queue-title">Today's Patient Queue</h3>
            <span className="dd-queue-count-pill">{filteredPatients.length} Active</span>
          </div>
          <div className="dd-queue-tools">
            <div className="dd-search">
              <Search size={14} className="dd-search-optic" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search queue by name, token, ID..."
              />
              {search ? (
                <button
                  type="button"
                  className="dd-search-clear"
                  onClick={() => setSearch("")}
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              ) : null}
            </div>
            <button
              className="dd-refresh-btn"
              type="button"
              onClick={() => fetchDashboard({ silent: true })}
              disabled={refreshing}
              title="Recalibrate / Sync Patient Telemetry"
            >
              <RefreshCw size={14} className={refreshing ? "dd-spin" : ""} />
              <span>{refreshing ? "Syncing..." : "Sync Queue"}</span>
            </button>
          </div>
        </div>

        {/* Quick Filter Dosage Capsules */}
        <div className="dd-queue-filters" role="tablist" aria-label="Filter patient queue">
          <button
            type="button"
            className={`dd-filter-capsule ${statusFilter === "all" ? "is-active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            <span className="dd-filter-dot dd-filter-dot--all" />
            <span className="dd-filter-text">All Patients</span>
            <span className="dd-filter-count">{patients.length}</span>
          </button>
          <button
            type="button"
            className={`dd-filter-capsule dd-filter-capsule--amber ${statusFilter === "waiting" ? "is-active" : ""}`}
            onClick={() => setStatusFilter("waiting")}
          >
            <span className="dd-filter-dot dd-filter-dot--amber" />
            <span className="dd-filter-text">Waiting</span>
            <span className="dd-filter-count">{waitingCount}</span>
          </button>
          <button
            type="button"
            className={`dd-filter-capsule dd-filter-capsule--blue ${statusFilter === "inprogress" ? "is-active" : ""}`}
            onClick={() => setStatusFilter("inprogress")}
          >
            <span className="dd-filter-dot dd-filter-dot--blue" />
            <span className="dd-filter-text">In Progress</span>
            <span className="dd-filter-count">{inProgressCount}</span>
          </button>
          <button
            type="button"
            className={`dd-filter-capsule dd-filter-capsule--green ${statusFilter === "completed" ? "is-active" : ""}`}
            onClick={() => setStatusFilter("completed")}
          >
            <span className="dd-filter-dot dd-filter-dot--green" />
            <span className="dd-filter-text">Completed</span>
            <span className="dd-filter-count">{completedCount}</span>
          </button>
        </div>

        <div className="dd-table">
          <div className="dd-thead">
            <span className="dd-sno-head">S.No.</span>
            <span className="dd-token-head">Token No.</span>
            <span>Patient Name</span>
            <span>Age / Gender</span>
            <span>Time</span>
            <span className="dd-status-head">Status</span>
            <span className="dd-actions-head">Action</span>
          </div>

          {filteredPatients.length > 0 ? (
            filteredPatients.map((patient, index) => (
              <div
                className="dd-row"
                key={patient.appointmentId || patient.tokenNumber}
              >
                <span className="dd-sno-cell">{index + 1}</span>
                <span className="dd-token-cell">
                  <span className="dd-token">{patient.tokenNumber}</span>
                </span>
                <span className="dd-name">{patient.patientName}</span>
                <span className="dd-age">{patient.ageGender}</span>
                <span className="dd-time">{patient.time}</span>
                <span className="dd-status-cell">
                  <span className={`dd-status ${getStatusClass(patient.status)}`}>
                    <span className="dd-status-dot-indicator" />
                    {patient.status}
                  </span>
                </span>
                <span className="dd-actions">
                  <button
                    className="dd-act-btn dd-act-btn--scope"
                    type="button"
                    title="Diagnostic Scope: View Patient Record"
                    onClick={() => openPatient(patient)}
                    disabled={!patient.patientId}
                  >
                    <Eye size={15} />
                  </button>
                  <button
                    className="dd-act-btn dd-act-btn--chart"
                    type="button"
                    title="Clinical Chart: Consultation Notes"
                    onClick={() => openNotes(patient)}
                  >
                    <FileText size={15} />
                  </button>
                  <button
                    className="dd-act-btn dd-act-btn--trigger"
                    type="button"
                    title="Clinical Activator: Start Consultation"
                    onClick={() => startConsultation(patient)}
                    disabled={!canCreateConsultation}
                  >
                    <Play size={13} fill="currentColor" />
                  </button>
                </span>
              </div>
            ))
          ) : (
            <div className="dd-empty-telemetry">
              <div className="dd-empty-icon-wrap">
                <Stethoscope size={36} className="dd-empty-stetho" />
                <span className="dd-empty-radar-ring" />
              </div>
              <h4>No Patients in Selected Queue</h4>
              <p>
                {search
                  ? `No patient records matched "${search}".`
                  : statusFilter !== "all"
                  ? `There are currently no patients in the "${statusFilter}" status category.`
                  : "Today's queue is completely clear. Enjoy a breather or refresh for new intakes."}
              </p>
              {(search || statusFilter !== "all") && (
                <button
                  type="button"
                  className="dd-empty-reset-btn"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                  }}
                >
                  Reset Filter & View All
                </button>
              )}
            </div>
          )}
        </div>

        <div className="dd-queue-footer">
          <span>
            Showing {filteredPatients.length} of {dashboard?.totalAppointments ?? 0} patients
          </span>
        </div>
      </div>

      {notes ? (
        <div className="dd-notes-backdrop" onClick={() => setNotes(null)}>
          <div className="dd-notes-modal" onClick={(event) => event.stopPropagation()}>
            <div className="dd-notes-head">
              <div>
                <h3>Consultation Notes</h3>
                <p>{notes.patient.patientName} | Appointment #{notes.patient.appointmentId}</p>
              </div>
              <button type="button" onClick={() => setNotes(null)} aria-label="Close notes">
                <X size={16} />
              </button>
            </div>
            {notesLoading ? (
              <div className="dd-notes-empty">Loading notes...</div>
            ) : notes.error ? (
              <div className="dd-notes-empty">{notes.error}</div>
            ) : (
              <div className="dd-notes-grid">
                <div>
                  <span>Complaints</span>
                  <strong>{notes.patient.raw?.chiefComplaints || notes.patient.raw?.complaint || "-"}</strong>
                </div>
                <div>
                  <span>Diagnosis</span>
                  <strong>{notes.consultation?.diagnosis || "-"}</strong>
                </div>
                <div className="dd-notes-wide">
                  <span>Clinical Notes</span>
                  <strong>{notes.consultation?.clinicalNotes || notes.consultation?.notes || "-"}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {patientOverview ? (
        <div className="dd-notes-backdrop" onClick={() => setPatientOverview(null)}>
          <div className="dd-notes-modal dd-patient-modal" onClick={(event) => event.stopPropagation()}>
            <div className="dd-notes-head">
              <div>
                <h3>Patient Overview</h3>
                <p>{patientOverview.patientName} | Appointment #{patientOverview.appointmentId}</p>
              </div>
              <button type="button" onClick={() => setPatientOverview(null)} aria-label="Close patient overview">
                <X size={16} />
              </button>
            </div>
            <div className="dd-notes-grid">
              <div>
                <span>Token</span>
                <strong>{patientOverview.tokenNumber || "-"}</strong>
              </div>
              <div>
                <span>Age / Gender</span>
                <strong>{patientOverview.ageGender || "-"}</strong>
              </div>
              <div>
                <span>Time</span>
                <strong>{patientOverview.time || "-"}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{patientOverview.status || "-"}</strong>
              </div>
              <div className="dd-notes-wide">
                <span>Complaints</span>
                <strong>{patientOverview.raw?.chiefComplaints || patientOverview.raw?.complaint || "-"}</strong>
              </div>
            </div>
            <div className="dd-modal-actions">
              <button type="button" className="dd-refresh-btn" onClick={() => openFullPatientDetails(patientOverview)}>
                Open Full Details
              </button>
              <button type="button" className="dd-refresh-btn" onClick={() => startConsultation(patientOverview)} disabled={!canCreateConsultation}>
                Start Consultation
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default DoctorDashboard;
