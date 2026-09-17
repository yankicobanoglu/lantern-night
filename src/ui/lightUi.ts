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

  /**
   * Follow the lantern (CSS px): the breath ring sits around it and the caption
   * floats beside it, on whichever side has more room.
   */
  private side: 'left' | 'right' = 'left';

  follow(cssX: number, cssY: number, viewportWidth: number): void {
    this.ring.style.left = `${cssX}px`;
    this.ring.style.top = `${cssY}px`;
    this.root.style.setProperty('--lantern-y', `${cssY.toFixed(1)}px`);
    // Caption to the left of the lantern. It only moves to the right when the left
    // no longer fits (the lantern drifted to the edge), and stays there until that side stops fitting.
    const gap = 36;
    const w = 140;
    const gutter = 8;
    const fitsLeft = cssX - gap - w >= gutter;
    const fitsRight = cssX + gap + w <= viewportWidth - gutter;
    if (this.side === 'left' && !fitsLeft && fitsRight) this.side = 'right';
    else if (this.side === 'right' && !fitsRight && fitsLeft) this.side = 'left';
    const left = this.side === 'left';
    const x = left ? Math.max(gutter, cssX - gap - w) : Math.min(cssX + gap, viewportWidth - gutter - w);
    this.root.style.setProperty('--hint-x', `${x.toFixed(1)}px`);
    this.hint.classList.toggle('left', left);
  }

  private fadeTimer = 0;
  private pendingText: string | null = null;

  /** Cross-fade to a new line instead of swapping the text. */
  private say(text: string): void {
    if (this.pendingText === text || (this.pendingText === null && this.hint.textContent === text)) return;
    this.pendingText = text;
    window.clearTimeout(this.fadeTimer);
    if (!this.hint.textContent) {
      this.hint.textContent = text;
      this.pendingText = null;
      return;
    }
    this.hint.classList.add('fading');
    this.fadeTimer = window.setTimeout(() => {
      this.hint.textContent = text;
      this.hint.classList.remove('fading');
      this.pendingText = null;
    }, 260);
  }

  private syncActions(): void {
    const actions = this.root.querySelector('.actions') as HTMLElement;
    actions.dataset['empty'] = String(this.lightBtn.hidden && this.releaseBtn.hidden);
  }

  idle(): void {
    window.clearTimeout(this.hintTimer);
    this.root.dataset['state'] = 'idle';
    this.say(COPY.light.idle);
    this.ring.classList.remove('holding', 'done');
    this.lightBtn.hidden = false;
    this.releaseBtn.hidden = true;
    this.syncActions();
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
    this.syncActions();
    window.clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => this.say(COPY.light.hint), 2600);
  }

  released(mode: 'wish' | 'let-go'): void {
    this.root.dataset['state'] = 'released';
    this.ring.classList.remove('holding', 'done');
    this.lightBtn.hidden = true;
    this.releaseBtn.hidden = true;
    this.syncActions();
    this.say(COPY.release.gone);
    window.clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => this.say(mode === 'wish' ? COPY.release.wish : COPY.release.letGo), 1800);
  }

  hide(): void {
    this.root.dataset['state'] = 'hidden';
    this.lightBtn.hidden = true;
    this.releaseBtn.hidden = true;
    this.syncActions();
  }
}
