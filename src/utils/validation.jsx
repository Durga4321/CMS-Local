export const GMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@gmail\.com$/;
export const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/;
export const ALPHA_PATTERN = /^[A-Za-z\s.]+$/;
export const STRONG_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const onlyDigits = (value) => String(value ?? "").replace(/\D/g, "");

export const onlyIndianMobileValue = (value) => {
  const digits = onlyDigits(value).slice(0, 10);
  return digits && !/^[6-9]/.test(digits) ? "" : digits;
};

export const onlyAlpha = (value) =>
  String(value ?? "").replace(/[^A-Za-z\s.]/g, "");

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

export const validateAlpha = (value, label) => {
  const required = validateRequired(value, label);
  if (required) return required;
  return ALPHA_PATTERN.test(String(value).trim())
    ? ""
    : `${label} should contain alphabets only.`;
};

export const validateGmail = (value, label = "Email") => {
  const required = validateRequired(value, label);
  if (required) return required;
  return GMAIL_PATTERN.test(String(value).trim())
    ? ""
    : `${label} must be a valid @gmail.com address.`;
};

export const validateEmailCom = (value, label = "Email") => {
  const required = validateRequired(value, label);
  if (required) return required;
  const text = String(value || "").trim();
  // basic email format check then ensure domain ends with .com
  const basicEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!basicEmail.test(text)) return `${label} must be a valid email address.`;
  return text.toLowerCase().endsWith('.com') ? '' : `${label} must use a .com domain.`;
};

export const validateMobile = (value, label = "Mobile number") => {
  const required = validateRequired(value, label);
  if (required) return required;
  return INDIAN_MOBILE_PATTERN.test(String(value).trim())
    ? ""
    : `${label} must be a valid Indian mobile number.`;
};

export const validateNumeric = (value, label, { integer = false } = {}) => {
  const required = validateRequired(value, label);
  if (required) return required;

  const numberValue = Number(value);
  if (Number.isNaN(numberValue) || numberValue < 0) {
    return `${label} must be a valid number.`;
  }

  if (integer && !Number.isInteger(numberValue)) {
    return `${label} must be a whole number.`;
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
