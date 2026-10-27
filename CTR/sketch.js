const {Engine, Body, Bodies, Composite, Render, Runner, Constraint,
      Constraints, MouseConstraint, Mouse, Composites, Collision} = Matter;

let engine;
let world;
let box1;                 // candy  (VipObject - part 3)
let goal1;                // Om Nom (Goal - part 3)
let toadWait, toadReady, candy;
let win;

let ropeManager;          // ropes  (part 1)
let mouseCutter;          // mouse rope-cutting  (part 2)
let levelIndex = 0;
let candyEaten = false;
let showRopeDebug = true; // D key: rope numbers + loose/taut/stretched

async function setup() {
  toadWait = await loadImage('toadWait.png');
  toadReady = await loadImage('toadReady.png');
  candy = await loadImage('candy.png');

  createCanvas(400, 600);
  engine = Engine.create();
  world = engine.world;

  ropeManager = new RopeManager(engine);
  mouseCutter = new MouseCutter(ropeManager);
  loadLevel(0);
}

// Builds level `index` from LEVELS (levels.js). Part 4 can call this for
// level changes / restarts.
function loadLevel(index) {
  levelIndex = (index + LEVELS.length) % LEVELS.length;
  const level = LEVELS[levelIndex];

  ropeManager.clear();
  Composite.clear(world, false);
  Engine.clear(engine);
  win = false;
  candyEaten = false;

  box1 = new VipObject(level.candy.x, level.candy.y, level.candy.r || 18, candy);
  goal1 = new Goal(level.goal.x, level.goal.y, box1, toadWait, toadReady);
  // Om Nom stays in place and the candy goes into him instead of bouncing off
  Body.setStatic(goal1.body, true);
  goal1.body.isSensor = true;

  ropeManager.setCandy(box1.body);
  ropeManager.build(level);
}

function winCondition(){
    if(Collision.collides(goal1.body, box1.body)){
      win = true;
    }
  if (win){
    text("You win", width/2, height/2);
  }
  }

function eatCandy() {
  candyEaten = true;
  ropeManager.releaseCandy();
  Composite.remove(world, box1.body);
}

function isCandyLost() {
  const p = box1.body.position;
  return p.y > height + 60 || p.x < -60 || p.x > width + 60;
}

function draw() {
  background(220);

  ropeManager.update();   // auto pins + removes faded ropes
  Engine.update(engine);  // ropes adjust their tension in 'beforeSolve'

  goal1.display();
  ropeManager.display(showRopeDebug);
  if (!candyEaten) box1.display();
  mouseCutter.display(); // part 2: slash trail on top of the ropes

  push();
  fill(0);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(28);
  winCondition();
  if (win && !candyEaten) eatCandy();
  textSize(14);
  if (win) {
    text('Press N for the next level', width / 2, height / 2 + 30);
  } else if (isCandyLost()) {
    text('Candy lost - press R to retry', width / 2, height / 2);
  }
  pop();

  drawHud();
}

function drawHud() {
  push();
  fill(0);
  noStroke();
  textSize(12);
  textAlign(LEFT, TOP);
  text(LEVELS[levelIndex].name, 8, 8);
  textAlign(LEFT, BOTTOM);
  text('Keys: 1-9 cut rope   R retry   N next level   D debug', 8, height - 8);
  pop();
}

// Test controls. Number keys cut ropes until the mouse cut (part 2) is
// merged; R / N stand in for the level screens (part 4).
function keyPressed() {
  if (!ropeManager) return; // images still loading
  if (key === 'r' || key === 'R') {
    loadLevel(levelIndex);
  } else if (key === 'n' || key === 'N') {
    loadLevel(levelIndex + 1);
  } else if (key === 'd' || key === 'D') {
    showRopeDebug = !showRopeDebug;
  } else if (/^[1-9]$/.test(key)) {
    ropeManager.cutRope(Number(key));
  }
}

// Mouse rope-cutting (part 2). Drag across a rope to slice it.
function mousePressed() {
  if (!mouseCutter) return; // still loading
  mouseCutter.start(mouseX, mouseY);
}

function mouseDragged() {
  if (!mouseCutter) return;
  mouseCutter.drag(mouseX, mouseY);
}

function mouseReleased() {
  if (!mouseCutter) return;
  mouseCutter.end();
}

// Touch support: p5 maps touch to mouseX/mouseY, so reuse the same logic.
function touchStarted() {
  if (mouseCutter) mouseCutter.start(mouseX, mouseY);
}

function touchMoved() {
  if (mouseCutter) mouseCutter.drag(mouseX, mouseY);
  return false; // stop the browser from scrolling while slicing
}

function touchEnded() {
  if (mouseCutter) mouseCutter.end();
}
