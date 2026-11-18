import React, { useRef, useState } from 'react';
import * as api from '../../utils/paymentApi';
import {
  merchantSettingsBody, paymentAmount, paymentDateQuery, paymentRecordList,
  merchantSettingsCreateBody, positiveRecordId, publicPaymentData, unwrapPaymentData, validateSettlementRows,
} from '../../utils/paymentAdministration.mjs';
import './PaymentAdministration.css';

const label = value => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
const textValue = value => {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return <dl>{Object.entries(value).map(([key, item]) => <React.Fragment key={key}><dt>{label(key)}</dt><dd>{textValue(item)}</dd></React.Fragment>)}</dl>;
  return String(value);
};

function Results({ value }) {
  if (value == null) return null;
  const safe = publicPaymentData(unwrapPaymentData(value));
  if (typeof safe !== 'object') return <p>{String(safe)}</p>;
  const records = paymentRecordList(safe).slice(0, 100);
  const keys = [...new Set(records.flatMap(record => record && typeof record === 'object' ? Object.keys(record) : []))];
  if (!records.length) return <p>No records returned.</p>;
  return <div className="payment-api-results" tabIndex={0} aria-label="Payment request results">
    {keys.length ? <table><thead><tr>{keys.map(key => <th key={key} scope="col">{label(key)}</th>)}</tr></thead><tbody>
      {records.map((record, index) => <tr key={index}>{keys.map(key => <td key={key}>{textValue(record?.[key])}</td>)}</tr>)}
    </tbody></table> : <p>{records.map(String).join(', ')}</p>}
  </div>;
}

function useRequest() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const run = async action => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setResult(null);
    try {
      const response = await action();
      const value = unwrapPaymentData(response);
      if (value?.success === false || value?.isSuccess === false) throw new Error(value.message || 'The request was not accepted.');
      setResult(response ?? { message: 'Request completed. Refresh the saved status to confirm the result.' });
      return { ok: true, response };
    } catch (failure) { setError(failure.message || 'Unable to complete the request.'); return { ok: false }; }
    finally { lock.current = false; setBusy(false); }
  };
  return { busy, error, result, run, setError, setResult };
}

const RequestStatus = ({ request }) => <>
  {request.busy && <p role="status">Processing request...</p>}
  {request.error && <p role="alert">{request.error}</p>}
  <Results value={request.result} />
</>;
const Field = ({ title, children }) => <label>{title}{children}</label>;
const RecordId = ({ title, value, onChange, required = true, disabled = false }) => <Field title={title}><input value={value} onChange={onChange} inputMode="numeric" pattern="[1-9][0-9]*" required={required} disabled={disabled} /></Field>;
const Mode = ({ value, onChange, all = false }) => <Field title="Payment mode"><select value={value} onChange={onChange}>{all && <option>All</option>}<option>Test</option><option>Live</option></select></Field>;

function MerchantSettings({ cms, canEdit }) {
  const request = useRequest();
  const [loaded, setLoaded] = useState(false);
  const [method, setMethod] = useState('upi');
  const [upiQr, setUpiQr] = useState(null);
  const [bankProof, setBankProof] = useState(null);
  const [form, setForm] = useState({ merchantName: '', mode: 'Test', isEnabled: false, credentialReference: '', keyId: '', keySecret: '', webhookSecret: '' });
  const [requestError, setRequestError] = useState('');
  const change = event => setForm(current => ({ ...current, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  const load = () => request.run(async () => {
    const response = await (cms ? api.fetchCmsMerchantSettings() : api.fetchHospitalMerchantSettings());
    const data = unwrapPaymentData(response);
    const saved = data?.settings ?? data?.merchantSettings ?? data;
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Merchant settings were not returned in a supported format.');
    setForm({ merchantName: saved.merchantName ?? '', mode: saved.mode === 'Live' ? 'Live' : 'Test', isEnabled: saved.isEnabled === true, credentialReference: saved.credentialReference ?? '', keyId: saved.keyId ?? '', keySecret: '', webhookSecret: '' });
    setLoaded(true);
    return response;
  });
  const loadCredentials = () => request.run(() => cms ? api.fetchCmsMerchantCredentials() : api.fetchHospitalMerchantCredentials());
  const create = () => request.run(async () => {
    const body = merchantSettingsCreateBody(form);
    try {
      const response = await (cms ? api.createCmsMerchantSettings(body) : api.createHospitalMerchantSettings(body));
      setLoaded(true);
      return response;
    }
    finally { setForm(current => ({ ...current, keySecret: '', webhookSecret: '' })); }
  });
  const remove = () => request.run(async () => {
    if (!window.confirm('Delete saved merchant settings and credentials?')) throw new Error('Deletion cancelled.');
    const response = await (cms ? api.deleteCmsMerchantSettings() : api.deleteHospitalMerchantSettings());
    setLoaded(false);
    setForm(current => ({ ...current, isEnabled: false, keyId: '', keySecret: '', webhookSecret: '' }));
    return response;
  });
  const notReady = event => { event.preventDefault(); setRequestError('This upload is not connected yet: backend Swagger has no UPI or bank settings upload/read endpoint. Nothing was uploaded or saved.'); };
  const methods = [
    { id: 'upi', title: 'UPI', description: '' },
    { id: 'bank', title: 'Bank transfer / Net banking', description: '' },
    { id: 'card', title: 'Debit / credit cards', description: '' },
  ];
  return <>
    <div className="payment-method-setup" aria-label="Merchant payment methods">
      {methods.map(item => <button key={item.id} type="button" className={`payment-method-setup-card${method === item.id ? ' is-selected' : ''}`} aria-pressed={method === item.id} onClick={() => { setMethod(item.id); request.setError(''); request.setResult(null); }}>
        <strong>{item.title}</strong><span>{item.description}</span><small>{item.id === 'card' ? 'Gateway configuration' : 'Merchant details upload'}</small>
      </button>)}
    </div>
    {method === 'upi' && <section className="payment-method-setup-form" aria-labelledby="upi-merchant-title">
      <h3 id="upi-merchant-title">UPI merchant setup</h3><p>Add the UPI payment details shown to patients during billing.</p>
      <form onSubmit={notReady}><div className="payment-api-grid">
        <Field title="Merchant / account name"><input required maxLength={150} /></Field>
        <Field title="UPI ID"><input required placeholder="merchant@bank" /></Field>
        <Field title="UPI QR code image (PNG or JPG)"><input type="file" accept="image/png,image/jpeg" onChange={event => setUpiQr(event.target.files?.[0] ?? null)} /></Field>
      </div><p>{upiQr ? `Selected: ${upiQr.name}` : 'Choose a merchant QR image if you use a static QR.'}</p>
      <button type="submit" disabled={!canEdit || request.busy}>Upload UPI details</button></form>
    </section>}
    {method === 'bank' && <section className="payment-method-setup-form" aria-labelledby="bank-merchant-title">
      <h3 id="bank-merchant-title">Merchant bank setup</h3><p>These are the hospital beneficiary details intended for bank transfer and net banking instructions.</p>
      <form onSubmit={notReady}><div className="payment-api-grid">
        <Field title="Account holder name"><input required maxLength={150} /></Field>
        <Field title="Bank name"><input required maxLength={150} /></Field>
        <Field title="Account number"><input required inputMode="numeric" autoComplete="off" /></Field>
        <Field title="IFSC code"><input required maxLength={11} autoCapitalize="characters" /></Field>
        <Field title="Branch (optional)"><input maxLength={150} /></Field>
        <Field title="Bank proof (cancelled cheque or passbook, PDF/JPG/PNG)"><input type="file" accept="application/pdf,image/png,image/jpeg" onChange={event => setBankProof(event.target.files?.[0] ?? null)} /></Field>
      </div><p>{bankProof ? `Selected: ${bankProof.name}` : 'Upload supporting bank proof.'}</p>
      <button type="submit" disabled={!canEdit || request.busy}>Upload bank details</button></form>
    </section>}
    {method === 'card' && <details open className="payment-method-setup-form"><summary>Card gateway credentials</summary>
      <p>Load the saved Razorpay credentials before editing. Leave secret fields empty to retain existing credentials.</p>
      <button type="button" onClick={load} disabled={request.busy}>Load merchant settings</button>
      <button type="button" onClick={loadCredentials} disabled={request.busy}>Load credential status</button>
    <form onSubmit={event => { event.preventDefault(); request.run(async () => {
      const body = merchantSettingsBody(form);
      try { return await (cms ? api.saveCmsMerchantSettings(body) : api.saveHospitalMerchantSettings(body)); }
      finally { setForm(current => ({ ...current, keySecret: '', webhookSecret: '' })); }
    }); }}>
      <fieldset disabled={!canEdit || request.busy}>
        <div className="payment-api-grid">
          <Field title="Merchant name"><input name="merchantName" value={form.merchantName} onChange={change} maxLength={150} required /></Field>
          <Mode value={form.mode} onChange={event => setForm(current => ({ ...current, mode: event.target.value, keyId: '', keySecret: '', webhookSecret: '' }))} />
          <Field title="Credential reference (optional)"><input name="credentialReference" value={form.credentialReference} onChange={change} maxLength={200} /></Field>
          <Field title="Razorpay Key ID"><input name="keyId" value={form.keyId} onChange={change} maxLength={200} autoComplete="off" /></Field>
          <Field title="Razorpay Key Secret"><input name="keySecret" type="password" value={form.keySecret} onChange={change} autoComplete="new-password" /></Field>
          <Field title="Webhook Secret"><input name="webhookSecret" type="password" value={form.webhookSecret} onChange={change} autoComplete="new-password" /></Field>
        </div>
        <label className="payment-api-check"><input type="checkbox" name="isEnabled" checked={form.isEnabled} onChange={change} />Enable this merchant mode</label>
        <button type="button" disabled={!canEdit || request.busy} onClick={create}>Create merchant settings</button>
        <button type="submit" disabled={!loaded}>Save merchant settings</button>
      </fieldset>
    </form>
    <button type="button" disabled={!canEdit || !loaded || request.busy} onClick={remove}>Delete merchant settings</button>
    </details>}
    {requestError && <p role="alert">{requestError}</p>}
    <RequestStatus request={request} />
  </>;
}

function Onboarding({ cms, canEdit }) {
  const request = useRequest();
  const [hospitalId, setHospitalId] = useState('');
  const [adminId, setAdminId] = useState('');
  const [target, setTarget] = useState('hospital');
  const [review, setReview] = useState({ status: 'Approved', providerMerchantAccountId: '', notes: '' });
  const [confirmed, setConfirmed] = useState(false);
  return <details><summary>Merchant KYC and onboarding</summary>
    <div className="payment-api-actions">
      <button type="button" disabled={request.busy} onClick={() => request.run(() => cms ? api.fetchCmsOnboarding() : api.fetchHospitalOnboarding())}>View onboarding status</button>
      {cms && <>
        <button type="button" disabled={request.busy} onClick={() => request.run(api.fetchHospitalOnboardingReviews)}>Load hospital onboarding</button>
        <button type="button" disabled={request.busy} onClick={() => request.run(api.fetchAdminOnboarding)}>Load Admin onboarding</button>
      </>}
    </div>
    {!cms ? <form onSubmit={event => { event.preventDefault(); request.run(async () => {
      if (!confirmed) throw new Error('Confirm submission of the merchant profile.');
      const response = await api.submitHospitalOnboarding();
      setConfirmed(false);
      return response;
    }); }}><fieldset disabled={!canEdit || request.busy}>
      <label className="payment-api-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required />Submit the saved hospital merchant profile for review</label>
      <button type="submit">Submit merchant profile</button>
    </fieldset></form> : <>
      <form onSubmit={event => { event.preventDefault(); request.run(() => api.fetchAdminOnboardingDetails(positiveRecordId(adminId, 'Admin ID'))); }}>
        <div className="payment-api-grid"><RecordId title="Admin ID" value={adminId} onChange={event => setAdminId(event.target.value)} /></div>
        <button type="submit" disabled={request.busy}>View Admin purchase history</button>
      </form>
      <form onSubmit={event => { event.preventDefault(); request.run(async () => {
        if (!confirmed) throw new Error('Confirm the merchant review result.');
        const body = { ...review, providerMerchantAccountId: review.providerMerchantAccountId.trim() || null, notes: review.notes.trim() || null };
        const response = await (target === 'cms' ? api.reviewCmsOnboarding(body) : api.reviewHospitalOnboarding(positiveRecordId(hospitalId, 'Hospital ID'), body));
        setConfirmed(false);
        return response;
      }); }}><fieldset disabled={!canEdit || request.busy}>
        <div className="payment-api-grid">
          <Field title="Review merchant"><select value={target} onChange={event => { setTarget(event.target.value); setConfirmed(false); }}><option value="hospital">Hospital</option><option value="cms">CMS Owner</option></select></Field>
          {target === 'hospital' && <RecordId title="Hospital ID" value={hospitalId} onChange={event => { setHospitalId(event.target.value); setConfirmed(false); }} />}
          <Field title="Review result"><select value={review.status} onChange={event => { setReview(current => ({ ...current, status: event.target.value })); setConfirmed(false); }}><option>Approved</option><option>Rejected</option><option>Pending</option><option>ReviewRequired</option></select></Field>
          <Field title="Razorpay merchant account ID"><input value={review.providerMerchantAccountId} onChange={event => setReview(current => ({ ...current, providerMerchantAccountId: event.target.value }))} /></Field>
          <Field title="Review notes"><textarea value={review.notes} onChange={event => setReview(current => ({ ...current, notes: event.target.value }))} /></Field>
        </div>
        <label className="payment-api-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required />Confirm this merchant review result</label>
        <button type="submit">Save onboarding review</button>
      </fieldset></form>
    </>}
    <RequestStatus request={request} />
  </details>;
}

function Refunds({ cms, canEdit }) {
  const request = useRequest();
  const [recordId, setRecordId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [refundId, setRefundId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reconciled, setReconciled] = useState(false);
  const key = useRef('');
  const refundLock = useRef(false);
  return <details><summary>Payment refunds</summary>
    <p>Enter the paid {cms ? 'subscription purchase' : 'hospital transaction'} ID and the amount in rupees. Reconcile an existing refund if its outcome is pending or uncertain.</p>
    <form onSubmit={event => { event.preventDefault(); request.run(async () => {
      if (!confirmed) throw new Error('Confirm the refund amount and record before submitting.');
      if (refundLock.current) throw new Error('This refund was already submitted. Reconcile its status before starting another refund.');
      const id = positiveRecordId(recordId, cms ? 'Purchase ID' : 'Transaction ID');
      const body = { amount: paymentAmount(amount), reason: reason.trim() || null };
      if (cms) { key.current ||= crypto.randomUUID(); body.idempotencyKey = key.current; }
      refundLock.current = true;
      setSubmitted(true); setReconciled(false);
      const response = await (cms ? api.createCmsRefund(id, body) : api.createHospitalRefund(id, body));
      const data = unwrapPaymentData(response);
      const idReturned = data?.refundId ?? data?.refund?.refundId ?? data?.refund?.id;
      if (idReturned != null) setRefundId(String(idReturned));
      return response;
    }); }}>
      <fieldset disabled={!canEdit || request.busy || submitted}>
        <div className="payment-api-grid">
          <RecordId title={cms ? 'Purchase ID' : 'Transaction ID'} value={recordId} onChange={event => { setRecordId(event.target.value); setConfirmed(false); }} />
          <Field title="Refund amount (₹)"><input type="number" value={amount} onChange={event => { setAmount(event.target.value); setConfirmed(false); }} min="0.01" step="0.01" required /></Field>
          <Field title="Refund reason"><textarea value={reason} onChange={event => setReason(event.target.value)} /></Field>
        </div>
        <label className="payment-api-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required />I confirm a refund of ₹{amount || '0'} for {cms ? 'purchase' : 'transaction'} {recordId || '—'}</label>
        <button type="submit">Submit refund</button>
      </fieldset>
    </form>
    <form onSubmit={event => { event.preventDefault(); request.run(async () => {
      const id = positiveRecordId(refundId, 'Refund ID');
      const response = await (cms ? api.reconcileCmsRefund(id) : api.reconcileHospitalRefund(id));
      const data = unwrapPaymentData(response);
      const state = String(data?.refundStatus ?? data?.status ?? data?.refund?.status ?? '').toLowerCase();
      setReconciled(['processed', 'completed', 'succeeded', 'success', 'failed', 'cancelled', 'canceled'].includes(state));
      return response;
    }); }}><fieldset disabled={!canEdit || request.busy}>
      <div className="payment-api-grid"><RecordId title="Existing refund ID" value={refundId} onChange={event => { setRefundId(event.target.value); setReconciled(false); }} /></div>
      <button type="submit">Reconcile existing refund</button>
      {submitted && <p role="status">A refund request was submitted. Do not submit it again; reconcile the existing refund status.</p>}
      {submitted && <button type="button" disabled={!reconciled} onClick={() => {
        refundLock.current = false; key.current = ''; setSubmitted(false); setReconciled(false); setRecordId(''); setAmount(''); setReason(''); setRefundId(''); setConfirmed(false);
      }}>Start another refund after reconciliation</button>}
    </fieldset></form>
    <RequestStatus request={request} />
  </details>;
}

function SettlementsAndReports({ cms, canEdit, initialOpen = false }) {
  const request = useRequest();
  const [filters, setFilters] = useState({ from: '', to: '', mode: 'Test' });
  const [rows, setRows] = useState([]);
  const [imported, setImported] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const submittedImports = useRef(new Set());
  const readFile = event => {
    const file = event.target.files?.[0];
    setRows([]); setImported(false); setConfirmed(false);
    if (!file) return;
    request.run(async () => {
      if (file.size > 5 * 1024 * 1024) throw new Error('Choose a settlement file smaller than 5 MB.');
      if (!/\.(csv|xlsx)$/i.test(file.name)) throw new Error('Choose a CSV or XLSX settlement file.');
      const XLSX = await import('xlsx');
      const book = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const parsed = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: '' });
      const validated = validateSettlementRows(parsed, cms);
      if (submittedImports.current.has(JSON.stringify(validated))) throw new Error('These settlement rows were already submitted. Check the report before importing them again.');
      setRows(validated);
      return { message: `${validated.length} settlement rows validated. Confirm before importing.` };
    });
  };
  const template = () => {
    const headers = [...(cms ? ['purchaseId', 'mode'] : []), 'gatewayPaymentId', 'settlementId', 'grossAmount', 'feeAmount', 'taxAmount', 'settledAt'];
    const url = URL.createObjectURL(new Blob([headers.join(',') + '\r\n'], { type: 'text/csv' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'settlement-import-template.csv'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <details open={initialOpen}><summary>{initialOpen ? 'All payment transactions' : 'Payment reports and settlements'}</summary>
    {initialOpen && <p>Transaction rows come from the hospital payment report. Use the CSV export to download the full report. If the API returns totals only, a transaction-list endpoint is needed to show every payment here.</p>}
    <div className="payment-api-grid">
      <Field title="From date"><input type="date" value={filters.from} onChange={event => setFilters(current => ({ ...current, from: event.target.value }))} /></Field>
      <Field title="To date"><input type="date" value={filters.to} onChange={event => setFilters(current => ({ ...current, to: event.target.value }))} /></Field>
      <Mode all value={filters.mode} onChange={event => setFilters(current => ({ ...current, mode: event.target.value }))} />
    </div>
    <div className="payment-api-actions">
      <button type="button" disabled={request.busy} onClick={() => request.run(() => cms ? api.fetchCmsPaymentRevenue(paymentDateQuery(filters)) : api.fetchHospitalPaymentRevenue(paymentDateQuery(filters)))}>{initialOpen ? 'Load all payment transactions' : 'Load payment revenue report'}</button>
      {!cms && <button type="button" disabled={request.busy} onClick={() => request.run(async () => {
        const result = await api.exportHospitalPaymentReport({ ...paymentDateQuery(filters), format: 'csv' });
        const url = URL.createObjectURL(result.blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'hospital-payment-report.csv';
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return { message: 'Hospital payment report downloaded.' };
      })}>Export hospital payment report (CSV)</button>}
      {!initialOpen && <button type="button" disabled={!canEdit || request.busy || (cms && filters.mode === 'All')} onClick={() => request.run(() => cms ? api.syncCmsSettlements(paymentDateQuery(filters)) : api.syncHospitalSettlements(paymentDateQuery(filters, false)))}>Sync settlement payouts</button>}
    </div>
    {!initialOpen && <><p className="payment-api-muted">Hospital payout sync uses the saved merchant mode. CMS payout sync requires Test or Live. Report dates include the full selected days.</p>
    <button type="button" onClick={template}>Download settlement import template</button>
    <form onSubmit={event => { event.preventDefault(); request.run(async () => {
      if (!confirmed) throw new Error('Confirm the settlement rows before importing.');
      const validated = validateSettlementRows(rows, cms);
      if (imported) throw new Error('These rows were already submitted. Refresh the report before importing again.');
      const identity = JSON.stringify(validated);
      if (submittedImports.current.has(identity)) throw new Error('These settlement rows were already submitted. Check the report before importing again.');
      submittedImports.current.add(identity);
      setImported(true);
      return cms ? api.reconcileCmsSettlements(validated) : api.reconcileHospitalSettlements(validated);
    }); }}><fieldset disabled={!canEdit || request.busy}>
      <div className="payment-api-grid"><Field title="Settlement rows (CSV or XLSX)"><input type="file" accept=".csv,.xlsx" onChange={readFile} /></Field></div>
      <p>{rows.length} validated rows</p>
      <label className="payment-api-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required />Confirm these settlement rows for reconciliation</label>
      <button type="submit" disabled={!rows.length || imported}>Import and reconcile settlements</button>
    </fieldset></form>
    </>}
    <RequestStatus request={request} />
  </details>;
}

function HospitalPaymentTools({ canEdit }) {
  const request = useRequest();
  const [recordId, setRecordId] = useState('');
  const [billingId, setBillingId] = useState('');
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const amountValue = () => paymentAmount(amount);
  const billingRecordId = () => Number(positiveRecordId(billingId, 'Billing ID'));
  return <details><summary>QR codes, payment links, and public status</summary>
    <p>Create a bill specific QR request using the entered amount, or a payment link from the saved bill. Payment links can be revoked; public tokens only retrieve payment details and status.</p>
    <div className="payment-api-grid">
      <RecordId title="Billing ID" value={billingId} onChange={event => { setBillingId(event.target.value); setConfirmed(false); }} />
      <Field title="QR amount (₹)"><input type="number" min="0.01" step="0.01" value={amount} onChange={event => { setAmount(event.target.value); setConfirmed(false); }} required /></Field>
    </div>
    <label className="payment-api-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Confirm bill and amount before creating a payment request</label>
    <div className="payment-api-actions">
      <button type="button" disabled={!canEdit || request.busy} onClick={() => request.run(async () => { if (!confirmed) throw new Error('Confirm the bill and amount first.'); return api.createHospitalQr({ billingId: billingRecordId(), amount: amountValue() }); })}>Create Razorpay QR</button>
      <button type="button" disabled={!canEdit || request.busy} onClick={() => request.run(async () => { if (!confirmed) throw new Error('Confirm the bill and amount first.'); return api.createHospitalPaymentLink({ billingId: billingRecordId() }); })}>Create payment link</button>
    </div>
    <div className="payment-api-grid"><RecordId title="QR ID or payment link ID" value={recordId} onChange={event => setRecordId(event.target.value)} /></div>
    <div className="payment-api-actions">
      <button type="button" disabled={request.busy} onClick={() => request.run(() => api.fetchHospitalQr(positiveRecordId(recordId, 'QR ID')))}>Get QR status</button>
      <button type="button" disabled={!canEdit || request.busy || !window.confirm} onClick={() => request.run(async () => { if (!window.confirm('Revoke this payment link?')) throw new Error('Revocation cancelled.'); return api.revokeHospitalPaymentLink(positiveRecordId(recordId, 'Payment link ID')); })}>Revoke payment link</button>
    </div>
    <div className="payment-api-grid"><Field title="Public payment token"><input value={token} onChange={event => setToken(event.target.value)} required /></Field></div>
    <div className="payment-api-actions">
      <button type="button" disabled={request.busy || !token.trim()} onClick={() => request.run(() => api.fetchPublicHospitalPayment(token.trim()))}>View public payment</button>
      <button type="button" disabled={request.busy || !token.trim()} onClick={() => request.run(() => api.fetchPublicHospitalPaymentStatus(token.trim()))}>Check public payment status</button>
    </div>
    <RequestStatus request={request} />
  </details>;
}

function HospitalReconciliation({ canEdit }) {
  const request = useRequest();
  const [settlementId, setSettlementId] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [paymentType, setPaymentType] = useState('Order');
  const [token, setToken] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  return <details><summary>Settlement reconciliation and payment recovery</summary>
    <p>Review reconciliation status and payment evidence. Recovery checks Razorpay before recording any verified payment.</p>
    <div className="payment-api-actions">
      <button type="button" disabled={request.busy} onClick={() => request.run(api.fetchHospitalRecoverySummary)}>Load recovery summary</button>
      <button type="button" disabled={request.busy} onClick={() => request.run(api.fetchHospitalReconciliationSummary)}>Load reconciliation summary</button>
      <button type="button" disabled={request.busy} onClick={() => request.run(() => api.fetchHospitalReconciliationHistory(50))}>Load recent recovery history</button>
      <button type="button" disabled={request.busy} onClick={() => request.run(api.fetchHospitalReconciliationCandidates)}>Load recovery candidates</button>
      <button type="button" disabled={!canEdit || request.busy || !window.confirm} onClick={() => request.run(async () => { if (!window.confirm('Discover eligible payments and attempt gateway-verified recovery?')) throw new Error('Recovery cancelled.'); return api.runHospitalDiscoveredReconciliation(); })}>Run discovered recovery batch</button>
    </div>
    <div className="payment-api-grid">
      <Field title="Settlement status (optional)"><select value={token} onChange={event => setToken(event.target.value)}><option value="">All statuses</option><option>Pending</option><option>Matched</option><option>ReviewRequired</option></select></Field>
    </div>
    <button type="button" disabled={request.busy} onClick={() => request.run(() => api.fetchHospitalReconciliationSettlements(token ? { status: token } : {}))}>List settlements</button>
    <div className="payment-api-grid"><RecordId title="Settlement ID" value={settlementId} onChange={event => { setSettlementId(event.target.value); setConfirmed(false); }} /></div>
    <div className="payment-api-actions">
      <button type="button" disabled={request.busy} onClick={() => request.run(() => api.fetchHospitalReconciliationSettlement(positiveRecordId(settlementId, 'Settlement ID')))}>View settlement details</button>
      <button type="button" disabled={request.busy} onClick={() => request.run(() => api.fetchHospitalSettlementPayments(positiveRecordId(settlementId, 'Settlement ID')))}>View settlement payments</button>
    </div>
    <label className="payment-api-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I reviewed this settlement and want to request gateway reconciliation</label>
    <button type="button" disabled={!canEdit || request.busy || !confirmed} onClick={() => request.run(async () => { const response = await api.reconcileHospitalSettlement(positiveRecordId(settlementId, 'Settlement ID')); setConfirmed(false); return response; })}>Reconcile this settlement</button>
    <form onSubmit={event => { event.preventDefault(); request.run(() => api.runHospitalPaymentReconciliation({ paymentType, ...(paymentType === 'Order' ? { localOrderId: positiveRecordId(paymentId, 'Local order ID') } : { qrId: positiveRecordId(paymentId, 'QR ID') }) })); }}>
      <div className="payment-api-grid"><Field title="Recovery record type"><select value={paymentType} onChange={event => setPaymentType(event.target.value)}><option>Order</option><option>QR</option></select></Field><RecordId title={paymentType === 'Order' ? 'Local order ID' : 'QR ID'} value={paymentId} onChange={event => setPaymentId(event.target.value)} /></div>
      <button type="submit" disabled={!canEdit || request.busy}>Recover one payment after gateway verification</button>
    </form>
    <form onSubmit={event => { event.preventDefault(); request.run(() => api.runHospitalPaymentReconciliationBatch([{ paymentType, ...(paymentType === 'Order' ? { localOrderId: positiveRecordId(paymentId, 'Local order ID') } : { qrId: positiveRecordId(paymentId, 'QR ID') }) }])); }}>
      <button type="submit" disabled={!canEdit || request.busy}>Run batch recovery for this record</button>
    </form>
    <RequestStatus request={request} />
  </details>;
}

function Disputes({ cms, canEdit }) {
  const request = useRequest();
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('All');
  const [disputeId, setDisputeId] = useState('');
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState('');
  const [evidenceType, setEvidenceType] = useState('');
  const [documentIds, setDocumentIds] = useState('');
  const [amount, setAmount] = useState('');
  const [acceptConfirmed, setAcceptConfirmed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const submitLock = useRef(false);
  const submittedDisputes = useRef(new Set());
  const selectDispute = event => {
    const pending = submittedDisputes.current.has(event.target.value.trim());
    setDisputeId(event.target.value); setFile(null); setDocumentIds(''); setSummary(''); setEvidenceType(''); setAmount(''); setAcceptConfirmed(false); setSubmitted(pending); submitLock.current = pending;
  };
  return <details><summary>Payment disputes and evidence</summary>
    <div className="payment-api-grid">
      <Field title="Dispute status (optional)"><input value={status} onChange={event => setStatus(event.target.value)} /></Field>
      {cms && <Mode all value={mode} onChange={event => setMode(event.target.value)} />}
    </div>
    <button type="button" disabled={request.busy} onClick={() => request.run(() => {
      const query = { ...(status.trim() ? { status: status.trim() } : {}), ...(cms ? { mode } : {}) };
      return cms ? api.fetchCmsDisputes(query) : api.fetchHospitalDisputes(query);
    })}>Load disputes</button>
    <div className="payment-api-grid"><RecordId title="Dispute ID" value={disputeId} onChange={selectDispute} required={false} disabled={request.busy} /></div>
    <form onSubmit={event => { event.preventDefault(); request.run(async () => {
      const id = positiveRecordId(disputeId, 'Dispute ID');
      const response = await (cms ? api.uploadCmsDisputeEvidence(id, file) : api.uploadHospitalDisputeEvidence(id, file));
      const data = unwrapPaymentData(response);
      const documentId = data?.documentId ?? data?.gatewayDocumentId ?? data?.razorpayDocumentId;
      if (documentId) setDocumentIds(current => [...new Set([...current.split(/[\s,]+/).filter(Boolean), String(documentId)])].join(', '));
      return response;
    }); }}><fieldset disabled={!canEdit || request.busy || submitted}>
      <Field title="Evidence document (PDF, JPG or PNG)"><input key={disputeId} type="file" accept="application/pdf,image/jpeg,image/png" onChange={event => setFile(event.target.files?.[0] ?? null)} required /></Field>
      <button type="submit">Upload dispute evidence</button>
    </fieldset></form>
    <form onSubmit={event => { event.preventDefault(); request.run(async () => {
      const id = positiveRecordId(disputeId, 'Dispute ID');
      if (submitLock.current) throw new Error('This dispute action was already submitted. Refresh disputes to check the result.');
      if (!summary.trim()) throw new Error('Enter an evidence summary before contesting the dispute.');
      const body = { summary: summary.trim(), evidenceType: evidenceType.trim() || null, documentIds: documentIds.split(/[\s,]+/).filter(Boolean), ...(amount ? { amount: paymentAmount(amount) } : {}) };
      submitLock.current = true; setSubmitted(true);
      submittedDisputes.current.add(id);
      return cms ? api.contestCmsDispute(id, body) : api.contestHospitalDispute(id, body);
    }); }}><fieldset disabled={!canEdit || request.busy || submitted}>
      <div className="payment-api-grid">
        <Field title="Evidence summary"><textarea value={summary} onChange={event => setSummary(event.target.value)} required /></Field>
        <Field title="Evidence type (optional)"><input value={evidenceType} onChange={event => setEvidenceType(event.target.value)} /></Field>
        <Field title="Uploaded document IDs"><input value={documentIds} onChange={event => setDocumentIds(event.target.value)} placeholder="Separate document IDs with commas" /></Field>
        <Field title="Contested amount (₹, optional)"><input type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} /></Field>
      </div>
      <button type="submit">Contest dispute with evidence</button>
    </fieldset></form>
    <form onSubmit={event => { event.preventDefault(); request.run(async () => {
      if (!acceptConfirmed) throw new Error('Confirm acceptance of this dispute.');
      const id = positiveRecordId(disputeId, 'Dispute ID');
      if (submitLock.current) throw new Error('This dispute action was already submitted. Refresh disputes to check the result.');
      submitLock.current = true; setSubmitted(true);
      submittedDisputes.current.add(id);
      return cms ? api.acceptCmsDispute(id) : api.acceptHospitalDispute(id);
    }); }}><fieldset disabled={!canEdit || request.busy || submitted}>
      <label className="payment-api-check"><input type="checkbox" checked={acceptConfirmed} onChange={event => setAcceptConfirmed(event.target.checked)} required />I accept dispute {disputeId || '—'} and understand this action cannot be undone</label>
      <button type="submit">Accept dispute</button>
    </fieldset></form>
    {submitted && <p role="status">Dispute action submitted. Load disputes to check the saved result before any further action.</p>}
    <RequestStatus request={request} />
  </details>;
}

export default function PaymentAdministration({ scope = 'hospital', canEdit = false, initialSection }) {
  const cms = scope === 'cms';
  return <section className="payment-api-panel" aria-label={cms ? 'CMS payment administration' : 'Hospital payment administration'}>
    <h2>{cms ? 'CMS payment settings' : 'Payment methods and merchant details'}</h2>
    <p>{cms ? 'Load and update the saved Razorpay merchant configuration.' : 'Manage merchant payment settings here. Payment history is available on its own tab.'}</p>
    {!canEdit && <p>You have view-only access. Payment changes require the appropriate account permissions.</p>}
    <MerchantSettings cms={cms} canEdit={canEdit} />
    <Onboarding cms={cms} canEdit={canEdit} />
    <Refunds cms={cms} canEdit={canEdit} />
    <SettlementsAndReports cms={cms} canEdit={canEdit} initialOpen={initialSection === 'reports'} />
    {!cms && <>
      <HospitalPaymentTools canEdit={canEdit} />
      <HospitalReconciliation canEdit={canEdit} />
    </>}
    <Disputes cms={cms} canEdit={canEdit} />
  </section>;
}
