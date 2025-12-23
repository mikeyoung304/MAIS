/**
 * Test fakes and builders for unit tests
 */

import type { BookingRepository } from '../../src/lib/ports';
import type { Booking } from '../../src/lib/entities';
import { BookingConflictError } from '../../src/lib/errors';
import type { CatalogRepository } from '../../src/lib/ports';
import type { Package, AddOn } from '../../src/lib/entities';
import type { BlackoutRepository, CalendarProvider } from '../../src/lib/ports';
import type { PaymentProvider, CheckoutSession } from '../../src/lib/ports';
import type { EmailProvider } from '../../src/lib/ports';
import type { UserRepository, User } from '../../src/lib/ports';
import type { EventEmitter } from '../../src/lib/core/events';

// --- Fake Repositories ---

export class FakeBookingRepository implements BookingRepository {
  private bookings: Array<Booking & { tenantId: string }> = [];

  async create(tenantId: string, booking: Booking): Promise<Booking> {
    // P1 fix: Enforce unique-by-date constraint WITH tenant isolation
    // Matches real repository behavior: @@unique([tenantId, date, bookingType])
    const bookingType = booking.bookingType || 'DATE';
    const exists = this.bookings.some(
      (b) =>
        b.tenantId === tenantId &&
        b.eventDate === booking.eventDate &&
        (b.bookingType || 'DATE') === bookingType
    );
    if (exists) {
      throw new BookingConflictError(booking.eventDate);
    }
    this.bookings.push({ ...booking, tenantId });
    return booking;
  }

  async findById(tenantId: string, id: string): Promise<Booking | null> {
    // P1 fix: Filter by tenantId for proper isolation
    const found = this.bookings.find((b) => b.tenantId === tenantId && b.id === id);
    return found ? this.stripTenantId(found) : null;
  }

  async findAll(tenantId: string): Promise<Booking[]> {
    // P1 fix: Filter by tenantId for proper isolation
    return this.bookings.filter((b) => b.tenantId === tenantId).map(this.stripTenantId);
  }

  async isDateBooked(tenantId: string, date: string): Promise<boolean> {
    // P1 fix: Filter by tenantId for proper isolation
    return this.bookings.some((b) => b.tenantId === tenantId && b.eventDate === date);
  }

  async getUnavailableDates(tenantId: string, startDate: Date, endDate: Date): Promise<Date[]> {
    // P1 fix: Filter by tenantId for proper isolation
    return this.bookings
      .filter((b) => {
        if (b.tenantId !== tenantId) return false;
        const bookingDate = new Date(b.eventDate);
        return bookingDate >= startDate && bookingDate <= endDate;
      })
      .map((b) => new Date(b.eventDate));
  }

  // Helper to remove tenantId from returned booking (matches domain entity)
  private stripTenantId(booking: Booking & { tenantId: string }): Booking {
    const { tenantId: _, ...rest } = booking;
    return rest;
  }

  // Test helper - now requires tenantId for proper isolation
  addBooking(booking: Booking, tenantId: string = 'test-tenant'): void {
    this.bookings.push({ ...booking, tenantId });
  }

  clear(): void {
    this.bookings = [];
  }
}

export class FakeCatalogRepository implements CatalogRepository {
  private packages: Package[] = [];
  private addOns: AddOn[] = [];

  async getAllPackages(tenantId: string): Promise<Package[]> {
    return [...this.packages];
  }

  async getAllPackagesWithAddOns(tenantId: string): Promise<Array<Package & { addOns: AddOn[] }>> {
    return this.packages.map((pkg) => ({
      ...pkg,
      addOns: this.addOns.filter((a) => a.packageId === pkg.id),
    }));
  }

  async getPackageBySlug(tenantId: string, slug: string): Promise<Package | null> {
    return this.packages.find((p) => p.slug === slug) || null;
  }

  async getPackageById(tenantId: string, id: string): Promise<Package | null> {
    return this.packages.find((p) => p.id === id) || null;
  }

  async getAddOnsByPackageId(tenantId: string, packageId: string): Promise<AddOn[]> {
    return this.addOns.filter((a) => a.packageId === packageId);
  }

  async getAddOnById(tenantId: string, id: string): Promise<AddOn | null> {
    return this.addOns.find((a) => a.id === id) || null;
  }

  async createPackage(
    tenantId: string,
    data: {
      slug: string;
      title: string;
      description: string;
      priceCents: number;
      photoUrl?: string;
    }
  ): Promise<Package> {
    const pkg: Package = {
      id: `pkg_${Date.now()}_${Math.random()}`,
      ...data,
    };
    this.packages.push(pkg);
    return pkg;
  }

  async updatePackage(
    tenantId: string,
    id: string,
    data: {
      slug?: string;
      title?: string;
      description?: string;
      priceCents?: number;
      photoUrl?: string;
    }
  ): Promise<Package> {
    const index = this.packages.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Package with id "${id}" not found`);
    }

    const updated: Package = {
      ...this.packages[index],
      ...data,
    };
    this.packages[index] = updated;
    return updated;
  }

  async deletePackage(tenantId: string, id: string): Promise<void> {
    const index = this.packages.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Package with id "${id}" not found`);
    }
    this.packages.splice(index, 1);
    // Also delete associated add-ons
    this.addOns = this.addOns.filter((a) => a.packageId !== id);
  }

  async createAddOn(
    tenantId: string,
    data: {
      packageId: string;
      title: string;
      priceCents: number;
      photoUrl?: string;
    }
  ): Promise<AddOn> {
    const addOn: AddOn = {
      id: `addon_${Date.now()}_${Math.random()}`,
      ...data,
    };
    this.addOns.push(addOn);
    return addOn;
  }

  async updateAddOn(
    tenantId: string,
    id: string,
    data: {
      packageId?: string;
      title?: string;
      priceCents?: number;
      photoUrl?: string;
    }
  ): Promise<AddOn> {
    const index = this.addOns.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new Error(`AddOn with id "${id}" not found`);
    }

    const updated: AddOn = {
      ...this.addOns[index],
      ...data,
    };
    this.addOns[index] = updated;
    return updated;
  }

  async deleteAddOn(tenantId: string, id: string): Promise<void> {
    const index = this.addOns.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new Error(`AddOn with id "${id}" not found`);
    }
    this.addOns.splice(index, 1);
  }

  // Test helpers
  addPackage(pkg: Package): void {
    this.packages.push(pkg);
  }

  addAddOn(addOn: AddOn): void {
    this.addOns.push(addOn);
  }

  clear(): void {
    this.packages = [];
    this.addOns = [];
  }
}

export class FakeBlackoutRepository implements BlackoutRepository {
  private blackouts: Array<{ date: string; reason?: string }> = [];

  async isBlackoutDate(tenantId: string, date: string): Promise<boolean> {
    return this.blackouts.some((b) => b.date === date);
  }

  async getAllBlackouts(tenantId: string): Promise<Array<{ date: string; reason?: string }>> {
    return [...this.blackouts];
  }

  async addBlackout(tenantId: string, date: string, reason?: string): Promise<void> {
    this.blackouts.push({ date, reason });
  }

  // Test helper
  clear(): void {
    this.blackouts = [];
  }
}

export class FakeCalendarProvider implements CalendarProvider {
  private busyDates: string[] = [];

  async isDateAvailable(date: string): Promise<boolean> {
    return !this.busyDates.includes(date);
  }

  // Test helpers
  setBusyDates(dates: string[]): void {
    this.busyDates = dates;
  }

  clear(): void {
    this.busyDates = [];
  }
}

export class FakePaymentProvider implements PaymentProvider {
  async createCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    applicationFeeAmount?: number;
  }): Promise<CheckoutSession> {
    return {
      url: `https://fake-checkout.com/session_${Date.now()}`,
      sessionId: `sess_${Date.now()}`,
    };
  }

  async createConnectCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    stripeAccountId: string;
    applicationFeeAmount: number;
  }): Promise<CheckoutSession> {
    return {
      url: `https://fake-connect-checkout.com/session_${Date.now()}`,
      sessionId: `sess_connect_${Date.now()}`,
    };
  }

  async verifyWebhook(payload: string, signature: string): Promise<unknown> {
    return { verified: true };
  }
}

export class FakeEmailProvider implements EmailProvider {
  public sentEmails: Array<{ to: string; subject: string; html: string }> = [];

  async sendEmail(input: { to: string; subject: string; html: string }): Promise<void> {
    this.sentEmails.push(input);
  }

  // Test helper
  clear(): void {
    this.sentEmails = [];
  }
}

export class FakeUserRepository implements UserRepository {
  private users: User[] = [];

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email) || null;
  }

  // Test helper
  addUser(user: User): void {
    this.users.push(user);
  }

  clear(): void {
    this.users = [];
  }
}

export class FakeEventEmitter implements EventEmitter {
  private handlers: Map<string, Array<(payload: unknown) => void | Promise<void>>> = new Map();
  public emittedEvents: Array<{ event: string; payload: unknown }> = [];

  subscribe<T>(event: string, handler: (payload: T) => void | Promise<void>): void {
    const existing = this.handlers.get(event) || [];
    this.handlers.set(event, [...existing, handler as (payload: unknown) => void | Promise<void>]);
  }

  async emit<T>(event: string, payload: T): Promise<void> {
    this.emittedEvents.push({ event, payload });
    const handlers = this.handlers.get(event) || [];
    await Promise.all(handlers.map((handler) => handler(payload)));
  }

  // Test helpers
  clear(): void {
    this.emittedEvents = [];
    this.handlers.clear();
  }
}

// --- Builders ---

export function buildPackage(overrides?: Partial<Package>): Package {
  return {
    id: 'pkg_1',
    slug: 'basic-package',
    title: 'Basic Package',
    description: 'A basic photography package',
    priceCents: 100000,
    ...overrides,
  };
}

export function buildAddOn(overrides?: Partial<AddOn>): AddOn {
  return {
    id: 'addon_1',
    packageId: 'pkg_1',
    title: 'Extra Hour',
    priceCents: 20000,
    ...overrides,
  };
}

export function buildBooking(overrides?: Partial<Booking>): Booking {
  return {
    id: 'booking_1',
    packageId: 'pkg_1',
    coupleName: 'John & Jane',
    email: 'couple@example.com',
    eventDate: '2025-06-15',
    addOnIds: [],
    totalCents: 100000,
    status: 'PAID',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function buildUser(overrides?: Partial<User>): User {
  return {
    id: 'user_1',
    email: 'admin@example.com',
    passwordHash: '$2a$10$FAKEHASH',
    role: 'admin',
    ...overrides,
  };
}

// --- Webhook Repository ---

export interface WebhookEvent {
  id?: string;
  eventId: string;
  eventType: string;
  status: 'PENDING' | 'PROCESSED' | 'FAILED' | 'DUPLICATE';
  rawPayload?: string;
  lastError?: string;
  attempts?: number;
  createdAt?: Date;
  processedAt?: Date;
}

export interface WebhookRepository {
  recordWebhook(input: {
    tenantId: string;
    eventId: string;
    eventType: string;
    rawPayload: string;
  }): Promise<boolean>;
  isDuplicate(tenantId: string, eventId: string): Promise<boolean>;
  markProcessed(tenantId: string, eventId: string): Promise<void>;
  markFailed(tenantId: string, eventId: string, errorMessage: string): Promise<void>;
}

export class FakeWebhookRepository implements WebhookRepository {
  public events: WebhookEvent[] = [];

  async recordWebhook(input: {
    tenantId: string;
    eventId: string;
    eventType: string;
    rawPayload: string;
  }): Promise<boolean> {
    // Check if already exists (duplicate)
    if (this.events.some((e) => e.eventId === input.eventId)) {
      return false; // Duplicate
    }
    const event: WebhookEvent = {
      id: `wh_${Date.now()}`,
      eventId: input.eventId,
      eventType: input.eventType,
      status: 'PENDING',
      rawPayload: input.rawPayload,
      attempts: 1,
      createdAt: new Date(),
    };
    this.events.push(event);
    return true; // New record
  }

  async isDuplicate(tenantId: string, eventId: string): Promise<boolean> {
    return this.events.some((e) => e.eventId === eventId);
  }

  async markProcessed(tenantId: string, eventId: string): Promise<void> {
    const event = this.events.find((e) => e.eventId === eventId);
    if (event) {
      event.status = 'PROCESSED';
      event.processedAt = new Date();
    }
  }

  async markFailed(tenantId: string, eventId: string, errorMessage: string): Promise<void> {
    const event = this.events.find((e) => e.eventId === eventId);
    if (event) {
      event.status = 'FAILED';
      event.lastError = errorMessage;
      event.attempts = (event.attempts || 0) + 1;
    }
  }

  // Test helper
  addEvent(event: WebhookEvent): void {
    this.events.push(event);
  }

  clear(): void {
    this.events = [];
  }
}
