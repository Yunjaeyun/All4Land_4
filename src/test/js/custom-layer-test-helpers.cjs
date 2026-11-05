const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function workspace() {
    const elements = new Map();
    const element = () => ({ value: '', hidden: false, disabled: false, textContent: '', children: [],
        addEventListener() {}, setAttribute() {}, removeAttribute() {}, focus() {}, replaceChildren() { this.children = []; },
        append(child) { this.children.push(child); } });
    const document = { body: { dataset: { activeMenu: 'custom-layer' } },
        getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
        querySelectorAll() { return []; }, addEventListener() {}, createElement: element };
    document.getElementById('draw-color').value = '#247b65';
    document.getElementById('layer-query').hidden = true;
    class Overlay {
        constructor(options) { this.options = options; }
        setMap(map) { this.options.map = map; }
        setOptions(options) { Object.assign(this.options, options); }
        addListener() {}
        getPosition() { return { toJSON: () => this.options.position }; }
        getCenter() { return { toJSON: () => this.options.center }; }
        getRadius() { return this.options.radius; }
        getBounds() { return { toJSON: () => this.options.bounds }; }
        getPath() { return { getArray: () => (this.options.path || this.options.paths).map((p) => ({ toJSON: () => p })) }; }
    }
    const listeners = {};
    const map = { options: {}, get() { return false; }, addListener(name, callback) { listeners[name] = callback; },
        setOptions(options) { Object.assign(this.options, options); } };
    const revoked = [];
    let urlId = 0;
    const window = { document, addEventListener() {}, dispatchEvent() {} };
    const context = { window, document,
        CustomEvent: class { constructor(name, options) { this.type = name; this.detail = options?.detail; } },
        URL: { createObjectURL() { return `blob:test-${++urlId}`; }, revokeObjectURL(url) { revoked.push(url); } },
        google: { maps: { Marker: Overlay, Polygon: Overlay, Polyline: Overlay, Rectangle: Overlay, Circle: Overlay,
            SymbolPath: { CIRCLE: 'circle' }, event: { clearInstanceListeners() {} } } } };
    vm.createContext(context);
    for (const file of ['draw.js', 'storage.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../main/resources/static/js/custom-layer', file), 'utf8'), context);
    const draw = new context.window.CustomLayerDraw(map);
    return { draw, document, map, listeners, revoked, context };
}
const point = (lat, lng) => ({ toJSON: () => ({ lat, lng }) });
function registerItem(env, name, month, time, type = 'circle') {
    const { draw, document } = env;
    document.getElementById('layer-name').value = name;
    document.getElementById('layer-month').value = String(month);
    document.getElementById('layer-time').value = time;
    draw.add(type, type === 'marker' ? { lat: 51, lng: 0 } : { center: { lat: 51, lng: 0 }, radius: 100 });
    draw.register();
    return draw.items.at(-1);
}
module.exports = { workspace, point, registerItem };
