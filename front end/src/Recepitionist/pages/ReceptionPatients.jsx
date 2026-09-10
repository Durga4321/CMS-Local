import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Eye,
  HeartPulse,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Search,
  Phone,
  Users,
  ShieldCheck,
  UserCheck,
  Calendar,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ActionsGroup } from "../../components/ActionsGroup";
import { parseList, requestJson as defaultRequestJson } from "../receptionApi";
import {
  getReceptionistScope,
  getRecordBranchId,
  getRecordBranchName,
  getRecordClinicId,
  scopeReceptionistRecords,
  withReceptionistScopePayload,
} from "../receptionScope";
import { useToast } from "../../components/ToastProvider";
import { canUseModulePermission, useRolePermissionsSync } from "../../utils/rolePermissions";
import { getReceptionistProfile } from "../receptionSession";
import {
  buildAddress,
  buildAddressPayload,
  emptyAddressParts,
  onlyPincodeValue,
  parseAddress,
} from "../../utils/address.jsx";
import {
  fetchPincodeLocation,
} from "../../utils/pincodeLocation";
import {
  getDistrictsForState,
  INDIA_COUNTRY,
  INDIAN_STATES,
} from "../../utils/indianLocations";
import {
  onlyAlpha,
  onlyIndianMobileValue,
  onlyNumberValue,
  validateAlpha,
  validateGmail,
  validateMobile,
  validateNumeric,
  validateRequired,
  validateSelected,
} from "../../utils/validation";
import { formatTitleCase } from "../../utils/format";
import { validateUniqueMobileNumber } from "../../utils/mobileUniqueness";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  age: "",
  dateOfBirth: "",
  bloodGroup: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  gender: "",
  address: "",
  addressParts: emptyAddressParts,
};

const firstText = (...values) =>
  values
    .map((value) => String(value ?? "").trim())
    .find(Boolean) || "";

const getPatientId = (patient = {}) =>
  firstText(patient.id, patient.Id, patient.patientId, patient.PatientId, patient.PID, patient.patientCode, patient.PatientCode);

const getPatientCode = (patient = {}) =>
  firstText(patient.patientCode, patient.PatientCode, patient.PID, patient.patientId, patient.PatientId, patient.id, patient.Id);

const getPatientName = (patient = {}) =>
  firstText(patient.name, patient.Name, patient.fullName, patient.FullName, patient.patientName, patient.PatientName);

const getPatientPhone = (patient = {}) =>
  firstText(patient.phone, patient.Phone, patient.mobile, patient.Mobile, patient.phoneNumber, patient.PhoneNumber);

const getPatientAge = (patient = {}) =>
  firstText(patient.age, patient.Age);

const getAppointmentPatientId = (appointment = {}) =>
  firstText(
    appointment.patientId,
    appointment.PatientId,
    appointment.pid,
    appointment.PID,
    appointment.patient?.id,
    appointment.patient?.patientId,
    appointment.patient?.PatientId,
    appointment.Patient?.Id,
    appointment.Patient?.PatientId
  );

const getAppointmentPatientPhone = (appointment = {}) =>
  normalizePhone(
    firstText(
      appointment.phone,
      appointment.Phone,
      appointment.phoneNumber,
      appointment.PhoneNumber,
      appointment.mobileNumber,
      appointment.MobileNumber,
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
    )
  );

const normalizePhone = (value) => String(value ?? "").replace(/\D/g, "");
const OFFLINE_PATIENT_SCOPE_KEY = "reception_offline_patient_scope_v2";

const getTodayKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

const normalizeDateKey = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
};

const getAppointmentDateKey = (appointment = {}) =>
  normalizeDateKey(
    firstText(
      appointment.date,
      appointment.Date,
      appointment.appointmentDate,
      appointment.AppointmentDate,
      appointment.scheduledDate,
      appointment.ScheduledDate,
      appointment.slotDate,
      appointment.SlotDate,
      appointment.bookingDate,
      appointment.BookingDate,
      appointment.appointment?.date,
      appointment.appointment?.Date,
      appointment.Appointment?.Date
    )
  );

const readOfflinePatientScope = () => {
  try {
    const data = JSON.parse(localStorage.getItem(OFFLINE_PATIENT_SCOPE_KEY) || "{}");
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
};

const writeOfflinePatientScope = (scopeData) => {
  localStorage.setItem(OFFLINE_PATIENT_SCOPE_KEY, JSON.stringify(scopeData));
};

const getOfflinePatientScopeKeys = (patient = {}) => {
  const id = getPatientId(patient);
  const phone = normalizePhone(patient.phone || patient.Phone);
  return [
    id ? `id:${id}` : "",
    phone ? `phone:${phone}` : "",
  ].filter(Boolean);
};

const rememberOfflinePatientScope = (patient = {}, scope = {}) => {
  const keys = getOfflinePatientScopeKeys(patient);
  if (!keys.length) return;

  const scopeData = readOfflinePatientScope();
  const scopedValue = {
    clinicId: String(scope.clinicId || ""),
    branchId: String(scope.branchId || ""),
    branchName: String(scope.branchName || ""),
  };

  keys.forEach((key) => {
    scopeData[key] = scopedValue;
  });
  writeOfflinePatientScope(scopeData);
};

const hasRememberedOfflinePatientScope = (patient = {}, scope = {}) => {
  const scopeData = readOfflinePatientScope();
  const clinicId = String(scope.clinicId || "");
  const branchId = String(scope.branchId || "");
  const branchName = String(scope.branchName || "");

  return getOfflinePatientScopeKeys(patient).some((key) => {
    const saved = scopeData[key];
    if (!saved) return false;

    const savedClinicId = String(saved.clinicId || "");
    const savedBranchId = String(saved.branchId || "");
    const savedBranchName = String(saved.branchName || "");

    return (
      (!clinicId || savedClinicId === clinicId) &&
      (!branchId || savedBranchId === branchId || (branchName && savedBranchName === branchName))
    );
  });
};

const patientBelongsToReceptionistPatientList = (
  patient = {},
  branchPatientIds = new Set(),
  branchPatientPhones = new Set(),
  scope = {}
) => {
  if (branchPatientIds.has(getPatientId(patient))) return true;
  if (branchPatientPhones.has(normalizePhone(patient.phone || patient.Phone))) return true;

  const clinicId = getRecordClinicId(patient);
  const branchId = getRecordBranchId(patient);
  const branchName = getRecordBranchName(patient);

  if (clinicId || branchId || branchName) {
    return scopeReceptionistRecords([patient], scope).length > 0;
  }

  return hasRememberedOfflinePatientScope(patient, scope);
};

const patientMatchesAppointment = (patient = {}, appointment = {}) => {
  const patientId = getPatientId(patient);
  const appointmentPatientId = getAppointmentPatientId(appointment);
  if (patientId && appointmentPatientId && String(patientId) === String(appointmentPatientId)) {
    return true;
  }

  const patientPhone = normalizePhone(patient.phone || patient.Phone);
  const appointmentPhone = getAppointmentPatientPhone(appointment);
  return Boolean(patientPhone && appointmentPhone && patientPhone === appointmentPhone);
};

const hasPatientAppointmentByDate = (patient = {}, appointments = [], matcher) =>
  appointments.some((appointment) => {
    if (!patientMatchesAppointment(patient, appointment)) return false;
    const appointmentDate = getAppointmentDateKey(appointment);
    return appointmentDate ? matcher(appointmentDate) : false;
  });

const getPatientAddressParts = (patient = {}) => {
  const parsedAddress = parseAddress(firstText(patient.address, patient.Address));
  const structuredParts =
    patient.addressParts && Object.keys(patient.addressParts).length
      ? patient.addressParts
      : {};

  const parts = {
    ...emptyAddressParts,
    ...parsedAddress,
    ...structuredParts,
    streetVillage: firstText(
      structuredParts.streetVillage,
      patient.streetVillage,
      patient.StreetVillage,
      patient.street,
      patient.Street,
      parsedAddress.streetVillage
    ),
    area: firstText(
      structuredParts.area,
      patient.area,
      patient.Area,
      patient.locality,
      patient.Locality,
      patient.town,
      patient.Town,
      parsedAddress.area
    ),
    city: firstText(
      structuredParts.city,
      patient.city,
      patient.City,
      patient.district,
      patient.District,
      parsedAddress.city
    ),
    state: firstText(
      structuredParts.state,
      patient.state,
      patient.State,
      parsedAddress.state
    ),
    country:
      firstText(
        structuredParts.country,
        patient.country,
        patient.Country,
        parsedAddress.country
      ) || INDIA_COUNTRY,
    pincode: firstText(
      structuredParts.pincode,
      patient.pincode,
      patient.Pincode,
      patient.pinCode,
      patient.PinCode,
      patient.PostalCode,
      patient.postalCode,
      patient.zipCode,
      patient.ZipCode,
      parsedAddress.pincode
    ),
  };

  return parts;
};

const getPatientAddress = (patient = {}) => {
  const addressParts = getPatientAddressParts(patient);
  return firstText(patient.address, patient.Address) || buildAddress(addressParts);
};

const bloodGroupOptions = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const genderOptions = ["Female", "Male", "Other"];
const requiredPatientFields = new Set(["name", "phone", "age", "gender", "bloodGroup"]);

const RequiredMark = () => <span className="rc-required-mark">*</span>;
const patientFieldLabels = {
  dateOfBirth: "Date Of Birth",
  emergencyContactName: "Emergency Contact Name",
  emergencyContactPhone: "Emergency Contact Number",
};

const getPatientDateOfBirth = (patient = {}) => {
  const rawValue =
    patient.dateOfBirth ??
    patient.DateOfBirth ??
    patient.dob ??
    patient.DOB ??
    patient.birthDate ??
    patient.BirthDate ??
    "";

  const value = String(rawValue || "").trim();
  if (!value) return "";

  const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }

  return "";
};

const calculateAgeFromDateOfBirth = (dateOfBirth) => {
  const value = String(dateOfBirth || "").trim();
  if (!value) return "";

  const birthDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return "";

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());

  if (!hasBirthdayPassed) age -= 1;

  return age >= 0 && age <= 100 ? String(age) : "";
};

const isDeletedPatient = (patient = {}) => {
  const deletedValue =
    patient.isDeleted ??
    patient.deleted ??
    patient.isRemoved ??
    patient.removed;
  const status = String(patient.status || "").trim().toLowerCase();

  return (
    deletedValue === true ||
    deletedValue === 1 ||
    String(deletedValue).toLowerCase() === "true" ||
    status === "deleted" ||
    Boolean(patient.deletedAt || patient.removedAt)
  );
};

const toPatientPayload = (patient = {}, overrides = {}) => {
  const addressParts = getPatientAddressParts(patient);
  return {
    name: String(patient.name || "").trim(),
    email: String(patient.email || "").trim(),
    phone: String(patient.phone || "").trim(),
    age: Number(patient.age) || 0,
    dateOfBirth: getPatientDateOfBirth(patient),
    bloodGroup: String(patient.bloodGroup || "").trim(),
    emergencyContactName: String(patient.emergencyContactName || "").trim(),
    emergencyContactPhone: String(patient.emergencyContactPhone || "").trim(),
    gender: patient.gender || "",
    address: String(patient.address || "").trim(),
    ...buildAddressPayload(addressParts),
    ...overrides,
  };
};

function ReceptionPatients({
  hideActions = false,
  basePath = "/reception",
  showAddPatient = true,
  apiRequest = defaultRequestJson,
  getScope = getReceptionistScope,
  scopeRecords = scopeReceptionistRecords,
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const receptionistScope = useMemo(() => getScope(), [getScope]);
  const permissionProfile = useMemo(() => getReceptionistProfile(), []);
  useRolePermissionsSync(permissionProfile);
  const canCreatePatient = canUseModulePermission(permissionProfile, "Patients", "Create");
  const canEditPatient = canUseModulePermission(permissionProfile, "Patients", "Edit");
  const canDeletePatient = canUseModulePermission(permissionProfile, "Patients", "Delete");
  const [patients, setPatients] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [areaOptions, setAreaOptions] = useState([]);
  const [activeActionState, setActiveActionState] = useState(null);

  const fetchPatients = useCallback(() =>
    apiRequest("Patient")
      .then((data) => {
        setPatients(
          parseList(data)
            .filter((patient) => !isDeletedPatient(patient))
            .filter((patient) => patientBelongsToReceptionistPatientList(
              patient,
              new Set(),
              new Set(),
              receptionistScope
            ))
        );
        setMessage("");
      })
      .catch((error) => {
        setPatients([]);
        setMessage(error.message);
        toast.error(error.message || "Unable to load patients.");
      }),
  [receptionistScope, toast, apiRequest]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  useEffect(() => {
    if (!modal) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modal]);

  const [searchTerm, setSearchTerm] = useState("");

  const rows = useMemo(
    () => [...patients].reverse(),
    [patients]
  );

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter((patient) => {
      const name = getPatientName(patient).toLowerCase();
      const code = getPatientCode(patient).toLowerCase();
      const phone = getPatientPhone(patient).toLowerCase();
      return name.includes(term) || code.includes(term) || phone.includes(term);
    });
  }, [rows, searchTerm]);
  const selectedDistricts = Array.from(
    new Set([
      ...getDistrictsForState(form.addressParts?.state),
      form.addressParts?.city,
    ].filter(Boolean))
  );
  const visibleAreaOptions = Array.from(
    new Set([form.addressParts?.area, ...areaOptions].filter(Boolean))
  );
  const openAdd = () => {
    if (!canCreatePatient) {
      toast.error("You do not have permission to create patients.");
      return;
    }
    setForm(emptyForm);
    setFieldErrors({});
    setModal("add");
    setMessage("");
  };

  const openEdit = (patient) => {
    if (!canEditPatient) {
      toast.error("You do not have permission to edit patients.");
      return;
    }
    const addressParts = getPatientAddressParts(patient);
    const dateOfBirth = getPatientDateOfBirth(patient);
    setForm({
      id: patient.id,
      name: patient.name || "",
      email: patient.email || "",
      phone: patient.phone || "",
      age: calculateAgeFromDateOfBirth(dateOfBirth) || patient.age || "",
      dateOfBirth,
      bloodGroup: patient.bloodGroup || "",
      emergencyContactName: patient.emergencyContactName || "",
      emergencyContactPhone: patient.emergencyContactPhone || "",
      gender: patient.gender || "",
      address: getPatientAddress(patient),
      addressParts,
    });
    setFieldErrors({});
    setModal("edit");
    setMessage("");
  };

  const updateAddressField = (name, value) => {
    const nextValue = name === "pincode" ? onlyPincodeValue(value) : value;
    setForm((prev) => {
      const previousParts = prev.addressParts || emptyAddressParts;
      const addressParts = {
        ...previousParts,
        [name]: nextValue,
        country: INDIA_COUNTRY,
      };

      if (name === "state" && previousParts.state !== nextValue) {
        addressParts.city = "";
        addressParts.area = "";
        addressParts.pincode = "";
      }

      if (name === "city" && previousParts.city !== nextValue) {
        addressParts.area = "";
        addressParts.pincode = "";
      }

      if (name === "pincode" && previousParts.pincode !== nextValue) {
        addressParts.area = "";
      }

      return {
        ...prev,
        addressParts,
        address: buildAddress(addressParts),
      };
    });
    setFieldErrors((prev) => ({
      ...prev,
      address: "",
      [`address.${name}`]: "",
      ...(name === "state" ? { "address.city": "" } : {}),
      ...(name === "city" ? { "address.pincode": "", "address.area": "" } : {}),
    }));
    setMessage("");
  };

  useEffect(() => {
    const addressParts = form.addressParts || emptyAddressParts;
    const nextAddress = buildAddress(addressParts);
    setForm((current) =>
      current.address === nextAddress ? current : { ...current, address: nextAddress }
    );
  }, [form.addressParts]);

  useEffect(() => {
    const pincode = form.addressParts?.pincode || "";
    if (pincode.length !== 6 || modal === "view") {
      setAreaOptions([]);
      return undefined;
    }

    let active = true;
    fetchPincodeLocation(pincode)
      .then((location) => {
        if (!active) return;
        setAreaOptions(location.areaOptions);
        setForm((prev) => {
          const previousParts = prev.addressParts || emptyAddressParts;
          if (previousParts.pincode !== pincode) return prev;

          const addressParts = {
            ...previousParts,
            area: previousParts.area || location.area,
            city: location.city || previousParts.city,
            state: location.state || previousParts.state,
            country: location.country || INDIA_COUNTRY,
            pincode,
          };

          return {
            ...prev,
            addressParts,
            address: buildAddress(addressParts),
          };
        });
        setFieldErrors((prev) => ({
          ...prev,
          "address.pincode": "",
          "address.area": "",
          "address.city": "",
          "address.state": "",
        }));
      })
      .catch((lookupError) => {
        if (!active) return;
        setAreaOptions([]);
        setFieldErrors((prev) => ({
          ...prev,
          "address.pincode": lookupError.message || "Unable to fetch pincode location.",
        }));
      });

    return () => {
      active = false;
    };
  }, [form.addressParts?.pincode, modal]);

  const updateField = (name, value) => {
    let nextValue = value;

    if (["name", "emergencyContactName"].includes(name)) {
      nextValue = formatTitleCase(onlyAlpha(value));
    }

    if (["phone", "emergencyContactPhone"].includes(name)) {
      nextValue = onlyIndianMobileValue(value);
    }

    if (name === "age") {
      nextValue = onlyNumberValue(value).slice(0, 3);
      if (Number(nextValue) > 100) {
        nextValue = "100";
      }
    }

    setForm((prev) => ({
      ...prev,
      [name]: nextValue,
      ...(name === "dateOfBirth"
        ? { age: calculateAgeFromDateOfBirth(nextValue) }
        : {}),
    }));
    setFieldErrors((prev) => ({
      ...prev,
      [name]: "",
      ...(name === "dateOfBirth" ? { age: "" } : {}),
    }));
    setMessage("");
  };

  const validateForm = () => {
    const hasAddressValue = Object.values(form.addressParts || {}).some((value) =>
      String(value ?? "").trim()
    );
    const nextErrors = {
      name: validateAlpha(form.name, "Name"),
      email: form.email ? validateGmail(form.email) : "",
      phone: validateMobile(form.phone, "Phone"),
      age: validateNumeric(form.age, "Age", { integer: true, max: 100 }),
      bloodGroup: validateRequired(form.bloodGroup, "Blood group"),
      emergencyContactName: form.emergencyContactName
        ? validateAlpha(form.emergencyContactName, "Emergency contact name")
        : "",
      emergencyContactPhone: form.emergencyContactPhone
        ? validateMobile(form.emergencyContactPhone, "Emergency contact phone")
        : "",
      gender: validateSelected(form.gender, "gender"),
      address: hasAddressValue ? "" : "Address is required.",
    };

    Object.keys(nextErrors).forEach((key) => {
      if (!nextErrors[key]) delete nextErrors[key];
    });

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const findPatientWithPhone = (phone, currentPatientId = "") => {
    const normalizedPhone = normalizePhone(phone);
    const normalizedCurrentId = String(currentPatientId || "").trim();

    if (!normalizedPhone) return null;

    return patients.find((patient) => {
      const patientId = String(getPatientId(patient) || "").trim();
      const patientPhone = normalizePhone(patient.phone || patient.Phone);

      return (
        patientPhone === normalizedPhone &&
        (!normalizedCurrentId || patientId !== normalizedCurrentId)
      );
    });
  };

  const findPatientUsingPhone = (phone, currentPatientId = "") => {
    const normalizedPhone = normalizePhone(phone);
    const normalizedCurrentId = String(currentPatientId || "").trim();

    if (!normalizedPhone) return null;

    return patients.find((patient) => {
      const patientId = String(getPatientId(patient) || "").trim();
      const patientPhone = normalizePhone(patient.phone || patient.Phone);
      const emergencyPhone = normalizePhone(
        patient.emergencyContactPhone || patient.EmergencyContactPhone
      );

      return (
        (!normalizedCurrentId || patientId !== normalizedCurrentId) &&
        (patientPhone === normalizedPhone || emergencyPhone === normalizedPhone)
      );
    });
  };

  const savePatient = async (event) => {
    event.preventDefault();

    if (modal === "edit" && !canEditPatient) {
      toast.error("You do not have permission to edit patients.");
      return;
    }

    if (modal !== "edit" && !canCreatePatient) {
      toast.error("You do not have permission to create patients.");
      return;
    }

    if (!validateForm()) {
      const text = "Please fix the highlighted fields.";
      setMessage(text);
      toast.error(text);
      return;
    }

    if (normalizePhone(form.phone) === normalizePhone(form.emergencyContactPhone)) {
      const text = "Emergency contact number must be different from patient phone number.";
      setFieldErrors((prev) => ({ ...prev, emergencyContactPhone: text }));
      setMessage(text);
      toast.error(text);
      return;
    }

    const duplicatePatient = findPatientWithPhone(form.phone, form.id);
    if (duplicatePatient) {
      const text = "This mobile number is already registered for another patient.";
      setFieldErrors((prev) => ({ ...prev, phone: text }));
      setMessage(text);
      toast.error(text);
      return;
    }

    const duplicateMobileMessage = await validateUniqueMobileNumber(form.phone, {
      current: modal === "edit" && form.id ? { id: form.id, source: "Patient" } : {},
      localRecords: patients,
      localSource: "Patient",
    });
    if (duplicateMobileMessage) {
      setFieldErrors((prev) => ({ ...prev, phone: duplicateMobileMessage }));
      setMessage(duplicateMobileMessage);
      toast.error(duplicateMobileMessage);
      return;
    }

    const duplicateEmergencyContact = findPatientUsingPhone(
      form.emergencyContactPhone,
      form.id
    );
    if (duplicateEmergencyContact) {
      const text = "This emergency contact number is already used in another patient record.";
      setFieldErrors((prev) => ({ ...prev, emergencyContactPhone: text }));
      setMessage(text);
      toast.error(text);
      return;
    }

    const body = withReceptionistScopePayload(
      toPatientPayload(form, {
        address: buildAddress(form.addressParts),
      }),
      receptionistScope
    );

    try {
      if (modal === "edit" && form.id) {
        const result = await apiRequest(`Patient/${form.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        rememberOfflinePatientScope({ ...form, ...body, ...(result || {}) }, receptionistScope);
      } else {
        const result = await apiRequest("Patient", { method: "POST", body: JSON.stringify(body) });
        rememberOfflinePatientScope({ ...form, ...body, ...(result || {}) }, receptionistScope);
      }
      setModal(null);
      await fetchPatients();
      toast.success(modal === "edit" ? "Patient updated successfully" : "Patient added successfully");
    } catch (error) {
      setMessage(error.message);
      toast.error(error.message || "Unable to save patient.");
    }
  };

  const deletePatient = async (patient) => {
    if (!canDeletePatient) {
      toast.error("You do not have permission to delete patients.");
      return;
    }

    const patientId = Number(patient?.id);
    if (!Number.isInteger(patientId) || patientId <= 0) {
      const text = "Patient id is missing.";
      setMessage(text);
      toast.error(text);
      return;
    }

    if (!window.confirm("Delete this patient?")) return;
    try {
      await apiRequest(`Patient/${patientId}`, { method: "DELETE" });
      setMessage("");
      setPatients((previous) =>
        previous.filter((item) => String(item.id) !== String(patientId))
      );
      toast.success("Patient deleted successfully");
    } catch (error) {
      setMessage(error.message);
      toast.error(error.message || "Unable to delete patient.");
    }
  };

  return (
    <section className="rc-page rc-patients-page">
      {/* Patient Theme Background Overlays & Live Heart Rate Telemetry */}
      <div className="patients-bg-overlay" />
      
      {/* Live Glowing Heart Rate Telemetry Wave Across Background */}
      <div className="patients-heartrate-wave">
        <div className="patients-heartrate-telemetry-badge">
          <HeartPulse size={16} className="heart-beating-icon" />
          <span className="telemetry-live-dot" />
          <span className="telemetry-label">Live Heart Rate Telemetry:</span>
          <strong className="telemetry-value">74 BPM</strong>
          <span className="telemetry-status">● Normal Sinus Rhythm</span>
        </div>
        <svg viewBox="0 0 1400 120" preserveAspectRatio="none" className="patients-heartrate-svg">
          <defs>
            <linearGradient id="heartrateGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.3" />
              <stop offset="25%" stopColor="#0284c7" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#10b981" stopOpacity="1" />
              <stop offset="75%" stopColor="#0284c7" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.3" />
            </linearGradient>
            <filter id="ecgGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d="M0 60 L180 60 L195 40 L210 85 L225 15 L245 105 L260 60 L280 60 L480 60 L495 40 L510 85 L525 15 L545 105 L560 60 L580 60 L780 60 L795 40 L810 85 L825 15 L845 105 L860 60 L880 60 L1080 60 L1095 40 L1110 85 L1125 15 L1145 105 L1160 60 L1180 60 L1400 60"
            fill="none"
            stroke="url(#heartrateGradient)"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#ecgGlow)"
            className="patients-heartrate-path"
          />
        </svg>
      </div>

      {/* PAGE HEADER */}
      <div className="rc-dash-header">
        <div>
          <h1 className="rc-dash-title">
            Patients <span className="rc-wave-hand">👥</span>
          </h1>
          <p className="rc-dash-subtitle">
            Manage patients: add new patients, view existing details, update records, or remove outdated entries.
          </p>
        </div>
        {!hideActions && (
          <div className="rc-dash-head-actions">
            {showAddPatient && canCreatePatient ? (
              <button
                type="button"
                className="rc-head-action-btn btn-primary"
                onClick={openAdd}
                title="Add patient"
              >
                <Plus size={16} />
                <span>Add Patient</span>
              </button>
            ) : null}
            <button
              type="button"
              className="rc-head-action-btn btn-secondary"
              onClick={fetchPatients}
              title="Refresh patients"
            >
              <RefreshCw size={15} />
              <span>Refresh</span>
            </button>
          </div>
        )}
      </div>

      {/* TOP 3 MINI PATIENT CARE STAT CARDS */}
      <div className="rc-patient-kpi-grid">
        <div className="rc-patient-kpi-card card-blue-theme">
          <div className="rc-pkpi-icon-box box-blue">
            <Users size={18} />
          </div>
          <div className="rc-pkpi-content">
            <span className="rc-pkpi-label">Registered Patients</span>
            <strong className="rc-pkpi-val">{rows.length}</strong>
          </div>
          <span className="rc-pkpi-badge badge-blue">● Live Records</span>
        </div>

        <div className="rc-patient-kpi-card card-green-theme">
          <div className="rc-pkpi-icon-box box-green">
            <HeartPulse size={18} />
          </div>
          <div className="rc-pkpi-content">
            <span className="rc-pkpi-label">Active Directory</span>
            <strong className="rc-pkpi-val">{rows.filter((p) => p.isActive !== false && p.status !== "inactive").length}</strong>
          </div>
          <span className="rc-pkpi-badge badge-green">✓ Verified</span>
        </div>

        <div className="rc-patient-kpi-card card-purple-theme">
          <div className="rc-pkpi-icon-box box-purple">
            <ShieldCheck size={18} />
          </div>
          <div className="rc-pkpi-content">
            <span className="rc-pkpi-label">Front Desk Sync</span>
            <strong className="rc-pkpi-val">100%</strong>
          </div>
          <span className="rc-pkpi-badge badge-purple">● Cloud Ready</span>
        </div>
      </div>

      {message ? <div className="rc-alert">{message}</div> : null}

      {/* PATIENTS DIRECTORY TABLE CARD */}
      <div className="rc-dash-table-card rc-patients-card">
        <div className="rc-dash-table-head">
          <div className="rc-dash-table-head-left">
            <div className="rc-dash-panel-icon">
              <Users size={18} />
            </div>
            <div>
              <h3>Patients Directory</h3>
              <div className="rc-dash-meta-badges">
                <span className="rc-dash-date-pill">
                  <UserCheck size={12} />
                  Clinic Records
                </span>
                <span className="rc-dash-count-pill">
                  {filteredRows.length} {filteredRows.length === 1 ? "Patient" : "Patients"}
                </span>
              </div>
            </div>
          </div>

          <div className="rc-patient-search-bar">
            <Search size={15} className="rc-psearch-icon" />
            <input
              type="text"
              placeholder="Search by name, PID, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rc-psearch-input"
            />
          </div>
        </div>

        <div className="rc-dash-table-container">
          <div className="rc-patient-table-header">
            <span className="col-sno">
              <span className="rc-th-capsule rc-th-sno">S.NO.</span>
            </span>
            <span className="col-pid">
              <span className="rc-th-capsule rc-th-pid">PID</span>
            </span>
            <span className="col-name">
              <span className="rc-th-capsule rc-th-name">NAME</span>
            </span>
            <span className="col-phone">
              <span className="rc-th-capsule rc-th-phone">PHONE</span>
            </span>
            <span className="col-age">
              <span className="rc-th-capsule rc-th-age">AGE</span>
            </span>
            <span className="col-actions">
              <span className="rc-th-capsule rc-th-actions">ACTIONS</span>
            </span>
          </div>

          <div className="rc-dash-table-body">
            {filteredRows.length ? (
              filteredRows.map((patient, index) => {
                const patientName = getPatientName(patient) || "-";
                const patientCode = getPatientCode(patient) || "-";
                const patientPhone = getPatientPhone(patient) || "-";
                const patientAge = getPatientAge(patient);
                const initials = patientName
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0].toUpperCase())
                  .join("") || "PT";
                const avatarGradients = [
                  { bg: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)", shadow: "rgba(2, 132, 199, 0.3)" },
                  { bg: "linear-gradient(135deg, #10b981 0%, #047857 100%)", shadow: "rgba(16, 185, 129, 0.3)" },
                  { bg: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)", shadow: "rgba(139, 92, 246, 0.3)" },
                  { bg: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", shadow: "rgba(245, 158, 11, 0.3)" },
                  { bg: "linear-gradient(135deg, #ec4899 0%, #be185d 100%)", shadow: "rgba(236, 72, 153, 0.3)" },
                  { bg: "linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)", shadow: "rgba(6, 182, 212, 0.3)" },
                  { bg: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)", shadow: "rgba(99, 102, 241, 0.3)" },
                ];
                const avatarStyle = avatarGradients[index % avatarGradients.length];

                return (
                  <div
                    className="rc-patient-table-row"
                    key={getPatientId(patient) || index}
                  >
                    <span className="col-sno">
                      <span className="rc-dash-sno-badge">{index + 1}</span>
                    </span>

                    <span className="col-pid">
                      <span className="rc-patient-pid-badge">{patientCode}</span>
                    </span>

                    <span className="col-name">
                      <div className="rc-dash-patient-cell">
                        <div
                          className="rc-dash-patient-avatar"
                          style={{
                            background: avatarStyle.bg,
                            boxShadow: `0 3px 8px ${avatarStyle.shadow}`,
                          }}
                        >
                          {initials}
                        </div>
                        <span className="rc-dash-patient-name">{patientName}</span>
                      </div>
                    </span>

                    <span className="col-phone">
                      <div className="rc-patient-phone-cell">
                        <Phone size={13} className="rc-patient-phone-icon" />
                        <span>{patientPhone}</span>
                      </div>
                    </span>

                    <span className="col-age">
                      <span className="rc-patient-age-badge">
                        {patientAge ? `${patientAge} yrs` : "-"}
                      </span>
                    </span>

                    <span className="col-actions rc-row-actions">
                      <ActionsGroup
                        rowId={getPatientId(patient)}
                        activeActionState={activeActionState}
                        setActiveActionState={setActiveActionState}
                        canView={true}
                        canEdit={canEditPatient}
                        canStatus={true}
                        canDelete={canDeletePatient}
                        statusChecked={patient.isActive !== false && patient.status !== "inactive"}
                        statusTitle="Medical History"
                        onView={() => {
                          const dateOfBirth = getPatientDateOfBirth(patient);
                          setForm({
                            ...patient,
                            age: calculateAgeFromDateOfBirth(dateOfBirth) || patient.age || "",
                            dateOfBirth,
                            address: getPatientAddress(patient),
                            addressParts: getPatientAddressParts(patient),
                          });
                          setModal("view");
                        }}
                        onEdit={() => openEdit(patient)}
                        onStatus={() =>
                          navigate(`${basePath}/medical-history?patientId=${getPatientId(patient)}`)
                        }
                        onDelete={() => deletePatient(patient)}
                      />
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="rc-dash-empty">
                <div className="rc-dash-empty-icon-wrap">
                  <Users size={32} />
                </div>
                <p>{searchTerm ? `No patients matching "${searchTerm}"` : "No patients found."}</p>
                {showAddPatient && canCreatePatient && !searchTerm ? (
                  <button
                    type="button"
                    className="rc-dash-empty-btn"
                    onClick={openAdd}
                  >
                    <Plus size={14} />
                    <span>Add First Patient</span>
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {modal ? (
        <div className="rc-modal-backdrop" onClick={() => setModal(null)}>
          <form
            noValidate
            className="rc-modal rc-modal-compact rc-patient-modal"
            onSubmit={savePatient}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="rc-modal-header">
              <h3>
                {modal === "view"
                  ? "Patient Details"
                  : modal === "edit"
                    ? "Edit Patient"
                    : "Add Patient"}
              </h3>
              <button
                type="button"
                className="rc-modal-close"
                onClick={() => setModal(null)}
                aria-label="Close"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="rc-form-grid">
              {[
                "name",
                "email",
                "phone",
                "age",
                "dateOfBirth",
                "emergencyContactName",
                "emergencyContactPhone",
              ].map((field) => (
                <label key={field}>
                  <span>
                    {patientFieldLabels[field] ||
                      field
                        .replace(/([A-Z])/g, " $1")
                        .replace(/^./, (s) => s.toUpperCase())}
                    {requiredPatientFields.has(field) ? <RequiredMark /> : null}
                  </span>
                  <input
                    name={field}
                    type={
                      field === "age"
                        ? "number"
                        : field === "dateOfBirth"
                          ? "date"
                          : ["phone", "emergencyContactPhone"].includes(field)
                            ? "tel"
                            : "text"
                    }
                    inputMode={
                      ["phone", "emergencyContactPhone"].includes(field) || field === "age"
                        ? "numeric"
                        : undefined
                    }
                    pattern={["phone", "emergencyContactPhone"].includes(field) ? "^(?!([0-9])\\1{9})[6-9][0-9]{9}$" : undefined}
                    maxLength={["phone", "emergencyContactPhone"].includes(field) ? 10 : undefined}
                    min={field === "age" ? 0 : undefined}
                    max={field === "age" ? 100 : undefined}
                    placeholder={["phone", "emergencyContactPhone"].includes(field) ? "10-digit Indian mobile number" : ""}
                    title={["phone", "emergencyContactPhone"].includes(field) ? "Enter a 10-digit Indian mobile number starting with 6-9 and not all identical digits" : ""}
                    value={form[field] || ""}
                    disabled={modal === "view"}
                    className={fieldErrors[field] ? "is-invalid" : ""}
                    onChange={(event) => updateField(field, event.target.value)}
                  />
                  {fieldErrors[field] ? (
                    <small className="rc-field-error">{fieldErrors[field]}</small>
                  ) : null}
                </label>
              ))}
              <label>
                <span>Gender<RequiredMark /></span>
                <select
                  value={form.gender || ""}
                  disabled={modal === "view"}
                  className={fieldErrors.gender ? "is-invalid" : ""}
                  onChange={(event) => updateField("gender", event.target.value)}
                >
                  <option value="">Select gender</option>
                  {genderOptions.map((gender) => (
                    <option value={gender} key={gender}>
                      {gender}
                    </option>
                  ))}
                </select>
                {fieldErrors.gender ? (
                  <small className="rc-field-error">{fieldErrors.gender}</small>
                ) : null}
              </label>
              <label>
                <span>Blood Group<RequiredMark /></span>
                <select
                  value={form.bloodGroup || ""}
                  disabled={modal === "view"}
                  className={fieldErrors.bloodGroup ? "is-invalid" : ""}
                  onChange={(event) => updateField("bloodGroup", event.target.value)}
                >
                  <option value="">Select blood group</option>
                  {bloodGroupOptions.map((bloodGroup) => (
                    <option value={bloodGroup} key={bloodGroup}>
                      {bloodGroup}
                    </option>
                  ))}
                </select>
                {fieldErrors.bloodGroup ? (
                  <small className="rc-field-error">{fieldErrors.bloodGroup}</small>
                ) : null}
              </label>
              <div className="rc-address-block">
                <span>Address<RequiredMark /></span>
                <div className="rc-address-grid">
                  <label>
                    <span>Pincode</span>
                    <input
                      value={form.addressParts?.pincode || ""}
                      disabled={modal === "view"}
                      className={fieldErrors["address.pincode"] ? "is-invalid" : ""}
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(event) => updateAddressField("pincode", event.target.value)}
                    />
                    {fieldErrors["address.pincode"] ? (
                      <small className="rc-field-error">{fieldErrors["address.pincode"]}</small>
                    ) : null}
                  </label>

                  <label>
                    <span>Street/Village Name</span>
                    <input
                      value={form.addressParts?.streetVillage || ""}
                      disabled={modal === "view"}
                      className={fieldErrors["address.streetVillage"] ? "is-invalid" : ""}
                      onChange={(event) => updateAddressField("streetVillage", event.target.value)}
                    />
                    {fieldErrors["address.streetVillage"] ? (
                      <small className="rc-field-error">{fieldErrors["address.streetVillage"]}</small>
                    ) : null}
                  </label>

                  <label>
                    <span>Area</span>
                    <select
                      value={form.addressParts?.area || ""}
                      disabled={modal === "view" || !visibleAreaOptions.length}
                      className={fieldErrors["address.area"] ? "is-invalid" : ""}
                      onChange={(event) => updateAddressField("area", event.target.value)}
                    >
                      <option value="">Select Area</option>
                      {visibleAreaOptions.map((area) => (
                        <option key={area} value={area}>
                          {area}
                        </option>
                      ))}
                    </select>
                    {fieldErrors["address.area"] ? (
                      <small className="rc-field-error">{fieldErrors["address.area"]}</small>
                    ) : null}
                  </label>

                  <label>
                    <span>City/District</span>
                    <select
                      value={form.addressParts?.city || ""}
                      disabled={modal === "view" || !form.addressParts?.state}
                      className={fieldErrors["address.city"] ? "is-invalid" : ""}
                      onChange={(event) => updateAddressField("city", event.target.value)}
                    >
                      <option value="">Select City/District</option>
                      {selectedDistricts.map((district) => (
                        <option key={district} value={district}>
                          {district}
                        </option>
                      ))}
                    </select>
                    {fieldErrors["address.city"] ? (
                      <small className="rc-field-error">{fieldErrors["address.city"]}</small>
                    ) : null}
                  </label>

                  <label>
                    <span>State</span>
                    <select
                      value={form.addressParts?.state || ""}
                      disabled={modal === "view"}
                      className={fieldErrors["address.state"] ? "is-invalid" : ""}
                      onChange={(event) => updateAddressField("state", event.target.value)}
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                    {fieldErrors["address.state"] ? (
                      <small className="rc-field-error">{fieldErrors["address.state"]}</small>
                    ) : null}
                  </label>

                  <label>
                    <span>Country</span>
                    <input value={INDIA_COUNTRY} disabled readOnly />
                    {fieldErrors["address.country"] ? (
                      <small className="rc-field-error">{fieldErrors["address.country"]}</small>
                    ) : null}
                  </label>
                </div>
                {fieldErrors.address ? (
                  <small className="rc-field-error">{fieldErrors.address}</small>
                ) : null}
              </div>
            </div>
            {modal !== "view" ? (
              <div className="rc-modal-actions">
                <button type="submit" className="rc-btn primary">
                  {modal === "edit" ? "Update" : "Save"}
                </button>
              </div>
            ) : null}
          </form>
        </div>
      ) : null}
    </section>
  );
}

export default ReceptionPatients;
