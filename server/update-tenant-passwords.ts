import { PrismaClient } from './src/generated/prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function main() {
  console.log('Updating tenant admin passwords...\n');

  // Simple passwords for testing
  const littleBitPassword = 'password123';
  const laPetitPassword = 'password123';

  // Update Little Bit Farm admin
  await prisma.user.update({
    where: { email: 'admin@littlebitfarm.com' },
    data: {
      passwordHash: await bcrypt.hash(littleBitPassword, BCRYPT_ROUNDS),
    },
  });

  console.log('✅ Little Bit Farm Admin');
  console.log(`   Email: admin@littlebitfarm.com`);
  console.log(`   Password: ${littleBitPassword}\n`);

  // Update La Petit Mariage admin
  await prisma.user.update({
    where: { email: 'admin@lapetitmariage.com' },
    data: {
      passwordHash: await bcrypt.hash(laPetitPassword, BCRYPT_ROUNDS),
    },
  });

  console.log('✅ La Petit Mariage Admin');
  console.log(`   Email: admin@lapetitmariage.com`);
  console.log(`   Password: ${laPetitPassword}\n`);

  console.log('✅ Passwords updated successfully!');
}

main()
  .catch((e) => {
    console.error('Error updating passwords:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
