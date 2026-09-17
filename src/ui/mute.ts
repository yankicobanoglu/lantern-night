import { COPY } from '../ritual/copy';
import { el } from './dom';

const NS = 'http://www.w3.org/2000/svg';

/** A small speaker glyph drawn in code; the wave arcs hide when muted. */
function glyph(): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '22');
  svg.setAttribute('height', '22');
  svg.setAttribute('aria-hidden', 'true');
  const body = document.createElementNS(NS, 'path');
  body.setAttribute('d', 'M4 9v6h4l5 4V5L8 9H4z');
  body.setAttribute('fill', 'currentColor');
  const w1 = document.createElementNS(NS, 'path');
  w1.setAttribute('d', 'M16 9.5a3.5 3.5 0 0 1 0 5');
  const w2 = document.createElementNS(NS, 'path');
  w2.setAttribute('d', 'M18.5 7a7 7 0 0 1 0 10');
  for (const w of [w1, w2]) {
    w.setAttribute('class', 'wave');
    w.setAttribute('fill', 'none');
    w.setAttribute('stroke', 'currentColor');
    w.setAttribute('stroke-width', '1.8');
    w.setAttribute('stroke-linecap', 'round');
  }
  const slash = document.createElementNS(NS, 'path');
  slash.setAttribute('class', 'slash');
  slash.setAttribute('d', 'M15.5 9.5l5 5m0-5l-5 5');
  slash.setAttribute('fill', 'none');
  slash.setAttribute('stroke', 'currentColor');
  slash.setAttribute('stroke-width', '1.8');
  slash.setAttribute('stroke-linecap', 'round');
  svg.append(body, w1, w2, slash);
  return svg;
}

/** The always-visible mute toggle (SPEC section 7, Sound). */
export class MuteButton {
  readonly node: HTMLButtonElement;

  constructor(root: HTMLElement, onToggle: (on: boolean) => void) {
    this.node = el('button', { type: 'button', class: 'corner mute', 'aria-pressed': 'true', 'aria-label': COPY.settings.soundOn });
    this.node.append(glyph());
    this.node.addEventListener('click', () => onToggle(this.node.getAttribute('aria-pressed') !== 'true'));
    root.append(this.node);
  }

  set(on: boolean): void {
    this.node.setAttribute('aria-pressed', String(on));
    this.node.setAttribute('aria-label', on ? COPY.settings.soundOn : COPY.settings.soundOff);
    this.node.classList.toggle('off', !on);
  }
}
