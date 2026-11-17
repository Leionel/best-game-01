// All drawing: the world, the HUD and every screen. No rules live here, only
// how the state looks on the canvas.

import { ARENA, PALETTE, SURVIVE_SECONDS, VIEW } from './config.js';
import { clamp } from './random.js';

const TAU = Math.PI * 2;

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
  ctx.font = `${weight} ${size}px "Trebuchet MS", "Segoe UI", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.motes = [];
    for (let i = 0; i < 70; i += 1) {
      this.motes.push({
        x: Math.random() * ARENA.width,
        y: Math.random() * ARENA.height,
        r: 1 + Math.random() * 2.2,
        speed: 6 + Math.random() * 14,
        drift: Math.random() * TAU,
      });
    }
  }

  camera(world) {
    const p = world.player;
    const shakeX = world.shake > 0 ? (Math.random() * 2 - 1) * world.shake : 0;
    const shakeY = world.shake > 0 ? (Math.random() * 2 - 1) * world.shake : 0;
    return {
      x: clamp(p.x - VIEW.width / 2, 0, ARENA.width - VIEW.width) + shakeX,
      y: clamp(p.y - VIEW.height / 2, 0, ARENA.height - VIEW.height) + shakeY,
    };
  }

  drawWorld(ctx, world, cam) {
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // Ground grid.
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    const grid = 80;
    const startX = Math.floor(cam.x / grid) * grid - cam.x;
    const startY = Math.floor(cam.y / grid) * grid - cam.y;
    ctx.beginPath();
    for (let x = startX; x <= VIEW.width; x += grid) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VIEW.height);
    }
    for (let y = startY; y <= VIEW.height; y += grid) {
      ctx.moveTo(0, y);
      ctx.lineTo(VIEW.width, y);
    }
    ctx.stroke();
    // Drifting embers.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const mote of this.motes) {
      const mx = mote.x - cam.x + Math.sin(world.time * 0.4 + mote.drift) * 12;
      const my = ((mote.y - world.time * mote.speed) % ARENA.height + ARENA.height) % ARENA.height - cam.y;
      if (mx < -10 || mx > VIEW.width + 10 || my < -10 || my > VIEW.height + 10) continue;
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(world.time * 2 + mote.drift);
      ctx.fillStyle = '#ff9a3c';
      ctx.beginPath();
      ctx.arc(mx, my, mote.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // Arena border.
    ctx.strokeStyle = PALETTE.arenaEdge;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.55;
    ctx.strokeRect(-cam.x - 2, -cam.y - 2, ARENA.width + 4, ARENA.height + 4);
    ctx.globalAlpha = 1;

    // Telegraphs (meteor warnings).
    for (const tel of world.telegraphs) {
      const pulse = 0.5 + 0.5 * Math.sin(world.time * 18);
      ctx.fillStyle = `rgba(255, 60, 40, ${0.12 + 0.14 * pulse})`;
      ctx.beginPath();
      ctx.arc(tel.x - cam.x, tel.y - cam.y, tel.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 90, 42, ${0.5 + 0.4 * pulse})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(tel.x - cam.x, tel.y - cam.y, tel.r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Gems.
    for (const gem of world.gems) {
      const gx = gem.x - cam.x;
      const gy = gem.y - cam.y;
      if (gx < -20 || gx > VIEW.width + 20 || gy < -20 || gy > VIEW.height + 20) continue;
      const size = gem.big ? 9 : 6;
      const pulse = 1 + 0.12 * Math.sin(world.time * 5 + gem.x);
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = gem.big ? PALETTE.gemBig : PALETTE.gem;
      ctx.shadowColor = gem.big ? '#ffd23c' : '#ffa62b';
      ctx.shadowBlur = 10;
      ctx.fillRect(-size * pulse / 2, -size * pulse / 2, size * pulse, size * pulse);
      ctx.restore();
    }

    // Pickups.
    for (const pickup of world.pickups) {
      const px = pickup.x - cam.x;
      const py = pickup.y - cam.y;
      const bob = Math.sin(world.time * 4 + pickup.x) * 3;
      ctx.save();
      ctx.shadowBlur = 12;
      if (pickup.kind === 'health') {
        ctx.fillStyle = PALETTE.health;
        ctx.shadowColor = '#7ee081';
        ctx.beginPath();
        ctx.arc(px, py + bob, 13, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0b2b12';
        ctx.fillRect(px - 7, py + bob - 2, 14, 4);
        ctx.fillRect(px - 2, py + bob - 7, 4, 14);
      } else {
        ctx.fillStyle = PALETTE.magnet;
        ctx.shadowColor = '#6ec6ff';
        ctx.beginPath();
        ctx.arc(px, py + bob, 13, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#0b2b4d';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(px, py + bob, 7, Math.PI * 0.15, Math.PI * 0.85, true);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Enemies.
    for (const enemy of world.enemies) {
      this.drawEnemy(ctx, enemy, cam, world.time);
    }

    // Player shots.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const shot of world.shots) {
      const sx = shot.x - cam.x;
      const sy = shot.y - cam.y;
      const angle = Math.atan2(shot.vy, shot.vx);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(angle);
      ctx.fillStyle = shot.kind === 'shard' ? PALETTE.shard : PALETTE.shot;
      ctx.shadowColor = shot.kind === 'shard' ? '#a8e6ff' : '#ffd9a0';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-8, -4);
      ctx.lineTo(-8, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Orbit flames.
    const orbitLevel = world.player.weapons.orbitFlame;
    if (orbitLevel) {
      const def = { 1: 2, 2: 2, 3: 3, 4: 3, 5: 4 }[orbitLevel];
      const state = world.weaponState.orbitFlame;
      const radius = [74, 82, 88, 96, 104][orbitLevel - 1];
      for (let i = 0; i < def; i += 1) {
        const angle = state.angle + (i * TAU) / def;
        const bx = world.player.x + Math.cos(angle) * radius - cam.x;
        const by = world.player.y + Math.sin(angle) * radius - cam.y;
        ctx.fillStyle = '#ff7b2f';
        ctx.shadowColor = '#ff9a3c';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(bx, by, 9, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffe9b0';
        ctx.beginPath();
        ctx.arc(bx, by, 4, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();

    // Novas.
    for (const nova of world.novas) {
      const alpha = 1 - nova.r / nova.maxR;
      ctx.strokeStyle = `rgba(255, 154, 60, ${alpha})`;
      ctx.lineWidth = 10 * alpha + 2;
      ctx.beginPath();
      ctx.arc(nova.x - cam.x, nova.y - cam.y, nova.r, 0, TAU);
      ctx.stroke();
    }

    // Player.
    this.drawPlayer(ctx, world, cam);

    // Foe shots.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const shot of world.foeShots) {
      ctx.fillStyle = '#c6ff7a';
      ctx.shadowColor = '#7ee081';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(shot.x - cam.x, shot.y - cam.y, shot.radius, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // Particles.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const pt of world.particles) {
      ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x - cam.x, pt.y - cam.y, pt.size, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // Damage numbers.
    ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const fl of world.floaters) {
      ctx.globalAlpha = clamp(fl.life / fl.maxLife, 0, 1);
      ctx.fillStyle = fl.color;
      ctx.fillText(fl.text, fl.x - cam.x, fl.y - cam.y);
    }
    ctx.globalAlpha = 1;
  }

  drawEnemy(ctx, enemy, cam, time) {
    const x = enemy.x - cam.x;
    const y = enemy.y - cam.y;
    if (x < -80 || x > VIEW.width + 80 || y < -80 || y > VIEW.height + 80) return;
    ctx.save();
    if (enemy.telegraph > 0) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 22);
    }
    ctx.fillStyle = enemy.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    if (enemy.kind === 'wisp') {
      ctx.shadowColor = enemy.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(x, y, enemy.radius, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#efe6ff';
      ctx.beginPath();
      ctx.arc(x - 3, y - 2, 3, 0, TAU);
      ctx.arc(x + 4, y + 1, 2.4, 0, TAU);
      ctx.fill();
    } else if (enemy.kind === 'cinder') {
      ctx.shadowColor = enemy.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * TAU + time * 0.8;
        const r = i % 2 === 0 ? enemy.radius + 5 : enemy.radius - 2;
        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffd9a0';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, TAU);
      ctx.fill();
    } else if (enemy.kind === 'brute') {
      ctx.shadowColor = enemy.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x, y, enemy.radius, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.moveTo(x - 10, y - 6);
      ctx.lineTo(x - 2, y + 2);
      ctx.lineTo(x + 8, y - 8);
      ctx.moveTo(x + 4, y + 10);
      ctx.lineTo(x + 12, y + 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd9a0';
      ctx.beginPath();
      ctx.arc(x - 7, y - 5, 3, 0, TAU);
      ctx.arc(x + 8, y - 5, 3, 0, TAU);
      ctx.fill();
    } else if (enemy.kind === 'spitter') {
      ctx.shadowColor = enemy.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(x, y, enemy.radius, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0b2b12';
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, TAU);
      ctx.fill();
    } else if (enemy.boss) {
      ctx.shadowColor = enemy.ring;
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(x, y, enemy.radius, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = enemy.ring;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, enemy.radius + 6 + Math.sin(time * 3) * 2, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(x, y, enemy.radius * 0.55, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff3d6';
      ctx.beginPath();
      ctx.arc(x - enemy.radius * 0.3, y - 6, 5, 0, TAU);
      ctx.arc(x + enemy.radius * 0.3, y - 6, 5, 0, TAU);
      ctx.fill();
    }
    if (enemy.flash > 0) {
      ctx.globalAlpha = clamp(enemy.flash / 0.09, 0, 1) * 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, enemy.radius, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (enemy.slowTimer > 0) {
      ctx.strokeStyle = 'rgba(168, 230, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, enemy.radius + 3, 0, TAU);
      ctx.stroke();
    }
    // Health bar for brutes and bosses.
    if ((enemy.kind === 'brute' || enemy.boss) && enemy.hp < enemy.maxHp) {
      const w = enemy.boss ? 110 : 44;
      const y0 = y - enemy.radius - 12;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - w / 2, y0, w, 6);
      ctx.fillStyle = enemy.boss ? '#ff3d7e' : '#ff6b4a';
      ctx.fillRect(x - w / 2, y0, w * clamp(enemy.hp / enemy.maxHp, 0, 1), 6);
    }
    ctx.restore();
    if (enemy.boss) {
      text(this.ctx, enemy.name.toUpperCase(), x, y - enemy.radius - 26, 13, '#ffd23c');
    }
  }

  drawPlayer(ctx, world, cam) {
    const p = world.player;
    const x = p.x - cam.x;
    const y = p.y - cam.y;
    const bob = p.moving ? Math.sin(p.walkCycle) * 2 : 0;
    ctx.save();
    if (p.iframes > 0 && Math.floor(p.iframes * 20) % 2 === 0) ctx.globalAlpha = 0.45;
    ctx.shadowColor = PALETTE.playerRing;
    ctx.shadowBlur = 18;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(x, y + bob, p.radius, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(x, y + bob, p.radius * 0.55, 0, TAU);
    ctx.fill();
    // Facing wedge.
    ctx.fillStyle = PALETTE.playerRing;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(p.facing) * (p.radius + 8), y + bob + Math.sin(p.facing) * (p.radius + 8));
    ctx.arc(x, y + bob, p.radius + 2, p.facing - 0.5, p.facing + 0.5);
    ctx.closePath();
    ctx.fill();
    if (p.hurtFlash > 0) {
      ctx.globalAlpha = clamp(p.hurtFlash / 0.25, 0, 1) * 0.6;
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath();
      ctx.arc(x, y + bob, p.radius + 4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawHUD(ctx, world) {
    const p = world.player;
    // XP bar across the top.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, VIEW.width, 10);
    ctx.fillStyle = '#ffa62b';
    ctx.fillRect(0, 0, VIEW.width * clamp(p.xp / p.xpNext, 0, 1), 10);
    // Level badge.
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, 14, 20, 118, 56, 8);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    text(ctx, `LEVEL ${p.level}`, 73, 36, 15, PALETTE.text);
    text(ctx, `${p.xp} / ${p.xpNext} XP`, 73, 58, 13, PALETTE.textDim);
    // Health bar.
    const hpW = 220;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, 14, 84, hpW, 20, 6);
    ctx.fill();
    ctx.fillStyle = p.hp / p.maxHp > 0.3 ? '#ff6b4a' : PALETTE.danger;
    roundRect(ctx, 14, 84, hpW * clamp(p.hp / p.maxHp, 0, 1), 20, 6);
    ctx.fill();
    text(ctx, `${Math.ceil(p.hp)} / ${p.maxHp}`, 124, 94, 13, '#ffffff');
    // Timer and wave, top centre, on a dark pill so the swarm never hides it.
    const remain = SURVIVE_SECONDS - world.time;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, VIEW.width / 2 - 112, 14, 224, 66, 10);
    ctx.fill();
    text(ctx, formatTime(remain), VIEW.width / 2, 40, 34, PALETTE.text);
    text(ctx, `WAVE ${world.wave}  •  DAWN IN ${formatTime(remain)}`, VIEW.width / 2, 68, 13, PALETTE.textDim);
    // Score and kills, top right.
    text(ctx, `SCORE ${world.score}`, VIEW.width - 16, 34, 18, PALETTE.text, 'right');
    text(ctx, `${world.kills} SLAIN  •  STREAK ${world.streak}`, VIEW.width - 16, 58, 13, PALETTE.textDim, 'right');
    // Boss bar.
    const boss = world.enemies.find((e) => e.boss);
    if (boss) {
      const w = 420;
      const x0 = VIEW.width / 2 - w / 2;
      const y0 = 88;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      roundRect(ctx, x0, y0, w, 16, 6);
      ctx.fill();
      ctx.fillStyle = '#ff3d7e';
      roundRect(ctx, x0, y0, w * clamp(boss.hp / boss.maxHp, 0, 1), 16, 6);
      ctx.fill();
      text(ctx, boss.name.toUpperCase(), VIEW.width / 2, y0 + 30, 13, '#ffd23c');
    }
    // Banner.
    if (world.banner && world.bannerTimer > 0) {
      const alpha = clamp(world.bannerTimer / 0.6, 0, 1);
      ctx.globalAlpha = alpha;
      text(ctx, world.banner, VIEW.width / 2, 150, 30, '#ffd23c');
      ctx.globalAlpha = 1;
    }
    // Weapon icons, bottom left.
    let wx = 16;
    for (const [id, level] of Object.entries(p.weapons)) {
      ctx.fillStyle = PALETTE.panel;
      roundRect(ctx, wx, VIEW.height - 52, 46, 40, 8);
      ctx.fill();
      ctx.strokeStyle = PALETTE.panelEdge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      text(ctx, this.weaponGlyph(id), wx + 23, VIEW.height - 40, 20, PALETTE.text);
      text(ctx, `Lv${level}`, wx + 23, VIEW.height - 20, 10, PALETTE.textDim);
      wx += 54;
    }
    // Low health vignette.
    if (p.hp / p.maxHp < 0.3 && !world.over) {
      const pulse = 0.16 + 0.1 * Math.sin(world.time * 6);
      const gradient = ctx.createRadialGradient(
        VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.35,
        VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.75,
      );
      gradient.addColorStop(0, 'rgba(255,40,40,0)');
      gradient.addColorStop(1, `rgba(255,40,40,${pulse})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    // Mute hint.
    text(ctx, 'M mute  •  P pause', VIEW.width - 16, VIEW.height - 16, 12, PALETTE.textDim, 'right');
  }

  weaponGlyph(id) {
    if (id === 'emberBolt') return '✦';
    if (id === 'orbitFlame') return '❂';
    if (id === 'novaPulse') return '◎';
    if (id === 'frostShard') return '❄';
    if (id === 'meteor') return '☄';
    if (id === 'swiftBoots') return '➤';
    if (id === 'emberHeart') return '♥';
    if (id === 'magnet') return '◉';
    if (id === 'sharpFocus') return '✧';
    if (id === 'quickHands') return '↻';
    if (id === 'heal') return '✚';
    return '◆';
  }

  drawTitle(ctx, world, best) {
    ctx.fillStyle = 'rgba(8, 5, 3, 0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text(ctx, 'EMBERFALL', VIEW.width / 2, 190, 92, '#ffb347');
    text(ctx, 'S U R V I V E   T H E   S W A R M', VIEW.width / 2, 252, 22, '#ff7b2f');
    text(ctx, 'The swarm comes at dusk. Your embers answer on their own —', VIEW.width / 2, 320, 18, PALETTE.text);
    text(ctx, 'you just have to keep moving. Last until dawn: 5:00.', VIEW.width / 2, 346, 18, PALETTE.text);
    const pulse = 0.65 + 0.35 * Math.sin(world.time * 3);
    ctx.globalAlpha = pulse;
    text(ctx, 'CLICK OR PRESS ENTER TO PLAY', VIEW.width / 2, 420, 24, '#ffd23c');
    ctx.globalAlpha = 1;
    text(ctx, 'Move  WASD / Arrow keys      Level up  Click a card or press 1 / 2 / 3', VIEW.width / 2, 480, 16, PALETTE.textDim);
    text(ctx, 'Pause  P      Mute  M      Restart  R', VIEW.width / 2, 508, 16, PALETTE.textDim);
    if (best && best.score > 0) {
      text(ctx, `BEST  ${best.score}  •  SURVIVED ${formatTime(best.time)}`, VIEW.width / 2, 566, 16, '#ffd23c');
    }
    text(ctx, 'A complete original game — no network, no downloads, just embers.', VIEW.width / 2, 640, 13, PALETTE.textDim);
  }

  drawLevelUp(ctx, choices, mouse) {
    ctx.fillStyle = 'rgba(8, 5, 3, 0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text(ctx, 'LEVEL UP', VIEW.width / 2, 130, 44, '#ffd23c');
    text(ctx, 'Choose one — click a card or press 1, 2 or 3', VIEW.width / 2, 178, 17, PALETTE.textDim);
    const cardW = 300;
    const cardH = 220;
    const gap = 28;
    const total = cardW * 3 + gap * 2;
    const x0 = (VIEW.width - total) / 2;
    const y0 = 230;
    choices.forEach((choice, i) => {
      const x = x0 + i * (cardW + gap);
      const hovered = mouse.x >= x && mouse.x <= x + cardW && mouse.y >= y0 && mouse.y <= y0 + cardH;
      ctx.fillStyle = hovered ? '#33200c' : PALETTE.card;
      roundRect(ctx, x, y0, cardW, cardH, 12);
      ctx.fill();
      ctx.strokeStyle = hovered ? PALETTE.cardHot : PALETTE.cardEdge;
      ctx.lineWidth = hovered ? 3 : 2;
      ctx.stroke();
      const def = choice.def;
      text(ctx, this.weaponGlyph(choice.id), x + cardW / 2, y0 + 52, 44, '#ffb347');
      text(ctx, def.name.toUpperCase(), x + cardW / 2, y0 + 108, 20, PALETTE.text);
      text(ctx, choice.isNew ? 'NEW' : `LEVEL ${choice.level}`, x + cardW / 2, y0 + 136, 14, '#ffd23c');
      this.wrapText(ctx, def.blurb, x + cardW / 2, y0 + 168, cardW - 40, 15, PALETTE.textDim);
      text(ctx, `[ ${i + 1} ]`, x + cardW / 2, y0 + cardH - 22, 13, PALETTE.textDim);
    });
  }

  wrapText(ctx, str, x, y, maxWidth, size, color) {
    ctx.font = `bold ${size}px "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const words = str.split(' ');
    const lines = [''];
    for (const word of words) {
      const trial = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
      if (ctx.measureText(trial).width > maxWidth && lines[lines.length - 1]) {
        lines.push(word);
      } else {
        lines[lines.length - 1] = trial;
      }
    }
    lines.forEach((line, i) => {
      ctx.fillStyle = color;
      ctx.fillText(line, x, y + i * (size + 5));
    });
  }

  drawPause(ctx) {
    ctx.fillStyle = 'rgba(8, 5, 3, 0.66)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text(ctx, 'PAUSED', VIEW.width / 2, 300, 52, PALETTE.text);
    text(ctx, 'P to resume  •  R to restart', VIEW.width / 2, 366, 18, PALETTE.textDim);
  }

  statsLines(world, best) {
    return [
      ['TIME SURVIVED', formatTime(world.time)],
      ['FOES SLAIN', String(world.kills)],
      ['LEVEL REACHED', String(world.player.level)],
      ['SCORE', String(world.score)],
      ['BEST SCORE', String(Math.max(best.score, world.score))],
    ];
  }

  drawOver(ctx, world, best) {
    ctx.fillStyle = 'rgba(12, 4, 3, 0.78)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text(ctx, 'THE SWARM CLAIMS YOU', VIEW.width / 2, 170, 52, '#ff4d4d');
    text(ctx, 'The embers fade — but they remember.', VIEW.width / 2, 222, 18, PALETTE.textDim);
    this.statsLines(world, best).forEach((row, i) => {
      const y = 300 + i * 44;
      text(ctx, row[0], VIEW.width / 2 - 130, y, 17, PALETTE.textDim, 'right');
      text(ctx, row[1], VIEW.width / 2 + 130, y, 20, PALETTE.text, 'left');
    });
    const pulse = 0.65 + 0.35 * Math.sin(world.time * 3);
    ctx.globalAlpha = pulse;
    text(ctx, 'PRESS R OR CLICK TO TRY AGAIN', VIEW.width / 2, 560, 22, '#ffd23c');
    ctx.globalAlpha = 1;
  }

  drawWin(ctx, world, best) {
    ctx.fillStyle = 'rgba(10, 8, 3, 0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text(ctx, 'DAWN BREAKS', VIEW.width / 2, 150, 56, '#ffd23c');
    text(ctx, 'You survived the night. The swarm is ash.', VIEW.width / 2, 208, 18, PALETTE.text);
    this.statsLines(world, best).forEach((row, i) => {
      const y = 290 + i * 44;
      text(ctx, row[0], VIEW.width / 2 - 130, y, 17, PALETTE.textDim, 'right');
      text(ctx, row[1], VIEW.width / 2 + 130, y, 20, PALETTE.text, 'left');
    });
    const pulse = 0.65 + 0.35 * Math.sin(world.time * 3);
    ctx.globalAlpha = pulse;
    text(ctx, 'PRESS R OR CLICK TO PLAY AGAIN', VIEW.width / 2, 560, 22, '#ffd23c');
    ctx.globalAlpha = 1;
  }

  draw(ctx, world, screen, ui) {
    const cam = this.camera(world);
    this.drawWorld(ctx, world, cam);
    if (screen === 'play' || screen === 'levelup' || screen === 'pause') {
      this.drawHUD(ctx, world);
    }
    if (screen === 'title') this.drawTitle(ctx, world, ui.best);
    if (screen === 'levelup') this.drawLevelUp(ctx, ui.choices, ui.mouse);
    if (screen === 'pause') this.drawPause(ctx);
    if (screen === 'over') this.drawOver(ctx, world, ui.best);
    if (screen === 'win') this.drawWin(ctx, world, ui.best);
  }
}
