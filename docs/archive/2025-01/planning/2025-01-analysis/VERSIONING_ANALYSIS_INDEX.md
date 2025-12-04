# Configuration Versioning & Draft/Publish Workflows - Complete Analysis

## Overview

This is a comprehensive exploration of versioning, draft/publish workflows, and rollback capabilities in the Elope codebase. The analysis examines what exists, what's missing, and provides detailed implementation recommendations.

**Status**: Versioning and draft/publish capabilities are **NOT IMPLEMENTED**

## Documents Included

### 1. VERSIONING_FINDINGS_SUMMARY.txt

**Quick reference** - Start here for a 2-minute overview

- Current state assessment
- Gap analysis
- High-level recommendations
- Effort estimates

**Key Takeaway**: No versioning exists. Branding and package changes apply immediately with no rollback capability.

### 2. VERSIONING_DRAFT_PUBLISH_ANALYSIS.md

**Comprehensive deep-dive** - Full technical analysis with code examples

- Detailed current state by component
- Schema examination
- Service layer analysis
- Complete implementation strategy with 5 phases
- Configuration snapshot for bookings
- Staging/production options
- Security and performance considerations
- Testing strategy

**Length**: ~7000 words
**Time to read**: 30-45 minutes
**Target**: Architects and senior developers planning implementation

### 3. VERSIONING_TECHNICAL_REFERENCE.md

**Implementation guide** - Code locations and technical details

- Line-by-line code location reference
- Exact schema changes needed
- DTOs and service signatures
- New API endpoints
- Data migration scripts
- Testing file locations
- Implementation details (draft workflow, rollback workflow, audit trail)
- Performance optimization strategies
- Backwards compatibility approach

**Target**: Developers implementing the feature
**Quick lookup**: Use this when writing code

## Key Findings at a Glance

### What Exists

```
✅ Soft-delete pattern (Tenant.isActive)
✅ Timestamps (createdAt, updatedAt)
✅ JSON blob storage for flexible config (Tenant.branding)
✅ Cache invalidation strategy
✅ Multi-tenant isolation
```

### What's Missing

```
❌ Draft vs published state
❌ Version history tracking
❌ Rollback/revert capability
❌ Preview before publish
❌ Audit logging (WHO/WHAT/WHEN)
❌ Configuration snapshots
❌ Staging/production separation
```

## Critical Issues

1. **Branding changes apply immediately** - No way to preview or rollback
2. **Package pricing has no snapshot** - Historical bookings may reference stale data
3. **Hard deletes are permanent** - No recovery option for deleted packages
4. **No audit trail** - Compliance issues, can't track who changed what
5. **Single active version only** - No way to A/B test or schedule changes

## Implementation at a Glance

### Required Schema Changes

```
Add to Tenant:
  - draftBranding (JSON)
  - currentBrandingVersion (Int)
  - brandingPublishedAt (DateTime)

Add to Package:
  - isDraft (Boolean)
  - publishedAt (DateTime)
  - currentVersion (Int)
  - draftPhotos (JSON)

Create:
  - BrandingVersion table
  - PackageVersion table
  - AuditLog table
```

### New Service Layer

```
BrandingService:
  - saveDraft()
  - publishBranding()
  - rollbackToBrandingVersion()
  - getBrandingVersionHistory()

PackageService:
  - createPackageDraft()
  - saveDraft()
  - publishPackage()
  - rollbackPackageVersion()

AuditLogService:
  - log()
  - getAuditLog()
  - getEntityHistory()
```

### New API Endpoints (~15 endpoints)

```
Branding:
  POST   /v1/tenant/branding/draft
  POST   /v1/tenant/branding/publish
  GET    /v1/tenant/branding/draft
  POST   /v1/tenant/branding/draft/discard
  GET    /v1/tenant/branding/versions
  POST   /v1/tenant/branding/versions/:versionNumber/rollback

Packages:
  POST   /v1/tenant/packages/:id/draft
  POST   /v1/tenant/packages/:id/publish
  GET    /v1/tenant/packages/:id/draft
  GET    /v1/tenant/packages/:id/versions
  POST   /v1/tenant/packages/:id/versions/:versionNumber/rollback

Audit:
  GET    /v1/tenant/audit-log
  GET    /v1/tenant/audit-log/:entityType/:entityId
```

## Implementation Timeline

| Phase     | Duration      | Focus                        |
| --------- | ------------- | ---------------------------- |
| 1         | 2-3 days      | Database schema, migrations  |
| 2         | 3-4 days      | Service layer implementation |
| 3         | 2-3 days      | API endpoints                |
| 4         | 3-4 days      | Frontend components          |
| 5         | 2-3 days      | Testing & documentation      |
| **Total** | **2-3 weeks** | **Complete implementation**  |

## Code Locations Map

### Current Implementation Locations

- **Branding**: `/server/src/controllers/tenant-admin.controller.ts:248-295`
- **Packages**: `/server/src/services/catalog.service.ts:154-184`
- **Schema**: `/server/prisma/schema.prisma`
- **Frontend**: `/client/src/features/tenant-admin/BrandingEditor.tsx`

### Files to Create

- 7 new files (migrations, services, routes, components)

### Files to Modify

- 5 existing files (schema, DTOs, contracts, controllers, components)

## Recommended Reading Order

1. **Start**: VERSIONING_FINDINGS_SUMMARY.txt (5 min)
   - Get oriented
   - Understand scope

2. **Read**: VERSIONING_DRAFT_PUBLISH_ANALYSIS.md (30-45 min)
   - Deep technical understanding
   - See full implementation strategy
   - Review security/performance sections

3. **Reference**: VERSIONING_TECHNICAL_REFERENCE.md (lookup as needed)
   - When writing code
   - When making schema changes
   - For API endpoint specifications

## Quick Decision Checklist

**Should we implement versioning?**

- [ ] Do we need audit trails for compliance?
- [ ] Do tenants need to preview changes?
- [ ] Do we need to rollback branding/pricing?
- [ ] Do bookings need config snapshots?
- [ ] Do we need draft packages?

If any boxes are checked, versioning is HIGH priority.

**Phase prioritization**:

- [ ] **MUST HAVE**: Draft/published state, publish/rollback, version history
- [ ] **SHOULD HAVE**: Preview, audit logging, snapshots
- [ ] **NICE TO HAVE**: Scheduling, approval workflows, A/B testing

## Performance Impact Summary

### Database

- 3 new tables
- ~7 new indexes
- More storage for history (mitigated by archival policy)

### API

- 15+ new endpoints
- More database queries (mitigated by caching strategy)
- Slightly higher latency on version lookups

### Mitigation

- Aggressive caching of current version
- Archive versions older than 1 year
- Index optimization for common queries
- Batch operations where possible

## Security Considerations

1. **Access Control**: Only tenant admins can publish/rollback
2. **Audit Trail**: All changes logged with user ID and timestamp
3. **Rate Limiting**: Prevent rapid publish/rollback cycles
4. **IP Logging**: Track source of changes
5. **Future**: Approval workflows for sensitive changes

## Next Steps

1. Review these documents
2. Prioritize which features are essential
3. Adjust timeline based on team capacity
4. Create Jira/GitHub issues for each phase
5. Begin Phase 1 (schema changes)
6. Set up data migration for existing configs

## Questions to Answer

Before implementation:

1. **Timeline**: When do we need this?
   - Critical now? (affects priority)
   - Nice to have? (can phase it)

2. **Scope**: Which features matter most?
   - Draft/publish for branding only or packages too?
   - Need audit logging?
   - Need booking snapshots?

3. **Compatibility**: How do we handle existing data?
   - Migrate to v1 of all configs?
   - Transition existing clients gradually?

4. **Approval**: Is any feature blocked on approvals?
   - Need manager approval to publish?
   - Scheduled publishing needed?

## Contact & Updates

This analysis is current as of: **November 10, 2025**

For updates on schema status or feature implementation, check:

- `/server/prisma/schema.prisma` for current schema
- `/server/src/services/` for service implementations
- `/server/src/routes/` for new API endpoints

---

**Analysis generated for**: Elope wedding booking platform
**Codebase**: Multi-tenant SaaS with React frontend, Node/Express backend
**Database**: PostgreSQL with Prisma ORM
