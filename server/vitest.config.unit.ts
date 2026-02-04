import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import path from 'path';

/**
 * Unit Test Configuration
 *
 * This config enables PARALLEL execution for unit tests.
 * - Excludes integration tests (test/integration/**)
 * - Excludes seed tests (test/seeds/**)
 * - Excludes HTTP tests (test/http/**)
 * - Uses fakes/mocks instead of real database
 *
 * Run: npm run test:unit
 * Or: vitest run --config vitest.config.unit.ts
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    resolve: {
      alias: [
        {
          find: /^(.*)\/generated\/prisma$/,
          replacement: path.resolve(__dirname, 'src/generated/prisma/client.ts'),
        },
      ],
    },
    test: {
      globals: true,
      environment: 'node',
      // Unit tests use fakes - no global setup/teardown needed
      include: ['test/**/*.{test,spec}.ts'],
      exclude: [
        // Integration tests (require real database)
        'test/integration/**',
        // HTTP tests (require running server)
        'test/http/**',
        // Seed tests (require database)
        'test/seeds/**',
        // Agent eval tests (have their own config)
        'test/agent-eval/**',
        // LLM integration tests (require real API)
        'test/llm/*.integration*.ts',
        // Templates are not tests
        'test/templates/**',
        // Fixtures and helpers are not tests
        'test/fixtures/**',
        'test/helpers/**',
        'test/mocks/**',
      ],
      // Enable parallelism for unit tests (no database contention)
      poolOptions: {
        threads: {
          singleThread: false, // Allow parallel threads
        },
      },
      fileParallelism: true, // Run test files in parallel
      // Faster timeouts for unit tests
      testTimeout: 10000,
      hookTimeout: 5000,
      // Override env to use mock storage
      env: { ...env, STORAGE_MODE: 'local', ADAPTERS_PRESET: 'mock' },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['src/**/*.ts'],
        exclude: [
          'src/**/*.spec.ts',
          'src/**/*.test.ts',
          'test/**',
          'dist/**',
          'coverage/**',
          'node_modules/**',
          'scripts/**',
          'prisma/**',
          '*.config.ts',
          '*.config.js',
          '**/*.d.ts',
          '**/index.ts',
        ],
        all: true,
        // Unit test coverage thresholds (can be higher than combined)
        thresholds: {
          lines: 25,
          branches: 55,
          functions: 30,
          statements: 25,
        },
        reportsDirectory: './coverage-unit',
        clean: true,
        cleanOnRerun: true,
      },
    },
  };
});
