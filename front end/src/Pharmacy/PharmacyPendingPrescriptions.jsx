import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle, ClipboardList, Eye, RefreshCw, Search, X } from "lucide-react";
import { API_ENDPOINTS, apiUrl } from "../config/api";
import { getPharmacistToken } from "./pharmacySession";

const getResponseMessage = (payload, fallback) => {
  const validation = payload?.errors && typeof payload.errors === "object"
    ? Object.values(payload.errors).flat().filter(Boolean).join(" ")
    : "";
  return payload?.message || validation || payload?.title || payload?.error ||
    (typeof payload === "string" ? payload : "") || fallback;
};

const parsePrescriptionList = (payload) => {
  if (Array.isArray(payload)) return payload;
  for (const key of ["data", "items", "results", "records", "prescriptions"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return null;
};

const getPrescriptionValue = (prescription, ...keys) => {
  for (const key of keys) {
    const value = key.split(".").reduce((current, part) => current?.[part], prescription);
    if (value !== null && value !== undefined && String(value).trim() !== "") return value;
  }
  return "-";
};

const getPrescriptionDetails = (payload) =>
  payload?.data && typeof payload.data === "object"
    ? payload.data
    : payload?.prescription && typeof payload.prescription === "object"
      ? payload.prescription
      : payload;

const getPrescriptionMedicines = (details) => {
  const medicineRows = [
    details?.medicines,
    details?.Medicines,
    details?.items,
    details?.Items,
    details?.prescription?.medicines,
    details?.Prescription?.Medicines,
  ].find(Array.isArray);
  return medicineRows || [];
};

function PharmacyPendingPrescriptions() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dispensing, setDispensing] = useState(false);

  const loadPrescriptions = useCallback(async () => {
    const token = getPharmacistToken();
    if (!token) {
      setPrescriptions([]);
      setError("Your pharmacist session is missing. Sign in again to load pending prescriptions.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(apiUrl(API_ENDPOINTS.pharmacy.pendingPrescriptions), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        cache: "no-store",
      });
      const text = await response.text();
      let payload = null;
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text;
        }
      }

      if (!response.ok) {
        throw new Error(getResponseMessage(payload, `Unable to load pending prescriptions (HTTP ${response.status}).`));
      }

      const items = parsePrescriptionList(payload);
      if (!items) {
        throw new Error("The pending prescriptions response was not in the expected list format.");
      }
      setPrescriptions(items);
    } catch (requestError) {
      setPrescriptions([]);
      setError(requestError.message || "Unable to load pending prescriptions.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrescriptions();
  }, [loadPrescriptions]);

  const viewPrescription = async (prescription) => {
    const id = getPrescriptionValue(prescription, "id", "Id", "prescriptionId", "PrescriptionId");
    if (id === "-") {
      setError("This prescription does not include an ID, so its details cannot be loaded.");
      return;
    }

    const token = getPharmacistToken();
    if (!token) {
      setError("Your pharmacist session is missing. Sign in again to load prescription details.");
      return;
    }

    setDetailLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(
        apiUrl(API_ENDPOINTS.pharmacy.prescriptionById.replace("{id}", encodeURIComponent(String(id)))),
        {
          headers: {
            Authorization: `******`,
            Accept: "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          cache: "no-store",
        }
      );
      const text = await response.text();
      let payload = null;
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text;
        }
      }
      if (!response.ok) {
        throw new Error(getResponseMessage(payload, `Unable to load prescription details (HTTP ${response.status}).`));
      }
      setSelectedPrescription({ id: String(id), details: getPrescriptionDetails(payload) });
    } catch (requestError) {
      setError(requestError.message || "Unable to load prescription details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const dispensePrescription = async () => {
    if (!selectedPrescription || dispensing) return;
    const token = getPharmacistToken();
    if (!token) {
      setError("Your pharmacist session is missing. Sign in again to dispense medicines.");
      return;
    }

    setDispensing(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(
        apiUrl(API_ENDPOINTS.pharmacy.dispensePrescription.replace(
          "{id}",
          encodeURIComponent(selectedPrescription.id)
        )),
        {
          method: "POST",
          headers: {
            Authorization: `******`,
            Accept: "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          cache: "no-store",
        }
      );
      const text = await response.text();
      let payload = null;
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text;
        }
      }
      if (!response.ok) {
        throw new Error(getResponseMessage(payload, `Unable to dispense prescription (HTTP ${response.status}).`));
      }
      const message = getResponseMessage(payload, "Medicines dispensed and stock updated.");
      setSelectedPrescription(null);
      await loadPrescriptions();
      setSuccess(message);
    } catch (requestError) {
      setError(requestError.message || "Unable to dispense prescription.");
    } finally {
      setDispensing(false);
    }
  };

  const filteredPrescriptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return prescriptions;
    return prescriptions.filter((prescription) => [
      getPrescriptionValue(prescription, "id", "Id", "prescriptionId", "PrescriptionId"),
      getPrescriptionValue(prescription, "patientName", "PatientName", "patient.name", "Patient.Name"),
      getPrescriptionValue(prescription, "patientId", "PatientId", "patient.id", "Patient.Id"),
      getPrescriptionValue(prescription, "doctorName", "DoctorName", "doctor.name", "Doctor.Name"),
      getPrescriptionValue(prescription, "appointmentId", "AppointmentId"),
      getPrescriptionValue(prescription, "status", "Status"),
    ].join(" ").toLowerCase().includes(term));
  }, [prescriptions, search]);

  return (
    <section className="pharmacy-prescriptions-page">
      <header className="pharmacy-catalogue-header">
        <div className="pharmacy-prescriptions-heading">
          <span className="pharmacy-module-icon"><ClipboardList size={22} /></span>
          <div>
            <h2>Pending prescriptions</h2>
            <p>{isLoading ? "Loading prescriptions..." : `${filteredPrescriptions.length} prescriptions awaiting review`}</p>
          </div>
        </div>
        <button
          type="button"
          className="pharmacy-catalogue-refresh"
          onClick={loadPrescriptions}
          disabled={isLoading}
          aria-label="Refresh pending prescriptions"
          title="Refresh pending prescriptions"
        >
          <RefreshCw size={17} />
        </button>
      </header>

      {error ? <div className="pharmacy-import-message is-error" role="alert">{error}</div> : null}
      {success ? <div className="pharmacy-import-message is-success" role="status">{success}</div> : null}

      <label className="pharmacy-catalogue-search">
        <Search size={18} />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by patient, doctor, or prescription..."
          aria-label="Search pending prescriptions"
        />
      </label>

      <div className="pharmacy-catalogue-scroll pharmacy-prescriptions-scroll">
        <table className="pharmacy-catalogue-table pharmacy-prescriptions-table">
          <thead>
            <tr>
              <th>Prescription</th>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Appointment</th>
              <th>Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="7">Loading pending prescriptions...</td></tr>
            ) : error ? (
              <tr><td colSpan="7">Unable to display prescriptions. See the error above.</td></tr>
            ) : filteredPrescriptions.length === 0 ? (
              <tr><td colSpan="7">{search ? "No prescriptions match your search." : "There are no pending prescriptions."}</td></tr>
            ) : filteredPrescriptions.map((prescription, index) => {
              const id = getPrescriptionValue(prescription, "id", "Id", "prescriptionId", "PrescriptionId");
              return (
                <tr key={id !== "-" ? id : index}>
                  <td><strong>{id}</strong></td>
                  <td>
                    <strong>{getPrescriptionValue(prescription, "patientName", "PatientName", "patient.name", "Patient.Name")}</strong>
                    <small>{getPrescriptionValue(prescription, "patientId", "PatientId", "patient.id", "Patient.Id")}</small>
                  </td>
                  <td>{getPrescriptionValue(prescription, "doctorName", "DoctorName", "doctor.name", "Doctor.Name")}</td>
                  <td>{getPrescriptionValue(prescription, "appointmentId", "AppointmentId")}</td>
                  <td>{getPrescriptionValue(prescription, "prescriptionDate", "PrescriptionDate", "createdAt", "CreatedAt", "date", "Date")}</td>
                  <td><span className="pharmacy-prescription-status">{getPrescriptionValue(prescription, "status", "Status")}</span></td>
                  <td>
                    <button
                      type="button"
                      className="pharmacy-prescription-view"
                      onClick={() => viewPrescription(prescription)}
                      disabled={detailLoading || dispensing || id === "-"}
                    >
                      <Eye size={15} /> View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selectedPrescription ? (
        <section className="pharmacy-prescription-details" aria-label="Prescription details">
          <header className="pharmacy-catalogue-header">
            <div>
              <h2>Prescription details</h2>
              <p>Prescription {selectedPrescription.id} · medicine availability</p>
            </div>
            <button
              type="button"
              className="pharmacy-catalogue-refresh"
              onClick={() => setSelectedPrescription(null)}
              disabled={dispensing}
              aria-label="Close prescription details"
            >
              <X size={17} />
            </button>
          </header>
          {detailLoading ? <p>Loading prescription details...</p> : null}
          <div className="pharmacy-catalogue-scroll">
            <table className="pharmacy-catalogue-table pharmacy-prescription-medicines">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Dosage</th>
                  <th>Prescribed quantity</th>
                  <th>Available stock</th>
                  <th>Availability</th>
                </tr>
              </thead>
              <tbody>
                {getPrescriptionMedicines(selectedPrescription.details).length ? (
                  getPrescriptionMedicines(selectedPrescription.details).map((medicine, index) => {
                    const name = getPrescriptionValue(medicine, "medicineName", "MedicineName", "name", "Name", "medicine.name", "Medicine.Name");
                    const quantity = getPrescriptionValue(medicine, "quantity", "Quantity", "qty", "Qty", "prescribedQuantity", "PrescribedQuantity");
                    const stock = getPrescriptionValue(medicine, "availableQuantity", "AvailableQuantity", "availableStock", "AvailableStock", "stockQuantity", "StockQuantity", "quantityAvailable", "QuantityAvailable");
                    const availability = getPrescriptionValue(medicine, "availability", "Availability", "stockStatus", "StockStatus", "status", "Status");
                    return (
                      <tr key={medicine.id ?? medicine.Id ?? index}>
                        <td><strong>{name}</strong></td>
                        <td>{getPrescriptionValue(medicine, "dosage", "Dosage", "frequency", "Frequency")}</td>
                        <td>{quantity}</td>
                        <td>{stock}</td>
                        <td>{availability}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan="5">No medicine availability details were returned for this prescription.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="pharmacy-prescription-actions">
            <button
              type="button"
              className="pharmacy-import-button"
              onClick={dispensePrescription}
              disabled={dispensing || detailLoading || !getPrescriptionMedicines(selectedPrescription.details).length}
            >
              {dispensing ? <RefreshCw size={16} /> : <CheckCircle size={16} />}
              {dispensing ? "Dispensing..." : "Dispense medicines"}
            </button>
          </div>
        </section>
      ) : null}
    </section>
  );
}

export default PharmacyPendingPrescriptions;
