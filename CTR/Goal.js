class Goal{
  
  constructor(x, y, object, toadWait, toadReady){
    this.x = x;
    this.y = y;
    this.r = 20
    this.toadWait = toadWait;
    this.toadReady = toadReady;
    this.current = this.toadReady;
    this.object = object;
    this.size = 50;
    
    this.toadWait.resize(this.size, this.size);
    this.toadReady.resize(this.size, this.size);
    this.body = Bodies.circle(this.x, this.y, this.r);
    Body.setAngularVelocity(this.body, 0.2);
    Composite.add(engine.world, this.body);
  }

  changeImage(){
    if(win){
      this.current = this.toadWait;
    }
  }
  
  
  display(){
    push();
    this.changeImage();
    imageMode(CENTER); 
    translate(this.body.position.x,
        this.body.position.y);
    rotate(this.body.angle);
    if (this.img === null){
        circle(0, 0,
          2*this.body.circleRadius);
      } else {
        image(this.current,
          0, 0,
          2*this.body.circleRadius,
          2*this.body.circleRadius)
      }
    pop();
  }
}