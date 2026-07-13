import React, { useEffect, useState } from "react";
import "./PatientDashboard.css";
import {
  Bell,
  Calendar,
  ChevronRight,
  Clock,
  FileText,
  IndianRupee,
  MapPin,
  Pill,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const EMPTY_ARRAY = [];

const formatCount = (value) => Number(value || 0).toLocaleString("en-IN");

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const toAmount = (value) => {
  const parsed = Number(String(value ?? 0).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const getBillStatus = (bill) => String(bill?.status || bill?.paymentStatus || bill?.state || "").toLowerCase();

const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");

const formatInlineValue = (value, emptyText = "Not available") => {
  const resolved = firstValue(value);
  return resolved !== undefined ? String(resolved) : emptyText;
};

const formatDateLabel = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }
  return String(value);
};

const formatTimeLabel = (value) => {
  if (!value) return null;
  return String(value).replace(/\s+/g, " ").trim();
};

const getAppointmentStatus = (appointment = {}) => {
  const safeAppointment = appointment || {};
  const status = firstValue(safeAppointment.status, safeAppointment.appointmentStatus, safeAppointment.state);
  return status ? String(status) : "Scheduled";
};

const getAppointmentDate = (appointment = {}) =>
  firstValue(
    (appointment || {}).date,
    (appointment || {}).appointmentDate,
    (appointment || {}).scheduledDate,
    (appointment || {}).visitDate,
    (appointment || {}).slotDate,
    (appointment || {}).startDate,
    (appointment || {}).createdAt
  );

const getAppointmentTime = (appointment = {}) =>
  firstValue((appointment || {}).time, (appointment || {}).slot, (appointment || {}).timeRange, (appointment || {}).scheduleTime, (appointment || {}).startTime, (appointment || {}).endTime);

const getDoctorName = (appointment = {}) =>
  firstValue(
    typeof (appointment || {}).doctor === "string" ? (appointment || {}).doctor : undefined,
    (appointment || {}).doctorName,
    (appointment || {}).doctor?.name,
    (appointment || {}).doctor?.fullName,
    (appointment || {}).practitionerName,
    (appointment || {}).providerName
  );

const getSpecialization = (appointment = {}) =>
  firstValue((appointment || {}).specialization, (appointment || {}).department, (appointment || {}).speciality, (appointment || {}).specialty, (appointment || {}).doctor?.specialization);

const getClinicName = (appointment = {}) =>
  firstValue((appointment || {}).clinic, (appointment || {}).clinicName, (appointment || {}).hospitalName, (appointment || {}).departmentName);

const getLocation = (appointment = {}) =>
  firstValue((appointment || {}).location, (appointment || {}).room, (appointment || {}).branch, (appointment || {}).site, (appointment || {}).clinicAddress, getClinicName(appointment));

const getAppointmentAvatar = (appointment = {}) => {
  const doctorName = String(getDoctorName(appointment) || "").trim();
  if (!doctorName) return "--";
  return doctorName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

const getSortedUpcomingAppointment = (items = []) => {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return null;

  const score = (item) => {
    const status = String(item.status || item.appointmentStatus || item.state || "").toLowerCase();
    if (status.includes("upcoming") || status.includes("confirm") || status.includes("schedule") || status.includes("book")) return 0;
    if (status.includes("pending") || status.includes("new")) return 1;
    return 2;
  };

  return [...list].sort((left, right) => {
    const leftScore = score(left);
    const rightScore = score(right);
    if (leftScore !== rightScore) return leftScore - rightScore;
    const leftTime = new Date(firstValue(getAppointmentDate(left), left.createdAt, left.updatedAt) || 0).getTime();
    const rightTime = new Date(firstValue(getAppointmentDate(right), right.createdAt, right.updatedAt) || 0).getTime();
    return leftTime - rightTime;
  })[0];
};

function PatientDashboard({ patient, visits = EMPTY_ARRAY, prescriptions = EMPTY_ARRAY, bills = EMPTY_ARRAY }) {
  const navigate = useNavigate();
  const dashboardPatient = patient || {};
  const upcomingAppointment = getSortedUpcomingAppointment(visits);
  const previousVisits = Array.isArray(visits) ? visits.length : 0;
  const prescriptionCount = Array.isArray(prescriptions) ? prescriptions.length : 0;
  const medicalRecordCount = previousVisits + prescriptionCount;
  const pendingBillsAmount = Array.isArray(bills)
    ? bills.reduce((total, bill) => {
        const status = getBillStatus(bill);
        const isPending = !status || status.includes("pending") || status.includes("unpaid") || status.includes("due");
        return isPending ? total + toAmount(bill?.amount ?? bill?.balance ?? bill?.total ?? bill?.dueAmount) : total;
      }, 0)
    : 0;
  const selectedPatientId = formatInlineValue(dashboardPatient.patientCode || dashboardPatient.id, "-");
  const selectedPatientPhone = formatInlineValue(dashboardPatient.phone, "Phone not available");
  const selectedPatientBloodGroup = formatInlineValue(dashboardPatient.bloodGroup || dashboardPatient.bloodgroup, "-");
  const appointmentDate = formatDateLabel(getAppointmentDate(upcomingAppointment));
  const appointmentTime = formatTimeLabel(getAppointmentTime(upcomingAppointment));
  const appointmentReminderDoctor = formatInlineValue(getDoctorName(upcomingAppointment), "Your");
  const defaultNotifications = [
    {
      id: "upcoming-appointment-reminder",
      title: "Upcoming Appointment Reminder",
      message: upcomingAppointment
        ? `${appointmentReminderDoctor} appointment${appointmentDate ? ` on ${appointmentDate}` : ""}${appointmentTime ? ` at ${appointmentTime}` : ""}.`
        : "No upcoming appointment is scheduled yet.",
      date: appointmentDate || "Today",
      read: false,
    },
    {
      id: "prescription-ready",
      title: "Prescription Ready",
      message: prescriptionCount ? `${formatCount(prescriptionCount)} prescription record${prescriptionCount === 1 ? "" : "s"} available to view.` : "No prescription is ready yet.",
      date: prescriptionCount ? "Ready now" : "Pending",
      read: prescriptionCount === 0,
    },
    {
      id: "payment-due",
      title: "Payment due",
      message: pendingBillsAmount ? `${formatCurrency(pendingBillsAmount)} pending for payment.` : "No payment is due right now.",
      date: pendingBillsAmount ? "Due" : "Clear",
      read: pendingBillsAmount === 0,
    },
  ];
  const notificationItems = defaultNotifications;
  const notificationSummary = notificationItems.length ? `${notificationItems.length} updates` : "No notifications yet";

  const [selectedNotificationId, setSelectedNotificationId] = useState(notificationItems[0]?.id ?? null);

  useEffect(() => {
    setSelectedNotificationId(notificationItems[0]?.id ?? null);
  }, [notificationItems]);

  const appointmentDoctor = formatInlineValue(getDoctorName(upcomingAppointment), "No appointment scheduled");
  const appointmentSpecialization = formatInlineValue(getSpecialization(upcomingAppointment), "Waiting for appointment data");
  const appointmentClinic = formatInlineValue(getClinicName(upcomingAppointment), "Clinic details not available");
  const appointmentLocation = formatInlineValue(getLocation(upcomingAppointment), "Location not available");
  const appointmentStatus = formatInlineValue(getAppointmentStatus(upcomingAppointment), "No appointment scheduled");
  const appointmentAvatar = getAppointmentAvatar(upcomingAppointment);
  const hasAppointment = Boolean(upcomingAppointment);

  const handleBookAppointment = () => {
    navigate("/patient/appointments/book");
  };

  const handleViewRecords = () => {
    navigate("/patient/medical-history");
  };

  const handleViewDetails = () => {
    navigate("/patient/medical-history");
  };

  const handleViewAppointmentDetails = () => {
    navigate("/patient/appointments");
  };

  const handleReschedule = () => {
    navigate("/patient/appointments/book");
  };

  const handleViewAllNotifications = () => {
    navigate("/patient/notifications");
  };

  const statCards = [
    {
      label: "Upcoming Appointments",
      value: formatCount(hasAppointment ? 1 : 0),
      note: hasAppointment ? [appointmentDate, appointmentTime].filter(Boolean).join(" at ") : "No upcoming appointment",
      icon: Clock,
      tone: "teal",
    },
    {
      label: "Previous Appointments",
      value: formatCount(previousVisits),
      note: "Completed consultations",
      icon: Calendar,
      tone: "blue",
      route: "/patient/medical-history",
    },
    {
      label: "Prescriptions",
      value: formatCount(prescriptionCount),
      note: "Available to download",
      icon: Pill,
      tone: "amber",
    },
    {
      label: "Bills Pending",
      value: formatCurrency(pendingBillsAmount),
      note: pendingBillsAmount ? "Payment due" : "No pending balance",
      icon: IndianRupee,
      tone: "green",
      route: "/patient/bills",
    },
  ];

  return (
    <div className="patient-dashboard">
      <div className="pd-header">
        <div className="pd-header-copy">
          <h1 className="pd-greeting-title">Patient Dashboard</h1>
          <p className="pd-greeting-subtitle">Keep track of appointments, care history, prescriptions, and billing in one place.</p>
        </div>
        <div className="pd-header-actions">
          <button type="button" className="pd-header-btn pd-header-btn--primary" onClick={handleBookAppointment}>
            <Calendar size={16} />
            Book appointment
          </button>
          <button type="button" className="pd-header-btn" onClick={handleViewDetails}>
            <FileText size={16} />
            View records
          </button>
        </div>
      </div>

      <div className="pd-stats-container">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <button type="button" className={`pd-stat-card pd-stat-card--${card.tone}`} key={card.label} onClick={() => navigate(card.route)}>
              <div className={`pd-stat-icon pd-stat-icon--${card.tone}`}>
                <Icon size={18} />
              </div>
              <div className="pd-stat-copy">
                <h2 className="pd-stat-value">{card.value}</h2>
                <p className="pd-stat-label">{card.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="pd-main-content">
        <section className="pd-card pd-appointment-panel">
          <div className="pd-section-header">
            <div>
              <h2>Upcoming Appointment</h2>
              <p>Next scheduled visit and clinic details.</p>
            </div>
            <span className="pd-status-badge">{appointmentStatus}</span>
          </div>

          <div className="pd-appointment-card">
            <div className="pd-doctor-info">
              <div className="pd-doctor-avatar">{appointmentAvatar}</div>
              <div className="pd-doctor-details">
                <h3 className="pd-doctor-name">{appointmentDoctor}</h3>
                <p className="pd-doctor-specialty">{appointmentSpecialization}</p>
                <p className="pd-doctor-clinic">{appointmentClinic}</p>
              </div>
            </div>

            {hasAppointment ? (
              <>
                <div className="pd-details-grid">
                  <div className="pd-detail-row">
                    <Clock size={16} />
                    <span>{appointmentDate ? `${appointmentDate}${appointmentTime ? ` at ${appointmentTime}` : ""}` : appointmentStatus}</span>
                  </div>
                  <div className="pd-detail-row">
                    <MapPin size={16} />
                    <span>{appointmentLocation}</span>
                  </div>
                </div>

                <div className="pd-appointment-actions">
                  <button type="button" className="pd-action-btn pd-action-btn--primary" onClick={handleViewAppointmentDetails}>
                    View details
                  </button>
                  <button type="button" className="pd-action-btn" onClick={handleReschedule}>
                    Reschedule
                  </button>
                </div>
              </>
            ) : (
              <div className="pd-empty-state">
                <p>No upcoming appointment is available from the backend yet.</p>
                <button type="button" className="pd-action-btn pd-action-btn--primary" onClick={handleBookAppointment}>
                  Book Appointment
                </button>
              </div>
            )}

            <div className="pd-profile-strip">
              <div>
                <span>Patient ID</span>
                <strong>{selectedPatientId}</strong>
              </div>
              <div>
                <span>Contact</span>
                <strong>{selectedPatientPhone}</strong>
              </div>
              <div>
                <span>Blood group</span>
                <strong>{selectedPatientBloodGroup}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="pd-card pd-notifications-panel">
          <div className="pd-section-header">
            <div>
              <h2>
                <Bell size={18} />
                Notifications:
              </h2>
              <p>Recent updates from the care team and billing desk.</p>
            </div>
            <button type="button" className="pd-link-button" onClick={handleViewAllNotifications}>
              View all
            </button>
          </div>

          <div className="pd-notification-list">
            {notificationItems.length ? (
              notificationItems.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={`pd-notification-item ${notification.id === selectedNotificationId ? "is-active" : ""} ${notification.read ? "is-read" : "is-unread"}`}
                  onClick={() => setSelectedNotificationId(notification.id)}
                >
                  <span className="pd-notification-dot" />
                  <span className="pd-notification-body">
                    <strong>{notification.title}</strong>
                    <span>{notification.message}</span>
                    <em>{notification.date}</em>
                  </span>
                  <ChevronRight size={16} className="pd-notification-chevron" />
                </button>
              ))
            ) : (
              <div className="pd-empty-state pd-empty-state--compact">
                <p>{notificationSummary}</p>
              </div>
            )}
          </div>

        </section>
      </div>

      <div className="pd-bottom-grid">
        <section className="pd-card pd-actions-panel">
          <div className="pd-section-header">
            <div>
              <h2>Quick actions</h2>
              <p>Frequent shortcuts for the patient portal.</p>
            </div>
          </div>

          <div className="pd-action-grid">
            <button type="button" className="pd-action-tile pd-action-tile--primary" onClick={handleBookAppointment}>
              <Calendar size={22} />
              <span>Book Appointment</span>
            </button>
            <button type="button" className="pd-action-tile" onClick={handleViewRecords}>
              <FileText size={22} />
              <span>View Reports</span>
            </button>
            <button type="button" className="pd-action-tile" onClick={() => navigate("/patient/prescriptions")}>
              <Pill size={22} />
              <span>View Prescriptions</span>
            </button>
            <button type="button" className="pd-action-tile" onClick={() => navigate("/patient/bills")}>
              <IndianRupee size={22} />
              <span>Payments</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default PatientDashboard;
