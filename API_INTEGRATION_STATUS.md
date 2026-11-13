# Payment API integration status

Source: backend `/swagger/v1/swagger.json` retrieved from the supplied ngrok address on 2026-11-12.

## Implemented

- `paymentApiContracts.mjs` contains 39 distinct frontend operations verified against Swagger methods, paths, JSON field names, required fields and query parameters.
- `paymentApiClient.mjs` handles authenticated JSON requests, public registration/OTP requests, multipart evidence uploads, API errors and cancellation. Writes are never automatically retried.
- `paymentApi.js` provides named helpers for all 39 documented frontend operations. Each helper has a consumer in the new controls or existing checkout/billing integration.
- Existing subscription checkout now includes authentication instead of explicitly suppressing it. Backend verification remains authoritative.
- Existing CMS subscription payment initiation now uses server order creation, Razorpay Checkout and backend signature verification. Status reads use the CMS purchase-status endpoint.
- Existing reception online billing now uses hospital order creation and backend verification; Cash retains its PATCH path. Repeated clicks share one in-flight attempt, and uncertain order creation retains its idempotency key within the page session.
- Existing billing confirmation accepts the backend's PartiallyPaid status instead of requiring every payment to clear the full invoice.
- Generic `success: true` is no longer treated as proof of a paid subscription.
- Every one of the 39 operations now has a named service helper.
- New controls are mounted additively within existing pages. Existing icons, labels, routes, preview forms, and unrelated API handlers were retained.

## New controls and locations

| Existing page | Added controls |
| --- | --- |
| Staff login (`/login`) and subscription checkout | Admin registration, registration OTP verification, resend OTP, and a sign-in link using the existing login route. Registration never creates a browser login session automatically. |
| Admin Payment Settings (`/payment-settings`) | Hospital merchant GET/PUT, KYC status/submission, hospital refunds/reconciliation, revenue reports, settlement payout sync/import, dispute listing, evidence upload, contest and acceptance. Existing payment-option preview forms remain separate and unchanged. |
| SuperAdmin Settings, Payment Settings tab | CMS merchant GET/PUT, CMS KYC status/review, hospital KYC listings/reviews, Admin onboarding list/detail/purchase history, subscription refunds/reconciliation, subscription revenue reports, CMS settlement payout sync/import, subscription disputes/evidence/contest/acceptance. The legacy settings form remains unchanged. |

Forms use the documented request fields. Merchant secrets are not cached in localStorage or sessionStorage, are cleared after a save attempt, and are redacted from server result tables. Blank secret fields are omitted from updates. Financial writes require explicit user actions; refunds and disputes prevent repeat submission within the mounted panel after an uncertain outcome. Settlement import accepts validated CSV/XLSX rows, with a downloadable header template. The new hospital controls respect the existing Settings edit permission, and backend authorization remains authoritative.

## Duplicate and server-only operations

- Hospital refund reconciliation has two URLs for the same operation. The client uses only `POST hospital-payments/refunds/{refundId}/reconcile`.
- Refund creation and refund reconciliation are separate operations. Reconciliation must not create another refund following an uncertain gateway outcome.
- CMS subscription refunds are separate from hospital refunds and use SuperAdmin authentication.
- GET and PUT merchant-settings operations share paths intentionally; they are not duplicates.
- Webhooks are gateway-to-backend callbacks and are deliberately excluded from the browser client.
- Swagger incorrectly declares a required path `refundId` on the query-only reconciliation alias. The canonical route avoids that inconsistency.

## External prerequisites and limits

The user authorized the additional fields and actions inside existing pages; those controls are now implemented and connected. This confirms frontend wiring, not successful production execution of every financial workflow.

The existing patient appointment checkout still uses legacy payment endpoints, with UPI selected by default. The supplied hospital order endpoints authorize staff, not Patients. A patient-authorized order/verification contract is needed before replacing that path; do not use a staff token or bypass role restrictions.

The backend recovered on the latest read-only check: Swagger and the public payment-method endpoint returned HTTP 200. All 39 saved operations and request field lists still match the current Swagger. All 39 operations still omit successful response schemas.

The current public payment-method response reports `gatewayConfigured: false`, `mode: null`, and UPI, Card and NetBanking all disabled. Merchant configuration is required before online payments can run. No test payment or production mutation has been attempted.

Swagger documents the relevant successes only as `200 OK`, without response schemas. Actual authenticated gateway response shapes and financial outcomes have not been confirmed. Redacted examples remain useful for compatibility verification of:

- hospital and CMS order creation (local order ID, gateway order ID, public key ID, amount and units, currency, mode);
- hospital and CMS verification/status (captured, pending and failed cases);
- registration/OTP (verification result and whether login tokens are returned);
- merchant settings and onboarding (secret presence flags, saved mode and review state).

Do not replace the existing payment flow with guessed fields, treat a generic successful HTTP response as a captured payment, store gateway secrets in browser storage, or submit live financial operations merely to test wiring.

## Validation

- All 39 contract methods, paths and JSON fields compared against the downloaded Swagger.
- Seventeen request, billing, checkout, financial-input, settlement-row and secret-redaction checks passed.
- Ten React form tests passed, covering registration/OTP, resend, merchant request mapping, secret handling, permissions, onboarding review routing, uncertain refund/reconciliation behavior, CMS refund idempotency keys, settlement import, dispute upload/contest and duplicate-action prevention.
- Static coverage check confirmed screen or checkout consumers for all 39 API helpers.
- Production Vite build passed.
- No real payment, refund, dispute, KYC or merchant-settings mutation was submitted.
