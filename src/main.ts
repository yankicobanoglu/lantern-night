import { UPDATE_PRIORITY } from 'pixi.js';
import { frameForNow, installDebug, mountFpsOverlay, readDebugOptions } from './debug';
import { createApp } from './engine/app';
import { computeLayout } from './engine/layout';
import { FrameStats } from './engine/ticker';
import { Scene } from './scene/scene';

async function boot(): Promise<void> {
  const canvas = document.getElementById('world');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('missing #world canvas');

  const opts = readDebugOptions(location.search);
  const app = await createApp(canvas);
  const stats = new FrameStats();
  const cpu = new FrameStats();

  let layout = computeLayout(window.innerWidth, window.innerHeight, app.renderer.resolution);
  const scene = new Scene(app.renderer, app.stage, layout, opts.seed);
  scene.setMoonFrame(frameForNow(opts));

  installDebug(app, scene, stats, cpu, () => layout);
  if (opts.showFps) mountFpsOverlay(stats, cpu);

  let resizeTimer = 0;
  const onResize = (): void => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      app.renderer.resize(window.innerWidth, window.innerHeight);
      layout = computeLayout(window.innerWidth, window.innerHeight, app.renderer.resolution);
      scene.resize(layout);
      scene.setMoonFrame(frameForNow(opts));
    }, 80);
  };
  window.addEventListener('resize', onResize);

  app.ticker.add(
    (ticker) => {
      stats.push(ticker.deltaMS);
      const t0 = performance.now();
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
