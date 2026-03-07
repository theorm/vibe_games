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

function hasTouchCapability(): boolean {
  return navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
}

function isLikelyTouchFirstDevice(): boolean {
  const coarsePointer =
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(any-pointer: coarse)').matches;
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent);
  const ipadDesktopUA = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return hasTouchCapability() && (coarsePointer || mobileUA || ipadDesktopUA);
}

export function isTouchControlsEnabled(): boolean {
  return touchControlsEnabled;
}

export function initTouchControls(hooks: TouchControlHooks): void {
  if (!hasTouchCapability()) return;

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
    if (touchControlsEnabled) return;
    touchControlsEnabled = true;
    gameState.inputProfile = 'touch';
    controlsEl.style.display = 'block';
  };

  let movementPointerId: number | null = null;
  let movementTouchId: number | null = null;
  let activeInputMode: 'pointer' | 'touch' | null = null;
  let downX = 0;
  let downY = 0;
  let downTs = 0;

  const beginMovement = (x: number, y: number): void => {
    hooks.onStart();
    downX = x;
    downY = y;
    downTs = performance.now();
    setDirectionFromPoint(x, y);
  };

  const endMovement = (x: number, y: number): void => {
    const elapsed = performance.now() - downTs;
    const moved = Math.hypot(x - downX, y - downY);
    clearDirectionalKeys();
    activeInputMode = null;
    if (elapsed <= TAP_MS && moved <= TAP_MOVE_PX) hooks.onAction();
  };

  let lastViewTapAt = 0;
  const onViewTap = (ev: Event): void => {
    ev.preventDefault();
    const now = performance.now();
    if (now - lastViewTapAt < 220) return;
    lastViewTapAt = now;
    hooks.onStart();
    hooks.onToggleCamera();
  };

  viewBtn.addEventListener('pointerdown', onViewTap);
  viewBtn.addEventListener('touchstart', onViewTap, { passive: false });
  viewBtn.addEventListener('click', onViewTap);

  zonesEl.addEventListener('pointerdown', (ev: PointerEvent) => {
    if (activeInputMode && activeInputMode !== 'pointer') return;
    ev.preventDefault();
    enableTouchControls();
    activeInputMode = 'pointer';
    movementPointerId = ev.pointerId;
    zonesEl.setPointerCapture(ev.pointerId);
    beginMovement(ev.clientX, ev.clientY);
  });

  zonesEl.addEventListener('pointermove', (ev: PointerEvent) => {
    if (activeInputMode !== 'pointer' || movementPointerId !== ev.pointerId) return;
    ev.preventDefault();
    setDirectionFromPoint(ev.clientX, ev.clientY);
  });

  const finishPointerMovement = (ev: PointerEvent): void => {
    if (activeInputMode !== 'pointer' || movementPointerId !== ev.pointerId) return;
    movementPointerId = null;
    if (zonesEl.hasPointerCapture(ev.pointerId)) zonesEl.releasePointerCapture(ev.pointerId);
    endMovement(ev.clientX, ev.clientY);
  };

  zonesEl.addEventListener('pointerup', finishPointerMovement);
  zonesEl.addEventListener('pointercancel', finishPointerMovement);

  zonesEl.addEventListener('touchstart', (ev: TouchEvent) => {
    if (activeInputMode && activeInputMode !== 'touch') return;
    if (ev.touches.length === 0) return;
    ev.preventDefault();
    enableTouchControls();
    const touch = ev.changedTouches[0];
    activeInputMode = 'touch';
    movementTouchId = touch.identifier;
    beginMovement(touch.clientX, touch.clientY);
  }, { passive: false });

  zonesEl.addEventListener('touchmove', (ev: TouchEvent) => {
    if (activeInputMode !== 'touch' || movementTouchId === null) return;
    const touch = Array.from(ev.changedTouches).find(t => t.identifier === movementTouchId);
    if (!touch) return;
    ev.preventDefault();
    setDirectionFromPoint(touch.clientX, touch.clientY);
  }, { passive: false });

  const finishTouchMovement = (ev: TouchEvent): void => {
    if (activeInputMode !== 'touch' || movementTouchId === null) return;
    const touch = Array.from(ev.changedTouches).find(t => t.identifier === movementTouchId);
    if (!touch) return;
    movementTouchId = null;
    endMovement(touch.clientX, touch.clientY);
  };

  zonesEl.addEventListener('touchend', finishTouchMovement, { passive: false });
  zonesEl.addEventListener('touchcancel', finishTouchMovement, { passive: false });

  if (isLikelyTouchFirstDevice()) enableTouchControls();
}
