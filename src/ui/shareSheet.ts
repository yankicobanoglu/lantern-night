import { COPY } from '../ritual/copy';
import { button, el } from './dom';
import { focusFirst } from './focus';

export type ShareSheetHandlers = {
  /** Compose the image; resolves to the canvas to preview. */
  render: (includeWish: boolean) => Promise<HTMLCanvasElement>;
  /** Turn the rendered canvas into the file to share. */
  toFile: (canvas: HTMLCanvasElement) => Promise<File>;
  /**
   * Share (or download) the prepared file. Called synchronously from the tap:
   * iOS only opens its share sheet inside the user gesture.
   */
  share: (file: File) => void;
  onClose: () => void;
};

/**
 * Share sheet (SPEC section 4, Share): a preview of the image, the "Include
 * my wish" switch (default off, only when there is a wish) and the button.
 */
export class ShareSheet {
  readonly node: HTMLElement;
  private readonly preview: HTMLImageElement;
  private readonly toggle: HTMLButtonElement;
  private readonly toggleRow: HTMLElement;
  private readonly shareBtn: HTMLButtonElement;
  private file: File | null = null;
  private wish: string | null = null;
  private renderId = 0;

  constructor(root: HTMLElement, private readonly handlers: ShareSheetHandlers) {
    this.preview = el('img', { class: 'share-preview', alt: 'Preview of your sky', draggable: false });
    this.toggle = el('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': 'false', 'aria-label': COPY.share.includeWish });
    this.toggle.addEventListener('click', () => {
      const on = this.toggle.getAttribute('aria-checked') !== 'true';
      this.toggle.setAttribute('aria-checked', String(on));
      void this.refresh();
    });
    this.toggleRow = el('div', { class: 'setting' }, [el('span', { class: 'label', text: COPY.share.includeWish }), this.toggle]);
    this.shareBtn = button(COPY.share.button, 'primary small', () => this.doShare(), { 'data-action': 'share' });
    this.node = el('section', { class: 'overlay share', 'aria-label': COPY.share.button, role: 'dialog' }, [
      el('div', { class: 'sheet panel' }, [
        el('h2', { text: COPY.share.button }),
        el('div', { class: 'share-frame' }, [this.preview]),
        this.toggleRow,
        el('div', { class: 'row' }, [this.shareBtn, button(COPY.settings.close, 'ghost small', () => handlers.onClose())]),
      ]),
    ]);
    root.append(this.node);
  }

  get includeWish(): boolean {
    return this.wish !== null && this.toggle.getAttribute('aria-checked') === 'true';
  }

  private async refresh(): Promise<void> {
    const id = ++this.renderId;
    this.shareBtn.disabled = true;
    this.node.classList.add('busy');
    try {
      const canvas = await this.handlers.render(this.includeWish);
      if (id !== this.renderId) return;
      this.preview.src = canvas.toDataURL('image/png');
      const file = await this.handlers.toFile(canvas);
      if (id !== this.renderId) return;
      this.file = file;
    } finally {
      if (id === this.renderId) {
        this.shareBtn.disabled = false;
        this.node.classList.remove('busy');
      }
    }
  }

  private doShare(): void {
    if (!this.file) return;
    this.handlers.share(this.file);
  }

  /** Open with the wish that may be included (null: the toggle is not offered). */
  open(wish: string | null): void {
    this.wish = wish;
    this.toggle.setAttribute('aria-checked', 'false');
    this.toggleRow.hidden = wish === null;
    this.preview.removeAttribute('src');
    this.file = null;
    this.node.classList.add('on');
    void this.refresh();
    focusFirst(this.node);
  }

  get isOpen(): boolean {
    return this.node.classList.contains('on');
  }

  hide(): void {
    this.node.classList.remove('on');
    this.renderId++;
    this.file = null;
  }
}
