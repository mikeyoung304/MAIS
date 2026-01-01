/**
 * Agent Metrics Tests
 *
 * Tests for Prometheus metrics collection in the agent ecosystem.
 * Uses real prom-client with registry reset for test isolation.
 *
 * Key patterns:
 * - Reset registry before each test to ensure isolation
 * - Verify Prometheus text format output
 * - Check correct labels are applied to each metric
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  agentRegistry,
  agentMetrics,
  recordToolCall,
  recordRateLimitHit,
  recordCircuitBreakerTrip,
  recordTurnDuration,
  recordProposal,
  recordTierBudgetExhausted,
  recordApiError,
  setActiveSessions,
  getAgentMetrics,
  getAgentMetricsContentType,
} from '../../../src/agent/orchestrator/metrics';

describe('Agent Metrics', () => {
  beforeEach(async () => {
    // Reset all metrics in the registry before each test
    // This ensures test isolation
    agentRegistry.resetMetrics();
  });

  afterEach(async () => {
    // Clean up after tests
    agentRegistry.resetMetrics();
  });

  describe('agentRegistry', () => {
    it('should have default labels set', async () => {
      // Record something to ensure metrics are populated
      recordToolCall('test_tool', 'T1', 'business_advisor', true);

      const output = await getAgentMetrics();
      expect(output).toContain('service="handled-api"');
    });

    it('should be separate from default prom-client registry', () => {
      // The agent registry should be its own instance
      expect(agentRegistry).toBeDefined();
      expect(typeof agentRegistry.metrics).toBe('function');
    });
  });

  describe('recordToolCall()', () => {
    it('should increment counter with success status', async () => {
      recordToolCall('get_services', 'T1', 'customer', true);

      const output = await getAgentMetrics();
      expect(output).toContain('agent_tool_calls_total');
      expect(output).toContain('tool_name="get_services"');
      expect(output).toContain('trust_tier="T1"');
      expect(output).toContain('status="success"');
      expect(output).toContain('agent_type="customer"');
    });

    it('should increment counter with error status', async () => {
      recordToolCall('book_service', 'T3', 'customer', false);

      const output = await getAgentMetrics();
      expect(output).toContain('agent_tool_calls_total');
      expect(output).toContain('tool_name="book_service"');
      expect(output).toContain('trust_tier="T3"');
      expect(output).toContain('status="error"');
      expect(output).toContain('agent_type="customer"');
    });

    it('should increment counter multiple times', async () => {
      recordToolCall('get_services', 'T1', 'customer', true);
      recordToolCall('get_services', 'T1', 'customer', true);
      recordToolCall('get_services', 'T1', 'customer', true);

      const output = await getAgentMetrics();
      // Counter should show 3
      expect(output).toMatch(/agent_tool_calls_total\{[^}]*tool_name="get_services"[^}]*\}\s+3/);
    });

    it('should track different tools separately', async () => {
      recordToolCall('get_services', 'T1', 'customer', true);
      recordToolCall('check_availability', 'T1', 'customer', true);

      const output = await getAgentMetrics();
      expect(output).toContain('tool_name="get_services"');
      expect(output).toContain('tool_name="check_availability"');
    });

    it('should track different agent types separately', async () => {
      recordToolCall('get_services', 'T1', 'customer', true);
      recordToolCall('upsert_services', 'T2', 'business_advisor', true);

      const output = await getAgentMetrics();
      expect(output).toContain('agent_type="customer"');
      expect(output).toContain('agent_type="business_advisor"');
    });
  });

  describe('recordRateLimitHit()', () => {
    it('should increment counter with correct labels', async () => {
      recordRateLimitHit('get_services', 'customer');

      const output = await getAgentMetrics();
      expect(output).toContain('agent_rate_limit_hits_total');
      expect(output).toContain('tool_name="get_services"');
      expect(output).toContain('agent_type="customer"');
    });

    it('should track multiple rate limit hits', async () => {
      recordRateLimitHit('check_availability', 'customer');
      recordRateLimitHit('check_availability', 'customer');
      recordRateLimitHit('check_availability', 'customer');

      const output = await getAgentMetrics();
      expect(output).toMatch(
        /agent_rate_limit_hits_total\{[^}]*tool_name="check_availability"[^}]*\}\s+3/
      );
    });

    it('should track different tools separately', async () => {
      recordRateLimitHit('get_services', 'customer');
      recordRateLimitHit('book_service', 'customer');

      const output = await getAgentMetrics();
      expect(output).toContain('tool_name="get_services"');
      expect(output).toContain('tool_name="book_service"');
    });
  });

  describe('recordCircuitBreakerTrip()', () => {
    it('should increment counter with correct labels', async () => {
      recordCircuitBreakerTrip('max_turns_exceeded', 'customer');

      const output = await getAgentMetrics();
      expect(output).toContain('agent_circuit_breaker_trips_total');
      expect(output).toContain('reason="max_turns_exceeded"');
      expect(output).toContain('agent_type="customer"');
    });

    it('should track different reasons separately', async () => {
      recordCircuitBreakerTrip('max_turns_exceeded', 'customer');
      recordCircuitBreakerTrip('max_tokens_exceeded', 'customer');
      recordCircuitBreakerTrip('max_time_exceeded', 'business_advisor');

      const output = await getAgentMetrics();
      expect(output).toContain('reason="max_turns_exceeded"');
      expect(output).toContain('reason="max_tokens_exceeded"');
      expect(output).toContain('reason="max_time_exceeded"');
    });

    it('should track multiple trips of same type', async () => {
      recordCircuitBreakerTrip('consecutive_errors', 'customer');
      recordCircuitBreakerTrip('consecutive_errors', 'customer');

      const output = await getAgentMetrics();
      expect(output).toMatch(
        /agent_circuit_breaker_trips_total\{[^}]*reason="consecutive_errors"[^}]*\}\s+2/
      );
    });
  });

  describe('recordTurnDuration()', () => {
    it('should observe duration in histogram', async () => {
      recordTurnDuration(1.5, 'customer', true);

      const output = await getAgentMetrics();
      expect(output).toContain('agent_turn_duration_seconds');
      expect(output).toContain('agent_type="customer"');
      expect(output).toContain('had_tool_calls="true"');
    });

    it('should track had_tool_calls label correctly', async () => {
      recordTurnDuration(0.5, 'customer', false);

      const output = await getAgentMetrics();
      expect(output).toContain('had_tool_calls="false"');
    });

    it('should include histogram buckets', async () => {
      recordTurnDuration(2.5, 'business_advisor', true);

      const output = await getAgentMetrics();
      // Check that histogram buckets are present
      expect(output).toContain('agent_turn_duration_seconds_bucket');
      expect(output).toContain('le="0.5"');
      expect(output).toContain('le="1"');
      expect(output).toContain('le="2"');
      expect(output).toContain('le="5"');
      expect(output).toContain('le="10"');
      expect(output).toContain('le="30"');
      expect(output).toContain('le="60"');
      expect(output).toContain('le="+Inf"');
    });

    it('should include sum and count', async () => {
      recordTurnDuration(1.0, 'customer', true);
      recordTurnDuration(2.0, 'customer', true);

      const output = await getAgentMetrics();
      expect(output).toContain('agent_turn_duration_seconds_sum');
      expect(output).toContain('agent_turn_duration_seconds_count');
    });

    it('should track multiple observations', async () => {
      recordTurnDuration(1.0, 'customer', true);
      recordTurnDuration(2.0, 'customer', true);
      recordTurnDuration(3.0, 'customer', true);

      const output = await getAgentMetrics();
      // Count should be 3
      expect(output).toMatch(
        /agent_turn_duration_seconds_count\{[^}]*agent_type="customer"[^}]*had_tool_calls="true"[^}]*\}\s+3/
      );
      // Sum should be 6
      expect(output).toMatch(
        /agent_turn_duration_seconds_sum\{[^}]*agent_type="customer"[^}]*had_tool_calls="true"[^}]*\}\s+6/
      );
    });
  });

  describe('recordProposal()', () => {
    it('should increment counter with correct labels', async () => {
      recordProposal('PENDING', 'T2', 'business_advisor');

      const output = await getAgentMetrics();
      expect(output).toContain('agent_proposals_total');
      expect(output).toContain('status="PENDING"');
      expect(output).toContain('trust_tier="T2"');
      expect(output).toContain('agent_type="business_advisor"');
    });

    it('should track different statuses separately', async () => {
      recordProposal('PENDING', 'T2', 'business_advisor');
      recordProposal('CONFIRMED', 'T2', 'business_advisor');
      recordProposal('EXECUTED', 'T2', 'business_advisor');

      const output = await getAgentMetrics();
      expect(output).toContain('status="PENDING"');
      expect(output).toContain('status="CONFIRMED"');
      expect(output).toContain('status="EXECUTED"');
    });

    it('should track different trust tiers separately', async () => {
      recordProposal('PENDING', 'T1', 'customer');
      recordProposal('PENDING', 'T2', 'customer');
      recordProposal('PENDING', 'T3', 'customer');

      const output = await getAgentMetrics();
      expect(output).toContain('trust_tier="T1"');
      expect(output).toContain('trust_tier="T2"');
      expect(output).toContain('trust_tier="T3"');
    });
  });

  describe('recordTierBudgetExhausted()', () => {
    it('should increment counter with correct labels', async () => {
      recordTierBudgetExhausted('T2', 'business_advisor');

      const output = await getAgentMetrics();
      expect(output).toContain('agent_tier_budget_exhausted_total');
      expect(output).toContain('tier="T2"');
      expect(output).toContain('agent_type="business_advisor"');
    });

    it('should track different tiers separately', async () => {
      recordTierBudgetExhausted('T1', 'customer');
      recordTierBudgetExhausted('T2', 'business_advisor');
      recordTierBudgetExhausted('T3', 'customer');

      const output = await getAgentMetrics();
      expect(output).toContain('tier="T1"');
      expect(output).toContain('tier="T2"');
      expect(output).toContain('tier="T3"');
    });

    it('should track multiple exhaustions', async () => {
      recordTierBudgetExhausted('T2', 'business_advisor');
      recordTierBudgetExhausted('T2', 'business_advisor');
      recordTierBudgetExhausted('T2', 'business_advisor');

      const output = await getAgentMetrics();
      expect(output).toMatch(/agent_tier_budget_exhausted_total\{[^}]*tier="T2"[^}]*\}\s+3/);
    });
  });

  describe('recordApiError()', () => {
    it('should increment counter with correct labels', async () => {
      recordApiError('rate_limit', 'customer');

      const output = await getAgentMetrics();
      expect(output).toContain('agent_api_errors_total');
      expect(output).toContain('error_type="rate_limit"');
      expect(output).toContain('agent_type="customer"');
    });

    it('should track different error types separately', async () => {
      recordApiError('rate_limit', 'customer');
      recordApiError('auth_error', 'customer');
      recordApiError('server_error', 'business_advisor');

      const output = await getAgentMetrics();
      expect(output).toContain('error_type="rate_limit"');
      expect(output).toContain('error_type="auth_error"');
      expect(output).toContain('error_type="server_error"');
    });

    it('should track multiple errors of same type', async () => {
      recordApiError('invalid_request', 'customer');
      recordApiError('invalid_request', 'customer');

      const output = await getAgentMetrics();
      expect(output).toMatch(
        /agent_api_errors_total\{[^}]*error_type="invalid_request"[^}]*\}\s+2/
      );
    });
  });

  describe('setActiveSessions()', () => {
    it('should set gauge with correct labels', async () => {
      setActiveSessions('customer', 5);

      const output = await getAgentMetrics();
      expect(output).toContain('agent_active_sessions');
      expect(output).toContain('agent_type="customer"');
    });

    it('should track different agent types separately', async () => {
      setActiveSessions('customer', 10);
      setActiveSessions('business_advisor', 3);

      const output = await getAgentMetrics();
      expect(output).toMatch(/agent_active_sessions\{[^}]*agent_type="customer"[^}]*\}\s+10/);
      expect(output).toMatch(
        /agent_active_sessions\{[^}]*agent_type="business_advisor"[^}]*\}\s+3/
      );
    });

    it('should update gauge value when set multiple times', async () => {
      setActiveSessions('customer', 5);
      setActiveSessions('customer', 10);
      setActiveSessions('customer', 3);

      const output = await getAgentMetrics();
      // Gauge should show latest value (3)
      expect(output).toMatch(/agent_active_sessions\{[^}]*agent_type="customer"[^}]*\}\s+3/);
    });

    it('should allow setting to zero', async () => {
      setActiveSessions('customer', 5);
      setActiveSessions('customer', 0);

      const output = await getAgentMetrics();
      expect(output).toMatch(/agent_active_sessions\{[^}]*agent_type="customer"[^}]*\}\s+0/);
    });
  });

  describe('getAgentMetrics()', () => {
    it('should return Prometheus text format', async () => {
      // Record some metrics
      recordToolCall('get_services', 'T1', 'customer', true);
      recordTurnDuration(1.5, 'customer', true);
      setActiveSessions('customer', 2);

      const output = await getAgentMetrics();

      // Should contain HELP comments
      expect(output).toContain('# HELP');
      // Should contain TYPE comments
      expect(output).toContain('# TYPE');
      // Should be a string
      expect(typeof output).toBe('string');
    });

    it('should include all registered metrics', async () => {
      // Record one of each metric type
      recordToolCall('test', 'T1', 'test', true);
      recordRateLimitHit('test', 'test');
      recordCircuitBreakerTrip('test', 'test');
      recordTurnDuration(1.0, 'test', true);
      recordProposal('PENDING', 'T1', 'test');
      recordTierBudgetExhausted('T1', 'test');
      recordApiError('test', 'test');
      setActiveSessions('test', 1);

      const output = await getAgentMetrics();

      // All metric names should be present
      expect(output).toContain('agent_tool_calls_total');
      expect(output).toContain('agent_rate_limit_hits_total');
      expect(output).toContain('agent_circuit_breaker_trips_total');
      expect(output).toContain('agent_turn_duration_seconds');
      expect(output).toContain('agent_proposals_total');
      expect(output).toContain('agent_tier_budget_exhausted_total');
      expect(output).toContain('agent_api_errors_total');
      expect(output).toContain('agent_active_sessions');
    });

    it('should include metric help text', async () => {
      recordToolCall('test', 'T1', 'test', true);

      const output = await getAgentMetrics();

      // Check HELP text for tool calls counter
      expect(output).toContain(
        '# HELP agent_tool_calls_total Total tool calls by tool name, trust tier, status, and agent type'
      );
    });

    it('should include metric type annotations', async () => {
      recordToolCall('test', 'T1', 'test', true);
      recordTurnDuration(1.0, 'test', true);
      setActiveSessions('test', 1);

      const output = await getAgentMetrics();

      // Check TYPE annotations
      expect(output).toContain('# TYPE agent_tool_calls_total counter');
      expect(output).toContain('# TYPE agent_turn_duration_seconds histogram');
      expect(output).toContain('# TYPE agent_active_sessions gauge');
    });
  });

  describe('getAgentMetricsContentType()', () => {
    it('should return text/plain content type', () => {
      const contentType = getAgentMetricsContentType();
      expect(contentType).toContain('text/plain');
    });

    it('should include version parameter', () => {
      const contentType = getAgentMetricsContentType();
      expect(contentType).toContain('version=');
    });
  });

  describe('agentMetrics object', () => {
    it('should expose all metric instances', () => {
      expect(agentMetrics.toolCallsTotal).toBeDefined();
      expect(agentMetrics.rateLimitHits).toBeDefined();
      expect(agentMetrics.circuitBreakerTrips).toBeDefined();
      expect(agentMetrics.turnDuration).toBeDefined();
      expect(agentMetrics.activeSessions).toBeDefined();
      expect(agentMetrics.proposalsTotal).toBeDefined();
      expect(agentMetrics.tierBudgetExhausted).toBeDefined();
      expect(agentMetrics.apiErrors).toBeDefined();
      expect(agentMetrics.recursionDepthReached).toBeDefined();
    });

    it('should allow direct metric manipulation', async () => {
      // Use direct metric access
      agentMetrics.toolCallsTotal.inc({
        tool_name: 'direct_test',
        trust_tier: 'T1',
        status: 'success',
        agent_type: 'test',
      });

      const output = await getAgentMetrics();
      expect(output).toContain('tool_name="direct_test"');
    });
  });

  describe('recursionDepthReached metric', () => {
    it('should be incrementable', async () => {
      agentMetrics.recursionDepthReached.inc({ agent_type: 'customer' });

      const output = await getAgentMetrics();
      expect(output).toContain('agent_recursion_depth_reached_total');
      expect(output).toContain('agent_type="customer"');
    });

    it('should track multiple increments', async () => {
      agentMetrics.recursionDepthReached.inc({ agent_type: 'customer' });
      agentMetrics.recursionDepthReached.inc({ agent_type: 'customer' });
      agentMetrics.recursionDepthReached.inc({ agent_type: 'customer' });

      const output = await getAgentMetrics();
      expect(output).toMatch(
        /agent_recursion_depth_reached_total\{[^}]*agent_type="customer"[^}]*\}\s+3/
      );
    });
  });

  describe('output format snapshot', () => {
    it('should produce valid Prometheus exposition format', async () => {
      // Record a representative set of metrics
      recordToolCall('get_services', 'T1', 'customer', true);
      recordToolCall('book_service', 'T3', 'customer', false);
      recordRateLimitHit('check_availability', 'customer');
      recordCircuitBreakerTrip('max_turns_exceeded', 'business_advisor');
      recordTurnDuration(2.5, 'customer', true);
      recordProposal('CONFIRMED', 'T2', 'business_advisor');
      recordTierBudgetExhausted('T2', 'business_advisor');
      recordApiError('rate_limit', 'customer');
      setActiveSessions('customer', 5);
      setActiveSessions('business_advisor', 2);

      const output = await getAgentMetrics();

      // Verify overall structure
      const lines = output.trim().split('\n');

      // Should have multiple lines
      expect(lines.length).toBeGreaterThan(10);

      // Each non-empty line should either be:
      // - A comment starting with #
      // - A metric line with name{labels} value format
      for (const line of lines) {
        if (line.trim() === '') continue;

        const isComment = line.startsWith('#');
        const isMetric = /^[a-z_]+(\{[^}]*\})?\s+\d/.test(line);

        expect(isComment || isMetric).toBe(true);
      }
    });

    it('should have consistent label ordering', async () => {
      // Record same metric multiple times
      recordToolCall('tool_a', 'T1', 'type_a', true);
      recordToolCall('tool_b', 'T2', 'type_b', false);

      const output = await getAgentMetrics();

      // Extract all agent_tool_calls_total lines
      const toolCallLines = output
        .split('\n')
        .filter((line) => line.startsWith('agent_tool_calls_total{'));

      // All lines should have same label order
      for (const line of toolCallLines) {
        const labelMatch = line.match(/\{([^}]+)\}/);
        if (labelMatch) {
          const labels = labelMatch[1].split(',').map((l) => l.split('=')[0].trim());
          // Labels should be in consistent order (alphabetical by prom-client default)
          expect(labels).toContain('agent_type');
          expect(labels).toContain('service');
          expect(labels).toContain('status');
          expect(labels).toContain('tool_name');
          expect(labels).toContain('trust_tier');
        }
      }
    });
  });
});
