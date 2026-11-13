import React, { useRef, useState } from 'react';
import * as api from '../../utils/paymentApi';
import {
  merchantSettingsBody, paymentAmount, paymentDateQuery, paymentRecordList,
  positiveRecordId, publicPaymentData, unwrapPaymentData, validateSettlementRows,
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
  return { busy, error, result, run };
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
  const [form, setForm] = useState({ merchantName: '', mode: 'Test', isEnabled: false, credentialReference: '', keyId: '', keySecret: '', webhookSecret: '' });
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
  return <details><summary>Razorpay merchant settings</summary>
    <p>Load the saved merchant settings before editing. Leave secret fields empty to retain existing credentials. Enabling payments is subject to backend credential and KYC validation.</p>
    <button type="button" onClick={load} disabled={request.busy}>Load merchant settings</button>
    <form onSubmit={event => { event.preventDefault(); request.run(async () => {
      const body = merchantSettingsBody(form);
      try { return await (cms ? api.saveCmsMerchantSettings(body) : api.saveHospitalMerchantSettings(body)); }
      finally { setForm(current => ({ ...current, keySecret: '', webhookSecret: '' })); }
    }); }}>
      <fieldset disabled={!canEdit || !loaded || request.busy}>
        <div className="payment-api-grid">
          <Field title="Merchant name"><input name="merchantName" value={form.merchantName} onChange={change} maxLength={150} required /></Field>
          <Mode value={form.mode} onChange={event => setForm(current => ({ ...current, mode: event.target.value, keyId: '', keySecret: '', webhookSecret: '' }))} />
          <Field title="Credential reference (optional)"><input name="credentialReference" value={form.credentialReference} onChange={change} maxLength={200} /></Field>
          <Field title="Razorpay Key ID"><input name="keyId" value={form.keyId} onChange={change} maxLength={200} autoComplete="off" /></Field>
          <Field title="Razorpay Key Secret"><input name="keySecret" type="password" value={form.keySecret} onChange={change} autoComplete="new-password" /></Field>
          <Field title="Webhook Secret"><input name="webhookSecret" type="password" value={form.webhookSecret} onChange={change} autoComplete="new-password" /></Field>
        </div>
        <label className="payment-api-check"><input type="checkbox" name="isEnabled" checked={form.isEnabled} onChange={change} />Enable this merchant mode</label>
        <button type="submit">Save merchant settings</button>
      </fieldset>
    </form>
    <RequestStatus request={request} />
  </details>;
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

function SettlementsAndReports({ cms, canEdit }) {
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
  return <details><summary>Payment reports and settlements</summary>
    <div className="payment-api-grid">
      <Field title="From date"><input type="date" value={filters.from} onChange={event => setFilters(current => ({ ...current, from: event.target.value }))} /></Field>
      <Field title="To date"><input type="date" value={filters.to} onChange={event => setFilters(current => ({ ...current, to: event.target.value }))} /></Field>
      <Mode all value={filters.mode} onChange={event => setFilters(current => ({ ...current, mode: event.target.value }))} />
    </div>
    <div className="payment-api-actions">
      <button type="button" disabled={request.busy} onClick={() => request.run(() => cms ? api.fetchCmsPaymentRevenue(paymentDateQuery(filters)) : api.fetchHospitalPaymentRevenue(paymentDateQuery(filters)))}>Load payment revenue report</button>
      <button type="button" disabled={!canEdit || request.busy || (cms && filters.mode === 'All')} onClick={() => request.run(() => cms ? api.syncCmsSettlements(paymentDateQuery(filters)) : api.syncHospitalSettlements(paymentDateQuery(filters, false)))}>Sync settlement payouts</button>
    </div>
    <p className="payment-api-muted">Hospital payout sync uses the saved merchant mode. CMS payout sync requires Test or Live. Report dates include the full selected days.</p>
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

export default function PaymentAdministration({ scope = 'hospital', canEdit = false }) {
  const cms = scope === 'cms';
  return <section className="payment-api-panel" aria-label={cms ? 'CMS payment administration' : 'Hospital payment administration'}>
    <h2>{cms ? 'CMS Razorpay administration' : 'Hospital Razorpay administration'}</h2>
    <p>Settings and actions submitted in this section are saved to your {cms ? 'CMS merchant' : 'hospital'} account.</p>
    {!canEdit && <p>You have view-only access. Payment changes require the appropriate account permissions.</p>}
    <MerchantSettings cms={cms} canEdit={canEdit} />
    <Onboarding cms={cms} canEdit={canEdit} />
    <Refunds cms={cms} canEdit={canEdit} />
    <SettlementsAndReports cms={cms} canEdit={canEdit} />
    <Disputes cms={cms} canEdit={canEdit} />
  </section>;
}
