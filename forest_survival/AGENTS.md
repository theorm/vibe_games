# Rules

* Source game code must be TypeScript in `src/` (do not author gameplay JS directly in `dist/`).
* Keep the game modular: one module/file per responsibility.
* With every change, append a changelog entry to `CHANGELOG.md`.
* Build with Rolldown through the project scripts: `npm run build` (or `npm run oxnode` alias).
* All generated JavaScript output must live in `dist/`.
* Do not hand-edit generated files in `dist/`.

# Build and hooks

* Build command path: `npm run build` -> `node build.mjs`.
* `build.mjs` runs Rolldown as: `npx rolldown src/main.ts --file dist/bundle.js --format iife`.
* The build script removes stale `dist/*.js` files before writing new output.
* Codex hook is configured in `.codex/config.toml`:
  * `PostToolUse` matcher: `Write|Edit|MultiEdit`
  * command: `npm run build 2>&1 | tail -20`
* If the hook does not run for any reason, run `npm run build` manually.

# Folder structure

```
forest_survival/
├── .codex/config.toml   # Codex PostToolUse hook to run build after edits
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
├── dist/
│   └── bundle.js         # Generated bundle output (Rolldown, do not edit)
├── index.html            # Game page — loads Three.js CDN + dist/bundle.js
├── build.mjs             # Rolldown build runner used by npm scripts
└── package.json          # Scripts: build, oxnode
```

