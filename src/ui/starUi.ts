import { COPY } from '../ritual/copy';
import { el } from './dom';

/**
 * Shooting-star overlay: a 64 px button that follows the head (real DOM, so
 * it is tappable and focusable), a sparkle on tap, and the two lines of copy.
 */
export class StarUi {
  readonly hit: HTMLButtonElement;
  private readonly line: HTMLElement;
  private timer = 0;
  private timer2 = 0;

  constructor(private readonly root: HTMLElement, onTap: (x: number, y: number) => void) {
    this.hit = el('button', { type: 'button', class: 'star-hit', 'aria-label': 'Shooting star', hidden: true });
    this.line = el('p', { class: 'star-line', role: 'status', 'aria-live': 'polite' });
    this.hit.addEventListener('click', () => {
      const x = parseFloat(this.hit.style.left) || 0;
      const y = parseFloat(this.hit.style.top) || 0;
      onTap(x, y);
    });
    root.append(this.hit, this.line);
  }

  /** Move the hit area with the head; null hides it. */
  follow(head: { x: number; y: number } | null): void {
    if (!head) {
      this.hit.hidden = true;
      return;
    }
    this.hit.hidden = false;
    this.hit.style.left = `${head.x.toFixed(1)}px`;
    this.hit.style.top = `${head.y.toFixed(1)}px`;
  }

  /** A sparkle where the star was, then "Quick, a wish, just for you." and "Held close." */
  tapped(x: number, y: number): void {
    this.hit.hidden = true;
    const s = el('div', { class: 'sparkle', 'aria-hidden': 'true' });
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    this.root.append(s);
    window.setTimeout(() => s.remove(), 800);
    // Keep the line on screen: clamp inside a 100 px gutter and under the star.
    const vw = window.innerWidth;
    this.line.style.left = `${Math.max(100, Math.min(vw - 100, x))}px`;
    this.line.style.top = `${y + 6}px`;
    this.line.textContent = COPY.star.tapped;
    this.line.classList.add('on');
    window.clearTimeout(this.timer);
    window.clearTimeout(this.timer2);
    this.timer = window.setTimeout(() => {
      this.line.textContent = COPY.star.held;
    }, 1800);
    this.timer2 = window.setTimeout(() => {
      this.line.classList.remove('on');
    }, 3800);
  }
}
