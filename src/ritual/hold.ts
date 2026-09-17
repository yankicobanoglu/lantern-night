import { HOLD_MS, TAP_LIGHT_MS, UNFILL_PER_S } from '../config';

export type HoldState = 'idle' | 'holding' | 'lit' | 'released';

export type HoldEvents = {
  /** Fill changed (0–1) while holding or easing back. */
  onFill: (fill: number, holding: boolean) => void;
  onLit: () => void;
  onRelease: () => void;
};

/**
 * Hold-to-light and swipe-to-release gesture controller (SPEC section 3, steps
 * 4–5). Pointer events only; the DOM buttons call lightByTap()/releaseNow().
 * Letting go early eases the fill back down: no failure state.
 */
export class HoldController {
  state: HoldState = 'idle';
  fill = 0;
  private pointerId: number | null = null;
  private downX = 0;
  private downY = 0;
  private autoLight = false;
  private enabled = false;

  constructor(private readonly surface: HTMLElement, private readonly events: HoldEvents) {
    surface.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    // A swipe must never scroll the page (SPEC section 11 checklist). Scrollable
    // sheets (chips, settings) opt out with `touch-action: pan-*` in CSS.
    document.addEventListener(
      'touchmove',
      (e) => {
        const t = e.target;
        if (t instanceof Element && t.closest('.chips, .sheet, .screen .panel')) return;
        e.preventDefault();
      },
      { passive: false },
    );
  }

  /** A lantern is waiting: accept input. */
  arm(): void {
    this.enabled = true;
    this.state = 'idle';
    this.fill = 0;
    this.autoLight = false;
    this.events.onFill(0, false);
  }

  disarm(): void {
    this.enabled = false;
    this.state = 'released';
  }

  /** Tap alternative: the lantern fills on its own. */
  lightByTap(): void {
    if (!this.enabled || this.state === 'lit') return;
    this.autoLight = true;
    this.state = 'holding';
  }

  /** Button alternative to the swipe. */
  releaseNow(): void {
    if (!this.enabled || this.state !== 'lit') return;
    this.state = 'released';
    this.enabled = false;
    this.events.onRelease();
  }

  /** Test hook: light instantly. */
  lightNow(): void {
    if (!this.enabled || this.state === 'lit') return;
    this.fill = 1;
    this.state = 'lit';
    this.events.onFill(1, false);
    this.events.onLit();
  }

  update(dtMs: number): void {
    if (!this.enabled) return;
    if (this.state === 'holding') {
      const rate = this.autoLight ? dtMs / TAP_LIGHT_MS : this.pointerId !== null ? dtMs / HOLD_MS : -(dtMs / 1000) * UNFILL_PER_S;
      this.fill = Math.max(0, Math.min(1, this.fill + rate));
      const holding = this.autoLight || this.pointerId !== null;
      if (this.fill >= 1) {
        this.state = 'lit';
        this.events.onFill(1, false);
        this.events.onLit();
      } else if (this.fill <= 0 && !holding) {
        this.state = 'idle';
        this.events.onFill(0, false);
      } else {
        this.events.onFill(this.fill, holding);
      }
    }
  }

  private onDown = (e: PointerEvent): void => {
    if (!this.enabled || !e.isPrimary) return;
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.downX = e.clientX;
    this.downY = e.clientY;
    if (this.state === 'idle' || this.state === 'holding') {
      this.state = 'holding';
      this.events.onFill(this.fill, true);
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (this.pointerId !== e.pointerId || this.state !== 'lit') return;
    const dx = e.clientX - this.downX;
    const dy = e.clientY - this.downY;
    // Swipe up: at least 60 CSS px, mostly vertical.
    if (dy < -60 && Math.abs(dx) < Math.abs(dy) * 0.8) {
      this.pointerId = null;
      this.releaseNow();
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (this.pointerId !== e.pointerId) return;
    this.pointerId = null;
    if (this.state === 'holding' && !this.autoLight) this.events.onFill(this.fill, false);
  };

  destroy(): void {
    this.surface.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
  }
}
