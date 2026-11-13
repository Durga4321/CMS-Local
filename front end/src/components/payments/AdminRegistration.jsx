import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { registerAdmin, verifyAdminRegistrationOtp, resendAdminRegistrationOtp } from '../../utils/paymentApi';
import { unwrapPaymentData } from '../../utils/paymentAdministration.mjs';
import './PaymentAdministration.css';

export default function AdminRegistration() {
  const [stage, setStage] = useState('register');
  const [form, setForm] = useState({ name: '', email: '', mobileNumber: '', password: '', otp: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const change = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const perform = async action => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (failure) { setError(failure.message || 'Unable to complete the request.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const checked = response => {
    const data = unwrapPaymentData(response);
    if (data?.success === false || data?.isSuccess === false) throw new Error(data.message || 'The request was not accepted.');
    return data;
  };
  const submit = event => {
    event.preventDefault();
    perform(async () => {
      const email = form.email.trim();
      if (stage === 'register') {
        checked(await registerAdmin({ name: form.name.trim(), email, mobileNumber: form.mobileNumber.trim(), password: form.password }));
        setForm(current => ({ ...current, password: '', otp: '' }));
        setStage('otp');
        setMessage('Enter the registration OTP sent to your email.');
      } else {
        checked(await verifyAdminRegistrationOtp({ email, otp: form.otp.trim() }));
        setForm(current => ({ ...current, otp: '' }));
        setStage('verified');
        setMessage('Email verified. Sign in with your Admin account before purchasing a subscription.');
      }
    });
  };
  return <section className="payment-api-panel" aria-label="Admin registration">
    <details>
      <summary>Clinic owner registration</summary>
      <p>Create and verify an Admin account before purchasing a subscription.</p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {stage === 'verified' ? <Link to="/login" state={{ email: form.email }}>Sign in as Admin</Link> : <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <div className="payment-api-grid">
            {stage === 'register' && <label>Admin name<input name="name" value={form.name} onChange={change} minLength={2} maxLength={150} autoComplete="name" required /></label>}
            <label>Registration email<input name="email" type="email" value={form.email} onChange={change} maxLength={200} autoComplete="email" required /></label>
            {stage === 'register' ? <>
              <label>Mobile number<input name="mobileNumber" type="tel" value={form.mobileNumber} onChange={change} pattern="[6-9][0-9]{9}" maxLength={10} autoComplete="tel-national" required /></label>
              <label>Registration password<input name="password" type="password" value={form.password} onChange={change} maxLength={100} autoComplete="new-password" required /></label>
            </> : <label>Registration OTP<input name="otp" value={form.otp} onChange={change} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required /></label>}
          </div>
          <div className="payment-api-actions">
            <button type="submit">{busy ? 'Submitting...' : stage === 'register' ? 'Register Admin' : 'Verify registration OTP'}</button>
            {stage === 'register' && <button type="button" onClick={() => { setStage('otp'); setForm(current => ({ ...current, password: '' })); setError(''); setMessage('Enter your registered email and OTP, or request a new OTP.'); }}>Already registered? Verify email</button>}
            {stage === 'otp' && <>
              <button type="button" disabled={!form.email.trim()} onClick={() => perform(async () => {
                checked(await resendAdminRegistrationOtp({ email: form.email.trim() }));
                setMessage('A new registration OTP has been requested. Check your email.');
              })}>Resend registration OTP</button>
              <button type="button" onClick={() => { setStage('register'); setError(''); setMessage(''); }}>Back to registration</button>
            </>}
          </div>
        </fieldset>
      </form>}
    </details>
  </section>;
}
