import { PrismaClient } from './src/generated/prisma/client';
import bcrypt from 'bcryptjs';
import { apiKeyService } from './src/lib/api-key.service';
import crypto from 'crypto';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

function generateRandomHex(length: number): string {
  return crypto.randomBytes(length / 2).toString('hex');
}

async function main() {
  console.log('Creating tenants...\n');

  // Little Bit Farm
  const littleBitFarmApiKey = `pk_live_little-bit-farm_${generateRandomHex(16)}`;
  const littleBitFarmSecretKey = `sk_live_little-bit-farm_${generateRandomHex(32)}`;
  const littleBitFarmPassword = 'LittleBit2025!';

  console.log('=== Little Bit Farm ===');
  console.log(`API Key: ${littleBitFarmApiKey}`);
  console.log(`Secret Key: ${littleBitFarmSecretKey}`);
  console.log(`Admin Email: admin@littlebitfarm.com`);
  console.log(`Admin Password: ${littleBitFarmPassword}\n`);

  const littleBitFarm = await prisma.tenant.create({
    data: {
      slug: 'little-bit-farm',
      name: 'Little Bit Farm',
      commissionPercent: 5.0,
      apiKeyPublic: littleBitFarmApiKey,
      apiKeySecret: apiKeyService.hashSecretKey(littleBitFarmSecretKey),
      stripeAccountId: null,
      stripeOnboarded: false,
      isActive: true,
      primaryColor: '#1a365d',
      secondaryColor: '#fb923c',
      accentColor: '#38b2ac',
      backgroundColor: '#ffffff',
      branding: {
        fontFamily: 'Inter, system-ui, sans-serif',
      },
    },
  });

  // Create admin user for Little Bit Farm
  const littleBitFarmAdmin = await prisma.user.create({
    data: {
      email: 'admin@littlebitfarm.com',
      name: 'Little Bit Farm Admin',
      role: 'TENANT_ADMIN',
      passwordHash: await bcrypt.hash(littleBitFarmPassword, BCRYPT_ROUNDS),
      tenantId: littleBitFarm.id,
    },
  });

  // La Petit Mariage
  const laPetitMariageApiKey = `pk_live_la-petit-mariage_${generateRandomHex(16)}`;
  const laPetitMariageSecretKey = `sk_live_la-petit-mariage_${generateRandomHex(32)}`;
  const laPetitMariagePassword = 'LaPetit2025!';

  console.log('=== La Petit Mariage ===');
  console.log(`API Key: ${laPetitMariageApiKey}`);
  console.log(`Secret Key: ${laPetitMariageSecretKey}`);
  console.log(`Admin Email: admin@lapetitmariage.com`);
  console.log(`Admin Password: ${laPetitMariagePassword}\n`);

  const laPetitMariage = await prisma.tenant.create({
    data: {
      slug: 'la-petit-mariage',
      name: 'La Petit Mariage',
      commissionPercent: 5.0,
      apiKeyPublic: laPetitMariageApiKey,
      apiKeySecret: apiKeyService.hashSecretKey(laPetitMariageSecretKey),
      stripeAccountId: null,
      stripeOnboarded: false,
      isActive: true,
      primaryColor: '#1a365d',
      secondaryColor: '#fb923c',
      accentColor: '#38b2ac',
      backgroundColor: '#ffffff',
      branding: {
        fontFamily: 'Inter, system-ui, sans-serif',
      },
    },
  });

  // Create admin user for La Petit Mariage
  const laPetitMariageAdmin = await prisma.user.create({
    data: {
      email: 'admin@lapetitmariage.com',
      name: 'La Petit Mariage Admin',
      role: 'TENANT_ADMIN',
      passwordHash: await bcrypt.hash(laPetitMariagePassword, BCRYPT_ROUNDS),
      tenantId: laPetitMariage.id,
    },
  });

  console.log('✅ Tenants created successfully!');
  console.log(`\nLittle Bit Farm ID: ${littleBitFarm.id}`);
  console.log(`Little Bit Farm Admin ID: ${littleBitFarmAdmin.id}`);
  console.log(`\nLa Petit Mariage ID: ${laPetitMariage.id}`);
  console.log(`La Petit Mariage Admin ID: ${laPetitMariageAdmin.id}`);
}

main()
  .catch((e) => {
    console.error('Error creating tenants:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
