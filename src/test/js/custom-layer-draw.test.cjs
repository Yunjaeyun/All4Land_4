const { test } = require('node:test');
const assert = require('node:assert/strict');
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
    class Overlay {
        constructor(options) { this.options = options; }
        setMap(map) { this.options.map = map; }
        setOptions(options) { Object.assign(this.options, options); }
        addListener() {}
    }
    const listeners = {};
    const map = { options: {}, get() { return false; },
        addListener(name, callback) { listeners[name] = callback; },
        setOptions(options) { Object.assign(this.options, options); } };
    const revoked = [];
    let urlId = 0;
    const context = { window: { addEventListener() {}, dispatchEvent() {} }, document,
        CustomEvent: class { constructor(name, options) { this.type = name; this.detail = options?.detail; } },
        URL: { createObjectURL() { return `blob:test-${++urlId}`; }, revokeObjectURL(url) { revoked.push(url); } },
        google: { maps: { Marker: Overlay, Polygon: Overlay, Polyline: Overlay,
            Rectangle: Overlay, Circle: Overlay, SymbolPath: { CIRCLE: 'circle' },
            event: { clearInstanceListeners() {} } } } };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../main/resources/static/js/custom-layer/draw.js'), 'utf8'), context);
    return { draw: new context.window.CustomLayerDraw(map), document, map, listeners, revoked };
}
const point = (lat, lng) => ({ toJSON: () => ({ lat, lng }) });

test('polygon requires three points; finishing creates a selectable draft', () => {
    const { draw } = workspace();
    draw.setMode('polygon');
    draw.click(point(51, -0.1)); draw.click(point(51.1, -0.1));
    draw.finish(); assert.equal(draw.items.length, 0);
    draw.click(point(51.1, -0.2)); draw.finish();
    assert.equal(draw.items.length, 1);
    assert.equal(draw.items[0].type, 'polygon');
    assert.equal(draw.selected.overlay.options.editable, true);
});
test('rectangle is normalized and degenerate rectangle is rejected', () => {
    const { draw } = workspace();
    draw.setMode('rectangle'); draw.click(point(52, 1)); draw.click(point(51, -1));
    const bounds = draw.items[0].overlay.options.bounds;
    assert.equal(bounds.north, 52); assert.equal(bounds.west, -1);
    draw.setMode('rectangle'); draw.click(point(51, 0)); draw.click(point(51, 1));
    assert.equal(draw.items.length, 1);
});
test('cancel and tab departure discard only unfinished geometry', () => {
    const { draw, document } = workspace();
    draw.add('marker', { lat: 51, lng: 0 });
    draw.setMode('polygon'); draw.click(point(51, 0));
    const preview = draw.preview;
    document.getElementById('layer-add').hidden = true;
    draw.syncActive();
    assert.equal(draw.vertices.length, 0); assert.equal(preview.options.map, null);
    assert.equal(draw.items.length, 1); assert.equal(draw.mode, 'select');
});
test('registration validates metadata and groups only new draft shapes', () => {
    const { draw, document } = workspace();
    draw.add('marker', { lat: 51, lng: 0 });
    draw.register(); assert.equal(draw.layers.length, 0);
    document.getElementById('layer-name').value = '노을';
    document.getElementById('layer-month').value = '9';
    document.getElementById('layer-time').value = '18:00';
    draw.register(); assert.equal(draw.layers.length, 1);
    const firstLayer = draw.items[0].layerId;
    draw.add('circle', { center: { lat: 51, lng: 0 }, radius: 100 });
    document.getElementById('layer-name').value = '산책';
    draw.register(); assert.equal(draw.layers.length, 2);
    assert.equal(draw.items[0].layerId, firstLayer);
    assert.notEqual(draw.items[1].layerId, firstLayer);
    draw.select(draw.items[1]); draw.removeSelected();
    assert.equal(draw.layers.length, 1); assert.equal(draw.items.length, 1);
});
test('circle radius uses geodesic distance', () => {
    const { draw } = workspace();
    const circle = draw.geometry('circle', [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }]);
    assert.ok(circle.radius > 111000 && circle.radius < 112000);
});

test('double-click completes a line once without duplicate endpoint or zoom', () => {
    const { draw, map, listeners } = workspace();
    draw.setMode('polyline');
    assert.equal(map.options.disableDoubleClickZoom, true);
    listeners.click({ latLng: point(51, 0), domEvent: { detail: 1 } });
    listeners.click({ latLng: point(52, 1), domEvent: { detail: 1 } });
    listeners.click({ latLng: point(52, 1), domEvent: { detail: 2 } });
    listeners.dblclick({ latLng: point(52, 1) });
    assert.equal(draw.items.length, 1);
    assert.equal(draw.items[0].overlay.options.path.length, 2);
    assert.equal(draw.mode, 'select');
    assert.equal(map.options.disableDoubleClickZoom, false);
    listeners.dblclick({ latLng: point(52, 1) });
    assert.equal(draw.items.length, 1);
});

test('polygon double-click requires three points and ignores inactive panel', () => {
    const { draw, document } = workspace();
    draw.setMode('polygon');
    draw.click(point(51, 0));
    draw.doubleClick({ latLng: point(52, 1) });
    assert.equal(draw.items.length, 0);
    draw.doubleClick({ latLng: point(53, 0) });
    assert.equal(draw.items.length, 1);
    assert.equal(draw.items[0].overlay.options.paths.length, 3);
    draw.setMode('polygon');
    document.getElementById('layer-add').hidden = true;
    draw.doubleClick({ latLng: point(54, 0) });
    assert.equal(draw.vertices.length, 0);
});

function registerLayer(draw, document, name, month, time) {
    document.getElementById('layer-name').value = name;
    document.getElementById('layer-month').value = String(month);
    document.getElementById('layer-time').value = time;
    draw.add('circle', { center: { lat: 51, lng: 0 }, radius: 100 });
    draw.register();
    return draw.layers.at(-1);
}

test('query includes boundaries, handles overnight hours, and preserves manual visibility', () => {
    const { draw, document, map } = workspace();
    const a = registerLayer(draw, document, '오후', 9, '17:00');
    registerLayer(draw, document, '밤', 9, '23:00');
    registerLayer(draw, document, '새벽', 9, '01:00');
    registerLayer(draw, document, '다른 월', 10, '18:00');
    document.getElementById('layer-add').hidden = true;
    document.getElementById('layer-query').hidden = false;
    document.getElementById('query-month').value = '9';
    document.getElementById('query-start').value = '17:00';
    document.getElementById('query-end').value = '19:00';
    draw.query();
    assert.equal(draw.items[0].overlay.options.map, map);
    assert.equal(draw.items[1].overlay.options.map, null);
    assert.equal(draw.items[3].overlay.options.map, null);
    draw.toggleLayer(a.id);
    document.getElementById('layer-query').hidden = true;
    document.getElementById('layer-add').hidden = false;
    draw.syncActive();
    assert.equal(draw.items[0].overlay.options.map, null);
    assert.equal(draw.items[1].overlay.options.map, map);
    document.getElementById('layer-query').hidden = false;
    document.getElementById('query-start').value = '22:00';
    document.getElementById('query-end').value = '02:00';
    draw.query();
    assert.equal(draw.layers.filter((layer) => draw.matches(layer)).length, 2);
});

test('editing metadata updates current filter without changing geometry; cancel preserves metadata', () => {
    const { draw, document } = workspace();
    const layer = registerLayer(draw, document, '원본', 9, '18:00');
    const overlay = draw.items[0].overlay;
    draw.editLayer(layer.id);
    document.getElementById('edit-layer-name').value = '취소할 이름';
    draw.closeEdit();
    assert.equal(layer.name, '원본');
    draw.editLayer(layer.id);
    document.getElementById('edit-layer-name').value = '수정';
    document.getElementById('edit-layer-month').value = '10';
    document.getElementById('edit-layer-time').value = '20:30';
    draw.saveEdit();
    assert.equal(layer.name, '수정'); assert.equal(layer.month, 10); assert.equal(layer.time, '20:30');
    assert.equal(draw.items[0].overlay, overlay);
    assert.equal(document.getElementById('layer-edit-form').hidden, true);
    draw.editLayer(layer.id);
    document.getElementById('edit-layer-time').value = '25:00';
    draw.saveEdit();
    assert.equal(layer.time, '20:30');
    assert.equal(document.getElementById('layer-edit-form').hidden, false);
});

test('photos belong to layers, are replaced safely and revoked on whole-layer deletion', () => {
    const { draw, document, revoked } = workspace();
    document.getElementById('layer-photo').files = [{ type: 'image/png', size: 100 }];
    const layer = registerLayer(draw, document, '사진', 9, '18:00');
    const first = layer.photoUrl;
    assert.ok(first);
    draw.editLayer(layer.id);
    document.getElementById('edit-layer-photo').files = [{ type: 'image/jpeg', size: 200 }];
    draw.saveEdit();
    assert.notEqual(layer.photoUrl, first);
    assert.ok(revoked.includes(first));
    const second = layer.photoUrl;
    draw.select(draw.items[0]);
    draw.deleteLayer(layer.id);
    assert.equal(draw.items.length, 0); assert.equal(draw.layers.length, 0);
    assert.equal(draw.selected, null); assert.ok(revoked.includes(second));
});
