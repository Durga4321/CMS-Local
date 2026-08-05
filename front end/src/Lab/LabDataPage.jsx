import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle, Download, FileText, Play, RefreshCw, Search, TestTube2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import { downloadBlob, firstSuccessfulList, parseList, requestJson } from "./labApi";
import { getLabProfile } from "./labSession";
import { getClinicDisplayName } from "../utils/clinicDisplay";
import { getClinicInvoiceBranding } from "../utils/clinicBranding";
import { downloadLabReportHtml, getReportName, printLabReport } from "./labReportTemplate";
import { readGeneratedLabReports } from "./labReportStore";
import { fetchLabMasterTests } from "../utils/labMaster";
import {
  dedupeBillingRows,
  readLocalBillingRows,
  RECEPTION_RECENT_SERVICE_BILLS_KEY,
} from "../utils/billingRevenue";

const readFirst = (record = {}, keys = [], fallback = "-") => {
  for (const key of keys) {
    const value = String(key).split(".").reduce((current, part) => (current && typeof current === "object" ? current[part] : undefined), record);
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return fallback;
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

const pageConfig = {
  patients: {
    title: "Patients",
    subtitle: "Patients with diagnostic billing/orders from reception for your clinic and branch.",
    paths: ["Lab/orders", "Billing/diagnostic", "Billing/diagnostics", "Reception/diagnostic-bills", "DiagnosticBilling", "Billing"],
    columns: [
      ["Patient", ["patientName", "PatientName", "name", "Name", "fullName"]],
      ["Visit Date", ["visitDate", "VisitDate", "appointmentDate", "AppointmentDate", "invoiceDate", "InvoiceDate", "billDate", "BillDate", "createdAt", "CreatedAt", "date", "Date"]],
      ["Phone", ["phone", "Phone", "mobile", "Mobile", "phoneNumber", "patient.phone", "Patient.Phone"]],
      ["Tests", ["__labTestNames", "testName", "TestName", "labTestName", "items", "serviceItems", "billItems"]],
    ],
  },
  tests: {
    title: "Diagnosis Tests",
    subtitle: "Lab master diagnosis test data from the lab module.",
    paths: ["Lab/master"],
    columns: [
      ["Test", ["testName", "TestName", "name", "Name", "title"]],
      ["Code", ["testCode", "TestCode", "code", "Code"]],
      ["Category", ["category", "Category"]],
      ["Price", ["price", "Price", "amount", "Amount"]],
    ],
  },
  samples: {
    title: "Sample Collection",
    subtitle: "Samples waiting, collected, processed, and reported by the lab.",
    paths: ["Lab/orders", "Billing/diagnostic", "Billing/diagnostics", "Reception/diagnostic-bills", "DiagnosticBilling", "Billing"],
    columns: [
      ["Patient", ["patientName", "PatientName", "patient.name"]],
      ["Visit Date", ["visitDate", "VisitDate", "appointmentDate", "AppointmentDate", "invoiceDate", "InvoiceDate", "billDate", "BillDate", "createdAt", "CreatedAt", "date", "Date"]],
      ["Phone", ["phone", "Phone", "mobile", "Mobile", "phoneNumber", "patient.phone", "Patient.Phone"]],
      ["Tests", ["__labTestNames", "testName", "TestName", "labTestName", "items", "serviceItems", "billItems"]],
      ["Status", ["status", "Status", "sampleStatus"]],
    ],
  },
  reports: {
    title: "Reports",
    subtitle: "Lab reports and diagnostic result records.",
    paths: ["Lab/doctor/reports", "Lab/patient/reports"],
    columns: [
      ["Report", ["reportName", "ReportName", "reportTitle", "title", "__labTestNames", "testName", "TestName"]],
      ["Patient", ["patientName", "PatientName", "patient.name"]],
      ["Date", ["reportDate", "createdAt", "CreatedAt", "date"]],
      ["Status", ["status", "Status"]],
    ],
  },
};

const normalizeId = (value) => String(value ?? "").trim();
const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const getRecordClinicId = (record = {}) =>
  normalizeId(readFirst(record, [
    "hospitalId", "HospitalId", "clinicId", "ClinicId",
    "patient.hospitalId", "patient.clinicId", "Patient.HospitalId", "Patient.ClinicId",
    "bill.hospitalId", "bill.clinicId", "Bill.HospitalId", "Bill.ClinicId",
  ], ""));

const getRecordBranchId = (record = {}) =>
  normalizeId(readFirst(record, [
    "branchId", "BranchId", "clinicBranchId", "ClinicBranchId",
    "patient.branchId", "patient.clinicBranchId", "Patient.BranchId", "Patient.ClinicBranchId",
    "bill.branchId", "bill.clinicBranchId", "Bill.BranchId", "Bill.ClinicBranchId",
  ], ""));

const getRecordBranchName = (record = {}) =>
  normalizeText(readFirst(record, [
    "branchName", "BranchName", "branch.name", "Branch.Name",
    "patient.branchName", "Patient.BranchName", "bill.branchName", "Bill.BranchName",
  ], ""));

const belongsToLabScope = (record = {}, profile = getLabProfile()) => {
  const clinicId = normalizeId(profile.hospitalId);
  const branchId = normalizeId(profile.branchId);
  const branchName = normalizeText(profile.branchName);
  const recordClinicId = getRecordClinicId(record);
  const recordBranchId = getRecordBranchId(record);
  const recordBranchName = getRecordBranchName(record);

  if (clinicId && recordClinicId && recordClinicId !== clinicId) return false;
  if (branchId && recordBranchId && recordBranchId !== branchId) return false;
  if (branchName && !recordBranchId && recordBranchName && recordBranchName !== branchName) return false;
  return true;
};

const getServiceBillType = (record = {}) =>
  normalizeText(readFirst(record, [
    "billingType", "BillingType", "invoiceType", "InvoiceType",
    "serviceType", "ServiceType", "type", "Type",
  ], ""));

const isDiagnosticRecord = (record = {}) => {
  const source = normalizeText(record.__sourcePath);
  if (source.includes("lab/orders") || source.includes("diagnostic") || source.includes("labgeneratedreports")) return true;
  const typeText = getServiceBillType(record);
  const labAmount = Number(readFirst(record, ["labCharges", "labCharge", "diagnosticRevenue"], 0)) || 0;
  const reportName = readFirst(record, ["reportName", "ReportName", "reportTitle", "testName", "TestName"], "");
  return /diagnostic|diagnosis|lab|test/.test(typeText) || labAmount > 0 || Boolean(reportName);
};

const getLineItems = (record = {}) => {
  const keys = [
    "items", "Items", "serviceItems", "ServiceItems", "billItems", "BillItems",
    "lineItems", "LineItems", "billingItems", "BillingItems", "tests", "Tests",
  ];
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
};

const getItemTestName = (item = {}) =>
  readFirst(item, ["testName", "TestName", "labTestName", "item", "name", "Name", "serviceName"], "");

const getPatientTestNames = (record = {}) => {
  const direct = readFirst(record, ["testName", "TestName", "labTestName", "LabTestName", "diagnosisTests", "DiagnosisTests"], "");
  const items = getLineItems(record)
    .map(getItemTestName)
    .filter(Boolean);
  const names = [...String(direct || "").split(","), ...items]
    .map((name) => String(name).trim())
    .filter(Boolean);
  return Array.from(new Set(names)).join(", ") || "-";
};

const getPatientLabAmount = (record = {}) => {
  const direct = Number(readFirst(record, ["labCharges", "labCharge", "diagnosticRevenue", "totalAmount", "grandTotal", "amount"], 0)) || 0;
  if (direct > 0) return direct;
  return getLineItems(record).reduce((sum, item) => {
    const unitPrice = Number(readFirst(item, ["unitPrice", "price", "Price", "rate", "amount"], 0)) || 0;
    const quantity = Number(readFirst(item, ["quantity", "qty"], 1)) || 1;
    return sum + unitPrice * quantity;
  }, 0);
};

const enrichLabPatientRow = (record = {}) => ({
  ...record,
  __labTestNames: getPatientTestNames(record),
  __labAmount: getPatientLabAmount(record),
});

const getRecordDateValue = (record = {}) =>
  readFirst(record, ["visitDate", "VisitDate", "appointmentDate", "AppointmentDate", "invoiceDate", "InvoiceDate", "billDate", "BillDate", "createdAt", "CreatedAt", "date", "Date"], "");

const isToday = (value) => {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
};

const isPastDate = (value) => {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
};

const getNormalizedStatus = (record = {}) =>
  normalizeText(readFirst(record, ["status", "Status", "orderStatus", "sampleStatus", "resultStatus", "reportStatus"], ""));

const isDoneRecord = (record = {}) => {
  const status = getNormalizedStatus(record);
  return /complete|completed|done|reported|delivered|cancel|cancelled|canceled/.test(status);
};

const isBillingBackedRecord = (record = {}) => {
  const source = normalizeText(record.__sourcePath);
  return source.includes("billing") || source.includes("diagnosticbilling");
};

const updateRecentBillingRow = (row = {}, patch = {}) => {
  try {
    const id = recordIdentifier(row);
    const invoiceNo = readFirst(row, ["invoiceNo", "invoiceNumber", "billNumber"], "");
    const nextRows = readLocalBillingRows(RECEPTION_RECENT_SERVICE_BILLS_KEY).map((item) => {
      const sameId = id && recordIdentifier(item) === id;
      const sameInvoice = invoiceNo && readFirst(item, ["invoiceNo", "invoiceNumber", "billNumber"], "") === invoiceNo;
      return sameId || sameInvoice ? { ...item, ...patch } : item;
    });
    localStorage.setItem(RECEPTION_RECENT_SERVICE_BILLS_KEY, JSON.stringify(nextRows));
  } catch {
    // Backend update is the source of truth; local cache update is best effort.
  }
};

const recordIdentifier = (row = {}) =>
  String(readFirst(row, ["id", "Id", "orderId", "OrderId", "labOrderId", "LabOrderId", "billingId", "BillingId", "billId", "BillId", "invoiceId", "InvoiceId", "testId", "TestId"], "") || "");

const filterRowsByView = (rows = [], view = "") => {
  if (view === "today") return rows.filter((row) => isToday(getRecordDateValue(row)));
  if (view === "pending") return rows.filter((row) => isPastDate(getRecordDateValue(row)) && !isDoneRecord(row));
  if (view === "samples") return rows.filter((row) => !/complete|completed|reported|delivered|cancel|cancelled|canceled/.test(getNormalizedStatus(row)));
  if (view === "in-progress") return rows.filter((row) => /progress|processing|started/.test(getNormalizedStatus(row)));
  if (view === "completed") return rows.filter((row) => isToday(getRecordDateValue(row)) && /complete|completed|done|reported|delivered/.test(getNormalizedStatus(row)));
  if (view === "cancelled") return rows.filter((row) => /cancel|cancelled|canceled/.test(getNormalizedStatus(row)));
  if (view === "pending-reports") return rows.filter((row) => !/reported|delivered/.test(getNormalizedStatus(row)) && !/cancel|cancelled|canceled/.test(getNormalizedStatus(row)));
  return rows;
};

const isGeneratedReport = (row = {}) =>
  /reported|delivered/.test(getNormalizedStatus(row)) ||
  Boolean(readFirst(row, ["reportName", "ReportName", "reportTitle", "findings", "Findings", "reportFindings", "ReportFindings"], ""));

function LabDataPage({ type }) {
  const config = pageConfig[type];
  const location = useLocation();
  const view = new URLSearchParams(location.search).get("view") || "";
  const labProfile = useMemo(() => getLabProfile(), []);
  const clinicName = getClinicDisplayName(labProfile, "Clinic");
  const clinicBranding = getClinicInvoiceBranding({ clinicId: labProfile.hospitalId, clinicName });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const backendData = type === "tests"
        ? await fetchLabMasterTests()
        : type === "patients" || type === "samples" || type === "reports"
        ? (await Promise.allSettled(config.paths.map((path) => requestJson(path))))
            .flatMap((result, index) =>
              result.status === "fulfilled"
                ? parseList(result.value).map((row) => ({ ...row, __sourcePath: config.paths[index] }))
                : []
            )
        : await firstSuccessfulList(config.paths);
      const data = type === "patients" || type === "samples" || type === "reports"
        ? [
            ...backendData,
            ...(type === "reports" ? readGeneratedLabReports() : []),
            ...readLocalBillingRows(RECEPTION_RECENT_SERVICE_BILLS_KEY).map((row) => ({
              ...row,
              __sourcePath: "receptionRecentServiceBills",
            })),
          ]
        : backendData;
      const nextRows = type === "patients" || type === "samples" || type === "reports"
        ? filterRowsByView(dedupeBillingRows(data)
            .filter(isDiagnosticRecord)
            .filter((row) => belongsToLabScope(row, labProfile))
            .map(enrichLabPatientRow), view)
            .filter((row) => type !== "reports" || isGeneratedReport(row))
        : data;
      setRows(nextRows);
    } catch (loadError) {
      setRows([]);
      setError(loadError.message || `Unable to load ${config.title.toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  }, [config, labProfile, type, view]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (!["patients", "samples", "reports"].includes(type)) return undefined;

    const refreshPatients = (event) => {
      if (event.type === "storage" && event.key !== RECEPTION_RECENT_SERVICE_BILLS_KEY) return;
      loadRows();
    };

    window.addEventListener("receptionDiagnosticBillingCompleted", refreshPatients);
    window.addEventListener("labReportsUpdated", refreshPatients);
    window.addEventListener("storage", refreshPatients);
    window.addEventListener("focus", refreshPatients);

    return () => {
      window.removeEventListener("receptionDiagnosticBillingCompleted", refreshPatients);
      window.removeEventListener("labReportsUpdated", refreshPatients);
      window.removeEventListener("storage", refreshPatients);
      window.removeEventListener("focus", refreshPatients);
    };
  }, [loadRows, type]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(term));
  }, [rows, search]);

  const hasActions = type === "samples" || type === "reports";
  const tableTemplate = useMemo(() => {
    if (type === "patients") return "1fr 0.8fr 0.9fr 1.8fr";
    if (type === "samples") return "1fr 0.8fr 0.9fr 1.6fr 0.7fr 150px";
    const actionColumn = hasActions ? " 150px" : "";
    return `repeat(${config.columns.length}, minmax(0, 1fr))${actionColumn}`;
  }, [config.columns.length, hasActions, type]);

  const recordId = (row, index = "") => recordIdentifier(row) || index;

  const actionConfig = {
    collected: {
      labPath: (id) => `Lab/orders/${id}/sample-collected`,
      method: "PATCH",
      status: "Sample Collected",
      payload: { status: "Sample Collected", sampleStatus: "Collected", collectedAt: new Date().toISOString() },
    },
    start: {
      labPath: (id) => `Lab/orders/${id}/start`,
      method: "PATCH",
      status: "In Progress",
      payload: { status: "In Progress", orderStatus: "In Progress", sampleStatus: "Processing", startedAt: new Date().toISOString() },
    },
    complete: {
      labPath: (id) => `Lab/orders/${id}/complete`,
      method: "PATCH",
      status: "Completed",
      payload: { status: "Completed", orderStatus: "Completed", resultStatus: "Completed", completedAt: new Date().toISOString() },
    },
    report: {
      labPath: (id) => `Lab/orders/${id}/report`,
      method: "POST",
      status: "Reported",
      payload: { status: "Reported", reportStatus: "Reported", reportedAt: new Date().toISOString() },
    },
  };

  const runOrderAction = async (row, action) => {
    const id = recordId(row);
    if (!id) return;
    const target = actionConfig[action];
    if (!target) return;

    const patch = {
      ...target.payload,
      Status: target.status,
      updatedAt: new Date().toISOString(),
    };

    const tryBillingUpdate = () =>
      requestJson(`Billing/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...row,
          ...patch,
          id,
          Id: id,
          billingId: row.billingId || row.BillingId || row.billId || row.BillId || id,
          BillingId: row.BillingId || row.billingId || row.BillId || row.billId || id,
        }),
      });

    if (isBillingBackedRecord(row)) {
      await tryBillingUpdate();
    } else {
      try {
        await requestJson(target.labPath(id), { method: target.method, body: JSON.stringify(patch) });
      } catch (error) {
        await tryBillingUpdate();
      }
    }

    updateRecentBillingRow(row, patch);
    await loadRows();
  };

  const downloadReport = async (row) => {
    if (isBillingBackedRecord(row)) {
      downloadLabReportHtml({ record: { ...row, reportName: getReportName(row) }, branding: clinicBranding, clinicName, profile: labProfile });
      return;
    }

    const id = recordId(row);
    try {
      if (id) {
        await downloadBlob(`Lab/orders/${id}/report/download`, `lab-report-${id}`);
        return;
      }
    } catch {
      // Fall back to the generated HTML report when a PDF/blob endpoint is unavailable.
    }
    downloadLabReportHtml({ record: { ...row, reportName: getReportName(row) }, branding: clinicBranding, clinicName, profile: labProfile });
  };

  const printReport = (row) => {
    printLabReport({ record: { ...row, reportName: getReportName(row) }, branding: clinicBranding, clinicName, profile: labProfile });
  };

  return (
    <section className="rc-page lab-page">
      <div className="rc-page-head">
        <div>
          <h2>{config.title}</h2>
          <p>{config.subtitle}</p>
        </div>
        <div className="lab-page-actions">
          <button className="rc-btn secondary" type="button" onClick={loadRows} disabled={loading}><RefreshCw size={16} /> Refresh</button>
        </div>
      </div>
      <label className="lab-search">
        <Search size={17} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${config.title.toLowerCase()}...`} />
      </label>
      {error ? <div className="rc-error">{error}</div> : null}
      {loading ? <div className="rc-card">Loading {config.title.toLowerCase()}...</div> : null}
      <div className="rc-card">
        <div className="rc-table compact lab-table">
          <div className="rc-table-head four" style={{ gridTemplateColumns: tableTemplate }}>
            {config.columns.map(([label]) => <span key={label}>{label}</span>)}
            {hasActions ? <span>Actions</span> : null}
          </div>
          {filteredRows.length ? filteredRows.map((row, index) => (
            <div className="rc-table-row four" style={{ gridTemplateColumns: tableTemplate }} key={readFirst(row, ["id", "Id", "testId", "sampleId"], index)}>
              {config.columns.map(([label, keys]) => {
                const value = readFirst(row, keys);
                const displayValue = /date|created|collected|imported|exported/i.test(label)
                  ? formatDate(value)
                  : /amount|price/i.test(label) && Number(value) > 0
                    ? Number(value).toFixed(2)
                    : value;
                return <span key={label}>{displayValue}</span>;
              })}
              {hasActions ? (
                <span className="lab-row-actions">
                  {type === "samples" ? (
                    <>
                      <button className="lab-action-btn collect" type="button" title="Sample collected" onClick={() => runOrderAction(row, "collected")}><TestTube2 size={15} /></button>
                      <button className="lab-action-btn start" type="button" title="Start processing" onClick={() => runOrderAction(row, "start")}><Play size={15} /></button>
                      <button className="lab-action-btn complete" type="button" title="Complete order" onClick={() => runOrderAction(row, "complete")}><CheckCircle size={15} /></button>
                    </>
                  ) : null}
                  {type === "reports" ? (
                    <>
                      <button className="lab-action-btn report" type="button" title="Print report" onClick={() => printReport(row)}><FileText size={15} /></button>
                      <button className="lab-action-btn download" type="button" title="Download report" onClick={() => downloadReport(row)}><Download size={15} /></button>
                    </>
                  ) : null}
                </span>
              ) : null}
            </div>
          )) : <div className="rc-empty">No {config.title.toLowerCase()} found.</div>}
        </div>
      </div>
    </section>
  );
}

export default LabDataPage;
