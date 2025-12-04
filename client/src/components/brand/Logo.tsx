import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'transparent';
  className?: string;
  linkTo?: string;
  clickable?: boolean;
}

const sizeMap = {
  sm: { width: 120, height: 120 },
  md: { width: 160, height: 160 },
  lg: { width: 200, height: 200 },
  xl: { width: 280, height: 280 },
};

/**
 * Logo Component
 *
 * Flexible, reusable logo component with navigation support.
 * Uses webp format with png fallback for optimal performance.
 *
 * @param size - Logo size: sm (120px), md (160px), lg (200px), xl (280px)
 * @param variant - Logo variant: full (color), transparent (transparent bg), icon (future use)
 * @param className - Additional CSS classes
 * @param linkTo - Navigation destination (defaults to "/")
 * @param clickable - Whether logo should be clickable (defaults to true)
 */
export function Logo({
  size = 'md',
  variant = 'full',
  className,
  linkTo = '/',
  clickable = true,
}: LogoProps) {
  const dimensions = sizeMap[size];

  // Select appropriate logo source based on variant
  const logoSrc = variant === 'transparent' ? '/transparent.png' : '/macon-logo.webp';
  const fallbackSrc = variant === 'transparent' ? '/transparent.png' : '/macon-logo.png';

  const logoImage = (
    <picture>
      <source srcSet={logoSrc} type="image/webp" />
      <img
        src={fallbackSrc}
        alt="MACON AI Solutions"
        width={dimensions.width}
        height={dimensions.height}
        className={cn('object-contain', className)}
      />
    </picture>
  );

  // Return clickable logo with Link wrapper
  if (clickable) {
    return (
      <Link
        to={linkTo}
        className="inline-block hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-macon-orange-500 focus:ring-offset-2 rounded"
        aria-label="MACON AI Solutions - Go to homepage"
      >
        {logoImage}
      </Link>
    );
  }

  // Return non-clickable logo
  return <div className="inline-block">{logoImage}</div>;
}
