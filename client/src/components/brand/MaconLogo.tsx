import { cn } from '@/lib/utils';

interface MaconLogoProps {
  variant?: 'full' | 'icon' | 'horizontal' | 'transparent';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: { width: 120, height: 120 },
  md: { width: 160, height: 160 },
  lg: { width: 200, height: 200 },
  xl: { width: 280, height: 280 },
};

export const MaconLogo: React.FC<MaconLogoProps> = ({
  variant = 'full',
  size = 'md',
  className,
}) => {
  const dimensions = sizeMap[size];

  // Use transparent logo for transparent variant
  const logoSrc = variant === 'transparent' ? '/transparent.png' : '/macon-logo.png';

  return (
    <img
      src={logoSrc}
      alt="MACON AI SOLUTIONS"
      width={dimensions.width}
      height={dimensions.height}
      className={cn('object-contain', className)}
    />
  );
};
