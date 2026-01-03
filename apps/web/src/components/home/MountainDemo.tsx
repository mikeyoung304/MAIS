'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';

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

interface MountainBlock {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface GameState {
  phase: GamePhase;
  player: Player;
  boulders: Boulder[];
  elapsed: number;
  hitCount: number;
  mountainLabels: string[];
  mountainBlocks: MountainBlock[];
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
  'SEO',
  'Website setup',
  'Payments',
  'Scheduling',
  'Tool connections',
  'Domains',
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

// === HELPER FUNCTIONS ===
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createMountainBlocks(): MountainBlock[] {
  return [
    { x: 200, y: GROUND_Y - 30, w: 80, h: 30 },
    { x: 260, y: GROUND_Y - 60, w: 70, h: 30 },
    { x: 310, y: GROUND_Y - 95, w: 75, h: 35 },
    { x: 365, y: GROUND_Y - 130, w: 65, h: 35 },
    { x: 410, y: GROUND_Y - 170, w: 70, h: 40 },
    { x: 460, y: GROUND_Y - 210, w: 80, h: 40 },
  ];
}

function createInitialState(): GameState {
  return {
    phase: 'idle',
    player: { x: 80, y: GROUND_Y, vy: 0 },
    boulders: [],
    elapsed: 0,
    hitCount: 0,
    mountainLabels: shuffle(MOUNTAIN_LABELS).slice(0, 6),
    mountainBlocks: createMountainBlocks(),
  };
}

// === PHYSICS FUNCTIONS ===
function updateDIY(game: GameState, dt: number, input: { jump: boolean; thrust: boolean }): void {
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

function updateHandled(
  game: GameState,
  dt: number,
  input: { jump: boolean; thrust: boolean }
): void {
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

  // Auto-guide if user does nothing (gentle lift after 3 seconds)
  if (game.elapsed > 3000 && player.y > GROUND_Y - 100) {
    player.vy -= 0.3;
  }

  game.elapsed += dt * 1000;
}

function shouldFailDIY(game: GameState): boolean {
  return game.hitCount >= FAIL_HIT_COUNT || game.elapsed > FAIL_TIMEOUT;
}

// === RENDERING FUNCTIONS ===
function drawPlayer(ctx: CanvasRenderingContext2D, player: Player, hasJetpack: boolean): void {
  const { x, y } = player;

  ctx.strokeStyle = '#FAFAFA';
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

function drawMountain(
  ctx: CanvasRenderingContext2D,
  blocks: MountainBlock[],
  labels: string[]
): void {
  blocks.forEach((block, i) => {
    ctx.fillStyle = '#3F3F46'; // zinc-700
    ctx.fillRect(block.x, block.y, block.w, block.h);
    ctx.strokeStyle = '#52525B'; // zinc-600
    ctx.lineWidth = 1;
    ctx.strokeRect(block.x, block.y, block.w, block.h);

    if (labels[i]) {
      ctx.fillStyle = '#A1A1AA'; // zinc-400
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], block.x + block.w / 2, block.y + block.h / 2 + 4, block.w - 8);
    }
  });

  // Success platform
  ctx.fillStyle = '#45B37F';
  ctx.fillRect(520, GROUND_Y - 250, 60, 8);
  ctx.fillStyle = '#FAFAFA';
  ctx.font = 'bold 12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Success', 550, GROUND_Y - 260);
}

function drawBoulder(ctx: CanvasRenderingContext2D, boulder: Boulder): void {
  ctx.fillStyle = '#71717A'; // zinc-500
  ctx.beginPath();
  ctx.arc(boulder.x, boulder.y, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FAFAFA';
  ctx.font = '9px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(boulder.label, boulder.x, boulder.y + 3, 38);
}

function render(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  game: GameState
): void {
  // Clear with dark background
  ctx.fillStyle = '#18181B'; // surface color
  ctx.fillRect(0, 0, width, height);

  // Ground line
  ctx.strokeStyle = '#3F3F46'; // zinc-700
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 30);
  ctx.lineTo(width, GROUND_Y + 30);
  ctx.stroke();

  // Mountain blocks
  drawMountain(ctx, game.mountainBlocks, game.mountainLabels);

  // Boulders
  for (const boulder of game.boulders) {
    drawBoulder(ctx, boulder);
  }

  // Player
  drawPlayer(ctx, game.player, game.phase === 'handled');
}

// === OVERLAY COMPONENTS ===
function IdleOverlay({ onPlay, onSkip }: { onPlay: () => void; onSkip: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/90 backdrop-blur-sm rounded-2xl">
      <p className="text-text-muted text-sm mb-6">Press Space or tap to play</p>
      <div className="flex gap-3">
        <button
          onClick={onPlay}
          className="px-8 py-3 bg-neutral-100 text-neutral-900 rounded-full font-medium hover:bg-white transition-colors"
        >
          Play
        </button>
        <button
          onClick={onSkip}
          className="px-6 py-3 text-text-muted hover:text-text-primary transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

function FailOverlay({
  onGetHandled,
  onKeepTrying,
}: {
  onGetHandled: () => void;
  onKeepTrying: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/95 backdrop-blur-sm rounded-2xl">
      <p className="font-serif text-2xl text-text-primary mb-8 text-center px-6">
        &quot;You don&apos;t have to climb this.&quot;
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
          className="px-6 py-3 text-text-muted hover:text-text-primary transition-colors"
        >
          Keep trying
        </button>
      </div>
    </div>
  );
}

function Confetti() {
  const colors = ['#45B37F', '#FFD54F', '#90CAF9', '#F48FB1'];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full animate-confetti"
          style={{
            left: `${Math.random() * 100}%`,
            backgroundColor: colors[i % colors.length],
            animationDelay: `${Math.random() * 0.5}s`,
            animationDuration: `${1 + Math.random() * 1}s`,
          }}
        />
      ))}
    </div>
  );
}

function SuccessOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface rounded-2xl">
      <Confetti />
      <h2 className="font-serif text-3xl md:text-4xl text-text-primary mb-2 text-center">
        Do what you love.
      </h2>
      <p className="text-text-muted mb-8">The rest is handled.</p>
      <Link
        href="/signup"
        className="px-10 py-4 bg-sage hover:bg-sage-hover text-white rounded-full font-medium transition-colors"
      >
        Get Started
      </Link>
    </div>
  );
}

function ReducedMotionFallback() {
  return (
    <div className="w-full h-full bg-surface flex flex-col items-center justify-center gap-6 rounded-2xl p-8">
      <h3 className="font-serif text-2xl md:text-3xl text-text-primary text-center">
        Do what you love.
        <br />
        The rest is handled.
      </h3>
      <p className="text-text-muted text-center max-w-md">
        We handle the tech, marketing, and backend operations so you can focus on your craft.
      </p>
      <Link
        href="/signup"
        className="px-8 py-3 bg-sage hover:bg-sage-hover text-white rounded-full font-medium transition-colors"
      >
        Get Started
      </Link>
    </div>
  );
}

// === MAIN COMPONENT ===
export default function MountainDemo() {
  // Canvas and container refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Game state (mutable ref to avoid re-renders during gameplay)
  const gameRef = useRef<GameState>(createInitialState());
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const inputRef = useRef({ jump: false, thrust: false });

  // React state ONLY for overlays
  const [overlay, setOverlay] = useState<'idle' | 'fail' | 'success' | 'none'>('idle');
  const [isFocused, setIsFocused] = useState(false);

  // Check reduced motion preference
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Game loop
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
    const dpr = window.devicePixelRatio || 1;
    render(ctx, canvas.width / dpr, canvas.height / dpr, game);

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

  // Start game (DIY mode)
  const startGame = useCallback(() => {
    gameRef.current = createInitialState();
    gameRef.current.phase = 'diy';
    setOverlay('none');
    lastTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop]);

  // Restart DIY mode (keep trying)
  const restartDIY = useCallback(() => {
    gameRef.current = createInitialState();
    gameRef.current.phase = 'diy';
    setOverlay('none');
    lastTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop]);

  // Start handled mode
  const startHandled = useCallback(() => {
    gameRef.current.phase = 'handled';
    gameRef.current.elapsed = 0;
    gameRef.current.boulders = []; // Clear boulders
    setOverlay('none');
    lastTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop]);

  // Skip game
  const handleSkip = useCallback(() => {
    setOverlay('success');
  }, []);

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

      // Render initial state
      if (gameRef.current.phase === 'idle') {
        render(ctx!, rect.width, rect.height, gameRef.current);
      }
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

  // Reduced motion fallback
  if (prefersReducedMotion.current) {
    return <ReducedMotionFallback />;
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-surface outline-none rounded-2xl"
      role="application"
      aria-label="Mountain climbing demonstration game"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full rounded-2xl"
        aria-hidden="true"
      />

      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="polite">
        {overlay === 'success' && 'Congratulations! You reached the summit.'}
      </div>

      {/* Overlays rendered by React */}
      {overlay === 'idle' && <IdleOverlay onPlay={startGame} onSkip={handleSkip} />}
      {overlay === 'fail' && <FailOverlay onGetHandled={startHandled} onKeepTrying={restartDIY} />}
      {overlay === 'success' && <SuccessOverlay />}
    </div>
  );
}
