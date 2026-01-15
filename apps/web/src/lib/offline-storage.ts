/**
 * IndexedDB wrapper for offline data storage.
 *
 * Provides tenant-isolated storage for:
 * - Pending bookings (sync when online)
 * - Cached API responses
 * - User preferences
 *
 * All operations are tenant-scoped to prevent data leakage.
 *
 * SECURITY: Sensitive PII fields (customerEmail, customerPhone) are encrypted
 * using AES-GCM with a session-derived key before storage.
 */

import { logger } from './logger';

// ============================================================================
// Encryption Utilities (Web Crypto API)
// ============================================================================

/**
 * Session-based encryption key management.
 * Key is derived from a random seed stored in sessionStorage (cleared on tab close).
 * This provides defense-in-depth: even if IndexedDB is accessed via XSS,
 * encrypted data cannot be decrypted without the session key.
 */

const ENCRYPTION_KEY_SEED = 'handled-offline-key-seed';
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM

/**
 * Encrypted field format: base64(iv || ciphertext)
 */
interface EncryptedValue {
  /** Marks this as an encrypted value */
  __encrypted: true;
  /** Base64-encoded IV + ciphertext */
  data: string;
}

/**
 * Check if a value is an encrypted wrapper.
 */
function isEncryptedValue(value: unknown): value is EncryptedValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__encrypted' in value &&
    (value as EncryptedValue).__encrypted === true &&
    'data' in value
  );
}

/**
 * Get or generate the session encryption key seed.
 * Stored in sessionStorage so it's cleared when the browser tab closes.
 */
function getOrCreateKeySeed(): string {
  if (typeof sessionStorage === 'undefined') {
    // SSR or unsupported environment - generate ephemeral seed
    return crypto.randomUUID();
  }

  let seed = sessionStorage.getItem(ENCRYPTION_KEY_SEED);
  if (!seed) {
    seed = crypto.randomUUID();
    sessionStorage.setItem(ENCRYPTION_KEY_SEED, seed);
  }
  return seed;
}

/**
 * Derive an AES-GCM key from the session seed and tenant ID.
 * Using tenant ID ensures keys are isolated per tenant.
 */
async function deriveEncryptionKey(tenantId: string): Promise<CryptoKey> {
  const seed = getOrCreateKeySeed();
  const keyMaterial = new TextEncoder().encode(`${seed}:${tenantId}`);

  // Import the seed as raw key material for PBKDF2
  const baseKey = await crypto.subtle.importKey('raw', keyMaterial, 'PBKDF2', false, ['deriveKey']);

  // Derive AES-GCM key using PBKDF2
  // Salt is deterministic (tenant-based) since we need consistent decryption
  const salt = new TextEncoder().encode(`handled-salt:${tenantId}`);

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Convert Uint8Array to base64 string.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypt a string value using AES-GCM.
 * Returns an EncryptedValue wrapper.
 */
async function encryptField(value: string, key: CryptoKey): Promise<EncryptedValue> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(value);

  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded);

  // Combine IV and ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Base64 encode for storage
  const base64 = uint8ArrayToBase64(combined);

  return { __encrypted: true, data: base64 };
}

/**
 * Decrypt an encrypted value back to plaintext.
 */
async function decryptField(encrypted: EncryptedValue, key: CryptoKey): Promise<string> {
  // Decode base64
  const combined = base64ToUint8Array(encrypted.data);

  // Extract IV and ciphertext
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext);

  return new TextDecoder().decode(decrypted);
}

/**
 * Check if Web Crypto API is available.
 */
function isCryptoAvailable(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.getRandomValues !== 'undefined'
  );
}

const DB_NAME = 'handled-offline';
const DB_VERSION = 1;

// Store names
export const STORES = {
  PENDING_BOOKINGS: 'pending-bookings',
  CACHED_DATA: 'cached-data',
  PREFERENCES: 'preferences',
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

/**
 * Pending booking record for offline sync (public interface).
 * Sensitive fields (customerEmail, customerPhone) are encrypted at rest.
 */
export interface PendingBooking {
  id: string;
  tenantId: string;
  packageId: string;
  date: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  notes?: string;
  createdAt: number;
  syncAttempts: number;
  lastSyncAttempt?: number;
}

/**
 * Internal storage format with encrypted PII fields.
 * This is what's actually stored in IndexedDB.
 */
interface StoredPendingBooking {
  id: string;
  tenantId: string;
  packageId: string;
  date: string;
  customerName: string;
  /** Encrypted customerEmail - EncryptedValue or legacy plaintext */
  customerEmail: EncryptedValue | string;
  /** Encrypted customerPhone - EncryptedValue, legacy plaintext, or undefined */
  customerPhone?: EncryptedValue | string;
  notes?: string;
  createdAt: number;
  syncAttempts: number;
  lastSyncAttempt?: number;
}

/**
 * Cached data record with expiration.
 */
export interface CachedData<T = unknown> {
  key: string;
  tenantId: string;
  data: T;
  expiresAt: number;
  createdAt: number;
}

/**
 * User preference record.
 */
export interface UserPreference {
  key: string;
  tenantId: string;
  value: unknown;
  updatedAt: number;
}

// Database instance cache
let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open or get the IndexedDB database.
 */
async function getDatabase(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      logger.error('Failed to open IndexedDB', request.error as Error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;

      // Handle database closing unexpectedly
      dbInstance.onclose = () => {
        dbInstance = null;
        dbPromise = null;
      };

      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Pending bookings store
      if (!db.objectStoreNames.contains(STORES.PENDING_BOOKINGS)) {
        const bookingsStore = db.createObjectStore(STORES.PENDING_BOOKINGS, {
          keyPath: 'id',
        });
        bookingsStore.createIndex('tenantId', 'tenantId', { unique: false });
        bookingsStore.createIndex('tenantId-createdAt', ['tenantId', 'createdAt'], {
          unique: false,
        });
      }

      // Cached data store
      if (!db.objectStoreNames.contains(STORES.CACHED_DATA)) {
        const cacheStore = db.createObjectStore(STORES.CACHED_DATA, {
          keyPath: 'key',
        });
        cacheStore.createIndex('tenantId', 'tenantId', { unique: false });
        cacheStore.createIndex('expiresAt', 'expiresAt', { unique: false });
      }

      // Preferences store
      if (!db.objectStoreNames.contains(STORES.PREFERENCES)) {
        const prefsStore = db.createObjectStore(STORES.PREFERENCES, {
          keyPath: 'key',
        });
        prefsStore.createIndex('tenantId', 'tenantId', { unique: false });
      }

      logger.info('IndexedDB schema upgraded', { version: DB_VERSION });
    };
  });

  return dbPromise;
}

/**
 * Execute a transaction on a store.
 */
async function withTransaction<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await getDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);

    const request = callback(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      logger.error('IndexedDB transaction failed', request.error as Error);
      reject(request.error);
    };
  });
}

// ============================================================================
// Pending Bookings Operations
// ============================================================================

/**
 * Encrypt PII fields in a booking before storage.
 * Returns a StoredPendingBooking with encrypted customerEmail and customerPhone.
 */
async function encryptBookingPII(
  booking: PendingBooking,
  tenantId: string
): Promise<StoredPendingBooking> {
  if (!isCryptoAvailable()) {
    // Fallback: store as-is if crypto unavailable (should be rare)
    logger.warn('Web Crypto API unavailable, storing PII unencrypted');
    return booking;
  }

  const key = await deriveEncryptionKey(tenantId);

  const encryptedEmail = await encryptField(booking.customerEmail, key);
  const encryptedPhone = booking.customerPhone
    ? await encryptField(booking.customerPhone, key)
    : undefined;

  return {
    ...booking,
    customerEmail: encryptedEmail,
    customerPhone: encryptedPhone,
  };
}

/**
 * Decrypt PII fields in a stored booking.
 * Handles both encrypted values and legacy plaintext for backward compatibility.
 */
async function decryptBookingPII(
  stored: StoredPendingBooking,
  tenantId: string
): Promise<PendingBooking> {
  // If crypto unavailable or values are plaintext strings, return as-is
  if (!isCryptoAvailable()) {
    return {
      ...stored,
      customerEmail:
        typeof stored.customerEmail === 'string'
          ? stored.customerEmail
          : '[encrypted - crypto unavailable]',
      customerPhone:
        stored.customerPhone === undefined
          ? undefined
          : typeof stored.customerPhone === 'string'
            ? stored.customerPhone
            : '[encrypted - crypto unavailable]',
    };
  }

  const key = await deriveEncryptionKey(tenantId);

  // Handle email - check if encrypted or legacy plaintext
  let decryptedEmail: string;
  if (isEncryptedValue(stored.customerEmail)) {
    try {
      decryptedEmail = await decryptField(stored.customerEmail, key);
    } catch (error) {
      // Decryption failed - likely different session key
      logger.warn('Failed to decrypt customerEmail, data may be from different session');
      decryptedEmail = '[decryption failed]';
    }
  } else {
    // Legacy plaintext value
    decryptedEmail = stored.customerEmail;
  }

  // Handle phone - check if encrypted, legacy plaintext, or undefined
  let decryptedPhone: string | undefined;
  if (stored.customerPhone === undefined) {
    decryptedPhone = undefined;
  } else if (isEncryptedValue(stored.customerPhone)) {
    try {
      decryptedPhone = await decryptField(stored.customerPhone, key);
    } catch (error) {
      logger.warn('Failed to decrypt customerPhone, data may be from different session');
      decryptedPhone = '[decryption failed]';
    }
  } else {
    // Legacy plaintext value
    decryptedPhone = stored.customerPhone;
  }

  return {
    ...stored,
    customerEmail: decryptedEmail,
    customerPhone: decryptedPhone,
  };
}

/**
 * Add a pending booking to be synced when online.
 * Sensitive PII fields are encrypted before storage.
 */
export async function addPendingBooking(
  booking: Omit<PendingBooking, 'createdAt' | 'syncAttempts'>
): Promise<void> {
  const record: PendingBooking = {
    ...booking,
    createdAt: Date.now(),
    syncAttempts: 0,
  };

  // Encrypt PII before storage
  const encryptedRecord = await encryptBookingPII(record, booking.tenantId);

  await withTransaction(STORES.PENDING_BOOKINGS, 'readwrite', (store) =>
    store.add(encryptedRecord)
  );

  logger.info('Added pending booking', { id: booking.id, tenantId: booking.tenantId });
}

/**
 * Get all pending bookings for a tenant.
 * PII fields are automatically decrypted.
 */
export async function getPendingBookings(tenantId: string): Promise<PendingBooking[]> {
  const db = await getDatabase();

  const storedBookings = await new Promise<StoredPendingBooking[]>((resolve, reject) => {
    const transaction = db.transaction(STORES.PENDING_BOOKINGS, 'readonly');
    const store = transaction.objectStore(STORES.PENDING_BOOKINGS);
    const index = store.index('tenantId');
    const request = index.getAll(IDBKeyRange.only(tenantId));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  // Decrypt all bookings in parallel
  const decryptedBookings = await Promise.all(
    storedBookings.map((stored) => decryptBookingPII(stored, tenantId))
  );

  return decryptedBookings;
}

/**
 * Update a pending booking's sync status.
 */
export async function updatePendingBooking(
  id: string,
  updates: Partial<Pick<PendingBooking, 'syncAttempts' | 'lastSyncAttempt'>>
): Promise<void> {
  const db = await getDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.PENDING_BOOKINGS, 'readwrite');
    const store = transaction.objectStore(STORES.PENDING_BOOKINGS);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const record = getRequest.result;
      if (!record) {
        resolve();
        return;
      }

      const putRequest = store.put({ ...record, ...updates });
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Remove a pending booking after successful sync.
 */
export async function removePendingBooking(id: string): Promise<void> {
  await withTransaction(STORES.PENDING_BOOKINGS, 'readwrite', (store) => store.delete(id));

  logger.info('Removed pending booking', { id });
}

/**
 * Clear all pending bookings for a tenant.
 */
export async function clearPendingBookings(tenantId: string): Promise<void> {
  const bookings = await getPendingBookings(tenantId);
  const db = await getDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.PENDING_BOOKINGS, 'readwrite');
    const store = transaction.objectStore(STORES.PENDING_BOOKINGS);

    let remaining = bookings.length;
    if (remaining === 0) {
      resolve();
      return;
    }

    for (const booking of bookings) {
      const request = store.delete(booking.id);
      request.onsuccess = () => {
        remaining--;
        if (remaining === 0) resolve();
      };
      request.onerror = () => reject(request.error);
    }
  });
}

// ============================================================================
// Cached Data Operations
// ============================================================================

/**
 * Cache data with expiration.
 */
export async function setCachedData<T>(
  key: string,
  tenantId: string,
  data: T,
  ttlMs: number = 5 * 60 * 1000 // 5 minutes default
): Promise<void> {
  const record: CachedData<T> = {
    key: `${tenantId}:${key}`,
    tenantId,
    data,
    expiresAt: Date.now() + ttlMs,
    createdAt: Date.now(),
  };

  await withTransaction(STORES.CACHED_DATA, 'readwrite', (store) => store.put(record));
}

/**
 * Get cached data if not expired.
 */
export async function getCachedData<T>(key: string, tenantId: string): Promise<T | null> {
  const fullKey = `${tenantId}:${key}`;

  const record = await withTransaction<CachedData<T> | undefined>(
    STORES.CACHED_DATA,
    'readonly',
    (store) => store.get(fullKey)
  );

  if (!record || record.expiresAt < Date.now()) {
    return null;
  }

  return record.data;
}

/**
 * Remove specific cached data.
 */
export async function removeCachedData(key: string, tenantId: string): Promise<void> {
  const fullKey = `${tenantId}:${key}`;

  await withTransaction(STORES.CACHED_DATA, 'readwrite', (store) => store.delete(fullKey));
}

/**
 * Clear all expired cached data.
 */
export async function clearExpiredCache(): Promise<number> {
  const db = await getDatabase();
  const now = Date.now();
  let cleared = 0;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CACHED_DATA, 'readwrite');
    const store = transaction.objectStore(STORES.CACHED_DATA);
    const index = store.index('expiresAt');
    const range = IDBKeyRange.upperBound(now);
    const request = index.openCursor(range);

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cleared++;
        cursor.continue();
      } else {
        if (cleared > 0) {
          logger.info('Cleared expired cache entries', { count: cleared });
        }
        resolve(cleared);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

// ============================================================================
// Preferences Operations
// ============================================================================

/**
 * Set a user preference.
 */
export async function setPreference(key: string, tenantId: string, value: unknown): Promise<void> {
  const record: UserPreference = {
    key: `${tenantId}:${key}`,
    tenantId,
    value,
    updatedAt: Date.now(),
  };

  await withTransaction(STORES.PREFERENCES, 'readwrite', (store) => store.put(record));
}

/**
 * Get a user preference.
 */
export async function getPreference<T>(key: string, tenantId: string): Promise<T | null> {
  const fullKey = `${tenantId}:${key}`;

  const record = await withTransaction<UserPreference | undefined>(
    STORES.PREFERENCES,
    'readonly',
    (store) => store.get(fullKey)
  );

  return record ? (record.value as T) : null;
}

// ============================================================================
// Database Management
// ============================================================================

/**
 * Close the database connection.
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbPromise = null;
  }
}

/**
 * Delete the entire database.
 */
export async function deleteDatabase(): Promise<void> {
  closeDatabase();

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => {
      logger.info('IndexedDB deleted');
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Check if IndexedDB is available.
 */
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

// ============================================================================
// PII Display Utilities
// ============================================================================

/**
 * Mask an email address for display (e.g., "j***@example.com").
 */
export function maskEmail(email: string): string {
  if (!email || email.startsWith('[')) {
    // Handle decryption failure placeholders
    return email;
  }

  const atIndex = email.indexOf('@');
  if (atIndex <= 0) return email;

  const localPart = email.substring(0, atIndex);
  const domain = email.substring(atIndex);

  if (localPart.length <= 2) {
    return `${localPart[0]}***${domain}`;
  }

  return `${localPart[0]}${'*'.repeat(Math.min(localPart.length - 1, 3))}${domain}`;
}

/**
 * Mask a phone number for display (e.g., "***-***-1234").
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.startsWith('[')) {
    // Handle decryption failure placeholders
    return phone;
  }

  // Extract just the digits
  const digits = phone.replace(/\D/g, '');

  if (digits.length < 4) {
    return '***';
  }

  // Show only last 4 digits
  const lastFour = digits.slice(-4);
  return `***-***-${lastFour}`;
}

/**
 * Check if PII encryption is available.
 * Useful for UI to indicate security status.
 */
export function isPIIEncryptionAvailable(): boolean {
  return isCryptoAvailable();
}
