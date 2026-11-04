// Pixel Siege (c) 2026 newbie-1010. All rights reserved.
// Game states, main loop, collisions, HUD and screens.
//
// States: MENU -> INTRO -> PLAYING -> CLEAR -> INTRO (next level) ... -> VICTORY
//         PLAYING <-> PAUSED, PLAYING -> GAMEOVER -> INTRO (retry) or MENU

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// Scale the 320x180 canvas up by the largest whole number that fits the window.
function fit() {
  const ratio = Math.min(innerWidth / W, innerHeight / H);
  const k = ratio >= 1 ? Math.floor(ratio) : ratio;
  canvas.style.width = W * k + 'px';
  canvas.style.height = H * k + 'px';
}
addEventListener('resize', fit);
fit();

// ---------- Saved progress ----------
const Save = {
  key: 'pixelSiege.v1',
  data: { hi: 0, maxLevel: 1, muted: false },
  load() {
    try {
      const d = JSON.parse(localStorage.getItem(this.key));
      if (d) Object.assign(this.data, d);
    } catch (e) { /* storage unavailable: play without saving */ }
  },
  write() {
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
  },
};
Save.load();
SFX.setMuted(!!Save.data.muted);

// ---------- Game state ----------
const G = {
  state: 'MENU',
  time: 0,
  level: 1,
  def: LEVELS[0],
  score: 0,
  levelStartScore: 0,
  newHi: false,
  player: new Player(W / 2, H / 2),
  enemies: [], bullets: [], particles: [], popups: [], pickups: [],
  arena: null,
  kills: 0, spawned: 0, spawnTimer: 0,
  boss: null,
  clearing: false, clearTimer: 0,
  deathTimer: 0,
  timer: 0, bonus: 0,
  shake: 0, hurtFlash: 0,
  menuIndex: 0,
  optRects: [],

  enemyShoot(x, y, angle, speed) {
    this.bullets.push(new Bullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, true));
  },
  spawnMinions(n) {
    for (let i = 0; i < n; i++) {
      if (this.enemies.length >= this.def.maxAlive + 1) break;
      spawnEnemy(Math.random() < 0.5 ? 'bat' : 'slime', true);
    }
  },
};

const menuArena = buildArena('grass', 7);

Input.attach(canvas);
Input.onBlur = () => { if (G.state === 'PLAYING') G.state = 'PAUSED'; };

function toggleMute() {
  SFX.setMuted(!SFX.muted);
  Save.data.muted = SFX.muted;
  Save.write();
  SFX.play('select');
}

function saveHi() {
  if (G.score > Save.data.hi) { Save.data.hi = G.score; G.newHi = true; }
  Save.write();
}

// ---------- Level flow ----------
function startLevel(n) {
  const def = LEVELS[n - 1];
  G.level = n;
  G.def = def;
  G.arena = buildArena(def.theme, n * 977);
  G.player = new Player(W / 2, (H + HUD_H) / 2);
  G.enemies = []; G.bullets = []; G.particles = []; G.popups = []; G.pickups = [];
  G.kills = 0; G.spawned = 0; G.spawnTimer = 1.2;
  G.boss = null;
  G.clearing = false; G.clearTimer = 0;
  G.deathTimer = 0;
  G.shake = 0; G.hurtFlash = 0;
  G.levelStartScore = G.score;
  G.newHi = false;
  G.state = 'INTRO';
  G.timer = 2.4;
}

function beginPlay() {
  G.state = 'PLAYING';
  if (G.def.boss) {
    G.boss = spawnEnemy('boss', false, { x: W / 2, y: -24 });
    SFX.play('boss');
    G.shake = 6;
  }
}

function levelClear() {
  G.state = 'CLEAR';
  G.timer = 3;
  G.bonus = G.player.hp * 50;
  G.score += G.bonus;
  G.bullets = G.bullets.filter(b => !b.enemy);
  if (G.level < LEVELS.length) Save.data.maxLevel = Math.max(Save.data.maxLevel, G.level + 1);
  saveHi();
  SFX.play('clear');
}

function advance() {
  if (G.level < LEVELS.length) startLevel(G.level + 1);
  else { G.state = 'VICTORY'; G.timer = 1.2; saveHi(); }
}

function gameOver() {
  G.state = 'GAMEOVER';
  G.menuIndex = 0;
  saveHi();
  SFX.play('gameover');
}

function toMenu() {
  G.state = 'MENU';
  G.menuIndex = 0;
}

// ---------- Spawning ----------
function spawnEnemy(type, minion, at) {
  let x, y;
  if (at) { x = at.x; y = at.y; }
  else {
    // Just outside a random edge, away from the player where possible.
    for (let tries = 0; tries < 6; tries++) {
      const side = Math.floor(Math.random() * 4), m = 12;
      if (side === 0) { x = rand(10, W - 10); y = HUD_H - m; }
      else if (side === 1) { x = W + m; y = rand(HUD_H + 10, H - 10); }
      else if (side === 2) { x = rand(10, W - 10); y = H + m; }
      else { x = -m; y = rand(HUD_H + 10, H - 10); }
      if (Math.hypot(x - G.player.x, y - G.player.y) > 70) break;
    }
  }
  const e = new Enemy(type, x, y, G.def.speed, minion);
  G.enemies.push(e);
  return e;
}

function pickType(mix) {
  const keys = Object.keys(mix);
  let total = 0;
  for (const k of keys) total += mix[k];
  let r = Math.random() * total;
  for (const k of keys) { r -= mix[k]; if (r <= 0) return k; }
  return keys[0];
}

// ---------- Combat ----------
function burst(x, y, colors, n, speed, size) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = rand(0.3, 1) * speed;
    G.particles.push(new Particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.3, 0.7), pick(colors), size || (Math.random() < 0.5 ? 1 : 2)));
  }
}

function playerShoot() {
  const p = G.player;
  const m = p.muzzlePos();
  const a = p.aim + (Math.random() - 0.5) * 0.06;
  G.bullets.push(new Bullet(m.x, m.y, Math.cos(a) * 230, Math.sin(a) * 230, false));
  p.cool = 0.15;
  p.recoil = 1;
  p.muzzle = 0.05;
  SFX.play('shoot');
}

const DEATH_COLORS = {
  slime: ['#38b764', '#a7f070', '#257179'],
  bat: ['#5d275d', '#8b4f9e', '#ff5a5a'],
  skeleton: ['#f4f4f4', '#94b0c2', '#566c86'],
  brute: ['#b13e53', '#ef7d57', '#73172d'],
  boss: ['#8b4f9e', '#ffcd75', '#5d275d', '#ffffff', '#ff004d'],
};

function hitEnemy(e, b) {
  e.hp -= 1;
  e.flash = 0.08;
  if (e.type !== 'boss') {
    const s = Math.hypot(b.vx, b.vy) || 1;
    e.kx += b.vx / s * 60; e.ky += b.vy / s * 60;
  }
  burst(b.x, b.y, ['#ffffff', '#ffcd75'], 4, 60);
  SFX.play('hit');
  if (e.hp <= 0) killEnemy(e, false);
}

function killEnemy(e, silent) {
  if (e.dead) return;
  e.dead = true;
  const isBoss = e.type === 'boss';
  burst(e.x, e.y, DEATH_COLORS[e.type], isBoss ? 120 : 14, isBoss ? 150 : 80, isBoss ? 3 : 0);
  if (silent) return;
  G.score += e.score;
  G.popups.push(new Popup(e.x, e.y - 8, '+' + e.score, '#ffcd75'));
  if (!e.minion) G.kills++;
  const p = G.player;
  if (!isBoss && Math.random() < (p.hp < p.maxHp ? 0.1 : 0.04)) G.pickups.push(new Pickup(e.x, e.y));
  if (isBoss) {
    SFX.play('bigExplode');
    G.shake = 10;
    G.enemies.forEach(o => { if (o !== e) killEnemy(o, true); });
    G.bullets = G.bullets.filter(b => !b.enemy);
  } else {
    SFX.play('explode');
    G.shake = Math.max(G.shake, e.type === 'brute' ? 4 : 2);
  }
}

function hurtPlayer(sx, sy) {
  const p = G.player;
  if (p.dead || p.inv > 0) return;
  p.hp -= 1;
  p.inv = 1.1;
  const d = Math.hypot(p.x - sx, p.y - sy) || 1;
  p.kx = (p.x - sx) / d * 140; p.ky = (p.y - sy) / d * 140;
  G.shake = 5;
  G.hurtFlash = 0.2;
  SFX.play('hurt');
  burst(p.x, p.y, ['#e43b44', '#ffcdd2'], 8, 70);
  if (p.hp <= 0) {
    p.dead = true;
    G.deathTimer = 1.6;
    burst(p.x, p.y, ['#3b8bd9', '#f4c79a', '#e43b44', '#ffffff'], 50, 120);
    SFX.play('bigExplode');
    G.shake = 8;
  }
}

function separate() {
  const es = G.enemies;
  for (let i = 0; i < es.length; i++) {
    for (let j = i + 1; j < es.length; j++) {
      const a = es[i], b = es[j];
      const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0 && d2 < min * min) {
        const d = Math.sqrt(d2), push = (min - d) / 2, nx = dx / d, ny = dy / d;
        if (a.type !== 'boss') { a.x -= nx * push; a.y -= ny * push; }
        if (b.type !== 'boss') { b.x += nx * push; b.y += ny * push; }
      }
    }
  }
}

function updatePlaying(dt) {
  const p = G.player;
  p.update(dt, !p.dead);
  if (!p.dead && Input.mouseDown && p.cool <= 0) playerShoot();

  // Spawner (normal levels)
  if (!G.def.boss && !G.clearing) {
    G.spawnTimer -= dt;
    if (G.spawnTimer <= 0 && G.spawned < G.def.kills && G.enemies.length < G.def.maxAlive) {
      spawnEnemy(pickType(G.def.mix), false);
      G.spawned++;
      G.spawnTimer = G.def.interval * rand(0.7, 1.3);
    }
  }

  for (const e of G.enemies) e.update(dt, G);
  separate();

  for (const b of G.bullets) {
    b.update(dt);
    if (b.dead) continue;
    if (!b.enemy) {
      for (const e of G.enemies) {
        if (!e.dead && Math.hypot(e.x - b.x, e.y - b.y) < e.r + 2) { b.dead = true; hitEnemy(e, b); break; }
      }
    } else if (!p.dead && p.inv <= 0 && Math.hypot(p.x - b.x, p.y - b.y) < p.r + 2) {
      b.dead = true;
      hurtPlayer(b.x, b.y);
    }
  }

  if (!p.dead) {
    for (const e of G.enemies) {
      if (!e.dead && Math.hypot(p.x - e.x, p.y - e.y) < p.r + e.r) hurtPlayer(e.x, e.y);
    }
    for (const h of G.pickups) {
      if (!h.dead && Math.hypot(p.x - h.x, p.y - h.y) < p.r + 5) {
        h.dead = true;
        p.hp = Math.min(p.maxHp, p.hp + 1);
        G.popups.push(new Popup(h.x, h.y - 8, '+1 HP', '#ffcdd2'));
        SFX.play('pickup');
      }
    }
  }
  for (const h of G.pickups) h.update(dt);

  G.enemies = G.enemies.filter(e => !e.dead);
  G.bullets = G.bullets.filter(b => !b.dead);
  G.pickups = G.pickups.filter(h => !h.dead);

  // Level complete? Wait a moment so the last explosion plays out.
  if (!G.clearing && !p.dead) {
    const done = G.def.boss ? (G.boss && G.boss.dead) : G.kills >= G.def.kills;
    if (done) { G.clearing = true; G.clearTimer = G.def.boss ? 1.8 : 0.9; }
  }
  if (G.clearing) {
    G.clearTimer -= dt;
    if (G.clearTimer <= 0) levelClear();
  }

  if (p.dead) {
    G.deathTimer -= dt;
    if (G.deathTimer <= 0) gameOver();
  }
}

function updateEffects(dt) {
  for (const pt of G.particles) pt.update(dt);
  for (const pp of G.popups) pp.update(dt);
  G.particles = G.particles.filter(pt => !pt.dead);
  G.popups = G.popups.filter(pp => !pp.dead);
  G.shake = Math.max(0, G.shake - dt * 20);
  G.hurtFlash = Math.max(0, G.hurtFlash - dt);
}

// ---------- Option lists (menu, game over) ----------
function menuItems() {
  const items = [{ label: 'START GAME', action: () => { G.score = 0; startLevel(1); } }];
  if (Save.data.maxLevel > 1) {
    items.push({ label: 'CONTINUE: LEVEL ' + Save.data.maxLevel, action: () => { G.score = 0; startLevel(Save.data.maxLevel); } });
  }
  items.push({ label: 'SOUND: ' + (SFX.muted ? 'OFF' : 'ON'), action: toggleMute });
  return items;
}

function gameOverItems() {
  return [
    { label: 'RETRY LEVEL ' + G.level, action: () => { G.score = G.levelStartScore; startLevel(G.level); } },
    { label: 'MAIN MENU', action: toMenu },
  ];
}

function handleOptions(items) {
  const n = items.length;
  if (G.menuIndex >= n) G.menuIndex = 0;
  if (Input.hit('ArrowUp', 'KeyW')) { G.menuIndex = (G.menuIndex + n - 1) % n; SFX.play('select'); }
  if (Input.hit('ArrowDown', 'KeyS')) { G.menuIndex = (G.menuIndex + 1) % n; SFX.play('select'); }
  const over = G.optRects.findIndex(r => r && Input.mx >= r.x && Input.mx <= r.x + r.w && Input.my >= r.y && Input.my <= r.y + r.h);
  if (Input.moved && over >= 0 && over !== G.menuIndex) { G.menuIndex = over; SFX.play('select'); }
  if (Input.clicked && over >= 0 && over < n) { G.menuIndex = over; items[over].action(); }
  else if (Input.hit('Enter', 'Space')) items[G.menuIndex].action();
}

// ---------- Update ----------
function update(dt) {
  G.time += dt;
  if (Input.hit('KeyM')) toggleMute();

  switch (G.state) {
    case 'MENU':
      handleOptions(menuItems());
      break;
    case 'INTRO':
      G.timer -= dt;
      G.player.update(dt, false);
      updateEffects(dt);
      if (G.timer <= 0) beginPlay();
      break;
    case 'PLAYING':
      if (Input.hit('KeyP', 'Escape')) { G.state = 'PAUSED'; SFX.play('select'); break; }
      updatePlaying(dt);
      updateEffects(dt);
      break;
    case 'PAUSED':
      if (Input.hit('KeyP', 'Escape')) G.state = 'PLAYING';
      else if (Input.hit('KeyQ')) { saveHi(); toMenu(); }
      break;
    case 'CLEAR':
      G.timer -= dt;
      G.player.update(dt, true);
      updateEffects(dt);
      if (G.timer <= 0) advance();
      break;
    case 'GAMEOVER':
      updateEffects(dt);
      handleOptions(gameOverItems());
      break;
    case 'VICTORY':
      updateEffects(dt);
      if (Math.random() < dt * 4) {
        burst(rand(30, W - 30), rand(30, H - 40), ['#ffcd75', '#ef7d57', '#a7f070', '#7fb0ff', '#ffffff'], 24, 90);
      }
      if (G.timer > 0) G.timer -= dt;
      else if (Input.clicked || Input.hit('Enter', 'Space')) toMenu();
      break;
  }
}

// ---------- Drawing ----------
function dim(alpha) {
  ctx.fillStyle = 'rgba(12, 13, 24, ' + alpha + ')';
  ctx.fillRect(0, 0, W, H);
}

function blink(rate) { return Math.floor(G.time * rate) % 2 === 0; }

function drawOptions(items, y) {
  G.optRects = [];
  items.forEach((it, i) => {
    const yy = y + i * 13;
    const sel = i === G.menuIndex;
    const label = sel ? '> ' + it.label + ' <' : it.label;
    drawText(ctx, label, W / 2, yy, sel ? '#ffcd75' : '#c2c8d4', 1, 'center', '#1a1c2c');
    const w = textWidth(it.label) + 28;
    G.optRects[i] = { x: W / 2 - w / 2, y: yy - 3, w, h: 11 };
  });
}

function drawGunAt(x, y, angle, scale) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(angle);
  ctx.scale(scale, Math.cos(angle) < 0 ? -scale : scale);
  ctx.drawImage(SPR.gun.img, -2, -3);
  ctx.restore();
}

function drawMenu() {
  const off = Math.floor(G.time * 12) % W;
  ctx.drawImage(menuArena, -off, 0);
  ctx.drawImage(menuArena, W - off, 0);
  dim(0.6);

  // Title
  const title = 'PIXEL SIEGE';
  const x0 = W / 2 - Math.floor(textWidth(title, 3) / 2);
  drawText(ctx, 'PIXEL', x0, 16, '#ffcd75', 3, 'left', '#1a1c2c');
  drawText(ctx, 'SIEGE', x0 + 6 * 6 * 3, 16, '#ef7d57', 3, 'left', '#1a1c2c');
  drawText(ctx, 'A RETRO TOP-DOWN SHOOTER', W / 2, 40, '#94b0c2', 1, 'center');
  drawText(ctx, 'BY NEWBIE-1010', W / 2, 50, '#ef7d57', 1, 'center', '#1a1c2c');

  // Hero, walking in place, gun tracking the mouse
  const hx = 52, hy = 96;
  drawShadow(ctx, hx, hy + 21, 26);
  drawSprite(ctx, SPR.player.down[Math.floor(G.time * 6) % 4], hx, hy, { scale: 3 });
  drawGunAt(hx, hy + 9, Math.atan2(Input.my - (hy + 9), Input.mx - hx), 3);

  // Enemy roster
  const roster = [['slime', 250, 104], ['bat', 280, 84], ['skeleton', 300, 108]];
  for (const [type, x, y] of roster) {
    const frames = SPR[type];
    const fr = frames[Math.floor(G.time * ENEMY_DEFS[type].fps) % frames.length];
    const bob = type === 'bat' ? Math.round(Math.sin(G.time * 4) * 3) : 0;
    drawSprite(ctx, fr, x, y + bob, { scale: 2, flip: true });
  }

  drawOptions(menuItems(), 70);

  drawText(ctx, 'ARROWS / WASD: MOVE    MOUSE: AIM', W / 2, 130, '#94b0c2', 1, 'center');
  drawText(ctx, 'CLICK OR HOLD: SHOOT    P: PAUSE    M: SOUND', W / 2, 140, '#94b0c2', 1, 'center');
  drawText(ctx, 'HI SCORE ' + Save.data.hi, W / 2, 162, '#ffcd75', 1, 'center', '#1a1c2c');
  drawText(ctx, 'V' + VERSION, W - 4, H - 8, '#566c86', 1, 'right');
}

function drawWorld() {
  ctx.save();
  if (G.shake > 0) {
    ctx.translate(Math.round(rand(-G.shake, G.shake)), Math.round(rand(-G.shake, G.shake)));
  }
  ctx.drawImage(G.arena, 0, 0);
  for (const h of G.pickups) h.draw(ctx);

  const actors = G.enemies.slice();
  if (!G.player.dead) actors.push(G.player);
  actors.sort((a, b) => a.y - b.y);
  for (const a of actors) a.drawShadow(ctx);
  for (const a of actors) a.draw(ctx, G.time);

  for (const b of G.bullets) b.draw(ctx, G.time);
  for (const pt of G.particles) pt.draw(ctx);
  for (const pp of G.popups) pp.draw(ctx);
  ctx.restore();

  if (G.hurtFlash > 0) {
    ctx.fillStyle = 'rgba(228, 59, 68, ' + G.hurtFlash + ')';
    ctx.fillRect(0, 0, W, H);
  }
}

function drawHUD() {
  ctx.fillStyle = 'rgba(16, 18, 30, 0.88)';
  ctx.fillRect(0, 0, W, HUD_H);
  drawText(ctx, 'LV' + G.level, 4, 4, '#ffcd75');
  const p = G.player;
  for (let i = 0; i < p.maxHp; i++) drawSprite(ctx, i < p.hp ? SPR.heart : SPR.heartEmpty, 32 + i * 8, 6);
  const goal = G.def.boss ? 'DEFEAT THE WARLORD' : 'KILLS ' + Math.min(G.kills, G.def.kills) + '/' + G.def.kills;
  drawText(ctx, goal, W / 2 + 10, 4, '#f4f4f4', 1, 'center');
  drawText(ctx, 'SCORE ' + G.score, W - 4, 4, '#f4f4f4', 1, 'right');

  const boss = G.boss;
  if (boss && !boss.dead && boss.state !== 'enter') {
    const bw = 200, bx = (W - bw) / 2, by = H - 8;
    drawText(ctx, 'THE WARLORD', W / 2, by - 8, '#ff4d6d', 1, 'center', '#1a1c2c');
    ctx.fillStyle = '#1a1c2c'; ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
    ctx.fillStyle = '#3a3f55'; ctx.fillRect(bx, by, bw, 4);
    ctx.fillStyle = boss.hp < boss.maxHp / 2 ? '#ff004d' : '#b13e53';
    ctx.fillRect(bx, by, Math.round(bw * boss.hp / boss.maxHp), 4);
  }
}

function drawCrosshair() {
  const x = Math.round(Input.mx), y = Math.round(Input.my);
  const segs = [[x - 5, y, 3, 1], [x + 3, y, 3, 1], [x, y - 5, 1, 3], [x, y + 3, 1, 3], [x, y, 1, 1]];
  ctx.fillStyle = '#1a1c2c';
  for (const [sx, sy, w, h] of segs) ctx.fillRect(sx - 1, sy - 1, w + 2, h + 2);
  ctx.fillStyle = G.state === 'PLAYING' ? '#ffffff' : '#ffcd75';
  for (const [sx, sy, w, h] of segs) ctx.fillRect(sx, sy, w, h);
}

function render() {
  G.optRects = G.state === 'MENU' || G.state === 'GAMEOVER' ? G.optRects : [];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1a1c2c';
  ctx.fillRect(0, 0, W, H);

  if (G.state === 'MENU') {
    drawMenu();
  } else {
    drawWorld();
    drawHUD();

    if (G.state === 'INTRO') {
      dim(0.45);
      drawText(ctx, 'LEVEL ' + G.level, W / 2, 50, '#ffcd75', 3, 'center', '#1a1c2c');
      drawText(ctx, G.def.name, W / 2, 76, '#f4f4f4', 2, 'center', '#1a1c2c');
      const goal = G.def.boss ? 'DEFEAT THE WARLORD' : 'DEFEAT ' + G.def.kills + ' ENEMIES';
      drawText(ctx, goal, W / 2, 98, '#c2c8d4', 1, 'center', '#1a1c2c');
      if (blink(3)) drawText(ctx, 'GET READY', W / 2, 118, '#a7f070', 1, 'center', '#1a1c2c');
    } else if (G.state === 'PAUSED') {
      dim(0.6);
      drawText(ctx, 'PAUSED', W / 2, 60, '#ffcd75', 3, 'center', '#1a1c2c');
      drawText(ctx, 'P OR ESC: RESUME', W / 2, 92, '#f4f4f4', 1, 'center');
      drawText(ctx, 'Q: QUIT TO MENU', W / 2, 104, '#f4f4f4', 1, 'center');
      drawText(ctx, 'M: SOUND ' + (SFX.muted ? 'OFF' : 'ON'), W / 2, 116, '#94b0c2', 1, 'center');
    } else if (G.state === 'CLEAR') {
      dim(0.35);
      drawText(ctx, 'LEVEL CLEAR!', W / 2, 54, '#a7f070', 3, 'center', '#1a1c2c');
      drawText(ctx, 'HEART BONUS +' + G.bonus, W / 2, 84, '#ffcdd2', 1, 'center', '#1a1c2c');
      const next = G.level < LEVELS.length ? 'NEXT: ' + LEVELS[G.level].name : 'THE WARLORD HAS FALLEN';
      drawText(ctx, next, W / 2, 98, '#f4f4f4', 1, 'center', '#1a1c2c');
    } else if (G.state === 'GAMEOVER') {
      dim(0.6);
      drawText(ctx, 'GAME OVER', W / 2, 46, '#ff4d6d', 3, 'center', '#1a1c2c');
      drawText(ctx, 'SCORE ' + G.score, W / 2, 72, '#f4f4f4', 1, 'center');
      if (G.newHi && blink(3)) drawText(ctx, 'NEW HI SCORE!', W / 2, 84, '#ffcd75', 1, 'center');
      drawOptions(gameOverItems(), 104);
    } else if (G.state === 'VICTORY') {
      dim(0.55);
      for (const pt of G.particles) pt.draw(ctx);
      drawText(ctx, 'VICTORY!', W / 2, 40, '#ffcd75', 3, 'center', '#1a1c2c');
      drawText(ctx, 'THE WARLORD IS DEFEATED', W / 2, 66, '#f4f4f4', 1, 'center', '#1a1c2c');
      drawText(ctx, 'FINAL SCORE ' + G.score, W / 2, 86, '#f4f4f4', 1, 'center', '#1a1c2c');
      drawText(ctx, 'HI SCORE ' + Save.data.hi, W / 2, 98, '#ffcd75', 1, 'center', '#1a1c2c');
      drawText(ctx, 'A GAME BY NEWBIE-1010', W / 2, 110, '#ef7d57', 1, 'center', '#1a1c2c');
      if (G.timer <= 0 && blink(2)) drawText(ctx, 'CLICK OR PRESS ENTER FOR MENU', W / 2, 124, '#a7f070', 1, 'center', '#1a1c2c');
    }
  }
  drawCrosshair();
}

// ---------- Main loop (fixed 60 Hz steps) ----------
const STEP = 1 / 60;
let last = performance.now();
let acc = 0;
function loop(now) {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    update(STEP);
    Input.endStep();
    acc -= STEP;
  }
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
