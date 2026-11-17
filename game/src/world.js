// The simulation: player, enemies, weapons, gems, particles and the spawn director.
// Pure rules, no drawing and no DOM: render.js draws what this holds, main.js steps it
// at a fixed 1/60 s and opens the level-up chooser when it asks for one.

import {
  ARENA, BOSSES, ENEMIES, MAX_ENEMIES, PASSIVES, PLAYER_BASE,
  SURVIVE_SECONDS, WEAPONS, spawnRowAt, xpForLevel,
} from './config.js';
import { angleTo, chance, clamp, distance, pickWeighted, range } from './random.js';

const TAU = Math.PI * 2;

export class World {
  constructor(rng, audio) {
    this.rng = rng;
    this.audio = audio;
    this.reset();
  }

  reset() {
    this.time = 0;
    this.kills = 0;
    this.score = 0;
    this.streak = 0;
    this.streakTimer = 0;
    this.wave = 1;
    this.banner = null;
    this.bannerTimer = 0;
    this.shake = 0;
    this.hitStop = 0;
    this.spawnTimer = 0.5;
    this.bossIndex = 0;
    this.warnedBoss = false;
    this.pendingLevelUps = 0;
    this.over = false;
    this.won = false;
    this.events = [];
    this.enemies = [];
    this.shots = [];
    this.foeShots = [];
    this.gems = [];
    this.pickups = [];
    this.particles = [];
    this.floaters = [];
    this.novas = [];
    this.telegraphs = [];
    this.player = {
      x: ARENA.width / 2,
      y: ARENA.height / 2,
      radius: PLAYER_BASE.radius,
      speed: PLAYER_BASE.speed,
      hp: PLAYER_BASE.maxHp,
      maxHp: PLAYER_BASE.maxHp,
      magnet: PLAYER_BASE.magnet,
      damageMul: 1,
      cooldownMul: 1,
      level: 1,
      xp: 0,
      xpNext: xpForLevel(1),
      weapons: { emberBolt: 1 },
      passives: {},
      facing: -Math.PI / 2,
      iframes: 0,
      hurtFlash: 0,
      walkCycle: 0,
      moving: false,
    };
    this.weaponState = {
      emberBolt: { timer: 0.3 },
      orbitFlame: { angle: 0 },
      novaPulse: { timer: 1.6 },
      frostShard: { timer: 0.8 },
      meteor: { timer: 2.5 },
    };
    this.showBanner('SURVIVE UNTIL DAWN — 5:00', 2.6);
  }

  showBanner(text, seconds) {
    this.banner = text;
    this.bannerTimer = seconds;
  }

  // -- level-ups -----------------------------------------------------------

  levelUpChoices() {
    const pool = [];
    const owned = this.player.weapons;
    const ownedCount = Object.keys(owned).length;
    for (const [id, def] of Object.entries(WEAPONS)) {
      if (owned[id] === undefined) {
        if (ownedCount < 4) pool.push({ weight: 2, value: { id, level: 1, isNew: true, def } });
      } else if (owned[id] < def.maxLevel) {
        pool.push({ weight: 3, value: { id, level: owned[id] + 1, isNew: false, def } });
      }
    }
    for (const [id, def] of Object.entries(PASSIVES)) {
      const level = this.player.passives[id] || 0;
      if (level < def.maxLevel) pool.push({ weight: 2, value: { id, level: level + 1, isNew: level === 0, def } });
    }
    const choices = [];
    const remaining = pool.slice();
    while (choices.length < 3 && remaining.length > 0) {
      const choice = pickWeighted(this.rng, remaining);
      choices.push(choice);
      const index = remaining.findIndex((entry) => entry.value.id === choice.id);
      if (index >= 0) remaining.splice(index, 1);
    }
    // A level-up should always offer something to fight with: if the draw came
    // up all passives while a weapon is available, swap the last card for one.
    if (choices.length === 3 && !choices.some((c) => c.def.kind === 'weapon')) {
      const weaponOptions = remaining.filter((entry) => entry.value.def.kind === 'weapon');
      if (weaponOptions.length > 0) {
        choices[choices.length - 1] = pickWeighted(this.rng, weaponOptions);
      }
    }
    while (choices.length < 3) {
      choices.push({ id: 'heal', level: 1, isNew: false, def: { name: 'Second Wind', blurb: 'Recover 50 health right now.' } });
    }
    return choices;
  }

  applyUpgrade(choice) {
    const p = this.player;
    if (choice.id === 'heal') {
      p.hp = Math.min(p.maxHp, p.hp + 50);
      this.addFloater(p.x, p.y - 30, '+50', '#7ee081');
      return;
    }
    const weapon = WEAPONS[choice.id];
    if (weapon) {
      p.weapons[choice.id] = choice.level;
      if (choice.isNew) {
        this.weaponState[choice.id] = this.weaponState[choice.id] || { timer: 0.2, angle: 0 };
        this.weaponState[choice.id].timer = 0.15;
      }
      return;
    }
    const passive = PASSIVES[choice.id];
    if (passive) {
      p.passives[choice.id] = choice.level;
      this.recomputePassives();
      if (choice.id === 'emberHeart') {
        p.hp = Math.min(p.maxHp, p.hp + 30);
        this.addFloater(p.x, p.y - 30, '+25', '#7ee081');
      }
    }
  }

  recomputePassives() {
    const p = this.player;
    p.speed = PLAYER_BASE.speed;
    p.maxHp = PLAYER_BASE.maxHp;
    p.magnet = PLAYER_BASE.magnet;
    p.damageMul = 1;
    p.cooldownMul = 1;
    for (const [id, level] of Object.entries(p.passives)) {
      PASSIVES[id].apply(p, level);
    }
    p.hp = Math.min(p.hp, p.maxHp);
  }

  addXp(amount) {
    const p = this.player;
    p.xp += amount;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level += 1;
      p.xpNext = xpForLevel(p.level);
      this.pendingLevelUps += 1;
      this.events.push({ type: 'levelup' });
      p.hp = Math.min(p.maxHp, p.hp + 8);
      this.audio.levelUp();
      this.addParticles(p.x, p.y, '#ffd23c', 40, 320);
      this.addParticles(p.x, p.y, '#ff9a3c', 14, 200);
      this.shake = Math.max(this.shake, 6);
    }
  }

  // -- spawning ------------------------------------------------------------

  spawnPoint() {
    const p = this.player;
    const margin = 60;
    const side = Math.floor(this.rng() * 4);
    let x;
    let y;
    if (side === 0) { x = range(this.rng, 0, ARENA.width); y = -margin; }
    else if (side === 1) { x = ARENA.width + margin; y = range(this.rng, 0, ARENA.height); }
    else if (side === 2) { x = range(this.rng, 0, ARENA.width); y = ARENA.height + margin; }
    else { x = -margin; y = range(this.rng, 0, ARENA.height); }
    // Keep spawns out of the player's sight so they walk in.
    if (distance(x, y, p.x, p.y) < 520) {
      x = p.x + (x < p.x ? -620 : 620);
      y = p.y + (y < p.y ? -620 : 620);
    }
    return { x: clamp(x, -80, ARENA.width + 80), y: clamp(y, -80, ARENA.height + 80) };
  }

  spawnEnemy(kind, x, y) {
    const def = ENEMIES[kind];
    const point = x === undefined ? this.spawnPoint() : { x, y };
    // The swarm toughens as the night wears on: +140% health, +50% speed and
    // +67% damage by dawn, so the late game stays a fight instead of a mop-up.
    const hpScale = 1 + (this.time / SURVIVE_SECONDS) * 1.4;
    const speedScale = 1 + this.time / 600;
    const dmgScale = 1 + this.time / 450;
    const hp = Math.round(def.hp * hpScale);
    this.enemies.push({
      kind, name: def.name,
      x: point.x, y: point.y, vx: 0, vy: 0,
      radius: def.radius, hp, maxHp: hp,
      speed: def.speed * range(this.rng, 0.92, 1.08) * speedScale,
      damage: Math.round(def.damage * dmgScale), xp: def.xp, color: def.color, score: def.score,
      ranged: !!def.ranged, range: def.range || 0, shotTimer: range(this.rng, 0.5, 2),
      shotCooldown: def.shotCooldown || 0,
      flash: 0, slowTimer: 0, slowFactor: 1, hitTimer: 0, orbitTimer: 0,
      boss: false, pattern: null, patternTimer: 0, telegraph: 0, chargeVx: 0, chargeVy: 0,
      wobble: range(this.rng, 0, TAU),
      mode: 'hunt', modeTimer: 0, dashCd: range(this.rng, 1, 2), dashVx: 0, dashVy: 0,
    });
  }

  spawnBoss() {
    const def = BOSSES[this.bossIndex];
    if (!def) return;
    this.bossIndex += 1;
    const point = this.spawnPoint();
    this.enemies.push({
      kind: 'boss', name: def.name,
      x: point.x, y: point.y, vx: 0, vy: 0,
      radius: def.radius, hp: def.hp, maxHp: def.hp,
      speed: def.speed, damage: def.damage, xp: def.xp,
      color: def.color, ring: def.ring, score: 500,
      ranged: false, range: 0, shotTimer: 0, shotCooldown: 0,
      flash: 0, slowTimer: 0, slowFactor: 1, hitTimer: 0, orbitTimer: 0,
      boss: true, pattern: def.pattern, patternTimer: 2.5, telegraph: 0, chargeVx: 0, chargeVy: 0,
      wobble: 0,
    });
    this.showBanner(`${def.name.toUpperCase()} AWAKENS`, 2.6);
    this.events.push({ type: 'boss', name: def.name });
    this.audio.boss();
    this.shake = Math.max(this.shake, 12);
    this.warnedBoss = false;
  }

  // -- combat --------------------------------------------------------------

  nearestEnemy(x, y, maxDist) {
    let best = null;
    let bestDist = maxDist === undefined ? Infinity : maxDist;
    for (const enemy of this.enemies) {
      const d = distance(x, y, enemy.x, enemy.y);
      if (d < bestDist) {
        bestDist = d;
        best = enemy;
      }
    }
    return best;
  }

  fireWeapon(id, level) {
    const p = this.player;
    const def = WEAPONS[id].levels[level - 1];
    const dmg = (amount) => amount * p.damageMul;
    if (id === 'emberBolt') {
      const target = this.nearestEnemy(p.x, p.y, 620);
      if (!target) return;
      const base = angleTo(p.x, p.y, target.x, target.y);
      for (let i = 0; i < def.count; i += 1) {
        const spread = (i - (def.count - 1) / 2) * 0.14;
        const angle = base + spread;
        this.shots.push({
          x: p.x, y: p.y, vx: Math.cos(angle) * def.speed, vy: Math.sin(angle) * def.speed,
          radius: 6, damage: dmg(def.damage), pierce: def.pierce, kind: 'bolt', life: 1.4,
        });
      }
      p.facing = base;
      this.audio.shoot();
    } else if (id === 'frostShard') {
      const target = this.nearestEnemy(p.x, p.y, 620);
      if (!target) return;
      const base = angleTo(p.x, p.y, target.x, target.y);
      for (let i = 0; i < def.count; i += 1) {
        const spread = (i - (def.count - 1) / 2) * 0.16;
        const angle = base + spread;
        this.shots.push({
          x: p.x, y: p.y, vx: Math.cos(angle) * 460, vy: Math.sin(angle) * 460,
          radius: 5, damage: dmg(def.damage), pierce: def.pierce, kind: 'shard',
          slow: def.slow, slowTime: def.slowTime, life: 1.2,
        });
      }
      p.facing = base;
      this.audio.shoot();
    } else if (id === 'novaPulse') {
      this.novas.push({ x: p.x, y: p.y, r: 20, maxR: def.radius, speed: 520, damage: dmg(def.damage), knock: def.knock, hit: new Set() });
      this.audio.nova();
      this.shake = Math.max(this.shake, 4);
    } else if (id === 'meteor') {
      for (let i = 0; i < def.strikes; i += 1) {
        const target = this.enemies.length > 0
          ? this.enemies[Math.floor(this.rng() * this.enemies.length)]
          : null;
        const cx = target ? target.x + range(this.rng, -40, 40) : p.x + range(this.rng, -260, 260);
        const cy = target ? target.y + range(this.rng, -40, 40) : p.y + range(this.rng, -260, 260);
        this.telegraphs.push({ x: cx, y: cy, r: def.radius, timer: 0.55, damage: dmg(def.damage) });
      }
    }
  }

  damageEnemy(enemy, amount, kx, ky) {
    // One hit in ten lands critical: double damage, a bigger golden number.
    let crit = false;
    if (this.rng() < 0.1) {
      amount *= 2;
      crit = true;
    }
    enemy.hp -= amount;
    enemy.flash = 0.09;
    if (kx !== undefined) {
      const len = Math.hypot(kx, ky) || 1;
      enemy.vx += (kx / len) * 60;
      enemy.vy += (ky / len) * 60;
    }
    if (this.floaters.length < 42) {
      this.addFloater(
        enemy.x + range(this.rng, -8, 8), enemy.y - enemy.radius - 4,
        crit ? `${Math.round(amount)}!` : String(Math.round(amount)),
        crit ? '#ffd23c' : '#ffe9b0', crit ? 21 : 15,
      );
    }
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  killEnemy(enemy) {
    const index = this.enemies.indexOf(enemy);
    if (index === -1) return;
    this.enemies.splice(index, 1);
    this.kills += 1;
    this.score += enemy.score;
    this.streak += 1;
    this.streakTimer = 3;
    if (this.streak === 10 || this.streak === 25 || this.streak === 50 || this.streak === 100) {
      this.showBanner(`${this.streak} KILL STREAK`, 1.6);
    }
    this.addParticles(enemy.x, enemy.y, enemy.color, enemy.boss ? 46 : 12, enemy.boss ? 320 : 180);
    this.addParticles(enemy.x, enemy.y, '#ffb347', enemy.boss ? 20 : 5, 120);
    if (enemy.kind === 'brute') this.hitStop = Math.max(this.hitStop, 0.02);
    if (enemy.kind === 'splitter' && this.enemies.length < MAX_ENEMIES + 20) {
      for (let i = 0; i < 2; i += 1) {
        this.spawnEnemy('mote', enemy.x + range(this.rng, -14, 14), enemy.y + range(this.rng, -14, 14));
      }
    }
    if (enemy.boss) {
      this.shake = Math.max(this.shake, 16);
      this.hitStop = 0.06;
      this.audio.explode();
      for (let i = 0; i < 6; i += 1) {
        this.gems.push({ x: enemy.x + range(this.rng, -50, 50), y: enemy.y + range(this.rng, -50, 50), value: 10, big: true, vx: 0, vy: 0 });
      }
      this.pickups.push({ x: enemy.x - 40, y: enemy.y, kind: 'health', vx: 0, vy: 0 });
      this.pickups.push({ x: enemy.x + 40, y: enemy.y, kind: 'magnet', vx: 0, vy: 0 });
      return;
    }
    this.gems.push({ x: enemy.x, y: enemy.y, value: enemy.xp, big: enemy.xp >= 5, vx: 0, vy: 0 });
    if (enemy.kind === 'brute' && chance(this.rng, 0.2)) {
      this.pickups.push({ x: enemy.x, y: enemy.y, kind: 'health', vx: 0, vy: 0 });
    }
  }

  hurtPlayer(amount, fromX, fromY) {
    const p = this.player;
    if (p.iframes > 0 || this.over) return;
    p.hp -= amount;
    p.iframes = 0.4;
    p.hurtFlash = 0.25;
    this.shake = Math.max(this.shake, 10);
    this.streak = 0;
    this.audio.hurt();
    this.addParticles(p.x, p.y, '#ff4d4d', 14, 200);
    if (fromX !== undefined) {
      const angle = angleTo(fromX, fromY, p.x, p.y);
      p.x += Math.cos(angle) * 14;
      p.y += Math.sin(angle) * 14;
      p.x = clamp(p.x, p.radius, ARENA.width - p.radius);
      p.y = clamp(p.y, p.radius, ARENA.height - p.radius);
    }
    if (p.hp <= 0) {
      p.hp = 0;
      this.over = true;
      this.events.push({ type: 'gameover' });
      this.audio.defeat();
      this.addParticles(p.x, p.y, '#ffb347', 60, 340);
      this.addParticles(p.x, p.y, '#ff4d4d', 30, 260);
      this.shake = 18;
    }
  }

  // -- helpers ---------------------------------------------------------------

  addParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      if (this.particles.length > 420) return;
      const angle = this.rng() * TAU;
      const v = range(this.rng, speed * 0.3, speed);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * v, vy: Math.sin(angle) * v,
        life: range(this.rng, 0.3, 0.7), maxLife: 0.7,
        size: range(this.rng, 2, 4.5), color,
      });
    }
  }

  addFloater(x, y, text, color, size = 15) {
    this.floaters.push({ x, y, text, color, size, life: 0.8, maxLife: 0.8 });
  }

  // -- step ------------------------------------------------------------------

  update(dt, input) {
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return;
    }
    const p = this.player;
    this.time += dt;
    this.score = this.kills * 10 + Math.floor(this.time) * 5 + p.level * 100 + (this.won ? 2000 : 0);

    if (this.streakTimer > 0) {
      this.streakTimer -= dt;
      if (this.streakTimer <= 0) this.streak = 0;
    }
    if (this.bannerTimer > 0) this.bannerTimer -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
    if (p.iframes > 0) p.iframes -= dt;
    if (p.hurtFlash > 0) p.hurtFlash -= dt;
    // A slow ember mend: the Warden recovers a little between hits.
    if (p.hp > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 0.3 * dt);

    // Movement.
    const move = input.moveVector();
    p.moving = move.x !== 0 || move.y !== 0;
    if (p.moving) {
      p.x = clamp(p.x + move.x * p.speed * dt, p.radius, ARENA.width - p.radius);
      p.y = clamp(p.y + move.y * p.speed * dt, p.radius, ARENA.height - p.radius);
      p.facing = Math.atan2(move.y, move.x);
      p.walkCycle += dt * 10;
    }

    // Weapons.
    for (const [id, level] of Object.entries(p.weapons)) {
      const def = WEAPONS[id].levels[level - 1];
      const state = this.weaponState[id];
      if (!state) continue;
      if (id === 'emberBolt' || id === 'frostShard') {
        state.timer -= dt;
        if (state.timer <= 0) {
          state.timer = def.cooldown * p.cooldownMul;
          this.fireWeapon(id, level);
        }
      } else if (id === 'novaPulse') {
        state.timer -= dt;
        if (state.timer <= 0) {
          state.timer = def.cooldown * p.cooldownMul;
          this.fireWeapon(id, level);
        }
      } else if (id === 'meteor') {
        state.timer -= dt;
        if (state.timer <= 0) {
          state.timer = def.cooldown * p.cooldownMul;
          this.fireWeapon(id, level);
        }
      } else if (id === 'orbitFlame') {
        state.angle += def.speed * dt;
      }
    }

    // Orbit flames damage.
    const orbitLevel = p.weapons.orbitFlame;
    if (orbitLevel) {
      const def = WEAPONS.orbitFlame.levels[orbitLevel - 1];
      const state = this.weaponState.orbitFlame;
      for (let i = 0; i < def.balls; i += 1) {
        const angle = state.angle + (i * TAU) / def.balls;
        const bx = p.x + Math.cos(angle) * def.radius;
        const by = p.y + Math.sin(angle) * def.radius;
        for (const enemy of this.enemies) {
          if (enemy.orbitTimer > 0) continue;
          if (distance(bx, by, enemy.x, enemy.y) < 14 + enemy.radius) {
            enemy.orbitTimer = def.hitCooldown;
            this.damageEnemy(enemy, def.damage * p.damageMul, enemy.x - bx, enemy.y - by);
          }
        }
      }
    }

    // Novas expand and damage once per enemy.
    for (let i = this.novas.length - 1; i >= 0; i -= 1) {
      const nova = this.novas[i];
      nova.r += nova.speed * dt;
      for (const enemy of this.enemies) {
        if (nova.hit.has(enemy)) continue;
        const d = distance(nova.x, nova.y, enemy.x, enemy.y);
        if (d < nova.r + enemy.radius && d > nova.r - 46) {
          nova.hit.add(enemy);
          const angle = angleTo(nova.x, nova.y, enemy.x, enemy.y);
          this.damageEnemy(enemy, nova.damage, Math.cos(angle) * nova.knock, Math.sin(angle) * nova.knock);
        }
      }
      if (nova.r >= nova.maxR) this.novas.splice(i, 1);
    }

    // Meteor telegraphs land.
    for (let i = this.telegraphs.length - 1; i >= 0; i -= 1) {
      const tel = this.telegraphs[i];
      tel.timer -= dt;
      if (tel.timer <= 0) {
        this.telegraphs.splice(i, 1);
        this.addParticles(tel.x, tel.y, '#ff5a2a', 26, 300);
        this.addParticles(tel.x, tel.y, '#ffd23c', 14, 200);
        this.shake = Math.max(this.shake, 7);
        this.audio.explode();
        for (const enemy of this.enemies.slice()) {
          if (distance(tel.x, tel.y, enemy.x, enemy.y) < tel.r + enemy.radius) {
            this.damageEnemy(enemy, tel.damage, enemy.x - tel.x, enemy.y - tel.y);
          }
        }
      }
    }

    // Enemies.
    for (const enemy of this.enemies) {
      if (enemy.flash > 0) enemy.flash -= dt;
      if (enemy.hitTimer > 0) enemy.hitTimer -= dt;
      if (enemy.orbitTimer > 0) enemy.orbitTimer -= dt;
      if (enemy.slowTimer > 0) enemy.slowTimer -= dt;
      const slow = enemy.slowTimer > 0 ? enemy.slowFactor : 1;
      const dx = p.x - enemy.x;
      const dy = p.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      let mx = nx;
      let my = ny;
      let moveSpeed = enemy.speed * slow;
      if (enemy.boss) {
        this.updateBoss(enemy, dt, nx, ny, dist);
        mx = enemy.vx;
        my = enemy.vy;
        moveSpeed = 1;
      } else if (enemy.kind === 'charger') {
        // Hunt, telegraph, dash: close in, flash a warning, then lunge straight
        // at where the Warden stood. Sidestep the flash, don't outrun the dash.
        if (enemy.mode === 'windup') {
          enemy.modeTimer -= dt;
          enemy.telegraph = Math.max(enemy.telegraph, enemy.modeTimer);
          mx = 0;
          my = 0;
          moveSpeed = 0;
          if (enemy.modeTimer <= 0) {
            enemy.mode = 'dash';
            enemy.modeTimer = 0.4;
            enemy.dashVx = nx;
            enemy.dashVy = ny;
            this.audio.shoot();
          }
        } else if (enemy.mode === 'dash') {
          enemy.modeTimer -= dt;
          mx = enemy.dashVx;
          my = enemy.dashVy;
          moveSpeed = 520;
          if (enemy.modeTimer <= 0) {
            enemy.mode = 'hunt';
            enemy.dashCd = 2.5;
          }
        } else {
          enemy.dashCd -= dt;
          const wob = Math.sin(this.time * 2.2 + enemy.wobble) * 0.25;
          mx = nx - ny * wob;
          my = ny + nx * wob;
          if (dist < 280 && enemy.dashCd <= 0) {
            enemy.mode = 'windup';
            enemy.modeTimer = 0.45;
            enemy.telegraph = 0.45;
          }
        }
      } else if (enemy.ranged) {
        if (dist > enemy.range) {
          mx = nx; my = ny;
        } else if (dist < enemy.range * 0.65) {
          mx = -nx * 0.5; my = -ny * 0.5;
        } else {
          const wob = Math.sin(this.time * 1.7 + enemy.wobble);
          mx = -ny * wob * 0.4;
          my = nx * wob * 0.4;
        }
        enemy.shotTimer -= dt;
        if (enemy.shotTimer <= 0 && dist < enemy.range + 120) {
          enemy.shotTimer = enemy.shotCooldown;
          // Aimed with a wobble, and slow enough to sidestep: standing still
          // gets you shot, moving across the shot's line dodges it.
          const aimErr = range(this.rng, -0.14, 0.14);
          const angle = Math.atan2(ny, nx) + aimErr;
          const speed = 215;
          this.foeShots.push({
            x: enemy.x, y: enemy.y,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            radius: 6, damage: enemy.damage, life: 3,
          });
        }
      } else {
        const wob = Math.sin(this.time * 2.2 + enemy.wobble) * 0.25;
        mx = nx - ny * wob;
        my = ny + nx * wob;
      }
      const speed = moveSpeed;
      const len = Math.hypot(mx, my) || 1;
      enemy.x += ((mx / len) * speed + enemy.vx) * dt;
      enemy.y += ((my / len) * speed + enemy.vy) * dt;
      enemy.vx *= 0.86;
      enemy.vy *= 0.86;
      enemy.x = clamp(enemy.x, -60, ARENA.width + 60);
      enemy.y = clamp(enemy.y, -60, ARENA.height + 60);
      // Touch damage.
      if (!this.over && enemy.hitTimer <= 0 && distance(enemy.x, enemy.y, p.x, p.y) < enemy.radius + p.radius - 2) {
        enemy.hitTimer = 0.6;
        this.hurtPlayer(enemy.damage, enemy.x, enemy.y);
      }
    }

    // Gentle separation so the swarm does not stack into one blob.
    const list = this.enemies;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.radius + b.radius - 2;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = (min - d) / 2;
          const ux = dx / d;
          const uy = dy / d;
          const aWeight = a.boss ? 0.15 : 1;
          const bWeight = b.boss ? 0.15 : 1;
          a.x -= ux * push * aWeight;
          a.y -= uy * push * aWeight;
          b.x += ux * push * bWeight;
          b.y += uy * push * bWeight;
        }
      }
    }

    // Player shots.
    for (let i = this.shots.length - 1; i >= 0; i -= 1) {
      const shot = this.shots[i];
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      let dead = shot.life <= 0 || shot.x < -40 || shot.x > ARENA.width + 40 || shot.y < -40 || shot.y > ARENA.height + 40;
      if (!dead) {
        for (const enemy of this.enemies.slice()) {
          if (distance(shot.x, shot.y, enemy.x, enemy.y) < shot.radius + enemy.radius) {
            if (shot.kind === 'shard') {
              enemy.slowTimer = shot.slowTime;
              enemy.slowFactor = 1 - shot.slow;
            }
            this.damageEnemy(enemy, shot.damage, shot.vx, shot.vy);
            this.addParticles(shot.x, shot.y, shot.kind === 'shard' ? '#a8e6ff' : '#ffd9a0', 3, 90);
            if (shot.pierce > 0) {
              shot.pierce -= 1;
            } else {
              dead = true;
            }
            break;
          }
        }
      }
      if (dead) this.shots.splice(i, 1);
    }

    // Enemy shots.
    for (let i = this.foeShots.length - 1; i >= 0; i -= 1) {
      const shot = this.foeShots[i];
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      if (shot.life <= 0 || shot.x < -40 || shot.x > ARENA.width + 40 || shot.y < -40 || shot.y > ARENA.height + 40) {
        this.foeShots.splice(i, 1);
        continue;
      }
      if (!this.over && distance(shot.x, shot.y, p.x, p.y) < shot.radius + p.radius) {
        this.foeShots.splice(i, 1);
        this.hurtPlayer(shot.damage, shot.x - shot.vx, shot.y - shot.vy);
      }
    }

    // Gems: drift to the player inside the magnet radius, collect on touch.
    // A slow drift even outside the radius keeps far kills from feeling wasted.
    for (let i = this.gems.length - 1; i >= 0; i -= 1) {
      const gem = this.gems[i];
      const d = distance(gem.x, gem.y, p.x, p.y);
      const angle = angleTo(gem.x, gem.y, p.x, p.y);
      if (d < p.magnet) {
        const pull = 780 * (1 - d / (p.magnet + 40));
        gem.vx += Math.cos(angle) * pull * dt * 4;
        gem.vy += Math.sin(angle) * pull * dt * 4;
      } else if (d < p.magnet * 2) {
        gem.vx += Math.cos(angle) * 60 * dt * 4;
        gem.vy += Math.sin(angle) * 60 * dt * 4;
      }
      gem.x += gem.vx * dt;
      gem.y += gem.vy * dt;
      gem.vx *= 0.9;
      gem.vy *= 0.9;
      if (d < p.radius + 12) {
        this.gems.splice(i, 1);
        this.audio.pickup();
        this.addParticles(gem.x, gem.y, '#ffa62b', 3, 90);
        this.addXp(gem.value);
      }
    }

    // Pickups.
    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = this.pickups[i];
      const d = distance(pickup.x, pickup.y, p.x, p.y);
      if (d < p.magnet * 0.8) {
        const angle = angleTo(pickup.x, pickup.y, p.x, p.y);
        pickup.vx += Math.cos(angle) * 500 * dt * 4;
        pickup.vy += Math.sin(angle) * 500 * dt * 4;
      }
      pickup.x += pickup.vx * dt;
      pickup.y += pickup.vy * dt;
      pickup.vx *= 0.9;
      pickup.vy *= 0.9;
      if (d < p.radius + 14) {
        this.pickups.splice(i, 1);
        if (pickup.kind === 'health') {
          p.hp = Math.min(p.maxHp, p.hp + 30);
          this.addFloater(p.x, p.y - 28, '+30', '#7ee081');
          this.audio.heal();
        } else {
          for (const gem of this.gems) {
            const ga = angleTo(gem.x, gem.y, p.x, p.y);
            gem.vx = Math.cos(ga) * 700;
            gem.vy = Math.sin(ga) * 700;
          }
          this.addFloater(p.x, p.y - 28, 'MAGNET!', '#6ec6ff');
          this.audio.pickup();
        }
      }
    }

    // Particles and floaters.
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floaters.length - 1; i >= 0; i -= 1) {
      const fl = this.floaters[i];
      fl.y -= 34 * dt;
      fl.life -= dt;
      if (fl.life <= 0) this.floaters.splice(i, 1);
    }

    // Spawn director.
    const row = spawnRowAt(this.time);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.enemies.length < MAX_ENEMIES) {
      this.spawnTimer = row.interval;
      const kinds = ['wisp', 'cinder', 'brute', 'spitter', 'charger', 'splitter'];
      for (let i = 0; i < row.batch; i += 1) {
        if (this.enemies.length >= MAX_ENEMIES) break;
        const kind = pickWeighted(this.rng, kinds.map((k, idx) => ({ weight: row.weights[idx], value: k })));
        this.spawnEnemy(kind);
      }
    }
    const nextWave = Math.floor(this.time / 30) + 1;
    if (nextWave !== this.wave) {
      this.wave = nextWave;
      this.showBanner(`WAVE ${this.wave} — THE SWARM THICKENS`, 2);
    }
    const nextBoss = BOSSES[this.bossIndex];
    if (nextBoss && !this.warnedBoss && this.time >= nextBoss.at - 3) {
      this.warnedBoss = true;
      this.showBanner(`⚠ ${nextBoss.name.toUpperCase()} APPROACHES ⚠`, 2.8);
      this.audio.boss();
    }
    if (nextBoss && this.time >= nextBoss.at) this.spawnBoss();

    // Victory.
    if (!this.won && this.time >= SURVIVE_SECONDS) {
      this.won = true;
      this.events.push({ type: 'victory' });
      this.audio.victory();
      this.addParticles(p.x, p.y, '#ffd23c', 80, 380);
    }
  }

  updateBoss(enemy, dt, nx, ny, dist) {
    enemy.patternTimer -= dt;
    if (enemy.telegraph > 0) {
      enemy.telegraph -= dt;
      enemy.vx = 0;
      enemy.vy = 0;
      if (enemy.telegraph <= 0 && enemy.pattern === 'charge') {
        const angle = Math.atan2(ny, nx);
        enemy.chargeVx = Math.cos(angle) * 430;
        enemy.chargeVy = Math.sin(angle) * 430;
        enemy.chargeTime = 0.5;
      }
      return;
    }
    if (enemy.chargeTime !== undefined && enemy.chargeTime > 0) {
      enemy.chargeTime -= dt;
      enemy.vx = enemy.chargeVx;
      enemy.vy = enemy.chargeVy;
      return;
    }
    enemy.vx = nx;
    enemy.vy = ny;
    if (enemy.patternTimer > 0) return;
    if (enemy.pattern === 'burst') {
      enemy.patternTimer = 4.5;
      for (let i = 0; i < 12; i += 1) {
        const angle = (i / 12) * TAU + this.time * 0.3;
        this.foeShots.push({
          x: enemy.x, y: enemy.y,
          vx: Math.cos(angle) * 210, vy: Math.sin(angle) * 210,
          radius: 7, damage: 12, life: 4,
        });
      }
      this.audio.boss();
    } else if (enemy.pattern === 'charge') {
      enemy.patternTimer = 5.5;
      enemy.telegraph = 0.7;
      this.shake = Math.max(this.shake, 6);
    } else if (enemy.pattern === 'minions') {
      enemy.patternTimer = 6;
      for (let i = 0; i < 5; i += 1) {
        const angle = (i / 5) * TAU;
        this.spawnEnemy('wisp', enemy.x + Math.cos(angle) * 70, enemy.y + Math.sin(angle) * 70);
      }
      this.showBanner('THE TITAN CALLS ITS SWARM', 1.8);
    }
  }
}
