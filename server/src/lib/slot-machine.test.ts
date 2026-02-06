import { describe, it, expect } from 'vitest';
import { computeSlotMachine, computeCurrentPhase, PHASE_ORDER } from './slot-machine';

describe('computeCurrentPhase', () => {
  it('returns NOT_STARTED with no facts', () => {
    expect(computeCurrentPhase([])).toBe('NOT_STARTED');
  });

  it('returns DISCOVERY when businessType is known', () => {
    expect(computeCurrentPhase(['businessType'])).toBe('DISCOVERY');
  });

  it('returns MARKET_RESEARCH when location is known', () => {
    expect(computeCurrentPhase(['businessType', 'location'])).toBe('MARKET_RESEARCH');
  });

  it('returns SERVICES when servicesOffered is known', () => {
    expect(computeCurrentPhase(['businessType', 'location', 'servicesOffered'])).toBe('SERVICES');
  });

  it('returns SERVICES when priceRange is known (alternative path)', () => {
    expect(computeCurrentPhase(['priceRange'])).toBe('SERVICES');
  });

  it('returns MARKETING when uniqueValue is known', () => {
    expect(computeCurrentPhase(['businessType', 'uniqueValue'])).toBe('MARKETING');
  });

  it('returns MARKETING when testimonial is known', () => {
    expect(computeCurrentPhase(['testimonial'])).toBe('MARKETING');
  });
});

describe('PHASE_ORDER', () => {
  it('has monotonically increasing order', () => {
    expect(PHASE_ORDER['NOT_STARTED']).toBeLessThan(PHASE_ORDER['DISCOVERY']);
    expect(PHASE_ORDER['DISCOVERY']).toBeLessThan(PHASE_ORDER['MARKET_RESEARCH']);
    expect(PHASE_ORDER['MARKET_RESEARCH']).toBeLessThan(PHASE_ORDER['SERVICES']);
    expect(PHASE_ORDER['SERVICES']).toBeLessThan(PHASE_ORDER['MARKETING']);
    expect(PHASE_ORDER['MARKETING']).toBeLessThan(PHASE_ORDER['COMPLETED']);
  });

  it('treats COMPLETED and SKIPPED as equal', () => {
    expect(PHASE_ORDER['COMPLETED']).toBe(PHASE_ORDER['SKIPPED']);
  });
});

describe('computeSlotMachine', () => {
  it('returns ASK with no facts', () => {
    const result = computeSlotMachine([]);
    expect(result.nextAction).toBe('ASK');
    expect(result.readySections).toEqual([]);
    expect(result.missingForNext.length).toBeGreaterThan(0);
    expect(result.slotMetrics.filled).toBe(0);
    expect(result.slotMetrics.utilization).toBe(0);
  });

  it('shows hero as ready after businessType', () => {
    const result = computeSlotMachine(['businessType']);
    expect(result.readySections).toContain('hero');
    expect(result.readySections).toContain('contact');
    expect(result.readySections).toContain('cta');
  });

  it('shows about as ready after businessType + uniqueValue', () => {
    const result = computeSlotMachine(['businessType', 'uniqueValue']);
    expect(result.readySections).toContain('about');
  });

  it('shows about as ready after businessType + approach', () => {
    const result = computeSlotMachine(['businessType', 'approach']);
    expect(result.readySections).toContain('about');
  });

  it('shows services as ready after servicesOffered', () => {
    const result = computeSlotMachine(['servicesOffered']);
    expect(result.readySections).toContain('services');
  });

  it('shows pricing as ready after servicesOffered + priceRange', () => {
    const result = computeSlotMachine(['servicesOffered', 'priceRange']);
    expect(result.readySections).toContain('pricing');
  });

  it('shows testimonials as ready after testimonial', () => {
    const result = computeSlotMachine(['testimonial']);
    expect(result.readySections).toContain('testimonials');
  });

  it('triggers research after businessType + location', () => {
    const result = computeSlotMachine(['businessType', 'location']);
    expect(result.nextAction).toBe('TRIGGER_RESEARCH');
  });

  it('does not re-trigger research if already triggered', () => {
    const result = computeSlotMachine(['businessType', 'location'], 'NOT_STARTED', true);
    expect(result.nextAction).not.toBe('TRIGGER_RESEARCH');
  });

  it('triggers first draft after businessType + location + servicesOffered', () => {
    const result = computeSlotMachine(
      ['businessType', 'location', 'servicesOffered'],
      'NOT_STARTED',
      true // research already triggered
    );
    expect(result.nextAction).toBe('BUILD_FIRST_DRAFT');
  });

  it('triggers first draft after businessType + location + uniqueValue', () => {
    const result = computeSlotMachine(
      ['businessType', 'location', 'uniqueValue'],
      'NOT_STARTED',
      true
    );
    expect(result.nextAction).toBe('BUILD_FIRST_DRAFT');
  });

  it('triggers first draft after businessType + location + dreamClient', () => {
    const result = computeSlotMachine(
      ['businessType', 'location', 'dreamClient'],
      'NOT_STARTED',
      true
    );
    expect(result.nextAction).toBe('BUILD_FIRST_DRAFT');
  });

  it('correctly detects phase advancement', () => {
    const result = computeSlotMachine(['businessType'], 'NOT_STARTED');
    expect(result.phaseAdvanced).toBe(true);
    expect(result.currentPhase).toBe('DISCOVERY');
  });

  it('detects no phase advancement when already at that phase', () => {
    const result = computeSlotMachine(['businessType'], 'DISCOVERY');
    expect(result.phaseAdvanced).toBe(false);
  });

  it('returns top 3 missing facts', () => {
    const result = computeSlotMachine([]);
    expect(result.missingForNext.length).toBe(3);
    expect(result.missingForNext[0].key).toBe('businessType'); // highest priority
  });

  it('excludes known facts from missingForNext', () => {
    const result = computeSlotMachine(['businessType', 'businessName', 'location']);
    const missingKeys = result.missingForNext.map((m) => m.key);
    expect(missingKeys).not.toContain('businessType');
    expect(missingKeys).not.toContain('businessName');
    expect(missingKeys).not.toContain('location');
  });

  it('computes utilization correctly', () => {
    const result = computeSlotMachine(['businessType', 'location', 'servicesOffered']);
    expect(result.slotMetrics.filled).toBe(3);
    expect(result.slotMetrics.total).toBe(15);
    expect(result.slotMetrics.utilization).toBe(20);
  });
});
