import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
    select: { slug: true, name: true },
    take: 5,
  });
  console.log(JSON.stringify(tenants, null, 2));
  await prisma.$disconnect();
}
main();
