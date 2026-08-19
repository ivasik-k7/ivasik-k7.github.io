/**
 * Procedural lofi engine — cozy, warm, monotonic, immersive.
 *
 * Everything is synthesized in WebAudio, so the game ships no audio files:
 *  - a slow pad: detuned triangle oscillators through a gentle lowpass,
 *    long attack/release so chords melt into each other, panned slightly
 *    left/right for width;
 *  - a soft sine bass following the chord root;
 *  - a sparse pentatonic melody that wanders in occasionally, with a
 *    feedback-delay echo;
 *  - tape wobble: a slow LFO bends the pad filter like a worn cassette;
 *  - a generated-impulse reverb for room warmth;
 *  - vinyl crackle: filtered noise with sparse pops, very quiet;
 *  - optional percussion: a felt-soft kick and a paper-thin rim, swung.
 *
 * Tracks are just configs (key, tempo, chord loop, tone). Switching tracks
 * crossfades over ~2.5s so nothing ever cuts.
 */

export interface LofiTrack {
  name: string;
  bpm: number;
  /** Chords as MIDI note arrays; each chord holds for `beatsPerChord`. */
  chords: number[][];
  beatsPerChord: number;
  /** Pad lowpass cutoff — lower = darker, warmer. */
  cutoff: number;
  percussion: boolean;
  /** Extra vinyl crackle gain multiplier. */
  crackle: number;
  /** 0..1 — how often a melody phrase wanders in per chord. */
  melody: number;
}

export const LOFI_TRACKS: LofiTrack[] = [
  {
    name: "KITCHEN RADIO",
    bpm: 68,
    // Fmaj7 → Em7 → Dm7 → Cmaj7 — a tired, warm descent
    chords: [
      [53, 57, 60, 64],
      [52, 55, 59, 62],
      [50, 53, 57, 60],
      [48, 52, 55, 59],
    ],
    beatsPerChord: 8,
    cutoff: 900,
    percussion: true,
    crackle: 1,
    melody: 0.45,
  },
  {
    name: "RAINY BALCONY",
    bpm: 58,
    // Am7 → Fmaj7 → Cmaj7 → G7
    chords: [
      [45, 48, 52, 55],
      [41, 45, 48, 52],
      [48, 52, 55, 59],
      [43, 47, 50, 53],
    ],
    beatsPerChord: 8,
    cutoff: 700,
    percussion: false,
    crackle: 1.8,
    melody: 0.3,
  },
  {
    name: "NIGHT TRAM",
    bpm: 62,
    // Dm7 → G7 → Cmaj7 → Am7
    chords: [
      [50, 53, 57, 60],
      [43, 47, 50, 53],
      [48, 52, 55, 59],
      [45, 48, 52, 55],
    ],
    beatsPerChord: 8,
    cutoff: 850,
    percussion: true,
    crackle: 1.2,
    melody: 0.5,
  },
  {
    name: "WARM MILK",
    bpm: 54,
    // Cmaj7 → Am7 → Fmaj7 → G7, very slow, darkest tone
    chords: [
      [48, 52, 55, 59],
      [45, 48, 52, 55],
      [41, 45, 48, 52],
      [43, 47, 50, 53],
    ],
    beatsPerChord: 12,
    cutoff: 620,
    percussion: false,
    crackle: 1.4,
    melody: 0.2,
  },
];

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

const CROSSFADE_S = 2.5;
const LOOKAHEAD_S = 0.6;
const TICK_MS = 180;

/** Exponentially decaying noise burst — a warm little room, generated. */
function buildReverbImpulse(ctx: AudioContext, seconds = 1.8, decay = 3.2): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
    }
  }
  return buf;
}

/** One playing track: its own gain bus + a lookahead scheduler. */
class TrackVoice {
  private ctx: AudioContext;
  private track: LofiTrack;
  readonly bus: GainNode;
  private filter: BiquadFilterNode;
  private wobble: OscillatorNode;
  private delay: DelayNode;
  private timer: number | null = null;
  private nextChordTime = 0;
  private nextBeatTime = 0;
  private chordIndex = 0;
  private beatIndex = 0;
  private stopped = false;

  constructor(ctx: AudioContext, track: LofiTrack, destination: AudioNode, reverb: AudioNode) {
    this.ctx = ctx;
    this.track = track;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = track.cutoff;
    this.filter.Q.value = 0.4;
    this.filter.connect(this.bus);

    // tape wobble: slow LFO bends the filter ±35 cents like a worn cassette
    this.wobble = ctx.createOscillator();
    this.wobble.frequency.value = 0.31;
    const wobbleGain = ctx.createGain();
    wobbleGain.gain.value = 35;
    this.wobble.connect(wobbleGain);
    wobbleGain.connect(this.filter.detune);
    this.wobble.start();

    // melody echo: feedback delay, dotted-eighth feel
    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = (60 / track.bpm) * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    this.delay.connect(fb);
    fb.connect(this.delay);
    this.delay.connect(this.bus);

    this.bus.connect(destination);
    // send a copy of everything to the shared reverb for room warmth
    const send = ctx.createGain();
    send.gain.value = 0.4;
    this.bus.connect(send);
    send.connect(reverb);
  }

  start() {
    const now = this.ctx.currentTime;
    this.nextChordTime = now + 0.1;
    this.nextBeatTime = now + 0.1;
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  fadeIn() {
    const g = this.bus.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(1, now + CROSSFADE_S);
  }

  /** Fade out, then tear down. */
  fadeOutAndStop() {
    const g = this.bus.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + CROSSFADE_S);
    window.setTimeout(() => this.stop(), (CROSSFADE_S + 0.2) * 1000);
  }

  stop() {
    this.stopped = true;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    window.setTimeout(() => {
      this.wobble.stop();
      this.filter.disconnect();
      this.delay.disconnect();
      this.bus.disconnect();
    }, 100);
  }

  private schedule() {
    if (this.stopped) return;
    const ctx = this.ctx;
    const track = this.track;
    const beatS = 60 / track.bpm;
    const chordS = beatS * track.beatsPerChord;
    const horizon = ctx.currentTime + LOOKAHEAD_S;

    while (this.nextChordTime < horizon) {
      const chord = track.chords[this.chordIndex % track.chords.length];
      this.playChord(chord, this.nextChordTime, chordS);
      if (Math.random() < track.melody) {
        this.playPhrase(chord, this.nextChordTime + chordS * (0.25 + Math.random() * 0.35), beatS);
      }
      this.chordIndex += 1;
      this.nextChordTime += chordS;
    }

    if (track.percussion) {
      while (this.nextBeatTime < horizon) {
        const beatInBar = this.beatIndex % 4;
        // felt kick on 1, ghost kick on the swung "and" of 2, rim on 3
        if (beatInBar === 0) this.kick(this.nextBeatTime, 1);
        if (beatInBar === 1) this.kick(this.nextBeatTime + beatS * 0.62, 0.4);
        if (beatInBar === 2) this.rim(this.nextBeatTime);
        this.beatIndex += 1;
        this.nextBeatTime += beatS;
      }
    }
  }

  private playChord(midis: number[], at: number, holdS: number) {
    const { ctx } = this;
    const attack = Math.min(1.6, holdS * 0.25);
    const release = Math.min(2.2, holdS * 0.35);

    // pad voices: two detuned triangles per note, panned for width
    midis.forEach((m, i) => {
      for (const detune of [-5, 5]) {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = midiHz(m);
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(0.045, at + attack);
        g.gain.setValueAtTime(0.045, at + holdS - release);
        g.gain.linearRampToValueAtTime(0, at + holdS + 0.3);
        const pan = ctx.createStereoPanner();
        pan.pan.value = (i % 2 === 0 ? -1 : 1) * (0.12 + 0.1 * (detune > 0 ? 1 : 0));
        osc.connect(g);
        g.connect(pan);
        pan.connect(this.filter);
        osc.start(at);
        osc.stop(at + holdS + 0.5);
      }
    });

    // soft bass an octave under the root
    const bass = ctx.createOscillator();
    bass.type = "sine";
    bass.frequency.value = midiHz(midis[0] - 12);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0, at);
    bg.gain.linearRampToValueAtTime(0.11, at + attack * 0.7);
    bg.gain.setValueAtTime(0.11, at + holdS - release);
    bg.gain.linearRampToValueAtTime(0, at + holdS + 0.2);
    bass.connect(bg);
    bg.connect(this.filter);
    bass.start(at);
    bass.stop(at + holdS + 0.4);
  }

  /** A tiny wandering phrase — 2–3 soft sines from the chord, echoed. */
  private playPhrase(chord: number[], at: number, beatS: number) {
    const { ctx } = this;
    const notes = 2 + Math.floor(Math.random() * 2);
    let t = at;
    for (let i = 0; i < notes; i++) {
      const m = chord[Math.floor(Math.random() * chord.length)] + 12;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = midiHz(m);
      osc.detune.value = Math.random() * 8 - 4;
      const g = ctx.createGain();
      const len = beatS * (0.8 + Math.random() * 0.6);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0008, t + len);
      osc.connect(g);
      g.connect(this.filter);
      g.connect(this.delay);
      osc.start(t);
      osc.stop(t + len + 0.1);
      t += beatS * (0.75 + (Math.random() < 0.4 ? 0.75 : 0));
    }
  }

  private kick(at: number, strength: number) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(95, at);
    osc.frequency.exponentialRampToValueAtTime(42, at + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16 * strength, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.22);
    osc.connect(g);
    g.connect(this.bus);
    osc.start(at);
    osc.stop(at + 0.25);
  }

  private rim(at: number) {
    const { ctx } = this;
    const len = 0.03;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3200;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(hp);
    hp.connect(g);
    g.connect(this.bus);
    src.start(at);
  }
}

export class LofiPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private crackleGain: GainNode | null = null;
  private voice: TrackVoice | null = null;

  private trackIndex_: number;
  private _volume: number;
  private _playing = false;
  private listeners = new Set<() => void>();

  constructor() {
    this.trackIndex_ = Number(localStorage.getItem("lofi.track") ?? 0) % LOFI_TRACKS.length;
    const stored = Number(localStorage.getItem("lofi.volume"));
    this._volume = Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 0.5;
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
  /** Which slot is playing, so a deck can show 2/4 and highlight the right name. */
  get trackIndex(): number {
    return this.trackIndex_;
  }

  get trackCount(): number {
    return LOFI_TRACKS.length;
  }

  get trackNames(): string[] {
    return LOFI_TRACKS.map((t) => t.name);
  }

  get track(): LofiTrack {
    return LOFI_TRACKS[this.trackIndex_];
  }

  /** Shared audio graph for sibling services (ambience, sfx). Unlock first. */
  get graph(): { ctx: AudioContext; master: GainNode } | null {
    return this.ctx && this.master ? { ctx: this.ctx, master: this.master } : null;
  }

  // --- lifecycle ----------------------------------------------------------------
  /** Call from a user gesture: creates/resumes the AudioContext. */
  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._volume;
      this.master.connect(this.ctx.destination);
      // shared room reverb: everything musical sends a little into it
      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = buildReverbImpulse(this.ctx);
      const wet = this.ctx.createGain();
      wet.gain.value = 0.32;
      this.reverb.connect(wet);
      wet.connect(this.master);
      this.startCrackle();
      this.emit();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  play() {
    this.unlock();
    if (this._playing || !this.ctx || !this.master || !this.reverb) return;
    this._playing = true;
    this.voice = new TrackVoice(this.ctx, this.track, this.master, this.reverb);
    this.voice.start();
    this.voice.fadeIn();
    this.setCrackle(this.track.crackle);
    this.emit();
  }

  pause() {
    if (!this._playing) return;
    this._playing = false;
    this.voice?.fadeOutAndStop();
    this.voice = null;
    this.setCrackle(0);
    this.emit();
  }

  toggle() {
    if (this._playing) this.pause();
    else this.play();
  }

  next(step = 1) {
    this.trackIndex_ = (this.trackIndex_ + step + LOFI_TRACKS.length) % LOFI_TRACKS.length;
    localStorage.setItem("lofi.track", String(this.trackIndex_));
    if (this._playing && this.ctx && this.master && this.reverb) {
      // crossfade: old voice ramps down while the new one ramps up
      this.voice?.fadeOutAndStop();
      this.voice = new TrackVoice(this.ctx, this.track, this.master, this.reverb);
      this.voice.start();
      this.voice.fadeIn();
      this.setCrackle(this.track.crackle);
    }
    this.emit();
  }

  setVolume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    localStorage.setItem("lofi.volume", String(this._volume));
    if (this.master && this.ctx) {
      const g = this.master.gain;
      const now = this.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(this._volume, now + 0.15);
    }
    this.emit();
  }

  // --- vinyl bed --------------------------------------------------------------------
  private startCrackle() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const seconds = 3;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      // quiet hiss + sparse pops
      data[i] = (Math.random() * 2 - 1) * 0.012;
      if (Math.random() < 0.00004) {
        data[i] = (Math.random() * 2 - 1) * 0.6;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 3400;
    bp.Q.value = 0.5;
    this.crackleGain = ctx.createGain();
    this.crackleGain.gain.value = 0;
    src.connect(bp);
    bp.connect(this.crackleGain);
    this.crackleGain.connect(this.master);
    src.start();
  }

  private setCrackle(mult: number) {
    if (!this.crackleGain || !this.ctx) return;
    const g = this.crackleGain.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.5 * mult, now + CROSSFADE_S);
  }
}

/** Singleton — one player per app. */
export const lofiPlayer = new LofiPlayer();
