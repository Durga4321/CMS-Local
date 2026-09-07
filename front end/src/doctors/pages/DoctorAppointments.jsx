import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, FileText, Play, RefreshCw, Filter, X, Calendar, User, Stethoscope, FileSpreadsheet, ArrowRight, Activity } from "lucide-react";
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
      let appts = Array.isArray(data) ? data : [];
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
      {/* ── Medical Telemetry & Monitor Ambient Background ── */}
      <div className="da-medical-bg" aria-hidden="true">
        <div className="da-ecg-track">
          <svg className="da-ecg-svg" viewBox="0 0 1200 80" preserveAspectRatio="none">
            <path
              className="da-ecg-line-base"
              d="M 0,40 L 180,40 L 195,35 L 205,45 L 215,40 L 240,40 L 250,10 L 262,72 L 274,28 L 284,48 L 295,40 L 330,40 Q 350,24 370,40 L 540,40 L 555,35 L 565,45 L 575,40 L 600,40 L 610,10 L 622,72 L 634,28 L 644,48 L 655,40 L 690,40 Q 710,24 730,40 L 900,40 L 915,35 L 925,45 L 935,40 L 960,40 L 970,10 L 982,72 L 994,28 L 1004,48 L 1015,40 L 1050,40 Q 1070,24 1090,40 L 1200,40"
            />
            <path
              className="da-ecg-line-pulse"
              d="M 0,40 L 180,40 L 195,35 L 205,45 L 215,40 L 240,40 L 250,10 L 262,72 L 274,28 L 284,48 L 295,40 L 330,40 Q 350,24 370,40 L 540,40 L 555,35 L 565,45 L 575,40 L 600,40 L 610,10 L 622,72 L 634,28 L 644,48 L 655,40 L 690,40 Q 710,24 730,40 L 900,40 L 915,35 L 925,45 L 935,40 L 960,40 L 970,10 L 982,72 L 994,28 L 1004,48 L 1015,40 L 1050,40 Q 1070,24 1090,40 L 1200,40"
            />
          </svg>
        </div>

        <div className="da-telemetry-bar">
          <div className="da-telemetry-badge">
            <span className="da-telemetry-cross">✚</span>
            <span className="da-telemetry-station">CLINICAL TRIAGE &bull; STATION 01</span>
          </div>
          <div className="da-telemetry-badge">
            <Activity size={13} className="da-telemetry-wave-icon" />
            <span>LEAD II &bull; 74 BPM (NORMAL SINUS)</span>
          </div>
          <div className="da-telemetry-badge">
            <span className="da-telemetry-bead-live" />
            <span>QUEUE SYNC ACTIVE</span>
          </div>
        </div>

        <div className="da-watermark-cross da-watermark-cross--tl">✚</div>
        <div className="da-watermark-cross da-watermark-cross--br">✚</div>
      </div>

      {error && (
        <div className="da-alert">
          <span>{error}</span>
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
            className="da-refresh-btn da-instrument--calibrator"
            type="button"
            onClick={() => fetchAppointments({ silent: true })}
            disabled={refreshing}
            title="Medical Telemetry Calibrator & Patient Queue Sync"
          >
            <span className="da-calibrator-body">
              <span className="da-instrument-grip" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="da-calibrator-dial">
                <RefreshCw size={14} className={`da-instrument-icon ${refreshing ? "da-spin" : ""}`} />
              </span>
              <span className="da-instrument-text">{refreshing ? "CALIBRATING..." : "CALIBRATE / SYNC"}</span>
              <span className="da-calibrator-bead" aria-hidden="true" />
            </span>
          </button>
        </div>
      </div>

      {/* ── Patient Telemetry Queue Table ── */}
      <div className="da-table-card">
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
                  {/* 1. Diagnostic Optical Scope (Ophthalmoscope) */}
                  <button
                    className="da-act-btn da-act-btn--scope"
                    type="button"
                    title="Diagnostic Ophthalmoscope (View Patient Record)"
                    onClick={() => openPatient(patient)}
                    disabled={!patient.patientId}
                    aria-label="View Patient Record"
                  >
                    <span className="da-scope-bezel">
                      <span className="da-scope-lens">
                        <Eye size={15} />
                      </span>
                      <span className="da-scope-glare" />
                    </span>
                  </button>

                  {/* 2. Electronic Stethoscope & Clinical Notes Sensor */}
                  <button
                    className="da-act-btn da-act-btn--chart"
                    type="button"
                    title="Electronic Stethoscope & Clinical Notes Sensor"
                    onClick={() => openNotes(patient)}
                    aria-label="Open Clinical Notes"
                  >
                    <span className="da-steth-chestpiece">
                      <span className="da-steth-diaphragm">
                        <FileText size={15} />
                        <span className="da-steth-pulse-ring" />
                      </span>
                      <span className="da-steth-stem" />
                    </span>
                  </button>

                  {/* 3. Surgical Laser Scalpel / Ultrasound Probe */}
                  <button
                    className="da-act-btn da-act-btn--laser da-act-btn--primary"
                    type="button"
                    title="Surgical Laser Scalpel (Start Consultation)"
                    onClick={() => startConsultation(patient)}
                    disabled={!canCreateConsultation}
                    aria-label="Start Consultation"
                  >
                    <span className="da-laser-casing">
                      <span className="da-laser-handle">
                        <span className="da-laser-grip-line" />
                        <span className="da-laser-grip-line" />
                      </span>
                      <span className="da-laser-emitter">
                        <Play size={14} />
                        <span className="da-laser-beam" />
                      </span>
                    </span>
                  </button>
                </span>
              </div>
            ))
          ) : (
            <div className="da-empty-row">No appointments found.</div>
          )}
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
                title="Diagnostic History Scanner"
              >
                <User size={15} />
                <span>View Patient History</span>
              </button>

              <button
                type="button"
                className="da-notes-btn da-notes-btn--primary da-instrument-btn"
                onClick={() => {
                  const patient = selectedNotes.patient;
                  setSelectedNotes(null);
                  startConsultation(patient);
                }}
                disabled={!canCreateConsultation}
                title="Surgical Laser Probe / Launch Consultation"
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

