# File Upload Security & Prevention - Complete Index

A comprehensive collection of prevention strategies, best practices, and implementation patterns for file upload features in the MAIS multi-tenant platform.

---

## Overview

This index guides you to the right resource for your needs:

- **Implementing a new upload feature?** → Start with [Pre-Development Checklist](#pre-development-checklist)
- **Reviewing upload code?** → Use [Code Review Checklist](#code-review-checklist)
- **Need architectural patterns?** → See [Implementation Patterns](#implementation-patterns)
- **Quick reference while coding?** → Print [Quick Reference Card](#quick-reference-card)
- **Understanding what went wrong?** → Check [Red Flags & Common Mistakes](#red-flags--common-mistakes)

---

## Documents

### 1. FILE_UPLOAD_PREVENTION_GUIDE.md

**Purpose:** Comprehensive prevention strategies covering the entire development lifecycle

**Contains:**

- Pre-Development Checklist (✅ Review before starting implementation)
- Code Review Checklist (✅ Use when reviewing PRs)
- Testing Recommendations (✅ Unit, integration, E2E, security, load tests)
- Architectural Patterns (✅ Service layer, DI, repository pattern)
- Red Flags (✅ 30 warning signs of common vulnerabilities)
- Common Implementation Mistakes (✅ What not to do)

**Who should read:**

- Senior engineers (architectural decisions)
- Code reviewers (PR validation)
- Junior engineers (learning proper patterns)

**When to read:**

- Before implementing any file upload feature
- Before merging upload-related PRs
- When designing multi-tenant file storage

**Key sections:**

- 7 critical rules for secure uploads
- Multi-tenant isolation verification checklist
- MIME spoofing prevention with examples
- Rate limiting strategies
- Complete test coverage examples

---

### 2. FILE_UPLOAD_QUICK_REFERENCE.md

**Purpose:** Single-page reference for developers actively coding

**Contains:**

- 7 Critical Rules (condensed)
- Red Flags Checklist (30 items, categorized)
- File Size Limits
- Allowed MIME Types
- Rate Limit Settings
- Magic Byte Examples
- Testing Checklist
- Common Mistakes (before/after)
- Emergency SOS procedures

**Who should use:**

- All developers working on file uploads
- Code reviewers (for quick validation)
- On-call engineers (for troubleshooting)

**When to use:**

- During development (keep on desk)
- During code review (checklist)
- When debugging upload issues

**Format:** Print-friendly (designed to fit on 1-2 pages)

---

### 3. FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md

**Purpose:** Proven implementation patterns for the MAIS architecture

**Contains:**

- Pattern 1: Repository-Based Storage Architecture
  - Current issues and solutions
  - Supabase implementation
  - Filesystem implementation
  - DI setup
- Pattern 2: File Validation with Magic Bytes
  - Two-layer validation approach
  - FileTypeValidator class
  - SVG security handling
- Pattern 3: Tenant-Scoped File Management
  - Database tracking with Prisma
  - Cascade deletion setup
  - Orphaned file detection
- Pattern 4: Rate Limiting for Uploads
  - Memory-based (dev)
  - Redis-based (prod)
  - Route integration
- Pattern 5: Proper Error Handling
  - Domain errors
  - Error mapping to HTTP status codes
  - Error middleware

**Who should read:**

- Architects (designing upload features)
- Lead engineers (implementing patterns)
- Mid-level developers (understanding best practices)

**When to read:**

- When designing upload feature architecture
- Before implementing new upload types
- When refactoring upload code

**Key benefits:**

- Copy-paste ready code examples
- Clear problem statements
- Before/after comparisons
- Production-tested patterns

---

## Quick Navigation

### By Role

#### Senior Engineer / Architect

1. Read: [FILE_UPLOAD_PREVENTION_GUIDE.md → Architectural Patterns](#architectural-patterns)
2. Review: [FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md → All patterns](#implementation-patterns)
3. Use: [FILE_UPLOAD_PREVENTION_GUIDE.md → Red Flags](#red-flags)

#### Code Reviewer

1. Use: [FILE_UPLOAD_QUICK_REFERENCE.md → Red Flags Checklist](#red-flags--common-mistakes)
2. Reference: [FILE_UPLOAD_PREVENTION_GUIDE.md → Code Review Checklist](#code-review-checklist)
3. Check: [FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md → Pattern examples](#implementation-patterns)

#### Developer (Implementing Feature)

1. Start: [FILE_UPLOAD_PREVENTION_GUIDE.md → Pre-Development Checklist](#pre-development-checklist)
2. Reference: [FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md](#implementation-patterns) (for code)
3. During dev: Keep [FILE_UPLOAD_QUICK_REFERENCE.md](#quick-reference-card) on desk
4. Before commit: [FILE_UPLOAD_PREVENTION_GUIDE.md → Testing Recommendations](#testing-recommendations)

#### QA / Test Engineer

1. Read: [FILE_UPLOAD_PREVENTION_GUIDE.md → Testing Recommendations](#testing-recommendations)
2. Reference: [FILE_UPLOAD_QUICK_REFERENCE.md → Testing Checklist](#quick-reference-card)
3. Check: [FILE_UPLOAD_PREVENTION_GUIDE.md → Red Flags](#red-flags)

#### On-Call Engineer

1. Use: [FILE_UPLOAD_QUICK_REFERENCE.md → SOS (Emergency Issues)](#quick-reference-card)
2. Reference: [FILE_UPLOAD_PREVENTION_GUIDE.md → Common Implementation Mistakes](#common-implementation-mistakes)
3. Escalate: If pattern not covered, check [FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md](#implementation-patterns)

---

### By Task

#### "I'm implementing a new upload feature"

1. ✅ [Pre-Development Checklist](FILE_UPLOAD_PREVENTION_GUIDE.md#1-pre-development-checklist)
2. ✅ [Implementation Patterns](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md) (copy code)
3. ✅ [Testing Recommendations](FILE_UPLOAD_PREVENTION_GUIDE.md#3-testing-recommendations)
4. ✅ [Code Review](FILE_UPLOAD_PREVENTION_GUIDE.md#2-code-review-checklist) (self-review)

#### "I'm reviewing upload code"

1. ✅ [Red Flags Checklist](FILE_UPLOAD_QUICK_REFERENCE.md#red-flags-checklist)
2. ✅ [Code Review Checklist](FILE_UPLOAD_PREVENTION_GUIDE.md#2-code-review-checklist)
3. ✅ [Common Mistakes](FILE_UPLOAD_PREVENTION_GUIDE.md#6-common-implementation-mistakes)
4. ✅ [Testing Recommendations](FILE_UPLOAD_PREVENTION_GUIDE.md#3-testing-recommendations)

#### "I found a vulnerability in upload code"

1. ✅ [Red Flags](FILE_UPLOAD_PREVENTION_GUIDE.md#5-red-flags) (identify the type)
2. ✅ [Prevention Strategies](FILE_UPLOAD_PREVENTION_GUIDE.md#4-architectural-patterns) (fix approach)
3. ✅ [Implementation Patterns](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md) (code example)

#### "I'm debugging an upload issue"

1. ✅ [SOS (Emergency Issues)](FILE_UPLOAD_QUICK_REFERENCE.md#sos-emergency-issues)
2. ✅ [Red Flags](FILE_UPLOAD_PREVENTION_GUIDE.md#5-red-flags)
3. ✅ [Common Mistakes](FILE_UPLOAD_PREVENTION_GUIDE.md#6-common-implementation-mistakes)

#### "I need to optimize upload performance"

1. ✅ [Rate Limiting Pattern](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md#pattern-4-rate-limiting-for-uploads)
2. ✅ [Testing - Load Tests](FILE_UPLOAD_PREVENTION_GUIDE.md#load--performance-tests)
3. ✅ [Red Flags - Performance](FILE_UPLOAD_PREVENTION_GUIDE.md#5-red-flags) (items 25-30)

---

## The 7 Critical Rules

Every file upload implementation must follow these:

1. **✅ ALWAYS Include TenantId in Paths**
   - See: [FILE_UPLOAD_PREVENTION_GUIDE.md → Multi-Tenant Isolation](FILE_UPLOAD_PREVENTION_GUIDE.md#multi-tenant-isolation)
   - Pattern: [FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md → Pattern 3](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md#pattern-3-tenant-scoped-file-management-with-database-tracking)

2. **✅ VALIDATE FILE CONTENT (Magic Bytes)**
   - See: [FILE_UPLOAD_PREVENTION_GUIDE.md → File Content Validation](FILE_UPLOAD_PREVENTION_GUIDE.md#file-content-validation)
   - Pattern: [FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md → Pattern 2](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md#pattern-2-file-validation-with-magic-bytes)

3. **✅ VERIFY OWNERSHIP Before Delete**
   - See: [FILE_UPLOAD_PREVENTION_GUIDE.md → Ownership Verification](FILE_UPLOAD_PREVENTION_GUIDE.md#multi-tenant-isolation)
   - Pattern: [FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md → Pattern 3](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md#pattern-3-tenant-scoped-file-management-with-database-tracking)

4. **✅ RATE LIMIT Uploads**
   - See: [FILE_UPLOAD_PREVENTION_GUIDE.md → Rate Limiting & Resource Protection](FILE_UPLOAD_PREVENTION_GUIDE.md#rate-limiting--resource-protection)
   - Pattern: [FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md → Pattern 4](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md#pattern-4-rate-limiting-for-uploads)

5. **✅ Use DEPENDENCY INJECTION (Not Singletons)**
   - See: [FILE_UPLOAD_PREVENTION_GUIDE.md → Dependency Injection](FILE_UPLOAD_PREVENTION_GUIDE.md#dependency-injection--architecture)
   - Pattern: [FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md → Pattern 1](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md#pattern-1-repository-based-storage-architecture)

6. **✅ Cleanup Files on Entity Delete**
   - See: [FILE_UPLOAD_PREVENTION_GUIDE.md → Lifecycle Management](FILE_UPLOAD_PREVENTION_GUIDE.md#lifecycle-management)
   - Pattern: [FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md → Pattern 3](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md#pattern-3-tenant-scoped-file-management-with-database-tracking)

7. **✅ Handle ERRORS Without Leaking Data**
   - See: [FILE_UPLOAD_PREVENTION_GUIDE.md → Error Handling & Observability](FILE_UPLOAD_PREVENTION_GUIDE.md#error-handling--observability)
   - Pattern: [FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md → Pattern 5](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md#pattern-5-proper-error-handling)

---

## Key Topics at a Glance

### Multi-Tenant Isolation

**Why it matters:** Prevents cross-tenant file access (critical security issue)

**Documents:**

- [FILE_UPLOAD_PREVENTION_GUIDE.md → Multi-Tenant Isolation Checklist](FILE_UPLOAD_PREVENTION_GUIDE.md#multi-tenant-isolation) (pre-dev)
- [FILE_UPLOAD_PREVENTION_GUIDE.md → Code Review: Multi-Tenant Isolation](FILE_UPLOAD_PREVENTION_GUIDE.md#multi-tenant-isolation-1) (review)
- [FILE_UPLOAD_PREVENTION_GUIDE.md → Multi-Tenant Isolation Tests](FILE_UPLOAD_PREVENTION_GUIDE.md#integration-tests-with-database) (testing)
- [FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md → Pattern 1 & 3](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md) (implementation)

### MIME Spoofing Prevention

**Why it matters:** Attackers can upload PNG files with .jpg extension

**Documents:**

- [FILE_UPLOAD_PREVENTION_GUIDE.md → File Content Validation](FILE_UPLOAD_PREVENTION_GUIDE.md#file-content-validation) (pre-dev)
- [FILE_UPLOAD_PREVENTION_GUIDE.md → Code Review: File Content Validation](FILE_UPLOAD_PREVENTION_GUIDE.md#file-content-validation-1) (review)
- [FILE_UPLOAD_PREVENTION_GUIDE.md → MIME Spoofing Prevention Tests](FILE_UPLOAD_PREVENTION_GUIDE.md#security-tests) (testing)
- [FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md → Pattern 2](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md#pattern-2-file-validation-with-magic-bytes) (implementation)
- [FILE_UPLOAD_QUICK_REFERENCE.md → Magic Byte Examples](FILE_UPLOAD_QUICK_REFERENCE.md#magic-byte-examples) (reference)

### Rate Limiting

**Why it matters:** Prevents denial of service and quota exhaustion attacks

**Documents:**

- [FILE_UPLOAD_PREVENTION_GUIDE.md → Rate Limiting & Resource Protection](FILE_UPLOAD_PREVENTION_GUIDE.md#rate-limiting--resource-protection) (pre-dev)
- [FILE_UPLOAD_PREVENTION_GUIDE.md → Code Review: Rate Limiting & Resource Protection](FILE_UPLOAD_PREVENTION_GUIDE.md#rate-limiting--resource-protection-1) (review)
- [FILE_UPLOAD_PREVENTION_GUIDE.md → Load Tests](FILE_UPLOAD_PREVENTION_GUIDE.md#load--performance-tests) (testing)
- [FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md → Pattern 4](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md#pattern-4-rate-limiting-for-uploads) (implementation)
- [FILE_UPLOAD_QUICK_REFERENCE.md → Rate Limit Settings](FILE_UPLOAD_QUICK_REFERENCE.md#rate-limit-settings) (reference)

### Error Handling

**Why it matters:** Proper error messages improve security and user experience

**Documents:**

- [FILE_UPLOAD_PREVENTION_GUIDE.md → Error Handling & Observability](FILE_UPLOAD_PREVENTION_GUIDE.md#error-handling--observability) (pre-dev)
- [FILE_UPLOAD_PREVENTION_GUIDE.md → Code Review: Error Handling](FILE_UPLOAD_PREVENTION_GUIDE.md#error-handling) (review)
- [FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md → Pattern 5](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md#pattern-5-proper-error-handling) (implementation)
- [FILE_UPLOAD_QUICK_REFERENCE.md → Common Mistakes](FILE_UPLOAD_QUICK_REFERENCE.md#common-mistakes) (reference)

---

## Vulnerability Matrix

| Vulnerability            | Prevention Guide                                                                    | Pattern                                                                                                            | Quick Ref     |
| ------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------- |
| Cross-tenant file access | [Multi-Tenant Isolation](FILE_UPLOAD_PREVENTION_GUIDE.md#multi-tenant-isolation)    | [Pattern 1 & 3](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md)                                                            | ✅ Rule 1 & 3 |
| MIME spoofing            | [File Content Validation](FILE_UPLOAD_PREVENTION_GUIDE.md#file-content-validation)  | [Pattern 2](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md#pattern-2-file-validation-with-magic-bytes)                     | ✅ Rule 2     |
| Orphaned files           | [Lifecycle Management](FILE_UPLOAD_PREVENTION_GUIDE.md#lifecycle-management)        | [Pattern 3](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md#pattern-3-tenant-scoped-file-management-with-database-tracking) | ✅ Rule 6     |
| Memory exhaustion        | [Rate Limiting](FILE_UPLOAD_PREVENTION_GUIDE.md#rate-limiting--resource-protection) | [Pattern 4](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md#pattern-4-rate-limiting-for-uploads)                            | ✅ Rule 4     |
| Architecture bypass      | [DI Pattern](FILE_UPLOAD_PREVENTION_GUIDE.md#dependency-injection--architecture)    | [Pattern 1](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md#pattern-1-repository-based-storage-architecture)                | ✅ Rule 5     |
| Information disclosure   | [Error Handling](FILE_UPLOAD_PREVENTION_GUIDE.md#error-handling--observability)     | [Pattern 5](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md#pattern-5-proper-error-handling)                                | ✅ Rule 7     |
| Code duplication         | [Service Layer](FILE_UPLOAD_PREVENTION_GUIDE.md#service-layer)                      | [Pattern 1 & 2](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md)                                                            | Red Flag #13  |

---

## Testing Coverage

### Unit Tests

- File size validation (under/over/exact limits)
- MIME type validation
- Magic byte detection
- Path traversal prevention
- Filename generation uniqueness
- Reference: [FILE_UPLOAD_PREVENTION_GUIDE.md → Unit Tests](FILE_UPLOAD_PREVENTION_GUIDE.md#unit-tests-uploadservice)

### Integration Tests

- File lifecycle (upload → use → delete)
- Cascade deletion
- Orphaned file detection
- Multi-tenant isolation
- Reference: [FILE_UPLOAD_PREVENTION_GUIDE.md → Integration Tests](FILE_UPLOAD_PREVENTION_GUIDE.md#integration-tests-with-database)

### E2E Tests

- Upload flow
- Error handling (oversized, invalid type)
- Preview display
- File removal
- Reference: [FILE_UPLOAD_PREVENTION_GUIDE.md → E2E Tests](FILE_UPLOAD_PREVENTION_GUIDE.md#e2e-tests-playwright)

### Security Tests

- MIME spoofing (PNG header + JPEG ext)
- ZIP files disguised as images
- SVG with script tags
- Path traversal attempts
- Reference: [FILE_UPLOAD_PREVENTION_GUIDE.md → Security Tests](FILE_UPLOAD_PREVENTION_GUIDE.md#security-tests)

### Load Tests

- Rate limiting enforcement
- Concurrent uploads
- Memory usage
- Reference: [FILE_UPLOAD_PREVENTION_GUIDE.md → Load & Performance Tests](FILE_UPLOAD_PREVENTION_GUIDE.md#load--performance-tests)

---

## Implementation Checklist

Copy this checklist for your implementation:

### Before Starting

- [ ] Read: Pre-Development Checklist
- [ ] Identify upload types and size limits
- [ ] Plan tenant scoping strategy
- [ ] Design file-to-entity linking
- [ ] Choose validation library (file-type)
- [ ] Plan rate limiting strategy
- [ ] Create test plan

### During Implementation

- [ ] Use DI pattern (Pattern 1)
- [ ] Create StorageRepository interface
- [ ] Implement Supabase adapter
- [ ] Implement Filesystem adapter
- [ ] Add magic byte validation (Pattern 2)
- [ ] Create database model with cascade (Pattern 3)
- [ ] Add rate limiting middleware (Pattern 4)
- [ ] Implement error handling (Pattern 5)
- [ ] Add comprehensive logging

### Code Review

- [ ] Run Red Flags Checklist
- [ ] Verify tenantId in all paths
- [ ] Check for magic byte validation
- [ ] Verify ownership before delete
- [ ] Check rate limiting
- [ ] Review error messages
- [ ] Verify tests pass

### Before Merge

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] E2E tests pass
- [ ] Security tests pass
- [ ] Load tests pass
- [ ] TypeScript compilation succeeds
- [ ] Code review approved

---

## Common Vulnerabilities & Fixes

| Vulnerability         | Red Flag # | Prevention Guide                                                                    | Fix                 |
| --------------------- | ---------- | ----------------------------------------------------------------------------------- | ------------------- |
| No tenantId in path   | 1          | [Multi-Tenant](FILE_UPLOAD_PREVENTION_GUIDE.md#multi-tenant-isolation-red-flags)    | Add tenantId prefix |
| MIME only validation  | 3          | [Content Validation](FILE_UPLOAD_PREVENTION_GUIDE.md#file-content-validation)       | Add magic bytes     |
| Public bucket         | 2          | [Bucket Config](FILE_UPLOAD_PREVENTION_GUIDE.md#bucket-configuration-review)        | Make private        |
| No ownership check    | 8          | [Ownership](FILE_UPLOAD_PREVENTION_GUIDE.md#multi-tenant-isolation-1)               | Query DB first      |
| User path in storage  | 5          | [Path Traversal](FILE_UPLOAD_PREVENTION_GUIDE.md#path-traversal-prevention)         | Use generated names |
| No rate limit         | 7          | [Rate Limiting](FILE_UPLOAD_PREVENTION_GUIDE.md#rate-limiting--resource-protection) | Add middleware      |
| Singleton import      | 11         | [DI Pattern](FILE_UPLOAD_PREVENTION_GUIDE.md#dependency-injection)                  | Inject instead      |
| Direct Supabase calls | 12         | [Service Layer](FILE_UPLOAD_PREVENTION_GUIDE.md#service-layer)                      | Go through service  |
| Duplicated logic      | 13         | [DRY Violation](FILE_UPLOAD_PREVENTION_GUIDE.md#code-organization)                  | Extract to service  |
| No cleanup on delete  | 18         | [Lifecycle](FILE_UPLOAD_PREVENTION_GUIDE.md#lifecycle-management)                   | Cascade delete      |

---

## References

### Internal References

- **CLAUDE.md** - Project patterns and commands
- **ARCHITECTURE.md** - System design principles
- **DEVELOPING.md** - Development workflow
- **upload.service.ts** - Current implementation
- **upload.service.test.ts** - Test examples
- **ImageUploadField.tsx** - Frontend component
- **tenant-admin.routes.ts** - Route definitions

### External References

- [Supabase Storage Security](https://supabase.com/docs/guides/storage/security)
- [OWASP File Upload Security](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)
- [file-type npm package](https://www.npmjs.com/package/file-type)
- [rate-limit npm package](https://www.npmjs.com/package/express-rate-limit)
- [Multer documentation](https://expressjs.com/en/resources/middleware/multer.html)

---

## Support

### Need Help?

1. **"I don't know where to start"**
   - Read: [Pre-Development Checklist](FILE_UPLOAD_PREVENTION_GUIDE.md#1-pre-development-checklist)
   - Pattern: [FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md)

2. **"I found a security issue"**
   - Check: [Red Flags](FILE_UPLOAD_PREVENTION_GUIDE.md#5-red-flags)
   - Fix: [Implementation Patterns](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md)

3. **"My code is failing review"**
   - Use: [Code Review Checklist](FILE_UPLOAD_PREVENTION_GUIDE.md#2-code-review-checklist)
   - Fix: [Common Mistakes](FILE_UPLOAD_PREVENTION_GUIDE.md#6-common-implementation-mistakes)

4. **"Upload is broken in production"**
   - SOS: [Emergency Issues](FILE_UPLOAD_QUICK_REFERENCE.md#sos-emergency-issues)
   - Debug: [Red Flags](FILE_UPLOAD_PREVENTION_GUIDE.md#5-red-flags)

5. **"I'm optimizing performance"**
   - Pattern: [Pattern 4: Rate Limiting](FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md#pattern-4-rate-limiting-for-uploads)
   - Test: [Load Tests](FILE_UPLOAD_PREVENTION_GUIDE.md#load--performance-tests)

---

**Last Updated:** November 2025
**Status:** Complete & Reviewed
**Owner:** Engineering Team
**Version:** 1.0
