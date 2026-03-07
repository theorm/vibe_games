// Touch controls for keyboard-less devices (phones/tablets)
import { gameState, keys } from './state.js';

interface TouchControlHooks {
  onStart: () => void;
  onAction: () => void;
  onToggleCamera: () => void;
}

const TAP_MS = 230;
const TAP_MOVE_PX = 18;

let touchControlsEnabled = false;

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

  const controlsEl = document.getElementById('touch-controls');
  const zonesEl = document.getElementById('touch-zones');
  const viewBtn = document.getElementById('touch-view-btn');

  if (!controlsEl || !zonesEl || !viewBtn) return;

  const clearDirectionalKeys = (): void => {
    keys.ArrowLeft = false;
    keys.ArrowRight = false;
    keys.ArrowUp = false;
    keys.ArrowDown = false;
  };

  const setDirectionFromPoint = (clientX: number, clientY: number): void => {
    const dx = clientX - window.innerWidth / 2;
    const dy = clientY - window.innerHeight / 2;
    clearDirectionalKeys();
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) keys.ArrowLeft = true;
      else keys.ArrowRight = true;
      return;
    }
    if (dy < 0) keys.ArrowUp = true;
    else keys.ArrowDown = true;
  };

  const enableTouchControls = (): void => {
    touchControlsEnabled = true;
    gameState.inputProfile = 'touch';
    controlsEl.style.display = 'block';
  };

  let movementPointerId: number | null = null;
  let downX = 0;
  let downY = 0;
  let downTs = 0;

  viewBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    hooks.onStart();
    hooks.onToggleCamera();
  });

  zonesEl.addEventListener('pointerdown', (ev: PointerEvent) => {
    ev.preventDefault();
    hooks.onStart();
    if (movementPointerId !== null) return;
    movementPointerId = ev.pointerId;
    downX = ev.clientX;
    downY = ev.clientY;
    downTs = performance.now();
    zonesEl.setPointerCapture(ev.pointerId);
    setDirectionFromPoint(ev.clientX, ev.clientY);
  });

  zonesEl.addEventListener('pointermove', (ev: PointerEvent) => {
    if (movementPointerId !== ev.pointerId) return;
    ev.preventDefault();
    setDirectionFromPoint(ev.clientX, ev.clientY);
  });

  const finishMovementPointer = (ev: PointerEvent): void => {
    if (movementPointerId !== ev.pointerId) return;
    const elapsed = performance.now() - downTs;
    const moved = Math.hypot(ev.clientX - downX, ev.clientY - downY);
    movementPointerId = null;
    clearDirectionalKeys();
    if (zonesEl.hasPointerCapture(ev.pointerId)) zonesEl.releasePointerCapture(ev.pointerId);
    if (elapsed <= TAP_MS && moved <= TAP_MOVE_PX) hooks.onAction();
  };

  zonesEl.addEventListener('pointerup', finishMovementPointer);
  zonesEl.addEventListener('pointercancel', finishMovementPointer);

  enableTouchControls();
}
