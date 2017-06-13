/*************************************************************
Filename: neato-controller.js

Description: This file is to be run on the main computer. It
connects multiple dual shock controllers and sends their
inputs to the server

Author: tlee
Notes:
    first release 5/17/17
    add array for storing x and y 6/1/17
*************************************************************/

const HID = require('node-hid');
var dualShock = require('dualshock-controller');
//var socket = require('socket.io-client')('http://localhost:3000');
var socket = require('socket.io-client')('http://ubuntu-cdr.local:3000');

// values for dual-shock 3
const vendorId = 1356;
const productId = 616;

// global vars for direction and speed
var LWheelDist = 0;
var RWheelDist = 0;
const DIST = 10000;  //infinite distance to drive

// arrays to store neatos and controllers

var speed_multiplier=[];
var controllers=[];
var speed=[];
var turnSpeed=[];
var turnEffort=[];
var x=[];
var y=[];

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
    speed[indexNumber] = (data.y - 127)*350/127;
    y[indexNumber] = Math.sign(speed[indexNumber]);  // direction of travel
    speed[indexNumber] = Math.abs(speed[indexNumber]); //speed is always positive for drive commands
    sendDriveMessage(indexNumber);
  });

  //right controller : used for left right control
  controllers[controllerNumber].on('right:move', function(data) {
    console.log('right:', data);
    x[indexNumber] = Math.sign(data.x - 127);
    turnSpeed[indexNumber] = Math.abs(data.x - 127)*350/127;  //speed is always positive
    turnEffort[indexNumber] = 1 - Math.abs((data.x - 127) / 127);  // % of the turn to take
    sendDriveMessage(indexNumber);
  });

  controllers[controllerNumber].on('l1:press', function(data){
//    console.log('stopped');
    speed[indexNumber] = 0;
//    x[indexNumber] = 0;
    y[indexNumber] = 0;
//    turnSpeed[indexNumber] = 0;
//    turnEffort[indexNumber] = 0;
    sendDriveMessage(indexNumber);
//      console.log('25% speed');
//      speed_multiplier[indexNumber] = 0.25;
  });

  controllers[controllerNumber].on('r1:press', function(data){
//    console.log('stopped');
//    speed[indexNumber] = 0;
    x[indexNumber] = 0;
//    y[indexNumber] = 0;
    turnSpeed[indexNumber] = 0;
    turnEffort[indexNumber] = 0;
    sendDriveMessage(indexNumber);
//      console.log('25% speed');
//      speed_multiplier[indexNumber] = 0.25;
  });

  //Functions to change the maximum speed of the robot

  //half speed
  controllers[controllerNumber].on('x:press', function(data){
//      console.log('25% speed');
      speed_multiplier[indexNumber] = 0.25;
  });


  //half speed
  controllers[controllerNumber].on('circle:press', function(data){
//      console.log('50% speed');
      speed_multiplier[indexNumber] = 0.5;
  });

  // 75% speed
  controllers[controllerNumber].on('triangle:press', function(data){
//      console.log('75% speed');
      speed_multiplier[indexNumber] = .75;
  });

  //reset speed multiplier to 1
  // square is full speed
  controllers[controllerNumber].on('square:press', function(data){
//      console.log('100% speed');
      speed_multiplier[indexNumber] = 1;
  });
};

// send a drive message to the corresponding neato
function sendDriveMessage(neatoNumber) {
  var l,r;
  // if y is 0 then pivot in place
  if (y[neatoNumber] == 0) {
    // turn left
    if (x[neatoNumber] < 0) {
      l = -1;
      r = 1;
      speed[neatoNumber] = turnSpeed[neatoNumber];
    }
    else if (x[neatoNumber] > 0 ) {
      l = 1;
      r = -1;
      speed[neatoNumber] = turnSpeed[neatoNumber];
    }
    else {
      l = 0;
      r = 0;
      // hack to stop the robot
      socket.emit('drive2Server', {'NeatoNumber': neatoNumber, 'LWheelDist':1, 'RWheelDist':1, 'Speed':1});
    }
  }

  // y > 0 drive forward
  else if (y[neatoNumber] > 0) {
    l = 1;
    r = 1;

    // turn the robot slightly based on the turn effort
    //console.log(turnSpeed);
    // slight left
    console.log("turnEffort:", turnEffort[neatoNumber]);
    if (x[neatoNumber] < 0) {
      r = r * turnEffort[neatoNumber];
      //l = l * (turnEffort * 0.8);
    }
    else if (x[neatoNumber] > 0) {
      l = l * turnEffort[neatoNumber];
      //r = r * (turnEffort * 0.8);
    }
  }

  else if (y[neatoNumber] < 0) {
    l = -1;
    r = -1;
    // turn the robot slightly based on the turn effort
    //console.log(turnSpeed);
    // slight left
    //turnEffort = Math.abs(x / 128);
//    console.log("turnEffort:", turnEffort[neatoNumber]);
    if (x[neatoNumber] < 0) {
      r = r * turnEffort[neatoNumber];
      //l = l * (turnEffort * 0.8);
    }
    else if (x[neatoNumber] > 0) {
      l = l * turnEffort[neatoNumber];
      //r = r * (turnEffort * 0.8);
    }
  }

  LWheelDist = l * DIST;
  RWheelDist = r * DIST;
  socket.emit('drive2Server', {'NeatoNumber': neatoNumber, 'LWheelDist':LWheelDist,
    'RWheelDist':RWheelDist, 'Speed':speed[neatoNumber]*speed_multiplier[neatoNumber]});
  console.log(speed_multiplier);
//  console.log(x);
//  console.log(y);
  console.log(neatoNumber);
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
  speed.push(0);
  turnSpeed.push(0);
  turnEffort.push(0);
  x.push(0);
  y.push(0);  
  bindHandlers(controllerNumber);
};
