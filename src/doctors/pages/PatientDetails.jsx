import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FileText, Printer } from "lucide-react";
import "./PatientDetails.css";
import { apiUrl } from "../../config/api";
import {
  filterByLoggedInDoctor,
  getAuthToken,
  getLoggedInDoctor,
  getRecordDoctorId,
  getRecordDoctorName,
  isAssignedToLoggedInDoctor,
} from "../utils/doctorSession";
import { formatDateMMDDYYYY } from "../../utils/dateFormat";

const OVERVIEW_API = apiUrl("Overview/patient");
const APPOINTMENTS_API = apiUrl("Appointment");
const PRESCRIPTIONS_API = apiUrl("Prescription");
const MEDICAL_HISTORY_API = apiUrl("MedicalHistory");

const TABS = [
  "Overview",
  "Medical History",
  "Previous Visits",
  "Past Prescriptions",
  "Documents",
];

const emptyValue = "-";

const getInitials = (name) =>
  String(name || "P")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "P";

const formatDate = (value) => formatDateMMDDYYYY(value, emptyValue);

const parseList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.appointments)) return data.appointments;
  if (Array.isArray(data?.history)) return data.history;
  return [];
};

const getDocumentUrl = (document) => {
  const value =
    document?.url ||
    document?.documentUrl ||
    document?.fileUrl ||
    document?.path ||
    document?.downloadUrl ||
    "";

  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return apiUrl(String(value).replace(/^\/?api\/?/i, ""));
};

const getDocumentName = (document, index) =>
  document?.fileName ||
  document?.name ||
  document?.documentName ||
  document?.title ||
  `Document ${index + 1}`;

const getAppointmentId = (record) =>
  record?.appointmentId || record?.id || record?.appointment?.id || "";

const getPrescriptionAppointmentId = (record) =>
  record?.appointmentId ||
  record?.appointment?.id ||
  record?.appointment?.appointmentId ||
  "";

const getPatientId = (record) =>
  record?.patientId || record?.patient?.id || record?.appointment?.patientId || "";

const getVisitDate = (record) =>
  record?.date || record?.appointmentDate || record?.lastVisit || "";

const getDateKey = (value) => {
  if (!value) return "";

  const raw = String(value);
  const isoDate = raw.split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizePatient = (data) => ({
  id: data?.id,
  patientCode: data?.patientCode || emptyValue,
  name: data?.name || emptyValue,
  phone: data?.phone || emptyValue,
  email: data?.email || emptyValue,
  address: data?.address || emptyValue,
  age: data?.age ?? emptyValue,
  gender: data?.gender || emptyValue,
  bloodGroup: data?.bloodGroup || emptyValue,
  dateOfBirth: formatDate(data?.dateOfBirth),
  emergencyContactName: data?.emergencyContactName || "",
  emergencyContactPhone: data?.emergencyContactPhone || "",
  overallAppointments: data?.overallAppointments ?? 0,
  lastVisit: data?.lastVisit || emptyValue,
  allergies: data?.allergies || emptyValue,
  chronicDiseases: data?.chronicDiseases || emptyValue,
  currentMedications: data?.currentMedications || emptyValue,
  surgeries: data?.surgeries || emptyValue,
  previousVisits: Array.isArray(data?.previousVisits) ? data.previousVisits : [],
  pastPrescriptions: Array.isArray(data?.pastPrescriptions)
    ? data.pastPrescriptions
    : [],
});

const isSamePatientAppointment = (appointment, patientId, patient) => {
  const selectedPatientId = String(patientId || patient?.id || "").trim();
  if (selectedPatientId && String(getPatientId(appointment)) === selectedPatientId) {
    return true;
  }

  const patientCode = String(patient?.patientCode || "").trim().toLowerCase();
  const appointmentPatientCode = String(
    appointment?.patientCode ||
      appointment?.patient?.patientCode ||
      appointment?.patient?.code ||
      ""
  )
    .trim()
    .toLowerCase();

  if (patientCode && appointmentPatientCode && patientCode === appointmentPatientCode) {
    return true;
  }

  const phone = String(patient?.phone || "").trim();
  const appointmentPhone = String(appointment?.phone || appointment?.patient?.phone || "").trim();

  if (phone && appointmentPhone && phone === appointmentPhone) {
    return true;
  }

  return false;
};

const normalizeVisit = (visit) => ({
  ...visit,
  appointmentId: getAppointmentId(visit),
  patientId: getPatientId(visit),
  tokenNumber: visit?.tokenNumber || emptyValue,
  date: getVisitDate(visit) || emptyValue,
  time: visit?.time || emptyValue,
  doctorId: getRecordDoctorId(visit),
  doctorName: getRecordDoctorName(visit),
  symptoms:
    visit?.symptoms ||
    visit?.chiefComplaints ||
    visit?.complaint ||
    visit?.reason ||
    "",
  bloodPressure: visit?.bloodPressure || emptyValue,
  sugarLevel: visit?.sugarLevel || emptyValue,
  temperature: visit?.temperature || emptyValue,
  weight: visit?.weight || emptyValue,
  pulseRate: visit?.pulseRate || emptyValue,
  respiratoryRate: visit?.respiratoryRate || emptyValue,
  status: visit?.status || "Scheduled",
});

const getVisitSortValue = (visit) => {
  const dateKey = getDateKey(visit?.date);
  const time = String(visit?.time || "00:00").slice(0, 5);
  const value = /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
    ? new Date(`${dateKey}T${time || "00:00"}`).getTime()
    : new Date(`${dateKey} ${time || "00:00"}`).getTime();
  return Number.isNaN(value) ? 0 : value;
};

const sortVisits = (visits) =>
  [...visits].sort((a, b) => getVisitSortValue(b) - getVisitSortValue(a));

const mergeVisits = (...visitGroups) => {
  const visitsByKey = new Map();

  visitGroups.flat().forEach((visit) => {
    if (!visit) return;
    const normalized = normalizeVisit(visit);
    const key = normalized.appointmentId
      ? `appointment-${normalized.appointmentId}`
      : `${normalized.date}-${normalized.time}-${normalized.doctorName}`;

    if (!visitsByKey.has(key)) {
      visitsByKey.set(key, normalized);
    }
  });

  return sortVisits([...visitsByKey.values()]);
};

const getOldestVisit = (visits) => {
  if (!Array.isArray(visits) || visits.length < 2) return null;
  return visits[visits.length - 1];
};

const getOverallAppointmentsLabel = (name) => {
  const patientName = String(name || "").trim();
  if (!patientName || patientName === emptyValue) {
    return "Patient's Overall Appointments";
  }

  const possessiveName = /s$/i.test(patientName)
    ? `${patientName}'`
    : `${patientName}'s`;
  return `${possessiveName} Overall Appointments`;
};

const looksLikePrescription = (record) =>
  Boolean(
    record &&
      typeof record === "object" &&
      (record.id ||
        record.diagnosis ||
        record.instructions ||
        record.followUpDate ||
        Array.isArray(record.medicines))
  );

const parsePrescriptionList = (data) => {
  if (Array.isArray(data)) return data.filter(looksLikePrescription);
  if (Array.isArray(data?.data)) return data.data.filter(looksLikePrescription);
  if (looksLikePrescription(data)) return [data];
  return [];
};

const buildVisitLookup = (visits) =>
  new Map(
    visits
      .filter((visit) => visit.appointmentId)
      .map((visit) => [String(visit.appointmentId), visit])
  );

const getPrescriptionsForVisits = (prescriptions, visits) => {
  const visitsByAppointmentId = buildVisitLookup(visits);

  return (Array.isArray(prescriptions) ? prescriptions : [])
    .filter((prescription) => {
      const appointmentId = String(
        getPrescriptionAppointmentId(prescription) || ""
      ).trim();
      return appointmentId && visitsByAppointmentId.has(appointmentId);
    })
    .map((prescription) => ({
      ...prescription,
      appointmentId: getPrescriptionAppointmentId(prescription),
      visitDate:
        prescription.visitDate ||
        prescription.appointmentDate ||
        prescription.appointment?.date ||
        visitsByAppointmentId.get(String(getPrescriptionAppointmentId(prescription)))?.date,
      medicines: Array.isArray(prescription.medicines)
        ? prescription.medicines
        : [],
    }));
};

const fetchPrescriptionsForVisits = async (visits, headers) => {
  if (!visits.some((visit) => visit.appointmentId)) return [];

  try {
    const response = await fetch(PRESCRIPTIONS_API, { headers });
    if (!response.ok) return [];

    return getPrescriptionsForVisits(
      parsePrescriptionList(await response.json()),
      visits
    );
  } catch (error) {
    console.warn("Unable to load prescriptions.", error);
    return [];
  }
};

const fetchDocumentsForVisits = async (visits, headers) => {
  const visitsWithAppointments = visits.filter((visit) => visit.appointmentId);
  if (!visitsWithAppointments.length) return [];

  const results = await Promise.all(
    visitsWithAppointments.map((visit) =>
      fetch(apiUrl(`Overview/${visit.appointmentId}/documents`), { headers })
        .then(async (response) => {
          if (!response.ok) return [];
          return parseList(await response.json()).map((document) => ({
            ...document,
            appointmentId: visit.appointmentId,
            visitDate: visit.date,
            doctorName: visit.doctorName,
          }));
        })
        .catch(() => [])
    )
  );

  return results.flat();
};

const getPrescriptionDisplayDate = (prescription) =>
  prescription.visitDate ||
  prescription.appointmentDate ||
  prescription.appointment?.date ||
  prescription.prescriptionDate ||
  prescription.createdAt ||
  prescription.date ||
  emptyValue;

const getEmergencyContact = (patient) => {
  const name = patient.emergencyContactName;
  const phone = patient.emergencyContactPhone;

  if (name && phone) return `${name} (${phone})`;
  return name || phone || emptyValue;
};

function PatientDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const { patientId } = useParams();
  const fallbackPatientId = location.state?.patient?.patientId;
  const sourceAppointment = location.state?.patient;
  const selectedPatientId = patientId || fallbackPatientId;

  const [activeTab, setActiveTab] = useState("Overview");
  const [patient, setPatient] = useState(null);
  const [medicalHistory, setMedicalHistory] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPatient = async () => {
      if (!selectedPatientId) {
        setError("Patient id is missing.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const token = getAuthToken();
        const headers = {
          "ngrok-skip-browser-warning": "true",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const currentDoctor = getLoggedInDoctor();
        const response = await fetch(`${OVERVIEW_API}/${selectedPatientId}`, {
          headers,
        });

        if (!response.ok) {
          throw new Error("Unable to load patient details.");
        }

        const data = await response.json();
        let historyData = null;
        const historyResponse = await fetch(`${MEDICAL_HISTORY_API}/${selectedPatientId}`, {
          headers,
        }).catch(() => null);

        if (historyResponse?.ok) {
          historyData = await historyResponse.json().catch(() => null);
        }

        const overviewPatient = normalizePatient({
          ...data,
          ...historyData,
        });

        setMedicalHistory(historyData);

        const appointmentsResponse = await fetch(APPOINTMENTS_API, {
          headers,
        }).catch(() => null);

        let appointmentVisits = [];
        let totalPatientAppointments = overviewPatient.overallAppointments;
        if (appointmentsResponse?.ok) {
          const appointments = parseList(await appointmentsResponse.json());
          const patientAppointments = appointments.filter((appointment) =>
              isSamePatientAppointment(
                appointment,
                selectedPatientId,
                overviewPatient
              )
          );

          totalPatientAppointments =
            patientAppointments.length || overviewPatient.overallAppointments;

          appointmentVisits = filterByLoggedInDoctor(
            patientAppointments,
            currentDoctor
          ).map(normalizeVisit);
        }

        const overviewVisits = filterByLoggedInDoctor(
          overviewPatient.previousVisits,
          currentDoctor
        ).map(normalizeVisit);

        const routeVisit =
          sourceAppointment &&
          isSamePatientAppointment(
            sourceAppointment,
            selectedPatientId,
            overviewPatient
          ) &&
          isAssignedToLoggedInDoctor(sourceAppointment, currentDoctor)
            ? normalizeVisit(sourceAppointment)
            : null;

        const scopedVisits = mergeVisits(
          appointmentVisits,
          overviewVisits,
          routeVisit ? [routeVisit] : []
        );

        const prescriptionsFromAppointments =
          await fetchPrescriptionsForVisits(scopedVisits, headers);
        const documentsFromAppointments = await fetchDocumentsForVisits(
          scopedVisits,
          headers
        );
        const fallbackPrescriptions = getPrescriptionsForVisits(
          overviewPatient.pastPrescriptions,
          scopedVisits
        );
        const scopedPrescriptions = prescriptionsFromAppointments.length
          ? prescriptionsFromAppointments
          : fallbackPrescriptions;
        const oldestVisit = getOldestVisit(scopedVisits);

        setPatient({
          ...overviewPatient,
          previousVisits: scopedVisits,
          pastPrescriptions: scopedPrescriptions,
          overallAppointments: totalPatientAppointments,
          assignedAppointments: scopedVisits.length,
          lastVisit: oldestVisit
            ? formatDate(oldestVisit.date)
            : emptyValue,
        });
        setDocuments(documentsFromAppointments);
      } catch (err) {
        console.error(err);
        setError(err.message || "Unable to load patient details.");
      } finally {
        setLoading(false);
      }
    };

    fetchPatient();
  }, [selectedPatientId, sourceAppointment]);

  const overview = useMemo(() => {
    if (!patient) return [];

    return [
      { label: "Allergies", value: patient.allergies },
      { label: "Chronic Diseases", value: patient.chronicDiseases },
      { label: "Current Medications", value: patient.currentMedications },
      { label: "Surgeries", value: patient.surgeries },
      {
        label: getOverallAppointmentsLabel(patient.name),
        value: patient.overallAppointments,
      },
      { label: "Assigned Visits", value: patient.assignedAppointments },
      { label: "Last Visit", value: patient.lastVisit },
    ];
  }, [patient]);

  const medicines = useMemo(
    () =>
      (patient?.pastPrescriptions || []).flatMap((prescription) =>
        (Array.isArray(prescription.medicines)
          ? prescription.medicines
          : []
        ).map((medicine) => ({
          ...medicine,
          prescriptionId: prescription.id || prescription.appointmentId,
          diagnosis: prescription.diagnosis,
        }))
      ),
    [patient]
  );

  const startConsultation = () => {
    navigate("/doctor/consultation", {
      state: {
        appointmentId: sourceAppointment?.appointmentId,
        appointment: sourceAppointment,
        patientId: selectedPatientId,
        patient,
      },
    });
  };

  const printHistory = () => {
    const printWindow = window.open("", "_blank", "width=820,height=960");
    if (!printWindow) {
      window.print();
      return;
    }

    const visitsHtml = patient.previousVisits.length
      ? patient.previousVisits
          .map(
            (visit) => `
              <tr>
                <td>${formatDate(visit.date)}</td>
                <td>${visit.doctorName || emptyValue}</td>
                <td>${visit.symptoms || emptyValue}</td>
                <td>${visit.bloodPressure || emptyValue}</td>
                <td>${visit.status || emptyValue}</td>
              </tr>`
          )
          .join("")
      : `<tr><td colspan="5">No previous visits found.</td></tr>`;

    const prescriptionsHtml = patient.pastPrescriptions.length
      ? patient.pastPrescriptions
          .map(
            (prescription) => `
              <section class="block">
                <h3>${prescription.diagnosis || "Diagnosis not recorded"}</h3>
                <p>${prescription.instructions || "No instructions recorded"}</p>
                <p><b>Date:</b> ${formatDate(getPrescriptionDisplayDate(prescription))}</p>
              </section>`
          )
          .join("")
      : `<p>No past prescriptions found.</p>`;

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Patient History - ${patient.name}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; padding: 28px; }
            h1 { margin: 0 0 8px; }
            h2 { margin-top: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
            .meta { color: #475569; margin: 3px 0; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 16px; }
            .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
            .card span { display: block; color: #64748b; font-size: 12px; margin-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 8px; text-align: left; }
            .block { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <h1>Patient History</h1>
          <p class="meta"><b>${patient.name}</b> | PID: ${patient.patientCode}</p>
          <p class="meta">${patient.age} Years / ${patient.gender} | Blood Group: ${patient.bloodGroup}</p>
          <p class="meta">Phone: ${patient.phone} | Email: ${patient.email}</p>
          <h2>Medical History</h2>
          <div class="grid">
            ${overview
              .map((item) => `<div class="card"><span>${item.label}</span><b>${item.value || emptyValue}</b></div>`)
              .join("")}
          </div>
          <h2>Previous Visits</h2>
          <table>
            <thead><tr><th>Date</th><th>Doctor</th><th>Complaints</th><th>BP</th><th>Status</th></tr></thead>
            <tbody>${visitsHtml}</tbody>
          </table>
          <h2>Prescriptions</h2>
          ${prescriptionsHtml}
          <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  useEffect(() => {
    if (!loading && (error || !patient)) {
      navigate("/doctor/dashboard", { replace: true });
    }
  }, [error, loading, navigate, patient]);

  if (loading) {
    return <div className="pd-state-card">Loading patient details...</div>;
  }

  if (error) {
    return <div className="pd-state-card pd-state-card--error">{error}</div>;
  }

  if (!patient) {
    return <div className="pd-state-card">No patient details found.</div>;
  }

  return (
    <div className="pd-page">
      <div className="pd-toprow">
        <h2 className="pd-page-title">Patient Details</h2>
        <button className="pd-start-btn" type="button" onClick={startConsultation}>
          Start Consultation
        </button>
      </div>

      <div className="pd-info-row">
        <div className="pd-info-left">
          <div className="pd-avatar">{getInitials(patient.name)}</div>
          <div>
            <div className="pd-name-row">
              <h3 className="pd-patient-name">{patient.name}</h3>
              <span className="pd-type-badge">OPD</span>
            </div>
            <p className="pd-meta">
              PID: {patient.patientCode} · {patient.age} Years / {patient.gender} ·{" "}
              {patient.dateOfBirth}
            </p>
            <p className="pd-meta">
              Blood Group: {patient.bloodGroup} · Phone: {patient.phone}
            </p>
            <p className="pd-meta">Email: {patient.email}</p>
            <p className="pd-meta">Address: {patient.address}</p>
            <p className="pd-meta">
              Emergency Contact: {getEmergencyContact(patient)}
            </p>
          </div>
        </div>

        <div className="pd-action-btns">
          <button className="pd-action-btn" type="button" onClick={() => setActiveTab("Documents")}>
            <FileText size={15} /> View Reports
          </button>
          <button className="pd-action-btn" type="button" onClick={printHistory}>
            <Printer size={15} /> Print History
          </button>
        </div>
      </div>

      <div className="pd-tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`pd-tab${activeTab === tab ? " pd-tab--active" : ""}`}
            type="button"
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Overview" && (
        <div className="pd-tab-content">
          <div className="pd-overview-grid">
            {overview.map(({ label, value }) => (
              <div key={label} className="pd-overview-card">
                <p className="pd-card-label">{label}</p>
                <p className="pd-card-value">{value || emptyValue}</p>
              </div>
            ))}
          </div>

          <div className="pd-bottom-grid">
            <PreviousVisits
              visits={patient.previousVisits.slice(0, 3)}
              compact
              onViewAll={() => setActiveTab("Previous Visits")}
            />
            <PastMedicines
              medicines={medicines.slice(0, 5)}
              onViewAll={() => setActiveTab("Past Prescriptions")}
            />
          </div>
        </div>
      )}

      {activeTab === "Medical History" && (
        <div className="pd-overview-grid">
          {[
            ["Allergies", patient.allergies],
            ["Chronic Diseases", patient.chronicDiseases],
            ["Current Medications", patient.currentMedications],
            ["Surgeries", patient.surgeries],
            ["Last Updated", medicalHistory?.createdAt || emptyValue],
          ].map(([label, value]) => (
            <div key={label} className="pd-overview-card">
              <p className="pd-card-label">{label}</p>
              <p className="pd-card-value">{value || emptyValue}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === "Previous Visits" && (
        <div className="pd-full-list">
          <PreviousVisits visits={patient.previousVisits} />
        </div>
      )}

      {activeTab === "Past Prescriptions" && (
        <div className="pd-full-list">
          <PastPrescriptions prescriptions={patient.pastPrescriptions} />
        </div>
      )}

      {activeTab === "Documents" && (
        <DocumentsPanel documents={documents} />
      )}
    </div>
  );
}

function DocumentsPanel({ documents }) {
  if (!documents.length) {
    return (
      <div className="pd-tab-placeholder">
        <p>No documents uploaded for this patient.</p>
      </div>
    );
  }

  return (
    <div className="pd-doc-list">
      {documents.map((document, index) => {
        const url = getDocumentUrl(document);
        return (
          <div className="pd-doc-card" key={document.id || `${document.appointmentId}-${index}`}>
            <div>
              <strong>{getDocumentName(document, index)}</strong>
              <span>
                Appointment #{document.appointmentId || emptyValue}
                {document.visitDate ? ` | ${formatDate(document.visitDate)}` : ""}
              </span>
            </div>
            {url ? (
              <a href={url} target="_blank" rel="noreferrer">
                View Document
              </a>
            ) : (
              <span className="pd-doc-muted">No file link</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PreviousVisits({ visits, compact = false, onViewAll }) {
  return (
    <div className="pd-section-card">
      <h4 className="pd-section-title">Previous Visits</h4>
      {visits.length > 0 ? (
        visits.map((visit) => (
          <div
            key={visit.appointmentId || `${visit.date}-${visit.time}`}
            className={compact ? "pd-visit-row" : "pd-visit-card"}
          >
            <div className="pd-visit-info">
              <p className="pd-visit-date">{formatDate(visit.date)}</p>
              <p className="pd-visit-doctor">
                {visit.doctorName ? `Dr. ${visit.doctorName}` : "Doctor not assigned"}
              </p>
              <p className="pd-visit-complaints">
                {visit.symptoms || "No symptoms recorded"}
              </p>
              <p className="pd-visit-meds">
                BP: {visit.bloodPressure || emptyValue} · Sugar:{" "}
                {visit.sugarLevel || emptyValue} · Temp:{" "}
                {visit.temperature || emptyValue}
              </p>
            </div>
            <span className={`pd-visit-status ${visit.status === "Completed" ? "is-completed" : ""}`}>
              {visit.status || "Scheduled"}
            </span>
          </div>
        ))
      ) : (
        <div className="pd-empty-state">No previous visits found.</div>
      )}
      {compact && visits.length > 0 ? (
        <button className="pd-view-all-link" type="button" onClick={onViewAll}>
          View Full History
        </button>
      ) : null}
    </div>
  );
}

function PastMedicines({ medicines, onViewAll, showViewAll = true }) {
  return (
    <div className="pd-section-card">
      <h4 className="pd-section-title">Past Prescriptions</h4>
      {medicines.length > 0 ? (
        <table className="pd-rx-table">
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Dosage</th>
              <th>Duration</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {medicines.map((medicine, index) => (
              <tr key={`${medicine.prescriptionId}-${medicine.medicineName}-${index}`}>
                <td>{medicine.medicineName || emptyValue}</td>
                <td className="pd-rx-dosage">{medicine.dosage || emptyValue}</td>
                <td>{medicine.duration || emptyValue}</td>
                <td>{medicine.notes || emptyValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="pd-empty-state">No past prescriptions found.</div>
      )}
      {showViewAll && medicines.length > 0 ? (
        <button className="pd-view-all-link" type="button" onClick={onViewAll}>
          View All Prescriptions
        </button>
      ) : null}
    </div>
  );
}

function PastPrescriptions({ prescriptions }) {
  if (prescriptions.length === 0) {
    return (
      <div className="pd-section-card">
        <h4 className="pd-section-title">Past Prescriptions</h4>
        <div className="pd-empty-state">No past prescriptions found.</div>
      </div>
    );
  }

  return prescriptions.map((prescription, index) => (
    <div
      className="pd-prescription-card"
      key={prescription.id || prescription.appointmentId || index}
    >
      <div className="pd-prescription-head">
        <div>
          <h4>{prescription.diagnosis || "Diagnosis not recorded"}</h4>
          <p>{prescription.instructions || "No instructions recorded"}</p>
        </div>
        <span>{formatDate(getPrescriptionDisplayDate(prescription))}</span>
      </div>
      <PastMedicines medicines={prescription.medicines || []} showViewAll={false} />
    </div>
  ));
}

export default PatientDetails;
