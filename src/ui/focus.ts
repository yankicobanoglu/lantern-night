const FOCUSABLE = 'button:not([hidden]):not(:disabled), textarea:not([hidden]), input:not([type="file"]):not([hidden]), [tabindex="0"]';

/**
 * Move keyboard focus to the first control of a screen that just appeared, so
 * a keyboard-only run never has to hunt for it (SPEC section 8, Accessibility).
 * Waits a frame so the screen's visibility transition has started.
 */
export function focusFirst(container: HTMLElement): void {
  requestAnimationFrame(() => {
    const first = container.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus({ preventScroll: true });
  });
}

/** Focus one element (if it exists and is enabled) without scrolling. */
export function focusNode(node: HTMLElement | null): void {
  if (!node) return;
  requestAnimationFrame(() => node.focus({ preventScroll: true }));
}
