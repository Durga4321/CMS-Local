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
  ReceiptText,
  ShieldCheck,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import cleanVideo from "../assests/clean_video.mp4";
import "./LandingPage.css";

// Public overview content only; clinic records remain inside authenticated portals.
const modules = [
  { icon: ShieldCheck, title: "Super Admin", badge: "Platform", text: "Manage administrators, subscription plans, access permissions, and platform reports." },
  { icon: Building2, title: "Administration", badge: "Admin", text: "Manage branches, staff, patients, appointments, subscriptions, audit logs, and revenue reports." },
  { icon: UsersRound, title: "Reception", badge: "Front Desk", text: "Register patients, book appointments, manage the queue, and generate OP, lab, and pharmacy bills." },
  { icon: Stethoscope, title: "Doctor", badge: "Consultation", text: "Review appointments and patient history, record consultations, prescribe medicines, and request tests." },
  { icon: HeartPulse, title: "Nursing", badge: "Patient Care", text: "Review assigned patients, record vitals, and maintain care and medical-history information." },
  { icon: FlaskConical, title: "Laboratory", badge: "Diagnostics", text: "Manage ordered tests and sample collection, enter report details, attach available imaging files, and save or print reports." },
  { icon: ReceiptText, title: "Pharmacy", badge: "Medicines & Bills", text: "Manage the medicine catalogue and stock, review prescriptions, confirm dispensing quantities, and create pharmacy invoices." },
  { icon: ClipboardList, title: "Patient Portal", badge: "Patient Access", text: "Register or sign in to book appointments and view available prescriptions, reports, medical history, and bills." },
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
              <small>Care Management System</small>
            </span>
          </Link>

          <div className="landing-nav-center">
            <nav className="landing-primary-links" aria-label="Main navigation">
              <a href="#top" className="is-active">Home</a><a href="#modules-section">Features</a><a href="#modules-section">Modules</a><a href="#workflow-section">Roles</a><a href="#reports-section">Reports</a><a href="#contact-section">Contact</a>
            </nav>
          </div>

          <div className="landing-nav-actions">
            <Link to="/register/clinic-owner" className="landing-nav-link">
              Register
            </Link>
            <div className="landing-staff-actions"><Link to="/login" className="landing-nav-button"><span>Staff Login</span><ChevronRight size={16} /></Link><Link to="/plans" className="landing-nav-subscribe">View Plans & Subscribe</Link></div>
          </div>
        </header>

        {/* HERO CONTENT */}
        <div className="landing-hero-layout" id="top">
          <div className="landing-hero-content">
            <div className="landing-hero-kicker"><span className="landing-status-dot" />CONNECTED CARE OPERATIONS</div>
            <h1 className="landing-hero-title">
              One Workspace,<br />
              <span className="landing-gradient-text">From Booking to Billing.</span>
            </h1>
            <p className="landing-hero-copy">
              Bring administration, reception, doctors, nurses, laboratory staff,
              pharmacists, and patients together throughout every visit.
            </p>
            <div className="landing-hero-actions">
              <Link to="/login" className="landing-cta landing-cta-primary"><span>Access Staff Portal</span><ArrowRight size={18} /></Link>
              <Link to="/register/patient" className="landing-cta landing-cta-secondary"><span>Register New Patient</span></Link>
            </div>
            <div className="landing-hero-trust"><span>✦ Secure</span><span>⌁ Scalable</span><span>▱ Multi-Branch</span><span>♟ Role-Based Access</span></div>
          </div>
          <div className="landing-dashboard-scene" aria-label="CMS dashboard preview">
            <span className="landing-scene-pill landing-scene-pill-one" /><span className="landing-scene-shield">+</span><span className="landing-scene-pill landing-scene-pill-two" />
            <div className="landing-dashboard-window">
              <aside><strong><HeartPulse size={17} /> CMS</strong><b>▦ Dashboard</b><span>▧ Patients</span><span>◷ Appointments</span><span>♧ Staff</span><span>▤ Reports</span></aside>
              <div className="landing-dashboard-main"><header><strong>Good afternoon, Admin 👋</strong><small>All branches⌄</small></header>
                <div className="landing-dashboard-stats"><div><small>Total Patients</small><strong>2,840</strong></div><div><small>Appointments</small><strong>126</strong></div><div><small>Today's Billing</small><strong>₹46,600</strong></div></div>
                <div className="landing-dashboard-panels"><div className="landing-chart-card"><strong>Appointments Overview</strong><div className="landing-chart-bars"><i/><i/><i/><i/><i/><i/><i/></div><div className="landing-chart-line"/></div><div className="landing-queue-card"><strong>Today's Queue</strong><span>● New appointments</span><span>● In consultation</span><span>● Reports ready</span></div></div>
              </div>
            </div>
            <div className="landing-dashboard-phone"><strong>♡ CMS</strong><b>Today's Queue</b><span>Appointments</span><span>Patient records</span><span>Billing</span></div>
          </div>
        </div>

      </section>


      {/* CLINICAL WORKFLOW STEPPER STRIP */}
      <section className="landing-strip-container" id="workflow-section" aria-label="Clinical Workflow Steps">
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
            Follow the work handled by each role. Available screens and actions depend on account permissions and setup.
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
      <section className="landing-insight" id="reports-section">
        <div className="landing-insight-content">
          <div className="landing-insight-badge">
            <Building2 size={16} />
            <span>CARE MANAGEMENT</span>
          </div>
          <h2>Keep Operations in View</h2>
          <p>
            Administrators manage branches and staff, review patient appointments,
            and use billing and revenue reports to follow daily operations.
          </p>
          <div className="landing-insight-stats">
            <div className="insight-stat">
              <CheckCircle2 size={18} className="insight-check" />
              <span>Role-based access for care teams and patients</span>
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
      <footer className="landing-footer" id="contact-section">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <span className="landing-brand-mark-small">
              <HeartPulse size={18} />
            </span>
            <strong>CMS Care Management System</strong>
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
