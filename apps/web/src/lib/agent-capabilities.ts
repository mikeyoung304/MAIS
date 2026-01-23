/**
 * Agent Capabilities Registry
 *
 * This module defines discoverable agent capabilities for the future command palette (Cmd+K).
 * The helper functions (searchCapabilities, getCapabilitiesByCategory, etc.) are scaffolding
 * for the command palette feature planned in Phase X.
 *
 * Central registry of all agent capabilities for:
 * - User discoverability (what can the agent do?)
 * - Command palette integration (Cmd+K)
 * - Contextual suggestions
 * - Trust tier documentation
 *
 * Trust Tiers:
 * - T1: Auto-confirm (navigation, read-only, UI state changes)
 * - T2: Soft-confirm (content edits, draft modifications)
 * - T3: Hard-confirm (publish, discard - critical/irreversible actions)
 *
 * @see plans/agent-first-dashboard-architecture.md (Future Considerations)
 */

// ============================================
// TYPES
// ============================================

/**
 * Capability category for grouping and filtering
 */
export type CapabilityCategory =
  | 'navigation'
  | 'editing'
  | 'publishing'
  | 'settings'
  | 'help'
  | 'discovery';

/**
 * Trust tier for the capability
 */
export type TrustTier = 'T1' | 'T2' | 'T3';

/**
 * Agent capability definition
 */
export interface AgentCapability {
  /** Unique identifier matching the tool name */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this capability does */
  description: string;
  /** Category for grouping */
  category: CapabilityCategory;
  /** Keywords for search/matching */
  keywords: string[];
  /** Optional keyboard shortcut (displayed, not functional) */
  shortcut?: string;
  /** Trust tier determines confirmation requirements */
  trustTier: TrustTier;
  /** Example phrase to trigger this capability */
  example: string;
  /** Whether this is available in the current context */
  available?: boolean;
}

// ============================================
// CAPABILITY REGISTRY
// ============================================

/**
 * All agent capabilities
 *
 * Organized by trust tier:
 * - T1: Low risk, auto-confirm
 * - T2: Medium risk, soft-confirm
 * - T3: High risk, hard-confirm with dialog
 */
export const AGENT_CAPABILITIES: AgentCapability[] = [
  // ===========================================
  // NAVIGATION (T1 - Auto-confirm)
  // ===========================================

  {
    id: 'show_preview',
    name: 'Show Preview',
    description: 'Display the storefront preview in the content area',
    category: 'navigation',
    keywords: ['preview', 'show', 'view', 'website', 'storefront', 'see', 'look'],
    shortcut: 'Cmd+P',
    trustTier: 'T1',
    example: 'Show me my website preview',
  },
  {
    id: 'hide_preview',
    name: 'Return to Dashboard',
    description: 'Close the preview and return to dashboard',
    category: 'navigation',
    keywords: ['dashboard', 'home', 'close', 'back', 'exit', 'hide'],
    trustTier: 'T1',
    example: 'Go back to the dashboard',
  },
  {
    id: 'navigate_to',
    name: 'Navigate',
    description: 'Navigate to a specific page in the dashboard',
    category: 'navigation',
    keywords: [
      'go to',
      'navigate',
      'open',
      'settings',
      'bookings',
      'services',
      'calendar',
      'analytics',
    ],
    trustTier: 'T1',
    example: 'Take me to my booking settings',
  },
  {
    id: 'get_current_view',
    name: 'Current View',
    description: 'Get information about what you are currently viewing',
    category: 'navigation',
    keywords: ['where', 'current', 'location', 'page', 'view'],
    trustTier: 'T1',
    example: 'What am I looking at?',
  },
  {
    id: 'highlight_section',
    name: 'Highlight Section',
    description: "Highlight a specific section in the preview to show what you're referring to",
    category: 'navigation',
    keywords: ['highlight', 'show', 'point', 'section', 'indicate', 'focus'],
    trustTier: 'T1',
    example: 'Highlight the hero section',
  },

  // ===========================================
  // DISCOVERY (T1 - Read-only)
  // ===========================================

  {
    id: 'list_section_ids',
    name: 'List Sections',
    description: 'See all sections on your storefront pages',
    category: 'discovery',
    keywords: ['sections', 'list', 'show', 'pages', 'content'],
    trustTier: 'T1',
    example: 'What sections do I have?',
  },
  {
    id: 'get_section_by_id',
    name: 'View Section',
    description: 'See the content of a specific section',
    category: 'discovery',
    keywords: ['section', 'content', 'view', 'see', 'show'],
    trustTier: 'T1',
    example: 'Show me the hero section content',
  },
  {
    id: 'get_unfilled_placeholders',
    name: 'Check Setup Progress',
    description: 'See what content still needs to be filled in',
    category: 'discovery',
    keywords: ['setup', 'progress', 'placeholder', 'incomplete', 'todo', 'missing'],
    trustTier: 'T1',
    example: 'What do I still need to fill out?',
  },
  {
    id: 'get_landing_page_draft',
    name: 'Draft Status',
    description: 'Check if you have unpublished changes',
    category: 'discovery',
    keywords: ['draft', 'status', 'changes', 'unpublished', 'saved'],
    trustTier: 'T1',
    example: 'Do I have any unpublished changes?',
  },

  // ===========================================
  // EDITING (T1 - Auto-execute for paintbrush effect)
  // ===========================================

  {
    id: 'update_page_section',
    name: 'Update Section',
    description: 'Modify or add content in a specific section of your storefront',
    category: 'editing',
    keywords: [
      'edit',
      'update',
      'change',
      'modify',
      'section',
      'content',
      'headline',
      'text',
      'add',
      'new',
      'create',
      'testimonials',
      'faq',
      'gallery',
    ],
    trustTier: 'T1', // Auto-execute for real-time updates (paintbrush effect)
    example: 'Update the headline on my homepage',
  },
  {
    id: 'remove_page_section',
    name: 'Remove Section',
    description: 'Remove a section from your storefront',
    category: 'editing',
    keywords: ['remove', 'delete', 'section'],
    trustTier: 'T1', // Auto-execute - reversible via discard draft
    example: 'Remove the FAQ section from my about page',
  },
  {
    id: 'reorder_page_sections',
    name: 'Reorder Sections',
    description: 'Change the order of sections on a page',
    category: 'editing',
    keywords: ['reorder', 'move', 'rearrange', 'order', 'position'],
    trustTier: 'T1', // Low risk - easily reversible
    example: 'Move the testimonials section above the CTA',
  },
  {
    id: 'toggle_page_enabled',
    name: 'Toggle Page',
    description: 'Enable or disable an entire page on your storefront',
    category: 'editing',
    keywords: ['enable', 'disable', 'hide', 'show', 'page', 'toggle'],
    trustTier: 'T1', // Low risk - easily reversible
    example: 'Disable the gallery page',
  },
  {
    id: 'update_storefront_branding',
    name: 'Update Branding',
    description: 'Update brand colors, fonts, or logo (applies immediately)',
    category: 'editing',
    keywords: ['brand', 'colors', 'fonts', 'logo', 'style', 'theme'],
    trustTier: 'T1', // Auto-execute for real-time updates
    example: 'Change my primary color to sage green',
  },
  {
    id: 'revert_branding',
    name: 'Revert Branding',
    description: 'Undo the last branding change (available for 24 hours)',
    category: 'editing',
    keywords: ['revert', 'undo', 'branding', 'restore', 'previous'],
    trustTier: 'T1', // Auto-execute - restores previous state
    example: 'Revert my branding changes',
  },

  // ===========================================
  // PUBLISHING (T3 - Hard-confirm)
  // ===========================================

  {
    id: 'publish_draft',
    name: 'Publish Changes',
    description: 'Make your draft changes live on your storefront',
    category: 'publishing',
    keywords: ['publish', 'go live', 'deploy', 'release', 'launch'],
    shortcut: 'Cmd+Shift+P',
    trustTier: 'T3', // CRITICAL: Goes to production
    example: 'Publish my changes',
  },
  {
    id: 'discard_draft',
    name: 'Discard Changes',
    description: 'Discard all unpublished changes',
    category: 'publishing',
    keywords: ['discard', 'revert', 'undo', 'cancel', 'reset'],
    trustTier: 'T3', // CRITICAL: Deletes work
    example: 'Discard all my changes',
  },

  // ===========================================
  // HELP (T1)
  // ===========================================

  {
    id: 'get_help',
    name: 'Get Help',
    description: 'Get help with using the dashboard or editing your storefront',
    category: 'help',
    keywords: ['help', 'how', 'what', 'explain', 'tutorial', 'guide'],
    trustTier: 'T1',
    example: 'How do I add a new service?',
  },
];

// ============================================
// SEARCH AND FILTER FUNCTIONS
// ============================================

/**
 * Search capabilities by keyword or phrase
 *
 * @param query Search query
 * @returns Matching capabilities sorted by relevance
 */
export function searchCapabilities(query: string): AgentCapability[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return [];

  // Score each capability
  const scored = AGENT_CAPABILITIES.map((cap) => {
    let score = 0;

    // Exact name match
    if (cap.name.toLowerCase() === lowerQuery) score += 100;
    // Name contains query
    else if (cap.name.toLowerCase().includes(lowerQuery)) score += 50;

    // Keyword exact match
    if (cap.keywords.some((kw) => kw.toLowerCase() === lowerQuery)) score += 80;
    // Keyword contains query
    else if (cap.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery))) score += 30;

    // Description contains query
    if (cap.description.toLowerCase().includes(lowerQuery)) score += 20;

    // Example contains query
    if (cap.example.toLowerCase().includes(lowerQuery)) score += 10;

    return { capability: cap, score };
  });

  // Filter and sort by score
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.capability);
}

/**
 * Get capabilities by category
 *
 * @param category Category to filter by
 * @returns Capabilities in the category
 */
export function getCapabilitiesByCategory(category: CapabilityCategory): AgentCapability[] {
  return AGENT_CAPABILITIES.filter((cap) => cap.category === category);
}

/**
 * Get capabilities by trust tier
 *
 * @param tier Trust tier to filter by
 * @returns Capabilities with the trust tier
 */
export function getCapabilitiesByTier(tier: TrustTier): AgentCapability[] {
  return AGENT_CAPABILITIES.filter((cap) => cap.trustTier === tier);
}

/**
 * Get a capability by ID
 *
 * @param id Capability ID (matches tool name)
 * @returns Capability or undefined if not found
 */
export function getCapability(id: string): AgentCapability | undefined {
  return AGENT_CAPABILITIES.find((cap) => cap.id === id);
}

/**
 * Get all capability categories
 *
 * @returns Array of unique categories
 */
export function getCategories(): CapabilityCategory[] {
  const categories = new Set(AGENT_CAPABILITIES.map((cap) => cap.category));
  return Array.from(categories);
}

/**
 * Get capabilities grouped by category
 *
 * @returns Map of category to capabilities
 */
export function getCapabilitiesGrouped(): Map<CapabilityCategory, AgentCapability[]> {
  const grouped = new Map<CapabilityCategory, AgentCapability[]>();

  for (const cap of AGENT_CAPABILITIES) {
    const existing = grouped.get(cap.category) || [];
    existing.push(cap);
    grouped.set(cap.category, existing);
  }

  return grouped;
}

// ============================================
// CONSTANTS FOR UI
// ============================================

/**
 * Category display names for UI
 */
export const CATEGORY_DISPLAY_NAMES: Record<CapabilityCategory, string> = {
  navigation: 'Navigation',
  editing: 'Editing',
  publishing: 'Publishing',
  settings: 'Settings',
  help: 'Help',
  discovery: 'Discovery',
};

/**
 * Category icons (lucide-react icon names)
 */
export const CATEGORY_ICONS: Record<CapabilityCategory, string> = {
  navigation: 'Navigation',
  editing: 'Edit',
  publishing: 'Upload',
  settings: 'Settings',
  help: 'HelpCircle',
  discovery: 'Search',
};

/**
 * Trust tier descriptions for user understanding
 */
export const TRUST_TIER_DESCRIPTIONS: Record<TrustTier, string> = {
  T1: 'Auto-confirmed (instant)',
  T2: 'Soft-confirmed (review changes)',
  T3: 'Requires approval (critical action)',
};

/**
 * Trust tier colors for UI
 */
export const TRUST_TIER_COLORS: Record<TrustTier, string> = {
  T1: 'text-green-600',
  T2: 'text-amber-600',
  T3: 'text-red-600',
};

// ============================================
// COMPILE-TIME & RUNTIME VALIDATION
// ============================================

/**
 * Verify no duplicate capability IDs exist
 * Throws at module load time if duplicates are found
 *
 * This check runs once when the module is imported, catching
 * duplicate IDs during development and CI rather than production.
 */
const capabilityIds = AGENT_CAPABILITIES.map((cap) => cap.id);
const uniqueIds = new Set(capabilityIds);
if (uniqueIds.size !== capabilityIds.length) {
  const duplicates = capabilityIds.filter((id, index) => capabilityIds.indexOf(id) !== index);
  throw new Error(
    `Duplicate capability IDs detected in agent-capabilities.ts: ${[...new Set(duplicates)].join(', ')}. ` +
      'Each capability must have a unique ID.'
  );
}
