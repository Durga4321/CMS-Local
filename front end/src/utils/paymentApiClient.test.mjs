import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentApiClient } from './paymentApiClient.mjs';
import { PAYMENT_API_CONTRACTS } from '../config/paymentApiContracts.mjs';

const setup = (transport = async () => ({ ok: true, text: async () => '{"status":"Pending"}' })) => {
  const calls = [];
  const scopes = [];
  const client = createPaymentApiClient({
    url: path => `/api/${path}`,
    getToken: scope => { scopes.push(scope); return `${scope}-token`; },
    fetchImpl: async (...args) => { calls.push(args); return transport(...args); },
  });
  return { client, calls, scopes };
};

test('public OTP requests do not attach a stored token', async () => {
  const { client, calls, scopes } = setup();
  await client('POST auth/admin/verify-otp', { body: { email: 'admin@example.com', otp: '123456' } });
  assert.equal(calls[0][1].headers.Authorization, undefined);
  assert.deepEqual(scopes, []);
});

test('refund reconciliation uses one canonical route and never creates a refund', async () => {
  const { client, calls, scopes } = setup();
  await client('POST hospital-payments/refunds/{refundId}/reconcile', { params: { refundId: 123 } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '/api/hospital-payments/refunds/123/reconcile');
  assert.equal(calls[0][1].body, undefined);
  assert.deepEqual(scopes, ['hospital']);
  assert.ok(!PAYMENT_API_CONTRACTS['POST hospital-payments/refunds/reconcile']);
});

test('uncertain writes are never automatically retried', async () => {
  const { client, calls } = setup(async () => { throw new TypeError('Network timeout'); });
  await assert.rejects(client('POST hospital-payments/orders', { body: { billingId: 9, amount: 500, idempotencyKey: 'stable-key' } }), /Network timeout/);
  assert.equal(calls.length, 1);
});

test('missing IDs and unexpected request fields are rejected before a request', async () => {
  const { client, calls } = setup();
  await assert.rejects(client('GET hospital-payments/orders/{localOrderId}'), /localOrderId is required/);
  await assert.rejects(client('POST hospital-payments/orders', { body: { billId: 9 } }), /Unsupported request field/);
  assert.equal(calls.length, 0);
});

test('CMS refunds use SuperAdmin authentication and surface API failures', async () => {
  const { client, calls, scopes } = setup(async () => ({ ok: false, status: 409, text: async () => '{"message":"Refund requires review"}' }));
  await assert.rejects(client('POST cms/subscription-payments/refunds/{refundId}/reconcile', { params: { refundId: 2 } }), error => error.status === 409 && error.message === 'Refund requires review');
  assert.deepEqual(scopes, ['superadmin']);
  assert.equal(calls.length, 1);
});

test('document upload uses the required multipart file field', async () => {
  const { client, calls } = setup();
  await client('POST hospital-payments/disputes/{disputeId}/documents', { params: { disputeId: 4 }, file: new Blob(['pdf'], { type: 'application/pdf' }) });
  assert.ok(calls[0][1].body.get('file'));
  assert.equal(calls[0][1].headers['Content-Type'], undefined);
});

test('all documented operations build requests without duplicate routes or webhooks', async () => {
  const identities = new Set();
  for (const [operation, contract] of Object.entries(PAYMENT_API_CONTRACTS)) {
    assert.ok(!/webhook/i.test(operation));
    assert.ok(!identities.has(`${contract.method} ${contract.path}`));
    identities.add(`${contract.method} ${contract.path}`);
    const params = Object.fromEntries([...contract.path.matchAll(/\{([^}]+)\}/g)].map(match => [match[1], '1']));
    const body = contract.fields ? Object.fromEntries(contract.required.map(name => [name, 'test'])) : undefined;
    const { client, calls } = setup();
    await client(operation, { params, body, ...(contract.upload ? { file: new Blob(['pdf'], { type: 'application/pdf' }) } : {}) });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][1].method, contract.method);
  }
});
