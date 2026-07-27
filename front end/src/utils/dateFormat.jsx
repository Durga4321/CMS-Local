export const formatDateMMDDYYYY = (value, fallback = "-") => {
  if (!value || value === "0001-01-01T00:00:00") return fallback;

  const raw = String(value).trim();
  const isoDateTimeMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (isoDateTimeMatch) {
    const [, year, month, day, hour, minute, second = "00"] = isoDateTimeMatch;
    const isDateOnlyTime = hour === "00" && minute === "00" && second === "00";

    if (isDateOnlyTime) {
      return `${month}/${day}/${year}`;
    }

    const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw);
    const date = new Date(hasTimezone ? raw : `${raw}Z`);

    if (!Number.isNaN(date.getTime())) {
      const localMonth = String(date.getMonth() + 1).padStart(2, "0");
      const localDay = String(date.getDate()).padStart(2, "0");
      const localYear = date.getFullYear();
      return `${localMonth}/${localDay}/${localYear}`;
    }
  }

  const isoDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch;
    return `${month}/${day}/${year}`;
  }

  const dmyDateMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyDateMatch) {
    const [, day, month, year] = dmyDateMatch;
    return `${month.padStart(2, "0")}/${day.padStart(2, "0")}/${year}`;
  }

  const dateValue = raw;
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return raw || fallback;

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
};
