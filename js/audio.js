// ============================================================
// NOVA STRIKE — Sistema de áudio (SFX + música)
// ============================================================
const AudioSys = (() => {
  const SFX_PATH = 'assets/sfx/';
  const MUSIC_PATH = 'assets/music/';

  const sfxFiles = {
    laserPlayer:  'laserSmall_001.ogg',
    laserEnemy:   'laserRetro_002.ogg',
    laserBoss:    'laserLarge_002.ogg',
    explosion:    'explosionCrunch_000.ogg',
    explosionBig: 'explosionCrunch_004.ogg',
    explosionLow: 'lowFrequency_explosion_000.ogg',
    shieldUp:     'forceField_000.ogg',
    shieldHit:    'forceField_002.ogg',
    hit:          'impactMetal_002.ogg',
    click:        'click_001.ogg',
    confirm:      'confirmation_001.ogg',
    error:        'error_004.ogg',
    powerup:      'powerup.ogg',
  };

  const musicFiles = {
    menu:     'menu.ogg',
    game:     'game.ogg',
    boss:     'boss.ogg',
    gameover: 'gameover.ogg',
  };

  const sfx = {};
  const music = {};
  let muted = false;
  let currentMusic = null;
  let unlocked = false;

  // pool de instâncias para tocar o mesmo som sobreposto
  const POOL_SIZE = 4;

  function load() {
    for (const [name, file] of Object.entries(sfxFiles)) {
      sfx[name] = [];
      for (let i = 0; i < POOL_SIZE; i++) {
        const a = new Audio(SFX_PATH + file);
        a.preload = 'auto';
        sfx[name].push(a);
      }
    }
    for (const [name, file] of Object.entries(musicFiles)) {
      const a = new Audio(MUSIC_PATH + file);
      a.preload = 'auto';
      a.loop = true;
      a.volume = 0.45;
      music[name] = a;
    }
  }

  function play(name, volume = 1) {
    if (muted || !unlocked || !sfx[name]) return;
    const pool = sfx[name];
    const a = pool.find(x => x.paused || x.ended) || pool[0];
    try {
      a.currentTime = 0;
      a.volume = volume;
      a.play().catch(() => {});
    } catch (e) { /* autoplay bloqueado: ignora */ }
  }

  function playMusic(name) {
    if (currentMusic === name) return;
    stopMusic();
    currentMusic = name;
    if (muted || !unlocked || !music[name]) return;
    music[name].currentTime = 0;
    music[name].play().catch(() => {});
  }

  function stopMusic() {
    if (currentMusic && music[currentMusic]) music[currentMusic].pause();
    currentMusic = null;
  }

  function toggleMute() {
    muted = !muted;
    if (muted) {
      for (const m of Object.values(music)) m.pause();
    } else if (currentMusic && music[currentMusic]) {
      music[currentMusic].play().catch(() => {});
    }
    return muted;
  }

  // navegadores exigem interação do usuário antes de tocar áudio
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (currentMusic && !muted && music[currentMusic]) {
      music[currentMusic].play().catch(() => {});
    }
  }

  function isMuted() { return muted; }

  return { load, play, playMusic, stopMusic, toggleMute, unlock, isMuted };
})();
