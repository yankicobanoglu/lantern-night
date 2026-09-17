import type { Layout } from '../engine/layout';
import { COPY } from '../ritual/copy';
import { moonAge, moonFrame, nextMoonEvent, phaseName } from '../ritual/moonPhase';
import { el } from './dom';

/** A 44 px button over the moon; tapping shows tonight's phase and the next new or full moon. */
export class MoonLabel {
  readonly button: HTMLButtonElement;
  readonly label: HTMLElement;
  private readonly phase: HTMLElement;
  private readonly next: HTMLElement;
  private timer = 0;

  constructor(root: HTMLElement, private readonly now: () => Date) {
    this.button = el('button', { type: 'button', class: 'moon-btn', 'aria-label': 'Moon', 'aria-expanded': 'false' });
    this.phase = el('p');
    this.next = el('p', { class: 'muted' });
    this.label = el('div', { class: 'moon-label panel', role: 'status' }, [this.phase, this.next]);
    this.button.addEventListener('click', () => this.toggle());
    root.append(this.button, this.label);
  }

  place(layout: Layout): void {
    const css = layout.cssScale;
    const x = layout.moon.x * css;
    const y = layout.moon.y * css;
    this.button.style.left = `${x}px`;
    this.button.style.top = `${y}px`;
    // The 32 art px disc is wider than 44 CSS px on every layout we ship; keep the hit area at least the disc.
    const d = Math.max(44, 32 * css);
    this.button.style.width = `${d}px`;
    this.button.style.height = `${d}px`;
    this.button.style.margin = `${-d / 2}px 0 0 ${-d / 2}px`;
    this.label.style.left = `${x}px`;
    this.label.style.top = `${y + d / 2}px`;
  }

  toggle(open = !this.label.classList.contains('on')): void {
    window.clearTimeout(this.timer);
    if (open) {
      const date = this.now();
      const age = moonAge(date);
      this.phase.textContent = phaseName(moonFrame(age));
      const ev = nextMoonEvent(date);
      this.next.textContent = COPY.moon.next(ev.kind, ev.days);
      this.timer = window.setTimeout(() => this.toggle(false), 7000);
    }
    this.label.classList.toggle('on', open);
    this.button.setAttribute('aria-expanded', String(open));
  }
}
