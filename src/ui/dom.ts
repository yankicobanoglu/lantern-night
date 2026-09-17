/** Tiny DOM helpers: no framework (SPEC section 8). */
export type Attrs = Record<string, string | number | boolean | undefined>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') node.className = String(v);
    else if (k === 'text') node.textContent = String(v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) node.append(c);
  return node;
}

export function button(text: string, cls: string, onClick: () => void, attrs: Attrs = {}): HTMLButtonElement {
  const b = el('button', { type: 'button', class: `btn ${cls}`, text, ...attrs });
  b.addEventListener('click', onClick);
  return b;
}

/** Cross-fade a line of text in place. */
export function crossFade(node: HTMLElement, text: string, ms = 260): void {
  if (node.textContent === text) return;
  if (!node.textContent) {
    node.textContent = text;
    return;
  }
  node.style.transition = `opacity ${ms}ms ease`;
  node.style.opacity = '0';
  window.setTimeout(() => {
    node.textContent = text;
    node.style.opacity = '';
  }, ms);
}

/** Short human date for the return card and the sky cards: "18 August 2026". */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}
