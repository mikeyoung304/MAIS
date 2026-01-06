import { PrismaClient } from './src/generated/prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function main() {
  console.log('Adding authentication credentials to Tenant records...\n');

  const password = 'password123';
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Update Little Bit Farm
  await prisma.tenant.update({
    where: { slug: 'little-bit-farm' },
    data: {
      email: 'admin@littlebitfarm.com',
      passwordHash,
    },
  });

  console.log('✅ Little Bit Farm');
  console.log(`   Email: admin@littlebitfarm.com`);
  console.log(`   Password: ${password}\n`);

  // Update La Petit Mariage
  await prisma.tenant.update({
    where: { slug: 'la-petit-mariage' },
    data: {
      email: 'admin@lapetitmariage.com',
      passwordHash,
    },
  });

  console.log('✅ La Petit Mariage');
  console.log(`   Email: admin@lapetitmariage.com`);
  console.log(`   Password: ${password}\n`);

  console.log('✅ Tenant authentication credentials updated!');
}

main()
  .catch((e) => {
    console.error('Error updating tenant auth:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
