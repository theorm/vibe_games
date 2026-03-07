// Workbench placement
declare const THREE: typeof import('three');

import { scene } from './scene.js';
import { gameState } from './state.js';

export function placeWorkbench(x: number, z: number): void {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.7, 0.8),
    new THREE.MeshLambertMaterial({ color: 0x8b6523 })
  );
  mesh.position.set(x, 0.35, z); mesh.castShadow = true; scene.add(mesh);

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.06, 0.8),
    new THREE.MeshLambertMaterial({ color: 0xa07830 })
  );
  top.position.set(x, 0.73, z); scene.add(top);

  gameState.built.workbench = true;
  gameState.workbenchPos = new THREE.Vector3(x, 0, z);
}
