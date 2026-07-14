import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle, Check } from "lucide-react";
import "./Completion.css";

/* ── Completion checklist items ── */
const COMPLETION_ITEMS = [
  {
    id: 1,
    title: "Reception Notified",
    desc: "Reception has been notified about the consultation.",
  },
  {
    id: 2,
    title: "Billing Process Started",
    desc: "Billing process has been initiated.",
  },
  {
    id: 3,
    title: "Patient Moved to Completed",
    desc: "Patient has been moved to completed list.",
  },
];

function Completion() {
  const navigate = useNavigate();
  const location = useLocation();
  const message =
    location.state?.message ||
    "Prescription has been saved.";
  const appointmentStatus =
    location.state?.appointmentStatus ||
    "Completed";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      navigate("/doctor/dashboard", { replace: true });
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="comp-page">
      <div className="comp-card">

        {/* ── Big green check icon ── */}
        <div className="comp-icon-wrap">
          <CheckCircle size={56} strokeWidth={2} className="comp-check-icon" />
        </div>

        {/* ── Title ── */}
        <h2 className="comp-title">Consultation Completed Successfully!</h2>
        <p className="comp-subtitle">{message}</p>

        {/* ── Checklist items ── */}
        <div className="comp-list">
          {COMPLETION_ITEMS.map((item) => (
            <div className="comp-item" key={item.id}>
              <div className="comp-item-info">
                <p className="comp-item-title">{item.title}</p>
                <p className="comp-item-desc">
                  {item.id === 3
                    ? `Appointment status is ${appointmentStatus}.`
                    : item.desc}
                </p>
              </div>
              <div className="comp-item-check">
                <Check size={16} strokeWidth={3} />
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

export default Completion;
