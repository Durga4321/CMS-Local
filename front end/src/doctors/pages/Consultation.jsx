import React, { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Consultation.css";
import { apiUrl } from "../../config/api";
import {
  filterByLoggedInDoctor,
  getAuthToken,
  getLoggedInDoctor,
} from "../utils/doctorSession";
import {
  DEFAULT_DIAGNOSIS_OPTIONS,
  fetchDiagnosisOptions,
  filterDiagnosisOptionsBySpecialization,
  getDiagnosisTestsForSpecialization,
  mergeDiagnosisOption,
} from "../utils/diagnosisOptions";
import { formatDateMMDDYYYY } from "../../utils/dateFormat";
import { fetchConsultationVitals, mergeStoredAppointmentVitals } from "../../utils/appointmentVitals";
import { getClinicDisplayName } from "../../utils/clinicDisplay";

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
const escapePrintHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatPrintDateTime = (value = new Date()) => {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return String(value || "");
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const getInitials = (name) =>
  String(name || "P")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "P";

const getDisplayDate = (value) => formatDateMMDDYYYY(value, emptyValue);
const splitDiagnosisTests = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const joinDiagnosisTests = (items = []) =>
  items
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(", ");

const pickVital = (item = {}, fallback = {}, key) =>
  item[key] ||
  item.vitals?.[key] ||
  item.Vitals?.[key] ||
  item.appointment?.[key] ||
  item.Appointment?.[key] ||
  fallback[key] ||
  fallback.vitals?.[key] ||
  fallback.Vitals?.[key] ||
  "";

const normalizeAppointment = (item, fallback = {}) => {
  if (!item) return null;

  return {
    ...item,
    appointmentId: item.appointmentId || item.id || fallback.appointmentId,
    patientId: item.patientId || fallback.patientId,
    doctorId: item.doctorId || item.DoctorId || item.doctor?.id || item.Doctor?.Id || fallback.doctorId,
    branchId:
      item.branchId ||
      item.BranchId ||
      item.clinicBranchId ||
      item.ClinicBranchId ||
      item.branch?.id ||
      item.Branch?.Id ||
      fallback.branchId ||
      "",
    branchName:
      item.branchName ||
      item.BranchName ||
      item.branch?.name ||
      item.Branch?.Name ||
      fallback.branchName ||
      "",
    doctorSpecialization:
      item.doctorSpecialization ||
      item.DoctorSpecialization ||
      item.specialization ||
      item.Specialization ||
      item.doctor?.specialization ||
      item.Doctor?.Specialization ||
      fallback.doctorSpecialization ||
      fallback.specialization ||
      "",
    tokenNumber: item.tokenNumber || item.TokenNumber || item.token || fallback.tokenNumber,
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

function Consultation() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = React.useMemo(() => location.state || {}, [location.state]);
  const sessionDoctor = useMemo(() => getLoggedInDoctor(), []);

  const [step, setStep] = useState(1);
  const [appointment, setAppointment] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [diagnosisOptions, setDiagnosisOptions] = useState([]);
  const [form, setForm] = useState({
    complaintsChoice: "",
    diagnosis: "",
    diagnosisTests: "",
    bp: "",
    sugar: "",
    temp: "",
    weight: "",
    pulse: "",
    resp: "",
  });

  useEffect(() => {
    let isActive = true;

    fetchDiagnosisOptions(sessionDoctor.specialization)
      .then((options) => {
        if (isActive) setDiagnosisOptions(options);
      })
      .catch((err) => {
        console.warn("Unable to load diagnosis suggestions.", err);
      });

    return () => {
      isActive = false;
    };
  }, [sessionDoctor.specialization]);

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

        const currentDoctor = getLoggedInDoctor();
        const params = new URLSearchParams();
        if (currentDoctor.id) params.set("doctorId", currentDoctor.id);
        if (currentDoctor.branchId) params.set("branchId", currentDoctor.branchId);
        const appointmentsUrl = params.toString()
          ? `${APPOINTMENTS_API}?${params.toString()}`
          : APPOINTMENTS_API;

        let apiAppointments = [];
        const appointmentsResponse = await fetch(appointmentsUrl, {
          headers,
        });

        if (appointmentsResponse.ok) {
          const data = await appointmentsResponse.json();
          let rawAppointments = Array.isArray(data) ? data : [];
          rawAppointments = filterByLoggedInDoctor(
            rawAppointments,
            currentDoctor
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
        let detailedAppointment = selectedAppointment;

        try {
          const detailResponse = await fetch(
            `${APPOINTMENTS_API}/${selectedAppointment.appointmentId}`,
            { headers }
          );
          if (detailResponse.ok) {
            detailedAppointment = normalizeAppointment(
              {
                ...selectedAppointment,
                ...(await detailResponse.json()),
              },
              selectedAppointment
            );
          }
        } catch {
          // The list payload is enough when the detail endpoint is unavailable.
        }

        let savedConsultation = null;
        const consultationResponse = await fetch(
          `${CONSULTATION_API}/appointment/${detailedAppointment.appointmentId}`,
          {
            headers,
          }
        );

        if (consultationResponse.ok) {
          savedConsultation = await consultationResponse.json();
        }

        const backendVitals = await fetchConsultationVitals(detailedAppointment.appointmentId, headers);
        const hydratedAppointment = mergeStoredAppointmentVitals({
          ...detailedAppointment,
          ...(backendVitals || {}),
          patientId: detailedAppointment.patientId || savedConsultation?.patientId,
        });

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

        setForm({
          complaintsChoice: appointmentComplaint,
          diagnosis: savedConsultation?.diagnosis || "",
          diagnosisTests:
            savedConsultation?.diagnosisTests ||
            savedConsultation?.diagnosticTests ||
            savedConsultation?.tests ||
            "",
          bp: hydratedAppointment.bloodPressure || "",
          sugar: hydratedAppointment.sugarLevel || "",
          temp: hydratedAppointment.temperature || "",
          weight: hydratedAppointment.weight || "",
          pulse: hydratedAppointment.pulseRate || "",
          resp: hydratedAppointment.respiratoryRate || "",
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

  useEffect(() => {
    const refreshStoredVitals = () => {
      setAppointment((prev) => (prev ? mergeStoredAppointmentVitals(prev) : prev));
      setForm((prev) => {
        if (!appointment) return prev;
        const hydrated = mergeStoredAppointmentVitals(appointment);
        return {
          ...prev,
          bp: hydrated.bloodPressure || prev.bp,
          sugar: hydrated.sugarLevel || prev.sugar,
          temp: hydrated.temperature || prev.temp,
          weight: hydrated.weight || prev.weight,
          pulse: hydrated.pulseRate || prev.pulse,
          resp: hydrated.respiratoryRate || prev.resp,
        };
      });
    };

    window.addEventListener("focus", refreshStoredVitals);
    window.addEventListener("storage", refreshStoredVitals);

    return () => {
      window.removeEventListener("focus", refreshStoredVitals);
      window.removeEventListener("storage", refreshStoredVitals);
    };
  }, [appointment]);

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
    const doctorSpecialization =
      appointment?.doctorSpecialization ||
      appointment?.specialization ||
      sessionDoctor.specialization;
    const options = new Set(
      filterDiagnosisOptionsBySpecialization(
        DEFAULT_DIAGNOSIS_OPTIONS,
        doctorSpecialization
      )
    );
    filterDiagnosisOptionsBySpecialization(diagnosisOptions, doctorSpecialization).forEach((diagnosis) => {
      if (diagnosis) options.add(diagnosis);
    });
    if (form.diagnosis) options.add(form.diagnosis);
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [appointment, diagnosisOptions, form.diagnosis, sessionDoctor.specialization]);
  const diagnosisTestOptions = useMemo(() => {
    const doctorSpecialization =
      appointment?.doctorSpecialization ||
      appointment?.specialization ||
      sessionDoctor.specialization;
    const options = new Set(getDiagnosisTestsForSpecialization(doctorSpecialization));
    splitDiagnosisTests(form.diagnosisTests).forEach((test) => options.add(test));
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [appointment, form.diagnosisTests, sessionDoctor.specialization]);
  const selectedDiagnosisTests = useMemo(
    () => splitDiagnosisTests(form.diagnosisTests),
    [form.diagnosisTests]
  );
  const hospitalName = getClinicDisplayName("VIMS Clinic");
  const doctorName =
    appointment?.doctorName ||
    sessionDoctor.name ||
    localStorage.getItem("doctorName") ||
    "Doctor";
  const doctorSpecialization =
    appointment?.doctorSpecialization ||
    appointment?.specialization ||
    sessionDoctor.specialization ||
    "Consultation";
  const consultId =
    appointment?.appointmentId ||
    appointment?.tokenNumber ||
    `OP${String(Date.now()).slice(-9)}`;
  const vitals = [
    ["BP", form.bp],
    ["Pulse", form.pulse],
    ["Temp", form.temp],
    ["Weight", form.weight],
    ["Sugar", form.sugar],
    ["Resp", form.resp],
  ];

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const addDiagnosisTest = (value) => {
    const selected = String(value || "").trim();
    if (!selected) return;
    setForm((prev) => ({
      ...prev,
      diagnosisTests: joinDiagnosisTests([
        ...splitDiagnosisTests(prev.diagnosisTests).filter(
          (test) => test.toLowerCase() !== selected.toLowerCase()
        ),
        selected,
      ]),
    }));
  };

  const removeDiagnosisTest = (value) => {
    const selected = String(value || "").trim().toLowerCase();
    setForm((prev) => ({
      ...prev,
      diagnosisTests: joinDiagnosisTests(
        splitDiagnosisTests(prev.diagnosisTests).filter(
          (test) => test.toLowerCase() !== selected
        )
      ),
    }));
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

      const appointmentId = Number(appointment.appointmentId);
      const patientId = Number(appointment.patientId);
      const chiefComplaints = form.complaintsChoice.trim();
      const diagnosis = form.diagnosis.trim();
      const diagnosisTests = form.diagnosisTests.trim();
      const clinicalNotes = [
        chiefComplaints ? `Chief Complaints: ${chiefComplaints}` : "",
        form.bp.trim() ? `Blood Pressure: ${form.bp.trim()}` : "",
        form.sugar.trim() ? `Sugar Level: ${form.sugar.trim()}` : "",
        form.temp.trim() ? `Temperature: ${form.temp.trim()}` : "",
        form.weight.trim() ? `Weight: ${form.weight.trim()}` : "",
        form.pulse.trim() ? `Pulse Rate: ${form.pulse.trim()}` : "",
        form.resp.trim() ? `Respiratory Rate: ${form.resp.trim()}` : "",
        diagnosisTests ? `Diagnosis Tests: ${diagnosisTests}` : "",
      ].filter(Boolean).join("\n");

      const requestBody = {
        appointmentId,
        AppointmentId: appointmentId,
        patientId,
        PatientId: patientId,
        diagnosis,
        Diagnosis: diagnosis,
        clinicalNotes,
        ClinicalNotes: clinicalNotes,
      };

      let response = await fetch(CONSULTATION_API, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      let data = await response.json().catch(() => ({}));

      if (!response.ok) {
        response = await fetch(CONSULTATION_API, {
          method: "POST",
          headers,
          body: JSON.stringify({
            AppointmentId: appointmentId,
            PatientId: patientId,
            Diagnosis: diagnosis,
            ClinicalNotes: clinicalNotes || "-",
          }),
        });
        data = await response.json().catch(() => ({}));
      }

      if (!response.ok) {
        const validationMessage =
          data?.errors && typeof data.errors === "object"
            ? Object.values(data.errors).flat().filter(Boolean).join(" ")
            : "";
        throw new Error(data.message || validationMessage || data.title || "Unable to save consultation.");
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
          diagnosisTests:
            result.diagnosisTests ||
            result.diagnosticTests ||
            form.diagnosisTests,
        },
      },
    });
  };

  const buildConsultationHtml = () => {
    const printedAt = formatPrintDateTime(new Date());
    const consultDate = formatPrintDateTime(appointment?.date || new Date());
    const diagnosisBlock = [
      form.diagnosis.trim(),
      selectedDiagnosisTests.length
        ? `Tests: ${selectedDiagnosisTests.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    return `
      <!doctype html>
      <html>
        <head>
          <title>Consultation - ${escapePrintHtml(appointment?.patientName || "Patient")}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; margin: 0; background: #fff; font-size: 12px; }
            .sheet { max-width: 900px; margin: 0 auto; padding: 18px 20px; min-height: 1050px; }
            .print-row { display: flex; justify-content: space-between; font-size: 11px; color: #111827; margin-bottom: 18px; }
            .letterhead { text-align: center; padding-bottom: 12px; border-bottom: 1px solid #222; position: relative; }
            .brand-left { position: absolute; left: 0; top: 56px; font-size: 16px; font-weight: 900; letter-spacing: .4px; }
            h1 { margin: 0 0 10px; font-size: 13px; font-weight: 700; }
            .hospital { margin: 4px 0; font-size: 16px; font-weight: 900; }
            .muted { margin: 3px 0; color: #475569; }
            .title { margin-top: 28px; font-size: 19px; font-weight: 900; letter-spacing: .4px; }
            .details { display: grid; grid-template-columns: 1fr 1fr 1fr; border-bottom: 1px solid #222; }
            .details > div { min-height: 120px; padding: 10px 12px; border-right: 1px solid #222; }
            .details > div:last-child { border-right: 0; }
            .patient-name, .doctor-name { font-size: 14px; font-weight: 900; margin-bottom: 10px; }
            p { margin: 7px 0; }
            .line { display: grid; grid-template-columns: 116px 10px 1fr; gap: 4px; margin: 7px 0; }
            .line b { font-weight: 900; }
            .vitals { padding: 18px 8px 14px; border-bottom: 1px solid #222; }
            h3 { margin: 0 0 9px; font-size: 15px; font-weight: 900; letter-spacing: .2px; }
            .vital-list { display: flex; flex-wrap: wrap; gap: 14px; font-weight: 900; }
            .vital-list span { font-weight: 500; }
            .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; padding: 18px 8px 48px; border-bottom: 1px solid #999; }
            .two-col > div:nth-child(even) { border-left: 2px solid #333; padding-left: 22px; }
            .section-block { min-height: 82px; white-space: pre-wrap; font-size: 14px; line-height: 1.45; }
            .footer { display: flex; justify-content: space-between; gap: 28px; padding-top: 18px; }
            .signature { text-align: right; min-width: 220px; padding-top: 10px; }
            @media print { .sheet { padding: 0; } }
          </style>
        </head>
        <body>
          <main class="sheet">
            <div class="print-row">
              <span>${escapePrintHtml(printedAt)}</span>
              <span>Consultation - ${escapePrintHtml(appointment?.patientName || "Patient")}</span>
            </div>
            <div class="letterhead">
              <div class="brand-left">${escapePrintHtml(hospitalName)}</div>
              <h1>${escapePrintHtml(hospitalName)} EHR</h1>
              <p class="hospital">${escapePrintHtml(hospitalName)}</p>
              <p class="muted">Out Patient Department</p>
              <p class="muted">Phone/Fax: ${escapePrintHtml(localStorage.getItem("hospitalPhone") || localStorage.getItem("clinicPhone") || "-")}</p>
              <p class="muted">Email: ${escapePrintHtml(localStorage.getItem("hospitalEmail") || localStorage.getItem("clinicEmail") || "-")}</p>
              <div class="title">DEPARTMENT OF ${escapePrintHtml(String(doctorSpecialization).toUpperCase())}</div>
              <div class="title" style="margin-top:6px;">OUT PATIENT ASSESSMENT RECORD</div>
            </div>
            <section class="details">
              <div>
                <div class="patient-name">${escapePrintHtml(appointment?.patientName || emptyValue)}</div>
                <p>${escapePrintHtml(`${appointment?.age || emptyValue}Y / ${appointment?.gender || emptyValue}`)}</p>
                <p>${escapePrintHtml(appointment?.patientCode || emptyValue)}</p>
                <p>${escapePrintHtml(appointment?.phone || appointment?.patientPhone || emptyValue)}</p>
              </div>
              <div>
                <div class="line"><b>CONSULT DATE</b><span>:</span><span>${escapePrintHtml(consultDate)}</span></div>
                <div class="line"><b>CONSULT ID</b><span>:</span><span>${escapePrintHtml(consultId)}</span></div>
                <div class="line"><b>CONSULT TYPE</b><span>:</span><span>WALKIN</span></div>
                <div class="line"><b>VISIT TYPE</b><span>:</span><span>NORMAL</span></div>
                <div class="line"><b>TRANSACTION TYPE</b><span>:</span><span>${escapePrintHtml(appointment?.paymentMode || "UPI")}</span></div>
              </div>
              <div>
                <div class="doctor-name">DR. ${escapePrintHtml(doctorName)}</div>
                <p>${escapePrintHtml(appointment?.doctorId || "")}</p>
                <p>${escapePrintHtml(doctorSpecialization)}</p>
                <div class="line"><b>DEPT</b><span>:</span><span>${escapePrintHtml(doctorSpecialization)}</span></div>
              </div>
            </section>
            <section class="vitals">
              <h3>VITALS</h3>
              <div class="vital-list">
                ${vitals.map(([label, value]) => `<b>${escapePrintHtml(label)} :</b> <span>${escapePrintHtml(value || emptyValue)}</span>`).join("")}
              </div>
            </section>
            <section class="two-col">
              <div>
                <h3>CHIEF COMPLAINTS</h3>
                <div class="section-block">${escapePrintHtml(form.complaintsChoice || appointment?.chiefComplaints || emptyValue)}</div>
              </div>
              <div>
                <h3>DIAGNOSIS / TESTS</h3>
                <div class="section-block">${escapePrintHtml(diagnosisBlock || emptyValue)}</div>
              </div>
            </section>
            <section class="footer">
              <div>
                <p><b>Instructions:</b> Take medicines after food and complete the full course.</p>
                <p><b>Follow-Up Date:</b> Select date</p>
              </div>
              <div class="signature">
                <p><b>Dr. ${escapePrintHtml(doctorName)}</b></p>
                <p>${escapePrintHtml(doctorSpecialization)}</p>
              </div>
            </section>
          </main>
        </body>
      </html>
    `;
  };

  const printConsultation = () => {
    const printWindow = window.open("", "_blank", "width=820,height=960");
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(buildConsultationHtml());
    printWindow.document.write("<script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };</script>");
    printWindow.document.close();
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

          <div className="cn-field">
            <label className="cn-label">Diagnosis Tests</label>
            <select
              className="cn-input"
              value=""
              onChange={(event) => addDiagnosisTest(event.target.value)}
            >
              <option value="">Select diagnosis test</option>
              {diagnosisTestOptions.map((test) => (
                <option value={test} key={test}>
                  {test}
                </option>
              ))}
            </select>
            <div className="cn-test-chips">
              {selectedDiagnosisTests.length ? (
                selectedDiagnosisTests.map((test) => (
                  <button type="button" key={test} onClick={() => removeDiagnosisTest(test)}>
                    {test} <span>x</span>
                  </button>
                ))
              ) : (
                <small>Select one or more diagnosis tests</small>
              )}
            </div>
          </div>

          <div className="cn-form-actions">
            <button
              className="cn-btn-submit"
              type="button"
              onClick={saveConsultation}
              disabled={saving}
            >
              {saving ? "Saving..." : "Submit"}
            </button>
            <button
              className="cn-btn-print"
              type="button"
              onClick={printConsultation}
              disabled={saving}
            >
              <Printer size={16} /> Print
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
