/**
 * Prisma AvailabilityRule Repository Adapter
 */

import type { PrismaClient } from '../../generated/prisma/client';
import type {
  AvailabilityRuleRepository,
  AvailabilityRule,
  CreateAvailabilityRuleData,
  UpdateAvailabilityRuleData,
} from '../../lib/ports';
import { QueryLimits } from '../../lib/core/query-limits';

export class PrismaAvailabilityRuleRepository implements AvailabilityRuleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getAll(tenantId: string): Promise<AvailabilityRule[]> {
    const rules = await this.prisma.availabilityRule.findMany({
      where: { tenantId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      take: QueryLimits.SCHEDULING_CONFIG_MAX, // Safety net: config data, bounded per tenant
    });

    return rules.map((rule) => this.mapToEntity(rule));
  }

  async getByService(tenantId: string, serviceId: string | null): Promise<AvailabilityRule[]> {
    const rules = await this.prisma.availabilityRule.findMany({
      where: {
        tenantId,
        serviceId,
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      take: QueryLimits.SCHEDULING_CONFIG_MAX, // Safety net: config data, bounded per tenant+service
    });

    return rules.map((rule) => this.mapToEntity(rule));
  }

  async getByDayOfWeek(
    tenantId: string,
    dayOfWeek: number,
    serviceId?: string | null
  ): Promise<AvailabilityRule[]> {
    const where: any = {
      tenantId,
      dayOfWeek,
    };

    // If serviceId is provided (including null), filter by it
    if (serviceId !== undefined) {
      where.serviceId = serviceId;
    }

    const rules = await this.prisma.availabilityRule.findMany({
      where,
      orderBy: { startTime: 'asc' },
      take: QueryLimits.SCHEDULING_CONFIG_MAX, // Safety net: config data, bounded per tenant+day
    });

    return rules.map((rule) => this.mapToEntity(rule));
  }

  async getEffectiveRules(
    tenantId: string,
    date: Date,
    serviceId?: string | null
  ): Promise<AvailabilityRule[]> {
    const where: any = {
      tenantId,
      effectiveFrom: { lte: date },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
    };

    // If serviceId is provided (including null), filter by it
    if (serviceId !== undefined) {
      where.serviceId = serviceId;
    }

    const rules = await this.prisma.availabilityRule.findMany({
      where,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      take: QueryLimits.SCHEDULING_CONFIG_MAX, // Safety net: config data, bounded per tenant+date range
    });

    return rules.map((rule) => this.mapToEntity(rule));
  }

  async create(tenantId: string, data: CreateAvailabilityRuleData): Promise<AvailabilityRule> {
    const rule = await this.prisma.availabilityRule.create({
      data: {
        tenantId,
        serviceId: data.serviceId ?? null,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        effectiveFrom: data.effectiveFrom ?? new Date(),
        effectiveTo: data.effectiveTo ?? null,
      },
    });

    return this.mapToEntity(rule);
  }

  async update(
    tenantId: string,
    id: string,
    data: UpdateAvailabilityRuleData
  ): Promise<AvailabilityRule> {
    const updateData: any = {};

    if (data.serviceId !== undefined) updateData.serviceId = data.serviceId;
    if (data.dayOfWeek !== undefined) updateData.dayOfWeek = data.dayOfWeek;
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.effectiveFrom !== undefined) updateData.effectiveFrom = data.effectiveFrom;
    if (data.effectiveTo !== undefined) updateData.effectiveTo = data.effectiveTo;

    const _rule = await this.prisma.availabilityRule.updateMany({
      where: { id, tenantId },
      data: updateData,
    });

    // Fetch the updated rule to return
    const updated = await this.prisma.availabilityRule.findFirst({
      where: { id, tenantId },
    });

    if (!updated) {
      throw new Error('Availability rule not found or does not belong to this tenant');
    }

    return this.mapToEntity(updated);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    // Use deleteMany to ensure tenant isolation
    await this.prisma.availabilityRule.deleteMany({
      where: { id, tenantId },
    });
  }

  async deleteByService(tenantId: string, serviceId: string): Promise<void> {
    // Delete all rules for a specific service (tenant-scoped)
    await this.prisma.availabilityRule.deleteMany({
      where: { tenantId, serviceId },
    });
  }

  /**
   * Map Prisma model to domain entity
   */
  private mapToEntity(rule: any): AvailabilityRule {
    return {
      id: rule.id,
      tenantId: rule.tenantId,
      serviceId: rule.serviceId,
      dayOfWeek: rule.dayOfWeek,
      startTime: rule.startTime,
      endTime: rule.endTime,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }
}
