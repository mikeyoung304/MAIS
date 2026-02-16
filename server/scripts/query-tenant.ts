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
    const tiers = await prisma.tier.findMany({
      where: { tenantId: tenant.id },
      include: { segment: true },
      orderBy: [{ segment: { name: 'asc' } }, { sortOrder: 'asc' }],
    });
    console.log('\nTiers:');
    for (const tier of tiers) {
      console.log(`  - ${tier.name} (${tier.segment?.name || 'No segment'})`);
      console.log(`    Price: $${tier.priceCents / 100}, Active: ${tier.active}`);
      if (tier.description) console.log(`    ${tier.description}`);
    }
  }
}

main().finally(() => prisma.$disconnect());
