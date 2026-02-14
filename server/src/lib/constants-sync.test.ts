/**
 * Constants & Utilities Sync Test
 *
 * Verifies that synced files between the monorepo (canonical) and
 * Cloud Run agents (local copies) remain in sync.
 *
 * Cloud Run agents cannot import from @macon/contracts or server/src/shared/
 * due to the rootDir constraint, so they maintain local copies. These tests
 * catch drift when someone edits one source but forgets the other.
 *
 * UTILITIES SYNC:
 * The canonical agent-utils.ts is at server/src/agent-v2/shared/agent-utils.ts.
 * It is copied to each agent's src/utils.ts by the prebuild script.
 * This test verifies file-level identity (byte-for-byte match).
 *
 * @see CLAUDE.md Pitfall #18 (Cloud Run constants sync)
 * @see server/src/agent-v2/shared/agent-utils.ts (canonical utils)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

// ============================================================================
// Agent Utils (utils.ts) — file-level sync
// ============================================================================

describe('agent-utils.ts sync', () => {
  const canonicalPath = resolve(__dirname, '../agent-v2/shared/agent-utils.ts');
  const canonicalContent = readFileSync(canonicalPath, 'utf-8');

  it('tenant agent utils.ts matches canonical agent-utils.ts', () => {
    const agentPath = resolve(__dirname, '../agent-v2/deploy/tenant/src/utils.ts');
    const agentContent = readFileSync(agentPath, 'utf-8');

    expect(agentContent).toBe(canonicalContent);
  });

  it('customer agent utils.ts matches canonical agent-utils.ts', () => {
    const agentPath = resolve(__dirname, '../agent-v2/deploy/customer/src/utils.ts');
    const agentContent = readFileSync(agentPath, 'utf-8');

    expect(agentContent).toBe(canonicalContent);
  });
});
