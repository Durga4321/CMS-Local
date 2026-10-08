import React, { useEffect, useMemo, useState } from "react";
import { Building2, IndianRupee, RefreshCw, ShieldCheck } from "lucide-react";
import Header from "../../../components/superadmin/Header";
import DataTable from "../../../components/superadmin/DataTable";
import SearchFilter from "../../../components/superadmin/SearchFilter";
import { useToast } from "../../../components/ToastProvider";
import { formatIndianCurrency } from "../../../utils/format";
import { fetchAdmins, fetchUsers } from "../superAdminApi";
import {
  saveSubscriptionPlan,
  assignSubscriptionToClinic,
  fetchAllSubscriptions,
  fetchSubscriptionPlans,
  BILLING_CYCLES,
  SUBSCRIPTION_PLAN_TYPES,
  getBillingCycle,
} from "../../../utils/subscriptionFlow";

const getAdminRows = (admins = [], users = []) => {
  const rows = new Map();
  [...admins, ...users].forEach((row) => {
    const role = String(row.role || row.type || row.raw?.role || row.raw?.type || "").toLowerCase();
    if (role && !role.includes("admin")) return;
    const email = String(row.email || row.raw?.email || "").toLowerCase();
    if (!email) return;
    rows.set(email, {
      id: row.id || row.raw?.id || email,
      name: row.name || row.fullName || row.raw?.name || row.raw?.fullName || "Admin",
      email,
      assignedClinic: row.assignedClinic || row.clinic || row.clinicName || row.raw?.clinicName || row.raw?.hospitalName || "Clinic pending",
      hospitalId: row.hospitalId || row.clinicId || row.assignedClinicId || row.raw?.hospitalId || row.raw?.clinicId || row.raw?.assignedClinicId || "",
      phone: row.phone || row.mobileNumber || row.raw?.phone || row.raw?.mobileNumber || "-",
      status: row.status || "Active",
    });
  });
  return Array.from(rows.values());
};

function Subscriptions() {
  const toast = useToast();
  const [admins, setAdmins] = useState([]);
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [form, setForm] = useState({ planId: "", months: "1", includesLab: "true" });
  const [pricing, setPricing] = useState({ planType: "Basic", includesLab: "false", months: "1", price: "" });
  const [savingPlan, setSavingPlan] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const notifyError = (value) => { setError(value); toast.error(value); };
  const pricingPlan = [...plans].reverse().find((plan) => plan.planType === pricing.planType && plan.includesLab === (pricing.includesLab === "true") && plan.durationMonths === Number(pricing.months));
  useEffect(() => {
    setPricing((current) => ({ ...current, price: pricingPlan ? String(pricingPlan.price) : "" }));
  }, [pricingPlan, pricing.planType, pricing.includesLab, pricing.months]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      const [adminsResult, usersResult, plansResult, subscriptionsResult] = await Promise.allSettled([
        fetchAdmins(),
        fetchUsers(),
        fetchSubscriptionPlans(),
        fetchAllSubscriptions(),
      ]);
      if (!active) return;

      const nextAdmins = getAdminRows(adminsResult.value || [], usersResult.value || []);
      const nextPlans = plansResult.status === "fulfilled" && plansResult.value?.length ? plansResult.value : [];
      const nextSubscriptions = subscriptionsResult.status === "fulfilled" ? subscriptionsResult.value : [];
      setAdmins(nextAdmins);
      setPlans(nextPlans);
      setSubscriptions(nextSubscriptions);
      setSelectedEmail(nextAdmins[0]?.email || "");
      setForm((current) => ({
        ...current,
        planId: nextPlans[0]?.id || current.planId,
        months: String(nextPlans[0]?.durationMonths || current.months),
        includesLab: String(nextPlans[0]?.includesLab ?? true),
      }));
      const failure = [plansResult, subscriptionsResult, adminsResult].find((result) => result.status === "rejected");
      if (failure) {
        notifyError(failure.reason?.message || "Unable to load backend subscription data.");
      }
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const selectedAdmin = admins.find((admin) => admin.email === selectedEmail) || admins[0] || {};
  const selectedPlan = plans.find((plan) => plan.isActive && String(plan.id) === String(form.planId)) || {};
  const assignmentPlans = plans.filter((plan) => plan.isActive && plan.includesLab === (form.includesLab === "true") && plan.durationMonths === Number(form.months));
  const selectAssignment = (changes) => {
    const next = { ...form, ...changes };
    const plan = [...plans].reverse().find((item) => item.isActive && item.includesLab === (next.includesLab === "true") && item.durationMonths === Number(next.months));
    setForm({ ...next, planId: plan?.id || "", paidAmount: "", paymentReference: "", paymentDate: "" });
  };
  const amount = Number(selectedPlan.price || 0);
  const savePricing = async (event) => {
    event.preventDefault();
    setSavingPlan(true); setError("");
    try {
      const includesLab = pricing.includesLab === "true";
      const durationMonths = Number(pricing.months);
      const cycle = getBillingCycle(durationMonths);
      const labLabel = includesLab ? "With Lab" : "Without Lab";
      const planName = pricing.planType + " - " + labLabel + " - " + cycle;
      const saved = await saveSubscriptionPlan({ name: planName, planType: pricing.planType, durationMonths, includesLab, price: Number(pricing.price), isActive: true }, pricingPlan?.id);
      const refreshed = await fetchSubscriptionPlans();
      setPlans(refreshed);
      const persisted = [...refreshed].reverse().find((plan) => plan.planType === pricing.planType && plan.includesLab === includesLab && plan.durationMonths === durationMonths && Number(plan.price) === Number(pricing.price) && (!saved?.id || String(plan.id) === String(saved.id)));
      if (!persisted) throw new Error("The plan was submitted, but the saved price was not returned by the backend.");
      setForm({ planId: persisted.id, months: String(durationMonths), includesLab: String(includesLab) });
      toast.success(planName + " plan saved.");
      try { setSubscriptions(await fetchAllSubscriptions()); }
      catch (failure) { notifyError("Plan saved, but subscriptions could not be refreshed: " + failure.message); }
    } catch (failure) { notifyError(failure.message || "Unable to save plan."); }
    finally { setSavingPlan(false); }
  };

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return subscriptions.filter((row) => {
      const matchesSearch = [row.adminName, row.adminEmail, row.clinicName, row.planName, row.billingCycle, row.subscriptionType, row.paymentReference]
        .some((value) => String(value || "").toLowerCase().includes(query));
      const matchesStatus = status === "All" || row.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [subscriptions, search, status]);

  const totalRevenue = filteredRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const saveSubscription = async (event) => {
    event.preventDefault();
    setError("");
    if (!selectedAdmin.email) { notifyError("Select an admin."); return; }
    if (!selectedPlan.id) {
      notifyError("Save a plan for the selected subscription type and billing cycle first.");
      return;
    }
    if (!selectedAdmin.hospitalId) {
      notifyError("This Admin has no clinic yet. Admin must create clinic and re-login before subscription assignment.");
      return;
    }
    const paidAmount = Number(form.paidAmount || 0);
    if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > amount) {
      notifyError("Paid amount must be between zero and the saved plan amount.");
      return;
    }

    setSaving(true);
    try {
      await assignSubscriptionToClinic({
        hospitalId: selectedAdmin.hospitalId,
        subscriptionPlanId: selectedPlan.id,
        startDate: new Date().toISOString().slice(0, 10),
        paidAmount,
        paymentReference: paidAmount > 0 ? form.paymentReference : "",
        paymentDate: paidAmount > 0 ? form.paymentDate : "",
      });
      setSubscriptions(await fetchAllSubscriptions());
      toast.success(selectedPlan.name + " assigned to " + selectedAdmin.name + ". Amount " + formatIndianCurrency(amount) + ".");
    } catch (requestError) {
      notifyError(requestError.message || "Unable to assign subscription.");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: "adminName", label: "Admin", width: "minmax(150px, 1fr)" },
    { key: "clinicName", label: "Clinic", width: "minmax(150px, 1fr)", render: (row) => row.clinicName || "Clinic pending" },
    { key: "planName", label: "Plan", width: "105px" },
    { key: "subscriptionType", label: "Type", width: "150px" },
    { key: "billingCycle", label: "Billing Cycle", width: "120px" },
    { key: "amount", label: "Plan Amount", width: "120px", render: (row) => row.amount == null ? "-" : formatIndianCurrency(row.amount) },
    { key: "paidAmount", label: "Paid Amount", width: "120px", render: (row) => row.paidAmount == null ? "-" : formatIndianCurrency(row.paidAmount) },
    { key: "paymentStatus", label: "Payment", width: "110px", render: (row) => row.paymentStatus || "-" },
    { key: "startDate", label: "Start Date", width: "120px" },
    { key: "renewalDate", label: "Renewal", width: "120px" },
    { key: "status", label: "Status", width: "95px", render: (row) => <span className="sa-badge is-active">{row.status}</span> },
  ];

  return (
    <div className="sa-subscriptions-page">
      <Header title="Subscriptions & Renewals" />
      {error ? <div className="sa-state sa-state--error" role="alert">{error}</div> : null}
      <form className="sa-subscription-panel" onSubmit={savePricing} onInvalid={() => toast.error("Enter a valid plan price.")}>
        <h3>Plan Pricing</h3>
        <div className="sa-subscription-form-grid">
          <div className="sa-form-field"><label htmlFor="pricing-type">Plan type</label><select id="pricing-type" disabled={savingPlan} value={pricing.planType} onChange={(event) => setPricing({ ...pricing, planType: event.target.value })}>{SUBSCRIPTION_PLAN_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
          <div className="sa-form-field"><label htmlFor="pricing-lab">Lab access</label><select id="pricing-lab" disabled={savingPlan} value={pricing.includesLab} onChange={(event) => setPricing({ ...pricing, includesLab: event.target.value })}><option value="false">Without Lab</option><option value="true">With Lab</option></select></div>
          <div className="sa-form-field"><label htmlFor="pricing-cycle">Billing cycle</label><select id="pricing-cycle" disabled={savingPlan} value={pricing.months} onChange={(event) => setPricing({ ...pricing, months: event.target.value })}>{BILLING_CYCLES.map((cycle) => <option key={cycle.months} value={cycle.months}>{cycle.label}</option>)}</select></div>
          <div className="sa-form-field"><label htmlFor="pricing-amount">Price</label><input id="pricing-amount" disabled={savingPlan} type="number" required min="0" step="0.01" value={pricing.price} onChange={(event) => setPricing({ ...pricing, price: event.target.value })} /></div>
        </div>
        <div className="sa-subscription-actions"><button className="sa-btn sa-btn-primary" disabled={loading || saving || savingPlan}>{savingPlan ? "Saving..." : pricingPlan ? "Update Plan" : "Save Plan"}</button></div>
      </form>
      <section className="sa-subscription-table-section">
        <h3>Saved Plans</h3>
        <DataTable columns={[
          { key: "name", label: "Plan", width: "minmax(220px, 1fr)" },
          { key: "planType", label: "Type", width: "150px" },
          { key: "includesLab", label: "Lab Access", width: "140px", render: (plan) => plan.includesLab ? "With Lab" : "Without Lab" },
          { key: "billingCycle", label: "Billing Cycle", width: "130px" },
          { key: "price", label: "Price", width: "130px", render: (plan) => formatIndianCurrency(plan.price) },
          { key: "isActive", label: "Status", width: "100px", render: (plan) => plan.isActive ? "Active" : "Inactive" },
        ]} rows={plans} loading={loading} emptyMessage="No plans saved." />
      </section>

      <div className="sa-subscription-kpis">
        <div className="sa-subscription-kpi is-green"><IndianRupee size={20} /><div><b>{formatIndianCurrency(totalRevenue)}</b><span>Subscription value</span></div></div>
        <div className="sa-subscription-kpi is-blue"><ShieldCheck size={20} /><div><b>{subscriptions.length}</b><span>Assigned subscriptions</span></div></div>
        <div className="sa-subscription-kpi is-amber"><RefreshCw size={20} /><div><b>{filteredRows.filter((row) => row.status === "Active").length}</b><span>Active renewals</span></div></div>
      </div>

      <form className="sa-subscription-designer" onSubmit={saveSubscription} onInvalid={() => toast.error("Enter valid payment details.")}>
        <section className="sa-subscription-panel">
          <div className="sa-subscription-panel-head"><h3>Plan assignment</h3><span>{selectedPlan.id ? formatIndianCurrency(amount) : "-"}</span></div>
          <div className="sa-subscription-form-grid">
            <div className="sa-form-field"><label>Admin</label><select value={selectedEmail} onChange={(event) => setSelectedEmail(event.target.value)}>{admins.map((admin) => <option key={admin.email} value={admin.email}>{admin.name} - {admin.email}</option>)}</select></div>
            <div className="sa-form-field"><label htmlFor="assignment-type">Subscription type</label><select id="assignment-type" disabled={saving} value={form.includesLab} onChange={(event) => selectAssignment({ includesLab: event.target.value })}><option value="true">With Lab</option><option value="false">Without Lab</option></select></div>
            <div className="sa-form-field"><label htmlFor="assignment-cycle">Billing cycle</label><select id="assignment-cycle" disabled={saving} value={form.months} onChange={(event) => selectAssignment({ months: event.target.value })}>{BILLING_CYCLES.map((cycle) => <option key={cycle.months} value={cycle.months}>{cycle.label}</option>)}</select></div>
            <div className="sa-form-field"><label htmlFor="assignment-plan">Plan</label><select id="assignment-plan" disabled={saving} value={form.planId} onChange={(event) => setForm({ ...form, planId: event.target.value })}><option value="">Select saved plan</option>{assignmentPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} - {formatIndianCurrency(plan.price)}</option>)}</select></div>
            <div className="sa-form-field"><label htmlFor="assignment-amount">Subscription amount</label><input id="assignment-amount" value={selectedPlan.id ? formatIndianCurrency(amount) : ""} readOnly /></div>
            <div className="sa-form-field"><label htmlFor="assignment-paid">Paid amount</label><input id="assignment-paid" type="number" min="0" max={amount} step="0.01" disabled={saving || !selectedPlan.id} value={form.paidAmount ?? ""} onChange={(event) => setForm({ ...form, paidAmount: event.target.value })} /></div>
            <div className="sa-form-field"><label htmlFor="assignment-reference">Payment reference</label><input id="assignment-reference" maxLength={200} disabled={saving || !Number(form.paidAmount)} value={form.paymentReference ?? ""} onChange={(event) => setForm({ ...form, paymentReference: event.target.value })} /></div>
            <div className="sa-form-field"><label htmlFor="assignment-payment-date">Payment date</label><input id="assignment-payment-date" type="date" max={new Date().toISOString().slice(0, 10)} disabled={saving || !Number(form.paidAmount)} value={form.paymentDate ?? ""} onChange={(event) => setForm({ ...form, paymentDate: event.target.value })} /></div>
          </div>

          <div className="sa-subscription-actions"><button className="sa-btn sa-btn-primary" disabled={loading || saving || savingPlan}>{saving ? "Assigning..." : "Assign / Renew Plan"}</button></div>
        </section>

        <aside className="sa-subscription-summary">
          <h3>Clinic data</h3>
          <div className="sa-subscription-admin-card"><Building2 size={20} /><div><b>{selectedAdmin.assignedClinic || "Clinic pending"}</b><span>{selectedAdmin.name || "Admin"}</span><small>{selectedAdmin.hospitalId ? `HospitalId: ${selectedAdmin.hospitalId}` : "Clinic must be created by Admin"}</small></div></div>
          <div className="sa-subscription-summary-grid">
            <span><b>{selectedPlan.id ? (selectedPlan.includesLab ? "With Lab" : "Without Lab") : "-"}</b><small>Subscription type</small></span>
            <span><b>{selectedPlan.id ? formatIndianCurrency(selectedPlan.price) : "-"}</b><small>Plan amount</small></span>
            <span><b>{selectedPlan.billingCycle || "-"}</b><small>Billing cycle</small></span>
            <span><b>{form.months}</b><small>Months</small></span>
          </div>
        </aside>
      </form>

      <section className="sa-subscription-table-section">
        <SearchFilter value={search} onChange={setSearch} placeholder="Search subscriptions..." filters={["All", ...new Set(subscriptions.map((row) => row.status).filter(Boolean))]} selectedFilter={status} onFilterChange={setStatus} />
        <div style={{ overflowX: "auto" }}><div style={{ minWidth: 1580 }}><DataTable columns={columns} rows={filteredRows} loading={loading} emptyMessage="No subscriptions found." preserveColumnFractions /></div></div>
      </section>
    </div>
  );
}

export default Subscriptions;
