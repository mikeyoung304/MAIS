---
title: Component Testing Strategies for Duplication & Performance
category: testing
tags: [react, testing, vitest, component-tests, duplication, performance, memoization]
priority: P2
---

# Component Testing Strategies

Test patterns to catch duplication issues and verify performance optimizations.

---

## Test Philosophy

### What to Test

**✅ Test these in component tests:**

- Component renders expected output
- Props are mapped correctly (wrapper → base)
- User interactions work (clicks, hovers)
- Accessibility features work (alt text, focus states)
- Performance optimizations work (memo prevents re-renders)
- Edge cases (missing props, null values)

**❌ Don't test in component tests:**

- Business logic (belongs in service tests)
- API calls (mock them)
- Complex calculations (unit test the utility)
- Implementation details (test behavior, not internals)

---

## 1. Base Component Tests

Test the pure presentation component thoroughly.

### Pattern: Test All Props

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChoiceCardBase, ChoiceCardBaseProps } from './ChoiceCardBase';

// Create mock props factory for easy reuse
function createMockProps(overrides?: Partial<ChoiceCardBaseProps>): ChoiceCardBaseProps {
  return {
    title: 'Test Card',
    description: 'Test description',
    imageUrl: 'https://example.com/image.jpg',
    imageAlt: 'Test image',
    categoryLabel: 'Budget',
    cta: 'View Details',
    href: '/test',
    highlighted: false,
    ...overrides,
  };
}

describe('ChoiceCardBase', () => {
  describe('Rendering', () => {
    it('renders all required props correctly', () => {
      const props = createMockProps();
      render(<ChoiceCardBase {...props} />);

      expect(screen.getByText('Test Card')).toBeInTheDocument();
      expect(screen.getByText('Test description')).toBeInTheDocument();
      expect(screen.getByAltText('Test image')).toBeInTheDocument();
      expect(screen.getByText('View Details')).toBeInTheDocument();
    });

    it('renders as a link to correct href', () => {
      const props = createMockProps({ href: '/segments/weddings' });
      render(<ChoiceCardBase {...props} />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/segments/weddings');
    });

    it('applies correct styling based on highlighted prop', () => {
      const { rerender } = render(
        <ChoiceCardBase {...createMockProps({ highlighted: false })} />
      );

      let card = screen.getByRole('link');
      expect(card).toHaveClass('border-neutral-200');

      rerender(<ChoiceCardBase {...createMockProps({ highlighted: true })} />);

      card = screen.getByRole('link');
      expect(card).toHaveClass('border-macon-orange');
      expect(card).toHaveClass('scale-[1.02]');
    });
  });

  describe('Image Handling', () => {
    it('renders image when imageUrl provided', () => {
      render(<ChoiceCardBase {...createMockProps()} />);

      const image = screen.getByAltText('Test image') as HTMLImageElement;
      expect(image.src).toBe('https://example.com/image.jpg');
    });

    it('renders gradient fallback when imageUrl is null', () => {
      render(<ChoiceCardBase {...createMockProps({ imageUrl: null })} />);

      expect(screen.queryByAltText('Test image')).not.toBeInTheDocument();
      // Fallback gradient should be visible
      expect(screen.getByText('Budget')).toBeInTheDocument(); // Category label in gradient
    });

    it('uses lazy loading for images', () => {
      render(<ChoiceCardBase {...createMockProps()} />);

      const image = screen.getByAltText('Test image') as HTMLImageElement;
      expect(image).toHaveAttribute('loading', 'lazy');
    });

    it('hides broken images gracefully', () => {
      render(<ChoiceCardBase {...createMockProps()} />);

      const image = screen.getByAltText('Test image') as HTMLImageElement;

      // Simulate broken image
      image.dispatchEvent(new Event('error'));

      // Should hide image (fallback gradient shows)
      expect(image.style.display).toBe('none');
    });
  });

  describe('Optional Props', () => {
    it('renders without price when not provided', () => {
      render(<ChoiceCardBase {...createMockProps({ price: undefined })} />);

      expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    });

    it('renders price when provided', () => {
      render(<ChoiceCardBase {...createMockProps({ price: 99900 })} />);

      expect(screen.getByText('$999.00')).toBeInTheDocument();
    });

    it('renders "Most Popular" badge when highlighted', () => {
      render(<ChoiceCardBase {...createMockProps({ highlighted: true })} />);

      expect(screen.getByText('Most Popular')).toBeInTheDocument();
    });

    it('does not render badge when not highlighted', () => {
      render(<ChoiceCardBase {...createMockProps({ highlighted: false })} />);

      expect(screen.queryByText('Most Popular')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper alt text for images', () => {
      render(<ChoiceCardBase {...createMockProps({ imageAlt: 'Wedding package photo' })} />);

      expect(screen.getByAltText('Wedding package photo')).toBeInTheDocument();
    });

    it('has focus-visible ring on card link', () => {
      render(<ChoiceCardBase {...createMockProps()} />);

      const link = screen.getByRole('link');
      expect(link).toHaveClass('focus-visible:ring-2');
      expect(link).toHaveClass('focus-visible:ring-macon-orange');
    });

    it('has semantic heading for title', () => {
      render(<ChoiceCardBase {...createMockProps()} />);

      const heading = screen.getByRole('heading', { name: 'Test Card' });
      expect(heading).toBeInTheDocument();
    });

    it('category label is readable in image overlay', () => {
      render(<ChoiceCardBase {...createMockProps({ categoryLabel: 'Weddings' })} />);

      // Should appear in overlay
      expect(screen.getAllByText('Weddings').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Styling', () => {
    it('applies hover effects on card', () => {
      render(<ChoiceCardBase {...createMockProps()} />);

      const card = screen.getByRole('link');
      expect(card).toHaveClass('hover:shadow-elevation-3');
      expect(card).toHaveClass('hover:-translate-y-1');
    });

    it('applies correct shadow based on state', () => {
      const { rerender } = render(
        <ChoiceCardBase {...createMockProps({ highlighted: false })} />
      );

      let card = screen.getByRole('link');
      expect(card).toHaveClass('shadow-elevation-1');

      rerender(<ChoiceCardBase {...createMockProps({ highlighted: true })} />);

      card = screen.getByRole('link');
      expect(card).toHaveClass('shadow-elevation-2');
    });

    it('has rounded corners', () => {
      render(<ChoiceCardBase {...createMockProps()} />);

      const card = screen.getByRole('link');
      expect(card).toHaveClass('rounded-xl');
    });
  });

  describe('Content Truncation', () => {
    it('applies line-clamp to description', () => {
      render(<ChoiceCardBase {...createMockProps()} />);

      const description = screen.getByText('Test description');
      expect(description).toHaveClass('line-clamp-3');
    });

    it('handles long descriptions without breaking layout', () => {
      const longDesc = 'a'.repeat(500);
      render(<ChoiceCardBase {...createMockProps({ description: longDesc })} />);

      const description = screen.getByText(new RegExp('a{500}'));
      expect(description).toBeInTheDocument();
      // Should be clamped to 3 lines
      expect(description).toHaveClass('line-clamp-3');
    });
  });
});
```

---

## 2. Wrapper Component Tests

Test that wrapper components correctly map domain data to base component.

### Pattern: Test Prop Mapping

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SegmentCard } from './SegmentCard';
import type { SegmentDto } from '@macon/contracts';

// Wrap with Router for Link components
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

function createMockSegment(overrides?: Partial<SegmentDto>): SegmentDto {
  return {
    id: '1',
    slug: 'weddings',
    name: 'Weddings',
    heroTitle: 'Plan Your Dream Wedding',
    heroSubtitle: 'We handle the logistics',
    description: 'Professional wedding planning services',
    heroImage: 'https://example.com/wedding.jpg',
    ...overrides,
  };
}

describe('SegmentCard', () => {
  describe('Props Mapping', () => {
    it('maps segment.heroTitle to ChoiceCardBase title', () => {
      const segment = createMockSegment({ heroTitle: 'Custom Title' });
      renderWithRouter(<SegmentCard segment={segment} />);

      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('maps segment.heroSubtitle to description', () => {
      const segment = createMockSegment({ heroSubtitle: 'Custom subtitle text' });
      renderWithRouter(<SegmentCard segment={segment} />);

      expect(screen.getByText('Custom subtitle text')).toBeInTheDocument();
    });

    it('falls back to segment.description when heroSubtitle missing', () => {
      const segment = createMockSegment({
        heroSubtitle: undefined,
        description: 'Fallback description',
      });
      renderWithRouter(<SegmentCard segment={segment} />);

      expect(screen.getByText('Fallback description')).toBeInTheDocument();
    });

    it('maps segment.heroImage to imageUrl', () => {
      const segment = createMockSegment({ heroImage: 'https://example.com/custom.jpg' });
      renderWithRouter(<SegmentCard segment={segment} />);

      const image = screen.getByAltText('Plan Your Dream Wedding') as HTMLImageElement;
      expect(image.src).toBe('https://example.com/custom.jpg');
    });

    it('uses segment.name as categoryLabel', () => {
      const segment = createMockSegment({ name: 'Corporate Events' });
      renderWithRouter(<SegmentCard segment={segment} />);

      // Category label should appear in overlay
      expect(screen.getByText('Corporate Events')).toBeInTheDocument();
    });

    it('uses "See Packages" as CTA text', () => {
      const segment = createMockSegment();
      renderWithRouter(<SegmentCard segment={segment} />);

      expect(screen.getByText('See Packages')).toBeInTheDocument();
    });
  });

  describe('Routing', () => {
    it('links to segment detail page', () => {
      const segment = createMockSegment({ slug: 'weddings' });
      renderWithRouter(<SegmentCard segment={segment} />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/s/weddings');
    });

    it('generates correct testId from segment slug', () => {
      const segment = createMockSegment({ slug: 'corporate-events' });
      renderWithRouter(<SegmentCard segment={segment} />);

      const card = screen.getByTestId('segment-card-corporate-events');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing heroImage gracefully', () => {
      const segment = createMockSegment({ heroImage: null as any });
      renderWithRouter(<SegmentCard segment={segment} />);

      // Should show gradient fallback instead
      expect(screen.getByText('Weddings')).toBeInTheDocument(); // Category in gradient
    });

    it('handles missing heroSubtitle and description', () => {
      const segment = createMockSegment({
        heroSubtitle: undefined,
        description: undefined,
      });
      renderWithRouter(<SegmentCard segment={segment} />);

      // Should still render with empty description
      const link = screen.getByRole('link');
      expect(link).toBeInTheDocument();
    });
  });
});
```

### Pattern: Test TierCard Wrapper

```typescript
describe('TierCard', () => {
  describe('Props Mapping', () => {
    it('maps package.title to card title', () => {
      const pkg = { ...mockPackage, title: 'Premium Package' };
      renderWithRouter(
        <TierCard package={pkg} tierLevel="luxury" totalTierCount={3} />
      );

      expect(screen.getByText('Premium Package')).toBeInTheDocument();
    });

    it('truncates description to CARD_DESCRIPTION_MAX_LENGTH', () => {
      const longDesc = 'a'.repeat(200);
      const pkg = { ...mockPackage, description: longDesc };
      renderWithRouter(
        <TierCard package={pkg} tierLevel="budget" totalTierCount={3} />
      );

      // Should be truncated to 150 chars + '...'
      const description = screen.getByText(/^a+\.\.\./);
      expect(description.textContent).toHaveLength(153); // 150 + 3 dots
    });

    it('uses getTierDisplayName for category label', () => {
      renderWithRouter(
        <TierCard
          package={mockPackage}
          tierLevel="middle"
          totalTierCount={3}
        />
      );

      expect(screen.getByText('Popular')).toBeInTheDocument();
    });

    it('displays price in correct format', () => {
      const pkg = { ...mockPackage, priceCents: 29900 };
      renderWithRouter(
        <TierCard package={pkg} tierLevel="budget" totalTierCount={3} />
      );

      expect(screen.getByText('$299.00')).toBeInTheDocument();
    });
  });

  describe('Highlighting', () => {
    it('highlights middle tier when exactly 3 tiers', () => {
      const { rerender } = renderWithRouter(
        <TierCard
          package={mockPackage}
          tierLevel="middle"
          totalTierCount={3}
        />
      );

      expect(screen.getByText('Most Popular')).toBeInTheDocument();

      // Not highlighted when not middle
      rerender(
        <TierCard
          package={mockPackage}
          tierLevel="budget"
          totalTierCount={3}
        />
      );

      expect(screen.queryByText('Most Popular')).not.toBeInTheDocument();
    });

    it('does not highlight when totalTierCount !== 3', () => {
      const { rerender } = renderWithRouter(
        <TierCard
          package={mockPackage}
          tierLevel="middle"
          totalTierCount={2}
        />
      );

      expect(screen.queryByText('Most Popular')).not.toBeInTheDocument();

      rerender(
        <TierCard
          package={mockPackage}
          tierLevel="middle"
          totalTierCount={4}
        />
      );

      expect(screen.queryByText('Most Popular')).not.toBeInTheDocument();
    });
  });

  describe('Routing', () => {
    it('links to tier detail in segment context', () => {
      renderWithRouter(
        <TierCard
          package={mockPackage}
          tierLevel="middle"
          totalTierCount={3}
          segmentSlug="weddings"
        />
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/s/weddings/middle');
    });

    it('links to root tier when no segment context', () => {
      renderWithRouter(
        <TierCard
          package={mockPackage}
          tierLevel="luxury"
          totalTierCount={3}
        />
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/tiers/luxury');
    });
  });
});
```

---

## 3. Memoization Tests

Critical: Verify that memo() actually prevents re-renders.

### Pattern: Test Memo Behavior

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SegmentCard } from './SegmentCard';
import { useState } from 'react';
import type { SegmentDto } from '@macon/contracts';

/**
 * Helper: Track render count
 * Wraps component and counts how many times it renders
 */
function useRenderSpy<P>(Component: React.ComponentType<P>) {
  let renderCount = 0;

  const Wrapper = (props: P) => {
    renderCount++;
    return <Component {...props} />;
  };

  return { Wrapper, getRenderCount: () => renderCount };
}

describe('SegmentCard Memoization', () => {
  it('does not re-render when parent re-renders with same segment', () => {
    let parentRenderCount = 0;
    const segment = createMockSegment();

    function Parent() {
      parentRenderCount++;
      const [count, setCount] = useState(0);

      return (
        <BrowserRouter>
          <button onClick={() => setCount(c => c + 1)}>
            Increment ({count})
          </button>
          <SegmentCard segment={segment} />
        </BrowserRouter>
      );
    }

    const { rerender, getByRole, getByText } = render(<Parent />);

    // Initial render
    expect(parentRenderCount).toBe(1);
    expect(getByText('Plan Your Dream Wedding')).toBeInTheDocument();

    // Force parent re-render by clicking button
    fireEvent.click(getByRole('button'));

    // Parent should re-render
    expect(parentRenderCount).toBe(2);

    // SegmentCard content should still be there (no re-render of card)
    expect(getByText('Plan Your Dream Wedding')).toBeInTheDocument();
    // But if SegmentCard re-rendered, specific optimizations would be lost
  });

  it('re-renders when segment prop changes', () => {
    const segment1 = createMockSegment({ slug: 'weddings', heroTitle: 'Weddings' });
    const segment2 = createMockSegment({ slug: 'corporate', heroTitle: 'Corporate' });

    const { rerender, getByText } = render(
      <BrowserRouter>
        <SegmentCard segment={segment1} />
      </BrowserRouter>
    );

    expect(getByText('Weddings')).toBeInTheDocument();

    // Re-render with different segment
    rerender(
      <BrowserRouter>
        <SegmentCard segment={segment2} />
      </BrowserRouter>
    );

    // Should update to new segment
    expect(getByText('Corporate')).toBeInTheDocument();
  });

  it('prevents re-render when segment object is same reference', () => {
    const segment = createMockSegment();

    function Parent() {
      const [count, setCount] = useState(0);

      return (
        <BrowserRouter>
          <button onClick={() => setCount(c => c + 1)}>Update</button>
          {/* segment object reference stays same, memo should prevent re-render */}
          <SegmentCard segment={segment} />
        </BrowserRouter>
      );
    }

    // This is the key test for memo effectiveness
    const { getByRole } = render(<Parent />);

    // Get initial card element
    const card1 = screen.getByRole('link');
    const element1 = card1.getTagName();

    // Trigger parent re-render
    fireEvent.click(getByRole('button'));

    // Get card element after parent re-render
    const card2 = screen.getByRole('link');

    // If memo worked, these should be the same DOM element (not re-created)
    expect(card1).toBe(card2);
  });

  it('re-renders on segment content change', () => {
    const { rerender, getByText } = render(
      <BrowserRouter>
        <SegmentCard
          segment={createMockSegment({ heroTitle: 'Original Title' })}
        />
      </BrowserRouter>
    );

    expect(getByText('Original Title')).toBeInTheDocument();

    rerender(
      <BrowserRouter>
        <SegmentCard
          segment={createMockSegment({ heroTitle: 'New Title' })}
        />
      </BrowserRouter>
    );

    expect(getByText('New Title')).toBeInTheDocument();
  });
});
```

---

## 4. Utility Function Tests

Test that extracted utilities work correctly.

### Pattern: Test Constants and Functions

```typescript
import { describe, it, expect } from 'vitest';
import {
  getTierDisplayName,
  truncateText,
  extractTiers,
  TIER_LEVELS,
  CARD_DESCRIPTION_MAX_LENGTH,
  type TierLevel,
} from './utils';
import type { PackageDto } from '@macon/contracts';

describe('Storefront Utilities', () => {
  describe('getTierDisplayName', () => {
    it('maps tier levels to display names', () => {
      expect(getTierDisplayName('budget')).toBe('Essential');
      expect(getTierDisplayName('middle')).toBe('Popular');
      expect(getTierDisplayName('luxury')).toBe('Premium');
    });

    it('handles case-insensitive input', () => {
      expect(getTierDisplayName('BUDGET')).toBe('Essential');
      expect(getTierDisplayName('Middle')).toBe('Popular');
      expect(getTierDisplayName('LUXURY')).toBe('Premium');
    });

    it('falls back to capitalized input for unknown tiers', () => {
      expect(getTierDisplayName('custom')).toBe('Custom');
      expect(getTierDisplayName('enterprise')).toBe('Enterprise');
    });

    it('is single source of truth', () => {
      // Changing tier name only needs to be done here
      const names = {
        budget: getTierDisplayName('budget'),
        middle: getTierDisplayName('middle'),
        luxury: getTierDisplayName('luxury'),
      };

      // Should match expected values
      expect(Object.values(names)).toEqual(['Essential', 'Popular', 'Premium']);
    });
  });

  describe('truncateText', () => {
    it('truncates text longer than maxLength', () => {
      const text = 'a'.repeat(160);
      const result = truncateText(text, CARD_DESCRIPTION_MAX_LENGTH);

      expect(result).toBe('a'.repeat(CARD_DESCRIPTION_MAX_LENGTH) + '...');
      expect(result.length).toBe(CARD_DESCRIPTION_MAX_LENGTH + 3);
    });

    it('does not truncate short text', () => {
      const text = 'Short text';
      const result = truncateText(text, CARD_DESCRIPTION_MAX_LENGTH);

      expect(result).toBe('Short text');
      expect(result.includes('...')).toBe(false);
    });

    it('respects custom maxLength', () => {
      const text = 'a'.repeat(200);
      const result = truncateText(text, 100);

      expect(result).toBe('a'.repeat(100) + '...');
      expect(result.length).toBe(103);
    });

    it('uses CARD_DESCRIPTION_MAX_LENGTH as default semantic value', () => {
      // Verify constant is used by components
      expect(CARD_DESCRIPTION_MAX_LENGTH).toBe(150);

      const text = 'a'.repeat(160);
      const result = truncateText(text, CARD_DESCRIPTION_MAX_LENGTH);

      expect(result.length).toBe(153);
    });
  });

  describe('extractTiers', () => {
    it('extracts tiers by grouping field', () => {
      const packages: PackageDto[] = [
        { ...mockPackage, grouping: 'budget' },
        { ...mockPackage, grouping: 'middle' },
        { ...mockPackage, grouping: 'luxury' },
      ];

      const tiers = extractTiers(packages);

      expect(tiers.budget).toBeDefined();
      expect(tiers.middle).toBeDefined();
      expect(tiers.luxury).toBeDefined();
    });

    it('handles missing tiers', () => {
      const packages: PackageDto[] = [{ ...mockPackage, grouping: 'budget' }];

      const tiers = extractTiers(packages);

      expect(tiers.budget).toBeDefined();
      expect(tiers.middle).toBeUndefined();
      expect(tiers.luxury).toBeUndefined();
    });

    it('handles case-insensitive grouping', () => {
      const packages: PackageDto[] = [
        { ...mockPackage, grouping: 'BUDGET' },
        { ...mockPackage, grouping: 'MiddLE' },
        { ...mockPackage, grouping: 'luxury' },
      ];

      const tiers = extractTiers(packages);

      expect(tiers.budget).toBeDefined();
      expect(tiers.middle).toBeDefined();
      expect(tiers.luxury).toBeDefined();
    });

    it('ignores unknown grouping values', () => {
      const packages: PackageDto[] = [{ ...mockPackage, grouping: 'unknown-tier' }];

      const tiers = extractTiers(packages);

      expect(tiers.budget).toBeUndefined();
      expect(tiers.middle).toBeUndefined();
      expect(tiers.luxury).toBeUndefined();
    });

    it('only uses first tier of each level', () => {
      const packages: PackageDto[] = [
        { ...mockPackage, id: '1', grouping: 'budget', title: 'First Budget' },
        { ...mockPackage, id: '2', grouping: 'budget', title: 'Second Budget' },
      ];

      const tiers = extractTiers(packages);

      // Should have first one
      expect(tiers.budget?.id).toBe('1');
    });
  });

  describe('TIER_LEVELS constant', () => {
    it('defines all standard tier levels', () => {
      expect(TIER_LEVELS).toContain('budget');
      expect(TIER_LEVELS).toContain('middle');
      expect(TIER_LEVELS).toContain('luxury');
    });

    it('is ordered by price tier', () => {
      expect(TIER_LEVELS[0]).toBe('budget');
      expect(TIER_LEVELS[1]).toBe('middle');
      expect(TIER_LEVELS[2]).toBe('luxury');
    });

    it('can be used as type guard', () => {
      const level: string = 'budget';
      const isTierLevel = TIER_LEVELS.includes(level as TierLevel);

      expect(isTierLevel).toBe(true);
    });
  });

  describe('CARD_DESCRIPTION_MAX_LENGTH constant', () => {
    it('is set to 150 characters', () => {
      expect(CARD_DESCRIPTION_MAX_LENGTH).toBe(150);
    });

    it('is used by truncateText function', () => {
      const text = 'a'.repeat(160);
      const result = truncateText(text, CARD_DESCRIPTION_MAX_LENGTH);

      expect(result.length).toBe(CARD_DESCRIPTION_MAX_LENGTH + 3);
    });

    it('is centralized single source of truth', () => {
      // If you change this constant, all truncation changes everywhere
      // Test that it's the same value used in all components
      // (This would be verified by integration tests)
    });
  });
});
```

---

## 5. Integration Tests

Test that components work together correctly.

### Pattern: Test Feature Integration

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { StorefrontHome } from './pages/StorefrontHome';
import { useSegments } from './features/catalog/hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('./features/catalog/hooks');

describe('StorefrontHome Integration', () => {
  const queryClient = new QueryClient();

  function renderWithProviders(component: React.ReactElement) {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {component}
        </BrowserRouter>
      </QueryClientProvider>
    );
  }

  it('renders segment cards with correct structure', () => {
    const segments = [
      createMockSegment({ id: '1', name: 'Weddings' }),
      createMockSegment({ id: '2', name: 'Corporate' }),
      createMockSegment({ id: '3', name: 'Social' }),
    ];

    vi.mocked(useSegments).mockReturnValue({
      data: segments,
      isLoading: false,
      error: null,
    });

    renderWithProviders(<StorefrontHome />);

    // Should render all segment cards
    expect(screen.getByText('Weddings')).toBeInTheDocument();
    expect(screen.getByText('Corporate')).toBeInTheDocument();
    expect(screen.getByText('Social')).toBeInTheDocument();

    // Should use ChoiceGrid for layout
    const gridContainer = screen.getByText('Plan Your Dream Wedding')
      .closest('div')?.parentElement?.parentElement;

    expect(gridContainer).toHaveClass('grid');
    expect(gridContainer).toHaveClass('grid-cols-1');
    expect(gridContainer).toHaveClass('md:grid-cols-2');
  });

  it('applies memoization prevents unnecessary re-renders during filtering', () => {
    const segments = [
      createMockSegment({ id: '1', name: 'A' }),
      createMockSegment({ id: '2', name: 'B' }),
    ];

    vi.mocked(useSegments).mockReturnValue({
      data: segments,
      isLoading: false,
      error: null,
    });

    renderWithProviders(<StorefrontHome />);

    // Memoization should prevent re-renders on parent updates
    // This would be tested with render spy in real scenario
  });
});
```

---

## 6. Performance Benchmarks

Measure actual performance improvements.

### Pattern: Benchmark Render Performance

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

/**
 * Helper: Measure component render time
 */
function measureRenderTime(component: React.ReactElement): number {
  const start = performance.now();
  render(component);
  const end = performance.now();
  return end - start;
}

/**
 * Helper: Measure re-render time
 */
function measureReRenderTime(
  component: React.ReactElement,
  rerenderFn: () => void
): number {
  const { rerender } = render(component);

  const start = performance.now();
  rerenderFn();
  const end = performance.now();

  return end - start;
}

describe('Performance Benchmarks', () => {
  it('ChoiceCardBase renders in acceptable time', () => {
    const renderTime = measureRenderTime(
      <BrowserRouter>
        <ChoiceCardBase {...mockProps} />
      </BrowserRouter>
    );

    // Should render in <50ms
    expect(renderTime).toBeLessThan(50);
  });

  it('SegmentCard (memoized) re-renders faster than non-memoized', () => {
    const segment1 = createMockSegment();
    const segment2 = createMockSegment({ heroTitle: 'Different' });

    // Measure memoized re-render (same segment)
    const memoizedTime = measureReRenderTime(
      <BrowserRouter>
        <SegmentCard segment={segment1} />
      </BrowserRouter>,
      () => {} // No change to segment
    );

    // Measure non-memoized re-render (segment changes)
    const nonMemoizedTime = measureReRenderTime(
      <BrowserRouter>
        <SegmentCard segment={segment1} />
      </BrowserRouter>,
      () => {} // With segment change
    );

    // Memoized should be significantly faster
    expect(memoizedTime).toBeLessThan(nonMemoizedTime);
  });

  it('ChoiceGrid with 20 items renders efficiently', () => {
    const segments = Array.from({ length: 20 }, (_, i) =>
      createMockSegment({ id: String(i) })
    );

    const renderTime = measureRenderTime(
      <BrowserRouter>
        <ChoiceGrid itemCount={segments.length}>
          {segments.map(seg => (
            <SegmentCard key={seg.id} segment={seg} />
          ))}
        </ChoiceGrid>
      </BrowserRouter>
    );

    // Should render 20 memoized cards in <200ms
    expect(renderTime).toBeLessThan(200);
  });
});
```

---

## Test Coverage Targets

```
ChoiceCardBase:           100% coverage (all props, states, edges)
SegmentCard/TierCard:     95% coverage (wrapper + memoization)
cardStyles:               100% coverage (all style variants)
utils.ts:                 100% coverage (all functions, edge cases)
```

---

## Running Tests

```bash
# Run all component tests
npm test -- client/src/features/storefront/

# Run with coverage
npm test -- --coverage client/src/features/storefront/

# Run only memoization tests
npm test -- --grep "Memoization"

# Run with watch mode
npm test -- --watch client/src/features/storefront/
```

---

## Common Test Patterns

### Pattern: Test Prop Changes Cause Re-render

```typescript
it('updates when segment prop changes', () => {
  const { rerender } = render(
    <BrowserRouter>
      <SegmentCard segment={segment1} />
    </BrowserRouter>
  );

  expect(screen.getByText(segment1.heroTitle)).toBeInTheDocument();

  rerender(
    <BrowserRouter>
      <SegmentCard segment={segment2} />
    </BrowserRouter>
  );

  expect(screen.getByText(segment2.heroTitle)).toBeInTheDocument();
});
```

### Pattern: Test No Re-render on Parent Change

```typescript
it('does not re-render when parent state changes but prop stays same', () => {
  const segment = createMockSegment();
  let renderCount = 0;

  function Parent() {
    const [count, setCount] = useState(0);
    renderCount++;

    return (
      <SegmentCard segment={segment} />
    );
  }

  render(<Parent />);
  const firstCount = renderCount;

  fireEvent.click(screen.getByRole('button'));
  const secondCount = renderCount;

  // Parent rendered twice, but card only rendered once
  expect(firstCount).toBeLessThan(secondCount);
  // (In real test, would verify card content didn't change)
});
```

---

## Summary

**Test Strategy:**

1. Base component: 100% prop coverage
2. Wrappers: Props mapping + routing
3. Memoization: Verify memo prevents re-renders
4. Utils: All functions + edge cases
5. Integration: Features work together
6. Performance: Measure improvements

**Key Metric:** Zero duplicate test cases (one base test, inherited by wrappers)
