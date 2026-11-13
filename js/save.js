/**
 * SHADOW WARRIOR – GAMERKIE EDITION
 * save.js - Schema-Versioned LocalStorage Persistence & Progression Engine
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'shadow_warrior_gamerkie_save_v2';
  const SCHEMA_VERSION = 2;

  const DEFAULT_SAVE = {
    version: SCHEMA_VERSION,
    currentWorld: 1,
    currentLevel: 1,
    maxUnlockedWorld: 1,
    maxUnlockedLevel: 1,
    coins: 250,
    gems: 15,
    highScore: 0,
    endlessHighWave: 0,
    survivalBestTime: 0,
    selectedCharacter: 'kaelen',
    unlockedCharacters: ['kaelen'],
    equippedWeapon: 'fists',
    unlockedWeapons: ['fists', 'stick'],
    weaponLevels: {
      fists: 1,
      stick: 1,
      pipe: 1,
      bat: 1,
      sword: 1,
      katana: 1,
      hammer: 1,
      dualblades: 1,
      energysword: 1,
      dragonblade: 1
    },
    upgrades: {
      maxHealth: 1,
      punchDamage: 1,
      kickDamage: 1,
      weaponDamage: 1,
      defense: 1,
      moveSpeed: 1,
      jumpPower: 1,
      energyCap: 1,
      critDamage: 1,
      specialUnlock: 1
    },
    stats: {
      enemiesDefeated: 0,
      bossesDefeated: 0,
      coinsCollectedTotal: 0,
      levelsCompleted: 0,
      combosPerformed: 0
    },
    dailyMissions: {
      dayStamp: '',
      defeat20: { progress: 0, target: 20, claimed: false, rewardCoins: 150, desc: 'Defeat 20 Enemies' },
      coins100: { progress: 0, target: 100, claimed: false, rewardCoins: 120, desc: 'Collect 100 Coins' },
      levels3: { progress: 0, target: 3, claimed: false, rewardCoins: 200, desc: 'Complete 3 Levels' },
      boss1: { progress: 0, target: 1, claimed: false, rewardCoins: 250, desc: 'Defeat a Boss' },
      combos10: { progress: 0, target: 10, claimed: false, rewardCoins: 150, desc: 'Perform 10 Combo Attacks (3+ Hits)' }
    },
    achievements: {
      firstVictory: { unlocked: false, claimed: false, title: 'First Victory', desc: 'Complete any stage for the first time.', rewardGems: 5 },
      comboMaster: { unlocked: false, claimed: false, title: 'Combo Master', desc: 'Reach a 10-hit combo streak in combat.', rewardGems: 10 },
      weaponExpert: { unlocked: false, claimed: false, title: 'Weapon Expert', desc: 'Unlock at least 5 different weapons.', rewardGems: 15 },
      bossSlayer: { unlocked: false, claimed: false, title: 'Boss Slayer', desc: 'Defeat 5 major Bosses.', rewardGems: 20 },
      coinCollector: { unlocked: false, claimed: false, title: 'Coin Collector', desc: 'Accumulate 1,000 total collected coins.', rewardGems: 15 },
      survivalLegend: { unlocked: false, claimed: false, title: 'Survival Legend', desc: 'Survive 120 seconds in Survival Mode or reach Endless Wave 5.', rewardGems: 25 },
      ultimateWarrior: { unlocked: false, claimed: false, title: 'Ultimate Warrior', desc: 'Upgrade any Warrior attribute to Level 5.', rewardGems: 30 }
    },
    settings: {
      musicOn: true,
      soundOn: true,
      musicVol: 0.6,
      soundVol: 0.8
    },
    lastDailyRewardDate: ''
  };

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function mergeSaveData(base, incoming) {
    const out = deepClone(base);
    if (!incoming || typeof incoming !== 'object') return out;

    for (const key of Object.keys(out)) {
      if (incoming[key] !== undefined) {
        if (typeof out[key] === 'object' && !Array.isArray(out[key]) && out[key] !== null) {
          out[key] = Object.assign({}, out[key], incoming[key]);
        } else {
          out[key] = incoming[key];
        }
      }
    }
    out.version = SCHEMA_VERSION;
    return out;
  }

  const SaveSystem = {
    data: deepClone(DEFAULT_SAVE),

    init() {
      this.load();
      this.checkDailyReset();
      return this.data;
    },

    load() {
      try {
        const raw = global.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.data = mergeSaveData(DEFAULT_SAVE, parsed);
        } else {
          this.data = deepClone(DEFAULT_SAVE);
          this.save();
        }
      } catch (e) {
        this.data = deepClone(DEFAULT_SAVE);
      }
      return this.data;
    },

    save() {
      try {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch (e) {
        // Fallback in private/restricted storage environments
      }
    },

    checkDailyReset() {
      const today = new Date().toISOString().slice(0, 10);
      if (this.data.dailyMissions.dayStamp !== today) {
        const dm = deepClone(DEFAULT_SAVE.dailyMissions);
        dm.dayStamp = today;
        this.data.dailyMissions = dm;
        this.save();
      }
    },

    canClaimDailyReward() {
      const today = new Date().toISOString().slice(0, 10);
      return this.data.lastDailyRewardDate !== today;
    },

    claimDailyReward() {
      if (!this.canClaimDailyReward()) return null;
      const today = new Date().toISOString().slice(0, 10);
      this.data.lastDailyRewardDate = today;
      const bonusCoins = 200;
      const bonusGems = 5;
      this.data.coins += bonusCoins;
      this.data.gems += bonusGems;
      this.save();
      return { coins: bonusCoins, gems: bonusGems };
    },

    addCoins(amount) {
      const val = Math.max(0, Math.floor(amount));
      this.data.coins += val;
      this.data.stats.coinsCollectedTotal += val;
      this.data.dailyMissions.coins100.progress = Math.min(
        this.data.dailyMissions.coins100.target,
        this.data.dailyMissions.coins100.progress + val
      );
      if (this.data.stats.coinsCollectedTotal >= 1000) {
        this.data.achievements.coinCollector.unlocked = true;
      }
      this.save();
    },

    addGems(amount) {
      this.data.gems += Math.max(0, Math.floor(amount));
      this.save();
    },

    recordEnemyKill(isBoss) {
      this.data.stats.enemiesDefeated += 1;
      this.data.dailyMissions.defeat20.progress = Math.min(
        this.data.dailyMissions.defeat20.target,
        this.data.dailyMissions.defeat20.progress + 1
      );
      if (isBoss) {
        this.data.stats.bossesDefeated += 1;
        this.data.dailyMissions.boss1.progress = 1;
        if (this.data.stats.bossesDefeated >= 5) {
          this.data.achievements.bossSlayer.unlocked = true;
          if (!this.data.unlockedCharacters.includes('titanus')) {
            this.data.unlockedCharacters.push('titanus');
          }
        }
      }
      this.save();
    },

    recordCombo(hitCount) {
      if (hitCount >= 3) {
        this.data.stats.combosPerformed += 1;
        this.data.dailyMissions.combos10.progress = Math.min(
          this.data.dailyMissions.combos10.target,
          this.data.dailyMissions.combos10.progress + 1
        );
      }
      if (hitCount >= 10) {
        this.data.achievements.comboMaster.unlocked = true;
      }
      this.save();
    },

    recordLevelComplete(world, level, score) {
      this.data.stats.levelsCompleted += 1;
      this.data.achievements.firstVictory.unlocked = true;
      this.data.dailyMissions.levels3.progress = Math.min(
        this.data.dailyMissions.levels3.target,
        this.data.dailyMissions.levels3.progress + 1
      );
      if (score > this.data.highScore) {
        this.data.highScore = score;
      }

      // Advance campaign unlock pointer (5 levels per world, unlimited worlds >= 9)
      let nextW = world;
      let nextL = level + 1;
      if (nextL > 5) {
        nextW = world + 1;
        nextL = 1;
      }
      if (
        nextW > this.data.maxUnlockedWorld ||
        (nextW === this.data.maxUnlockedWorld && nextL > this.data.maxUnlockedLevel)
      ) {
        this.data.maxUnlockedWorld = nextW;
        this.data.maxUnlockedLevel = nextL;
      }
      this.data.currentWorld = nextW;
      this.data.currentLevel = nextL;
      this.save();
    },

    getComputedPlayerStats(characterBase) {
      const u = this.data.upgrades;
      return {
        maxHealth: Math.round((characterBase.hp || 120) + (u.maxHealth - 1) * 25),
        punchDamage: Math.round((characterBase.atk || 16) + (u.punchDamage - 1) * 4),
        kickDamage: Math.round((characterBase.atk || 16) * 1.35 + (u.kickDamage - 1) * 5),
        weaponBonus: 1 + (u.weaponDamage - 1) * 0.15,
        defense: Math.min(0.65, (characterBase.def || 0.08) + (u.defense - 1) * 0.05),
        moveSpeed: Math.round((characterBase.speed || 295) + (u.moveSpeed - 1) * 14),
        jumpPower: Math.round((characterBase.jump || 620) + (u.jumpPower - 1) * 18),
        maxEnergy: Math.round((characterBase.energy || 100) + (u.energyCap - 1) * 20),
        critMultiplier: 1.6 + (u.critDamage - 1) * 0.2,
        specialPower: 1 + (u.specialUnlock - 1) * 0.25
      };
    }
  };

  global.SaveSystem = SaveSystem;
})(window);
