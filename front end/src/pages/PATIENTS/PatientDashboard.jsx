import React, { useEffect, useMemo, useState } from "react";
import "./PatientDashboard.css";
import {
  Bell,
  Calendar,
  ChevronRight,
  Clock,
  FileText,
  IndianRupee,
  MapPin,
  Pill,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { patientApiUrl, PATIENT_API } from "../../config/api";

const EMPTY_ARRAY = [];

const formatCount = (value) => Number(value || 0).toLocaleString("en-IN");

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const toAmount = (value) => {
  const parsed = Number(String(value ?? 0).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const getNestedValue = (record, path) => {
  if (record == null) return undefined;
  const keys = Array.isArray(path) ? path : String(path).replace(/\?/g, "").split(".");
  return keys.reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), record);
};

const readFirst = (record, keys) =>
  keys.reduce((value, key) => value || getNestedValue(record, key), "") || "";

const getBillStatus = (bill) => String(
  firstValue(
    readFirst(bill, ['status', 'paymentStatus', 'state', 'paymentState', 'statusText', 'paymentStatusText', 'billingStatus', 'invoice.status', 'invoice.paymentStatus', 'bill.status', 'bill.paymentStatus']),
    ''
  ) || ''
).toLowerCase();

const isBillPendingStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return false;
  return ['pending', 'unpaid', 'due', 'not paid', 'notpaid', 'partial', 'outstanding'].some((term) => normalized.includes(term));
};

const isBillPaidStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  return ['paid', 'completed', 'settled', 'closed'].some((term) => normalized.includes(term));
};

const getBillAppointmentKey = (bill) =>
  firstValue(
    readFirst(bill, [
      'appointmentNumber', 'appointmentNo', 'appointmentId', 'appointment.id', 'appointment_id',
      'appointment.appointmentNumber', 'appointment.appointmentNo', 'appointment.appointmentId',
      'invoice.appointmentId', 'invoice.appointment.id', 'invoice.appointment.appointmentNumber',
      'bill.appointmentId', 'bill.appointment.id', 'bill.appointment.appointmentNumber',
    ]),
    ''
  );

const getBillDateValue = (bill) => {
  const date = new Date(
    firstValue(
      readFirst(bill, ['invoiceDate', 'billDate', 'date', 'createdAt', 'updatedAt', 'invoice.createdAt', 'invoice.updatedAt', 'bill.createdAt', 'bill.updatedAt']),
      ''
    )
  );
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
};

const selectBestBillRecord = (existing, incoming) => {
  if (!existing) return incoming;
  const existingDate = getBillDateValue(existing);
  const incomingDate = getBillDateValue(incoming);
  if (incomingDate > existingDate) return incoming;
  if (incomingDate < existingDate) return existing;

  const existingStatus = getBillStatus(existing);
  const incomingStatus = getBillStatus(incoming);
  if (incomingStatus === 'paid' && existingStatus !== 'paid') return incoming;
  if (existingStatus === 'paid' && incomingStatus !== 'paid') return existing;

  return incoming;
};

const dedupeBillsByAppointment = (bills = []) => {
  const grouped = new Map();
  Array.isArray(bills) && bills.forEach((bill) => {
    const key = getBillAppointmentKey(bill) || String(firstValue(bill?.invoiceNumber, bill?.billNumber, bill?.referenceNumber, bill?.id, '')).trim();
    const current = grouped.get(key);
    grouped.set(key, selectBestBillRecord(current, bill));
  });
  return Array.from(grouped.values());
};

const getBillTotalAmount = (bill) => {
  const amount = firstValue(
    readFirst(bill, ['totalAmount', 'grandTotal', 'invoiceAmount', 'netAmount', 'total', 'amount', 'billingAmount', 'invoiceTotal', 'payableAmount', 'paymentAmount', 'paidAmount', 'dueAmount', 'balance', 'outstandingAmount', 'totals.total', 'invoice.totalAmount', 'invoice.grandTotal', 'invoice.amount', 'invoice.netAmount', 'bill.totalAmount', 'bill.grandTotal', 'bill.amount', 'bill.netAmount']),
    0
  );
  return toAmount(amount);
};

const getBillDueAmount = (bill) => {
  const amount = firstValue(
    readFirst(bill, ['dueAmount', 'amountDue', 'balance', 'outstandingAmount', 'remainingAmount', 'totalAmount', 'grandTotal', 'invoiceAmount', 'netAmount', 'total', 'amount', 'paidAmount', 'paymentAmount', 'payableAmount', 'totals.dueAmount', 'invoice.dueAmount', 'bill.dueAmount']),
    0
  );
  return toAmount(amount);
};

const getBillPaidAmount = (bill) => {
  const amount = firstValue(
    readFirst(bill, ['paidAmount', 'paymentAmount', 'amountPaid', 'totalAmount', 'grandTotal', 'invoiceAmount', 'netAmount', 'total', 'amount', 'billingAmount', 'payableAmount', 'invoice.paidAmount', 'bill.paidAmount']),
    0
  );
  return toAmount(amount);
};

const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");

const formatInlineValue = (value, emptyText = "Not available") => {
  const resolved = firstValue(value);
  return resolved !== undefined ? String(resolved) : emptyText;
};

const formatDateLabel = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }
  return String(value);
};

const formatTimeLabel = (value) => {
  if (!value) return null;
  return String(value).replace(/\s+/g, " ").trim();
};

const getAppointmentStatus = (appointment = {}) => {
  const safeAppointment = appointment || {};
  const status = firstValue(safeAppointment.status, safeAppointment.appointmentStatus, safeAppointment.state);
  return status ? String(status) : "Scheduled";
};

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

const isCancelledAppointment = (appointment = {}) => {
  const status = normalizeStatus(firstValue(appointment?.status, appointment?.appointmentStatus, appointment?.state));
  return ["cancelled", "canceled", "rejected", "void", "deleted"].some((term) => status.includes(term));
};

const isCompletedAppointment = (appointment = {}) => {
  const status = normalizeStatus(firstValue(appointment?.status, appointment?.appointmentStatus, appointment?.state));
  return ["complete", "completed", "done", "closed", "visited", "consulted"].some((term) => status.includes(term));
};

const getAppointmentId = (appointment = {}) =>
  firstValue(
    appointment?.appointmentId,
    appointment?.AppointmentId,
    appointment?.id,
    appointment?.Id,
    appointment?.appointment?.appointmentId,
    appointment?.appointment?.id
  );

const getAppointmentDate = (appointment = {}) =>
  firstValue(
    (appointment || {}).date,
    (appointment || {}).appointmentDate,
    (appointment || {}).scheduledDate,
    (appointment || {}).visitDate,
    (appointment || {}).slotDate,
    (appointment || {}).startDate,
    (appointment || {}).createdAt
  );

const getAppointmentTime = (appointment = {}) =>
  firstValue((appointment || {}).time, (appointment || {}).slot, (appointment || {}).timeRange, (appointment || {}).scheduleTime, (appointment || {}).startTime, (appointment || {}).endTime);

const getAppointmentTimestamp = (appointment = {}) => {
  const dateValue = getAppointmentDate(appointment);
  const timeValue = getAppointmentTime(appointment);
  if (!dateValue && !timeValue) return 0;
  const directDate = new Date(dateValue);
  if (Number.isFinite(directDate.getTime()) && directDate.getHours()) return directDate.getTime();
  const joined = [dateValue, timeValue].filter(Boolean).join(" ");
  const parsed = new Date(joined);
  if (Number.isFinite(parsed.getTime())) return parsed.getTime();
  return Number.isFinite(directDate.getTime()) ? directDate.getTime() : 0;
};

const toDateKey = (value) => {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "";
  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, "0"),
    String(parsed.getDate()).padStart(2, "0"),
  ].join("-");
};

const isTodayAppointment = (appointment = {}) => {
  const date = getAppointmentDate(appointment);
  return date ? toDateKey(date) === toDateKey(new Date()) : false;
};

const getDoctorName = (appointment = {}) =>
  firstValue(
    typeof (appointment || {}).doctor === "string" ? (appointment || {}).doctor : undefined,
    (appointment || {}).doctorName,
    (appointment || {}).doctor?.name,
    (appointment || {}).doctor?.fullName,
    (appointment || {}).practitionerName,
    (appointment || {}).providerName
  );
const getTokenNumber = (appointment = {}) =>
  firstValue(
    appointment?.tokenNumber,
    appointment?.TokenNumber,
    appointment?.token,
    appointment?.tokenNo,
    appointment?.token_number,
    appointment?.displayToken
  );

const formatTokenNumber = (token) => {
  const value = String(firstValue(token) || "").trim();
  if (!value) return null;
  const match = value.match(/^TKN\s*0*(\d+)$/i);
  return match ? `TKN${String(Number(match[1])).padStart(3, "0")}` : null;
};

const normalizeDisplayToken = (token) => {
  const value = String(firstValue(token) || "").trim();
  if (!value) return "Not available";
  return formatTokenNumber(value) || value;
};

const getNumericValue = (value) => {
  const number = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : null;
};

const getPatientQueueMetrics = (dashboardData = {}, appointment = {}, visits = []) => {
  const source = dashboardData && typeof dashboardData === "object" ? dashboardData : appointment;
  const patientsAheadRaw = firstValue(
    readFirst(source, [
      "patientsAhead",
      "patientsAheadCount",
      "queueAhead",
      "position",
      "waitingCount",
      "queuePosition",
      "positionAhead",
    ]),
    readFirst(appointment, [
      "patientsAhead",
      "patientsAheadCount",
      "queueAhead",
      "position",
      "waitingCount",
      "queuePosition",
      "positionAhead",
    ])
  );
  const estimatedWaitingRaw = firstValue(
    readFirst(source, [
      "estimatedWaitingTime",
      "estimatedWaitTime",
      "waitingTime",
      "estimatedWait",
      "eta",
      "estimatedTime",
      "waitingMinutes",
    ]),
    readFirst(appointment, [
      "estimatedWaitingTime",
      "estimatedWaitTime",
      "waitingTime",
      "estimatedWait",
      "eta",
      "estimatedTime",
      "waitingMinutes",
    ])
  );
  const waitingMinutes = getNumericValue(estimatedWaitingRaw);
  const token = firstValue(
    readFirst(source, ["currentToken", "tokenNumber", "token", "displayToken", "appointmentToken"]),
    getTokenNumber(appointment)
  );

  const counts = { waiting: 0, inConsultation: 0, completed: 0 };
  const items = Array.isArray(visits) ? visits : [];
  items.forEach((item) => {
    const status = String(firstValue(item.status, item.appointmentStatus, item.state) || "").toLowerCase();
    if (status.includes("complete") || status.includes("done") || status.includes("closed")) {
      counts.completed += 1;
    } else if (status.includes("inprogress") || status.includes("in consultation") || status.includes("consult") || status.includes("ongoing")) {
      counts.inConsultation += 1;
    } else {
      counts.waiting += 1;
    }
  });

  const activeStatus = String(firstValue(appointment?.status, appointment?.appointmentStatus, appointment?.state) || "").toLowerCase();
  if (activeStatus.includes("consult") || activeStatus.includes("inprogress") || activeStatus.includes("ongoing")) {
    counts.inConsultation = Math.max(counts.inConsultation, 1);
  } else if (
    activeStatus &&
    !["complete", "done", "closed", "cancelled", "canceled", "rejected"].some((term) => activeStatus.includes(term))
  ) {
    counts.waiting = Math.max(counts.waiting, 1);
  }

  return {
    token,
    formattedToken: formatTokenNumber(token),
    patientsAhead: getNumericValue(patientsAheadRaw),
    waitingMinutes,
    queueCounts: counts,
  };
};

const parseApiObject = (data) => {
  if (!data || typeof data !== "object") return {};
  if (data.data && typeof data.data === "object" && !Array.isArray(data.data)) return data.data;
  if (data.item && typeof data.item === "object") return data.item;
  if (data.result && typeof data.result === "object" && !Array.isArray(data.result)) return data.result;
  return data;
};

const parseApiList = (data) => {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.queue)) return data.queue;
  if (Array.isArray(data.tokens)) return data.tokens;
  if (Array.isArray(data.queueItems)) return data.queueItems;
  if (Array.isArray(data.appointments)) return data.appointments;
  return [];
};

const normalizeQueueStatus = (status) => {
  const value = String(status || "").trim().toLowerCase();
  if (value.includes("complete") || value.includes("done") || value.includes("served") || value.includes("closed")) return "completed";
  if (value.includes("consult") || value.includes("progress") || value.includes("current") || value.includes("called")) return "current";
  return "waiting";
};

const normalizeQueueStep = (item = {}, index = 0, currentToken = "") => {
  const token = normalizeDisplayToken(
    firstValue(
      item.tokenNumber,
      item.TokenNumber,
      item.token,
      item.Token,
      item.displayToken,
      item.appointmentToken,
      item.currentToken
    )
  );
  const status = normalizeQueueStatus(firstValue(item.status, item.Status, item.queueStatus, item.state));
  const current = currentToken && token === currentToken;
  return {
    id: firstValue(item.id, item.appointmentId, item.queueId, `${token}-${index}`),
    token,
    status: current ? "current" : status,
  };
};
const getSpecialization = (appointment = {}) =>
  firstValue((appointment || {}).specialization, (appointment || {}).department, (appointment || {}).speciality, (appointment || {}).specialty, (appointment || {}).doctor?.specialization);

const getClinicName = (appointment = {}) => {
  const source = appointment || {};
  const branchName = firstValue(
    source.branchName,
    source.BranchName,
    source.branch?.name,
    source.Branch?.Name,
    source.branch,
    source.Branch
  );
  const clinicName = firstValue(
    source.clinicName,
    source.ClinicName,
    source.hospitalName,
    source.HospitalName,
    source.clinic?.name,
    source.Clinic?.Name,
    source.hospital?.name,
    source.Hospital?.Name,
    source.clinic,
    source.Clinic,
    source.hospital,
    source.Hospital
  );
  const values = [branchName, clinicName]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const uniqueValues = Array.from(new Set(values.map((value) => value.toLowerCase())))
    .map((key) => values.find((value) => value.toLowerCase() === key));
  return uniqueValues.join(" / ") || firstValue(source.departmentName, source.department);
};

const getLocation = (appointment = {}) =>
  firstValue((appointment || {}).location, (appointment || {}).room, (appointment || {}).site, (appointment || {}).clinicAddress, getClinicName(appointment));

const getAppointmentAvatar = (appointment = {}) => {
  const doctorName = String(getDoctorName(appointment) || "").trim();
  if (!doctorName) return "--";
  return doctorName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

const getSortedUpcomingAppointment = (items = []) => {
  const now = Date.now();
  const list = Array.isArray(items)
    ? items.filter((item) => item && !isCancelledAppointment(item) && !isCompletedAppointment(item))
    : [];
  if (!list.length) return null;

  const score = (item) => {
    const status = String(item.status || item.appointmentStatus || item.state || "").toLowerCase();
    if (status.includes("upcoming") || status.includes("confirm") || status.includes("schedule") || status.includes("book")) return 0;
    if (status.includes("pending") || status.includes("new")) return 1;
    return 2;
  };

  return [...list].sort((left, right) => {
    const leftScore = score(left);
    const rightScore = score(right);
    if (leftScore !== rightScore) return leftScore - rightScore;
    const leftTime = getAppointmentTimestamp(left) || new Date(firstValue(getAppointmentDate(left), left.createdAt, left.updatedAt) || 0).getTime();
    const rightTime = getAppointmentTimestamp(right) || new Date(firstValue(getAppointmentDate(right), right.createdAt, right.updatedAt) || 0).getTime();
    const leftFuture = leftTime >= now ? 0 : 1;
    const rightFuture = rightTime >= now ? 0 : 1;
    if (leftFuture !== rightFuture) return leftFuture - rightFuture;
    return leftTime - rightTime;
  })[0];
};

const normalizeDashboardNotification = (notification = {}, index = 0) => {
  const message = firstValue(
    notification.message,
    notification.description,
    notification.body,
    notification.content,
    notification.text,
    notification.title,
    notification.notification?.message,
    notification.notification?.title
  );
  if (!message) return null;
  const createdAt = firstValue(notification.createdAt, notification.date, notification.notificationDate, notification.updatedAt);
  return {
    id: String(firstValue(notification.id, notification.notificationId, notification._id, `notification-${index}`)),
    title: firstValue(notification.title, notification.type, "Notification"),
    message: String(message),
    date: formatDateLabel(createdAt) || formatInlineValue(createdAt, "Recent"),
    read: Boolean(firstValue(notification.read, notification.isRead, notification.readAt)),
  };
};

function PatientDashboard({ patient, visits = EMPTY_ARRAY, prescriptions = EMPTY_ARRAY, bills = EMPTY_ARRAY, notifications = EMPTY_ARRAY, dashboardData = null }) {
  const navigate = useNavigate();
  const dashboardPatient = patient || {};
  const [liveQueue, setLiveQueue] = useState({
    token: "",
    patientsAhead: null,
    waitingMinutes: null,
    counts: null,
    steps: [],
  });
  const uniqueBills = useMemo(() => {
    const seen = new Set();
    return (Array.isArray(bills) ? bills : []).filter((bill) => {
      const billId = String(
        firstValue(
          bill?.invoiceId,
          bill?.billId,
          bill?.id,
          bill?.referenceId,
          bill?.invoice?.id,
          bill?.bill?.id,
          bill?.invoice?.referenceId,
          bill?.bill?.referenceId
        ) || ""
      ).trim();
      const billNumber = String(
        firstValue(
          bill?.invoiceNumber,
          bill?.billNumber,
          bill?.referenceNumber,
          bill?.invoice?.invoiceNumber,
          bill?.invoice?.billNumber,
          bill?.bill?.invoiceNumber,
          bill?.bill?.billNumber,
          bill?.bill?.referenceNumber
        ) || ""
      ).trim();
      const appointmentId = String(
        firstValue(
          bill?.appointmentId,
          bill?.appointment?.id,
          bill?.appointment_id,
          bill?.invoice?.appointmentId,
          bill?.invoice?.appointment?.id,
          bill?.bill?.appointmentId,
          bill?.bill?.appointment?.id,
          bill?.appointmentNumber,
          bill?.appointmentNo,
          bill?.appointment?.number
        ) || ""
      ).trim();
      const patientId = String(
        firstValue(
          bill?.patientId,
          bill?.patient?.id,
          bill?.invoice?.patientId,
          bill?.invoice?.patient?.id,
          bill?.bill?.patientId,
          bill?.bill?.patient?.id,
          bill?.patientCode,
          bill?.patient?.code
        ) || ""
      ).trim();
      const key = [billId, billNumber, appointmentId, patientId]
        .filter(Boolean)
        .join("|");
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [bills]);
  const activeVisits = useMemo(
    () => (Array.isArray(visits) ? visits.filter((visit) => visit && !isCancelledAppointment(visit)) : []),
    [visits]
  );
  const todayActiveVisits = useMemo(
    () => activeVisits.filter((visit) => !isCompletedAppointment(visit) && isTodayAppointment(visit)),
    [activeVisits]
  );
  const upcomingAppointment = getSortedUpcomingAppointment(todayActiveVisits.length ? todayActiveVisits : activeVisits);
  const upcomingAppointmentId = getAppointmentId(upcomingAppointment);
  const previousVisits = activeVisits.filter(isCompletedAppointment).length;
  const prescriptionCount = Array.isArray(prescriptions) ? prescriptions.length : 0;
  const medicalRecordCount = previousVisits + prescriptionCount;
  const pendingBillsAmount = Array.isArray(uniqueBills)
    ? uniqueBills.reduce((total, bill) => {
        const status = getBillStatus(bill);
        const isPending = !status ? getBillDueAmount(bill) > 0 : isBillPendingStatus(status);
        return isPending ? total + getBillDueAmount(bill) : total;
      }, 0)
    : 0;
  const latestBill = Array.isArray(uniqueBills) && uniqueBills.length
    ? [...uniqueBills].sort((left, right) => getBillDateValue(right) - getBillDateValue(left))[0]
    : null;
  const latestBillAmount = latestBill ? getBillTotalAmount(latestBill) : 0;
  const firstBill = Array.isArray(uniqueBills) && uniqueBills.length ? uniqueBills[0] : null;
  const hasBills = Array.isArray(uniqueBills) && uniqueBills.length > 0;
  const hasPendingBills = Array.isArray(uniqueBills)
    ? uniqueBills.some((bill) => {
        const status = getBillStatus(bill);
        if (!status) return getBillDueAmount(bill) > 0;
        return isBillPendingStatus(status);
      })
    : false;
  const pendingStatusNote = hasBills
    ? hasPendingBills
      ? "Payment due"
      : "All bills paid"
    : "No bills yet";
  const billCardLabel = hasBills
    ? hasPendingBills
      ? "Total Due"
      : "Latest Bill"
    : "Total Due";
  const billCardValue = hasPendingBills ? pendingBillsAmount : latestBillAmount;
  const selectedPatientId = formatInlineValue(dashboardPatient.patientCode || dashboardPatient.id, "-");

  if (process.env.NODE_ENV !== 'production' && firstBill) {
    console.debug('PatientDashboard: first bill', firstBill);
    console.debug('Extracted latestBillAmount', latestBillAmount, 'pendingBillsAmount', pendingBillsAmount, 'hasPendingBills', hasPendingBills);
  }
  const selectedPatientPhone = formatInlineValue(dashboardPatient.phone, "Phone not available");
  const selectedPatientBloodGroup = formatInlineValue(dashboardPatient.bloodGroup || dashboardPatient.bloodgroup, "-");
  const appointmentDate = formatDateLabel(getAppointmentDate(upcomingAppointment));
  const appointmentTime = formatTimeLabel(getAppointmentTime(upcomingAppointment));
  const appointmentReminderDoctor = formatInlineValue(getDoctorName(upcomingAppointment), "Your");
  const {
    formattedToken,
    patientsAhead,
    waitingMinutes,
  } = getPatientQueueMetrics(dashboardData, upcomingAppointment, activeVisits);
  const hasQueueAppointment = Boolean(upcomingAppointmentId);
  const tokenValue = hasQueueAppointment
    ? normalizeDisplayToken(liveQueue.token || formattedToken || getTokenNumber(upcomingAppointment))
    : "Not available";
  const patientsAheadValue = liveQueue.patientsAhead !== null ? liveQueue.patientsAhead : patientsAhead;
  const waitingMinutesValue = liveQueue.waitingMinutes !== null ? liveQueue.waitingMinutes : waitingMinutes;
  const patientsAheadLabel = patientsAheadValue !== null ? formatCount(patientsAheadValue) : "Not available";
  const estimatedWaitingTimeLabel = waitingMinutesValue !== null ? `${waitingMinutesValue} mins` : "Not available";
  const queueSteps = liveQueue.steps.length
    ? liveQueue.steps
    : tokenValue !== "Not available"
      ? [{ id: tokenValue, token: tokenValue, status: "current" }]
      : [];

  useEffect(() => {
    if (!upcomingAppointmentId) {
      setLiveQueue({ token: "", patientsAhead: null, waitingMinutes: null, counts: null, steps: [] });
      return undefined;
    }

    let isActive = true;
    const headers = {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      ...(localStorage.getItem("patientToken") || localStorage.getItem("token")
        ? { Authorization: `Bearer ${localStorage.getItem("patientToken") || localStorage.getItem("token")}` }
        : {}),
    };

    const loadLiveQueue = async () => {
      try {
        const [queueResponse, tokenResponse] = await Promise.all([
          fetch(patientApiUrl(PATIENT_API.appointmentQueueStatus, { id: upcomingAppointmentId }), { headers }).catch(() => null),
          fetch(patientApiUrl(PATIENT_API.appointmentToken, { id: upcomingAppointmentId }), { headers }).catch(() => null),
        ]);

        const queueData = queueResponse?.ok ? await queueResponse.json().catch(() => null) : null;
        const tokenData = tokenResponse?.ok ? await tokenResponse.json().catch(() => null) : null;
        const queueObject = parseApiObject(queueData);
        const tokenObject = parseApiObject(tokenData);
        const liveToken = normalizeDisplayToken(
          firstValue(
            tokenObject.tokenNumber,
            tokenObject.TokenNumber,
            tokenObject.token,
            tokenObject.Token,
            tokenObject.displayToken,
            tokenObject.currentToken,
            queueObject.tokenNumber,
            queueObject.currentToken,
            queueObject.appointmentToken
          )
        );
        const queueList = parseApiList(queueData);
        const steps = queueList
          .map((item, index) => normalizeQueueStep(item, index, liveToken))
          .filter((item) => item.token && item.token !== "Not available");
        const hasCurrentStep = steps.some((item) => item.status === "current");
        const resolvedSteps = steps.length
          ? hasCurrentStep
            ? steps
            : [...steps, { id: liveToken, token: liveToken, status: "current" }]
          : liveToken !== "Not available"
            ? [{ id: liveToken, token: liveToken, status: "current" }]
            : [];
        const counts = resolvedSteps.length
          ? {
              completed: resolvedSteps.filter((item) => item.status === "completed").length,
              inConsultation: resolvedSteps.filter((item) => item.status === "current").length,
              waiting: resolvedSteps.filter((item) => item.status === "waiting").length,
            }
          : null;

        if (!isActive) return;
        setLiveQueue({
          token: liveToken !== "Not available" ? liveToken : "",
          patientsAhead: getNumericValue(firstValue(queueObject.patientsAhead, queueObject.queueAhead, queueObject.positionAhead, queueObject.waitingBefore)),
          waitingMinutes: getNumericValue(firstValue(queueObject.estimatedWaitingTime, queueObject.estimatedWaitTime, queueObject.waitingMinutes, queueObject.eta)),
          counts,
          steps: resolvedSteps,
        });
      } catch {
        if (isActive) setLiveQueue((current) => ({ ...current, steps: current.steps || [] }));
      }
    };

    loadLiveQueue();
    const intervalId = window.setInterval(loadLiveQueue, 30000);
    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [upcomingAppointmentId]);

  const defaultNotifications = [
    upcomingAppointment && {
      id: "upcoming-appointment-reminder",
      title: "Upcoming Appointment Reminder",
      message: `${appointmentReminderDoctor} appointment${appointmentDate ? ` on ${appointmentDate}` : ""}${appointmentTime ? ` at ${appointmentTime}` : ""}.`,
      date: appointmentDate || "Today",
      read: false,
    },
    prescriptionCount > 0 && {
      id: "prescription-ready",
      title: "Prescription Ready",
      message: `${formatCount(prescriptionCount)} prescription record${prescriptionCount === 1 ? "" : "s"} available to view.`,
      date: "Ready now",
      read: false,
    },
    pendingBillsAmount > 0 && {
      id: "payment-due",
      title: "Payment due",
      message: `${formatCurrency(pendingBillsAmount)} pending for payment.`,
      date: "Due",
      read: false,
    },
  ].filter(Boolean);
  const backendNotifications = (Array.isArray(notifications) ? notifications : [])
    .map(normalizeDashboardNotification)
    .filter(Boolean);
  const notificationItems = backendNotifications.length ? backendNotifications.slice(0, 3) : defaultNotifications.slice(0, 3);
  const notificationSummary = notificationItems.length ? `${notificationItems.length} updates` : "No notifications yet";

  const [selectedNotificationId, setSelectedNotificationId] = useState(notificationItems[0]?.id ?? null);

  useEffect(() => {
    setSelectedNotificationId(notificationItems[0]?.id ?? null);
  }, [notificationItems]);

  const appointmentDoctor = formatInlineValue(getDoctorName(upcomingAppointment), "No appointment scheduled");
  const appointmentSpecialization = formatInlineValue(getSpecialization(upcomingAppointment), "Waiting for appointment data");
  const appointmentClinic = formatInlineValue(getClinicName(upcomingAppointment), "Clinic details not available");
  const appointmentLocation = formatInlineValue(getLocation(upcomingAppointment), "Location not available");
  const appointmentStatus = formatInlineValue(getAppointmentStatus(upcomingAppointment), "No appointment scheduled");
  const appointmentAvatar = getAppointmentAvatar(upcomingAppointment);
  const hasAppointment = Boolean(upcomingAppointment);

  const handleBookAppointment = () => {
    navigate("/patient/appointments/book");
  };

  const handleViewRecords = () => {
    navigate("/patient/medical-history");
  };

  const handleViewDetails = () => {
    navigate("/patient/medical-history");
  };

  const handleViewAppointmentDetails = () => {
    navigate("/patient/appointments");
  };

  const handleReschedule = () => {
    navigate("/patient/appointments/book");
  };

  const handleViewAllNotifications = () => {
    navigate("/patient/notifications");
  };

  return (
    <div className="patient-dashboard pd-reference-dashboard">
      <div className="pd-header">
        <div className="pd-header-copy">
          <h1 className="pd-greeting-title">Welcome back, Patient! <span aria-hidden="true">👋</span></h1>
          <p className="pd-greeting-subtitle">Here&apos;s your health overview and important updates.</p>
        </div>
        <div className="pd-header-actions">
          <button type="button" className="pd-header-btn pd-header-btn--primary" onClick={handleBookAppointment}><Calendar size={16} />Book appointment</button>
          <button type="button" className="pd-header-btn" onClick={handleViewDetails}><FileText size={16} />View records</button>
        </div>
      </div>

      <div className="pd-overview-grid">
        <section className="pd-card pd-token-panel">
          <div className="pd-token-panel-header"><h2>Your Current Token</h2><Bell size={18} aria-hidden="true" /></div>
          <div className="pd-current-token-group"><div className="pd-token-icon"><FileText size={26} /></div><div><strong className="pd-current-token">{tokenValue}</strong><span className="pd-current-token-label">Your Token Number</span></div></div>
          <div className="pd-token-summary-grid">
            <div className="pd-token-stat"><span>Patients Ahead of You</span><strong>{patientsAheadLabel}</strong></div>
            <div className="pd-token-stat"><span>Estimated Waiting Time</span><strong>{estimatedWaitingTimeLabel}</strong></div>
          </div>
          <p className="pd-token-notice"><Bell size={15} />You will be notified when your token is about to be called.</p>
        </section>

        <section className="pd-card pd-appointment-panel">
          <div className="pd-section-header"><div><h2>Today&apos;s Appointment</h2></div><span className="pd-status-badge">{appointmentStatus}</span></div>
          <div className="pd-appointment-summary"><div className="pd-summary-card-icon"><Calendar size={25} /></div><div><strong>{hasAppointment ? `${appointmentTime || "Time pending"}${appointmentDate ? `, ${appointmentDate}` : ""}` : "No appointment scheduled"}</strong><p>{hasAppointment ? appointmentSpecialization : "Book an appointment to see details."}</p></div></div>
          <div className="pd-appointment-doctor"><strong>{hasAppointment ? appointmentDoctor : "Appointment details unavailable"}</strong><span>{hasAppointment ? appointmentClinic : ""}</span></div>
          <button type="button" className="pd-card-footer-button" onClick={hasAppointment ? handleViewAppointmentDetails : handleBookAppointment}>{hasAppointment ? "View Details" : "Book Appointment"}</button>
        </section>

        <section className="pd-card pd-summary-card pd-summary-card--billing" onClick={() => navigate("/patient/bills")} role="button" tabIndex={0} onKeyDown={(event) => event.key === "Enter" && navigate("/patient/bills")}>
          <div className="pd-summary-card-icon"><IndianRupee size={25} /></div><div className="pd-summary-card-copy"><span>{billCardLabel}</span><strong>{formatCurrency(billCardValue)}</strong><p>{pendingStatusNote}</p></div><button type="button" className="pd-card-footer-button" onClick={(event) => { event.stopPropagation(); navigate("/patient/bills"); }}>View Bills</button>
        </section>
        <section className="pd-card pd-summary-card pd-summary-card--records" onClick={handleViewRecords} role="button" tabIndex={0} onKeyDown={(event) => event.key === "Enter" && handleViewRecords()}>
          <div className="pd-summary-card-icon"><FileText size={25} /></div><div className="pd-summary-card-copy"><span>Health Records</span><strong>{formatCount(medicalRecordCount)}</strong><p>{medicalRecordCount === 1 ? "Record" : "Records"}</p></div><button type="button" className="pd-card-footer-button" onClick={(event) => { event.stopPropagation(); handleViewRecords(); }}>View Records</button>
        </section>
      </div>

      <div className="pd-dashboard-row">
        <section className="pd-card pd-queue-panel">
          <div className="pd-section-header"><div><h2>Live Queue Status</h2><p>Real-time token progress</p></div><button type="button" className="pd-link-button" onClick={handleViewAppointmentDetails}>View Full Queue</button></div>
          <div className="pd-queue-track" aria-label="Queue progress">
            {queueSteps.length ? (
              queueSteps.map((item, index) => (
                <div
                  key={`${item.id}-${index}`}
                  className={`pd-queue-step ${item.status === "current" ? "is-current" : item.status === "completed" ? "is-complete" : ""}`}
                >
                  <i>{item.status === "completed" ? "✓" : ""}</i>
                  <span>{item.token}</span>
                </div>
              ))
            ) : (
              <p className="pd-empty-text">Queue status not available yet.</p>
            )}
          </div>
          <div className="pd-queue-legend"><span><i className="is-complete" />Completed</span><span><i className="is-current" />In Consultation</span><span><i />Waiting</span></div>
        </section>
        <section className="pd-card pd-actions-panel"><div className="pd-section-header"><div><h2>Quick Actions</h2></div></div><div className="pd-quick-action-list">
          <button type="button" onClick={handleBookAppointment}><Calendar size={17} />Book Appointment<ChevronRight size={16} /></button><button type="button" onClick={() => navigate("/patient/prescriptions")}><Pill size={17} />View Prescriptions<ChevronRight size={16} /></button><button type="button" onClick={handleViewRecords}><FileText size={17} />View Medical Records<ChevronRight size={16} /></button><button type="button" onClick={() => navigate("/patient/bills")}><IndianRupee size={17} />View Bills &amp; Payments<ChevronRight size={16} /></button>
        </div></section>
        <section className="pd-card pd-notifications-panel"><div className="pd-section-header"><div><h2>Recent Notifications</h2></div><button type="button" className="pd-link-button" onClick={handleViewAllNotifications}>View all</button></div><div className="pd-notification-list">{notificationItems.map((notification) => <button key={notification.id} type="button" className={`pd-notification-item ${notification.read ? "is-read" : "is-unread"}`} onClick={() => setSelectedNotificationId(notification.id)}><Bell size={16} /><span className="pd-notification-body"><strong>{notification.message}</strong></span><em>{notification.date}</em></button>)}</div></section>
      </div>
    </div>
  );

  /* Previous dashboard markup is intentionally retained below for reference while the UI above is active.
  return (
    <div className="patient-dashboard">
      <div className="pd-header">
        <div className="pd-header-copy">
          <h1 className="pd-greeting-title">Patient Dashboard</h1>
          <p className="pd-greeting-subtitle">Keep track of appointments, care history, prescriptions, and billing in one place.</p>
        </div>
        <div className="pd-header-actions">
          <button type="button" className="pd-header-btn pd-header-btn--primary" onClick={handleBookAppointment}>
            <Calendar size={16} />
            Book appointment
          </button>
          <button type="button" className="pd-header-btn" onClick={handleViewDetails}>
            <FileText size={16} />
            View records
          </button>
        </div>
      </div>

      <div className="pd-hero-grid">
        <section className="pd-card pd-token-panel">
          <div className="pd-token-panel-header">
            <span className="pd-eyebrow">Live queue</span>
            <h2>Current Token</h2>
          </div>

          <div className="pd-current-token-group">
            <span className="pd-current-token-label">Your token number</span>
            <strong className="pd-current-token">{tokenValue}</strong>
            <p className="pd-current-token-subtitle">
              You will be notified when your token is about to be called.
            </p>
          </div>

          <div className="pd-token-summary-grid">
            <div className="pd-token-stat">
              <span>Patients Ahead</span>
              <strong>{patientsAheadLabel}</strong>
            </div>
            <div className="pd-token-stat">
              <span>Estimated Waiting Time</span>
              <strong>{estimatedWaitingTimeLabel}</strong>
            </div>
            <div className="pd-token-stat">
              <span>Today's Appointment</span>
              <strong>{appointmentDate ? `${appointmentDate}${appointmentTime ? ` • ${appointmentTime}` : ""}` : "Not scheduled"}</strong>
            </div>
          </div>
        </section>

        <section className="pd-summary-panel">
          <button type="button" className="pd-summary-card pd-summary-card--appointment" onClick={hasAppointment ? handleViewAppointmentDetails : handleBookAppointment}>
            <div className="pd-summary-card-icon">
              <Calendar size={18} />
            </div>
            <div className="pd-summary-card-copy">
              <span>Today's Appointment</span>
              <strong>{hasAppointment ? `${appointmentDate}${appointmentTime ? ` • ${appointmentTime}` : ""}` : "No appointment scheduled"}</strong>
              <p>{hasAppointment ? `${appointmentDoctor} · ${appointmentClinic}` : "Book your appointment to see details."}</p>
            </div>
          </button>

          <button type="button" className="pd-summary-card pd-summary-card--billing" onClick={() => navigate("/patient/bills")}> 
            <div className="pd-summary-card-icon">
              <IndianRupee size={18} />
            </div>
            <div className="pd-summary-card-copy">
              <span>Billing</span>
              <strong>{formatCurrency(billCardValue)}</strong>
            </div>
          </button>

          <button type="button" className="pd-summary-card pd-summary-card--records" onClick={handleViewRecords}>
            <div className="pd-summary-card-icon">
              <FileText size={18} />
            </div>
            <div className="pd-summary-card-copy">
              <span>Health Records</span>
              <strong>{formatCount(medicalRecordCount)} records</strong>
            </div>
          </button>
        </section>
      </div>

      <div className="pd-main-content">
        <div className="pd-left-column">
          <section className="pd-card pd-queue-panel">
            <div className="pd-section-header">
              <div>
                <h2>Live Queue Status</h2>
                <p>Real-time token progress</p>
              </div>
            </div>

            <div className="pd-queue-status-grid">
              <div className="pd-queue-status-item pd-queue-status-item--completed">
                <span>Completed</span>
                <strong>{queueCounts.completed}</strong>
              </div>
              <div className="pd-queue-status-item pd-queue-status-item--inprogress">
                <span>In Consultation</span>
                <strong>{queueCounts.inConsultation}</strong>
              </div>
              <div className="pd-queue-status-item pd-queue-status-item--waiting">
                <span>Waiting</span>
                <strong>{queueCounts.waiting}</strong>
              </div>
            </div>

            <div className="pd-queue-note">
              <span>You are here</span>
              <strong>{tokenValue}</strong>
            </div>
          </section>
        </div>

        <div className="pd-right-column">
          <section className="pd-card pd-actions-panel">
            <div className="pd-section-header">
              <div>
                <h2>Quick Actions</h2>
                <p>Common patient portal shortcuts.</p>
              </div>
            </div>

            <div className="pd-action-grid">
              <button type="button" className="pd-action-tile pd-action-tile--primary" onClick={handleBookAppointment}>
                <Calendar size={22} />
                <span>Book Appointment</span>
              </button>
              <button type="button" className="pd-action-tile" onClick={handleViewRecords}>
                <FileText size={22} />
                <span>View Records</span>
              </button>
              <button type="button" className="pd-action-tile" onClick={() => navigate("/patient/prescriptions") }>
                <Pill size={22} />
                <span>View Prescriptions</span>
              </button>
              <button type="button" className="pd-action-tile" onClick={() => navigate("/patient/bills") }>
                <IndianRupee size={22} />
                <span>View Bills & Payments</span>
              </button>
            </div>
          </section>

          <section className="pd-card pd-notifications-panel">
          <div className="pd-section-header">
            <div>
              <h2>Upcoming Appointment</h2>
              <p>Next scheduled visit and clinic details.</p>
            </div>
            <span className="pd-status-badge">{appointmentStatus}</span>
          </div>

          <div className="pd-appointment-card">
            <div className="pd-doctor-info">
              <div className="pd-doctor-avatar">{appointmentAvatar}</div>
              <div className="pd-doctor-details">
                <h3 className="pd-doctor-name">{appointmentDoctor}</h3>
                <p className="pd-doctor-specialty">{appointmentSpecialization}</p>
                <p className="pd-doctor-clinic">{appointmentClinic}</p>
              </div>
            </div>

            {hasAppointment ? (
              <>
                <div className="pd-details-grid">
                  <div className="pd-detail-row">
                    <Clock size={16} />
                    <span>{appointmentDate ? `${appointmentDate}${appointmentTime ? ` at ${appointmentTime}` : ""}` : appointmentStatus}</span>
                  </div>
                  <div className="pd-detail-row">
                    <MapPin size={16} />
                    <span>{appointmentLocation}</span>
                  </div>
                </div>

                <div className="pd-appointment-actions">
                  <button type="button" className="pd-action-btn pd-action-btn--primary" onClick={handleViewAppointmentDetails}>
                    View details
                  </button>
                  <button type="button" className="pd-action-btn" onClick={handleReschedule}>
                    Reschedule
                  </button>
                </div>
              </>
            ) : (
              <div className="pd-empty-state">
                <p>No upcoming appointment is available from the backend yet.</p>
                <button type="button" className="pd-action-btn pd-action-btn--primary" onClick={handleBookAppointment}>
                  Book Appointment
                </button>
              </div>
            )}

            <div className="pd-profile-strip">
              <div>
                <span>Patient ID</span>
                <strong>{selectedPatientId}</strong>
              </div>
              <div>
                <span>Contact</span>
                <strong>{selectedPatientPhone}</strong>
              </div>
              <div>
                <span>Blood group</span>
                <strong>{selectedPatientBloodGroup}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="pd-card pd-notifications-panel">
          <div className="pd-section-header">
            <div>
              <h2>
                <Bell size={18} />
                Notifications:
              </h2>
              <p>Recent updates from the care team and billing desk.</p>
            </div>
            <button type="button" className="pd-link-button" onClick={handleViewAllNotifications}>
              View all
            </button>
          </div>

          <div className="pd-notification-list">
            {notificationItems.length ? (
              notificationItems.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={`pd-notification-item ${notification.id === selectedNotificationId ? "is-active" : ""} ${notification.read ? "is-read" : "is-unread"}`}
                  onClick={() => setSelectedNotificationId(notification.id)}
                >
                  <span className="pd-notification-dot" />
                  <span className="pd-notification-body">
                    <strong>{notification.title}</strong>
                    <span>{notification.message}</span>
                    <em>{notification.date}</em>
                  </span>
                  <ChevronRight size={16} className="pd-notification-chevron" />
                </button>
              ))
            ) : (
              <div className="pd-empty-state pd-empty-state--compact">
                <p>{notificationSummary}</p>
              </div>
            )}
          </div>

        </section>
      </div>

        <section className="pd-card pd-appointment-panel">
          <div className="pd-section-header">
            <div>
              <h2>Upcoming Appointment</h2>
              <p>Next scheduled visit and clinic details.</p>
            </div>
            <span className="pd-status-badge">{appointmentStatus}</span>
          </div>

          <div className="pd-appointment-card">
            <div className="pd-doctor-info">
              <div className="pd-doctor-avatar">{appointmentAvatar}</div>
              <div className="pd-doctor-details">
                <h3 className="pd-doctor-name">{appointmentDoctor}</h3>
                <p className="pd-doctor-specialty">{appointmentSpecialization}</p>
                <p className="pd-doctor-clinic">{appointmentClinic}</p>
              </div>
            </div>

            {hasAppointment ? (
              <>
                <div className="pd-details-grid">
                  <div className="pd-detail-row">
                    <Clock size={16} />
                    <span>{appointmentDate ? `${appointmentDate}${appointmentTime ? ` at ${appointmentTime}` : ""}` : appointmentStatus}</span>
                  </div>
                  <div className="pd-detail-row">
                    <MapPin size={16} />
                    <span>{appointmentLocation}</span>
                  </div>
                </div>

                <div className="pd-appointment-actions">
                  <button type="button" className="pd-action-btn pd-action-btn--primary" onClick={handleViewAppointmentDetails}>
                    View details
                  </button>
                  <button type="button" className="pd-action-btn" onClick={handleReschedule}>
                    Reschedule
                  </button>
                </div>
              </>
            ) : (
              <div className="pd-empty-state">
                <p>No upcoming appointment is available from the backend yet.</p>
                <button type="button" className="pd-action-btn pd-action-btn--primary" onClick={handleBookAppointment}>
                  Book Appointment
                </button>
              </div>
            )}

            <div className="pd-profile-strip">
              <div>
                <span>Patient ID</span>
                <strong>{selectedPatientId}</strong>
              </div>
              <div>
                <span>Contact</span>
                <strong>{selectedPatientPhone}</strong>
              </div>
              <div>
                <span>Blood group</span>
                <strong>{selectedPatientBloodGroup}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="pd-card pd-actions-panel">
          <div className="pd-section-header">
            <div>
              <h2>Quick actions</h2>
              <p>Frequent shortcuts for the patient portal.</p>
            </div>
          </div>

          <div className="pd-action-grid">
            <button type="button" className="pd-action-tile pd-action-tile--primary" onClick={handleBookAppointment}>
              <Calendar size={22} />
              <span>Book Appointment</span>
            </button>
            <button type="button" className="pd-action-tile" onClick={handleViewRecords}>
              <FileText size={22} />
              <span>View Records</span>
            </button>
            <button type="button" className="pd-action-tile" onClick={() => navigate("/patient/prescriptions")}>
              <Pill size={22} />
              <span>View Prescriptions</span>
            </button>
            <button type="button" className="pd-action-tile" onClick={() => navigate("/patient/bills")}>
              <IndianRupee size={22} />
              <span>View Bills & Payments</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
  */
}

export default PatientDashboard;
