import { ReactNode } from 'react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { cn } from '@/lib/utils';

type AnimationType = 'fade-in-up' | 'fade-in' | 'scale-in';

interface AnimatedSectionProps {
  children: ReactNode;
  animation?: AnimationType;
  delay?: number;
  className?: string;
}

/**
 * Wrapper component that animates children when they scroll into view
 */
export function AnimatedSection({
  children,
  animation = 'fade-in-up',
  delay = 0,
  className,
}: AnimatedSectionProps) {
  const { ref, isVisible } = useScrollAnimation();

  const animationClass = {
    'fade-in-up': 'animate-fade-in-up',
    'fade-in': 'animate-fade-in',
    'scale-in': 'animate-scale-in',
  }[animation];

  return (
    <div
      ref={ref}
      className={cn('opacity-0', isVisible && animationClass, className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
