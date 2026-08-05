export const readReportField = (record = {}, keys = [], fallback = "") => {
  for (const key of keys) {
    const value = String(key).split(".").reduce((current, part) => (current && typeof current === "object" ? current[part] : undefined), record);
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return fallback;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatDateTime = (value = new Date()) => {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return String(value || "");
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const getReportRows = (record = {}) => {
  const values = record.reportValues || record.ReportValues || {};
  const fields = Array.isArray(record.reportFields || record.ReportFields)
    ? record.reportFields || record.ReportFields
    : [];

  return fields
    .filter((field) => !["remarks", "findings", "impression"].includes(field.key))
    .map((field) => {
      const value = values[field.key];
      if (value === undefined || value === null || String(value).trim() === "") return null;
      return {
        label: field.label || field.key,
        value: String(value).trim(),
        unit: field.unit || "",
        referenceRange: field.referenceRange || "",
      };
    })
    .filter(Boolean);
};

export const getReportName = (record = {}) =>
  readReportField(record, ["reportName", "ReportName", "reportTitle", "title", "__labTestNames", "testName", "TestName", "labTestName"], "Lab Report");

export const getReportId = (record = {}) =>
  readReportField(record, ["reportNo", "ReportNo", "reportId", "ReportId", "invoiceNo", "invoiceNumber", "billNumber", "id", "Id"], "-");

export const buildLabReportHtml = ({ record = {}, branding = {}, clinicName = "Clinic", profile = {}, autoPrint = true } = {}) => {
  const reportName = getReportName(record);
  const patientName = readReportField(record, ["patientName", "PatientName", "patient.name", "Patient.Name", "name", "Name"], "-");
  const patientCode = readReportField(record, ["patientCode", "PatientCode", "patientId", "PatientId", "patient.id", "Patient.Id"], "-");
  const ageGender = readReportField(record, ["ageGender", "AgeGender"], "") ||
    [
      readReportField(record, ["age", "Age", "patient.age", "Patient.Age"], ""),
      readReportField(record, ["gender", "Gender", "patient.gender", "Patient.Gender"], ""),
    ].filter(Boolean).join(" / ") || "-";
  const referredBy = readReportField(record, ["doctorName", "DoctorName", "referredBy", "ReferredBy", "doctor.name", "Doctor.Name"], "-");
  const receivedAt = readReportField(record, ["receivedAt", "ReceivedAt", "collectedAt", "CollectedAt", "invoiceDate", "billDate", "createdAt"], new Date());
  const reportedAt = readReportField(record, ["reportedAt", "ReportedAt", "reportDate", "ReportDate", "updatedAt"], new Date());
  const findings = readReportField(record, ["findings", "Findings", "reportFindings", "ReportFindings", "result", "Result"], "Findings pending.");
  const impression = readReportField(record, ["impression", "Impression", "conclusion", "Conclusion"], "");
  const reportRows = getReportRows(record);
  const reportType = String(readReportField(record, ["reportType", "ReportType"], "")).toLowerCase();
  const showNarrative = !reportRows.length || /scan|radiology|xray|x-ray|ct|mri|usg|ultra/.test(reportType);
  const logoUrl = branding.logoUrl || "";
  const watermarkUrl = branding.watermarkUrl || logoUrl;
  const headerTitle = branding.headerTitle || clinicName;
  const headerSubtitle = branding.headerSubtitle || "Department of Laboratory";
  const clinicAddress = readReportField(profile, ["address", "clinicAddress", "hospitalAddress", "branchAddress"], "") || branding.address || branding.clinicAddress || "";
  const clinicPhone = readReportField(profile, ["phone", "clinicPhone", "hospitalPhone", "branchPhone"], "") || branding.phone || branding.clinicPhone || "";
  const clinicEmail = readReportField(profile, ["email", "clinicEmail", "hospitalEmail"], "") || branding.email || branding.clinicEmail || "";
  const clinicFooterDetails = [
    clinicAddress,
    clinicPhone ? `Ph: ${clinicPhone}` : "",
    clinicEmail ? `Email: ${clinicEmail}` : "",
    branding.footerNote || "",
  ].filter(Boolean).join(" | ");
  const printedAt = formatDateTime(new Date());

  return `<!doctype html>
<html>
  <head>
    <title>${escapeHtml(reportName)} - ${escapeHtml(patientName)}</title>
    <style>
      @page { size: A4; margin: 12mm; }
      body { margin: 0; background: #fff; color: #1f2937; font-family: Arial, Helvetica, sans-serif; }
      .sheet { width: 790px; min-height: 1080px; margin: 0 auto; padding: 28px 34px 0; position: relative; overflow: visible; box-sizing: border-box; display: flex; flex-direction: column; }
      .watermark { position: absolute; inset: 0; display: grid; place-items: center; z-index: 0; opacity: .06; }
      .watermark img { width: 520px; max-height: 520px; object-fit: contain; }
      .sheet > *:not(.watermark) { position: relative; z-index: 1; }
      .top { display: grid; grid-template-columns: 1fr 110px 1fr; align-items: start; gap: 18px; min-height: 108px; }
      .brand { text-align: left; color: #1d4f91; font-weight: 900; font-size: 24px; letter-spacing: .4px; }
      .brand small { display: block; color: #374151; font-size: 10px; letter-spacing: 3px; margin-top: 3px; text-transform: uppercase; }
      .logo { text-align: center; }
      .logo img { width: 82px; height: 82px; object-fit: contain; }
      .clinic { text-align: right; font-weight: 900; color: #41316f; font-size: 27px; letter-spacing: .5px; }
      .clinic small { display: block; color: #374151; font-size: 10px; letter-spacing: 4px; margin-top: 3px; text-transform: uppercase; }
      h1 { margin: 6px 0 18px; text-align: center; font-size: 18px; letter-spacing: 1px; text-transform: uppercase; }
      .meta { border: 2px solid #374151; display: grid; grid-template-columns: 1fr 1fr; font-size: 14px; }
      .meta div { padding: 6px 9px; display: grid; grid-template-columns: 132px 10px 1fr; gap: 4px; }
      .meta b { font-weight: 900; }
      .report-title { margin: 30px 0 24px; font-size: 19px; font-weight: 900; text-transform: uppercase; }
      .body h2 { font-size: 17px; margin: 0 0 18px; letter-spacing: .5px; }
      .body pre { white-space: pre-wrap; font: 16px/1.7 Arial, Helvetica, sans-serif; margin: 0 0 24px; }
      .body { flex: 1 0 auto; }
      .result-table { width: 100%; border-collapse: collapse; margin: 0 0 30px; font-size: 14px; table-layout: fixed; page-break-inside: auto; }
      .result-table tr { page-break-inside: avoid; page-break-after: auto; }
      .result-table th, .result-table td { border: 1px solid #cbd5e1; padding: 7px 9px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
      .result-table th { background: #eef2f7; font-weight: 900; }
      .footer { margin-top: auto; padding-top: 18px; display: grid; grid-template-columns: 1fr 1fr 1fr; align-items: end; color: #111827; font-size: 11px; page-break-inside: avoid; }
      .footer .center { text-align: center; }
      .footer .right { text-align: right; }
      .clinic-footer { margin-top: 12px; color: #4b5563; font-size: 10px; line-height: 1.25; text-align: center; page-break-inside: avoid; }
      .strip { margin: 16px -34px 0; height: 26px; background: #4b2d70; color: #fff; text-align: center; font-size: 11px; line-height: 26px; page-break-inside: avoid; }
      @media print { .sheet { width: auto; min-height: calc(100vh - 24mm); margin: 0; padding-top: 12px; } }
    </style>
  </head>
  <body>
    <main class="sheet">
      <div class="watermark">${watermarkUrl ? `<img src="${escapeHtml(watermarkUrl)}" alt="" />` : ""}</div>
      <section class="top">
        <div class="brand">${escapeHtml(headerTitle)}<small>Digital</small></div>
        <div class="logo">${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Clinic logo" />` : ""}</div>
        <div class="clinic">${escapeHtml(clinicName)}<small>${escapeHtml(headerSubtitle)}</small></div>
      </section>
      <h1>Department of ${escapeHtml(readReportField(record, ["department", "Department", "category", "Category"], "Laboratory"))}</h1>
      <section class="meta">
        <div><b>Patient Name</b><span>:</span><span>${escapeHtml(patientName)}</span></div>
        <div><b>Age / Gender</b><span>:</span><span>${escapeHtml(ageGender)}</span></div>
        <div><b>Bill No / UMR No</b><span>:</span><span>${escapeHtml(`${getReportId(record)} / ${patientCode}`)}</span></div>
        <div><b>Referred By</b><span>:</span><span>${escapeHtml(referredBy)}</span></div>
        <div><b>Received Dt</b><span>:</span><span>${escapeHtml(formatDateTime(receivedAt))}</span></div>
        <div><b>Report Date</b><span>:</span><span>${escapeHtml(formatDateTime(reportedAt))}</span></div>
      </section>
      <section class="body">
        <div class="report-title">${escapeHtml(reportName)}</div>
        ${reportRows.length ? `
          <table class="result-table">
            <thead><tr><th>Parameter</th><th>Result</th><th>Unit</th><th>Reference Range</th></tr></thead>
            <tbody>
              ${reportRows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.value)}</td><td>${escapeHtml(row.unit)}</td><td>${escapeHtml(row.referenceRange)}</td></tr>`).join("")}
            </tbody>
          </table>
        ` : ""}
        ${showNarrative ? `<h2>FINDINGS :</h2><pre>${escapeHtml(findings)}</pre>` : ""}
        ${showNarrative && impression ? `<h2>IMPRESSION :</h2><pre>${escapeHtml(impression)}</pre>` : ""}
      </section>
      <section class="footer">
        <div>Printed By : ${escapeHtml(profile.name || "Lab")}</div>
        <div class="center">Printed On : ${escapeHtml(printedAt)}</div>
        <div class="right">Page 1 of 1</div>
      </section>
      <div class="clinic-footer">${escapeHtml(clinicFooterDetails || `${clinicName}${profile.branchName ? `, ${profile.branchName}` : ""}`)}</div>
      <div class="strip">${escapeHtml(clinicName)}${profile.branchName ? `, ${escapeHtml(profile.branchName)}` : ""}</div>
    </main>
    ${autoPrint ? "<script>window.onload = () => { window.print(); };</script>" : ""}
  </body>
</html>`;
};

export const printLabReport = (options = {}) => {
  const printWindow = window.open("", "_blank", "width=860,height=980");
  if (!printWindow) return false;
  printWindow.document.write(buildLabReportHtml({ ...options, autoPrint: true }));
  printWindow.document.close();
  return true;
};

export const downloadLabReportHtml = (options = {}) => {
  const html = buildLabReportHtml({ ...options, autoPrint: false });
  const reportName = getReportName(options.record).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "lab-report";
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${reportName}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
