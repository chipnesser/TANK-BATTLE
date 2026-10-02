// Set PLAYWRIGHT_MODULE and CHROME_PATH when using a preinstalled runtime.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, 'test-results');
fs.mkdirSync(artifacts, { recursive: true });
let browser;
let passed = 0;

async function test(name, run) {
  await run();
  console.log(`PASS ${name}`);
  passed += 1;
}

async function open(options = {}, init) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (init) await page.addInitScript(init);
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  await page.waitForFunction(() => world.enemies.length >= 3);
  return { page, context, errors };
}

async function normalControls() {
  for (const width of [1280, 800]) {
    await test(`desktop movement, turret and weapons at ${width}px`, async () => {
      const { page, context, errors } = await open({ viewport: { width, height: 720 } });
      await page.keyboard.down('w');
      await page.waitForFunction(() => world.player.x > 20);
      await page.keyboard.up('w');
      assert((await page.evaluate(() => world.player.x)) > 15);
      await page.keyboard.down('d');
      await page.waitForFunction(() => world.player.angle > 0.1);
      await page.keyboard.up('d');
      assert((await page.evaluate(() => world.player.angle)) > 0.08);
      await page.keyboard.down('ArrowRight');
      await page.waitForFunction(() => world.player.turretAngle > 0.1);
      await page.keyboard.up('ArrowRight');
      assert((await page.evaluate(() => world.player.turretAngle)) > 0.05);
      await page.keyboard.press('Space');
      assert.equal(await page.evaluate(() => world.player.ammo), 4);
      await page.mouse.click(width / 2, 450);
      assert.equal(await page.evaluate(() => world.player.ammo), 3);
      await page.keyboard.press('r');
      assert(await page.evaluate(() => world.player.reloading));
      await page.waitForFunction(() => !world.player.reloading);
      assert.equal(await page.evaluate(() => world.player.ammo), 5);
      await page.keyboard.press('p');
      await page.keyboard.press('Space');
      assert.equal(await page.evaluate(() => world.player.ammo), 5);
      await page.keyboard.press('p');
      await page.keyboard.down('Space');
      await page.waitForFunction(() => world.player.chargeAmount >= 1);
      await page.keyboard.up('Space');
      assert.equal(await page.evaluate(() => world.player.ammo), 0);
      assert(await page.evaluate(() => world.player.reloading));
      await page.waitForFunction(() => !world.player.reloading);
      await page.screenshot({ path: path.join(artifacts, `desktop-${width}.png`) });
      assert.deepEqual(errors, []);
      await context.close();
    });
  }

  for (const viewport of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await test(`touch joystick/fire, keyboard fallback at ${viewport.width}x${viewport.height}`, async () => {
      const { page, context, errors } = await open({ viewport, hasTouch: true, isMobile: true });
      assert(await page.locator('#mobileControls').isVisible());
      // Use real pointer capture with a mouse in a touch-emulated browser.
      const rect = await page.locator('#joystickBase').boundingBox();
      await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2 - 40);
      await page.mouse.down();
      await page.waitForFunction(() => world.player.x > 15);
      assert((await page.evaluate(() => world.player.x)) > 12);
      await page.mouse.up();
      assert.equal(await page.evaluate(() => touchState.moveY), 0);
      await page.locator('#touchFire').tap();
      assert.equal(await page.evaluate(() => world.player.ammo), 4);
      await page.locator('#touchFire').tap();
      assert.equal(await page.evaluate(() => world.player.ammo), 3);
      await page.keyboard.down('w');
      const before = await page.evaluate(() => world.player.x);
      await page.waitForFunction(before => world.player.x > before + 15, before);
      await page.keyboard.up('w');
      assert((await page.evaluate(() => world.player.x)) > before + 10);
      await page.screenshot({ path: path.join(artifacts, `touch-${viewport.width}.png`) });
      assert.deepEqual(errors, []);
      await context.close();
    });
  }

  await test('cancellation, blur, reset and ending text entry', async () => {
    const { page, context, errors } = await open();
    await page.mouse.move(640, 440);
    await page.mouse.down();
    assert.equal(await page.evaluate(() => world.player.charging), true);
    await page.evaluate(() => {
      const event = new Event('pointercancel'); event.pointerId = touchState.fireId;
      gameSurface.dispatchEvent(event);
    });
    await page.mouse.up();
    assert.equal(await page.evaluate(() => world.player.ammo), 5);
    assert.equal(await page.evaluate(() => world.player.charging), false);
    await page.keyboard.down('w');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.equal(await page.evaluate(() => keys.KeyW), false);
    await page.keyboard.up('w');
    await page.evaluate(() => {
      world.pickups.push({ type: 'heal', x: 0, y: 0 });
      resetGame();
    });
    assert.equal(await page.evaluate(() => world.pickups.length), 0);
    await page.evaluate(() => openEnding());
    await page.evaluate(() => showEndingStage('name'));
    await page.locator('#playerName').fill('Wasp');
    await page.locator('#playerName').press('Space');
    assert.equal(await page.evaluate(() => !!keys.KeyW), false);
    assert.equal(await page.evaluate(() => world.player.charging), false);
    assert.deepEqual(errors, []);
    await context.close();
  });
}

function sensorInit(permission = 'granted') {
  return `window.DeviceOrientationEvent = class extends Event {
    static requestPermission() { window.permissionCalls = (window.permissionCalls || 0) + 1;
      return ${permission === 'error' ? "Promise.reject(new Error('blocked'))" : "Promise.resolve('" + permission + "')"}; }
  };`;
}

async function emit(page, beta, gamma) {
  await page.evaluate(([beta, gamma]) => {
    const event = new Event('deviceorientation');
    event.beta = beta; event.gamma = gamma;
    window.dispatchEvent(event);
  }, [beta, gamma]);
}

async function motionIntegration() {
  for (const permission of ['denied', 'error']) {
    await test(`motion ${permission}: gameplay and joystick survive`, async () => {
      const { page, context, errors } = await open({ hasTouch: true }, sensorInit(permission));
      assert.equal(await page.evaluate(() => window.permissionCalls || 0), 0);
      await page.locator('#gyroToggle').click();
      await page.waitForFunction(() => !motionControls.pending);
      assert.equal(await page.evaluate(() => motionControls.enabled), false);
      await page.keyboard.down('w');
      await page.waitForFunction(() => world.player.x > 15);
      await page.keyboard.up('w');
      assert.deepEqual(errors, []);
      await context.close();
    });
  }

  await test('missing sensor API leaves normal tablet controls usable', async () => {
    const { page, context, errors } = await open({ hasTouch: true }, () => {
      Object.defineProperty(window, 'DeviceOrientationEvent', { value: undefined, configurable: true });
    });
    assert.equal(await page.evaluate(() => motionControls.supported), false);
    assert.equal(await page.locator('#gyroToggle').isEnabled(), false);
    await page.keyboard.down('w'); await page.waitForFunction(() => world.player.x > 15); await page.keyboard.up('w');
    await page.locator('#touchFire').tap();
    assert.equal(await page.evaluate(() => world.player.ammo), 4);
    assert.deepEqual(errors, []); await context.close();
  });

  await test('motion integrates without weakening normal input; pause/reset clean up', async () => {
    const { page, context, errors } = await open({ hasTouch: true }, sensorInit());
    await page.locator('#gyroToggle').click();
    await page.waitForFunction(() => motionControls.enabled);
    await emit(page, 60, 25);
    assert.equal(await page.evaluate(() => motionControls.calibrated), true);
    await page.evaluate(() => { world.paused = true; world.player.x = 0; world.player.angle = 0; });
    await emit(page, 45, 40);
    const moving = await page.evaluate(() => { updatePlayer(1, performance.now()); return { x: world.player.x, angle: world.player.angle }; });
    assert(moving.x > 0 && moving.angle > 0);
    await emit(page, 60, 25);
    const manual = await page.evaluate(() => {
      world.player.x = 0; world.player.y = 0; world.player.angle = 0;
      keys.KeyW = true; keys.KeyA = true;
      updatePlayer(1, performance.now());
      return { distance: Math.hypot(world.player.x, world.player.y), angle: world.player.angle };
    });
    assert(Math.abs(manual.distance - 182) < 0.01);
    assert.equal(manual.angle, -1.22);
    const touchOverride = await page.evaluate(() => {
      keys.KeyW = false; keys.KeyA = false; touchState.joystickId = 42;
      touchState.moveY = -1; touchState.moveX = 1;
      world.player.x = 0; world.player.y = 0; world.player.angle = 0;
      updatePlayer(1, performance.now());
      return { distance: Math.hypot(world.player.x, world.player.y), angle: world.player.angle };
    });
    assert(Math.abs(touchOverride.distance - 182) < 0.01);
    assert.equal(touchOverride.angle, 1.22);
    await page.evaluate(() => { world.paused = false; togglePause(true); });
    assert.equal(await page.evaluate(() => motionControls.enabled), false);
    await page.evaluate(() => { togglePause(false); resetGame(); });
    assert.equal(await page.evaluate(() => motionControls.enabled), false);
    assert.equal(await page.evaluate(() => touchState.joystickId), null);
    assert.deepEqual(errors, []);
    await context.close();
  });

  await test('no sensor packets: automatic fallback with game still running', async () => {
    const { page, context, errors } = await open({ hasTouch: true }, sensorInit());
    await page.locator('#gyroToggle').click();
    await page.waitForFunction(() => !motionControls.enabled && !motionControls.pending, { }, { timeout: 6000 });
    assert.match(await page.evaluate(() => motionControls.status), /No motion readings/);
    assert.deepEqual(errors, []);
    await context.close();
  });

  await test('missing motion script cannot stop the engine', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/motion-controls.js', route => route.abort());
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    await page.keyboard.down('w');
    await page.waitForFunction(() => world.player.x > 15);
    await page.keyboard.up('w');
    assert.equal(await page.evaluate(() => motionControls.supported), false);
    assert.deepEqual(errors, []);
    await context.close();
  });
}

async function campaignChecks() {
  await test('normal and mega shots, health, pickups, full campaign and ending', async () => {
    const { page, context, errors } = await open();
    const result = await page.evaluate(() => {
      resetGame();
      world.enemies = [];
      const now = performance.now();
      spawnEnemy(now, 'tank');
      const tank = world.enemies[0];
      tank.x = 800; tank.y = 0;
      firePlayer(now, false);
      updateProjectiles(0, now + 180);
      const firstHp = tank.hp;
      const firstScore = world.score;
      firePlayer(now + 200, false);
      updateProjectiles(0, now + 380);
      const secondScore = world.score;
      const hitEffect = world.effects.some(e => e.kind === 'hit');
      resetGame(); world.enemies = []; spawnEnemy(now, 'tank');
      const delayedTarget = world.enemies[0]; delayedTarget.x = 800; delayedTarget.y = 0;
      firePlayer(now, false); updateProjectiles(0, now + 1000);
      const delayedHp = delayedTarget.hp;
      resetGame();
      spawnBoss(now);
      const boss = world.enemies[0];
      firePlayer(now, true);
      updateProjectiles(0, now + 180);
      const mega = { hp: boss.hp, ammo: world.player.ammo, reload: world.player.reloading, duration: world.player.reloadUntil - now };
      resetGame();
      world.player.health = 2;
      grantPickup('heal', now);
      const healed = world.player.health;
      world.activeBonus = null;
      world.player.health = 3; world.player.invincibleUntil = 0;
      world.projectiles = [1, 2].map(() => ({ kind: 'enemyShot', x: 0, y: 0, vx: 0, vy: 0, bornAt: now, life: 3200 }));
      updateProjectiles(0, now);
      const afterTwoHits = world.player.health;
      updatePlayer(0, now + 6000);
      const regenerated = world.player.health;
      world.player.health = 5; world.player.invincibleUntil = 0;
      grantPickup('rockets', now);
      world.enemies = []; spawnEnemy(now, 'tank');
      const rocketTarget = world.enemies[0]; rocketTarget.x = 1400; rocketTarget.y = 0;
      firePlayer(now, false); updateProjectiles(0, now + 180);
      const rocketKill = !rocketTarget.alive;
      grantPickup('armor', now);
      world.projectiles = [{ kind: 'enemyShot', x: 0, y: 0, vx: 0, vy: 0, bornAt: now, life: 3200 }];
      world.player.invincibleUntil = 0;
      updateProjectiles(0, now);
      const armorHp = world.player.health;
      resetGame();
      const visits = [];
      for (let index = 0; index < PHASES.length; index += 1) {
        const phase = currentPhase();
        while (world.regularKills < phase.regularKillTarget) {
          spawnEnemy(now, 'jeep');
          const enemy = world.enemies.at(-1);
          damageEnemy(enemy, enemy.hp, now);
        }
        updateArenaSpawns(now);
        visits.push({ index: world.phaseIndex, bosses: world.enemies.filter(e => e.boss).length, theater: currentTheater().name, hazards: getHazardType() });
        for (const enemy of [...world.enemies]) damageEnemy(enemy, enemy.hp, now);
        updateEnemies(0, now);
      }
      const bonusMode = world.mode;
      const bonusDuration = world.bonusRound.endsAt - now;
      updateBonusRound(world.bonusRound.endsAt + 1);
      const victory = world.victory;
      resetGame();
      return { firstHp, firstScore, secondScore, hitEffect, delayedHp, afterTwoHits, regenerated, mega, healed, rocketKill, armorHp, visits, bonusMode, bonusDuration, victory, score: world.score, health: world.player.health };
    });
    assert.equal(result.firstHp, 1);
    assert.equal(result.firstScore, 0);
    assert.equal(result.secondScore, 1);
    assert.equal(result.hitEffect, true);
    assert.equal(result.delayedHp, 1); assert.equal(result.afterTwoHits, 2); assert.equal(result.regenerated, 3);
    assert.deepEqual(result.mega, { hp: 2, ammo: 0, reload: true, duration: 2600 });
    assert.equal(result.healed, 5); assert.equal(result.armorHp, 5); assert.equal(result.rocketKill, true);
    assert.deepEqual(result.visits.map(v => v.bosses), [1, 1, 2, 1]);
    assert.deepEqual(result.visits.map(v => v.hazards), [null, 'ridges', 'fog', 'water']);
    assert.equal(result.bonusMode, 'bonus'); assert.equal(result.bonusDuration, 75000);
    assert.equal(result.victory, true); assert.equal(result.score, 0); assert.equal(result.health, 5);
    assert.deepEqual(errors, []);
    await context.close();
  });

  await test('each theater renders; water and obstacle movement stay consistent', async () => {
    const { page, context, errors } = await open({ viewport: { width: 1280, height: 720 } });
    for (let index = 0; index < 4; index += 1) {
      await page.evaluate(index => {
        resetGame(); enterPhase(index); world.enemies = [];
        for (let i = 0; i < 3; i += 1) { spawnEnemy(performance.now()); world.enemies.at(-1).x = 700 + i * 170; world.enemies.at(-1).y = (i - 1) * 190; }
        if (index === 3) world.player.angle = .8;
        world.paused = true; world.pausedAt = performance.now(); render(world.pausedAt);
      }, index);
      await page.screenshot({ path: path.join(artifacts, `theater-${index + 1}.png`) });
    }
    const terrain = await page.evaluate(() => {
      togglePause(false); enterPhase(3);
      const pool = world.hazards.water[0];
      world.player.x = pool.x; world.player.y = pool.y;
      const wet = getWaterSlowdown();
      world.player.x = 0; world.player.y = 0;
      const dry = getWaterSlowdown();
      enterPhase(1);
      const rock = world.hazards.obstacles[0];
      world.player.x = rock.x - rock.r - 60; world.player.y = rock.y;
      constrainToObstacles(rock.x + rock.r + 60, rock.y);
      const blocked = world.player.x < rock.x;
      const distance = Math.hypot(world.player.x - rock.x, world.player.y - rock.y);
      return { wet, dry, blocked, distance, radius: rock.r + 24 };
    });
    assert.equal(terrain.wet, .55); assert.equal(terrain.dry, 1);
    assert.equal(terrain.blocked, true); assert(terrain.distance >= terrain.radius - .001);
    assert.deepEqual(errors, []);
    await context.close();
  });

  await test('paused shots and reload deadlines retain remaining time', async () => {
    const { page, context, errors } = await open();
    await page.evaluate(() => { firePlayer(performance.now(), false); performReload(performance.now()); togglePause(true); });
    const before = await page.evaluate(() => world.player.reloadUntil - world.pausedAt);
    await page.waitForTimeout(450);
    const after = await page.evaluate(() => { togglePause(false); return world.player.reloadUntil - performance.now(); });
    assert(Math.abs(after - before) < 60);
    const shotRemaining = await page.evaluate(() => world.projectiles[0].impactAt - performance.now());
    assert(shotRemaining > 70);
    assert.deepEqual(errors, []);
    await context.close();
  });

  await test('both original HTML entry points run the same game', async () => {
    assert.equal(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), fs.readFileSync(path.join(root, 'tank-game.html'), 'utf8'));
    const page = await browser.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(root, 'tank-game.html')).href);
    await page.waitForFunction(() => world.enemies.length >= 3);
    assert.deepEqual(errors, []);
    await page.close();
  });
}

(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  await normalControls();
  await motionIntegration();
  await campaignChecks();
  console.log(`${passed} browser checks passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); });
