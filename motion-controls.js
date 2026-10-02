/* Optional sensor adapter. Owns permissions, listeners and calibration only;
   it never reads or changes the game world or normal input state. */
(function (root) {
  "use strict";

  function createMotionControls({ host = root, onChange = () => {} } = {}) {
    const STALE_MS = 1500;
    const START_TIMEOUT_MS = 3500;
    let enabled = false;
    let pending = false;
    let permissionGranted = false;
    let generation = 0;
    let watchdog = null;
    let sample = null;
    let neutral = null;
    let steer = 0;
    let throttle = 0;
    let startedAt = 0;
    let status = "Motion off — keyboard and joystick ready.";

    const supported = () => host.isSecureContext === true && typeof host.DeviceOrientationEvent === "function";
    const now = () => host.performance.now();
    const screenAngle = () => host.screen?.orientation?.angle ?? host.orientation ?? 0;
    const clamp = value => Math.max(-1, Math.min(1, value));
    const deltaAngle = (a, b) => ((a - b + 540) % 360) - 180;
    const axis = (value, deadzone, maximum) => Math.sign(value) * clamp(Math.max(0, Math.abs(value) - deadzone) / (maximum - deadzone));

    function change(message) {
      status = message;
      onChange();
    }

    function disable(message = "Motion off — keyboard and joystick ready.") {
      generation += 1;
      enabled = pending = false;
      sample = neutral = null;
      steer = throttle = 0;
      host.removeEventListener("deviceorientation", onOrientation);
      host.removeEventListener("orientationchange", onScreenChange);
      host.screen?.orientation?.removeEventListener("change", onScreenChange);
      if (watchdog !== null) host.clearInterval(watchdog);
      watchdog = null;
      change(message);
    }

    // Rotate the gravity vector into the visible screen's axes. This also avoids
    // clipping beta/gamma at a comfortable iPad holding angle before calibration.
    function screenTilt(beta, gamma, angle) {
      const radians = Math.PI / 180;
      const b = beta * radians;
      const g = gamma * radians;
      const a = angle * radians;
      const x = -Math.cos(b) * Math.sin(g);
      const y = Math.sin(b);
      const z = Math.cos(b) * Math.cos(g);
      const sx = x * Math.cos(a) + y * Math.sin(a);
      const sy = -x * Math.sin(a) + y * Math.cos(a);
      return {
        roll: Math.atan2(-sx, z) / radians,
        pitch: -Math.atan2(sy, Math.hypot(sx, z)) / radians,
      };
    }

    function onOrientation(event) {
      if (!enabled || host.document?.hidden || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
      const angle = screenAngle();
      if (sample && sample.angle !== angle) onScreenChange();
      const tilt = screenTilt(event.beta, event.gamma, angle);
      sample = { ...tilt, angle, at: now() };
      if (!neutral) {
        neutral = { ...sample };
        pending = false;
        steer = throttle = 0;
        change("Motion on — tilt to drive; joystick overrides. Tap Calibrate to recenter.");
      }
    }

    function onScreenChange() {
      if (!enabled) return;
      sample = neutral = null;
      steer = throttle = 0;
      startedAt = now();
      pending = true;
      change("Hold steady — recentering for this screen orientation.");
    }

    function checkFreshness() {
      if (!enabled) return;
      if ((sample && now() - sample.at > STALE_MS) || (!sample && now() - startedAt > START_TIMEOUT_MS)) {
        disable("No motion readings — use the joystick or keyboard. Tap Motion to retry.");
      }
    }

    async function enable() {
      if (enabled || pending) return enabled;
      if (!supported()) {
        disable("Motion unavailable here — keyboard and joystick remain ready. Motion requires HTTPS and sensor support.");
        return false;
      }
      const request = ++generation;
      pending = true;
      change("Requesting motion access — you can keep using normal controls.");
      try {
        // Called directly from the button gesture, before any asynchronous work.
        const permission = host.DeviceOrientationEvent.requestPermission;
        if (!permissionGranted && typeof permission === "function") {
          const result = await permission.call(host.DeviceOrientationEvent);
          if (request !== generation) return false;
          if (result !== "granted") {
            disable("Motion access declined — keyboard and joystick remain ready.");
            return false;
          }
        }
        if (request !== generation) return false;
        permissionGranted = true;
        enabled = true;
        sample = neutral = null;
        steer = throttle = 0;
        startedAt = now();
        host.addEventListener("deviceorientation", onOrientation);
        host.addEventListener("orientationchange", onScreenChange);
        host.screen?.orientation?.addEventListener("change", onScreenChange);
        watchdog = host.setInterval(checkFreshness, 500);
        change("Hold steady — waiting for a valid motion reading to calibrate.");
        return true;
      } catch (error) {
        if (request === generation) disable("Motion access unavailable — keyboard and joystick remain ready.");
        return false;
      }
    }

    function recenter() {
      if (!enabled || !sample || now() - sample.at > STALE_MS) {
        checkFreshness();
        return false;
      }
      neutral = { ...sample };
      steer = throttle = 0;
      change("Motion centered — tilt gently to drive.");
      return true;
    }

    function read(dt) {
      checkFreshness();
      if (enabled && sample && sample.angle !== screenAngle()) onScreenChange();
      if (!enabled || !neutral || !sample || host.document?.hidden) return { turn: 0, move: 0 };
      const turnTarget = axis(deltaAngle(sample.roll, neutral.roll), 3.5, 18);
      const moveTarget = axis(sample.pitch - neutral.pitch, 4.5, 22);
      steer += (turnTarget - steer) * Math.min(1, Math.max(0, dt) * 4.5);
      throttle += (moveTarget - throttle) * Math.min(1, Math.max(0, dt) * 3.8);
      return { turn: clamp(steer), move: clamp(throttle) };
    }

    return {
      enable, disable, recenter, read,
      // Pause/focus loss cancels a pending permission request and stops sensors.
      reset: disable,
      get supported() { return supported(); },
      get enabled() { return enabled; },
      get pending() { return pending; },
      get calibrated() { return enabled && !!neutral; },
      get status() { return status; },
    };
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { createMotionControls };
  else root.createMotionControls = createMotionControls;
})(typeof window !== "undefined" ? window : globalThis);
