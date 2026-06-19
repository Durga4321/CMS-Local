import React, { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../../../components/superadmin/Header";
import { fetchClinic, fetchClinics, saveClinic } from "../superAdminApi";
import { useToast } from "../../../components/ToastProvider";
import {
  buildAddress,
  emptyAddressParts,
  onlyPincodeValue,
  parseAddress,
  validateAddressParts,
} from "../../../utils/address";
import {
  onlyAlpha,
  onlyAddressText,
  onlyIndianMobileValue,
  validateAlpha,
  validateGmail,
  validateMobile,
  validateSelected,
} from "../../../utils/validation";

const emptyClinic = {
  name: "",
  address: "",
  addressParts: emptyAddressParts,
  contactNumber: "",
  email: "",
  status: "Active",
};

const buildClinicPayload = (form) => {
  const clinicName = form.name.trim();
  const phoneNumber = form.contactNumber.trim();
  const email = form.email.trim();
  const addressParts = form.addressParts || parseAddress(form.address);
  const address = buildAddress(addressParts);
  const city = addressParts.city.trim();
  const country = addressParts.country.trim();
  const postalCode = addressParts.pincode.trim();
  const street = addressParts.streetVillage.trim();
  const state = addressParts.state.trim();
  const isActive = form.status === "Active";

  return {
    ClinicName: clinicName,
    Name: clinicName,
    name: clinicName,
    PhoneNumber: phoneNumber,
    ContactNumber: phoneNumber,
    contactNumber: phoneNumber,
    phoneNumber,
    Email: email,
    ClinicEmail: email,
    email,
    Address: address,
    ClinicAddress: address,
    address,
    Street: street,
    street,
    City: city,
    city,
    State: state,
    state,
    Country: country,
    country,
    PostalCode: postalCode,
    postalCode,
    Status: form.status,
    status: form.status,
    IsActive: isActive,
    isActive,
  };
};

function ClinicForm({ mode }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { id } = useParams();
  const [form, setForm] = useState(emptyClinic);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    let active = true;

    const loadClinic = async () => {
      if (mode !== "edit" || !id) return;

      setLoading(true);
      setError("");

      try {
        const clinic = await fetchClinic(id);
        if (active) {
          setForm({
            ...emptyClinic,
            ...clinic,
            addressParts: parseAddress(clinic.address),
          });
        }
      } catch (requestError) {
        if (active) setError(requestError.message || "Unable to load clinic.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadClinic();

    return () => {
      active = false;
    };
  }, [id, mode]);

  useEffect(() => {
    let active = true;

    const loadClinics = async () => {
      try {
        const result = await fetchClinics();
        if (active) setClinics(result);
      } catch {
        /* ignore validation list error until submit */
      }
    };

    loadClinics();

    return () => {
      active = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    let nextValue = value;

    if (name === "name") {
      nextValue = onlyAlpha(value);
    }

    if (name === "contactNumber") {
      nextValue = onlyIndianMobileValue(value);
    }

    setForm((current) => ({ ...current, [name]: nextValue }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
    setError("");
  };

  const handleAddressChange = (name, value) => {
    let nextValue = value;

    if (name === "pincode") {
      nextValue = onlyPincodeValue(value);
    } else if (["city", "state", "country"].includes(name)) {
      nextValue = onlyAlpha(value);
    } else {
      nextValue = onlyAddressText(value);
    }

    setForm((current) => {
      const addressParts = {
        ...(current.addressParts || emptyAddressParts),
        [name]: nextValue,
      };

      return {
        ...current,
        addressParts,
        address: buildAddress(addressParts),
      };
    });
    setFieldErrors((current) => ({
      ...current,
      address: "",
      [`address.${name}`]: "",
    }));
    setError("");
  };

  const validateForm = () => {
    const addressParts = form.addressParts || emptyAddressParts;
    const nextErrors = {
      name: validateAlpha(form.name, "Clinic name"),
      contactNumber: validateMobile(form.contactNumber, "Contact number"),
      email: validateGmail(form.email),
      status: validateSelected(form.status, "a status"),
      ...Object.fromEntries(
        Object.entries(validateAddressParts(addressParts, "Address")).map(
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) {
      setError("Please fix the highlighted fields.");
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const trimmedContact = form.contactNumber.trim();
    const duplicateClinic = clinics.find((existingClinic) => {
      const existingContact = String(
        existingClinic.contactNumber ||
        existingClinic.phone ||
        existingClinic.phoneNumber ||
        existingClinic.mobile ||
        existingClinic.contact ||
        ""
      ).trim();
      const existingId = String(existingClinic.id || existingClinic.clinicId || existingClinic._id || "");
      const currentId = String(id || "");

      return (
        existingContact === trimmedContact &&
        (mode !== "edit" || existingId !== currentId)
      );
    });

    if (duplicateClinic) {
      const message = "Contact number already exists for another clinic.";
      setFieldErrors((current) => ({ ...current, contactNumber: message }));
      setError(message);
      toast.error(message);
      return;
    }

    setSaving(true);
    setError("");

    try {
      await saveClinic(buildClinicPayload(form), mode === "edit" ? id : undefined);
      toast.success(mode === "edit" ? "Clinic updated successfully" : "Clinic created successfully");
      navigate("/superadmin/clinics");
    } catch (requestError) {
      const message = requestError.message || "Unable to save clinic.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="sa-state">Loading clinic...</div>;
  }

  return (
    <>
      <Header
        title={mode === "edit" ? "Edit Clinic" : "Add Clinic"}
        subtitle="Manage clinic profile and availability status."
      />

      <form className="sa-form-card" onSubmit={handleSubmit} noValidate>
        {error ? <div className="sa-state sa-state--error">{error}</div> : null}

        <div className="sa-form-grid">
          <div className="sa-form-field">
            <label>Clinic Name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className={fieldErrors.name ? "is-invalid" : ""}
              required
            />
            {fieldErrors.name ? <span className="sa-field-error">{fieldErrors.name}</span> : null}
          </div>
          <div className="sa-form-field">
            <label>Contact Number</label>
            <input
              name="contactNumber"
              type="tel"
              value={form.contactNumber}
              onChange={handleChange}
              inputMode="numeric"
              pattern="^(?!([0-9])\\1{9})[6-9][0-9]{9}$"
              maxLength={10}
              placeholder="10-digit Indian mobile number"
              title="Enter a 10-digit Indian mobile number starting with 6-9 and not all identical digits"
              className={fieldErrors.contactNumber ? "is-invalid" : ""}
              required
            />
            {fieldErrors.contactNumber ? <span className="sa-field-error">{fieldErrors.contactNumber}</span> : null}
          </div>
          <div className="sa-form-field">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className={fieldErrors.email ? "is-invalid" : ""}
              required
            />
            {fieldErrors.email ? <span className="sa-field-error">{fieldErrors.email}</span> : null}
          </div>
          <div className="sa-form-field">
            <label>Status</label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className={fieldErrors.status ? "is-invalid" : ""}
            >
              <option>Active</option>
              <option>Inactive</option>
            </select>
            {fieldErrors.status ? <span className="sa-field-error">{fieldErrors.status}</span> : null}
          </div>
          <div className="sa-form-field sa-form-field-full">
            <label>Address</label>
            <div className="sa-form-grid">
              {[
                ["streetVillage", "Street/Village Name"],
                ["city", "City"],
                ["state", "State"],
                ["country", "Country"],
                ["pincode", "Pincode"],
              ].map(([key, label]) => (
                <div className="sa-form-field" key={key}>
                  <label>{label}</label>
                  <input
                    value={form.addressParts?.[key] || ""}
                    onChange={(event) => handleAddressChange(key, event.target.value)}
                    className={fieldErrors[`address.${key}`] ? "is-invalid" : ""}
                    inputMode={key === "pincode" ? "numeric" : undefined}
                    maxLength={key === "pincode" ? 6 : undefined}
                    required
                  />
                  {fieldErrors[`address.${key}`] ? (
                    <span className="sa-field-error">{fieldErrors[`address.${key}`]}</span>
                  ) : null}
                </div>
              ))}
              <div className="sa-form-field sa-form-field-full">
                <label>Final Address</label>
                <textarea value={buildAddress(form.addressParts)} readOnly />
              </div>
            </div>
            {fieldErrors.address ? <span className="sa-field-error">{fieldErrors.address}</span> : null}
          </div>
        </div>

        <div className="sa-page-actions" style={{ marginTop: 16 }}>
          <button type="button" className="sa-btn" onClick={() => navigate("/superadmin/clinics")}>
            Cancel
          </button>
          <button type="submit" className="sa-btn sa-btn-primary" disabled={saving}>
            <Save size={16} />
            {saving ? "Saving..." : "Save Clinic"}
          </button>
        </div>
      </form>
    </>
  );
}

export default ClinicForm;
