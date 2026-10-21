// Pin.js  (Part 1 - ropes)
// A pin is the fixed nail a rope hangs from. It is not a physics body:
// ropes use its (x, y) as a fixed world point.

class Pin {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  display() {
    push();
    noStroke();
    fill(60, 60, 70);
    circle(this.x, this.y, 16);      // dark ring
    fill(170, 175, 185);
    circle(this.x, this.y, 11);      // metal head
    fill(240);
    circle(this.x - 2, this.y - 2, 4); // highlight
    pop();
  }
}

// "Automatic" pin from Cut the Rope: a pin surrounded by a dashed circle.
// It has no rope at the start. When the candy reaches the circle's
// perimeter, a rope appears and attaches to the candy (only once).
class AutoPin extends Pin {
  constructor(x, y, radius, ropeOptions = {}) {
    super(x, y);
    this.radius = radius;
    this.ropeOptions = ropeOptions; // passed to the Rope created on contact
    this.used = false;
  }

  // True when the candy's edge touches (or is inside) the dashed circle.
  isReachedBy(candyBody) {
    const candyRadius = candyBody.circleRadius || 0;
    const d = Math.hypot(candyBody.position.x - this.x, candyBody.position.y - this.y);
    return d <= this.radius + candyRadius;
  }

  display() {
    if (!this.used) {
      push();
      noFill();
      stroke(90, 90, 100, 200);
      strokeWeight(2);
      drawingContext.setLineDash([6, 6]);
      circle(this.x, this.y, this.radius * 2);
      drawingContext.setLineDash([]);
      pop();
    }
    super.display();
  }
}
