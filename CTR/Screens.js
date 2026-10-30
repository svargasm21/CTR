// Screens.js  (Part 4 - loading screens and level transitions)
//
// Everything the player sees that is not the level itself:
//   - Button       clickable rounded button (hover + press animation)
//   - Transition   fade to dark -> run an action -> fade back in
//   - Progress     unlocked levels + best times, saved in localStorage
//   - Confetti     particles for the "all levels complete" screen
//   - draw helpers background, panels, progress bars, candy, level preview
//
// The scene state machine that uses these lives in sketch.js.

const UI = {
  bgTop: [64, 122, 78],
  bgBottom: [28, 62, 40],
  cream: [255, 244, 220],
  creamDark: [226, 204, 160],
  ink: [52, 36, 26],
  candy: [232, 67, 79],
  gold: [255, 196, 54],
  green: [92, 184, 92],
  greenDark: [52, 128, 60],
  grey: [150, 140, 128],
  font: 'Trebuchet MS',
};

// ---- easing ----------------------------------------------------------------

function easeOutCubic(t) {
  t = constrain(t, 0, 1);
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(t) {
  t = constrain(t, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function formatTime(ms) {
  return (ms / 1000).toFixed(1) + ' s';
}

// "2 - Stretched ropes" -> "Stretched ropes"
function levelTitle(level) {
  return level.name.replace(/^\s*\d+\s*-\s*/, '');
}

// ---- Button ----------------------------------------------------------------

// (x, y) is the CENTER of the button. offsetY lets a sliding panel move its
// buttons without rebuilding them.
class Button {
  constructor(label, x, y, w, h, onClick, options = {}) {
    this.label = label;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.onClick = onClick;
    this.primary = options.primary !== false;
    this.enabled = options.enabled !== false;
    this.textSize = options.textSize || 18;
    this.offsetY = 0;
    this.hover = 0; // 0..1, animated
  }

  contains(mx, my) {
    const y = this.y + this.offsetY;
    return this.enabled &&
      mx >= this.x - this.w / 2 && mx <= this.x + this.w / 2 &&
      my >= y - this.h / 2 && my <= y + this.h / 2;
  }

  display() {
    const over = this.contains(mouseX, mouseY);
    this.hover = lerp(this.hover, over ? 1 : 0, 0.25);
    const pressed = over && mouseIsPressed;
    const base = this.primary ? UI.green : UI.cream;
    const edge = this.primary ? UI.greenDark : UI.creamDark;

    push();
    translate(this.x, this.y + this.offsetY);
    scale(pressed ? 0.95 : 1 + this.hover * 0.05);
    rectMode(CENTER);
    noStroke();
    if (!this.enabled) {
      fill(...UI.grey, 160);
      rect(0, 3, this.w, this.h, 14);
      fill(200, 192, 180);
      rect(0, 0, this.w, this.h, 14);
    } else {
      fill(...edge);
      rect(0, 4, this.w, this.h, 14);   // 3D edge
      fill(...base);
      rect(0, 0, this.w, this.h, 14);
      fill(255, 255, 255, 50);
      rect(0, -this.h / 4, this.w - 10, this.h / 2 - 6, 10); // shine
    }
    fill(this.primary && this.enabled ? 255 : UI.ink);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(this.textSize);
    text(this.label, 0, 1);
    pop();
  }
}

// ---- Transition ------------------------------------------------------------

// transition.start(fn): fades the screen to dark, calls fn while fully
// covered (the moment to swap scenes / build a level), then fades back in.
class Transition {
  constructor(duration = 280) {
    this.duration = duration;
    this.phase = null; // null | 'out' | 'in'
    this.startedAt = 0;
    this.action = null;
  }

  get active() {
    return this.phase !== null;
  }

  start(action) {
    if (this.active) return false;
    this.phase = 'out';
    this.startedAt = millis();
    this.action = action;
    return true;
  }

  display() {
    if (!this.active) return;
    const t = (millis() - this.startedAt) / this.duration;
    let alpha;
    if (this.phase === 'out') {
      alpha = constrain(t, 0, 1);
      if (t >= 1) {
        const action = this.action;
        this.action = null;
        if (action) action();
        this.phase = 'in';
        this.startedAt = millis();
      }
    } else {
      alpha = 1 - constrain(t, 0, 1);
      if (t >= 1) this.phase = null;
    }
    push();
    noStroke();
    fill(14, 28, 18, alpha * 255);
    rect(0, 0, width, height);
    pop();
  }
}

// ---- Progress (saved between visits) ---------------------------------------

// Storage can throw (private mode, file://), so every access is guarded and
// the game still works with in-memory progress.
const PROGRESS_KEY = 'ctr-progress-v1';

class Progress {
  constructor() {
    this.unlocked = 1;  // how many levels can be played
    this.best = {};     // level index -> best time in ms
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(localStorage.getItem(PROGRESS_KEY));
      if (data) {
        this.unlocked = Math.max(1, data.unlocked | 0);
        this.best = data.best || {};
      }
    } catch (e) { /* keep defaults */ }
  }

  save() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ unlocked: this.unlocked, best: this.best }));
    } catch (e) { /* ignore */ }
  }

  reset() {
    this.unlocked = 1;
    this.best = {};
    this.save();
  }

  isUnlocked(index) {
    return index < this.unlocked;
  }

  isCompleted(index) {
    return this.best[index] !== undefined;
  }

  completedCount() {
    return Object.keys(this.best).length;
  }

  // Records a win. Returns true when `time` is a new best for that level.
  complete(index, time) {
    this.unlocked = Math.min(LEVELS.length, Math.max(this.unlocked, index + 2));
    const old = this.best[index];
    const isBest = old === undefined || time < old;
    if (isBest) this.best[index] = Math.round(time);
    this.save();
    return isBest;
  }

  totalBest() {
    return Object.values(this.best).reduce((a, b) => a + b, 0);
  }
}

// ---- Confetti --------------------------------------------------------------

class Confetti {
  constructor(count = 90) {
    this.pieces = [];
    for (let i = 0; i < count; i++) this.pieces.push(this.spawn(true));
  }

  spawn(anywhere) {
    const colors = [UI.candy, UI.gold, UI.green, [90, 160, 230], [240, 130, 200]];
    return {
      x: random(width),
      y: anywhere ? random(-height, 0) : random(-60, -10),
      vx: random(-0.6, 0.6),
      vy: random(1.2, 3),
      angle: random(TWO_PI),
      spin: random(-0.15, 0.15),
      size: random(6, 11),
      color: random(colors),
    };
  }

  display() {
    push();
    noStroke();
    rectMode(CENTER);
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      p.x += p.vx + sin(frameCount * 0.05 + i) * 0.4;
      p.y += p.vy;
      p.angle += p.spin;
      if (p.y > height + 20) this.pieces[i] = this.spawn(false);
      push();
      translate(p.x, p.y);
      rotate(p.angle);
      fill(...p.color);
      rect(0, 0, p.size, p.size * 0.5, 2);
      pop();
    }
    pop();
  }
}

// ---- drawing helpers -------------------------------------------------------

function drawScreenBackground() {
  const g = drawingContext.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, `rgb(${UI.bgTop.join(',')})`);
  g.addColorStop(1, `rgb(${UI.bgBottom.join(',')})`);
  drawingContext.fillStyle = g;
  drawingContext.fillRect(0, 0, width, height);

  // slowly drifting dot pattern
  push();
  noStroke();
  fill(255, 255, 255, 14);
  const drift = (millis() * 0.01) % 40;
  for (let y = -40; y < height + 40; y += 40) {
    for (let x = -40; x < width + 40; x += 40) {
      const ox = (y / 40) % 2 === 0 ? 0 : 20;
      circle(x + ox + drift, y + drift, 8);
    }
  }
  pop();
}

// Dark veil over the level for the pause / result overlays.
function drawDim(amount = 1) {
  push();
  noStroke();
  fill(10, 20, 14, 160 * amount);
  rect(0, 0, width, height);
  pop();
}

// Cream card with a soft shadow. (x, y) is the top-left corner.
function drawPanel(x, y, w, h) {
  push();
  noStroke();
  fill(0, 0, 0, 70);
  rect(x + 4, y + 8, w, h, 22);
  fill(...UI.creamDark);
  rect(x, y + 4, w, h, 22);
  fill(...UI.cream);
  rect(x, y, w, h, 22);
  pop();
}

function drawProgressBar(cx, cy, w, h, value) {
  push();
  rectMode(CORNER);
  noStroke();
  fill(0, 0, 0, 80);
  rect(cx - w / 2, cy - h / 2, w, h, h / 2);
  const fw = Math.max(h, w * constrain(value, 0, 1));
  fill(...UI.gold);
  rect(cx - w / 2, cy - h / 2, fw, h, h / 2);
  // moving stripes on the filled part
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.roundRect(cx - w / 2, cy - h / 2, fw, h, h / 2);
  drawingContext.clip();
  stroke(255, 255, 255, 70);
  strokeWeight(h * 0.45);
  const shift = (millis() * 0.04) % 24;
  for (let x = cx - w / 2 - 24 + shift; x < cx - w / 2 + fw + h; x += 24) {
    line(x, cy + h, x + h * 1.2, cy - h);
  }
  drawingContext.restore();
  pop();
}

// Procedural candy (red ball with white swirls). Used before / without the
// candy image, e.g. as the loading spinner.
function drawCandyShape(x, y, r, angle = 0) {
  push();
  translate(x, y);
  rotate(angle);
  noStroke();
  fill(0, 0, 0, 50);
  circle(2, 4, r * 2);
  fill(...UI.candy);
  circle(0, 0, r * 2);
  noFill();
  stroke(255, 255, 255, 230);
  strokeWeight(r * 0.28);
  strokeCap(ROUND);
  for (let k = 0; k < 3; k++) {
    rotate(TWO_PI / 3);
    arc(r * 0.3, 0, r * 1.1, r * 1.1, -HALF_PI, HALF_PI * 0.6);
  }
  noStroke();
  fill(255, 255, 255, 120);
  circle(-r * 0.35, -r * 0.4, r * 0.45);
  pop();
}

// Candy image when loaded, procedural candy otherwise.
function drawCandy(x, y, r, angle = 0) {
  if (candy) {
    push();
    translate(x, y);
    rotate(angle);
    imageMode(CENTER);
    image(candy, 0, 0, r * 2, r * 2);
    pop();
  } else {
    drawCandyShape(x, y, r, angle);
  }
}

// Big outlined title text.
function drawTitle(label, x, y, size, col = UI.cream) {
  push();
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(size);
  stroke(...UI.ink);
  strokeWeight(size * 0.18);
  strokeJoin(ROUND);
  fill(...col);
  text(label, x, y);
  pop();
}

function drawLabel(label, x, y, size, col = UI.ink, style = NORMAL) {
  push();
  noStroke();
  fill(...col);
  textAlign(CENTER, CENTER);
  textStyle(style);
  textSize(size);
  text(label, x, y);
  pop();
}

// Small padlock icon for locked levels.
function drawLock(x, y, s) {
  push();
  translate(x, y);
  noFill();
  stroke(...UI.ink);
  strokeWeight(s * 0.14);
  arc(0, -s * 0.15, s * 0.6, s * 0.7, PI, TWO_PI);
  noStroke();
  fill(...UI.ink);
  rectMode(CENTER);
  rect(0, s * 0.2, s * 0.85, s * 0.6, s * 0.12);
  fill(...UI.cream);
  circle(0, s * 0.17, s * 0.16);
  pop();
}

function drawCheck(x, y, s) {
  push();
  translate(x, y);
  noStroke();
  fill(...UI.green);
  circle(0, 0, s);
  noFill();
  stroke(255);
  strokeWeight(s * 0.14);
  strokeCap(ROUND);
  strokeJoin(ROUND);
  beginShape();
  vertex(-s * 0.24, 0);
  vertex(-s * 0.05, s * 0.2);
  vertex(s * 0.26, -s * 0.18);
  endShape();
  pop();
}

// Schematic thumbnail of a level: pins, ropes, auto pin circles, candy and
// goal, scaled to fit a w x h card centered at (cx, cy).
function drawLevelPreview(level, cx, cy, w, h) {
  const s = Math.min(w / 400, h / 600);
  push();
  translate(cx - 200 * s, cy - 300 * s);
  noStroke();
  fill(0, 0, 0, 60);
  rect(4, 6, 400 * s, 600 * s, 12);
  fill(220);
  rect(0, 0, 400 * s, 600 * s, 12);
  scale(s);

  const c = level.candy;
  for (const p of level.autoPins || []) {
    noFill();
    stroke(90, 90, 100, 200);
    strokeWeight(3);
    drawingContext.setLineDash([10, 10]);
    circle(p.x, p.y, p.radius * 2);
    drawingContext.setLineDash([]);
  }
  for (const r of level.ropes || []) {
    stroke(120, 80, 40);
    strokeWeight(5);
    const d = Math.hypot(c.x - r.x, c.y - r.y);
    if (r.length && r.length > d + 5) {
      // loose rope: draw it sagging
      noFill();
      const sag = Math.min(80, (r.length - d) * 0.6);
      bezier(r.x, r.y, r.x, r.y + sag, c.x, c.y + sag, c.x, c.y);
    } else {
      line(r.x, r.y, c.x, c.y);
    }
  }
  noStroke();
  for (const p of [...(level.ropes || []), ...(level.autoPins || [])]) {
    fill(60, 60, 70);
    circle(p.x, p.y, 22);
    fill(170, 175, 185);
    circle(p.x, p.y, 14);
  }
  if (toadReady) {
    imageMode(CENTER);
    image(toadReady, level.goal.x, level.goal.y, 70, 70);
  } else {
    fill(...UI.green);
    circle(level.goal.x, level.goal.y, 60);
  }
  drawCandy(c.x, c.y, (c.r || 18) * 1.3);
  pop();
}
