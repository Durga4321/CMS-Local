import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Consultation.css";
import { apiUrl } from "../../config/api";
import {
  filterByLoggedInDoctor,
  getAuthToken,
  getLoggedInDoctor,
} from "../utils/doctorSession";
import {
  fetchDiagnosisOptions,
  mergeDiagnosisOption,
} from "../utils/diagnosisOptions";
import { formatDateMMDDYYYY } from "../../utils/dateFormat";

const STEPS = [
  "Waiting",
  "Consultation Started",
  "Prescription Added",
  "Completed",
];

const APPOINTMENTS_API = apiUrl("Appointment");
const MEDICAL_HISTORY_API = apiUrl("MedicalHistory");
const CONSULTATION_API = apiUrl("Consultation");

const emptyValue = "-";
const CLINICAL_NOTE_SECTIONS = [
  { key: "noteSubjective", label: "Subjective" },
  { key: "noteAssessment", label: "Assessment" },
  { key: "notePlan", label: "Plan" },
];

const DEFAULT_DIAGNOSIS_OPTIONS = [
  "Fever",
  "Upper respiratory infection",
  "Gastritis",
  "Hypertension",
  "Diabetes follow-up",
  "Migraine",
  "Allergic rhinitis",
  "Back pain",
  "Community Acquired Pneumonia",
];

const getInitials = (name) =>
  String(name || "P")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "P";

const getDisplayDate = (value) => formatDateMMDDYYYY(value, emptyValue);

const pickVital = (item = {}, fallback = {}, key) =>
  item[key] || item.vitals?.[key] || fallback[key] || fallback.vitals?.[key] || "";

const normalizeAppointment = (item, fallback = {}) => {
  if (!item) return null;

  return {
    ...item,
    appointmentId: item.appointmentId || item.id || fallback.appointmentId,
    patientId: item.patientId || fallback.patientId,
    patientName: item.patientName || fallback.patientName || emptyValue,
    patientCode: item.patientCode || fallback.patientCode || emptyValue,
    age: item.age ?? fallback.age ?? emptyValue,
    gender: item.gender || fallback.gender || emptyValue,
    phone: item.phone || fallback.phone || emptyValue,
    date: item.date || fallback.date || "",
    time: item.time || fallback.time || "",
    chiefComplaints:
      item.chiefComplaints ||
      item.symptoms ||
      fallback.chiefComplaints ||
      "",
    bloodPressure: pickVital(item, fallback, "bloodPressure"),
    sugarLevel: pickVital(item, fallback, "sugarLevel"),
    temperature: pickVital(item, fallback, "temperature"),
    weight: pickVital(item, fallback, "weight"),
    pulseRate: pickVital(item, fallback, "pulseRate"),
    respiratoryRate: pickVital(item, fallback, "respiratoryRate"),
    status: item.status || fallback.status || "Waiting",
  };
};

const normalizeOverview = (data) => ({
  allergies: data?.allergies || emptyValue,
  chronicDiseases: data?.chronicDiseases || emptyValue,
  currentMedications: data?.currentMedications || emptyValue,
  lastVisit: data?.lastVisit || emptyValue,
  bloodGroup: data?.bloodGroup || emptyValue,
});

const updateAppointmentStatusAPI = async (appointmentId, newStatus, headers = {}) => {
  if (!appointmentId) return null;

  const defaultHeaders = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  };
  const finalHeaders = { ...defaultHeaders, ...headers };

  const routes = [
    `${APPOINTMENTS_API}/${appointmentId}`,
  ];

  const payload = JSON.stringify({ status: newStatus });

  for (const url of routes) {
    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: finalHeaders,
        body: payload,
      });
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return data || { status: newStatus };
      }
    } catch (err) {
      console.warn(`Failed to update status at ${url}:`, err.message);
    }
  }

  console.warn(`Could not update appointment ${appointmentId} to status "${newStatus}"`);
  return { status: newStatus };
};

const getStepFromStatus = (status) => {
  const cleanStatus = String(status || "").trim().toLowerCase();

  if (cleanStatus === "completed") return 3;
  if (cleanStatus === "prescription added") return 2;
  return 1;
};

const getFallbackAppointment = (appointments) =>
  appointments.find((item) =>
    ["waiting", "inprogress", "in progress"].includes(
      String(item.status || "").trim().toLowerCase()
    )
  ) || appointments[0];

const getClinicalSection = (text, heading, nextHeading) => {
  const source = String(text || "");
  const nextPattern = nextHeading ? `\\n\\s*${nextHeading}\\s*\\n` : "$";
  const pattern = new RegExp(`${heading}\\s*\\n[-\\s]*\\n?([\\s\\S]*?)(?=${nextPattern})`, "i");
  return (source.match(pattern)?.[1] || "").trim();
};

const parseClinicalNotes = (text) => {
  const source = String(text || "").trim();
  if (!source) {
    return {
      noteSubjective: "",
      noteAssessment: "",
      notePlan: "",
    };
  }

  const noteSubjective = getClinicalSection(source, "Subjective", "Assessment");
  const noteAssessment = getClinicalSection(source, "Assessment", "Plan");
  const notePlan = getClinicalSection(source, "Plan");

  if (noteSubjective || noteAssessment || notePlan) {
    return { noteSubjective, noteAssessment, notePlan };
  }

  return {
    noteSubjective: source,
    noteAssessment: "",
    notePlan: "",
  };
};

const buildClinicalNotes = ({ noteSubjective, noteAssessment, notePlan }) =>
  `Subjective\n${String(noteSubjective || "").trim()}\n\nAssessment\n${String(
    noteAssessment || ""
  ).trim()}\n\nPlan\n${String(notePlan || "").trim()}`.trim();

function Consultation() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = React.useMemo(() => location.state || {}, [location.state]);

  const [step, setStep] = useState(1);
  const [appointment, setAppointment] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [diagnosisOptions, setDiagnosisOptions] = useState([]);
  const [lastEdited, setLastEdited] = useState("");
  const [form, setForm] = useState({
    complaintsChoice: "",
    diagnosis: "",
    bp: "",
    sugar: "",
    temp: "",
    weight: "",
    pulse: "",
    resp: "",
    noteSubjective: "",
    noteAssessment: "",
    notePlan: "",
  });

  useEffect(() => {
    let isActive = true;

    fetchDiagnosisOptions()
      .then((options) => {
        if (isActive) setDiagnosisOptions(options);
      })
      .catch((err) => {
        console.warn("Unable to load diagnosis suggestions.", err);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const loadConsultation = async () => {
      try {
        setLoading(true);
        setError("");
        setMessage("");

        const routeAppointment = normalizeAppointment(
          routeState.appointment || routeState.patient,
          {
            appointmentId: routeState.appointmentId,
            patientId: routeState.patientId,
            patientCode: routeState.patient?.patientCode,
            patientName: routeState.patient?.name || routeState.patient?.patientName,
            age: routeState.patient?.age,
            gender: routeState.patient?.gender,
          }
        );

        const token = getAuthToken();
        const headers = {
          "ngrok-skip-browser-warning": "true",
          "Content-Type": "application/json",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        let apiAppointments = [];
        const appointmentsResponse = await fetch(APPOINTMENTS_API, {
          headers,
        });

        if (appointmentsResponse.ok) {
          const data = await appointmentsResponse.json();
          let rawAppointments = Array.isArray(data) ? data : [];
          rawAppointments = filterByLoggedInDoctor(
            rawAppointments,
            getLoggedInDoctor()
          );

          apiAppointments = rawAppointments.map((item) =>
            normalizeAppointment(item, {
              patientId: routeState.patientId || routeAppointment?.patientId,
            })
          );
        }

        const selected =
          apiAppointments.find(
            (item) =>
              String(item.appointmentId) ===
              String(routeState.appointmentId || routeAppointment?.appointmentId)
          ) ||
          apiAppointments.find(
            (item) =>
              routeAppointment?.patientCode &&
              String(item.patientCode) === String(routeAppointment.patientCode)
          ) ||
          routeAppointment ||
          getFallbackAppointment(apiAppointments);

        if (!selected?.appointmentId) {
          throw new Error("No appointment found for consultation.");
        }

        const selectedAppointment = normalizeAppointment(selected, {
          patientId: routeState.patientId || routeAppointment?.patientId,
        });

        let savedConsultation = null;
        const consultationResponse = await fetch(
          `${CONSULTATION_API}/appointment/${selectedAppointment.appointmentId}`,
          {
            headers,
          }
        );

        if (consultationResponse.ok) {
          savedConsultation = await consultationResponse.json();
        }

        const hydratedAppointment = {
          ...selectedAppointment,
          patientId: selectedAppointment.patientId || savedConsultation?.patientId,
        };

        let patientOverview = null;
        if (hydratedAppointment.patientId) {
          const overviewResponse = await fetch(
            `${MEDICAL_HISTORY_API}/${hydratedAppointment.patientId}`,
            {
              headers,
            }
          );

          if (overviewResponse.ok) {
            patientOverview = normalizeOverview(await overviewResponse.json());
          }
        }

        const appointmentComplaint = hydratedAppointment.chiefComplaints || "";

        setAppointment(hydratedAppointment);
        setOverview(patientOverview);
        setStep(getStepFromStatus(hydratedAppointment.status));
        const clinicalSections = parseClinicalNotes(savedConsultation?.clinicalNotes);

        setForm({
          complaintsChoice: appointmentComplaint,
          diagnosis: savedConsultation?.diagnosis || "",
          bp: hydratedAppointment.bloodPressure || "",
          sugar: hydratedAppointment.sugarLevel || "",
          temp: hydratedAppointment.temperature || "",
          weight: hydratedAppointment.weight || "",
          pulse: hydratedAppointment.pulseRate || "",
          resp: hydratedAppointment.respiratoryRate || "",
          ...clinicalSections,
        });
      } catch (err) {
        console.error(err);
        setError(err.message || "Unable to load consultation.");
      } finally {
        setLoading(false);
      }
    };

    loadConsultation();
  }, [routeState]);

  const patient = useMemo(() => {
    if (!appointment) return null;

    return {
      initials: getInitials(appointment.patientName),
      name: appointment.patientName,
      pid: appointment.patientCode,
      age: `${appointment.age} Y / ${appointment.gender}`,
      type: "OPD",
      allergies: overview?.allergies || emptyValue,
      chronic: overview?.chronicDiseases || emptyValue,
      medication: overview?.currentMedications || emptyValue,
      lastVisit: overview?.lastVisit || getDisplayDate(appointment.date),
      blood: overview?.bloodGroup || emptyValue,
    };
  }, [appointment, overview]);

  const diagnosisSelectOptions = useMemo(() => {
    const options = new Set(DEFAULT_DIAGNOSIS_OPTIONS);
    diagnosisOptions.forEach((diagnosis) => {
      if (diagnosis) options.add(diagnosis);
    });
    if (form.diagnosis) options.add(form.diagnosis);
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [diagnosisOptions, form.diagnosis]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (e.target.name.startsWith("note")) {
      setLastEdited(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }
  };

  const saveConsultation = async () => {
    if (!appointment?.appointmentId || !appointment?.patientId) {
      setError("Appointment id or patient id is missing.");
      return null;
    }

    if (!form.diagnosis.trim()) {
      setError("Diagnosis is required.");
      return null;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const token = getAuthToken();
      const headers = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const requestBody = {
        appointmentId: Number(appointment.appointmentId),
        patientId: Number(appointment.patientId),
        doctorId: appointment.doctorId || appointment.doctor?.id || undefined,
        diagnosis: form.diagnosis.trim(),
        clinicalNotes: buildClinicalNotes(form),
      };

      if (form.complaintsChoice.trim()) {
        requestBody.chiefComplaints = form.complaintsChoice.trim();
      }

      const response = await fetch(CONSULTATION_API, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to save consultation.");
      }

      const updatedStatus = "In Progress";
      await updateAppointmentStatusAPI(appointment.appointmentId, updatedStatus, headers);

      setAppointment((prev) => ({
        ...prev,
        status: updatedStatus,
      }));
      setStep(1);
      setDiagnosisOptions((prev) =>
        mergeDiagnosisOption(prev, form.diagnosis)
      );
      setMessage(data.message || "Consultation saved.");

      window.dispatchEvent(new CustomEvent("appointmentStatusUpdated", {
        detail: { appointmentId: appointment.appointmentId, status: updatedStatus },
      }));

      return data;
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to save consultation.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleAddPrescription = async () => {
    const result = await saveConsultation();
    if (!result) return;

    navigate("/doctor/prescription", {
      state: {
        appointmentId: appointment.appointmentId,
        patientId: appointment.patientId,
        appointment,
        patient,
        consultation: {
          ...result,
          diagnosis: result.diagnosis || form.diagnosis,
          clinicalNotes: result.clinicalNotes || buildClinicalNotes(form),
        },
      },
    });
  };

  useEffect(() => {
    if (!loading && error && !appointment) {
      navigate("/doctor/dashboard", { replace: true });
    }
  }, [appointment, error, loading, navigate]);

  if (loading) {
    return <div className="cn-state-card">Loading consultation...</div>;
  }

  if (error && !appointment) {
    return <div className="cn-state-card cn-state-card--error">{error}</div>;
  }

  return (
    <div className="cn-page">
      <div className="cn-stepper">
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <div className="cn-step">
              <div
                className={`cn-step-circle ${i < step ? "done" : i === step ? "active" : ""
                  }`}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`cn-step-label ${i === step ? "active" : ""}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`cn-step-line ${i < step ? "done" : ""}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {error ? <div className="cn-inline-error">{error}</div> : null}
      {message ? <div className="cn-inline-success">{message}</div> : null}

      <div className="cn-body">
        <aside className="cn-patient-panel">
          <div className="cn-patient-card">
            <div className="cn-pat-avatar">{patient.initials}</div>
            <div>
              <p className="cn-pat-name">{patient.name}</p>
              <p className="cn-pat-sub">
                PID: {patient.pid} · {patient.age}
              </p>
              <span className="cn-pat-badge">{patient.type}</span>
            </div>
          </div>

          <div className="cn-panel-section">
            <p className="cn-panel-heading">History Summary</p>
            {[
              ["Allergies", patient.allergies],
              ["Chronic Diseases", patient.chronic],
              ["Current Medication", patient.medication],
              ["Last Visit", patient.lastVisit],
              ["Blood Group", patient.blood],
            ].map(([key, value]) => (
              <div className="cn-history-row" key={key}>
                <span className="cn-history-key">{key}</span>
                <span className="cn-history-val">{value}</span>
              </div>
            ))}
          </div>

          <div className="cn-panel-section">
            <p className="cn-panel-heading">Vitals</p>
            {[
              ["BP", form.bp || emptyValue],
              ["Pulse", form.pulse || emptyValue],
              ["Temperature", form.temp || emptyValue],
              ["Weight", form.weight || emptyValue],
              ["Sugar (R)", form.sugar || emptyValue],
            ].map(([key, value]) => (
              <div className="cn-history-row" key={key}>
                <span className="cn-history-key">{key}</span>
                <span className="cn-history-val cn-vitals-val">{value}</span>
              </div>
            ))}
          </div>
        </aside>

        <section className="cn-form-panel">
          <div className="cn-field">
            <label className="cn-label">Chief Complaints / Symptoms *</label>
            <input
              className="cn-input"
              name="complaintsChoice"
              value={form.complaintsChoice}
              onChange={handleChange}
              placeholder="Enter chief complaints or symptoms"
            />
          </div>

          <div className="cn-vitals-grid">
            {[
              ["Blood Pressure", "bp", form.bp],
              ["Sugar Level", "sugar", form.sugar],
              ["Temperature", "temp", form.temp],
              ["Weight", "weight", form.weight],
              ["Pulse Rate", "pulse", form.pulse],
              ["Respiratory Rate", "resp", form.resp],
            ].map(([label, name, value]) => (
              <div className="cn-field" key={name}>
                <label className="cn-label">{label}</label>
                <input
                  className="cn-input"
                  name={name}
                  value={value}
                  onChange={handleChange}
                />
              </div>
            ))}
          </div>

          <div className="cn-field">
            <div className="cn-notes-card">
              <div className="cn-notes-header">
                <label className="cn-label">Clinical Notes</label>
                <span>Auto Saved</span>
              </div>
              <div className="cn-notes-sections">
                {CLINICAL_NOTE_SECTIONS.map((section) => (
                  <div className="cn-note-section" key={section.key}>
                    <p className="cn-note-section-title">{section.label}</p>
                    <textarea
                      className="cn-textarea cn-notes-textarea"
                      name={section.key}
                      value={form[section.key]}
                      onChange={handleChange}
                      rows={4}
                      placeholder={`Enter ${section.label.toLowerCase()} notes`}
                    />
                  </div>
                ))}
              </div>
              <div className="cn-notes-footer">
                <span>Character Count: {buildClinicalNotes(form).length}</span>
                <span>Last Edited: {lastEdited || "-"}</span>
              </div>
            </div>
          </div>

          <div className="cn-field">
            <label className="cn-label">Diagnosis *</label>
            <input
              className="cn-input"
              name="diagnosis"
              list="consultation-diagnosis-options"
              value={form.diagnosis}
              onChange={handleChange}
              placeholder="Select or type diagnosis"
              autoComplete="off"
            />
            <datalist id="consultation-diagnosis-options">
              {diagnosisSelectOptions.map((diagnosis) => (
                <option value={diagnosis} key={diagnosis} />
              ))}
            </datalist>
          </div>

          <div className="cn-form-actions">
            <button
              className="cn-btn-save"
              type="button"
              onClick={saveConsultation}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Notes"}
            </button>
            <button
              className="cn-btn-primary"
              type="button"
              onClick={handleAddPrescription}
              disabled={saving}
            >
              {saving ? "Saving..." : "Add Prescription →"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Consultation;
