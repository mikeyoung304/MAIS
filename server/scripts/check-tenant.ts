import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { id: 'cmib35wgh0000p077r2odzv85' },
    select: { name: true, slug: true, isActive: true },
  });
  console.log('Little Bit Farm tenant:', tenant);
  await prisma.$disconnect();
}
main();
