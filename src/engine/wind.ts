import { valueNoise2D } from './noise';

export type Wind = { x: number; y: number };

/**
 * Slowly changing 2D curl-noise wind field (SPEC section 8). The potential is
 * two octaves of value noise that drift with time; the wind is its curl, so the
 * field is divergence-free and lanterns swirl gently instead of bunching up.
 * Units: art px per second.
 */
export class WindField {
  private readonly salt: number;

  /**
   * @param strength peak wind speed in art px/s
   * @param cell size of one noise cell in art px
   * @param driftPerSec how fast the pattern evolves (cells per second)
   */
  constructor(
    seed: number,
    readonly strength = 6,
    readonly cell = 60,
    readonly driftPerSec = 0.025,
  ) {
    this.salt = (seed * 31 + 101) >>> 0;
  }

  potential(x: number, y: number, tSec: number): number {
    const u = x / this.cell;
    const v = y / this.cell;
    const d = tSec * this.driftPerSec;
    return valueNoise2D(u + d, v + d * 0.6, this.salt) * 0.7 + valueNoise2D(u * 2.1 - d * 0.8, v * 2.1 + 3.3, this.salt + 1) * 0.3;
  }

  sample(x: number, y: number, tSec: number): Wind {
    const eps = 1.5;
    const dpdx = (this.potential(x + eps, y, tSec) - this.potential(x - eps, y, tSec)) / (2 * eps);
    const dpdy = (this.potential(x, y + eps, tSec) - this.potential(x, y - eps, tSec)) / (2 * eps);
    // Curl of (0, 0, ψ): (∂ψ/∂y, −∂ψ/∂x). Scale so a full-cell swing gives `strength`.
    const k = this.strength * this.cell * 0.9;
    return { x: dpdy * k, y: -dpdx * k };
  }
}
