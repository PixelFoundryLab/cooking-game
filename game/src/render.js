// Golden Ladle Kitchen — everything the player sees, painted on one canvas:
// a warm tiled kitchen, the order board, the chopping board, the stove, the
// plating station, the ready tray and the ingredient counter. All art is
// drawn in code (shapes, gradients, emoji glyphs); there are no image files.

import {
  COUNTER_ORDER,
  INGREDIENTS,
  LAYOUT,
  MAX_HEARTS,
  PREP,
  SHIFT_SECONDS,
  TRAY_MAX,
  VIEW,
  binRect,
  panRect,
  plateItemRect,
  ticketRect,
  traySlotRect,
} from './config.js';
import {
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  matchingOrder,
  orderProgress,
} from './world.js';

const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, size, color, align = 'center', weight = 'bold') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function emoji(ctx, str, x, y, size) {
  ctx.font = `${size}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function pauseButtonRect() {
    return { x: 1160, y: 10, w: 52, h: 36 };
  }
  function muteButtonRect() {
    return { x: 1218, y: 10, w: 52, h: 36 };
  }
  function trashRect() {
    return { x: 1160, y: 372, w: 56, h: 56 };
  }

  function drawKitchenBackdrop() {
    // Warm wall with a tile backsplash and a wooden floor.
    const wall = ctx.createLinearGradient(0, 0, 0, 520);
    wall.addColorStop(0, '#fbeed3');
    wall.addColorStop(1, '#f3ddb2');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, VIEW.width, 520);
    ctx.fillStyle = '#e8b04b';
    ctx.fillRect(0, 516, VIEW.width, 10);
    ctx.fillStyle = '#a9713f';
    ctx.fillRect(0, 526, VIEW.width, VIEW.height - 526);
    // Floor boards.
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 2;
    for (let x = 0; x < VIEW.width; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 526);
      ctx.lineTo(x - 40, VIEW.height);
      ctx.stroke();
    }
    // Backsplash tiles.
    ctx.strokeStyle = 'rgba(190, 130, 60, 0.35)';
    ctx.lineWidth = 2;
    for (let x = 0; x < VIEW.width; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 188);
      ctx.lineTo(x, 440);
      ctx.stroke();
    }
    for (let y = 188; y <= 440; y += 42) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(VIEW.width, y);
      ctx.stroke();
    }
    // (The order board and stations are drawn over this backdrop.)
  }

  function drawTopBar(world, audio) {
    ctx.fillStyle = '#4a2c14';
    ctx.fillRect(0, 0, VIEW.width, 56);
    ctx.fillStyle = '#f5b81e';
    ctx.beginPath();
    ctx.arc(34, 28, 20, 0, Math.PI * 2);
    ctx.fill();
    emoji(ctx, '🥄', 34, 29, 24);
    text(ctx, 'GOLDEN LADLE KITCHEN', 62, 29, 24, '#ffe9b0', 'left');
    // Shift timer: big, and red when the rush is nearly over.
    const low = world.timeLeft <= 30 && world.screen === SCREEN_PLAY;
    const timerColor = low ? '#ff6b5e' : '#ffffff';
    text(ctx, `⏱ ${formatTime(world.timeLeft)}`, 640, 24, 30, timerColor);
    const frac = world.timeLeft / SHIFT_SECONDS;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    roundRect(ctx, 520, 44, 240, 7, 3);
    ctx.fill();
    ctx.fillStyle = low ? '#ff6b5e' : '#58b368';
    roundRect(ctx, 520, 44, 240 * frac, 7, 3);
    ctx.fill();
    text(ctx, `⭐ ${world.score}`, 850, 29, 22, '#ffe9b0');
    text(ctx, `🪙 ${world.coins}`, 950, 29, 22, '#ffe9b0');
    let hearts = '';
    for (let i = 0; i < MAX_HEARTS; i += 1) hearts += i < world.hearts ? '❤️' : '🖤';
    text(ctx, hearts, 1050, 29, 18, '#ffffff');
    // Pause / mute buttons.
    ctx.fillStyle = '#6b4226';
    roundRect(ctx, pauseButtonRect().x, 10, 52, 36, 8);
    ctx.fill();
    text(ctx, world.screen === SCREEN_PAUSED ? '▶' : '⏸', 1186, 29, 18, '#ffe9b0');
    ctx.fillStyle = '#6b4226';
    roundRect(ctx, muteButtonRect().x, 10, 52, 36, 8);
    ctx.fill();
    text(ctx, audio.muted ? '🔇' : '🔊', 1244, 29, 18, '#ffe9b0');
  }

  function drawTicket(world, order, index) {
    const r = ticketRect(index);
    const selected = world.selectedOrder === index;
    const { done, total } = orderProgress(world, order);
    const patienceFrac = Math.max(0, order.patience / order.maxPatience);
    const urgent = patienceFrac < 0.35;

    ctx.save();
    if (selected) {
      ctx.shadowColor = 'rgba(245, 184, 30, 0.9)';
      ctx.shadowBlur = 18;
    }
    ctx.fillStyle = selected ? '#fff6d8' : '#fffdf4';
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = selected ? 4 : 2;
    ctx.strokeStyle = selected ? '#f5b81e' : '#d9c08a';
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.stroke();

    text(ctx, `#${order.id}`, r.x + 14, r.y + 16, 13, '#9c6b2f', 'left');
    emoji(ctx, order.recipe.emoji, r.x + 40, r.y + 44, 34);
    text(ctx, order.recipe.name, r.x + 64, r.y + 36, 20, '#4a2c14', 'left');
    text(ctx, `${done}/${total} on plate`, r.x + 64, r.y + 62, 14, '#7a5a34', 'left');

    // Needed ingredients, ticked off as they land on the plate.
    const plateCopy = [...world.plate];
    order.recipe.needs.forEach((ing, i) => {
      const cx = r.x + 34 + i * 52;
      const cy = r.y + 92;
      const at = plateCopy.indexOf(ing);
      const have = at !== -1;
      if (have) plateCopy.splice(at, 1);
      ctx.fillStyle = have ? '#d9f2dd' : '#f3e7cf';
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = have ? '#58b368' : '#cbb37e';
      ctx.stroke();
      ctx.globalAlpha = have ? 0.45 : 1;
      emoji(ctx, INGREDIENTS[ing].emoji, cx, cy + 1, 26);
      ctx.globalAlpha = 1;
      if (have) text(ctx, '✓', cx + 14, cy - 12, 16, '#2f7d3d');
    });

    // Patience bar.
    ctx.fillStyle = '#e8dcc2';
    roundRect(ctx, r.x + 14, r.y + r.h - 16, r.w - 28, 8, 4);
    ctx.fill();
    ctx.fillStyle = urgent ? '#e5484d' : '#58b368';
    roundRect(ctx, r.x + 14, r.y + r.h - 16, (r.w - 28) * patienceFrac, 8, 4);
    ctx.fill();
    if (urgent) text(ctx, 'HURRY!', r.x + r.w - 16, r.y + 16, 13, '#e5484d', 'right');
  }

  function drawChefTip(world) {
    const r = LAYOUT.chefTip;
    ctx.fillStyle = '#fffdf4';
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#d9c08a';
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.stroke();
    emoji(ctx, '👨‍🍳', r.x + 34, r.y + 32, 40);
    text(ctx, 'CHEF SAYS', r.x + 64, r.y + 20, 13, '#9c6b2f', 'left');
    const match = matchingOrder(world);
    const tip =
      world.screen === SCREEN_OVER
        ? 'Shift over — great cooking, chef!'
        : world.combo >= 3
          ? `Combo x${world.combo}! Keep the streak going!`
          : match
            ? 'Plate matches a ticket? Hit SERVE!'
            : world.plate.length > 0
              ? 'Add the missing items to match a ticket!'
              : 'Chop, cook, plate, serve — fast!';
    ctx.fillStyle = '#4a2c14';
    ctx.font = `bold 14px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    wrapText(tip, r.x + 64, r.y + 48, r.w - 76, 18);
    text(ctx, `Served: ${world.served}  •  Best combo: x${world.bestCombo}`, r.x + 16, r.y + r.h - 14, 12, '#7a5a34', 'left');
  }

  function wrapText(str, x, y, maxWidth, lineHeight) {
    const words = str.split(' ');
    let line = '';
    let cy = y;
    for (const word of words) {
      const trial = line ? `${line} ${word}` : word;
      if (ctx.measureText(trial).width > maxWidth && line) {
        ctx.fillText(line, x, cy);
        line = word;
        cy += lineHeight;
      } else {
        line = trial;
      }
    }
    ctx.fillText(line, x, cy);
  }

  function drawChopBoard(world) {
    const r = LAYOUT.chopBoard;
    ctx.fillStyle = '#8a5a2b';
    roundRect(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.fill();
    text(ctx, '🔪  CHOPPING BOARD', r.x + 16, r.y + 22, 15, '#ffe9b0', 'left');
    text(ctx, 'click to chop', r.x + r.w - 16, r.y + 22, 12, '#e8c98f', 'right');
    // The board itself.
    ctx.fillStyle = '#e8c98f';
    roundRect(ctx, r.x + 24, r.y + 44, r.w - 48, 150, 12);
    ctx.fill();
    ctx.strokeStyle = '#c9a05e';
    ctx.lineWidth = 3;
    roundRect(ctx, r.x + 24, r.y + 44, r.w - 48, 150, 12);
    ctx.stroke();
    if (world.chop) {
      const cx = r.x + r.w / 2;
      const cy = r.y + 112;
      emoji(ctx, INGREDIENTS[world.chop.ing].emoji, cx, cy, 64);
      // Chop progress pips.
      for (let i = 0; i < world.chop.needed; i += 1) {
        ctx.fillStyle = i < world.chop.progress ? '#58b368' : '#d9c08a';
        ctx.beginPath();
        ctx.arc(cx - 30 + i * 30, r.y + 172, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      text(ctx, `${world.chop.progress}/${world.chop.needed} chops`, cx, r.y + 200, 14, '#ffe9b0');
      emoji(ctx, '🔪', r.x + r.w - 52, r.y + 84, 40);
    } else {
      text(ctx, 'Chop: tomato • lettuce • onion', r.x + r.w / 2, r.y + 112, 15, '#8a6a42');
      emoji(ctx, '🍅', r.x + r.w / 2 - 44, r.y + 156, 30);
      emoji(ctx, '🥬', r.x + r.w / 2, r.y + 156, 30);
      emoji(ctx, '🧅', r.x + r.w / 2 + 44, r.y + 156, 30);
    }
  }

  function drawStove(world) {
    const r = LAYOUT.stove;
    ctx.fillStyle = '#3d4450';
    roundRect(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.fill();
    text(ctx, '🍳  STOVE', r.x + 16, r.y + 22, 15, '#ffffff', 'left');
    text(ctx, 'click a pan to lift it off', r.x + r.w - 16, r.y + 22, 12, '#aab4c0', 'right');
    // Burner rings.
    ctx.strokeStyle = '#22262e';
    ctx.lineWidth = 6;
    for (let i = 0; i < 2; i += 1) {
      const p = panRect(i);
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2, p.y + p.h / 2 + 6, 62, 0, Math.PI * 2);
      ctx.stroke();
    }
    world.pans.forEach((pan, i) => {
      const p = panRect(i);
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2 + 6;
      // Pan body.
      ctx.fillStyle = '#5a636f';
      ctx.beginPath();
      ctx.arc(cx, cy, 56, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2c313a';
      ctx.beginPath();
      ctx.arc(cx, cy, 46, 0, Math.PI * 2);
      ctx.fill();
      if (pan) {
        if (pan.burnt) {
          emoji(ctx, '🔥', cx, cy - 6, 44);
          text(ctx, 'BURNT!', cx, cy + 34, 13, '#ff8a7a');
        } else {
          emoji(ctx, INGREDIENTS[pan.ing].emoji, cx, cy - 2, 44);
          const frac = Math.min(1, pan.cooked / pan.cookTime);
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          roundRect(ctx, cx - 40, cy + 30, 80, 8, 4);
          ctx.fill();
          ctx.fillStyle = frac >= 1 ? '#58b368' : '#f5b81e';
          roundRect(ctx, cx - 40, cy + 30, 80 * frac, 8, 4);
          ctx.fill();
          if (frac >= 1) text(ctx, 'READY!', cx, cy + 52, 13, '#7be495');
          // Steam wisps while cooking.
          if (frac < 1) drawSteam(cx, cy - 44, world.time + i * 1.7);
        }
      } else {
        text(ctx, 'empty pan', cx, cy, 13, '#8a94a2');
      }
    });
    text(ctx, 'Cook: patty • egg • pasta — lift off before it burns!', r.x + r.w / 2, r.y + r.h - 14, 12, '#aab4c0');
  }

  function drawSteam(x, y, t) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i += 1) {
      const phase = (t * 0.9 + i * 0.55) % 1;
      const sx = x - 18 + i * 18 + Math.sin(phase * 6 + i) * 4;
      const sy = y - phase * 26;
      ctx.globalAlpha = 0.7 * (1 - phase);
      ctx.beginPath();
      ctx.moveTo(sx, sy + 8);
      ctx.quadraticCurveTo(sx + 5, sy, sx, sy - 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlateStation(world) {
    const r = LAYOUT.plateStation;
    ctx.fillStyle = '#f6e7c8';
    roundRect(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#d9c08a';
    roundRect(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.stroke();
    text(ctx, '🍽  PLATING STATION', r.x + 16, r.y + 22, 15, '#4a2c14', 'left');
    // The plate.
    const cx = 968;
    const cy = 316;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 118, 82, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c9b48a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 118, 82, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#e3d3ac';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 88, 58, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (world.plate.length === 0) {
      text(ctx, 'empty plate', cx, cy, 15, '#b39b6d');
      text(ctx, 'click ready items to add them', cx, cy + 24, 12, '#cbb37e');
    }
    world.plate.forEach((ing, i) => {
      const pos = plateItemRect(i, world.plate.length);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(pos.x + 26, pos.y + 26, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = INGREDIENTS[ing].dark;
      ctx.stroke();
      emoji(ctx, INGREDIENTS[ing].emoji, pos.x + 26, pos.y + 27, 34);
    });
    // Serve button.
    const b = LAYOUT.serveButton;
    const match = matchingOrder(world);
    const ready = match !== null;
    ctx.save();
    if (ready) {
      ctx.shadowColor = 'rgba(88, 179, 104, 0.9)';
      ctx.shadowBlur = 20;
    }
    ctx.fillStyle = ready ? '#58b368' : '#9a8f7a';
    roundRect(ctx, b.x, b.y, b.w, b.h, 14);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 3;
    ctx.strokeStyle = ready ? '#2f7d3d' : '#7a6f5c';
    roundRect(ctx, b.x, b.y, b.w, b.h, 14);
    ctx.stroke();
    text(ctx, 'SERVE', b.x + b.w / 2, b.y + 34, 22, '#ffffff');
    text(ctx, 'Space', b.x + b.w / 2, b.y + 62, 13, '#eafbed');
    text(ctx, ready ? `✓ ${match.recipe.name}` : 'no match yet', b.x + b.w / 2, b.y + 80, 11, '#ffffff');
    // Trash can (clear the plate).
    const tr = trashRect();
    ctx.fillStyle = '#8a94a2';
    roundRect(ctx, tr.x, tr.y, tr.w, tr.h, 10);
    ctx.fill();
    emoji(ctx, '🗑️', tr.x + tr.w / 2, tr.y + tr.h / 2 - 4, 30);
    text(ctx, 'clear', tr.x + tr.w / 2, tr.y + tr.h - 10, 10, '#ffffff');
  }

  function drawTray(world) {
    const t = LAYOUT.tray;
    ctx.fillStyle = '#6b4226';
    roundRect(ctx, t.x, t.y, t.w, t.h, 12);
    ctx.fill();
    text(ctx, 'READY TRAY', t.x + 16, t.y + t.h / 2, 15, '#ffe9b0', 'left');
    for (let i = 0; i < TRAY_MAX; i += 1) {
      const s = traySlotRect(i);
      ctx.fillStyle = i < world.tray.length ? '#fff6d8' : 'rgba(255,255,255,0.14)';
      roundRect(ctx, s.x, s.y, s.w, s.h, 10);
      ctx.fill();
      if (i < world.tray.length) {
        emoji(ctx, INGREDIENTS[world.tray[i]].emoji, s.x + s.w / 2, s.y + s.h / 2 + 1, 34);
      }
    }
    text(ctx, `${world.tray.length}/${TRAY_MAX}`, t.x + t.w - 60, t.y + t.h / 2, 14, '#ffe9b0');
  }

  function drawCounter(world) {
    text(ctx, 'INGREDIENT COUNTER  —  click a bin or press 1–8', 40, 544, 15, '#4a2c14', 'left');
    COUNTER_ORDER.forEach((ing, i) => {
      const r = binRect(i);
      const def = INGREDIENTS[ing];
      ctx.fillStyle = '#fffdf4';
      roundRect(ctx, r.x, r.y, r.w, r.h, 14);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = def.color;
      roundRect(ctx, r.x, r.y, r.w, r.h, 14);
      ctx.stroke();
      // Key number.
      ctx.fillStyle = def.dark;
      ctx.beginPath();
      ctx.arc(r.x + 20, r.y + 20, 13, 0, Math.PI * 2);
      ctx.fill();
      text(ctx, String(i + 1), r.x + 20, r.y + 21, 14, '#ffffff');
      emoji(ctx, def.emoji, r.x + r.w / 2, r.y + 74, 56);
      text(ctx, def.name, r.x + r.w / 2, r.y + 128, 16, '#4a2c14');
      const tag = def.prep === PREP.CHOP ? '✂ CHOP' : def.prep === PREP.COOK ? '🔥 COOK' : '✓ READY';
      text(ctx, tag, r.x + r.w / 2, r.y + 152, 12, def.dark);
    });
  }

  function drawToast(world) {
    if (!world.toast || world.toast.until <= world.time) return;
    const str = world.toast.text;
    ctx.font = `bold 17px ${FONT}`;
    const w = ctx.measureText(str).width + 36;
    ctx.fillStyle = 'rgba(74, 44, 20, 0.92)';
    roundRect(ctx, (VIEW.width - w) / 2, 196, w, 40, 20);
    ctx.fill();
    text(ctx, str, VIEW.width / 2, 217, 17, '#ffe9b0');
  }

  function drawPopups(world) {
    for (const p of world.popups) {
      const age = 1 - (p.until - world.time) / 1.4;
      ctx.globalAlpha = Math.max(0, 1 - age);
      text(ctx, p.text, p.x, p.y - age * 30, 26, p.color);
      ctx.globalAlpha = 1;
    }
  }

  function drawTitle(world) {
    ctx.fillStyle = 'rgba(40, 22, 8, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = '#fff6d8';
    roundRect(ctx, 240, 110, 800, 560, 24);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#f5b81e';
    roundRect(ctx, 240, 110, 800, 560, 24);
    ctx.stroke();
    emoji(ctx, '🥄', 640, 190, 64);
    text(ctx, 'GOLDEN LADLE', 640, 258, 54, '#4a2c14');
    text(ctx, 'KITCHEN', 640, 312, 54, '#c98a1d');
    text(ctx, 'A fast, friendly cooking rush — chop, cook, plate, serve!', 640, 362, 18, '#7a5a34');
    ctx.fillStyle = '#4a2c14';
    ctx.font = `bold 16px ${FONT}`;
    ctx.textAlign = 'left';
    const lines = [
      '🎫  Tickets arrive on the order board — each lists its dish.',
      '🔪  Chop tomato, lettuce and onion on the board (click 3 times).',
      '🍳  Cook patty, egg and pasta in the pans — lift off before they burn!',
      '🧀  Cheese and buns go straight to the ready tray.',
      '🍽  Click ready items onto the plate, then SERVE when it matches a ticket.',
      '⏱  3-minute shift. Serve fast for tips, keep your 3 hearts!',
    ];
    lines.forEach((line, i) => ctx.fillText(line, 330, 404 + i * 30));
    const b = LAYOUT.startButton;
    ctx.fillStyle = '#58b368';
    roundRect(ctx, b.x, b.y, b.w, b.h, 16);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2f7d3d';
    roundRect(ctx, b.x, b.y, b.w, b.h, 16);
    ctx.stroke();
    text(ctx, '▶  START SHIFT', b.x + b.w / 2, b.y + b.h / 2, 26, '#ffffff');
    text(ctx, 'or press Enter  •  mouse + keyboard  •  sound: M to mute', 640, 656, 13, '#9c6b2f');
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(40, 22, 8, 0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text(ctx, '⏸  PAUSED', 640, 360, 48, '#ffffff');
    text(ctx, 'Press P or click anywhere to keep cooking', 640, 420, 18, '#ffe9b0');
  }

  function drawGameOver(world) {
    ctx.fillStyle = 'rgba(40, 22, 8, 0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = '#fff6d8';
    roundRect(ctx, 290, 100, 700, 600, 24);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#f5b81e';
    roundRect(ctx, 290, 100, 700, 600, 24);
    ctx.stroke();
    emoji(ctx, '🎉', 640, 158, 56);
    text(ctx, 'SHIFT OVER!', 640, 216, 44, '#4a2c14');
    text(ctx, world.overReason ?? '', 640, 256, 16, '#7a5a34');
    text(ctx, `⭐  SCORE  ${world.score}`, 640, 316, 34, '#c98a1d');
    const rows = [
      ['🍽  Dishes served', String(world.served)],
      ['🔥  Best combo', `x${world.bestCombo}`],
      ['💔  Tickets walked out', String(world.expired)],
      ['❌  Wrong plates', String(world.mistakes)],
    ];
    rows.forEach(([label, value], i) => {
      const y = 370 + i * 34;
      text(ctx, label, 400, y, 18, '#4a2c14', 'left');
      text(ctx, value, 880, y, 18, '#4a2c14', 'right');
    });
    if (world.bestDish) {
      text(ctx, `Best plate: ${world.bestDish.emoji} ${world.bestDish.name}  (+${world.bestServe})`, 640, 518, 17, '#2f7d3d');
    }
    const b = LAYOUT.againButton;
    ctx.fillStyle = '#58b368';
    roundRect(ctx, b.x, b.y, b.w, b.h, 16);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2f7d3d';
    roundRect(ctx, b.x, b.y, b.w, b.h, 16);
    ctx.stroke();
    text(ctx, '↻  COOK AGAIN', b.x + b.w / 2, b.y + b.h / 2, 24, '#ffffff');
    text(ctx, 'or press Enter', 640, b.y + b.h + 28, 13, '#9c6b2f');
  }

  function render(world, audio) {
    ctx.save();
    if (world.shakeUntil > world.time) {
      const mag = 6;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }
    drawKitchenBackdrop();
    drawTopBar(world, audio);
    for (let i = 0; i < world.orders.length; i += 1) drawTicket(world, world.orders[i], i);
    drawChefTip(world);
    drawChopBoard(world);
    drawStove(world);
    drawPlateStation(world);
    drawTray(world);
    drawCounter(world);
    drawToast(world);
    drawPopups(world);
    if (world.flash && world.flash.until > world.time) {
      ctx.fillStyle = world.flash.color;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    ctx.restore();
    if (world.screen === SCREEN_TITLE) drawTitle(world);
    else if (world.screen === SCREEN_PAUSED) drawPaused();
    else if (world.screen === SCREEN_OVER) drawGameOver(world);
  }

  return { render, pauseButtonRect, muteButtonRect, trashRect };
}
