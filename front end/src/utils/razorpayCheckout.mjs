let scriptPromise;

export const loadRazorpay = () => {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Payment checkout could not be loaded.'));
      script.onerror = () => { script.remove(); reject(new Error('Payment checkout could not be loaded.')); };
      document.head.appendChild(script);
    }).catch(error => { scriptPromise = undefined; throw error; });
  }
  return scriptPromise;
};

export const readCheckoutOrder = response => {
  const value = response?.data ?? response;
  const checkout = value?.checkoutOptions ?? value?.checkout ?? value;
  const order = value?.order ?? value?.razorpayOrder;
  const orderId = checkout?.order_id ?? checkout?.razorpayOrderId ?? checkout?.gatewayOrderId ?? order?.id;
  const key = checkout?.key ?? checkout?.keyId ?? checkout?.razorpayKeyId ?? value?.publicKey;
  // Generic `amount` can mean rupees in application DTOs. Use only explicit subunits
  // or a native Razorpay order entity; never infer the unit from its magnitude.
  const amount = checkout?.amountInPaise ?? checkout?.amountInSubunits ?? (order?.entity === 'order' ? order.amount : undefined);
  if (!/^order_/.test(String(orderId || '')) || !/^rzp_(test|live)_/.test(String(key || ''))) {
    throw new Error('The payment order response is missing its Razorpay order ID or public key. No payment was opened.');
  }
  if (amount != null && (!Number.isSafeInteger(Number(amount)) || Number(amount) < 1)) {
    throw new Error('The payment order contains an invalid amount in currency subunits.');
  }
  return {
    localOrderId: value?.localOrderId ?? checkout?.localOrderId,
    options: { key, order_id: orderId, ...(amount == null ? {} : { amount: Number(amount) }), currency: checkout?.currency ?? order?.currency ?? 'INR' },
  };
};

export const runVerifiedCheckout = async ({ response, verify, load = loadRazorpay }) => {
  const { options } = readCheckoutOrder(response);
  const Razorpay = await load();
  return new Promise((resolve, reject) => {
    let verifying = false;
    const instance = new Razorpay({
      ...options,
      retry: { enabled: false },
      handler: async result => {
        if (verifying) return;
        verifying = true;
        if (result.razorpay_order_id !== options.order_id || !result.razorpay_payment_id || !result.razorpay_signature) {
          reject(new Error('Payment verification details are incomplete. Check the saved order status before retrying.'));
          return;
        }
        try {
          // Only the backend may verify signatures, capture and allocate the payment.
          resolve(await verify({ razorpayOrderId: result.razorpay_order_id, razorpayPaymentId: result.razorpay_payment_id, razorpaySignature: result.razorpay_signature }));
        } catch (error) { reject(error); }
      },
      modal: { ondismiss: () => { if (!verifying) reject(new Error('Payment checkout was closed. Check the saved order status before retrying.')); } },
    });
    instance.on('payment.failed', () => {
      if (!verifying) { instance.close(); reject(new Error('Payment was not confirmed. Check the saved order status before retrying.')); }
    });
    instance.open();
  });
};
