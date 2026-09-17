import { describe, expect, it } from 'vitest';
import { detectInstall, shouldShowInstallHint, type InstallEnv } from '../../src/ui/install';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const CHROME_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0 Mobile/15E148 Safari/604.1';
const CHROME_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

const env = (over: Partial<InstallEnv>): InstallEnv => ({
  ua: CHROME_DESKTOP,
  standalone: undefined,
  maxTouchPoints: 0,
  displayStandalone: false,
  hasPrompt: false,
  ...over,
});

describe('install detection', () => {
  it('iPhone Safari in the browser gets the home-screen hint', () => {
    expect(detectInstall(env({ ua: IPHONE, standalone: false, maxTouchPoints: 5 }))).toBe('ios');
  });

  it('iPadOS Safari (Mac user agent, touch) gets the home-screen hint', () => {
    expect(detectInstall(env({ ua: IPAD_AS_MAC, standalone: false, maxTouchPoints: 5 }))).toBe('ios');
  });

  it('a real Mac is not iOS', () => {
    expect(detectInstall(env({ ua: IPAD_AS_MAC, standalone: undefined, maxTouchPoints: 0 }))).toBe('none');
  });

  it('installed (home screen or standalone) shows nothing', () => {
    expect(detectInstall(env({ ua: IPHONE, standalone: true, maxTouchPoints: 5 }))).toBe('installed');
    expect(detectInstall(env({ displayStandalone: true, hasPrompt: true }))).toBe('installed');
  });

  it('Chrome on iOS cannot add to the home screen the Safari way', () => {
    expect(detectInstall(env({ ua: CHROME_IOS, standalone: false, maxTouchPoints: 5 }))).toBe('none');
  });

  it('other browsers use the install prompt only when they offered one', () => {
    expect(detectInstall(env({ hasPrompt: true }))).toBe('prompt');
    expect(detectInstall(env({ hasPrompt: false }))).toBe('none');
  });
});

describe('install hint schedule', () => {
  it('shows on the first visit, then once more on the third', () => {
    expect(shouldShowInstallHint(1, 0)).toBe(true);
    expect(shouldShowInstallHint(2, 1)).toBe(false);
    expect(shouldShowInstallHint(3, 1)).toBe(true);
    expect(shouldShowInstallHint(4, 2)).toBe(false);
    expect(shouldShowInstallHint(30, 2)).toBe(false);
  });

  it('never repeats a shown hint in the same visit', () => {
    expect(shouldShowInstallHint(1, 1)).toBe(false);
    expect(shouldShowInstallHint(3, 2)).toBe(false);
  });
});
