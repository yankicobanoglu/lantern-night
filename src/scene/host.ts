import type { Container, Renderer } from 'pixi.js';
import type { Layout } from '../engine/layout';
import type { MotionLevel } from '../engine/motion';
import type { SceneKind } from './field';
import { Scene } from './scene';
import type { SkyLight } from './skyLights';

/**
 * Owns the live scene and swaps it when the Scene setting changes (ROADMAP
 * 4.1). The session, the ticker and the debug hooks read `host.scene`, so
 * none of them hold a reference that goes stale. A swap carries over the
 * moon, the quality level, the evening, the speed and every light.
 */
export class SceneHost {
  scene: Scene;

  constructor(
    private readonly renderer: Renderer,
    private readonly stage: Container,
    layout: Layout,
    private readonly seed: number,
    motion: MotionLevel,
    kind: SceneKind,
  ) {
    this.scene = new Scene(renderer, stage, layout, seed, motion, kind);
  }

  get kind(): SceneKind {
    return this.scene.kind;
  }

  swap(kind: SceneKind, layout: Layout, motion: MotionLevel, lights: readonly SkyLight[]): Scene {
    const old = this.scene;
    const next = new Scene(this.renderer, this.stage, layout, this.seed, motion, kind);
    next.setMoonFrame(old.moon.currentFrame);
    next.moon.setSupermoon(old.moon.isSupermoon);
    next.setQuality(old.quality);
    next.setEvening(old.evening);
    next.speed = old.speed;
    for (const l of lights) next.skyLights.add({ ...l });
    old.destroy();
    this.scene = next;
    return next;
  }
}
