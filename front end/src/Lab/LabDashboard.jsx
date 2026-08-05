import React, { useEffect, useState } from "react";
import { CheckCircle, ClipboardList, Clock, FileBarChart2, FlaskConical, TestTube2, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { parseList, requestJson } from "./labApi";
import { getLabProfile } from "./labSession";
import {
  dedupeBillingRows,
  readLocalBillingRows,
  RECEPTION_RECENT_SERVICE_BILLS_KEY,
} from "../utils/billingRevenue";

const readFirst = (record = {}, keys = [], fallback = "") => {
  for (const key of keys) {
    const value = String(key).split(".").reduce((current, part) => (current && typeof current === "object" ? current[part] : undefined), record);
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return fallback;
};

const numberValue = (record, keys) => Number(readFirst(record, keys, 0)) || 0;
const normalizeId = (value) => String(value ?? "").trim();
const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const orderPatient = (order) => readFirst(order, ["patientName", "PatientName", "patient.name", "Patient.Name", "name", "Name"], "Patient");
const orderTest = (order) => readFirst(order, ["__labTestNames", "testName", "TestName", "labTestName", "test.name", "Test.Name", "category"], "-");
const orderStatus = (order) => readFirst(order, ["status", "Status", "orderStatus", "sampleStatus", "resultStatus"], "-");
const orderDate = (order) => {
  const raw = readFirst(order, ["createdAt", "CreatedAt", "orderDate", "OrderDate", "date", "Date"], "");
  if (!raw) return "-";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? String(raw) : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

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

const normalizedStatus = (record = {}) =>
  normalizeText(readFirst(record, ["status", "Status", "orderStatus", "sampleStatus", "resultStatus", "reportStatus"], ""));

const isCompleted = (record = {}) => /complete|completed|done|reported|delivered/.test(normalizedStatus(record));
const isCancelled = (record = {}) => /cancel|cancelled|canceled/.test(normalizedStatus(record));
const isDone = (record = {}) => isCompleted(record) || isCancelled(record);
const isInProgress = (record = {}) => /progress|processing|started/.test(normalizedStatus(record));

const getLineItems = (record = {}) => {
  const keys = ["items", "Items", "serviceItems", "ServiceItems", "billItems", "BillItems", "lineItems", "LineItems", "billingItems", "BillingItems", "tests", "Tests"];
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key];
  }
  return [];
};

const getItemTestName = (item = {}) =>
  readFirst(item, ["testName", "TestName", "labTestName", "item", "name", "Name", "serviceName"], "");

const getPatientTestNames = (record = {}) => {
  const direct = readFirst(record, ["testName", "TestName", "labTestName", "LabTestName", "diagnosisTests", "DiagnosisTests"], "");
  const names = [
    ...String(direct || "").split(","),
    ...getLineItems(record).map(getItemTestName),
  ]
    .map((name) => String(name).trim())
    .filter(Boolean);
  return Array.from(new Set(names)).join(", ") || "-";
};

const enrichLabRow = (row = {}) => ({
  ...row,
  __labTestNames: getPatientTestNames(row),
});

const fetchLabBillingRows = async () => {
  const paths = ["Lab/orders", "Billing/diagnostic", "Billing/diagnostics", "Reception/diagnostic-bills", "DiagnosticBilling", "Billing"];
  const results = await Promise.allSettled(paths.map((path) => requestJson(path)));
  return results.flatMap((result, index) =>
    result.status === "fulfilled"
      ? parseList(result.value).map((row) => ({ ...row, __sourcePath: paths[index] }))
      : []
  );
};

function LabDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState({});
  const [recentOrders, setRecentOrders] = useState([]);
  const [labRows, setLabRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      setLoading(true);
      setError("");
      try {
        const [data, billingRows] = await Promise.all([
          requestJson("Lab/dashboard").catch(() => ({})),
          fetchLabBillingRows(),
        ]);
        if (!active) return;
        const source = data?.data && !Array.isArray(data.data) ? data.data : data || {};
        const scopedRows = dedupeBillingRows([
          ...billingRows,
          ...readLocalBillingRows(RECEPTION_RECENT_SERVICE_BILLS_KEY).map((row) => ({
            ...row,
            __sourcePath: "receptionRecentServiceBills",
          })),
        ])
          .filter(isDiagnosticRecord)
          .filter((row) => belongsToLabScope(row));
        setDashboard(source);
        const enrichedRows = scopedRows.map(enrichLabRow);
        setLabRows(enrichedRows);
        setRecentOrders(enrichedRows.slice(0, 10));
      } catch (loadError) {
        if (!active) return;
        setDashboard({});
        setRecentOrders([]);
        setLabRows([]);
        setError(loadError.message || "Unable to load lab dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadDashboard();
    window.addEventListener("receptionDiagnosticBillingCompleted", loadDashboard);
    window.addEventListener("focus", loadDashboard);
    return () => {
      active = false;
      window.removeEventListener("receptionDiagnosticBillingCompleted", loadDashboard);
      window.removeEventListener("focus", loadDashboard);
    };
  }, []);

  const todayOrders = labRows.filter((row) => isToday(getRecordDateValue(row)));
  const pendingOrders = labRows.filter((row) => isPastDate(getRecordDateValue(row)) && !isDone(row));
  const sampleNeeded = labRows.filter((row) => !isDone(row));
  const inProgress = labRows.filter(isInProgress);
  const completedToday = labRows.filter((row) => isToday(getRecordDateValue(row)) && isCompleted(row));
  const cancelled = labRows.filter(isCancelled);
  const pendingReports = labRows.filter((row) => !isCancelled(row) && !/reported|delivered/.test(normalizedStatus(row)));

  const cards = [
    { label: "Today's orders", value: todayOrders.length || numberValue(dashboard, ["todaysOrders", "todayOrders", "todayOrderCount", "ordersToday"]), icon: ClipboardList, tone: "blue", to: "/lab/patients?view=today" },
    { label: "Pending orders", value: pendingOrders.length || numberValue(dashboard, ["pendingOrders", "pendingOrderCount"]), icon: Clock, tone: "amber", to: "/lab/patients?view=pending" },
    { label: "Sample collection needed", value: sampleNeeded.length || numberValue(dashboard, ["sampleCollected", "sampleCollectedCount", "samplesCollected"]), icon: TestTube2, tone: "blue", to: "/lab/sample-collection?view=samples" },
    { label: "In-progress tests", value: inProgress.length || numberValue(dashboard, ["inProgressTests", "inprogressTests", "inProgress", "processingTests"]), icon: FlaskConical, tone: "amber", to: "/lab/sample-collection?view=in-progress" },
    { label: "Completed today", value: completedToday.length || numberValue(dashboard, ["completedToday", "completedTodayCount", "todayCompleted"]), icon: CheckCircle, tone: "green", to: "/lab/reports?view=completed" },
    { label: "Cancelled tests", value: cancelled.length || numberValue(dashboard, ["cancelledTests", "canceledTests", "cancelledCount"]), icon: XCircle, tone: "red", to: "/lab/patients?view=cancelled" },
    { label: "Pending reports", value: pendingReports.length || numberValue(dashboard, ["pendingReports", "pendingReportCount"]), icon: FileBarChart2, tone: "amber", to: "/lab/reports?view=pending-reports" },
  ];

  return (
    <section className="rc-page lab-page">
      {error ? <div className="rc-error">{error}</div> : null}
      {loading ? <div className="rc-card">Loading lab dashboard...</div> : null}

      <div className="rc-stat-grid lab-dashboard-grid">
        {cards.map(({ label, value, icon: Icon, tone, to }) => (
          <article className="rc-stat-card" key={label} role="button" tabIndex={0} onClick={() => navigate(to)} onKeyDown={(event) => event.key === "Enter" && navigate(to)}>
            <div className={`rc-stat-icon ${tone}`}><Icon size={22} /></div>
            <span>Open</span>
            <p>{label}</p>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      <div className="rc-action-grid">
        <button type="button" onClick={() => navigate("/lab/diagnosis-tests")}><FlaskConical size={22} /><span><strong>Diagnosis Tests</strong> Manage lab master tests</span></button>
        <button type="button" onClick={() => navigate("/lab/sample-collection")}><TestTube2 size={22} /><span><strong>Sample Collection</strong> Track order status</span></button>
        <button type="button" onClick={() => navigate("/lab/reports")}><FileBarChart2 size={22} /><span><strong>Reports</strong> Review result reports</span></button>
      </div>

      <div className="rc-card">
        <div className="rc-card-head">
          <div>
            <h3>Recent Lab Orders</h3>
            <p>Latest 10 lab orders</p>
          </div>
        </div>
        <div className="rc-table compact lab-table">
          <div className="rc-table-head four">
            <span>Patient</span>
            <span>Test</span>
            <span>Status</span>
            <span>Date</span>
          </div>
          {recentOrders.length ? recentOrders.map((order, index) => (
            <div className="rc-table-row four" key={readFirst(order, ["id", "Id", "orderId", "OrderId"], index)}>
              <span>{orderPatient(order)}</span>
              <span>{orderTest(order)}</span>
              <span>{orderStatus(order)}</span>
              <span>{orderDate(order)}</span>
            </div>
          )) : <div className="rc-empty">No recent lab orders found.</div>}
        </div>
      </div>
    </section>
  );
}

export default LabDashboard;
