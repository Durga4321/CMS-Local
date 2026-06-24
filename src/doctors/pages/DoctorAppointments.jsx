import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, FileText, Play, RefreshCw, Filter } from "lucide-react";
import "./DoctorAppointments.css";
import { apiUrl } from "../../config/api";
import {
  filterByLoggedInDoctor,
  getAuthToken,
  getLoggedInDoctor,
} from "../utils/doctorSession";
import { formatDateMMDDYYYY } from "../../utils/dateFormat";

const APPOINTMENTS_API = apiUrl("Appointment");

const STATUS_CLASS = {
  waiting: "status--waiting",
  "in progress": "status--inprogress",
  inprogress: "status--inprogress",
  "prescription added": "status--prescription",
  completed: "status--completed",
};

const getStatusClass = (status) =>
  STATUS_CLASS[String(status || "").trim().toLowerCase()] || "status--waiting";

const formatTime = (value) => {
  if (!value) return "-";
  const [hourValue, minuteValue = "00"] = String(value).split(":");
  const hour = Number(hourValue);
  if (Number.isNaN(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${String(displayHour).padStart(2, "0")}:${minuteValue.padStart(2, "0")} ${suffix}`;
};

const formatDate = (value) => formatDateMMDDYYYY(value, "-");

const normalizeQueue = (queue) =>
  (Array.isArray(queue) ? queue : []).map((item) => ({
    appointmentId: item.id || item.appointmentId,
    patientId: item.patientId,
    tokenNumber: item.tokenNumber || "-",
    patientName: item.patientName || "-",
    ageGender: `${item.age ?? "-"} / ${item.gender || "-"}`,
    date: formatDate(item.date),
    time: formatTime(item.time),
    status: item.status || "Waiting",
    raw: item,
  }));

function DoctorAppointments() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const fetchAppointments = async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      const token = getAuthToken();
      const headers = { "ngrok-skip-browser-warning": "true" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(APPOINTMENTS_API, { headers });
      if (!response.ok) throw new Error("Unable to load appointments.");

      const data = await response.json();
      let appts = Array.isArray(data) ? data : [];
      appts = filterByLoggedInDoctor(appts, getLoggedInDoctor());
      
      appts.sort((a, b) => new Date(b.date) - new Date(a.date));
      setAppointments(appts);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load appointments.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const normalizedAppointments = useMemo(() => normalizeQueue(appointments), [appointments]);

  const filteredAppointments = useMemo(() => {
    if (filter === "all") return normalizedAppointments;
    if (filter === "today") {
      const todayStr = formatDateMMDDYYYY(new Date(), "-");
      return normalizedAppointments.filter(a => a.date === todayStr);
    }
    return normalizedAppointments.filter(a => String(a.status).toLowerCase().replace(/\s+/g, '') === filter);
  }, [normalizedAppointments, filter]);

  const openPatient = (patient) => {
    if (!patient.patientId) return;
    navigate(`/doctor/patient-details/${patient.patientId}`, {
      state: { patient: patient.raw },
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

  if (loading) return <div className="da-state-card">Loading appointments...</div>;

  return (
    <div className="da-page">
      {error && (
        <div className="da-alert">
          <span>{error}</span>
          <button type="button" onClick={() => fetchAppointments()}>Try again</button>
        </div>
      )}

      <div className="da-header-card">
        <div>
          <h2 className="da-title">All Appointments</h2>
          <p className="da-subtitle">View and manage all patient appointments.</p>
        </div>
        <div className="da-header-actions">
          <div className="da-filter-group">
            <Filter size={16} className="da-filter-icon" />
            <select className="da-filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">All Appointments</option>
              <option value="today">Today's Appointments</option>
              <option value="waiting">Waiting</option>
              <option value="inprogress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <button
            className="da-refresh-btn"
            type="button"
            onClick={() => fetchAppointments({ silent: true })}
            disabled={refreshing}
          >
            <RefreshCw size={15} className={refreshing ? "da-spin" : ""} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="da-table-card">
        <div className="da-table">
          <div className="da-thead">
            <span>Date & Time</span>
            <span>Token No.</span>
            <span>Patient Name</span>
            <span>Age / Gender</span>
            <span>Status</span>
            <span>Action</span>
          </div>

          {filteredAppointments.length > 0 ? (
            filteredAppointments.map((patient) => (
              <div className="da-row" key={patient.appointmentId || patient.tokenNumber}>
                <span className="da-datetime">
                  <span className="da-date">{patient.date}</span>
                  <span className="da-time">{patient.time}</span>
                </span>
                <span className="da-token">{patient.tokenNumber}</span>
                <span className="da-name">{patient.patientName}</span>
                <span className="da-age">{patient.ageGender}</span>
                <span>
                  <span className={`da-status ${getStatusClass(patient.status)}`}>
                    {patient.status}
                  </span>
                </span>
                <span className="da-actions">
                    <button
                    className="da-act-btn"
                    type="button"
                    title="View patient details"
                    onClick={() => openPatient(patient)}
                    disabled={!patient.patientId}
                  >
                    <Eye size={16} />
                  </button>
                  <button className="da-act-btn" type="button" title="View notes">
                    <FileText size={16} />
                  </button>
                  <button
                    className="da-act-btn da-act-btn--primary"
                    type="button"
                    title="Start consultation"
                    onClick={() => startConsultation(patient)}
                  >
                    <Play size={16} />
                  </button>
                </span>
              </div>
            ))
          ) : (
            <div className="da-empty-row">No appointments found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DoctorAppointments;
