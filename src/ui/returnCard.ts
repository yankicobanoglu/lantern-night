import { COPY } from '../ritual/copy';
import type { Lantern, LanternStatus } from '../store/types';
import { button, el, formatDate } from './dom';
import { focusFirst } from './focus';

export type ReturnAnswer = Exclude<LanternStatus, 'rising'>;

/** Return card (SPEC section 3, step 2): a lantern drifts back to visit. */
export class ReturnScreen {
  readonly node: HTMLElement;
  private readonly heading: HTMLElement;
  private readonly quote: HTMLElement;
  private readonly question: HTMLElement;
  private readonly options: HTMLElement;
  private readonly continueRow: HTMLElement;
  private lantern: Lantern | null = null;

  constructor(root: HTMLElement, onAnswer: (lantern: Lantern, answer: ReturnAnswer) => void, onContinue: () => void) {
    this.heading = el('h2', { class: 'heading' });
    this.quote = el('p', { class: 'quote' });
    this.question = el('p', { class: 'line', role: 'status', 'aria-live': 'polite' });
    this.options = el('div', { class: 'row' });
    for (const key of ['came-true', 'still-growing', 'let-go'] as const) {
      this.options.append(
        button(COPY.return.options[key].label, 'ghost small', () => {
          if (!this.lantern) return;
          this.question.textContent = COPY.return.options[key].reply;
          this.options.hidden = true;
          this.continueRow.hidden = false;
          focusFirst(this.continueRow);
          onAnswer(this.lantern, key);
        }),
      );
    }
    this.continueRow = el('div', { class: 'row', hidden: true }, [button(COPY.return.continue, 'primary', onContinue)]);
    this.node = el('section', { class: 'screen return', 'aria-label': 'A lantern returns' }, [
      el('div', { class: 'panel' }, [this.heading, this.quote, this.question, this.options, this.continueRow]),
    ]);
    root.append(this.node);
  }

  show(lantern: Lantern): void {
    this.lantern = lantern;
    this.heading.textContent = COPY.return.heading(formatDate(lantern.createdAt));
    this.quote.textContent = lantern.text;
    this.question.textContent = COPY.return.question;
    this.options.hidden = false;
    this.continueRow.hidden = true;
    this.node.classList.add('on');
    focusFirst(this.node);
  }

  hide(): void {
    this.node.classList.remove('on');
    this.lantern = null;
  }
}
