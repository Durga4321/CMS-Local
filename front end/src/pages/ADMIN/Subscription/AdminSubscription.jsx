import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import Header from "../../../components/superadmin/Header";
import { useToast } from "../../../components/ToastProvider";
import { formatIndianCurrency } from "../../../utils/format";
import { fetchMySubscription } from "../../../utils/subscriptionFlow";

export default function AdminSubscription() {
  const toast = useToast();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    fetchMySubscription().then((value) => {
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
  const currency = (value) => value == null ? "-" : formatIndianCurrency(value);
  const details = subscription ? [
    ["Plan", subscription.planName],
    ["Plan ID", subscription.subscriptionPlanId],
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
  return <>
    <Header title="Subscription Details" action={<button type="button" className="sa-btn" title="Refresh subscription" aria-label="Refresh subscription" disabled={loading} onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} /></button>} />
    {error && <div className="sa-state sa-state--error" role="alert">{error}</div>}
    {loading ? <div className="sa-state">Loading...</div> : subscription ? <section className="sa-form-card">
      <h3>Plan Summary</h3>
      <div className="sa-form-grid">{details.map(([label, value], index) => <div className="sa-form-field" key={label}><label htmlFor={"subscription-detail-" + index}>{label}</label><input id={"subscription-detail-" + index} readOnly value={value == null || value === "" ? "-" : value} /></div>)}</div>
    </section> : !error && <div className="sa-state">No subscription assigned.</div>}
  </>;
}

