// Touch/trackpad controls for keyboard-less devices (phones/tablets)
import { gameState, keys } from './state.js';

interface TouchControlHooks {
  onStart: () => void;
  onAction: () => void;
  onToggleCamera: () => void;
  onOfferShown: () => void;
}

const PAD_RADIUS = 56;
const DEADZONE = 0.28;

let touchControlsEnabled = false;

function setDirectionalKeys(nx: number, ny: number): void {
  keys.ArrowLeft = nx < -DEADZONE;
  keys.ArrowRight = nx > DEADZONE;
  keys.ArrowUp = ny < -DEADZONE;
  keys.ArrowDown = ny > DEADZONE;
}

function resetDirectionalKeys(): void {
  setDirectionalKeys(0, 0);
}

function isLikelyKeyboardlessDevice(): boolean {
  const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  const coarsePointer =
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(any-pointer: coarse)').matches;
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent);
  return hasTouch && (coarsePointer || mobileUA);
}

export function isTouchControlsEnabled(): boolean {
  return touchControlsEnabled;
}

export function initTouchControls(hooks: TouchControlHooks): void {
  if (!isLikelyKeyboardlessDevice()) return;

  const offerEl = document.getElementById('touch-offer');
  const enableBtn = document.getElementById('touch-enable');
  const dismissBtn = document.getElementById('touch-dismiss');
  const controlsEl = document.getElementById('touch-controls');
  const padEl = document.getElementById('touch-pad');
  const stickEl = document.getElementById('touch-stick');
  const actionBtn = document.getElementById('touch-action');
  const cameraBtn = document.getElementById('touch-camera');

  if (
    !offerEl || !enableBtn || !dismissBtn || !controlsEl ||
    !padEl || !stickEl || !actionBtn || !cameraBtn
  ) return;

  hooks.onOfferShown();
  offerEl.style.display = 'flex';

  const centerStick = (): void => {
    stickEl.style.transform = 'translate(-50%, -50%)';
  };

  let padPointerId: number | null = null;

  const enableTouchControls = (): void => {
    if (touchControlsEnabled) return;
    touchControlsEnabled = true;
    gameState.inputProfile = 'touch';
    controlsEl.style.display = 'block';
    offerEl.style.display = 'none';
    centerStick();
  };

  const updatePadFromPoint = (clientX: number, clientY: number): void => {
    const rect = padEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rawDx = clientX - cx;
    const rawDy = clientY - cy;
    const dist = Math.hypot(rawDx, rawDy);
    const scale = dist > PAD_RADIUS ? PAD_RADIUS / dist : 1;
    const dx = rawDx * scale;
    const dy = rawDy * scale;

    const nx = dx / PAD_RADIUS;
    const ny = dy / PAD_RADIUS;
    setDirectionalKeys(nx, ny);
    stickEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  };

  enableBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    enableTouchControls();
    hooks.onStart();
  });

  dismissBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    offerEl.style.display = 'none';
  });

  actionBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    hooks.onStart();
    hooks.onAction();
  });

  cameraBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    hooks.onStart();
    hooks.onToggleCamera();
  });

  padEl.addEventListener('pointerdown', (ev: PointerEvent) => {
    if (!touchControlsEnabled) return;
    ev.preventDefault();
    hooks.onStart();
    padPointerId = ev.pointerId;
    padEl.setPointerCapture(ev.pointerId);
    updatePadFromPoint(ev.clientX, ev.clientY);
  });

  padEl.addEventListener('pointermove', (ev: PointerEvent) => {
    if (!touchControlsEnabled || padPointerId !== ev.pointerId) return;
    ev.preventDefault();
    updatePadFromPoint(ev.clientX, ev.clientY);
  });

  const endPadPointer = (ev: PointerEvent): void => {
    if (padPointerId !== ev.pointerId) return;
    padPointerId = null;
    resetDirectionalKeys();
    centerStick();
    if (padEl.hasPointerCapture(ev.pointerId)) padEl.releasePointerCapture(ev.pointerId);
  };

  padEl.addEventListener('pointerup', endPadPointer);
  padEl.addEventListener('pointercancel', endPadPointer);
}
