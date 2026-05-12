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
	const moonLight = new THREE.DirectionalLight(3359846, .8);
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
		hasCage: false,
		cagePlaced: false,
		deerCaptured: false,
		cageLoadedInCar: false,
		cageLoadedInRocket: false,
		rocketLaunched: false,
		inRocket: false,
		rocketCockpitView: false,
		onPlanet: false,
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
		deerPos: {
			x: 0,
			z: 0
		},
		castlePos: {
			x: -80,
			z: -80
		},
		castleRadius: 12,
		rocketPos: {
			x: 0,
			z: 80
		},
		rocketRadius: 8,
		planetPos: {
			x: -112,
			z: 112
		},
		rocketFlightPos: {
			x: 0,
			z: 80
		},
		rocketFlightDest: {
			x: 0,
			z: 560
		},
		rocketFlightYaw: Math.PI,
		rocketFlightPitch: 0,
		rocketFlightSpeed: 0,
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
	const ROCKET_PITCH = 1.8;
	//#endregion
	//#region src/world.ts
	function dist2D(ax, az, bx, bz) {
		const dx = ax - bx, dz = az - bz;
		return Math.sqrt(dx * dx + dz * dz);
	}
	function intersectsRect2D(x, z, r, cx, cz, halfW, halfD) {
		return Math.abs(x - cx) < halfW + r && Math.abs(z - cz) < halfD + r;
	}
	function intersectsCircle2D(x, z, r, cx, cz, cr) {
		return dist2D(x, z, cx, cz) < r + cr;
	}
	function collidesWithRocketSite(x, z, r) {
		const rx = gameState.rocketPos.x;
		const rz = gameState.rocketPos.z;
		if (intersectsRect2D(x, z, r, rx, rz, 8.1, 8.1)) return true;
		if (intersectsRect2D(x, z, r, rx - 5, rz - 5, 1.8, 1.8)) return true;
		if (intersectsRect2D(x, z, r, rx - 2, rz - 5, 2.9, .6)) return true;
		if (intersectsRect2D(x, z, r, rx + 6, rz - 4, 2.2, 1.6)) return true;
		if (intersectsRect2D(x, z, r, rx + 6, rz, 2.2, 1.6)) return true;
		if (intersectsRect2D(x, z, r, rx + 6, rz + 4, 2.2, 1.6)) return true;
		if (intersectsCircle2D(x, z, r, rx, rz, 2.9)) return true;
		if (intersectsCircle2D(x, z, r, rx + 2.4, rz, .95)) return true;
		if (intersectsCircle2D(x, z, r, rx - 2.4, rz, .95)) return true;
		return false;
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
	/** Checks for collisions with any static object (trees, mines, workbench, castle, rocket site). */
	function checkWorldCollision(x, z, r) {
		for (const t of trees) if (t.alive && dist2D(x, z, t.x, t.z) < r + .6) return true;
		for (const m of mines) if (m.alive && dist2D(x, z, m.x, m.z) < r + .9) return true;
		if (gameState.workbenchPos && dist2D(x, z, gameState.workbenchPos.x, gameState.workbenchPos.z) < r + .9) return true;
		if (dist2D(x, z, gameState.castlePos.x, gameState.castlePos.z) < r + gameState.castleRadius) return true;
		if (collidesWithRocketSite(x, z, r)) return true;
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
	let groundRocketMesh = null;
	function hideGroundRocket() {
		if (groundRocketMesh) groundRocketMesh.visible = false;
	}
	function tuneSiteTexture(tex, repeatX, repeatY, isColor) {
		tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
		tex.repeat.set(repeatX, repeatY);
		tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
		if (isColor) tex.encoding = THREE.sRGBEncoding;
	}
	function loadSiteTexture(loader, path, repeatX, repeatY, isColor) {
		const tex = loader.load(path, void 0, void 0, () => {
			console.warn(`[rocket-site] Failed to load texture: ${path}`);
		});
		tuneSiteTexture(tex, repeatX, repeatY, isColor);
		return tex;
	}
	function makeRocketHullTexture() {
		const width = 1024;
		const height = 2048;
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");
		const baseGrad = ctx.createLinearGradient(0, 0, width, 0);
		baseGrad.addColorStop(0, "#e9edf3");
		baseGrad.addColorStop(.5, "#ffffff");
		baseGrad.addColorStop(1, "#dfe5ec");
		ctx.fillStyle = baseGrad;
		ctx.fillRect(0, 0, width, height);
		ctx.strokeStyle = "rgba(56,67,82,0.28)";
		ctx.lineWidth = 6;
		for (let y = 150; y < height; y += 180) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(width, y);
			ctx.stroke();
		}
		ctx.strokeStyle = "rgba(70,84,100,0.2)";
		ctx.lineWidth = 4;
		for (let x = 128; x < width; x += 128) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, height);
			ctx.stroke();
		}
		for (const band of [
			{
				y: 420,
				h: 84
			},
			{
				y: 1110,
				h: 68
			},
			{
				y: 1600,
				h: 60
			}
		]) {
			ctx.fillStyle = "#171f2b";
			ctx.fillRect(0, band.y, width, band.h);
			ctx.fillStyle = "#be3036";
			ctx.fillRect(0, band.y + band.h - 16, width, 16);
		}
		ctx.fillStyle = "#2a3850";
		ctx.font = "700 110px Arial";
		ctx.textAlign = "center";
		ctx.fillText("FSA", width * .5, 300);
		for (let i = 0; i < 3e3; i++) {
			const x = Math.random() * width;
			const y = Math.random() * height;
			const c = 232 + Math.floor(Math.random() * 20);
			ctx.fillStyle = `rgba(${c},${c},${c + 2},0.16)`;
			ctx.fillRect(x, y, 2, 2);
		}
		const tex = new THREE.CanvasTexture(canvas);
		tuneSiteTexture(tex, 1, 1, true);
		return tex;
	}
	function makeRocketPanelNormalTexture() {
		const width = 512;
		const height = 1024;
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");
		ctx.fillStyle = "#8080ff";
		ctx.fillRect(0, 0, width, height);
		ctx.strokeStyle = "#7676ff";
		ctx.lineWidth = 2;
		for (let y = 64; y < height; y += 90) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(width, y);
			ctx.stroke();
		}
		for (let i = 0; i < 2200; i++) {
			const x = Math.random() * width;
			const y = Math.random() * height;
			ctx.fillStyle = i % 2 === 0 ? "#7b7bff" : "#8686ff";
			ctx.fillRect(x, y, 2, 2);
		}
		const tex = new THREE.CanvasTexture(canvas);
		tuneSiteTexture(tex, 1, 1, false);
		return tex;
	}
	function makeRocketRoughnessTexture() {
		const width = 512;
		const height = 1024;
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");
		ctx.fillStyle = "#8d8d8d";
		ctx.fillRect(0, 0, width, height);
		ctx.fillStyle = "#757575";
		for (let y = 95; y < height; y += 180) ctx.fillRect(0, y, width, 14);
		for (let i = 0; i < 4200; i++) {
			const x = Math.random() * width;
			const y = Math.random() * height;
			const v = 112 + Math.random() * 60 | 0;
			ctx.fillStyle = `rgba(${v},${v},${v},0.18)`;
			ctx.fillRect(x, y, 2, 2);
		}
		const tex = new THREE.CanvasTexture(canvas);
		tuneSiteTexture(tex, 1, 1, false);
		return tex;
	}
	function makeRocketSite() {
		const rx = gameState.rocketPos.x, rz = gameState.rocketPos.z;
		const g = new THREE.Group();
		g.position.set(rx, 0, rz);
		const loader = new THREE.TextureLoader();
		const metalDiff = loadSiteTexture(loader, "assets/textures/car/metal_plate_02_diff_1k.jpg", 1.6, 3, true);
		const metalArm = loadSiteTexture(loader, "assets/textures/car/metal_plate_02_arm_1k.png", 1.6, 3, false);
		const metalNor = loadSiteTexture(loader, "assets/textures/car/metal_plate_02_nor_gl_1k.png", 1.6, 3, false);
		const rocketHullMap = makeRocketHullTexture();
		const rocketHullNormal = makeRocketPanelNormalTexture();
		const rocketHullRoughness = makeRocketRoughnessTexture();
		const structuralSteel = new THREE.MeshStandardMaterial({
			color: 12568526,
			map: metalDiff,
			normalMap: metalNor,
			roughnessMap: metalArm,
			metalnessMap: metalArm,
			metalness: .78,
			roughness: .42
		});
		const concrete = new THREE.MeshStandardMaterial({
			color: 9211280,
			roughness: .95,
			metalness: .03
		});
		const hazard = new THREE.MeshStandardMaterial({
			color: 16173591,
			roughness: .62,
			metalness: .08
		});
		const rocketHull = new THREE.MeshStandardMaterial({
			color: 16777215,
			map: rocketHullMap,
			normalMap: rocketHullNormal,
			roughnessMap: rocketHullRoughness,
			metalness: .24,
			roughness: .52
		});
		const rocketTrim = new THREE.MeshStandardMaterial({
			color: 1712689,
			map: metalDiff,
			normalMap: metalNor,
			roughnessMap: metalArm,
			metalnessMap: metalArm,
			metalness: .72,
			roughness: .35
		});
		const engine = new THREE.MeshStandardMaterial({
			color: 5266022,
			map: metalDiff,
			normalMap: metalNor,
			roughnessMap: metalArm,
			metalnessMap: metalArm,
			metalness: .9,
			roughness: .26,
			emissive: 2363648,
			emissiveIntensity: .15
		});
		const pad = new THREE.Mesh(new THREE.BoxGeometry(16, .5, 16), concrete);
		pad.position.y = .25;
		pad.receiveShadow = true;
		g.add(pad);
		for (let i = 0; i < 4; i++) {
			const m = new THREE.Mesh(new THREE.PlaneGeometry(16, .5), hazard);
			m.rotation.x = -Math.PI / 2;
			m.position.y = .51;
			if (i === 0) m.position.z = 7.75;
			if (i === 1) m.position.z = -7.75;
			if (i === 2) {
				m.position.x = 7.75;
				m.rotation.z = Math.PI / 2;
			}
			if (i === 3) {
				m.position.x = -7.75;
				m.rotation.z = Math.PI / 2;
			}
			g.add(m);
		}
		const towerHeight = 25;
		const tower = new THREE.Mesh(new THREE.BoxGeometry(3, towerHeight, 3), structuralSteel);
		tower.position.set(-5, towerHeight / 2 + .5, -5);
		tower.castShadow = true;
		g.add(tower);
		for (let i = 0; i < 6; i++) {
			const arm = new THREE.Mesh(new THREE.BoxGeometry(5, .4, .4), structuralSteel);
			arm.position.set(-2, 4 + i * 4, -5);
			arm.castShadow = true;
			g.add(arm);
		}
		const rocket = new THREE.Group();
		rocket.position.y = .5;
		const stage1 = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 12, 20), rocketHull);
		stage1.position.y = 6;
		stage1.castShadow = true;
		rocket.add(stage1);
		const stage2 = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 8, 20), rocketHull);
		stage2.position.y = 16;
		stage2.castShadow = true;
		rocket.add(stage2);
		const stage3 = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, 4, 20), rocketHull);
		stage3.position.y = 22;
		stage3.castShadow = true;
		rocket.add(stage3);
		const nose = new THREE.Mesh(new THREE.ConeGeometry(1, 3, 20), rocketHull);
		nose.position.y = 25.5;
		nose.castShadow = true;
		rocket.add(nose);
		const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.82, .08, 10, 36), rocketTrim);
		ring1.rotation.x = Math.PI / 2;
		ring1.position.y = 11.95;
		rocket.add(ring1);
		const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.42, .08, 10, 32), rocketTrim);
		ring2.rotation.x = Math.PI / 2;
		ring2.position.y = 19.95;
		rocket.add(ring2);
		for (let i = 0; i < 4; i++) {
			const fin = new THREE.Mesh(new THREE.BoxGeometry(.1, 3, 2), rocketTrim);
			const a = i / 4 * Math.PI * 2;
			fin.position.set(Math.cos(a) * 2.2, 1.5, Math.sin(a) * 2.2);
			fin.rotation.y = -a;
			fin.castShadow = true;
			rocket.add(fin);
		}
		for (let i = 0; i < 5; i++) {
			const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(.3, .5, .8, 12), engine);
			const a = i / 4 * Math.PI * 2;
			const r = i === 4 ? 0 : .8;
			nozzle.position.set(Math.cos(a) * r, -.4, Math.sin(a) * r);
			rocket.add(nozzle);
		}
		for (let i = 0; i < 2; i++) {
			const booster = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, 8, 16), rocketHull);
			const side = i === 0 ? 1 : -1;
			booster.position.set(side * 2.4, 4, 0);
			booster.castShadow = true;
			rocket.add(booster);
			const bNose = new THREE.Mesh(new THREE.ConeGeometry(.8, 1.5, 16), rocketHull);
			bNose.position.set(side * 2.4, 8.75, 0);
			bNose.castShadow = true;
			rocket.add(bNose);
		}
		groundRocketMesh = rocket;
		g.add(rocket);
		for (let i = 0; i < 3; i++) {
			const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 4, 14), structuralSteel);
			tank.position.set(6, 2, -4 + i * 4);
			tank.rotation.z = Math.PI / 2;
			tank.castShadow = true;
			g.add(tank);
		}
		scene.add(g);
		const path1 = new THREE.Mesh(new THREE.PlaneGeometry(8, 40), concrete);
		path1.rotation.x = -Math.PI / 2;
		path1.receiveShadow = true;
		path1.position.set(rx, .03, rz - 20);
		scene.add(path1);
		const path2 = new THREE.Mesh(new THREE.PlaneGeometry(6, 50), concrete);
		path2.rotation.x = -Math.PI / 2;
		path2.receiveShadow = true;
		path2.position.set(0, .02, 35);
		scene.add(path2);
	}
	function makeCastle() {
		const cx = gameState.castlePos.x, cz = gameState.castlePos.z;
		const g = new THREE.Group();
		g.position.set(cx, 0, cz);
		const stone = new THREE.MeshLambertMaterial({ color: 8947865 });
		const roof = new THREE.MeshLambertMaterial({ color: 11158596 });
		const gold = new THREE.MeshLambertMaterial({ color: 16766720 });
		const skin = new THREE.MeshLambertMaterial({ color: 16109737 });
		const dress = new THREE.MeshLambertMaterial({ color: 16738740 });
		const keep = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 12), stone);
		keep.position.y = 4;
		keep.castShadow = true;
		keep.receiveShadow = true;
		g.add(keep);
		for (let x of [-6, 6]) for (let z of [-6, 6]) {
			const t = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 12, 8), stone);
			t.position.set(x, 6, z);
			t.castShadow = true;
			g.add(t);
			const r = new THREE.Mesh(new THREE.ConeGeometry(2.5, 4, 8), roof);
			r.position.set(x, 14, z);
			g.add(r);
		}
		const tallT = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 18, 12), stone);
		tallT.position.set(-4, 9, -4);
		tallT.castShadow = true;
		g.add(tallT);
		const balcony = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, .4, 12), stone);
		balcony.position.set(-4, 15.5, -4);
		g.add(balcony);
		const rail = new THREE.Mesh(new THREE.TorusGeometry(3.1, .1, 8, 24), stone);
		rail.position.set(-4, 16.2, -4);
		rail.rotation.x = Math.PI / 2;
		g.add(rail);
		const pG = new THREE.Group();
		pG.position.set(-4, 15.7, -1.5);
		const pBody = new THREE.Mesh(new THREE.ConeGeometry(.4, .8, 8), dress);
		pBody.position.y = .4;
		pG.add(pBody);
		const pHead = new THREE.Mesh(new THREE.SphereGeometry(.25, 8, 8), skin);
		pHead.position.y = 1;
		pG.add(pHead);
		const pHair = new THREE.Mesh(new THREE.SphereGeometry(.28, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold);
		pHair.position.y = 1.05;
		pG.add(pHair);
		const pCrown = new THREE.Mesh(new THREE.CylinderGeometry(.15, .1, .15, 6), gold);
		pCrown.position.y = 1.35;
		pG.add(pCrown);
		g.add(pG);
		const gate = new THREE.Mesh(new THREE.BoxGeometry(4, 5, .5), new THREE.MeshLambertMaterial({ color: 5913114 }));
		gate.position.set(0, 2.5, 6);
		g.add(gate);
		scene.add(g);
		const path = new THREE.Mesh(new THREE.PlaneGeometry(30, 6), new THREE.MeshLambertMaterial({ color: 7829367 }));
		path.rotation.x = -Math.PI / 2;
		path.position.set(-65, .03, -65);
		path.rotation.z = Math.PI / 4;
		scene.add(path);
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
		makeCastle();
		makeRocketSite();
	}
	function generateWorld() {
		let p = 0;
		while (p < 60) {
			const a = Math.random() * Math.PI * 2;
			const r = 10 + Math.random() * 38;
			const x = Math.cos(a) * r, z = Math.sin(a) * r;
			if (Math.sqrt(x * x + z * z) > 48) continue;
			if (Math.abs(x - 52) < 3) continue;
			if (Math.abs(x) < 5 && z > 0) continue;
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
	//#region src/ui.ts
	function actionControlName$1() {
		return gameState.inputProfile === "touch" ? "TAP" : "SPACE";
	}
	function normalizeAngle(rad) {
		return Math.atan2(Math.sin(rad), Math.cos(rad));
	}
	function updateRocketNavDisplay() {
		const nav = document.getElementById("rocket-nav");
		const viewBtn = document.getElementById("touch-view-btn");
		const minimap = document.getElementById("minimap");
		if (!nav || !viewBtn || !minimap) return;
		if (!gameState.inRocket) {
			nav.style.display = "none";
			viewBtn.textContent = "VIEW";
			minimap.className = "";
			return;
		}
		const dx = gameState.rocketFlightDest.x - gameState.rocketFlightPos.x;
		const dz = gameState.rocketFlightDest.z - gameState.rocketFlightPos.z;
		const bearing = normalizeAngle(Math.atan2(-dx, -dz) - gameState.rocketFlightYaw);
		const turn = Math.abs(bearing) < .16 ? "ON TARGET" : bearing > 0 ? "TURN LEFT" : "TURN RIGHT";
		const pitch = gameState.rocketFlightPitch > .08 ? "CLIMB" : gameState.rocketFlightPitch < -.08 ? "DIVE" : "LEVEL";
		const dist = Math.round(Math.hypot(dx, dz));
		nav.style.display = gameState.rocketCockpitView ? "block" : "none";
		nav.innerHTML = `
    <div class="rocket-nav-row"><span>MODE</span><b>${gameState.rocketCockpitView ? "COCKPIT" : "CHASE"}</b></div>
    <div class="rocket-nav-row"><span>TARGET</span><b>${turn}</b></div>
    <div class="rocket-nav-row"><span>BEARING</span><b>${Math.round(bearing * 180 / Math.PI)}°</b></div>
    <div class="rocket-nav-row"><span>BEACON</span><b>${dist}m</b></div>
    <div class="rocket-nav-row"><span>SPEED</span><b>${Math.round(gameState.rocketFlightSpeed)}m/s</b></div>
    <div class="rocket-nav-row"><span>PITCH</span><b>${pitch}</b></div>
  `;
		viewBtn.textContent = gameState.rocketCockpitView ? "CHASE" : "COCKPIT";
		minimap.className = gameState.rocketCockpitView ? "cockpit-map" : "chase-map";
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
		updateRocketNavDisplay();
		document.getElementById("health-fill").style.width = Math.max(0, gameState.playerHP) + "%";
		document.getElementById("health-text").textContent = String(Math.ceil(Math.max(0, gameState.playerHP)));
		document.getElementById("deer-fill").style.width = (gameState.deerCaptured ? 100 : gameState.deerHP) + "%";
		document.getElementById("deer-text").textContent = gameState.deerCaptured ? "CAGED" : String(Math.ceil(gameState.deerHP));
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
				icon: "🪤",
				label: "Cage",
				show: gameState.hasCage
			},
			{
				icon: "🦌",
				label: "Caged Deer",
				show: gameState.deerCaptured
			},
			{
				icon: "📦",
				label: "Rocket Cargo",
				show: gameState.cageLoadedInRocket
			},
			{
				icon: "🚀",
				label: "Launch",
				show: gameState.rocketLaunched
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
			"obj4",
			"obj5"
		].forEach((id, i) => {
			const el = document.getElementById(id);
			if (i < gameState.stage) el.className = "done";
			else if (i === gameState.stage) el.className = "active";
			else el.className = "";
		});
	}
	function updateClock(renderer, scene, sun, ambient, moonLight) {
		if (gameState.inRocket) {
			document.getElementById("clock").textContent = "🚀 Transit";
			sun.intensity = .15;
			ambient.intensity = .25;
			moonLight.intensity = .6;
			return;
		}
		if (gameState.onPlanet) {
			document.getElementById("clock").textContent = "🪐 Exoplanet";
			sun.intensity = .85;
			ambient.intensity = .42;
			moonLight.intensity = 0;
			return;
		}
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
		if (gameState.inRocket || gameState.onPlanet) {
			ch.style.display = "none";
			return;
		}
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
		if (gameState.inRocket) {
			ctx.fillStyle = "#060a15";
			ctx.fillRect(0, 0, S, S);
			ctx.strokeStyle = gameState.rocketCockpitView ? "#5df1ff" : "#ffef9c";
			ctx.lineWidth = 4;
			ctx.strokeRect(2, 2, S - 4, S - 4);
			ctx.fillStyle = "#9dd5ff";
			for (let i = 0; i < 32; i++) {
				const x = i * 37 % S;
				const y = i * 59 % S;
				ctx.fillRect(x, y, 1.2, 1.2);
			}
			const dx = gameState.rocketFlightDest.x - gameState.rocketFlightPos.x;
			const dz = gameState.rocketFlightDest.z - gameState.rocketFlightPos.z;
			const fwdX = -Math.sin(gameState.rocketFlightYaw);
			const fwdZ = -Math.cos(gameState.rocketFlightYaw);
			const rightX = Math.cos(gameState.rocketFlightYaw);
			const rightZ = -Math.sin(gameState.rocketFlightYaw);
			const localX = dx * rightX + dz * rightZ;
			const localForward = dx * fwdX + dz * fwdZ;
			const navScale = .18;
			const unclampedTx = cx + localX * navScale;
			const unclampedTy = cy - localForward * navScale;
			const tx = Math.max(9, Math.min(S - 9, unclampedTx));
			const ty = Math.max(9, Math.min(S - 9, unclampedTy));
			ctx.fillStyle = "#4ac0ff";
			ctx.beginPath();
			ctx.arc(tx, ty, 8, 0, Math.PI * 2);
			ctx.fill();
			ctx.strokeStyle = "#eaffff";
			ctx.lineWidth = 1.5;
			ctx.stroke();
			ctx.fillStyle = "#ffef9c";
			ctx.beginPath();
			ctx.moveTo(cx, cy - 6);
			ctx.lineTo(cx - 4.5, cy + 5);
			ctx.lineTo(cx + 4.5, cy + 5);
			ctx.closePath();
			ctx.fill();
			ctx.strokeStyle = "rgba(120,220,255,0.7)";
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.moveTo(cx, cy);
			ctx.lineTo(tx, ty);
			ctx.stroke();
			ctx.strokeStyle = "#ffffff";
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(cx, cy - 7);
			ctx.lineTo(cx, 10);
			ctx.stroke();
			ctx.fillStyle = "#fff";
			ctx.font = "9px \"Courier New\", monospace";
			ctx.fillText(gameState.rocketCockpitView ? "COCKPIT" : "CHASE", 8, S - 8);
			ctx.fillText("TARGET", Math.max(2, tx - 14), Math.max(10, ty - 10));
			return;
		}
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
		showMessage(`🎉 <strong>VICTORY!</strong><br><br>You relocated the deer to another planet.<br>The forest is safe, and the deer lives.<br><br><em style="font-size:13px">Use Reset Game to play again</em>`);
	}
	function triggerDeath(by = "deer") {
		gameState.gameOver = true;
		const msgs = {
			deer: "🦌 The deer ate you.",
			alien: "👽 Abducted and probed.",
			zombie: "🧟 You became a zombie."
		};
		showMessage(`💀 <strong>YOU DIED</strong><br><br>${msgs[by] || msgs.deer}<br><br><em style="font-size:13px">Use Reset Game to try again</em>`);
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
	/** Updates the Web Audio listener to match the camera's position for spatial audio. */
	function updateAudioListener(x, y, z, forwardX, forwardY, forwardZ) {
		if (!audioCtx) return;
		const l = audioCtx.listener;
		if (l.positionX) {
			const now = audioCtx.currentTime;
			l.positionX.setTargetAtTime(x, now, .1);
			l.positionY.setTargetAtTime(y, now, .1);
			l.positionZ.setTargetAtTime(z, now, .1);
			l.forwardX.setTargetAtTime(forwardX, now, .1);
			l.forwardY.setTargetAtTime(forwardY, now, .1);
			l.forwardZ.setTargetAtTime(forwardZ, now, .1);
		} else {
			l.setPosition(x, y, z);
			l.setOrientation(forwardX, forwardY, forwardZ, 0, 1, 0);
		}
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
	function createPanner(pos) {
		if (!audioCtx || !pos) return sfxMasterGain;
		const panner = audioCtx.createPanner();
		panner.panningModel = "HRTF";
		panner.distanceModel = "exponential";
		panner.refDistance = 1;
		panner.maxDistance = 100;
		panner.rolloffFactor = 1.5;
		panner.positionX.value = pos.x;
		panner.positionY.value = pos.y;
		panner.positionZ.value = pos.z;
		panner.connect(sfxMasterGain);
		return panner;
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
	function playDeerYell(type, pos) {
		if (!audioCtx) return;
		const now = audioCtx.currentTime;
		const dest = createPanner(pos);
		if (type === "chase") {
			const osc = audioCtx.createOscillator(), osc2 = audioCtx.createOscillator();
			const filter = audioCtx.createBiquadFilter(), gain = audioCtx.createGain();
			osc.type = "sawtooth";
			osc.frequency.setValueAtTime(180 + Math.random() * 40, now);
			osc.frequency.exponentialRampToValueAtTime(70, now + .6);
			osc2.type = "square";
			osc2.frequency.setValueAtTime(60, now);
			osc2.frequency.linearRampToValueAtTime(40, now + .8);
			filter.type = "lowpass";
			filter.frequency.setValueAtTime(2e3, now);
			filter.frequency.exponentialRampToValueAtTime(300, now + .8);
			gain.gain.setValueAtTime(0, now);
			gain.gain.linearRampToValueAtTime(.6, now + .05);
			gain.gain.exponentialRampToValueAtTime(.001, now + .8);
			osc.connect(filter);
			osc2.connect(filter);
			filter.connect(gain);
			gain.connect(dest);
			osc.start(now);
			osc.stop(now + 1);
			osc2.start(now);
			osc2.stop(now + 1);
			setTimeout(() => {
				if (!audioCtx) return;
				const n2 = audioCtx.currentTime;
				const s = audioCtx.createOscillator(), g = audioCtx.createGain(), f = audioCtx.createBiquadFilter();
				s.type = "sawtooth";
				s.frequency.setValueAtTime(320 + Math.random() * 80, n2);
				s.frequency.exponentialRampToValueAtTime(120, n2 + .3);
				f.type = "lowpass";
				f.frequency.value = 600;
				g.gain.setValueAtTime(.4, n2);
				g.gain.exponentialRampToValueAtTime(.001, n2 + .4);
				s.connect(f);
				f.connect(g);
				g.connect(dest);
				s.start(n2);
				s.stop(n2 + .5);
			}, 400);
		} else {
			const osc = audioCtx.createOscillator(), mod = audioCtx.createOscillator(), modG = audioCtx.createGain();
			const rev2 = makeReverb(audioCtx, 3, 2.5);
			rev2.connect(dest);
			const gain = audioCtx.createGain();
			const baseFreq = 160 + Math.random() * 60;
			osc.type = "sine";
			osc.frequency.setValueAtTime(baseFreq, now);
			osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + .6);
			osc.frequency.exponentialRampToValueAtTime(baseFreq * .8, now + 1.8);
			mod.type = "sawtooth";
			mod.frequency.value = 45;
			modG.gain.value = baseFreq * .2;
			mod.connect(modG);
			modG.connect(osc.frequency);
			gain.gain.setValueAtTime(0, now);
			gain.gain.linearRampToValueAtTime(.3, now + .4);
			gain.gain.exponentialRampToValueAtTime(.001, now + 2);
			osc.connect(gain);
			gain.connect(rev2);
			osc.start(now);
			osc.stop(now + 2);
			mod.start(now);
			mod.stop(now + 2);
		}
	}
	function playDeerAttackRoar(pos) {
		if (!audioCtx) return;
		const now = audioCtx.currentTime;
		const dest = createPanner(pos);
		const bufLen = audioCtx.sampleRate * .8;
		const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2);
		const src = audioCtx.createBufferSource(), f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
		src.buffer = buf;
		f.type = "lowpass";
		f.frequency.setValueAtTime(800, now);
		f.frequency.exponentialRampToValueAtTime(150, now + .6);
		g.gain.setValueAtTime(1, now);
		g.gain.exponentialRampToValueAtTime(.001, now + .75);
		src.connect(f);
		f.connect(g);
		g.connect(dest);
		src.start(now);
		const sub = audioCtx.createOscillator(), subG = audioCtx.createGain();
		sub.type = "sawtooth";
		sub.frequency.setValueAtTime(120, now);
		sub.frequency.linearRampToValueAtTime(40, now + .5);
		subG.gain.setValueAtTime(.6, now);
		subG.gain.exponentialRampToValueAtTime(.001, now + .5);
		sub.connect(subG);
		subG.connect(dest);
		sub.start(now);
		sub.stop(now + .6);
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
		const dur = .5 + Math.random() * .2;
		const bufLen = audioCtx.sampleRate * dur;
		const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
		const d = buf.getChannelData(0);
		const baseFreq = 80 + Math.random() * 20;
		for (let i = 0; i < bufLen; i++) {
			const t = i / audioCtx.sampleRate;
			const env = Math.pow(Math.sin(Math.PI * i / bufLen), .3) * (1 - t / dur);
			const mod = 1 + .4 * Math.sin(2 * Math.PI * 30 * t);
			const noise = (Math.random() * 2 - 1) * .4;
			d[i] = (Math.sin(2 * Math.PI * baseFreq * t * (1 - t * .5)) + noise) * env * mod * .6;
		}
		const src = audioCtx.createBufferSource(), filt = audioCtx.createBiquadFilter(), gain = audioCtx.createGain();
		src.buffer = buf;
		filt.type = "lowpass";
		filt.frequency.value = 600;
		gain.gain.value = .8;
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
			[
				72,
				76,
				74
			],
			[
				74,
				72,
				67
			],
			[
				76,
				79,
				76
			],
			[
				67,
				72,
				74
			]
		];
		tunes[Math.floor(Math.random() * tunes.length)].forEach((mn, idx) => {
			const t = now + idx * .35;
			const dur = .3;
			const freq = note(mn);
			const osc = audioCtx.createOscillator(), vib = audioCtx.createOscillator(), vibG = audioCtx.createGain();
			const gain = audioCtx.createGain(), noise = audioCtx.createBufferSource();
			vib.frequency.value = 5 + Math.random() * 2;
			vibG.gain.value = freq * .015;
			vib.connect(vibG);
			vibG.connect(osc.frequency);
			osc.type = "sine";
			osc.frequency.value = freq;
			const nBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
			const nData = nBuf.getChannelData(0);
			for (let i = 0; i < nData.length; i++) nData[i] = (Math.random() * 2 - 1) * .02;
			noise.buffer = nBuf;
			gain.gain.setValueAtTime(0, t);
			gain.gain.linearRampToValueAtTime(.4, t + .05);
			gain.gain.exponentialRampToValueAtTime(.001, t + dur);
			osc.connect(gain);
			noise.connect(gain);
			gain.connect(sfxMasterGain);
			osc.start(t);
			osc.stop(t + dur);
			vib.start(t);
			vib.stop(t + dur);
			noise.start(t);
			noise.stop(t + dur);
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
	function playSfxChop(pos) {
		if (!audioCtx) return;
		const now = audioCtx.currentTime;
		const dest = createPanner(pos);
		const thud = audioCtx.createOscillator(), thudG = audioCtx.createGain();
		thud.type = "sine";
		thud.frequency.setValueAtTime(140, now);
		thud.frequency.exponentialRampToValueAtTime(40, now + .1);
		thudG.gain.setValueAtTime(.6, now);
		thudG.gain.exponentialRampToValueAtTime(.001, now + .15);
		thud.connect(thudG);
		thudG.connect(dest);
		thud.start(now);
		thud.stop(now + .2);
		const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * .15, audioCtx.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
		const src = audioCtx.createBufferSource(), filt = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
		src.buffer = buf;
		filt.type = "bandpass";
		filt.frequency.value = 1200;
		filt.Q.value = 1.2;
		g.gain.value = .5;
		src.connect(filt);
		filt.connect(g);
		g.connect(dest);
		src.start(now);
	}
	function playSfxSwing(pos) {
		if (!audioCtx) return;
		const now = audioCtx.currentTime;
		const dest = createPanner(pos);
		const bufLen = audioCtx.sampleRate * .25;
		const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
		const src = audioCtx.createBufferSource(), f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
		src.buffer = buf;
		f.type = "bandpass";
		f.frequency.setValueAtTime(400, now);
		f.frequency.exponentialRampToValueAtTime(1800, now + .08);
		f.frequency.exponentialRampToValueAtTime(600, now + .2);
		f.Q.value = 1.5;
		g.gain.setValueAtTime(0, now);
		g.gain.linearRampToValueAtTime(.4, now + .05);
		g.gain.exponentialRampToValueAtTime(.001, now + .25);
		src.connect(f);
		f.connect(g);
		g.connect(dest);
		src.start(now);
	}
	function playSfxCraft(pos) {
		if (!audioCtx) return;
		const now = audioCtx.currentTime;
		const dest = createPanner(pos);
		[
			0,
			.08,
			.16
		].forEach((delay, i) => {
			const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
			osc.type = "triangle";
			osc.frequency.value = note(72 + i * 5);
			g.gain.setValueAtTime(.2, now + delay);
			g.gain.exponentialRampToValueAtTime(.001, now + delay + .2);
			osc.connect(g);
			g.connect(dest);
			osc.start(now + delay);
			osc.stop(now + delay + .25);
		});
	}
	function sfxStep(pos, type = "grass") {
		if (!audioCtx) return;
		const now = audioCtx.currentTime;
		const dest = createPanner(pos);
		const bufLen = audioCtx.sampleRate * .08;
		const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
		const src = audioCtx.createBufferSource(), f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
		src.buffer = buf;
		f.type = "bandpass";
		f.frequency.value = type === "grass" ? 400 : 250;
		f.Q.value = 1;
		g.gain.value = .15;
		src.connect(f);
		f.connect(g);
		g.connect(dest);
		src.start(now);
	}
	function playSfxDeerStep(pos) {
		if (!audioCtx) return;
		const now = audioCtx.currentTime;
		const dest = createPanner(pos);
		const bufLen = audioCtx.sampleRate * .12;
		const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5);
		const src = audioCtx.createBufferSource(), f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
		src.buffer = buf;
		f.type = "lowpass";
		f.frequency.value = 200;
		g.gain.value = .25;
		src.connect(f);
		f.connect(g);
		g.connect(dest);
		src.start(now);
	}
	function sfxAlien(pos) {
		if (!audioCtx) return;
		const now = audioCtx.currentTime;
		const dest = createPanner(pos);
		const osc = audioCtx.createOscillator(), lfo = audioCtx.createOscillator(), lfoG = audioCtx.createGain();
		osc.type = "sine";
		osc.frequency.setValueAtTime(800, now);
		osc.frequency.exponentialRampToValueAtTime(1200, now + .3);
		lfo.type = "square";
		lfo.frequency.value = 25;
		lfoG.gain.value = 150;
		lfo.connect(lfoG);
		lfoG.connect(osc.frequency);
		const g = audioCtx.createGain();
		g.gain.setValueAtTime(.2, now);
		g.gain.exponentialRampToValueAtTime(.001, now + .35);
		osc.connect(g);
		g.connect(dest);
		osc.start(now);
		osc.stop(now + .4);
		lfo.start(now);
		lfo.stop(now + .4);
	}
	function sfxZombie(pos) {
		if (!audioCtx) return;
		const now = audioCtx.currentTime;
		const dest = createPanner(pos);
		const osc = audioCtx.createOscillator(), filt = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
		osc.type = "sawtooth";
		osc.frequency.setValueAtTime(70, now);
		osc.frequency.linearRampToValueAtTime(45, now + .6);
		filt.type = "lowpass";
		filt.frequency.value = 350;
		g.gain.setValueAtTime(.5, now);
		g.gain.exponentialRampToValueAtTime(.001, now + .7);
		osc.connect(filt);
		filt.connect(g);
		g.connect(dest);
		osc.start(now);
		osc.stop(now + .8);
	}
	function sfxSquash(pos) {
		if (!audioCtx) return;
		const now = audioCtx.currentTime;
		const dest = createPanner(pos);
		const bufLen = audioCtx.sampleRate * .15;
		const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, .5);
		const src = audioCtx.createBufferSource(), filt = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
		src.buffer = buf;
		filt.type = "lowpass";
		filt.frequency.value = 180;
		g.gain.value = 1.2;
		src.connect(filt);
		filt.connect(g);
		g.connect(dest);
		src.start(now);
	}
	function sfxChop(pos) {
		if (audioCtx) playSfxChop(pos);
	}
	function sfxSwing(pos) {
		if (audioCtx) playSfxSwing(pos);
	}
	function sfxCraft(pos) {
		if (audioCtx) playSfxCraft(pos);
	}
	function sfxDeerRoar(pos) {
		if (audioCtx) playDeerAttackRoar(pos);
	}
	function sfxDeerStep(pos) {
		if (audioCtx) playSfxDeerStep(pos);
	}
	function startDeerYells() {
		if (deerYellInterval) return;
		deerYellInterval = setInterval(() => {
			if (!gameState.gameOver && !gameState.gameWon && gameState.deerAlive && audioCtx) {
				const pos = {
					x: gameState.deerPos?.x || 0,
					y: 0,
					z: gameState.deerPos?.z || 0
				};
				if (gameState.deerState === "chase") playDeerYell("chase", pos);
				else if (Math.random() < .4) playDeerYell("wander", pos);
			}
		}, 4e3 + Math.random() * 5e3);
	}
	//#endregion
	//#region src/player.ts
	const playerGroup = new THREE.Group();
	scene.add(playerGroup);
	const player = {
		pos: new THREE.Vector3(52, 0, 0),
		facing: Math.PI,
		invincTimer: 0,
		stepTimer: 0
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
		if (gameState.gameOver || gameState.gameWon || gameState.inCar || gameState.inRocket) return;
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
		if (gameState.onPlanet ? dist2D(nx, nz, gameState.planetPos.x, gameState.planetPos.z) < 40 : dist2D(nx, nz, 0, 0) < 60) {
			if (!checkWorldCollision(nx, nz, .4)) {
				player.pos.x = nx;
				player.pos.z = nz;
			}
		}
		const moving = mx !== 0 || mz !== 0;
		playerGroup.position.y = moving ? Math.abs(Math.sin(Date.now() * .007)) * .08 : 0;
		playerGroup.position.x = player.pos.x;
		playerGroup.position.z = player.pos.z;
		playerGroup.rotation.y = player.facing + Math.PI;
		if (moving) {
			player.stepTimer -= dt;
			if (player.stepTimer <= 0) {
				sfxStep(player.pos, "grass");
				player.stepTimer = .35;
			}
		} else player.stepTimer = 0;
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
			const nx = carPos.x - Math.sin(gameState.carFacing) * speed * dt;
			const nz = carPos.z - Math.cos(gameState.carFacing) * speed * dt;
			const fwdX = -Math.sin(gameState.carFacing);
			const fwdZ = -Math.cos(gameState.carFacing);
			const frontX = nx + fwdX * 1.2, frontZ = nz + fwdZ * 1.2;
			const rearX = nx - fwdX * 1.2, rearZ = nz - fwdZ * 1.2;
			if (!checkWorldCollision(frontX, frontZ, .7) && !checkWorldCollision(rearX, rearZ, .7)) {
				carPos.x = nx;
				carPos.z = nz;
			}
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
		lastStepPhase: 0,
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
		gameState.deerPos.x = deer.pos.x;
		gameState.deerPos.z = deer.pos.z;
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
					sfxDeerRoar(deer.pos);
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
		if (Math.abs(mx) > .01 || Math.abs(mz) > .01) {
			const stepFreq = Math.PI;
			if (Math.floor(deer.legPhase / stepFreq) !== Math.floor(deer.lastStepPhase / stepFreq)) sfxDeerStep(deer.pos);
		}
		deer.lastStepPhase = deer.legPhase;
		deerGroup.position.set(deer.pos.x, Math.abs(Math.sin(deer.legPhase * .5)) * .05, deer.pos.z);
		deerGroup.rotation.y = deer.facing;
		deerGroup.rotation.z = Math.sin(deer.legPhase) * .15;
		deerGroup.children.forEach((c, i) => {
			if (i >= 12 && i <= 15) c.position.y = .3 + Math.sin(deer.legPhase + i * 1.5) * .08;
		});
	}
	//#endregion
	//#region src/cage.ts
	const CAGE_CAPTURE_R = 1.7;
	let trapGroup = null;
	let trapPos = null;
	let planetDropGroup = null;
	let planetDropPos = null;
	const carCargoGroup = new THREE.Group();
	carCargoGroup.visible = false;
	scene.add(carCargoGroup);
	function makeCageMesh(hasDeerInside) {
		const g = new THREE.Group();
		const barMat = new THREE.MeshStandardMaterial({
			color: 10134705,
			metalness: .7,
			roughness: .35
		});
		const baseMat = new THREE.MeshStandardMaterial({
			color: 4009246,
			metalness: .2,
			roughness: .8
		});
		const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, .12, 1.5), baseMat);
		base.position.y = .06;
		base.castShadow = true;
		g.add(base);
		const h = 1.3;
		for (const x of [
			-.65,
			-.32,
			0,
			.32,
			.65
		]) for (const z of [-.65, .65]) {
			const bar = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, h, 8), barMat);
			bar.position.set(x, h * .5 + .12, z);
			bar.castShadow = true;
			g.add(bar);
		}
		for (const z of [
			-.65,
			-.32,
			0,
			.32,
			.65
		]) for (const x of [-.65, .65]) {
			const bar = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, h, 8), barMat);
			bar.position.set(x, h * .5 + .12, z);
			bar.castShadow = true;
			g.add(bar);
		}
		const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, .08, 1.5), barMat);
		top.position.y = h + .16;
		top.castShadow = true;
		g.add(top);
		if (hasDeerInside) {
			const deerMass = new THREE.Mesh(new THREE.BoxGeometry(.8, .45, .42), new THREE.MeshStandardMaterial({
				color: 7356959,
				roughness: .9
			}));
			deerMass.position.set(0, .35, 0);
			deerMass.castShadow = true;
			g.add(deerMass);
		} else {
			const bait = new THREE.Mesh(new THREE.ConeGeometry(.18, .28, 8), new THREE.MeshStandardMaterial({
				color: 16763989,
				roughness: .65
			}));
			bait.position.set(0, .22, 0);
			bait.rotation.x = Math.PI;
			g.add(bait);
		}
		return g;
	}
	function rebuildTrapVisual(hasDeerInside) {
		if (!trapGroup) return;
		trapGroup.clear();
		const mesh = makeCageMesh(hasDeerInside);
		trapGroup.add(mesh);
	}
	function placeCageTrap(x, z) {
		if (!gameState.hasCage || gameState.cagePlaced || gameState.deerCaptured) return false;
		if (!trapGroup) {
			trapGroup = new THREE.Group();
			scene.add(trapGroup);
		}
		trapPos = new THREE.Vector3(x, 0, z);
		trapGroup.position.set(x, 0, z);
		rebuildTrapVisual(false);
		gameState.cagePlaced = true;
		return true;
	}
	function getCageWorldPos() {
		if (!trapPos || !gameState.deerCaptured || gameState.cageLoadedInCar) return null;
		return trapPos;
	}
	function getPlacedEmptyCagePos() {
		if (!trapPos || !gameState.cagePlaced || gameState.deerCaptured) return null;
		return trapPos;
	}
	function pickUpCage() {
		if (!gameState.cagePlaced || gameState.deerCaptured) return false;
		gameState.cagePlaced = false;
		if (trapGroup) trapGroup.visible = false;
		return true;
	}
	function loadCageIntoCar() {
		if (!gameState.deerCaptured || gameState.cageLoadedInCar) return false;
		gameState.cageLoadedInCar = true;
		gameState.cagePlaced = false;
		if (trapGroup) trapGroup.visible = false;
		carCargoGroup.clear();
		carCargoGroup.add(makeCageMesh(true));
		carCargoGroup.visible = true;
		return true;
	}
	function unloadCageOnPlanet(x, z) {
		if (planetDropGroup) scene.remove(planetDropGroup);
		planetDropGroup = makeCageMesh(true);
		planetDropGroup.position.set(x, 0, z);
		scene.add(planetDropGroup);
		planetDropPos = new THREE.Vector3(x, 0, z);
		gameState.cageLoadedInCar = false;
		gameState.cageLoadedInRocket = false;
		carCargoGroup.visible = false;
	}
	function getCageSaveState() {
		return {
			trapPos: trapPos ? {
				x: trapPos.x,
				z: trapPos.z
			} : null,
			planetDropPos: planetDropPos ? {
				x: planetDropPos.x,
				z: planetDropPos.z
			} : null
		};
	}
	function restoreCageVisuals(saved) {
		if (saved.trapPos) {
			if (!trapGroup) {
				trapGroup = new THREE.Group();
				scene.add(trapGroup);
			}
			trapPos = new THREE.Vector3(saved.trapPos.x, 0, saved.trapPos.z);
			trapGroup.position.set(trapPos.x, 0, trapPos.z);
			trapGroup.visible = gameState.cagePlaced && !gameState.cageLoadedInCar && !gameState.cageLoadedInRocket;
			rebuildTrapVisual(gameState.deerCaptured);
		} else if (trapGroup) {
			trapPos = null;
			trapGroup.visible = false;
		}
		carCargoGroup.clear();
		if (gameState.cageLoadedInCar) {
			carCargoGroup.add(makeCageMesh(true));
			carCargoGroup.visible = true;
			carCargoGroup.position.set(carPos.x, .45, carPos.z);
			carCargoGroup.rotation.y = gameState.carFacing;
		} else carCargoGroup.visible = false;
		if (planetDropGroup) scene.remove(planetDropGroup);
		planetDropGroup = null;
		planetDropPos = null;
		if (saved.planetDropPos) {
			planetDropPos = new THREE.Vector3(saved.planetDropPos.x, 0, saved.planetDropPos.z);
			planetDropGroup = makeCageMesh(true);
			planetDropGroup.position.set(planetDropPos.x, 0, planetDropPos.z);
			scene.add(planetDropGroup);
		}
	}
	function updateCage() {
		if (gameState.cageLoadedInCar) {
			carCargoGroup.position.set(carPos.x, .45, carPos.z);
			carCargoGroup.rotation.y = gameState.carFacing;
		}
		if (!gameState.cagePlaced || gameState.deerCaptured || !trapPos || !deer.alive) return;
		if (dist2D(deer.pos.x, deer.pos.z, trapPos.x, trapPos.z) > CAGE_CAPTURE_R) return;
		gameState.deerCaptured = true;
		gameState.cagePlaced = true;
		deer.alive = false;
		deerGroup.visible = false;
		gameState.deerAlive = false;
		gameState.stage = Math.max(gameState.stage, 5);
		rebuildTrapVisual(true);
		showMessage("🦌 <strong>DEER CAPTURED!</strong><br>The bait trap worked. Bring the car next to the cage and load it.", 4200);
	}
	//#endregion
	//#region src/rocket.ts
	const launchPadPos = new THREE.Vector3(0, 0, 80);
	const planetLandingPos = new THREE.Vector3(gameState.planetPos.x, 0, gameState.planetPos.z);
	const spaceFlightGroup = new THREE.Group();
	spaceFlightGroup.visible = false;
	scene.add(spaceFlightGroup);
	const spaceBackdrop = new THREE.Group();
	spaceBackdrop.visible = false;
	scene.add(spaceBackdrop);
	const planetWorldGroup = new THREE.Group();
	planetWorldGroup.visible = false;
	scene.add(planetWorldGroup);
	const landedRocketGroup = new THREE.Group();
	landedRocketGroup.visible = false;
	scene.add(landedRocketGroup);
	const cockpitFrameGroup = new THREE.Group();
	cockpitFrameGroup.visible = false;
	scene.add(cockpitFrameGroup);
	const LANDING_RADIUS = 36;
	const rocketPos = new THREE.Vector3(launchPadPos.x, 8, launchPadPos.z);
	const rocketVel = new THREE.Vector3();
	const destinationPos = new THREE.Vector3(0, 22, 560);
	let rocketYaw = Math.PI;
	let rocketPitch = 0;
	function syncRocketFlightState() {
		gameState.rocketFlightPos.x = rocketPos.x;
		gameState.rocketFlightPos.z = rocketPos.z;
		gameState.rocketFlightDest.x = destinationPos.x;
		gameState.rocketFlightDest.z = destinationPos.z;
		gameState.rocketFlightYaw = rocketYaw;
		gameState.rocketFlightPitch = rocketPitch;
		gameState.rocketFlightSpeed = rocketVel.length();
	}
	function getHorizontalDistanceToDestination() {
		return Math.hypot(destinationPos.x - rocketPos.x, destinationPos.z - rocketPos.z);
	}
	function buildSimpleRocket(scale = 1) {
		const g = new THREE.Group();
		const hull = new THREE.MeshStandardMaterial({
			color: 15659768,
			metalness: .25,
			roughness: .45
		});
		const trim = new THREE.MeshStandardMaterial({
			color: 2699843,
			metalness: .8,
			roughness: .28
		});
		const core = new THREE.Mesh(new THREE.CylinderGeometry(.9 * scale, .9 * scale, 6 * scale, 14), hull);
		core.position.y = 3 * scale;
		core.castShadow = true;
		g.add(core);
		const cone = new THREE.Mesh(new THREE.ConeGeometry(.9 * scale, 1.8 * scale, 14), hull);
		cone.position.y = 6.9 * scale;
		cone.castShadow = true;
		g.add(cone);
		for (const side of [-1, 1]) {
			const booster = new THREE.Mesh(new THREE.CylinderGeometry(.35 * scale, .35 * scale, 4 * scale, 12), hull);
			booster.position.set(side * 1.15 * scale, 2.1 * scale, 0);
			booster.castShadow = true;
			g.add(booster);
		}
		for (let i = 0; i < 4; i++) {
			const a = i / 4 * Math.PI * 2;
			const fin = new THREE.Mesh(new THREE.BoxGeometry(.08 * scale, 1.1 * scale, .7 * scale), trim);
			fin.position.set(Math.cos(a) * 1 * scale, .7 * scale, Math.sin(a) * 1 * scale);
			fin.rotation.y = -a;
			fin.castShadow = true;
			g.add(fin);
		}
		const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(.22 * scale, .32 * scale, .42 * scale, 12), trim);
		nozzle.position.y = -.12 * scale;
		g.add(nozzle);
		return g;
	}
	function buildCockpitFrame() {
		const glass = new THREE.MeshBasicMaterial({
			color: 1759487,
			transparent: true,
			opacity: .12,
			side: THREE.DoubleSide,
			depthWrite: false
		});
		const frame = new THREE.MeshBasicMaterial({
			color: 1054754,
			depthWrite: false
		});
		const glow = new THREE.MeshBasicMaterial({
			color: 6156799,
			depthWrite: false
		});
		const amber = new THREE.MeshBasicMaterial({
			color: 16757575,
			depthWrite: false
		});
		const canopy = new THREE.Mesh(new THREE.RingGeometry(.78, .86, 32), frame);
		canopy.position.set(0, 0, -1.35);
		cockpitFrameGroup.add(canopy);
		const pane = new THREE.Mesh(new THREE.CircleGeometry(.76, 32), glass);
		pane.position.set(0, 0, -1.36);
		cockpitFrameGroup.add(pane);
		for (const x of [-.62, .62]) {
			const strut = new THREE.Mesh(new THREE.BoxGeometry(.055, 1.45, .035), frame);
			strut.position.set(x, .02, -1.32);
			strut.rotation.z = -x * .28;
			cockpitFrameGroup.add(strut);
		}
		const dash = new THREE.Mesh(new THREE.BoxGeometry(1.8, .34, .12), frame);
		dash.position.set(0, -.72, -1.04);
		dash.rotation.x = -.18;
		cockpitFrameGroup.add(dash);
		const scope = new THREE.Mesh(new THREE.TorusGeometry(.12, .01, 8, 24), glow);
		scope.position.set(0, -.18, -1.18);
		cockpitFrameGroup.add(scope);
		for (let i = 0; i < 5; i++) {
			const light = new THREE.Mesh(new THREE.BoxGeometry(.12, .035, .012), i % 2 === 0 ? glow : amber);
			light.position.set(-.42 + i * .21, -.66, -.96);
			cockpitFrameGroup.add(light);
		}
		cockpitFrameGroup.renderOrder = 20;
		cockpitFrameGroup.traverse((obj) => {
			obj.renderOrder = 20;
		});
	}
	function buildSpaceBackdrop() {
		const stars = new THREE.Group();
		const starMat = new THREE.MeshBasicMaterial({ color: 15267583 });
		for (let i = 0; i < 220; i++) {
			const s = new THREE.Mesh(new THREE.SphereGeometry(.35 + Math.random() * .35, 6, 6), starMat);
			s.position.set((Math.random() - .5) * 640, 30 + Math.random() * 180, Math.random() * 700);
			stars.add(s);
		}
		spaceBackdrop.add(stars);
		const beaconMat = new THREE.MeshBasicMaterial({
			color: 8254719,
			transparent: true,
			opacity: .78,
			side: THREE.DoubleSide
		});
		const haloMat = new THREE.MeshBasicMaterial({
			color: 4899071,
			transparent: true,
			opacity: .25,
			side: THREE.DoubleSide
		});
		const targetPlanet = new THREE.Mesh(new THREE.SphereGeometry(26, 32, 32), new THREE.MeshStandardMaterial({
			color: 6997247,
			emissive: 2383770,
			emissiveIntensity: .85,
			roughness: .86
		}));
		targetPlanet.position.copy(destinationPos);
		spaceBackdrop.add(targetPlanet);
		const ring = new THREE.Mesh(new THREE.TorusGeometry(38, 1.7, 12, 80), new THREE.MeshBasicMaterial({ color: 11132669 }));
		ring.rotation.x = 1.05;
		ring.position.copy(destinationPos);
		spaceBackdrop.add(ring);
		const landingHalo = new THREE.Mesh(new THREE.RingGeometry(LANDING_RADIUS - 5, LANDING_RADIUS + 5, 72), haloMat);
		landingHalo.rotation.x = -Math.PI / 2;
		landingHalo.position.set(destinationPos.x, 8.2, destinationPos.z);
		spaceBackdrop.add(landingHalo);
		for (let i = 0; i < 5; i++) {
			const guideRing = new THREE.Mesh(new THREE.TorusGeometry(11 + i * 5.5, .35, 8, 56), beaconMat);
			guideRing.rotation.x = Math.PI / 2;
			guideRing.position.set(destinationPos.x, 10 + i * 8, destinationPos.z);
			spaceBackdrop.add(guideRing);
		}
		const beaconCore = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, 62, 12, 1, true), new THREE.MeshBasicMaterial({
			color: 9436415,
			transparent: true,
			opacity: .28,
			side: THREE.DoubleSide
		}));
		beaconCore.position.set(destinationPos.x, 30, destinationPos.z);
		spaceBackdrop.add(beaconCore);
		const beaconLight = new THREE.PointLight(8254719, 1.2, 180);
		beaconLight.position.copy(destinationPos);
		spaceBackdrop.add(beaconLight);
	}
	function buildPlanetWorld() {
		const terrain = new THREE.Mesh(new THREE.CircleGeometry(36, 40), new THREE.MeshStandardMaterial({
			color: 10387269,
			roughness: .95,
			metalness: .03
		}));
		terrain.rotation.x = -Math.PI / 2;
		terrain.position.copy(planetLandingPos);
		terrain.position.y = .05;
		terrain.receiveShadow = true;
		planetWorldGroup.add(terrain);
		const craterRing = new THREE.Mesh(new THREE.RingGeometry(10, 16, 48), new THREE.MeshBasicMaterial({
			color: 6967085,
			side: THREE.DoubleSide
		}));
		craterRing.rotation.x = -Math.PI / 2;
		craterRing.position.set(planetLandingPos.x + 12, .08, planetLandingPos.z + 8);
		planetWorldGroup.add(craterRing);
		for (let i = 0; i < 12; i++) {
			const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4 + Math.random() * 1.2, 0), new THREE.MeshStandardMaterial({
				color: 6178866,
				roughness: .9,
				metalness: .06
			}));
			const a = Math.random() * Math.PI * 2;
			const r = 7 + Math.random() * 24;
			rock.position.set(planetLandingPos.x + Math.cos(a) * r, .8 + Math.random() * .9, planetLandingPos.z + Math.sin(a) * r);
			rock.castShadow = true;
			planetWorldGroup.add(rock);
		}
	}
	function initRocketWorlds() {
		spaceFlightGroup.add(buildSimpleRocket(1.2));
		buildCockpitFrame();
		buildSpaceBackdrop();
		buildPlanetWorld();
		landedRocketGroup.add(buildSimpleRocket(.9));
		landedRocketGroup.position.set(planetLandingPos.x, 0, planetLandingPos.z);
		landedRocketGroup.rotation.y = Math.PI;
	}
	function getRocketGroundPos() {
		return gameState.onPlanet ? planetLandingPos : launchPadPos;
	}
	function getRocketFlightPose() {
		return {
			pos: rocketPos,
			yaw: rocketYaw,
			pitch: rocketPitch
		};
	}
	function restoreRocketFlightPose(saved) {
		rocketPos.set(saved.pos?.x ?? launchPadPos.x, saved.pos?.y ?? 10, saved.pos?.z ?? launchPadPos.z);
		rocketVel.set(0, 0, 0);
		rocketYaw = saved.yaw ?? Math.PI;
		rocketPitch = saved.pitch ?? .1;
		syncRocketFlightState();
		spaceFlightGroup.position.copy(rocketPos);
		spaceFlightGroup.rotation.set(-rocketPitch, rocketYaw + Math.PI, 0);
	}
	function syncRocketVisualsToState() {
		if (gameState.inRocket) {
			hideGroundRocket();
			spaceFlightGroup.visible = true;
			spaceBackdrop.visible = true;
			cockpitFrameGroup.visible = gameState.rocketCockpitView;
			planetWorldGroup.visible = false;
			landedRocketGroup.visible = false;
			playerGroup.visible = false;
			return;
		}
		spaceFlightGroup.visible = false;
		spaceBackdrop.visible = false;
		cockpitFrameGroup.visible = false;
		if (gameState.onPlanet) {
			hideGroundRocket();
			planetWorldGroup.visible = true;
			landedRocketGroup.visible = true;
			playerGroup.visible = true;
			return;
		}
		planetWorldGroup.visible = false;
		landedRocketGroup.visible = false;
		playerGroup.visible = true;
	}
	function loadCageIntoRocket() {
		if (!gameState.cageLoadedInCar || gameState.cageLoadedInRocket) return false;
		gameState.cageLoadedInCar = false;
		gameState.cageLoadedInRocket = true;
		gameState.stage = Math.max(gameState.stage, 5);
		showMessage("🚀 <strong>CAGE LOADED INTO ROCKET</strong><br>Board the rocket and fly it to another planet.", 4200);
		return true;
	}
	function beginRocketFlight() {
		if (!gameState.cageLoadedInRocket || gameState.rocketLaunched || gameState.onPlanet) return false;
		gameState.inCar = false;
		gameState.driverView = false;
		gameState.inRocket = true;
		gameState.rocketCockpitView = true;
		gameState.rocketLaunched = true;
		gameState.onPlanet = false;
		playerGroup.visible = false;
		rocketPos.set(launchPadPos.x, 10, launchPadPos.z);
		rocketVel.set(0, 0, 0);
		rocketYaw = Math.PI;
		rocketPitch = .1;
		syncRocketFlightState();
		hideGroundRocket();
		spaceFlightGroup.visible = true;
		spaceBackdrop.visible = true;
		landedRocketGroup.visible = false;
		planetWorldGroup.visible = false;
		showMessage("🚀 <strong>ROCKET FLIGHT ACTIVE</strong><br>Cockpit view engaged. Use ← → to steer, ↑ to thrust, ↓ to pitch down.<br>Press V/VIEW to switch views. Enter the blue landing beacon to land.", 6500);
		return true;
	}
	function arriveAtPlanet() {
		gameState.inRocket = false;
		gameState.rocketCockpitView = false;
		gameState.onPlanet = true;
		spaceFlightGroup.visible = false;
		spaceBackdrop.visible = false;
		cockpitFrameGroup.visible = false;
		planetWorldGroup.visible = true;
		landedRocketGroup.visible = true;
		player.pos.set(planetLandingPos.x + 4.6, 0, planetLandingPos.z + 1.2);
		player.facing = Math.PI;
		playerGroup.visible = true;
		showMessage("🪐 <strong>PLANETFALL COMPLETE</strong><br>You reached a different world.<br>Go to the landed rocket and unload the deer cage.", 5500);
	}
	function unloadCageFromRocket() {
		if (!gameState.onPlanet || !gameState.cageLoadedInRocket) return false;
		gameState.cageLoadedInRocket = false;
		return true;
	}
	function updateRocketFlight(dt) {
		if (!gameState.inRocket) return;
		if (keys["ArrowLeft"]) rocketYaw += 2 * dt;
		if (keys["ArrowRight"]) rocketYaw -= 2 * dt;
		if (keys["ArrowUp"]) rocketPitch = Math.min(.55, rocketPitch + ROCKET_PITCH * dt * .4);
		if (keys["ArrowDown"]) rocketPitch = Math.max(-.35, rocketPitch - ROCKET_PITCH * dt * .4);
		const thrust = keys["ArrowUp"] ? 70 : 0;
		const drag = Math.exp(-dt * 1.8);
		rocketVel.multiplyScalar(drag);
		const cosP = Math.cos(rocketPitch);
		const fwd = new THREE.Vector3(-Math.sin(rocketYaw) * cosP, Math.sin(rocketPitch), -Math.cos(rocketYaw) * cosP);
		rocketVel.addScaledVector(fwd, thrust * dt);
		rocketPos.addScaledVector(rocketVel, dt);
		if (rocketPos.y < 8) {
			rocketPos.y = 8;
			if (rocketVel.y < 0) rocketVel.y *= -.2;
		}
		syncRocketFlightState();
		spaceFlightGroup.position.copy(rocketPos);
		spaceFlightGroup.rotation.set(-rocketPitch, rocketYaw + Math.PI, 0);
		if (getHorizontalDistanceToDestination() < LANDING_RADIUS) arriveAtPlanet();
	}
	function syncRocketCockpitFrame(cameraRef, visible) {
		cockpitFrameGroup.visible = visible && gameState.inRocket;
		if (!cockpitFrameGroup.visible) return;
		cockpitFrameGroup.position.copy(cameraRef.position);
		cockpitFrameGroup.quaternion.copy(cameraRef.quaternion);
	}
	function updateRocketWorldAtmosphere() {
		if (gameState.inRocket) {
			renderer.setClearColor(132108);
			scene.fog.color.setHex(132108);
			scene.fog.near = 260;
			scene.fog.far = 920;
			return;
		}
		if (gameState.onPlanet) {
			renderer.setClearColor(10513466);
			scene.fog.color.setHex(10513466);
			scene.fog.near = 25;
			scene.fog.far = 145;
			return;
		}
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
					if (isAlien) sfxAlien(e.pos);
					else sfxZombie(e.pos);
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
				sfxSquash(e.pos);
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
		if (gameState.inRocket) {
			const pose = getRocketFlightPose();
			const cosP = Math.cos(pose.pitch);
			const fwdX = -Math.sin(pose.yaw) * cosP;
			const fwdY = Math.sin(pose.pitch);
			const fwdZ = -Math.cos(pose.yaw) * cosP;
			if (gameState.rocketCockpitView) camera.position.set(pose.pos.x + fwdX * 2.1, pose.pos.y + 2.15 + fwdY * 1.2, pose.pos.z + fwdZ * 2.1);
			else camera.position.set(pose.pos.x + Math.sin(pose.yaw) * 9, pose.pos.y + 4.5, pose.pos.z + Math.cos(pose.yaw) * 9);
			camera.lookAt(pose.pos.x + fwdX * 26, pose.pos.y + fwdY * 26, pose.pos.z + fwdZ * 26);
			syncRocketCockpitFrame(camera, gameState.rocketCockpitView);
			updateAudioListener(camera.position.x, camera.position.y, camera.position.z, fwdX, fwdY, fwdZ);
			return;
		}
		syncRocketCockpitFrame(camera, false);
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
		const fw = {
			x: 0,
			y: 0,
			z: -1
		};
		fw.x = -Math.sin(facing);
		fw.z = -Math.cos(facing);
		updateAudioListener(camera.position.x, camera.position.y, camera.position.z, fw.x, 0, fw.z);
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
	let touchControlsEnabled = false;
	let controlsEl = null;
	let zonesEl = null;
	let viewBtn = null;
	function readDetectionInfo() {
		const maxTouchPoints = navigator.maxTouchPoints || 0;
		const hasTouchCapability = maxTouchPoints > 0 || "ontouchstart" in window;
		const coarsePointer = window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(any-pointer: coarse)").matches;
		const mobileUA = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent);
		const ipadDesktopUA = navigator.platform === "MacIntel" && maxTouchPoints > 1;
		return {
			hasTouchCapability,
			likelyTouchFirstDevice: hasTouchCapability && (coarsePointer || mobileUA || ipadDesktopUA),
			maxTouchPoints
		};
	}
	function getTouchDetectionInfo() {
		return readDetectionInfo();
	}
	function isTouchControlsEnabled() {
		return touchControlsEnabled;
	}
	function forceEnableTouchControls() {
		if (!controlsEl) return false;
		if (!touchControlsEnabled) {
			touchControlsEnabled = true;
			gameState.inputProfile = "touch";
			controlsEl.style.display = "block";
		}
		return true;
	}
	function initTouchControls(hooks) {
		controlsEl = document.getElementById("touch-controls");
		zonesEl = document.getElementById("touch-zones");
		viewBtn = document.getElementById("touch-view-btn");
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
		let movementPointerId = null;
		let movementTouchId = null;
		let activeInputMode = null;
		let downX = 0;
		let downY = 0;
		let downTs = 0;
		const beginMovement = (x, y) => {
			hooks.onStart();
			downX = x;
			downY = y;
			downTs = performance.now();
			setDirectionFromPoint(x, y);
		};
		const endMovement = (x, y) => {
			const elapsed = performance.now() - downTs;
			const moved = Math.hypot(x - downX, y - downY);
			clearDirectionalKeys();
			activeInputMode = null;
			if (elapsed <= TAP_MS && moved <= TAP_MOVE_PX) hooks.onAction();
		};
		let lastViewTapAt = 0;
		const onViewTap = (ev) => {
			ev.preventDefault();
			const now = performance.now();
			if (now - lastViewTapAt < 220) return;
			lastViewTapAt = now;
			hooks.onStart();
			hooks.onToggleCamera();
		};
		viewBtn.addEventListener("pointerdown", onViewTap);
		viewBtn.addEventListener("touchstart", onViewTap, { passive: false });
		viewBtn.addEventListener("click", onViewTap);
		zonesEl.addEventListener("pointerdown", (ev) => {
			if (activeInputMode && activeInputMode !== "pointer") return;
			ev.preventDefault();
			forceEnableTouchControls();
			activeInputMode = "pointer";
			movementPointerId = ev.pointerId;
			zonesEl.setPointerCapture(ev.pointerId);
			beginMovement(ev.clientX, ev.clientY);
		});
		zonesEl.addEventListener("pointermove", (ev) => {
			if (activeInputMode !== "pointer" || movementPointerId !== ev.pointerId) return;
			ev.preventDefault();
			setDirectionFromPoint(ev.clientX, ev.clientY);
		});
		const finishPointerMovement = (ev) => {
			if (activeInputMode !== "pointer" || movementPointerId !== ev.pointerId) return;
			movementPointerId = null;
			if (zonesEl.hasPointerCapture(ev.pointerId)) zonesEl.releasePointerCapture(ev.pointerId);
			endMovement(ev.clientX, ev.clientY);
		};
		zonesEl.addEventListener("pointerup", finishPointerMovement);
		zonesEl.addEventListener("pointercancel", finishPointerMovement);
		zonesEl.addEventListener("touchstart", (ev) => {
			if (activeInputMode && activeInputMode !== "touch") return;
			if (ev.touches.length === 0) return;
			ev.preventDefault();
			forceEnableTouchControls();
			const touch = ev.changedTouches[0];
			activeInputMode = "touch";
			movementTouchId = touch.identifier;
			beginMovement(touch.clientX, touch.clientY);
		}, { passive: false });
		zonesEl.addEventListener("touchmove", (ev) => {
			if (activeInputMode !== "touch" || movementTouchId === null) return;
			const touch = Array.from(ev.changedTouches).find((t) => t.identifier === movementTouchId);
			if (!touch) return;
			ev.preventDefault();
			setDirectionFromPoint(touch.clientX, touch.clientY);
		}, { passive: false });
		const finishTouchMovement = (ev) => {
			if (activeInputMode !== "touch" || movementTouchId === null) return;
			const touch = Array.from(ev.changedTouches).find((t) => t.identifier === movementTouchId);
			if (!touch) return;
			movementTouchId = null;
			endMovement(touch.clientX, touch.clientY);
		};
		zonesEl.addEventListener("touchend", finishTouchMovement, { passive: false });
		zonesEl.addEventListener("touchcancel", finishTouchMovement, { passive: false });
		if (readDetectionInfo().likelyTouchFirstDevice) forceEnableTouchControls();
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
	function toggleVehicleCameraView() {
		if (!gameState.inCar && !gameState.inRocket) return;
		if (gameState.inRocket) {
			gameState.rocketCockpitView = !gameState.rocketCockpitView;
			if (gameState.inputProfile === "touch") {
				setActionHint(gameState.rocketCockpitView ? "🚀 Cockpit view active — tap VIEW for chase view" : "🚀 Chase view active — tap VIEW for cockpit view");
				return;
			}
			setActionHint(gameState.rocketCockpitView ? "🚀 Cockpit view — press V for chase view" : "🚀 Chase view — press V for cockpit view");
			return;
		}
		gameState.driverView = !gameState.driverView;
		if (gameState.inputProfile === "touch") {
			setActionHint(gameState.driverView ? "🚗 Driver view active — tap VIEW to switch back" : "🚗 Third-person view active — tap VIEW for driver view");
			return;
		}
		setActionHint(gameState.driverView ? "🚗 Driver view — press V to switch back" : "🚗 Third-person view — press V for driver view");
	}
	function handleAction() {
		if (gameState.gameOver || gameState.gameWon) return;
		const px = player.pos.x, pz = player.pos.z;
		const fwdX = -Math.sin(player.facing), fwdZ = -Math.cos(player.facing);
		const nearCar = dist2D(px, pz, carPos.x, carPos.z) < 3;
		const rocketGroundPos = getRocketGroundPos();
		const nearRocket = dist2D(px, pz, rocketGroundPos.x, rocketGroundPos.z) < gameState.rocketRadius + 3;
		if (gameState.inRocket) {
			setActionHint("🚀 Flight active — steer with arrows and reach the target planet.");
			return;
		}
		if (gameState.onPlanet && gameState.rocketLaunched && gameState.cageLoadedInRocket && nearRocket) {
			unloadCageFromRocket();
			unloadCageOnPlanet(rocketGroundPos.x + 2.2, rocketGroundPos.z + 1.2);
			gameState.stage = Math.max(gameState.stage, 6);
			gameState.onWin?.();
			return;
		}
		if (!gameState.rocketLaunched && gameState.cageLoadedInRocket && nearRocket) {
			beginRocketFlight();
			gameState.stage = Math.max(gameState.stage, 5);
			return;
		}
		if (!gameState.rocketLaunched && gameState.cageLoadedInCar && nearRocket) {
			if (loadCageIntoRocket()) setActionHint("🚀 Cage loaded. Board the rocket and fly to another planet.");
			return;
		}
		const cagePos = getCageWorldPos();
		if (cagePos && !gameState.cageLoadedInCar && dist2D(px, pz, cagePos.x, cagePos.z) < 2.8) {
			if (dist2D(carPos.x, carPos.z, cagePos.x, cagePos.z) < 4.3) {
				if (loadCageIntoCar()) {
					setActionHint("📦 Caged deer loaded into car! Drive it to the rocket.");
					showMessage("📦 <strong>CAGED DEER LOADED</strong><br>Drive to the rocket site, load the cage into the rocket, then fly.", 4200);
					gameState.stage = Math.max(gameState.stage, 5);
				}
			} else setActionHint("🚗 Bring the car closer to load the caged deer.");
			return;
		}
		const emptyCagePos = getPlacedEmptyCagePos();
		if (emptyCagePos && dist2D(px, pz, emptyCagePos.x, emptyCagePos.z) < 2.8) {
			if (pickUpCage()) {
				setActionHint("🪤 Cage picked up. Place it somewhere else.");
				showMessage("🪤 <strong>CAGE PICKED UP</strong><br>Press " + actionControlName() + " on open ground to place it again.", 3e3);
			}
			return;
		}
		if (gameState.hasCage && !gameState.cagePlaced && !gameState.deerCaptured) {
			if (placeCageTrap(px + fwdX * 2, pz + fwdZ * 2)) {
				setActionHint("🪤 Bait cage placed. Lure the deer inside.");
				showMessage("🪤 <strong>BAIT CAGE PLACED</strong><br>Stay nearby and bait the deer into the trap.", 3500);
				gameState.stage = Math.max(gameState.stage, 4);
			}
			return;
		}
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
		if (gameState.hasSword && gameState.playerAttackTimer <= 0 && dist2D(px, pz, deer.pos.x, deer.pos.z) < 2.5) {
			gameState.playerAttackTimer = .6;
			sfxSwing(player.pos);
			gameState.deerHP = Math.max(1, gameState.deerHP - 25);
			setActionHint(gameState.deerHP <= 1 ? "🪤 The deer must be relocated alive. Build and use a cage trap." : "⚔️ Hit! Deer HP: " + Math.ceil(gameState.deerHP));
			return;
		}
		for (const t of trees) {
			if (!t.alive) continue;
			if (dist2D(px, pz, t.x, t.z) < 2.8) {
				t.hp--;
				sfxChop({
					x: t.x,
					y: 0,
					z: t.z
				});
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
				sfxChop({
					x: m.x,
					y: 0,
					z: m.z
				});
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
					sfxCraft(wb);
					setActionHint("⛏️ Pickaxe crafted!");
					showMessage(`⛏️ <strong>Pickaxe crafted!</strong><br>Find grey rock formations (mines) deep in the forest.<br>Walk up close and press ${actionControlName()} to mine ore!`, 5e3);
					updateHUD(deer, player);
				} else setActionHint(`Need 3 wood for pickaxe — have ${gameState.resources.wood}`);
				return;
			}
			if (!gameState.hasCage) {
				if (gameState.resources.ore >= 3 && gameState.resources.wood >= 6) {
					gameState.resources.ore -= 3;
					gameState.resources.wood -= 6;
					gameState.hasCage = true;
					gameState.stage = Math.max(gameState.stage, 4);
					sfxCraft(wb);
					setActionHint("🪤 Cage crafted! Place bait trap for the deer.");
					showMessage(`🪤 <strong>CAGE CRAFTED!</strong><br>Press ${actionControlName()} on open ground to place a bait trap.<br>Capture the deer alive and relocate it.`, 5e3);
					updateHUD(deer, player);
				} else setActionHint(`Cage needs 3 ore + 6 wood — have ore:${gameState.resources.ore} wood:${gameState.resources.wood}`);
				return;
			}
			setActionHint("Nothing left to craft.");
			return;
		}
		if (!gameState.built.workbench && isInSafeZone(px, pz)) {
			if (gameState.resources.wood >= 5) {
				gameState.resources.wood -= 5;
				const wbX = px + fwdX * 1.5, wbZ = pz + fwdZ * 1.5;
				placeWorkbench(wbX, wbZ);
				gameState.stage = Math.max(gameState.stage, 2);
				sfxCraft({
					x: wbX,
					y: 0,
					z: wbZ
				});
				setActionHint(`🔨 Workbench placed! Walk up and press ${actionControlName()}.`);
				showMessage(`🔨 <strong>Workbench built!</strong><br>Walk up and press ${actionControlName()}.<br>Craft Pickaxe (3 wood), mine ore, then craft Cage (6 wood + 3 ore).`, 5500);
				updateHUD(deer, player);
			} else setActionHint(`Need 5 wood — have ${gameState.resources.wood}`);
			return;
		}
		setActionHint("Nothing to do here.");
	}
	function checkProgress() {
		if (gameState.resources.wood >= 5 && gameState.stage === 0 && !gameState.built.workbench) {
			gameState.stage = 1;
			showMessage(`🪵 <strong>Enough wood!</strong><br>Go to the safe zone (green circle in center).<br>Press ${actionControlName()} to build a Workbench!`, 5e3);
		}
		if (gameState.hasPickaxe && !gameState.hasCage && gameState.resources.ore >= 3 && gameState.resources.wood >= 6 && gameState.stage < 3) {
			gameState.stage = 3;
			showMessage(`⛰️ <strong>Cage materials ready!</strong><br>Return to the Workbench and press ${actionControlName()} to craft the cage.`, 5e3);
		}
		updateHUD(deer, player);
	}
	let introShown = true;
	function initInput(onFirstKey) {
		let started = false;
		const touchInfoEl = () => document.getElementById("touch-detect-line");
		const setTouchInfo = (txt) => {
			const el = touchInfoEl();
			if (el) el.textContent = txt;
		};
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
			if (e.key === "v" || e.key === "V") toggleVehicleCameraView();
			if (e.key === "Escape") hideMessage();
		});
		window.addEventListener("keyup", (e) => {
			keys[e.key] = false;
		});
		initTouchControls({
			onStart: startGameFromInput,
			onAction: handleAction,
			onToggleCamera: toggleVehicleCameraView
		});
		const detection = getTouchDetectionInfo();
		if (isTouchControlsEnabled()) setTouchInfo(`Touch detected (${detection.maxTouchPoints} points): controls enabled.`);
		else if (detection.hasTouchCapability) setTouchInfo(`Touch detected (${detection.maxTouchPoints} points): tap "Enable Touch Controls" if controls are not active.`);
		else setTouchInfo("Touch not detected automatically. If you are on a phone/tablet, tap \"Enable Touch Controls\".");
		const manualTouchBtn = document.getElementById("touch-manual-enable");
		if (manualTouchBtn) manualTouchBtn.addEventListener("click", (e) => {
			e.preventDefault();
			if (forceEnableTouchControls()) {
				setTouchInfo("Touch controls enabled manually.");
				setActionHint("Touch controls active: use screen zones to move, TAP for action, VIEW for camera.");
				startGameFromInput();
			} else setTouchInfo("Could not enable touch controls in this build.");
		});
		window.addEventListener("pointerdown", (e) => {
			if (e.pointerType === "touch") {
				forceEnableTouchControls();
				startGameFromInput();
			}
		});
		window.addEventListener("touchstart", () => {
			forceEnableTouchControls();
			startGameFromInput();
		}, { passive: true });
		document.addEventListener("gesturestart", (e) => e.preventDefault());
		document.addEventListener("gesturechange", (e) => e.preventDefault());
	}
	//#endregion
	//#region src/persistence.ts
	const SAVE_KEY = "forest-survival-save-v2";
	const SAVE_VERSION = 2;
	const STATE_KEYS = [
		"playerHP",
		"deerHP",
		"playerAttackTimer",
		"gameOver",
		"gameWon",
		"resources",
		"built",
		"hasCage",
		"cagePlaced",
		"deerCaptured",
		"cageLoadedInCar",
		"cageLoadedInRocket",
		"rocketLaunched",
		"inRocket",
		"rocketCockpitView",
		"onPlanet",
		"hasSword",
		"hasPickaxe",
		"stage",
		"dayTime",
		"wasDawn",
		"alienTimer",
		"inCar",
		"carFacing",
		"driverView",
		"inputProfile",
		"deerState",
		"deerAlive",
		"deerPos"
	];
	function cloneStateForSave() {
		const state = {};
		for (const key of STATE_KEYS) state[key] = structuredClone(gameState[key]);
		return state;
	}
	function vec3(v) {
		return {
			x: v.x,
			y: v.y ?? 0,
			z: v.z
		};
	}
	function saveGame(gameStarted) {
		if (!gameStarted) return;
		try {
			const rocketPose = getRocketFlightPose();
			const data = {
				version: SAVE_VERSION,
				savedAt: Date.now(),
				gameStarted,
				state: cloneStateForSave(),
				player: {
					pos: vec3(player.pos),
					facing: player.facing,
					invincTimer: player.invincTimer
				},
				deer: {
					pos: vec3(deer.pos),
					facing: deer.facing,
					hp: deer.hp,
					state: deer.state,
					wanderTarget: vec3(deer.wanderTarget),
					wanderTimer: deer.wanderTimer,
					attackTimer: deer.attackTimer,
					alive: deer.alive
				},
				car: { pos: vec3(carPos) },
				world: {
					trees: trees.map((t) => ({
						x: t.x,
						z: t.z,
						hp: t.hp,
						alive: t.alive
					})),
					mines: mines.map((m) => ({
						x: m.x,
						z: m.z,
						hp: m.hp,
						alive: m.alive
					})),
					deforestedCells: [...deforestedCells],
					workbenchPos: gameState.workbenchPos ? {
						x: gameState.workbenchPos.x,
						z: gameState.workbenchPos.z
					} : null
				},
				cage: getCageSaveState(),
				rocket: {
					pos: vec3(rocketPose.pos),
					yaw: rocketPose.yaw,
					pitch: rocketPose.pitch
				}
			};
			localStorage.setItem(SAVE_KEY, JSON.stringify(data));
		} catch (err) {
			console.warn("[save] Unable to write game save", err);
		}
	}
	function clearSavedGame() {
		try {
			localStorage.removeItem(SAVE_KEY);
		} catch (err) {
			console.warn("[save] Unable to clear game save", err);
		}
	}
	function applyWorldSave(saved) {
		if (saved.world.trees.length === trees.length) for (let i = 0; i < trees.length; i++) {
			const src = saved.world.trees[i];
			const tree = trees[i];
			tree.x = src.x;
			tree.z = src.z;
			tree.hp = src.hp;
			tree.alive = src.alive;
			tree.mesh.position.set(src.x, 0, src.z);
			tree.mesh.visible = src.alive;
			if (!src.alive) addStump(src.x, src.z);
		}
		if (saved.world.mines.length === mines.length) for (let i = 0; i < mines.length; i++) {
			const src = saved.world.mines[i];
			const mine = mines[i];
			mine.x = src.x;
			mine.z = src.z;
			mine.hp = src.hp;
			mine.alive = src.alive;
			mine.mesh.position.set(src.x, 0, src.z);
			mine.mesh.visible = src.alive;
		}
		deforestedCells.clear();
		for (const cell of saved.world.deforestedCells) deforestedCells.add(cell);
		if (saved.world.workbenchPos && saved.state.built?.workbench) placeWorkbench(saved.world.workbenchPos.x, saved.world.workbenchPos.z);
		else {
			gameState.built.workbench = false;
			gameState.workbenchPos = null;
		}
	}
	function applyActorSave(saved) {
		player.pos.set(saved.player.pos.x, saved.player.pos.y, saved.player.pos.z);
		player.facing = saved.player.facing;
		player.invincTimer = saved.player.invincTimer;
		playerGroup.position.copy(player.pos);
		playerGroup.rotation.y = player.facing + Math.PI;
		if (gameState.hasSword) addSwordToPlayer();
		deer.pos.set(saved.deer.pos.x, saved.deer.pos.y, saved.deer.pos.z);
		deer.facing = saved.deer.facing;
		deer.hp = saved.deer.hp;
		deer.state = saved.deer.state;
		deer.wanderTarget.set(saved.deer.wanderTarget.x, saved.deer.wanderTarget.y, saved.deer.wanderTarget.z);
		deer.wanderTimer = saved.deer.wanderTimer;
		deer.attackTimer = saved.deer.attackTimer;
		deer.alive = saved.deer.alive;
		deerGroup.position.copy(deer.pos);
		deerGroup.rotation.y = deer.facing;
		deerGroup.visible = deer.alive && !gameState.deerCaptured;
		carPos.set(saved.car.pos.x, saved.car.pos.y, saved.car.pos.z);
		carGroup.position.copy(carPos);
		carGroup.rotation.y = gameState.carFacing + Math.PI / 2;
		if (gameState.inCar) {
			player.pos.copy(carPos);
			playerGroup.visible = false;
		}
	}
	function loadSavedGame() {
		let saved = null;
		try {
			const raw = localStorage.getItem(SAVE_KEY);
			if (!raw) return {
				loaded: false,
				gameStarted: false
			};
			saved = JSON.parse(raw);
		} catch (err) {
			console.warn("[save] Unable to read game save", err);
			clearSavedGame();
			return {
				loaded: false,
				gameStarted: false
			};
		}
		if (!saved || saved.version !== SAVE_VERSION) {
			clearSavedGame();
			return {
				loaded: false,
				gameStarted: false
			};
		}
		for (const key of STATE_KEYS) if (key in saved.state) gameState[key] = structuredClone(saved.state[key]);
		applyWorldSave(saved);
		applyActorSave(saved);
		restoreRocketFlightPose(saved.rocket);
		restoreCageVisuals(saved.cage);
		syncRocketVisualsToState();
		return {
			loaded: true,
			gameStarted: saved.gameStarted
		};
	}
	function initPersistenceHooks(getGameStarted) {
		setInterval(() => saveGame(getGameStarted()), 1e3);
		window.addEventListener("pagehide", () => saveGame(getGameStarted()));
		window.addEventListener("beforeunload", () => saveGame(getGameStarted()));
		document.getElementById("reset-game-btn")?.addEventListener("click", () => {
			if (!window.confirm("Reset saved Forest Survival progress and start over?")) return;
			clearSavedGame();
			window.location.reload();
		});
	}
	//#endregion
	//#region src/main.ts
	makeGround();
	buildPlayer();
	buildDeer();
	generateWorld();
	initRocketWorlds();
	const savedGame = loadSavedGame();
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
	if (!savedGame.loaded) showMessage(`🌲 <strong>FOREST SURVIVAL</strong> 🌲<br><br>
    <em>A vicious deer stalks the woods...<br>also aliens, and zombies from the lab.</em><br><br>
    <b>← → Turn &nbsp;&nbsp; ↑ ↓ Move &nbsp;&nbsp; SPACE Action</b><br>
    <b>Rocket flight: ← → steer, ↑ thrust, ↓ pitch, V cockpit/chase view</b><br>
    <b>Phone/Tablet: full-screen zones to move/steer, tap for action, VIEW button for vehicle camera</b><br><br>
    <div id="touch-detect-line" style="font-size:12px;color:#9fd;">Touch detection: checking...</div>
    <button id="touch-manual-enable" class="touch-intro-btn">Enable Touch Controls</button><br><br>
    Chop trees → build workbench → craft pickaxe<br>→ mine ore + wood → craft cage → trap deer<br>
    → load cage into car → load rocket → fly into the blue landing beacon → release<br><br>
    🚗 Red car parked in the safe zone for emergencies<br>
    🧟 Zombies invade from the lab at dawn<br>
    👽 Aliens land randomly — car runs them over!<br><br>
    <strong style="color:#ffd700">Press any arrow key or tap screen to begin</strong>`, 0);
	else if (gameState.gameWon) triggerWin();
	else if (gameState.gameOver) triggerDeath();
	else showMessage("💾 <strong>Saved game loaded</strong><br>Your forest run has been restored.", 2200);
	let gameStarted = savedGame.gameStarted;
	initInput(() => {
		gameStarted = true;
	});
	initPersistenceHooks(() => gameStarted);
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
			if (gameState.inRocket) updateRocketFlight(dt);
			else if (gameState.onPlanet) updatePlayer(dt);
			else {
				updatePlayer(dt);
				updateCar(dt);
				updateDeer(dt);
				updateEnemies(dt);
				updateDayCycle(dt);
				updateCarHint(player.pos, carPos);
			}
			updateCage();
		}
		if (gameState.inRocket || gameState.onPlanet) updateClock(renderer, scene, sun, ambient, moonLight);
		updateRocketWorldAtmosphere();
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
