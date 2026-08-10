import { BILLING_API_PATHS } from "../config/api";

export const parseList = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  for (const key of [
    "data",
    "items",
    "result",
    "results",
    "records",
    "reports",
    "billing",
    "billings",
    "bills",
    "invoices",
    "appointments",
  ]) {
    if (Array.isArray(value[key])) return value[key];
  }

  for (const key of ["data", "result", "results"]) {
    const nested = value[key];
    if (nested && typeof nested === "object") {
      const rows = parseList(nested);
      if (rows.length) return rows;
    }
  }

  return [];
};

export const toNumber = (value) => {
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : 0;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export const pick = (source = {}, keys = [], fallback = "") => {
  for (const key of keys) {
    const value = String(key)
      .split(".")
      .reduce((current, part) => (current && current[part] !== undefined ? current[part] : undefined), source);
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return fallback;
};

export const getRevenueAmount = (row = {}) =>
  toNumber(
    pick(
      row,
      [
        "totalAmount",
        "grandTotal",
        "netAmount",
        "payableAmount",
        "paymentAmount",
        "paidAmount",
        "revenue",
        "Revenue",
        "totalRevenue",
        "TotalRevenue",
        "Total Revenue",
        "total revenue",
        "netRevenue",
        "NetRevenue",
        "Net Revenue",
        "net revenue",
        "amount",
        "Amount",
        "total",
        "Total",
        "consultationCharge",
        "consultationFee",
      ],
      0
    )
  );

export const getCgstAmount = (row = {}) =>
  toNumber(pick(row, ["cgstAmount", "CGSTAmount", "CGST Amount", "cgst amount", "cgst", "CGST"], 0));

export const getSgstAmount = (row = {}) =>
  toNumber(pick(row, ["sgstAmount", "SGSTAmount", "SGST Amount", "sgst amount", "sgst", "SGST"], 0));

export const getGstAmount = (row = {}) => {
  const direct = toNumber(pick(row, ["gstAmount", "GSTAmount", "totalGst", "TotalGst", "Total GST", "total GST", "GST", "taxAmount", "TaxAmount"], 0));
  if (direct) return direct;
  return getCgstAmount(row) + getSgstAmount(row);
};

export const getRowDate = (row = {}) =>
  pick(row, [
    "createdAt",
    "CreatedAt",
    "createdOn",
    "CreatedOn",
    "paidAt",
    "PaidAt",
    "paymentDate",
    "PaymentDate",
    "invoiceDate",
    "InvoiceDate",
    "billDate",
    "BillDate",
    "date",
    "Date",
    "appointmentDate",
    "AppointmentDate",
  ], "");

export const getMonthLabel = (value, index = 0) => {
  if (!value) return `Item ${index + 1}`;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};

export const getMonthSortKey = (value) => {
  const parsed = new Date(value || "");
  if (Number.isNaN(parsed.getTime())) return String(value || "");
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
};

export const getBillingType = (row = {}) => {
  const rawType = String(
    pick(row, ["invoiceType", "billingType", "type", "serviceType", "category", "BillingType", "InvoiceType"], "")
  ).toLowerCase();
  const consultation = toNumber(pick(row, ["consultationCharge", "consultationCharges", "consultationFee", "opCharge", "opCharges", "opRevenue", "OPRevenue", "OP Revenue", "op revenue"], 0));
  const medicine = toNumber(pick(row, ["medicineCharge", "medicineCharges", "pharmacyCharge", "pharmacyCharges", "pharmacyRevenue", "PharmacyRevenue", "Pharmacy Revenue", "pharmacy revenue"], 0));
  const lab = toNumber(pick(row, ["labCharge", "labCharges", "diagnosticCharge", "diagnosticCharges", "diagnosticRevenue", "DiagnosticRevenue", "Diagnostic Revenue", "diagnostic revenue"], 0));

  if ((rawType.includes("consultation") || rawType.includes("op") || rawType.includes("patient portal")) && !rawType.includes("pharmacy") && !rawType.includes("diagnostic")) return "op";
  if (consultation > 0 && lab === 0 && medicine === 0) return "op";
  if (rawType.includes("pharmacy") || rawType.includes("medicine")) return "pharmacy";
  if (rawType.includes("diagnostic") || rawType.includes("diagnosis") || rawType.includes("lab") || rawType.includes("test")) return "diagnostic";
  if (medicine > 0 && lab === 0) return "pharmacy";
  if (lab > 0 && medicine === 0) return "diagnostic";
  return "op";
};

export const getRevenueBreakdown = (row = {}) => {
  const opAmount = toNumber(pick(row, ["opRevenue", "OPRevenue", "OP Revenue", "op revenue", "consultationCharge", "consultationCharges", "consultationFee", "opCharge", "opCharges"], 0));
  const diagnosticAmount = toNumber(pick(row, ["diagnosticRevenue", "DiagnosticRevenue", "Diagnostic Revenue", "diagnostic revenue", "labCharge", "labCharges", "diagnosticCharge", "diagnosticCharges", "testCharge", "testCharges"], 0));
  const pharmacyAmount = toNumber(pick(row, ["pharmacyRevenue", "PharmacyRevenue", "Pharmacy Revenue", "pharmacy revenue", "medicineCharge", "medicineCharges", "pharmacyCharge", "pharmacyCharges", "medicationCharges"], 0));
  const hasBreakdown = opAmount > 0 || diagnosticAmount > 0 || pharmacyAmount > 0;
  if (hasBreakdown) {
    return {
      opRevenue: opAmount,
      diagnosticRevenue: diagnosticAmount,
      pharmacyRevenue: pharmacyAmount,
      revenue: opAmount + diagnosticAmount + pharmacyAmount,
    };
  }

  const amount = getRevenueAmount(row);
  const type = getBillingType(row);
  return {
    opRevenue: type === "op" ? amount : 0,
    diagnosticRevenue: type === "diagnostic" ? amount : 0,
    pharmacyRevenue: type === "pharmacy" ? amount : 0,
    revenue: amount,
  };
};

export const getBranchId = (row = {}) =>
  String(pick(row, ["branchId", "BranchId", "clinicBranchId", "ClinicBranchId", "branch.id", "Branch.Id"], "")).trim();

export const getBranchName = (row = {}) =>
  String(
    pick(row, ["branchName", "BranchName", "branch.name", "Branch.Name", "branch", "Branch", "__selectedBranchName"], "") ||
      "Unassigned Branch"
  ).trim();

export const getClinicId = (row = {}) =>
  String(pick(row, ["hospitalId", "HospitalId", "clinicId", "ClinicId", "assignedClinicId", "AssignedClinicId"], "")).trim();

export const getDoctorId = (row = {}) =>
  String(pick(row, ["doctorId", "DoctorId", "doctor.id", "Doctor.Id", "doctor.doctorId"], "")).trim();

export const getBillingKey = (row = {}, index = 0) =>
  String(
    getBillingType(row) === "op" && pick(row, ["appointmentId", "AppointmentId"], "")
      ? `op-appointment-${pick(row, ["appointmentId", "AppointmentId"], "")}`
      : pick(row, ["invoiceNo", "InvoiceNo", "invoiceNumber", "InvoiceNumber", "billNumber", "BillNumber", "billingId", "BillingId", "billId", "BillId", "id", "Id"], "") ||
        `${getBillingType(row)}-${pick(row, ["appointmentId", "AppointmentId"], "")}-${pick(row, ["patientId", "patientName"], "patient")}-${getRevenueAmount(row)}-${getRowDate(row) || index}`
  );

export const dedupeBillingRows = (rows = []) => {
  const lookup = new Map();
  rows.forEach((row, index) => {
    const key = getBillingKey(row, index);
    if (!lookup.has(key)) lookup.set(key, row);
  });
  return Array.from(lookup.values());
};

export const PATIENT_PORTAL_OP_BILLS_KEY = "patientPortalRecentOpBills";
export const RECEPTION_RECENT_SERVICE_BILLS_KEY = "receptionRecentServiceBills";

export const normalizePatientPortalBill = (bill = {}) => {
  if (!bill || typeof bill !== "object") return bill;

  const normalizedType = String(
    bill.invoiceType || bill.InvoiceType || bill.billingType || bill.BillingType || bill.type || bill.serviceType || bill.ServiceType || ""
  ).toLowerCase();
  const isDiagnostic = normalizedType.includes("diagnostic") || normalizedType.includes("diagnosis") || normalizedType.includes("lab") || normalizedType.includes("test");
  const billingType = bill.billingType || bill.BillingType || (isDiagnostic ? "Lab" : "OP");
  const invoiceType = bill.invoiceType || bill.InvoiceType || (isDiagnostic ? "diagnostic" : "op");
  const serviceType = bill.serviceType || bill.ServiceType || (isDiagnostic ? "Diagnostic Billing" : "Patient Portal OP Billing");
  const createdAt = bill.createdAt || bill.createdOn || bill.billDate || bill.invoiceDate || new Date().toISOString();

  return {
    ...bill,
    invoiceType,
    InvoiceType: invoiceType,
    billingType,
    BillingType: billingType,
    serviceType,
    ServiceType: serviceType,
    source: bill.source || bill.billingSource || "reception",
    billingSource: bill.billingSource || bill.source || "reception",
    bookingSource: bill.bookingSource || (bill.source === "patient-portal" ? "online" : "offline"),
    paymentSource: bill.paymentSource || bill.billingSource || bill.source || "reception",
    paymentStatus: bill.paymentStatus || bill.PaymentStatus || "Paid",
    status: bill.status || bill.Status || "Paid",
    createdAt,
    billDate: bill.billDate || bill.invoiceDate || createdAt,
    invoiceDate: bill.invoiceDate || bill.billDate || createdAt,
  };
};

export const readPatientPortalBills = (storageKey = PATIENT_PORTAL_OP_BILLS_KEY) => {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(value) ? value.map(normalizePatientPortalBill) : [];
  } catch {
    return [];
  }
};

export const storePatientPortalBill = (bill, storageKey = PATIENT_PORTAL_OP_BILLS_KEY) => {
  if (!bill || typeof bill !== "object") return [];

  try {
    const rows = readPatientPortalBills(storageKey);
    const next = dedupeBillingRows([{ ...normalizePatientPortalBill(bill) }, ...rows]).slice(0, 100);
    localStorage.setItem(storageKey, JSON.stringify(next));
    return next;
  } catch {
    localStorage.setItem(storageKey, JSON.stringify([normalizePatientPortalBill(bill)]));
    return [normalizePatientPortalBill(bill)];
  }
};

export const readLocalBillingRows = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

export const readLocalRevenueBillingRows = () => [
  ...readLocalBillingRows(RECEPTION_RECENT_SERVICE_BILLS_KEY),
  ...readLocalBillingRows(PATIENT_PORTAL_OP_BILLS_KEY),
];

export const fetchRevenueBillingRows = async ({ apiUrl, headers = {}, params } = {}) => {
  const queryParams = new URLSearchParams(params || "");
  queryParams.set("pageSize", "10000");
  queryParams.set("limit", "10000");
  queryParams.set("includeAll", "true");
  queryParams.set("all", "true");
  const query = queryParams.toString();
  const paths = BILLING_API_PATHS.map((path) => `${path}?${query}`);
  const requests = paths.map(async (path) => {
    try {
      const response = await fetch(apiUrl(path), { headers });
      if (!response.ok) return [];
      return parseList(await response.json().catch(() => []));
    } catch {
      return [];
    }
  });
  const results = await Promise.all(requests);
  return dedupeBillingRows([...results.flat(), ...readLocalRevenueBillingRows()]);
};

export const getRevenueTotals = (rows = []) =>
  rows.reduce(
    (total, row) => {
      const breakdown = getRevenueBreakdown(row);
      total.opRevenue += breakdown.opRevenue;
      total.diagnosticRevenue += breakdown.diagnosticRevenue;
      total.pharmacyRevenue += breakdown.pharmacyRevenue;
      total.cgstAmount += getCgstAmount(row);
      total.sgstAmount += getSgstAmount(row);
      total.gstAmount += getGstAmount(row);
      total.revenue += getRevenueAmount(row) || breakdown.revenue;
      return total;
    },
    {
      opRevenue: 0,
      diagnosticRevenue: 0,
      pharmacyRevenue: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      gstAmount: 0,
      revenue: 0,
    }
  );

export const isPaidAppointment = (appointment = {}) => {
  const status = String(pick(appointment, ["paymentStatus", "PaymentStatus", "payment.status", "Payment.Status", "status", "Status"], "")).toLowerCase();
  return status.includes("paid") || getRevenueAmount(appointment) > 0;
};

export const appointmentToOpRevenueRow = (appointment = {}) => ({
  ...appointment,
  invoiceType: "op",
  billingType: "OP",
  serviceType: "OP Billing",
  invoiceNo:
    pick(appointment, ["invoiceNo", "invoiceNumber", "receiptNo", "ReceiptNo", "transactionId", "TransactionId"], "") ||
    `OP-${pick(appointment, ["appointmentId", "AppointmentId", "id", "Id"], Date.now())}`,
  totalAmount: getRevenueAmount(appointment),
  paidAmount: getRevenueAmount(appointment),
  createdAt: getRowDate(appointment),
});

export const passesRevenueFilters = (row = {}, { clinicId = "", branchId = "", doctorId = "", fromDate = "", toDate = "" } = {}) => {
  if (clinicId && getClinicId(row) && getClinicId(row) !== String(clinicId)) return false;
  if (branchId) {
    const rowBranchId = String(getBranchId(row) || "").trim().toLowerCase();
    const rowBranchName = String(getBranchName(row) || "").trim().toLowerCase();
    const targetBranchId = String(branchId || "").trim().toLowerCase();
    const targetBranchName = String(row.__selectedBranchName || "").trim().toLowerCase();
    const matchesBranchId = rowBranchId && rowBranchId === targetBranchId;
    const matchesBranchName = targetBranchName && rowBranchName && rowBranchName === targetBranchName;
    if (!matchesBranchId && !matchesBranchName) return false;
  }
  if (doctorId && getDoctorId(row) !== String(doctorId)) return false;

  const rowDateValue = getRowDate(row);
  const rowDate = rowDateValue ? new Date(rowDateValue) : null;
  if (rowDate && !Number.isNaN(rowDate.getTime())) {
    if (fromDate && rowDate < new Date(fromDate)) return false;
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      if (rowDate > end) return false;
    }
  }

  return true;
};

export const groupRevenueByMonthBranch = (rows = []) => {
  const byKey = new Map();

  rows.forEach((row, index) => {
    const date = getRowDate(row);
    const month = getMonthLabel(date, index);
    const monthSort = getMonthSortKey(date);
    const branchId = getBranchId(row);
    const branchName = getBranchName(row);
    const key = `${monthSort}|${branchId || branchName}`;
    const current = byKey.get(key) || {
      month,
      monthSort,
      branchId,
      branchName,
      opRevenue: 0,
      diagnosticRevenue: 0,
      pharmacyRevenue: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      gstAmount: 0,
      revenue: 0,
      growth: 0,
    };
    const breakdown = getRevenueBreakdown(row);

    current.opRevenue += breakdown.opRevenue;
    current.diagnosticRevenue += breakdown.diagnosticRevenue;
    current.pharmacyRevenue += breakdown.pharmacyRevenue;

    current.cgstAmount += getCgstAmount(row);
    current.sgstAmount += getSgstAmount(row);
    current.gstAmount += getGstAmount(row);
    current.revenue += getRevenueAmount(row) || breakdown.revenue;
    byKey.set(key, current);
  });

  return Array.from(byKey.values()).sort((left, right) => {
    const monthCompare = String(left.monthSort).localeCompare(String(right.monthSort));
    if (monthCompare) return monthCompare;
    return String(left.branchName).localeCompare(String(right.branchName));
  });
};

export const groupRevenueByMonth = (rows = []) => {
  const byMonth = new Map();

  rows.forEach((row, index) => {
    const date = getRowDate(row);
    const month = getMonthLabel(date, index);
    const monthSort = getMonthSortKey(date);
    const current = byMonth.get(monthSort) || { month, monthSort, revenue: 0, growth: 0 };
    current.revenue += getRevenueAmount(row);
    byMonth.set(monthSort, current);
  });

  return Array.from(byMonth.values()).sort((left, right) => String(left.monthSort).localeCompare(String(right.monthSort)));
};
