/**
 * SHADOW WARRIOR – GAMERKIE EDITION
 * player.js - Original Animated 2D Warrior Roster, Physics & 16-Ability Controller
 */
(function (global) {
  'use strict';

  const CHARACTER_ROSTER = {
    kaelen: {
      id: 'kaelen',
      name: 'Kaelen (Shadow Striker)',
      style: 'Balanced Shinobi Martial Artist',
      specialName: 'Shadow Tempest',
      costCoins: 0,
      hp: 125,
      atk: 18,
      def: 0.10,
      speed: 300,
      jump: 635,
      energy: 100,
      primaryColor: '#1e293b',
      accentColor: '#ef4444',
      skinColor: '#f1c27d'
    },
    valkyra: {
      id: 'valkyra',
      name: 'Valkyra (Crimson Blade)',
      style: 'High-Speed Aerial & Crit Assassin',
      specialName: 'Phoenix Dive',
      costCoins: 1500,
      hp: 110,
      atk: 21,
      def: 0.08,
      speed: 335,
      jump: 670,
      energy: 115,
      primaryColor: '#7f1d1d',
      accentColor: '#facc15',
      skinColor: '#ffdbac'
    },
    titanus: {
      id: 'titanus',
      name: 'Titanus (Iron Brawler)',
      style: 'Heavy Armored Juggernaut',
      specialName: 'Seismic Cataclysm',
      costCoins: 2500,
      hp: 165,
      atk: 24,
      def: 0.20,
      speed: 270,
      jump: 605,
      energy: 100,
      primaryColor: '#334155',
      accentColor: '#f97316',
      skinColor: '#e0ac69'
    },
    zerox: {
      id: 'zerox',
      name: 'Zero-X (Phantom Ninja)',
      style: 'Cybernetic Energy Master',
      specialName: 'Void Obliteration',
      costCoins: 4000,
      hp: 130,
      atk: 25,
      def: 0.14,
      speed: 325,
      jump: 650,
      energy: 140,
      primaryColor: '#0f172a',
      accentColor: '#06b6d4',
      skinColor: '#cbd5e1'
    }
  };

  class Player {
    constructor(x, y) {
      const charId = (global.SaveSystem && global.SaveSystem.data.selectedCharacter) || 'kaelen';
      this.charConfig = CHARACTER_ROSTER[charId] || CHARACTER_ROSTER.kaelen;
      this.stats = global.SaveSystem.getComputedPlayerStats(this.charConfig);

      this.x = x;
      this.y = y;
      this.w = 40;
      this.h = 68;
      this.vx = 0;
      this.vy = 0;
      this.facing = 1;

      this.hp = this.stats.maxHealth;
      this.maxHp = this.stats.maxHealth;
      this.energy = this.stats.maxEnergy;
      this.maxEnergy = this.stats.maxEnergy;

      this.onGround = false;
      this.onWall = 0;
      this.Climbing = false;
      this.jumpsLeft = 2;
      this.coyoteTimer = 0;
      this.jumpBuffer = 0;

      // Animation & State Machine (19 states)
      this.state = 'idle';
      this.animTimer = 0;
      this.attackTimer = 0;
      this.attackDuration = 0;
      this.attackType = 'none';
      this.hasDealtHit = false;
      this.comboStep = 0;
      this.comboWindow = 0;
      this.comboStreak = 0;
      this.comboResetTimer = 0;

      this.dodgeTimer = 0;
      this.slideTimer = 0;
      this.invulnTimer = 0;
      this.hurtTimer = 0;
      this.blocking = false;
      this.crouching = false;

      this.afterimages = [];
      this.weaponId = (global.SaveSystem && global.SaveSystem.data.equippedWeapon) || 'fists';
    }

    refreshEquipment() {
      const charId = (global.SaveSystem && global.SaveSystem.data.selectedCharacter) || 'kaelen';
      this.charConfig = CHARACTER_ROSTER[charId] || CHARACTER_ROSTER.kaelen;
      this.stats = global.SaveSystem.getComputedPlayerStats(this.charConfig);
      this.weaponId = (global.SaveSystem && global.SaveSystem.data.equippedWeapon) || 'fists';
      this.maxHp = this.stats.maxHealth;
      this.maxEnergy = this.stats.maxEnergy;
    }

    update(dt, input, level, combat) {
      this.animTimer += dt;

      // Regenerate special energy
      this.energy = Math.min(this.maxEnergy, this.energy + 9 * dt);

      if (this.invulnTimer > 0) this.invulnTimer -= dt;
      if (this.coyoteTimer > 0) this.coyoteTimer -= dt;
      if (this.jumpBuffer > 0) this.jumpBuffer -= dt;
      if (this.comboWindow > 0) {
        this.comboWindow -= dt;
        if (this.comboWindow <= 0) this.comboStep = 0;
      }
      if (this.comboResetTimer > 0) {
        this.comboResetTimer -= dt;
        if (this.comboResetTimer <= 0) this.comboStreak = 0;
      }

      // Update afterimages
      for (let i = this.afterimages.length - 1; i >= 0; i--) {
        this.afterimages[i].alpha -= dt * 3.2;
        if (this.afterimages[i].alpha <= 0) this.afterimages.splice(i, 1);
      }

      if (this.hp <= 0) {
        this.state = 'defeat';
        this.vx = 0;
        this.applyGravityAndCollide(dt, level);
        return;
      }

      if (this.state === 'victory') {
        this.vx = 0;
        this.applyGravityAndCollide(dt, level);
        return;
      }

      // Hurt / Knockback recovery
      if (this.hurtTimer > 0) {
        this.hurtTimer -= dt;
        this.state = this.hurtTimer > 0.18 ? 'knockback' : 'damage';
        this.applyGravityAndCollide(dt, level);
        return;
      }

      // Dodge & Slide active movement
      if (this.dodgeTimer > 0) {
        this.dodgeTimer -= dt;
        this.state = this.slideTimer > 0 ? 'slide' : 'dodge';
        if (this.slideTimer > 0) this.slideTimer -= dt;
        this.vx = this.facing * (this.stats.moveSpeed * 1.85);
        if (Math.random() < 0.6) {
          this.afterimages.push({ x: this.x, y: this.y, facing: this.facing, alpha: 0.55 });
        }
        this.applyGravityAndCollide(dt, level);
        return;
      }

      // Active Attack execution
      if (this.attackTimer > 0) {
        this.attackTimer -= dt;
        if (this.attackType === 'groundslam') {
          this.vy = 920;
          this.vx = 0;
          if (this.onGround && !this.hasDealtHit) {
            this.hasDealtHit = true;
            combat.executePlayerAttack(this, level);
            this.attackTimer = 0.12;
          }
        } else if (!this.hasDealtHit && this.attackTimer <= this.attackDuration * 0.55) {
          this.hasDealtHit = true;
          combat.executePlayerAttack(this, level);
        }
        this.vx *= 0.84;
        this.applyGravityAndCollide(dt, level);
        return;
      }

      // Input handling: Movement, Block, Crouch, Climb
      const moveDir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (moveDir !== 0) this.facing = moveDir;

      this.blocking = Boolean(input.down && this.onGround && moveDir === 0);
      this.crouching = Boolean(input.down && this.onGround && !this.blocking);

      // Check climbable ladders/vines
      const onLadder = level.isTouchingClimbable(this);
      if (onLadder && (input.up || input.down)) {
        this.Climbing = true;
      } else if (!onLadder) {
        this.Climbing = false;
      }

      if (this.Climbing) {
        this.state = 'climb';
        this.vy = input.up ? -210 : (input.down ? 210 : 0);
        this.vx = moveDir * 140;
        this.jumpsLeft = 2;
      } else {
        const surfaceFriction = level.isSlipperyWorld ? 0.94 : 0.78;
        if (this.blocking) {
          this.vx *= 0.7;
          this.state = 'block';
        } else if (moveDir !== 0) {
          const targetVx = moveDir * this.stats.moveSpeed;
          this.vx = level.isSlipperyWorld
            ? this.vx + (targetVx - this.vx) * Math.min(1, dt * 6)
            : targetVx;
        } else {
          this.vx *= surfaceFriction;
          if (Math.abs(this.vx) < 8) this.vx = 0;
        }
      }

      // Dodge / Slide trigger
      if (input.justPressed.dodge && this.dodgeTimer <= 0) {
        this.dodgeTimer = 0.26;
        this.invulnTimer = 0.32;
        if (this.onGround && input.down) {
          this.slideTimer = 0.26;
          this.state = 'slide';
        } else {
          this.state = 'dodge';
        }
        global.AudioSystem.sfxJump(false);
        return;
      }

      // Jump & Double Jump trigger
      if (input.justPressed.jump) {
        this.jumpBuffer = 0.12;
      }
      if (this.jumpBuffer > 0) {
        if (this.onGround || this.coyoteTimer > 0 || this.Climbing) {
          this.vy = -this.stats.jumpPower;
          this.onGround = false;
          this.Climbing = false;
          this.coyoteTimer = 0;
          this.jumpBuffer = 0;
          this.jumpsLeft = 1;
          this.state = 'jump';
          global.AudioSystem.sfxJump(false);
          combat.spawnDust(this.x + this.w / 2, this.y + this.h, 6);
        } else if (this.onWall !== 0) {
          // Wall Climb Jump
          this.vy = -this.stats.jumpPower * 0.92;
          this.vx = -this.onWall * this.stats.moveSpeed * 1.1;
          this.facing = -this.onWall;
          this.jumpBuffer = 0;
          this.jumpsLeft = 1;
          this.state = 'doublejump';
          global.AudioSystem.sfxJump(true);
        } else if (this.jumpsLeft > 0) {
          this.vy = -this.stats.jumpPower * 0.88;
          this.jumpsLeft -= 1;
          this.jumpBuffer = 0;
          this.state = 'doublejump';
          global.AudioSystem.sfxJump(true);
          combat.spawnDust(this.x + this.w / 2, this.y + this.h, 8);
        }
      }

      // Combat Attack Triggers
      if (input.justPressed.punch) {
        this.startAttack(this.onGround ? 'punch' : 'airattack');
      } else if (input.justPressed.heavy) {
        if (!this.onGround && input.down) {
          this.startAttack('groundslam');
        } else {
          this.startAttack(this.weaponId !== 'fists' ? 'weapon' : 'kick');
        }
      } else if (input.justPressed.special && this.energy >= 35) {
        this.energy -= 35;
        this.startAttack('special');
      }

      const wasOnGround = this.onGround;
      this.applyGravityAndCollide(dt, level);

      if (!wasOnGround && this.onGround) {
        this.state = 'land';
        combat.spawnDust(this.x + this.w / 2, this.y + this.h, 5);
      }

      // Determine locomotion state if not attacking or dodging
      if (this.attackTimer <= 0 && this.dodgeTimer <= 0 && !this.Climbing) {
        if (this.blocking) {
          this.state = 'block';
        } else if (this.crouching) {
          this.state = 'crouch';
        } else if (!this.onGround) {
          if (this.onWall !== 0 && this.vy > 0) {
            this.state = 'climb';
          } else if (this.vy < 0) {
            if (this.state !== 'doublejump') this.state = 'jump';
          } else {
            this.state = 'fall';
          }
        } else if (Math.abs(this.vx) > 190) {
          this.state = 'run';
        } else if (Math.abs(this.vx) > 15) {
          this.state = 'walk';
        } else {
          this.state = 'idle';
        }
      }
    }

    startAttack(type) {
      const wStats = global.WeaponsSystem.getEffectiveStats(this.weaponId);
      this.hasDealtHit = false;
      this.attackType = type;

      if (type === 'punch') {
        this.comboStep = (this.comboStep % 5) + 1;
        this.comboWindow = 0.65;
        this.attackDuration = 0.22 / wStats.speed;
        this.state = this.comboStep >= 3 ? 'combo' : 'punch';
        this.vx = this.facing * 95;
        global.AudioSystem.sfxPunch();
      } else if (type === 'kick') {
        this.comboStep = (this.comboStep % 5) + 1;
        this.comboWindow = 0.7;
        this.attackDuration = 0.28;
        this.state = 'kick';
        this.vx = this.facing * 120;
        global.AudioSystem.sfxKick();
      } else if (type === 'weapon') {
        this.comboStep = (this.comboStep % 5) + 1;
        this.comboWindow = 0.72;
        this.attackDuration = 0.26 / wStats.speed;
        this.state = 'weapon';
        this.vx = this.facing * 115;
        global.AudioSystem.sfxWeaponSwing(wStats.sfxType);
      } else if (type === 'airattack') {
        this.attackDuration = 0.24;
        this.state = 'airattack';
        this.vy = Math.min(this.vy, -80);
        global.AudioSystem.sfxWeaponSwing(wStats.sfxType);
      } else if (type === 'groundslam') {
        this.attackDuration = 0.65;
        this.state = 'groundslam';
        global.AudioSystem.sfxKick();
      } else if (type === 'special') {
        this.attackDuration = 0.38;
        this.state = 'special';
        this.invulnTimer = 0.42;
        this.vx = this.facing * 260;
        global.AudioSystem.sfxWeaponSwing('energy');
      }
      this.attackTimer = this.attackDuration;
    }

    takeDamage(rawAmount, sourceX, combat) {
      if (this.invulnTimer > 0 || this.hp <= 0 || this.state === 'victory') return;

      let dmg = rawAmount * (1 - this.stats.defense);
      if (this.blocking) {
        dmg *= 0.25;
        combat.spawnSparks(this.x + this.w / 2, this.y + 28, '#38bdf8', 8);
        combat.addFloatingText(this.x + this.w / 2, this.y, 'BLOCKED!', '#38bdf8', 14);
      }

      const finalDmg = Math.max(1, Math.round(dmg));
      this.hp = Math.max(0, this.hp - finalDmg);
      this.invulnTimer = 0.65;
      combat.addFloatingText(this.x + this.w / 2, this.y - 10, '-' + finalDmg, '#ef4444', 18);

      if (!this.blocking) {
        this.hurtTimer = 0.28;
        const dir = this.x + this.w / 2 >= sourceX ? 1 : -1;
        this.vx = dir * 240;
        this.vy = -240;
        this.comboStreak = 0;
        combat.triggerShake(7, 0.18);
      }
      global.AudioSystem.sfxEnemyHit();
    }

    applyGravityAndCollide(dt, level) {
      if (!this.Climbing) {
        const grav = this.onWall !== 0 && this.vy > 0 ? 520 : 1650;
        this.vy = Math.min(980, this.vy + grav * dt);
      }

      // Horizontal step & collision
      this.x += this.vx * dt;
      this.x = Math.max(0, Math.min(level.width - this.w, this.x));
      this.onWall = 0;

      for (const p of level.platforms) {
        if (p.oneWay) continue;
        if (this.overlaps(p)) {
          if (this.vx > 0) {
            this.x = p.x - this.w;
            this.onWall = 1;
          } else if (this.vx < 0) {
            this.x = p.x + p.w;
            this.onWall = -1;
          }
          this.vx = 0;
        }
      }

      // Vertical step & collision
      const prevBottom = this.y + this.h;
      this.y += this.vy * dt;
      const wasGrounded = this.onGround;
      this.onGround = false;

      for (const p of level.platforms) {
        if (this.overlaps(p)) {
          if (p.oneWay) {
            if (this.vy >= 0 && prevBottom <= p.y + 14 && !this.crouching) {
              this.y = p.y - this.h;
              this.vy = 0;
              this.onGround = true;
              this.jumpsLeft = 2;
            }
          } else {
            if (this.vy >= 0 && prevBottom <= p.y + 22) {
              this.y = p.y - this.h;
              this.vy = 0;
              this.onGround = true;
              this.jumpsLeft = 2;
              if (p.vx) this.x += p.vx * dt;
            } else if (this.vy < 0) {
              this.y = p.y + p.h;
              this.vy = 0;
            }
          }
        }
      }

      if (wasGrounded && !this.onGround) {
        this.coyoteTimer = 0.1;
      }

      // Pit hazard check
      if (this.y > level.height + 120) {
        this.hp = Math.max(0, this.hp - 35);
        if (this.hp > 0) {
          this.x = level.checkpointX;
          this.y = level.checkpointY;
          this.vx = 0;
          this.vy = 0;
          this.invulnTimer = 1.0;
        }
      }
    }

    overlaps(rect) {
      return (
        this.x < rect.x + rect.w &&
        this.x + this.w > rect.x &&
        this.y < rect.y + rect.h &&
        this.y + this.h > rect.y
      );
    }

    draw(ctx) {
      // Draw dodge afterimages
      for (const img of this.afterimages) {
        ctx.save();
        ctx.globalAlpha = img.alpha * 0.45;
        this.renderArticulatedHero(ctx, img.x, img.y, img.facing, true);
        ctx.restore();
      }

      ctx.save();
      if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 20) % 2 === 0) {
        ctx.globalAlpha = 0.55;
      }
      this.renderArticulatedHero(ctx, this.x, this.y, this.facing, false);
      ctx.restore();
    }

    renderArticulatedHero(ctx, drawX, drawY, facing, isSilhouette) {
      const cx = drawX + this.w / 2;
      const cy = drawY + this.h / 2;
      const t = this.animTimer;
      const cfg = this.charConfig;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(facing, 1);

      if (this.state === 'slide' || this.state === 'crouch') {
        ctx.translate(0, 14);
        ctx.scale(1.12, 0.72);
      } else if (this.state === 'defeat') {
        ctx.translate(0, 24);
        ctx.rotate(Math.PI / 2);
      }

      // Compute procedural joint angles based on 19 animation states
      let legSwing = 0;
      let armAngle = 0.2;
      let backArmAngle = -0.3;
      let torsoLean = 0;
      let bobY = 0;

      if (this.state === 'idle') {
        bobY = Math.sin(t * 4) * 2;
        armAngle = 0.3 + Math.sin(t * 4) * 0.08;
      } else if (this.state === 'walk') {
        legSwing = Math.sin(t * 10) * 0.55;
        armAngle = -legSwing * 0.7;
        bobY = Math.abs(Math.cos(t * 10)) * 2.5;
      } else if (this.state === 'run') {
        legSwing = Math.sin(t * 16) * 0.85;
        armAngle = -legSwing * 0.9;
        torsoLean = 0.22;
        bobY = Math.abs(Math.cos(t * 16)) * 3.5;
      } else if (this.state === 'jump' || this.state === 'doublejump') {
        legSwing = 0.45;
        armAngle = -0.8;
        if (this.state === 'doublejump') ctx.rotate(t * 14);
      } else if (this.state === 'fall') {
        legSwing = -0.25;
        armAngle = -1.2;
      } else if (this.state === 'punch' || this.state === 'combo' || this.state === 'weapon' || this.state === 'special') {
        const p = 1 - this.attackTimer / Math.max(0.01, this.attackDuration);
        torsoLean = 0.28;
        armAngle = -1.3 + p * 2.4;
        legSwing = 0.5;
      } else if (this.state === 'kick') {
        torsoLean = -0.22;
        legSwing = 1.25;
        armAngle = -0.5;
      } else if (this.state === 'block') {
        armAngle = -0.95;
        torsoLean = -0.1;
      } else if (this.state === 'victory') {
        bobY = -Math.abs(Math.sin(t * 6)) * 8;
        armAngle = -2.2;
      }

      ctx.translate(0, bobY);
      ctx.rotate(torsoLean);

      const primary = isSilhouette ? '#38bdf8' : cfg.primaryColor;
      const accent = isSilhouette ? '#7dd3fc' : cfg.accentColor;
      const skin = isSilhouette ? '#bae6fd' : cfg.skinColor;

      // Flowing Headband Tails
      ctx.strokeStyle = accent;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-8, -22);
      ctx.quadraticCurveTo(-22, -20 + Math.sin(t * 12) * 6, -34, -14 + Math.cos(t * 12) * 8);
      ctx.stroke();

      // Back Leg
      ctx.save();
      ctx.translate(-3, 10);
      ctx.rotate(-legSwing);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-5, 0, 10, 18);
      ctx.fillStyle = accent;
      ctx.fillRect(-5, 14, 11, 6);
      ctx.restore();

      // Back Arm
      ctx.save();
      ctx.translate(-4, -8);
      ctx.rotate(backArmAngle);
      ctx.fillStyle = primary;
      ctx.fillRect(-4, 0, 8, 14);
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(0, 15, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Armored Torso & Belt
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.roundRect(-11, -12, 22, 24, 5);
      ctx.fill();

      // Chest Cross-Strap & Belt
      ctx.fillStyle = accent;
      ctx.fillRect(-11, 7, 22, 5);
      ctx.beginPath();
      ctx.moveTo(-9, -11);
      ctx.lineTo(9, 8);
      ctx.lineWidth = 3;
      ctx.strokeStyle = accent;
      ctx.stroke();

      // Front Leg
      ctx.save();
      ctx.translate(4, 10);
      ctx.rotate(legSwing);
      ctx.fillStyle = primary;
      ctx.fillRect(-5, 0, 10, 18);
      ctx.fillStyle = accent;
      ctx.fillRect(-4, 14, 12, 6);
      ctx.restore();

      // Head & Expressive Face
      ctx.save();
      ctx.translate(0, -21);
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();

      // Spiky Hair / Helmet Crown
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.moveTo(-11, -3);
      ctx.lineTo(-14, -12);
      ctx.lineTo(-4, -10);
      ctx.lineTo(2, -15);
      ctx.lineTo(8, -10);
      ctx.lineTo(12, -4);
      ctx.closePath();
      ctx.fill();

      // Warrior Headband
      ctx.fillStyle = accent;
      ctx.fillRect(-11, -6, 22, 4);

      // Determined Eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(2, -2, 6, 3);
      ctx.fillStyle = '#090d16';
      ctx.fillRect(5, -2, 3, 3);
      ctx.restore();

      // Front Arm + Weapon Socket
      ctx.save();
      ctx.translate(4, -7);
      ctx.rotate(armAngle);
      ctx.fillStyle = primary;
      ctx.fillRect(-4, 0, 9, 14);
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(0, 15, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(2, 15);
      const swingProg = (this.state === 'weapon' || this.state === 'punch' || this.state === 'combo' || this.state === 'special')
        ? 1
        : 0;
      global.WeaponsSystem.drawWeaponInHand(ctx, this.weaponId, swingProg);
      ctx.restore();

      // Blocking Energy Shield Visual
      if (this.state === 'block') {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
        ctx.beginPath();
        ctx.arc(6, 0, 28, -Math.PI * 0.45, Math.PI * 0.45);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  global.CHARACTER_ROSTER = CHARACTER_ROSTER;
  global.Player = Player;
})(window);
