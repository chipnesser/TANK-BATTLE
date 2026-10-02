const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const versions = [['repaired', path.resolve(__dirname, '../index.html')]];
    if (process.env.BASELINE_HTML) versions.unshift(['upstream', process.env.BASELINE_HTML]);
    for (const [name, file] of versions) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await page.goto(pathToFileURL(file).href);
      const result = await page.evaluate(() => {
        world.paused = true;
        const now = performance.now();
        world.enemies = [];
        for (let i = 0; i < 4; i += 1) {
          spawnEnemy(now, i % 2 ? 'tank' : 'jeep');
          const enemy = world.enemies.at(-1);
          enemy.x = 650 + i * 160; enemy.y = (i - 1.5) * 180;
        }
        createDestructionBurst(world.enemies[1], now);
        world.effects.push({ kind: 'explosion', x: 650, y: 0, bornAt: now, life: 780, radius: 120 });
        for (let i = 0; i < 20; i += 1) render(now + 180);
        const samples = [];
        for (let pass = 0; pass < 7; pass += 1) {
          const start = performance.now();
          for (let i = 0; i < 100; i += 1) render(now + 180);
          samples.push((performance.now() - start) / 100);
        }
        samples.sort((a, b) => a - b);
        return { medianRenderMs: Number(samples[3].toFixed(3)), enemies: world.enemies.length, marks: world.floorMarks.length };
      });
      console.log(name, result);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
