import React from "react";
import ReceptionMedicalHistory from "../Recepitionist/pages/ReceptionMedicalHistory";
import { nursePatientsRequestJson } from "./NursePatients";
import { getNurseScope, scopeNurseRecords } from "./nurseScope";

const NURSE_MEDICAL_HISTORY_STORAGE_KEY = "nurseMedicalHistoryRecords";

const strictScopeNurseRecords = (records = [], scope = getNurseScope()) =>
  scopeNurseRecords(records, scope, {
    allowMissingClinic: false,
    allowMissingBranch: false,
  });

const readLocalHistories = () => {
  try {
    const records = JSON.parse(localStorage.getItem(NURSE_MEDICAL_HISTORY_STORAGE_KEY) || "[]");
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
};

const writeLocalHistories = (records) => {
  try {
    localStorage.setItem(NURSE_MEDICAL_HISTORY_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Backend permission is the source of truth when available; local fallback is best effort.
  }
};

const getLocalPatientHistory = (patientId) =>
  strictScopeNurseRecords(readLocalHistories()).find((record) => String(record.patientId) === String(patientId)) || null;

const normalizePatientHistoryResponse = (data, patientId) => {
  const records = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.records)
        ? data.records
        : Array.isArray(data?.result)
          ? data.result
          : data
            ? [data]
            : [];
  const matchedRecords = records
    .filter(Boolean)
    .filter((record) => {
      const recordPatientId =
        record.patientId ||
        record.PatientId ||
        record.patient?.id ||
        record.patient?.patientId ||
        record.Patient?.Id ||
        record.Patient?.PatientId ||
        "";
      return !recordPatientId || String(recordPatientId) === String(patientId);
    })
    .map((record) => ({
      ...record,
      patientId: record.patientId || record.PatientId || patientId,
    }));

  if (!matchedRecords.length) return null;
  return matchedRecords.length === 1 ? matchedRecords[0] : matchedRecords;
};

const deleteLocalHistory = (historyId) => {
  const nextRecords = readLocalHistories().filter(
    (record) =>
      String(record.id || record.medicalHistoryId || record.historyId) !== String(historyId) &&
      String(record.patientId) !== String(historyId)
  );
  writeLocalHistories(nextRecords);
};

const tryRequests = async (requests, fallback) => {
  let lastError = null;

  for (const request of requests) {
    try {
      return await request();
    } catch (error) {
      lastError = error;
    }
  }

  if (fallback !== undefined) return typeof fallback === "function" ? fallback(lastError) : fallback;
  throw lastError || new Error("Request failed.");
};

export const nurseMedicalHistoryRequestJson = async (path, options = {}) => {
  const raw = String(path || "").replace(/^\/+/, "");
  const method = String(options.method || "GET").toUpperCase();
  const patientHistoryMatch = raw.match(/^MedicalHistory\/([^/?]+)$/i);

  if (method === "GET" && patientHistoryMatch) {
    const patientId = patientHistoryMatch[1];
    return tryRequests(
      [
        () =>
          nursePatientsRequestJson(`MedicalHistory/all/${patientId}`, options).then((data) =>
            normalizePatientHistoryResponse(data, patientId)
          ),
        () =>
          nursePatientsRequestJson(raw, options).then((data) =>
            normalizePatientHistoryResponse(data, patientId)
          ),
      ],
      () => getLocalPatientHistory(patientId)
    );
  }

  if (method === "POST" && /^MedicalHistory$/i.test(raw)) {
    const response = await nursePatientsRequestJson(raw, options);
    try {
      const body = JSON.parse(options.body || "{}");
      if (body.patientId) {
        const saved = response && typeof response === "object" ? response : body;
        const records = readLocalHistories().filter(
          (record) => String(record.patientId) !== String(body.patientId)
        );
        writeLocalHistories([...records, { ...body, ...saved, patientId: saved.patientId || body.patientId }]);
      }
    } catch {
      // Ignore local cache failures; the backend response already succeeded.
    }
    return response;
  }

  if (method === "DELETE" && patientHistoryMatch) {
    const historyId = patientHistoryMatch[1];
    return tryRequests(
      [
        () => nursePatientsRequestJson(raw, options),
      ],
      () => {
        deleteLocalHistory(historyId);
        return { ok: true };
      }
    );
  }

  if (method === "POST" && /^Appointment\/([^/]+)\/documents$/i.test(raw)) {
    const appointmentId = raw.match(/^Appointment\/([^/]+)\/documents$/i)?.[1];
    return tryRequests(
      [
        () => nursePatientsRequestJson(`Nurse/appointments/${appointmentId}/documents`, options),
        () => nursePatientsRequestJson(raw, options),
      ],
      { ok: true }
    );
  }

  return nursePatientsRequestJson(path, options);
};

function NurseMedicalHistory() {
  return (
    <ReceptionMedicalHistory
      basePath="/nurse"
      apiRequest={nurseMedicalHistoryRequestJson}
      getScope={getNurseScope}
      scopeRecords={strictScopeNurseRecords}
      buildHistoryPayload={(payload) => payload}
    />
  );
}

export default NurseMedicalHistory;
