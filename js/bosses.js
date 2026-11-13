/**
 * SHADOW WARRIOR – GAMERKIE EDITION
 * bosses.js - 8 World Bosses with Multi-Phase AI & 7 Signature Attack Patterns
 */
(function (global) {
  'use strict';

  const WORLD_BOSS_ROSTER = {
    1: { name: 'REX "KINGPIN" VANCE',     hp: 650,  dmg: 22, color: '#ef4444', accent: '#facc15' },
    2: { name: 'SYLVAN BEHEMOTH',         hp: 850,  dmg: 25, color: '#15803d', accent: '#86efac' },
    3: { name: 'GENERAL IRONCLAD',        hp: 1100, dmg: 28, color: '#475569', accent: '#38bdf8' },
    4: { name: 'PHARAOH SCORPIUS',        hp: 1350, dmg: 32, color: '#d97706', accent: '#fde047' },
    5: { name: 'FROST WYRM YMIR',         hp: 1600, dmg: 35, color: '#0284c7', accent: '#bae6fd' },
    6: { name: 'OMEGA-CORE MECH',         hp: 1900, dmg: 38, color: '#7c3aed', accent: '#f43f5e' },
    7: { name: 'LORD MALAKOR, DARK KNIGHT', hp: 2250, dmg: 42, color: '#991b1b', accent: '#f97316' },
    8: { name: 'EMPEROR VAELOR, AVATAR OF SHADOW', hp: 2800, dmg: 48, color: '#312e81', accent: '#c084fc' }
  };

  const BOSS_ATTACK_PATTERNS = [
    'groundSmash',
    'heavyPunch',
    'jumpAttack',
    'projectileAttack',
    'chargingAttack',
    'areaDamage',
    'specialFinalAttack'
  ];

  class Boss {
    constructor(worldId, x, y, scaleMult) {
      const templateId = ((worldId - 1) % 8) + 1;
      const cfg = WORLD_BOSS_ROSTER[templateId];
      const mult = (scaleMult || 1) * (worldId > 8 ? 1 + (worldId - 8) * 0.25 : 1);

      this.worldId = worldId;
      this.name = worldId > 8 ? `${cfg.name} MK-${worldId - 7}` : cfg.name;
      this.x = x;
      this.y = y;
      this.w = 78;
      this.h = 112;
      this.vx = 0;
      this.vy = 0;
      this.facing = -1;

      this.maxHp = Math.round(cfg.hp * mult);
      this.hp = this.maxHp;
      this.damage = Math.round(cfg.dmg * Math.sqrt(mult));
      this.color = cfg.color;
      this.accent = cfg.accent;

      this.phase = 1;
      this.currentPattern = 'idle';
      this.patternTimer = 0;
      this.cooldown = 1.4;
      this.animTimer = 0;
      this.onGround = false;
      this.flashTimer = 0;
      this.dead = false;
      this.deathTimer = 0;
    }

    update(dt, player, level, combat) {
      this.animTimer += dt;
      if (this.flashTimer > 0) this.flashTimer -= dt;

      if (this.dead) {
        this.deathTimer -= dt;
        return;
      }

      // Check Phase Transitions
      const hpRatio = this.hp / this.maxHp;
      const newPhase = hpRatio <= 0.30 ? 3 : (hpRatio <= 0.65 ? 2 : 1);
      if (newPhase !== this.phase) {
        this.phase = newPhase;
        global.AudioSystem.sfxBossRoar();
        combat.triggerShake(12, 0.35);
        combat.spawnSparks(this.x + this.w / 2, this.y + this.h / 2, this.accent, 28);
        combat.addFloatingText(this.x + this.w / 2, this.y - 20, `PHASE ${this.phase} ENRAGED!`, '#fde047', 20);
      }

      const dx = (player.x + player.w / 2) - (this.x + this.w / 2);
      if (this.currentPattern === 'idle') {
        this.facing = dx >= 0 ? 1 : -1;
        if (Math.abs(dx) > 130) {
          this.vx = this.facing * (145 + this.phase * 25);
        } else {
          this.vx *= 0.8;
        }

        this.cooldown -= dt;
        if (this.cooldown <= 0) {
          this.selectNextAttack(player, combat);
        }
      } else {
        this.executeActivePattern(dt, player, level, combat);
      }

      this.applyPhysics(dt, level);
    }

    selectNextAttack(player, combat) {
      const pool = this.phase === 1
        ? ['heavyPunch', 'groundSmash', 'projectileAttack', 'jumpAttack']
        : (this.phase === 2
          ? ['heavyPunch', 'groundSmash', 'projectileAttack', 'jumpAttack', 'chargingAttack', 'areaDamage']
          : BOSS_ATTACK_PATTERNS);

      this.currentPattern = pool[Math.floor(Math.random() * pool.length)];
      this.patternTimer = 0.85;
      this.SubTriggered = false;

      if (this.currentPattern === 'jumpAttack') {
        this.vy = -760;
        this.vx = ((player.x - this.x) * 1.15);
      }
      combat.addFloatingText(this.x + this.w / 2, this.y - 16, this.currentPattern.toUpperCase(), this.accent, 14);
    }

    executeActivePattern(dt, player, level, combat) {
      this.patternTimer -= dt;
      const cx = this.x + this.w / 2;
      const cy = this.y + this.h / 2;

      if (this.currentPattern === 'chargingAttack') {
        this.vx = this.facing * 470;
        if (combat.rectsOverlap(this, player)) {
          player.takeDamage(this.damage * 1.15, cx, combat);
        }
      } else if (this.currentPattern === 'jumpAttack') {
        if (this.onGround && this.patternTimer < 0.55 && !this.SubTriggered) {
          this.SubTriggered = true;
          combat.spawnExplosion(cx, this.y + this.h, 150, this.damage * 1.2, false, level, player);
        }
      } else if (this.patternTimer <= 0.3 && !this.SubTriggered) {
        this.SubTriggered = true;

        if (this.currentPattern === 'heavyPunch') {
          this.vx = this.facing * 260;
          const reach = 115;
          const hb = {
            x: this.facing > 0 ? cx : cx - reach,
            y: this.y,
            w: reach,
            h: this.h
          };
          if (combat.rectsOverlap(hb, player)) {
            player.takeDamage(this.damage * 1.25, cx, combat);
          }
        } else if (this.currentPattern === 'groundSmash') {
          combat.triggerShake(14, 0.3);
          for (const dir of [-1, 1]) {
            combat.spawnProjectile({
              x: cx + dir * 30,
              y: this.y + this.h - 16,
              vx: dir * 420,
              r: 15,
              damage: this.damage,
              color: this.accent,
              fromPlayer: false
            });
          }
        } else if (this.currentPattern === 'projectileAttack') {
          for (let i = -1; i <= 1; i++) {
            combat.spawnProjectile({
              x: cx + this.facing * 32,
              y: cy - 10,
              vx: this.facing * 430,
              vy: i * 95,
              r: 10,
              damage: this.damage * 0.9,
              color: this.accent,
              fromPlayer: false
            });
          }
        } else if (this.currentPattern === 'areaDamage') {
          combat.spawnExplosion(cx, cy, 185, this.damage * 1.3, false, level, player);
        } else if (this.currentPattern === 'specialFinalAttack') {
          global.AudioSystem.sfxBossRoar();
          for (let i = 0; i < 8; i++) {
            const ang = (Math.PI * 2 * i) / 8;
            combat.spawnProjectile({
              x: cx,
              y: cy,
              vx: Math.cos(ang) * 380,
              vy: Math.sin(ang) * 380,
              r: 12,
              damage: this.damage * 1.15,
              color: '#f43f5e',
              fromPlayer: false
            });
          }
        }
      }

      if (this.patternTimer <= 0) {
        this.currentPattern = 'idle';
        this.vx = 0;
        this.cooldown = Math.max(0.55, 1.45 - this.phase * 0.25);
      }
    }

    takeDamage(amount, sourceX, combat, player, ignoreShield, knockback, isCrit) {
      if (this.dead) return false;
      this.hp = Math.max(0, this.hp - amount);
      this.flashTimer = 0.12;

      combat.spawnSparks(this.x + this.w / 2, this.y + this.h * 0.4, this.accent, isCrit ? 16 : 9);
      combat.addFloatingText(
        this.x + this.w / 2,
        this.y - 12,
        isCrit ? amount + ' CRIT!' : amount,
        isCrit ? '#fde047' : '#ffffff',
        isCrit ? 21 : 16
      );
      global.AudioSystem.sfxEnemyHit();

      if (this.hp <= 0) {
        this.dead = true;
        this.deathTimer = 1.0;
        global.AudioSystem.sfxExplosion();
        combat.triggerShake(18, 0.55);
        combat.spawnSparks(this.x + this.w / 2, this.y + this.h / 2, '#fde047', 40);
        global.SaveSystem.recordEnemyKill(true);
        if (player.currentLevelRef) {
          player.currentLevelRef.score += 2000 * this.worldId;
          player.currentLevelRef.kills += 1;
          player.currentLevelRef.spawnEnemyLoot(this.x + this.w / 2, this.y + this.h / 2, 12);
        }
      }
      return true;
    }

    applyPhysics(dt, level) {
      this.vy = Math.min(960, this.vy + 1650 * dt);
      this.x += this.vx * dt;
      this.x = Math.max(40, Math.min(level.width - this.w - 40, this.x));

      const prevBottom = this.y + this.h;
      this.y += this.vy * dt;
      this.onGround = false;

      for (const p of level.platforms) {
        if (this.x < p.x + p.w && this.x + this.w > p.x && this.y < p.y + p.h && this.y + this.h > p.y) {
          if (this.vy >= 0 && prevBottom <= p.y + 24) {
            this.y = p.y - this.h;
            this.vy = 0;
            this.onGround = true;
          }
        }
      }
    }

    draw(ctx) {
      ctx.save();
      if (this.dead) {
        ctx.globalAlpha = Math.max(0, this.deathTimer);
      }

      const cx = this.x + this.w / 2;
      const cy = this.y + this.h / 2;
      ctx.translate(cx, cy);
      ctx.scale(this.facing, 1);

      // Aura glow in Phase 2 & 3
      if (this.phase >= 2) {
        ctx.strokeStyle = this.accent;
        ctx.lineWidth = 3;
        ctx.shadowColor = this.accent;
        ctx.shadowBlur = 16;
        ctx.strokeRect(-this.w / 2 - 4, -this.h / 2 - 4, this.w + 8, this.h + 8);
      }

      // Armored Legs
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-22, 18, 16, 36);
      ctx.fillRect(6, 18, 16, 36);

      // Massive Armored Torso
      ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : this.color;
      ctx.beginPath();
      ctx.roundRect(-34, -32, 68, 54, 10);
      ctx.fill();

      // Shoulder Pauldrons
      ctx.fillStyle = this.accent;
      ctx.fillRect(-42, -34, 18, 18);
      ctx.fillRect(24, -34, 18, 18);

      // Boss Head & Horned Crown
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0, -44, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = this.accent;
      ctx.fillRect(3, -48, 10, 5);

      ctx.restore();
    }
  }

  global.WORLD_BOSS_ROSTER = WORLD_BOSS_ROSTER;
  global.Boss = Boss;
})(window);
