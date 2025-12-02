# ADR-010: Git History Rewrite for Secret Removal

**Date:** 2025-10-29
**Status:** Accepted (Implementation Pending)
**Decision Makers:** Security Team + Engineering Team
**Category:** Security
**Related Issues:** Phase 2B - Security Hardening

## Context

During development, several secrets were accidentally committed to git history:
- `JWT_SECRET` (default value in `.env.example`)
- Stripe test keys (in commit messages and code comments)
- Supabase database credentials (in early setup commits)

While these are test/development secrets, having them in git history poses security risks:
- Attackers could use old secrets if they weren't rotated
- Public GitHub repository would expose secrets to everyone
- Compliance requirements may mandate secret removal

**Current Risk Assessment:**
- **JWT_SECRET:** Low risk (default value, should be changed in production anyway)
- **Stripe keys:** Medium risk (test mode keys, but could be used maliciously)
- **Database credentials:** High risk (production database exposed)

## Decision

We have decided to **rewrite git history** to remove all exposed secrets using `git filter-repo`.

**Rationale:**
- Secrets in git history are permanent unless history is rewritten
- Even if secrets are rotated, old secrets remain accessible in history
- Best practice is to treat git history as if it's public (assume breach)
- One-time cleanup now prevents future security audits from flagging these issues

**Implementation Plan:**

```bash
# 1. Backup repository
git clone --mirror . ../mais-backup

# 2. Install git-filter-repo
pip install git-filter-repo

# 3. Create file with secrets to remove
cat > secrets-to-remove.txt <<EOF
JWT_SECRET_VALUE_HERE
sk_test_STRIPE_KEY_HERE
postgresql://postgres:PASSWORD@db.supabase.co
EOF

# 4. Run filter-repo to remove secrets
git filter-repo --replace-text secrets-to-remove.txt

# 5. Force push to remote (WARNING: Rewrites history)
git push --force --all origin
git push --force --tags origin

# 6. Notify team to re-clone repository
# 7. Rotate all affected secrets immediately
```

## Consequences

**Positive:**
- **Security:** Secrets permanently removed from git history
- **Compliance:** Meets security audit requirements
- **Peace of mind:** No risk of secret exposure from old commits
- **Best practice:** Aligns with industry standards for secret management

**Negative:**
- **Disruptive:** All developers must re-clone repository
- **PR breakage:** Open pull requests will need to be recreated
- **Commit SHAs change:** All commit references in docs must be updated
- **Risk of data loss:** If backup fails, history could be corrupted
- **Coordination required:** Must notify all team members before rewrite

**Risks:**
- Developers who don't re-clone will have divergent history
- CI/CD pipelines may break if they cache git objects
- Submodules or git-based dependencies may break

## Alternatives Considered

### Alternative 1: Secret Rotation Only (No History Rewrite)

**Approach:** Rotate all exposed secrets, leave history unchanged.

**Why Rejected:**
- Secrets remain in git history permanently
- Security audits will still flag exposed secrets
- Public repository would expose all historical secrets
- Doesn't meet security best practices

**When Appropriate:**
- If repository is private and will never be public
- If exposed secrets are truly test-only with no real access
- If team size/coordination makes history rewrite too risky

### Alternative 2: Create New Repository

**Approach:** Create fresh repository, copy current codebase (no history).

**Why Rejected:**
- Loses all commit history and authorship information
- Loses all git-based project management (issues, PRs)
- Requires updating all documentation and references
- More disruptive than history rewrite

### Alternative 3: Git-Secrets Tool (Preventive Only)

**Approach:** Install git-secrets pre-commit hook, prevent future commits of secrets.

**Why This Isn't Enough:**
- Doesn't remove historical secrets
- Only prevents future commits
- We will implement this IN ADDITION to history rewrite

## Implementation Details

**Timeline:**
- Week 1: Rotate all exposed secrets
- Week 2: Backup repository, test history rewrite on backup
- Week 3: Coordinate with team, perform history rewrite
- Week 4: Verify all team members have re-cloned

**Communication Plan:**
1. Send email to all team members 1 week before rewrite
2. Post Slack notification with step-by-step re-clone instructions
3. Schedule team meeting to answer questions
4. Create REWRITE-GUIDE.md with detailed instructions

**Backup Strategy:**
- Create full mirror backup: `git clone --mirror`
- Store backup on external drive + cloud storage
- Keep backup for 90 days after rewrite

**Rollback Plan:**
If history rewrite causes critical issues:
1. Restore from backup: `git clone ../mais-backup/.git .`
2. Force push backup to remote
3. Notify team to re-clone again
4. Investigate what went wrong

## Post-Rewrite Actions

**Immediate (Day 1):**
- Rotate all secrets immediately after history rewrite
- Update environment variables in all environments
- Verify application still works with new secrets

**Short-term (Week 1):**
- Install git-secrets pre-commit hook
- Add secrets scanning to CI/CD pipeline
- Update documentation with new commit SHAs

**Long-term (Ongoing):**
- Quarterly secret rotation schedule
- Regular security audits
- Developer training on secret management

## References

- GitHub Docs: [Removing Sensitive Data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- Git Filter-Repo: [Documentation](https://github.com/newren/git-filter-repo)
- OWASP: [Secret Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

## Related ADRs

- None (standalone security decision)
