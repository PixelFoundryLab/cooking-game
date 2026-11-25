// Golden Ladle Kitchen — boot and the one loop. Input is read every frame,
// the world advances in fixed 1/60 s steps, and the renderer paints what is
// there. The game moves between four screens: title, play, paused, game over.
//
// ?seed=N fixes the order pattern. ?shot=start|play|assembly|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import { BEST_KEY, VIEW } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { SCREEN_OVER, SCREEN_PLAY, createWorld, updateWorld } from './world.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const STEP = 1 / 60;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function announce(world) {
  const best = readBest();
  if (world.screen === SCREEN_OVER) {
    status.textContent = `Shift over. Score ${world.score}, ${world.served} dishes served. Best score ${best}.`;
  } else if (world.screen === SCREEN_PLAY) {
    status.textContent = `Playing. Score ${world.score}, ${world.timeLeft} seconds left.`;
  } else {
    status.textContent = 'Golden Ladle Kitchen. Press Enter to start your shift.';
  }
}

if (shot) {
  // Screenshot mode: stage the scene, paint it twice, signal readiness.
  const world = stageShot(shot, seed);
  createInput(canvas, world, audio, renderer);
  renderer.render(world, audio);
  renderer.render(world, audio);
  window.__shotReady = true;
  window.__game = world;
  announce(world);
} else {
  const world = createWorld(createRandom(seed));
  createInput(canvas, world, audio, renderer);
  window.__game = world; // read-only handle for play-testing, not used by the game itself
  let last = performance.now();
  let accumulator = 0;
  let lastScreen = world.screen;
  let lastScore = 0;

  function frame(now) {
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    accumulator += elapsed;
    while (accumulator >= STEP) {
      updateWorld(world, STEP, audio);
      accumulator -= STEP;
    }
    if (world.screen === SCREEN_OVER && lastScreen !== SCREEN_OVER && world.score > readBest()) {
      saveBest(world.score);
    }
    if (world.screen !== lastScreen || world.score !== lastScore) {
      announce(world);
      lastScreen = world.screen;
      lastScore = world.score;
    }
    renderer.render(world, audio);
    requestAnimationFrame(frame);
  }

  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  announce(world);
  requestAnimationFrame(frame);
}
