'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface HandledLogoProps {
  /** Logo variant: 'dark' for dark backgrounds, 'light' for light backgrounds, 'icon-only' for icon without text */
  variant?: 'dark' | 'light' | 'icon-only';
  /** Size preset: sm (24px icon), md (32px icon), lg (48px icon) */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the "HANDLED" text next to the icon */
  showText?: boolean;
  /** Optional link href - if provided, logo becomes a link */
  href?: string;
  /** Additional className for the container */
  className?: string;
}

const sizeConfig = {
  sm: {
    icon: 24,
    text: 'text-lg',
    gap: 'gap-2',
  },
  md: {
    icon: 32,
    text: 'text-xl',
    gap: 'gap-2.5',
  },
  lg: {
    icon: 48,
    text: 'text-3xl',
    gap: 'gap-3',
  },
};

/**
 * HandledLogo - Reusable logo component for HANDLED platform
 *
 * Displays the H icon mark with optional "HANDLED" text.
 * Supports dark/light variants and multiple sizes.
 *
 * @example
 * // Auth pages - large with text on dark background
 * <HandledLogo variant="dark" size="lg" href="/" />
 *
 * // Sidebar collapsed - icon only
 * <HandledLogo variant="dark" size="md" showText={false} />
 *
 * // Sidebar expanded - icon with text
 * <HandledLogo variant="dark" size="md" href="/" />
 */
export function HandledLogo({
  variant = 'dark',
  size = 'md',
  showText = true,
  href,
  className,
}: HandledLogoProps) {
  const config = sizeConfig[size];
  const isIconOnly = variant === 'icon-only' || !showText;

  // Text color based on variant
  const textColor = variant === 'light' ? 'text-text-primary' : 'text-white';

  const content = (
    <div
      className={cn(
        'flex items-center',
        config.gap,
        href && 'transition-opacity hover:opacity-80',
        className
      )}
    >
      {/* Logo Icon */}
      <div className="relative flex-shrink-0" style={{ width: config.icon, height: config.icon }}>
        <Image
          src="/logo.png"
          alt="HANDLED"
          fill
          className="object-contain"
          sizes={`${config.icon}px`}
          priority
        />
      </div>

      {/* Text */}
      {!isIconOnly && (
        <span className={cn('font-serif font-bold', config.text, textColor)}>HANDLED</span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 rounded-md"
      >
        {content}
      </Link>
    );
  }

  return content;
}

export default HandledLogo;
