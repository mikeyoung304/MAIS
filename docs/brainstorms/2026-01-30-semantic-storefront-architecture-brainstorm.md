# Semantic Storefront Architecture Brainstorm

**Date:** 2026-01-30 (Revised with external review)
**Status:** Enhanced — Ready for Planning
**Next Step:** `/workflows:plan`
**External Review:** Incorporated feedback from independent AI architecture review

---

## What We're Building

A world-class AI-powered website builder where:

1. **Users never need technical vocabulary** — They say "update my about section" and it works
2. **Progressive generation** — AI builds site section-by-section with user approval at each step
3. **Service ontology** — 3 Customer Segments × 3 Pricing Tiers (Good/Better/Best) as the structural spine
4. **AI-to-AI commerce ready** — External agents can query "What wedding packages does Jane offer?" via structured API
5. **Reference site crawling** — User pastes URL, agent extracts style + content patterns

---

## Why This Approach

### Current Pain Points (All Interconnected)

| Layer              | Problem                                                                           |
| ------------------ | --------------------------------------------------------------------------------- |
| **Delegation**     | Context lost when concierge hands off to storefront agent (sectionId bug symptom) |
| **Section naming** | Developer-centric IDs (`home-text-about`) meaningless to users                    |
| **User language**  | Unpredictable — "about section" vs "my bio" vs "make it pop"                      |
| **Schema**         | Freeform JSON in `landingPageConfig` — not machine-queryable                      |
| **Dual drafts**    | Visual Editor vs Build Mode use different storage paths                           |

### Industry Patterns (From Research)

- **Universal vocabulary**: "Sections" — Hero, About, Services, Testimonials, Pricing, FAQ, Contact
- **Multi-option generation**: Generate 2-3 variants, let user choose
- **Explicit change breakdown**: Show what will change before applying
- **No auto-apply**: All tools show preview first, require explicit confirmation

### Agent-Native Principles Applied

- **Dynamic context injection**: Agent needs to see what exists (sections, segments, tiers) at conversation start
- **Capability mapping in user vocabulary**: "your about section" not "home-text-about"
- **Features as prompts, not code**: Section updates are outcomes the agent achieves
- **Single unified agent for core domain**: Eliminates delegation context loss

---

## Key Decisions

### 1. Section Naming: Functional

**Decision:** Use industry-standard functional names
**Options considered:** Narrative ("Your Story"), Functional ("About"), Both with mapping
**Rationale:** Clear, immediately understood, aligned with industry patterns

**Canonical blocks:**

- Hero
- About
- Services (segment-aware)
- Pricing (segment × tier structure)
- Testimonials
- FAQ
- Contact
- CTA

### 2. Service Structure: 3×3 Ontology

**Decision:** Up to 3 Customer Segments × exactly 3 Pricing Tiers per segment

```
Segment (e.g., "Weddings")
├── Good tier ($X)
├── Better tier ($Y) ← pricing psychology favors middle
└── Best tier ($Z)
```

**Key insight:** This isn't just website architecture — it's a **service ontology** that both humans AND AI agents can navigate.

### 3. Segment UX: Fractal 3-Card Pattern

**Decision:** Same UI pattern at both levels

```
Multi-Segment Landing          Segment Page
┌─────────────────────┐        ┌─────────────────────┐
│ [Seg1][Seg2][Seg3]  │  ───►  │ [Good][Better][Best]│
└─────────────────────┘  tap   └─────────────────────┘
```

**Rationale:** Consistent mental model, pricing psychology at both levels, clean for A2A queries

### 4. Content Scoping: Tenant-Configurable

**Decision:** Per-tenant setting determines if content sections are segment-scoped

| Setting | Behavior                                        |
| ------- | ----------------------------------------------- |
| Scoped  | Wedding testimonials shown only on wedding page |
| Shared  | All testimonials shown everywhere               |

**Implementation:** `SectionContent.segmentId` nullable — null means shared

### 5. AI-to-AI API: First-Class

**Decision:** Design schema for machine-queryability from day one

**Implications:**

- Normalized Prisma models (not freeform JSON)
- RESTful or GraphQL endpoint for external agent queries
- Structured response format agents can parse

### 6. Approval UX: Smart Auto-Approve

**Decision:** Low-risk changes auto-apply with undo; high-risk require explicit approval

| Risk Level | Examples                              | Behavior                       |
| ---------- | ------------------------------------- | ------------------------------ |
| **Low**    | Typo fixes, minor wording, whitespace | Auto-apply, show "Undo" option |
| **Medium** | Content updates, image changes        | Preview + one-tap confirm      |
| **High**   | Structure changes, pricing, publish   | Explicit approval with diff    |

**Rationale:** Reduces friction for simple edits while protecting against unintended structural changes.

### 7. Vocabulary Mapping: Embedding-Based

**Decision:** Use pgvector for dynamic semantic matching instead of hard-coded tables

**How it works:**

- Store canonical block names with embeddings
- User input "revamp my life story page" → similarity search → "About" (95% confidence)
- If confidence < 80%, agent clarifies: "Do you mean your About section?"

**Why:** Handles unpredictable language better than static mappings; scales to custom sections.

### 8. Architecture: Hybrid (Ontology + Unified Agent)

**Decision:** Service Ontology schema + Single Storefront Agent + External Specialists

```
┌─────────────────────────────────────────────────────────┐
│                    Concierge Agent                       │
│  (Router — decides which domain to engage)               │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Storefront    │  │    Research     │  │    Booking      │
│     Agent       │  │     Agent       │  │     Agent       │
│                 │  │                 │  │                 │
│ UNIFIED - Full  │  │ SPECIALIST -    │  │ SPECIALIST -    │
│ context, no     │  │ Web crawling,   │  │ Appointments,   │
│ sub-delegation  │  │ reference site  │  │ calendar        │
│                 │  │ extraction      │  │                 │
│ Owns:           │  │                 │  │                 │
│ - All sections  │  │                 │  │                 │
│ - All segments  │  │                 │  │                 │
│ - All tiers     │  │                 │  │                 │
│ - Draft/publish │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│              Service Ontology (Prisma)                   │
│                                                          │
│  Tenant → Segment[] → Tier[]                            │
│              ↓                                           │
│        SectionContent[]                                  │
│              ↓                                           │
│     landingPageConfig (derived view)                    │
└─────────────────────────────────────────────────────────┘
```

**Why unified Storefront Agent:**

- No delegation = no context loss
- Full picture of site state in one context window
- Simpler to maintain than coordinating multiple specialists

**Why keep Research Agent separate:**

- External web scraping is a different capability domain
- Long timeouts (90s) don't belong in core conversation
- Can be called as-needed, results injected back
- **Async with progress** (enhancement): Send progress updates ("Analyzing site — 30s left") during crawl

**Scalability safeguards** (from external review):

- **Context compression**: If Storefront Agent context exceeds token budget, summarize older sections
- **Fallback delegation**: For very large sites, dynamically split into Content Agent + Structure Agent
- **Observability layer**: Track token usage, error rates, response times per agent (Phase 2)

---

## Proposed Schema Changes

### New Models

```prisma
model Segment {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])

  name        String   // "Weddings", "Newborns", "Corporate"
  slug        String   // "weddings" for URL routing
  description String?
  order       Int      @default(0)

  // SEO/A2A metadata (enhancement from external review)
  metadata    Json?    // { keywords: [], seoTitle: "", seoDescription: "" }

  tiers       Tier[]
  content     SectionContent[]

  @@unique([tenantId, slug])
  @@index([tenantId])
}

model Tier {
  id          String    @id @default(cuid())
  segmentId   String
  segment     Segment   @relation(fields: [segmentId], references: [id])

  level       TierLevel // GOOD, BETTER, BEST
  name        String    // "Essential", "Professional", "Premium"
  description String?
  price       Decimal
  features    Json      // Array of feature strings

  @@unique([segmentId, level])
}

enum TierLevel {
  GOOD
  BETTER
  BEST
}

model SectionContent {
  id          String     @id @default(cuid())
  tenantId    String
  tenant      Tenant     @relation(fields: [tenantId], references: [id])

  segmentId   String?    // null = shared across all segments
  segment     Segment?   @relation(fields: [segmentId], references: [id])

  blockType   BlockType  // HERO, ABOUT, TESTIMONIALS, etc.
  content     Json       // Block-specific content structure
  order       Int        @default(0)

  // Multi-option generation (enhancement from external review)
  variants    Json?      // Array of 2-3 alternative versions for user choice

  // Version history for undo (enhancement from external review)
  versions    Json?      // Array of last 5 versions: [{ content, timestamp }]

  isDraft     Boolean    @default(true)
  publishedAt DateTime?

  @@index([tenantId, blockType])
  @@index([tenantId, segmentId])
}

enum BlockType {
  HERO
  ABOUT
  SERVICES
  PRICING
  TESTIMONIALS
  FAQ
  CONTACT
  CTA
  GALLERY
  CUSTOM
}
```

### Migration Path

1. **Phase 1:** Add new models alongside existing `landingPageConfig`
2. **Phase 2:** Migrate existing tenant data to new structure
3. **Phase 3:** Update agents to use new models
4. **Phase 4:** Deprecate `landingPageConfig` JSON (or keep as derived cache)

---

## Storefront Agent Context Injection

Following agent-native principles, the Storefront Agent receives dynamic context:

```markdown
## Current Storefront State

**Tenant:** Jane's Photography
**Mode:** Editing draft (unpublished changes exist)

### Segments (2 active)

1. **Weddings** (/weddings) — 3 tiers configured
2. **Portraits** (/portraits) — 3 tiers configured

### Sections on Home Page

| Block        | Status    | Segment-Scoped |
| ------------ | --------- | -------------- |
| Hero         | Published | No             |
| About        | Draft     | No             |
| Testimonials | Published | Yes            |
| FAQ          | Published | No             |
| Contact      | Published | No             |

### Your Capabilities

- `update_section(blockType, content)` — Modify section content
- `add_section(blockType, afterBlock?)` — Add new section
- `remove_section(blockType)` — Remove section
- `reorder_sections(order[])` — Change section order
- `update_segment(segmentId, data)` — Modify segment details
- `update_tier(segmentId, level, data)` — Modify pricing tier
- `preview_changes()` — Show diff of draft vs published
- `publish_draft()` — T3 action, requires confirmation

### User Vocabulary Mapping

| User Says                             | You Should Use                              |
| ------------------------------------- | ------------------------------------------- |
| "about section", "my bio", "who I am" | `update_section(ABOUT, ...)`                |
| "hero", "headline", "main banner"     | `update_section(HERO, ...)`                 |
| "reviews", "testimonials"             | `update_section(TESTIMONIALS, ...)`         |
| "my packages", "pricing"              | Clarify segment first, then `update_tier()` |
```

---

## Reference Site Crawling Flow

When user provides a reference URL:

```
User: "I like how this photographer's site looks: [URL]"
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Concierge routes to Research Agent                      │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Research Agent crawls URL, extracts:                    │
│  - Color palette (hex values)                            │
│  - Typography (font families, sizes)                     │
│  - Section structure (what blocks they have)             │
│  - Content patterns (headline length, CTA style)         │
│  - Layout patterns (grid, single column, etc.)           │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Returns structured extraction to Concierge              │
│  {                                                       │
│    colors: { primary: "#2D3748", accent: "#68D391" },   │
│    fonts: { heading: "Playfair Display", body: "Inter" },│
│    sections: ["hero", "about", "gallery", "testimonials"],│
│    patterns: { heroStyle: "full-bleed", ctaStyle: "... }│
│  }                                                       │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Concierge presents options to user:                     │
│  "I found some patterns I can apply:                     │
│   1. Color scheme (dark navy + sage green)               │
│   2. Typography (elegant serif headlines)                │
│   3. Section structure (they have a gallery you don't)   │
│   Which would you like me to apply?"                     │
└─────────────────────────────────────────────────────────┘
```

---

## Open Questions for Planning

### Schema & Data

1. **Migration complexity** — How many existing tenants? What's the migration risk?
2. **landingPageConfig fate** — Keep as derived cache or fully deprecate?
3. **Version/history** — Should SectionContent have version tracking for undo?

### Agent Architecture

4. **Storefront Agent size** — Will full context fit in reasonable token budget?
5. **Marketing Agent fate** — Merge into Storefront Agent or keep separate?
6. **Tool granularity** — One `update_section` or separate tools per block type?

### A2A Commerce

7. **API format** — REST, GraphQL, or purpose-built agent protocol?
8. **Authentication** — How do external agents authenticate to query?
9. **Rate limiting** — How to prevent abuse of public API?

### Reference Crawling

10. **Legal/ethical** — Any concerns with crawling competitor sites?
11. **Extraction accuracy** — How reliable is style extraction in practice?
12. **User expectations** — What if extraction is poor quality?

### UX

13. **Progressive generation flow** — Exactly how does "approve each section" work?
14. **Segment creation** — During onboarding or on-demand?
15. **Preview experience** — Real-time preview or diff view?

---

## Risk Matrix (from External Review)

| Category        | Risk                                            | Likelihood | Impact   | Mitigation                                                            |
| --------------- | ----------------------------------------------- | ---------- | -------- | --------------------------------------------------------------------- |
| **Technical**   | Token overflow in Unified Agent for large sites | High       | High     | Context compression; fallback to modular agents                       |
| **Technical**   | Migration data loss/corruption                  | Medium     | Critical | Phased migration with backups; validation scripts; staging test       |
| **UX**          | Users overwhelmed by progressive approvals      | Medium     | Medium   | Smart auto-approve for low-risk; batch approvals for multi-section    |
| **Scalability** | A2A API abuse (DDoS from rogue agents)          | Low        | High     | Rate limiting (100/min/tenant); OAuth scopes; monitoring              |
| **Legal**       | Crawling IP issues or inaccurate extractions    | Medium     | Medium   | "Inspired by" mode; user consent prompts; avoid paywalled content     |
| **Adoption**    | Existing tenants resist change                  | High       | Medium   | Opt-in migration with incentives; provide rollback path               |
| **Edge Cases**  | Ambiguous user language not caught by mappings  | High       | Medium   | Embedding-based matching; agent always clarifies; log for ML training |

**Overall risk:** Medium — strong foundation, but migration and agent scale are watch items.

---

## Success Criteria (Measurable)

| Metric                        | Target                      | How Measured                  |
| ----------------------------- | --------------------------- | ----------------------------- |
| **Natural language accuracy** | 95% correct section mapping | Agent logs + user corrections |
| **Context integrity**         | Zero delegation losses      | Beta testing reports          |
| **A2A response time**         | <100ms p95                  | API monitoring                |
| **A2A uptime**                | 99%                         | Uptime monitoring             |
| **Crawling satisfaction**     | >85% user approval          | Post-extraction surveys       |
| **Onboarding time**           | <15min for new sites        | Time tracking                 |
| **Section approval rate**     | >80% first-pass approval    | Agent logs                    |
| **Migration fidelity**        | 100% data preserved         | Validation scripts            |
| **Tenant opt-out rate**       | <5%                         | Migration dashboard           |

---

## References

- Industry research: Wix ADI, Framer AI, v0.dev, Squarespace AI patterns
- Agent-native architecture skill: `~/.claude/plugins/.../agent-native-architecture/`
- Current MAIS architecture: `server/src/agent-v2/`, ADR-018
- Pricing psychology: Good/Better/Best tier pattern
- External AI architecture review: Incorporated 2026-01-30

---

## Enhancements Incorporated from External Review

| Enhancement                                   | Status   | Location in Doc        |
| --------------------------------------------- | -------- | ---------------------- |
| Embedding-based vocabulary mapping (pgvector) | ✅ Added | Key Decisions #7       |
| Variants field for multi-option generation    | ✅ Added | Schema: SectionContent |
| Version history for undo (last 5)             | ✅ Added | Schema: SectionContent |
| SEO/A2A metadata on Segment                   | ✅ Added | Schema: Segment        |
| Context compression fallback                  | ✅ Added | Architecture section   |
| Observability layer                           | ✅ Added | Architecture section   |
| Async crawling with progress                  | ✅ Added | Research Agent spec    |
| Smart auto-approve UX                         | ✅ Added | Key Decisions #6       |
| Risk matrix                                   | ✅ Added | New section            |
| Measurable success criteria                   | ✅ Added | Updated section        |

**Deferred:**

- Flexible tier counts (keeping strict 3)
- Hierarchical segments (keeping flat)
- Freeform mode toggle (out of scope for MVP)
- Conditional scoping (nice-to-have)
- Base64 images in prompts (test feasibility later)

---

## Next Steps

1. Run `/workflows:plan` to create implementation plan
2. **Validation spikes first** (1-2 weeks):
   - Minimal Prisma schema + sample tenant migration
   - Mock Storefront Agent to test context injection
   - Reference crawling accuracy on 5-10 sites
3. Plan should address migration strategy (highest risk)
4. Phased rollout: Schema → Agent → A2A API → Crawling
