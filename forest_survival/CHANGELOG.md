# v.1

Here's your Forest Survival game built with Three.js! 🌲
How to play:

← → to turn, ↑ ↓ to move, SPACE to action
The minimap (bottom-right) shows your position (blue), the deer (red), and mines (grey)

Progression path:

🪓 Chop trees (SPACE near them) to get wood
🏠 Walk to the safe zone (green circle center), SPACE to build Workbench (5 wood)
⛏️ At the Workbench, SPACE to craft Pickaxe (3 wood)
⛰️ Find the grey rock mines deep in the forest, SPACE to mine ore
🗡️ Back at the Workbench, forge the Sword (3 ore + 2 wood)
☠️ Hunt the deer and press SPACE to attack (4 hits kills it!)

Features:

The deer has glowing red eyes and a staggering walk — it chases you when close
The deer can't enter the safe zone or deforested areas
HP regenerates slowly in the safe zone
Screen flashes red when the deer attacks you

# v.2

All three changes are in. Here's what changed:
1. Controls swapped — Left arrow now turns right, right arrow turns left. Same swap applied to the car steering.
2. Workbench / ore bug fixed — The crafting logic was restructured so it's now a clean priority chain: when you press SPACE at the workbench it checks in order — craft pickaxe first (3 wood), then forge sword (3 ore + 2 wood). The hint text now always shows exactly what you have vs. what you need, so you always know what's missing.
3. New emergency features:

🚗 Red car is parked inside the safe zone. Walk up and press SPACE to get in, drive with arrows, SPACE to exit. The car runs over aliens and zombies.
🧟 Zombies spawn from the lab (visible down the road to the right) every time dawn hits. They lurch toward you with outstretched arms and a zombie limp.
👽 Aliens land randomly every 60–150 seconds, arriving from outside the forest. They float in with a UFO disk above them and a green tractor beam.
A day/night cycle (2 min loop) with a changing sky — you can see on the clock when dawn is approaching. The minimap shows aliens (green), zombies (orange), and the lab (glowing green square).

# v.3

All sound is procedurally synthesized with Web Audio API — no external files needed. Here's what was added:
🎻 Background Music — three layered voices playing simultaneously:

Violin — spooky minor-key phrases (C natural minor) built from a sawtooth wave with vibrato and a bandpass filter simulating bowing
Ocarina — hollow sine-wave duet, slightly off-pitch for that unsettling character, plays eerie counter-melodies
Drone — two detuned sawtooth waves slowly swelling in volume, plus random pizzicato low-string plucks
Everything runs through a convolution reverb for atmospheric depth

🦌 Deer sounds — two types:

Wandering: haunting modulated howl with pitch wavering up and down, drenched in reverb
Chasing/Attacking: distorted guttural screech (waveshaper distortion + descending sawtooth) followed by a high harmonic shriek, plus a low-frequency impact thud on each hit

😄 Player sounds — trigger randomly every 8–20 seconds:

Burp: voiced noise burst with pitch-modulated sine + bandpass filter
Whistle: two-note breathy sine melody (slightly airy from a high-frequency mix)
Fart: flutter-modulated low noise with randomized frequency and duration

Each sound also shows a floating emoji text (burp, whistle, pfffft) that fades upward.

# v.4

Refactored the game from a single monolithic HTML file into a modular TypeScript codebase:

- All game logic moved from inline `<script>` in `forest_survival_1.html` into 14 TypeScript modules under `src/`
- Modules: `constants`, `state`, `scene`, `world`, `player`, `deer`, `car`, `enemies`, `workbench`, `ui`, `audio`, `input`, `camera`, `main`
- Compiled to `dist/` via OXC (`npm run build`) using `@oxc-node/core` transform API
- New `index.html` loads Three.js r128 from CDN as a global, then imports `dist/main.js` as an ES module
- `@types/three` used for TypeScript type information (`declare const THREE: typeof import('three')`)
- PostToolUse hook installed in `.claude/settings.json` to auto-run `npm run build` after every file edit
- Added `serve.mjs` minimal HTTP dev server (`npm run serve` → http://localhost:3000) required because ES modules cannot load over `file://`

# v.5

Car overhaul:

- **Fixed car driving direction** — the car was driving sideways because the model's front (+X axis) wasn't aligned with the movement direction (-Z). Fixed the rotation offset from `+ Math.PI` to `+ Math.PI / 2`. Also fixed wheel spin animation targeting wrong child indices.
- **Realistic shiny car** — replaced flat `MeshLambertMaterial` with `MeshPhysicalMaterial` featuring metalness, clearcoat, and low roughness for a glossy car paint finish. Added chrome bumpers, side mirrors, roof rails, side skirts, alloy rims inside tires, spherical headlights with emissive glow, red emissive taillights, a dark grille, and tinted glass windows with slight transmission.
- **Driver's view toggle** — press **V** while in the car to switch between third-person and first-person driver's view. The driver camera sits inside the cabin looking forward. Press V again to return to third-person. View resets to third-person when exiting the car.

# v.6

Photorealistic car rebuild:

- **Curved sedan body** — replaced boxy geometry with `ExtrudeGeometry` using a Bézier-curved sedan profile (hood slope, windshield sweep, roofline, trunk). Bevel smoothing on all edges.
- **Environment map reflections** — `PMREMGenerator` captures the actual game scene (trees, sky, ground) as a cubemap and applies it to all shiny materials. The car now reflects its surroundings.
- **Procedural textures** — canvas-generated normal maps: metallic flake pattern for paint (gives sparkle at close range), tread grooves for tires, and radial spoke pattern for alloy rims. No external dependencies.
- **Detailed parts** — torus-profile tires, 5-spoke alloy wheels with center caps, lens-shaped headlights, chrome grille with horizontal slats, exhaust tips, door-line chrome strips, dark wheel arch trims, contact-shadow plane underneath.

# v.7

Car realism pass (sleeker + less washed out):

- **PBR render pipeline fix** — enabled `sRGBEncoding` output and ACES tone mapping in the renderer, then rebalanced ambient/sun/fill light so glossy materials keep detail instead of clipping to flat white.
- **New sports-sedan build** — replaced the previous body composition with a cleaner extruded silhouette plus refined hood/roof/trunk proportions, panel lines, door handles, wheel arches, and trim.
- **Better materials and reflections** — retuned automotive paint (`MeshPhysicalMaterial` clearcoat), glass, chrome, rims, and tire shaders; added higher fidelity procedural normal/roughness textures and a studio-style PMREM environment map for controlled highlights.
- **Wheel animation cleanup** — removed brittle child-index wheel updates and switched to explicit wheel/steering references for stable spin + front wheel steer visuals.
- **Build script alias** — added `npm run oxnode` as an alias to the OXC build pipeline so TypeScript→`dist/` compilation follows the AGENTS workflow directly.

# v.8

Photoreal car pass with CC0 texture sets:

- **Real texture pipeline** — downloaded and integrated Poly Haven CC0 1K PBR maps (`metal_plate_02`, `rubber_tiles`, `leather_red_02`) into project-local assets under `assets/textures/car/`.
- **Material upgrade** — chrome/rims/trim now use real albedo + normal + ARM maps; tires use rubber albedo + normal + ARM maps; paint keeps procedural flake normals with stronger clearcoat layering.
- **Interior detail pass** — added visible cabin geometry (dashboard, console, steering wheel, front/rear seats + headrests) with textured leather/plastic so the glass reads as a real enclosure.
- **Front fascia refinement** — added lower intake fins and front splitter to improve silhouette and close-up realism.
- **Lighting model improvement** — enabled `renderer.physicallyCorrectLights` to improve energy response for PBR materials under the scene lighting/tone mapping setup.
- **Asset attribution** — added `assets/textures/car/CREDITS.md` with Poly Haven source/license references for imported CC0 maps.

# v.9

Codex local build hook:

- **Project-local Codex hook config** — added `./.codex/config.toml` with a `PostToolUse` hook that matches `Write|Edit|MultiEdit` and runs `npm run build` after file writes/edits.

# v.10

Single-file bundling build update:

- Build process now uses Rolldown with this command shape: `npx rolldown src/main.ts --file dist/bundle.js --format iife`
- `build.mjs` clears existing `dist/*.js` artifacts before bundling
- `index.html` now loads `dist/bundle.js` so runtime uses one JavaScript file from `dist`

# v.11

Project cleanup after switching to single-file bundle output:

- Removed `serve.mjs` and dropped the `serve` npm script
- Removed unused `@oxc-node/cli` dev dependency
- Deleted legacy `forest_survival_1.html`
- Removed empty temporary directory `tmp/`

# v.12

Touch fallback controls for keyboard-less devices:

- Added `src/touch-controls.ts` to detect likely phone/tablet environments (`maxTouchPoints` + coarse pointer/mobile UA) and offer an on-screen control scheme
- Added a touch controls offer panel in `index.html` with Enable/Dismiss actions
- Added virtual trackpad movement/steering input that maps to existing arrow-key gameplay logic
- Added on-screen `ACTION` and `CAM` buttons for interact/attack and in-car camera toggling
- Added `gameState.inputProfile` (`keyboard`/`touch`) so gameplay hints and car hints can adapt to active controls
- Updated intro/help text and interaction strings to show touch-friendly labels when touch controls are enabled

# v.13

AGENTS.md maintenance pass:

- Updated build instructions to reflect the current Rolldown pipeline (`npm run build` / `npm run oxnode` -> `build.mjs` -> `dist/bundle.js`)
- Documented Codex PostToolUse hook details from `.codex/config.toml` (`Write|Edit|MultiEdit` -> `npm run build 2>&1 | tail -20`)
- Removed outdated references to OXC output naming, `dist/main.js`, and `serve.mjs`
- Updated folder structure docs to match the current project layout and scripts

# v.14

Touch controls usability overhaul:

- Touch controls now auto-enable on detected touch-first devices (no enable/dismiss gate)
- Replaced the old virtual joystick with full-screen directional zones split into `up/down/left/right`
- Added tap-based actions on the touch zones (single tap and repeated taps both trigger actions)
- Kept a dedicated on-screen `VIEW` button for in-car camera switching
- Updated touch control copy in intro/hints (`TAP` and `VIEW`) to match the new interaction model

# v.15

Touch intro start reliability:

- Added explicit touch start listeners so a tap anywhere on-screen exits the intro/info message and starts the game on touch devices
- Keeps keyboard start behavior unchanged while making mobile start interaction immediate and predictable

# v.16

Real-device touch compatibility hardening:

- Reworked touch detection to handle real tablet/phone edge cases better (including iPad desktop-style user agents)
- Added direct `touchstart/touchmove/touchend` fallback handlers in addition to pointer handlers for movement/action zones
- Touch controls now auto-enable whenever a real touch interaction begins, even if coarse-pointer heuristics are inconsistent
- Added event de-duplication on the `VIEW` button to prevent double toggles on browsers that emit both pointer and click/touch events

# v.17

Touch fallback + mobile zoom prevention:

- Added visible touch-detection status text to the intro message so players can see whether touch was detected
- Added an explicit `Enable Touch Controls` intro button to manually force touch mode when auto-detection fails
- Touch taps anywhere now also attempt to force-enable touch controls before starting the game
- Added mobile viewport config (`user-scalable=no`, `maximum-scale=1`) and CSS touch/overscroll guards to reduce accidental page zooming during gameplay
- Added iOS gesture guards (`gesturestart`/`gesturechange`) to further prevent pinch/double-tap zoom behavior

# v.18

Bundle cache-busting on build:

- `build.mjs` now generates a random token after each successful build and rewrites `index.html` script URL to `dist/bundle.js?v=<random>`
- Cache-bust query replacement supports both plain `dist/bundle.js` and previously versioned URLs
- This ensures browsers fetch the latest bundle after rebuilds instead of serving stale cached JS

# v.19

Rocket site collision + rocket visual realism pass:

- Replaced the old single-radius rocket-site collision with footprint-aware boundaries (pad rectangle, gantry tower, service arms, fuel tanks, rocket core, and booster colliders) for more accurate launch-site edge detection.
- Added procedural high-visibility rocket hull textures (paint panels, seams, stage bands, decals, and micro-variation) so the rocket no longer renders as a flat dark/black surface.
- Upgraded rocket/launch-site materials from basic Lambert shading to tuned PBR materials with normal/roughness detail and metal maps for improved readability and realism under the day/night lighting model.
