import React, { useEffect, useMemo, useState } from "react";
import { Download, Printer, Search, Trash2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Prescription.css";
import { apiUrl } from "../../config/api";
import {
  filterByLoggedInDoctor,
  getAuthToken,
  getLoggedInDoctor,
} from "../utils/doctorSession";
import {
  DIAGNOSIS_TEST_OPTIONS,
  mergeDiagnosisOption,
} from "../utils/diagnosisOptions";
import { getClinicDisplayName } from "../../utils/clinicDisplay";
import { useToast } from "../../components/ToastProvider";
import { validateDate, validateRequired } from "../../utils/validation";
import { formatDateMMDDYYYY } from "../../utils/dateFormat";
import { mergeStoredAppointmentVitals } from "../../utils/appointmentVitals";

const STEPS = [
  "Waiting",
  "Consultation Started",
  "Prescription Added",
  "Completed",
];

const APPOINTMENTS_API = apiUrl("Appointment");
const CONSULTATION_API = apiUrl("Consultation");
const PRESCRIPTION_API = apiUrl("Prescription");

const emptyValue = "-";
const DEFAULT_MEDICINE_OPTIONS = [
  "Paracetamol",
  "Ibuprofen",
  "Amoxicillin",
  "Azithromycin",
  "Cetirizine",
  "Pantoprazole",
  "Metformin",
  "Amlodipine",
];
const DOSAGE_OPTIONS = ["1 Tablet", "1/2 Tablet", "2 Tablets", "5 ml", "10 ml", "1 Capsule", "1 Sachet"];
const FREQUENCY_OPTIONS = [
  "1-0-1",
  "1-1-1",
  "0-0-1",
  "0-1-1",
  "1-0-0",
  "0-1-0",
  "1-1-0",
  "0-0-0-1",
  "1-1-1-1",
  "Every 4 hours",
  "Every 6 hours",
  "Every 8 hours",
  "SOS",
];
const NOTE_OPTIONS = [
  "After food",
  "Before food",
  "With water",
  "At bedtime",
  "Morning only",
  "Avoid driving",
  "Complete full course",
];
const INSTRUCTION_OPTIONS = [
  "Take medicines after food and complete the full course.",
  "Drink plenty of water and take adequate rest.",
  "Avoid oily and spicy food.",
  "Return immediately if symptoms worsen.",
  "Continue current diet and medication plan.",
];

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

const createMedicine = () => ({
  id: Date.now() + Math.random(),
  medicineName: "",
  dosage: "",
  quantity: "",
  frequency: "",
  duration: "",
  notes: "",
});

const toDateInput = (value) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
};

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
    tokenNumber: item.tokenNumber || item.TokenNumber || item.token || fallback.tokenNumber,
    patientName:
      item.patientName ||
      item.name ||
      fallback.patientName ||
      fallback.name ||
      emptyValue,
    patientCode: item.patientCode || fallback.patientCode || emptyValue,
    age: item.age ?? fallback.age ?? emptyValue,
    gender: item.gender || fallback.gender || emptyValue,
    date: item.date || fallback.date || "",
    doctorName:
      item.doctorName ||
      fallback.doctorName ||
      localStorage.getItem("doctorName") ||
      "Doctor",
    doctorSpecialization:
      item.doctorSpecialization ||
      fallback.doctorSpecialization ||
      "",
    bloodPressure: pickVital(item, fallback, "bloodPressure"),
    sugarLevel: pickVital(item, fallback, "sugarLevel"),
    temperature: pickVital(item, fallback, "temperature"),
    weight: pickVital(item, fallback, "weight"),
    pulseRate: pickVital(item, fallback, "pulseRate"),
    respiratoryRate: pickVital(item, fallback, "respiratoryRate"),
  };
};

const normalizeMedicines = (medicines) =>
  (Array.isArray(medicines) ? medicines : []).map((medicine) => ({
    id: medicine.id || Date.now() + Math.random(),
    medicineName: medicine.medicineName || medicine.medicine || "",
    brandName: medicine.brandName || medicine.brand || medicine.brand_name || "",
    dosage: medicine.dosage || "",
    quantity: medicine.quantity || medicine.qty || "",
    frequency: medicine.frequency || "",
    duration: medicine.duration || "",
    notes: medicine.notes || "",
  }));

const getMedicineLabel = (medicine = {}) => {
  const name = medicine.medicineName || medicine.medicine || medicine.name || "";
  const brand = medicine.brandName || medicine.brand || medicine.brand_name || "";
  return [name, brand ? `(${brand})` : ""].filter(Boolean).join(" ").trim();
};

const extractMedicineOptions = (prescriptions = []) => {
  const options = new Map();

  prescriptions.forEach((prescription) => {
    normalizeMedicines(prescription?.medicines).forEach((medicine) => {
      const label = getMedicineLabel(medicine);
      if (label) options.set(label.toLowerCase(), { ...medicine, label });
    });
  });

  return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label));
};

const getValidationMessages = (data) => {
  if (!data?.errors || typeof data.errors !== "object") return [];

  return Object.entries(data.errors)
    .flatMap(([key, messages]) => {
      const list = Array.isArray(messages) ? messages : [messages];
      return list.filter(Boolean).map((message) => `${key}: ${message}`);
    })
    .filter(Boolean);
};

const parseJsonText = (text) => {
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
};

const parseList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

const getResponseMessage = (data, text, fallback) =>
  data?.message ||
  getValidationMessages(data).join(" ") ||
  data?.title ||
  text ||
  fallback;

const isAlreadyExistsMessage = (value) =>
  /already\s+exi/i.test(String(value || ""));

const toPositiveId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const updateAppointmentStatus = async (appointmentId, newStatus, headers = {}) => {
  if (!appointmentId) return { status: newStatus };

  const finalHeaders = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...headers,
  };

  const payload = JSON.stringify({ status: newStatus });

  try {
    const response = await fetch(`${APPOINTMENTS_API}/${appointmentId}`, {
      method: "PATCH",
      headers: finalHeaders,
      body: payload,
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      window.dispatchEvent(new CustomEvent("appointmentStatusUpdated", {
        detail: { appointmentId, status: newStatus },
      }));
      return data || { status: newStatus };
    }

    const responseText = await response.text().catch(() => "");
    const data = parseJsonText(responseText);
    const message = getResponseMessage(data, responseText, "Failed to update status");
    console.warn(`Status update failed: ${message}`);
  } catch (error) {
    console.warn(`Status update error: ${error.message}`);
  }

  return { status: newStatus };
};

function Prescription() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const routeState = React.useMemo(() => location.state || {}, [location.state]);

  const [appointment, setAppointment] = useState(null);
  const [consultation, setConsultation] = useState(routeState.consultation || null);
  const [diagnosis, setDiagnosis] = useState("");
  const [instructions, setInstructions] = useState(
    "Take medicines after food and complete the full course."
  );
  const [followUp, setFollowUp] = useState("");
  const [medicines, setMedicines] = useState([createMedicine()]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [diagnosisOptions, setDiagnosisOptions] = useState([]);
  const [medicineSearch, setMedicineSearch] = useState("");
  const [medicineOptions, setMedicineOptions] = useState([]);
  const [typedMedicineNames, setTypedMedicineNames] = useState([]);
  const [isMedicineSearchFocused, setIsMedicineSearchFocused] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("prescriptionTypedMedicineNames");
    if (!saved) return;

    try {
      const names = JSON.parse(saved);
      if (Array.isArray(names)) {
        setTypedMedicineNames(
          names
            .filter((name) => typeof name === "string" && name.trim())
            .map((name) => name.trim())
        );
      }
    } catch {
      // ignore invalid persisted data
    }
  }, []);

  useEffect(() => {
    const loadPrescription = async () => {
      try {
        setLoading(true);
        setError("");

        const routeAppointment = normalizeAppointment(
          routeState.appointment || routeState.patient,
          {
            appointmentId: routeState.appointmentId,
            patientId: routeState.patientId,
            patientName: routeState.patient?.name,
            patientCode: routeState.patient?.pid || routeState.patient?.patientCode,
            age: routeState.patient?.age,
            gender: routeState.patient?.gender,
          }
        );

        let selectedAppointment = routeAppointment;
        const token = getAuthToken();
        const headers = {
          "ngrok-skip-browser-warning": "true",
          "Content-Type": "application/json",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const appointmentsResponse = await fetch(APPOINTMENTS_API, {
          headers,
        });

        if (appointmentsResponse.ok) {
          const appointmentsData = await appointmentsResponse.json();
          let rawAppointments = Array.isArray(appointmentsData) ? appointmentsData : [];
          rawAppointments = filterByLoggedInDoctor(
            rawAppointments,
            getLoggedInDoctor()
          );

          const appointments = rawAppointments.map((item) =>
            normalizeAppointment(item, {
              patientId: routeState.patientId || routeAppointment?.patientId,
            })
          );

          selectedAppointment =
            appointments.find(
              (item) =>
                String(item.appointmentId) ===
                String(routeState.appointmentId || routeAppointment?.appointmentId)
            ) ||
            appointments.find(
              (item) =>
                routeAppointment?.patientCode &&
                String(item.patientCode) === String(routeAppointment.patientCode)
            ) ||
            selectedAppointment ||
            appointments.find((item) =>
              ["inprogress", "in progress", "waiting"].includes(
                String(item.status || "").trim().toLowerCase()
              )
            ) ||
            appointments[0];
        }

        if (!selectedAppointment?.appointmentId) {
          throw new Error("No appointment found for prescription.");
        }

        let normalizedAppointment = normalizeAppointment(selectedAppointment, {
          patientId: routeState.patientId || routeAppointment?.patientId,
        });

        try {
          const detailResponse = await fetch(
            `${APPOINTMENTS_API}/${normalizedAppointment.appointmentId}`,
            { headers }
          );
          if (detailResponse.ok) {
            normalizedAppointment = normalizeAppointment(
              {
                ...normalizedAppointment,
                ...(await detailResponse.json()),
              },
              normalizedAppointment
            );
          }
        } catch {
          // The list payload is enough when the detail endpoint is unavailable.
        }

        normalizedAppointment = mergeStoredAppointmentVitals(normalizedAppointment);

        let savedConsultation = routeState.consultation || null;
        const consultationResponse = await fetch(
          `${CONSULTATION_API}/appointment/${normalizedAppointment.appointmentId}`,
          {
            headers,
          }
        );

        if (consultationResponse.ok) {
          savedConsultation = await consultationResponse.json();
        }

        let savedPrescription = null;
        const prescriptionResponse = await fetch(
          `${PRESCRIPTION_API}/appointment/${normalizedAppointment.appointmentId}`,
          {
            headers,
          }
        );

        if (prescriptionResponse.ok) {
          savedPrescription = await prescriptionResponse.json();
        }

        const allPrescriptionsResponse = await fetch(PRESCRIPTION_API, {
          headers,
        }).catch(() => null);

        if (allPrescriptionsResponse?.ok) {
          setMedicineOptions(
            extractMedicineOptions(parseList(await allPrescriptionsResponse.json()))
          );
        }

        setAppointment(
          normalizeAppointment(normalizedAppointment, {
            patientId: savedConsultation?.patientId || routeState.patientId,
          })
        );
        setConsultation(savedConsultation);
        const resolvedDiagnosis =
          savedPrescription?.diagnosis ||
          "";

        setDiagnosis(resolvedDiagnosis);
        setDiagnosisOptions((prev) =>
          mergeDiagnosisOption(prev, resolvedDiagnosis)
        );
        setInstructions(
          savedPrescription?.instructions ||
          "Take medicines after food and complete the full course."
        );
        setFollowUp(toDateInput(savedPrescription?.followUpDate));

        const existingMedicines = normalizeMedicines(savedPrescription?.medicines);
        setMedicines(existingMedicines.length ? existingMedicines : [createMedicine()]);
        setMedicineOptions((prev) =>
          extractMedicineOptions([
            { medicines: existingMedicines },
            ...prev.map((item) => ({ medicines: [item] })),
          ])
        );
      } catch (err) {
        console.error(err);
        setError(err.message || "Unable to load prescription.");
      } finally {
        setLoading(false);
      }
    };

    loadPrescription();
  }, [routeState]);

  useEffect(() => {
    const refreshStoredVitals = () => {
      setAppointment((prev) => (prev ? mergeStoredAppointmentVitals(prev) : prev));
    };

    window.addEventListener("focus", refreshStoredVitals);
    window.addEventListener("storage", refreshStoredVitals);

    return () => {
      window.removeEventListener("focus", refreshStoredVitals);
      window.removeEventListener("storage", refreshStoredVitals);
    };
  }, []);

  const hospitalName = getClinicDisplayName({}, "Clinic Name");
  const doctorName = localStorage.getItem("doctorName") || appointment?.doctorName || "Doctor";
  const chiefComplaint =
    appointment?.chiefComplaints ||
    appointment?.symptoms ||
    consultation?.chiefComplaints ||
    emptyValue;
  const clinicalNote = consultation?.clinicalNotes || emptyValue;
  const previewDiagnosis = diagnosis || emptyValue;
  const followUpLabel = followUp ? formatDateMMDDYYYY(followUp, emptyValue) : "Select date";
  const vitals = [
    ["BP", appointment?.bloodPressure],
    ["Pulse", appointment?.pulseRate],
    ["Temp", appointment?.temperature],
    ["Weight", appointment?.weight],
    ["Sugar", appointment?.sugarLevel],
    ["Resp", appointment?.respiratoryRate],
  ];

  const validMedicines = useMemo(
    () =>
      medicines
        .map((medicine) => ({
          medicineName: medicine.medicineName.trim(),
          dosage: medicine.dosage.trim(),
          quantity: String(medicine.quantity || "").trim(),
          frequency: medicine.frequency.trim(),
          duration: medicine.duration.trim(),
          notes: medicine.notes.trim(),
        }))
        .filter((medicine) => medicine.medicineName),
    [medicines]
  );

  const combinedMedicineOptions = useMemo(() => {
    const unique = new Map();

    typedMedicineNames
      .filter(Boolean)
      .map((name) => ({ medicineName: name, label: name }))
      .forEach((item) => {
        const key = item.label.trim().toLowerCase();
        if (key) unique.set(key, item);
      });

    medicineOptions.forEach((item) => {
      const key = (item.medicineName || item.label || "").trim().toLowerCase();
      if (key && !unique.has(key)) unique.set(key, item);
    });

    return Array.from(unique.values());
  }, [medicineOptions, typedMedicineNames]);

  const medicineSelectOptions = useMemo(() => {
    const options = new Set(DEFAULT_MEDICINE_OPTIONS);
    combinedMedicineOptions.forEach((medicine) => {
      const label = medicine.medicineName || medicine.label;
      if (label) options.add(label);
    });
    medicines.forEach((medicine) => {
      if (medicine.medicineName) options.add(medicine.medicineName);
    });
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [combinedMedicineOptions, medicines]);

  const diagnosisSelectOptions = useMemo(() => {
    const options = new Set(DIAGNOSIS_TEST_OPTIONS);
    diagnosisOptions.forEach((option) => {
      if (option) options.add(option);
    });
    splitDiagnosisTests(diagnosis).forEach((option) => options.add(option));
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [diagnosis, diagnosisOptions]);
  const selectedDiagnosisTests = useMemo(
    () => splitDiagnosisTests(diagnosis),
    [diagnosis]
  );

  const updateMedicine = (id, field, value) =>
    setMedicines((prev) =>
      prev.map((medicine) =>
        medicine.id === id ? { ...medicine, [field]: value } : medicine
      )
    );

  const removeMedicine = (id) => {
    setMedicines((prev) =>
      prev.length === 1 ? [createMedicine()] : prev.filter((medicine) => medicine.id !== id)
    );
  };

  const addMedicine = () => {
    setMedicines((prev) => [...prev, createMedicine()]);
  };

  const normalizedMedicineSearch = medicineSearch.trim();
  const lowerMedicineSearch = normalizedMedicineSearch.toLowerCase();
  const hasExactMedicineMatch = combinedMedicineOptions.some((medicine) => {
    const label = (medicine.medicineName || medicine.label || "").trim().toLowerCase();
    return label === lowerMedicineSearch;
  });

  const filteredMedicineOptions = useMemo(() => {
    const query = lowerMedicineSearch;
    if (!query) return combinedMedicineOptions.slice(0, 8);

    return combinedMedicineOptions
      .filter((medicine) =>
        [
          medicine.label,
          medicine.medicineName,
          medicine.brandName,
          medicine.dosage,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      )
      .slice(0, 8);
  }, [combinedMedicineOptions, lowerMedicineSearch]);

  const showMedicineResults =
    isMedicineSearchFocused &&
    (filteredMedicineOptions.length > 0 || normalizedMedicineSearch.length > 0);

  const registerTypedMedicine = (medicineName) => {
    const name = String(medicineName || "").trim();
    if (!name) return;

    const normalized = name.toLowerCase();
    const alreadyStored =
      typedMedicineNames.some((item) => item.trim().toLowerCase() === normalized) ||
      medicineOptions.some((medicine) => {
        const label = (medicine.medicineName || medicine.label || "").trim().toLowerCase();
        return label === normalized;
      });

    if (alreadyStored) return;

    const nextMedicine = { medicineName: name, label: name };
    setMedicineOptions((prev) => [nextMedicine, ...prev]);
    setTypedMedicineNames((prev) => {
      const next = [name, ...prev.filter((item) => item.trim().toLowerCase() !== normalized)];
      localStorage.setItem("prescriptionTypedMedicineNames", JSON.stringify(next));
      return next;
    });
  };

  const addTypedMedicine = (query) => {
    const medicineName = String(query || "").trim();
    if (!medicineName) return;

    const normalized = medicineName.toLowerCase();
    const existingMedicine = combinedMedicineOptions.find((medicine) => {
      const label = (medicine.medicineName || medicine.label || "").trim().toLowerCase();
      return label === normalized;
    });

    const nextMedicine = existingMedicine
      ? existingMedicine
      : { medicineName, label: medicineName };

    if (!existingMedicine) {
      setMedicineOptions((prev) => [nextMedicine, ...prev]);
    }

    selectMedicine(nextMedicine);
  };

  const handleMedicineSearchKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();

    if (!normalizedMedicineSearch) return;
    if (hasExactMedicineMatch) {
      const exactMatch = combinedMedicineOptions.find((medicine) => {
        const label = (medicine.medicineName || medicine.label || "").trim().toLowerCase();
        return label === normalizedMedicineSearch.toLowerCase();
      });
      if (exactMatch) {
        selectMedicine(exactMatch);
        return;
      }
    }

    addTypedMedicine(normalizedMedicineSearch);
  };

  const selectMedicine = (medicine) => {
    const nextMedicine = {
      ...createMedicine(),
      medicineName: medicine.medicineName || medicine.label || "",
      dosage: medicine.dosage || "",
      quantity: medicine.quantity || "",
      frequency: medicine.frequency || "",
      duration: medicine.duration || "",
      notes: medicine.notes || "",
    };

    setMedicines((prev) => {
      const emptyIndex = prev.findIndex((item) => !item.medicineName.trim());
      if (emptyIndex === -1) return [...prev, nextMedicine];
      return prev.map((item, index) => (index === emptyIndex ? nextMedicine : item));
    });
    setMedicineSearch("");
  };

  const buildPrescriptionHtml = () => {
    const rows = (validMedicines.length ? validMedicines : medicines)
      .map(
        (medicine) => `
          <tr>
            <td>${medicine.medicineName || emptyValue}</td>
            <td>${medicine.dosage || emptyValue}</td>
            <td>${medicine.quantity || emptyValue}</td>
            <td>${medicine.frequency || emptyValue}</td>
            <td>${medicine.duration || emptyValue}</td>
            <td>${medicine.notes || emptyValue}</td>
          </tr>`
      )
      .join("");

    return `
      <!doctype html>
      <html>
        <head>
          <title>Prescription - ${appointment?.patientName || "Patient"}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; padding: 28px; background: #f8fbff; }
            .slip { max-width: 880px; margin: 0 auto; border: 1px solid #bfdbfe; border-radius: 14px; padding: 28px; background: #fff; box-shadow: inset 0 5px 0 #2563eb; }
            .letterhead { text-align: center; border-bottom: 2px solid #2563eb; padding: 16px 12px 14px; margin: -8px -8px 18px; border-radius: 12px 12px 0 0; background: linear-gradient(135deg, #eff6ff 0%, #ecfeff 100%); }
            h1 { margin: 0; font-size: 28px; letter-spacing: 0; color: #0f172a; }
            .muted { color: #2563eb; font-size: 13px; font-weight: 700; margin: 4px 0; }
            .summary { display: grid; grid-template-columns: 1fr 210px; gap: 20px; border-bottom: 1px solid #bfdbfe; padding-bottom: 16px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px 18px; font-size: 13px; border: 1px solid #dbeafe; border-radius: 10px; padding: 12px; background: #f8fbff; }
            .block { margin-top: 12px; font-size: 13px; }
            .block b { display: block; margin-bottom: 4px; color: #1d4ed8; }
            .block p { margin: 0; white-space: pre-wrap; color: #334155; }
            .vitals { border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px; font-size: 12px; background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%); }
            .vitals b { display: block; margin-bottom: 6px; color: #1e40af; }
            .vital-row { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid #dbeafe; padding: 6px 0; }
            .vital-row:last-child { border-bottom: 0; }
            .vital-row strong { text-align: right; }
            .rx { font-size: 34px; font-weight: 900; font-style: italic; margin: 18px 0 8px; color: #1d4ed8; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 10px; text-align: left; }
            th { color: #1e40af; font-size: 12px; background: #eff6ff; }
            .footer { margin-top: 22px; display: flex; justify-content: space-between; gap: 24px; border-top: 1px solid #bfdbfe; padding-top: 14px; color: #334155; }
            .signature { text-align: right; min-height: 48px; padding-bottom: 6px; }
            .signature p { margin: 3px 0; line-height: 1.45; }
          </style>
        </head>
        <body>
          <main class="slip">
            <div class="letterhead">
              <h1>${hospitalName}</h1>
              <p class="muted">Super Speciality Hospital</p>
              <p class="muted">Token: ${appointment?.tokenNumber || emptyValue}</p>
            </div>
            <section class="summary">
              <div>
                <section class="grid">
                  <div><b>Patient:</b> ${appointment?.patientName || emptyValue}</div>
                  <div><b>PID:</b> ${appointment?.patientCode || emptyValue}</div>
                  <div><b>Age / Gender:</b> ${appointment?.age || emptyValue} Y / ${appointment?.gender || emptyValue}</div>
                  <div><b>Date:</b> ${formatDateMMDDYYYY(appointment?.date || new Date())}</div>
                </section>
                <div class="block"><b>Chief Complaint</b><p>${chiefComplaint}</p></div>
                <div class="block"><b>Clinical Note</b><p>${clinicalNote}</p></div>
                <div class="block"><b>Diagnosis Tests</b><p>${previewDiagnosis}</p></div>
              </div>
              <aside class="vitals">
                <b>Vitals</b>
                ${vitals
        .map(([label, value]) => `<div class="vital-row"><span>${label}</span><strong>${value || emptyValue}</strong></div>`)
        .join("")}
              </aside>
            </section>
            <div class="rx">Rx</div>
            <table>
              <thead><tr><th>Medicine</th><th>Dosage</th><th>Qty</th><th>Frequency</th><th>Duration</th><th>Notes</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <section class="footer">
              <div>
                <p><b>Instructions:</b> ${instructions || "No instructions added."}</p>
                <p><b>Follow-Up Date:</b> ${followUpLabel}</p>
              </div>
              <div class="signature">
                <p><b>Dr. ${doctorName}</b></p>
                <p>${appointment?.doctorSpecialization || "Consultant"}</p>
              </div>
            </section>
          </main>
        </body>
      </html>
    `;
  };

  const printPrescription = () => {
    const printWindow = window.open("", "_blank", "width=820,height=960");
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(buildPrescriptionHtml());
    printWindow.document.write("<script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };</script>");
    printWindow.document.close();
  };

  const downloadPrescription = () => {
    printPrescription();
  };

  const goToCompletion = (completedStatus = "Completed", completionMessage = "Prescription submitted.") => {
    navigate("/doctor/completion", {
      state: {
        message: completionMessage,
        appointmentStatus: completedStatus,
        appointmentId: appointment.appointmentId,
        patientName: appointment.patientName,
      },
    });
  };

  const submitPrescription = async () => {
    setFieldErrors({});
    const appointmentId = toPositiveId(appointment?.appointmentId);
    const patientId = toPositiveId(appointment?.patientId);

    if (!appointmentId || !patientId) {
      const text = "Appointment id or patient id is missing.";
      setError(text);
      toast.error(text);
      return;
    }

    const nextErrors = {
      diagnosis: validateRequired(diagnosis, "Diagnosis tests"),
      followUp: validateDate(followUp, "Follow up date", { allowPast: false }),
    };

    if (nextErrors.diagnosis || nextErrors.followUp) {
      Object.keys(nextErrors).forEach((key) => {
        if (!nextErrors[key]) delete nextErrors[key];
      });
      setFieldErrors(nextErrors);
      const text = "Please fix the highlighted fields.";
      setError(text);
      toast.error(text);
      return;
    }

    if (validMedicines.length === 0) {
      const text = "Add at least one medicine.";
      setError(text);
      toast.error(text);
      return;
    }

    const incompleteMedicine = validMedicines.find(
      (medicine) =>
        !medicine.dosage ||
        !medicine.frequency ||
        !medicine.duration
    );

    if (incompleteMedicine) {
      const text = "Dosage, frequency, and duration are required for each medicine.";
      setError(text);
      toast.error(text);
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setMessage("");

      const token = getAuthToken();
      const headers = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(PRESCRIPTION_API, {
        method: "POST",
        headers,
        body: JSON.stringify({
          appointmentId,
          patientId,
          doctorId: appointment?.doctorId || routeState.doctorId || undefined,
          patientCode: appointment?.patientCode || routeState.patient?.patientCode || undefined,
          patientName: appointment?.patientName || routeState.patient?.name || undefined,
          appointmentDate: appointment?.date || undefined,
          diagnosis: diagnosis.trim(),
          instructions: instructions.trim(),
          followUpDate: new Date(`${followUp}T10:00:00`).toISOString(),
          status: "Completed",
          medicines: validMedicines,
        }),
      });

      const responseText = await response.text().catch(() => "");
      const data = parseJsonText(responseText);

      if (!response.ok) {
        const message = getResponseMessage(
          data,
          responseText,
          "Unable to submit prescription."
        );

        if (isAlreadyExistsMessage(message)) {
          const statusResult = await updateAppointmentStatus(appointmentId, "Completed", headers);
          const completedStatus = statusResult?.status || "Completed";

          setAppointment((prev) => ({ ...prev, status: completedStatus }));
          setError("");
          setMessage("");
          goToCompletion(completedStatus, "Prescription completed.");
          return;
        }

        throw new Error(
          message
        );
      }

      const statusResult = await updateAppointmentStatus(appointmentId, "Completed", headers);
      const completedStatus = statusResult?.status || "Completed";
      const text = data.message || "Prescription submitted.";
      setAppointment((prev) => ({ ...prev, status: completedStatus }));
      setMessage(text);
      toast.success(text);
      goToCompletion(completedStatus, data.message || text);
    } catch (err) {
      console.error(err);
      const text = err.message || "Unable to submit prescription.";
      setError(text);
      toast.error(text);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!loading && error && !appointment) {
      navigate("/doctor/dashboard", { replace: true });
    }
  }, [appointment, error, loading, navigate]);

  if (loading) {
    return <div className="rx-state-card">Loading prescription...</div>;
  }

  if (error && !appointment) {
    return <div className="rx-state-card rx-state-card--error">{error}</div>;
  }

  return (
    <div className="rx-page">
      <div className="rx-stepper">
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <div className="rx-step">
              <div
                className={`rx-step-circle ${i < 2 ? "done" : i === 2 ? "active" : ""
                  }`}
              >
                {i < 2 ? "✓" : i + 1}
              </div>
              <span className={`rx-step-label ${i === 2 ? "active" : ""}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`rx-step-line ${i < 2 ? "done" : ""}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* <div className="rx-clinic-banner">
        <span>Clinic Name</span>
        <strong>{hospitalName}</strong>
      </div> */}

      {error ? <div className="rx-inline-error">{error}</div> : null}
      {message ? <div className="rx-inline-success">{message}</div> : null}

      <div className="rx-body">
        <div className="rx-form-panel">
          <div className="rx-field">
            <label className="rx-label">Diagnosis Tests *</label>
            <select
              className="rx-input"
              value=""
              onChange={(event) => {
                const selected = event.target.value;
                if (!selected) return;
                setDiagnosis(
                  joinDiagnosisTests([
                    ...selectedDiagnosisTests.filter(
                      (item) => item.toLowerCase() !== selected.toLowerCase()
                    ),
                    selected,
                  ])
                );
                setFieldErrors((prev) => ({ ...prev, diagnosis: "" }));
                setError("");
              }}
            >
              <option value="">
                {selectedDiagnosisTests.length ? "Add another diagnosis test" : "Select diagnosis test"}
              </option>
              {diagnosisSelectOptions.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
            <small className="rx-field-hint">
              {selectedDiagnosisTests.length
                ? selectedDiagnosisTests.join(", ")
                : "Select one or more diagnosis tests"}
            </small>
            {fieldErrors.diagnosis ? (
              <small className="rx-field-error">{fieldErrors.diagnosis}</small>
            ) : null}
          </div>

          <div className="rx-field">
            <label className="rx-label">Medicine</label>
            <div className="rx-search-bar rx-search-bar--with-list">
              <Search size={15} className="rx-search-icon" />
              <input
                className="rx-search-input"
                value={medicineSearch}
                onChange={(event) => setMedicineSearch(event.target.value)}
                onKeyDown={handleMedicineSearchKeyDown}
                onFocus={() => setIsMedicineSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsMedicineSearchFocused(false), 200)}
                placeholder="Search medicine or brand..."
                autoComplete="off"
              />
              {showMedicineResults ? (
                <div className="rx-medicine-results">
                  {filteredMedicineOptions.map((medicine) => (
                    <button
                      type="button"
                      key={medicine.label}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectMedicine(medicine)}
                    >
                      <strong>{medicine.medicineName || medicine.label}</strong>
                      {medicine.brandName ? <span>{medicine.brandName}</span> : null}
                    </button>
                  ))}
                  {normalizedMedicineSearch && !hasExactMedicineMatch ? (
                    <button
                      type="button"
                      className="rx-medicine-results__new"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => addTypedMedicine(medicineSearch)}
                    >
                      <strong>Add "{normalizedMedicineSearch}"</strong>
                      <span>New medicine</span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rx-table-wrap">
            <div className="rx-thead">
              <span>Medicine</span>
              <span>Dosage</span>
              <span>Quantity</span>
              <span>Frequency</span>
              <span>Duration</span>
              <span>Notes</span>
              <span>Actions</span>
            </div>
            {medicines.map((medicine) => (
              <div className="rx-row" key={medicine.id}>
                <input
                  className="rx-cell-input rx-med-name"
                  list="prescription-medicine-options"
                  value={medicine.medicineName}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateMedicine(medicine.id, "medicineName", value);
                  }}
                  onBlur={(event) => registerTypedMedicine(event.target.value)}
                  placeholder="Select or type medicine"
                />
                <input
                  className="rx-cell-input"
                  list="prescription-dosage-options"
                  value={medicine.dosage}
                  onChange={(event) =>
                    updateMedicine(medicine.id, "dosage", event.target.value)
                  }
                  placeholder="Select or type dosage"
                />
                <input
                  className="rx-cell-input"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={medicine.quantity}
                  onChange={(event) =>
                    updateMedicine(medicine.id, "quantity", event.target.value)
                  }
                  placeholder="Qty"
                />
                <select
                  className="rx-cell-input rx-freq"
                  value={medicine.frequency}
                  onChange={(event) =>
                    updateMedicine(medicine.id, "frequency", event.target.value)
                  }
                >
                  <option value="">Frequency</option>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <option value={option} key={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <input
                  className="rx-cell-input"
                  value={medicine.duration}
                  onChange={(event) =>
                    updateMedicine(medicine.id, "duration", event.target.value)
                  }
                  placeholder="5 Days"
                />
                <select
                  className="rx-cell-input"
                  value={medicine.notes}
                  onChange={(event) =>
                    updateMedicine(medicine.id, "notes", event.target.value)
                  }
                >
                  <option value="">Notes</option>
                  {NOTE_OPTIONS.map((option) => (
                    <option value={option} key={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <span>
                  <button
                    className="rx-del-btn"
                    type="button"
                    onClick={() => removeMedicine(medicine.id)}
                    title="Remove medicine"
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
            ))}
          </div>

          <datalist id="prescription-medicine-options">
            {medicineSelectOptions.map((option) => (
              <option value={option} key={option} />
            ))}
          </datalist>

          <datalist id="prescription-dosage-options">
            {DOSAGE_OPTIONS.map((option) => (
              <option value={option} key={option} />
            ))}
          </datalist>

          <button
            className="rx-add-med-btn"
            type="button"
            onClick={addMedicine}
            title="Add medicine"
          >
            + Add Medicine
          </button>

          <div className="rx-field">
            <label className="rx-label">Instructions</label>
            <select
              className="rx-input"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
            >
              {INSTRUCTION_OPTIONS.map((option) => (
                <option value={option} key={option}>
                  {option}
                </option>
              ))}
              {instructions && !INSTRUCTION_OPTIONS.includes(instructions) ? (
                <option value={instructions}>{instructions}</option>
              ) : null}
            </select>
          </div>

          <div className="rx-field rx-field--half">
            <label className="rx-label">Follow Up Date</label>
            <input
              className="rx-input"
              type="date"
              value={followUp}
              onChange={(event) => {
                setFollowUp(event.target.value);
                setFieldErrors((prev) => ({ ...prev, followUp: "" }));
                setError("");
              }}
            />
            {fieldErrors.followUp ? (
              <small className="rx-field-error">{fieldErrors.followUp}</small>
            ) : null}
          </div>

          <div className="rx-actions">
            <button
              className="rx-btn-draft"
              type="button"
              onClick={() => setMessage("Draft kept on this screen.")}
            >
              Save Draft
            </button>
            <div className="rx-actions-right">
              <button
              className="rx-btn-submit"
              type="button"
              onClick={submitPrescription}
                disabled={submitting}
                title="Submit prescription"
              >
                {submitting ? "Submitting..." : "Submit Prescription"}
              </button>
              <button className="rx-btn-icon" type="button" onClick={printPrescription}>
                <Printer size={16} /> Print
              </button>
              <button className="rx-btn-icon" type="button" onClick={downloadPrescription}>
                <Download size={16} /> Download PDF
              </button>
            </div>
          </div>
        </div>

        <div className="rx-preview-panel">
          <h4 className="rx-preview-heading">Prescription Preview</h4>
          <div className="rx-preview-slip">
            <div className="rx-slip-header">
              <p className="rx-slip-clinic">{hospitalName}</p>
              <p className="rx-slip-sub">Super Speciality Hospital</p>
              <p className="rx-slip-addr">
                Token: {appointment?.tokenNumber || emptyValue}
              </p>
            </div>
            <div className="rx-slip-summary">
              <div className="rx-slip-main">
                <div className="rx-slip-patient">
                  <p>
                    <b>Patient Name:</b> {appointment?.patientName || emptyValue}
                  </p>
                  <p>
                    <b>PID:</b> {appointment?.patientCode || emptyValue}
                  </p>
                  <p>
                    <b>Age / Gender:</b> {appointment?.age || emptyValue} Y /{" "}
                    {appointment?.gender || emptyValue}
                  </p>
                  <p>
                    <b>Date:</b> {formatDateMMDDYYYY(appointment?.date || new Date())}
                  </p>
                </div>
                <div className="rx-slip-clinical">
                  <p>
                    <b>Chief Complaint</b>
                    <span>{chiefComplaint}</span>
                  </p>
                  <p>
                    <b>Clinical Note</b>
                    <span>{clinicalNote}</span>
                  </p>
                  <p>
                    <b>Diagnosis Tests</b>
                    <span>{previewDiagnosis}</span>
                  </p>
                </div>
              </div>
              <aside className="rx-slip-vitals">
                <b>Vitals</b>
                {vitals.map(([label, value]) => (
                  <p key={label}>
                    <span>{label}</span>
                    <strong>{value || emptyValue}</strong>
                  </p>
                ))}
              </aside>
            </div>
            <div className="rx-slip-rx">Rx</div>
            <table className="rx-slip-table">
              <thead>
                <tr>
                  <th>Medicines</th>
                  <th>Dosage</th>
                  <th>Qty</th>
                  <th>Frequency</th>
                  <th>Duration</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {(validMedicines.length ? validMedicines : medicines).map((medicine, index) => (
                  <tr key={`${medicine.medicineName}-${index}`}>
                    <td>{medicine.medicineName || emptyValue}</td>
                    <td>{medicine.dosage || emptyValue}</td>
                    <td>{medicine.quantity || emptyValue}</td>
                    <td>{medicine.frequency || emptyValue}</td>
                    <td>{medicine.duration || emptyValue}</td>
                    <td>{medicine.notes || emptyValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="rx-slip-instruction">
              <i>{instructions || "No instructions added."}</i>
            </p>
            <p className="rx-slip-followup">
              Follow-Up Date: {followUpLabel}
            </p>
            <div className="rx-slip-signature">
              <p>
                <b>Dr. {doctorName}</b>
              </p>
              <p>{appointment?.doctorSpecialization || "Consultant"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Prescription;
