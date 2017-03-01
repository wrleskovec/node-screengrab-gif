#!/usr/bin/env node
const x11 = require('x11');
const notifier = require('node-notifier');
const _ = require('lodash');
const spawn = require('child_process').spawn;
const exec = require('child_process').exec;

function getXDimensions(pointA, pointB) {
  const width = Math.abs(pointB.rootX - pointA.rootX);
  const height = Math.abs(pointB.rootY - pointA.rootY);
  return { width, height };
}
function getXOrigin(pointA, pointB) {
  const x = (pointB.rootX >= pointA.rootX) ? pointA.rootX : pointB.rootX;
  const y = (pointB.rootY >= pointA.rootY) ? pointA.rootY : pointB.rootY;
  return { x, y };
}

let interval;
let recording = false;
let recordPs;
let startPoint;
let dimensions;
let origin;


const recordStart = _.debounce(() => {
  exec('pkill -9 notify', (err, stdout, stderr) => {
    if (err) {
      console.log(err);
      return;
    }
    console.log(`stdout: ${stdout}`);
    console.log(`stderr: ${stderr}`);
  });
  recording = true;
  const args = [
    '-video_size',
    `${dimensions.width}x${dimensions.height}`,
    '-framerate',
    '25',
    '-f',
    'x11grab',
    '-i',
    `:0.0+${origin.x},${origin.y}`,
    'output.mp4'
  ];
  recordPs = spawn('ffmpeg', args);
  recordPs.stderr.on('data', (data) => {
    console.log(`stderr: ${data}`);
  });
  recordPs.on('close', () => {
    const date = new Date().toLocaleTimeString().replace(' ', '');
    exec(`ffmpeg -i output.mp4 -r 10 -f image2pipe -vcodec ppm - | convert -delay 9 -loop 0 - ~/${date}.gif`, () => {
      exec('rm output.mp4', (err, stdout, stderr) => {
        if (err) {
          console.error(`exec error: ${err}`);
          return;
        }
        notifier.notify(`Gif saved as ${date}.gif`);
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);
      });
    });
  });
}, 100);

x11.createClient((err, display) => {
  const X = display.client;
  const root = display.screen[0].root;
  let pressed = false;
  let selected = false;

  interval = setInterval(() => {
    X.QueryPointer(root, (err2, res) => {
      if (err2) {
        console.error(err2);
      }
      if (!selected && !pressed && res.keyMask === 256) {
        pressed = true;
        startPoint = res;
        notifier.notify({
          title: 'Start Point',
          message: `X: ${res.rootX}, Y: ${res.rootY}`
        });
      } else if (!selected && pressed && res.keyMask === 0) {
        pressed = false;
        selected = true;
        dimensions = getXDimensions(startPoint, res);
        origin = getXOrigin(startPoint, res);
        notifier.notify({
          title: 'Dimensions',
          message: 'Middle click to start'
        });
      } else if (selected && res.keyMask === 512 && recording) {
        notifier.notify('Recording Ended');
        recordPs.kill('SIGINT');
        recording = false;

        clearInterval(interval);
      } else if (selected && res.keyMask === 512 && !recording) {
        recordStart();
      }
    });
  }, 50);
  notifier.notify({
    title: 'node-screengrab-gif',
    message: 'hello'
  });
});
