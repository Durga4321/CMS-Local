import React, { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../../../components/superadmin/Header";
import { fetchClinic, fetchClinics, saveClinic } from "../superAdminApi";
import { useToast } from "../../../components/ToastProvider";
import {
  buildAddress,
  buildAddressPayload,
  emptyAddressParts,
  onlyPincodeValue,
  parseAddress,
  validateAddressParts,
} from "../../../utils/address.jsx";
import {
  fetchPincodeLocation,
} from "../../../utils/pincodeLocation";
import {
  getDistrictsForState,
  INDIA_COUNTRY,
  INDIAN_STATES,
} from "../../../utils/indianLocations";
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

const getClinicAddressParts = (clinic = {}) => {
  if (clinic.addressParts && Object.keys(clinic.addressParts).length) {
    return {
      ...emptyAddressParts,
      ...clinic.addressParts,
    };
  }

  return parseAddress(clinic.address || "");
};

const buildClinicPayload = (form) => {
  const clinicName = form.name.trim();
  const phoneNumber = form.contactNumber.trim();
  const email = form.email.trim();
  const addressParts = getClinicAddressParts(form);
  const address = buildAddress(addressParts);
  const addressPayload = buildAddressPayload(addressParts);
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
    ...addressPayload,
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
  const [areaOptions, setAreaOptions] = useState([]);
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
        .map((area) => String(area).trim())
    )
  );

  useEffect(() => {
    const addressParts = form.addressParts || emptyAddressParts;
    const nextAddress = buildAddress(addressParts);
    if (form.address !== nextAddress) {
      setForm((current) => ({ ...current, address: nextAddress }));
    }
  }, [form.addressParts]);

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
            addressParts: getClinicAddressParts(clinic),
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
      nextValue = onlyAlpha(value).trim();
    } else {
      nextValue = onlyAddressText(value).trim();
    }

    setForm((current) => {
      const previousParts = current.addressParts || emptyAddressParts;
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
        ...current,
        addressParts,
        address: buildAddress(addressParts),
      };
    });
    setFieldErrors((current) => ({
      ...current,
      address: "",
      [`address.${name}`]: "",
      ...(name === "state" ? { "address.city": "" } : {}),
      ...(name === "city" ? { "address.pincode": "", "address.area": "" } : {}),
    }));
    setError("");
  };

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
        setAreaOptions(location.areaOptions);
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

          return {
            ...current,
            addressParts,
            address: buildAddress(addressParts),
          };
        });
        setFieldErrors((current) => ({
          ...current,
          "address.pincode": "",
          "address.area": "",
          "address.city": "",
          "address.state": "",
        }));
      })
      .catch((lookupError) => {
        if (!active) return;
        setAreaOptions([]);
        setFieldErrors((current) => ({
          ...current,
          "address.pincode": lookupError.message || "Unable to fetch pincode location.",
        }));
      });

    return () => {
      active = false;
    };
  }, [form.addressParts?.pincode]);

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
              <div className="sa-form-field">
                <label>Pincode</label>
                <input
                  value={form.addressParts?.pincode || ""}
                  onChange={(event) => handleAddressChange("pincode", event.target.value)}
                  className={fieldErrors["address.pincode"] ? "is-invalid" : ""}
                  inputMode="numeric"
                  maxLength={6}
                  required
                />
                {fieldErrors["address.pincode"] ? (
                  <span className="sa-field-error">{fieldErrors["address.pincode"]}</span>
                ) : null}
              </div>

              <div className="sa-form-field">
                <label>Street/Village Name</label>
                <input
                  value={form.addressParts?.streetVillage || ""}
                  onChange={(event) => handleAddressChange("streetVillage", event.target.value)}
                  className={fieldErrors["address.streetVillage"] ? "is-invalid" : ""}
                  required
                />
                {fieldErrors["address.streetVillage"] ? (
                  <span className="sa-field-error">{fieldErrors["address.streetVillage"]}</span>
                ) : null}
              </div>

              <div className="sa-form-field">
                <label>Area</label>
                <select
                  value={form.addressParts?.area || ""}
                  onChange={(event) => handleAddressChange("area", event.target.value)}
                  className={fieldErrors["address.area"] ? "is-invalid" : ""}
                  disabled={!visibleAreaOptions.length}
                  required
                >
                  <option value="">Select Area</option>
                  {visibleAreaOptions.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
                {fieldErrors["address.area"] ? (
                  <span className="sa-field-error">{fieldErrors["address.area"]}</span>
                ) : null}
              </div>

              <div className="sa-form-field">
                <label>City/District</label>
                <select
                  value={form.addressParts?.city || ""}
                  onChange={(event) => handleAddressChange("city", event.target.value)}
                  className={fieldErrors["address.city"] ? "is-invalid" : ""}
                  disabled={!form.addressParts?.state}
                  required
                >
                  <option value="">Select City/District</option>
                  {selectedDistricts.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </select>
                {fieldErrors["address.city"] ? (
                  <span className="sa-field-error">{fieldErrors["address.city"]}</span>
                ) : null}
              </div>

              <div className="sa-form-field">
                <label>State</label>
                <select
                  value={form.addressParts?.state || ""}
                  onChange={(event) => handleAddressChange("state", event.target.value)}
                  className={fieldErrors["address.state"] ? "is-invalid" : ""}
                  required
                >
                  <option value="">Select State</option>
                  {INDIAN_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
                {fieldErrors["address.state"] ? (
                  <span className="sa-field-error">{fieldErrors["address.state"]}</span>
                ) : null}
              </div>

              <div className="sa-form-field">
                <label>Country</label>
                <input value={INDIA_COUNTRY} disabled readOnly />
                {fieldErrors["address.country"] ? (
                  <span className="sa-field-error">{fieldErrors["address.country"]}</span>
                ) : null}
              </div>
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
