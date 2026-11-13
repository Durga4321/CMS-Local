export const unwrapPaymentData = value => {
  let result = value;
  for (let depth = 0; depth < 5; depth++) {
    const next = result?.data ?? result?.result;
    if (next == null || typeof next !== 'object') break;
    result = next;
  }
  return result;
};

export const paymentRecordList = value => {
  const data = unwrapPaymentData(value);
  if (Array.isArray(data)) return data;
  for (const key of ['items', 'records', 'results', 'transactions', 'disputes', 'purchases', 'hospitals', 'admins', 'settlements', 'rows']) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return data && typeof data === 'object' ? [data] : [];
};

export const positiveRecordId = (value, label = 'Record ID') => {
  const text = String(value ?? '').trim();
  if (!/^[1-9]\d*$/.test(text)) throw new Error(`${label} must be a positive whole number.`);
  // Keep IDs as strings so int64 refund/dispute IDs never lose precision.
  return text;
};

export const paymentAmount = value => {
  const text = String(value ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text) || !Number.isFinite(Number(text)) || Number(text) <= 0 || !Number.isSafeInteger(Math.round(Number(text) * 100))) {
    throw new Error('Enter an amount greater than zero with at most two decimal places.');
  }
  return Number(text);
};

export const paymentDateQuery = ({ from, to, mode } = {}, includeMode = true) => {
  if (from && to && from > to) throw new Error('The start date must be before the end date.');
  return {
    ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}),
    ...(to ? { to: new Date(`${to}T23:59:59.999`).toISOString() } : {}),
    ...(includeMode && mode ? { mode } : {}),
  };
};

export const merchantSettingsBody = form => {
  const merchantName = String(form.merchantName || '').trim();
  if (!merchantName || merchantName.length > 150) throw new Error('Enter a merchant name of up to 150 characters.');
  if (!['Test', 'Live'].includes(form.mode)) throw new Error('Select Test or Live mode.');
  const body = { merchantName, mode: form.mode, isEnabled: Boolean(form.isEnabled) };
  for (const key of ['credentialReference', 'keyId', 'keySecret', 'webhookSecret']) {
    const value = String(form[key] || '').trim();
    if (value) body[key] = value;
  }
  return body;
};

export const validateSettlementRows = (rows, cms) => {
  if (!Array.isArray(rows) || !rows.length) throw new Error('Choose a settlement file containing at least one row.');
  return rows.map((row, index) => {
    const fail = message => { throw new Error(`Settlement row ${index + 1}: ${message}`); };
    const gatewayPaymentId = String(row.gatewayPaymentId ?? '').trim();
    const settlementId = String(row.settlementId ?? '').trim();
    if (!gatewayPaymentId || !settlementId) fail('payment and settlement IDs are required.');
    const result = { gatewayPaymentId, settlementId };
    for (const key of ['grossAmount', 'feeAmount', 'taxAmount']) {
      const value = String(row[key] ?? '').trim();
      if (!/^\d+(\.\d{1,2})?$/.test(value) || !Number.isFinite(Number(value)) || !Number.isSafeInteger(Math.round(Number(value) * 100))) fail(`${key} must be a nonnegative amount with at most two decimals.`);
      result[key] = Number(value);
    }
    if (Math.round(result.feeAmount * 100) + Math.round(result.taxAmount * 100) > Math.round(result.grossAmount * 100)) fail('fees and tax exceed the gross amount.');
    const date = new Date(row.settledAt);
    if (!row.settledAt || Number.isNaN(date.getTime())) fail('a valid settlement date is required.');
    result.settledAt = date.toISOString();
    if (cms) {
      const purchaseId = positiveRecordId(row.purchaseId, 'Purchase ID');
      if (!Number.isSafeInteger(Number(purchaseId))) fail('purchase ID exceeds the supported numeric range.');
      if (!['Test', 'Live'].includes(String(row.mode))) fail('mode must be Test or Live.');
      result.purchaseId = Number(purchaseId);
      result.mode = row.mode;
    }
    return result;
  });
};

// Never show merchant credentials or tokens in generic server result tables.
export const publicPaymentData = value => {
  if (Array.isArray(value)) return value.map(publicPaymentData);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/secret|token|signature|password|authorization/i.test(key))
    .map(([key, item]) => [key, publicPaymentData(item)]));
  return value;
};
