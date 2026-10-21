// levels.js  (Part 1 - ropes)
// Every level is plain data, so a new level needs no new code.
// Coordinates are in pixels on the 400 x 600 canvas.
//
//   name:     text shown on screen
//   candy:    { x, y, r }   start position and radius of the candy
//   goal:     { x, y }      where Om Nom sits
//   ropes:    [{ x, y, length?, stiffness?, damping? }]
//             A pin at (x, y) with a rope tied to the candy from the start.
//               length omitted          -> taut  (length = start distance)
//               length < start distance -> starts STRETCHED (pulls / can launch the candy)
//               length > start distance -> starts LOOSE (candy drops until the rope is taut)
//             stiffness / damping override ROPE_DEFAULTS in Rope.js.
//   autoPins: [{ x, y, radius, length? }]
//             A pin with a dashed circle. When the candy reaches the circle,
//             a rope appears and ties itself to the candy.
//               length omitted -> length = distance at the moment of contact

const LEVELS = [
  {
    name: '1 - Taut rope',
    candy: { x: 200, y: 170, r: 18 },
    goal: { x: 200, y: 520 },
    ropes: [
      { x: 200, y: 50 },
    ],
  },
  {
    name: '2 - Stretched ropes',
    candy: { x: 200, y: 150, r: 18 },
    goal: { x: 310, y: 520 },
    ropes: [
      { x: 90, y: 120, length: 90 },
      { x: 310, y: 120, length: 90 },
    ],
  },
  {
    name: '3 - Loose rope + auto pin',
    candy: { x: 160, y: 110, r: 18 },
    goal: { x: 270, y: 530 },
    ropes: [
      { x: 100, y: 60, length: 150 },
    ],
    autoPins: [
      { x: 130, y: 330, radius: 50 },
    ],
  },
];
