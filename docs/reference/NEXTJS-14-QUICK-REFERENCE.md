# Next.js 14 App Router Quick Reference

**Purpose:** Fast lookup for common patterns and best practices
**Audience:** Developers building marketing sites and storefronts

---

## File Structure & Routing

### URL Generation from Files

```
app/                          URL path
├── page.tsx                  /
├── about/
│   └── page.tsx              /about
├── blog/
│   ├── page.tsx              /blog
│   └── [slug]/
│       └── page.tsx          /blog/[slug]
├── (marketing)/
│   ├── page.tsx              /
│   └── services/page.tsx     /services
└── api/
    └── webhooks/route.ts     /api/webhooks
```

### Special Files

| File            | Purpose               |
| --------------- | --------------------- |
| `page.tsx`      | Route component       |
| `layout.tsx`    | Shared layout wrapper |
| `error.tsx`     | Error boundary        |
| `loading.tsx`   | Suspense fallback     |
| `not-found.tsx` | 404 page              |
| `route.ts`      | API route handler     |
| `middleware.ts` | Edge middleware       |

### Route Groups (Parentheses)

```
app/
├── (marketing)/    # Routes but no URL segment
│   ├── page.tsx    # / (not /(marketing))
│   └── about/page.tsx  # /about
└── (admin)/        # Different layout
    └── dashboard/page.tsx  # /dashboard
```

---

## Page Components

### Basic Page

```typescript
// app/about/page.tsx
export default function Page() {
  return <div>About</div>;
}
```

### Page with Dynamic Params

```typescript
// app/blog/[slug]/page.tsx
interface Params {
  slug: string;
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  return <div>Post: {slug}</div>;
}
```

### Page with Search Params

```typescript
// app/search?q=test
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q: string }>;
}) {
  const { q } = await searchParams;
  return <div>Results for: {q}</div>;
}
```

### Page with Metadata

```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About',
  description: 'Learn about us',
  openGraph: {
    title: 'About',
    description: 'Learn about us',
  },
};

export default function Page() {
  return <div>About</div>;
}
```

### Page with Dynamic Metadata

```typescript
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  return {
    title: post.title,
    description: post.excerpt,
  };
}
```

### Page with ISR

```typescript
// Regenerate page every 3600 seconds
export const revalidate = 3600;

export default async function Page() {
  const data = await fetch('/api/data', {
    next: { revalidate: 3600 },
  });

  return <div>{data}</div>;
}
```

### Page with Static Params

```typescript
export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  // ...
}
```

---

## Layout Components

### Root Layout (Required)

```typescript
// app/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

### Nested Layout

```typescript
// app/blog/layout.tsx
export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-4xl mx-auto">
      <header>Blog</header>
      {children}
      <sidebar>Recent posts</sidebar>
    </div>
  );
}
```

### Multiple Layouts (Route Groups)

```typescript
// app/(marketing)/layout.tsx - applies to /about, /services, etc.
export default function MarketingLayout({ children }) {
  return (
    <>
      <nav>Marketing Nav</nav>
      {children}
      <footer>Marketing Footer</footer>
    </>
  );
}

// app/(admin)/layout.tsx - applies to /dashboard, /settings, etc.
export default function AdminLayout({ children }) {
  return (
    <>
      <nav>Admin Nav</nav>
      {children}
    </>
  );
}
```

---

## Error Boundaries & Loading States

### Error Boundary

```typescript
// app/blog/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
```

### Loading State (Suspense)

```typescript
// app/blog/loading.tsx
export default function Loading() {
  return <div className="animate-pulse">Loading...</div>;
}

// Alternative: Use Suspense in page
import { Suspense } from 'react';

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Content />
    </Suspense>
  );
}
```

### Not Found

```typescript
// app/not-found.tsx
export default function NotFound() {
  return (
    <div>
      <h1>404 - Not Found</h1>
      <p>This page doesn't exist</p>
    </div>
  );
}

// Trigger in page:
import { notFound } from 'next/navigation';

export default function Page() {
  if (!item) {
    notFound();
  }
}
```

---

## Data Fetching Patterns

### Caching with `next`

```typescript
// Cache indefinitely
const data = await fetch('/api/data', {
  cache: 'force-cache',
});

// Cache for 1 hour
const data = await fetch('/api/data', {
  next: { revalidate: 3600 },
});

// Tag for on-demand revalidation
const data = await fetch('/api/data', {
  next: { tags: ['blog-posts'] },
});

// No caching (always fresh)
const data = await fetch('/api/data', {
  cache: 'no-store',
});
```

### Request Memoization

```typescript
// Automatic deduplication in same render
async function getUser(id: string) {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}

export default async function Page() {
  const user1 = await getUser('123'); // Fetch
  const user2 = await getUser('123'); // Memoized (same object)
}
```

### Deduplicate with `cache()`

```typescript
import { cache } from 'react';

const getPost = cache(async (slug: string) => {
  return fetch(`/api/posts/${slug}`).then((r) => r.json());
});

export default async function Page() {
  const post1 = await getPost('my-post');
  const post2 = await getPost('my-post'); // Memoized
}
```

### Parallel Data Fetching

```typescript
// Good: Fetch in parallel
export default async function Page() {
  const [posts, comments] = await Promise.all([
    fetch('/api/posts').then((r) => r.json()),
    fetch('/api/comments').then((r) => r.json()),
  ]);
}

// Bad: Fetch sequentially (slower)
export default async function Page() {
  const posts = await fetch('/api/posts');
  const comments = await fetch('/api/comments');
}
```

### Handle Errors in Async Components

```typescript
export default async function Page() {
  try {
    const data = await fetch('/api/data');
    if (!data.ok) throw new Error('Failed to fetch');
    return <div>{data}</div>;
  } catch (error) {
    throw error; // Caught by error.tsx
  }
}
```

---

## Server Components vs Client Components

### Server Component (Default)

```typescript
// app/about/page.tsx - No directive needed
import { db } from '@/lib/db';

export default async function Page() {
  const posts = await db.post.findMany(); // Server only

  return <div>{posts.length} posts</div>;
}
```

**Capabilities:**

- Access databases, APIs, secrets
- Direct backend calls
- No JavaScript sent to browser

### Client Component

```typescript
// Add 'use client' at top
'use client';

import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0); // Hook available

  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

**Capabilities:**

- Use hooks (useState, useEffect, etc.)
- Event listeners and interactivity
- Browser APIs (localStorage, window, etc.)

### Mixed Pattern

```typescript
// Server component with embedded client component
import Counter from '@/components/Counter'; // 'use client'

export default async function Page() {
  const data = await fetchData(); // Server only

  return (
    <div>
      <h1>{data.title}</h1>
      <Counter /> {/* Client component */}
    </div>
  );
}
```

---

## API Routes

### GET Request

```typescript
// app/api/posts/route.ts
export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');

  const posts = await db.post.findMany({
    where: { category },
  });

  return Response.json(posts);
}
```

### POST Request

```typescript
// app/api/posts/route.ts
export async function POST(request: Request) {
  const data = await request.json();

  const post = await db.post.create({ data });

  return Response.json(post, { status: 201 });
}
```

### Dynamic Route

```typescript
// app/api/posts/[id]/route.ts
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await db.post.findUnique({ where: { id } });

  if (!post) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  return Response.json(post);
}
```

### Revalidation from Route Handler

```typescript
// app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from 'next/cache';

export async function POST(request: Request) {
  const secret = request.headers.get('x-secret');

  if (secret !== process.env.REVALIDATE_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { path, tag } = await request.json();

  if (tag) {
    revalidateTag(tag);
  } else {
    revalidatePath(path);
  }

  return Response.json({ revalidated: true });
}
```

---

## Navigation

### Link Component

```typescript
import Link from 'next/link';

export default function Nav() {
  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/about">About</Link>
      <Link href="/blog/my-post">Read post</Link>
    </nav>
  );
}
```

### useRouter (Client Component)

```typescript
'use client';

import { useRouter } from 'next/navigation'; // Note: not 'react-router'

export default function Page() {
  const router = useRouter();

  return (
    <button onClick={() => router.push('/about')}>
      Go to about
    </button>
  );
}
```

### Redirect (Server Component)

```typescript
import { redirect } from 'next/navigation';

export default async function Page() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  return <div>Welcome</div>;
}
```

---

## Caching Strategy Summary

```
Request
  ↓
Request Memoization (per-render, within tree)
  ↓
Data Cache (persistent, tagged/timed revalidation)
  ↓
Full Route Cache (build-time or ISR)
  ↓
Router Cache (client-side, 5min or session)
  ↓
Browser Cache (assets)
```

**For most pages:**

```typescript
export const revalidate = 3600; // 1 hour ISR

export default async function Page() {
  const data = await fetch('/api/data', {
    next: { revalidate: 3600 },
  });

  return <div>{data}</div>;
}
```

---

## Common Mistakes

### ❌ Using `async` in Client Components

```typescript
'use client';

// ❌ Won't work
export default async function Component() {
  const data = await fetch('/api/data');
}

// ✅ Use useEffect
import { useEffect, useState } from 'react';

export default function Component() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/data')
      .then((r) => r.json())
      .then(setData);
  }, []);
}
```

### ❌ Accessing `req` in Server Component

```typescript
// ❌ Won't work
import { cookies } from 'next/headers';

export default async function Page(props) {
  const cookieStore = await cookies(); // Must await!
  const user = cookieStore.get('user');
}
```

### ❌ Hardcoding Environment Variables

```typescript
// ❌ Client won't see this
const API_URL = process.env.DATABASE_URL;

// ✅ Prefix with NEXT_PUBLIC_ for client
const API_URL = process.env.NEXT_PUBLIC_API_URL;
```

### ❌ Not Awaiting Params/SearchParams

```typescript
// ❌ params is a Promise
export default async function Page({ params }) {
  const slug = params.slug; // undefined!
}

// ✅ Await params
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; // ✅ Works
}
```

### ❌ Very Short ISR Times

```typescript
// ❌ Regenerates every second (defeats ISR)
export const revalidate = 1;

// ✅ Use reasonable times
export const revalidate = 60; // At least 60 seconds
```

---

## Performance Checklist

- [ ] All images use `<Image>` component
- [ ] Dynamic params use `generateStaticParams()` for popular routes
- [ ] Data fetches use `cache()` for deduplication
- [ ] ISR TTL is reasonable (≥ 60 seconds)
- [ ] Heavy computations in Server Components
- [ ] Suspense boundaries for slow components
- [ ] Error boundaries on all dynamic routes
- [ ] Loading states for data-heavy pages
- [ ] Lighthouse score > 90

---

## Resources

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Data Fetching Guide](https://nextjs.org/docs/app/building-your-application/data-fetching)
- [Caching Guide](https://nextjs.org/docs/app/building-your-application/caching)
- [ISR Documentation](https://nextjs.org/docs/app/building-your-application/rendering/incremental-static-regeneration)
