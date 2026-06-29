import { validateRequired } from "./validation";
import { INDIA_COUNTRY } from "./indianLocations";

export const emptyAddressParts = {
  streetVillage: "",
  area: "",
  city: "",
  state: "",
  country: INDIA_COUNTRY,
  pincode: "",
};

export const onlyPincodeValue = (value) =>
  String(value ?? "").replace(/\D/g, "").slice(0, 6);

export const parseAddress = (address = "") => {
  const raw = String(address || "").trim();
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const pincodeMatch = raw.match(/\b\d{5,6}\b/);
  const pincode = pincodeMatch?.[0] || "";
  const normalized = [...parts];

  if (normalized.length && /^\d{5,6}$/u.test(normalized[normalized.length - 1])) {
    normalized.pop();
  }

  if (
    normalized.length &&
    String(normalized[normalized.length - 1]).trim().toLowerCase() ===
      INDIA_COUNTRY.toLowerCase()
  ) {
    normalized.pop();
  }

  let streetVillage = "";
  let area = "";
  let city = "";
  let state = "";

  if (normalized.length >= 4) {
    streetVillage = normalized.slice(0, normalized.length - 3).join(", ");
    area = normalized[normalized.length - 3] || "";
    city = normalized[normalized.length - 2] || "";
    state = normalized[normalized.length - 1] || "";
  } else if (normalized.length === 3) {
    streetVillage = normalized[0] || "";
    city = normalized[1] || "";
    state = normalized[2] || "";
  } else if (normalized.length === 2) {
    streetVillage = normalized[0] || "";
    city = normalized[1] || "";
  } else if (normalized.length === 1) {
    streetVillage = normalized[0] || "";
  }

  return {
    streetVillage: streetVillage.replace(/\b\d{5,6}\b/g, "").trim() || "",
    area: area.replace(/\b\d{5,6}\b/g, "").trim() || "",
    city: city.replace(/\b\d{5,6}\b/g, "").trim() || "",
    state: state.replace(/\b\d{5,6}\b/g, "").trim() || "",
    country: INDIA_COUNTRY,
    pincode,
  };
};

export const buildAddress = (parts = {}) =>
  [
    parts.streetVillage,
    parts.area,
    parts.city,
    parts.state,
    parts.country,
    parts.pincode,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");

export const buildAddressPayload = (parts = {}) => {
  const normalized = {
    ...emptyAddressParts,
    ...parts,
    country: String(parts.country || INDIA_COUNTRY).trim() || INDIA_COUNTRY,
    pincode: onlyPincodeValue(parts.pincode || ""),
  };

  const streetVillage = String(normalized.streetVillage || "").trim();
  const area = String(normalized.area || "").trim();
  const city = String(normalized.city || "").trim();
  const state = String(normalized.state || "").trim();
  const country = normalized.country;
  const pincode = String(normalized.pincode || "").trim();

  return {
    addressParts: normalized,
    Street: streetVillage,
    street: streetVillage,
    Area: area,
    area,
    City: city,
    city,
    State: state,
    state,
    Country: country,
    country,
    PostalCode: pincode,
    postalCode: pincode,
  };
};

export const validateAddressParts = (parts = {}, label = "Address") => {
  const errors = {};
  const fields = [
    ["streetVillage", "Street/Village name"],
    ["area", "Area"],
    ["city", "City"],
    ["state", "State"],
    ["country", "Country"],
    ["pincode", "Pincode"],
  ];

  fields.forEach(([key, fieldLabel]) => {
    const required = validateRequired(parts[key], fieldLabel);
    if (required) errors[key] = required;
  });

  if (!errors.pincode && !/^\d{6}$/.test(String(parts.pincode || "").trim())) {
    errors.pincode = "Pincode must be exactly 6 digits.";
  }
  if (!errors.country && String(parts.country || "").trim() !== INDIA_COUNTRY) {
    errors.country = "Country must be India.";
  }

  if (!Object.keys(errors).length && !buildAddress(parts)) {
    errors.address = `${label} is required.`;
  }

  return errors;
};
