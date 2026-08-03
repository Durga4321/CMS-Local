
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
import {
  fetchBranchesForHospital,
  getApiHeaders,
  getBranchId as getBranchOptionId,
  getBranchName as getBranchOptionName,
  getStoredHospitalId,
} from "../../utils/branchApi";
import { formatIndianCurrency } from "../../utils/format";
import {
  appointmentToOpRevenueRow,
  dedupeBillingRows as dedupeRevenueRows,
  getBranchId as getRevenueBranchId,
  getBranchName as getRevenueBranchName,
  groupRevenueByMonth,
  groupRevenueByMonthBranch,
  isPaidAppointment,
  parseList as parseRevenueList,
  passesRevenueFilters,
} from "../../utils/billingRevenue";

// ================= API =================

const REPORT_API =
  apiUrl("Report/revenue");

const BILLING_API =
  apiUrl("Billing");
const APPOINTMENT_API =
  apiUrl("Appointment");
const LOCAL_SERVICE_BILLS_KEY = "receptionRecentServiceBills";

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

const readLocalServiceBills = () => {
  try {
    const bills = JSON.parse(localStorage.getItem(LOCAL_SERVICE_BILLS_KEY) || "[]");
    return Array.isArray(bills) ? bills : [];
  } catch {
    return [];
  }
};

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const fetchJsonOrEmpty = async (url, headers) => {
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) return [];
    return await response.json().catch(() => []);
  } catch {
    return [];
  }
};

const fetchBillingHistoryRows = async ({ params, headers }) => {
  const query = params.toString();
  const historyParams = new URLSearchParams(params);
  historyParams.set("pageSize", "10000");
  historyParams.set("limit", "10000");
  historyParams.set("includeAll", "true");
  historyParams.set("all", "true");

  const urls = [
    `${BILLING_API}?${historyParams.toString()}`,
    query ? `${BILLING_API}?${query}` : BILLING_API,
    apiUrl(`Billing/all${query ? `?${query}` : ""}`),
    apiUrl(`Billing/history${query ? `?${query}` : ""}`),
  ];

  const responses = await Promise.all(urls.map((url) => fetchJsonOrEmpty(url, headers)));
  return dedupeRevenueRows(responses.flatMap(parseRevenueList));
};

// ================= COMPONENT =================

function RevenueReport() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [branchRows, setBranchRows] = useState([]);

  const [branches, setBranches] = useState([]);

  const [loading, setLoading] = useState(false);

  const [fromDate, setFromDate] = useState("");

  const [toDate, setToDate] = useState("");

  const [branchId, setBranchId] = useState("");

  // ================= LOAD =================

  const fetchBranches = useCallback(async () => {
    try {
      setBranches(await fetchBranchesForHospital(getStoredHospitalId()));
    } catch (error) {
      console.log(error);
      setBranches([]);
    }
  }, []);

  const fetchRevenue = useCallback(async () => {
    try {
      setLoading(true);

      const storedHospitalId = getStoredHospitalId();
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", String(branchId));
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (storedHospitalId) {
        params.set("hospitalId", String(storedHospitalId));
        params.set("clinicId", String(storedHospitalId));
      }

      const query = params.toString();
      const url = query ? `${REPORT_API}?${query}` : REPORT_API;
      const headers = getApiHeaders();

      const response = await fetch(url, {
        headers,
      });

      const result = await response.json();
      const reportRows = normalizeRevenueRows(result);

      const [backendBillingRows, appointmentResponse] = await Promise.all([
        fetchBillingHistoryRows({ params, headers }),
        fetch(APPOINTMENT_API, {
          headers,
        }).catch(() => null),
      ]);

      const appointmentResult = appointmentResponse?.ok ? await appointmentResponse.json().catch(() => []) : [];
      const selectedBranch = branches.find(
        (branch) => String(getBranchOptionId(branch)) === String(branchId)
      );
      const selectedBranchName = selectedBranch ? getBranchOptionName(selectedBranch) : "";
      const paidAppointmentRows = parseRevenueList(appointmentResult)
        .filter(isPaidAppointment)
        .map(appointmentToOpRevenueRow);
      const billingRows = dedupeRevenueRows([
        ...backendBillingRows,
        ...readLocalServiceBills(),
        ...paidAppointmentRows,
      ])
        .map((row) => ({ ...row, __selectedBranchName: selectedBranchName }))
        .filter((row) => {
          const rowBranchId = getRevenueBranchId(row);
          const rowBranchName = getRevenueBranchName(row);
          return Boolean(rowBranchId) || normalizeText(rowBranchName) !== "unassigned branch";
        })
        .filter((row) =>
          passesRevenueFilters(row, {
          clinicId: storedHospitalId,
          branchId: branchId || "",
          fromDate,
          toDate,
          })
        );

      const nextBranchRows = groupRevenueByMonthBranch(billingRows);
      setBranchRows(nextBranchRows);
      if (nextBranchRows.length) {
        setData(groupRevenueByMonth(billingRows));
      } else if (branchId) {
        setData([]);
        setBranchRows([]);
      } else {
        setData(reportRows);
        setBranchRows(
          reportRows.map((row) => ({
            month: row.month,
            monthSort: row.month,
            branchId: "",
            branchName: "All Branches",
            opRevenue: row.revenue,
            diagnosticRevenue: 0,
            pharmacyRevenue: 0,
            revenue: row.revenue,
            growth: row.growth,
          }))
        );
      }
    } catch (error) {
      console.log(error);
      setData([]);
      setBranchRows([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, branches, fromDate, toDate]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

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
    const totals = branchRows.reduce(
      (sum, row) => ({
        opRevenue: sum.opRevenue + Number(row.opRevenue || 0),
        diagnosticRevenue: sum.diagnosticRevenue + Number(row.diagnosticRevenue || 0),
        pharmacyRevenue: sum.pharmacyRevenue + Number(row.pharmacyRevenue || 0),
        cgstAmount: sum.cgstAmount + Number(row.cgstAmount || 0),
        sgstAmount: sum.sgstAmount + Number(row.sgstAmount || 0),
        gstAmount: sum.gstAmount + Number(row.gstAmount || 0),
        revenue: sum.revenue + Number(row.revenue || 0),
      }),
      {
        opRevenue: 0,
        diagnosticRevenue: 0,
        pharmacyRevenue: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        gstAmount: 0,
        revenue: 0,
      }
    );
    const printWindow = window.open("", "_blank", "width=1120,height=780");
    if (!printWindow) return;

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Revenue Report</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            body { margin: 0; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
            .report { padding: 18px; }
            .head { display: flex; justify-content: space-between; gap: 18px; border-bottom: 2px solid #0f766e; padding-bottom: 12px; }
            h1 { margin: 0 0 5px; font-size: 24px; }
            p { margin: 3px 0; color: #475569; font-size: 12px; }
            .summary { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin: 14px 0; }
            .metric { border: 1px solid #dbeafe; border-radius: 8px; padding: 9px; background: #f8fafc; }
            .metric span { display: block; color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            .metric b { display: block; margin-top: 5px; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #d7e1ea; padding: 8px 7px; font-size: 11px; text-align: right; }
            th { background: #e8f7f5; color: #0f172a; text-transform: uppercase; font-size: 10px; }
            th:nth-child(1), th:nth-child(2), td:nth-child(1), td:nth-child(2) { text-align: left; }
            tfoot td { font-weight: 900; background: #f0fdfa; }
            @media print { body { print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <main class="report">
            <section class="head">
              <div>
                <h1>Revenue Report</h1>
                <p>Branch-wise monthly revenue including GST amounts.</p>
                <p>Generated: ${generatedAt}</p>
              </div>
              <div>
                <p>From: ${fromDate || "All"}</p>
                <p>To: ${toDate || "All"}</p>
                <p>Branch: ${branchId ? (branches.find((branch) => String(getBranchOptionId(branch)) === String(branchId)) ? getBranchOptionName(branches.find((branch) => String(getBranchOptionId(branch)) === String(branchId))) : branchId) : "All Branches"}</p>
              </div>
            </section>
            <section class="summary">
              <div class="metric"><span>OP</span><b>${formatIndianCurrency(totals.opRevenue)}</b></div>
              <div class="metric"><span>Diagnostic</span><b>${formatIndianCurrency(totals.diagnosticRevenue)}</b></div>
              <div class="metric"><span>Pharmacy</span><b>${formatIndianCurrency(totals.pharmacyRevenue)}</b></div>
              <div class="metric"><span>CGST</span><b>${formatIndianCurrency(totals.cgstAmount)}</b></div>
              <div class="metric"><span>SGST</span><b>${formatIndianCurrency(totals.sgstAmount)}</b></div>
              <div class="metric"><span>Total GST</span><b>${formatIndianCurrency(totals.gstAmount)}</b></div>
              <div class="metric"><span>Total</span><b>${formatIndianCurrency(totals.revenue)}</b></div>
            </section>
            <table>
              <thead>
                <tr>
                  <th>Month</th><th>Branch</th><th>OP Revenue</th><th>Diagnostic Revenue</th><th>Pharmacy Revenue</th><th>CGST</th><th>SGST</th><th>Total GST</th><th>Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                ${branchRows.map((row) => `
                  <tr>
                    <td>${row.month}</td>
                    <td>${row.branchName}</td>
                    <td>${formatIndianCurrency(row.opRevenue)}</td>
                    <td>${formatIndianCurrency(row.diagnosticRevenue)}</td>
                    <td>${formatIndianCurrency(row.pharmacyRevenue)}</td>
                    <td>${formatIndianCurrency(row.cgstAmount)}</td>
                    <td>${formatIndianCurrency(row.sgstAmount)}</td>
                    <td>${formatIndianCurrency(row.gstAmount)}</td>
                    <td>${formatIndianCurrency(row.revenue)}</td>
                  </tr>
                `).join("")}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2">Total</td>
                  <td>${formatIndianCurrency(totals.opRevenue)}</td>
                  <td>${formatIndianCurrency(totals.diagnosticRevenue)}</td>
                  <td>${formatIndianCurrency(totals.pharmacyRevenue)}</td>
                  <td>${formatIndianCurrency(totals.cgstAmount)}</td>
                  <td>${formatIndianCurrency(totals.sgstAmount)}</td>
                  <td>${formatIndianCurrency(totals.gstAmount)}</td>
                  <td>${formatIndianCurrency(totals.revenue)}</td>
                </tr>
              </tfoot>
            </table>
          </main>
          <script>window.onload = () => { window.focus(); window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
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

        <button className="export" onClick={exportPDF}>
          <Download size={16} />
          Export PDF
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

        {/* BRANCH */}

        <div>
          <label>Branch</label>

          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            <option value="">All branches</option>

            {branches.map((branch) => (
              <option key={getBranchOptionId(branch)} value={getBranchOptionId(branch)}>
                {getBranchOptionName(branch)}
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
          <span>S.No.</span>
          <span>Month</span>
          <span>Branch</span>
          <span>OP Revenue</span>
          <span>Diagnostic Revenue</span>
          <span>Pharmacy Revenue</span>
          <span>CGST</span>
          <span>SGST</span>
          <span>Total GST</span>
          <span>Total Revenue</span>
        </div>

        {branchRows.map((d, i) => (
          <div className="row" key={`${d.monthSort}-${d.branchId || d.branchName}-${i}`}>
            <span>{i + 1}</span>
            <span>{d.month}</span>
            <span>{d.branchName}</span>
            <span>{formatIndianCurrency(d.opRevenue)}</span>
            <span>{formatIndianCurrency(d.diagnosticRevenue)}</span>
            <span>{formatIndianCurrency(d.pharmacyRevenue)}</span>
            <span>{formatIndianCurrency(d.cgstAmount)}</span>
            <span>{formatIndianCurrency(d.sgstAmount)}</span>
            <span>{formatIndianCurrency(d.gstAmount)}</span>
            <span>{formatIndianCurrency(d.revenue)}</span>
          </div>
        ))}

        {!loading && branchRows.length === 0 && (
          <div className="empty-table">No revenue data found.</div>
        )}
      </div>
    </div>
  );
}

export default RevenueReport;
