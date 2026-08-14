import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle, Download, FileText, Play, RefreshCw, Search, TestTube2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { downloadBlob, parseList, requestJson } from "./labApi";
import { getLabProfile } from "./labSession";
import { getClinicDisplayName } from "../utils/clinicDisplay";
import { getClinicInvoiceBranding } from "../utils/clinicBranding";
import { downloadLabReportHtml, getReportName, printLabReport } from "./labReportTemplate";
import { fetchLabMasterTests } from "../utils/labMaster";
import { canUseModulePermission, useRolePermissionsSync } from "../utils/rolePermissions";
import LabToast from "./LabToast";

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
    subtitle: "Patients with diagnostic orders for your clinic and branch.",
    paths: ["Lab/orders"],
    columns: [
      ["Patient", ["patientName", "PatientName", "name", "Name", "fullName"]],
      ["Visit Date", ["orderedAt", "OrderedAt", "visitDate", "VisitDate", "appointmentDate", "AppointmentDate", "invoiceDate", "InvoiceDate", "billDate", "BillDate", "createdAt", "CreatedAt", "date", "Date"]],
      ["Phone", ["patientPhone", "PatientPhone", "phone", "Phone", "mobile", "Mobile", "phoneNumber", "patient.phone", "Patient.Phone"]],
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
    paths: ["Lab/orders"],
    columns: [
      ["Patient", ["patientName", "PatientName", "patient.name"]],
      ["Visit Date", ["orderedAt", "OrderedAt", "visitDate", "VisitDate", "appointmentDate", "AppointmentDate", "invoiceDate", "InvoiceDate", "billDate", "BillDate", "createdAt", "CreatedAt", "date", "Date"]],
      ["Phone", ["patientPhone", "PatientPhone", "phone", "Phone", "mobile", "Mobile", "phoneNumber", "patient.phone", "Patient.Phone"]],
      ["Tests", ["__labTestNames", "testName", "TestName", "labTestName", "items", "serviceItems", "billItems"]],
      ["Status", ["__displayStatus", "resultStatus", "ResultStatus", "sampleStatus", "SampleStatus", "orderStatus", "OrderStatus", "status", "Status"]],
    ],
  },
  reports: {
    title: "Reports",
    subtitle: "Lab reports and diagnostic result records.",
    paths: ["Lab/orders"],
    columns: [
      ["Report", ["reportName", "ReportName", "reportTitle", "title", "__labTestNames", "testName", "TestName"]],
      ["Patient", ["patientName", "PatientName", "patient.name"]],
      ["Date", ["reportedAt", "ReportedAt", "reportDate", "ReportDate", "completedAt", "CompletedAt", "updatedAt", "UpdatedAt", "createdAt", "CreatedAt", "date"]],
      ["Status", ["reportStatus", "ReportStatus", "status", "Status"]],
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

const getPatientGroupKey = (record = {}) => {
  const appointmentId = normalizeId(readFirst(record, [
    "appointmentId", "AppointmentId", "appointment.id", "appointment.appointmentId", "Appointment.Id", "Appointment.AppointmentId",
  ], ""));
  if (appointmentId) return `appointment:${appointmentId}`;

  const patientId = normalizeId(readFirst(record, [
    "patientId", "PatientId", "patient.id", "patient.patientId", "Patient.Id", "Patient.PatientId",
  ], ""));
  const patientName = normalizeText(readFirst(record, ["patientName", "PatientName", "patient.name", "Patient.Name", "name", "Name"], ""));
  const visitDate = normalizeText(getRecordDateValue(record));
  return `patient:${patientId || patientName}:${visitDate}`;
};

const mergeTextValues = (...values) =>
  values.map((value) => String(value ?? "").trim()).find((value) => value && value !== "-") || "-";

const mergeLabPatientRows = (rows = []) => {
  const grouped = new Map();

  rows.forEach((row) => {
    const key = getPatientGroupKey(row);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, row);
      return;
    }

    const testNames = [
      ...String(existing.__labTestNames || "").split(","),
      ...String(row.__labTestNames || "").split(","),
    ]
      .map((name) => name.trim())
      .filter((name) => name && name !== "-");

    grouped.set(key, {
      ...existing,
      ...row,
      patientName: mergeTextValues(existing.patientName, existing.PatientName, row.patientName, row.PatientName),
      PatientName: mergeTextValues(existing.PatientName, existing.patientName, row.PatientName, row.patientName),
      phone: mergeTextValues(existing.patientPhone, existing.PatientPhone, existing.phone, existing.Phone, row.patientPhone, row.PatientPhone, row.phone, row.Phone),
      Phone: mergeTextValues(existing.PatientPhone, existing.patientPhone, existing.Phone, existing.phone, row.PatientPhone, row.patientPhone, row.Phone, row.phone),
      patientPhone: mergeTextValues(existing.patientPhone, existing.PatientPhone, existing.phone, existing.Phone, row.patientPhone, row.PatientPhone, row.phone, row.Phone),
      PatientPhone: mergeTextValues(existing.PatientPhone, existing.patientPhone, existing.Phone, existing.phone, row.PatientPhone, row.patientPhone, row.Phone, row.phone),
      visitDate: mergeTextValues(existing.orderedAt, existing.OrderedAt, existing.visitDate, existing.VisitDate, row.orderedAt, row.OrderedAt, row.visitDate, row.VisitDate, getRecordDateValue(existing), getRecordDateValue(row)),
      VisitDate: mergeTextValues(existing.OrderedAt, existing.orderedAt, existing.VisitDate, existing.visitDate, row.OrderedAt, row.orderedAt, row.VisitDate, row.visitDate, getRecordDateValue(existing), getRecordDateValue(row)),
      orderedAt: mergeTextValues(existing.orderedAt, existing.OrderedAt, row.orderedAt, row.OrderedAt, getRecordDateValue(existing), getRecordDateValue(row)),
      OrderedAt: mergeTextValues(existing.OrderedAt, existing.orderedAt, row.OrderedAt, row.orderedAt, getRecordDateValue(existing), getRecordDateValue(row)),
      __labTestNames: Array.from(new Set(testNames)).join(", ") || "-",
      __labAmount: (Number(existing.__labAmount) || 0) + (Number(row.__labAmount) || 0),
      __groupedRows: [...(existing.__groupedRows || [existing]), row],
    });
  });

  return Array.from(grouped.values());
};

const enrichLabPatientRow = (record = {}) => ({
  ...record,
  __labTestNames: getPatientTestNames(record),
  __labAmount: getPatientLabAmount(record),
  __displayStatus: getSampleDisplayStatus(record),
});

const getRecordDateValue = (record = {}) =>
  readFirst(record, ["orderedAt", "OrderedAt", "visitDate", "VisitDate", "appointmentDate", "AppointmentDate", "invoiceDate", "InvoiceDate", "billDate", "BillDate", "createdAt", "CreatedAt", "date", "Date"], "");

const isToday = (value) => {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
};

const getNormalizedStatus = (record = {}) =>
  normalizeText(readFirst(record, ["reportStatus", "ReportStatus", "resultStatus", "ResultStatus", "sampleStatus", "SampleStatus", "orderStatus", "OrderStatus", "status", "Status"], ""));

const getSampleDisplayStatus = (record = {}) => {
  const reportStatus = readFirst(record, ["reportStatus", "ReportStatus"], "");
  if (reportStatus && reportStatus !== "-") return reportStatus;
  if (isTruthyFlag(readFirst(record, ["hasReport", "HasReport", "reportGenerated", "ReportGenerated"], ""))) return "Completed";
  const resultStatus = readFirst(record, ["resultStatus", "ResultStatus"], "");
  if (resultStatus && resultStatus !== "-") return resultStatus;
  if (readFirst(record, ["completedAt", "CompletedAt"], "")) return "Completed";
  const sampleStatus = readFirst(record, ["sampleStatus", "SampleStatus"], "");
  if (sampleStatus && sampleStatus !== "-") return sampleStatus;
  const orderStatus = readFirst(record, ["orderStatus", "OrderStatus"], "");
  if (orderStatus && orderStatus !== "-") return orderStatus;
  return readFirst(record, ["status", "Status"], "-");
};

const isDoneRecord = (record = {}) => {
  const status = getNormalizedStatus(record);
  return /complete|completed|done|reported|delivered|cancel|cancelled|canceled/.test(status);
};

const isCurrentLabWork = (record = {}) => {
  const dateValue = getRecordDateValue(record);
  return isToday(dateValue) || (!dateValue && !isDoneRecord(record));
};

const isBillingBackedRecord = (record = {}) => {
  const source = normalizeText(record.__sourcePath);
  return source.includes("billing") || source.includes("diagnosticbilling");
};

const recordIdentifier = (row = {}) =>
  String(readFirst(row, ["id", "Id", "orderId", "OrderId", "labOrderId", "LabOrderId", "billingId", "BillingId", "billId", "BillId", "invoiceId", "InvoiceId", "testId", "TestId"], "") || "");

const filterRowsByView = (rows = [], view = "") => {
  if (view === "today") return rows.filter(isCurrentLabWork);
  if (view === "past") return rows.filter((row) => !isToday(getRecordDateValue(row)));
  if (view === "pending") return rows.filter((row) => !isDoneRecord(row));
  if (view === "samples") return rows.filter((row) => !/complete|completed|reported|delivered|cancel|cancelled|canceled/.test(getNormalizedStatus(row)));
  if (view === "in-progress") return rows.filter((row) => /progress|processing|started/.test(getNormalizedStatus(row)));
  if (view === "completed") return rows.filter((row) => isToday(getRecordDateValue(row)) && /complete|completed|done|reported|delivered/.test(getNormalizedStatus(row)));
  if (view === "cancelled") return rows.filter((row) => /cancel|cancelled|canceled/.test(getNormalizedStatus(row)));
  if (view === "pending-reports") return rows.filter((row) => !/reported|delivered/.test(getNormalizedStatus(row)) && !/cancel|cancelled|canceled/.test(getNormalizedStatus(row)));
  return rows;
};

const isTruthyFlag = (value) =>
  value === true || value === 1 || ["true", "yes", "y", "1"].includes(normalizeText(value));

const isGeneratedReport = (row = {}) => {
  const reportStatus = normalizeText(readFirst(row, ["reportStatus", "ReportStatus", "resultStatus", "ResultStatus"], ""));
  return (
    /reported|delivered|completed/.test(reportStatus) ||
    isTruthyFlag(readFirst(row, ["hasReport", "HasReport", "reportGenerated", "ReportGenerated"], "")) ||
    Boolean(readFirst(row, [
      "reportName", "ReportName", "reportTitle", "reportUrl", "ReportUrl", "reportFileUrl", "ReportFileUrl",
      "reportPath", "ReportPath", "fileUrl", "FileUrl", "findings", "Findings", "reportFindings", "ReportFindings",
    ], ""))
  );
};

const getReportDisplayStatus = (row = {}) => {
  const reportStatus = readFirst(row, ["reportStatus", "ReportStatus", "resultStatus", "ResultStatus"], "");
  if (reportStatus && reportStatus !== "-") return reportStatus;
  if (isTruthyFlag(readFirst(row, ["hasReport", "HasReport", "reportGenerated", "ReportGenerated"], ""))) return "Completed";
  if (readFirst(row, ["reportUrl", "ReportUrl", "reportFileUrl", "ReportFileUrl", "reportPath", "ReportPath", "fileUrl", "FileUrl"], "")) return "Completed";
  return readFirst(row, ["status", "Status"], "-");
};

const getReportDisplayDate = (row = {}) =>
  readFirst(row, [
    "reportedAt", "ReportedAt", "reportDate", "ReportDate", "reportCreatedAt", "ReportCreatedAt",
    "report.createdAt", "Report.CreatedAt", "resultCreatedAt", "ResultCreatedAt",
    "completedAt", "CompletedAt", "updatedAt", "UpdatedAt", "createdAt", "CreatedAt", "date", "Date",
  ], "");

function LabDataPage({ type }) {
  const config = pageConfig[type];
  const location = useLocation();
  const navigate = useNavigate();
  const view = new URLSearchParams(location.search).get("view") || "";
  const labProfile = useMemo(() => getLabProfile(), []);
  useRolePermissionsSync(labProfile);
  const canEditSamples = canUseModulePermission(labProfile, "Sample Collection", "Edit");
  const clinicName = getClinicDisplayName(labProfile, "Clinic");
  const clinicBranding = getClinicInvoiceBranding({ clinicId: labProfile.hospitalId, clinicName });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const backendData = type === "tests"
        ? await fetchLabMasterTests()
        : type === "patients" || type === "samples" || type === "reports"
        ? parseList(await requestJson(config.paths[0])).map((row) => ({ ...row, __sourcePath: config.paths[0] }))
        : parseList(await requestJson(config.paths[0]));
      const enrichedRows = type === "patients" || type === "samples" || type === "reports"
        ? backendData
            .filter(isDiagnosticRecord)
            .filter((row) => belongsToLabScope(row, labProfile))
            .map(enrichLabPatientRow)
        : backendData;
      const nextRows = type === "patients"
        ? filterRowsByView(mergeLabPatientRows(enrichedRows), view)
        : type === "samples" || type === "reports"
        ? filterRowsByView(enrichedRows, view)
            .filter((row) => type !== "reports" || isGeneratedReport(row))
        : backendData;
      setRows(nextRows);
    } catch (loadError) {
      setRows([]);
      setToast({ type: "error", message: loadError.message || `Unable to load ${config.title.toLowerCase()}.` });
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

  const setPatientView = (nextView) => {
    const params = new URLSearchParams(location.search);
    if (nextView) params.set("view", nextView);
    else params.delete("view");
    navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : "" });
  };

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
      labPath: (id) => `Lab/orders/${id}/result`,
      method: "PUT",
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
    if (!canEditSamples) {
      setToast({ type: "error", message: "You do not have permission to update sample collection." });
      return;
    }
    const id = recordId(row);
    if (!id) return;
    const target = actionConfig[action];
    if (!target) return;

    try {
      await requestJson(`Lab/orders/${id}`).catch(() => null);

      const patch = {
        ...target.payload,
        Status: target.status,
        updatedAt: new Date().toISOString(),
      };

      await requestJson(target.labPath(id), { method: target.method, body: JSON.stringify(patch) });

      await loadRows();
      setToast({ type: "success", message: `${target.status} updated successfully.` });
    } catch (actionError) {
      setToast({ type: "error", message: actionError.message || "Unable to update lab order." });
    }
  };

  const downloadReport = async (row) => {
    if (isBillingBackedRecord(row)) {
      downloadLabReportHtml({ record: { ...row, reportName: getReportName(row) }, branding: clinicBranding, clinicName, profile: labProfile });
      setToast({ type: "success", message: "Report downloaded." });
      return;
    }

    const id = recordId(row);
    try {
      if (id) {
        await downloadBlob(`Lab/orders/${id}/report/download`, `lab-report-${id}`);
        setToast({ type: "success", message: "Report downloaded." });
        return;
      }
    } catch (downloadError) {
      setToast({ type: "error", message: downloadError.message || "Unable to download report from backend." });
      return;
    }
    downloadLabReportHtml({ record: { ...row, reportName: getReportName(row) }, branding: clinicBranding, clinicName, profile: labProfile });
    setToast({ type: "success", message: "Report downloaded." });
  };

  const printReport = (row) => {
    printLabReport({ record: { ...row, reportName: getReportName(row) }, branding: clinicBranding, clinicName, profile: labProfile });
    setToast({ type: "success", message: "Report print opened." });
  };

  return (
    <section className="rc-page lab-page">
      <LabToast toast={toast} onClose={() => setToast(null)} />
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
      {type === "patients" ? (
        <div className="lab-filter-tabs" role="tablist" aria-label="Patient order date filter">
          {[
            ["", "All"],
            ["today", "Today"],
            ["past", "Past"],
          ].map(([key, label]) => (
            <button
              key={label}
              className={view === key ? "active" : ""}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setPatientView(key)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
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
                const value = type === "reports" && label === "Status"
                  ? getReportDisplayStatus(row)
                  : type === "reports" && label === "Date"
                    ? getReportDisplayDate(row)
                    : readFirst(row, keys);
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
                      <button className="lab-action-btn collect" type="button" title="Sample collected" onClick={() => runOrderAction(row, "collected")} disabled={!canEditSamples}><TestTube2 size={15} /></button>
                      <button className="lab-action-btn start" type="button" title="Start processing" onClick={() => runOrderAction(row, "start")} disabled={!canEditSamples}><Play size={15} /></button>
                      <button className="lab-action-btn complete" type="button" title="Complete order" onClick={() => runOrderAction(row, "complete")} disabled={!canEditSamples}><CheckCircle size={15} /></button>
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
