import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FlaskConical,
  HeartPulse,
  Layers,
  ReceiptText,
  ShieldCheck,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import cleanVideo from "../assests/clean_video.mp4";
import "./LandingPage.css";

// Public overview content only; clinic records remain inside authenticated portals.
const modules = [
  { icon: ShieldCheck, title: "Super Admin", badge: "Platform", text: "Manage clinic administrators, subscription plans, access permissions, and platform reports." },
  { icon: Building2, title: "Clinic Administration", badge: "Admin", text: "Manage branches, staff, patients, appointments, subscriptions, audit logs, and revenue reports." },
  { icon: UsersRound, title: "Reception", badge: "Front Desk", text: "Register patients, book appointments, manage the queue, and generate OP, lab, and pharmacy bills." },
  { icon: Stethoscope, title: "Doctor", badge: "Consultation", text: "Review appointments and patient history, record consultations, prescribe medicines, and request tests." },
  { icon: HeartPulse, title: "Nursing", badge: "Patient Care", text: "Review assigned patients, record vitals, and maintain care and medical-history information." },
  { icon: FlaskConical, title: "Laboratory", badge: "Diagnostics", text: "Manage ordered tests and sample collection, enter report details, attach available imaging files, and save or print reports." },
  { icon: ReceiptText, title: "Pharmacy", badge: "Medicines & Bills", text: "Manage the medicine catalogue and stock, review prescriptions, confirm dispensing quantities, and create pharmacy invoices." },
  { icon: ClipboardList, title: "Patient Portal", badge: "Patient Access", text: "Register or sign in to book appointments and view available prescriptions, reports, medical history, and bills." },
];

const overviewAreas = [
  { value: "Book", label: "Start the visit", desc: "Patient registration and booking" },
  { value: "Consult", label: "Record the care", desc: "Vitals, history and prescriptions" },
  { value: "Treat", label: "Continue treatment", desc: "Lab reports and pharmacy dispensing" },
  { value: "Review", label: "Review the visit", desc: "Invoices and patient documents" },
];

const flow = [
  { step: "01", title: "Register the patient", desc: "Create a patient record through reception or patient registration." },
  { step: "02", title: "Book an appointment", desc: "Choose the branch, doctor, and available appointment slot." },
  { step: "03", title: "Record vitals", desc: "Nursing staff record patient observations for the consultation." },
  { step: "04", title: "Complete consultation", desc: "The doctor reviews history, records findings, and prescribes treatment." },
  { step: "05", title: "Process ordered tests", desc: "When tests are requested, lab staff collect samples and prepare the test reports." },
  { step: "06", title: "Dispense medicines", desc: "Pharmacy staff review prescribed medicines and confirm the quantities dispensed." },
  { step: "07", title: "Manage bills and payments", desc: "Create the applicable OP, lab, and pharmacy invoices and record payments." },
  { step: "08", title: "Access visit records", desc: "Authorised staff and patients access the records available to their account." },
];

function LandingPage() {
  const videoRef = useRef(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  return (
    <main className="landing-page">
      {/* HERO SECTION WITH VIDEO BACKGROUND */}
      <section className="landing-hero">
        <div className="landing-video-container">
          <video
            ref={videoRef}
            className={`landing-hero-video ${isVideoLoaded ? "loaded" : ""}`}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            onLoadedData={() => setIsVideoLoaded(true)}
          >
            <source src={cleanVideo} type="video/mp4" />
          </video>
          <div className="landing-hero-overlay" />
          <div className="landing-hero-ambient-glow" />
          <div className="landing-hero-grid-mesh" />
        </div>

        {/* NAVIGATION BAR */}
        <header className="landing-nav" aria-label="Primary Navigation">
          <Link className="landing-brand" to="/">
            <span className="landing-brand-mark">
              <HeartPulse size={24} strokeWidth={2.5} />
            </span>
            <span className="landing-brand-text">
              <strong>CMS</strong>
              <small>Clinic Management System</small>
            </span>
          </Link>

          <div className="landing-nav-center">
            <div className="landing-live-status">
              <span className="landing-status-dot" />
              <span>Application Overview</span>
            </div>
          </div>

          <div className="landing-nav-actions">
            <Link to="/login/patient" className="landing-nav-link">
              Patient Portal
            </Link>
            <div className="landing-staff-actions"><Link to="/login" className="landing-nav-button"><span>Staff Login</span><ChevronRight size={16} /></Link><Link to="/plans" className="landing-nav-subscribe">View Plans & Subscribe</Link></div>
          </div>
        </header>

        {/* HERO CONTENT */}
        <div className="landing-hero-content">
          <h1 className="landing-hero-title">
            One Clinic Workspace, <br />
            <span className="landing-gradient-text">From Booking to Billing.</span>
          </h1>

          <p className="landing-hero-copy">
            See how clinic administration, reception, doctors, nurses, laboratory staff,
            pharmacists, and patients use CMS throughout a patient visit.
          </p>

          <div className="landing-hero-actions">
            <Link to="/login" className="landing-cta landing-cta-primary"><span>Access Staff Portal</span><ArrowRight size={18} /></Link>
            <Link to="/register/patient" className="landing-cta landing-cta-secondary">
              <span>Register New Patient</span>
            </Link>
            <a href="#modules-section" className="landing-cta landing-cta-ghost">
              <Layers size={17} />
              <span>Explore the Modules</span>
            </a>
          </div>

          {/* STATIC WORKFLOW OVERVIEW */}
          <div className="landing-telemetry-row">
            {overviewAreas.map((item) => (
              <div className="landing-telemetry-item" key={item.label}>
                <div className="landing-telemetry-val">{item.value}</div>
                <div className="landing-telemetry-lbl">{item.label}</div>
                <div className="landing-telemetry-sub">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

      </section>


      {/* CLINICAL WORKFLOW STEPPER STRIP */}
      <section className="landing-strip-container" aria-label="Clinical Workflow Steps">
        <div className="landing-strip">
          {flow.map((item) => (
            <div className="landing-step" key={item.step}>
              <div className="landing-step-header">
                <span className="landing-step-num">{item.step}</span>
                <span className="landing-step-tag">Step {item.step}</span>
              </div>
              <strong className="landing-step-title">{item.title}</strong>
              <p className="landing-step-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CORE CLINICAL MODULES SECTION */}
      <section className="landing-section" id="modules-section">
        <div className="landing-section-head">
          <div className="landing-section-badge">
            <Activity size={15} />
            <span>APPLICATION MODULES</span>
          </div>
          <h2>A Workspace for Each Role</h2>
          <p className="landing-section-subhead">
            Follow the work handled by each role. Available screens and actions depend on the account permissions and clinic setup.
          </p>
        </div>

        <div className="landing-module-grid">
          {modules.map(({ icon: Icon, title, badge, text }) => (
            <article className="landing-module-card" key={title}>
              <div className="landing-card-top">
                <span className="landing-card-icon">
                  <Icon size={22} />
                </span>
                <span className="landing-card-badge">{badge}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ADMINISTRATION AND RECORDS OVERVIEW */}
      <section className="landing-insight">
        <div className="landing-insight-content">
          <div className="landing-insight-badge">
            <Building2 size={16} />
            <span>CLINIC MANAGEMENT</span>
          </div>
          <h2>Keep Clinic Operations in View</h2>
          <p>
            Administrators manage clinic branches and staff, review patient appointments,
            and use billing and revenue reports to follow clinic activity.
          </p>
          <div className="landing-insight-stats">
            <div className="insight-stat">
              <CheckCircle2 size={18} className="insight-check" />
              <span>Role-based access for clinic teams and patients</span>
            </div>
            <div className="insight-stat">
              <CheckCircle2 size={18} className="insight-check" />
              <span>Audit logs for recorded account and application activity</span>
            </div>
          </div>
        </div>

        <div className="landing-insight-grid">
          <div className="landing-insight-pill">
            <CalendarCheck size={22} />
            <div>
              <strong>Appointment Calendars</strong>
              <small>Doctor schedules, available slots and visit queues</small>
            </div>
          </div>
          <div className="landing-insight-pill">
            <ClipboardList size={22} />
            <div>
              <strong>Patient History</strong>
              <small>Available visits, vitals and medical records</small>
            </div>
          </div>
          <div className="landing-insight-pill">
            <ReceiptText size={22} />
            <div>
              <strong>OP, Lab & Pharmacy Bills</strong>
              <small>Saved invoices, payment status and revenue reports</small>
            </div>
          </div>
          <div className="landing-insight-pill">
            <ClipboardList size={22} />
            <div>
              <strong>Patient Documents</strong>
              <small>Available prescriptions, reports and visit records</small>
            </div>
          </div>
        </div>
      </section>

      {/* REFINED SYSTEM FOOTER */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <span className="landing-brand-mark-small">
              <HeartPulse size={18} />
            </span>
            <strong>CMS Clinic Management System</strong>
          </div>
          <div className="landing-footer-meta">
            <span>Appointments | Consultations | Lab | Pharmacy | Billing</span>
          </div>
          <div className="landing-footer-links">
            <Link to="/login">Staff Portal</Link>
            <Link to="/login/patient">Patient Access</Link>
            <Link to="/register/patient">Patient Registration</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

export default LandingPage;
