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
import { formatIndianCurrency } from "../../utils/format";

// ================= APIs =================

const REPORT_API =
  apiUrl("Report/doctor-wise");

const DOCTOR_API =
  apiUrl("Doctor");

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
    useState(0);

  // ================= LOAD =================

  const fetchDoctors = useCallback(
    async () => {

      try {

        const response =
          await fetch(
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

        setDoctors(result);

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

        let url =
          `${REPORT_API}?doctorId=${doctorId}`;

        if (fromDate) {
          url += `&fromDate=${fromDate}`;
        }

        if (toDate) {
          url += `&toDate=${toDate}`;
        }

        const response =
          await fetch(url, {
            headers: {
              "ngrok-skip-browser-warning":
                "true",
            },
          });

        const result =
          await response.json();

        setData(result);
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    },
    [doctorId, fromDate, toDate]
  );

  useEffect(() => {

    fetchDoctors();

    fetchReport();

  }, [fetchDoctors, fetchReport]);

  // ================= EXPORT CSV =================

  const exportCSV = () => {

    const rows = [
      [
        "Doctor",
        "Specialization",
        "Appointments",
        "Revenue",
      ],

      ...data.map((x) => [
        x.doctorName,
        x.specialization,
        x.appointments,
        x.revenue,
      ]),
    ];

    const csvContent =
      rows
        .map((e) => e.join(","))
        .join("\n");

    const blob =
      new Blob([csvContent], {
        type: "text/csv",
      });

    const url =
      window.URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download =
      "doctor-wise-report.csv";

    a.click();
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
          onClick={exportCSV}
        >

          <Download size={16} />

          Export CSV

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
                  key={doctor.id}
                  value={doctor.id}
                >

                  Dr. {doctor.name}

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
                dataKey="doctorName"
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
                    `${value} appointments`,
                    "Count",
                  ]}
              />

              <Bar
                dataKey="appointments"

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

          <span>Doctor</span>

          <span>Specialization</span>

          <span>Appointments</span>

          <span>Revenue</span>

        </div>

        {data.map((d, i) => (

          <div
            className="row"
            key={i}
          >

            <span>
              Dr. {d.doctorName}
            </span>

            <span>
              {d.specialization}
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
