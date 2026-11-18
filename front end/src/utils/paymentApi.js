import { apiUrl } from '../config/api';
import { createPaymentApiClient } from './paymentApiClient.mjs';
import { hospitalPaymentExportQuery, hospitalPaymentRecoveryRequest } from './paymentAdministration.mjs';

const getToken = (scope) => {
  const path = window.location.pathname.toLowerCase();
  const roleKeys = scope === 'superadmin'
    ? ['superAdminToken']
    : path.startsWith('/superadmin')
      ? ['superAdminToken']
    : path.startsWith('/pharmacy')
      ? ['pharmacistToken', 'pharmacyToken']
      : path.startsWith('/reception')
        ? ['receptionistToken', 'receptionToken']
        : ['adminToken'];
  for (const storage of [sessionStorage, localStorage]) {
    for (const key of [...roleKeys, 'token']) {
      const token = storage.getItem(key);
      if (token) return token;
    }
  }
  return '';
};

export const paymentApi = createPaymentApiClient({ url: apiUrl, getToken });

export const registerAdmin = (body) => paymentApi('POST auth/admin/register', { body });
export const verifyAdminRegistrationOtp = (body) => paymentApi('POST auth/admin/verify-otp', { body });
export const resendAdminRegistrationOtp = (body) => paymentApi('POST auth/admin/resend-otp', { body });
export const createHospitalPaymentOrder = (body) => paymentApi('POST hospital-payments/orders', { body });
export const fetchHospitalPaymentOrder = (localOrderId) => paymentApi('GET hospital-payments/orders/{localOrderId}', { params: { localOrderId } });
export const verifyHospitalPayment = (body) => paymentApi('POST hospital-payments/verify', { body });
export const reconcileHospitalRefund = (refundId) => paymentApi('POST hospital-payments/refunds/{refundId}/reconcile', { params: { refundId } });
export const createCmsPaymentOrder = (purchaseId) => paymentApi('POST cms/subscription-payments/create-order/{purchaseId}', { params: { purchaseId } });
export const verifyCmsPayment = (body) => paymentApi('POST cms/subscription-payments/verify', { body });
export const fetchCmsPaymentStatus = (purchaseId) => paymentApi('GET cms/subscription-payments/{purchaseId}/status', { params: { purchaseId } });
export const reconcileCmsRefund = (refundId) => paymentApi('POST cms/subscription-payments/refunds/{refundId}/reconcile', { params: { refundId } });

export const fetchAdminOnboarding = () => paymentApi('GET superadmin/admin-onboarding');
export const fetchAdminOnboardingDetails = (adminId) => paymentApi('GET superadmin/admin-onboarding/{adminId}', { params: { adminId } });
export const fetchHospitalMerchantSettings = () => paymentApi('GET hospital/payment-settings');
export const createHospitalMerchantSettings = body => paymentApi('POST hospital/payment-settings', { body });
export const saveHospitalMerchantSettings = (body) => paymentApi('PUT hospital/payment-settings', { body });
export const deleteHospitalMerchantSettings = () => paymentApi('DELETE hospital/payment-settings');
export const fetchHospitalMerchantCredentials = () => paymentApi('GET hospital/payment-settings/credentials');
export const fetchCmsMerchantSettings = () => paymentApi('GET cms-owner/payment-settings');
export const createCmsMerchantSettings = body => paymentApi('POST cms-owner/payment-settings', { body });
export const saveCmsMerchantSettings = (body) => paymentApi('PUT cms-owner/payment-settings', { body });
export const deleteCmsMerchantSettings = () => paymentApi('DELETE cms-owner/payment-settings');
export const fetchCmsMerchantCredentials = () => paymentApi('GET cms-owner/payment-settings/credentials');
export const fetchHospitalOnboarding = () => paymentApi('GET hospital/payment-onboarding');
export const submitHospitalOnboarding = () => paymentApi('POST hospital/payment-onboarding/submit');
export const fetchHospitalOnboardingReviews = () => paymentApi('GET platform/payment-onboarding/hospitals');
export const reviewHospitalOnboarding = (hospitalId, body) => paymentApi('PUT platform/payment-onboarding/hospitals/{hospitalId}', { params: { hospitalId }, body });
export const fetchCmsOnboarding = () => paymentApi('GET platform/payment-onboarding/cms-owner');
export const reviewCmsOnboarding = (body) => paymentApi('PUT platform/payment-onboarding/cms-owner', { body });

export const createHospitalRefund = (transactionId, body) => paymentApi('POST hospital-payments/transactions/{transactionId}/refunds', { params: { transactionId }, body });
export const createCmsRefund = (purchaseId, body) => paymentApi('POST cms/subscription-payments/refunds/{purchaseId}', { params: { purchaseId }, body });
export const fetchHospitalPaymentRevenue = (query = {}) => paymentApi('GET hospital-payments/reports/revenue', { query });
export const exportHospitalPaymentReport = (query = {}) => paymentApi('GET hospital-payments/reports/export', { query: hospitalPaymentExportQuery(query) });
export const fetchCmsPaymentRevenue = (query = {}) => paymentApi('GET cms/payments/reports/subscriptions', { query });
export const reconcileHospitalSettlements = (rows) => paymentApi('POST hospital-payments/settlements/reconcile', { body: { rows } });
export const reconcileCmsSettlements = (rows) => paymentApi('POST cms/payments/reports/settlements/reconcile', { body: { rows } });
export const syncHospitalSettlements = (query = {}) => paymentApi('POST hospital-payments/settlements/sync', { query });
export const fetchHospitalReconciliationSettlements = (query = {}) => paymentApi('GET hospital-settlement-reconciliation/settlements', { query });
export const fetchHospitalReconciliationSettlement = settlementRecordId => paymentApi('GET hospital-settlement-reconciliation/settlements/{settlementRecordId}', { params: { settlementRecordId } });
export const fetchHospitalSettlementPayments = settlementRecordId => paymentApi('GET hospital-settlement-reconciliation/settlements/{settlementRecordId}/payments', { params: { settlementRecordId } });
export const reconcileHospitalSettlement = settlementRecordId => paymentApi('POST hospital-settlement-reconciliation/settlements/{settlementRecordId}/reconcile', { params: { settlementRecordId } });
export const createHospitalQr = body => paymentApi('POST hospital-payments/qrs', { body });
export const fetchHospitalQr = id => paymentApi('GET hospital-payments/qrs/{id}', { params: { id } });
export const createHospitalPaymentLink = body => paymentApi('POST hospital-payments/links', { body });
export const revokeHospitalPaymentLink = id => paymentApi('POST hospital-payments/links/{id}/revoke', { params: { id } });
export const fetchPublicHospitalPayment = token => paymentApi('GET public/hospital-payments/{token}', { params: { token } });
export const fetchPublicHospitalPaymentStatus = token => paymentApi('GET public/hospital-payments/{token}/status', { params: { token } });
export const fetchHospitalReconciliationCandidates = (query = {}) => paymentApi('GET hospital-payments/reconciliation/candidates', { query });
export const runHospitalPaymentReconciliation = body => paymentApi('POST hospital-payments/reconciliation/run', { body: hospitalPaymentRecoveryRequest(body) });
export const runHospitalPaymentReconciliationBatch = payments => paymentApi('POST hospital-payments/reconciliation/batch', { body: { payments: payments.map(hospitalPaymentRecoveryRequest) } });
export const fetchHospitalReconciliationSummary = (minimumAgeMinutes) => paymentApi('GET hospital-payments/reconciliation/summary', { query: minimumAgeMinutes == null ? {} : { minimumAgeMinutes } });
export const fetchHospitalRecoverySummary = () => paymentApi('GET hospital-payments/recovery/summary');
export const fetchHospitalReconciliationHistory = (limit = 50) => paymentApi('GET hospital-payments/reconciliation/history', { query: { limit } });
export const runHospitalDiscoveredReconciliation = (options = {}) => paymentApi('POST hospital-payments/reconciliation/discovered-batch', {
  query: typeof options === 'number' ? { limit: options } : options,
});
export const syncCmsSettlements = (query = {}) => paymentApi('POST cms/payments/reports/settlements/sync', { query });
export const fetchHospitalDisputes = (query = {}) => paymentApi('GET hospital-payments/disputes', { query });
export const fetchCmsDisputes = (query = {}) => paymentApi('GET cms/payments/reports/disputes', { query });
export const uploadHospitalDisputeEvidence = (disputeId, file) => paymentApi('POST hospital-payments/disputes/{disputeId}/documents', { params: { disputeId }, file });
export const uploadCmsDisputeEvidence = (disputeId, file) => paymentApi('POST cms/payments/reports/disputes/{disputeId}/documents', { params: { disputeId }, file });
export const contestHospitalDispute = (disputeId, body) => paymentApi('POST hospital-payments/disputes/{disputeId}/contest', { params: { disputeId }, body });
export const contestCmsDispute = (disputeId, body) => paymentApi('POST cms/payments/reports/disputes/{disputeId}/contest', { params: { disputeId }, body });
export const acceptHospitalDispute = (disputeId) => paymentApi('POST hospital-payments/disputes/{disputeId}/accept', { params: { disputeId } });
export const acceptCmsDispute = (disputeId) => paymentApi('POST cms/payments/reports/disputes/{disputeId}/accept', { params: { disputeId } });
