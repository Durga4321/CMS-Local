import React, { useEffect, useMemo, useState } from "react";
import { Download, IndianRupee, RefreshCw, Users } from "lucide-react";
import Header from "../../../components/superadmin/Header";
import DataTable from "../../../components/superadmin/DataTable";
import SearchFilter from "../../../components/superadmin/SearchFilter";
import { useToast } from "../../../components/ToastProvider";
import { formatIndianCurrency } from "../../../utils/format";
import { fetchAllSubscriptions } from "../../../utils/subscriptionFlow";

const currency = (value) => value == null ? "-" : formatIndianCurrency(value);
const fields = [
  { key: "adminName", label: "Admin", width: "170px" },
  { key: "adminEmail", label: "Email", width: "240px" },
  { key: "phone", label: "Phone", width: "140px" },
  { key: "address", label: "Address", width: "220px" },
  { key: "clinicName", label: "Clinic", width: "170px" },
  { key: "hospitalId", label: "Clinic ID", width: "100px" },
  { key: "planName", label: "Plan", width: "230px" },
  { key: "subscriptionPlanId", label: "Plan ID", width: "100px" },
  { key: "subscriptionType", label: "Subscription Type", width: "150px" },
  { key: "billingCycle", label: "Billing Cycle", width: "120px" },
  { key: "durationMonths", label: "Months", width: "90px" },
  { key: "amount", label: "Plan Amount", width: "130px", render: (row) => currency(row.amount) },
  { key: "paidAmount", label: "Paid Amount", width: "130px", render: (row) => currency(row.paidAmount) },
  { key: "paymentStatus", label: "Payment Status", width: "160px" },
  { key: "paymentMethod", label: "Payment Option", width: "140px" },
  { key: "source", label: "Source", width: "120px" },
  { key: "paymentReference", label: "Payment Reference", width: "180px" },
  { key: "lastPaymentDate", label: "Payment Date", width: "130px" },
  { key: "startDate", label: "Start Date", width: "130px" },
  { key: "renewalDate", label: "Renewal Date", width: "130px" },
  { key: "status", label: "Status", width: "110px" },
];
const escapeHtml = (value) => String(value ?? "-").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export default function Reports() {
  const toast = useToast();
  const [subscriptions, setSubscriptions] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    fetchAllSubscriptions().then((rows) => {
      if (!active) return;
      setSubscriptions(rows);
      if (refresh) toast.success("Subscription reports refreshed.");
    }).catch((failure) => {
      if (!active) return;
      setSubscriptions([]);
      const message = failure.message || "Unable to load subscription reports.";
      setError(message); toast.error(message);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh, toast]);
  const rows = useMemo(() => subscriptions.filter((row) =>
    (status === "All" || row.status === status) &&
    fields.some((field) => String(row[field.key] ?? "").toLowerCase().includes(search.trim().toLowerCase()))
  ), [subscriptions, search, status]);
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const totalPaid = rows.reduce((sum, row) => sum + Number(row.paidAmount || 0), 0);
  const activeCount = rows.filter((row) => String(row.status).toLowerCase() === "active").length;
  const adminCount = new Set(rows.map((row) => row.adminId || row.adminEmail).filter(Boolean)).size;
  const reportHtml = () => {
    const headings = fields.map((field) => "<th>" + escapeHtml(field.label) + "</th>").join("");
    const body = rows.map((row) => "<tr>" + fields.map((field) => "<td>" + escapeHtml(field.render ? field.render(row) : row[field.key]) + "</td>").join("") + "</tr>").join("");
    return '<!doctype html><html><head><title>Subscription Reports</title><style>body{font-family:Arial,sans-serif;color:#111;padding:16px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px;text-align:left;font-size:10px}@page{size:landscape}</style></head><body><h1>Subscription Reports</h1><table><thead><tr>' + headings + '</tr></thead><tbody>' + body + '</tbody></table></body></html>';
  };
  const exportExcel = () => {
    try {
      const url = URL.createObjectURL(new Blob([reportHtml()], { type: "application/vnd.ms-excel;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = "subscription-reports.xls"; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Subscription report exported.");
    } catch (failure) { toast.error(failure.message || "Unable to export report."); }
  };
  const exportPdf = () => {
    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) { toast.error("Allow pop-ups to print the report."); return; }
    try {
      printWindow.document.write(reportHtml()); printWindow.document.close(); printWindow.focus(); printWindow.print();
      toast.success("Report opened for printing.");
    } catch (failure) { printWindow.close(); toast.error(failure.message || "Unable to print report."); }
  };
  return <>
    <Header title="Subscription Reports" action={<>
      <button type="button" className="sa-btn" title="Refresh reports" aria-label="Refresh reports" disabled={loading} onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} /></button>
      <button type="button" className="sa-btn" disabled={loading || !rows.length} onClick={exportExcel}><Download size={16} />Export Excel</button>
      <button type="button" className="sa-btn sa-btn-primary" disabled={loading || !rows.length} onClick={exportPdf}><Download size={16} />Export PDF</button>
    </>} />
    <div className="sa-subscription-kpis">
      <div className="sa-subscription-kpi is-green"><IndianRupee size={20} /><div><b>{formatIndianCurrency(totalAmount)}</b><span>Subscription value</span></div></div>
      <div className="sa-subscription-kpi is-green"><IndianRupee size={20} /><div><b>{formatIndianCurrency(totalPaid)}</b><span>Recorded payments</span></div></div>
      <div className="sa-subscription-kpi is-blue"><RefreshCw size={20} /><div><b>{activeCount}</b><span>Active subscriptions</span></div></div>
      <div className="sa-subscription-kpi is-amber"><Users size={20} /><div><b>{adminCount}</b><span>Customer admins</span></div></div>
    </div>
    <section className="sa-subscription-table-section">
      <SearchFilter value={search} onChange={setSearch} placeholder="Search subscriptions..." filters={["All", ...new Set(subscriptions.map((row) => row.status).filter(Boolean))]} selectedFilter={status} onFilterChange={setStatus} />
      {error && <div className="sa-state sa-state--error" role="alert">{error}</div>}
      <div style={{ overflowX: "auto" }}><div style={{ minWidth: fields.reduce((sum, field) => sum + parseInt(field.width, 10) + 8, 40) }}><DataTable columns={fields} rows={rows} loading={loading} emptyMessage="No subscription report records found." preserveColumnFractions /></div></div>
    </section>
  </>;
}
