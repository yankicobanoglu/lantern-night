import { COPY } from '../ritual/copy';
import { button, el } from './dom';

export type InstallPath = 'ios' | 'prompt' | 'installed' | 'none';

export type InstallEnv = {
  ua: string;
  /** iOS Safari sets navigator.standalone; other browsers leave it undefined. */
  standalone: boolean | undefined;
  maxTouchPoints: number;
  /** (display-mode: standalone) */
  displayStandalone: boolean;
  /** A beforeinstallprompt event has been captured. */
  hasPrompt: boolean;
};

/**
 * Which install hint applies (SPEC section 4, System messages). iPadOS Safari
 * reports a Mac user agent, so touch points decide there.
 */
export function detectInstall(env: InstallEnv): InstallPath {
  if (env.displayStandalone || env.standalone === true) return 'installed';
  const ios = /iPhone|iPad|iPod/.test(env.ua) || (/Macintosh/.test(env.ua) && env.maxTouchPoints > 1);
  const safari = /Safari/.test(env.ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(env.ua);
  if (ios && safari && env.standalone === false) return 'ios';
  if (env.hasPrompt) return 'prompt';
  return 'none';
}

/**
 * The hint shows on the first visit right after the first lantern has risen,
 * then once more on the third visit if still not installed.
 */
export function shouldShowInstallHint(sessions: number, installHintCount: number): boolean {
  return (sessions === 1 && installHintCount === 0) || (sessions === 3 && installHintCount === 1);
}

export type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }> };

/** Capture beforeinstallprompt so the Install button can show it later. */
export function captureInstallPrompt(): { get: () => BeforeInstallPromptEvent | null } {
  let deferred: BeforeInstallPromptEvent | null = null;
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferred = e as BeforeInstallPromptEvent;
    });
    window.addEventListener('appinstalled', () => {
      deferred = null;
    });
  }
  return { get: () => deferred };
}

export function readInstallEnv(hasPrompt: boolean): InstallEnv {
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    ua: navigator.userAgent,
    standalone: nav.standalone,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    displayStandalone: typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches,
    hasPrompt,
  };
}

/** The install hint panel near the top: a line of copy, and Install where the browser can. */
export class InstallHint {
  readonly node: HTMLElement;
  private readonly line: HTMLElement;
  private readonly installBtn: HTMLButtonElement;
  private timer = 0;

  constructor(root: HTMLElement, onInstall: () => void) {
    this.line = el('p', { class: 'line' });
    this.installBtn = button(COPY.system.install, 'primary small', () => {
      onInstall();
      this.hide();
    });
    this.node = el('div', { class: 'install panel', role: 'status', 'aria-live': 'polite' }, [
      this.line,
      el('div', { class: 'row' }, [this.installBtn, button(COPY.settings.close, 'ghost small', () => this.hide())]),
    ]);
    root.append(this.node);
  }

  show(path: 'ios' | 'prompt'): void {
    window.clearTimeout(this.timer);
    this.line.textContent = path === 'ios' ? COPY.system.installIos : COPY.system.installOther;
    this.installBtn.hidden = path !== 'prompt';
    this.node.classList.add('on');
    // The iOS line has nothing to press; it goes on its own after a while.
    if (path === 'ios') this.timer = window.setTimeout(() => this.hide(), 16_000);
  }

  get isOpen(): boolean {
    return this.node.classList.contains('on');
  }

  hide(): void {
    window.clearTimeout(this.timer);
    this.node.classList.remove('on');
  }
}
