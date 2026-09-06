import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  ClipboardPlus,
  Eye,
  FileText,
  HeartPulse,
  Pencil,
  Pill,
  RefreshCw,
  Search,
  Stethoscope,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "../../Nurse/Nurse.css";
import { parseList, requestJson as defaultRequestJson } from "../receptionApi";
import {
  getReceptionistScope,
  scopeReceptionistRecords,
  withReceptionistScopePayload,
} from "../receptionScope";
import { getReceptionistProfile } from "../receptionSession";
import { getNurseProfile } from "../../Nurse/nurseSession";
import { canUseModulePermission, useRolePermissionsSync } from "../../utils/rolePermissions";

const emptyForm = {
  id: "",
  patientId: "",
  allergies: "",
  chronicDiseases: "",
  currentMedications: "",
  surgeries: "",
  appointmentId: "",
};

const getHistoryId = (record) =>
  record?.id || record?.medicalHistoryId || record?.historyId || "";

const getPatientId = (record) => record?.patientId || record?.patient?.id || "";

const getAppointmentId = (appointment) =>
  appointment?.appointmentId ?? appointment?.id ?? appointment?.appointment?.id ?? "";

const getAppointmentPatientId = (appointment) =>
  appointment?.patientId ?? appointment?.patient?.id ?? appointment?.appointment?.patientId ?? "";

const getPatientName = (record, patientsById) => {
  const patientId = String(getPatientId(record));
  return (
    record?.patientName ||
    record?.patient?.name ||
    patientsById.get(patientId)?.name ||
    ""
  );
};

function ReceptionMedicalHistory({
  hideActions = false,
  basePath = "/reception",
  apiRequest = defaultRequestJson,
  getScope = getReceptionistScope,
  scopeRecords = scopeReceptionistRecords,
  buildHistoryPayload = withReceptionistScopePayload,
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedPatientId = String(searchParams.get("patientId") || "").trim();
  const receptionistScope = useMemo(() => getScope(), [getScope]);
  const permissionProfile = useMemo(
    () => (basePath === "/nurse" ? getNurseProfile() : getReceptionistProfile()),
    [basePath]
  );
  useRolePermissionsSync(permissionProfile);
  const canCreateHistory = canUseModulePermission(permissionProfile, "Medical History", "Create");
  const canEditHistory = canUseModulePermission(permissionProfile, "Medical History", "Edit");
  const canDeleteHistory = canUseModulePermission(permissionProfile, "Medical History", "Delete");
  const handledPatientHistoryLink = useRef("");
  const [histories, setHistories] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [documentFile, setDocumentFile] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const patientsById = useMemo(
    () => new Map(patients.map((patient) => [String(patient.id), patient])),
    [patients]
  );

  const rows = useMemo(() => [...histories].reverse(), [histories]);
  const [searchQuery, setSearchQuery] = useState("");

  const metrics = useMemo(() => {
    const total = histories.length;
    const withAllergies = histories.filter((h) => Boolean(String(h.allergies || "").trim())).length;
    const withChronic = histories.filter((h) => Boolean(String(h.chronicDiseases || "").trim())).length;
    const withSurgeries = histories.filter((h) => Boolean(String(h.surgeries || "").trim())).length;
    return { total, withAllergies, withChronic, withSurgeries };
  }, [histories]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((record) => {
      const patientId = String(getPatientId(record)).toLowerCase();
      const patientName = String(getPatientName(record, patientsById)).toLowerCase();
      const allergies = String(record.allergies || "").toLowerCase();
      const chronic = String(record.chronicDiseases || "").toLowerCase();
      const meds = String(record.currentMedications || "").toLowerCase();
      const surgeries = String(record.surgeries || "").toLowerCase();
      return (
        patientId.includes(query) ||
        patientName.includes(query) ||
        allergies.includes(query) ||
        chronic.includes(query) ||
        meds.includes(query) ||
        surgeries.includes(query)
      );
    });
  }, [rows, searchQuery, patientsById]);

  const hasHistoryContent = (record = {}) =>
    Boolean(
      String(record.allergies || "").trim() ||
        String(record.chronicDiseases || "").trim() ||
        String(record.currentMedications || "").trim() ||
        String(record.surgeries || "").trim()
    );

  const selectedPatientAppointments = useMemo(() => {
    const patientId = String(form.patientId || "").trim();
    if (!patientId) return [];

    return appointments.filter(
      (appointment) => String(getAppointmentPatientId(appointment)).trim() === patientId
    );
  }, [appointments, form.patientId]);

  const loadPatients = useCallback(async () => {
    const [patientData, appointmentData] = await Promise.all([
      apiRequest("Patient"),
      Promise.all([
        apiRequest("Appointment").catch(() => []),
        apiRequest("Appointment/offline").catch(() => []),
        apiRequest("Appointment/online").catch(() => []),
      ]).then((results) => results.flatMap((result) => parseList(result))),
    ]);
    const branchPatientIds = new Set(
      scopeRecords(parseList(appointmentData), receptionistScope, {
        allowMissingClinic: true,
        allowMissingBranch: true,
      })
        .map(getAppointmentPatientId)
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    );

    return parseList(patientData).filter((patient) => {
      const patientId = String(patient.id || patient.patientId || patient.PatientId || "").trim();
      return (
        branchPatientIds.has(patientId) ||
        scopeRecords([patient], receptionistScope, {
          allowMissingClinic: true,
          allowMissingBranch: true,
        }).length > 0
      );
    });
  }, [apiRequest, receptionistScope, scopeRecords]);

  const fetchHistories = useCallback(async (patientList) => {
    try {
      setLoading(true);
      let nextPatients = patientList?.length ? patientList : await loadPatients();
      if (
        requestedPatientId &&
        !nextPatients.some((patient) => String(patient.id || patient.patientId || patient.PatientId) === requestedPatientId)
      ) {
        nextPatients = [
          ...nextPatients,
          { id: requestedPatientId, patientId: requestedPatientId, name: `Patient ${requestedPatientId}` },
        ];
      }
      setPatients(nextPatients);

      const historyResults = await Promise.all(
        nextPatients.map((patient) =>
          apiRequest(`MedicalHistory/${patient.id}`)
            .then((data) =>
              parseList(data).length
                ? parseList(data).map((record) => ({ ...record, patientId: record?.patientId || patient.id }))
                : data
                  ? [{ ...data, patientId: data?.patientId || patient.id }]
                  : []
            )
            .catch(() => null)
        )
      );

      setHistories(
        historyResults.flat().filter(
          (record) =>
            record &&
            hasHistoryContent(record)
        )
      );
      setMessage("");
    } catch (error) {
      setMessage(error.message || "Unable to load medical history.");
    } finally {
      setLoading(false);
    }
  }, [loadPatients, requestedPatientId]);

  const fetchPatients = useCallback(async () => {
    try {
      const nextPatients = await loadPatients();
      setPatients(nextPatients);
      return nextPatients;
    } catch {
      setPatients([]);
      return [];
    }
  }, [loadPatients]);

  const fetchAppointments = useCallback(async () => {
    try {
      setAppointments(
        scopeRecords(parseList(await apiRequest("Appointment")), receptionistScope, {
          allowMissingClinic: true,
          allowMissingBranch: true,
        })
      );
    } catch {
      setAppointments([]);
    }
  }, [receptionistScope]);

  useEffect(() => {
    fetchAppointments();
    fetchPatients().then((nextPatients) => fetchHistories(nextPatients));
  }, [fetchAppointments, fetchHistories, fetchPatients]);

  const openAdd = () => {
    if (!canCreateHistory) {
      setMessage("You do not have permission to create medical history.");
      return;
    }
    setForm({
      ...emptyForm,
      patientId: requestedPatientId,
    });
    setDocumentFile(null);
    setModal("add");
    setMessage("");
  };

  useEffect(() => {
    if (!requestedPatientId || modal || !patients.length) return;
    if (!canCreateHistory) return;
    if (handledPatientHistoryLink.current === requestedPatientId) return;
    if (!patients.some((patient) => String(patient.id) === requestedPatientId)) return;

    handledPatientHistoryLink.current = requestedPatientId;
    setForm({
      ...emptyForm,
      patientId: requestedPatientId,
    });
    setDocumentFile(null);
    setModal("add");
  }, [canCreateHistory, modal, patients, requestedPatientId]);

  const openEdit = (record) => {
    if (!canEditHistory) {
      setMessage("You do not have permission to edit medical history.");
      return;
    }
    setForm({
      id: getHistoryId(record),
      patientId: getPatientId(record),
      allergies: record?.allergies || "",
      chronicDiseases: record?.chronicDiseases || "",
      currentMedications: record?.currentMedications || "",
      surgeries: record?.surgeries || "",
      appointmentId: "",
    });
    setDocumentFile(null);
    setModal("edit");
    setMessage("");
  };

  const openView = (record) => {
    setForm({
      id: getHistoryId(record),
      patientId: getPatientId(record),
      allergies: record?.allergies || "",
      chronicDiseases: record?.chronicDiseases || "",
      currentMedications: record?.currentMedications || "",
      surgeries: record?.surgeries || "",
      appointmentId: "",
    });
    setDocumentFile(null);
    setModal("view");
    setMessage("");
  };

  const uploadDocument = async () => {
    if (!documentFile) return;

    const appointmentId = Number(
      form.appointmentId || getAppointmentId(selectedPatientAppointments[0])
    );
    if (!appointmentId) {
      throw new Error("No appointment found for the selected patient.");
    }

    const data = new FormData();
    data.append("file", documentFile);

    await apiRequest(`Appointment/${appointmentId}/documents`, {
      method: "POST",
      body: data,
    });
  };

  const saveHistory = async (event) => {
    event.preventDefault();

    if (modal === "edit" && !canEditHistory) {
      setMessage("You do not have permission to edit medical history.");
      return;
    }

    if (modal !== "edit" && !canCreateHistory) {
      setMessage("You do not have permission to create medical history.");
      return;
    }

    const patientId = Number(form.patientId);

    if (!patientId) {
      setMessage("Patient ID is required.");
      return;
    }

    const body = buildHistoryPayload({
      patientId,
      allergies: form.allergies.trim(),
      chronicDiseases: form.chronicDiseases.trim(),
      currentMedications: form.currentMedications.trim(),
      surgeries: form.surgeries.trim(),
    }, receptionistScope);

    try {
      await apiRequest("MedicalHistory", {
        method: "POST",
        body: JSON.stringify(body),
      });

      await uploadDocument();
      setModal(null);
      setDocumentFile(null);
      await fetchHistories();
      setMessage(documentFile ? "Medical history and document saved successfully." : "");
    } catch (error) {
      setMessage(error.message || "Unable to save medical history.");
    }
  };

  const deleteHistory = async (record) => {
    if (!canDeleteHistory) {
      setMessage("You do not have permission to delete medical history.");
      return;
    }

    const historyId = getHistoryId(record) || getPatientId(record);
    if (!historyId) {
      setMessage("Patient ID is missing.");
      return;
    }

    if (!window.confirm("Delete this medical history record?")) return;

    try {
      await apiRequest(`MedicalHistory/${historyId}`, { method: "DELETE" });
      await fetchHistories();
    } catch (error) {
      setMessage(error.message || "Unable to delete medical history.");
    }
  };

  return (
    <section className="rc-page med-history-page">
      {/* Background decoration with photorealistic clinical history telemetry */}
      <div className="med-history-bg-overlay" aria-hidden="true" />

      {/* Hero Header with Medical History Theme */}
      <div className="med-history-hero">
        <div>
          <div className="med-history-badge">
            <HeartPulse size={13} />
            <span>Clinical Records & Diagnostics</span>
          </div>
          <h2>Medical History</h2>
          <p>
            Add, review, update, and track patient allergies, chronic diseases, medication regimens, and surgical history.
          </p>
        </div>
        {!hideActions && (
          <div className="med-head-actions">
            {canCreateHistory ? (
              <button
                className="med-btn med-btn--add"
                onClick={openAdd}
                title="Add Medical History Record"
              >
                <div className="med-btn-icon-wrap">
                  <ClipboardPlus size={16} />
                </div>
                <span>Add History</span>
              </button>
            ) : null}
            <button
              className="med-btn med-btn--refresh"
              onClick={() => fetchHistories(patients)}
              disabled={loading}
              title="Synchronize Clinical History"
            >
              <div className="med-btn-icon-wrap">
                <RefreshCw size={15} className={loading ? "spin-icon" : ""} />
              </div>
              <span>{loading ? "Syncing..." : "Sync Vitals"}</span>
            </button>
            <button
              className="med-btn med-btn--dash"
              onClick={() => navigate(`${basePath}/dashboard`)}
              title="Return to Dashboard"
            >
              <div className="med-btn-icon-wrap">
                <ArrowLeft size={15} />
              </div>
              <span>Dashboard</span>
            </button>
          </div>
        )}
      </div>

      {message ? <div className="rc-alert">{message}</div> : null}

      {/* Medical Metrics Cards */}
      <div className="med-metrics-grid">
        <div className="med-metric-card total">
          <div className="med-metric-icon">
            <ClipboardList size={22} />
          </div>
          <div className="med-metric-info">
            <strong>{metrics.total}</strong>
            <span>Total Histories</span>
          </div>
        </div>

        <div className="med-metric-card allergies">
          <div className="med-metric-icon">
            <AlertTriangle size={22} />
          </div>
          <div className="med-metric-info">
            <strong>{metrics.withAllergies}</strong>
            <span>Allergy Alerts</span>
          </div>
        </div>

        <div className="med-metric-card chronic">
          <div className="med-metric-icon">
            <Activity size={22} />
          </div>
          <div className="med-metric-info">
            <strong>{metrics.withChronic}</strong>
            <span>Chronic Conditions</span>
          </div>
        </div>

        <div className="med-metric-card surgeries">
          <div className="med-metric-icon">
            <Stethoscope size={22} />
          </div>
          <div className="med-metric-info">
            <strong>{metrics.withSurgeries}</strong>
            <span>Surgical History</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="med-search-bar-wrap">
        <div className="med-search-bar">
          <Search size={16} color="#0f766e" />
          <input
            type="text"
            placeholder="Search by patient name, PID, allergies, chronic condition, or medication..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "grid", placeItems: "center" }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Medical History Card & Table */}
      <div className="med-history-card">
        <div className="med-card-header">
          <div className="med-card-title">
            <div className="med-card-icon">
              <HeartPulse size={18} />
            </div>
            <div>
              <h3>Patient Clinical History</h3>
              <p>{loading ? "Synchronizing records..." : `${filteredRows.length} history records documented`}</p>
            </div>
          </div>
        </div>

        <div className="rc-table">
          <div className="rc-table-head six">
            <span>S.No.</span>
            <span>Patient</span>
            <span>Allergies</span>
            <span>Chronic Diseases</span>
            <span>Medications</span>
            <span>Surgeries</span>
            <span>Actions</span>
          </div>
          {filteredRows.map((record, index) => {
            const historyId = getHistoryId(record) || `${getPatientId(record)}-${index}`;
            const patientName = getPatientName(record, patientsById);
            const pid = getPatientId(record) || "-";
            const initial = (patientName || "P").charAt(0).toUpperCase();

            return (
              <div className="rc-table-row six" key={historyId}>
                <span>{index + 1}</span>
                <span>
                  <div className="med-patient-chip">
                    <div className="med-patient-avatar">{initial}</div>
                    <div>
                      <span className="med-patient-title">{patientName || `Patient ${pid}`}</span>
                      <span className="med-patient-pid">PID: {pid}</span>
                    </div>
                  </div>
                </span>
                <span>
                  {record.allergies ? (
                    <span className="med-badge med-badge--allergy" title={record.allergies}>
                      <AlertTriangle size={11} /> {record.allergies}
                    </span>
                  ) : (
                    <span className="med-badge med-badge--none">None</span>
                  )}
                </span>
                <span>
                  {record.chronicDiseases ? (
                    <span className="med-badge med-badge--chronic" title={record.chronicDiseases}>
                      <Activity size={11} /> {record.chronicDiseases}
                    </span>
                  ) : (
                    <span className="med-badge med-badge--none">None</span>
                  )}
                </span>
                <span>
                  {record.currentMedications ? (
                    <span className="med-badge med-badge--meds" title={record.currentMedications}>
                      <Pill size={11} /> {record.currentMedications}
                    </span>
                  ) : (
                    <span className="med-badge med-badge--none">None</span>
                  )}
                </span>
                <span>
                  {record.surgeries ? (
                    <span className="med-badge med-badge--surg" title={record.surgeries}>
                      <Stethoscope size={11} /> {record.surgeries}
                    </span>
                  ) : (
                    <span className="med-badge med-badge--none">None</span>
                  )}
                </span>
                <span className="med-row-actions">
                  <button
                    className="med-action-btn med-action-btn--view"
                    aria-label="View medical history"
                    onClick={() => openView(record)}
                    title="View Full History"
                  >
                    <Eye size={14} />
                  </button>
                  {canEditHistory ? (
                    <button
                      className="med-action-btn med-action-btn--edit"
                      aria-label="Edit medical history"
                      onClick={() => openEdit(record)}
                      title="Edit Clinical Record"
                    >
                      <Pencil size={14} />
                    </button>
                  ) : null}
                  {canDeleteHistory ? (
                    <button
                      className="med-action-btn med-action-btn--delete"
                      onClick={() => deleteHistory(record)}
                      title="Delete Record"
                      aria-label="Delete medical history"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </span>
              </div>
            );
          })}

          {!filteredRows.length ? (
            <div className="med-empty-history">
              <div className="med-empty-icon-wrap">
                <FileText size={28} />
              </div>
              <h4>{searchQuery ? "No Matching Records Found" : "No Medical History Found"}</h4>
              <p>
                {searchQuery
                  ? `No patient records match "${searchQuery}". Try searching by another patient name or condition.`
                  : "No clinical history or allergy records have been filed yet. Click 'Add History' to document a patient's medical background."}
              </p>
              {canCreateHistory && !searchQuery ? (
                <button
                  className="med-btn med-btn--add"
                  onClick={openAdd}
                  style={{ marginTop: 8 }}
                >
                  <ClipboardPlus size={16} /> Add First Medical History
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {modal ? (
        <div className="rc-modal-backdrop" onClick={() => setModal(null)}>
          <form
            noValidate
            className="rc-modal rc-modal-compact"
            onSubmit={saveHistory}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="rc-modal-header">
              <h3>
                {modal === "view"
                  ? "Medical History Details"
                  : modal === "edit"
                    ? "Edit Medical History"
                    : "Add Medical History"}
              </h3>
              <button
                type="button"
                className="rc-modal-close"
                onClick={() => setModal(null)}
                aria-label="Close"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="rc-form-grid">
              <label>
                <span>Patient</span>
                <select
                  value={form.patientId || ""}
                  disabled={modal === "view"}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      patientId: event.target.value,
                      appointmentId: "",
                    }))
                  }
                >
                  <option value="">Select patient</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name || `Patient ${patient.id}`} (PID: {patient.id})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Patient ID</span>
                <input
                  type="number"
                  min="1"
                  value={form.patientId || ""}
                  disabled={modal === "view"}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      patientId: event.target.value,
                      appointmentId: "",
                    }))
                  }
                />
              </label>
              {[
                ["allergies", "Allergies"],
                ["chronicDiseases", "Chronic Diseases"],
                ["currentMedications", "Current Medications"],
                ["surgeries", "Surgeries"],
              ].map(([field, label]) => (
                <label key={field}>
                  <span>{label}</span>
                  <textarea
                    value={form[field] || ""}
                    disabled={modal === "view"}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, [field]: event.target.value }))
                    }
                  />
                </label>
              ))}
              {modal !== "view" ? (
                <label className="rc-document-field rc-form-field-full">
                  <span>Document</span>
                  <div className="rc-file-upload">
                    <label className="rc-file-upload-btn" htmlFor="medical-history-document">
                      <Upload size={14} /> Choose file
                    </label>
                    <span title={documentFile?.name || ""}>
                      {documentFile?.name || "No file selected"}
                    </span>
                    <input
                      id="medical-history-document"
                      type="file"
                      onChange={(event) => setDocumentFile(event.target.files?.[0] || null)}
                    />
                  </div>
                </label>
              ) : null}
            </div>
            <div className="rc-modal-actions">
              <button type="button" className="rc-btn ghost" onClick={() => setModal(null)}>
                Close
              </button>
              {modal !== "view" ? (
                <button
                  type="submit"
                  className="rc-btn primary"
                  title="Save history"
                >
                  {documentFile ? <Upload size={16} /> : <HeartPulse size={16} />} Save
                </button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

export default ReceptionMedicalHistory;
