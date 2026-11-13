import { PAYMENT_API_CONTRACTS } from '../config/paymentApiContracts.mjs';

// Inject URL, session and transport dependencies so requests can be tested without payments.
export const createPaymentApiClient = ({ url, getToken, fetchImpl = globalThis.fetch }) => async (
  operation, { params = {}, query = {}, body, file, signal } = {},
) => {
  const contract = PAYMENT_API_CONTRACTS[operation];
  if (!contract) throw new Error(`Unsupported payment operation: ${operation}`);
  const path = contract.path.replace(/\{([^}]+)\}/g, (_, name) => {
    const value = params[name];
    if (value == null || String(value).trim() === '') throw new Error(`${name} is required.`);
    return encodeURIComponent(String(value));
  });
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (!contract.query.includes(name)) throw new Error(`Unsupported query parameter: ${name}`);
    if (value != null && value !== '') search.set(name, String(value));
  }
  if (body != null && !contract.fields) throw new Error('This operation does not accept a JSON body.');
  if (contract.fields) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('A JSON request body is required.');
    for (const name of Object.keys(body)) {
      if (!contract.fields.includes(name)) throw new Error(`Unsupported request field: ${name}`);
    }
    for (const name of contract.required) {
      if (body[name] == null || body[name] === '') throw new Error(`${name} is required.`);
    }
  }
  const headers = { Accept: 'application/json', 'ngrok-skip-browser-warning': 'true' };
  if (contract.auth !== 'public') {
    const token = getToken(contract.auth);
    if (!token) throw new Error('Sign in with the required account to continue.');
    headers.Authorization = `Bearer ${token}`;
  }
  let requestBody;
  if (contract.upload) {
    if (!file) throw new Error('An evidence file is required.');
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) throw new Error('Choose a PDF, JPG or PNG evidence file.');
    requestBody = new FormData();
    requestBody.append('file', file);
  } else if (body != null) {
    headers['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }
  // Never retry writes: a timeout may follow a successful gateway operation.
  const response = await fetchImpl(`${url(path)}${search.size ? `?${search}` : ''}`, {
    method: contract.method, headers, body: requestBody, signal, cache: 'no-store',
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.title || payload?.error || `Request failed (${response.status}).`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
};
