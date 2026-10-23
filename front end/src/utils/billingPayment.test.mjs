import assert from 'node:assert/strict';
import {billingPaymentStatus, unwrapBillingResponse} from './billingPayment.mjs';
assert.equal(billingPaymentStatus({data:{bill:{Status:'Paid'}}}), 'Paid');
assert.equal(billingPaymentStatus({result:{billing:{paymentStatus:'Pending'}}}), 'Pending');
assert.equal(billingPaymentStatus({message:'Recorded',paymentMethod:'Cash'}), '');
assert.equal(billingPaymentStatus({bill:{status:'Pending'},payment:{status:'Paid'}}), 'Pending');
assert.equal(unwrapBillingResponse({data:{bill:{id:5}}}).id, 5);
console.log('Billing response checks passed');
