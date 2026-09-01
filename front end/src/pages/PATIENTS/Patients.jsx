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
import { formatDateMMDDYYYY } from "../../utils/dateFormat";
import {
  buildBranchOptions,
  fetchBranchesForHospital,
  getRecordBranchIds,
  getStoredHospitalId,
} from "../../utils/branchApi";

const PATIENT_API_URL =
  apiUrl("Patient");

const formatPatientLastVisit = (value) => {
  if (!value || value === "0001-01-01T00:00:00")
    return "-";

  return formatDateMMDDYYYY(value, "-");
};

const parsePatientResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const getPatientBranchName = (patient = {}, branchNameById = {}) => {
  const directName =
    patient.branchName ||
    patient.BranchName ||
    patient.branch?.name ||
    patient.branch?.branchName ||
    patient.Branch?.name ||
    patient.Branch?.Name ||
    "";

  if (directName) return directName;

  const branchId = getRecordBranchIds(patient)[0];
  return branchId ? branchNameById[String(branchId)] || "-" : "-";
};

function Patients() {
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");

  const fetchPatients = async () => {
    try {
      setLoading(true);
      setError("");

      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("adminToken") ||
        localStorage.getItem("superAdminToken");

      const response = await fetch(PATIENT_API_URL, {
        headers: {
          "ngrok-skip-browser-warning": "true",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) throw new Error("Unable to load patients.");

      const data = await response.json();
      console.log("PATIENT API:", data);
      setPatients(parsePatientResponse(data));
    } catch (error) {
      console.error(error);
      setError(error.message || "Unable to load patients.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadBranches = async () => {
      try {
        const list = await fetchBranchesForHospital(getStoredHospitalId());
        if (!cancelled) setBranches(buildBranchOptions(list));
      } catch (error) {
        console.error("Unable to load branches for patient filter.", error);
      }
    };

    loadBranches();

    return () => {
      cancelled = true;
    };
  }, []);

  const branchNameById = useMemo(
    () => Object.fromEntries(branches.map((branch) => [String(branch.id), branch.name])),
    [branches]
  );

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();
    const selectedBranch = branches.find((branch) => String(branch.id) === String(branchFilter));
    const selectedBranchName = selectedBranch?.name?.trim().toLowerCase() || "";

    return patients.filter((patient) => {
      const branchIds = getRecordBranchIds(patient);
      const branchName = getPatientBranchName(patient, branchNameById).trim().toLowerCase();
      const matchesBranch =
        branchFilter === "all" ||
        branchIds.some((id) => String(id) === String(branchFilter)) ||
        (selectedBranchName && branchName === selectedBranchName);

      if (!matchesBranch) return false;
      if (!query) return true;

      return (
        patient.name?.toLowerCase().includes(query) ||
        patient.phone?.toLowerCase().includes(query) ||
        getPatientBranchName(patient, branchNameById).toLowerCase().includes(query)
      );
    });
  }, [branchNameById, branches, branchFilter, patients, search]);

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
      <div className="patients-header">
        <div>
          <h2 className="patients-title">Patients</h2>
          <p className="patients-subtitle">
            {loading ? "Loading..." : `${filteredPatients.length} patients in records`}
          </p>
        </div>
      </div>

      {error ? <div className="patients-empty">{error}</div> : null}

      <div className="patients-table">
        <div className="patients-search-wrap">
          <div className="patients-search-bar">
            <Search size={20} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone..."
            />
          </div>

          <select
            className="patients-branch-filter"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="all">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>

        <div className="patients-table-scroll" tabIndex="0">
          <div className="patients-thead">
            <span>S.No.</span>
            <span>Patient</span>
            <span>Phone</span>
            <span>Age</span>
            <span>Gender</span>
            <span>Branch</span>
            <span>Last Visit</span>
            <span>Actions</span>
          </div>

          {!loading && filteredPatients.length === 0 ? (
            <div className="patients-empty">No patients found.</div>
          ) : null}

          {filteredPatients.map((patient, index) => (
            <div className="patients-row" key={patient.id || patient.patientCode || index}>
              <span>{index + 1}</span>

              <div className="patients-info">
                <div className="patients-avatar">{getInitials(patient.name)}</div>
                <div>
                  <b>{patient.name}</b>
                  <p>
                    {patient.patientCode ||
                      `P${String(patient.id).padStart(3, "0")}`}
                  </p>
                </div>
              </div>

              <span>{patient.phone || "-"}</span>
              <span>{patient.age || "-"}</span>
              <span>{patient.gender || "-"}</span>
              <span>{getPatientBranchName(patient, branchNameById)}</span>
              <span>{formatPatientLastVisit(patient.lastVisit)}</span>

              <button
                type="button"
                className="patients-view-btn"
                onClick={() =>
                  navigate(`/patients/${patient.id}`, {
                    state: { patient },
                  })
                }
              >
                <Eye size={16} />
                View
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Patients;

