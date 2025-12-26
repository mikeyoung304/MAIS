import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '');

  return {
    test: {
      globals: true,
      environment: 'node',
      // Limit parallelism for integration tests to prevent DB connection pool exhaustion
      poolOptions: {
        threads: {
          singleThread: false,
          maxThreads: 3, // Reduce parallelism to prevent connection pool exhaustion
        },
      },
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

        // Coverage thresholds - Starting with current baseline, targeting 80%
        // Baseline (2025-12-26): 43.27% lines, 81.11% branches, 46.7% functions
        // Target:  80% lines, 75% branches, 80% functions, 80% statements
        // NOTE: Thresholds disabled in CI because unit/integration tests run separately
        // and neither alone meets the combined threshold. Enable locally for full test runs.
        thresholds: process.env.CI
          ? undefined
          : {
              lines: 43, // Baseline: 43.27%, Target: 80%
              branches: 75, // Baseline: 81.11%, Target: 75% ✓
              functions: 46, // Baseline: 46.7%, Target: 80%
              statements: 43, // Baseline: 43.27%, Target: 80%
            },

        // Additional V8 options
        reportsDirectory: './coverage',
        clean: true,
        cleanOnRerun: true,
      },
    },
  };
});
