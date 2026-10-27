import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Plus, RefreshCw, Search, Upload, X } from "lucide-react";
import { API_ENDPOINTS, apiUrl } from "../config/api";
import { useToast } from "../components/ToastProvider";
import { getPharmacistToken } from "./pharmacySession";

import "./PharmacyMedicines.css";
import { medicineColumns, normalizeMedicine, normalizeMedicineWorkbook } from "./medicineColumns";

const allowedExtensions = [".xlsx", ".xls"];

const getResponseMessage = (payload, fallback) => {
  const validation = payload?.errors && typeof payload.errors === "object"
    ? Object.values(payload.errors).flat().filter(Boolean).join(" ")
    : "";
  const missing = payload?.missingColumns || payload?.missing;
  return [payload?.message, validation, payload?.detail,
    Array.isArray(missing) ? `Missing columns: ${missing.join(", ")}` : ""]
    .filter(Boolean).join(" ") || payload?.title || payload?.error ||
    (typeof payload === "string" ? payload : "") || fallback;
};

const parseMedicineList = (payload, depth = 0) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object" || depth > 4) return null;
  for (const key of ["data", "items", "results", "records", "medicines", "catalogue", "catalog"]) {
    const actualKey = Object.keys(payload).find((candidate) => candidate.toLowerCase() === key);
    const items = actualKey && parseMedicineList(payload[actualKey], depth + 1);
    if (items) return items;
  }
  return null;
};

const getMedicineValue = (medicine, ...keys) => {
  for (const key of keys) {
    const value = key.split(".").reduce((current, part) => current?.[part], medicine);
    if (value !== null && value !== undefined && String(value).trim() !== "") return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
  return "-";
};

function PharmacyMedicineImport({ stockOnly = false }) {
  const toast = useToast();
  const fileInput = useRef(null);
  const catalogueScrollRef = useRef(null);
  const catalogueScrollbarRef = useRef(null);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({});
  const [isExporting, setIsExporting] = useState(false);
  const numericFields = ["Quantity", "PurchasePrice", "SellingPrice", "GST", "MinimumStock", "MaximumStock", "ReorderLevel"];
  const quantityFields = ["Quantity", "MinimumStock", "MaximumStock", "ReorderLevel"];
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
      setMedicines(items.map(normalizeMedicine));
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
      Object.values(medicine).some((value) => value != null && String(value).toLowerCase().includes(term))
    );
  }, [medicines, search]);

  const displayColumns = useMemo(() => {
    const known = new Set(medicineColumns.map(([key]) => key));
    const extra = [...new Set(medicines.flatMap(Object.keys))].filter((key) => !known.has(key));
    return [...medicineColumns, ...extra.map((key) => [key, key.replace(/([a-z])([A-Z])/g, "$1 $2")])];
  }, [medicines]);
  const tableColumns = displayColumns.filter(([key]) => key.toLowerCase() !== "id");

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    setError("");
    setResultMessage("");
  };

  const uploadWorkbook = async (selectedFile, successMessage) => {
    const token = getPharmacistToken();
    if (!token) throw new Error("Your pharmacist session is missing. Sign in again and retry.");
    const normalizedFile = await normalizeMedicineWorkbook(selectedFile);
    const body = new FormData();
    body.append("file", normalizedFile);
    const response = await fetch(apiUrl(API_ENDPOINTS.pharmacy.medicinesImport), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" },
      body,
    });
    const text = await response.text();
    let payload;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
    if (!response.ok) throw new Error(getResponseMessage(payload, `Medicine import failed (HTTP ${response.status}).`));
    setResultMessage(getResponseMessage(payload, successMessage));
    toast.success(successMessage);
    await loadMedicines();
  };

  const importMedicines = async (event) => {
    event.preventDefault();
    if (isUploading) return;
    if (!file || !allowedExtensions.some((extension) => file.name.toLowerCase().endsWith(extension))) {
      setError("Choose an .xlsx or .xls workbook before importing.");
      return;
    }
    setIsUploading(true); setError(""); setResultMessage("");
    try {
      await uploadWorkbook(file, "Medicine workbook imported successfully.");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (failure) { setError(failure.message); toast.error(failure.message); }
    finally { setIsUploading(false); }
  };

  const addMedicine = async (event) => {
    event.preventDefault();
    if (isUploading) return;
    setError(""); setResultMessage("");
    if (!String(draft.Name || "").trim() || draft.Quantity === undefined || draft.Quantity === "") {
      setError("Enter a medicine name and stock quantity."); return;
    }
    for (const key of numericFields) {
      if (draft[key] === undefined || draft[key] === "") continue;
      const value = Number(draft[key]);
      if (!Number.isFinite(value) || value < 0 || (quantityFields.includes(key) && !Number.isInteger(value)) || (key === "GST" && value > 100)) {
        setError("Enter valid nonnegative values. Stock quantities must be whole numbers and GST must be between 0 and 100."); return;
      }
    }
    if (draft.ManufactureDate && draft.ExpiryDate && draft.ExpiryDate < draft.ManufactureDate) {
      setError("Expiry date must be on or after the manufacture date."); return;
    }
    setIsUploading(true);
    try {
      const XLSX = await import("xlsx");
      const row = Object.fromEntries(medicineColumns.map(([key]) => [key, numericFields.includes(key) && draft[key] !== undefined && draft[key] !== "" ? Number(draft[key]) : String(draft[key] ?? "").trim()]));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([row]), "Medicines");
      const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
      await uploadWorkbook(new File([bytes], "medicine.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "Medicine saved successfully.");
      setDraft({}); setShowAdd(false);
    } catch (failure) { setError(failure.message); toast.error(failure.message); }
    finally { setIsUploading(false); }
  };

  const exportMedicines = async () => {
    setIsExporting(true); setError("");
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      const rows = [displayColumns.map(([key]) => key), ...filteredMedicines.map((medicine) => displayColumns.map(([key]) => medicine[key] ?? ""))];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Medicines");
      XLSX.writeFile(workbook, stockOnly ? "medicine-stock.xlsx" : "medicines.xlsx");
    } catch (failure) { setError(failure.message || "Unable to export medicines."); }
    finally { setIsExporting(false); }
  };

  return (
    <section className="pharmacy-import-page pharmacy-medicines-page">
      <header className="medicine-page-heading">
        <div><h2>{stockOnly ? "Medicine Stock" : "Medicines"}</h2><p>{isLoadingMedicines ? "Loading medicine records..." : `${medicines.length} medicine records available in the catalogue`}</p></div>
        <div className="medicine-toolbar">
          <button type="button" className="medicine-action medicine-action-refresh" onClick={loadMedicines} disabled={isLoadingMedicines || isUploading} aria-label="Refresh medicines" title="Refresh medicines"><RefreshCw size={19} /></button>
          {!stockOnly && <><input ref={fileInput} className="medicine-file-input" type="file" accept=".xlsx,.xls" onChange={handleFileChange} disabled={isUploading} aria-label="Choose medicine workbook" /><button type="button" className="medicine-action medicine-action-import" onClick={() => fileInput.current?.click()} disabled={isUploading}><Upload size={18} />Import File</button></>}
          <button type="button" className="medicine-action medicine-action-export" disabled={isExporting || isLoadingMedicines || !filteredMedicines.length} onClick={exportMedicines}><Download size={18} />{isExporting ? "Exporting..." : "Export File"}</button>
        </div>
      </header>
      {error && <div className="pharmacy-import-message is-error" role="alert">{error}</div>}
      {medicinesError && <div className="pharmacy-import-message is-error" role="alert">{medicinesError}</div>}
      {resultMessage && <div className="pharmacy-import-message is-success" role="status">{resultMessage}</div>}
      {!stockOnly && file && <form className="medicine-selected-file" onSubmit={importMedicines}><FileSpreadsheet size={24} /><div><strong>{file.name}</strong><span>Excel workbook ready to import</span></div><button className="medicine-action medicine-action-import" disabled={isUploading} type="submit">{isUploading ? "Importing..." : "Import workbook"}</button><button type="button" className="medicine-dismiss" aria-label="Cancel import" disabled={isUploading} onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = ""; }}><X size={18} /></button></form>}
      <section className="pharmacy-catalogue-card">
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

        <div
          ref={catalogueScrollbarRef}
          className="pharmacy-catalogue-horizontal-scroll"
          role="region"
          aria-label="Horizontal scroll for medicine table"
          tabIndex={0}
          onScroll={(event) => {
            if (catalogueScrollRef.current) catalogueScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
          }}
        >
          <div className="pharmacy-catalogue-horizontal-scroll-content" aria-hidden="true" />
        </div>

        <div
          ref={catalogueScrollRef}
          className="pharmacy-catalogue-scroll"
          onScroll={(event) => {
            if (catalogueScrollbarRef.current) catalogueScrollbarRef.current.scrollLeft = event.currentTarget.scrollLeft;
          }}
        >
          <table className="pharmacy-catalogue-table">
            <thead>
              <tr>
                {tableColumns.map(([key, label]) => <th key={key}>{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {isLoadingMedicines ? (
                <tr><td colSpan={tableColumns.length}>Loading medicines...</td></tr>
              ) : medicinesError ? (
                <tr><td colSpan={tableColumns.length}>Unable to display the catalogue. See the error above.</td></tr>
              ) : filteredMedicines.length === 0 ? (
                <tr><td colSpan={tableColumns.length}>{search ? "No medicines match your search." : "No medicines found in the catalogue."}</td></tr>
              ) : filteredMedicines.map((medicine, index) => (
                <tr key={index}>
                  {tableColumns.map(([key]) => (
                    <td key={key}>{getMedicineValue(medicine, key)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="medicine-table-footer"><span>{filteredMedicines.length} of {medicines.length} medicines</span>{!stockOnly && <button type="button" className="medicine-action medicine-action-add" disabled={isUploading} onClick={() => setShowAdd((value) => !value)} aria-expanded={showAdd} aria-controls="medicine-add-form"><Plus size={18} />Add Medicine</button>}</div>
      {!stockOnly && showAdd && <form id="medicine-add-form" className="medicine-add-form" onSubmit={addMedicine}>
        <header><div><h3>Add Medicine</h3><p>Enter medicine and stock details. Fields marked * are required.</p></div><button type="button" className="medicine-dismiss" disabled={isUploading} aria-label="Close add medicine" onClick={() => setShowAdd(false)}><X size={20} /></button></header>
        <fieldset disabled={isUploading}><div className="medicine-form-grid">{medicineColumns.map(([key, label]) => <label key={key}>{label}{["Name", "Quantity"].includes(key) ? " *" : ""}<input name={key} required={["Name", "Quantity"].includes(key)} type={key.endsWith("Date") ? "date" : numericFields.includes(key) ? "number" : "text"} min={numericFields.includes(key) ? 0 : undefined} max={key === "GST" ? 100 : undefined} step={numericFields.includes(key) ? quantityFields.includes(key) ? 1 : "0.01" : undefined} value={draft[key] ?? ""} onChange={(event) => setDraft((previous) => ({ ...previous, [key]: event.target.value }))} /></label>)}</div></fieldset>
        {error && <p className="medicine-form-error" role="status">{error}</p>}
        <footer><button type="button" className="medicine-action medicine-action-cancel" disabled={isUploading} onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" className="medicine-action medicine-action-add" disabled={isUploading}>{isUploading ? "Saving..." : "Save Medicine"}</button></footer>
      </form>}
    </section>
  );
}

export default PharmacyMedicineImport;
