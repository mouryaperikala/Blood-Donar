import React, { useState } from 'react';
import { CheckCircle2, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useToast } from '../context/ToastContext';

const COMMUNITY_IMAGE = '/src/assets/images/about_community_care_1795228817376.jpg';

export function AboutPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-6">
          <p className="text-sm font-medium text-[#168C8C]">About BloodConnect</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-[#172B3A]">
            Responsible Blood Donor Coordination Built on Privacy
          </h1>
          <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#5B6875]">
            BloodConnect was built to solve a critical gap in community blood donation: families
            need to find compatible donors quickly, while willing donors need assurance that their
            personal phone numbers will not be scraped or misused.
          </p>
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-[#5B6875]">
            Our consent-first workflow connects requesters with donors by blood group, district,
            city, and availability—revealing contact details strictly when a donor approves an
            incoming hospital request.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/find-donors')}
              className="rounded-lg bg-[#C94C4C] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#B13E3E]"
            >
              Find Blood Donors
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/register')}
              className="rounded-lg border border-[#172B3A] bg-white px-5 py-2.5 text-sm font-semibold text-[#172B3A] hover:bg-[#F8FAFC]"
            >
              Become a Donor
            </button>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
            {!imgFailed ? (
              <img
                src={COMMUNITY_IMAGE}
                alt="Healthcare nurse speaking warmly with an adult blood donor volunteer in a bright clinic"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <div className="aspect-[4/3] flex items-center justify-center bg-[#F8FAFC] p-6 text-sm text-[#5B6875]">
                BloodConnect Volunteer Care Network
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h2 className="text-base font-semibold text-[#172B3A]">01. Consent Before Contact</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#5B6875]">
            No phone number is ever listed publicly. Requesters submit hospital context, and donors
            choose whether to accept and share contact details.
          </p>
        </div>
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h2 className="text-base font-semibold text-[#172B3A]">02. Verified Administration</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#5B6875]">
            Authorized administrators verify donor records, resolve community reports, and maintain
            accurate regional blood group directories.
          </p>
        </div>
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h2 className="text-base font-semibold text-[#172B3A]">03. Clinical Safety First</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#5B6875]">
            BloodConnect coordinates communication only. All eligibility screening, infectious
            disease testing, and cross-matching must be performed by licensed hospital blood banks.
          </p>
        </div>
      </div>
    </div>
  );
}

export function ContactPage() {
  const { notify } = useToast();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.name.trim().length < 2 || !form.email.includes('@') || form.message.trim().length < 10) {
      setError('Please enter your name, a valid email address, and a message of at least 10 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/contact', {
        method: 'POST',
        body: form,
      });
      setSent(true);
      setForm({ name: '', email: '', subject: '', message: '' });
      notify(res.message, 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="pb-6 border-b border-[#E5E7EB]">
        <h1 className="text-3xl font-bold tracking-tight text-[#172B3A]">Contact Support</h1>
        <p className="mt-2 text-sm sm:text-base text-[#5B6875]">
          Reach out for donor verification assistance, hospital partnership inquiries, or account
          support.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#172B3A]">Coordination Desk Details</h2>
            <div className="space-y-3 text-sm text-[#303B46]">
              <p className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-[#168C8C] shrink-0 mt-0.5" aria-hidden="true" />
                <span>support@bloodconnect.org</span>
              </p>
              <p className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-[#168C8C] shrink-0 mt-0.5" aria-hidden="true" />
                <span className="tabular-nums">+91 80 4120 7700 (Mon–Sat, 9 AM – 6 PM IST)</span>
              </p>
              <p className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-[#168C8C] shrink-0 mt-0.5" aria-hidden="true" />
                <span>Health Informatics Wing, Indiranagar, Bengaluru 560038</span>
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-5 text-xs leading-relaxed text-[#5B6875]">
            <p className="font-semibold text-[#172B3A]">Medical Emergencies</p>
            <p className="mt-1">
              For immediate life-threatening emergencies, always contact your local emergency
              medical services or nearest hospital blood bank directly.
            </p>
          </div>
        </div>

        <div className="lg:col-span-7 rounded-xl border border-[#E5E7EB] bg-white p-6 sm:p-7">
          {sent ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-[#168C8C]" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-semibold text-[#172B3A]">Message Sent</h2>
              <p className="mt-2 text-sm text-[#5B6875]">
                Thank you for contacting BloodConnect. Our administrators have logged your message.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="mt-5 rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#172B3A] hover:bg-[#F8FAFC]"
              >
                Send Another Inquiry
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <h2 className="text-base font-semibold text-[#172B3A]">Send a Message</h2>
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-[#C94C4C]/30 bg-[#C94C4C]/5 px-3.5 py-2.5 text-sm text-[#C94C4C]"
                >
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="c-name" className="block text-xs font-medium text-[#303B46] mb-1">
                    Full Name *
                  </label>
                  <input
                    id="c-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                  />
                </div>
                <div>
                  <label htmlFor="c-email" className="block text-xs font-medium text-[#303B46] mb-1">
                    Email Address *
                  </label>
                  <input
                    id="c-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="c-subject" className="block text-xs font-medium text-[#303B46] mb-1">
                  Subject
                </label>
                <input
                  id="c-subject"
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="e.g., Donor verification or hospital inquiry"
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                />
              </div>
              <div>
                <label htmlFor="c-message" className="block text-xs font-medium text-[#303B46] mb-1">
                  Message *
                </label>
                <textarea
                  id="c-message"
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#172B3A]"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#172B3A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#233E52] disabled:opacity-60"
              >
                {submitting ? 'Sending…' : 'Send Message'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center gap-2 text-[#168C8C] text-sm font-medium">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        <span>Data Privacy &amp; Governance</span>
      </div>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#172B3A]">Privacy Policy</h1>
      <div className="mt-8 space-y-6 rounded-xl border border-[#E5E7EB] bg-white p-6 sm:p-8 text-sm leading-relaxed text-[#303B46]">
        <section>
          <h2 className="text-base font-semibold text-[#172B3A]">1. Information We Collect</h2>
          <p className="mt-1.5 text-[#5B6875]">
            When you register as a blood donor, BloodConnect collects your name, age, gender, blood
            group, city/district/state, area pincode, availability status, optional last donation
            date, email address, and mobile number. Passwords are stored exclusively as salted
            cryptographic hashes.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-[#172B3A]">
            2. Protection of Personal Contact Information
          </h2>
          <p className="mt-1.5 text-[#5B6875]">
            Public search results never expose donor mobile numbers or email addresses. Contact
            details are shared only with a specific requester when the donor explicitly clicks
            &ldquo;Accept &amp; Share Contact&rdquo; inside their authenticated Donor Dashboard.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-[#172B3A]">3. User Control &amp; Deletion</h2>
          <p className="mt-1.5 text-[#5B6875]">
            Registered donors can update their availability, edit location details, clear search
            history, or permanently delete their account at any time from the Donor Dashboard.
          </p>
        </section>
      </div>
    </div>
  );
}

export function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-[#172B3A]">Terms of Service</h1>
      <div className="mt-8 space-y-6 rounded-xl border border-[#E5E7EB] bg-white p-6 sm:p-8 text-sm leading-relaxed text-[#303B46]">
        <section>
          <h2 className="text-base font-semibold text-[#172B3A]">1. Platform Scope</h2>
          <p className="mt-1.5 text-[#5B6875]">
            BloodConnect is a voluntary blood donor directory and coordination system. It does not
            provide medical advice, clinical diagnosis, blood collection, or blood banking services.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-[#172B3A]">
            2. Mandatory Medical Verification
          </h2>
          <p className="mt-1.5 text-[#5B6875]">
            Donor availability, health eligibility, and blood compatibility must be verified
            directly with the donor and confirmed through licensed hospital blood bank screening
            and cross-matching prior to any donation or transfusion.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-[#172B3A]">3. Acceptable Use</h2>
          <p className="mt-1.5 text-[#5B6875]">
            Users must submit truthful donor records and genuine hospital contact requests.
            Commercial solicitation, harassment, or false listings will result in account removal by
            system administrators.
          </p>
        </section>
      </div>
    </div>
  );
}
