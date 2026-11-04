// Pixel Siege (c) 2026 newbie-1010. All rights reserved.
// Shared constants and tiny helpers used by every other script.

// Release version, shown on the menu. Bump it for every published build.
const VERSION = '1.0.0';

// Internal resolution. The canvas is scaled up by whole-number steps in game.js.
const W = 320;
const H = 180;
const HUD_H = 12; // height of the top status bar

// Where the player is allowed to walk.
const ARENA = { x0: 6, y0: HUD_H + 8, x1: W - 6, y1: H - 8 };

// Vertical offset from the player's center to the gun's pivot (the hands).
const GUN_Y = 3;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
