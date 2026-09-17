import { UPDATE_PRIORITY } from 'pixi.js';
import { NEXT_LANTERN_DELAY_MS } from './config';
import { frameForNow, installDebug, mountFpsOverlay, readDebugOptions } from './debug';
import { createApp } from './engine/app';
import { computeLayout } from './engine/layout';
import { systemMotionLevel, type MotionLevel } from './engine/motion';
import { FrameStats } from './engine/ticker';
import { HoldController } from './ritual/hold';
import { Scene } from './scene/scene';
import { pickSkyPoint } from './scene/skyPoint';
import { LightUi } from './ui/lightUi';

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

  // Ritual wiring (M2: light → release → next lantern; M3 adds the full state machine).
  const ui = new LightUi(uiRoot, motion(), {
    onLightTap: () => hold.lightByTap(),
    onRelease: () => hold.releaseNow(),
  });
  const placeRing = (): void => {
    const l = scene.lanterns.resting;
    if (l) ui.placeRing(l.x * layout.cssScale, l.y * layout.cssScale);
  };
  const hold: HoldController = new HoldController(canvas, {
    onFill: (fill, holding) => {
      const l = scene.lanterns.resting;
      if (l) l.fill = fill;
      ui.holding(holding);
    },
    onLit: () => {
      const l = scene.lanterns.resting;
      if (l) {
        l.fill = 1;
        l.phase = 'lit';
      }
      ui.lit();
    },
    onRelease: () => {
      const l = scene.lanterns.resting;
      if (l && scene.lanterns.release(l)) {
        ui.released('wish');
        window.setTimeout(nextLantern, NEXT_LANTERN_DELAY_MS);
      }
    },
  });
  const nextLantern = (): void => {
    scene.lanterns.spawnResting();
    placeRing();
    hold.arm();
    ui.idle();
  };
  nextLantern();

  installDebug(app, scene, hold, stats, cpu, () => layout);
  if (opts.showFps) mountFpsOverlay(stats, cpu);

  let resizeTimer = 0;
  const onResize = (): void => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      app.renderer.resize(window.innerWidth, window.innerHeight);
      layout = computeLayout(window.innerWidth, window.innerHeight, app.renderer.resolution);
      scene.resize(layout, motion());
      scene.setMoonFrame(frameForNow(opts));
      ui.setMotion(motion());
      placeRing();
    }, 80);
  };
  window.addEventListener('resize', onResize);

  app.ticker.add(
    (ticker) => {
      stats.push(ticker.deltaMS);
      const t0 = performance.now();
      hold.update(ticker.deltaMS);
      scene.update(ticker.deltaMS);
      cpu.push(performance.now() - t0);
      if (window.__lantern && !window.__lantern.ready) {
        window.__lantern.ready = true;
        document.body.dataset['ready'] = 'true';
      }
    },
    undefined,
    UPDATE_PRIORITY.HIGH,
  );
}

boot().catch((err: unknown) => {
  console.error(err);
});
