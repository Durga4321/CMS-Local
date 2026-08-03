import React from "react";
import ReceptionMedicalHistory from "../Recepitionist/pages/ReceptionMedicalHistory";
import { nursePatientsRequestJson } from "./NursePatients";
import { getNurseScope, scopeNurseRecords, withNurseScopePayload } from "./nurseScope";

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

const upsertLocalHistory = (history) => {
  const scopedHistory = withNurseScopePayload(history);
  const patientId = String(scopedHistory.patientId || scopedHistory.PatientId || "").trim();
  const id = scopedHistory.id || scopedHistory.medicalHistoryId || scopedHistory.historyId || `local-${patientId || Date.now()}`;
  const nextRecord = {
    ...scopedHistory,
    id,
    medicalHistoryId: id,
    patientId,
    updatedAt: new Date().toISOString(),
  };
  const nextRecords = [
    nextRecord,
    ...readLocalHistories().filter(
      (record) =>
        String(record.id || record.medicalHistoryId || record.historyId) !== String(id) &&
        String(record.patientId) !== patientId
    ),
  ];
  writeLocalHistories(nextRecords);
  return nextRecord;
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
        () => nursePatientsRequestJson(`Nurse/medical-history/${patientId}`, options),
        () => nursePatientsRequestJson(`Nurse/patients/${patientId}/medical-history`, options),
        () => nursePatientsRequestJson(raw, options),
      ],
      () => getLocalPatientHistory(patientId)
    );
  }

  if (method === "POST" && /^MedicalHistory$/i.test(raw)) {
    const body = JSON.parse(options.body || "{}");
    return tryRequests(
      [
        () => nursePatientsRequestJson("Nurse/medical-history", options),
        () => nursePatientsRequestJson(raw, options),
      ],
      () => upsertLocalHistory(body)
    );
  }

  if (method === "DELETE" && patientHistoryMatch) {
    const historyId = patientHistoryMatch[1];
    return tryRequests(
      [
        () => nursePatientsRequestJson(`Nurse/medical-history/${historyId}`, options),
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
    />
  );
}

export default NurseMedicalHistory;
