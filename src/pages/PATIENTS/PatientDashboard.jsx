import React, { useEffect, useState } from "react";
import "./PatientDashboard.css";
import {
  Bell,
  Calendar,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  MapPin,
  MessageSquare,
  Phone,
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

const getInitials = (name = "") => {
  const tokens = String(name).trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return "P";
  return tokens
    .slice(0, 2)
    .map((token) => token[0])
    .join("")
    .toUpperCase();
};

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
  firstValue((appointment || {}).doctorName, (appointment || {}).doctor?.name, (appointment || {}).doctor?.fullName, (appointment || {}).practitionerName, (appointment || {}).providerName);

const getSpecialization = (appointment = {}) =>
  firstValue((appointment || {}).specialization, (appointment || {}).department, (appointment || {}).speciality, (appointment || {}).specialty, (appointment || {}).doctor?.specialization);

const getClinicName = (appointment = {}) =>
  firstValue((appointment || {}).clinic, (appointment || {}).clinicName, (appointment || {}).hospitalName, (appointment || {}).departmentName);

const getLocation = (appointment = {}) =>
  firstValue((appointment || {}).location, (appointment || {}).room, (appointment || {}).branch, (appointment || {}).site, (appointment || {}).clinicAddress);

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

function PatientDashboard({ patient, visits = EMPTY_ARRAY, prescriptions = EMPTY_ARRAY, bills = EMPTY_ARRAY, notifications = EMPTY_ARRAY }) {
  const navigate = useNavigate();
  const dashboardPatient = patient || {};
  const upcomingAppointment = getSortedUpcomingAppointment(visits);
  const notificationItems = Array.isArray(notifications) ? notifications : EMPTY_ARRAY;
  const previousVisits = Array.isArray(visits) ? visits.length : 0;
  const prescriptionCount = Array.isArray(prescriptions) ? prescriptions.length : 0;
  const pendingBillsAmount = Array.isArray(bills)
    ? bills.reduce((total, bill) => {
        const status = getBillStatus(bill);
        const isPending = !status || status.includes("pending") || status.includes("unpaid") || status.includes("due");
        return isPending ? total + toAmount(bill?.amount ?? bill?.balance ?? bill?.total ?? bill?.dueAmount) : total;
      }, 0)
    : 0;
  const selectedPatientName = formatInlineValue(dashboardPatient.name, "Patient");
  const selectedPatientId = formatInlineValue(dashboardPatient.patientCode || dashboardPatient.id, "-");
  const selectedPatientPhone = formatInlineValue(dashboardPatient.phone, "Phone not available");
  const selectedPatientEmail = formatInlineValue(dashboardPatient.email, "Email not available");
  const selectedPatientGender = formatInlineValue(dashboardPatient.gender, "-");
  const selectedPatientAge = formatInlineValue(dashboardPatient.age, "-");
  const selectedPatientBloodGroup = formatInlineValue(dashboardPatient.bloodGroup || dashboardPatient.bloodgroup, "-");
  const selectedPatientAddress = formatInlineValue(dashboardPatient.address, "Address not available");
  const selectedEmergencyName = formatInlineValue(dashboardPatient.emergencyContactName, "-");
  const selectedEmergencyPhone = formatInlineValue(dashboardPatient.emergencyContactPhone, "-");
  const selectedLastVisit = formatInlineValue(formatDateLabel(dashboardPatient.lastVisit), "No visit yet");
  const notificationSummary = notificationItems.length ? `${notificationItems.length} updates` : "No notifications yet";

  const [selectedNotificationId, setSelectedNotificationId] = useState(notificationItems[0]?.id ?? null);

  useEffect(() => {
    setSelectedNotificationId(notificationItems[0]?.id ?? null);
  }, [notificationItems]);

  const selectedNotification = notificationItems.find((item) => item.id === selectedNotificationId) || notificationItems[0];
  const appointmentDate = formatDateLabel(getAppointmentDate(upcomingAppointment));
  const appointmentTime = formatTimeLabel(getAppointmentTime(upcomingAppointment));
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

  const handleViewDetails = () => {
    navigate("/patient/profile");
  };

  const handleReschedule = () => {
    navigate("/patient/appointments");
  };

  const handleViewAllNotifications = () => {
    navigate("/patient/notifications");
  };

  const statCards = [
    {
      label: "Upcoming appointment",
      value: appointmentDate || "No appointment",
      note: appointmentTime || appointmentStatus,
      icon: Clock,
      tone: "teal",
    },
    {
      label: "Previous visits",
      value: formatCount(previousVisits),
      note: "Completed consultations",
      icon: FileText,
      tone: "blue",
    },
    {
      label: "Prescriptions",
      value: formatCount(prescriptionCount),
      note: "Available to download",
      icon: Pill,
      tone: "amber",
    },
    {
      label: "Bills pending",
      value: formatCurrency(pendingBillsAmount),
      note: pendingBillsAmount ? "Payment due" : "No pending balance",
      icon: DollarSign,
      tone: "green",
    },
  ];

  return (
    <div className="patient-dashboard">
      <div className="pd-header">
        <div className="pd-header-copy">
          <p className="pd-eyebrow">Patient portal</p>
          <h1 className="pd-greeting-title">Good day, {selectedPatientName}</h1>
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
            <button type="button" className={`pd-stat-card pd-stat-card--${card.tone}`} key={card.label}>
              <div className={`pd-stat-icon pd-stat-icon--${card.tone}`}>
                <Icon size={18} />
              </div>
              <div className="pd-stat-copy">
                <p className="pd-stat-label">{card.label}</p>
                <h2 className="pd-stat-value">{card.value}</h2>
                <span className="pd-stat-description">{card.note}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="pd-main-content">
        <section className="pd-card pd-appointment-panel">
          <div className="pd-section-header">
            <div>
              <h2>Upcoming appointment</h2>
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
                  <button type="button" className="pd-action-btn pd-action-btn--primary" onClick={handleViewDetails}>
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
                  Book appointment
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
                Notifications
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

          {selectedNotification ? (
            <div className="pd-selected-notification">
              <div className="pd-selected-notification-head">
                <strong>{selectedNotification.title}</strong>
                <span>{selectedNotification.date}</span>
              </div>
              <p>{selectedNotification.message}</p>
            </div>
          ) : null}
        </section>
      </div>

      <div className="pd-bottom-grid">
        <section className="pd-card pd-profile-panel">
          <div className="pd-section-header">
            <div>
              <h2>Patient profile</h2>
              <p>Basic information and contact details pulled from the live patient session.</p>
            </div>
          </div>

          <div className="pd-profile-card">
            <div className="pd-profile-avatar">{getInitials(selectedPatientName)}</div>
            <div className="pd-profile-copy">
              <h3>{selectedPatientName}</h3>
              <p>{selectedPatientEmail}</p>
              <div className="pd-profile-meta">
                <span>
                  <Phone size={14} />
                  {selectedPatientPhone}
                </span>
                <span>
                  <MapPin size={14} />
                  {selectedPatientAddress}
                </span>
                <span>
                  <Bell size={14} />
                  {notificationSummary}
                </span>
              </div>
            </div>
          </div>

          <div className="pd-profile-strip pd-profile-strip--expanded" style={{ marginTop: 16 }}>
            <div>
              <span>Age</span>
              <strong>{selectedPatientAge}</strong>
            </div>
            <div>
              <span>Gender</span>
              <strong>{selectedPatientGender}</strong>
            </div>
            <div>
              <span>Blood group</span>
              <strong>{selectedPatientBloodGroup}</strong>
            </div>
            <div>
              <span>Patient ID</span>
              <strong>{selectedPatientId}</strong>
            </div>
            <div>
              <span>Emergency contact</span>
              <strong>{selectedEmergencyName}</strong>
            </div>
            <div>
              <span>Emergency phone</span>
              <strong>{selectedEmergencyPhone}</strong>
            </div>
            <div>
              <span>Last visit</span>
              <strong>{selectedLastVisit}</strong>
            </div>
            <div>
              <span>Address</span>
              <strong>{selectedPatientAddress}</strong>
            </div>
          </div>
        </section>

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
              <span>Book appointment</span>
            </button>
            <button type="button" className="pd-action-tile" onClick={handleViewDetails}>
              <FileText size={22} />
              <span>View records</span>
            </button>
            <button type="button" className="pd-action-tile" onClick={() => navigate("/patient/prescriptions")}>
              <Pill size={22} />
              <span>Prescriptions</span>
            </button>
            <button type="button" className="pd-action-tile" onClick={() => navigate("/patient/bills")}>
              <DollarSign size={22} />
              <span>Payments</span>
            </button>
            <button type="button" className="pd-action-tile" onClick={() => navigate("/patient/medical-history")}>
              <MessageSquare size={22} />
              <span>Medical history</span>
            </button>
            <button type="button" className="pd-action-tile" onClick={handleViewAllNotifications}>
              <Bell size={22} />
              <span>Notifications</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default PatientDashboard;
