import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '');

  return {
    resolve: {
      alias: [
        // Prisma 7 generates client.ts, not index.ts - use regex to catch all relative paths
        {
          find: /^(.*)\/generated\/prisma$/,
          replacement: path.resolve(__dirname, 'src/generated/prisma/client.ts'),
        },
        // Resolve workspace packages from TypeScript source instead of dist/
        // This avoids the "Failed to resolve entry for package" error when dist/
        // is stale or missing (dist/ is gitignored, so fresh clones and CI fail)
        {
          find: '@macon/contracts',
          replacement: path.resolve(__dirname, '../packages/contracts/src/index.ts'),
        },
        {
          find: '@macon/shared',
          replacement: path.resolve(__dirname, '../packages/shared/src/index.ts'),
        },
      ],
    },
    test: {
      globals: true,
      environment: 'node',
      // Global setup cleans orphaned test tenants before running tests
      // Global teardown disconnects singleton PrismaClient after all tests
      globalSetup: ['./test/helpers/vitest-global-setup.ts'],
      globalTeardown: ['./test/helpers/vitest-global-teardown.ts'],
      // Limit parallelism for integration tests to prevent DB connection pool exhaustion
      // Supabase Session mode has strict pool limits - run tests serially
      poolOptions: {
        threads: {
          singleThread: true, // Run all tests in single thread to avoid pool exhaustion
        },
      },
      // Run test files sequentially to prevent connection pool exhaustion
      fileParallelism: false,
      // Timeout for individual tests (30s) - fail fast instead of hanging
      testTimeout: 30000,
      // Hook timeout (10s) - prevent beforeAll/afterAll from hanging
      hookTimeout: 10000,
      // Override env to use local storage (not Supabase) for file uploads in tests
      env: { ...env, STORAGE_MODE: 'local' },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html', 'lcov'],
        include: ['src/**/*.ts'],
        exclude: [
          // Test files
          'src/**/*.spec.ts',
          'src/**/*.test.ts',
          'test/**',
          '**/*.test.ts',
          '**/*.spec.ts',

          // Build artifacts
          'dist/**',
          'coverage/**',
          'node_modules/**',

          // Configuration and scripts
          'scripts/**',
          'prisma/**',
          '*.config.ts',
          '*.config.js',

          // Type definitions
          '**/*.d.ts',

          // Index/barrel files (often just re-exports)
          '**/index.ts',
        ],
        all: true,

        // Coverage thresholds — per-directory to match actual risk profiles.
        // CI runs unit and integration tests separately, so thresholds must be achievable by each.
        // Baseline measured 2026-02-06 from CI run. Thresholds set ~5% below current.
        // Target direction: ratchet UP as tests are added, never down.
        thresholds: {
          // Global floor — catches new directories without explicit thresholds
          lines: 25,
          branches: 55,
          functions: 30,
          statements: 25,

          // Business logic — highest standards (current: 38.25% lines, 81.71% branches)
          'src/services/**': { lines: 33, branches: 75, functions: 45, statements: 33 },

          // Core library — unit tests alone yield ~54% (subdirs drag average: errors 30%, mappers 5%)
          // CI aggregate shows 68% but that includes integration coverage contribution
          'src/lib/**': { lines: 50, branches: 80, functions: 40, statements: 50 },

          // LLM utilities — regressed after vertex-client changes (current: 44% lines, 44% branches)
          'src/llm/**': { lines: 40, branches: 40, functions: 0, statements: 40 },

          // Middleware — moderate (current: 55.68% lines)
          'src/middleware/**': { lines: 50, branches: 60, functions: 15, statements: 50 },

          // Validation — perfect, keep it (current: 100% lines)
          'src/validation/**': { lines: 95, branches: 95, functions: 95, statements: 95 },
        },

        // Additional V8 options
        reportsDirectory: './coverage',
        clean: true,
        cleanOnRerun: true,
      },
    },
  };
});
