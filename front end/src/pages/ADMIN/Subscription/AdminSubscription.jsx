import React, { useEffect, useState } from "react";
import "./AdminSubscription.css";
import { CheckCircle2, RefreshCw } from "lucide-react";
import Header from "../../../components/superadmin/Header";
import DataTable from "../../../components/superadmin/DataTable";
import { useToast } from "../../../components/ToastProvider";
import { formatIndianCurrency } from "../../../utils/format";
import {
  activateSubscriptionRenewal,
  createRenewalCheckout,
  fetchClinicSubscription,
  fetchRenewalHistory,
  fetchSubscriptionPaymentMethods,
  fetchSubscriptionPaymentStatus,
  fetchSubscriptionPlans,
  getSubscriptionPurchaseId,
  initiateSubscriptionPayment,
} from "../../../utils/subscriptionFlow";

const readRenewalValue = (renewal, ...keys) => {
  for (const key of keys) {
    const value = key.split(".").reduce((current, part) => current?.[part], renewal);
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
};

const normalizeRenewal = (renewal) => ({
  id: readRenewalValue(renewal, "purchaseId", "PurchaseId", "id", "Id", "subscriptionPurchaseId", "SubscriptionPurchaseId"),
  planName: readRenewalValue(renewal, "planName", "PlanName", "subscriptionPlan.name", "SubscriptionPlan.Name"),
  amount: readRenewalValue(renewal, "amount", "Amount", "price", "Price"),
  paymentMethod: readRenewalValue(renewal, "paymentMethod", "PaymentMethod"),
  paymentStatus: readRenewalValue(renewal, "paymentStatus", "PaymentStatus", "payment.status", "Payment.Status"),
  status: readRenewalValue(renewal, "status", "Status"),
  createdAt: readRenewalValue(renewal, "createdAt", "CreatedAt", "purchaseDate", "PurchaseDate", "date", "Date"),
  raw: renewal,
});

const isPaidRenewal = (renewal) =>
  ["paid", "success", "successful", "succeeded", "completed", "verified"].includes(
    String(renewal.paymentStatus || renewal.status).trim().toLowerCase()
  );

const isActivatedRenewal = (renewal) =>
  ["active", "activated"].includes(String(renewal.status).trim().toLowerCase());

const readPaymentStatus = (value) =>
  readRenewalValue(value, "paymentStatus", "PaymentStatus", "purchaseStatus", "PurchaseStatus", "payment.status", "Payment.Status", "status", "Status", "data.paymentStatus", "data.PaymentStatus", "data.status", "data.Status");

export default function AdminSubscription() {
  const toast = useToast();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [plans, setPlans] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [gatewayConfigured, setGatewayConfigured] = useState(false);
  const [renewals, setRenewals] = useState([]);
  const [renewalLoading, setRenewalLoading] = useState(true);
  const [renewalError, setRenewalError] = useState("");
  const [renewalNotice, setRenewalNotice] = useState("");
  const [renewalPlanId, setRenewalPlanId] = useState("");
  const [renewalPaymentMethod, setRenewalPaymentMethod] = useState("");
  const [renewalAction, setRenewalAction] = useState("");
  const loadRenewals = async () => {
    setRenewalLoading(true);
    setRenewalError("");
    const [plansResult, methodsResult, historyResult] = await Promise.allSettled([
      fetchSubscriptionPlans(),
      fetchSubscriptionPaymentMethods(),
      fetchRenewalHistory(),
    ]);
    const failures = [];
    if (plansResult.status === "fulfilled") {
      const activePlans = plansResult.value.filter((plan) => plan.isActive);
      setPlans(activePlans);
      setRenewalPlanId((current) =>
        activePlans.some((plan) => String(plan.id) === String(current))
          ? current
          : String(activePlans[0]?.id || "")
      );
    } else {
      setPlans([]);
      failures.push(plansResult.reason?.message || "Unable to load active plans.");
    }
    if (methodsResult.status === "fulfilled") {
      const paymentOptions = methodsResult.value;
      setPaymentMethods(paymentOptions.methods);
      setGatewayConfigured(paymentOptions.gatewayConfigured);
      setRenewalPaymentMethod((current) =>
        paymentOptions.methods.some((method) => method.code === current)
          ? current
          : paymentOptions.methods[0]?.code || ""
      );
    } else {
      setPaymentMethods([]);
      failures.push(methodsResult.reason?.message || "Unable to load payment methods.");
    }
    if (historyResult.status === "fulfilled") {
      setRenewals(historyResult.value.map(normalizeRenewal));
    } else {
      setRenewals([]);
      failures.push(historyResult.reason?.message || "Unable to load renewal history.");
    }
    setRenewalError(failures.join(" "));
    setRenewalLoading(false);
  };
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    fetchClinicSubscription().then((value) => {
      if (!active) return;
      setSubscription(value);
      if (refresh) toast.success("Subscription refreshed.");
    }).catch((failure) => {
      if (!active) return;
      setSubscription(null);
      const message = failure.message || "Unable to load subscription.";
      setError(message); toast.error(message);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh, toast]);
  useEffect(() => {
    loadRenewals();
  }, []);
  const checkoutRenewal = async (event) => {
    event.preventDefault();
    if (renewalAction) return;
    setRenewalAction("checkout");
    setRenewalError("");
    setRenewalNotice("");
    try {
      const purchase = await createRenewalCheckout({
        subscriptionPlanId: renewalPlanId,
        paymentMethod: renewalPaymentMethod,
      });
      const purchaseId = getSubscriptionPurchaseId(purchase);
      if (!purchaseId) {
        throw new Error("The renewal checkout was created, but the API response did not include a purchase ID. Contact support before retrying.");
      }
      const initiated = await initiateSubscriptionPayment(purchaseId, renewalPaymentMethod, { authenticated: true });
      let paymentStatus;
      let statusCheckMessage = "";
      try {
        const currentStatus = await fetchSubscriptionPaymentStatus(purchaseId);
        paymentStatus = readPaymentStatus(currentStatus) || readPaymentStatus(initiated);
      } catch (statusFailure) {
        paymentStatus = readPaymentStatus(initiated);
        statusCheckMessage = statusFailure.message || "Status check failed.";
      }
      const normalizedStatus = String(paymentStatus || "").trim().toLowerCase();
      if (statusCheckMessage) {
        setRenewalNotice(`Renewal purchase ${purchaseId} was initiated, but its payment status could not be confirmed: ${statusCheckMessage}`);
      } else if (["paid", "success", "successful", "succeeded", "completed", "verified", "approved"].includes(normalizedStatus)) {
        toast.success("Renewal payment confirmed. Activate it from payment history when ready.");
      } else if (["failed", "failure", "rejected", "declined", "cancelled", "canceled"].includes(normalizedStatus)) {
        setRenewalNotice(`Payment for renewal purchase ${purchaseId} was ${paymentStatus}.`);
      } else {
        setRenewalNotice(`Renewal purchase ${purchaseId} payment status: ${paymentStatus || "Unconfirmed"}. Refresh or check the status before activating.`);
      }
      await loadRenewals();
      setRefresh((value) => value + 1);
    } catch (failure) {
      setRenewalError(failure.message || "Unable to create the renewal checkout.");
    } finally {
      setRenewalAction("");
    }
  };
  const checkRenewalPaymentStatus = async (renewal) => {
    if (!renewal.id || renewalAction) return;
    setRenewalAction(String(renewal.id));
    setRenewalError("");
    setRenewalNotice("");
    try {
      const result = await fetchSubscriptionPaymentStatus(renewal.id);
      const paymentStatus = readPaymentStatus(result);
      if (!paymentStatus) throw new Error("The payment status response did not include a status.");
      setRenewals((current) => current.map((row) =>
        String(row.id) === String(renewal.id) ? { ...row, paymentStatus, rawPaymentStatus: result } : row
      ));
      setRenewalNotice(`Renewal purchase ${renewal.id} payment status: ${paymentStatus}.`);
    } catch (failure) {
      setRenewalError(failure.message || `Unable to check payment status for renewal ${renewal.id}.`);
    } finally {
      setRenewalAction("");
    }
  };
  const activateRenewal = async (renewal) => {
    if (!renewal.id || renewalAction || !isPaidRenewal(renewal) || isActivatedRenewal(renewal)) return;
    if (!window.confirm(`Activate paid renewal ${renewal.id}?`)) return;
    setRenewalAction(String(renewal.id));
    setRenewalError("");
    try {
      await activateSubscriptionRenewal(renewal.id);
      toast.success("Paid renewal activated.");
      await loadRenewals();
      setRefresh((value) => value + 1);
    } catch (failure) {
      setRenewalError(failure.message || "Unable to activate this renewal.");
    } finally {
      setRenewalAction("");
    }
  };
  const currency = (value) => value == null ? "-" : formatIndianCurrency(value);
  const details = subscription ? [
    ["Plan", subscription.planName],
    ["Plan ID", subscription.subscriptionPlanId],
    ...[["CMS access", subscription.includesCms], ["Lab access", subscription.includesLab], ["Pharmacy access", subscription.includesPharmacy]].map(([label, value]) => [label, value == null ? "Unknown" : value ? "Yes" : "No"]),
    ["Subscription type", subscription.subscriptionType],
    ["Billing cycle", subscription.billingCycle],
    ["Duration (months)", subscription.durationMonths],
    ["Subscription amount", currency(subscription.amount)],
    ["Paid amount", currency(subscription.paidAmount)],
    ["Payment status", subscription.paymentStatus],
    ["Payment reference", subscription.paymentReference],
    ["Last payment date", subscription.lastPaymentDate],
    ["Start date", subscription.startDate],
    ["Renewal date", subscription.renewalDate],
    ["Subscription status", subscription.status],
    ["Clinic", subscription.clinicName],
    ["Clinic ID", subscription.hospitalId],
    ["Admin", subscription.adminName],
    ["Email", subscription.adminEmail],
    ["Phone", subscription.phone],
    ["Address", subscription.address],
    ["Payment option", subscription.paymentMethod],
    ["Record source", subscription.source],
  ] : [];
  return <div className="admin-subscription-page">
    <Header title="Subscription Details" action={<button type="button" className="sa-btn" title="Refresh subscription" aria-label="Refresh subscription" disabled={loading} onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} /></button>} />
    {error && <div className="sa-state sa-state--error" role="alert">{error}</div>}
    {loading ? <div className="sa-state">Loading...</div> : subscription ? <section className="sa-form-card">
      <h3>Plan Summary</h3>
      <div className="sa-form-grid">{details.map(([label, value], index) => <div className="sa-form-field" key={label}><label htmlFor={"subscription-detail-" + index}>{label}</label><input id={"subscription-detail-" + index} readOnly value={value == null || value === "" ? "-" : value} /></div>)}</div>
    </section> : !error && <div className="sa-state">No subscription assigned.</div>}
    <section className="sa-form-card" style={{ marginTop: 16 }}>
      <h3>Renew subscription</h3>
      {renewalError ? <div className="sa-state sa-state--error" role="alert">{renewalError}</div> : null}
      {renewalNotice ? <div className="sa-state" role="status">{renewalNotice}</div> : null}
      {renewalLoading ? <div className="sa-state">Loading renewal options...</div> : (
        <form onSubmit={checkoutRenewal}>
          <div className="sa-form-grid">
            <div className="sa-form-field">
              <label htmlFor="renewal-plan">Plan</label>
              <select id="renewal-plan" required value={renewalPlanId} onChange={(event) => setRenewalPlanId(event.target.value)} disabled={Boolean(renewalAction) || !plans.length}>
                <option value="">Select plan</option>
                {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} - {currency(plan.price)}</option>)}
              </select>
            </div>
            <div className="sa-form-field">
              <label htmlFor="renewal-payment-method">Payment method</label>
              <select id="renewal-payment-method" required value={renewalPaymentMethod} onChange={(event) => setRenewalPaymentMethod(event.target.value)} disabled={Boolean(renewalAction) || !paymentMethods.length}>
                <option value="">Select payment method</option>
                {paymentMethods.map((method) => <option key={method.code} value={method.code}>{method.name}</option>)}
              </select>
            </div>
          </div>
          {!gatewayConfigured && paymentMethods.length ? <p>Payment gateway is not configured; payment initiation may use the development simulation.</p> : null}
          <div className="sa-subscription-actions">
            <button className="sa-btn sa-btn-primary" type="submit" disabled={Boolean(renewalAction) || !renewalPlanId || !renewalPaymentMethod}>
              {renewalAction === "checkout" ? "Processing..." : "Create renewal checkout"}
            </button>
          </div>
        </form>
      )}
    </section>
    <section className="sa-subscription-table-section" style={{ marginTop: 16 }}>
      <div className="sa-subscription-panel-head">
        <h3>Renewal payment history</h3>
        <button type="button" className="sa-btn" onClick={loadRenewals} disabled={renewalLoading || Boolean(renewalAction)}>
          <RefreshCw size={16} />Refresh
        </button>
      </div>
      <DataTable columns={[
        { key: "id", label: "Purchase", width: "100px" },
        { key: "planName", label: "Plan", width: "minmax(180px, 1fr)", render: (row) => row.planName || "-" },
        { key: "amount", label: "Amount", width: "130px", render: (row) => row.amount === "" ? "-" : currency(row.amount) },
        { key: "paymentMethod", label: "Payment Method", width: "140px", render: (row) => row.paymentMethod || "-" },
        { key: "paymentStatus", label: "Payment", width: "120px", render: (row) => row.paymentStatus || "-" },
        { key: "status", label: "Status", width: "120px", render: (row) => row.status || "-" },
        { key: "createdAt", label: "Date", width: "150px", render: (row) => row.createdAt ? String(row.createdAt).slice(0, 10) : "-" },
        { key: "actions", label: "Action", width: "200px", render: (row) => isActivatedRenewal(row) ? "Activated" : (
          <>
            {!isPaidRenewal(row) ? <button type="button" className="sa-btn" onClick={() => checkRenewalPaymentStatus(row)} disabled={!row.id || Boolean(renewalAction)}>{renewalAction === String(row.id) ? "Checking..." : "Check status"}</button> : null}
            {isPaidRenewal(row) ? <button type="button" className="sa-btn sa-btn-primary" onClick={() => activateRenewal(row)} disabled={!row.id || Boolean(renewalAction)}>
              <CheckCircle2 size={15} />{renewalAction === String(row.id) ? "Activating..." : "Activate"}
            </button> : null}
          </>
        ) },
      ]} rows={renewals} loading={renewalLoading} emptyMessage="No renewal history found." />
    </section>
  </div>;
}
