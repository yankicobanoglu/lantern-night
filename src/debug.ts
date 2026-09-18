import type { Application } from 'pixi.js';
import type { AudioEngine, AudioState } from './audio/engine';
import type { Layout } from './engine/layout';
import { QUALITY_NAMES, type QualityGovernor, type QualityLevel } from './engine/quality';
import type { FrameStats } from './engine/ticker';
import type { Session } from './ritual/session';
import { moonAge, moonFrame, type MoonFrame } from './ritual/moonPhase';
import { isSupermoon } from './ritual/nightEvents';
import type { SceneKind } from './scene/field';
import type { SceneHost } from './scene/host';
import type { Scene } from './scene/scene';
import type { Store } from './store/store';
import type { Lantern, Settings } from './store/types';

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
  /** ?star=now: a shooting star right away. */
  starNow: boolean;
  /** ?install=ios|prompt forces an install hint path. */
  installForce: 'ios' | 'prompt' | null;
  /** ?quality=1|2|3 pins the adaptive quality level (the governor is off). */
  quality: QualityLevel | null;
  /** ?evening=0..1 pins the session light arc. */
  evening: number | null;
  /** ?scene=sky|water pins the scene at boot (ROADMAP 4.1); null follows the setting. */
  scene: SceneKind | null;
  /** ?supermoon forces the larger moon (ROADMAP 4.6). */
  supermoon: boolean;
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
  const quality = params.get('quality');
  const evening = params.has('evening') ? Number(params.get('evening')) : NaN;
  const scene = params.get('scene');
  return {
    now: fixed && !Number.isNaN(fixed.getTime()) ? () => fixed : () => new Date(),
    forcedFrame: forced,
    seed: seedParam ? Number(seedParam) >>> 0 : 7,
    showFps: params.has('debug'),
    risingLanterns: count('lanterns', 12),
    skyLights: count('sky', 1000),
    motion: motion === 'gentle' || motion === 'full' ? motion : null,
    starNow: params.get('star') === 'now',
    installForce: params.get('install') === 'ios' ? 'ios' : params.get('install') === 'prompt' ? 'prompt' : null,
    quality: quality !== null && /^[123]$/.test(quality) ? (Number(quality) as QualityLevel) : null,
    evening: Number.isNaN(evening) ? null : Math.max(0, Math.min(1, evening)),
    scene: scene === 'sky' || scene === 'water' ? scene : null,
    supermoon: params.has('supermoon'),
  };
}

/** Tonight's moon is a supermoon (from the date), or the hook forces it. */
export function supermoonForNow(opts: DebugOptions): boolean {
  return opts.supermoon || isSupermoon(opts.now());
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
  /** Ritual state. */
  state: () => string;
  /** Stored lanterns and settings; seed() replaces the stored lanterns (tests). */
  store: { lanterns: () => Lantern[]; settings: () => Settings; seed: (lanterns: Lantern[]) => Promise<void>; available: () => boolean };
  /** Shooting star head in CSS px while tappable, else null; spawn one now. */
  star: () => { x: number; y: number } | null;
  spawnStar: () => boolean;
  /** Soundscape state. */
  audio: () => AudioState;
  /** Compose the share image now (optionally with a wish) and return it as a PNG data URL. */
  shareImage: (wish?: string | null) => Promise<string>;
  /** Install hint: the detected path and how often the hint has been shown. */
  install: () => { path: string; hintCount: number };
  /** Adaptive quality: the level and what each subsystem is doing about it. */
  quality: () => {
    level: number;
    name: string;
    skyHalos: boolean;
    fireflies: { count: number; halos: boolean };
    cozy: { wisps: boolean; windowGlows: boolean };
    moonHalo: boolean;
    lanternBloom: boolean[];
  };
  /** Pin a quality level now (the governor stops). */
  setQuality: (level: QualityLevel) => void;
  /** Session light arc position 0–1. */
  evening: () => number;
  /** Real-night events (ROADMAP 4.6): the shower tonight, its star-rate factor, and whether the moon is drawn large. */
  night: () => { shower: string | null; rate: number; supermoon: boolean; moonSize: number };
  /** The scene in use and the seconds until the next shooting star is due. */
  sceneKind: () => SceneKind;
  starIn: () => { due: number; interval: number };
  /** The live scene, for manual inspection in dev. */
  readonly scene: Scene;
  ready: boolean;
};

declare global {
  interface Window {
    __lantern?: LanternDebug;
  }
}

export function installDebug(
  app: Application,
  host: SceneHost,
  session: Session,
  store: Store,
  audio: AudioEngine,
  stats: FrameStats,
  cpu: FrameStats,
  governor: QualityGovernor,
  getLayout: () => Layout,
): void {
  const readPixel = (p: Uint8ClampedArray | Uint8Array, w: number, x: number, y: number): number => {
    const i = (Math.floor(y) * w + Math.floor(x)) * 4;
    if ((p[i + 3] ?? 0) === 0) return -1;
    return ((p[i] ?? 0) << 16) | ((p[i + 1] ?? 0) << 8) | (p[i + 2] ?? 0);
  };
  const scene = (): Scene => host.scene;
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
    moonFrame: () => scene().moon.currentFrame,
    samplePixel: (x, y) => {
      const out = app.renderer.extract.pixels(scene().pipeline.worldRT);
      return readPixel(out.pixels, out.width, x, y);
    },
    sampleRect: (x, y, w, h) => {
      const out = app.renderer.extract.pixels(scene().pipeline.worldRT);
      const result: number[] = [];
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) result.push(readPixel(out.pixels, out.width, xx, yy));
      return result;
    },
    lanterns: () => scene().lanterns.lanterns.map((l) => ({ phase: l.phase, fill: l.fill, x: l.x, y: l.y, p: l.rise.p })),
    skyLights: () => scene().skyLights.lights.length,
    hold: () => ({ state: session.hold.state, fill: session.hold.fill }),
    light: () => session.hold.lightNow(),
    release: () => session.hold.releaseNow(),
    speed: (x) => {
      scene().speed = x;
    },
    state: () => session.machine.state,
    store: {
      lanterns: () => store.lanterns,
      settings: () => store.settings,
      seed: (lanterns) => store.replaceAll(lanterns),
      available: () => store.available,
    },
    star: () => session.star(),
    spawnStar: () => session.spawnStarNow(),
    audio: () => audio.state,
    shareImage: async (wish = null) => (await session.renderShare(wish)).toDataURL('image/png'),
    install: () => ({ path: session.installPath(), hintCount: session.installHintCount() }),
    quality: () => ({
      level: scene().quality,
      name: QUALITY_NAMES[scene().quality],
      skyHalos: scene().skyLights.halos.visible,
      fireflies: scene().fireflies.report(),
      cozy: scene().cozy.report(),
      moonHalo: scene().moon.halo.visible,
      lanternBloom: scene().lanterns.lanterns.map((l) => l.bloom),
    }),
    setQuality: (level) => {
      governor.set(level);
      scene().setQuality(level);
    },
    evening: () => scene().evening,
    night: () => ({ ...session.night(), moonSize: scene().moon.size }),
    sceneKind: () => host.kind,
    starIn: () => session.starIn(),
    get scene() {
      return scene();
    },
    ready: false,
  };
}

export function mountFpsOverlay(stats: FrameStats, cpu: FrameStats, governor: QualityGovernor): void {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;top:8px;left:8px;padding:4px 8px;font:12px monospace;color:#fff4d6;background:rgba(27,27,58,.72);border-radius:6px;z-index:10;pointer-events:none';
  document.body.appendChild(el);
  setInterval(() => {
    el.textContent = `${stats.fps.toFixed(0)} fps  frame ${stats.avgMs.toFixed(1)} ms  cpu ${cpu.avgMs.toFixed(2)} ms (p95 ${cpu.p95Ms.toFixed(2)})  q${governor.level} ${QUALITY_NAMES[governor.level]}`;
  }, 500);
}
