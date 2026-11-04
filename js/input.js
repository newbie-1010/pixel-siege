// Pixel Siege (c) 2026 newbie-1010. All rights reserved.
// Keyboard and mouse state.
// keys: codes held right now. pressed: codes that went down since the last game step.
// Mouse coordinates are converted to game pixels (0..W, 0..H) using the canvas's on-screen size.

const Input = {
  keys: new Set(),
  pressed: new Set(),
  mx: W / 2,
  my: H / 2,
  mouseDown: false,
  clicked: false,
  moved: false,
  onBlur: null,

  attach(canvas) {
    const blockScroll = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
    const toGame = e => {
      const r = canvas.getBoundingClientRect();
      this.mx = (e.clientX - r.left) * W / r.width;
      this.my = (e.clientY - r.top) * H / r.height;
    };

    addEventListener('keydown', e => {
      if (blockScroll.includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      SFX.init();
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
      if (this.onBlur) this.onBlur();
    });

    addEventListener('mousemove', e => { toGame(e); this.moved = true; });
    canvas.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      toGame(e);
      this.mouseDown = true;
      this.clicked = true;
      SFX.init();
    });
    addEventListener('mouseup', e => { if (e.button === 0) this.mouseDown = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  },

  down(...codes) { return codes.some(c => this.keys.has(c)); },
  hit(...codes) { return codes.some(c => this.pressed.has(c)); },

  // Called after every fixed game step so one press counts once.
  endStep() {
    this.pressed.clear();
    this.clicked = false;
    this.moved = false;
  },
};
