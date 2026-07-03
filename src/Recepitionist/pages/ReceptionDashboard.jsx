import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  CalendarPlus,
  CheckCircle,
  Clock,
  ClipboardList,
  UserPlus,
} from "lucide-react";
import { formatToday, parseList, requestJson } from "../receptionApi";

function ReceptionDashboard() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState({ today: 0, waiting: 0, completed: 0 });

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [dashboardData, appointmentData] = await Promise.all([
          requestJson("ReceptionistDashboard"),
          requestJson("Appointment"),
        ]);

        setStats({
          today: Number(dashboardData?.totalTodayAppointments) || 0,
          waiting: Number(dashboardData?.waitingAppointments) || 0,
          completed: Number(dashboardData?.completedAppointments) || 0,
        });
        setAppointments(parseList(appointmentData));
      } catch (dashboardError) {
        requestJson("Appointment")
          .then((data) => {
            const appointmentList = parseList(data);
            const todayDate = formatToday();
            const todays = appointmentList.filter((item) =>
              String(item.date || item.appointmentDate || "").startsWith(todayDate)
            );
            setStats({
              today: todays.length,
              waiting: appointmentList.filter((item) =>
                ["waiting", "scheduled", "booked"].includes(
                  String(item.status || "").toLowerCase()
                )
              ).length,
              completed: appointmentList.filter((item) =>
                ["completed", "consulted"].includes(String(item.status || "").toLowerCase())
              ).length,
            });
            setAppointments(appointmentList);
          })
          .catch(() => {
            setStats({ today: 0, waiting: 0, completed: 0 });
            setAppointments([]);
          });
      }
    };

    loadDashboard();
  }, []);

  const todayDate = formatToday();
  const latest = appointments.filter((item) =>
    String(item.date || item.appointmentDate || "").startsWith(todayDate)
  );

  return (
    <section className="rc-page">
      <div className="rc-page-head">
        <div>
          <h2>Reception Dashboard</h2>
          <p>View today's schedule, waiting queue, and front desk actions.</p>
        </div>
        <div className="rc-head-actions">
          <button className="rc-btn" onClick={() => navigate("/reception/appointments")}>
            <CalendarPlus size={16} /> Book Appointment
          </button>
          <button className="rc-btn primary" onClick={() => navigate("/reception/patients")}>
            <UserPlus size={16} /> Add Patient
          </button>
        </div>
      </div>

      <div className="rc-stat-grid">
        <article className="rc-stat-card">
          <div className="rc-stat-icon blue">
            <CalendarCheck size={22} />
          </div>
          <span>Today</span>
          <p>Today's Appointments</p>
          <strong>{stats.today}</strong>
        </article>
        <article className="rc-stat-card">
          <div className="rc-stat-icon amber">
            <Clock size={22} />
          </div>
          <span>Today</span>
          <p>Waiting Patients</p>
          <strong>{stats.waiting}</strong>
        </article>
        <article className="rc-stat-card">
          <div className="rc-stat-icon green">
            <CheckCircle size={22} />
          </div>
          <span>Today</span>
          <p>Completed Appointments</p>
          <strong>{stats.completed}</strong>
        </article>
      </div>

      <div className="rc-action-grid">
        <button onClick={() => navigate("/reception/patients")}>
          <UserPlus size={22} />
          <span>
            <strong>Patients</strong>View and register patients
          </span>
        </button>
        <button onClick={() => navigate("/reception/appointments")}>
          <CalendarPlus size={22} />
          <span>
            <strong>Appointments</strong>Book and manage appointments
          </span>
        </button>
        <button onClick={() => navigate("/reception/billing")}>
          <ClipboardList size={22} />
          <span>
            <strong>Billing</strong>Create and review invoices
          </span>
        </button>
      </div>

      <div className="rc-card">
        <div className="rc-card-head">
          <div>
            <h3>Appointment List</h3>
            <p>{todayDate}</p>
          </div>
          <button className="rc-btn small" onClick={() => navigate("/reception/appointments")}>
            Manage
          </button>
        </div>
        <div className="rc-table compact">
          <div className="rc-table-head four">
            <span>S.No.</span>
            <span>Patient</span>
            <span>Doctor</span>
            <span>Time</span>
            <span>Status</span>
          </div>
          {latest.length ? (
            latest.map((item, index) => (
              <div className="rc-table-row four" key={item.id || item.appointmentId}>
                <span>{index + 1}</span>
                <span>{item.patientName || item.patient?.name || "-"}</span>
                <span>{item.doctorName || item.doctor?.name || "-"}</span>
                <span>{item.time || "-"}</span>
                <span>{item.status || "Scheduled"}</span>
              </div>
            ))
          ) : (
            <div className="rc-empty">No appointments found.</div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ReceptionDashboard;

