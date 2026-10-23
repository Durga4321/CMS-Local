// Billing status comes from the invoice, never from the selected payment method.
export const unwrapBillingResponse = (response) => {
  let value = response;
  for (let depth = 0; depth < 8 && value && typeof value === "object"; depth += 1) {
    const nested = value.bill ?? value.Bill ?? value.billing ?? value.Billing ?? value.data ?? value.result;
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) break;
    value = nested;
  }
  return value && typeof value === "object" ? value : {};
};

export const billingPaymentStatus = (response) => {
  const bill = unwrapBillingResponse(response);
  const status = [bill.paymentStatus, bill.PaymentStatus, bill.billingStatus, bill.BillingStatus, bill.status, bill.Status]
    .find((value) => typeof value === "string" && value.trim());
  return status ? status.trim() : "";
};
