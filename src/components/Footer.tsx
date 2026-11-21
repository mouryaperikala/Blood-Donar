import React from 'react';
import { Droplet, Mail, Phone, MapPin, ShieldAlert } from 'lucide-react';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  const go = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    onNavigate(path);
  };

  return (
    <footer className="mt-20 border-t border-[#E5E7EB] bg-white">
      {/* Clinical & Safety Disclaimer Strip */}
      <div className="border-b border-[#E5E7EB] bg-[#F8FAFC]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-4 flex items-start gap-3 text-xs leading-relaxed text-[#5B6875]">
          <ShieldAlert className="h-4 w-4 text-[#172B3A] shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            <strong className="font-semibold text-[#172B3A]">Important Medical Notice:</strong>{' '}
            Donor availability, health eligibility, and blood compatibility must always be confirmed
            directly with the donor and a licensed hospital blood bank before transfusion.
            BloodConnect facilitates donor discovery and consent-based coordination only and does
            not replace medical screening, laboratory cross-matching, or professional medical advice.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          {/* Brand Column */}
          <div className="md:col-span-1">
            <a
              href="/"
              onClick={(e) => go(e, '/')}
              className="inline-flex items-center gap-2 text-lg font-bold tracking-tight text-[#172B3A]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C94C4C] text-white">
                <Droplet className="h-4 w-4 fill-current" aria-hidden="true" />
              </span>
              <span>BloodConnect</span>
            </a>
            <p className="mt-3 text-sm leading-relaxed text-[#5B6875]">
              A structured blood donor management and search platform designed for fast discovery,
              privacy-first contact consent, and responsible community coordination.
            </p>
          </div>

          {/* Platform Links */}
          <div>
            <h3 className="text-sm font-semibold text-[#172B3A]">Platform</h3>
            <ul className="mt-3 space-y-2.5 text-sm text-[#5B6875]">
              <li>
                <a href="/find-donors" onClick={(e) => go(e, '/find-donors')} className="hover:text-[#172B3A]">
                  Find Blood Donors
                </a>
              </li>
              <li>
                <a href="/register" onClick={(e) => go(e, '/register')} className="hover:text-[#172B3A]">
                  Register as a Donor
                </a>
              </li>
              <li>
                <a href="/emergency" onClick={(e) => go(e, '/emergency')} className="hover:text-[#172B3A]">
                  Emergency Request &amp; Tracker
                </a>
              </li>
              <li>
                <a href="/login" onClick={(e) => go(e, '/login')} className="hover:text-[#172B3A]">
                  Donor Login
                </a>
              </li>
              <li>
                <a href="/admin-login" onClick={(e) => go(e, '/admin-login')} className="hover:text-[#172B3A]">
                  Administrator Portal
                </a>
              </li>
            </ul>
          </div>

          {/* Resources & Legal */}
          <div>
            <h3 className="text-sm font-semibold text-[#172B3A]">Governance &amp; Info</h3>
            <ul className="mt-3 space-y-2.5 text-sm text-[#5B6875]">
              <li>
                <a href="/about" onClick={(e) => go(e, '/about')} className="hover:text-[#172B3A]">
                  About BloodConnect
                </a>
              </li>
              <li>
                <a href="/contact" onClick={(e) => go(e, '/contact')} className="hover:text-[#172B3A]">
                  Contact Support
                </a>
              </li>
              <li>
                <a href="/privacy" onClick={(e) => go(e, '/privacy')} className="hover:text-[#172B3A]">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms" onClick={(e) => go(e, '/terms')} className="hover:text-[#172B3A]">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Details */}
          <div>
            <h3 className="text-sm font-semibold text-[#172B3A]">Coordination Desk</h3>
            <ul className="mt-3 space-y-2.5 text-sm text-[#5B6875]">
              <li className="flex items-start gap-2.5">
                <Mail className="h-4 w-4 text-[#168C8C] shrink-0 mt-0.5" aria-hidden="true" />
                <span>support@bloodconnect.org</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Phone className="h-4 w-4 text-[#168C8C] shrink-0 mt-0.5" aria-hidden="true" />
                <span className="tabular-nums">+91 80 4120 7700 (Desk Hours)</span>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-[#168C8C] shrink-0 mt-0.5" aria-hidden="true" />
                <span>Health Informatics Wing, Bengaluru, India</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[#E5E7EB] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5B6875]">
          <p>&copy; {new Date().getFullYear()} BloodConnect. All rights reserved.</p>
          <p>Privacy-first consent directory · Personal numbers are never displayed publicly.</p>
        </div>
      </div>
    </footer>
  );
}
