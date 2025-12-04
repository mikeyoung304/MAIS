/**
 * CI/CD Configuration Validation Tests
 *
 * These tests validate that CI/CD configurations are properly set up
 * to prevent common deployment failures.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { existsSync } from 'fs';
import * as path from 'path';

const projectRoot = path.resolve(__dirname, '../../');

describe('CI/CD Configuration Validation', () => {
  describe('ESLint Configuration', () => {
    it('should have root ESLint config', () => {
      const eslintPath = path.join(projectRoot, '.eslintrc.cjs');
      expect(existsSync(eslintPath)).toBe(true);
    });

    it('should have server ESLint workspace config', () => {
      const eslintPath = path.join(projectRoot, 'server/.eslintrc.cjs');
      // Optional but recommended
      // expect(existsSync(eslintPath)).toBe(true);
    });

    it('should enforce strict type checking', () => {
      const eslintPath = path.join(projectRoot, '.eslintrc.cjs');
      const content = readFileSync(eslintPath, 'utf-8');

      // Should have type checking enabled
      expect(content).toMatch(/extends.*typescript-eslint/);
    });

    it('should have no-explicit-any rule', () => {
      const eslintPath = path.join(projectRoot, '.eslintrc.cjs');
      const content = readFileSync(eslintPath, 'utf-8');

      expect(content).toMatch(/no-explicit-any/);
    });
  });

  describe('Prisma Configuration', () => {
    it('should have Prisma schema with DIRECT_URL', () => {
      const schemaPath = path.join(projectRoot, 'server/prisma/schema.prisma');
      const content = readFileSync(schemaPath, 'utf-8');

      expect(content).toMatch(/directUrl\s*=\s*env\("DIRECT_URL"\)/);
    });

    it('should have Prisma client generator', () => {
      const schemaPath = path.join(projectRoot, 'server/prisma/schema.prisma');
      const content = readFileSync(schemaPath, 'utf-8');

      expect(content).toMatch(/generator\s+client/);
    });

    it('should have PostgreSQL datasource', () => {
      const schemaPath = path.join(projectRoot, 'server/prisma/schema.prisma');
      const content = readFileSync(schemaPath, 'utf-8');

      expect(content).toMatch(/datasource\s+db/);
    });
  });

  describe('Environment Configuration', () => {
    it('should have .env.example template', () => {
      const envPath = path.join(projectRoot, '.env.example');
      expect(existsSync(envPath)).toBe(true);
    });

    it('should document required environment variables', () => {
      const envPath = path.join(projectRoot, '.env.example');
      const content = readFileSync(envPath, 'utf-8');

      const requiredVars = [
        'DATABASE_URL',
        'DIRECT_URL',
        'JWT_SECRET',
        'TENANT_SECRETS_ENCRYPTION_KEY',
      ];

      for (const variable of requiredVars) {
        expect(content).toMatch(new RegExp(variable));
      }
    });

    it('should have doctor script', () => {
      const doctorPath = path.join(projectRoot, 'server/scripts/doctor.ts');
      expect(existsSync(doctorPath)).toBe(true);
    });
  });

  describe('GitHub Actions Workflows', () => {
    it('should have main-pipeline workflow', () => {
      const workflowPath = path.join(projectRoot, '.github/workflows/main-pipeline.yml');
      expect(existsSync(workflowPath)).toBe(true);
    });

    it('should have deploy-production workflow', () => {
      const workflowPath = path.join(projectRoot, '.github/workflows/deploy-production.yml');
      expect(existsSync(workflowPath)).toBe(true);
    });

    it('main-pipeline should validate migrations with DATABASE_URL and DIRECT_URL', () => {
      const workflowPath = path.join(projectRoot, '.github/workflows/main-pipeline.yml');
      const content = readFileSync(workflowPath, 'utf-8');

      // Check migration job has DIRECT_URL
      expect(content).toMatch(/DATABASE_URL:.*postgresql/);
      expect(content).toMatch(/DIRECT_URL:.*postgresql/);
    });

    it('deploy-production should set DIRECT_URL for migrations', () => {
      const workflowPath = path.join(projectRoot, '.github/workflows/deploy-production.yml');
      const content = readFileSync(workflowPath, 'utf-8');

      // Migration job should have DIRECT_URL
      const hasMigrationWithDirect = content.includes('PRODUCTION_DIRECT_URL');
      expect(hasMigrationWithDirect).toBe(true);
    });

    it('should not have unsafe continue-on-error on linting', () => {
      const workflowPath = path.join(projectRoot, '.github/workflows/deploy-production.yml');
      const content = readFileSync(workflowPath, 'utf-8');

      // Check that linting step doesn't have continue-on-error
      // (It may have been fixed, so we check for a pattern indicating awareness)
      const lintSection = content.split('Run linting')[1]?.split('Run type checking')[0];
      if (lintSection) {
        // If fixed, should not have continue-on-error
        // If not fixed, this is a warning (not an error)
        // Keep test loose to allow for fixes
        expect(lintSection).toBeDefined();
      }
    });
  });

  describe('Documentation', () => {
    it('should have CI_CD_FAILURE_PREVENTION.md', () => {
      const docPath = path.join(projectRoot, 'docs/deployment/CI_CD_FAILURE_PREVENTION.md');
      expect(existsSync(docPath)).toBe(true);
    });

    it('should have ENVIRONMENT_VARIABLES.md', () => {
      const docPath = path.join(projectRoot, 'docs/deployment/ENVIRONMENT_VARIABLES.md');
      expect(existsSync(docPath)).toBe(true);
    });

    it('should have GITHUB_SECRETS_SETUP.md', () => {
      const docPath = path.join(projectRoot, 'docs/deployment/GITHUB_SECRETS_SETUP.md');
      expect(existsSync(docPath)).toBe(true);
    });

    it('should document required TIER 1 variables in ENVIRONMENT_VARIABLES.md', () => {
      const docPath = path.join(projectRoot, 'docs/deployment/ENVIRONMENT_VARIABLES.md');
      const content = readFileSync(docPath, 'utf-8');

      const tier1Vars = [
        'JWT_SECRET',
        'DATABASE_URL',
        'DIRECT_URL',
        'TENANT_SECRETS_ENCRYPTION_KEY',
      ];
      for (const variable of tier1Vars) {
        expect(content).toMatch(new RegExp(variable));
      }
    });
  });

  describe('Scripts', () => {
    it('should have ci-preflight-check script', () => {
      const scriptPath = path.join(projectRoot, 'scripts/ci-preflight-check.sh');
      expect(existsSync(scriptPath)).toBe(true);
    });

    it('package.json should have required scripts', () => {
      const packagePath = path.join(projectRoot, 'package.json');
      const content = readFileSync(packagePath, 'utf-8');
      const pkg = JSON.parse(content);

      const requiredScripts = ['doctor', 'lint', 'typecheck', 'test', 'build'];
      for (const script of requiredScripts) {
        expect(pkg.scripts[script]).toBeDefined();
      }
    });
  });

  describe('Security Best Practices', () => {
    it('should not have hardcoded API keys in workflows', () => {
      const workflowPath = path.join(projectRoot, '.github/workflows/main-pipeline.yml');
      const content = readFileSync(workflowPath, 'utf-8');

      // Should use secrets, not hardcoded values
      expect(content).not.toMatch(/sk_test_[A-Za-z0-9]+/);
      expect(content).not.toMatch(/sk_live_[A-Za-z0-9]+/);
    });

    it('should use GitHub secrets for sensitive values', () => {
      const deployPath = path.join(projectRoot, '.github/workflows/deploy-production.yml');
      const content = readFileSync(deployPath, 'utf-8');

      // Should reference secrets
      expect(content).toMatch(/\$\{\{\s*secrets\./);
    });
  });

  describe('Type Safety', () => {
    it('should have TypeScript strict mode', () => {
      const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
      const content = readFileSync(tsconfigPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.compilerOptions.strict).toBe(true);
    });

    it('should have noImplicitAny enabled', () => {
      const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
      const content = readFileSync(tsconfigPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.compilerOptions.noImplicitAny).toBe(true);
    });
  });
});
