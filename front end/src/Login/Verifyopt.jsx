import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import clinicBg from '../assests/clinic-bg.jpg';
import './styles/Auth.css';
import { apiUrl } from '../config/api';
import { useToast } from '../components/ToastProvider';

const LogoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
    <path d="M12 8v4M10 10h4" />
  </svg>
);

const VERIFY_OTP_API = apiUrl('Auth/verify-otp');

const readJson = async (response) =>
  response.json().catch(() => ({}));

const verifyOtpRequestBodies = (email, otp) => [
  {
    email,
    otp,
  },
  {
    Email: email,
    OTP: otp,
  },
  otp,
];

const VerifyOTP = () => {
  const toast = useToast();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add('auth-page-no-scroll');
    return () => {
      document.body.classList.remove('auth-page-no-scroll');
    };
  }, []);

  const maskedEmail = useMemo(() => {
    const email = location.state?.email || sessionStorage.getItem('resetEmail') || '';
    if (!email.includes('@')) {
      return '';
    }

    const [name, domain] = email.split('@');
    if (!name) {
      return email;
    }

    if (name.length <= 2) {
      return `${name[0] || ''}*@${domain}`;
    }

    return `${name.slice(0, 2)}***@${domain}`;
  }, [location.state]);

  const handleVerify = async (e) => {
    e.preventDefault();
    const email = location.state?.email || sessionStorage.getItem('resetEmail') || '';
    const trimmedOtp = otp.trim();

    if (!otp) {
      setError('OTP is required');
      toast.error('OTP is required');
      return;
    } else if (trimmedOtp.length < 4 || !/^\d+$/.test(trimmedOtp)) {
      setError('Enter a valid numeric OTP');
      toast.error('Enter a valid numeric OTP');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      let response = null;
      let data = {};

      for (const body of verifyOtpRequestBodies(email, trimmedOtp)) {
        response = await fetch(VERIFY_OTP_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        data = await readJson(response);

        if (response.ok) {
          break;
        }
      }

      if (!response.ok) {
        setError(data.message || 'OTP verification failed. Please try again.');
        toast.error(data.message || 'OTP verification failed. Please try again.');
        return;
      }

      if (!data?.resetToken) {
        setError('OTP verified, but reset token not received. Please retry.');
        toast.error('OTP verified, but reset token not received. Please retry.');
        return;
      }

      sessionStorage.setItem('resetToken', data.resetToken);
      toast.success('OTP verified successfully');
      navigate('/ResetPassword', {
        state: {
          email,
          resetToken: data.resetToken,
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

        <h2>Verify OTP</h2>
        <p className="subtitle">
          Enter the OTP sent to your email
          {maskedEmail ? ` (${maskedEmail})` : ''}
        </p>

        <form className="auth-form" onSubmit={handleVerify} noValidate>
          <div className="form-group">
            <label htmlFor="otp">One Time Password</label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value.replace(/\D/g, ''));
                setError('');
              }}
              className={error ? 'input-error' : ''}
              maxLength={6}
              autoComplete="one-time-code"
            />
            {error && <span className="error-message">{error}</span>}
          </div>

          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>

        <Link to="/forgot-password" className="forgot-password-link">
          ← Back to Email Entry
        </Link>

        <div className="auth-footer">
          © {new Date().getFullYear()} CMS · Secure Admin Access
        </div>
      </div>
    </div>
  );
};

export default VerifyOTP;
