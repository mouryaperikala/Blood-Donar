import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  MapPin,
  Phone,
  Search,
  Send,
  Mail,
} from 'lucide-react';
import { apiRequest, ApiError } from '../lib/api';
import { useToast } from '../context/ToastContext';
import {
  BLOOD_GROUPS,
  STATES_DISTRICTS,
  validateEmergencyRequest,
} from '../shared/validation';
import type { ContactRequest, EmergencyRequest } from '../shared/types';

interface EmergencyPageProps {
  initialQuery: URLSearchParams;
  onNavigate: (path: string) => void;
}

type TrackResult =
  | { type: 'contact'; request: ContactRequest }
  | { type: 'emergency'; request: EmergencyRequest };

export function EmergencyPage({ initialQuery, onNavigate }: EmergencyPageProps) {
  const { notify } = useToast();

  // Status tracker
  const [trackCode, setTrackCode] = useState(initialQuery.get('track') || '');
  const [trackResult, setTrackResult] = useState<TrackResult | null>(null);
  const [trackError, setTrackError] = useState('');
  const [tracking, setTracking] = useState(false);

  // Active emergencies list
  const [emergencies, setEmergencies] = useState<EmergencyRequest[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Submit emergency request form
  const defaultDate = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10);
  const [form, setForm] = useState({
    patientName: '',
    requesterName: '',
    requesterPhone: '',
    bloodGroup: '',
    unitsRequired: '1',
    hospitalName: '',
    state: '',
    district: '',
    city: '',
    urgency: 'Urgent',
    requiredByDate: defaultDate,
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const loadEmergencies = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await apiRequest<{ requests: EmergencyRequest[] }>('/api/emergency');
      setEmergencies(res.requests);
    } catch {
      // Quietly keep empty list on transient error
    } finally {
      setLoadingList(false);
    }
  }, []);

  const runTrackingLookup = useCallback(async (codeToCheck: string) => {
    const cleaned = codeToCheck.trim().toUpperCase();
    if (!cleaned) {
      setTrackError('Please enter a tracking code (e.g., BC-REQ-7910C2 or BC-EMG-9041D2).');
      return;
    }
    setTracking(true);
    setTrackError('');
    setTrackResult(null);
    try {
      const res = await apiRequest<TrackResult>(
        `/api/requests/track/${encodeURIComponent(cleaned)}`
      );
      setTrackResult(res);
    } catch (err) {
      setTrackError(err instanceof Error ? err.message : 'Tracking code not found.');
    } finally {
      setTracking(false);
    }
  }, []);

  useEffect(() => {
    void loadEmergencies();
  }, [loadEmergencies]);

  useEffect(() => {
    const initial = initialQuery.get('track');
    if (initial) {
      setTrackCode(initial);
      void runTrackingLookup(initial);
    }
  }, [initialQuery, runTrackingLookup]);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runTrackingLookup(trackCode);
  };

  const handleEmergencySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateEmergencyRequest(form);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      const res = await apiRequest<{ trackingCode: string; message: string }>('/api/emergency', {
        method: 'POST',
        body: {
          ...form,
          unitsRequired: Number(form.unitsRequired),
        },
      });
      setCreatedCode(res.trackingCode);
      setTrackCode(res.trackingCode);
      notify(res.message, 'success');
      setForm({
        patientName: '',
        requesterName: '',
        requesterPhone: '',
        bloodGroup: '',
        unitsRequired: '1',
        hospitalName: '',
        state: '',
        district: '',
        city: '',
        urgency: 'Urgent',
        requiredByDate: defaultDate,
        notes: '',
      });
      await loadEmergencies();
      await runTrackingLookup(res.trackingCode);
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setErrors(err.errors);
      } else {
        notify(err instanceof Error ? err.message : 'Unable to submit emergency request.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const districts = form.state ? STATES_DISTRICTS[form.state] ?? [] : [];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      <div className="pb-6 border-b border-[#E5E7EB]">
        <h1 className="text-3xl font-bold tracking-tight text-[#172B3A]">
          Emergency Blood Request &amp; Status Tracker
        </h1>
        <p className="mt-2 text-sm sm:text-base text-[#5B6875] max-w-2xl">
          Track the consent status of your donor contact requests or publish an urgent hospital
          blood need for community coordination.
        </p>
      </div>

      {/* Request Status Tracker */}
      <section className="rounded-xl border border-[#E5E7EB] bg-white p-6 sm:p-7">
        <h2 className="text-lg font-semibold text-[#172B3A]">Track Blood Request Status</h2>
        <p className="mt-1 text-xs text-[#5B6875]">
          Enter your Contact Request code (e.g., <span className="font-mono">BC-REQ-7910C2</span>{' '}
          for an accepted demo request) or Emergency code (
          <span className="font-mono">BC-EMG-9041D2</span>).
        </p>

        <form onSubmit={handleTrackSubmit} className="mt-4 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            aria-label="Request tracking code"
            value={trackCode}
            onChange={(e) => setTrackCode(e.target.value)}
            placeholder="Enter tracking code (e.g., BC-REQ-7910C2)"
            className="flex-1 rounded-lg border border-[#E5E7EB] px-4 py-2.5 font-mono text-sm text-[#172B3A] uppercase"
          />
          <button
            type="submit"
            disabled={tracking}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#172B3A] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#233E52] disabled:opacity-60 whitespace-nowrap"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span>{tracking ? 'Checking…' : 'Check Status'}</span>
          </button>
        </form>

        {trackError && (
          <p role="alert" className="mt-4 text-sm text-[#C94C4C]">
            {trackError}
          </p>
        )}

        {trackResult && trackResult.type === 'contact' && (
          <div className="mt-6 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs font-mono text-[#5B6875]">
                  Contact Request · {trackResult.request.trackingCode}
                </p>
                <h3 className="mt-1 text-base font-semibold text-[#172B3A]">
                  Donor: {trackResult.request.donorName} ({trackResult.request.donorBloodGroup})
                </h3>
                <p className="text-xs text-[#5B6875]">
                  Hospital: {trackResult.request.hospitalName}, {trackResult.request.city}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p
                  className={`text-sm font-semibold capitalize ${
                    trackResult.request.status === 'accepted' ||
                    trackResult.request.status === 'completed'
                      ? 'text-[#168C8C]'
                      : trackResult.request.status === 'declined'
                        ? 'text-[#5B6875]'
                        : 'text-[#C94C4C]'
                  }`}
                >
                  Status: {trackResult.request.status}
                </p>
                <p className="text-xs text-[#5B6875] tabular-nums">
                  Updated {new Date(trackResult.request.updatedAt).toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {trackResult.request.sharedDonorContact ? (
              <div className="rounded-lg border border-[#168C8C]/35 bg-white p-4">
                <p className="flex items-center gap-2 text-xs font-semibold text-[#168C8C]">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>Donor Approved Contact Sharing</span>
                </p>
                <div className="mt-2.5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#172B3A]">
                  <span className="inline-flex items-center gap-1.5 font-mono font-semibold tabular-nums">
                    <Phone className="h-4 w-4 text-[#168C8C]" aria-hidden="true" />
                    {trackResult.request.sharedDonorContact.mobile}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-[#168C8C]" aria-hidden="true" />
                    {trackResult.request.sharedDonorContact.email}
                  </span>
                </div>
                {trackResult.request.donorResponseNote && (
                  <p className="mt-2 text-xs text-[#5B6875]">
                    Donor note: &ldquo;{trackResult.request.donorResponseNote}&rdquo;
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#5B6875]">
                {trackResult.request.status === 'declined'
                  ? 'This donor was unable to accept at this time. Please search for another available donor nearby.'
                  : 'Waiting for donor review. Personal phone and email will appear here automatically if the donor accepts.'}
              </p>
            )}
          </div>
        )}

        {trackResult && trackResult.type === 'emergency' && (
          <div className="mt-6 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs font-mono text-[#5B6875]">
                  Emergency Blood Request · {trackResult.request.trackingCode}
                </p>
                <h3 className="mt-1 text-base font-semibold text-[#172B3A]">
                  {trackResult.request.bloodGroup} Needed ({trackResult.request.unitsRequired}{' '}
                  units) — {trackResult.request.hospitalName}
                </h3>
                <p className="text-xs text-[#5B6875]">
                  {trackResult.request.city}, {trackResult.request.district},{' '}
                  {trackResult.request.state} · Required by {trackResult.request.requiredByDate}
                </p>
              </div>
              <p className="text-sm font-semibold text-[#168C8C]">
                Status: {trackResult.request.status}
              </p>
            </div>
            {trackResult.request.notes && (
              <p className="mt-3 text-sm text-[#303B46]">{trackResult.request.notes}</p>
            )}
          </div>
        )}
      </section>

      {/* Emergency Form + Active Board */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Emergency Request Form */}
        <form
          onSubmit={handleEmergencySubmit}
          noValidate
          className="lg:col-span-7 rounded-xl border border-[#E5E7EB] bg-white p-6 space-y-5"
        >
          <div>
            <h2 className="text-lg font-semibold text-[#172B3A]">Submit Emergency Blood Request</h2>
            <p className="mt-1 text-xs text-[#5B6875]">
              Publish an urgent blood need with hospital details. You will receive a tracking code
              immediately.
            </p>
          </div>

          {createdCode && (
            <div className="rounded-lg border border-[#168C8C]/35 bg-[#168C8C]/5 p-4 text-sm text-[#172B3A]">
              Emergency request published. Tracking code:{' '}
              <strong className="font-mono">{createdCode}</strong>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="emg-patient" className="block text-xs font-medium text-[#303B46] mb-1">
                Patient Name *
              </label>
              <input
                id="emg-patient"
                type="text"
                value={form.patientName}
                onChange={(e) => setForm({ ...form, patientName: e.target.value })}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
              />
              {errors.patientName && (
                <p className="mt-1 text-xs text-[#C94C4C]">{errors.patientName}</p>
              )}
            </div>

            <div>
              <label htmlFor="emg-requester" className="block text-xs font-medium text-[#303B46] mb-1">
                Coordinator / Family Contact Name *
              </label>
              <input
                id="emg-requester"
                type="text"
                value={form.requesterName}
                onChange={(e) => setForm({ ...form, requesterName: e.target.value })}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
              />
              {errors.requesterName && (
                <p className="mt-1 text-xs text-[#C94C4C]">{errors.requesterName}</p>
              )}
            </div>

            <div>
              <label htmlFor="emg-phone" className="block text-xs font-medium text-[#303B46] mb-1">
                Coordinator Mobile Number *
              </label>
              <input
                id="emg-phone"
                type="tel"
                value={form.requesterPhone}
                onChange={(e) => setForm({ ...form, requesterPhone: e.target.value })}
                placeholder="10-digit mobile"
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
              />
              {errors.requesterPhone && (
                <p className="mt-1 text-xs text-[#C94C4C]">{errors.requesterPhone}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="emg-bg" className="block text-xs font-medium text-[#303B46] mb-1">
                  Blood Group *
                </label>
                <select
                  id="emg-bg"
                  value={form.bloodGroup}
                  onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A]"
                >
                  <option value="">Select</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
                {errors.bloodGroup && (
                  <p className="mt-1 text-xs text-[#C94C4C]">{errors.bloodGroup}</p>
                )}
              </div>

              <div>
                <label htmlFor="emg-units" className="block text-xs font-medium text-[#303B46] mb-1">
                  Units *
                </label>
                <input
                  id="emg-units"
                  type="number"
                  min={1}
                  max={15}
                  value={form.unitsRequired}
                  onChange={(e) => setForm({ ...form, unitsRequired: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A] tabular-nums"
                />
                {errors.unitsRequired && (
                  <p className="mt-1 text-xs text-[#C94C4C]">{errors.unitsRequired}</p>
                )}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="emg-hospital" className="block text-xs font-medium text-[#303B46] mb-1">
                Hospital &amp; Blood Bank Name *
              </label>
              <input
                id="emg-hospital"
                type="text"
                value={form.hospitalName}
                onChange={(e) => setForm({ ...form, hospitalName: e.target.value })}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
              />
              {errors.hospitalName && (
                <p className="mt-1 text-xs text-[#C94C4C]">{errors.hospitalName}</p>
              )}
            </div>

            <div>
              <label htmlFor="emg-state" className="block text-xs font-medium text-[#303B46] mb-1">
                State *
              </label>
              <select
                id="emg-state"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value, district: '' })}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A]"
              >
                <option value="">Select State</option>
                {Object.keys(STATES_DISTRICTS).map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              {errors.state && <p className="mt-1 text-xs text-[#C94C4C]">{errors.state}</p>}
            </div>

            <div>
              <label htmlFor="emg-district" className="block text-xs font-medium text-[#303B46] mb-1">
                District *
              </label>
              <select
                id="emg-district"
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
                disabled={!form.state}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A] disabled:bg-[#F8FAFC]"
              >
                <option value="">{form.state ? 'Select District' : 'Select state first'}</option>
                {districts.map((dist) => (
                  <option key={dist} value={dist}>
                    {dist}
                  </option>
                ))}
              </select>
              {errors.district && <p className="mt-1 text-xs text-[#C94C4C]">{errors.district}</p>}
            </div>

            <div>
              <label htmlFor="emg-city" className="block text-xs font-medium text-[#303B46] mb-1">
                City *
              </label>
              <input
                id="emg-city"
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
              />
              {errors.city && <p className="mt-1 text-xs text-[#C94C4C]">{errors.city}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="emg-urgency" className="block text-xs font-medium text-[#303B46] mb-1">
                  Urgency *
                </label>
                <select
                  id="emg-urgency"
                  value={form.urgency}
                  onChange={(e) => setForm({ ...form, urgency: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#172B3A]"
                >
                  <option value="Urgent">Urgent</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div>
                <label htmlFor="emg-date" className="block text-xs font-medium text-[#303B46] mb-1">
                  Required By *
                </label>
                <input
                  id="emg-date"
                  type="date"
                  value={form.requiredByDate}
                  onChange={(e) => setForm({ ...form, requiredByDate: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="emg-notes" className="block text-xs font-medium text-[#303B46] mb-1">
                Clinical / Ward Notes (optional)
              </label>
              <textarea
                id="emg-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Blood bank counter hours, replacement slip info, or doctor instructions."
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C94C4C] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#B13E3E] disabled:opacity-60"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            <span>{submitting ? 'Publishing Request…' : 'Publish Emergency Blood Request'}</span>
          </button>
        </form>

        {/* Active Emergency Board */}
        <div className="lg:col-span-5 rounded-xl border border-[#E5E7EB] bg-white p-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[#C94C4C]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[#172B3A]">
              Active Emergency Requirements
            </h2>
          </div>
          <p className="mt-1 text-xs text-[#5B6875]">
            Phone numbers are masked publicly. Search matching donors to assist immediately.
          </p>

          {loadingList ? (
            <p className="mt-6 text-sm text-[#5B6875]">Loading active requests…</p>
          ) : emergencies.length === 0 ? (
            <p className="mt-6 text-sm text-[#5B6875]">No active emergency requests right now.</p>
          ) : (
            <div className="mt-4 divide-y divide-[#E5E7EB]">
              {emergencies.map((item) => (
                <div key={item.id} className="py-4 first:pt-2 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#172B3A]">
                        <span className="font-mono text-[#C94C4C] mr-2">{item.bloodGroup}</span>
                        {item.hospitalName}
                      </p>
                      <p className="mt-0.5 text-xs text-[#5B6875] flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>
                          {item.city}, {item.district}
                        </span>
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-[#168C8C] shrink-0">
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[#303B46] tabular-nums">
                    {item.unitsRequired} unit(s) · {item.urgency} · Needed by {item.requiredByDate}
                  </p>
                  {item.notes && (
                    <p className="mt-1.5 text-xs text-[#5B6875] leading-relaxed">{item.notes}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono text-[#5B6875]">{item.trackingCode}</span>
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate(
                          `/find-donors?bloodGroup=${encodeURIComponent(item.bloodGroup)}&city=${encodeURIComponent(item.city)}`
                        )
                      }
                      className="font-semibold text-[#168C8C] hover:underline"
                    >
                      Find {item.bloodGroup} Donors →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
