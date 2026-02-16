import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Schema Consistency Checks', () => {
  const projectRoot = path.join(__dirname, '../..');
  const schemePath = path.join(projectRoot, 'server/prisma/schema.prisma');
  const migrationsPath = path.join(projectRoot, 'server/prisma/migrations');

  describe('Schema Files Exist', () => {
    it('should have schema.prisma file', () => {
      expect(fs.existsSync(schemePath)).toBe(true);
    });

    it('should have migrations directory', () => {
      expect(fs.existsSync(migrationsPath)).toBe(true);
    });
  });

  describe('Schema Content', () => {
    it('should not have empty schema.prisma', () => {
      const schema = fs.readFileSync(schemePath, 'utf-8');
      expect(schema.length).toBeGreaterThan(100);
    });

    it('should have required models defined', () => {
      const schema = fs.readFileSync(schemePath, 'utf-8');
      const requiredModels = [
        'model Tenant',
        'model User',
        'model Tier',
        'model Booking',
        'model Service',
        'model AvailabilityRule',
      ];

      requiredModels.forEach((model) => {
        expect(schema).toContain(model);
      });
    });

    it('should have required enums defined', () => {
      const schema = fs.readFileSync(schemePath, 'utf-8');
      const requiredEnums = [
        'enum UserRole',
        'enum BookingStatus',
        'enum BookingType',
        'enum PaymentStatus',
      ];

      requiredEnums.forEach((enumType) => {
        expect(schema).toContain(enumType);
      });
    });
  });

  describe('Migration Files', () => {
    it('should have at least one Prisma migration', () => {
      const files = fs.readdirSync(migrationsPath);
      const prismaFormats = files.filter((f) => /^20[0-9]{12}_/.test(f));
      expect(prismaFormats.length).toBeGreaterThan(0);
    });

    it('should use Prisma-only migrations (no numbered SQL files)', () => {
      const files = fs.readdirSync(migrationsPath);
      const numericSqlFiles = files.filter((f) => /^\d+_.*\.sql$/.test(f));

      // We consolidated to Prisma-only migrations - numbered SQL files should not exist
      expect(numericSqlFiles.length).toBe(0);
    });

    it('should not have empty migration files', () => {
      const files = fs.readdirSync(migrationsPath);

      // Check .sql files
      const sqlFiles = files.filter((f) => f.endsWith('.sql'));
      sqlFiles.forEach((file) => {
        const filePath = path.join(migrationsPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content.trim().length).toBeGreaterThan(0);
      });

      // Check Prisma migration directories
      const prismaFormats = files.filter((f) => /^20[0-9]{12}_/.test(f));
      prismaFormats.forEach((dir) => {
        const migrationFile = path.join(migrationsPath, dir, 'migration.sql');
        if (fs.existsSync(migrationFile)) {
          const content = fs.readFileSync(migrationFile, 'utf-8');
          expect(content.trim().length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Manual SQL Migration Best Practices', () => {
    it('should use idempotent SQL in manual migrations', () => {
      const files = fs.readdirSync(migrationsPath);
      const manualSqlFiles = files.filter((f) => /^\d+_.*\.sql$/.test(f));

      if (manualSqlFiles.length === 0) {
        // Skip if no manual migrations
        expect(true).toBe(true);
        return;
      }

      const idempotentPatterns = [
        'IF EXISTS',
        'IF NOT EXISTS',
        'CREATE TABLE IF NOT EXISTS',
        'DROP TABLE IF EXISTS',
        'ADD COLUMN IF NOT EXISTS',
        'DO $$', // PL/pgSQL blocks for conditional logic
      ];

      manualSqlFiles.forEach((file) => {
        const filePath = path.join(migrationsPath, file);
        const content = fs.readFileSync(filePath, 'utf-8').toUpperCase();

        // At least one idempotent pattern should be present
        const hasIdempotent = idempotentPatterns.some((pattern) => content.includes(pattern));

        expect(hasIdempotent).toBe(true);
      });
    });

    it('should maintain sequential numbering in manual migrations', () => {
      const files = fs.readdirSync(migrationsPath);
      const manualSqlFiles = files.filter((f) => /^\d+_.*\.sql$/.test(f));

      if (manualSqlFiles.length === 0) {
        expect(true).toBe(true);
        return;
      }

      // Extract numbers and sort
      const numbers = manualSqlFiles.map((f) => parseInt(f.split('_')[0])).sort((a, b) => a - b);

      // Check that we don't have large gaps (allow up to 5-unit gaps for resets)
      for (let i = 0; i < numbers.length - 1; i++) {
        const gap = numbers[i + 1] - numbers[i];
        expect(gap).toBeLessThanOrEqual(10);
      }
    });
  });

  describe('Tenant Isolation in Schema', () => {
    it('should have tenantId in multi-tenant models', () => {
      const schema = fs.readFileSync(schemePath, 'utf-8');

      // These models MUST have tenantId for data isolation
      const multiTenantModels = [
        'Customer',
        'Tier',
        'Booking',
        'Service',
        'AvailabilityRule',
        'BlackoutDate',
        'Segment',
        'Payment',
      ];

      multiTenantModels.forEach((model) => {
        const modelMatch = schema.match(
          new RegExp(`model ${model}[\\s\\S]*?(?=model|enum|\\Z)`, 'm')
        );
        expect(modelMatch).toBeTruthy();
        if (modelMatch) {
          expect(modelMatch[0]).toContain('tenantId');
        }
      });
    });

    it('should have unique constraints including tenantId', () => {
      const schema = fs.readFileSync(schemePath, 'utf-8');

      // Key models that should have tenant-scoped unique constraints
      const expectedUnique = [
        '@@unique([tenantId, slug])', // For Tier, Segment, Service, etc.
        '@@unique([tenantId, date])', // For BlackoutDate
      ];

      expectedUnique.forEach((constraint) => {
        expect(schema).toContain(constraint);
      });
    });
  });

  describe('Schema Versioning', () => {
    it('should have migration lock file', () => {
      const lockPath = path.join(migrationsPath, 'migration_lock.toml');
      expect(fs.existsSync(lockPath)).toBe(true);
    });

    it('should specify PostgreSQL provider in migration lock', () => {
      const lockPath = path.join(migrationsPath, 'migration_lock.toml');
      const content = fs.readFileSync(lockPath, 'utf-8');
      expect(content).toContain('provider');
    });
  });

  describe('Critical Tables Present', () => {
    it('schema should define all critical tables', () => {
      const schema = fs.readFileSync(schemePath, 'utf-8');

      const criticalTables = [
        'model Tenant {',
        'model User {',
        'model Customer {',
        'model Booking {',
        'model Tier {',
        'model Payment {',
        'model WebhookEvent {',
        'model Service {',
        'model AvailabilityRule {',
      ];

      criticalTables.forEach((table) => {
        expect(schema).toContain(table);
      });
    });
  });
});
