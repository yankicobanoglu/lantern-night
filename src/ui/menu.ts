import { COPY } from '../ritual/copy';
import { button, el } from './dom';

/** Small corner menu: Your sky and Settings, reachable at any time (SPEC section 3). */
export class Menu {
  readonly button: HTMLButtonElement;
  readonly sheet: HTMLElement;
  private open = false;

  constructor(root: HTMLElement, handlers: { onSky: () => void; onSettings: () => void }) {
    this.button = el('button', { type: 'button', class: 'corner', 'aria-label': COPY.menu.open, 'aria-expanded': 'false' }, [el('i')]);
    this.sheet = el('div', { class: 'menu-sheet panel', role: 'menu' }, [
      button(COPY.menu.sky, 'ghost small', () => {
        this.toggle(false);
        handlers.onSky();
      }, { role: 'menuitem' }),
      button(COPY.menu.settings, 'ghost small', () => {
        this.toggle(false);
        handlers.onSettings();
      }, { role: 'menuitem' }),
    ]);
    this.button.addEventListener('click', () => this.toggle());
    root.append(this.button, this.sheet);
  }

  toggle(open = !this.open): void {
    this.open = open;
    this.sheet.classList.toggle('on', open);
    this.button.setAttribute('aria-expanded', String(open));
  }

  setVisible(visible: boolean): void {
    this.button.hidden = !visible;
    if (!visible) this.toggle(false);
  }
}
