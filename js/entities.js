// Player, enemies, bullets, particles, score popups and heart pickups.

const ENEMY_DEFS = {
  slime:    { hp: 2,   speed: 22, r: 5,  score: 10,   fps: 4 },
  bat:      { hp: 1,   speed: 46, r: 5,  score: 15,   fps: 10 },
  skeleton: { hp: 3,   speed: 28, r: 5,  score: 25,   fps: 6 },
  brute:    { hp: 8,   speed: 17, r: 7,  score: 50,   fps: 4 },
  boss:     { hp: 140, speed: 16, r: 14, score: 1000, fps: 3, scale: 2 },
};

class Player {
  constructor(x, y) {
    this.x = x; this.y = y; this.r = 4;
    this.maxHp = 5; this.hp = 5;
    this.speed = 74;
    this.aim = 0;        // radians, toward the mouse
    this.cool = 0;       // seconds until the gun can fire again
    this.inv = 0;        // invulnerability after a hit
    this.anim = 0;
    this.moving = false;
    this.recoil = 0;
    this.muzzle = 0;
    this.kx = 0; this.ky = 0; // knockback velocity
    this.dead = false;
  }

  update(dt, canMove) {
    let dx = 0, dy = 0;
    if (canMove) {
      if (Input.down('ArrowLeft', 'KeyA')) dx -= 1;
      if (Input.down('ArrowRight', 'KeyD')) dx += 1;
      if (Input.down('ArrowUp', 'KeyW')) dy -= 1;
      if (Input.down('ArrowDown', 'KeyS')) dy += 1;
    }
    const len = Math.hypot(dx, dy);
    if (len) { dx /= len; dy /= len; } // diagonal is no faster than straight
    this.moving = len > 0;
    this.x += (dx * this.speed + this.kx) * dt;
    this.y += (dy * this.speed + this.ky) * dt;
    const decay = Math.pow(0.002, dt);
    this.kx *= decay; this.ky *= decay;
    this.x = clamp(this.x, ARENA.x0, ARENA.x1);
    this.y = clamp(this.y, ARENA.y0, ARENA.y1);

    this.aim = Math.atan2(Input.my - (this.y + GUN_Y), Input.mx - this.x);
    this.anim = this.moving ? this.anim + dt : 0;
    this.cool -= dt;
    this.inv -= dt;
    this.muzzle -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 8);
  }

  muzzlePos() {
    return { x: this.x + Math.cos(this.aim) * 12, y: this.y + GUN_Y + Math.sin(this.aim) * 12 };
  }

  facing() {
    const s = Math.sin(this.aim), c = Math.cos(this.aim);
    if (s > 0.6) return { set: 'down', flip: false };
    if (s < -0.6) return { set: 'up', flip: false };
    return { set: 'side', flip: c < 0 };
  }

  drawShadow(ctx) { drawShadow(ctx, this.x, this.y + 7, 10); }

  drawGun(ctx) {
    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y + GUN_Y));
    ctx.rotate(this.aim);
    if (Math.cos(this.aim) < 0) ctx.scale(1, -1); // keep the gun upright when aiming left
    const k = -Math.round(this.recoil * 2);
    ctx.drawImage(SPR.gun.img, -2 + k, -3);
    if (this.muzzle > 0) ctx.drawImage(SPR.flash.img, 11 + k, -3);
    ctx.restore();
  }

  draw(ctx, time) {
    if (this.inv > 0 && Math.floor(this.inv * 16) % 2 === 0) return; // flicker while invulnerable
    const f = this.facing();
    const frames = SPR.player[f.set];
    const fr = this.moving ? frames[Math.floor(this.anim * 10) % 4] : frames[0];
    const bob = !this.moving && Math.floor(time * 2) % 2 ? -1 : 0;
    if (f.set === 'up') this.drawGun(ctx); // gun is in front of the body unless facing away
    drawSprite(ctx, fr, this.x, this.y + bob, { flip: f.flip });
    if (f.set !== 'up') this.drawGun(ctx);
  }
}

class Enemy {
  constructor(type, x, y, speedMult, minion) {
    const d = ENEMY_DEFS[type];
    this.type = type;
    this.x = x; this.y = y; this.r = d.r;
    this.hp = d.hp; this.maxHp = d.hp;
    this.speed = d.speed * (speedMult || 1);
    this.score = d.score;
    this.frames = SPR[type];
    this.fps = d.fps;
    this.scale = d.scale || 1;
    this.minion = !!minion;
    this.t = Math.random() * 10;
    this.flash = 0;
    this.kx = 0; this.ky = 0;
    this.entered = false;   // true once fully inside the arena
    this.left = false;      // facing left
    this.dead = false;
    this.state = type === 'boss' ? 'enter' : 'chase';
    this.timer = 0;
    this.cool = type === 'skeleton' ? rand(1.2, 2.2) : 1.5;
    this.spawnCool = 5;
    this.pattern = 0;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.cx = 0; this.cy = 0; // charge direction
  }

  update(dt, game) {
    const p = game.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;     // toward the player
    const px = -uy, py = ux;            // sideways
    let mx = 0, my = 0;
    this.t += dt;
    this.flash -= dt;
    this.cool -= dt;

    switch (this.type) {
      case 'slime': {
        const hop = 0.5 + 0.5 * Math.max(0, Math.sin(this.t * 6));
        mx = ux * this.speed * hop * 1.4; my = uy * this.speed * hop * 1.4;
        break;
      }
      case 'bat': {
        const weave = Math.sin(this.t * 5) * 0.9;
        mx = (ux + px * weave) * this.speed; my = (uy + py * weave) * this.speed;
        break;
      }
      case 'skeleton': {
        const want = 80;
        const m = d > want + 12 ? 1 : d < want - 12 ? -0.8 : 0;
        if (Math.random() < dt * 0.4) this.dir = -this.dir;
        mx = (ux * m + px * this.dir * 0.6) * this.speed;
        my = (uy * m + py * this.dir * 0.6) * this.speed;
        if (this.cool <= 0 && this.entered && !p.dead) {
          game.enemyShoot(this.x, this.y, Math.atan2(dy, dx), 75);
          SFX.play('enemyShoot');
          this.cool = rand(1.8, 2.8);
        }
        break;
      }
      case 'brute': {
        if (this.state === 'chase') {
          mx = ux * this.speed; my = uy * this.speed;
          if (d < 100 && this.cool <= 0 && this.entered) {
            this.state = 'windup'; this.timer = 0.6;
            SFX.play('charge');
          }
        } else if (this.state === 'windup') {
          this.timer -= dt;
          if (this.timer <= 0) { this.state = 'charge'; this.timer = 0.55; this.cx = ux; this.cy = uy; }
        } else if (this.state === 'charge') {
          mx = this.cx * this.speed * 7.5; my = this.cy * this.speed * 7.5;
          this.timer -= dt;
          if (this.timer <= 0) { this.state = 'rest'; this.timer = 0.6; }
        } else {
          this.timer -= dt;
          if (this.timer <= 0) { this.state = 'chase'; this.cool = rand(1.5, 2.5); }
        }
        break;
      }
      case 'boss': {
        if (this.state === 'enter') {
          my = 30;
          if (this.y >= 42) { this.state = 'fight'; this.cool = 1.2; }
          break;
        }
        if (d > 60) { mx = ux * this.speed; my = uy * this.speed; }
        else { mx = px * this.speed * this.dir; my = py * this.speed * this.dir; }
        const enraged = this.hp < this.maxHp / 2;
        if (this.cool <= 0 && !p.dead) {
          this.pattern = (this.pattern + 1) % 3;
          const base = Math.atan2(dy, dx);
          if (this.pattern === 0) {           // ring
            const n = enraged ? 16 : 12;
            for (let i = 0; i < n; i++) game.enemyShoot(this.x, this.y, this.t + i * Math.PI * 2 / n, 55);
          } else if (this.pattern === 1) {    // aimed fan
            for (let k = -2; k <= 2; k++) game.enemyShoot(this.x, this.y, base + k * 0.22, 85);
          } else {                            // fast ring aimed through the player
            const n = enraged ? 10 : 8;
            for (let i = 0; i < n; i++) game.enemyShoot(this.x, this.y, base + i * Math.PI * 2 / n, 70);
          }
          SFX.play('enemyShoot');
          this.cool = enraged ? 1.3 : 2.0;
        }
        this.spawnCool -= dt;
        if (this.spawnCool <= 0) {
          game.spawnMinions(enraged ? 3 : 2);
          this.spawnCool = enraged ? 4.5 : 6.5;
        }
        break;
      }
    }

    this.x += (mx + this.kx) * dt;
    this.y += (my + this.ky) * dt;
    const decay = Math.pow(0.002, dt);
    this.kx *= decay; this.ky *= decay;

    if (!this.entered && this.x > this.r && this.x < W - this.r && this.y > HUD_H + this.r && this.y < H - this.r) {
      this.entered = true;
    }
    if (this.entered) {
      this.x = clamp(this.x, this.r, W - this.r);
      this.y = clamp(this.y, HUD_H + this.r, H - this.r);
    }
    if (Math.abs(dx) > 1) this.left = dx < 0;
  }

  frame() { return this.frames[Math.floor(this.t * this.fps) % this.frames.length]; }

  drawShadow(ctx) {
    const fr = this.frame();
    const lift = this.type === 'bat' ? 4 : 0; // bats fly, so their shadow sits lower
    drawShadow(ctx, this.x, this.y + fr.h * this.scale / 2 + lift, this.r * 2 + 2);
  }

  draw(ctx, time) {
    const fr = this.frame();
    let ox = 0;
    if (this.state === 'windup') ox = Math.floor(time * 30) % 2 ? 1 : -1;
    const blink = this.state === 'windup' && Math.floor(time * 12) % 2 === 0;
    drawSprite(ctx, fr, this.x + ox, this.y, { flip: this.left, white: this.flash > 0 || blink, scale: this.scale });
  }
}

class Bullet {
  constructor(x, y, vx, vy, enemy) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.enemy = enemy;
    this.life = enemy ? 6 : 1.5;
    this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0 || this.x < -8 || this.x > W + 8 || this.y < HUD_H - 8 || this.y > H + 8) this.dead = true;
  }
  draw(ctx, time) {
    const x = Math.round(this.x), y = Math.round(this.y);
    if (this.enemy) {
      ctx.fillStyle = '#1a1c2c'; ctx.fillRect(x - 2, y - 2, 5, 5);
      ctx.fillStyle = '#ff4d6d'; ctx.fillRect(x - 1, y - 1, 3, 3);
      if (Math.floor(time * 20) % 2) { ctx.fillStyle = '#ffcdd2'; ctx.fillRect(x, y, 1, 1); }
    } else {
      ctx.fillStyle = '#ef7d57';
      ctx.fillRect(Math.round(this.x - this.vx * 0.02), Math.round(this.y - this.vy * 0.02), 2, 2);
      ctx.fillStyle = '#ffcd75'; ctx.fillRect(x - 1, y - 1, 3, 3);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1);
    }
  }
}

class Particle {
  constructor(x, y, vx, vy, life, color, size) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.max = life; this.color = color; this.size = size;
    this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    const f = Math.pow(0.05, dt);
    this.vx *= f; this.vy *= f;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    const s = Math.max(1, Math.round(this.size * (this.life / this.max)));
    ctx.fillStyle = this.color;
    ctx.fillRect(Math.round(this.x), Math.round(this.y), s, s);
  }
}

class Popup {
  constructor(x, y, text, color) {
    this.x = x; this.y = y; this.text = text; this.color = color;
    this.life = 0.9; this.dead = false;
  }
  update(dt) {
    this.y -= 18 * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) { drawText(ctx, this.text, this.x, this.y, this.color, 1, 'center', '#1a1c2c'); }
}

class Pickup {
  constructor(x, y) {
    this.x = x; this.y = y; this.life = 8; this.t = 0; this.dead = false;
  }
  update(dt) {
    this.t += dt; this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    if (this.life < 2 && Math.floor(this.life * 8) % 2) return; // blink before vanishing
    drawShadow(ctx, this.x, this.y + 5, 6);
    drawSprite(ctx, SPR.heart, this.x, this.y + Math.round(Math.sin(this.t * 5)));
  }
}
