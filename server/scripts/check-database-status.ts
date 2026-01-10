#!/usr/bin/env tsx

/**
 * Quick script to check database status - users and tenants
 */

// Load environment variables before any other imports
import 'dotenv/config';

import { createPrismaClient } from '../src/lib/prisma';

const prisma = createPrismaClient();

async function main() {
  console.log('📊 Database Status Check\n');

  try {
    // Count all users
    const totalUsers = await prisma.user.count();
    console.log(`Total Users: ${totalUsers}`);

    // Count by role
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: true,
    });
    console.log('\nUsers by Role:');
    usersByRole.forEach(({ role, _count }) => {
      console.log(`  ${role}: ${_count}`);
    });

    // Get sample users
    const users = await prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        tenant: {
          select: {
            slug: true,
            name: true,
            isTestTenant: true,
          },
        },
      },
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Recent Users (last 10):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (users.length === 0) {
      console.log('No users found in database.');
    } else {
      users.forEach((user) => {
        console.log(`Email:   ${user.email}`);
        console.log(`Role:    ${user.role}`);
        if (user.tenant) {
          console.log(
            `Tenant:  ${user.tenant.name} (${user.tenant.slug}) ${user.tenant.isTestTenant ? '[TEST]' : ''}`
          );
        }
        console.log(`Created: ${user.createdAt.toISOString()}`);
        console.log('');
      });
    }

    // Count all tenants
    const totalTenants = await prisma.tenant.count();
    const testTenants = await prisma.tenant.count({
      where: { isTestTenant: true },
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Tenant Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Total Tenants:        ${totalTenants}`);
    console.log(`Test Tenants:         ${testTenants}`);
    console.log(`Production Tenants:   ${totalTenants - testTenants}\n`);

    // Get test tenants
    if (testTenants > 0) {
      const testTenantList = await prisma.tenant.findMany({
        where: { isTestTenant: true },
        select: {
          id: true,
          slug: true,
          name: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
              customers: true,
              bookings: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      console.log('Test Tenants:');
      testTenantList.forEach((tenant) => {
        console.log(`\n  ${tenant.name} (${tenant.slug})`);
        console.log(`    ID:        ${tenant.id}`);
        console.log(`    Users:     ${tenant._count.users}`);
        console.log(`    Customers: ${tenant._count.customers}`);
        console.log(`    Bookings:  ${tenant._count.bookings}`);
        console.log(`    Created:   ${tenant.createdAt.toISOString()}`);
      });
      console.log('');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
