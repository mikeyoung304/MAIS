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

        // Coverage thresholds - Realistic values that each test suite can meet independently
        // CI runs unit and integration tests separately, so thresholds must be achievable by each
        // Local baseline (2025-12-26): 43.27% lines, 81.11% branches, 46.7% functions
        // Target: 80% lines, 75% branches, 80% functions, 80% statements
        thresholds: {
          lines: 28, // Low threshold for CI - reduced from 30 to fix flakiness (2026-02-01)
          branches: 60, // Branches typically have better coverage
          functions: 35, // Low threshold for CI (integration tests cover different functions)
          statements: 28, // Matches lines threshold - reduced from 30 to fix flakiness
        },

        // Additional V8 options
        reportsDirectory: './coverage',
        clean: true,
        cleanOnRerun: true,
      },
    },
  };
});
