/**
 * Prisma Service Repository Adapter
 */

import type { PrismaClient } from '../../generated/prisma/client';
import type { ServiceRepository, CreateServiceInput, UpdateServiceInput } from '../../lib/ports';
import type { Service } from '../../lib/entities';
import { DomainError } from '../../lib/errors';
import { logger } from '../../lib/core/logger';

export class PrismaServiceRepository implements ServiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getAll(tenantId: string, includeInactive = false): Promise<Service[]> {
    const services = await this.prisma.service.findMany({
      where: {
        tenantId,
        ...(includeInactive ? {} : { active: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return services.map(this.toDomainService);
  }

  async getActiveServices(tenantId: string): Promise<Service[]> {
    const services = await this.prisma.service.findMany({
      where: {
        tenantId,
        active: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return services.map(this.toDomainService);
  }

  async getBySlug(tenantId: string, slug: string): Promise<Service | null> {
    const service = await this.prisma.service.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
    });

    return service ? this.toDomainService(service) : null;
  }

  async getById(tenantId: string, id: string): Promise<Service | null> {
    const service = await this.prisma.service.findFirst({
      where: { tenantId, id },
    });

    return service ? this.toDomainService(service) : null;
  }

  async create(tenantId: string, data: CreateServiceInput): Promise<Service> {
    // Check for slug uniqueness within tenant - use select to minimize data transfer
    const existing = await this.prisma.service.findUnique({
      where: { tenantId_slug: { tenantId, slug: data.slug } },
      select: { id: true },
    });

    if (existing) {
      logger.warn(
        {
          tenantId,
          slug: data.slug,
        },
        'Service creation failed - duplicate slug'
      );
      throw new DomainError('DUPLICATE_SLUG', `Service with slug '${data.slug}' already exists`);
    }

    try {
      // Note: Timezone fallback logging is handled at the route layer
      // (before Zod applies defaults) to ensure observability
      const timezone = data.timezone ?? 'America/New_York';

      const service = await this.prisma.service.create({
        data: {
          tenantId,
          slug: data.slug,
          name: data.name,
          description: data.description ?? null,
          durationMinutes: data.durationMinutes,
          bufferMinutes: data.bufferMinutes ?? 0,
          priceCents: data.priceCents,
          timezone,
          active: data.active ?? true,
          sortOrder: data.sortOrder ?? 0,
          segmentId: data.segmentId ?? null,
        },
      });

      logger.info(
        {
          tenantId,
          serviceId: service.id,
          slug: service.slug,
        },
        'Service created'
      );

      return this.toDomainService(service);
    } catch (error) {
      logger.error({ error, tenantId, data }, 'Service creation failed');
      throw error;
    }
  }

  async update(tenantId: string, id: string, data: UpdateServiceInput): Promise<Service> {
    // Check if service exists for this tenant AND validate slug uniqueness in a single query
    const existing = await this.prisma.service.findFirst({
      where: { tenantId, id },
      select: { id: true, slug: true },
    });

    if (!existing) {
      logger.warn({ tenantId, id }, 'Service update failed - not found');
      throw new DomainError('NOT_FOUND', `Service with id '${id}' not found`);
    }

    // If updating slug, check for uniqueness within tenant
    if (data.slug && data.slug !== existing.slug) {
      const duplicateSlug = await this.prisma.service.findUnique({
        where: { tenantId_slug: { tenantId, slug: data.slug } },
        select: { id: true },
      });

      if (duplicateSlug) {
        logger.warn(
          {
            tenantId,
            id,
            slug: data.slug,
          },
          'Service update failed - duplicate slug'
        );
        throw new DomainError('DUPLICATE_SLUG', `Service with slug '${data.slug}' already exists`);
      }
    }

    try {
      const service = await this.prisma.service.update({
        where: { id, tenantId },
        data: {
          ...(data.slug !== undefined && { slug: data.slug }),
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.durationMinutes !== undefined && { durationMinutes: data.durationMinutes }),
          ...(data.bufferMinutes !== undefined && { bufferMinutes: data.bufferMinutes }),
          ...(data.priceCents !== undefined && { priceCents: data.priceCents }),
          ...(data.timezone !== undefined && { timezone: data.timezone }),
          ...(data.active !== undefined && { active: data.active }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
          ...(data.segmentId !== undefined && { segmentId: data.segmentId }),
        },
      });

      logger.info(
        {
          tenantId,
          serviceId: service.id,
          updatedFields: Object.keys(data),
        },
        'Service updated'
      );

      return this.toDomainService(service);
    } catch (error) {
      logger.error({ error, tenantId, id, data }, 'Service update failed');
      throw error;
    }
  }

  async delete(tenantId: string, id: string): Promise<void> {
    // Check if service exists for this tenant - optimize with select
    const existing = await this.prisma.service.findFirst({
      where: { tenantId, id },
      select: { id: true },
    });

    if (!existing) {
      logger.warn({ tenantId, id }, 'Service deletion failed - not found');
      throw new DomainError('NOT_FOUND', `Service with id '${id}' not found`);
    }

    try {
      await this.prisma.service.delete({
        where: { id, tenantId },
      });

      logger.info({ tenantId, serviceId: id }, 'Service deleted');
    } catch (error) {
      logger.error({ error, tenantId, id }, 'Service deletion failed');
      throw error;
    }
  }

  /**
   * Map Prisma Service to Domain Service
   */
  private toDomainService(service: {
    id: string;
    tenantId: string;
    slug: string;
    name: string;
    description: string | null;
    durationMinutes: number;
    bufferMinutes: number;
    priceCents: number;
    timezone: string;
    active: boolean;
    sortOrder: number;
    segmentId: string | null;
    maxPerDay: number | null;
    createdAt: Date;
    updatedAt: Date;
  }): Service {
    return {
      id: service.id,
      tenantId: service.tenantId,
      slug: service.slug,
      name: service.name,
      description: service.description,
      durationMinutes: service.durationMinutes,
      bufferMinutes: service.bufferMinutes,
      priceCents: service.priceCents,
      timezone: service.timezone,
      active: service.active,
      sortOrder: service.sortOrder,
      segmentId: service.segmentId,
      maxPerDay: service.maxPerDay,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }
}
