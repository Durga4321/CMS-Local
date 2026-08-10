import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, History, Plus, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "../../components/ToastProvider";
import { formatDateMMDDYYYY } from "../../utils/dateFormat";
import { applyTimeOrderedTokens, filterAppointments, getAppointmentValue, getBookingType } from "./appointmentListUtils";
import { getReceptionistScope, scopeReceptionistRecords } from "../receptionScope";
import { requestJson as defaultRequestJson } from "../receptionApi";
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
  { name: "bloodPressure", label: "BP", unit: "mmHg", placeholder: "120/80" },
  { name: "sugarLevel", label: "Sugar Level", unit: "mg/dL", placeholder: "100" },
  { name: "temperature", label: "Temperature", unit: "F", placeholder: "98.6" },
  { name: "weight", label: "Weight", unit: "kg", placeholder: "70" },
  { name: "pulseRate", label: "PBRM", unit: "bpm", placeholder: "72" },
  { name: "respiratoryRate", label: "SpO2", unit: "%", placeholder: "98" },
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
    <section className="rc-page">
      <div className="rc-page-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {!hideActions && (
          <div className="rc-head-actions">
            <button className="rc-btn ghost" onClick={loadAppointments} type="button">
              <RefreshCw size={16} /> Refresh
            </button>
            <button className="rc-btn" onClick={() => navigate(`${basePath}/appointments`)} type="button">
              <ArrowLeft size={16} /> Back
            </button>
          </div>
        )}
      </div>

      {error ? <div className="rc-alert error">{error}</div> : null}

      <div className="rc-card">
        <div className="rc-card-head">
          <div>
            <h3>{appointmentListView === "past" ? `Past ${title}` : `Today ${title}`}</h3>
            <p>Search, filter, and review {bookingType.toLowerCase()} appointments.</p>
          </div>
          <div className="rc-patient-list-tabs" role="tablist" aria-label="Appointment list view">
            <button
              type="button"
              className={appointmentListView === "today" ? "active" : ""}
              onClick={() => setAppointmentListView("today")}
              role="tab"
              aria-selected={appointmentListView === "today"}
            >
              <CalendarDays size={16} /> Today
              <span>{todayAppointmentCount}</span>
            </button>
            <button
              type="button"
              className={appointmentListView === "past" ? "active" : ""}
              onClick={() => setAppointmentListView("past")}
              role="tab"
              aria-selected={appointmentListView === "past"}
            >
              <History size={16} /> Past
              <span>{pastAppointmentCount}</span>
            </button>
          </div>
        </div>

        <div className="rc-filter-grid">
          <label className="rc-filter-field">
            <span>
              <Search size={14} /> Search
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Patient name, code, token"
            />
          </label>
          <label className="rc-filter-field">
            <span>
              <SlidersHorizontal size={14} /> Doctor
            </span>
            <select value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value)}>
              <option value="All">All doctors</option>
              {doctorOptions.map((doctor) => (
                <option key={doctor} value={doctor}>
                  {doctor}
                </option>
              ))}
            </select>
          </label>
          <label className="rc-filter-field">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="All">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="rc-filter-field">
            <span>Date</span>
            <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          </label>
        </div>

        {loading ? (
          <div className="rc-empty">Loading appointments...</div>
        ) : visibleAppointments.length === 0 ? (
          <div className="rc-empty">{emptyState}</div>
        ) : (
          <>
            <div className="rc-table-wrap">
              <table className="rc-table-data">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Patient Code</th>
                    <th>Patient Name</th>
                    <th>Doctor Name</th>
                    <th>Specialization</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Chief Complaint</th>
                    <th>Phone</th>
                    <th>Payment</th>
                    <th>Booking Type</th>
                    <th>Status</th>
                    <th>Vitals</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAppointments.map((item, index) => (
                    <tr key={getAppointmentRowKey(item, index)}>
                      <td>{getAppointmentValue(item, ["displayTokenNumber", "orderedTokenNumber", "tokenNumber", "token", "TokenNumber", "tokenNo", "token_number"], "-")}</td>
                      <td>{getAppointmentValue(item, ["patientCode", "patient.code", "patient.patientCode", "PatientCode"], "-")}</td>
                      <td>{getAppointmentValue(item, ["patientName", "patient.name", "patient.fullName", "PatientName"], "-")}</td>
                      <td>{getAppointmentValue(item, ["doctorName", "doctor.name", "doctor.fullName", "DoctorName"], "-")}</td>
                      <td>{getSpecializationDisplayName(getAppointmentValue(item, ["doctorSpecialization", "doctor.specialization", "doctorSpeciality", "DoctorSpecialization", "specialization"], "")) || "-"}</td>
                      <td>{formatDateMMDDYYYY(getAppointmentValue(item, ["date", "appointmentDate", "AppointmentDate", "scheduledDate", "slotDate", "SlotDate", "bookingDate", "BookingDate"], ""))}</td>
                      <td>{getAppointmentValue(item, ["time", "slot", "Slot", "startTime", "StartTime", "slotTime", "SlotTime", "timeSlot", "TimeSlot", "appointmentTime", "AppointmentTime"], "-")}</td>
                      <td>{getAppointmentValue(item, ["chiefComplaint", "chiefComplaints", "ChiefComplaint", "complaint", "reason"], "-")}</td>
                      <td>{getAppointmentValue(item, ["phoneNumber", "mobileNumber", "patient.phoneNumber", "patient.mobileNumber", "patient.phone", "PhoneNumber"], "-")}</td>
                      <td>{getAppointmentValue(item, ["paymentStatus", "PaymentStatus", "payment.status", "billing.paymentStatus"], "-")}</td>
                      <td>{getBookingType(item)}</td>
                      <td>{getAppointmentValue(item, ["status", "appointmentStatus", "AppointmentStatus", "Status"], "-")}</td>
                      <td>
                        <button
                          className="rc-icon-btn"
                          type="button"
                          aria-label="Add vitals"
                          title="Add vitals"
                          onClick={() => openVitals(item)}
                        >
                          <Plus size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
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
        <div className="rc-modal-backdrop">
          <form className="rc-card rc-modal-compact" onSubmit={saveVitals}>
            <div className="rc-modal-header">
              <div>
                <h3>Appointment Vitals</h3>
                <p>
                  {getAppointmentValue(vitalsAppointment, ["patientName", "patient.name", "PatientName"], "-")}
                </p>
              </div>
              <button className="rc-modal-close" type="button" onClick={closeVitals}>
                <X size={18} />
              </button>
            </div>
            <div className="rc-form-grid">
              {vitalFields.map((field) => (
                <label key={field.name}>
                  <span>{field.label}</span>
                  <input
                    value={vitalsForm[field.name] || ""}
                    onChange={(event) => setVitalField(field.name, event.target.value)}
                    placeholder={field.placeholder}
                    inputMode={field.name === "bloodPressure" ? "numeric" : "decimal"}
                  />
                  <small>{field.unit}</small>
                </label>
              ))}
            </div>
            <div className="rc-modal-actions">
              <button className="rc-btn ghost" type="button" onClick={closeVitals} disabled={vitalsSaving}>
                Cancel
              </button>
              <button className="rc-btn primary" type="submit" disabled={vitalsSaving}>
                {vitalsSaving ? "Saving..." : "Save Vitals"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

export default ReceptionAppointmentList;
