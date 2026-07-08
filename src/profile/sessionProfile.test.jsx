import { logoutAndClearSessions } from './sessionProfile';
import { recordAuditLog } from '../pages/SUPERADMIN/superAdminApi';

jest.mock('../pages/SUPERADMIN/superAdminApi', () => ({
  recordAuditLog: jest.fn(),
}));

describe('logoutAndClearSessions', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('records a logout and clears auth storage', async () => {
    localStorage.setItem('adminEmail', 'admin@example.com');
    localStorage.setItem('adminName', 'Admin User');
    localStorage.setItem('adminRole', 'Admin');
    localStorage.setItem('adminToken', 'token');
    localStorage.setItem('loginIpAddress', '127.0.0.1');

    await logoutAndClearSessions('admin');

    expect(recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      userName: 'Admin User',
      action: 'Admin User logged out',
      systemAction: 'Logout',
      role: 'Admin',
      ipAddress: '127.0.0.1',
    }));

    expect(localStorage.getItem('adminToken')).toBeNull();
    expect(localStorage.getItem('adminEmail')).toBeNull();
    expect(localStorage.getItem('adminName')).toBeNull();
  });

  it('fetches and persists a public IP when loginIpAddress is missing', async () => {
    // simulate no loginIpAddress in storage
    localStorage.setItem('adminEmail', 'admin2@example.com');
    localStorage.setItem('adminName', 'Admin Two');
    localStorage.setItem('adminRole', 'Admin');
    localStorage.setItem('adminToken', 'token');

    // Mock fetch to return a public IP
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ ip: '203.0.113.5' }) });

    await logoutAndClearSessions('admin');

    expect(recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      userName: 'Admin Two',
      ipAddress: '203.0.113.5',
    }));

    // ensure persisted
    expect(localStorage.getItem('loginIpAddress')).toBe('203.0.113.5');

    // cleanup
    global.fetch.mockRestore?.();
  });
});
