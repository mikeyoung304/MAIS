# TODO-208: Missing Lazy Loading for Landing Page Images

## Priority: P2 (Important)

## Status: Closed (Already Implemented)

## Source: Code Review - Landing Page Implementation

## Resolution Date: 2025-12-03

## Description

Landing page images load eagerly, causing unnecessary bandwidth usage and slower initial page loads. Images below the fold should use lazy loading.

**RESOLUTION:** Upon inspection, all four affected section components already have `loading="lazy"` and `decoding="async"` attributes implemented on all image elements. No code changes were required.

## Affected Files

- `client/src/features/storefront/landing/sections/AboutSection.tsx`
- `client/src/features/storefront/landing/sections/TestimonialsSection.tsx`
- `client/src/features/storefront/landing/sections/AccommodationSection.tsx`
- `client/src/features/storefront/landing/sections/GallerySection.tsx`

## Current Pattern

```typescript
// All images load immediately
<img src={config.imageUrl} alt={config.imageAlt} />
```

## Fix Required

Add native lazy loading attribute:

```typescript
// For images below the fold
<img
  src={config.imageUrl}
  alt={config.imageAlt}
  loading="lazy"
  decoding="async"
/>
```

For hero/above-the-fold images, use eager loading (or fetchpriority):

```typescript
// HeroSection - keep eager
<div
  style={{ backgroundImage: `url(${backgroundUrl})` }}
  // Consider using <img> with fetchpriority="high" instead
/>
```

## Recommended Approach by Section

| Section | Loading Strategy |
|---------|-----------------|
| Hero | Eager (fetchpriority="high") |
| About | Lazy |
| Testimonials | Lazy |
| Accommodation | Lazy |
| Gallery | Lazy (with intersection observer for better UX) |

## Advanced: Gallery with Intersection Observer

```typescript
// For smoother gallery loading
function GalleryImage({ src, alt }: { src: string; alt: string }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && imgRef.current) {
          imgRef.current.src = src;
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [src]);

  return (
    <img
      ref={imgRef}
      alt={alt}
      onLoad={() => setIsLoaded(true)}
      className={`transition-opacity ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
    />
  );
}
```

## Acceptance Criteria

- [x] All below-fold images have loading="lazy"
- [x] Hero image loads eagerly with priority
- [ ] Gallery uses intersection observer (optional enhancement - not required)
- [x] Lighthouse performance score maintained or improved
- [x] No layout shift from lazy loading

## Implementation Details

All four section components already include the required attributes:

**AboutSection.tsx** (Lines 72-73, 100-101):
```tsx
<img
  src={safeImageUrl}
  alt={config.imageAlt || ''}
  loading="lazy"
  decoding="async"
  className="w-full h-full object-cover"
/>
```

**TestimonialsSection.tsx** (Lines 65-66):
```tsx
<img
  src={safeImageUrl}
  alt={testimonial.author ? `${testimonial.author}'s photo` : 'Customer photo'}
  loading="lazy"
  decoding="async"
  className="w-12 h-12 rounded-full object-cover"
/>
```

**AccommodationSection.tsx** (Lines 122-123):
```tsx
<img
  src={safeImageUrl}
  alt={config.imageAlt || ''}
  loading="lazy"
  decoding="async"
  className="w-full h-full object-cover"
/>
```

**GallerySection.tsx** (Lines 145-146):
```tsx
<img
  src={image.url}
  alt={imageAlt}
  loading="lazy"
  decoding="async"
  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
/>
```

## Tags

performance, images, lazy-loading, landing-page
