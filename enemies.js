/**
 * SHADOW WARRIOR – GAMERKIE EDITION
 * enemies.js - 12 Archetype Enemy Classes & Active Tactical AI
 */
(function (global) {
  'use strict';

  const ENEMY_CLASSES = {
    street:   { name: 'Street Fighter', hp: 55,  dmg: 10, speed: 155, range: 48, color: '#ef4444', w: 38, h: 64, score: 100 },
    runner:   { name: 'Fast Runner',    hp: 42,  dmg: 9,  speed: 245, range: 44, color: '#facc15', w: 36, h: 60, score: 120 },
    heavy:    { name: 'Heavy Fighter',  hp: 115, dmg: 18, speed: 105, range: 56, color: '#ea580c', w: 48, h: 74, score: 180 },
    shield:   { name: 'Shield Soldier', hp: 90,  dmg: 14, speed: 125, range: 52, color: '#3b82f6', w: 42, h: 66, score: 200, hasShield: true },
    weapon:   { name: 'Weapon Fighter', hp: 75,  dmg: 16, speed: 165, range: 72, color: '#a855f7', w: 38, h: 66, score: 160, hasBlade: true },
    ninja:    { name: 'Ninja Enemy',    hp: 68,  dmg: 15, speed: 235, range: 64, color: '#14b8a6', w: 36, h: 62, score: 220, canDodge: true },
    flying:   { name: 'Flying Drone',   hp: 48,  dmg: 12, speed: 190, range: 180, color: '#38bdf8', w: 40, h: 40, score: 170, flies: true },
    ranged:   { name: 'Ranged Gunner',  hp: 58,  dmg: 13, speed: 135, range: 340, color: '#ec4899', w: 38, h: 64, score: 190, ranged: true },
    explosive:{ name: 'Explosive Unit', hp: 40,  dmg: 38, speed: 230, range: 46, color: '#f97316', w: 36, h: 58, score: 150, explodes: true },
    elite:    { name: 'Elite Warrior',  hp: 145, dmg: 22, speed: 185, range: 76, color: '#e11d48', w: 44, h: 70, score: 300, hasBlade: true, canDodge: true },
    miniboss: { name: 'Stage Enforcer', hp: 260, dmg: 28, speed: 160, range: 86, color: '#eab308', w: 54, h: 82, score: 600, hasBlade: true }
  };

  class Enemy {
    constructor(type, x, y, worldScale) {
      const cfg = ENEMY_CLASSES[type] || ENEMY_CLASSES.street;
      const mult = worldScale || 1;
      this.type = type;
      this.name = cfg.name;
      this.x = x;
      this.y = y;
      this.spawnX = x;
      this.w = cfg.w;
      this.h = cfg.h;
      this.vx = 0;
      this.vy = 0;
      this.facing = -1;

      this.maxHp = Math.round(cfg.hp * mult);
      this.hp = this.maxHp;
      this.damage = Math.round(cfg.dmg * Math.sqrt(mult));
      this.speed = cfg.speed;
      this.attackRange = cfg.range;
      this.color = cfg.color;
      this.scoreValue = cfg.score;

      this.hasShield = Boolean(cfg.hasShield);
      this.hasBlade = Boolean(cfg.hasBlade);
      this.canDodge = Boolean(cfg.canDodge);
      this.flies = Boolean(cfg.flies);
      this.ranged = Boolean(cfg.ranged);
      this.explodes = Boolean(cfg.explodes);

      this.state = 'patrol';
      this.patrolDir = Math.random() < 0.5 ? 1 : -1;
      this.animTimer = Math.random() * 5;
      this.attackCooldown = 0;
      this.windupTimer = 0;
      this.staggerTimer = 0;
      this.dodgeCooldown = 0;
      this.onGround = false;
      this.dead = false;
      this.deathTimer = 0;
    }

    update(dt, player, level, combat) {
      this.animTimer += dt;
      if (this.attackCooldown > 0) this.attackCooldown -= dt;
      if (this.dodgeCooldown > 0) this.dodgeCooldown -= dt;

      if (this.dead) {
        this.deathTimer -= dt;
        return;
      }

      if (this.staggerTimer > 0) {
        this.staggerTimer -= dt;
        this.vx *= 0.86;
        this.applyPhysics(dt, level);
        return;
      }

      const dx = (player.x + player.w / 2) - (this.x + this.w / 2);
      const dy = (player.y + player.h / 2) - (this.y + this.h / 2);
      const dist = Math.hypot(dx, dy);

      // Active Attack Windup execution
      if (this.windupTimer > 0) {
        this.windupTimer -= dt;
        this.vx *= 0.75;
        if (this.windupTimer <= 0) {
          this.performAttack(player, level, combat);
        }
        this.applyPhysics(dt, level);
        return;
      }

      // AI State Transitions: Patrol -> Detect -> Chase -> Attack / Block / Dodge
      if (dist < 480 && player.hp > 0) {
        this.facing = dx >= 0 ? 1 : -1;

        // Ninja / Elite reactive dodge when player attacks nearby
        if (this.canDodge && this.dodgeCooldown <= 0 && player.attackTimer > 0 && Math.abs(dx) < 115) {
          this.vx = -this.facing * 310;
          this.vy = -210;
          this.dodgeCooldown = 2.8;
          combat.spawnDust(this.x + this.w / 2, this.y + this.h, 6);
          this.applyPhysics(dt, level);
          return;
        }

        if (Math.abs(dx) <= this.attackRange && Math.abs(dy) < 95) {
          this.vx = 0;
          if (this.attackCooldown <= 0) {
            this.state = 'attack';
            this.windupTimer = this.type === 'heavy' ? 0.42 : 0.25;
            this.attackCooldown = this.ranged ? 1.65 : 1.1;
          } else {
            this.state = this.hasShield ? 'block' : 'idle';
          }
        } else {
          this.state = 'chase';
          this.vx = this.facing * this.speed;

          // Jump over obstacles or up to elevated player
          if (this.onGround && !this.flies && (dy < -55 || this.blockedHorizontally) && Math.random() < 0.06) {
            this.vy = -540;
            this.onGround = false;
          }
        }
      } else {
        // Patrol Movement around spawn region
        this.state = 'patrol';
        this.facing = this.patrolDir;
        this.vx = this.patrolDir * (this.speed * 0.55);
        if (Math.abs(this.x - this.spawnX) > 150 || this.blockedHorizontally) {
          this.patrolDir *= -1;
        }
      }

      if (this.flies) {
        const targetY = player.y - 45 + Math.sin(this.animTimer * 3.5) * 24;
        this.vy = (targetY - this.y) * 3.0;
      }

      this.applyPhysics(dt, level);
    }

    performAttack(player, level, combat) {
      if (this.explodes) {
        combat.spawnExplosion(this.x + this.w / 2, this.y + this.h / 2, 115, this.damage, false, level, player);
        this.hp = 0;
        this.die(level, combat, player);
        return;
      }

      if (this.ranged || this.flies) {
        const angle = Math.atan2(
          (player.y + player.h / 2) - (this.y + this.h / 2),
          (player.x + player.w / 2) - (this.x + this.w / 2)
        );
        combat.spawnProjectile({
          x: this.x + this.w / 2 + this.facing * 18,
          y: this.y + this.h * 0.42,
          vx: Math.cos(angle) * 390,
          vy: Math.sin(angle) * 390,
          r: 7,
          damage: this.damage,
          color: this.color,
          fromPlayer: false
        });
        return;
      }

      // Melee strike check
      const reach = this.attackRange + 14;
      const hitX = this.facing > 0 ? this.x + this.w / 2 : this.x + this.w / 2 - reach;
      const hitbox = { x: hitX, y: this.y, w: reach, h: this.h };
      if (combat.rectsOverlap(hitbox, player)) {
        player.takeDamage(this.damage, this.x + this.w / 2, combat);
      }
    }

    takeDamage(amount, sourceX, combat, player, ignoreShield, knockback, isCrit) {
      if (this.dead) return false;

      // Directional Shield Check for Shield Soldiers
      const hitFromFront = (sourceX > this.x + this.w / 2 && this.facing > 0) ||
                           (sourceX < this.x + this.w / 2 && this.facing < 0);
      if (this.hasShield && hitFromFront && !ignoreShield && this.staggerTimer <= 0) {
        combat.spawnSparks(this.x + this.w / 2, this.y + this.h / 2, '#60a5fa', 8);
        combat.addFloatingText(this.x + this.w / 2, this.y - 6, 'GUARD', '#60a5fa', 13);
        this.vx = -this.facing * 90;
        global.AudioSystem.sfxEnemyHit();
        return false;
      }

      this.hp -= amount;
      this.staggerTimer = this.type === 'miniboss' ? 0.14 : 0.28;
      this.windupTimer = 0;

      const pushDir = this.x + this.w / 2 >= sourceX ? 1 : -1;
      const kb = (knockback || 180) * (this.type === 'heavy' || this.type === 'miniboss' ? 0.45 : 1);
      this.vx = pushDir * kb;
      if (!this.flies) this.vy = -170;

      combat.spawnSparks(this.x + this.w / 2, this.y + this.h * 0.45, isCrit ? '#fde047' : '#ffffff', isCrit ? 14 : 7);
      combat.addFloatingText(
        this.x + this.w / 2,
        this.y - 8,
        isCrit ? amount + ' CRIT!' : amount,
        isCrit ? '#fde047' : '#f8fafc',
        isCrit ? 19 : 15
      );
      global.AudioSystem.sfxEnemyHit();

      if (this.hp <= 0) {
        this.die(player.currentLevelRef, combat, player);
      }
      return true;
    }

    die(level, combat, player) {
      this.dead = true;
      this.deathTimer = 0.35;
      combat.spawnSparks(this.x + this.w / 2, this.y + this.h / 2, this.color, 18);
      global.SaveSystem.recordEnemyKill(this.type === 'miniboss');
      if (level) {
        level.score += this.scoreValue;
        level.kills += 1;
        level.spawnEnemyLoot(this.x + this.w / 2, this.y + this.h / 2, this.type === 'miniboss' ? 5 : 2);
      }
    }

    applyPhysics(dt, level) {
      if (!this.flies) {
        this.vy = Math.min(920, this.vy + 1600 * dt);
      }
      this.blockedHorizontally = false;
      this.x += this.vx * dt;

      for (const p of level.platforms) {
        if (p.oneWay) continue;
        if (this.x < p.x + p.w && this.x + this.w > p.x && this.y < p.y + p.h && this.y + this.h > p.y) {
          if (this.vx > 0) this.x = p.x - this.w;
          else if (this.vx < 0) this.x = p.x + p.w;
          this.vx = 0;
          this.blockedHorizontally = true;
        }
      }

      const prevBottom = this.y + this.h;
      this.y += this.vy * dt;
      this.onGround = false;

      if (!this.flies) {
        for (const p of level.platforms) {
          if (this.x < p.x + p.w && this.x + this.w > p.x && this.y < p.y + p.h && this.y + this.h > p.y) {
            if (this.vy >= 0 && prevBottom <= p.y + 20) {
              this.y = p.y - this.h;
              this.vy = 0;
              this.onGround = true;
            }
          }
        }
      }
    }

    draw(ctx) {
      ctx.save();
      if (this.dead) {
        ctx.globalAlpha = Math.max(0, this.deathTimer / 0.35);
      }

      const cx = this.x + this.w / 2;
      const cy = this.y + this.h / 2;
      ctx.translate(cx, cy);
      ctx.scale(this.facing, 1);

      if (this.flies) {
        // Flying Drone Visual
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(7, 0, 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const swing = this.state === 'patrol' || this.state === 'chase'
          ? Math.sin(this.animTimer * 11) * 0.5
          : 0;

        // Legs
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-8 + swing * 6, 10, 8, 20);
        ctx.fillRect(2 - swing * 6, 10, 8, 20);

        // Body Armor
        ctx.fillStyle = this.staggerTimer > 0 ? '#ffffff' : this.color;
        ctx.beginPath();
        ctx.roundRect(-this.w * 0.34, -14, this.w * 0.68, 26, 5);
        ctx.fill();

        // Head & Visor
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(0, -22, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = this.windupTimer > 0 ? '#fde047' : '#ef4444';
        ctx.fillRect(2, -25, 7, 4);

        // Weapon / Shield Attachments
        if (this.hasShield) {
          ctx.fillStyle = '#1d4ed8';
          ctx.strokeStyle = '#93c5fd';
          ctx.lineWidth = 2;
          ctx.fillRect(10, -18, 8, 38);
          ctx.strokeRect(10, -18, 8, 38);
        } else if (this.hasBlade) {
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(10, -6, 24, 4);
        }
      }
      ctx.restore();

      // Overhead Enemy HP Bar
      if (!this.dead && this.hp < this.maxHp) {
        const bw = 42;
        const bx = this.x + this.w / 2 - bw / 2;
        const by = this.y - 12;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(bx, by, bw, 5);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(bx, by, bw * Math.max(0, this.hp / this.maxHp), 5);
      }
    }
  }

  global.ENEMY_CLASSES = ENEMY_CLASSES;
  global.Enemy = Enemy;
})(window);
