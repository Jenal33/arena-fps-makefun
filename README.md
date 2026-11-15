# ARENA FPS

Wave-survival FPS arena shooter built with three.js + TypeScript. Entry for the
make.fun bounty [threejs-fps-01](https://make.fun) ("Make the best three.js tactical FPS").

## Gameplay

- WASD to move, mouse to aim, left-click to shoot, R to reload, Space to jump
- Enemies spawn in waves from the arena edge and chase you
- Each wave adds more enemies with more HP and speed
- Death respawns you at the center and costs 50 points
- Score = kills * (10 + wave * 2)

## Features

- Pointer-lock FPS controls with yaw/pitch camera
- AABB collision against arena walls and cover blocks
- Deterministic cover-block layout (seeded PRNG)
- Raycast hitscan shooting with visual tracers
- Wave-based enemy spawning with chase AI
- HUD (HP/ammo/wave/kills/score), hit-flash feedback, fog + grid arena

## Stack

- three.js 0.160 (ES modules)
- TypeScript 5, Vite 5
- Node 22

## Run

```bash
npm install
npm run dev     # http://localhost:5173
```

## License

MIT — see [LICENSE](LICENSE).
