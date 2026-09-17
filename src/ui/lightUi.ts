import { HOLD_MS } from '../config';
import type { MotionLevel } from '../engine/motion';
import { COPY } from '../ritual/copy';

/**
 * Minimal DOM overlay for the Light and Release moments: a breath ring that
 * expands over the 4 s hold, one hint line, and the tap alternatives
 * (SPEC section 8 accessibility: the hold always has a tap alternative).
 * M3 wraps this in the full state machine and panel.
 */
export class LightUi {
  readonly root: HTMLElement;
  private readonly ring: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly lightBtn: HTMLButtonElement;
  private readonly releaseBtn: HTMLButtonElement;
  private hintTimer = 0;

  constructor(root: HTMLElement, motion: MotionLevel, handlers: { onLightTap: () => void; onRelease: () => void }) {
    this.root = root;
    root.innerHTML = `
      <div class="breath" aria-hidden="true"></div>
      <p class="hint" role="status" aria-live="polite"></p>
      <div class="actions">
        <button type="button" class="btn ghost" data-action="light">${COPY.light.tapAlternative}</button>
        <button type="button" class="btn primary" data-action="release">${COPY.release.letItRise}</button>
      </div>`;
    this.ring = root.querySelector('.breath') as HTMLElement;
    this.hint = root.querySelector('.hint') as HTMLElement;
    this.lightBtn = root.querySelector('[data-action="light"]') as HTMLButtonElement;
    this.releaseBtn = root.querySelector('[data-action="release"]') as HTMLButtonElement;
    this.lightBtn.addEventListener('click', handlers.onLightTap);
    this.releaseBtn.addEventListener('click', handlers.onRelease);
    this.ring.style.transitionDuration = `${HOLD_MS}ms`;
    this.setMotion(motion);
    this.hide();
  }

  setMotion(motion: MotionLevel): void {
    this.root.classList.toggle('gentle', motion === 'gentle');
  }

  /** Position the breath ring around the lantern (CSS px). */
  placeRing(cssX: number, cssY: number): void {
    this.ring.style.left = `${cssX}px`;
    this.ring.style.top = `${cssY}px`;
    // The hint line sits just above the lantern, never over it.
    this.root.style.setProperty('--lantern-y', `${cssY}px`);
  }

  private say(text: string): void {
    this.hint.textContent = text;
  }

  idle(): void {
    window.clearTimeout(this.hintTimer);
    this.root.dataset['state'] = 'idle';
    this.say(COPY.light.idle);
    this.ring.classList.remove('holding', 'done');
    this.lightBtn.hidden = false;
    this.releaseBtn.hidden = true;
  }

  holding(holding: boolean): void {
    if (this.root.dataset['state'] === 'lit') return;
    this.root.dataset['state'] = holding ? 'holding' : 'idle';
    this.say(holding ? COPY.light.holding : COPY.light.idle);
    this.ring.classList.toggle('holding', holding);
  }

  lit(): void {
    this.root.dataset['state'] = 'lit';
    this.say(COPY.light.lit);
    this.ring.classList.remove('holding');
    this.ring.classList.add('done');
    this.lightBtn.hidden = true;
    this.releaseBtn.hidden = false;
    window.clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => this.say(COPY.light.hint), 2600);
  }

  released(mode: 'wish' | 'let-go'): void {
    this.root.dataset['state'] = 'released';
    this.ring.classList.remove('holding', 'done');
    this.lightBtn.hidden = true;
    this.releaseBtn.hidden = true;
    this.say(COPY.release.gone);
    window.clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => this.say(mode === 'wish' ? COPY.release.wish : COPY.release.letGo), 1800);
  }

  hide(): void {
    this.root.dataset['state'] = 'hidden';
    this.lightBtn.hidden = true;
    this.releaseBtn.hidden = true;
  }
}
