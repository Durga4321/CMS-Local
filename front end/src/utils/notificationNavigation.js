const readFirst = (source = {}, keys = []) => {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
};

const normalizeInternalPath = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "";

  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      return `${url.pathname}${url.search}${url.hash}` || "/";
    } catch {
      return "";
    }
  }

  if (text.startsWith("/")) return text;
  return `/${text}`;
};

const getExplicitNotificationPath = (notification = {}) =>
  normalizeInternalPath(
    readFirst(notification, [
      "redirectUrl",
      "redirectPath",
      "targetUrl",
      "targetPath",
      "actionUrl",
      "actionPath",
      "link",
      "url",
      "route",
      "path",
      "deepLink",
    ])
  );

const includesAny = (value = "", words = []) =>
  words.some((word) => value.includes(word));

export const resolveNotificationPath = (notification = {}, { isSuperAdmin = false } = {}) => {
  const explicitPath = getExplicitNotificationPath(notification);
  if (explicitPath) return explicitPath;

  const text = `${notification.type || ""} ${notification.category || ""} ${notification.title || ""} ${notification.message || ""}`.toLowerCase();

  if (isSuperAdmin) {
    if (includesAny(text, ["clinic", "hospital"])) return "/superadmin/clinics";
    if (includesAny(text, ["admin", "user"])) return "/superadmin/admins";
    if (includesAny(text, ["role", "permission"])) return "/superadmin/roles";
    if (includesAny(text, ["report", "revenue", "payment", "invoice", "bill", "lab"])) return "/superadmin/reports";
    if (includesAny(text, ["audit", "login", "logout"])) return "/superadmin/audit-logs";
    if (includesAny(text, ["setting", "smtp", "email", "sms"])) return "/superadmin/settings";
    return "/superadmin/notifications";
  }

  if (includesAny(text, ["appointment", "booked", "schedule"])) return "/appointments";
  if (includesAny(text, ["patient"])) return "/patients";
  if (includesAny(text, ["doctor"])) return "/doctors";
  if (includesAny(text, ["receptionist"])) return "/receptionists";
  if (includesAny(text, ["nurse"])) return "/nurses";
  if (includesAny(text, ["lab", "diagnostic", "report ready"])) return "/lab-files";
  if (includesAny(text, ["payment", "invoice", "bill", "revenue"])) return "/reports";
  if (includesAny(text, ["setting", "smtp", "email", "sms"])) return "/settings";
  return "/dashboard";
};
