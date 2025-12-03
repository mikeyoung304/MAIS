# TODO-226: Missing Analytics Events for Landing Page Sections

## Priority: P3 (Nice-to-have)

## Status: Deferred

## Deferral Reason

This TODO is being deferred because the MAIS project does not currently have an analytics infrastructure in place:

1. **No Analytics Provider Configured**: No GA4, Segment, Mixpanel, or other analytics service is set up
2. **Infrastructure Prerequisite**: Implementing the tracking hooks and events without a provider would result in dead code
3. **Business Decision Required**: The choice of analytics provider should be a strategic business decision
4. **Well-Documented for Future**: All event definitions, hook structures, and implementation patterns are documented in this TODO for when analytics is added

**Next Steps When Analytics is Ready:**
- Select and configure analytics provider (GA4, Segment, etc.)
- Add provider SDK to client package
- Implement `useAnalytics` hook with the chosen provider
- Roll out tracking events following the patterns documented below
- Verify events appear in analytics dashboard

**Original Status**: Open

## Source: Code Review - Landing Page Implementation

## Description

Landing page interactions aren't tracked with analytics events. Tracking section views, CTA clicks, and FAQ interactions would provide valuable conversion insights.

## Suggested Events

| Event | Trigger | Properties |
|-------|---------|------------|
| `landing_page_view` | Page load | tenant_slug, sections_enabled |
| `section_view` | Section enters viewport | section_type, position |
| `cta_click` | CTA button click | section_type, cta_text, destination |
| `faq_expand` | FAQ accordion open | question_index, question_text |
| `gallery_image_click` | Gallery image click | image_index |
| `testimonial_view` | Testimonial card in view | testimonial_index |

## Implementation

### Analytics Hook

```typescript
// hooks/useAnalytics.ts
export function useAnalytics() {
  const track = useCallback((event: string, properties?: Record<string, unknown>) => {
    // Google Analytics 4
    if (window.gtag) {
      window.gtag('event', event, properties);
    }

    // Segment
    if (window.analytics) {
      window.analytics.track(event, properties);
    }

    // Custom analytics endpoint
    // fetch('/api/analytics', { method: 'POST', body: JSON.stringify({ event, properties }) });
  }, []);

  return { track };
}
```

### Section View Tracking

```typescript
// hooks/useSectionTracking.ts
import { useInView } from 'react-intersection-observer';

export function useSectionTracking(sectionType: string) {
  const { track } = useAnalytics();
  const [hasTracked, setHasTracked] = useState(false);

  const { ref } = useInView({
    threshold: 0.5,
    onChange: (inView) => {
      if (inView && !hasTracked) {
        track('section_view', { section_type: sectionType });
        setHasTracked(true);
      }
    },
  });

  return { ref };
}

// Usage in section component
function AboutSection({ config }: AboutSectionProps) {
  const { ref } = useSectionTracking('about');

  return <section ref={ref}>...</section>;
}
```

### CTA Click Tracking

```typescript
// HeroSection.tsx
function HeroSection({ config }: HeroSectionProps) {
  const { track } = useAnalytics();

  const handleCtaClick = () => {
    track('cta_click', {
      section_type: 'hero',
      cta_text: config.ctaText,
      destination: '#experiences',
    });

    document.getElementById('experiences')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <button onClick={handleCtaClick}>
      {config.ctaText}
    </button>
  );
}
```

### FAQ Interaction Tracking

```typescript
// FaqSection.tsx
function FaqAccordionItem({ item, index, isOpen, onToggle }) {
  const { track } = useAnalytics();

  const handleToggle = () => {
    if (!isOpen) {
      track('faq_expand', {
        question_index: index,
        question_text: item.question.slice(0, 50),
      });
    }
    onToggle();
  };

  return (
    <button onClick={handleToggle} aria-expanded={isOpen}>
      {item.question}
    </button>
  );
}
```

## Acceptance Criteria

- [ ] Page view tracked on landing page load
- [ ] Section views tracked via intersection observer
- [ ] CTA clicks tracked with context
- [ ] FAQ interactions tracked
- [ ] Analytics provider abstracted (GA4, Segment, etc.)
- [ ] Events appear in analytics dashboard

## Tags

analytics, tracking, landing-page, conversion
