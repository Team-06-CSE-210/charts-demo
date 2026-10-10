const assert = require('node:assert/strict');
class Element {
  constructor(tag) { this.tag = tag; this.nodeType = 1; this.attributes = {}; this.children = []; this.style = {}; this.clientWidth = 640; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  append(...children) { this.children.push(...children); children.forEach(child => child.parent = this); }
  replaceChildren() { this.children = []; }
  remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
}
global.document = { createElementNS: (_, tag) => new Element(tag) };
let disconnected = false;
global.ResizeObserver = class { observe() {} disconnect() { disconnected = true; } };
require('./charts.js');
const container = new Element('div');
const chart = new VanillaCharts.Chart(container, { data: [[0, 0], [10, 100]], xDomain: [0, 10], yDomain: [0, 100] });
const marks = () => chart.svg.children.find(child => child.tag === 'g');
assert.equal(marks().children.length, 2);
assert.equal(marks().children[0].attributes.cx, '72');
assert.equal(marks().children[0].attributes.cy, '262');
assert.equal(marks().children[1].attributes.cx, '616');
assert.equal(marks().children[1].attributes.cy, '40');
chart.update([[10, 100], [0, 0]], { type: 'line', showPoints: false });
assert.equal(marks().children[0].attributes.d, 'M 616 40 L 72 262');
assert.match(marks().attributes['clip-path'], /^url\(#vanilla-chart-\d+-clip\)$/);
const previous = chart.data;
assert.throws(() => chart.update([[NaN, 1]]), TypeError);
assert.equal(chart.data, previous);
assert.throws(() => chart.update([], { xDomain: [2, 2] }), TypeError);
chart.update([], { type: 'scatter', xDomain: undefined, yDomain: undefined });
assert.equal(marks().children.length, 0);
assert(chart.svg.children.some(child => child.textContent === 'No data'));
chart.update([{ x: -5, y: 3 }]);
assert.equal(marks().children[0].attributes.cx, '344');
assert.equal(marks().children[0].attributes.cy, '151');
assert.throws(() => chart.update([[Number.MAX_VALUE, 0]]), RangeError);
chart.destroy();
assert.equal(container.children.length, 0);
assert.equal(disconnected, true);
assert.throws(() => chart.update([]), /destroyed/);
console.log('All chart checks passed.');
