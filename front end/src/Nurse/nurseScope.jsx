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
      record.patient?.HospitalId,
      record.patient?.ClinicId,
      record.Patient?.hospitalId,
      record.Patient?.clinicId,
      record.Patient?.HospitalId,
      record.Patient?.ClinicId,
      record.appointment?.hospitalId,
      record.appointment?.clinicId,
      record.appointment?.HospitalId,
      record.appointment?.ClinicId,
      record.Appointment?.hospitalId,
      record.Appointment?.clinicId,
      record.Appointment?.HospitalId,
      record.Appointment?.ClinicId
    )
  );

export const getRecordBranchId = (record = {}) =>
  normalizeId(
    firstValue(
      record.branchId,
      record.BranchId,
      record.branchID,
      record.BranchID,
      record.clinicBranchId,
      record.ClinicBranchId,
      record.patient?.branchId,
      record.patient?.BranchId,
      record.patient?.branchID,
      record.patient?.BranchID,
      record.patient?.clinicBranchId,
      record.patient?.ClinicBranchId,
      record.Patient?.branchId,
      record.Patient?.BranchId,
      record.Patient?.clinicBranchId,
      record.Patient?.ClinicBranchId,
      record.appointment?.branchId,
      record.appointment?.BranchId,
      record.appointment?.clinicBranchId,
      record.appointment?.ClinicBranchId,
      record.Appointment?.branchId,
      record.Appointment?.BranchId,
      record.Appointment?.clinicBranchId,
      record.Appointment?.ClinicBranchId
    )
  );

export const getRecordBranchName = (record = {}) =>
  normalizeText(
    firstValue(
      record.branchName,
      record.BranchName,
      record.branch,
      record.Branch,
      record.patient?.branchName,
      record.patient?.BranchName,
      record.patient?.branch,
      record.patient?.Branch,
      record.Patient?.branchName,
      record.Patient?.BranchName,
      record.Patient?.branch,
      record.Patient?.Branch,
      record.appointment?.branchName,
      record.appointment?.BranchName,
      record.appointment?.branch,
      record.appointment?.Branch,
      record.Appointment?.branchName,
      record.Appointment?.BranchName,
      record.Appointment?.branch,
      record.Appointment?.Branch
    )
  );

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
