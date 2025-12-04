# Test Templates - Navigation Index

Welcome to the Elope Test Templates! This directory contains comprehensive templates and documentation for writing tests in the Elope project.

## Quick Start

**New to the templates?** Start here:

1. Read [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - 2 minute overview
2. Pick a template and copy it to your test location
3. Replace placeholders (search for `[` brackets)
4. Run your tests with `npm test`

**Need examples?** See [PATTERNS.md](./PATTERNS.md) for copy-paste patterns.

**Want full details?** Read [README.md](./README.md) for comprehensive documentation.

---

## File Guide

### 📚 Documentation Files (Read These)

| File                                       | Size      | Purpose                 | When to Use                       |
| ------------------------------------------ | --------- | ----------------------- | --------------------------------- |
| [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) | 8KB       | Quick lookup reference  | When you need a quick reminder    |
| [PATTERNS.md](./PATTERNS.md)               | 20KB      | Common pattern examples | When you need copy-paste examples |
| [README.md](./README.md)                   | 24KB      | Complete documentation  | When you need detailed guidance   |
| [INDEX.md](./INDEX.md)                     | This file | Navigation guide        | When you're lost                  |

### 📝 Template Files (Copy These)

| Template                                                     | Size | Lines | Use For                      | Features                                        |
| ------------------------------------------------------------ | ---- | ----- | ---------------------------- | ----------------------------------------------- |
| [service.test.template.ts](./service.test.template.ts)       | 20KB | 566   | Service layer business logic | CRUD, validation, error handling, multi-tenancy |
| [repository.test.template.ts](./repository.test.template.ts) | 24KB | 649   | Data access layer            | CRUD, concurrency, queries, constraints         |
| [controller.test.template.ts](./controller.test.template.ts) | 24KB | 702   | HTTP endpoints               | REST API, auth, validation, status codes        |
| [webhook.test.template.ts](./webhook.test.template.ts)       | 28KB | 818   | Webhook handlers             | Signatures, idempotency, event validation       |

**Total:** 148KB of templates and documentation

---

## Usage Flowchart

```
Start
  │
  ├─→ Need quick reference?
  │     └─→ Read QUICK_REFERENCE.md
  │
  ├─→ Need code examples?
  │     └─→ Read PATTERNS.md
  │
  ├─→ Need full documentation?
  │     └─→ Read README.md
  │
  └─→ Ready to write tests?
        │
        ├─→ Testing service logic?
        │     └─→ Copy service.test.template.ts
        │
        ├─→ Testing data access?
        │     └─→ Copy repository.test.template.ts
        │
        ├─→ Testing HTTP endpoints?
        │     └─→ Copy controller.test.template.ts
        │
        └─→ Testing webhooks?
              └─→ Copy webhook.test.template.ts
```

---

## Common Tasks

### I Want To...

**Write a service test:**

```bash
cp server/test/templates/service.test.template.ts server/test/my-service.spec.ts
# Edit file, replace [ServiceName], [Repository], [Entity]
npm test -- my-service.spec.ts
```

**Write a repository test:**

```bash
cp server/test/templates/repository.test.template.ts server/test/repositories/my-repo.spec.ts
# Edit file, replace [RepositoryName], [Entity]
npm test -- my-repo.spec.ts
```

**Write an HTTP endpoint test:**

```bash
cp server/test/templates/controller.test.template.ts server/test/http/my-endpoint.test.ts
# Edit file, replace [resource]
npm test -- my-endpoint.test.ts
```

**Write a webhook test:**

```bash
cp server/test/templates/webhook.test.template.ts server/test/controllers/my-webhook.spec.ts
# Edit file, replace [WebhookName], [EventType]
npm test -- my-webhook.spec.ts
```

**See examples of a specific pattern:**

```bash
# Open PATTERNS.md and search for the pattern name
# Examples: "Multi-Tenancy", "Error Testing", "Async", "HTTP Testing"
```

**Understand the testing philosophy:**

```bash
# Read README.md sections:
# - Overview
# - Common Patterns
# - Best Practices
```

---

## Template Selection Guide

### Choose Your Template

| What You're Testing              | Template to Use             | Key Features                  |
| -------------------------------- | --------------------------- | ----------------------------- |
| `BookingService.createBooking()` | service.test.template.ts    | Business logic, validation    |
| `BookingRepository.create()`     | repository.test.template.ts | Data persistence, concurrency |
| `POST /v1/bookings`              | controller.test.template.ts | HTTP contracts, auth          |
| Stripe checkout webhook          | webhook.test.template.ts    | Event processing, idempotency |

### Template Complexity

```
Simple   ───────────────────────────────────────→   Complex

service.test.template.ts (566 lines)
    │
    ├─→ Basic CRUD operations
    ├─→ Validation patterns
    └─→ Error handling

repository.test.template.ts (649 lines)
    │
    ├─→ All of service template +
    ├─→ Concurrency tests
    └─→ Query methods

controller.test.template.ts (702 lines)
    │
    ├─→ HTTP request/response
    ├─→ Authentication
    ├─→ Status codes
    └─→ Content negotiation

webhook.test.template.ts (818 lines)
    │
    ├─→ All patterns +
    ├─→ Signature verification
    ├─→ Idempotency
    └─→ Event processing
```

---

## Learning Path

### Beginner Path (30 minutes)

1. Read [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - 5 min
2. Copy [service.test.template.ts](./service.test.template.ts) - 2 min
3. Replace placeholders - 10 min
4. Run tests - 2 min
5. Fix errors using [README.md](./README.md) Troubleshooting - 10 min

### Intermediate Path (1 hour)

1. Read [PATTERNS.md](./PATTERNS.md) - 15 min
2. Copy appropriate template - 2 min
3. Customize for your use case - 20 min
4. Add additional test cases - 15 min
5. Review coverage - 5 min

### Advanced Path (2 hours)

1. Read full [README.md](./README.md) - 30 min
2. Review existing project tests - 30 min
3. Create comprehensive test suite - 45 min
4. Optimize and refactor - 15 min

---

## Examples by Technology

### Vitest (Unit/Integration)

- **Service tests:** [service.test.template.ts](./service.test.template.ts)
- **Repository tests:** [repository.test.template.ts](./repository.test.template.ts)
- **Webhook tests:** [webhook.test.template.ts](./webhook.test.template.ts)

### Supertest (HTTP)

- **Endpoint tests:** [controller.test.template.ts](./controller.test.template.ts)

### Multi-Tenancy

- **All templates** include multi-tenancy patterns
- See [PATTERNS.md#multi-tenancy-patterns](./PATTERNS.md#multi-tenancy-patterns)

### Fake Repositories

- **All unit tests** use fake repositories
- Builders: `buildBooking()`, `buildPackage()`, `buildAddOn()`
- Location: `server/test/helpers/fakes.ts`

---

## Key Concepts

### The Three Testing Layers

```
┌─────────────────────────────────────────┐
│   HTTP Layer (Controller Tests)         │
│   - Supertest                           │
│   - Full HTTP request/response          │
│   - Authentication & authorization      │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│   Business Logic (Service Tests)        │
│   - Vitest                              │
│   - Fake repositories                   │
│   - Business rules & validation         │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│   Data Access (Repository Tests)        │
│   - Vitest                              │
│   - Data persistence                    │
│   - Concurrency & constraints           │
└─────────────────────────────────────────┘
```

### Test Isolation

```
✓ Good: Each test is independent
   beforeEach(() => {
     repository = new FakeRepository();
     service = new Service(repository);
   });

✗ Bad: Tests share state
   beforeAll(() => {
     repository = new FakeRepository();
     service = new Service(repository);
   });
```

### Multi-Tenancy Pattern

```
✓ Good: Always pass tenantId
   await service.getAll('test-tenant');
   await repository.create('test-tenant', entity);

✗ Bad: Missing tenantId
   await service.getAll();
   await repository.create(entity);
```

---

## Troubleshooting Quick Links

| Issue                           | Solution Link                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| "tenantId is required"          | [README.md#troubleshooting](./README.md#issue-tests-fail-with-tenantid-is-required) |
| Tests interfere with each other | [README.md#troubleshooting](./README.md#issue-tests-interfere-with-each-other)      |
| Async tests timing out          | [README.md#troubleshooting](./README.md#issue-async-tests-timing-out)               |
| Mock not being called           | [README.md#troubleshooting](./README.md#issue-mock-not-being-called)                |
| HTTP tests return 404           | [README.md#troubleshooting](./README.md#issue-http-tests-return-404)                |

---

## Project Structure

```
server/test/
├── templates/                          ← You are here
│   ├── INDEX.md                       ← This file
│   ├── QUICK_REFERENCE.md            ← Quick lookup (2 min read)
│   ├── PATTERNS.md                   ← Code examples (10 min read)
│   ├── README.md                     ← Full docs (30 min read)
│   ├── service.test.template.ts      ← Service template
│   ├── repository.test.template.ts   ← Repository template
│   ├── controller.test.template.ts   ← HTTP template
│   └── webhook.test.template.ts      ← Webhook template
├── helpers/
│   └── fakes.ts                      ← Builder functions & fakes
├── repositories/                      ← Repository tests
├── http/                             ← HTTP endpoint tests
├── controllers/                       ← Controller tests
└── [service-name].spec.ts            ← Service tests
```

---

## Statistics

### Template Coverage

- **Total Templates:** 4
- **Total Lines of Code:** 2,735 lines
- **Total Documentation:** 1,912 lines (README + guides)
- **Pattern Examples:** 50+
- **Test Scenarios:** 200+

### What's Included

| Category            | Count | Details                                  |
| ------------------- | ----- | ---------------------------------------- |
| Templates           | 4     | Service, Repository, Controller, Webhook |
| Documentation Files | 4     | README, Quick Ref, Patterns, Index       |
| Pattern Examples    | 50+   | Copy-paste ready                         |
| Test Scenarios      | 200+  | Covering all common cases                |
| Error Patterns      | 30+   | Validation, NotFound, Conflict, etc.     |
| Multi-Tenancy Tests | All   | Every template includes tenant isolation |

---

## Getting Help

1. **Quick question?** → [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
2. **Need an example?** → [PATTERNS.md](./PATTERNS.md)
3. **Detailed info?** → [README.md](./README.md)
4. **Still stuck?** → Check existing tests in `server/test/`
5. **Really stuck?** → Ask the team

---

## Version Info

- **Created:** 2025-11-14
- **Last Updated:** 2025-11-14
- **Templates Version:** 1.0.0
- **Tested With:** Vitest 1.x, Node 18+

---

## Next Steps

Choose your path:

1. 🚀 **Quick Start** → [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
2. 📖 **Learn Patterns** → [PATTERNS.md](./PATTERNS.md)
3. 📚 **Deep Dive** → [README.md](./README.md)
4. 💻 **Start Coding** → Copy a template and start testing!

Happy testing! 🎯
