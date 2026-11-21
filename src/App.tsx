/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './components/HomePage';
import { FindDonorsPage } from './components/FindDonorsPage';
import { RegisterPage } from './components/RegisterPage';
import { LoginPage } from './components/LoginPage';
import { DonorDashboard } from './components/DonorDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { EmergencyPage } from './components/EmergencyPage';
import {
  AboutPage,
  ContactPage,
  PrivacyPolicyPage,
  TermsOfServicePage,
} from './components/InfoPages';

function parseLocation() {
  return {
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
  };
}

function AppShell() {
  const { isAuthenticated, role } = useAuth();
  const [loc, setLoc] = useState(parseLocation);

  const navigate = useCallback((to: string) => {
    const url = new URL(to, window.location.origin);
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
    setLoc({ pathname: url.pathname, search: url.search });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    const onPop = () => setLoc(parseLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const queryParams = new URLSearchParams(loc.search);

  const renderPage = () => {
    switch (loc.pathname) {
      case '/':
        return <HomePage onNavigate={navigate} />;
      case '/find-donors':
        return <FindDonorsPage initialQuery={queryParams} onNavigate={navigate} />;
      case '/register':
        return <RegisterPage onNavigate={navigate} />;
      case '/login':
        if (isAuthenticated && role === 'donor') {
          return <DonorDashboard onNavigate={navigate} />;
        }
        return <LoginPage mode="donor" onNavigate={navigate} />;
      case '/admin-login':
        if (isAuthenticated && role === 'admin') {
          return <AdminDashboard />;
        }
        return <LoginPage mode="admin" onNavigate={navigate} />;
      case '/dashboard':
        if (!isAuthenticated || role !== 'donor') {
          return <LoginPage mode="donor" onNavigate={navigate} />;
        }
        return <DonorDashboard onNavigate={navigate} />;
      case '/admin':
        if (!isAuthenticated || role !== 'admin') {
          return <LoginPage mode="admin" onNavigate={navigate} />;
        }
        return <AdminDashboard />;
      case '/emergency':
        return <EmergencyPage initialQuery={queryParams} onNavigate={navigate} />;
      case '/about':
        return <AboutPage onNavigate={navigate} />;
      case '/contact':
        return <ContactPage />;
      case '/privacy':
        return <PrivacyPolicyPage />;
      case '/terms':
        return <TermsOfServicePage />;
      default:
        return <HomePage onNavigate={navigate} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#303B46]">
      <Navbar currentPath={loc.pathname} onNavigate={navigate} />
      <main className="flex-1">{renderPage()}</main>
      <Footer onNavigate={navigate} />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ToastProvider>
  );
}
