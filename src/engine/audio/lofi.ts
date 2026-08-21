/**
 * Music, and the mixer everything else hangs off.
 *
 * ## The mixer
 *
 * There are three buses under the master, and each one is owned by exactly one
 * slider in the settings screen:
 *
 *     destination ── master ─┬─ music     the soundtrack
 *                            ├─ ambience  the per-location bed
 *                            └─ sfx       one-shots, and dialogue mumble
 *
 * This is the whole reason the file is shaped this way. Everything used to
 * connect straight to `master`, which meant the music slider was in fact a
 * master volume: turning the soundtrack down also took the kettle, the tram and
 * the rain with it, and the ambience and sound sliders had nothing of their own
 * to move. Three buses, three sliders, and each one moves only what it names.
 *
 * ## The music
 *
 * Eight recorded tracks, served as Ogg Vorbis from `public/music` and played
 * through `<audio>` elements routed into the music bus. They replace the
 * procedural lofi synth that used to live here — a pad, a bass, a wandering
 * pentatonic melody and vinyl crackle, all generated per frame in WebAudio. It
 * was a fair imitation of a tired radio, and it is no longer needed now that
 * there is actual music to play.
 *
 * Each track gets one element and one gain node, cached and reused, because a
 * MediaElementAudioSourceNode can only be created once per element. Switching
 * tracks crossfades over ~2.4 s, so the deck never cuts.
 */

const FADE_S = 2.4;

export interface MusicTrack {
  /** as it appears on the deck, in the pixel font */
  name: string;
  /** file under `public/music`, without the directory or the extension */
  file: string;
  /** one line for the credits and the now-playing line */
  mood: string;
}

export const MUSIC_TRACKS: MusicTrack[] = [
  { name: "LATE AFTERNOON", file: "late-afternoon-in-the", mood: "the light going amber" },
  { name: "BLUE HOUR AT STOCZNIA", file: "blue-hour-at-stocznia", mood: "the shipyard after work" },
  {
    name: "STREETLIGHTS IN GDAŃSK",
    file: "streetlights-in-gdansk",
    mood: "walking home the long way",
  },
  { name: "THROUGH THE WINDOW", file: "through-the-window", mood: "rain you are not out in" },
  { name: "EMPTY HALLWAY", file: "empty-hallway-loop", mood: "the stairwell at midnight" },
  {
    name: "CONCRETE BETWEEN PLACES",
    file: "concrete-between-places",
    mood: "the yard between blocks",
  },
  { name: "GDAŃSK STATION", file: "gdansk-station-loop", mood: "waiting for something later" },
  { name: "DISTANT HOME", file: "distant-home", mood: "somewhere you used to live" },
];

/** The old name for a track, kept so nothing downstream had to be rewritten. */
export type LofiTrack = MusicTrack;
export const LOFI_TRACKS = MUSIC_TRACKS;

/** Where the files are, honouring the deployed base path. */
function srcFor(track: MusicTrack): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return `${base.endsWith("/") ? base : `${base}/`}music/${track.file}.ogg`;
}

export interface AudioGraph {
  ctx: AudioContext;
  /** everything, after the three buses — for anything that wants the sum */
  master: GainNode;
  music: GainNode;
  ambience: GainNode;
  sfx: GainNode;
}

type Deck = { el: HTMLAudioElement; gain: GainNode };

export class LofiPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private decks = new Map<number, Deck>();
  private live: number | null = null;

  private trackIndex_: number;
  private _volume: number;
  private _master: number;
  private _playing = false;
  private listeners = new Set<() => void>();

  constructor() {
    this.trackIndex_ = Number(localStorage.getItem("lofi.track") ?? 0) % MUSIC_TRACKS.length;
    if (!Number.isFinite(this.trackIndex_) || this.trackIndex_ < 0) this.trackIndex_ = 0;
    const stored = Number(localStorage.getItem("lofi.volume"));
    this._volume = Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 0.5;
    const m = Number(localStorage.getItem("audio.master"));
    this._master = Number.isFinite(m) && m >= 0 && m <= 1 ? m : 0.8;
  }

  // --- observable state ------------------------------------------------------
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  get playing() {
    return this._playing;
  }
  get volume() {
    return this._volume;
  }
  /** Everything, after the three channel buses. */
  get masterVolume() {
    return this._master;
  }
  /** Which slot is playing, so a deck can show 2/8 and highlight the right name. */
  get trackIndex(): number {
    return this.trackIndex_;
  }
  get trackCount(): number {
    return MUSIC_TRACKS.length;
  }
  get trackNames(): string[] {
    return MUSIC_TRACKS.map((t) => t.name);
  }
  get track(): MusicTrack {
    return MUSIC_TRACKS[this.trackIndex_];
  }

  /** Shared audio graph for sibling services (ambience, sfx, voice). Unlock first. */
  get graph(): AudioGraph | null {
    return this.ctx && this.master && this.musicBus && this.ambienceBus && this.sfxBus
      ? {
          ctx: this.ctx,
          master: this.master,
          music: this.musicBus,
          ambience: this.ambienceBus,
          sfx: this.sfxBus,
        }
      : null;
  }

  // --- lifecycle ----------------------------------------------------------------
  /** Call from a user gesture: creates/resumes the AudioContext. */
  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._master;
      this.master.connect(this.ctx.destination);
      const bus = () => {
        const g = this.ctx?.createGain();
        if (g && this.master) g.connect(this.master);
        return g ?? null;
      };
      this.musicBus = bus();
      this.ambienceBus = bus();
      this.sfxBus = bus();
      if (this.musicBus) this.musicBus.gain.value = this._volume;
      this.emit();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  /**
   * The element and gain for one track, built on first use.
   *
   * `createMediaElementSource` may be called only once for a given element, so
   * both live here together and are never rebuilt. The element loops itself;
   * these are two- and three-minute pieces written to go round.
   */
  private deck(index: number): Deck | null {
    if (!this.ctx || !this.musicBus) return null;
    const found = this.decks.get(index);
    if (found) return found;
    const el = new Audio(srcFor(MUSIC_TRACKS[index]));
    el.loop = true;
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    el.addEventListener("error", () => {
      console.warn(`[music] could not load ${MUSIC_TRACKS[index].name}`);
    });
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    this.ctx.createMediaElementSource(el).connect(gain);
    gain.connect(this.musicBus);
    const deck: Deck = { el, gain };
    this.decks.set(index, deck);
    return deck;
  }

  private fade(deck: Deck, to: number, seconds = FADE_S) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const g = deck.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(to, now + seconds);
  }

  play() {
    this.unlock();
    if (this._playing) return;
    const deck = this.deck(this.trackIndex_);
    if (!deck) return;
    this._playing = true;
    this.live = this.trackIndex_;
    void deck.el.play().catch(() => {
      // a browser that refused the gesture; the deck stays armed for the next one
      this._playing = false;
      this.emit();
    });
    this.fade(deck, 1);
    this.emit();
  }

  pause() {
    if (!this._playing) return;
    this._playing = false;
    const deck = this.live === null ? null : this.decks.get(this.live);
    if (deck) {
      this.fade(deck, 0, 0.6);
      const el = deck.el;
      window.setTimeout(() => {
        // only actually stop it if nothing started it again in the meantime
        if (!this._playing) el.pause();
      }, 700);
    }
    this.emit();
  }

  toggle() {
    if (this._playing) this.pause();
    else this.play();
  }

  next(step = 1) {
    const from = this.live;
    this.trackIndex_ = (this.trackIndex_ + step + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
    localStorage.setItem("lofi.track", String(this.trackIndex_));
    if (this._playing) {
      const old = from === null ? null : this.decks.get(from);
      if (old && from !== this.trackIndex_) {
        this.fade(old, 0);
        const el = old.el;
        window.setTimeout(
          () => {
            el.pause();
            el.currentTime = 0;
          },
          (FADE_S + 0.2) * 1000,
        );
      }
      const deck = this.deck(this.trackIndex_);
      if (deck) {
        this.live = this.trackIndex_;
        void deck.el.play().catch(() => {});
        this.fade(deck, 1);
      }
    }
    this.emit();
  }

  /**
   * The overall level. This is the one control that does move everything —
   * which is exactly why the three below it had to stop doing so.
   */
  setMasterVolume(v: number) {
    this._master = Math.max(0, Math.min(1, v));
    localStorage.setItem("audio.master", String(this._master));
    if (this.master && this.ctx) {
      const g = this.master.gain;
      const now = this.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(this._master, now + 0.12);
    }
    this.emit();
  }

  /**
   * Go straight to a track.
   *
   * `next(step)` was the only way in, which is fine for a deck with four
   * cassettes on it and useless for a list of twenty — reaching track 17 meant
   * pressing skip sixteen times, each one a 2.4 s crossfade. This takes the
   * same crossfade path so it still never cuts.
   */
  playTrack(index: number) {
    const want = ((index % MUSIC_TRACKS.length) + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
    if (want === this.trackIndex_) {
      // asking for what is already on means "start it" if it is not playing
      if (!this._playing) this.play();
      return;
    }
    this.next(want - this.trackIndex_);
    if (!this._playing) this.play();
  }

  /** The music channel, and only the music channel. */
  setVolume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    localStorage.setItem("lofi.volume", String(this._volume));
    if (this.musicBus && this.ctx) {
      const g = this.musicBus.gain;
      const now = this.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(this._volume, now + 0.12);
    }
    this.emit();
  }
}

export const lofiPlayer = new LofiPlayer();
