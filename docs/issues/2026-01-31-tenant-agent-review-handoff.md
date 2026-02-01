# Tenant Agent Review Handoff - January 31, 2026

## Quick Start

```
/workflows:review

Focus: Tenant agent system prompt improvements for jargon-free onboarding.
Primary file: server/src/agent-v2/deploy/tenant/src/prompts/system.ts
```

---

## Context

We just refactored the tenant-agent system prompt to:

1. Remove technical jargon (hero, section, CTA, draft)
2. Use natural conversational questions instead of section announcements
3. Add section completion tracking so agent knows what's done vs missing
4. Strengthen auto-scroll requirement after updates
5. Add fact-to-storefront bridge (Pitfall #88)

**Deployed:** `tenant-agent-00011-wtg` on Cloud Run

---

## Files Changed

| File                                                      | Changes                        |
| --------------------------------------------------------- | ------------------------------ |
| `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` | All prompt changes (main file) |

### Key Sections Added/Modified

1. **🚨 CRITICAL: Customer Profile** (new section at top)
   - Forbidden words list
   - Technical → Natural substitution table

2. **Section Completion Tracking** (new section)
   - Placeholder detection patterns
   - Progress tracking table
   - Avoid repetition rules

3. **Onboarding Flow** (rewritten)
   - Changed from section-based to conversation-based
   - Natural questions without jargon

4. **Auto-Scroll** (strengthened)
   - Made MANDATORY, not optional
   - Added WRONG/RIGHT examples

5. **Decision Flow** (updated)
   - Added fact-to-storefront bridge
   - Fixed onboarding detection

---

## Review Focus Areas

### 1. AI Agent Prompt Engineering Patterns

Consult these resources:

- `~/.claude/skills/agent-native-architecture.md` - Agent prompt patterns
- `docs/solutions/patterns/ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md` - ADK patterns
- `docs/solutions/patterns/AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md` - State patterns

**Questions to answer:**

- Are the forbidden words clear enough for the LLM to follow?
- Is the substitution table effective?
- Does the section tracking pattern work with ADK session state?

### 2. Google Vertex AI Assets

Check what we could leverage:

- **Agent Engine Memory** - Could replace manual fact storage
- **Session State** - `context.state.set()` / `context.state.get()`
- **ADK Callbacks** - `before_agent_callback` for state injection

**Questions to answer:**

- Should we use Vertex AI Agent Engine for persistent memory?
- Are we properly using ADK session state?
- Could pre-execution callbacks help with context injection?

### 3. Compound Engineering Assets

Reference:

- `docs/solutions/patterns/AGENT_TOOLS_PREVENTION_INDEX.md`
- `docs/solutions/agent-issues/FACT_TO_STOREFRONT_BRIDGE_PREVENTION.md`
- `docs/solutions/patterns/A2A_SESSION_STATE_PREVENTION.md`

**Questions to answer:**

- Did we properly implement the fact-to-storefront bridge?
- Are there pitfalls we missed?
- Should we document this as a new prevention pattern?

---

## Known Issues (Discovered During Testing)

1. **Context loss in long conversations**
   - Agent repeated "What do you do?" question multiple times
   - Likely needs ADK session state or Agent Engine memory
   - Current workaround: "Avoid repetition" rules in prompt

2. **FAQ/CTA updates sometimes fail**
   - Error: "That didn't work"
   - May be tool-level issue, not prompt issue
   - Check Cloud Run logs if persists

---

## Test Results

**Working:**

- ✅ "I'll handle this" instead of "Let's build this together"
- ✅ "Take a look" instead of "Check your preview"
- ✅ Natural questions about business
- ✅ Building in background with batch tool calls
- ✅ No jargon like "hero section" or "let's tackle"

**Needs improvement:**

- ⚠️ Still asks repeated questions (memory/state issue)
- ⚠️ Section tracking awareness needs verification

---

## Reviewer Checklist

- [ ] Review prompt changes in `system.ts`
- [ ] Check forbidden words list completeness
- [ ] Verify section tracking pattern is sound
- [ ] Evaluate ADK session state usage
- [ ] Consider Vertex AI Agent Engine memory integration
- [ ] Check for missed pitfalls (32-89 in CLAUDE.md)
- [ ] Suggest improvements to fact-to-storefront bridge
- [ ] Document any new prevention patterns needed

---

## Relevant Pitfalls (from CLAUDE.md)

- **#37**: LLM pattern-matching prompts - Never include example responses LLMs copy verbatim
- **#41**: State Map-like API - Use `context.state?.get<T>('key')` not `context.state.key`
- **#42**: Missing state defaults - Always provide defaults for optional state values
- **#52**: Tool confirmation-only response - Tools must return updated state, not just `{success: true}`
- **#53**: Discovery facts dual-source - `/store-discovery-fact` stores directly in branding JSON
- **#88**: Fact-to-Storefront bridge missing - When user provides content, BOTH store AND update

---

## Deploy After Review

```bash
cd server/src/agent-v2/deploy/tenant && npm run deploy
```

---

## Original Issue Docs

- `docs/issues/2026-01-31-tenant-agent-testing-issues.md` - Full testing results
- `docs/issues/2026-01-31-tenant-agent-fix-handoff.md` - Original fix handoff
