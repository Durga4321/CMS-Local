import React, { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../../../components/superadmin/Header";
import DataTable from "../../../components/superadmin/DataTable";
import SearchFilter from "../../../components/superadmin/SearchFilter";
import { deleteClinic, fetchClinics, updateClinicStatus } from "../superAdminApi";

function Clinics() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingClinicId, setUpdatingClinicId] = useState(null);

  const loadClinics = async () => {
    setLoading(true);
    setError("");

    try {
      setClinics(await fetchClinics());
    } catch (requestError) {
      setError(requestError.message || "Unable to load clinics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClinics();
  }, []);

  const toggleClinicStatus = async (clinic) => {
    const nextStatus = clinic.status === "Active" ? "Inactive" : "Active";
    setUpdatingClinicId(clinic.id);
    setError("");

    try {
      await updateClinicStatus(clinic.id, nextStatus);
      setClinics((previous) =>
        previous.map((item) =>
          String(item.id) === String(clinic.id)
            ? { ...item, status: nextStatus }
            : item
        )
      );
    } catch (requestError) {
      setError(requestError.message || "Unable to update clinic status.");
    } finally {
      setUpdatingClinicId(null);
    }
  };

  const handleDelete = async (clinic) => {
    const confirmed = window.confirm(`Delete ${clinic.name || "this clinic"}?`);
    if (!confirmed) return;

    try {
      await deleteClinic(clinic.id);
      await loadClinics();
      if (selectedClinic?.id === clinic.id) setSelectedClinic(null);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete clinic.");
    }
  };

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clinics.filter((clinic) => {
      const matchesSearch = [clinic.name, clinic.address, clinic.email]
        .some((value) => String(value).toLowerCase().includes(query));
      const matchesStatus = status === "All" || clinic.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [clinics, search, status]);

  const columns = [
    {
      key: "serial",
      label: "S.No.",
      width: "minmax(60px, 0.4fr)",
      render: (_clinic, index) => index + 1,
    },
    { key: "name", label: "Clinic Name", width: "minmax(140px, 1fr)" },
    { key: "address", label: "Address", width: "minmax(160px, 1.1fr)" },
    { key: "contactNumber", label: "Contact Number", width: "minmax(130px, 0.9fr)" },
    { key: "email", label: "Email", width: "minmax(160px, 1fr)" },
    {
      key: "status",
      label: "Status",
      width: "minmax(90px, 0.6fr)",
      render: (clinic) => (
        <span className={`sa-badge ${clinic.status === "Active" ? "is-active" : "is-danger"}`}>
          {clinic.status}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      width: "minmax(112px, 0.8fr)",
      render: (clinic) => (
        <div className="sa-actions">
          <button className="sa-icon-btn" onClick={() => setSelectedClinic(clinic)} title="View clinic">
            <Eye size={15} />
          </button>
          <button className="sa-icon-btn" onClick={() => navigate(`/superadmin/clinics/edit/${clinic.id}`)} title="Edit clinic">
            <Pencil size={15} />
          </button>
          <button
            className="sa-icon-btn"
            onClick={() => toggleClinicStatus(clinic)}
            disabled={updatingClinicId === clinic.id}
            title={clinic.status === "Active" ? "Deactivate clinic" : "Activate clinic"}
          >
            {clinic.status === "Active" ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
          </button>
          <button className="sa-icon-btn" onClick={() => handleDelete(clinic)} title="Delete clinic">
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];
  const clinicDetailFields = [
    { key: "id", label: "Clinic ID" },
    { key: "name", label: "Clinic Name" },
    { key: "type", label: "Clinic Type" },
    { key: "address", label: "Address" },
    { key: "contactNumber", label: "Contact Number" },
    { key: "email", label: "Email" },
    { key: "status", label: "Status" },
    { key: "createdDate", label: "Created Date" },
    { key: "updatedDate", label: "Updated Date" },
  ];

  return (
    <>
      <Header
        title="Clinic Management"
        subtitle={`${rows.length} clinics found`}
        action={
          <Link className="sa-btn sa-btn-primary" to="/superadmin/clinics/add">
            <Plus size={16} />
            Add Clinic
          </Link>
        }
      />

      <SearchFilter
        value={search}
        onChange={setSearch}
        placeholder="Search clinics by name, address, or email..."
        filters={["All", "Active", "Inactive"]}
        selectedFilter={status}
        onFilterChange={setStatus}
      />

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        emptyMessage="No clinics match your filters."
      />

      {selectedClinic ? (
        <div className="sa-form-card" style={{ marginTop: 16 }}>
          <Header
            title="View Clinic"
            subtitle={selectedClinic.id ? `Clinic ID: ${selectedClinic.id}` : ""}
            action={
              <button className="sa-btn" onClick={() => setSelectedClinic(null)}>
                Close
              </button>
            }
          />
          <div className="sa-form-grid">
            {clinicDetailFields.map((field) => (
              <div className="sa-form-field" key={field.key}>
                <label>{field.label}</label>
                <input value={selectedClinic[field.key] || "-"} readOnly />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

export default Clinics;
