import React from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, IndianRupee, Stethoscope } from "lucide-react";
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

      <h1>Reports</h1>
      <p className="subtitle">Insights and analytics across your clinic</p>

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