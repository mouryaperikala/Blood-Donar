import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import { BloodConnectStore, toPrivateDonor, toPublicDonor } from './server/db.ts';
import {
  cleanString,
  generateTrackingCode,
  hashPassword,
  optionalAuth,
  requireAdmin,
  requireAuth,
  requireDonor,
  revokeAuthToken,
  safeCompareStrings,
  signAuthToken,
  verifyPassword,
  type AuthenticatedRequest,
} from './server/security.ts';
import {
  BLOOD_GROUPS,
  filterAndSortDonors,
  isValidAvailability,
  isValidBloodGroup,
  isValidGender,
  maskPhoneNumber,
  normalizeMobile,
  validateContactRequest,
  validateDonorRegistration,
  validateEmergencyRequest,
} from './src/shared/validation.ts';
import type {
  AbuseReport,
  BloodGroup,
  ContactMessage,
  ContactRequest,
  DonorRecord,
  EmergencyRequest,
  EmergencyStatus,
  ReportStatus,
  SystemStats,
} from './src/shared/types.ts';

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);
  const store = new BloodConnectStore();
  await store.init();

  app.use(express.json({ limit: '1mb' }));

  // Basic security headers (without X-Frame-Options so AI Studio preview iframe works)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // =========================================================
  // Public Stats & Directory Routes
  // =========================================================
  app.get('/api/stats', async (_req: Request, res: Response) => {
    const [donors, contactRequests, emergencyRequests, reports] = await Promise.all([
      store.listDonors(),
      store.listContactRequests(),
      store.listEmergencyRequests(),
      store.listReports(),
    ]);

    const byBloodGroup = BLOOD_GROUPS.reduce(
      (acc, bg) => {
        acc[bg] = 0;
        return acc;
      },
      {} as Record<BloodGroup, number>
    );

    for (const donor of donors) {
      if (donor.isActive && byBloodGroup[donor.bloodGroup] !== undefined) {
        byBloodGroup[donor.bloodGroup] += 1;
      }
    }

    const activeDonors = donors.filter((d) => d.isActive);
    const stats: SystemStats = {
      totalDonors: donors.length,
      demoDonors: donors.filter((d) => d.isDemo).length,
      liveRegisteredDonors: donors.filter((d) => !d.isDemo).length,
      activeDonors: activeDonors.length,
      availableDonors: activeDonors.filter((d) => d.availabilityStatus === 'Available').length,
      verifiedDonors: activeDonors.filter((d) => d.verified).length,
      bloodGroupCount: BLOOD_GROUPS.length,
      successfulConnections: contactRequests.filter(
        (r) => r.status === 'accepted' || r.status === 'completed'
      ).length,
      openEmergencyRequests: emergencyRequests.filter(
        (e) => e.status === 'Open' || e.status === 'Coordinating'
      ).length,
      pendingVerifications: donors.filter((d) => d.isActive && !d.verified).length,
      openReports: reports.filter((r) => r.status === 'open').length,
      byBloodGroup,
      storageMode: store.mode,
    };

    res.json(stats);
  });

  app.get('/api/donors', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    const bloodGroup = cleanString(req.query.bloodGroup, 10);
    const state = cleanString(req.query.state, 80);
    const district = cleanString(req.query.district, 80);
    const city = cleanString(req.query.city, 80);
    const areaPincode = cleanString(req.query.areaPincode, 80);
    const availability = cleanString(req.query.availability, 40);
    const nearPincode = cleanString(req.query.nearPincode, 80);
    const verifiedOnly = req.query.verifiedOnly === 'true';
    const sortRaw = cleanString(req.query.sortBy, 20);
    const sortBy =
      sortRaw === 'location' || sortRaw === 'nearest' || sortRaw === 'recent'
        ? sortRaw
        : 'recent';
    const recordHistory = req.query.recordHistory === 'true';

    const allDonors = await store.listDonors();
    const publicDonors = allDonors.map(toPublicDonor);
    const matches = filterAndSortDonors(publicDonors, {
      bloodGroup,
      state,
      district,
      city,
      areaPincode,
      availability,
      nearPincode,
      verifiedOnly,
      sortBy,
    });

    if (
      recordHistory &&
      req.auth?.role === 'donor' &&
      (bloodGroup || state || district || city || areaPincode || availability)
    ) {
      await store.addSearchHistory({
        id: crypto.randomUUID(),
        userId: req.auth.sub,
        bloodGroup,
        state,
        district,
        city,
        areaPincode,
        availability,
        resultCount: matches.length,
        createdAt: new Date().toISOString(),
      });
    }

    res.json({ total: matches.length, donors: matches });
  });

  app.get('/api/donors/:id', async (req: Request, res: Response) => {
    const id = cleanString(req.params.id, 80);
    const donor = await store.findDonorById(id);
    if (!donor || !donor.isActive) {
      res.status(404).json({ error: 'Donor profile not found.' });
      return;
    }
    res.json({ donor: toPublicDonor(donor) });
  });

  // =========================================================
  // Authentication Routes (Donor + Admin)
  // =========================================================
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    const body = req.body ?? {};
    const input = {
      fullName: cleanString(body.fullName, 120),
      age: Number(body.age),
      gender: cleanString(body.gender, 30),
      bloodGroup: cleanString(body.bloodGroup, 10),
      mobile: cleanString(body.mobile, 20),
      email: cleanString(body.email, 150).toLowerCase(),
      state: cleanString(body.state, 80),
      district: cleanString(body.district, 80),
      city: cleanString(body.city, 80),
      areaPincode: cleanString(body.areaPincode, 120),
      lastDonationDate: cleanString(body.lastDonationDate, 30),
      availabilityStatus: cleanString(body.availabilityStatus, 40) || 'Available',
      password: typeof body.password === 'string' ? body.password : '',
      confirmPassword: typeof body.confirmPassword === 'string' ? body.confirmPassword : '',
      contactConsent: Boolean(body.contactConsent),
    };

    const validation = validateDonorRegistration(input, { requirePassword: true });
    if (!validation.valid) {
      res.status(400).json({ error: 'Please fix the highlighted fields.', errors: validation.errors });
      return;
    }

    const existing = await store.findDonorByEmail(input.email);
    if (existing) {
      res.status(409).json({
        error: 'An account with this email address already exists.',
        errors: { email: 'This email is already registered. Try logging in instead.' },
      });
      return;
    }

    const now = new Date().toISOString();
    const record: DonorRecord = {
      id: `donor-${crypto.randomUUID().slice(0, 12)}`,
      fullName: input.fullName,
      age: input.age,
      gender: input.gender as DonorRecord['gender'],
      bloodGroup: input.bloodGroup as BloodGroup,
      mobile: normalizeMobile(input.mobile),
      email: input.email,
      state: input.state,
      district: input.district,
      city: input.city,
      areaPincode: input.areaPincode,
      lastDonationDate: input.lastDonationDate || null,
      shareLastDonation: body.shareLastDonation !== false,
      availabilityStatus: input.availabilityStatus as DonorRecord['availabilityStatus'],
      verified: false,
      isActive: true,
      isDemo: false,
      contactConsent: true,
      passwordHash: hashPassword(input.password),
      role: 'donor',
      createdAt: now,
      updatedAt: now,
    };

    await store.createDonor(record);
    const token = signAuthToken({ sub: record.id, role: 'donor', email: record.email });

    res.status(201).json({
      token,
      role: 'donor',
      donor: toPrivateDonor(record),
      message: 'Registration successful. Welcome to BloodConnect.',
    });
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const email = cleanString(req.body?.email, 150).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      res.status(400).json({ error: 'Email address and password are required.' });
      return;
    }

    const donor = await store.findDonorByEmail(email);
    if (!donor || !verifyPassword(password, donor.passwordHash)) {
      res.status(401).json({ error: 'Invalid email address or password.' });
      return;
    }

    if (!donor.isActive) {
      res.status(403).json({
        error: 'This donor account has been deactivated. Contact support for assistance.',
      });
      return;
    }

    const token = signAuthToken({ sub: donor.id, role: 'donor', email: donor.email });
    res.json({
      token,
      role: 'donor',
      donor: toPrivateDonor(donor),
    });
  });

  app.get('/api/auth/admin/status', async (_req: Request, res: Response) => {
    const envPassword = (process.env.ADMIN_PASSWORD || '').trim();
    const envEmail = (process.env.ADMIN_EMAIL || 'admin@bloodconnect.org').trim().toLowerCase();
    if (envPassword.length > 0) {
      res.json({ needsSetup: false, envConfigured: true, adminEmailHint: envEmail });
      return;
    }
    const storedAdmin = await store.getAdminConfig();
    res.json({
      needsSetup: !storedAdmin,
      envConfigured: false,
      adminEmailHint: storedAdmin?.email,
    });
  });

  app.post('/api/auth/admin/setup', async (req: Request, res: Response) => {
    const envPassword = (process.env.ADMIN_PASSWORD || '').trim();
    if (envPassword.length > 0) {
      res.status(403).json({ error: 'Admin credentials are managed via server environment.' });
      return;
    }

    const email = cleanString(req.body?.email, 150).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const confirmPassword =
      typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid administrator email address.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Admin password must be at least 8 characters long.' });
      return;
    }
    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Admin passwords do not match.' });
      return;
    }

    const claimed = await store.claimAdminConfig({
      id: 'primary-admin',
      email,
      passwordHash: hashPassword(password),
      claimedAt: new Date().toISOString(),
    });

    if (!claimed) {
      res.status(409).json({
        error: 'An administrator account has already been configured. Please sign in instead.',
      });
      return;
    }

    const token = signAuthToken({ sub: 'primary-admin', role: 'admin', email });
    res.status(201).json({
      token,
      role: 'admin',
      adminEmail: email,
      message: 'Administrator account created and signed in.',
    });
  });

  app.post('/api/auth/admin/login', async (req: Request, res: Response) => {
    const email = cleanString(req.body?.email, 150).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      res.status(400).json({ error: 'Administrator email and password are required.' });
      return;
    }

    const envPassword = (process.env.ADMIN_PASSWORD || '').trim();
    const envEmail = (process.env.ADMIN_EMAIL || 'admin@bloodconnect.org').trim().toLowerCase();

    if (envPassword.length > 0) {
      if (safeCompareStrings(email, envEmail) && safeCompareStrings(password, envPassword)) {
        const token = signAuthToken({ sub: 'env-admin', role: 'admin', email: envEmail });
        res.json({ token, role: 'admin', adminEmail: envEmail });
        return;
      }
      res.status(401).json({ error: 'Invalid administrator credentials.' });
      return;
    }

    const storedAdmin = await store.getAdminConfig();
    if (!storedAdmin) {
      res.status(409).json({
        error: 'Admin setup has not been completed yet. Complete the initial setup form first.',
        needsSetup: true,
      });
      return;
    }

    if (
      !safeCompareStrings(email, storedAdmin.email.toLowerCase()) ||
      !verifyPassword(password, storedAdmin.passwordHash)
    ) {
      res.status(401).json({ error: 'Invalid administrator credentials.' });
      return;
    }

    const token = signAuthToken({ sub: storedAdmin.id, role: 'admin', email: storedAdmin.email });
    res.json({ token, role: 'admin', adminEmail: storedAdmin.email });
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (req.auth?.role === 'admin') {
      res.json({ role: 'admin', adminEmail: req.auth.email });
      return;
    }
    const donor = await store.findDonorById(req.auth!.sub);
    if (!donor) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    res.json({ role: 'donor', donor: toPrivateDonor(donor) });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (req.rawToken) {
      revokeAuthToken(req.rawToken);
    }
    res.json({ message: 'Signed out successfully.' });
  });

  // =========================================================
  // Protected Donor Dashboard Routes
  // =========================================================
  app.get('/api/donor/profile', requireDonor, async (req: AuthenticatedRequest, res: Response) => {
    const donor = await store.findDonorById(req.auth!.sub);
    if (!donor) {
      res.status(404).json({ error: 'Donor profile not found.' });
      return;
    }
    res.json({ donor: toPrivateDonor(donor) });
  });

  app.put('/api/donor/profile', requireDonor, async (req: AuthenticatedRequest, res: Response) => {
    const existing = await store.findDonorById(req.auth!.sub);
    if (!existing) {
      res.status(404).json({ error: 'Donor profile not found.' });
      return;
    }

    const body = req.body ?? {};
    const candidate = {
      fullName: cleanString(body.fullName ?? existing.fullName, 120),
      age: body.age !== undefined ? Number(body.age) : existing.age,
      gender: cleanString(body.gender ?? existing.gender, 30),
      bloodGroup: cleanString(body.bloodGroup ?? existing.bloodGroup, 10),
      mobile: cleanString(body.mobile ?? existing.mobile, 20),
      email: existing.email,
      state: cleanString(body.state ?? existing.state, 80),
      district: cleanString(body.district ?? existing.district, 80),
      city: cleanString(body.city ?? existing.city, 80),
      areaPincode: cleanString(body.areaPincode ?? existing.areaPincode, 120),
      lastDonationDate:
        body.lastDonationDate !== undefined
          ? cleanString(body.lastDonationDate, 30)
          : existing.lastDonationDate ?? '',
      availabilityStatus: cleanString(
        body.availabilityStatus ?? existing.availabilityStatus,
        40
      ),
      password: '',
      confirmPassword: '',
      contactConsent: existing.contactConsent,
    };

    const validation = validateDonorRegistration(candidate, { requirePassword: false });
    if (!validation.valid) {
      res.status(400).json({ error: 'Invalid profile details.', errors: validation.errors });
      return;
    }

    const updated = await store.updateDonor(existing.id, {
      fullName: candidate.fullName,
      age: candidate.age,
      gender: candidate.gender as DonorRecord['gender'],
      bloodGroup: candidate.bloodGroup as BloodGroup,
      mobile: normalizeMobile(candidate.mobile),
      state: candidate.state,
      district: candidate.district,
      city: candidate.city,
      areaPincode: candidate.areaPincode,
      lastDonationDate: candidate.lastDonationDate || null,
      shareLastDonation:
        body.shareLastDonation !== undefined
          ? Boolean(body.shareLastDonation)
          : existing.shareLastDonation,
      availabilityStatus: candidate.availabilityStatus as DonorRecord['availabilityStatus'],
      updatedAt: new Date().toISOString(),
    });

    res.json({ donor: toPrivateDonor(updated!), message: 'Profile updated successfully.' });
  });

  app.patch(
    '/api/donor/availability',
    requireDonor,
    async (req: AuthenticatedRequest, res: Response) => {
      const status = cleanString(req.body?.availabilityStatus, 40);
      if (!isValidAvailability(status)) {
        res.status(400).json({ error: 'Invalid availability status.' });
        return;
      }
      const updated = await store.updateDonor(req.auth!.sub, {
        availabilityStatus: status,
        updatedAt: new Date().toISOString(),
      });
      if (!updated) {
        res.status(404).json({ error: 'Donor not found.' });
        return;
      }
      res.json({ donor: toPrivateDonor(updated), message: `Availability updated to ${status}.` });
    }
  );

  app.post(
    '/api/donor/change-password',
    requireDonor,
    async (req: AuthenticatedRequest, res: Response) => {
      const currentPassword =
        typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
      const confirmPassword =
        typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';

      const donor = await store.findDonorById(req.auth!.sub);
      if (!donor) {
        res.status(404).json({ error: 'Donor account not found.' });
        return;
      }

      if (!verifyPassword(currentPassword, donor.passwordHash)) {
        res.status(400).json({ error: 'Current password is incorrect.' });
        return;
      }
      if (newPassword.length < 8) {
        res.status(400).json({ error: 'New password must be at least 8 characters long.' });
        return;
      }
      if (newPassword !== confirmPassword) {
        res.status(400).json({ error: 'New passwords do not match.' });
        return;
      }

      await store.updateDonor(donor.id, {
        passwordHash: hashPassword(newPassword),
        updatedAt: new Date().toISOString(),
      });

      res.json({ message: 'Password updated successfully.' });
    }
  );

  app.delete(
    '/api/donor/account',
    requireDonor,
    async (req: AuthenticatedRequest, res: Response) => {
      const deleted = await store.deleteDonor(req.auth!.sub);
      if (!deleted) {
        res.status(404).json({ error: 'Account not found.' });
        return;
      }
      if (req.rawToken) {
        revokeAuthToken(req.rawToken);
      }
      res.json({ message: 'Your donor account and profile have been permanently deleted.' });
    }
  );

  app.get('/api/donor/requests', requireDonor, async (req: AuthenticatedRequest, res: Response) => {
    const all = await store.listContactRequests();
    const incoming = all.filter((r) => r.donorId === req.auth!.sub);
    const outgoing = all.filter((r) => r.requesterUserId === req.auth!.sub);
    res.json({ incoming, outgoing });
  });

  app.patch(
    '/api/donor/requests/:id',
    requireDonor,
    async (req: AuthenticatedRequest, res: Response) => {
      const id = cleanString(req.params.id, 80);
      const decision = cleanString(req.body?.status, 20);
      const responseNote = cleanString(req.body?.donorResponseNote, 300);

      if (!['accepted', 'declined', 'completed'].includes(decision)) {
        res.status(400).json({ error: 'Invalid request decision.' });
        return;
      }

      const existing = await store.findContactRequestById(id);
      if (!existing || existing.donorId !== req.auth!.sub) {
        res.status(404).json({ error: 'Contact request not found.' });
        return;
      }

      const donor = await store.findDonorById(req.auth!.sub);
      if (!donor) {
        res.status(404).json({ error: 'Donor account not found.' });
        return;
      }

      const updates: Partial<ContactRequest> = {
        status: decision as ContactRequest['status'],
        donorResponseNote: responseNote || existing.donorResponseNote,
        updatedAt: new Date().toISOString(),
      };

      // Only reveal donor's personal mobile/email upon explicit donor acceptance
      if (decision === 'accepted' || decision === 'completed') {
        updates.sharedDonorContact = {
          mobile: donor.mobile,
          email: donor.email,
        };
      } else if (decision === 'declined') {
        updates.sharedDonorContact = undefined;
      }

      const updated = await store.updateContactRequest(id, updates);
      res.json({
        request: updated,
        message:
          decision === 'accepted'
            ? 'Request accepted. Your contact information is now shared with this requester.'
            : decision === 'completed'
              ? 'Request marked as completed.'
              : 'Request declined. Your contact information remains private.',
      });
    }
  );

  app.get(
    '/api/donor/search-history',
    requireDonor,
    async (req: AuthenticatedRequest, res: Response) => {
      const history = await store.listSearchHistory(req.auth!.sub);
      res.json({ history });
    }
  );

  app.delete(
    '/api/donor/search-history',
    requireDonor,
    async (req: AuthenticatedRequest, res: Response) => {
      await store.clearSearchHistory(req.auth!.sub);
      res.json({ message: 'Search history cleared.' });
    }
  );

  // =========================================================
  // Consent-Based Contact Requests & Status Tracking
  // =========================================================
  app.post('/api/requests', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    const body = req.body ?? {};
    const input = {
      donorId: cleanString(body.donorId, 80),
      requesterName: cleanString(body.requesterName, 120),
      requesterPhone: cleanString(body.requesterPhone, 20),
      requesterEmail: cleanString(body.requesterEmail, 150).toLowerCase(),
      hospitalName: cleanString(body.hospitalName, 160),
      city: cleanString(body.city, 80),
      unitsNeeded: Number(body.unitsNeeded ?? 1),
      urgency: cleanString(body.urgency, 20) || 'Urgent',
      message: cleanString(body.message, 500),
    };

    const validation = validateContactRequest(input);
    if (!validation.valid) {
      res.status(400).json({ error: 'Please correct the request fields.', errors: validation.errors });
      return;
    }

    const donor = await store.findDonorById(input.donorId);
    if (!donor || !donor.isActive) {
      res.status(404).json({ error: 'Selected donor is no longer available.' });
      return;
    }

    const now = new Date().toISOString();
    const record: ContactRequest = {
      id: `creq-${crypto.randomUUID().slice(0, 12)}`,
      trackingCode: generateTrackingCode('REQ'),
      donorId: donor.id,
      donorName: donor.fullName,
      donorBloodGroup: donor.bloodGroup,
      donorCity: donor.city,
      donorDistrict: donor.district,
      requesterUserId: req.auth?.role === 'donor' ? req.auth.sub : null,
      requesterName: input.requesterName,
      requesterPhone: normalizeMobile(input.requesterPhone),
      requesterEmail: input.requesterEmail,
      hospitalName: input.hospitalName,
      city: input.city,
      unitsNeeded: input.unitsNeeded,
      urgency: input.urgency as ContactRequest['urgency'],
      message: input.message,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await store.createContactRequest(record);
    res.status(201).json({
      request: record,
      message:
        'Contact request sent securely. Once the donor accepts, their contact details will appear under your tracking code.',
    });
  });

  app.get('/api/requests/track/:code', async (req: Request, res: Response) => {
    const code = cleanString(req.params.code, 40).toUpperCase();
    if (!code) {
      res.status(400).json({ error: 'Tracking code is required.' });
      return;
    }

    const contactReq = await store.findContactRequestByCode(code);
    if (contactReq) {
      // Only include sharedDonorContact if donor accepted/completed
      const safeReq: ContactRequest = {
        ...contactReq,
        requesterPhone: maskPhoneNumber(contactReq.requesterPhone),
        sharedDonorContact:
          contactReq.status === 'accepted' || contactReq.status === 'completed'
            ? contactReq.sharedDonorContact
            : undefined,
      };
      res.json({ type: 'contact', request: safeReq });
      return;
    }

    const emergencyReq = await store.findEmergencyByCode(code);
    if (emergencyReq) {
      res.json({
        type: 'emergency',
        request: {
          ...emergencyReq,
          requesterPhone: maskPhoneNumber(emergencyReq.requesterPhone),
        },
      });
      return;
    }

    res.status(404).json({ error: `No blood request found for tracking code "${code}".` });
  });

  // =========================================================
  // Emergency Blood Requests, Reports, Contact Form
  // =========================================================
  app.get('/api/emergency', async (_req: Request, res: Response) => {
    const list = await store.listEmergencyRequests();
    const safeList = list.map((item) => ({
      ...item,
      requesterPhone: maskPhoneNumber(item.requesterPhone),
    }));
    res.json({ requests: safeList });
  });

  app.post('/api/emergency', async (req: Request, res: Response) => {
    const body = req.body ?? {};
    const input = {
      patientName: cleanString(body.patientName, 120),
      requesterName: cleanString(body.requesterName, 120),
      requesterPhone: cleanString(body.requesterPhone, 20),
      bloodGroup: cleanString(body.bloodGroup, 10),
      unitsRequired: Number(body.unitsRequired ?? 1),
      hospitalName: cleanString(body.hospitalName, 160),
      state: cleanString(body.state, 80),
      district: cleanString(body.district, 80),
      city: cleanString(body.city, 80),
      urgency: cleanString(body.urgency, 20) || 'Urgent',
      requiredByDate: cleanString(body.requiredByDate, 30),
      notes: cleanString(body.notes, 500),
    };

    const validation = validateEmergencyRequest(input);
    if (!validation.valid) {
      res.status(400).json({ error: 'Please correct the emergency request fields.', errors: validation.errors });
      return;
    }

    const now = new Date().toISOString();
    const record: EmergencyRequest = {
      id: `emg-${crypto.randomUUID().slice(0, 12)}`,
      trackingCode: generateTrackingCode('EMG'),
      patientName: input.patientName,
      requesterName: input.requesterName,
      requesterPhone: normalizeMobile(input.requesterPhone),
      bloodGroup: input.bloodGroup as BloodGroup,
      unitsRequired: input.unitsRequired,
      hospitalName: input.hospitalName,
      state: input.state,
      district: input.district,
      city: input.city,
      urgency: input.urgency as EmergencyRequest['urgency'],
      requiredByDate: input.requiredByDate,
      notes: input.notes,
      status: 'Open',
      isDemo: false,
      createdAt: now,
      updatedAt: now,
    };

    await store.createEmergencyRequest(record);
    res.status(201).json({
      request: { ...record, requesterPhone: maskPhoneNumber(record.requesterPhone) },
      trackingCode: record.trackingCode,
      message: 'Emergency blood request published and logged for coordination.',
    });
  });

  app.post('/api/reports', async (req: Request, res: Response) => {
    const donorId = cleanString(req.body?.donorId, 80);
    const reason = cleanString(req.body?.reason, 60);
    const details = cleanString(req.body?.details, 500);
    const reporterEmail = cleanString(req.body?.reporterEmail, 150).toLowerCase();

    const allowedReasons = [
      'Outdated Contact Info',
      'Inaccurate Blood Group',
      'Inappropriate Behaviour',
      'Duplicate Record',
      'Other',
    ];

    if (!donorId || !allowedReasons.includes(reason) || details.length < 10) {
      res.status(400).json({
        error: 'Please select a valid reason and describe the issue (at least 10 characters).',
      });
      return;
    }

    const donor = await store.findDonorById(donorId);
    if (!donor) {
      res.status(404).json({ error: 'Reported donor record not found.' });
      return;
    }

    const now = new Date().toISOString();
    const report: AbuseReport = {
      id: `rep-${crypto.randomUUID().slice(0, 12)}`,
      donorId: donor.id,
      donorName: donor.fullName,
      reason: reason as AbuseReport['reason'],
      details,
      reporterEmail: reporterEmail || 'anonymous@bloodconnect.user',
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };

    await store.createReport(report);
    res.status(201).json({
      report,
      message: 'Thank you. Our administrative team will review this record.',
    });
  });

  app.post('/api/contact', async (req: Request, res: Response) => {
    const name = cleanString(req.body?.name, 120);
    const email = cleanString(req.body?.email, 150).toLowerCase();
    const subject = cleanString(req.body?.subject, 160);
    const message = cleanString(req.body?.message, 1500);

    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || message.length < 10) {
      res.status(400).json({
        error: 'Please enter a valid name, email address, and message (at least 10 characters).',
      });
      return;
    }

    const record: ContactMessage = {
      id: `msg-${crypto.randomUUID().slice(0, 12)}`,
      name,
      email,
      subject: subject || 'General Inquiry',
      message,
      createdAt: new Date().toISOString(),
    };

    await store.createContactMessage(record);
    res.status(201).json({ message: 'Your message has been received. Our healthcare desk will respond shortly.' });
  });

  // =========================================================
  // Protected Admin Dashboard Routes (RBAC)
  // =========================================================
  app.get('/api/admin/overview', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    const [donors, contactRequests, emergencyRequests, reports, messages] = await Promise.all([
      store.listDonors(),
      store.listContactRequests(),
      store.listEmergencyRequests(),
      store.listReports(),
      store.listContactMessages(),
    ]);

    const byBloodGroup = BLOOD_GROUPS.reduce(
      (acc, bg) => {
        acc[bg] = 0;
        return acc;
      },
      {} as Record<BloodGroup, number>
    );
    for (const d of donors) {
      if (byBloodGroup[d.bloodGroup] !== undefined) {
        byBloodGroup[d.bloodGroup] += 1;
      }
    }

    res.json({
      stats: {
        totalDonors: donors.length,
        activeDonors: donors.filter((d) => d.isActive).length,
        availableDonors: donors.filter((d) => d.isActive && d.availabilityStatus === 'Available')
          .length,
        verifiedDonors: donors.filter((d) => d.verified).length,
        bloodGroupCount: BLOOD_GROUPS.length,
        pendingVerifications: donors.filter((d) => !d.verified).length,
        openReports: reports.filter((r) => r.status === 'open').length,
        openEmergencyRequests: emergencyRequests.filter(
          (e) => e.status === 'Open' || e.status === 'Coordinating'
        ).length,
        totalContactRequests: contactRequests.length,
        acceptedConnections: contactRequests.filter(
          (r) => r.status === 'accepted' || r.status === 'completed'
        ).length,
        unreadMessages: messages.length,
        byBloodGroup,
        storageMode: store.mode,
      },
    });
  });

  app.get('/api/admin/donors', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const query = cleanString(req.query.q, 100).toLowerCase();
    const bloodGroup = cleanString(req.query.bloodGroup, 10);
    const state = cleanString(req.query.state, 80).toLowerCase();
    const statusFilter = cleanString(req.query.status, 30);

    const all = await store.listDonors();
    const filtered = all
      .filter((d) => {
        if (bloodGroup && d.bloodGroup !== bloodGroup) return false;
        if (state && d.state.toLowerCase() !== state) return false;
        if (statusFilter === 'pending' && d.verified) return false;
        if (statusFilter === 'verified' && !d.verified) return false;
        if (statusFilter === 'inactive' && d.isActive) return false;
        if (query) {
          const hay = `${d.fullName} ${d.email} ${d.mobile} ${d.city} ${d.district} ${d.areaPincode} ${d.bloodGroup}`.toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .map(toPrivateDonor);

    res.json({ donors: filtered, total: filtered.length });
  });

  app.post('/api/admin/donors', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const body = req.body ?? {};
    const password =
      typeof body.password === 'string' && body.password.length >= 8
        ? body.password
        : crypto.randomBytes(12).toString('base64url');

    const input = {
      fullName: cleanString(body.fullName, 120),
      age: Number(body.age),
      gender: cleanString(body.gender, 30),
      bloodGroup: cleanString(body.bloodGroup, 10),
      mobile: cleanString(body.mobile, 20),
      email: cleanString(body.email, 150).toLowerCase(),
      state: cleanString(body.state, 80),
      district: cleanString(body.district, 80),
      city: cleanString(body.city, 80),
      areaPincode: cleanString(body.areaPincode, 120),
      lastDonationDate: cleanString(body.lastDonationDate, 30),
      availabilityStatus: cleanString(body.availabilityStatus, 40) || 'Available',
      password,
      confirmPassword: password,
      contactConsent: true,
    };

    const validation = validateDonorRegistration(input, { requirePassword: false });
    if (!validation.valid) {
      res.status(400).json({ error: 'Invalid donor record fields.', errors: validation.errors });
      return;
    }

    const existing = await store.findDonorByEmail(input.email);
    if (existing) {
      res.status(409).json({ error: 'A donor record with this email already exists.' });
      return;
    }

    const now = new Date().toISOString();
    const record: DonorRecord = {
      id: `donor-${crypto.randomUUID().slice(0, 12)}`,
      fullName: input.fullName,
      age: input.age,
      gender: input.gender as DonorRecord['gender'],
      bloodGroup: input.bloodGroup as BloodGroup,
      mobile: normalizeMobile(input.mobile),
      email: input.email,
      state: input.state,
      district: input.district,
      city: input.city,
      areaPincode: input.areaPincode,
      lastDonationDate: input.lastDonationDate || null,
      shareLastDonation: true,
      availabilityStatus: input.availabilityStatus as DonorRecord['availabilityStatus'],
      verified: Boolean(body.verified),
      isActive: body.isActive !== false,
      isDemo: false,
      contactConsent: true,
      passwordHash: hashPassword(password),
      role: 'donor',
      createdAt: now,
      updatedAt: now,
    };

    await store.createDonor(record);
    res.status(201).json({ donor: toPrivateDonor(record), message: 'Donor record created.' });
  });

  app.put('/api/admin/donors/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const id = cleanString(req.params.id, 80);
    const existing = await store.findDonorById(id);
    if (!existing) {
      res.status(404).json({ error: 'Donor record not found.' });
      return;
    }

    const body = req.body ?? {};
    const updates: Partial<DonorRecord> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.fullName !== undefined) updates.fullName = cleanString(body.fullName, 120);
    if (body.age !== undefined) {
      const age = Number(body.age);
      if (!Number.isInteger(age) || age < 18 || age > 65) {
        res.status(400).json({ error: 'Age must be an integer between 18 and 65.' });
        return;
      }
      updates.age = age;
    }
    if (body.gender !== undefined && isValidGender(cleanString(body.gender, 30))) {
      updates.gender = cleanString(body.gender, 30) as DonorRecord['gender'];
    }
    if (body.bloodGroup !== undefined && isValidBloodGroup(cleanString(body.bloodGroup, 10))) {
      updates.bloodGroup = cleanString(body.bloodGroup, 10) as BloodGroup;
    }
    if (body.mobile !== undefined) {
      const mobile = normalizeMobile(cleanString(body.mobile, 20));
      if (!/^[6-9]\d{9}$/.test(mobile)) {
        res.status(400).json({ error: 'Valid 10-digit mobile number is required.' });
        return;
      }
      updates.mobile = mobile;
    }
    if (body.state !== undefined) updates.state = cleanString(body.state, 80);
    if (body.district !== undefined) updates.district = cleanString(body.district, 80);
    if (body.city !== undefined) updates.city = cleanString(body.city, 80);
    if (body.areaPincode !== undefined) updates.areaPincode = cleanString(body.areaPincode, 120);
    if (body.lastDonationDate !== undefined) {
      updates.lastDonationDate = cleanString(body.lastDonationDate, 30) || null;
    }
    if (
      body.availabilityStatus !== undefined &&
      isValidAvailability(cleanString(body.availabilityStatus, 40))
    ) {
      updates.availabilityStatus = cleanString(
        body.availabilityStatus,
        40
      ) as DonorRecord['availabilityStatus'];
    }
    if (body.verified !== undefined) updates.verified = Boolean(body.verified);
    if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);

    const updated = await store.updateDonor(id, updates);
    res.json({ donor: toPrivateDonor(updated!), message: 'Donor record updated.' });
  });

  app.patch(
    '/api/admin/donors/:id/verify',
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response) => {
      const id = cleanString(req.params.id, 80);
      const verified = Boolean(req.body?.verified);
      const updated = await store.updateDonor(id, {
        verified,
        updatedAt: new Date().toISOString(),
      });
      if (!updated) {
        res.status(404).json({ error: 'Donor record not found.' });
        return;
      }
      res.json({
        donor: toPrivateDonor(updated),
        message: verified ? 'Donor profile verified.' : 'Donor verification revoked.',
      });
    }
  );

  app.delete(
    '/api/admin/donors/:id',
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response) => {
      const id = cleanString(req.params.id, 80);
      const ok = await store.deleteDonor(id);
      if (!ok) {
        res.status(404).json({ error: 'Donor record not found.' });
        return;
      }
      res.json({ message: 'Donor record permanently deleted.' });
    }
  );

  app.get('/api/admin/reports', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    const reports = await store.listReports();
    res.json({ reports });
  });

  app.patch(
    '/api/admin/reports/:id',
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response) => {
      const id = cleanString(req.params.id, 80);
      const status = cleanString(req.body?.status, 20);
      const adminNote = cleanString(req.body?.adminNote, 300);

      if (!['open', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
        res.status(400).json({ error: 'Invalid report status.' });
        return;
      }

      const updated = await store.updateReport(id, {
        status: status as ReportStatus,
        adminNote,
        updatedAt: new Date().toISOString(),
      });
      if (!updated) {
        res.status(404).json({ error: 'Report not found.' });
        return;
      }
      res.json({ report: updated, message: `Report marked as ${status}.` });
    }
  );

  app.get('/api/admin/emergency', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    const requests = await store.listEmergencyRequests();
    res.json({ requests });
  });

  app.patch(
    '/api/admin/emergency/:id',
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response) => {
      const id = cleanString(req.params.id, 80);
      const status = cleanString(req.body?.status, 30);
      if (!['Open', 'Coordinating', 'Fulfilled', 'Closed'].includes(status)) {
        res.status(400).json({ error: 'Invalid emergency request status.' });
        return;
      }
      const updated = await store.updateEmergencyRequest(id, {
        status: status as EmergencyStatus,
        updatedAt: new Date().toISOString(),
      });
      if (!updated) {
        res.status(404).json({ error: 'Emergency request not found.' });
        return;
      }
      res.json({ request: updated, message: `Emergency request updated to ${status}.` });
    }
  );

  app.delete(
    '/api/admin/emergency/:id',
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response) => {
      const id = cleanString(req.params.id, 80);
      const ok = await store.deleteEmergencyRequest(id);
      if (!ok) {
        res.status(404).json({ error: 'Emergency request not found.' });
        return;
      }
      res.json({ message: 'Emergency request removed.' });
    }
  );

  app.get('/api/admin/messages', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    const messages = await store.listContactMessages();
    res.json({ messages });
  });

  // =========================================================
  // Vite Dev Middleware / Static Production Assets
  // =========================================================
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[BloodConnect] Server running at http://0.0.0.0:${port} (storage: ${store.mode})`);
  });
}

startServer().catch((err) => {
  console.error('[BloodConnect] Failed to start server:', err);
  process.exit(1);
});
