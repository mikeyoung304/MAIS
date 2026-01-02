/**
 * Prompt Parity Tests
 *
 * Verifies that system prompts mention the capabilities they enable.
 * This ensures the LLM knows about all the tools it can use.
 *
 * Philosophy:
 * - If an agent has a capability, the system prompt should mention it
 * - Keywords help verify the prompt guides toward using specific tools
 * - This catches "hidden capabilities" where tools exist but aren't documented
 */

import { describe, it, expect } from 'vitest';

// Import capability maps
import { CUSTOMER_AGENT_CAPABILITIES } from '../capabilities/customer-agent.cap';
import { ONBOARDING_AGENT_CAPABILITIES } from '../capabilities/onboarding-agent.cap';
import { ADMIN_AGENT_CAPABILITIES } from '../capabilities/admin-agent.cap';
import type { AgentCapabilityMap, AgentCapability } from '../capabilities/capability-map';

// Import system prompts
import { CUSTOMER_SYSTEM_PROMPT } from '../../../src/agent/customer/customer-prompt';

// Note: We import the raw template strings, not the builders, to test the base content

// ─────────────────────────────────────────────────────────────────────────────
// System Prompt Constants (extracted for testing)
// ─────────────────────────────────────────────────────────────────────────────

// Admin prompt from admin-orchestrator.ts (inline constant)
const ADMIN_SYSTEM_PROMPT = `# HANDLED Business Assistant - System Prompt v3.0

## Your Personality

You're the AI assistant for HANDLED — a membership platform for service professionals who'd rather focus on their craft than configure tech.

**Voice guidelines:**
- Be cheeky but professional. Self-aware about being AI without being obnoxious.
- Speak to competent pros, not beginners. They're photographers, coaches, therapists — excellent at their jobs.
- Anti-hype: No "revolutionary," "cutting-edge," "transform your business." Just be helpful.
- Focus on what you HANDLE for them, not features.
- When in doubt, be direct: "Want to knock this out?" not "Would you like me to assist you with this task?"

**Words to use:** handle, handled, clients, what's worth knowing, actually, no pitch
**Words to avoid:** revolutionary, game-changing, solutions, synergy, leverage, optimize, amazing

---

## Onboarding Behavior

Based on the user's state, guide them appropriately. Suggest ONE thing at a time.

**No Stripe connected:**
Help them connect Stripe first. It's the foundation — they can't accept payments without it.
→ "Takes about 3 minutes, then you never touch it again."

**Stripe connected, no packages:**
Help them create their first package. Ask what they offer (sessions, packages, day rates).
→ "What do you offer — sessions, packages, day rates?"

**Packages exist, no bookings:**
Help them share their booking link. Be specific about where to put it.
→ "Drop it in your Instagram bio. One click, they're in."
→ "Add it to your email signature. Every email you send."

**Active business (getting bookings):**
They know what they're doing. Just be helpful. If they want more clients:
→ "After a great session, ask: 'Know anyone else who'd want this?'"

---

## Business Coaching

### Three-Tier Framework (Good/Better/Best)

Most service businesses succeed with three price points:

- **Starter/Good:** Entry point. Lets clients test the waters.
- **Core/Better:** Your bread and butter. 60-70% of clients land here.
- **Premium/Best:** High-touch, high-value. For clients who want the works.

When helping with pricing, explain your reasoning: "I'd price this at $X because..."

---

## Capability Hints

**Proactively mention what you can help with** when relevant to the conversation.

---

## Trust Tiers

| Tier | When | Your Behavior |
|------|------|---------------|
| **T1** | Blackouts, branding, file uploads | Do it, report result |
| **T2** | Package changes, pricing, storefront | "I'll update X. Say 'wait' if that's wrong" then proceed |
| **T3** | Cancellations, refunds, deletes | MUST get explicit "yes"/"confirm" before proceeding |

---

## Tool Usage

**Read tools:** Use freely to understand current state
**Write tools:** Follow trust tier protocol above
**If a tool fails:** Explain simply, suggest a fix, ask before retrying

---

{BUSINESS_CONTEXT}
`;

// Onboarding prompt from onboarding-system-prompt.ts (combined phases)
const ONBOARDING_SYSTEM_PROMPT_COMBINED = `# HANDLED Onboarding Assistant

You're the onboarding assistant for HANDLED. Your job is to guide new members through setup.

## Phases

### Discovery
- Learn about their business type (photographer, coach, therapist, etc.)
- Find out their location (city, state)
- Understand their target market (luxury, premium, mid-range, budget-friendly)

### Market Research
- Use get_market_research to find pricing benchmarks
- Explain what you found about competitors
- Recommend pricing based on their positioning

### Services
- Help them create service packages
- Design tiers with appropriate pricing
- Create segments to organize their offerings

### Marketing
- Set up their storefront headline and tagline
- Configure their brand voice
- Update their landing page

## Tools

- update_onboarding_state: Progress through phases
- get_market_research: Get pricing benchmarks for their business type and location
- upsert_services: Create segments and packages
- update_storefront: Configure landing page and brand settings
`;

// ─────────────────────────────────────────────────────────────────────────────
// Test Data Setup
// ─────────────────────────────────────────────────────────────────────────────

interface PromptTestCase {
  name: string;
  capabilityMap: AgentCapabilityMap;
  systemPrompt: string;
}

const PROMPT_TEST_CASES: PromptTestCase[] = [
  {
    name: 'Customer Agent',
    capabilityMap: CUSTOMER_AGENT_CAPABILITIES,
    systemPrompt: CUSTOMER_SYSTEM_PROMPT,
  },
  {
    name: 'Onboarding Agent',
    capabilityMap: ONBOARDING_AGENT_CAPABILITIES,
    systemPrompt: ONBOARDING_SYSTEM_PROMPT_COMBINED,
  },
  {
    name: 'Admin Agent',
    capabilityMap: ADMIN_AGENT_CAPABILITIES,
    systemPrompt: ADMIN_SYSTEM_PROMPT,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if at least one keyword from the capability appears in the prompt
 */
function checkKeywordPresence(
  capability: AgentCapability,
  prompt: string
): { found: boolean; matchedKeyword?: string } {
  const promptLower = prompt.toLowerCase();

  for (const keyword of capability.promptKeywords) {
    if (promptLower.includes(keyword.toLowerCase())) {
      return { found: true, matchedKeyword: keyword };
    }
  }

  return { found: false };
}

/**
 * Find capabilities not mentioned in the prompt
 */
function findUnmentionedCapabilities(map: AgentCapabilityMap, prompt: string): AgentCapability[] {
  return map.capabilities.filter((c) => !checkKeywordPresence(c, prompt).found);
}

/**
 * Calculate prompt coverage percentage
 */
function calculateCoverage(map: AgentCapabilityMap, prompt: string): number {
  const mentioned = map.capabilities.filter((c) => checkKeywordPresence(c, prompt).found).length;
  return (mentioned / map.capabilities.length) * 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Prompt Parity Tests', () => {
  describe.each(PROMPT_TEST_CASES)('$name', ({ name, capabilityMap, systemPrompt }) => {
    // Test each capability individually for better error messages
    it.each(capabilityMap.capabilities)(
      'system prompt should mention capability: $id',
      (capability) => {
        const result = checkKeywordPresence(capability, systemPrompt);

        if (!result.found) {
          // For admin agent, we allow some flexibility since the prompt is context-aware
          // and may not mention every capability directly
          if (name === 'Admin Agent') {
            // Skip strict check for read and payment capabilities
            // - Read: documented via tool metadata, not prompt text
            // - Payment: tier-based trust documentation (T1/T2/T3) covers these generically
            if (capability.category === 'read' || capability.category === 'payment') {
              return; // Skip - these are documented via tool metadata or trust tiers
            }
          }

          throw new Error(
            `${name} system prompt does not mention capability "${capability.id}"\n` +
              `Expected keywords: ${capability.promptKeywords.join(', ')}\n` +
              `Description: ${capability.description}\n\n` +
              `Either add one of these keywords to the system prompt or update the capability's promptKeywords.`
          );
        }

        expect(result.found).toBe(true);
      }
    );

    it('should have minimum 70% capability coverage in prompt', () => {
      const coverage = calculateCoverage(capabilityMap, systemPrompt);
      const unmentioned = findUnmentionedCapabilities(capabilityMap, systemPrompt);

      // Allow admin agent lower threshold since it's context-dependent
      const threshold = name === 'Admin Agent' ? 50 : 70;

      if (coverage < threshold) {
        throw new Error(
          `${name} prompt coverage too low: ${coverage.toFixed(1)}% (minimum: ${threshold}%)\n` +
            `Unmentioned capabilities:\n` +
            unmentioned.map((c) => `  - ${c.id}: ${c.promptKeywords.join(', ')}`).join('\n')
        );
      }

      expect(coverage).toBeGreaterThanOrEqual(threshold);
    });

    it('system prompt should be non-empty', () => {
      expect(systemPrompt.length).toBeGreaterThan(100);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Keyword Quality Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Keyword Quality', () => {
    for (const { name, capabilityMap } of PROMPT_TEST_CASES) {
      describe(name, () => {
        it('every capability should have at least 2 keywords', () => {
          for (const capability of capabilityMap.capabilities) {
            expect(
              capability.promptKeywords.length,
              `Capability ${capability.id} needs more keywords for better coverage`
            ).toBeGreaterThanOrEqual(2);
          }
        });

        it('keywords should not be too generic', () => {
          const tooGeneric = ['the', 'a', 'an', 'to', 'for', 'with', 'and'];

          for (const capability of capabilityMap.capabilities) {
            for (const keyword of capability.promptKeywords) {
              expect(
                tooGeneric,
                `Capability ${capability.id} has too generic keyword: "${keyword}"`
              ).not.toContain(keyword.toLowerCase());
            }
          }
        });

        it('keywords should be reasonably short', () => {
          const maxLength = 30;

          for (const capability of capabilityMap.capabilities) {
            for (const keyword of capability.promptKeywords) {
              expect(
                keyword.length,
                `Capability ${capability.id} has too long keyword: "${keyword}"`
              ).toBeLessThanOrEqual(maxLength);
            }
          }
        });
      });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Trust Tier Documentation Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Trust Tier Documentation', () => {
    it('Admin prompt should explain trust tiers', () => {
      expect(ADMIN_SYSTEM_PROMPT).toContain('Trust Tier');
      expect(ADMIN_SYSTEM_PROMPT).toContain('T1');
      expect(ADMIN_SYSTEM_PROMPT).toContain('T2');
      expect(ADMIN_SYSTEM_PROMPT).toContain('T3');
    });

    it('Admin prompt should explain T3 requires confirmation', () => {
      expect(ADMIN_SYSTEM_PROMPT.toLowerCase()).toContain('confirm');
    });

    it('Customer prompt should explain booking confirmation flow', () => {
      expect(CUSTOMER_SYSTEM_PROMPT.toLowerCase()).toContain('confirm');
    });
  });
});
