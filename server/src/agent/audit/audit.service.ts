/**
 * Agent Audit Service
 *
 * Logs all agent tool calls for security compliance.
 * Retention: 90 days minimum, 7 years for financial operations.
 */

import type { PrismaClient, AgentTrustTier, AgentApprovalStatus } from '../../generated/prisma';
import { logger } from '../../lib/core/logger';

/**
 * Audit log entry input
 */
export interface AuditLogInput {
  tenantId: string;
  sessionId: string;
  toolName: string;
  proposalId?: string;
  inputSummary: string;
  outputSummary: string;
  trustTier: AgentTrustTier;
  approvalStatus: AgentApprovalStatus;
  durationMs?: number;
  success: boolean;
  errorMessage?: string;
}

/**
 * Agent Audit Service
 */
export class AuditService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Log a tool call
   */
  async logToolCall(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.agentAuditLog.create({
        data: {
          tenantId: input.tenantId,
          sessionId: input.sessionId,
          toolName: input.toolName,
          proposalId: input.proposalId,
          inputSummary: this.truncate(input.inputSummary, 500),
          outputSummary: this.truncate(input.outputSummary, 500),
          trustTier: input.trustTier,
          approvalStatus: input.approvalStatus,
          durationMs: input.durationMs,
          success: input.success,
          errorMessage: input.errorMessage ? this.truncate(input.errorMessage, 1000) : undefined,
        },
      });
    } catch (error) {
      // Log but don't fail the operation
      logger.error({ error, input }, 'Failed to write audit log');
    }
  }

  /**
   * Convenience method for logging successful read operations
   */
  async logRead(
    tenantId: string,
    sessionId: string,
    toolName: string,
    inputSummary: string,
    outputSummary: string,
    durationMs?: number
  ): Promise<void> {
    await this.logToolCall({
      tenantId,
      sessionId,
      toolName,
      inputSummary,
      outputSummary,
      trustTier: 'T1', // Read operations are T1
      approvalStatus: 'AUTO',
      durationMs,
      success: true,
    });
  }

  /**
   * Convenience method for logging proposal creation
   */
  async logProposalCreated(
    tenantId: string,
    sessionId: string,
    toolName: string,
    proposalId: string,
    trustTier: AgentTrustTier,
    inputSummary: string,
    durationMs?: number
  ): Promise<void> {
    const approvalStatus: AgentApprovalStatus =
      trustTier === 'T1' ? 'AUTO' : trustTier === 'T2' ? 'SOFT' : 'EXPLICIT';

    await this.logToolCall({
      tenantId,
      sessionId,
      toolName,
      proposalId,
      inputSummary,
      outputSummary: `Proposal created: ${proposalId}`,
      trustTier,
      approvalStatus,
      durationMs,
      success: true,
    });
  }

  /**
   * Convenience method for logging errors
   */
  async logError(
    tenantId: string,
    sessionId: string,
    toolName: string,
    inputSummary: string,
    errorMessage: string,
    durationMs?: number
  ): Promise<void> {
    await this.logToolCall({
      tenantId,
      sessionId,
      toolName,
      inputSummary,
      outputSummary: 'Error',
      trustTier: 'T1',
      approvalStatus: 'AUTO',
      durationMs,
      success: false,
      errorMessage,
    });
  }

  /**
   * Get audit logs for a session
   */
  async getSessionLogs(
    tenantId: string,
    sessionId: string,
    limit = 50
  ): Promise<AuditLogEntry[]> {
    const logs = await this.prisma.agentAuditLog.findMany({
      where: {
        tenantId,
        sessionId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      toolName: log.toolName,
      proposalId: log.proposalId,
      inputSummary: log.inputSummary,
      outputSummary: log.outputSummary,
      trustTier: log.trustTier,
      approvalStatus: log.approvalStatus,
      durationMs: log.durationMs,
      success: log.success,
      errorMessage: log.errorMessage,
      createdAt: log.createdAt.toISOString(),
    }));
  }

  /**
   * Get audit logs for a tenant (admin view)
   */
  async getTenantLogs(
    tenantId: string,
    options: {
      fromDate?: Date;
      toDate?: Date;
      toolName?: string;
      success?: boolean;
      limit?: number;
    } = {}
  ): Promise<AuditLogEntry[]> {
    const { fromDate, toDate, toolName, success, limit = 100 } = options;

    const logs = await this.prisma.agentAuditLog.findMany({
      where: {
        tenantId,
        ...(fromDate || toDate
          ? {
              createdAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
        ...(toolName ? { toolName } : {}),
        ...(success !== undefined ? { success } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });

    return logs.map((log) => ({
      id: log.id,
      sessionId: log.sessionId,
      toolName: log.toolName,
      proposalId: log.proposalId,
      inputSummary: log.inputSummary,
      outputSummary: log.outputSummary,
      trustTier: log.trustTier,
      approvalStatus: log.approvalStatus,
      durationMs: log.durationMs,
      success: log.success,
      errorMessage: log.errorMessage,
      createdAt: log.createdAt.toISOString(),
    }));
  }

  /**
   * Cleanup old audit logs (call periodically)
   *
   * Default retention: 90 days
   * Financial operations: 7 years (not deleted by this method)
   */
  async cleanupOldLogs(retentionDays = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Don't delete financial operation logs (cancel_booking, refund-related)
    const financialTools = ['cancel_booking'];

    const result = await this.prisma.agentAuditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        toolName: { notIn: financialTools },
      },
    });

    if (result.count > 0) {
      logger.info(
        { count: result.count, retentionDays },
        'Old audit logs cleaned up'
      );
    }

    return result.count;
  }

  /**
   * Truncate string to max length
   */
  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
  }
}

/**
 * Audit log entry for API responses
 */
export interface AuditLogEntry {
  id: string;
  sessionId?: string;
  toolName: string;
  proposalId: string | null;
  inputSummary: string;
  outputSummary: string;
  trustTier: AgentTrustTier;
  approvalStatus: AgentApprovalStatus;
  durationMs: number | null;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
}
