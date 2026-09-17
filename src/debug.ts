import type { Application } from 'pixi.js';
import type { Layout } from './engine/layout';
import type { FrameStats } from './engine/ticker';
import type { HoldController } from './ritual/hold';
import { moonAge, moonFrame, type MoonFrame } from './ritual/moonPhase';
import type { Scene } from './scene/scene';

export type DebugOptions = {
  /** Fixed clock (from ?date=YYYY-MM-DD), else the real clock. */
  now: () => Date;
  /** Forced moon frame (from ?phase=0..7). */
  forcedFrame: MoonFrame | null;
  seed: number;
  showFps: boolean;
  /** ?lanterns=N: spawn N lit lanterns already rising (perf test). */
  risingLanterns: number;
  /** ?sky=N: seed N past lanterns in the sky (legibility test). */
  skyLights: number;
  /** ?motion=gentle|full overrides the system setting. */
  motion: 'gentle' | 'full' | null;
};

export function readDebugOptions(search: string): DebugOptions {
  const params = new URLSearchParams(search);
  const date = params.get('date');
  const fixed = date ? new Date(`${date}T21:00:00Z`) : null;
  const phase = params.get('phase');
  const forced = phase !== null && /^[0-7]$/.test(phase) ? (Number(phase) as MoonFrame) : null;
  const seedParam = params.get('seed');
  const count = (key: string, max: number): number => Math.max(0, Math.min(max, Number(params.get(key) ?? 0) || 0));
  const motion = params.get('motion');
  return {
    now: fixed && !Number.isNaN(fixed.getTime()) ? () => fixed : () => new Date(),
    forcedFrame: forced,
    seed: seedParam ? Number(seedParam) >>> 0 : 7,
    showFps: params.has('debug'),
    risingLanterns: count('lanterns', 12),
    skyLights: count('sky', 1000),
    motion: motion === 'gentle' || motion === 'full' ? motion : null,
  };
}

export function frameForNow(opts: DebugOptions): MoonFrame {
  return opts.forcedFrame ?? moonFrame(moonAge(opts.now()));
}

export type LanternDebug = {
  layout: Layout;
  stats: () => { fps: number; avgMs: number; p95Ms: number; frames: number; cpuAvgMs: number; cpuP95Ms: number };
  resetStats: () => void;
  moonFrame: () => MoonFrame;
  /** Read a pixel from the composed art-px world as a hex number (or -1 if transparent). */
  samplePixel: (x: number, y: number) => number;
  /** Read a rectangle of the composed world as hex numbers, row-major (-1 for transparent). */
  sampleRect: (x: number, y: number, w: number, h: number) => number[];
  /** Active lanterns: phase, fill, art-px centre and rise progress. */
  lanterns: () => { phase: string; fill: number; x: number; y: number; p: number }[];
  skyLights: () => number;
  /** Hold state machine. */
  hold: () => { state: string; fill: number };
  /** Light the waiting lantern instantly. */
  light: () => void;
  /** Release the lit lantern (as the button would). */
  release: () => void;
  /** Time multiplier for the scene (not for input). */
  speed: (x: number) => void;
  /** The live scene, for manual inspection in dev. */
  scene: Scene;
  ready: boolean;
};

declare global {
  interface Window {
    __lantern?: LanternDebug;
  }
}

export function installDebug(
  app: Application,
  scene: Scene,
  hold: HoldController,
  stats: FrameStats,
  cpu: FrameStats,
  getLayout: () => Layout,
): void {
  const readPixel = (p: Uint8ClampedArray | Uint8Array, w: number, x: number, y: number): number => {
    const i = (Math.floor(y) * w + Math.floor(x)) * 4;
    if ((p[i + 3] ?? 0) === 0) return -1;
    return ((p[i] ?? 0) << 16) | ((p[i + 1] ?? 0) << 8) | (p[i + 2] ?? 0);
  };
  window.__lantern = {
    get layout() {
      return getLayout();
    },
    stats: () => ({
      fps: stats.fps,
      avgMs: stats.avgMs,
      p95Ms: stats.p95Ms,
      frames: stats.frames,
      cpuAvgMs: cpu.avgMs,
      cpuP95Ms: cpu.p95Ms,
    }),
    resetStats: () => {
      stats.reset();
      cpu.reset();
    },
    moonFrame: () => scene.moon.currentFrame,
    samplePixel: (x, y) => {
      const out = app.renderer.extract.pixels(scene.pipeline.worldRT);
      return readPixel(out.pixels, out.width, x, y);
    },
    sampleRect: (x, y, w, h) => {
      const out = app.renderer.extract.pixels(scene.pipeline.worldRT);
      const result: number[] = [];
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) result.push(readPixel(out.pixels, out.width, xx, yy));
      return result;
    },
    lanterns: () => scene.lanterns.lanterns.map((l) => ({ phase: l.phase, fill: l.fill, x: l.x, y: l.y, p: l.rise.p })),
    skyLights: () => scene.skyLights.lights.length,
    hold: () => ({ state: hold.state, fill: hold.fill }),
    light: () => hold.lightNow(),
    release: () => hold.releaseNow(),
    speed: (x) => {
      scene.speed = x;
    },
    scene,
    ready: false,
  };
}

export function mountFpsOverlay(stats: FrameStats, cpu: FrameStats): void {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;top:8px;left:8px;padding:4px 8px;font:12px monospace;color:#fff4d6;background:rgba(27,27,58,.72);border-radius:6px;z-index:10;pointer-events:none';
  document.body.appendChild(el);
  setInterval(() => {
    el.textContent = `${stats.fps.toFixed(0)} fps  frame ${stats.avgMs.toFixed(1)} ms  cpu ${cpu.avgMs.toFixed(2)} ms (p95 ${cpu.p95Ms.toFixed(2)})`;
  }, 500);
}
