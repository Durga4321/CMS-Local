import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import clinicBg from '../assests/clinic-bg.jpg';
import './styles/Auth.css';
import { apiUrl } from '../config/api';
import { useToast } from '../components/ToastProvider';
import { validateGmail } from '../utils/validation';

const LogoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
    <path d="M12 8v4M10 10h4" />
  </svg>
);

const FORGOT_PASSWORD_API = apiUrl('Auth/forgot-password');
const UNREGISTERED_EMAIL_MESSAGE = 'Email is not registered.';

const getResponseMessage = (data = {}) =>
  String(data?.message || data?.error || data?.title || '').trim();

const isFalseValue = (value) =>
  value === false ||
  value === 0 ||
  String(value).trim().toLowerCase() === 'false';

const getForgotPasswordError = (data = {}) => {
  const message = getResponseMessage(data);
  const normalizedMessage = message.toLowerCase();
  const isUnregistered =
    normalizedMessage.includes('not registered') ||
    normalizedMessage.includes('not registerd') ||
    normalizedMessage.includes('not found') ||
    normalizedMessage.includes('does not exist') ||
    normalizedMessage.includes('no user') ||
    normalizedMessage.includes('no account') ||
    normalizedMessage.includes('invalid email') ||
    isFalseValue(data?.isRegistered) ||
    isFalseValue(data?.registered) ||
    isFalseValue(data?.exists) ||
    isFalseValue(data?.userExists);

  if (isUnregistered) {
    return UNREGISTERED_EMAIL_MESSAGE;
  }

  if (isFalseValue(data?.success) || isFalseValue(data?.succeeded)) {
    return message || 'Failed to send OTP. Please try again.';
  }

  return '';
};

const ForgotPassword = () => {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add('auth-page-no-scroll');
    return () => {
      document.body.classList.remove('auth-page-no-scroll');
    };
  }, []);

  const handleNext = async (e) => {
    e.preventDefault();
    const emailError = validateGmail(email, 'Email ID', { strict: false });
    if (emailError) {
      setError(emailError);
      toast.error(emailError);
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(FORGOT_PASSWORD_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      const forgotPasswordError =
        getForgotPasswordError(data) ||
        (!response.ok ? getResponseMessage(data) || 'Failed to send OTP. Please try again.' : '');

      if (forgotPasswordError) {
        setError(forgotPasswordError);
        toast.error(forgotPasswordError);
        return;
      }

      sessionStorage.setItem('resetEmail', email.trim());
      toast.success('OTP sent successfully');
      navigate('/VerifyOTP', {
        state: {
          email: email.trim(),
        },
      });
    } catch {
      setError('Unable to reach server. Please try again.');
      toast.error('Unable to reach server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div
        className="auth-bg"
        style={{ backgroundImage: `url(${clinicBg})` }}
        aria-hidden="true"
      />
      <div className="auth-veil" aria-hidden="true" />

      <div className="auth-card">
        <div className="auth-logo" aria-hidden="true">
          <LogoIcon />
        </div>

        <h2>Forgot Password</h2>
        <p className="subtitle">Enter your Email ID to receive an OTP</p>

        <form className="auth-form" onSubmit={handleNext} noValidate>
          <div className="form-group">
            <label htmlFor="email">Email ID</label>
            <input
              id="email"
              type="email"
              placeholder="Enter your registered email address"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              className={error ? 'input-error' : ''}
              autoComplete="email"
            />
            {error && <span className="error-message">{error}</span>}
          </div>

          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading ? 'Sending OTP...' : 'Next ->'}
          </button>
        </form>

        <Link to="/login" className="forgot-password-link">
          ← Back to Login
        </Link>

        <div className="auth-footer">
          © {new Date().getFullYear()} CMS • Secure Admin Access
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
