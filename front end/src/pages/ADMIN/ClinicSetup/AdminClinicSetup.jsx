import React, { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../../../config/api";
import { useToast } from "../../../components/ToastProvider";
import {
  buildAddress,
  buildAddressPayload,
  emptyAddressParts,
  onlyPincodeValue,
  validateAddressParts,
} from "../../../utils/address.jsx";
import { fetchPincodeLocation } from "../../../utils/pincodeLocation";
import { getDistrictsForState, INDIA_COUNTRY, INDIAN_STATES } from "../../../utils/indianLocations";
import {
  onlyAlpha,
  onlyAddressText,
  onlyClinicName,
  onlyIndianMobileValue,
  validateClinicName,
  validateGmail,
  validateMobile,
  validateSelected,
} from "../../../utils/validation";
import { getJsonHeaders, parseErrorMessage } from "../../../utils/branchApi";
import { formatClinicName } from "../../../utils/clinicDisplay";
import "./AdminClinicSetup.css";

const emptyClinic = {
  name: "",
  address: "",
  addressParts: emptyAddressParts,
  contactNumber: "",
  email: "",
  status: "Active",
};

const buildClinicPayload = (form) => {
  const clinicName = formatClinicName(form.name, "Clinic");
  const phoneNumber = form.contactNumber.trim();
  const email = form.email.trim();
  const addressParts = form.addressParts || emptyAddressParts;
  const address = buildAddress(addressParts);
  const addressPayload = buildAddressPayload(addressParts);
  const isActive = form.status === "Active";

  return {
    ClinicName: clinicName,
    Name: clinicName,
    name: clinicName,
    clinicName,
    HospitalName: clinicName,
    hospitalName: clinicName,
    PhoneNumber: phoneNumber,
    ContactNumber: phoneNumber,
    contactNumber: phoneNumber,
    phoneNumber,
    phone: phoneNumber,
    Email: email,
    ClinicEmail: email,
    email,
    Address: address,
    ClinicAddress: address,
    address,
    location: address,
    city: addressParts.city || "",
    district: addressParts.city || "",
    state: addressParts.state || "",
    country: INDIA_COUNTRY,
    postalCode: addressParts.pincode || "",
    ...addressPayload,
    Status: form.status,
    status: form.status,
    IsActive: isActive,
    isActive,
  };
};

const readCreatedClinicId = (data = {}) =>
  data.id || data.clinicId || data.hospitalId || data.HospitalId || data.ClinicId || data.data?.id || data.data?.clinicId || data.data?.hospitalId || "";

const readCreatedClinicName = (data = {}, fallback = "Clinic") =>
  data.name || data.clinicName || data.hospitalName || data.ClinicName || data.HospitalName || data.data?.name || data.data?.clinicName || fallback;

function AdminClinicSetup() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(emptyClinic);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [areaOptions, setAreaOptions] = useState([]);

  const selectedDistricts = useMemo(
    () => Array.from(new Set([...getDistrictsForState(form.addressParts?.state), form.addressParts?.city].filter(Boolean))),
    [form.addressParts?.city, form.addressParts?.state]
  );

  const visibleAreaOptions = useMemo(
    () => Array.from(new Set([form.addressParts?.area, ...areaOptions].filter(Boolean).map((area) => String(area).trim()))),
    [form.addressParts?.area, areaOptions]
  );

  useEffect(() => {
    const addressParts = form.addressParts || emptyAddressParts;
    const nextAddress = buildAddress(addressParts);
    if (form.address !== nextAddress) setForm((current) => ({ ...current, address: nextAddress }));
  }, [form.addressParts]);

  useEffect(() => {
    const pincode = form.addressParts?.pincode || "";
    if (pincode.length !== 6) {
      setAreaOptions([]);
      return undefined;
    }

    let active = true;
    fetchPincodeLocation(pincode)
      .then((location) => {
        if (!active) return;
        setAreaOptions(location.areaOptions || []);
        setForm((current) => {
          const previousParts = current.addressParts || emptyAddressParts;
          if (previousParts.pincode !== pincode) return current;
          const addressParts = {
            ...previousParts,
            area: previousParts.area || location.area,
            city: location.city || previousParts.city,
            state: location.state || previousParts.state,
            country: location.country || INDIA_COUNTRY,
            pincode,
          };
          return { ...current, addressParts, address: buildAddress(addressParts) };
        });
        setFieldErrors((current) => ({ ...current, "address.pincode": "", "address.area": "", "address.city": "", "address.state": "" }));
      })
      .catch((lookupError) => {
        if (!active) return;
        setAreaOptions([]);
        setFieldErrors((current) => ({ ...current, "address.pincode": lookupError.message || "Unable to fetch pincode location." }));
      });

    return () => {
      active = false;
    };
  }, [form.addressParts?.pincode]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    let nextValue = value;
    if (name === "name") nextValue = onlyClinicName(value);
    if (name === "contactNumber") nextValue = onlyIndianMobileValue(value);
    setForm((current) => ({ ...current, [name]: nextValue }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
    setError("");
    setSuccess("");
  };

  const handleAddressChange = (name, value) => {
    let nextValue = value;
    if (name === "pincode") nextValue = onlyPincodeValue(value);
    else if (["city", "state", "country"].includes(name)) nextValue = onlyAlpha(value);
    else nextValue = onlyAddressText(value);

    setForm((current) => {
      const previousParts = current.addressParts || emptyAddressParts;
      const addressParts = { ...previousParts, [name]: nextValue, country: INDIA_COUNTRY };
      if (name === "state" && previousParts.state !== nextValue) {
        addressParts.city = "";
        addressParts.area = "";
        addressParts.pincode = "";
      }
      if (name === "city" && previousParts.city !== nextValue) {
        addressParts.area = "";
        addressParts.pincode = "";
      }
      if (name === "pincode" && previousParts.pincode !== nextValue) addressParts.area = "";
      return { ...current, addressParts, address: buildAddress(addressParts) };
    });
    setFieldErrors((current) => ({ ...current, address: "", [`address.${name}`]: "" }));
    setError("");
    setSuccess("");
  };

  const validateForm = () => {
    const addressParts = form.addressParts || emptyAddressParts;
    const nextErrors = {
      name: validateClinicName(form.name, "Clinic name"),
      contactNumber: validateMobile(form.contactNumber, "Contact number"),
      email: validateGmail(form.email),
      status: validateSelected(form.status, "a status"),
      ...Object.fromEntries(
        Object.entries(validateAddressParts(addressParts, "Address")).map(([key, value]) => [key === "address" ? "address" : `address.${key}`, value])
      ),
    };
    Object.keys(nextErrors).forEach((key) => {
      if (!nextErrors[key]) delete nextErrors[key];
    });
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) {
      const message = "Please fill the highlighted fields.";
      setError(message);
      toast.error(message);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = buildClinicPayload(form);
      const response = await fetch(apiUrl("Clinics"), {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await parseErrorMessage(response, "Unable to create clinic."));
      const data = await response.json().catch(() => ({}));
      const nextClinicId = readCreatedClinicId(data);
      const nextClinicName = formatClinicName(readCreatedClinicName(data, payload.name), "Clinic");

      if (nextClinicId) {
        localStorage.setItem("hospitalId", String(nextClinicId));
        localStorage.setItem("clinicId", String(nextClinicId));
        sessionStorage.setItem("hospitalId", String(nextClinicId));
        sessionStorage.setItem("clinicId", String(nextClinicId));
      }
      localStorage.setItem("hospitalName", nextClinicName);
      localStorage.setItem("clinicName", nextClinicName);
      localStorage.setItem("assignedClinic", nextClinicName);
      sessionStorage.setItem("hospitalName", nextClinicName);
      sessionStorage.setItem("clinicName", nextClinicName);
      sessionStorage.setItem("assignedClinic", nextClinicName);

      const message = "Clinic created successfully.";
      setSuccess(message);
      toast.success(message);
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      const message = requestError.message || "Unable to create clinic.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-clinic-setup-page">
      <div className="admin-clinic-setup-header">
        <div>
          <h1>Create Clinic</h1>
          <p>Fill clinic profile details once. After saving, this clinic data is used across dashboard, branches, reports, billing, and staff modules.</p>
        </div>
      </div>

      <form className="sa-form-card sa-clinic-form admin-clinic-setup-card" onSubmit={handleSubmit} noValidate>
        {error ? <div className="sa-state sa-state--error">{error}</div> : null}
        {success ? <div className="sa-state sa-state--success">{success}</div> : null}

        <div className="sa-form-grid">
          <div className="sa-form-field">
            <label>Clinic Name</label>
            <input name="name" value={form.name} onChange={handleChange} className={fieldErrors.name ? "is-invalid" : ""} required />
            {fieldErrors.name ? <span className="sa-field-error">{fieldErrors.name}</span> : null}
          </div>
          <div className="sa-form-field">
            <label>Contact Number</label>
            <input name="contactNumber" type="tel" value={form.contactNumber} onChange={handleChange} inputMode="numeric" maxLength={10} className={fieldErrors.contactNumber ? "is-invalid" : ""} required />
            {fieldErrors.contactNumber ? <span className="sa-field-error">{fieldErrors.contactNumber}</span> : null}
          </div>
          <div className="sa-form-field">
            <label>Email</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} className={fieldErrors.email ? "is-invalid" : ""} required />
            {fieldErrors.email ? <span className="sa-field-error">{fieldErrors.email}</span> : null}
          </div>
          <div className="sa-form-field">
            <label>Status</label>
            <select name="status" value={form.status} onChange={handleChange} className={fieldErrors.status ? "is-invalid" : ""}>
              <option>Active</option>
              <option>Inactive</option>
            </select>
            {fieldErrors.status ? <span className="sa-field-error">{fieldErrors.status}</span> : null}
          </div>

          <div className="sa-form-field sa-form-field-full">
            <label>Address</label>
            <div className="sa-form-grid">
              <div className="sa-form-field">
                <label>Pincode</label>
                <input value={form.addressParts?.pincode || ""} onChange={(event) => handleAddressChange("pincode", event.target.value)} className={fieldErrors["address.pincode"] ? "is-invalid" : ""} inputMode="numeric" maxLength={6} required />
                {fieldErrors["address.pincode"] ? <span className="sa-field-error">{fieldErrors["address.pincode"]}</span> : null}
              </div>
              <div className="sa-form-field">
                <label>Street/Village Name</label>
                <input value={form.addressParts?.streetVillage || ""} onChange={(event) => handleAddressChange("streetVillage", event.target.value)} className={fieldErrors["address.streetVillage"] ? "is-invalid" : ""} required />
                {fieldErrors["address.streetVillage"] ? <span className="sa-field-error">{fieldErrors["address.streetVillage"]}</span> : null}
              </div>
              <div className="sa-form-field">
                <label>Area</label>
                <select value={form.addressParts?.area || ""} onChange={(event) => handleAddressChange("area", event.target.value)} className={fieldErrors["address.area"] ? "is-invalid" : ""} disabled={!visibleAreaOptions.length} required>
                  <option value="">Select Area</option>
                  {visibleAreaOptions.map((area) => <option key={area} value={area}>{area}</option>)}
                </select>
                {fieldErrors["address.area"] ? <span className="sa-field-error">{fieldErrors["address.area"]}</span> : null}
              </div>
              <div className="sa-form-field">
                <label>City/District</label>
                <select value={form.addressParts?.city || ""} onChange={(event) => handleAddressChange("city", event.target.value)} className={fieldErrors["address.city"] ? "is-invalid" : ""} disabled={!form.addressParts?.state} required>
                  <option value="">Select City/District</option>
                  {selectedDistricts.map((district) => <option key={district} value={district}>{district}</option>)}
                </select>
                {fieldErrors["address.city"] ? <span className="sa-field-error">{fieldErrors["address.city"]}</span> : null}
              </div>
              <div className="sa-form-field">
                <label>State</label>
                <select value={form.addressParts?.state || ""} onChange={(event) => handleAddressChange("state", event.target.value)} className={fieldErrors["address.state"] ? "is-invalid" : ""} required>
                  <option value="">Select State</option>
                  {INDIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                </select>
                {fieldErrors["address.state"] ? <span className="sa-field-error">{fieldErrors["address.state"]}</span> : null}
              </div>
              <div className="sa-form-field">
                <label>Country</label>
                <input value={INDIA_COUNTRY} disabled readOnly />
              </div>
              <div className="sa-form-field sa-form-field-full">
                <label>Final Address</label>
                <textarea value={buildAddress(form.addressParts)} readOnly />
              </div>
            </div>
            {fieldErrors.address ? <span className="sa-field-error">{fieldErrors.address}</span> : null}
          </div>
        </div>

        <div className="sa-page-actions admin-clinic-actions">
          <button type="button" className="sa-btn" onClick={() => navigate("/dashboard")}>Cancel</button>
          <button type="submit" className="sa-btn sa-btn-primary" disabled={saving}>
            <Save size={16} />
            {saving ? "Saving..." : "Save Clinic"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AdminClinicSetup;
