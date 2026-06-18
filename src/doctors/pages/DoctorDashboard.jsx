import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  Play,
  RefreshCw,
  Search,
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

  const [hourValue, minuteValue = "00"] = String(value).split(":");
  const hour = Number(hourValue);

  if (Number.isNaN(hour)) return value;

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

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

function DoctorDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState(null);
  const [notesLoading, setNotesLoading] = useState(false);

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
      const dashboardUrl = doctor.id
        ? `${DASHBOARD_API}?doctorId=${encodeURIComponent(doctor.id)}`
        : DASHBOARD_API;

      const [response, appointmentsResponse] = await Promise.all([
        fetch(dashboardUrl, { headers }),
        fetch(APPOINTMENTS_API, { headers }).catch(() => null),
      ]);

      if (!response.ok) {
        throw new Error("Unable to load appointments.");
      }

      const data = await response.json();
      let appointments = null;
      if (appointmentsResponse?.ok) {
        appointments = parseList(await appointmentsResponse.json());
      }

      setDashboard(buildDoctorDashboard(data, appointments, doctor));
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load appointments.");
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

  const patients = useMemo(
    () => normalizeQueue(dashboard?.todayQueue),
    [dashboard]
  );

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return patients;

    return patients.filter((patient) =>
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
  }, [patients, search]);

  const stats = [
    {
      id: "appt",
      label: "Total Appointments",
      value: dashboard?.totalAppointments ?? 0,
      sub: "Today",
      icon: Calendar,
      color: "blue",
    },
    {
      id: "waiting",
      label: "Waiting",
      value: dashboard?.waiting ?? 0,
      sub: "Awaiting consultation",
      icon: Clock,
      color: "amber",
    },
    {
      id: "progress",
      label: "In Progress",
      value: dashboard?.inProgress ?? 0,
      sub: "Active consultations",
      icon: Timer,
      color: "violet",
    },
    {
      id: "done",
      label: "Completed",
      value: dashboard?.completed ?? 0,
      sub: "Finished today",
      icon: CheckCircle,
      color: "green",
    },
  ];

  const openPatient = (patient) => {
    if (!patient.patientId) return;

    navigate(`/doctor/patient-details/${patient.patientId}`, {
      state: {
        patient: patient.raw,
      },
    });
  };

  const startConsultation = (patient) => {
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

      <div className="dd-stats">
        {stats.map(({ id, label, value, sub, icon: Icon, color }) => (
          <div key={id} className={`dd-stat-card dd-stat-card--${color}`}>
            <div className={`dd-stat-icon dd-stat-icon--${color}`}>
              <Icon size={22} />
            </div>
            <div className="dd-stat-body">
              <p className="dd-stat-label">{label}</p>
              <h2 className="dd-stat-value">{value}</h2>
              <p className="dd-stat-sub">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dd-queue-card">
        <div className="dd-queue-header">
          <h3 className="dd-queue-title">Today's Patient Queue</h3>
          <div className="dd-queue-tools">
            <div className="dd-search">
              <Search size={14} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search queue..."
              />
            </div>
            <button
              className="dd-refresh-btn"
              type="button"
              onClick={() => fetchDashboard({ silent: true })}
              disabled={refreshing}
            >
              <RefreshCw size={14} className={refreshing ? "dd-spin" : ""} />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>

        <div className="dd-table">
          <div className="dd-thead">
            <span>Token No.</span>
            <span>Patient Name</span>
            <span>Age / Gender</span>
            <span>Time</span>
            <span>Status</span>
            <span>Action</span>
          </div>

          {filteredPatients.length > 0 ? (
            filteredPatients.map((patient) => (
              <div
                className="dd-row"
                key={patient.appointmentId || patient.tokenNumber}
              >
                <span className="dd-token">{patient.tokenNumber}</span>
                <span className="dd-name">{patient.patientName}</span>
                <span className="dd-age">{patient.ageGender}</span>
                <span className="dd-time">{patient.time}</span>
                <span>
                  <span className={`dd-status ${getStatusClass(patient.status)}`}>
                    {patient.status}
                  </span>
                </span>
                <span className="dd-actions">
                  <button
                    className="dd-act-btn"
                    type="button"
                    title="View patient"
                    onClick={() => openPatient(patient)}
                    disabled={!patient.patientId}
                  >
                    <Eye size={15} />
                  </button>
                  <button
                    className="dd-act-btn"
                    type="button"
                    title="View notes"
                    onClick={() => openNotes(patient)}
                  >
                    <FileText size={15} />
                  </button>
                  <button
                    className="dd-act-btn"
                    type="button"
                    title="Start consultation"
                    onClick={() => startConsultation(patient)}
                  >
                    <Play size={15} />
                  </button>
                </span>
              </div>
            ))
          ) : (
            <div className="dd-empty-row">No patients match your search.</div>
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
    </div>
  );
}

export default DoctorDashboard;
