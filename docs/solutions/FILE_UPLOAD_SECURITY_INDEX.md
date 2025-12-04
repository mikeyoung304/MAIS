# File Upload Security - Complete Index

**Master guide to file upload security in MAIS**

---

## Quick Navigation

### For Different Roles

**🏃 I'm in a rush** (5 minutes)
→ Read **FILE_UPLOAD_QUICK_REFERENCE.md** (print and pin it!)

**👨‍💼 I'm reviewing code** (15 minutes)
→ Read the "Code Review Checklist" in **FILE_UPLOAD_PREVENTION_STRATEGIES.md**

**🏗️ I'm designing a feature** (30 minutes)
→ Read **FILE_UPLOAD_PREVENTION_STRATEGIES.md** (full guide)

**👷 I'm implementing uploads** (1 hour)
→ Read **FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md** + **FILE_UPLOAD_ARCHITECTURE_PATTERNS.md**

**🔐 I'm doing security audit** (2 hours)
→ Read all documents in order below

---

## Document Overview

### 1. FILE_UPLOAD_QUICK_REFERENCE.md

**Type:** Cheat Sheet | **Length:** 5 min | **Format:** Tables + Code snippets

**What's Inside:**

- The 7 Critical Rules (memorize these!)
- Red Flags Checklist (what NOT to do)
- File Size Limits
- Magic Byte Examples
- Testing Checklist
- Emergency SOS (quota exceeded, orphaned files, stuck uploads)

**When to Use:**

- Print and pin to desk
- Reference during code review
- Remind yourself of best practices
- Debug upload issues

---

### 2. FILE_UPLOAD_PREVENTION_STRATEGIES.md

**Type:** Comprehensive Guide | **Length:** 45 min | **Format:** Scenarios + Test Cases

**What's Inside:**

- **3 Major Vulnerabilities:**
  1. MIME Type Spoofing (execution attacks)
  2. Cross-Tenant Data Leak (privacy breach)
  3. Orphaned Files (quota exhaustion)

- **For Each Vulnerability:**
  - Problem description
  - Prevention rules (with code examples)
  - Test cases to add
  - Implementation checklist

- **Code Review Checklist** - Questions to ask in reviews
- **Red Flags** - Visual table of what's wrong and how to fix
- **Security Testing Scenarios** - Real attack simulations

**When to Use:**

- Planning file upload features
- Understanding what went wrong
- Writing test cases
- Code review preparation
- Security audit

---

### 3. FILE_UPLOAD_ARCHITECTURE_PATTERNS.md

**Type:** Advanced Guide | **Length:** 30 min | **Format:** Patterns + Code

**What's Inside:**

- **8 Architectural Patterns:**
  1. Dual-Mode Storage (mock vs. real)
  2. Dependency Injection for testability
  3. Transaction-Based Cleanup
  4. Lazy Orphan Cleanup (background jobs)
  5. Multi-Layer Validation (defense in depth)
  6. Supabase Bucket Configuration
  7. Monitoring & Observability
  8. Rate Limiting Strategy

**When to Use:**

- Designing new upload features
- Understanding current architecture
- Debugging complex scenarios
- Optimizing performance
- Planning infrastructure

---

### 4. FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md

**Type:** Implementation Guide | **Length:** 1 hour | **Format:** Walkthroughs + Code

**What's Inside:**

- Full upload flow walkthrough
- Request/response examples
- Database schema requirements
- Error handling patterns
- Frontend integration examples

**When to Use:**

- First time implementing uploads
- Understanding current implementation
- Adding new upload endpoints
- Integrating frontend to backend

---

## The Three Vulnerabilities Explained

### Vulnerability 1: MIME Type Spoofing

**What:** Attacker uploads PHP shell disguised as JPEG

**Why It's Bad:** Server executes malicious code

**How to Fix:**

1. Validate file content (magic bytes), not just header
2. Use `file-type` library to detect actual format
3. Reject if detected type ≠ declared type
4. Special handling for text-based formats (SVG)

**Read:** FILE_UPLOAD_PREVENTION_STRATEGIES.md → Prevention Strategy 1

---

### Vulnerability 2: Cross-Tenant Data Leak

**What:** One tenant accesses another's files via guessed URL

**Why It's Bad:** Privacy breach, compliance violation

**How to Fix:**

1. Use private Supabase bucket
2. Include tenantId in storage path
3. Generate signed URLs for access
4. Verify tenant ownership before deletion
5. Log all cross-tenant attempts

**Read:** FILE_UPLOAD_PREVENTION_STRATEGIES.md → Prevention Strategy 2

---

### Vulnerability 3: Orphaned Files

**What:** Files remain in storage after database deletion

**Why It's Bad:** Quota exhaustion, wasted storage

**How to Fix:**

1. Delete files before entity deletion
2. Wrap cleanup in try-catch (don't block deletion)
3. Run periodic cleanup job for discovered orphans
4. Log cleanup failures

**Read:** FILE_UPLOAD_PREVENTION_STRATEGIES.md → Prevention Strategy 3

---

## File Upload Feature Checklist

### Pre-Development

- [ ] Review FILE_UPLOAD_PREVENTION_STRATEGIES.md
- [ ] Document allowed file types
- [ ] Plan tenant isolation strategy
- [ ] Plan cleanup strategy

### Implementation

- [ ] Use UploadService (don't call Supabase directly)
- [ ] Validate with magic bytes
- [ ] Include tenantId in storage path
- [ ] Add cleanup on entity deletion
- [ ] Handle errors gracefully

### Testing

- [ ] Unit tests for validation (magic bytes)
- [ ] Integration tests for cleanup
- [ ] Security tests (MIME spoofing, cross-tenant)
- [ ] E2E tests for full flow
- [ ] Load tests for concurrent uploads

### Code Review

- [ ] Check magic byte validation
- [ ] Check tenantId in storage path
- [ ] Check cleanup logic
- [ ] Check error handling
- [ ] Check test coverage

### Deployment

- [ ] Verify Supabase bucket is private
- [ ] Verify RLS is enabled
- [ ] Test with real storage
- [ ] Setup monitoring & alerting
- [ ] Document cleanup job schedule

---

## Command Reference

### Running Tests

```bash
# All upload tests
npm test -- upload.service.test.ts

# Specific test
npm test -- upload.service.test.ts --grep "MIME Type Spoofing"

# With coverage
npm test -- upload.service.test.ts --coverage

# E2E tests
npm run test:e2e -- upload.spec.ts
```

### Development

```bash
# Start in mock mode
ADAPTERS_PRESET=mock npm run dev:api

# Start in real mode
ADAPTERS_PRESET=real npm run dev:api
```

---

## FAQ

**Q: How do I prevent MIME spoofing?**
A: Use magic byte validation with `file-type` library, not Content-Type header. See FILE_UPLOAD_PREVENTION_STRATEGIES.md → Prevention Strategy 1

**Q: How do I ensure tenant isolation?**
A: (1) Include tenantId in path, (2) Use private Supabase bucket, (3) Generate signed URLs, (4) Verify ownership before delete. See Prevention Strategy 2.

**Q: What if storage is down during deletion?**
A: Deletion succeeds in database, cleanup runs later. Don't let cleanup failures block entity deletion. See Pattern 3 & 4.

**Q: Can I use public URLs for files?**
A: No. Use private bucket + signed URLs. Public URLs allow anyone to guess and access files. See Prevention Strategy 2.

**Q: What's the file size limit?**
A: Logo: 2MB, Package photo/Segment image: 5MB. Set at both multer config AND service validation. See FILE_UPLOAD_QUICK_REFERENCE.md

---

## Related Files in Repository

### Implementation Reference

- `server/src/services/upload.service.ts` - Main upload service
- `server/test/services/upload.service.test.ts` - Comprehensive tests
- `client/src/components/ImageUploadField.tsx` - Frontend component

### Configuration

- `server/src/middleware/rateLimiter.ts` - Rate limiting
- `server/src/app.ts` - Multer configuration

---

## Version History

| Date         | Version | Status               |
| ------------ | ------- | -------------------- |
| Nov 29, 2025 | 1.0     | Ready for Production |

**Created:** November 29, 2025
**Status:** Ready for Production
**Owner:** Engineering Team
