class VipObject{
  constructor(x,y,r, candy){
    this.x = x;
    this.y = y;
    this.r = r;
    this.candy = candy;

    this.body = Bodies.circle(this.x, this.y, this.r);
    
    Composite.add(engine.world, this.body);
  }
  
  display(){
    push()
    imageMode(CENTER);  
    translate(this.body.position.x,
        this.body.position.y);
    rotate(this.body.angle);
    if (this.img === null){
        circle(0, 0,
          2*this.body.circleRadius);
      } else {
        image(this.candy,
          0, 0,
          2*this.body.circleRadius,
          2*this.body.circleRadius)
      }

    pop();

  }
  
}