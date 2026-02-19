/**
 * Service & Availability Port — Scheduling service management and availability rules
 */

import type { Service } from '../entities';

/**
 * Service Repository - Scheduling service management
 */
export interface ServiceRepository {
  getAll(
    tenantId: string,
    includeInactive?: boolean,
    options?: { take?: number }
  ): Promise<Service[]>;
  getActiveServices(tenantId: string, options?: { take?: number }): Promise<Service[]>;
  getBySlug(tenantId: string, slug: string): Promise<Service | null>;
  getById(tenantId: string, id: string): Promise<Service | null>;
  create(tenantId: string, data: CreateServiceInput): Promise<Service>;
  update(tenantId: string, id: string, data: UpdateServiceInput): Promise<Service>;
  delete(tenantId: string, id: string): Promise<void>;
}

/**
 * AvailabilityRule Repository - Scheduling availability rules
 */
export interface AvailabilityRuleRepository {
  getAll(tenantId: string): Promise<AvailabilityRule[]>;
  getByService(tenantId: string, serviceId: string | null): Promise<AvailabilityRule[]>;
  getByDayOfWeek(
    tenantId: string,
    dayOfWeek: number,
    serviceId?: string | null
  ): Promise<AvailabilityRule[]>;
  getEffectiveRules(
    tenantId: string,
    date: Date,
    serviceId?: string | null
  ): Promise<AvailabilityRule[]>;
  create(tenantId: string, data: CreateAvailabilityRuleData): Promise<AvailabilityRule>;
  update(tenantId: string, id: string, data: UpdateAvailabilityRuleData): Promise<AvailabilityRule>;
  delete(tenantId: string, id: string): Promise<void>;
  deleteByService(tenantId: string, serviceId: string): Promise<void>;
}

/**
 * Domain entity for AvailabilityRule
 */
export interface AvailabilityRule {
  id: string;
  tenantId: string;
  serviceId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a new availability rule
 */
export interface CreateAvailabilityRuleData {
  serviceId?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
}

/**
 * Input for updating an existing availability rule
 * All fields are optional for partial updates
 */
export interface UpdateAvailabilityRuleData {
  serviceId?: string | null;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
}

/**
 * Availability check result
 */
export interface AvailabilityCheck {
  date: string;
  available: boolean;
  reason?: 'blackout' | 'booked' | 'calendar';
}

/**
 * Input for creating a new service
 */
export interface CreateServiceInput {
  slug: string;
  name: string;
  description?: string;
  durationMinutes: number;
  bufferMinutes?: number;
  priceCents: number;
  timezone?: string;
  active?: boolean;
  sortOrder?: number;
  segmentId?: string | null;
}

/**
 * Input for updating an existing service
 */
export interface UpdateServiceInput {
  slug?: string;
  name?: string;
  description?: string;
  durationMinutes?: number;
  bufferMinutes?: number;
  priceCents?: number;
  timezone?: string;
  active?: boolean;
  sortOrder?: number;
  segmentId?: string | null;
}
