(function() {
	//#region src/scene.ts
	const W = window.innerWidth;
	const H = window.innerHeight;
	const canvas = document.getElementById("canvas");
	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: true
	});
	renderer.setSize(W, H);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.physicallyCorrectLights = true;
	renderer.outputEncoding = THREE.sRGBEncoding;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = .96;
	renderer.setClearColor(8900331);
	const scene = new THREE.Scene();
	scene.fog = new THREE.Fog(8900331, 30, 90);
	const camera = new THREE.PerspectiveCamera(70, W / H, .1, 200);
	const ambient = new THREE.AmbientLight(16774624, .45);
	scene.add(ambient);
	const sun = new THREE.DirectionalLight(16775392, 1.25);
	sun.position.set(30, 60, 20);
	sun.castShadow = true;
	sun.shadow.mapSize.width = 2048;
	sun.shadow.mapSize.height = 2048;
	const shadowCam = sun.shadow.camera;
	shadowCam.near = 1;
	shadowCam.far = 160;
	shadowCam.left = -80;
	shadowCam.right = 80;
	shadowCam.top = 80;
	shadowCam.bottom = -80;
	scene.add(sun);
	const moonLight = new THREE.DirectionalLight(3359846, .3);
	moonLight.position.set(-30, 40, -20);
	scene.add(moonLight);
	const skyFill = new THREE.HemisphereLight(14544639, 2764607, .35);
	scene.add(skyFill);
	//#endregion
	//#region src/state.ts
	const keys = {};
	const gameState = {
		playerHP: 100,
		deerHP: 100,
		playerAttackTimer: 0,
		gameOver: false,
		gameWon: false,
		resources: {
			wood: 0,
			ore: 0
		},
		built: { workbench: false },
		hasSword: false,
		hasPickaxe: false,
		stage: 0,
		dayTime: .3,
		wasDawn: false,
		alienTimer: 50 + Math.random() * 60,
		inCar: false,
		carFacing: 0,
		driverView: false,
		inputProfile: "keyboard",
		deerState: "wander",
		deerAlive: true,
		workbenchPos: null,
		onWin: null,
		onDeath: null
	};
	const trees = [];
	const mines = [];
	const deforestedCells = /* @__PURE__ */ new Set();
	const aliens = [];
	const zombies = [];
	//#endregion
	//#region src/constants.ts
	const DEER_SPD = 3.5;
	const DEER_ATK_INT = 1.8;
	const CAR_TURN = 2.2;
	//#endregion
	//#region src/world.ts
	function dist2D(ax, az, bx, bz) {
		const dx = ax - bx, dz = az - bz;
		return Math.sqrt(dx * dx + dz * dz);
	}
	function isInSafeZone(x, z) {
		return dist2D(x, z, 0, 0) < 8;
	}
	function isInForest(x, z) {
		return dist2D(x, z, 0, 0) < 50;
	}
	function cellKey(x, z) {
		return `${Math.round(x)},${Math.round(z)}`;
	}
	function checkTreeCollision(x, z, r) {
		for (const t of trees) {
			if (!t.alive) continue;
			if (dist2D(x, z, t.x, t.z) < r + .5) return true;
		}
		return false;
	}
	function deerCanEnter(x, z) {
		return isInForest(x, z) && !isInSafeZone(x, z);
	}
	function addStump(x, z) {
		const s = new THREE.Mesh(new THREE.CylinderGeometry(.28, .3, .3, 6), new THREE.MeshLambertMaterial({ color: 4860426 }));
		s.position.set(x, .15, z);
		scene.add(s);
		for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) deforestedCells.add(cellKey(x + dx, z + dz));
	}
	function makeTree(x, z) {
		const g = new THREE.Group();
		g.position.set(x, 0, z);
		const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.22, .3, 2.2, 6), new THREE.MeshLambertMaterial({ color: 5913114 }));
		trunk.position.y = 1.1;
		trunk.castShadow = true;
		g.add(trunk);
		const cols = [
			2980379,
			3840549,
			2054674
		];
		for (let i = 0; i < 3; i++) {
			const l = new THREE.Mesh(new THREE.BoxGeometry(1.8 - i * .3, 1, 1.8 - i * .3), new THREE.MeshLambertMaterial({ color: cols[i] }));
			l.position.y = 2.4 + i * .7;
			l.castShadow = true;
			g.add(l);
		}
		scene.add(g);
		trees.push({
			mesh: g,
			x,
			z,
			hp: 3,
			alive: true
		});
	}
	function makeMine(x, z) {
		const g = new THREE.Group();
		g.position.set(x, 0, z);
		const cols = [
			8947865,
			7829384,
			10061960
		];
		for (let i = 0; i < 3; i++) {
			const r = new THREE.Mesh(new THREE.BoxGeometry(.9 + Math.random() * .6, .8 + Math.random() * .4, .9 + Math.random() * .6), new THREE.MeshLambertMaterial({ color: cols[i] }));
			r.position.set((Math.random() - .5) * .8, .4 + Math.random() * .3, (Math.random() - .5) * .8);
			r.rotation.y = Math.random() * Math.PI;
			r.castShadow = true;
			g.add(r);
		}
		const ore = new THREE.Mesh(new THREE.BoxGeometry(.3, .3, .3), new THREE.MeshLambertMaterial({ color: 12088115 }));
		ore.position.set(0, .85, 0);
		g.add(ore);
		scene.add(g);
		mines.push({
			mesh: g,
			x,
			z,
			hp: 3,
			alive: true
		});
	}
	function makeGround() {
		const m = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshLambertMaterial({ color: 4880954 }));
		m.rotation.x = -Math.PI / 2;
		m.receiveShadow = true;
		scene.add(m);
		const fm = new THREE.Mesh(new THREE.CircleGeometry(50, 48), new THREE.MeshLambertMaterial({ color: 2972187 }));
		fm.rotation.x = -Math.PI / 2;
		fm.position.y = .01;
		fm.receiveShadow = true;
		scene.add(fm);
		const sm = new THREE.Mesh(new THREE.CircleGeometry(8, 32), new THREE.MeshLambertMaterial({ color: 6990426 }));
		sm.rotation.x = -Math.PI / 2;
		sm.position.y = .02;
		scene.add(sm);
		const rm = new THREE.Mesh(new THREE.RingGeometry(50, 50.5, 64), new THREE.MeshBasicMaterial({
			color: 9136404,
			side: THREE.DoubleSide
		}));
		rm.rotation.x = -Math.PI / 2;
		rm.position.y = .03;
		scene.add(rm);
		const road = new THREE.Mesh(new THREE.PlaneGeometry(100, 5), new THREE.MeshLambertMaterial({ color: 5592405 }));
		road.rotation.x = -Math.PI / 2;
		road.position.set(100, .01, 0);
		scene.add(road);
		const lab = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 11), new THREE.MeshLambertMaterial({ color: 8026762 }));
		lab.position.set(152, 3.5, 0);
		lab.castShadow = true;
		scene.add(lab);
		const labRoof = new THREE.Mesh(new THREE.BoxGeometry(14, 1.5, 11), new THREE.MeshLambertMaterial({ color: 5592422 }));
		labRoof.position.set(152, 7.75, 0);
		scene.add(labRoof);
		const glow = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({
			color: 65348,
			side: THREE.DoubleSide
		}));
		glow.position.set(144.9, 3.5, 0);
		glow.rotation.y = Math.PI / 2;
		scene.add(glow);
		const sign = new THREE.Mesh(new THREE.BoxGeometry(.1, 2, 4), new THREE.MeshBasicMaterial({ color: 60928 }));
		sign.position.set(144.5, 2.5, 0);
		scene.add(sign);
	}
	function generateWorld() {
		let p = 0;
		while (p < 60) {
			const a = Math.random() * Math.PI * 2;
			const r = 10 + Math.random() * 38;
			const x = Math.cos(a) * r, z = Math.sin(a) * r;
			if (Math.sqrt(x * x + z * z) > 48) continue;
			if (Math.abs(x - 52) < 3) continue;
			makeTree(x, z);
			p++;
		}
		let mp = 0;
		while (mp < 3) {
			const a = Math.random() * Math.PI * 2;
			const r = 50 * .45 + Math.random() * 50 * .45;
			const x = Math.cos(a) * r, z = Math.sin(a) * r;
			if (Math.sqrt(x * x + z * z) < 12) continue;
			makeMine(x, z);
			mp++;
		}
	}
	//#endregion
	//#region src/player.ts
	const playerGroup = new THREE.Group();
	scene.add(playerGroup);
	const player = {
		pos: new THREE.Vector3(52, 0, 0),
		facing: Math.PI,
		invincTimer: 0
	};
	playerGroup.position.copy(player.pos);
	function buildPlayer() {
		playerGroup.clear();
		const skin = new THREE.MeshLambertMaterial({ color: 16109737 });
		const shirt = new THREE.MeshLambertMaterial({ color: 3837130 });
		const pants = new THREE.MeshLambertMaterial({ color: 2771594 });
		const hat1 = new THREE.MeshLambertMaterial({ color: 7027994 });
		const hat2 = new THREE.MeshLambertMaterial({ color: 5910548 });
		const body = new THREE.Mesh(new THREE.BoxGeometry(.5, .7, .3), shirt);
		body.position.y = .85;
		body.castShadow = true;
		playerGroup.add(body);
		const head = new THREE.Mesh(new THREE.BoxGeometry(.4, .4, .4), skin);
		head.position.y = 1.45;
		head.castShadow = true;
		playerGroup.add(head);
		const brim = new THREE.Mesh(new THREE.BoxGeometry(.7, .06, .7), hat1);
		brim.position.y = 1.65;
		playerGroup.add(brim);
		const hatTop = new THREE.Mesh(new THREE.BoxGeometry(.38, .22, .38), hat2);
		hatTop.position.y = 1.78;
		hatTop.rotation.z = .18;
		playerGroup.add(hatTop);
		for (const s of [-1, 1]) {
			const leg = new THREE.Mesh(new THREE.BoxGeometry(.2, .5, .2), pants);
			leg.position.set(s * .15, .25, 0);
			leg.castShadow = true;
			playerGroup.add(leg);
		}
		for (const s of [-1, 1]) {
			const arm = new THREE.Mesh(new THREE.BoxGeometry(.18, .5, .18), shirt);
			arm.position.set(s * .35, .85, 0);
			arm.castShadow = true;
			playerGroup.add(arm);
		}
		const axeH = new THREE.Mesh(new THREE.BoxGeometry(.07, .7, .07), new THREE.MeshLambertMaterial({ color: 7029795 }));
		axeH.position.set(.55, .75, .15);
		playerGroup.add(axeH);
		const axeB = new THREE.Mesh(new THREE.BoxGeometry(.22, .22, .08), new THREE.MeshLambertMaterial({ color: 11184810 }));
		axeB.position.set(.62, 1.1, .15);
		playerGroup.add(axeB);
	}
	function addSwordToPlayer() {
		const toRemove = [];
		playerGroup.children.forEach((c, i) => {
			if (i >= 8) toRemove.push(c);
		});
		toRemove.forEach((c) => playerGroup.remove(c));
		const blade = new THREE.Mesh(new THREE.BoxGeometry(.08, .7, .04), new THREE.MeshLambertMaterial({ color: 14540287 }));
		blade.position.set(.55, 1.05, .1);
		playerGroup.add(blade);
		const guard = new THREE.Mesh(new THREE.BoxGeometry(.28, .06, .06), new THREE.MeshLambertMaterial({ color: 13934615 }));
		guard.position.set(.55, .72, .1);
		playerGroup.add(guard);
		const grip = new THREE.Mesh(new THREE.BoxGeometry(.07, .28, .07), new THREE.MeshLambertMaterial({ color: 5910544 }));
		grip.position.set(.55, .56, .1);
		playerGroup.add(grip);
	}
	function updatePlayer(dt) {
		if (gameState.gameOver || gameState.gameWon || gameState.inCar) return;
		if (keys["ArrowLeft"]) player.facing += 1.8 * dt;
		if (keys["ArrowRight"]) player.facing -= 1.8 * dt;
		let mx = 0, mz = 0;
		if (keys["ArrowUp"]) {
			mx = -Math.sin(player.facing) * 6;
			mz = -Math.cos(player.facing) * 6;
		}
		if (keys["ArrowDown"]) {
			mx = Math.sin(player.facing) * 6 * .5;
			mz = Math.cos(player.facing) * 6 * .5;
		}
		const nx = player.pos.x + mx * dt, nz = player.pos.z + mz * dt;
		if (dist2D(nx, nz, 0, 0) < 60) {
			let blocked = checkTreeCollision(nx, nz, .4);
			if (!blocked && gameState.workbenchPos && dist2D(nx, nz, gameState.workbenchPos.x, gameState.workbenchPos.z) < .9) blocked = true;
			if (!blocked) {
				player.pos.x = nx;
				player.pos.z = nz;
			}
		}
		const moving = mx !== 0 || mz !== 0;
		playerGroup.position.y = moving ? Math.abs(Math.sin(Date.now() * .007)) * .08 : 0;
		playerGroup.position.x = player.pos.x;
		playerGroup.position.z = player.pos.z;
		playerGroup.rotation.y = player.facing + Math.PI;
		if (player.invincTimer > 0) {
			player.invincTimer -= dt;
			playerGroup.visible = Math.sin(Date.now() * .025) > 0;
		} else playerGroup.visible = true;
		if (gameState.playerAttackTimer > 0) gameState.playerAttackTimer -= dt;
	}
	//#endregion
	//#region src/car.ts
	const carPos = new THREE.Vector3(0, 0, -5);
	const carGroup = new THREE.Group();
	scene.add(carGroup);
	const wheelSpinners = [];
	const steerKnuckles = [];
	const envTargets = [];
	function registerEnvMaterial(mat, intensity) {
		envTargets.push({
			mat,
			intensity
		});
		return mat;
	}
	let carEnvRT = null;
	function makeFlakeNormalMap() {
		const size = 512;
		const canvas = document.createElement("canvas");
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext("2d");
		ctx.fillStyle = "#8080ff";
		ctx.fillRect(0, 0, size, size);
		for (let i = 0; i < 13e3; i++) {
			const x = Math.random() * size;
			const y = Math.random() * size;
			const r = .25 + Math.random() * .9;
			const nx = 128 + (Math.random() - .5) * 36;
			const ny = 128 + (Math.random() - .5) * 36;
			const nz = 220 + Math.random() * 35;
			ctx.fillStyle = `rgb(${nx | 0},${ny | 0},${nz | 0})`;
			ctx.beginPath();
			ctx.arc(x, y, r, 0, Math.PI * 2);
			ctx.fill();
		}
		const tex = new THREE.CanvasTexture(canvas);
		tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
		tex.repeat.set(5, 5);
		return tex;
	}
	function makeTireNormalMap() {
		const width = 512;
		const height = 256;
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");
		ctx.fillStyle = "#8080ff";
		ctx.fillRect(0, 0, width, height);
		for (let i = -2; i < 66; i++) {
			const x = i / 64 * width;
			ctx.fillStyle = "#6666dc";
			ctx.fillRect(x, height * .18, 6, height * .64);
			ctx.save();
			ctx.translate(x + 3, height * .5);
			ctx.rotate(.47);
			ctx.fillStyle = "#7373eb";
			ctx.fillRect(-2, -height * .35, 4, height * .7);
			ctx.restore();
		}
		const tex = new THREE.CanvasTexture(canvas);
		tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
		tex.repeat.set(1.6, 1);
		return tex;
	}
	const carTextureLoader = new THREE.TextureLoader();
	const carTextureAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
	function loadCarTexture(path, repeatX, repeatY, isColor) {
		const tex = carTextureLoader.load(path);
		tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
		tex.repeat.set(repeatX, repeatY);
		tex.anisotropy = carTextureAniso;
		if (isColor) tex.encoding = THREE.sRGBEncoding;
		return tex;
	}
	const paintFlakeNormal = makeFlakeNormalMap();
	const tireFallbackNormal = makeTireNormalMap();
	const metalDiffMap = loadCarTexture("assets/textures/car/metal_plate_02_diff_1k.jpg", 3, 3, true);
	const metalArmMap = loadCarTexture("assets/textures/car/metal_plate_02_arm_1k.png", 3, 3, false);
	const metalNorMap = loadCarTexture("assets/textures/car/metal_plate_02_nor_gl_1k.png", 3, 3, false);
	const rubberDiffMap = loadCarTexture("assets/textures/car/rubber_tiles_diff_1k.jpg", 2.4, 1.2, true);
	const rubberArmMap = loadCarTexture("assets/textures/car/rubber_tiles_arm_1k.png", 2.4, 1.2, false);
	const rubberNorMap = loadCarTexture("assets/textures/car/rubber_tiles_nor_gl_1k.png", 2.4, 1.2, false);
	const leatherDiffMap = loadCarTexture("assets/textures/car/leather_red_02_coll1_1k.jpg", 3.5, 2, true);
	const leatherArmMap = loadCarTexture("assets/textures/car/leather_red_02_arm_1k.png", 3.5, 2, false);
	const leatherNorMap = loadCarTexture("assets/textures/car/leather_red_02_nor_gl_1k.png", 3.5, 2, false);
	const paint = registerEnvMaterial(new THREE.MeshPhysicalMaterial({
		color: 10358815,
		metalness: .54,
		roughness: .2,
		clearcoat: 1,
		clearcoatRoughness: .035,
		normalMap: paintFlakeNormal,
		normalScale: new THREE.Vector2(.1, .1),
		clearcoatNormalMap: paintFlakeNormal,
		clearcoatNormalScale: new THREE.Vector2(.04, .04)
	}), 1.65);
	const chrome = registerEnvMaterial(new THREE.MeshStandardMaterial({
		color: 15988216,
		map: metalDiffMap,
		normalMap: metalNorMap,
		normalScale: new THREE.Vector2(.24, .24),
		roughnessMap: metalArmMap,
		metalnessMap: metalArmMap,
		metalness: 1,
		roughness: .24
	}), 1.85);
	const darkTrim = registerEnvMaterial(new THREE.MeshStandardMaterial({
		color: 1383203,
		map: metalDiffMap,
		normalMap: metalNorMap,
		normalScale: new THREE.Vector2(.12, .12),
		roughnessMap: metalArmMap,
		metalnessMap: metalArmMap,
		metalness: .5,
		roughness: .58
	}), 1);
	const glass = registerEnvMaterial(new THREE.MeshPhysicalMaterial({
		color: 2044742,
		transparent: true,
		opacity: .34,
		metalness: 0,
		roughness: .03,
		reflectivity: .95,
		clearcoat: 1,
		clearcoatRoughness: .06,
		side: THREE.DoubleSide
	}), 2.05);
	const tireMat = new THREE.MeshStandardMaterial({
		color: 2105638,
		map: rubberDiffMap,
		roughnessMap: rubberArmMap,
		metalnessMap: rubberArmMap,
		metalness: .06,
		roughness: 1,
		normalMap: rubberNorMap,
		normalScale: new THREE.Vector2(1, 1)
	});
	const rimMat = registerEnvMaterial(new THREE.MeshStandardMaterial({
		color: 15001837,
		map: metalDiffMap,
		normalMap: metalNorMap,
		normalScale: new THREE.Vector2(.34, .34),
		roughnessMap: metalArmMap,
		metalnessMap: metalArmMap,
		metalness: 1,
		roughness: .2
	}), 1.75);
	const headlightLensMat = registerEnvMaterial(new THREE.MeshPhysicalMaterial({
		color: 15266815,
		transparent: true,
		opacity: .82,
		metalness: .15,
		roughness: .04,
		clearcoat: 1,
		clearcoatRoughness: .03
	}), 1.7);
	const headlightCoreMat = new THREE.MeshStandardMaterial({
		color: 16777215,
		emissive: 16774335,
		emissiveIntensity: .95,
		metalness: .15,
		roughness: .25
	});
	const taillightMat = registerEnvMaterial(new THREE.MeshPhysicalMaterial({
		color: 16719381,
		emissive: 11796480,
		emissiveIntensity: 1,
		transparent: true,
		opacity: .88,
		metalness: .2,
		roughness: .15,
		clearcoat: 1,
		clearcoatRoughness: .04
	}), 1.2);
	const plateMat = new THREE.MeshStandardMaterial({
		color: 15198183,
		metalness: 0,
		roughness: .22
	});
	const grilleMat = new THREE.MeshStandardMaterial({
		color: 592397,
		metalness: .7,
		roughness: .35
	});
	const interiorLeatherMat = new THREE.MeshStandardMaterial({
		color: 11020327,
		map: leatherDiffMap,
		normalMap: leatherNorMap,
		normalScale: new THREE.Vector2(.42, .42),
		roughnessMap: leatherArmMap,
		metalnessMap: leatherArmMap,
		metalness: .05,
		roughness: .76
	});
	const interiorPlasticMat = new THREE.MeshStandardMaterial({
		color: 2040102,
		roughness: .75,
		metalness: .08,
		normalMap: tireFallbackNormal,
		normalScale: new THREE.Vector2(.16, .16)
	});
	const brakeDiscMat = new THREE.MeshStandardMaterial({
		color: 8949660,
		map: metalDiffMap,
		normalMap: metalNorMap,
		normalScale: new THREE.Vector2(.14, .14),
		roughnessMap: metalArmMap,
		metalnessMap: metalArmMap,
		metalness: .95,
		roughness: .42
	});
	function createPanelLine(width, x, y, z) {
		const line = new THREE.Mesh(new THREE.BoxGeometry(width, .012, .012), darkTrim);
		line.position.set(x, y, z);
		carGroup.add(line);
	}
	function createDoorHandle(x, y, z) {
		const h = new THREE.Mesh(new THREE.BoxGeometry(.16, .03, .02), chrome);
		h.position.set(x, y, z);
		carGroup.add(h);
	}
	function createSeat(x, z, y) {
		const base = new THREE.Mesh(new THREE.BoxGeometry(.56, .16, .54), interiorLeatherMat);
		base.position.set(x, y, z);
		base.castShadow = true;
		carGroup.add(base);
		const back = new THREE.Mesh(new THREE.BoxGeometry(.18, .5, .54), interiorLeatherMat);
		back.position.set(x - .18, y + .33, z);
		back.castShadow = true;
		carGroup.add(back);
		const headrest = new THREE.Mesh(new THREE.BoxGeometry(.1, .16, .32), interiorLeatherMat);
		headrest.position.set(x - .27, y + .66, z);
		carGroup.add(headrest);
	}
	function createWheel(x, z, isFront) {
		const knuckle = new THREE.Group();
		knuckle.position.set(x, .44, z);
		carGroup.add(knuckle);
		const spinner = new THREE.Group();
		knuckle.add(spinner);
		wheelSpinners.push(spinner);
		if (isFront) steerKnuckles.push(knuckle);
		const tire = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .3, 32, 1, true), tireMat);
		tire.rotation.x = Math.PI / 2;
		spinner.add(tire);
		const sideWallFront = new THREE.Mesh(new THREE.CircleGeometry(.42, 32), tireMat);
		sideWallFront.position.z = .15;
		spinner.add(sideWallFront);
		const sideWallBack = new THREE.Mesh(new THREE.CircleGeometry(.42, 32), tireMat);
		sideWallBack.position.z = -.15;
		sideWallBack.rotation.y = Math.PI;
		spinner.add(sideWallBack);
		const rim = new THREE.Mesh(new THREE.CylinderGeometry(.27, .27, .22, 28), rimMat);
		rim.rotation.x = Math.PI / 2;
		spinner.add(rim);
		const disc = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .12, 22), brakeDiscMat);
		disc.rotation.x = Math.PI / 2;
		spinner.add(disc);
		for (let i = 0; i < 5; i++) {
			const a = i / 5 * Math.PI * 2;
			const spoke = new THREE.Mesh(new THREE.BoxGeometry(.05, .18, .03), chrome);
			spoke.position.set(Math.cos(a) * .14, Math.sin(a) * .14, 0);
			spoke.rotation.z = a;
			spinner.add(spoke);
		}
		const hub = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .16, 18), chrome);
		hub.rotation.x = Math.PI / 2;
		spinner.add(hub);
		const caliper = new THREE.Mesh(new THREE.BoxGeometry(.08, .16, .08), new THREE.MeshStandardMaterial({
			color: 9704468,
			metalness: .35,
			roughness: .4
		}));
		caliper.position.set(.2, .06, z > 0 ? .11 : -.11);
		knuckle.add(caliper);
	}
	function makeStudioReflectionScene() {
		const studio = new THREE.Scene();
		studio.background = new THREE.Color(1053722);
		const hemi = new THREE.HemisphereLight(16317695, 2238259, .9);
		studio.add(hemi);
		const key = new THREE.DirectionalLight(16777215, 1.4);
		key.position.set(4, 8, 3);
		studio.add(key);
		const fill = new THREE.DirectionalLight(10335999, .55);
		fill.position.set(-6, 3, -4);
		studio.add(fill);
		const floor = new THREE.Mesh(new THREE.PlaneGeometry(45, 45), new THREE.MeshStandardMaterial({
			color: 790291,
			roughness: .95,
			metalness: 0
		}));
		floor.rotation.x = -Math.PI / 2;
		floor.position.y = -2;
		studio.add(floor);
		const cardMat = new THREE.MeshBasicMaterial({
			color: 16777215,
			side: THREE.DoubleSide
		});
		const topCard = new THREE.Mesh(new THREE.PlaneGeometry(11, 4.2), cardMat);
		topCard.position.set(0, 6.5, 0);
		topCard.rotation.x = Math.PI / 2;
		studio.add(topCard);
		const leftCard = new THREE.Mesh(new THREE.PlaneGeometry(7, 3), cardMat);
		leftCard.position.set(-7, 2.5, 0);
		leftCard.rotation.y = Math.PI / 2;
		studio.add(leftCard);
		const rightCard = new THREE.Mesh(new THREE.PlaneGeometry(7, 3), cardMat);
		rightCard.position.set(7, 2.5, 0);
		rightCard.rotation.y = -Math.PI / 2;
		studio.add(rightCard);
		const rearCard = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.6), cardMat);
		rearCard.position.set(0, 2.4, -7.5);
		studio.add(rearCard);
		return studio;
	}
	(function buildCar() {
		const side = new THREE.Shape();
		side.moveTo(-1.94, .24);
		side.lineTo(1.82, .24);
		side.quadraticCurveTo(2.06, .24, 2.08, .47);
		side.lineTo(2.08, .62);
		side.quadraticCurveTo(2.04, .84, 1.84, .86);
		side.lineTo(1.08, .89);
		side.quadraticCurveTo(.74, .91, .42, 1.3);
		side.quadraticCurveTo(.2, 1.52, -.1, 1.54);
		side.lineTo(-.62, 1.54);
		side.quadraticCurveTo(-.94, 1.5, -1.21, 1.13);
		side.lineTo(-1.52, .92);
		side.quadraticCurveTo(-1.86, .85, -2, .64);
		side.lineTo(-2.07, .44);
		side.quadraticCurveTo(-2.08, .24, -1.94, .24);
		const bodyGeo = new THREE.ExtrudeGeometry(side, {
			depth: 1.72,
			bevelEnabled: true,
			bevelThickness: .06,
			bevelSize: .06,
			bevelSegments: 6,
			curveSegments: 20
		});
		bodyGeo.translate(0, 0, -.86);
		bodyGeo.computeVertexNormals();
		const body = new THREE.Mesh(bodyGeo, paint);
		body.castShadow = true;
		body.receiveShadow = true;
		carGroup.add(body);
		const roof = new THREE.Mesh(new THREE.BoxGeometry(1.55, .12, 1.26), paint);
		roof.position.set(-.32, 1.39, 0);
		roof.castShadow = true;
		carGroup.add(roof);
		const hood = new THREE.Mesh(new THREE.BoxGeometry(1.34, .08, 1.38), paint);
		hood.position.set(1.06, .86, 0);
		hood.rotation.z = -.08;
		hood.castShadow = true;
		carGroup.add(hood);
		const trunk = new THREE.Mesh(new THREE.BoxGeometry(.95, .1, 1.32), paint);
		trunk.position.set(-1.32, .92, 0);
		trunk.rotation.z = .08;
		trunk.castShadow = true;
		carGroup.add(trunk);
		for (const sideSign of [1, -1]) {
			const sideSkirt = new THREE.Mesh(new THREE.BoxGeometry(2.7, .1, .04), darkTrim);
			sideSkirt.position.set(-.14, .34, sideSign * .9);
			carGroup.add(sideSkirt);
			const beltline = new THREE.Mesh(new THREE.BoxGeometry(2.35, .018, .018), chrome);
			beltline.position.set(-.12, 1.02, sideSign * .91);
			carGroup.add(beltline);
			const mirrorArm = new THREE.Mesh(new THREE.BoxGeometry(.08, .03, .1), darkTrim);
			mirrorArm.position.set(.5, 1.03, sideSign * .93);
			carGroup.add(mirrorArm);
			const mirrorShell = new THREE.Mesh(new THREE.BoxGeometry(.1, .08, .17), paint);
			mirrorShell.position.set(.53, 1.04, sideSign * 1);
			carGroup.add(mirrorShell);
			const mirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(.08, .06), glass);
			mirrorGlass.position.set(.58, 1.04, sideSign * 1);
			mirrorGlass.rotation.y = sideSign > 0 ? Math.PI / 2 : -Math.PI / 2;
			carGroup.add(mirrorGlass);
		}
		const windshield = new THREE.Mesh(new THREE.BoxGeometry(.02, .65, 1.12), glass);
		windshield.position.set(.52, 1.05, 0);
		windshield.rotation.z = -.95;
		carGroup.add(windshield);
		const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(.02, .5, 1.08), glass);
		rearGlass.position.set(-1.02, 1.12, 0);
		rearGlass.rotation.z = .72;
		carGroup.add(rearGlass);
		for (const sideSign of [1, -1]) {
			const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(1.42, .4, .02), glass);
			sideGlass.position.set(-.2, 1.13, sideSign * .9);
			carGroup.add(sideGlass);
		}
		const cabinFloor = new THREE.Mesh(new THREE.BoxGeometry(2.6, .12, 1.45), interiorPlasticMat);
		cabinFloor.position.set(-.2, .62, 0);
		carGroup.add(cabinFloor);
		const dashboard = new THREE.Mesh(new THREE.BoxGeometry(.8, .18, 1.1), interiorPlasticMat);
		dashboard.position.set(.76, .95, 0);
		dashboard.rotation.z = -.08;
		carGroup.add(dashboard);
		const centerConsole = new THREE.Mesh(new THREE.BoxGeometry(.78, .16, .22), interiorPlasticMat);
		centerConsole.position.set(-.12, .79, 0);
		carGroup.add(centerConsole);
		createSeat(.07, .34, .73);
		createSeat(.07, -.34, .73);
		createSeat(-.98, .34, .73);
		createSeat(-.98, -.34, .73);
		const steeringWheel = new THREE.Mesh(new THREE.TorusGeometry(.13, .018, 12, 24), darkTrim);
		steeringWheel.position.set(.42, 1.02, .31);
		steeringWheel.rotation.x = Math.PI / 2;
		steeringWheel.rotation.y = .3;
		carGroup.add(steeringWheel);
		const steeringCol = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .22, 12), interiorPlasticMat);
		steeringCol.position.set(.52, .94, .23);
		steeringCol.rotation.z = -.4;
		carGroup.add(steeringCol);
		createPanelLine(.82, .25, .78, .92);
		createPanelLine(.82, .25, .78, -.92);
		createPanelLine(.72, -.78, .78, .92);
		createPanelLine(.72, -.78, .78, -.92);
		createDoorHandle(.14, .88, .92);
		createDoorHandle(.14, .88, -.92);
		createDoorHandle(-.84, .88, .92);
		createDoorHandle(-.84, .88, -.92);
		const grilleGroup = new THREE.Group();
		const grilleBack = new THREE.Mesh(new THREE.BoxGeometry(.04, .34, .76), grilleMat);
		grilleGroup.add(grilleBack);
		for (let i = 0; i < 7; i++) {
			const slat = new THREE.Mesh(new THREE.BoxGeometry(.055, .02, .7), chrome);
			slat.position.set(.02, -.13 + i * .045, 0);
			grilleGroup.add(slat);
		}
		const badge = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .03, 20), chrome);
		badge.rotation.z = Math.PI / 2;
		badge.position.set(.04, 0, 0);
		grilleGroup.add(badge);
		grilleGroup.position.set(2.08, .62, 0);
		carGroup.add(grilleGroup);
		const lowerIntake = new THREE.Mesh(new THREE.BoxGeometry(.05, .2, 1.02), grilleMat);
		lowerIntake.position.set(2.07, .36, 0);
		carGroup.add(lowerIntake);
		for (let i = 0; i < 6; i++) {
			const fin = new THREE.Mesh(new THREE.BoxGeometry(.06, .16, .018), darkTrim);
			fin.position.set(2.1, .36, -.42 + i * .17);
			carGroup.add(fin);
		}
		const splitter = new THREE.Mesh(new THREE.BoxGeometry(.22, .02, 1.2), darkTrim);
		splitter.position.set(2.01, .25, 0);
		carGroup.add(splitter);
		for (const sideSign of [1, -1]) {
			const headlightGroup = new THREE.Group();
			const housing = new THREE.Mesh(new THREE.BoxGeometry(.08, .15, .26), darkTrim);
			headlightGroup.add(housing);
			const core = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .05, 16), headlightCoreMat);
			core.rotation.z = Math.PI / 2;
			core.position.x = .02;
			headlightGroup.add(core);
			const lens = new THREE.Mesh(new THREE.SphereGeometry(.085, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), headlightLensMat);
			lens.rotation.z = Math.PI / 2;
			lens.position.x = .05;
			headlightGroup.add(lens);
			headlightGroup.position.set(2.02, .74, sideSign * .56);
			carGroup.add(headlightGroup);
			const taillight = new THREE.Mesh(new THREE.BoxGeometry(.06, .14, .32), taillightMat);
			taillight.position.set(-2.03, .73, sideSign * .58);
			carGroup.add(taillight);
		}
		const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(.03, .12, .36), plateMat);
		frontPlate.position.set(2.1, .42, 0);
		carGroup.add(frontPlate);
		const rearPlate = new THREE.Mesh(new THREE.BoxGeometry(.03, .12, .36), plateMat);
		rearPlate.position.set(-2.08, .4, 0);
		carGroup.add(rearPlate);
		for (const sideSign of [1, -1]) {
			const fArch = new THREE.Mesh(new THREE.TorusGeometry(.49, .03, 10, 22, Math.PI), darkTrim);
			fArch.position.set(1.25, .5, sideSign * .84);
			fArch.rotation.y = sideSign > 0 ? Math.PI / 2 : -Math.PI / 2;
			carGroup.add(fArch);
			const rArch = new THREE.Mesh(new THREE.TorusGeometry(.49, .03, 10, 22, Math.PI), darkTrim);
			rArch.position.set(-1.26, .5, sideSign * .84);
			rArch.rotation.y = sideSign > 0 ? Math.PI / 2 : -Math.PI / 2;
			carGroup.add(rArch);
		}
		createWheel(1.24, .86, true);
		createWheel(1.24, -.86, true);
		createWheel(-1.26, .86, false);
		createWheel(-1.26, -.86, false);
		for (const sideSign of [1, -1]) {
			const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(.045, .04, .18, 12), chrome);
			exhaust.rotation.z = Math.PI / 2;
			exhaust.position.set(-2.14, .3, sideSign * .35);
			carGroup.add(exhaust);
		}
		const underShadow = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 1.9), new THREE.MeshBasicMaterial({
			color: 0,
			transparent: true,
			opacity: .28,
			depthWrite: false
		}));
		underShadow.rotation.x = -Math.PI / 2;
		underShadow.position.y = .02;
		carGroup.add(underShadow);
	})();
	carGroup.scale.setScalar(.72);
	carGroup.position.copy(carPos);
	function initCarEnvMap() {
		const pmrem = new THREE.PMREMGenerator(renderer);
		pmrem.compileCubemapShader();
		const studioScene = makeStudioReflectionScene();
		if (carEnvRT) {
			carEnvRT.dispose();
			carEnvRT = null;
		}
		carEnvRT = pmrem.fromScene(studioScene, .015, .5, 50);
		const envMap = carEnvRT.texture;
		for (const target of envTargets) {
			target.mat.envMap = envMap;
			target.mat.envMapIntensity = target.intensity;
			target.mat.needsUpdate = true;
		}
		pmrem.dispose();
	}
	function updateCar(dt) {
		if (gameState.inCar) {
			if (keys["ArrowLeft"]) gameState.carFacing += CAR_TURN * dt;
			if (keys["ArrowRight"]) gameState.carFacing -= CAR_TURN * dt;
			let speed = 0;
			if (keys["ArrowUp"]) speed = 14;
			if (keys["ArrowDown"]) speed = -14 * .5;
			carPos.x -= Math.sin(gameState.carFacing) * speed * dt;
			carPos.z -= Math.cos(gameState.carFacing) * speed * dt;
			player.pos.copy(carPos);
			player.facing = gameState.carFacing;
		}
		carGroup.position.set(carPos.x, 0, carPos.z);
		carGroup.rotation.y = gameState.carFacing + Math.PI / 2;
		const moveDir = keys["ArrowUp"] ? 1 : keys["ArrowDown"] ? -1 : 0;
		if (gameState.inCar && moveDir !== 0) {
			const spinStep = dt * 10 * moveDir;
			for (const spinner of wheelSpinners) spinner.rotation.z += spinStep;
		}
		const targetSteer = ((keys["ArrowLeft"] ? 1 : 0) - (keys["ArrowRight"] ? 1 : 0)) * .35;
		for (const knuckle of steerKnuckles) knuckle.rotation.y += (targetSteer - knuckle.rotation.y) * .2;
		taillightMat.emissiveIntensity = keys["ArrowDown"] && gameState.inCar ? 1.9 : 1;
	}
	//#endregion
	//#region src/ui.ts
	function actionControlName$1() {
		return gameState.inputProfile === "touch" ? "TAP" : "SPACE";
	}
	function setActionHint(txt) {
		document.getElementById("action-hint").textContent = txt;
	}
	function showMessage(html, dur = 0) {
		const el = document.getElementById("message");
		el.innerHTML = html;
		el.style.display = "block";
		if (dur > 0) setTimeout(() => {
			if (el.style.display !== "none") el.style.display = "none";
		}, dur);
	}
	function hideMessage() {
		document.getElementById("message").style.display = "none";
	}
	function flashColor(col) {
		const f = document.getElementById("screen-flash");
		f.style.background = col;
		f.style.opacity = "1";
		setTimeout(() => {
			f.style.opacity = "0";
		}, 140);
	}
	function showEventBanner(txt, dur, col = "#f00") {
		const b = document.getElementById("event-banner");
		b.textContent = txt;
		b.style.borderColor = col;
		b.style.display = "block";
		if (dur > 0) setTimeout(() => {
			b.style.display = "none";
		}, dur);
	}
	function showFloatingText(txt) {
		const el = document.createElement("div");
		el.textContent = txt;
		el.style.cssText = "position:fixed;left:50%;top:42%;transform:translateX(-50%);color:#fff;font-size:16px;font-family:Courier New,monospace;text-shadow:1px 1px 0 #000;pointer-events:none;z-index:50;transition:opacity 1s,top 1s;";
		document.body.appendChild(el);
		setTimeout(() => {
			el.style.opacity = "0";
			el.style.top = "36%";
		}, 100);
		setTimeout(() => el.remove(), 1200);
	}
	function updateHUD(deer, player) {
		document.getElementById("health-fill").style.width = Math.max(0, gameState.playerHP) + "%";
		document.getElementById("health-text").textContent = String(Math.ceil(Math.max(0, gameState.playerHP)));
		document.getElementById("deer-fill").style.width = gameState.deerHP + "%";
		document.getElementById("deer-text").textContent = String(Math.ceil(gameState.deerHP));
		document.getElementById("resource-info").innerHTML = `\u{1FAB5} ${gameState.resources.wood} &nbsp; ⛰️ ${gameState.resources.ore}`;
		const inv = document.getElementById("inventory");
		inv.innerHTML = "";
		[
			{
				icon: "🪓",
				label: "Axe",
				show: !gameState.hasSword
			},
			{
				icon: "⛏️",
				label: "Pickaxe",
				show: gameState.hasPickaxe
			},
			{
				icon: "🗡️",
				label: "Sword",
				show: gameState.hasSword
			},
			{
				icon: "🪵",
				label: `Wood×${gameState.resources.wood}`,
				show: gameState.resources.wood > 0
			},
			{
				icon: "⛰️",
				label: `Ore×${gameState.resources.ore}`,
				show: gameState.resources.ore > 0
			},
			{
				icon: "🚗",
				label: "Car",
				show: true
			}
		].forEach((item) => {
			if (!item.show) return;
			const d = document.createElement("div");
			d.className = "inv-slot";
			d.innerHTML = `<div class="icon">${item.icon}</div><div>${item.label}</div>`;
			inv.appendChild(d);
		});
		[
			"obj0",
			"obj1",
			"obj2",
			"obj3",
			"obj4"
		].forEach((id, i) => {
			const el = document.getElementById(id);
			if (i < gameState.stage) el.className = "done";
			else if (i === gameState.stage) el.className = "active";
			else el.className = "";
		});
	}
	function updateClock(renderer, scene, sun, ambient, moonLight) {
		const t = gameState.dayTime;
		const names = [
			"🌙 Night",
			"🌅 Dawn",
			"🌄 Morning",
			"☀️ Noon",
			"🌇 Dusk",
			"🌆 Evening",
			"🌙 Night"
		];
		const idx = Math.min(Math.floor((t + 1 / 14) % 1 * 7), 6);
		document.getElementById("clock").textContent = names[idx];
		let sr, sg, sb;
		if (t < .25) {
			const f = t / .25;
			sr = Math.floor(10 + f * 120);
			sg = Math.floor(10 + f * 100);
			sb = Math.floor(30 + f * 140);
		} else if (t < .5) {
			const f = (t - .25) / .25;
			sr = Math.floor(130 + f * 5);
			sg = Math.floor(110 + f * 96);
			sb = Math.floor(170 + f * 65);
		} else if (t < .75) {
			const f = (t - .5) / .25;
			sr = Math.floor(135 - f * 50);
			sg = Math.floor(206 - f * 130);
			sb = Math.floor(235 - f * 100);
		} else {
			const f = (t - .75) / .25;
			sr = Math.floor(85 - f * 75);
			sg = Math.floor(76 - f * 66);
			sb = Math.floor(135 - f * 105);
		}
		const skyHex = sr << 16 | sg << 8 | sb;
		renderer.setClearColor(skyHex);
		scene.fog.color.setHex(skyHex);
		const sunInt = Math.max(0, Math.sin(t * Math.PI * 2 - Math.PI / 2) * .8 + .5);
		sun.intensity = sunInt;
		ambient.intensity = .3 + sunInt * .4;
		moonLight.intensity = Math.max(0, .4 - sunInt * .3);
	}
	function updateCarHint(playerPos, carPos) {
		const ch = document.getElementById("car-hint");
		const nearCar = Math.sqrt((playerPos.x - carPos.x) ** 2 + (playerPos.z - carPos.z) ** 2) < 3;
		if (!gameState.inCar && nearCar) {
			ch.style.display = "block";
			ch.textContent = `[${actionControlName$1()}] Get in car 🚗`;
		} else if (gameState.inCar) {
			ch.style.display = "block";
			ch.textContent = gameState.inputProfile === "touch" ? "[TAP] Exit car  |  Screen Zones Drive + Steer" : "[SPACE] Exit car  |  ↑↓ Drive  ←→ Steer";
		} else ch.style.display = "none";
	}
	function updateMinimap(playerPos, carPos, deerPos, deerAlive) {
		const ctx = document.getElementById("mm").getContext("2d");
		const S = 110, scale = S / 124, cx = S / 2, cy = S / 2;
		ctx.clearRect(0, 0, S, S);
		ctx.fillStyle = "#1a3a10";
		ctx.fillRect(0, 0, S, S);
		ctx.beginPath();
		ctx.arc(cx, cy, 50 * scale, 0, Math.PI * 2);
		ctx.fillStyle = "#2d5a1b";
		ctx.fill();
		ctx.beginPath();
		ctx.arc(cx, cy, 8 * scale, 0, Math.PI * 2);
		ctx.fillStyle = "#4a8a3a";
		ctx.fill();
		ctx.fillStyle = "#555";
		ctx.fillRect(cx + 50 * scale, cy - 2, 40, 4);
		ctx.fillStyle = "#556";
		ctx.fillRect(cx + 50 * scale + 37, cy - 5, 10, 10);
		ctx.fillStyle = "#0f0";
		ctx.fillRect(cx + 50 * scale + 38, cy - 4, 8, 8);
		for (const t of trees) {
			if (!t.alive) continue;
			ctx.fillStyle = "#1a4a10";
			ctx.fillRect(cx + t.x * scale - 1, cy + t.z * scale - 1, 2, 2);
		}
		for (const m of mines) {
			if (!m.alive) continue;
			ctx.fillStyle = "#888";
			ctx.fillRect(cx + m.x * scale - 2, cy + m.z * scale - 2, 4, 4);
		}
		for (const a of aliens) {
			if (!a.alive) continue;
			ctx.fillStyle = "#0f0";
			ctx.beginPath();
			ctx.arc(cx + a.pos.x * scale, cy + a.pos.z * scale, 3, 0, Math.PI * 2);
			ctx.fill();
		}
		for (const z of zombies) {
			if (!z.alive) continue;
			ctx.fillStyle = "#fa0";
			ctx.beginPath();
			ctx.arc(cx + z.pos.x * scale, cy + z.pos.z * scale, 3, 0, Math.PI * 2);
			ctx.fill();
		}
		if (deerAlive) {
			ctx.fillStyle = "#e74c3c";
			ctx.beginPath();
			ctx.arc(cx + deerPos.x * scale, cy + deerPos.z * scale, 3, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.fillStyle = "#f55";
		ctx.fillRect(cx + carPos.x * scale - 3, cy + carPos.z * scale - 2, 6, 4);
		ctx.fillStyle = "#3af";
		ctx.beginPath();
		ctx.arc(cx + playerPos.x * scale, cy + playerPos.z * scale, 3, 0, Math.PI * 2);
		ctx.fill();
	}
	function triggerWin() {
		gameState.gameWon = true;
		gameState.deerAlive = false;
		showMessage(`🎉 <strong>VICTORY!</strong><br><br>You slew the vicious deer!<br>The forest is saved.<br><br><em style="font-size:13px">Reload to play again</em>`);
	}
	function triggerDeath(by = "deer") {
		gameState.gameOver = true;
		const msgs = {
			deer: "🦌 The deer ate you.",
			alien: "👽 Abducted and probed.",
			zombie: "🧟 You became a zombie."
		};
		showMessage(`💀 <strong>YOU DIED</strong><br><br>${msgs[by] || msgs.deer}<br><br><em style="font-size:13px">Reload to try again</em>`);
	}
	//#endregion
	//#region src/audio.ts
	let audioCtx = null;
	let musicMasterGain = null;
	let sfxMasterGain = null;
	let musicStarted = false;
	let deerYellInterval = null;
	function initAudio() {
		if (audioCtx) return;
		audioCtx = new (window.AudioContext || window.webkitAudioContext)();
		musicMasterGain = audioCtx.createGain();
		musicMasterGain.gain.value = .18;
		sfxMasterGain = audioCtx.createGain();
		sfxMasterGain.gain.value = 1;
		musicMasterGain.connect(audioCtx.destination);
		sfxMasterGain.connect(audioCtx.destination);
		startSpookyMusic();
		schedulePlayerSounds();
	}
	function note(midi) {
		return 440 * Math.pow(2, (midi - 69) / 12);
	}
	function makeReverb(ctx, seconds = 2.5, decay = 2) {
		const conv = ctx.createConvolver();
		const rate = ctx.sampleRate, len = rate * seconds;
		const buf = ctx.createBuffer(2, len, rate);
		for (let c = 0; c < 2; c++) {
			const d = buf.getChannelData(c);
			for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
		}
		conv.buffer = buf;
		return conv;
	}
	function startSpookyMusic() {
		if (!audioCtx || musicStarted) return;
		musicStarted = true;
		const rev = makeReverb(audioCtx, 3.5, 1.8);
		rev.connect(musicMasterGain);
		[36, 43].forEach((n, idx) => {
			const osc = audioCtx.createOscillator();
			const gain = audioCtx.createGain();
			osc.type = "sawtooth";
			osc.frequency.value = note(n) + (idx ? .4 : -.3);
			gain.gain.value = .06;
			osc.connect(gain);
			gain.connect(rev);
			osc.start();
			const lfoRate = .05 + idx * .02;
			setInterval(() => {
				if (!audioCtx) return;
				const now = audioCtx.currentTime;
				const v = .03 + .05 * Math.abs(Math.sin(now * lfoRate * Math.PI));
				gain.gain.setTargetAtTime(v, now, 1.5);
			}, 200);
		});
		const SPOOKY_PHRASES = [
			[
				60,
				null,
				63,
				null,
				67,
				65,
				63,
				null,
				60
			],
			[
				72,
				70,
				68,
				null,
				67,
				null,
				65,
				63,
				60
			],
			[
				60,
				63,
				67,
				null,
				70,
				68,
				null,
				65,
				63
			],
			[
				67,
				null,
				68,
				65,
				null,
				63,
				60,
				null,
				58,
				60
			]
		];
		let phraseIdx = 0, noteIdx = 0;
		let violinPhrase = SPOOKY_PHRASES[0];
		function playViolinNote() {
			if (!audioCtx || !musicStarted) return;
			const mn = violinPhrase[noteIdx++];
			if (noteIdx >= violinPhrase.length) {
				noteIdx = 0;
				phraseIdx = (phraseIdx + 1) % SPOOKY_PHRASES.length;
				violinPhrase = SPOOKY_PHRASES[phraseIdx];
			}
			if (mn === null) {
				setTimeout(playViolinNote, 300);
				return;
			}
			const dur = .55 + Math.random() * .4;
			const freq = note(mn) + (Math.random() - .5) * 1.5;
			const now = audioCtx.currentTime;
			const osc = audioCtx.createOscillator(), vib = audioCtx.createOscillator();
			const vibGn = audioCtx.createGain(), filter = audioCtx.createBiquadFilter(), gainN = audioCtx.createGain();
			osc.type = "sawtooth";
			osc.frequency.value = freq;
			vib.type = "sine";
			vib.frequency.value = 5.5;
			vibGn.gain.value = 4;
			vib.connect(vibGn);
			vibGn.connect(osc.frequency);
			filter.type = "bandpass";
			filter.frequency.value = freq * 2;
			filter.Q.value = 2.5;
			gainN.gain.setValueAtTime(0, now);
			gainN.gain.linearRampToValueAtTime(.22, now + .08);
			gainN.gain.setTargetAtTime(0, now + dur * .7, dur * .15);
			osc.connect(filter);
			filter.connect(gainN);
			gainN.connect(rev);
			osc.start(now);
			osc.stop(now + dur + .2);
			vib.start(now);
			vib.stop(now + dur + .2);
			setTimeout(playViolinNote, (dur + .05 + Math.random() * .2) * 1e3);
		}
		setTimeout(playViolinNote, 800);
		const OCARINA_MOTIFS = [
			[
				67,
				null,
				null,
				65,
				null,
				63,
				null,
				null,
				62,
				null,
				60
			],
			[
				60,
				null,
				63,
				null,
				60,
				null,
				58,
				null,
				60
			],
			[
				72,
				null,
				null,
				70,
				68,
				null,
				65,
				null,
				null
			],
			[
				63,
				65,
				null,
				68,
				null,
				65,
				63,
				null,
				null,
				60,
				null
			]
		];
		let omIdx = 0, onIdx = 0;
		let oMotif = OCARINA_MOTIFS[0];
		function playOcarinaNote() {
			if (!audioCtx || !musicStarted) return;
			const mn = oMotif[onIdx++];
			if (onIdx >= oMotif.length) {
				onIdx = 0;
				omIdx = (omIdx + 1) % OCARINA_MOTIFS.length;
				oMotif = OCARINA_MOTIFS[omIdx];
			}
			const dur = .45 + Math.random() * .35;
			if (mn !== null) {
				const freq = note(mn) * (.995 + Math.random() * .012);
				const now = audioCtx.currentTime;
				const osc1 = audioCtx.createOscillator(), osc2 = audioCtx.createOscillator();
				const g = audioCtx.createGain(), gMix = audioCtx.createGain();
				osc1.type = "sine";
				osc1.frequency.value = freq;
				osc2.type = "sine";
				osc2.frequency.value = freq * 2.01;
				gMix.gain.value = .18;
				g.gain.setValueAtTime(0, now);
				g.gain.linearRampToValueAtTime(.28, now + .06);
				g.gain.setTargetAtTime(0, now + dur * .65, dur * .12);
				osc1.connect(g);
				osc2.connect(gMix);
				gMix.connect(g);
				g.connect(rev);
				g.connect(musicMasterGain);
				osc1.start(now);
				osc1.stop(now + dur + .15);
				osc2.start(now);
				osc2.stop(now + dur + .15);
			}
			setTimeout(playOcarinaNote, (dur + .12 + Math.random() * .3) * 1e3);
		}
		setTimeout(playOcarinaNote, 2200);
		function pizzicato() {
			if (!audioCtx || !musicStarted) return;
			const pizzNotes = [
				36,
				38,
				41,
				43,
				46
			];
			const n = pizzNotes[Math.floor(Math.random() * pizzNotes.length)];
			const now = audioCtx.currentTime;
			const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
			osc.type = "triangle";
			osc.frequency.value = note(n);
			gain.gain.setValueAtTime(.18, now);
			gain.gain.exponentialRampToValueAtTime(.001, now + 1.2);
			osc.connect(gain);
			gain.connect(rev);
			osc.start(now);
			osc.stop(now + 1.5);
			setTimeout(pizzicato, 1800 + Math.random() * 3500);
		}
		setTimeout(pizzicato, 1200);
	}
	function playDeerYell(type) {
		if (!audioCtx) return;
		const now = audioCtx.currentTime;
		if (type === "chase") {
			const osc = audioCtx.createOscillator(), osc2 = audioCtx.createOscillator();
			const dist = audioCtx.createWaveShaper(), gain = audioCtx.createGain();
			const curve = new Float32Array(256);
			for (let i = 0; i < 256; i++) {
				const x = i * 2 / 255 - 1;
				curve[i] = x < 0 ? -Math.pow(-x, .7) : Math.pow(x, .7) * 1.4;
			}
			dist.curve = curve;
			osc.type = "sawtooth";
			osc.frequency.setValueAtTime(280 + Math.random() * 60, now);
			osc.frequency.linearRampToValueAtTime(80, now + .7);
			osc2.type = "square";
			osc2.frequency.value = 37;
			gain.gain.setValueAtTime(.5, now);
			gain.gain.exponentialRampToValueAtTime(.001, now + .9);
			osc.connect(dist);
			dist.connect(gain);
			osc2.connect(gain);
			gain.connect(sfxMasterGain);
			osc.start(now);
			osc.stop(now + 1);
			osc2.start(now);
			osc2.stop(now + 1);
			setTimeout(() => {
				if (!audioCtx) return;
				const n2 = audioCtx.currentTime;
				const s = audioCtx.createOscillator(), g = audioCtx.createGain();
				s.type = "sawtooth";
				s.frequency.setValueAtTime(520 + Math.random() * 80, n2);
				s.frequency.exponentialRampToValueAtTime(190, n2 + .35);
				g.gain.setValueAtTime(.3, n2);
				g.gain.exponentialRampToValueAtTime(.001, n2 + .45);
				s.connect(g);
				g.connect(sfxMasterGain);
				s.start(n2);
				s.stop(n2 + .5);
			}, 200 + Math.random() * 100);
		} else {
			const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
			const rev2 = makeReverb(audioCtx, 2, 2.5);
			rev2.connect(sfxMasterGain);
			osc.type = "sine";
			const baseFreq = 200 + Math.random() * 80;
			osc.frequency.setValueAtTime(baseFreq, now);
			osc.frequency.linearRampToValueAtTime(baseFreq * 1.3, now + .3);
			osc.frequency.linearRampToValueAtTime(baseFreq * .7, now + .9);
			osc.frequency.linearRampToValueAtTime(baseFreq * 1.1, now + 1.4);
			gain.gain.setValueAtTime(0, now);
			gain.gain.linearRampToValueAtTime(.4, now + .1);
			gain.gain.setTargetAtTime(0, now + 1, .3);
			osc.connect(gain);
			gain.connect(rev2);
			osc.start(now);
			osc.stop(now + 2);
		}
	}
	function playDeerAttackRoar() {
		if (!audioCtx) return;
		playDeerYell("chase");
		const now = audioCtx.currentTime;
		const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * .15, audioCtx.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3) * .9;
		const src = audioCtx.createBufferSource(), filt = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
		src.buffer = buf;
		filt.type = "lowpass";
		filt.frequency.value = 180;
		g.gain.value = 1.2;
		src.connect(filt);
		filt.connect(g);
		g.connect(sfxMasterGain);
		src.start(now);
	}
	function schedulePlayerSounds() {
		const delay = (8 + Math.random() * 12) * 1e3;
		setTimeout(() => {
			if (!gameState.gameOver && !gameState.gameWon && audioCtx) {
				const r = Math.random();
				if (r < .33) playBurp();
				else if (r < .66) playWhistle();
				else playFart();
			}
			schedulePlayerSounds();
		}, delay);
	}
	function playBurp() {
		if (!audioCtx) return;
		const now = audioCtx.currentTime;
		const bufLen = audioCtx.sampleRate * .45;
		const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < bufLen; i++) {
			const t = i / audioCtx.sampleRate;
			const env = Math.pow(Math.sin(Math.PI * i / bufLen), .4);
			d[i] = (Math.random() * 2 - 1) * .3 * env + Math.sin(2 * Math.PI * 90 * t * Math.pow(1 - t * .8, .5)) * .6 * env;
		}
		const src = audioCtx.createBufferSource(), filt = audioCtx.createBiquadFilter(), gain = audioCtx.createGain();
		src.buffer = buf;
		filt.type = "bandpass";
		filt.frequency.value = 220;
		filt.Q.value = 1.8;
		gain.gain.value = .7;
		src.connect(filt);
		filt.connect(gain);
		gain.connect(sfxMasterGain);
		src.start(now);
		showFloatingText("💨 *burp*");
	}
	function playWhistle() {
		if (!audioCtx) return;
		const now = audioCtx.currentTime;
		const tunes = [
			[72, 74],
			[74, 72],
			[76, 74],
			[69, 71]
		];
		tunes[Math.floor(Math.random() * tunes.length)].forEach((mn, idx) => {
			const t = now + idx * .28;
			const freq = note(mn) + (Math.random() - .5) * 3;
			const osc = audioCtx.createOscillator(), noise_osc = audioCtx.createOscillator();
			const gain = audioCtx.createGain(), nGain = audioCtx.createGain();
			osc.type = "sine";
			osc.frequency.value = freq;
			noise_osc.type = "sawtooth";
			noise_osc.frequency.value = freq * 8;
			nGain.gain.value = .02;
			gain.gain.setValueAtTime(0, t);
			gain.gain.linearRampToValueAtTime(.55, t + .04);
			gain.gain.setTargetAtTime(0, t + .18, .05);
			osc.connect(gain);
			noise_osc.connect(nGain);
			nGain.connect(gain);
			gain.connect(sfxMasterGain);
			osc.start(t);
			osc.stop(t + .35);
			noise_osc.start(t);
			noise_osc.stop(t + .35);
		});
		showFloatingText("🎵 *whistle*");
	}
	function playFart() {
		if (!audioCtx) return;
		const now = audioCtx.currentTime;
		const dur = .3 + Math.random() * .4;
		const bufLen = Math.floor(audioCtx.sampleRate * dur);
		const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
		const d = buf.getChannelData(0);
		const baseFreq = 60 + Math.random() * 40, flutterRate = 18 + Math.random() * 12;
		for (let i = 0; i < bufLen; i++) {
			const t = i / audioCtx.sampleRate;
			const env = Math.pow(Math.sin(Math.PI * i / bufLen), .5) * (1 - t / dur * .3);
			const flutter = .5 + .5 * Math.sin(2 * Math.PI * flutterRate * t);
			d[i] = (Math.random() * 2 - 1) * .4 * flutter * env + Math.sin(2 * Math.PI * baseFreq * (1 + t * .3) * t) * .6 * flutter * env;
		}
		const src = audioCtx.createBufferSource(), filt = audioCtx.createBiquadFilter(), gain = audioCtx.createGain();
		src.buffer = buf;
		filt.type = "lowpass";
		filt.frequency.value = 400;
		gain.gain.value = .65;
		src.connect(filt);
		filt.connect(gain);
		gain.connect(sfxMasterGain);
		src.start(now);
		showFloatingText("💨 *pfffft*");
	}
	function playSfxChop() {
		if (!audioCtx) return;
		const now = audioCtx.currentTime;
		const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * .12, audioCtx.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5);
		const src = audioCtx.createBufferSource(), filt = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
		src.buffer = buf;
		filt.type = "bandpass";
		filt.frequency.value = 800;
		filt.Q.value = .8;
		g.gain.value = .4;
		src.connect(filt);
		filt.connect(g);
		g.connect(sfxMasterGain);
		src.start(now);
	}
	function playSfxSwing() {
		if (!audioCtx) return;
		const now = audioCtx.currentTime;
		const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
		osc.type = "sawtooth";
		osc.frequency.setValueAtTime(900, now);
		osc.frequency.exponentialRampToValueAtTime(200, now + .18);
		gain.gain.setValueAtTime(.3, now);
		gain.gain.exponentialRampToValueAtTime(.001, now + .2);
		osc.connect(gain);
		gain.connect(sfxMasterGain);
		osc.start(now);
		osc.stop(now + .25);
	}
	function playSfxCraft() {
		if (!audioCtx) return;
		const now = audioCtx.currentTime;
		[
			0,
			.1,
			.2
		].forEach((delay, i) => {
			const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
			osc.type = "sine";
			osc.frequency.value = note(60 + i * 4);
			g.gain.setValueAtTime(.25, now + delay);
			g.gain.exponentialRampToValueAtTime(.001, now + delay + .18);
			osc.connect(g);
			g.connect(sfxMasterGain);
			osc.start(now + delay);
			osc.stop(now + delay + .2);
		});
	}
	function sfxChop() {
		if (audioCtx) playSfxChop();
	}
	function sfxSwing() {
		if (audioCtx) playSfxSwing();
	}
	function sfxCraft() {
		if (audioCtx) playSfxCraft();
	}
	function sfxDeerRoar() {
		if (audioCtx) playDeerAttackRoar();
	}
	function startDeerYells() {
		if (deerYellInterval) return;
		deerYellInterval = setInterval(() => {
			if (!gameState.gameOver && !gameState.gameWon && gameState.deerAlive && audioCtx) {
				if (gameState.deerState === "chase") playDeerYell("chase");
				else if (Math.random() < .4) playDeerYell("wander");
			}
		}, 4e3 + Math.random() * 5e3);
	}
	//#endregion
	//#region src/deer.ts
	const deerGroup = new THREE.Group();
	scene.add(deerGroup);
	const deer = {
		pos: new THREE.Vector3(0, 0, 50 * .6),
		facing: 0,
		hp: 100,
		state: "wander",
		wanderTarget: new THREE.Vector3(),
		wanderTimer: 0,
		legPhase: 0,
		attackTimer: 0,
		alive: true
	};
	deerGroup.position.copy(deer.pos);
	function buildDeer() {
		deerGroup.clear();
		const brown = new THREE.MeshLambertMaterial({ color: 9132587 });
		const dkBrn = new THREE.MeshLambertMaterial({ color: 5910544 });
		const tan = new THREE.MeshLambertMaterial({ color: 13803626 });
		const body = new THREE.Mesh(new THREE.BoxGeometry(1, .6, .5), brown);
		body.position.y = .8;
		body.castShadow = true;
		deerGroup.add(body);
		const neck = new THREE.Mesh(new THREE.BoxGeometry(.3, .5, .3), brown);
		neck.position.set(.45, 1.1, 0);
		neck.rotation.z = -.4;
		deerGroup.add(neck);
		const head = new THREE.Mesh(new THREE.BoxGeometry(.38, .32, .32), brown);
		head.position.set(.78, 1.35, 0);
		head.castShadow = true;
		deerGroup.add(head);
		const snout = new THREE.Mesh(new THREE.BoxGeometry(.18, .14, .24), tan);
		snout.position.set(.96, 1.26, 0);
		deerGroup.add(snout);
		for (const s of [-1, 1]) {
			const eye = new THREE.Mesh(new THREE.BoxGeometry(.07, .07, .04), new THREE.MeshBasicMaterial({ color: 16720384 }));
			eye.position.set(.85, 1.42, s * .14);
			deerGroup.add(eye);
		}
		for (const s of [-1, 1]) {
			const base = new THREE.Mesh(new THREE.CylinderGeometry(.04, .06, .4, 4), dkBrn);
			base.position.set(.72, 1.62, s * .12);
			base.rotation.z = s * .25;
			deerGroup.add(base);
			for (let b = 0; b < 2; b++) {
				const br = new THREE.Mesh(new THREE.CylinderGeometry(.03, .04, .28, 4), dkBrn);
				br.position.set(.72 + s * .08 + b * .1 * s, 1.88 + b * .1, s * .2);
				br.rotation.z = s * (.7 + b * .3);
				deerGroup.add(br);
			}
		}
		for (const [lx, lz] of [
			[.3, .25],
			[.3, -.25],
			[-.3, .25],
			[-.3, -.25]
		]) {
			const leg = new THREE.Mesh(new THREE.BoxGeometry(.16, .55, .16), brown);
			leg.position.set(lx, .3, lz);
			leg.castShadow = true;
			deerGroup.add(leg);
		}
		const tail = new THREE.Mesh(new THREE.BoxGeometry(.12, .14, .1), tan);
		tail.position.set(-.54, .95, 0);
		deerGroup.add(tail);
	}
	function updateDeer(dt) {
		if (!deer.alive || gameState.gameOver || gameState.gameWon) return;
		const ap = gameState.inCar ? carPos : player.pos;
		const dx = deer.pos.x - ap.x, dz = deer.pos.z - ap.z;
		const d = Math.sqrt(dx * dx + dz * dz);
		if (dist2D(ap.x, ap.z, 0, 0) < 8 && !gameState.inCar) deer.state = "wander";
		else if (d < 18) deer.state = "chase";
		else deer.state = "wander";
		gameState.deerState = deer.state;
		gameState.deerAlive = deer.alive;
		let mx = 0, mz = 0;
		if (deer.state === "chase") {
			const len = d || 1;
			mx = -(dx / len) * DEER_SPD;
			mz = -(dz / len) * DEER_SPD;
			deer.facing = Math.atan2(-mx, -mz);
			deer.attackTimer -= dt;
			if (d < 2 && deer.attackTimer <= 0 && !gameState.inCar) {
				deer.attackTimer = DEER_ATK_INT;
				if (player.invincTimer <= 0) {
					gameState.playerHP -= 12;
					player.invincTimer = .5;
					sfxDeerRoar();
					flashColor("rgba(255,0,0,0.4)");
					if (gameState.playerHP <= 0) {
						gameState.playerHP = 0;
						gameState.onDeath?.("deer");
					}
				}
			}
		} else {
			deer.wanderTimer -= dt;
			if (deer.wanderTimer <= 0) {
				deer.wanderTimer = 2 + Math.random() * 3;
				const a = Math.random() * Math.PI * 2;
				const r = 11 + Math.random() * 37;
				deer.wanderTarget.set(Math.cos(a) * r, 0, Math.sin(a) * r);
			}
			const tx = deer.wanderTarget.x - deer.pos.x, tz = deer.wanderTarget.z - deer.pos.z;
			const tl = Math.sqrt(tx * tx + tz * tz) || 1;
			if (tl > 1) {
				mx = tx / tl * DEER_SPD * .5;
				mz = tz / tl * DEER_SPD * .5;
				deer.facing = Math.atan2(-mx, -mz);
			}
		}
		const nx = deer.pos.x + mx * dt, nz = deer.pos.z + mz * dt;
		if (deerCanEnter(nx, nz) && !deforestedCells.has(cellKey(nx, nz))) {
			deer.pos.x = nx;
			deer.pos.z = nz;
		} else deer.wanderTimer = 0;
		deer.legPhase += dt * 4;
		deerGroup.position.set(deer.pos.x, Math.abs(Math.sin(deer.legPhase * .5)) * .05, deer.pos.z);
		deerGroup.rotation.y = deer.facing;
		deerGroup.rotation.z = Math.sin(deer.legPhase) * .15;
		deerGroup.children.forEach((c, i) => {
			if (i >= 12 && i <= 15) c.position.y = .3 + Math.sin(deer.legPhase + i * 1.5) * .08;
		});
	}
	//#endregion
	//#region src/enemies.ts
	function spawnAliens() {
		showEventBanner("👽 ALIENS LANDING!", 5e3, "#0f0");
		for (let i = 0; i < 4; i++) {
			const g = new THREE.Group();
			const gMat = new THREE.MeshLambertMaterial({ color: 4513092 });
			const body = new THREE.Mesh(new THREE.SphereGeometry(.35, 8, 8), gMat);
			body.position.y = .7;
			g.add(body);
			const head = new THREE.Mesh(new THREE.SphereGeometry(.28, 8, 8), new THREE.MeshLambertMaterial({ color: 5631573 }));
			head.position.y = 1.2;
			g.add(head);
			for (const ex of [-.13, .13]) {
				const eye = new THREE.Mesh(new THREE.SphereGeometry(.08, 6, 6), new THREE.MeshBasicMaterial({ color: 16711680 }));
				eye.position.set(ex, 1.28, .22);
				g.add(eye);
			}
			for (const s of [-1, 1]) {
				const arm = new THREE.Mesh(new THREE.BoxGeometry(.1, .4, .1), gMat);
				arm.position.set(s * .45, .75, 0);
				g.add(arm);
			}
			const ufo = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .14, 16), new THREE.MeshLambertMaterial({ color: 13421823 }));
			ufo.position.y = 2;
			g.add(ufo);
			const dome = new THREE.Mesh(new THREE.SphereGeometry(.28, 8, 8), new THREE.MeshBasicMaterial({
				color: 8956671,
				transparent: true,
				opacity: .7
			}));
			dome.position.y = 2.2;
			g.add(dome);
			const beam = new THREE.Mesh(new THREE.CylinderGeometry(.05, .3, 1.8, 8), new THREE.MeshBasicMaterial({
				color: 8978312,
				transparent: true,
				opacity: .3
			}));
			beam.position.y = 1.1;
			g.add(beam);
			const angle = Math.random() * Math.PI * 2;
			const r = 60 + Math.random() * 25;
			const pos = new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r);
			g.position.copy(pos);
			scene.add(g);
			aliens.push({
				mesh: g,
				pos: pos.clone(),
				hp: 2,
				alive: true,
				speed: 3 + Math.random() * 2,
				attackTimer: 1 + Math.random()
			});
		}
	}
	function spawnZombies() {
		showEventBanner("🧟 ZOMBIES FROM THE LAB!", 6e3, "#f80");
		for (let i = 0; i < 6; i++) {
			const g = new THREE.Group();
			const zMat = new THREE.MeshLambertMaterial({ color: 5933626 });
			const zSkin = new THREE.MeshLambertMaterial({ color: 8039002 });
			const zEye = new THREE.MeshBasicMaterial({ color: 16720384 });
			const body = new THREE.Mesh(new THREE.BoxGeometry(.48, .65, .28), zMat);
			body.position.y = .83;
			g.add(body);
			const head = new THREE.Mesh(new THREE.BoxGeometry(.38, .38, .38), zSkin);
			head.position.y = 1.42;
			g.add(head);
			for (const s of [-1, 1]) {
				const eye = new THREE.Mesh(new THREE.BoxGeometry(.07, .07, .04), zEye);
				eye.position.set(s * .11, 1.45, .2);
				g.add(eye);
			}
			for (const s of [-1, 1]) {
				const arm = new THREE.Mesh(new THREE.BoxGeometry(.16, .45, .16), zMat);
				arm.position.set(s * .33, 1, .22);
				arm.rotation.x = -.7;
				g.add(arm);
			}
			for (const s of [-1, 1]) {
				const leg = new THREE.Mesh(new THREE.BoxGeometry(.18, .48, .18), zMat);
				leg.position.set(s * .13, .24, 0);
				g.add(leg);
			}
			const pos = new THREE.Vector3(125 + Math.random() * 20, 0, (Math.random() - .5) * 18);
			g.position.copy(pos);
			scene.add(g);
			zombies.push({
				mesh: g,
				pos: pos.clone(),
				hp: 2,
				alive: true,
				speed: 2 + Math.random() * 1.5,
				attackTimer: 1.5 + Math.random(),
				legPhase: Math.random() * Math.PI * 2
			});
		}
	}
	function updateEnemies(dt) {
		const ap = gameState.inCar ? carPos : player.pos;
		for (const e of [...aliens, ...zombies]) {
			if (!e.alive) continue;
			const dx = ap.x - e.pos.x, dz = ap.z - e.pos.z;
			const d = Math.sqrt(dx * dx + dz * dz) || 1;
			e.pos.x += dx / d * e.speed * dt;
			e.pos.z += dz / d * e.speed * dt;
			e.mesh.position.set(e.pos.x, 0, e.pos.z);
			e.mesh.rotation.y = Math.atan2(dx, dz);
			if ("legPhase" in e && e.legPhase !== void 0) {
				e.legPhase += dt * 3;
				e.mesh.rotation.z = Math.sin(e.legPhase) * .12;
				e.mesh.position.y = Math.abs(Math.sin(e.legPhase * .5)) * .04;
			} else e.mesh.position.y = .1 + Math.sin(Date.now() * .003 + e.pos.x) * .15;
			e.attackTimer -= dt;
			if (d < 1.8 && e.attackTimer <= 0 && !gameState.inCar) {
				e.attackTimer = 2;
				if (player.invincTimer <= 0) {
					const isAlien = aliens.includes(e);
					gameState.playerHP -= isAlien ? 15 : 10;
					player.invincTimer = .4;
					flashColor(isAlien ? "rgba(0,255,0,0.35)" : "rgba(200,140,0,0.4)");
					if (gameState.playerHP <= 0) {
						gameState.playerHP = 0;
						gameState.onDeath?.(isAlien ? "alien" : "zombie");
					}
				}
			}
			if (gameState.inCar && dist2D(e.pos.x, e.pos.z, carPos.x, carPos.z) < 2.5) {
				e.alive = false;
				scene.remove(e.mesh);
				setActionHint("💥 Squashed!");
			}
			if (dist2D(e.pos.x, e.pos.z, 0, 0) > 210) {
				e.alive = false;
				scene.remove(e.mesh);
			}
		}
	}
	//#endregion
	//#region src/camera.ts
	function updateCamera() {
		const pivot = gameState.inCar ? carPos : player.pos;
		const facing = gameState.inCar ? gameState.carFacing : player.facing;
		if (gameState.inCar && gameState.driverView) {
			const fwdX = -Math.sin(facing);
			const fwdZ = -Math.cos(facing);
			camera.position.set(pivot.x - fwdX * .2, 1.3, pivot.z - fwdZ * .2);
			camera.lookAt(pivot.x + fwdX * 20, 1.2, pivot.z + fwdZ * 20);
		} else {
			camera.position.set(pivot.x + Math.sin(facing) * 7, 5, pivot.z + Math.cos(facing) * 7);
			camera.lookAt(pivot.x, 1.2, pivot.z);
		}
	}
	//#endregion
	//#region src/workbench.ts
	function placeWorkbench(x, z) {
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, .7, .8), new THREE.MeshLambertMaterial({ color: 9135395 }));
		mesh.position.set(x, .35, z);
		mesh.castShadow = true;
		scene.add(mesh);
		const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, .06, .8), new THREE.MeshLambertMaterial({ color: 10516528 }));
		top.position.set(x, .73, z);
		scene.add(top);
		gameState.built.workbench = true;
		gameState.workbenchPos = new THREE.Vector3(x, 0, z);
	}
	//#endregion
	//#region src/touch-controls.ts
	const TAP_MS = 230;
	const TAP_MOVE_PX = 18;
	function isLikelyKeyboardlessDevice() {
		const hasTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
		const coarsePointer = window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(any-pointer: coarse)").matches;
		const mobileUA = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent);
		return hasTouch && (coarsePointer || mobileUA);
	}
	function initTouchControls(hooks) {
		if (!isLikelyKeyboardlessDevice()) return;
		const controlsEl = document.getElementById("touch-controls");
		const zonesEl = document.getElementById("touch-zones");
		const viewBtn = document.getElementById("touch-view-btn");
		if (!controlsEl || !zonesEl || !viewBtn) return;
		const clearDirectionalKeys = () => {
			keys.ArrowLeft = false;
			keys.ArrowRight = false;
			keys.ArrowUp = false;
			keys.ArrowDown = false;
		};
		const setDirectionFromPoint = (clientX, clientY) => {
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
		const enableTouchControls = () => {
			gameState.inputProfile = "touch";
			controlsEl.style.display = "block";
		};
		let movementPointerId = null;
		let downX = 0;
		let downY = 0;
		let downTs = 0;
		viewBtn.addEventListener("click", (ev) => {
			ev.preventDefault();
			hooks.onStart();
			hooks.onToggleCamera();
		});
		zonesEl.addEventListener("pointerdown", (ev) => {
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
		zonesEl.addEventListener("pointermove", (ev) => {
			if (movementPointerId !== ev.pointerId) return;
			ev.preventDefault();
			setDirectionFromPoint(ev.clientX, ev.clientY);
		});
		const finishMovementPointer = (ev) => {
			if (movementPointerId !== ev.pointerId) return;
			const elapsed = performance.now() - downTs;
			const moved = Math.hypot(ev.clientX - downX, ev.clientY - downY);
			movementPointerId = null;
			clearDirectionalKeys();
			if (zonesEl.hasPointerCapture(ev.pointerId)) zonesEl.releasePointerCapture(ev.pointerId);
			if (elapsed <= TAP_MS && moved <= TAP_MOVE_PX) hooks.onAction();
		};
		zonesEl.addEventListener("pointerup", finishMovementPointer);
		zonesEl.addEventListener("pointercancel", finishMovementPointer);
		enableTouchControls();
	}
	//#endregion
	//#region src/input.ts
	function actionControlName() {
		return gameState.inputProfile === "touch" ? "TAP" : "SPACE";
	}
	function cameraControlName() {
		return gameState.inputProfile === "touch" ? "VIEW" : "V";
	}
	function setDrivingHint() {
		setActionHint(`🚗 Driving! ${gameState.inputProfile === "touch" ? "screen zones drive + steer" : "↑↓ accelerate, ←→ steer"}, ${cameraControlName()} camera, ${actionControlName()} exit.`);
	}
	function toggleCarCameraView() {
		if (!gameState.inCar) return;
		gameState.driverView = !gameState.driverView;
		if (gameState.inputProfile === "touch") {
			setActionHint(gameState.driverView ? "🚗 Driver view active — tap VIEW to switch back" : "🚗 Third-person view active — tap VIEW for driver view");
			return;
		}
		setActionHint(gameState.driverView ? "🚗 Driver view — press V to switch back" : "🚗 Third-person view — press V for driver view");
	}
	function handleAction() {
		if (gameState.gameOver || gameState.gameWon) return;
		const nearCar = dist2D(player.pos.x, player.pos.z, carPos.x, carPos.z) < 3;
		if (!gameState.inCar && nearCar) {
			gameState.inCar = true;
			playerGroup.visible = false;
			setDrivingHint();
			return;
		}
		if (gameState.inCar) {
			gameState.inCar = false;
			gameState.driverView = false;
			player.pos.set(carPos.x + 2, 0, carPos.z);
			playerGroup.visible = true;
			setActionHint("Exited car.");
			return;
		}
		const px = player.pos.x, pz = player.pos.z;
		const fwdX = -Math.sin(player.facing), fwdZ = -Math.cos(player.facing);
		if (gameState.hasSword && gameState.playerAttackTimer <= 0 && dist2D(px, pz, deer.pos.x, deer.pos.z) < 2.5) {
			gameState.playerAttackTimer = .6;
			sfxSwing();
			gameState.deerHP = Math.max(0, gameState.deerHP - 25);
			setActionHint("⚔️ Hit! Deer HP: " + Math.ceil(gameState.deerHP));
			if (gameState.deerHP <= 0) gameState.onWin?.();
			return;
		}
		for (const t of trees) {
			if (!t.alive) continue;
			if (dist2D(px, pz, t.x, t.z) < 2.8) {
				t.hp--;
				sfxChop();
				setActionHint(`🪓 Chopping... (${t.hp} hits left)`);
				if (t.hp <= 0) {
					t.alive = false;
					scene.remove(t.mesh);
					addStump(t.x, t.z);
					gameState.resources.wood += 3;
					setActionHint("🪵 Got 3 wood!");
					checkProgress();
				}
				return;
			}
		}
		if (gameState.hasPickaxe) for (const m of mines) {
			if (!m.alive) continue;
			if (dist2D(px, pz, m.x, m.z) < 2.8) {
				m.hp--;
				sfxChop();
				setActionHint(`⛏️ Mining... (${m.hp} hits left)`);
				if (m.hp <= 0) {
					m.alive = false;
					scene.remove(m.mesh);
					gameState.resources.ore += 3;
					setActionHint("⛰️ Got 3 ore!");
					checkProgress();
				}
				return;
			}
		}
		const wb = gameState.workbenchPos;
		if (wb && dist2D(px, pz, wb.x, wb.z) < 2.5) {
			if (!gameState.hasPickaxe) {
				if (gameState.resources.wood >= 3) {
					gameState.resources.wood -= 3;
					gameState.hasPickaxe = true;
					gameState.stage = Math.max(gameState.stage, 2);
					sfxCraft();
					setActionHint("⛏️ Pickaxe crafted!");
					showMessage(`⛏️ <strong>Pickaxe crafted!</strong><br>Find grey rock formations (mines) deep in the forest.<br>Walk up close and press ${actionControlName()} to mine ore!`, 5e3);
					updateHUD(deer, player);
				} else setActionHint(`Need 3 wood for pickaxe — have ${gameState.resources.wood}`);
				return;
			}
			if (!gameState.hasSword) {
				if (gameState.resources.ore >= 3 && gameState.resources.wood >= 2) {
					gameState.resources.ore -= 3;
					gameState.resources.wood -= 2;
					gameState.hasSword = true;
					addSwordToPlayer();
					gameState.stage = 4;
					sfxCraft();
					setActionHint("🗡️ Sword forged! Hunt the deer!");
					showMessage(`🗡️ <strong>SWORD FORGED!</strong><br>Hunt down the deer and press ${actionControlName()} when close to attack it!`, 5e3);
					updateHUD(deer, player);
				} else setActionHint(`Sword needs 3 ore + 2 wood — have ore:${gameState.resources.ore} wood:${gameState.resources.wood}`);
				return;
			}
			setActionHint("Nothing left to craft.");
			return;
		}
		if (!gameState.built.workbench && isInSafeZone(px, pz)) {
			if (gameState.resources.wood >= 5) {
				gameState.resources.wood -= 5;
				placeWorkbench(px + fwdX * 1.5, pz + fwdZ * 1.5);
				gameState.stage = Math.max(gameState.stage, 1);
				setActionHint(`🔨 Workbench placed! Walk up and press ${actionControlName()}.`);
				showMessage(`🔨 <strong>Workbench built!</strong><br>Walk up to it and press ${actionControlName()}.<br>First craft: Pickaxe (3 wood) → mine ore → Sword (3 ore + 2 wood)`, 5500);
				updateHUD(deer, player);
			} else setActionHint(`Need 5 wood — have ${gameState.resources.wood}`);
			return;
		}
		setActionHint("Nothing to do here.");
	}
	function checkProgress() {
		if (gameState.resources.wood >= 5 && gameState.stage === 0) {
			gameState.stage = 1;
			showMessage(`🪵 <strong>Enough wood!</strong><br>Go to the safe zone (green circle in center).<br>Press ${actionControlName()} to build a Workbench!`, 5e3);
		}
		if (gameState.resources.ore >= 3 && gameState.hasPickaxe && !gameState.hasSword && gameState.stage < 3) {
			gameState.stage = 3;
			showMessage(`⛰️ <strong>Enough ore!</strong><br>Return to the Workbench and press ${actionControlName()} to forge the Sword!`, 5e3);
		}
		updateHUD(deer, player);
	}
	let introShown = true;
	function initInput(onFirstKey) {
		let started = false;
		const startGameFromInput = () => {
			if (started) return;
			started = true;
			if (introShown) {
				introShown = false;
				hideMessage();
			}
			initAudio();
			startDeerYells();
			onFirstKey();
		};
		window.addEventListener("keydown", (e) => {
			keys[e.key] = true;
			startGameFromInput();
			if (e.key === " ") {
				e.preventDefault();
				handleAction();
			}
			if (e.key === "v" || e.key === "V") toggleCarCameraView();
			if (e.key === "Escape") hideMessage();
		});
		window.addEventListener("keyup", (e) => {
			keys[e.key] = false;
		});
		window.addEventListener("pointerdown", (e) => {
			if (e.pointerType === "touch") startGameFromInput();
		});
		window.addEventListener("touchstart", () => {
			startGameFromInput();
		}, { passive: true });
		initTouchControls({
			onStart: startGameFromInput,
			onAction: handleAction,
			onToggleCamera: toggleCarCameraView
		});
	}
	//#endregion
	//#region src/main.ts
	makeGround();
	buildPlayer();
	buildDeer();
	generateWorld();
	renderer.render(scene, camera);
	initCarEnvMap();
	gameState.onWin = () => {
		deer.alive = false;
		deerGroup.visible = false;
		triggerWin();
	};
	gameState.onDeath = (by) => {
		triggerDeath(by);
	};
	showMessage(`🌲 <strong>FOREST SURVIVAL</strong> 🌲<br><br>
  <em>A vicious deer stalks the woods...<br>also aliens, and zombies from the lab.</em><br><br>
  <b>← → Turn &nbsp;&nbsp; ↑ ↓ Move &nbsp;&nbsp; SPACE Action</b><br>
  <b>Phone/Tablet: full-screen zones to move/steer, tap for action, VIEW button for car camera</b><br><br>
  Chop trees → build workbench → craft pickaxe<br>→ mine ore → forge sword → kill deer<br><br>
  🚗 Red car parked in the safe zone for emergencies<br>
  🧟 Zombies invade from the lab at dawn<br>
  👽 Aliens land randomly — car runs them over!<br><br>
  <strong style="color:#ffd700">Press any arrow key or tap screen to begin</strong>`, 0);
	let gameStarted = false;
	initInput(() => {
		gameStarted = true;
	});
	setInterval(() => {
		if (!gameState.gameOver && !gameState.gameWon) {
			if (Math.sqrt(player.pos.x ** 2 + player.pos.z ** 2) < 8 && gameState.playerHP < 100) gameState.playerHP = Math.min(100, gameState.playerHP + 1);
		}
	}, 2e3);
	let zombiesSpawned = false;
	function updateDayCycle(dt) {
		gameState.dayTime = (gameState.dayTime + dt / 120) % 1;
		const isDawn = gameState.dayTime > .22 && gameState.dayTime < .3;
		if (isDawn && !gameState.wasDawn) {
			gameState.wasDawn = true;
			if (!zombiesSpawned) {
				zombiesSpawned = true;
				spawnZombies();
			}
		}
		if (!isDawn) gameState.wasDawn = false;
		gameState.alienTimer -= dt;
		if (gameState.alienTimer <= 0) {
			gameState.alienTimer = 60 + Math.random() * 90;
			if (aliens.filter((a) => a.alive).length < 3) spawnAliens();
		}
		updateClock(renderer, scene, sun, ambient, moonLight);
	}
	let lastTime = performance.now();
	function animate(now) {
		requestAnimationFrame(animate);
		const dt = Math.min((now - lastTime) / 1e3, .05);
		lastTime = now;
		if (gameStarted && !gameState.gameOver && !gameState.gameWon) {
			updatePlayer(dt);
			updateCar(dt);
			updateDeer(dt);
			updateEnemies(dt);
			updateDayCycle(dt);
			updateCarHint(player.pos, carPos);
		}
		updateCamera();
		updateHUD(deer, player);
		updateMinimap(player.pos, carPos, deer.pos, deer.alive);
		renderer.render(scene, camera);
	}
	animate(performance.now());
	window.addEventListener("resize", () => {
		const W = window.innerWidth, H = window.innerHeight;
		renderer.setSize(W, H);
		camera.aspect = W / H;
		camera.updateProjectionMatrix();
	});
	//#endregion
})();
