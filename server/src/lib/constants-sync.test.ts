/**
 * Constants Sync Test
 *
 * Verifies that manually-synced constants between the monorepo (canonical)
 * and Cloud Run agents (local copies) remain in sync.
 *
 * Cloud Run agents cannot import from @macon/contracts or server/src/shared/
 * due to the rootDir constraint, so they maintain local copies. These tests
 * catch drift when someone edits one source but forgets the other.
 *
 * @see CLAUDE.md Pitfall #18 (Cloud Run constants sync)
 */

import { describe, it, expect } from 'vitest';

// Canonical sources (monorepo)
import { MVP_REVEAL_SECTION_TYPES } from '@macon/contracts';
import { DISCOVERY_FACT_KEYS as CANONICAL_DISCOVERY_FACT_KEYS } from '../shared/constants/discovery-facts';

// Local copies (Cloud Run tenant agent)
import { MVP_SECTION_TYPES as AGENT_MVP_SECTION_TYPES } from '../agent-v2/deploy/tenant/src/constants/shared';
import { DISCOVERY_FACT_KEYS as AGENT_DISCOVERY_FACT_KEYS } from '../agent-v2/deploy/tenant/src/constants/discovery-facts';

// ============================================================================
// MVP_SECTION_TYPES
// ============================================================================

describe('MVP_SECTION_TYPES sync', () => {
  it('agent copy matches canonical contracts source', () => {
    // Canonical: Set from contracts (e.g. Set {'HERO', 'ABOUT', 'SERVICES'})
    const canonical = [...MVP_REVEAL_SECTION_TYPES].sort();
    // Agent: Set from local copy
    const agent = [...AGENT_MVP_SECTION_TYPES].sort();

    expect(agent).toEqual(canonical);
  });
});

// ============================================================================
// DISCOVERY_FACT_KEYS
// ============================================================================

describe('DISCOVERY_FACT_KEYS sync', () => {
  it('agent copy matches canonical shared constants source', () => {
    const canonical = [...CANONICAL_DISCOVERY_FACT_KEYS].sort();
    const agent = [...AGENT_DISCOVERY_FACT_KEYS].sort();

    expect(agent).toEqual(canonical);
  });
});
