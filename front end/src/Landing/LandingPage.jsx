import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Bell,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FlaskConical,
  HeartPulse,
  Layers,
  MonitorPlay,
  Pause,
  Play,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import cleanVideo from "../assests/clean_video.mp4";
import "./LandingPage.css";

const modules = [
  {
    icon: UsersRound,
    title: "Front Desk & Reception",
    badge: "Patient Flow",
    text: "Streamline patient check-ins, multi-doctor queue tracking, appointment scheduling, and rapid branch triage.",
    color: "#0f172a",
  },
  {
    icon: Stethoscope,
    title: "Doctor Clinical Suite",
    badge: "EMR & Rx",
    text: "Integrated consultation notes, electronic prescriptions, vitals telemetry, and full longitudinal patient history.",
    color: "#1e293b",
  },
  {
    icon: HeartPulse,
    title: "Nursing & Patient Care",
    badge: "Care Handoff",
    text: "Today's ward and OP queue, vitals charting, triage tracking, and synchronized medical handoff records.",
    color: "#be123c",
  },
  {
    icon: FlaskConical,
    title: "Diagnostics & Pathology",
    badge: "Lab Workflows",
    text: "Test catalog management, technician worklists, sample tracking, automated file uploads, and digital report generation.",
    color: "#334155",
  },
  {
    icon: ReceiptText,
    title: "Pharmacy & Billing",
    badge: "Invoicing",
    text: "Medicine dispensing, automated GST-ready itemized billing, multi-department receipt separation, and revenue audits.",
    color: "#b45309",
  },
  {
    icon: ShieldCheck,
    title: "Security & Governance",
    badge: "Role Matrix",
    text: "Multi-branch clinic administration, granular role-based permissions, automated audit logs, and compliance oversight.",
    color: "#0f172a",
  },
];

const telemetryStats = [
  { value: "100%", label: "Real-time Sync", desc: "Across all clinic branches" },
  { value: "6+", label: "Unified Modules", desc: "Zero data fragmentation" },
  { value: "< 2 min", label: "Front Desk Triage", desc: "Accelerated patient intake" },
  { value: "99.99%", label: "System Availability", desc: "High availability uptime" },
];

const flow = [
  { step: "01", title: "Register Patient", desc: "Fast digital intake & instant medical record creation." },
  { step: "02", title: "Queue & Appointment", desc: "Intelligent branch routing with live token monitoring." },
  { step: "03", title: "Doctor Consultation", desc: "Clinical diagnosis, vitals review & digital prescription." },
  { step: "04", title: "Diagnostics & Billing", desc: "Synchronized lab test orders, pharmacy & GST receipts." },
];

function LandingPage() {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => {
            setIsPlaying(false);
          });
      }
    }
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  };

  return (
    <main className="landing-page">
      {/* HERO SECTION WITH ULTRA HD VIDEO BACKGROUND */}
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
              <strong>CMS <span className="landing-brand-badge">PRO HD</span></strong>
              <small>Clinical Intelligence System</small>
            </span>
          </Link>

          <div className="landing-nav-center">
            <div className="landing-live-status">
              <span className="landing-status-dot" />
              <span>Live Clinical Network</span>
            </div>
          </div>

          <div className="landing-nav-actions">
            <Link to="/login/patient" className="landing-nav-link">
              Patient Portal
            </Link>
            <Link to="/login" className="landing-nav-button">
              <span>Staff Login</span>
              <ChevronRight size={16} />
            </Link>
          </div>
        </header>

        {/* HERO CONTENT */}
        <div className="landing-hero-content">
          <div className="landing-eyebrow-wrapper">
            <div className="landing-eyebrow">
              <Sparkles size={14} className="sparkle-icon" />
              <span>4K Ultra HD • Intelligent Healthcare Platform</span>
            </div>
          </div>

          <h1 className="landing-hero-title">
            Connected Care, <br />
            <span className="landing-gradient-text">Unified Intelligence.</span>
          </h1>

          <p className="landing-hero-copy">
            Seamlessly orchestrate front desk registration, physician consultations, nursing triage,
            pathology lab diagnostics, and itemized pharmacy billing in one pristine, branch-aware workspace.
          </p>

          <div className="landing-hero-actions">
            <Link to="/login" className="landing-cta landing-cta-primary">
              <span>Access Staff Portal</span>
              <ArrowRight size={18} />
            </Link>
            <Link to="/register/patient" className="landing-cta landing-cta-secondary">
              <span>Register New Patient</span>
            </Link>
            <a href="#modules-section" className="landing-cta landing-cta-ghost">
              <Layers size={17} />
              <span>Explore Features</span>
            </a>
          </div>

          {/* TELEMETRY METRICS IN HERO */}
          <div className="landing-telemetry-row">
            {telemetryStats.map((item) => (
              <div className="landing-telemetry-item" key={item.label}>
                <div className="landing-telemetry-val">{item.value}</div>
                <div className="landing-telemetry-lbl">{item.label}</div>
                <div className="landing-telemetry-sub">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* HD VIDEO CONTROLLER BADGE */}
        <div className="landing-video-badge-wrapper">
          <button
            type="button"
            className="landing-video-control-pill"
            onClick={togglePlay}
            title={isPlaying ? "Pause HD Background Video" : "Play HD Background Video"}
            aria-label={isPlaying ? "Pause Background Video" : "Play Background Video"}
          >
            <span className="landing-video-indicator-icon">
              {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            </span>
            <span className="landing-video-text">
              {isPlaying ? "HD Ambient Video Playing" : "HD Video Paused"}
            </span>
            <span className="landing-hd-tag">HD 1080p</span>
          </button>
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
            <span>MODULAR ARCHITECTURE</span>
          </div>
          <h2>Engineered for Modern Clinical Precision</h2>
          <p className="landing-section-subhead">
            Every module is synchronized in real-time, eliminating operational bottlenecks and ensuring zero data loss across departments.
          </p>
        </div>

        <div className="landing-module-grid">
          {modules.map(({ icon: Icon, title, badge, text, color }) => (
            <article className="landing-module-card" key={title}>
              <div className="landing-card-top">
                <span className="landing-card-icon">
                  <Icon size={22} />
                </span>
                <span className="landing-card-badge">{badge}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
              <div className="landing-card-hover-indicator">
                <span>View capabilities</span>
                <ChevronRight size={14} />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* LIVE CLINICAL OPERATIONS INSIGHT BANNER */}
      <section className="landing-insight">
        <div className="landing-insight-content">
          <div className="landing-insight-badge">
            <Building2 size={16} />
            <span>MULTI-BRANCH GOVERNANCE</span>
          </div>
          <h2>Live Branch Operations & Financial Reconciliation</h2>
          <p>
            Consolidate patient traffic, doctor availability, diagnostics order queues, and segregated
            pharmacy revenue streams across all facility locations from an authoritative single source of truth.
          </p>
          <div className="landing-insight-stats">
            <div className="insight-stat">
              <CheckCircle2 size={18} className="insight-check" />
              <span>Multi-tier Role Permissions (Doctor, Nurse, Receptionist, Lab, SuperAdmin)</span>
            </div>
            <div className="insight-stat">
              <CheckCircle2 size={18} className="insight-check" />
              <span>End-to-end Automated Audit Logging with IP and Action Tracing</span>
            </div>
          </div>
        </div>

        <div className="landing-insight-grid">
          <div className="landing-insight-pill">
            <CalendarCheck size={22} />
            <div>
              <strong>Appointment Calendars</strong>
              <small>Slot booking, doctor quotas & walk-ins</small>
            </div>
          </div>
          <div className="landing-insight-pill">
            <ClipboardList size={22} />
            <div>
              <strong>Complete Longitudinal EMR</strong>
              <small>Historical diagnoses, vitals & allergies</small>
            </div>
          </div>
          <div className="landing-insight-pill">
            <ReceiptText size={22} />
            <div>
              <strong>Smart Invoicing Engine</strong>
              <small>OP consultation, tests & GST billing</small>
            </div>
          </div>
          <div className="landing-insight-pill">
            <Bell size={22} />
            <div>
              <strong>Cross-Department Alerts</strong>
              <small>Instant notifications for tests & orders</small>
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
            <span>High Definition Clinical Workspace • Protected by 256-Bit SSL</span>
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
