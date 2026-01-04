'use client';

import { useEffect, useRef, useCallback } from 'react';

// === TYPES ===
type GamePhase = 'playing' | 'success' | 'fail';

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
  vx: number;
  vy: number;
  label: string;
}

interface GameState {
  phase: GamePhase;
  player: Player;
  platforms: Platform[];
  boulders: Boulder[];
  worldOffset: number;
  successPlatformX: number;
  startTime: number;
  hitCount: number;
  lastHitTime: number;
  lastBoulderSpawn: number;
}

// === CONSTANTS ===
const DESIGN_WIDTH = 800;
const DESIGN_HEIGHT = 500;
const GROUND_Y = 450;

// Physics
const GRAVITY = 0.6;
const JUMP_VELOCITY = -14;
const MAX_FALL_SPEED = 10;
const SCROLL_SPEED = 1.0;

// Player dimensions
const PLAYER_WIDTH = 24;
const PLAYER_HEIGHT = 45;
const PLAYER_SCREEN_X = 150;

// Fail conditions
const FAIL_TIMEOUT = 20000; // 20 seconds
const MAX_HITS = 3;

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

// Boulder labels
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
const BOULDER_SPAWN_INTERVAL = 3000;
const BOULDER_SPEED_MIN = 1.5;
const BOULDER_SPEED_MAX = 2.5;
const BOULDER_RADIUS = 20;
const INVINCIBILITY_DURATION = 500;
const KNOCKBACK_DISTANCE = 40;

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
  const platformCount = 6;
  const labels = shuffle(MOUNTAIN_LABELS).slice(0, platformCount);
  const platforms: Platform[] = [];

  // Start platforms far right to give player time
  let currentX = 500;
  let currentY = GROUND_Y - 80; // First platform above player

  for (let i = 0; i < platformCount; i++) {
    const width = 120 - i * 10;
    const height = 20;

    platforms.push({
      worldX: currentX,
      y: currentY,
      width,
      height,
      label: labels[i],
    });

    // Staircase up and right
    const heightGain = 50 + Math.random() * 15;
    currentY -= heightGain;

    const horizontalGap = 80 + Math.random() * 30;
    currentX += horizontalGap;
  }

  // Success platform at the peak
  const successX = currentX + 80;
  const successY = currentY - 60;
  platforms.push({
    worldX: successX,
    y: successY,
    width: 120,
    height: 25,
    label: '',
  });

  return { platforms, successX };
}

function createInitialState(): GameState {
  const { platforms, successX } = createMountain();
  return {
    phase: 'playing',
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
    startTime: performance.now(),
    hitCount: 0,
    lastHitTime: 0,
    lastBoulderSpawn: 0,
  };
}

// === BOULDER HELPERS ===
function spawnBoulder(state: GameState): void {
  const label = BOULDER_LABELS[Math.floor(Math.random() * BOULDER_LABELS.length)];
  const speed = BOULDER_SPEED_MIN + Math.random() * (BOULDER_SPEED_MAX - BOULDER_SPEED_MIN);
  const spawnY = 80 + Math.random() * 100;

  state.boulders.push({
    worldX: state.worldOffset + DESIGN_WIDTH + BOULDER_RADIUS,
    y: spawnY,
    radius: BOULDER_RADIUS,
    vx: -speed,
    vy: 0.4 + Math.random() * 0.3,
    label,
  });
}

function checkBoulderCollision(player: Player, boulder: Boulder, worldOffset: number): boolean {
  const boulderScreenX = boulder.worldX - worldOffset;
  const playerCenterX = player.x;

  const closestX = Math.max(
    playerCenterX - PLAYER_WIDTH / 2,
    Math.min(boulderScreenX, playerCenterX + PLAYER_WIDTH / 2)
  );
  const closestY = Math.max(player.y, Math.min(boulder.y, player.y + PLAYER_HEIGHT));

  const distX = boulderScreenX - closestX;
  const distY = boulder.y - closestY;
  const distance = Math.sqrt(distX * distX + distY * distY);

  return distance < boulder.radius;
}

// === PHYSICS ===
function updateGame(state: GameState, jumpPressed: boolean, now: number): void {
  const player = state.player;

  // Auto-scroll the world
  state.worldOffset += SCROLL_SPEED;

  // Jump
  if (jumpPressed && player.isGrounded) {
    player.vy = JUMP_VELOCITY;
    player.isGrounded = false;
  }

  // Gravity
  player.vy += GRAVITY;
  player.vy = Math.min(player.vy, MAX_FALL_SPEED);
  player.y += player.vy;

  // Platform collision
  player.isGrounded = false;

  const playerLeft = player.x - PLAYER_WIDTH / 2;
  const playerRight = player.x + PLAYER_WIDTH / 2;
  const playerBottom = player.y + PLAYER_HEIGHT;

  for (const platform of state.platforms) {
    const screenX = platform.worldX - state.worldOffset;
    const platformRight = screenX + platform.width;
    const platformTop = platform.y;

    if (screenX < -platform.width - 50 || screenX > DESIGN_WIDTH + 50) continue;

    // Vertical collision (landing)
    if (player.vy > 0) {
      const prevBottom = playerBottom - player.vy;

      if (
        playerRight > screenX &&
        playerLeft < platformRight &&
        playerBottom >= platformTop &&
        prevBottom <= platformTop + 10
      ) {
        player.y = platformTop - PLAYER_HEIGHT;
        player.vy = 0;
        player.isGrounded = true;
      }
    }
  }

  // Ground collision
  if (player.y + PLAYER_HEIGHT >= GROUND_Y) {
    player.y = GROUND_Y - PLAYER_HEIGHT;
    player.vy = 0;
    player.isGrounded = true;
  }

  // Boulder spawning
  if (now - state.lastBoulderSpawn > BOULDER_SPAWN_INTERVAL) {
    spawnBoulder(state);
    state.lastBoulderSpawn = now;
  }

  // Boulder updates
  for (const boulder of state.boulders) {
    boulder.worldX += boulder.vx;
    boulder.y += boulder.vy;

    if (boulder.y > GROUND_Y - boulder.radius) {
      boulder.y = GROUND_Y - boulder.radius;
      boulder.vy = 0;
    }
  }

  // Remove off-screen boulders
  state.boulders = state.boulders.filter((b) => b.worldX - state.worldOffset > -BOULDER_RADIUS * 2);

  // Boulder collision
  const isInvincible = now - state.lastHitTime < INVINCIBILITY_DURATION;
  if (!isInvincible) {
    for (const boulder of state.boulders) {
      if (checkBoulderCollision(player, boulder, state.worldOffset)) {
        state.worldOffset -= KNOCKBACK_DISTANCE;
        state.worldOffset = Math.max(0, state.worldOffset);
        state.hitCount++;
        state.lastHitTime = now;
        break;
      }
    }
  }

  // Check fail: hits
  if (state.hitCount >= MAX_HITS) {
    state.phase = 'fail';
    return;
  }

  // Check fail: timeout
  if (now - state.startTime > FAIL_TIMEOUT) {
    state.phase = 'fail';
    return;
  }

  // Check win
  const successPlatform = state.platforms[state.platforms.length - 1];
  const successScreenX = successPlatform.worldX - state.worldOffset;
  const playerOnSuccess =
    player.isGrounded &&
    player.x > successScreenX &&
    player.x < successScreenX + successPlatform.width &&
    Math.abs(player.y + PLAYER_HEIGHT - successPlatform.y) < 5;
  if (playerOnSuccess) {
    state.phase = 'success';
  }
}

// === RENDERING ===
function drawPlayer(ctx: CanvasRenderingContext2D, player: Player): void {
  const x = player.x;
  const y = player.y + PLAYER_HEIGHT;

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

  // Lightbulb
  ctx.fillStyle = '#FFD54F';
  ctx.beginPath();
  ctx.arc(x + 12, y - 50, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawBoulder(ctx: CanvasRenderingContext2D, boulder: Boulder, screenX: number): void {
  ctx.fillStyle = '#52525B';
  ctx.beginPath();
  ctx.arc(screenX, boulder.y, boulder.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#3F3F46';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#FAFAFA';
  ctx.font = 'bold 10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(boulder.label, screenX, boulder.y, boulder.radius * 1.8);
}

function drawPlatform(
  ctx: CanvasRenderingContext2D,
  platform: Platform,
  screenX: number,
  isSuccess: boolean
): void {
  if (isSuccess) {
    ctx.fillStyle = '#45B37F';
    ctx.fillRect(screenX, platform.y, platform.width, platform.height);
    ctx.fillStyle = '#FAFAFA';
    ctx.font = 'bold 14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SUCCESS', screenX + platform.width / 2, platform.y - 10);
  } else {
    ctx.fillStyle = '#3F3F46';
    ctx.fillRect(screenX, platform.y, platform.width, platform.height);
    ctx.strokeStyle = '#52525B';
    ctx.lineWidth = 1;
    ctx.strokeRect(screenX, platform.y, platform.width, platform.height);

    if (platform.label) {
      ctx.fillStyle = '#A1A1AA';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        platform.label,
        screenX + platform.width / 2,
        platform.y + platform.height / 2 + 4,
        platform.width - 10
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

  // Platforms
  const lastIndex = state.platforms.length - 1;
  for (let i = 0; i < state.platforms.length; i++) {
    const platform = state.platforms[i];
    const screenX = platform.worldX - state.worldOffset;
    if (screenX > -platform.width && screenX < DESIGN_WIDTH + 50) {
      drawPlatform(ctx, platform, screenX, i === lastIndex);
    }
  }

  // Boulders
  for (const boulder of state.boulders) {
    const screenX = boulder.worldX - state.worldOffset;
    if (screenX > -boulder.radius && screenX < DESIGN_WIDTH + boulder.radius) {
      drawBoulder(ctx, boulder, screenX);
    }
  }

  // Player
  drawPlayer(ctx, state.player);

  // Progress bar
  const progress = state.worldOffset / (state.successPlatformX - 300);
  ctx.fillStyle = '#3F3F46';
  ctx.fillRect(20, 20, 150, 6);
  ctx.fillStyle = '#45B37F';
  ctx.fillRect(20, 20, Math.min(progress, 1) * 150, 6);

  // Hit counter
  if (state.hitCount > 0) {
    ctx.fillStyle = '#EF4444';
    ctx.font = '14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Hits: ${state.hitCount}/${MAX_HITS}`, DESIGN_WIDTH - 20, 30);
  }

  // Timer
  const elapsed = Math.floor((performance.now() - state.startTime) / 1000);
  const remaining = Math.max(0, Math.floor(FAIL_TIMEOUT / 1000) - elapsed);
  ctx.fillStyle = remaining < 5 ? '#EF4444' : '#A1A1AA';
  ctx.font = '14px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Time: ${remaining}s`, 20, 50);

  // Game over text
  if (state.phase === 'fail') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    ctx.fillStyle = '#FAFAFA';
    ctx.font = 'bold 32px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2 - 20);
    ctx.font = '16px Inter, system-ui, sans-serif';
    ctx.fillText('Press Space to restart', DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2 + 20);
  }

  if (state.phase === 'success') {
    ctx.fillStyle = 'rgba(69, 179, 127, 0.3)';
    ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    ctx.fillStyle = '#FAFAFA';
    ctx.font = 'bold 32px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SUCCESS!', DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2 - 20);
    ctx.font = '16px Inter, system-ui, sans-serif';
    ctx.fillText('Press Space to play again', DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2 + 20);
  }
}

// === MAIN COMPONENT ===
export default function GameTestPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState>(createInitialState());
  const animationRef = useRef<number | null>(null);
  const inputRef = useRef({ jump: false });

  const gameLoop = useCallback(() => {
    const game = gameRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = performance.now();

    if (game.phase === 'playing') {
      updateGame(game, inputRef.current.jump, now);
      inputRef.current.jump = false;
    }

    render(ctx, game);
    animationRef.current = requestAnimationFrame(gameLoop);
  }, []);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = DESIGN_WIDTH;
    canvas.height = DESIGN_HEIGHT;

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [gameLoop]);

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();

        // Restart if game over
        if (gameRef.current.phase !== 'playing') {
          gameRef.current = createInitialState();
          return;
        }

        inputRef.current.jump = true;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-white text-xl font-bold">Mountain Demo - Test Page</h1>
        <p className="text-gray-400 text-sm">Space/Up = Jump | Reach the SUCCESS platform</p>
        <canvas
          ref={canvasRef}
          className="border border-gray-700 rounded-lg"
          style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}
        />
        <p className="text-gray-500 text-xs">
          Avoid boulders (3 hits = fail) | Reach summit before timeout
        </p>
      </div>
    </div>
  );
}
