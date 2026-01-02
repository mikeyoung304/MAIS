/**
 * Vitest Configuration for Agent Evaluation Tests
 *
 * Separate config for agent capability, parity, safety, and outcome tests.
 * These tests verify agent behavior, not implementation details.
 *
 * Usage:
 *   npm run test:agent-eval           # Run all agent evaluation tests
 *   npm run test:agent-eval:parity    # Run parity tests only
 *   npm run test:agent-eval:safety    # Run safety tests only
 *   npm run test:agent-eval:outcomes  # Run outcome tests only
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test files location
    include: ['test/agent-eval/**/*.test.ts'],

    // Exclude other test directories
    exclude: ['test/unit/**', 'test/integration/**', 'node_modules/**'],

    // Root directory
    root: path.resolve(__dirname),

    // Globals for test functions
    globals: true,

    // Environment (Node for server-side tests)
    environment: 'node',

    // Timeout for agent tests (may involve async operations)
    testTimeout: 30000,

    // Pool options
    poolOptions: {
      threads: {
        // Run some tests sequentially to avoid rate limit conflicts
        singleThread: false,
      },
    },

    // Reporter
    reporters: ['default'],

    // Coverage (optional, can be enabled with --coverage)
    coverage: {
      provider: 'v8',
      include: ['src/agent/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
    },
  },

  // Resolve aliases (match server tsconfig)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
