import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, FileText, Play, RefreshCw, Filter, X, Calendar, User, Stethoscope, FileSpreadsheet, ArrowRight, Activity, AlertCircle } from "lucide-react";
import "./DoctorAppointments.css";
import { apiUrl } from "../../config/api";
import {
  filterByLoggedInDoctor,
  getAuthToken,
  getLoggedInDoctor,
} from "../utils/doctorSession";
import { formatDateMMDDYYYY } from "../../utils/dateFormat";
import { canUseModulePermission, useRolePermissionsSync } from "../../utils/rolePermissions";

const APPOINTMENTS_API = apiUrl("Appointment");
const CONSULTATION_API = apiUrl("Consultation");

const parseList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.appointments)) return payload.appointments;
  return [];
};

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

  const raw = String(value).trim();
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
  const doctor = getLoggedInDoctor();
  useRolePermissionsSync({ ...doctor, role: "Doctor" });
  const canCreateConsultation = canUseModulePermission({ ...doctor, role: "Doctor" }, "Consultation", "Create");
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedNotes, setSelectedNotes] = useState(null);
  const [notesLoading, setNotesLoading] = useState(false);

  const handleStatusUpdate = (event) => {
    const { appointmentId, status } = event.detail;
    setAppointments((prev) =>
      prev.map((apt) =>
        String(apt.id || apt.appointmentId) === String(appointmentId)
          ? { ...apt, status }
          : apt
      )
    );
  };

  const fetchAppointments = async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      const token = getAuthToken();
      const headers = { "ngrok-skip-browser-warning": "true" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const doctor = getLoggedInDoctor();
      const params = new URLSearchParams();
      if (doctor.id) params.set("doctorId", doctor.id);
      if (doctor.branchId) params.set("branchId", doctor.branchId);
      const response = await fetch(
        params.toString() ? `${APPOINTMENTS_API}?${params.toString()}` : APPOINTMENTS_API,
        { headers }
      );
      if (!response.ok) throw new Error("Unable to load appointments.");

      const data = await response.json();
      let appts = parseList(data);
      appts = filterByLoggedInDoctor(appts, doctor);

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

  useEffect(() => {
    const handleBranchChanged = () => fetchAppointments({ silent: true });
    window.addEventListener("doctorBranchChanged", handleBranchChanged);
    return () => window.removeEventListener("doctorBranchChanged", handleBranchChanged);
  }, []);

  useEffect(() => {
    window.addEventListener("appointmentStatusUpdated", handleStatusUpdate);
    return () => {
      window.removeEventListener("appointmentStatusUpdated", handleStatusUpdate);
    };
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
    setSelectedNotes({
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
        throw new Error("No consultation notes found for this appointment.");
      }

      const consultation = await response.json();
      setSelectedNotes({ patient, consultation, error: "" });
    } catch (requestError) {
      setSelectedNotes({
        patient,
        consultation: null,
        error: requestError.message || "No consultation notes available.",
      });
    } finally {
      setNotesLoading(false);
    }
  };

  if (loading) return <div className="da-state-card">Loading appointments...</div>;

  return (
    <div className="da-page">
      {error && (
        <div className="da-alert">
          <div className="da-alert-left">
            <AlertCircle size={18} className="da-alert-icon" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => fetchAppointments()}>Try again</button>
        </div>
      )}

      {/* ── Clinical Triage Header Card ── */}
      <div className="da-header-card">
        <div className="da-header-title-group">
          <div className="da-header-badge">
            <Activity size={16} className="da-header-pulse-icon" />
            <span className="da-header-badge-text">PATIENT APPOINTMENT QUEUE</span>
          </div>
          <h2 className="da-title">All Appointments</h2>
          <p className="da-subtitle">View and manage all clinical triage appointments in real-time.</p>
        </div>

        <div className="da-header-actions">
          <div className="da-filter-group" title="Diagnostic Triage Scope / Filter Queue">
            <span className="da-filter-lens-ring">
              <Filter size={15} className="da-filter-icon" />
            </span>
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
            title="Sync Appointments"
          >
            <RefreshCw size={14} className={`da-refresh-icon ${refreshing ? "da-spin" : ""}`} />
            <span>{refreshing ? "Syncing..." : "Sync"}</span>
          </button>
        </div>
      </div>

      {/* ── Patient Telemetry Queue Table ── */}
      <div className="da-table-card">
        <div className="da-table-wrap">
          <div className="da-table">
            <div className="da-thead">
              <span className="da-sno-head">S.No.</span>
              <span>Date & Time</span>
              <span className="da-token-head">Token No.</span>
              <span>Patient Name</span>
              <span>Age / Gender</span>
              <span className="da-status-head">Status</span>
              <span className="da-actions-head">Action</span>
            </div>

            {filteredAppointments.length > 0 ? (
              filteredAppointments.map((patient, index) => (
                <div className="da-row" key={patient.appointmentId || patient.tokenNumber}>
                  <span className="da-sno-cell">{index + 1}</span>
                  <span className="da-datetime">
                    <span className="da-date">{patient.date}</span>
                    <span className="da-time">{patient.time}</span>
                  </span>
                  <span className="da-token-cell">
                    <span className="da-token">{patient.tokenNumber}</span>
                  </span>
                  <span className="da-name">{patient.patientName}</span>
                  <span className="da-age">{patient.ageGender}</span>
                  <span className="da-status-cell">
                    <span className={`da-status ${getStatusClass(patient.status)}`}>
                      {patient.status}
                    </span>
                  </span>
                  <span className="da-actions">
                    {/* View Patient Record */}
                    <button
                      className="da-act-btn da-act-btn--scope"
                      type="button"
                      title="View Patient Record"
                      onClick={() => openPatient(patient)}
                      disabled={!patient.patientId}
                      aria-label="View Patient Record"
                    >
                      <Eye size={15} />
                    </button>

                    {/* Consultation Notes */}
                    <button
                      className="da-act-btn da-act-btn--chart"
                      type="button"
                      title="Clinical Notes"
                      onClick={() => openNotes(patient)}
                      aria-label="Open Clinical Notes"
                    >
                      <FileText size={15} />
                    </button>

                    {/* Start Consultation */}
                    <button
                      className="da-act-btn da-act-btn--laser da-act-btn--primary"
                      type="button"
                      title="Start Consultation"
                      onClick={() => startConsultation(patient)}
                      disabled={!canCreateConsultation}
                      aria-label="Start Consultation"
                    >
                      <Play size={14} fill="currentColor" />
                    </button>
                  </span>
                </div>
              ))
            ) : (
              <div className="da-empty-state">
                <div className="da-empty-icon-wrap">
                  <Calendar size={32} className="da-empty-icon" />
                </div>
                <h4 className="da-empty-title">No Appointments Found</h4>
                <p className="da-empty-desc">
                  {filter !== "all"
                    ? `There are currently no appointments matching the "${filter}" filter.`
                    : "No appointments are scheduled for today."}
                </p>
                {filter !== "all" && (
                  <button
                    type="button"
                    className="da-empty-reset-btn"
                    onClick={() => setFilter("all")}
                  >
                    View All Appointments
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedNotes && (
        <div className="da-notes-backdrop" onClick={() => setSelectedNotes(null)}>
          <div className="da-notes-modal" onClick={(e) => e.stopPropagation()}>
            <div className="da-notes-head">
              <div className="da-notes-head-title">
                <div className="da-notes-head-icon">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3>Consultation Notes</h3>
                  <p>
                    {selectedNotes.patient.patientName} &bull; Token #{selectedNotes.patient.tokenNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="da-notes-close-btn"
                onClick={() => setSelectedNotes(null)}
                aria-label="Close notes modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="da-notes-body">
              <div className="da-notes-summary-bar">
                <div className="da-notes-summary-item">
                  <User size={14} />
                  <span>Age / Gender: <strong>{selectedNotes.patient.ageGender}</strong></span>
                </div>
                <div className="da-notes-summary-item">
                  <Calendar size={14} />
                  <span>Date: <strong>{selectedNotes.patient.date} ({selectedNotes.patient.time})</strong></span>
                </div>
                <div className="da-notes-summary-item">
                  <span className={`da-status ${getStatusClass(selectedNotes.patient.status)}`}>
                    {selectedNotes.patient.status}
                  </span>
                </div>
              </div>

              {notesLoading ? (
                <div className="da-notes-loading">
                  <RefreshCw size={22} className="da-spin" />
                  <span>Fetching consultation record...</span>
                </div>
              ) : selectedNotes.consultation ? (
                <div className="da-notes-grid">
                  <div className="da-notes-card">
                    <span className="da-notes-label">Chief Complaints</span>
                    <p className="da-notes-text">
                      {selectedNotes.consultation.chiefComplaints ||
                        selectedNotes.patient.raw?.chiefComplaints ||
                        selectedNotes.patient.raw?.complaint ||
                        "No complaints specified"}
                    </p>
                  </div>

                  <div className="da-notes-card">
                    <span className="da-notes-label">Diagnosis</span>
                    <p className="da-notes-text da-notes-highlight">
                      {selectedNotes.consultation.diagnosis || "No formal diagnosis recorded"}
                    </p>
                  </div>

                  <div className="da-notes-card da-notes-wide">
                    <span className="da-notes-label">Clinical Notes & Observations</span>
                    <p className="da-notes-text">
                      {selectedNotes.consultation.clinicalNotes ||
                        selectedNotes.consultation.notes ||
                        "No additional clinical notes recorded."}
                    </p>
                  </div>

                  {Array.isArray(selectedNotes.consultation.labTests) &&
                    selectedNotes.consultation.labTests.length > 0 && (
                      <div className="da-notes-card da-notes-wide">
                        <span className="da-notes-label">Prescribed Lab Tests</span>
                        <div className="da-notes-tags">
                          {selectedNotes.consultation.labTests.map((test, idx) => (
                            <span key={idx} className="da-notes-tag">
                              <Stethoscope size={13} />
                              {typeof test === "string" ? test : test.testName || test.name || "Test"}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              ) : (
                <div className="da-notes-empty">
                  <div className="da-notes-empty-icon">
                    <FileText size={32} />
                  </div>
                  <h4>No Consultation Notes Recorded</h4>
                  <p>
                    There are no consultation notes saved for this appointment yet. You can start or open the consultation to enter clinical findings.
                  </p>
                </div>
              )}
            </div>

            <div className="da-notes-footer">
              <button
                type="button"
                className="da-notes-btn da-notes-btn--secondary da-instrument-btn"
                onClick={() => {
                  const patient = selectedNotes.patient;
                  setSelectedNotes(null);
                  openPatient(patient);
                }}
                disabled={!selectedNotes.patient.patientId}
                title="View Patient History"
              >
                <User size={15} />
                <span>View Patient History</span>
              </button>

              <button
                type="button"
                className="da-notes-btn da-notes-btn--primary"
                onClick={() => {
                  const patient = selectedNotes.patient;
                  setSelectedNotes(null);
                  startConsultation(patient);
                }}
                disabled={!canCreateConsultation}
                title="Start Consultation"
              >
                <Play size={15} />
                <span>{selectedNotes.consultation ? "Edit Consultation" : "Start Consultation"}</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DoctorAppointments;

