import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: {
      OR: [
        { slug: { contains: 'little', mode: 'insensitive' } },
        { name: { contains: 'little bit', mode: 'insensitive' } },
      ],
    },
    select: { id: true, slug: true, name: true },
  });
  console.log('Tenant:', JSON.stringify(tenant, null, 2));

  if (tenant) {
    const packages = await prisma.package.findMany({
      where: { tenantId: tenant.id },
      include: { segment: true },
      orderBy: [{ segment: { name: 'asc' } }, { groupingOrder: 'asc' }],
    });
    console.log('\nPackages:');
    for (const pkg of packages) {
      console.log(`  - ${pkg.title} (${pkg.segment?.name || 'No segment'})`);
      console.log(`    Price: $${pkg.basePrice / 100}, Active: ${pkg.active}`);
      if (pkg.description) console.log(`    ${pkg.description}`);
    }
  }
}

main().finally(() => prisma.$disconnect());
