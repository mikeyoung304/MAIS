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
import { sanitizeForContext, DENY_LIST_FIELDS } from '../tools/types';
import { logger } from '../../lib/core/logger';

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
      throw new Error('Tenant not found');
    }

    // Get quick stats
    const now = new Date();
    const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [packageCount, totalBookings, upcomingBookings, revenueThisMonth] = await Promise.all([
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
    logger.error({ error, tenantId }, 'Error building session context');
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
}): string {
  const {
    businessName,
    businessSlug,
    stripeConnected,
    packageCount,
    upcomingBookings,
    totalBookings,
    revenueThisMonth,
  } = data;

  // Format revenue
  const revenueFormatted = `$${(revenueThisMonth / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return `## Your Business Context

You are helping **${businessName}** (${businessSlug}).

**Setup:**
- Stripe: ${stripeConnected ? 'Ready for payments' : 'Not yet connected - guide them to set up'}
- Packages: ${packageCount} configured
- Upcoming bookings: ${upcomingBookings} in next 30 days

**Quick Stats:**
- Total bookings: ${totalBookings}
- This month revenue: ${revenueFormatted}

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
 * Detect user type and suggest onboarding path
 * @deprecated Use getHandledGreeting() for HANDLED voice
 */
export function detectOnboardingPath(context: AgentSessionContext): {
  userType: 'new' | 'returning' | 'needs_stripe';
  suggestedMessage: string;
} {
  const { quickStats } = context;

  if (!quickStats.stripeConnected) {
    return {
      userType: 'needs_stripe',
      suggestedMessage: getHandledGreeting(context),
    };
  }

  if (quickStats.packageCount === 0 && quickStats.totalBookings === 0) {
    return {
      userType: 'new',
      suggestedMessage: getHandledGreeting(context),
    };
  }

  return {
    userType: 'returning',
    suggestedMessage: getHandledGreeting(context),
  };
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
