import { apiUrl } from "../config/api";

export const MOBILE_DUPLICATE_MESSAGE = "Mobile number already exists.";

export const normalizeMobileNumber = (value) =>
  String(value ?? "").replace(/\D/g, "");

const PHONE_KEYS = [
  "phone",
  "Phone",
  "phoneNumber",
  "PhoneNumber",
  "mobile",
  "Mobile",
  "mobileNumber",
  "MobileNumber",
  "contactNumber",
  "ContactNumber",
];

const ID_KEYS = [
  "id",
  "Id",
  "_id",
  "doctorId",
  "DoctorId",
  "patientId",
  "PatientId",
  "receptionistId",
  "ReceptionistId",
  "clinicId",
  "ClinicId",
  "userId",
  "UserId",
  "adminId",
  "AdminId",
];

const UNIQUE_PHONE_SOURCES = [
  { source: "Doctor", path: "Doctor" },
  { source: "Receptionist", path: "Receptionist" },
  { source: "Patient", path: "Patient" },
  { source: "Clinics", path: "Clinics" },
  { source: "admins", path: "admins" },
  { source: "users", path: "users" },
];

const parseListResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.result)) return data.result;
  return [];
};

const getRecordId = (record = {}) => {
  for (const key of ID_KEYS) {
    const value = record?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return "";
};

const getRecordPhones = (record = {}) =>
  PHONE_KEYS.map((key) => normalizeMobileNumber(record?.[key])).filter(Boolean);

const isSameRecord = (record, source, current = {}) => {
  if (!current.id) return false;
  if (current.source && current.source !== source) return false;
  return getRecordId(record) === String(current.id).trim();
};

const hasDuplicateInRecords = (records = [], phone, source, current = {}) =>
  records.some(
    (record) =>
      !isSameRecord(record, source, current) &&
      getRecordPhones(record).includes(phone)
  );

const fetchSourceRecords = async ({ path }) => {
  const response = await fetch(apiUrl(path), {
    headers: {
      "ngrok-skip-browser-warning": "true",
    },
  });

  if (!response.ok) return [];
  return parseListResponse(await response.json());
};

export const findDuplicateMobileNumber = async (
  mobileNumber,
  {
    current = {},
    localRecords = [],
    localSource = "",
    sources = UNIQUE_PHONE_SOURCES,
  } = {}
) => {
  const phone = normalizeMobileNumber(mobileNumber);
  if (!phone) return null;

  if (
    localRecords.length &&
    hasDuplicateInRecords(localRecords, phone, localSource, current)
  ) {
    return { source: localSource || "local" };
  }

  const results = await Promise.allSettled(
    sources.map(async (sourceConfig) => ({
      ...sourceConfig,
      records: await fetchSourceRecords(sourceConfig),
    }))
  );

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const { source, records } = result.value;
    if (hasDuplicateInRecords(records, phone, source, current)) {
      return { source };
    }
  }

  return null;
};

export const validateUniqueMobileNumber = async (mobileNumber, options) =>
  (await findDuplicateMobileNumber(mobileNumber, options))
    ? MOBILE_DUPLICATE_MESSAGE
    : "";
