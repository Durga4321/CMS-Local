import React from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Bell,
  CalendarCheck,
  ClipboardList,
  FlaskConical,
  HeartPulse,
  ReceiptText,
  ShieldCheck,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import "./LandingPage.css";

const modules = [
  { icon: UsersRound, title: "Front Desk", text: "Patients, appointments, billing, and branch workflow in one clean queue." },
  { icon: Stethoscope, title: "Doctors", text: "Consultation notes, prescriptions, schedules, and appointment context." },
  { icon: HeartPulse, title: "Nursing", text: "Today patients, vitals, medical history, and care handoff tools." },
  { icon: FlaskConical, title: "Diagnostics", text: "Lab billing, test orders, files, reports, and technician worklists." },
  { icon: ReceiptText, title: "Pharmacy", text: "Medicine billing templates with GST-ready invoice structure." },
  { icon: ShieldCheck, title: "Admin Control", text: "Clinic, branch, staff, role, report, and audit controls scoped correctly." },
];

const flow = [
  "Register patient",
  "Book appointment",
  "Consult doctor",
  "Bill and report",
];

function LandingPage() {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div className="landing-nav" aria-label="Primary">
          <Link className="landing-brand" to="/">
            <span className="landing-brand-mark">
              <HeartPulse size={25} />
            </span>
            <span>
              <strong>CMS</strong>
              <small>Clinic Management System</small>
            </span>
          </Link>
          <div className="landing-nav-actions">
            <Link to="/login/patient" className="landing-nav-link">Patient Login</Link>
            <Link to="/login" className="landing-nav-button">Staff Login</Link>
          </div>
        </div>

        <div className="landing-hero-content">
          <p className="landing-eyebrow">
            <Activity size={17} /> Connected clinic operations
          </p>
          <h1>CMS</h1>
          <p className="landing-hero-copy">
            Run reception, doctors, nurses, diagnostics, pharmacy billing, patient records,
            and reports from one calm, branch-aware workspace.
          </p>
          <div className="landing-hero-actions">
            <Link to="/login" className="landing-cta landing-cta-primary">
              Staff Login <ArrowRight size={18} />
            </Link>
            <Link to="/register/patient" className="landing-cta landing-cta-secondary">
              Register Patient
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-strip" aria-label="Workflow">
        {flow.map((item, index) => (
          <div className="landing-step" key={item}>
            <span>{index + 1}</span>
            <strong>{item}</strong>
          </div>
        ))}
      </section>

      <section className="landing-section">
        <div className="landing-section-head">
          <p>Everything in its place</p>
          <h2>Built for daily clinic work</h2>
        </div>
        <div className="landing-module-grid">
          {modules.map(({ icon: Icon, title, text }) => (
            <article className="landing-module-card" key={title}>
              <span>
                <Icon size={22} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-insight">
        <div>
          <p>Live operations</p>
          <h2>Accurate branch data, clean role access, and invoices that stay separated.</h2>
        </div>
        <div className="landing-insight-grid">
          <span><CalendarCheck size={20} /> Today and past appointments</span>
          <span><ClipboardList size={20} /> Patient history by branch</span>
          <span><ReceiptText size={20} /> OP, diagnostic, pharmacy bills</span>
          <span><Bell size={20} /> Notifications for every module</span>
        </div>
      </section>
    </main>
  );
}

export default LandingPage;
