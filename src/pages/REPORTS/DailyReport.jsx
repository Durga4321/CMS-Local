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
  Download,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import "./DailyReport.css";
import { apiUrl } from "../../config/api";

// ================= APIs =================

const REPORT_API =
  apiUrl("Report/daily-appointments");

const DOCTOR_API =
  apiUrl("Doctor");

// ================= COMPONENT =================

function DailyReport() {
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

      setDoctors(result);

    } catch (error) {

      console.log(error);
    }
  }, []);

  const fetchReport = useCallback(async () => {

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

      setData(result);
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

  // ================= EXPORT CSV =================

  const exportCSV = () => {

    const rows = [
      ["Day", "Appointments", "Completed"],
      ...data.map((d) => [
        d.day,
        d.appointments,
        d.completed,
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
      "daily-report.csv";

    a.click();
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
          onClick={exportCSV}
        >

          <Download size={16} />

          Export CSV

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
                  key={doctor.id}
                  value={doctor.id}
                >

                  Dr. {doctor.name}

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

          <span>Day</span>

          <span>Appointments</span>

          <span>Completed</span>

        </div>

        {data.map((d, i) => (

          <div
            key={i}
            className="row"
          >

            <span>{d.day}</span>

            <span>
              {d.appointments}
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
    </div>
  );
}

export default DailyReport;
