/**
 * SHADOW WARRIOR – GAMERKIE EDITION
 * combat.js - Hitboxes, Combo Resolver, Projectiles, Particles & Screen Shake
 */
(function (global) {
  'use strict';

  class CombatSystem {
    constructor() {
      this.particles = [];
      this.floatingTexts = [];
      this.projectiles = [];
      this.shakeTime = 0;
      this.shakeMagnitude = 0;
      this.hitStopTimer = 0;
    }

    reset() {
      this.particles.length = 0;
      this.floatingTexts.length = 0;
      this.projectiles.length = 0;
      this.shakeTime = 0;
      this.shakeMagnitude = 0;
      this.hitStopTimer = 0;
    }

    triggerShake(mag, duration) {
      this.shakeMagnitude = Math.max(this.shakeMagnitude, mag);
      this.shakeTime = Math.max(this.shakeTime, duration);
    }

    addFloatingText(x, y, text, color, size) {
      this.floatingTexts.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y,
        vy: -55,
        text: String(text),
        color: color || '#ffffff',
        size: size || 16,
        life: 0.75,
        maxLife: 0.75
      });
    }

    spawnDust(x, y, count) {
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 110,
          vy: -Math.random() * 65 - 15,
          r: Math.random() * 4 + 2,
          color: 'rgba(203, 213, 225, 0.65)',
          life: 0.35 + Math.random() * 0.2,
          gravity: 120
        });
      }
    }

    spawnSparks(x, y, color, count) {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 80 + Math.random() * 190;
        this.particles.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          r: Math.random() * 3.5 + 1.5,
          color: color || '#fde047',
          life: 0.25 + Math.random() * 0.2,
          gravity: 340
        });
      }
    }

    spawnExplosion(x, y, radius, damage, fromPlayer, level, player) {
      global.AudioSystem.sfxExplosion();
      this.triggerShake(12, 0.28);
      this.spawnSparks(x, y, '#f97316', 24);
      this.spawnSparks(x, y, '#fde047', 14);

      if (fromPlayer) {
        const targets = level.enemies.concat(level.boss ? [level.boss] : []);
        for (const t of targets) {
          if (!t || t.dead) continue;
          const dx = (t.x + t.w / 2) - x;
          const dy = (t.y + t.h / 2) - y;
          if (Math.hypot(dx, dy) <= radius) {
            t.takeDamage(damage, x, this, player, true);
          }
        }
      } else {
        const dx = (player.x + player.w / 2) - x;
        const dy = (player.y + player.h / 2) - y;
        if (Math.hypot(dx, dy) <= radius) {
          player.takeDamage(damage, x, this);
        }
      }
    }

    spawnProjectile(opts) {
      this.projectiles.push({
        x: opts.x,
        y: opts.y,
        vx: opts.vx,
        vy: opts.vy || 0,
        r: opts.r || 8,
        damage: opts.damage || 15,
        color: opts.color || '#38bdf8',
        fromPlayer: Boolean(opts.fromPlayer),
        pierce: Boolean(opts.pierce),
        life: opts.life || 2.2
      });
    }

    executePlayerAttack(player, level) {
      const wStats = global.WeaponsSystem.getEffectiveStats(player.weaponId);
      let baseDmg = player.stats.punchDamage;
      let reach = wStats.range;
      let knockback = 180;
      let ignoreShield = wStats.id === 'energysword' || wStats.id === 'dragonblade';

      if (player.attackType === 'kick') {
        baseDmg = player.stats.kickDamage;
        knockback = 250;
      } else if (player.attackType === 'weapon' || player.attackType === 'airattack') {
        baseDmg = (player.stats.punchDamage + wStats.damage) * player.stats.weaponBonus;
        if (wStats.id === 'bat') knockback = 340;
      } else if (player.attackType === 'groundslam') {
        baseDmg = player.stats.kickDamage * 1.65;
        reach = 135;
        knockback = 320;
        ignoreShield = true;
        this.triggerShake(10, 0.22);
        this.spawnSparks(player.x + player.w / 2, player.y + player.h, '#f97316', 18);
      } else if (player.attackType === 'special') {
        baseDmg = (player.stats.kickDamage + wStats.damage) * 1.9 * player.stats.specialPower;
        reach = 150;
        knockback = 360;
        ignoreShield = true;
        this.triggerShake(11, 0.25);
        this.spawnProjectile({
          x: player.x + player.w / 2 + player.facing * 24,
          y: player.y + 28,
          vx: player.facing * 560,
          r: 16,
          damage: Math.round(baseDmg * 0.85),
          color: player.charConfig.accentColor,
          fromPlayer: true,
          pierce: true,
          life: 1.1
        });
      }

      // Dragonblade bonus wave projectile
      if (wStats.id === 'dragonblade' && player.attackType === 'weapon') {
        this.spawnProjectile({
          x: player.x + player.w / 2 + player.facing * 24,
          y: player.y + 30,
          vx: player.facing * 520,
          r: 12,
          damage: Math.round(baseDmg * 0.55),
          color: '#ef4444',
          fromPlayer: true,
          pierce: false,
          life: 0.75
        });
      }

      // Combo Finisher multiplier on 3rd, 4th, 5th hits
      if (player.comboStep === 3) baseDmg *= 1.2;
      if (player.comboStep === 4) baseDmg *= 1.35;
      if (player.comboStep === 5) {
        baseDmg *= 1.65;
        knockback *= 1.5;
      }

      const hitbox = {
        x: player.attackType === 'groundslam'
          ? player.x + player.w / 2 - reach
          : (player.facing > 0 ? player.x + player.w / 2 : player.x + player.w / 2 - reach),
        y: player.y - 12,
        w: player.attackType === 'groundslam' ? reach * 2 : reach,
        h: player.h + 24
      };

      // Check Destructible Objects (Crates & Explosive Barrels)
      for (const obj of level.destructibles) {
        if (!obj.broken && this.rectsOverlap(hitbox, obj)) {
          obj.hp -= baseDmg;
          this.spawnSparks(obj.x + obj.w / 2, obj.y + obj.h / 2, '#fbbf24', 8);
          if (obj.hp <= 0) {
            obj.broken = true;
            if (obj.type === 'barrel') {
              this.spawnExplosion(obj.x + obj.w / 2, obj.y + obj.h / 2, 130, 55, true, level, player);
            } else {
              level.spawnDropFromCrate(obj.x + obj.w / 2, obj.y);
            }
          }
        }
      }

      // Check Enemies & Boss
      const targets = level.enemies.concat(level.boss ? [level.boss] : []);
      let hitAny = false;
      for (const enemy of targets) {
        if (!enemy || enemy.dead) continue;
        if (this.rectsOverlap(hitbox, enemy)) {
          const critChance = (wStats.id === 'katana' ? 0.28 : 0.14) + (player.charConfig.id === 'valkyra' ? 0.12 : 0);
          const isCrit = Math.random() < critChance || player.comboStep === 5;
          const finalDmg = Math.round(baseDmg * (isCrit ? player.stats.critMultiplier : 1));

          const landed = enemy.takeDamage(finalDmg, player.x + player.w / 2, this, player, ignoreShield, knockback, isCrit);
          if (landed) {
            hitAny = true;
          }
        }
      }

      if (hitAny) {
        player.comboStreak += 1;
        player.comboResetTimer = 2.6;
        global.SaveSystem.recordCombo(player.comboStreak);
        this.hitStopTimer = 0.032;
        this.triggerShake(player.comboStep === 5 ? 9 : 4, 0.12);
      }
    }

    update(dt, level, player) {
      if (this.shakeTime > 0) {
        this.shakeTime -= dt;
        if (this.shakeTime <= 0) this.shakeMagnitude = 0;
      }

      // Update Projectiles
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;

        if (p.life <= 0) {
          this.projectiles.splice(i, 1);
          continue;
        }

        const pRect = { x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 };
        if (p.fromPlayer) {
          const targets = level.enemies.concat(level.boss ? [level.boss] : []);
          let consumed = false;
          for (const t of targets) {
            if (!t || t.dead) continue;
            if (this.rectsOverlap(pRect, t)) {
              t.takeDamage(p.damage, p.x, this, player, true, 220, false);
              if (!p.pierce) {
                consumed = true;
                break;
              }
            }
          }
          if (consumed) this.projectiles.splice(i, 1);
        } else {
          if (this.rectsOverlap(pRect, player)) {
            player.takeDamage(p.damage, p.x, this);
            this.projectiles.splice(i, 1);
          }
        }
      }

      // Update Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vy += (pt.gravity || 0) * dt;
        pt.life -= dt;
        if (pt.life <= 0) this.particles.splice(i, 1);
      }

      // Update Floating Damage Numbers
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.y += ft.vy * dt;
        ft.life -= dt;
        if (ft.life <= 0) this.floatingTexts.splice(i, 1);
      }
    }

    draw(ctx) {
      // Draw Projectiles
      for (const p of this.projectiles) {
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw Particles
      for (const pt of this.particles) {
        ctx.save();
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = Math.max(0, Math.min(1, pt.life * 2.5));
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw Floating Combat Numbers
      for (const ft of this.floatingTexts) {
        ctx.save();
        ctx.font = `900 ${ft.size}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }
    }

    rectsOverlap(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }
  }

  global.CombatSystem = CombatSystem;
})(window);
