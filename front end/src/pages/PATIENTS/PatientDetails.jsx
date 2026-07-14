import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Calendar,
  ClipboardList,
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
import { apiUrl } from "../../config/api";

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
      visit.lastVisit ||
      emptyValue,
    time:
      visit.time ||
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
  return (
    String(appointment.patientId || "") ===
    String(patient.id || "") ||
    String(appointment.patient?.id || "") ===
    String(patient.id || "") ||
    String(appointment.patientCode || "") ===
    String(patient.patientCode || "") ||
    String(appointment.patient?.code || "") ===
    String(patient.patientCode || "") ||
    String(appointment.phone || "") ===
    String(patient.phone || "") ||
    String(appointment.patient?.phone || "") ===
    String(patient.phone || "") ||
    String(appointment.patientName || "").toLowerCase() ===
    String(patient.name || "").toLowerCase()
  );
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

    if (!response.ok) return [];

    const data = await response.json();
    const appointmentIds = new Set(
      history.map((visit) => String(visit.appointmentId)).filter(Boolean)
    );
    const patientId = String(patient.id || "").trim();
    const patientName = String(patient.name || "").trim().toLowerCase();

    return normalizePrescriptions(data, history).filter((prescription) => {
      const prescriptionPatientId = String(
        prescription.patientId || prescription.patient?.id || ""
      ).trim();
      const prescriptionPatientName = String(
        prescription.patientName || prescription.patient?.name || ""
      )
        .trim()
        .toLowerCase();

      return (
        (patientId && prescriptionPatientId === patientId) ||
        appointmentIds.has(String(prescription.appointmentId)) ||
        (patientName && prescriptionPatientName === patientName)
      );
    });
  } catch (error) {
    console.warn("Unable to load prescriptions.", error);
    return [];
  }
};

const getDisplayDate = (value) => {
  if (
    !value ||
    value === "0001-01-01T00:00:00"
  )
    return emptyValue;

  if (!String(value).includes("T"))
    return value;

  return String(value).split("T")[0];
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
            headers: {
              "ngrok-skip-browser-warning":
                "true",
            },
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
            headers: {
              "ngrok-skip-browser-warning":
                "true",
            },
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
            headers: {
              "ngrok-skip-browser-warning":
                "true",
            },
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
              headers: {
                "ngrok-skip-browser-warning":
                  "true",
              },
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

      const prescriptions =
        await fetchPrescriptions(patient, history);

      console.log(
        "PATIENT DETAILS:",
        {
          patient,
          history,
          prescriptions,
        }
      );

      setPatientData({
        patient,
        history,
        prescriptions,
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

          </div>

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

          ) : (

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
                  No prescriptions found.
                </div>

              )}

            </div>

          )}
        </div>
      </div>
    </div>
  );
}

export default PatientDetails;
