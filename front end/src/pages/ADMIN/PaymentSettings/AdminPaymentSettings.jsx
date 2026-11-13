import React, { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Banknote, Building2, CreditCard, Plus, Smartphone, Upload, Wallet } from 'lucide-react';
import { getRoleProfile } from '../../../profile/sessionProfile';
import { canUseModulePermission } from '../../../utils/rolePermissions';
import './AdminPaymentSettings.css';
import AdminPaymentHistory from './AdminPaymentHistory';
import PaymentAdministration from '../../../components/payments/PaymentAdministration';

const options = [
  { id: 'upi', title: 'UPI', description: 'Add a UPI ID and a clinic payment QR code.', Icon: Smartphone },
  { id: 'card', title: 'Card', description: 'Enter card terminal and merchant details.', Icon: CreditCard },
  { id: 'netbanking', title: 'Net banking', description: 'Add the clinic bank account and IFSC details.', Icon: Building2 },
  { id: 'cash', title: 'Cash', description: 'Set up payments collected at the clinic counter.', Icon: Banknote },
];
const fields = {
  upi: [['payee', 'Payee name', 'Clinic or business name'], ['upi', 'UPI ID', 'clinic@bank']],
  card: [['provider', 'Card terminal provider', 'Enter provider name'], ['merchant', 'Merchant ID', 'Enter merchant ID'], ['terminal', 'Terminal ID', 'Enter terminal ID']],
  netbanking: [['bank', 'Bank name', 'Enter bank name'], ['holder', 'Account holder name', 'Name registered with the bank'], ['account', 'Account number', 'Enter account number'], ['ifsc', 'IFSC code', 'e.g. SBIN0001234'], ['branch', 'Bank branch', 'Enter branch name']],
  cash: [['counter', 'Counter name', 'Main reception counter'], ['receipt', 'Receipt label', 'Cash payment']],
};

export default function AdminPaymentSettings() {
  const { method } = useParams();
  const selected = options.find(option => option.id === method);
  const [notice, setNotice] = useState('');
  const [uploadName, setUploadName] = useState('');
  const canEdit = canUseModulePermission(getRoleProfile('admin'), 'Settings', 'Edit');
  const reset = () => { setNotice(''); setUploadName(''); };
  if (method === 'history') return <AdminPaymentHistory />;
  if (method && !selected) return <Navigate to="/payment-settings" replace />;
  const Icon = selected?.Icon || Wallet;

  return <main className="payment-settings-page">
    <header className="payment-settings-heading">
      <div className="payment-settings-title-icon"><Wallet size={26} /></div>
      <div><p className="payment-settings-eyebrow">CLINIC ADMINISTRATION</p><h1>{selected ? `${selected.title} Payment Settings` : 'Payment Settings'}</h1><p>{selected ? 'Add your clinic payment details.' : 'Choose a payment option to add or update its details.'}</p></div>
      <span className="payment-settings-badge">Screen preview</span>
    </header>
    <nav className="payment-settings-tabs" aria-label="Payment settings sections"><Link to="/payment-settings" aria-current="page">Payment options</Link><Link to="/payment-settings/history">Payment history</Link></nav>
    <div className="payment-settings-info" role="note">UI preview only. Details and uploads are not saved or applied to billing.</div>
    {!selected ? <section className="payment-settings-card">
      <div className="payment-settings-section-heading"><h2>Payment options</h2><span>4 available options</span></div>
      <p>Select an option to open its setup screen.</p>
      <div className="payment-settings-methods">
        {options.map(({ id, title, description, Icon: MethodIcon }) => <Link key={id} to={`/payment-settings/${id}`} className="payment-settings-method payment-settings-option-link" onClick={reset}>
          <MethodIcon size={24} /><ArrowRight size={17} /><strong>{title}</strong><span>{description}</span><span className="payment-settings-add-label"><Plus size={14} /> Add details</span>
        </Link>)}
      </div>
    </section> : <>
      <Link className="payment-settings-back" to="/payment-settings" onClick={reset}><ArrowLeft size={16} /> All payment options</Link>
      {notice && <p className="payment-settings-success" role="status">{notice}</p>}
      <form key={method} onSubmit={event => { event.preventDefault(); setNotice('Preview complete. These details have not been saved or applied to billing.'); }}>
        <fieldset className="payment-settings-fieldset" disabled={!canEdit}>
          <section className="payment-settings-card">
            <h2><Icon size={21} /> {selected.title} details</h2><p>{selected.description}</p>
            <div className="payment-settings-grid">
              {fields[method].map(([id, label, placeholder]) => <label key={id} className="payment-settings-field" htmlFor={`payment-${id}`}><span>{label}</span><input id={`payment-${id}`} name={id} placeholder={placeholder} autoComplete="off" /></label>)}
              <label className="payment-settings-field" htmlFor="payment-status"><span>Status</span><select id="payment-status" name="status"><option>Enabled</option><option>Disabled</option></select></label>
              <label className="payment-settings-field" htmlFor="payment-notes"><span>Notes (optional)</span><input id="payment-notes" placeholder="Add payment instructions" /></label>
            </div>
          </section>
          <section className="payment-settings-card">
            <h2><Upload size={20} /> {method === 'upi' ? 'Upload QR code' : 'Upload supporting details'}</h2>
            <p>{method === 'upi' ? 'Choose a PNG or JPEG QR image (up to 2 MB).' : 'Choose an image or PDF with your payment details (up to 2 MB).'}</p>
            <label className="payment-settings-field" htmlFor="payment-upload"><span>Select a file</span><input id="payment-upload" type="file" accept={method === 'upi' ? 'image/png,image/jpeg' : 'image/png,image/jpeg,application/pdf'} onChange={event => {
              const file = event.target.files?.[0];
              if (!file) { setUploadName(''); return; }
              const types = method === 'upi' ? ['image/png', 'image/jpeg'] : ['image/png', 'image/jpeg', 'application/pdf'];
              if (file.size > 2 * 1024 * 1024 || !types.includes(file.type)) { event.target.value = ''; setUploadName(''); setNotice('Choose a supported file under 2 MB.'); return; }
              setNotice(''); setUploadName(file.name);
            }} /></label>
            {uploadName && <p role="status">Selected: {uploadName} (preview only)</p>}
          </section>
          <footer className="payment-settings-actions"><span>{canEdit ? 'Preview changes without saving.' : 'You have view-only access.'}</span><Link to="/payment-settings" className="payment-settings-back" onClick={reset}>Cancel</Link><button type="submit" className="payment-settings-primary">Preview settings</button></footer>
        </fieldset>
      </form>
    </>}
    {!method && <PaymentAdministration scope="hospital" canEdit={canEdit} />}
  </main>;
}
