import { apiUrl } from "../config/api";

const LAB_MASTER_CACHE_KEY = "labMasterTestsCache";
const LAB_MASTER_IMPORTED_FILE_KEY = "labMasterImportedFileRows";
const LAB_MASTER_TIMEOUT_MS = 5000;

export const parseLabMasterList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.tests)) return data.tests;
  if (Array.isArray(data?.labTests)) return data.labTests;
  if (Array.isArray(data?.diagnosisTests)) return data.diagnosisTests;

  if (data && typeof data === "object") {
    const queue = [data];
    const seen = new Set();
    while (queue.length) {
      const current = queue.shift();
      if (!current || typeof current !== "object" || seen.has(current)) continue;
      seen.add(current);

      for (const value of Object.values(current)) {
        if (Array.isArray(value)) return value;
        if (value && typeof value === "object") queue.push(value);
      }
    }
  }

  return [];
};

const firstValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");

const readAmount = (...values) => {
  const value = firstValue(...values);
  const amount = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
};

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const readToken = () => {
  const path = String(window.location?.pathname || "").toLowerCase();
  const keys = path.startsWith("/doctor")
    ? ["doctorToken", "token", "receptionistToken", "receptionToken", "labToken", "adminToken", "superAdminToken", "authToken"]
    : path.startsWith("/reception")
      ? ["receptionistToken", "receptionToken", "token", "doctorToken", "labToken", "adminToken", "superAdminToken", "authToken"]
      : path.startsWith("/lab")
        ? ["labToken", "token", "receptionistToken", "doctorToken", "adminToken", "superAdminToken", "authToken"]
        : [
            "adminToken",
            "superAdminToken",
            "token",
            "receptionistToken",
            "receptionToken",
            "doctorToken",
            "labToken",
            "nurseToken",
            "authToken",
          ];
  return keys.map((key) => localStorage.getItem(key)).find(Boolean) || "";
};

const readTokenCandidates = () => {
  const pathToken = readToken();
  return Array.from(new Set([
    pathToken,
    localStorage.getItem("doctorToken"),
    localStorage.getItem("receptionistToken"),
    localStorage.getItem("receptionToken"),
    localStorage.getItem("labToken"),
    localStorage.getItem("adminToken"),
    localStorage.getItem("superAdminToken"),
    localStorage.getItem("token"),
    localStorage.getItem("authToken"),
    "",
  ].filter((value) => value !== null && value !== undefined)));
};

export const normalizeLabTest = (item = {}) => {
  const testName = firstValue(
    item.testName,
    item.TestName,
    item.name,
    item.Name,
    item.item,
    item.Item,
    item.serviceName,
    item.ServiceName,
    item.test,
    item.Test
  );
  const category = firstValue(item.category, item.Category, item.department, item.Department, item.group, item.Group);
  const specialization = firstValue(
    item.specialization,
    item.Specialization,
    item.doctorSpecialization,
    item.DoctorSpecialization,
    item.speciality,
    item.Speciality,
    category
  );

  return {
    ...item,
    id: firstValue(item.id, item.Id, item.testId, item.TestId, item.labTestId, item.LabTestId, item.testCode, item.TestCode),
    diagnosis: firstValue(item.diagnosis, item.Diagnosis, category, specialization, "Lab"),
    item: String(testName || "").trim(),
    testName: String(testName || "").trim(),
    category: String(category || "").trim(),
    specialization: String(specialization || "").trim(),
    price: readAmount(item.price, item.Price, item.amount, item.Amount, item.rate, item.Rate, item.fee, item.Fee),
    isActive: firstValue(item.isActive, item.IsActive, item.active, item.Active, true) !== false,
  };
};

export const normalizeLabTests = (data) => {
  const seen = new Set();
  return parseLabMasterList(data)
    .map(normalizeLabTest)
    .filter((test) => test.item)
    .filter((test) => {
      const key = normalize(test.item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const cacheLabMasterTests = (tests = []) => {
  try {
    localStorage.setItem(LAB_MASTER_CACHE_KEY, JSON.stringify(normalizeLabTests(tests)));
  } catch {
    // Cache is best effort for sharing imported lab files across modules.
  }
};

export const saveImportedLabFileRows = (rows = []) => {
  try {
    const normalized = normalizeLabTests(rows);
    localStorage.setItem(LAB_MASTER_IMPORTED_FILE_KEY, JSON.stringify(normalized));
    localStorage.setItem(LAB_MASTER_CACHE_KEY, JSON.stringify(normalized));
  } catch {
    // Best effort local persistence for imported lab files.
  }
};

export const getImportedLabFileRows = () => {
  try {
    return normalizeLabTests(JSON.parse(localStorage.getItem(LAB_MASTER_IMPORTED_FILE_KEY) || "[]"));
  } catch {
    return [];
  }
};

export const getCachedLabMasterTests = () => {
  try {
    return [
      ...getImportedLabFileRows(),
      ...normalizeLabTests(JSON.parse(localStorage.getItem(LAB_MASTER_CACHE_KEY) || "[]")),
    ].filter((test, index, list) => {
      const key = String(test.testName || test.item || test.id || "").trim().toLowerCase();
      return key && list.findIndex((item) => String(item.testName || item.item || item.id || "").trim().toLowerCase() === key) === index;
    });
  } catch {
    return [];
  }
};

export const filterLabTestsBySpecialization = (tests = [], specialization = "") => {
  const activeTests = tests.filter((test) => test.isActive !== false);
  const normalizedSpecialization = normalize(specialization);
  if (!normalizedSpecialization) return activeTests;

  const matched = activeTests.filter((test) => {
    const text = normalize(
      [
        test.specialization,
        test.category,
        test.department,
        test.Department,
        test.group,
        test.Group,
        test.referenceRange,
        test.ReferenceRange,
      ].filter(Boolean).join(" ")
    );
    return text && (text.includes(normalizedSpecialization) || normalizedSpecialization.includes(text));
  });

  return matched.length ? matched : activeTests;
};

export const fetchLabMasterTests = async () => {
  const cached = getCachedLabMasterTests();
  if (cached.length) return cached;

  let lastError = null;

  for (const token of readTokenCandidates()) {
    const headers = { "ngrok-skip-browser-warning": "true" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), LAB_MASTER_TIMEOUT_MS);

    try {
      const response = await fetch(apiUrl("Lab/master"), { headers, signal: controller.signal });
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        lastError = new Error(data?.message || data?.title || `Unable to load lab test master (${response.status}).`);
        continue;
      }
      const tests = normalizeLabTests(data);
      if (tests.length) cacheLabMasterTests(tests);
      return tests;
    } catch (error) {
      lastError = error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw lastError || new Error("Unable to load lab test master.");
};
