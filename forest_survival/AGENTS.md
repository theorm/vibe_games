# Rules

* the game JS files must be in typescript.
* the game must be modular. A file per module.
* with every change append a changelog entry to CHANGELOG.md
* use OXC (`npm run oxnode`) for TS to JS (already set up as a hook for claude)
* all JS files must be in dist/ folder

# Folder structure

```
forest_survival/
├── src/                  # TypeScript source modules
│   ├── constants.ts      # Game constants (speeds, ranges, counts)
│   ├── state.ts          # Shared mutable state, array stores, interfaces
│   ├── scene.ts          # Three.js renderer, scene, camera, lighting
│   ├── world.ts          # Ground, trees, mines, spatial helpers, world gen
│   ├── player.ts         # Player mesh, movement, sword attachment
│   ├── deer.ts           # Deer mesh, chase/wander AI
│   ├── car.ts            # Car mesh, driving logic
│   ├── enemies.ts        # Alien & zombie spawning and AI
│   ├── workbench.ts      # Workbench placement
│   ├── ui.ts             # HUD, minimap, messages, win/death
│   ├── audio.ts          # Web Audio procedural sound engine
│   ├── input.ts          # Keyboard handling, player actions, hints
│   ├── camera.ts         # Third-person follow camera
│   └── main.ts           # Entry point: init, main loop, day cycle
├── dist/                 # Compiled JS output (OXC, do not edit)
├── index.html            # Game page — loads Three.js CDN + dist/main.js
├── build.mjs             # OXC build script (npm run build)
├── serve.mjs             # Local HTTP dev server (npm run serve)
└── package.json          # Scripts: build, serve
```


