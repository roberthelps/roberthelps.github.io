var canvas;
var makeButton;
var drawButton;

var drawIDs = true;
var selectedNode;

var nodeSize = 10;
var nodes = [];
var id = 0;

var msgId = 0;

var range = 100;
var transmitTime = 25;
var tMin = 50;
var tMax = 500;

function setup() {
  canvas = createCanvas(600, 400);

  makeButton = createButton("Make Route");
  makeButton.mousePressed(makeRoute);
  makeButton.position(620, 10);

  clearButton = createButton("Clear Route");
  clearButton.mousePressed(clearRoute);
  clearButton.position(620, 30);
}

function makeRoute() {
  if (nodes.length > 0) {
    nodes[0].makeRoute();
  }
}

function clearRoute() {}

function calcNeighbours() {
  for (var i in nodes) {
    nodes[i].neighbours = [];
    for (var j in nodes) {
      if (i != j) {
        if (nodes[i].pos.dist(nodes[j].pos) < range) {
          nodes[i].neighbours.push(nodes[j]);
        }
      }
    }
  }
}

function mousePressed() {
  if (mouseX < canvas.width && mouseY < canvas.height) {
    var v = createVector(mouseX, mouseY);

    // is the mouse click on a particular node?
    for (var i in nodes) {
      if (v.dist(nodes[i].pos) < nodeSize) {
        // nodes[i].isSelected = !nodes[i].isSelected;
        selectedNode = nodes[i];
        return false;
      }
    }

    // add a new node to the array
    nodes.push(new Node(v, id++));
    calcNeighbours();
  }

  return false;
}

// Move a node
function mouseDragged() {
  if (mouseX < canvas.width && mouseY < canvas.height) {
    if (selectedNode) {
      selectedNode.pos.x = mouseX;
      selectedNode.pos.y = mouseY;
    }
  }
}

function mouseReleased() {
  selectedNode = null;
  calcNeighbours();
}

function draw() {

  background(128);

  for (var i in nodes) {
    nodes[i].update();
  }

  push();
  for (var i in nodes) {
    nodes[i].drawPath();
  }
  pop();

  push();
  for (var i in nodes) {
    nodes[i].drawField();
  }
  pop();

  push();
  for (var i in nodes) {
    nodes[i].drawNode();
  }

  push();
  if (drawIDs) {
    for (var i in nodes) {
      nodes[i].drawID();
    }
  }
  pop();

}

function Node(pos, id) {
  this.pos = pos;
  this.id = id;

  this.state = "idle";
  this.timer = 0;

  this.parent = null;

  this.distance = 255;
  this.msgId;

  this.isSelected = false;

  this.neighbours = [];
  this.isTransmitting = false;
  this.senderCount = 0;

  //  this.siblings = [];
  this.messages = [];

  this.sendStart = function() {
    this.isTransmitting = true;
    for (var i in this.neighbours) {
      this.neighbours[i].recvStart();
    }
  }

  this.sendStop = function(msg) {
    console.log(this.id + " sent " + msg.type);
    this.isTransmitting = false;
    for (var i in this.neighbours) {
      this.neighbours[i].recvStop(this, msg);
    }
  }

  this.recvStart = function() {
    this.senderCount++;
  }

  this.recvStop = function(other, msg) {
    this.senderCount--;

    // The node can only hear one speaker at a time
    if (this.senderCount <= 0) {
      this.senderCount = 0;

      if (msg.id != this.msgId) {
        this.msgId = msg.id;
        this.distance = 255;
        this.parent = null;
        //        this.siblings = [];
      }

      switch (msg.type) {
        case "makeRoute":
          // only accept messages from upstream
          if (msg.distance < this.distance) {
            this.distance = msg.distance + 1;
            var msg = {
              id: msg.id,
              type: "makeRoute",
              distance: this.distance
            };
            if (!isPresent(this.messages, msg)) {
              this.messages.push(msg);
            }
            this.parent = other;
            //            other.siblings.push(this);
          }
          break;

        case "clearRoute":
          break;
      }
    }
  }

  this.makeRoute = function() {
    this.distance = 0;
    this.msgId = msgId++;
    this.messages.push({
      id: this.msgId,
      type: "makeRoute",
      distance: 0
    });
  }


  this.update = function() {
    this.timer++;

    // Transmit state machine
    switch (this.state) {
      case "idle":
        if (this.messages.length > 0) {
          this.timer = 0;
          this.period = random(tMin, tMax);
          this.state = "pending";
        }
        break;

      case "pending":
        // Dont transmit if currently receiving
        if ((this.timer > this.period) && (this.senderCount <= 0)) {
          this.senderCount = 0;
          this.timer = 0;
          this.sendStart();
          this.state = "transmit";
        }
        break;

      case "transmit":
        if (this.timer > transmitTime) {
          this.sendStop(this.messages[0]);
          this.messages.splice(0, 1);
          this.state = "idle";
        }
        break;
    }
  }

  this.drawPath = function() {
    if (this.parent) {
      strokeWeight(2);
      stroke(0, 0, 192);
      line(this.pos.x, this.pos.y, this.parent.pos.x, this.parent.pos.y);
    }
  }

  this.drawNode = function() {

    if (this.isSelected) {
      stroke(0);
    } else {
      noStroke();
    }

    if (this.isTransmitting) {
      // transmitting
      fill(255, 0, 0);
    } else if (this.senderCount == 1) {
      // receiving
      fill(0, 255, 0);
    } else if (this.senderCount > 1) {
      // collision
      fill(255, 255, 0);
    } else if (this.messages.length > 0) {
      // pending transmission
      var alpha = map(this.timer, 0, this.period, 0, 255);
      fill(0, 0, 0, alpha);
    } else {
      // idle
      fill(255);
    }

    // paint root node square
    if (id == 0) {
      rect(this.pos.x - nodeSize / 2, this.pos.y - nodeSize / 2, nodeSize, nodeSize);
    } else {
      ellipse(this.pos.x, this.pos.y, nodeSize);
    }
    pop();
  }

  this.drawID = function() {
    push();
    textSize(12);
    text(this.id, this.pos.x + nodeSize / 2, this.pos.y - nodeSize / 2);
  }

  this.drawField = function() {
    if (this.isTransmitting) {
      noStroke();
      fill(0, 0, 255, 64);
      ellipse(this.pos.x, this.pos.y, range * 2);
    }
  }
}

function isPresent(array, msg) {
  for (var i in array) {
    if (isEqual(array[i], msg)) {
      return true;
    }
  }
  return false;
}

function isEqual(a, b) {
  return ((a.id == b.id) && (a.distance == b.distance) && (a.type == b.type));
}
