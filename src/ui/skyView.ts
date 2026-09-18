import type { Layout } from '../engine/layout';
import { COPY } from '../ritual/copy';
import type { Lantern } from '../store/types';
import { button, el, formatDate } from './dom';
import { focusFirst } from './focus';

/**
 * Your sky (SPEC section 4): heading, count, and one real button over every
 * stored light. Tapping a light shows its date and wish text.
 */
export class SkyView {
  readonly node: HTMLElement;
  private readonly count: HTMLElement;
  private readonly lights: HTMLElement;
  private readonly card: HTMLElement;
  private readonly cardDate: HTMLElement;
  private readonly cardText: HTMLElement;
  private readonly empty: HTMLElement;
  private lanterns: Lantern[] = [];
  private layout: Layout | null = null;
  private selected: string | null = null;

  constructor(
    root: HTMLElement,
    onClose: () => void,
    onShare: () => void,
    /** CSS-px position of a lantern still on its way to this stored light, or null once it has arrived. */
    private readonly track: (id: string) => { x: number; y: number } | null = () => null,
  ) {
    this.count = el('p', { class: 'line hand' });
    this.lights = el('div', { class: 'lights' });
    this.cardDate = el('p', { class: 'date' });
    this.cardText = el('p', { class: 'quote' });
    this.card = el('div', { class: 'sky-card panel', hidden: true, role: 'status', 'aria-live': 'polite' }, [this.cardDate, this.cardText]);
    this.empty = el('p', { class: 'line panel', hidden: true, text: COPY.sky.empty });
    this.node = el('section', { class: 'overlay sky', 'aria-label': COPY.sky.heading }, [
      this.lights,
      el('div', { class: 'top' }, [el('h2', { text: COPY.sky.heading }), this.count]),
      el('div', { class: 'bottom' }, [
        this.empty,
        this.card,
        el('div', { class: 'row' }, [button(COPY.share.button, 'ghost small', onShare, { 'data-action': 'share' }), button(COPY.sky.close, 'ghost small', onClose)]),
      ]),
    ]);
    this.node.addEventListener('click', (e) => {
      if (e.target === this.node) onClose();
    });
    root.append(this.node);
  }

  show(lanterns: Lantern[], layout: Layout): void {
    this.lanterns = lanterns;
    this.layout = layout;
    this.selected = null;
    this.card.hidden = true;
    this.count.textContent = COPY.sky.count(lanterns.length);
    this.empty.hidden = lanterns.length > 0;
    this.lights.replaceChildren(
      ...lanterns.map((l) => {
        const b = el('button', { type: 'button', class: 'sky-light', 'aria-label': `${formatDate(l.createdAt)}: ${l.text}`, 'aria-pressed': 'false', 'data-id': l.id });
        b.addEventListener('click', () => this.select(l.id));
        return b;
      }),
    );
    this.place(layout);
    this.node.classList.add('on');
    focusFirst(this.node);
  }

  /** The wish of the selected light, if any. */
  get selectedWish(): string | null {
    return this.lanterns.find((l) => l.id === this.selected)?.text ?? null;
  }

  place(layout: Layout): void {
    this.layout = layout;
    const css = layout.cssScale;
    const buttons = this.lights.children;
    for (let i = 0; i < buttons.length; i++) {
      const b = buttons[i] as HTMLElement;
      const l = this.lanterns[i];
      if (!l) continue;
      // A lantern still rising keeps its ring with it until it settles at its sky point.
      const live = this.track(l.id);
      b.style.left = `${live ? live.x : l.sky.x * layout.width * css}px`;
      b.style.top = `${live ? live.y : l.sky.y * layout.horizon * css}px`;
    }
  }

  private select(id: string): void {
    const l = this.lanterns.find((x) => x.id === id);
    if (!l) return;
    this.selected = id;
    for (const b of Array.from(this.lights.children)) b.setAttribute('aria-pressed', String((b as HTMLElement).dataset['id'] === id));
    this.cardDate.textContent = formatDate(l.createdAt);
    this.cardText.textContent = l.text;
    this.card.hidden = false;
  }

  get isOpen(): boolean {
    return this.node.classList.contains('on');
  }

  hide(): void {
    this.node.classList.remove('on');
    this.selected = null;
    void this.layout;
    void this.selected;
  }
}
