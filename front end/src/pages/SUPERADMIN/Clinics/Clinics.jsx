import React, { useEffect, useMemo, useState } from "react";
import { Camera, Eye, MapPin, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../../../components/superadmin/Header";
import DataTable from "../../../components/superadmin/DataTable";
import SearchFilter from "../../../components/superadmin/SearchFilter";
import { deleteClinic, fetchClinics, updateClinicStatus } from "../superAdminApi";
import { assetUrl } from "../../../config/api";
import { getDefaultClinicLogo, getPublicClinicLogoUrl } from "../../../utils/clinicBranding";

const readLogoValue = (data = {}) => {
  const source = data?.data && typeof data.data === "object" ? data.data : data || {};
  return (
    source.logoDataUrl ||
    source.LogoDataUrl ||
    source.logoUrl ||
    source.LogoUrl ||
    source.logoPath ||
    source.LogoPath ||
    source.logoFilePath ||
    source.LogoFilePath ||
    ""
  );
};

function ClinicLogo({ clinic }) {
  const clinicId = clinic.id || clinic.clinicId || clinic.hospitalId || "";
  const clinicName = clinic.name || "Clinic";
  const fallbackLogo = getDefaultClinicLogo(clinicName, clinicId);
  const [logoUrl, setLogoUrl] = useState(fallbackLogo);

  useEffect(() => {
    let isCurrent = true;
    const loadLogo = async () => {
      const publicLogoUrl = getPublicClinicLogoUrl(clinicId);
      if (!publicLogoUrl) {
        setLogoUrl(fallbackLogo);
        return;
      }
      const response = await fetch(publicLogoUrl, {
        headers: { "ngrok-skip-browser-warning": "true" },
      }).catch(() => null);
      if (!isCurrent || !response?.ok) return;
      const contentType = String(response.headers.get("content-type") || "").toLowerCase();
      const nextLogo = contentType.startsWith("image/")
        ? publicLogoUrl
        : assetUrl(readLogoValue(await response.json().catch(() => ({}))));
      if (nextLogo) setLogoUrl(`${nextLogo}${nextLogo.includes("?") ? "&" : "?"}v=${Date.now()}`);
    };

    loadLogo();
    return () => {
      isCurrent = false;
    };
  }, [clinicId, fallbackLogo]);

  return (
    <img
      src={logoUrl}
      alt=""
      onError={(event) => {
        event.currentTarget.src = fallbackLogo;
      }}
    />
  );
}

function Clinics() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingClinicId, setUpdatingClinicId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

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

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [search, status, rows.length]);

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage]);

  const columns = [
    {
      key: "serial",
      label: "S.No.",
      width: "34px",
      render: (_clinic, index) => index + 1,
    },
    {
      key: "name",
      label: "Clinic Name",
      width: "minmax(150px, 0.9fr)",
      render: (clinic) => {
        return (
          <div className="sa-clinic-name-cell">
            <span className="sa-clinic-logo sa-clinic-logo--emerald">
              <ClinicLogo clinic={clinic} />
            </span>
            <b>{clinic.name || "-"}</b>
          </div>
        );
      },
    },
    {
      key: "address",
      label: "Address",
      width: "minmax(230px, 1.25fr)",
      render: (clinic) => (
        <span className="sa-clinic-icon-text">
          <MapPin size={13} />
          <span>{clinic.address || "-"}</span>
        </span>
      ),
    },
    {
      key: "contactNumber",
      label: "Contact Number",
      width: "minmax(118px, 0.62fr)",
      render: (clinic) => (
        <span className="sa-clinic-icon-text sa-clinic-icon-text--phone">
          <Phone size={13} />
          <span>{clinic.contactNumber || "-"}</span>
        </span>
      ),
    },
    {
      key: "email",
      label: "Email",
      width: "minmax(145px, 0.68fr)",
      cellClassName: "sa-table-cell--nowrap",
      render: (clinic) => (
        <span title={clinic.email || ""} className="sa-table-text-overflow">
          {clinic.email || "-"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "96px",
      render: (clinic) => (
        <span className={`sa-badge sa-clinic-status ${clinic.status === "Active" ? "is-active" : "is-danger"}`}>
          <i />
          {clinic.status}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      width: "152px",
      cellClassName: "sa-table-cell--actions",
      render: (clinic) => {
        const isActive = String(clinic.status || "").trim().toLowerCase() === "active";
        const disabledTitle = "Clinic inactive - only status toggle is available";

        return (
          <div className="sa-actions">
            <button className="sa-icon-btn sa-icon-btn--view" onClick={() => setSelectedClinic(clinic)} disabled={!isActive} title={isActive ? "View clinic" : disabledTitle}>
              <Eye size={13} />
            </button>
            <button className="sa-icon-btn sa-icon-btn--edit" onClick={() => navigate(`/superadmin/clinics/edit/${clinic.id}`)} disabled={!isActive} title={isActive ? "Edit clinic" : disabledTitle}>
              <Pencil size={13} />
            </button>
            <button
              className="sa-icon-btn sa-icon-btn--status"
              onClick={() => toggleClinicStatus(clinic)}
              disabled={updatingClinicId === clinic.id}
              title={clinic.status === "Active" ? "Deactivate clinic" : "Activate clinic"}
            >
              <Camera size={13} />
            </button>
            <button className="sa-icon-btn sa-icon-btn--delete" onClick={() => handleDelete(clinic)} disabled={!isActive} title={isActive ? "Delete clinic" : disabledTitle}>
              <Trash2 size={13} />
            </button>
          </div>
        );
      },
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
        className="sa-table--clinics"
        columns={columns}
        rows={pagedRows}
        loading={loading}
        error={error}
        rowIndexOffset={(currentPage - 1) * pageSize}
        preserveColumnFractions
        emptyMessage="No clinics match your filters."
      />

      <div className="sa-table-footer">
        <div className="sa-table-summary">
          Showing {pagedRows.length} of {rows.length} clinics
        </div>
        <div className="sa-pagination">
          <button type="button" className="sa-btn" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
            First
          </button>
          <button type="button" className="sa-btn" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>
            Prev
          </button>
          <span className="sa-pagination-label">Page {currentPage} of {pageCount}</span>
          <button type="button" className="sa-btn" onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} disabled={currentPage === pageCount}>
            Next
          </button>
          <button type="button" className="sa-btn" onClick={() => setCurrentPage(pageCount)} disabled={currentPage === pageCount}>
            Last
          </button>
        </div>
      </div>

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
