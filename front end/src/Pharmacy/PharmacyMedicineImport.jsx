import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Plus, RefreshCw, Search, Upload, X } from "lucide-react";
import { API_ENDPOINTS, apiUrl } from "../config/api";
import { useToast } from "../components/ToastProvider";
import { pharmacyRequest, invalidatePharmacyReads, field, unwrap } from "./pharmacyApi";
import { getPharmacistToken } from "./pharmacySession";

import "./PharmacyMedicines.css";
import { medicineColumns, normalizeMedicine, normalizeMedicineWorkbook, mergeMedicineDetails } from "./medicineColumns";

const allowedExtensions = [".xlsx", ".xls"];
const medicineId = (medicine) => field(medicine, "id", "medicineId");
const medicineInactive = (medicine) => {
  const active = field(medicine, "isActive");
  const deleted = field(medicine, "isDeleted");
  return active === false || active === 0 || String(active).toLowerCase() === "false" || deleted === true || String(deleted).toLowerCase() === "true";
};

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
  const medicineDetailsRef = useRef(null);
  const medicineFormRef = useRef(null);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [medicineDetails, setMedicineDetails] = useState(null);
  const [isManaging, setIsManaging] = useState(false);
  const [deactivatedMedicines, setDeactivatedMedicines] = useState([]);
  const [lookupId, setLookupId] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const numericFields = ["Quantity", "PurchasePrice", "SellingPrice", "GST", "MinimumStock", "MaximumStock", "ReorderLevel"];
  const quantityFields = ["Quantity", "MinimumStock", "MaximumStock", "ReorderLevel"];
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  useEffect(() => {
    if (!resultMessage) return undefined;
    const timeout = window.setTimeout(() => setResultMessage(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [resultMessage]);
  const [medicines, setMedicines] = useState([]);
  const [isLoadingMedicines, setIsLoadingMedicines] = useState(true);
  const [medicinesError, setMedicinesError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const panel = showAdd ? medicineFormRef.current : medicineDetails ? medicineDetailsRef.current : null;
    if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showAdd, medicineDetails, editingId]);

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
      const payload = await pharmacyRequest(API_ENDPOINTS.pharmacy.medicines, { cacheMs: 15000 });
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
    const rows = stockOnly ? medicines : [...medicines, ...deactivatedMedicines.filter((item) => !medicines.some((row) => String(medicineId(row)) === String(medicineId(item))))];
    if (!term) return rows;
    return rows.filter((medicine) =>
      Object.values(medicine).some((value) => value != null && String(value).toLowerCase().includes(term))
    );
  }, [medicines, search, stockOnly, deactivatedMedicines]);

  const [pageSelection, setPageSelection] = useState({ key: '', page: 0 });
  const pageFilter = search;
  const pageCount = Math.max(1, Math.ceil(filteredMedicines.length / 10));
  const currentPage = pageSelection.key === pageFilter ? Math.min(pageSelection.page, pageCount - 1) : 0;
  const pageRows = filteredMedicines.slice(currentPage * 10, (currentPage + 1) * 10);
  const changePage = (page) => setPageSelection({ key: pageFilter, page });

  const displayColumns = useMemo(() => {
    const known = new Set(medicineColumns.map(([key]) => key));
    const extra = [...new Set(medicines.flatMap(Object.keys))].filter((key) => !known.has(key));
    return [...medicineColumns, ...extra.map((key) => [key, key.replace(/([a-z])([A-Z])/g, "$1 $2")])];
  }, [medicines]);
  const tableColumns = displayColumns.filter(([key]) => key.toLowerCase() !== "id");
  const columnCount = tableColumns.length + (stockOnly ? 0 : 1);

  const openMedicine = async (medicine, edit = false) => {
    const id = medicineId(medicine);
    if (id === "" || id == null || isManaging) return;
    setIsManaging(true); setError("");
    try {
      const payload = unwrap(await pharmacyRequest(API_ENDPOINTS.pharmacy.medicineById, { params: { id } }));
      const detail = field(payload, "medicine") || payload;
      if (!detail || typeof detail !== "object" || Array.isArray(detail)) throw new Error("The backend did not return medicine details.");
      const normalized = mergeMedicineDetails(medicine, { ...detail, id: medicineId(detail) || id });
      if (edit) {
        setEditingId(id);
        setDraft(Object.fromEntries(medicineColumns.map(([key]) => [key, key.endsWith("Date") ? String(normalized[key] || "").slice(0, 10) : normalized[key] ?? ""])));
        setShowAdd(true); setMedicineDetails(null);
      } else { setMedicineDetails(normalized); }
    } catch (failure) { setError(failure.message); toast.error(failure.message); }
    finally { setIsManaging(false); }
  };

  const changeMedicineStatus = async (medicine) => {
    const id = medicineId(medicine);
    if (id === "" || id == null || isManaging) return;
    const activate = medicineInactive(medicine);
    if (!window.confirm(`${activate ? "Activate" : "Deactivate"} ${medicine.Name || "this medicine"}?`)) return;
    setIsManaging(true); setError(""); setResultMessage("");
    try {
      await pharmacyRequest(activate ? API_ENDPOINTS.pharmacy.medicineActivate : API_ENDPOINTS.pharmacy.medicineById, { method: activate ? "PATCH" : "DELETE", params: { id } });
      if (activate) {
        setDeactivatedMedicines((rows) => rows.filter((row) => String(medicineId(row)) !== String(id)));
      } else {
        const inactive = { ...medicine, isActive: false, isDeleted: true };
        setDeactivatedMedicines((rows) => [...rows.filter((row) => String(medicineId(row)) !== String(id)), inactive]);
      }
      setMedicineDetails(null);
      await loadMedicines();
      setResultMessage(`Medicine ${activate ? "activated" : "deactivated"} successfully.`);
      toast.success(`Medicine ${activate ? "activated" : "deactivated"} successfully.`);
    } catch (failure) { setError(failure.message); toast.error(failure.message); }
    finally { setIsManaging(false); }
  };

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
    invalidatePharmacyReads();
    await loadMedicines();
  };

  const importMedicines = async (event) => {
    event.preventDefault();
    if (isUploading || isManaging) return;
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
    if (isUploading || isManaging) return;
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
      const row = Object.fromEntries(medicineColumns.map(([key]) => [key, numericFields.includes(key) && draft[key] !== undefined && draft[key] !== "" ? Number(draft[key]) : String(draft[key] ?? "").trim()]));
      const body = Object.fromEntries(Object.entries(row).map(([key, value]) => [key === "Name" ? "Name" : key === "Quantity" ? "stockQuantity" : key === "GST" ? "gst" : key[0].toLowerCase() + key.slice(1), value === "" ? null : value]));
      await pharmacyRequest(editingId === null ? API_ENDPOINTS.pharmacy.medicines : API_ENDPOINTS.pharmacy.medicineById, {
        method: editingId === null ? "POST" : "PUT", params: editingId === null ? undefined : { id: editingId }, body,
      });
      setResultMessage("Medicine saved successfully."); toast.success("Medicine saved successfully.");
      await loadMedicines();
      setDraft({}); setEditingId(null); setShowAdd(false);
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
      <header className="medicine-page-heading" data-page-header>
        <div><h2>{stockOnly ? "Medicine Stock" : "Medicines"}</h2><p>{isLoadingMedicines ? "Loading medicine records..." : `${medicines.length} medicine records available in the catalogue`}</p></div>
        <div className="medicine-toolbar">
          <button type="button" className="medicine-action medicine-action-refresh" onClick={() => { invalidatePharmacyReads(); loadMedicines(); }} disabled={isLoadingMedicines || isUploading} aria-label="Refresh medicines" title="Refresh medicines"><RefreshCw size={19} /></button>
          {!stockOnly && <><input ref={fileInput} className="medicine-file-input" type="file" accept=".xlsx,.xls" onChange={handleFileChange} disabled={isUploading} aria-label="Choose medicine workbook" /><button type="button" className="medicine-action medicine-action-import" onClick={() => fileInput.current?.click()} disabled={isUploading}><Upload size={18} />Import File</button></>}
          <button type="button" className="medicine-action medicine-action-export" disabled={isExporting || isLoadingMedicines || !filteredMedicines.length} onClick={exportMedicines}><Download size={18} />{isExporting ? "Exporting..." : "Export File"}</button>
        </div>
      </header>
      {error && <div className="pharmacy-import-message is-error" role="alert">{error}</div>}
      {medicinesError && <div className="pharmacy-import-message is-error" role="alert">{medicinesError}</div>}
      {resultMessage && <div className="pharmacy-import-message is-success" role="status">{resultMessage}</div>}
      {!stockOnly && file && <form className="medicine-selected-file" onSubmit={importMedicines}><FileSpreadsheet size={24} /><div><strong>{file.name}</strong><span>Excel workbook ready to import</span></div><button className="medicine-action medicine-action-import" disabled={isUploading} type="submit">{isUploading ? "Importing..." : "Import workbook"}</button><button type="button" className="medicine-dismiss" aria-label="Cancel import" disabled={isUploading} onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = ""; }}><X size={18} /></button></form>}
      <section className="pharmacy-catalogue-card">
        {!stockOnly && <form className="medicine-row-actions" onSubmit={(event) => { event.preventDefault(); if (lookupId.trim()) openMedicine({ id: lookupId.trim() }); }}>
          <label>Medicine ID <input aria-label="Medicine ID" value={lookupId} onChange={(event) => setLookupId(event.target.value)} disabled={isManaging || isUploading} /></label>
          <button type="submit" className="medicine-action" disabled={!lookupId.trim() || isManaging || isUploading}>View by ID</button>
          <button type="button" className="medicine-action" aria-label="Clear medicine ID" disabled={!lookupId || isManaging || isUploading} onClick={() => setLookupId("")}>Clear</button>
        </form>}
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
                {!stockOnly && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoadingMedicines ? (
                <tr><td colSpan={columnCount}>Loading medicines...</td></tr>
              ) : medicinesError ? (
                <tr><td colSpan={columnCount}>Unable to display the catalogue. See the error above.</td></tr>
              ) : filteredMedicines.length === 0 ? (
                <tr><td colSpan={columnCount}>{search ? "No medicines match your search." : "No medicines found in the catalogue."}</td></tr>
              ) : pageRows.map((medicine, index) => (
                <tr key={index}>
                  {tableColumns.map(([key]) => (
                    <td key={key}>{getMedicineValue(medicine, key)}</td>
                  ))}
                  {!stockOnly && <td><div className="medicine-row-actions">
                    <button type="button" className="medicine-action" disabled={isManaging || isUploading || medicineId(medicine) === ""} onClick={() => openMedicine(medicine)}>View</button>
                    <button type="button" className="medicine-action" disabled={isManaging || isUploading || medicineInactive(medicine) || medicineId(medicine) === ""} onClick={() => openMedicine(medicine, true)}>Edit</button>
                    <button type="button" className="medicine-action" disabled={isManaging || isUploading || medicineId(medicine) === ""} onClick={() => changeMedicineStatus(medicine)}>{medicineInactive(medicine) ? "Activate" : "Delete"}</button>
                  </div></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <nav className="pharmacy-pagination" aria-label="Table pages">
 <span>{filteredMedicines.length ? currentPage * 10 + 1 : 0}?{Math.min((currentPage + 1) * 10, filteredMedicines.length)} of {filteredMedicines.length}</span>
 <button type="button" disabled={currentPage === 0} onClick={() => changePage(currentPage - 1)}>Previous</button>
 <button type="button" aria-current="page" aria-label={`Current page ${currentPage + 1}`}>{currentPage + 1}</button>
 <button type="button" disabled={currentPage + 1 >= pageCount} onClick={() => changePage(currentPage + 1)}>Next</button>
 </nav>
      <div className="medicine-table-footer"><span>{filteredMedicines.length} of {medicines.length} medicines</span>{!stockOnly && <button type="button" className="medicine-action medicine-action-add" disabled={isUploading || isManaging} onClick={() => { setEditingId(null); setDraft({}); setShowAdd((value) => !value); }} aria-expanded={showAdd} aria-controls="medicine-add-form"><Plus size={18} />Add Medicine</button>}</div>
      {!stockOnly && medicineDetails && <section ref={medicineDetailsRef} className="medicine-add-form medicine-details-panel" aria-label="Medicine details">
        <header><h3>Medicine Details</h3><button type="button" className="medicine-dismiss" aria-label="Close medicine details" onClick={() => setMedicineDetails(null)}><X size={20} /></button></header>
        <dl className="medicine-form-grid">{Object.entries(medicineDetails).map(([key, value]) => <div key={key}><dt>{medicineColumns.find(([name]) => name === key)?.[1] || key}</dt><dd>{getMedicineValue({ value }, "value")}</dd></div>)}</dl>
        <footer><button type="button" className="medicine-action" disabled={isManaging || isUploading} onClick={() => changeMedicineStatus(medicineDetails)}>{medicineInactive(medicineDetails) ? "Activate" : "Delete"}</button></footer>
      </section>}
      {!stockOnly && showAdd && <form ref={medicineFormRef} id="medicine-add-form" className="medicine-add-form" onSubmit={addMedicine}>
        <header><div><h3>{editingId === null ? "Add Medicine" : "Edit Medicine"}</h3><p>Enter medicine and stock details. Fields marked * are required.</p></div><button type="button" className="medicine-dismiss" disabled={isUploading} aria-label="Close add medicine" onClick={() => setShowAdd(false)}><X size={20} /></button></header>
        <fieldset disabled={isUploading}><div className="medicine-form-grid">{medicineColumns.map(([key, label]) => <label key={key}>{label}{["Name", "Quantity"].includes(key) ? " *" : ""}<input name={key} required={["Name", "Quantity"].includes(key)} type={key.endsWith("Date") ? "date" : numericFields.includes(key) ? "number" : "text"} min={numericFields.includes(key) ? 0 : undefined} max={key === "GST" ? 100 : undefined} step={numericFields.includes(key) ? quantityFields.includes(key) ? 1 : "0.01" : undefined} value={draft[key] ?? ""} onChange={(event) => setDraft((previous) => ({ ...previous, [key]: event.target.value }))} /></label>)}</div></fieldset>
        {error && <p className="medicine-form-error" role="status">{error}</p>}
        <footer><button type="button" className="medicine-action medicine-action-cancel" disabled={isUploading} onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" className="medicine-action medicine-action-add" disabled={isUploading}>{isUploading ? "Saving..." : "Save Medicine"}</button></footer>
      </form>}
    </section>
  );
}

export default PharmacyMedicineImport;
