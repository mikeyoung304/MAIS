'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

const MountainDemo = dynamic(() => import('./MountainDemo'), {
  ssr: false,
  loading: () => <Placeholder />,
});

export function LazyMountainDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full aspect-video max-h-[500px] rounded-2xl overflow-hidden">
      {shouldLoad ? <MountainDemo /> : <Placeholder />}
    </div>
  );
}

function Placeholder() {
  return (
    <div className="w-full h-full bg-neutral-800 flex items-center justify-center rounded-2xl">
      <div className="text-neutral-500">Loading experience...</div>
    </div>
  );
}

export default LazyMountainDemo;
