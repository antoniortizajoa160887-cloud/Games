import { profile } from './save';

/**
 * All sound is made in code with Web Audio: a generative space soundtrack that never loops the
 * same way, and synth effects. If a recorded track exists in public/audio/ (music-<name>.mp3)
 * it plays instead of the generated one.
 */

export type Track = 'home' | 'play' | 'rush' | 'zen' | 'catcher' | 'none';

let ctx: AudioContext | null = null;
let master: GainNode;
let musicBus: GainNode;
let sfxBus: GainNode;
let reverb: ConvolverNode;
let echo: DelayNode;

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  musicBus = ctx.createGain();
  sfxBus = ctx.createGain();
  musicBus.connect(master);
  sfxBus.connect(master);
  reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 3.2);
  const wet = ctx.createGain();
  wet.gain.value = 0.55;
  reverb.connect(wet).connect(master);
  echo = ctx.createDelay(1);
  echo.delayTime.value = 0.42;
  const fb = ctx.createGain();
  fb.gain.value = 0.35;
  const echoOut = ctx.createGain();
  echoOut.gain.value = 0.3;
  echo.connect(fb).connect(echo);
  echo.connect(echoOut).connect(reverb);
  applyVolumes();
  return ctx;
}

function impulse(c: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return buf;
}

export function applyVolumes() {
  if (!ctx) return;
  musicBus.gain.setTargetAtTime(profile.settings.music * 0.5, ctx.currentTime, 0.1);
  sfxBus.gain.setTargetAtTime(profile.settings.sfx, ctx.currentTime, 0.05);
  if (fileMusic) fileMusic.volume = profile.settings.music * 0.7;
}

/** Browsers start audio only after a tap; call this from the first one. */
export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') void c.resume();
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function tone(freq: number, start: number, dur: number, opts: { type?: OscillatorType; gain?: number; attack?: number; to?: AudioNode; detune?: number; glideTo?: number; send?: number } = {}) {
  const c = ctx!;
  const o = c.createOscillator();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, start);
  if (opts.glideTo) o.frequency.exponentialRampToValueAtTime(opts.glideTo, start + dur);
  if (opts.detune) o.detune.value = opts.detune;
  const g = c.createGain();
  const a = opts.attack ?? 0.005;
  const peak = opts.gain ?? 0.2;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(peak, start + a);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(opts.to ?? sfxBus);
  if (opts.send) {
    const s = c.createGain();
    s.gain.value = opts.send;
    g.connect(s).connect(reverb);
  }
  o.start(start);
  o.stop(start + dur + 0.05);
}

function noise(start: number, dur: number, opts: { from: number; to: number; gain?: number; q?: number; bus?: AudioNode }) {
  const c = ctx!;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = opts.q ?? 1.2;
  f.frequency.setValueAtTime(opts.from, start);
  f.frequency.exponentialRampToValueAtTime(opts.to, start + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(opts.gain ?? 0.3, start + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(opts.bus ?? sfxBus);
  g.connect(reverb);
  src.start(start);
}

// Pentatonic notes used for merges: higher tiers ring higher and brighter.
const MERGE_NOTES = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96];

export const sfx = {
  click() {
    if (!ensure()) return;
    tone(1200, ctx!.currentTime, 0.06, { type: 'triangle', gain: 0.08 });
  },
  drop() {
    if (!ensure()) return;
    const t = ctx!.currentTime;
    tone(220, t, 0.14, { type: 'sine', gain: 0.18, glideTo: 110 });
  },
  merge(tier: number, chain: number) {
    if (!ensure()) return;
    const t = ctx!.currentTime;
    const n = MERGE_NOTES[Math.min(tier, MERGE_NOTES.length - 1)] - 12 + Math.min(chain - 1, 4) * 2;
    tone(midi(n), t, 0.5 + tier * 0.05, { type: 'triangle', gain: 0.22, send: 0.4 });
    tone(midi(n + 7), t + 0.03, 0.35, { type: 'sine', gain: 0.1, send: 0.5 });
    if (tier >= 6) tone(midi(n - 12), t, 0.9, { type: 'sine', gain: 0.2, send: 0.6 });
  },
  chain(n: number) {
    if (!ensure()) return;
    const t = ctx!.currentTime;
    for (let i = 0; i < Math.min(n, 5); i++) tone(midi(84 + i * 3), t + i * 0.05, 0.25, { type: 'sine', gain: 0.07, send: 0.5 });
  },
  pulse() {
    if (!ensure()) return;
    const t = ctx!.currentTime;
    noise(t, 0.7, { from: 200, to: 2400, gain: 0.35 });
    tone(80, t, 0.6, { type: 'sine', gain: 0.3, glideTo: 160 });
  },
  supernova() {
    if (!ensure()) return;
    const t = ctx!.currentTime;
    noise(t, 2.2, { from: 3000, to: 120, gain: 0.5, q: 0.6 });
    tone(55, t, 2.5, { type: 'sine', gain: 0.45, glideTo: 30 });
    for (const [i, n] of [72, 76, 79, 84, 88].entries()) tone(midi(n), t + 0.2 + i * 0.08, 2, { type: 'triangle', gain: 0.12, attack: 0.05, send: 0.8 });
  },
  warn() {
    if (!ensure()) return;
    tone(660, ctx!.currentTime, 0.12, { type: 'square', gain: 0.05 });
  },
  gameOver() {
    if (!ensure()) return;
    const t = ctx!.currentTime;
    [67, 64, 60, 55].forEach((n, i) => tone(midi(n), t + i * 0.18, 0.6, { type: 'triangle', gain: 0.18, send: 0.5 }));
  },
  win() {
    if (!ensure()) return;
    const t = ctx!.currentTime;
    [72, 76, 79, 84, 88, 91].forEach((n, i) => tone(midi(n), t + i * 0.09, 0.7, { type: 'triangle', gain: 0.16, send: 0.6 }));
  },
  coin() {
    if (!ensure()) return;
    const t = ctx!.currentTime;
    tone(midi(88), t, 0.12, { type: 'square', gain: 0.05 });
    tone(midi(95), t + 0.07, 0.25, { type: 'square', gain: 0.05 });
  },
  pop() {
    if (!ensure()) return;
    tone(900, ctx!.currentTime, 0.12, { type: 'sine', gain: 0.2, glideTo: 200 });
  },
  hit() {
    if (!ensure()) return;
    tone(midi(84 + Math.floor(Math.random() * 3) * 2), ctx!.currentTime, 0.2, { type: 'triangle', gain: 0.15, send: 0.4 });
  },
  miss() {
    if (!ensure()) return;
    tone(150, ctx!.currentTime, 0.2, { type: 'sawtooth', gain: 0.06, glideTo: 90 });
  },
};

// ----- Generative music -----

interface Style { bpm: number; root: number; chords: number[][]; arpEvery: number; arpChance: number; bass: boolean; pad: number }

const STYLES: Record<Exclude<Track, 'none'>, Style> = {
  // Chords are semitone offsets from the root; each lasts one bar.
  home: { bpm: 70, root: 48, chords: [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]], arpEvery: 2, arpChance: 0.55, bass: true, pad: 0.07 },
  play: { bpm: 84, root: 50, chords: [[0, 4, 7, 14], [5, 9, 12, 16], [9, 12, 16, 19], [7, 11, 14, 19]], arpEvery: 2, arpChance: 0.7, bass: true, pad: 0.06 },
  rush: { bpm: 120, root: 45, chords: [[0, 3, 7, 10], [5, 8, 12, 15], [3, 7, 10, 14], [7, 10, 14, 17]], arpEvery: 1, arpChance: 0.8, bass: true, pad: 0.05 },
  zen: { bpm: 56, root: 43, chords: [[0, 7, 11, 16], [5, 12, 16, 21], [2, 9, 14, 17], [7, 14, 17, 23]], arpEvery: 4, arpChance: 0.35, bass: false, pad: 0.08 },
  catcher: { bpm: 104, root: 52, chords: [[0, 4, 7, 12], [7, 11, 14, 19], [9, 12, 16, 21], [5, 9, 12, 17]], arpEvery: 1, arpChance: 0.6, bass: true, pad: 0.05 },
};
const PENTA = [0, 2, 4, 7, 9];

let current: Track = 'none';
let timer: number | undefined;
let nextBeat = 0;
let beat = 0;
let fileMusic: HTMLAudioElement | null = null;
const missingFiles = new Set<string>();

export function playMusic(track: Track) {
  if (track === current) return;
  current = track;
  stopScheduler();
  if (fileMusic) { fileMusic.pause(); fileMusic = null; }
  if (track === 'none') return;
  if (!missingFiles.has(track)) {
    const a = new Audio(`audio/music-${track}.mp3`);
    a.loop = true;
    a.volume = profile.settings.music * 0.7;
    a.addEventListener('error', () => { missingFiles.add(track); if (current === track) startScheduler(track); }, { once: true });
    a.play().then(() => { if (current === track) fileMusic = a; else a.pause(); }).catch(() => { missingFiles.add(track); if (current === track) startScheduler(track); });
    return;
  }
  startScheduler(track);
}

function stopScheduler() {
  if (timer !== undefined) window.clearInterval(timer);
  timer = undefined;
}

function startScheduler(track: Exclude<Track, 'none'>) {
  const c = ensure();
  if (!c) return;
  stopScheduler();
  const style = STYLES[track];
  nextBeat = c.currentTime + 0.1;
  beat = 0;
  let lastArp = 0;
  timer = window.setInterval(() => {
    if (!ctx || current !== track) return;
    const spb = 60 / style.bpm / 2; // eighth notes
    while (nextBeat < ctx.currentTime + 0.3) {
      const bar = Math.floor(beat / 8);
      const chord = style.chords[bar % style.chords.length];
      const t = nextBeat;
      if (beat % 8 === 0) {
        for (const n of chord) {
          tone(midi(style.root + 12 + n), t, spb * 8.5, { type: 'triangle', gain: style.pad, attack: spb * 2, to: musicBus, detune: (Math.random() - 0.5) * 12, send: 0.7 });
        }
        if (style.bass) tone(midi(style.root - 12 + chord[0]), t, spb * 7, { type: 'sine', gain: 0.22, attack: 0.03, to: musicBus });
      }
      if (style.bass && beat % 8 === 4) tone(midi(style.root - 12 + chord[0] + 7), t, spb * 3, { type: 'sine', gain: 0.12, attack: 0.03, to: musicBus });
      if (beat % style.arpEvery === 0 && Math.random() < style.arpChance) {
        // A gentle random walk over the pentatonic scale, kept near the last note.
        const step = Math.floor(Math.random() * 3) - 1;
        lastArp = Math.max(0, Math.min(9, lastArp + step + (Math.random() < 0.2 ? 2 : 0)));
        const oct = Math.floor(lastArp / 5);
        const n = style.root + 24 + oct * 12 + PENTA[lastArp % 5] + chord[0] % 12;
        const g = ctx.createGain();
        g.gain.value = 1;
        g.connect(musicBus);
        g.connect(echo);
        tone(midi(n), t, spb * 3, { type: 'sine', gain: 0.09, to: g, send: 0.3 });
      }
      nextBeat += spb;
      beat++;
    }
  }, 60);
}

/** Pause music while the app is in the background. */
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) { void ctx.suspend(); fileMusic?.pause(); }
  else { void ctx.resume(); void fileMusic?.play().catch(() => {}); }
});
