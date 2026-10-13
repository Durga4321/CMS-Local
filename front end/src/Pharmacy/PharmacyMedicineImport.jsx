import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, RefreshCw, Search, Upload } from "lucide-react";
import { API_ENDPOINTS, apiUrl } from "../config/api";
import { useToast } from "../components/ToastProvider";
import { getPharmacistToken } from "./pharmacySession";

const allowedExtensions = [".xlsx", ".xls"];

const getResponseMessage = (payload, fallback) => {
  const validation = payload?.errors && typeof payload.errors === "object"
    ? Object.values(payload.errors).flat().filter(Boolean).join(" ")
    : "";
  return payload?.message || validation || payload?.title || payload?.error ||
    (typeof payload === "string" ? payload : "") || fallback;
};

const parseMedicineList = (payload) => {
  if (Array.isArray(payload)) return payload;
  for (const key of ["data", "items", "results", "records", "medicines", "catalogue", "catalog"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return null;
};

const getMedicineValue = (medicine, ...keys) => {
  for (const key of keys) {
    const value = key.split(".").reduce((current, part) => current?.[part], medicine);
    if (value !== null && value !== undefined && String(value).trim() !== "") return value;
  }
  return "-";
};

function PharmacyMedicineImport() {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [medicines, setMedicines] = useState([]);
  const [isLoadingMedicines, setIsLoadingMedicines] = useState(true);
  const [medicinesError, setMedicinesError] = useState("");
  const [search, setSearch] = useState("");

  const loadMedicines = useCallback(async () => {
    const token = getPharmacistToken();
    if (!token) {
      setMedicines([]);
      setMedicinesError("Your pharmacist session is missing. Sign in again to load the medicine catalogue.");
      setIsLoadingMedicines(false);
      return;
    }

    setIsLoadingMedicines(true);
    setMedicinesError("");
    try {
      const response = await fetch(apiUrl(API_ENDPOINTS.pharmacy.medicines), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
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
        throw new Error(getResponseMessage(payload, `Unable to load medicines (HTTP ${response.status}).`));
      }

      const items = parseMedicineList(payload);
      if (!items) {
        throw new Error("The medicine catalogue response was not in the expected list format.");
      }
      setMedicines(items);
    } catch (requestError) {
      setMedicines([]);
      setMedicinesError(requestError.message || "Unable to load the medicine catalogue.");
    } finally {
      setIsLoadingMedicines(false);
    }
  }, []);

  useEffect(() => {
    loadMedicines();
  }, [loadMedicines]);

  const filteredMedicines = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return medicines;
    return medicines.filter((medicine) =>
      [
        getMedicineValue(medicine, "medicineCode", "MedicineCode", "code", "Code"),
        getMedicineValue(medicine, "name", "Name", "medicineName", "MedicineName"),
        getMedicineValue(medicine, "genericName", "GenericName"),
        getMedicineValue(medicine, "brandName", "BrandName"),
        getMedicineValue(medicine, "category", "Category"),
        getMedicineValue(medicine, "batchNumber", "BatchNumber"),
      ].join(" ").toLowerCase().includes(term)
    );
  }, [medicines, search]);

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    setError("");
    setResultMessage("");
  };

  const importMedicines = async (event) => {
    event.preventDefault();
    if (isUploading) return;
    const form = event.currentTarget;

    if (!file) {
      setError("Choose an Excel workbook before importing.");
      return;
    }

    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      setError("Select an .xlsx or .xls Excel workbook.");
      return;
    }

    const token = getPharmacistToken();
    if (!token) {
      setError("Your pharmacist session is missing. Sign in again and retry.");
      return;
    }

    const body = new FormData();
    body.append("file", file);
    setIsUploading(true);
    setError("");
    setResultMessage("");

    try {
      const response = await fetch(apiUrl(API_ENDPOINTS.pharmacy.medicinesImport), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
        body,
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
        throw new Error(getResponseMessage(payload, `Medicine import failed (HTTP ${response.status}).`));
      }

      const message = getResponseMessage(payload, "Medicine workbook imported successfully.");
      setResultMessage(message);
      setFile(null);
      form.reset();
      toast.success("Medicine workbook imported successfully.");
      await loadMedicines();
    } catch (requestError) {
      setError(requestError.message || "Unable to import the medicine workbook.");
      toast.error(requestError.message || "Unable to import the medicine workbook.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="pharmacy-import-page">
      <div className="pharmacy-import-heading">
        <span className="pharmacy-module-icon"><FileSpreadsheet size={22} /></span>
        <div>
          <h2>Import medicines and stock</h2>
          <p>Upload the pharmacy Excel workbook to import its medicine and stock records.</p>
        </div>
      </div>

      {error ? <div className="pharmacy-import-message is-error" role="alert">{error}</div> : null}
      {resultMessage ? <div className="pharmacy-import-message is-success" role="status">{resultMessage}</div> : null}

      <form className="pharmacy-import-card" onSubmit={importMedicines}>
        <label className="pharmacy-file-drop">
          <FileSpreadsheet size={32} />
          <strong>{file ? file.name : "Choose an Excel workbook"}</strong>
          <span>{file ? `${(file.size / 1024).toFixed(1)} KB selected` : "Supported formats: .xlsx and .xls"}</span>
          <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} disabled={isUploading} />
        </label>
        <div className="pharmacy-import-columns">
          <strong>Workbook columns</strong>
          <p>MedicineCode, Name, GenericName, BrandName, Category, DosageForm, Strength, Manufacturer, PackSize, SupplierCode, SupplierName, BatchNumber, ManufactureDate, ExpiryDate, Quantity, PurchasePrice, SellingPrice, GST, MinimumStock, MaximumStock, ReorderLevel, StorageLocation.</p>
          <span>These headings are based on the uploaded sample workbook.</span>
        </div>
        <div className="pharmacy-import-actions">
          <button type="submit" className="pharmacy-import-button" disabled={isUploading || !file}>
            <Upload size={17} />
            {isUploading ? "Importing..." : "Import workbook"}
          </button>
        </div>
      </form>

      <section className="pharmacy-catalogue-card">
        <header className="pharmacy-catalogue-header">
          <div>
            <h2>Medicine catalogue</h2>
            <p>{isLoadingMedicines ? "Loading medicines..." : `${filteredMedicines.length} medicines listed`}</p>
          </div>
          <button type="button" className="pharmacy-catalogue-refresh" onClick={loadMedicines} disabled={isLoadingMedicines} aria-label="Refresh medicines" title="Refresh medicines">
            <RefreshCw size={17} />
          </button>
        </header>

        {medicinesError ? <div className="pharmacy-import-message is-error" role="alert">{medicinesError}</div> : null}

        <label className="pharmacy-catalogue-search">
          <Search size={18} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search medicines..."
            aria-label="Search medicines"
          />
        </label>

        <div className="pharmacy-catalogue-scroll">
          <table className="pharmacy-catalogue-table">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Generic / Brand</th>
                <th>Category</th>
                <th>Dosage</th>
                <th>Batch</th>
                <th>Expiry</th>
                <th>Quantity</th>
                <th>Selling price</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingMedicines ? (
                <tr><td colSpan="8">Loading medicines...</td></tr>
              ) : medicinesError ? (
                <tr><td colSpan="8">Unable to display the catalogue. See the error above.</td></tr>
              ) : filteredMedicines.length === 0 ? (
                <tr><td colSpan="8">{search ? "No medicines match your search." : "No medicines found in the catalogue."}</td></tr>
              ) : filteredMedicines.map((medicine, index) => (
                <tr key={getMedicineValue(medicine, "id", "Id", "medicineId", "MedicineId", "medicineCode", "MedicineCode") !== "-" ? getMedicineValue(medicine, "id", "Id", "medicineId", "MedicineId", "medicineCode", "MedicineCode") : index}>
                  <td>
                    <strong>{getMedicineValue(medicine, "name", "Name", "medicineName", "MedicineName")}</strong>
                    <small>{getMedicineValue(medicine, "medicineCode", "MedicineCode", "code", "Code")}</small>
                  </td>
                  <td>{getMedicineValue(medicine, "genericName", "GenericName")} / {getMedicineValue(medicine, "brandName", "BrandName")}</td>
                  <td>{getMedicineValue(medicine, "category", "Category")}</td>
                  <td>{getMedicineValue(medicine, "dosageForm", "DosageForm")} {getMedicineValue(medicine, "strength", "Strength") !== "-" ? ` · ${getMedicineValue(medicine, "strength", "Strength")}` : ""}</td>
                  <td>{getMedicineValue(medicine, "batchNumber", "BatchNumber")}</td>
                  <td>{getMedicineValue(medicine, "expiryDate", "ExpiryDate")}</td>
                  <td>{getMedicineValue(medicine, "quantity", "Quantity", "stock", "Stock", "availableQuantity", "AvailableQuantity")}</td>
                  <td>{getMedicineValue(medicine, "sellingPrice", "SellingPrice")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

export default PharmacyMedicineImport;
