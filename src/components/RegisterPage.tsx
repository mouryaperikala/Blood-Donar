import React, { useState } from 'react';
import { CheckCircle2, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ApiError } from '../lib/api';
import {
  AVAILABILITY_STATUSES,
  BLOOD_GROUPS,
  GENDERS,
  STATES_DISTRICTS,
  validateDonorRegistration,
} from '../shared/validation';

interface RegisterPageProps {
  onNavigate: (path: string) => void;
}

export function RegisterPage({ onNavigate }: RegisterPageProps) {
  const { registerDonor } = useAuth();
  const { notify } = useToast();

  const [form, setForm] = useState({
    fullName: '',
    age: '',
    gender: 'Male',
    bloodGroup: '',
    mobile: '',
    email: '',
    state: '',
    district: '',
    city: '',
    areaPincode: '',
    lastDonationDate: '',
    availabilityStatus: 'Available',
    password: '',
    confirmPassword: '',
    contactConsent: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registeredName, setRegisteredName] = useState<string | null>(null);

  const districts = form.state ? STATES_DISTRICTS[form.state] ?? [] : [];

  const updateField = (field: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const validation = validateDonorRegistration(form, { requirePassword: true });
    if (!validation.valid) {
      setErrors(validation.errors);
      setFormError('Please review the highlighted fields before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const donor = await registerDonor(form);
      setRegisteredName(donor.fullName);
      notify('Donor registration complete. Welcome to BloodConnect.', 'success');
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setErrors(err.errors);
        setFormError(err.message);
      } else {
        setFormError(err instanceof Error ? err.message : 'Unable to complete registration.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (registeredName) {
    return (
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-16">
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#168C8C]/10 text-[#168C8C]">
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-[#172B3A]">Registration Successful</h1>
          <p className="mt-2.5 text-sm leading-relaxed text-[#5B6875]">
            Thank you, <strong className="text-[#172B3A]">{registeredName}</strong>. Your donor
            profile is active in the directory and your personal phone number remains hidden until
            you approve a contact request.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/dashboard')}
              className="rounded-lg bg-[#172B3A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#233E52]"
            >
              Open Donor Dashboard
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/find-donors')}
              className="rounded-lg border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-medium text-[#303B46] hover:bg-[#F8FAFC]"
            >
              Search Donors
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="pb-6 border-b border-[#E5E7EB]">
        <h1 className="text-3xl font-bold tracking-tight text-[#172B3A]">
          Become a Blood Donor
        </h1>
        <p className="mt-2 text-sm sm:text-base text-[#5B6875]">
          Register your profile so nearby patients and hospitals can reach you through our
          consent-based contact request workflow.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-8 rounded-xl border border-[#E5E7EB] bg-white p-6 sm:p-8 space-y-8"
      >
        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-[#C94C4C]/30 bg-[#C94C4C]/5 px-4 py-3 text-sm text-[#C94C4C]"
          >
            {formError}
          </div>
        )}

        {/* Section 1: Personal & Clinical Basics */}
        <div>
          <h2 className="text-base font-semibold text-[#172B3A]">01. Personal &amp; Blood Group Details</h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="reg-fullName" className="block text-xs font-medium text-[#303B46] mb-1.5">
                Full Name *
              </label>
              <input
                id="reg-fullName"
                type="text"
                value={form.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                placeholder="Enter your full name"
                className="w-full rounded-lg border border-[#E5E7EB] px-3.5 py-2.5 text-sm text-[#172B3A]"
              />
              {errors.fullName && <p className="mt-1 text-xs text-[#C94C4C]">{errors.fullName}</p>}
            </div>

            <div>
              <label htmlFor="reg-age" className="block text-xs font-medium text-[#303B46] mb-1.5">
                Age (18–65) *
              </label>
              <input
                id="reg-age"
                type="number"
                min={18}
                max={65}
                value={form.age}
                onChange={(e) => updateField('age', e.target.value)}
                placeholder="e.g., 28"
                className="w-full rounded-lg border border-[#E5E7EB] px-3.5 py-2.5 text-sm text-[#172B3A] tabular-nums"
              />
              {errors.age && <p className="mt-1 text-xs text-[#C94C4C]">{errors.age}</p>}
            </div>

            <div>
              <label htmlFor="reg-gender" className="block text-xs font-medium text-[#303B46] mb-1.5">
                Gender *
              </label>
              <select
                id="reg-gender"
                value={form.gender}
                onChange={(e) => updateField('gender', e.target.value)}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#172B3A]"
              >
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              {errors.gender && <p className="mt-1 text-xs text-[#C94C4C]">{errors.gender}</p>}
            </div>

            <div>
              <label htmlFor="reg-bloodGroup" className="block text-xs font-medium text-[#303B46] mb-1.5">
                Blood Group *
              </label>
              <select
                id="reg-bloodGroup"
                value={form.bloodGroup}
                onChange={(e) => updateField('bloodGroup', e.target.value)}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#172B3A]"
              >
                <option value="">Select Blood Group</option>
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
              <label htmlFor="reg-availability" className="block text-xs font-medium text-[#303B46] mb-1.5">
                Availability Status *
              </label>
              <select
                id="reg-availability"
                value={form.availabilityStatus}
                onChange={(e) => updateField('availabilityStatus', e.target.value)}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#172B3A]"
              >
                {AVAILABILITY_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              {errors.availabilityStatus && (
                <p className="mt-1 text-xs text-[#C94C4C]">{errors.availabilityStatus}</p>
              )}
            </div>

            <div>
              <label htmlFor="reg-lastDonation" className="block text-xs font-medium text-[#303B46] mb-1.5">
                Last Donation Date (optional)
              </label>
              <input
                id="reg-lastDonation"
                type="date"
                value={form.lastDonationDate}
                onChange={(e) => updateField('lastDonationDate', e.target.value)}
                className="w-full rounded-lg border border-[#E5E7EB] px-3.5 py-2.5 text-sm text-[#172B3A]"
              />
              {errors.lastDonationDate && (
                <p className="mt-1 text-xs text-[#C94C4C]">{errors.lastDonationDate}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Contact & Location */}
        <div className="pt-6 border-t border-[#E5E7EB]">
          <h2 className="text-base font-semibold text-[#172B3A]">02. Contact &amp; Location Details</h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reg-mobile" className="block text-xs font-medium text-[#303B46] mb-1.5">
                Mobile Number *
              </label>
              <input
                id="reg-mobile"
                type="tel"
                value={form.mobile}
                onChange={(e) => updateField('mobile', e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full rounded-lg border border-[#E5E7EB] px-3.5 py-2.5 text-sm text-[#172B3A] tabular-nums"
              />
              {errors.mobile && <p className="mt-1 text-xs text-[#C94C4C]">{errors.mobile}</p>}
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-xs font-medium text-[#303B46] mb-1.5">
                Email Address *
              </label>
              <input
                id="reg-email"
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-[#E5E7EB] px-3.5 py-2.5 text-sm text-[#172B3A]"
              />
              {errors.email && <p className="mt-1 text-xs text-[#C94C4C]">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="reg-state" className="block text-xs font-medium text-[#303B46] mb-1.5">
                State *
              </label>
              <select
                id="reg-state"
                value={form.state}
                onChange={(e) => {
                  updateField('state', e.target.value);
                  updateField('district', '');
                }}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#172B3A]"
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
              <label htmlFor="reg-district" className="block text-xs font-medium text-[#303B46] mb-1.5">
                District *
              </label>
              <select
                id="reg-district"
                value={form.district}
                onChange={(e) => updateField('district', e.target.value)}
                disabled={!form.state}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#172B3A] disabled:bg-[#F8FAFC]"
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
              <label htmlFor="reg-city" className="block text-xs font-medium text-[#303B46] mb-1.5">
                City *
              </label>
              <input
                id="reg-city"
                type="text"
                value={form.city}
                onChange={(e) => updateField('city', e.target.value)}
                placeholder="e.g., Bengaluru"
                className="w-full rounded-lg border border-[#E5E7EB] px-3.5 py-2.5 text-sm text-[#172B3A]"
              />
              {errors.city && <p className="mt-1 text-xs text-[#C94C4C]">{errors.city}</p>}
            </div>

            <div>
              <label htmlFor="reg-areaPincode" className="block text-xs font-medium text-[#303B46] mb-1.5">
                Area / Pincode *
              </label>
              <input
                id="reg-areaPincode"
                type="text"
                value={form.areaPincode}
                onChange={(e) => updateField('areaPincode', e.target.value)}
                placeholder="e.g., Koramangala, 560034"
                className="w-full rounded-lg border border-[#E5E7EB] px-3.5 py-2.5 text-sm text-[#172B3A]"
              />
              {errors.areaPincode && (
                <p className="mt-1 text-xs text-[#C94C4C]">{errors.areaPincode}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Account Security & Consent */}
        <div className="pt-6 border-t border-[#E5E7EB]">
          <h2 className="text-base font-semibold text-[#172B3A]">03. Account Password &amp; Privacy Consent</h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reg-password" className="block text-xs font-medium text-[#303B46] mb-1.5">
                Password (min. 8 characters) *
              </label>
              <input
                id="reg-password"
                type="password"
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                placeholder="Create a secure password"
                className="w-full rounded-lg border border-[#E5E7EB] px-3.5 py-2.5 text-sm text-[#172B3A]"
              />
              {errors.password && <p className="mt-1 text-xs text-[#C94C4C]">{errors.password}</p>}
            </div>

            <div>
              <label htmlFor="reg-confirmPassword" className="block text-xs font-medium text-[#303B46] mb-1.5">
                Confirm Password *
              </label>
              <input
                id="reg-confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                placeholder="Re-enter password"
                className="w-full rounded-lg border border-[#E5E7EB] px-3.5 py-2.5 text-sm text-[#172B3A]"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-[#C94C4C]">{errors.confirmPassword}</p>
              )}
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                id="reg-consent"
                type="checkbox"
                checked={form.contactConsent}
                onChange={(e) => updateField('contactConsent', e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#E5E7EB] text-[#168C8C] focus:ring-[#168C8C]"
              />
              <span className="text-xs leading-relaxed text-[#303B46]">
                I consent to list my name, blood group, city/district, and availability status in
                the BloodConnect directory. I understand my mobile number and email remain hidden
                publicly and will only be shared with a requester if I explicitly accept their
                contact request. I also acknowledge that donation eligibility and blood
                compatibility must be confirmed directly at a licensed medical facility.
              </span>
            </label>
            {errors.contactConsent && (
              <p className="mt-2 text-xs text-[#C94C4C]">{errors.contactConsent}</p>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs text-[#5B6875] flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-[#168C8C] shrink-0" aria-hidden="true" />
            <span>Passwords are salted and hashed securely on the server.</span>
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-[#303B46] hover:bg-[#F8FAFC] whitespace-nowrap"
            >
              Already Registered? Login
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C94C4C] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#B13E3E] disabled:opacity-60 whitespace-nowrap"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              <span>{submitting ? 'Registering…' : 'Complete Registration'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
