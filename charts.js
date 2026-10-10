/* Dependency-free SVG charts. Works with a plain <script> tag. */
(function (global) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  let nextId = 0;
  function svgElement(tag, attributes = {}, text) {
    const element = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function points(data) {
    if (!Array.isArray(data)) throw new TypeError('data must be an array');
    return data.map((point, index) => {
      const x = Array.isArray(point) ? point[0] : point?.x;
      const y = Array.isArray(point) ? point[1] : point?.y;
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new TypeError(`Point ${index} must contain finite numeric x and y values`);
      }
      return { x, y };
    });
  }
  function domain(data, key, explicit) {
    if (explicit !== undefined) {
      if (!Array.isArray(explicit) || explicit.length !== 2 ||
          !explicit.every(Number.isFinite) || explicit[0] >= explicit[1] ||
          !Number.isFinite(explicit[1] - explicit[0])) {
        throw new TypeError(`${key}Domain must be [minimum, maximum] with minimum < maximum`);
      }
      return explicit.slice();
    }
    if (!data.length) return [0, 1];
    let min = Infinity, max = -Infinity;
    for (const point of data) { min = Math.min(min, point[key]); max = Math.max(max, point[key]); }
    const padding = min === max ? Math.max(Math.abs(min) * 0.05, 1) : (max - min) * 0.05;
    const result = [min - padding, max + padding];
    if (!result.every(Number.isFinite) || !Number.isFinite(result[1] - result[0]) || result[0] === result[1]) {
      throw new RangeError('Coordinate range is too large to render; rescale the data');
    }
    return result;
  }
  function validate(options, data) {
    if (!['scatter', 'line'].includes(options.type)) throw new TypeError('type must be scatter or line');
    for (const key of ['height', 'pointRadius', 'lineWidth']) {
      if (!Number.isFinite(options[key]) || options[key] <= 0) throw new TypeError(`${key} must be positive`);
    }
    if (options.height < 180) throw new RangeError('height must be at least 180');
    if (!Number.isInteger(options.ticks) || options.ticks < 2 || options.ticks > 20) {
      throw new RangeError('ticks must be an integer between 2 and 20');
    }
    domain(data, 'x', options.xDomain);
    domain(data, 'y', options.yDomain);
  }
  const format = value => Number(value.toPrecision(5)).toString();

  class Chart {
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.querySelector(container) : container;
      if (!this.container || this.container.nodeType !== 1) throw new TypeError('Provide a container element or valid selector');
      this.options = { type: 'scatter', height: 320, ticks: 5, color: '#2563eb',
        pointRadius: 4, lineWidth: 2, showPoints: true, title: '', xLabel: 'X', yLabel: 'Y', ...options };
      this.data = points(options.data ?? []);
      validate(this.options, this.data);
      this.id = `vanilla-chart-${++nextId}`;
      this.svg = svgElement('svg', { role: 'img', 'aria-labelledby': `${this.id}-title ${this.id}-description` });
      this.svg.style.cssText = 'display:block;width:100%;height:auto;font-family:system-ui,sans-serif';
      this.container.append(this.svg);
      this.render();
      this.observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.render()) : null;
      this.observer?.observe(this.container);
    }
    update(data, options = {}) {
      if (this.destroyed) throw new Error('Cannot update a destroyed chart');
      const nextData = points(data);
      const nextOptions = { ...this.options, ...options };
      validate(nextOptions, nextData);
      this.data = nextData;
      this.options = nextOptions;
      this.render();
      return this;
    }
    render() {
      if (this.destroyed) return;
      const o = this.options;
      const width = Math.max(280, this.container.clientWidth || 640), height = o.height;
      const left = 72, right = width - 24, top = 40, bottom = height - 58;
      const [xmin, xmax] = domain(this.data, 'x', o.xDomain);
      const [ymin, ymax] = domain(this.data, 'y', o.yDomain);
      const x = value => left + (value - xmin) / (xmax - xmin) * (right - left);
      const y = value => bottom - (value - ymin) / (ymax - ymin) * (bottom - top);
      const root = this.svg;
      root.replaceChildren();
      root.setAttribute('viewBox', `0 0 ${width} ${height}`);
      root.append(svgElement('title', { id: `${this.id}-title` }, o.title || `${o.type} chart`));
      root.append(svgElement('desc', { id: `${this.id}-description` },
        `${this.data.length} points. ${o.xLabel} ranges from ${format(xmin)} to ${format(xmax)}. ${o.yLabel} ranges from ${format(ymin)} to ${format(ymax)}.`));
      const label = (px, py, text, extra = {}) => root.append(svgElement('text', {
        x: px, y: py, fill: '#475569', 'font-size': 11, ...extra
      }, text));
      if (o.title) label(left, 22, o.title, { 'font-size': 15, 'font-weight': 600 });
      for (let i = 0; i < o.ticks; i++) {
        const fraction = i / (o.ticks - 1);
        const px = left + fraction * (right - left), py = bottom - fraction * (bottom - top);
        root.append(svgElement('line', { x1: px, y1: top, x2: px, y2: bottom, stroke: '#e2e8f0' }));
        root.append(svgElement('line', { x1: left, y1: py, x2: right, y2: py, stroke: '#e2e8f0' }));
        label(px, bottom + 20, format(xmin + fraction * (xmax - xmin)), { 'text-anchor': 'middle' });
        label(left - 10, py + 4, format(ymin + fraction * (ymax - ymin)), { 'text-anchor': 'end' });
      }
      root.append(svgElement('path', { d: `M ${left} ${top} V ${bottom} H ${right}`, fill: 'none', stroke: '#64748b' }));
      label((left + right) / 2, height - 12, o.xLabel, { 'text-anchor': 'middle' });
      label(16, (top + bottom) / 2, o.yLabel, {
        'text-anchor': 'middle', transform: `rotate(-90 16 ${(top + bottom) / 2})`
      });
      const defs = svgElement('defs');
      const clip = svgElement('clipPath', { id: `${this.id}-clip` });
      clip.append(svgElement('rect', { x: left, y: top, width: right - left, height: bottom - top }));
      defs.append(clip);
      root.append(defs);
      const marks = svgElement('g', { 'clip-path': `url(#${this.id}-clip)` });
      if (o.type === 'line' && this.data.length) {
        marks.append(svgElement('path', {
          d: this.data.map((p, i) => `${i ? 'L' : 'M'} ${x(p.x)} ${y(p.y)}`).join(' '),
          fill: 'none', stroke: o.color, 'stroke-width': o.lineWidth, 'stroke-linejoin': 'round'
        }));
      }
      if (o.type === 'scatter' || o.showPoints) {
        for (const point of this.data) {
          const circle = svgElement('circle', { cx: x(point.x), cy: y(point.y), r: o.pointRadius, fill: o.color });
          circle.append(svgElement('title', {}, `${o.xLabel}: ${point.x}, ${o.yLabel}: ${point.y}`));
          marks.append(circle);
        }
      }
      root.append(marks);
      if (!this.data.length) label((left + right) / 2, (top + bottom) / 2, 'No data', { 'text-anchor': 'middle' });
    }
    destroy() {
      this.observer?.disconnect();
      this.svg.remove();
      this.destroyed = true;
    }
  }
  global.VanillaCharts = Object.freeze({ Chart });
})(globalThis);
