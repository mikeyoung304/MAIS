# Supabase IPv6 Connection Prevention Strategy

**Date Created:** 2025-12-23
**Severity:** Medium (Blocks local development, not production)
**Impact:** Developer productivity, local integration test reliability
**Category:** Database Connection / Network Configuration

---

## Executive Summary

This document prevents a recurring issue where Supabase PostgreSQL connections fail on local development machines due to IPv6 resolution, while CI environments (using local PostgreSQL containers) work fine.

**Root Causes:**

1. CI uses local PostgreSQL containers (IPv4 `localhost:5432`) which always works
2. Local development uses Supabase (remote host with DNS resolving to IPv6)
3. Some local networks/ISPs don't support IPv6 properly
4. macOS sometimes prefers IPv6 when available but connectivity fails
5. The mismatch wasn't caught until developers ran integration tests locally

**Key Prevention Strategies:**

- Environment parity detection in doctor script
- DATABASE_URL validation with connectivity pre-checks
- Clear documentation of network requirements
- Fallback connection string patterns
- CI/local environment alignment guide

---

## Part 1: Understanding the Problem

### Environment Mismatch Matrix

```
ENVIRONMENT        DATABASE HOST                PROTOCOL     STATUS
-------------------------------------------------------------------------
CI (GitHub Actions) localhost:5432 (container)  IPv4         Always works
Local Dev (mock)    N/A (in-memory)             N/A          Always works
Local Dev (real)    *.supabase.co               IPv6/IPv4    MAY FAIL
Production          *.supabase.co               IPv6/IPv4    Usually works
```

### Why This Happens

1. **DNS Resolution Priority:**
   - Supabase hostnames return both A (IPv4) and AAAA (IPv6) records
   - macOS/Node.js may prefer IPv6 if available
   - If local network doesn't route IPv6, connection hangs/fails

2. **CI Always Works:**
   - Uses `localhost:5432` which is always IPv4
   - PostgreSQL container runs in same network namespace
   - No DNS resolution needed

3. **Local Supabase Sometimes Fails:**
   - Remote hostname requires DNS lookup
   - DNS may return IPv6 address first
   - Local router/ISP may not support IPv6
   - Connection timeout or ENETUNREACH error

### Error Signatures

```
# Typical error messages when IPv6 fails
Error: connect ENETUNREACH 2607:f8b0:4004:800::200e:5432
Error: connect ETIMEDOUT [2607:f8b0:4004:800::200e]:5432
Error: getaddrinfo ENOTFOUND db.xxxxx.supabase.co
FATAL: connection to server at "db.xxxxx.supabase.co" failed
```

---

## Part 2: Prevention Strategies

### Strategy 1: Force IPv4 in DATABASE_URL

Add `?sslmode=require&options=-c%20ipv4only%3Don` or use the IPv4-only connection string from Supabase.

**Supabase Connection Pooler (Recommended):**

```bash
# Use Session Mode (port 5432) with direct IPv4
DATABASE_URL="postgresql://postgres.xxxx:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"

# Force IPv4 via connection options
DATABASE_URL="postgresql://user:pass@db.xxx.supabase.co:5432/postgres?sslmode=require&connect_timeout=10"
```

**Direct Connection (if needed):**

```bash
# Use port 6543 for connection pooler (more reliable)
DATABASE_URL="postgresql://postgres.xxxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"
```

### Strategy 2: Environment Variable Validation

Add to `server/src/config/env.schema.ts`:

```typescript
// Validate DATABASE_URL format and provide warnings
DATABASE_URL: z
  .string()
  .refine(
    (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
    'DATABASE_URL must be a valid PostgreSQL connection string'
  )
  .refine(
    (url) => {
      // Warn if using Supabase without connection pooler
      if (url.includes('supabase.co') && !url.includes('pooler.supabase.com')) {
        console.warn(
          'WARNING: Using direct Supabase connection. Consider using pooler.supabase.com for better reliability.'
        );
      }
      return true;
    }
  ),
```

### Strategy 3: Pre-Connection Health Check

Add database connectivity check before starting the application:

```typescript
// server/src/lib/database-health.ts

import { URL } from 'url';
import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

interface ConnectionCheckResult {
  success: boolean;
  host: string;
  resolvedAddress?: string;
  family?: 4 | 6;
  error?: string;
  suggestion?: string;
}

export async function checkDatabaseConnectivity(
  databaseUrl: string
): Promise<ConnectionCheckResult> {
  const url = new URL(databaseUrl);
  const host = url.hostname;

  try {
    // Force IPv4 lookup first
    const result = await dnsLookup(host, { family: 4 });

    return {
      success: true,
      host,
      resolvedAddress: result.address,
      family: result.family as 4 | 6,
    };
  } catch (ipv4Error) {
    // Try IPv6 if IPv4 fails
    try {
      const result = await dnsLookup(host, { family: 6 });

      return {
        success: true,
        host,
        resolvedAddress: result.address,
        family: result.family as 4 | 6,
        suggestion: 'IPv6 resolved. If connection fails, try using Supabase connection pooler.',
      };
    } catch (ipv6Error) {
      return {
        success: false,
        host,
        error: `DNS resolution failed for ${host}`,
        suggestion: 'Check your network connection and DNS settings.',
      };
    }
  }
}

export async function validateDatabaseUrl(
  databaseUrl: string
): Promise<{ valid: boolean; warnings: string[] }> {
  const warnings: string[] = [];

  // Check for Supabase-specific patterns
  if (databaseUrl.includes('supabase.co')) {
    // Warn if using direct connection instead of pooler
    if (!databaseUrl.includes('pooler.supabase.com')) {
      warnings.push(
        'Consider using Supabase connection pooler (pooler.supabase.com) for better reliability'
      );
    }

    // Check for SSL mode
    if (!databaseUrl.includes('sslmode=')) {
      warnings.push('Consider adding sslmode=require for secure connections');
    }

    // Check for connection timeout
    if (!databaseUrl.includes('connect_timeout=')) {
      warnings.push('Consider adding connect_timeout=10 to prevent hanging on network issues');
    }
  }

  // Validate connectivity
  const connectivity = await checkDatabaseConnectivity(databaseUrl);
  if (!connectivity.success) {
    warnings.push(connectivity.error || 'Database host unreachable');
    warnings.push(connectivity.suggestion || '');
  } else if (connectivity.family === 6) {
    warnings.push(
      `Database resolved to IPv6 (${connectivity.resolvedAddress}). ` +
        'If connections fail, your network may not support IPv6.'
    );
  }

  return {
    valid: connectivity.success,
    warnings: warnings.filter(Boolean),
  };
}
```

### Strategy 4: Doctor Script Enhancement

Add to `server/scripts/doctor.ts`:

```typescript
// Add after existing checks

const DATABASE_CONNECTIVITY_CHECK: EnvCheck = {
  key: 'DATABASE_CONNECTIVITY',
  required: false, // Check only, don't fail
  feature: 'Database',
  description: 'Database host reachability and IPv4/IPv6 resolution',
};

async function checkDatabaseConnectivity(databaseUrl: string): Promise<CheckResult> {
  if (!databaseUrl) {
    return {
      key: 'DATABASE_CONNECTIVITY',
      status: 'missing',
      required: false,
      description: 'DATABASE_URL not set',
    };
  }

  try {
    const url = new URL(databaseUrl);
    const host = url.hostname;

    // DNS resolution check
    const dns = await import('dns');
    const { promisify } = await import('util');
    const lookup = promisify(dns.lookup);

    try {
      // Try IPv4 first
      const result = await lookup(host, { family: 4 });

      return {
        key: 'DATABASE_CONNECTIVITY',
        status: 'ok',
        required: false,
        description: `Resolved to IPv4: ${result.address}`,
      };
    } catch {
      // Try IPv6 as fallback
      try {
        const result = await lookup(host, { family: 6 });

        return {
          key: 'DATABASE_CONNECTIVITY',
          status: 'ok',
          required: false,
          description: `Resolved to IPv6: ${result.address} (may have issues on some networks)`,
        };
      } catch {
        return {
          key: 'DATABASE_CONNECTIVITY',
          status: 'empty',
          required: false,
          description: `Cannot resolve host: ${host}`,
        };
      }
    }
  } catch (err) {
    return {
      key: 'DATABASE_CONNECTIVITY',
      status: 'empty',
      required: false,
      description: `Invalid DATABASE_URL format: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

// Add to DATABASE_CHECKS array
const NETWORK_CHECKS: EnvCheck[] = [
  {
    key: 'IPV6_SUPPORT',
    required: false,
    feature: 'Network',
    description: 'IPv6 network connectivity (required for some Supabase regions)',
  },
];

// Add function to check IPv6 support
async function checkIPv6Support(): Promise<CheckResult> {
  const https = await import('https');

  return new Promise((resolve) => {
    const req = https.get(
      {
        hostname: 'ipv6.google.com',
        path: '/',
        timeout: 5000,
        family: 6,
      },
      (res) => {
        resolve({
          key: 'IPV6_SUPPORT',
          status: 'ok',
          required: false,
          description: 'IPv6 connectivity available',
        });
        res.destroy();
      }
    );

    req.on('error', () => {
      resolve({
        key: 'IPV6_SUPPORT',
        status: 'empty',
        required: false,
        description: 'IPv6 not available (may affect Supabase connections)',
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        key: 'IPV6_SUPPORT',
        status: 'empty',
        required: false,
        description: 'IPv6 timeout (may affect Supabase connections)',
      });
    });
  });
}
```

---

## Part 3: Environment Configuration Recommendations

### Development Environment Setup

Create `.env.development.local` (not committed):

```bash
# Local Development - Use Supabase connection pooler for reliability
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connect_timeout=10"
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@db.[project-ref].supabase.co:5432/postgres?sslmode=require&connect_timeout=10"

# Alternative: Use local PostgreSQL for maximum reliability
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mais_dev"
# DIRECT_URL="postgresql://postgres:postgres@localhost:5432/mais_dev"
```

### CI Environment Setup (Already Correct)

```yaml
# .github/workflows/main-pipeline.yml - Integration Tests Job
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: mais_test
    ports:
      - 5432:5432

env:
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/mais_test
```

### Production Environment

```bash
# Supabase production - Use connection pooler
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@db.[project-ref].supabase.co:5432/postgres?sslmode=require"
```

---

## Part 4: Quick Diagnostic Checklist

### When Database Connection Fails

Run through this checklist in order:

````markdown
## Quick Diagnostic Checklist

1. [ ] **Check error message type:**
   - `ENETUNREACH` or `ETIMEDOUT` with IPv6 address? -> IPv6 issue
   - `ENOTFOUND`? -> DNS issue
   - `connection refused`? -> Database not running
   - `authentication failed`? -> Wrong credentials

2. [ ] **Test DNS resolution:**

   ```bash
   # Check what addresses your system resolves
   dig db.xxxx.supabase.co

   # Force IPv4 lookup
   dig db.xxxx.supabase.co A

   # Force IPv6 lookup
   dig db.xxxx.supabase.co AAAA
   ```
````

3. [ ] **Test database connectivity:**

   ```bash
   # Test with psql (uses system DNS)
   psql "$DATABASE_URL" -c "SELECT 1;"

   # Test with explicit IPv4
   psql "postgresql://user:pass@$(dig +short db.xxxx.supabase.co A | head -1):5432/postgres?sslmode=require" -c "SELECT 1;"
   ```

4. [ ] **Check network configuration:**

   ```bash
   # Check if IPv6 is working
   curl -6 https://ipv6.google.com/ --max-time 5

   # Check current IP configuration
   ifconfig | grep inet6
   ```

5. [ ] **Try Supabase connection pooler:**
   - Change hostname from `db.xxxx.supabase.co` to `aws-0-[region].pooler.supabase.com`
   - Change port from `5432` to `6543`
   - Add `?pgbouncer=true` to URL

6. [ ] **Use local PostgreSQL as fallback:**

   ```bash
   # Start local PostgreSQL
   brew services start postgresql@16

   # Create local database
   createdb mais_dev

   # Update .env
   DATABASE_URL="postgresql://localhost/mais_dev"
   ```

````

### Automated Diagnostic Command

Add to `package.json`:

```json
{
  "scripts": {
    "db:diagnose": "tsx server/scripts/diagnose-database.ts"
  }
}
````

Create `server/scripts/diagnose-database.ts`:

```typescript
#!/usr/bin/env tsx

/**
 * Database Connection Diagnostic Tool
 *
 * Checks DNS resolution, IPv4/IPv6 connectivity, and database connection.
 */

import dns from 'dns';
import { promisify } from 'util';
import { URL } from 'url';
import { exec } from 'child_process';
import { PrismaClient } from '../src/generated/prisma';

const lookup = promisify(dns.lookup);
const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);
const execAsync = promisify(exec);

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function color(text: string, code: string): string {
  return `${code}${text}${colors.reset}`;
}

async function main() {
  console.log(color('\n🔍 Database Connection Diagnostic\n', colors.bold + colors.cyan));

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.log(color('❌ DATABASE_URL not set', colors.red));
    process.exit(1);
  }

  // Parse URL
  let url: URL;
  try {
    url = new URL(databaseUrl);
    console.log(color('✓ DATABASE_URL parsed successfully', colors.green));
    console.log(`  Host: ${url.hostname}`);
    console.log(`  Port: ${url.port || '5432'}`);
    console.log(`  Database: ${url.pathname.slice(1)}`);
  } catch (err) {
    console.log(color('❌ Invalid DATABASE_URL format', colors.red));
    process.exit(1);
  }

  const host = url.hostname;

  // Check if localhost
  if (host === 'localhost' || host === '127.0.0.1') {
    console.log(color('\n✓ Using localhost (no DNS/IPv6 issues possible)', colors.green));
  } else {
    // DNS Resolution
    console.log(color('\n📡 DNS Resolution:', colors.bold));

    // IPv4
    try {
      const ipv4Addresses = await resolve4(host);
      console.log(color(`  ✓ IPv4: ${ipv4Addresses.join(', ')}`, colors.green));
    } catch {
      console.log(color('  ⚠ No IPv4 (A) records found', colors.yellow));
    }

    // IPv6
    try {
      const ipv6Addresses = await resolve6(host);
      console.log(color(`  ✓ IPv6: ${ipv6Addresses.join(', ')}`, colors.green));
    } catch {
      console.log(color('  ⚠ No IPv6 (AAAA) records found', colors.yellow));
    }

    // System default lookup
    try {
      const result = await lookup(host);
      console.log(
        color(`  → System prefers: ${result.address} (IPv${result.family})`, colors.cyan)
      );

      if (result.family === 6) {
        console.log(
          color(
            "  ⚠ System prefers IPv6 - may fail if your network doesn't support IPv6",
            colors.yellow
          )
        );
      }
    } catch (err) {
      console.log(color(`  ❌ DNS lookup failed: ${err}`, colors.red));
    }
  }

  // Check Supabase-specific recommendations
  if (host.includes('supabase.co')) {
    console.log(color('\n🔧 Supabase Recommendations:', colors.bold));

    if (!host.includes('pooler.supabase.com')) {
      console.log(
        color('  ⚠ Using direct connection - consider using connection pooler', colors.yellow)
      );
      console.log('    pooler.supabase.com provides more reliable connections');
    } else {
      console.log(color('  ✓ Using connection pooler', colors.green));
    }

    if (!databaseUrl.includes('sslmode=')) {
      console.log(color('  ⚠ No sslmode specified - add sslmode=require', colors.yellow));
    }

    if (!databaseUrl.includes('connect_timeout=')) {
      console.log(color('  ⚠ No connect_timeout - add connect_timeout=10', colors.yellow));
    }
  }

  // IPv6 Network Check
  console.log(color('\n🌐 Network Connectivity:', colors.bold));

  try {
    await execAsync('curl -6 https://ipv6.google.com/ --max-time 5 -s -o /dev/null');
    console.log(color('  ✓ IPv6 network connectivity available', colors.green));
  } catch {
    console.log(
      color('  ⚠ IPv6 network not available (common, usually not a problem)', colors.yellow)
    );
  }

  // Actual Database Connection Test
  console.log(color('\n🔌 Database Connection Test:', colors.bold));

  const prisma = new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
  });

  try {
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1 as connected`;
    const latency = Date.now() - startTime;
    console.log(color(`  ✓ Connected successfully (${latency}ms)`, colors.green));
  } catch (err) {
    console.log(
      color(`  ❌ Connection failed: ${err instanceof Error ? err.message : err}`, colors.red)
    );

    // Provide specific remediation advice
    const errorMessage = err instanceof Error ? err.message : String(err);

    if (errorMessage.includes('ENETUNREACH') || errorMessage.includes('ETIMEDOUT')) {
      console.log(color('\n💡 Remediation:', colors.bold + colors.yellow));
      console.log('   This appears to be an IPv6 connectivity issue.');
      console.log('   Try one of these solutions:');
      console.log('   1. Use Supabase connection pooler (pooler.supabase.com:6543)');
      console.log('   2. Use local PostgreSQL for development');
      console.log('   3. Check your network/VPN IPv6 settings');
    } else if (errorMessage.includes('ENOTFOUND')) {
      console.log(color('\n💡 Remediation:', colors.bold + colors.yellow));
      console.log('   DNS resolution failed. Check:');
      console.log('   1. Your internet connection');
      console.log('   2. DNS server settings');
      console.log('   3. VPN configuration');
    } else if (errorMessage.includes('authentication')) {
      console.log(color('\n💡 Remediation:', colors.bold + colors.yellow));
      console.log('   Authentication failed. Check:');
      console.log('   1. Database password in DATABASE_URL');
      console.log('   2. Username matches Supabase project');
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log('');
}

main().catch(console.error);
```

---

## Part 5: Doctor Script Integration

### Add to `npm run doctor` Output

The doctor script should be enhanced to check:

1. **DATABASE_URL format validation**
2. **DNS resolution (IPv4/IPv6)**
3. **Network connectivity to database host**
4. **Supabase-specific recommendations**

### Suggested Doctor Output Format

```
🏥 Environment Configuration Doctor

Mode: REAL

Core Configuration:
  ✓ JWT_SECRET [REQUIRED]
  ✓ ADAPTERS_PRESET [optional]

Database (PostgreSQL):
  ✓ DATABASE_URL [REQUIRED]
    Using: aws-0-us-east-1.pooler.supabase.com
  ✓ DNS Resolution [diagnostic]
    IPv4: 52.xx.xx.xx (preferred)
    IPv6: 2607:xxxx::xxxx (available)
  ✓ Connection Test [diagnostic]
    Connected in 45ms

Network Configuration:
  ⚠ IPv6 Support [diagnostic]
    IPv6 network not available
    Note: This is usually fine if using IPv4

Recommendations:
  ⚠ Consider adding connect_timeout=10 to DATABASE_URL

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ All required variables are set!
⚠️  1 recommendation(s) for improved reliability

💡 Run `npm run db:diagnose` for detailed database connectivity analysis
```

---

## Part 6: Best Practices Summary

### Connection String Best Practices

```bash
# GOOD: Explicit timeout, SSL, connection limit
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require&connect_timeout=10&connection_limit=5"

# GOOD: Using Supabase connection pooler
DATABASE_URL="postgresql://user:pass@aws-0-us-east-1.pooler.supabase.com:6543/db?sslmode=require&pgbouncer=true"

# BAD: No timeout (can hang forever on network issues)
DATABASE_URL="postgresql://user:pass@host:5432/db"

# BAD: Direct Supabase without pooler (may have IPv6 issues)
DATABASE_URL="postgresql://user:pass@db.xxxx.supabase.co:5432/db"
```

### Environment Parity Guidelines

| Aspect             | CI             | Local (Mock) | Local (Real)             | Production               |
| ------------------ | -------------- | ------------ | ------------------------ | ------------------------ |
| Database Host      | localhost:5432 | N/A          | pooler.supabase.com:6543 | pooler.supabase.com:6543 |
| SSL Mode           | Not required   | N/A          | require                  | require                  |
| IPv6 Required      | No             | N/A          | No (use pooler)          | No (use pooler)          |
| Connection Timeout | 10s            | N/A          | 10s                      | 10s                      |
| PgBouncer          | No             | N/A          | Yes                      | Yes                      |

### Code Review Checklist for Database Configuration

- [ ] DATABASE_URL includes `connect_timeout=10` (or similar)
- [ ] DATABASE_URL includes `sslmode=require` for remote connections
- [ ] Supabase URLs use `pooler.supabase.com` not `db.xxxx.supabase.co`
- [ ] Error handling includes specific messages for connection failures
- [ ] Health check endpoint tests actual database connectivity
- [ ] Integration tests can run with local PostgreSQL

---

## Part 7: Implementation Checklist

- [ ] Create `server/scripts/diagnose-database.ts` diagnostic tool
- [ ] Add `db:diagnose` npm script to package.json
- [ ] Enhance `server/scripts/doctor.ts` with database connectivity checks
- [ ] Update `.env.example` with recommended connection string format
- [ ] Add database connection pre-check to server startup
- [ ] Document Supabase connection pooler usage in DEVELOPING.md
- [ ] Add GitHub Actions job to test with Supabase staging (optional)
- [ ] Create runbook for debugging connection issues

---

## Part 8: Quick Reference Card

```
┌──────────────────────────────────────────────────────────────┐
│             DATABASE CONNECTION QUICK REFERENCE               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ERROR: ENETUNREACH / ETIMEDOUT with IPv6                    │
│  → Use Supabase connection pooler (pooler.supabase.com)      │
│  → Or use local PostgreSQL                                   │
│                                                              │
│  ERROR: ENOTFOUND                                            │
│  → Check internet/DNS/VPN                                    │
│                                                              │
│  ERROR: Connection timeout                                   │
│  → Add connect_timeout=10 to DATABASE_URL                    │
│                                                              │
│  DIAGNOSTIC COMMANDS:                                        │
│  $ npm run db:diagnose      # Full connectivity check        │
│  $ npm run doctor           # Environment validation         │
│  $ dig db.xxx.supabase.co   # DNS resolution                 │
│                                                              │
│  RECOMMENDED DATABASE_URL FORMAT:                            │
│  postgresql://user:pass@pooler.supabase.com:6543/db          │
│    ?sslmode=require&pgbouncer=true&connect_timeout=10        │
│                                                              │
│  LOCAL FALLBACK:                                             │
│  DATABASE_URL="postgresql://localhost/mais_dev"              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## References

- Supabase Connection Pooling: https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler
- PostgreSQL libpq Parameters: https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-PARAMKEYWORDS
- Prisma Connection Management: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections
- Node.js DNS Module: https://nodejs.org/api/dns.html
- macOS IPv6 Troubleshooting: https://support.apple.com/en-us/HT202236

---

**Last Updated:** 2025-12-23
**Next Review:** 2026-01-23
**Author:** Claude Code (Prevention Strategist)
