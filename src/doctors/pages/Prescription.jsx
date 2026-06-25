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
  fetchDiagnosisOptions,
  mergeDiagnosisOption,
} from "../utils/diagnosisOptions";
import { getClinicDisplayName } from "../../utils/clinicDisplay";
import { useToast } from "../../components/ToastProvider";
import { validateDate, validateRequired } from "../../utils/validation";
import { formatDateMMDDYYYY } from "../../utils/dateFormat";

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
const DEFAULT_DIAGNOSIS_OPTIONS = [
  "Fever",
  "Upper respiratory infection",
  "Gastritis",
  "Hypertension",
  "Diabetes follow-up",
  "Migraine",
  "Allergic rhinitis",
  "Back pain",
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

const defaultFollowUpDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
};

const normalizeAppointment = (item, fallback = {}) => {
  if (!item) return null;

  return {
    ...item,
    appointmentId: item.appointmentId || item.id || fallback.appointmentId,
    patientId: item.patientId || fallback.patientId,
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

const toPositiveId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const buildCompletedAppointmentBody = (appointment = {}, appointmentId) => ({
  ...appointment,
  id: appointment.id || appointmentId,
  appointmentId,
  status: "Completed",
  Status: "Completed",
});

const updateAppointmentStatus = async ({ appointmentId, appointment, headers }) => {
  const requests = [
    {
      url: `${APPOINTMENTS_API}/${appointmentId}/status`,
      options: {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "Completed", Status: "Completed" }),
      },
    },
    {
      url: `${APPOINTMENTS_API}/${appointmentId}`,
      options: {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "Completed", Status: "Completed" }),
      },
    },
    {
      url: `${APPOINTMENTS_API}/${appointmentId}`,
      options: {
        method: "PUT",
        headers,
        body: JSON.stringify(buildCompletedAppointmentBody(appointment, appointmentId)),
      },
    },
  ];

  let lastError = "Unable to update appointment status.";

  for (const request of requests) {
    let response = null;

    try {
      response = await fetch(request.url, request.options);
    } catch (error) {
      lastError = error.message || lastError;
      continue;
    }

    if (!response) continue;

    const responseText = await response.text().catch(() => "");
    const data = parseJsonText(responseText);

    if (response.ok) {
      return data;
    }

    lastError = getResponseMessage(data, responseText, lastError);
  }

  throw new Error(lastError);
};

function Prescription() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const routeState = React.useMemo(() => location.state || {}, [location.state]);

  const [appointment, setAppointment] = useState(null);
  const [consultation, setConsultation] = useState(routeState.consultation || null);
  const [diagnosis, setDiagnosis] = useState(routeState.consultation?.diagnosis || "");
  const [instructions, setInstructions] = useState(
    "Take medicines after food and complete the full course."
  );
  const [followUp, setFollowUp] = useState(defaultFollowUpDate());
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

        const normalizedAppointment = normalizeAppointment(selectedAppointment, {
          patientId: routeState.patientId || routeAppointment?.patientId,
        });

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
            savedConsultation?.diagnosis ||
            routeState.consultation?.diagnosis ||
            "";

        setDiagnosis(resolvedDiagnosis);
        setDiagnosisOptions((prev) =>
          mergeDiagnosisOption(prev, resolvedDiagnosis)
        );
        setInstructions(
          savedPrescription?.instructions ||
            "Take medicines after food and complete the full course."
        );
        setFollowUp(toDateInput(savedPrescription?.followUpDate) || defaultFollowUpDate());

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

  const hospitalName = getClinicDisplayName({}, "Clinic Name");
  const doctorName = localStorage.getItem("doctorName") || appointment?.doctorName || "Doctor";

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
    const options = new Set(DEFAULT_DIAGNOSIS_OPTIONS);
    diagnosisOptions.forEach((option) => {
      if (option) options.add(option);
    });
    if (diagnosis) options.add(diagnosis);
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [diagnosis, diagnosisOptions]);

  const updateMedicine = (id, field, value) =>
    setMedicines((prev) =>
      prev.map((medicine) =>
        medicine.id === id ? { ...medicine, [field]: value } : medicine
      )
    );

  const removeMedicine = (id) =>
    setMedicines((prev) =>
      prev.length === 1 ? [createMedicine()] : prev.filter((medicine) => medicine.id !== id)
    );

  const addMedicine = () =>
    setMedicines((prev) => [...prev, createMedicine()]);

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
          </tr>`
      )
      .join("");

    return `
      <!doctype html>
      <html>
        <head>
          <title>Prescription - ${appointment?.patientName || "Patient"}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; padding: 32px; }
            .slip { max-width: 760px; margin: 0 auto; border: 1px solid #d9e1ec; border-radius: 10px; padding: 28px; }
            .center { text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 14px; }
            h1 { margin: 0; font-size: 22px; }
            .muted { color: #64748b; font-size: 13px; margin: 4px 0; }
            .rx { font-size: 28px; font-weight: 800; font-style: italic; margin: 18px 0 10px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 14px 0; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 10px; text-align: left; }
            th { color: #475569; font-size: 12px; }
            .footer { margin-top: 22px; display: flex; justify-content: space-between; gap: 24px; }
            .signature { text-align: right; }
          </style>
        </head>
        <body>
          <main class="slip">
            <div class="center">
              <h1>${hospitalName}</h1>
              <p class="muted">Patient prescription</p>
              <p class="muted">Token: ${appointment?.tokenNumber || emptyValue}</p>
            </div>
            <div class="rx">Rx</div>
            <section class="grid">
              <div><b>Patient:</b> ${appointment?.patientName || emptyValue}</div>
              <div><b>PID:</b> ${appointment?.patientCode || emptyValue}</div>
              <div><b>Age / Gender:</b> ${appointment?.age || emptyValue} Y / ${appointment?.gender || emptyValue}</div>
              <div><b>Date:</b> ${formatDateMMDDYYYY(appointment?.date || new Date())}</div>
            </section>
            <table>
              <thead><tr><th>Medicine</th><th>Dosage</th><th>Qty</th><th>Frequency</th><th>Duration</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <section class="footer">
              <div>
                <p><b>Instructions:</b> ${instructions || "No instructions added."}</p>
                <p><b>Follow-Up Date:</b> ${formatDateMMDDYYYY(followUp, emptyValue)}</p>
              </div>
              <div class="signature">
                <p><b>Dr. ${doctorName}</b></p>
                <p>${appointment?.doctorSpecialization || "Consultant"}</p>
                <p>Diagnosis: ${diagnosis || consultation?.diagnosis || emptyValue}</p>
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
      diagnosis: validateRequired(diagnosis, "Diagnosis"),
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
        throw new Error(
          getResponseMessage(
            data,
            responseText,
            "Unable to submit prescription."
          )
        );
      }

      const appointmentStatusResult = await updateAppointmentStatus({
        appointmentId,
        appointment,
        headers,
      });
      const completedStatus =
        appointmentStatusResult.appointmentStatus ||
        appointmentStatusResult.status ||
        "Completed";
      const text = data.message || "Prescription submitted.";
      setAppointment((prev) => ({ ...prev, status: completedStatus }));
      setMessage(text);
      toast.success(text);
      navigate("/doctor/completion", {
        state: {
          message: data.message,
          appointmentStatus: completedStatus,
          appointmentId: appointment.appointmentId,
          patientName: appointment.patientName,
        },
      });
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
                className={`rx-step-circle ${
                  i < 2 ? "done" : i === 2 ? "active" : ""
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

      <div className="rx-clinic-banner">
        <span>Clinic Name</span>
        <strong>{hospitalName}</strong>
      </div>

      {error ? <div className="rx-inline-error">{error}</div> : null}
      {message ? <div className="rx-inline-success">{message}</div> : null}

      <div className="rx-body">
        <div className="rx-form-panel">
          <div className="rx-field">
            <label className="rx-label">Diagnosis *</label>
            <select
              className="rx-input"
              value={diagnosis}
              onChange={(event) => {
                setDiagnosis(event.target.value);
                setFieldErrors((prev) => ({ ...prev, diagnosis: "" }));
                setError("");
              }}
            >
              <option value="">Select diagnosis</option>
              {diagnosisSelectOptions.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
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
                <select
                  className="rx-cell-input"
                  value={medicine.dosage}
                  onChange={(event) =>
                    updateMedicine(medicine.id, "dosage", event.target.value)
                  }
                >
                  <option value="">Dosage</option>
                  {DOSAGE_OPTIONS.map((option) => (
                    <option value={option} key={option}>
                      {option}
                    </option>
                  ))}
                </select>
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

          <button className="rx-add-med-btn" type="button" onClick={addMedicine}>
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
                Patient prescription
                <br />
                Token: {appointment?.tokenNumber || emptyValue}
              </p>
            </div>
            <div className="rx-slip-rx">Rx</div>
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
            <table className="rx-slip-table">
              <thead>
                <tr>
                  <th>Medicines</th>
                  <th>Dosage</th>
                  <th>Qty</th>
                  <th>Frequency</th>
                  <th>Duration</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="rx-slip-instruction">
              <i>{instructions || "No instructions added."}</i>
            </p>
            <p className="rx-slip-followup">
              Follow-Up Date: {formatDateMMDDYYYY(followUp, emptyValue)}
            </p>
            <div className="rx-slip-signature">
              <p>
                <b>Dr. {doctorName}</b>
              </p>
              <p>{appointment?.doctorSpecialization || "Consultant"}</p>
              <p>
                Diagnosis: {diagnosis || consultation?.diagnosis || emptyValue}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Prescription;
