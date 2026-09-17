import { arriveLine, COPY, moonBanner } from '../ritual/copy';
import type { MoonKind } from '../ritual/moonPhase';
import { button, el } from './dom';
import { focusFirst } from './focus';

/** Arrive screen (SPEC section 3, step 1): title, welcome line, moon banner, Begin. */
export class ArriveScreen {
  readonly node: HTMLElement;
  private readonly title: HTMLElement;
  private readonly line: HTMLElement;
  private readonly banner: HTMLElement;

  constructor(root: HTMLElement, onBegin: () => void) {
    this.title = el('h1', { class: 'title', text: COPY.title });
    this.line = el('p', { class: 'line' });
    this.banner = el('p', { class: 'banner', hidden: true });
    this.node = el('section', { class: 'screen arrive', 'aria-label': 'Arrive' }, [
      el('div', { class: 'panel' }, [this.line, this.banner, el('div', { class: 'row' }, [button(COPY.arrive.begin, 'primary', onBegin)])]),
    ]);
    root.append(this.title, this.node);
  }

  show(hasLanterns: boolean, moon: MoonKind): void {
    this.line.textContent = arriveLine(hasLanterns);
    const b = moonBanner(moon);
    this.banner.hidden = b === null;
    this.banner.textContent = b ?? '';
    this.node.classList.add('on');
    this.title.classList.add('on');
    focusFirst(this.node);
  }

  hide(): void {
    this.node.classList.remove('on');
    this.title.classList.remove('on');
  }
}
