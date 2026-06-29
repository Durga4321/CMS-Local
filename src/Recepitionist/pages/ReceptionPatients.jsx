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
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { parseList, requestJson } from "../receptionApi";
import { useToast } from "../../components/ToastProvider";
import {
  buildAddress,
  buildAddressPayload,
  emptyAddressParts,
  onlyPincodeValue,
  parseAddress,
  validateAddressParts,
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
  validateDate,
  validateGmail,
  validateMobile,
  validateNumeric,
  validateRequired,
  validateSelected,
} from "../../utils/validation";

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

const getPatientAddressParts = (patient = {}) => {
  if (patient.addressParts && Object.keys(patient.addressParts).length) {
    return {
      ...emptyAddressParts,
      ...patient.addressParts,
    };
  }

  return {
    streetVillage: String(patient.streetVillage || patient.Street || patient.street || "").trim(),
    area: String(patient.area || patient.Area || patient.locality || patient.Locality || patient.town || patient.Town || "").trim(),
    city: String(patient.city || patient.City || "").trim(),
    state: String(patient.state || patient.State || "").trim(),
    country: String(patient.country || patient.Country || INDIA_COUNTRY).trim() || INDIA_COUNTRY,
    pincode: String(patient.pincode || patient.PostalCode || patient.postalCode || "").trim(),
  };
};

const getPatientAddress = (patient = {}) => {
  const addressParts = getPatientAddressParts(patient);
  return String(patient.address || "").trim() || buildAddress(addressParts);
};

const bloodGroupOptions = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const genderOptions = ["Female", "Male", "Other"];
const patientFieldLabels = {
  dateOfBirth: "Date Of Birth",
  emergencyContactName: "Emergency Contact Name",
  emergencyContactPhone: "Emergency Contact Number",
};

const validatePatientName = (value) => {
  const alphaError = validateAlpha(value, "Name");
  if (alphaError) return alphaError;

  const nameParts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter((part) => part.replace(/\./g, "").length >= 2);

  return nameParts.length >= 2 ? "" : "Name must include first and last name.";
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

function ReceptionPatients() {
  const navigate = useNavigate();
  const toast = useToast();
  const [patients, setPatients] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [areaOptions, setAreaOptions] = useState([]);

  const fetchPatients = useCallback(() =>
    requestJson("Patient")
      .then((data) => {
        setPatients(parseList(data).filter((patient) => !isDeletedPatient(patient)));
        setMessage("");
      })
      .catch((error) => {
        setMessage(error.message);
        toast.error(error.message || "Unable to load patients.");
      }),
  [toast]);

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

  const rows = useMemo(() => [...patients].reverse(), [patients]);
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
    setForm(emptyForm);
    setFieldErrors({});
    setModal("add");
    setMessage("");
  };

  const openEdit = (patient) => {
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
    if (form.address !== nextAddress) {
      setForm((current) => ({ ...current, address: nextAddress }));
    }
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
      nextValue = onlyAlpha(value);
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
    const nextErrors = {
      name: validatePatientName(form.name),
      email: validateGmail(form.email),
      phone: validateMobile(form.phone, "Phone"),
      age: validateNumeric(form.age, "Age", { integer: true, max: 100 }),
      dateOfBirth: validateDate(form.dateOfBirth, "Date of birth"),
      bloodGroup: validateRequired(form.bloodGroup, "Blood group"),
      emergencyContactName: validateAlpha(
        form.emergencyContactName,
        "Emergency contact name"
      ),
      emergencyContactPhone: validateMobile(
        form.emergencyContactPhone,
        "Emergency contact phone"
      ),
      gender: validateSelected(form.gender, "gender"),
      ...Object.fromEntries(
        Object.entries(validateAddressParts(form.addressParts, "Address")).map(
          ([key, value]) => [key === "address" ? "address" : `address.${key}`, value]
        )
      ),
    };

    Object.keys(nextErrors).forEach((key) => {
      if (!nextErrors[key]) delete nextErrors[key];
    });

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const savePatient = async (event) => {
    event.preventDefault();
    if (!validateForm()) {
      const text = "Please fix the highlighted fields.";
      setMessage(text);
      toast.error(text);
      return;
    }

    const body = toPatientPayload(form, {
      address: buildAddress(form.addressParts),
    });

    try {
      if (modal === "edit" && form.id) {
        await requestJson(`Patient/${form.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await requestJson("Patient", { method: "POST", body: JSON.stringify(body) });
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
    const patientId = Number(patient?.id);
    if (!Number.isInteger(patientId) || patientId <= 0) {
      const text = "Patient id is missing.";
      setMessage(text);
      toast.error(text);
      return;
    }

    if (!window.confirm("Delete this patient?")) return;
    try {
      await requestJson(`Patient/${patientId}`, { method: "DELETE" });
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
    <section className="rc-page">
      <div className="rc-page-head">
        <div>
          <h2>Patients</h2>
          <p>
            Manage patients: add new patients, view existing details, update records,
            or remove outdated entries.
          </p>
        </div>
        <div className="rc-head-actions">
          <button className="rc-btn" onClick={openAdd}>
            <Plus size={16} /> Add Patient
          </button>
          <button className="rc-btn ghost" onClick={fetchPatients}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="rc-btn" onClick={() => navigate("/reception/dashboard")}>
            <ArrowLeft size={16} /> Dashboard
          </button>
        </div>
      </div>

      {message ? <div className="rc-alert">{message}</div> : null}

      <div className="rc-card">
        <div className="rc-card-head">
          <div>
            <h3>Patient List</h3>
            <p>View, edit, or delete registered patients.</p>
          </div>
        </div>
        <div className="rc-table">
          <div className="rc-table-head five">
            <span>PID</span>
            <span>Name</span>
            <span>Phone</span>
            <span>Age</span>
            <span>Actions</span>
          </div>
          {rows.map((patient) => (
            <div className="rc-table-row five" key={patient.id}>
              <span>{patient.id}</span>
              <span>{patient.name || "-"}</span>
              <span>{patient.phone || "-"}</span>
              <span>{patient.age ? `${patient.age} yrs` : "-"}</span>
              <span className="rc-row-actions">
                <button
                  aria-label="View patient"
                  onClick={() => {
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
                >
                  <Eye size={15} />
                </button>
                <button
                  aria-label="Edit patient"
                  onClick={() => openEdit(patient)}
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() =>
                    navigate(`/reception/medical-history?patientId=${patient.id}`)
                  }
                >
                  <HeartPulse size={15} /> Medical History
                </button>
                <button className="danger" onClick={() => deletePatient(patient)}>
                  <Trash2 size={15} /> Delete
                </button>
              </span>
            </div>
          ))}
          {!rows.length ? <div className="rc-empty">No patients found.</div> : null}
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
                    readOnly={field === "age"}
                    className={fieldErrors[field] ? "is-invalid" : ""}
                    onChange={(event) => updateField(field, event.target.value)}
                  />
                  {fieldErrors[field] ? (
                    <small className="rc-field-error">{fieldErrors[field]}</small>
                  ) : null}
                </label>
              ))}
              <label>
                <span>Gender</span>
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
                <span>Blood Group</span>
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
                <span>Address</span>
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
