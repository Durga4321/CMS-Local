import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../../components/ToastProvider";
import { formatToday, parseList, requestJson } from "../receptionApi";
import { getReceptionistProfile } from "../receptionSession";
import { validateText } from "../../utils/validation";

const getSlotStart = (slot) => String(slot || "").split(" - ")[0].trim();

const getSlotEnd = (slot) => String(slot || "").split(" - ")[1]?.trim() || "";

const getMinutesFromTime = (value) => {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  return Number(match[1]) * 60 + Number(match[2]);
};

const formatTo12Hour = (time) => {
  if (!time) return "";
  const text = String(time || "").trim();
  if (/\b(am|pm)\b/i.test(text)) return text;
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return text;
  let hours = Number(match[1]);
  const minutes = match[2];
  const meridiem = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, "0")}:${minutes} ${meridiem}`;
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

const CHIEF_COMPLAINT_OPTIONS = [
  "Fever",
  "Cough",
  "Headache",
  "Cold",
  "Body pain",
  "Stomach pain",
  "Chest pain",
  "Back pain",
  "Vomiting",
  "Dizziness",
  "Other",
];

const VITAL_FIELDS = [
  {
    name: "bloodPressure",
    label: "Blood Pressure",
    unit: "mmHg",
    type: "bloodPressure",
    placeholder: "120/80",
  },
  {
    name: "sugarLevel",
    label: "Sugar Level",
    unit: "mg/dL",
    type: "decimal",
    placeholder: "100",
  },
  {
    name: "temperature",
    label: "Temperature",
    unit: "F",
    type: "decimal",
    placeholder: "98.6",
  },
  {
    name: "weight",
    label: "Weight",
    unit: "kg",
    type: "decimal",
    placeholder: "70",
  },
  {
    name: "pulseRate",
    label: "Pulse Rate",
    unit: "bpm",
    type: "integer",
    placeholder: "72",
  },
  {
    name: "respiratoryRate",
    label: "Respiratory Rate",
    unit: "breaths/min",
    type: "integer",
    placeholder: "16",
  },
];

const vitalFieldByName = VITAL_FIELDS.reduce((fields, field) => {
  fields[field.name] = field;
  return fields;
}, {});

const sanitizeVitalValue = (value, type) => {
  const text = String(value || "");

  if (type === "bloodPressure") {
    return text
      .replace(/[^\d/]/g, "")
      .replace(/\/{2,}/g, "/")
      .replace(/^(\d*\/\d*)\/.*$/, "$1");
  }

  if (type === "integer") {
    return text.replace(/\D/g, "");
  }

  return text
    .replace(/[^\d.]/g, "")
    .replace(/(\..*)\./g, "$1");
};

const validateVitalValue = (value, field) => {
  const text = String(value || "").trim();
  if (!text) return "";

  if (field.type === "bloodPressure") {
    return /^\d{2,3}\/\d{2,3}$/.test(text)
      ? ""
      : "Enter blood pressure like 120/80.";
  }

  if (field.type === "integer") {
    return /^\d+$/.test(text) ? "" : `${field.label} must be a number.`;
  }

  return /^\d+(\.\d+)?$/.test(text) ? "" : `${field.label} must be a number.`;
};

const validateChiefComplaintsLive = (value) => {
  const text = String(value || "").trim();
  return text ? validateText(text, "Chief complaints") : "";
};

const appendUnit = (value, unit) => {
  const text = String(value || "").trim();
  return text ? `${text} ${unit}` : "";
};

function ReceptionAppointments() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const requestedPatientId = String(searchParams.get("patientId") || "").trim();
  const receptionistHospitalId = String(
    getReceptionistProfile().hospitalId || ""
  ).trim();
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [isPatientMenuOpen, setIsPatientMenuOpen] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [doctorLoadMessage, setDoctorLoadMessage] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
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
        patientId: nextPatients.some(
          (patient) => String(getPatientId(patient)) === requestedPatientId
        )
          ? requestedPatientId
          : prev.patientId || String(getPatientId(nextPatients[0]) || ""),
        doctorId: nextDoctors.some(
          (doctor) => String(getDoctorId(doctor)) === String(prev.doctorId)
        )
          ? prev.doctorId
          : String(getDoctorId(nextDoctors[0]) || ""),
      }));
    });
  }, [receptionistHospitalId, requestedPatientId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getPatientId = (patient = {}) =>
    patient.id ?? patient.patientId ?? patient.PatientId ?? patient.PID ?? "";

  const getPatientName = (patient = {}) =>
    String(patient.name || patient.fullName || patient.patientName || "").trim();

  const selectedPatient = useMemo(
    () =>
      patients.find(
        (patient) => String(getPatientId(patient)) === String(form.patientId)
      ),
    [patients, form.patientId]
  );

  const patientCount = patients.length;

  const matchingPatients = useMemo(() => {
    const search = patientSearch.trim().toLowerCase();
    if (!search) return patients.slice(0, 8);

    return patients
      .filter((patient) => {
        const name = getPatientName(patient).toLowerCase();
        const id = String(getPatientId(patient) || "").toLowerCase();
        return name.includes(search) || id.includes(search);
      })
      .slice(0, 8);
  }, [patientSearch, patients]);

  useEffect(() => {
    if (selectedPatient) {
      setPatientSearch(getPatientName(selectedPatient));
    }
  }, [selectedPatient]);

  const parseSlots = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.slots)) return data.slots;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.result)) return data.result;
    return [];
  };

  const parseSlotLabel = (slot) => {
    if (!slot) return "";
    if (typeof slot === "string") return slot;
    if (slot.start && slot.end)
      return `${String(slot.start).slice(0, 5)} - ${String(slot.end).slice(0, 5)}`;
    if (slot.startTime && slot.endTime)
      return `${String(slot.startTime).slice(0, 5)} - ${String(slot.endTime).slice(0, 5)}`;
    if (slot.start_time && slot.end_time)
      return `${String(slot.start_time).slice(0, 5)} - ${String(slot.end_time).slice(0, 5)}`;
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

    const nextFieldErrors = VITAL_FIELDS.reduce((errors, field) => {
      const error = validateVitalValue(form[field.name], field);
      if (error) errors[field.name] = error;
      return errors;
    }, {});

    const chiefComplaintsError = validateText(
      form.chiefComplaints,
      "Chief complaints"
    );
    if (chiefComplaintsError) {
      nextFieldErrors.chiefComplaints = chiefComplaintsError;
    }

    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors);
      setMessage("Please fix the highlighted fields.");
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const selectedSlotStart = getSlotStart(selectedSlot);
    const selectedDoctor = doctors.find((d) => String(getDoctorId(d)) === String(form.doctorId));
    const hospitalIdForAppointment = Number(getRecordHospitalId(selectedDoctor)) || Number(receptionistHospitalId) || 0;
    const vitals = {
      bloodPressure: appendUnit(form.bloodPressure, vitalFieldByName.bloodPressure.unit),
      sugarLevel: appendUnit(form.sugarLevel, vitalFieldByName.sugarLevel.unit),
      temperature: appendUnit(form.temperature, vitalFieldByName.temperature.unit),
      weight: appendUnit(form.weight, vitalFieldByName.weight.unit),
      pulseRate: appendUnit(form.pulseRate, vitalFieldByName.pulseRate.unit),
      respiratoryRate: appendUnit(form.respiratoryRate, vitalFieldByName.respiratoryRate.unit),
    };
    const body = {
      doctorId: Number(form.doctorId),
      hospitalId: hospitalIdForAppointment,
      patientId: Number(form.patientId),
      date: form.date,
      appointmentDate: form.date,
      slot: selectedSlot,
      startTime: selectedSlotStart ? formatTo12Hour(selectedSlotStart) : "",
      time: selectedSlot,
      status: "Scheduled",
      chiefComplaints: form.chiefComplaints.trim(),
      bloodPressure: vitals.bloodPressure,
      bloodPressureUnit: vitalFieldByName.bloodPressure.unit,
      sugarLevel: vitals.sugarLevel,
      sugarLevelUnit: vitalFieldByName.sugarLevel.unit,
      temperature: vitals.temperature,
      temperatureUnit: vitalFieldByName.temperature.unit,
      weight: vitals.weight,
      weightUnit: vitalFieldByName.weight.unit,
      pulseRate: vitals.pulseRate,
      pulseRateUnit: vitalFieldByName.pulseRate.unit,
      respiratoryRate: vitals.respiratoryRate,
      respiratoryRateUnit: vitalFieldByName.respiratoryRate.unit,
      vitals,
    };

    try {
      console.debug("Booking payload", { selectedDoctor, hospitalIdForAppointment, body });
      await requestJson("Appointment", { method: "POST", body: JSON.stringify(body) });
      setMessage("Appointment booked successfully.");
      toast.success("Appointment booked successfully");
      setSelectedSlot("");
      refresh();
    } catch (error) {
      console.error("Booking failed", { error, selectedDoctor, hospitalIdForAppointment, body });
      const text = error.message || "Unable to book appointment.";
      setMessage(text);
      toast.error(text);
    }
  };

  const setField = (name, value) => {
    const vitalField = vitalFieldByName[name];
    const nextValue = vitalField
      ? sanitizeVitalValue(value, vitalField.type)
      : value;

    setForm((prev) => ({ ...prev, [name]: nextValue }));

    if (vitalField) {
      setFieldErrors((prev) => ({
        ...prev,
        [name]: validateVitalValue(nextValue, vitalField),
      }));
    } else if (name === "chiefComplaints") {
      setFieldErrors((prev) => ({
        ...prev,
        chiefComplaints: validateChiefComplaintsLive(nextValue),
      }));
    }
  };

  const selectPatient = (patient) => {
    setField("patientId", String(getPatientId(patient)));
    setPatientSearch(getPatientName(patient));
    setIsPatientMenuOpen(false);
  };

  const handlePatientSearch = (value) => {
    setPatientSearch(value);
    setIsPatientMenuOpen(true);

    const exactMatch = patients.find((patient) => {
      const nameMatches =
        getPatientName(patient).toLowerCase() === value.trim().toLowerCase();
      const idMatches =
        String(getPatientId(patient)).toLowerCase() === value.trim().toLowerCase();
      return nameMatches || idMatches;
    });

    setField("patientId", exactMatch ? String(getPatientId(exactMatch)) : "");
  };

  return (
    <section className="rc-page">
      <div className="rc-page-head">
        <div>
          <h2>Appointment Booking</h2>
          <p>Select patient, doctor, date, lock a slot, and confirm booking.</p>
          <p>{patientCount} registered patient{patientCount === 1 ? "" : "s"} available for booking.</p>
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
            <div className="rc-patient-autocomplete">
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => handlePatientSearch(e.target.value)}
                onFocus={() => setIsPatientMenuOpen(true)}
                onBlur={() => setTimeout(() => setIsPatientMenuOpen(false), 150)}
                placeholder="Type to search patient name"
                autoComplete="off"
                aria-label="Search patient by name"
                aria-autocomplete="list"
                // eslint-disable-next-line jsx-a11y/role-supports-aria-props
                aria-expanded={isPatientMenuOpen}
              />
              {isPatientMenuOpen ? (
                <div className="rc-patient-autocomplete-menu" role="listbox">
                  {matchingPatients.length > 0 ? (
                    matchingPatients.map((patient) => (
                      <button
                        key={getPatientId(patient)}
                        type="button"
                        role="option"
                        aria-selected={String(getPatientId(patient)) === String(form.patientId)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectPatient(patient)}
                      >
                        <strong>{getPatientName(patient) || "Unnamed patient"}</strong>
                        <span>Patient ID: {getPatientId(patient)}</span>
                      </button>
                    ))
                  ) : (
                    <div className="rc-patient-autocomplete-empty">No matching patients found.</div>
                  )}
                </div>
              ) : null}
            </div>
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
          <label>
            <span>Chief Complaints</span>
            <input
              list="chief-complaint-options"
              value={form.chiefComplaints}
              onChange={(e) => setField("chiefComplaints", e.target.value)}
              placeholder="Select or type complaint"
              autoComplete="off"
              className={fieldErrors.chiefComplaints ? "is-invalid" : ""}
            />
            <datalist id="chief-complaint-options">
              {CHIEF_COMPLAINT_OPTIONS.map((complaint) => (
                <option key={complaint} value={complaint} />
              ))}
            </datalist>
            {fieldErrors.chiefComplaints ? (
              <small className="rc-field-error">
                {fieldErrors.chiefComplaints}
              </small>
            ) : null}
          </label>

          {VITAL_FIELDS.map((field) => (
            <label key={field.name}>
              <span>{field.label}</span>
              <div className="rc-unit-input">
                <input
                  value={form[field.name]}
                  onChange={(e) => setField(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  inputMode={field.type === "bloodPressure" ? "numeric" : "decimal"}
                  className={fieldErrors[field.name] ? "is-invalid" : ""}
                />
                <span>{field.unit}</span>
              </div>
              {fieldErrors[field.name] ? (
                <small className="rc-field-error">{fieldErrors[field.name]}</small>
              ) : null}
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
