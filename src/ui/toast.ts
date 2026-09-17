import { el } from './dom';

/** One system message at a time, near the top, self-hiding. */
export class Toast {
  readonly node: HTMLElement;
  private timer = 0;

  constructor(root: HTMLElement) {
    this.node = el('p', { class: 'toast panel', role: 'status', 'aria-live': 'polite' });
    root.append(this.node);
  }

  show(text: string, ms = 6000): void {
    window.clearTimeout(this.timer);
    this.node.textContent = text;
    this.node.classList.add('on');
    this.timer = window.setTimeout(() => this.hide(), ms);
  }

  hide(): void {
    this.node.classList.remove('on');
  }
}
