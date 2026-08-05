import { buildLabReportHtml } from "./labReportTemplate";

export const LAB_GENERATED_REPORTS_KEY = "labGeneratedReports";

export const readGeneratedLabReports = () => {
  try {
    const rows = JSON.parse(localStorage.getItem(LAB_GENERATED_REPORTS_KEY) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
};

export const saveGeneratedLabReport = (report = {}) => {
  const reportId = report.reportId || report.ReportId || `${report.patientId || report.PatientId || report.patientName || "patient"}-${report.reportName || report.testName || "report"}-${Date.now()}`;
  const nextReport = {
    ...report,
    sourceOrderId: report.sourceOrderId || report.id || report.Id || report.orderId || report.OrderId || "",
    id: reportId,
    Id: reportId,
    reportId,
    ReportId: report.ReportId || reportId,
    source: "lab-generated-report",
    __sourcePath: "labGeneratedReports",
  };
  const current = readGeneratedLabReports();
  const nextRows = [
    nextReport,
    ...current.filter((row) => String(row.reportId || row.ReportId || row.id) !== String(reportId)),
  ].slice(0, 500);
  localStorage.setItem(LAB_GENERATED_REPORTS_KEY, JSON.stringify(nextRows));
  window.dispatchEvent(new Event("labReportsUpdated"));
  return nextReport;
};

export const deleteGeneratedLabReport = (report = {}) => {
  const reportId = String(report.reportId || report.ReportId || report.id || report.Id || "").trim();
  if (!reportId) return false;
  const nextRows = readGeneratedLabReports().filter((row) =>
    String(row.reportId || row.ReportId || row.id || row.Id || "").trim() !== reportId
  );
  localStorage.setItem(LAB_GENERATED_REPORTS_KEY, JSON.stringify(nextRows));
  window.dispatchEvent(new Event("labReportsUpdated"));
  return true;
};

export const buildGeneratedReportDocument = ({ report, branding, clinicName, profile }) =>
  buildLabReportHtml({ record: report, branding, clinicName, profile, autoPrint: false });
