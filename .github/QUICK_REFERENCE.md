# CI/CD Quick Reference Card

Fast reference guide for MAIS developers working with GitHub Actions workflows.

## 🚀 Common Commands

```bash
# Run tests locally before pushing
npm run lint                    # ESLint
npm run format:check            # Prettier
npm run typecheck               # TypeScript
npm run test:unit               # Unit tests
npm run test:integration        # Integration tests (requires DB)
npm run test:e2e                # E2E tests (requires API running)

# Build all packages
npm run build --workspaces --if-present

# Database operations
cd server
npm exec prisma migrate dev --name migration_name
npm exec prisma generate
npm exec prisma studio
```

## 🔄 Git Workflow

```bash
# Feature development
git checkout -b feature/your-feature
# ... make changes ...
git add .
git commit -m "feat: add your feature"
git push origin feature/your-feature
# Create PR on GitHub

# Deploy to staging
git checkout develop
git merge feature/your-feature
git push origin develop
# Auto-deploys to staging

# Deploy to production
git checkout main
git merge develop
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin main
git push origin v1.2.3
# Deploys to production (requires approval)
```

## ✅ PR Checklist

Before creating a PR:

- [ ] Code passes `npm run lint`
- [ ] Code passes `npm run typecheck`
- [ ] All tests pass (`npm test`)
- [ ] Added tests for new features
- [ ] Updated documentation
- [ ] Meaningful commit message
- [ ] No secrets in code/env files

## 📊 Workflow Status

Check workflow status:

1. Go to **Actions** tab in GitHub
2. See running/completed workflows
3. Click workflow for details
4. Download artifacts if needed

## 🔍 Debugging Failed Workflows

### Lint/Format Failures

```bash
# Fix locally
npm run lint          # See errors
npm run format        # Auto-fix
git add .
git commit -m "style: fix linting"
git push
```

### Test Failures

```bash
# Run tests locally
npm run test:unit -- --reporter=verbose
npm run test:integration

# Check specific test
npm test -- test/path/to/test.spec.ts

# Fix and push
git add .
git commit -m "fix: resolve test failures"
git push
```

### Build Failures

```bash
# Build locally
npm run build --workspaces --if-present

# Check for type errors
npm run typecheck

# Fix and push
```

## 🎯 Deployment Environments

| Environment    | Branch  | URL              | Auto-Deploy          |
| -------------- | ------- | ---------------- | -------------------- |
| **Staging**    | develop | staging.mais.app | ✅ Yes               |
| **Production** | main    | mais.app         | ⚠️ Requires approval |

## 🔐 Environment Variables

**Never commit:**

- `.env` files
- API keys
- Database passwords
- JWT secrets

**Use instead:**

- GitHub Secrets (for CI/CD)
- `.env.example` (for documentation)
- Local `.env` (gitignored)

## 📱 Quick Actions

### Re-run Failed Workflow

1. Actions tab → Failed workflow
2. Click "Re-run failed jobs"
3. Or "Re-run all jobs"

### Cancel Running Workflow

1. Actions tab → Running workflow
2. Click "Cancel workflow"

### Manual Deploy

1. Actions tab → deploy-staging or deploy-production
2. Click "Run workflow"
3. Select branch
4. Configure options
5. Click "Run workflow"

## 🆘 Emergency Procedures

### Rollback Production

```bash
# Via Vercel
vercel rollback https://mais.app

# Via Render
# Dashboard → Service → Rollback to previous deploy
```

### Hotfix Deploy

```bash
git checkout -b hotfix/critical-bug main
# ... fix bug ...
git add .
git commit -m "fix: critical security issue"
git push origin hotfix/critical-bug
# Create PR to main
# Use skip_tests option ONLY if necessary
```

### Secret Leaked

```bash
# 1. Immediately rotate secret
gh secret set SECRET_NAME

# 2. Delete workflow run with leaked secret
# Actions → Workflow run → Delete

# 3. Notify team
```

## 📞 Getting Help

| Issue                   | Resource                                        |
| ----------------------- | ----------------------------------------------- |
| **Workflow errors**     | `.github/WORKFLOWS_README.md` → Troubleshooting |
| **Secret management**   | `.github/SECRETS_TEMPLATE.md`                   |
| **Database migrations** | Workflow: database-maintenance.yml              |
| **Deployment issues**   | Check Render/Vercel dashboards                  |
| **General questions**   | Create GitHub Issue                             |

## 🎓 Learning Resources

**Essential Reading (30 min):**

1. `.github/WORKFLOWS_README.md` - Workflow overview
2. `CLAUDE.md` - Project setup
3. This file - Quick reference

**For Deep Dive (2-3 hours):**

1. `.github/workflows/*.yml` - Actual workflow files
2. `docs/TESTING.md` - Testing strategy
3. `docs/operations/PRODUCTION_DEPLOYMENT_GUIDE.md`

## 💡 Pro Tips

**Speed up CI:**

- Keep PRs small (<300 lines)
- Write focused commits
- Run tests locally first
- Use `npm run format` before committing

**Avoid failures:**

- Use pre-commit hooks (husky)
- Check `npm run typecheck` often
- Test migrations locally first
- Don't skip CI checks

**Database migrations:**

- Always test on staging first
- Name migrations descriptively
- Include rollback plan
- Coordinate with team

**Deployment best practices:**

- Deploy during low-traffic hours
- Monitor logs after deploy
- Have rollback plan ready
- Communicate with team

## 📋 Workflow Triggers

| Workflow              | Triggered By       | Duration   |
| --------------------- | ------------------ | ---------- |
| **PR Validation**     | Pull requests      | ~8-12 min  |
| **Deploy Staging**    | Push to develop    | ~15-20 min |
| **Deploy Production** | Push to main, tags | ~20-30 min |
| **Cache Warmup**      | Daily 2 AM UTC     | ~10-15 min |
| **DB Maintenance**    | Manual only        | Varies     |

## 🔧 Useful Aliases

Add to your shell config:

```bash
# Git
alias gci='git add . && git commit'
alias gpu='git push -u origin HEAD'

# MAIS project
alias mais-test='npm run lint && npm run typecheck && npm test'
alias mais-build='npm run build --workspaces --if-present'
alias mais-deploy-staging='git checkout develop && git pull && git merge - && git push'

# Database
alias db-studio='cd server && npm exec prisma studio'
alias db-migrate='cd server && npm exec prisma migrate dev'
alias db-generate='cd server && npm exec prisma generate'
```

## 📖 Commit Message Format

Use conventional commits:

```bash
# Format: <type>(<scope>): <subject>

# Types:
feat:     # New feature
fix:      # Bug fix
docs:     # Documentation
style:    # Formatting, missing semicolons
refactor: # Code restructuring
test:     # Adding tests
chore:    # Maintenance

# Examples:
git commit -m "feat(api): add package photo upload"
git commit -m "fix(auth): resolve JWT expiration bug"
git commit -m "docs: update CI/CD documentation"
git commit -m "test: add unit tests for booking service"
```

## 🎯 Goals & Metrics

**Current Sprint:**

- Test pass rate: 60% → 70%
- Coverage: >80%
- CI time: <15 min

**Your Contribution:**

- Write tests for new code
- Fix failing tests
- Improve coverage
- Keep PRs green

---

**Keep this handy!** Bookmark this file for quick reference.

**Version:** 1.0.0
**Updated:** 2025-11-19
