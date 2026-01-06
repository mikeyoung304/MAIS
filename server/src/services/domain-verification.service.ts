/**
 * Domain Verification Service
 *
 * Handles custom domain verification for tenant websites.
 * Tenants add a TXT record to their domain: handled-verify=<token>
 * We verify by querying DNS for the TXT record.
 *
 * Example:
 * - Tenant wants to use: janephotography.com
 * - We generate token: abc123
 * - Tenant adds TXT record: _handled-verify.janephotography.com TXT "handled-verify=abc123"
 * - We verify by checking DNS
 */

import { promises as dns } from 'dns';
import { randomBytes } from 'crypto';
import type { PrismaClient, TenantDomain } from '../generated/prisma/client';
import { logger } from '../lib/core/logger';

/**
 * Result of a verification check
 */
export interface VerificationResult {
  verified: boolean;
  txtRecords: string[];
  expectedToken: string;
  error?: string;
}

/**
 * Domain info returned to clients
 */
export interface DomainInfo {
  id: string;
  domain: string;
  verified: boolean;
  isPrimary: boolean;
  verificationToken: string;
  verifiedAt: Date | null;
  createdAt: Date;
}

/**
 * Domain verification service
 */
export class DomainVerificationService {
  private readonly prisma: PrismaClient;
  private readonly txtPrefix: string = '_handled-verify';
  private readonly tokenPrefix: string = 'handled-verify=';

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Generate a secure verification token
   */
  generateToken(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Get the expected TXT record value
   */
  getExpectedTxtRecord(token: string): string {
    return `${this.tokenPrefix}${token}`;
  }

  /**
   * Get the TXT record hostname to add
   */
  getTxtRecordHostname(domain: string): string {
    return `${this.txtPrefix}.${domain}`;
  }

  /**
   * Add a new domain for a tenant
   *
   * SECURITY: tenantId must be validated upstream (from JWT/session)
   *
   * @param tenantId - Tenant ID (from authenticated session)
   * @param domain - Domain to add (e.g., "janephotography.com")
   * @returns Created domain record
   */
  async addDomain(tenantId: string, domain: string): Promise<DomainInfo> {
    // Normalize domain (lowercase, trim)
    const normalizedDomain = domain.toLowerCase().trim();

    // Validate domain format
    if (!this.isValidDomain(normalizedDomain)) {
      throw new Error('Invalid domain format');
    }

    // Check if domain already exists (for any tenant)
    const existing = await this.prisma.tenantDomain.findUnique({
      where: { domain: normalizedDomain },
    });

    if (existing) {
      if (existing.tenantId === tenantId) {
        throw new Error('Domain already added to your account');
      }
      throw new Error('Domain is already in use by another account');
    }

    // Generate verification token
    const verificationToken = this.generateToken();

    // Create domain record
    const tenantDomain = await this.prisma.tenantDomain.create({
      data: {
        tenantId,
        domain: normalizedDomain,
        verificationToken,
        verified: false,
        isPrimary: false,
      },
    });

    logger.info({ tenantId, domain: normalizedDomain }, 'Domain added for verification');

    return this.toDomainInfo(tenantDomain);
  }

  /**
   * Verify a domain by checking DNS TXT records
   *
   * @param tenantId - Tenant ID (for ownership check)
   * @param domainId - Domain ID to verify
   * @returns Verification result
   */
  async verifyDomain(tenantId: string, domainId: string): Promise<VerificationResult> {
    // Fetch domain and verify ownership
    const tenantDomain = await this.prisma.tenantDomain.findFirst({
      where: { id: domainId, tenantId },
    });

    if (!tenantDomain) {
      throw new Error('Domain not found');
    }

    if (tenantDomain.verified) {
      return {
        verified: true,
        txtRecords: [],
        expectedToken: this.getExpectedTxtRecord(tenantDomain.verificationToken),
      };
    }

    // Query DNS for TXT records
    const txtHostname = this.getTxtRecordHostname(tenantDomain.domain);
    let txtRecords: string[] = [];

    try {
      const records = await dns.resolveTxt(txtHostname);
      // resolveTxt returns array of string arrays, flatten them
      txtRecords = records.flat();
    } catch (err: any) {
      if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
        // No TXT records found
        logger.debug(
          { domain: tenantDomain.domain, hostname: txtHostname },
          'No TXT records found for domain verification'
        );
      } else {
        logger.warn(
          { error: err, domain: tenantDomain.domain },
          'DNS lookup error during verification'
        );
        return {
          verified: false,
          txtRecords: [],
          expectedToken: this.getExpectedTxtRecord(tenantDomain.verificationToken),
          error: 'DNS lookup failed. Please try again later.',
        };
      }
    }

    // Check if expected token is in TXT records
    const expectedValue = this.getExpectedTxtRecord(tenantDomain.verificationToken);
    const verified = txtRecords.some((record) => record === expectedValue);

    if (verified) {
      // Update domain as verified
      await this.prisma.tenantDomain.update({
        where: { id: domainId },
        data: {
          verified: true,
          verifiedAt: new Date(),
        },
      });

      logger.info({ tenantId, domain: tenantDomain.domain }, 'Domain verified successfully');
    } else {
      logger.debug(
        {
          domain: tenantDomain.domain,
          expected: expectedValue,
          found: txtRecords,
        },
        'Domain verification failed - token not found'
      );
    }

    return {
      verified,
      txtRecords,
      expectedToken: expectedValue,
    };
  }

  /**
   * Get all domains for a tenant
   *
   * @param tenantId - Tenant ID
   * @returns Array of domain info
   */
  async getDomains(tenantId: string): Promise<DomainInfo[]> {
    const domains = await this.prisma.tenantDomain.findMany({
      where: { tenantId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    return domains.map((d) => this.toDomainInfo(d));
  }

  /**
   * Get a single domain by ID
   *
   * @param tenantId - Tenant ID (for ownership check)
   * @param domainId - Domain ID
   * @returns Domain info or null
   */
  async getDomain(tenantId: string, domainId: string): Promise<DomainInfo | null> {
    const domain = await this.prisma.tenantDomain.findFirst({
      where: { id: domainId, tenantId },
    });

    return domain ? this.toDomainInfo(domain) : null;
  }

  /**
   * Set a domain as primary
   *
   * @param tenantId - Tenant ID
   * @param domainId - Domain ID to make primary
   */
  async setPrimaryDomain(tenantId: string, domainId: string): Promise<DomainInfo> {
    // Verify ownership and verified status
    const domain = await this.prisma.tenantDomain.findFirst({
      where: { id: domainId, tenantId },
    });

    if (!domain) {
      throw new Error('Domain not found');
    }

    if (!domain.verified) {
      throw new Error('Domain must be verified before setting as primary');
    }

    // Transaction: unset current primary, set new primary
    await this.prisma.$transaction([
      this.prisma.tenantDomain.updateMany({
        where: { tenantId, isPrimary: true },
        data: { isPrimary: false },
      }),
      this.prisma.tenantDomain.update({
        where: { id: domainId },
        data: { isPrimary: true },
      }),
    ]);

    logger.info({ tenantId, domainId, domain: domain.domain }, 'Primary domain updated');

    // Fetch updated domain
    const updated = await this.prisma.tenantDomain.findUnique({
      where: { id: domainId },
    });

    return this.toDomainInfo(updated!);
  }

  /**
   * Remove a domain
   *
   * @param tenantId - Tenant ID
   * @param domainId - Domain ID to remove
   */
  async removeDomain(tenantId: string, domainId: string): Promise<void> {
    const domain = await this.prisma.tenantDomain.findFirst({
      where: { id: domainId, tenantId },
    });

    if (!domain) {
      throw new Error('Domain not found');
    }

    await this.prisma.tenantDomain.delete({
      where: { id: domainId },
    });

    logger.info({ tenantId, domainId, domain: domain.domain }, 'Domain removed');
  }

  /**
   * Validate domain format
   */
  private isValidDomain(domain: string): boolean {
    // Basic domain validation
    // Must be lowercase, alphanumeric with hyphens and dots
    // No consecutive dots, no leading/trailing hyphens
    const domainRegex = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
    return domainRegex.test(domain) && domain.length <= 253;
  }

  /**
   * Convert database record to public DTO
   */
  private toDomainInfo(domain: TenantDomain): DomainInfo {
    return {
      id: domain.id,
      domain: domain.domain,
      verified: domain.verified,
      isPrimary: domain.isPrimary,
      verificationToken: domain.verificationToken,
      verifiedAt: domain.verifiedAt,
      createdAt: domain.createdAt,
    };
  }
}
