// Pixel-art sprites and the 5x5 pixel font.
// Every sprite is a grid of characters. Each character maps to a palette color,
// and '.' (or any character missing from the palette) is transparent.
// buildSprite() turns a grid into an offscreen canvas once, at startup.

function buildSprite(rows, palette) {
  const w = Math.max(...rows.map(r => r.length));
  const h = rows.length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = palette[row[x]];
      if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
    }
  });
  return c;
}

// Same shape, solid white: used for the hit flash.
function whiteOf(src) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

function makeFrame(rows, palette) {
  const img = buildSprite(rows, palette);
  return { img, white: whiteOf(img), w: img.width, h: img.height };
}

// Draws a frame centered on (cx, cy). opts: { flip, white, scale }
function drawSprite(ctx, fr, cx, cy, opts) {
  const o = opts || {};
  const s = o.scale || 1;
  const img = o.white ? fr.white : fr.img;
  const w = fr.w * s, h = fr.h * s;
  const x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
  if (o.flip) {
    ctx.save();
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(img, x, y, w, h);
  }
}

// Soft oval shadow under a character.
function drawShadow(ctx, x, y, w) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w);
  ctx.fillStyle = 'rgba(8, 10, 20, 0.3)';
  ctx.fillRect(x - Math.floor(w / 2) + 1, y - 1, w - 2, 1);
  ctx.fillRect(x - Math.floor(w / 2), y, w, 1);
  ctx.fillRect(x - Math.floor(w / 2) + 1, y + 1, w - 2, 1);
}

const SPR = {};

// ---------- Player (12 x 14) ----------
const PLAYER_PAL = {
  k: '#1a1c2c', // outline
  h: '#8a4b2b', // hair
  s: '#f4c79a', // skin
  w: '#ffffff', // eye white
  e: '#1a1c2c', // pupil
  b: '#3b8bd9', // jacket
  B: '#29366f', // belt / jacket shade
  p: '#333c57', // trousers
  o: '#6b4226', // boots
};

const PLAYER_FRONT = [
  '...kkkkkk...',
  '..khhhhhhk..',
  '.khhhhhhhhk.',
  '.khsssssshk.',
  '.kswesswesk.',
  '.kssssssssk.',
  '..kkkkkkkk..',
  '.kbbbbbbbbk.',
  'ksbbbbbbbbsk',
  '.kBBBBBBBBk.',
  '.kppppppppk.',
];

const PLAYER_BACK = PLAYER_FRONT.slice(0, 3).concat([
  '.khhhhhhhhk.',
  '.khhhhhhhhk.',
  '.kkhhhhhhkk.',
]).concat(PLAYER_FRONT.slice(6));

const PLAYER_SIDE = [
  '...kkkkk....',
  '..khhhhhk...',
  '.khhhhhhhk..',
  '.khhhsssssk.',
  '.khhssssek..',
  '.khsssssssk.',
  '..kkssssskk.',
  '...kbbbbbk..',
  '...kbbsbbk..',
  '...kBBBBBk..',
  '...kpppppk..',
];

const LEGS = {
  front:  ['..kpk..kpk..', '..kok..kok..', '..kkk..kkk..'],
  frontL: ['..kpk..kpk..', '..kkk..kok..', '.......kkk..'],
  frontR: ['..kpk..kpk..', '..kok..kkk..', '..kkk.......'],
  side:   ['...kpk.kpk..', '...kok.kok..', '...kkk.kkk..'],
  sideStep: ['..kpk...kpk.', '.kok....kok.', '.kkk....kkk.'],
};

SPR.player = {
  down: [LEGS.front, LEGS.frontL, LEGS.front, LEGS.frontR].map(l => makeFrame(PLAYER_FRONT.concat(l), PLAYER_PAL)),
  up:   [LEGS.front, LEGS.frontR, LEGS.front, LEGS.frontL].map(l => makeFrame(PLAYER_BACK.concat(l), PLAYER_PAL)),
  side: [LEGS.side, LEGS.sideStep, LEGS.side, LEGS.sideStep].map(l => makeFrame(PLAYER_SIDE.concat(l), PLAYER_PAL)),
};

// Gun, drawn rotated toward the mouse. The grip sits at (2, 4).
SPR.gun = makeFrame([
  '..kkkkkkkkk.',
  '.kGllllllllk',
  '.kGGGGGGGGGk',
  'kbbkkkkkkkk.',
  'kbbk........',
  'kkk.........',
], { k: '#1a1c2c', G: '#566c86', l: '#94b0c2', b: '#6b4226' });

SPR.flash = makeFrame([
  '.yy.',
  'yWWy',
  'yWWy',
  '.yy.',
], { y: '#ffcd75', W: '#ffffff' });

// ---------- Hearts (7 x 6) ----------
const HEART = [
  '.kk.kk.',
  'krwkrrk',
  'krrrrrk',
  '.krrrk.',
  '..krk..',
  '...k...',
];
SPR.heart = makeFrame(HEART, { k: '#1a1c2c', r: '#e43b44', w: '#ffcdd2' });
SPR.heartEmpty = makeFrame(HEART, { k: '#1a1c2c', r: '#3a3f55', w: '#4d556d' });

// ---------- Enemies ----------
const SLIME_PAL = { k: '#1a1c2c', g: '#38b764', G: '#257179', l: '#a7f070', w: '#ffffff', e: '#1a1c2c' };
SPR.slime = [
  [
    '....kkkk....',
    '..kkllggkk..',
    '.kgllgggggk.',
    '.kgweggwegk.',
    'kgggggggggGk',
    'kGgggggggGGk',
    '.kGGGGGGGGk.',
    '..kkkkkkkk..',
  ],
  [
    '............',
    '...kkkkkk...',
    '.kkllgggggk.',
    'kglweggweggk',
    'kgggggggggGk',
    'kGGgggggGGGk',
    '.kkkkkkkkkk.',
    '............',
  ],
].map(r => makeFrame(r, SLIME_PAL));

const BAT_PAL = { k: '#1a1c2c', p: '#5d275d', q: '#8b4f9e', r: '#ff5a5a' };
SPR.bat = [
  [
    'kk..........kk',
    'kqk...kk...kqk',
    'kqqk.kppk.kqqk',
    '.kqqkprrpkqqk.',
    '..kqkppppkqk..',
    '...k.kppk.k...',
    '......kk......',
  ],
  [
    '..............',
    '......kk......',
    '.....kppk.....',
    '..kkkprrpkkk..',
    '.kqqqkppkqqqk.',
    'kqqk..kk..kqqk',
    'kk..........kk',
  ],
].map(r => makeFrame(r, BAT_PAL));

const SKEL_PAL = { k: '#1a1c2c', w: '#f4f4f4', W: '#94b0c2', r: '#e43b44' };
const SKEL_TOP = [
  '..kkkkkk..',
  '.kwwwwwwk.',
  '.kwrwwrwk.',
  '.kwwwwwwk.',
  '.kwkwkwk..',
  '..kkkkk...',
  '..kWwwWk..',
  '.kwkwwkwk.',
  '.kwWwwWwk.',
  '..kwwwwk..',
];
SPR.skeleton = [
  ['..kw..wk..', '..kw..wk..', '..kk..kk..'],
  ['..kw..wk..', '.kw....wk.', '.kk....kk.'],
].map(legs => makeFrame(SKEL_TOP.concat(legs), SKEL_PAL));

const BRUTE_TOP = [
  '....kkkkkkkk....',
  '...krrrrrrrrk...',
  '..krrrrrrrrrrk..',
  '..kryykrrkyyrk..',
  '..krrrrrrrrrrk..',
  '..krwkrrrrkwrk..',
  '.kkrrkkkkkkrrkk.',
  'kooRrrrrrrrrRook',
  'kooRrrrrrrrrRook',
  'kookRrrrrrrRkook',
  '.kk.kRRRRRRk.kk.',
  '....kRRkkRRk....',
];
const BRUTE_LEGS = [
  ['....kRk..kRk....', '....kkk..kkk....'],
  ['...kRk....kRk...', '...kkk....kkk...'],
];
const BRUTE_PAL = { k: '#1a1c2c', r: '#b13e53', R: '#73172d', o: '#ef7d57', y: '#ffcd75', w: '#f4f4f4' };
SPR.brute = BRUTE_LEGS.map(legs => makeFrame(BRUTE_TOP.concat(legs), BRUTE_PAL));

// The boss is the brute with a crown and a royal palette, drawn at 2x.
const BOSS_PAL = { k: '#1a1c2c', r: '#5d275d', R: '#2f1a3a', o: '#8b4f9e', y: '#ff004d', w: '#f4f4f4', c: '#ffcd75' };
const CROWN = [
  '....c..cc..c....',
  '....cccccccc....',
];
SPR.boss = BRUTE_LEGS.map(legs => makeFrame(CROWN.concat(BRUTE_TOP, legs), BOSS_PAL));

// ---------- 5x5 pixel font ----------
const FONT = {
  A: '.###.|#...#|#####|#...#|#...#', B: '####.|#...#|####.|#...#|####.',
  C: '.####|#....|#....|#....|.####', D: '####.|#...#|#...#|#...#|####.',
  E: '#####|#....|####.|#....|#####', F: '#####|#....|####.|#....|#....',
  G: '.####|#....|#..##|#...#|.###.', H: '#...#|#...#|#####|#...#|#...#',
  I: '#####|..#..|..#..|..#..|#####', J: '..###|...#.|...#.|#..#.|.##..',
  K: '#...#|#..#.|###..|#..#.|#...#', L: '#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#...#|#...#', N: '#...#|##..#|#.#.#|#..##|#...#',
  O: '.###.|#...#|#...#|#...#|.###.', P: '####.|#...#|####.|#....|#....',
  Q: '.###.|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|####.|#..#.|#...#',
  S: '.####|#....|.###.|....#|####.', T: '#####|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|.###.', V: '#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#.#.#|##.##|#...#', X: '#...#|.#.#.|..#..|.#.#.|#...#',
  Y: '#...#|.#.#.|..#..|..#..|..#..', Z: '#####|...#.|..#..|.#...|#####',
  0: '.###.|#..##|#.#.#|##..#|.###.', 1: '..#..|.##..|..#..|..#..|.###.',
  2: '####.|....#|.###.|#....|#####', 3: '####.|....#|.###.|....#|####.',
  4: '#..#.|#..#.|#####|...#.|...#.', 5: '#####|#....|####.|....#|####.',
  6: '.###.|#....|####.|#...#|.###.', 7: '#####|....#|...#.|..#..|..#..',
  8: '.###.|#...#|.###.|#...#|.###.', 9: '.###.|#...#|.####|....#|.###.',
  ':': '.....|..#..|.....|..#..|.....', '/': '....#|...#.|..#..|.#...|#....',
  '!': '..#..|..#..|..#..|.....|..#..', '-': '.....|.....|.###.|.....|.....',
  '.': '.....|.....|.....|.....|..#..', '+': '.....|..#..|.###.|..#..|.....',
  '>': '.#...|..#..|...#.|..#..|.#...', '<': '...#.|..#..|.#...|..#..|...#.',
  ',': '.....|.....|.....|..#..|.#...', '?': '.###.|#...#|..##.|.....|..#..',
  "'": '..#..|..#..|.....|.....|.....',
};

const glyphCache = new Map();
function glyph(ch, color) {
  const key = ch + color;
  if (glyphCache.has(key)) return glyphCache.get(key);
  const def = FONT[ch];
  let c = null;
  if (def) c = buildSprite(def.split('|'), { '#': color });
  glyphCache.set(key, c);
  return c;
}

function textWidth(text, scale) {
  const s = scale || 1;
  return text.length ? (text.length * 6 - 1) * s : 0;
}

// align: 'left' | 'center' | 'right'. shadow: a color for a 1px drop shadow.
function drawText(ctx, text, x, y, color, scale, align, shadow) {
  const s = scale || 1;
  const str = String(text).toUpperCase();
  const w = textWidth(str, s);
  if (align === 'center') x -= Math.floor(w / 2);
  else if (align === 'right') x -= w;
  x = Math.round(x); y = Math.round(y);
  const pass = (col, ox, oy) => {
    for (let i = 0; i < str.length; i++) {
      const g = glyph(str[i], col);
      if (g) ctx.drawImage(g, x + ox + i * 6 * s, y + oy, 5 * s, 5 * s);
    }
  };
  if (shadow) pass(shadow, s, s);
  pass(color || '#ffffff', 0, 0);
}
