import { COPY } from '../ritual/copy';
import { button, el } from './dom';
import { focusFirst } from './focus';

export type ShareSheetHandlers = {
  /** Compose the image; resolves to the canvas to preview. */
  render: (includeWish: boolean) => Promise<HTMLCanvasElement>;
  /** Share (or download) the canvas last rendered. */
  share: (canvas: HTMLCanvasElement) => Promise<void>;
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
  private canvas: HTMLCanvasElement | null = null;
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
    this.shareBtn = button(COPY.share.button, 'primary small', () => void this.doShare(), { 'data-action': 'share' });
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
      this.canvas = canvas;
      this.preview.src = canvas.toDataURL('image/png');
    } finally {
      if (id === this.renderId) {
        this.shareBtn.disabled = false;
        this.node.classList.remove('busy');
      }
    }
  }

  private async doShare(): Promise<void> {
    if (!this.canvas) return;
    this.shareBtn.disabled = true;
    try {
      await this.handlers.share(this.canvas);
    } finally {
      this.shareBtn.disabled = false;
    }
  }

  /** Open with the wish that may be included (null: the toggle is not offered). */
  open(wish: string | null): void {
    this.wish = wish;
    this.toggle.setAttribute('aria-checked', 'false');
    this.toggleRow.hidden = wish === null;
    this.preview.removeAttribute('src');
    this.canvas = null;
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
    this.canvas = null;
  }
}
