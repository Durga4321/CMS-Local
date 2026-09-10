import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import "./ReportsTheme.css";
import "./DailyReport.css";

import {
  Activity,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Download,
  Filter,
  RefreshCw,
  TrendingUp,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../../config/api";
import { getClinicDisplayName } from "../../utils/clinicDisplay";
import { getClinicInvoiceBranding } from "../../utils/clinicBranding";

// ================= APIs =================

const REPORT_API =
  apiUrl("Dashboard/reports/daily-appointments");

const DOCTOR_API =
  apiUrl("Doctor");
const APPOINTMENT_API =
  apiUrl("Appointment");
const APPOINTMENT_OFFLINE_API =
  apiUrl("Appointment/offline");
const APPOINTMENT_ONLINE_API =
  apiUrl("Appointment/online");

const parseList = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const key of ["data", "items", "results", "records", "reports", "appointments"]) {
    if (Array.isArray(value[key])) return value[key];
  }
  return [];
};

const readValue = (record = {}, keys = [], fallback = "") => {
  for (const key of keys) {
    const value = String(key)
      .split(".")
      .reduce((current, part) => (current && current[part] !== undefined ? current[part] : undefined), record);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const normalizeId = (value) => String(value ?? "").trim();

const escapeHtml = (value = "") =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getDoctorId = (doctor = {}) =>
  normalizeId(readValue(doctor, ["id", "Id", "doctorId", "DoctorId", "userId", "UserId"], ""));

const getDoctorName = (doctor = {}) =>
  readValue(doctor, ["name", "Name", "doctorName", "DoctorName", "fullName", "FullName"], "-");

const getAppointmentDate = (appointment = {}) =>
  readValue(appointment, ["appointmentDate", "AppointmentDate", "date", "Date", "visitDate", "VisitDate", "createdAt", "CreatedAt"], "");

const getAppointmentTime = (appointment = {}) =>
  readValue(appointment, ["appointmentTime", "AppointmentTime", "time", "Time", "slotTime", "SlotTime", "startTime", "StartTime"], "-");

const getAppointmentDoctorId = (appointment = {}) =>
  normalizeId(readValue(appointment, ["doctorId", "DoctorId", "doctor.id", "Doctor.Id", "doctor.doctorId", "Doctor.DoctorId"], ""));

const getAppointmentPatientName = (appointment = {}) =>
  readValue(appointment, ["patientName", "PatientName", "patient.name", "Patient.Name", "name", "Name"], "-");

const getAppointmentPhone = (appointment = {}) =>
  readValue(appointment, ["phone", "Phone", "mobile", "Mobile", "patientPhone", "PatientPhone", "patient.phone", "Patient.Phone"], "-");

const getAppointmentStatus = (appointment = {}) =>
  readValue(appointment, ["status", "Status", "appointmentStatus", "AppointmentStatus"], "Booked");

const getAppointmentDoctorName = (appointment = {}, doctors = []) => {
  const directName = readValue(appointment, ["doctorName", "DoctorName", "doctor.name", "Doctor.Name", "doctor.fullName", "Doctor.FullName"], "");
  if (directName) return directName;
  const id = getAppointmentDoctorId(appointment);
  const doctor = doctors.find((item) => getDoctorId(item) === id);
  return doctor ? getDoctorName(doctor) : "-";
};

const isCompletedAppointment = (appointment = {}) =>
  /completed|done|visited|consulted|paid/i.test(String(readValue(appointment, ["status", "Status", "appointmentStatus", "AppointmentStatus"], "")));

const withinDateRange = (appointment = {}, fromDate = "", toDate = "") => {
  const value = getAppointmentDate(appointment);
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return true;
  if (fromDate && date < new Date(`${fromDate}T00:00:00`)) return false;
  if (toDate) {
    const end = new Date(`${toDate}T23:59:59`);
    if (date > end) return false;
  }
  return true;
};

const dayLabel = (value, index = 0) => {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return `Item ${index + 1}`;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const groupAppointmentsByDay = (appointments = [], { doctorId = 0, fromDate = "", toDate = "" } = {}) => {
  const grouped = new Map();
  appointments
    .filter((appointment) => !doctorId || getAppointmentDoctorId(appointment) === String(doctorId))
    .filter((appointment) => withinDateRange(appointment, fromDate, toDate))
    .forEach((appointment, index) => {
      const date = getAppointmentDate(appointment);
      const parsed = new Date(date || "");
      const sortKey = Number.isNaN(parsed.getTime()) ? `unknown-${index}` : parsed.toISOString().slice(0, 10);
      const current = grouped.get(sortKey) || {
        day: dayLabel(date, index),
        sortKey,
        appointments: 0,
        completed: 0,
        records: [],
      };
      current.appointments += 1;
      if (isCompletedAppointment(appointment)) current.completed += 1;
      current.records.push(appointment);
      grouped.set(sortKey, current);
    });
  return Array.from(grouped.values()).sort((left, right) => String(left.sortKey).localeCompare(String(right.sortKey)));
};

const fetchAppointments = async () => {
  const headers = { "ngrok-skip-browser-warning": "true" };
  const results = await Promise.all(
    [APPOINTMENT_API, APPOINTMENT_OFFLINE_API, APPOINTMENT_ONLINE_API].map((url) =>
      fetch(url, { headers })
        .then((response) => (response.ok ? response.json().catch(() => []) : []))
        .catch(() => [])
    )
  );
  const seen = new Set();
  return results.flatMap(parseList).filter((appointment, index) => {
    const key =
      readValue(appointment, ["appointmentId", "AppointmentId", "id", "Id"], "") ||
      `${readValue(appointment, ["patientName", "PatientName", "patient.name"], "patient")}-${getAppointmentDoctorId(appointment)}-${getAppointmentDate(appointment)}-${index}`;
    if (seen.has(String(key))) return false;
    seen.add(String(key));
    return true;
  });
};

// ================= COMPONENT =================

function DailyReport() {
  const navigate = useNavigate();

  const [data, setData] =
    useState([]);

  const [appointmentRecords, setAppointmentRecords] =
    useState([]);

  const [selectedDay, setSelectedDay] =
    useState(null);

  const [doctors, setDoctors] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [fromDate, setFromDate] =
    useState("");

  const [toDate, setToDate] =
    useState("");

  const [doctorId, setDoctorId] =
    useState(0);

  // ================= LOAD DOCTORS =================

  const fetchDoctors = useCallback(async () => {

    try {

      const response = await fetch(
        DOCTOR_API,
        {
          headers: {
            "ngrok-skip-browser-warning":
              "true",
          },
        }
      );

      const result =
        await response.json();

      setDoctors(parseList(result));

    } catch (error) {

      console.log(error);
    }
  }, []);

  const fetchReport = useCallback(async () => {

    try {

      setLoading(true);

      const params = new URLSearchParams();
      if (doctorId) params.set("doctorId", String(doctorId));
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      const url = params.toString() ? `${REPORT_API}?${params.toString()}` : REPORT_API;

      const response = await fetch(
        url,
        {
          headers: {
            "ngrok-skip-browser-warning":
              "true",
          },
        }
      );

      const result =
        await response.json();

      const appointments = await fetchAppointments();
      setAppointmentRecords(appointments);
      const groupedRows = groupAppointmentsByDay(appointments, { doctorId, fromDate, toDate });
      const backendRows = parseList(result);
      if (backendRows.length) {
        setData(backendRows.map((row) => {
          const sortKey = readValue(row, ["sortKey", "date", "Date", "dayDate"], "");
          const day = readValue(row, ["day", "Day", "date", "Date"], "");
          const matchingGroup = groupedRows.find((group) =>
            (sortKey && String(group.sortKey) === String(sortKey).slice(0, 10)) ||
            (day && String(group.day).toLowerCase() === String(day).toLowerCase())
          );
          return matchingGroup ? { ...row, records: matchingGroup.records } : row;
        }));
        return;
      }

      setData(groupedRows);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }, [doctorId, fromDate, toDate]);

  useEffect(() => {
    fetchDoctors();
    fetchReport();
  }, [fetchDoctors, fetchReport]);

  // ================= MAX VALUE =================

  const maxAppointments =
    useMemo(() => {

      if (!data.length)
        return 10;

      return Math.max(
        ...data.map(
          (x) => x.appointments
        ),
        10
      );
    }, [data]);

  const getDayAppointmentRecords = useCallback(
    (row = {}) => {
      if (Array.isArray(row.records) && row.records.length) return row.records;
      return groupAppointmentsByDay(appointmentRecords, { doctorId, fromDate, toDate })
        .find((group) => String(group.sortKey) === String(row.sortKey) || String(group.day) === String(row.day))
        ?.records || [];
    },
    [appointmentRecords, doctorId, fromDate, toDate]
  );

  // ================= TOTALS =================

  const totals = useMemo(() => {
    return data.reduce(
      (sum, row) => ({
        appointments: sum.appointments + Number(row.appointments || 0),
        completed: sum.completed + Number(row.completed || 0),
      }),
      { appointments: 0, completed: 0 }
    );
  }, [data]);

  // ================= EXPORT PDF =================

  const exportPDF = () => {
    const clinicName = getClinicDisplayName(
      {
        clinicName: localStorage.getItem("clinicName"),
        hospitalName: localStorage.getItem("hospitalName"),
        name: localStorage.getItem("clinicName"),
      },
      "Clinic"
    );
    const clinicId = localStorage.getItem("hospitalId") || localStorage.getItem("clinicId") || "";
    const branding = getClinicInvoiceBranding({ clinicId, clinicName });
    const selectedDoctor = doctors.find((doctor) => getDoctorId(doctor) === String(doctorId));
    const generatedAt = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const rowsHtml = data.length
      ? data
          .map(
            (row, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(row.day)}</td>
                <td>${Number(row.appointments || 0)}</td>
                <td>${Number(row.completed || 0)}</td>
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="4" class="empty-row">No appointment data found.</td></tr>`;

    const reportWindow = window.open("", "_blank", "width=980,height=900");
    if (!reportWindow) return;

    reportWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Daily Appointments Report</title>
          <style>
            @page { size: A4; margin: 14mm; }
            body { margin: 0; color: #111827; font-family: Arial, Helvetica, sans-serif; background: #fff; }
            main { max-width: 980px; margin: 0 auto; padding: 24px; box-sizing: border-box; }
            header { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2px solid ${escapeHtml(branding.accentColor)}; padding-bottom: 16px; }
            .brand { display: flex; align-items: center; gap: 14px; }
            .brand img { width: 68px; height: 68px; object-fit: contain; }
            h1 { margin: 0 0 6px; font-size: 27px; }
            p { margin: 4px 0; color: #475569; font-size: 12px; }
            .meta { text-align: right; min-width: 220px; }
            .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 20px 0; }
            .metric { border: 1px solid #dce8ef; border-radius: 10px; padding: 12px 14px; background: #f8fafc; }
            .metric span { display: block; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; }
            .metric b { display: block; margin-top: 6px; font-size: 22px; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            th, td { border: 1px solid #dbe5ec; padding: 10px 12px; font-size: 12px; text-align: left; }
            th { background: #eef6f8; color: #1e293b; text-transform: uppercase; font-size: 11px; }
            td:nth-child(1), td:nth-child(3), td:nth-child(4) { text-align: right; }
            .empty-row { text-align: center !important; color: #64748b; }
            footer { margin-top: 24px; color: #64748b; font-size: 11px; }
            @media print { body { print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <main>
            <header>
              <div class="brand">
                <img src="${escapeHtml(branding.logoUrl)}" alt="Clinic logo" />
                <div>
                  <h1>${escapeHtml(branding.headerTitle || clinicName)}</h1>
                  <p>Daily Appointment Volume and Patient Flow Report</p>
                </div>
              </div>
              <div class="meta">
                <p>Generated: ${escapeHtml(generatedAt)}</p>
                <p>Doctor: ${escapeHtml(selectedDoctor ? getDoctorName(selectedDoctor) : "All doctors")}</p>
                <p>Range: ${escapeHtml(fromDate || "Initial")} to ${escapeHtml(toDate || "Current")}</p>
              </div>
            </header>
            <section class="metrics">
              <div class="metric"><span>Total Appointments</span><b>${totals.appointments}</b></div>
              <div class="metric"><span>Total Completed</span><b>${totals.completed}</b></div>
            </section>
            <table>
              <thead>
                <tr><th>S.No.</th><th>Day</th><th>Appointments</th><th>Completed</th></tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
            <footer>${escapeHtml(branding.footerNote || "Generated from saved appointment records.")}</footer>
          </main>
          <script>window.onload = () => { window.focus(); window.print(); };</script>
        </body>
      </html>
    `);
    reportWindow.document.close();
  };

  return (
    <div className="daily-report">
      {/* MEDICAL & HOSPITALIZED AMBIENT TELEMETRY BACKGROUND */}
      <div className="rep-medical-bg" aria-hidden="true">
        <div className="rep-ecg-track">
          <svg className="rep-ecg-svg" viewBox="0 0 1200 60" preserveAspectRatio="none">
            <path
              className="rep-ecg-line-base"
              d="M0,30 L180,30 L195,12 L205,48 L215,6 L225,40 L235,30 L460,30 L475,10 L485,50 L495,4 L505,42 L515,30 L760,30 L775,12 L785,48 L795,6 L805,40 L815,30 L1020,30 L1035,10 L1045,50 L1055,4 L1065,42 L1075,30 L1200,30"
            />
            <path
              className="rep-ecg-line-pulse"
              d="M0,30 L180,30 L195,12 L205,48 L215,6 L225,40 L235,30 L460,30 L475,10 L485,50 L495,4 L505,42 L515,30 L760,30 L775,12 L785,48 L795,6 L805,40 L815,30 L1020,30 L1035,10 L1045,50 L1055,4 L1065,42 L1075,30 L1200,30"
            />
          </svg>
        </div>
        <div className="rep-watermark-cross rep-watermark-cross--tl">+</div>
        <div className="rep-watermark-cross rep-watermark-cross--br">+</div>
      </div>

      {/* TOP HOSPITAL TELEMETRY HUD BAR */}
      <div className="rep-telemetry-bar">
        <span className="rep-telemetry-badge">
          <span className="rep-telemetry-cross">+</span>
          PATIENT FLOW TELEMETRY
        </span>
        <span className="rep-telemetry-badge">
          <Activity size={12} className="rep-telemetry-wave-icon" />
          SYSTEM ONLINE
          <span className="rep-telemetry-bead-live"></span>
        </span>
      </div>

      {/* HEADER WITH SURGICAL INSTRUMENTS */}
      <div className="header">
        <div className="rep-header-title-group">
          {/* ALL REPORTS NAVIGATION BUTTON */}
          <button
            type="button"
            className="report-back rep-instrument--retractor"
            onClick={() => navigate("/reports")}
            title="Return to Reports"
          >
            <ArrowLeft size={16} />
            <span>All reports</span>
          </button>

          <span className="rep-header-badge">
            <span className="rep-header-badge-pulse">+</span>
            APPOINTMENT VOLUME TELEMETRY
          </span>
          <h1>Daily Appointments</h1>
          <p>Volume of patient bookings, clinical flow, and completed consultations</p>
        </div>

        {/* EXPORT PDF BUTTON */}
        <button
          type="button"
          className="export rep-instrument--recorder"
          onClick={exportPDF}
          title="Export PDF"
        >
          <Download size={15} />
          <span>Export PDF</span>
        </button>
      </div>

      {/* DIAGNOSTIC LABORATORY FILTER PANEL */}
      <div className="filter-card">
        {/* FROM */}
        <div>
          <label>From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        {/* TO */}
        <div>
          <label>To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        {/* DOCTOR WITH ROTATING SYRINGE */}
        <div>
          <label>Doctor</label>
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(Number(e.target.value))}
          >
            <option value={0}>All doctors</option>
            {doctors.map((doctor) => (
              <option
                key={getDoctorId(doctor)}
                value={getDoctorId(doctor)}
              >
                Dr. {getDoctorName(doctor)}
              </option>
            ))}
          </select>
        </div>

        {/* CLEAN PROFESSIONAL APPLY BUTTON */}
        <button
          type="button"
          className="report-apply-clean"
          onClick={fetchReport}
          disabled={loading}
          title="Apply Date & Doctor Filters"
        >
          <Filter size={15} />
          <span>{loading ? "Applying..." : "Apply"}</span>
        </button>
      </div>

      {/* MEDICAL TELEMETRY STAT SUMMARY CARDS */}
      <div className="rep-stats-grid">
        <div className="rep-stat-card">
          <div className="rep-stat-icon-wrap cyan">
            <CalendarDays size={20} />
          </div>
          <div className="rep-stat-info">
            <span className="rep-stat-label">Total Appointments</span>
            <span className="rep-stat-value">{totals.appointments}</span>
          </div>
        </div>

        <div className="rep-stat-card">
          <div className="rep-stat-icon-wrap emerald">
            <CheckCircle2 size={20} />
          </div>
          <div className="rep-stat-info">
            <span className="rep-stat-label">Completed Consultations</span>
            <span className="rep-stat-value">{totals.completed}</span>
          </div>
        </div>

        <div className="rep-stat-card">
          <div className="rep-stat-icon-wrap amber">
            <TrendingUp size={20} />
          </div>
          <div className="rep-stat-info">
            <span className="rep-stat-label">Peak Daily Volume</span>
            <span className="rep-stat-value">{maxAppointments} Max</span>
          </div>
        </div>
      </div>

      {/* HOSPITAL TELEMETRY MONITOR CHART SCREEN */}
      <div className="chart-card">
        <div className="rep-chart-header">
          <div className="rep-chart-title-wrap">
            <div className="rep-chart-title-icon">
              <Activity size={18} />
            </div>
            <h3>Visualization</h3>
          </div>
          <span className="rep-chart-telemetry-status">
            <span className="rep-telemetry-bead-live"></span>
            PATIENT FLOW ACTIVE
          </span>
        </div>

        <div className="chart-container">
          {/* Y AXIS */}
          <div className="y-axis">
            {[maxAppointments, Math.floor(maxAppointments * 0.75), Math.floor(maxAppointments * 0.5), Math.floor(maxAppointments * 0.25), 0]
              .map((n) => (
                <span key={n}>
                  {n}
                </span>
              ))}
          </div>

          {/* BARS */}
          <div className="chart">
            {loading ? (
              <div className="empty">Loading...</div>
            ) : data.length === 0 ? (
              <div className="empty">No appointment data found</div>
            ) : (
              data.map((d, i) => (
                <div key={i} className="bar">
                  <div
                    className="fill"
                    style={{
                      height: `${(d.appointments / maxAppointments) * 220}px`,
                    }}
                  />
                  <span>{d.day}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* CLINICAL MEDICAL AUDIT RECORD TABLE */}
      <div className="table table-card">
        <div className="rep-table-banner">
          <div className="rep-table-banner-title">
            <span>+</span>
            <span>Daily Appointment & Consultation Registry</span>
          </div>
          <span className="rep-table-badge">{data.length} Days Recorded</span>
        </div>

        <div className="thead">
          <span>S.No.</span>
          <span>Day</span>
          <span>Appointments</span>
          <span>Completed</span>
        </div>

        {data.map((d, i) => (
          <div key={i} className="row">
            <span>{i + 1}</span>
            <span>{d.day}</span>
            <span>
              <button
                type="button"
                className="daily-count-btn"
                disabled={!Number(d.appointments || 0)}
                onClick={() => setSelectedDay({ ...d, records: getDayAppointmentRecords(d) })}
                title={`View ${d.appointments || 0} appointments`}
              >
                {d.appointments}
              </button>
            </span>
            <span>{d.completed}</span>
          </div>
        ))}

        {!loading && data.length === 0 && (
          <div className="empty-table">No report data found.</div>
        )}
      </div>

      {selectedDay ? (
        <div className="daily-modal-backdrop" role="presentation" onClick={() => setSelectedDay(null)}>
          <section className="daily-modal" role="dialog" aria-modal="true" aria-label={`${selectedDay.day} appointments`} onClick={(event) => event.stopPropagation()}>
            <div className="daily-modal-header">
              <div>
                <h2>{selectedDay.day} Appointments</h2>
                <p>{selectedDay.records?.length || 0} appointment records</p>
              </div>
              <button type="button" className="daily-modal-close" onClick={() => setSelectedDay(null)} aria-label="Close appointments">
                <X size={18} />
              </button>
            </div>

            <div className="daily-detail-table">
              <div className="daily-detail-head">
                <span>S.No.</span>
                <span>Patient</span>
                <span>Doctor</span>
                <span>Time</span>
                <span>Phone</span>
                <span>Status</span>
              </div>

              {(selectedDay.records || []).map((appointment, index) => (
                <div className="daily-detail-row" key={readValue(appointment, ["appointmentId", "AppointmentId", "id", "Id"], "") || index}>
                  <span>{index + 1}</span>
                  <span>{getAppointmentPatientName(appointment)}</span>
                  <span>Dr. {getAppointmentDoctorName(appointment, doctors)}</span>
                  <span>{getAppointmentTime(appointment)}</span>
                  <span>{getAppointmentPhone(appointment)}</span>
                  <span>{getAppointmentStatus(appointment)}</span>
                </div>
              ))}

              {!selectedDay.records?.length ? (
                <div className="empty-table">No appointment records found for this day.</div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default DailyReport;
