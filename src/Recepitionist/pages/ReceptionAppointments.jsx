import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../components/ToastProvider";
import { formatToday, parseList, requestJson } from "../receptionApi";
import { getReceptionistProfile } from "../receptionSession";

const getSlotStart = (slot) => String(slot || "").split(" - ")[0].trim();

const getSlotEnd = (slot) => String(slot || "").split(" - ")[1]?.trim() || "";

const getMinutesFromTime = (value) => {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  return Number(match[1]) * 60 + Number(match[2]);
};

const isToday = (date) => {
  const today = new Date();
  const [year, month, day] = String(date || "").split("-").map(Number);

  return (
    today.getFullYear() === year &&
    today.getMonth() + 1 === month &&
    today.getDate() === day
  );
};

const isCompletedSlot = (slotLabel, date) => {
  if (!isToday(date)) return false;

  const slotEndMinutes = getMinutesFromTime(getSlotEnd(slotLabel));
  if (slotEndMinutes === null) return false;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return slotEndMinutes <= nowMinutes;
};

const getSlotStatus = (slot) => String(slot?.status || "").trim().toLowerCase();

const isTimeOutSlot = (slot) => {
  const status = getSlotStatus(slot);
  return status === "time out" || status === "timeout" || status === "completed";
};

const isBookedSlot = (slot) => {
  const status = getSlotStatus(slot);
  return status === "booked" || slot?.isBooked;
};

const getRecordHospitalId = (record = {}) =>
  record.hospitalId ??
  record.HospitalId ??
  record.clinicId ??
  record.ClinicId ??
  record.hospital?.id ??
  record.clinic?.id ??
  "";

const getDoctorId = (doctor = {}) =>
  doctor.id ?? doctor.doctorId ?? doctor.DoctorId ?? "";

const isActiveDoctor = (doctor = {}) => {
  if (typeof doctor.isActive === "boolean") return doctor.isActive;
  const status = String(doctor.status || "").trim().toLowerCase();
  return !status || status === "active";
};

function ReceptionAppointments() {
  const navigate = useNavigate();
  const toast = useToast();
  const receptionistHospitalId = String(
    getReceptionistProfile().hospitalId || ""
  ).trim();
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [doctorLoadMessage, setDoctorLoadMessage] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    patientId: "",
    doctorId: "",
    date: formatToday(),
    chiefComplaints: "",
    bloodPressure: "",
    sugarLevel: "",
    temperature: "",
    weight: "",
    pulseRate: "",
    respiratoryRate: "",
  });

  const refresh = useCallback(() => {
    setDoctorLoadMessage("");

    Promise.all([
      requestJson("Patient").catch(() => []),
      requestJson("Doctor")
        .then((data) => ({ data, error: "" }))
        .catch((error) => ({
          data: [],
          error: error.message || "Unable to load doctors.",
        })),
      requestJson("Appointment").catch(() => []),
    ]).then(([patientData, doctorResult, appointmentData]) => {
      const nextPatients = parseList(patientData);
      const activeDoctors = parseList(doctorResult.data).filter(isActiveDoctor);
      const nextDoctors = receptionistHospitalId
        ? activeDoctors.filter(
            (doctor) =>
              String(getRecordHospitalId(doctor)).trim() ===
              receptionistHospitalId
          )
        : activeDoctors;

      if (doctorResult.error) {
        setDoctorLoadMessage(doctorResult.error);
      } else if (nextDoctors.length === 0) {
        setDoctorLoadMessage(
          receptionistHospitalId
            ? `No active doctors are assigned to hospital ${receptionistHospitalId}.`
            : "No active doctors are available for this receptionist."
        );
      } else {
        setDoctorLoadMessage("");
      }

      setPatients(nextPatients);
      setDoctors(nextDoctors);
      setAppointments(parseList(appointmentData));
      setForm((prev) => ({
        ...prev,
        patientId: prev.patientId || String(nextPatients[0]?.id || ""),
        doctorId: nextDoctors.some(
          (doctor) => String(getDoctorId(doctor)) === String(prev.doctorId)
        )
          ? prev.doctorId
          : String(getDoctorId(nextDoctors[0]) || ""),
      }));
    });
  }, [receptionistHospitalId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const parseSlots = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.slots)) return data.slots;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const parseSlotLabel = (slot) => {
    if (!slot) return "";
    if (typeof slot === "string") return slot;
    if (slot.start && slot.end)
      return `${String(slot.start).slice(0, 5)} - ${String(slot.end).slice(0, 5)}`;
    if (slot.slot) return String(slot.slot);
    return String(slot);
  };

  const bookedSlots = useMemo(() => {
    return new Set(
      appointments
        .filter((item) => String(item.date || item.appointmentDate || "").startsWith(form.date))
        .filter(
          (item) => String(item.doctorId || item.doctor?.id || "") === String(form.doctorId)
        )
        .map((item) => getSlotStart(item.slot || item.startTime || item.time || ""))
        .filter(Boolean)
    );
  }, [appointments, form.date, form.doctorId]);

  const visibleSlots = useMemo(() => {
    return availableSlots.filter((slot) => {
      const label = parseSlotLabel(slot);
      return !(isTimeOutSlot(slot) || isCompletedSlot(label, form.date));
    });
  }, [availableSlots, form.date]);

  useEffect(() => {
    if (!form.doctorId || !form.date) {
      setAvailableSlots([]);
      setSelectedSlot("");
      return;
    }

    setSlotLoading(true);
    requestJson(`Schedule/day-slots?doctorId=${form.doctorId}&date=${form.date}`)
      .then((data) => {
        const slots = parseSlots(data);
        setAvailableSlots(slots);
        setSelectedSlot("");
      })
      .catch(() => {
        setAvailableSlots([]);
      })
      .finally(() => setSlotLoading(false));
  }, [form.doctorId, form.date]);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.patientId || !form.doctorId || !selectedSlot) {
      setMessage("Please select patient, doctor, date, and time slot.");
      toast.error("Please select patient, doctor, date, and time slot.");
      return;
    }

    const selectedSlotStart = getSlotStart(selectedSlot);
    const body = {
      doctorId: Number(form.doctorId),
      patientId: Number(form.patientId),
      date: form.date,
      appointmentDate: form.date,
      slot: selectedSlot,
      startTime: selectedSlotStart ? `${selectedSlotStart}:00` : "",
      time: selectedSlot,
      status: "Scheduled",
      chiefComplaints: form.chiefComplaints,
      bloodPressure: form.bloodPressure,
      sugarLevel: form.sugarLevel,
      temperature: form.temperature,
      weight: form.weight,
      pulseRate: form.pulseRate,
      respiratoryRate: form.respiratoryRate,
    };

    try {
      await requestJson("Appointment", { method: "POST", body: JSON.stringify(body) });
      setMessage("Appointment booked successfully.");
      toast.success("Appointment booked successfully");
      setSelectedSlot("");
      refresh();
    } catch (error) {
      const text = error.message || "Unable to book appointment.";
      setMessage(text);
      toast.error(text);
    }
  };

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  return (
    <section className="rc-page">
      <div className="rc-page-head">
        <div>
          <h2>Appointment Booking</h2>
          <p>Select patient, doctor, date, lock a slot, and confirm booking.</p>
        </div>
        <div className="rc-head-actions">
          <button className="rc-btn" onClick={() => navigate("/reception/dashboard")}>
            <ArrowLeft size={16} /> Dashboard
          </button>
        </div>
      </div>

      {message ? <div className="rc-alert">{message}</div> : null}

      <form className="rc-card rc-booking-form" onSubmit={submit} noValidate>
        <div className="rc-booking-fields">
          <h3>Book Appointment</h3>
          <label>
            <span>Patient</span>
            <select value={form.patientId} onChange={(e) => setField("patientId", e.target.value)}>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Doctor</span>
            <select value={form.doctorId} onChange={(e) => setField("doctorId", e.target.value)}>
              {doctors.length === 0 ? (
                <option value="">
                  {doctorLoadMessage || "No doctors available"}
                </option>
              ) : null}
              {doctors.map((d) => (
                <option key={getDoctorId(d)} value={getDoctorId(d)}>
                  {d.name}
                  {d.specialization ? ` - ${d.specialization}` : ""}
                </option>
              ))}
            </select>
            {doctorLoadMessage ? (
              <small className="rc-field-message">{doctorLoadMessage}</small>
            ) : null}
          </label>
          <label>
            <span>Date</span>
            <input type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} />
          </label>
          {[
            "chiefComplaints",
            "bloodPressure",
            "sugarLevel",
            "temperature",
            "weight",
            "pulseRate",
            "respiratoryRate",
          ].map((field) => (
            <label key={field}>
              <span>{field.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}</span>
              <input value={form[field]} onChange={(e) => setField(field, e.target.value)} />
            </label>
          ))}
        </div>

        <div className="rc-slot-panel">
          <div className="rc-slot-head">
            <strong>Time Slots</strong>
            <span>Available&nbsp;&nbsp; Booked</span>
          </div>
          <div className="rc-slots">
            {slotLoading ? (
              <div className="rc-slot-loading">Loading slots...</div>
            ) : visibleSlots.length > 0 ? (
              visibleSlots.map((slot) => {
                const label = parseSlotLabel(slot);
                const slotStart = getSlotStart(label);
                const isBooked = Boolean(isBookedSlot(slot) || bookedSlots.has(slotStart));
                const isSelected = selectedSlot && getSlotStart(selectedSlot) === slotStart;
                return (
                  <button
                    type="button"
                    key={label}
                    disabled={isBooked}
                    className={[
                      isSelected ? "selected" : "",
                      isBooked ? "booked" : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => setSelectedSlot(label)}
                  >
                    {label} - {isBooked ? "BOOKED" : "AVAILABLE"}
                  </button>
                );
              })
            ) : (
              <div className="rc-slot-empty">No slots available for this doctor on the selected date.</div>
            )}
          </div>
          <button type="submit" className="rc-confirm">
            <CheckCircle size={16} /> Confirm Booking
          </button>
        </div>
      </form>
    </section>
  );
}

export default ReceptionAppointments;
