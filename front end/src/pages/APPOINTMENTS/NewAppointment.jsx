import React, { useMemo, useState } from "react";
import "./NewAppointment.css";
import { CalendarPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  createAppointmentId,
  DOCTOR_OPTIONS,
  loadAppointments,
  saveAppointments,
} from "./appointmentsData";
import { loadPatients } from "../PATIENTS/patientsData";
import { useToast } from "../../components/ToastProvider";
import {
  validateDate,
  validateRequired,
  validateSelected,
} from "../../utils/validation";

function NewAppointment() {
  const navigate = useNavigate();
  const toast = useToast();
  const patientOptions = useMemo(
    () => loadPatients().map((patient) => patient.name),
    []
  );

  const [form, setForm] = useState({
    patient: "",
    doctor: "",
    date: "",
    time: "",
    status: "Scheduled",
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
    setFieldErrors((previous) => ({ ...previous, [name]: "" }));
    setError("");
  };

  const validateForm = () => {
    const nextErrors = {
      patient: validateSelected(form.patient, "a patient"),
      doctor: validateSelected(form.doctor, "a doctor"),
      date: validateDate(form.date, "Date", { allowPast: false }),
      time: validateRequired(form.time, "Time"),
      status: validateSelected(form.status, "a status"),
    };

    Object.keys(nextErrors).forEach((key) => {
      if (!nextErrors[key]) delete nextErrors[key];
    });

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!validateForm()) {
      setError("Please fix the highlighted fields.");
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setError("");
    const existingAppointments = loadAppointments();
    const newAppointment = {
      id: createAppointmentId(existingAppointments),
      patient: form.patient,
      doctor: form.doctor,
      date: form.date,
      time: form.time,
      status: form.status,
    };

    saveAppointments([newAppointment, ...existingAppointments]);
    toast.success("Appointment booked successfully");
    navigate("/appointments");
  };

  return (
    <div className="new-appointment-page">
      <h2 className="new-appointment-title">New Appointment</h2>
      <p className="new-appointment-subtitle">Create a new appointment</p>

      <form className="new-appointment-form-card" onSubmit={handleSubmit} noValidate>
        <div className="new-appointment-grid">
          <div className="new-appointment-field">
            <label>Patient</label>
            <select
              name="patient"
              value={form.patient}
              onChange={handleChange}
              className={fieldErrors.patient ? "is-invalid" : ""}
            >
              <option value="">Select patient</option>
              {patientOptions.map((patient) => (
                <option value={patient} key={patient}>
                  {patient}
                </option>
              ))}
            </select>
            {fieldErrors.patient ? (
              <span className="new-appointment-field-error">{fieldErrors.patient}</span>
            ) : null}
          </div>

          <div className="new-appointment-field">
            <label>Doctor</label>
            <select
              name="doctor"
              value={form.doctor}
              onChange={handleChange}
              className={fieldErrors.doctor ? "is-invalid" : ""}
            >
              <option value="">Select doctor</option>
              {DOCTOR_OPTIONS.map((doctor) => (
                <option value={doctor} key={doctor}>
                  {doctor}
                </option>
              ))}
            </select>
            {fieldErrors.doctor ? (
              <span className="new-appointment-field-error">{fieldErrors.doctor}</span>
            ) : null}
          </div>

          <div className="new-appointment-field">
            <label>Date</label>
            <input
              name="date"
              type="date"
              value={form.date}
              onChange={handleChange}
              className={fieldErrors.date ? "is-invalid" : ""}
            />
            {fieldErrors.date ? (
              <span className="new-appointment-field-error">{fieldErrors.date}</span>
            ) : null}
          </div>

          <div className="new-appointment-field">
            <label>Time</label>
            <input
              name="time"
              type="time"
              value={form.time}
              onChange={handleChange}
              className={fieldErrors.time ? "is-invalid" : ""}
            />
            {fieldErrors.time ? (
              <span className="new-appointment-field-error">{fieldErrors.time}</span>
            ) : null}
          </div>

          <div className="new-appointment-field">
            <label>Status</label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className={fieldErrors.status ? "is-invalid" : ""}
            >
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            {fieldErrors.status ? (
              <span className="new-appointment-field-error">{fieldErrors.status}</span>
            ) : null}
          </div>
        </div>

        {error && <p className="new-appointment-error">{error}</p>}

        <div className="new-appointment-actions">
          <button type="submit" className="new-appointment-save-btn">
            <CalendarPlus size={16} /> Save Appointment
          </button>
        </div>
      </form>
    </div>
  );
}

export default NewAppointment;
