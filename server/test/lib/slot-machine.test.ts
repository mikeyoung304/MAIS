import { describe, it, expect } from 'vitest';
import {
  computeSlotMachine,
  computeCurrentPhase,
  computeSectionReadiness,
  PHASE_ORDER,
} from '../../src/lib/slot-machine';

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

  it('returns BUILD_FIRST_DRAFT over OFFER_REFINEMENT when both conditions met', () => {
    // BUILD_FIRST_DRAFT has higher priority in the if/else chain.
    // With many facts, both conditions are true but BUILD_FIRST_DRAFT wins.
    const manyFacts = [
      'businessType',
      'businessName',
      'location',
      'servicesOffered',
      'priceRange',
      'uniqueValue',
      'testimonial',
      'faq',
      'contactInfo',
      'approach',
    ];
    const result = computeSlotMachine(manyFacts, 'MARKETING', true);
    expect(result.nextAction).toBe('BUILD_FIRST_DRAFT');
    expect(result.slotMetrics.utilization).toBeGreaterThanOrEqual(60);
    expect(result.readySections.length).toBeGreaterThanOrEqual(5);
  });

  it('offers refinement when first-draft conditions are NOT met', () => {
    // OFFER_REFINEMENT fires when: utilization >= 60% AND >= 5 ready sections
    // but BUILD_FIRST_DRAFT conditions aren't met (missing businessType+location combo).
    // Without businessType+location, first draft won't trigger.
    // We need facts that still enable 5+ sections — use individual section triggers.
    // hero needs [businessType], about needs [businessType]+[uniqueValue|approach],
    // services needs [servicesOffered], pricing needs [servicesOffered]+[priceRange],
    // testimonials needs [testimonial], faq needs [businessType]+[servicesOffered],
    // contact needs [businessType], cta needs [businessType]
    // Omit 'location' from FIRST_DRAFT_REQUIRED but still get 60% utilization
    // Actually FIRST_DRAFT_REQUIRED = [businessType, location] — so omit location.
    // But we need 60% = 9 of 15 facts. Without location that's tricky.
    // Let's use an approach where we have location but NOT any FIRST_DRAFT_OPTIONAL
    // FIRST_DRAFT_OPTIONAL = [servicesOffered, uniqueValue, dreamClient]
    // If we avoid all three, BUILD_FIRST_DRAFT won't fire.
    const factsWithoutOptional = [
      'businessType',
      'businessName',
      'location',
      'targetMarket',
      'priceRange',
      'yearsInBusiness',
      'teamSize',
      'specialization',
      'approach',
      'testimonial',
    ];
    const result = computeSlotMachine(factsWithoutOptional, 'MARKETING', true);
    expect(result.nextAction).toBe('OFFER_REFINEMENT');
    expect(result.slotMetrics.utilization).toBeGreaterThanOrEqual(60);
    expect(result.readySections.length).toBeGreaterThanOrEqual(5);
  });

  it('includes sectionReadiness in result', () => {
    const result = computeSlotMachine(['businessType']);
    expect(result.sectionReadiness).toBeDefined();
    expect(Array.isArray(result.sectionReadiness)).toBe(true);
    expect(result.sectionReadiness.length).toBe(8); // 8 canonical sections
  });
});

describe('computeSectionReadiness', () => {
  it('returns all 8 canonical sections', () => {
    const readiness = computeSectionReadiness([]);
    expect(readiness).toHaveLength(8);
    const types = readiness.map((r) => r.sectionType);
    expect(types).toEqual([
      'hero',
      'about',
      'services',
      'pricing',
      'testimonials',
      'faq',
      'contact',
      'cta',
    ]);
  });

  it('marks no sections ready with no facts', () => {
    const readiness = computeSectionReadiness([]);
    readiness.forEach((section) => {
      expect(section.isReady).toBe(false);
      expect(section.quality).toBe('minimal');
      expect(section.knownFacts).toEqual([]);
    });
  });

  it('marks hero ready after businessType', () => {
    const readiness = computeSectionReadiness(['businessType']);
    const hero = readiness.find((r) => r.sectionType === 'hero')!;
    expect(hero.isReady).toBe(true);
    expect(hero.knownFacts).toContain('businessType');
  });

  it('marks about NOT ready with only businessType (needs uniqueValue or approach)', () => {
    const readiness = computeSectionReadiness(['businessType']);
    const about = readiness.find((r) => r.sectionType === 'about')!;
    expect(about.isReady).toBe(false);
  });

  it('marks about ready with businessType + uniqueValue', () => {
    const readiness = computeSectionReadiness(['businessType', 'uniqueValue']);
    const about = readiness.find((r) => r.sectionType === 'about')!;
    expect(about.isReady).toBe(true);
    expect(about.knownFacts).toContain('businessType');
    expect(about.knownFacts).toContain('uniqueValue');
  });

  it('marks about ready with businessType + approach (OR-group alternative)', () => {
    const readiness = computeSectionReadiness(['businessType', 'approach']);
    const about = readiness.find((r) => r.sectionType === 'about')!;
    expect(about.isReady).toBe(true);
  });

  it('reports missing facts correctly', () => {
    const readiness = computeSectionReadiness(['businessType']);
    const hero = readiness.find((r) => r.sectionType === 'hero')!;
    // hero requires [businessType], optional: [targetMarket, uniqueValue, location]
    expect(hero.missingFacts).toContain('targetMarket');
    expect(hero.missingFacts).toContain('uniqueValue');
    expect(hero.missingFacts).toContain('location');
    expect(hero.missingFacts).not.toContain('businessType');
  });

  it('computes minimal quality when only required facts present', () => {
    // hero: required=[businessType], optional=[targetMarket, uniqueValue, location]
    // 1 of 4 = 25% → minimal
    const readiness = computeSectionReadiness(['businessType']);
    const hero = readiness.find((r) => r.sectionType === 'hero')!;
    expect(hero.quality).toBe('minimal');
  });

  it('computes good quality at >= 50% relevant facts', () => {
    // hero: required=[businessType], optional=[targetMarket, uniqueValue, location]
    // 2 of 4 = 50% → good
    const readiness = computeSectionReadiness(['businessType', 'targetMarket']);
    const hero = readiness.find((r) => r.sectionType === 'hero')!;
    expect(hero.quality).toBe('good');
  });

  it('computes excellent quality at >= 80% relevant facts', () => {
    // hero: required=[businessType], optional=[targetMarket, uniqueValue, location]
    // 4 of 4 = 100% → excellent
    const readiness = computeSectionReadiness([
      'businessType',
      'targetMarket',
      'uniqueValue',
      'location',
    ]);
    const hero = readiness.find((r) => r.sectionType === 'hero')!;
    expect(hero.quality).toBe('excellent');
  });

  it('keeps quality as minimal for not-ready sections regardless of optional facts', () => {
    // about requires [businessType] AND [uniqueValue | approach]
    // Only having optional facts (yearsInBusiness) without required doesn't make it ready
    const readiness = computeSectionReadiness(['yearsInBusiness']);
    const about = readiness.find((r) => r.sectionType === 'about')!;
    expect(about.isReady).toBe(false);
    expect(about.quality).toBe('minimal');
  });

  it('handles pricing section requiring two fact groups', () => {
    // pricing: required=[servicesOffered] AND [priceRange]
    const readiness1 = computeSectionReadiness(['servicesOffered']);
    expect(readiness1.find((r) => r.sectionType === 'pricing')!.isReady).toBe(false);

    const readiness2 = computeSectionReadiness(['servicesOffered', 'priceRange']);
    expect(readiness2.find((r) => r.sectionType === 'pricing')!.isReady).toBe(true);
  });
});
