import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import "./Patients.css";

import {
  Search,
  Eye,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { apiUrl } from "../../config/api";

// ================= API =================

const PATIENT_API_URL =
  apiUrl("Patient");

// ================= RESPONSE =================

const parsePatientResponse = (data) => {

  if (Array.isArray(data))
    return data;

  if (Array.isArray(data?.data))
    return data.data;

  return [];
};

function Patients() {

  const navigate = useNavigate();

  const [patients, setPatients] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  // ================= FETCH =================

  const fetchPatients = async () => {

    try {

      setLoading(true);

      setError("");

      const response = await fetch(
        PATIENT_API_URL,
        {
          headers: {
            "ngrok-skip-browser-warning":
              "true",
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load patients."
        );
      }

      const data =
        await response.json();

      console.log(
        "PATIENT API:",
        data
      );

      setPatients(
        parsePatientResponse(data)
      );

    } catch (error) {

      console.error(error);

      setError(
        error.message ||
        "Unable to load patients."
      );

    } finally {

      setLoading(false);
    }
  };

  // ================= LOAD =================

  useEffect(() => {
    fetchPatients();
  }, []);

  // ================= SEARCH =================

  const filteredPatients =
    useMemo(() => {

      return patients.filter(
        (patient) => {

          const query =
            search
              .trim()
              .toLowerCase();

          if (!query)
            return true;

          return (
            patient.name
              ?.toLowerCase()
              .includes(query) ||

            patient.phone
              ?.toLowerCase()
              .includes(query)
          );
        }
      );
    }, [patients, search]);

  // ================= INITIALS =================

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

  return (
    <div className="patients-page">

      {/* HEADER */}

      <div className="patients-header">

        <div>

          <h2 className="patients-title">
            Patients
          </h2>

          <p className="patients-subtitle">

            {loading
              ? "Loading..."
              : `${filteredPatients.length} patients in records`}

          </p>

        </div>
      </div>

      {/* ERROR */}

      {error ? (
        <div className="patients-empty">
          {error}
        </div>
      ) : null}

      {/* TABLE */}

      <div className="patients-table">

        {/* SEARCH */}

        <div className="patients-search-wrap">

          <div className="patients-search-bar">

            <Search size={20} />

            <input
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Search by name or phone..."
            />

          </div>
        </div>

        {/* HEADER */}

        <div className="patients-thead">

          <span>S.No.</span>

          <span>Patient</span>

          <span>Phone</span>

          <span>Age</span>

          <span>Gender</span>

          <span>Last Visit</span>

          <span>Actions</span>

        </div>

        {/* EMPTY */}

        {!loading &&
          filteredPatients.length === 0 ? (

          <div className="patients-empty">
            No patients found.
          </div>

        ) : null}

        {/* ROWS */}

        {filteredPatients.map(
          (patient, index) => {

            return (

              <div
                className="patients-row"
                key={patient.id}
              >
                <span>{index + 1}</span>

                {/* INFO */}

                <div className="patients-info">

                  <div className="patients-avatar">

                    {getInitials(
                      patient.name
                    )}

                  </div>

                  <div>

                    <b>
                      {patient.name}
                    </b>

                    <p>
                      {patient.patientCode ||
                        `P${String(
                          patient.id
                        ).padStart(
                          3,
                          "0"
                        )}`}
                    </p>

                  </div>
                </div>

                {/* PHONE */}

                <span>
                  {patient.phone || "-"}
                </span>

                {/* AGE */}

                <span>
                  {patient.age || "-"}
                </span>

                {/* GENDER */}

                <span>
                  {patient.gender || "-"}
                </span>

                {/* LAST VISIT */}

                <span>

                  {patient.lastVisit &&
                    patient.lastVisit !==
                    "0001-01-01T00:00:00"

                    ? patient.lastVisit.split(
                      "T"
                    )[0]

                    : "-"}

                </span>

                {/* ACTION */}

                <button
                  type="button"
                  className="patients-view-btn"
                  onClick={() =>
                    navigate(
                      `/patients/${patient.id}`,
                      {
                        state: {
                          patient,
                        },
                      }
                    )
                  }
                >

                  <Eye size={16} />

                  View

                </button>

              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

export default Patients;
