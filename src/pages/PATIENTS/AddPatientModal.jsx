import React, { useState } from "react";
import "./AddPatientModal.css";
import { useToast } from "../../components/ToastProvider";
import {
  buildAddress,
  buildAddressPayload,
  emptyAddressParts,
  onlyPincodeValue,
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
  onlyAddressText,
  onlyIndianMobileValue,
  onlyNumberValue,
  validateAlpha,
  validateGmail,
  validateMobile,
  validateNumeric,
  validateSelected,
} from "../../utils/validation";

function AddPatientModal({ onClose, onAdd }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    age: "",
    gender: "Male",
    emergencyContactName: "",
    emergencyContactPhone: "",
    address: "",
    addressParts: emptyAddressParts,
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [areaOptions, setAreaOptions] = useState([]);

  const handleChange = (event) => {
    const { name } = event.target;
    let { value } = event.target;

    if (["name", "emergencyContactName"].includes(name)) {
      value = onlyAlpha(value);
    }

    if (["phone", "emergencyContactPhone"].includes(name)) {
      value = onlyIndianMobileValue(value);
    }

    if (name === "age") {
      value = onlyNumberValue(value);
    }

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
    setFieldErrors((previous) => ({ ...previous, [name]: "" }));
    setError("");
  };

  const handleAddressChange = (name, value) => {
    let nextValue = name === "pincode" ? onlyPincodeValue(value) : String(value || "").trim();
    if (["city", "state", "country"].includes(name)) {
      nextValue = onlyAlpha(nextValue);
    } else if (name !== "pincode") {
      nextValue = onlyAddressText(nextValue);
    }

    setForm((previous) => {
      const previousParts = previous.addressParts || emptyAddressParts;
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
        ...previous,
        addressParts,
        address: buildAddress(addressParts),
      };
    });
    setFieldErrors((previous) => ({
      ...previous,
      address: "",
      [`address.${name}`]: "",
      ...(name === "state" ? { "address.city": "" } : {}),
      ...(name === "city" ? { "address.pincode": "", "address.area": "" } : {}),
    }));
    setError("");
  };

  React.useEffect(() => {
    const addressParts = form.addressParts || emptyAddressParts;
    const nextAddress = buildAddress(addressParts);
    if (form.address !== nextAddress) {
      setForm((current) => ({ ...current, address: nextAddress }));
    }
  }, [form.addressParts]);

  React.useEffect(() => {
    const addressParts = form.addressParts || emptyAddressParts;
    const pincode = addressParts.pincode || "";
    if (pincode.length !== 6) {
      setAreaOptions([]);
      return undefined;
    }

    let active = true;
    fetchPincodeLocation(pincode)
      .then((location) => {
        if (!active) return;
        setAreaOptions(location.areaOptions);
        setForm((previous) => {
          const previousParts = previous.addressParts || emptyAddressParts;
          if (previousParts.pincode !== pincode) return previous;

          const addressParts = {
            ...previousParts,
            area: previousParts.area || location.area,
            city: location.city || previousParts.city,
            state: location.state || previousParts.state,
            country: location.country || INDIA_COUNTRY,
            pincode,
          };

          return {
            ...previous,
            addressParts,
            address: buildAddress(addressParts),
          };
        });
        setFieldErrors((previous) => ({
          ...previous,
          "address.pincode": "",
          "address.area": "",
          "address.city": "",
          "address.state": "",
        }));
      })
      .catch((lookupError) => {
        if (!active) return;
        setAreaOptions([]);
        setFieldErrors((previous) => ({
          ...previous,
          "address.pincode": lookupError.message || "Unable to fetch pincode location.",
        }));
      });

    return () => {
      active = false;
    };
  }, [form.addressParts?.pincode]);

  const validateForm = () => {
    const nextErrors = {
      name: validateAlpha(form.name, "Name"),
      email: validateGmail(form.email),
      phone: validateMobile(form.phone, "Phone"),
      age: validateNumeric(form.age, "Age", { integer: true }),
      gender: validateSelected(form.gender, "gender"),
      emergencyContactName: validateAlpha(
        form.emergencyContactName,
        "Emergency contact name"
      ),
      emergencyContactPhone: validateMobile(
        form.emergencyContactPhone,
        "Emergency contact number"
      ),
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

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!validateForm()) {
      setError("Please fix the highlighted fields.");
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setError("");
    onAdd({
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      emergencyContactName: form.emergencyContactName.trim(),
      emergencyContactPhone: form.emergencyContactPhone.trim(),
      address: buildAddress(form.addressParts),
      ...buildAddressPayload(form.addressParts),
      age: Number(form.age),
    });
    toast.success("Patient added successfully");
  };

  const selectedDistricts = Array.from(
    new Set([
      ...getDistrictsForState(form.addressParts?.state),
      form.addressParts?.city,
    ].filter(Boolean))
  );
  const visibleAreaOptions = Array.from(
    new Set(
      [form.addressParts?.area, ...areaOptions]
        .filter(Boolean)
        .map((option) => String(option || "").trim())
    )
  );

  return (
    <div
      className="add-patient-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="add-patient-modal" onClick={(event) => event.stopPropagation()}>
        <h2>Add Patient</h2>
        <p>Enter patient details</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="add-patient-grid">
            <div className="add-patient-field">
              <label>Name</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                className={fieldErrors.name ? "is-invalid" : ""}
                placeholder="Patient full name"
              />
              {fieldErrors.name ? <span className="add-patient-field-error">{fieldErrors.name}</span> : null}
            </div>

            <div className="add-patient-field">
              <label>Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                className={fieldErrors.email ? "is-invalid" : ""}
                placeholder="patient@gmail.com"
              />
              {fieldErrors.email ? <span className="add-patient-field-error">{fieldErrors.email}</span> : null}
            </div>

            <div className="add-patient-field">
              <label>Phone</label>
              <input
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                inputMode="numeric"
                pattern="^(?!([0-9])\\1{9})[6-9][0-9]{9}$"
                maxLength={10}
                placeholder="10-digit Indian mobile number"
                title="Enter a 10-digit Indian mobile number starting with 6-9 and not all identical digits"
                className={fieldErrors.phone ? "is-invalid" : ""}
              />
              {fieldErrors.phone ? <span className="add-patient-field-error">{fieldErrors.phone}</span> : null}
            </div>

            <div className="add-patient-field">
              <label>Age</label>
              <input
                name="age"
                type="number"
                min="0"
                value={form.age}
                onChange={handleChange}
                className={fieldErrors.age ? "is-invalid" : ""}
                placeholder="30"
              />
              {fieldErrors.age ? <span className="add-patient-field-error">{fieldErrors.age}</span> : null}
            </div>

            <div className="add-patient-field">
              <label>Gender</label>
              <select
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className={fieldErrors.gender ? "is-invalid" : ""}
              >
                <option>Male</option>
                <option>Female</option>
              </select>
              {fieldErrors.gender ? <span className="add-patient-field-error">{fieldErrors.gender}</span> : null}
            </div>

            <div className="add-patient-field">
              <label>Emergency Contact Name</label>
              <input
                name="emergencyContactName"
                value={form.emergencyContactName}
                onChange={handleChange}
                className={fieldErrors.emergencyContactName ? "is-invalid" : ""}
                placeholder="Contact full name"
              />
              {fieldErrors.emergencyContactName ? <span className="add-patient-field-error">{fieldErrors.emergencyContactName}</span> : null}
            </div>

            <div className="add-patient-field">
              <label>Emergency Contact Number</label>
              <input
                name="emergencyContactPhone"
                type="tel"
                value={form.emergencyContactPhone}
                onChange={handleChange}
                inputMode="numeric"
                pattern="^(?!([0-9])\\1{9})[6-9][0-9]{9}$"
                maxLength={10}
                placeholder="10-digit Indian mobile number"
                title="Enter a 10-digit Indian mobile number starting with 6-9 and not all identical digits"
                className={fieldErrors.emergencyContactPhone ? "is-invalid" : ""}
              />
              {fieldErrors.emergencyContactPhone ? <span className="add-patient-field-error">{fieldErrors.emergencyContactPhone}</span> : null}
            </div>

            <div className="add-patient-field add-patient-field-full">
              <label>Address</label>
              <div className="add-patient-address-grid">
                <div className="add-patient-field">
                  <label>Pincode</label>
                  <input
                    value={form.addressParts?.pincode || ""}
                    onChange={(event) => handleAddressChange("pincode", event.target.value)}
                    className={fieldErrors["address.pincode"] ? "is-invalid" : ""}
                    inputMode="numeric"
                    maxLength={6}
                  />
                  {fieldErrors["address.pincode"] ? (
                    <span className="add-patient-field-error">{fieldErrors["address.pincode"]}</span>
                  ) : null}
                </div>

                <div className="add-patient-field">
                  <label>Street/Village Name</label>
                  <input
                    value={form.addressParts?.streetVillage || ""}
                    onChange={(event) => handleAddressChange("streetVillage", event.target.value)}
                    className={fieldErrors["address.streetVillage"] ? "is-invalid" : ""}
                  />
                  {fieldErrors["address.streetVillage"] ? (
                    <span className="add-patient-field-error">{fieldErrors["address.streetVillage"]}</span>
                  ) : null}
                </div>

                <div className="add-patient-field">
                  <label>Area</label>
                  <select
                    value={form.addressParts?.area || ""}
                    onChange={(event) => handleAddressChange("area", event.target.value)}
                    className={fieldErrors["address.area"] ? "is-invalid" : ""}
                    disabled={!visibleAreaOptions.length}
                  >
                    <option value="">Select Area</option>
                    {visibleAreaOptions.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                  {fieldErrors["address.area"] ? (
                    <span className="add-patient-field-error">{fieldErrors["address.area"]}</span>
                  ) : null}
                </div>

                <div className="add-patient-field">
                  <label>City/District</label>
                  <select
                    value={form.addressParts?.city || ""}
                    onChange={(event) => handleAddressChange("city", event.target.value)}
                    className={fieldErrors["address.city"] ? "is-invalid" : ""}
                    disabled={!form.addressParts?.state}
                  >
                    <option value="">Select City/District</option>
                    {selectedDistricts.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                  {fieldErrors["address.city"] ? (
                    <span className="add-patient-field-error">{fieldErrors["address.city"]}</span>
                  ) : null}
                </div>

                <div className="add-patient-field">
                  <label>State</label>
                  <select
                    value={form.addressParts?.state || ""}
                    onChange={(event) => handleAddressChange("state", event.target.value)}
                    className={fieldErrors["address.state"] ? "is-invalid" : ""}
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                  {fieldErrors["address.state"] ? (
                    <span className="add-patient-field-error">{fieldErrors["address.state"]}</span>
                  ) : null}
                </div>

                <div className="add-patient-field">
                  <label>Country</label>
                  <input value={INDIA_COUNTRY} disabled readOnly />
                  {fieldErrors["address.country"] ? (
                    <span className="add-patient-field-error">{fieldErrors["address.country"]}</span>
                  ) : null}
                </div>
              </div>
              <textarea className="add-patient-final-address" value={buildAddress(form.addressParts)} readOnly />
              {fieldErrors.address ? <span className="add-patient-field-error">{fieldErrors.address}</span> : null}
            </div>
          </div>

          {error && <p className="add-patient-error">{error}</p>}

          <div className="add-patient-actions">
            <button type="button" className="add-patient-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="add-patient-submit">
              Add Patient
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddPatientModal;
