import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import clinicBg from '../assests/clinic-bg.jpg';
import './styles/Auth.css';
import { apiUrl } from '../config/api';
import { recordAuditLog } from '../pages/SUPERADMIN/superAdminApi';
import { useToast } from '../components/ToastProvider';
import { validateGmail } from '../utils/validation';
import { fetchAndStoreRolePermissions } from '../utils/authorization';
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

const LOGIN_API = apiUrl('Auth/login');

const getAuthPayload = (data) => {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const nestedPayloads = [
    data.data,
    data.result,
    data.user,
    data.profile,
    data.data?.user,
    data.result?.user,
  ].filter((value) => value && typeof value === 'object' && !Array.isArray(value));

  return Object.assign({}, data, ...nestedPayloads);
};

const getAuthToken = (data) =>
  data?.token ||
  data?.accessToken ||
  data?.jwtToken ||
  data?.bearerToken ||
  data?.result?.token ||
  '';

const decodeJwtPayload = (token) => {
  try {
    const payload = token.split('.')[1];
    if (!payload || typeof atob !== 'function') {
      return null;
    }

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(normalized + padding));
  } catch {
    return null;
  }
};

const getClaim = (claims, ...keys) => {
  for (const key of keys) {
    if (claims?.[key] !== undefined && claims?.[key] !== null) {
      return claims[key];
    }
  }

  return '';
};

const getFirstText = (...values) => {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }

  return '';
};

const getDisplayName = (authData, claims, email, role) => {
  const candidates = [
    authData.name,
    authData.fullName,
    authData.displayName,
    authData.userName,
    authData.adminName,
    authData.doctorName,
    authData.receptionistName,
    getClaim(
      claims,
      'name',
      'unique_name',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
    ),
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const name = candidates.find((value) => value.toLowerCase() !== normalizedEmail);

  if (name) return name;

  const normalizedRole = normalizeRole(role);
  if (normalizedRole === 'doctor') return 'Doctor';
  if (normalizedRole === 'receptionist') return 'Receptionist';
  if (normalizedRole === 'superadmin') return 'Super Admin';
  return 'Admin';
};

const fetchPublicIp = async () => {
  const providers = [
    {
      url: 'https://api.ipify.org?format=json',
      read: (data) => getFirstText(data.ip),
    },
    {
      url: 'https://api64.ipify.org?format=json',
      read: (data) => getFirstText(data.ip),
    },
    {
      url: 'https://ipapi.co/json/',
      read: (data) => getFirstText(data.ip),
    },
    {
      url: 'https://api.my-ip.io/v2/ip.json',
      read: (data) => getFirstText(data.ip),
    },
  ];

  for (const provider of providers) {
    try {
      const response = await fetch(provider.url);
      if (!response.ok) continue;

      const data = await response.json();
      const ip = provider.read(data);
      if (ip) return ip;
    } catch {
      // Try the next provider.
    }
  }

  return '';
};

const getLoginIp = async (authData, claims) => {
  const expectedIp = getFirstText(
    authData.ipAddress,
    authData.ip,
    authData.clientIp,
    authData.IPAddress,
    authData.remoteIp,
    authData.RemoteIp,
    getClaim(claims, 'ipAddress', 'ip', 'clientIp', 'IPAddress', 'remoteIp', 'RemoteIp')
  );

  if (expectedIp) return expectedIp;

  return '';
};

const normalizeRole = (role) =>
  String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

const readJson = async (response) =>
  response.json().catch(() => ({}));

const loginRequestBodies = (email, password) => [
  {
    email,
    password,
  },
  {
    Email: email,
    Password: password,
  },
  {
    adminEmail: email,
    adminPassword: password,
  },
  {
    AdminEmail: email,
    AdminPassword: password,
  },
  {
    email,
    password,
    role: 'Doctor',
  },
  {
    Email: email,
    Password: password,
    Role: 'Doctor',
  },
  {
    doctorEmail: email,
    doctorPassword: password,
  },
  {
    DoctorEmail: email,
    DoctorPassword: password,
  },
  {
    userName: email,
    password,
  },
  {
    UserName: email,
    Password: password,
  },
];

const clearStoredSession = () => {
  [
    'token',
    'adminToken',
    'superAdminToken',
    'doctorToken',
    'receptionistToken',
    'adminRole',
    'superAdminRole',
    'doctorRole',
    'receptionistRole',
    'userRole',
    'adminEmail',
    'adminName',
    'doctorEmail',
    'receptionistEmail',
    'receptionistName',
    'doctorId',
    'doctorName',
    'hospitalId',
    'hospitalName',
    'superadmin_role_overrides',
  ].forEach((key) => localStorage.removeItem(key));
};

const AdminLogin = () => {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add('auth-page-no-scroll');
    return () => {
      document.body.classList.remove('auth-page-no-scroll');
    };
  }, []);

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
    }
    if (location.state?.email) {
      setEmail(location.state.email);
    }
  }, [location.state]);

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
    const emailError = validateGmail(email, 'Email ID', { strict: false });
    if (emailError) newErrors.email = emailError;

    if (!password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the highlighted fields.');
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const trimmedEmail = email.trim();

      let response = null;
      let data = {};

      for (const body of loginRequestBodies(trimmedEmail, password)) {
        response = await fetch(LOGIN_API, {
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
          api:
            data.message ||
            data.error ||
            'Invalid email or password. Please use the password set for this admin account.',
        });
        toast.error(
          data.message ||
            data.error ||
            'Invalid email or password. Please use the password set for this admin account.'
        );
        return;
      }

      const authData = getAuthPayload(data);
      const token = getAuthToken(authData);

      if (!token) {
        setErrors({ api: 'Login failed. Token not received from server.' });
        toast.error('Login failed. Token not received from server.');
        return;
      }

      const claims = decodeJwtPayload(token);
      const role =
        authData.role ||
        authData.roleName ||
        authData.userRole ||
        getClaim(
          claims,
          'role',
          'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'
        );
      const normalizedRole = normalizeRole(role);

      if (!['superadmin', 'admin', 'clinicadmin', 'doctor', 'receptionist'].includes(normalizedRole)) {
        setErrors({
          api: 'Access denied. This account does not have Super Admin, Admin, Doctor, or Receptionist role.',
        });
        toast.error('Access denied. This account does not have an allowed role.');
        return;
      }

      const loginEmail = getFirstText(
        authData.email,
        authData.emailAddress,
        getClaim(
          claims,
          'email',
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
        ),
        trimmedEmail
      );
      const displayName = getDisplayName(authData, claims, loginEmail, role);
      const hospitalId =
        authData.hospitalId ||
        authData.clinicId ||
        getClaim(claims, 'HospitalId', 'hospitalId') ||
        '';
      const clinicName =
        authData.hospitalName ||
        authData.clinicName ||
        authData.assignedClinic ||
        authData.clinic ||
        getClaim(claims, 'HospitalName', 'hospitalName', 'ClinicName', 'clinicName', 'AssignedClinic', 'assignedClinic') ||
        '';
      const loginIp = await getLoginIp(authData, claims);

      clearStoredSession();
      localStorage.setItem('token', token);
      localStorage.setItem('userRole', role);
      localStorage.setItem('hospitalId', String(hospitalId));
      localStorage.setItem('hospitalName', clinicName);
      localStorage.setItem('clinicName', clinicName);
      localStorage.setItem('loginIpAddress', loginIp);
      await recordAuditLog({
        userName: loginEmail,
        action: `${displayName} logged in`,
        systemAction: 'Login',
        isLoginActivity: true,
        role,
        ipAddress: loginIp,
        timestamp: new Date().toISOString(),
      });

      if (normalizedRole === 'superadmin') {
        localStorage.setItem('adminToken', token);
        localStorage.setItem('adminRole', 'superadmin');
        localStorage.setItem('adminEmail', loginEmail);
        localStorage.setItem('adminName', displayName);
        try {
          await fetchAndStoreRolePermissions('superadmin');
        } catch {}
        toast.success('Login successful');
        navigate('/superadmin/dashboard', { replace: true });
        return;
      }

      if (normalizedRole === 'doctor') {
        localStorage.setItem('doctorToken', token);
        localStorage.setItem('doctorRole', role);
        localStorage.setItem('doctorEmail', loginEmail);
        localStorage.setItem('doctorName', displayName);
        localStorage.setItem('doctorId', String(authData.doctorId || getClaim(claims, 'DoctorId') || ''));
        toast.success('Login successful');
        navigate('/doctor/dashboard', { replace: true });
        return;
      }

      if (normalizedRole === 'receptionist') {
        localStorage.setItem('receptionistToken', token);
        localStorage.setItem('receptionistRole', role);
        localStorage.setItem('receptionistEmail', loginEmail);
        localStorage.setItem('receptionistName', displayName);
        toast.success('Login successful');
        navigate('/reception/dashboard', { replace: true });
        return;
      }

      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminRole', role);
      localStorage.setItem('adminEmail', loginEmail);
      localStorage.setItem('adminName', displayName);
      toast.success('Login successful');
      try {
        await fetchAndStoreRolePermissions(role);
      } catch {}
      navigate('/dashboard', { replace: true });
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

        <h2>CMS Login</h2>
        <p className="subtitle">Welcome back to the Clinic Management System</p>
        {successMessage ? <p className="success-message">{successMessage}</p> : null}

        <form className="auth-form" onSubmit={handleLogin} noValidate>
          <div className="form-group">
            <label htmlFor="email">Email ID</label>
            <input
              id="email"
              type="email"
              placeholder="admin@gmail.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSuccessMessage('');
                clearError('email');
              }}
              className={errors.email ? 'input-error' : ''}
              autoComplete="email"
              autoFocus
            />
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setSuccessMessage('');
                  clearError('password');
                }}
                className={errors.password ? 'input-error' : ''}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>

          {errors.api ? <span className="error-message">{errors.api}</span> : null}

          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <Link to="/forgot-password" className="forgot-password-link">
          Forgot Password?
        </Link>

        <div className="auth-footer">
          © {new Date().getFullYear()} CMS · Secure Access
        </div>
      </div>
    </div>
  );
};
export default AdminLogin;




// Add-Migration AddPatientModule
// Update-Database

// use AuthDemoDb;
// select * from Staffs;
// Drop-Database AuthDemoDb;
// select * from Users;

// SELECT * FROM INFORMATION_SCHEMA.TABLES;


// select * from Doctors;
// select * from Schedules;
// select * from Appointments;



// select * from Doctors;
// SELECT * FROM Patients;
// select * from Schedules;
// select * from Appointments;

// delete Schedules where id=1;
