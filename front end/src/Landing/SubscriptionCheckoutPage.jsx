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
  confirmDemoSubscriptionPayment,
  fetchSubscriptionPaymentMethods,
  fetchSubscriptionPaymentStatus,
  fetchSubscriptionPlans,
  getDemoCheckoutToken,
  getSubscriptionPurchaseId,
  initiateSubscriptionPayment,
} from "../utils/subscriptionFlow";
import { formatIndianCurrency } from "../utils/format";
import "./LandingPage.css";

const getPaymentOutcome = (response) => {
  const statuses = [
    response?.paymentStatus,
    response?.PaymentStatus,
    response?.purchaseStatus,
    response?.PurchaseStatus,
    response?.status,
    response?.Status,
    response?.result,
    response?.Result,
    response?.payment?.status,
    response?.Payment?.Status,
    response?.purchase?.paymentStatus,
    response?.Purchase?.PaymentStatus,
    response?.purchase?.status,
    response?.Purchase?.Status,
    response?.payment?.paymentStatus,
    response?.Payment?.PaymentStatus,
    response?.data?.paymentStatus,
    response?.data?.PaymentStatus,
    response?.data?.purchaseStatus,
    response?.data?.PurchaseStatus,
    response?.data?.purchase?.paymentStatus,
    response?.data?.purchase?.status,
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
  const [accessModule, setAccessModule] = useState("lab");
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [gatewayConfigured, setGatewayConfigured] = useState(false);
  const [paymentMethodsError, setPaymentMethodsError] = useState("");
  const [details, setDetails] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [paymentMethod, setPaymentMethod] = useState("");
  const [demoPaymentResult, setDemoPaymentResult] = useState("Success");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [purchaseId, setPurchaseId] = useState("");
  const [demoToken, setDemoToken] = useState("");
  const [paymentOutcome, setPaymentOutcome] = useState(null);
  const [checkingPaymentStatus, setCheckingPaymentStatus] = useState(false);

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

  const accessVariants = useMemo(() => {
    if (!plan) return { without: null, with: null };
    const matching = plans.filter(
      (item) =>
        item.planType === plan.planType &&
        Number(item.durationMonths) === Number(plan.durationMonths)
    );
    const accessKey = accessModule === "lab" ? "includesLab" : "includesPharmacy";
    const otherAccessKey = accessModule === "lab" ? "includesPharmacy" : "includesLab";
    const findVariant = (includesAccess) =>
      matching.find((item) => item[accessKey] === includesAccess && item[otherAccessKey] === plan[otherAccessKey]) ||
      matching.find((item) => item[accessKey] === includesAccess) ||
      null;
    return {
      without: findVariant(false),
      with: findVariant(true),
    };
  }, [accessModule, plan, plans]);

  const selectAccessOption = (includesAccess) => {
    const selected = includesAccess ? accessVariants.with : accessVariants.without;
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
    let activeDemoToken = demoToken;
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
        activeDemoToken = getDemoCheckoutToken(purchase);
        setDemoToken(activeDemoToken);
      }
      const payment = gatewayConfigured
        ? await initiateSubscriptionPayment(activePurchaseId, paymentMethod)
        : await confirmDemoSubscriptionPayment(activePurchaseId, paymentMethod, demoPaymentResult, activeDemoToken);
      const initiatedOutcome = {
        status: getPaymentOutcome(payment),
        message: getPaymentMessage(payment, "The payment service returned no status details."),
      };
      setPaymentOutcome(initiatedOutcome);
      try {
        const status = await fetchSubscriptionPaymentStatus(activePurchaseId);
        const statusOutcome = getPaymentOutcome(status);
        setPaymentOutcome({
          status: statusOutcome === "unknown" ? initiatedOutcome.status : statusOutcome,
          message: getPaymentMessage(status, initiatedOutcome.message),
        });
      } catch (statusFailure) {
        setPaymentOutcome({
          ...initiatedOutcome,
          statusCheckError: statusFailure.message || "Unable to confirm the payment status.",
        });
      }
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
  const checkPaymentStatus = async () => {
    if (!purchaseId || checkingPaymentStatus) return;
    setCheckingPaymentStatus(true);
    try {
      const status = await fetchSubscriptionPaymentStatus(purchaseId);
      setPaymentOutcome({
        status: getPaymentOutcome(status),
        message: getPaymentMessage(status, "The payment service returned no status details."),
      });
    } catch (failure) {
      setPaymentOutcome((current) => ({
        ...current,
        statusCheckError: failure.message || "Unable to confirm the payment status.",
      }));
    } finally {
      setCheckingPaymentStatus(false);
    }
  };
  const continueAfterApproval = () => {
    navigate("/");
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
              <p>{plan.name}</p><p>Branches: {plan.maxBranches ?? "Not specified"} ? Appointments/day: {plan.dailyAppointmentLimit ?? "Not specified"}</p><ul>{plan.benefits.map(benefit => <li key={benefit}>{benefit}</li>)}</ul>
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
                {paymentOutcome.statusCheckError ? <p className="landing-payment-error" role="alert">Payment initiation was recorded, but the payment status could not be confirmed: {paymentOutcome.statusCheckError}</p> : null}
                {paymentOutcome.status === "approved" ? (
                  <>
                    <p className="landing-payment-result-note">Purchase ID: {purchaseId}. Your paid purchase is awaiting Admin account creation. The Super Admin will create the account and initiate password setup; you can sign in after receiving those setup instructions.</p>
                    <button type="button" onClick={continueAfterApproval}>
                      Return to Home <ArrowRight size={17} />
                    </button>
                  </>
                ) : paymentOutcome.status === "rejected" ? (
                  <button type="button" onClick={() => setPaymentOutcome(null)}>
                    Try payment again
                  </button>
                ) : (
                  <>
                    <p className="landing-payment-result-note">Purchase ID: {purchaseId}. Do not create another checkout; check this purchase status before retrying.</p>
                    <button type="button" onClick={checkPaymentStatus} disabled={checkingPaymentStatus}>
                      {checkingPaymentStatus ? "Checking status..." : "Check payment status"}
                    </button>
                  </>
                )}
              </section>
            ) : (
            <form className="landing-checkout-form" onSubmit={submit}>
              <fieldset className="landing-lab-options">
                <legend>
                  <span>Choose {accessModule === "lab" ? "lab" : "pharmacy"} access</span>
                  <label className="landing-access-module-select">
                    <span>Choose module</span>
                    <select value={accessModule} onChange={(event) => setAccessModule(event.target.value)}>
                      <option value="lab">Lab</option>
                      <option value="pharmacy">Pharmacy</option>
                    </select>
                  </label>
                </legend>
                {[
                  {
                    label: accessModule === "lab" ? "Without Lab" : "Without Pharmacy",
                    includesAccess: false,
                    variant: accessVariants.without,
                  },
                  {
                    label: accessModule === "lab" ? "With Lab" : "With Pharmacy",
                    includesAccess: true,
                    variant: accessVariants.with,
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
                      name="subscriptionAccess"
                      checked={Boolean(option.variant && String(option.variant.id) === String(plan.id))}
                      disabled={!option.variant}
                      onChange={() => selectAccessOption(option.includesAccess)}
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
                    maxLength={254}
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
                    pattern="^(?!([0-9])\\1{9})[6-9][0-9]{9}$"
                    autoComplete="tel"
                    maxLength={10}
                    title="Enter a valid 10-digit Indian mobile number starting with 6-9."
                    value={details.phone}
                    onChange={(event) =>
                      setDetails({ ...details, phone: event.target.value })
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
                <div className="landing-demo-payment-settings">
                  <small className="landing-payment-note landing-demo-payment-note">
                    Payment gateway is not configured. This is a development payment simulation.
                  </small>
                  <label className="landing-demo-payment-select">
                    Demo payment result
                    <select
                      value={demoPaymentResult}
                      onChange={(event) => setDemoPaymentResult(event.target.value)}
                      disabled={submitting}
                    >
                      <option value="Success">Simulate success</option>
                      <option value="Failed">Simulate failure</option>
                    </select>
                  </label>
                </div>
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
