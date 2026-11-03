import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Calendar,
  ClipboardList,
  FileText,
  Activity,
  Droplet,
  Mail,
  MapPin,
  Pill,
  Phone,
  UserRound,
} from "lucide-react";

import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import "./PatientDetails.css";
import { apiUrl, assetUrl } from "../../config/api";
import { getApiHeaders } from "../../utils/branchApi";

const PATIENT_API_URL =
  apiUrl("Patient");

const PATIENT_HISTORY_API_URL =
  apiUrl("Appointment/patient");

const APPOINTMENT_API_URL =
  apiUrl("Appointment");

const PRESCRIPTION_API_URL =
  apiUrl("Prescription");

const emptyValue = "-";

const parsePatientList = (data) => {
  if (Array.isArray(data))
    return data;

  if (Array.isArray(data?.data))
    return data.data;

  if (data?.patient)
    return [data.patient];

  if (data && typeof data === "object")
    return [data];

  return [];
};

const normalizePatient = (patient) => {
  if (!patient)
    return null;

  return {
    ...patient,
    id: patient.id,
    patientCode:
      patient.patientCode ||
      patient.code ||
      (patient.id
        ? `P${String(patient.id).padStart(3, "0")}`
        : emptyValue),
    name:
      patient.name ||
      patient.patientName ||
      emptyValue,
    phone:
      patient.phone ||
      emptyValue,
    age:
      patient.age ??
      emptyValue,
    gender:
      patient.gender ||
      emptyValue,
    email:
      patient.email ||
      emptyValue,
    address:
      patient.address ||
      emptyValue,
    bloodGroup:
      patient.bloodGroup ||
      patient.bloodgroup ||
      emptyValue,
    emergencyContactName:
      patient.emergencyContactName ||
      emptyValue,
    emergencyContactPhone:
      patient.emergencyContactPhone ||
      emptyValue,
    lastVisit:
      patient.lastVisit ||
      emptyValue,
  };
};

const normalizeHistory = (data) => {
  const history =
    Array.isArray(data)
      ? data
      : Array.isArray(data?.history)
        ? data.history
        : Array.isArray(data?.data)
          ? data.data
          : [];

  return history.map((visit) => ({
    ...visit,
    appointmentId:
      visit.appointmentId ||
      visit.id,
    date:
      visit.date ||
      visit.Date ||
      visit.appointmentDate ||
      visit.AppointmentDate ||
      visit.scheduledDate ||
      visit.ScheduledDate ||
      visit.slotDate ||
      visit.SlotDate ||
      visit.lastVisit ||
      emptyValue,
    time:
      visit.time ||
      visit.Time ||
      visit.startTime ||
      visit.StartTime ||
      visit.slotTime ||
      visit.SlotTime ||
      visit.timeSlot ||
      visit.TimeSlot ||
      emptyValue,
    status:
      visit.status ||
      "Scheduled",
    doctor: {
      ...visit.doctor,
      name:
        visit.doctor?.name ||
        visit.doctorName ||
        emptyValue,
    },
  }));
};

const parseList = (data) => {
  if (Array.isArray(data))
    return data;

  if (Array.isArray(data?.data))
    return data.data;

  return [];
};

const isPatientAppointment = (
  appointment,
  patient
) => {
  const recordId = appointment.patientId ?? appointment.patient?.id;
  if (recordId != null) return String(recordId) === String(patient.id);
  const code = appointment.patientCode ?? appointment.patient?.code;
  return Boolean(code && patient.patientCode && String(code) === String(patient.patientCode));
};

const normalizePrescriptions = (data, history = []) => {
  const prescriptions =
    Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
        ? data.data
        : data && typeof data === "object"
          ? [data]
          : [];

  const visitsByAppointmentId = new Map(
    history.map((visit) => [String(visit.appointmentId), visit])
  );

  return prescriptions.map((prescription) => {
    const appointmentId = prescription.appointmentId || emptyValue;
    const visit = visitsByAppointmentId.get(String(appointmentId));
    const medicines = Array.isArray(prescription.medicines)
      ? prescription.medicines
      : [];

    return {
      ...prescription,
      appointmentId,
      doctorName:
        prescription.doctorName || visit?.doctor?.name || emptyValue,
      visitDate: visit?.date || emptyValue,
      medicines,
      medicineNames: medicines
        .map((medicine) => medicine.medicineName)
        .filter(Boolean),
    };
  });
};

const fetchPrescriptions = async (patient, history) => {
  try {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("adminToken");
    const response = await fetch(PRESCRIPTION_API_URL, {
      headers: {
        "ngrok-skip-browser-warning": "true",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) throw new Error("Unable to load prescriptions.");

    const data = await response.json();
    const appointmentIds = new Set(
      history.map((visit) => String(visit.appointmentId)).filter(Boolean)
    );
    const patientId = String(patient.id || "").trim();


    return normalizePrescriptions(data, history).filter((prescription) => {
      const prescriptionPatientId = String(
        prescription.patientId || prescription.patient?.id || ""
      ).trim();

      return (
        (patientId && prescriptionPatientId === patientId) ||
        appointmentIds.has(String(prescription.appointmentId))
      );
    });
  } catch (error) {
    console.warn("Unable to load prescriptions.", error);
    throw error;
  }
};

const getDisplayDate = (value) => {
  if (
    !value ||
    value === "0001-01-01T00:00:00"
  )
    return emptyValue;

  const raw = String(value).trim();
  const isoDateTimeMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (isoDateTimeMatch) {
    const [, year, month, day, hour, minute, second = "00"] = isoDateTimeMatch;
    if (hour === "00" && minute === "00" && second === "00")
      return `${year}-${month}-${day}`;

    const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw);
    const date = new Date(hasTimezone ? raw : `${raw}Z`);
    if (!Number.isNaN(date.getTime())) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }
  }

  const isoDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateMatch)
    return `${isoDateMatch[1]}-${isoDateMatch[2]}-${isoDateMatch[3]}`;

  return raw;
};

function PatientDetails() {

  const { id } = useParams();

  const navigate = useNavigate();

  const location = useLocation();

  const [patientData, setPatientData] =
    useState(() => {
      const patient =
        normalizePatient(
          location.state?.patient
        );

      return patient
        ? {
          patient,
          history: [],
          prescriptions: [],
        }
        : null;
    });

  const [activeTab, setActiveTab] =
    useState("history");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  // ================= LOAD PATIENT =================

  const fetchPatient = useCallback(async () => {

    try {

      setLoading(true);

      setError("");

      let patient =
        normalizePatient(
          location.state?.patient
        );

      if (!patient) {
        const response = await fetch(
          `${PATIENT_API_URL}/${id}`,
          {
            headers: getApiHeaders(),
          }
        );

        if (response.ok) {
          const data =
            await response.json();

          patient =
            normalizePatient(
              parsePatientList(data)[0]
            );
        }
      }

      if (!patient) {
        const response = await fetch(
          PATIENT_API_URL,
          {
            headers: getApiHeaders(),
          }
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load patient details."
          );
        }

        const data =
          await response.json();

        patient =
          parsePatientList(data)
            .map(normalizePatient)
            .find(
              (item) =>
                String(item?.id) === String(id) ||
                String(item?.patientCode) === String(id)
            );
      }

      if (!patient) {
        throw new Error(
          "Patient not found."
        );
      }

      let history = [];

      try {
        const historyResponse = await fetch(
          `${PATIENT_HISTORY_API_URL}/${id}/history`,
          {
            headers: getApiHeaders(),
          }
        );

        if (historyResponse.ok) {
          const historyData =
            await historyResponse.json();

          history =
            normalizeHistory(historyData);
        }
      } catch (historyError) {
        console.warn(
          "Unable to load patient history.",
          historyError
        );
      }

      if (history.length === 0) {
        try {
          const appointmentsResponse = await fetch(
            APPOINTMENT_API_URL,
            {
              headers: getApiHeaders(),
            }
          );

          if (appointmentsResponse.ok) {
            const appointmentsData =
              await appointmentsResponse.json();

            history =
              normalizeHistory(
                parseList(appointmentsData).filter(
                  (appointment) =>
                    isPatientAppointment(
                      appointment,
                      patient
                    )
                )
              );
          }
        } catch (appointmentsError) {
          console.warn(
            "Unable to load appointments for patient.",
            appointmentsError
          );
        }
      }

      const readRecords = async (path) => {
        const response = await fetch(apiUrl(path), { headers: getApiHeaders() });
        if (!response.ok) throw new Error("Unable to load records.");
        const data = await response.json();
        return Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : data && typeof data === "object" ? [data] : [];
      };
      const results = await Promise.allSettled([
        fetchPrescriptions(patient, history),
        readRecords(`MedicalHistory/all/${encodeURIComponent(patient.id)}`),
        readRecords("Lab/orders").then(rows => rows.filter(row => isPatientAppointment(row, patient))),
        Promise.all(history.filter(visit => visit.appointmentId).map(async visit => {
          const rows = await readRecords(`Overview/${encodeURIComponent(visit.appointmentId)}/documents`);
          return rows.map(row => ({ ...row, visitDate: visit.date }));
        })).then(rows => rows.flat()),
      ]);
      setPatientData({
        patient, history,
        prescriptions: results[0].status === "fulfilled" ? results[0].value : [],
        medicalHistory: results[1].status === "fulfilled" ? results[1].value : [],
        reports: results.slice(2).flatMap(result => result.status === "fulfilled" ? result.value : []),
        panelErrors: { prescriptions: results[0].status === "rejected", medical: results[1].status === "rejected", reports: results.slice(2).some(result => result.status === "rejected") },
      });

    } catch (error) {

      console.error(error);

      setError(
        error.message ||
        "Something went wrong."
      );

    } finally {

      setLoading(false);
    }
  }, [id, location]);

  useEffect(() => {
    fetchPatient();
  }, [fetchPatient]);

  // ================= INITIALS =================

  const getInitials = (name) => {

    return (
      name
        ?.split(" ")
        ?.filter(Boolean)
        ?.map((x) => x[0])
        ?.join("")
        ?.slice(0, 2)
        ?.toUpperCase() || "P"
    );
  };

  useEffect(() => {
    if (!loading && (error || !patientData)) {
      navigate("/patients", { replace: true });
    }
  }, [error, loading, navigate, patientData]);

  // ================= LOADING =================

  if (loading) {
    return (
      <div className="patient-details-page">
        <h2>Loading...</h2>
      </div>
    );
  }

  // ================= ERROR =================

  if (error) {
    return (
      <div className="patient-details-page">
        <h2>{error}</h2>
      </div>
    );
  }

  // ================= NO DATA =================

  if (!patientData) {
    return (
      <div className="patient-details-page">
        <h2>No patient data found.</h2>
      </div>
    );
  }

  const patient =
    patientData.patient;

  const history =
    patientData.history || [];

  const prescriptions =
    patientData.prescriptions || [];

  return (
    <div className="patient-details-page">

      {/* TITLE */}

      <h2 className="patient-details-title">
        {patient.name}
      </h2>

      <p className="patient-details-subtitle">

        Patient ID:
        {" "}
        {patient.patientCode}

      </p>

      {/* GRID */}

      <div className="patient-details-grid">

        {/* LEFT CARD */}

        <div className="patient-card patient-profile-card">

          {/* AVATAR */}

          <div className="patient-avatar-big">

            {getInitials(
              patient.name
            )}


          </div>

          {/* NAME */}

          <h3>{patient.name}</h3>

          <p>
            {patient.gender}
            {" · "}
            {patient.age} years
          </p>

          {/* INFO */}

          <div className="patient-info-list">

            {/* PHONE */}

            <div className="patient-info-row">

              <Phone size={22} />

              <span>
                {patient.phone || "-"}
              </span>

            </div>

            {/* BLOOD GROUP */}

            <div className="patient-info-row">

              <Droplet size={22} />

              <span>
                Blood group: {patient.bloodGroup || "-"}
              </span>

            </div>

            {/* EMAIL */}

            <div className="patient-info-row">

              <Mail size={22} />

              <span>
                {patient.email || "-"}
              </span>

            </div>

            {/* ADDRESS */}

            <div className="patient-info-row">

              <MapPin size={22} />

              <span>
                {patient.address || "-"}
              </span>

            </div>

            {/* EMERGENCY CONTACT */}

            <div className="patient-info-row patient-info-row--emergency">

              <UserRound size={22} />

              <div className="patient-emergency-contact">
                <span className="patient-info-label">Emergency contact</span>
                <strong>{patient.emergencyContactName || "-"}</strong>
                {patient.emergencyContactPhone &&
                patient.emergencyContactPhone !== "-" ? (
                  <a href={`tel:${patient.emergencyContactPhone}`}>
                    {patient.emergencyContactPhone}
                  </a>
                ) : null}
              </div>

            </div>

            {/* LAST VISIT */}

            <div className="patient-info-row">

              <Calendar size={22} />

              <span>

                Last visit:

                {" "}

                {history.length
                  ? getDisplayDate(history[0].date)
                  : getDisplayDate(patient.lastVisit)}

              </span>

            </div>

          </div>
        </div>

        {/* RIGHT CARD */}

        <div className="patient-card">

          {/* TABS */}

          <div className="patient-tabs">

            <button
              type="button"
              className={`patient-tab ${activeTab ===
                  "history"
                  ? "patient-tab-active"
                  : ""
                }`}
              onClick={() =>
                setActiveTab("history")
              }
            >

              <ClipboardList size={20} />

              Visit History

            </button>

            <button
              type="button"
              className={`patient-tab ${activeTab ===
                  "prescriptions"
                  ? "patient-tab-active"
                  : ""
                }`}
              onClick={() =>
                setActiveTab("prescriptions")
              }
            >

              <Pill size={20} />

              Prescriptions

            </button>

            {[['reports', 'Reports', FileText], ['medical', 'Medical History', Activity]].map(([key, label, Icon]) => (
              <button type="button" key={key} className={`patient-tab ${activeTab === key ? 'patient-tab-active' : ''}`} onClick={() => setActiveTab(key)}><Icon size={20} />{label}</button>
            ))}

          </div>

          {patientData.panelErrors?.[activeTab] ? <div role="alert" className="patient-empty-state">Some {activeTab === 'medical' ? 'medical history' : activeTab} could not be loaded. <button type="button" onClick={fetchPatient}>Retry</button></div> : null}
          {activeTab === "medical" ? <div className="patient-prescription-list">
            {(patientData.medicalHistory || []).map((record, index) => <article className="patient-prescription-card" key={record.id || index}>
              <b>Medical history ? {getDisplayDate(record.createdAt || record.recordedAt || record.date)}</b>
              <dl className="patient-clinical-fields">{[['Allergies', 'allergies'], ['Chronic diseases', 'chronicDiseases'], ['Current medications', 'currentMedications'], ['Surgeries', 'surgeries'], ['Family history', 'familyHistory'], ['Notes', 'notes']].map(([label, key]) => <div key={key}><dt>{label}</dt><dd>{record[key] || 'Not recorded'}</dd></div>)}</dl>
            </article>)}
            {!patientData.medicalHistory?.length && !patientData.panelErrors?.medical ? <div className="patient-empty-state">No medical history recorded.</div> : null}
          </div> : null}
          {activeTab === "reports" ? <div className="patient-prescription-list">
            {(patientData.reports || []).map((report, index) => <article className="patient-prescription-card" key={report.id || index}>
              <b>{report.testName || report.documentName || report.fileName || report.title || 'Patient report'}</b>
              <p className="patient-prescription-note">{getDisplayDate(report.completedAt || report.createdAt || report.visitDate)} ? {report.status || 'Uploaded'}</p>
              {report.result || report.resultValue ? <p>Result: {report.result || report.resultValue} {report.unit || ''}</p> : null}
              {report.notes ? <p>{report.notes}</p> : null}
              {report.reportUrl || report.documentUrl || report.fileUrl || report.filePath ? <ReportDownload report={report} /> : null}
            </article>)}
            {!patientData.reports?.length && !patientData.panelErrors?.reports ? <div className="patient-empty-state">No reports found.</div> : null}
          </div> : null}
          {/* VISITS */}

          {activeTab === "history" ? (

            <div className="patient-visit-list">

              {history.length > 0 ? (

                history.map((visit) => (

                  <div
                    className="patient-visit-card"
                    key={visit.appointmentId}
                  >

                    {/* LEFT */}

                    <div>

                      <b>
                        Dr. {visit.doctor?.name || "-"}
                      </b>

                      <p>
                        {getDisplayDate(visit.date)}
                        {" · "}
                        {visit.time || "-"}
                      </p>

                    </div>

                    {/* STATUS */}

                    <span
                      className={`patient-visit-status ${visit.status ===
                          "Completed"
                          ? "is-completed"
                          : "is-scheduled"
                        }`}
                    >

                      <span className="patient-status-dot"></span>

                      {visit.status}

                    </span>

                  </div>
                ))

              ) : (

                <div className="patient-empty-state">
                  No visit history found.
                </div>

              )}

            </div>

          ) : activeTab === "prescriptions" ? (

            <div className="patient-prescription-list">

              {prescriptions.length > 0 ? (

                prescriptions.map(
                  (prescription) => {
                    const medicineNames =
                      prescription.medicineNames
                        ?.length
                        ? prescription.medicineNames.join(
                          ", "
                        )
                        : "No medicines listed";

                    return (
                      <div
                        className="patient-prescription-card"
                        key={
                          prescription.id ||
                          prescription.appointmentId
                        }
                      >

                        <div className="patient-prescription-top">

                          <b>{medicineNames}</b>

                          <span className="patient-prescription-date">
                            {getDisplayDate(
                              prescription.followUpDate ||
                              prescription.visitDate
                            )}
                          </span>

                        </div>

                        <p className="patient-prescription-note">
                          Prescribed by Dr. {prescription.doctorName}
                          {prescription.diagnosis
                            ? ` · ${prescription.diagnosis}`
                            : ""}
                        </p>

                        {prescription.instructions ? (
                          <p className="patient-prescription-instructions">
                            {prescription.instructions}
                          </p>
                        ) : null}

                        {prescription.medicines?.length ? (
                          <div className="patient-medicine-list">
                            {prescription.medicines.map((medicine, index) => (
                              <div
                                className="patient-medicine-row"
                                key={medicine.id || `${prescription.id}-${index}`}
                              >
                                <strong>{medicine.medicineName || "Medicine"}</strong>
                                <div className="patient-medicine-details">
                                  <span>Dosage: {medicine.dosage || "-"}</span>
                                  <span>Frequency: {medicine.frequency || "-"}</span>
                                  <span>Duration: {medicine.duration || "-"}</span>
                                  <span>Notes: {medicine.notes || "-"}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}

                      </div>
                    );
                  }
                )

              ) : (

                <div className="patient-empty-state">
                  {patientData.panelErrors?.prescriptions ? "Prescriptions unavailable." : "No prescriptions found."}
                </div>

              )}

            </div>

          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReportDownload({ report }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const openReport = async () => {
    setBusy(true); setError("");
    try {
      const url = assetUrl(report.reportUrl || report.documentUrl || report.fileUrl || report.filePath);
      if (!/^https?:/i.test(url)) throw new Error("Invalid report URL");
      const trusted = new URL(url).origin === new URL(apiUrl("")).origin;
      const response = await fetch(url, { headers: trusted ? getApiHeaders() : {} });
      if (!response.ok) throw new Error("Report unavailable");
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = objectUrl; link.download = report.fileName || report.documentName || "patient-report"; link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch { setError("Unable to download report. Please try again."); }
    finally { setBusy(false); }
  };
  return <><button type="button" disabled={busy} onClick={openReport}>{busy ? 'Downloading?' : 'Download report'}</button>{error ? <p role="alert">{error}</p> : null}</>;
}

export default PatientDetails;
