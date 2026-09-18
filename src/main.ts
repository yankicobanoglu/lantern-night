import { UPDATE_PRIORITY } from 'pixi.js';
import { registerSW } from 'virtual:pwa-register';
import './styles.css';
import { AudioEngine } from './audio/engine';
import { frameForNow, installDebug, mountFpsOverlay, readDebugOptions, supermoonForNow } from './debug';
import { createApp } from './engine/app';
import { computeLayout } from './engine/layout';
import { systemMotionLevel, type MotionLevel } from './engine/motion';
import { QualityGovernor } from './engine/quality';
import { FrameStats } from './engine/ticker';
import { Session } from './ritual/session';
import { pickFieldPoint } from './scene/field';
import { Scene } from './scene/scene';
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
  // One world holding both kinds of lantern (M7): the wish screen chooses which one is folded next.
  const scene = new Scene(app.renderer, app.stage, layout, opts.seed, motion());
  scene.setMoonFrame(frameForNow(opts));
  scene.moon.setSupermoon(supermoonForNow(opts));
  // Adaptive quality (SPEC section 8): starts full, steps down when frames run long; ?quality= pins it.
  const governor = new QualityGovernor(opts.quality);
  scene.setQuality(governor.level);

  // Test hooks: pre-seeded sky and lanterns already rising.
  // Test hooks: pre-seeded lights and lanterns of the pinned kind (?scene=), sky by default.
  const testKind = opts.scene ?? 'sky';
  for (let i = 0; i < opts.skyLights; i++) {
    const seed = (opts.seed * 1000 + i * 7919) >>> 0;
    const lights = scene.lightsOf(testKind);
    lights.add({ seed, sky: pickFieldPoint(seed, scene.fieldOf(testKind), lights.points), status: 'rising', kind: testKind });
  }
  for (let i = 0; i < opts.risingLanterns; i++) scene.lanternsOf(testKind).spawnRising((i + 0.5) / (opts.risingLanterns + 1) * 0.8);

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
    sceneOverride: opts.scene,
  });

  installDebug(app, scene, session, store, audio, stats, cpu, governor, () => layout);
  if (opts.showFps) mountFpsOverlay(stats, cpu, governor);

  let resizeTimer = 0;
  // Seeded from what the renderer actually applied, not from the window as it is now: the viewport can
  // change while `createApp` and the store are awaited, and a snapshot taken here would agree with the
  // window while the canvas kept its old size, with no resize event to correct it (seen live on a pane
  // that was still settling at load: a 300x150 scene in a 1024x768 window). The per-frame check below
  // then catches the difference on the first frame.
  let appliedW = Math.round(app.renderer.screen.width);
  let appliedH = Math.round(app.renderer.screen.height);
  const onResize = (): void => {
    // Claim the new size straight away. The per-frame check below runs about every 16 ms, so if this
    // waited for the debounced callback the check would keep re-arming the timer and the resize would
    // never run at all: on the live site the canvas kept its old size after a window resize or a
    // rotation, and the scene was simply cropped.
    appliedW = window.innerWidth;
    appliedH = window.innerHeight;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      appliedW = w;
      appliedH = h;
      app.renderer.resize(w, h);
      layout = computeLayout(w, h, app.renderer.resolution);
      scene.resize(layout, session.motion());
      scene.setMoonFrame(frameForNow(opts));
      session.resize(layout);
      governor.reset();
    }, 80);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  window.visualViewport?.addEventListener('resize', onResize);

  // iOS keyboard (review after the live check): the UI layer follows the visual viewport, so the
  // screens sit above the keyboard, and the intention panel keeps clear of Safari's floating address pill.
  const vv = window.visualViewport;
  const fitUi = (): void => {
    if (!vv) return;
    const keyboard = vv.height < window.innerHeight - 120;
    uiRoot.style.height = keyboard ? `${Math.round(vv.height)}px` : '';
    uiRoot.style.top = keyboard ? `${Math.round(vv.offsetTop)}px` : '';
    uiRoot.style.bottom = keyboard ? 'auto' : '';
    uiRoot.classList.toggle('keyboard', keyboard);
  };
  vv?.addEventListener('resize', fitUi);
  vv?.addEventListener('scroll', fitUi);

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
