/**
 * SHADOW WARRIOR – GAMERKIE EDITION
 * game.js - Main requestAnimationFrame Loop, MOBA 360 Analog Joystick & Multi-Touch Router
 */
(function (global) {
  'use strict';

  const AssetRegistry = {
    paths: {
      characters: 'assets/characters/',
      enemies: 'assets/enemies/',
      bosses: 'assets/bosses/',
      backgrounds: 'assets/backgrounds/',
      weapons: 'assets/weapons/',
      effects: 'assets/effects/',
      sounds: 'assets/sounds/'
    }
  };

  class GameEngine {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.portraitCanvas = document.getElementById('hud-portrait-canvas');
      this.portraitCtx = this.portraitCanvas.getContext('2d');

      this.state = 'menu'; // menu, playing, paused, gameover, victory
      this.lastTime = performance.now();
      this.camX = 0;

      this.input = {
        left: false,
        right: false,
        up: false,
        down: false,
        jump: false,
        punch: false,
        heavy: false,
        special: false,
        dodge: false,
        justPressed: {}
      };

      this.combat = new global.CombatSystem();
      this.player = null;
      this.level = null;

      this.bindKeyboard();
      this.bindTouchControls();
    }

    init() {
      global.SaveSystem.init();
      global.AudioSystem.init();
      global.UISystem.init(this);
      this.renderPortrait();
      requestAnimationFrame((t) => this.loop(t));
    }

    bindKeyboard() {
      const setKey = (code, isDown) => {
        const inp = this.input;
        const map = {
          KeyA: 'left', ArrowLeft: 'left',
          KeyD: 'right', ArrowRight: 'right',
          KeyW: 'up', ArrowUp: 'up',
          KeyS: 'down', ArrowDown: 'down',
          Space: 'jump',
          KeyJ: 'punch',
          KeyK: 'heavy',
          KeyL: 'special',
          ShiftLeft: 'dodge', ShiftRight: 'dodge'
        };

        if (code === 'Escape' && isDown) {
          if (this.state === 'playing' || this.state === 'paused') {
            this.togglePause();
          }
          return;
        }

        const action = map[code];
        if (!action) return;

        if (action === 'up' && isDown && !inp.up) {
          inp.justPressed.jump = true;
        }
        if (isDown && !inp[action]) {
          inp.justPressed[action] = true;
        }
        inp[action] = isDown;
      };

      window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
          e.preventDefault();
        }
        setKey(e.code, true);
      });
      window.addEventListener('keyup', (e) => setKey(e.code, false));
    }

    bindTouchControls() {
      const container = document.getElementById('touch-controls');
      const joyZone = document.getElementById('moba-joystick-zone');
      const joyBase = document.getElementById('moba-joystick-base');
      const joyStick = document.getElementById('moba-joystick-stick');
      const indUp = document.getElementById('joy-ind-up');
      const indDown = document.getElementById('joy-ind-down');
      const indLeft = document.getElementById('joy-ind-left');
      const indRight = document.getElementById('joy-ind-right');

      const skillButtons = Array.from(container.querySelectorAll('.act-btn'));
      let joyTouchId = null;
      let mouseDraggingJoy = false;

      const updateJoystickVector = (clientX, clientY) => {
        if (!joyBase || !joyStick) return;
        const rect = joyBase.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const maxRadius = rect.width * 0.36;

        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const dist = Math.hypot(dx, dy);

        if (dist > maxRadius && dist > 0) {
          dx = (dx / dist) * maxRadius;
          dy = (dy / dist) * maxRadius;
        }

        joyStick.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0px)`;
        joyStick.classList.add('active-stick');

        // Deadzone threshold for smooth scrolling Left, Right, Up, Down
        const deadzone = 12;
        const newLeft = dx < -deadzone;
        const newRight = dx > deadzone;
        const newUp = dy < -deadzone;
        const newDown = dy > deadzone;

        // Trigger jump when swiping joystick upward strongly
        if (dy < -deadzone * 1.45 && !this.input.up) {
          this.input.justPressed.jump = true;
        }

        this.input.left = newLeft;
        this.input.right = newRight;
        this.input.up = newUp;
        this.input.down = newDown;

        if (indLeft) indLeft.classList.toggle('active-dir', newLeft);
        if (indRight) indRight.classList.toggle('active-dir', newRight);
        if (indUp) indUp.classList.toggle('active-dir', newUp);
        if (indDown) indDown.classList.toggle('active-dir', newDown);
      };

      const resetJoystick = () => {
        joyTouchId = null;
        mouseDraggingJoy = false;
        if (joyStick) {
          joyStick.style.transform = 'translate3d(0px, 0px, 0px)';
          joyStick.classList.remove('active-stick');
        }
        this.input.left = false;
        this.input.right = false;
        this.input.up = false;
        this.input.down = false;
        if (indLeft) indLeft.classList.remove('active-dir');
        if (indRight) indRight.classList.remove('active-dir');
        if (indUp) indUp.classList.remove('active-dir');
        if (indDown) indDown.classList.remove('active-dir');
      };

      const reconcileMultiTouch = (e) => {
        if (e.cancelable) e.preventDefault();

        const activeSkillActions = new Set();
        let foundJoyTouch = false;
        const joyRect = joyZone ? joyZone.getBoundingClientRect() : null;

        for (let i = 0; i < e.touches.length; i++) {
          const t = e.touches[i];

          // Check if this touch belongs to the Left Analog Joystick
          if (joyTouchId === t.identifier) {
            foundJoyTouch = true;
            updateJoystickVector(t.clientX, t.clientY);
            continue;
          }

          // Start tracking joystick if touch begins inside left joystick zone (or bottom-left quadrant)
          if (
            joyTouchId === null &&
            joyRect &&
            t.clientX >= joyRect.left - 30 &&
            t.clientX <= joyRect.right + 45 &&
            t.clientY >= joyRect.top - 30 &&
            t.clientY <= joyRect.bottom + 30
          ) {
            joyTouchId = t.identifier;
            foundJoyTouch = true;
            updateJoystickVector(t.clientX, t.clientY);
            continue;
          }

          // Otherwise check Right MOBA Skill Wheel buttons
          for (const btn of skillButtons) {
            const rect = btn.getBoundingClientRect();
            if (
              t.clientX >= rect.left - 6 &&
              t.clientX <= rect.right + 6 &&
              t.clientY >= rect.top - 6 &&
              t.clientY <= rect.bottom + 6
            ) {
              activeSkillActions.add(btn.dataset.action);
            }
          }
        }

        if (!foundJoyTouch && joyTouchId !== null) {
          resetJoystick();
        }

        skillButtons.forEach((btn) => {
          const act = btn.dataset.action;
          const isPressed = activeSkillActions.has(act);
          btn.classList.toggle('pressed', isPressed);
          if (isPressed && !this.input[act]) {
            this.input.justPressed[act] = true;
          }
          this.input[act] = isPressed;
        });
      };

      container.addEventListener('touchstart', reconcileMultiTouch, { passive: false });
      container.addEventListener('touchmove', reconcileMultiTouch, { passive: false });
      container.addEventListener('touchend', reconcileMultiTouch, { passive: false });
      container.addEventListener('touchcancel', reconcileMultiTouch, { passive: false });

      // Desktop Mouse Drag Support on Left Joystick for easy testing
      if (joyZone) {
        joyZone.addEventListener('mousedown', (e) => {
          e.preventDefault();
          mouseDraggingJoy = true;
          updateJoystickVector(e.clientX, e.clientY);
        });
        window.addEventListener('mousemove', (e) => {
          if (mouseDraggingJoy) {
            updateJoystickVector(e.clientX, e.clientY);
          }
        });
        window.addEventListener('mouseup', () => {
          if (mouseDraggingJoy) {
            resetJoystick();
          }
        });
      }

      // Desktop Mouse Click Support on Right Skill Wheel buttons
      skillButtons.forEach((btn) => {
        const act = btn.dataset.action;
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          btn.classList.add('pressed');
          if (!this.input[act]) this.input.justPressed[act] = true;
          this.input[act] = true;
        });
        const releaseBtn = () => {
          btn.classList.remove('pressed');
          this.input[act] = false;
        };
        btn.addEventListener('mouseup', releaseBtn);
        btn.addEventListener('mouseleave', releaseBtn);
      });
    }

    startStoryStage(worldId, levelNum) {
      this.currentMode = 'story';
      this.activeWorld = worldId;
      this.activeLevel = levelNum;
      this.launchStage(worldId, levelNum, 'story');
    }

    startSpecialMode(modeId) {
      this.currentMode = modeId;
      this.activeWorld = global.SaveSystem.data.currentWorld || 1;
      this.activeLevel = 1;
      this.launchStage(this.activeWorld, 1, modeId);
    }

    launchStage(worldId, levelNum, mode) {
      this.combat.reset();
      this.level = new global.Level(worldId, levelNum, mode);
      this.player = new global.Player(100, 440);
      this.player.refreshEquipment();
      this.camX = 0;

      document.getElementById('screen-main-menu').classList.add('hidden');
      document.getElementById('screen-pause').classList.add('hidden');
      document.getElementById('screen-gameover').classList.add('hidden');
      document.getElementById('screen-victory').classList.add('hidden');
      document.getElementById('hud-layer').classList.remove('hidden');

      this.state = 'playing';
      this.renderPortrait();
      global.AudioSystem.startMusic(worldId);
      global.UISystem.showToast(`WORLD ${worldId}-${levelNum}: FIGHT!`);
    }

    restartCurrentStage() {
      this.launchStage(this.activeWorld, this.activeLevel, this.currentMode);
    }

    togglePause() {
      if (this.state === 'playing') {
        this.state = 'paused';
        document.getElementById('pause-stage-info').textContent = `WORLD ${this.level.worldId} - LEVEL ${this.level.worldId}-${this.level.levelNum}`;
        document.getElementById('screen-pause').classList.remove('hidden');
      } else if (this.state === 'paused') {
        this.state = 'playing';
        document.getElementById('screen-pause').classList.add('hidden');
      }
    }

    returnToMainMenu() {
      this.state = 'menu';
      document.getElementById('hud-layer').classList.add('hidden');
      document.getElementById('screen-pause').classList.add('hidden');
      document.getElementById('screen-gameover').classList.add('hidden');
      document.getElementById('screen-victory').classList.add('hidden');
      document.getElementById('screen-main-menu').classList.remove('hidden');
      global.UISystem.refreshMenuHeader();
      global.AudioSystem.startMusic(0);
    }

    handleGameOver() {
      this.state = 'gameover';
      global.AudioSystem.sfxDefeat();
      document.getElementById('go-score').textContent = this.level.score;
      document.getElementById('go-kills').textContent = this.level.kills;
      document.getElementById('go-coins').textContent = this.level.coinsCollected;
      document.getElementById('screen-gameover').classList.remove('hidden');
    }

    handleVictory() {
      this.state = 'victory';
      this.player.state = 'victory';
      global.AudioSystem.sfxVictory();

      const rewardCoins = 100 + this.level.worldId * 35;
      const rewardGems = this.level.isBossLevel ? 5 : 2;
      global.SaveSystem.addCoins(rewardCoins);
      global.SaveSystem.addGems(rewardGems);
      global.SaveSystem.recordLevelComplete(this.level.worldId, this.level.levelNum, this.level.score);

      const hpRatio = this.player.hp / this.player.maxHp;
      const stars = hpRatio >= 0.7 ? '★ ★ ★' : (hpRatio >= 0.35 ? '★ ★ ☆' : '★ ☆ ☆');
      document.getElementById('vic-stars').textContent = stars;
      document.getElementById('vic-score').textContent = this.level.score;
      document.getElementById('vic-kills').textContent = this.level.kills;
      document.getElementById('vic-coins').textContent = `+${rewardCoins + this.level.coinsCollected}`;
      document.getElementById('vic-gems').textContent = `+${rewardGems + this.level.gemsCollected}`;
      document.getElementById('screen-victory').classList.remove('hidden');
    }

    renderPortrait() {
      const pCtx = this.portraitCtx;
      pCtx.clearRect(0, 0, 56, 56);
      const charId = (global.SaveSystem && global.SaveSystem.data.selectedCharacter) || 'kaelen';
      const cfg = global.CHARACTER_ROSTER[charId] || global.CHARACTER_ROSTER.kaelen;

      pCtx.fillStyle = cfg.primaryColor;
      pCtx.fillRect(0, 0, 56, 56);
      pCtx.fillStyle = cfg.skinColor;
      pCtx.beginPath();
      pCtx.arc(28, 30, 14, 0, Math.PI * 2);
      pCtx.fill();
      pCtx.fillStyle = cfg.accentColor;
      pCtx.fillRect(14, 20, 28, 6);
      pCtx.fillStyle = '#090d16';
      pCtx.fillRect(30, 27, 6, 4);
    }

    loop(now) {
      let dt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      dt = Math.min(0.05, Math.max(0.001, dt));

      if (this.state === 'playing' && this.level && this.player) {
        if (this.combat.hitStopTimer > 0) {
          this.combat.hitStopTimer -= dt;
        } else {
          this.player.update(dt, this.input, this.level, this.combat);
          this.level.update(dt, this.player, this.combat);
          this.combat.update(dt, this.level, this.player);

          // Smooth Camera Lerp
          const targetCamX = Math.max(0, Math.min(this.level.width - 1280, this.player.x - 420));
          this.camX += (targetCamX - this.camX) * Math.min(1, dt * 8);

          global.UISystem.updateHUD(this.player, this.level);

          if (this.player.hp <= 0 && this.player.hurtTimer <= 0) {
            this.handleGameOver();
          } else if (this.level.completed) {
            this.handleVictory();
          }
        }
      }

      this.input.justPressed = {};
      this.draw();
      requestAnimationFrame((t) => this.loop(t));
    }

    draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, 1280, 720);

      if (!this.level || !this.player) {
        const g = ctx.createLinearGradient(0, 0, 0, 720);
        g.addColorStop(0, '#090d16');
        g.addColorStop(1, '#1e1b4b');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 1280, 720);
        return;
      }

      this.level.drawBackground(ctx, this.camX);

      ctx.save();
      let shakeX = 0;
      let shakeY = 0;
      if (this.combat.shakeTime > 0) {
        shakeX = (Math.random() - 0.5) * this.combat.shakeMagnitude * 2;
        shakeY = (Math.random() - 0.5) * this.combat.shakeMagnitude * 2;
      }
      ctx.translate(-Math.floor(this.camX) + shakeX, shakeY);

      this.level.drawWorld(ctx);
      this.player.draw(ctx);
      this.combat.draw(ctx);

      ctx.restore();
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const game = new GameEngine();
    game.init();
    global.ShadowWarriorGame = game;
    global.AssetRegistry = AssetRegistry;
  });
})(window);
