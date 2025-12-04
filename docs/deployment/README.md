# Deployment & CI/CD Documentation

This directory contains comprehensive guides for deployment, CI/CD configuration, and prevention strategies for common failures.

## Quick Start

**New to deployments?** Start here:

1. Read `CI_CD_QUICK_REFERENCE.md` for common fixes
2. Run `npm run doctor` to validate your environment
3. Check `ENVIRONMENT_VARIABLES.md` for required configuration

**Deploying to production?**

1. Review `GITHUB_SECRETS_SETUP.md` to ensure all secrets are configured
2. Run `scripts/ci-preflight-check.sh` to validate CI/CD setup
3. Follow the checklist in `PRODUCTION_DEPLOYMENT_CHECKLIST.md`

## Documentation Files

### Essential Reading (30 minutes)

**`CI_CD_QUICK_REFERENCE.md`** (Best for quick fixes)

- Common error messages and solutions
- Pre-deployment checklist
- Quick reference for environment variables
- Troubleshooting workflow

**`ENVIRONMENT_VARIABLES.md`** (Best for configuration)

- Complete reference matrix of all variables
- Per-job requirements for CI/CD
- Environment-specific configuration
- Validation checklist and troubleshooting

### Deep Dive (1-2 hours)

**`CI_CD_FAILURE_PREVENTION.md`** (Best for understanding root causes)

- Documented failures and root causes
- Prevention strategies for each issue
- Best practices for CI/CD
- Test cases for validation
- Implementation roadmap

**`GITHUB_SECRETS_SETUP.md`** (Best for secrets management)

- Step-by-step secret configuration
- How to obtain values from providers (Stripe, Vercel, etc.)
- Secret validation checklist
- Secret rotation schedule and procedure
- Troubleshooting guide

### Operations (Reference)

**`PRODUCTION_DEPLOYMENT_CHECKLIST.md`**

- Pre-deployment validation steps
- Deployment procedures
- Post-deployment verification
- Rollback procedures
- Communication templates

**`VERCEL_BUILD_PREVENTION_GUIDE.md`**

- Vercel-specific build issues
- Root cause analysis
- Prevention strategies

---

## Key Failure Prevention Strategies

### 1. ESLint Configuration Issues

**Problem:** Strict TypeScript linting fails in CI but not locally.

**Prevention:**

- Generate types before linting: `npm run typecheck -- --noEmit`
- Set up workspace-specific ESLint configs
- Clear cache before linting: `rm -rf .eslintcache`

**Documentation:** See `CI_CD_FAILURE_PREVENTION.md` Part 2 Strategy 1

### 2. Missing DIRECT_URL

**Problem:** Prisma migrations fail with "could not find DIRECT_URL"

**Prevention:**

- Always set both `DATABASE_URL` and `DIRECT_URL` in CI jobs
- Use Supabase pooler URL for DATABASE_URL, direct URL for DIRECT_URL
- Document in ENVIRONMENT_VARIABLES.md

**Documentation:** See `CI_CD_FAILURE_PREVENTION.md` Part 2 Strategy 2

### 3. Environment Variable Documentation Gaps

**Problem:** Required variables missing from CI/secrets configuration

**Prevention:**

- Maintain ENVIRONMENT_VARIABLES.md as single source of truth
- Use doctor script to validate variables
- Add pre-commit hooks to check documentation

**Documentation:** See `CI_CD_FAILURE_PREVENTION.md` Part 2 Strategy 3

### 4. Pre-Deployment Validation Gaps

**Problem:** Deployments fail due to missing configuration

**Prevention:**

- Run `scripts/ci-preflight-check.sh` before deployment
- Use doctor script: `npm run doctor`
- Test locally before pushing: `npm run build --workspaces`

**Documentation:** See `CI_CD_FAILURE_PREVENTION.md` Part 2 Strategy 4

---

## Tools & Scripts

### Doctor Script

Validates environment variables per ADAPTERS_PRESET mode:

```bash
npm run doctor
```

**Usage:**

- Run before starting development
- Run in pre-commit hooks
- Validates TIER 1 variables always
- Validates TIER 2 variables in real mode

### CI Preflight Check

Validates entire CI/CD configuration before deployment:

```bash
./scripts/ci-preflight-check.sh
```

**Checks:**

- ESLint configuration
- Prisma schema setup
- Environment documentation
- GitHub Actions workflows
- Secret configuration
- Best practices

### CI Validation Tests

Automated tests for CI/CD configuration:

```bash
npm test -- tests/ci/ci-validation.test.ts
```

**Validates:**

- ESLint strict mode enabled
- DIRECT_URL in schema and workflows
- Required documentation exists
- No hardcoded secrets
- Type safety enabled

---

## Environment Variable Categories

### Tier 1: Core (Always Required)

```
JWT_SECRET
TENANT_SECRETS_ENCRYPTION_KEY
DATABASE_URL
DIRECT_URL (required for migrations)
ADAPTERS_PRESET
```

### Tier 2: Production-Critical

```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
POSTMARK_SERVER_TOKEN
```

### Tier 3: Optional (Graceful Fallbacks)

```
GOOGLE_CALENDAR_ID
POSTMARK_FROM_EMAIL
```

**See:** `ENVIRONMENT_VARIABLES.md` for complete details

---

## Common Failures & Quick Fixes

| Error                             | Solution                                            | Docs                        |
| --------------------------------- | --------------------------------------------------- | --------------------------- |
| "could not find DIRECT_URL"       | Add DIRECT_URL env var to migration steps           | CI_CD_QUICK_REFERENCE.md    |
| "ESLint errors in CI only"        | Generate types before linting                       | CI_CD_QUICK_REFERENCE.md    |
| "Missing environment variable"    | Add to .env.example, doc, doctor.ts, GitHub secrets | ENVIRONMENT_VARIABLES.md    |
| "Prisma Client not found"         | Run `npm run --workspace=server prisma:generate`    | CI_CD_FAILURE_PREVENTION.md |
| "Deployment bypasses lint checks" | Remove `continue-on-error: true`                    | CI_CD_QUICK_REFERENCE.md    |

---

## Implementation Roadmap

### Phase 1: Documentation (Week 1)

- [x] Create `CI_CD_FAILURE_PREVENTION.md`
- [x] Create `ENVIRONMENT_VARIABLES.md`
- [x] Create `GITHUB_SECRETS_SETUP.md`
- [x] Create `CI_CD_QUICK_REFERENCE.md`

### Phase 2: Scripts (Week 1)

- [x] Create `scripts/ci-preflight-check.sh`
- [x] Update `server/scripts/doctor.ts` with DIRECT_URL check
- [ ] Add doctor script to husky pre-commit hooks

### Phase 3: Configuration (Week 1-2)

- [ ] Create `server/.eslintrc.cjs` workspace override
- [ ] Create `client/.eslintrc.cjs` workspace override
- [ ] Update root `.eslintrc.cjs` with tsconfig references
- [ ] Update `main-pipeline.yml` migration job (add DIRECT_URL)
- [ ] Fix `deploy-production.yml` lint bypass

### Phase 4: Testing (Week 2)

- [x] Create `tests/ci/ci-validation.test.ts`
- [ ] Run test suite to validate configuration
- [ ] Fix any identified issues

### Phase 5: Integration (Week 2)

- [ ] Add pre-commit hook to run doctor script
- [ ] Add pre-push hook to run ci-preflight-check.sh
- [ ] Update CONTRIBUTING.md with checklist
- [ ] Update CLAUDE.md with references

---

## References

### Related Documentation

- `/CLAUDE.md` - Project setup and patterns
- `/CONTRIBUTING.md` - Contributing guidelines
- `/ARCHITECTURE.md` - System architecture
- `/.github/workflows/` - CI/CD workflows

### External Resources

- [Prisma: Direct URL](https://www.prisma.io/docs/concepts/components/prisma-client/connection-strings#direct-connection-to-the-database)
- [Supabase: Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [GitHub Actions: Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [TypeScript: Strict Mode](https://www.typescriptlang.org/tsconfig#strict)

---

## Support & Contributing

### Getting Help

1. **Quick issue?** Check `CI_CD_QUICK_REFERENCE.md`
2. **Need detailed info?** See relevant doc file
3. **Configuration issue?** Run `npm run doctor`
4. **Setup issue?** Run `scripts/ci-preflight-check.sh`

### Contributing Updates

Found an issue or have a suggestion?

1. Document the issue in `ISSUES.md` (if not already documented)
2. Update relevant doc file with fix
3. Update implementation roadmap
4. Test changes against actual CI/CD workflows
5. Update this README with new findings

### Feedback

This documentation was created based on actual CI/CD failures in production. If you encounter new issues:

1. Document root cause
2. Add to `CI_CD_FAILURE_PREVENTION.md`
3. Create prevention strategy
4. Add to appropriate quick reference
5. Submit as PR or issue

---

## Quick Links

**Most Used:**

- Run doctor: `npm run doctor`
- Pre-flight check: `./scripts/ci-preflight-check.sh`
- View environment vars: `docs/deployment/ENVIRONMENT_VARIABLES.md`
- Quick fixes: `docs/deployment/CI_CD_QUICK_REFERENCE.md`

**Configuration:**

- Main pipeline: `.github/workflows/main-pipeline.yml`
- Production deployment: `.github/workflows/deploy-production.yml`
- ESLint config: `.eslintrc.cjs`
- Prisma schema: `server/prisma/schema.prisma`

**Commands:**

```bash
npm run doctor                               # Validate environment
scripts/ci-preflight-check.sh               # Validate CI/CD setup
npm run typecheck                           # Type checking
npm run lint                                # Linting
npm run test                                # Tests
npm run build --workspaces                  # Build all packages
```

---

## Last Updated

Created: November 26, 2025 (Sprint 10)
Status: Actively maintained
Version: 1.0.0

For latest information, check commit history and related documentation.
