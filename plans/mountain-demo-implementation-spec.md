# Mountain Demo — Technical Implementation Spec

> **Creative spec:** See `mountain-demo-game-spec-v4.md` for the full game design.
> This document covers HOW to build it in the MAIS codebase.

---

## Consensus: All Reviewers Agree

| Decision                               | Rationale                                                    |
| -------------------------------------- | ------------------------------------------------------------ |
| **Single file** (~450 lines)           | 45-second experience doesn't justify multi-file architecture |
| **Canvas 2D**                          | No WebGL/Pixi needed for stick figures and rectangles        |
| **No external dependencies**           | Procedurally drawn, zero asset loading                       |
| **useRef for game state**              | Avoids 60fps re-renders, React only for overlays             |
| **4-state machine**                    | `idle` → `diy` → `handled` → `success`                       |
| **Lazy load via IntersectionObserver** | Don't load until 200px from viewport                         |
| **Focus captured only when playing**   | Never hijack scroll                                          |

---

## File Location

```
apps/web/src/components/home/
├── MountainDemo.tsx        # Single file, ~450 lines
└── LazyMountainDemo.tsx    # Wrapper for IntersectionObserver (~50 lines)
```

**Integration point:** `apps/web/src/app/page.tsx`

```tsx
import { LazyMountainDemo } from '@/components/home/LazyMountainDemo';

// After "shared problem" paragraph, before Project Hub wedge
<section className="py-20 md:py-28 bg-surface">
  <div className="max-w-6xl mx-auto px-6">
    <LazyMountainDemo />
  </div>
</section>;
```

---

## State Machine

```typescript
type GamePhase = 'idle' | 'diy' | 'handled' | 'success';

// Transitions
// idle → diy      (user clicks Play)
// diy → handled   (fail: 3 hits OR 75% progress collapse OR 15-18s timeout)
// handled → success (player reaches summit, 6-10s)
// success → idle  (optional: Play Again)
```

**Implementation:**

```typescript
const phaseRef = useRef<GamePhase>('idle');

// In game loop
if (phaseRef.current === 'diy') {
  if (hitCount >= 3 || elapsed > 16000 || (progress > 0.75 && triggerCollapse)) {
    phaseRef.current = 'handled';
    showOverlay("You don't have to climb this.");
  }
}
```

---

## React Integration Pattern

```typescript
'use client';

export function MountainDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mutable game state (NOT React state)
  const gameRef = useRef({
    phase: 'idle' as GamePhase,
    player: { x: 50, y: 400, vy: 0 },
    boulders: [] as Boulder[],
    elapsed: 0,
    hitCount: 0,
  });

  // React state ONLY for overlays
  const [overlay, setOverlay] = useState<'none' | 'play' | 'fail' | 'success'>('play');

  // Game loop (never triggers React re-render)
  useEffect(() => {
    if (gameRef.current.phase === 'idle') return;

    let frameId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      update(gameRef.current, dt);
      render(canvasRef.current!, gameRef.current);

      if (gameRef.current.phase !== 'idle' && gameRef.current.phase !== 'success') {
        frameId = requestAnimationFrame(loop);
      }
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [overlay]); // Re-run when overlay changes (game start/restart)

  return (
    <div ref={containerRef} className="relative">
      <canvas ref={canvasRef} />
      {overlay !== 'none' && <Overlay type={overlay} onAction={handleAction} />}
    </div>
  );
}
```

---

## Focus Management

**Critical: Never hijack scroll**

```typescript
// Focus captured ONLY during active play
useEffect(() => {
  const container = containerRef.current;
  if (!container) return;

  const isPlaying = gameRef.current.phase === 'diy' || gameRef.current.phase === 'handled';

  if (isPlaying) {
    container.setAttribute('tabindex', '-1');
    container.focus({ preventScroll: true }); // CRITICAL
  } else {
    container.removeAttribute('tabindex');
  }
}, [overlay]);

// Keyboard listeners on CONTAINER, not window
useEffect(() => {
  const container = containerRef.current;
  if (!container) return;

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      gameRef.current.phase = 'idle';
      setOverlay('play');
      return;
    }

    if (e.key === ' ' || e.key === 'ArrowUp') {
      e.preventDefault(); // Only prevent for game keys
      handleInput();
    }
  };

  container.addEventListener('keydown', handleKey);
  return () => container.removeEventListener('keydown', handleKey);
}, []);
```

**Exit conditions:**

- Escape key → reset to idle
- Click outside container → reset to idle
- Scroll away (>50% out of viewport) → reset to idle

---

## Lazy Loading

**LazyMountainDemo.tsx:**

```typescript
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
    <div ref={ref} className="w-full aspect-video max-h-[600px]">
      {shouldLoad ? <MountainDemo /> : <Placeholder />}
    </div>
  );
}

function Placeholder() {
  return (
    <div className="w-full h-full bg-neutral-100 rounded-2xl flex items-center justify-center">
      <p className="text-neutral-400">Loading...</p>
    </div>
  );
}
```

---

## Accessibility

### prefers-reduced-motion

```typescript
const prefersReducedMotion = useRef(
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

// In game component
if (prefersReducedMotion.current) {
  return (
    <div className="w-full aspect-video bg-neutral-50 flex flex-col items-center justify-center gap-6 rounded-2xl">
      <h3 className="font-serif text-3xl text-text-primary text-center">
        Do what you love.<br />The rest is handled.
      </h3>
      <Button href="/signup">Get Started</Button>
    </div>
  );
}
```

### ARIA

```tsx
<div ref={containerRef} role="application" aria-label="Mountain climbing demonstration game">
  <canvas aria-hidden="true" />
  <div className="sr-only" aria-live="polite">
    {phase === 'success' && 'Congratulations! You reached the summit.'}
  </div>
</div>
```

---

## Rendering (Canvas 2D)

### Visual Style (from spec)

- **Monochrome world:** Black, white, grays only
- **Sage accent:** ONLY for jetpack glow, "Get Handled" button, confetti
- **Stick figure:** 5 lines + circle head + lightbulb
- **Mountain:** Stacked rectangles with text labels
- **Boulders:** Circles with centered text

### Draw Functions (~150 lines total)

```typescript
function drawStickFigure(ctx: CanvasRenderingContext2D, x: number, y: number, hasJetpack: boolean) {
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;

  // Head
  ctx.beginPath();
  ctx.arc(x, y - 35, 8, 0, Math.PI * 2);
  ctx.stroke();

  // Body
  ctx.beginPath();
  ctx.moveTo(x, y - 27);
  ctx.lineTo(x, y - 5);
  ctx.stroke();

  // Arms
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 20);
  ctx.lineTo(x + 12, y - 20);
  ctx.stroke();

  // Legs
  ctx.beginPath();
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x - 8, y + 10);
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x + 8, y + 10);
  ctx.stroke();

  // Lightbulb (idea)
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(x + 15, y - 45, 6, 0, Math.PI * 2);
  ctx.fill();

  // Jetpack (handled mode only)
  if (hasJetpack) {
    const gradient = ctx.createRadialGradient(x - 15, y - 15, 0, x - 15, y - 15, 20);
    gradient.addColorStop(0, 'rgba(69, 179, 127, 0.8)'); // Sage
    gradient.addColorStop(1, 'rgba(69, 179, 127, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - 25, y - 25, 20, 30);
  }
}

function drawMountainBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string
) {
  ctx.fillStyle = '#E5E5E5';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#999';
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = '#666';
  ctx.font = '12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 4);
}

function drawBoulder(ctx: CanvasRenderingContext2D, x: number, y: number, label: string) {
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.arc(x, y, 25, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFF';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + 3, 40); // Max width 40px
}
```

---

## Physics (Ultra-Simplified)

```typescript
const GRAVITY = 0.6;
const JUMP_VELOCITY = -12;
const THRUST_POWER = -0.8;
const GLIDE_GRAVITY = 0.2;
const BOULDER_SPEED = 3;
const KNOCKBACK = 50;

function updateDIY(game: GameState, dt: number) {
  // Gravity
  game.player.vy += GRAVITY;
  game.player.y += game.player.vy;

  // Ground collision
  if (game.player.y > 400) {
    game.player.y = 400;
    game.player.vy = 0;
  }

  // Boulder movement
  for (const boulder of game.boulders) {
    boulder.x -= BOULDER_SPEED;
  }

  // Boulder collision (AABB)
  for (const boulder of game.boulders) {
    const dx = game.player.x - boulder.x;
    const dy = game.player.y - boulder.y;
    if (Math.sqrt(dx * dx + dy * dy) < 35) {
      game.hitCount++;
      game.player.x -= KNOCKBACK;
    }
  }

  // Remove off-screen boulders
  game.boulders = game.boulders.filter((b) => b.x > -50);

  // Spawn new boulders
  if (Math.random() < 0.02) {
    game.boulders.push({
      x: 600,
      y: 350 + Math.random() * 100,
      label: randomBoulderLabel(),
    });
  }
}

function updateHandled(game: GameState, dt: number, isThrusting: boolean) {
  if (isThrusting) {
    game.player.vy += THRUST_POWER;
  } else {
    game.player.vy += GLIDE_GRAVITY;
  }

  game.player.y += game.player.vy;
  game.player.y = Math.max(50, game.player.y); // Ceiling

  // Auto-progress toward summit
  game.player.x += 2;

  // Check for summit
  if (game.player.x > 550) {
    game.phase = 'success';
  }
}
```

---

## Labels (from spec)

```typescript
const MOUNTAIN_LABELS = [
  'SEO',
  'Website setup',
  'Payments',
  'Scheduling',
  'Tool connections',
  'Domains',
  'Where do leads come from?',
  'Automations',
  'Forms',
  'Follow-ups',
];

const BOULDER_LABELS = [
  'Missed texts',
  '"Quick question"',
  'Chasing invoices',
  'Miscommunication',
  '"Did you see my email?"',
  'Last-minute changes',
  '"What did we decide?"',
  'Calendar conflict',
];

function randomMountainLabels(count: number): string[] {
  return shuffle(MOUNTAIN_LABELS).slice(0, count);
}

function randomBoulderLabel(): string {
  return BOULDER_LABELS[Math.floor(Math.random() * BOULDER_LABELS.length)];
}
```

---

## Overlays (React Components)

```tsx
function IdleOverlay({ onPlay, onSkip }: { onPlay: () => void; onSkip: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80">
      <p className="text-neutral-600 mb-6">Tap / Space to start</p>
      <div className="flex gap-4">
        <Button onClick={onPlay} variant="primary">
          Play
        </Button>
        <Button onClick={onSkip} variant="ghost">
          Skip
        </Button>
      </div>
    </div>
  );
}

function FailOverlay({ onGetHandled, onKeepTrying }: Props) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90">
      <p className="text-xl text-neutral-700 mb-6 font-serif">"You don't have to climb this."</p>
      <div className="flex gap-4">
        <Button onClick={onGetHandled} className="bg-sage">
          Get Handled
        </Button>
        <Button onClick={onKeepTrying} variant="ghost">
          Keep trying
        </Button>
      </div>
    </div>
  );
}

function SuccessOverlay({ onGetStarted, onPlayAgain }: Props) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white">
      <Confetti /> {/* Simple CSS animation or canvas particles */}
      <h2 className="font-serif text-4xl text-text-primary mb-2">Do what you love.</h2>
      <p className="text-neutral-600 mb-8">The rest is handled.</p>
      <div className="flex gap-4">
        <Button href="/signup" className="bg-sage">
          Get Started
        </Button>
        <Button onClick={onPlayAgain} variant="ghost">
          Play again
        </Button>
      </div>
    </div>
  );
}
```

---

## Analytics Events

```typescript
const trackEvent = (name: string, props?: Record<string, any>) => {
  // Integrate with your analytics (Posthog, Mixpanel, etc.)
  if (typeof window !== 'undefined' && window.analytics) {
    window.analytics.track(name, props);
  }
};

// Usage in game
trackEvent('mountain_demo_viewed');
trackEvent('mountain_demo_play_clicked');
trackEvent('mountain_demo_diy_failed', { reason: 'hits', attempts: 2 });
trackEvent('mountain_demo_get_handled_clicked');
trackEvent('mountain_demo_success_reached');
trackEvent('mountain_demo_cta_clicked');
trackEvent('mountain_demo_skipped');
```

---

## Performance Targets

| Metric              | Target                               |
| ------------------- | ------------------------------------ |
| Bundle size         | < 5KB gzipped                        |
| 60fps               | On all modern devices                |
| Layout shift        | Zero (placeholder matches game size) |
| Time to interactive | < 100ms after load                   |
| Memory              | < 10MB during gameplay               |

---

## Implementation Checklist

### Phase 1: Scaffold (~1 hour)

- [ ] Create `LazyMountainDemo.tsx` with IntersectionObserver
- [ ] Create `MountainDemo.tsx` with canvas setup
- [ ] Implement 4-state machine
- [ ] Add to landing page

### Phase 2: DIY Mode (~2 hours)

- [ ] Draw stick figure with lightbulb
- [ ] Draw mountain blocks with labels
- [ ] Implement jump physics
- [ ] Spawn and move boulders
- [ ] Collision detection
- [ ] Fail conditions (hits/timer/collapse)
- [ ] Fail overlay

### Phase 3: Handled Mode (~1 hour)

- [ ] Jetpack visual (sage glow)
- [ ] Thrust/glide physics
- [ ] Auto-progress to summit
- [ ] Transition to success

### Phase 4: Success + Polish (~1 hour)

- [ ] Success overlay with CTAs
- [ ] Simple confetti effect
- [ ] Idle preview loop
- [ ] Focus management (Esc, click-outside, scroll-away)
- [ ] prefers-reduced-motion fallback

### Phase 5: Integration (~30 min)

- [ ] Add analytics events
- [ ] Test on mobile (touch)
- [ ] Test accessibility
- [ ] Performance check

**Total estimate: 5-6 hours**

---

## File Summary

| File                   | Lines    | Purpose                         |
| ---------------------- | -------- | ------------------------------- |
| `LazyMountainDemo.tsx` | ~50      | IntersectionObserver wrapper    |
| `MountainDemo.tsx`     | ~450     | Game logic, rendering, overlays |
| **Total**              | **~500** | Complete implementation         |

---

## Tone Reminder (from spec)

This experience should feel:

- ✅ Calm
- ✅ Knowing
- ✅ Slightly wry
- ✅ Relieving

**Handled doesn't make you stronger. Handled makes the climb unnecessary.**
