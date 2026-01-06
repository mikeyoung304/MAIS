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

import type { PrismaClient } from '../../generated/prisma';
import { sanitizeForContext } from '../tools/types';
import { logger } from '../../lib/core/logger';
import { sanitizeError } from '../../lib/core/error-sanitizer';

/**
 * Onboarding state - used for health check and greeting logic
 */
export type OnboardingState = 'needs_stripe' | 'needs_packages' | 'needs_bookings' | 'ready';

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
}

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
    };
  } catch (error) {
    logger.error({ error: sanitizeError(error), tenantId }, 'Error building session context');
    throw error;
  }
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

  return `## Your Business Context

You are helping **${businessName}** (${businessSlug}).

**Setup:**
- Stripe: ${stripeConnected ? 'Ready for payments' : 'Not connected'}
- Packages: ${packageCount} configured
- Upcoming: ${upcomingBookings} booking${upcomingBookings !== 1 ? 's' : ''} in next 30 days

**Quick Stats:**
- Total bookings: ${totalBookings}
- This month: ${revenueFormatted}
${packagesSection}${onboardingHint}

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
 * Matches brand voice: cheeky, professional, direct
 */
export function getHandledGreeting(context: AgentSessionContext): string {
  const { quickStats } = context;

  // Needs Stripe
  if (!quickStats.stripeConnected) {
    return `Your Stripe isn't connected yet. I can handle that — takes about 3 minutes, then you never touch it again. Want to knock it out?`;
  }

  // Has Stripe, no packages
  if (quickStats.packageCount === 0) {
    return `Stripe's connected. ✓ Now you need something to sell. What do you offer — sessions, packages, something else?`;
  }

  // Has packages, no bookings
  if (quickStats.totalBookings === 0) {
    return `You've got ${quickStats.packageCount} package${quickStats.packageCount > 1 ? 's' : ''} ready to go. Now let's get some clients booking. Want me to help you share your booking link?`;
  }

  // Returning user with upcoming bookings
  const upcoming = quickStats.upcomingBookings;
  if (upcoming > 0) {
    return `${upcoming} client${upcoming > 1 ? 's' : ''} coming up. What should we work on?`;
  }

  // Active user, no upcoming
  return `What should we knock out today?`;
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
