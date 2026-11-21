import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  Flag,
  LayoutDashboard,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from './ConfirmDialog';
import {
  AVAILABILITY_STATUSES,
  BLOOD_GROUPS,
  GENDERS,
  STATES_DISTRICTS,
} from '../shared/validation';
import type {
  AbuseReport,
  BloodGroup,
  ContactMessage,
  DonorPrivate,
  EmergencyRequest,
  EmergencyStatus,
} from '../shared/types';

type AdminTab = 'overview' | 'donors' | 'verifications' | 'emergency' | 'reports';

interface AdminStats {
  totalDonors: number;
  activeDonors: number;
  availableDonors: number;
  verifiedDonors: number;
  bloodGroupCount: number;
  pendingVerifications: number;
  openReports: number;
  openEmergencyRequests: number;
  totalContactRequests: number;
  acceptedConnections: number;
  unreadMessages: number;
  byBloodGroup: Record<BloodGroup, number>;
  storageMode: 'mongodb' | 'local-file';
}

const EMPTY_DONOR_FORM = {
  fullName: '',
  age: '28',
  gender: 'Male',
  bloodGroup: 'O+',
  mobile: '',
  email: '',
  state: 'Karnataka',
  district: 'Bengaluru Urban',
  city: '',
  areaPincode: '',
  lastDonationDate: '',
  availabilityStatus: 'Available',
  verified: true,
  isActive: true,
};

export function AdminDashboard() {
  const { adminEmail } = useAuth();
  const { notify } = useToast();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [donors, setDonors] = useState<DonorPrivate[]>([]);
  const [reports, setReports] = useState<AbuseReport[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyRequest[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [bgFilter, setBgFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');

  // Add / Edit Donor Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDonorId, setEditingDonorId] = useState<string | null>(null);
  const [donorForm, setDonorForm] = useState(EMPTY_DONOR_FORM);
  const [savingDonor, setSavingDonor] = useState(false);

  // Confirm Dialog State
  const [confirmTarget, setConfirmTarget] = useState<{
    type: 'donor' | 'emergency';
    id: string;
    label: string;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (bgFilter) params.set('bloodGroup', bgFilter);
      if (stateFilter) params.set('state', stateFilter);

      const [ovRes, donRes, repRes, emgRes, msgRes] = await Promise.all([
        apiRequest<{ stats: AdminStats }>('/api/admin/overview'),
        apiRequest<{ donors: DonorPrivate[] }>(`/api/admin/donors?${params.toString()}`),
        apiRequest<{ reports: AbuseReport[] }>('/api/admin/reports'),
        apiRequest<{ requests: EmergencyRequest[] }>('/api/admin/emergency'),
        apiRequest<{ messages: ContactMessage[] }>('/api/admin/messages'),
      ]);

      setStats(ovRes.stats);
      setDonors(donRes.donors);
      setReports(repRes.reports);
      setEmergencies(emgRes.requests);
      setMessages(msgRes.messages);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to load administrator data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, bgFilter, stateFilter, notify]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const openAddModal = () => {
    setEditingDonorId(null);
    setDonorForm(EMPTY_DONOR_FORM);
    setEditorOpen(true);
  };

  const openEditModal = (donor: DonorPrivate) => {
    setEditingDonorId(donor.id);
    setDonorForm({
      fullName: donor.fullName,
      age: String(donor.age),
      gender: donor.gender,
      bloodGroup: donor.bloodGroup,
      mobile: donor.mobile,
      email: donor.email,
      state: donor.state,
      district: donor.district,
      city: donor.city,
      areaPincode: donor.areaPincode,
      lastDonationDate: donor.lastDonationDate || '',
      availabilityStatus: donor.availabilityStatus,
      verified: donor.verified,
      isActive: donor.isActive,
    });
    setEditorOpen(true);
  };

  const handleSaveDonor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDonor(true);
    try {
      const payload = {
        ...donorForm,
        age: Number(donorForm.age),
      };
      if (editingDonorId) {
        const res = await apiRequest<{ message: string }>(`/api/admin/donors/${editingDonorId}`, {
          method: 'PUT',
          body: payload,
        });
        notify(res.message, 'success');
      } else {
        const res = await apiRequest<{ message: string }>('/api/admin/donors', {
          method: 'POST',
          body: payload,
        });
        notify(res.message, 'success');
      }
      setEditorOpen(false);
      await loadAll();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to save donor record.', 'error');
    } finally {
      setSavingDonor(false);
    }
  };

  const handleToggleVerify = async (donor: DonorPrivate) => {
    try {
      const res = await apiRequest<{ message: string }>(`/api/admin/donors/${donor.id}/verify`, {
        method: 'PATCH',
        body: { verified: !donor.verified },
      });
      notify(res.message, 'success');
      await loadAll();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update verification.', 'error');
    }
  };

  const handleToggleActive = async (donor: DonorPrivate) => {
    try {
      await apiRequest(`/api/admin/donors/${donor.id}`, {
        method: 'PUT',
        body: { isActive: !donor.isActive },
      });
      notify(
        donor.isActive ? `${donor.fullName} deactivated.` : `${donor.fullName} reactivated.`,
        'info'
      );
      await loadAll();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update account status.', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    setConfirmBusy(true);
    try {
      if (confirmTarget.type === 'donor') {
        const res = await apiRequest<{ message: string }>(
          `/api/admin/donors/${confirmTarget.id}`,
          { method: 'DELETE' }
        );
        notify(res.message, 'success');
      } else {
        const res = await apiRequest<{ message: string }>(
          `/api/admin/emergency/${confirmTarget.id}`,
          { method: 'DELETE' }
        );
        notify(res.message, 'success');
      }
      await loadAll();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Deletion failed.', 'error');
    } finally {
      setConfirmBusy(false);
      setConfirmTarget(null);
    }
  };

  const handleEmergencyStatusChange = async (id: string, status: EmergencyStatus) => {
    try {
      const res = await apiRequest<{ message: string }>(`/api/admin/emergency/${id}`, {
        method: 'PATCH',
        body: { status },
      });
      notify(res.message, 'success');
      await loadAll();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to update status.', 'error');
    }
  };

  const handleReportStatusChange = async (
    id: string,
    status: 'reviewed' | 'resolved' | 'dismissed'
  ) => {
    try {
      const res = await apiRequest<{ message: string }>(`/api/admin/reports/${id}`, {
        method: 'PATCH',
        body: { status },
      });
      notify(res.message, 'success');
      await loadAll();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to update report.', 'error');
    }
  };

  const pendingDonors = donors.filter((d) => !d.verified);
  const editorDistricts = donorForm.state ? STATES_DISTRICTS[donorForm.state] ?? [] : [];

  const navItems: { id: AdminTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'donors', label: 'Donor Records', icon: <Users className="h-4 w-4" />, count: stats?.totalDonors },
    {
      id: 'verifications',
      label: 'Verification Queue',
      icon: <ShieldCheck className="h-4 w-4" />,
      count: stats?.pendingVerifications,
    },
    {
      id: 'emergency',
      label: 'Emergency Requests',
      icon: <AlertCircle className="h-4 w-4" />,
      count: stats?.openEmergencyRequests,
    },
    {
      id: 'reports',
      label: 'Reports & Messages',
      icon: <Flag className="h-4 w-4" />,
      count: stats?.openReports,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E5E7EB]">
        <div>
          <p className="text-xs font-medium text-[#168C8C]">BloodConnect Administration</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-[#172B3A]">
            Administrator Dashboard
          </h1>
          <p className="mt-1 text-xs text-[#5B6875]">
            Signed in as {adminEmail} · Full donor CRUD, profile verification, and moderation
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C94C4C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#B13E3E] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Add Donor Record</span>
        </button>
      </div>

      {/* Main Layout */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-3">
          <nav aria-label="Admin sections" className="space-y-1">
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
                  {item.count !== undefined && (
                    <span
                      className={`font-mono text-xs font-semibold tabular-nums ${
                        active ? 'text-white/90' : 'text-[#5B6875]'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="lg:col-span-9 space-y-6">
          {/* Overview Statistics */}
          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex flex-col justify-between">
                  <p className="text-xs leading-snug text-[#5B6875]">Total Registered Donors</p>
                  <p className="mt-3 font-mono text-2xl font-semibold text-[#172B3A] tabular-nums">
                    {stats ? stats.totalDonors : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex flex-col justify-between">
                  <p className="text-xs leading-snug text-[#5B6875]">Active Donors</p>
                  <p className="mt-3 font-mono text-2xl font-semibold text-[#172B3A] tabular-nums">
                    {stats ? stats.activeDonors : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex flex-col justify-between">
                  <p className="text-xs leading-snug text-[#5B6875]">Available Donors</p>
                  <p className="mt-3 font-mono text-2xl font-semibold text-[#168C8C] tabular-nums">
                    {stats ? stats.availableDonors : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex flex-col justify-between">
                  <p className="text-xs leading-snug text-[#5B6875]">Total Blood Groups</p>
                  <p className="mt-3 font-mono text-2xl font-semibold text-[#172B3A] tabular-nums">
                    {stats ? stats.bloodGroupCount : 8}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex flex-col justify-between col-span-2 lg:col-span-1">
                  <p className="text-xs leading-snug text-[#5B6875]">Pending Verifications</p>
                  <p className="mt-3 font-mono text-2xl font-semibold text-[#C94C4C] tabular-nums">
                    {stats ? stats.pendingVerifications : '—'}
                  </p>
                </div>
              </div>

              {/* Blood Group Inventory Table */}
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-[#172B3A]">
                    Donor Distribution by Blood Group
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('donors')}
                    className="text-xs font-semibold text-[#168C8C] hover:underline"
                  >
                    Manage All Records
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-4 sm:grid-cols-8 gap-3">
                  {BLOOD_GROUPS.map((bg) => (
                    <div
                      key={bg}
                      className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-center"
                    >
                      <p className="font-mono text-sm font-semibold text-[#C94C4C]">{bg}</p>
                      <p className="mt-1 font-mono text-lg font-semibold text-[#172B3A] tabular-nums">
                        {stats?.byBloodGroup?.[bg] ?? 0}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Queues Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#172B3A]">
                      Pending Profile Verifications
                    </p>
                    <p className="mt-1 text-xs text-[#5B6875]">
                      {stats?.pendingVerifications ?? 0} donor profiles waiting for verification.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('verifications')}
                    className="rounded-lg border border-[#E5E7EB] px-3.5 py-2 text-xs font-semibold text-[#172B3A] hover:bg-[#F8FAFC] whitespace-nowrap"
                  >
                    Review Queue
                  </button>
                </div>

                <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#172B3A]">
                      Open Record Reports
                    </p>
                    <p className="mt-1 text-xs text-[#5B6875]">
                      {stats?.openReports ?? 0} flagged records requiring review.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('reports')}
                    className="rounded-lg border border-[#E5E7EB] px-3.5 py-2 text-xs font-semibold text-[#172B3A] hover:bg-[#F8FAFC] whitespace-nowrap"
                  >
                    Review Reports
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Full Donor CRUD Table */}
          {activeTab === 'donors' && (
            <div className="rounded-xl border border-[#E5E7EB] bg-white">
              <div className="p-5 border-b border-[#E5E7EB] flex flex-col md:flex-row md:items-center gap-3">
                <div className="relative flex-1">
                  <Search
                    className="h-4 w-4 text-[#5B6875] absolute left-3 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search donors by name, city, email, or phone"
                    placeholder="Search name, city, email, or mobile…"
                    className="w-full rounded-lg border border-[#E5E7EB] pl-9 pr-3 py-2 text-sm text-[#172B3A]"
                  />
                </div>
                <select
                  aria-label="Filter donors by blood group"
                  value={bgFilter}
                  onChange={(e) => setBgFilter(e.target.value)}
                  className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A]"
                >
                  <option value="">All Groups</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter donors by state"
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A]"
                >
                  <option value="">All States</option>
                  {Object.keys(STATES_DISTRICTS).map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#E5E7EB] bg-[#F8FAFC] text-xs font-semibold text-[#5B6875]">
                    <tr>
                      <th className="px-4 py-3">Donor</th>
                      <th className="px-4 py-3">Group</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Availability</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-[#5B6875]">
                          Loading donor records…
                        </td>
                      </tr>
                    ) : donors.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-[#5B6875]">
                          No donor records match your filters.
                        </td>
                      </tr>
                    ) : (
                      donors.map((d) => (
                        <tr key={d.id} className="hover:bg-[#F8FAFC]/80">
                          <td className="px-4 py-3">
                            <p className="font-medium text-[#172B3A]">{d.fullName}</p>
                            <p className="text-xs text-[#5B6875] tabular-nums">
                              {d.mobile} · {d.email}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold text-[#C94C4C]">
                            {d.bloodGroup}
                          </td>
                          <td className="px-4 py-3 text-xs text-[#303B46]">
                            <p className="font-medium">
                              {d.city}, {d.district}
                            </p>
                            <p className="text-[#5B6875]">
                              {d.areaPincode} · {d.state}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-xs font-medium text-[#303B46]">
                            {d.availabilityStatus}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <p className={d.verified ? 'text-[#168C8C] font-medium' : 'text-[#5B6875]'}>
                              {d.verified ? 'Verified' : 'Unverified'}
                            </p>
                            <p className={d.isActive ? 'text-[#5B6875]' : 'text-[#C94C4C] font-medium'}>
                              {d.isActive ? 'Active' : 'Inactive'}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleVerify(d)}
                                aria-label={
                                  d.verified
                                    ? `Revoke verification for ${d.fullName}`
                                    : `Verify ${d.fullName}`
                                }
                                title={d.verified ? 'Revoke verification' : 'Verify profile'}
                                className="rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 text-xs font-medium text-[#168C8C] hover:bg-[#F8FAFC] whitespace-nowrap"
                              >
                                {d.verified ? 'Unverify' : 'Verify'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleActive(d)}
                                aria-label={
                                  d.isActive ? `Deactivate ${d.fullName}` : `Activate ${d.fullName}`
                                }
                                className="rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 text-xs font-medium text-[#303B46] hover:bg-[#F8FAFC] whitespace-nowrap"
                              >
                                {d.isActive ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(d)}
                                aria-label={`Edit ${d.fullName}`}
                                className="rounded-lg border border-[#E5E7EB] p-1.5 text-[#172B3A] hover:bg-[#F8FAFC]"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmTarget({
                                    type: 'donor',
                                    id: d.id,
                                    label: d.fullName,
                                  })
                                }
                                aria-label={`Delete ${d.fullName}`}
                                className="rounded-lg border border-[#E5E7EB] p-1.5 text-[#C94C4C] hover:bg-[#C94C4C]/5"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pending Verifications Queue */}
          {activeTab === 'verifications' && (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
              <h2 className="text-lg font-semibold text-[#172B3A]">
                Pending Donor Verification Queue
              </h2>
              <p className="mt-1 text-xs text-[#5B6875]">
                Confirm donor identity details and mark profiles verified to increase trust in
                search results.
              </p>

              {pendingDonors.length === 0 ? (
                <div className="mt-6 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-8 text-center text-sm text-[#5B6875]">
                  All registered donor profiles are currently verified.
                </div>
              ) : (
                <div className="mt-5 divide-y divide-[#E5E7EB]">
                  {pendingDonors.map((d) => (
                    <div
                      key={d.id}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#172B3A]">
                          {d.fullName}{' '}
                          <span className="font-mono text-[#C94C4C] ml-1">{d.bloodGroup}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-[#5B6875]">
                          {d.city}, {d.district}, {d.state} · Mobile: {d.mobile} · {d.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleVerify(d)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#168C8C] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#117171]"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Approve Verification</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(d)}
                          className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-xs font-medium text-[#303B46] hover:bg-[#F8FAFC]"
                        >
                          Inspect / Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Emergency Requests Moderation */}
          {activeTab === 'emergency' && (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
              <h2 className="text-lg font-semibold text-[#172B3A]">Emergency Blood Requests</h2>
              <p className="mt-1 text-xs text-[#5B6875]">
                Update fulfillment statuses or remove resolved emergency listings.
              </p>

              {emergencies.length === 0 ? (
                <div className="mt-6 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-6 text-center text-sm text-[#5B6875]">
                  No emergency blood requests logged.
                </div>
              ) : (
                <div className="mt-5 divide-y divide-[#E5E7EB]">
                  {emergencies.map((req) => (
                    <div
                      key={req.id}
                      className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#172B3A]">
                          <span className="font-mono text-[#C94C4C] mr-2">{req.bloodGroup}</span>
                          {req.patientName} · {req.hospitalName}
                        </p>
                        <p className="mt-0.5 text-xs text-[#5B6875] tabular-nums">
                          {req.trackingCode} · {req.city}, {req.district} · {req.unitsRequired}{' '}
                          unit(s) · Contact: {req.requesterName} ({req.requesterPhone})
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          aria-label={`Status for emergency request ${req.trackingCode}`}
                          value={req.status}
                          onChange={(e) =>
                            handleEmergencyStatusChange(req.id, e.target.value as EmergencyStatus)
                          }
                          className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#172B3A]"
                        >
                          <option value="Open">Open</option>
                          <option value="Coordinating">Coordinating</option>
                          <option value="Fulfilled">Fulfilled</option>
                          <option value="Closed">Closed</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmTarget({
                              type: 'emergency',
                              id: req.id,
                              label: `${req.trackingCode} (${req.patientName})`,
                            })
                          }
                          aria-label={`Delete emergency request ${req.trackingCode}`}
                          className="rounded-lg border border-[#E5E7EB] p-1.5 text-[#C94C4C] hover:bg-[#C94C4C]/5"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reports & Contact Inquiries */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
                <h2 className="text-lg font-semibold text-[#172B3A]">
                  Flagged Donor Record Reports
                </h2>
                <p className="mt-1 text-xs text-[#5B6875]">
                  Review community reports for outdated or inaccurate donor entries.
                </p>

                {reports.length === 0 ? (
                  <p className="mt-5 text-sm text-[#5B6875]">No reports submitted.</p>
                ) : (
                  <div className="mt-4 divide-y divide-[#E5E7EB]">
                    {reports.map((rep) => (
                      <div
                        key={rep.id}
                        className="py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[#172B3A]">
                            {rep.donorName} · <span className="text-[#C94C4C]">{rep.reason}</span>
                          </p>
                          <p className="mt-1 text-sm text-[#303B46]">{rep.details}</p>
                          <p className="mt-1 text-xs text-[#5B6875]">
                            Reported by {rep.reporterEmail} · Status:{' '}
                            <span className="capitalize font-medium text-[#172B3A]">
                              {rep.status}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleReportStatusChange(rep.id, 'resolved')}
                            className="rounded-lg bg-[#168C8C] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#117171]"
                          >
                            Resolve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReportStatusChange(rep.id, 'dismissed')}
                            className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-[#303B46] hover:bg-[#F8FAFC]"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#168C8C]" aria-hidden="true" />
                  <h2 className="text-base font-semibold text-[#172B3A]">Contact Desk Messages</h2>
                </div>
                {messages.length === 0 ? (
                  <p className="mt-4 text-sm text-[#5B6875]">No contact inquiries received yet.</p>
                ) : (
                  <div className="mt-4 divide-y divide-[#E5E7EB]">
                    {messages.map((msg) => (
                      <div key={msg.id} className="py-3.5">
                        <div className="flex items-center justify-between gap-2 text-xs text-[#5B6875]">
                          <span className="font-semibold text-[#172B3A]">
                            {msg.name} ({msg.email})
                          </span>
                          <span className="tabular-nums">
                            {new Date(msg.createdAt).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-medium text-[#168C8C]">{msg.subject}</p>
                        <p className="mt-1 text-sm text-[#303B46]">{msg.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Donor Modal */}
      {editorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#172B3A]/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-donor-modal-title"
        >
          <div className="w-full max-w-2xl rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
              <h2 id="admin-donor-modal-title" className="text-lg font-bold text-[#172B3A]">
                {editingDonorId ? 'Update Donor Record' : 'Add New Donor Record'}
              </h2>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                aria-label="Close donor editor"
                className="rounded-lg p-1.5 text-[#5B6875] hover:bg-[#F8FAFC]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDonor} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="adm-name" className="block text-xs font-medium text-[#303B46] mb-1">
                    Full Name *
                  </label>
                  <input
                    id="adm-name"
                    required
                    type="text"
                    value={donorForm.fullName}
                    onChange={(e) => setDonorForm({ ...donorForm, fullName: e.target.value })}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                  />
                </div>

                <div>
                  <label htmlFor="adm-email" className="block text-xs font-medium text-[#303B46] mb-1">
                    Email Address *
                  </label>
                  <input
                    id="adm-email"
                    required
                    disabled={Boolean(editingDonorId)}
                    type="email"
                    value={donorForm.email}
                    onChange={(e) => setDonorForm({ ...donorForm, email: e.target.value })}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A] disabled:bg-[#F8FAFC]"
                  />
                </div>

                <div>
                  <label htmlFor="adm-mobile" className="block text-xs font-medium text-[#303B46] mb-1">
                    Mobile Number (10 digits) *
                  </label>
                  <input
                    id="adm-mobile"
                    required
                    type="tel"
                    value={donorForm.mobile}
                    onChange={(e) => setDonorForm({ ...donorForm, mobile: e.target.value })}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="adm-age" className="block text-xs font-medium text-[#303B46] mb-1">
                      Age *
                    </label>
                    <input
                      id="adm-age"
                      required
                      type="number"
                      min={18}
                      max={65}
                      value={donorForm.age}
                      onChange={(e) => setDonorForm({ ...donorForm, age: e.target.value })}
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                    />
                  </div>
                  <div>
                    <label htmlFor="adm-bg" className="block text-xs font-medium text-[#303B46] mb-1">
                      Blood Group *
                    </label>
                    <select
                      id="adm-bg"
                      value={donorForm.bloodGroup}
                      onChange={(e) => setDonorForm({ ...donorForm, bloodGroup: e.target.value })}
                      className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A]"
                    >
                      {BLOOD_GROUPS.map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="adm-gender" className="block text-xs font-medium text-[#303B46] mb-1">
                    Gender
                  </label>
                  <select
                    id="adm-gender"
                    value={donorForm.gender}
                    onChange={(e) => setDonorForm({ ...donorForm, gender: e.target.value })}
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
                  <label htmlFor="adm-avail" className="block text-xs font-medium text-[#303B46] mb-1">
                    Availability
                  </label>
                  <select
                    id="adm-avail"
                    value={donorForm.availabilityStatus}
                    onChange={(e) =>
                      setDonorForm({ ...donorForm, availabilityStatus: e.target.value })
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
                  <label htmlFor="adm-state" className="block text-xs font-medium text-[#303B46] mb-1">
                    State *
                  </label>
                  <select
                    id="adm-state"
                    value={donorForm.state}
                    onChange={(e) =>
                      setDonorForm({ ...donorForm, state: e.target.value, district: '' })
                    }
                    className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A]"
                  >
                    {Object.keys(STATES_DISTRICTS).map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="adm-district" className="block text-xs font-medium text-[#303B46] mb-1">
                    District *
                  </label>
                  <select
                    id="adm-district"
                    value={donorForm.district}
                    onChange={(e) => setDonorForm({ ...donorForm, district: e.target.value })}
                    className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A]"
                  >
                    <option value="">Select District</option>
                    {editorDistricts.map((dist) => (
                      <option key={dist} value={dist}>
                        {dist}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="adm-city" className="block text-xs font-medium text-[#303B46] mb-1">
                    City *
                  </label>
                  <input
                    id="adm-city"
                    required
                    type="text"
                    value={donorForm.city}
                    onChange={(e) => setDonorForm({ ...donorForm, city: e.target.value })}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                  />
                </div>

                <div>
                  <label htmlFor="adm-area" className="block text-xs font-medium text-[#303B46] mb-1">
                    Area / Pincode *
                  </label>
                  <input
                    id="adm-area"
                    required
                    type="text"
                    value={donorForm.areaPincode}
                    onChange={(e) => setDonorForm({ ...donorForm, areaPincode: e.target.value })}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                  />
                </div>

                <div>
                  <label htmlFor="adm-last" className="block text-xs font-medium text-[#303B46] mb-1">
                    Last Donation Date
                  </label>
                  <input
                    id="adm-last"
                    type="date"
                    value={donorForm.lastDonationDate}
                    onChange={(e) =>
                      setDonorForm({ ...donorForm, lastDonationDate: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                  />
                </div>

                <div className="flex items-center gap-5 pt-5">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-[#303B46]">
                    <input
                      type="checkbox"
                      checked={donorForm.verified}
                      onChange={(e) => setDonorForm({ ...donorForm, verified: e.target.checked })}
                      className="h-4 w-4 rounded border-[#E5E7EB] text-[#168C8C]"
                    />
                    <span>Verified profile</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-[#303B46]">
                    <input
                      type="checkbox"
                      checked={donorForm.isActive}
                      onChange={(e) => setDonorForm({ ...donorForm, isActive: e.target.checked })}
                      className="h-4 w-4 rounded border-[#E5E7EB] text-[#168C8C]"
                    />
                    <span>Active account</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#303B46]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDonor}
                  className="rounded-lg bg-[#172B3A] px-5 py-2 text-sm font-semibold text-white hover:bg-[#233E52] disabled:opacity-60"
                >
                  {savingDonor
                    ? 'Saving…'
                    : editingDonorId
                      ? 'Save Record Changes'
                      : 'Create Donor Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Deletes */}
      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={
          confirmTarget?.type === 'donor'
            ? `Delete donor "${confirmTarget.label}"?`
            : `Remove emergency request ${confirmTarget?.label}?`
        }
        description="This action permanently removes the record from the BloodConnect database and cannot be reversed."
        confirmLabel="Confirm Delete"
        busy={confirmBusy}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
