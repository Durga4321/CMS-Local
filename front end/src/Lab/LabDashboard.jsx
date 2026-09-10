import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  ChevronRight,
  ClipboardList,
  Clock,
  Eye,
  FileBarChart2,
  FlaskConical,
  TestTube2,
  X,
  XCircle,
} from "lucide-react";
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

const recentOrdersGridTemplate = "minmax(170px, 1.3fr) minmax(220px, 2fr) 110px 130px 110px";

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
    {
      label: "Today's orders",
      value: computedCards.todayOrders ?? dashboardCardValue(dashboard, ["todayOrders", "todaysOrders", "todayOrderCount", "ordersToday"]),
      icon: ClipboardList,
      theme: "card-blue-theme",
      boxClass: "box-blue",
      period: "Today",
      trendText: "● Daily Orders",
      trendClass: "trend-neutral",
      to: "/lab/patients?view=today",
    },
    {
      label: "Pending orders",
      value: computedCards.pendingOrders ?? dashboardCardValue(dashboard, ["pendingOrders", "pendingOrderCount"]),
      icon: Clock,
      theme: "card-orange-theme",
      boxClass: "box-orange",
      period: "Pending",
      trendText: "● Awaiting Action",
      trendClass: "trend-down",
      to: "/lab/patients?view=pending",
    },
    {
      label: "Sample collection needed",
      value: computedCards.sampleCollected ?? dashboardCardValue(dashboard, ["sampleCollected", "sampleCollectedCount", "samplesCollected"]),
      icon: TestTube2,
      theme: "card-purple-theme",
      boxClass: "box-purple",
      period: "Samples",
      trendText: "● Collection Required",
      trendClass: "trend-neutral",
      to: "/lab/sample-collection?view=samples",
    },
    {
      label: "In-progress tests",
      value: computedCards.inProgress ?? dashboardCardValue(dashboard, ["inProgress", "inProgressTests", "inprogressTests", "processingTests"]),
      icon: FlaskConical,
      theme: "card-teal-theme",
      boxClass: "box-teal",
      period: "Active",
      trendText: "● Under Analysis",
      trendClass: "trend-neutral",
      to: "/lab/sample-collection?view=in-progress",
    },
    {
      label: "Completed today",
      value: computedCards.completedToday ?? dashboardCardValue(dashboard, ["completedToday", "completedTodayCount", "todayCompleted"]),
      icon: CheckCircle,
      theme: "card-green-theme",
      boxClass: "box-green",
      period: "Done",
      trendText: "✓ Completed Today",
      trendClass: "trend-up",
      to: "/lab/reports?view=completed",
    },
    {
      label: "Cancelled tests",
      value: computedCards.cancelled ?? dashboardCardValue(dashboard, ["cancelled", "cancelledTests", "canceledTests", "cancelledCount"]),
      icon: XCircle,
      theme: "card-rose-theme",
      boxClass: "box-rose",
      period: "Voided",
      trendText: "● Cancelled Tests",
      trendClass: "trend-down",
      to: "/lab/patients?view=cancelled",
    },
    {
      label: "Pending reports",
      value: computedCards.pendingReports ?? dashboardCardValue(dashboard, ["pendingReports", "pendingReportCount"]),
      icon: FileBarChart2,
      theme: "card-amber-theme",
      boxClass: "box-amber",
      period: "Reports",
      trendText: "● Sign-off Needed",
      trendClass: "trend-neutral",
      to: "/lab/reports?view=pending-reports",
    },
  ];

  const selectedTests = useMemo(() => selectedOrder?.__testRows || [], [selectedOrder]);

  return (
    <section className="rc-page lab-page rc-dashboard-page">
      {/* 3D Lab Theme Animated Background Overlays */}
      <div className="db-3d-bg-overlay" />
      <div className="db-3d-floating-particle p1" />
      <div className="db-3d-floating-particle p2" />
      <div className="db-3d-floating-particle p3" />
      <div className="db-3d-ecg-wave">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="db-ecg-svg">
          <path
            d="M0 60 L300 60 L310 40 L320 80 L330 20 L345 100 L355 60 L370 60 L400 60 L700 60 L710 35 L720 85 L730 15 L745 105 L755 60 L770 60 L1200 60"
            fill="none"
            stroke="rgba(14, 165, 233, 0.22)"
            strokeWidth="2.5"
            strokeDasharray="1200"
            strokeDashoffset="1200"
            className="ecg-path"
          />
        </svg>
      </div>

      <LabToast toast={toast} onClose={() => setToast(null)} />
      {loading ? <div className="rc-card">Loading lab dashboard...</div> : null}

      {/* RADIANT MULTI-COLORED KPI STAT CARDS */}
      <div className="rc-dash-kpi-grid lab-dashboard-grid">
        {cards.map(({ label, value, icon: Icon, theme, boxClass, period, trendText, trendClass, to }) => (
          <div
            className={`rc-dash-kpi-card ${theme}`}
            key={label}
            role="button"
            tabIndex={0}
            onClick={() => navigate(to)}
            onKeyDown={(event) => event.key === "Enter" && navigate(to)}
            title={`Open ${label}`}
          >
            <div className="db-kpi-content-wrap">
              <div className="db-kpi-header">
                <div className={`db-kpi-icon-box ${boxClass}`}>
                  <Icon size={18} />
                </div>
                <span className="db-kpi-title">{label}</span>
                <span className="rc-stat-period-pill">{period}</span>
              </div>
              <div className="db-kpi-num">{value}</div>
              <div className={`db-kpi-trend ${trendClass}`}>
                <span>{trendText}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* QUICK LAB ACTION TILES */}
      <div className="rc-dash-action-grid lab-dash-action-grid">
        <button
          type="button"
          className="rc-dash-action-tile qa-diagnostic-billing"
          onClick={() => navigate("/lab/diagnosis-tests")}
        >
          <div className="rc-dash-action-icon-wrap icon-purple">
            <FlaskConical size={22} />
          </div>
          <div className="rc-dash-action-content">
            <div className="rc-dash-action-top-row">
              <span className="rc-dash-action-tag tag-purple">Master Tests</span>
              <span className="rc-dash-action-title">Diagnosis Tests</span>
            </div>
            <p className="rc-dash-action-desc">Manage lab test catalog, master parameters, and pricing</p>
          </div>
          <div className="rc-dash-action-chevron">
            <ChevronRight size={18} />
          </div>
        </button>

        <button
          type="button"
          className="rc-dash-action-tile qa-op-billing"
          onClick={() => navigate("/lab/sample-collection")}
        >
          <div className="rc-dash-action-icon-wrap icon-cyan">
            <TestTube2 size={22} />
          </div>
          <div className="rc-dash-action-content">
            <div className="rc-dash-action-top-row">
              <span className="rc-dash-action-tag tag-cyan">Specimens</span>
              <span className="rc-dash-action-title">Sample Collection</span>
            </div>
            <p className="rc-dash-action-desc">Track tube barcoding, specimen drawing, and order status</p>
          </div>
          <div className="rc-dash-action-chevron">
            <ChevronRight size={18} />
          </div>
        </button>

        <button
          type="button"
          className="rc-dash-action-tile qa-pharmacy-billing"
          onClick={() => navigate("/lab/reports")}
        >
          <div className="rc-dash-action-icon-wrap icon-emerald">
            <FileBarChart2 size={22} />
          </div>
          <div className="rc-dash-action-content">
            <div className="rc-dash-action-top-row">
              <span className="rc-dash-action-tag tag-emerald">Diagnostics</span>
              <span className="rc-dash-action-title">Lab Reports</span>
            </div>
            <p className="rc-dash-action-desc">Review test results, authorize reports, and download</p>
          </div>
          <div className="rc-dash-action-chevron">
            <ChevronRight size={18} />
          </div>
        </button>
      </div>

      {/* RECENT LAB ORDERS TABLE CARD WITH CAPSULE HEADINGS */}
      <div className="rc-card rc-dash-table-card lab-dash-table-card">
        <div className="rc-dash-table-head">
          <div className="rc-dash-table-head-left">
            <div className="rc-dash-panel-icon">
              <FlaskConical size={18} />
            </div>
            <div>
              <h3>Recent Lab Orders</h3>
              <div className="rc-dash-meta-badges">
                <span className="rc-dash-count-pill">
                  {recentOrders.length} {recentOrders.length === 1 ? "Order" : "Orders"}
                </span>
                <span className="rc-dash-date-pill">
                  Latest 10 entries
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="rc-dash-manage-btn"
            onClick={() => navigate("/lab/patients")}
          >
            <span>View All Patients</span>
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="rc-table compact lab-table">
          <div className="lab-table-head" style={{ gridTemplateColumns: recentOrdersGridTemplate }}>
            <span className="col-left text-left">
              <span className="rc-th-capsule rc-th-name">Patient</span>
            </span>
            <span className="col-left text-left">
              <span className="rc-th-capsule rc-th-tests">Tests</span>
            </span>
            <span className="col-center text-center">
              <span className="rc-th-capsule rc-th-total">Total Tests</span>
            </span>
            <span className="col-left text-left">
              <span className="rc-th-capsule rc-th-pid">Date</span>
            </span>
            <span className="col-center text-center lab-head-actions">
              <span className="rc-th-capsule rc-th-actions">Action</span>
            </span>
          </div>
          {recentOrders.length ? (
            recentOrders.map((order, index) => {
              const pName = orderPatient(order);
              const pInitials = pName
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0].toUpperCase())
                .join("") || "PT";
              const avatarGradients = [
                "linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)",
                "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                "linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)",
                "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)",
                "linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)",
                "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
              ];
              const avatarBg = avatarGradients[index % avatarGradients.length];

              return (
                <div
                  className="lab-table-row"
                  style={{ gridTemplateColumns: recentOrdersGridTemplate }}
                  key={readFirst(order, ["id", "Id", "orderId", "OrderId"], index)}
                >
                  <span className="col-left text-left lab-patient-cell">
                    <div className="rc-dash-patient-avatar" style={{ background: avatarBg }}>{pInitials}</div>
                    <strong className="lab-patient-name">{pName}</strong>
                  </span>
                  <span className="col-left text-left lab-test-names-cell" title={orderTest(order)}>
                    {orderTest(order)}
                  </span>
                  <span className="col-center text-center">
                    <span className="lab-total-badge">{order.__testRows?.length || 0}</span>
                  </span>
                  <span className="col-left text-left lab-date-cell">
                    <span className="rc-lab-date-pill">{orderDate(order)}</span>
                  </span>
                  <span className="col-center text-center">
                    <button
                      className="lab-text-action"
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      title="View order tests"
                    >
                      <Eye size={15} /> View
                    </button>
                  </span>
                </div>
              );
            })
          ) : (
            <div className="rc-empty">No recent lab orders found.</div>
          )}
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
