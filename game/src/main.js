// EMBERFALL bootstrap and screen flow: title (with the game playing behind it),
// play, level-up chooser, pause, game over and victory. The simulation steps at a
// fixed 1/60 s; rendering follows every animation frame. With ?shot=title|play|boss|over
// it stages one deterministic scene instead and sets window.__shotReady.

import { STEP } from './config.js';
import { makeRng } from './random.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Renderer } from './render.js';
import { autopilotInput, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const audio = new AudioEngine();
const input = new Input(canvas);
const renderer = new Renderer(canvas);

function loadBest() {
  try {
    const saved = JSON.parse(window.localStorage.getItem('emberfall-best') || '{}');
    return { score: saved.score || 0, time: saved.time || 0 };
  } catch {
    return { score: 0, time: 0 };
  }
}

function saveBest(best) {
  try {
    window.localStorage.setItem('emberfall-best', JSON.stringify(best));
  } catch {
    // Storage unavailable: the best score simply does not persist.
  }
}

let best = loadBest();

// Screenshot mode: one staged scene, rendered once, then signal readiness.
const shotName = params.get('shot');
if (shotName) {
  const seed = Number(params.get('seed') || '7');
  const world = new World(makeRng(seed), audio);
  const staged = stageShot(shotName, world);
  renderer.draw(ctx, world, staged.screen, { best: { score: staged.best, time: 0 }, choices: [], mouse: { x: 0, y: 0 } });
  window.__shotReady = true;
  window.__ember = { world, screen: staged.screen };
} else {
  let world = new World(makeRng((Math.random() * 2 ** 31) | 0), audio);
  let screen = 'title';
  let choices = [];
  window.__ember = { world, screen };

  function startGame() {
    audio.ensure();
    world = new World(makeRng((Math.random() * 2 ** 31) | 0), audio);
    screen = 'play';
    acc = 0;
  }

  function recordBest() {
    if (world.score > best.score) {
      best = { score: world.score, time: Math.floor(world.time) };
      saveBest(best);
    }
  }

  function consumeEvents() {
    const events = world.events.splice(0);
    for (const event of events) {
      if (event.type === 'levelup' && screen === 'play') {
        choices = world.levelUpChoices();
        screen = 'levelup';
      } else if (event.type === 'gameover') {
        recordBest();
        screen = 'over';
      } else if (event.type === 'victory') {
        recordBest();
        screen = 'win';
      }
    }
  }

  // Level-up card geometry, mirroring render.js so clicks land on the cards.
  function cardAt(click) {
    const cardW = 300;
    const cardH = 220;
    const gap = 28;
    const total = cardW * 3 + gap * 2;
    const x0 = (1280 - total) / 2;
    const y0 = 230;
    for (let i = 0; i < 3; i += 1) {
      const x = x0 + i * (cardW + gap);
      if (click.x >= x && click.x <= x + cardW && click.y >= y0 && click.y <= y0 + cardH) return i;
    }
    return -1;
  }

  function applyChoice(index) {
    if (index < 0 || index >= choices.length) return;
    world.applyUpgrade(choices[index]);
    world.pendingLevelUps -= 1;
    audio.click();
    if (world.pendingLevelUps > 0) {
      choices = world.levelUpChoices();
    } else {
      screen = 'play';
    }
  }

  let acc = 0;
  let last = performance.now();

  function frame(now) {
    window.requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;

    if (input.wasPressed('KeyM')) audio.setMuted(!audio.muted);

    if (screen === 'title') {
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        world.update(STEP, autopilotInput(world, true));
        acc -= STEP;
        steps += 1;
      }
      if (steps === 5) acc = 0;
      if (input.wasPressed('Enter', 'Space') || input.consumeClick()) startGame();
    } else if (screen === 'play') {
      if (input.wasPressed('KeyP', 'Escape')) {
        screen = 'pause';
      } else {
        acc += dt;
        let steps = 0;
        while (acc >= STEP && steps < 5) {
          world.update(STEP, input);
          acc -= STEP;
          steps += 1;
        }
        if (steps === 5) acc = 0;
        consumeEvents();
      }
    } else if (screen === 'levelup') {
      const click = input.consumeClick();
      let picked = -1;
      if (click) picked = cardAt(click);
      if (input.wasPressed('Digit1', 'Numpad1')) picked = 0;
      if (input.wasPressed('Digit2', 'Numpad2')) picked = 1;
      if (input.wasPressed('Digit3', 'Numpad3')) picked = 2;
      if (picked >= 0) applyChoice(picked);
    } else if (screen === 'pause') {
      if (input.wasPressed('KeyP', 'Escape', 'Enter')) screen = 'play';
      if (input.wasPressed('KeyR')) startGame();
    } else if (screen === 'over' || screen === 'win') {
      if (input.wasPressed('KeyR', 'Enter', 'Space') || input.consumeClick()) startGame();
    }

    // Clear edge-triggered input before drawing: if the draw ever throws,
    // a pressed key must not stick and re-fire on every following frame.
    input.endFrame();
    renderer.draw(ctx, world, screen, { best, choices, mouse: input.mouse });
    window.__ember.world = world;
    window.__ember.screen = screen;
  }

  window.requestAnimationFrame(frame);
}
