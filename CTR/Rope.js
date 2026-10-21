// Rope.js  (Part 1 - ropes and their joints with the candy)
//
// A rope is built from two Matter.js pieces:
//
// 1. A chain of tiny bodies ("links") joined by constraints. This is the
//    part you SEE. It sags when the rope is loose, swings, and falls
//    after a cut. Links collide with nothing and are very light, so they
//    barely affect the candy.
//
// 2. One invisible "tension" constraint from the pin to the candy. This is
//    the part that HOLDS the candy. Like a real rope it only pulls, never
//    pushes:
//      - candy closer than `length`  -> rope is LOOSE, no force
//      - candy at `length`           -> rope is TAUT
//      - candy farther than `length` -> rope is STRETCHED and pulls back
//        like an elastic band. Cutting another rope releases that energy,
//        which is what launches the candy.
//
// Matter constraints push AND pull, so before each solve (engine
// 'beforeSolve' event, see RopeManager) updateTension() turns the pull off
// while the rope is loose.
//
// Segment numbering (used by cut):
//   point 0 = pin, points 1..n-1 = links, point n = candy
//   segment i joins point i and point i + 1  (0 <= i < segmentCount)

const ROPE_DEFAULTS = {
  length: null,         // rest length in px. null = pin-to-candy distance at creation (taut)
  stiffness: 0.005,     // elasticity when stretched (Matter soft constraint). Higher = stronger pull
  damping: 0.008,       // how fast the bounce of a stretched rope dies out
  segmentLength: 8,     // px per visual link. Smaller = smoother rope, more bodies
  linkRadius: 2,
  linkMass: 0.01,
  linkFrictionAir: 0.03,
  fadeTime: 900,        // ms the pieces of a cut rope stay visible
};

const ROPE_JOINT_STIFFNESS = 0.8; // same value Matter's own chain demos use

class Rope {
  // engine:    Matter engine
  // pin:       Pin / AutoPin (any object with x, y)
  // candyBody: Matter body of the candy (VipObject.body)
  // options:   overrides for ROPE_DEFAULTS (extra keys such as x, y are ignored)
  constructor(engine, pin, candyBody, options = {}) {
    this.engine = engine;
    this.world = engine.world;
    this.pin = pin;
    this.candy = candyBody;
    this.options = Object.assign({}, ROPE_DEFAULTS, options);

    const startDistance = this.distanceToCandy();
    this.length = Math.max(1, this.options.length ?? startDistance);
    this.segmentCount = Math.max(3, Math.ceil(this.length / this.options.segmentLength));

    this.links = [];
    this.joints = [];
    this.isCut = false;
    this.cutIndex = -1;
    this.cutAt = 0;
    this.isDead = false;
    this.id = 0; // set by RopeManager

    this.buildChain(startDistance);

    this.tension = Matter.Constraint.create({
      label: 'rope-tension',
      pointA: { x: pin.x, y: pin.y },
      bodyB: candyBody,
      pointB: { x: 0, y: 0 },
      length: this.length,
      stiffness: this.options.stiffness,
      damping: this.options.damping,
    });

    Matter.Composite.add(this.world, [...this.links, ...this.joints, this.tension]);
  }

  buildChain(startDistance) {
    const n = this.segmentCount;
    const ax = this.pin.x;
    const ay = this.pin.y;
    const bx = this.candy.position.x;
    const by = this.candy.position.y;

    // A loose rope starts bent downwards (parabola) so its arc length is
    // close to `length` instead of being squeezed into a straight line.
    const extra = this.length - startDistance;
    let sag = 0;
    if (extra > 0) {
      const chord = Math.max(startDistance, this.length * 0.25);
      sag = Math.min(this.length / 2, Math.sqrt((3 * chord * extra) / 8));
    }

    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t + sag * 4 * t * (1 - t);
      const link = Matter.Bodies.circle(x, y, this.options.linkRadius, {
        label: 'rope-link',
        frictionAir: this.options.linkFrictionAir,
        collisionFilter: { group: 0, category: 0x0002, mask: 0 }, // collides with nothing
      });
      Matter.Body.setMass(link, this.options.linkMass);
      this.links.push(link);
    }

    const segLength = this.length / n;
    for (let i = 0; i < n; i++) {
      const joint = {
        label: 'rope-joint',
        length: segLength,
        stiffness: ROPE_JOINT_STIFFNESS,
        bodyB: i === n - 1 ? this.candy : this.links[i],
      };
      if (i === 0) {
        joint.pointA = { x: ax, y: ay }; // fixed to the pin
      } else {
        joint.bodyA = this.links[i - 1];
      }
      this.joints.push(Matter.Constraint.create(joint));
    }
  }

  distanceToCandy() {
    return Math.hypot(this.candy.position.x - this.pin.x, this.candy.position.y - this.pin.y);
  }

  // > 0 stretched, 0 taut, < 0 loose (fraction of the rest length)
  get stretch() {
    return this.distanceToCandy() / this.length - 1;
  }

  get state() {
    if (this.isCut) return 'cut';
    const diff = this.distanceToCandy() - this.length;
    const tolerance = Math.max(4, this.length * 0.03);
    if (diff < -tolerance) return 'loose';
    if (diff <= tolerance) return 'taut';
    return 'stretched';
  }

  // Called by RopeManager on every engine 'beforeSolve' (after bodies moved,
  // before constraints are solved).
  updateTension() {
    if (this.isCut) {
      // pieces of a cut rope relax back to their rest length (elastic recoil)
      const rest = this.length / this.segmentCount;
      for (const joint of this.joints) joint.length += (rest - joint.length) * 0.15;
      return;
    }

    const d = this.distanceToCandy();
    if (d > this.length) {
      // stretched: pull the candy back towards `length`
      this.tension.length = this.length;
      this.tension.damping = this.options.damping;
    } else {
      // loose: a rope cannot push, so the tension does nothing
      this.tension.length = d;
      this.tension.damping = 0;
    }

    // The visual chain is never shorter than the real distance, so it
    // stays straight when stretched and sags when loose without fighting
    // the tension constraint.
    const segLength = Math.max(this.length, d) / this.segmentCount;
    for (const joint of this.joints) joint.length = segLength;
  }

  // Cuts the rope at segment `segmentIndex` (default: middle).
  // The candy is released immediately; both pieces fade out.
  // Returns false if the rope was already cut.
  cut(segmentIndex = Math.floor(this.segmentCount / 2)) {
    if (this.isCut) return false;
    const i = Math.min(Math.max(Math.floor(segmentIndex), 0), this.segmentCount - 1);
    Matter.Composite.remove(this.world, [this.tension, this.joints[i]]);
    this.cutIndex = i;
    this.isCut = true;
    this.cutAt = this.engine.timing.timestamp;
    return true;
  }

  // Cuts the segment closest to the candy (used when Om Nom eats it).
  detachFromCandy() {
    return this.cut(this.segmentCount - 1);
  }

  // Positions from the pin to the candy. Segment i = points[i] -> points[i + 1].
  // Useful for the mouse-cutting code (part 2).
  getPoints() {
    const points = [{ x: this.pin.x, y: this.pin.y }];
    for (const link of this.links) points.push(link.position);
    points.push(this.candy.position);
    return points;
  }

  // Removes the rope from the world once the cut pieces have faded.
  update() {
    if (this.isCut && !this.isDead &&
        this.engine.timing.timestamp - this.cutAt >= this.options.fadeTime) {
      this.destroy();
    }
  }

  destroy() {
    Matter.Composite.remove(this.world, [...this.links, ...this.joints, this.tension]);
    this.isDead = true;
  }

  display() {
    if (this.isDead) return;

    let alpha = 255;
    let stretchAmount = 0;
    if (this.isCut) {
      const t = (this.engine.timing.timestamp - this.cutAt) / this.options.fadeTime;
      alpha = 255 * (1 - constrain(t, 0, 1));
    } else {
      // 0 = normal, 1 = very stretched (turns red and thinner)
      stretchAmount = constrain(this.stretch / 0.3, 0, 1);
    }

    const light = mixRGB([222, 170, 100], [235, 80, 55], stretchAmount);
    const dark = mixRGB([150, 95, 45], [175, 40, 30], stretchAmount);
    const points = this.getPoints();

    push();
    strokeCap(ROUND);

    // outline
    stroke(70, 40, 20, alpha);
    strokeWeight(lerp(6, 4.5, stretchAmount));
    this.drawSegments(points);

    // two alternating tones give the twisted-rope look
    strokeWeight(lerp(3.5, 2.5, stretchAmount));
    for (let i = 0; i < points.length - 1; i++) {
      if (i === this.cutIndex) continue;
      const c = i % 2 === 0 ? light : dark;
      stroke(c[0], c[1], c[2], alpha);
      line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }
    pop();
  }

  drawSegments(points) {
    for (let i = 0; i < points.length - 1; i++) {
      if (i === this.cutIndex) continue;
      line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }
  }
}

function mixRGB(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
