// Golden Ladle Kitchen — mouse and keyboard input. Clicks are hit-tested
// against the same layout rectangles the renderer draws, and keys mirror the
// clicks so the game plays fully either way.

import {
  LAYOUT,
  binRect,
  panRect,
  plateItemRect,
  pointIn,
  ticketRect,
  traySlotRect,
} from './config.js';
import {
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  chopOnce,
  clearPlate,
  ingredientForKey,
  plateFromTray,
  removeFromPlate,
  servePlate,
  startShift,
  takeFromPan,
  takeIngredient,
} from './world.js';

export function createInput(canvas, world, audio, renderer) {
  function toLogical(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function clickAt(x, y) {
    audio.unlock();
    if (world.screen === SCREEN_TITLE) {
      if (pointIn(LAYOUT.startButton, x, y)) {
        startShift(world);
        audio.serve();
      }
      return;
    }
    if (world.screen === SCREEN_OVER) {
      if (pointIn(LAYOUT.againButton, x, y)) startShift(world);
      return;
    }
    if (world.screen === SCREEN_PAUSED) {
      startShiftResume();
      return;
    }

    // Top bar: pause and mute live in the top-right corner.
    if (pointIn(renderer.pauseButtonRect(), x, y)) {
      world.screen = SCREEN_PAUSED;
      audio.stopSizzle();
      return;
    }
    if (pointIn(renderer.muteButtonRect(), x, y)) {
      audio.toggleMute();
      return;
    }

    // Order tickets: click to select one to cook for.
    for (let i = 0; i < world.orders.length; i += 1) {
      if (pointIn(ticketRect(i), x, y)) {
        world.selectedOrder = i;
        audio.pop();
        return;
      }
    }

    // Chopping board.
    if (pointIn(LAYOUT.chopBoard, x, y)) {
      chopOnce(world, audio);
      return;
    }

    // Stove pans.
    for (let i = 0; i < 2; i += 1) {
      if (pointIn(panRect(i), x, y)) {
        takeFromPan(world, i, audio);
        return;
      }
    }

    // Serve button and trash (clear plate).
    if (pointIn(LAYOUT.serveButton, x, y)) {
      servePlate(world, audio);
      return;
    }
    if (pointIn(renderer.trashRect(), x, y)) {
      clearPlate(world, audio);
      return;
    }

    // Ready tray: click a ready item to plate it.
    for (let i = 0; i < world.tray.length; i += 1) {
      if (pointIn(traySlotRect(i), x, y)) {
        plateFromTray(world, i, audio);
        return;
      }
    }

    // Plate: click an item on it to take it back off.
    for (let i = 0; i < world.plate.length; i += 1) {
      if (pointIn(plateItemRect(i, world.plate.length), x, y)) {
        removeFromPlate(world, i, audio);
        return;
      }
    }

    // Counter bins.
    for (let i = 0; i < 8; i += 1) {
      if (pointIn(binRect(i), x, y)) {
        const ing = ingredientForKey(String(i + 1));
        if (ing) takeIngredient(world, ing, audio);
        return;
      }
    }
  }

  function startShiftResume() {
    world.screen = SCREEN_PLAY;
  }

  function onKey(event) {
    const key = event.key;
    if (key === 'm' || key === 'M') {
      audio.toggleMute();
      return;
    }
    if (world.screen === SCREEN_TITLE) {
      if (key === 'Enter' || key === ' ') {
        event.preventDefault();
        audio.unlock();
        startShift(world);
      }
      return;
    }
    if (world.screen === SCREEN_OVER) {
      if (key === 'Enter' || key === 'r' || key === 'R') startShift(world);
      return;
    }
    if (key === 'p' || key === 'P' || key === 'Escape') {
      if (world.screen === SCREEN_PLAY) {
        world.screen = SCREEN_PAUSED;
        audio.stopSizzle();
      } else if (world.screen === SCREEN_PAUSED) {
        world.screen = SCREEN_PLAY;
      }
      return;
    }
    if (world.screen !== SCREEN_PLAY) return;
    const ing = ingredientForKey(key);
    if (ing) {
      takeIngredient(world, ing, audio);
      return;
    }
    if (key === 'c' || key === 'C' || key === ' ') {
      event.preventDefault();
      if (key === ' ') servePlate(world, audio);
      else chopOnce(world, audio);
      return;
    }
    if (key === 'Tab') {
      event.preventDefault();
      if (world.orders.length > 0) {
        world.selectedOrder = (world.selectedOrder + 1) % world.orders.length;
        audio.pop();
      }
      return;
    }
    if (key === 'Backspace' || key === 'Delete') {
      clearPlate(world, audio);
    }
  }

  canvas.addEventListener('pointerdown', (event) => {
    const at = toLogical(event);
    clickAt(at.x, at.y);
  });
  window.addEventListener('keydown', onKey);

  return { clickAt, onKey };
}
