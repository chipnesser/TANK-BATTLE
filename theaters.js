/* Reusable theater data and campaign compiler. No rendering or input code. */
(function (root) {
  "use strict";
  const THEATERS = {
    dunes: {
      name: "Sunlit Dunes", hazard: null, backdrop: "dunes",
      palette: { sky: ["#89d6f7", "#f5d79a"], ground: ["#deb776", "#d0a25d", "#bb8743"], hills: "#c9984d", rocks: "#8f6a46", channel: "rgba(182,150,102,.34)" },
      weatherModes: ["clear", "dust", "sunset"], initialWeather: "clear",
      spawnWeights: { jeep: 1 }, maxEnemies: 3, spawnDelay: 1950,
      modifiers: { movement: 1, waterSlowdown: 0.55, fogOpacity: 0 },
      terrain: {
        markCount: 200, rockFraction: 0.3, ridges: [], water: [], obstacles: [],
        riverbeds: [{ x: -180, y: 140, w: 980, h: 180, angle: -0.24 }, { x: 520, y: -760, w: 760, h: 150, angle: 0.18 }],
      },
    },
    canyon: {
      name: "Amber Canyon", hazard: "ridges", backdrop: "mesa",
      palette: { sky: ["#9ccddd", "#e8c797"], ground: ["#cfa274", "#bd885c", "#a7744b"], hills: "#a96e47", rocks: "#78543d", channel: "rgba(135,90,60,.3)" },
      weatherModes: ["clear", "dust", "sunset"], initialWeather: "clear",
      spawnWeights: { jeep: 2, tank: 2 }, maxEnemies: 4, spawnDelay: 1950,
      modifiers: { movement: 1, waterSlowdown: 0.55, fogOpacity: 0 },
      terrain: {
        markCount: 200, rockFraction: 0.44, water: [],
        ridges: [
          { x: -620, y: 440, w: 760, h: 130, angle: 0.1, tint: "rgba(161,115,63,.65)" },
          { x: 680, y: -360, w: 620, h: 120, angle: -0.18, tint: "rgba(154,108,56,.6)" },
          { x: 160, y: 1020, w: 920, h: 150, angle: 0.06, tint: "rgba(171,123,70,.58)" },
        ],
        riverbeds: [{ x: -180, y: 140, w: 980, h: 180, angle: -0.24 }, { x: 520, y: -760, w: 760, h: 150, angle: 0.18 }],
        obstacles: [{ x: -620, y: 440, r: 65, style: "rock" }, { x: 680, y: -360, r: 75, style: "rock" }],
      },
    },
    fog: {
      name: "Mist Basin", hazard: "fog", backdrop: "lowRidges",
      palette: { sky: ["#a6bec5", "#d8d7c4"], ground: ["#b6b295", "#a39c7d", "#8c8669"], hills: "#8d968c", rocks: "#65716a", channel: "rgba(118,130,117,.3)" },
      weatherModes: ["clear", "sunset"], initialWeather: "clear",
      spawnWeights: { jeep: 2, tank: 3 }, maxEnemies: 3, spawnDelay: 2200,
      modifiers: { movement: 1, waterSlowdown: 0.55, fogOpacity: 0.18 },
      terrain: {
        markCount: 180, rockFraction: 0.35, ridges: [], water: [],
        riverbeds: [{ x: -100, y: 240, w: 800, h: 220, angle: 0.12 }],
        obstacles: [{ x: -740, y: 500, r: 55, style: "ruin" }, { x: 660, y: -490, r: 55, style: "ruin" }],
      },
    },
    crossing: {
      name: "Oasis Crossing", hazard: "water", backdrop: "river",
      palette: { sky: ["#93cfdb", "#dce8b9"], ground: ["#bdc08b", "#aaa779", "#939566"], hills: "#8ea272", rocks: "#6f7761", channel: "rgba(102,143,128,.33)" },
      weatherModes: ["clear", "sunset"], initialWeather: "clear",
      spawnWeights: { jeep: 3, tank: 3 }, maxEnemies: 4, spawnDelay: 2200,
      modifiers: { movement: 1, waterSlowdown: 0.55, fogOpacity: 0 },
      terrain: {
        markCount: 180, rockFraction: 0.25,
        ridges: [{ x: 680, y: -360, w: 620, h: 120, angle: -0.18, tint: "rgba(116,137,83,.45)" }],
        water: [{ x: -420, y: -480, r: 220 }, { x: 540, y: 620, r: 240 }, { x: 0, y: 920, r: 170 }],
        riverbeds: [{ x: -180, y: 140, w: 980, h: 180, angle: -0.24 }, { x: 520, y: -760, w: 760, h: 150, angle: 0.18 }],
        obstacles: [{ x: -800, y: -240, r: 60, style: "rock" }],
      },
    },
  };

  // These encounters retain the original names, quotas, boss stats and order.
  const DEFAULT_CAMPAIGN = [
    { theater: "dunes", arenaName: "Opening Skirmish", challenge: "Fast Jeeps", killQuota: 15,
      boss: { name: "Boss 1", count: 1, hp: 6, megaDamage: 4, speed: 19, size: 1.7, color: "#b74c39", turret: "#7d2f23", fire: [3800, 5200] } },
    { theater: "canyon", arenaName: "Armor Push", challenge: "Tanks Added", killQuota: 15,
      boss: { name: "Boss 2", count: 1, hp: 10, megaDamage: 4, speed: 16, size: 1.95, color: "#9f4738", turret: "#6a271f", fire: [4200, 5800] } },
    { theater: "fog", arenaName: "Fog Front", challenge: "Fog Zone", killQuota: 15,
      boss: { name: "Boss 3", count: 2, hp: 8, megaDamage: 3, speed: 17, size: 1.8, color: "#b4583f", turret: "#6d2f24", fire: [4000, 5600] } },
    { theater: "crossing", arenaName: "Wet Crossing", challenge: "Water Hazards", killQuota: 15,
      boss: { name: "Final Boss", count: 1, hp: 16, megaDamage: 5, speed: 13, size: 2.35, color: "#6f2020", turret: "#3d1010", fire: [3900, 5300], support: { jeep: 1, tank: 1 }, supportMax: 2 } },
  ];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function freeze(value) {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }
  function positive(value, label) {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid ${label}`);
  }
  function weights(value) {
    if (!value || !Object.keys(value).length) throw new Error("Empty enemy mix");
    for (const [kind, weight] of Object.entries(value)) {
      if (!["jeep", "tank"].includes(kind)) throw new Error(`Unknown enemy: ${kind}`);
      positive(weight, "enemy weight");
    }
  }

  function createCampaign(steps = DEFAULT_CAMPAIGN, theaters = THEATERS) {
    if (!Array.isArray(steps) || !steps.length) throw new Error("Campaign needs at least one encounter");
    let target = 0;
    return steps.map((step, index) => {
      const theater = theaters[step.theater];
      if (!theater) throw new Error(`Unknown theater: ${step.theater}`);
      const phase = { ...clone(theater), ...clone(step), environment: clone(theater) };
      positive(phase.killQuota, "kill quota");
      if (!Number.isInteger(phase.killQuota)) throw new Error("Kill quota must be an integer");
      weights(phase.spawnWeights);
      positive(phase.maxEnemies, "enemy limit");
      positive(phase.spawnDelay, "spawn delay");
      for (const field of ["count", "hp", "megaDamage", "size", "speed"]) positive(phase.boss?.[field], `boss ${field}`);
      if (!Number.isInteger(phase.boss.count)) throw new Error("Boss count must be an integer");
      if (!Array.isArray(phase.boss.fire) || phase.boss.fire.length !== 2 || phase.boss.fire[0] > phase.boss.fire[1]) throw new Error("Invalid boss fire interval");
      phase.boss.fire.forEach(value => positive(value, "boss fire interval"));
      if (phase.boss.support) { weights(phase.boss.support); positive(phase.boss.supportMax, "support limit"); }
      positive(theater.modifiers.movement, "movement modifier");
      positive(theater.modifiers.waterSlowdown, "water modifier");
      for (const field of ["ridges", "water", "riverbeds", "obstacles"]) {
        if (!Array.isArray(theater.terrain[field])) throw new Error(`Missing terrain ${field}`);
      }
      for (const obstacle of theater.terrain.obstacles) {
        if (!Number.isFinite(obstacle.x) || !Number.isFinite(obstacle.y)) throw new Error("Invalid obstacle position");
        positive(obstacle.r, "obstacle radius");
      }
      target += phase.killQuota;
      phase.regularKillTarget = target;
      phase.boss.final = index === steps.length - 1;
      return phase;
    });
  }

  const api = freeze({ THEATERS, DEFAULT_CAMPAIGN, createCampaign });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PatrolLevels = api;
})(typeof window !== "undefined" ? window : globalThis);
