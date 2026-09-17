import { clampText, COPY, intentionCopy, MAX_TEXT, type Mode } from '../ritual/copy';
import { button, el } from './dom';

/**
 * Intention screen (SPEC section 3, step 3): mode toggle, heading, one field
 * capped at 120 characters, prompt chips, Fold my lantern.
 */
export class IntentionScreen {
  readonly node: HTMLElement;
  mode: Mode = 'wish';
  private readonly heading: HTMLElement;
  private readonly field: HTMLTextAreaElement;
  private readonly helper: HTMLElement;
  private readonly counter: HTMLElement;
  private readonly chips: HTMLElement;
  private readonly wishBtn: HTMLButtonElement;
  private readonly letGoBtn: HTMLButtonElement;
  private readonly foldBtn: HTMLButtonElement;
  private lastChip: string | null = null;

  constructor(root: HTMLElement, onFold: (mode: Mode, text: string) => void) {
    this.heading = el('h2', { class: 'heading' });
    this.field = el('textarea', {
      class: 'field',
      rows: 2,
      maxlength: MAX_TEXT,
      'aria-label': 'Your intention',
      autocomplete: 'off',
      autocapitalize: 'sentences',
      enterkeyhint: 'done',
    });
    this.helper = el('p', { class: 'line muted' });
    this.counter = el('p', { class: 'counter', 'aria-hidden': 'true' });
    this.chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Prompts' });
    this.wishBtn = button(COPY.intention.modeWish, 'ghost small', () => this.setMode('wish'), { 'aria-pressed': 'true' });
    this.letGoBtn = button(COPY.intention.modeLetGo, 'ghost small', () => this.setMode('let-go'), { 'aria-pressed': 'false' });
    this.foldBtn = button(COPY.intention.fold, 'primary', () => {
      const text = clampText(this.field.value);
      if (!text) return;
      onFold(this.mode, text);
    });
    this.field.addEventListener('input', () => this.onInput());
    this.field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.field.blur();
      }
    });
    this.node = el('section', { class: 'screen intention', 'aria-label': 'Intention' }, [
      el('div', { class: 'panel' }, [
        el('div', { class: 'row', role: 'group', 'aria-label': 'Mode' }, [this.wishBtn, this.letGoBtn]),
        this.heading,
        this.field,
        this.counter,
        this.helper,
        this.chips,
        el('div', { class: 'row' }, [this.foldBtn]),
      ]),
    ]);
    root.append(this.node);
    this.setMode('wish');
  }

  get text(): string {
    return clampText(this.field.value);
  }

  setMode(mode: Mode): void {
    this.mode = mode;
    const c = intentionCopy(mode);
    this.heading.textContent = c.heading;
    this.field.placeholder = c.placeholder;
    this.helper.textContent = c.helper;
    this.wishBtn.setAttribute('aria-pressed', String(mode === 'wish'));
    this.letGoBtn.setAttribute('aria-pressed', String(mode === 'let-go'));
    this.chips.replaceChildren(
      ...c.chips.map((chip) => {
        const b = el('button', { type: 'button', class: 'chip', text: chip });
        b.addEventListener('click', () => this.useChip(chip));
        return b;
      }),
    );
    // A chip from the other mode shouldn't linger in the field.
    if (this.lastChip && this.field.value.trim() === this.lastChip) this.field.value = '';
    this.lastChip = null;
    this.onInput();
  }

  /**
   * A chip replaces an empty field or another chip's text, otherwise it is
   * appended. Its trailing ellipsis is dropped so the sentence continues.
   */
  private useChip(chip: string): void {
    const starter = chip.replace(/…$/, '');
    const current = this.field.value;
    const startsFresh = current.trim() === '' || current.trim() === this.lastChip;
    this.field.value = clampText(startsFresh ? starter : `${current.trimEnd()} ${starter}`) + ' ';
    this.lastChip = this.field.value.trim();
    this.onInput();
    this.field.focus();
    this.field.setSelectionRange(this.field.value.length, this.field.value.length);
  }

  private onInput(): void {
    const n = Array.from(this.field.value).length;
    this.counter.textContent = `${n} / ${MAX_TEXT}`;
    this.foldBtn.disabled = this.field.value.trim().length === 0;
  }

  show(mode: Mode): void {
    this.setMode(mode);
    this.field.value = '';
    this.lastChip = null;
    this.onInput();
    this.node.classList.add('on');
  }

  hide(): void {
    this.field.blur();
    this.field.value = '';
    this.node.classList.remove('on');
  }
}
