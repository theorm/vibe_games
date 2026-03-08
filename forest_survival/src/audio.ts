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

/** Updates the Web Audio listener to match the camera's position for spatial audio. */
export function updateAudioListener(x: number, y: number, z: number, forwardX: number, forwardY: number, forwardZ: number): void {
  if (!audioCtx) return;
  const l = audioCtx.listener;
  if (l.positionX) {
    const now = audioCtx.currentTime;
    l.positionX.setTargetAtTime(x, now, 0.1);
    l.positionY.setTargetAtTime(y, now, 0.1);
    l.positionZ.setTargetAtTime(z, now, 0.1);
    l.forwardX.setTargetAtTime(forwardX, now, 0.1);
    l.forwardY.setTargetAtTime(forwardY, now, 0.1);
    l.forwardZ.setTargetAtTime(forwardZ, now, 0.1);
  } else {
    // Fallback for older browsers
    (l as any).setPosition(x, y, z);
    (l as any).setOrientation(forwardX, forwardY, forwardZ, 0, 1, 0);
  }
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

function createPanner(pos?: { x: number, y: number, z: number }): AudioNode {
  if (!audioCtx || !pos) return sfxMasterGain!;
  const panner = audioCtx.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'exponential';
  panner.refDistance = 1;
  panner.maxDistance = 100;
  panner.rolloffFactor = 1.5;
  panner.positionX.value = pos.x;
  panner.positionY.value = pos.y;
  panner.positionZ.value = pos.z;
  panner.connect(sfxMasterGain!);
  return panner;
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

function playDeerYell(type: 'wander' | 'chase', pos?: { x: number, y: number, z: number }): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const dest = createPanner(pos);

  if (type === 'chase') {
    // A complex, aggressive bellow
    const osc = audioCtx.createOscillator(), osc2 = audioCtx.createOscillator();
    const filter = audioCtx.createBiquadFilter(), gain = audioCtx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180 + Math.random() * 40, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.6);
    
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(60, now);
    osc2.frequency.linearRampToValueAtTime(40, now + 0.8);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.8);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.6, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    
    osc.connect(filter); osc2.connect(filter); filter.connect(gain); gain.connect(dest);
    osc.start(now); osc.stop(now + 1); osc2.start(now); osc2.stop(now + 1);

    // Second "huff"
    setTimeout(() => {
      if (!audioCtx) return;
      const n2 = audioCtx.currentTime;
      const s = audioCtx.createOscillator(), g = audioCtx.createGain(), f = audioCtx.createBiquadFilter();
      s.type = 'sawtooth';
      s.frequency.setValueAtTime(320 + Math.random() * 80, n2);
      s.frequency.exponentialRampToValueAtTime(120, n2 + 0.3);
      f.type = 'lowpass'; f.frequency.value = 600;
      g.gain.setValueAtTime(0.4, n2); g.gain.exponentialRampToValueAtTime(0.001, n2 + 0.4);
      s.connect(f); f.connect(g); g.connect(dest); s.start(n2); s.stop(n2 + 0.5);
    }, 400);
  } else {
    // Eerie, haunting bugle
    const osc = audioCtx.createOscillator(), mod = audioCtx.createOscillator(), modG = audioCtx.createGain();
    const rev2 = makeReverb(audioCtx, 3.0, 2.5); rev2.connect(dest);
    const gain = audioCtx.createGain();
    
    const baseFreq = 160 + Math.random() * 60;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.6);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, now + 1.8);
    
    mod.type = 'sawtooth'; mod.frequency.value = 45; modG.gain.value = baseFreq * 0.2;
    mod.connect(modG); modG.connect(osc.frequency);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
    
    osc.connect(gain); gain.connect(rev2);
    osc.start(now); osc.stop(now + 2.0); mod.start(now); mod.stop(now + 2.0);
  }
}

function playDeerAttackRoar(pos?: { x: number, y: number, z: number }): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const dest = createPanner(pos);
  
  // Layered noise and low oscillators for a guttural roar
  const bufLen = audioCtx.sampleRate * 0.8;
  const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2);
  
  const src = audioCtx.createBufferSource(), f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
  src.buffer = buf; f.type = 'lowpass'; f.frequency.setValueAtTime(800, now); f.frequency.exponentialRampToValueAtTime(150, now + 0.6);
  g.gain.setValueAtTime(1.0, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
  src.connect(f); f.connect(g); g.connect(dest); src.start(now);

  const sub = audioCtx.createOscillator(), subG = audioCtx.createGain();
  sub.type = 'sawtooth'; sub.frequency.setValueAtTime(120, now); sub.frequency.linearRampToValueAtTime(40, now + 0.5);
  subG.gain.setValueAtTime(0.6, now); subG.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  sub.connect(subG); subG.connect(dest); sub.start(now); sub.stop(now + 0.6);
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
  const dur = 0.5 + Math.random() * 0.2;
  const bufLen = audioCtx.sampleRate * dur;
  const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  
  const baseFreq = 80 + Math.random() * 20;
  for (let i = 0; i < bufLen; i++) {
    const t = i / audioCtx.sampleRate;
    const env = Math.pow(Math.sin(Math.PI * i / bufLen), 0.3) * (1 - t/dur);
    // Guttural modulation
    const mod = 1 + 0.4 * Math.sin(2 * Math.PI * 30 * t);
    const noise = (Math.random() * 2 - 1) * 0.4;
    const tone = Math.sin(2 * Math.PI * baseFreq * t * (1 - t * 0.5));
    d[i] = (tone + noise) * env * mod * 0.6;
  }
  
  const src = audioCtx.createBufferSource(), filt = audioCtx.createBiquadFilter(), gain = audioCtx.createGain();
  src.buffer = buf; 
  filt.type = 'lowpass'; filt.frequency.value = 600; 
  gain.gain.value = 0.8;
  src.connect(filt); filt.connect(gain); gain.connect(sfxMasterGain!); 
  src.start(now);
  showFloatingText('💨 *burp*');
}

function playWhistle(): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  // A more natural "human" whistle: sine with slight vibrato + subtle breath noise
  const tunes = [
    [72, 76, 74], [74, 72, 67], [76, 79, 76], [67, 72, 74]
  ];
  const tune = tunes[Math.floor(Math.random() * tunes.length)];
  
  tune.forEach((mn, idx) => {
    const t = now + idx * 0.35;
    const dur = 0.3;
    const freq = note(mn);
    
    const osc = audioCtx!.createOscillator(), vib = audioCtx!.createOscillator(), vibG = audioCtx!.createGain();
    const gain = audioCtx!.createGain(), noise = audioCtx!.createBufferSource();
    
    // Vibrato
    vib.frequency.value = 5 + Math.random() * 2;
    vibG.gain.value = freq * 0.015;
    vib.connect(vibG); vibG.connect(osc.frequency);
    
    osc.type = 'sine'; osc.frequency.value = freq;
    
    // Breath noise
    const nBuf = audioCtx!.createBuffer(1, audioCtx!.sampleRate * dur, audioCtx!.sampleRate);
    const nData = nBuf.getChannelData(0);
    for (let i = 0; i < nData.length; i++) nData[i] = (Math.random() * 2 - 1) * 0.02;
    noise.buffer = nBuf;
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    
    osc.connect(gain); noise.connect(gain); gain.connect(sfxMasterGain!);
    osc.start(t); osc.stop(t + dur);
    vib.start(t); vib.stop(t + dur);
    noise.start(t); noise.stop(t + dur);
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

function playSfxChop(pos?: { x: number, y: number, z: number }): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const dest = createPanner(pos);

  // 1. "Thud" - low frequency sine sweep
  const thud = audioCtx.createOscillator(), thudG = audioCtx.createGain();
  thud.type = 'sine'; thud.frequency.setValueAtTime(140, now); thud.frequency.exponentialRampToValueAtTime(40, now + 0.1);
  thudG.gain.setValueAtTime(0.6, now); thudG.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  thud.connect(thudG); thudG.connect(dest); thud.start(now); thud.stop(now + 0.2);

  // 2. "Crack" - filtered noise
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.15, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const src = audioCtx.createBufferSource(), filt = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
  src.buffer = buf; filt.type = 'bandpass'; filt.frequency.value = 1200; filt.Q.value = 1.2; g.gain.value = 0.5;
  src.connect(filt); filt.connect(g); g.connect(dest); src.start(now);
}

function playSfxSwing(pos?: { x: number, y: number, z: number }): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const dest = createPanner(pos);

  // Whoosh sound using filtered noise
  const bufLen = audioCtx.sampleRate * 0.25;
  const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
  
  const src = audioCtx.createBufferSource(), f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
  src.buffer = buf;
  f.type = 'bandpass';
  f.frequency.setValueAtTime(400, now);
  f.frequency.exponentialRampToValueAtTime(1800, now + 0.08);
  f.frequency.exponentialRampToValueAtTime(600, now + 0.2);
  f.Q.value = 1.5;
  
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.4, now + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  
  src.connect(f); f.connect(g); g.connect(dest); src.start(now);
}

function playSfxCraft(pos?: { x: number, y: number, z: number }): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const dest = createPanner(pos);
  
  [0, 0.08, 0.16].forEach((delay, i) => {
    const osc = audioCtx!.createOscillator(), g = audioCtx!.createGain();
    osc.type = 'triangle'; osc.frequency.value = note(72 + i * 5);
    g.gain.setValueAtTime(0.2, now + delay); g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.2);
    osc.connect(g); g.connect(dest); osc.start(now + delay); osc.stop(now + delay + 0.25);
  });
}

export function sfxStep(pos: { x: number, y: number, z: number }, type: 'grass' | 'wood' = 'grass'): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const dest = createPanner(pos);
  
  const bufLen = audioCtx.sampleRate * 0.08;
  const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  
  const src = audioCtx.createBufferSource(), f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
  src.buffer = buf;
  f.type = 'bandpass';
  f.frequency.value = type === 'grass' ? 400 : 250;
  f.Q.value = 1.0;
  g.gain.value = 0.15;
  
  src.connect(f); f.connect(g); g.connect(dest); src.start(now);
}

function playSfxDeerStep(pos: { x: number, y: number, z: number }): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const dest = createPanner(pos);
  
  // Heavier, duller thud for a large animal
  const bufLen = audioCtx.sampleRate * 0.12;
  const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5);
  
  const src = audioCtx.createBufferSource(), f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
  src.buffer = buf;
  f.type = 'lowpass';
  f.frequency.value = 200;
  g.gain.value = 0.25;
  
  src.connect(f); f.connect(g); g.connect(dest); src.start(now);
}

export function sfxAlien(pos: { x: number, y: number, z: number }): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const dest = createPanner(pos);
  const osc = audioCtx.createOscillator(), lfo = audioCtx.createOscillator(), lfoG = audioCtx.createGain();
  osc.type = 'sine'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
  lfo.type = 'square'; lfo.frequency.value = 25; lfoG.gain.value = 150;
  lfo.connect(lfoG); lfoG.connect(osc.frequency);
  const g = audioCtx.createGain(); g.gain.setValueAtTime(0.2, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  osc.connect(g); g.connect(dest); osc.start(now); osc.stop(now + 0.4); lfo.start(now); lfo.stop(now + 0.4);
}

export function sfxZombie(pos: { x: number, y: number, z: number }): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const dest = createPanner(pos);
  const osc = audioCtx.createOscillator(), filt = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
  osc.type = 'sawtooth'; osc.frequency.setValueAtTime(70, now); osc.frequency.linearRampToValueAtTime(45, now + 0.6);
  filt.type = 'lowpass'; filt.frequency.value = 350;
  g.gain.setValueAtTime(0.5, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
  osc.connect(filt); filt.connect(g); g.connect(dest); osc.start(now); osc.stop(now + 0.8);
}

export function sfxSquash(pos: { x: number, y: number, z: number }): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const dest = createPanner(pos);
  const bufLen = audioCtx.sampleRate * 0.15;
  const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 0.5);
  const src = audioCtx.createBufferSource(), filt = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
  src.buffer = buf; filt.type = 'lowpass'; filt.frequency.value = 180; g.gain.value = 1.2;
  src.connect(filt); filt.connect(g); g.connect(dest); src.start(now);
}

// ── Public SFX wrappers ───────────────────────────────────

export function sfxChop(pos?: { x: number, y: number, z: number }):     void { if (audioCtx) playSfxChop(pos); }
export function sfxSwing(pos?: { x: number, y: number, z: number }):    void { if (audioCtx) playSfxSwing(pos); }
export function sfxCraft(pos?: { x: number, y: number, z: number }):    void { if (audioCtx) playSfxCraft(pos); }
export function sfxDeerRoar(pos?: { x: number, y: number, z: number }): void { if (audioCtx) playDeerAttackRoar(pos); }
export function sfxDeerStep(pos: { x: number, y: number, z: number }):   void { if (audioCtx) playSfxDeerStep(pos); }

// ── Deer ambient yell scheduler ───────────────────────────

export function startDeerYells(): void {
  if (deerYellInterval) return;
  deerYellInterval = setInterval(() => {
    if (!gameState.gameOver && !gameState.gameWon && gameState.deerAlive && audioCtx) {
      const pos = { x: gameState.deerPos?.x || 0, y: 0, z: gameState.deerPos?.z || 0 };
      if (gameState.deerState === 'chase') playDeerYell('chase', pos);
      else if (Math.random() < 0.4) playDeerYell('wander', pos);
    }
  }, 4000 + Math.random() * 5000);
}
