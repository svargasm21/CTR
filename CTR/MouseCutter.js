// MouseCutter.js  (Part 2 - cutting the ropes with the mouse)
//
// Lets the player slice ropes by dragging the mouse across them, the way
// you swipe a finger in Cut the Rope.
//
// How it works:
//   - While the mouse button is held down, every frame we add the current
//     mouse position to a "slash" trail.
//   - The newest piece of that trail is a tiny segment  prevMouse -> mouse.
//     We test that segment against every segment of every active rope
//     (using segment-vs-segment intersection). The first rope segment it
//     crosses gets cut with rope.cut(segmentIndex).
//   - The trail is drawn as a fading white streak so the slash is visible.
//
// It only relies on the public API Part 1 documented:
//   ropeManager.getActiveRopes()   -> ropes still holding the candy
//   rope.getPoints()               -> segment i = points[i] -> points[i + 1]
//   rope.cut(i)                    -> cut segment i
//
// Integration (done in sketch.js):
//   const mouseCutter = new MouseCutter(ropeManager);
//   mousePressed()  -> mouseCutter.start(mouseX, mouseY)
//   mouseDragged()  -> mouseCutter.drag(mouseX, mouseY)
//   mouseReleased() -> mouseCutter.end()
//   draw()          -> mouseCutter.display()   (after the ropes are drawn)

const CUTTER_DEFAULTS = {
  trailLife: 220,     // ms a point of the slash trail stays visible
  maxTrailPoints: 40, // cap so the trail array never grows without bound
  minMoveDist: 2,     // px the mouse must move before we record a new point
  lineColor: [255, 255, 255],
};

class MouseCutter {
  constructor(ropeManager, options = {}) {
    this.ropeManager = ropeManager;
    this.options = Object.assign({}, CUTTER_DEFAULTS, options);

    this.isSlicing = false;
    this.prev = null;             // last mouse point we tested from
    this.trail = [];              // [{ x, y, t }] points of the visible streak
    this.cutCount = 0;            // ropes cut during the current swipe
  }

  // ---- input -------------------------------------------------------------

  // Mouse button pressed: begin a new swipe.
  start(x, y) {
    this.isSlicing = true;
    this.prev = { x, y };
    this.cutCount = 0;
    this.addTrailPoint(x, y);
  }

  // Mouse moved while pressed: extend the swipe and cut whatever it crosses.
  drag(x, y) {
    if (!this.isSlicing) return;
    if (!this.prev) {
      this.prev = { x, y };
      this.addTrailPoint(x, y);
      return;
    }

    const moved = Math.hypot(x - this.prev.x, y - this.prev.y);
    if (moved < this.options.minMoveDist) return;

    // Test the fresh segment prev -> (x, y) against every active rope.
    this.cutCount += this.sliceAlong(this.prev.x, this.prev.y, x, y);

    this.prev = { x, y };
    this.addTrailPoint(x, y);
  }

  // Mouse button released: end the swipe (the trail keeps fading on its own).
  end() {
    this.isSlicing = false;
    this.prev = null;
  }

  // ---- cutting -----------------------------------------------------------

  // Cuts every rope whose chain crosses the slash segment (ax, ay)-(bx, by).
  // Returns how many ropes were cut.
  sliceAlong(ax, ay, bx, by) {
    const ropes = this.ropeManager.getActiveRopes();
    let cuts = 0;

    for (const rope of ropes) {
      const points = rope.getPoints();
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        if (segmentsIntersect(ax, ay, bx, by, p1.x, p1.y, p2.x, p2.y)) {
          if (rope.cut(i)) cuts++;
          break; // one cut per rope per slash segment
        }
      }
    }
    return cuts;
  }

  // ---- trail / drawing ---------------------------------------------------

  addTrailPoint(x, y) {
    this.trail.push({ x, y, t: millis() });
    if (this.trail.length > this.options.maxTrailPoints) this.trail.shift();
  }

  // Drops trail points once they are older than trailLife.
  pruneTrail() {
    const now = millis();
    const life = this.options.trailLife;
    while (this.trail.length && now - this.trail[0].t > life) this.trail.shift();
  }

  display() {
    this.pruneTrail();
    if (this.trail.length < 2) return;

    const now = millis();
    const life = this.options.trailLife;
    const [r, g, b] = this.options.lineColor;

    push();
    strokeCap(ROUND);
    strokeJoin(ROUND);
    noFill();
    for (let i = 0; i < this.trail.length - 1; i++) {
      const a = this.trail[i];
      const c = this.trail[i + 1];
      // newer points are brighter and thicker -> a comet-like streak
      const age = (now - c.t) / life;
      const alpha = 255 * (1 - constrain(age, 0, 1));
      const weight = lerp(1.5, 6, 1 - constrain(age, 0, 1));
      stroke(r, g, b, alpha);
      strokeWeight(weight);
      line(a.x, a.y, c.x, c.y);
    }
    pop();
  }
}

// True if segment p1-p2 crosses segment p3-p4.
// Standard orientation test (handles the general case; collinear overlaps
// are rare for a thin rope and a moving mouse, so they are ignored).
function segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d1 = orientation(x3, y3, x4, y4, x1, y1);
  const d2 = orientation(x3, y3, x4, y4, x2, y2);
  const d3 = orientation(x1, y1, x2, y2, x3, y3);
  const d4 = orientation(x1, y1, x2, y2, x4, y4);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return false;
}

// Cross product sign of (b - a) x (c - a): >0 left turn, <0 right turn, 0 collinear.
function orientation(ax, ay, bx, by, cx, cy) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}
