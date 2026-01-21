/**
 * Project Hub Service
 *
 * Manages dual-faced customer-tenant communication for active projects.
 * Provides the backend operations for the Project Hub agent's tools.
 *
 * Architecture:
 * - All queries are tenant-scoped (CRITICAL for multi-tenant isolation)
 * - Optimistic locking for concurrent request updates
 * - Event sourcing for audit trail and activity timeline
 * - 72-hour expiry for escalated requests
 *
 * Trust Tier Integration:
 * - T1 (Autonomous): get_project_details, get_timeline, bootstrap
 * - T2 (Propose & Execute): create_request (questions, add-ons)
 * - T3 (Explicit Confirmation): create_request (cancellation, refund)
 *
 * @module services/project-hub
 */

import type { PrismaClient, Prisma } from '../generated/prisma/client';
import { logger } from '../lib/core/logger';
import { NotFoundError, ValidationError, ConcurrentModificationError } from '../lib/errors';
import type {
  ProjectStatus,
  RequestType,
  RequestStatus,
  ProjectActor,
  RequestHandler,
} from '../generated/prisma/client';

// ============================================================================
// Types
// ============================================================================

/**
 * Customer bootstrap response - session initialization
 */
export interface CustomerBootstrapResult {
  project: {
    id: string;
    status: ProjectStatus;
    bookingDate: Date;
    serviceName: string;
  };
  hasPendingRequests: boolean;
  pendingRequestCount: number;
  greeting: string;
}

/**
 * Tenant bootstrap response - dashboard initialization
 */
export interface TenantBootstrapResult {
  activeProjectCount: number;
  pendingRequestCount: number;
  recentActivityCount: number;
  greeting: string;
}

/**
 * Project details with booking info
 */
export interface ProjectWithBooking {
  id: string;
  tenantId: string;
  status: ProjectStatus;
  version: number;
  customerPreferences: Record<string, unknown> | null;
  tenantNotes: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  booking: {
    id: string;
    eventDate: Date;
    package: {
      id: string;
      name: string;
      basePrice: number;
    } | null;
    customer: {
      id: string;
      name: string;
      email: string | null;
    };
  };
}

/**
 * Project request with optional project context
 */
export interface ProjectRequestWithContext {
  id: string;
  type: RequestType;
  status: RequestStatus;
  requestData: Record<string, unknown>;
  responseData: Record<string, unknown> | null;
  expiresAt: Date;
  createdAt: Date;
  version: number;
  project?: {
    id: string;
    booking: {
      eventDate: Date;
      customer: {
        name: string;
        email: string;
      };
      package: {
        name: string;
      } | null;
    };
  };
}

/**
 * Timeline event for project activity
 */
export interface TimelineEvent {
  id: string;
  type: string;
  actor: ProjectActor;
  payload: Record<string, unknown>;
  visibleToCustomer: boolean;
  visibleToTenant: boolean;
  createdAt: Date;
}

/**
 * Create request input
 */
export interface CreateRequestInput {
  tenantId: string;
  projectId: string;
  type: RequestType;
  requestData: Record<string, unknown>;
}

/**
 * Handle request input (approve/deny)
 */
export interface HandleRequestInput {
  tenantId: string;
  requestId: string;
  expectedVersion: number;
  response?: string;
  reason?: string; // Required for deny
}

/**
 * Transaction client type for Prisma interactive transactions
 */
type TransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Internal type for request with project context from optimistic lock validation
 */
interface ValidatedRequest {
  id: string;
  type: RequestType;
  status: RequestStatus;
  projectId: string;
  requestData: unknown;
  expiresAt: Date;
  createdAt: Date;
  version: number;
}

// ============================================================================
// Service
// ============================================================================

/**
 * Project Hub Service
 *
 * Manages the dual-faced customer-tenant communication system.
 * All methods enforce multi-tenant isolation via tenantId.
 */
export class ProjectHubService {
  constructor(private readonly prisma: PrismaClient) {}

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Get the next event version for a project
   *
   * Finds the highest existing event version and returns the next one.
   * Returns 1 if no events exist yet.
   *
   * @param tx - Prisma transaction client
   * @param projectId - Project ID
   * @returns Next version number
   */
  private async getNextEventVersion(tx: TransactionClient, projectId: string): Promise<number> {
    const lastEvent = await tx.projectEvent.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return (lastEvent?.version ?? 0) + 1;
  }

  /**
   * Validate and lock a request for update using optimistic locking
   *
   * Performs tenant-scoped lookup, status validation, and version check.
   *
   * @param tx - Prisma transaction client
   * @param tenantId - Tenant ID for isolation
   * @param requestId - Request ID
   * @param expectedVersion - Expected version for optimistic lock
   * @returns Validated request with project context
   * @throws NotFoundError if request not found
   * @throws ValidationError if request already resolved
   * @throws ConcurrentModificationError if version mismatch
   */
  private async validateAndLockRequest(
    tx: TransactionClient,
    tenantId: string,
    requestId: string,
    expectedVersion: number
  ): Promise<ValidatedRequest> {
    const existing = await tx.projectRequest.findFirst({
      where: { id: requestId, tenantId }, // CRITICAL: tenant-scoped
      include: { project: { select: { id: true } } },
    });

    if (!existing) {
      throw new NotFoundError(`Request ${requestId} not found`);
    }

    if (existing.status !== 'PENDING') {
      throw new ValidationError(`Request is already ${existing.status.toLowerCase()}`);
    }

    // Optimistic lock check
    if (existing.version !== expectedVersion) {
      throw new ConcurrentModificationError(
        existing.version,
        `Request was modified. Expected version ${expectedVersion}, found ${existing.version}`
      );
    }

    return {
      id: existing.id,
      type: existing.type,
      status: existing.status,
      projectId: existing.projectId,
      requestData: existing.requestData,
      expiresAt: existing.expiresAt,
      createdAt: existing.createdAt,
      version: existing.version,
    };
  }

  // ==========================================================================
  // Bootstrap Operations
  // ==========================================================================

  /**
   * Bootstrap customer session - returns project context for agent initialization
   *
   * @param tenantId - Tenant ID for isolation
   * @param customerId - Customer ID (from booking or auth)
   * @returns Project context with pending request counts
   * @throws NotFoundError if no project found for customer
   */
  async bootstrapCustomer(tenantId: string, customerId: string): Promise<CustomerBootstrapResult> {
    logger.info({ tenantId, customerId }, '[ProjectHub] Bootstrapping customer session');

    // Find the customer's active project
    const project = await this.prisma.project.findFirst({
      where: {
        tenantId,
        customerId,
        status: 'ACTIVE',
      },
      include: {
        booking: {
          include: {
            package: {
              select: { name: true },
            },
            customer: {
              select: { name: true },
            },
          },
        },
        requests: {
          where: { status: 'PENDING' },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' }, // Most recent project first
    });

    if (!project) {
      throw new NotFoundError(`No active project found for customer`);
    }

    const customerName = project.booking.customer?.name || 'there';
    const serviceName = project.booking.package?.name || 'your service';
    const bookingDate = project.booking.date ?? project.booking.startTime ?? new Date();

    return {
      project: {
        id: project.id,
        status: project.status,
        bookingDate: bookingDate,
        serviceName,
      },
      hasPendingRequests: project.requests.length > 0,
      pendingRequestCount: project.requests.length,
      greeting: `Hi ${customerName}! I'm here to help you with ${serviceName}.`,
    };
  }

  /**
   * Bootstrap tenant session - returns dashboard summary for agent initialization
   *
   * @param tenantId - Tenant ID
   * @returns Summary counts for dashboard
   */
  async bootstrapTenant(tenantId: string): Promise<TenantBootstrapResult> {
    logger.info({ tenantId }, '[ProjectHub] Bootstrapping tenant session');

    // Calculate date threshold for recent activity (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Parallelize all independent queries for ~75% latency reduction
    const [tenant, activeProjectCount, pendingRequestCount, recentActivityCount] =
      await Promise.all([
        // Get tenant name for greeting
        this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true },
        }),
        // Count active projects
        this.prisma.project.count({
          where: { tenantId, status: 'ACTIVE' },
        }),
        // Count pending requests
        this.prisma.projectRequest.count({
          where: { tenantId, status: 'PENDING' },
        }),
        // Count recent activity (last 7 days)
        this.prisma.projectEvent.count({
          where: {
            tenantId,
            createdAt: { gte: weekAgo },
          },
        }),
      ]);

    // Verify tenant exists
    if (!tenant) {
      throw new NotFoundError(`Tenant ${tenantId} not found`);
    }

    return {
      activeProjectCount,
      pendingRequestCount,
      recentActivityCount,
      greeting: `Welcome back! You have ${activeProjectCount} active project${activeProjectCount !== 1 ? 's' : ''} and ${pendingRequestCount} pending request${pendingRequestCount !== 1 ? 's' : ''}.`,
    };
  }

  // ==========================================================================
  // Project Operations
  // ==========================================================================

  /**
   * Get project details with booking info
   *
   * @param tenantId - Tenant ID for isolation
   * @param projectId - Project ID
   * @returns Project with booking context
   * @throws NotFoundError if project not found
   */
  async getProjectDetails(tenantId: string, projectId: string): Promise<ProjectWithBooking> {
    logger.info({ tenantId, projectId }, '[ProjectHub] Getting project details');

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId }, // CRITICAL: tenant-scoped
      include: {
        booking: {
          include: {
            package: {
              select: { id: true, name: true, basePrice: true },
            },
            customer: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundError(`Project ${projectId} not found`);
    }

    // Extract booking date - prefer date field, fall back to startTime
    const eventDate = project.booking.date ?? project.booking.startTime ?? new Date();

    return {
      id: project.id,
      tenantId: project.tenantId,
      status: project.status,
      version: project.version,
      customerPreferences: project.customerPreferences as Record<string, unknown> | null,
      tenantNotes: project.tenantNotes as Record<string, unknown> | null,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      booking: {
        id: project.booking.id,
        eventDate,
        package: project.booking.package
          ? {
              id: project.booking.package.id,
              name: project.booking.package.name,
              basePrice: project.booking.package.basePrice,
            }
          : null,
        customer: {
          id: project.booking.customer?.id ?? project.booking.customerId,
          name: project.booking.customer?.name ?? 'Unknown',
          email: project.booking.customer?.email ?? null,
        },
      },
    };
  }

  /**
   * Get timeline events for a project
   *
   * @param tenantId - Tenant ID for isolation
   * @param projectId - Project ID
   * @param actor - Filter by visibility (customer sees different events than tenant)
   * @returns Timeline events ordered by creation time
   */
  async getTimeline(
    tenantId: string,
    projectId: string,
    actor: 'customer' | 'tenant'
  ): Promise<TimelineEvent[]> {
    logger.info({ tenantId, projectId, actor }, '[ProjectHub] Getting project timeline');

    // Build visibility filter
    const visibilityFilter =
      actor === 'customer' ? { visibleToCustomer: true } : { visibleToTenant: true };

    // Verify project belongs to tenant
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundError(`Project ${projectId} not found`);
    }

    const events = await this.prisma.projectEvent.findMany({
      where: {
        projectId,
        tenantId, // CRITICAL: tenant-scoped
        ...visibilityFilter,
      },
      orderBy: { createdAt: 'asc' },
    });

    return events.map((e) => ({
      id: e.id,
      type: e.type,
      actor: e.actor,
      payload: e.payload as Record<string, unknown>,
      visibleToCustomer: e.visibleToCustomer,
      visibleToTenant: e.visibleToTenant,
      createdAt: e.createdAt,
    }));
  }

  // ==========================================================================
  // Request Operations
  // ==========================================================================

  /**
   * Get pending requests for a tenant (dashboard view)
   *
   * @param tenantId - Tenant ID
   * @param limit - Maximum number of requests to return (default 25, max 50)
   * @returns Pending requests with project context and hasMore flag
   */
  async getPendingRequests(
    tenantId: string,
    limit: number = 25
  ): Promise<{ requests: ProjectRequestWithContext[]; hasMore: boolean }> {
    // Enforce maximum limit to prevent unbounded queries (Pitfall #67)
    const MAX_LIMIT = 50;
    const effectiveLimit = Math.min(limit, MAX_LIMIT);

    logger.info({ tenantId, limit: effectiveLimit }, '[ProjectHub] Getting pending requests');

    const requests = await this.prisma.projectRequest.findMany({
      where: {
        tenantId, // CRITICAL: tenant-scoped
        status: 'PENDING',
      },
      include: {
        project: {
          include: {
            booking: {
              include: {
                customer: { select: { name: true, email: true } },
                package: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' }, // Oldest first (FIFO)
      take: effectiveLimit + 1, // Fetch one extra to check if more exist
    });

    const hasMore = requests.length > effectiveLimit;
    const items = hasMore ? requests.slice(0, effectiveLimit) : requests;

    return {
      requests: items.map((r) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        requestData: r.requestData as Record<string, unknown>,
        responseData: r.responseData as Record<string, unknown> | null,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
        version: r.version,
        project: {
          id: r.project.id,
          booking: {
            eventDate: r.project.booking.date ?? r.project.booking.startTime ?? new Date(),
            customer: {
              name: r.project.booking.customer?.name ?? 'Unknown',
              email: r.project.booking.customer?.email ?? '',
            },
            package: r.project.booking.package ? { name: r.project.booking.package.name } : null,
          },
        },
      })),
      hasMore,
    };
  }

  /**
   * Create a new request (customer-initiated)
   *
   * T2/T3 action: Questions and add-ons are T2, cancellations and refunds are T3
   *
   * @param input - Request creation input
   * @returns Created request
   * @throws NotFoundError if project not found
   */
  async createRequest(input: CreateRequestInput): Promise<ProjectRequestWithContext> {
    const { tenantId, projectId, type, requestData } = input;

    logger.info({ tenantId, projectId, type }, '[ProjectHub] Creating request');

    // Verify project exists and belongs to tenant
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundError(`Project ${projectId} not found`);
    }

    // Calculate expiry (72 hours for escalation deadline)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    // Create request and event in a transaction
    const request = await this.prisma.$transaction(async (tx) => {
      // Create the request
      const newRequest = await tx.projectRequest.create({
        data: {
          tenantId,
          projectId,
          type,
          status: 'PENDING',
          requestData: requestData as Prisma.InputJsonValue,
          expiresAt,
          version: 1,
        },
      });

      // Get next event version using helper
      const nextVersion = await this.getNextEventVersion(tx, projectId);

      // Record event
      await tx.projectEvent.create({
        data: {
          tenantId,
          projectId,
          version: nextVersion,
          type: 'REQUEST_SUBMITTED',
          actor: 'CUSTOMER',
          payload: {
            requestId: newRequest.id,
            type,
            requestData,
          } as Prisma.InputJsonValue,
          visibleToCustomer: true,
          visibleToTenant: true,
        },
      });

      return newRequest;
    });

    return {
      id: request.id,
      type: request.type,
      status: request.status,
      requestData: request.requestData as Record<string, unknown>,
      responseData: null,
      expiresAt: request.expiresAt,
      createdAt: request.createdAt,
      version: request.version,
    };
  }

  /**
   * Approve a request (tenant action)
   *
   * Uses optimistic locking to prevent concurrent modification.
   *
   * @param input - Handle request input with expected version
   * @returns Updated request
   * @throws NotFoundError if request not found
   * @throws ConcurrentModificationError if version mismatch
   * @throws ValidationError if request already resolved
   */
  async approveRequest(input: HandleRequestInput): Promise<ProjectRequestWithContext> {
    const { tenantId, requestId, expectedVersion, response } = input;

    logger.info({ tenantId, requestId, expectedVersion }, '[ProjectHub] Approving request');

    // Use transaction with optimistic locking
    const request = await this.prisma.$transaction(async (tx) => {
      // Validate request with optimistic lock using helper
      const existing = await this.validateAndLockRequest(tx, tenantId, requestId, expectedVersion);

      // Update request
      const updated = await tx.projectRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          handledBy: 'TENANT' as RequestHandler,
          resolvedAt: new Date(),
          responseData: response ? { message: response } : { message: 'Approved' },
          version: { increment: 1 },
        },
      });

      // Get next event version using helper
      const nextVersion = await this.getNextEventVersion(tx, existing.projectId);

      // Record event
      await tx.projectEvent.create({
        data: {
          tenantId,
          projectId: existing.projectId,
          version: nextVersion,
          type: 'REQUEST_APPROVED',
          actor: 'TENANT',
          payload: { requestId, response },
          visibleToCustomer: true,
          visibleToTenant: true,
        },
      });

      return updated;
    });

    return {
      id: request.id,
      type: request.type,
      status: request.status,
      requestData: request.requestData as Record<string, unknown>,
      responseData: request.responseData as Record<string, unknown> | null,
      expiresAt: request.expiresAt,
      createdAt: request.createdAt,
      version: request.version,
    };
  }

  /**
   * Deny a request (tenant action)
   *
   * Uses optimistic locking to prevent concurrent modification.
   *
   * @param input - Handle request input with expected version and reason
   * @returns Updated request
   * @throws NotFoundError if request not found
   * @throws ConcurrentModificationError if version mismatch
   * @throws ValidationError if request already resolved or missing reason
   */
  async denyRequest(input: HandleRequestInput): Promise<ProjectRequestWithContext> {
    const { tenantId, requestId, expectedVersion, reason, response } = input;

    if (!reason) {
      throw new ValidationError('Reason is required when denying a request');
    }

    logger.info({ tenantId, requestId, expectedVersion }, '[ProjectHub] Denying request');

    const request = await this.prisma.$transaction(async (tx) => {
      // Validate request with optimistic lock using helper
      const existing = await this.validateAndLockRequest(tx, tenantId, requestId, expectedVersion);

      // Update request
      const updated = await tx.projectRequest.update({
        where: { id: requestId },
        data: {
          status: 'DENIED',
          handledBy: 'TENANT' as RequestHandler,
          resolvedAt: new Date(),
          responseData: { reason, message: response },
          version: { increment: 1 },
        },
      });

      // Get next event version using helper
      const nextVersion = await this.getNextEventVersion(tx, existing.projectId);

      // Record event
      await tx.projectEvent.create({
        data: {
          tenantId,
          projectId: existing.projectId,
          version: nextVersion,
          type: 'REQUEST_DENIED',
          actor: 'TENANT',
          payload: { requestId, reason, response },
          visibleToCustomer: true,
          visibleToTenant: true,
        },
      });

      return updated;
    });

    return {
      id: request.id,
      type: request.type,
      status: request.status,
      requestData: request.requestData as Record<string, unknown>,
      responseData: request.responseData as Record<string, unknown> | null,
      expiresAt: request.expiresAt,
      createdAt: request.createdAt,
      version: request.version,
    };
  }

  // ==========================================================================
  // Tenant Project Operations
  // ==========================================================================

  /**
   * List projects for a tenant with cursor-based pagination
   *
   * @param tenantId - Tenant ID
   * @param status - Optional status filter
   * @param cursor - Cursor for pagination (last project ID)
   * @param limit - Maximum number of projects to return (default 50, max 100)
   * @returns Projects with booking summaries, pagination cursor, and hasMore flag
   */
  async listProjects(
    tenantId: string,
    status?: ProjectStatus,
    cursor?: string,
    limit: number = 50
  ): Promise<{ projects: Array<ProjectWithBooking>; nextCursor?: string; hasMore: boolean }> {
    // Enforce maximum limit to prevent unbounded queries (Pitfall #67)
    const MAX_LIMIT = 100;
    const effectiveLimit = Math.min(limit, MAX_LIMIT);

    logger.info(
      { tenantId, status, cursor, limit: effectiveLimit },
      '[ProjectHub] Listing projects'
    );

    const whereClause = status ? { tenantId, status } : { tenantId };

    const projects = await this.prisma.project.findMany({
      where: whereClause,
      include: {
        booking: {
          include: {
            package: { select: { id: true, name: true, basePrice: true } },
            customer: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: effectiveLimit + 1, // Fetch one extra to check if more exist
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0, // Skip the cursor item itself
    });

    const hasMore = projects.length > effectiveLimit;
    const items = hasMore ? projects.slice(0, effectiveLimit) : projects;
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

    const mappedProjects = items.map((p) => ({
      id: p.id,
      tenantId: p.tenantId,
      status: p.status,
      version: p.version,
      customerPreferences: p.customerPreferences as Record<string, unknown> | null,
      tenantNotes: p.tenantNotes as Record<string, unknown> | null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      booking: {
        id: p.booking.id,
        eventDate: p.booking.date ?? p.booking.startTime ?? new Date(),
        package: p.booking.package
          ? {
              id: p.booking.package.id,
              name: p.booking.package.name,
              basePrice: p.booking.package.basePrice,
            }
          : null,
        customer: {
          id: p.booking.customer?.id ?? p.booking.customerId,
          name: p.booking.customer?.name ?? 'Unknown',
          email: p.booking.customer?.email ?? null,
        },
      },
    }));

    return { projects: mappedProjects, nextCursor, hasMore };
  }

  /**
   * Add a tenant note to a project
   *
   * @param tenantId - Tenant ID for isolation
   * @param projectId - Project ID
   * @param note - Note content
   * @returns Updated project
   */
  async addTenantNote(
    tenantId: string,
    projectId: string,
    note: string
  ): Promise<ProjectWithBooking> {
    logger.info({ tenantId, projectId }, '[ProjectHub] Adding tenant note');

    // Verify project exists
    const existing = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
      select: { tenantNotes: true },
    });

    if (!existing) {
      throw new NotFoundError(`Project ${projectId} not found`);
    }

    // Append note to notes array
    const currentNotes = (existing.tenantNotes as {
      notes?: Array<{ text: string; timestamp: string }>;
    }) || { notes: [] };
    const notes = [
      ...(currentNotes.notes || []),
      { text: note, timestamp: new Date().toISOString() },
    ];

    await this.prisma.project.update({
      where: { id: projectId },
      data: { tenantNotes: { notes } },
    });

    return this.getProjectDetails(tenantId, projectId);
  }
}
