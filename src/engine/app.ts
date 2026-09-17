import { Application } from 'pixi.js';
import { PALETTE } from '../palette';

export async function createApp(canvas: HTMLCanvasElement): Promise<Application> {
  const app = new Application();
  await app.init({
    canvas,
    preference: 'webgl',
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    background: PALETTE.night,
    width: window.innerWidth,
    height: window.innerHeight,
    powerPreference: 'high-performance',
    hello: false,
  });
  return app;
}
