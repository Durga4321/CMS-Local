import React, { useEffect, useState } from "react";
import { CheckCircle, ClipboardList, Clock, FileBarChart2, FlaskConical, TestTube2, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { parseList, requestJson } from "./labApi";

const readFirst = (record = {}, keys = [], fallback = "") => {
  for (const key of keys) {
    const value = String(key).split(".").reduce((current, part) => (current && typeof current === "object" ? current[part] : undefined), record);
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return fallback;
};

const numberValue = (record, keys) => Number(readFirst(record, keys, 0)) || 0;

const getRecentOrders = (data = {}) =>
  parseList(
    data.recentOrders ||
      data.recentLabOrders ||
      data.recent10LabOrders ||
      data.orders ||
      data.labOrders ||
      data.data?.recentOrders ||
      data.data?.recentLabOrders
  ).slice(0, 10);

const orderPatient = (order) => readFirst(order, ["patientName", "PatientName", "patient.name", "Patient.Name", "name", "Name"], "Patient");
const orderTest = (order) => readFirst(order, ["testName", "TestName", "labTestName", "test.name", "Test.Name", "category"], "-");
const orderStatus = (order) => readFirst(order, ["status", "Status", "orderStatus", "sampleStatus", "resultStatus"], "-");
const orderDate = (order) => {
  const raw = readFirst(order, ["createdAt", "CreatedAt", "orderDate", "OrderDate", "date", "Date"], "");
  if (!raw) return "-";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? String(raw) : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

function LabDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState({});
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await requestJson("Lab/dashboard");
        if (!active) return;
        const source = data?.data && !Array.isArray(data.data) ? data.data : data || {};
        setDashboard(source);
        setRecentOrders(getRecentOrders(data));
      } catch (loadError) {
        if (!active) return;
        setDashboard({});
        setRecentOrders([]);
        setError(loadError.message || "Unable to load lab dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  const cards = [
    { label: "Today's orders", value: numberValue(dashboard, ["todaysOrders", "todayOrders", "todayOrderCount", "ordersToday"]), icon: ClipboardList, tone: "blue" },
    { label: "Pending orders", value: numberValue(dashboard, ["pendingOrders", "pendingOrderCount"]), icon: Clock, tone: "amber" },
    { label: "Sample collected", value: numberValue(dashboard, ["sampleCollected", "sampleCollectedCount", "samplesCollected"]), icon: TestTube2, tone: "blue" },
    { label: "In-progress tests", value: numberValue(dashboard, ["inProgressTests", "inprogressTests", "inProgress", "processingTests"]), icon: FlaskConical, tone: "amber" },
    { label: "Completed today", value: numberValue(dashboard, ["completedToday", "completedTodayCount", "todayCompleted"]), icon: CheckCircle, tone: "green" },
    { label: "Cancelled tests", value: numberValue(dashboard, ["cancelledTests", "canceledTests", "cancelledCount"]), icon: XCircle, tone: "red" },
    { label: "Pending reports", value: numberValue(dashboard, ["pendingReports", "pendingReportCount"]), icon: FileBarChart2, tone: "amber" },
  ];

  return (
    <section className="rc-page lab-page">
      {error ? <div className="rc-error">{error}</div> : null}
      {loading ? <div className="rc-card">Loading lab dashboard...</div> : null}

      <div className="rc-stat-grid lab-dashboard-grid">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <article className="rc-stat-card" key={label}>
            <div className={`rc-stat-icon ${tone}`}><Icon size={22} /></div>
            <span>Dashboard</span>
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
