'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';

// === TYPES ===
type GamePhase = 'idle' | 'diy' | 'handled' | 'success' | 'fail';

interface Player {
  x: number;
  y: number;
  vy: number;
  isGrounded: boolean;
}

interface Platform {
  worldX: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

interface Boulder {
  worldX: number;
  y: number;
  radius: number;
  vx: number; // horizontal rolling speed (negative = toward player)
  vy: number; // vertical speed (positive = downward, affected by gravity)
  label: string;
}

interface GameState {
  phase: GamePhase;
  player: Player;
  platforms: Platform[];
  boulders: Boulder[];
  worldOffset: number;
  successPlatformX: number;
  startTime: number; // when game started (performance.now())
  hitCount: number;
  lastHitTime: number; // for invincibility frames
  lastBoulderSpawn: number; // for spawn timing
  lastInputTime: number; // for auto-guide in Handled mode
}

// === CONSTANTS ===
// Canvas
const DESIGN_WIDTH = 600;
const DESIGN_HEIGHT = 380;
const GROUND_Y = 340;

// Physics - DIY Mode (gentle side-scroll)
const GRAVITY = 0.6;
const JUMP_VELOCITY = -13; // Slightly higher jump to reach platforms
const MAX_FALL_SPEED = 10;
const SCROLL_SPEED = 0.6; // Slow scroll to give time to climb

// Physics - Handled Mode
const THRUST_POWER = -0.5;
const GLIDE_GRAVITY = 0.15;
const HANDLED_SCROLL_SPEED = 2.0;

// Player dimensions
const PLAYER_WIDTH = 24;
const PLAYER_HEIGHT = 45;
const PLAYER_SCREEN_X = 100; // Fixed X position on screen

// Fail conditions
const FAIL_TIMEOUT = 16000; // 16 seconds - per spec (15-18s range)
const MAX_HITS = 3; // 3 boulder hits = fail

// Mountain labels
const MOUNTAIN_LABELS = [
  'SEO',
  'Website setup',
  'Payments',
  'Scheduling',
  'Tool connections',
  'Domains',
  'Automations',
];

// Boulder labels (interruptions / chaos tax)
const BOULDER_LABELS = [
  'Missed texts',
  '"Quick question"',
  'Chasing invoices',
  'Miscommunication',
  '"Did you see my email?"',
  'Last-minute changes',
  'Calendar conflict',
];

// Boulder spawning
const BOULDER_SPAWN_INTERVAL = 4000; // ms between spawns (slower)
const BOULDER_SPEED_MIN = 0.8; // Much slower - rolling, not flying
const BOULDER_SPEED_MAX = 1.2;
const BOULDER_RADIUS = 18;
const INVINCIBILITY_DURATION = 500; // ms of invincibility after hit
const KNOCKBACK_DISTANCE = 60; // pixels pushed back on hit

// Handled mode
const AUTO_GUIDE_DELAY = 2000; // ms of no input before auto-guide kicks in
const AUTO_GUIDE_LIFT = -0.3; // gentle upward thrust

// === HELPER FUNCTIONS ===
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createMountain(): { platforms: Platform[]; successX: number } {
  // Generate 6 ascending platforms forming a climbable staircase
  // Key insight: platforms must be reachable by jumping (not too far apart)
  const platformCount = 6;
  const labels = shuffle(MOUNTAIN_LABELS).slice(0, platformCount);
  const platforms: Platform[] = [];

  // The mountain is a staircase going up and to the right
  // Each step must be jumpable (max jump height ~70px, max horizontal reach ~60px while jumping)
  // IMPORTANT: Start platforms far enough right to give player time to react and jump
  // At SCROLL_SPEED=0.6 and 60fps, player needs ~4 seconds runway = ~144 frames = ~86 world units
  // Player is at screenX=100, so start platform at worldX=400 gives 300px gap = ~8 seconds
  let currentX = 400; // Start platforms well to the right for initial runway
  // CRITICAL: First platform must be HIGH ENOUGH that player must jump to reach it
  // If platform is at ground level, horizontal collision will push player off immediately
  // Player height is 45px, so platform at GROUND_Y - 70 is above player's head when standing
  let currentY = GROUND_Y - 70; // First platform requires a jump to reach

  for (let i = 0; i < platformCount; i++) {
    // Platform dimensions - wider at bottom, narrower at top
    const width = 100 - i * 8; // 100px → 60px as we go up
    const height = 20;

    platforms.push({
      worldX: currentX,
      y: currentY,
      width,
      height,
      label: labels[i],
    });

    // Next platform: go up and slightly right (staircase pattern)
    // Height gain: 45-55px (within jump reach of ~70px)
    const heightGain = 45 + Math.random() * 10;
    currentY -= heightGain;

    // Horizontal spacing: 50-70px (player can reach while jumping)
    const horizontalGap = 50 + Math.random() * 20;
    currentX += horizontalGap;
  }

  // Add success platform at the peak
  const successX = currentX + 60;
  const successY = currentY - 50; // Final jump to summit
  platforms.push({
    worldX: successX,
    y: successY,
    width: 100,
    height: 25,
    label: '', // Success platform has special rendering
  });

  return { platforms, successX };
}

function createInitialState(): GameState {
  const { platforms, successX } = createMountain();
  return {
    phase: 'idle',
    player: {
      x: PLAYER_SCREEN_X,
      y: GROUND_Y - PLAYER_HEIGHT,
      vy: 0,
      isGrounded: true,
    },
    platforms,
    boulders: [],
    worldOffset: 0,
    successPlatformX: successX,
    startTime: 0, // will be set when game starts
    hitCount: 0,
    lastHitTime: 0,
    lastBoulderSpawn: 0,
    lastInputTime: 0,
  };
}

// === BOULDER HELPERS ===
function spawnBoulder(state: GameState): void {
  const label = BOULDER_LABELS[Math.floor(Math.random() * BOULDER_LABELS.length)];
  const speed = BOULDER_SPEED_MIN + Math.random() * (BOULDER_SPEED_MAX - BOULDER_SPEED_MIN);

  // Spawn from the top-right area of the screen (rolling down the mountain)
  // Spawn at varying heights in the upper portion
  const spawnY = 60 + Math.random() * 80; // Top area of canvas (60-140px from top)

  state.boulders.push({
    worldX: state.worldOffset + DESIGN_WIDTH + BOULDER_RADIUS, // Just off-screen right
    y: spawnY,
    radius: BOULDER_RADIUS,
    vx: -speed, // Roll toward player (left)
    vy: 0.3 + Math.random() * 0.3, // Slight downward drift (0.3-0.6)
    label,
  });
}

function checkBoulderCollision(player: Player, boulder: Boulder, worldOffset: number): boolean {
  // Circle-rectangle collision detection
  const boulderScreenX = boulder.worldX - worldOffset;
  const playerCenterX = player.x;

  // Find closest point on player rectangle to boulder center
  const closestX = Math.max(
    playerCenterX - PLAYER_WIDTH / 2,
    Math.min(boulderScreenX, playerCenterX + PLAYER_WIDTH / 2)
  );
  const closestY = Math.max(player.y, Math.min(boulder.y, player.y + PLAYER_HEIGHT));

  // Calculate distance from closest point to boulder center
  const distX = boulderScreenX - closestX;
  const distY = boulder.y - closestY;
  const distance = Math.sqrt(distX * distX + distY * distY);

  return distance < boulder.radius;
}

// === PHYSICS ===
function updateDIY(state: GameState, jumpPressed: boolean, now: number): void {
  const player = state.player;

  // Auto-scroll the world
  state.worldOffset += SCROLL_SPEED;

  // Jump - only when grounded and jump pressed
  if (jumpPressed && player.isGrounded) {
    player.vy = JUMP_VELOCITY;
    player.isGrounded = false;
  }

  // Gravity
  player.vy += GRAVITY;
  player.vy = Math.min(player.vy, MAX_FALL_SPEED);

  // Apply velocity
  player.y += player.vy;

  // Platform collision - both vertical (landing) and horizontal (blocking/pushing)
  player.isGrounded = false;

  const playerLeft = player.x - PLAYER_WIDTH / 2;
  const playerRight = player.x + PLAYER_WIDTH / 2;
  const playerBottom = player.y + PLAYER_HEIGHT;
  // Note: playerTop would be player.y (used for horizontal collision, currently disabled)

  for (const platform of state.platforms) {
    const screenX = platform.worldX - state.worldOffset;
    const platformRight = screenX + platform.width;
    const platformTop = platform.y;
    // Note: platformBottom would be platform.y + platform.height (used for horizontal collision, currently disabled)

    // Skip if platform is off-screen
    if (screenX < -platform.width - 50 || screenX > DESIGN_WIDTH + 50) continue;

    // HORIZONTAL COLLISION TEMPORARILY DISABLED
    // The push mechanic was causing instant fails. Need to redesign.
    // For now, platforms pass through player - gameplay is just:
    // - Jump to reach platforms
    // - Avoid boulders
    // - Reach success platform before timeout
    //
    // TODO: Re-enable horizontal collision with better game design:
    // - Maybe platforms should be solid walls that block, not push
    // - Or make it a pure vertical climbing game (no horizontal push)

    // Check VERTICAL collision (landing on top of platform)
    if (player.vy > 0) {
      const prevBottom = playerBottom - player.vy;

      // Check if player's feet crossed the platform top this frame
      if (
        playerRight > screenX &&
        playerLeft < platformRight &&
        playerBottom >= platformTop &&
        prevBottom <= platformTop + 10 // Small tolerance
      ) {
        player.y = platformTop - PLAYER_HEIGHT;
        player.vy = 0;
        player.isGrounded = true;
        // Don't break - check other platforms too
      }
    }
  }

  // Ground collision
  if (player.y + PLAYER_HEIGHT >= GROUND_Y) {
    player.y = GROUND_Y - PLAYER_HEIGHT;
    player.vy = 0;
    player.isGrounded = true;
  }

  // OFF-SCREEN FAIL DISABLED (push mechanic disabled)
  // if (player.x < -PLAYER_WIDTH) {
  //   state.phase = 'fail';
  //   return;
  // }

  // === BOULDER SPAWNING ===
  if (now - state.lastBoulderSpawn > BOULDER_SPAWN_INTERVAL) {
    spawnBoulder(state);
    state.lastBoulderSpawn = now;
  }

  // === BOULDER UPDATES ===
  for (const boulder of state.boulders) {
    boulder.worldX += boulder.vx; // Roll toward player (left)
    boulder.y += boulder.vy; // Roll downward

    // Stop at ground level
    if (boulder.y > GROUND_Y - boulder.radius) {
      boulder.y = GROUND_Y - boulder.radius;
      boulder.vy = 0;
    }
  }

  // Remove boulders that are off-screen left or below ground for too long
  state.boulders = state.boulders.filter((b) => b.worldX - state.worldOffset > -BOULDER_RADIUS * 2);

  // === BOULDER COLLISION ===
  const isInvincible = now - state.lastHitTime < INVINCIBILITY_DURATION;

  if (!isInvincible) {
    for (const boulder of state.boulders) {
      if (checkBoulderCollision(player, boulder, state.worldOffset)) {
        // Hit! Apply knockback
        state.worldOffset -= KNOCKBACK_DISTANCE; // Push world back (player appears to move back)
        state.worldOffset = Math.max(0, state.worldOffset); // Don't go negative
        state.hitCount++;
        state.lastHitTime = now;
        break; // Only one hit per frame
      }
    }
  }
}

function updateHandled(state: GameState, thrustPressed: boolean, now: number): void {
  const player = state.player;

  // Faster auto-scroll in handled mode
  state.worldOffset += HANDLED_SCROLL_SPEED;

  // Track input for auto-guide
  if (thrustPressed) {
    state.lastInputTime = now;
  }

  // Auto-guide: if no input for 2+ seconds, gently rise
  const timeSinceInput = now - state.lastInputTime;
  const autoGuideActive = timeSinceInput > AUTO_GUIDE_DELAY;

  // Thrust, glide, or auto-guide
  if (thrustPressed) {
    player.vy += THRUST_POWER;
    player.vy = Math.max(player.vy, -8); // Cap upward speed
  } else if (autoGuideActive) {
    // Gentle auto-guide upward
    player.vy += AUTO_GUIDE_LIFT;
    player.vy = Math.max(player.vy, -4); // Slower than manual thrust
  } else {
    player.vy += GLIDE_GRAVITY;
  }

  player.vy = Math.min(player.vy, MAX_FALL_SPEED);
  player.y += player.vy;

  // Boundaries
  player.y = Math.max(30, Math.min(GROUND_Y - PLAYER_HEIGHT, player.y));
  player.isGrounded = false;

  // === BOULDER UPDATES (continue in Handled mode - chaos goes on!) ===
  // Spawn boulders at same rate
  if (now - state.lastBoulderSpawn > BOULDER_SPAWN_INTERVAL) {
    spawnBoulder(state);
    state.lastBoulderSpawn = now;
  }

  // Update boulder positions
  for (const boulder of state.boulders) {
    boulder.worldX += boulder.vx;
    boulder.y += boulder.vy;

    // Stop at ground level
    if (boulder.y > GROUND_Y - boulder.radius) {
      boulder.y = GROUND_Y - boulder.radius;
      boulder.vy = 0;
    }
  }

  // Remove off-screen boulders
  state.boulders = state.boulders.filter((b) => b.worldX - state.worldOffset > -BOULDER_RADIUS * 2);
  // Note: No collision check - player flies above them!
}

// === RENDERING ===
function drawPlayer(ctx: CanvasRenderingContext2D, player: Player, hasJetpack: boolean): void {
  const x = player.x;
  const y = player.y + PLAYER_HEIGHT; // y is top, we draw from bottom

  ctx.strokeStyle = '#FAFAFA';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  // Head
  ctx.beginPath();
  ctx.arc(x, y - 38, 8, 0, Math.PI * 2);
  ctx.stroke();

  // Body
  ctx.beginPath();
  ctx.moveTo(x, y - 30);
  ctx.lineTo(x, y - 12);
  ctx.stroke();

  // Arms
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 25);
  ctx.lineTo(x + 10, y - 25);
  ctx.stroke();

  // Legs
  ctx.beginPath();
  ctx.moveTo(x, y - 12);
  ctx.lineTo(x - 7, y);
  ctx.moveTo(x, y - 12);
  ctx.lineTo(x + 7, y);
  ctx.stroke();

  // Lightbulb (idea) - always present
  ctx.fillStyle = '#FFD54F';
  ctx.beginPath();
  ctx.arc(x + 12, y - 50, 5, 0, Math.PI * 2);
  ctx.fill();

  // Jetpack (handled mode only)
  if (hasJetpack) {
    // Jetpack body
    ctx.fillStyle = '#45B37F';
    ctx.beginPath();
    ctx.roundRect(x - 16, y - 28, 7, 18, 2);
    ctx.fill();

    // Thrust glow
    const gradient = ctx.createRadialGradient(x - 12, y - 5, 0, x - 12, y - 5, 20);
    gradient.addColorStop(0, 'rgba(69, 179, 127, 0.5)');
    gradient.addColorStop(1, 'rgba(69, 179, 127, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x - 12, y - 5, 20, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBoulder(ctx: CanvasRenderingContext2D, boulder: Boulder, screenX: number): void {
  // Gray boulder circle
  ctx.fillStyle = '#52525B';
  ctx.beginPath();
  ctx.arc(screenX, boulder.y, boulder.radius, 0, Math.PI * 2);
  ctx.fill();

  // Darker outline
  ctx.strokeStyle = '#3F3F46';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Label text (white, centered)
  ctx.fillStyle = '#FAFAFA';
  ctx.font = 'bold 9px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(boulder.label, screenX, boulder.y, boulder.radius * 1.8);
  ctx.textBaseline = 'alphabetic'; // Reset for other text
}

function drawPlatform(
  ctx: CanvasRenderingContext2D,
  platform: Platform,
  screenX: number,
  isSuccess: boolean
): void {
  if (isSuccess) {
    // Success platform - sage green
    ctx.fillStyle = '#45B37F';
    ctx.fillRect(screenX, platform.y, platform.width, platform.height);
    ctx.fillStyle = '#FAFAFA';
    ctx.font = 'bold 13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SUCCESS', screenX + platform.width / 2, platform.y - 8);
  } else {
    // Regular platform - gray blocks
    ctx.fillStyle = '#3F3F46';
    ctx.fillRect(screenX, platform.y, platform.width, platform.height);
    ctx.strokeStyle = '#52525B';
    ctx.lineWidth = 1;
    ctx.strokeRect(screenX, platform.y, platform.width, platform.height);

    // Label
    if (platform.label) {
      ctx.fillStyle = '#A1A1AA';
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        platform.label,
        screenX + platform.width / 2,
        platform.y + platform.height / 2 + 3,
        platform.width - 8
      );
    }
  }
}

function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  // Clear
  ctx.fillStyle = '#18181B';
  ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

  // Ground line
  ctx.strokeStyle = '#3F3F46';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(DESIGN_WIDTH, GROUND_Y);
  ctx.stroke();

  // Draw platforms
  const lastIndex = state.platforms.length - 1;
  for (let i = 0; i < state.platforms.length; i++) {
    const platform = state.platforms[i];
    const screenX = platform.worldX - state.worldOffset;

    // Only draw if on screen
    if (screenX > -platform.width && screenX < DESIGN_WIDTH + 50) {
      drawPlatform(ctx, platform, screenX, i === lastIndex);
    }
  }

  // Draw boulders
  for (const boulder of state.boulders) {
    const screenX = boulder.worldX - state.worldOffset;
    // Only draw if on screen
    if (screenX > -boulder.radius && screenX < DESIGN_WIDTH + boulder.radius) {
      drawBoulder(ctx, boulder, screenX);
    }
  }

  // Draw player (on top of everything)
  drawPlayer(ctx, state.player, state.phase === 'handled');

  // Progress indicator (subtle)
  const progress = state.worldOffset / (state.successPlatformX - 200);
  ctx.fillStyle = '#3F3F46';
  ctx.fillRect(20, 20, 100, 4);
  ctx.fillStyle = '#45B37F';
  ctx.fillRect(20, 20, Math.min(progress, 1) * 100, 4);

  // Hit counter (only in DIY mode)
  if (state.phase === 'diy' && state.hitCount > 0) {
    ctx.fillStyle = '#EF4444'; // Red for damage
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Hits: ${state.hitCount}/${MAX_HITS}`, DESIGN_WIDTH - 20, 28);
  }
}

// === OVERLAYS ===
function IdleOverlay({ onPlay, onSkip }: { onPlay: () => void; onSkip: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl">
      <div className="bg-surface/80 backdrop-blur-sm px-8 py-6 rounded-2xl">
        <p className="text-text-muted text-sm mb-4 text-center">Press Space or tap to play</p>
        <div className="flex gap-3 justify-center">
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
    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl">
      <div className="bg-surface/90 backdrop-blur-sm px-8 py-6 rounded-2xl text-center">
        <p className="font-serif text-xl text-text-primary mb-6">
          &quot;You don&apos;t have to climb this.&quot;
        </p>
        <div className="flex gap-3 justify-center">
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
    </div>
  );
}

function SuccessOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface rounded-2xl">
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Game state (mutable ref - no React re-renders during gameplay)
  const gameRef = useRef<GameState>(createInitialState());
  const animationRef = useRef<number | null>(null);
  const inputRef = useRef({ jump: false, thrust: false });

  // Canvas scaling (stored for consistent rendering)
  const scaleRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });

  // React state ONLY for overlays
  const [overlay, setOverlay] = useState<'idle' | 'fail' | 'success' | 'none'>('idle');
  const [isFocused, setIsFocused] = useState(false);

  // Reduced motion preference
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Game loop
  const gameLoop = useCallback(() => {
    const game = gameRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = performance.now();

    // Update based on phase
    if (game.phase === 'diy') {
      // Calculate elapsed time from start
      const elapsed = now - game.startTime;

      updateDIY(game, inputRef.current.jump, now);
      inputRef.current.jump = false; // Consume jump input

      // Check fail: timeout without reaching success
      if (elapsed > FAIL_TIMEOUT) {
        game.phase = 'fail';
        setOverlay('fail');
        return;
      }

      // Check fail: too many boulder hits
      if (game.hitCount >= MAX_HITS) {
        game.phase = 'fail';
        setOverlay('fail');
        return;
      }

      // Note: Off-screen fail check removed - horizontal collision disabled
      // Re-enable when collision mechanic is fixed

      // Check win: player is standing on the success platform
      const successPlatform = game.platforms[game.platforms.length - 1];
      const successScreenX = successPlatform.worldX - game.worldOffset;
      const playerOnSuccess =
        game.player.isGrounded &&
        game.player.x > successScreenX &&
        game.player.x < successScreenX + successPlatform.width &&
        Math.abs(game.player.y + PLAYER_HEIGHT - successPlatform.y) < 5;
      if (playerOnSuccess) {
        game.phase = 'success';
        setOverlay('success');
        return;
      }
    } else if (game.phase === 'handled') {
      updateHandled(game, inputRef.current.thrust, now);

      // Check win in handled mode
      const successScreenX = game.successPlatformX - game.worldOffset;
      if (successScreenX < PLAYER_SCREEN_X + 50) {
        game.phase = 'success';
        setOverlay('success');
        return;
      }
    }

    // Render with proper scaling
    const dpr = window.devicePixelRatio || 1;
    const { scale, offsetX, offsetY } = scaleRef.current;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    render(ctx, game);
    ctx.restore();

    // Continue loop
    if (game.phase === 'diy' || game.phase === 'handled') {
      animationRef.current = requestAnimationFrame(gameLoop);
    }
  }, []);

  // Start or restart DIY mode
  const startDIYMode = useCallback(() => {
    // Cancel any existing animation frame to prevent multiple loops
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    gameRef.current = createInitialState();
    gameRef.current.phase = 'diy';
    gameRef.current.startTime = performance.now(); // Start timer
    setOverlay('none');
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop]);

  // Start handled mode
  const startHandled = useCallback(() => {
    // Cancel any existing animation frame to prevent multiple loops
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    // Keep current world offset but switch to handled physics
    gameRef.current.phase = 'handled';
    gameRef.current.player.vy = 0;
    gameRef.current.lastInputTime = performance.now(); // Reset for auto-guide
    setOverlay('none');
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop]);

  // Skip
  const handleSkip = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setOverlay('success');
  }, []);

  // Canvas setup
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

      // Calculate and store scale values for consistent rendering
      const scaleX = rect.width / DESIGN_WIDTH;
      const scaleY = rect.height / DESIGN_HEIGHT;
      const scale = Math.min(scaleX, scaleY);
      const offsetX = (rect.width - DESIGN_WIDTH * scale) / 2;
      const offsetY = (rect.height - DESIGN_HEIGHT * scale) / 2;

      // Store for game loop to use
      scaleRef.current = { scale, offsetX, offsetY };

      // Initial render
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        render(ctx, gameRef.current);
        ctx.restore();
      }
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Focus management
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (overlay === 'none') {
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
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        gameRef.current.phase = 'idle';
        setOverlay('idle');
        return;
      }

      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        inputRef.current.jump = true;
        inputRef.current.thrust = true;
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

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      inputRef.current.jump = true;
      inputRef.current.thrust = true;
    };

    const handleTouchEnd = () => {
      inputRef.current.thrust = false;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

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

      <div className="sr-only" aria-live="polite">
        {overlay === 'success' && 'Congratulations! You reached the summit.'}
      </div>

      {overlay === 'idle' && <IdleOverlay onPlay={startDIYMode} onSkip={handleSkip} />}
      {overlay === 'fail' && (
        <FailOverlay onGetHandled={startHandled} onKeepTrying={startDIYMode} />
      )}
      {overlay === 'success' && <SuccessOverlay />}
    </div>
  );
}
