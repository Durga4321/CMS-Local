import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, HeartPulse } from "lucide-react";
import AdminRegistration from "../components/payments/AdminRegistration";
import "./LandingPage.css";

export default function ClinicOwnerRegistrationPage() {
  return (
    <main className="landing-page clinic-owner-registration-page">
      <header className="landing-nav" aria-label="Registration navigation">
        <Link className="landing-brand" to="/">
          <span className="landing-brand-mark"><HeartPulse size={24} strokeWidth={2.5} /></span>
          <span className="landing-brand-text"><strong>CMS</strong><small>Care Management System</small></span>
        </Link>
        <Link to="/" className="landing-nav-link"><ArrowLeft size={16} /> Home</Link>
      </header>
      <section className="clinic-owner-registration-content">
        <p className="landing-live-status">ADMIN ACCOUNT</p>
        <h1>Create your account</h1>
        <p>Create and verify your Admin account, then choose a subscription plan.</p>
        <AdminRegistration standalone />
      </section>
    </main>
  );
}
