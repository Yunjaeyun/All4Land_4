const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { workspace, registerItem } = require('./custom-layer-test-helpers.cjs');

function setup() {
    const env = workspace();
    const create = env.document.createElement;
    env.document.createElement = () => {
        const element = create();
        element.events = {};
        element.attributes = {};
        element.addEventListener = (name, callback) => { element.events[name] = callback; };
        element.setAttribute = (name, value) => { element.attributes[name] = value; };
        element.append = (...children) => element.children.push(...children);
        return element;
    };
    env.document.getElementById('personal-ranking-results').querySelectorAll = () =>
        env.document.getElementById('personal-ranking-results').children.flatMap(row => row.children);
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../main/resources/static/js/custom-layer/ranking.js'), 'utf8'), env.context);
    const handlers = {};
    env.context.window.addEventListener = (name, callback) => { handlers[name] = callback; };
    env.document.getElementById('personal-ranking-order').value = 'interest';
    const storage = { busy: false, shape: item => ({ type: item.type, position: item.overlay.getPosition().toJSON(), color: item.color }) };
    const map = { fitBounds(bounds) { this.bounds = bounds; } };
    const ranking = new env.context.window.CustomLayerRanking(env.draw, storage, map, borough => { map.borough = borough; });
    return { ...env, ranking, storage, map, handlers };
}
const response = { analyzedCount: 1, matchedCount: 1, outsideCount: 0, order: 'interest', regions: [
    { rank: 1, borough: 'Alpha', count: 1, incidentRate: 12.3, bounds: { north: 1, south: 0, east: 1, west: 0 }, featureIds: [1] }
] };

test('ranking sends only visible matching registered features, live geometry and no photos', async () => {
    const env = setup();
    const first = registerItem(env, 'Match', 9, '23:00', 'marker'); first.photoUrl = 'data:image/png;base64,private';
    first.overlay.options.position = { lat: 51.6, lng: -.2 };
    registerItem(env, 'Other month', 10, '23:00', 'marker');
    const hidden = registerItem(env, 'Hidden', 9, '23:00', 'marker'); hidden.visible = false;
    env.document.getElementById('layer-query').hidden = false;
    env.draw.filter = { month: 9, start: '22:00', end: '02:00' };
    let sent;
    env.context.fetch = async (url, request) => { sent = JSON.parse(request.body); return { ok: true, json: async () => response }; };
    await env.ranking.run();
    assert.equal(sent.features.length, 1);
    assert.equal(sent.features[0].photo, null);
    assert.equal(sent.features[0].shape.position.lat, 51.6);
    assert.equal(env.ranking.list.children.length, 1);
    assert.match(env.ranking.status.textContent, /지역 내 1개/);
    const [, included] = env.ranking.list.children[0].children;
    const featureButton = included.children[1].children[0].children[0];
    assert.match(featureButton.textContent, /Match · 마커/);
    featureButton.events.click();
    assert.equal(env.draw.map.position.toJSON().lat, 51.6);
    const button = env.ranking.list.children[0].children[0];
    button.events.click();
    assert.deepEqual(JSON.parse(JSON.stringify(env.map.bounds)), response.regions[0].bounds);
    assert.equal(button.attributes['aria-pressed'], 'true');
    assert.equal(env.map.borough, 'Alpha');
    env.handlers['custom-layer:tab']();
    assert.equal(env.map.borough, null);
});

test('empty or unfinished input does not request a ranking', async () => {
    const env = setup();
    env.context.fetch = () => { throw Error('Must not request'); };
    await env.ranking.run();
    assert.match(env.ranking.status.textContent, /집계할 장소/);
    env.draw.add('marker', { lat: 51, lng: 0 });
    await env.ranking.run();
    assert.match(env.ranking.status.textContent, /등록하거나 삭제/);
});

test('unavailable Google geometry gives a message instead of an unhandled error', async () => {
    const env = setup(); registerItem(env, 'Match', 9, '18:00', 'marker');
    env.storage.shape = () => { throw new TypeError('Geometry unavailable'); };
    await env.ranking.run();
    assert.match(env.ranking.status.textContent, /Google 지도 연결/);
    assert.equal(env.draw.items.length, 1);
    assert.equal(env.ranking.busy, false);
});

test('editing during a pending request discards the stale result', async () => {
    const env = setup(); registerItem(env, 'Match', 9, '18:00', 'marker');
    let complete;
    env.context.fetch = () => new Promise(resolve => { complete = resolve; });
    const pending = env.ranking.run();
    env.handlers['custom-layer:change']();
    complete({ ok: true, json: async () => response });
    await pending;
    assert.equal(env.ranking.list.children.length, 0);
    assert.match(env.ranking.status.textContent, /다시 계산/);
    assert.equal(env.ranking.button.disabled, false);
});

test('failed analysis keeps editable data and allows retry without saving', async () => {
    const env = setup(); registerItem(env, 'Match', 9, '18:00', 'marker');
    env.context.fetch = async () => ({ ok: false, status: 400 });
    await env.ranking.run();
    assert.match(env.ranking.status.textContent, /도형 좌표/);
    assert.equal(env.draw.items.length, 1);
    assert.equal(env.ranking.button.disabled, false);
    env.context.fetch = async () => ({ ok: true, json: async () => ({ ...response, regions: [], matchedCount: 0, outsideCount: 1 }) });
    await env.ranking.run();
    assert.match(env.ranking.status.textContent, /겹치는 항목이 없습니다/);
});

test('example ranks the actual fixture separately without reading map geometry or changing personal items', async () => {
    const env = setup();
    const personal = registerItem(env, 'Personal item', 11, '23:00', 'marker');
    env.draw.filter = { month: 11, start: '22:00', end: '02:00' };
    env.storage.shape = () => { throw Error('Must not read unavailable Google geometry'); };
    const example = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../main/resources/static/data/personal-ranking-example.json'), 'utf8'));
    const requests = [];
    env.context.fetch = async (url, request) => {
        requests.push({ url, request });
        return { ok: true, json: async () => url.endsWith('.json') ? example : { ...response, analyzedCount: 8, matchedCount: 8 } };
    };
    await env.ranking.run(true);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].url, '/data/personal-ranking-example.json');
    assert.equal(JSON.parse(requests[1].request.body).features.length, 8);
    assert.equal(env.draw.items.length, 1);
    assert.equal(env.draw.items[0], personal);
    assert.equal(env.draw.filter.month, 11);
    assert.match(env.ranking.status.textContent, /더미 데이터 예시/);
    assert.match(env.ranking.status.textContent, /조회 조건 미적용/);
    assert.equal(env.ranking.exampleData.hidden, false);
    assert.equal(env.ranking.exampleItems.children.length, 8);
    const overlays = [...env.ranking.exampleOverlays.values()];
    assert.equal(overlays.length, 8);
    assert.ok(overlays.every(overlay => overlay.options.map && overlay.options.clickable === false));
    const [, included] = env.ranking.list.children[0].children;
    included.children[1].children[0].children[0].events.click();
    assert.equal(env.draw.map.position.toJSON().lat, example.features[0].shape.position.lat);
    env.ranking.exampleItems.children[1].children[0].events.click();
    assert.equal(env.draw.map.position.toJSON().lat, example.features[1].shape.position.lat);
    env.handlers['custom-layer:tab']();
    assert.ok(overlays.every(overlay => overlay.options.map === null));
});
