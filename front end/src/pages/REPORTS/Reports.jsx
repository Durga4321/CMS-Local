import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarDays,
  FileSpreadsheet,
  IndianRupee,
  LineChart,
  Stethoscope,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import "./Reports.css";

function Reports() {
  const navigate = useNavigate();

  const cards = [
    {
      title: "Daily Appointments",
      tag: "PATIENT FLOW ENGINE",
      tagIcon: <Users size={12} className="rep-card-pill-icon" />,
      code: "TELEMETRY-01",
      desc: "Real-time volume of patient bookings, clinical flow, and completed consultations",
      icon: <CalendarDays size={18} />,
      route: "/reports/daily",
      accent: "cyan",
      metrics: "Patient Volume & Flow",
    },
    {
      title: "Revenue Report",
      tag: "FINANCIAL TELEMETRY",
      tagIcon: <TrendingUp size={12} className="rep-card-pill-icon" />,
      code: "AUDIT-02",
      desc: "Comprehensive clinical earnings, department billing, and GST telemetry",
      icon: <IndianRupee size={18} />,
      route: "/RevenueReport/daily",
      accent: "emerald",
      metrics: "OP, Diagnostic & Pharmacy",
    },
    {
      title: "Doctor-wise Report",
      tag: "CLINICIAN REGISTRY",
      tagIcon: <UserCheck size={12} className="rep-card-pill-icon" />,
      code: "ROSTER-03",
      desc: "Physician performance telemetry, OP billing logs, and clinician revenue audit",
      icon: <Stethoscope size={18} />,
      route: "/DoctorWiseReport/daily",
      accent: "purple",
      metrics: "Doctor Consultation Audit",
    },
  ];

  return (
    <div className="reports-page">
      <div className="reports-header-wrap">
        <div className="rep-main-badge">
          <Activity size={13} className="rep-main-badge-pulse" />
          <span>CLINICAL INTELLIGENCE & AUDIT HUB</span>
        </div>
        <h1>Reports</h1>
        <p className="subtitle">Real-time medical intelligence, departmental metrics, and analytics across your clinic</p>
      </div>

      <div className="report-grid">
        {cards.map((c, i) => (
          <div key={i} className={`report-card report-card--${c.accent}`}>
            {/* Background Medical Cross Watermark */}
            <span className="rep-card-cross" aria-hidden="true">+</span>

            {/* Top Telemetry Header Bar */}
            <div className="rep-card-top-bar">
              <span className="rep-card-pill">
                {c.tagIcon}
                {c.tag}
              </span>
              <span className="rep-card-code">{c.code}</span>
            </div>

            {/* Medical Instrument Icon & Cardiac Wave */}
            <div className="rep-card-hero">
              <div className={`rep-card-icon-chamber ${c.accent}`}>
                {c.icon}
              </div>
              <div className="rep-card-mini-ecg" aria-hidden="true">
                <svg viewBox="0 0 60 20" className="rep-mini-ecg-svg">
                  <path
                    d="M0,10 L15,10 L18,3 L22,17 L25,2 L28,14 L31,10 L60,10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Card Content */}
            <div className="rep-card-body">
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
            </div>

            {/* Clinical Scope Footnote */}
            <div className="rep-card-scope">
              <span className="rep-card-scope-label">Clinical Scope:</span>
              <span className="rep-card-scope-val">{c.metrics}</span>
            </div>

            {/* Report Navigation Action Button */}
            <button
              type="button"
              onClick={() => c.route && navigate(c.route)}
              className="rep-instrument-btn"
              title={`Access ${c.title}`}
            >
              <span>Open report</span>
              <ArrowRight size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Reports;