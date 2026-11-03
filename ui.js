/**
 * SHADOW WARRIOR – GAMERKIE EDITION
 * ui.js - Menu Screens, Shop Modals, HUD Synchronizer & Toast Notifications
 */
(function (global) {
  'use strict';

  const UISystem = {
    toastTimer: 0,

    init(game) {
      this.game = game;
      this.bindMenuButtons();
      this.refreshMenuHeader();
    },

    bindMenuButtons() {
      const g = this.game;
      const byId = (id) => document.getElementById(id);

      byId('btn-menu-play').onclick = () => g.startStoryStage(global.SaveSystem.data.currentWorld, global.SaveSystem.data.currentLevel);
      byId('btn-menu-continue').onclick = () => g.startStoryStage(global.SaveSystem.data.currentWorld, global.SaveSystem.data.currentLevel);
      byId('btn-menu-story').onclick = () => this.openStoryModal();
      byId('btn-menu-endless').onclick = () => this.openModesModal();
      byId('btn-menu-heroes').onclick = () => this.openHeroesModal();
      byId('btn-menu-weapons').onclick = () => this.openWeaponsModal();
      byId('btn-menu-upgrades').onclick = () => this.openUpgradesModal();
      byId('btn-menu-missions').onclick = () => this.openMissionsModal();
      byId('btn-menu-achievements').onclick = () => this.openAchievementsModal();
      byId('btn-menu-settings').onclick = () => this.openSettingsModal();
      byId('btn-menu-howto').onclick = () => this.openHowToModal();
      byId('btn-menu-fullscreen').onclick = () => this.toggleFullscreen();

      byId('btn-daily-reward').onclick = () => {
        const res = global.SaveSystem.claimDailyReward();
        if (res) {
          global.AudioSystem.sfxVictory();
          alert(`DAILY REWARD CLAIMED!\n+${res.coins} Gold Coins\n+${res.gems} Rare Gems`);
          this.refreshMenuHeader();
        } else {
          alert('Daily Reward already claimed today! Come back tomorrow.');
        }
      };

      byId('btn-modal-close').onclick = () => {
        byId('screen-modal').classList.add('hidden');
        this.refreshMenuHeader();
      };

      byId('btn-hud-pause').onclick = () => g.togglePause();
      byId('btn-pause-resume').onclick = () => g.togglePause();
      byId('btn-pause-restart').onclick = () => g.restartCurrentStage();
      byId('btn-pause-settings').onclick = () => this.openSettingsModal();
      byId('btn-pause-howto').onclick = () => this.openHowToModal();
      byId('btn-pause-menu').onclick = () => g.returnToMainMenu();

      byId('btn-go-retry').onclick = () => g.restartCurrentStage();
      byId('btn-go-upgrades').onclick = () => {
        g.returnToMainMenu();
        this.openUpgradesModal();
      };
      byId('btn-go-menu').onclick = () => g.returnToMainMenu();

      byId('btn-vic-next').onclick = () => g.startStoryStage(global.SaveSystem.data.currentWorld, global.SaveSystem.data.currentLevel);
      byId('btn-vic-continue').onclick = () => g.returnToMainMenu();
    },

    refreshMenuHeader() {
      const d = global.SaveSystem.data;
      document.getElementById('menu-coins').textContent = d.coins;
      document.getElementById('menu-gems').textContent = d.gems;
      document.getElementById('modal-coins').textContent = d.coins;
      document.getElementById('modal-gems').textContent = d.gems;
      document.getElementById('menu-high-score').textContent = `HIGH SCORE: ${d.highScore}`;
      document.getElementById('btn-menu-continue').textContent = `CONTINUE (W${d.currentWorld}-${d.currentLevel})`;
    },

    showToast(msg) {
      const el = document.getElementById('hud-toast');
      el.textContent = msg;
      el.classList.remove('hidden');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
    },

    updateHUD(player, level) {
      const d = global.SaveSystem.data;
      const hpPct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
      const mpPct = Math.max(0, Math.min(100, (player.energy / player.maxEnergy) * 100));

      document.getElementById('hud-hero-name').textContent = player.charConfig.name.split(' ')[0].toUpperCase();
      document.getElementById('hud-weapon-name').textContent = global.WeaponsSystem.getWeapon(player.weaponId).name;
      document.getElementById('hud-hp-fill').style.width = `${hpPct}%`;
      document.getElementById('hud-hp-text').textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
      document.getElementById('hud-mp-fill').style.width = `${mpPct}%`;
      document.getElementById('hud-mp-text').textContent = `${Math.floor(player.energy)} / ${player.maxEnergy}`;

      document.getElementById('hud-world-label').textContent = `WORLD ${level.worldId}: ${level.theme.name}`;
      document.getElementById('hud-level-label').textContent =
        level.mode === 'story' ? `LEVEL ${level.worldId}-${level.levelNum}` : `${level.mode.toUpperCase()} (WAVE ${level.waveNumber})`;
      document.getElementById('hud-score-label').textContent = `SCORE: ${level.score}`;
      document.getElementById('hud-coins-text').textContent = d.coins;
      document.getElementById('hud-gems-text').textContent = d.gems;

      // Combo Counter
      const comboBox = document.getElementById('hud-combo-box');
      if (player.comboStreak >= 2) {
        comboBox.classList.remove('hidden');
        document.getElementById('hud-combo-count').textContent = `${player.comboStreak} HIT`;
      } else {
        comboBox.classList.add('hidden');
      }

      // Boss Health Bar
      const bossWrap = document.getElementById('hud-boss-bar-wrap');
      if (level.boss && !level.boss.dead) {
        bossWrap.classList.remove('hidden');
        const bPct = Math.max(0, (level.boss.hp / level.boss.maxHp) * 100);
        document.getElementById('hud-boss-name').textContent = level.boss.name;
        document.getElementById('hud-boss-phase').textContent = `PHASE ${level.boss.phase}`;
        document.getElementById('hud-boss-fill').style.width = `${bPct}%`;
        document.getElementById('hud-boss-text').textContent = `${level.boss.hp} / ${level.boss.maxHp}`;
      } else {
        bossWrap.classList.add('hidden');
      }
    },

    openModalShell(title) {
      this.refreshMenuHeader();
      document.getElementById('modal-title').textContent = title;
      const body = document.getElementById('modal-body');
      body.innerHTML = '';
      document.getElementById('screen-modal').classList.remove('hidden');
      return body;
    },

    openStoryModal() {
      const body = this.openModalShell('SELECT WORLD & LEVEL (STORY + PROCEDURAL INFINITE)');
      const d = global.SaveSystem.data;
      const maxDisplayWorld = Math.max(9, d.maxUnlockedWorld + 1);

      for (let w = 1; w <= maxDisplayWorld; w++) {
        const theme = global.WORLD_THEMES[((w - 1) % 8) + 1];
        const card = document.createElement('div');
        card.className = 'item-card';
        const title = w <= 8 ? `WORLD ${w}: ${theme.name}` : `WORLD ${w}: INFINITE REALM (${theme.name})`;
        let btnsHtml = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">';
        for (let l = 1; l <= 5; l++) {
          const unlocked = w < d.maxUnlockedWorld || (w === d.maxUnlockedWorld && l <= d.maxUnlockedLevel) || w >= 9 && d.maxUnlockedWorld >= 8;
          btnsHtml += `<button class="menu-btn ${unlocked ? 'accent-cta' : ''}" data-w="${w}" data-l="${l}" ${unlocked ? '' : 'disabled style="opacity:0.4"'}>${w}-${l}${l === 5 ? ' (BOSS)' : ''}</button>`;
        }
        btnsHtml += '</div>';
        card.innerHTML = `<h3>${title}</h3><p>${w <= 8 ? 'Campaign Story World' : 'Procedurally Generated Unlimited Stages'}</p>${btnsHtml}`;
        card.querySelectorAll('button[data-w]').forEach((b) => {
          b.onclick = () => {
            document.getElementById('screen-modal').classList.add('hidden');
            this.game.startStoryStage(Number(b.dataset.w), Number(b.dataset.l));
          };
        });
        body.appendChild(card);
      }
    },

    openModesModal() {
      const body = this.openModalShell('SPECIAL GAME MODES');
      const modes = [
        { id: 'endless', name: 'ENDLESS MODE', desc: 'Fight continuously against escalating enemy waves with no stage limit.' },
        { id: 'bossrush', name: 'BOSS RUSH', desc: 'Battle all 8 World Bosses back-to-back in a high-stakes gauntlet.' },
        { id: 'survival', name: 'SURVIVAL MODE', desc: 'Survive as long as possible on a single health bar against relentless waves.' },
        { id: 'challenge', name: 'CHALLENGE MODE', desc: 'Complete a high-hazard elite stage under double-damage combat conditions.' }
      ];
      modes.forEach((m) => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `<h3>${m.name}</h3><p>${m.desc}</p><button class="menu-btn primary-cta">LAUNCH ${m.name}</button>`;
        card.querySelector('button').onclick = () => {
          document.getElementById('screen-modal').classList.add('hidden');
          this.game.startSpecialMode(m.id);
        };
        body.appendChild(card);
      });
    },

    openHeroesModal() {
      const body = this.openModalShell('CHARACTER SELECTION');
      const d = global.SaveSystem.data;
      Object.values(global.CHARACTER_ROSTER).forEach((hero) => {
        const unlocked = d.unlockedCharacters.includes(hero.id);
        const selected = d.selectedCharacter === hero.id;
        const card = document.createElement('div');
        card.className = `item-card ${selected ? 'selected-card' : ''}`;
        card.innerHTML = `
          <h3>${hero.name}</h3>
          <p>${hero.style} &bull; Special: <strong>${hero.specialName}</strong></p>
          <div class="stat-mini-list">
            <span>HP: ${hero.hp}</span><span>ATK: ${hero.atk}</span><span>SPD: ${hero.speed}</span>
          </div>
          <button class="menu-btn ${selected ? 'accent-cta' : 'primary-cta'}">
            ${selected ? 'SELECTED' : (unlocked ? 'SELECT HERO' : `UNLOCK (${hero.costCoins} COINS)`)}
          </button>
        `;
        card.querySelector('button').onclick = () => {
          if (unlocked) {
            d.selectedCharacter = hero.id;
            global.SaveSystem.save();
            this.openHeroesModal();
          } else if (d.coins >= hero.costCoins) {
            d.coins -= hero.costCoins;
            d.unlockedCharacters.push(hero.id);
            d.selectedCharacter = hero.id;
            global.SaveSystem.save();
            global.AudioSystem.sfxVictory();
            this.openHeroesModal();
          } else {
            alert('Not enough Gold Coins!');
          }
        };
        body.appendChild(card);
      });
    },

    openWeaponsModal() {
      const body = this.openModalShell('WEAPONS ARMORY & UPGRADES');
      const d = global.SaveSystem.data;
      Object.keys(global.WeaponsSystem.catalog).forEach((wId) => {
        const base = global.WeaponsSystem.getWeapon(wId);
        const eff = global.WeaponsSystem.getEffectiveStats(wId);
        const unlocked = d.unlockedWeapons.includes(wId);
        const equipped = d.equippedWeapon === wId;

        const card = document.createElement('div');
        card.className = `item-card ${equipped ? 'selected-card' : ''}`;
        card.innerHTML = `
          <h3><span>${eff.name}</span><span>LVL ${eff.level}</span></h3>
          <p>${eff.effect}</p>
          <div class="stat-mini-list">
            <span>DMG: +${eff.damage}</span><span>SPD: ${eff.speed.toFixed(2)}x</span><span>RNG: ${eff.range}</span>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="menu-btn btn-equip ${equipped ? 'accent-cta' : 'primary-cta'}" style="flex:1;">
              ${equipped ? 'EQUIPPED' : (unlocked ? 'EQUIP' : `BUY (${base.cost} COINS)`)}
            </button>
            ${unlocked ? `<button class="menu-btn btn-upg">UPGRADE (${eff.upgradeCost})</button>` : ''}
          </div>
        `;
        card.querySelector('.btn-equip').onclick = () => {
          if (unlocked) {
            d.equippedWeapon = wId;
            global.SaveSystem.save();
            this.openWeaponsModal();
          } else if (d.coins >= base.cost) {
            d.coins -= base.cost;
            d.unlockedWeapons.push(wId);
            d.equippedWeapon = wId;
            if (d.unlockedWeapons.length >= 5) d.achievements.weaponExpert.unlocked = true;
            global.SaveSystem.save();
            global.AudioSystem.sfxCoin();
            this.openWeaponsModal();
          } else {
            alert('Not enough Gold Coins!');
          }
        };
        const upgBtn = card.querySelector('.btn-upg');
        if (upgBtn) {
          upgBtn.onclick = () => {
            if (d.coins >= eff.upgradeCost) {
              d.coins -= eff.upgradeCost;
              d.weaponLevels[wId] = (d.weaponLevels[wId] || 1) + 1;
              global.SaveSystem.save();
              global.AudioSystem.sfxCoin();
              this.openWeaponsModal();
            } else {
              alert('Not enough Gold Coins!');
            }
          };
        }
        body.appendChild(card);
      });
    },

    openUpgradesModal() {
      const body = this.openModalShell('WARRIOR ATTRIBUTE UPGRADES');
      const d = global.SaveSystem.data;
      const list = [
        { key: 'maxHealth', label: 'Maximum Health', desc: '+25 Max HP per level' },
        { key: 'punchDamage', label: 'Punching Damage', desc: '+4 Base Punch damage per level' },
        { key: 'kickDamage', label: 'Kicking Damage', desc: '+5 Heavy Kick damage per level' },
        { key: 'weaponDamage', label: 'Weapon Mastery', desc: '+15% Weapon damage bonus per level' },
        { key: 'defense', label: 'Armor Defense', desc: '+5% Damage reduction per level' },
        { key: 'moveSpeed', label: 'Movement Speed', desc: '+14 Sprint velocity per level' },
        { key: 'jumpPower', label: 'Jump Power', desc: '+18 Jump impulse per level' },
        { key: 'energyCap', label: 'Energy Capacity', desc: '+20 Special Energy capacity per level' },
        { key: 'critDamage', label: 'Critical Damage', desc: '+20% Critical Hit multiplier per level' },
        { key: 'specialUnlock', label: 'Special Attack Power', desc: '+25% Special Skill damage per level' }
      ];

      list.forEach((u) => {
        const lvl = d.upgrades[u.key] || 1;
        const cost = Math.round(120 * Math.pow(1.4, lvl - 1));
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
          <h3><span>${u.label}</span><span>LVL ${lvl}</span></h3>
          <p>${u.desc}</p>
          <button class="menu-btn primary-cta">UPGRADE (${cost} COINS)</button>
        `;
        card.querySelector('button').onclick = () => {
          if (d.coins >= cost) {
            d.coins -= cost;
            d.upgrades[u.key] = lvl + 1;
            if (d.upgrades[u.key] >= 5) d.achievements.ultimateWarrior.unlocked = true;
            global.SaveSystem.save();
            global.AudioSystem.sfxCoin();
            this.openUpgradesModal();
          } else {
            alert('Not enough Gold Coins!');
          }
        };
        body.appendChild(card);
      });
    },

    openMissionsModal() {
      const body = this.openModalShell('DAILY MISSIONS');
      const dm = global.SaveSystem.data.dailyMissions;
      ['defeat20', 'coins100', 'levels3', 'boss1', 'combos10'].forEach((k) => {
        const m = dm[k];
        const done = m.progress >= m.target;
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
          <h3>${m.desc}</h3>
          <p>Progress: <strong>${m.progress} / ${m.target}</strong> &bull; Reward: <strong>+${m.rewardCoins} Coins</strong></p>
          <button class="menu-btn ${done && !m.claimed ? 'primary-cta' : ''}" ${!done || m.claimed ? 'disabled style="opacity:0.5"' : ''}>
            ${m.claimed ? 'CLAIMED' : (done ? 'CLAIM REWARD' : 'IN PROGRESS')}
          </button>
        `;
        card.querySelector('button').onclick = () => {
          if (done && !m.claimed) {
            m.claimed = true;
            global.SaveSystem.addCoins(m.rewardCoins);
            global.AudioSystem.sfxVictory();
            this.openMissionsModal();
          }
        };
        body.appendChild(card);
      });
    },

    openAchievementsModal() {
      const body = this.openModalShell('WARRIOR ACHIEVEMENTS');
      const ach = global.SaveSystem.data.achievements;
      Object.keys(ach).forEach((k) => {
        const a = ach[k];
        const card = document.createElement('div');
        card.className = `item-card ${a.unlocked ? 'selected-card' : ''}`;
        card.innerHTML = `
          <h3>${a.title}</h3>
          <p>${a.desc} &bull; Reward: <strong>+${a.rewardGems} Gems</strong></p>
          <button class="menu-btn ${a.unlocked && !a.claimed ? 'primary-cta' : ''}" ${!a.unlocked || a.claimed ? 'disabled style="opacity:0.5"' : ''}>
            ${a.claimed ? 'REWARD CLAIMED' : (a.unlocked ? 'CLAIM GEMS' : 'LOCKED')}
          </button>
        `;
        card.querySelector('button').onclick = () => {
          if (a.unlocked && !a.claimed) {
            a.claimed = true;
            global.SaveSystem.addGems(a.rewardGems);
            global.AudioSystem.sfxVictory();
            this.openAchievementsModal();
          }
        };
        body.appendChild(card);
      });
    },

    openSettingsModal() {
      const body = this.openModalShell('AUDIO & GAME SETTINGS');
      const s = global.SaveSystem.data.settings;
      const card = document.createElement('div');
      card.className = 'item-card';
      card.style.gridColumn = '1 / -1';
      card.innerHTML = `
        <h3>Audio Synthesis Controls</h3>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin:10px 0;">
          <button id="set-music-toggle" class="menu-btn ${s.musicOn ? 'accent-cta' : ''}">MUSIC: ${s.musicOn ? 'ON' : 'OFF'}</button>
          <button id="set-sound-toggle" class="menu-btn ${s.soundOn ? 'accent-cta' : ''}">SOUND FX: ${s.soundOn ? 'ON' : 'OFF'}</button>
        </div>
        <label style="font-size:13px;">Music Volume: <input id="set-music-vol" type="range" min="0" max="1" step="0.05" value="${s.musicVol}"></label>
        <label style="font-size:13px;">Sound FX Volume: <input id="set-sound-vol" type="range" min="0" max="1" step="0.05" value="${s.soundVol}"></label>
      `;
      body.appendChild(card);

      card.querySelector('#set-music-toggle').onclick = () => {
        s.musicOn = !s.musicOn;
        global.SaveSystem.save();
        if (s.musicOn) global.AudioSystem.startMusic(0);
        else global.AudioSystem.stopMusic();
        this.openSettingsModal();
      };
      card.querySelector('#set-sound-toggle').onclick = () => {
        s.soundOn = !s.soundOn;
        global.SaveSystem.save();
        this.openSettingsModal();
      };
      card.querySelector('#set-music-vol').oninput = (e) => {
        s.musicVol = Number(e.target.value);
        global.SaveSystem.save();
      };
      card.querySelector('#set-sound-vol').oninput = (e) => {
        s.soundVol = Number(e.target.value);
        global.SaveSystem.save();
      };
    },

    openHowToModal() {
      const body = this.openModalShell('HOW TO PLAY & CONTROLS');
      body.innerHTML = `
        <div class="item-card">
          <h3>Desktop Keyboard Controls</h3>
          <p><strong>A / D or Left / Right Arrows:</strong> Move Warrior</p>
          <p><strong>W / Up Arrow / Space:</strong> Jump &amp; Double Jump</p>
          <p><strong>J:</strong> Light Attack / Punch Combo (3-5 Hits)</p>
          <p><strong>K:</strong> Heavy Attack / Kick / Weapon Strike</p>
          <p><strong>Down + K (In Air):</strong> Seismic Ground Slam</p>
          <p><strong>L:</strong> Special Attack (Uses 35 Energy)</p>
          <p><strong>Shift:</strong> Shadow Dodge / Slide</p>
          <p><strong>S / Down Arrow:</strong> Guard Block / Crouch</p>
          <p><strong>Esc:</strong> Pause Game</p>
        </div>
        <div class="item-card">
          <h3>Mobile Touchscreen Controls</h3>
          <p>Use the bottom-left directional buttons to Move Left, Move Right, or Guard/Crouch.</p>
          <p>Use the bottom-right combat cluster to Jump, Punch, Heavy Attack, Special Attack, and Dodge with full multi-touch support.</p>
        </div>
      `;
    },

    toggleFullscreen() {
      const el = document.documentElement;
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) el.requestFullscreen();
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  global.UISystem = UISystem;
})(window);
