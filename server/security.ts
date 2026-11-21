import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../src/shared/types.ts';

// Signing secret from environment with cryptographically random per-process fallback
const TOKEN_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const revokedTokens = new Set<string>();

export interface TokenPayload {
  sub: string;
  role: UserRole;
  email: string;
  iat: number;
  exp: number;
  jti: string;
}

export interface AuthenticatedRequest extends Request {
  auth?: TokenPayload;
  rawToken?: string;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, originalHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

export function safeCompareStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function signAuthToken(payload: { sub: string; role: UserRole; email: string }): string {
  const now = Date.now();
  const fullPayload: TokenPayload = {
    sub: payload.sub,
    role: payload.role,
    email: payload.email,
    iat: now,
    exp: now + TOKEN_TTL_MS,
    jti: crypto.randomUUID(),
  };

  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(encoded)
    .digest('base64url');

  return `${encoded}.${sig}`;
}

export function verifyAuthToken(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  if (revokedTokens.has(token)) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, providedSig] = parts;

  const expectedSig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(encoded)
    .digest('base64url');

  if (!safeCompareStrings(providedSig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed.sub || !parsed.role || !parsed.exp) return null;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function revokeAuthToken(token: string): void {
  if (token) {
    revokedTokens.add(token);
  }
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (token) {
    const payload = verifyAuthToken(token);
    if (payload) {
      req.auth = payload;
      req.rawToken = token;
    }
  }
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }
  req.auth = payload;
  req.rawToken = token;
  next();
}

export function requireDonor(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.auth?.role !== 'donor') {
      res.status(403).json({ error: 'Donor account access required.' });
      return;
    }
    next();
  });
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.auth?.role !== 'admin') {
      res.status(403).json({ error: 'Administrator privileges required.' });
      return;
    }
    next();
  });
}

/**
 * Safely coerces untrusted request values to trimmed strings, blocking
 * NoSQL operator object injection (e.g. { "$gt": "" }).
 */
export function cleanString(value: unknown, maxLength = 250): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export function generateTrackingCode(prefix: 'REQ' | 'EMG'): string {
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `BC-${prefix}-${random}`;
}
