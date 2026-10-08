import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  HeartPulse,
  ShieldCheck,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchSubscriptionPlans,
  readSubscriptionPlans,
  saveLandingSubscriptionRequest,
} from "../utils/subscriptionFlow";
import { formatIndianCurrency } from "../utils/format";
import "./LandingPage.css";

export default function SubscriptionCheckoutPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let active = true;
    let stored = null;
    try {
      stored = JSON.parse(
        sessionStorage.getItem("cmsSelectedSubscriptionPlan") || "null"
      );
    } catch {}

    fetchSubscriptionPlans()
      .catch(() => readSubscriptionPlans())
      .then((items) => {
        if (!active) return;
        const activePlans = items.filter((item) => item.isActive);
        const selected =
          activePlans.find((item) => String(item.id) === String(planId)) ||
          (stored && String(stored.id) === String(planId) ? stored : null);
        setPlans(
          selected &&
            !activePlans.some((item) => String(item.id) === String(selected.id))
            ? [selected, ...activePlans]
            : activePlans
        );
        setPlan(selected);
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

  const submit = (event) => {
    event.preventDefault();
    const request = {
      plan,
      includesLab: Boolean(plan.includesLab),
      customer: details,
      paymentMethod,
      paymentConfirmed: confirmed,
    };
    sessionStorage.setItem(
      "cmsSelectedSubscriptionPlan",
      JSON.stringify(plan)
    );
    sessionStorage.setItem(
      "cmsSubscriptionRequest",
      JSON.stringify(request)
    );
    saveLandingSubscriptionRequest(request);
    const query = new URLSearchParams({
      subscriptionPlanId: String(plan.id),
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
          <h2>Plan not found</h2>
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

              <fieldset className="landing-payment-methods">
                <legend>Payment option</legend>
                {["UPI", "Card", "Net Banking"].map((method) => (
                  <label key={method}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method}
                      checked={paymentMethod === method}
                      onChange={(event) =>
                        setPaymentMethod(event.target.value)
                      }
                    />
                    <span>{method}</span>
                  </label>
                ))}
              </fieldset>

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

              <button
                className="landing-pay-button"
                type="submit"
                disabled={!confirmed}
              >
                Confirm & Continue to Login <ArrowRight size={17} />
              </button>
              <small className="landing-payment-note">
                <ShieldCheck size={14} /> Your selection will continue through
                the existing subscription flow.
              </small>
            </form>
          </div>
        </section>
      )}
    </main>
  );
}
