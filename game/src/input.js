// Keyboard and mouse state, with per-frame edge detection so a key press is seen
// exactly once even when the game runs at a fixed step.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false, clickedX: 0, clickedY: 0 };
    this.canvas = canvas;
    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      if (!event.repeat) this.pressed.add(event.code);
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
      this.mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
    });
    canvas.addEventListener('mousedown', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.down = true;
      this.mouse.clicked = true;
      this.mouse.clickedX = (event.clientX - rect.left) * (canvas.width / rect.width);
      this.mouse.clickedY = (event.clientY - rect.top) * (canvas.height / rect.height);
    });
    window.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });
  }

  down(...codes) {
    return codes.some((code) => this.keys.has(code));
  }

  wasPressed(...codes) {
    return codes.some((code) => this.pressed.has(code));
  }

  moveVector() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA', 'ArrowLeft')) x -= 1;
    if (this.down('KeyD', 'ArrowRight')) x += 1;
    if (this.down('KeyW', 'ArrowUp')) y -= 1;
    if (this.down('KeyS', 'ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const len = Math.sqrt(2);
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  consumeClick() {
    const click = this.mouse.clicked
      ? { x: this.mouse.clickedX, y: this.mouse.clickedY }
      : null;
    this.mouse.clicked = false;
    return click;
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }
}
