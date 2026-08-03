// import React from "react";
// import "./DoctorWiseReport.css";
// import { ArrowLeft, Download } from "lucide-react";
// import {
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   Tooltip,
//   ResponsiveContainer,
//   CartesianGrid,
// } from "recharts";

// const data = [
//   { day: "Mon", value: 22 },
//   { day: "Tue", value: 31 },
//   { day: "Wed", value: 28 },
//   { day: "Thu", value: 36 },
//   { day: "Fri", value: 40 },
//   { day: "Sat", value: 20 },
//   { day: "Sun", value: 10 },
// ];

// const tableData = [
//   { name: "Dr. Sarah Mitchell", spec: "Cardiology", app: 40, revenue: "$7,200" },
//   { name: "Dr. Rajesh Kumar", spec: "Pediatrics", app: 47, revenue: "$4,230" },
//   { name: "Dr. Emily Chen", spec: "Dermatology", app: 54, revenue: "$6,480" },
//   { name: "Dr. Marcus Johnson", spec: "Orthopedics", app: 61, revenue: "$12,200" },
//   { name: "Dr. Priya Sharma", spec: "Gynecology", app: 68, revenue: "$10,200" },
//   { name: "Dr. Ahmed Hassan", spec: "Neurology", app: 75, revenue: "$16,500" },
// ];

// function DoctorWiseReport() {
//   return (
//     <div className="report-page">

//       {/* HEADER */}
//       <div className="report-header">
//         <div>
//           <button className="back">
//             <ArrowLeft size={16}/> All reports
//           </button>
//           <h2>Doctor-wise Report</h2>
//           <p>Performance per doctor</p>
//         </div>

//         <button className="export">
//           <Download size={16}/> Export CSV
//         </button>
//       </div>

//       {/* FILTER */}
//       <div className="filter-card">
//         <div>
//           <label>From</label>
//           <input type="date" defaultValue="2026-04-01"/>
//         </div>

//         <div>
//           <label>To</label>
//           <input type="date" defaultValue="2026-04-21"/>
//         </div>

//         <div>
//           <label>Doctor</label>
//           <select>
//             <option>All doctors</option>
//           </select>
//         </div>

//         <button className="apply">Apply</button>
//       </div>

//       {/* CHART */}
//       <div className="chart-card">
//         <h3>Visualization</h3>

//         <ResponsiveContainer width="100%" height={300}>
//           <BarChart data={data}>
//             <CartesianGrid strokeDasharray="3 3" />

//             <XAxis dataKey="day"/>
//             <YAxis />

//             <Tooltip
//               cursor={{ fill: "rgba(0,0,0,0.05)" }}
//               contentStyle={{
//                 borderRadius: "10px",
//                 border: "1px solid #e5e7eb",
//               }}
//               formatter={(value) => [`${value} appointments`, "Count"]}
//             />

//             <Bar
//               dataKey="value"
//               fill="#0d9488"
//               radius={[8, 8, 0, 0]}
//             />
//           </BarChart>
//         </ResponsiveContainer>
//       </div>

//       {/* TABLE */}
//       <div className="table-card">
//         <div className="thead">
//           <span>Doctor</span>
//           <span>Specialization</span>
//           <span>Appointments</span>
//           <span>Revenue</span>
//         </div>

//         {tableData.map((d, i) => (
//           <div className="row" key={i}>
//             <span>{d.name}</span>
//             <span>{d.spec}</span>
//             <span>{d.app}</span>
//             <span>{d.revenue}</span>
//           </div>
//         ))}
//       </div>

//     </div>
//   );
// }

// export default DoctorWiseReport;


import React,
{
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import "./DoctorWiseReport.css";

import {
  ArrowLeft,
  Download,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import { apiUrl } from "../../config/api";
import { getApiHeaders } from "../../utils/branchApi";
import {
  appointmentToOpRevenueRow,
  dedupeBillingRows,
  getBillingType,
  getMonthLabel,
  getMonthSortKey,
  getRevenueAmount,
  getRowDate,
  isPaidAppointment,
  parseList,
  pick,
} from "../../utils/billingRevenue";
import { formatIndianCurrency } from "../../utils/format";

// ================= APIs =================

const DOCTOR_API =
  apiUrl("Doctor");
const BILLING_API =
  apiUrl("Billing");
const APPOINTMENT_API =
  apiUrl("Appointment");

const normalizeId = (value) => String(value ?? "").trim();

const getDoctorId = (doctor = {}) =>
  normalizeId(doctor.id ?? doctor.Id ?? doctor.doctorId ?? doctor.DoctorId);

const getDoctorName = (doctor = {}) =>
  String(doctor.name ?? doctor.Name ?? doctor.doctorName ?? doctor.DoctorName ?? "").trim();

const getDoctorSpecialization = (doctor = {}) =>
  String(doctor.specialization ?? doctor.Specialization ?? "-").trim() || "-";

const getRowDoctorId = (row = {}) =>
  normalizeId(pick(row, ["doctorId", "DoctorId", "doctor.id", "Doctor.Id", "doctor.doctorId", "Doctor.DoctorId"], ""));

const getRowDoctorName = (row = {}) =>
  String(pick(row, ["doctorName", "DoctorName", "doctor.name", "Doctor.Name", "doctor", "Doctor"], "")).trim();

const getRowSpecialization = (row = {}) =>
  String(pick(row, ["specialization", "Specialization", "doctor.specialization", "Doctor.Specialization"], "-")).trim() || "-";

const fetchJsonOrEmpty = async (url, headers) => {
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) return [];
    return await response.json().catch(() => []);
  } catch {
    return [];
  }
};

const fetchBillingRows = async ({ fromDate, toDate, doctorId, headers }) => {
  const params = new URLSearchParams();
  if (doctorId) params.set("doctorId", String(doctorId));
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  params.set("pageSize", "10000");
  params.set("limit", "10000");
  params.set("includeAll", "true");
  params.set("all", "true");

  const query = params.toString();
  const urls = [
    `${BILLING_API}?${query}`,
    apiUrl(`Billing/all?${query}`),
    apiUrl(`Billing/history?${query}`),
  ];

  const responses = await Promise.all(urls.map((url) => fetchJsonOrEmpty(url, headers)));
  return dedupeBillingRows(responses.flatMap(parseList));
};

const withinDateRange = (row = {}, fromDate = "", toDate = "") => {
  const value = getRowDate(row);
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return true;
  if (fromDate && date < new Date(fromDate)) return false;
  if (toDate) {
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    if (date > end) return false;
  }
  return true;
};

const groupDoctorRevenue = (rows = [], doctors = [], selectedDoctorId = "") => {
  const doctorLookup = doctors.reduce((lookup, doctor) => {
    const id = getDoctorId(doctor);
    if (id) {
      lookup[id] = {
        doctorId: id,
        doctorName: getDoctorName(doctor),
        specialization: getDoctorSpecialization(doctor),
      };
    }
    return lookup;
  }, {});

  const grouped = new Map();
  rows.forEach((row, index) => {
    if (getBillingType(row) !== "op") return;
    const rowDoctorId = getRowDoctorId(row);
    if (selectedDoctorId && rowDoctorId && rowDoctorId !== String(selectedDoctorId)) return;
    const doctor = doctorLookup[rowDoctorId] || {};
    const doctorName = doctor.doctorName || getRowDoctorName(row) || "Unknown Doctor";
    if (selectedDoctorId && !rowDoctorId && doctorName === "Unknown Doctor") return;
    const date = getRowDate(row);
    const month = getMonthLabel(date, index);
    const monthSort = getMonthSortKey(date);
    const key = `${monthSort}|${rowDoctorId || doctorName}`;
    const current = grouped.get(key) || {
      month,
      monthSort,
      doctorId: rowDoctorId,
      doctorName,
      chartLabel: `${doctorName} ${month}`,
      specialization: doctor.specialization || getRowSpecialization(row),
      appointments: 0,
      revenue: 0,
    };
    current.appointments += 1;
    current.revenue += getRevenueAmount(row);
    grouped.set(key, current);
  });

  return Array.from(grouped.values()).sort((left, right) => {
    const monthCompare = String(left.monthSort).localeCompare(String(right.monthSort));
    if (monthCompare) return monthCompare;
    return String(left.doctorName).localeCompare(String(right.doctorName));
  });
};

// ================= COMPONENT =================

function DoctorWiseReport() {
  const navigate = useNavigate();

  const [data, setData] =
    useState([]);

  const [doctors, setDoctors] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [fromDate, setFromDate] =
    useState("");

  const [toDate, setToDate] =
    useState("");

  const [doctorId, setDoctorId] =
    useState("");
  const doctorsRef = useRef([]);

  useEffect(() => {
    doctorsRef.current = doctors;
  }, [doctors]);

  // ================= LOAD =================

  const fetchDoctors = useCallback(
    async () => {

      try {

        const response =
          await fetch(DOCTOR_API, {
            headers: getApiHeaders(),
          });

        const result =
          await response.json();

        const nextDoctors = parseList(result);
        doctorsRef.current = nextDoctors;
        setDoctors(nextDoctors);

      } catch (error) {

        console.log(error);
      }
    },
    []
  );

  const fetchReport = useCallback(
    async () => {

      try {

        setLoading(true);

        const headers = getApiHeaders();
        const [billingRows, appointmentResult] = await Promise.all([
          fetchBillingRows({ fromDate, toDate, doctorId, headers }),
          fetchJsonOrEmpty(APPOINTMENT_API, headers),
        ]);
        const paidAppointmentRows = parseList(appointmentResult)
          .filter(isPaidAppointment)
          .filter((row) => withinDateRange(row, fromDate, toDate))
          .map(appointmentToOpRevenueRow);
        const opRows = dedupeBillingRows([
          ...billingRows,
          ...paidAppointmentRows,
        ]).filter((row) => withinDateRange(row, fromDate, toDate));

        setData(groupDoctorRevenue(opRows, doctorsRef.current, doctorId));
      } catch (error) {
        console.log(error);
        setData([]);
      } finally {
        setLoading(false);
      }
    },
    [doctorId, fromDate, toDate]
  );

  useEffect(() => {

    let isMounted = true;
    const loadInitialData = async () => {
      await fetchDoctors();
      if (isMounted) await fetchReport();
    };
    loadInitialData();
    return () => {
      isMounted = false;
    };

  }, []);

  // ================= EXPORT PDF =================

  const exportPDF = () => {
    const generatedAt = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const selectedDoctor = doctors.find((doctor) => getDoctorId(doctor) === String(doctorId));
    const totals = data.reduce(
      (sum, row) => ({
        appointments: sum.appointments + Number(row.appointments || 0),
        revenue: sum.revenue + Number(row.revenue || 0),
      }),
      { appointments: 0, revenue: 0 }
    );
    const rowsHtml = data.length
      ? data
          .map(
            (row, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${row.month}</td>
                <td>${row.doctorName}</td>
                <td>${row.specialization}</td>
                <td>${row.appointments}</td>
                <td>${formatIndianCurrency(row.revenue)}</td>
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="6" class="empty-row">No OP billing data found.</td></tr>`;

    const reportWindow = window.open("", "_blank", "width=980,height=900");
    if (!reportWindow) return;

    reportWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Doctor-wise OP Revenue Report</title>
          <style>
            body { margin: 0; background: #f5f7fb; color: #111827; font-family: Arial, sans-serif; }
            main { max-width: 1100px; margin: 0 auto; background: #fff; min-height: 100vh; padding: 32px; box-sizing: border-box; }
            header { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2px solid #0f9d9d; padding-bottom: 18px; }
            h1 { margin: 0 0 8px; font-size: 28px; }
            p { margin: 4px 0; color: #475569; }
            .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin: 22px 0; }
            .metric { border: 1px solid #dbe7ee; border-radius: 10px; padding: 14px; }
            .metric span { display: block; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
            .metric b { display: block; margin-top: 7px; font-size: 22px; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            th, td { border: 1px solid #e2e8f0; padding: 11px 10px; text-align: left; }
            th { background: #edf4f7; color: #334155; }
            td:nth-child(1), td:nth-child(5), td:nth-child(6) { text-align: right; }
            .empty-row { text-align: center !important; color: #64748b; }
            footer { margin-top: 24px; color: #64748b; font-size: 12px; }
            @media print { body { background: #fff; } main { padding: 0; } }
          </style>
        </head>
        <body>
          <main>
            <header>
              <div>
                <h1>Doctor-wise OP Revenue Report</h1>
                <p>Monthly doctor revenue based on paid OP bills.</p>
              </div>
              <div>
                <p>Generated: ${generatedAt}</p>
                <p>Doctor: ${selectedDoctor ? getDoctorName(selectedDoctor) : "All doctors"}</p>
                <p>Period: ${fromDate || "Start"} to ${toDate || "Today"}</p>
              </div>
            </header>
            <section class="metrics">
              <div class="metric"><span>Total OP Appointments</span><b>${totals.appointments}</b></div>
              <div class="metric"><span>Total OP Revenue</span><b>${formatIndianCurrency(totals.revenue)}</b></div>
            </section>
            <table>
              <thead>
                <tr><th>S.No.</th><th>Month</th><th>Doctor</th><th>Specialization</th><th>OP Bills</th><th>OP Revenue</th></tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
            <footer>This report is generated from saved backend OP billing records.</footer>
          </main>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);
    reportWindow.document.close();
  };


  return (
    <div className="report-page doctor-wise-report-page">

      {/* HEADER */}

      <div className="report-header">

        <div>

          <button
            type="button"
            className="report-back"
            onClick={() => navigate("/reports")}
          >
            <ArrowLeft size={16} />
            All reports
          </button>

          <h2>
            Doctor-wise Report
          </h2>

          <p>
            Performance per doctor
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

      {/* FILTER */}

      <div className="filter-card">

        <div>

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

        <div>

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

        <div>

          <label>Doctor</label>

          <select
            value={doctorId}
            onChange={(e) =>
              setDoctorId(
                e.target.value
              )
            }
          >

            <option value="">
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

        <h3>
          Doctor Performance
        </h3>

        {loading ? (

          <div className="empty">
            Loading...
          </div>

        ) : data.length === 0 ? (

          <div className="empty">
            No report data found
          </div>

        ) : (

          <ResponsiveContainer
            width="100%"
            height={320}
          >

            <BarChart
              data={data}
              barCategoryGap={80}
            >

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
              />

              <XAxis
                dataKey={doctorId ? "month" : "chartLabel"}
                tick={{
                  fontSize: 14,
                }}
              />

              <YAxis
                allowDecimals={false}
              />

              <Tooltip
                cursor={{
                  fill:
                    "rgba(0,0,0,0.04)",
                }}
                contentStyle={{
                  borderRadius:
                    "12px",
                  border:
                    "1px solid #e5e7eb",
                }}
                formatter={(
                  value
                ) => [
                    formatIndianCurrency(value),
                    "OP Revenue",
                  ]}
              />

              <Bar
                dataKey="revenue"

                fill="#159a8c"

                radius={[
                  10,
                  10,
                  0,
                  0,
                ]}

                maxBarSize={120}
              />

            </BarChart>

          </ResponsiveContainer>

        )}

      </div>

      {/* TABLE */}

      <div className="table-card">

        <div className="thead">

          <span>S.No.</span>

          <span>Doctor</span>

          <span>Specialization</span>

          <span>Month</span>

          <span>OP Bills</span>

          <span>OP Revenue</span>

        </div>

        {data.map((d, i) => (

          <div
            className="row"
            key={i}
          >
            <span>{i + 1}</span>

            <span>
              Dr. {d.doctorName}
            </span>

            <span>
              {d.specialization}
            </span>

            <span>
              {d.month}
            </span>

            <span>
              {d.appointments}
            </span>

            <span>
              {formatIndianCurrency(d.revenue)}
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

    </div>
  );
}

export default DoctorWiseReport;
