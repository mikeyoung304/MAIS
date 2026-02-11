/**
 * Tenant Agent Context Builder
 *
 * Builds context for the Tenant Agent by fetching data from the MAIS backend.
 * Context includes tenant info, segments, tiers, sections, and active projects.
 *
 * Design notes:
 * - Uses parallel fetching for performance (Promise.all)
 * - Summarizes section content to stay within token limits
 * - Returns dashboardCapabilities for the agent to understand what it can do
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
 */

import { callMaisApi, logger } from './utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TierLevel = 'GOOD' | 'BETTER' | 'BEST';

export type BlockType =
  | 'HERO'
  | 'ABOUT'
  | 'SERVICES'
  | 'PRICING'
  | 'TESTIMONIALS'
  | 'FAQ'
  | 'CONTACT'
  | 'CTA'
  | 'GALLERY'
  | 'CUSTOM';

export interface TierInfo {
  id: string;
  level: TierLevel;
  name: string;
  price: number;
  features: string[];
}

export interface SegmentInfo {
  id: string;
  name: string;
  slug: string;
  tiers: TierInfo[];
}

export interface SectionInfo {
  id: string;
  blockType: BlockType;
  isDraft: boolean;
  summary: string;
  segmentId: string | null;
}

export interface ProjectInfo {
  id: string;
  customerName: string;
  status: string;
  unreadMessages: number;
}

export interface TenantAgentContext {
  tenant: {
    id: string;
    name: string;
    slug: string;
    branding: {
      primaryColor?: string;
      secondaryColor?: string;
      accentColor?: string;
      fontFamily?: string;
      logoUrl?: string;
    };
  };
  segments: SegmentInfo[];
  sections: SectionInfo[];
  projects: ProjectInfo[];
  dashboardCapabilities: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Content Summarization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Summarize section content for token efficiency.
 *
 * Extracts key fields (headline, content preview) and truncates to ~50 words.
 * This keeps context compact while giving the agent enough info to understand
 * what's in each section.
 */
function summarizeContent(content: Record<string, unknown>, maxWords: number = 50): string {
  if (!content || Object.keys(content).length === 0) {
    return '[empty section]';
  }

  const parts: string[] = [];

  // Extract headline if present
  if (typeof content.headline === 'string' && content.headline) {
    parts.push(`Headline: "${content.headline}"`);
  }

  // Extract title if present
  if (typeof content.title === 'string' && content.title) {
    parts.push(`Title: "${content.title}"`);
  }

  // Extract content preview
  if (typeof content.content === 'string' && content.content) {
    const preview = content.content.substring(0, 100);
    parts.push(`Content: "${preview}${content.content.length > 100 ? '...' : ''}"`);
  }

  // Extract body preview (alternative to content)
  if (typeof content.body === 'string' && content.body) {
    const preview = content.body.substring(0, 100);
    parts.push(`Body: "${preview}${content.body.length > 100 ? '...' : ''}"`);
  }

  // For items-based sections (FAQ, testimonials), show count
  if (Array.isArray(content.items)) {
    parts.push(`${content.items.length} items`);
  }

  if (parts.length === 0) {
    return '[configured section]';
  }

  // Join and truncate to max words
  const summary = parts.join(' | ');
  const words = summary.split(/\s+/);
  if (words.length <= maxWords) {
    return summary;
  }
  return words.slice(0, maxWords).join(' ') + '...';
}

// ─────────────────────────────────────────────────────────────────────────────
// Context Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the full context for the Tenant Agent.
 *
 * Fetches tenant info, segments with tiers, section content, and active projects
 * in parallel for performance. Returns a structured context object that the
 * agent can use for routing and decision-making.
 *
 * @param tenantId - The tenant ID to build context for
 * @returns TenantAgentContext with all relevant data
 */
export async function buildTenantContext(tenantId: string): Promise<TenantAgentContext | null> {
  logger.info({ tenantId }, '[TenantAgent] Building context');

  try {
    // Fetch all data in parallel for performance
    const [tenantResult, segmentsResult, sectionsResult, projectsResult] = await Promise.all([
      callMaisApi('/tenant-context', tenantId),
      callMaisApi('/tenant-segments', tenantId),
      callMaisApi('/tenant-sections', tenantId),
      callMaisApi('/tenant-projects', tenantId, { activeOnly: true, limit: 10 }),
    ]);

    // Check for critical failures
    if (!tenantResult.ok) {
      logger.error({ error: tenantResult.error }, '[TenantAgent] Failed to fetch tenant info');
      return null;
    }

    const tenant = tenantResult.data as {
      id: string;
      name: string;
      slug: string;
      branding?: Record<string, unknown>;
    };

    // Parse segments (may be empty for new tenants)
    const rawSegments = segmentsResult.ok
      ? (segmentsResult.data as Array<{
          id: string;
          name: string;
          slug: string;
          tiers: Array<{
            id: string;
            level: TierLevel;
            name: string;
            price: number;
            features: unknown;
          }>;
        }>)
      : [];

    const segments: SegmentInfo[] = rawSegments.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      tiers: s.tiers.map((t) => ({
        id: t.id,
        level: t.level,
        name: t.name,
        price: typeof t.price === 'number' ? t.price : parseFloat(String(t.price)),
        features: Array.isArray(t.features)
          ? (t.features as Array<{ text: string }>).map((f) => f.text)
          : [],
      })),
    }));

    // Parse sections (may be empty for new tenants)
    const rawSections = sectionsResult.ok
      ? (sectionsResult.data as Array<{
          id: string;
          blockType: BlockType;
          isDraft: boolean;
          content: Record<string, unknown>;
          segmentId: string | null;
        }>)
      : [];

    const sections: SectionInfo[] = rawSections.map((s) => ({
      id: s.id,
      blockType: s.blockType,
      isDraft: s.isDraft,
      summary: summarizeContent(s.content),
      segmentId: s.segmentId,
    }));

    // Parse projects (may be empty)
    const rawProjects = projectsResult.ok
      ? (projectsResult.data as Array<{
          id: string;
          customerName: string;
          status: string;
          _count?: { messages: number };
          unreadMessages?: number;
        }>)
      : [];

    const projects: ProjectInfo[] = rawProjects.map((p) => ({
      id: p.id,
      customerName: p.customerName,
      status: p.status,
      unreadMessages: p.unreadMessages ?? p._count?.messages ?? 0,
    }));

    // Build dashboard capabilities list for agent reference
    // IMPORTANT: These must match actual tool names in tools/ directory
    const dashboardCapabilities = [
      // Navigation
      'navigate_to_section(section: "website" | "bookings" | "projects" | "settings")',

      // Website editing
      'resolve_vocabulary(phrase) — maps natural language to BlockType',
      'update_section(blockType, content) — updates website section, scrolls to it',
      'update_branding(colors, fonts) — updates brand colors (live immediately)',
      'reorder_sections(sectionId, position) — change section display order',
      'add_section(blockType) — add new section to storefront',
      'remove_section(sectionId) — remove section from storefront',

      // Packages
      'manage_packages(action, ...) — create/update/delete/list bookable packages',

      // Publishing
      'show_preview() — shows current draft state',
      'publish_draft() — requires confirmation (T3, token-based)',
      'discard_draft() — discard changes, requires confirmation (T3, token-based)',

      // Project management
      'get_project_details(projectId) — view project details',
      'send_message_to_customer(projectId, message) — message customer',
      'update_project_status(projectId, status) — change project status',
    ];

    logger.info(
      {
        tenantId,
        segmentCount: segments.length,
        sectionCount: sections.length,
        projectCount: projects.length,
      },
      '[TenantAgent] Context built successfully'
    );

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        branding: {
          primaryColor: tenant.branding?.primaryColor as string | undefined,
          secondaryColor: tenant.branding?.secondaryColor as string | undefined,
          accentColor: tenant.branding?.accentColor as string | undefined,
          fontFamily: tenant.branding?.fontFamily as string | undefined,
          logoUrl: tenant.branding?.logoUrl as string | undefined,
        },
      },
      segments,
      sections,
      projects,
      dashboardCapabilities,
    };
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error), tenantId },
      '[TenantAgent] Failed to build context'
    );
    return null;
  }
}
