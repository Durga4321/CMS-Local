export const GMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@gmail\.com$/i;
export const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/;
export const ALPHA_PATTERN = /^[A-Za-z\s.'-]+$/;
export const STRONG_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
export const ADDRESS_TEXT_PATTERN = /^[A-Za-z0-9\s.,/#-]+$/;

const REPEATED_LETTER_PATTERN = /([A-Za-z])\1{3,}/;
const LONG_CONSONANT_RUN_PATTERN = /[bcdfghjklmnpqrstvwxyz]{5,}/i;
const AWKWARD_EMAIL_LOCAL_PATTERN =
  /(?:[bcdfghjklmnpqrstvwxyz]{4,}|[aeiou]{3,}|[bcdfghjklmnpqrstvwxyz]{3}$)/i;
const VOWEL_PATTERN = /[aeiou]/i;
const EMAIL_WORD_PATTERN =
  /(admin|care|clinic|contact|doctor|health|hospital|info|medical|office|patient|reception|support|user)/i;

export const onlyDigits = (value) => String(value ?? "").replace(/\D/g, "");

export const onlyIndianMobileValue = (value) => {
  const digits = onlyDigits(value).slice(0, 10);
  return digits && !/^[6-9]/.test(digits) ? "" : digits;
};

export const onlyAlpha = (value) =>
  String(value ?? "").replace(/[^A-Za-z\s.'-]/g, "");

export const onlyAddressText = (value) =>
  String(value ?? "").replace(/[^A-Za-z0-9\s.,/#-]/g, "");

export const onlyClinicName = (value) =>
  String(value ?? "").replace(/[^A-Za-z0-9\s.,'&()\-]/g, "");

export const onlyNumberValue = (value) =>
  String(value ?? "").replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

export const validateRequired = (value, label) =>
  String(value ?? "").trim() ? "" : `${label} is required.`;

export const validateSelected = (value, label) =>
  String(value ?? "").trim() ? "" : `Please select ${label}.`;

export const validateDate = (value, label, { allowPast = true } = {}) => {
  const required = validateRequired(value, label);
  if (required) return required;

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return `${label} must be a valid date.`;
  }

  if (!allowPast) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return `${label} cannot be in the past.`;
  }

  return "";
};

export const validateTimeRange = (start, end, startLabel = "Start time", endLabel = "End time") => {
  const startError = validateRequired(start, startLabel);
  if (startError) return startError;

  const endError = validateRequired(end, endLabel);
  if (endError) return endError;

  return String(start) < String(end)
    ? ""
    : `${endLabel} must be after ${startLabel.toLowerCase()}.`;
};

export const validateImageFile = (file, label = "Image") => {
  if (!file) return "";
  return String(file.type || "").startsWith("image/")
    ? ""
    : `${label} must be an image file.`;
};

export const hasMeaningfulText = (value) => {
  const text = String(value ?? "").trim();
  const lettersOnly = text.replace(/[^A-Za-z]/g, "");
  const words = text.match(/[A-Za-z]{2,}/g) || [];

  return (
    lettersOnly.length >= 2 &&
    words.some((word) => VOWEL_PATTERN.test(word)) &&
    !REPEATED_LETTER_PATTERN.test(text) &&
    !LONG_CONSONANT_RUN_PATTERN.test(lettersOnly)
  );
};

export const validateAlpha = (value, label) => {
  const required = validateRequired(value, label);
  if (required) return required;
  const text = String(value).trim();
  if (!ALPHA_PATTERN.test(text)) return `${label} should contain alphabets only.`;
  return hasMeaningfulText(text)
    ? ""
    : `${label} must be valid text, not random characters.`;
};

export const validateClinicName = (value, label) => {
  const required = validateRequired(value, label);
  if (required) return required;
  const text = String(value).trim();
  if (!/^[A-Za-z0-9\s.,'&()\-]+$/.test(text)) {
    return `${label} must be valid text, not random characters.`;
  }

  if (!/\bclinic\b$/i.test(text)) {
    return `Enter a valid clinic name (e.g., RJS Clinic, SLS clinic etc.).`;
  }

  const lettersOnly = text.replace(/[^A-Za-z]/g, "");
  return lettersOnly.length >= 2
    ? ""
    : `${label} must be valid text, not random characters.`;
};

export const validateText = (value, label) => {
  const required = validateRequired(value, label);
  if (required) return required;
  const text = String(value).trim();
  return hasMeaningfulText(text)
    ? ""
    : `${label} must be valid text, not random characters.`;
};

export const validateGmail = (value, label = "Email", { strict = true } = {}) => {
  const required = validateRequired(value, label);
  if (required) return required;
  const email = String(value).trim();
  if (!GMAIL_PATTERN.test(email)) return `${label} must be a valid @gmail.com address.`;
  return "";
};

const EMAIL_COM_PATTERN = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.com$/i;

export const validateEmailCom = (value, label = "Email") => {
  const required = validateRequired(value, label);
  if (required) return required;
  const text = String(value || "").trim();
  if (!EMAIL_COM_PATTERN.test(text)) return `Please enter a valid email address.`;
  return "";
};

export const validateMobile = (value, label = "Mobile number") => {
  const required = validateRequired(value, label);
  if (required) return required;

  const phone = String(value).trim();
  const repeatedDigits = /^([0-9])\1{9}$/.test(phone);

  return INDIAN_MOBILE_PATTERN.test(phone) && !repeatedDigits
    ? ""
    : `${label} must be a valid Indian mobile number.`;
};

export const validateNumeric = (value, label, { integer = false, max = null } = {}) => {
  const required = validateRequired(value, label);
  if (required) return required;

  const numberValue = Number(value);
  if (Number.isNaN(numberValue) || numberValue < 0) {
    return `${label} must be a valid number.`;
  }

  if (integer && !Number.isInteger(numberValue)) {
    return `${label} must be a whole number.`;
  }

  if (max != null && numberValue > max) {
    return `${label} must be ${max} or less.`;
  }

  return "";
};

export const validateStrongPassword = (
  value,
  label = "Password",
  { required = true } = {}
) => {
  const text = String(value ?? "");
  if (!text.trim()) {
    return required ? `${label} is required.` : "";
  }

  return STRONG_PASSWORD_PATTERN.test(text)
    ? ""
    : `${label} must include uppercase, lowercase, number, special character, and at least 8 characters.`;
};
