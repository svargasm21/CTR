// ropeTests.js - headless tests for the rope system (part 1).
// Open test.html in the browser (same way you open index.html).
// Only Matter.js runs here: nothing is drawn, the physics is stepped by hand.

const STEP_MS = 1000 / 60;
const results = [];

function test(name, fn) {
  try {
    const detail = fn();
    results.push({ name, pass: true, detail: detail || '' });
  } catch (err) {
    results.push({ name, pass: false, detail: err.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeSim(candyX, candyY, r = 18) {
  const engine = Matter.Engine.create();
  const ropes = new RopeManager(engine);
  const candy = Matter.Bodies.circle(candyX, candyY, r);
  Matter.Composite.add(engine.world, candy);
  ropes.setCandy(candy);
  return { engine, ropes, candy };
}

// Same order as draw(): ropes first, then physics.
function step(sim, n = 1) {
  for (let i = 0; i < n; i++) {
    sim.ropes.update();
    Matter.Engine.update(sim.engine, STEP_MS);
  }
}

const speed = (body) => Matter.Body.getSpeed(body);
const fmt = (v) => v.toFixed(2);

// ------------------------------------------------------------------

test('Taut rope holds the candy still under its pin', () => {
  const sim = makeSim(200, 170);
  const rope = sim.ropes.addRope(200, 50);
  assert(Math.abs(rope.length - 120) < 0.01, `length should be the start distance, got ${fmt(rope.length)}`);
  assert(rope.state === 'taut', `start state ${rope.state}`);

  step(sim, 300);
  const d = rope.distanceToCandy();
  assert(rope.state === 'taut', `state after 5 s: ${rope.state}`);
  assert(Math.abs(d - rope.length) < 6, `distance ${fmt(d)} vs length ${fmt(rope.length)}`);
  assert(speed(sim.candy) < 0.5, `candy still moving at ${fmt(speed(sim.candy))} px/step`);
  assert(Math.abs(sim.candy.position.x - 200) < 1, `candy drifted to x=${fmt(sim.candy.position.x)}`);
  return `stretch from the candy's weight: ${fmt(d - rope.length)} px`;
});

test('Loose rope does not pull, then catches the candy elastically', () => {
  const sim = makeSim(160, 110);
  const rope = sim.ropes.addRope(100, 60, { length: 150 });
  assert(rope.state === 'loose', `start state ${rope.state}`);

  const start = { x: sim.candy.position.x, y: sim.candy.position.y };
  step(sim, 10);
  const dy = sim.candy.position.y - start.y;
  const dx = sim.candy.position.x - start.x;
  assert(dy > 13, `candy should free-fall while loose, fell ${fmt(dy)} px in 10 steps`);
  assert(Math.abs(dx) < 0.5, `loose rope pulled the candy sideways by ${fmt(dx)} px`);

  let maxStretch = 0;
  for (let i = 0; i < 600; i++) {
    step(sim);
    maxStretch = Math.max(maxStretch, rope.distanceToCandy() - rope.length);
  }
  assert(maxStretch > 3, `rope should stretch a bit when it catches the candy (max ${fmt(maxStretch)} px)`);
  assert(maxStretch < 40, `rope stretched too much: ${fmt(maxStretch)} px`);
  assert(rope.distanceToCandy() < rope.length + 10, 'candy escaped the rope');
  return `max stretch when caught: ${fmt(maxStretch)} px`;
});

test('Loose rope sags below the straight line', () => {
  const sim = makeSim(200, 170);
  sim.ropes.addRope(200, 50);                                // holds the candy
  const loose = sim.ropes.addRope(100, 170, { length: 160 }); // 100 px apart, 160 px of rope
  step(sim, 120);
  assert(loose.state === 'loose', `state ${loose.state}`);
  const mid = loose.links[Math.floor(loose.links.length / 2)].position;
  const lineY = (loose.pin.y + sim.candy.position.y) / 2;
  assert(mid.y - lineY > 20, `middle of the rope only ${fmt(mid.y - lineY)} px below the line`);
  return `sag at the middle: ${fmt(mid.y - lineY)} px`;
});

test('Two stretched ropes: cutting one launches the candy', () => {
  const sim = makeSim(200, 150);
  const left = sim.ropes.addRope(90, 120, { length: 90 });
  const right = sim.ropes.addRope(310, 120, { length: 90 });
  assert(left.state === 'stretched' && right.state === 'stretched', `start: ${left.state} / ${right.state}`);

  step(sim, 300);
  assert(left.state === 'stretched' && right.state === 'stretched', `settled: ${left.state} / ${right.state}`);
  assert(speed(sim.candy) < 1, `not settled, speed ${fmt(speed(sim.candy))}`);

  const x0 = sim.candy.position.x;
  left.cut();
  let maxSpeed = 0;
  for (let i = 0; i < 30; i++) {
    step(sim);
    maxSpeed = Math.max(maxSpeed, speed(sim.candy));
  }
  assert(maxSpeed > 3, `launch too weak: ${fmt(maxSpeed)} px/step`);
  assert(sim.candy.position.x - x0 > 20, `candy moved only ${fmt(sim.candy.position.x - x0)} px towards the right pin`);
  return `launch speed ${fmt(maxSpeed)} px/step (~${Math.round(maxSpeed * 60)} px/s)`;
});

test('Auto pin: rope appears when the candy reaches the circle', () => {
  const sim = makeSim(100, 200);
  const pin = sim.ropes.addAutoPin(130, 330, 50);
  assert(sim.ropes.ropes.length === 0, 'auto pin must start without a rope');

  let steps = 0;
  while (sim.ropes.ropes.length === 0 && steps < 120) {
    step(sim);
    steps++;
  }
  assert(sim.ropes.ropes.length === 1, 'no rope was created');
  assert(pin.used, 'pin not marked as used');

  const rope = sim.ropes.ropes[0];
  const reach = pin.radius + 18;
  assert(rope.length <= reach + 0.01 && rope.length > reach - 10,
    `rope length ${fmt(rope.length)}, circle radius + candy radius = ${reach}`);

  let maxStretch = 0;
  for (let i = 0; i < 300; i++) {
    step(sim);
    maxStretch = Math.max(maxStretch, rope.distanceToCandy() - rope.length);
  }
  assert(sim.ropes.ropes.length === 1, 'auto pin created more than one rope');
  assert(maxStretch < 50, `rope stretched too much: ${fmt(maxStretch)} px`);
  assert(rope.distanceToCandy() < rope.length + 25, 'candy escaped the auto rope');
  return `attached after ${steps} steps, length ${fmt(rope.length)} px`;
});

test('Cutting frees the candy, then the rope fades and is removed', () => {
  const sim = makeSim(200, 170);
  const rope = sim.ropes.addRope(200, 50);
  step(sim, 120);

  const y0 = sim.candy.position.y;
  assert(sim.ropes.cutRope(rope.id), 'cutRope returned false');
  assert(!sim.engine.world.constraints.includes(rope.tension), 'tension constraint still in the world');
  assert(!rope.cut(), 'a rope can only be cut once');

  step(sim, 30);
  assert(sim.candy.position.y - y0 > 30, `candy fell only ${fmt(sim.candy.position.y - y0)} px`);

  step(sim, Math.ceil(ROPE_DEFAULTS.fadeTime / STEP_MS) + 2);
  assert(sim.ropes.ropes.length === 0, 'rope not removed after fading');
  const links = Matter.Composite.allBodies(sim.engine.world).filter((b) => b.label === 'rope-link');
  const constraints = Matter.Composite.allConstraints(sim.engine.world);
  assert(links.length === 0, `${links.length} rope links left in the world`);
  assert(constraints.length === 0, `${constraints.length} constraints left in the world`);
});

test('Rope links never collide with the candy or anything else', () => {
  const sim = makeSim(200, 170);
  const rope = sim.ropes.addRope(200, 50);
  const wall = Matter.Bodies.rectangle(200, 300, 400, 20, { isStatic: true });
  for (const link of rope.links) {
    assert(!Matter.Detector.canCollide(link.collisionFilter, sim.candy.collisionFilter), 'link can hit the candy');
    assert(!Matter.Detector.canCollide(link.collisionFilter, wall.collisionFilter), 'link can hit other bodies');
  }
  return `${rope.links.length} links checked`;
});

test('releaseCandy (Om Nom eats it) cuts every rope and disables auto pins', () => {
  const sim = makeSim(200, 170);
  sim.ropes.addRope(200, 50);
  sim.ropes.addRope(120, 60);
  const auto = sim.ropes.addAutoPin(200, 260, 40);
  step(sim, 5);
  assert(!auto.used, 'auto pin attached too early');

  sim.ropes.releaseCandy();
  assert(sim.ropes.getActiveRopes().length === 0, 'some ropes are still attached');
  step(sim, 60); // the candy falls through the dashed circle
  assert(!auto.used, 'auto pin caught a released candy');
});

test('Every level in levels.js builds and stays stable', () => {
  const lines = [];
  LEVELS.forEach((level, i) => {
    const sim = makeSim(level.candy.x, level.candy.y, level.candy.r || 18);
    sim.ropes.build(level);
    const ropeCount = (level.ropes || []).length;
    const pinCount = ropeCount + (level.autoPins || []).length;
    assert(sim.ropes.ropes.length === ropeCount, `level ${i + 1}: ${sim.ropes.ropes.length} ropes, expected ${ropeCount}`);
    assert(sim.ropes.pins.length === pinCount, `level ${i + 1}: ${sim.ropes.pins.length} pins, expected ${pinCount}`);

    step(sim, 180);
    const bodies = Matter.Composite.allBodies(sim.engine.world);
    for (const b of bodies) {
      assert(Number.isFinite(b.position.x) && Number.isFinite(b.position.y), `level ${i + 1}: a body has a NaN position`);
    }
    assert(speed(sim.candy) < 30, `level ${i + 1}: candy exploded (${fmt(speed(sim.candy))} px/step)`);
    lines.push(`${level.name}: ${sim.ropes.ropes.map((r) => r.state).join(', ')}`);
  });
  return lines.join(' | ');
});

// ------------------------------------------------------------------

function report() {
  const failed = results.filter((r) => !r.pass).length;
  const summary = failed
    ? `${failed} of ${results.length} tests FAILED`
    : `All ${results.length} tests passed`;

  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ' - ' + r.detail : ''}`);
  }
  console.log(summary);

  if (typeof document === 'undefined') return;
  const list = document.getElementById('results');
  for (const r of results) {
    const li = document.createElement('li');
    li.className = r.pass ? 'pass' : 'fail';
    li.textContent = `${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ' - ' + r.detail : ''}`;
    list.appendChild(li);
  }
  document.getElementById('summary').textContent = summary;
}

report();
