#!/usr/bin/env tsx

import { PrismaClient } from '../src/generated/prisma/client';
import { CommissionService } from '../src/services/commission.service';

const prisma = new PrismaClient();
const commissionService = new CommissionService(prisma);

async function testCommission() {
  console.log('🧪 Testing Commission Calculation Service\n');

  try {
    // Get tenant-a (10% commission)
    const tenantA = await prisma.tenant.findUnique({ where: { slug: 'tenant-a' } });
    if (!tenantA) {
      throw new Error('Tenant A not found');
    }
    console.log(`✓ Found Tenant A: ${tenantA.name} (${tenantA.commissionPercent}% commission)`);

    // Test 1: $500.00 booking, 10% commission = $50.00
    const result1 = await commissionService.calculateCommission(tenantA.id, 50000);
    console.log(`\nTest 1: Tenant A - $500.00 booking`);
    console.log(`  Expected: $50.00 commission (5000 cents)`);
    console.log(
      `  Actual:   $${(result1.amount / 100).toFixed(2)} commission (${result1.amount} cents)`
    );
    console.log(`  Rate:     ${result1.percent}%`);

    if (result1.amount !== 5000) {
      throw new Error(`FAILED: Expected 5000 cents, got ${result1.amount}`);
    }
    if (result1.percent !== 10.0) {
      throw new Error(`FAILED: Expected 10.0%, got ${result1.percent}%`);
    }
    console.log(`  ✅ PASS`);

    // Get tenant-b (12.5% commission)
    const tenantB = await prisma.tenant.findUnique({ where: { slug: 'tenant-b' } });
    if (!tenantB) {
      throw new Error('Tenant B not found');
    }
    console.log(`\n✓ Found Tenant B: ${tenantB.name} (${tenantB.commissionPercent}% commission)`);

    // Test 2: $500.00 booking, 12.5% commission = $62.50
    const result2 = await commissionService.calculateCommission(tenantB.id, 50000);
    console.log(`\nTest 2: Tenant B - $500.00 booking`);
    console.log(`  Expected: $62.50 commission (6250 cents)`);
    console.log(
      `  Actual:   $${(result2.amount / 100).toFixed(2)} commission (${result2.amount} cents)`
    );
    console.log(`  Rate:     ${result2.percent}%`);

    if (result2.amount !== 6250) {
      throw new Error(`FAILED: Expected 6250 cents, got ${result2.amount}`);
    }
    if (result2.percent !== 12.5) {
      throw new Error(`FAILED: Expected 12.5%, got ${result2.percent}%`);
    }
    console.log(`  ✅ PASS`);

    // Get tenant-c (15% commission)
    const tenantC = await prisma.tenant.findUnique({ where: { slug: 'tenant-c' } });
    if (!tenantC) {
      throw new Error('Tenant C not found');
    }
    console.log(`\n✓ Found Tenant C: ${tenantC.name} (${tenantC.commissionPercent}% commission)`);

    // Test 3: $500.00 booking, 15% commission = $75.00
    const result3 = await commissionService.calculateCommission(tenantC.id, 50000);
    console.log(`\nTest 3: Tenant C - $500.00 booking`);
    console.log(`  Expected: $75.00 commission (7500 cents)`);
    console.log(
      `  Actual:   $${(result3.amount / 100).toFixed(2)} commission (${result3.amount} cents)`
    );
    console.log(`  Rate:     ${result3.percent}%`);

    if (result3.amount !== 7500) {
      throw new Error(`FAILED: Expected 7500 cents, got ${result3.amount}`);
    }
    if (result3.percent !== 15.0) {
      throw new Error(`FAILED: Expected 15.0%, got ${result3.percent}%`);
    }
    console.log(`  ✅ PASS`);

    // Test 4: Booking calculation with subtotals
    console.log(`\nTest 4: Full booking calculation (Tenant B)`);
    const breakdown = await commissionService.calculateBookingTotal(
      tenantB.id,
      50000, // $500 package
      [] // No add-ons
    );
    console.log(`  Package:       $${(breakdown.packagePrice / 100).toFixed(2)}`);
    console.log(`  Add-ons:       $${(breakdown.addOnsTotal / 100).toFixed(2)}`);
    console.log(`  Subtotal:      $${(breakdown.subtotal / 100).toFixed(2)}`);
    console.log(
      `  Commission:    $${(breakdown.commissionAmount / 100).toFixed(2)} (${breakdown.commissionPercent}%)`
    );
    console.log(`  Tenant Gets:   $${(breakdown.tenantReceives / 100).toFixed(2)}`);

    if (breakdown.commissionAmount !== 6250) {
      throw new Error(`FAILED: Expected 6250 cents commission, got ${breakdown.commissionAmount}`);
    }
    if (breakdown.tenantReceives !== 43750) {
      throw new Error(`FAILED: Expected 43750 cents for tenant, got ${breakdown.tenantReceives}`);
    }
    console.log(`  ✅ PASS`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ALL COMMISSION CALCULATIONS CORRECT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testCommission();
