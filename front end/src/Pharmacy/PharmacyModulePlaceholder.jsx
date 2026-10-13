import React from "react";
import { Pill } from "lucide-react";

function PharmacyModulePlaceholder({ title, description }) {
  return (
    <section className="pharmacy-module-placeholder">
      <span className="pharmacy-module-icon"><Pill size={22} /></span>
      <h2>{title}</h2>
      <p>{description}</p>
      <span className="pharmacy-coming-soon">API integration is being added step by step.</span>
    </section>
  );
}

export default PharmacyModulePlaceholder;
