'use client';

import { useEffect, useRef } from 'react';
import { createPerfProbe } from './perf/probe';
import { SKINS, type AsteroidsSkin, type SkinId } from './asteroids/skins';
import {
  BULLET_SPRITE_C,
  HUD_H,
  bakedBackground,
  bakedBullet,
  bakedOverlay,
  hudLayer,
  particleSquareStylesFor,
  particleStreakStyles,
} from './asteroids/baked';

const PREVENT_DEFAULT_KEYS = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

interface AsteroidsGameProps {
  paused: boolean;
  skin: SkinId;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export default function AsteroidsGame({
  paused,
  skin,
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
}: AsteroidsGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Refs so the game loop always reads the latest prop values without re-running the effect
  const pausedRef = useRef(paused);
  // Read inside the loop so switching skins never restarts the game
  const skinRef = useRef(skin);
  const cbScore = useRef(onScoreChange);
  const cbLives = useRef(onLivesChange);
  const cbLevel = useRef(onLevelChange);
  const cbOver = useRef(onGameOver);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    skinRef.current = skin;
  }, [skin]);
  useEffect(() => {
    cbScore.current = onScoreChange;
  }, [onScoreChange]);
  useEffect(() => {
    cbLives.current = onLivesChange;
  }, [onLivesChange]);
  useEffect(() => {
    cbLevel.current = onLevelChange;
  }, [onLevelChange]);
  useEffect(() => {
    cbOver.current = onGameOver;
  }, [onGameOver]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const W = 800;
    const H = 600;
    const probe = createPerfProbe('asteroids', skinRef.current);

    // ── Skin (visual only; refreshed every frame from skinRef) ──────────────
    let skinId: SkinId = skinRef.current;
    let S: AsteroidsSkin = SKINS[skinId];
    // Per-skin particle colour tables (no string building per frame)
    let streakStyles = particleStreakStyles(skinId);
    let squareStyles = particleSquareStylesFor(skinId);
    // Press Start 2P family injected by next/font on <html>; empty if missing
    const pixelFamily = getComputedStyle(canvas)
      .getPropertyValue('--font-press-start')
      .trim();

    function glow(color: string, c: CanvasRenderingContext2D = ctx) {
      if (!S.glow) return;
      c.shadowBlur = S.glow;
      c.shadowColor = color;
    }

    // ── Input ────────────────────────────────────────────────────────────────
    const keys: Record<string, boolean> = {};
    const justPressed: Record<string, boolean> = {};

    function onKeyDown(e: KeyboardEvent) {
      justPressed[e.code] = !keys[e.code];
      keys[e.code] = true;
      if (PREVENT_DEFAULT_KEYS.has(e.code)) e.preventDefault();
    }
    function onKeyUp(e: KeyboardEvent) {
      keys[e.code] = false;
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    function pressed(code: string) {
      const val = justPressed[code];
      justPressed[code] = false;
      return val;
    }

    // ── Utils ────────────────────────────────────────────────────────────────
    const wrap = (v: number, max: number) => ((v % max) + max) % max;
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);
    const rand = (min: number, max: number) =>
      min + Math.random() * (max - min);
    const randInt = (min: number, max: number) =>
      Math.floor(rand(min, max + 1));

    // ── Bullet ───────────────────────────────────────────────────────────────
    class Bullet {
      x: number;
      y: number;
      vx: number;
      vy: number;
      ttl: number;
      radius: number;
      dead: boolean;
      constructor(x: number, y: number, angle: number) {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.ttl = 0;
        this.radius = 2;
        this.dead = false;
        this.init(x, y, angle);
      }
      // Pooled: a dead bullet is re-initialised instead of allocating a new one
      init(x: number, y: number, angle: number) {
        this.x = x;
        this.y = y;
        const SPEED = 520;
        this.vx = Math.cos(angle) * SPEED;
        this.vy = Math.sin(angle) * SPEED;
        this.ttl = 1.1;
        this.radius = 2;
        this.dead = false;
        return this;
      }
      update(dt: number) {
        this.x = wrap(this.x + this.vx * dt, W);
        this.y = wrap(this.y + this.vy * dt, H);
        this.ttl -= dt;
        if (this.ttl <= 0) this.dead = true;
      }
      draw() {
        if (S.glow && S.bulletShape === 'circle') {
          // Glow pre-rendered once per skin (no shadowBlur per bullet per frame)
          ctx.drawImage(
            bakedBullet(skinId),
            this.x - BULLET_SPRITE_C,
            this.y - BULLET_SPRITE_C,
          );
          return;
        }
        ctx.fillStyle = S.bullet;
        glow(S.bullet);
        if (S.bulletShape === 'square') {
          const s = this.radius * 2;
          ctx.fillRect(
            Math.round(this.x - this.radius),
            Math.round(this.y - this.radius),
            s,
            s,
          );
        } else {
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      }
    }

    // ── Asteroid ─────────────────────────────────────────────────────────────
    const RADII = [0, 16, 30, 50];
    const SPEEDS = [0, 85, 55, 32];
    const POINTS = [0, 100, 50, 20];

    class Asteroid {
      x: number;
      y: number;
      size: number;
      radius: number;
      dead: boolean;
      vx: number;
      vy: number;
      rotSpeed: number;
      rot: number;
      verts: [number, number][];
      constructor(x: number, y: number, size = 3) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.radius = RADII[size];
        this.dead = false;
        const angle = rand(0, Math.PI * 2);
        const speed = SPEEDS[size] + rand(-15, 15);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.rotSpeed = rand(-1.2, 1.2);
        this.rot = rand(0, Math.PI * 2);
        const n = randInt(8, 13);
        this.verts = [];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const r = this.radius * rand(0.6, 1.0);
          this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
      }
      update(dt: number) {
        this.x = wrap(this.x + this.vx * dt, W);
        this.y = wrap(this.y + this.vy * dt, H);
        this.rot += this.rotSpeed * dt;
      }
      // Appends the two children to `out` (no intermediate array)
      splitInto(out: Asteroid[]) {
        if (this.size <= 1) return;
        out.push(
          new Asteroid(this.x, this.y, this.size - 1),
          new Asteroid(this.x, this.y, this.size - 1),
        );
      }
      draw() {
        // Same matrix as translate(x, y) + rotate(rot), without save/restore
        const c = Math.cos(this.rot);
        const s = Math.sin(this.rot);
        ctx.setTransform(c, s, -s, c, this.x, this.y);
        ctx.strokeStyle = S.asteroid;
        ctx.lineWidth = S.lineWidth;
        ctx.lineJoin = S.lineJoin;
        ctx.beginPath();
        ctx.moveTo(this.verts[0][0], this.verts[0][1]);
        for (let i = 1; i < this.verts.length; i++)
          ctx.lineTo(this.verts[i][0], this.verts[i][1]);
        ctx.closePath();
        if (S.asteroidFill) {
          ctx.fillStyle = S.asteroidFill;
          ctx.fill();
        }
        glow(S.asteroid);
        ctx.stroke();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (S.glow) ctx.shadowBlur = 0;
      }
    }

    // ── Ship ─────────────────────────────────────────────────────────────────
    class Ship {
      x!: number;
      y!: number;
      angle!: number;
      vx!: number;
      vy!: number;
      radius!: number;
      thrusting!: boolean;
      invincible!: number;
      shootCooldown!: number;
      dead!: boolean;
      constructor() {
        this.reset();
      }
      reset() {
        this.x = W / 2;
        this.y = H / 2;
        this.angle = -Math.PI / 2;
        this.vx = 0;
        this.vy = 0;
        this.radius = 12;
        this.thrusting = false;
        this.invincible = 3;
        this.shootCooldown = 0;
        this.dead = false;
      }
      update(dt: number) {
        if (this.dead) return;
        if (this.invincible > 0) this.invincible -= dt;
        if (this.shootCooldown > 0) this.shootCooldown -= dt;
        const ROT = 3.5,
          THRUST = 260,
          DRAG = 0.987;
        if (keys['ArrowLeft']) this.angle -= ROT * dt;
        if (keys['ArrowRight']) this.angle += ROT * dt;
        this.thrusting = !!keys['ArrowUp'];
        if (this.thrusting) {
          this.vx += Math.cos(this.angle) * THRUST * dt;
          this.vy += Math.sin(this.angle) * THRUST * dt;
        }
        this.vx *= DRAG;
        this.vy *= DRAG;
        this.x = wrap(this.x + this.vx * dt, W);
        this.y = wrap(this.y + this.vy * dt, H);
      }
      tryShoot(): Bullet | null {
        if (this.shootCooldown > 0 || this.dead) return null;
        this.shootCooldown = 0.2;
        const NOSE = 21;
        const ox = this.x + Math.cos(this.angle) * NOSE;
        const oy = this.y + Math.sin(this.angle) * NOSE;
        const pooled = bulletPool.pop();
        return pooled
          ? pooled.init(ox, oy, this.angle)
          : new Bullet(ox, oy, this.angle);
      }
      draw() {
        if (this.dead) return;
        if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
          return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.strokeStyle = S.ship;
        ctx.lineWidth = S.lineWidth;
        ctx.lineJoin = S.lineJoin;
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(-12, -9);
        ctx.lineTo(-7, 0);
        ctx.lineTo(-12, 9);
        ctx.closePath();
        if (S.shipFill) {
          ctx.fillStyle = S.shipFill;
          ctx.fill();
        }
        glow(S.ship);
        ctx.stroke();
        if (this.thrusting && Math.random() > 0.35) {
          ctx.beginPath();
          ctx.moveTo(-8, -4);
          ctx.lineTo(-8 - rand(6, 14), 0);
          ctx.lineTo(-8, 4);
          ctx.strokeStyle = S.thrust;
          glow(S.thrust);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // ── Particle ─────────────────────────────────────────────────────────────
    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      ttl: number;
      dead: boolean;
      constructor(x: number, y: number) {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.life = 0;
        this.ttl = 0;
        this.dead = false;
        this.init(x, y);
      }
      // Pooled: a dead particle is re-initialised instead of allocating a new one
      init(x: number, y: number) {
        this.x = x;
        this.y = y;
        const angle = rand(0, Math.PI * 2);
        const speed = rand(30, 130);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = rand(0.4, 1.1);
        this.ttl = this.life;
        this.dead = false;
        return this;
      }
      update(dt: number) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.ttl -= dt;
        if (this.ttl <= 0) this.dead = true;
      }
      draw() {
        const alpha = this.ttl / this.life;
        if (S.particleShape === 'square') {
          // 8-bit fade: alpha in four hard steps, 2×2 px dots on the pixel grid
          ctx.fillStyle = squareStyles[Math.ceil(alpha * 4)];
          ctx.fillRect(Math.round(this.x) - 1, Math.round(this.y) - 1, 2, 2);
          return;
        }
        ctx.strokeStyle = streakStyles[Math.round(alpha * 100)];
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
        ctx.stroke();
      }
    }

    // ── Game state ───────────────────────────────────────────────────────────
    let ship: Ship,
      bullets: Bullet[],
      asteroids: Asteroid[],
      particles: Particle[];
    let score: number, lives: number, level: number;
    let state: 'playing' | 'dead' | 'gameover';
    let deadTimer: number;
    let gameOverFired = false;

    // Previous values to avoid spamming callbacks
    let prevScore = -1,
      prevLives = -1,
      prevLevel = -1;

    function spawnAsteroids(count: number) {
      const SAFE_DIST = 130;
      for (let i = 0; i < count; i++) {
        let x: number, y: number;
        do {
          x = rand(0, W);
          y = rand(0, H);
        } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
        asteroids.push(new Asteroid(x, y, 3));
      }
    }

    function initGame() {
      ship = new Ship();
      bullets = [];
      asteroids = [];
      particles = [];
      score = 0;
      lives = 3;
      level = 1;
      state = 'playing';
      gameOverFired = false;
      prevScore = -1;
      prevLives = -1;
      prevLevel = -1;
      spawnAsteroids(4);
    }

    // Pools of dead entities, reused instead of allocating new ones. They are
    // bounded by the max number of simultaneous bullets/particles.
    const bulletPool: Bullet[] = [];
    const particlePool: Particle[] = [];
    // Scratch list for asteroids born from splits during a frame
    const spawned: Asteroid[] = [];

    // In-place, order-preserving removal of dead entities (no new arrays)
    function compact<T extends { dead: boolean }>(list: T[], pool?: T[]) {
      let j = 0;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.dead) pool?.push(e);
        else list[j++] = e;
      }
      list.length = j;
    }

    function releaseAll<T>(list: T[], pool: T[]) {
      for (let i = 0; i < list.length; i++) pool.push(list[i]);
      list.length = 0;
    }

    function nextLevel() {
      level++;
      releaseAll(bullets, bulletPool);
      releaseAll(particles, particlePool);
      ship.reset();
      spawnAsteroids(3 + level);
    }

    function explode(x: number, y: number, count = 8) {
      for (let i = 0; i < count; i++) {
        const pooled = particlePool.pop();
        particles.push(pooled ? pooled.init(x, y) : new Particle(x, y));
      }
    }

    function killShip() {
      explode(ship.x, ship.y, 14);
      ship.dead = true;
      lives--;
      if (lives <= 0) {
        state = 'gameover';
      } else {
        state = 'dead';
        deadTimer = 2;
      }
    }

    // ── Update ───────────────────────────────────────────────────────────────
    function update(dt: number) {
      if (state === 'gameover') {
        for (let i = 0; i < particles.length; i++) particles[i].update(dt);
        compact(particles, particlePool);
        return;
      }

      if (state === 'dead') {
        deadTimer -= dt;
        for (let i = 0; i < particles.length; i++) particles[i].update(dt);
        compact(particles, particlePool);
        for (let i = 0; i < asteroids.length; i++) asteroids[i].update(dt);
        if (deadTimer <= 0) {
          state = 'playing';
          ship.reset();
        }
        return;
      }

      if (pressed('Space')) {
        const shot = ship.tryShoot();
        if (shot) bullets.push(shot);
      }

      ship.update(dt);
      for (let i = 0; i < bullets.length; i++) bullets[i].update(dt);
      for (let i = 0; i < asteroids.length; i++) asteroids[i].update(dt);
      for (let i = 0; i < particles.length; i++) particles[i].update(dt);

      compact(bullets, bulletPool);
      compact(particles, particlePool);

      for (let i = 0; i < bullets.length; i++) {
        const b = bullets[i];
        for (let k = 0; k < asteroids.length; k++) {
          const a = asteroids[k];
          if (!a.dead && !b.dead && dist(b, a) < a.radius) {
            b.dead = true;
            a.dead = true;
            score += POINTS[a.size];
            explode(a.x, a.y, a.size * 5);
            a.splitInto(spawned);
          }
        }
      }
      compact(asteroids);
      for (let i = 0; i < spawned.length; i++) asteroids.push(spawned[i]);
      spawned.length = 0;
      compact(bullets, bulletPool);

      if (ship.invincible <= 0) {
        for (let i = 0; i < asteroids.length; i++) {
          const a = asteroids[i];
          if (dist(ship, a) < ship.radius + a.radius * 0.82) {
            killShip();
            break;
          }
        }
      }

      if (asteroids.length === 0) nextLevel();
    }

    // ── Draw ─────────────────────────────────────────────────────────────────
    function drawLifeIcon(c: CanvasRenderingContext2D, x: number, y: number) {
      c.save();
      c.translate(x, y);
      c.rotate(-Math.PI / 2);
      c.strokeStyle = S.hudText;
      c.lineWidth = S.lifeLineWidth;
      c.lineJoin = S.lineJoin;
      glow(S.hudText, c);
      c.beginPath();
      c.moveTo(9, 0);
      c.lineTo(-6, -5);
      c.lineTo(-3, 0);
      c.lineTo(-6, 5);
      c.closePath();
      c.stroke();
      c.restore();
    }

    function drawHUD(c: CanvasRenderingContext2D) {
      c.fillStyle = S.hudText;
      c.font = S.hudFont(pixelFamily);
      c.textAlign = 'left';
      glow(S.hudText, c);
      c.fillText(`SCORE  ${score}`, 14, 26);
      c.textAlign = 'center';
      c.fillText(`NIVEL ${level}`, W / 2, 26);
      c.shadowBlur = 0;
      for (let i = 0; i < lives; i++) drawLifeIcon(c, W - 16 - i * 22, 18);
    }

    // HUD (text + lives, with glow in neon) baked into a reusable layer that is
    // only redrawn when score, level, lives, skin or font loading change.
    const hud = hudLayer();
    const hudCtx = hud.getContext('2d')!;
    let hudScore = -1,
      hudLevel = -1,
      hudLives = -1,
      hudSkin: SkinId | null = null,
      hudFontsLoaded = false;

    function refreshHUD() {
      // While a web font is loading the fallback is drawn; redraw once it lands
      const fontsLoaded = document.fonts.status === 'loaded';
      if (
        score === hudScore &&
        level === hudLevel &&
        lives === hudLives &&
        skinId === hudSkin &&
        fontsLoaded &&
        hudFontsLoaded
      )
        return;
      hudScore = score;
      hudLevel = level;
      hudLives = lives;
      hudSkin = skinId;
      hudFontsLoaded = fontsLoaded;
      hudCtx.clearRect(0, 0, W, HUD_H);
      drawHUD(hudCtx);
    }

    function draw() {
      if (skinRef.current !== skinId) {
        skinId = skinRef.current;
        streakStyles = particleStreakStyles(skinId);
        squareStyles = particleSquareStylesFor(skinId);
      }
      S = SKINS[skinId];
      if (S.drawBackdrop) {
        ctx.drawImage(bakedBackground(skinId), 0, 0);
      } else {
        ctx.fillStyle = S.bg;
        ctx.fillRect(0, 0, W, H);
      }
      for (let i = 0; i < particles.length; i++) particles[i].draw();
      for (let i = 0; i < asteroids.length; i++) asteroids[i].draw();
      for (let i = 0; i < bullets.length; i++) bullets[i].draw();
      ship.draw();
      refreshHUD();
      ctx.drawImage(hud, 0, 0);
      if (S.drawOverlay) ctx.drawImage(bakedOverlay(skinId), 0, 0);
      // GAME OVER overlay removed — React modal handles it
    }

    // ── Loop ─────────────────────────────────────────────────────────────────
    let rafId: number;
    let lastTime: number | null = null;

    function loop(ts: number) {
      probe.frame(ts);
      const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;

      if (!pausedRef.current) update(dt);
      draw();

      // Notify React of state changes
      if (score !== prevScore) {
        cbScore.current(score);
        prevScore = score;
      }
      if (lives !== prevLives) {
        cbLives.current(lives);
        prevLives = lives;
      }
      if (level !== prevLevel) {
        cbLevel.current(level);
        prevLevel = level;
      }
      if (state === 'gameover' && !gameOverFired) {
        gameOverFired = true;
        cbOver.current(score);
      }

      rafId = requestAnimationFrame(loop);
    }

    initGame();
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
      }}
    />
  );
}
