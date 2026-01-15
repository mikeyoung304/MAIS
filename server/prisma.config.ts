/**
 * Prisma 7 Configuration File
 *
 * This file configures Prisma CLI behavior for migrations, seeding, and schema location.
 * Environment variables are loaded explicitly (not auto-loaded in Prisma 7).
 *
 * In Prisma 7, database URLs moved from schema.prisma to this config file.
 */
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  // Schema file location (relative to this config file)
  schema: 'prisma/schema.prisma',

  // Migration settings
  migrations: {
    // Migration files directory
    path: 'prisma/migrations',
    // Seed command (using tsx for TypeScript support)
    seed: 'npx tsx prisma/seed.ts',
  },

  // Datasource configuration (moved from schema.prisma in Prisma 7)
  // NOTE: Using process.env with fallback for prisma generate (no DB needed)
  // env() throws when variable is missing, but generate doesn't need a real URL
  datasource: {
    // Main connection URL (used by migrations and CLI)
    // Falls back to placeholder for prisma generate (no actual DB connection needed)
    url:
      process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
    // Direct URL bypasses connection pooler for migrations
    // Made optional for prisma generate (only needed for migrations)
    directUrl:
      process.env.DIRECT_URL ||
      process.env.DATABASE_URL ||
      'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
});
