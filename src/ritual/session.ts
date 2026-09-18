import type { Renderer } from 'pixi.js';
import { LIGHT_ARC_S, siteUrl, STAR_FIRST_SESSION_MAX_S, STAR_INTERVAL_MAX_S, STAR_INTERVAL_MIN_S } from '../config';
import type { AudioEngine } from '../audio/engine';
import type { Layout } from '../engine/layout';
import type { MotionLevel } from '../engine/motion';
import { createRng } from '../engine/rng';
import { fieldToArt, lanternKindOf, type LanternKind } from '../scene/field';
import type { Lantern as SceneLantern } from '../scene/lantern';
import type { Scene } from '../scene/scene';
import { pickStarPath, type StarAvoid } from '../scene/shootingStar';
import { canvasToBlob, composeShareCanvas, shareFileName } from '../share/compose';
import { shareOrDownload } from '../share/share';
import { backupFileName, parseBackup, serializeBackup } from '../store/backup';
import type { Store } from '../store/store';
import type { Lantern, Settings } from '../store/types';
import { ArriveScreen } from '../ui/arrive';
import { el } from '../ui/dom';
import { focusNode } from '../ui/focus';
import { detectInstall, InstallHint, readInstallEnv, shouldShowInstallHint, type BeforeInstallPromptEvent, type InstallPath } from '../ui/install';
import { IntentionScreen } from '../ui/intention';
import { LightUi } from '../ui/lightUi';
import { Menu } from '../ui/menu';
import { MoonLabel } from '../ui/moonLabel';
import { MuteButton } from '../ui/mute';
import { ReturnScreen, type ReturnAnswer } from '../ui/returnCard';
import { SettingsSheet } from '../ui/settings';
import { ShareButton } from '../ui/shareButton';
import { ShareSheet } from '../ui/shareSheet';
import { SkyView, type SkyEntry } from '../ui/skyView';
import { StarUi } from '../ui/starUi';
import { Toast } from '../ui/toast';
import { COPY, defaultMode, type Mode } from './copy';
import { HoldController } from './hold';
import { Machine, type State } from './machine';
import { moonAge, moonKind } from './moonPhase';
import { meteorShower, starRate } from './nightEvents';

export type SessionDeps = {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  /** The world. Both kinds of lantern live in it at once (M7). */
  scene: Scene;
  store: Store;
  audio: AudioEngine;
  renderer: Renderer;
  layout: () => Layout;
  now: () => Date;
  /** ?motion= override for tests. */
  motionOverride: MotionLevel | null;
  /** ?star=now: the first shooting star comes right away. */
  starNow: boolean;
  /** ?install=ios|prompt forces an install path (tests). */
  installForce: 'ios' | 'prompt' | null;
  /** ?evening=0..1 pins the session light arc (tests, screenshots); null lets it run on the session clock. */
  evening: number | null;
  /** The captured beforeinstallprompt event, if the browser offered one. */
  installPrompt: () => BeforeInstallPromptEvent | null;
  seed: number;
  /** ?scene=sky|water pins the kind the wish screen starts on (tests); null follows the last choice. */
  sceneOverride: LanternKind | null;
};

/**
 * The ritual (SPEC section 3): wires the state machine to the store, the
 * scene, the soundscape and the DOM screens. Overlays (Your sky, Settings,
 * Share, moon label, shooting star) sit beside the state and never change it.
 */
export class Session {
  readonly machine = new Machine();
  readonly hold: HoldController;
  mode: Mode = 'wish';
  /** The lantern released most recently (for the watch rule and the caption). */
  released: SceneLantern | null = null;
  /** The wish text released most recently (wish mode only), offered to the share sheet. */
  private lastWish: string | null = null;
  private watchShown = false;
  private readonly arrive: ArriveScreen;
  private readonly returnCard: ReturnScreen;
  private readonly intention: IntentionScreen;
  private readonly lightUi: LightUi;
  private readonly skyView: SkyView;
  private readonly settings: SettingsSheet;
  private readonly share: ShareSheet;
  readonly menu: Menu;
  private readonly mute: MuteButton;
  private readonly shareButton: ShareButton;
  private readonly moon: MoonLabel;
  private readonly toast: Toast;
  private readonly starUi: StarUi;
  private readonly installHint: InstallHint;
  private readonly veil: HTMLElement;
  private readonly goodnightLine: HTMLElement;
  private readonly rng;
  private nextStarIn = Infinity;
  private goodnightAt = 0;
  private installShownThisSession = false;
  private starWasActive = false;
  private fieldFocusedAtDown = false;
  /** Session clock for the light arc, in scene time (speed applies). */
  private sessionMs = 0;
  /** Shooting-star frequency factor tonight (ROADMAP 4.6): 1, or a meteor shower's rate. */
  private starRate = 1;
  /** The last interval the session scheduled (test hook). */
  private lastStarInterval = NaN;

  /** The world. One scene for the whole session; both kinds live in it. */
  private get scene(): Scene {
    return this.deps.scene;
  }

  /** The kind the next lantern will be (M7): chosen on the wish screen, remembered for the next one. */
  private kind: LanternKind = 'sky';

  constructor(private readonly deps: SessionDeps) {
    const { root, audio } = deps;
    this.rng = createRng(deps.seed ^ 0x5bd1e995);
    root.dataset['state'] = 'loading';
    if (deps.evening !== null) this.scene.setEvening(deps.evening);

    this.hold = new HoldController(deps.canvas, {
      onFill: (fill, holding) => {
        const l = this.scene.resting;
        if (l) l.fill = fill;
        this.lightUi.holding(holding);
        audio.setFlame(fill);
      },
      onLit: () => {
        const l = this.scene.resting;
        if (l) {
          l.fill = 1;
          l.phase = 'lit';
        }
        this.lightUi.lit();
        audio.lit();
      },
      onRelease: () => void this.release(),
    });

    this.lightUi = new LightUi(root, this.motion(), {
      onLightTap: () => this.hold.lightByTap(),
      onRelease: () => this.hold.releaseNow(),
      onAnother: () => this.lightAnother(),
      onGoodnight: () => this.goodnight(),
    });
    this.arrive = new ArriveScreen(root, () => this.begin());
    this.returnCard = new ReturnScreen(
      root,
      (l, answer) => void this.answerReturn(l, answer),
      () => this.showIntention(),
    );
    this.intention = new IntentionScreen(root, (mode, text, kind) => this.fold(mode, text, kind));
    this.veil = el('div', { class: 'veil', role: 'button', tabindex: -1, 'aria-label': 'Back to the start' });
    this.goodnightLine = el('p', { class: 'goodnight-line', role: 'status', 'aria-live': 'polite' });
    const leaveGoodnight = (): void => {
      if (this.machine.state === 'goodnight' && performance.now() >= this.goodnightAt) this.backToArrive();
    };
    this.veil.addEventListener('click', leaveGoodnight);
    this.veil.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        leaveGoodnight();
      }
    });
    root.append(this.veil, this.goodnightLine);
    // Intention: a tap on the empty scene goes back to the start without lighting (review after M5).
    deps.canvas.addEventListener('pointerdown', () => {
      // The field loses focus on pointerdown, before the click: remember whether the keyboard was up.
      this.fieldFocusedAtDown = document.activeElement instanceof HTMLTextAreaElement;
    });
    deps.canvas.addEventListener('click', () => this.tapOutside());
    this.skyView = new SkyView(
      root,
      () => this.closeOverlays(),
      () => this.openShare(this.skyView.selectedWish),
      (id) => {
        const rising = this.scene.rising.find((r) => this.risingId(r) === id);
        if (!rising) return null;
        const L = deps.layout();
        return { x: rising.x * L.cssScale, y: rising.y * L.cssScale };
      },
      (p, kind, L) => {
        const a = fieldToArt(p, this.scene.fieldOf(kind));
        return { x: a.x * L.cssScale, y: a.y * L.cssScale };
      },
    );
    this.settings = new SettingsSheet(root, {
      onChange: (patch) => void this.changeSettings(patch),
      onSave: () => void this.saveBackup(),
      onRestore: (file) => void this.restoreBackup(file),
      onClear: () => void this.clearSky(),
      onClose: () => this.closeOverlays(),
    });
    this.share = new ShareSheet(root, {
      render: (includeWish) => this.renderShare(includeWish ? this.shareWish : null),
      toFile: async (canvas) => new File([await canvasToBlob(canvas)], shareFileName(this.deps.now()), { type: 'image/png' }),
      share: (file) => void shareOrDownload(file, file.name, COPY.title, COPY.share.text(siteUrl())),
      onClose: () => this.closeShare(),
    });
    this.menu = new Menu(root, {
      onSky: () => {
        this.settings.hide();
        this.share.hide();
        this.skyView.show(this.skyEntries(), this.deps.layout());
        root.classList.add('overlay-open');
      },
      onSettings: () => {
        this.skyView.hide();
        this.share.hide();
        this.settings.show(this.deps.store.settings);
        root.classList.add('overlay-open');
      },
    });
    this.mute = new MuteButton(root, (on) => void this.changeSettings({ sound: on }));
    this.shareButton = new ShareButton(root, () => {
      this.shareButton.hideHint();
      this.openShare(this.lastWish);
    });
    this.moon = new MoonLabel(root, deps.now);
    this.toast = new Toast(root);
    this.starUi = new StarUi(root, (x, y) => this.tapStar(x, y));
    this.installHint = new InstallHint(root, () => void this.promptInstall());
    this.moon.place(deps.layout());

    // Escape closes whatever is on top: the share sheet, an overlay, the menu, the moon label.
    root.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.share.isOpen) this.closeShare();
      else if (this.skyView.isOpen || this.settings.isOpen) {
        this.closeOverlays();
        focusNode(this.menu.button);
      } else if (this.menu.isOpen) {
        this.menu.toggle(false);
        focusNode(this.menu.button);
      } else if (this.installHint.isOpen) this.installHint.hide();
      else return;
      e.preventDefault();
    });

    this.machine.onChange((t) => {
      root.dataset['state'] = t.to;
    });
  }

  // ---------- Settings-derived ----------

  /**
   * Motion level. Since M7 the app always runs gentle (SPEC section 7, Motion):
   * there is no setting, and `?motion=` only exists for tests. Reduced-motion
   * visitors are served by construction, since gentle is that treatment.
   */
  motion(): MotionLevel {
    return this.deps.motionOverride ?? 'gentle';
  }

  private applySettings(): void {
    const s = this.deps.store.settings;
    document.documentElement.style.setProperty('--text-scale', String(s.textScale));
    const m = this.motion();
    this.scene.setMotion(m);
    this.lightUi.setMotion(m);
    this.deps.audio.setEnabled(s.sound);
    this.mute.set(s.sound);
    this.settings.setSound(s.sound);
  }

  private async changeSettings(patch: Partial<Settings>): Promise<void> {
    await this.deps.store.saveSettings(patch).catch(() => undefined);
    this.applySettings();
  }

  // ---------- Start ----------

  async start(): Promise<void> {
    const { store } = this.deps;
    await store.load();
    this.applySettings();
    this.kind = this.deps.sceneOverride ?? lanternKindOf(store.settings.scene);
    for (const l of store.lanterns) this.scene.addLight({ id: l.id, seed: l.seed, sky: l.sky, status: l.status, kind: l.kind });
    this.machine.go('arrive');
    this.showArrive();
    if (!store.available) this.toast.show(COPY.system.storageUnavailable, 8000);
    // Shooting stars: on a first-ever session one appears within the first 60 s; a meteor shower raises the rate (ROADMAP 4.6).
    this.starRate = starRate(this.deps.now());
    const first = store.settings.sessions === 0;
    this.nextStarIn = this.deps.starNow ? 0.3 : first ? this.rng.range(12, STAR_FIRST_SESSION_MAX_S - 5) : this.starInterval();
  }

  /** Seconds until the next shooting star: the section 7 interval, divided by tonight's shower rate. */
  private starInterval(): number {
    this.lastStarInterval = this.rng.range(STAR_INTERVAL_MIN_S, STAR_INTERVAL_MAX_S) / this.starRate;
    return this.lastStarInterval;
  }

  /** Test hook: the kind the next lantern will be (M7). */
  lanternKind(): LanternKind {
    return this.kind;
  }

  /** Test hook: tonight's events. */
  night(): { shower: string | null; rate: number; supermoon: boolean } {
    return { shower: meteorShower(this.deps.now())?.name ?? null, rate: this.starRate, supermoon: this.scene.moon.isSupermoon };
  }

  /** Test hook: seconds until the next star is due, and the last interval the session scheduled. */
  starIn(): { due: number; interval: number } {
    return { due: this.nextStarIn, interval: this.lastStarInterval };
  }

  private moonNow(): ReturnType<typeof moonKind> {
    return moonKind(moonAge(this.deps.now()));
  }

  private showArrive(): void {
    this.arrive.show(this.deps.store.lanterns.length > 0, this.moonNow());
  }

  private begin(): void {
    if (this.machine.state !== 'arrive') return;
    const { store } = this.deps;
    void store.saveSettings({ sessions: store.settings.sessions + 1 }).catch(() => undefined);
    this.arrive.hide();
    // One-time hint, like the shooting star's: the evening has sound (review after M5).
    if (store.settings.sound && !store.settings.soundHintShown) {
      void store.saveSettings({ soundHintShown: true }).catch(() => undefined);
      this.toast.show(COPY.system.soundHint, 7000);
    }
    const due = store.due(this.deps.now())[0];
    if (due && this.machine.go('return')) {
      this.returnCard.show(due);
      return;
    }
    this.showIntention();
  }

  /** Id of a rising lantern in Your sky: its stored record, else a session-only id. */
  private risingId(l: SceneLantern): string {
    return l.storedId ?? `rising-${l.seed}`;
  }

  /** Every light in tonight's sky, settled or still rising, with its words when they were kept. */
  private skyEntries(): SkyEntry[] {
    const { store } = this.deps;
    const scene = this.scene;
    const byId = new Map(store.lanterns.map((l) => [l.id, l]));
    const out: SkyEntry[] = scene.allLights.map((l) => {
      const rec = l.id ? byId.get(l.id) : undefined;
      return { id: l.id ?? `night-${l.seed}`, sky: l.sky, kind: l.kind, text: rec?.text ?? null, createdAt: rec?.createdAt ?? null, status: l.status };
    });
    for (const r of scene.rising) {
      if (!r.sky) continue;
      const rec = r.storedId ? byId.get(r.storedId) : undefined;
      out.push({ id: this.risingId(r), sky: r.sky, kind: r.kind, text: rec?.text ?? r.wishText, createdAt: rec?.createdAt ?? null, status: 'rising' });
    }
    return out;
  }

  /** A tap on the scene while writing: first put the keyboard away, then go back to the start. */
  private tapOutside(): void {
    if (this.machine.state !== 'intention') return;
    if (this.skyView.isOpen || this.settings.isOpen || this.share.isOpen || this.menu.isOpen) return;
    if (this.fieldFocusedAtDown) {
      this.fieldFocusedAtDown = false;
      (document.activeElement as HTMLElement | null)?.blur?.();
      return;
    }
    if (!this.machine.go('arrive')) return;
    this.intention.hide();
    this.showArrive();
  }

  private showIntention(): void {
    if (!this.machine.go('intention')) return;
    this.returnCard.hide();
    this.lightUi.hide();
    this.mode = defaultMode(this.moonNow());
    this.intention.show(this.mode, this.kind);
  }

  private async answerReturn(l: Lantern, answer: ReturnAnswer): Promise<void> {
    const updated = await this.deps.store.answerReturn(l.id, answer, this.deps.now()).catch(() => undefined);
    if (updated) this.scene.setLightStatus(updated.id, updated.status);
  }

  // ---------- Light → release → watch ----------

  private fold(mode: Mode, text: string, kind: LanternKind): void {
    if (!this.machine.go('light')) return;
    this.mode = mode;
    this.kind = kind;
    this.intention.hide();
    // The choice is remembered as the default for the next lantern.
    if (this.deps.store.settings.scene !== kind) void this.deps.store.saveSettings({ scene: kind }).catch(() => undefined);
    this.lightUi.setKind(kind);
    const l = this.scene.lanternsOf(kind).spawnResting();
    l.wishText = text;
    this.lightUi.setWish(text);
    this.followLantern();
    this.hold.arm();
    this.lightUi.idle();
  }

  private async release(): Promise<void> {
    const { store, audio } = this.deps;
    const scene = this.scene;
    const l = scene.resting;
    if (!l || !scene.release(l) || !l.sky) return;
    this.machine.go('release');
    this.released = l;
    this.watchShown = false;
    this.lightUi.released(this.mode);
    audio.flameOff();
    audio.chime();
    this.machine.go('watch');
    this.lastWish = this.mode === 'wish' ? l.wishText : null;
    if (this.mode === 'wish') {
      try {
        const record = await store.add({ text: l.wishText ?? '', sky: l.sky, seed: l.seed, kind: l.kind, now: this.deps.now() });
        l.storedId = record.id;
        void this.requestPersistence();
      } catch {
        this.toast.show(COPY.system.storageUnavailable, 8000);
      }
    }
    // Let-go text is never stored (SPEC section 6): drop it as soon as the lantern is on its way.
    if (this.mode !== 'wish') l.wishText = null;
  }

  /** SPEC section 6: ask the browser to keep the sky after the first lantern is saved; record the answer once. */
  private async requestPersistence(): Promise<void> {
    const { store } = this.deps;
    if (store.settings.persistGranted !== null) return;
    const persist = navigator.storage?.persist;
    if (typeof persist !== 'function') return;
    try {
      const granted = await navigator.storage.persist();
      await store.saveSettings({ persistGranted: granted });
    } catch {
      /* unsupported or refused: leave null so we can ask again another night */
    }
  }


  private lightAnother(): void {
    if (this.machine.state !== 'watch') return;
    this.released = null;
    this.shareButton.hideHint();
    this.installHint.hide();
    this.showIntention();
  }

  private goodnight(): void {
    if (!this.machine.go('goodnight')) return;
    this.lightUi.hide();
    this.shareButton.hideHint();
    this.installHint.hide();
    this.released = null;
    this.goodnightLine.textContent = this.mode === 'wish' ? COPY.goodnight.wish : COPY.goodnight.letGo;
    this.veil.classList.add('on');
    this.goodnightLine.classList.add('on');
    this.goodnightAt = performance.now() + 1500;
    focusNode(this.veil);
  }

  private backToArrive(): void {
    if (!this.machine.go('arrive')) return;
    this.veil.classList.remove('on');
    this.goodnightLine.classList.remove('on');
    this.showArrive();
  }

  /**
   * One line under the corner share button, once ever, as the first lantern
   * settles into the sky: the button is new and quiet, so it is pointed at
   * once and never again (M7).
   */
  private maybeShowShareHint(): void {
    const { store } = this.deps;
    if (store.settings.shareHintShown) return;
    void store.saveSettings({ shareHintShown: true }).catch(() => undefined);
    this.shareButton.showHint();
  }

  // ---------- Install hint ----------

  /** Which hint applies right now (forced in tests). */
  installPath(): InstallPath {
    if (this.deps.installForce) return this.deps.installForce;
    return detectInstall(readInstallEnv(this.deps.installPrompt() !== null));
  }

  /** Right after the first lantern has risen (SPEC section 4): first visit, then the third. */
  private maybeShowInstallHint(): void {
    if (this.installShownThisSession) return;
    const { store } = this.deps;
    if (!shouldShowInstallHint(store.settings.sessions, store.settings.installHintCount)) return;
    const path = this.installPath();
    if (path !== 'ios' && path !== 'prompt') return;
    this.installShownThisSession = true;
    this.installHint.show(path);
    void store.saveSettings({ installHintCount: store.settings.installHintCount + 1 }).catch(() => undefined);
  }

  private async promptInstall(): Promise<void> {
    const ev = this.deps.installPrompt();
    if (!ev) return;
    try {
      await ev.prompt();
    } catch {
      /* the browser decided not to show it */
    }
  }

  // ---------- Overlays ----------

  private closeOverlays(): void {
    this.skyView.hide();
    this.settings.hide();
    this.share.hide();
    this.deps.root.classList.remove('overlay-open');
  }

  private shareWish: string | null = null;
  private shareReturnTo: 'sky' | 'stage' = 'stage';

  private openShare(wish: string | null): void {
    this.shareWish = wish;
    this.shareReturnTo = this.skyView.isOpen ? 'sky' : 'stage';
    this.skyView.hide();
    this.settings.hide();
    this.deps.root.classList.add('overlay-open');
    this.share.open(wish);
  }

  private closeShare(): void {
    this.share.hide();
    if (this.shareReturnTo === 'sky') {
      this.skyView.show(this.skyEntries(), this.deps.layout());
    } else {
      this.deps.root.classList.remove('overlay-open');
      focusNode(this.shareButton.node);
    }
  }

  /** Compose the share image for tonight's sky (SPEC section 9). */
  renderShare(wish: string | null): Promise<HTMLCanvasElement> {
    const { renderer } = this.deps;
    const scene = this.scene;
    return composeShareCanvas({
      renderer,
      seed: scene.seed,
      moonFrame: scene.moon.currentFrame,
      skyLights: scene.allLights,
      rising: scene.rising.map((l) => ({ p: l.rise.p, kind: l.kind })),
      wish,
      evening: scene.evening,
      supermoon: scene.moon.isSupermoon,
    });
  }

  private followLantern(): void {
    const { layout } = this.deps;
    const scene = this.scene;
    const L = layout();
    const l = scene.resting ?? (this.released && this.released.phase === 'rising' ? this.released : null);
    if (l) this.lightUi.follow(l.x * L.cssScale, l.y * L.cssScale, window.innerWidth);
  }

  private async saveBackup(): Promise<void> {
    const { store, now } = this.deps;
    const at = now();
    const text = serializeBackup(store.lanterns, store.settings, at);
    const name = backupFileName(at);
    const blob = new Blob([text], { type: 'application/json' });
    const outcome = await shareOrDownload(blob, name, COPY.title);
    if (outcome === 'cancelled') return;
    await store.saveSettings({ lastBackupAt: at.toISOString() }).catch(() => undefined);
    this.toast.show(COPY.settings.saved);
  }

  private async restoreBackup(file: File): Promise<void> {
    const text = await file.text().catch(() => '');
    const backup = parseBackup(text);
    if (!backup) {
      this.toast.show(COPY.settings.wrongFile, 8000);
      return;
    }
    const before = new Set(this.deps.store.lanterns.map((l) => l.id));
    const added = await this.deps.store.merge(backup.lanterns).catch(() => 0);
    for (const l of this.deps.store.lanterns) {
      if (!before.has(l.id)) this.scene.addLight({ id: l.id, seed: l.seed, sky: l.sky, status: l.status, kind: l.kind });
    }
    this.toast.show(`${COPY.settings.restored} ${COPY.settings.restoredCount(added)}`, 7000);
    if (this.skyView.isOpen) this.skyView.show(this.skyEntries(), this.deps.layout());
  }

  private async clearSky(): Promise<void> {
    await this.deps.store.clear().catch(() => undefined);
    this.scene.clearLights();
    if (this.skyView.isOpen) this.skyView.show(this.skyEntries(), this.deps.layout());
  }

  // ---------- Shooting stars ----------

  private trySpawnStar(): void {
    const { layout, audio } = this.deps;
    const scene = this.scene;
    const L = layout();
    const css = L.cssScale;
    const avoid: StarAvoid[] = scene.activeLanterns.filter((l) => l.phase !== 'done').map((l) => ({ x: l.x * css, y: l.y * css, r: 60 }));
    const path = pickStarPath(L, this.rng.int(1, 1 << 30), avoid);
    if (!path) {
      this.nextStarIn = 5;
      return;
    }
    scene.star.spawn(path);
    audio.shimmer();
    this.nextStarIn = this.starInterval();
  }

  /** Test hook: spawn a star now, ignoring the schedule. */
  spawnStarNow(): boolean {
    const L = this.deps.layout();
    const path = pickStarPath(L, this.rng.int(1, 1 << 30), []);
    if (!path) return false;
    this.scene.star.spawn(path);
    this.deps.audio.shimmer();
    return true;
  }

  private tapStar(x: number, y: number): void {
    if (!this.scene.star.head()) return;
    this.scene.star.end();
    this.starUi.tapped(x, y);
  }

  /** The one-time hint shows as the first star appears, so nobody has to miss one to learn it (review after M5). */
  private starHint(): void {
    const { store } = this.deps;
    if (store.settings.starHintShown) return;
    void store.saveSettings({ starHintShown: true }).catch(() => undefined);
    this.toast.show(COPY.star.hint, 7000);
  }

  // ---------- Per frame ----------

  update(dtMs: number): void {
    const scene = this.scene;
    this.hold.update(dtMs);
    const state: State = this.machine.state;
    // Session light arc (SPEC section 3): from page open, over LIGHT_ARC_S; a stall never jumps it.
    if (this.deps.evening === null) {
      this.sessionMs += Math.min(dtMs, 100) * scene.speed;
      scene.setEvening(this.sessionMs / (LIGHT_ARC_S * 1000));
    }
    // Stars only during arrive and watch (SPEC section 3).
    if ((state === 'arrive' || state === 'watch') && !scene.star.active) {
      this.nextStarIn -= (dtMs / 1000) * scene.speed;
      if (this.nextStarIn <= 0) this.trySpawnStar();
    }
    const starActive = scene.star.active;
    if (starActive && !this.starWasActive) this.starHint();
    this.starWasActive = starActive;
    this.starUi.follow(scene.star.head());
    if (this.skyView.isOpen && scene.rising.length > 0) this.skyView.place(this.deps.layout());
    if (state === 'watch' && this.released && !this.watchShown && scene.wellOnItsWay(this.released)) {
      this.watchShown = true;
      this.lightUi.watch();
      this.maybeShowShareHint();
      this.maybeShowInstallHint();
    }
    if (state === 'watch' && this.released && this.released.phase === 'done') {
      this.released = null;
      this.lightUi.settled();
    }
    this.followLantern();
  }

  resize(layout: Layout): void {
    this.moon.place(layout);
    if (this.skyView.isOpen) this.skyView.place(layout);
    this.lightUi.setMotion(this.motion());
    this.followLantern();
  }

  /** Test hook. */
  star(): { x: number; y: number } | null {
    return this.scene.star.head();
  }

  /** Test hook: how many times the install hint has been shown. */
  installHintCount(): number {
    return this.deps.store.settings.installHintCount;
  }
}
