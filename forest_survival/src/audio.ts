// Web Audio API — fully procedural sound engine
import { gameState } from './state.js';
import { showFloatingText } from './ui.js';

let audioCtx: AudioContext | null = null;
let musicMasterGain: GainNode | null = null;
let sfxMasterGain: GainNode | null   = null;
let musicStarted = false;

let deerYellInterval: ReturnType<typeof setInterval> | null = null;

// ── Init ──────────────────────────────────────────────────

export function initAudio(): void {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  musicMasterGain = audioCtx.createGain(); musicMasterGain.gain.value = 0.18;
  sfxMasterGain   = audioCtx.createGain(); sfxMasterGain.gain.value   = 1.0;
  musicMasterGain.connect(audioCtx.destination);
  sfxMasterGain.connect(audioCtx.destination);
  startSpookyMusic();
  schedulePlayerSounds();
}

// ── Helpers ───────────────────────────────────────────────

function note(midi: number): number { return 440 * Math.pow(2, (midi - 69) / 12); }

function makeReverb(ctx: AudioContext, seconds = 2.5, decay = 2): ConvolverNode {
  const conv = ctx.createConvolver();
  const rate = ctx.sampleRate, len = rate * seconds;
  const buf  = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  conv.buffer = buf; return conv;
}

// ── Spooky background music ───────────────────────────────

function startSpookyMusic(): void {
  if (!audioCtx || musicStarted) return;
  musicStarted = true;

  const rev = makeReverb(audioCtx, 3.5, 1.8);
  rev.connect(musicMasterGain!);

  // 1. Deep drone
  const droneNotes = [36, 43];
  droneNotes.forEach((n, idx) => {
    const osc  = audioCtx!.createOscillator();
    const gain = audioCtx!.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = note(n) + (idx ? 0.4 : -0.3);
    gain.gain.value = 0.06;
    osc.connect(gain); gain.connect(rev); osc.start();
    const lfoRate = 0.05 + idx * 0.02;
    setInterval(() => {
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      const v = 0.03 + 0.05 * Math.abs(Math.sin(now * lfoRate * Math.PI));
      gain.gain.setTargetAtTime(v, now, 1.5);
    }, 200);
  });

  // 2. Violin melody
  const SPOOKY_PHRASES = [
    [60, null, 63, null, 67, 65, 63, null, 60],
    [72, 70, 68, null, 67, null, 65, 63, 60],
    [60, 63, 67, null, 70, 68, null, 65, 63],
    [67, null, 68, 65, null, 63, 60, null, 58, 60],
  ];
  let phraseIdx = 0, noteIdx = 0;
  let violinPhrase = SPOOKY_PHRASES[0];

  function playViolinNote() {
    if (!audioCtx || !musicStarted) return;
    const mn = violinPhrase[noteIdx++];
    if (noteIdx >= violinPhrase.length) { noteIdx = 0; phraseIdx = (phraseIdx + 1) % SPOOKY_PHRASES.length; violinPhrase = SPOOKY_PHRASES[phraseIdx]; }
    if (mn === null) { setTimeout(playViolinNote, 300); return; }

    const dur = 0.55 + Math.random() * 0.4;
    const freq = note(mn) + (Math.random() - 0.5) * 1.5;
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator(), vib = audioCtx.createOscillator();
    const vibGn = audioCtx.createGain(), filter = audioCtx.createBiquadFilter(), gainN = audioCtx.createGain();
    osc.type = 'sawtooth'; osc.frequency.value = freq;
    vib.type = 'sine'; vib.frequency.value = 5.5; vibGn.gain.value = 4;
    vib.connect(vibGn); vibGn.connect(osc.frequency);
    filter.type = 'bandpass'; filter.frequency.value = freq * 2; filter.Q.value = 2.5;
    gainN.gain.setValueAtTime(0, now);
    gainN.gain.linearRampToValueAtTime(0.22, now + 0.08);
    gainN.gain.setTargetAtTime(0, now + dur * 0.7, dur * 0.15);
    osc.connect(filter); filter.connect(gainN); gainN.connect(rev);
    osc.start(now); osc.stop(now + dur + 0.2);
    vib.start(now); vib.stop(now + dur + 0.2);
    setTimeout(playViolinNote, (dur + 0.05 + Math.random() * 0.2) * 1000);
  }
  setTimeout(playViolinNote, 800);

  // 3. Disturbing ocarina
  const OCARINA_MOTIFS = [
    [67, null, null, 65, null, 63, null, null, 62, null, 60],
    [60, null, 63, null, 60, null, 58, null, 60],
    [72, null, null, 70, 68, null, 65, null, null],
    [63, 65, null, 68, null, 65, 63, null, null, 60, null],
  ];
  let omIdx = 0, onIdx = 0;
  let oMotif = OCARINA_MOTIFS[0];

  function playOcarinaNote() {
    if (!audioCtx || !musicStarted) return;
    const mn = oMotif[onIdx++];
    if (onIdx >= oMotif.length) { onIdx = 0; omIdx = (omIdx + 1) % OCARINA_MOTIFS.length; oMotif = OCARINA_MOTIFS[omIdx]; }
    const dur = 0.45 + Math.random() * 0.35;
    if (mn !== null) {
      const freq = note(mn) * (0.995 + Math.random() * 0.012);
      const now = audioCtx.currentTime;
      const osc1 = audioCtx.createOscillator(), osc2 = audioCtx.createOscillator();
      const g = audioCtx.createGain(), gMix = audioCtx.createGain();
      osc1.type = 'sine'; osc1.frequency.value = freq;
      osc2.type = 'sine'; osc2.frequency.value = freq * 2.01;
      gMix.gain.value = 0.18;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.28, now + 0.06);
      g.gain.setTargetAtTime(0, now + dur * 0.65, dur * 0.12);
      osc1.connect(g); osc2.connect(gMix); gMix.connect(g);
      g.connect(rev); g.connect(musicMasterGain!);
      osc1.start(now); osc1.stop(now + dur + 0.15);
      osc2.start(now); osc2.stop(now + dur + 0.15);
    }
    setTimeout(playOcarinaNote, (dur + 0.12 + Math.random() * 0.3) * 1000);
  }
  setTimeout(playOcarinaNote, 2200);

  // 4. Eerie pizzicato plucks
  function pizzicato() {
    if (!audioCtx || !musicStarted) return;
    const pizzNotes = [36, 38, 41, 43, 46];
    const n = pizzNotes[Math.floor(Math.random() * pizzNotes.length)];
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = 'triangle'; osc.frequency.value = note(n);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc.connect(gain); gain.connect(rev);
    osc.start(now); osc.stop(now + 1.5);
    setTimeout(pizzicato, 1800 + Math.random() * 3500);
  }
  setTimeout(pizzicato, 1200);
}

// ── Deer yells ────────────────────────────────────────────

function playDeerYell(type: 'wander' | 'chase'): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  if (type === 'chase') {
    const osc = audioCtx.createOscillator(), osc2 = audioCtx.createOscillator();
    const dist = audioCtx.createWaveShaper(), gain = audioCtx.createGain();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i * 2 / 255 - 1; curve[i] = x < 0 ? -Math.pow(-x, 0.7) : Math.pow(x, 0.7) * 1.4; }
    dist.curve = curve;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280 + Math.random() * 60, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.7);
    osc2.type = 'square'; osc2.frequency.value = 37;
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc.connect(dist); dist.connect(gain); osc2.connect(gain); gain.connect(sfxMasterGain!);
    osc.start(now); osc.stop(now + 1.0); osc2.start(now); osc2.stop(now + 1.0);

    setTimeout(() => {
      if (!audioCtx) return;
      const n2 = audioCtx.currentTime;
      const s = audioCtx.createOscillator(), g = audioCtx.createGain();
      s.type = 'sawtooth';
      s.frequency.setValueAtTime(520 + Math.random() * 80, n2);
      s.frequency.exponentialRampToValueAtTime(190, n2 + 0.35);
      g.gain.setValueAtTime(0.3, n2); g.gain.exponentialRampToValueAtTime(0.001, n2 + 0.45);
      s.connect(g); g.connect(sfxMasterGain!); s.start(n2); s.stop(n2 + 0.5);
    }, 200 + Math.random() * 100);
  } else {
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    const rev2 = makeReverb(audioCtx, 2.0, 2.5); rev2.connect(sfxMasterGain!);
    osc.type = 'sine';
    const baseFreq = 200 + Math.random() * 80;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.linearRampToValueAtTime(baseFreq * 1.3, now + 0.3);
    osc.frequency.linearRampToValueAtTime(baseFreq * 0.7, now + 0.9);
    osc.frequency.linearRampToValueAtTime(baseFreq * 1.1, now + 1.4);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.4, now + 0.1);
    gain.gain.setTargetAtTime(0, now + 1.0, 0.3);
    osc.connect(gain); gain.connect(rev2); osc.start(now); osc.stop(now + 2.0);
  }
}

function playDeerAttackRoar(): void {
  if (!audioCtx) return;
  playDeerYell('chase');
  const now = audioCtx.currentTime;
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.15, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3) * 0.9;
  const src = audioCtx.createBufferSource(), filt = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
  src.buffer = buf; filt.type = 'lowpass'; filt.frequency.value = 180; g.gain.value = 1.2;
  src.connect(filt); filt.connect(g); g.connect(sfxMasterGain!); src.start(now);
}

// ── Player comedy sounds ──────────────────────────────────

function schedulePlayerSounds(): void {
  const delay = (8 + Math.random() * 12) * 1000;
  setTimeout(() => {
    if (!gameState.gameOver && !gameState.gameWon && audioCtx) {
      const r = Math.random();
      if (r < 0.33) playBurp();
      else if (r < 0.66) playWhistle();
      else playFart();
    }
    schedulePlayerSounds();
  }, delay);
}

function playBurp(): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const bufLen = audioCtx.sampleRate * 0.45;
  const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    const t = i / audioCtx.sampleRate;
    const env = Math.pow(Math.sin(Math.PI * i / bufLen), 0.4);
    d[i] = (Math.random() * 2 - 1) * 0.3 * env + Math.sin(2 * Math.PI * 90 * t * Math.pow(1 - t * 0.8, 0.5)) * 0.6 * env;
  }
  const src = audioCtx.createBufferSource(), filt = audioCtx.createBiquadFilter(), gain = audioCtx.createGain();
  src.buffer = buf; filt.type = 'bandpass'; filt.frequency.value = 220; filt.Q.value = 1.8; gain.gain.value = 0.7;
  src.connect(filt); filt.connect(gain); gain.connect(sfxMasterGain!); src.start(now);
  showFloatingText('💨 *burp*');
}

function playWhistle(): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const tunes = [[72, 74], [74, 72], [76, 74], [69, 71]];
  const tune = tunes[Math.floor(Math.random() * tunes.length)];
  tune.forEach((mn, idx) => {
    const t = now + idx * 0.28;
    const freq = note(mn) + (Math.random() - 0.5) * 3;
    const osc = audioCtx!.createOscillator(), noise_osc = audioCtx!.createOscillator();
    const gain = audioCtx!.createGain(), nGain = audioCtx!.createGain();
    osc.type = 'sine'; osc.frequency.value = freq;
    noise_osc.type = 'sawtooth'; noise_osc.frequency.value = freq * 8;
    nGain.gain.value = 0.02;
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.55, t + 0.04);
    gain.gain.setTargetAtTime(0, t + 0.18, 0.05);
    osc.connect(gain); noise_osc.connect(nGain); nGain.connect(gain); gain.connect(sfxMasterGain!);
    osc.start(t); osc.stop(t + 0.35); noise_osc.start(t); noise_osc.stop(t + 0.35);
  });
  showFloatingText('🎵 *whistle*');
}

function playFart(): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const dur = 0.3 + Math.random() * 0.4;
  const bufLen = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  const baseFreq = 60 + Math.random() * 40, flutterRate = 18 + Math.random() * 12;
  for (let i = 0; i < bufLen; i++) {
    const t = i / audioCtx.sampleRate;
    const env = Math.pow(Math.sin(Math.PI * i / bufLen), 0.5) * (1 - t / dur * 0.3);
    const flutter = 0.5 + 0.5 * Math.sin(2 * Math.PI * flutterRate * t);
    d[i] = (Math.random() * 2 - 1) * 0.4 * flutter * env + Math.sin(2 * Math.PI * baseFreq * (1 + t * 0.3) * t) * 0.6 * flutter * env;
  }
  const src = audioCtx.createBufferSource(), filt = audioCtx.createBiquadFilter(), gain = audioCtx.createGain();
  src.buffer = buf; filt.type = 'lowpass'; filt.frequency.value = 400; gain.gain.value = 0.65;
  src.connect(filt); filt.connect(gain); gain.connect(sfxMasterGain!); src.start(now);
  showFloatingText('💨 *pfffft*');
}

// ── SFX ──────────────────────────────────────────────────

function playSfxChop(): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.12, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5);
  const src = audioCtx.createBufferSource(), filt = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
  src.buffer = buf; filt.type = 'bandpass'; filt.frequency.value = 800; filt.Q.value = 0.8; g.gain.value = 0.4;
  src.connect(filt); filt.connect(g); g.connect(sfxMasterGain!); src.start(now);
}

function playSfxSwing(): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(900, now); osc.frequency.exponentialRampToValueAtTime(200, now + 0.18);
  gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(gain); gain.connect(sfxMasterGain!); osc.start(now); osc.stop(now + 0.25);
}

function playSfxCraft(): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  [0, 0.1, 0.2].forEach((delay, i) => {
    const osc = audioCtx!.createOscillator(), g = audioCtx!.createGain();
    osc.type = 'sine'; osc.frequency.value = note(60 + i * 4);
    g.gain.setValueAtTime(0.25, now + delay); g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.18);
    osc.connect(g); g.connect(sfxMasterGain!); osc.start(now + delay); osc.stop(now + delay + 0.2);
  });
}

// ── Public SFX wrappers ───────────────────────────────────

export function sfxChop():     void { if (audioCtx) playSfxChop(); }
export function sfxSwing():    void { if (audioCtx) playSfxSwing(); }
export function sfxCraft():    void { if (audioCtx) playSfxCraft(); }
export function sfxDeerRoar(): void { if (audioCtx) playDeerAttackRoar(); }

// ── Deer ambient yell scheduler ───────────────────────────

export function startDeerYells(): void {
  if (deerYellInterval) return;
  deerYellInterval = setInterval(() => {
    if (!gameState.gameOver && !gameState.gameWon && gameState.deerAlive && audioCtx) {
      if (gameState.deerState === 'chase') playDeerYell('chase');
      else if (Math.random() < 0.4) playDeerYell('wander');
    }
  }, 4000 + Math.random() * 5000);
}
