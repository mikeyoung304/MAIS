import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const traces = await prisma.conversationTrace.findMany({
    where: {
      evalScore: null,
    },
    select: {
      id: true,
      tenantId: true,
      agentType: true,
      startedAt: true,
      turnCount: true,
    },
    orderBy: { startedAt: 'desc' },
    take: 5,
  });
  console.log('Recent unevaluated traces:');
  console.log(JSON.stringify(traces, null, 2));
  console.log(`\nTotal: ${traces.length} traces ready for evaluation`);
  await prisma.$disconnect();
}
main();
