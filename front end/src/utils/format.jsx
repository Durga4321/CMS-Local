export const formatIndianCurrency = (
  value,
  { minimumFractionDigits = 2, maximumFractionDigits = 2 } = {}
) => {
  const amount = Number(value || 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(safeAmount);
};

export const formatCompactIndianCurrency = (value) => {
  const amount = Number(value || 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  if (safeAmount >= 100000) {
    return `${formatIndianCurrency(safeAmount / 100000, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}L`;
  }

  if (safeAmount >= 1000) {
    return `${formatIndianCurrency(safeAmount / 1000, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}k`;
  }

  return formatIndianCurrency(safeAmount, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

export const formatTitleCase = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/\b[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu, (word) =>
      word
        .split(/([']|-)/)
        .map((part) =>
          part === "'" || part === "-"
            ? part
            : part.charAt(0).toUpperCase() + part.slice(1)
        )
        .join("")
    );

export const capitalizeFirstLetter = (value = "") =>
  String(value)
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[^\s]/, (char) => char.toUpperCase());

export const formatDisplayText = (value = "") => formatTitleCase(value);
