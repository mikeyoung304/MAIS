# Mountain Demo — Build Prompt

> **Copy everything below this line to a new Claude Code window.**

---

## TASK: Build the Mountain Demo Game

You are building a 20-45 second micro-game for the HANDLED landing page. This game demonstrates the product promise through experience: the player struggles to climb a mountain of admin tasks (DIY mode), then effortlessly soars above it with a jetpack (Handled mode).

**This is NOT a replayable game. It's a narrative experience with one flow:**
`Idle Preview` → `DIY Struggle` → `Fail` → `Handled Relief` → `Success`

---

## PROJECT CONTEXT

- **Codebase:** MAIS (Multi-tenant AI platform)
- **Location:** `/Users/mikeyoung/CODING/MAIS`
- **Framework:** Next.js 14 App Router
- **Frontend:** `apps/web/` (React 18, TypeScript strict, TailwindCSS)
- **Landing page:** `apps/web/src/app/page.tsx`
- **Design tokens:** Sage green `#45B37F`, dark theme, serif headlines

---

## FILES TO CREATE

```
apps/web/src/components/home/
├── LazyMountainDemo.tsx    # ~50 lines - IntersectionObserver wrapper
└── MountainDemo.tsx        # ~450 lines - The complete game
```

**Total: ~500 lines across 2 files**

---

## PHASE 1: Scaffold (~1 hour)

### 1.1 Create `LazyMountainDemo.tsx`

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
    <div ref={ref} className="w-full aspect-video max-h-[500px] rounded-2xl overflow-hidden">
      {shouldLoad ? <MountainDemo /> : <Placeholder />}
    </div>
  );
}

function Placeholder() {
  return (
    <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
      <div className="text-neutral-400">Loading experience...</div>
    </div>
  );
}

export default LazyMountainDemo;
```

### 1.2 Create `MountainDemo.tsx` scaffold

```typescript
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// === TYPES ===
type GamePhase = 'idle' | 'diy' | 'handled' | 'success';

interface Player {
  x: number;
  y: number;
  vy: number;
}

interface Boulder {
  x: number;
  y: number;
  label: string;
}

interface GameState {
  phase: GamePhase;
  player: Player;
  boulders: Boulder[];
  elapsed: number;
  hitCount: number;
  mountainLabels: string[];
}

// === CONSTANTS ===
const GRAVITY = 0.5;
const JUMP_VELOCITY = -11;
const THRUST_POWER = -0.7;
const GLIDE_GRAVITY = 0.15;
const BOULDER_SPEED = 2.5;
const GROUND_Y = 380;
const FAIL_HIT_COUNT = 3;
const FAIL_TIMEOUT = 16000; // 16 seconds

const MOUNTAIN_LABELS = [
  'SEO', 'Website setup', 'Payments', 'Scheduling',
  'Tool connections', 'Domains', 'Automations', 'Forms', 'Follow-ups',
];

const BOULDER_LABELS = [
  'Missed texts', '"Quick question"', 'Chasing invoices',
  'Miscommunication', '"Did you see my email?"',
  'Last-minute changes', '"What did we decide?"', 'Calendar conflict',
];

// === COMPONENT ===
export default function MountainDemo() {
  // Canvas and container refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Game state (mutable ref to avoid re-renders during gameplay)
  const gameRef = useRef<GameState>(createInitialState());
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const inputRef = useRef({ jump: false, thrust: false });

  // React state ONLY for overlays
  const [overlay, setOverlay] = useState<'idle' | 'fail' | 'success' | 'none'>('idle');
  const [isFocused, setIsFocused] = useState(false);

  // Check reduced motion preference
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // ... (implement remaining logic per phases below)

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-white outline-none"
      role="application"
      aria-label="Mountain climbing demonstration"
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Overlays rendered by React */}
      {overlay === 'idle' && <IdleOverlay onPlay={startGame} onSkip={handleSkip} />}
      {overlay === 'fail' && <FailOverlay onGetHandled={startHandled} onKeepTrying={restartDIY} />}
      {overlay === 'success' && <SuccessOverlay />}
    </div>
  );
}

function createInitialState(): GameState {
  return {
    phase: 'idle',
    player: { x: 80, y: GROUND_Y, vy: 0 },
    boulders: [],
    elapsed: 0,
    hitCount: 0,
    mountainLabels: shuffle(MOUNTAIN_LABELS).slice(0, 6),
  };
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
```

---

## PHASE 2: DIY Mode (~2 hours)

### 2.1 Implement game loop

```typescript
// Inside MountainDemo component

const startGame = useCallback(() => {
  gameRef.current = createInitialState();
  gameRef.current.phase = 'diy';
  setOverlay('none');
  lastTimeRef.current = performance.now();
  animationRef.current = requestAnimationFrame(gameLoop);
}, []);

const gameLoop = useCallback((now: number) => {
  const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05); // Cap at 50ms
  lastTimeRef.current = now;

  const game = gameRef.current;
  const canvas = canvasRef.current;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Update based on phase
  if (game.phase === 'diy') {
    updateDIY(game, dt, inputRef.current);
  } else if (game.phase === 'handled') {
    updateHandled(game, dt, inputRef.current);
  }

  // Render
  render(ctx, canvas.width, canvas.height, game);

  // Check for phase transitions
  if (game.phase === 'diy' && shouldFailDIY(game)) {
    game.phase = 'idle'; // Pause
    setOverlay('fail');
    return;
  }

  if (game.phase === 'handled' && game.player.x > 520) {
    game.phase = 'success';
    setOverlay('success');
    return;
  }

  // Continue loop
  if (game.phase === 'diy' || game.phase === 'handled') {
    animationRef.current = requestAnimationFrame(gameLoop);
  }
}, []);
```

### 2.2 DIY physics

```typescript
function updateDIY(game: GameState, dt: number, input: { jump: boolean; thrust: boolean }) {
  const player = game.player;

  // Jump input
  if (input.jump && player.y >= GROUND_Y - 1) {
    player.vy = JUMP_VELOCITY;
    input.jump = false; // Consume input
  }

  // Gravity
  player.vy += GRAVITY;
  player.y += player.vy;

  // Ground collision
  if (player.y > GROUND_Y) {
    player.y = GROUND_Y;
    player.vy = 0;
  }

  // Auto-advance (slow climb attempt)
  player.x += 0.3;

  // Spawn boulders
  if (Math.random() < 0.012) {
    game.boulders.push({
      x: 600,
      y: GROUND_Y - 20 - Math.random() * 60,
      label: BOULDER_LABELS[Math.floor(Math.random() * BOULDER_LABELS.length)],
    });
  }

  // Update boulders
  for (const boulder of game.boulders) {
    boulder.x -= BOULDER_SPEED;
  }

  // Collision detection
  for (const boulder of game.boulders) {
    const dx = player.x - boulder.x;
    const dy = player.y - 15 - boulder.y;
    if (Math.sqrt(dx * dx + dy * dy) < 40) {
      game.hitCount++;
      player.x = Math.max(60, player.x - 40); // Knockback
      boulder.x = -100; // Remove boulder
    }
  }

  // Remove off-screen boulders
  game.boulders = game.boulders.filter((b) => b.x > -50);

  // Update timer
  game.elapsed += dt * 1000;
}

function shouldFailDIY(game: GameState): boolean {
  return game.hitCount >= FAIL_HIT_COUNT || game.elapsed > FAIL_TIMEOUT;
}
```

### 2.3 Rendering

```typescript
function render(ctx: CanvasRenderingContext2D, width: number, height: number, game: GameState) {
  // Clear
  ctx.fillStyle = '#FAFAFA';
  ctx.fillRect(0, 0, width, height);

  // Ground line
  ctx.strokeStyle = '#E5E5E5';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 30);
  ctx.lineTo(width, GROUND_Y + 30);
  ctx.stroke();

  // Mountain blocks
  drawMountain(ctx, game.mountainLabels);

  // Boulders
  for (const boulder of game.boulders) {
    drawBoulder(ctx, boulder);
  }

  // Player
  drawPlayer(ctx, game.player, game.phase === 'handled');
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: Player, hasJetpack: boolean) {
  const { x, y } = player;

  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  // Head
  ctx.beginPath();
  ctx.arc(x, y - 32, 8, 0, Math.PI * 2);
  ctx.stroke();

  // Body
  ctx.beginPath();
  ctx.moveTo(x, y - 24);
  ctx.lineTo(x, y - 5);
  ctx.stroke();

  // Arms
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 18);
  ctx.lineTo(x + 12, y - 18);
  ctx.stroke();

  // Legs
  ctx.beginPath();
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x - 8, y + 8);
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x + 8, y + 8);
  ctx.stroke();

  // Lightbulb (idea)
  ctx.fillStyle = '#FFD54F';
  ctx.beginPath();
  ctx.arc(x + 14, y - 42, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FBC02D';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Jetpack (handled mode)
  if (hasJetpack) {
    // Jetpack body
    ctx.fillStyle = '#45B37F';
    ctx.beginPath();
    ctx.roundRect(x - 18, y - 22, 8, 20, 2);
    ctx.fill();

    // Thrust glow
    const gradient = ctx.createRadialGradient(x - 14, y + 5, 0, x - 14, y + 5, 25);
    gradient.addColorStop(0, 'rgba(69, 179, 127, 0.6)');
    gradient.addColorStop(1, 'rgba(69, 179, 127, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x - 14, y + 5, 25, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMountain(ctx: CanvasRenderingContext2D, labels: string[]) {
  const blocks = [
    { x: 200, y: GROUND_Y - 30, w: 80, h: 30 },
    { x: 260, y: GROUND_Y - 60, w: 70, h: 30 },
    { x: 310, y: GROUND_Y - 95, w: 75, h: 35 },
    { x: 365, y: GROUND_Y - 130, w: 65, h: 35 },
    { x: 410, y: GROUND_Y - 170, w: 70, h: 40 },
    { x: 460, y: GROUND_Y - 210, w: 80, h: 40 },
  ];

  blocks.forEach((block, i) => {
    ctx.fillStyle = '#F5F5F5';
    ctx.fillRect(block.x, block.y, block.w, block.h);
    ctx.strokeStyle = '#DDD';
    ctx.lineWidth = 1;
    ctx.strokeRect(block.x, block.y, block.w, block.h);

    if (labels[i]) {
      ctx.fillStyle = '#888';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], block.x + block.w / 2, block.y + block.h / 2 + 4, block.w - 8);
    }
  });

  // Success platform
  ctx.fillStyle = '#45B37F';
  ctx.fillRect(520, GROUND_Y - 250, 60, 8);
  ctx.fillStyle = '#333';
  ctx.font = 'bold 12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Success', 550, GROUND_Y - 260);
}

function drawBoulder(ctx: CanvasRenderingContext2D, boulder: Boulder) {
  ctx.fillStyle = '#9E9E9E';
  ctx.beginPath();
  ctx.arc(boulder.x, boulder.y, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFF';
  ctx.font = '9px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(boulder.label, boulder.x, boulder.y + 3, 38);
}
```

---

## PHASE 3: Handled Mode (~1 hour)

### 3.1 Handled physics

```typescript
function updateHandled(game: GameState, dt: number, input: { jump: boolean; thrust: boolean }) {
  const player = game.player;

  // Thrust or glide
  if (input.thrust) {
    player.vy += THRUST_POWER;
    player.vy = Math.max(player.vy, -6); // Cap upward velocity
  } else {
    player.vy += GLIDE_GRAVITY;
  }

  player.y += player.vy;

  // Boundaries
  player.y = Math.max(50, Math.min(GROUND_Y, player.y));

  // Auto-progress toward summit (much faster than DIY)
  player.x += 1.5;

  // Optional: auto-guide if user does nothing
  if (game.elapsed > 3000 && player.y > GROUND_Y - 100) {
    player.vy -= 0.3; // Gentle lift
  }

  game.elapsed += dt * 1000;
}

const startHandled = useCallback(() => {
  gameRef.current.phase = 'handled';
  gameRef.current.elapsed = 0;
  gameRef.current.boulders = []; // Clear boulders
  setOverlay('none');
  lastTimeRef.current = performance.now();
  animationRef.current = requestAnimationFrame(gameLoop);
}, [gameLoop]);
```

---

## PHASE 4: Overlays & Polish (~1 hour)

### 4.1 Overlay components

```typescript
function IdleOverlay({ onPlay, onSkip }: { onPlay: () => void; onSkip: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
      <p className="text-neutral-500 text-sm mb-6">Press Space or tap to play</p>
      <div className="flex gap-3">
        <button
          onClick={onPlay}
          className="px-8 py-3 bg-neutral-900 text-white rounded-full font-medium hover:bg-neutral-800 transition-colors"
        >
          Play
        </button>
        <button
          onClick={onSkip}
          className="px-6 py-3 text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

function FailOverlay({ onGetHandled, onKeepTrying }: { onGetHandled: () => void; onKeepTrying: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm">
      <p className="font-serif text-2xl text-neutral-700 mb-8 text-center px-6">
        "You don't have to climb this."
      </p>
      <div className="flex gap-3">
        <button
          onClick={onGetHandled}
          className="px-8 py-3 bg-sage hover:bg-sage-hover text-white rounded-full font-medium transition-colors"
        >
          Get Handled
        </button>
        <button
          onClick={onKeepTrying}
          className="px-6 py-3 text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          Keep trying
        </button>
      </div>
    </div>
  );
}

function SuccessOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white">
      <Confetti />
      <h2 className="font-serif text-3xl md:text-4xl text-text-primary mb-2 text-center">
        Do what you love.
      </h2>
      <p className="text-neutral-600 mb-8">The rest is handled.</p>
      <a
        href="/signup"
        className="px-10 py-4 bg-sage hover:bg-sage-hover text-white rounded-full font-medium transition-colors"
      >
        Get Started
      </a>
    </div>
  );
}

function Confetti() {
  // Simple CSS-based confetti (or canvas particles)
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full animate-confetti"
          style={{
            left: `${Math.random() * 100}%`,
            backgroundColor: ['#45B37F', '#FFD54F', '#90CAF9', '#F48FB1'][i % 4],
            animationDelay: `${Math.random() * 0.5}s`,
            animationDuration: `${1 + Math.random() * 1}s`,
          }}
        />
      ))}
    </div>
  );
}
```

### 4.2 Add confetti animation to Tailwind

In `apps/web/tailwind.config.ts`, add to `keyframes`:

```typescript
keyframes: {
  confetti: {
    '0%': { transform: 'translateY(-10px) rotate(0deg)', opacity: '1' },
    '100%': { transform: 'translateY(400px) rotate(720deg)', opacity: '0' },
  },
},
animation: {
  confetti: 'confetti 2s ease-out forwards',
},
```

---

## PHASE 5: Focus & Accessibility (~1 hour)

### 5.1 Focus management

```typescript
// Inside MountainDemo component

// Canvas resize
useEffect(() => {
  const canvas = canvasRef.current;
  const container = containerRef.current;
  if (!canvas || !container) return;

  const resize = () => {
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  };

  resize();
  window.addEventListener('resize', resize);
  return () => window.removeEventListener('resize', resize);
}, []);

// Focus capture during play
useEffect(() => {
  const container = containerRef.current;
  if (!container) return;

  const isPlaying = overlay === 'none';

  if (isPlaying) {
    container.setAttribute('tabindex', '-1');
    container.focus({ preventScroll: true });
    setIsFocused(true);
  } else {
    container.removeAttribute('tabindex');
    setIsFocused(false);
  }
}, [overlay]);

// Keyboard input
useEffect(() => {
  const container = containerRef.current;
  if (!container || !isFocused) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      gameRef.current.phase = 'idle';
      setOverlay('idle');
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    if (e.key === ' ' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (gameRef.current.phase === 'diy') {
        inputRef.current.jump = true;
      }
      if (gameRef.current.phase === 'handled') {
        inputRef.current.thrust = true;
      }
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'ArrowUp') {
      inputRef.current.thrust = false;
    }
  };

  container.addEventListener('keydown', handleKeyDown);
  container.addEventListener('keyup', handleKeyUp);

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
    container.removeEventListener('keyup', handleKeyUp);
  };
}, [isFocused]);

// Touch input
useEffect(() => {
  const container = containerRef.current;
  if (!container) return;

  const handleTouchStart = () => {
    if (gameRef.current.phase === 'diy') {
      inputRef.current.jump = true;
    }
    if (gameRef.current.phase === 'handled') {
      inputRef.current.thrust = true;
    }
  };

  const handleTouchEnd = () => {
    inputRef.current.thrust = false;
  };

  container.addEventListener('touchstart', handleTouchStart, { passive: true });
  container.addEventListener('touchend', handleTouchEnd, { passive: true });

  return () => {
    container.removeEventListener('touchstart', handleTouchStart);
    container.removeEventListener('touchend', handleTouchEnd);
  };
}, []);

// Click outside to exit
useEffect(() => {
  if (!isFocused) return;

  const handleClickOutside = (e: MouseEvent) => {
    if (!containerRef.current?.contains(e.target as Node)) {
      gameRef.current.phase = 'idle';
      setOverlay('idle');
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
  };

  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [isFocused]);

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };
}, []);
```

### 5.2 Reduced motion fallback

```typescript
// At the start of the component return
if (prefersReducedMotion.current) {
  return (
    <div className="w-full h-full bg-neutral-50 flex flex-col items-center justify-center gap-6 rounded-2xl p-8">
      <h3 className="font-serif text-2xl md:text-3xl text-text-primary text-center">
        Do what you love.<br />The rest is handled.
      </h3>
      <p className="text-neutral-600 text-center max-w-md">
        We handle the tech, marketing, and backend operations so you can focus on your craft.
      </p>
      <a
        href="/signup"
        className="px-8 py-3 bg-sage hover:bg-sage-hover text-white rounded-full font-medium transition-colors"
      >
        Get Started
      </a>
    </div>
  );
}
```

---

## PHASE 6: Integration (~30 min)

### 6.1 Add to landing page

In `apps/web/src/app/page.tsx`, add after the "shared problem" section:

```tsx
import { LazyMountainDemo } from '@/components/home/LazyMountainDemo';

// Inside the page component, after hero/problem statement:
<section className="py-16 md:py-24 bg-surface">
  <div className="max-w-5xl mx-auto px-6">
    <div className="grid md:grid-cols-2 gap-8 items-center">
      {/* Left: Context */}
      <div>
        <h2 className="font-serif text-3xl md:text-4xl font-bold text-text-primary mb-4">
          Experience the difference
        </h2>
        <p className="text-neutral-600">
          See what it feels like to go from climbing alone to soaring above.
        </p>
      </div>

      {/* Right: Game */}
      <LazyMountainDemo />
    </div>
  </div>
</section>;
```

### 6.2 Test checklist

- [ ] Game loads only when scrolled near (IntersectionObserver)
- [ ] Play button starts DIY mode
- [ ] Space/tap makes player jump in DIY mode
- [ ] Boulders spawn and roll left
- [ ] Collision knocks player back
- [ ] After 3 hits or 16s, fail overlay appears
- [ ] "Get Handled" starts handled mode with jetpack
- [ ] Hold space/touch for thrust, release to glide
- [ ] Player reaches summit in 6-10 seconds
- [ ] Success overlay with "Get Started" CTA
- [ ] Escape key exits to idle
- [ ] Click outside exits to idle
- [ ] Works on mobile (touch)
- [ ] Reduced motion shows static fallback
- [ ] No scroll hijacking at any point
- [ ] 60fps on modern devices

---

## VISUAL STYLE REMINDERS

- **Monochrome world:** Black/white/gray only for player, mountain, boulders
- **Sage accent (#45B37F):** ONLY for jetpack, "Get Handled" button, confetti accents
- **Stick figure:** Simple lines, not cartoon character
- **Labels:** Modern, relatable (SEO, Payments, "Quick question", etc.)
- **Tone:** Calm, knowing, slightly wry, relieving — NOT punishing or gimmicky

---

## ANALYTICS (Optional)

Add tracking calls where appropriate:

```typescript
// Example with generic analytics
const track = (event: string, props?: Record<string, any>) => {
  console.log('[Analytics]', event, props);
  // Replace with your analytics provider
};

track('mountain_demo_viewed');
track('mountain_demo_play_clicked');
track('mountain_demo_diy_failed', { reason: 'timeout', attempts: 1 });
track('mountain_demo_get_handled_clicked');
track('mountain_demo_success');
track('mountain_demo_cta_clicked');
```

---

## DONE CRITERIA

The game is complete when:

1. All 4 phases work (idle → diy → handled → success)
2. DIY feels frustrating but fair (Sisyphean)
3. Handled feels effortless and relieving
4. Sage accent only appears on jetpack/buttons/confetti
5. Focus is properly managed (no scroll hijacking)
6. Works on desktop (keyboard) and mobile (touch)
7. prefers-reduced-motion shows static fallback
8. Integrates cleanly into landing page
9. Zero layout shift, lazy loads correctly
10. ~500 total lines of code across 2 files
