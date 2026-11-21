import React, { useState } from 'react';
import { Droplet, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

const NAV_LINKS = [
  { label: 'Home', path: '/' },
  { label: 'Find Donors', path: '/find-donors' },
  { label: 'Become a Donor', path: '/register' },
  { label: 'About Us', path: '/about' },
  { label: 'Contact', path: '/contact' },
];

export function Navbar({ currentPath, onNavigate }: NavbarProps) {
  const { isAuthenticated, role, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLinkClick = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    setMobileOpen(false);
    onNavigate(path);
  };

  const handleLogout = async () => {
    setMobileOpen(false);
    await logout();
    onNavigate('/');
  };

  const dashboardPath = role === 'admin' ? '/admin' : '/dashboard';
  const dashboardLabel = role === 'admin' ? 'Admin Panel' : 'Dashboard';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#E5E7EB]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand Wordmark (single-line, zero subtitle clutter) */}
        <a
          href="/"
          onClick={(e) => handleLinkClick(e, '/')}
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-[#172B3A] whitespace-nowrap shrink-0"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C94C4C] text-white shrink-0">
            <Droplet className="h-4 w-4 fill-current" aria-hidden="true" />
          </span>
          <span className="font-[var(--font-display)]">BloodConnect</span>
        </a>

        {/* Zone 2: Clean single-line navigation links */}
        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map((item) => {
            const active =
              item.path === '/'
                ? currentPath === '/'
                : currentPath.startsWith(item.path);
            return (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => handleLinkClick(e, item.path)}
                className={`text-sm font-medium transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                  active
                    ? 'text-[#172B3A] border-[#C94C4C]'
                    : 'text-[#5B6875] border-transparent hover:text-[#172B3A] hover:border-[#E5E7EB]'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: Primary Account Action */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {isAuthenticated ? (
            <>
              <button
                type="button"
                onClick={() => onNavigate(dashboardPath)}
                className="rounded-lg bg-[#172B3A] px-4 py-2 text-sm font-medium text-white hover:bg-[#233E52] transition-colors whitespace-nowrap shrink-0"
              >
                {dashboardLabel}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2 text-sm font-medium text-[#303B46] hover:bg-[#F8FAFC] transition-colors whitespace-nowrap shrink-0"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="rounded-lg bg-[#172B3A] px-4 py-2 text-sm font-medium text-white hover:bg-[#233E52] transition-colors whitespace-nowrap shrink-0"
            >
              Login
            </button>
          )}
        </div>

        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#172B3A] hover:bg-[#F8FAFC]"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#E5E7EB] bg-white px-4 py-4">
          <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
            {NAV_LINKS.map((item) => {
              const active =
                item.path === '/'
                  ? currentPath === '/'
                  : currentPath.startsWith(item.path);
              return (
                <a
                  key={item.path}
                  href={item.path}
                  onClick={(e) => handleLinkClick(e, item.path)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#F8FAFC] text-[#172B3A] font-semibold'
                      : 'text-[#303B46] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
            <a
              href="/emergency"
              onClick={(e) => handleLinkClick(e, '/emergency')}
              className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                currentPath.startsWith('/emergency')
                  ? 'bg-[#F8FAFC] text-[#C94C4C] font-semibold'
                  : 'text-[#C94C4C] hover:bg-[#F8FAFC]'
              }`}
            >
              Emergency Blood Request &amp; Tracker
            </a>
          </nav>

          <div className="mt-4 pt-4 border-t border-[#E5E7EB] flex flex-col gap-2">
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    onNavigate(dashboardPath);
                  }}
                  className="w-full rounded-lg bg-[#172B3A] px-4 py-2.5 text-sm font-medium text-white text-center"
                >
                  {dashboardLabel}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-[#303B46]"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    onNavigate('/login');
                  }}
                  className="w-full rounded-lg bg-[#172B3A] px-4 py-2.5 text-sm font-medium text-white text-center"
                >
                  Donor Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    onNavigate('/admin-login');
                  }}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-[#303B46] text-center"
                >
                  Admin Portal
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
