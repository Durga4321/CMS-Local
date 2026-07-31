import { getNurseProfile } from "./nurseSession";

const firstValue = (...values) => values.find((v) => v !== undefined && v !== null && String(v).trim() !== "");
const normalizeId = (value) => String(value ?? "").trim();
const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

export const getRecordClinicId = (record = {}) =>
  normalizeId(
    firstValue(
      record.hospitalId,
      record.HospitalId,
      record.clinicId,
      record.ClinicId,
      record.patient?.hospitalId,
      record.patient?.clinicId,
      record.appointment?.hospitalId,
      record.appointment?.clinicId
    )
  );

export const getRecordBranchId = (record = {}) =>
  normalizeId(firstValue(record.branchId, record.BranchId, record.patient?.branchId, record.appointment?.branchId));

export const getRecordBranchName = (record = {}) =>
  normalizeText(firstValue(record.branchName, record.BranchName, record.patient?.branchName, record.appointment?.branchName));

export const getNurseScope = () => {
  const profile = getNurseProfile();
  return {
    clinicId: normalizeId(profile.hospitalId),
    branchId: normalizeId(profile.branchId),
    branchName: normalizeText(profile.branchName),
  };
};

export const belongsToNurseScope = (
  record = {},
  scope = getNurseScope(),
  { allowMissingClinic = false, allowMissingBranch = false } = {}
) => {
  const clinicId = normalizeId(scope.clinicId);
  const branchId = normalizeId(scope.branchId);
  const branchName = normalizeText(scope.branchName);
  const recordClinicId = getRecordClinicId(record);
  const recordBranchId = getRecordBranchId(record);
  const recordBranchName = getRecordBranchName(record);

  if (clinicId && recordClinicId !== clinicId && !(allowMissingClinic && !recordClinicId)) return false;
  if (
    branchId &&
    recordBranchId !== branchId &&
    !(branchName && recordBranchName === branchName) &&
    !(allowMissingBranch && !recordBranchId && !recordBranchName)
  )
    return false;

  return true;
};

export const scopeNurseRecords = (records = [], scope = getNurseScope(), options = {}) =>
  records.filter((record) => belongsToNurseScope(record, scope, options));

export const withNurseScopePayload = (payload = {}, scope = getNurseScope()) => ({
  ...payload,
  hospitalId: Number(scope.clinicId) || payload.hospitalId || 0,
  clinicId: Number(scope.clinicId) || payload.clinicId || 0,
  branchId: Number(scope.branchId) || payload.branchId || 0,
  branchName: scope.branchName || payload.branchName || "",
});

export default {
  getNurseScope,
  belongsToNurseScope,
  scopeNurseRecords,
  withNurseScopePayload,
};
