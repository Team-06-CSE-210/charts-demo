# Vanilla charts

A dependency-free JavaScript library for scatter plots and line charts. Open `index.html` in a browser to run the demo. No install step, build tool, external font, or network request is needed.

Use the demo's **Add coordinates** form to append an X/Y point to both charts. Negative values and decimals are supported. The line connects points in insertion order. **Switch data** replaces all current points with the next sample, including any points you added. Added points last until you switch data or reload the page.

## Usage

```html
<div id="chart"></div>
<script src="charts.js"></script>
<script>
  const chart = new VanillaCharts.Chart('#chart', {
    type: 'line',
    data: [[0, 2], [1, 4], [2, 3]],
    title: 'Measurements',
    xLabel: 'Time',
    yLabel: 'Value'
  });
  // Replace data and optionally change settings:
  chart.update([{ x: 0, y: 5 }, { x: 1, y: 8 }], { color: '#dc2626' });
  // When finished: chart.destroy();
</script>
```

The container can be an element or a CSS selector. Each point can be `[x, y]` or `{ x, y }`. Values must be finite numbers; numeric strings are rejected. The library copies coordinates, so it does not sort or modify your array.

| Option | Default | Purpose |
| --- | --- | --- |
| `type` | `'scatter'` | `'scatter'` or `'line'` |
| `data` | `[]` | Coordinates supplied to the constructor |
| `height` | `320` | Chart height, at least 180 |
| `ticks` | `5` | Number of evenly spaced ticks per axis, 2 through 20 |
| `color` | `'#2563eb'` | SVG color for data marks |
| `pointRadius` | `4` | Positive circle radius |
| `lineWidth` | `2` | Positive line width |
| `showPoints` | `true` | Show circles on a line chart |
| `title` | `''` | Visible chart title |
| `xLabel`, `yLabel` | `'X'`, `'Y'` | Axis labels |
| `xDomain`, `yDomain` | Automatic | Explicit `[minimum, maximum]` axis bounds |

`update(data, options)` replaces the data and merges settings. It returns the chart for chaining. Invalid updates throw before changing the existing state. `destroy()` disconnects the resize observer and removes only this chart's SVG. Create separate instances for separate charts.

## Approach and implementation

I separated the problem into data validation, coordinate conversion, and drawing. Both chart types need the same axes, so one `Chart` class handles layout and scales. Only the data marks depend on the chart type.

I chose SVG because the browser already supports paths, circles, text, and clipping. It scales sharply and its elements can be inspected in browser tools. Canvas would suit very large datasets better, but SVG keeps this small library straightforward to understand.

1. **Normalize the coordinates.** `points()` converts both input formats into `{ x, y }` objects. It rejects missing values, `NaN`, and infinity. Constructor settings and updates pass through `validate()`.
2. **Find the data bounds.** `domain()` scans each coordinate to find its minimum and maximum. It adds 5% padding so marks do not sit against the chart edges. A constant coordinate gets padding of at least one unit to avoid division by zero. Empty data uses `[0, 1]`. Explicit domains override automatic bounds. Unrepresentable numeric ranges throw an error.
3. **Reserve space for labels.** `render()` reads the container width, uses the configured height, and reserves margins. The remaining rectangle is the plotting area. The logical width is at least 280 pixels; narrower containers scale the whole SVG down.
4. **Convert coordinates to pixels.** Each value becomes a fraction of its axis range, then a position inside the plotting rectangle. SVG's vertical coordinate increases downward, so the Y conversion subtracts from the bottom.

```text
xFraction = (x - xMin) / (xMax - xMin)
pixelX = left + xFraction * plotWidth

yFraction = (y - yMin) / (yMax - yMin)
pixelY = bottom - yFraction * plotHeight
```

For example, in an X domain of `[0, 10]`, the value `5` appears halfway across the plotting area. In a Y domain of `[0, 100]`, `100` appears at the top and `0` at the bottom.

5. **Draw the shared frame.** The library creates equally spaced grid lines and tick labels, then the left and bottom axes. The axes frame the plotting area; they do not move to the numeric zero position. Tick labels use five significant digits. Axis labels and the optional title are SVG text nodes.
6. **Draw the data.** A scatter plot creates one circle per point. A line chart creates a single SVG path: `M` moves to the first point and `L` connects every following point with a straight segment. Lines follow input order. Sort your own data by X first if that is the order you want. Optional circles make individual line coordinates visible, including a single-point dataset.
7. **Clip the marks.** An SVG `clipPath` keeps data marks inside the plotting rectangle, including when explicit domains exclude some coordinates. Unique IDs prevent collisions between chart instances.
8. **Handle changes.** `update()` validates and stores new data, then redraws the SVG. A native `ResizeObserver` redraws when the container changes size. In browsers without that API, calling `render()` manually refreshes the layout. Redrawing is simple and linear in the number of points.

The implementation uses `createElementNS()` to create SVG elements and `textContent` for labels. It does not insert user text as HTML. Each chart has an accessible title and a description of its point count and bounds. Circles have native hover titles with their coordinates. These summaries do not replace a full accessible data table when one is needed.

## Scope and tradeoffs

This library uses linear numeric axes and one dataset per chart. It does not implement dates, logarithmic scales, multiple series, animation, zoom, or custom tooltips. Ticks are evenly spaced rather than rounded to conventional intervals. Long labels can exceed the fixed margins. Large datasets create many SVG nodes; a canvas renderer or data reduction would be the next step for that use case.

## Verification

Run `node charts.test.cjs` for dependency-free checks of both renderers, coordinate mapping, explicit-domain clipping, invalid updates, empty and constant data, and cleanup. The tests use a small DOM substitute, so they verify generated elements and geometry, not browser layout or appearance.
