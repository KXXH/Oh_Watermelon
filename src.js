const CLIENT_WIDTH = document.documentElement.clientWidth;
const CLIENT_HEIGHT = document.documentElement.clientHeight;

const INIT_STATE = 1;
const DIRTY_STATE = 2;
const DISPLAY_HEIGHT = Math.min(800, CLIENT_HEIGHT);
const DISPLAY_WIDTH = Math.min(600, CLIENT_WIDTH);
const INITZONE_HEIGHT = 100;
const SENSOR_HEIGHT = 10;
const SENSOR_PADDING_TOP = 50;
const WALL_THICKNESS = 60;

const R_BY_LEVEL = [18, 27, 40, 40, 55, 75, 75, 82, 95, 110, 110];
const SCORE_BY_LEVEL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 110, -1];
const COLOR_BY_LEVEL = [
  "#a64083",
  "#e61623",
  "#ff8c18",
  "#6edf1e",
  "#d43639",
  "#f5955f",
  "#fadf5b",
  "#f9f5e9",
  "#eb8299",
  "#2f6a2a"
];
const TOP_LEVEL = 10;
const INIT_MAX_LEVEL = 3;
const SCALE = 1;

var default_wall_opt = {
  isStatic: true,
  collisionFilter: { category: DIRTY_STATE },
  render: {
    fillStyle: "white"
  }
};

var Engine = Matter.Engine,
  Render = Matter.Render,
  World = Matter.World,
  Bodies = Matter.Bodies,
  Body = Matter.Body,
  Events = Matter.Events;

var engine = Engine.create();

var render = Render.create({
  element: document.body,
  engine: engine,
  options: { wireframes: false, height: DISPLAY_HEIGHT, width: DISPLAY_WIDTH }
});

var score = 0;
var uncertain_score = 0;
var boxA, sensor_high, sensor_low;
addCircle();
addWalls();

Engine.run(engine);

Render.run(render);
render.options.background = "#ffeba2";

var mousedown = false;
var last_mouse_pos = {};
var move_active = true;

var mousedownFunc = function (event) {
  mousedown = true;
  last_mouse_pos = event;
};
var mousemoveFunc = function (event) {
  if (mousedown && move_active) {
    var target = {
      x: boxA.position.x + (event.x - last_mouse_pos.x),
      y: boxA.position.y
    };
    target.x = Math.min(
      DISPLAY_WIDTH - boxA.circleRadius - WALL_THICKNESS / 2,
      target.x
    );
    target.x = Math.max(boxA.circleRadius + WALL_THICKNESS / 2, target.x);
    Body.setPosition(boxA, target);
    last_mouse_pos = event;
  }
};
var mouseupFunc = function () {
  if (!mousedown) return;
  mousedown = false;
  Body.setStatic(boxA, false);
  boxA = null;
  setTimeout(addCircle, 1000);
};

var touchStart = false;
var last_touch_pos = {};
var touchStartFunc = function (event) {
  touchStart = true;
  last_touch_pos = event;
};
var touchMoveFunc = function (event) {
  if (touchStart && move_active) {
    var target = {
      x: boxA.position.x + (event.touches[0].clientX - last_touch_pos.touches[0].clientX),
      y: boxA.position.y
    };
    target.x = Math.min(
      DISPLAY_WIDTH - boxA.circleRadius - WALL_THICKNESS / 2,
      target.x
    );
    target.x = Math.max(boxA.circleRadius + WALL_THICKNESS / 2, target.x);
    Body.setPosition(boxA, target);
    last_touch_pos = event;
    event.preventDefault();
  }
};
var touchEndFunc = function () {
  if (!touchStart) return;
  touchStart = false;
  Body.setStatic(boxA, false);
  boxA = null;
  setTimeout(addCircle, 1000);
};

document.addEventListener("touchmove", touchMoveFunc);
document.addEventListener("touchend", touchEndFunc);
document.addEventListener("touchstart", touchStartFunc);
document.body.onmousemove = mousemoveFunc;
document.body.onmouseup = mouseupFunc;
document.body.onmousedown = mousedownFunc;
Events.on(engine, "collisionStart", function (event) {
  var pairs = event.pairs;
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i];
    var { bodyA, bodyB } = pair;
    if (include_sensor(bodyA, bodyB)) {
      var sensor = bodyA.isSensor ? bodyA : bodyB;
      var other = bodyA.isSensor ? bodyB : bodyA;
      if (sensor === sensor_high) {
        //gameover();
        setInterval(blink_sensor, 1000);
        setTimeout(check_gameover, 5000);
      }
    }

    if (bodyA.level === bodyB.level && bodyA.level < TOP_LEVEL - 1) {
      var new_pos = {
        x: (bodyA.position.x + bodyB.position.x) / 2,
        y: (bodyA.position.y + bodyB.position.y) / 2
      };

      World.remove(engine.world, bodyA);
      World.remove(engine.world, bodyB);
      var new_score = SCORE_BY_LEVEL[bodyA.level];
      var old_score = SCORE_BY_LEVEL[bodyA.level];
      uncertain_score -= old_score * 2;
      score += new_score;
      refresh_score();
      var new_circle = Bodies.circle(
        new_pos.x,
        new_pos.y,
        R_BY_LEVEL[bodyA.level + 1] * SCALE,
        {
          collisionFilter: {
            category: DIRTY_STATE,
            mask: DIRTY_STATE | INIT_STATE
          },
          render: {
            fillStyle: COLOR_BY_LEVEL[bodyA.level + 1]
          },
          level: bodyA.level + 1
        }
      );
      World.add(engine.world, new_circle);
    }
  }
});

Events.on(engine, "collisionEnd", function (event) {
  var pairs = event.pairs;
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i];
    var { bodyA, bodyB } = pair;
    if (include_sensor(bodyA, bodyB)) {
      var sensor = bodyA.isSensor ? bodyA : bodyB;
      var other = bodyA.isSensor ? bodyB : bodyA;
      if (other.collisionFilter.category === INIT_STATE) {
        Body.set(other, "collisionFilter", {
          category: DIRTY_STATE,
          mask: INIT_STATE | DIRTY_STATE,
          group: 0
        });
      }
    }
  }
});

function addWalls() {
  sensor_high = Bodies.rectangle(
    DISPLAY_WIDTH / 2,
    INITZONE_HEIGHT + SENSOR_PADDING_TOP + SENSOR_HEIGHT / 2,
    DISPLAY_WIDTH + 10,
    10,
    {
      isSensor: true,
      isStatic: true,
      render: {
        strokeStyle: "#f55a3c",
        fillStyle: "transparent",
        lineWidth: 1
      },
      collisionFilter: {
        category: DIRTY_STATE,
        mask: DIRTY_STATE,
        group: 0
      }
    }
  );
  sensor_low = Bodies.rectangle(
    DISPLAY_WIDTH / 2,
    INITZONE_HEIGHT + SENSOR_PADDING_TOP + SENSOR_HEIGHT,
    DISPLAY_WIDTH + 10,
    1,
    {
      isSensor: true,
      isStatic: true,
      collisionFilter: {
        category: INIT_STATE,
        mask: INIT_STATE | DIRTY_STATE,
        group: 0
      },
      render: {
        fillStyle: "transparent",
        strokeStyle: "transparent"
      }
    }
  );
  var ground = Bodies.rectangle(
    DISPLAY_WIDTH / 2,
    DISPLAY_HEIGHT,
    DISPLAY_WIDTH + 10,
    WALL_THICKNESS,
    default_wall_opt
  );
  var wall_left = Bodies.rectangle(
    0,
    DISPLAY_HEIGHT / 2,
    WALL_THICKNESS,
    DISPLAY_HEIGHT,
    default_wall_opt
  );
  var wall_right = Bodies.rectangle(
    DISPLAY_WIDTH,
    DISPLAY_HEIGHT / 2,
    WALL_THICKNESS,
    DISPLAY_HEIGHT,
    default_wall_opt
  );
  World.add(engine.world, [
    sensor_low,
    sensor_high,
    ground,
    wall_left,
    wall_right
  ]);
}

function addCircle() {
  var level = Math.floor(Math.random() * 100) % INIT_MAX_LEVEL;
  //level = 7;
  var r = R_BY_LEVEL[level] * SCALE;
  boxA = Bodies.circle(DISPLAY_WIDTH / 2, INITZONE_HEIGHT / 2, r, {
    isStatic: true,
    collisionFilter: {
      category: INIT_STATE,
      mask: INIT_STATE
    },
    level: level,
    render: {
      fillStyle: COLOR_BY_LEVEL[level]
    },
    /*
    friction: 0,
    frictionAir: 0,
    frictionStatic: 0
    */
    restitution: 0.8
  });
  boxA.touchFlag = false;
  World.add(engine.world, boxA);
  uncertain_score += r;
}

function gameover() {
  score += uncertain_score;
  refresh_score();
  clearTimeout();
  alert("gameover!");
  World.clear(engine.world, true);
  score = uncertain_score = 0;
  refresh_score();
}

function refresh_score() {
  document.getElementById("score").innerText = score;
}

function include_sensor(bodyA, bodyB) {
  return bodyA.isSensor || bodyB.isSensor;
}

function check_gameover() {
  var targetBodies = engine.world.bodies.filter((e) => (!e.isSensor && !e.isStatic));
  if (Matter.Query.collides(sensor_high, targetBodies).length > 0) {
    gameover();
  }
  else {
    clearInterval();
  }
}


function blink_sensor() {

  // if (sensor_high.render.strokeStyle !== "transparent") {
  //   Body.set(sensor_high, "render", {
  //     strokeStyle: "transparent",
  //     fillStyle: "transparent",
  //     lineWidth: 1
  //   })

  // }
  // else {
  //   Body.set(sensor_high, "render", {
  //     strokeStyle: "#f55a3c",
  //     fillStyle: "transparent",
  //     lineWidth: 1
  //   })
  // }


}