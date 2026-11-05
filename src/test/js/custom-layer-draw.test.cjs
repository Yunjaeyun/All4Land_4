const { test } = require('node:test');
const assert = require('node:assert/strict');
const { workspace, point, registerItem } = require('./custom-layer-test-helpers.cjs');

test('polygon requires three points and completion produces one draft', () => {
    const { draw } = workspace();
    draw.setMode('polygon'); draw.click(point(51, 0)); draw.click(point(52, 1)); draw.finish();
    assert.equal(draw.items.length, 0);
    draw.click(point(53, 0)); draw.finish();
    assert.equal(draw.items.length, 1); assert.equal(draw.items[0].registered, false);
    assert.equal(draw.selected.overlay.options.editable, true);
});
test('a second draft is blocked until the first item is registered or removed', () => {
    const { draw } = workspace();
    draw.add('marker', { lat: 51, lng: 0 });
    draw.setMode('polygon'); assert.equal(draw.mode, 'select');
    draw.add('marker', { lat: 52, lng: 0 }); assert.equal(draw.items.length, 1);
    draw.removeSelected(); assert.equal(draw.items.length, 0);
    draw.setMode('polygon'); assert.equal(draw.mode, 'polygon');
});
test('rectangle normalizes bounds and circle radius is geodesic', () => {
    const { draw } = workspace();
    draw.setMode('rectangle'); draw.click(point(52, 1)); draw.click(point(51, -1));
    assert.equal(draw.items[0].overlay.options.bounds.north, 52);
    draw.removeSelected();
    draw.setMode('rectangle'); draw.click(point(51, 0)); draw.click(point(51, 1));
    assert.equal(draw.items.length, 0);
    const circle = draw.geometry('circle', [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }]);
    assert.ok(circle.radius > 111000 && circle.radius < 112000);
});
test('double-click completes a line once and restores zoom behavior', () => {
    const { draw, map, listeners } = workspace();
    draw.setMode('polyline'); assert.equal(map.options.disableDoubleClickZoom, true);
    listeners.click({ latLng: point(51, 0), domEvent: { detail: 1 } });
    listeners.click({ latLng: point(52, 1), domEvent: { detail: 1 } });
    listeners.click({ latLng: point(52, 1), domEvent: { detail: 2 } });
    listeners.dblclick({ latLng: point(52, 1) });
    assert.equal(draw.items.length, 1); assert.equal(draw.items[0].overlay.options.path.length, 2);
    assert.equal(map.options.disableDoubleClickZoom, false);
});
test('single workspace keeps independent item metadata and query visibility', () => {
    const env = workspace(); const { draw, document, map } = env;
    const a = registerItem(env, '노을', 9, '18:00');
    const b = registerItem(env, '야경', 10, '23:00');
    assert.equal(draw.items.length, 2); assert.equal(draw.layers, undefined);
    document.getElementById('layer-add').hidden = true;
    document.getElementById('layer-query').hidden = false;
    document.getElementById('query-month').value = '9';
    document.getElementById('query-start').value = '17:00'; document.getElementById('query-end').value = '19:00';
    draw.query(); assert.equal(a.overlay.options.map, map); assert.equal(b.overlay.options.map, null);
    draw.toggleItem(a.id); assert.equal(a.overlay.options.map, null);
    document.getElementById('layer-query').hidden = true; document.getElementById('layer-add').hidden = false;
    draw.syncActive(); assert.equal(b.overlay.options.map, map); assert.equal(a.overlay.options.map, null);
});
test('overnight query evaluates each item in the same personal layer', () => {
    const env = workspace(); const { draw, document } = env;
    registerItem(env, '밤', 9, '23:00'); registerItem(env, '새벽', 9, '01:00'); registerItem(env, '낮', 9, '12:00');
    document.getElementById('layer-query').hidden = false;
    draw.filter = { month: 9, start: '22:00', end: '02:00' };
    assert.equal(draw.items.filter((item) => draw.matches(item)).length, 2);
});
test('metadata edits, photos and deletion affect only the selected item', () => {
    const env = workspace(); const { draw, document, revoked } = env;
    const a = registerItem(env, 'A', 9, '18:00'); const b = registerItem(env, 'B', 10, '12:00');
    draw.editItem(a.id); document.getElementById('edit-layer-name').value = '변경';
    document.getElementById('edit-layer-photo').files = [{ type: 'image/png', size: 100 }];
    draw.saveEdit(); assert.equal(a.name, '변경'); assert.equal(b.name, 'B');
    const photo = a.photoUrl; assert.ok(photo);
    draw.deleteItem(a.id); assert.equal(draw.items.length, 1); assert.equal(draw.items[0], b);
    assert.ok(revoked.includes(photo));
});
test('changing tabs cancels only unfinished geometry', () => {
    const env = workspace(); registerItem(env, '보관', 9, '18:00');
    const { draw, document } = env;
    draw.setMode('polygon'); draw.click(point(51, 0));
    document.getElementById('layer-add').hidden = true; draw.syncActive();
    assert.equal(draw.vertices.length, 0); assert.equal(draw.items.length, 1);
});
