import { lofiPlayer } from "./lofi";

/**
 * Ambience — a quiet sound bed per location, crossfaded on scene change.
 * Each bed is a tiny synthesized loop: the room's hum, the street's air,
 * the stairwell's hollow, the shop's fluorescent buzz. Immersion lives in
 * these 2% -volume layers you only notice when they're gone.
 */

export type AmbienceName = "room" | "street" | "stairwell" | "shop" | "parking" | "none";

const FADE_S = 1.5;

interface Bed {
  gain: GainNode;
  stop: () => void;
}

function noiseSource(ctx: AudioContext, seconds = 2): AudioBufferSourceNode {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < data.length; i++) {
    // brown-ish noise: integrate white, keep bounded
    brown = (brown + (Math.random() * 2 - 1) * 0.02) * 0.996;
    data[i] = brown * 3.5;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

function tone(ctx: AudioContext, hz: number, gainValue: number, out: AudioNode): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = hz;
  const g = ctx.createGain();
  g.gain.value = gainValue;
  osc.connect(g);
  g.connect(out);
  osc.start();
  return osc;
}

/** Echoing drip: a tiny blip through a feedback delay. */
function scheduleDrips(ctx: AudioContext, bus: GainNode, everyMs: [number, number]): () => void {
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.31;
  const fb = ctx.createGain();
  fb.gain.value = 0.45;
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(bus);
  let timer = 0;
  const drop = () => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(1400 + Math.random() * 800, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g);
    g.connect(delay);
    osc.start(t);
    osc.stop(t + 0.1);
    timer = window.setTimeout(drop, everyMs[0] + Math.random() * (everyMs[1] - everyMs[0]));
  };
  timer = window.setTimeout(drop, 2000);
  return () => window.clearTimeout(timer);
}

/** Sparse birdsong: two-note chirps, morning-radio distance. */
function scheduleBirds(ctx: AudioContext, bus: GainNode): () => void {
  let timer = 0;
  const chirp = () => {
    const t = ctx.currentTime;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const at = t + i * (0.09 + Math.random() * 0.06);
      const osc = ctx.createOscillator();
      const base = 2800 + Math.random() * 1200;
      osc.frequency.setValueAtTime(base, at);
      osc.frequency.exponentialRampToValueAtTime(base * 1.4, at + 0.04);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.05, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.07);
      osc.connect(g);
      g.connect(bus);
      osc.start(at);
      osc.stop(at + 0.1);
    }
    timer = window.setTimeout(chirp, 4000 + Math.random() * 9000);
  };
  timer = window.setTimeout(chirp, 1500);
  return () => window.clearTimeout(timer);
}

/** A car passing somewhere beyond the yard: a slow filtered swell. */
function scheduleCarPasses(ctx: AudioContext, bus: GainNode): () => void {
  let timer = 0;
  const pass = () => {
    const t = ctx.currentTime;
    const n = noiseSource(ctx, 4);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(200, t);
    lp.frequency.linearRampToValueAtTime(420, t + 2);
    lp.frequency.linearRampToValueAtTime(160, t + 4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.35, t + 2);
    g.gain.linearRampToValueAtTime(0.0001, t + 4.2);
    n.connect(lp);
    lp.connect(g);
    g.connect(bus);
    n.start(t);
    n.stop(t + 4.5);
    timer = window.setTimeout(pass, 12000 + Math.random() * 18000);
  };
  timer = window.setTimeout(pass, 6000);
  return () => window.clearTimeout(timer);
}

/** Barcode scanner somewhere at the till: quick double beeps, randomly. */
function scheduleScanner(ctx: AudioContext, bus: GainNode): () => void {
  let timer = 0;
  const beep = () => {
    const t = ctx.currentTime;
    for (const at of [0, 0.14]) {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = 1860;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.03, t + at);
      g.gain.exponentialRampToValueAtTime(0.001, t + at + 0.07);
      osc.connect(g);
      g.connect(bus);
      osc.start(t + at);
      osc.stop(t + at + 0.1);
    }
    timer = window.setTimeout(beep, 6000 + Math.random() * 10000);
  };
  timer = window.setTimeout(beep, 3000);
  return () => window.clearTimeout(timer);
}

/** The entrance chime: someone comes in, someone gives up on the queue. */
function scheduleDoorChime(ctx: AudioContext, bus: GainNode): () => void {
  let timer = 0;
  const ding = () => {
    const t = ctx.currentTime;
    for (const [at, hz] of [
      [0, 987.8],
      [0.18, 784],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = hz;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.028, t + at);
      g.gain.exponentialRampToValueAtTime(0.001, t + at + 0.5);
      osc.connect(g);
      g.connect(bus);
      osc.start(t + at);
      osc.stop(t + at + 0.55);
    }
    timer = window.setTimeout(ding, 18000 + Math.random() * 24000);
  };
  timer = window.setTimeout(ding, 9000);
  return () => window.clearTimeout(timer);
}

function buildBed(ctx: AudioContext, name: AmbienceName, out: AudioNode): Bed | null {
  if (name === "none") return null;
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.connect(out);
  const stops: (() => void)[] = [];

  if (name === "room") {
    // warm interior: soft low air + the faintest mains hum
    const noise = noiseSource(ctx);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 220;
    const ng = ctx.createGain();
    ng.gain.value = 0.35;
    noise.connect(lp);
    lp.connect(ng);
    ng.connect(bus);
    noise.start();
    const hum = tone(ctx, 50, 0.05, bus);
    stops.push(() => {
      noise.stop();
      hum.stop();
    });
  }

  if (name === "street") {
    // open air: broader noise + a slow wind swell + birds + far traffic
    const noise = noiseSource(ctx, 3);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 480;
    const ng = ctx.createGain();
    ng.gain.value = 0.5;
    noise.connect(lp);
    lp.connect(ng);
    ng.connect(bus);
    noise.start();
    // wind: LFO on a bandpassed copy
    const wind = ctx.createBiquadFilter();
    wind.type = "bandpass";
    wind.frequency.value = 800;
    wind.Q.value = 1.2;
    const wg = ctx.createGain();
    wg.gain.value = 0;
    noise.connect(wind);
    wind.connect(wg);
    wg.connect(bus);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.12;
    lfo.connect(lfoG);
    lfoG.connect(wg.gain);
    lfo.start();
    const stopBirds = scheduleBirds(ctx, bus);
    const stopCars = scheduleCarPasses(ctx, bus);
    stops.push(() => {
      noise.stop();
      lfo.stop();
      stopBirds();
      stopCars();
    });
  }

  if (name === "parking") {
    // underground: deep concrete drone, ventilation, echoing drips
    const drone = tone(ctx, 44, 0.09, bus);
    const vent = noiseSource(ctx, 3);
    const vlp = ctx.createBiquadFilter();
    vlp.type = "bandpass";
    vlp.frequency.value = 260;
    vlp.Q.value = 1.6;
    const vg = ctx.createGain();
    vg.gain.value = 0.4;
    vent.connect(vlp);
    vlp.connect(vg);
    vg.connect(bus);
    vent.start();
    const flicker = tone(ctx, 118, 0.02, bus);
    const stopDrips = scheduleDrips(ctx, bus, [5000, 14000]);
    stops.push(() => {
      drone.stop();
      vent.stop();
      flicker.stop();
      stopDrips();
    });
  }

  if (name === "stairwell") {
    // hollow concrete: narrow resonance + a pipe dripping somewhere below
    const noise = noiseSource(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 380;
    bp.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.value = 0.4;
    noise.connect(bp);
    bp.connect(ng);
    ng.connect(bus);
    noise.start();
    const hum = tone(ctx, 100, 0.02, bus);
    const stopDrips = scheduleDrips(ctx, bus, [9000, 22000]);
    stops.push(() => {
      noise.stop();
      hum.stop();
      stopDrips();
    });
  }

  if (name === "shop") {
    // fluorescent buzz + fridge compressors + thin hiss
    const buzz = tone(ctx, 120, 0.035, bus);
    const fridge = tone(ctx, 62, 0.05, bus);
    const noise = noiseSource(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 6000;
    const ng = ctx.createGain();
    ng.gain.value = 0.04;
    noise.connect(hp);
    hp.connect(ng);
    ng.connect(bus);
    noise.start();
    const stopScanner = scheduleScanner(ctx, bus);
    const stopChime = scheduleDoorChime(ctx, bus);
    stops.push(() => {
      buzz.stop();
      fridge.stop();
      noise.stop();
      stopScanner();
      stopChime();
    });
  }

  return {
    gain: bus,
    stop: () => {
      for (const s of stops) s();
      window.setTimeout(() => bus.disconnect(), 100);
    },
  };
}

class AmbienceEngine {
  private current: Bed | null = null;
  private currentName: AmbienceName = "none";
  /** Overall ambience loudness relative to the master bus. */
  private level = 0.16;

  /** Crossfade to a new bed; safe to call before audio is unlocked. */
  set(name: AmbienceName) {
    if (name === this.currentName) return;
    const graph = lofiPlayer.graph;
    if (!graph) {
      // remember the wish; apply on next set() after unlock
      this.currentName = "none";
      this.pending = name;
      return;
    }
    this.pending = null;
    // the ambience bus, so the AMBIENCE slider moves this and nothing else
    const { ctx, ambience: bus } = graph;
    const old = this.current;
    if (old) {
      const now = ctx.currentTime;
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + FADE_S);
      window.setTimeout(() => old.stop(), (FADE_S + 0.2) * 1000);
    }
    const bed = buildBed(ctx, name, bus);
    if (bed) {
      const now = ctx.currentTime;
      bed.gain.gain.setValueAtTime(0, now);
      bed.gain.gain.linearRampToValueAtTime(this.level, now + FADE_S);
    }
    this.current = bed;
    this.currentName = name;
  }

  private pending: AmbienceName | null = null;

  /**
   * Set the ambience level from the player's setting, 0..1.
   *
   * The bed's own loudness is 0.16 against the master bus, arrived at by ear,
   * and the slider defaults to 0.6 — so 0.6 has to keep sounding exactly as it
   * always did. Hence the scale: `0.2667 * v` puts the default back on 0.16
   * and lets the top of the slider go a little louder than the old fixed bed.
   */
  setLevel(v: number) {
    this.level = 0.2667 * Math.max(0, Math.min(1, v));
    const graph = lofiPlayer.graph;
    const bed = this.current;
    if (!graph || !bed) return;
    // ramp rather than jump: dragging a slider should not click
    const now = graph.ctx.currentTime;
    bed.gain.gain.cancelScheduledValues(now);
    bed.gain.gain.setValueAtTime(bed.gain.gain.value, now);
    bed.gain.gain.linearRampToValueAtTime(this.level, now + 0.12);
  }

  /** Call once after the first gesture unlocks audio. */
  applyPending() {
    if (this.pending) {
      const wish = this.pending;
      this.pending = null;
      this.currentName = "none";
      this.set(wish);
    }
  }
}

export const ambience = new AmbienceEngine();
