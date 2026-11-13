/**
 * SHADOW WARRIOR – GAMERKIE EDITION
 * weapons.js - Unlockable & Upgradable Arsenal System
 */
(function (global) {
  'use strict';

  const WEAPONS_CATALOG = {
    fists: {
      id: 'fists',
      name: 'Shadow Gauntlets',
      damage: 0,
      speed: 1.15,
      range: 56,
      cost: 0,
      upgradeBaseCost: 120,
      color: '#f59e0b',
      effect: 'Rapid martial arts strikes',
      sfxType: 'light'
    },
    stick: {
      id: 'stick',
      name: 'Wooden Stick',
      damage: 8,
      speed: 1.05,
      range: 78,
      cost: 150,
      upgradeBaseCost: 140,
      color: '#a16207',
      effect: 'Extended bo-staff reach',
      sfxType: 'light'
    },
    pipe: {
      id: 'pipe',
      name: 'Iron Pipe',
      damage: 14,
      speed: 0.92,
      range: 74,
      cost: 350,
      upgradeBaseCost: 180,
      color: '#94a3b8',
      effect: '+25% Enemy Stagger duration',
      sfxType: 'heavy'
    },
    bat: {
      id: 'bat',
      name: 'Baseball Bat',
      damage: 19,
      speed: 0.95,
      range: 80,
      cost: 600,
      upgradeBaseCost: 220,
      color: '#d97706',
      effect: 'High Knockback home-run swing',
      sfxType: 'heavy'
    },
    sword: {
      id: 'sword',
      name: 'Steel Broadsword',
      damage: 26,
      speed: 1.0,
      range: 86,
      cost: 950,
      upgradeBaseCost: 280,
      color: '#e2e8f0',
      effect: 'Balanced armor-cleaving edge',
      sfxType: 'light'
    },
    katana: {
      id: 'katana',
      name: 'Shadow Katana',
      damage: 34,
      speed: 1.22,
      range: 92,
      cost: 1400,
      upgradeBaseCost: 350,
      color: '#38bdf8',
      effect: '+20% Critical Hit chance',
      sfxType: 'light'
    },
    hammer: {
      id: 'hammer',
      name: 'Titan War Hammer',
      damage: 48,
      speed: 0.76,
      range: 88,
      cost: 1900,
      upgradeBaseCost: 420,
      color: '#f97316',
      effect: 'Seismic ground shockwave on hit',
      sfxType: 'heavy'
    },
    dualblades: {
      id: 'dualblades',
      name: 'Twin Viper Blades',
      damage: 38,
      speed: 1.38,
      range: 76,
      cost: 2500,
      upgradeBaseCost: 500,
      color: '#a855f7',
      effect: 'Double-strike whirlwind flurry',
      sfxType: 'light'
    },
    energysword: {
      id: 'energysword',
      name: 'Plasma Energy Sword',
      damage: 56,
      speed: 1.15,
      range: 98,
      cost: 3400,
      upgradeBaseCost: 650,
      color: '#06b6d4',
      effect: 'Pierces enemy shields & armor',
      sfxType: 'energy'
    },
    dragonblade: {
      id: 'dragonblade',
      name: 'Eclipse Dragonblade',
      damage: 75,
      speed: 1.25,
      range: 112,
      cost: 5000,
      upgradeBaseCost: 850,
      color: '#ef4444',
      effect: 'Legendary: Launches shadow-flame wave',
      sfxType: 'energy'
    }
  };

  const WeaponsSystem = {
    catalog: WEAPONS_CATALOG,

    getWeapon(id) {
      return WEAPONS_CATALOG[id] || WEAPONS_CATALOG.fists;
    },

    getEffectiveStats(id) {
      const base = this.getWeapon(id);
      const lvl = (global.SaveSystem && global.SaveSystem.data.weaponLevels[id]) || 1;
      const mult = 1 + (lvl - 1) * 0.22;
      return {
        id: base.id,
        name: base.name,
        level: lvl,
        damage: Math.round(base.damage * mult),
        speed: base.speed + (lvl - 1) * 0.03,
        range: base.range + (lvl - 1) * 3,
        color: base.color,
        effect: base.effect,
        sfxType: base.sfxType,
        upgradeCost: Math.round(base.upgradeBaseCost * Math.pow(1.45, lvl - 1))
      };
    },

    drawWeaponInHand(ctx, weaponId, swingProgress) {
      const w = this.getWeapon(weaponId);
      if (w.id === 'fists') {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(4, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      ctx.save();
      ctx.strokeStyle = w.color;
      ctx.fillStyle = w.color;

      if (w.id === 'stick' || w.id === 'pipe' || w.id === 'bat') {
        ctx.lineWidth = w.id === 'bat' ? 7 : 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(36, 0);
        ctx.stroke();
      } else if (w.id === 'hammer') {
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#78350f';
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(34, 0);
        ctx.stroke();
        ctx.fillStyle = '#f97316';
        ctx.fillRect(28, -12, 16, 24);
      } else {
        // Bladed weapons (sword, katana, dualblades, energysword, dragonblade)
        if (w.id === 'energysword' || w.id === 'dragonblade') {
          ctx.shadowColor = w.color;
          ctx.shadowBlur = 12;
        }
        // Guard
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(2, -7, 4, 14);
        // Blade
        ctx.fillStyle = w.color;
        ctx.beginPath();
        ctx.moveTo(6, -4);
        ctx.lineTo(44, -1);
        ctx.lineTo(48, 0);
        ctx.lineTo(44, 3);
        ctx.lineTo(6, 4);
        ctx.closePath();
        ctx.fill();
      }

      if (swingProgress > 0) {
        ctx.strokeStyle = w.color;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(0, 0, 42, -0.8, 0.8);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  global.WeaponsSystem = WeaponsSystem;
})(window);
