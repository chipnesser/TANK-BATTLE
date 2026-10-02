# Adding theaters and encounters

The engine is still the original canvas game. `theaters.js` separates reusable
environments (`THEATERS`) from encounters (`DEFAULT_CAMPAIGN`). Both entry points
read the same definitions; there is no separate game per theater.

| Existing encounter | Environment | Distinct features |
| --- | --- | --- |
| Opening Skirmish | Sunlit Dunes | Original warm sand, rounded dunes, open ground, jeeps |
| Armor Push | Amber Canyon | Rust colors, mesas, ridges, rock barriers, jeep/tank mix |
| Fog Front | Mist Basin | Muted sky/ground, low ridges, ruins, fog, more tanks |
| Wet Crossing | Oasis Crossing | Green banks, low hills, water pools, 55% speed in water |

Enemy stats, boss stats, quotas, spawn intervals and enemy limits keep the
existing campaign balance. Obstacles are small **player movement barriers**;
they do not block shells or enemy navigation. Ridges and riverbeds remain broad,
inexpensive terrain details. The water modifier is the original slowdown.

## Environment fields

- `name`, `hazard`, `backdrop`: identity, active hazard (`null`, `ridges`, `fog`,
  `water`) and horizon style (`dunes`, `mesa`, `lowRidges`, `river`).
- `palette`: two sky colors, three ground colors, hills, rocks, channel tint.
- `weatherModes`, `initialWeather`: allowed weather and entry weather.
- `spawnWeights`, `maxEnemies`, `spawnDelay`: encounter defaults.
- `modifiers`: movement multiplier (default 1), water slowdown (default 0.55),
  fog opacity (0.18 for the existing fog encounter).
- `terrain`: mark count, rock fraction, ridges, water, riverbeds, obstacles.
  Coordinates are world coordinates. Water uses `{x,y,r}`. Obstacles use
  `{x,y,r,style}` (`rock` or `ruin`). Ridges use `{x,y,w,h,angle,tint}` and
  riverbeds use `{x,y,w,h,angle}`. Angles are radians.

Edit `THEATERS` before its definitions are frozen. A future environment can
inherit most fields without copying the engine or a full environment:

```js
THEATERS.nightDunes = {
  ...THEATERS.dunes,
  name: "Moonlit Dunes",
  palette: {
    ...THEATERS.dunes.palette,
    sky: ["#182340", "#667c8b"],
    ground: ["#999886", "#838371", "#6b6f61"],
  },
  weatherModes: ["clear"],
};
```

## Encounter fields

Each encounter selects a `theater`, an `arenaName`, a `challenge`, a positive
integer `killQuota`, and its boss definition. It may override `spawnWeights`,
`maxEnemies` and `spawnDelay` without duplicating the environment.

For example, append an encounter before `createCampaign` compiles the data:

```js
DEFAULT_CAMPAIGN.push({
  ...DEFAULT_CAMPAIGN[1],
  theater: "nightDunes",
  arenaName: "Night Patrol",
  challenge: "Armor After Dark",
  killQuota: 15,
  spawnWeights: { jeep: 1, tank: 3 },
  boss: { ...DEFAULT_CAMPAIGN[1].boss, name: "Night Commander" },
});
```

`createCampaign` derives cumulative kill goals and which boss is last. Appending
this example produces goals 15/30/45/60/75. The previous last boss can still
spawn its support, but the victory lap and ending wait for the new last encounter.
Reordering or shortening encounters works through the same compiler.

`enterPhase` applies the chosen environment, clears old pickups/projectiles,
copies terrain, changes weather and moves the player out of any new obstacle.
It keeps the player's health, ammunition, score and controls. Shared definitions
are frozen; runtime copies prevent one level from corrupting another.

Run both test suites after editing data. The compiler validates enemy mixes,
kill quotas, boss essentials, intervals and obstacle footprints. A new renderer
style or hazard mechanic requires one shared engine extension; adding encounters
or variants using the existing fields requires only data changes.
