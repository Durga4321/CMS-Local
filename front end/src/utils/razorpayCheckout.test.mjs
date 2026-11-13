import test from 'node:test';
import assert from 'node:assert/strict';
import { readCheckoutOrder, runVerifiedCheckout } from './razorpayCheckout.mjs';

const order = { localOrderId: 'local-1', keyId: 'rzp_test_example', razorpayOrderId: 'order_example', amountInPaise: 50000, currency: 'INR' };

test('checkout uses only public gateway credentials and explicit subunits', () => {
  const parsed = readCheckoutOrder({ data: { ...order, keySecret: 'must-not-reach-sdk' } });
  assert.equal(parsed.options.amount, 50000);
  assert.equal(parsed.options.order_id, 'order_example');
  assert.equal(parsed.options.keySecret, undefined);
  assert.equal(readCheckoutOrder({ ...order, amountInPaise: undefined, amount: 500 }).options.amount, undefined);
  assert.throws(() => readCheckoutOrder({ ...order, amountInPaise: -1 }), /invalid amount/);
  assert.throws(() => readCheckoutOrder({ ...order, razorpayOrderId: '' }), /missing/);
});

test('checkout callback is not success until server verification resolves', async () => {
  let options;
  let verified = false;
  class FakeCheckout {
    constructor(value) { options = value; }
    on() {}
    open() { queueMicrotask(() => options.handler({ razorpay_order_id: 'order_example', razorpay_payment_id: 'pay_1', razorpay_signature: 'signed' })); }
  }
  const response = await runVerifiedCheckout({ response: order, load: async () => FakeCheckout, verify: async body => {
    verified = true;
    assert.deepEqual(body, { razorpayOrderId: 'order_example', razorpayPaymentId: 'pay_1', razorpaySignature: 'signed' });
    return { paymentStatus: 'Pending' };
  } });
  assert.ok(verified);
  assert.equal(response.paymentStatus, 'Pending');
  assert.equal(options.retry.enabled, false);
});

test('mismatched order callbacks never reach verification', async () => {
  let calls = 0;
  class FakeCheckout {
    constructor(options) { this.options = options; }
    on() {}
    open() { this.options.handler({ razorpay_order_id: 'order_other', razorpay_payment_id: 'pay_1', razorpay_signature: 'signed' }); }
  }
  await assert.rejects(runVerifiedCheckout({ response: order, load: async () => FakeCheckout, verify: async () => { calls++; } }), /incomplete/);
  assert.equal(calls, 0);
});

test('server verification failure propagates without retrying', async () => {
  let calls = 0;
  class FakeCheckout {
    constructor(options) { this.options = options; }
    on() {}
    open() { this.options.handler({ razorpay_order_id: 'order_example', razorpay_payment_id: 'pay_1', razorpay_signature: 'signed' }); }
  }
  await assert.rejects(runVerifiedCheckout({ response: order, load: async () => FakeCheckout, verify: async () => { calls++; throw new Error('Capture is pending'); } }), /Capture is pending/);
  assert.equal(calls, 1);
});
