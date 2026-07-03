import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import "./Appointments.css";

import {
  Eye,
  Search,
  X,
} from "lucide-react";

import AppointmentModal from "./AppointmentModal";
import { apiUrl } from "../../config/api";
import { formatDateMMDDYYYY } from "../../utils/dateFormat";

// ================= API =================

const APPOINTMENT_API =
  apiUrl("Appointment");

// ================= FORMAT =================

const emptyValue = "-";

const getDateKey = (value) => {
  if (!value)
    return "";

  return String(value).split("T")[0];
};

const formatDate = (value) => formatDateMMDDYYYY(getDateKey(value), emptyValue);

const formatTime = (value) => {
  if (!value)
    return emptyValue;

  return value;
};

const getInitials = (name) => {
  return (
    name
      ?.split(" ")
      ?.filter(Boolean)
      ?.map((part) => part[0])
      ?.join("")
      ?.slice(0, 2)
      ?.toUpperCase() || "P"
  );
};

const normalizeAppointment = (item) => {
  const patientName =
    item.patientName ||
    item.patient?.name ||
    emptyValue;

  const doctorName =
    item.doctorName ||
    item.doctor?.name ||
    emptyValue;

  const date =
    item.date ||
    item.appointmentDate ||
    "";

  const appointmentId =
    item.appointmentId ||
    item.id ||
    item.tokenNumber;

  return {
    ...item,
    appointmentId,
    date,
    dateKey: getDateKey(date),
    displayDate: formatDate(date),
    displayTime: formatTime(item.time),
    tokenNumber:
      item.tokenNumber ||
      item.token ||
      (appointmentId ? `APT-${appointmentId}` : emptyValue),
    chiefComplaints:
      item.chiefComplaints ||
      item.complaint ||
      item.reason ||
      emptyValue,
    status:
      item.status ||
      "Scheduled",
    patient: {
      ...item.patient,
      name: patientName,
      code:
        item.patientCode ||
        item.patient?.code ||
        item.patient?.patientCode ||
        emptyValue,
      age:
        item.age ??
        item.patient?.age ??
        emptyValue,
      gender:
        item.gender ||
        item.patient?.gender ||
        emptyValue,
      phone:
        item.phone ||
        item.patient?.phone ||
        emptyValue,
      email:
        item.patient?.email ||
        item.email ||
        emptyValue,
    },
    doctor: {
      ...item.doctor,
      name: doctorName,
      specialization:
        item.doctorSpecialization ||
        item.doctor?.specialization ||
        emptyValue,
    },
    vitals: {
      bloodPressure:
        item.bloodPressure ||
        emptyValue,
      sugarLevel:
        item.sugarLevel ||
        emptyValue,
      temperature:
        item.temperature ||
        emptyValue,
      weight:
        item.weight ||
        emptyValue,
      pulseRate:
        item.pulseRate ||
        emptyValue,
      respiratoryRate:
        item.respiratoryRate ||
        emptyValue,
    },
  };
};

// ================= PARSE =================

const parseAppointments = (data) => {
  const records =
    Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
        ? data.data
        : [];

  return records
    .filter(Boolean)
    .map(normalizeAppointment);
};

function Appointments() {

  const [selected, setSelected] =
    useState(null);

  const [appointments, setAppointments] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [dateFilter, setDateFilter] =
    useState("");

  const [doctorFilter, setDoctorFilter] =
    useState("all");

  const [search, setSearch] =
    useState("");

  // ================= FETCH =================

  const fetchAppointments =
    async () => {

      try {

        setLoading(true);

        setError("");

        const response = await fetch(
          APPOINTMENT_API,
          {
            headers: {
              "ngrok-skip-browser-warning":
                "true",
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load appointments."
          );
        }

        const data =
          await response.json();

        console.log(
          "APPOINTMENTS:",
          data
        );

        setAppointments(
          parseAppointments(data)
        );

      } catch (error) {

        console.error(error);

        setError(
          error.message ||
          "Unable to load appointments."
        );

      } finally {

        setLoading(false);
      }
    };

  // ================= LOAD =================

  useEffect(() => {
    fetchAppointments();
  }, []);

  // ================= DOCTOR OPTIONS =================

  const doctorOptions =
    useMemo(() => {

      return [
        ...new Set(
          appointments.map(
            (item) =>
              item.doctor?.name
          )
            .filter(
              (name) =>
                name &&
                name !== emptyValue
            )
        ),
      ].sort();

    }, [appointments]);

  // ================= FILTER =================

  const filteredAppointments =
  useMemo(() => {

    return appointments.filter(
      (item) => {
        const query =
          search
            .trim()
            .toLowerCase();

        const searchableText = [
          item.tokenNumber,
          item.patient?.name,
          item.patient?.code,
          item.patient?.phone,
          item.doctor?.name,
          item.chiefComplaints,
          item.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesDate =
          !dateFilter ||
          item.dateKey === dateFilter;

        const matchesDoctor =
          doctorFilter === "all" ||
          item.doctor?.name ===
          doctorFilter;

        const matchesSearch =
          !query ||
          searchableText.includes(query);

        return (
          matchesDate &&
          matchesDoctor &&
          matchesSearch
        );
      }
    );

  }, [
    appointments,
    dateFilter,
    doctorFilter,
    search,
  ]);
  // ================= STATUS =================

  const getStatusClass =
    (status) => {

      if (
        status === "Completed"
      )
        return "is-completed";

      if (
        status === "Cancelled"
      )
        return "is-cancelled";

      return "is-scheduled";
    };

  const hasFilters =
    Boolean(dateFilter) ||
    doctorFilter !== "all" ||
    Boolean(search.trim());

  return (
    <div className="appointments-page">

      {/* HEADER */}

      <div className="appointments-header">

        <div>

          <h2 className="appointments-title">
            Appointments
          </h2>

          <p className="appointments-subtitle">

            {loading
              ? "Loading..."
              : `${filteredAppointments.length} appointments shown`}

          </p>

        </div>
      </div>

      {/* ERROR */}

      {error ? (
        <div className="appointments-empty">
          {error}
        </div>
      ) : null}

      {/* TABLE CARD */}

      <div className="appointments-table-card">

        {/* FILTERS */}

        <div className="appointments-filters">

          {/* SEARCH */}

          <div className="appointments-filter-group appointments-search-group">

            <label>Search</label>

            <div className="appointments-search-bar">

              <Search size={19} />

              <input
                type="search"
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Patient, token, phone..."
              />

            </div>

          </div>

          {/* DATE */}

          <div className="appointments-filter-group">

            <label>Date</label>

            <input
              type="date"
              value={dateFilter}
              onChange={(e) =>
                setDateFilter(
                  e.target.value
                )
              }
            />

          </div>

          {/* DOCTOR */}

          <div className="appointments-filter-group">

            <label>Doctor</label>

            <select
              value={doctorFilter}
              onChange={(e) =>
                setDoctorFilter(
                  e.target.value
                )
              }
            >

              <option value="all">
                All doctors
              </option>

              {doctorOptions.map(
                (doctor) => (

                  <option
                    value={doctor}
                    key={doctor}
                  >
                    Dr. {doctor}
                  </option>
                )
              )}

            </select>

          </div>

          {/* CLEAR */}

          <button
            type="button"
            className="appointments-clear-btn"
            disabled={!hasFilters}
            onClick={() => {
              setSearch("");
              setDateFilter("");
              setDoctorFilter("all");
            }}
          >

            <X size={16} />

            <span>Clear</span>

          </button>

        </div>

        <div className="appointments-table-scroll">

          {/* TABLE HEADER */}

          <div className="appointments-thead">

            <span>S.No.</span>

            <span>Patient</span>

            <span>Doctor</span>

            <span>Schedule</span>

            <span>Complaint</span>

            <span>Status</span>

            <span>Actions</span>

          </div>

          {/* EMPTY */}

          {!loading &&
            filteredAppointments.length === 0 ? (

            <div className="appointments-empty">
              No appointments found.
            </div>

          ) : null}

          {/* ROWS */}

          {filteredAppointments.map(
            (item, index) => (

              <div
                className="appointments-row"
                key={item.appointmentId}
              >
                <span>{index + 1}</span>

                {/* PATIENT */}

                <div className="appointments-patient-cell">

                  <div className="appointments-avatar">

                    {getInitials(
                      item.patient?.name
                    )}

                  </div>

                  <div className="appointments-cell-stack">

                    <b>
                      {item.patient?.name}
                    </b>

                    <span>
                      {item.tokenNumber}
                    </span>

                    <span>
                      {item.patient?.code}
                    </span>

                  </div>
                </div>

                {/* DOCTOR */}

                <div className="appointments-cell-stack">

                  <b>
                    Dr. {item.doctor?.name}
                  </b>

                  <span>
                    {item.doctor?.specialization}
                  </span>

                </div>

                {/* SCHEDULE */}

                <div className="appointments-cell-stack">

                  <b>
                    {item.displayDate}
                  </b>

                  <span>
                    {item.displayTime}
                  </span>

                </div>

                {/* COMPLAINT */}

                <span className="appointments-complaint">
                  {item.chiefComplaints}
                </span>

                {/* STATUS */}

                <span
                  className={`appointments-status-badge ${getStatusClass(
                    item.status
                  )}`}
                >

                  <span className="appointments-status-dot"></span>

                  {item.status}

                </span>

                {/* ACTION */}

                <button
                  type="button"
                  className="appointments-view-btn"
                  onClick={() =>
                    setSelected(item)
                  }
                >

                  <Eye size={16} />

                  <span>View</span>

                </button>

              </div>
            )
          )}
        </div>
      </div>

      {/* MODAL */}

      {selected && (

        <AppointmentModal
          data={selected}
          onClose={() =>
            setSelected(null)
          }
        />

      )}
    </div>
  );
}

export default Appointments;
