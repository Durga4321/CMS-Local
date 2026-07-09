import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import clinicBg from '../assests/clinic-bg.jpg';
import './styles/Auth.css';
import { apiUrl } from '../config/api';
import { useToast } from '../components/ToastProvider';
import { validateStrongPassword } from '../utils/validation';

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </svg>
);

const LogoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
    <path d="M12 8v4M10 10h4" />
  </svg>
);

const RESET_PASSWORD_API = apiUrl('Auth/reset-password');

const readJson = async (response) =>
  response.json().catch(() => ({}));

const resetPasswordRequestBodies = (email, token, password, confirmPassword) => [
  {
    email,
    token,
    newPassword: password,
    confirmPassword,
  },
  {
    Email: email,
    Token: token,
    NewPassword: password,
    ConfirmPassword: confirmPassword,
  },
  {
    token,
    newPassword: password,
  },
];

const ResetPassword = () => {
  const toast = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const resetEmail = location.state?.email || sessionStorage.getItem('resetEmail') || '';
  const resetToken = location.state?.resetToken || sessionStorage.getItem('resetToken') || '';

  useEffect(() => {
    document.body.classList.add('auth-page-no-scroll');
    return () => {
      document.body.classList.remove('auth-page-no-scroll');
    };
  }, []);

  const clearError = (field) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      delete next.api;
      return next;
    });
  };

  const validate = () => {
    const newErrors = {};
    const passwordError = validateStrongPassword(newPassword, 'New Password');
    if (passwordError) newErrors.newPassword = passwordError;

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirm Password is required';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!resetToken) {
      newErrors.api = 'Reset token missing. Please verify OTP again.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the highlighted fields.');
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      let response = null;
      let data = {};

      for (const body of resetPasswordRequestBodies(
        resetEmail,
        resetToken,
        newPassword,
        confirmPassword
      )) {
        response = await fetch(RESET_PASSWORD_API, {
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
        setErrors({
          api: data.message || 'Unable to reset password. Please try again.',
        });
        toast.error(data.message || 'Unable to reset password. Please try again.');
        return;
      }

      sessionStorage.removeItem('resetToken');
      sessionStorage.removeItem('resetEmail');

      toast.success(data.message || 'Password reset successful. Please login.');
      navigate('/login', {
        replace: true,
        state: {
          email: resetEmail,
          message: data.message || 'Password reset successful. Please login.',
        },
      });
    } catch {
      setErrors({
        api: 'Unable to reach server. Please try again.',
      });
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

        <h2>Reset Password</h2>
        <p className="subtitle">Enter your new password below</p>

        <form className="auth-form" onSubmit={handleReset} noValidate>
          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <div className="password-wrapper">
              <input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  clearError('newPassword');
                }}
                className={errors.newPassword ? 'input-error' : ''}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowNewPassword(!showNewPassword)}
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                {showNewPassword ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            </div>
            {errors.newPassword && <span className="error-message">{errors.newPassword}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="password-wrapper">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  clearError('confirmPassword');
                }}
                className={errors.confirmPassword ? 'input-error' : ''}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            </div>
            {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
          </div>

          {errors.api ? <span className="error-message">{errors.api}</span> : null}

          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <Link to="/login" className="forgot-password-link">
          ← Back to Login
        </Link>

        <div className="auth-footer">
          © {new Date().getFullYear()} CMS · Secure Admin Access
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
