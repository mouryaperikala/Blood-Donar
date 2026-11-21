import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOOD_COMPATIBILITY,
  calculateProfileCompletion,
  computeLocationProximityScore,
  filterAndSortDonors,
  isEligibleByInterval,
  maskPhoneNumber,
  validateContactRequest,
  validateDonorRegistration,
  validateEmergencyRequest,
} from './validation';
import type { DonorPublic } from './types';

test('validateDonorRegistration accepts valid complete input', () => {
  const result = validateDonorRegistration({
    fullName: 'Ananya Deshmukh',
    age: 28,
    gender: 'Female',
    bloodGroup: 'O+',
    mobile: '9876543210',
    email: 'ananya@example.com',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    city: 'Bengaluru',
    areaPincode: 'Indiranagar, 560038',
    lastDonationDate: '2026-05-10',
    availabilityStatus: 'Available',
    password: 'StrongPassword123',
    confirmPassword: 'StrongPassword123',
    contactConsent: true,
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
});

test('validateDonorRegistration rejects underage, bad mobile, mismatched passwords, and missing consent', () => {
  const result = validateDonorRegistration({
    fullName: 'A',
    age: 16,
    gender: 'Invalid',
    bloodGroup: 'X+',
    mobile: '12345',
    email: 'not-an-email',
    state: '',
    district: '',
    city: '',
    areaPincode: '',
    availabilityStatus: 'Available',
    password: 'short',
    confirmPassword: 'different',
    contactConsent: false,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.fullName);
  assert.ok(result.errors.age);
  assert.ok(result.errors.bloodGroup);
  assert.ok(result.errors.mobile);
  assert.ok(result.errors.email);
  assert.ok(result.errors.password);
  assert.ok(result.errors.confirmPassword);
  assert.ok(result.errors.contactConsent);
});

test('filterAndSortDonors filters accurately and sorts by nearest pincode', () => {
  const donors: DonorPublic[] = [
    {
      id: '1',
      fullName: 'Rohan Nair',
      age: 30,
      gender: 'Male',
      bloodGroup: 'O+',
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      city: 'Bengaluru',
      areaPincode: 'Whitefield, 560066',
      lastDonationDate: '2026-01-15',
      shareLastDonation: true,
      availabilityStatus: 'Available',
      verified: true,
      isActive: true,
      updatedAt: '2026-10-01T10:00:00.000Z',
      createdAt: '2026-01-01T10:00:00.000Z',
    },
    {
      id: '2',
      fullName: 'Meera Iyer',
      age: 26,
      gender: 'Female',
      bloodGroup: 'O+',
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      city: 'Bengaluru',
      areaPincode: 'Indiranagar, 560038',
      lastDonationDate: '2026-02-15',
      shareLastDonation: true,
      availabilityStatus: 'Available',
      verified: true,
      isActive: true,
      updatedAt: '2026-10-10T10:00:00.000Z',
      createdAt: '2026-01-01T10:00:00.000Z',
    },
    {
      id: '3',
      fullName: 'Inactive Donor',
      age: 34,
      gender: 'Male',
      bloodGroup: 'O+',
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      city: 'Bengaluru',
      areaPincode: 'Indiranagar, 560038',
      lastDonationDate: null,
      shareLastDonation: false,
      availabilityStatus: 'Available',
      verified: false,
      isActive: false,
      updatedAt: '2026-11-01T10:00:00.000Z',
      createdAt: '2026-01-01T10:00:00.000Z',
    },
  ];

  const nearest = filterAndSortDonors(donors, {
    bloodGroup: 'O+',
    nearPincode: '560066',
    sortBy: 'nearest',
  });

  assert.equal(nearest.length, 2);
  assert.equal(nearest[0].id, '1');
  assert.equal(nearest[1].id, '2');

  const recent = filterAndSortDonors(donors, {
    bloodGroup: 'O+',
    sortBy: 'recent',
  });
  assert.equal(recent[0].id, '2');
});

test('computeLocationProximityScore ranks exact pincode highest', () => {
  const exact = computeLocationProximityScore(
    { state: 'Karnataka', district: 'Bengaluru Urban', city: 'Bengaluru', areaPincode: '560038' },
    '560038'
  );
  const nearby = computeLocationProximityScore(
    { state: 'Karnataka', district: 'Bengaluru Urban', city: 'Bengaluru', areaPincode: '560040' },
    '560038'
  );
  const far = computeLocationProximityScore(
    { state: 'Maharashtra', district: 'Mumbai', city: 'Mumbai', areaPincode: '400001' },
    '560038'
  );

  assert.ok(exact > nearby);
  assert.ok(nearby > far);
});

test('calculateProfileCompletion returns accurate percentage', () => {
  const full = calculateProfileCompletion({
    fullName: 'Dr. Kavitha Rao',
    age: 35,
    gender: 'Female',
    bloodGroup: 'A-',
    mobile: '9845012345',
    email: 'kavitha@example.com',
    state: 'Karnataka',
    district: 'Mysuru',
    city: 'Mysuru',
    areaPincode: '570001',
    lastDonationDate: '2026-04-01',
    contactConsent: true,
  });
  assert.equal(full, 100);

  const partial = calculateProfileCompletion({
    fullName: 'Dr. Kavitha Rao',
    age: 35,
    bloodGroup: 'A-',
  });
  assert.equal(partial, 30);
});

test('privacy masking, compatibility matrix, and donation interval work properly', () => {
  assert.equal(maskPhoneNumber('+91 9876543210'), '••••••3210');
  assert.equal(BLOOD_COMPATIBILITY['O-'].canDonateTo.length, 8);
  assert.equal(BLOOD_COMPATIBILITY['AB+'].canReceiveFrom.length, 8);

  const now = Date.parse('2026-11-20T00:00:00Z');
  assert.equal(isEligibleByInterval('2026-07-01', now), true);
  assert.equal(isEligibleByInterval('2026-10-15', now), false);
});

test('validateContactRequest and validateEmergencyRequest enforce required fields', () => {
  const contactBad = validateContactRequest({
    donorId: '',
    requesterName: '',
    requesterPhone: '111',
    requesterEmail: 'bad',
    hospitalName: '',
    city: '',
    unitsNeeded: 0,
    urgency: 'Invalid',
    message: 'Hi',
  });
  assert.equal(contactBad.valid, false);
  assert.ok(Object.keys(contactBad.errors).length >= 7);

  const emergencyOk = validateEmergencyRequest({
    patientName: 'Suresh Kumar',
    requesterName: 'Deepa Kumar',
    requesterPhone: '9820123456',
    bloodGroup: 'B-',
    unitsRequired: 2,
    hospitalName: 'Manipal Hospital',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    city: 'Bengaluru',
    urgency: 'Critical',
    requiredByDate: '2026-11-22',
    notes: 'Scheduled cardiac surgery',
  });
  assert.equal(emergencyOk.valid, true);
});
