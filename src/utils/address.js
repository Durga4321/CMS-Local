import {
  ADDRESS_TEXT_PATTERN,
  ALPHA_PATTERN,
  hasMeaningfulText,
  validateRequired,
} from "./validation";

export const emptyAddressParts = {
  streetVillage: "",
  city: "",
  state: "",
  country: "",
  pincode: "",
};

export const onlyPincodeValue = (value) =>
  String(value ?? "").replace(/\D/g, "").slice(0, 6);

const VALID_COUNTRIES = new Set(
  [
    "afghanistan",
    "australia",
    "bangladesh",
    "bhutan",
    "canada",
    "china",
    "france",
    "germany",
    "india",
    "indonesia",
    "ireland",
    "italy",
    "japan",
    "malaysia",
    "maldives",
    "myanmar",
    "nepal",
    "netherlands",
    "new zealand",
    "pakistan",
    "singapore",
    "south africa",
    "sri lanka",
    "thailand",
    "united arab emirates",
    "uae",
    "united kingdom",
    "uk",
    "united states",
    "usa",
  ].map((country) => country.toLowerCase())
);

export const parseAddress = (address = "") => {
  const parts = String(address)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const pincodeMatch = String(address).match(/\b\d{5,6}\b/);

  return {
    streetVillage: parts[0]?.replace(/\b\d{5,6}\b/g, "").trim() || "",
    city: parts[1]?.replace(/\b\d{5,6}\b/g, "").trim() || "",
    state: parts[2]?.replace(/\b\d{5,6}\b/g, "").trim() || "",
    country: parts[3]?.replace(/\b\d{5,6}\b/g, "").trim() || "",
    pincode: pincodeMatch?.[0] || parts[4] || "",
  };
};

export const buildAddress = (parts = {}) =>
  [
    parts.streetVillage,
    parts.city,
    parts.state,
    parts.country,
    parts.pincode,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");

const validateAddressText = (value, label, { place = false } = {}) => {
  const required = validateRequired(value, label);
  if (required) return required;

  const text = String(value || "").trim();
  const pattern = place ? ALPHA_PATTERN : ADDRESS_TEXT_PATTERN;
  if (!pattern.test(text)) {
    return place
      ? `${label} should contain alphabets only.`
      : `${label} contains invalid characters.`;
  }

  return hasMeaningfulText(text)
    ? ""
    : `${label} must be valid text, not random characters.`;
};

const validateCountry = (value) => {
  const countryTextError = validateAddressText(value, "Country", { place: true });
  if (countryTextError) return countryTextError;

  const country = String(value).trim().replace(/\s+/g, " ").toLowerCase();
  return VALID_COUNTRIES.has(country) ? "" : "Country must be a valid country name.";
};

export const validateAddressParts = (parts = {}, label = "Address") => {
  const errors = {};
  const fields = [
    ["streetVillage", "Street/Village name"],
    ["city", "City"],
    ["state", "State"],
    ["country", "Country"],
    ["pincode", "Pincode"],
  ];

  fields.forEach(([key, fieldLabel]) => {
    const required = validateRequired(parts[key], fieldLabel);
    if (required) errors[key] = required;
  });

  if (!errors.streetVillage) {
    errors.streetVillage = validateAddressText(
      parts.streetVillage,
      "Street/Village name"
    );
  }

  if (!errors.city) {
    errors.city = validateAddressText(parts.city, "City", { place: true });
  }

  if (!errors.state) {
    errors.state = validateAddressText(parts.state, "State", { place: true });
  }

  if (!errors.country) {
    errors.country = validateCountry(parts.country);
  }

  if (!errors.pincode && !/^\d{6}$/.test(String(parts.pincode || "").trim())) {
    errors.pincode = "Pincode must be exactly 6 digits.";
  }

  if (!Object.keys(errors).length && !buildAddress(parts)) {
    errors.address = `${label} is required.`;
  }

  return errors;
};
