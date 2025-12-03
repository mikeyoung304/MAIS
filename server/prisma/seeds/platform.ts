/**
 * Platform seed - Creates platform admin user only
 *
 * Use for: Production, staging
 * Requires: ADMIN_EMAIL and ADMIN_DEFAULT_PASSWORD environment variables
 */

import { PrismaClient } from '../../src/generated/prisma';
import bcrypt from 'bcryptjs';
import { logger } from '../../src/lib/core/logger';

// OWASP 2023 recommendation for bcrypt rounds
const BCRYPT_ROUNDS = 12;

export async function seedPlatform(prisma: PrismaClient): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD;
  const adminName = process.env.ADMIN_NAME || 'Platform Admin';

  if (!adminEmail) {
    throw new Error(
      'ADMIN_EMAIL environment variable is required for platform seed.\n' +
      'Set it to the platform admin email address.'
    );
  }

  if (!adminPassword) {
    throw new Error(
      'ADMIN_DEFAULT_PASSWORD environment variable is required for platform seed.\n' +
      'Generate a secure password: openssl rand -base64 32'
    );
  }

  if (adminPassword.length < 12) {
    throw new Error('ADMIN_DEFAULT_PASSWORD must be at least 12 characters');
  }

  // Check if admin user already exists (outside transaction for read-only check)
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  // Wrap seed operations in a transaction to prevent partial data on failure
  await prisma.$transaction(async (tx) => {
    if (existingAdmin) {
      // User exists - only update role and name, NEVER password
      const admin = await tx.user.update({
        where: { email: adminEmail },
        data: {
          role: 'PLATFORM_ADMIN',
          name: adminName
        }
      });
      logger.info(`Platform admin already exists (password NOT updated): ${admin.email}`);
    } else {
      // User does not exist - create with password
      const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);
      const admin = await tx.user.create({
        data: {
          email: adminEmail,
          name: adminName,
          role: 'PLATFORM_ADMIN',
          passwordHash
        }
      });
      logger.info(`Platform admin created with new password: ${admin.email}`);
    }
  }, { timeout: 30000 }); // 30 second timeout (simpler operation than demo/e2e)

  logger.info('Platform seed completed successfully');
}
