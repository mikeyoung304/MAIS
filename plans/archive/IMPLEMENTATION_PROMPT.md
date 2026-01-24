# Implementation Prompt for Storefront AI-Chatbot Integration

Copy everything below the line and paste into a new Claude Code session:

---

## Context

I'm implementing the **Storefront AI-Chatbot Integration** feature for MAIS - a multi-tenant service booking platform. The goal is to replace fragile array indices with stable, human-readable section IDs so our AI chatbot can reliably update tenant storefronts.

## The Plan

Read the implementation plan at: `plans/storefront-ai-chatbot-integration-FINAL.md`

This plan has been reviewed by 6 specialist agents (DHH, TypeScript expert, Security Sentinel, Architecture Strategist, Code Simplicity, Agent-Native Architect) and incorporates all their feedback.

## Key Files to Understand

Before starting, read these files for context:

- `packages/contracts/src/landing-page.ts` - Current section schemas and DEFAULT_PAGES_CONFIG
- `server/src/agent/tools/storefront-tools.ts` - Current storefront tools
- `server/src/agent/executors/storefront-executors.ts` - Current executors

## Implementation Order

**Phase 1: Schema Foundation + Defaults** (Start here)

1. Add `SectionIdSchema` with strict validation
2. Add `isSectionWithId()` type guard
3. Add `generateSectionId()` function
4. Update all 9 section type schemas with optional `id` field
5. Update `DEFAULT_PAGES_CONFIG` with IDs and placeholders
6. Write unit tests

**Phase 2: Discovery Tools + Migration**

1. Add `list_section_ids` tool
2. Add `get_section_by_id` tool
3. Add `get_unfilled_placeholders` tool
4. Create migration script at `server/scripts/migrate-section-ids.ts`
5. Add uniqueness validation in executors
6. Write integration tests

**Phase 3: ID-Based Tool Updates**

1. Update `UpdatePageSectionPayloadSchema` for ID support
2. Add `sectionId` parameter to `update_page_section` tool
3. Add `sectionId` parameter to `remove_page_section` tool
4. Adjust trust tiers (publish_draft → T3)
5. Add audit logging

**Phase 4: Unification + Agent Intelligence**

1. Expose Build Mode tools in onboarding MARKETING phase
2. Update system prompt with disambiguation flow

## Critical Requirements

From the reviews, these are NON-NEGOTIABLE:

1. **Strict ID Regex** - Validate known pages and section types:

   ```typescript
   /^(home|about|services|faq|contact|gallery|testimonials)-(hero|text|gallery|testimonials|faq|contact|cta|pricing|features)-(main|[a-z]+|[0-9]+)$/;
   ```

2. **Reserved Pattern Validation** - Block JavaScript prototype pollution:

   ```typescript
   .refine(id => !['__proto__', 'constructor', 'prototype'].some(p => id.includes(p)))
   ```

3. **Tenant Isolation in Migration** - Fresh `existingIds` Set per tenant

4. **Monotonic Counter** - Never reuse deleted IDs

5. **Trust Tier T3 for publish_draft** - Makes changes live to visitors

## Commands

Run these as you work:

- `npm run typecheck` - After schema changes
- `npm test` - After each phase
- `npm run build` - Before committing

## Start

Begin with Phase 1. After completing each phase, run tests and get my approval before proceeding to the next phase.

Let's start! Read the plan file and begin implementing Phase 1.
