import React, { createContext, useCallback, useContext, useState } from 'react';
import { apiRequest, setAuthToken } from '../lib/api';
import type { DonorPrivate, UserRole } from '../shared/types';
import type { DonorRegistrationInput } from '../shared/validation';

interface AuthContextValue {
  token: string | null;
  role: UserRole | null;
  donor: DonorPrivate | null;
  adminEmail: string | null;
  isAuthenticated: boolean;
  loginDonor: (email: string, password: string) => Promise<DonorPrivate>;
  registerDonor: (input: DonorRegistrationInput) => Promise<DonorPrivate>;
  loginAdmin: (email: string, password: string) => Promise<string>;
  setupAdmin: (email: string, password: string, confirmPassword: string) => Promise<string>;
  logout: () => Promise<void>;
  setDonorProfile: (donor: DonorPrivate) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [donor, setDonor] = useState<DonorPrivate | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  const applySession = useCallback(
    (nextToken: string | null, nextRole: UserRole | null, nextDonor: DonorPrivate | null, nextAdminEmail: string | null) => {
      setAuthToken(nextToken);
      setToken(nextToken);
      setRole(nextRole);
      setDonor(nextDonor);
      setAdminEmail(nextAdminEmail);
    },
    []
  );

  const loginDonor = useCallback(
    async (email: string, password: string) => {
      const res = await apiRequest<{ token: string; role: 'donor'; donor: DonorPrivate }>(
        '/api/auth/login',
        { method: 'POST', body: { email, password } }
      );
      applySession(res.token, 'donor', res.donor, null);
      return res.donor;
    },
    [applySession]
  );

  const registerDonor = useCallback(
    async (input: DonorRegistrationInput) => {
      const res = await apiRequest<{ token: string; role: 'donor'; donor: DonorPrivate }>(
        '/api/auth/register',
        { method: 'POST', body: input }
      );
      applySession(res.token, 'donor', res.donor, null);
      return res.donor;
    },
    [applySession]
  );

  const loginAdmin = useCallback(
    async (email: string, password: string) => {
      const res = await apiRequest<{ token: string; role: 'admin'; adminEmail: string }>(
        '/api/auth/admin/login',
        { method: 'POST', body: { email, password } }
      );
      applySession(res.token, 'admin', null, res.adminEmail);
      return res.adminEmail;
    },
    [applySession]
  );

  const setupAdmin = useCallback(
    async (email: string, password: string, confirmPassword: string) => {
      const res = await apiRequest<{ token: string; role: 'admin'; adminEmail: string }>(
        '/api/auth/admin/setup',
        { method: 'POST', body: { email, password, confirmPassword } }
      );
      applySession(res.token, 'admin', null, res.adminEmail);
      return res.adminEmail;
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    try {
      if (token) {
        await apiRequest('/api/auth/logout', { method: 'POST', token });
      }
    } catch {
      // Clear local session even if server already expired token
    } finally {
      applySession(null, null, null, null);
    }
  }, [token, applySession]);

  const setDonorProfile = useCallback((updated: DonorPrivate) => {
    setDonor(updated);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!token || role !== 'donor') return;
    const res = await apiRequest<{ donor: DonorPrivate }>('/api/donor/profile', { token });
    setDonor(res.donor);
  }, [token, role]);

  return (
    <AuthContext.Provider
      value={{
        token,
        role,
        donor,
        adminEmail,
        isAuthenticated: Boolean(token && role),
        loginDonor,
        registerDonor,
        loginAdmin,
        setupAdmin,
        logout,
        setDonorProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
