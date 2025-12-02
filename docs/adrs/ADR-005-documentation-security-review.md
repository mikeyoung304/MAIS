# ADR-005: Documentation Security Review Process

**Status**: Accepted
**Date**: 2025-11-12
**Last Updated**: 2025-11-12
**Deciders**: Tech Lead, Security Lead, Documentation Systems Specialist
**Related**: ADR-004 (Archive Strategy), Security Best Practices, GDPR Compliance

---

## Context

MAIS's documentation contains sensitive information but lacks systematic security review, resulting in credential exposures that persist for weeks or months before discovery.

### The Security Documentation Problem

**Incident 1: Password Exposure (Critical)**

During the strategic documentation audit (November 2025), analysis revealed:
- Passwords exposed in documentation files (referenced in audit findings)
- Exposure duration: Weeks (potentially months)
- Discovery method: Manual audit (not automated detection)
- Root cause: No security review process for documentation

**Typical Exposure Pattern**:
```
Developer creates quick troubleshooting doc:
"To fix the database issue, connect with:
 Host: prod-db.example.com
 User: admin
 Password: MyP@ssw0rd123"

File committed to git → pushed to remote → password now in git history forever
```

**Scale of Risk**:
- 248 documentation files (any could contain secrets)
- 30+ contributors over project lifetime (variable security awareness)
- No automated scanning (secrets can persist indefinitely)
- Git history retention (exposed secrets remain in history even if removed from HEAD)

### Current State: No Documentation Security Process

**Documentation Creation Flow (Current)**:
```
Developer writes doc → git add → git commit → git push → merged
                                                          ↓
                                                    No security check
                                                    No secret scanning
                                                    No review for sensitive data
```

**Problems**:
1. **No security checklist**: Developers don't consider security when writing docs
2. **No automated scanning**: Secrets not detected until manual audit (rare)
3. **No review requirement**: Documentation PRs can merge without security review
4. **No education**: Developers unaware of documentation security risks
5. **No remediation process**: When secrets found, no clear procedure for rotation

### Common Documentation Security Vulnerabilities

**1. Credentials and API Keys**
```markdown
# Setup Guide

Configure Stripe with:
- API Key: sk_live_51234567890abcdef
- Webhook Secret: whsec_1234567890abcdef

Connect to database:
- Connection String: postgresql://user:password@host:5432/db
```

**2. Internal Infrastructure Details**
```markdown
# Deployment Guide

Production servers:
- Web: 10.0.1.15 (SSH key: ~/.ssh/prod_rsa)
- Database: 10.0.1.20 (Root password in 1Password)
- Redis: 10.0.1.30 (No auth, internal only)
```

**3. Customer/User Data**
```markdown
# Bug Investigation

Reproduced with user email: customer@example.com
Session ID: abc123def456
API tokens: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**4. Security Vulnerabilities**
```markdown
# Known Issues

TEMPORARY FIX: Disabled CORS for /api/admin endpoint
TODO: Re-enable auth check on /internal/debug route
BUG: XSS vulnerability in comment rendering (CVE pending)
```

**5. Business-Sensitive Information**
```markdown
# Sprint 6 Plan

Revenue target: $500K MRR by Q1
Customer churn: 15% (industry: 5%)
Pricing strategy: Undercut competitor X by 20%
```

### Comparative Evidence: Rebuild 6.0 Security Process

Rebuild 6.0 implements **mandatory security review** for all documentation:

1. **Pre-commit hook**: Scans for common secret patterns
2. **PR checklist**: Security review required for documentation changes
3. **Automated CI check**: Runs gitleaks on all documentation files
4. **Security training**: 30-minute onboarding on documentation security
5. **Quarterly audit**: Manual review of all documentation for sensitive content

**Result**: Zero credential exposures in 18+ months, 4 secrets caught by automation before merge.

### Regulatory and Compliance Context

**GDPR Requirements**:
- Personal data in documentation = "processing personal data"
- Requires data minimization (don't collect/store unnecessary personal data)
- Requires security measures (protect personal data from unauthorized access)
- Violations: Up to 4% annual revenue or €20M fine (whichever is greater)

**SOC 2 / ISO 27001 Requirements**:
- Access controls on sensitive information
- Audit trail of who accessed sensitive data
- Incident response process for data exposures
- Regular security reviews and audits

**Industry Standards**:
- OWASP: "Sensitive data exposure" is #3 in Top 10 vulnerabilities
- CWE-798: "Use of Hard-coded Credentials" is critical weakness
- NIST: Documentation should undergo same security review as code

---

## Decision

**Implement mandatory security review process for all documentation**, with automated scanning, manual review checklist, and incident response procedures.

### Security Review Process: 3-Layer Defense

#### Layer 1: Automated Secret Detection (Pre-Commit)

**Tool**: gitleaks (open-source secret scanner)

**Installation**:
```bash
# Install gitleaks
brew install gitleaks  # macOS
# OR
go install github.com/zricethezav/gitleaks/v8@latest

# Configure pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Run gitleaks on staged files

echo "Running gitleaks secret scan..."
gitleaks protect --staged --verbose

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ SECURITY: Potential secrets detected!"
    echo "   Review the findings above and remove sensitive data."
    echo "   If false positive, add to .gitleaksignore"
    exit 1
fi

echo "✅ No secrets detected"
EOF

chmod +x .git/hooks/pre-commit
```

**Configuration**: `.gitleaks.toml`
```toml
title = "MAIS gitleaks config"

# Detect common secrets
[[rules]]
id = "generic-api-key"
description = "Generic API Key"
regex = '''(?i)(api[_-]?key|apikey)['\"]?\s*[:=]\s*['"]?[0-9a-zA-Z]{32,}'''
tags = ["key", "API"]

[[rules]]
id = "password"
description = "Password in documentation"
regex = '''(?i)(password|passwd|pwd)['\"]?\s*[:=]\s*['"]?[^\s'"]{8,}'''
tags = ["password"]

[[rules]]
id = "jwt"
description = "JSON Web Token"
regex = '''eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*'''
tags = ["jwt", "token"]

[[rules]]
id = "aws-access-key"
description = "AWS Access Key"
regex = '''AKIA[0-9A-Z]{16}'''
tags = ["aws", "key"]

[[rules]]
id = "stripe-key"
description = "Stripe API Key"
regex = '''(sk|pk)_(live|test)_[0-9a-zA-Z]{24,}'''
tags = ["stripe", "key"]

[[rules]]
id = "connection-string"
description = "Database connection string with password"
regex = '''(?i)(postgres|mysql|mongodb)://[^:]+:[^@]+@'''
tags = ["database", "connection-string"]

[allowlist]
paths = [
    ".gitleaksignore",
    ".env.example",
    "docs/reference/api/authentication.md"  # Example API keys only
]
```

**Coverage**:
- API keys (AWS, Stripe, generic)
- Passwords and connection strings
- JWT tokens
- Private keys (SSH, TLS)
- OAuth tokens
- Database credentials

**Performance**: <2 seconds on commit (scans only staged files)

#### Layer 2: Manual Security Checklist (PR Review)

**PR Template**: `.github/PULL_REQUEST_TEMPLATE.md`

Add security section:

```markdown
## Documentation Security Review

If this PR includes documentation changes, complete this checklist:

### Sensitive Data Check (REQUIRED)
- [ ] No passwords, API keys, or credentials included
- [ ] No connection strings with embedded passwords
- [ ] No internal IP addresses or infrastructure details
- [ ] No customer/user personal data (emails, names, etc.)
- [ ] No security vulnerabilities disclosed (report via security policy instead)
- [ ] No business-sensitive information (revenue, pricing, strategy)

### Example Data Validation
- [ ] All example data is clearly fictional (use example.com, test accounts)
- [ ] Example API keys use placeholder format (sk_test_EXAMPLE_KEY_NOT_REAL)
- [ ] Example passwords use obvious placeholders (your-password-here)

### Compliance Check
- [ ] GDPR: No unnecessary personal data collected in examples
- [ ] Security: No information that could aid attackers
- [ ] Legal: No confidential business information disclosed

### If Sensitive Data Required
- [ ] Documented why sensitive data is necessary
- [ ] Added to .gitleaksignore with justification comment
- [ ] Scheduled for rotation/removal (add calendar reminder)
- [ ] Notified security team via #security Slack channel

**Reviewer**: I have reviewed this PR for documentation security ✅
```

**Enforcement**:
- PR cannot merge without checklist completion
- Code review must include security review
- Security team notified of any exceptions

#### Layer 3: Automated CI Scanning (GitHub Actions)

**Workflow**: `.github/workflows/documentation-security.yml`

```yaml
name: Documentation Security Scan

on:
  pull_request:
    paths:
      - 'docs/**'
      - '*.md'
      - '.claude/**'
  push:
    branches:
      - main
    paths:
      - 'docs/**'
      - '*.md'

jobs:
  gitleaks:
    name: Scan for secrets
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0  # Full history for comprehensive scan

      - name: Run gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}  # Optional

      - name: Report findings
        if: failure()
        run: |
          echo "::error::Secrets detected in documentation!"
          echo "Review gitleaks report above and remove sensitive data."
          exit 1

  sensitive-patterns:
    name: Check for sensitive patterns
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Check for common sensitive patterns
        run: |
          # Check for email addresses (potential PII)
          if grep -r -E '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b' \
             docs/ --include="*.md" | grep -v "example.com" | grep -v "@anthropic.com"; then
            echo "::warning::Real email addresses found in documentation (use example.com)"
          fi

          # Check for IP addresses
          if grep -r -E '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' \
             docs/ --include="*.md" | grep -v "127.0.0.1" | grep -v "0.0.0.0"; then
            echo "::warning::IP addresses found in documentation (potential infrastructure exposure)"
          fi

          # Check for TODO security notes
          if grep -r -i "TODO.*security\|FIXME.*auth\|HACK.*bypass" \
             docs/ --include="*.md"; then
            echo "::error::Security TODOs found in documentation (file security issues privately)"
            exit 1
          fi

  documentation-review:
    name: Verify security checklist
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v3

      - name: Check PR description for security checklist
        uses: actions/github-script@v6
        with:
          script: |
            const pr = context.payload.pull_request;
            const body = pr.body || '';

            // Check if documentation security checklist is present
            if (body.includes('## Documentation Security Review')) {
              console.log('✅ Security checklist found in PR description');
            } else {
              core.setFailed('❌ Documentation Security Review checklist missing from PR description');
            }

            // Check if sensitive data checkboxes are marked
            const checks = [
              'No passwords, API keys, or credentials included',
              'No connection strings with embedded passwords',
              'No internal IP addresses or infrastructure details'
            ];

            for (const check of checks) {
              if (!body.includes(`- [x] ${check}`) && !body.includes(`- [X] ${check}`)) {
                core.warning(`Security check not completed: "${check}"`);
              }
            }
```

**CI Checks**:
1. **gitleaks scan**: Comprehensive secret detection
2. **Pattern matching**: Email addresses, IP addresses, security TODOs
3. **Checklist validation**: Ensures PR template security section completed

**Failure Actions**:
- Block PR merge if secrets detected
- Warn on potential sensitive patterns
- Require checklist completion

### Incident Response: When Secrets Are Found

**1. Immediate Actions (Within 1 Hour)**

```bash
# Step 1: Verify the exposure
git log -p -- <file> | grep -C 5 <secret-pattern>

# Step 2: Rotate the credential immediately
# - Change password
# - Regenerate API key
# - Revoke access token
# - Update production configuration

# Step 3: Remove from current version
git rm <file>  # OR
# Edit file to remove secret, then:
git add <file>
git commit -m "security: Remove exposed credential from documentation"
```

**2. Git History Cleanup (Within 24 Hours)**

**WARNING**: History rewriting requires coordination and force-push.

```bash
# Option 1: BFG Repo-Cleaner (recommended)
# Download from https://rtyley.github.io/bfg-repo-cleaner/
java -jar bfg.jar --replace-text passwords.txt repo.git
cd repo.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Option 2: git filter-branch
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch <file>" \
  --prune-empty --tag-name-filter cat -- --all

# Option 3: git filter-repo (fastest)
git filter-repo --invert-paths --path <file>

# Force push (coordinate with team!)
git push origin --force --all
git push origin --force --tags
```

**3. Post-Incident Actions (Within 1 Week)**

1. **Security incident report**:
   - What was exposed?
   - How long was it exposed?
   - Who had access?
   - What was rotated?

2. **Team notification**:
   - Alert via Slack #security channel
   - Document in incident log
   - Schedule team postmortem

3. **Process improvement**:
   - Why did scanning miss this?
   - Update gitleaks patterns if needed
   - Add to security training examples

### Security Training and Education

**New Developer Onboarding (30 Minutes)**

**Module 1: Documentation Security Risks (10 min)**
- Real incident examples (anonymized)
- Impact of credential exposure
- Regulatory requirements (GDPR, SOC 2)

**Module 2: What Not to Document (10 min)**
- Credentials and API keys
- Infrastructure details
- Customer data
- Security vulnerabilities
- Business secrets

**Module 3: Safe Documentation Practices (10 min)**
- Use example.com, test accounts
- Placeholder credentials (your-password-here)
- Redaction techniques (user-****@example.com)
- When to use internal wiki vs public docs

**Training Materials**:
- Recorded video (can watch asynchronously)
- Interactive quiz (must pass 80%)
- Quick reference card (printed/digital)

**Quarterly Refresher** (15 minutes):
- Recent incidents and lessons learned
- New security patterns to avoid
- Tool updates (gitleaks, CI checks)

### Security Categories and Guidelines

| Category | Examples | Allowed in Docs? | Guidelines |
|----------|----------|------------------|------------|
| **Credentials** | Passwords, API keys, tokens | ❌ Never | Use placeholders: `your-api-key-here` |
| **Infrastructure** | IP addresses, hostnames | ⚠️ Rarely | Use examples: `10.0.1.x`, `prod-server.internal` |
| **Customer Data** | Emails, names, IDs | ❌ Never | Use synthetic: `user-****@example.com` |
| **Security Issues** | Vulnerabilities, exploits | ❌ Never | Report via security policy, not docs |
| **Business Secrets** | Revenue, pricing, strategy | ⚠️ Internal only | Mark as confidential, restrict access |
| **Debug Info** | Stack traces, logs | ⚠️ Sanitized | Redact sensitive data before including |
| **Example Code** | Sample requests/responses | ✅ Yes | Use test mode, fictional data |
| **Architecture** | System design, patterns | ✅ Yes | Document architecture, not secrets |

---

## Rationale

### Why Mandatory Security Review?

**Cost of Prevention vs Remediation**:

**Prevention** (ADR-005):
- Pre-commit hook: 2 seconds per commit
- PR security checklist: 2 minutes per PR
- CI scanning: 3 minutes per PR
- Security training: 30 minutes per developer (one-time)
- **Total cost per PR**: ~5 minutes

**Remediation** (exposed secret):
- Discover exposure: 0-90 days (often found during audits)
- Rotate credential: 30 minutes
- Clean git history: 2-4 hours (force push coordination)
- Security incident report: 1-2 hours
- Team notification: 30 minutes
- Regulatory reporting (if PII): 4-8 hours
- **Total cost per incident**: 8-15 hours + compliance risk

**Break-even**: Prevent 2 incidents per year → save 10+ hours + eliminate compliance risk.

### Why Automated + Manual Review?

**Automation Alone (Insufficient)**:
```
✅ Catches: Known patterns (API keys, passwords, tokens)
❌ Misses: Business secrets, customer data, security issues
❌ Misses: Context-dependent sensitivity (internal IPs)
❌ High false positive rate: Requires manual triage
```

**Manual Review Alone (Insufficient)**:
```
✅ Catches: Context-dependent sensitivity
✅ Catches: Business secrets, strategic information
❌ Misses: Easily overlooked patterns (base64-encoded secrets)
❌ Human error: Reviewers may not notice subtle exposures
❌ Inconsistent: Depends on reviewer security awareness
```

**Automated + Manual (Defense in Depth)**:
```
✅ Automation catches 90% of technical secrets
✅ Manual review catches 90% of contextual sensitivity
✅ Combined: 99% detection rate
✅ Low false negative rate (secrets rarely slip through)
```

**Justification**: Two-layer defense provides comprehensive coverage without excessive overhead.

### Why gitleaks (Not Custom Scripts)?

**Advantages**:
✅ **Battle-tested**: Used by thousands of organizations (GitHub, GitLab, etc.)
✅ **Comprehensive**: 100+ built-in patterns for common secrets
✅ **Low false positives**: Well-tuned patterns with whitelist support
✅ **Fast**: Optimized for large repositories (<5 seconds typical scan)
✅ **Maintained**: Active development, new patterns added regularly
✅ **CI integration**: GitHub Actions, GitLab CI, Jenkins plugins available
✅ **Free**: Open-source, no licensing costs

**Alternatives Considered**:

**Alternative 1: truffleHog**
- ✅ Good secret detection
- ❌ Slower than gitleaks (entropy-based scanning)
- ❌ Higher false positive rate

**Alternative 2: detect-secrets (Yelp)**
- ✅ Good Python integration
- ❌ Fewer built-in patterns
- ❌ Less active maintenance

**Alternative 3: Custom regex scripts**
- ✅ Full control
- ❌ Requires maintenance (new patterns, false positives)
- ❌ Not battle-tested (will miss edge cases)
- ❌ Reinventing the wheel

**Verdict**: gitleaks provides best balance of accuracy, performance, and maintainability.

---

## Alternatives Considered

### Alternative 1: Manual Review Only (No Automation)

**Description**: Rely solely on PR reviewers to spot sensitive data

**Pros**:
- No tooling setup (zero implementation cost)
- Human context understanding (catches business secrets)
- Flexible (no false positives from automation)

**Cons**:
- ❌ Human error (reviewers miss subtle exposures)
- ❌ Inconsistent (depends on reviewer security awareness)
- ❌ Doesn't scale (high review burden as team grows)
- ❌ No historical scan (can't detect secrets in existing docs)

**Why Rejected**: Manual review alone missed password exposure that persisted for weeks. Automation provides consistent baseline protection.

### Alternative 2: Automated Scanning Only (No Manual Review)

**Description**: Rely solely on gitleaks and CI checks

**Pros**:
- Consistent (same checks for every commit)
- Fast (automated, no human time)
- Comprehensive (scans entire history)

**Cons**:
- ❌ Misses context-dependent sensitivity (business secrets, internal IPs)
- ❌ False positives require manual triage anyway
- ❌ Can't catch "this looks suspicious" patterns
- ❌ No education component (developers don't learn why)

**Why Rejected**: Automation catches technical secrets but misses contextual sensitivity. Manual review provides necessary second layer.

### Alternative 3: Post-Commit Scanning Only (No Pre-Commit)

**Description**: Run scans in CI only, not as pre-commit hook

**Pros**:
- Doesn't slow down local development
- Centralized scanning (same environment for everyone)
- Can scan entire repository regularly

**Cons**:
- ❌ Secrets reach remote repository (even briefly)
- ❌ Requires force-push cleanup (disruptive)
- ❌ Developers discover issues late (after commit)
- ❌ Secrets in git history (even if quickly removed)

**Why Rejected**: Pre-commit prevention better than post-commit remediation. Secrets should never reach remote repository.

### Alternative 4: Quarterly Audits Only (No Per-PR Review)

**Description**: Manual security audit of all documentation quarterly

**Pros**:
- Low overhead (4x per year vs every PR)
- Deep review (dedicated time for thorough analysis)
- Catches accumulated issues

**Cons**:
- ❌ Secrets exposed for months before discovery
- ❌ Large cleanup effort (90 days of documents to review)
- ❌ No prevention (only detection after the fact)
- ❌ Doesn't build security habits (no per-PR awareness)

**Why Rejected**: Quarterly audits valuable as third layer, but can't replace per-PR prevention. Secrets should be caught before merge, not months later.

### Alternative 5: Status Quo (No Process)

**Description**: Continue current practice, rely on developer awareness

**Pros**:
- Zero implementation cost
- No process overhead
- Maximum developer flexibility

**Cons**:
- ❌ Already failed (password exposure persisted for weeks)
- ❌ Compliance risk (GDPR, SOC 2 violations)
- ❌ Security incidents (credential exposure enables attacks)
- ❌ No systematic prevention (relies on individual vigilance)

**Why Rejected**: Status quo is unacceptable. Security incidents have real consequences (compliance fines, security breaches, customer trust loss).

---

## Consequences

### Positive Consequences

✅ **Prevents credential exposure**: 90%+ of secrets caught before merge
✅ **Compliance protection**: GDPR/SOC 2 audit-ready documentation practices
✅ **Fast detection**: Pre-commit hook catches secrets in 2 seconds (vs weeks of exposure)
✅ **Historical scanning**: CI scans detect secrets in existing documentation
✅ **Education**: Security checklist teaches developers what to avoid
✅ **Audit trail**: Git history shows security review completion
✅ **Low overhead**: 5 minutes per PR (vs 10+ hours remediating exposure)
✅ **Industry-standard tools**: gitleaks used by thousands of organizations
✅ **Incident response**: Clear procedure when secrets discovered
✅ **Cultural shift**: Security becomes part of documentation workflow

### Negative Consequences

⚠️ **False positives**: gitleaks may flag non-sensitive patterns
- **Impact**: Developer adds to .gitleaksignore, documents justification
- **Mitigation**: Well-tuned gitleaks config reduces false positive rate to <5%
- **Effort**: ~1 minute to review and whitelist false positive

⚠️ **Commit friction**: Pre-commit hook adds 2 seconds to every commit
- **Impact**: Minimal (2 seconds vs 0 seconds)
- **Mitigation**: Can skip with --no-verify in emergency (discouraged)
- **Trade-off**: 2 seconds per commit prevents hours of remediation

⚠️ **PR checklist overhead**: Security section adds 2 minutes to PR creation
- **Impact**: 2 minutes per documentation PR
- **Mitigation**: Becomes routine after 2-3 PRs (muscle memory)
- **Benefit**: Forces developers to think about security (education)

⚠️ **Learning curve**: Developers must learn what to avoid in docs
- **Impact**: 30-minute security training required
- **Mitigation**: Training recorded (watch anytime), quiz validates understanding
- **Long-term benefit**: Security awareness reduces incidents across codebase

⚠️ **Git history cleanup complexity**: Force-push required if secret in history
- **Risk**: Disruptive to team (requires coordination)
- **Mitigation**: Prevention reduces need for cleanup (secrets caught pre-commit)
- **Fallback**: BFG Repo-Cleaner simplifies history rewriting

### Neutral Consequences

- Some legitimate documentation needs exceptions (documented in .gitleaksignore)
- Security training becomes part of onboarding (30 minutes added)
- Quarterly security audits become recurring practice
- Security team involved in documentation reviews (cross-functional collaboration)

---

## Implementation

### Phase 1: Tool Setup (Week 1, Day 1-2)

**1. Install gitleaks**:
```bash
# Install gitleaks (choose one)
brew install gitleaks                    # macOS
apt-get install gitleaks                 # Linux
go install github.com/zricethezav/gitleaks/v8@latest  # Go

# Verify installation
gitleaks version
```

**2. Create gitleaks configuration**:
```bash
# Copy from ADR-005 (above)
cat > .gitleaks.toml << 'EOF'
# (paste gitleaks config from above)
EOF

# Test on current repository
gitleaks detect --verbose
```

**3. Setup pre-commit hook**:
```bash
# Copy from ADR-005 (above)
cat > .git/hooks/pre-commit << 'EOF'
# (paste pre-commit hook from above)
EOF

chmod +x .git/hooks/pre-commit

# Test
touch test-secret.md
echo "password: MySecret123" > test-secret.md
git add test-secret.md
git commit -m "test"  # Should fail
rm test-secret.md
```

**4. Distribute to team**:
```bash
# Copy pre-commit hook to shared location
cp .git/hooks/pre-commit scripts/install-git-hooks.sh

# Document in README
echo "Run \`./scripts/install-git-hooks.sh\` after clone" >> README.md
```

**Success Criteria**:
- [x] ADR-005 written and accepted
- [ ] gitleaks installed and configured
- [ ] Pre-commit hook tested and working
- [ ] Installation script created for team

### Phase 2: CI Integration (Week 1, Day 3-4)

**1. Create GitHub Actions workflow**:
```bash
mkdir -p .github/workflows
cat > .github/workflows/documentation-security.yml << 'EOF'
# (paste workflow from above)
EOF
```

**2. Test workflow**:
```bash
# Create test PR with secret
git checkout -b test-security-scan
echo "apikey: abc123def456" > test-doc.md
git add test-doc.md
git commit -m "test: Security scan test"
git push origin test-security-scan

# Create PR, verify CI fails
# Delete test branch after verification
```

**3. Configure branch protection**:
```
GitHub repo settings → Branches → Add rule for `main`:
- [x] Require status checks to pass before merging
- [x] Require branches to be up to date before merging
- Select: "Scan for secrets", "Check for sensitive patterns"
```

**Success Criteria**:
- [ ] GitHub Actions workflow created
- [ ] CI scans tested on test PR
- [ ] Branch protection configured
- [ ] Test PR demonstrates failure on secret detection

### Phase 3: PR Template Update (Week 1, Day 5)

**1. Update PR template**:
```bash
# Add security section to existing template
# or create new template if doesn't exist
cat >> .github/PULL_REQUEST_TEMPLATE.md << 'EOF'

## Documentation Security Review

If this PR includes documentation changes, complete this checklist:

### Sensitive Data Check (REQUIRED)
- [ ] No passwords, API keys, or credentials included
- [ ] No connection strings with embedded passwords
- [ ] No internal IP addresses or infrastructure details
- [ ] No customer/user personal data (emails, names, etc.)
- [ ] No security vulnerabilities disclosed (report via security policy instead)
- [ ] No business-sensitive information (revenue, pricing, strategy)

### Example Data Validation
- [ ] All example data is clearly fictional (use example.com, test accounts)
- [ ] Example API keys use placeholder format (sk_test_EXAMPLE_KEY_NOT_REAL)
- [ ] Example passwords use obvious placeholders (your-password-here)

### Compliance Check
- [ ] GDPR: No unnecessary personal data collected in examples
- [ ] Security: No information that could aid attackers
- [ ] Legal: No confidential business information disclosed

### If Sensitive Data Required
- [ ] Documented why sensitive data is necessary
- [ ] Added to .gitleaksignore with justification comment
- [ ] Scheduled for rotation/removal (add calendar reminder)
- [ ] Notified security team via #security Slack channel

**Reviewer**: I have reviewed this PR for documentation security ✅
EOF
```

**2. Test PR template**:
```bash
# Create test PR, verify template includes security section
git checkout -b test-pr-template
echo "# Test" > test-doc.md
git add test-doc.md
git commit -m "test: PR template test"
git push origin test-pr-template
# Create PR, verify security section appears
```

**Success Criteria**:
- [ ] PR template updated with security section
- [ ] Template tested on new PR
- [ ] Team notified of new PR requirements

### Phase 4: Security Training (Week 2)

**1. Create training materials**:

**Slide deck**: `docs/security/documentation-security-training.md`
```markdown
# Documentation Security Training

## Why Documentation Security Matters
- Real incident: Password exposed for weeks
- Impact: Credential compromise, compliance risk
- Cost: 10+ hours remediation vs 5 minutes prevention

## What Not to Document
❌ Credentials (passwords, API keys, tokens)
❌ Infrastructure (IP addresses, hostnames)
❌ Customer data (emails, names, session IDs)
❌ Security issues (vulnerabilities, exploits)
❌ Business secrets (revenue, pricing, strategy)

## Safe Documentation Practices
✅ Use example.com, fictional data
✅ Placeholders: your-password-here, EXAMPLE_API_KEY
✅ Redaction: user-****@example.com
✅ Test mode: sk_test_*, pk_test_*

## Tools and Process
- Pre-commit hook: gitleaks scans every commit (2 sec)
- PR checklist: Security review required
- CI scanning: Automated checks on every PR
- If found: Rotate immediately, clean git history

## Quiz
1. Can I include a real customer email in documentation? [Y/N]
2. How should I document an API key example? [answer]
3. What should I do if I find a password in docs? [answer]
```

**2. Record training video**:
- 15-minute walkthrough of slide deck
- Live demo: gitleaks catching a secret
- Upload to internal wiki or YouTube (unlisted)

**3. Create quiz**:
```markdown
# Documentation Security Quiz

1. Which of these is safe to include in documentation?
   a) Production database password
   b) Example API key: sk_test_EXAMPLE_NOT_REAL
   c) Real customer email address
   d) Internal server IP address

2. What should you do if gitleaks flags a false positive?
   a) Disable gitleaks
   b) Commit with --no-verify
   c) Add to .gitleaksignore with justification
   d) Ignore it

3. Where should you report a security vulnerability found during testing?
   a) In documentation
   b) Via security policy (security@company.com)
   c) In sprint retrospective
   d) In Slack #engineering

4. What's the maximum time a secret should remain exposed?
   a) Never (catch in pre-commit)
   b) 1 hour (rotate immediately when found)
   c) 1 day (weekly reviews)
   d) 1 month (quarterly audits)

Answers: 1-b, 2-c, 3-b, 4-a/b (both acceptable)
Passing: 3/4 correct (75%)
```

**4. Schedule onboarding**:
- Add to new developer onboarding checklist
- 30 minutes: Watch video + take quiz
- Quarterly: 15-minute refresher (new incidents, tool updates)

**Success Criteria**:
- [ ] Training materials created (slides, video, quiz)
- [ ] Training added to onboarding checklist
- [ ] All current team members complete training
- [ ] Quarterly refresher scheduled (calendar reminder)

### Phase 5: Incident Response Documentation (Week 2)

**1. Create incident response runbook**:

`docs/security/secret-exposure-response.md`:
```markdown
# Secret Exposure Incident Response

## Severity Levels

**Critical** (API keys, passwords, tokens):
- Response time: Immediate (within 1 hour)
- Escalation: Security team, engineering lead
- Actions: Rotate, clean history, incident report

**High** (Infrastructure details, internal IPs):
- Response time: Same day (within 8 hours)
- Escalation: Security team
- Actions: Remove from docs, assess exposure

**Medium** (Business data, customer emails):
- Response time: Within 24 hours
- Escalation: Team lead
- Actions: Remove, notify if GDPR applies

## Response Procedure

### Step 1: Immediate Actions (Within 1 Hour)
1. Verify exposure: Check what was exposed and for how long
2. Rotate credential: Change password, regenerate key, revoke token
3. Update production: Deploy new credential to production
4. Notify security team: Slack #security channel

### Step 2: Git History Cleanup (Within 24 Hours)
1. Remove from current version: git rm or edit file
2. Clean history: Use BFG Repo-Cleaner or git filter-repo
3. Force push: Coordinate with team (disruptive)
4. Verify: Scan repository again with gitleaks

### Step 3: Post-Incident (Within 1 Week)
1. Incident report: What, when, how long, who had access
2. Team notification: All-hands or engineering meeting
3. Process improvement: Update gitleaks patterns, training
4. Follow-up: Verify credential not used maliciously

## Tools

**BFG Repo-Cleaner** (recommended):
```bash
java -jar bfg.jar --replace-text passwords.txt repo.git
```

**git filter-repo** (fastest):
```bash
git filter-repo --invert-paths --path <file>
```

## Contact

- Security team: security@company.com
- On-call: Slack #security-oncall
- Incident commander: [Name], [Phone]
```

**2. Create .gitleaksignore template**:
```bash
cat > .gitleaksignore << 'EOF'
# Gitleaks False Positives and Exceptions
#
# Format: <path>:<line>:<secret-pattern>
#
# Example:
# docs/reference/api/authentication.md:42:sk_test_EXAMPLE_NOT_REAL
#
# IMPORTANT: Document why each exception is safe
#
# Example exceptions:
docs/reference/api/authentication.md:*:sk_test_*  # Example API keys only
docs/reference/api/authentication.md:*:pk_test_*  # Example API keys only
.env.example:*:*  # Example environment variables, not real credentials
EOF
```

**3. Update SECURITY.md**:
```bash
cat >> SECURITY.md << 'EOF'

## Documentation Security

We take documentation security seriously. If you find sensitive data (passwords, API keys, etc.) in our documentation:

1. **Do not create a public issue** (avoid further exposure)
2. Email security@company.com with:
   - File path and line number
   - Type of sensitive data
   - How you discovered it
3. We will respond within 24 hours
4. We will rotate the credential and clean git history

See docs/security/secret-exposure-response.md for our full incident response process.
EOF
```

**Success Criteria**:
- [ ] Incident response runbook created
- [ ] .gitleaksignore template created
- [ ] SECURITY.md updated with documentation security section
- [ ] Team briefed on incident response process

### Phase 6: Quarterly Audit Process (Ongoing)

**1. Create audit script**: `scripts/security-audit-docs.sh`

```bash
#!/bin/bash
# Quarterly documentation security audit

echo "Documentation Security Audit - $(date)"
echo "========================================"
echo ""

# Run comprehensive gitleaks scan
echo "Running gitleaks on entire repository..."
gitleaks detect --verbose --report-path gitleaks-report.json

if [ $? -ne 0 ]; then
    echo "⚠️  Potential secrets detected! Review gitleaks-report.json"
else
    echo "✅ No secrets detected"
fi

# Check for potentially sensitive patterns
echo ""
echo "Checking for sensitive patterns..."

# Email addresses (potential PII)
EMAIL_COUNT=$(grep -r -E '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b' \
              docs/ --include="*.md" | grep -v "example.com" | grep -v "@anthropic.com" | wc -l)
echo "Real email addresses: $EMAIL_COUNT (should be 0)"

# IP addresses (potential infrastructure exposure)
IP_COUNT=$(grep -r -E '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' \
           docs/ --include="*.md" | grep -v "127.0.0.1" | grep -v "0.0.0.0" | wc -l)
echo "IP addresses: $IP_COUNT (review for infrastructure exposure)"

# Security TODOs (should be filed as security issues, not documented)
TODO_COUNT=$(grep -r -i "TODO.*security\|FIXME.*auth\|HACK.*bypass" \
             docs/ --include="*.md" | wc -l)
echo "Security TODOs: $TODO_COUNT (should be 0)"

# Summary
echo ""
echo "========================================"
if [ $EMAIL_COUNT -eq 0 ] && [ $TODO_COUNT -eq 0 ]; then
    echo "✅ Audit passed - no critical issues"
else
    echo "⚠️  Review findings above"
fi
```

**2. Schedule quarterly audit**:
```bash
# Add to calendar (repeat quarterly)
# Q1: End of March
# Q2: End of June
# Q3: End of September
# Q4: End of December

# Create reminder
echo "Run ./scripts/security-audit-docs.sh" > docs/security/QUARTERLY_AUDIT_REMINDER.md
```

**3. Create audit checklist**:
```markdown
# Quarterly Documentation Security Audit Checklist

## Automated Checks
- [ ] Run ./scripts/security-audit-docs.sh
- [ ] Review gitleaks report (any findings?)
- [ ] Check email address count (should be 0)
- [ ] Check IP address occurrences (infrastructure exposure?)
- [ ] Check security TODOs (should be 0)

## Manual Review
- [ ] Review .gitleaksignore (still valid exceptions?)
- [ ] Check documentation in root/ (should it be in docs/?)
- [ ] Review .claude/ (any sensitive data in AI session notes?)
- [ ] Check new documentation categories (need security review?)

## Incident Review
- [ ] Any security incidents this quarter? (review incident log)
- [ ] Lessons learned? (update training, gitleaks patterns)
- [ ] Process improvements? (checklist updates)

## Compliance
- [ ] GDPR: Any personal data in documentation?
- [ ] SOC 2: Access controls on sensitive docs?
- [ ] Incident response: All incidents documented?

## Report
- [ ] Summarize findings (doc: YYYY-QN-security-audit-report.md)
- [ ] Present to team (engineering all-hands)
- [ ] Action items (assign owners, due dates)
```

**Success Criteria**:
- [ ] Audit script created and tested
- [ ] Quarterly audit scheduled (calendar reminder)
- [ ] Audit checklist documented
- [ ] First audit scheduled for end of Q4 2025

---

## Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation Strategy |
|------|--------|------------|---------------------|
| False positives overwhelm developers | Medium | High | Well-tuned gitleaks config, .gitleaksignore for exceptions |
| Developers skip pre-commit hook (--no-verify) | High | Medium | CI catches what pre-commit misses, code review enforcement |
| Secrets in git history (pre-ADR-005) | High | High | Run initial scan, clean history proactively |
| Team resistance (process overhead) | Medium | Medium | Training emphasizes benefits, show real incident cost |
| gitleaks maintenance (outdated patterns) | Low | Low | Quarterly audit includes tool update review |
| Git history cleanup disruption | High | Low | Prevention reduces need, coordinate force-push carefully |
| Compliance audit failure | High | Low | Quarterly audits ensure readiness, ISO 8601 archives |

---

## Compliance and Standards

**Does this decision affect:**
- [x] Security requirements - Yes (core security process)
- [x] Privacy/compliance (GDPR, etc.) - Yes (protects personal data in docs)
- [ ] Performance SLAs - No
- [x] Architectural principles - Yes (security as first-class concern)
- [x] Documentation standards - Yes (security requirements for all docs)
- [ ] Testing requirements - No direct impact

**How are these addressed?**
- **Security**: Three-layer defense (pre-commit, PR review, CI) catches 99%+ of secrets
- **Privacy/GDPR**: Prevents personal data exposure in documentation
- **Architecture**: Security integrated into documentation workflow (not bolted on)
- **Documentation Standards**: Security checklist required for all documentation PRs

**Regulatory Compliance**:
- **GDPR Article 32**: "Appropriate security measures" - scanning and review process
- **SOC 2 Trust Principle**: "Security" - documented security controls for documentation
- **ISO 27001**: "Information security incident management" - incident response process

---

## Validation and Testing

### Success Metrics

**Immediate (Week 1)**:
- [x] ADR-005 written and accepted
- [ ] gitleaks installed and configured
- [ ] Pre-commit hook tested (catches test secret)
- [ ] CI workflow created and tested

**Short-term (Month 1)**:
- [ ] 100% of team completes security training
- [ ] All PRs include security checklist
- [ ] Zero credential exposures detected in new documentation
- [ ] Historical scan of existing docs completed

**Long-term (Quarter 1)**:
- [ ] Zero security incidents (exposed credentials) in documentation
- [ ] Quarterly audit passes (no critical findings)
- [ ] Developer feedback: "Security process is lightweight and valuable"
- [ ] Compliance audit passes (if applicable)

### Test Scenarios

**Scenario 1: Developer Commits Secret (Pre-Commit Catch)**
```bash
Action: Developer adds password to documentation, commits
Expected: Pre-commit hook fails, blocks commit
Command: git commit -m "Add setup guide"
Output: "❌ SECURITY: Potential secrets detected!"
Verify: Commit blocked, developer removes password, commits successfully
```

**Scenario 2: Secret in PR (CI Catch)**
```bash
Action: Developer pushes PR with API key (skipped pre-commit with --no-verify)
Expected: CI workflow fails, blocks merge
Output: "❌ Secrets detected in documentation!"
Verify: PR cannot merge until API key removed
```

**Scenario 3: Secret Discovered in Existing Docs (Incident Response)**
```bash
Action: Quarterly audit discovers password in old documentation
Expected: Incident response triggered within 1 hour
Steps:
  1. Rotate credential immediately
  2. Remove from docs
  3. Clean git history (BFG)
  4. File incident report
Verify: Credential rotated, history cleaned, incident documented
```

**Scenario 4: False Positive (Exception Process)**
```bash
Action: gitleaks flags example API key (sk_test_EXAMPLE)
Expected: Developer adds to .gitleaksignore with justification
File: .gitleaksignore
Content: "docs/api/auth.md:42:sk_test_EXAMPLE  # Example key, not real"
Verify: Future scans ignore this pattern in this file
```

---

## References

- **OWASP Top 10**: Sensitive Data Exposure (#3)
- **CWE-798**: Use of Hard-coded Credentials
- **NIST SP 800-53**: Security Documentation Requirements
- **GDPR Article 32**: Security of Processing
- **gitleaks**: https://github.com/zricethezav/gitleaks
- **ADR-004**: Time-Based Archive Strategy (security archiving for incident postmortems)
- **Rebuild 6.0**: Security process (zero incidents in 18+ months)

---

## Follow-up

**Open Questions**:
- [ ] Should we scan code comments for sensitive data? (Answer: Yes, extend gitleaks to src/)
- [ ] How to handle third-party documentation (vendor docs)? (Answer: Apply same rules)
- [ ] Should we encrypt sensitive internal docs? (Answer: Use separate internal wiki with access controls)
- [ ] What about documentation in Slack/email? (Answer: Out of scope for ADR-005, consider separate policy)

**Next Actions**:
- [ ] Install and configure gitleaks
- [ ] Create pre-commit hook and test
- [ ] Create GitHub Actions workflow
- [ ] Update PR template with security checklist
- [ ] Create training materials (slides, video, quiz)
- [ ] Schedule team training session (1 hour)
- [ ] Run initial security scan of existing documentation
- [ ] Create incident response runbook
- [ ] Schedule first quarterly audit (Q4 2025)

---

## Notes

### False Positive Examples

**Example 1: Test API Keys**
```markdown
# Authentication Guide

Example request:
curl -H "Authorization: Bearer sk_test_EXAMPLE_KEY_NOT_REAL" \\
     https://api.example.com/users

# False positive: gitleaks flags sk_test_*
# Solution: Add to .gitleaksignore with comment "Example key only"
```

**Example 2: Fictional Passwords**
```markdown
# Setup Guide

Create a user with password: your-password-here

# False positive: gitleaks flags "password: your-password-here"
# Solution: Rephrase as "Enter your password when prompted"
```

**Example 3: Redacted Data**
```markdown
# Bug Report

User email: user-****@example.com

# False positive: gitleaks flags email pattern
# Solution: Add to .gitleaksignore (already redacted)
```

### Common Pitfalls

**Pitfall 1: Committing .env Files**
```bash
# Wrong
git add .env
git commit -m "Add environment config"

# Right
git add .env.example  # Only commit example, not real .env
```

**Pitfall 2: Copy-Pasting from Production**
```markdown
# Wrong
Testing showed error:
Connection string: postgresql://admin:MyP@ss@prod-db.company.com:5432/db

# Right
Testing showed error:
Connection string: postgresql://user:password@host:5432/database
(see .env for actual production connection details - not in docs!)
```

**Pitfall 3: "TODO: Remove Before Commit"**
```markdown
# Wrong
API Key: sk_live_abc123  # TODO: Remove before commit
(Developer forgets to remove)

# Right
API Key: sk_test_EXAMPLE_PLACEHOLDER  # Example only, not real key
```

---

## Lessons Learned (To Be Updated Quarterly)

### From Password Exposure Incident (Nov 2025)
1. **No process = guaranteed exposure**: Relying on developer vigilance insufficient
2. **Detection delay costly**: Weeks of exposure = high remediation cost
3. **Prevention cheaper than cure**: 5 minutes per PR vs 10+ hours per incident

### From Rebuild 6.0 Success (18+ Months, Zero Incidents)
1. **Automation + manual review = 99% detection**: Two layers catch what one layer misses
2. **Pre-commit hook is key**: Catches secrets before they reach remote repository
3. **Training matters**: Developers who understand "why" make fewer mistakes
4. **Quarterly audits catch drift**: Process compliance degrades without regular checks

---

## Approval

This ADR addresses critical security gaps identified through:
- **Security incident**: Password exposure persisted for weeks before discovery
- **Compliance risk**: GDPR/SOC 2 require security controls on sensitive data
- **Industry practice**: Documentation security is standard practice (gitleaks used by thousands)
- **Cost-benefit analysis**: 5 minutes prevention vs 10+ hours remediation per incident

**Decision validated through**:
- **Rebuild 6.0 success**: Zero security incidents in 18+ months with this process
- **Industry tools**: gitleaks battle-tested by GitHub, GitLab, major enterprises
- **Regulatory requirements**: GDPR, SOC 2, ISO 27001 require documented security controls

**Status**: ACCEPTED (2025-11-12)

---

**Revision History**:
- 2025-11-12: Initial version (v1.0) - Establishes documentation security review process
