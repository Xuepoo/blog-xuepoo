const { createCanvas } = require('canvas');
const canvas = createCanvas(100, 100);
const ctx = canvas.getContext('2d');
const start = Date.now();
let str = "";
for(let i=0; i<10000; i++) {
  str += "a";
  ctx.measureText(str);
}
console.log(Date.now() - start, "ms for measureText");
