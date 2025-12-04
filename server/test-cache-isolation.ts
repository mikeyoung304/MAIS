/**
 * Test script to verify cache isolation between tenants
 *
 * PURPOSE: Demonstrates that HTTP-level caching (middleware/cache.ts) does NOT
 * include tenantId in cache keys, causing cross-tenant data leakage.
 *
 * EXPECTED BEHAVIOR:
 * - Tenant A and Tenant B should receive different cached responses
 * - Cache keys should be different for different tenants
 *
 * ACTUAL BEHAVIOR:
 * - HTTP cache middleware creates keys like: "GET:/v1/packages:{}"
 * - Cache keys are IDENTICAL for all tenants (no tenantId in key)
 * - Second tenant receives first tenant's cached data
 *
 * RUN: npx ts-node test-cache-isolation.ts
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Simulate two different tenants
const TENANT_A_KEY = 'pk_live_tenant_alice';
const TENANT_B_KEY = 'pk_live_tenant_bob';

interface PackageDto {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  photoUrl: string | null;
  addOns: any[];
}

async function testCacheIsolation() {
  console.log('=== Cache Isolation Test ===\n');

  try {
    // Request 1: Tenant A fetches packages (cache MISS)
    console.log(`[Tenant A] Fetching packages with key: ${TENANT_A_KEY}`);
    const responseA1 = await axios.get(`${API_URL}/v1/packages`, {
      headers: { 'X-Tenant-Key': TENANT_A_KEY },
    });

    const packagesA1 = responseA1.data as PackageDto[];
    const cacheStatusA1 = responseA1.headers['x-cache'] || 'UNKNOWN';

    console.log(`[Tenant A] Response:
  - Cache Status: ${cacheStatusA1}
  - Package Count: ${packagesA1.length}
  - First Package: ${packagesA1[0]?.title || 'N/A'}
  - Package IDs: ${packagesA1.map((p) => p.id).join(', ')}\n`);

    // Wait a moment to ensure cache is set
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Request 2: Tenant A fetches again (should be cache HIT with SAME data)
    console.log(`[Tenant A] Fetching packages again (should be cache HIT)`);
    const responseA2 = await axios.get(`${API_URL}/v1/packages`, {
      headers: { 'X-Tenant-Key': TENANT_A_KEY },
    });

    const packagesA2 = responseA2.data as PackageDto[];
    const cacheStatusA2 = responseA2.headers['x-cache'] || 'UNKNOWN';

    console.log(`[Tenant A] Response:
  - Cache Status: ${cacheStatusA2}
  - Package Count: ${packagesA2.length}
  - First Package: ${packagesA2[0]?.title || 'N/A'}
  - Package IDs: ${packagesA2.map((p) => p.id).join(', ')}\n`);

    // Request 3: Tenant B fetches packages (SHOULD be cache MISS with DIFFERENT data)
    console.log(`[Tenant B] Fetching packages with key: ${TENANT_B_KEY}`);
    const responseB = await axios.get(`${API_URL}/v1/packages`, {
      headers: { 'X-Tenant-Key': TENANT_B_KEY },
    });

    const packagesB = responseB.data as PackageDto[];
    const cacheStatusB = responseB.headers['x-cache'] || 'UNKNOWN';

    console.log(`[Tenant B] Response:
  - Cache Status: ${cacheStatusB}
  - Package Count: ${packagesB.length}
  - First Package: ${packagesB[0]?.title || 'N/A'}
  - Package IDs: ${packagesB.map((p) => p.id).join(', ')}\n`);

    // Analysis
    console.log('=== ANALYSIS ===\n');

    // Check if Tenant A got cache hit on second request
    if (cacheStatusA2 === 'HIT') {
      console.log('✓ Tenant A second request was a cache HIT (expected)\n');
    } else {
      console.log('✗ Tenant A second request was NOT a cache HIT (unexpected)\n');
    }

    // Check if Tenant B got Tenant A's data (BUG)
    const tenantBGotTenantAData =
      packagesB.length > 0 && packagesA1.length > 0 && packagesB[0]?.id === packagesA1[0]?.id;

    if (tenantBGotTenantAData) {
      console.log('🔥 CRITICAL BUG DETECTED:');
      console.log("   Tenant B received Tenant A's cached data!");
      console.log('   This is a SECURITY VULNERABILITY - cross-tenant data leakage.\n');
      console.log('   Root Cause: Cache keys do NOT include tenantId');
      console.log('   Cache Key Format: GET:/v1/packages:{} (SAME for all tenants)\n');
    } else if (packagesB.length === 0 && packagesA1.length === 0) {
      console.log('⚠️  Both tenants have no packages - cannot verify isolation\n');
    } else {
      console.log('✓ Tenant B received different data (cache isolation working)\n');
    }

    // Check cache status for Tenant B
    if (cacheStatusB === 'HIT') {
      console.log('🔥 CACHE LEAK CONFIRMED:');
      console.log('   Tenant B request was a cache HIT (should be MISS)');
      console.log('   Tenant B is receiving cached data from another tenant!\n');
    } else if (cacheStatusB === 'MISS') {
      console.log('✓ Tenant B cache MISS (expected for different tenant)\n');
    }

    // Recommendation
    console.log('=== RECOMMENDATION ===\n');
    console.log('The HTTP cache middleware (src/middleware/cache.ts) must include');
    console.log('tenantId in cache keys to prevent cross-tenant data leakage.\n');
    console.log('Current key format:  GET:/v1/packages:{}');
    console.log('Required key format: GET:/v1/packages:{}:tenant_<id>\n');
    console.log('OR better yet: Remove HTTP-level caching entirely and rely on');
    console.log('the application-level CacheService which already includes tenantId.\n');

    return {
      tenantAData: packagesA1,
      tenantBData: packagesB,
      cacheLeakDetected: tenantBGotTenantAData || cacheStatusB === 'HIT',
    };
  } catch (error: any) {
    console.error('Error running cache isolation test:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Run test
testCacheIsolation()
  .then((result) => {
    console.log('\n=== TEST COMPLETED ===');
    if (result.cacheLeakDetected) {
      console.log('❌ CACHE LEAK DETECTED - Fix required!');
      process.exit(1);
    } else {
      console.log('✅ Cache isolation working correctly');
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });
