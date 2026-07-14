import React from "react";

import "./AppointmentModal.css";

import { X } from "lucide-react";

const emptyValue = "-";

const displayValue = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  )
    return emptyValue;

  return value;
};

const DetailItem = ({
  label,
  value,
}) => (
  <div className="appointment-modal-detail-item">
    <label>{label}</label>
    <p>{displayValue(value)}</p>
  </div>
);

function AppointmentModal({
  data,
  onClose,
}) {
  const patientMeta = [
    data.patient?.age &&
      `${data.patient.age} years`,
    data.patient?.gender,
  ]
    .filter(
      (value) =>
        value &&
        value !== emptyValue
    )
    .join(" / ");

  const scheduleText = [
    data.displayDate ||
      data.date,
    data.displayTime ||
      data.time,
  ]
    .filter(
      (value) =>
        value &&
        value !== emptyValue
    )
    .join(" at ");

  return (
    <div className="appointment-modal-overlay">

      <div className="appointment-modal-card">

        {/* HEADER */}

        <div className="appointment-modal-header">

          <h3>
            Appointment Details
          </h3>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close appointment details"
          >

            <X size={18} />

          </button>

        </div>

        {/* DETAILS */}

        <div className="appointment-modal-details">

          <section className="appointment-modal-section">

            <h4>Patient</h4>

            <div className="appointment-modal-grid">

              <DetailItem
                label="Name"
                value={data.patient?.name}
              />

              <DetailItem
                label="Patient Code"
                value={data.patient?.code}
              />

              <DetailItem
                label="Age / Gender"
                value={patientMeta}
              />

              <DetailItem
                label="Phone"
                value={data.patient?.phone}
              />

            </div>
          </section>

          <section className="appointment-modal-section">

            <h4>Doctor & Schedule</h4>

            <div className="appointment-modal-grid">

              <DetailItem
                label="Doctor"
                value={`Dr. ${displayValue(data.doctor?.name)}`}
              />

              <DetailItem
                label="Specialization"
                value={data.doctor?.specialization}
              />

              <DetailItem
                label="Token"
                value={data.tokenNumber}
              />

              <DetailItem
                label="Date / Time"
                value={scheduleText}
              />

            </div>
          </section>

          <section className="appointment-modal-section">

            <h4>Clinical Notes</h4>

            <div className="appointment-modal-grid">

              <DetailItem
                label="Chief Complaints"
                value={data.chiefComplaints}
              />

              <DetailItem
                label="Status"
                value={data.status}
              />

            </div>
          </section>

          <section className="appointment-modal-section">

            <h4>Vitals</h4>

            <div className="appointment-modal-grid appointment-modal-vitals">

              <DetailItem
                label="Blood Pressure"
                value={
                  data.vitals?.bloodPressure ||
                  data.bloodPressure
                }
              />

              <DetailItem
                label="Sugar Level"
                value={
                  data.vitals?.sugarLevel ||
                  data.sugarLevel
                }
              />

              <DetailItem
                label="Temperature"
                value={
                  data.vitals?.temperature ||
                  data.temperature
                }
              />

              <DetailItem
                label="Weight"
                value={
                  data.vitals?.weight ||
                  data.weight
                }
              />

              <DetailItem
                label="Pulse Rate"
                value={
                  data.vitals?.pulseRate ||
                  data.pulseRate
                }
              />

              <DetailItem
                label="Respiratory Rate"
                value={
                  data.vitals?.respiratoryRate ||
                  data.respiratoryRate
                }
              />

            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

export default AppointmentModal;
