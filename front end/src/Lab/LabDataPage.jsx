import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle, Download, FileText, Play, RefreshCw, Search, TestTube2 } from "lucide-react";
import { downloadBlob, firstSuccessfulList, parseList, requestJson } from "./labApi";
import { getLabProfile } from "./labSession";

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
      ["Code", ["patientCode", "PatientCode", "umrNo", "UMRNo", "id", "Id"]],
      ["Phone", ["phone", "Phone", "mobile", "Mobile", "phoneNumber", "patient.phone", "Patient.Phone"]],
      ["Tests", ["__labTestNames", "testName", "TestName", "labTestName", "items", "serviceItems", "billItems"]],
      ["Amount", ["__labAmount", "totalAmount", "grandTotal", "labCharges", "labCharge", "amount"]],
      ["Branch", ["branchName", "BranchName", "branch.name"]],
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
    paths: ["Lab/orders"],
    columns: [
      ["Sample", ["sampleType", "SampleType", "sampleName", "name", "Name"]],
      ["Patient", ["patientName", "PatientName", "patient.name"]],
      ["Collected", ["collectedAt", "CollectedAt", "collectionDate", "createdAt"]],
      ["Status", ["status", "Status", "sampleStatus"]],
    ],
  },
  reports: {
    title: "Reports",
    subtitle: "Lab reports and diagnostic result records.",
    paths: ["Lab/doctor/reports", "Lab/patient/reports"],
    columns: [
      ["Report", ["reportName", "ReportName", "title", "name", "Name"]],
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
  if (source.includes("lab/orders") || source.includes("diagnostic")) return true;
  const typeText = getServiceBillType(record);
  const labAmount = Number(readFirst(record, ["labCharges", "labCharge", "diagnosticRevenue"], 0)) || 0;
  return /diagnostic|diagnosis|lab|test/.test(typeText) || labAmount > 0;
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

function LabDataPage({ type }) {
  const config = pageConfig[type];
  const labProfile = useMemo(() => getLabProfile(), []);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = type === "patients" || type === "reports"
        ? (await Promise.allSettled(config.paths.map((path) => requestJson(path))))
            .flatMap((result, index) =>
              result.status === "fulfilled"
                ? parseList(result.value).map((row) => ({ ...row, __sourcePath: config.paths[index] }))
                : []
            )
        : await firstSuccessfulList(config.paths);
      const nextRows = type === "patients"
        ? data
            .filter(isDiagnosticRecord)
            .filter((row) => belongsToLabScope(row, labProfile))
            .map(enrichLabPatientRow)
        : data;
      setRows(nextRows);
    } catch (loadError) {
      setRows([]);
      setError(loadError.message || `Unable to load ${config.title.toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  }, [config, labProfile, type]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(term));
  }, [rows, search]);

  const hasActions = type === "samples" || type === "reports";
  const tableTemplate = useMemo(() => {
    if (type === "patients") return "1.05fr 0.65fr 0.85fr 1.5fr 0.65fr 0.8fr";
    const actionColumn = hasActions ? " 150px" : "";
    return `repeat(${config.columns.length}, minmax(0, 1fr))${actionColumn}`;
  }, [config.columns.length, hasActions, type]);

  const recordId = (row, index = "") => readFirst(row, ["id", "Id", "orderId", "OrderId", "labOrderId", "LabOrderId", "testId", "TestId"], index);

  const runOrderAction = async (row, action) => {
    const id = recordId(row);
    if (!id) return;
    const actionMap = {
      collected: { path: `Lab/orders/${id}/sample-collected`, method: "PATCH" },
      start: { path: `Lab/orders/${id}/start`, method: "PATCH" },
      complete: { path: `Lab/orders/${id}/complete`, method: "PATCH" },
      report: { path: `Lab/orders/${id}/report`, method: "POST" },
    };
    const target = actionMap[action];
    await requestJson(target.path, { method: target.method, body: JSON.stringify({}) });
    await loadRows();
  };

  const downloadReport = async (row) => {
    const id = recordId(row);
    if (!id) return;
    await downloadBlob(`Lab/orders/${id}/report/download`, `lab-report-${id}`);
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
                      <button type="button" title="Sample collected" onClick={() => runOrderAction(row, "collected")}><TestTube2 size={15} /></button>
                      <button type="button" title="Start processing" onClick={() => runOrderAction(row, "start")}><Play size={15} /></button>
                      <button type="button" title="Complete order" onClick={() => runOrderAction(row, "complete")}><CheckCircle size={15} /></button>
                    </>
                  ) : null}
                  {type === "reports" ? (
                    <>
                      <button type="button" title="Generate report" onClick={() => runOrderAction(row, "report")}><FileText size={15} /></button>
                      <button type="button" title="Download report" onClick={() => downloadReport(row)}><Download size={15} /></button>
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
