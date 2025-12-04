# Database Layer Documentation Index

## Overview

This directory contains comprehensive analysis of the Elope database layer, model separation, and multi-tenant architecture. The documentation is organized as follows:

---

## Documents

### 1. DATABASE_LAYER_ANALYSIS.md (1,038 lines)

**Comprehensive technical deep-dive covering all aspects of the database layer.**

**Sections**:

1. Executive Summary
2. Business Logic vs. Presentation Config Separation (1.1-1.3)
3. Prisma Schema Structure (2.1-2.3)
4. Repository Pattern & Ports Architecture (3.1-3.3)
5. Tenant Isolation Enforcement (4.1-4.3)
6. Migration History & Patterns (5.1-5.2)
7. Branding & Theme Configuration Storage (6.1-6.3)
8. Coupling Analysis (7.1-7.3)
9. Key Design Patterns (8.1-8.4)
10. Configuration & Environment (9.1-9.2)
11. Recommendations & Summary (10.1-10.3)

**Best for**: Understanding the "why" behind each design decision

---

### 2. DATABASE_LAYER_SUMMARY.md (243 lines)

**Quick reference guide with visual diagrams and tables.**

**Contents**:

- Model Separation Overview (visual tree)
- Tenant Isolation Pattern (flow diagram)
- Critical Constraints (table)
- Performance Indexes (table)
- Double-Booking Prevention (3-layer diagram)
- Commission Model (flow chart)
- Branding Storage Strategy (benefits)
- Migration Pattern (10-step process)
- Repository Interface Pattern (visual)
- Tenant Isolation Verification Checklist
- Cross-Tenant Data Access: IMPOSSIBLE (proof)
- Configuration Files (table)
- Key Takeaways (10 points)

**Best for**: Quick lookups and visual understanding

---

### 3. DATABASE_CODE_REFERENCES.md (412 lines)

**Specific code locations with line numbers and cross-references.**

**Sections**:

- File Structure (complete tree)
- Critical Files - Line References
  - Prisma Schema (lines with content descriptions)
  - Domain Entities (lines with content descriptions)
  - Repository Ports (lines with interfaces)
  - Catalog Repository Adapter (lines with methods)
  - Booking Repository - Advanced Concurrency (lines with 3 layers)
  - Tenant Repository (lines with methods)
  - Blackout Repository (lines with tenant scoping)
  - Webhook Repository (lines with idempotency pattern)
  - Tenant Middleware (lines with pipeline)
  - Multi-Tenancy Migration (lines with 10 steps)
- Cross-References: How Features Use Database Layer
  - Catalog Feature (request flow)
  - Booking Feature (critical path)
  - Branding Feature (complete flow)
- Environment Configuration
- Testing & Mocks
- Performance Considerations
- Security Checkpoints
- Summary

**Best for**: Finding specific code and understanding implementation details

---

## Quick Navigation

### Understanding a Specific Feature

**To understand how Catalog works:**

1. Start: DATABASE_LAYER_SUMMARY.md "Tenant Isolation Pattern"
2. Read: DATABASE_LAYER_ANALYSIS.md Section 3 "Repository Pattern"
3. Code: DATABASE_CODE_REFERENCES.md "Catalog Feature"
4. File: `server/src/adapters/prisma/catalog.repository.ts` (lines 52-58)

**To understand Booking (most complex):**

1. Start: DATABASE_LAYER_SUMMARY.md "Double-Booking Prevention (3 Layers)"
2. Read: DATABASE_LAYER_ANALYSIS.md Section 3.3 "Booking Repository"
3. Code: DATABASE_CODE_REFERENCES.md "Booking Repository - Advanced Concurrency"
4. File: `server/src/adapters/prisma/booking.repository.ts` (lines 68-180)

**To understand Branding:**

1. Start: DATABASE_LAYER_SUMMARY.md "Branding Storage Strategy"
2. Read: DATABASE_LAYER_ANALYSIS.md Section 6 "Branding & Theme Configuration"
3. Code: DATABASE_CODE_REFERENCES.md "Branding Feature"
4. File: `server/prisma/schema.prisma` (line 56)

### Understanding Multi-Tenancy

**Comprehensive tenant isolation:**

1. Summary: DATABASE_LAYER_SUMMARY.md "Tenant Isolation Pattern"
2. Analysis: DATABASE_LAYER_ANALYSIS.md Section 4 "Tenant Isolation Enforcement"
3. Code: DATABASE_CODE_REFERENCES.md Section 9 "Tenant Middleware"
4. File: `server/src/middleware/tenant.ts` (lines 55-155)

**Database-level isolation:**

1. Analysis: DATABASE_LAYER_ANALYSIS.md Section 2.3 "Composite Unique Constraints"
2. Summary: DATABASE_LAYER_SUMMARY.md "Critical Constraints"
3. File: `server/prisma/schema.prisma` (composite @@unique constraints)

**Migration pattern:**

1. Summary: DATABASE_LAYER_SUMMARY.md "Migration Pattern"
2. Analysis: DATABASE_LAYER_ANALYSIS.md Section 5 "Migration History"
3. Code: DATABASE_CODE_REFERENCES.md Section 10 "Multi-Tenancy Migration"
4. File: `server/prisma/migrations/03_add_multi_tenancy.sql` (all 280 lines)

### Understanding Architecture Pattern

**Port-based architecture:**

1. Analysis: DATABASE_LAYER_ANALYSIS.md Section 3 "Repository Pattern & Ports"
2. Code: DATABASE_CODE_REFERENCES.md Section 3 "Repository Ports"
3. Files:
   - `server/src/lib/ports.ts` (interface definitions)
   - `server/src/adapters/prisma/*.ts` (implementations)

**Separation of concerns:**

1. Analysis: DATABASE_LAYER_ANALYSIS.md Section 7 "Coupling Analysis"
2. Summary: DATABASE_LAYER_SUMMARY.md "Model Separation Overview"
3. Files:
   - `server/src/lib/entities.ts` (domain models)
   - `server/src/adapters/prisma/*.ts` (persistence)

### Understanding Performance

**Indexes and queries:**

1. Summary: DATABASE_LAYER_SUMMARY.md "Performance Indexes"
2. Code: DATABASE_CODE_REFERENCES.md "Performance Considerations"

**Race condition prevention:**

1. Summary: DATABASE_LAYER_SUMMARY.md "Double-Booking Prevention"
2. Analysis: DATABASE_LAYER_ANALYSIS.md Section 8.4 "Transaction-Based Race"
3. Code: DATABASE_CODE_REFERENCES.md "Booking Repository"

---

## Key Design Principles

### 1. Composite Unique Constraints

- **Pattern**: `(tenantId, businessKey)` unique
- **Examples**: Package (tenantId, slug), Booking (tenantId, date)
- **Benefit**: Database-enforced tenant isolation
- **Reference**: DATABASE_LAYER_ANALYSIS.md Section 8.1

### 2. Port-Based Architecture

- **Pattern**: Interfaces before implementations
- **Examples**: CatalogRepository, BookingRepository
- **Benefit**: Testability, dependency inversion
- **Reference**: DATABASE_LAYER_ANALYSIS.md Section 3

### 3. Tenant Isolation at Every Layer

- **Middleware**: Extract tenantId from API key
- **Repository**: Every method receives tenantId
- **Database**: Composite constraints enforce isolation
- **Reference**: DATABASE_LAYER_SUMMARY.md "Tenant Isolation Pattern"

### 4. Three-Layer Race Condition Prevention

- **Layer 1**: Database unique constraint
- **Layer 2**: Transaction lock (FOR UPDATE NOWAIT)
- **Layer 3**: Pre-creation check
- **Reference**: DATABASE_LAYER_SUMMARY.md "Double-Booking Prevention"

### 5. Presentation Config Separation

- **Storage**: JSONB field in Tenant model
- **Flexibility**: No migration needed for new properties
- **Isolation**: Each tenant independent config
- **Reference**: DATABASE_LAYER_ANALYSIS.md Section 6

---

## Critical Files (Direct References)

| File                                                | Purpose                | Lines | Reference Doc                  |
| --------------------------------------------------- | ---------------------- | ----- | ------------------------------ |
| `server/prisma/schema.prisma`                       | Schema definition      | 280   | ANALYSIS 2.1-2.3, REFERENCES 1 |
| `server/src/lib/entities.ts`                        | Domain entities        | 66    | ANALYSIS 1.1, REFERENCES 2     |
| `server/src/lib/ports.ts`                           | Repository contracts   | 233   | ANALYSIS 3.1, REFERENCES 3     |
| `server/src/adapters/prisma/catalog.repository.ts`  | Catalog CRUD           | 305   | ANALYSIS 3.2, REFERENCES 4     |
| `server/src/adapters/prisma/booking.repository.ts`  | Booking (critical)     | 368   | ANALYSIS 3.3, REFERENCES 5     |
| `server/src/adapters/prisma/tenant.repository.ts`   | Tenant mgmt            | 177   | ANALYSIS 4.1, REFERENCES 6     |
| `server/src/adapters/prisma/blackout.repository.ts` | Blackout dates         | 63    | ANALYSIS 4.2, REFERENCES 7     |
| `server/src/adapters/prisma/webhook.repository.ts`  | Webhook tracking       | 184   | ANALYSIS 4.3, REFERENCES 8     |
| `server/src/middleware/tenant.ts`                   | Tenant resolution      | 256   | ANALYSIS 4.1, REFERENCES 9     |
| `server/prisma/migrations/03_add_multi_tenancy.sql` | Multi-tenant migration | 280   | ANALYSIS 5.2, REFERENCES 10    |

---

## Verification Checklist

Use this checklist to verify multi-tenant isolation:

- [ ] All repository methods include `tenantId` parameter
- [ ] All database queries filter by `tenantId`
- [ ] Composite unique constraints on tenant-scoped entities
- [ ] Foreign key cascade delete configured
- [ ] TenantRequest middleware properly implements isolation
- [ ] API key validation before database lookup
- [ ] Branding stored separately (JSONB, not in business tables)
- [ ] Commission snapshot stored with booking (audit trail)
- [ ] Webhook events include tenant verification
- [ ] Performance indexes on (tenantId, key) pairs

See: DATABASE_LAYER_SUMMARY.md "Tenant Isolation Verification Checklist"

---

## Common Patterns

### Adding a New Tenant-Scoped Entity

1. **Prisma Schema** (`schema.prisma`):

   ```prisma
   model YourEntity {
     id String @id @default(cuid())
     tenantId String  // Required
     slug String
     // ... other fields

     tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

     @@unique([tenantId, slug])
     @@index([tenantId])
   }
   ```

2. **Domain Entity** (`lib/entities.ts`):

   ```typescript
   export interface YourEntity {
     id: string;
     tenantId: string;
     slug: string;
     // ... other fields
   }
   ```

3. **Repository Port** (`lib/ports.ts`):

   ```typescript
   export interface YourRepository {
     findById(tenantId: string, id: string): Promise<YourEntity | null>;
     findAll(tenantId: string): Promise<YourEntity[]>;
     create(tenantId: string, data: CreateYourEntityInput): Promise<YourEntity>;
     // ...
   }
   ```

4. **Adapter** (`adapters/prisma/your.repository.ts`):
   ```typescript
   async findById(tenantId: string, id: string) {
     return await this.prisma.yourEntity.findFirst({
       where: { tenantId, id }
     });
   }
   ```

See: DATABASE_CODE_REFERENCES.md "Cross-References"

---

## Performance Tuning

### Adding Indexes

- Use composite indexes for frequent (tenantId, status/date) queries
- Avoid redundant indexes
- Monitor EXPLAIN plans

See: DATABASE_LAYER_SUMMARY.md "Performance Indexes"

### N+1 Prevention

- Use Prisma `include` in repository methods
- See examples: `getAllPackagesWithAddOns()`, `findById()`

See: DATABASE_CODE_REFERENCES.md "Performance Considerations"

---

## Security Checklist

- [ ] API key format validated before database lookup
- [ ] tenantId extracted from middleware, not user input
- [ ] Commission calculated server-side only
- [ ] Webhook events verify tenant ownership
- [ ] Branding configuration updates authenticated
- [ ] No direct tenant enumeration possible

See: DATABASE_CODE_REFERENCES.md "Security Checkpoints"

---

## Migration Best Practices

From the 03_add_multi_tenancy.sql migration:

1. **Create new tables first** (Tenant table)
2. **Create default/legacy tenant** (backward compatibility)
3. **Add nullable columns** (existing tables)
4. **Backfill with default tenant** (migrate existing data)
5. **Make columns NOT NULL** (enforce new requirement)
6. **Drop old constraints** (prepare for new ones)
7. **Add composite constraints** (tenant isolation)
8. **Add foreign keys** (referential integrity)
9. **Add performance indexes** (query optimization)
10. **Verify data** (integrity check)

See: DATABASE_LAYER_SUMMARY.md "Migration Pattern"

---

## Related Documentation

- `ARCHITECTURE.md` - System-wide architecture overview
- `CONTRIBUTING.md` - How to contribute to this codebase
- `DECISIONS.md` - Architectural Decision Records (ADRs)

---

## Document Statistics

| Document                    | Lines     | Sections | Focus                     |
| --------------------------- | --------- | -------- | ------------------------- |
| DATABASE_LAYER_ANALYSIS.md  | 1,038     | 11       | Deep technical analysis   |
| DATABASE_LAYER_SUMMARY.md   | 243       | 13       | Quick reference & visuals |
| DATABASE_CODE_REFERENCES.md | 412       | 12       | Specific code locations   |
| **Total**                   | **1,693** | -        | Comprehensive coverage    |

---

## Getting Started

**First time here?** Start with this path:

1. Read: DATABASE_LAYER_SUMMARY.md "Overview" (5 min)
2. Skim: DATABASE_LAYER_SUMMARY.md "Key Takeaways" (2 min)
3. Study: DATABASE_LAYER_ANALYSIS.md Section 1 "Separation" (10 min)
4. Explore: DATABASE_CODE_REFERENCES.md "Critical Files" (20 min)
5. Deep dive: DATABASE_LAYER_ANALYSIS.md full content (40 min)

**Total**: ~1.5 hours to understand the entire database architecture.

---

## Feedback & Improvements

These documents are living artifacts. If you find:

- Missing information
- Unclear explanations
- Code changes that need updating
- Better examples

Please update the corresponding document. Current maintainers:

- Database schema: `server/prisma/schema.prisma`
- Adapters: `server/src/adapters/prisma/`
- Middleware: `server/src/middleware/tenant.ts`

---

Generated: November 10, 2025
Last Updated: [Check git history]
Version: 1.0
