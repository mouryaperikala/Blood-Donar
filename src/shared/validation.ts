import type {
  AvailabilityStatus,
  BloodGroup,
  DonorPrivate,
  DonorPublic,
  DonorSearchFilters,
  Gender,
} from './types.ts';

export const BLOOD_GROUPS: BloodGroup[] = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
];

export const AVAILABILITY_STATUSES: AvailabilityStatus[] = [
  'Available',
  'Temporarily Unavailable',
  'Recently Donated',
];

export const GENDERS: Gender[] = [
  'Male',
  'Female',
  'Other',
  'Prefer not to say',
];

export const STATES_DISTRICTS: Record<string, string[]> = {
  Karnataka: ['Bengaluru Urban', 'Mysuru', 'Mangaluru', 'Hubballi-Dharwad', 'Belagavi'],
  Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane'],
  Delhi: ['Central Delhi', 'New Delhi', 'South Delhi', 'East Delhi', 'West Delhi'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem'],
  Telangana: ['Hyderabad', 'Warangal', 'Nizamabad', 'Khammam', 'Karimnagar'],
  Kerala: ['Ernakulam', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kottayam'],
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar'],
  'West Bengal': ['Kolkata', 'Howrah', 'Darjeeling', 'Siliguri', 'Durgapur'],
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati', 'Kakinada'],
  Rajasthan: ['Jaipur', 'Udaipur', 'Jodhpur', 'Kota', 'Ajmer'],
};

export const BLOOD_COMPATIBILITY: Record<
  BloodGroup,
  { canReceiveFrom: BloodGroup[]; canDonateTo: BloodGroup[]; note: string }
> = {
  'O-': {
    canReceiveFrom: ['O-'],
    canDonateTo: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    note: 'Universal red cell donor',
  },
  'O+': {
    canReceiveFrom: ['O+', 'O-'],
    canDonateTo: ['A+', 'B+', 'AB+', 'O+'],
    note: 'Most common blood type',
  },
  'A-': {
    canReceiveFrom: ['A-', 'O-'],
    canDonateTo: ['A+', 'A-', 'AB+', 'AB-'],
    note: 'Compatible with A and AB groups',
  },
  'A+': {
    canReceiveFrom: ['A+', 'A-', 'O+', 'O-'],
    canDonateTo: ['A+', 'AB+'],
    note: 'Second most common blood type',
  },
  'B-': {
    canReceiveFrom: ['B-', 'O-'],
    canDonateTo: ['B+', 'B-', 'AB+', 'AB-'],
    note: 'Compatible with B and AB groups',
  },
  'B+': {
    canReceiveFrom: ['B+', 'B-', 'O+', 'O-'],
    canDonateTo: ['B+', 'AB+'],
    note: 'Widely needed across hospitals',
  },
  'AB-': {
    canReceiveFrom: ['AB-', 'A-', 'B-', 'O-'],
    canDonateTo: ['AB+', 'AB-'],
    note: 'Universal plasma donor',
  },
  'AB+': {
    canReceiveFrom: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    canDonateTo: ['AB+'],
    note: 'Universal red cell recipient',
  },
};

export interface DonorRegistrationInput {
  fullName: string;
  age: number | string;
  gender: string;
  bloodGroup: string;
  mobile: string;
  email: string;
  state: string;
  district: string;
  city: string;
  areaPincode: string;
  lastDonationDate?: string;
  availabilityStatus: string;
  password: string;
  confirmPassword: string;
  contactConsent: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MOBILE_DIGITS_REGEX = /^[6-9]\d{9}$/;

export function normalizeMobile(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  return digits;
}

export function isValidBloodGroup(value: string): value is BloodGroup {
  return BLOOD_GROUPS.includes(value as BloodGroup);
}

export function isValidAvailability(value: string): value is AvailabilityStatus {
  return AVAILABILITY_STATUSES.includes(value as AvailabilityStatus);
}

export function isValidGender(value: string): value is Gender {
  return GENDERS.includes(value as Gender);
}

export function validateDonorRegistration(
  input: DonorRegistrationInput,
  options: { requirePassword?: boolean } = { requirePassword: true }
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.fullName || input.fullName.trim().length < 2) {
    errors.fullName = 'Please enter the donor full name (at least 2 characters).';
  }

  const parsedAge = Number(input.age);
  if (!Number.isFinite(parsedAge) || !Number.isInteger(parsedAge) || parsedAge < 18 || parsedAge > 65) {
    errors.age = 'Donors must be between 18 and 65 years old.';
  }

  if (!isValidGender(input.gender)) {
    errors.gender = 'Please select a valid gender option.';
  }

  if (!isValidBloodGroup(input.bloodGroup)) {
    errors.bloodGroup = 'Please select a valid blood group.';
  }

  const cleanedMobile = normalizeMobile(input.mobile);
  if (!MOBILE_DIGITS_REGEX.test(cleanedMobile)) {
    errors.mobile = 'Enter a valid 10-digit mobile number starting with 6–9.';
  }

  if (!input.email || !EMAIL_REGEX.test(input.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!input.state || input.state.trim().length < 2) {
    errors.state = 'Please select a state.';
  }

  if (!input.district || input.district.trim().length < 2) {
    errors.district = 'Please select or enter a district.';
  }

  if (!input.city || input.city.trim().length < 2) {
    errors.city = 'Please enter a city name.';
  }

  if (!input.areaPincode || input.areaPincode.trim().length < 3) {
    errors.areaPincode = 'Please enter an area name or 6-digit pincode.';
  }

  if (!isValidAvailability(input.availabilityStatus)) {
    errors.availabilityStatus = 'Please select a valid availability status.';
  }

  if (input.lastDonationDate) {
    const parsedDate = Date.parse(input.lastDonationDate);
    if (Number.isNaN(parsedDate)) {
      errors.lastDonationDate = 'Please enter a valid date.';
    } else if (parsedDate > Date.now() + 86400000) {
      errors.lastDonationDate = 'Last donation date cannot be in the future.';
    }
  }

  if (options.requirePassword !== false) {
    if (!input.password || input.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    }
    if (input.password !== input.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    if (!input.contactConsent) {
      errors.contactConsent =
        'You must agree to the privacy-first consent policy to register as a donor.';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export interface ContactRequestInput {
  donorId: string;
  requesterName: string;
  requesterPhone: string;
  requesterEmail: string;
  hospitalName: string;
  city: string;
  unitsNeeded: number | string;
  urgency: string;
  message: string;
}

export function validateContactRequest(input: ContactRequestInput): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.donorId || typeof input.donorId !== 'string') {
    errors.donorId = 'Target donor is required.';
  }
  if (!input.requesterName || input.requesterName.trim().length < 2) {
    errors.requesterName = 'Please enter your full name.';
  }
  if (!MOBILE_DIGITS_REGEX.test(normalizeMobile(input.requesterPhone))) {
    errors.requesterPhone = 'Enter a valid 10-digit mobile number.';
  }
  if (!input.requesterEmail || !EMAIL_REGEX.test(input.requesterEmail.trim())) {
    errors.requesterEmail = 'Please enter a valid email address.';
  }
  if (!input.hospitalName || input.hospitalName.trim().length < 2) {
    errors.hospitalName = 'Please enter the hospital or clinic name.';
  }
  if (!input.city || input.city.trim().length < 2) {
    errors.city = 'Please enter the city.';
  }
  const units = Number(input.unitsNeeded);
  if (!Number.isInteger(units) || units < 1 || units > 10) {
    errors.unitsNeeded = 'Units needed must be between 1 and 10.';
  }
  if (!['Normal', 'Urgent', 'Critical'].includes(input.urgency)) {
    errors.urgency = 'Select a valid urgency level.';
  }
  if (!input.message || input.message.trim().length < 10) {
    errors.message = 'Please provide a brief medical context (at least 10 characters).';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export interface EmergencyRequestInput {
  patientName: string;
  requesterName: string;
  requesterPhone: string;
  bloodGroup: string;
  unitsRequired: number | string;
  hospitalName: string;
  state: string;
  district: string;
  city: string;
  urgency: string;
  requiredByDate: string;
  notes?: string;
}

export function validateEmergencyRequest(input: EmergencyRequestInput): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.patientName || input.patientName.trim().length < 2) {
    errors.patientName = 'Please enter the patient name.';
  }
  if (!input.requesterName || input.requesterName.trim().length < 2) {
    errors.requesterName = 'Please enter the coordinator or family contact name.';
  }
  if (!MOBILE_DIGITS_REGEX.test(normalizeMobile(input.requesterPhone))) {
    errors.requesterPhone = 'Enter a valid 10-digit mobile number.';
  }
  if (!isValidBloodGroup(input.bloodGroup)) {
    errors.bloodGroup = 'Please select a required blood group.';
  }
  const units = Number(input.unitsRequired);
  if (!Number.isInteger(units) || units < 1 || units > 15) {
    errors.unitsRequired = 'Units required must be between 1 and 15.';
  }
  if (!input.hospitalName || input.hospitalName.trim().length < 2) {
    errors.hospitalName = 'Please enter the hospital name.';
  }
  if (!input.state || input.state.trim().length < 2) {
    errors.state = 'Please select a state.';
  }
  if (!input.district || input.district.trim().length < 2) {
    errors.district = 'Please select a district.';
  }
  if (!input.city || input.city.trim().length < 2) {
    errors.city = 'Please enter the city.';
  }
  if (!['Urgent', 'Critical'].includes(input.urgency)) {
    errors.urgency = 'Please select urgency level.';
  }
  if (!input.requiredByDate || Number.isNaN(Date.parse(input.requiredByDate))) {
    errors.requiredByDate = 'Please select a valid required-by date.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function calculateProfileCompletion(donor: Partial<DonorPrivate>): number {
  const checkpoints: boolean[] = [
    Boolean(donor.fullName && donor.fullName.trim().length >= 2),
    Boolean(donor.age && donor.age >= 18),
    Boolean(donor.gender),
    Boolean(donor.bloodGroup),
    Boolean(donor.mobile && normalizeMobile(donor.mobile).length === 10),
    Boolean(donor.email && EMAIL_REGEX.test(donor.email)),
    Boolean(donor.state && donor.district && donor.city),
    Boolean(donor.areaPincode && donor.areaPincode.trim().length >= 3),
    Boolean(donor.lastDonationDate),
    Boolean(donor.contactConsent),
  ];
  const completed = checkpoints.filter(Boolean).length;
  return Math.round((completed / checkpoints.length) * 100);
}

export function extractPincode(areaPincode: string): string | null {
  const match = String(areaPincode || '').match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

/**
 * Computes a deterministic proximity score (higher = closer) between a donor's
 * location and a reference pincode or city/area query.
 */
export function computeLocationProximityScore(
  donor: Pick<DonorPublic, 'areaPincode' | 'city' | 'district' | 'state'>,
  nearQuery: string
): number {
  const target = nearQuery.trim().toLowerCase();
  if (!target) return 0;

  const targetPin = extractPincode(target);
  const donorPin = extractPincode(donor.areaPincode);

  if (targetPin && donorPin) {
    if (targetPin === donorPin) return 1000;
    const diff = Math.abs(Number(targetPin) - Number(donorPin));
    // Same postal region (first 3 digits match) gets strong preference
    if (targetPin.slice(0, 3) === donorPin.slice(0, 3)) {
      return 800 - Math.min(diff, 700) / 10;
    }
    return Math.max(10, 400 - Math.min(diff, 390000) / 1000);
  }

  let score = 0;
  if (donor.areaPincode.toLowerCase().includes(target)) score += 600;
  if (donor.city.toLowerCase() === target) score += 500;
  else if (donor.city.toLowerCase().includes(target)) score += 300;
  if (donor.district.toLowerCase().includes(target)) score += 200;
  if (donor.state.toLowerCase().includes(target)) score += 100;
  return score;
}

export function filterAndSortDonors(
  donors: DonorPublic[],
  filters: DonorSearchFilters
): DonorPublic[] {
  const bg = (filters.bloodGroup || '').trim();
  const state = (filters.state || '').trim().toLowerCase();
  const district = (filters.district || '').trim().toLowerCase();
  const city = (filters.city || '').trim().toLowerCase();
  const area = (filters.areaPincode || '').trim().toLowerCase();
  const availability = (filters.availability || '').trim();
  const nearPincode = (filters.nearPincode || '').trim();

  const filtered = donors.filter((donor) => {
    if (!donor.isActive) return false;
    if (bg && donor.bloodGroup !== bg) return false;
    if (state && donor.state.toLowerCase() !== state) return false;
    if (district && donor.district.toLowerCase() !== district) return false;
    if (city && !donor.city.toLowerCase().includes(city)) return false;
    if (area && !donor.areaPincode.toLowerCase().includes(area)) return false;
    if (availability && donor.availabilityStatus !== availability) return false;
    if (filters.verifiedOnly && !donor.verified) return false;
    return true;
  });

  const sortBy = filters.sortBy || (nearPincode ? 'nearest' : 'recent');

  return [...filtered].sort((a, b) => {
    if (sortBy === 'nearest' && (nearPincode || area || city)) {
      const reference = nearPincode || area || city;
      const diff =
        computeLocationProximityScore(b, reference) -
        computeLocationProximityScore(a, reference);
      if (diff !== 0) return diff;
    }
    if (sortBy === 'location') {
      const locA = `${a.state} ${a.district} ${a.city} ${a.areaPincode}`.toLowerCase();
      const locB = `${b.state} ${b.district} ${b.city} ${b.areaPincode}`.toLowerCase();
      return locA.localeCompare(locB);
    }
    // Default: recently updated first, with Available prioritized gently on ties
    const timeDiff = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    if (timeDiff !== 0) return timeDiff;
    return a.fullName.localeCompare(b.fullName);
  });
}

export function maskPhoneNumber(mobile: string): string {
  const digits = normalizeMobile(mobile);
  if (digits.length < 4) return 'Protected';
  return `••••••${digits.slice(-4)}`;
}

export function daysSinceDonation(lastDonationDate: string | null, nowMs = Date.now()): number | null {
  if (!lastDonationDate) return null;
  const parsed = Date.parse(lastDonationDate);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.floor((nowMs - parsed) / 86400000));
}

export function isEligibleByInterval(lastDonationDate: string | null, nowMs = Date.now()): boolean {
  const days = daysSinceDonation(lastDonationDate, nowMs);
  if (days === null) return true;
  return days >= 90;
}
