import { UPDATE_PRIORITY } from 'pixi.js';
import { registerSW } from 'virtual:pwa-register';
import './styles.css';
import { AudioEngine } from './audio/engine';
import { frameForNow, installDebug, mountFpsOverlay, readDebugOptions } from './debug';
import { createApp } from './engine/app';
import { computeLayout } from './engine/layout';
import { systemMotionLevel, type MotionLevel } from './engine/motion';
import { QualityGovernor } from './engine/quality';
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
  // Adaptive quality (SPEC section 8): starts full, steps down when frames run long; ?quality= pins it.
  const governor = new QualityGovernor(opts.quality);
  scene.setQuality(governor.level);

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
    evening: opts.evening,
  });

  installDebug(app, scene, session, store, audio, stats, cpu, governor, () => layout);
  if (opts.showFps) mountFpsOverlay(stats, cpu, governor);

  let resizeTimer = 0;
  let appliedW = window.innerWidth;
  let appliedH = window.innerHeight;
  const onResize = (): void => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      appliedW = window.innerWidth;
      appliedH = window.innerHeight;
      app.renderer.resize(window.innerWidth, window.innerHeight);
      layout = computeLayout(window.innerWidth, window.innerHeight, app.renderer.resolution);
      scene.resize(layout, session.motion());
      scene.setMoonFrame(frameForNow(opts));
      session.resize(layout);
      governor.reset();
    }, 80);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  window.visualViewport?.addEventListener('resize', onResize);

  app.ticker.add(
    (ticker) => {
      // A home-screen web app on iOS can report the wrong height at launch without a resize event: check every frame.
      if (window.innerWidth !== appliedW || window.innerHeight !== appliedH) onResize();
      stats.push(ticker.deltaMS);
      if (governor.push(ticker.deltaMS)) scene.setQuality(governor.level);
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
