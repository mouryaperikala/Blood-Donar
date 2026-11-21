import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  HeartPulse,
  Lock,
  MapPin,
  Search,
  ShieldCheck,
  UserPlus,
  AlertCircle,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { BLOOD_COMPATIBILITY, BLOOD_GROUPS } from '../shared/validation';
import type { BloodGroup, SystemStats } from '../shared/types';

interface HomePageProps {
  onNavigate: (path: string) => void;
}

const HERO_IMAGE = '/src/assets/images/hero_healthcare_clinic_1795228817710.jpg';
const SCREENING_IMAGE = '/src/assets/images/process_medical_screening_1795228816860.jpg';

export function HomePage({ onNavigate }: HomePageProps) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [processImgFailed, setProcessImgFailed] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest<SystemStats>('/api/stats')
      .then((data) => {
        if (active) setStats(data);
      })
      .catch(() => {
        // Non-blocking; homepage renders cleanly even if stats retry is needed
      });
    return () => {
      active = false;
    };
  }, []);

  const handleBloodGroupSelect = (group: BloodGroup) => {
    onNavigate(`/find-donors?bloodGroup=${encodeURIComponent(group)}`);
  };

  return (
    <div className="bg-[#F8FAFC]">
      {/* Hero Section */}
      <section className="bg-white border-b border-[#E5E7EB]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-sm font-medium text-[#168C8C]">
                Community Blood Donor Directory &amp; Coordination
              </p>
              <h1
                className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight text-[#172B3A] leading-[1.12]"
                style={{ textWrap: 'balance' }}
              >
                Every Drop Counts. Every Donor Matters.
              </h1>
              <p className="mt-5 text-base sm:text-lg leading-relaxed text-[#5B6875] max-w-xl">
                Find blood donors near you quickly and connect with people who can help save lives.
                Personal contact numbers stay protected until a donor consents to connect.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => onNavigate('/find-donors')}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C94C4C] px-6 py-3 text-sm font-semibold text-white hover:bg-[#B13E3E] transition-colors whitespace-nowrap shrink-0"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  <span>Find Blood Donors</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/register')}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#172B3A] bg-white px-6 py-3 text-sm font-semibold text-[#172B3A] hover:bg-[#F8FAFC] transition-colors whitespace-nowrap shrink-0"
                >
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  <span>Register as a Donor</span>
                </button>
              </div>

              <div className="mt-8 pt-6 border-t border-[#E5E7EB] flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-5 gap-y-2 text-xs text-[#5B6875]">
                <span>Consent-based contact sharing</span>
                <span className="hidden sm:inline" aria-hidden="true">·</span>
                <span>Location &amp; blood group search</span>
                <span className="hidden sm:inline" aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => onNavigate('/emergency')}
                  className="text-left font-semibold text-[#C94C4C] hover:underline"
                >
                  Submit Emergency Request &amp; Track Status
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[280px] sm:min-h-[340px] overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#172B3A]">
                {!heroImgFailed ? (
                  <img
                    src={HERO_IMAGE}
                    alt="Bright modern blood donation center with calm clinical seating and healthcare staff"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center text-white">
                    <HeartPulse className="h-12 w-12 text-[#C94C4C]" aria-hidden="true" />
                    <p className="mt-4 text-lg font-semibold">BloodConnect Care Network</p>
                    <p className="mt-1 text-sm text-white/75">
                      Privacy-protected donor coordination across 8 blood groups
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Blood Group Quick Search Cards */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#172B3A]">
              Search by Blood Group
            </h2>
            <p className="mt-2 text-sm sm:text-base text-[#5B6875]">
              Select a blood group to view active donors currently listed in the directory.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/find-donors')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#168C8C] hover:text-[#117171] whitespace-nowrap shrink-0"
          >
            <span>Open full search filters</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {BLOOD_GROUPS.map((group) => {
            const count = stats?.byBloodGroup?.[group] ?? 0;
            const info = BLOOD_COMPATIBILITY[group];
            return (
              <button
                key={group}
                type="button"
                onClick={() => handleBloodGroupSelect(group)}
                aria-label={`Search ${group} blood donors`}
                className="group flex flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-5 text-left transition-colors hover:border-[#172B3A] focus-visible:border-[#168C8C]"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-2xl sm:text-3xl font-semibold text-[#C94C4C] tabular-nums">
                    {group}
                  </span>
                  <span className="text-xs font-medium text-[#5B6875] tabular-nums">
                    {stats ? `${count} listed` : '—'}
                  </span>
                </div>
                <div className="mt-4 pt-3 border-t border-[#E5E7EB]/80 flex items-center justify-between gap-2">
                  <span className="text-xs text-[#5B6875] line-clamp-1">{info.note}</span>
                  <ArrowRight
                    className="h-3.5 w-3.5 text-[#5B6875] group-hover:text-[#172B3A] shrink-0 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Live & Demo Directory Statistics */}
      <section className="border-y border-[#E5E7EB] bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-[#172B3A]">
                Directory Snapshot
              </h2>
              <p className="mt-1.5 text-sm text-[#5B6875]">
                Counts reflect the current database records. Sample demonstration records are
                clearly separated from new registrations.
              </p>
            </div>
            <p className="text-xs text-[#5B6875] tabular-nums">
              {stats
                ? `Includes ${stats.demoDonors} demonstration sample records and ${stats.liveRegisteredDonors} newly registered donor${stats.liveRegisteredDonors === 1 ? '' : 's'}.`
                : 'Loading directory counts…'}
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-6">
              <p className="text-xs font-medium text-[#5B6875]">Registered Donors (Demo + Live)</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-[#172B3A] tabular-nums">
                {stats ? stats.totalDonors : '—'}
              </p>
              <p className="mt-1.5 text-xs text-[#5B6875] tabular-nums">
                {stats ? `${stats.availableDonors} currently available` : '—'}
              </p>
            </div>

            <div className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-6">
              <p className="text-xs font-medium text-[#5B6875]">Blood Groups Covered</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-[#172B3A] tabular-nums">
                {stats ? stats.bloodGroupCount : 8}
              </p>
              <p className="mt-1.5 text-xs text-[#5B6875]">All ABO and Rh types (A, B, AB, O)</p>
            </div>

            <div className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-6">
              <p className="text-xs font-medium text-[#5B6875]">Verified Donor Profiles</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-[#168C8C] tabular-nums">
                {stats ? stats.verifiedDonors : '—'}
              </p>
              <p className="mt-1.5 text-xs text-[#5B6875]">Reviewed by system administrators</p>
            </div>

            <div className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-6">
              <p className="text-xs font-medium text-[#5B6875]">Successful Connections (Demo + Live)</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-[#C94C4C] tabular-nums">
                {stats ? stats.successfulConnections : '—'}
              </p>
              <p className="mt-1.5 text-xs text-[#5B6875]">Consent-approved donor responses</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#172B3A]">
              How BloodConnect Works
            </h2>
            <p className="mt-3 text-sm sm:text-base leading-relaxed text-[#5B6875]">
              A straightforward workflow built to locate compatible donors without exposing private
              personal phone numbers on public pages.
            </p>
            <div className="mt-6 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
              {!processImgFailed ? (
                <img
                  src={SCREENING_IMAGE}
                  alt="Clean clinical blood typing setup and screening checklist on a medical desk"
                  referrerPolicy="no-referrer"
                  onError={() => setProcessImgFailed(true)}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="aspect-[4/3] flex items-center justify-center bg-[#F8FAFC] p-6 text-sm text-[#5B6875]">
                  Hospital blood bank screening &amp; cross-matching
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 divide-y divide-[#E5E7EB] rounded-xl border border-[#E5E7EB] bg-white">
            {[
              {
                step: '01',
                title: 'Select Blood Group & Location',
                body: 'Filter registered donors by ABO/Rh blood group, state, district, city, pincode, and real-time availability status.',
              },
              {
                step: '02',
                title: 'Send a Consent-Based Contact Request',
                body: 'Provide the hospital name, urgency, and required units. Receive a unique tracking code immediately without needing to guess phone numbers.',
              },
              {
                step: '03',
                title: 'Donor Reviews and Accepts',
                body: 'The donor sees the hospital request in their dashboard and chooses whether to accept or decline. Contact details are revealed only upon acceptance.',
              },
              {
                step: '04',
                title: 'Coordinate Directly with the Blood Bank',
                body: 'Once connected, coordinate directly and complete mandatory medical screening and blood compatibility cross-matching at the licensed hospital.',
              },
            ].map((item) => (
              <div key={item.step} className="p-6 flex items-start gap-5">
                <span className="font-mono text-sm font-semibold text-[#168C8C] pt-0.5 tabular-nums shrink-0">
                  {item.step}.
                </span>
                <div>
                  <h3 className="text-base font-semibold text-[#172B3A]">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#5B6875]">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose BloodConnect */}
      <section className="border-t border-[#E5E7EB] bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#172B3A]">
              Why Choose BloodConnect
            </h2>
            <p className="mt-2.5 text-sm sm:text-base text-[#5B6875]">
              Designed like a responsible healthcare coordination tool — prioritizing privacy,
              record accuracy, and calm usability during urgent moments.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-7 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-7">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#172B3A] text-white">
                <Lock className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-[#172B3A]">
                Privacy-First Contact Protection
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#5B6875]">
                Personal phone numbers and email addresses are never published on public search
                cards. Donors retain full control and share their number only when accepting a
                legitimate hospital request.
              </p>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-[#172B3A]">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#168C8C]" aria-hidden="true" />
                  Zero public phone scraping
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#168C8C]" aria-hidden="true" />
                  Per-request consent approval
                </span>
              </div>
            </div>

            <div className="md:col-span-5 rounded-xl border border-[#E5E7EB] bg-white p-7">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#168C8C]/10 text-[#168C8C]">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-[#172B3A]">
                Admin Verification &amp; Record Hygiene
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#5B6875]">
                Administrators verify donor profiles, review community reports for outdated
                entries, and keep availability records dependable.
              </p>
            </div>

            <div className="md:col-span-5 rounded-xl border border-[#E5E7EB] bg-white p-7">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#C94C4C]/10 text-[#C94C4C]">
                <MapPin className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-[#172B3A]">
                Nearest Location &amp; Pincode Ranking
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#5B6875]">
                Narrow results across state, district, city, and area pincode, then sort by
                proximity or most recently updated availability.
              </p>
            </div>

            <div className="md:col-span-7 rounded-xl border border-[#E5E7EB] bg-[#172B3A] p-7 text-white flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-white/75">
                  <AlertCircle className="h-4 w-4 text-[#C94C4C]" aria-hidden="true" />
                  <span>Urgent Blood Coordination</span>
                </div>
                <h3 className="mt-3 text-xl font-semibold text-white">
                  Need Blood Urgently or Tracking an Existing Request?
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/80">
                  Publish an emergency blood requirement for hospital coordination or enter your
                  tracking code to check whether a donor has accepted your contact request.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('/emergency')}
                  className="rounded-lg bg-[#C94C4C] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#B13E3E] transition-colors whitespace-nowrap shrink-0"
                >
                  Open Emergency &amp; Request Tracker
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/register')}
                  className="rounded-lg border border-white/25 bg-transparent px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
                >
                  Become a Donor
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
