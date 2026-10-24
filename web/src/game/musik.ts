// Procedural chiptune background music (WebAudio, no files): bass + melody + hi-hat, 8-bar loop, 150 BPM.
// Starts only after a user gesture (browser autoplay rule). Toggle with `M`; choice is saved in localStorage.
const KUNCI = 'pp.musik';
const BPM = 150;
const KETUK = 60 / BPM / 2; // eighth note
// MIDI notes: cheerful melody in C major (0 = rest)
const MELODI = [72, 0, 76, 79, 0, 76, 72, 0, 74, 0, 77, 81, 0, 77, 74, 0, 76, 0, 79, 84, 0, 79, 76, 0, 77, 76, 74, 72, 0, 67, 0, 0];
const BASS = [48, 48, 55, 48, 50, 50, 57, 50, 52, 52, 59, 52, 53, 53, 55, 55];
const hz = (n: number) => 440 * 2 ** ((n - 69) / 12);

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: number | null = null;
let langkah = 0;
let berikut = 0;
let nyala = false;

function nada(waktu: number, n: number, lama: number, tipe: OscillatorType, vol: number) {
  if (!ctx || !master || n === 0) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = tipe;
  o.frequency.value = hz(n);
  g.gain.setValueAtTime(0, waktu);
  g.gain.linearRampToValueAtTime(vol, waktu + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, waktu + lama);
  o.connect(g).connect(master);
  o.start(waktu);
  o.stop(waktu + lama + 0.02);
}

function hihat(waktu: number, vol: number) {
  if (!ctx || !master) return;
  const buf = ctx.createBuffer(1, 2200, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 6000;
  const g = ctx.createGain();
  g.gain.value = vol;
  s.connect(f).connect(g).connect(master);
  s.start(waktu);
}

function jadwal() {
  if (!ctx || !nyala) return;
  while (berikut < ctx.currentTime + 0.25) {
    const i = langkah % MELODI.length;
    nada(berikut, MELODI[i], KETUK * 0.9, 'square', 0.05);
    if (langkah % 2 === 0) nada(berikut, BASS[(langkah / 2) % BASS.length], KETUK * 1.6, 'triangle', 0.11);
    hihat(berikut, langkah % 4 === 2 ? 0.05 : 0.02);
    berikut += KETUK;
    langkah++;
  }
  timer = window.setTimeout(jadwal, 100);
}

export function musikNyala() {
  return nyala;
}

/** Start music (needs a gesture). Safe to call repeatedly. */
export function mulaiMusik() {
  if (nyala) return;
  ctx ??= new AudioContext();
  if (!master) {
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  nyala = true;
  berikut = ctx.currentTime + 0.05;
  jadwal();
  try {
    localStorage.setItem(KUNCI, '1');
  } catch {}
}

/** Stop without changing the preference (when leaving the page). */
export function jedaMusik() {
  nyala = false;
  if (timer !== null) clearTimeout(timer);
  timer = null;
}

export function hentikanMusik() {
  nyala = false;
  if (timer !== null) clearTimeout(timer);
  timer = null;
  try {
    localStorage.setItem(KUNCI, '0');
  } catch {}
}

export function toggleMusik() {
  if (nyala) hentikanMusik();
  else mulaiMusik();
  return nyala;
}

/** Saved preference: on by default. */
export function musikDiinginkan() {
  try {
    return localStorage.getItem(KUNCI) !== '0';
  } catch {
    return true;
  }
}
