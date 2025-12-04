---
status: pending
priority: p3
issue_id: '220'
tags: [documentation, storybook, components, landing-page]
dependencies: []
---

# TODO-220: Missing Storybook Stories for Landing Page Sections

## Priority: P3 (Nice-to-have)

## Status: Deferred

## Reason for Deferral

Storybook is not configured in this project. No `.storybook/` directory or `@storybook/*` dependencies found in `client/package.json` or root `package.json`.

To implement this TODO, first configure Storybook by:

1. Installing Storybook dependencies: `npx storybook@latest init`
2. Configuring `.storybook/main.ts` and `.storybook/preview.ts`
3. Adding Storybook scripts to `client/package.json`

Once Storybook is set up, this TODO can be reopened and the stories can be created as outlined below.

## Source: Code Review - Landing Page Implementation

## Description

Landing page section components would benefit from Storybook documentation for design review, testing in isolation, and component documentation.

## Suggested Stories

### HeroSection Stories

```typescript
// client/src/features/storefront/landing/sections/HeroSection.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { HeroSection } from './HeroSection';

const meta: Meta<typeof HeroSection> = {
  title: 'Landing Page/HeroSection',
  component: HeroSection,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof HeroSection>;

export const Default: Story = {
  args: {
    config: {
      headline: 'Welcome to Little Bit Farm',
      subheadline: 'Experience the beauty of rural life',
      ctaText: 'Explore Experiences',
      backgroundImageUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef',
    },
  },
};

export const WithoutImage: Story = {
  args: {
    config: {
      headline: 'Welcome to Our Business',
      subheadline: 'Your journey starts here',
      ctaText: 'Get Started',
    },
  },
};

export const LongContent: Story = {
  args: {
    config: {
      headline: 'This is a very long headline that might wrap to multiple lines on smaller screens',
      subheadline:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.',
      ctaText: 'Learn More About Us',
    },
  },
};
```

### FaqSection Stories

```typescript
// client/src/features/storefront/landing/sections/FaqSection.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { FaqSection } from './FaqSection';

const meta: Meta<typeof FaqSection> = {
  title: 'Landing Page/FaqSection',
  component: FaqSection,
};

export default meta;
type Story = StoryObj<typeof FaqSection>;

export const Default: Story = {
  args: {
    config: {
      title: 'Frequently Asked Questions',
      subtitle: 'Find answers to common questions',
      faqs: [
        { id: '1', question: 'What are your hours?', answer: 'We are open 9am-5pm daily.' },
        {
          id: '2',
          question: 'Do you accept credit cards?',
          answer: 'Yes, we accept all major credit cards.',
        },
      ],
    },
  },
};

export const ManyQuestions: Story = {
  args: {
    config: {
      title: 'FAQ',
      faqs: Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        question: `Question ${i + 1}?`,
        answer: `Answer to question ${i + 1}. This is a detailed explanation.`,
      })),
    },
  },
};
```

## File Structure

```
client/src/features/storefront/landing/sections/
├── HeroSection.tsx
├── HeroSection.stories.tsx
├── SocialProofBar.tsx
├── SocialProofBar.stories.tsx
├── AboutSection.tsx
├── AboutSection.stories.tsx
├── TestimonialsSection.tsx
├── TestimonialsSection.stories.tsx
├── AccommodationSection.tsx
├── AccommodationSection.stories.tsx
├── GallerySection.tsx
├── GallerySection.stories.tsx
├── FaqSection.tsx
├── FaqSection.stories.tsx
├── FinalCtaSection.tsx
└── FinalCtaSection.stories.tsx
```

## Acceptance Criteria

- [ ] Story file for each section component
- [ ] Multiple variants per component (default, edge cases)
- [ ] Storybook renders without errors
- [ ] Visual regression snapshots (optional)

## Tags

documentation, storybook, components, landing-page
