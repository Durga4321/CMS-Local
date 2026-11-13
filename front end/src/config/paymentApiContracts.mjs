// Request contracts checked against the supplied backend Swagger. Webhooks are server-only.
export const PAYMENT_API_CONTRACTS = {
  "POST auth/admin/register": {
    "method": "POST",
    "path": "auth/admin/register",
    "auth": "public",
    "query": [],
    "fields": [
      "name",
      "email",
      "mobileNumber",
      "password"
    ],
    "required": [
      "email",
      "mobileNumber",
      "name",
      "password"
    ]
  },
  "POST auth/admin/verify-otp": {
    "method": "POST",
    "path": "auth/admin/verify-otp",
    "auth": "public",
    "query": [],
    "fields": [
      "email",
      "otp"
    ],
    "required": [
      "email",
      "otp"
    ]
  },
  "POST auth/admin/resend-otp": {
    "method": "POST",
    "path": "auth/admin/resend-otp",
    "auth": "public",
    "query": [],
    "fields": [
      "email"
    ],
    "required": [
      "email"
    ]
  },
  "GET cms-owner/payment-settings": {
    "method": "GET",
    "path": "cms-owner/payment-settings",
    "auth": "superadmin",
    "query": []
  },
  "PUT cms-owner/payment-settings": {
    "method": "PUT",
    "path": "cms-owner/payment-settings",
    "auth": "superadmin",
    "query": [],
    "fields": [
      "merchantName",
      "mode",
      "isEnabled",
      "credentialReference",
      "keyId",
      "keySecret",
      "webhookSecret"
    ],
    "required": [
      "merchantName",
      "mode"
    ]
  },
  "GET cms/payments/reports/subscriptions": {
    "method": "GET",
    "path": "cms/payments/reports/subscriptions",
    "auth": "superadmin",
    "query": [
      "from",
      "to",
      "mode"
    ]
  },
  "POST cms/payments/reports/settlements/reconcile": {
    "method": "POST",
    "path": "cms/payments/reports/settlements/reconcile",
    "auth": "superadmin",
    "query": [],
    "fields": [
      "rows"
    ],
    "required": []
  },
  "POST cms/payments/reports/settlements/sync": {
    "method": "POST",
    "path": "cms/payments/reports/settlements/sync",
    "auth": "superadmin",
    "query": [
      "mode",
      "from",
      "to"
    ]
  },
  "POST cms/payments/reports/disputes/{disputeId}/documents": {
    "method": "POST",
    "path": "cms/payments/reports/disputes/{disputeId}/documents",
    "auth": "superadmin",
    "query": [],
    "upload": true
  },
  "POST cms/payments/reports/disputes/{disputeId}/contest": {
    "method": "POST",
    "path": "cms/payments/reports/disputes/{disputeId}/contest",
    "auth": "superadmin",
    "query": [],
    "fields": [
      "amount",
      "summary",
      "evidenceType",
      "documentIds"
    ],
    "required": []
  },
  "POST cms/payments/reports/disputes/{disputeId}/accept": {
    "method": "POST",
    "path": "cms/payments/reports/disputes/{disputeId}/accept",
    "auth": "superadmin",
    "query": []
  },
  "GET cms/payments/reports/disputes": {
    "method": "GET",
    "path": "cms/payments/reports/disputes",
    "auth": "superadmin",
    "query": [
      "mode",
      "status"
    ]
  },
  "POST cms/subscription-payments/create-order/{purchaseId}": {
    "method": "POST",
    "path": "cms/subscription-payments/create-order/{purchaseId}",
    "auth": "hospital",
    "query": []
  },
  "POST cms/subscription-payments/verify": {
    "method": "POST",
    "path": "cms/subscription-payments/verify",
    "auth": "hospital",
    "query": [],
    "fields": [
      "purchaseId",
      "razorpayOrderId",
      "razorpayPaymentId",
      "razorpaySignature"
    ],
    "required": []
  },
  "GET cms/subscription-payments/{purchaseId}/status": {
    "method": "GET",
    "path": "cms/subscription-payments/{purchaseId}/status",
    "auth": "hospital",
    "query": []
  },
  "POST cms/subscription-payments/refunds/{purchaseId}": {
    "method": "POST",
    "path": "cms/subscription-payments/refunds/{purchaseId}",
    "auth": "superadmin",
    "query": [],
    "fields": [
      "amount",
      "reason",
      "idempotencyKey"
    ],
    "required": []
  },
  "POST cms/subscription-payments/refunds/{refundId}/reconcile": {
    "method": "POST",
    "path": "cms/subscription-payments/refunds/{refundId}/reconcile",
    "auth": "superadmin",
    "query": []
  },
  "GET hospital/payment-onboarding": {
    "method": "GET",
    "path": "hospital/payment-onboarding",
    "auth": "hospital",
    "query": []
  },
  "POST hospital/payment-onboarding/submit": {
    "method": "POST",
    "path": "hospital/payment-onboarding/submit",
    "auth": "hospital",
    "query": []
  },
  "POST hospital-payments/orders": {
    "method": "POST",
    "path": "hospital-payments/orders",
    "auth": "hospital",
    "query": [],
    "fields": [
      "billingId",
      "amount",
      "idempotencyKey"
    ],
    "required": []
  },
  "GET hospital-payments/orders/{localOrderId}": {
    "method": "GET",
    "path": "hospital-payments/orders/{localOrderId}",
    "auth": "hospital",
    "query": []
  },
  "POST hospital-payments/verify": {
    "method": "POST",
    "path": "hospital-payments/verify",
    "auth": "hospital",
    "query": [],
    "fields": [
      "localOrderId",
      "razorpayOrderId",
      "razorpayPaymentId",
      "razorpaySignature"
    ],
    "required": []
  },
  "POST hospital-payments/transactions/{transactionId}/refunds": {
    "method": "POST",
    "path": "hospital-payments/transactions/{transactionId}/refunds",
    "auth": "hospital",
    "query": [],
    "fields": [
      "amount",
      "reason"
    ],
    "required": []
  },
  "POST hospital-payments/refunds/{refundId}/reconcile": {
    "method": "POST",
    "path": "hospital-payments/refunds/{refundId}/reconcile",
    "auth": "hospital",
    "query": [
      "refundId"
    ]
  },
  "POST hospital-payments/disputes/{disputeId}/documents": {
    "method": "POST",
    "path": "hospital-payments/disputes/{disputeId}/documents",
    "auth": "hospital",
    "query": [],
    "upload": true
  },
  "POST hospital-payments/disputes/{disputeId}/contest": {
    "method": "POST",
    "path": "hospital-payments/disputes/{disputeId}/contest",
    "auth": "hospital",
    "query": [],
    "fields": [
      "amount",
      "summary",
      "evidenceType",
      "documentIds"
    ],
    "required": []
  },
  "POST hospital-payments/disputes/{disputeId}/accept": {
    "method": "POST",
    "path": "hospital-payments/disputes/{disputeId}/accept",
    "auth": "hospital",
    "query": []
  },
  "GET hospital-payments/disputes": {
    "method": "GET",
    "path": "hospital-payments/disputes",
    "auth": "hospital",
    "query": [
      "status"
    ]
  },
  "POST hospital-payments/settlements/sync": {
    "method": "POST",
    "path": "hospital-payments/settlements/sync",
    "auth": "hospital",
    "query": [
      "from",
      "to"
    ]
  },
  "POST hospital-payments/settlements/reconcile": {
    "method": "POST",
    "path": "hospital-payments/settlements/reconcile",
    "auth": "hospital",
    "query": [],
    "fields": [
      "rows"
    ],
    "required": []
  },
  "GET hospital-payments/reports/revenue": {
    "method": "GET",
    "path": "hospital-payments/reports/revenue",
    "auth": "hospital",
    "query": [
      "from",
      "to",
      "mode"
    ]
  },
  "GET hospital/payment-settings": {
    "method": "GET",
    "path": "hospital/payment-settings",
    "auth": "hospital",
    "query": []
  },
  "PUT hospital/payment-settings": {
    "method": "PUT",
    "path": "hospital/payment-settings",
    "auth": "hospital",
    "query": [],
    "fields": [
      "merchantName",
      "mode",
      "isEnabled",
      "credentialReference",
      "keyId",
      "keySecret",
      "webhookSecret"
    ],
    "required": [
      "merchantName",
      "mode"
    ]
  },
  "GET platform/payment-onboarding/hospitals": {
    "method": "GET",
    "path": "platform/payment-onboarding/hospitals",
    "auth": "superadmin",
    "query": []
  },
  "PUT platform/payment-onboarding/hospitals/{hospitalId}": {
    "method": "PUT",
    "path": "platform/payment-onboarding/hospitals/{hospitalId}",
    "auth": "superadmin",
    "query": [],
    "fields": [
      "status",
      "providerMerchantAccountId",
      "notes"
    ],
    "required": []
  },
  "GET platform/payment-onboarding/cms-owner": {
    "method": "GET",
    "path": "platform/payment-onboarding/cms-owner",
    "auth": "superadmin",
    "query": []
  },
  "PUT platform/payment-onboarding/cms-owner": {
    "method": "PUT",
    "path": "platform/payment-onboarding/cms-owner",
    "auth": "superadmin",
    "query": [],
    "fields": [
      "status",
      "providerMerchantAccountId",
      "notes"
    ],
    "required": []
  },
  "GET superadmin/admin-onboarding": {
    "method": "GET",
    "path": "superadmin/admin-onboarding",
    "auth": "superadmin",
    "query": []
  },
  "GET superadmin/admin-onboarding/{adminId}": {
    "method": "GET",
    "path": "superadmin/admin-onboarding/{adminId}",
    "auth": "superadmin",
    "query": []
  }
};
