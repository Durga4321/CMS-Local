import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  HeartPulse,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  createSubscriptionCheckout,
  fetchSubscriptionPaymentMethods,
  fetchSubscriptionPlans,
  getSubscriptionPurchaseId,
  initiateSubscriptionPayment,
} from "../utils/subscriptionFlow";
import { formatIndianCurrency } from "../utils/format";
import "./LandingPage.css";

const getPaymentOutcome = (response) => {
  const statuses = [
    response?.paymentStatus,
    response?.PaymentStatus,
    response?.status,
    response?.Status,
    response?.result,
    response?.Result,
    response?.payment?.status,
    response?.Payment?.Status,
    response?.data?.paymentStatus,
    response?.data?.PaymentStatus,
    response?.data?.status,
    response?.data?.Status,
    response?.data?.result,
    response?.data?.payment?.status,
  ].filter((value) => value !== undefined && value !== null);
  const normalized = statuses.map((value) => String(value).trim().toLowerCase());
  const messages = [
    response?.message,
    response?.Message,
    response?.data?.message,
    response?.data?.Message,
  ].filter(Boolean).map((value) => String(value).trim().toLowerCase());
  const pendingPayment = [...normalized, ...messages].some((value) =>
    /\b(payment|transaction)\b.*\b(pending|initiated|processing)\b/.test(value)
  );
  const rejectedStatus = normalized.some((value) =>
    ["rejected", "failed", "failure", "declined", "cancelled", "canceled"].includes(value)
  );
  const rejectedMessage = messages.some((value) =>
    /\b(payment|transaction)\b.*\b(rejected|failed|declined|cancelled|canceled)\b/.test(value)
  );
  if (rejectedStatus || rejectedMessage || response?.isApproved === false || response?.IsApproved === false) return "rejected";
  if (
    normalized.some((value) =>
      ["approved", "success", "successful", "succeeded", "paid", "completed"].includes(value)
    ) ||
    response?.isApproved === true ||
    response?.IsApproved === true
  ) return "approved";
  if (pendingPayment || normalized.some((value) => ["pending", "initiated", "processing", "in progress"].includes(value))) return "pending";
  if (response?.success === false || response?.Success === false) return "rejected";
  if (response?.success === true || response?.Success === true) return "approved";
  return "unknown";
};

const getPaymentMessage = (response, fallback) =>
  response?.message || response?.Message || response?.data?.message || response?.data?.Message || fallback;

export default function SubscriptionCheckoutPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [gatewayConfigured, setGatewayConfigured] = useState(false);
  const [paymentMethodsError, setPaymentMethodsError] = useState("");
  const [details, setDetails] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [paymentMethod, setPaymentMethod] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [purchaseId, setPurchaseId] = useState("");
  const [paymentOutcome, setPaymentOutcome] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchSubscriptionPlans(), fetchSubscriptionPaymentMethods()])
      .then(([items, paymentOptions]) => {
        if (!active) return;
        const activePlans = items.filter((item) => item.isActive);
        const selected = activePlans.find((item) => String(item.id) === String(planId));
        setPlans(activePlans);
        setPlan(selected);
        setPaymentMethods(paymentOptions.methods);
        setGatewayConfigured(paymentOptions.gatewayConfigured);
        setPaymentMethod((current) =>
          paymentOptions.methods.some((method) => method.code === current)
            ? current
            : paymentOptions.methods[0]?.code || ""
        );
      })
      .catch((failure) => {
        if (!active) return;
        setPlans([]);
        setPlan(null);
        setPaymentMethods([]);
        setPaymentMethodsError(failure.message || "Unable to load current plans and payment methods.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [planId]);

  const labVariants = useMemo(() => {
    if (!plan) return { withoutLab: null, withLab: null };
    const matching = plans.filter(
      (item) =>
        item.planType === plan.planType &&
        Number(item.durationMonths) === Number(plan.durationMonths)
    );
    return {
      withoutLab: matching.find((item) => !item.includesLab) || null,
      withLab: matching.find((item) => item.includesLab) || null,
    };
  }, [plan, plans]);

  const selectLabOption = (includesLab) => {
    const selected = includesLab ? labVariants.withLab : labVariants.withoutLab;
    if (!selected) return;
    setPlan(selected);
    setConfirmed(false);
    sessionStorage.setItem(
      "cmsSelectedSubscriptionPlan",
      JSON.stringify(selected)
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSubmitError("");
    const request = {
      plan,
      includesLab: Boolean(plan.includesLab),
      customer: details,
      paymentMethod,
      paymentConfirmed: confirmed,
    };
    let activePurchaseId = purchaseId;
    try {
      if (!activePurchaseId) {
        const purchase = await createSubscriptionCheckout({
          name: details.name,
          email: details.email,
          mobileNumber: details.phone,
          subscriptionPlanId: plan.id,
          paymentMethod,
        });
        activePurchaseId = getSubscriptionPurchaseId(purchase);
        if (!activePurchaseId) {
          throw new Error("The checkout was created, but the API response did not include a purchase ID. Contact support before retrying to avoid creating a duplicate purchase.");
        }
        setPurchaseId(activePurchaseId);
      }
      const payment = await initiateSubscriptionPayment(activePurchaseId, paymentMethod);
      setPaymentOutcome({
        status: getPaymentOutcome(payment),
        message: getPaymentMessage(payment, "The payment service returned no status details."),
      });
      sessionStorage.setItem(
        "cmsSelectedSubscriptionPlan",
        JSON.stringify(plan)
      );
      sessionStorage.setItem(
        "cmsSubscriptionRequest",
        JSON.stringify(request)
      );
    } catch (failure) {
      const rejected = getPaymentOutcome(failure.payload) === "rejected" || failure.status === 402;
      if (activePurchaseId && rejected) {
        setPaymentOutcome({
          status: "rejected",
          message: getPaymentMessage(failure.payload, failure.message || "The payment was rejected."),
        });
      } else {
        setSubmitError(failure.message || "Unable to submit the subscription request.");
      }
    } finally {
      setSubmitting(false);
    }
  };
  const continueAfterApproval = () => {
    const query = new URLSearchParams({
      subscriptionPlanId: String(plan.id),
      purchaseId,
      plan: plan.planType,
      months: String(plan.durationMonths),
      lab: plan.includesLab ? "with-lab" : "without-lab",
    });
    navigate("/login?" + query.toString());
  };

  return (
    <main className="subscription-page">
      <header className="subscription-page-nav">
        <Link to="/" className="subscription-page-brand">
          <HeartPulse size={24} />
          <span>
            <b>CMS</b>
            <small>Clinical Intelligence System</small>
          </span>
        </Link>
        <Link to="/plans" className="subscription-back">
          <ArrowLeft size={16} /> Change plan
        </Link>
      </header>

      {loading ? (
        <div className="landing-plan-state">Loading selected plan...</div>
      ) : !plan ? (
        <div className="subscription-missing">
          <h2>{paymentMethodsError ? "Unable to load checkout" : "Plan not found"}</h2>
          {paymentMethodsError ? <p role="alert">{paymentMethodsError}</p> : null}
          <Link to="/plans">View available plans</Link>
        </div>
      ) : (
        <section className="subscription-form-page">
          <div className="landing-checkout">
            <aside className="landing-checkout-summary">
              <span>Selected subscription</span>
              <h3>
                {plan.planType} - {plan.durationMonths}{" "}
                {plan.durationMonths === 1 ? "month" : "months"}
              </h3>
              <strong>{formatIndianCurrency(plan.price)}</strong>
              <p>{plan.name}</p>
              <p className="landing-lab-summary">
                {plan.includesLab ? "With Lab" : "Without Lab"}
              </p>
            </aside>

            {paymentOutcome ? (
              <section
                className={`landing-payment-result is-${paymentOutcome.status}`}
                role={paymentOutcome.status === "rejected" ? "alert" : "status"}
                aria-live="polite"
              >
                {paymentOutcome.status === "approved" ? <CheckCircle2 size={42} /> : null}
                {paymentOutcome.status === "rejected" ? <XCircle size={42} /> : null}
                {paymentOutcome.status === "pending" || paymentOutcome.status === "unknown" ? <Clock3 size={42} /> : null}
                <h2>
                  {paymentOutcome.status === "approved"
                    ? "Payment Approved"
                    : paymentOutcome.status === "rejected"
                      ? "Payment Rejected"
                      : paymentOutcome.status === "pending"
                        ? "Payment Pending"
                        : "Payment Status Unconfirmed"}
                </h2>
                <p>{paymentOutcome.message}</p>
                {paymentOutcome.status === "approved" ? (
                  <button type="button" onClick={continueAfterApproval}>
                    Continue to Login <ArrowRight size={17} />
                  </button>
                ) : paymentOutcome.status === "rejected" ? (
                  <button type="button" onClick={() => setPaymentOutcome(null)}>
                    Try payment again
                  </button>
                ) : (
                  <p className="landing-payment-result-note">
                    Do not submit another checkout. Check the payment status with support before retrying.
                  </p>
                )}
              </section>
            ) : (
            <form className="landing-checkout-form" onSubmit={submit}>
              <fieldset className="landing-lab-options">
                <legend>Choose lab access</legend>
                {[
                  {
                    label: "Without Lab",
                    includesLab: false,
                    variant: labVariants.withoutLab,
                  },
                  {
                    label: "With Lab",
                    includesLab: true,
                    variant: labVariants.withLab,
                  },
                ].map((option) => (
                  <label
                    key={option.label}
                    className={
                      option.variant &&
                      String(option.variant.id) === String(plan.id)
                        ? "is-selected"
                        : ""
                    }
                  >
                    <input
                      type="radio"
                      name="labAccess"
                      checked={
                        Boolean(plan.includesLab) === option.includesLab
                      }
                      disabled={!option.variant}
                      onChange={() => selectLabOption(option.includesLab)}
                    />
                    <span>
                      <b>{option.label}</b>
                      <small>
                        {option.variant
                          ? formatIndianCurrency(option.variant.price)
                          : "Not configured"}
                      </small>
                    </span>
                  </label>
                ))}
              </fieldset>

              <h3>Basic details</h3>
              <div className="landing-checkout-fields">
                <label>
                  Full name
                  <input
                    required
                    autoComplete="name"
                    value={details.name}
                    onChange={(event) =>
                      setDetails({ ...details, name: event.target.value })
                    }
                  />
                </label>
                <label>
                  Email address
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={details.email}
                    onChange={(event) =>
                      setDetails({ ...details, email: event.target.value })
                    }
                  />
                </label>
                <label>
                  Phone number
                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9+ -]{7,15}"
                    autoComplete="tel"
                    value={details.phone}
                    onChange={(event) =>
                      setDetails({ ...details, phone: event.target.value })
                    }
                  />
                </label>
                <label>
                  Address
                  <textarea
                    required
                    rows="3"
                    autoComplete="street-address"
                    value={details.address}
                    onChange={(event) =>
                      setDetails({ ...details, address: event.target.value })
                    }
                  />
                </label>
              </div>

              <fieldset className="landing-payment-methods" disabled={!paymentMethods.length || submitting}>
                <legend>Payment option</legend>
                {paymentMethods.map((method) => (
                  <label key={method.code}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.code}
                      checked={paymentMethod === method.code}
                      onChange={(event) =>
                        setPaymentMethod(event.target.value)
                      }
                    />
                    <span>{method.name}</span>
                  </label>
                ))}
              </fieldset>
              {!gatewayConfigured && paymentMethods.length ? (
                <small className="landing-payment-note">
                  Payment gateway is not configured. The server may process this as a development simulation.
                </small>
              ) : null}
              {paymentMethodsError ? <div className="landing-payment-error" role="alert">{paymentMethodsError}</div> : null}

              <label className="landing-payment-confirm">
                <input
                  required
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>
                  <CheckCircle2 size={18} /> I confirm the selected plan,
                  price, and payment option.
                </span>
              </label>

              {submitError && (
                <div className="landing-payment-error" role="alert">
                  {submitError}
                </div>
              )}

              <button
                className="landing-pay-button"
                type="submit"
                disabled={!confirmed || submitting || !paymentMethod || !paymentMethods.length}
              >
                {submitting
                  ? "Initiating payment..."
                  : "Initiate Payment"}{" "}
                <ArrowRight size={17} />
              </button>
              <small className="landing-payment-note">
                <ShieldCheck size={14} /> Your selection will continue through
                the existing subscription flow.
              </small>
            </form>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
