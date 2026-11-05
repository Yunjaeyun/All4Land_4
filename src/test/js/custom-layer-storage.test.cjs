const { test } = require('node:test');
const assert = require('node:assert/strict');
const { workspace, registerItem } = require('./custom-layer-test-helpers.cjs');
function storage(env) {
    const store = Object.create(env.context.window.CustomLayerStorage.prototype);
    Object.assign(store, { draw: env.draw, status: {}, saveButton: {}, loadButton: {}, loaded: true, busy: false });
    return store;
}
test('snapshot and restore keep one container with independent feature conditions', async () => {
    const env = workspace(); registerItem(env, 'A', 9, '18:00', 'marker'); registerItem(env, 'B', 10, '12:00');
    const store = storage(env); const snapshot = await store.snapshot();
    assert.equal(snapshot.features.length, 2); assert.equal(snapshot.features[1].shape.radius, 100);
    store.restore(snapshot);
    assert.equal(env.draw.layers, undefined); assert.equal(env.draw.items.length, 2);
    assert.equal(env.draw.items[0].month, 9); assert.equal(env.draw.items[1].month, 10);
    assert.ok(env.draw.items.every((item) => item.registered));
    assert.ok(env.draw.nextId > Math.max(...snapshot.features.map((item) => item.id)));
});
test('save failure preserves current items and permits retry', async () => {
    const env = workspace(); registerItem(env, 'A', 9, '18:00'); const store = storage(env);
    const items = env.draw.items; store.request = async () => { throw new Error('연결 실패'); };
    await store.save(); assert.equal(env.draw.items, items); assert.equal(store.saveButton.disabled, false);
    assert.match(store.status.textContent, /유지/);
});
test('drafts block save and failed initial load cannot overwrite a saved document', async () => {
    const env = workspace(); const store = storage(env); let requests = 0;
    store.request = async () => { requests++; throw new Error('연결 실패'); };
    env.draw.add('marker', { lat: 51, lng: 0 });
    await store.save(); assert.equal(requests, 0);
    env.draw.removeSelected(); store.loaded = false;
    await store.load(); await store.save(); assert.equal(requests, 1); assert.equal(store.saveButton.disabled, true);
});
