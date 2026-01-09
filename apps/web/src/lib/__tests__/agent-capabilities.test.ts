import { describe, it, expect } from 'vitest';
import {
  searchCapabilities,
  getCapabilitiesByCategory,
  getCapabilitiesByTier,
  getCapability,
  getCategories,
  getCapabilitiesGrouped,
  AGENT_CAPABILITIES,
  CATEGORY_DISPLAY_NAMES,
  CATEGORY_ICONS,
  TRUST_TIER_DESCRIPTIONS,
  TRUST_TIER_COLORS,
  type CapabilityCategory,
  type TrustTier,
} from '../agent-capabilities';

describe('agent-capabilities', () => {
  // ============================================
  // searchCapabilities
  // ============================================

  describe('searchCapabilities', () => {
    it('should return empty array for empty query', () => {
      expect(searchCapabilities('')).toEqual([]);
    });

    it('should return empty array for whitespace-only query', () => {
      expect(searchCapabilities('   ')).toEqual([]);
    });

    it('should find capabilities by exact name match (highest score)', () => {
      const results = searchCapabilities('Show Preview');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('show_preview');
    });

    it('should find capabilities by partial name match', () => {
      const results = searchCapabilities('Preview');
      expect(results.some((r) => r.id === 'show_preview')).toBe(true);
    });

    it('should find capabilities by exact keyword match', () => {
      const results = searchCapabilities('preview');
      expect(results.some((r) => r.id === 'show_preview')).toBe(true);
    });

    it('should find capabilities by partial keyword match', () => {
      const results = searchCapabilities('previ');
      expect(results.some((r) => r.id === 'show_preview')).toBe(true);
    });

    it('should find capabilities by description match', () => {
      const results = searchCapabilities('storefront preview');
      expect(results.some((r) => r.id === 'show_preview')).toBe(true);
    });

    it('should find capabilities by example match', () => {
      const results = searchCapabilities('website preview');
      expect(results.some((r) => r.id === 'show_preview')).toBe(true);
    });

    it('should be case insensitive', () => {
      const resultsLower = searchCapabilities('preview');
      const resultsUpper = searchCapabilities('PREVIEW');
      const resultsMixed = searchCapabilities('PrEvIeW');

      expect(resultsLower.length).toBe(resultsUpper.length);
      expect(resultsLower.length).toBe(resultsMixed.length);
      expect(resultsLower.map((r) => r.id)).toEqual(resultsUpper.map((r) => r.id));
    });

    it('should return results sorted by relevance score', () => {
      // 'Show Preview' exact name match should rank higher than 'Draft Status' which contains 'show' in keywords
      const results = searchCapabilities('show');
      const showPreviewIndex = results.findIndex((r) => r.id === 'show_preview');
      expect(showPreviewIndex).toBeLessThan(results.length / 2); // Should be in top half
    });

    it('should return multiple results when multiple match', () => {
      const results = searchCapabilities('section');
      expect(results.length).toBeGreaterThan(1);
      // Should match list_section_ids, get_section_by_id, update_page_section, add_section, remove_page_section, reorder_page_sections
      const sectionCapIds = results.map((r) => r.id);
      expect(sectionCapIds).toContain('list_section_ids');
      expect(sectionCapIds).toContain('get_section_by_id');
      expect(sectionCapIds).toContain('update_page_section');
    });

    it('should prioritize exact name match over keyword match', () => {
      const results = searchCapabilities('Navigate');
      // 'Navigate' as name should rank higher than capabilities with 'navigate' in keywords
      expect(results[0].id).toBe('navigate_to');
    });

    it('should prioritize keyword exact match over description match', () => {
      const results = searchCapabilities('publish');
      // 'publish_draft' has 'publish' as keyword
      expect(results[0].id).toBe('publish_draft');
    });

    it('should return empty array for query with no matches', () => {
      const results = searchCapabilities('xyznonexistent123');
      expect(results).toEqual([]);
    });
  });

  // ============================================
  // getCapabilitiesByCategory
  // ============================================

  describe('getCapabilitiesByCategory', () => {
    it('should return all navigation capabilities', () => {
      const results = getCapabilitiesByCategory('navigation');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((cap) => cap.category === 'navigation')).toBe(true);
    });

    it('should return all editing capabilities', () => {
      const results = getCapabilitiesByCategory('editing');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((cap) => cap.category === 'editing')).toBe(true);
    });

    it('should return all publishing capabilities', () => {
      const results = getCapabilitiesByCategory('publishing');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((cap) => cap.category === 'publishing')).toBe(true);
    });

    it('should return all settings capabilities', () => {
      const results = getCapabilitiesByCategory('settings');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((cap) => cap.category === 'settings')).toBe(true);
    });

    it('should return all help capabilities', () => {
      const results = getCapabilitiesByCategory('help');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((cap) => cap.category === 'help')).toBe(true);
    });

    it('should return all discovery capabilities', () => {
      const results = getCapabilitiesByCategory('discovery');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((cap) => cap.category === 'discovery')).toBe(true);
    });

    it('should return empty array for non-existent category', () => {
      // TypeScript would prevent this, but testing runtime behavior
      const results = getCapabilitiesByCategory('nonexistent' as CapabilityCategory);
      expect(results).toEqual([]);
    });

    it('should include specific known capabilities in correct categories', () => {
      const navigation = getCapabilitiesByCategory('navigation');
      expect(navigation.some((c) => c.id === 'show_preview')).toBe(true);
      expect(navigation.some((c) => c.id === 'navigate_to')).toBe(true);

      const editing = getCapabilitiesByCategory('editing');
      expect(editing.some((c) => c.id === 'update_page_section')).toBe(true);
      expect(editing.some((c) => c.id === 'add_section')).toBe(true);

      const publishing = getCapabilitiesByCategory('publishing');
      expect(publishing.some((c) => c.id === 'publish_draft')).toBe(true);
      expect(publishing.some((c) => c.id === 'discard_draft')).toBe(true);

      const discovery = getCapabilitiesByCategory('discovery');
      expect(discovery.some((c) => c.id === 'list_section_ids')).toBe(true);
    });
  });

  // ============================================
  // getCapabilitiesByTier
  // ============================================

  describe('getCapabilitiesByTier', () => {
    it('should return T1 capabilities (auto-confirm)', () => {
      const results = getCapabilitiesByTier('T1');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((cap) => cap.trustTier === 'T1')).toBe(true);
    });

    it('should return T2 capabilities (soft-confirm)', () => {
      const results = getCapabilitiesByTier('T2');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((cap) => cap.trustTier === 'T2')).toBe(true);
    });

    it('should return T3 capabilities (hard-confirm)', () => {
      const results = getCapabilitiesByTier('T3');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((cap) => cap.trustTier === 'T3')).toBe(true);
    });

    it('should return empty array for invalid tier', () => {
      const results = getCapabilitiesByTier('T4' as TrustTier);
      expect(results).toEqual([]);
    });

    it('should include known T1 capabilities', () => {
      const t1 = getCapabilitiesByTier('T1');
      expect(t1.some((c) => c.id === 'show_preview')).toBe(true);
      expect(t1.some((c) => c.id === 'navigate_to')).toBe(true);
      expect(t1.some((c) => c.id === 'get_help')).toBe(true);
    });

    it('should include known T2 capabilities', () => {
      const t2 = getCapabilitiesByTier('T2');
      expect(t2.some((c) => c.id === 'update_page_section')).toBe(true);
      expect(t2.some((c) => c.id === 'add_section')).toBe(true);
      expect(t2.some((c) => c.id === 'update_business_info')).toBe(true);
    });

    it('should include known T3 capabilities', () => {
      const t3 = getCapabilitiesByTier('T3');
      expect(t3.some((c) => c.id === 'publish_draft')).toBe(true);
      expect(t3.some((c) => c.id === 'discard_draft')).toBe(true);
    });

    it('should verify T3 capabilities are critical actions', () => {
      const t3 = getCapabilitiesByTier('T3');
      // T3 should only be critical/irreversible actions
      for (const cap of t3) {
        expect(['publish_draft', 'discard_draft']).toContain(cap.id);
      }
    });
  });

  // ============================================
  // getCapability
  // ============================================

  describe('getCapability', () => {
    it('should return capability by ID', () => {
      const cap = getCapability('show_preview');
      expect(cap).toBeDefined();
      expect(cap?.id).toBe('show_preview');
      expect(cap?.name).toBe('Show Preview');
    });

    it('should return undefined for non-existent ID', () => {
      const cap = getCapability('nonexistent_id');
      expect(cap).toBeUndefined();
    });

    it('should return capability with all required fields', () => {
      const cap = getCapability('publish_draft');
      expect(cap).toBeDefined();
      expect(cap?.id).toBe('publish_draft');
      expect(cap?.name).toBe('Publish Changes');
      expect(cap?.description).toBeDefined();
      expect(cap?.category).toBe('publishing');
      expect(cap?.keywords).toBeInstanceOf(Array);
      expect(cap?.trustTier).toBe('T3');
      expect(cap?.example).toBeDefined();
    });

    it('should handle case-sensitive ID lookup', () => {
      // IDs are case-sensitive
      const cap = getCapability('Show_Preview');
      expect(cap).toBeUndefined();
    });
  });

  // ============================================
  // getCategories
  // ============================================

  describe('getCategories', () => {
    it('should return all unique categories', () => {
      const categories = getCategories();
      expect(categories.length).toBeGreaterThan(0);

      // Should include all known categories
      expect(categories).toContain('navigation');
      expect(categories).toContain('editing');
      expect(categories).toContain('publishing');
      expect(categories).toContain('settings');
      expect(categories).toContain('help');
      expect(categories).toContain('discovery');
    });

    it('should have no duplicate categories', () => {
      const categories = getCategories();
      const uniqueCategories = new Set(categories);
      expect(categories.length).toBe(uniqueCategories.size);
    });

    it('should return exactly 6 categories', () => {
      const categories = getCategories();
      expect(categories.length).toBe(6);
    });
  });

  // ============================================
  // getCapabilitiesGrouped
  // ============================================

  describe('getCapabilitiesGrouped', () => {
    it('should return Map with categories as keys', () => {
      const grouped = getCapabilitiesGrouped();
      expect(grouped).toBeInstanceOf(Map);

      // Should have entries for each category with capabilities
      expect(grouped.has('navigation')).toBe(true);
      expect(grouped.has('editing')).toBe(true);
      expect(grouped.has('publishing')).toBe(true);
      expect(grouped.has('settings')).toBe(true);
      expect(grouped.has('help')).toBe(true);
      expect(grouped.has('discovery')).toBe(true);
    });

    it('should have arrays of capabilities for each category', () => {
      const grouped = getCapabilitiesGrouped();

      for (const capabilities of grouped.values()) {
        expect(Array.isArray(capabilities)).toBe(true);
        expect(capabilities.length).toBeGreaterThan(0);
      }
    });

    it('should include all capabilities', () => {
      const grouped = getCapabilitiesGrouped();
      let totalCount = 0;

      for (const capabilities of grouped.values()) {
        totalCount += capabilities.length;
      }

      expect(totalCount).toBe(AGENT_CAPABILITIES.length);
    });

    it('should correctly group capabilities by category', () => {
      const grouped = getCapabilitiesGrouped();

      for (const [category, capabilities] of grouped) {
        for (const cap of capabilities) {
          expect(cap.category).toBe(category);
        }
      }
    });

    it('should match getCapabilitiesByCategory results', () => {
      const grouped = getCapabilitiesGrouped();
      const categories: CapabilityCategory[] = [
        'navigation',
        'editing',
        'publishing',
        'settings',
        'help',
        'discovery',
      ];

      for (const category of categories) {
        const fromGrouped = grouped.get(category) || [];
        const fromFilter = getCapabilitiesByCategory(category);

        expect(fromGrouped.length).toBe(fromFilter.length);
        expect(fromGrouped.map((c) => c.id).sort()).toEqual(fromFilter.map((c) => c.id).sort());
      }
    });
  });

  // ============================================
  // AGENT_CAPABILITIES constant
  // ============================================

  describe('AGENT_CAPABILITIES constant', () => {
    it('should have all required fields for each capability', () => {
      for (const cap of AGENT_CAPABILITIES) {
        expect(cap.id).toBeDefined();
        expect(typeof cap.id).toBe('string');
        expect(cap.id.length).toBeGreaterThan(0);

        expect(cap.name).toBeDefined();
        expect(typeof cap.name).toBe('string');
        expect(cap.name.length).toBeGreaterThan(0);

        expect(cap.description).toBeDefined();
        expect(typeof cap.description).toBe('string');
        expect(cap.description.length).toBeGreaterThan(0);

        expect(cap.category).toBeDefined();
        expect(['navigation', 'editing', 'publishing', 'settings', 'help', 'discovery']).toContain(
          cap.category
        );

        expect(cap.keywords).toBeDefined();
        expect(Array.isArray(cap.keywords)).toBe(true);
        expect(cap.keywords.length).toBeGreaterThan(0);

        expect(cap.trustTier).toBeDefined();
        expect(['T1', 'T2', 'T3']).toContain(cap.trustTier);

        expect(cap.example).toBeDefined();
        expect(typeof cap.example).toBe('string');
        expect(cap.example.length).toBeGreaterThan(0);
      }
    });

    it('should have no duplicate IDs', () => {
      const ids = AGENT_CAPABILITIES.map((cap) => cap.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should have valid trust tiers', () => {
      const validTiers = ['T1', 'T2', 'T3'];
      for (const cap of AGENT_CAPABILITIES) {
        expect(validTiers).toContain(cap.trustTier);
      }
    });

    it('should have valid categories', () => {
      const validCategories = [
        'navigation',
        'editing',
        'publishing',
        'settings',
        'help',
        'discovery',
      ];
      for (const cap of AGENT_CAPABILITIES) {
        expect(validCategories).toContain(cap.category);
      }
    });

    it('should have non-empty keywords arrays', () => {
      for (const cap of AGENT_CAPABILITIES) {
        expect(cap.keywords.length).toBeGreaterThan(0);
        for (const kw of cap.keywords) {
          expect(typeof kw).toBe('string');
          expect(kw.length).toBeGreaterThan(0);
        }
      }
    });

    it('should have meaningful examples', () => {
      for (const cap of AGENT_CAPABILITIES) {
        // Example should be at least 5 characters (realistic user prompt)
        expect(cap.example.length).toBeGreaterThanOrEqual(5);
      }
    });

    it('should have snake_case IDs', () => {
      const snakeCaseRegex = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
      for (const cap of AGENT_CAPABILITIES) {
        expect(snakeCaseRegex.test(cap.id)).toBe(true);
      }
    });
  });

  // ============================================
  // Constants - CATEGORY_DISPLAY_NAMES
  // ============================================

  describe('CATEGORY_DISPLAY_NAMES', () => {
    it('should have entry for each category', () => {
      const categories: CapabilityCategory[] = [
        'navigation',
        'editing',
        'publishing',
        'settings',
        'help',
        'discovery',
      ];

      for (const category of categories) {
        expect(CATEGORY_DISPLAY_NAMES[category]).toBeDefined();
        expect(typeof CATEGORY_DISPLAY_NAMES[category]).toBe('string');
        expect(CATEGORY_DISPLAY_NAMES[category].length).toBeGreaterThan(0);
      }
    });

    it('should have human-readable display names', () => {
      expect(CATEGORY_DISPLAY_NAMES.navigation).toBe('Navigation');
      expect(CATEGORY_DISPLAY_NAMES.editing).toBe('Editing');
      expect(CATEGORY_DISPLAY_NAMES.publishing).toBe('Publishing');
      expect(CATEGORY_DISPLAY_NAMES.settings).toBe('Settings');
      expect(CATEGORY_DISPLAY_NAMES.help).toBe('Help');
      expect(CATEGORY_DISPLAY_NAMES.discovery).toBe('Discovery');
    });
  });

  // ============================================
  // Constants - CATEGORY_ICONS
  // ============================================

  describe('CATEGORY_ICONS', () => {
    it('should have entry for each category', () => {
      const categories: CapabilityCategory[] = [
        'navigation',
        'editing',
        'publishing',
        'settings',
        'help',
        'discovery',
      ];

      for (const category of categories) {
        expect(CATEGORY_ICONS[category]).toBeDefined();
        expect(typeof CATEGORY_ICONS[category]).toBe('string');
        expect(CATEGORY_ICONS[category].length).toBeGreaterThan(0);
      }
    });

    it('should have valid lucide icon names', () => {
      expect(CATEGORY_ICONS.navigation).toBe('Navigation');
      expect(CATEGORY_ICONS.editing).toBe('Edit');
      expect(CATEGORY_ICONS.publishing).toBe('Upload');
      expect(CATEGORY_ICONS.settings).toBe('Settings');
      expect(CATEGORY_ICONS.help).toBe('HelpCircle');
      expect(CATEGORY_ICONS.discovery).toBe('Search');
    });
  });

  // ============================================
  // Constants - TRUST_TIER_DESCRIPTIONS
  // ============================================

  describe('TRUST_TIER_DESCRIPTIONS', () => {
    it('should have entry for each tier', () => {
      const tiers: TrustTier[] = ['T1', 'T2', 'T3'];

      for (const tier of tiers) {
        expect(TRUST_TIER_DESCRIPTIONS[tier]).toBeDefined();
        expect(typeof TRUST_TIER_DESCRIPTIONS[tier]).toBe('string');
        expect(TRUST_TIER_DESCRIPTIONS[tier].length).toBeGreaterThan(0);
      }
    });

    it('should have descriptive tier descriptions', () => {
      expect(TRUST_TIER_DESCRIPTIONS.T1).toContain('Auto');
      expect(TRUST_TIER_DESCRIPTIONS.T2).toContain('Soft');
      expect(TRUST_TIER_DESCRIPTIONS.T3).toContain('approval');
    });
  });

  // ============================================
  // Constants - TRUST_TIER_COLORS
  // ============================================

  describe('TRUST_TIER_COLORS', () => {
    it('should have entry for each tier', () => {
      const tiers: TrustTier[] = ['T1', 'T2', 'T3'];

      for (const tier of tiers) {
        expect(TRUST_TIER_COLORS[tier]).toBeDefined();
        expect(typeof TRUST_TIER_COLORS[tier]).toBe('string');
        expect(TRUST_TIER_COLORS[tier].length).toBeGreaterThan(0);
      }
    });

    it('should have valid Tailwind color classes', () => {
      expect(TRUST_TIER_COLORS.T1).toMatch(/^text-\w+-\d+$/);
      expect(TRUST_TIER_COLORS.T2).toMatch(/^text-\w+-\d+$/);
      expect(TRUST_TIER_COLORS.T3).toMatch(/^text-\w+-\d+$/);
    });

    it('should use semantic colors (green=safe, amber=caution, red=critical)', () => {
      expect(TRUST_TIER_COLORS.T1).toContain('green');
      expect(TRUST_TIER_COLORS.T2).toContain('amber');
      expect(TRUST_TIER_COLORS.T3).toContain('red');
    });
  });

  // ============================================
  // Integration / Edge Cases
  // ============================================

  describe('edge cases and integration', () => {
    it('should handle search with special characters gracefully', () => {
      const results = searchCapabilities('show <preview>');
      // Should still work, even if special chars are included
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle search with numbers', () => {
      const results = searchCapabilities('123');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should maintain consistency between functions', () => {
      // getCapability should return same data as found in AGENT_CAPABILITIES
      for (const cap of AGENT_CAPABILITIES) {
        const found = getCapability(cap.id);
        expect(found).toEqual(cap);
      }
    });

    it('should have categories that match between grouped and filter functions', () => {
      const grouped = getCapabilitiesGrouped();
      const categories = getCategories();

      for (const category of categories) {
        const fromGrouped = grouped.get(category);
        expect(fromGrouped).toBeDefined();
        expect(fromGrouped?.length).toBeGreaterThan(0);
      }
    });

    it('should verify all capabilities have at least one searchable term', () => {
      for (const cap of AGENT_CAPABILITIES) {
        // Each capability should be findable by name
        const results = searchCapabilities(cap.name);
        expect(results.some((r) => r.id === cap.id)).toBe(true);
      }
    });

    it('should verify all capabilities are reachable by ID', () => {
      for (const cap of AGENT_CAPABILITIES) {
        const found = getCapability(cap.id);
        expect(found).toBeDefined();
        expect(found?.id).toBe(cap.id);
      }
    });
  });
});
