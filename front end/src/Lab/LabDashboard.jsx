import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle, ClipboardList, Clock, Eye, FileBarChart2, FlaskConical, TestTube2, X, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { parseList, requestJson } from "./labApi";
import LabToast from "./LabToast";

const readFirst = (record = {}, keys = [], fallback = "") => {
  for (const key of keys) {
    const value = String(key).split(".").reduce((current, part) => (current && typeof current === "object" ? current[part] : undefined), record);
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return fallback;
};

const numberValue = (record, keys) => Number(readFirst(record, keys, 0)) || 0;
const dashboardCardValue = (dashboard = {}, keys = []) => {
  const value = numberValue(dashboard.cards || {}, keys);
  return value || 0;
};
const normalizeText = (value) => String(value ?? "").trim().toLowerCase();
const truthyFlag = (value) =>
  value === true || value === 1 || ["true", "yes", "y", "1"].includes(normalizeText(value));

const orderPatient = (order) => readFirst(order, ["patientName", "PatientName", "patient.name", "Patient.Name", "name", "Name"], "Patient");
const orderTest = (order) => readFirst(order, ["__labTestNames", "testName", "TestName", "labTestName", "test.name", "Test.Name", "category"], "-");
const orderStatus = (order) => {
  const reportStatus = readFirst(order, ["reportStatus", "ReportStatus"], "");
  if (reportStatus) return reportStatus;
  if (truthyFlag(readFirst(order, ["hasReport", "HasReport", "reportGenerated", "ReportGenerated"], ""))) return "Completed";
  const resultStatus = readFirst(order, ["resultStatus", "ResultStatus"], "");
  if (resultStatus) return resultStatus;
  if (readFirst(order, ["completedAt", "CompletedAt"], "")) return "Completed";
  const sampleStatus = readFirst(order, ["sampleStatus", "SampleStatus"], "");
  if (sampleStatus) return sampleStatus;
  const orderStatusValue = readFirst(order, ["orderStatus", "OrderStatus"], "");
  if (orderStatusValue) return orderStatusValue;
  return readFirst(order, ["status", "Status"], "-");
};
const orderPhone = (order) => readFirst(order, ["patientPhone", "PatientPhone", "phone", "Phone", "mobile", "Mobile", "patient.phone", "Patient.Phone"], "");
const orderPatientId = (order) => readFirst(order, ["patientId", "PatientId", "patient.id", "Patient.Id", "patient.patientId", "Patient.PatientId"], "");
const orderDate = (order) => {
  const raw = readFirst(order, ["orderedAt", "OrderedAt", "createdAt", "CreatedAt", "orderDate", "OrderDate", "date", "Date"], "");
  if (!raw) return "-";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? String(raw) : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

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

const getRawOrderDate = (order = {}) =>
  readFirst(order, ["orderedAt", "OrderedAt", "createdAt", "CreatedAt", "orderDate", "OrderDate", "date", "Date"], "");

const isToday = (value) => {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
};

const statusText = (order = {}) => normalizeText(orderStatus(order));
const hasCompletedReport = (order = {}) =>
  truthyFlag(readFirst(order, ["hasReport", "HasReport", "reportGenerated", "ReportGenerated"], "")) ||
  Boolean(readFirst(order, ["reportUrl", "ReportUrl", "reportFileUrl", "ReportFileUrl", "reportPath", "ReportPath", "fileUrl", "FileUrl"], "")) ||
  /reported|delivered|completed/.test(normalizeText(readFirst(order, ["reportStatus", "ReportStatus", "resultStatus", "ResultStatus"], "")));

const computeCardsFromOrders = (orders = []) => ({
  todayOrders: orders.filter((order) => isToday(getRawOrderDate(order))).length,
  pendingOrders: orders.filter((order) => !/complete|completed|done|reported|delivered|cancel|cancelled|canceled/.test(statusText(order))).length,
  sampleCollected: orders.filter((order) => /ordered|pending|sample needed|sample collection needed/.test(statusText(order))).length,
  inProgress: orders.filter((order) => /progress|processing|started/.test(statusText(order)) && !hasCompletedReport(order)).length,
  completedToday: orders.filter((order) => isToday(readFirst(order, ["completedAt", "CompletedAt", "reportedAt", "ReportedAt", "updatedAt", "UpdatedAt"], getRawOrderDate(order))) && (/complete|completed|done|reported|delivered/.test(statusText(order)) || hasCompletedReport(order))).length,
  cancelled: orders.filter((order) => /cancel|cancelled|canceled/.test(statusText(order))).length,
  pendingReports: orders.filter((order) => !hasCompletedReport(order) && !/cancel|cancelled|canceled/.test(statusText(order))).length,
});

const recentOrdersGridTemplate = "1fr 1.8fr 0.7fr 0.8fr 120px";

const getPatientGroupKey = (order = {}) =>
  String(orderPatientId(order) || orderPhone(order) || orderPatient(order)).trim().toLowerCase() || "patient";

const mergePatientOrders = (orders = []) => {
  const grouped = new Map();

  orders.forEach((order) => {
    const key = getPatientGroupKey(order);
    const testRows = order.__testRows || [{ ...order, __singleTestName: orderTest(order) }];
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, { ...order, __testRows: testRows });
      return;
    }

    grouped.set(key, {
      ...existing,
      ...order,
      patientName: orderPatient(existing) || orderPatient(order),
      __testRows: [...existing.__testRows, ...testRows],
    });
  });

  return Array.from(grouped.values()).map((order) => ({
    ...order,
    __labTestNames: Array.from(new Set(order.__testRows.map((item) => orderTest(item)).filter((name) => name && name !== "-"))).join(", ") || "-",
  }));
};

function LabDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState({});
  const [computedCards, setComputedCards] = useState({});
  const [recentOrders, setRecentOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const [data, ordersResult] = await Promise.all([
          requestJson("Lab/dashboard"),
          requestJson("Lab/orders").catch(() => []),
        ]);
        if (!active) return;
        const source = data?.data && !Array.isArray(data.data) ? data.data : data || {};
        const orderRows = parseList(ordersResult).map(enrichLabRow);
        setDashboard(source);
        setComputedCards(computeCardsFromOrders(orderRows));
        setRecentOrders(mergePatientOrders((orderRows.length ? orderRows : parseList(source.recentOrders).map(enrichLabRow))).slice(0, 10));
      } catch (loadError) {
        if (!active) return;
        setDashboard({});
        setRecentOrders([]);
        setToast({ type: "error", message: loadError.message || "Unable to load lab dashboard." });
      } finally {
        if (active) setLoading(false);
      }
    };
    loadDashboard();
    window.addEventListener("receptionDiagnosticBillingCompleted", loadDashboard);
    window.addEventListener("labReportsUpdated", loadDashboard);
    window.addEventListener("focus", loadDashboard);
    return () => {
      active = false;
      window.removeEventListener("receptionDiagnosticBillingCompleted", loadDashboard);
      window.removeEventListener("labReportsUpdated", loadDashboard);
      window.removeEventListener("focus", loadDashboard);
    };
  }, []);

  const cards = [
    { label: "Today's orders", value: computedCards.todayOrders ?? dashboardCardValue(dashboard, ["todayOrders", "todaysOrders", "todayOrderCount", "ordersToday"]), icon: ClipboardList, tone: "blue", to: "/lab/patients?view=today" },
    { label: "Pending orders", value: computedCards.pendingOrders ?? dashboardCardValue(dashboard, ["pendingOrders", "pendingOrderCount"]), icon: Clock, tone: "amber", to: "/lab/patients?view=pending" },
    { label: "Sample collection needed", value: computedCards.sampleCollected ?? dashboardCardValue(dashboard, ["sampleCollected", "sampleCollectedCount", "samplesCollected"]), icon: TestTube2, tone: "blue", to: "/lab/sample-collection?view=samples" },
    { label: "In-progress tests", value: computedCards.inProgress ?? dashboardCardValue(dashboard, ["inProgress", "inProgressTests", "inprogressTests", "processingTests"]), icon: FlaskConical, tone: "amber", to: "/lab/sample-collection?view=in-progress" },
    { label: "Completed today", value: computedCards.completedToday ?? dashboardCardValue(dashboard, ["completedToday", "completedTodayCount", "todayCompleted"]), icon: CheckCircle, tone: "green", to: "/lab/reports?view=completed" },
    { label: "Cancelled tests", value: computedCards.cancelled ?? dashboardCardValue(dashboard, ["cancelled", "cancelledTests", "canceledTests", "cancelledCount"]), icon: XCircle, tone: "red", to: "/lab/patients?view=cancelled" },
    { label: "Pending reports", value: computedCards.pendingReports ?? dashboardCardValue(dashboard, ["pendingReports", "pendingReportCount"]), icon: FileBarChart2, tone: "amber", to: "/lab/reports?view=pending-reports" },
  ];

  const selectedTests = useMemo(() => selectedOrder?.__testRows || [], [selectedOrder]);

  return (
    <section className="rc-page lab-page">
      <LabToast toast={toast} onClose={() => setToast(null)} />
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
          <div className="rc-table-head four" style={{ gridTemplateColumns: recentOrdersGridTemplate }}>
            <span>Patient</span>
            <span>Tests</span>
            <span>Total Tests</span>
            <span>Date</span>
            <span>Action</span>
          </div>
          {recentOrders.length ? recentOrders.map((order, index) => (
            <div className="rc-table-row four" style={{ gridTemplateColumns: recentOrdersGridTemplate }} key={readFirst(order, ["id", "Id", "orderId", "OrderId"], index)}>
              <span>{orderPatient(order)}</span>
              <span>{orderTest(order)}</span>
              <span>{order.__testRows?.length || 0}</span>
              <span>{orderDate(order)}</span>
              <span>
                <button className="lab-text-action" type="button" onClick={() => setSelectedOrder(order)}>
                  <Eye size={15} /> View
                </button>
              </span>
            </div>
          )) : <div className="rc-empty">No recent lab orders found.</div>}
        </div>
      </div>

      {selectedOrder ? (
        <div className="lab-modal-backdrop" role="presentation" onClick={() => setSelectedOrder(null)}>
          <div className="lab-modal-card" role="dialog" aria-modal="true" aria-label="Patient lab tests" onClick={(event) => event.stopPropagation()}>
            <div className="lab-modal-header">
              <div>
                <h3>{orderPatient(selectedOrder)}</h3>
                <p>{selectedTests.length} tests</p>
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="lab-test-status-list">
              {selectedTests.map((test, index) => (
                <div className="lab-test-status-row" key={readFirst(test, ["labOrderId", "LabOrderId", "id", "Id"], index)}>
                  <span>{orderTest(test)}</span>
                  <strong>{orderStatus(test)}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default LabDashboard;
