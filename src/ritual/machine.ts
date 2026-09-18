/**
 * Session state machine (SPEC section 3):
 * arrive → (return) → intention → light → release → watch → goodnight.
 * Your sky and Settings are overlays and never change the state.
 * intention → arrive is the way back without lighting (review after M5).
 */
export type State = 'loading' | 'arrive' | 'return' | 'intention' | 'light' | 'release' | 'watch' | 'goodnight';

const NEXT: Record<State, readonly State[]> = {
  loading: ['arrive'],
  arrive: ['return', 'intention'],
  return: ['intention'],
  intention: ['light', 'arrive'],
  light: ['release'],
  release: ['watch'],
  watch: ['intention', 'goodnight'],
  goodnight: ['arrive'],
};

export type Transition = { from: State; to: State };

export class Machine {
  state: State = 'loading';
  private readonly listeners = new Set<(t: Transition) => void>();

  onChange(fn: (t: Transition) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  can(to: State): boolean {
    return NEXT[this.state].includes(to);
  }

  /** Move to `to`; returns false (and does nothing) when the transition is not allowed. */
  go(to: State): boolean {
    if (!this.can(to)) return false;
    const t = { from: this.state, to };
    this.state = to;
    for (const fn of this.listeners) fn(t);
    return true;
  }
}
