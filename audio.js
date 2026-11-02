/**
 * SHADOW WARRIOR – GAMERKIE EDITION
 * audio.js - Procedural Web Audio API Synthesizer & Lookahead Music Sequencer
 */
(function (global) {
  'use strict';

  const WORLD_THEMES = {
    0: { bpm: 112, root: 220.0, scale: [0, 3, 5, 7, 10, 12], pattern: [0, 2, 3, 2, 4, 3, 1, 0], wave: 'triangle' }, // Menu
    1: { bpm: 128, root: 164.81, scale: [0, 3, 5, 7, 10, 12], pattern: [0, 0, 3, 2, 4, 3, 2, 1], wave: 'sawtooth' }, // City Streets
    2: { bpm: 118, root: 146.83, scale: [0, 2, 3, 7, 8, 12], pattern: [0, 2, 4, 1, 3, 4, 2, 0], wave: 'triangle' },  // Dark Forest
    3: { bpm: 136, root: 130.81, scale: [0, 3, 5, 6, 7, 10], pattern: [0, 3, 0, 4, 0, 3, 5, 2], wave: 'square' },    // Military Base
    4: { bpm: 124, root: 196.00, scale: [0, 1, 4, 5, 7, 8], pattern: [0, 1, 2, 3, 2, 1, 4, 0], wave: 'sawtooth' },   // Desert Kingdom
    5: { bpm: 120, root: 246.94, scale: [0, 2, 3, 5, 7, 10], pattern: [0, 4, 2, 5, 3, 2, 1, 0], wave: 'sine' },      // Frozen Mountains
    6: { bpm: 142, root: 174.61, scale: [0, 3, 5, 7, 10, 12], pattern: [0, 5, 3, 5, 2, 4, 1, 3], wave: 'square' },   // Underground Lab
    7: { bpm: 132, root: 146.83, scale: [0, 1, 4, 7, 8, 11], pattern: [0, 2, 1, 4, 3, 5, 2, 1], wave: 'sawtooth' },  // Dark Castle
    8: { bpm: 148, root: 155.56, scale: [0, 2, 3, 6, 7, 11], pattern: [0, 3, 5, 4, 2, 5, 1, 0], wave: 'sawtooth' }   // Final Shadow Realm
  };

  const AudioSystem = {
    ctx: null,
    compressor: null,
    currentThemeId: 0,
    isPlayingMusic: false,
    stepIndex: 0,
    nextNoteTime: 0,
    schedulerTimer: null,
    lookaheadMs: 25.0,
    scheduleAheadSec: 0.1,

    init() {
      const unlock = () => {
        this.ensureContext();
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);
    },

    ensureContext() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-24, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(4.0, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
        this.compressor.connect(this.ctx.destination);
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    },

    getSettings() {
      return (global.SaveSystem && global.SaveSystem.data.settings) || {
        musicOn: true,
        soundOn: true,
        musicVol: 0.6,
        soundVol: 0.8
      };
    },

    playTone(freq, endFreq, duration, type, gainVal) {
      const s = this.getSettings();
      if (!s.soundOn) return;
      const ctx = this.ensureContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(Math.max(20, freq), now);
      if (endFreq && endFreq !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
      }

      const vol = Math.min(1, Math.max(0.001, (gainVal || 0.25) * s.soundVol));
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    },

    playNoise(duration, filterFreq, gainVal) {
      const s = this.getSettings();
      if (!s.soundOn) return;
      const ctx = this.ensureContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq || 900, now);

      const gain = ctx.createGain();
      const vol = Math.min(1, Math.max(0.001, (gainVal || 0.3) * s.soundVol));
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.compressor);
      noise.start(now);
      noise.stop(now + duration + 0.02);
    },

    sfxPunch() {
      this.playTone(190, 55, 0.09, 'triangle', 0.32);
      this.playNoise(0.06, 1200, 0.22);
    },

    sfxKick() {
      this.playTone(140, 42, 0.14, 'sawtooth', 0.38);
      this.playNoise(0.09, 800, 0.28);
    },

    sfxWeaponSwing(type) {
      if (type === 'energy') {
        this.playTone(620, 180, 0.16, 'sawtooth', 0.28);
      } else if (type === 'heavy') {
        this.playTone(110, 35, 0.22, 'square', 0.42);
        this.playNoise(0.15, 600, 0.35);
      } else {
        this.playTone(480, 140, 0.11, 'sine', 0.25);
        this.playNoise(0.07, 2400, 0.2);
      }
    },

    sfxJump(isDouble) {
      if (isDouble) {
        this.playTone(320, 680, 0.14, 'sine', 0.24);
      } else {
        this.playTone(210, 480, 0.13, 'sine', 0.24);
      }
    },

    sfxCoin() {
      const ctx = this.ensureContext();
      if (!ctx) return;
      this.playTone(987.77, 987.77, 0.07, 'sine', 0.22);
      setTimeout(() => this.playTone(1318.51, 1318.51, 0.16, 'sine', 0.24), 60);
    },

    sfxEnemyHit() {
      this.playTone(160, 65, 0.08, 'square', 0.24);
    },

    sfxBossRoar() {
      this.playTone(95, 38, 0.55, 'sawtooth', 0.45);
      this.playNoise(0.45, 450, 0.38);
    },

    sfxExplosion() {
      this.playNoise(0.42, 520, 0.48);
      this.playTone(85, 28, 0.38, 'sawtooth', 0.4);
    },

    sfxVictory() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((n, idx) => {
        setTimeout(() => this.playTone(n, n, 0.22, 'triangle', 0.3), idx * 110);
      });
    },

    sfxDefeat() {
      const notes = [392.0, 349.23, 329.63, 261.63];
      notes.forEach((n, idx) => {
        setTimeout(() => this.playTone(n, n * 0.96, 0.28, 'sawtooth', 0.28), idx * 140);
      });
    },

    startMusic(worldId) {
      const themeIndex = WORLD_THEMES[worldId] ? worldId : ((worldId - 1) % 8) + 1;
      this.currentThemeId = themeIndex;
      const s = this.getSettings();
      if (!s.musicOn) {
        this.stopMusic();
        return;
      }
      const ctx = this.ensureContext();
      if (!ctx) return;

      if (!this.isPlayingMusic) {
        this.isPlayingMusic = true;
        this.stepIndex = 0;
        this.nextNoteTime = ctx.currentTime + 0.05;
        this.scheduler();
      }
    },

    stopMusic() {
      this.isPlayingMusic = false;
      if (this.schedulerTimer) {
        clearTimeout(this.schedulerTimer);
        this.schedulerTimer = null;
      }
    },

    scheduler() {
      if (!this.isPlayingMusic || !this.ctx) return;
      const s = this.getSettings();
      if (!s.musicOn) {
        this.stopMusic();
        return;
      }

      while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadSec) {
        this.scheduleStep(this.stepIndex, this.nextNoteTime);
        const theme = WORLD_THEMES[this.currentThemeId] || WORLD_THEMES[0];
        const secondsPerBeat = 60.0 / theme.bpm;
        this.nextNoteTime += secondsPerBeat * 0.5; // Eighth-note subdivision
        this.stepIndex = (this.stepIndex + 1) % 16;
      }
      this.schedulerTimer = setTimeout(() => this.scheduler(), this.lookaheadMs);
    },

    scheduleStep(step, time) {
      const s = this.getSettings();
      if (!s.musicOn || !this.ctx) return;
      const theme = WORLD_THEMES[this.currentThemeId] || WORLD_THEMES[0];
      const patIdx = step % theme.pattern.length;
      const semitone = theme.scale[theme.pattern[patIdx] % theme.scale.length];
      const octaveShift = step >= 8 ? 12 : 0;
      const freq = theme.root * Math.pow(2, (semitone + octaveShift) / 12);

      // Lead synth note
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = theme.wave;
      osc.frequency.setValueAtTime(freq, time);

      const vol = Math.max(0.001, 0.08 * s.musicVol);
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.19);

      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(time);
      osc.stop(time + 0.21);

      // Bass pulse on downbeats
      if (step % 4 === 0) {
        const bass = this.ctx.createOscillator();
        const bGain = this.ctx.createGain();
        bass.type = 'triangle';
        bass.frequency.setValueAtTime(theme.root * 0.5, time);
        bGain.gain.setValueAtTime(Math.max(0.001, 0.11 * s.musicVol), time);
        bGain.gain.exponentialRampToValueAtTime(0.001, time + 0.24);
        bass.connect(bGain);
        bGain.connect(this.compressor);
        bass.start(time);
        bass.stop(time + 0.26);
      }
    }
  };

  global.AudioSystem = AudioSystem;
})(window);
