// EMBERFALL tuning, palette and content tables. One job: every number and name the
// rest of the game reads, so balance lives in one place.

export const VIEW = { width: 1280, height: 720 };
export const ARENA = { width: 2560, height: 1440 };
export const STEP = 1 / 60;
export const SURVIVE_SECONDS = 300;
export const MAX_ENEMIES = 190;
export const MAX_LEVEL_UP_CHOICES = 3;

export const PALETTE = {
  ground: '#161009',
  groundAlt: '#1b130b',
  grid: '#241a10',
  arenaEdge: '#ff9a3c',
  player: '#ffb347',
  playerCore: '#fff3d6',
  playerRing: '#ff7b2f',
  gem: '#ffa62b',
  gemBig: '#ffd23c',
  health: '#7ee081',
  magnet: '#6ec6ff',
  wisp: '#b794f6',
  cinder: '#ff6b4a',
  brute: '#d63c2f',
  spitter: '#7ee081',
  charger: '#ff8c42',
  splitter: '#e879f9',
  mote: '#d8b4fe',
  boss: '#ffd23c',
  bossRing: '#ff3d7e',
  shot: '#ffd9a0',
  shard: '#a8e6ff',
  nova: '#ff9a3c',
  meteor: '#ff5a2a',
  text: '#f5e9d3',
  textDim: '#c9b18c',
  danger: '#ff4d4d',
  panel: 'rgba(20, 12, 6, 0.88)',
  panelEdge: '#5a3d1e',
  card: '#241708',
  cardEdge: '#8a5a22',
  cardHot: '#ffb347',
};

export const PLAYER_BASE = {
  radius: 16,
  speed: 186,
  maxHp: 100,
  magnet: 170,
  damageMul: 1,
  cooldownMul: 1,
  xpNext: 6,
};

// Weapons. `levels` holds one stat block per level (index 0 is level 1). A weapon a
// level-up offers is either new (level 1) or one level higher than owned.
export const WEAPONS = {
  emberBolt: {
    name: 'Ember Bolt',
    kind: 'weapon',
    maxLevel: 5,
    blurb: 'Hurls burning bolts at the nearest foe.',
    levels: [
      { damage: 14, cooldown: 0.5, count: 1, pierce: 0, speed: 540 },
      { damage: 18, cooldown: 0.48, count: 1, pierce: 0, speed: 560 },
      { damage: 20, cooldown: 0.44, count: 2, pierce: 0, speed: 580 },
      { damage: 24, cooldown: 0.4, count: 2, pierce: 1, speed: 600 },
      { damage: 30, cooldown: 0.36, count: 3, pierce: 1, speed: 640 },
    ],
  },
  orbitFlame: {
    name: 'Orbit Flames',
    kind: 'weapon',
    maxLevel: 5,
    blurb: 'Fireballs circle you, scorching all they touch.',
    levels: [
      { damage: 10, balls: 2, radius: 74, speed: 2.6, hitCooldown: 0.4 },
      { damage: 13, balls: 2, radius: 82, speed: 2.8, hitCooldown: 0.38 },
      { damage: 16, balls: 3, radius: 88, speed: 3.0, hitCooldown: 0.35 },
      { damage: 20, balls: 3, radius: 96, speed: 3.2, hitCooldown: 0.32 },
      { damage: 26, balls: 4, radius: 104, speed: 3.5, hitCooldown: 0.28 },
    ],
  },
  novaPulse: {
    name: 'Nova Pulse',
    kind: 'weapon',
    maxLevel: 5,
    blurb: 'A shockwave that hurls the swarm back.',
    levels: [
      { damage: 18, cooldown: 3.4, radius: 150, knock: 280 },
      { damage: 24, cooldown: 3.1, radius: 170, knock: 300 },
      { damage: 30, cooldown: 2.8, radius: 190, knock: 320 },
      { damage: 38, cooldown: 2.5, radius: 210, knock: 340 },
      { damage: 48, cooldown: 2.2, radius: 240, knock: 380 },
    ],
  },
  frostShard: {
    name: 'Frost Shards',
    kind: 'weapon',
    maxLevel: 5,
    blurb: 'Piercing ice shards that slow what they cut.',
    levels: [
      { damage: 9, cooldown: 1.5, count: 3, pierce: 2, slow: 0.4, slowTime: 1.2 },
      { damage: 12, cooldown: 1.4, count: 3, pierce: 2, slow: 0.45, slowTime: 1.3 },
      { damage: 14, cooldown: 1.3, count: 4, pierce: 3, slow: 0.5, slowTime: 1.4 },
      { damage: 17, cooldown: 1.2, count: 5, pierce: 3, slow: 0.55, slowTime: 1.5 },
      { damage: 21, cooldown: 1.05, count: 6, pierce: 4, slow: 0.6, slowTime: 1.6 },
    ],
  },
  meteor: {
    name: 'Meteor Call',
    kind: 'weapon',
    maxLevel: 5,
    blurb: 'Meteors crash down on the thickest clusters.',
    levels: [
      { damage: 45, cooldown: 4.6, strikes: 2, radius: 92 },
      { damage: 58, cooldown: 4.3, strikes: 2, radius: 98 },
      { damage: 72, cooldown: 4.0, strikes: 3, radius: 104 },
      { damage: 88, cooldown: 3.7, strikes: 3, radius: 112 },
      { damage: 110, cooldown: 3.3, strikes: 4, radius: 122 },
    ],
  },
};

export const PASSIVES = {
  swiftBoots: {
    name: 'Swift Boots', kind: 'passive', maxLevel: 5,
    blurb: '+8% move speed.',
    apply: (p, level) => { p.speed = PLAYER_BASE.speed * (1 + 0.08 * level); },
  },
  emberHeart: {
    name: 'Ember Heart', kind: 'passive', maxLevel: 3,
    blurb: '+25 max health, heal 25 now.',
    apply: (p, level) => { p.maxHp = PLAYER_BASE.maxHp + 25 * level; },
  },
  magnet: {
    name: 'Lodestone', kind: 'passive', maxLevel: 5,
    blurb: '+40% pickup radius.',
    apply: (p, level) => { p.magnet = PLAYER_BASE.magnet * (1 + 0.4 * level); },
  },
  sharpFocus: {
    name: 'Sharp Focus', kind: 'passive', maxLevel: 5,
    blurb: '+12% damage.',
    apply: (p, level) => { p.damageMul = 1 + 0.12 * level; },
  },
  quickHands: {
    name: 'Quick Hands', kind: 'passive', maxLevel: 5,
    blurb: 'Weapons recharge 8% faster.',
    apply: (p, level) => { p.cooldownMul = 1 - 0.08 * level; },
  },
};

export const ENEMIES = {
  wisp: {
    name: 'Wisp', radius: 10, hp: 12, speed: 90, damage: 6, xp: 1,
    color: PALETTE.wisp, score: 10,
  },
  cinder: {
    name: 'Cinder', radius: 14, hp: 26, speed: 72, damage: 8, xp: 2,
    color: PALETTE.cinder, score: 15,
  },
  brute: {
    name: 'Brute', radius: 24, hp: 95, speed: 48, damage: 18, xp: 5,
    color: PALETTE.brute, score: 30,
  },
  spitter: {
    name: 'Spitter', radius: 12, hp: 20, speed: 62, damage: 6, xp: 3,
    color: PALETTE.spitter, score: 25, ranged: true, range: 280, shotCooldown: 2.8,
  },
  charger: {
    name: 'Charger', radius: 12, hp: 24, speed: 112, damage: 14, xp: 3,
    color: PALETTE.charger, score: 20,
  },
  splitter: {
    name: 'Splitter', radius: 13, hp: 32, speed: 66, damage: 7, xp: 2,
    color: PALETTE.splitter, score: 20,
  },
  // Motes only ever hatch from a Splitter; the director never spawns them.
  mote: {
    name: 'Mote', radius: 7, hp: 8, speed: 102, damage: 4, xp: 1,
    color: PALETTE.mote, score: 5,
  },
};

export const BOSSES = [
  {
    name: 'Ember Warden', radius: 42, hp: 700, speed: 58, damage: 20,
    color: PALETTE.boss, ring: PALETTE.bossRing, xp: 40, at: 60,
    pattern: 'burst', patternEvery: 4.5,
  },
  {
    name: 'Cinder Matriarch', radius: 48, hp: 1300, speed: 52, damage: 22,
    color: '#ff7b9c', ring: PALETTE.boss, xp: 60, at: 150,
    pattern: 'charge', patternEvery: 5.5,
  },
  {
    name: 'Ash Titan', radius: 56, hp: 2200, speed: 46, damage: 26,
    color: '#c77dff', ring: PALETTE.boss, xp: 90, at: 240,
    pattern: 'minions', patternEvery: 6,
  },
];

// Spawn mix weights over time: [wisp, cinder, brute, spitter, charger, splitter]
// at each minute mark. Chargers join at 1:00 to punish standing still; splitters
// join at 2:00 and keep the late swarm dense with hatched motes.
export const SPAWN_TABLE = [
  { at: 0, weights: [0.68, 0.32, 0, 0, 0, 0], interval: 1.0, batch: 1 },
  { at: 30, weights: [0.55, 0.35, 0.05, 0.05, 0, 0], interval: 0.9, batch: 1 },
  { at: 60, weights: [0.44, 0.33, 0.1, 0.08, 0.07, 0], interval: 0.86, batch: 2 },
  { at: 90, weights: [0.4, 0.33, 0.12, 0.08, 0.07, 0], interval: 0.76, batch: 2 },
  { at: 120, weights: [0.34, 0.33, 0.14, 0.1, 0.08, 0.02], interval: 0.64, batch: 2 },
  { at: 180, weights: [0.3, 0.3, 0.18, 0.14, 0.09, 0.02], interval: 0.54, batch: 3 },
  { at: 240, weights: [0.27, 0.28, 0.2, 0.15, 0.11, 0.03], interval: 0.34, batch: 3 },
  { at: 270, weights: [0.25, 0.28, 0.22, 0.15, 0.12, 0.03], interval: 0.28, batch: 3 },
];

// XP to go from `level` to `level + 1`: cheap early so the first upgrades land
// fast, then a gentle quadratic so the late game still has something to earn.
export function xpForLevel(level) {
  return 5 + level * 5 + Math.floor((level * level) / 10);
}

export function spawnRowAt(time) {
  let row = SPAWN_TABLE[0];
  for (const candidate of SPAWN_TABLE) {
    if (time >= candidate.at) row = candidate;
  }
  return row;
}
