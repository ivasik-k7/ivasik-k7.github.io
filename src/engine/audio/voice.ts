import { voiceEnabled } from "../core/prefs";
import { lofiPlayer } from "./lofi";

/**
 * Voice mimic — Animalese-style syllable mumbling for dialogue lines.
 * Not speech: short formant blips, one per syllable-ish chunk, pitch
 * wandering downhill like someone talking through a wall. Deliberately
 * a little uncanny — low, slow, slightly detuned.
 */

export interface VoiceProfile {
  /** Base glottal pitch in Hz — lower is creepier. */
  pitch: number;
  /** Syllables per second. */
  rate: number;
  /** Formant center — the "mouth shape". */
  formant: number;
}

/** Deterministic profile from a speaker name, so voices stay consistent. */
export function voiceFor(speaker: string): VoiceProfile {
  let h = 0;
  for (const ch of speaker) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return {
    pitch: 92 + (h % 5) * 15, // 92..152 Hz — low, warm, unhurried
    rate: 6 + (h % 3), // 6..8 syl/s — unhurried
    formant: 480 + (h % 7) * 70, // 480..900 Hz
  };
}

/** Major-pentatonic degrees — the melody the mumbling walks on. */
const SCALE = [0, 2, 4, 7, 9];

function nearestDegree(semis: number): number {
  let best = SCALE[0];
  for (const d of SCALE) {
    if (Math.abs(d - semis) < Math.abs(best - semis)) best = d;
  }
  return best;
}

/**
 * Mumble a line — one bubble's worth of almost-speech, sung legato.
 * A single voice glides through a pentatonic phrase: portamento between
 * syllables, gentle vibrato, vowel-like formant shifts, a statement fall
 * (or a question rise) at the end.
 */
export function mumble(text: string, profile: VoiceProfile) {
  if (!voiceEnabled()) return;
  const graph = lofiPlayer.graph;
  if (!graph) return;
  // mumble is a sound effect, so it rides the SOUND slider
  const { ctx, sfx: master } = graph;

  const syllables = Math.max(3, Math.min(16, Math.round(text.length / 4)));
  const step = 1 / profile.rate;
  const t0 = ctx.currentTime + 0.03;
  const tEnd = t0 + syllables * step;
  const isQuestion = text.trimEnd().endsWith("?");

  // output chain: warm lowpass, nothing sharp survives
  const out = ctx.createGain();
  out.gain.value = 1;
  const soften = ctx.createBiquadFilter();
  soften.type = "lowpass";
  soften.frequency.value = 2200;
  out.connect(soften);
  soften.connect(master);

  // one continuous voice: triangle body + sine sub an octave below
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  const sub = ctx.createOscillator();
  sub.type = "sine";

  // gentle vibrato on both
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.1;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 14; // cents
  lfo.connect(lfoDepth);
  lfoDepth.connect(osc.detune);
  lfoDepth.connect(sub.detune);

  // amplitude: syllable swells that never fully close — legato
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, t0);

  // vowel color: one formant gliding per syllable
  const formant = ctx.createBiquadFilter();
  formant.type = "bandpass";
  formant.frequency.setValueAtTime(profile.formant, t0);
  formant.Q.value = 1.8;

  const body = ctx.createGain();
  body.gain.value = 0.4;
  osc.connect(body);
  body.connect(amp);
  const mouth = ctx.createGain();
  mouth.gain.value = 0.8;
  osc.connect(formant);
  formant.connect(mouth);
  mouth.connect(amp);
  const subGain = ctx.createGain();
  subGain.gain.value = 0.25;
  sub.connect(subGain);
  subGain.connect(amp);
  amp.connect(out);

  // the phrase: an arc that rises past the middle and resolves down
  const base = profile.pitch;
  let prevHz = base;
  osc.frequency.setValueAtTime(prevHz, t0);
  sub.frequency.setValueAtTime(prevHz / 2, t0);

  for (let i = 0; i < syllables; i++) {
    const at = t0 + i * step;
    const progress = syllables > 1 ? i / (syllables - 1) : 0;

    // melodic target: contour + a wander, quantized to the scale
    const arc = Math.sin(Math.PI * progress) * 5;
    const wander = (Math.random() - 0.5) * 4;
    let semis = nearestDegree(arc + wander);
    if (i === syllables - 1) semis = isQuestion ? 9 : -3;
    const hz = base * 2 ** (semis / 12);

    // portamento into the syllable, hold, then onward
    osc.frequency.setValueAtTime(prevHz, at);
    osc.frequency.linearRampToValueAtTime(hz, at + step * 0.35);
    sub.frequency.setValueAtTime(prevHz / 2, at);
    sub.frequency.linearRampToValueAtTime(hz / 2, at + step * 0.35);
    prevHz = hz;

    // syllable swell: rise, sing, dip — but never to silence mid-phrase
    const accent = i === 0 || Math.random() < 0.25 ? 0.36 : 0.3;
    amp.gain.linearRampToValueAtTime(accent, at + step * 0.3);
    amp.gain.linearRampToValueAtTime(0.16, at + step * 0.85);

    // vowel shift: the mouth opens differently on every syllable
    const vowel = profile.formant * (0.7 + Math.random() * 0.7);
    formant.frequency.linearRampToValueAtTime(vowel, at + step * 0.5);

    // a soft breath under some syllables
    if (i % 4 === 3) {
      const len = step * 0.8;
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let n = 0; n < data.length; n++) {
        data[n] = (Math.random() * 2 - 1) * (1 - n / data.length);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const nf = ctx.createBiquadFilter();
      nf.type = "bandpass";
      nf.frequency.value = 1500;
      const ng = ctx.createGain();
      ng.gain.value = 0.04;
      noise.connect(nf);
      nf.connect(ng);
      ng.connect(out);
      noise.start(at);
    }
  }

  // let the last note breathe out
  amp.gain.linearRampToValueAtTime(0.0001, tEnd + 0.25);

  osc.start(t0);
  sub.start(t0);
  lfo.start(t0);
  osc.stop(tEnd + 0.35);
  sub.stop(tEnd + 0.35);
  lfo.stop(tEnd + 0.35);
  window.setTimeout(
    () => {
      out.disconnect();
    },
    (tEnd - ctx.currentTime + 0.6) * 1000,
  );
}
