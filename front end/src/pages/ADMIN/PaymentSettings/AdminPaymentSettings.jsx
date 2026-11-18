import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { History, Wallet } from 'lucide-react';
import { getRoleProfile } from '../../../profile/sessionProfile';
import { canUseModulePermission } from '../../../utils/rolePermissions';
import './AdminPaymentSettings.css';
import PaymentAdministration from '../../../components/payments/PaymentAdministration';

export default function AdminPaymentSettings() {
  const { method } = useParams();
  const canEdit = canUseModulePermission(getRoleProfile('admin'), 'Settings', 'Edit');
  const history = method === 'history';

  return <main className="payment-settings-page">
    <header className="payment-settings-heading">
      <div className="payment-settings-title-icon">{history ? <History size={26} /> : <Wallet size={26} />}</div>
      <div><p className="payment-settings-eyebrow">CLINIC ADMINISTRATION</p><h1>{history ? 'Payment History' : 'Payment Settings'}</h1><p>{history ? 'Load the saved payment revenue report for your clinic.' : 'Manage your saved Razorpay merchant configuration and payment operations.'}</p></div>
    </header>
    <nav className="payment-settings-tabs" aria-label="Payment settings sections">
      <Link to="/payment-settings" aria-current={!history ? 'page' : undefined}>Payment settings</Link>
      <Link to="/payment-settings/history" aria-current={history ? 'page' : undefined}>Payment history</Link>
    </nav>
    <PaymentAdministration scope="hospital" canEdit={canEdit} initialSection={history ? 'reports' : undefined} />
  </main>;
}
