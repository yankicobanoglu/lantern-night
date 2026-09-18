import type { MotionLevel } from '../engine/motion';
import { COPY } from '../ritual/copy';
import { SCENE_KINDS, type SceneKind } from '../scene/field';
import type { Settings } from '../store/types';
import { button, el } from './dom';
import { focusFirst } from './focus';

export type SettingsHandlers = {
  onChange: (patch: Partial<Settings>) => void;
  onSave: () => void;
  onRestore: (file: File) => void;
  onClear: () => void;
  onClose: () => void;
};

/** Settings sheet (SPEC section 4, Settings; the Scene row is ROADMAP 4.1). */
export class SettingsSheet {
  readonly node: HTMLElement;
  private readonly sound: HTMLButtonElement;
  private readonly motion: HTMLButtonElement;
  private readonly sizes: HTMLButtonElement[];
  private readonly scenes: HTMLButtonElement[];
  private readonly confirm: HTMLElement;
  private readonly file: HTMLInputElement;

  constructor(root: HTMLElement, private readonly handlers: SettingsHandlers) {
    const sw = (label: string, onToggle: (on: boolean) => void): HTMLButtonElement => {
      const b = el('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': 'false', 'aria-label': label });
      b.addEventListener('click', () => {
        const on = b.getAttribute('aria-checked') !== 'true';
        b.setAttribute('aria-checked', String(on));
        onToggle(on);
      });
      return b;
    };
    this.sound = sw(COPY.settings.sound, (on) => handlers.onChange({ sound: on }));
    this.motion = sw(COPY.settings.motion, (on) => handlers.onChange({ motion: on ? 'gentle' : 'full' }));
    this.sizes = ([1, 1.15, 1.3] as const).map((scale) =>
      button('A', 'ghost', () => {
        handlers.onChange({ textScale: scale });
        this.markSize(scale);
      }, { 'aria-label': `${COPY.settings.textSize} ${scale === 1 ? 'normal' : scale === 1.15 ? 'larger' : 'largest'}`, 'aria-pressed': 'false' }),
    );
    this.scenes = SCENE_KINDS.map((kind) =>
      button(COPY.settings.scenes[kind], 'ghost small', () => {
        handlers.onChange({ scene: kind });
        this.markScene(kind);
      }, { 'aria-pressed': 'false', 'data-scene': kind }),
    );
    this.file = el('input', { type: 'file', class: 'file', accept: '.json,application/json', 'aria-label': COPY.settings.restore, tabindex: -1 });
    this.file.addEventListener('change', () => {
      const f = this.file.files?.[0];
      this.file.value = '';
      if (f) handlers.onRestore(f);
    });
    this.confirm = el('div', { class: 'confirm', hidden: true, role: 'alertdialog', 'aria-label': COPY.settings.clear }, [
      el('p', { class: 'line', text: COPY.settings.confirmClear }),
      el('div', { class: 'row' }, [
        button(COPY.settings.keep, 'ghost small', () => {
          this.confirm.hidden = true;
          focusFirst(this.node);
        }),
        button(COPY.settings.clear, 'primary small', () => {
          this.confirm.hidden = true;
          handlers.onClear();
        }),
      ]),
    ]);
    const row = (label: string, control: HTMLElement): HTMLElement =>
      el('div', { class: 'setting' }, [el('span', { class: 'label', text: label }), control]);
    this.node = el('section', { class: 'overlay settings', 'aria-label': COPY.settings.heading }, [
      el('div', { class: 'sheet panel' }, [
        el('h2', { text: COPY.settings.heading }),
        row(COPY.settings.sound, this.sound),
        row(COPY.settings.motion, this.motion),
        row(COPY.settings.textSize, el('div', { class: 'sizes' }, this.sizes)),
        row(COPY.settings.scene, el('div', { class: 'scenes', role: 'group', 'aria-label': COPY.settings.scene }, this.scenes)),
        el('p', { class: 'line muted', text: COPY.settings.backupHelper }),
        el('div', { class: 'row' }, [
          button(COPY.settings.save, 'ghost small', () => handlers.onSave()),
          button(COPY.settings.restore, 'ghost small', () => this.file.click()),
          this.file,
        ]),
        el('div', { class: 'row' }, [
          button(COPY.settings.clear, 'ghost small', () => {
            this.confirm.hidden = false;
            focusFirst(this.confirm);
          }),
        ]),
        this.confirm,
        el('div', { class: 'row' }, [button(COPY.settings.close, 'primary small', () => handlers.onClose())]),
        el('p', { class: 'legal', text: COPY.settings.legal }),
      ]),
    ]);
    this.node.addEventListener('click', (e) => {
      if (e.target === this.node) handlers.onClose();
    });
    root.append(this.node);
  }

  private markSize(scale: number): void {
    const scales = [1, 1.15, 1.3];
    this.sizes.forEach((b, i) => b.setAttribute('aria-pressed', String(scales[i] === scale)));
  }

  private markScene(kind: SceneKind): void {
    this.scenes.forEach((b, i) => b.setAttribute('aria-pressed', String(SCENE_KINDS[i] === kind)));
  }

  show(settings: Settings, effectiveMotion: MotionLevel): void {
    this.sound.setAttribute('aria-checked', String(settings.sound));
    this.motion.setAttribute('aria-checked', String(effectiveMotion === 'gentle'));
    this.markSize(settings.textScale);
    this.markScene(settings.scene);
    this.confirm.hidden = true;
    this.node.classList.add('on');
    focusFirst(this.node);
    void this.handlers;
  }

  /** The mute toggle changed the setting: keep the switch in step. */
  setSound(on: boolean): void {
    this.sound.setAttribute('aria-checked', String(on));
  }

  /** The scene in use (a `?scene=` pin can differ from the stored one): keep the choice in step. */
  setScene(kind: SceneKind): void {
    this.markScene(kind);
  }

  get isOpen(): boolean {
    return this.node.classList.contains('on');
  }

  hide(): void {
    this.node.classList.remove('on');
  }
}
