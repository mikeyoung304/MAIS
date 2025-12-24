# Package Grouping Health Check - Implementation Guide

**Time Required:** ~30 minutes
**Difficulty:** Beginner
**Value:** Immediate detection of data integrity issues

---

## Overview

Add a health check that detects package grouping drift before customers see broken storefronts.

**What it does:**

- Queries for packages with non-canonical grouping values
- Returns actionable output (which values, how many packages)
- Integrates into existing health monitoring
- Zero performance overhead

---

## Implementation Steps

### Step 1: Find Your Health Check Endpoint

Check where health checks are currently implemented:

```bash
# Search for existing health endpoint
grep -r "health\|Health" server/src/routes --include="*.ts" | head -5

# Common locations:
# - server/src/routes/health.routes.ts
# - server/src/routes/monitoring.routes.ts
# - server/src/routes/status.routes.ts
```

### Step 2: Add Health Check Function

Add this function to your health route file:

```typescript
/**
 * Check for package grouping drift
 * Detects non-canonical tier names that would break storefront
 *
 * Valid values: 'tier_1', 'tier_2', 'tier_3', or NULL
 */
async function checkPackageGroupingHealth(prisma: PrismaClient): Promise<{
  status: 'healthy' | 'degraded';
  message: string;
  driftedGroupings?: string[];
}> {
  try {
    // Find packages with non-canonical grouping
    const driftedPackages = await prisma.package.groupBy({
      by: ['grouping'],
      where: {
        grouping: {
          notIn: ['tier_1', 'tier_2', 'tier_3'],
          not: null, // Exclude NULL (allowed value)
        },
        active: true, // Only check active packages
      },
      _count: true,
    });

    if (driftedPackages.length === 0) {
      return {
        status: 'healthy',
        message: 'All active packages have canonical tier names (tier_1/tier_2/tier_3)',
      };
    }

    // Found drift - format alert message
    const driftDetails = driftedPackages.map(
      (g) => `${g.grouping || 'NULL'} (${g._count} packages)`
    );

    logger.warn('ALERT: Package grouping drift detected', {
      driftedCount: driftedPackages.length,
      details: driftDetails,
    });

    return {
      status: 'degraded',
      message: `Package grouping drift: found ${driftedPackages.length} non-canonical values`,
      driftedGroupings: driftDetails,
    };
  } catch (error) {
    logger.error('Package grouping health check failed', { error });
    return {
      status: 'degraded',
      message: 'Failed to check package grouping health',
    };
  }
}
```

### Step 3: Integrate into Health Endpoint

Add the check to your health endpoint handler:

```typescript
// In your health route handler
export const healthRouter = tsRestExpress({
  c: contract.health,
  handlers: {
    get: async (req) => {
      const database = {
        status: 'ok',
        checks: {
          connection: 'ok',
          // Add grouping check
          packageGrouping: await checkPackageGroupingHealth(prisma),
        },
      };

      const overallStatus = Object.values(database.checks).some(
        (c) => (typeof c === 'object' && c.status !== 'healthy') || c !== 'ok'
      )
        ? 'degraded'
        : 'healthy';

      return {
        status: 200,
        body: {
          status: overallStatus,
          database,
          timestamp: new Date().toISOString(),
        },
      };
    },
  },
});
```

### Step 4: Test It

Run your health endpoint and verify output:

```bash
# Start your server
npm run dev:api

# In another terminal, test the endpoint
curl http://localhost:3001/health | jq .

# Expected healthy response:
{
  "status": "healthy",
  "database": {
    "packageGrouping": {
      "status": "healthy",
      "message": "All active packages have canonical tier names (tier_1/tier_2/tier_3)"
    }
  }
}

# Expected degraded response (if drift detected):
{
  "status": "degraded",
  "database": {
    "packageGrouping": {
      "status": "degraded",
      "message": "Package grouping drift: found 2 non-canonical values",
      "driftedGroupings": ["Good (3 packages)", "Premium (5 packages)"]
    }
  }
}
```

---

## Integration with Monitoring

### For Prometheus/Grafana

Add a metric that monitoring systems can scrape:

```typescript
// Add to health check response
const driftCount = await prisma.package.count({
  where: {
    grouping: {
      notIn: ['tier_1', 'tier_2', 'tier_3'],
      not: null,
    },
    active: true,
  },
});

return {
  status: 'healthy',
  metrics: {
    package_grouping_drift_count: driftCount, // 0 = healthy
  },
};
```

### For Uptime/Synthetic Monitoring

```bash
# Add to your monitoring service's health check URL
GET /health
Expected response: status = 'healthy'
Expected metric: package_grouping_drift_count <= 0
```

---

## Testing the Health Check

Add a test to verify the check works:

```typescript
// test/integration/health-grouping-check.test.ts
import { describe, it, expect } from 'vitest';
import { createTestTenant } from '../helpers/test-tenant';

describe('Package Grouping Health Check', () => {
  it('should report healthy when all packages have canonical grouping', async () => {
    const { tenantId, cleanup } = await createTestTenant();

    try {
      // Create packages with canonical grouping
      await prisma.package.create({
        data: {
          tenantId,
          slug: 'essential',
          name: 'Essential Plan',
          basePrice: 100,
          grouping: 'tier_1', // Valid
          active: true,
        },
      });

      // Call health check
      const response = await fetch('http://localhost:3001/health');
      const health = await response.json();

      expect(health.database.packageGrouping.status).toBe('healthy');
    } finally {
      await cleanup();
    }
  });

  it('should report degraded when non-canonical grouping exists', async () => {
    const { tenantId, cleanup } = await createTestTenant();

    try {
      // Create package with invalid grouping
      await prisma.package.create({
        data: {
          tenantId,
          slug: 'invalid',
          name: 'Invalid Package',
          basePrice: 100,
          grouping: 'Budget', // Invalid - should be tier_1
          active: true,
        },
      });

      // Call health check
      const response = await fetch('http://localhost:3001/health');
      const health = await response.json();

      expect(health.database.packageGrouping.status).toBe('degraded');
      expect(health.database.packageGrouping.driftedGroupings).toContain(
        expect.stringContaining('Budget')
      );
    } finally {
      await cleanup();
    }
  });
});
```

---

## Troubleshooting

**Problem:** "Cannot find prisma in scope"

**Solution:** Import PrismaClient from DI container:

```typescript
import { prisma } from '../../di';
```

---

**Problem:** "groupBy is not a function"

**Solution:** Ensure you're using Prisma Client correctly:

```typescript
// Correct
const result = await prisma.package.groupBy({...});

// Wrong
const result = await prisma.packages.groupBy({...});
```

---

**Problem:** Health check returns all NULL groupings as drift

**Solution:** Explicitly exclude NULL in where clause:

```typescript
where: {
  grouping: {
    notIn: ['tier_1', 'tier_2', 'tier_3'],
    not: null,  // Add this line
  },
}
```

---

## Quick Reference

**Canonical grouping values:**

- `tier_1` = Essential/Good tier (lowest price)
- `tier_2` = Popular/Better tier (middle)
- `tier_3` = Premium/Best tier (highest price)
- `NULL` = No grouping (flat package structure)

**Non-canonical values to detect:**

- "Budget", "Good", "Basic", "Starter", "Essential"
- "Middle", "Better", "Popular", "Standard", "Recommended"
- "Luxury", "Best", "Premium", "Deluxe", "Ultimate"

---

## Related Documentation

- [Package Grouping Drift Prevention](/docs/solutions/PACKAGE_GROUPING_DRIFT_PREVENTION.md)
- [Database Schema - Package Model](/server/prisma/schema.prisma) (line 211)
- [Tier Migration](/server/prisma/migrations/12_canonical_tier_names.sql)

---

**Created:** December 14, 2025
**For:** MAIS Health Monitoring System
**Status:** Ready to Implement
