// RopeManager.js  (Part 1 - ropes)
// Owns every pin and rope of the current level.
//
// Usage per level:
//   ropeManager.clear();
//   ropeManager.setCandy(candyBody);
//   ropeManager.build(levelData);   // { ropes: [...], autoPins: [...] }
// Every frame, BEFORE Engine.update(engine):
//   ropeManager.update();
// When drawing:
//   ropeManager.display();
//
// For the mouse-cutting code (part 2):
//   ropeManager.getActiveRopes()   ropes still holding the candy
//   rope.getPoints()               segment i = points[i] -> points[i + 1]
//   rope.cut(i)                    cuts segment i

class RopeManager {
  constructor(engine) {
    this.engine = engine;
    this.ropes = [];
    this.pins = [];
    this.candy = null;
    this.nextId = 1;

    // Ropes are chains of constraints: more iterations = less rubbery chains.
    engine.constraintIterations = Math.max(engine.constraintIterations, 6);

    // After bodies move and before constraints are solved, each rope
    // decides whether it is loose (no pull) or stretched (pulls back).
    Matter.Events.on(engine, 'beforeSolve', () => {
      for (const rope of this.ropes) rope.updateTension();
    });
  }

  setCandy(candyBody) {
    this.candy = candyBody;
  }

  // Builds the ropes and auto pins described by a level object.
  build(level) {
    for (const r of level.ropes || []) this.addRope(r.x, r.y, r);
    for (const p of level.autoPins || []) this.addAutoPin(p.x, p.y, p.radius, p);
  }

  // Rope that exists from the start, from a new pin at (x, y) to the candy.
  addRope(x, y, options = {}) {
    const pin = new Pin(x, y);
    this.pins.push(pin);
    return this.attach(pin, options);
  }

  // Pin with a dashed circle; its rope appears when the candy touches the circle.
  addAutoPin(x, y, radius, options = {}) {
    const pin = new AutoPin(x, y, radius, options);
    this.pins.push(pin);
    return pin;
  }

  attach(pin, options = {}) {
    if (!this.candy) throw new Error('RopeManager: call setCandy() before adding ropes');
    const rope = new Rope(this.engine, pin, this.candy, options);
    rope.id = this.nextId++;
    this.ropes.push(rope);
    return rope;
  }

  update() {
    // auto pins: attach a rope the moment the candy reaches the circle
    if (this.candy) {
      for (const pin of this.pins) {
        if (pin instanceof AutoPin && !pin.used && pin.isReachedBy(this.candy)) {
          pin.used = true;
          // no `length` in the options -> rope length = current distance (taut, no jerk)
          this.attach(pin, pin.ropeOptions);
        }
      }
    }

    for (const rope of this.ropes) rope.update();
    this.ropes = this.ropes.filter((rope) => !rope.isDead);
  }

  getActiveRopes() {
    return this.ropes.filter((rope) => !rope.isCut);
  }

  getRopeById(id) {
    return this.ropes.find((rope) => rope.id === id);
  }

  // Cuts rope number `id` at its middle. Returns true if something was cut.
  cutRope(id) {
    const rope = this.getRopeById(id);
    return rope ? rope.cut() : false;
  }

  // Lets go of the candy (e.g. Om Nom ate it): every rope is cut at the
  // candy end and auto pins stop catching it.
  releaseCandy() {
    for (const rope of this.getActiveRopes()) rope.detachFromCandy();
    this.candy = null;
  }

  // Removes every rope and pin from the world (before loading a level).
  clear() {
    for (const rope of this.ropes) rope.destroy();
    this.ropes = [];
    this.pins = [];
    this.candy = null;
    this.nextId = 1;
  }

  display(showDebug = false) {
    for (const rope of this.ropes) rope.display();
    for (const pin of this.pins) pin.display();

    if (showDebug) this.displayDebug();
  }

  // Rope numbers next to their pins + state list (loose / taut / stretched).
  displayDebug() {
    push();
    noStroke();
    textSize(12);
    textAlign(LEFT, TOP);
    let y = 30;
    for (const rope of this.ropes) {
      fill(20);
      text(rope.id, rope.pin.x + 9, rope.pin.y - 18);
      const pct = Math.round(rope.stretch * 100);
      const label = rope.isCut ? 'cut' : `${rope.state} (${pct >= 0 ? '+' : ''}${pct}%)`;
      text(`Rope ${rope.id}: ${label}`, 8, y);
      y += 15;
    }
    pop();
  }
}
