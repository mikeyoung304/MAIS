/**
 * Unit tests for FaqSection component
 *
 * Tests:
 * - Renders FAQ title
 * - Expands FAQ on click
 * - Collapses FAQ when clicking again
 * - Handles empty FAQ items gracefully
 * - Keyboard navigation (Arrow keys, Home, End)
 * - ARIA attributes for accessibility
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FaqSection } from '../sections/FaqSection';

describe('FaqSection', () => {
  const defaultConfig = {
    headline: 'Frequently Asked Questions',
    items: [
      { question: 'What are your hours?', answer: 'We are open 9am-5pm daily.' },
      { question: 'Do you accept credit cards?', answer: 'Yes, we accept all major credit cards.' },
      { question: 'Can I bring my pet?', answer: 'Sorry, pets are not allowed on the farm.' },
    ],
  };

  beforeEach(() => {
    // Reset any DOM state before each test
  });

  it('renders FAQ title', () => {
    render(<FaqSection config={defaultConfig} />);
    expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();
  });

  it('expands FAQ on click', async () => {
    const user = userEvent.setup();
    render(<FaqSection config={defaultConfig} />);

    const question = screen.getByRole('button', { name: /What are your hours?/i });

    // Initially collapsed (answer hidden)
    expect(screen.queryByText('We are open 9am-5pm daily.')).not.toBeVisible();

    // Click to expand
    await user.click(question);

    // Answer should be visible
    expect(screen.getByText('We are open 9am-5pm daily.')).toBeVisible();
  });

  it('collapses FAQ when clicking again', async () => {
    const user = userEvent.setup();
    render(<FaqSection config={defaultConfig} />);

    const question = screen.getByRole('button', { name: /What are your hours?/i });

    // Click to expand
    await user.click(question);
    expect(screen.getByText('We are open 9am-5pm daily.')).toBeVisible();

    // Click again to collapse
    await user.click(question);
    expect(screen.queryByText('We are open 9am-5pm daily.')).not.toBeVisible();
  });

  it('collapses other FAQs when opening a new one', async () => {
    const user = userEvent.setup();
    render(<FaqSection config={defaultConfig} />);

    // Expand first FAQ
    const firstQuestion = screen.getByRole('button', { name: /What are your hours?/i });
    await user.click(firstQuestion);
    expect(screen.getByText('We are open 9am-5pm daily.')).toBeVisible();

    // Expand second FAQ
    const secondQuestion = screen.getByRole('button', { name: /Do you accept credit cards?/i });
    await user.click(secondQuestion);
    expect(screen.getByText('Yes, we accept all major credit cards.')).toBeVisible();

    // First FAQ should now be collapsed
    expect(screen.queryByText('We are open 9am-5pm daily.')).not.toBeVisible();
  });

  it('handles empty FAQ items gracefully', () => {
    const emptyConfig = {
      headline: 'Frequently Asked Questions',
      items: [],
    };

    const { container } = render(<FaqSection config={emptyConfig} />);

    // Component should return null for empty items
    expect(container.firstChild).toBeNull();
  });

  it('handles missing config gracefully', () => {
    const { container } = render(<FaqSection config={null as any} />);

    // Component should return null for invalid config
    expect(container.firstChild).toBeNull();
  });

  it('navigates with arrow down key', async () => {
    const user = userEvent.setup();
    render(<FaqSection config={defaultConfig} />);

    const firstQuestion = screen.getByRole('button', { name: /What are your hours?/i });
    const secondQuestion = screen.getByRole('button', { name: /Do you accept credit cards?/i });

    // Focus first question
    firstQuestion.focus();

    // Press arrow down
    await user.keyboard('{ArrowDown}');

    // Second question should be focused
    expect(secondQuestion).toHaveFocus();
  });

  it('navigates with arrow up key', async () => {
    const user = userEvent.setup();
    render(<FaqSection config={defaultConfig} />);

    const firstQuestion = screen.getByRole('button', { name: /What are your hours?/i });
    const secondQuestion = screen.getByRole('button', { name: /Do you accept credit cards?/i });

    // Focus second question
    secondQuestion.focus();

    // Press arrow up
    await user.keyboard('{ArrowUp}');

    // First question should be focused
    expect(firstQuestion).toHaveFocus();
  });

  it('wraps to last item when pressing arrow up on first item', async () => {
    const user = userEvent.setup();
    render(<FaqSection config={defaultConfig} />);

    const firstQuestion = screen.getByRole('button', { name: /What are your hours?/i });
    const lastQuestion = screen.getByRole('button', { name: /Can I bring my pet?/i });

    // Focus first question
    firstQuestion.focus();

    // Press arrow up (should wrap to last)
    await user.keyboard('{ArrowUp}');

    // Last question should be focused
    expect(lastQuestion).toHaveFocus();
  });

  it('wraps to first item when pressing arrow down on last item', async () => {
    const user = userEvent.setup();
    render(<FaqSection config={defaultConfig} />);

    const firstQuestion = screen.getByRole('button', { name: /What are your hours?/i });
    const lastQuestion = screen.getByRole('button', { name: /Can I bring my pet?/i });

    // Focus last question
    lastQuestion.focus();

    // Press arrow down (should wrap to first)
    await user.keyboard('{ArrowDown}');

    // First question should be focused
    expect(firstQuestion).toHaveFocus();
  });

  it('jumps to first item with Home key', async () => {
    const user = userEvent.setup();
    render(<FaqSection config={defaultConfig} />);

    const firstQuestion = screen.getByRole('button', { name: /What are your hours?/i });
    const secondQuestion = screen.getByRole('button', { name: /Do you accept credit cards?/i });

    // Focus second question
    secondQuestion.focus();

    // Press Home
    await user.keyboard('{Home}');

    // First question should be focused
    expect(firstQuestion).toHaveFocus();
  });

  it('jumps to last item with End key', async () => {
    const user = userEvent.setup();
    render(<FaqSection config={defaultConfig} />);

    const firstQuestion = screen.getByRole('button', { name: /What are your hours?/i });
    const lastQuestion = screen.getByRole('button', { name: /Can I bring my pet?/i });

    // Focus first question
    firstQuestion.focus();

    // Press End
    await user.keyboard('{End}');

    // Last question should be focused
    expect(lastQuestion).toHaveFocus();
  });

  it('has correct ARIA attributes when collapsed', () => {
    render(<FaqSection config={defaultConfig} />);

    const firstQuestion = screen.getByRole('button', { name: /What are your hours?/i });

    // Should have aria-expanded="false" when collapsed
    expect(firstQuestion).toHaveAttribute('aria-expanded', 'false');

    // Should have aria-controls pointing to answer region
    expect(firstQuestion).toHaveAttribute('aria-controls');
  });

  it('has correct ARIA attributes when expanded', async () => {
    const user = userEvent.setup();
    render(<FaqSection config={defaultConfig} />);

    const firstQuestion = screen.getByRole('button', { name: /What are your hours?/i });

    // Expand the FAQ
    await user.click(firstQuestion);

    // Should have aria-expanded="true" when expanded
    expect(firstQuestion).toHaveAttribute('aria-expanded', 'true');
  });

  it('handles multi-paragraph answers', async () => {
    const user = userEvent.setup();
    const configWithMultiParagraph = {
      headline: 'Frequently Asked Questions',
      items: [
        {
          question: 'What should I know?',
          answer: 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.',
        },
      ],
    };

    render(<FaqSection config={configWithMultiParagraph} />);

    const question = screen.getByRole('button', { name: /What should I know?/i });
    await user.click(question);

    // All three paragraphs should be rendered
    expect(screen.getByText('First paragraph.')).toBeInTheDocument();
    expect(screen.getByText('Second paragraph.')).toBeInTheDocument();
    expect(screen.getByText('Third paragraph.')).toBeInTheDocument();
  });
});
