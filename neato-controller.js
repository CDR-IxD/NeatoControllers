/*************************************************************
Filename: neato-controller.js

Description: This file is to be run on the main computer. It
connects multiple dual shock controllers and sends their
inputs to the server

Author: tlee
Notes:
    first release 5/17/17
*************************************************************/

const HID = require('node-hid');
var dualShock = require('dualshock-controller');
var socket = require('socket.io-client')('http://localhost:3000');

// values for dual-shock 3
const vendorId = 1356;
const productId = 616;

// global vars for direction and speed
var LWheelDist = 0;
var RWheelDist = 0;
var speed = 0;
var turnSpeed = 0;
var turnEffort = 0;
var x = 0; var y = 0; //placeholders to determine direction
const DIST = 10000;  //infinite distance to drive

// arrays to store neatos and controllers

var speed_multiplier=[];
var controllers=[];

/*******************************Server Functions*******************************/

socket.on('connect', function(){
    socket.emit('storeClientInfo', { clientType: "Controllers"});
});
socket.on('disconnect', function(){});

/*******************************Controller Functions*******************************/

// filter for determining if devices are dual-shock controllers
const isController = function(device) {
  return device.vendorId == vendorId && device.productId == productId;
};

// create an array of all controllers
const devices = HID.devices().filter(isController);

// create a wrapper for the event handlers that binds the index number
var bindHandlers = function(indexNumber) {
  // event handlers
  //make sure you add an error event handler
  controllers[controllerNumber].on('error', function(data) {
    console.log(data);
  });

  controllers[controllerNumber].on('connected', function(data) {
    console.log(data);
  });

  //right-left movement
  controllers[controllerNumber].on('rightLeft:motion', function (data) {
      console.log('RL:', data);
  });

  //forward-back movement
  controllers[controllerNumber].on('forwardBackward:motion', function (data) {
      console.log('FB:', data);
  });
  //up-down movement
  controllers[controllerNumber].on('upDown:motion', function (data) {
      console.log('upDwn:', data);
  });

  //connect the controller
  controllers[controllerNumber].connect();

  // left controller : used for foward/backward driving & speed
  controllers[controllerNumber].on('left:move', function(data) {
    console.log('left:', data);
    speed = data.y * (-350/128) + 350;
    y = -1*Math.sign(speed);  // direction of travel
    speed = Math.abs(speed); //speed is always positive for drive commands
    sendDriveMessage(indexNumber);
  });

  //right controller : used for left right control
  controllers[controllerNumber].on('right:move', function(data) {
    console.log('right:', data);
    x = Math.sign(data.x - 128);
    turnSpeed = Math.abs(data.x * (350/128) - 350);  //speed is always positive
    turnEffort = 1 - Math.abs((data.x - 128) / 128);  // % of the turn to take
    sendDriveMessage(indexNumber);
  });

  //Functions to change the maximum speed of the robot

  //half speed
  controllers[controllerNumber].on('x:press', function(data){
      console.log('25% speed');
      speed_multiplier[indexNumber] = 0.25;
  });

  //half speed
  controllers[controllerNumber].on('circle:press', function(data){
      console.log('50% speed');
      speed_multiplier[indexNumber] = 0.5;
  });

  // 75% speed
  controllers[controllerNumber].on('triangle:press', function(data){
      console.log('75% speed');
      speed_multiplier[indexNumber] = .75;
  });

  //reset speed multiplier to 1
  // square is full speed
  controllers[controllerNumber].on('square:press', function(data){
      console.log('100% speed');
      speed_multiplier[indexNumber] = 1;
  });
};

// send a drive message to the corresponding neato
function sendDriveMessage(neatoNumber) {
  var l,r;
  // if y is 0 then pivot in place
  if (y == 0) {
    // turn left
    if (x < 0) {
      l = -1;
      r = 1;
      speed = turnSpeed;
    }
    else if (x > 0 ) {
      l = 1;
      r = -1;
      speed = turnSpeed;
    }
    else {
      l = 0;
      r = 0;
      // hack to stop the robot
      socket.emit('drive2Server', {'NeatoNumber': neatoNumber, 'LWheelDist':1, 'RWheelDist':1, 'Speed':1});
    }
  }

  // y > 0 drive forward
  else if (y > 0) {
    l = 1;
    r = 1;

    // turn the robot slightly based on the turn effort
    //console.log(turnSpeed);
    // slight left
    console.log("turnEffort:", turnEffort);
    if (x < 0) {
      r = r * turnEffort;
      //l = l * (turnEffort * 0.8);
    }
    else if (x > 0) {
      l = l * turnEffort;
      //r = r * (turnEffort * 0.8);
    }
  }

  else if (y < 0) {
    l = -1;
    r = -1;
    // turn the robot slightly based on the turn effort
    //console.log(turnSpeed);
    // slight left
    //turnEffort = Math.abs(x / 128);
    console.log("turnEffort:", turnEffort);
    if (x < 0) {
      r = r * turnEffort;
      //l = l * (turnEffort * 0.8);
    }
    else if (x > 0) {
      l = l * turnEffort;
      //r = r * (turnEffort * 0.8);
    }
  }

  LWheelDist = l * DIST;
  RWheelDist = r * DIST;
  socket.emit('drive2Server', {'NeatoNumber': neatoNumber, 'LWheelDist':LWheelDist,
    'RWheelDist':RWheelDist, 'Speed':speed*speed_multiplier[neatoNumber]});
  console.log(speed_multiplier);
}

for (var controllerNumber = 0; controllerNumber<devices.length; controllerNumber++) {
  var controller = dualShock(
      {
          //you can use a ds4 by uncommenting this line.
          //config: "dualshock4-generic-driver",
          //if using ds4 comment this line.
          config : "dualShock3",
          //smooths the output from the acelerometers (moving averages) defaults to true
          accelerometerSmoothing : true,
          //smooths the output from the analog sticks (moving averages) defaults to false
          analogStickSmoothing : true,
          indexNumber : controllerNumber
      });
  // append the controller to the array
  controllers.push(controller);
  speed_multiplier.push(1);  
  bindHandlers(controllerNumber);
};