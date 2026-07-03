import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarPlus,
  Eye,
  FilePlus2,
  HeartPulse,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { parseList, requestJson } from "../receptionApi";

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

function ReceptionMedicalHistory() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedPatientId = String(searchParams.get("patientId") || "").trim();
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

  const selectedPatientAppointments = useMemo(() => {
    const patientId = String(form.patientId || "").trim();
    if (!patientId) return [];

    return appointments.filter(
      (appointment) => String(getAppointmentPatientId(appointment)).trim() === patientId
    );
  }, [appointments, form.patientId]);

  const loadPatients = useCallback(async () => {
    const data = await requestJson("Patient");
    return parseList(data);
  }, []);

  const fetchHistories = useCallback(async (patientList) => {
    try {
      setLoading(true);
      const nextPatients = patientList?.length ? patientList : await loadPatients();
      setPatients(nextPatients);

      const historyResults = await Promise.all(
        nextPatients.map((patient) =>
          requestJson(`MedicalHistory/${patient.id}`)
            .then((data) => ({ ...data, patientId: data?.patientId || patient.id }))
            .catch(() => null)
        )
      );

      setHistories(
        historyResults.filter(
          (record) =>
            record &&
            (record.patientId ||
              record.allergies ||
              record.chronicDiseases ||
              record.currentMedications ||
              record.surgeries)
        )
      );
      setMessage("");
    } catch (error) {
      setMessage(error.message || "Unable to load medical history.");
    } finally {
      setLoading(false);
    }
  }, [loadPatients]);

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
      setAppointments(parseList(await requestJson("Appointment")));
    } catch {
      setAppointments([]);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
    fetchPatients().then((nextPatients) => fetchHistories(nextPatients));
  }, [fetchAppointments, fetchHistories, fetchPatients]);

  const openAdd = () => {
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
    if (handledPatientHistoryLink.current === requestedPatientId) return;
    if (!patients.some((patient) => String(patient.id) === requestedPatientId)) return;

    handledPatientHistoryLink.current = requestedPatientId;
    setForm({
      ...emptyForm,
      patientId: requestedPatientId,
    });
    setDocumentFile(null);
    setModal("add");
  }, [modal, patients, requestedPatientId]);

  const openEdit = (record) => {
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

    await requestJson(`Appointment/${appointmentId}/documents`, {
      method: "POST",
      body: data,
    });
  };

  const saveHistory = async (event) => {
    event.preventDefault();
    const patientId = Number(form.patientId);

    if (!patientId) {
      setMessage("Patient ID is required.");
      return;
    }

    const body = {
      patientId,
      allergies: form.allergies.trim(),
      chronicDiseases: form.chronicDiseases.trim(),
      currentMedications: form.currentMedications.trim(),
      surgeries: form.surgeries.trim(),
    };

    try {
      await requestJson("MedicalHistory", {
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
    const historyId = getHistoryId(record) || getPatientId(record);
    if (!historyId) {
      setMessage("Patient ID is missing.");
      return;
    }

    if (!window.confirm("Delete this medical history record?")) return;

    try {
      await requestJson(`MedicalHistory/${historyId}`, { method: "DELETE" });
      await fetchHistories();
    } catch (error) {
      setMessage(error.message || "Unable to delete medical history.");
    }
  };

  return (
    <section className="rc-page">
      <div className="rc-page-head">
        <div>
          <h2>Medical History</h2>
          <p>
            Add, review, update, and remove patient allergy, disease, medication,
            and surgery history.
          </p>
        </div>
        <div className="rc-head-actions">
          <button className="rc-btn primary" onClick={openAdd}>
            <FilePlus2 size={16} /> Add History
          </button>
          <button
            className="rc-btn ghost"
            onClick={() => fetchHistories(patients)}
            disabled={loading}
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="rc-btn" onClick={() => navigate("/reception/dashboard")}>
            <ArrowLeft size={16} /> Dashboard
          </button>
        </div>
      </div>

      {message ? <div className="rc-alert">{message}</div> : null}

      <div className="rc-card">
        <div className="rc-card-head">
          <div>
            <h3>History Records</h3>
            <p>{loading ? "Loading records..." : `${rows.length} records found`}</p>
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
          {rows.map((record, index) => {
            const historyId = getHistoryId(record) || `${getPatientId(record)}-${index}`;
            const patientName = getPatientName(record, patientsById);
            return (
              <div className="rc-table-row six" key={historyId}>
                <span>{index + 1}</span>
                <span>
                  <strong>{patientName || `Patient ${getPatientId(record) || "-"}`}</strong>
                  <small>PID: {getPatientId(record) || "-"}</small>
                </span>
                <span>{record.allergies || "-"}</span>
                <span>{record.chronicDiseases || "-"}</span>
                <span>{record.currentMedications || "-"}</span>
                <span>{record.surgeries || "-"}</span>
                <span className="rc-row-actions">
                  <button
                    aria-label="View medical history"
                    onClick={() => openView(record)}
                  >
                    <Eye size={15} />
                  </button>
                  <button
                    aria-label="Edit medical history"
                    onClick={() => openEdit(record)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() =>
                      navigate(`/reception/appointments?patientId=${getPatientId(record)}`)
                    }
                  >
                    <CalendarPlus size={15} /> Book Appointment
                  </button>
                  <button className="danger" onClick={() => deleteHistory(record)}>
                    <Trash2 size={15} /> Delete
                  </button>
                </span>
              </div>
            );
          })}
          {!rows.length ? <div className="rc-empty">No medical history found.</div> : null}
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
            <h3>
              {modal === "view"
                ? "Medical History Details"
                : modal === "edit"
                  ? "Edit Medical History"
                  : "Add Medical History"}
            </h3>
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
                <button type="submit" className="rc-btn primary">
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
