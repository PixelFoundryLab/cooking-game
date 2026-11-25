// Golden Ladle Kitchen — staged screenshot scenes behind ?shot=.
// Each scene builds a real world through the game's own functions (orders,
// prep, tray, plate) and then advances it a few fixed steps, so the frame is
// exactly what a short stretch of real play looks like — and the same seed
// always gives the same frame. The page paints the staged frame twice and
// sets window.__shotReady so a screenshot tool knows it is done.

import { ORDER_PATIENCE, SHIFT_SECONDS } from './config.js';
import { createRandom } from './random.js';
import {
  SCREEN_OVER,
  chopOnce,
  createWorld,
  plateFromTray,
  servePlate,
  startShift,
  takeFromPan,
  takeIngredient,
  updateWorld,
} from './world.js';

const STEP = 1 / 60;
const SILENT = { pop() {}, chop() {}, ding() {}, serve() {}, error() {}, walkout() {}, tick() {}, fanfare() {}, sizzleStart() {}, stopSizzle() {} };

function settle(world, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) updateWorld(world, STEP, SILENT);
}

/** Base world: a shift already running, with three tickets on the board. */
function baseWorld(seed) {
  const world = createWorld(createRandom(seed));
  startShift(world);
  return world;
}

function stageStart(seed) {
  // Title screen over a live kitchen: tickets waiting, pans empty.
  const world = baseWorld(seed);
  world.screen = 'title';
  return world;
}

function stagePlay(seed) {
  // The cover: a busy mid-shift moment. Sunny Pasta is half built on the
  // plate (pasta + tomato, cheese waiting on the tray), a patty is sizzling,
  // an onion is mid-chop, the timer is running and the score is ticking up.
  const world = baseWorld(seed);
  world.orders[0].recipe = { name: 'Sunny Pasta', emoji: '🍝', needs: ['pasta', 'tomato', 'cheese'] };
  world.orders[1].recipe = { name: 'Garden Burger', emoji: '🍔', needs: ['bun', 'patty', 'lettuce', 'tomato'] };
  world.orders[2].recipe = { name: 'Cheesy Omelette', emoji: '🍳', needs: ['egg', 'cheese', 'onion'] };
  world.orders[0].patience = ORDER_PATIENCE * 0.72;
  world.orders[1].patience = ORDER_PATIENCE * 0.55;
  world.orders[2].patience = ORDER_PATIENCE * 0.86;
  world.time = 42;
  world.timeLeft = SHIFT_SECONDS - 42;
  world.score = 240;
  world.coins = 240;
  world.served = 2;
  world.combo = 2;
  world.bestCombo = 2;
  // Pasta cooked and plated, tomato chopped and plated, cheese ready on tray.
  takeIngredient(world, 'pasta', SILENT);
  world.pans[0].cooked = 6;
  world.pans[0].readyFor = 4;
  takeFromPan(world, 0, SILENT);
  plateFromTray(world, 0, SILENT);
  takeIngredient(world, 'tomato', SILENT);
  chopOnce(world, SILENT);
  chopOnce(world, SILENT);
  chopOnce(world, SILENT);
  plateFromTray(world, 0, SILENT);
  takeIngredient(world, 'cheese', SILENT);
  // A patty sizzling in pan two, an onion mid-chop on the board.
  takeIngredient(world, 'patty', SILENT);
  world.pans[0].cooked = 3.2;
  takeIngredient(world, 'onion', SILENT);
  chopOnce(world, SILENT);
  chopOnce(world, SILENT);
  settle(world, 0.5);
  return world;
}

function stageAssembly(seed) {
  // One dish mid-assembly: the Garden Burger is 3 of 4 on the plate, the
  // last tomato is being chopped, a cooked egg waits on the tray.
  const world = baseWorld(seed);
  world.orders[0].recipe = { name: 'Garden Burger', emoji: '🍔', needs: ['bun', 'patty', 'lettuce', 'tomato'] };
  world.orders[1].recipe = { name: 'Sunny Pasta', emoji: '🍝', needs: ['pasta', 'tomato', 'cheese'] };
  world.orders[2].recipe = { name: 'Golden Stack', emoji: '🥪', needs: ['bun', 'patty', 'cheese', 'egg'] };
  world.orders[0].patience = ORDER_PATIENCE * 0.4;
  world.orders[1].patience = ORDER_PATIENCE * 0.62;
  world.orders[2].patience = ORDER_PATIENCE * 0.78;
  world.time = 88;
  world.timeLeft = SHIFT_SECONDS - 88;
  world.score = 530;
  world.coins = 530;
  world.served = 4;
  world.combo = 3;
  world.bestCombo = 3;
  takeIngredient(world, 'bun', SILENT);
  plateFromTray(world, 0, SILENT);
  takeIngredient(world, 'patty', SILENT);
  world.pans[0].cooked = 5;
  takeFromPan(world, 0, SILENT);
  plateFromTray(world, 0, SILENT);
  takeIngredient(world, 'lettuce', SILENT);
  chopOnce(world, SILENT);
  chopOnce(world, SILENT);
  chopOnce(world, SILENT);
  plateFromTray(world, 0, SILENT);
  // Tomato mid-chop (2 of 3), egg cooked and waiting on the tray.
  takeIngredient(world, 'tomato', SILENT);
  chopOnce(world, SILENT);
  chopOnce(world, SILENT);
  takeIngredient(world, 'egg', SILENT);
  world.pans[0].cooked = 4;
  takeFromPan(world, 0, SILENT);
  settle(world, 0.5);
  return world;
}

function stageEnd(seed) {
  // The results screen after a full shift: score, dishes served, best plate
  // — the finished dish the shift ended on, ready to serve again.
  const world = baseWorld(seed);
  world.time = SHIFT_SECONDS;
  world.timeLeft = 0;
  world.score = 1240;
  world.coins = 1240;
  world.served = 9;
  world.combo = 0;
  world.bestCombo = 5;
  world.expired = 1;
  world.hearts = 2;
  world.mistakes = 2;
  world.bestDish = { name: 'Golden Stack', emoji: '🥪', needs: ['bun', 'patty', 'cheese', 'egg'] };
  world.bestServe = 168;
  world.plate = ['bun', 'patty', 'cheese', 'egg'];
  world.orders = [];
  world.screen = SCREEN_OVER;
  world.overReason = 'Shift over! The kitchen closes its doors.';
  return world;
}

export function stageShot(shot, seed) {
  if (shot === 'start') return stageStart(seed);
  if (shot === 'assembly') return stageAssembly(seed);
  if (shot === 'end') return stageEnd(seed);
  return stagePlay(seed); // 'play' and anything else: the busy kitchen
}
