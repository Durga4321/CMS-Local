import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, FileImage, FileText, Printer, Save, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { downloadBlob, parseList, requestJson } from "./labApi";
import { getLabProfile } from "./labSession";
import { getClinicDisplayName } from "../utils/clinicDisplay";
import { getClinicInvoiceBranding } from "../utils/clinicBranding";
import {
  dedupeBillingRows,
} from "../utils/billingRevenue";
import { buildLabReportHtml, printLabReport, readReportField } from "./labReportTemplate";
import { fetchLabMasterTests } from "../utils/labMaster";
import { canUseModulePermission, useRolePermissionsSync } from "../utils/rolePermissions";
import LabToast from "./LabToast";

const readFirst = readReportField;
const normalizeText = (value) => String(value ?? "").trim().toLowerCase();
const normalizeId = (value) => String(value ?? "").trim();
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const filmAsset = (fileName = "") => `${process.env.PUBLIC_URL || ""}/sample-films/${fileName}`;

const getReferenceFilm = (testName = "") => {
  const name = normalizeText(testName);
  if (/brain|head|skull/.test(name) && /ct/.test(name)) return { url: filmAsset("ct-brain.jpg"), fileName: "brain-ct-film.jpg" };
  if (/abdomen|abdominal|abdomene/.test(name) && /ct/.test(name)) return { url: filmAsset("ct-abdomen.jpg"), fileName: "abdomen-ct-film.jpg" };
  if (/chest|thorax/.test(name) && /ct/.test(name)) return { url: filmAsset("ct-chest.jpg"), fileName: "chest-ct-film.jpg" };
  if (/hand|wrist|finger|palm/.test(name)) return { url: filmAsset("xray-hand.jpg"), fileName: "hand-xray-film.jpg" };
  if (/chest|thorax/.test(name)) return { url: filmAsset("xray-chest.jpg"), fileName: "chest-xray-film.jpg" };
  if (/ct/.test(name)) return { url: filmAsset("ct-chest.jpg"), fileName: "ct-film.jpg" };
  return { url: filmAsset("xray-chest-alt.jpg"), fileName: "xray-film.jpg" };
};

const getLineItems = (record = {}) => {
  const keys = ["items", "Items", "serviceItems", "ServiceItems", "billItems", "BillItems", "tests", "Tests"];
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key];
  }
  return [];
};

const getPatientTestNames = (record = {}) => {
  const direct = readFirst(record, ["testName", "TestName", "labTestName", "LabTestName", "diagnosisTests", "DiagnosisTests"], "");
  const items = getLineItems(record).map((item) => readFirst(item, ["testName", "TestName", "labTestName", "item", "name", "Name"], ""));
  return Array.from(new Set([...String(direct || "").split(","), ...items].map((name) => name.trim()).filter(Boolean))).join(", ") || "-";
};

const getPatientName = (record = {}) =>
  readFirst(record, ["patientName", "PatientName", "patient.name", "Patient.Name", "name", "Name"], "Patient");

const getPatientBloodGroup = (record = {}) =>
  readFirst(record, ["bloodGroup", "BloodGroup", "blood_group", "patient.bloodGroup", "Patient.BloodGroup"], "");

const getPatientKey = (record = {}) =>
  [
    readFirst(record, ["patientId", "PatientId", "patient.id", "Patient.Id"], ""),
    getPatientName(record),
    readFirst(record, ["phone", "Phone", "mobile", "Mobile", "patient.phone"], ""),
  ].map((value) => normalizeId(value)).filter(Boolean).join("|") || getPatientName(record);

const splitTestNames = (record = {}) =>
  Array.from(new Set(getPatientTestNames(record).split(",").map((name) => name.trim()).filter((name) => name && name !== "-")));

const slug = (value) => normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const isBloodTest = (testName = "") => /blood|cbc|complete blood|hemogram|haemogram|platelet|hb|wbc|rbc|ns1|malaria|dengue|rt-pcr|culture|biochem|pathology|glucose|lipid|thyroid|lft|kft|creatinine|urea|urine/i.test(testName);
const isScanTest = (testName = "") => /scan|x-ray|xray|ray|ultra|usg|ct|mri|echo|angiogram|doppler|radiology|sonography/i.test(testName);
const isPftTest = (testName = "") => /pft|pulmonary|spirometry/i.test(testName);

const FIELD_PRESETS = {
  hemoglobin: { value: "13.5", referenceRange: "Male 13.0-17.0, Female 12.0-15.0" },
  rbc: { value: "4.8", referenceRange: "4.5-5.5" },
  wbc: { value: "7600", referenceRange: "4000-11000" },
  platelets: { value: "2.5", referenceRange: "1.5-4.5" },
  neutrophils: { value: "60", referenceRange: "40-75" },
  lymphocytes: { value: "32", referenceRange: "20-45" },
  totalCholesterol: { value: "170", referenceRange: "< 200" },
  hdl: { value: "45", referenceRange: "> 40" },
  ldl: { value: "95", referenceRange: "< 100" },
  triglycerides: { value: "120", referenceRange: "< 150" },
  t3: { value: "110", referenceRange: "80-180" },
  t4: { value: "8.0", referenceRange: "4.5-12.5" },
  tsh: { value: "2.5", referenceRange: "0.4-4.0" },
  bilirubin: { value: "0.8", referenceRange: "0.2-1.2" },
  sgot: { value: "28", referenceRange: "Up to 40" },
  sgpt: { value: "30", referenceRange: "Up to 40" },
  alkalinePhosphatase: { value: "90", referenceRange: "44-147" },
  urea: { value: "28", referenceRange: "15-40" },
  creatinine: { value: "0.9", referenceRange: "0.6-1.3" },
  uricAcid: { value: "5.0", referenceRange: "3.5-7.2" },
  glucose: { value: "92", referenceRange: "70-110" },
  fev1: { value: "85", referenceRange: ">= 80% predicted" },
  fvc: { value: "88", referenceRange: ">= 80% predicted" },
  fev1Fvc: { value: "78", referenceRange: ">= 70%" },
  pefr: { value: "420", referenceRange: "Age/height predicted" },
};

const withPreset = (field) => ({ ...FIELD_PRESETS[field.key], ...field });

const buildDefaultsFromFields = (fields = [], base = {}) =>
  fields.reduce((defaults, field) => {
    if (field.defaultValue !== undefined) defaults[field.key] = field.defaultValue;
    else if (FIELD_PRESETS[field.key]?.value !== undefined) defaults[field.key] = FIELD_PRESETS[field.key].value;
    return defaults;
  }, { ...base });

const getTestTemplate = (testName = "", masterTest = {}) => {
  const masterCategory = readFirst(masterTest, ["category", "Category", "department", "Department"], "");
  const masterUnit = readFirst(masterTest, ["unit", "Unit"], "");
  const masterRange = readFirst(masterTest, ["referenceRange", "ReferenceRange", "normalRange", "NormalRange"], "");
  const masterSample = readFirst(masterTest, ["sampleType", "SampleType", "sample", "Sample"], "");

  if (isScanTest(testName)) {
    return {
      type: "scan",
      department: /x-?ray|ct|mri|scan|ultra|usg|radiology/i.test(testName) ? "Radiology" : "Laboratory",
      fields: [
        { key: "filmNo", label: "Film No", type: "text", auto: false },
        { key: "view", label: "View / Region", type: "text", auto: false },
        { key: "filmTaken", label: "Film Taken", type: "select", options: ["Yes", "No"] },
        { key: "findings", label: "Findings", type: "textarea", rows: 6 },
        { key: "impression", label: "Impression", type: "textarea", rows: 3 },
      ],
      defaults: { filmTaken: "Yes", view: testName, findings: "No obvious abnormality detected.", impression: "Normal study." },
    };
  }

  if (isPftTest(testName)) {
    return {
      type: "pft",
      department: "Pulmonology",
      fields: [
        withPreset({ key: "fev1", label: "FEV1", type: "text", unit: "% predicted" }),
        withPreset({ key: "fvc", label: "FVC", type: "text", unit: "% predicted" }),
        withPreset({ key: "fev1Fvc", label: "FEV1/FVC", type: "text", unit: "%" }),
        withPreset({ key: "pefr", label: "PEFR", type: "text", unit: "L/min" }),
        { key: "result", label: "Result", type: "select", options: ["Normal", "Obstructive", "Restrictive", "Mixed"] },
        { key: "impression", label: "Impression", type: "textarea", rows: 3 },
      ],
      defaults: buildDefaultsFromFields([
        { key: "fev1" },
        { key: "fvc" },
        { key: "fev1Fvc" },
        { key: "pefr" },
      ], { result: "Normal", impression: "Pulmonary function is within expected limits." }),
    };
  }

  if (isBloodTest(testName)) {
    const lowerName = normalizeText(testName);
    const cbcFields = /cbc|complete blood|hemogram|haemogram/i.test(testName)
      ? [
          withPreset({ key: "hemoglobin", label: "Hemoglobin", type: "text", unit: "g/dL" }),
          withPreset({ key: "rbc", label: "RBC Count", type: "text", unit: "million/cumm" }),
          withPreset({ key: "wbc", label: "WBC Count", type: "text", unit: "/cumm" }),
          withPreset({ key: "platelets", label: "Platelet Count", type: "text", unit: "lakh/cumm" }),
          withPreset({ key: "neutrophils", label: "Neutrophils", type: "text", unit: "%" }),
          withPreset({ key: "lymphocytes", label: "Lymphocytes", type: "text", unit: "%" }),
        ]
      : [];
    const lipidFields = /lipid|cholesterol|triglycer/i.test(testName)
      ? [
          withPreset({ key: "totalCholesterol", label: "Total Cholesterol", type: "text", unit: "mg/dL" }),
          withPreset({ key: "hdl", label: "HDL Cholesterol", type: "text", unit: "mg/dL" }),
          withPreset({ key: "ldl", label: "LDL Cholesterol", type: "text", unit: "mg/dL" }),
          withPreset({ key: "triglycerides", label: "Triglycerides", type: "text", unit: "mg/dL" }),
        ]
      : [];
    const thyroidFields = /thyroid|t3|t4|tsh/i.test(testName)
      ? [
          withPreset({ key: "t3", label: "T3", type: "text", unit: "ng/dL" }),
          withPreset({ key: "t4", label: "T4", type: "text", unit: "ug/dL" }),
          withPreset({ key: "tsh", label: "TSH", type: "text", unit: "uIU/mL" }),
        ]
      : [];
    const liverFields = /lft|liver|bilirubin|sgot|sgpt/i.test(testName)
      ? [
          withPreset({ key: "bilirubin", label: "Bilirubin Total", type: "text", unit: "mg/dL" }),
          withPreset({ key: "sgot", label: "SGOT / AST", type: "text", unit: "U/L" }),
          withPreset({ key: "sgpt", label: "SGPT / ALT", type: "text", unit: "U/L" }),
          withPreset({ key: "alkalinePhosphatase", label: "Alkaline Phosphatase", type: "text", unit: "U/L" }),
        ]
      : [];
    const kidneyFields = /kft|kidney|creatinine|urea|uric/i.test(testName)
      ? [
          withPreset({ key: "urea", label: "Urea", type: "text", unit: "mg/dL" }),
          withPreset({ key: "creatinine", label: "Creatinine", type: "text", unit: "mg/dL" }),
          withPreset({ key: "uricAcid", label: "Uric Acid", type: "text", unit: "mg/dL" }),
        ]
      : [];
    const glucoseFields = /glucose|sugar|fbs|ppbs|hba1c/i.test(testName)
      ? [
          withPreset({ key: "glucose", label: lowerName.includes("hba1c") ? "HbA1c" : "Glucose", type: "text", unit: lowerName.includes("hba1c") ? "%" : "mg/dL", referenceRange: lowerName.includes("hba1c") ? "4.0-5.6" : FIELD_PRESETS.glucose.referenceRange, defaultValue: lowerName.includes("hba1c") ? "5.4" : FIELD_PRESETS.glucose.value }),
        ]
      : [];
    const masterValueField = !cbcFields.length && !lipidFields.length && !thyroidFields.length && !liverFields.length && !kidneyFields.length && !glucoseFields.length && masterUnit
      ? [{ key: "value", label: "Observed Value", type: "text", unit: masterUnit, referenceRange: masterRange }]
      : [];

    const fields = [
      { key: "sampleType", label: "Sample Type", type: "text", auto: true, defaultValue: masterSample || "Blood" },
      { key: "bloodGroup", label: "Blood Group", type: "text" },
      { key: "result", label: "Result", type: "select", options: ["Negative", "Positive", "Normal", "Abnormal"], defaultValue: "Negative" },
      ...cbcFields,
      ...lipidFields,
      ...thyroidFields,
      ...liverFields,
      ...kidneyFields,
      ...glucoseFields,
      ...masterValueField,
      { key: "remarks", label: "Remarks", type: "textarea", rows: 3, defaultValue: "Clinical correlation advised." },
    ];

    return {
      type: "blood",
      department: masterCategory || "Pathology",
      fields,
      defaults: buildDefaultsFromFields(fields),
    };
  }

  const fields = [
    { key: "sampleType", label: "Sample Type", type: "text", auto: true, defaultValue: masterSample || "" },
    ...(masterUnit || masterRange ? [{ key: "value", label: "Observed Value", type: "text", unit: masterUnit, referenceRange: masterRange }] : []),
    { key: "result", label: "Result", type: "select", options: ["Normal", "Abnormal", "Positive", "Negative"], defaultValue: "Normal" },
    { key: "findings", label: "Findings", type: "textarea", rows: 5, defaultValue: "Report values are within expected limits." },
    { key: "impression", label: "Impression", type: "textarea", rows: 3, defaultValue: "Normal report." },
  ];

  return {
    type: "general",
    department: masterCategory || "Laboratory",
    fields,
    defaults: buildDefaultsFromFields(fields),
  };
};

const buildFindingsFromFields = (template, values = {}) =>
  template.fields
    .filter((field) => !["impression"].includes(field.key))
    .map((field) => {
      const value = String(values[field.key] ?? "").trim();
      if (!value) return "";
      return `${field.label}: ${value}${field.unit ? ` ${field.unit}` : ""}${field.referenceRange ? ` (Ref: ${field.referenceRange})` : ""}`;
    })
    .filter(Boolean)
    .join("\n");

const pdfEscape = (value) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const wrapPdfLine = (value = "", maxLength = 92) => {
  const words = String(value || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines;
};

const buildPdfBlob = ({ title = "Lab Report", lines = [] } = {}) => {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 42;
  const lineHeight = 15;
  const maxLinesPerPage = 48;
  const normalizedLines = lines.flatMap((line) => wrapPdfLine(line, 88));
  const chunks = [];
  for (let index = 0; index < normalizedLines.length; index += maxLinesPerPage) {
    chunks.push(normalizedLines.slice(index, index + maxLinesPerPage));
  }
  if (!chunks.length) chunks.push([""]);

  const objects = [
    "",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const pageRefs = [];
  chunks.forEach((chunk, pageIndex) => {
    const bodyLines = [
      "BT",
      "/F1 16 Tf",
      `${marginX} ${pageHeight - 46} Td`,
      `(${pdfEscape(title)}) Tj`,
      "/F1 10 Tf",
      `0 -${lineHeight + 10} Td`,
      ...chunk.flatMap((line) => [`(${pdfEscape(line)}) Tj`, `0 -${lineHeight} Td`]),
      `0 -${lineHeight} Td`,
      `(Page ${pageIndex + 1} of ${chunks.length}) Tj`,
      "ET",
    ].join("\n");
    objects.push(`<< /Length ${bodyLines.length} >>\nstream\n${bodyLines}\nendstream`);
    const contentRef = objects.length;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentRef} 0 R >>`);
    const pageRef = objects.length;
    pageRefs.push(pageRef);
  });

  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((content, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${content}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
};

const buildReportKey = (record, testName) => `${recordId(record)}::${slug(testName)}`;

const getRecordClinicId = (record = {}) =>
  normalizeId(readFirst(record, ["hospitalId", "HospitalId", "clinicId", "ClinicId", "patient.hospitalId", "patient.clinicId"], ""));

const getRecordBranchId = (record = {}) =>
  normalizeId(readFirst(record, ["branchId", "BranchId", "clinicBranchId", "ClinicBranchId", "patient.branchId", "patient.clinicBranchId"], ""));

const getRecordBranchName = (record = {}) =>
  normalizeText(readFirst(record, ["branchName", "BranchName", "branch.name", "patient.branchName"], ""));

const belongsToLabScope = (record = {}, profile = getLabProfile()) => {
  const clinicId = normalizeId(profile.hospitalId);
  const branchId = normalizeId(profile.branchId);
  const branchName = normalizeText(profile.branchName);
  const recordClinicId = getRecordClinicId(record);
  const recordBranchId = getRecordBranchId(record);
  const recordBranchName = getRecordBranchName(record);
  if (clinicId && recordClinicId && recordClinicId !== clinicId) return false;
  if (branchId && recordBranchId && recordBranchId !== branchId) return false;
  if (branchName && !recordBranchId && recordBranchName && recordBranchName !== branchName) return false;
  return true;
};

const isDiagnosticRecord = (record = {}) => {
  const source = normalizeText(record.__sourcePath);
  const typeText = normalizeText(readFirst(record, ["billingType", "BillingType", "invoiceType", "InvoiceType", "serviceType", "ServiceType", "type", "Type"], ""));
  const labAmount = Number(readFirst(record, ["labCharges", "labCharge", "diagnosticRevenue"], 0)) || 0;
  return source.includes("lab/orders") || source.includes("diagnostic") || /diagnostic|diagnosis|lab|test/.test(typeText) || labAmount > 0;
};

const isGeneratedReport = (record = {}) =>
  /reported|delivered/.test(normalizeText(readFirst(record, ["status", "Status", "reportStatus"], ""))) ||
  Boolean(readFirst(record, ["reportName", "ReportName", "findings", "Findings", "reportFindings"], ""));

const recordId = (record = {}) =>
  readFirst(record, ["id", "Id", "orderId", "OrderId", "labOrderId", "LabOrderId", "billingId", "BillingId", "billId", "BillId", "invoiceId", "InvoiceId"], "");

const fetchReportSourceRows = async () => {
  const paths = ["Lab/orders"];
  const results = await Promise.allSettled(paths.map((path) => requestJson(path)));
  return results.flatMap((result, index) =>
    result.status === "fulfilled"
      ? parseList(result.value).map((row) => ({ ...row, __sourcePath: paths[index] }))
      : []
  );
};

const buildFilmHtml = ({ record = {}, filmUrl = "", filmName = "", clinicName = "Clinic", profile = {} } = {}) => {
  const patientName = getPatientName(record);
  const testName = readFirst(record, ["reportName", "ReportName", "testName", "TestName"], "Scan Film");
  const patientCode = readFirst(record, ["patientId", "PatientId", "patient.id", "Patient.Id"], "-");
  const referredBy = readFirst(record, ["doctorName", "DoctorName", "referredBy", "ReferredBy", "doctor.name", "Doctor.Name"], "-");
  const dateText = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const isPdf = /\.pdf$/i.test(filmName);

  return `<!doctype html>
<html>
  <head>
    <title>${escapeHtml(testName)} Film - ${escapeHtml(patientName)}</title>
    <style>
      @page { size: A4; margin: 10mm; }
      body { margin: 0; background: #fff; color: #111827; font-family: Arial, Helvetica, sans-serif; }
      .sheet { min-height: 1080px; padding: 18px 24px 46px; box-sizing: border-box; position: relative; background: #fff; }
      .head { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1f2937; padding-bottom: 10px; }
      .head h1 { margin: 0; font-size: 28px; color: #1d4f91; }
      .head span { font-size: 13px; color: #4b5563; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 22px; margin: 14px 0 0; padding: 12px; border: 1px solid #334155; font-size: 14px; background: #fff; }
      .meta div { display: grid; grid-template-columns: 110px 10px 1fr; gap: 4px; }
      .meta b { font-weight: 900; }
      .film-title { margin: 12px 0 10px; font-size: 18px; font-weight: 900; text-transform: uppercase; }
      .film-box { height: 740px; border: 2px solid #020617; display: grid; place-items: center; background: #050505; overflow: hidden; }
      .film-box img { width: 100%; height: 100%; object-fit: contain; filter: brightness(1.14) contrast(1.08); }
      .film-box iframe { width: 100%; height: 740px; border: 0; background: #fff; }
      .footer { position: absolute; left: 24px; right: 24px; bottom: 16px; text-align: center; color: #4b5563; font-size: 11px; border-top: 1px solid #cbd5e1; padding-top: 6px; }
    </style>
  </head>
  <body>
    <main class="sheet">
      <section class="head"><div><h1>${escapeHtml(clinicName)}</h1><span>${escapeHtml(profile.branchName || "Radiology")}</span></div><strong>FILM COPY</strong></section>
      <div class="film-title">${escapeHtml(testName)}</div>
      <section class="film-box">
        ${filmUrl ? (isPdf ? `<iframe src="${escapeHtml(filmUrl)}" title="Film PDF"></iframe>` : `<img src="${escapeHtml(filmUrl)}" alt="${escapeHtml(testName)} film" />`) : `<div style="background:#fff;padding:18px;">Film file not attached.</div>`}
      </section>
      <section class="meta">
        <div><b>Patient</b><span>:</span><span>${escapeHtml(patientName)}</span></div>
        <div><b>Patient ID</b><span>:</span><span>${escapeHtml(patientCode)}</span></div>
        <div><b>Test</b><span>:</span><span>${escapeHtml(testName)}</span></div>
        <div><b>Doctor</b><span>:</span><span>${escapeHtml(referredBy)}</span></div>
        <div><b>Film</b><span>:</span><span>${escapeHtml(filmName || "-")}</span></div>
        <div><b>Date</b><span>:</span><span>${escapeHtml(dateText)}</span></div>
      </section>
      <div class="footer">${escapeHtml(clinicName)}${profile.branchName ? `, ${escapeHtml(profile.branchName)}` : ""}</div>
    </main>
    <script>window.onload = () => window.print();</script>
  </body>
</html>`;
};

function LabReportCreate() {
  const navigate = useNavigate();
  const labProfile = useMemo(() => getLabProfile(), []);
  useRolePermissionsSync(labProfile);
  const canCreateReport = canUseModulePermission(labProfile, "Create Report", "Create");
  const clinicName = getClinicDisplayName(labProfile, "Clinic");
  const clinicBranding = getClinicInvoiceBranding({ clinicId: labProfile.hospitalId, clinicName });
  const [rows, setRows] = useState([]);
  const [labTests, setLabTests] = useState([]);
  const [selectedPatientKey, setSelectedPatientKey] = useState("");
  const [selectedReportKey, setSelectedReportKey] = useState("");
  const [form, setForm] = useState({});
  const [filmFile, setFilmFile] = useState(null);
  const [filmFileUrl, setFilmFileUrl] = useState("");
  const [filmFileName, setFilmFileName] = useState("");
  const [sampleFilmUrl, setSampleFilmUrl] = useState("");
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [previewReport, setPreviewReport] = useState(null);

  const loadRows = useCallback(async () => {
    const [backendRows, masterRows] = await Promise.all([
      fetchReportSourceRows(),
      fetchLabMasterTests().catch(() => []),
    ]);
    setLabTests(masterRows);
    const nextRows = dedupeBillingRows(backendRows)
      .filter(isDiagnosticRecord)
      .filter((row) => belongsToLabScope(row, labProfile))
      .map((row) => ({ ...row, __labTestNames: getPatientTestNames(row) }));
    setRows(nextRows);
    if (!selectedPatientKey && nextRows.length) setSelectedPatientKey(getPatientKey(nextRows[0]));
  }, [labProfile, selectedPatientKey]);

  useEffect(() => {
    loadRows().catch((loadError) => setToast({ type: "error", message: loadError.message || "Unable to load report patients." }));
  }, [loadRows]);

  useEffect(() => {
    if (!filmFile) {
      setFilmFileUrl("");
      return undefined;
    }
    const nextUrl = URL.createObjectURL(filmFile);
    setFilmFileUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [filmFile]);

  const patientOptions = useMemo(() => {
    const byPatient = new Map();
    rows.forEach((row) => {
      const key = getPatientKey(row);
      if (!byPatient.has(key)) {
        byPatient.set(key, {
          key,
          name: getPatientName(row),
          phone: readFirst(row, ["phone", "Phone", "mobile", "Mobile", "patient.phone"], "-"),
          count: 0,
        });
      }
      byPatient.get(key).count += splitTestNames(row).length || 1;
    });
    return Array.from(byPatient.values());
  }, [rows]);

  const selectedPatientRows = useMemo(
    () => rows.filter((row) => getPatientKey(row) === selectedPatientKey),
    [rows, selectedPatientKey]
  );

  const reportOptions = useMemo(
    () =>
      selectedPatientRows.flatMap((row) =>
        splitTestNames(row).map((testName) => ({
          key: buildReportKey(row, testName),
          testName,
          row,
          reported: isGeneratedReport(row) && normalizeText(readFirst(row, ["reportName", "ReportName"], "")).includes(normalizeText(testName)),
        }))
      ),
    [selectedPatientRows]
  );

  const selectedReport = useMemo(
    () => reportOptions.find((option) => option.key === selectedReportKey) || reportOptions[0] || null,
    [reportOptions, selectedReportKey]
  );

  const selectedRow = selectedReport?.row || null;
  const selectedTestName = selectedReport?.testName || "";
  const latestPatientReports = useMemo(() => {
    if (!selectedPatientKey || !selectedRow) return [];
    const patientId = normalizeId(readFirst(selectedRow, ["patientId", "PatientId", "patient.id", "Patient.Id"], ""));
    const patientName = normalizeText(getPatientName(selectedRow));
    const patientPhone = normalizeText(readFirst(selectedRow, ["phone", "Phone", "mobile", "Mobile", "patient.phone"], ""));

    return rows
      .filter((report) => {
        if (!isGeneratedReport(report)) return false;
        const reportId = normalizeId(readFirst(report, ["patientId", "PatientId", "patient.id", "Patient.Id"], ""));
        const reportName = normalizeText(getPatientName(report));
        const reportPhone = normalizeText(readFirst(report, ["phone", "Phone", "mobile", "Mobile", "patient.phone"], ""));
        return (
          (patientId && reportId && patientId === reportId) ||
          (patientPhone && reportPhone && patientPhone === reportPhone) ||
          (patientName && reportName && patientName === reportName)
        );
      })
      .sort((a, b) => new Date(readFirst(b, ["reportedAt", "reportDate", "date", "createdAt"], 0)) - new Date(readFirst(a, ["reportedAt", "reportDate", "date", "createdAt"], 0)))
      .slice(0, 6);
  }, [rows, selectedPatientKey, selectedRow]);
  const selectedMasterTest = useMemo(
    () => labTests.find((test) => normalizeText(test.testName || test.item || test.name) === normalizeText(selectedTestName)) || {},
    [labTests, selectedTestName]
  );
  const selectedTemplate = useMemo(
    () => getTestTemplate(selectedTestName, selectedMasterTest),
    [selectedMasterTest, selectedTestName]
  );

  useEffect(() => {
    if (!selectedPatientKey && patientOptions.length) setSelectedPatientKey(patientOptions[0].key);
  }, [patientOptions, selectedPatientKey]);

  useEffect(() => {
    if (!reportOptions.length) {
      setSelectedReportKey("");
      return;
    }
    if (!reportOptions.some((option) => option.key === selectedReportKey)) {
      setSelectedReportKey(reportOptions[0].key);
    }
  }, [reportOptions, selectedReportKey]);

  useEffect(() => {
    if (!selectedReport) return;
    const masterTest = labTests.find((test) => normalizeText(test.testName || test.item || test.name) === normalizeText(selectedReport.testName)) || {};
    const nextTemplate = getTestTemplate(selectedReport.testName, masterTest);
    const isScan = nextTemplate.type === "scan";
    const referenceFilm = isScan ? getReferenceFilm(selectedReport.testName) : { url: "", fileName: "" };
    setForm({
      ...nextTemplate.defaults,
      bloodGroup: getPatientBloodGroup(selectedReport.row) || nextTemplate.defaults.bloodGroup || "",
      reportName: selectedReport.testName,
      reportType: nextTemplate.type,
    });
    setFilmFile(null);
    setFilmFileName(referenceFilm.fileName);
    setSampleFilmUrl(referenceFilm.url);
  }, [labTests, selectedReport]);

  const buildRecord = () => ({
    ...(selectedRow || {}),
    reportId: `${recordId(selectedRow)}-${slug(selectedTestName)}`,
    ReportId: `${recordId(selectedRow)}-${slug(selectedTestName)}`,
    patientName: getPatientName(selectedRow),
    PatientName: getPatientName(selectedRow),
    patientId: readFirst(selectedRow, ["patientId", "PatientId", "patient.id", "Patient.Id"], ""),
    PatientId: readFirst(selectedRow, ["patientId", "PatientId", "patient.id", "Patient.Id"], ""),
    phone: readFirst(selectedRow, ["phone", "Phone", "mobile", "Mobile", "patient.phone"], ""),
    Phone: readFirst(selectedRow, ["phone", "Phone", "mobile", "Mobile", "patient.phone"], ""),
    bloodGroup: form.bloodGroup || getPatientBloodGroup(selectedRow),
    BloodGroup: form.bloodGroup || getPatientBloodGroup(selectedRow),
    reportName: selectedTestName,
    ReportName: selectedTestName,
    reportTitle: selectedTestName,
    testName: selectedTestName,
    TestName: selectedTestName,
    department: selectedTemplate.department,
    Department: selectedTemplate.department,
    reportType: selectedTemplate.type,
    sampleType: form.sampleType || readFirst(selectedMasterTest, ["sampleType", "SampleType"], ""),
    SampleType: form.sampleType || readFirst(selectedMasterTest, ["sampleType", "SampleType"], ""),
    referenceRange: readFirst(selectedMasterTest, ["referenceRange", "ReferenceRange", "normalRange", "NormalRange"], ""),
    ReferenceRange: readFirst(selectedMasterTest, ["referenceRange", "ReferenceRange", "normalRange", "NormalRange"], ""),
    unit: readFirst(selectedMasterTest, ["unit", "Unit"], ""),
    Unit: readFirst(selectedMasterTest, ["unit", "Unit"], ""),
    reportValues: form,
    ReportValues: form,
    reportFields: selectedTemplate.fields,
    ReportFields: selectedTemplate.fields,
    filmFileName,
    FilmFileName: filmFileName,
    filmSource: sampleFilmUrl ? "reference" : filmFile ? "uploaded" : "",
    FilmSource: sampleFilmUrl ? "reference" : filmFile ? "uploaded" : "",
    findings: buildFindingsFromFields(selectedTemplate, form),
    Findings: buildFindingsFromFields(selectedTemplate, form),
    impression: String(form.impression || form.remarks || "").trim(),
    Impression: String(form.impression || form.remarks || "").trim(),
    status: "Reported",
    Status: "Reported",
    reportStatus: "Reported",
    date: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    reportedAt: new Date().toISOString(),
    reportDate: new Date().toISOString(),
  });

  const buildGeneratedReportFile = (payload) => {
    const reportRows = Array.isArray(payload.reportFields)
      ? payload.reportFields
          .filter((field) => !["remarks", "findings", "impression"].includes(field.key))
          .map((field) => {
            const value = payload.reportValues?.[field.key];
            if (value === undefined || value === null || String(value).trim() === "") return "";
            return `${field.label || field.key}: ${value}${field.unit ? ` ${field.unit}` : ""}${field.referenceRange ? ` (Ref: ${field.referenceRange})` : ""}`;
          })
          .filter(Boolean)
      : [];
    const patientCode = readFirst(payload, ["patientCode", "PatientCode", "patientId", "PatientId"], "-");
    const ageGender = [
      readFirst(payload, ["age", "Age", "patient.age", "Patient.Age"], ""),
      readFirst(payload, ["gender", "Gender", "patient.gender", "Patient.Gender"], ""),
    ].filter(Boolean).join(" / ") || "-";
    const reportDate = new Date(payload.reportedAt || Date.now()).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return buildPdfBlob({
      title: `${payload.reportName || selectedTestName} - ${getPatientName(payload)}`,
      lines: [
        clinicName,
        `Department of ${payload.department || "Laboratory"}`,
        "",
        `Patient Name : ${getPatientName(payload)}`,
        `Patient ID   : ${patientCode}`,
        `Age / Gender : ${ageGender}`,
        `Phone        : ${payload.phone || payload.Phone || "-"}`,
        `Referred By  : ${payload.doctorName || payload.DoctorName || "-"}`,
        `Report Date  : ${reportDate}`,
        "",
        String(payload.reportName || selectedTestName || "Lab Report").toUpperCase(),
        "",
        ...reportRows,
        ...(reportRows.length ? [""] : []),
        "FINDINGS:",
        payload.findings || "-",
        "",
        "IMPRESSION:",
        payload.impression || "-",
      ],
    });
  };

  const buildReportFormData = (payload) => {
    const formData = new FormData();
    formData.append("reportName", payload.reportName || selectedTestName);
    formData.append("testName", payload.testName || selectedTestName);
    formData.append("reportType", payload.reportType || selectedTemplate.type || "");
    formData.append("findings", payload.findings || "");
    formData.append("impression", payload.impression || "");
    formData.append("status", "Reported");
    formData.append("reportStatus", "Reported");
    formData.append("reportedAt", payload.reportedAt || new Date().toISOString());
    formData.append("reportValues", JSON.stringify(payload.reportValues || {}));
    formData.append("reportFields", JSON.stringify(payload.reportFields || []));
    formData.append("reportData", JSON.stringify(payload));
    formData.append(
      "file",
      buildGeneratedReportFile(payload),
      `${slug(getPatientName(payload)) || "patient"}-${slug(payload.reportName || selectedTestName) || "lab-report"}.pdf`
    );

    if (filmFile) {
      formData.append("filmFile", filmFile, filmFile.name || filmFileName || "lab-film-file");
    }

    return formData;
  };

  const saveReport = async ({ print = false } = {}) => {
    if (!canCreateReport) {
      setToast({ type: "error", message: "You do not have permission to create reports." });
      return;
    }
    if (!selectedRow) {
      setToast({ type: "error", message: "Select a patient." });
      return;
    }
    if (!selectedTestName) {
      setToast({ type: "error", message: "Select a report/test name." });
      return;
    }
    if (!selectedRow) {
      setToast({ type: "error", message: "No patient record selected." });
      return;
    }
    if (!selectedTestName) {
      setToast({ type: "error", message: "No report/test selected." });
      return;
    }
    if (selectedTemplate.type === "scan" && !(filmFileUrl || sampleFilmUrl) && form.filmTaken === "Yes") {
      setToast({ type: "error", message: "Film is not available for this scan/X-Ray report." });
      return;
    }
    const id = recordId(selectedRow);
    const payload = buildRecord();
    setSaving(true);
    setToast(null);
    try {
      if (!id) throw new Error("Selected record has no backend id.");
      const savedReport = await requestJson(`Lab/orders/${id}/report`, {
        method: "POST",
        body: buildReportFormData(payload),
      });
      await requestJson(`Lab/orders/${id}`).catch(() => null);
      await requestJson(`Lab/orders/${id}/complete`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "Completed",
          Status: "Completed",
          orderStatus: "Completed",
          resultStatus: "Completed",
          reportStatus: "Reported",
          completedAt: new Date().toISOString(),
        }),
      }).catch(() => null);
      const previewPayload = {
        ...payload,
        ...(savedReport && typeof savedReport === "object" ? savedReport : {}),
        id,
        labOrderId: id,
        status: "Completed",
        Status: "Completed",
        reportStatus: "Reported",
      };
      setPreviewReport(previewPayload);
      window.dispatchEvent(new Event("labReportsUpdated"));
      if (print) {
        printLabReport({ record: previewPayload, branding: clinicBranding, clinicName, profile: labProfile });
      }
      setToast({ type: "success", message: print ? "Report saved to backend and print opened." : "Report saved to backend. Preview opened." });
      await loadRows().catch(() => {});
    } catch (saveError) {
      setToast({ type: "error", message: saveError.message || "Unable to save report." });
    } finally {
      setSaving(false);
    }
  };

  const printPreviewReport = () => {
    if (!previewReport) return;
    printLabReport({ record: previewReport, branding: clinicBranding, clinicName, profile: labProfile });
    setToast({ type: "success", message: "Report print opened." });
  };

  const downloadReport = async (report = previewReport) => {
    const id = recordId(report);
    if (!id) {
      setToast({ type: "error", message: "Report download needs a backend order id." });
      return;
    }
    try {
      await downloadBlob(`Lab/orders/${id}/report/download`, `lab-report-${id}`);
      setToast({ type: "success", message: "Report downloaded." });
    } catch (downloadError) {
      setToast({ type: "error", message: downloadError.message || "Unable to download report." });
    }
  };

  const printFilm = () => {
    const activeFilmUrl = filmFileUrl || sampleFilmUrl;
    if (!selectedRow || !activeFilmUrl) return;
    const filmWindow = window.open("", "_blank", "width=860,height=980");
    if (!filmWindow) return;
    filmWindow.document.write(buildFilmHtml({
      record: { ...selectedRow, reportName: selectedTestName, testName: selectedTestName },
      filmUrl: activeFilmUrl,
      filmName: filmFileName || `${slug(selectedTestName) || "scan"}-sample-film.svg`,
      clinicName,
      profile: labProfile,
    }));
    filmWindow.document.close();
    setToast({ type: "success", message: "Film print opened." });
  };

  const downloadFilm = () => {
    const activeFilmUrl = filmFileUrl || sampleFilmUrl;
    const activeFilmName = filmFileName || `${slug(selectedTestName) || "scan"}-film.jpg`;
    if (!activeFilmUrl) return;
    const link = document.createElement("a");
    link.href = activeFilmUrl;
    link.download = activeFilmName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setToast({ type: "success", message: "Film downloaded." });
  };

  return (
    <section className="rc-page lab-page">
      <div className="rc-page-head">
        <div>
          <h2>Create Report</h2>
          <p>Create lab reports for diagnostic patients and save them to backend.</p>
        </div>
      </div>
      <LabToast toast={toast} onClose={() => setToast(null)} />
      <div className="rc-card lab-report-form-card">
        <div className="rc-form-grid">
          <label className="rc-form-field-full">
            Patient
            <select value={selectedPatientKey} onChange={(event) => setSelectedPatientKey(event.target.value)}>
              {patientOptions.map((patient) => (
                <option value={patient.key} key={patient.key}>
                  {patient.name} {patient.phone && patient.phone !== "-" ? `- ${patient.phone}` : ""} ({patient.count} tests)
                </option>
              ))}
            </select>
          </label>
          <label className="rc-form-field-full">
            Report Name
            <select value={selectedReportKey} onChange={(event) => setSelectedReportKey(event.target.value)} disabled={!selectedPatientKey}>
              {reportOptions.map((report) => (
                <option value={report.key} key={report.key}>
                  {report.testName} {report.reported ? "(reported)" : ""}
                </option>
              ))}
            </select>
          </label>
          {selectedTemplate.type === "scan" ? (
            <label className="rc-form-field-full">
              Film / Scan Image
              <span className="lab-upload-control lab-film-ready">
                <FileImage size={16} />
                <b>{filmFileName || "Film pending from scan machine"}</b>
              </span>
              <small className="lab-field-hint">Film is available after scan/X-Ray completion. Final written report can be saved after review.</small>
              <span className="lab-film-actions">
                <button className="rc-btn ghost" type="button" onClick={downloadFilm} disabled={!(filmFileUrl || sampleFilmUrl)}><Download size={16} /> Download Film</button>
                <button className="rc-btn" type="button" onClick={printFilm} disabled={!(filmFileUrl || sampleFilmUrl)}><Printer size={16} /> Print Film</button>
              </span>
            </label>
          ) : null}

          {selectedTemplate.fields.map((field) => (
            <label className="rc-form-field-full" key={field.key}>
              {field.label}{field.unit ? ` (${field.unit})` : ""}
              {field.type === "textarea" ? (
                <textarea
                  value={form[field.key] || ""}
                  onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  rows={field.rows || 4}
                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                />
              ) : field.type === "select" ? (
                <select value={form[field.key] || ""} onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}>
                  {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <input value={form[field.key] || ""} onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))} />
              )}
              {field.referenceRange ? <small className="lab-field-hint">Reference: {field.referenceRange}</small> : null}
            </label>
          ))}
        </div>
        <div className="lab-page-actions">
          {canCreateReport ? (
            <>
              <button className="rc-btn primary" type="button" onClick={() => saveReport()} disabled={saving}><Save size={16} /> Save Report</button>
              <button className="rc-btn" type="button" onClick={() => saveReport({ print: true })} disabled={saving}><Printer size={16} /> Save & Print</button>
            </>
          ) : null}
          <button className="rc-btn ghost" type="button" onClick={() => navigate("/lab/reports")}><FileText size={16} /> Reports</button>
        </div>
        {latestPatientReports.length ? (
          <div className="lab-latest-reports">
            <div className="lab-latest-reports-head">
              <h3>Latest Reports</h3>
              <span>{getPatientName(selectedRow)}</span>
            </div>
            <div className="lab-latest-report-list">
              {latestPatientReports.map((report) => (
                <div className="lab-latest-report-row" key={readFirst(report, ["reportId", "ReportId", "id", "Id"], `${readFirst(report, ["reportName", "ReportName"], "report")}-${readFirst(report, ["reportedAt", "createdAt"], "")}`)}>
                  <div>
                    <b>{readFirst(report, ["reportName", "ReportName", "testName", "TestName"], "Lab Report")}</b>
                    <span>{new Date(readFirst(report, ["reportedAt", "reportDate", "date", "createdAt"], new Date())).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="lab-row-actions">
                    <button className="lab-action-btn report" type="button" title="Preview report" onClick={() => setPreviewReport(report)}><Eye size={16} /></button>
                    <button className="lab-action-btn report" type="button" title="Print report" onClick={() => printLabReport({ record: report, branding: clinicBranding, clinicName, profile: labProfile })}><Printer size={16} /></button>
                    <button className="lab-action-btn download" type="button" title="Download report" onClick={() => downloadReport(report)}><Download size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {previewReport ? (
        <div className="lab-report-preview-overlay" role="dialog" aria-modal="true">
          <div className="lab-report-preview-card">
            <div className="lab-report-preview-header">
              <div>
                <h3>Report Preview</h3>
                <p>{readFirst(previewReport, ["patientName", "PatientName"], "Patient")} - {readFirst(previewReport, ["reportName", "ReportName", "testName", "TestName"], "Lab Report")}</p>
              </div>
              <button type="button" onClick={() => setPreviewReport(null)} aria-label="Close preview"><X size={18} /></button>
            </div>
            <iframe
              className="lab-report-preview-frame"
              title="Lab report preview"
              srcDoc={buildLabReportHtml({ record: previewReport, branding: clinicBranding, clinicName, profile: labProfile, autoPrint: false })}
            />
            <div className="lab-report-preview-footer">
              <button className="rc-btn ghost" type="button" onClick={() => setPreviewReport(null)}>Close</button>
              <button className="rc-btn" type="button" onClick={() => navigate("/lab/reports")}><FileText size={16} /> Reports</button>
              <button className="rc-btn" type="button" onClick={() => downloadReport()}><Download size={16} /> Download</button>
              <button className="rc-btn primary" type="button" onClick={printPreviewReport}><Printer size={16} /> Print</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default LabReportCreate;
