// import React from "react";
// import { useNavigate } from "react-router-dom";
// import { Download } from "lucide-react";
// import "./DailyReport.css";

// function DailyReport() {
//   const navigate = useNavigate();

//   const data = [
//     { day: "Mon", total: 24, completed: 20 },
//     { day: "Tue", total: 31, completed: 26 },
//     { day: "Wed", total: 28, completed: 24 },
//     { day: "Thu", total: 36, completed: 31 },
//     { day: "Fri", total: 41, completed: 35 },
//     { day: "Sat", total: 22, completed: 19 },
//     { day: "Sun", total: 9, completed: 8 },
//   ];

//   return (
//     <div className="daily-report">

//       {/* BACK */}
//       <button className="back" onClick={() => navigate("/reports")}>
//         ← All reports
//       </button>

//       {/* HEADER */}
//       <div className="header">
//         <div>
//           <h1>Daily Appointments</h1>
//           <p>Volume of appointments per day</p>
//         </div>

//         <button className="export">
//           <Download size={16} /> Export CSV
//         </button>
//       </div>

//       {/* FILTERS */}
//       <div className="filters">

//         <div className="field">
//           <label>From</label>
//           <input type="date" />
//         </div>

//         <div className="field">
//           <label>To</label>
//           <input type="date" />
//         </div>

//         <div className="field">
//           <label>Doctor</label>
//           <select>
//             <option>All doctors</option>
//           </select>
//         </div>

//         <button className="apply">Apply</button>
//       </div>

//       {/* CHART */}
//      {/* VISUALIZATION CARD */}
// <div className="chart-card">

 

//   <div className="chart-container">


//     {/* Y AXIS */}
//     <div className="y-axis">
//        <h3>Visualization</h3>
//       {[60, 45, 30, 15, 0].map((n) => (
//         <span key={n}>{n}</span>
//       ))}
//     </div>

//     {/* BARS */}
//     <div className="chart">
//       {data.map((d, i) => (
//         <div key={i} className="bar">
//           <div
//             className="fill"
//             style={{ height: `${d.total * 2}px` }}
//           />
//           <span>{d.day}</span>
//         </div>
//       ))}
//     </div>

//   </div>

// </div>

//       {/* TABLE */}
//       <div className="table">

//         <div className="thead">
//           <span>Day</span>
//           <span>Appointments</span>
//           <span>Completed</span>
//         </div>

//         {data.map((d, i) => (
//           <div key={i} className="row">
//             <span>{d.day}</span>
//             <span>{d.total}</span>
//             <span>{d.completed}</span>
//           </div>
//         ))}

//       </div>

//     </div>
//   );
// }

// export default DailyReport;



import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  X,
  Download,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import "./DailyReport.css";
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
    const totals = data.reduce(
      (sum, row) => ({
        appointments: sum.appointments + Number(row.appointments || 0),
        completed: sum.completed + Number(row.completed || 0),
      }),
      { appointments: 0, completed: 0 }
    );
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
            .metric { border: 1px solid #dbe7ee; border-radius: 10px; padding: 13px; background: #f8fafc; }
            .metric span { display: block; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; }
            .metric b { display: block; margin-top: 7px; font-size: 22px; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            th, td { border: 1px solid #d7e1ea; padding: 10px; text-align: left; font-size: 12px; }
            th { background: #e8f7f5; color: #0f172a; text-transform: uppercase; font-size: 11px; }
            td:nth-child(1), td:nth-child(3), td:nth-child(4) { text-align: right; }
            .empty-row { text-align: center !important; color: #64748b; }
            footer { margin-top: 24px; color: #64748b; font-size: 11px; text-align: center; }
            @media print { main { padding: 0; } body { print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <main>
            <header>
              <div class="brand">
                <img src="${escapeHtml(branding.logoUrl)}" alt="Clinic logo" />
                <div>
                  <h1>${escapeHtml(branding.headerTitle || clinicName)}</h1>
                  <p>Daily Appointments Report</p>
                  <p>Volume of appointments per day</p>
                </div>
              </div>
              <div class="meta">
                <p>Generated: ${escapeHtml(generatedAt)}</p>
                <p>Doctor: ${escapeHtml(selectedDoctor ? `Dr. ${getDoctorName(selectedDoctor)}` : "All doctors")}</p>
                <p>Period: ${escapeHtml(fromDate || "Start")} to ${escapeHtml(toDate || "Today")}</p>
              </div>
            </header>
            <section class="metrics">
              <div class="metric"><span>Total Appointments</span><b>${totals.appointments}</b></div>
              <div class="metric"><span>Completed</span><b>${totals.completed}</b></div>
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

      {/* HEADER */}

      <div className="header">

        <div>

          <button
            type="button"
            className="report-back"
            onClick={() => navigate("/reports")}
          >
            <ArrowLeft size={16} />
            All reports
          </button>

          <h1>
            Daily Appointments
          </h1>

          <p>
            Volume of appointments per day
          </p>

        </div>

        <button
          className="export"
          onClick={exportPDF}
        >

          <Download size={16} />

          Export PDF

        </button>

      </div>

      {/* FILTERS */}

      <div className="filters">

        {/* FROM */}

        <div className="field">

          <label>From</label>

          <input
            type="date"
            value={fromDate}
            onChange={(e) =>
              setFromDate(
                e.target.value
              )
            }
          />

        </div>

        {/* TO */}

        <div className="field">

          <label>To</label>

          <input
            type="date"
            value={toDate}
            onChange={(e) =>
              setToDate(
                e.target.value
              )
            }
          />

        </div>

        {/* DOCTOR */}

        <div className="field">

          <label>Doctor</label>

          <select
            value={doctorId}
            onChange={(e) =>
              setDoctorId(
                Number(
                  e.target.value
                )
              )
            }
          >

            <option value={0}>
              All doctors
            </option>

            {doctors.map(
              (doctor) => (

                <option
                  key={getDoctorId(doctor)}
                  value={getDoctorId(doctor)}
                >

                  Dr. {getDoctorName(doctor)}

                </option>
              )
            )}

          </select>

        </div>

        {/* APPLY */}

        <button
          type="button"
          className="report-apply"
          onClick={fetchReport}
        >

          Apply

        </button>

      </div>

      {/* CHART */}

      <div className="chart-card">

        <div className="chart-container">

          {/* Y AXIS */}

          <div className="y-axis">

            <h3>
              Visualization
            </h3>

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

              <div className="empty">
                Loading...
              </div>

            ) : data.length === 0 ? (

              <div className="empty">
                No appointment data found
              </div>

            ) : (

              data.map((d, i) => (

                <div
                  key={i}
                  className="bar"
                >

                  <div
                    className="fill"
                    style={{
                      height: `${(d.appointments / maxAppointments) * 220}px`,
                    }}
                  />

                  <span>
                    {d.day}
                  </span>

                </div>
              ))
            )}

          </div>

        </div>

      </div>

      {/* TABLE */}

      <div className="table">

        <div className="thead">

          <span>S.No.</span>

          <span>Day</span>

          <span>Appointments</span>

          <span>Completed</span>

        </div>

        {data.map((d, i) => (

          <div
            key={i}
            className="row"
          >
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

            <span>
              {d.completed}
            </span>

          </div>
        ))}

        {!loading &&
          data.length === 0 && (

          <div className="empty-table">
            No report data found.
          </div>

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
