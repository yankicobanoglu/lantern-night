import { HOLD_MS } from '../config';
import type { MotionLevel } from '../engine/motion';
import { COPY, type Mode } from '../ritual/copy';
import { button, el } from './dom';

/**
 * The stage overlay for Light, Release and Watch: a breath ring that expands
 * over the 4 s hold, the hint caption beside the lantern, the written text on
 * the other side, and the small pills at the bottom (tap alternatives, SPEC
 * section 8 accessibility; watch buttons, section 3 step 6).
 */
export class LightUi {
  readonly stage: HTMLElement;
  private readonly root: HTMLElement;
  private readonly ring: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly wish: HTMLElement;
  private readonly actions: HTMLElement;
  private readonly lightBtn: HTMLButtonElement;
  private readonly releaseBtn: HTMLButtonElement;
  private readonly anotherBtn: HTMLButtonElement;
  private readonly goodnightBtn: HTMLButtonElement;
  private hintTimer = 0;
  private side: 'left' | 'right' = 'left';

  constructor(
    root: HTMLElement,
    motion: MotionLevel,
    handlers: { onLightTap: () => void; onRelease: () => void; onAnother: () => void; onGoodnight: () => void },
  ) {
    this.root = root;
    this.ring = el('div', { class: 'breath', 'aria-hidden': 'true' });
    this.hint = el('p', { class: 'hint', role: 'status', 'aria-live': 'polite' });
    this.wish = el('p', { class: 'wish', 'aria-hidden': 'true' });
    this.lightBtn = button(COPY.light.tapAlternative, 'ghost small', handlers.onLightTap, { 'data-action': 'light' });
    this.releaseBtn = button(COPY.release.letItRise, 'primary small', handlers.onRelease, { 'data-action': 'release' });
    this.anotherBtn = button(COPY.release.lightAnother, 'primary small', handlers.onAnother, { 'data-action': 'another' });
    this.goodnightBtn = button(COPY.release.goodnight, 'ghost small', handlers.onGoodnight, { 'data-action': 'goodnight' });
    this.actions = el('div', { class: 'actions' }, [this.lightBtn, this.releaseBtn, this.anotherBtn, this.goodnightBtn]);
    this.stage = el('div', { class: 'stage' }, [this.ring, this.hint, this.wish, this.actions]);
    root.append(this.stage);
    this.ring.style.transitionDuration = `${HOLD_MS}ms`;
    this.setMotion(motion);
    this.hide();
  }

  setMotion(motion: MotionLevel): void {
    this.root.classList.toggle('gentle', motion === 'gentle');
  }

  /**
   * Follow the lantern (CSS px): the breath ring sits around it, the caption
   * floats to its left and the written text to its right. The caption only
   * moves to the other side when the left no longer fits (the lantern drifted
   * to the edge), and stays there until that side stops fitting.
   */
  follow(cssX: number, cssY: number, viewportWidth: number): void {
    this.ring.style.left = `${cssX}px`;
    this.ring.style.top = `${cssY}px`;
    this.root.style.setProperty('--lantern-y', `${cssY.toFixed(1)}px`);
    const gap = 36;
    const w = 140;
    const gutter = 8;
    const fitsLeft = cssX - gap - w >= gutter;
    const fitsRight = cssX + gap + w <= viewportWidth - gutter;
    if (this.side === 'left' && !fitsLeft && fitsRight) this.side = 'right';
    else if (this.side === 'right' && !fitsRight && fitsLeft) this.side = 'left';
    const left = this.side === 'left';
    const leftX = Math.max(gutter, cssX - gap - w);
    const rightX = Math.min(cssX + gap, viewportWidth - gutter - w);
    this.root.style.setProperty('--hint-x', `${(left ? leftX : rightX).toFixed(1)}px`);
    this.root.style.setProperty('--wish-x', `${(left ? rightX : leftX).toFixed(1)}px`);
    this.hint.classList.toggle('left', left);
    this.wish.classList.toggle('left', !left);
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

  private showButtons(...visible: HTMLButtonElement[]): void {
    for (const b of [this.lightBtn, this.releaseBtn, this.anotherBtn, this.goodnightBtn]) b.hidden = !visible.includes(b);
    this.actions.dataset['empty'] = String(visible.length === 0);
    this.actions.classList.remove('fade-in');
  }

  /** The written text shown beside the lantern (null clears it). */
  setWish(text: string | null): void {
    this.wish.textContent = text ?? '';
    this.wish.classList.remove('rising');
    this.wish.classList.toggle('on', text !== null && text !== '');
  }

  idle(): void {
    window.clearTimeout(this.hintTimer);
    this.stage.dataset['state'] = 'idle';
    this.say(COPY.light.idle);
    this.ring.classList.remove('holding', 'done');
    this.showButtons(this.lightBtn);
  }

  holding(holding: boolean): void {
    if (this.stage.dataset['state'] === 'lit') return;
    this.stage.dataset['state'] = holding ? 'holding' : 'idle';
    this.say(holding ? COPY.light.holding : COPY.light.idle);
    this.ring.classList.toggle('holding', holding);
  }

  lit(): void {
    this.stage.dataset['state'] = 'lit';
    this.say(COPY.light.lit);
    this.ring.classList.remove('holding');
    this.ring.classList.add('done');
    this.showButtons(this.releaseBtn);
    window.clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => this.say(COPY.light.hint), 2600);
  }

  released(mode: Mode): void {
    this.stage.dataset['state'] = 'released';
    this.ring.classList.remove('holding', 'done');
    this.showButtons();
    this.say(COPY.release.gone);
    // The written text glows and fades as the lantern rises.
    this.wish.classList.add('rising');
    window.clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => this.say(mode === 'wish' ? COPY.release.wish : COPY.release.letGo), 1800);
  }

  /** The lantern has settled into the sky: nothing left to follow, so the caption fades out. */
  settled(): void {
    this.hint.classList.add('fading');
    this.pendingText = null;
  }

  /** The lantern is well on its way: the watch line and the two buttons fade in. */
  watch(): void {
    this.stage.dataset['state'] = 'watch';
    window.clearTimeout(this.hintTimer);
    this.say(COPY.release.watch);
    this.showButtons(this.anotherBtn, this.goodnightBtn);
    this.actions.classList.add('fade-in');
  }

  hide(): void {
    window.clearTimeout(this.hintTimer);
    this.stage.dataset['state'] = 'hidden';
    this.showButtons();
    this.setWish(null);
  }
}
