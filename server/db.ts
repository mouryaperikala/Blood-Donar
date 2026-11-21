import fs from 'node:fs';
import path from 'node:path';
import { MongoClient, type Db } from 'mongodb';
import { buildDemoSeedData } from './seedData';
import type {
  AbuseReport,
  ContactMessage,
  ContactRequest,
  DonorPrivate,
  DonorPublic,
  DonorRecord,
  EmergencyRequest,
  SearchHistoryItem,
} from '../src/shared/types';

export interface AdminConfigRecord {
  id: 'primary-admin';
  email: string;
  passwordHash: string;
  claimedAt: string;
}

interface LocalDatabaseSnapshot {
  donors: DonorRecord[];
  contactRequests: ContactRequest[];
  emergencyRequests: EmergencyRequest[];
  reports: AbuseReport[];
  searchHistory: SearchHistoryItem[];
  contactMessages: ContactMessage[];
  adminConfig: AdminConfigRecord | null;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'bloodconnect.json');

export function toPublicDonor(record: DonorRecord): DonorPublic {
  return {
    id: record.id,
    fullName: record.fullName,
    age: record.age,
    gender: record.gender,
    bloodGroup: record.bloodGroup,
    state: record.state,
    district: record.district,
    city: record.city,
    areaPincode: record.areaPincode,
    lastDonationDate: record.shareLastDonation ? record.lastDonationDate : null,
    shareLastDonation: record.shareLastDonation,
    availabilityStatus: record.availabilityStatus,
    verified: record.verified,
    isActive: record.isActive,
    isDemo: record.isDemo,
    updatedAt: record.updatedAt,
    createdAt: record.createdAt,
  };
}

export function toPrivateDonor(record: DonorRecord): DonorPrivate {
  const { passwordHash: _ignored, role: _role, ...rest } = record;
  return rest;
}

export class BloodConnectStore {
  private mongoClient: MongoClient | null = null;
  private mongoDb: Db | null = null;
  private localData: LocalDatabaseSnapshot | null = null;
  public mode: 'mongodb' | 'local-file' = 'local-file';

  async init(): Promise<void> {
    const uri = (process.env.MONGODB_URI || '').trim();
    const dbName = (process.env.MONGODB_DB_NAME || 'bloodconnect').trim();

    if (uri) {
      try {
        const client = new MongoClient(uri, { serverSelectionTimeoutMS: 4000 });
        await client.connect();
        this.mongoClient = client;
        this.mongoDb = client.db(dbName);
        this.mode = 'mongodb';
        await this.ensureMongoSeeded();
        return;
      } catch (err) {
        console.warn(
          '[BloodConnect] Could not connect to MONGODB_URI; falling back to local persistent document store.',
          err instanceof Error ? err.message : ''
        );
      }
    }

    this.mode = 'local-file';
    this.loadOrCreateLocalFile();
  }

  private async ensureMongoSeeded(): Promise<void> {
    if (!this.mongoDb) return;
    const count = await this.mongoDb.collection<DonorRecord>('donors').countDocuments();
    if (count === 0) {
      const seed = buildDemoSeedData();
      if (seed.donors.length > 0) {
        await this.mongoDb.collection<DonorRecord>('donors').insertMany(seed.donors);
      }
      if (seed.contactRequests.length > 0) {
        await this.mongoDb
          .collection<ContactRequest>('contactRequests')
          .insertMany(seed.contactRequests);
      }
      if (seed.emergencyRequests.length > 0) {
        await this.mongoDb
          .collection<EmergencyRequest>('emergencyRequests')
          .insertMany(seed.emergencyRequests);
      }
      if (seed.reports.length > 0) {
        await this.mongoDb.collection<AbuseReport>('reports').insertMany(seed.reports);
      }
    }
  }

  private loadOrCreateLocalFile(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw) as Partial<LocalDatabaseSnapshot>;
        if (Array.isArray(parsed.donors)) {
          this.localData = {
            donors: parsed.donors,
            contactRequests: Array.isArray(parsed.contactRequests) ? parsed.contactRequests : [],
            emergencyRequests: Array.isArray(parsed.emergencyRequests)
              ? parsed.emergencyRequests
              : [],
            reports: Array.isArray(parsed.reports) ? parsed.reports : [],
            searchHistory: Array.isArray(parsed.searchHistory) ? parsed.searchHistory : [],
            contactMessages: Array.isArray(parsed.contactMessages) ? parsed.contactMessages : [],
            adminConfig: parsed.adminConfig ?? null,
          };
          return;
        }
      } catch {
        // Fall through to re-seed cleanly if file is corrupted
      }
    }

    const seed = buildDemoSeedData();
    this.localData = {
      donors: seed.donors,
      contactRequests: seed.contactRequests,
      emergencyRequests: seed.emergencyRequests,
      reports: seed.reports,
      searchHistory: [],
      contactMessages: [],
      adminConfig: null,
    };
    this.persistLocal();
  }

  private persistLocal(): void {
    if (!this.localData) return;
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpPath = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(this.localData, null, 2), 'utf8');
    fs.renameSync(tmpPath, DATA_FILE);
  }

  // --- Admin Config ---
  async getAdminConfig(): Promise<AdminConfigRecord | null> {
    if (this.mongoDb) {
      const doc = await this.mongoDb
        .collection<AdminConfigRecord>('adminConfig')
        .findOne({ id: 'primary-admin' });
      return doc ?? null;
    }
    return this.localData?.adminConfig ?? null;
  }

  async claimAdminConfig(record: AdminConfigRecord): Promise<boolean> {
    if (this.mongoDb) {
      const existing = await this.getAdminConfig();
      if (existing) return false;
      await this.mongoDb.collection<AdminConfigRecord>('adminConfig').insertOne(record);
      return true;
    }
    if (!this.localData) return false;
    if (this.localData.adminConfig) return false;
    this.localData.adminConfig = record;
    this.persistLocal();
    return true;
  }

  // --- Donors ---
  async listDonors(): Promise<DonorRecord[]> {
    if (this.mongoDb) {
      return this.mongoDb.collection<DonorRecord>('donors').find({}).toArray();
    }
    return [...(this.localData?.donors ?? [])];
  }

  async findDonorById(id: string): Promise<DonorRecord | null> {
    if (this.mongoDb) {
      return (await this.mongoDb.collection<DonorRecord>('donors').findOne({ id })) ?? null;
    }
    return this.localData?.donors.find((d) => d.id === id) ?? null;
  }

  async findDonorByEmail(email: string): Promise<DonorRecord | null> {
    const normalized = email.trim().toLowerCase();
    if (this.mongoDb) {
      return (
        (await this.mongoDb
          .collection<DonorRecord>('donors')
          .findOne({ email: normalized })) ?? null
      );
    }
    return (
      this.localData?.donors.find((d) => d.email.toLowerCase() === normalized) ?? null
    );
  }

  async createDonor(donor: DonorRecord): Promise<DonorRecord> {
    if (this.mongoDb) {
      await this.mongoDb.collection<DonorRecord>('donors').insertOne(donor);
      return donor;
    }
    this.localData!.donors.unshift(donor);
    this.persistLocal();
    return donor;
  }

  async updateDonor(id: string, updates: Partial<DonorRecord>): Promise<DonorRecord | null> {
    if (this.mongoDb) {
      const result = await this.mongoDb
        .collection<DonorRecord>('donors')
        .findOneAndUpdate({ id }, { $set: updates }, { returnDocument: 'after' });
      return result ?? null;
    }
    const idx = this.localData!.donors.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    this.localData!.donors[idx] = { ...this.localData!.donors[idx], ...updates };
    this.persistLocal();
    return this.localData!.donors[idx];
  }

  async deleteDonor(id: string): Promise<boolean> {
    if (this.mongoDb) {
      const res = await this.mongoDb.collection<DonorRecord>('donors').deleteOne({ id });
      return res.deletedCount > 0;
    }
    const before = this.localData!.donors.length;
    this.localData!.donors = this.localData!.donors.filter((d) => d.id !== id);
    if (this.localData!.donors.length !== before) {
      this.persistLocal();
      return true;
    }
    return false;
  }

  // --- Contact Requests ---
  async listContactRequests(): Promise<ContactRequest[]> {
    if (this.mongoDb) {
      return this.mongoDb
        .collection<ContactRequest>('contactRequests')
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
    }
    return [...(this.localData?.contactRequests ?? [])].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );
  }

  async findContactRequestById(id: string): Promise<ContactRequest | null> {
    if (this.mongoDb) {
      return (
        (await this.mongoDb.collection<ContactRequest>('contactRequests').findOne({ id })) ??
        null
      );
    }
    return this.localData?.contactRequests.find((r) => r.id === id) ?? null;
  }

  async findContactRequestByCode(trackingCode: string): Promise<ContactRequest | null> {
    const code = trackingCode.trim().toUpperCase();
    if (this.mongoDb) {
      return (
        (await this.mongoDb
          .collection<ContactRequest>('contactRequests')
          .findOne({ trackingCode: code })) ?? null
      );
    }
    return (
      this.localData?.contactRequests.find((r) => r.trackingCode.toUpperCase() === code) ?? null
    );
  }

  async createContactRequest(req: ContactRequest): Promise<ContactRequest> {
    if (this.mongoDb) {
      await this.mongoDb.collection<ContactRequest>('contactRequests').insertOne(req);
      return req;
    }
    this.localData!.contactRequests.unshift(req);
    this.persistLocal();
    return req;
  }

  async updateContactRequest(
    id: string,
    updates: Partial<ContactRequest>
  ): Promise<ContactRequest | null> {
    if (this.mongoDb) {
      const result = await this.mongoDb
        .collection<ContactRequest>('contactRequests')
        .findOneAndUpdate({ id }, { $set: updates }, { returnDocument: 'after' });
      return result ?? null;
    }
    const idx = this.localData!.contactRequests.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.localData!.contactRequests[idx] = {
      ...this.localData!.contactRequests[idx],
      ...updates,
    };
    this.persistLocal();
    return this.localData!.contactRequests[idx];
  }

  // --- Emergency Requests ---
  async listEmergencyRequests(): Promise<EmergencyRequest[]> {
    if (this.mongoDb) {
      return this.mongoDb
        .collection<EmergencyRequest>('emergencyRequests')
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
    }
    return [...(this.localData?.emergencyRequests ?? [])].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );
  }

  async findEmergencyByCode(trackingCode: string): Promise<EmergencyRequest | null> {
    const code = trackingCode.trim().toUpperCase();
    if (this.mongoDb) {
      return (
        (await this.mongoDb
          .collection<EmergencyRequest>('emergencyRequests')
          .findOne({ trackingCode: code })) ?? null
      );
    }
    return (
      this.localData?.emergencyRequests.find((r) => r.trackingCode.toUpperCase() === code) ??
      null
    );
  }

  async createEmergencyRequest(req: EmergencyRequest): Promise<EmergencyRequest> {
    if (this.mongoDb) {
      await this.mongoDb.collection<EmergencyRequest>('emergencyRequests').insertOne(req);
      return req;
    }
    this.localData!.emergencyRequests.unshift(req);
    this.persistLocal();
    return req;
  }

  async updateEmergencyRequest(
    id: string,
    updates: Partial<EmergencyRequest>
  ): Promise<EmergencyRequest | null> {
    if (this.mongoDb) {
      const result = await this.mongoDb
        .collection<EmergencyRequest>('emergencyRequests')
        .findOneAndUpdate({ id }, { $set: updates }, { returnDocument: 'after' });
      return result ?? null;
    }
    const idx = this.localData!.emergencyRequests.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.localData!.emergencyRequests[idx] = {
      ...this.localData!.emergencyRequests[idx],
      ...updates,
    };
    this.persistLocal();
    return this.localData!.emergencyRequests[idx];
  }

  async deleteEmergencyRequest(id: string): Promise<boolean> {
    if (this.mongoDb) {
      const res = await this.mongoDb
        .collection<EmergencyRequest>('emergencyRequests')
        .deleteOne({ id });
      return res.deletedCount > 0;
    }
    const before = this.localData!.emergencyRequests.length;
    this.localData!.emergencyRequests = this.localData!.emergencyRequests.filter(
      (r) => r.id !== id
    );
    if (this.localData!.emergencyRequests.length !== before) {
      this.persistLocal();
      return true;
    }
    return false;
  }

  // --- Abuse Reports ---
  async listReports(): Promise<AbuseReport[]> {
    if (this.mongoDb) {
      return this.mongoDb
        .collection<AbuseReport>('reports')
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
    }
    return [...(this.localData?.reports ?? [])].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );
  }

  async createReport(report: AbuseReport): Promise<AbuseReport> {
    if (this.mongoDb) {
      await this.mongoDb.collection<AbuseReport>('reports').insertOne(report);
      return report;
    }
    this.localData!.reports.unshift(report);
    this.persistLocal();
    return report;
  }

  async updateReport(id: string, updates: Partial<AbuseReport>): Promise<AbuseReport | null> {
    if (this.mongoDb) {
      const result = await this.mongoDb
        .collection<AbuseReport>('reports')
        .findOneAndUpdate({ id }, { $set: updates }, { returnDocument: 'after' });
      return result ?? null;
    }
    const idx = this.localData!.reports.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.localData!.reports[idx] = { ...this.localData!.reports[idx], ...updates };
    this.persistLocal();
    return this.localData!.reports[idx];
  }

  // --- Search History ---
  async addSearchHistory(item: SearchHistoryItem): Promise<void> {
    if (this.mongoDb) {
      await this.mongoDb.collection<SearchHistoryItem>('searchHistory').insertOne(item);
      return;
    }
    this.localData!.searchHistory.unshift(item);
    this.localData!.searchHistory = this.localData!.searchHistory.slice(0, 100);
    this.persistLocal();
  }

  async listSearchHistory(userId: string): Promise<SearchHistoryItem[]> {
    if (this.mongoDb) {
      return this.mongoDb
        .collection<SearchHistoryItem>('searchHistory')
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();
    }
    return (this.localData?.searchHistory ?? [])
      .filter((h) => h.userId === userId)
      .slice(0, 20);
  }

  async clearSearchHistory(userId: string): Promise<void> {
    if (this.mongoDb) {
      await this.mongoDb.collection<SearchHistoryItem>('searchHistory').deleteMany({ userId });
      return;
    }
    this.localData!.searchHistory = this.localData!.searchHistory.filter(
      (h) => h.userId !== userId
    );
    this.persistLocal();
  }

  // --- Contact Messages ---
  async listContactMessages(): Promise<ContactMessage[]> {
    if (this.mongoDb) {
      return this.mongoDb
        .collection<ContactMessage>('contactMessages')
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
    }
    return [...(this.localData?.contactMessages ?? [])].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );
  }

  async createContactMessage(msg: ContactMessage): Promise<ContactMessage> {
    if (this.mongoDb) {
      await this.mongoDb.collection<ContactMessage>('contactMessages').insertOne(msg);
      return msg;
    }
    this.localData!.contactMessages.unshift(msg);
    this.persistLocal();
    return msg;
  }

  async close(): Promise<void> {
    if (this.mongoClient) {
      await this.mongoClient.close();
    }
  }
}
