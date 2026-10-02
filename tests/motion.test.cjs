const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMotionControls } = require('../motion-controls.js');

function rig(permission = 'granted', angle = 0) {
  let time = 0;
  const events = new EventTarget();
  const orientation = new EventTarget();
  orientation.angle = angle;
  let permissionCalls = 0;
  let timer;
  const host = {
    isSecureContext: true,
    DeviceOrientationEvent: Object.assign(function () {}, {
      requestPermission: async () => {
        permissionCalls += 1;
        if (permission instanceof Error) throw permission;
        return permission;
      },
    }),
    document: { hidden: false },
    screen: { orientation },
    performance: { now: () => time },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    setInterval: callback => { timer = callback; return 1; },
    clearInterval: () => { timer = null; },
  };
  const controls = createMotionControls({ host });
  return {
    host, controls,
    emit(beta, gamma) {
      const event = new Event('deviceorientation');
      event.beta = beta; event.gamma = gamma;
      events.dispatchEvent(event);
    },
    advance(ms) { time += ms; if (timer) timer(); },
    rotate(angle) { orientation.angle = angle; orientation.dispatchEvent(new Event('change')); },
    get permissionCalls() { return permissionCalls; },
    get activeTimer() { return !!timer; },
  };
}

test('off by default; no permission or sensors touched by reads', () => {
  const r = rig();
  r.emit(0, 20);
  assert.deepEqual(r.controls.read(1), { move: 0, turn: 0 });
  assert.equal(r.permissionCalls, 0);
  assert.equal(r.activeTimer, false);
});

for (const permission of ['denied', new Error('blocked')]) {
  test(`permission ${String(permission)} leaves neutral fallback`, async () => {
    const r = rig(permission);
    assert.equal(await r.controls.enable(), false);
    assert.equal(r.controls.pending, false);
    assert.deepEqual(r.controls.read(1), { move: 0, turn: 0 });
    assert.equal(r.activeTimer, false);
  });
}

test('missing sensor API and insecure contexts leave fallback', async () => {
  for (const property of ['DeviceOrientationEvent', 'isSecureContext']) {
    const r = rig(); r.host[property] = undefined;
    assert.equal(await r.controls.enable(), false);
    assert.equal(r.permissionCalls, 0);
    assert.deepEqual(r.controls.read(1), { move: 0, turn: 0 });
  }
});

test('browsers without permission API can receive orientation', async () => {
  const r = rig(); delete r.host.DeviceOrientationEvent.requestPermission;
  assert.equal(await r.controls.enable(), true);
  r.emit(35, 0);
  assert.equal(r.controls.calibrated, true);
});

test('first real reading calibrates an inclined device without drift', async () => {
  const r = rig(); await r.controls.enable();
  assert.equal(r.controls.calibrated, false);
  assert.deepEqual(r.controls.read(1), { move: 0, turn: 0 });
  r.emit(60, 25);
  assert.equal(r.controls.calibrated, true);
  assert.deepEqual(r.controls.read(1), { move: 0, turn: 0 });
  r.emit(45, 40);
  const axes = r.controls.read(1);
  assert(axes.move > 0);
  assert(axes.turn > 0);
  assert(axes.move <= 1 && axes.turn <= 1);
});

test('dead zones, forward/reverse, left/right and recenter', async () => {
  const r = rig(); await r.controls.enable(); r.emit(30, 0);
  r.emit(32, 2); assert.deepEqual(r.controls.read(1), { move: 0, turn: 0 });
  r.emit(10, 20); assert(r.controls.read(1).move > 0); assert(r.controls.read(1).turn > 0);
  r.emit(50, -20); assert(r.controls.read(1).move < 0); assert(r.controls.read(1).turn < 0);
  assert.equal(r.controls.recenter(), true);
  assert.deepEqual(r.controls.read(1), { move: 0, turn: 0 });
});

test('null, NaN and infinite readings never reach the engine', async () => {
  const r = rig(); await r.controls.enable();
  for (const value of [null, undefined, NaN, Infinity, -Infinity]) {
    r.emit(value, 0); r.emit(0, value);
    assert.deepEqual(r.controls.read(1), { move: 0, turn: 0 });
    assert.equal(r.controls.calibrated, false);
  }
});

test('no events times out and removes listeners; retry succeeds', async () => {
  const r = rig(); await r.controls.enable(); r.advance(3600);
  assert.equal(r.controls.enabled, false);
  assert.equal(r.activeTimer, false);
  r.emit(0, 20); assert.deepEqual(r.controls.read(1), { move: 0, turn: 0 });
  await r.controls.enable(); r.emit(0, 0); assert.equal(r.controls.calibrated, true);
  assert.equal(r.permissionCalls, 1);
});

test('a stalled sensor stops movement even after tilting', async () => {
  const r = rig(); await r.controls.enable(); r.emit(0, 0); r.emit(-20, 20);
  assert(r.controls.read(1).move > 0);
  r.advance(1600);
  assert.deepEqual(r.controls.read(1), { move: 0, turn: 0 });
  assert.equal(r.controls.enabled, false);
});

for (const angle of [90, -90, 180]) {
  test(`screen rotation ${angle} maps visible axes and recenters`, async () => {
    const r = rig(); await r.controls.enable(); r.emit(0, 0);
    r.rotate(angle);
    assert.deepEqual(r.controls.read(1), { move: 0, turn: 0 });
    r.emit(0, 0);
    const radians = angle * Math.PI / 180;
    // Visible right tilt expressed in portrait device coordinates.
    r.emit(-20 * Math.sin(radians), 20 * Math.cos(radians));
    assert(r.controls.read(1).turn > 0);
    r.controls.recenter(); assert.deepEqual(r.controls.read(1), { move: 0, turn: 0 });
  });
}

test('orientation angle change without event also waits for a fresh neutral', async () => {
  const r = rig(); await r.controls.enable(); r.emit(0, 0); r.emit(0, 20);
  r.host.screen.orientation.angle = 90;
  assert.deepEqual(r.controls.read(1), { move: 0, turn: 0 });
  r.emit(30, 10); assert.deepEqual(r.controls.read(1), { move: 0, turn: 0 });
});

test('Safari legacy window.orientation is supported', async () => {
  const r = rig(); delete r.host.screen; r.host.orientation = 90;
  await r.controls.enable(); r.emit(0, 0); r.emit(-20, 0);
  assert(r.controls.read(1).turn > 0);
});

test('late permission resolution cannot re-enable after reset', async () => {
  const r = rig(); let grant;
  r.host.DeviceOrientationEvent.requestPermission = () => new Promise(resolve => { grant = resolve; });
  const enabling = r.controls.enable();
  r.controls.reset(); grant('granted');
  assert.equal(await enabling, false);
  assert.equal(r.controls.enabled, false);
  assert.equal(r.activeTimer, false);
});

test('repeated toggles clean up, hidden documents yield neutral input', async () => {
  const r = rig();
  for (let i = 0; i < 5; i += 1) {
    await r.controls.enable(); r.emit(0, 0); r.emit(-20, 20);
    r.host.document.hidden = true;
    assert.deepEqual(r.controls.read(1), { move: 0, turn: 0 });
    r.host.document.hidden = false;
    r.controls.disable(); assert.equal(r.activeTimer, false);
  }
  assert.equal(r.permissionCalls, 1);
});
