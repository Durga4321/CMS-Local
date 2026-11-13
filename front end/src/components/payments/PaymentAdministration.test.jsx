import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PaymentAdministration from './PaymentAdministration';
import AdminRegistration from './AdminRegistration';
import * as api from '../../utils/paymentApi';
import * as XLSX from 'xlsx';

jest.mock('react-router-dom', () => ({ Link: ({ to, children }) => <a href={to}>{children}</a> }), { virtual: true });
jest.mock('xlsx', () => ({ read: jest.fn(), utils: { sheet_to_json: jest.fn() } }));
jest.mock('../../utils/paymentApi', () => Object.fromEntries([
  'registerAdmin', 'verifyAdminRegistrationOtp', 'resendAdminRegistrationOtp',
  'fetchHospitalMerchantSettings', 'saveHospitalMerchantSettings', 'fetchCmsMerchantSettings', 'saveCmsMerchantSettings',
  'fetchHospitalOnboarding', 'submitHospitalOnboarding', 'fetchCmsOnboarding', 'fetchHospitalOnboardingReviews',
  'fetchAdminOnboarding', 'fetchAdminOnboardingDetails', 'reviewHospitalOnboarding', 'reviewCmsOnboarding',
  'createHospitalRefund', 'createCmsRefund', 'reconcileHospitalRefund', 'reconcileCmsRefund',
  'fetchHospitalDisputes', 'fetchCmsDisputes', 'uploadHospitalDisputeEvidence', 'uploadCmsDisputeEvidence',
  'contestHospitalDispute', 'contestCmsDispute', 'acceptHospitalDispute', 'acceptCmsDispute',
  'fetchHospitalPaymentRevenue', 'fetchCmsPaymentRevenue', 'syncHospitalSettlements', 'syncCmsSettlements',
  'reconcileHospitalSettlements', 'reconcileCmsSettlements',
].map(name => [name, jest.fn()])));

const open = name => { screen.getByText(name, { selector: 'summary' }).closest('details').open = true; };
const fill = (name, value) => fireEvent.change(screen.getByLabelText(name), { target: { value } });

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear(); sessionStorage.clear();
});

test('Admin registration verifies the entered OTP without creating a login session', async () => {
  api.registerAdmin.mockResolvedValue({ message: 'OTP sent' });
  api.verifyAdminRegistrationOtp.mockResolvedValue({ success: true });
  render(<AdminRegistration />);
  open('Clinic owner registration');
  fill('Admin name', 'Clinic Owner'); fill('Registration email', 'owner@example.com');
  fill('Mobile number', '9876543210'); fill('Registration password', 'PrivatePassword123!');
  fireEvent.click(screen.getByRole('button', { name: 'Register Admin' }));
  await screen.findByLabelText('Registration OTP');
  expect(api.registerAdmin).toHaveBeenCalledWith({ name: 'Clinic Owner', email: 'owner@example.com', mobileNumber: '9876543210', password: 'PrivatePassword123!' });
  fill('Registration OTP', '123456');
  fireEvent.click(screen.getByRole('button', { name: 'Verify registration OTP' }));
  await screen.findByRole('link', { name: 'Sign in as Admin' });
  expect(api.verifyAdminRegistrationOtp).toHaveBeenCalledWith({ email: 'owner@example.com', otp: '123456' });
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
});

test('an existing Admin can enter an email and request registration OTP again', async () => {
  api.resendAdminRegistrationOtp.mockResolvedValue({ success: true });
  render(<AdminRegistration />); open('Clinic owner registration');
  fireEvent.click(screen.getByRole('button', { name: 'Already registered? Verify email' }));
  fill('Registration email', 'existing@example.com');
  fireEvent.click(screen.getByRole('button', { name: 'Resend registration OTP' }));
  await waitFor(() => expect(api.resendAdminRegistrationOtp).toHaveBeenCalledWith({ email: 'existing@example.com' }));
  expect(api.registerAdmin).not.toHaveBeenCalled();
});

test('merchant settings omit blank secrets and never persist or display returned secrets', async () => {
  api.fetchHospitalMerchantSettings.mockResolvedValue({ merchantName: 'Hospital', mode: 'Test', isEnabled: false, keyId: 'rzp_test_public', keySecret: 'server-secret' });
  api.saveHospitalMerchantSettings.mockResolvedValue({ message: 'Saved', keySecret: 'returned-secret' });
  render(<PaymentAdministration canEdit />); open('Razorpay merchant settings');
  fireEvent.click(screen.getByRole('button', { name: 'Load merchant settings' }));
  await waitFor(() => expect(screen.getByLabelText('Merchant name')).toHaveValue('Hospital'));
  expect(screen.getByLabelText('Razorpay Key Secret')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'Save merchant settings' }));
  await waitFor(() => expect(api.saveHospitalMerchantSettings).toHaveBeenCalledWith({ merchantName: 'Hospital', mode: 'Test', isEnabled: false, keyId: 'rzp_test_public' }));
  await screen.findByText('Saved');
  expect(screen.queryByText('server-secret')).not.toBeInTheDocument();
  expect(screen.queryByText('returned-secret')).not.toBeInTheDocument();
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
});

test('an uncertain hospital refund remains locked and reconciliation uses its separate endpoint', async () => {
  api.createHospitalRefund.mockRejectedValue(new TypeError('Connection lost'));
  api.reconcileHospitalRefund.mockResolvedValue({ status: 'pending' });
  render(<PaymentAdministration canEdit />); open('Payment refunds');
  fill('Transaction ID', '42'); fill('Refund amount (₹)', '500');
  fireEvent.click(screen.getByLabelText(/I confirm a refund/));
  fireEvent.click(screen.getByRole('button', { name: 'Submit refund' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Submit refund' })).toBeDisabled();
  fill('Existing refund ID', '123');
  fireEvent.click(screen.getByRole('button', { name: 'Reconcile existing refund' }));
  await waitFor(() => expect(api.reconcileHospitalRefund).toHaveBeenCalledWith('123'));
  expect(api.createHospitalRefund).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Start another refund after reconciliation' })).toBeDisabled();
});

test('view-only access allows reads and disables merchant and refund writes', () => {
  render(<PaymentAdministration canEdit={false} />);
  open('Razorpay merchant settings'); open('Payment refunds');
  expect(screen.getByRole('button', { name: 'Load merchant settings' })).not.toBeDisabled();
  expect(screen.getByRole('button', { name: 'Save merchant settings' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Submit refund' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Reconcile existing refund' })).toBeDisabled();
});

test('CMS onboarding reviews route to the selected merchant', async () => {
  api.reviewHospitalOnboarding.mockResolvedValue({ status: 'Approved' });
  render(<PaymentAdministration scope="cms" canEdit />); open('Merchant KYC and onboarding');
  fill('Hospital ID', '12'); fill('Razorpay merchant account ID', 'acc_example');
  fireEvent.click(screen.getByLabelText('Confirm this merchant review result'));
  fireEvent.click(screen.getByRole('button', { name: 'Save onboarding review' }));
  await waitFor(() => expect(api.reviewHospitalOnboarding).toHaveBeenCalledWith('12', { status: 'Approved', providerMerchantAccountId: 'acc_example', notes: null }));
  expect(api.reviewCmsOnboarding).not.toHaveBeenCalled();
});

test('accepting a dispute requires explicit confirmation and cannot be resubmitted by reselecting its ID', async () => {
  api.acceptHospitalDispute.mockResolvedValue({ status: 'accepted' });
  render(<PaymentAdministration canEdit />); open('Payment disputes and evidence');
  fill('Dispute ID', '7');
  fireEvent.click(screen.getByLabelText(/I accept dispute/));
  fireEvent.click(screen.getByRole('button', { name: 'Accept dispute' }));
  await waitFor(() => expect(api.acceptHospitalDispute).toHaveBeenCalledWith('7'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Load disputes' })).not.toBeDisabled());
  fill('Dispute ID', '8'); fill('Dispute ID', '7');
  expect(screen.getByRole('button', { name: 'Accept dispute' })).toBeDisabled();
  expect(api.acceptHospitalDispute).toHaveBeenCalledTimes(1);
});

test('CMS refunds carry an idempotency key and preserve the returned refund ID', async () => {
  Object.defineProperty(global, 'crypto', { configurable: true, value: { randomUUID: () => 'stable-refund-key' } });
  api.createCmsRefund.mockResolvedValue({ refundId: 44, status: 'pending' });
  render(<PaymentAdministration scope="cms" canEdit />); open('Payment refunds');
  fill('Purchase ID', '13'); fill('Refund amount (₹)', '250.50');
  fireEvent.click(screen.getByLabelText(/I confirm a refund/));
  fireEvent.click(screen.getByRole('button', { name: 'Submit refund' }));
  await waitFor(() => expect(api.createCmsRefund).toHaveBeenCalledWith('13', { amount: 250.5, reason: null, idempotencyKey: 'stable-refund-key' }));
  await waitFor(() => expect(screen.getByLabelText('Existing refund ID')).toHaveValue('44'));
  expect(api.createHospitalRefund).not.toHaveBeenCalled();
});

test('hospital settlement imports use validated spreadsheet rows and prevent a second submission', async () => {
  const row = { gatewayPaymentId: 'pay_one', settlementId: 'setl_one', grossAmount: 100, feeAmount: 2, taxAmount: 0.36, settledAt: '2026-11-12T12:00:00Z' };
  XLSX.read.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
  XLSX.utils.sheet_to_json.mockReturnValue([row]);
  api.reconcileHospitalSettlements.mockResolvedValue({ reconciled: 1 });
  render(<PaymentAdministration canEdit />); open('Payment reports and settlements');
  const file = new File(['csv'], 'settlements.csv', { type: 'text/csv' });
  file.arrayBuffer = async () => new ArrayBuffer(0);
  fireEvent.change(screen.getByLabelText('Settlement rows (CSV or XLSX)'), { target: { files: [file] } });
  await screen.findByText('1 validated rows');
  fireEvent.click(screen.getByLabelText('Confirm these settlement rows for reconciliation'));
  fireEvent.click(screen.getByRole('button', { name: 'Import and reconcile settlements' }));
  await waitFor(() => expect(api.reconcileHospitalSettlements).toHaveBeenCalledWith([{ ...row, settledAt: '2026-11-12T12:00:00.000Z' }]));
  expect(screen.getByRole('button', { name: 'Import and reconcile settlements' })).toBeDisabled();
});

test('dispute uploads and contests submit the uploaded document IDs to the hospital endpoint', async () => {
  api.uploadHospitalDisputeEvidence.mockResolvedValue({ documentId: 'doc_1' });
  api.contestHospitalDispute.mockResolvedValue({ status: 'contested' });
  render(<PaymentAdministration canEdit />); open('Payment disputes and evidence');
  fill('Dispute ID', '9');
  const file = new File(['evidence'], 'evidence.pdf', { type: 'application/pdf' });
  fireEvent.change(screen.getByLabelText('Evidence document (PDF, JPG or PNG)'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: 'Upload dispute evidence' }));
  await waitFor(() => expect(screen.getByLabelText('Uploaded document IDs')).toHaveValue('doc_1'));
  fill('Evidence summary', 'Receipt and fulfilment confirmation');
  fireEvent.click(screen.getByRole('button', { name: 'Contest dispute with evidence' }));
  await waitFor(() => expect(api.contestHospitalDispute).toHaveBeenCalledWith('9', { summary: 'Receipt and fulfilment confirmation', evidenceType: null, documentIds: ['doc_1'] }));
  expect(api.uploadHospitalDisputeEvidence).toHaveBeenCalledWith('9', file);
  expect(api.contestCmsDispute).not.toHaveBeenCalled();
});
