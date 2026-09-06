import React from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  IndianRupee,
  Stethoscope,
  TrendingUp,
  BarChart3,
  LineChart,
  FileSpreadsheet,
} from "lucide-react";
import "./Reports.css";

function Reports() {
  const navigate = useNavigate();

  const cards = [
    {
      title: "Daily Appointments",
      desc: "Volume of appointments per day",
      icon: <CalendarDays />,
      route: "/reports/daily",
    },
    {
      title: "Revenue Report",
      desc: "Earnings, refunds, net revenue",
      icon: <IndianRupee />,
      route: "/RevenueReport/daily",
    },
    {
      title: "Doctor-wise Report",
      desc: "Performance per doctor",
      icon: <Stethoscope />,
      route: "/DoctorWiseReport/daily",
    },
  ];

  return (
    <div className="reports-page">
      <div className="reports-bg-overlay" />

      {/* 3D Floating Clinical Analytics & BI Particles */}
      <div className="reports-particle report-part-1" title="Revenue & Financial Growth">
        <TrendingUp size={28} />
      </div>
      <div className="reports-particle report-part-2" title="Appointment Analytics">
        <BarChart3 size={26} />
      </div>
      <div className="reports-particle report-part-3" title="Doctor Performance Trends">
        <LineChart size={26} />
      </div>
      <div className="reports-particle report-part-4" title="Clinical Data Spreadsheets">
        <FileSpreadsheet size={26} />
      </div>

      <div className="reports-header-wrap">
        <h1>Reports</h1>
        <p className="subtitle">Insights and analytics across your clinic</p>
      </div>

      <div className="report-grid">
        {cards.map((c, i) => (
          <div key={i} className="report-card">
            <div className="icon">{c.icon}</div>

            <h3>{c.title}</h3>
            <p>{c.desc}</p>

            <button
              onClick={() => c.route && navigate(c.route)}
              className="link"
            >
              Open report →
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}

export default Reports;