import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Edit3,
  History,
  Inbox,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest, ApiError } from '../lib/api';
import { ConfirmDialog } from './ConfirmDialog';
import {
  AVAILABILITY_STATUSES,
  BLOOD_GROUPS,
  GENDERS,
  STATES_DISTRICTS,
  calculateProfileCompletion,
  isEligibleByInterval,
} from '../shared/validation';
import type {
  AvailabilityStatus,
  ContactRequest,
  DonorPrivate,
  SearchHistoryItem,
} from '../shared/types';

interface DonorDashboardProps {
  onNavigate: (path: string) => void;
}

type DonorTab = 'overview' | 'profile' | 'requests' | 'history' | 'security';

export function DonorDashboard({ onNavigate }: DonorDashboardProps) {
  const { donor, setDonorProfile, logout } = useAuth();
  const { notify } = useToast();

  const [activeTab, setActiveTab] = useState<DonorTab>('overview');
  const [incomingRequests, setIncomingRequests] = useState<ContactRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ContactRequest[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [responseNotes, setResponseNotes] = useState<Record<string, string>>({});
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);

  // Edit profile form
  const [profileForm, setProfileForm] = useState({
    fullName: donor?.fullName || '',
    age: String(donor?.age || ''),
    gender: donor?.gender || 'Male',
    bloodGroup: donor?.bloodGroup || 'O+',
    mobile: donor?.mobile || '',
    state: donor?.state || '',
    district: donor?.district || '',
    city: donor?.city || '',
    areaPincode: donor?.areaPincode || '',
    lastDonationDate: donor?.lastDonationDate || '',
    shareLastDonation: donor?.shareLastDonation ?? true,
    availabilityStatus: donor?.availabilityStatus || 'Available',
  });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);

  // Change password form
  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);

  // Delete account confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const loadDashboardData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [reqRes, histRes] = await Promise.all([
        apiRequest<{ incoming: ContactRequest[]; outgoing: ContactRequest[] }>('/api/donor/requests'),
        apiRequest<{ history: SearchHistoryItem[] }>('/api/donor/search-history'),
      ]);
      setIncomingRequests(reqRes.incoming);
      setOutgoingRequests(reqRes.outgoing);
      setSearchHistory(histRes.history);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to refresh dashboard data.', 'error');
    } finally {
      setLoadingData(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (!donor) return;
    setProfileForm({
      fullName: donor.fullName,
      age: String(donor.age),
      gender: donor.gender,
      bloodGroup: donor.bloodGroup,
      mobile: donor.mobile,
      state: donor.state,
      district: donor.district,
      city: donor.city,
      areaPincode: donor.areaPincode,
      lastDonationDate: donor.lastDonationDate || '',
      shareLastDonation: donor.shareLastDonation,
      availabilityStatus: donor.availabilityStatus,
    });
  }, [donor]);

  if (!donor) return null;

  const completionPct = calculateProfileCompletion(donor);
  const eligible = isEligibleByInterval(donor.lastDonationDate);
  const pendingCount = incomingRequests.filter((r) => r.status === 'pending').length;
  const availableDistricts = profileForm.state ? STATES_DISTRICTS[profileForm.state] ?? [] : [];

  const handleAvailabilityChange = async (status: AvailabilityStatus) => {
    try {
      const res = await apiRequest<{ donor: DonorPrivate; message: string }>(
        '/api/donor/availability',
        { method: 'PATCH', body: { availabilityStatus: status } }
      );
      setDonorProfile(res.donor);
      notify(res.message, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update availability.', 'error');
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileErrors({});
    try {
      const res = await apiRequest<{ donor: DonorPrivate; message: string }>(
        '/api/donor/profile',
        {
          method: 'PUT',
          body: {
            ...profileForm,
            age: Number(profileForm.age),
          },
        }
      );
      setDonorProfile(res.donor);
      notify(res.message, 'success');
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setProfileErrors(err.errors);
      }
      notify(err instanceof Error ? err.message : 'Failed to save profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRequestDecision = async (
    requestId: string,
    status: 'accepted' | 'declined' | 'completed'
  ) => {
    setBusyRequestId(requestId);
    try {
      const res = await apiRequest<{ request: ContactRequest; message: string }>(
        `/api/donor/requests/${requestId}`,
        {
          method: 'PATCH',
          body: {
            status,
            donorResponseNote: responseNotes[requestId] || '',
          },
        }
      );
      setIncomingRequests((prev) => prev.map((r) => (r.id === requestId ? res.request : r)));
      notify(res.message, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update request.', 'error');
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleClearHistory = async () => {
    try {
      await apiRequest('/api/donor/search-history', { method: 'DELETE' });
      setSearchHistory([]);
      notify('Search history cleared.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to clear history.', 'error');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwForm.currentPassword || pwForm.newPassword.length < 8) {
      notify('Enter current password and a new password of at least 8 characters.', 'error');
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      notify('New passwords do not match.', 'error');
      return;
    }
    setSavingPassword(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/donor/change-password', {
        method: 'POST',
        body: pwForm,
      });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      notify(res.message, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to change password.', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/donor/account', {
        method: 'DELETE',
      });
      await logout();
      notify(res.message, 'info');
      onNavigate('/');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to delete account.', 'error');
    } finally {
      setDeletingAccount(false);
      setDeleteDialogOpen(false);
    }
  };

  const navItems: { id: DonorTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'profile', label: 'Edit Profile & Location', icon: <Edit3 className="h-4 w-4" /> },
    {
      id: 'requests',
      label: 'Contact Requests',
      icon: <Inbox className="h-4 w-4" />,
      badge: pendingCount,
    },
    { id: 'history', label: 'Search History', icon: <History className="h-4 w-4" /> },
    { id: 'security', label: 'Security & Account', icon: <KeyRound className="h-4 w-4" /> },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E5E7EB]">
        <div>
          <p className="text-xs font-medium text-[#168C8C]">Personal Donor Workspace</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-[#172B3A]">
            Welcome, {donor.fullName}
          </h1>
          <p className="mt-1 text-xs text-[#5B6875]">
            {donor.verified ? 'Verified donor profile' : 'Pending administrator verification'} ·{' '}
            {donor.city}, {donor.district}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('/find-donors')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#172B3A] hover:bg-[#F8FAFC] whitespace-nowrap"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span>Find Donors</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Grid */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-3">
          <nav aria-label="Donor dashboard sections" className="space-y-1">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors text-left ${
                    active
                      ? 'bg-[#172B3A] text-white'
                      : 'text-[#303B46] hover:bg-white hover:text-[#172B3A]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`font-mono text-xs font-semibold tabular-nums ${
                        active ? 'text-white' : 'text-[#C94C4C]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Profile Completion Card */}
          <div className="mt-6 rounded-xl border border-[#E5E7EB] bg-white p-4">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-[#5B6875]">Profile Completion</span>
              <span className="font-mono font-semibold text-[#172B3A] tabular-nums">
                {completionPct}%
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-[#F8FAFC] overflow-hidden border border-[#E5E7EB]">
              <div
                className="h-full bg-[#168C8C] transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            {completionPct < 100 && (
              <p className="mt-2.5 text-xs text-[#5B6875]">
                Add your last donation date to reach 100% completion.
              </p>
            )}
          </div>
        </aside>

        {/* Tab Viewport */}
        <div className="lg:col-span-9 space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* Quick Summary Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
                  <p className="text-xs text-[#5B6875]">Blood Group</p>
                  <p className="mt-1.5 font-mono text-2xl font-semibold text-[#C94C4C]">
                    {donor.bloodGroup}
                  </p>
                </div>

                <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
                  <p className="text-xs text-[#5B6875]">Availability</p>
                  <p
                    className={`mt-1.5 text-base font-semibold ${
                      donor.availabilityStatus === 'Available'
                        ? 'text-[#168C8C]'
                        : 'text-[#5B6875]'
                    }`}
                  >
                    {donor.availabilityStatus}
                  </p>
                </div>

                <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
                  <p className="text-xs text-[#5B6875]">Last Donation</p>
                  <p className="mt-1.5 text-sm font-semibold text-[#172B3A] tabular-nums">
                    {donor.lastDonationDate
                      ? new Date(donor.lastDonationDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Not recorded'}
                  </p>
                  <p className="mt-1 text-xs text-[#5B6875]">
                    {eligible ? 'Standard 90-day interval met' : 'Within 90-day recovery window'}
                  </p>
                </div>

                <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
                  <p className="text-xs text-[#5B6875]">Incoming Requests</p>
                  <p className="mt-1.5 font-mono text-2xl font-semibold text-[#172B3A] tabular-nums">
                    {incomingRequests.length}
                  </p>
                  <p className="mt-1 text-xs text-[#5B6875] tabular-nums">
                    {pendingCount} awaiting response
                  </p>
                </div>
              </div>

              {/* Quick Availability Toggle */}
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
                <div className="flex flex-col gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-[#172B3A]">
                      Quick Availability Status
                    </h2>
                    <p className="mt-1 text-xs text-[#5B6875]">
                      Keep your status current so hospitals and families contact available donors.
                    </p>
                  </div>
                  <div className="inline-flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-lg bg-[#F8FAFC] p-1 border border-[#E5E7EB] w-fit">
                    {AVAILABILITY_STATUSES.map((status) => {
                      const selected = donor.availabilityStatus === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => handleAvailabilityChange(status)}
                          className={`rounded-md px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                            selected
                              ? 'bg-[#168C8C] text-white shadow-xs'
                              : 'text-[#303B46] hover:bg-white hover:text-[#172B3A]'
                          }`}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Profile Details Summary */}
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-base font-semibold text-[#172B3A]">Registered Details</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('profile')}
                    className="text-xs font-semibold text-[#168C8C] hover:underline"
                  >
                    Edit Profile &amp; Location
                  </button>
                </div>
                <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-[#5B6875]">Full Name</dt>
                    <dd className="mt-0.5 font-medium text-[#172B3A]">{donor.fullName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#5B6875]">Age &amp; Gender</dt>
                    <dd className="mt-0.5 font-medium text-[#172B3A] tabular-nums">
                      {donor.age} · {donor.gender}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#5B6875]">Private Mobile (Protected)</dt>
                    <dd className="mt-0.5 font-mono text-sm text-[#172B3A] tabular-nums">
                      {donor.mobile}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#5B6875]">Email Address</dt>
                    <dd className="mt-0.5 text-[#172B3A]">{donor.email}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-[#5B6875]">Location</dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 text-[#172B3A]">
                      <MapPin className="h-4 w-4 text-[#168C8C]" aria-hidden="true" />
                      <span>
                        {donor.areaPincode}, {donor.city}, {donor.district}, {donor.state}
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>
            </>
          )}

          {activeTab === 'profile' && (
            <form
              onSubmit={handleProfileSave}
              className="rounded-xl border border-[#E5E7EB] bg-white p-6 space-y-6"
            >
              <div>
                <h2 className="text-lg font-semibold text-[#172B3A]">
                  Edit Profile, Location &amp; Donation Date
                </h2>
                <p className="mt-1 text-xs text-[#5B6875]">
                  Changes take effect immediately across the donor search directory.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-name" className="block text-xs font-medium text-[#303B46] mb-1">
                    Full Name
                  </label>
                  <input
                    id="edit-name"
                    type="text"
                    value={profileForm.fullName}
                    onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                  />
                  {profileErrors.fullName && (
                    <p className="mt-1 text-xs text-[#C94C4C]">{profileErrors.fullName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="edit-age" className="block text-xs font-medium text-[#303B46] mb-1">
                    Age
                  </label>
                  <input
                    id="edit-age"
                    type="number"
                    min={18}
                    max={65}
                    value={profileForm.age}
                    onChange={(e) => setProfileForm({ ...profileForm, age: e.target.value })}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A] tabular-nums"
                  />
                  {profileErrors.age && (
                    <p className="mt-1 text-xs text-[#C94C4C]">{profileErrors.age}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="edit-gender" className="block text-xs font-medium text-[#303B46] mb-1">
                    Gender
                  </label>
                  <select
                    id="edit-gender"
                    value={profileForm.gender}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        gender: e.target.value as DonorPrivate['gender'],
                      })
                    }
                    className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A]"
                  >
                    {GENDERS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-bg" className="block text-xs font-medium text-[#303B46] mb-1">
                    Blood Group
                  </label>
                  <select
                    id="edit-bg"
                    value={profileForm.bloodGroup}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        bloodGroup: e.target.value as DonorPrivate['bloodGroup'],
                      })
                    }
                    className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A]"
                  >
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-mobile" className="block text-xs font-medium text-[#303B46] mb-1">
                    Mobile Number
                  </label>
                  <input
                    id="edit-mobile"
                    type="tel"
                    value={profileForm.mobile}
                    onChange={(e) => setProfileForm({ ...profileForm, mobile: e.target.value })}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                  />
                  {profileErrors.mobile && (
                    <p className="mt-1 text-xs text-[#C94C4C]">{profileErrors.mobile}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="edit-availability" className="block text-xs font-medium text-[#303B46] mb-1">
                    Availability Status
                  </label>
                  <select
                    id="edit-availability"
                    value={profileForm.availabilityStatus}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        availabilityStatus: e.target.value as AvailabilityStatus,
                      })
                    }
                    className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A]"
                  >
                    {AVAILABILITY_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-state" className="block text-xs font-medium text-[#303B46] mb-1">
                    State
                  </label>
                  <select
                    id="edit-state"
                    value={profileForm.state}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, state: e.target.value, district: '' })
                    }
                    className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A]"
                  >
                    <option value="">Select State</option>
                    {Object.keys(STATES_DISTRICTS).map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-district" className="block text-xs font-medium text-[#303B46] mb-1">
                    District
                  </label>
                  <select
                    id="edit-district"
                    value={profileForm.district}
                    onChange={(e) => setProfileForm({ ...profileForm, district: e.target.value })}
                    className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A]"
                  >
                    <option value="">Select District</option>
                    {availableDistricts.map((dist) => (
                      <option key={dist} value={dist}>
                        {dist}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-city" className="block text-xs font-medium text-[#303B46] mb-1">
                    City
                  </label>
                  <input
                    id="edit-city"
                    type="text"
                    value={profileForm.city}
                    onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                  />
                </div>

                <div>
                  <label htmlFor="edit-area" className="block text-xs font-medium text-[#303B46] mb-1">
                    Area / Pincode
                  </label>
                  <input
                    id="edit-area"
                    type="text"
                    value={profileForm.areaPincode}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, areaPincode: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                  />
                </div>

                <div>
                  <label htmlFor="edit-lastDonation" className="block text-xs font-medium text-[#303B46] mb-1">
                    Last Donation Date
                  </label>
                  <input
                    id="edit-lastDonation"
                    type="date"
                    value={profileForm.lastDonationDate}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, lastDonationDate: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="inline-flex items-center gap-2 text-sm text-[#303B46] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profileForm.shareLastDonation}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, shareLastDonation: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-[#E5E7EB] text-[#168C8C]"
                    />
                    <span>Show last donation date on public card</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-[#E5E7EB]">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="rounded-lg bg-[#172B3A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#233E52] disabled:opacity-60"
                >
                  {savingProfile ? 'Saving Changes…' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'requests' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
                <h2 className="text-lg font-semibold text-[#172B3A]">Incoming Contact Requests</h2>
                <p className="mt-1 text-xs text-[#5B6875]">
                  Review each hospital request carefully. Your mobile number and email are shared
                  only if you click Accept.
                </p>

                {loadingData ? (
                  <p className="mt-6 text-sm text-[#5B6875]">Loading contact requests…</p>
                ) : incomingRequests.length === 0 ? (
                  <div className="mt-6 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-6 text-center text-sm text-[#5B6875]">
                    No incoming contact requests yet.
                  </div>
                ) : (
                  <div className="mt-5 divide-y divide-[#E5E7EB]">
                    {incomingRequests.map((req) => (
                      <div key={req.id} className="py-5 first:pt-0 last:pb-0">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="font-semibold text-[#172B3A]">
                                {req.requesterName}
                              </span>
                              <span className="text-[#5B6875]">·</span>
                              <span className="font-mono text-xs text-[#5B6875]">
                                {req.trackingCode}
                              </span>
                              <span className="text-[#5B6875]">·</span>
                              <span
                                className={`text-xs font-semibold ${
                                  req.urgency === 'Critical'
                                    ? 'text-[#C94C4C]'
                                    : req.urgency === 'Urgent'
                                      ? 'text-[#B45309]'
                                      : 'text-[#5B6875]'
                                }`}
                              >
                                {req.urgency} ({req.unitsNeeded} unit{req.unitsNeeded > 1 ? 's' : ''})
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-[#5B6875]">
                              {req.hospitalName}, {req.city} · Phone: {req.requesterPhone} ·{' '}
                              {req.requesterEmail}
                            </p>
                            <p className="mt-2.5 text-sm text-[#303B46] leading-relaxed">
                              {req.message}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={`text-xs font-semibold capitalize ${
                                req.status === 'accepted' || req.status === 'completed'
                                  ? 'text-[#168C8C]'
                                  : req.status === 'declined'
                                    ? 'text-[#5B6875]'
                                    : 'text-[#C94C4C]'
                              }`}
                            >
                              Status: {req.status}
                            </span>
                            <p className="mt-1 text-xs text-[#5B6875] tabular-nums">
                              {new Date(req.createdAt).toLocaleDateString('en-IN')}
                            </p>
                          </div>
                        </div>

                        {req.status === 'pending' && (
                          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                            <input
                              type="text"
                              value={responseNotes[req.id] || ''}
                              onChange={(e) =>
                                setResponseNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                              }
                              placeholder="Optional coordination note (e.g., preferred time to call)"
                              className="flex-1 rounded-lg border border-[#E5E7EB] px-3 py-2 text-xs text-[#172B3A]"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={busyRequestId === req.id}
                                onClick={() => handleRequestDecision(req.id, 'accepted')}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#168C8C] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#117171] disabled:opacity-60 whitespace-nowrap"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Accept &amp; Share Contact</span>
                              </button>
                              <button
                                type="button"
                                disabled={busyRequestId === req.id}
                                onClick={() => handleRequestDecision(req.id, 'declined')}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-medium text-[#303B46] hover:bg-[#F8FAFC] disabled:opacity-60 whitespace-nowrap"
                              >
                                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Decline</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {req.status === 'accepted' && (
                          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB] px-3.5 py-2.5 text-xs text-[#303B46]">
                            <span>
                              Contact shared with requester.{' '}
                              {req.donorResponseNote ? `Note: ${req.donorResponseNote}` : ''}
                            </span>
                            <button
                              type="button"
                              disabled={busyRequestId === req.id}
                              onClick={() => handleRequestDecision(req.id, 'completed')}
                              className="font-semibold text-[#168C8C] hover:underline whitespace-nowrap"
                            >
                              Mark Completed
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {outgoingRequests.length > 0 && (
                <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
                  <h2 className="text-base font-semibold text-[#172B3A]">
                    Requests You Sent to Other Donors
                  </h2>
                  <div className="mt-4 divide-y divide-[#E5E7EB] text-sm">
                    {outgoingRequests.map((req) => (
                      <div key={req.id} className="py-3.5 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-[#172B3A]">
                            {req.donorName} ({req.donorBloodGroup}) · {req.hospitalName}
                          </p>
                          <p className="text-xs text-[#5B6875] font-mono">{req.trackingCode}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate(`/emergency?track=${encodeURIComponent(req.trackingCode)}`)
                          }
                          className="text-xs font-semibold text-[#168C8C] hover:underline whitespace-nowrap"
                        >
                          Status: {req.status} →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-[#172B3A]">Recent Search History</h2>
                  <p className="mt-1 text-xs text-[#5B6875]">
                    Saved searches performed while signed into your account.
                  </p>
                </div>
                {searchHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="text-xs font-medium text-[#C94C4C] hover:underline"
                  >
                    Clear History
                  </button>
                )}
              </div>

              {searchHistory.length === 0 ? (
                <div className="mt-6 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-6 text-center text-sm text-[#5B6875]">
                  No saved searches yet. Use the Find Donors page to search and save filters here.
                </div>
              ) : (
                <div className="mt-4 divide-y divide-[#E5E7EB]">
                  {searchHistory.map((item) => {
                    const params = new URLSearchParams();
                    if (item.bloodGroup) params.set('bloodGroup', item.bloodGroup);
                    if (item.state) params.set('state', item.state);
                    if (item.district) params.set('district', item.district);
                    if (item.city) params.set('city', item.city);
                    if (item.availability) params.set('availability', item.availability);
                    const summaryParts = [
                      item.bloodGroup ? `Group ${item.bloodGroup}` : 'Any Group',
                      item.city || item.district || item.state || 'All Locations',
                      item.availability || 'Any Availability',
                    ];
                    return (
                      <div
                        key={item.id}
                        className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-[#172B3A]">
                            {summaryParts.join(' · ')}
                          </p>
                          <p className="mt-0.5 text-xs text-[#5B6875] flex items-center gap-1.5 tabular-nums">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>
                              {new Date(item.createdAt).toLocaleString('en-IN')} ·{' '}
                              {item.resultCount} matching
                            </span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onNavigate(`/find-donors?${params.toString()}`)}
                          className="text-xs font-semibold text-[#168C8C] hover:underline self-start sm:self-center whitespace-nowrap"
                        >
                          Run Search Again
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <form
                onSubmit={handlePasswordChange}
                className="rounded-xl border border-[#E5E7EB] bg-white p-6 space-y-4"
              >
                <h2 className="text-lg font-semibold text-[#172B3A]">Change Password</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="pw-current" className="block text-xs font-medium text-[#303B46] mb-1">
                      Current Password
                    </label>
                    <input
                      id="pw-current"
                      type="password"
                      value={pwForm.currentPassword}
                      onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                    />
                  </div>
                  <div>
                    <label htmlFor="pw-new" className="block text-xs font-medium text-[#303B46] mb-1">
                      New Password (min. 8 chars)
                    </label>
                    <input
                      id="pw-new"
                      type="password"
                      value={pwForm.newPassword}
                      onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                    />
                  </div>
                  <div>
                    <label htmlFor="pw-confirm" className="block text-xs font-medium text-[#303B46] mb-1">
                      Confirm New Password
                    </label>
                    <input
                      id="pw-confirm"
                      type="password"
                      value={pwForm.confirmPassword}
                      onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="rounded-lg bg-[#172B3A] px-5 py-2 text-sm font-semibold text-white hover:bg-[#233E52] disabled:opacity-60"
                  >
                    {savingPassword ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </form>

              <div className="rounded-xl border border-[#C94C4C]/30 bg-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-[#172B3A]">Delete Donor Account</h2>
                  <p className="mt-1 text-xs text-[#5B6875]">
                    Permanently remove your donor profile and personal details from BloodConnect.
                    This action cannot be undone.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#C94C4C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B13E3E] whitespace-nowrap shrink-0"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span>Delete Account</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete your donor account?"
        description="Your profile, location, and contact preferences will be permanently deleted from the BloodConnect database."
        confirmLabel="Delete Account"
        busy={deletingAccount}
        onConfirm={handleDeleteAccount}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}
