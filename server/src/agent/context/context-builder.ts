/**
 * Agent Context Builder
 *
 * Builds the initial context injection for agent sessions.
 * Follows the "single static injection" pattern - tools are the refresh mechanism.
 *
 * Security:
 * - Never includes sensitive fields (passwords, API keys, secrets)
 * - Sanitizes user-controlled data
 * - Uses tenantId from JWT only
 */

import type { PrismaClient } from '../../generated/prisma/client';
import { sanitizeForContext } from '../tools/types';
import { logger } from '../../lib/core/logger';
import { sanitizeError } from '../../lib/core/error-sanitizer';

/**
 * Onboarding state - used for health check and greeting logic
 */
export type OnboardingState = 'needs_stripe' | 'needs_packages' | 'needs_bookings' | 'ready';

/**
 * Storefront completion status for agent guidance
 */
export interface StorefrontCompletionStatus {
  /** Overall completion percentage (0-100) */
  percentComplete: number;
  /** Number of fields still with placeholder content */
  unfilledCount: number;
  /** Whether tenant is using default template (no customization yet) */
  isShowingDefaults: boolean;
  /** Whether tenant has a draft in progress */
  hasDraft: boolean;
  /** Suggested next section to work on */
  nextSuggestedSection: string | null;
  /** Summary message for agent context */
  summary: string;
}

/**
 * Agent session context
 */
export interface AgentSessionContext {
  tenantId: string;
  sessionId: string;
  businessName: string;
  businessSlug: string;
  contextPrompt: string;
  quickStats: {
    stripeConnected: boolean;
    packageCount: number;
    upcomingBookings: number;
    totalBookings: number;
    revenueThisMonth: number;
  };
  /** Storefront completion tracking for guided onboarding */
  storefrontCompletion?: StorefrontCompletionStatus;
}

/**
 * Placeholder regex pattern - matches [Text Like This]
 */
const PLACEHOLDER_REGEX = /\[[^\]]+\]/;

/**
 * Build session context for agent initialization
 */
export async function buildSessionContext(
  prisma: PrismaClient,
  tenantId: string,
  sessionId: string
): Promise<AgentSessionContext> {
  try {
    // Fetch tenant with safe fields only
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        slug: true,
        stripeOnboarded: true,
        landingPageConfig: true,
        landingPageConfigDraft: true,
        // Explicitly exclude sensitive fields
        // passwordHash: false, etc. (handled by select)
      },
    });

    if (!tenant) {
      throw new Error('Unable to load business profile. Please try again.');
    }

    // Get quick stats
    const now = new Date();
    const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [packageCount, totalBookings, upcomingBookings, revenueThisMonth, activePackages] =
      await Promise.all([
        prisma.package.count({ where: { tenantId } }),
        prisma.booking.count({ where: { tenantId } }),
        prisma.booking.count({
          where: {
            tenantId,
            date: { gte: now, lte: next30Days },
            status: { notIn: ['CANCELED', 'REFUNDED'] },
          },
        }),
        prisma.booking.aggregate({
          where: {
            tenantId,
            createdAt: { gte: thisMonthStart },
            status: { in: ['PAID', 'CONFIRMED', 'FULFILLED'] },
          },
          _sum: { totalPrice: true },
        }),
        // Active packages for context (max 10, sorted by price for Good/Better/Best display)
        prisma.package.findMany({
          where: { tenantId, active: true },
          select: { name: true, slug: true, basePrice: true },
          take: 10,
          orderBy: { basePrice: 'asc' },
        }),
      ]);

    // Build storefront completion status for guided onboarding
    const storefrontCompletion = buildStorefrontCompletionStatus(
      tenant.landingPageConfigDraft,
      tenant.landingPageConfig
    );

    // Build context prompt
    const contextPrompt = buildContextPrompt({
      businessName: sanitizeForContext(tenant.name, 100),
      businessSlug: tenant.slug,
      stripeConnected: tenant.stripeOnboarded,
      packageCount,
      upcomingBookings,
      totalBookings,
      revenueThisMonth: revenueThisMonth._sum?.totalPrice ?? 0,
      packages: activePackages,
      storefrontCompletion,
    });

    return {
      tenantId,
      sessionId,
      businessName: sanitizeForContext(tenant.name, 100),
      businessSlug: tenant.slug,
      contextPrompt,
      quickStats: {
        stripeConnected: tenant.stripeOnboarded,
        packageCount,
        upcomingBookings,
        totalBookings,
        revenueThisMonth: revenueThisMonth._sum?.totalPrice ?? 0,
      },
      storefrontCompletion,
    };
  } catch (error) {
    logger.error({ error: sanitizeError(error), tenantId }, 'Error building session context');
    throw error;
  }
}

/**
 * Build storefront completion status for agent guidance.
 *
 * This provides a quick overview of what sections need work,
 * without the full detail of get_unfilled_placeholders tool.
 * Agent can use this to guide users through setup.
 */
function buildStorefrontCompletionStatus(
  draftConfig: unknown,
  liveConfig: unknown
): StorefrontCompletionStatus {
  // Determine what config to analyze (draft > live > defaults)
  const isShowingDefaults = !draftConfig && !liveConfig;
  const hasDraft = !!draftConfig;
  const workingConfig = draftConfig || liveConfig;

  // Parse config safely
  let pages: Record<
    string,
    { sections: Array<{ type: string; id?: string } & Record<string, unknown>> }
  >;
  try {
    if (workingConfig && typeof workingConfig === 'object') {
      const cfg = workingConfig as { pages?: unknown };
      pages = (cfg.pages as typeof pages) || getDefaultPages();
    } else {
      pages = getDefaultPages();
    }
  } catch {
    pages = getDefaultPages();
  }

  // Count total editable fields and filled fields
  let totalFields = 0;
  let filledFields = 0;
  let firstUnfilledSection: string | null = null;

  const editableKeys = [
    'headline',
    'subheadline',
    'content',
    'ctaText',
    'email',
    'phone',
    'address',
    'hours',
  ];

  for (const [pageName, pageConfig] of Object.entries(pages)) {
    for (const section of pageConfig.sections || []) {
      const sectionId = section.id || `${pageName}-${section.type}-main`;

      for (const key of editableKeys) {
        const value = section[key];
        if (typeof value === 'string' && value.length > 0) {
          totalFields++;
          if (!PLACEHOLDER_REGEX.test(value)) {
            filledFields++;
          } else if (!firstUnfilledSection) {
            firstUnfilledSection = sectionId;
          }
        }
      }

      // Also check array items (testimonials, FAQ)
      const items = section['items'] as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(items)) {
        for (const item of items) {
          for (const [key, value] of Object.entries(item)) {
            if (typeof value === 'string' && value.length > 0) {
              totalFields++;
              if (!PLACEHOLDER_REGEX.test(value)) {
                filledFields++;
              } else if (!firstUnfilledSection) {
                firstUnfilledSection = sectionId;
              }
            }
          }
        }
      }
    }
  }

  const percentComplete = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 100;
  const unfilledCount = totalFields - filledFields;

  // Build summary
  let summary: string;
  if (isShowingDefaults) {
    summary = `Default template. ${unfilledCount} fields to customize.`;
  } else if (unfilledCount === 0) {
    summary = 'All content filled! Ready to publish.';
  } else {
    summary = `${percentComplete}% complete. ${unfilledCount} fields remaining.`;
  }

  return {
    percentComplete,
    unfilledCount,
    isShowingDefaults,
    hasDraft,
    nextSuggestedSection: firstUnfilledSection,
    summary,
  };
}

/**
 * Get default pages structure for completion tracking
 */
function getDefaultPages(): Record<string, { sections: Array<{ type: string; id?: string }> }> {
  return {
    home: {
      sections: [
        { type: 'hero', id: 'home-hero-main' },
        { type: 'text', id: 'home-text-about' },
        { type: 'testimonials', id: 'home-testimonials-main' },
        { type: 'faq', id: 'home-faq-main' },
        { type: 'contact', id: 'home-contact-main' },
        { type: 'cta', id: 'home-cta-main' },
      ],
    },
  };
}

/**
 * Build the context prompt for agent initialization
 */
function buildContextPrompt(data: {
  businessName: string;
  businessSlug: string;
  stripeConnected: boolean;
  packageCount: number;
  upcomingBookings: number;
  totalBookings: number;
  revenueThisMonth: number;
  packages: Array<{ name: string; slug: string; basePrice: number }>;
  storefrontCompletion?: StorefrontCompletionStatus;
}): string {
  const {
    businessName,
    businessSlug,
    stripeConnected,
    packageCount,
    upcomingBookings,
    totalBookings,
    revenueThisMonth,
    packages,
    storefrontCompletion,
  } = data;

  // Format revenue
  const revenueFormatted = `$${(revenueThisMonth / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  // Build packages section (only if they have packages)
  let packagesSection = '';
  if (packages.length > 0) {
    const packageLines = packages
      .map((p) => {
        const price = `$${(p.basePrice / 100).toFixed(0)}`;
        // Sanitize package name for prompt injection defense
        return `  - ${sanitizeForContext(p.name, 100)}: ${price}`;
      })
      .join('\n');
    packagesSection = `\n**Your Packages:**\n${packageLines}\n`;
  }

  // Build onboarding hint
  let onboardingHint = '';
  if (!stripeConnected) {
    onboardingHint = '\n**Next Step:** Help them connect Stripe first.';
  } else if (packageCount === 0) {
    onboardingHint = '\n**Next Step:** Help them create their first package.';
  } else if (totalBookings === 0) {
    onboardingHint = '\n**Next Step:** Help them share their booking link.';
  }

  // Build storefront status section
  let storefrontSection = '';
  if (storefrontCompletion) {
    storefrontSection = `
**Storefront:**
- ${storefrontCompletion.summary}
- ${storefrontCompletion.hasDraft ? 'Draft in progress' : 'No draft changes'}
${storefrontCompletion.nextSuggestedSection ? `- Next section: ${storefrontCompletion.nextSuggestedSection}` : ''}`;
  }

  return `## Your Business Context

You are helping **${businessName}** (${businessSlug}).

**Setup:**
- Stripe: ${stripeConnected ? 'Ready for payments' : 'Not connected'}
- Packages: ${packageCount} configured
- Upcoming: ${upcomingBookings} booking${upcomingBookings !== 1 ? 's' : ''} in next 30 days

**Quick Stats:**
- Total bookings: ${totalBookings}
- This month: ${revenueFormatted}
${packagesSection}${storefrontSection}${onboardingHint}

For current details, use your read tools.`;
}

/**
 * Detect onboarding state from context
 * Used by health check and greeting logic
 */
export function detectOnboardingState(context: AgentSessionContext): OnboardingState {
  const { quickStats } = context;

  if (!quickStats.stripeConnected) {
    return 'needs_stripe';
  }

  if (quickStats.packageCount === 0) {
    return 'needs_packages';
  }

  if (quickStats.totalBookings === 0) {
    return 'needs_bookings';
  }

  return 'ready';
}

/**
 * Get HANDLED-voice greeting based on context
 * Hip, terse, gets to the point
 */
export function getHandledGreeting(context: AgentSessionContext): string {
  const { quickStats } = context;

  // Returning user with upcoming bookings
  const upcoming = quickStats.upcomingBookings;
  if (upcoming > 0) {
    return `${upcoming} booking${upcoming > 1 ? 's' : ''} coming up. What's next?`;
  }

  // Has packages, no bookings yet
  if (quickStats.packageCount > 0 && quickStats.totalBookings === 0) {
    return `Packages set. Time to get some bookings. Need help sharing your link?`;
  }

  // No packages yet
  if (quickStats.packageCount === 0) {
    return `What do you sell — sessions, packages, day rates?`;
  }

  // Active user, no upcoming
  return `What's next?`;
}

/**
 * Build error-safe fallback context
 * Used when full context cannot be built
 */
export function buildFallbackContext(tenantId: string, sessionId: string): AgentSessionContext {
  return {
    tenantId,
    sessionId,
    businessName: 'Your Business',
    businessSlug: 'unknown',
    contextPrompt: `## Your Business Context

I'm having trouble loading your business details. Please let me know what you'd like to work on, and I'll do my best to help.

For current details, use your read tools.`,
    quickStats: {
      stripeConnected: false,
      packageCount: 0,
      upcomingBookings: 0,
      totalBookings: 0,
      revenueThisMonth: 0,
    },
  };
}
