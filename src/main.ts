import { UPDATE_PRIORITY } from 'pixi.js';
import { registerSW } from 'virtual:pwa-register';
import './styles.css';
import { AudioEngine } from './audio/engine';
import { frameForNow, installDebug, mountFpsOverlay, readDebugOptions } from './debug';
import { createApp } from './engine/app';
import { computeLayout } from './engine/layout';
import { systemMotionLevel, type MotionLevel } from './engine/motion';
import { FrameStats } from './engine/ticker';
import { Session } from './ritual/session';
import { Scene } from './scene/scene';
import { pickSkyPoint } from './scene/skyPoint';
import { openKv } from './store/kv';
import { Store } from './store/store';
import { captureInstallPrompt } from './ui/install';

// Offline support (SPEC section 8): the service worker precaches the site's own files; nothing else is ever fetched.
registerSW({ immediate: true });
// Captured early so the Install button can show the browser's prompt later.
const installPrompt = captureInstallPrompt();

async function boot(): Promise<void> {
  const canvas = document.getElementById('world');
  const uiRoot = document.getElementById('ui');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('missing #world canvas');
  if (!(uiRoot instanceof HTMLElement)) throw new Error('missing #ui root');

  const opts = readDebugOptions(location.search);
  const motion = (): MotionLevel => opts.motion ?? systemMotionLevel();
  const app = await createApp(canvas);
  const stats = new FrameStats();
  const cpu = new FrameStats();

  let layout = computeLayout(window.innerWidth, window.innerHeight, app.renderer.resolution);
  const scene = new Scene(app.renderer, app.stage, layout, opts.seed, motion());
  scene.setMoonFrame(frameForNow(opts));

  // Test hooks: pre-seeded sky and lanterns already rising.
  for (let i = 0; i < opts.skyLights; i++) {
    const seed = (opts.seed * 1000 + i * 7919) >>> 0;
    const bounds = { width: layout.width, horizon: layout.horizon, moon: layout.moon };
    scene.skyLights.add({ seed, sky: pickSkyPoint(seed, bounds, scene.skyLights.points), status: 'rising' });
  }
  for (let i = 0; i < opts.risingLanterns; i++) scene.lanterns.spawnRising((i + 0.5) / (opts.risingLanterns + 1) * 0.8);

  const store = new Store(await openKv());
  const audio = new AudioEngine();
  const session = new Session({
    root: uiRoot,
    canvas,
    scene,
    store,
    audio,
    renderer: app.renderer,
    layout: () => layout,
    now: opts.now,
    motionOverride: opts.motion,
    starNow: opts.starNow,
    installForce: opts.installForce,
    installPrompt: installPrompt.get,
    seed: opts.seed,
  });

  installDebug(app, scene, session, store, audio, stats, cpu, () => layout);
  if (opts.showFps) mountFpsOverlay(stats, cpu);

  let resizeTimer = 0;
  const onResize = (): void => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      app.renderer.resize(window.innerWidth, window.innerHeight);
      layout = computeLayout(window.innerWidth, window.innerHeight, app.renderer.resolution);
      scene.resize(layout, session.motion());
      scene.setMoonFrame(frameForNow(opts));
      session.resize(layout);
    }, 80);
  };
  window.addEventListener('resize', onResize);

  app.ticker.add(
    (ticker) => {
      stats.push(ticker.deltaMS);
      const t0 = performance.now();
      scene.update(ticker.deltaMS);
      session.update(ticker.deltaMS);
      cpu.push(performance.now() - t0);
      if (window.__lantern && !window.__lantern.ready) {
        window.__lantern.ready = true;
        document.body.dataset['ready'] = 'true';
      }
    },
    undefined,
    UPDATE_PRIORITY.HIGH,
  );

  await session.start();
}

boot().catch((err: unknown) => {
  console.error(err);
});
