// The screenshot scenes behind ?shot=title|play|boss|over. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (flee what is close, chase the nearest ember, keep off the walls), so the
// frame is what a short game really looks like and the same seed always gives the
// same frame. The play scene's pilot is careful and survives; the end scene's is
// careless, so it is caught out as a hurried player is.

import { ARENA, STEP, VIEW } from './config.js';
import { clamp, distance } from './random.js';

const TITLE_SECONDS = 5;
// 93 s lands three seconds into the first Ember Surge (90 s): the swarm is
// pouring in twice as fast and the surge banner is still up, so the frame
// shows the game at its busiest rather than its sparsest.
const PLAY_SECONDS = 93;
const BOSS_LIMIT_SECONDS = 130;
const END_LIMIT_SECONDS = 600;

/** An input-shaped object the world can step with: move toward the nearest ember, away from near foes. */
export function autopilotInput(world, skill) {
  return {
    moveVector() {
      const p = world.player;
      let fx = 0;
      let fy = 0;
      for (const enemy of world.enemies) {
        const d = distance(p.x, p.y, enemy.x, enemy.y);
        if (d < 190) {
          const weight = ((190 - d) / 190) * (skill ? 2.4 : 0.35);
          fx += ((p.x - enemy.x) / (d || 1)) * weight;
          fy += ((p.y - enemy.y) / (d || 1)) * weight;
        }
      }
      let bestGem = null;
      let bestDist = 360;
      for (const gem of world.gems) {
        const d = distance(p.x, p.y, gem.x, gem.y);
        if (d < bestDist) {
          bestDist = d;
          bestGem = gem;
        }
      }
      if (bestGem) {
        fx += (bestGem.x - p.x) / (bestDist || 1);
        fy += (bestGem.y - p.y) / (bestDist || 1);
      }
      if (p.x < 220) fx += 1;
      if (p.x > ARENA.width - 220) fx -= 1;
      if (p.y < 220) fy += 1;
      if (p.y > ARENA.height - 220) fy -= 1;
      const len = Math.hypot(fx, fy);
      if (len < 0.05) return { x: 0, y: 0 };
      return { x: fx / len, y: fy / len };
    },
  };
}

function stepFor(world, seconds, skill) {
  const input = autopilotInput(world, skill);
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.update(STEP, input);
    if (world.over || world.won) break;
  }
}

/**
 * Set `world` to the named scene (title, play, boss or over; any other name is title)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    // A mid-game hero moment: a few levels in, two weapons running, the swarm closing in.
    world.player.weapons = { emberBolt: 2, orbitFlame: 1 };
    world.player.level = 3;
    world.player.xpNext = 26;
    stepFor(world, PLAY_SECONDS, true);
    // Frame the hero shot: clear any live boss through the real kill path
    // (its bar would hang over an empty sky once it walks off-frame).
    for (const enemy of [...world.enemies]) if (enemy.boss) world.killEnemy(enemy);
    stepFor(world, 0.5, true);
    return { screen: 'play', best: 0 };
  }
  if (name === 'boss') {
    // Stop shortly after the first boss walks in, while the fight is still live.
    // The boss is moved into frame, right of the player, so the fight is the picture.
    const input = autopilotInput(world, true);
    let bossSeen = 0;
    let placed = false;
    for (let i = 0; i < BOSS_LIMIT_SECONDS / STEP; i += 1) {
      world.update(STEP, input);
      if (world.over || world.won) break;
      const boss = world.enemies.find((enemy) => enemy.boss);
      if (boss) {
        if (!placed) {
          const p = world.player;
          const camX = clamp(p.x - VIEW.width / 2, 0, ARENA.width - VIEW.width);
          const camY = clamp(p.y - VIEW.height / 2, 0, ARENA.height - VIEW.height);
          boss.x = camX + VIEW.width * 0.7;
          boss.y = camY + VIEW.height * 0.66;
          placed = true;
        }
        bossSeen += 1;
        if (bossSeen > 2 / STEP) break;
      }
    }
    return { screen: 'play', best: 0 };
  }
  if (name === 'over') {
    stepFor(world, END_LIMIT_SECONDS, false);
    return { screen: world.over ? 'over' : 'play', best: world.score };
  }
  stepFor(world, TITLE_SECONDS, true);
  return { screen: 'title', best: 0 };
}
