import React from "react";
import ReceptionPatients from "../Recepitionist/pages/ReceptionPatients";
import {
  getOfflineAppointments,
  getOnlineAppointments,
  parseList,
  requestJson as nurseRequestJson,
} from "../Recepitionist/receptionApi";
import { getNurseScope, scopeNurseRecords } from "./nurseScope";

const firstText = (...values) =>
  values
    .map((value) => String(value ?? "").trim())
    .find(Boolean) || "";

const normalizePhone = (value) => String(value || "").replace(/\D/g, "");

const getPatientId = (patient = {}) =>
  firstText(patient.id, patient.patientId, patient.PatientId, patient.PID);

const getPatientPhone = (patient = {}) =>
  normalizePhone(firstText(patient.phone, patient.Phone, patient.mobile, patient.phoneNumber, patient.mobileNumber));

const getAppointmentPatient = (appointment = {}) => ({
  id: firstText(
    appointment.patientId,
    appointment.PatientId,
    appointment.pid,
    appointment.PID,
    appointment.patient?.id,
    appointment.patient?.patientId,
    appointment.patient?.PatientId,
    appointment.Patient?.Id,
    appointment.Patient?.PatientId
  ),
  name: firstText(
    appointment.patientName,
    appointment.PatientName,
    appointment.name,
    appointment.Name,
    appointment.patient?.name,
    appointment.patient?.fullName,
    appointment.patient?.patientName,
    appointment.Patient?.Name,
    appointment.Patient?.FullName,
    appointment.Patient?.PatientName
  ),
  phone: firstText(
    appointment.phone,
    appointment.Phone,
    appointment.phoneNumber,
    appointment.PhoneNumber,
    appointment.mobile,
    appointment.mobileNumber,
    appointment.patientPhone,
    appointment.PatientPhone,
    appointment.patient?.phone,
    appointment.patient?.Phone,
    appointment.patient?.phoneNumber,
    appointment.patient?.PhoneNumber,
    appointment.Patient?.phone,
    appointment.Patient?.Phone,
    appointment.Patient?.phoneNumber,
    appointment.Patient?.PhoneNumber
  ),
  age: firstText(
    appointment.age,
    appointment.Age,
    appointment.patientAge,
    appointment.PatientAge,
    appointment.patient?.age,
    appointment.Patient?.Age
  ),
  hospitalId: firstText(
    appointment.hospitalId,
    appointment.HospitalId,
    appointment.clinicId,
    appointment.ClinicId,
    appointment.patient?.hospitalId,
    appointment.patient?.clinicId,
    appointment.Patient?.HospitalId,
    appointment.Patient?.ClinicId
  ),
  clinicId: firstText(
    appointment.clinicId,
    appointment.ClinicId,
    appointment.hospitalId,
    appointment.HospitalId,
    appointment.patient?.clinicId,
    appointment.patient?.hospitalId,
    appointment.Patient?.ClinicId,
    appointment.Patient?.HospitalId
  ),
  branchId: firstText(
    appointment.branchId,
    appointment.BranchId,
    appointment.branchID,
    appointment.BranchID,
    appointment.clinicBranchId,
    appointment.ClinicBranchId,
    appointment.patient?.branchId,
    appointment.patient?.BranchId,
    appointment.Patient?.BranchId
  ),
  branchName: firstText(
    appointment.branchName,
    appointment.BranchName,
    appointment.branch,
    appointment.Branch,
    appointment.patient?.branchName,
    appointment.patient?.BranchName,
    appointment.Patient?.BranchName
  ),
});

const mergePatient = (patient = {}, appointmentPatient = {}) => ({
  ...patient,
  id: getPatientId(patient) || appointmentPatient.id,
  patientId: patient.patientId || appointmentPatient.id,
  name: firstText(patient.name, patient.fullName, patient.PatientName, appointmentPatient.name),
  phone: firstText(patient.phone, patient.mobile, patient.phoneNumber, appointmentPatient.phone),
  age: firstText(patient.age, appointmentPatient.age),
  hospitalId: firstText(patient.hospitalId, patient.HospitalId, patient.clinicId, patient.ClinicId, appointmentPatient.hospitalId),
  clinicId: firstText(patient.clinicId, patient.ClinicId, patient.hospitalId, patient.HospitalId, appointmentPatient.clinicId),
  branchId: firstText(patient.branchId, patient.BranchId, patient.clinicBranchId, patient.ClinicBranchId, appointmentPatient.branchId),
  branchName: firstText(patient.branchName, patient.BranchName, patient.branch, patient.Branch, appointmentPatient.branchName),
});

const mergePatientsFromAppointments = (patients = [], appointments = []) => {
  const byId = new Map();
  const byPhone = new Map();
  const merged = parseList(patients).map((patient) => {
    const copy = { ...patient };
    const id = getPatientId(copy);
    const phone = getPatientPhone(copy);
    if (id) byId.set(id, copy);
    if (phone) byPhone.set(phone, copy);
    return copy;
  });

  parseList(appointments).forEach((appointment) => {
    const appointmentPatient = getAppointmentPatient(appointment);
    const id = appointmentPatient.id;
    const phone = normalizePhone(appointmentPatient.phone);
    if (!id && !phone) return;

    const existing = (id && byId.get(id)) || (phone && byPhone.get(phone));
    if (existing) {
      Object.assign(existing, mergePatient(existing, appointmentPatient));
      return;
    }

    const nextPatient = mergePatient({}, appointmentPatient);
    merged.push(nextPatient);
    if (id) byId.set(id, nextPatient);
    if (phone) byPhone.set(phone, nextPatient);
  });

  return merged;
};

export const nursePatientsRequestJson = async (path, options = {}) => {
  const raw = String(path || "").replace(/^\/+/, "");
  const method = String(options.method || "GET").toUpperCase();

  if (method === "GET" && /^Appointment\/online$/i.test(raw)) {
    return scopeNurseRecords(await getOnlineAppointments());
  }

  if (method === "GET" && /^Appointment\/offline$/i.test(raw)) {
    return scopeNurseRecords(await getOfflineAppointments());
  }

  if (method === "GET" && /^Appointment$/i.test(raw)) {
    const [onlineAppointments, offlineAppointments] = await Promise.all([
      getOnlineAppointments().catch(() => []),
      getOfflineAppointments().catch(() => []),
    ]);
    return scopeNurseRecords([...onlineAppointments, ...offlineAppointments]);
  }

  if (method === "GET" && /^Patient$/i.test(raw)) {
    const [patients, onlineAppointments, offlineAppointments] = await Promise.all([
      nurseRequestJson("Patient", options).catch(() => nurseRequestJson("Nurse/patients", options).catch(() => [])),
      getOnlineAppointments().catch(() => []),
      getOfflineAppointments().catch(() => []),
    ]);

    return scopeNurseRecords(
      mergePatientsFromAppointments(patients, [...parseList(onlineAppointments), ...parseList(offlineAppointments)])
    );
  }

  if (method === "GET" && /^Nurse\/patients$/i.test(raw)) {
    try {
      return scopeNurseRecords(await nurseRequestJson("Nurse/patients", options), getNurseScope(), {
        allowMissingBranch: false,
      });
    } catch {
      return [];
    }
  }

  return nurseRequestJson(path, options);
};

function NursePatients() {
  return (
    <ReceptionPatients
      basePath="/nurse"
      showAddPatient={false}
      apiRequest={nursePatientsRequestJson}
      getScope={getNurseScope}
      scopeRecords={scopeNurseRecords}
    />
  );
}

export default NursePatients;
