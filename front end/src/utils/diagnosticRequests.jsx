const STORAGE_KEY = "pendingDiagnosticRequests";

const readRequests = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeRequests = (requests = []) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests.slice(0, 100)));
  } catch {
    // Best-effort bridge between doctor and receptionist modules.
  }
};

const normalize = (value) => String(value ?? "").trim().toLowerCase();

export const savePendingDiagnosticRequest = (request = {}) => {
  const tests = Array.isArray(request.tests)
    ? request.tests.map((test) => String(test || "").trim()).filter(Boolean)
    : String(request.tests || "")
        .split(",")
        .map((test) => test.trim())
        .filter(Boolean);
  if (!tests.length) return;

  const nextRequest = {
    ...request,
    tests,
    appointmentId: String(request.appointmentId || ""),
    patientId: String(request.patientId || ""),
    patientName: String(request.patientName || ""),
    createdAt: new Date().toISOString(),
  };

  const requests = readRequests().filter((item) => {
    if (nextRequest.appointmentId && String(item.appointmentId) === nextRequest.appointmentId) return false;
    if (nextRequest.patientId && String(item.patientId) === nextRequest.patientId) return false;
    return normalize(item.patientName) !== normalize(nextRequest.patientName);
  });
  writeRequests([nextRequest, ...requests]);
  window.dispatchEvent(new CustomEvent("diagnosticRequestCreated", { detail: nextRequest }));
};

export const getPendingDiagnosticRequest = ({ appointmentId = "", patientId = "", patientName = "" } = {}) => {
  const normalizedName = normalize(patientName);
  return readRequests().find((item) => {
    if (appointmentId && String(item.appointmentId) === String(appointmentId)) return true;
    if (patientId && String(item.patientId) === String(patientId)) return true;
    return normalizedName && normalize(item.patientName) === normalizedName;
  }) || null;
};

export const clearPendingDiagnosticRequest = ({ appointmentId = "", patientId = "", patientName = "" } = {}) => {
  const normalizedName = normalize(patientName);
  writeRequests(readRequests().filter((item) => {
    if (appointmentId && String(item.appointmentId) === String(appointmentId)) return false;
    if (patientId && String(item.patientId) === String(patientId)) return false;
    return !(normalizedName && normalize(item.patientName) === normalizedName);
  }));
};
