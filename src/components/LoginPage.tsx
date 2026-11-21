import React, { useEffect, useState } from 'react';
import { Lock, Shield, User } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface LoginPageProps {
  mode: 'donor' | 'admin';
  onNavigate: (path: string) => void;
}

export function LoginPage({ mode, onNavigate }: LoginPageProps) {
  const { loginDonor, loginAdmin, setupAdmin } = useAuth();
  const { notify } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Admin first-run status
  const [adminStatusLoading, setAdminStatusLoading] = useState(mode === 'admin');
  const [adminNeedsSetup, setAdminNeedsSetup] = useState(false);

  useEffect(() => {
    setError('');
    setPassword('');
    setConfirmPassword('');

    if (mode !== 'admin') {
      setAdminStatusLoading(false);
      setAdminNeedsSetup(false);
      return;
    }

    let active = true;
    setAdminStatusLoading(true);
    apiRequest<{ needsSetup: boolean; envConfigured: boolean; adminEmailHint?: string }>(
      '/api/auth/admin/status'
    )
      .then((res) => {
        if (!active) return;
        setAdminNeedsSetup(res.needsSetup);
        if (res.adminEmailHint && !res.needsSetup) {
          setEmail((prev) => prev || res.adminEmailHint || '');
        }
      })
      .catch(() => {
        if (active) setAdminNeedsSetup(false);
      })
      .finally(() => {
        if (active) setAdminStatusLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'donor') {
        const donor = await loginDonor(email.trim(), password);
        notify(`Welcome back, ${donor.fullName}.`, 'success');
        onNavigate('/dashboard');
      } else if (adminNeedsSetup) {
        if (password.length < 8) {
          setError('Administrator password must be at least 8 characters long.');
          setSubmitting(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('Administrator passwords do not match.');
          setSubmitting(false);
          return;
        }
        await setupAdmin(email.trim(), password, confirmPassword);
        notify('Administrator account configured and signed in.', 'success');
        onNavigate('/admin');
      } else {
        await loginAdmin(email.trim(), password);
        notify('Signed in to Administrator Dashboard.', 'success');
        onNavigate('/admin');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-14">
      {/* Mode Switcher */}
      <div className="grid grid-cols-2 rounded-xl border border-[#E5E7EB] bg-white p-1">
        <button
          type="button"
          onClick={() => onNavigate('/login')}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
            mode === 'donor'
              ? 'bg-[#172B3A] text-white'
              : 'text-[#5B6875] hover:text-[#172B3A]'
          }`}
        >
          <User className="h-4 w-4" aria-hidden="true" />
          <span>Donor Login</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('/admin-login')}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
            mode === 'admin'
              ? 'bg-[#172B3A] text-white'
              : 'text-[#5B6875] hover:text-[#172B3A]'
          }`}
        >
          <Shield className="h-4 w-4" aria-hidden="true" />
          <span>Admin Login</span>
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-[#E5E7EB] bg-white p-6 sm:p-8">
        <div className="flex items-center gap-2.5 text-[#172B3A]">
          <Lock className="h-5 w-5 text-[#168C8C]" aria-hidden="true" />
          <h1 className="text-xl font-bold">
            {mode === 'donor'
              ? 'Donor Account Login'
              : adminNeedsSetup
                ? 'Initial Administrator Setup'
                : 'Administrator Login'}
          </h1>
        </div>

        <p className="mt-2 text-sm text-[#5B6875]">
          {mode === 'donor'
            ? 'Manage your availability, update donation dates, and respond to contact requests.'
            : adminNeedsSetup
              ? 'No administrator password has been configured yet. Create the primary administrator account below to unlock the Admin Dashboard.'
              : 'Sign in with authorized administrator credentials to manage donor records, verifications, and reports.'}
        </p>

        {adminStatusLoading ? (
          <div className="mt-6 py-8 text-center text-sm text-[#5B6875]">
            Checking administrator configuration…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-[#C94C4C]/30 bg-[#C94C4C]/5 px-3.5 py-2.5 text-sm text-[#C94C4C]"
              >
                {error}
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="block text-xs font-medium text-[#303B46] mb-1.5">
                {mode === 'admin' ? 'Administrator Email' : 'Registered Email Address'}
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={mode === 'admin' ? 'admin@bloodconnect.org' : 'you@example.com'}
                className="w-full rounded-lg border border-[#E5E7EB] px-3.5 py-2.5 text-sm text-[#172B3A]"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-medium text-[#303B46] mb-1.5">
                {adminNeedsSetup ? 'Create Admin Password (min. 8 chars)' : 'Password'}
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete={adminNeedsSetup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full rounded-lg border border-[#E5E7EB] px-3.5 py-2.5 text-sm text-[#172B3A]"
              />
            </div>

            {mode === 'admin' && adminNeedsSetup && (
              <div>
                <label
                  htmlFor="login-confirm-password"
                  className="block text-xs font-medium text-[#303B46] mb-1.5"
                >
                  Confirm Admin Password
                </label>
                <input
                  id="login-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter admin password"
                  className="w-full rounded-lg border border-[#E5E7EB] px-3.5 py-2.5 text-sm text-[#172B3A]"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[#172B3A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#233E52] transition-colors disabled:opacity-60"
            >
              {submitting
                ? 'Authenticating…'
                : mode === 'donor'
                  ? 'Sign In to Donor Dashboard'
                  : adminNeedsSetup
                    ? 'Create Admin Account & Sign In'
                    : 'Sign In to Admin Portal'}
            </button>
          </form>
        )}

        {mode === 'donor' && (
          <div className="mt-6 pt-5 border-t border-[#E5E7EB] space-y-3 text-xs text-[#5B6875]">
            <p className="flex items-center justify-between">
              <span>New to BloodConnect?</span>
              <button
                type="button"
                onClick={() => onNavigate('/register')}
                className="font-semibold text-[#C94C4C] hover:underline"
              >
                Register as a Donor
              </button>
            </p>
            <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3">
              <p className="font-medium text-[#172B3A]">Sample Demonstration Donor</p>
              <p className="mt-1">
                To inspect a pre-seeded donor dashboard with an incoming request, sign in with{' '}
                <span className="font-mono text-[#172B3A]">kavitha.demo@bloodconnect.example</span>{' '}
                / <span className="font-mono text-[#172B3A]">DonorDemo@2026</span>, or register your
                own account.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
