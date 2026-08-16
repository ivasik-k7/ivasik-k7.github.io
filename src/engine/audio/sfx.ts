import { lofiPlayer } from "./lofi";

/**
 * SFX — synthesized one-shots for interaction feedback.
 * No samples; warm, soft-edged, slightly muffled — like sounds heard
 * through a wall in an old building. Every voice routes through a gentle
 * lowpass so nothing ever bites.
 */

export type SfxName =
  | "click" // light switch, buttons
  | "creak" // wooden doors
  | "doorshut" // a door settling into its frame
  | "thud" // heavy things, stairs
  | "chime" // pleasant confirmation
  | "register" // the Żabka kasa
  | "denied" // not enough money
  | "tvOn" // CRT waking: degauss thump + rising hum
  | "tvOff" // CRT dying: falling blip
  | "radio" // tuning: static + passing carrier
  | "kettle" // gas igniter click + soft whump
  | "pour" // tea into a cup
  | "match" // strike + flame puff
  | "fridge" // rubber seal pop + compressor blip
  | "washer" // motor spin-up
  | "water" // tap / tub rush
  | "carlock" // remote: beep-beep + clunk
  | "carunlock" // rising beeps + mirrors unfolding
  | "cardoor" // solid German thunk
  | "engine" // starter + low burble
  | "coins" // change jingling
  | "liftding"; // arrival chime + doors rumbling open

interface Voice {
  ctx: AudioContext;
  out: GainNode;
  t: number;
}

function voice(): Voice | null {
  const graph = lofiPlayer.graph;
  if (!graph) return null;
  const { ctx, master } = graph;
  const out = ctx.createGain();
  out.gain.value = 0.5;
  const soften = ctx.createBiquadFilter();
  soften.type = "lowpass";
  soften.frequency.value = 6500;
  out.connect(soften);
  soften.connect(master);
  return { ctx, out, t: ctx.currentTime };
}

function noiseBurst(ctx: AudioContext, seconds: number, fade = true): AudioBufferSourceNode {
  const buf = ctx.createBuffer(
    1,
    Math.max(1, Math.floor(ctx.sampleRate * seconds)),
    ctx.sampleRate,
  );
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (fade ? 1 - i / data.length : 1);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

/** Filtered, envelope-shaped noise — the workhorse of homely sounds. */
function whoosh(
  v: Voice,
  opts: {
    at?: number;
    len: number;
    type: BiquadFilterType;
    freq: number;
    q?: number;
    peak: number;
    attack?: number;
  },
) {
  const { ctx, out } = v;
  const at = v.t + (opts.at ?? 0);
  const n = noiseBurst(ctx, opts.len, false);
  const f = ctx.createBiquadFilter();
  f.type = opts.type;
  f.frequency.value = opts.freq;
  f.Q.value = opts.q ?? 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(opts.peak, at + (opts.attack ?? 0.02));
  g.gain.exponentialRampToValueAtTime(0.001, at + opts.len);
  n.connect(f);
  f.connect(g);
  g.connect(out);
  n.start(at);
}

function blip(
  v: Voice,
  opts: {
    at?: number;
    type?: OscillatorType;
    from: number;
    to?: number;
    len: number;
    peak: number;
    exp?: boolean;
  },
) {
  const { ctx, out } = v;
  const at = v.t + (opts.at ?? 0);
  const osc = ctx.createOscillator();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.from, at);
  if (opts.to) {
    if (opts.exp) osc.frequency.exponentialRampToValueAtTime(opts.to, at + opts.len * 0.8);
    else osc.frequency.linearRampToValueAtTime(opts.to, at + opts.len * 0.8);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(opts.peak, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + opts.len);
  osc.connect(g);
  g.connect(out);
  osc.start(at);
  osc.stop(at + opts.len + 0.05);
}

export function playSfx(name: SfxName) {
  const v = voice();
  if (!v) return;

  switch (name) {
    case "click":
      whoosh(v, { len: 0.05, type: "highpass", freq: 2500, peak: 0.25, attack: 0.002 });
      break;

    case "creak":
      blip(v, { type: "sawtooth", from: 92, to: 64, len: 0.32, peak: 0.06 });
      whoosh(v, { len: 0.25, type: "bandpass", freq: 700, q: 3, peak: 0.03, attack: 0.08 });
      break;

    case "doorshut":
      blip(v, { from: 110, to: 60, len: 0.14, peak: 0.2, exp: true });
      whoosh(v, { at: 0.02, len: 0.08, type: "lowpass", freq: 900, peak: 0.1 });
      break;

    case "thud":
      blip(v, { from: 120, to: 45, len: 0.25, peak: 0.3, exp: true });
      break;

    case "chime":
      blip(v, { type: "sine", from: 880, len: 0.5, peak: 0.12 });
      blip(v, { at: 0.09, type: "sine", from: 1318.5, len: 0.5, peak: 0.1 });
      break;

    case "register":
      whoosh(v, { len: 0.09, type: "bandpass", freq: 1200, q: 1.5, peak: 0.3, attack: 0.005 });
      blip(v, { at: 0.08, type: "triangle", from: 1975, len: 0.55, peak: 0.1 });
      break;

    case "denied":
      blip(v, { type: "square", from: 220, to: 185, len: 0.28, peak: 0.05 });
      break;

    case "tvOn":
      blip(v, { from: 55, to: 50, len: 0.18, peak: 0.22, exp: true });
      blip(v, { at: 0.1, type: "triangle", from: 8000, to: 15600, len: 0.4, peak: 0.015 });
      whoosh(v, { at: 0.05, len: 0.3, type: "highpass", freq: 5000, peak: 0.02, attack: 0.1 });
      break;

    case "tvOff":
      blip(v, { type: "triangle", from: 12000, to: 200, len: 0.22, peak: 0.03, exp: true });
      blip(v, { at: 0.12, from: 90, to: 50, len: 0.12, peak: 0.08, exp: true });
      break;

    case "radio":
      whoosh(v, { len: 0.28, type: "bandpass", freq: 2400, q: 0.6, peak: 0.06, attack: 0.02 });
      blip(v, { at: 0.06, type: "sine", from: 600, to: 1400, len: 0.18, peak: 0.02 });
      break;

    case "kettle":
      whoosh(v, { len: 0.04, type: "highpass", freq: 3000, peak: 0.18, attack: 0.002 });
      whoosh(v, { at: 0.08, len: 0.35, type: "lowpass", freq: 500, peak: 0.06, attack: 0.12 });
      break;

    case "pour":
      whoosh(v, { len: 0.55, type: "bandpass", freq: 1900, q: 1.2, peak: 0.05, attack: 0.15 });
      whoosh(v, { at: 0.1, len: 0.4, type: "bandpass", freq: 900, q: 2, peak: 0.03, attack: 0.1 });
      break;

    case "match":
      whoosh(v, { len: 0.07, type: "highpass", freq: 4000, peak: 0.14, attack: 0.004 });
      whoosh(v, { at: 0.09, len: 0.3, type: "lowpass", freq: 800, peak: 0.05, attack: 0.09 });
      break;

    case "fridge":
      whoosh(v, { len: 0.06, type: "bandpass", freq: 400, q: 2, peak: 0.15, attack: 0.01 });
      blip(v, { at: 0.06, from: 62, len: 0.3, peak: 0.05 });
      break;

    case "washer":
      blip(v, { from: 40, to: 130, len: 0.8, peak: 0.08 });
      whoosh(v, { at: 0.2, len: 0.6, type: "lowpass", freq: 300, peak: 0.05, attack: 0.25 });
      break;

    case "water":
      whoosh(v, { len: 0.7, type: "bandpass", freq: 1400, q: 0.7, peak: 0.07, attack: 0.12 });
      whoosh(v, { at: 0.05, len: 0.6, type: "lowpass", freq: 600, peak: 0.04, attack: 0.2 });
      break;

    case "carlock":
      blip(v, { type: "square", from: 2200, len: 0.06, peak: 0.04 });
      blip(v, { at: 0.12, type: "square", from: 1760, len: 0.08, peak: 0.04 });
      whoosh(v, { at: 0.22, len: 0.06, type: "lowpass", freq: 700, peak: 0.12 });
      break;

    case "carunlock":
      blip(v, { type: "square", from: 1760, len: 0.06, peak: 0.04 });
      blip(v, { at: 0.12, type: "square", from: 2350, len: 0.08, peak: 0.045 });
      whoosh(v, {
        at: 0.2,
        len: 0.22,
        type: "bandpass",
        freq: 480,
        q: 3,
        peak: 0.05,
        attack: 0.05,
      });
      break;

    case "cardoor":
      blip(v, { from: 130, to: 65, len: 0.12, peak: 0.25, exp: true });
      whoosh(v, { len: 0.05, type: "bandpass", freq: 900, q: 1.5, peak: 0.1 });
      break;

    case "engine": {
      // starter whirr then a settled low burble
      whoosh(v, { len: 0.4, type: "bandpass", freq: 180, q: 3, peak: 0.12, attack: 0.05 });
      blip(v, { at: 0.35, type: "sawtooth", from: 55, to: 42, len: 0.9, peak: 0.06 });
      blip(v, { at: 0.4, type: "sine", from: 84, len: 0.8, peak: 0.04 });
      break;
    }

    case "liftding":
      blip(v, { type: "sine", from: 987, len: 0.5, peak: 0.09 });
      blip(v, { at: 0.16, type: "sine", from: 784, len: 0.6, peak: 0.08 });
      whoosh(v, { at: 0.5, len: 0.7, type: "lowpass", freq: 240, peak: 0.07, attack: 0.2 });
      break;

    case "coins":
      for (let i = 0; i < 3; i++) {
        blip(v, {
          at: i * 0.05,
          type: "triangle",
          from: 2600 + i * 700,
          len: 0.12,
          peak: 0.05,
        });
      }
      break;
  }
}
