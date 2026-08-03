export const GMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@gmail\.com$/i;
export const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/;
export const ALPHA_PATTERN = /^[A-Za-z\s.'-]+$/;
export const STRONG_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
export const ADDRESS_TEXT_PATTERN = /^[A-Za-z0-9\s.,/#-]+$/;

const REPEATED_LETTER_PATTERN = /([A-Za-z])\1{3,}/;
const LONG_CONSONANT_RUN_PATTERN = /[bcdfghjklmnpqrstvwxyz]{5,}/i;
const VOWEL_PATTERN = /[aeiou]/i;

const hasRepeatedSubstringPattern = (text) => {
  const normalized = String(text || "").toLowerCase().replace(/[^a-z]/g, "");
  if (normalized.length < 6) return false;

  const checkSegment = (length, threshold) => {
    const counts = new Map();
    for (let i = 0; i + length <= normalized.length; i += 1) {
      const segment = normalized.slice(i, i + length);
      const nextCount = (counts.get(segment) || 0) + 1;
      counts.set(segment, nextCount);
      if (nextCount >= threshold) return true;
    }
    return false;
  };

  // Reject unusual repeated patterns like multiple occurrences of the same 2-letter or 3-letter sequence.
  return checkSegment(2, 3) || checkSegment(3, 2);
};

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
  String(value ?? "").replace(/[^A-Za-z0-9\s.,'&()-]/g, "");

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

export const validateName = (value, label) => {
  const required = validateRequired(value, label);
  if (required) return required;

  const raw = String(value);
  const trimmed = raw.trim();
  const normalized = trimmed.replace(/\s+/g, " ");

  if (/[0-9]/.test(raw)) {
    return `${label} should not contain numbers.`;
  }


  if (/[^A-Za-z\s.'-]/.test(raw)) {
    return `${label} should contain only letters, spaces, apostrophes, or hyphens.`;
  }

  if (/\s{2,}/.test(raw)) {
    return `${label} should not contain consecutive spaces.`;
  }

  if (/^[^A-Za-z]/.test(trimmed) || /[^A-Za-z]$/.test(trimmed)) {
    return `${label} must start and end with a letter.`;
  }

  if (/[.'\-]{2,}/.test(normalized)) {
    return `${label} should not contain repeated punctuation.`;
  }

  if (!/^[A-Za-z](?:[A-Za-z'\- ]*[A-Za-z])?$/.test(normalized)) {
    return `${label} must be a valid name.`;
  }

  const lettersOnly = normalized.replace(/[^A-Za-z]/g, "");
  if (lettersOnly.length < 2) {
    return `${label} must be valid text, not random characters.`;
  }
  if (REPEATED_LETTER_PATTERN.test(lettersOnly)) {
    return `${label} must be valid text, not random characters.`;
  }
  if (hasRepeatedSubstringPattern(lettersOnly)) {
    return `${label} must be valid text, not random characters.`;
  }
  if (LONG_CONSONANT_RUN_PATTERN.test(lettersOnly)) {
    return `${label} must be valid text, not random characters.`;
  }
  return "";
};

export const validateClinicName = (value, label) => {
  const required = validateRequired(value, label);
  if (required) return required;
  const text = String(value).trim();
  if (!/^[A-Za-z0-9\s.,'&()-]+$/.test(text)) {
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
  // Allow abbreviations and common text patterns (e.g., "NA", "n/a", "Bone Splints")
  const hasValidChars = /^[A-Za-z0-9\s.,'/&()-]+$/.test(text);
  if (hasValidChars && text.length >= 2) {
    return "";
  }
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const validateEmail = (value, label = "Email") => {
  const required = validateRequired(value, label);
  if (required) return required;
  const email = String(value || "").trim();
  if (!EMAIL_PATTERN.test(email)) return `${label} must be a valid email address.`;
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
