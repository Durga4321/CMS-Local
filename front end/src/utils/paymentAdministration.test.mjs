import test from 'node:test';
import assert from 'node:assert/strict';
import { merchantSettingsBody, paymentAmount, paymentDateQuery, positiveRecordId, publicPaymentData, validateSettlementRows } from './paymentAdministration.mjs';

test('financial input rejects invalid amounts and preserves int64 record IDs', () => {
  for (const value of ['-1', '0', '1.001', '1e5', '', 'NaN']) assert.throws(() => paymentAmount(value));
  assert.equal(paymentAmount('500.25'), 500.25);
  assert.equal(positiveRecordId('9223372036854775807'), '9223372036854775807');
  assert.throws(() => positiveRecordId('1/verify'));
});

test('merchant updates omit blank secrets and keep disabled merchants disabled', () => {
  assert.deepEqual(merchantSettingsBody({ merchantName: ' Clinic ', mode: 'Test', isEnabled: false, keySecret: '', webhookSecret: '' }), { merchantName: 'Clinic', mode: 'Test', isEnabled: false });
  assert.throws(() => merchantSettingsBody({ merchantName: 'Clinic', mode: 'All' }));
});

test('settlement rows require correct financial fields and CMS purchase information', () => {
  const row = { gatewayPaymentId: 'pay_1', settlementId: 'setl_1', grossAmount: '100.00', feeAmount: '2.00', taxAmount: '0.36', settledAt: '2026-11-12T12:00:00Z' };
  assert.equal(validateSettlementRows([row], false)[0].grossAmount, 100);
  assert.throws(() => validateSettlementRows([{ ...row, feeAmount: '120' }], false), /exceed/);
  assert.throws(() => validateSettlementRows([row], true), /Purchase ID/);
  assert.equal(validateSettlementRows([{ ...row, purchaseId: '12', mode: 'Test' }], true)[0].purchaseId, 12);
  assert.doesNotThrow(() => validateSettlementRows([{ ...row, grossAmount: '0.30', feeAmount: '0.10', taxAmount: '0.20' }], false));
});

test('payment result rendering data excludes nested secrets and tokens', () => {
  assert.deepEqual(publicPaymentData({ keyId: 'public', keySecret: 'private', rows: [{ status: 'pending', accessToken: 'private', razorpaySignature: 'private' }] }), { keyId: 'public', rows: [{ status: 'pending' }] });
});

test('report queries reject reversed dates and omit unsupported sync modes', () => {
  assert.throws(() => paymentDateQuery({ from: '2026-11-13', to: '2026-11-12' }));
  assert.equal(paymentDateQuery({ mode: 'Live' }, false).mode, undefined);
  assert.match(paymentDateQuery({ from: '2026-11-12', to: '2026-11-12' }).to, /Z$/);
});
