import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  SUBSCRIPTION_PLAN_TYPES,
  fetchSubscriptionPlans,
  readSubscriptionPlans,
} from "../utils/subscriptionFlow";
import { formatIndianCurrency } from "../utils/format";

export default function SubscriptionPlans() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [selectedType, setSelectedType] = useState(null);

  useEffect(() => {
    let active = true;
    fetchSubscriptionPlans()
      .then((items) => {
        if (active) setPlans(items.filter((plan) => plan.isActive));
      })
      .catch(() => {
        if (!active) return;
        const cached = readSubscriptionPlans().filter((plan) => plan.isActive);
        setPlans(cached);
        if (!cached.length) {
          setNotice("Plan prices will appear after the Super Admin publishes them.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const grouped = useMemo(
    () =>
      SUBSCRIPTION_PLAN_TYPES.map((type) => {
        const durations = plans
          .filter((plan) => plan.planType === type)
          .reduce((result, plan) => {
            const duration = Number(plan.durationMonths);
            let entry = result.find((item) => item.durationMonths === duration);
            if (!entry) {
              entry = { durationMonths: duration, withoutLab: null, withLab: null };
              result.push(entry);
            }
            if (plan.includesLab) entry.withLab = plan;
            else entry.withoutLab = plan;
            return result;
          }, [])
          .sort((a, b) => a.durationMonths - b.durationMonths);

        return { type, durations };
      }),
    [plans]
  );
  const selectedGroup = grouped.find(({ type }) => type === selectedType);

  const choosePlan = (plan) => {
    sessionStorage.setItem("cmsSelectedSubscriptionPlan", JSON.stringify(plan));
    navigate("/subscribe/" + encodeURIComponent(plan.id));
  };

  return (
    <section className="landing-pricing-section">
      <div className="landing-pricing-head">
        <span>Flexible clinic subscriptions</span>
        <h2>Choose the plan that fits your clinic</h2>
        <p>Plan types, durations, and prices are maintained by the Super Admin.</p>
      </div>
      {loading && <div className="landing-plan-state">Loading current plans...</div>}
      {notice && <div className="landing-plan-state">{notice}</div>}
      {!loading && (
        <>
          <div className="landing-plan-type-grid">
          {grouped.map(({ type, durations }) => (
            <button
              type="button"
              className={`landing-plan-type-card is-${type.toLowerCase()}${selectedType === type ? " is-selected" : ""}`}
              key={type}
              aria-expanded={selectedType === type}
              onClick={() => setSelectedType(selectedType === type ? null : type)}
            >
              <span className="landing-plan-type-kicker">
                {type === "Basic"
                  ? "For growing clinics"
                  : type === "Super"
                    ? "Most popular"
                    : "Complete care suite"}
              </span>
              <span className="landing-plan-type-name">{type}</span>
              <span className="landing-plan-type-action">
                {selectedType === type ? "Hide options" : "Explore plan"}
                <ArrowRight size={16} />
              </span>
            </button>
          ))}
          </div>
          {selectedGroup && (
            <section className="landing-plan-duration-panel" aria-label={`${selectedGroup.type} plan durations`}>
              <div className="landing-plan-duration-heading">
                <div>
                  <span>Available durations</span>
                  <h3>{selectedGroup.type} plans</h3>
                </div>
                <p>Select a duration to continue. You can choose lab access and see its price next.</p>
              </div>
              {selectedGroup.durations.length ? (
                <div className="landing-plan-duration-grid">
                  {selectedGroup.durations.map(({ durationMonths, withoutLab, withLab }) => {
                    const defaultPlan = withoutLab || withLab;
                    const prices = [withoutLab?.price, withLab?.price].filter(
                      (price) => price != null
                    );
                    const lowestPrice = Math.min(...prices);
                    return (
                      <button
                        type="button"
                        className="landing-plan-duration-option"
                        key={durationMonths}
                        onClick={() => choosePlan(defaultPlan)}
                      >
                        <span className="landing-plan-duration">
                          {durationMonths} {durationMonths === 1 ? "month" : "months"}
                        </span>
                        <strong>From {formatIndianCurrency(lowestPrice)}</strong>
                        <span className="landing-plan-duration-cta">
                          Choose duration <ArrowRight size={15} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="landing-plan-empty">No {selectedGroup.type} prices published yet.</p>
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
}
