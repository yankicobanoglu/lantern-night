import { Container, RenderTexture, Renderer, Sprite } from 'pixi.js';
import type { Layout } from './layout';

/**
 * Render pipeline (SPEC section 8):
 * 1. `above` (sky, moon, hills, later lanterns) → aboveRT, in art px.
 * 2. `world` (above sprite, lake reflection rows, shore) → worldRT, in art px.
 * 3. worldRT upscaled with nearest-neighbour to the stage, then `light` at full resolution.
 */
export class Pipeline {
  readonly above = new Container();
  readonly world = new Container();
  readonly light = new Container();
  readonly upscale: Sprite;
  aboveRT: RenderTexture;
  worldRT: RenderTexture;
  private aboveSprite: Sprite;

  constructor(private readonly renderer: Renderer, private readonly stage: Container, layout: Layout) {
    this.aboveRT = Pipeline.makeRT(layout.width, layout.hillsEnd);
    this.worldRT = Pipeline.makeRT(layout.width, layout.height);
    this.aboveSprite = new Sprite(this.aboveRT);
    this.world.addChild(this.aboveSprite);
    this.upscale = new Sprite(this.worldRT);
    this.light.blendMode = 'add';
    this.stage.addChild(this.upscale, this.light);
    this.applyScale(layout);
  }

  private static makeRT(width: number, height: number): RenderTexture {
    return RenderTexture.create({ width, height, scaleMode: 'nearest', antialias: false, resolution: 1 });
  }

  private applyScale(layout: Layout): void {
    this.upscale.scale.set(layout.cssScale);
    this.upscale.position.set(0, 0);
  }

  resize(layout: Layout): void {
    this.aboveRT.destroy(true);
    this.worldRT.destroy(true);
    this.aboveRT = Pipeline.makeRT(layout.width, layout.hillsEnd);
    this.worldRT = Pipeline.makeRT(layout.width, layout.height);
    this.aboveSprite.texture = this.aboveRT;
    this.upscale.texture = this.worldRT;
    this.applyScale(layout);
  }

  destroy(): void {
    this.aboveRT.destroy(true);
    this.worldRT.destroy(true);
    this.upscale.destroy();
    this.light.destroy({ children: true });
    this.world.destroy({ children: true });
    this.above.destroy({ children: true });
  }

  /** Run the two art-px passes. Call before the stage renders. */
  render(): void {
    this.renderer.render({ container: this.above, target: this.aboveRT, clear: true });
    this.renderer.render({ container: this.world, target: this.worldRT, clear: true });
  }
}
