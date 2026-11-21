export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type AvailabilityStatus = 'Available' | 'Temporarily Unavailable' | 'Recently Donated';

export type Gender = 'Male' | 'Female' | 'Other' | 'Prefer not to say';

export type UserRole = 'donor' | 'admin';

export interface DonorPublic {
  id: string;
  fullName: string;
  age: number;
  gender: Gender;
  bloodGroup: BloodGroup;
  state: string;
  district: string;
  city: string;
  areaPincode: string;
  lastDonationDate: string | null;
  shareLastDonation: boolean;
  availabilityStatus: AvailabilityStatus;
  verified: boolean;
  isActive: boolean;
  isDemo?: boolean;
  updatedAt: string;
  createdAt: string;
}

export interface DonorPrivate extends DonorPublic {
  email: string;
  mobile: string;
  contactConsent: boolean;
}

export interface DonorRecord extends DonorPrivate {
  passwordHash: string;
  role: 'donor';
}

export type ContactRequestStatus = 'pending' | 'accepted' | 'declined' | 'completed';

export interface ContactRequest {
  id: string;
  trackingCode: string;
  donorId: string;
  donorName: string;
  donorBloodGroup: BloodGroup;
  donorCity: string;
  donorDistrict: string;
  requesterUserId: string | null;
  requesterName: string;
  requesterPhone: string;
  requesterEmail: string;
  hospitalName: string;
  city: string;
  unitsNeeded: number;
  urgency: 'Normal' | 'Urgent' | 'Critical';
  message: string;
  status: ContactRequestStatus;
  donorResponseNote?: string;
  sharedDonorContact?: {
    mobile: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type EmergencyStatus = 'Open' | 'Coordinating' | 'Fulfilled' | 'Closed';

export interface EmergencyRequest {
  id: string;
  trackingCode: string;
  patientName: string;
  requesterName: string;
  requesterPhone: string;
  bloodGroup: BloodGroup;
  unitsRequired: number;
  hospitalName: string;
  state: string;
  district: string;
  city: string;
  urgency: 'Urgent' | 'Critical';
  requiredByDate: string;
  notes: string;
  status: EmergencyStatus;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ReportStatus = 'open' | 'reviewed' | 'resolved' | 'dismissed';

export interface AbuseReport {
  id: string;
  donorId: string;
  donorName: string;
  reason: 'Outdated Contact Info' | 'Inaccurate Blood Group' | 'Inappropriate Behaviour' | 'Duplicate Record' | 'Other';
  details: string;
  reporterEmail: string;
  status: ReportStatus;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchHistoryItem {
  id: string;
  userId: string;
  bloodGroup: string;
  state: string;
  district: string;
  city: string;
  areaPincode: string;
  availability: string;
  resultCount: number;
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}

export interface SystemStats {
  totalDonors: number;
  demoDonors: number;
  liveRegisteredDonors: number;
  availableDonors: number;
  verifiedDonors: number;
  activeDonors: number;
  bloodGroupCount: number;
  successfulConnections: number;
  openEmergencyRequests: number;
  pendingVerifications: number;
  openReports: number;
  byBloodGroup: Record<BloodGroup, number>;
  storageMode: 'mongodb' | 'local-file';
}

export interface AuthSession {
  token: string;
  role: UserRole;
  donor?: DonorPrivate;
  adminEmail?: string;
}

export interface DonorSearchFilters {
  bloodGroup?: string;
  state?: string;
  district?: string;
  city?: string;
  areaPincode?: string;
  availability?: string;
  nearPincode?: string;
  verifiedOnly?: boolean;
  sortBy?: 'recent' | 'location' | 'nearest';
}
