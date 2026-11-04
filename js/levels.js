// Pixel Siege (c) 2026 newbie-1010. All rights reserved.
// Level table and the floor painter for each level's theme.
//
// kills:    enemies to defeat to clear the level
// interval: average seconds between spawns
// maxAlive: most enemies on screen at once
// speed:    multiplier on every enemy's movement speed
// mix:      relative weights for which enemy type spawns
// boss:     true for the final level (the Warlord replaces the normal spawner)

const LEVELS = [
  { name: 'GRASS FIELD', theme: 'grass',  kills: 12, interval: 1.5,  maxAlive: 5,  speed: 1.0,  mix: { slime: 1 } },
  { name: 'DARK FOREST', theme: 'forest', kills: 18, interval: 1.2,  maxAlive: 7,  speed: 1.05, mix: { slime: 2, bat: 1 } },
  { name: 'OLD CRYPT',   theme: 'crypt',  kills: 22, interval: 1.05, maxAlive: 8,  speed: 1.1,  mix: { slime: 1, bat: 1, skeleton: 1 } },
  { name: 'LAVA CAVE',   theme: 'lava',   kills: 26, interval: 0.9,  maxAlive: 9,  speed: 1.15, mix: { slime: 1, bat: 1, skeleton: 1, brute: 1 } },
  { name: 'THE HORDE',   theme: 'waste',  kills: 34, interval: 0.6,  maxAlive: 13, speed: 1.25, mix: { slime: 2, bat: 2, skeleton: 2, brute: 1 } },
  { name: 'THRONE ROOM', theme: 'throne', boss: true, maxAlive: 6, speed: 1.15 },
];

const THEMES = {
  grass:  { a: '#3e9d4f', b: '#43a454', specks: ['#2f7d3e', '#5cc46a', '#368f47'] },
  forest: { a: '#2b6b4a', b: '#2e7150', specks: ['#1f4f38', '#3f8a5e', '#245c40'] },
  crypt:  { a: '#4a5468', b: '#505b70', specks: ['#3d4558', '#5c6880'] },
  lava:   { a: '#3b2b2b', b: '#402f2e', specks: ['#2a1f1f', '#5a4040'] },
  waste:  { a: '#8a6a44', b: '#917049', specks: ['#6e5235', '#b08a5a', '#7c5e3c'] },
  throne: { a: '#3f2a4f', b: '#4a3360', specks: ['#35233f'] },
};

// Small seeded random generator so each level's floor looks the same every time.
function seeded(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function crack(g, r, x, y, len, color, glow) {
  let dx = r() < 0.5 ? 1 : -1;
  for (let i = 0; i < len; i++) {
    g.fillStyle = glow && r() < 0.25 ? glow : color;
    g.fillRect(x, y, 1, 1);
    x += dx;
    const v = r();
    if (v < 0.3) y += 1; else if (v < 0.6) y -= 1;
    if (r() < 0.08) dx = -dx;
  }
}

function buildArena(themeKey, seed) {
  const th = THEMES[themeKey];
  const r = seeded(seed);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const T = 16;

  // Checker tiles
  for (let ty = 0; ty < H / T + 1; ty++) {
    for (let tx = 0; tx < W / T; tx++) {
      g.fillStyle = (tx + ty) % 2 ? th.a : th.b;
      g.fillRect(tx * T, ty * T, T, T);
    }
  }
  // Specks
  for (let i = 0; i < 260; i++) {
    g.fillStyle = th.specks[Math.floor(r() * th.specks.length)];
    const s = r() < 0.8 ? 1 : 2;
    g.fillRect(Math.floor(r() * W), Math.floor(r() * H), s, s);
  }

  const px = (x, y, col, w, h) => { g.fillStyle = col; g.fillRect(x, y, w || 1, h || 1); };

  if (themeKey === 'grass') {
    for (let i = 0; i < 70; i++) { // grass tufts
      const x = Math.floor(r() * W), y = Math.floor(r() * H);
      px(x, y, '#2f7d3e'); px(x + 2, y, '#2f7d3e'); px(x + 1, y + 1, '#2f7d3e');
    }
    for (let i = 0; i < 28; i++) { // flowers
      const x = Math.floor(r() * W), y = Math.floor(r() * H);
      const petal = ['#f4f4f4', '#ffcd75', '#ef7d57'][Math.floor(r() * 3)];
      px(x, y - 1, petal); px(x - 1, y, petal); px(x + 1, y, petal); px(x, y + 1, petal); px(x, y, '#ffcd75');
    }
  } else if (themeKey === 'forest') {
    for (let i = 0; i < 14; i++) { // dark patches of undergrowth
      let x = Math.floor(r() * W), y = Math.floor(r() * H);
      for (let k = 0; k < 40; k++) { px(x, y, '#1f4f38', 2, 2); x += Math.floor(r() * 3) - 1; y += Math.floor(r() * 3) - 1; }
    }
    for (let i = 0; i < 70; i++) px(Math.floor(r() * W), Math.floor(r() * H), r() < 0.5 ? '#c4703a' : '#8f563b', 2, 1); // leaves
  } else if (themeKey === 'crypt') {
    g.fillStyle = '#363d4d';
    for (let x = 0; x < W; x += T) g.fillRect(x, 0, 1, H);
    for (let y = 0; y < H; y += T) g.fillRect(0, y, W, 1);
    for (let i = 0; i < 16; i++) crack(g, r, Math.floor(r() * W), Math.floor(r() * H), 10 + Math.floor(r() * 14), '#2e3442');
    for (let i = 0; i < 10; i++) { // scattered bones
      const x = Math.floor(r() * W), y = Math.floor(r() * H);
      px(x, y, '#c2c8d4', 4, 1); px(x - 1, y - 1, '#c2c8d4'); px(x - 1, y + 1, '#c2c8d4'); px(x + 4, y - 1, '#c2c8d4'); px(x + 4, y + 1, '#c2c8d4');
    }
  } else if (themeKey === 'lava') {
    for (let i = 0; i < 22; i++) crack(g, r, Math.floor(r() * W), Math.floor(r() * H), 18 + Math.floor(r() * 30), '#ef7d57', '#ffcd75');
    for (let i = 0; i < 40; i++) px(Math.floor(r() * W), Math.floor(r() * H), '#5a4040', 3, 2);
  } else if (themeKey === 'waste') {
    for (let i = 0; i < 30; i++) { // rocks
      const x = Math.floor(r() * W), y = Math.floor(r() * H);
      px(x, y, '#5c4430', 4, 3); px(x, y, '#b08a5a', 3, 1);
    }
    for (let i = 0; i < 40; i++) { // dead grass
      const x = Math.floor(r() * W), y = Math.floor(r() * H);
      px(x, y, '#c9a46a'); px(x + 2, y - 1, '#c9a46a'); px(x + 1, y + 1, '#c9a46a');
    }
  } else if (themeKey === 'throne') {
    const cx = W / 2, half = 26;
    px(cx - half, 0, '#8f2a3c', half * 2, H);              // red carpet
    px(cx - half + 2, 0, '#ffcd75', 1, H);                  // gold trim
    px(cx + half - 3, 0, '#ffcd75', 1, H);
    for (let y = 6; y < H; y += 12) px(cx - 2, y, '#b13e53', 4, 4); // carpet pattern
    for (const x of [40, W - 48]) {                          // pillars
      for (const y of [30, 110]) {
        px(x, y, '#1a1c2c', 10, 26); px(x + 1, y, '#94b0c2', 8, 25); px(x + 1, y, '#c2c8d4', 3, 25);
      }
    }
  }

  // Darken the edges a little so the play area reads as an arena.
  g.fillStyle = 'rgba(0, 0, 0, 0.22)';
  g.fillRect(0, 0, 4, H); g.fillRect(W - 4, 0, 4, H);
  g.fillRect(0, H - 4, W, 4); g.fillRect(0, HUD_H, W, 3);
  return c;
}
