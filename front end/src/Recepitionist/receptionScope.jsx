import { getReceptionistProfile } from "./receptionSession";

const firstValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");

const normalizeId = (value) => String(value ?? "").trim();
const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

export const getRecordClinicId = (record = {}) =>
  normalizeId(
    firstValue(
      record.hospitalId,
      record.HospitalId,
      record.clinicId,
      record.ClinicId,
      record.assignedClinicId,
      record.AssignedClinicId,
      record.patient?.hospitalId,
      record.patient?.clinicId,
      record.Patient?.HospitalId,
      record.Patient?.ClinicId,
      record.appointment?.hospitalId,
      record.appointment?.clinicId,
      record.Appointment?.HospitalId,
      record.Appointment?.ClinicId,
      record.doctor?.hospitalId,
      record.doctor?.clinicId,
      record.Doctor?.HospitalId,
      record.Doctor?.ClinicId,
      record.hospital?.id,
      record.clinic?.id
    )
  );

export const getRecordBranchId = (record = {}) =>
  normalizeId(
    firstValue(
      record.branchId,
      record.BranchId,
      record.branchID,
      record.BranchID,
      record.assignedBranchId,
      record.AssignedBranchId,
      record.patient?.branchId,
      record.patient?.BranchId,
      record.Patient?.BranchId,
      record.appointment?.branchId,
      record.appointment?.BranchId,
      record.Appointment?.BranchId,
      record.doctor?.branchId,
      record.doctor?.BranchId,
      record.Doctor?.BranchId,
      record.branch?.id,
      record.branch?.branchId,
      record.Branch?.Id
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
      record.Patient?.BranchName,
      record.appointment?.branchName,
      record.appointment?.BranchName,
      record.Appointment?.BranchName,
      record.doctor?.branchName,
      record.doctor?.BranchName,
      record.Doctor?.BranchName,
      record.branch?.name,
      record.branch?.branchName,
      record.Branch?.Name,
      record.Branch?.BranchName
    )
  );

export const getReceptionistScope = () => {
  const profile = getReceptionistProfile();
  return {
    clinicId: normalizeId(profile.hospitalId),
    branchId: normalizeId(profile.branchId),
    branchName: normalizeText(profile.branchName),
  };
};

export const belongsToReceptionistScope = (
  record = {},
  scope = getReceptionistScope(),
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
  ) return false;

  return true;
};

export const scopeReceptionistRecords = (
  records = [],
  scope = getReceptionistScope(),
  options = {}
) =>
  records.filter((record) => belongsToReceptionistScope(record, scope, options));

export const withReceptionistScopePayload = (payload = {}, scope = getReceptionistScope()) => ({
  ...payload,
  hospitalId: Number(scope.clinicId) || payload.hospitalId || 0,
  clinicId: Number(scope.clinicId) || payload.clinicId || 0,
  branchId: Number(scope.branchId) || payload.branchId || 0,
});
