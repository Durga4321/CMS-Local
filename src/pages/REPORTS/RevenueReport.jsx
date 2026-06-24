// import React, { useEffect, useState } from "react";

// import "./RevenueReport.css";

// import { ArrowLeft, Download } from "lucide-react";

// import {
//   LineChart,
//   Line,
//   XAxis,
//   YAxis,
//   Tooltip,
//   ResponsiveContainer,
//   CartesianGrid,
// } from "recharts";

// import { useNavigate } from "react-router-dom";

// // ================= APIs =================

// const REPORT_API =
//   "/api/Report/revenue";

// const DOCTOR_API =
//   "/api/Doctor";

// // ================= COMPONENT =================

// function RevenueReport() {
//   const navigate = useNavigate();

//   const [data, setData] = useState([]);

//   const [doctors, setDoctors] = useState([]);

//   const [loading, setLoading] = useState(false);

//   const [fromDate, setFromDate] = useState("");

//   const [toDate, setToDate] = useState("");

//   const [doctorId, setDoctorId] = useState(0);

//   // ================= LOAD =================

//   useEffect(() => {
//     fetchDoctors();

//     fetchRevenue();
//   }, []);

//   // ================= DOCTORS =================

//   const fetchDoctors = async () => {
//     try {
//       const response = await fetch(DOCTOR_API, {
//         headers: {
//           "ngrok-skip-browser-warning": "true",
//         },
//       });

//       const result = await response.json();

//       setDoctors(result);
//     } catch (error) {
//       console.log(error);
//     }
//   };

//   // ================= REVENUE =================

//   const fetchRevenue = async () => {
//     try {
//       setLoading(true);

//       let url = `${REPORT_API}?doctorId=${doctorId}`;

//       if (fromDate) {
//         url += `&fromDate=${fromDate}`;
//       }

//       if (toDate) {
//         url += `&toDate=${toDate}`;
//       }

//       const response = await fetch(url, {
//         headers: {
//           "ngrok-skip-browser-warning": "true",
//         },
//       });

//       const result = await response.json();

//       console.log("REVENUE:", result);

//       setData(result);
//     } catch (error) {
//       console.log(error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ================= CSV =================

//   const exportCSV = () => {
//     const rows = [
//       ["Month", "Revenue", "Growth"],

//       ...data.map((x) => [x.month, x.revenue, x.growth]),
//     ];

//     const csvContent = rows.map((e) => e.join(",")).join("\n");

//     const blob = new Blob([csvContent], {
//       type: "text/csv",
//     });

//     const url = window.URL.createObjectURL(blob);

//     const a = document.createElement("a");

//     a.href = url;

//     a.download = "revenue-report.csv";

//     a.click();
//   };

//   return (
//     <div className="report-page">
//       {/* HEADER */}

//       <div className="report-header">
//         <div>
//           <button className="back" onClick={() => navigate("/reports")}>
//             <ArrowLeft size={16} />
//             All reports
//           </button>

//           <h2>Revenue Report</h2>

//           <p>Earnings, refunds, net revenue</p>
//         </div>

//         <button className="export" onClick={exportCSV}>
//           <Download size={16} />
//           Export CSV
//         </button>
//       </div>

//       {/* FILTER */}

//       <div className="filter-card">
//         {/* FROM */}

//         <div>
//           <label>From</label>

//           <input
//             type="date"
//             value={fromDate}
//             onChange={(e) => setFromDate(e.target.value)}
//           />
//         </div>

//         {/* TO */}

//         <div>
//           <label>To</label>

//           <input
//             type="date"
//             value={toDate}
//             onChange={(e) => setToDate(e.target.value)}
//           />
//         </div>

//         {/* DOCTOR */}

//         <div>
//           <label>Doctor</label>

//           <select
//             value={doctorId}
//             onChange={(e) => setDoctorId(Number(e.target.value))}
//           >
//             <option value={0}>All doctors</option>

//             {doctors.map((doctor) => (
//               <option key={doctor.id} value={doctor.id}>
//                 Dr. {doctor.name}
//               </option>
//             ))}
//           </select>
//         </div>

//         {/* APPLY */}

//         <button className="apply" onClick={fetchRevenue}>
//           Apply
//         </button>
//       </div>

//       {/* CHART */}

//       <div className="chart-card">
//         <h3>Revenue Visualization</h3>

//         {loading ? (
//           <div className="empty">Loading...</div>
//         ) : data.length === 0 ? (
//           <div className="empty">No revenue data found</div>
//         ) : (
//           <ResponsiveContainer width="100%" height={320}>
//             <LineChart data={data}>
//               <CartesianGrid strokeDasharray="3 3" />

//               <XAxis dataKey="month" />

//               <YAxis />

//               <Tooltip
//                 contentStyle={{
//                   borderRadius: "10px",
//                   border: "1px solid #e5e7eb",
//                 }}
//                 formatter={(value) => [`₹${value}`, "Revenue"]}
//               />

//               <Line
//                 type="monotone"
//                 dataKey="revenue"
//                 stroke="#159a8c"
//                 strokeWidth={3}
//                 dot={{ r: 5 }}
//               />
//             </LineChart>
//           </ResponsiveContainer>
//         )}
//       </div>

//       {/* TABLE */}

//       <div className="table-card">
//         <div className="thead">
//           <span>Month</span>

//           <span>Revenue</span>

//           <span>Growth</span>
//         </div>

//         {data.map((d, i) => (
//           <div className="row" key={i}>
//             <span>{d.month}</span>

//             <span>₹{d.revenue?.toLocaleString()}</span>

//             <span className="growth">{d.growth}%</span>
//           </div>
//         ))}

//         {!loading && data.length === 0 && (
//           <div className="empty-table">No revenue data found.</div>
//         )}
//       </div>
//     </div>
//   );
// }

// export default RevenueReport;

import React, { useCallback, useEffect, useState } from "react";

import "./RevenueReport.css";

import { ArrowLeft, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import { apiUrl } from "../../config/api";
import { formatIndianCurrency } from "../../utils/format";

// ================= API =================

const REPORT_API =
  apiUrl("Report/revenue");

const DOCTOR_API =
  apiUrl("Doctor");

const BILLING_API =
  apiUrl("Billing");

const parseList = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  for (const key of ["data", "items", "results", "records", "reports", "billing"]) {
    if (Array.isArray(value[key])) return value[key];
  }

  return [];
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const pick = (source, keys, fallback = "") => {
  if (!source || typeof source !== "object") return fallback;

  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return fallback;
};

const getRevenueAmount = (row = {}) =>
  toNumber(
    pick(
      row,
      [
        "revenue",
        "totalRevenue",
        "amount",
        "totalAmount",
        "grandTotal",
        "total",
        "paidAmount",
        "paymentAmount",
        "consultationCharge",
      ],
      0
    )
  );

const getRowDate = (row = {}) =>
  pick(row, ["month", "date", "createdAt", "paidAt", "paymentDate", "invoiceDate", "appointmentDate"], "");

const getMonthLabel = (value, index = 0) => {
  if (!value) return `Item ${index + 1}`;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};

const normalizeRevenueRows = (value) =>
  parseList(value)
    .map((row, index) => ({
      month: pick(row, ["month", "name", "date", "label"], getMonthLabel(getRowDate(row), index)),
      revenue: getRevenueAmount(row),
      growth: toNumber(pick(row, ["growth", "growthPercentage", "change"], 0)),
    }))
    .filter((row) => row.month || row.revenue);

const buildRevenueFromBilling = (billingRows = []) => {
  const byMonth = new Map();

  billingRows.forEach((row) => {
    const month = getMonthLabel(getRowDate(row));
    const current = byMonth.get(month) || { month, revenue: 0, growth: 0 };
    current.revenue += getRevenueAmount(row);
    byMonth.set(month, current);
  });

  return Array.from(byMonth.values());
};

// ================= COMPONENT =================

function RevenueReport() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);

  const [doctors, setDoctors] = useState([]);

  const [loading, setLoading] = useState(false);

  const [fromDate, setFromDate] = useState("");

  const [toDate, setToDate] = useState("");

  const [doctorId, setDoctorId] = useState(0);

  // ================= LOAD =================

  const fetchDoctors = useCallback(async () => {
    try {
      const response = await fetch(DOCTOR_API, {
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      });

      const result = await response.json();
      setDoctors(parseList(result));
    } catch (error) {
      console.log(error);
    }
  }, []);

  const fetchRevenue = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (doctorId) params.set("doctorId", String(doctorId));
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);

      const query = params.toString();
      const url = query ? `${REPORT_API}?${query}` : REPORT_API;

      const response = await fetch(url, {
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      });

      const result = await response.json();
      const reportRows = normalizeRevenueRows(result);

      if (reportRows.length) {
        setData(reportRows);
      } else {
        const billingResponse = await fetch(BILLING_API, {
          headers: {
            "ngrok-skip-browser-warning": "true",
          },
        });

        if (!billingResponse.ok) {
          setData([]);
          return;
        }

        const billingResult = await billingResponse.json();
        const billingRows = parseList(billingResult).filter((row) => {
          if (doctorId && String(pick(row, ["doctorId", "DoctorId"], "")) !== String(doctorId)) {
            return false;
          }

          const value = getRowDate(row);
          const date = value ? new Date(value) : null;

          if (date && !Number.isNaN(date.getTime())) {
            if (fromDate && date < new Date(fromDate)) return false;
            if (toDate && date > new Date(toDate)) return false;
          }

          return true;
        });

        setData(buildRevenueFromBilling(billingRows));
      }
    } catch (error) {
      console.log(error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [doctorId, fromDate, toDate]);

  useEffect(() => {
    fetchDoctors();
    fetchRevenue();
  }, [fetchDoctors, fetchRevenue]);

  // ================= EXPORT CSV =================

  const exportCSV = () => {
    const rows = [
      ["Month", "Revenue", "Growth"],

      ...data.map((x) => [x.month, x.revenue, x.growth]),
    ];

    const csvContent = rows.map((e) => e.join(",")).join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv",
    });

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = "revenue-report.csv";

    a.click();
  };

  return (
    <div className="report-page revenue-report-page">
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

          <h2>Revenue Report</h2>

          <p>Earnings and total revenue</p>
        </div>

        <button className="export" onClick={exportCSV}>
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* FILTER */}

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

        {/* DOCTOR */}

        <div>
          <label>Doctor</label>

          <select
            value={doctorId}
            onChange={(e) => setDoctorId(Number(e.target.value))}
          >
            <option value={0}>All doctors</option>

            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                Dr. {doctor.name}
              </option>
            ))}
          </select>
        </div>

        {/* APPLY */}

        <button type="button" className="report-apply" onClick={fetchRevenue}>
          Apply
        </button>
      </div>

      {/* CHART */}

      <div className="chart-card">
        <h3>Revenue Visualization</h3>

        {loading ? (
          <div className="empty">Loading...</div>
        ) : data.length === 0 ? (
          <div className="empty">No revenue data found</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis dataKey="month" />

              <YAxis />

              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb",
                }}
                formatter={(value) => [formatIndianCurrency(value), "Revenue"]}
              />

              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#159a8c"
                strokeWidth={4}
                dot={{
                  r: 7,
                  fill: "#159a8c",
                }}
                activeDot={{
                  r: 9,
                }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* TABLE */}

      <div className="table-card">
        <div className="thead">
          <span>Month</span>

          <span>Revenue</span>

          <span>Growth</span>
        </div>

        {data.map((d, i) => (
          <div className="row" key={i}>
            <span>{d.month}</span>

            <span>{formatIndianCurrency(d.revenue)}</span>

            <span className="growth">{d.growth}%</span>
          </div>
        ))}

        {!loading && data.length === 0 && (
          <div className="empty-table">No revenue data found.</div>
        )}
      </div>
    </div>
  );
}

export default RevenueReport;
