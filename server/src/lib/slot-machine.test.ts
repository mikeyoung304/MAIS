/**
 * Slot Machine Unit Tests
 *
 * Tests the deterministic state engine for tenant onboarding.
 * Pure functions with no database dependencies — easy to test in isolation.
 *
 * @see slot-machine.ts
 * @see packages/contracts/src/schemas/section-blueprint.schema.ts
 */

import { describe, it, expect } from 'vitest';
import { SECTION_BLUEPRINT } from '@macon/contracts';
import {
  computeCurrentPhase,
  computeSlotMachine,
  computeSectionReadiness,
  PHASE_ORDER,
} from './slot-machine';

// ============================================================================
// Helpers
// ============================================================================

/** All 15 valid discovery fact keys (mirrors ALL_FACT_KEYS in slot-machine.ts) */
const ALL_FACT_KEYS = [
  'businessType',
  'businessName',
  'location',
  'targetMarket',
  'priceRange',
  'yearsInBusiness',
  'teamSize',
  'uniqueValue',
  'servicesOffered',
  'specialization',
  'approach',
  'dreamClient',
  'testimonial',
  'faq',
  'contactInfo',
];

// ============================================================================
// computeCurrentPhase
// ============================================================================

describe('computeCurrentPhase', () => {
  it('returns NOT_STARTED when no facts are known', () => {
    expect(computeCurrentPhase([])).toBe('NOT_STARTED');
  });

  it('returns DISCOVERY when only businessType is known', () => {
    expect(computeCurrentPhase(['businessType'])).toBe('DISCOVERY');
  });

  it('returns MARKET_RESEARCH when location is known (even without businessType)', () => {
    expect(computeCurrentPhase(['location'])).toBe('MARKET_RESEARCH');
  });

  it('returns MARKET_RESEARCH when businessType + location are known', () => {
    expect(computeCurrentPhase(['businessType', 'location'])).toBe('MARKET_RESEARCH');
  });

  it('returns SERVICES when servicesOffered is known', () => {
    expect(computeCurrentPhase(['businessType', 'location', 'servicesOffered'])).toBe('SERVICES');
  });

  it('returns SERVICES when priceRange is known', () => {
    expect(computeCurrentPhase(['priceRange'])).toBe('SERVICES');
  });

  it('returns MARKETING when uniqueValue is known', () => {
    expect(computeCurrentPhase(['businessType', 'location', 'uniqueValue'])).toBe('MARKETING');
  });

  it('returns MARKETING when testimonial is known', () => {
    expect(computeCurrentPhase(['testimonial'])).toBe('MARKETING');
  });

  it('phase is based on highest-priority fact, not count', () => {
    // Just uniqueValue alone (skipping earlier phases) = MARKETING
    expect(computeCurrentPhase(['uniqueValue'])).toBe('MARKETING');
    // businessName alone (not a phase trigger) = NOT_STARTED
    expect(computeCurrentPhase(['businessName'])).toBe('NOT_STARTED');
  });

  it('returns highest applicable phase when multiple triggers present', () => {
    // Has businessType (DISCOVERY), location (MARKET_RESEARCH), uniqueValue (MARKETING)
    expect(computeCurrentPhase(['businessType', 'location', 'uniqueValue'])).toBe('MARKETING');
  });

  it('ignores irrelevant fact keys that do not affect phase', () => {
    // businessName, teamSize, contactInfo, dreamClient, faq, specialization do not trigger phases
    expect(
      computeCurrentPhase(['businessName', 'teamSize', 'contactInfo', 'dreamClient', 'faq'])
    ).toBe('NOT_STARTED');
  });
});

// ============================================================================
// computeSlotMachine — nextAction
// ============================================================================

describe('computeSlotMachine', () => {
  // --------------------------------------------------------------------------
  // nextAction: ASK (default)
  // --------------------------------------------------------------------------

  describe('nextAction: ASK', () => {
    it('returns ASK with no facts', () => {
      const result = computeSlotMachine([]);
      expect(result.nextAction).toBe('ASK');
    });

    it('returns ASK when only businessType is known', () => {
      const result = computeSlotMachine(['businessType']);
      expect(result.nextAction).toBe('ASK');
    });

    it('returns ASK when only location is known', () => {
      const result = computeSlotMachine(['location']);
      expect(result.nextAction).toBe('ASK');
    });

    it('returns ASK when businessType + location but researchTriggered=true', () => {
      // Research already triggered, no optional draft facts -> ASK
      const result = computeSlotMachine(['businessType', 'location'], 'NOT_STARTED', true);
      expect(result.nextAction).toBe('ASK');
    });

    it('returns ASK when only non-draft facts are known with researchTriggered', () => {
      const result = computeSlotMachine(
        ['businessType', 'location', 'businessName'],
        'MARKET_RESEARCH',
        true
      );
      expect(result.nextAction).toBe('ASK');
    });
  });

  // --------------------------------------------------------------------------
  // nextAction: TRIGGER_RESEARCH
  // --------------------------------------------------------------------------

  describe('nextAction: TRIGGER_RESEARCH', () => {
    it('triggers research when businessType + location known and not yet triggered', () => {
      const result = computeSlotMachine(['businessType', 'location'], 'NOT_STARTED', false);
      expect(result.nextAction).toBe('TRIGGER_RESEARCH');
    });

    it('does NOT re-trigger research when researchTriggered=true', () => {
      const result = computeSlotMachine(['businessType', 'location'], 'NOT_STARTED', true);
      expect(result.nextAction).not.toBe('TRIGGER_RESEARCH');
    });

    it('does NOT trigger research with only businessType (missing location)', () => {
      const result = computeSlotMachine(['businessType'], 'NOT_STARTED', false);
      expect(result.nextAction).toBe('ASK');
    });

    it('does NOT trigger research with only location (missing businessType)', () => {
      const result = computeSlotMachine(['location'], 'NOT_STARTED', false);
      expect(result.nextAction).toBe('ASK');
    });

    it('triggers research even with additional non-draft facts', () => {
      // businessType + location + businessName, no optional draft facts
      const result = computeSlotMachine(
        ['businessType', 'location', 'businessName'],
        'NOT_STARTED',
        false
      );
      expect(result.nextAction).toBe('TRIGGER_RESEARCH');
    });
  });

  // --------------------------------------------------------------------------
  // nextAction: BUILD_FIRST_DRAFT
  // --------------------------------------------------------------------------

  describe('nextAction: BUILD_FIRST_DRAFT', () => {
    it('triggers first draft with required + optional facts and sufficient sections', () => {
      // businessType + location (required) + uniqueValue (optional) = hero, about, contact, cta ready (4 >= 3)
      const result = computeSlotMachine(
        ['businessType', 'location', 'uniqueValue'],
        'MARKET_RESEARCH',
        false
      );
      expect(result.nextAction).toBe('BUILD_FIRST_DRAFT');
    });

    it('BUILD_FIRST_DRAFT takes priority over TRIGGER_RESEARCH', () => {
      // Even though research hasn't been triggered, BUILD_FIRST_DRAFT is checked first
      const result = computeSlotMachine(
        ['businessType', 'location', 'uniqueValue'],
        'MARKET_RESEARCH',
        false
      );
      expect(result.nextAction).toBe('BUILD_FIRST_DRAFT');
    });

    it('triggers with servicesOffered as the optional draft fact', () => {
      // businessType + location + servicesOffered -> hero, services, faq, contact, cta ready (5 >= 3)
      const result = computeSlotMachine(
        ['businessType', 'location', 'servicesOffered'],
        'MARKET_RESEARCH',
        true
      );
      expect(result.nextAction).toBe('BUILD_FIRST_DRAFT');
    });

    it('triggers with dreamClient as the optional draft fact', () => {
      // businessType + location + dreamClient -> hero, contact, cta ready (3 >= 3)
      const result = computeSlotMachine(
        ['businessType', 'location', 'dreamClient'],
        'MARKET_RESEARCH',
        true
      );
      expect(result.nextAction).toBe('BUILD_FIRST_DRAFT');
    });

    it('does NOT trigger without any optional draft fact', () => {
      // businessType + location + businessName (not in FIRST_DRAFT_OPTIONAL)
      const result = computeSlotMachine(
        ['businessType', 'location', 'businessName'],
        'MARKET_RESEARCH',
        true
      );
      expect(result.nextAction).not.toBe('BUILD_FIRST_DRAFT');
    });

    it('does NOT trigger without location (required)', () => {
      const result = computeSlotMachine(['businessType', 'uniqueValue'], 'DISCOVERY', true);
      expect(result.nextAction).not.toBe('BUILD_FIRST_DRAFT');
    });

    it('does NOT trigger without businessType (required)', () => {
      const result = computeSlotMachine(['location', 'uniqueValue'], 'MARKET_RESEARCH', true);
      expect(result.nextAction).not.toBe('BUILD_FIRST_DRAFT');
    });
  });

  // --------------------------------------------------------------------------
  // nextAction: OFFER_REFINEMENT
  // --------------------------------------------------------------------------

  describe('nextAction: OFFER_REFINEMENT', () => {
    it('offers refinement at >= 60% utilization with >= 5 ready sections', () => {
      // 9 facts (60% utilization), no location (so BUILD_FIRST_DRAFT can't fire)
      const facts = [
        'businessType',
        'targetMarket',
        'priceRange',
        'uniqueValue',
        'servicesOffered',
        'specialization',
        'approach',
        'dreamClient',
        'yearsInBusiness',
      ];
      const result = computeSlotMachine(facts, 'MARKETING', true);
      expect(result.nextAction).toBe('OFFER_REFINEMENT');
      expect(result.slotMetrics.utilization).toBe(60);
      expect(result.readySections.length).toBeGreaterThanOrEqual(5);
    });

    it('does NOT offer refinement below 60% utilization', () => {
      // 8 facts (53% utilization) without location
      const facts = [
        'businessType',
        'targetMarket',
        'priceRange',
        'uniqueValue',
        'servicesOffered',
        'specialization',
        'approach',
        'dreamClient',
      ];
      const result = computeSlotMachine(facts, 'MARKETING', true);
      expect(result.slotMetrics.utilization).toBe(53);
      expect(result.nextAction).not.toBe('OFFER_REFINEMENT');
    });

    it('does NOT offer refinement with < 5 ready sections even at high utilization', () => {
      // 9 facts but NOT including businessType — limited section readiness
      // Without businessType: hero, about, faq, contact, cta are NOT ready
      const facts = [
        'location',
        'targetMarket',
        'priceRange',
        'uniqueValue',
        'servicesOffered',
        'specialization',
        'approach',
        'dreamClient',
        'testimonial',
      ];
      const result = computeSlotMachine(facts, 'MARKETING', true);
      expect(result.slotMetrics.utilization).toBe(60);
      // Without businessType, only services, pricing, testimonials are ready = 3
      expect(result.readySections.length).toBeLessThan(5);
      expect(result.nextAction).not.toBe('OFFER_REFINEMENT');
    });

    it('BUILD_FIRST_DRAFT takes priority over OFFER_REFINEMENT', () => {
      // Many facts including businessType + location + optional draft fact
      const facts = [
        'businessType',
        'location',
        'targetMarket',
        'priceRange',
        'uniqueValue',
        'servicesOffered',
        'specialization',
        'approach',
        'dreamClient',
      ];
      const result = computeSlotMachine(facts, 'MARKETING', true);
      // Should be BUILD_FIRST_DRAFT not OFFER_REFINEMENT
      expect(result.nextAction).toBe('BUILD_FIRST_DRAFT');
    });
  });

  // --------------------------------------------------------------------------
  // phaseAdvanced
  // --------------------------------------------------------------------------

  describe('phaseAdvanced', () => {
    it('is true when phase advances from NOT_STARTED to DISCOVERY', () => {
      const result = computeSlotMachine(['businessType'], 'NOT_STARTED');
      expect(result.phaseAdvanced).toBe(true);
      expect(result.currentPhase).toBe('DISCOVERY');
    });

    it('is true when phase advances from DISCOVERY to MARKET_RESEARCH', () => {
      const result = computeSlotMachine(['businessType', 'location'], 'DISCOVERY');
      expect(result.phaseAdvanced).toBe(true);
      expect(result.currentPhase).toBe('MARKET_RESEARCH');
    });

    it('is true when phase advances from MARKET_RESEARCH to SERVICES', () => {
      const result = computeSlotMachine(
        ['businessType', 'location', 'servicesOffered'],
        'MARKET_RESEARCH'
      );
      expect(result.phaseAdvanced).toBe(true);
      expect(result.currentPhase).toBe('SERVICES');
    });

    it('is true when phase advances from SERVICES to MARKETING', () => {
      const result = computeSlotMachine(
        ['businessType', 'location', 'servicesOffered', 'uniqueValue'],
        'SERVICES'
      );
      expect(result.phaseAdvanced).toBe(true);
      expect(result.currentPhase).toBe('MARKETING');
    });

    it('is false when phase stays the same', () => {
      const result = computeSlotMachine(['businessType'], 'DISCOVERY');
      expect(result.phaseAdvanced).toBe(false);
    });

    it('is false when no facts and previousPhase is NOT_STARTED', () => {
      const result = computeSlotMachine([], 'NOT_STARTED');
      expect(result.phaseAdvanced).toBe(false);
    });

    it('is false when previousPhase is higher than currentPhase', () => {
      // Edge case: previousPhase is MARKETING but current facts only reach DISCOVERY
      const result = computeSlotMachine(['businessType'], 'MARKETING');
      expect(result.phaseAdvanced).toBe(false);
    });

    it('handles multi-phase jumps (NOT_STARTED -> MARKETING)', () => {
      // Skip intermediate phases
      const result = computeSlotMachine(['uniqueValue'], 'NOT_STARTED');
      expect(result.phaseAdvanced).toBe(true);
      expect(result.currentPhase).toBe('MARKETING');
    });
  });

  // --------------------------------------------------------------------------
  // readySections
  // --------------------------------------------------------------------------

  describe('readySections', () => {
    it('returns empty when no facts are known', () => {
      const result = computeSlotMachine([]);
      expect(result.readySections).toEqual([]);
    });

    it('returns hero, contact, cta when only businessType is known', () => {
      const result = computeSlotMachine(['businessType']);
      // hero requires [['businessType']], contact requires [['businessType']], cta requires [['businessType']]
      expect(result.readySections).toContain('hero');
      expect(result.readySections).toContain('contact');
      expect(result.readySections).toContain('cta');
      expect(result.readySections).not.toContain('about'); // needs uniqueValue or approach
      expect(result.readySections).not.toContain('services'); // needs servicesOffered
    });

    it('includes about when businessType + uniqueValue known', () => {
      const result = computeSlotMachine(['businessType', 'uniqueValue']);
      expect(result.readySections).toContain('about');
    });

    it('includes about when businessType + approach known (OR group)', () => {
      const result = computeSlotMachine(['businessType', 'approach']);
      expect(result.readySections).toContain('about');
    });

    it('includes services when servicesOffered is known', () => {
      const result = computeSlotMachine(['servicesOffered']);
      expect(result.readySections).toContain('services');
    });

    it('includes pricing when servicesOffered + priceRange known', () => {
      const result = computeSlotMachine(['servicesOffered', 'priceRange']);
      expect(result.readySections).toContain('pricing');
    });

    it('does NOT include pricing when only servicesOffered known', () => {
      const result = computeSlotMachine(['servicesOffered']);
      expect(result.readySections).not.toContain('pricing');
    });

    it('includes testimonials when testimonial is known', () => {
      const result = computeSlotMachine(['testimonial']);
      expect(result.readySections).toContain('testimonials');
    });

    it('includes faq when businessType + servicesOffered known', () => {
      const result = computeSlotMachine(['businessType', 'servicesOffered']);
      expect(result.readySections).toContain('faq');
    });

    it('returns all 8 sections with comprehensive facts', () => {
      const facts = ['businessType', 'uniqueValue', 'servicesOffered', 'priceRange', 'testimonial'];
      const result = computeSlotMachine(facts);
      // hero, about, services, pricing, testimonials, faq, contact, cta
      expect(result.readySections).toHaveLength(8);
    });
  });

  // --------------------------------------------------------------------------
  // missingForNext
  // --------------------------------------------------------------------------

  describe('missingForNext', () => {
    it('returns top 3 missing facts in question priority order', () => {
      const result = computeSlotMachine([]);
      expect(result.missingForNext).toHaveLength(3);
      // Question priority: location, businessType, businessName, ...
      expect(result.missingForNext[0].key).toBe('location');
      expect(result.missingForNext[1].key).toBe('businessType');
      expect(result.missingForNext[2].key).toBe('businessName');
    });

    it('excludes already-known facts', () => {
      const result = computeSlotMachine(['location', 'businessType']);
      // location and businessType should be excluded, next is businessName
      expect(result.missingForNext.every((m) => m.key !== 'location')).toBe(true);
      expect(result.missingForNext.every((m) => m.key !== 'businessType')).toBe(true);
      expect(result.missingForNext[0].key).toBe('businessName');
    });

    it('each entry has a key and question string', () => {
      const result = computeSlotMachine([]);
      for (const entry of result.missingForNext) {
        expect(typeof entry.key).toBe('string');
        expect(typeof entry.question).toBe('string');
        expect(entry.question.length).toBeGreaterThan(0);
      }
    });

    it('returns fewer than 3 when only 1-2 facts remain', () => {
      // Know all but 2 facts
      const allButTwo = ALL_FACT_KEYS.filter((k) => k !== 'specialization' && k !== 'contactInfo');
      const result = computeSlotMachine(allButTwo);
      expect(result.missingForNext.length).toBeLessThanOrEqual(2);
    });

    it('returns empty array when all facts are known', () => {
      const result = computeSlotMachine(ALL_FACT_KEYS);
      expect(result.missingForNext).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // slotMetrics
  // --------------------------------------------------------------------------

  describe('slotMetrics', () => {
    it('reports 0% utilization with no facts', () => {
      const result = computeSlotMachine([]);
      expect(result.slotMetrics).toEqual({
        filled: 0,
        total: 15,
        utilization: 0,
      });
    });

    it('reports 100% utilization with all 15 facts', () => {
      const result = computeSlotMachine(ALL_FACT_KEYS);
      expect(result.slotMetrics).toEqual({
        filled: 15,
        total: 15,
        utilization: 100,
      });
    });

    it('calculates correct intermediate utilization', () => {
      const facts = ['businessType', 'location', 'uniqueValue']; // 3/15 = 20%
      const result = computeSlotMachine(facts);
      expect(result.slotMetrics.filled).toBe(3);
      expect(result.slotMetrics.total).toBe(15);
      expect(result.slotMetrics.utilization).toBe(20);
    });

    it('rounds utilization to nearest integer', () => {
      // 1/15 = 6.67% -> rounds to 7
      const result = computeSlotMachine(['businessType']);
      expect(result.slotMetrics.utilization).toBe(7);
    });
  });

  // --------------------------------------------------------------------------
  // sectionReadiness (returned by computeSlotMachine)
  // --------------------------------------------------------------------------

  describe('sectionReadiness (via computeSlotMachine)', () => {
    it('includes readiness for all 8 canonical sections', () => {
      const result = computeSlotMachine([]);
      expect(result.sectionReadiness).toHaveLength(SECTION_BLUEPRINT.length);
    });

    it('returns sections in blueprint order', () => {
      const result = computeSlotMachine([]);
      const types = result.sectionReadiness.map((s) => s.sectionType);
      const blueprintTypes = SECTION_BLUEPRINT.map((s) => s.sectionType);
      expect(types).toEqual(blueprintTypes);
    });
  });
});

// ============================================================================
// computeSectionReadiness (standalone export)
// ============================================================================

describe('computeSectionReadiness', () => {
  it('returns readiness for all 8 sections', () => {
    const readiness = computeSectionReadiness([]);
    expect(readiness).toHaveLength(8);
  });

  it('returns sections in blueprint order (hero -> cta)', () => {
    const readiness = computeSectionReadiness([]);
    expect(readiness[0].sectionType).toBe('hero');
    expect(readiness[readiness.length - 1].sectionType).toBe('cta');
  });

  describe('isReady per section', () => {
    it('hero is ready with just businessType', () => {
      const readiness = computeSectionReadiness(['businessType']);
      const hero = readiness.find((s) => s.sectionType === 'hero')!;
      expect(hero.isReady).toBe(true);
    });

    it('hero is NOT ready with no facts', () => {
      const readiness = computeSectionReadiness([]);
      const hero = readiness.find((s) => s.sectionType === 'hero')!;
      expect(hero.isReady).toBe(false);
    });

    it('about requires businessType AND (uniqueValue OR approach)', () => {
      // Missing second OR group
      const r1 = computeSectionReadiness(['businessType']);
      expect(r1.find((s) => s.sectionType === 'about')!.isReady).toBe(false);

      // Has uniqueValue
      const r2 = computeSectionReadiness(['businessType', 'uniqueValue']);
      expect(r2.find((s) => s.sectionType === 'about')!.isReady).toBe(true);

      // Has approach (alternative OR)
      const r3 = computeSectionReadiness(['businessType', 'approach']);
      expect(r3.find((s) => s.sectionType === 'about')!.isReady).toBe(true);

      // Missing businessType
      const r4 = computeSectionReadiness(['uniqueValue']);
      expect(r4.find((s) => s.sectionType === 'about')!.isReady).toBe(false);
    });

    it('services requires servicesOffered', () => {
      const r1 = computeSectionReadiness([]);
      expect(r1.find((s) => s.sectionType === 'services')!.isReady).toBe(false);

      const r2 = computeSectionReadiness(['servicesOffered']);
      expect(r2.find((s) => s.sectionType === 'services')!.isReady).toBe(true);
    });

    it('pricing requires servicesOffered AND priceRange', () => {
      const r1 = computeSectionReadiness(['servicesOffered']);
      expect(r1.find((s) => s.sectionType === 'pricing')!.isReady).toBe(false);

      const r2 = computeSectionReadiness(['priceRange']);
      expect(r2.find((s) => s.sectionType === 'pricing')!.isReady).toBe(false);

      const r3 = computeSectionReadiness(['servicesOffered', 'priceRange']);
      expect(r3.find((s) => s.sectionType === 'pricing')!.isReady).toBe(true);
    });

    it('testimonials requires testimonial', () => {
      const r = computeSectionReadiness(['testimonial']);
      expect(r.find((s) => s.sectionType === 'testimonials')!.isReady).toBe(true);
    });

    it('faq requires businessType AND servicesOffered', () => {
      const r1 = computeSectionReadiness(['businessType']);
      expect(r1.find((s) => s.sectionType === 'faq')!.isReady).toBe(false);

      const r2 = computeSectionReadiness(['businessType', 'servicesOffered']);
      expect(r2.find((s) => s.sectionType === 'faq')!.isReady).toBe(true);
    });

    it('contact requires businessType', () => {
      const r = computeSectionReadiness(['businessType']);
      expect(r.find((s) => s.sectionType === 'contact')!.isReady).toBe(true);
    });

    it('cta requires businessType', () => {
      const r = computeSectionReadiness(['businessType']);
      expect(r.find((s) => s.sectionType === 'cta')!.isReady).toBe(true);
    });
  });

  describe('quality levels', () => {
    it('returns minimal quality when section is not ready', () => {
      const readiness = computeSectionReadiness([]);
      // All sections should be minimal when not ready
      for (const section of readiness) {
        expect(section.quality).toBe('minimal');
      }
    });

    it('returns minimal quality when only required facts present (< 50% coverage)', () => {
      // hero: required = businessType, optional = targetMarket, uniqueValue, location
      // All relevant = 4 keys. With just businessType: 1/4 = 25% => minimal
      const readiness = computeSectionReadiness(['businessType']);
      const hero = readiness.find((s) => s.sectionType === 'hero')!;
      expect(hero.isReady).toBe(true);
      expect(hero.quality).toBe('minimal');
    });

    it('returns good quality at 50-79% fact coverage', () => {
      // hero: required = [businessType], optional = [targetMarket, uniqueValue, location]
      // All relevant = 4 keys. With businessType + targetMarket: 2/4 = 50% => good
      const readiness = computeSectionReadiness(['businessType', 'targetMarket']);
      const hero = readiness.find((s) => s.sectionType === 'hero')!;
      expect(hero.isReady).toBe(true);
      expect(hero.quality).toBe('good');
    });

    it('returns excellent quality at >= 80% fact coverage', () => {
      // hero: all relevant = [businessType, targetMarket, uniqueValue, location]
      // With all 4: 4/4 = 100% => excellent
      const readiness = computeSectionReadiness([
        'businessType',
        'targetMarket',
        'uniqueValue',
        'location',
      ]);
      const hero = readiness.find((s) => s.sectionType === 'hero')!;
      expect(hero.isReady).toBe(true);
      expect(hero.quality).toBe('excellent');
    });

    it('returns minimal for not-ready sections even with some optional facts', () => {
      // about requires [['businessType'], ['uniqueValue', 'approach']]
      // With only approach (missing businessType): not ready => always minimal
      const readiness = computeSectionReadiness(['approach']);
      const about = readiness.find((s) => s.sectionType === 'about')!;
      expect(about.isReady).toBe(false);
      expect(about.quality).toBe('minimal');
    });
  });

  describe('knownFacts and missingFacts', () => {
    it('reports all facts as missing when none are known', () => {
      const readiness = computeSectionReadiness([]);
      const hero = readiness.find((s) => s.sectionType === 'hero')!;
      // hero relevant facts: businessType, targetMarket, uniqueValue, location
      expect(hero.knownFacts).toHaveLength(0);
      expect(hero.missingFacts).toContain('businessType');
      expect(hero.missingFacts).toContain('targetMarket');
      expect(hero.missingFacts).toContain('uniqueValue');
      expect(hero.missingFacts).toContain('location');
    });

    it('separates known and missing facts correctly', () => {
      const readiness = computeSectionReadiness(['businessType', 'uniqueValue']);
      const hero = readiness.find((s) => s.sectionType === 'hero')!;
      expect(hero.knownFacts).toContain('businessType');
      expect(hero.knownFacts).toContain('uniqueValue');
      expect(hero.missingFacts).toContain('targetMarket');
      expect(hero.missingFacts).toContain('location');
      expect(hero.missingFacts).not.toContain('businessType');
      expect(hero.missingFacts).not.toContain('uniqueValue');
    });

    it('reports all facts as known when section is fully covered', () => {
      const readiness = computeSectionReadiness([
        'businessType',
        'targetMarket',
        'uniqueValue',
        'location',
      ]);
      const hero = readiness.find((s) => s.sectionType === 'hero')!;
      expect(hero.missingFacts).toHaveLength(0);
      expect(hero.knownFacts).toHaveLength(4);
    });

    it('only includes relevant facts (not all known facts)', () => {
      // testimonial is not relevant to hero section
      const readiness = computeSectionReadiness(['businessType', 'testimonial']);
      const hero = readiness.find((s) => s.sectionType === 'hero')!;
      expect(hero.knownFacts).toContain('businessType');
      expect(hero.knownFacts).not.toContain('testimonial');
    });
  });
});

// ============================================================================
// PHASE_ORDER export
// ============================================================================

describe('PHASE_ORDER', () => {
  it('defines monotonically increasing order', () => {
    expect(PHASE_ORDER['NOT_STARTED']).toBe(0);
    expect(PHASE_ORDER['DISCOVERY']).toBe(1);
    expect(PHASE_ORDER['MARKET_RESEARCH']).toBe(2);
    expect(PHASE_ORDER['SERVICES']).toBe(3);
    expect(PHASE_ORDER['MARKETING']).toBe(4);
    expect(PHASE_ORDER['COMPLETED']).toBe(5);
  });

  it('treats SKIPPED as equal to COMPLETED', () => {
    expect(PHASE_ORDER['SKIPPED']).toBe(PHASE_ORDER['COMPLETED']);
  });
});

// ============================================================================
// Edge cases and integration
// ============================================================================

describe('edge cases', () => {
  it('handles duplicate fact keys gracefully (Set deduplication)', () => {
    const result = computeSlotMachine(
      ['businessType', 'businessType', 'businessType'],
      'NOT_STARTED'
    );
    // Utilization counts array length (3), but Set-based logic handles deduplication for section readiness
    expect(result.currentPhase).toBe('DISCOVERY');
    expect(result.readySections).toContain('hero');
  });

  it('handles unknown fact keys without crashing', () => {
    const result = computeSlotMachine(['unknownFact', 'anotherUnknown']);
    expect(result.currentPhase).toBe('NOT_STARTED');
    expect(result.nextAction).toBe('ASK');
    // slotMetrics counts them in filled (array length)
    expect(result.slotMetrics.filled).toBe(2);
  });

  it('previousPhase defaults to NOT_STARTED', () => {
    const result = computeSlotMachine(['businessType']);
    expect(result.phaseAdvanced).toBe(true); // NOT_STARTED -> DISCOVERY
  });

  it('researchTriggered defaults to false', () => {
    const result = computeSlotMachine(['businessType', 'location']);
    expect(result.nextAction).toBe('TRIGGER_RESEARCH');
  });

  it('full onboarding scenario: progressive fact collection', () => {
    // Step 1: location only
    const r1 = computeSlotMachine(['location'], 'NOT_STARTED', false);
    expect(r1.currentPhase).toBe('MARKET_RESEARCH');
    expect(r1.nextAction).toBe('ASK');

    // Step 2: + businessType -> TRIGGER_RESEARCH
    const r2 = computeSlotMachine(['location', 'businessType'], 'MARKET_RESEARCH', false);
    expect(r2.nextAction).toBe('TRIGGER_RESEARCH');

    // Step 3: + uniqueValue -> BUILD_FIRST_DRAFT (research not re-triggered)
    const r3 = computeSlotMachine(
      ['location', 'businessType', 'uniqueValue'],
      'MARKET_RESEARCH',
      true
    );
    expect(r3.nextAction).toBe('BUILD_FIRST_DRAFT');
    expect(r3.currentPhase).toBe('MARKETING');
    expect(r3.phaseAdvanced).toBe(true);
  });
});
