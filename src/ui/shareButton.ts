import { COPY } from '../ritual/copy';
import { el } from './dom';

const NS = 'http://www.w3.org/2000/svg';

/**
 * A lantern rising out of an open box, drawn in code like the speaker glyph:
 * the share idiom (something leaving a container) and this app's own image at
 * once.
 */
function glyph(): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '22');
  svg.setAttribute('height', '22');
  svg.setAttribute('aria-hidden', 'true');
  // The open box: two sides and a floor, left open at the top for the lantern.
  const box = document.createElementNS(NS, 'path');
  box.setAttribute('d', 'M5 13v6h14v-6');
  box.setAttribute('fill', 'none');
  box.setAttribute('stroke', 'currentColor');
  box.setAttribute('stroke-width', '1.8');
  box.setAttribute('stroke-linecap', 'round');
  box.setAttribute('stroke-linejoin', 'round');
  // The lantern's body, rising.
  const body = document.createElementNS(NS, 'path');
  body.setAttribute('d', 'M9.5 7.5h5l-.7 5h-3.6z');
  body.setAttribute('fill', 'currentColor');
  // Its flame above the rim.
  const flame = document.createElementNS(NS, 'path');
  flame.setAttribute('d', 'M12 2.6l1.4 2.1a1.7 1.7 0 1 1-2.8 0z');
  flame.setAttribute('fill', 'currentColor');
  svg.append(box, body, flame);
  return svg;
}

/**
 * The corner share button (M7). Sharing left the watch row so Light another and
 * Goodnight could sit together; it lives here beside the mute toggle instead,
 * reachable at any point in the evening.
 */
export class ShareButton {
  readonly node: HTMLButtonElement;
  readonly hint: HTMLElement;
  private timer = 0;

  constructor(root: HTMLElement, onShare: () => void) {
    this.node = el('button', { type: 'button', class: 'corner share-sky', 'aria-label': COPY.share.button });
    this.node.append(glyph());
    this.node.addEventListener('click', () => onShare());
    // One line of plain text under the button, no panel: it points, it does not announce.
    this.hint = el('p', { class: 'corner-hint', role: 'status', 'aria-live': 'polite' });
    root.append(this.node, this.hint);
  }

  /** The one-time hint after the first lantern has risen. */
  showHint(ms = 7000): void {
    window.clearTimeout(this.timer);
    this.hint.textContent = COPY.share.hint;
    this.hint.classList.add('on');
    this.timer = window.setTimeout(() => this.hideHint(), ms);
  }

  hideHint(): void {
    this.hint.classList.remove('on');
  }
}
