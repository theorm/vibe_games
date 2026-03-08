// Three.js renderer, scene, camera, and lighting — loaded once at startup
// THREE is loaded from CDN as a global; @types/three provides the types.
declare const THREE: typeof import('three');

const W = window.innerWidth;
const H = window.innerHeight;

const canvas = document.getElementById('canvas') as HTMLCanvasElement;

export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.physicallyCorrectLights = true;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.96;
renderer.setClearColor(0x87ceeb);

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87ceeb, 30, 90);

export const camera = new THREE.PerspectiveCamera(70, W / H, 0.1, 200);

export const ambient = new THREE.AmbientLight(0xfff5e0, 0.45);
scene.add(ambient);

export const sun = new THREE.DirectionalLight(0xfff8e0, 1.25);
sun.position.set(30, 60, 20);
sun.castShadow = true;
sun.shadow.mapSize.width  = 2048;
sun.shadow.mapSize.height = 2048;
const shadowCam = sun.shadow.camera as import('three').OrthographicCamera;
shadowCam.near   = 1;   shadowCam.far    = 160;
shadowCam.left   = -80; shadowCam.right  = 80;
shadowCam.top    = 80;  shadowCam.bottom = -80;
scene.add(sun);

export const moonLight = new THREE.DirectionalLight(0x334466, 0.8);
moonLight.position.set(-30, 40, -20);
scene.add(moonLight);

const skyFill = new THREE.HemisphereLight(0xddeeff, 0x2a2f3f, 0.35);
scene.add(skyFill);
