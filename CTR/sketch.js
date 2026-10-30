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
let showRopeDebug = false; // D key: rope numbers + loose/taut/stretched

// ---- part 4: screens -------------------------------------------------------
// One scene is active at a time; SCENES (below) holds what each one draws
// and which buttons it has. Scene changes go through `transition` (fade).
//
//   loading -> menu -> levelSelect
//                   -> levelIntro -> playing -> paused
//                                            -> levelComplete -> levelIntro (next)
//                                            |                -> gameComplete
//                                            -> levelFailed   -> playing (retry)
let scene = 'loading';
let sceneStartedAt = 0;
let transition;
let progress;
let confetti;

const LOADING_MIN_TIME = 1600; // ms: keep the loading screen readable
const INTRO_TIME = 1500;       // ms the "loading level" bar takes
const assetLoad = { loaded: 0, total: 3, done: false, error: null, shown: 0 };

let introLevel = 0;      // level shown on the intro screen
let levelTime = 0;       // ms played in the current attempt (pause excluded)
let attempts = 1;        // tries of the current level
let wonAt = 0;           // millis() when the candy was eaten
let lostAt = 0;          // millis() when the candy left the screen
let newBest = false;
let lastPressAt = -1000; // touch + mouse can both fire: ignore the echo

function setup() {
  createCanvas(400, 600);
  textFont(UI.font);
  engine = Engine.create();
  world = engine.world;

  ropeManager = new RopeManager(engine);
  mouseCutter = new MouseCutter(ropeManager);
  transition = new Transition();
  progress = new Progress();

  // Not awaited: draw() runs meanwhile and shows the loading screen.
  loadAssets();
  setScene('loading');
}

function loadAssets() {
  const track = (promise) => promise.then((img) => {
    assetLoad.loaded++;
    return img;
  });
  Promise.all([
    track(loadImage('toadWait.png')),
    track(loadImage('toadReady.png')),
    track(loadImage('candy.png')),
  ]).then(([wait, ready, candyImg]) => {
    toadWait = wait;
    toadReady = ready;
    candy = candyImg;
    assetLoad.done = true;
  }).catch((err) => {
    assetLoad.error = 'Could not load the game images.';
    console.error(err);
  });
}

// Builds level `index` from LEVELS (levels.js).
function loadLevel(index) {
  levelIndex = (index + LEVELS.length) % LEVELS.length;
  const level = LEVELS[levelIndex];

  ropeManager.clear();
  Composite.clear(world, false);
  Engine.clear(engine);
  win = false;
  candyEaten = false;
  levelTime = 0;
  wonAt = 0;
  lostAt = 0;
  newBest = false;
  mouseCutter.end();

  box1 = new VipObject(level.candy.x, level.candy.y, level.candy.r || 18, candy);
  goal1 = new Goal(level.goal.x, level.goal.y, box1, toadWait, toadReady);
  // Om Nom stays in place and the candy goes into him instead of bouncing off
  Body.setStatic(goal1.body, true);
  goal1.body.isSensor = true;

  ropeManager.setCandy(box1.body);
  ropeManager.build(level);
}

function winCondition() {
  if (Collision.collides(goal1.body, box1.body)) {
    win = true;
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

// ---- scene control ---------------------------------------------------------

function setScene(name) {
  scene = name;
  sceneStartedAt = millis();
  const s = SCENES[name];
  if (s.enter) s.enter();
}

// Fade out, run `before` (e.g. build a level), switch scene, fade in.
function goTo(name, before) {
  transition.start(() => {
    if (before) before();
    setScene(name);
  });
}

function sceneTime() {
  return millis() - sceneStartedAt;
}

// Level intro ("loading level") screen, then the level itself.
function startLevel(index) {
  goTo('levelIntro', () => {
    introLevel = (index + LEVELS.length) % LEVELS.length;
    attempts = 1;
  });
}

function retryLevel() {
  goTo('playing', () => {
    attempts++;
    loadLevel(levelIndex);
  });
}

function nextLevel() {
  if (levelIndex + 1 >= LEVELS.length) {
    goTo('gameComplete');
  } else {
    startLevel(levelIndex + 1);
  }
}

// First level that is unlocked but not completed yet (or the last one).
function continueLevel() {
  for (let i = 0; i < LEVELS.length; i++) {
    if (progress.isUnlocked(i) && !progress.isCompleted(i)) return i;
  }
  return 0;
}

// ---- the level (shared by playing / paused / result screens) ---------------

function stepWorld() {
  ropeManager.update();   // auto pins + removes faded ropes
  Engine.update(engine);  // ropes adjust their tension in 'beforeSolve'
}

function drawWorld() {
  background(220);
  goal1.display();
  ropeManager.display(showRopeDebug);
  if (!candyEaten) box1.display();
  mouseCutter.display(); // part 2: slash trail on top of the ropes
}

const pauseButton = { x: 376, y: 24, r: 16 };

function overPauseButton(mx, my) {
  return Math.hypot(mx - pauseButton.x, my - pauseButton.y) <= pauseButton.r + 4;
}

function drawHud() {
  push();
  noStroke();
  fill(0);
  textSize(12);
  textStyle(BOLD);
  textAlign(LEFT, TOP);
  text(LEVELS[levelIndex].name, 8, 8);
  textStyle(NORMAL);
  textAlign(RIGHT, CENTER);
  text(formatTime(levelTime), pauseButton.x - 26, pauseButton.y);

  // pause button
  const over = overPauseButton(mouseX, mouseY);
  fill(...(over ? UI.green : UI.greenDark));
  circle(pauseButton.x, pauseButton.y, pauseButton.r * 2);
  fill(255);
  rectMode(CENTER);
  rect(pauseButton.x - 4, pauseButton.y, 4, 13, 1);
  rect(pauseButton.x + 4, pauseButton.y, 4, 13, 1);

  fill(0, 0, 0, 150);
  textAlign(LEFT, BOTTOM);
  textSize(11);
  text('Swipe to cut   R retry   Esc pause   D debug', 8, height - 8);
  pop();
}

// Result / pause card that drops in from above. Returns the panel's y offset
// so the scene can move its buttons with it.
function dropPanel(title, titleCol, h) {
  const t = easeOutBack(sceneTime() / 450);
  const offset = (1 - t) * -height;
  drawDim(constrain(sceneTime() / 250, 0, 1));
  const w = 320;
  const y = (height - h) / 2 + offset;
  drawPanel((width - w) / 2, y, w, h);
  drawTitle(title, width / 2, y + 2, 34, titleCol);
  return { offset, top: y };
}

function makeRow(defs, y) {
  // defs: [[label, onClick, primary], ...] laid out in one row
  const gap = 10;
  const w = (300 - gap * (defs.length - 1)) / defs.length;
  return defs.map(([label, onClick, primary], i) =>
    new Button(label, width / 2 - 150 + w / 2 + i * (w + gap), y, w, 46, onClick,
      { primary, textSize: 16 }));
}

// ---- scenes ----------------------------------------------------------------

const SCENES = {
  // Asset loading screen shown while the images download.
  loading: {
    buttons: [],
    draw() {
      drawScreenBackground();
      const real = assetLoad.loaded / assetLoad.total;
      const timed = sceneTime() / LOADING_MIN_TIME;
      assetLoad.shown = lerp(assetLoad.shown, Math.min(real, timed), 0.15);

      drawTitle('Cut the Rope', width / 2, 170, 48);
      drawLabel('cut the ropes, feed the toad', width / 2, 215, 16, UI.cream);

      // swinging candy spinner
      const swing = sin(millis() * 0.004) * 0.6;
      const px = width / 2;
      const py = 270;
      const cx = px + sin(swing) * 70;
      const cy = py + cos(swing) * 70;
      push();
      stroke(150, 100, 50);
      strokeWeight(3);
      line(px, py, cx, cy);
      noStroke();
      fill(60, 60, 70);
      circle(px, py, 14);
      pop();
      drawCandyShape(cx, cy, 22, millis() * 0.003);

      if (assetLoad.error) {
        drawLabel(assetLoad.error, width / 2, 440, 15, UI.gold, BOLD);
        drawLabel('Open the game through a local web server', width / 2, 466, 13, UI.cream);
        drawLabel('(e.g. VS Code Live Server).', width / 2, 484, 13, UI.cream);
        return;
      }

      drawProgressBar(width / 2, 450, 260, 18, assetLoad.shown);
      const dots = '.'.repeat(1 + Math.floor(millis() / 350) % 3);
      drawLabel('Loading' + dots, width / 2, 480, 15, UI.cream, BOLD);
      drawLabel(`${Math.round(assetLoad.shown * 100)}%`, width / 2, 425, 13, UI.cream);

      if (assetLoad.done && timed >= 1 && assetLoad.shown > 0.98) goTo('menu');
    },
  },

  menu: {
    buttons: [],
    enter() {
      const hasProgress = progress.completedCount() > 0;
      this.buttons = [
        new Button(hasProgress ? 'Continue' : 'Play', width / 2, 372, 220, 56,
          () => startLevel(continueLevel()), { textSize: 24 }),
        new Button('Levels', width / 2, 440, 220, 50,
          () => goTo('levelSelect'), { primary: false }),
      ];
    },
    draw() {
      drawScreenBackground();
      const bob = sin(millis() * 0.003) * 4;
      drawTitle('Cut the Rope', width / 2, 110 + bob, 54);
      drawLabel('cut the ropes, feed the toad', width / 2, 158, 16, UI.cream);

      // candy hanging over the toad
      const swing = sin(millis() * 0.0025) * 0.35;
      const cx = width / 2 + sin(swing) * 50;
      const cy = 180 + cos(swing) * 50;
      push();
      stroke(150, 100, 50);
      strokeWeight(3);
      line(width / 2, 180, cx, cy);
      noStroke();
      fill(60, 60, 70);
      circle(width / 2, 180, 14);
      pop();
      drawCandy(cx, cy, 18);
      push();
      imageMode(CENTER);
      image(toadReady, width / 2, 285 + bob * 0.5, 70, 70);
      pop();

      for (const b of this.buttons) b.display();
      drawLabel(`Levels completed: ${progress.completedCount()} / ${LEVELS.length}`,
        width / 2, 505, 14, UI.cream);
      drawLabel('Swipe across a rope to cut it', width / 2, 560, 12, [255, 255, 255, 150]);
    },
    onKey() {
      if (keyCode === ENTER || key === ' ') this.buttons[0].onClick();
    },
  },

  levelSelect: {
    buttons: [],
    enter() {
      this.buttons = [];
      const cols = 3;
      const size = 104;
      const gap = 14;
      const left = (width - (cols * size + (cols - 1) * gap)) / 2 + size / 2;
      LEVELS.forEach((level, i) => {
        const b = new Button(progress.isUnlocked(i) ? String(i + 1) : '',
          left + (i % cols) * (size + gap), 210 + Math.floor(i / cols) * (size + gap + 16),
          size, size, () => startLevel(i),
          { primary: false, enabled: progress.isUnlocked(i), textSize: 38 });
        b.levelIndex = i;
        this.buttons.push(b);
      });
      this.buttons.push(new Button('Back', width / 2, 510, 160, 46, () => goTo('menu'),
        { textSize: 17 }));
      this.resetButton = new Button('Reset progress', width / 2, 562, 140, 28, () => {
        progress.reset();
        this.enter();
      }, { primary: false, textSize: 12 });
      this.buttons.push(this.resetButton);
    },
    draw() {
      drawScreenBackground();
      drawTitle('Choose a level', width / 2, 90, 36);
      for (const b of this.buttons) {
        b.display();
        if (b.levelIndex === undefined) continue;
        const i = b.levelIndex;
        if (!b.enabled) {
          drawLock(b.x, b.y, 30);
        } else {
          if (progress.isCompleted(i)) drawCheck(b.x + b.w / 2 - 8, b.y - b.h / 2 + 8, 24);
        }
        const sub = progress.isCompleted(i) ? 'Best ' + formatTime(progress.best[i])
          : levelTitle(LEVELS[i]);
        drawLabel(sub, b.x, b.y + b.h / 2 + 16, 11, UI.cream, BOLD);
      }
    },
    onKey() {
      if (keyCode === ESCAPE || keyCode === BACKSPACE) goTo('menu');
    },
  },

  // "Loading level" card between levels: number, name, preview and a bar.
  levelIntro: {
    buttons: [],
    draw() {
      drawScreenBackground();
      const level = LEVELS[introLevel];
      const t = sceneTime();
      const zoom = easeOutBack(t / 500);

      push();
      translate(width / 2, 80);
      scale(zoom);
      drawLabel(`LEVEL ${introLevel + 1} OF ${LEVELS.length}`, 0, -22, 15, UI.gold, BOLD);
      drawTitle(levelTitle(level), 0, 16, 32);
      pop();

      const slide = easeOutCubic((t - 150) / 500);
      drawLevelPreview(level, width / 2, 270 + (1 - slide) * 40, 180, 270);

      const p = constrain(t / INTRO_TIME, 0, 1);
      drawProgressBar(width / 2, 470, 240, 16, easeOutCubic(p));
      drawLabel(p < 1 ? 'Loading level...' : 'Ready!', width / 2, 500, 15, UI.cream, BOLD);
      if (progress.isCompleted(introLevel)) {
        drawLabel('Best ' + formatTime(progress.best[introLevel]), width / 2, 528, 13, UI.cream);
      }
      drawLabel('Tap to skip', width / 2, 570, 12, [255, 255, 255, 120]);

      if (t > INTRO_TIME + 300) this.begin();
    },
    begin() {
      goTo('playing', () => loadLevel(introLevel));
    },
    onPress() {
      if (sceneTime() > 300) this.begin();
    },
    onKey() {
      this.begin();
    },
  },

  playing: {
    buttons: [],
    draw() {
      if (!transition.active) {
        stepWorld();
        if (!candyEaten) levelTime += deltaTime;
      }
      drawWorld();
      winCondition();
      if (win && !candyEaten) {
        eatCandy();
        wonAt = millis();
        newBest = progress.complete(levelIndex, levelTime);
      }
      drawHud();

      if (candyEaten && millis() - wonAt > 900) {
        setScene('levelComplete');
      } else if (!win && isCandyLost()) {
        if (!lostAt) lostAt = millis();
        if (millis() - lostAt > 400) setScene('levelFailed');
      }
    },
    onPress(mx, my) {
      if (overPauseButton(mx, my)) {
        if (!candyEaten) setScene('paused');
        return;
      }
      mouseCutter.start(mx, my);
    },
    onKey() {
      if (key === 'r' || key === 'R') {
        retryLevel();
      } else if (key === 'n' || key === 'N') {
        nextLevel(); // dev shortcut: skip the level
      } else if (key === 'd' || key === 'D') {
        showRopeDebug = !showRopeDebug;
      } else if (keyCode === ESCAPE || key === 'p' || key === 'P') {
        if (!candyEaten) setScene('paused');
      } else if (/^[1-9]$/.test(key)) {
        ropeManager.cutRope(Number(key));
      }
    },
  },

  paused: {
    buttons: [],
    enter() {
      mouseCutter.end();
      this.buttons = [
        new Button('Resume', width / 2, 270, 220, 50, () => setScene('playing')),
        new Button('Restart', width / 2, 335, 220, 46, () => retryLevel(), { primary: false }),
        new Button('Menu', width / 2, 395, 220, 46, () => goTo('menu'), { primary: false }),
      ];
    },
    draw() {
      drawWorld(); // frozen: no physics step
      drawHud();
      const { offset } = dropPanel('Paused', UI.cream, 280);
      for (const b of this.buttons) {
        b.offsetY = offset;
        b.display();
      }
    },
    onKey() {
      if (keyCode === ESCAPE || key === 'p' || key === 'P' || keyCode === ENTER) setScene('playing');
      else if (key === 'r' || key === 'R') retryLevel();
    },
  },

  levelComplete: {
    buttons: [],
    enter() {
      const last = levelIndex + 1 >= LEVELS.length;
      this.buttons = makeRow([
        ['Menu', () => goTo('menu'), false],
        ['Retry', () => retryLevel(), false],
        [last ? 'Finish' : 'Next', () => nextLevel(), true],
      ], 400);
    },
    draw() {
      stepWorld(); // let the cut ropes finish falling
      drawWorld();
      const { offset, top } = dropPanel('Yummy!', UI.gold, 300);
      drawLabel(`Level ${levelIndex + 1} complete`, width / 2, top + 48, 18, UI.ink, BOLD);

      // the toad with the candy, bouncing happily
      push();
      imageMode(CENTER);
      const hop = Math.abs(sin(millis() * 0.008)) * 8;
      image(toadWait, width / 2, top + 108 - hop, 70, 70);
      pop();

      drawLabel('Time ' + formatTime(levelTime), width / 2, top + 168, 17, UI.ink);
      if (newBest) {
        const pulse = 1 + sin(millis() * 0.01) * 0.06;
        push();
        translate(width / 2, top + 196);
        scale(pulse);
        drawLabel('NEW BEST!', 0, 0, 15, [214, 140, 0], BOLD);
        pop();
      } else {
        drawLabel('Best ' + formatTime(progress.best[levelIndex]), width / 2, top + 196, 14, UI.grey);
      }
      drawLabel(attempts === 1 ? 'First try!' : `Attempts: ${attempts}`, width / 2, top + 220, 13, UI.grey);

      for (const b of this.buttons) {
        b.offsetY = offset;
        b.display();
      }
    },
    onKey() {
      if (keyCode === ENTER || key === ' ' || key === 'n' || key === 'N') nextLevel();
      else if (key === 'r' || key === 'R') retryLevel();
      else if (keyCode === ESCAPE) goTo('menu');
    },
  },

  levelFailed: {
    buttons: [],
    enter() {
      this.buttons = makeRow([
        ['Menu', () => goTo('menu'), false],
        ['Retry', () => retryLevel(), true],
      ], 375);
    },
    draw() {
      stepWorld();
      drawWorld();
      const { offset, top } = dropPanel('Oh no!', UI.candy, 250);
      drawLabel('The candy fell off the screen.', width / 2, top + 58, 16, UI.ink);
      drawCandy(width / 2, top + 115 + sin(millis() * 0.004) * 4, 22, sin(millis() * 0.003) * 0.4);
      drawLabel(`Attempt ${attempts}`, width / 2, top + 160, 13, UI.grey);
      for (const b of this.buttons) {
        b.offsetY = offset;
        b.display();
      }
    },
    onKey() {
      if (keyCode === ENTER || key === ' ' || key === 'r' || key === 'R') retryLevel();
      else if (keyCode === ESCAPE) goTo('menu');
    },
  },

  gameComplete: {
    buttons: [],
    enter() {
      confetti = new Confetti();
      this.buttons = [
        new Button('Play again', width / 2, 440, 220, 54, () => startLevel(0), { textSize: 20 }),
        new Button('Menu', width / 2, 505, 220, 46, () => goTo('menu'), { primary: false }),
      ];
    },
    draw() {
      drawScreenBackground();
      confetti.display();
      const zoom = easeOutBack(sceneTime() / 600);
      push();
      translate(width / 2, 110);
      scale(zoom);
      drawTitle('You did it!', 0, 0, 50, UI.gold);
      pop();
      drawLabel('Every level complete', width / 2, 160, 18, UI.cream, BOLD);

      push();
      imageMode(CENTER);
      const hop = Math.abs(sin(millis() * 0.006)) * 18;
      image(toadWait, width / 2, 270 - hop, 100, 100);
      pop();

      drawLabel(`Total best time: ${formatTime(progress.totalBest())}`, width / 2, 360, 16, UI.cream);
      for (const b of this.buttons) b.display();
    },
    onKey() {
      if (keyCode === ENTER || key === ' ') startLevel(0);
      else if (keyCode === ESCAPE) goTo('menu');
    },
  },
};

function draw() {
  SCENES[scene].draw();
  transition.display();
}

// ---- input -----------------------------------------------------------------

function keyPressed() {
  if (transition.active) return;
  const s = SCENES[scene];
  if (s.onKey) s.onKey();
  if (keyCode === ESCAPE) return false; // keep Esc away from the browser
}

// Buttons first, then the scene's own press handler (rope cutting in-game).
function handlePress(mx, my) {
  if (millis() - lastPressAt < 60) return;
  lastPressAt = millis();
  if (transition.active) return;
  const s = SCENES[scene];
  for (const b of s.buttons) {
    if (b.contains(mx, my)) {
      b.onClick();
      return;
    }
  }
  if (s.onPress) s.onPress(mx, my);
}

// Mouse rope-cutting (part 2). Drag across a rope to slice it.
function mousePressed() {
  handlePress(mouseX, mouseY);
}

function mouseDragged() {
  if (scene === 'playing') mouseCutter.drag(mouseX, mouseY);
}

function mouseReleased() {
  mouseCutter.end();
}

// Touch support: p5 maps touch to mouseX/mouseY, so reuse the same logic.
function touchStarted() {
  handlePress(mouseX, mouseY);
}

function touchMoved() {
  if (scene === 'playing') mouseCutter.drag(mouseX, mouseY);
  return false; // stop the browser from scrolling while slicing
}

function touchEnded() {
  mouseCutter.end();
}
