/**
 * SHADOW WARRIOR – GAMERKIE EDITION
 * levels.js - 8 Distinct Worlds, Campaign Stages & Kinematic Infinite Level Generator
 */
(function (global) {
  'use strict';

  const WORLD_THEMES = {
    1: { name: 'CITY STREETS',      skyTop: '#0f172a', skyBot: '#1e293b', ground: '#334155', accent: '#38bdf8', hazard: 'traffic' },
    2: { name: 'DARK FOREST',       skyTop: '#052e16', skyBot: '#14532d', ground: '#3f6212', accent: '#4ade80', hazard: 'thorns' },
    3: { name: 'MILITARY BASE',     skyTop: '#1c1917', skyBot: '#292524', ground: '#57534e', accent: '#ef4444', hazard: 'laser' },
    4: { name: 'DESERT KINGDOM',    skyTop: '#451a03', skyBot: '#78350f', ground: '#b45309', accent: '#facc15', hazard: 'fallingrock' },
    5: { name: 'FROZEN MOUNTAINS',  skyTop: '#082f49', skyBot: '#0c4a6e', ground: '#7dd3fc', accent: '#e0f2fe', hazard: 'icicle', slippery: true },
    6: { name: 'UNDERGROUND LAB',   skyTop: '#090d16', skyBot: '#1e1b4b', ground: '#312e81', accent: '#06b6d4', hazard: 'electric' },
    7: { name: 'DARK CASTLE',       skyTop: '#2a0808', skyBot: '#450a0a', ground: '#7f1d1d', accent: '#f97316', hazard: 'lava' },
    8: { name: 'FINAL SHADOW REALM',skyTop: '#090514', skyBot: '#2e1065', ground: '#4c1d95', accent: '#c084fc', hazard: 'void' }
  };

  function createSeededRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  class Level {
    constructor(worldId, levelNum, mode) {
      this.worldId = worldId;
      this.levelNum = levelNum;
      this.mode = mode || 'story';

      const themeKey = ((worldId - 1) % 8) + 1;
      this.theme = WORLD_THEMES[themeKey];
      this.isSlipperyWorld = Boolean(this.theme.slippery);

      this.isBossLevel = (this.mode === 'story' && levelNum === 5) || this.mode === 'bossrush';
      this.width = this.isBossLevel ? 1400 : (this.mode === 'endless' || this.mode === 'survival' ? 1600 : 3800 + levelNum * 350);
      this.height = 720;

      this.platforms = [];
      this.climbables = [];
      this.hazards = [];
      this.destructibles = [];
      this.collectibles = [];
      this.checkpoints = [];
      this.enemies = [];
      this.boss = null;

      this.checkpointX = 100;
      this.checkpointY = 480;
      this.exitX = this.width - 140;
      this.exitY = 500;

      this.score = 0;
      this.kills = 0;
      this.coinsCollected = 0;
      this.gemsCollected = 0;
      this.completed = false;
      this.waveNumber = 1;
      this.survivalTimer = 0;

      this.generateStage();
    }

    generateStage() {
      const rand = createSeededRandom(this.worldId * 1000 + this.levelNum * 37);
      const scaleMult = 1 + (this.worldId - 1) * 0.22 + (this.levelNum - 1) * 0.06;

      if (this.isBossLevel || this.mode === 'endless' || this.mode === 'survival') {
        // Arena Layout
        this.platforms.push({ x: 0, y: 600, w: this.width, h: 140, oneWay: false });
        this.platforms.push({ x: 240, y: 455, w: 220, h: 20, oneWay: true });
        this.platforms.push({ x: this.width - 460, y: 455, w: 220, h: 20, oneWay: true });
        this.platforms.push({ x: this.width / 2 - 140, y: 340, w: 280, h: 20, oneWay: true });

        if (this.isBossLevel) {
          this.boss = new global.Boss(this.worldId, this.width - 280, 420, scaleMult);
        } else {
          this.spawnArenaWave(1);
        }
        return;
      }

      // Campaign & Procedural Unlimited Stage Builder with Kinematic Reachability Validation
      // Starting safe zone
      this.platforms.push({ x: 0, y: 580, w: 520, h: 160, oneWay: false });

      let cursorX = 520;
      let prevY = 580;
      const enemyPool = this.getWorldEnemyPool(this.worldId);

      while (cursorX < this.width - 650) {
        // Guaranteed reachable gap (<= 175px) and height step (|dy| <= 115px)
        const gap = Math.floor(75 + rand() * 95);
        const segW = Math.floor(260 + rand() * 280);
        const deltaY = Math.floor((rand() - 0.48) * 190);
        const segY = Math.max(330, Math.min(610, prevY + deltaY));

        cursorX += gap;
        const isMoving = rand() < 0.18 && this.worldId >= 2;

        const plat = {
          x: cursorX,
          y: segY,
          w: segW,
          h: isMoving ? 24 : 740 - segY,
          oneWay: isMoving,
          moving: isMoving,
          originX: cursorX,
          rangeX: isMoving ? 70 : 0,
          vx: isMoving ? 85 : 0
        };
        this.platforms.push(plat);

        // Elevated secondary bonus / secret platform + climbable ladder
        if (rand() < 0.48) {
          const highY = segY - 135;
          this.platforms.push({ x: cursorX + 35, y: highY, w: segW - 70, h: 18, oneWay: true });
          this.climbables.push({ x: cursorX + 55, y: highY, w: 28, h: segY - highY });

          // Secret area Treasure Chest or Weapon Drop
          if (rand() < 0.45) {
            this.collectibles.push({ x: cursorX + segW / 2, y: highY - 28, type: 'chest', taken: false });
          } else {
            this.collectibles.push({ x: cursorX + segW / 2, y: highY - 26, type: 'gem', taken: false });
          }
        }

        // Coins arc along platform
        const coinCount = Math.floor(3 + rand() * 4);
        for (let c = 0; c < coinCount; c++) {
          this.collectibles.push({
            x: cursorX + 40 + c * 36,
            y: segY - 36,
            type: rand() < 0.3 ? 'silver' : 'gold',
            taken: false
          });
        }

        // Destructible crates or explosive barrels
        if (rand() < 0.45) {
          this.destructibles.push({
            x: cursorX + segW - 75,
            y: segY - 42,
            w: 38,
            h: 42,
            hp: 25,
            broken: false,
            type: rand() < 0.4 && this.worldId >= 3 ? 'barrel' : 'crate'
          });
        }

        // Environmental Hazards
        if (rand() < 0.42 && segW > 300) {
          this.hazards.push({
            x: cursorX + segW * 0.45,
            y: segY - 18,
            w: 44,
            h: 18,
            type: this.theme.hazard,
            timer: rand() * 3
          });
        }

        // Spawn Enemies on segment
        const numEnemies = rand() < 0.65 ? 2 : 1;
        for (let e = 0; e < numEnemies; e++) {
          const eType = enemyPool[Math.floor(rand() * enemyPool.length)];
          this.enemies.push(
            new global.Enemy(eType, cursorX + 80 + e * 90, segY - 72, scaleMult)
          );
        }

        // Mid-level Checkpoint
        if (this.checkpoints.length === 0 && cursorX > this.width * 0.46) {
          this.checkpoints.push({ x: cursorX + 40, y: segY - 64, active: false });
        }

        prevY = segY;
        cursorX += segW;
      }

      // Final Exit Platform + Mini-Boss guard on non-boss stages
      const endX = cursorX + 80;
      this.width = endX + 520;
      this.platforms.push({ x: endX, y: 560, w: 520, h: 180, oneWay: false });
      this.exitX = this.width - 140;
      this.exitY = 480;

      this.enemies.push(new global.Enemy('miniboss', endX + 180, 460, scaleMult));
    }

    getWorldEnemyPool(w) {
      if (w === 1) return ['street', 'runner', 'weapon'];
      if (w === 2) return ['runner', 'ninja', 'flying', 'heavy'];
      if (w === 3) return ['shield', 'ranged', 'explosive', 'heavy'];
      if (w === 4) return ['weapon', 'shield', 'flying', 'elite'];
      if (w === 5) return ['runner', 'heavy', 'ranged', 'ninja'];
      if (w === 6) return ['flying', 'ranged', 'explosive', 'elite'];
      if (w === 7) return ['shield', 'ninja', 'heavy', 'elite'];
      return ['street', 'runner', 'heavy', 'shield', 'weapon', 'ninja', 'flying', 'ranged', 'explosive', 'elite'];
    }

    spawnArenaWave(wave) {
      this.waveNumber = wave;
      const scaleMult = 1 + (wave - 1) * 0.18;
      const pool = this.getWorldEnemyPool(8);
      const count = Math.min(10, 3 + wave);
      for (let i = 0; i < count; i++) {
        const eType = (wave % 5 === 0 && i === 0) ? 'miniboss' : pool[i % pool.length];
        const spawnX = 180 + ((i * 220) % (this.width - 360));
        this.enemies.push(new global.Enemy(eType, spawnX, 260, scaleMult));
      }
    }

    spawnDropFromCrate(x, y) {
      const r = Math.random();
      if (r < 0.35) {
        this.collectibles.push({ x, y: y - 10, type: 'potion', taken: false });
      } else if (r < 0.65) {
        this.collectibles.push({ x, y: y - 10, type: 'energy', taken: false });
      } else {
        this.collectibles.push({ x, y: y - 10, type: 'weaponDrop', taken: false });
      }
    }

    spawnEnemyLoot(x, y, count) {
      for (let i = 0; i < count; i++) {
        this.collectibles.push({
          x: x + (Math.random() - 0.5) * 44,
          y: y - 12,
          type: Math.random() < 0.12 ? 'gem' : 'gold',
          taken: false
        });
      }
    }

    isTouchingClimbable(actor) {
      for (const c of this.climbables) {
        if (actor.x < c.x + c.w && actor.x + actor.w > c.x && actor.y < c.y + c.h && actor.y + actor.h > c.y) {
          return true;
        }
      }
      return false;
    }

    update(dt, player, combat) {
      player.currentLevelRef = this;

      // Update Moving Platforms
      for (const p of this.platforms) {
        if (p.moving) {
          p.x += p.vx * dt;
          if (Math.abs(p.x - p.originX) > p.rangeX) {
            p.vx *= -1;
          }
        }
      }

      // Check Hazards
      for (const h of this.hazards) {
        h.timer += dt;
        const active = h.type === 'laser' ? Math.sin(h.timer * 3) > -0.2 : true;
        if (active && combat.rectsOverlap(player, h)) {
          player.takeDamage(16, h.x + h.w / 2, combat);
        }
      }

      // Check Checkpoints
      for (const cp of this.checkpoints) {
        if (!cp.active && Math.abs(player.x - cp.x) < 48) {
          cp.active = true;
          this.checkpointX = cp.x;
          this.checkpointY = cp.y - 20;
          global.AudioSystem.sfxCoin();
          if (global.UISystem) global.UISystem.showToast('CHECKPOINT ACTIVATED!');
        }
      }

      // Check Collectibles
      for (const item of this.collectibles) {
        if (item.taken) continue;
        if (Math.hypot((player.x + player.w / 2) - item.x, (player.y + player.h / 2) - item.y) < 38) {
          item.taken = true;
          global.AudioSystem.sfxCoin();

          if (item.type === 'gold') {
            this.coinsCollected += 10;
            this.score += 50;
            global.SaveSystem.addCoins(10);
            combat.addFloatingText(item.x, item.y, '+10 COINS', '#facc15', 14);
          } else if (item.type === 'silver') {
            this.coinsCollected += 5;
            this.score += 25;
            global.SaveSystem.addCoins(5);
            combat.addFloatingText(item.x, item.y, '+5 COINS', '#e2e8f0', 13);
          } else if (item.type === 'gem') {
            this.gemsCollected += 1;
            this.score += 150;
            global.SaveSystem.addGems(1);
            combat.addFloatingText(item.x, item.y, '+1 GEM!', '#d946ef', 16);
          } else if (item.type === 'potion') {
            player.hp = Math.min(player.maxHp, player.hp + 45);
            combat.addFloatingText(item.x, item.y, '+45 HP', '#4ade80', 15);
          } else if (item.type === 'energy') {
            player.energy = Math.min(player.maxEnergy, player.energy + 50);
            combat.addFloatingText(item.x, item.y, '+50 ENERGY', '#38bdf8', 15);
          } else if (item.type === 'chest') {
            this.coinsCollected += 75;
            global.SaveSystem.addCoins(75);
            global.SaveSystem.addGems(2);
            combat.addFloatingText(item.x, item.y, 'TREASURE +75 COINS!', '#fde047', 17);
          } else if (item.type === 'weaponDrop') {
            const keys = Object.keys(global.WeaponsSystem.catalog);
            const pick = keys[Math.min(keys.length - 1, 1 + Math.floor(Math.random() * (keys.length - 1)))];
            player.weaponId = pick;
            combat.addFloatingText(item.x, item.y, global.WeaponsSystem.getWeapon(pick).name, '#38bdf8', 16);
          }
        }
      }

      // Update Enemies & Boss
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        e.update(dt, player, this, combat);
        if (e.dead && e.deathTimer <= 0) {
          this.enemies.splice(i, 1);
        }
      }

      if (this.boss) {
        this.boss.update(dt, player, this, combat);
        if (this.boss.dead && this.boss.deathTimer <= 0) {
          this.boss = null;
          if (this.mode === 'story') {
            this.completed = true;
          } else if (this.mode === 'bossrush') {
            this.worldId += 1;
            if (this.worldId > 8) {
              this.completed = true;
            } else {
              this.boss = new global.Boss(this.worldId, this.width - 280, 420, 1 + this.worldId * 0.15);
            }
          }
        }
      }

      // Mode-Specific Progression Rules
      if (this.mode === 'endless' || this.mode === 'survival') {
        this.survivalTimer += dt;
        if (this.survivalTimer >= 120 || this.waveNumber >= 5) {
          global.SaveSystem.data.achievements.survivalLegend.unlocked = true;
        }
        if (this.enemies.length === 0) {
          this.spawnArenaWave(this.waveNumber + 1);
          if (global.UISystem) global.UISystem.showToast(`WAVE ${this.waveNumber} INCOMING!`);
        }
      } else if (!this.isBossLevel) {
        // Check Exit Shrine in Story / Challenge Mode
        if (Math.abs(player.x - this.exitX) < 56 && Math.abs(player.y - this.exitY) < 90) {
          this.completed = true;
        }
      }
    }

    drawBackground(ctx, camX) {
      // Sky Gradient
      const grad = ctx.createLinearGradient(0, 0, 0, 720);
      grad.addColorStop(0, this.theme.skyTop);
      grad.addColorStop(1, this.theme.skyBot);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1280, 720);

      // Far Parallax Layer (Silhouettes / Mountains / Towers)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      const offsetFar = -(camX * 0.2) % 320;
      for (let x = offsetFar - 320; x < 1400; x += 320) {
        ctx.beginPath();
        ctx.moveTo(x, 720);
        ctx.lineTo(x + 60, 260);
        ctx.lineTo(x + 180, 340);
        ctx.lineTo(x + 260, 210);
        ctx.lineTo(x + 320, 720);
        ctx.fill();
      }

      // Mid Parallax Layer (Pillars / Buildings / Trees)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      const offsetMid = -(camX * 0.45) % 220;
      for (let x = offsetMid - 220; x < 1400; x += 220) {
        ctx.fillRect(x + 30, 320, 95, 400);
        ctx.fillStyle = this.theme.accent;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(x + 48, 350, 16, 26);
        ctx.fillRect(x + 82, 350, 16, 26);
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      }
    }

    drawWorld(ctx) {
      // Climbable Ladders
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 4;
      for (const c of this.climbables) {
        ctx.strokeRect(c.x, c.y, c.w, c.h);
        for (let ry = c.y + 14; ry < c.y + c.h; ry += 18) {
          ctx.beginPath();
          ctx.moveTo(c.x, ry);
          ctx.lineTo(c.x + c.w, ry);
          ctx.stroke();
        }
      }

      // Platforms
      for (const p of this.platforms) {
        ctx.fillStyle = this.theme.ground;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = this.theme.accent;
        ctx.fillRect(p.x, p.y, p.w, 6);
      }

      // Hazards
      for (const h of this.hazards) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        for (let sx = h.x; sx < h.x + h.w; sx += 11) {
          ctx.moveTo(sx, h.y + h.h);
          ctx.lineTo(sx + 5.5, h.y);
          ctx.lineTo(sx + 11, h.y + h.h);
        }
        ctx.fill();
      }

      // Checkpoints
      for (const cp of this.checkpoints) {
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(cp.x, cp.y, 6, 64);
        ctx.fillStyle = cp.active ? '#22c55e' : '#ef4444';
        ctx.beginPath();
        ctx.moveTo(cp.x + 6, cp.y);
        ctx.lineTo(cp.x + 38, cp.y + 14);
        ctx.lineTo(cp.x + 6, cp.y + 28);
        ctx.fill();
      }

      // Destructibles
      for (const d of this.destructibles) {
        if (d.broken) continue;
        ctx.fillStyle = d.type === 'barrel' ? '#dc2626' : '#b45309';
        ctx.fillRect(d.x, d.y, d.w, d.h);
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2;
        ctx.strokeRect(d.x + 3, d.y + 3, d.w - 6, d.h - 6);
      }

      // Collectibles
      for (const c of this.collectibles) {
        if (c.taken) continue;
        ctx.save();
        if (c.type === 'gold' || c.type === 'silver') {
          ctx.fillStyle = c.type === 'gold' ? '#facc15' : '#e2e8f0';
          ctx.beginPath();
          ctx.arc(c.x, c.y, 9, 0, Math.PI * 2);
          ctx.fill();
        } else if (c.type === 'gem') {
          ctx.fillStyle = '#d946ef';
          ctx.beginPath();
          ctx.moveTo(c.x, c.y - 11);
          ctx.lineTo(c.x + 10, c.y);
          ctx.lineTo(c.x, c.y + 11);
          ctx.lineTo(c.x - 10, c.y);
          ctx.closePath();
          ctx.fill();
        } else if (c.type === 'potion' || c.type === 'energy') {
          ctx.fillStyle = c.type === 'potion' ? '#22c55e' : '#38bdf8';
          ctx.fillRect(c.x - 8, c.y - 10, 16, 20);
        } else if (c.type === 'chest' || c.type === 'weaponDrop') {
          ctx.fillStyle = c.type === 'chest' ? '#f59e0b' : '#38bdf8';
          ctx.fillRect(c.x - 14, c.y - 12, 28, 22);
        }
        ctx.restore();
      }

      // Exit Shrine Portal (on non-arena stages)
      if (!this.isBossLevel && this.mode !== 'endless' && this.mode !== 'survival') {
        ctx.save();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 5;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 18;
        ctx.strokeRect(this.exitX - 24, this.exitY - 20, 48, 84);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.28)';
        ctx.fillRect(this.exitX - 24, this.exitY - 20, 48, 84);
        ctx.restore();
      }

      // Enemies & Boss
      for (const e of this.enemies) e.draw(ctx);
      if (this.boss) this.boss.draw(ctx);
    }
  }

  global.WORLD_THEMES = WORLD_THEMES;
  global.Level = Level;
})(window);
