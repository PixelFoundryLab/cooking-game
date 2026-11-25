// Golden Ladle Kitchen — shared constants: layout, ingredients, recipes.
// The game is a 2D canvas kitchen drawn at a fixed logical size of 1280x800;
// the page scales the canvas to the window, so screenshots are always 1280x800.

export const VIEW = { width: 1280, height: 800 };

export const SHIFT_SECONDS = 180;
export const MAX_ORDERS = 3;
export const MAX_HEARTS = 3;
export const TRAY_MAX = 6;
export const PLATE_MAX = 6;
export const BEST_KEY = 'golden-ladle-best';

/** How an ingredient is prepared before it can be plated. */
export const PREP = { INSTANT: 'instant', CHOP: 'chop', COOK: 'cook' };

export const INGREDIENTS = {
  tomato: { name: 'Tomato', emoji: '🍅', prep: PREP.CHOP, chops: 3, color: '#e5484d', dark: '#a92c31' },
  lettuce: { name: 'Lettuce', emoji: '🥬', prep: PREP.CHOP, chops: 3, color: '#58b368', dark: '#2f7d3d' },
  onion: { name: 'Onion', emoji: '🧅', prep: PREP.CHOP, chops: 3, color: '#c9a7eb', dark: '#8a63b8' },
  cheese: { name: 'Cheese', emoji: '🧀', prep: PREP.INSTANT, color: '#f5b81e', dark: '#b97f0a' },
  bun: { name: 'Bun', emoji: '🍞', prep: PREP.INSTANT, color: '#e0a458', dark: '#9c6b2f' },
  patty: { name: 'Patty', emoji: '🥩', prep: PREP.COOK, cookTime: 5, color: '#c96f4a', dark: '#8a3d22' },
  egg: { name: 'Egg', emoji: '🍳', prep: PREP.COOK, cookTime: 4, color: '#f7d774', dark: '#c79a2e' },
  pasta: { name: 'Pasta', emoji: '🍝', prep: PREP.COOK, cookTime: 6, color: '#f2c14e', dark: '#b98a1d' },
};

/** Counter order (also the 1-8 keyboard shortcuts). */
export const COUNTER_ORDER = ['tomato', 'lettuce', 'onion', 'cheese', 'bun', 'patty', 'egg', 'pasta'];

export const RECIPES = [
  { name: 'Sunny Pasta', emoji: '🍝', needs: ['pasta', 'tomato', 'cheese'] },
  { name: 'Garden Burger', emoji: '🍔', needs: ['bun', 'patty', 'lettuce', 'tomato'] },
  { name: 'Cheesy Omelette', emoji: '🍳', needs: ['egg', 'cheese', 'onion'] },
  { name: 'Crunchy Salad', emoji: '🥗', needs: ['lettuce', 'tomato', 'onion'] },
  { name: 'Golden Stack', emoji: '🥪', needs: ['bun', 'patty', 'cheese', 'egg'] },
];

export const ORDER_PATIENCE = 50; // seconds before a ticket walks out
export const BURN_AFTER = 5; // seconds a cooked item waits before it burns
export const SERVE_BASE = 100;
export const SERVE_TIP_MAX = 50;

/** Fixed rectangles (logical pixels) shared by the renderer and the input handler. */
export const LAYOUT = {
  topBar: { x: 0, y: 0, w: 1280, h: 56 },
  orders: { x: 40, y: 64, w: 300, h: 116, gap: 16 },
  chefTip: { x: 988, y: 64, w: 252, h: 116 },
  chopBoard: { x: 40, y: 200, w: 320, h: 236 },
  stove: { x: 384, y: 200, w: 392, h: 236 },
  plateStation: { x: 800, y: 200, w: 440, h: 236 },
  serveButton: { x: 1108, y: 268, w: 108, h: 96 },
  tray: { x: 40, y: 452, w: 1200, h: 64 },
  counter: { x: 40, y: 556, w: 136, h: 176, gap: 12 },
  startButton: { x: 490, y: 560, w: 300, h: 72 },
  againButton: { x: 490, y: 560, w: 300, h: 72 },
};

export function ticketRect(index) {
  const o = LAYOUT.orders;
  return { x: o.x + index * (o.w + o.gap), y: o.y, w: o.w, h: o.h };
}

export function binRect(index) {
  const c = LAYOUT.counter;
  return { x: c.x + index * (c.w + c.gap), y: c.y, w: c.w, h: c.h };
}

export function panRect(index) {
  const s = LAYOUT.stove;
  const w = 168;
  return { x: s.x + 24 + index * (w + 20), y: s.y + 96, w, h: 108 };
}

export function traySlotRect(index) {
  const t = LAYOUT.tray;
  const w = 64;
  return { x: t.x + 170 + index * (w + 14), y: t.y + 8, w, h: 48 };
}

export function plateItemRect(index, count) {
  // Ingredients sit in a ring on the plate; index/count place each one.
  const cx = 968;
  const cy = 316;
  const radius = count <= 1 ? 0 : 52;
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(count, 1);
  return { x: cx + Math.cos(angle) * radius - 26, y: cy + Math.sin(angle) * radius - 26, w: 52, h: 52 };
}

export function pointIn(rect, x, y) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}
