/**
 * SHADOW WARRIOR – GAMERKIE EDITION
 * game.js - Main requestAnimationFrame Loop, Multi-Touch Router, Camera & Asset Fallback
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
      const buttons = Array.from(container.querySelectorAll('.touch-btn'));

      const reconcileTouches = (e) => {
        if (e.cancelable) e.preventDefault();
        const activeActions = new Set();

        for (let i = 0; i < e.touches.length; i++) {
          const t = e.touches[i];
          for (const btn of buttons) {
            const rect = btn.getBoundingClientRect();
            if (t.clientX >= rect.left && t.clientX <= rect.right && t.clientY >= rect.top && t.clientY <= rect.bottom) {
              activeActions.add(btn.dataset.action);
            }
          }
        }

        buttons.forEach((btn) => {
          const act = btn.dataset.action;
          const isPressed = activeActions.has(act);
          btn.classList.toggle('pressed', isPressed);
          if (isPressed && !this.input[act]) {
            this.input.justPressed[act] = true;
          }
          this.input[act] = isPressed;
        });
      };

      container.addEventListener('touchstart', reconcileTouches, { passive: false });
      container.addEventListener('touchmove', reconcileTouches, { passive: false });
      container.addEventListener('touchend', reconcileTouches, { passive: false });
      container.addEventListener('touchcancel', reconcileTouches, { passive: false });
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
        // Render animated menu backdrop
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
