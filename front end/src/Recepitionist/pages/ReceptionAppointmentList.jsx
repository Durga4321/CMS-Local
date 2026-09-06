import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Building2,
  Calendar,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  Clock,
  Droplet,
  Globe,
  Heart,
  HeartPulse,
  History,
  RefreshCw,
  Scale,
  Search,
  Stethoscope,
  Thermometer,
  Wind,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import "../../Nurse/Nurse.css";
import { useToast } from "../../components/ToastProvider";
import { formatDateMMDDYYYY } from "../../utils/dateFormat";
import { applyTimeOrderedTokens, filterAppointments, getAppointmentValue, getBookingType } from "./appointmentListUtils";
import { getReceptionistScope, scopeReceptionistRecords } from "../receptionScope";
import { requestJson as defaultRequestJson } from "../receptionApi";
import { getReceptionistProfile } from "../receptionSession";
import { getNurseProfile } from "../../Nurse/nurseSession";
import { canUseModulePermission, useRolePermissionsSync } from "../../utils/rolePermissions";
import {
  getAppointmentRecordId,
  mergeStoredAppointmentVitals,
  saveStoredAppointmentVitals,
} from "../../utils/appointmentVitals";
import { getSpecializationDisplayName } from "../../pages/DOCTORS/doctorExpertiseOptions";

const pageSize = 8;
const emptyVitals = {
  bloodPressure: "",
  sugarLevel: "",
  temperature: "",
  weight: "",
  pulseRate: "",
  respiratoryRate: "",
};
const vitalFields = [
  {
    name: "bloodPressure",
    label: "Blood Pressure",
    instrumentName: "BP Monitor",
    unit: "mmHg",
    placeholder: "120/80",
    icon: HeartPulse,
    refRange: "120/80",
    iconBg: "linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)",
    iconColor: "#e11d48",
  },
  {
    name: "sugarLevel",
    label: "Blood Glucose",
    instrumentName: "Glucometer",
    unit: "mg/dL",
    placeholder: "100",
    icon: Droplet,
    refRange: "70-100",
    iconBg: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
    iconColor: "#d97706",
  },
  {
    name: "temperature",
    label: "Temperature",
    instrumentName: "Thermometer",
    unit: "F",
    placeholder: "98.6",
    icon: Thermometer,
    refRange: "98.6 °F",
    iconBg: "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)",
    iconColor: "#059669",
  },
  {
    name: "weight",
    label: "Body Weight",
    instrumentName: "Scale",
    unit: "kg",
    placeholder: "70",
    icon: Scale,
    refRange: "Weight (kg)",
    iconBg: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)",
    iconColor: "#4f46e5",
  },
  {
    name: "pulseRate",
    label: "Pulse Rate",
    instrumentName: "Cardiac Monitor",
    unit: "bpm",
    placeholder: "72",
    icon: Heart,
    refRange: "60-100 bpm",
    iconBg: "linear-gradient(135deg, #fee2e2 0%, #fca5a5 100%)",
    iconColor: "#dc2626",
  },
  {
    name: "respiratoryRate",
    label: "Oxygen (SpO2)",
    instrumentName: "Pulse Oximeter",
    unit: "%",
    placeholder: "98",
    icon: Wind,
    refRange: "95-100 %",
    iconBg: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)",
    iconColor: "#0284c7",
  },
];

const stripUnit = (value) =>
  String(value || "")
    .replace(/\s*(mmhg|mg\/dl|f|kg|bpm|breaths\/min)\s*$/i, "")
    .replace(/\s*%\s*$/i, "")
    .trim();

const appendUnit = (value, unit) => {
  const text = stripUnit(value);
  return text ? `${text} ${unit}` : "";
};

const sanitizeVitalValue = (name, value) => {
  const text = String(value || "");
  if (name === "bloodPressure") {
    return text
      .replace(/[^\d/]/g, "")
      .replace(/\/{2,}/g, "/")
      .replace(/^(\d*\/\d*)\/.*$/, "$1");
  }

  if (name === "pulseRate" || name === "respiratoryRate") {
    return text.replace(/\D/g, "");
  }

  return text.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
};

const getAppointmentId = (appointment = {}) =>
  getAppointmentRecordId(appointment) ||
  getAppointmentValue(appointment, ["appointmentId", "AppointmentId", "id", "Id"], "");

const getAppointmentRowKey = (appointment = {}, index = 0) => {
  const parts = [
    getAppointmentId(appointment),
    getAppointmentValue(appointment, ["patientId", "PatientId", "patientCode", "patient.PatientId", "patient.patientId"], ""),
    getAppointmentValue(appointment, ["date", "appointmentDate", "AppointmentDate", "scheduledDate", "slotDate", "SlotDate", "bookingDate", "BookingDate"], ""),
    getAppointmentValue(appointment, ["time", "slot", "Slot", "startTime", "StartTime", "slotTime", "SlotTime", "timeSlot", "TimeSlot", "appointmentTime", "AppointmentTime"], ""),
    getAppointmentValue(appointment, ["doctorId", "DoctorId", "doctorName", "DoctorName", "doctor.name"], ""),
    getBookingType(appointment),
    index,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return parts.join("|") || `appointment-row-${index}`;
};

const getVitalValue = (appointment = {}, name) =>
  stripUnit(
    getAppointmentValue(
      appointment,
      [name, `vitals.${name}`, `Vitals.${name}`, `appointment.${name}`, `Appointment.${name}`],
      ""
    )
  );

const getTodayKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

function ReceptionAppointmentList({
  title,
  subtitle,
  fetchAppointments,
  bookingType,
  emptyState,
  hideActions = false,
  apiRequest = defaultRequestJson,
  getScope = getReceptionistScope,
  scopeRecords = scopeReceptionistRecords,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith("/nurse") ? "/nurse" : "/reception";
  const toast = useToast();
  const receptionistScope = useMemo(() => getScope(), [getScope]);
  const permissionProfile = useMemo(
    () => (basePath === "/nurse" ? getNurseProfile() : getReceptionistProfile()),
    [basePath]
  );
  useRolePermissionsSync(permissionProfile);
  const permissionModule = bookingType === "Online" ? "Online Bookings" : "Offline Bookings";
  const canEditAppointments = canUseModulePermission(permissionProfile, permissionModule, "Edit");
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [appointmentListView, setAppointmentListView] = useState("today");
  const [page, setPage] = useState(1);
  const [vitalsAppointment, setVitalsAppointment] = useState(null);
  const [vitalsForm, setVitalsForm] = useState(emptyVitals);
  const [vitalsSaving, setVitalsSaving] = useState(false);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = scopeRecords(await fetchAppointments(), receptionistScope);
      const nextAppointments = applyTimeOrderedTokens(data.map(mergeStoredAppointmentVitals)).filter((item) => {
        const currentBookingType = getBookingType(item);
        return currentBookingType === bookingType;
      });
      setAppointments(nextAppointments);
      setPage(1);
    } catch (err) {
      setError(err.message || "Unable to load appointments.");
      toast.error(err.message || "Unable to load appointments.");
    } finally {
      setLoading(false);
    }
  }, [bookingType, fetchAppointments, receptionistScope, toast]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const filteredAppointments = useMemo(() => {
    const todayKey = getTodayKey();
    return filterAppointments(appointments, {
      search,
      doctor: doctorFilter === "All" ? "" : doctorFilter,
      status: statusFilter === "All" ? "" : statusFilter,
      date: dateFilter,
    }).filter((item) => {
      const appointmentDate = String(item.orderedTokenSortDate || "").trim();
      if (!appointmentDate) return appointmentListView === "past";
      return appointmentListView === "today"
        ? appointmentDate === todayKey
        : appointmentDate < todayKey;
    }).sort((left, right) => {
      const dateCompare = String(left.orderedTokenSortDate || "").localeCompare(String(right.orderedTokenSortDate || ""));
      if (dateCompare) return dateCompare;

      const timeCompare = (left.orderedTokenSortTime || 0) - (right.orderedTokenSortTime || 0);
      if (timeCompare) return timeCompare;

      return (left.orderedTokenSequence || 0) - (right.orderedTokenSequence || 0);
    });
  }, [appointmentListView, appointments, doctorFilter, dateFilter, search, statusFilter]);

  const todayAppointmentCount = useMemo(
    () => appointments.filter((item) => String(item.orderedTokenSortDate || "") === getTodayKey()).length,
    [appointments]
  );
  const pastAppointmentCount = useMemo(
    () => appointments.filter((item) => {
      const appointmentDate = String(item.orderedTokenSortDate || "").trim();
      return Boolean(appointmentDate && appointmentDate < getTodayKey());
    }).length,
    [appointments]
  );

  const metrics = useMemo(() => {
    const total = appointments.length;
    const todayCount = appointments.filter(
      (item) => String(item.orderedTokenSortDate || "") === getTodayKey()
    ).length;
    const waitingCount = appointments.filter((item) => {
      const status = String(getAppointmentValue(item, ["status", "appointmentStatus", "Status"], "")).toLowerCase();
      return status.includes("wait") || status.includes("pend") || !status;
    }).length;
    const completedCount = appointments.filter((item) => {
      const status = String(getAppointmentValue(item, ["status", "appointmentStatus", "Status"], "")).toLowerCase();
      return status.includes("confirm") || status.includes("complet") || status.includes("done");
    }).length;
    return { total, todayCount, waitingCount, completedCount };
  }, [appointments]);

  const doctorOptions = useMemo(() => {
    const doctors = new Set(
      appointments
        .map((item) => getAppointmentValue(item, ["doctorName", "doctor.name", "DoctorName", "doctor", "doctorDetails.name"], ""))
        .filter(Boolean)
    );

    return Array.from(doctors).sort();
  }, [appointments]);

  const statusOptions = useMemo(() => {
    const statuses = new Set(
      appointments
        .map((item) => getAppointmentValue(item, ["status", "appointmentStatus", "AppointmentStatus", "Status"], ""))
        .filter(Boolean)
    );

    return Array.from(statuses).sort();
  }, [appointments]);

  const totalPages = Math.max(1, Math.ceil(filteredAppointments.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleAppointments = filteredAppointments.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, doctorFilter, statusFilter, dateFilter]);

  const openVitals = (appointment) => {
    if (!canEditAppointments) {
      toast.error("You do not have permission to edit appointment vitals.");
      return;
    }
    setVitalsAppointment(appointment);
    setVitalsForm(
      vitalFields.reduce(
        (form, field) => ({
          ...form,
          [field.name]: getVitalValue(appointment, field.name),
        }),
        {}
      )
    );
  };

  const closeVitals = () => {
    if (vitalsSaving) return;
    setVitalsAppointment(null);
    setVitalsForm(emptyVitals);
  };

  const setVitalField = (name, value) => {
    setVitalsForm((prev) => ({ ...prev, [name]: sanitizeVitalValue(name, value) }));
  };

  const saveVitals = async (event) => {
    event.preventDefault();
    if (!canEditAppointments) {
      toast.error("You do not have permission to edit appointment vitals.");
      return;
    }
    const appointmentId = getAppointmentId(vitalsAppointment);
    if (!appointmentId) {
      toast.error("Appointment ID missing.");
      return;
    }

    const vitals = vitalFields.reduce(
      (values, field) => ({
        ...values,
        [field.name]: appendUnit(vitalsForm[field.name], field.unit),
      }),
      {}
    );
    const payload = {
      ...vitals,
      bloodPressureUnit: "mmHg",
      sugarLevelUnit: "mg/dL",
      temperatureUnit: "F",
      weightUnit: "kg",
      pulseRateUnit: "bpm",
      respiratoryRateUnit: "%",
      vitals,
    };
    const saveAttempts = [
      { path: `Appointment/${appointmentId}/vitals`, method: "PUT" },
      { path: `Appointment/online/${appointmentId}/vitals`, method: "PUT" },
      { path: `Nurse/appointments/${appointmentId}/vitals`, method: "PUT" },
    ];

    try {
      setVitalsSaving(true);
      let saved = null;

      for (const attempt of saveAttempts) {
        try {
          saved = await apiRequest(attempt.path, {
            method: attempt.method,
            body: JSON.stringify(payload),
          });
          break;
        } catch {
          // Some backends do not expose a vitals update route; local storage below keeps the vitals available.
        }
      }

      saveStoredAppointmentVitals(vitalsAppointment, payload);
      saveStoredAppointmentVitals({ ...vitalsAppointment, ...payload }, payload);

      setAppointments((prev) =>
        prev.map((appointment) =>
          String(getAppointmentId(appointment)) === String(appointmentId)
            ? { ...appointment, ...payload, ...(saved && typeof saved === "object" ? saved : {}) }
            : appointment
        )
      );
      toast.success("Vitals saved.");
      setVitalsAppointment(null);
      setVitalsForm(emptyVitals);
      loadAppointments();
    } catch (error) {
      toast.error(error.message || "Unable to save vitals.");
    } finally {
      setVitalsSaving(false);
    }
  };

  return (
    <section className="rc-page booking-page">
      {/* Background decoration with photorealistic modern consultation & appointment booking theme */}
      <div className="booking-bg-overlay" aria-hidden="true" />

      {/* Hero Header with Booking Theme */}
      <div className="booking-hero">
        <div>
          <div className={`booking-badge ${bookingType === "Online" ? "booking-badge--online" : "booking-badge--offline"}`}>
            {bookingType === "Online" ? <Globe size={13} /> : <Building2 size={13} />}
            <span>{bookingType === "Online" ? "Digital Patient Portal & App Bookings" : "In-Clinic Reception & Desk Bookings"}</span>
          </div>
          <h2>
            {bookingType === "Online" ? <CalendarCheck2 size={26} color="#0284c7" /> : <Stethoscope size={26} color="#d97706" />}
            {title}
          </h2>
          <p>{subtitle}</p>
        </div>
        {!hideActions && (
          <div className="booking-head-actions">
            <button
              className="booking-btn booking-btn--sync"
              onClick={loadAppointments}
              type="button"
              disabled={loading}
              title="Synchronize Booking Telemetry"
            >
              <RefreshCw size={15} className={loading ? "spin-icon" : ""} />
              <span>{loading ? "Syncing..." : "Sync Schedule"}</span>
            </button>
            <button
              className="booking-btn booking-btn--back"
              onClick={() => navigate(`${basePath}/dashboard`)}
              type="button"
              title="Return to Dashboard"
            >
              <ArrowLeft size={15} />
              <span>Dashboard</span>
            </button>
          </div>
        )}
      </div>

      {error ? <div className="rc-alert error">{error}</div> : null}

      {/* Booking Metrics Grid */}
      <div className="booking-metrics-grid">
        <div className="booking-metric-card total">
          <div className="booking-metric-icon">
            <Calendar size={22} />
          </div>
          <div className="booking-metric-info">
            <strong>{metrics.total}</strong>
            <span>Total Bookings</span>
          </div>
        </div>

        <div className="booking-metric-card today">
          <div className="booking-metric-icon">
            <CalendarClock size={22} />
          </div>
          <div className="booking-metric-info">
            <strong>{metrics.todayCount}</strong>
            <span>Today's Schedule</span>
          </div>
        </div>

        <div className="booking-metric-card waiting">
          <div className="booking-metric-icon">
            <Clock size={22} />
          </div>
          <div className="booking-metric-info">
            <strong>{metrics.waitingCount}</strong>
            <span>Queue / Waiting</span>
          </div>
        </div>

        <div className="booking-metric-card completed">
          <div className="booking-metric-icon">
            <CheckCircle2 size={22} />
          </div>
          <div className="booking-metric-info">
            <strong>{metrics.completedCount}</strong>
            <span>Confirmed / Done</span>
          </div>
        </div>
      </div>

      {/* Main Booking Card & Filters */}
      <div className="booking-card">
        <div className="booking-card-head">
          <div className="booking-card-title">
            <div className="booking-card-icon">
              {bookingType === "Online" ? <Globe size={20} /> : <Building2 size={20} />}
            </div>
            <div>
              <h3>{appointmentListView === "past" ? `Past ${title}` : `Today's ${title}`}</h3>
              <p>Search, filter, and review {bookingType.toLowerCase()} appointment schedule.</p>
            </div>
          </div>

          <div className="booking-tabs" role="tablist" aria-label="Appointment schedule timeline">
            <button
              type="button"
              className={`booking-tab-btn ${appointmentListView === "today" ? "active" : ""}`}
              onClick={() => setAppointmentListView("today")}
              role="tab"
              aria-selected={appointmentListView === "today"}
            >
              <CalendarClock size={15} />
              <span>Today</span>
              <span className="booking-tab-count">{todayAppointmentCount}</span>
            </button>
            <button
              type="button"
              className={`booking-tab-btn ${appointmentListView === "past" ? "active" : ""}`}
              onClick={() => setAppointmentListView("past")}
              role="tab"
              aria-selected={appointmentListView === "past"}
            >
              <History size={15} />
              <span>Past</span>
              <span className="booking-tab-count">{pastAppointmentCount}</span>
            </button>
          </div>
        </div>

        {/* Filter Grid */}
        <div className="booking-filter-grid">
          <label className="booking-filter-field">
            <span className="booking-filter-label">
              <Search size={13} /> Search Patient / Token
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Patient name, code, token..."
            />
          </label>
          <label className="booking-filter-field">
            <span className="booking-filter-label">
              <Stethoscope size={13} /> Doctor
            </span>
            <select value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value)}>
              <option value="All">All Doctors</option>
              {doctorOptions.map((doctor) => (
                <option key={doctor} value={doctor}>
                  {doctor}
                </option>
              ))}
            </select>
          </label>
          <label className="booking-filter-field">
            <span className="booking-filter-label">
              <Activity size={13} /> Status
            </span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="All">All Statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="booking-filter-field">
            <span className="booking-filter-label">
              <Calendar size={13} /> Appointment Date
            </span>
            <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          </label>
        </div>

        {loading ? (
          <div className="booking-empty-state">
            <div className="booking-empty-icon">
              <RefreshCw size={28} className="spin-icon" />
            </div>
            <h4>Synchronizing Appointments...</h4>
            <p>Retrieving real-time clinical booking schedules from the server.</p>
          </div>
        ) : visibleAppointments.length === 0 ? (
          <div className="booking-empty-state">
            <div className="booking-empty-icon">
              <CalendarCheck2 size={28} />
            </div>
            <h4>{emptyState}</h4>
            <p>Try adjusting your search query, doctor filter, or date range to view matching bookings.</p>
          </div>
        ) : (
          <>
            <div className="rc-table-wrap">
              <table className="rc-table-data">
                <thead>
                  <tr>
                    <th className="booking-token-head">Token</th>
                    <th>Patient</th>
                    <th>Doctor & Specialty</th>
                    <th>Schedule</th>
                    <th>Chief Complaint</th>
                    <th>Phone</th>
                    <th className="booking-payment-head">Payment</th>
                    <th className="booking-type-head">Booking Type</th>
                    <th className="booking-status-head">Status</th>
                    <th className="booking-vitals-head">Vitals</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAppointments.map((item, index) => {
                    const patientName = getAppointmentValue(item, ["patientName", "patient.name", "patient.fullName", "PatientName"], "-");
                    const patientCode = getAppointmentValue(item, ["patientCode", "patient.code", "patient.patientCode", "PatientCode"], "-");
                    const initial = (patientName || "P").charAt(0).toUpperCase();
                    const status = getAppointmentValue(item, ["status", "appointmentStatus", "AppointmentStatus", "Status"], "Scheduled");
                    const statusLower = status.toLowerCase();
                    const statusClass = statusLower.includes("wait")
                      ? "booking-status--waiting"
                      : statusLower.includes("confirm") || statusLower.includes("complet")
                      ? "booking-status--confirmed"
                      : statusLower.includes("cancel")
                      ? "booking-status--cancelled"
                      : "booking-status--waiting";

                    const currentType = getBookingType(item);

                    return (
                      <tr key={getAppointmentRowKey(item, index)}>
                        <td className="booking-token-cell">
                          <span className="booking-token-badge">
                            {getAppointmentValue(item, ["displayTokenNumber", "orderedTokenNumber", "tokenNumber", "token", "TokenNumber", "tokenNo", "token_number"], "-")}
                          </span>
                        </td>
                        <td>
                          <div className="booking-patient-cell">
                            <div className="booking-patient-avatar">{initial}</div>
                            <div>
                              <span className="booking-patient-name">{patientName}</span>
                              <span className="booking-patient-code">{patientCode}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong style={{ color: "#0f172a", fontSize: "13px" }}>
                            {getAppointmentValue(item, ["doctorName", "doctor.name", "doctor.fullName", "DoctorName"], "-")}
                          </strong>
                          <div style={{ fontSize: "11px", color: "#0f766e", fontWeight: "600", marginTop: "2px" }}>
                            {getSpecializationDisplayName(getAppointmentValue(item, ["doctorSpecialization", "doctor.specialization", "doctorSpeciality", "DoctorSpecialization", "specialization"], "")) || "-"}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#1e293b", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <Calendar size={12} color="#0284c7" />
                              {formatDateMMDDYYYY(getAppointmentValue(item, ["date", "appointmentDate", "AppointmentDate", "scheduledDate", "slotDate", "SlotDate", "bookingDate", "BookingDate"], ""))}
                            </span>
                            <span style={{ fontSize: "11.5px", color: "#64748b", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <Clock size={11} color="#64748b" />
                              {getAppointmentValue(item, ["time", "slot", "Slot", "startTime", "StartTime", "slotTime", "SlotTime", "timeSlot", "TimeSlot", "appointmentTime", "AppointmentTime"], "-")}
                            </span>
                          </div>
                        </td>
                        <td style={{ maxWidth: "180px", fontSize: "12px", color: "#334155" }}>
                          {getAppointmentValue(item, ["chiefComplaint", "chiefComplaints", "ChiefComplaint", "complaint", "reason"], "-")}
                        </td>
                        <td style={{ fontSize: "12px", color: "#475569" }}>
                          {getAppointmentValue(item, ["phoneNumber", "mobileNumber", "patient.phoneNumber", "patient.mobileNumber", "patient.phone", "PhoneNumber"], "-")}
                        </td>
                        <td className="booking-payment-cell">
                          <span style={{ fontSize: "11px", fontWeight: "750", padding: "2px 8px", borderRadius: "6px", background: "#f1f5f9", color: "#334155" }}>
                            {getAppointmentValue(item, ["paymentStatus", "PaymentStatus", "payment.status", "billing.paymentStatus"], "-")}
                          </span>
                        </td>
                        <td className="booking-type-cell">
                          <span className={`booking-type-badge ${currentType === "Online" ? "booking-type-badge--online" : "booking-type-badge--offline"}`}>
                            {currentType === "Online" ? <Globe size={11} /> : <Building2 size={11} />}
                            {currentType}
                          </span>
                        </td>
                        <td className="booking-status-cell">
                          <span className={`booking-status-badge ${statusClass}`}>
                            <Activity size={11} /> {status}
                          </span>
                        </td>
                        <td className="booking-vitals-cell">
                          {canEditAppointments ? (
                            <button
                              className="booking-vitals-btn"
                              type="button"
                              aria-label="Record Vitals"
                              title="Record Patient Vitals (BP, SpO2, Temp, Sugar, Pulse)"
                              onClick={() => openVitals(item)}
                            >
                              <HeartPulse size={16} />
                            </button>
                          ) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="rc-pagination">
              <button className="rc-btn ghost" type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={safePage === 1}>
                Previous
              </button>
              <span>
                Page {safePage} of {totalPages}
              </span>
              <button className="rc-btn ghost" type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={safePage === totalPages}>
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {vitalsAppointment ? (
        <div className="rc-modal-backdrop" onClick={closeVitals}>
          <form
            className="booking-vitals-modal"
            onSubmit={saveVitals}
            onClick={(event) => event.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="vital-modal-header">
              <div className="vital-modal-title-wrap">
                <div className="vital-modal-icon-badge">
                  <Stethoscope size={22} />
                </div>
                <div>
                  <h3>Appointment Clinical Vitals</h3>
                  <div className="vital-patient-pill">
                    <span>Patient: <strong>{getAppointmentValue(vitalsAppointment, ["patientName", "patient.name", "PatientName"], "-")}</strong></span>
                    <span>•</span>
                    <span>Token: <strong>{getAppointmentValue(vitalsAppointment, ["displayTokenNumber", "orderedTokenNumber", "tokenNumber", "token", "TokenNumber"], "-")}</strong></span>
                  </div>
                </div>
              </div>
              <button
                className="vital-modal-close"
                type="button"
                onClick={closeVitals}
                aria-label="Close vitals modal"
                title="Close"
              >
                <X size={17} />
              </button>
            </div>

            {/* Vital Instrument Detail Cards */}
            <div className="vitals-cards-grid">
              {vitalFields.map((field) => {
                const IconComponent = field.icon || HeartPulse;
                return (
                  <div className="vital-detail-card" key={field.name}>
                    <div className="vital-card-top">
                      <div className="vital-card-header-left">
                        <div
                          className="vital-card-icon"
                          style={{ background: field.iconBg, color: field.iconColor }}
                        >
                          <IconComponent size={15} />
                        </div>
                        <div className="vital-card-meta">
                          <span className="vital-card-label">{field.label}</span>
                          <span className="vital-instrument-name">{field.instrumentName}</span>
                        </div>
                      </div>
                      <span className="vital-card-ref">{field.refRange}</span>
                    </div>
                    <div className="vital-card-input-wrap">
                      <input
                        className="vital-card-input"
                        value={vitalsForm[field.name] || ""}
                        onChange={(event) => setVitalField(field.name, event.target.value)}
                        placeholder={field.placeholder}
                        inputMode={field.name === "bloodPressure" ? "numeric" : "decimal"}
                      />
                      <span className="vital-card-unit">{field.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Action Buttons */}
            <div className="vital-modal-actions">
              <button
                className="vital-btn-cancel"
                type="button"
                onClick={closeVitals}
                disabled={vitalsSaving}
              >
                <X size={14} /> Cancel
              </button>
              <button
                className="vital-btn-save"
                type="submit"
                disabled={vitalsSaving}
              >
                <HeartPulse size={16} />
                {vitalsSaving ? "Recording Vitals..." : "Save Vitals"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

export default ReceptionAppointmentList;


