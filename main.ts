import * as THREE from 'three';

// ---------- Core setup ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0e14);
scene.fog = new THREE.Fog(0x0a0e14, 30, 90);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- Lighting ----------
scene.add(new THREE.AmbientLight(0x404060, 1.2));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(20, 40, 10);
scene.add(dirLight);

// ---------- Arena ----------
const ARENA = 60;
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
  new THREE.MeshStandardMaterial({ color: 0x141a24, roughness: 0.9 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// grid lines
const grid = new THREE.GridHelper(ARENA * 2, ARENA, 0x223044, 0x1a2436);
scene.add(grid);

// arena walls
const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e2836, roughness: 0.6 });
for (const [w, d, x, z] of [[ARENA * 2, 1, 0, -ARENA], [ARENA * 2, 1, 0, ARENA], [1, ARENA * 2, -ARENA, 0], [1, ARENA * 2, ARENA, 0]]) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 6, d), wallMat);
  wall.position.set(x, 3, z);
  scene.add(wall);
}

// cover blocks (deterministic placement)
const rng = (() => { let s = 1337; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const blockMat = new THREE.MeshStandardMaterial({ color: 0x2a3850, roughness: 0.5, metalness: 0.2 });
const blocks: { x: number; z: number; w: number; d: number }[] = [];
for (let i = 0; i < 24; i++) {
  const w = 2 + rng() * 4, d = 2 + rng() * 4, h = 2 + rng() * 2.5;
  const x = (rng() - 0.5) * (ARENA - 12);
  const z = (rng() - 0.5) * (ARENA - 12);
  if (Math.hypot(x, z) < 8) continue; // keep spawn clear
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), blockMat);
  b.position.set(x, h / 2, z);
  scene.add(b);
  blocks.push({ x, z, w, d });
}

// ---------- Player (FPS controller) ----------
const player = {
  pos: new THREE.Vector3(0, 1.7, 20),
  vel: new THREE.Vector3(),
  yaw: 0, pitch: 0,
  hp: 100, ammo: 30, reserve: 90,
  reloading: false, reloadT: 0,
  onGround: true,
  speed: 14, jump: 9,
  fireCd: 0,
};
const keys: Record<string, boolean> = {};
addEventListener('keydown', e => keys[e.code] = true);
addEventListener('keyup', e => keys[e.code] = false);
document.body.addEventListener('click', () => document.body.requestPointerLock());
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== document.body) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch - e.movementY * 0.0022));
});

function collides(px: number, pz: number): boolean {
  if (Math.abs(px) > ARENA - 1.5 || Math.abs(pz) > ARENA - 1.5) return true;
  for (const b of blocks) {
    if (Math.abs(px - b.x) < b.w / 2 + 0.5 && Math.abs(pz - b.z) < b.d / 2 + 0.5) return true;
  }
  return false;
}

// ---------- Enemies ----------
interface Enemy { mesh: THREE.Mesh; hp: number; pos: THREE.Vector3; dead: boolean; t: number; }
const enemies: Enemy[] = [];
const enemyGeo = new THREE.CapsuleGeometry(0.6, 1.2, 4, 8);
const enemyMat = new THREE.MeshStandardMaterial({ color: 0xd03050, emissive: 0x500000 });
function spawnEnemy() {
  const a = Math.random() * Math.PI * 2;
  const r = ARENA * 0.6;
  const e: Enemy = {
    mesh: new THREE.Mesh(enemyGeo, enemyMat.clone()),
    hp: 30 + wave * 5,
    pos: new THREE.Vector3(Math.cos(a) * r, 1.2, Math.sin(a) * r),
    dead: false, t: 0,
  };
  scene.add(e.mesh);
  enemies.push(e);
}

// ---------- Shooting ----------
const raycaster = new THREE.Raycaster();
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.9 });
function shoot() {
  if (player.reloading || player.fireCd > 0 || player.ammo <= 0) return;
  player.fireCd = 0.11;
  player.ammo--;
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));
  raycaster.set(player.pos.clone(), dir);
  raycaster.far = 100;

  const hits = raycaster.intersectObjects(enemies.filter(e => !e.dead).map(e => e.mesh));
  const from = player.pos.clone();
  const to = hits.length ? hits[0].point : from.clone().add(dir.multiplyScalar(80));
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), tracerMat.clone());
  scene.add(line);
  setTimeout(() => { scene.remove(line); (line.geometry as THREE.BufferGeometry).dispose(); }, 60);

  if (hits.length) {
    const e = enemies.find(en => en.mesh === hits[0].object)!;
    e.hp -= 12;
    (e.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0xff4040);
    setTimeout(() => (e.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x500000), 80);
    if (e.hp <= 0) {
      e.dead = true;
      scene.remove(e.mesh);
      kills++;
      score += 10 + wave * 2;
    }
  }
}

// ---------- HUD ----------
const hud = document.createElement('div');
hud.style.cssText = 'position:fixed;top:10px;left:10px;color:#cfe;font:14px monospace;text-shadow:0 0 4px #000;user-select:none;pointer-events:none;z-index:10';
document.body.appendChild(hud);
const cross = document.createElement('div');
cross.style.cssText = 'position:fixed;top:50%;left:50%;width:6px;height:6px;margin:-3px;background:#ffd060;border-radius:50%;z-index:10;pointer-events:none';
document.body.appendChild(cross);

let score = 0, kills = 0, wave = 1, waveT = 0, spawnT = 0;
const enemiesPerWave = 5;

// ---------- Game loop ----------
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);

  // movement
  const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const mv = new THREE.Vector3();
  if (keys['KeyW']) mv.add(fwd);
  if (keys['KeyS']) mv.sub(fwd);
  if (keys['KeyD']) mv.add(right);
  if (keys['KeyA']) mv.sub(right);
  if (mv.lengthSq()) mv.normalize().multiplyScalar(player.speed * dt);
  const nx = player.pos.x + mv.x, nz = player.pos.z + mv.z;
  if (!collides(nx, player.pos.z)) player.pos.x = nx;
  if (!collides(player.pos.x, nz)) player.pos.z = nz;

  if (keys['Space'] && player.onGround) { player.vel.y = player.jump; player.onGround = false; }
  player.vel.y -= 24 * dt;
  player.pos.y += player.vel.y * dt;
  if (player.pos.y <= 1.7) { player.pos.y = 1.7; player.vel.y = 0; player.onGround = true; }

  // reload
  if (keys['KeyR'] && !player.reloading && player.ammo < 30 && player.reserve > 0) {
    player.reloading = true; player.reloadT = 1.4;
  }
  if (player.reloading) {
    player.reloadT -= dt;
    if (player.reloadT <= 0) {
      const need = 30 - player.ammo;
      const take = Math.min(need, player.reserve);
      player.ammo += take; player.reserve -= take;
      player.reloading = false;
    }
  }
  if (keys['Mouse0'] || keys['mousedown']) shoot();
  player.fireCd = Math.max(0, player.fireCd - dt);

  // waves
  waveT += dt;
  if (enemies.filter(e => !e.dead).length === 0 && waveT > 2) {
    wave++;
    waveT = 0;
    for (let i = 0; i < enemiesPerWave + wave; i++) spawnEnemy();
  }
  spawnT += dt;
  if (spawnT > 20 && enemies.length < 14) { spawnEnemy(); spawnT = 0; }

  // enemy AI: chase player + damage on proximity
  for (const e of enemies) {
    if (e.dead) continue;
    const to = player.pos.clone().sub(e.pos);
    to.y = 0;
    const dist = to.length();
    if (dist > 1.5) {
      to.normalize().multiplyScalar((2.5 + wave * 0.3) * dt);
      const ex = e.pos.x + to.x, ez = e.pos.z + to.z;
      if (!collides(ex, e.pos.z)) e.pos.x = ex;
      if (!collides(e.pos.x, ez)) e.pos.z = ez;
    } else {
      player.hp -= 12 * dt;
    }
    e.t += dt;
    e.mesh.position.set(e.pos.x, 1.2 + Math.sin(e.t * 4) * 0.15, e.pos.z);
  }

  if (player.hp <= 0) {
    player.hp = 100; player.pos.set(0, 1.7, 20);
    score = Math.max(0, score - 50);
    enemies.forEach(e => { if (!e.dead) { e.dead = true; scene.remove(e.mesh); } });
  }

  camera.position.copy(player.pos);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  hud.textContent = `HP ${Math.max(0, Math.ceil(player.hp))} | AMMO ${player.ammo}/${player.reserve}${player.reloading ? ' (RELOADING)' : ''} | WAVE ${wave} | KILLS ${kills} | SCORE ${score}`;
  renderer.render(scene, camera);
}
tick();
