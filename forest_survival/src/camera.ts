// Third-person follow camera with driver's view toggle
import { camera } from './scene.js';
import { gameState } from './state.js';
import { player } from './player.js';
import { carPos } from './car.js';

export function updateCamera(): void {
  const pivot  = gameState.inCar ? carPos  : player.pos;
  const facing = gameState.inCar ? gameState.carFacing : player.facing;

  if (gameState.inCar && gameState.driverView) {
    // Driver's view: inside the car, looking forward
    const fwdX = -Math.sin(facing);
    const fwdZ = -Math.cos(facing);
    camera.position.set(
      pivot.x - fwdX * 0.2,
      1.3,
      pivot.z - fwdZ * 0.2
    );
    camera.lookAt(
      pivot.x + fwdX * 20,
      1.2,
      pivot.z + fwdZ * 20
    );
  } else {
    // Third-person follow
    camera.position.set(
      pivot.x + Math.sin(facing) * 7,
      5,
      pivot.z + Math.cos(facing) * 7
    );
    camera.lookAt(pivot.x, 1.2, pivot.z);
  }
}
