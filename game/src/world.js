// Golden Ladle Kitchen — the world: orders, prep stations, tray, plate,
// scoring and the shift timer. Pure logic; rendering lives in render.js and
// input lives in input.js, so the screenshot stager can drive this directly.

import {
  BURN_AFTER,
  COUNTER_ORDER,
  INGREDIENTS,
  MAX_HEARTS,
  MAX_ORDERS,
  ORDER_PATIENCE,
  PLATE_MAX,
  PREP,
  RECIPES,
  SERVE_BASE,
  SERVE_TIP_MAX,
  SHIFT_SECONDS,
  TRAY_MAX,
} from './config.js';

let orderId = 0;

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

export function createWorld(random) {
  const world = {
    random,
    screen: SCREEN_TITLE,
    time: 0, // seconds since the shift started
    timeLeft: SHIFT_SECONDS,
    score: 0,
    coins: 0,
    combo: 0,
    bestCombo: 0,
    served: 0,
    expired: 0,
    mistakes: 0,
    hearts: MAX_HEARTS,
    orders: [],
    selectedOrder: 0,
    chop: null, // { ing, progress, needed }
    pans: [null, null], // { ing, cooked, readyFor, burnt } per pan
    tray: [], // ingredient ids, ready to plate
    plate: [], // ingredient ids on the active plate
    toast: null, // { text, until }
    shakeUntil: 0,
    flash: null, // { color, until }
    popups: [], // { x, y, text, color, until }
    spawnIn: 0,
    lastTickSecond: -1,
    overReason: null,
    bestDish: null, // recipe of the highest-scoring serve, shown on the results screen
    bestServe: 0,
  };
  return world;
}

export function countOf(list, ing) {
  return list.filter((item) => item === ing).length;
}

function needsMet(needs, plate) {
  if (plate.length !== needs.length) return false;
  return needs.every((ing) => countOf(plate, ing) === countOf(needs, ing));
}

/** The order (if any) whose recipe exactly matches what is on the plate. */
export function matchingOrder(world) {
  if (world.plate.length === 0) return null;
  return world.orders.find((order) => needsMet(order.recipe.needs, world.plate)) ?? null;
}

/** How many of the selected ticket's ingredients are already on the plate. */
export function orderProgress(world, order) {
  const remaining = [...world.plate];
  let done = 0;
  for (const ing of order.recipe.needs) {
    const at = remaining.indexOf(ing);
    if (at !== -1) {
      remaining.splice(at, 1);
      done += 1;
    }
  }
  return { done, total: order.recipe.needs.length };
}

function newOrder(world) {
  // Prefer a dish that is not already on the board, so tickets stay varied.
  const onBoard = new Set(world.orders.map((o) => o.recipe.name));
  const fresh = RECIPES.filter((r) => !onBoard.has(r.name));
  const recipe = world.random.pick(fresh.length > 0 ? fresh : RECIPES);
  orderId += 1;
  return {
    id: orderId,
    recipe,
    patience: ORDER_PATIENCE,
    maxPatience: ORDER_PATIENCE,
    bornAt: world.time,
  };
}

export function startShift(world) {
  world.screen = SCREEN_PLAY;
  world.time = 0;
  world.timeLeft = SHIFT_SECONDS;
  world.score = 0;
  world.coins = 0;
  world.combo = 0;
  world.bestCombo = 0;
  world.served = 0;
  world.expired = 0;
  world.mistakes = 0;
  world.hearts = MAX_HEARTS;
  world.orders = [];
  world.chop = null;
  world.pans = [null, null];
  world.tray = [];
  world.plate = [];
  world.popups = [];
  world.spawnIn = 0;
  world.overReason = null;
  world.bestDish = null;
  world.bestServe = 0;
  for (let i = 0; i < MAX_ORDERS; i += 1) world.orders.push(newOrder(world));
  setToast(world, 'Shift started — first tickets are in!');
}

export function setToast(world, text, seconds = 2.2) {
  world.toast = { text, until: world.time + seconds };
}

function addPopup(world, x, y, text, color) {
  world.popups.push({ x, y, text, color, until: world.time + 1.4 });
}

function endShift(world, reason) {
  if (world.screen !== SCREEN_PLAY) return;
  world.screen = SCREEN_OVER;
  world.overReason = reason;
  world.pans = [null, null];
  world.chop = null;
}

/** Take an ingredient from the counter. Instant ones land on the tray at once. */
export function takeIngredient(world, ing, audio) {
  if (world.screen !== SCREEN_PLAY) return false;
  const def = INGREDIENTS[ing];
  if (!def) return false;
  if (def.prep === PREP.INSTANT) {
    if (world.tray.length >= TRAY_MAX) {
      setToast(world, 'Ready tray is full — plate something first!');
      audio?.error();
      return false;
    }
    world.tray.push(ing);
    audio?.pop();
    return true;
  }
  if (def.prep === PREP.CHOP) {
    if (world.chop) {
      setToast(world, 'Chopping board is busy — finish that first!');
      audio?.error();
      return false;
    }
    world.chop = { ing, progress: 0, needed: def.chops };
    audio?.pop();
    return true;
  }
  // Cook: find a free pan.
  const free = world.pans.findIndex((pan) => pan === null);
  if (free === -1) {
    setToast(world, 'Both pans are busy!');
    audio?.error();
    return false;
  }
  world.pans[free] = { ing, cooked: 0, cookTime: def.cookTime, readyFor: BURN_AFTER, burnt: false };
  audio?.sizzleStart();
  return true;
}

/** One chop on the board; a finished item moves to the ready tray. */
export function chopOnce(world, audio) {
  if (world.screen !== SCREEN_PLAY || !world.chop) return false;
  world.chop.progress += 1;
  audio?.chop();
  if (world.chop.progress >= world.chop.needed) {
    if (world.tray.length >= TRAY_MAX) {
      setToast(world, 'Ready tray is full — plate something first!');
      world.chop.progress = world.chop.needed - 1;
      return false;
    }
    world.tray.push(world.chop.ing);
    world.chop = null;
    audio?.ding();
  }
  return true;
}

/** Lift a cooked item off its pan onto the ready tray (or bin a burnt one). */
export function takeFromPan(world, index, audio) {
  if (world.screen !== SCREEN_PLAY) return false;
  const pan = world.pans[index];
  if (!pan) return false;
  if (pan.burnt) {
    world.pans[index] = null;
    setToast(world, 'Burnt! Tossed in the bin.');
    audio?.error();
    return true;
  }
  if (pan.cooked < pan.cookTime) {
    setToast(world, 'Still cooking — wait for the ding!');
    return false;
  }
  if (world.tray.length >= TRAY_MAX) {
    setToast(world, 'Ready tray is full — plate something first!');
    audio?.error();
    return false;
  }
  world.tray.push(pan.ing);
  world.pans[index] = null;
  audio?.ding();
  if (!world.pans.some((p) => p !== null)) audio?.stopSizzle();
  return true;
}

/** Move a ready item from the tray onto the plate. */
export function plateFromTray(world, trayIndex, audio) {
  if (world.screen !== SCREEN_PLAY) return false;
  if (trayIndex < 0 || trayIndex >= world.tray.length) return false;
  if (world.plate.length >= PLATE_MAX) {
    setToast(world, 'Plate is full — serve it or clear it!');
    audio?.error();
    return false;
  }
  world.plate.push(world.tray[trayIndex]);
  world.tray.splice(trayIndex, 1);
  audio?.pop();
  return true;
}

/** Take an ingredient back off the plate (into the bin). */
export function removeFromPlate(world, plateIndex, audio) {
  if (world.screen !== SCREEN_PLAY) return false;
  if (plateIndex < 0 || plateIndex >= world.plate.length) return false;
  world.plate.splice(plateIndex, 1);
  audio?.pop();
  return true;
}

/** Clear the whole plate into the bin. */
export function clearPlate(world, audio) {
  if (world.screen !== SCREEN_PLAY || world.plate.length === 0) return false;
  world.plate = [];
  audio?.error();
  setToast(world, 'Plate cleared.');
  return true;
}

/** Serve the plate. Pays when it matches a ticket; a wrong plate buzzes. */
export function servePlate(world, audio) {
  if (world.screen !== SCREEN_PLAY) return false;
  const order = matchingOrder(world);
  if (!order) {
    if (world.plate.length === 0) {
      setToast(world, 'Plate is empty — build a dish first!');
    } else {
      setToast(world, 'That plate matches no ticket — check the order board!');
      world.mistakes += 1;
      world.combo = 0;
      world.shakeUntil = world.time + 0.35;
      audio?.error();
    }
    return false;
  }
  const patienceFrac = Math.max(0, order.patience / order.maxPatience);
  const tip = Math.round(patienceFrac * SERVE_TIP_MAX);
  const comboBonus = world.combo * 10;
  const gained = SERVE_BASE + tip + comboBonus;
  world.score += gained;
  world.coins += gained;
  world.combo += 1;
  world.bestCombo = Math.max(world.bestCombo, world.combo);
  world.served += 1;
  if (gained > world.bestServe) {
    world.bestServe = gained;
    world.bestDish = order.recipe;
  }
  addPopup(world, 968, 240, `+${gained}`, '#2f7d3d');
  world.flash = { color: 'rgba(88, 179, 104, 0.25)', until: world.time + 0.4 };
  world.orders = world.orders.filter((o) => o.id !== order.id);
  world.plate = [];
  world.spawnIn = 1.2;
  if (world.selectedOrder >= world.orders.length) world.selectedOrder = 0;
  audio?.serve();
  return true;
}

export function updateWorld(world, dt, audio) {
  if (world.screen !== SCREEN_PLAY) return;
  world.time += dt;
  world.timeLeft = Math.max(0, SHIFT_SECONDS - world.time);

  // Patience drains; a ticket that runs out walks out and costs a heart.
  for (const order of [...world.orders]) {
    order.patience -= dt;
    if (order.patience <= 0) {
      world.orders = world.orders.filter((o) => o.id !== order.id);
      world.expired += 1;
      world.hearts -= 1;
      world.combo = 0;
      world.spawnIn = Math.min(world.spawnIn || 0.8, 0.8);
      setToast(world, `${order.recipe.name} walked out! A heart is lost.`);
      audio?.walkout();
      if (world.selectedOrder >= world.orders.length) world.selectedOrder = 0;
    }
  }

  // Keep the board topped up.
  if (world.orders.length < MAX_ORDERS) {
    world.spawnIn -= dt;
    if (world.spawnIn <= 0) {
      world.orders.push(newOrder(world));
      world.spawnIn = world.random.int(4, 7);
    }
  }

  // Pans cook, then wait, then burn.
  world.pans.forEach((pan, index) => {
    if (!pan || pan.burnt) return;
    if (pan.cooked < pan.cookTime) {
      pan.cooked += dt;
      if (pan.cooked >= pan.cookTime) {
        audio?.ding();
        addPopup(world, 384 + 24 + index * 188 + 84, 300, 'Ready!', '#2f7d3d');
      }
    } else {
      pan.readyFor -= dt;
      if (pan.readyFor <= 0) {
        pan.burnt = true;
        setToast(world, `${INGREDIENTS[pan.ing].name} burnt in the pan! Click it to bin it.`);
        audio?.error();
      }
    }
  });
  if (!world.pans.some((p) => p !== null)) audio?.stopSizzle();

  // Low-patience warning tick.
  const whole = Math.floor(world.timeLeft);
  if (whole !== world.lastTickSecond) {
    world.lastTickSecond = whole;
    if (world.timeLeft <= 10.5 && world.timeLeft > 0) audio?.tick();
  }

  // Popups fade.
  world.popups = world.popups.filter((p) => p.until > world.time);

  if (world.hearts <= 0) {
    endShift(world, 'The lunch rush wore you out — no hearts left!');
    audio?.fanfare();
    return;
  }
  if (world.timeLeft <= 0) {
    endShift(world, 'Shift over! The kitchen closes its doors.');
    audio?.fanfare();
  }
}

/** Keyboard shortcut for a counter bin (keys 1-8 map to COUNTER_ORDER). */
export function ingredientForKey(key) {
  const index = Number.parseInt(key, 10) - 1;
  if (index >= 0 && index < COUNTER_ORDER.length) return COUNTER_ORDER[index];
  return null;
}
