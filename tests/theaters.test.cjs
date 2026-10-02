const { test } = require('node:test');
const assert = require('node:assert/strict');
const { THEATERS, DEFAULT_CAMPAIGN, createCampaign } = require('../theaters.js');

test('original encounter balance and cumulative kill targets survive', () => {
  const campaign = createCampaign();
  assert.deepEqual(campaign.map(p => p.regularKillTarget), [15, 30, 45, 60]);
  assert.deepEqual(campaign.map(p => p.boss.hp), [6, 10, 8, 16]);
  assert.deepEqual(campaign.map(p => p.boss.count), [1, 1, 2, 1]);
  assert.deepEqual(campaign.map(p => p.spawnDelay), [1950, 1950, 2200, 2200]);
  assert.deepEqual(campaign.map(p => p.maxEnemies), [3, 4, 3, 4]);
  assert.deepEqual(campaign.map(p => p.boss.final), [false, false, false, true]);
});

test('extending, reordering or shortening a campaign recalculates goals and ending', () => {
  const extra = { ...DEFAULT_CAMPAIGN[0], arenaName: 'Return Patrol', killQuota: 10 };
  const extended = createCampaign([...DEFAULT_CAMPAIGN, extra]);
  assert.equal(extended[3].boss.final, false);
  assert.equal(extended[4].boss.final, true);
  assert.equal(extended[4].regularKillTarget, 70);
  const reordered = createCampaign([DEFAULT_CAMPAIGN[3], DEFAULT_CAMPAIGN[1]]);
  assert.equal(reordered[0].boss.final, false);
  assert.equal(reordered[1].boss.final, true);
  assert.equal(createCampaign([extra])[0].regularKillTarget, 10);
});

test('theaters are distinct; runtime mutations cannot damage shared data', () => {
  assert.equal(new Set(Object.values(THEATERS).map(t => t.backdrop)).size, 4);
  assert.equal(new Set(Object.values(THEATERS).map(t => t.palette.ground[0])).size, 4);
  const first = createCampaign();
  first[0].spawnWeights.jeep = 0;
  first[1].environment.terrain.obstacles[0].x = 12345;
  const second = createCampaign();
  assert.equal(second[0].spawnWeights.jeep, 1);
  assert.equal(second[1].environment.terrain.obstacles[0].x, -620);
  assert(Object.isFrozen(THEATERS.canyon.terrain.obstacles));
});

test('one environment can serve multiple encounters with independent enemy mixes', () => {
  const campaign = createCampaign([
    DEFAULT_CAMPAIGN[0],
    { ...DEFAULT_CAMPAIGN[0], arenaName: 'Dune Armor', spawnWeights: { tank: 1 }, killQuota: 5 },
  ]);
  assert.equal(campaign[1].environment.name, 'Sunlit Dunes');
  assert.deepEqual(campaign[1].spawnWeights, { tank: 1 });
  assert.equal(campaign[1].regularKillTarget, 20);
});

test('custom theater definitions use the same compiler', () => {
  const custom = { ...THEATERS, night: { ...THEATERS.dunes, name: 'Night Dunes', palette: { ...THEATERS.dunes.palette, sky: ['#101b32', '#4e6872'] } } };
  const campaign = createCampaign([{ ...DEFAULT_CAMPAIGN[0], theater: 'night' }], custom);
  assert.equal(campaign[0].environment.name, 'Night Dunes');
});

test('invalid campaign data fails with useful errors', () => {
  assert.throws(() => createCampaign([]), /at least one/);
  for (const changes of [{ theater: 'missing' }, { killQuota: 0 }, { killQuota: 2.5 }, { spawnWeights: { dragon: 1 } }, { maxEnemies: 0 }, { boss: { ...DEFAULT_CAMPAIGN[0].boss, hp: NaN } }]) {
    assert.throws(() => createCampaign([{ ...DEFAULT_CAMPAIGN[0], ...changes }]));
  }
});
