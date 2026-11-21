import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Flag,
  MapPin,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  User,
  X,
  Calendar,
} from 'lucide-react';
import { apiRequest, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  AVAILABILITY_STATUSES,
  BLOOD_COMPATIBILITY,
  BLOOD_GROUPS,
  STATES_DISTRICTS,
  daysSinceDonation,
  validateContactRequest,
} from '../shared/validation';
import type { ContactRequest, DonorPublic } from '../shared/types';

interface FindDonorsPageProps {
  initialQuery: URLSearchParams;
  onNavigate: (path: string) => void;
}

export function FindDonorsPage({ initialQuery, onNavigate }: FindDonorsPageProps) {
  const { donor: loggedInDonor, isAuthenticated } = useAuth();
  const { notify } = useToast();

  const [bloodGroup, setBloodGroup] = useState(initialQuery.get('bloodGroup') || '');
  const [state, setState] = useState(initialQuery.get('state') || '');
  const [district, setDistrict] = useState(initialQuery.get('district') || '');
  const [city, setCity] = useState(initialQuery.get('city') || '');
  const [areaPincode, setAreaPincode] = useState(initialQuery.get('areaPincode') || '');
  const [availability, setAvailability] = useState(initialQuery.get('availability') || '');
  const [nearPincode, setNearPincode] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'location' | 'nearest'>('recent');

  const [donors, setDonors] = useState<DonorPublic[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [profileDonor, setProfileDonor] = useState<DonorPublic | null>(null);
  const [contactDonor, setContactDonor] = useState<DonorPublic | null>(null);
  const [reportDonor, setReportDonor] = useState<DonorPublic | null>(null);

  // Contact request form state
  const [contactForm, setContactForm] = useState({
    requesterName: loggedInDonor?.fullName || '',
    requesterPhone: loggedInDonor?.mobile || '',
    requesterEmail: loggedInDonor?.email || '',
    hospitalName: '',
    city: loggedInDonor?.city || '',
    unitsNeeded: '1',
    urgency: 'Urgent',
    message: '',
  });
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({});
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [createdRequest, setCreatedRequest] = useState<ContactRequest | null>(null);

  // Report form state
  const [reportReason, setReportReason] = useState('Outdated Contact Info');
  const [reportDetails, setReportDetails] = useState('');
  const [reportEmail, setReportEmail] = useState(loggedInDonor?.email || '');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const fetchDonors = useCallback(
    async (recordHistory = false) => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (bloodGroup) params.set('bloodGroup', bloodGroup);
        if (state) params.set('state', state);
        if (district) params.set('district', district);
        if (city.trim()) params.set('city', city.trim());
        if (areaPincode.trim()) params.set('areaPincode', areaPincode.trim());
        if (availability) params.set('availability', availability);
        if (nearPincode.trim()) params.set('nearPincode', nearPincode.trim());
        if (verifiedOnly) params.set('verifiedOnly', 'true');
        params.set('sortBy', nearPincode.trim() && sortBy === 'recent' ? 'nearest' : sortBy);
        if (recordHistory) params.set('recordHistory', 'true');

        const data = await apiRequest<{ total: number; donors: DonorPublic[] }>(
          `/api/donors?${params.toString()}`
        );
        setDonors(data.donors);
        setTotal(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load donor directory.');
      } finally {
        setLoading(false);
      }
    },
    [bloodGroup, state, district, city, areaPincode, availability, nearPincode, verifiedOnly, sortBy]
  );

  useEffect(() => {
    void fetchDonors(false);
  }, [fetchDonors]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchDonors(isAuthenticated);
  };

  const handleClearFilters = () => {
    setBloodGroup('');
    setState('');
    setDistrict('');
    setCity('');
    setAreaPincode('');
    setAvailability('');
    setNearPincode('');
    setVerifiedOnly(false);
    setSortBy('recent');
  };

  const openContactModal = (target: DonorPublic) => {
    setContactDonor(target);
    setCreatedRequest(null);
    setContactErrors({});
    setContactForm((prev) => ({
      ...prev,
      requesterName: prev.requesterName || loggedInDonor?.fullName || '',
      requesterPhone: prev.requesterPhone || loggedInDonor?.mobile || '',
      requesterEmail: prev.requesterEmail || loggedInDonor?.email || '',
      city: prev.city || target.city,
    }));
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactDonor) return;
    const validation = validateContactRequest({
      donorId: contactDonor.id,
      ...contactForm,
    });
    if (!validation.valid) {
      setContactErrors(validation.errors);
      return;
    }

    setContactSubmitting(true);
    setContactErrors({});
    try {
      const res = await apiRequest<{ request: ContactRequest; message: string }>('/api/requests', {
        method: 'POST',
        body: {
          donorId: contactDonor.id,
          ...contactForm,
          unitsNeeded: Number(contactForm.unitsNeeded),
        },
      });
      setCreatedRequest(res.request);
      notify(res.message, 'success');
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setContactErrors(err.errors);
      } else {
        notify(err instanceof Error ? err.message : 'Failed to send request.', 'error');
      }
    } finally {
      setContactSubmitting(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDonor) return;
    if (reportDetails.trim().length < 10) {
      notify('Please describe the issue in at least 10 characters.', 'error');
      return;
    }
    setReportSubmitting(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/reports', {
        method: 'POST',
        body: {
          donorId: reportDonor.id,
          reason: reportReason,
          details: reportDetails.trim(),
          reporterEmail: reportEmail.trim(),
        },
      });
      notify(res.message, 'success');
      setReportDonor(null);
      setReportDetails('');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to submit report.', 'error');
    } finally {
      setReportSubmitting(false);
    }
  };

  const availableDistricts = state ? STATES_DISTRICTS[state] ?? [] : [];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8 border-b border-[#E5E7EB]">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#172B3A]">Find Blood Donors</h1>
          <p className="mt-2 text-sm sm:text-base text-[#5B6875] max-w-2xl">
            Search registered donors by blood group, location, and availability. Personal phone
            numbers remain private until a donor accepts your contact request.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('/emergency')}
          className="rounded-lg border border-[#C94C4C] bg-white px-4 py-2 text-sm font-medium text-[#C94C4C] hover:bg-[#C94C4C]/5 transition-colors whitespace-nowrap shrink-0"
        >
          Emergency Request &amp; Tracker
        </button>
      </div>

      {/* Filter Form */}
      <form
        onSubmit={handleSearchSubmit}
        className="mt-8 rounded-xl border border-[#E5E7EB] bg-white p-6"
      >
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#172B3A]">
            <SlidersHorizontal className="h-4 w-4 text-[#168C8C]" aria-hidden="true" />
            <span>Search Filters</span>
          </div>
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs font-medium text-[#5B6875] hover:text-[#172B3A] underline underline-offset-2"
          >
            Clear Filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label htmlFor="filter-blood-group" className="block text-xs font-medium text-[#303B46] mb-1.5">
              Blood Group
            </label>
            <select
              id="filter-blood-group"
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A]"
            >
              <option value="">All Blood Groups</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-state" className="block text-xs font-medium text-[#303B46] mb-1.5">
              State
            </label>
            <select
              id="filter-state"
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setDistrict('');
              }}
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A]"
            >
              <option value="">All States</option>
              {Object.keys(STATES_DISTRICTS).map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-district" className="block text-xs font-medium text-[#303B46] mb-1.5">
              District
            </label>
            <select
              id="filter-district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              disabled={!state}
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A] disabled:bg-[#F8FAFC] disabled:text-[#5B6875]"
            >
              <option value="">{state ? 'All Districts' : 'Select state first'}</option>
              {availableDistricts.map((dist) => (
                <option key={dist} value={dist}>
                  {dist}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-city" className="block text-xs font-medium text-[#303B46] mb-1.5">
              City
            </label>
            <input
              id="filter-city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g., Bengaluru, Mumbai, Chennai"
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A] placeholder:text-[#5B6875]/70"
            />
          </div>

          <div>
            <label htmlFor="filter-area" className="block text-xs font-medium text-[#303B46] mb-1.5">
              Area or Pincode
            </label>
            <input
              id="filter-area"
              type="text"
              value={areaPincode}
              onChange={(e) => setAreaPincode(e.target.value)}
              placeholder="e.g., Indiranagar or 560038"
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A] placeholder:text-[#5B6875]/70"
            />
          </div>

          <div>
            <label htmlFor="filter-availability" className="block text-xs font-medium text-[#303B46] mb-1.5">
              Availability Status
            </label>
            <select
              id="filter-availability"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A]"
            >
              <option value="">Any Availability</option>
              {AVAILABILITY_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Nearest location + sorting row */}
        <div className="mt-5 pt-5 border-t border-[#E5E7EB] flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
            <div>
              <label htmlFor="filter-near" className="block text-xs font-medium text-[#303B46] mb-1.5">
                Prioritize Nearest Location (Pincode/City)
              </label>
              <input
                id="filter-near"
                type="text"
                value={nearPincode}
                onChange={(e) => {
                  setNearPincode(e.target.value);
                  if (e.target.value.trim()) setSortBy('nearest');
                }}
                placeholder="Enter your pincode (e.g., 560038)"
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A] placeholder:text-[#5B6875]/70"
              />
            </div>

            <div>
              <label htmlFor="filter-sort" className="block text-xs font-medium text-[#303B46] mb-1.5">
                Sort Results
              </label>
              <select
                id="filter-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'recent' | 'location' | 'nearest')}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A]"
              >
                <option value="recent">Recently Updated</option>
                <option value="location">Location (State / City A–Z)</option>
                <option value="nearest">Nearest Location</option>
              </select>
            </div>

            <div className="flex items-center pt-5">
              <label className="inline-flex items-center gap-2 text-sm text-[#303B46] cursor-pointer">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-[#E5E7EB] text-[#168C8C] focus:ring-[#168C8C]"
                />
                <span>Verified donors only</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C94C4C] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#B13E3E] transition-colors whitespace-nowrap shrink-0"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span>Find Donors</span>
          </button>
        </div>
      </form>

      {/* Results Header */}
      <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-sm font-medium text-[#172B3A] tabular-nums" data-testid="donor-results-count">
          {loading
            ? 'Searching donor directory…'
            : `${total} matching ${total === 1 ? 'donor' : 'donors'} found`}
        </p>
        {bloodGroup && BLOOD_COMPATIBILITY[bloodGroup as keyof typeof BLOOD_COMPATIBILITY] && (
          <p className="text-xs text-[#5B6875]">
            Medical reference: {bloodGroup} recipients may receive from{' '}
            <span className="font-mono font-medium text-[#172B3A]">
              {BLOOD_COMPATIBILITY[bloodGroup as keyof typeof BLOOD_COMPATIBILITY].canReceiveFrom.join(', ')}
            </span>{' '}
            (confirm with hospital blood bank).
          </p>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="mt-6 rounded-xl border border-[#C94C4C]/30 bg-white p-6 text-sm text-[#C94C4C]">
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="rounded-xl border border-[#E5E7EB] bg-white p-5 animate-pulse">
              <div className="h-5 w-2/3 rounded bg-[#E5E7EB]" />
              <div className="mt-3 h-4 w-1/2 rounded bg-[#E5E7EB]" />
              <div className="mt-6 h-9 w-full rounded-lg bg-[#F8FAFC]" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && donors.length === 0 && (
        <div className="mt-6 rounded-xl border border-[#E5E7EB] bg-white p-12 text-center">
          <Search className="mx-auto h-9 w-9 text-[#5B6875]" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold text-[#172B3A]">No matching donors found</h2>
          <p className="mt-2 text-sm text-[#5B6875] max-w-md mx-auto">
            Try widening your city, area, or availability filters, or submit an emergency blood
            request so nearby coordinators can respond.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-lg bg-[#172B3A] px-4 py-2 text-sm font-medium text-white hover:bg-[#233E52]"
            >
              Reset All Filters
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/emergency')}
              className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#303B46] hover:bg-[#F8FAFC]"
            >
              Submit Emergency Request
            </button>
          </div>
        </div>
      )}

      {/* Donor Result Cards */}
      {!loading && !error && donors.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {donors.map((donor) => {
            const isAvailable = donor.availabilityStatus === 'Available';
            return (
              <article
                key={donor.id}
                className="flex flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-5 transition-colors hover:border-[#172B3A]/40"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold text-[#172B3A] truncate">
                        {donor.fullName}
                      </h2>
                      <p className="mt-0.5 text-xs text-[#5B6875] tabular-nums">
                        Age {donor.age} · {donor.gender}
                        {donor.verified ? ' · Verified profile' : ''}
                      </p>
                    </div>
                    <div className="flex h-11 w-12 shrink-0 items-center justify-center rounded-lg border border-[#C94C4C]/25 bg-[#C94C4C]/8 font-mono text-base font-semibold text-[#C94C4C]">
                      {donor.bloodGroup}
                    </div>
                  </div>

                  <dl className="mt-4 space-y-2 text-sm text-[#303B46]">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-[#5B6875] shrink-0 mt-0.5" aria-hidden="true" />
                      <dd className="text-sm">
                        {donor.city}, {donor.district}
                        <span className="block text-xs text-[#5B6875]">
                          {donor.areaPincode} · {donor.state}
                        </span>
                      </dd>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#E5E7EB]/80 text-xs">
                      <span className="text-[#5B6875]">Availability</span>
                      <span
                        className={`font-semibold ${
                          isAvailable ? 'text-[#168C8C]' : 'text-[#5B6875]'
                        }`}
                      >
                        {donor.availabilityStatus}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#5B6875]">Last Donation</span>
                      <span className="text-[#303B46] tabular-nums">
                        {donor.lastDonationDate
                          ? new Date(donor.lastDonationDate).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'Not shared'}
                      </span>
                    </div>
                  </dl>
                </div>

                <div className="mt-5 pt-4 border-t border-[#E5E7EB] flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => openContactModal(donor)}
                    aria-label={`Contact ${donor.fullName}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#172B3A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#233E52] transition-colors whitespace-nowrap"
                  >
                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Contact</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileDonor(donor)}
                    aria-label={`View profile of ${donor.fullName}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#172B3A] hover:bg-[#F8FAFC] transition-colors whitespace-nowrap"
                  >
                    <User className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>View Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportDonor(donor)}
                    aria-label={`Report record for ${donor.fullName}`}
                    title="Report outdated or inaccurate record"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#5B6875] hover:text-[#C94C4C] hover:border-[#C94C4C]/40 transition-colors shrink-0"
                  >
                    <Flag className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* View Donor Profile Modal */}
      {profileDonor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#172B3A]/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="donor-profile-title"
        >
          <div className="w-full max-w-lg rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="donor-profile-title" className="text-xl font-bold text-[#172B3A]">
                  {profileDonor.fullName}
                </h2>
                <p className="mt-1 text-xs text-[#5B6875]">
                  {profileDonor.verified ? 'Admin-verified donor record' : 'Standard donor record'}
                  {profileDonor.isDemo ? ' · Demonstration sample entry' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProfileDonor(null)}
                aria-label="Close donor profile"
                className="rounded-lg p-1.5 text-[#5B6875] hover:bg-[#F8FAFC] hover:text-[#172B3A]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-sm">
              <div>
                <p className="text-xs text-[#5B6875]">Blood Group</p>
                <p className="mt-0.5 font-mono text-xl font-semibold text-[#C94C4C]">
                  {profileDonor.bloodGroup}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#5B6875]">Availability Status</p>
                <p className="mt-1 font-semibold text-[#168C8C]">
                  {profileDonor.availabilityStatus}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#5B6875]">Age &amp; Gender</p>
                <p className="mt-0.5 font-medium text-[#172B3A] tabular-nums">
                  {profileDonor.age} years · {profileDonor.gender}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#5B6875]">Last Donation</p>
                <p className="mt-0.5 font-medium text-[#172B3A] tabular-nums">
                  {profileDonor.lastDonationDate
                    ? `${new Date(profileDonor.lastDonationDate).toLocaleDateString('en-IN')} (${daysSinceDonation(profileDonor.lastDonationDate)}d ago)`
                    : 'Not shared'}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2.5 text-sm text-[#303B46]">
              <p className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-[#168C8C] shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  {profileDonor.areaPincode}, {profileDonor.city}, {profileDonor.district},{' '}
                  {profileDonor.state}
                </span>
              </p>
              <p className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-[#5B6875] shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-xs text-[#5B6875]">
                  Profile last updated{' '}
                  {new Date(profileDonor.updatedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </p>
            </div>

            <div className="mt-5 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3.5 text-xs leading-relaxed text-[#5B6875]">
              <strong className="font-semibold text-[#172B3A]">Privacy &amp; Medical Note:</strong>{' '}
              Phone numbers are withheld until the donor accepts your contact request. Always verify
              donor eligibility and blood compatibility directly at a licensed hospital blood bank.
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setProfileDonor(null)}
                className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#303B46] hover:bg-[#F8FAFC]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const chosen = profileDonor;
                  setProfileDonor(null);
                  openContactModal(chosen);
                }}
                className="rounded-lg bg-[#C94C4C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B13E3E]"
              >
                Request Contact
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Consent-Based Contact Request Modal */}
      {contactDonor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#172B3A]/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-request-title"
        >
          <div className="w-full max-w-lg rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="contact-request-title" className="text-xl font-bold text-[#172B3A]">
                  {createdRequest ? 'Contact Request Sent' : `Request Contact: ${contactDonor.fullName}`}
                </h2>
                <p className="mt-1 text-xs text-[#5B6875]">
                  Blood Group {contactDonor.bloodGroup} · {contactDonor.city}, {contactDonor.district}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setContactDonor(null)}
                aria-label="Close contact request modal"
                className="rounded-lg p-1.5 text-[#5B6875] hover:bg-[#F8FAFC] hover:text-[#172B3A]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createdRequest ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-[#168C8C]/30 bg-[#168C8C]/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#168C8C]">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>Request queued for donor consent</span>
                  </div>
                  <p className="mt-2 text-sm text-[#303B46]">
                    Save your tracking code to monitor when{' '}
                    <strong>{createdRequest.donorName}</strong> accepts and shares their contact
                    details:
                  </p>
                  <p
                    className="mt-3 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 font-mono text-lg font-semibold text-[#172B3A] tracking-wider text-center"
                    data-testid="created-tracking-code"
                  >
                    {createdRequest.trackingCode}
                  </p>
                </div>

                <p className="text-xs leading-relaxed text-[#5B6875]">
                  Once the donor approves this request in their dashboard, their mobile number and
                  email will appear automatically when you look up this code in the Request Tracker.
                </p>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setContactDonor(null)}
                    className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#303B46]"
                  >
                    Back to Search
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const code = createdRequest.trackingCode;
                      setContactDonor(null);
                      onNavigate(`/emergency?track=${encodeURIComponent(code)}`);
                    }}
                    className="rounded-lg bg-[#172B3A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#233E52]"
                  >
                    Track Request Status
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="mt-5 space-y-4" noValidate>
                <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-xs text-[#5B6875] flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#168C8C] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Your details are sent securely to the donor. They can accept or decline before
                    any phone number is exchanged.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="req-name" className="block text-xs font-medium text-[#303B46] mb-1">
                      Your Full Name *
                    </label>
                    <input
                      id="req-name"
                      type="text"
                      value={contactForm.requesterName}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, requesterName: e.target.value })
                      }
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                    />
                    {contactErrors.requesterName && (
                      <p className="mt-1 text-xs text-[#C94C4C]">{contactErrors.requesterName}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="req-phone" className="block text-xs font-medium text-[#303B46] mb-1">
                      Your Mobile Number *
                    </label>
                    <input
                      id="req-phone"
                      type="tel"
                      value={contactForm.requesterPhone}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, requesterPhone: e.target.value })
                      }
                      placeholder="10-digit mobile"
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                    />
                    {contactErrors.requesterPhone && (
                      <p className="mt-1 text-xs text-[#C94C4C]">{contactErrors.requesterPhone}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="req-email" className="block text-xs font-medium text-[#303B46] mb-1">
                      Email Address *
                    </label>
                    <input
                      id="req-email"
                      type="email"
                      value={contactForm.requesterEmail}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, requesterEmail: e.target.value })
                      }
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                    />
                    {contactErrors.requesterEmail && (
                      <p className="mt-1 text-xs text-[#C94C4C]">{contactErrors.requesterEmail}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="req-hospital" className="block text-xs font-medium text-[#303B46] mb-1">
                      Hospital / Blood Bank *
                    </label>
                    <input
                      id="req-hospital"
                      type="text"
                      value={contactForm.hospitalName}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, hospitalName: e.target.value })
                      }
                      placeholder="Hospital name"
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                    />
                    {contactErrors.hospitalName && (
                      <p className="mt-1 text-xs text-[#C94C4C]">{contactErrors.hospitalName}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label htmlFor="req-city" className="block text-xs font-medium text-[#303B46] mb-1">
                      City *
                    </label>
                    <input
                      id="req-city"
                      type="text"
                      value={contactForm.city}
                      onChange={(e) => setContactForm({ ...contactForm, city: e.target.value })}
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                    />
                    {contactErrors.city && (
                      <p className="mt-1 text-xs text-[#C94C4C]">{contactErrors.city}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="req-units" className="block text-xs font-medium text-[#303B46] mb-1">
                      Units Needed *
                    </label>
                    <input
                      id="req-units"
                      type="number"
                      min={1}
                      max={10}
                      value={contactForm.unitsNeeded}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, unitsNeeded: e.target.value })
                      }
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A] tabular-nums"
                    />
                    {contactErrors.unitsNeeded && (
                      <p className="mt-1 text-xs text-[#C94C4C]">{contactErrors.unitsNeeded}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="req-urgency" className="block text-xs font-medium text-[#303B46] mb-1">
                      Urgency *
                    </label>
                    <select
                      id="req-urgency"
                      value={contactForm.urgency}
                      onChange={(e) => setContactForm({ ...contactForm, urgency: e.target.value })}
                      className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A]"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Urgent">Urgent</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="req-message" className="block text-xs font-medium text-[#303B46] mb-1">
                    Brief Medical Requirement Note *
                  </label>
                  <textarea
                    id="req-message"
                    rows={3}
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    placeholder="Share timing, ward/blood bank desk info, and any helpful coordination context."
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                  />
                  {contactErrors.message && (
                    <p className="mt-1 text-xs text-[#C94C4C]">{contactErrors.message}</p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setContactDonor(null)}
                    className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#303B46]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={contactSubmitting}
                    className="rounded-lg bg-[#C94C4C] px-5 py-2 text-sm font-semibold text-white hover:bg-[#B13E3E] disabled:opacity-60"
                  >
                    {contactSubmitting ? 'Sending Request…' : 'Send Contact Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Report Outdated / Inaccurate Record Modal */}
      {reportDonor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#172B3A]/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-record-title"
        >
          <div className="w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="report-record-title" className="text-lg font-bold text-[#172B3A]">
                  Report Record: {reportDonor.fullName}
                </h2>
                <p className="mt-1 text-xs text-[#5B6875]">
                  Flag outdated availability, incorrect blood group, or inappropriate details for
                  admin review.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportDonor(null)}
                aria-label="Close report modal"
                className="rounded-lg p-1.5 text-[#5B6875] hover:bg-[#F8FAFC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleReportSubmit} className="mt-4 space-y-3.5">
              <div>
                <label htmlFor="report-reason" className="block text-xs font-medium text-[#303B46] mb-1">
                  Reason
                </label>
                <select
                  id="report-reason"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A]"
                >
                  <option value="Outdated Contact Info">Outdated Contact Info</option>
                  <option value="Inaccurate Blood Group">Inaccurate Blood Group</option>
                  <option value="Duplicate Record">Duplicate Record</option>
                  <option value="Inappropriate Behaviour">Inappropriate Behaviour</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="report-email" className="block text-xs font-medium text-[#303B46] mb-1">
                  Your Email (optional)
                </label>
                <input
                  id="report-email"
                  type="email"
                  value={reportEmail}
                  onChange={(e) => setReportEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                />
              </div>

              <div>
                <label htmlFor="report-details" className="block text-xs font-medium text-[#303B46] mb-1">
                  Details *
                </label>
                <textarea
                  id="report-details"
                  rows={3}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Describe why this record should be reviewed by administrators."
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReportDonor(null)}
                  className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#303B46]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reportSubmitting}
                  className="rounded-lg bg-[#172B3A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#233E52] disabled:opacity-60"
                >
                  {reportSubmitting ? 'Submitting…' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
