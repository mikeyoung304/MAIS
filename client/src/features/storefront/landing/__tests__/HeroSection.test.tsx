/**
 * Unit tests for HeroSection component
 *
 * Tests:
 * - Renders headline and subheadline
 * - Renders CTA button with correct text
 * - Scrolls to experiences section on CTA click
 * - Handles missing background image gracefully
 * - Respects prefers-reduced-motion for scroll behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeroSection } from '../sections/HeroSection';

describe('HeroSection', () => {
  const defaultConfig = {
    headline: 'Welcome to Our Farm',
    subheadline: 'Experience the beauty of nature',
    ctaText: 'Explore Experiences',
    backgroundImageUrl: 'https://example.com/hero.jpg',
  };

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  it('renders headline and subheadline', () => {
    render(<HeroSection config={defaultConfig} />);

    expect(screen.getByText('Welcome to Our Farm')).toBeInTheDocument();
    expect(screen.getByText('Experience the beauty of nature')).toBeInTheDocument();
  });

  it('renders CTA button with correct text', () => {
    render(<HeroSection config={defaultConfig} />);

    expect(screen.getByRole('button', { name: /Explore Experiences/i })).toBeInTheDocument();
  });

  it('scrolls to experiences section on CTA click', async () => {
    const user = userEvent.setup();
    const scrollIntoViewMock = vi.fn();
    const mockElement = { scrollIntoView: scrollIntoViewMock };

    // Mock getElementById to return an element with scrollIntoView
    vi.spyOn(document, 'getElementById').mockReturnValue(mockElement as any);

    render(<HeroSection config={defaultConfig} />);

    // Click the CTA button
    await user.click(screen.getByRole('button'));

    // Verify getElementById was called with correct ID
    expect(document.getElementById).toHaveBeenCalledWith('experiences');

    // Verify scrollIntoView was called
    // In test environment, matchMedia returns false by default, so smooth behavior is used
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: 'smooth',
    });
  });

  it('handles missing background image gracefully', () => {
    const configWithoutImage = {
      headline: 'Welcome to Our Farm',
      subheadline: 'Experience the beauty of nature',
      ctaText: 'Explore Experiences',
    };

    render(<HeroSection config={configWithoutImage} />);

    // Should render without error
    expect(screen.getByText('Welcome to Our Farm')).toBeInTheDocument();
  });

  it('renders without subheadline when not provided', () => {
    const configWithoutSubheadline = {
      headline: 'Welcome to Our Farm',
      ctaText: 'Explore Experiences',
      backgroundImageUrl: 'https://example.com/hero.jpg',
    };

    render(<HeroSection config={configWithoutSubheadline} />);

    expect(screen.getByText('Welcome to Our Farm')).toBeInTheDocument();
    expect(screen.queryByText('Experience the beauty of nature')).not.toBeInTheDocument();
  });

  it('respects prefers-reduced-motion for smooth scrolling', async () => {
    const user = userEvent.setup();
    const scrollIntoViewMock = vi.fn();
    const mockElement = { scrollIntoView: scrollIntoViewMock };

    vi.spyOn(document, 'getElementById').mockReturnValue(mockElement as any);

    // Mock prefers-reduced-motion: reduce
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<HeroSection config={defaultConfig} />);

    await user.click(screen.getByRole('button'));

    // Should use 'auto' behavior when prefers-reduced-motion is enabled
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: 'auto',
    });
  });

  it('does not scroll if experiences section does not exist', async () => {
    const user = userEvent.setup();

    // Mock getElementById to return null (element not found)
    vi.spyOn(document, 'getElementById').mockReturnValue(null);

    render(<HeroSection config={defaultConfig} />);

    // Click should not throw error even if element doesn't exist
    await expect(user.click(screen.getByRole('button'))).resolves.not.toThrow();
  });
});
