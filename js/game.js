// ============================================================
// NOVA STRIKE — Operação Última Fronteira
// Space shooter vertical em HTML5 Canvas
// Arte e áudio: Kenney (kenney.nl) — CC0
// ============================================================
'use strict';

(() => {

const W = 720, H = 960;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// polyfill para navegadores sem roundRect
if (!ctx.roundRect) {
  ctx.roundRect = function (x, y, w, h, r) {
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };
}

// ------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------
const rand  = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const pick  = arr => arr[Math.floor(Math.random() * arr.length)];
const lerp  = (a, b, t) => a + (b - a) * t;

// ------------------------------------------------------------
// Carregador de imagens
// ------------------------------------------------------------
const IMG_NAMES = [
  'playerShip1_blue', 'playerShip2_red', 'playerShip3_green',
  'playerShip1_damage1', 'playerShip1_damage2', 'playerShip1_damage3',
  'playerShip2_damage1', 'playerShip2_damage2', 'playerShip2_damage3',
  'playerShip3_damage1', 'playerShip3_damage2', 'playerShip3_damage3',
  'enemyBlack1', 'enemyBlue2', 'enemyGreen3', 'enemyRed4', 'enemyRed5',
  'ufoRed', 'ufoYellow',
  'laserBlue01', 'laserGreen11', 'laserRed01', 'laserRed05', 'laserBlue08',
  'meteorBrown_big1', 'meteorBrown_big3', 'meteorBrown_med1', 'meteorBrown_small1',
  'meteorGrey_big2', 'meteorGrey_med2', 'meteorGrey_small2',
  'powerupBlue_shield', 'powerupYellow_bolt', 'powerupGreen_star', 'pill_red',
  'shield1', 'shield2', 'shield3', 'fire08', 'fire13',
  'star1', 'star2', 'star3',
  'playerLife1_blue', 'playerLife2_red', 'playerLife3_green',
  'darkPurple', 'boss',
];
const IMG = {};
let assetsLoaded = 0, assetsTotal = IMG_NAMES.length;

function loadImages(onDone) {
  for (const name of IMG_NAMES) {
    const img = new Image();
    img.src = 'assets/img/' + name + '.png';
    img.onload = () => { if (++assetsLoaded >= assetsTotal) onDone(); };
    img.onerror = () => { console.warn('Falha ao carregar', name); if (++assetsLoaded >= assetsTotal) onDone(); };
    IMG[name] = img;
  }
}

function drawSprite(img, x, y, scale = 1, rot = 0, alpha = 1) {
  if (!img || !img.complete || !img.naturalWidth) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(img, -img.naturalWidth * scale / 2, -img.naturalHeight * scale / 2,
                img.naturalWidth * scale, img.naturalHeight * scale);
  ctx.restore();
}

// ------------------------------------------------------------
// Entrada
// ------------------------------------------------------------
const keys = {};
let pressedOnce = {};   // teclas que disparam ação única neste frame

window.addEventListener('keydown', e => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  if (!keys[e.key]) pressedOnce[e.key] = true;
  keys[e.key] = true;
  AudioSys.unlock();
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

// --- controles de toque (celular) ---
const pointer = { active: false, x: 0, y: 0 };

function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
}

canvas.addEventListener('pointerdown', e => {
  AudioSys.unlock();
  const p = canvasPos(e);
  pointer.active = true; pointer.x = p.x; pointer.y = p.y;
  if (state === ST.SHIP_SELECT) {
    // terço esquerdo/direito navega, centro confirma
    if (p.x < W / 3) { selIdx = (selIdx + SHIPS.length - 1) % SHIPS.length; AudioSys.play('click', 0.6); }
    else if (p.x > W * 2 / 3) { selIdx = (selIdx + 1) % SHIPS.length; AudioSys.play('click', 0.6); }
    else pressedOnce['Enter'] = true;
  } else if (state !== ST.PLAYING) {
    pressedOnce['Enter'] = true;   // qualquer toque avança telas
  }
});
canvas.addEventListener('pointermove', e => {
  if (!pointer.active) return;
  const p = canvasPos(e);
  pointer.x = p.x; pointer.y = p.y;
});
window.addEventListener('pointerup', () => { pointer.active = false; });
window.addEventListener('pointercancel', () => { pointer.active = false; });

const axis = () => ({
  x: (keys['ArrowLeft'] || keys['a'] || keys['A'] ? -1 : 0) + (keys['ArrowRight'] || keys['d'] || keys['D'] ? 1 : 0),
  y: (keys['ArrowUp']   || keys['w'] || keys['W'] ? -1 : 0) + (keys['ArrowDown']  || keys['s'] || keys['S'] ? 1 : 0),
});
const firing  = () => keys[' '];
const justPressed = k => !!pressedOnce[k];
const confirmPressed = () => justPressed('Enter') || justPressed(' ');

// ------------------------------------------------------------
// Definições das naves jogáveis
// ------------------------------------------------------------
const SHIPS = [
  { name: 'FALCÃO-7',  img: 'playerShip1_blue',  dmg: 'playerShip1_damage', life: 'playerLife1_blue',
    speed: 380, hp: 100, fireRate: 0.16, power: 10, laser: 'laserBlue01',
    desc: 'Caça de interceptação equilibrado.', stats: { vel: 3, blind: 3, fogo: 3 } },
  { name: 'VINGADOR',  img: 'playerShip2_red',   dmg: 'playerShip2_damage', life: 'playerLife2_red',
    speed: 300, hp: 140, fireRate: 0.24, power: 19, laser: 'laserRed01',
    desc: 'Bombardeiro blindado de assalto.', stats: { vel: 2, blind: 5, fogo: 4 } },
  { name: 'ESPECTRO',  img: 'playerShip3_green', dmg: 'playerShip3_damage', life: 'playerLife3_green',
    speed: 455, hp: 75, fireRate: 0.11, power: 7, laser: 'laserGreen11',
    desc: 'Caça leve experimental de ataque rápido.', stats: { vel: 5, blind: 2, fogo: 4 } },
];

// ------------------------------------------------------------
// Definições dos inimigos
// ------------------------------------------------------------
const ENEMY_DEFS = {
  scout:    { img: 'enemyBlack1', hp: 20,  score: 100,  r: 30, scale: 0.7 },
  fighter:  { img: 'enemyBlue2',  hp: 32,  score: 150,  r: 30, scale: 0.7 },
  bomber:   { img: 'enemyGreen3', hp: 75,  score: 250,  r: 36, scale: 0.85 },
  kamikaze: { img: 'enemyRed4',   hp: 15,  score: 120,  r: 26, scale: 0.62 },
  elite:    { img: 'enemyRed5',   hp: 60,  score: 300,  r: 32, scale: 0.78 },
  ufo:      { img: 'ufoRed',      hp: 55,  score: 350,  r: 34, scale: 0.75 },
  miniboss: { img: 'ufoYellow',   hp: 420, score: 1500, r: 58, scale: 1.35 },
};

// ------------------------------------------------------------
// Setores (campanha)
// ------------------------------------------------------------
const SECTORS = [
  { name: 'SETOR 1 — CINTURÃO DE DETRITOS',
    radio: 'COMANDO: Aqui é a base Aurora. O caminho até Kepler está coberto de destroços. Batedores da Armada patrulham o cinturão. Abra caminho, piloto.',
    dur: 40, spawns: { meteor: 1.0, scout: 0.30 } },
  { name: 'SETOR 2 — PATRULHA EXTERNA',
    radio: 'COMANDO: Eles sabem que você está aí. Esquadrões de caça em rota de interceptação. Não pare de se mover!',
    dur: 45, spawns: { meteor: 0.45, scout: 0.28, fighter: 0.22, kamikaze: 0.08 } },
  { name: 'SETOR 3 — ZONA DE BLOQUEIO',
    radio: 'COMANDO: Sensores detectam dois discos de guerra guardando o bloqueio orbital. Cuidado com o padrão espiral. Derrube-os!',
    dur: 42, spawns: { meteor: 0.35, scout: 0.18, fighter: 0.20, bomber: 0.13, kamikaze: 0.08 }, miniboss: true },
  { name: 'SETOR 4 — TEMPESTADE SOLAR',
    radio: 'COMANDO: Radiação no limite. A elite da Armada Vazia está aqui... e os discos vermelhos não dão trégua. Sobreviva.',
    dur: 50, spawns: { meteor: 0.55, fighter: 0.26, bomber: 0.15, kamikaze: 0.18, elite: 0.13, ufo: 0.07 } },
  { name: 'SETOR 5 — A HEGEMONIA',
    radio: 'COMANDO: Meu Deus... ela é do tamanho de uma cidade. Toda a esperança da colônia está com você agora. DESTRUA A NAVE-MÃE!',
    dur: 0, spawns: {}, boss: true },
];

// ------------------------------------------------------------
// História
// ------------------------------------------------------------
const STORY_INTRO = [
  'ANO 2347.\n\nA humanidade prospera em doze colônias espalhadas pela fronteira estelar. Kepler-186f é a joia mais distante — meio milhão de almas sob um céu vermelho.',
  'Há três dias, Kepler silenciou.\n\nAs sondas revelaram o impensável: a ARMADA VAZIA. Uma frota de guerra autônoma de uma era esquecida, desperta e sem mestre, consumindo tudo em seu caminho.',
  'A frota colonial foi dizimada em horas.\n\nResta um único caça experimental no hangar da base Aurora. Restam cinco setores até a nave-mãe HEGEMONIA.\n\nResta você, piloto.',
];
const STORY_VICTORY = [
  'A HEGEMONIA se parte em silêncio.\n\nPor um longo segundo, o vazio inteiro parece prender a respiração — então a Armada cai, máquina por máquina, como marionetes sem fios.',
  'Os rádios de Kepler-186f voltam à vida. Meio milhão de vozes, todas falando ao mesmo tempo.\n\nNa base Aurora, alguém abre o canal e diz apenas:\n\n"Volte para casa, piloto. Acabou."',
];

// ------------------------------------------------------------
// Estado global do jogo
// ------------------------------------------------------------
const ST = {
  LOADING: 0, MENU: 1, SHIP_SELECT: 2, STORY: 3, SECTOR_INTRO: 4,
  PLAYING: 5, GAME_OVER: 6, VICTORY: 7,
};

let state = ST.LOADING;
let paused = false;
let time = 0;            // tempo global (s)
let shake = 0;           // intensidade do tremor de tela

let hiScore = 0;
try { hiScore = parseInt(localStorage.getItem('novastrike_hiscore') || '0', 10) || 0; } catch (e) {}

const G = {               // estado da partida
  shipIdx: 0,
  score: 0,
  lives: 3,
  sector: 0,
  sectorTime: 0,
  sectorDone: false,
  minibossSpawned: false,
  bossSpawned: false,
  runTime: 0,
  kills: 0,
};

let player = null;
let bullets = [];        // tiros do jogador
let eBullets = [];       // tiros inimigos
let enemies = [];
let meteors = [];
let powerups = [];
let particles = [];
let floaters = [];       // textos flutuantes
let boss = null;

// história / telas
let storyPages = [], storyPage = 0, storyChars = 0, storyNext = ST.MENU;
let menuBlink = 0;
let selIdx = 0;
let gameOverTimer = 0;

// ------------------------------------------------------------
// Fundo estelar com parallax
// ------------------------------------------------------------
const stars = [];
function initStars() {
  stars.length = 0;
  for (let i = 0; i < 80; i++) {
    const layer = randi(0, 2);
    stars.push({
      x: rand(0, W), y: rand(0, H), layer,
      speed: [28, 60, 110][layer],
      img: ['star1', 'star2', 'star3'][layer],
      scale: [0.45, 0.6, 0.85][layer],
      alpha: [0.35, 0.55, 0.9][layer],
    });
  }
}
let bgScroll = 0;

function updateBackground(dt) {
  bgScroll = (bgScroll + 22 * dt) % 256;
  for (const s of stars) {
    s.y += s.speed * dt;
    if (s.y > H + 8) { s.y = -8; s.x = rand(0, W); }
  }
}

function drawBackground() {
  const tile = IMG['darkPurple'];
  if (tile && tile.complete) {
    for (let y = -256 + bgScroll; y < H; y += 256)
      for (let x = 0; x < W; x += 256)
        ctx.drawImage(tile, x, y);
  } else {
    ctx.fillStyle = '#0b0a18';
    ctx.fillRect(0, 0, W, H);
  }
  for (const s of stars) drawSprite(IMG[s.img], s.x, s.y, s.scale, 0, s.alpha);
}

// ------------------------------------------------------------
// Partículas e efeitos
// ------------------------------------------------------------
function spawnExplosion(x, y, size = 1, color = '#ffae34') {
  const n = Math.floor(14 * size);
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(40, 260) * size;
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.3, 0.8), maxLife: 0.8, r: rand(2, 5) * size,
      color: pick([color, '#ffe08a', '#ff6b35', '#d8d8d8']),
    });
  }
  particles.push({ x, y, vx: 0, vy: 0, life: 0.25, maxLife: 0.25, r: 38 * size, color: '#fff7da', flash: true });
  shake = Math.min(18, shake + 5 * size);
}

function spawnSparks(x, y, color = '#9ce0ff') {
  for (let i = 0; i < 6; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(30, 130);
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.15, 0.35), maxLife: 0.35, r: rand(1.5, 3), color });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= (1 - 1.5 * dt); p.vy *= (1 - 1.5 * dt);
  }
}

function drawParticles() {
  for (const p of particles) {
    const t = p.life / p.maxLife;
    ctx.globalAlpha = p.flash ? t * 0.9 : t;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.flash ? p.r * (1.6 - t) : p.r * t, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function addFloater(x, y, text, color = '#ffe08a') {
  floaters.push({ x, y, text, color, life: 0.9 });
}

function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.y -= 40 * dt; f.life -= dt;
    if (f.life <= 0) floaters.splice(i, 1);
  }
}

function drawFloaters() {
  ctx.textAlign = 'center';
  for (const f of floaters) {
    ctx.globalAlpha = clamp(f.life / 0.4, 0, 1);
    ctx.fillStyle = f.color;
    ctx.font = '18px "Kenney Mono", monospace';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------
// Jogador
// ------------------------------------------------------------
function newPlayer(shipIdx) {
  const def = SHIPS[shipIdx];
  return {
    def, x: W / 2, y: H - 130,
    hp: def.hp, maxHp: def.hp,
    r: 26,
    fireCd: 0,
    weapon: 1,           // nível da arma (1-3)
    shield: 0,           // cargas de escudo (0-3)
    rapid: 0,            // tempo restante de tiro rápido
    invuln: 2.0,         // invulnerabilidade ao (re)nascer
    engineAnim: 0,
    dead: false,
    respawnTimer: 0,
  };
}

function updatePlayer(dt) {
  const p = player;
  if (p.dead) {
    p.respawnTimer -= dt;
    if (p.respawnTimer <= 0) {
      if (G.lives > 0) {
        const idx = G.shipIdx;
        const w = Math.max(1, p.weapon - 1);
        player = newPlayer(idx);
        player.weapon = w;
      } else {
        triggerGameOver();
      }
    }
    return;
  }

  const a = axis();
  const len = Math.hypot(a.x, a.y) || 1;
  p.x = clamp(p.x + (a.x / len) * p.def.speed * dt, 36, W - 36);
  p.y = clamp(p.y + (a.y / len) * p.def.speed * dt, H * 0.35, H - 50);

  // toque: a nave segue o dedo (com folga para não ficar embaixo dele)
  if (pointer.active) {
    const tx = clamp(pointer.x, 36, W - 36);
    const ty = clamp(pointer.y - 110, H * 0.35, H - 50);
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d > 4) {
      const step = Math.min(p.def.speed * 1.2 * dt, d);
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
    }
  }

  p.invuln = Math.max(0, p.invuln - dt);
  p.rapid = Math.max(0, p.rapid - dt);
  p.engineAnim += dt * 18;
  p.fireCd -= dt;

  if ((firing() || pointer.active) && p.fireCd <= 0) {
    const rate = p.def.fireRate * (p.rapid > 0 ? 0.55 : 1);
    p.fireCd = rate;
    firePlayerWeapon();
  }
}

function firePlayerWeapon() {
  const p = player;
  const img = p.def.laser;
  const mk = (dx, angle = 0) => bullets.push({
    x: p.x + dx, y: p.y - 38, vx: Math.sin(angle) * 700, vy: -Math.cos(angle) * 700,
    dmg: p.def.power, img, r: 8, rot: angle,
  });
  if (p.weapon === 1) mk(0);
  else if (p.weapon === 2) { mk(-16); mk(16); }
  else { mk(-18); mk(18); mk(-26, -0.18); mk(26, 0.18); }
  AudioSys.play('laserPlayer', 0.4);
}

function damagePlayer(amount) {
  const p = player;
  if (p.dead || p.invuln > 0) return;
  if (p.shield > 0) {
    p.shield--;
    AudioSys.play('shieldHit', 0.7);
    spawnSparks(p.x, p.y, '#7fd4ff');
    p.invuln = 0.35;
    return;
  }
  p.hp -= amount;
  AudioSys.play('hit', 0.7);
  spawnSparks(p.x, p.y, '#ffb37f');
  shake = Math.min(18, shake + 6);
  p.invuln = 0.5;
  if (p.hp <= 0) killPlayer();
}

function killPlayer() {
  const p = player;
  if (p.dead) return;
  p.dead = true;
  p.respawnTimer = 1.6;
  G.lives--;
  spawnExplosion(p.x, p.y, 1.6);
  AudioSys.play('explosionBig', 0.9);
}

function drawPlayer() {
  const p = player;
  if (p.dead) return;
  if (p.invuln > 0 && Math.floor(time * 12) % 2 === 0) return; // pisca invulnerável

  // chama do motor
  const flame = Math.floor(p.engineAnim) % 2 === 0 ? 'fire08' : 'fire13';
  const moving = axis().y < 0 ? 1.3 : 1;
  drawSprite(IMG[flame], p.x, p.y + 40, 0.8 * moving, 0, 0.9);

  drawSprite(IMG[p.def.img], p.x, p.y, 0.66);

  // dano visual progressivo
  const fr = p.hp / p.maxHp;
  let dmgImg = null;
  if (fr < 0.3) dmgImg = p.def.dmg + '3';
  else if (fr < 0.6) dmgImg = p.def.dmg + '2';
  else if (fr < 0.85) dmgImg = p.def.dmg + '1';
  if (dmgImg) drawSprite(IMG[dmgImg], p.x, p.y, 0.66);

  // escudo
  if (p.shield > 0) {
    const simg = 'shield' + clamp(p.shield, 1, 3);
    drawSprite(IMG[simg], p.x, p.y - 4, 0.62, 0, 0.75 + 0.2 * Math.sin(time * 6));
  }
}

// ------------------------------------------------------------
// Inimigos
// ------------------------------------------------------------
function spawnEnemy(type) {
  const def = ENEMY_DEFS[type];
  const e = {
    type, def, hp: def.hp,
    x: rand(60, W - 60), y: -60,
    vx: 0, vy: 0, t: rand(0, 10),
    fireCd: rand(0.8, 2.2),
    phase: 0,
  };
  if (type === 'elite') { e.y = -50; e.targetY = rand(90, 220); }
  if (type === 'miniboss') { e.x = W / 2 + (G.minibossSpawned ? 180 : -180); e.targetY = 170; e.fireCd = 1.2; }
  enemies.push(e);
}

function fireEnemyBullet(x, y, angle, speed = 300, img = 'laserRed05') {
  eBullets.push({ x, y, vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed, img, r: 7, rot: -angle + Math.PI });
}

function aimAtPlayer(x, y) {
  if (!player || player.dead) return 0;
  return Math.atan2(player.x - x, player.y - y);
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.t += dt;
    e.fireCd -= dt;

    switch (e.type) {
      case 'scout':
        e.y += 115 * dt;
        e.x += Math.sin(e.t * 2.2) * 70 * dt;
        if (e.fireCd <= 0) { e.fireCd = 2.3; fireEnemyBullet(e.x, e.y + 28, 0, 270); AudioSys.play('laserEnemy', 0.25); }
        break;
      case 'fighter':
        e.y += 150 * dt;
        e.x += Math.sin(e.t * 4.5) * 160 * dt;
        if (e.fireCd <= 0) { e.fireCd = 1.9; fireEnemyBullet(e.x, e.y + 28, aimAtPlayer(e.x, e.y), 330); AudioSys.play('laserEnemy', 0.25); }
        break;
      case 'bomber':
        e.y += 58 * dt;
        if (e.fireCd <= 0) {
          e.fireCd = 2.6;
          for (const off of [-0.35, 0, 0.35]) fireEnemyBullet(e.x, e.y + 30, off, 250);
          AudioSys.play('laserEnemy', 0.3);
        }
        break;
      case 'kamikaze': {
        // mergulha na direção do jogador
        const ang = aimAtPlayer(e.x, e.y);
        const sp = 130 + e.t * 130;
        e.x += Math.sin(ang) * sp * dt * 0.7;
        e.y += Math.max(Math.cos(ang), 0.45) * sp * dt;
        break;
      }
      case 'elite':
        if (e.y < e.targetY) e.y += 130 * dt;
        else {
          e.x += Math.sin(e.t * 1.6) * 190 * dt;
          e.x = clamp(e.x, 50, W - 50);
          if (e.fireCd <= 0) {
            e.fireCd = 2.2; e.burst = 3; e.burstCd = 0;
          }
        }
        if (e.burst > 0) {
          e.burstCd -= dt;
          if (e.burstCd <= 0) {
            e.burstCd = 0.14; e.burst--;
            fireEnemyBullet(e.x, e.y + 28, aimAtPlayer(e.x, e.y), 380);
            AudioSys.play('laserEnemy', 0.25);
          }
        }
        break;
      case 'ufo':
        e.y += 55 * dt;
        e.x += Math.cos(e.t * 1.8) * 110 * dt;
        if (e.fireCd <= 0) {
          e.fireCd = 1.6;
          for (let k = 0; k < 6; k++) fireEnemyBullet(e.x, e.y, e.phase + k * Math.PI / 3, 220, 'laserBlue08');
          e.phase += 0.5;
          AudioSys.play('laserEnemy', 0.3);
        }
        break;
      case 'miniboss':
        if (e.y < e.targetY) e.y += 90 * dt;
        else {
          e.x += Math.sin(e.t * 0.9) * 120 * dt;
          e.x = clamp(e.x, 80, W - 80);
          if (e.fireCd <= 0) {
            e.fireCd = 1.1;
            for (let k = 0; k < 8; k++) fireEnemyBullet(e.x, e.y, e.phase + k * Math.PI / 4, 240, 'laserBlue08');
            e.phase += 0.42;
            AudioSys.play('laserEnemy', 0.35);
          }
        }
        break;
    }

    // saiu da tela
    if (e.y > H + 80 || e.x < -100 || e.x > W + 100) { enemies.splice(i, 1); continue; }

    // colisão com jogador
    if (player && !player.dead && dist2(e.x, e.y, player.x, player.y) < (e.def.r + player.r) ** 2) {
      damagePlayer(e.type === 'kamikaze' ? 35 : 25);
      damageEnemy(e, 40, i);
    }
  }
}

function damageEnemy(e, dmg, idx) {
  e.hp -= dmg;
  e.flash = 0.08;
  if (e.hp <= 0) {
    const i = idx !== undefined ? idx : enemies.indexOf(e);
    if (i >= 0) enemies.splice(i, 1);
    G.score += e.def.score;
    G.kills++;
    addFloater(e.x, e.y, '+' + e.def.score);
    spawnExplosion(e.x, e.y, e.type === 'miniboss' ? 2.2 : 1);
    AudioSys.play(e.type === 'miniboss' ? 'explosionBig' : 'explosion', 0.6);
    maybeDropPowerup(e.x, e.y, e.type === 'miniboss' ? 1 : 0.13);
  }
}

function drawEnemies() {
  for (const e of enemies) {
    drawSprite(IMG[e.def.img], e.x, e.y, e.def.scale);
    if (e.flash > 0) {
      e.flash -= 1 / 60;
      ctx.globalCompositeOperation = 'lighter';
      drawSprite(IMG[e.def.img], e.x, e.y, e.def.scale, 0, 0.6);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (e.type === 'miniboss') {
      // barra de vida do miniboss
      const w = 90, fr = clamp(e.hp / e.def.hp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(e.x - w / 2, e.y - 75, w, 7);
      ctx.fillStyle = '#ffd23e';
      ctx.fillRect(e.x - w / 2, e.y - 75, w * fr, 7);
    }
  }
}

// ------------------------------------------------------------
// Meteoros
// ------------------------------------------------------------
const METEOR_TIERS = {
  big:   { imgs: ['meteorBrown_big1', 'meteorBrown_big3', 'meteorGrey_big2'], hp: 45, r: 42, score: 75,  next: 'med',   frag: 2 },
  med:   { imgs: ['meteorBrown_med1', 'meteorGrey_med2'],                     hp: 20, r: 22, score: 50,  next: 'small', frag: 2 },
  small: { imgs: ['meteorBrown_small1', 'meteorGrey_small2'],                 hp: 8,  r: 13, score: 25,  next: null,    frag: 0 },
};

function spawnMeteor(tier = 'big', x, y, vx, vy) {
  const def = METEOR_TIERS[tier];
  meteors.push({
    tier, def, img: pick(def.imgs), hp: def.hp,
    x: x !== undefined ? x : rand(40, W - 40),
    y: y !== undefined ? y : -70,
    vx: vx !== undefined ? vx : rand(-40, 40),
    vy: vy !== undefined ? vy : rand(70, 160),
    rot: rand(0, Math.PI * 2), rotSpd: rand(-1.6, 1.6),
  });
}

function updateMeteors(dt) {
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];
    m.x += m.vx * dt; m.y += m.vy * dt; m.rot += m.rotSpd * dt;
    if (m.y > H + 90 || m.x < -90 || m.x > W + 90) { meteors.splice(i, 1); continue; }
    if (player && !player.dead && dist2(m.x, m.y, player.x, player.y) < (m.def.r + player.r - 6) ** 2) {
      damagePlayer(m.tier === 'big' ? 30 : m.tier === 'med' ? 20 : 12);
      destroyMeteor(m, i, false);
    }
  }
}

function damageMeteor(m, dmg, idx) {
  m.hp -= dmg;
  if (m.hp <= 0) destroyMeteor(m, idx, true);
}

function destroyMeteor(m, idx, givePoints) {
  meteors.splice(idx, 1);
  if (givePoints) { G.score += m.def.score; addFloater(m.x, m.y, '+' + m.def.score, '#d8c8a8'); }
  spawnExplosion(m.x, m.y, m.tier === 'big' ? 1.1 : 0.6, '#c8a888');
  AudioSys.play('explosionLow', 0.45);
  if (m.def.next) {
    for (let k = 0; k < m.def.frag; k++)
      spawnMeteor(m.def.next, m.x + rand(-12, 12), m.y + rand(-12, 12), rand(-90, 90), rand(60, 170));
  }
  if (givePoints) maybeDropPowerup(m.x, m.y, 0.08);
}

function drawMeteors() {
  for (const m of meteors) drawSprite(IMG[m.img], m.x, m.y, 1, m.rot);
}

// ------------------------------------------------------------
// Power-ups
// ------------------------------------------------------------
const PU_TYPES = [
  { type: 'bolt',   img: 'powerupYellow_bolt', w: 30 },
  { type: 'shield', img: 'powerupBlue_shield', w: 25 },
  { type: 'star',   img: 'powerupGreen_star',  w: 20 },
  { type: 'pill',   img: 'pill_red',           w: 25 },
];

function maybeDropPowerup(x, y, chance) {
  if (Math.random() > chance) return;
  const total = PU_TYPES.reduce((s, p) => s + p.w, 0);
  let r = Math.random() * total;
  let chosen = PU_TYPES[0];
  for (const p of PU_TYPES) { r -= p.w; if (r <= 0) { chosen = p; break; } }
  powerups.push({ ...chosen, x, y, vy: 90, t: 0 });
}

function updatePowerups(dt) {
  for (let i = powerups.length - 1; i >= 0; i--) {
    const pu = powerups[i];
    pu.t += dt;
    pu.y += pu.vy * dt;
    pu.x += Math.sin(pu.t * 3) * 30 * dt;
    if (pu.y > H + 40) { powerups.splice(i, 1); continue; }
    if (player && !player.dead && dist2(pu.x, pu.y, player.x, player.y) < 42 ** 2) {
      applyPowerup(pu.type);
      powerups.splice(i, 1);
    }
  }
}

function applyPowerup(type) {
  const p = player;
  G.score += 50;
  switch (type) {
    case 'bolt':
      if (p.weapon < 3) { p.weapon++; addFloater(p.x, p.y - 40, 'ARMA NV.' + p.weapon, '#ffd23e'); }
      else { G.score += 200; addFloater(p.x, p.y - 40, '+250', '#ffd23e'); }
      AudioSys.play('powerup', 0.8);
      break;
    case 'shield':
      p.shield = clamp(p.shield + 1, 0, 3);
      addFloater(p.x, p.y - 40, 'ESCUDO', '#7fd4ff');
      AudioSys.play('shieldUp', 0.8);
      break;
    case 'star':
      p.rapid = 7;
      addFloater(p.x, p.y - 40, 'TIRO RÁPIDO!', '#8aff9c');
      AudioSys.play('powerup', 0.8);
      break;
    case 'pill':
      p.hp = clamp(p.hp + 35, 0, p.maxHp);
      addFloater(p.x, p.y - 40, '+35 CASCO', '#ff8a9c');
      AudioSys.play('confirm', 0.8);
      break;
  }
}

function drawPowerups() {
  for (const pu of powerups) {
    const pulse = 1 + 0.12 * Math.sin(pu.t * 6);
    drawSprite(IMG[pu.img], pu.x, pu.y, pulse);
  }
}

// ------------------------------------------------------------
// Projéteis
// ------------------------------------------------------------
function updateBullets(dt) {
  // tiros do jogador
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y < -40 || b.x < -20 || b.x > W + 20) { bullets.splice(i, 1); continue; }

    let consumed = false;
    // contra inimigos
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (dist2(b.x, b.y, e.x, e.y) < (e.def.r + b.r) ** 2) {
        damageEnemy(e, b.dmg, j);
        spawnSparks(b.x, b.y);
        bullets.splice(i, 1);
        consumed = true;
        break;
      }
    }
    if (consumed) continue;
    // contra meteoros
    for (let j = meteors.length - 1; j >= 0; j--) {
      const m = meteors[j];
      if (dist2(b.x, b.y, m.x, m.y) < (m.def.r + b.r) ** 2) {
        damageMeteor(m, b.dmg, j);
        spawnSparks(b.x, b.y, '#e8c8a0');
        bullets.splice(i, 1);
        consumed = true;
        break;
      }
    }
    if (consumed) continue;
    // contra o chefe
    if (boss && boss.active && dist2(b.x, b.y, boss.x, boss.y) < (boss.r + b.r) ** 2) {
      damageBoss(b.dmg);
      spawnSparks(b.x, b.y, '#ffb0b0');
      bullets.splice(i, 1);
    }
  }

  // tiros inimigos
  for (let i = eBullets.length - 1; i >= 0; i--) {
    const b = eBullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y > H + 30 || b.y < -30 || b.x < -30 || b.x > W + 30) { eBullets.splice(i, 1); continue; }
    if (player && !player.dead && dist2(b.x, b.y, player.x, player.y) < (player.r + b.r - 6) ** 2) {
      eBullets.splice(i, 1);
      damagePlayer(14);
    }
  }
}

function drawBullets() {
  for (const b of bullets) drawSprite(IMG[b.img], b.x, b.y, 0.9, b.rot);
  for (const b of eBullets) drawSprite(IMG[b.img], b.x, b.y, 1, b.rot || 0);
}

// ------------------------------------------------------------
// Chefe final — A HEGEMONIA
// ------------------------------------------------------------
function spawnBoss() {
  boss = {
    x: W / 2, y: -220, targetY: 215,
    hp: 4200, maxHp: 4200, r: 105,
    active: false, t: 0, fireCd: 2, spiral: 0,
    summonCd: 7, phase: 1, deathTimer: 0, dying: false,
  };
  AudioSys.playMusic('boss');
}

function damageBoss(dmg) {
  if (!boss || boss.dying) return;
  boss.hp -= dmg;
  boss.flash = 0.06;
  if (boss.hp <= 0) {
    boss.dying = true;
    boss.deathTimer = 3.2;
    eBullets.length = 0;
    enemies.length = 0;
    AudioSys.play('explosionBig', 1);
  }
}

function updateBoss(dt) {
  if (!boss) return;
  const b = boss;
  b.t += dt;

  if (b.dying) {
    b.deathTimer -= dt;
    if (Math.random() < 0.35) {
      spawnExplosion(b.x + rand(-130, 130), b.y + rand(-110, 110), rand(0.8, 1.8));
      AudioSys.play('explosion', 0.5);
    }
    shake = 10;
    if (b.deathTimer <= 0) {
      spawnExplosion(b.x, b.y, 4);
      AudioSys.play('explosionBig', 1);
      G.score += 5000;
      addFloater(b.x, b.y, '+5000');
      boss = null;
      startVictory();
    }
    return;
  }

  // entrada em cena
  if (b.y < b.targetY) { b.y += 70 * dt; return; }
  b.active = true;

  // fases pelo HP
  const fr = b.hp / b.maxHp;
  b.phase = fr > 0.66 ? 1 : fr > 0.33 ? 2 : 3;

  // movimento
  const spd = b.phase === 3 ? 1.4 : b.phase === 2 ? 1.0 : 0.6;
  b.x = W / 2 + Math.sin(b.t * spd) * (W / 2 - 160);

  // padrões de tiro
  b.fireCd -= dt;
  if (b.fireCd <= 0) {
    if (b.phase === 1) {
      b.fireCd = 1.5;
      const aim = aimAtPlayer(b.x, b.y);
      for (let k = -2; k <= 2; k++) fireEnemyBullet(b.x, b.y + 90, aim + k * 0.16, 320);
      AudioSys.play('laserBoss', 0.5);
    } else if (b.phase === 2) {
      b.fireCd = 0.55;
      for (let k = 0; k < 5; k++) fireEnemyBullet(b.x, b.y + 60, b.spiral + k * Math.PI * 2 / 5, 250, 'laserBlue08');
      b.spiral += 0.45;
      AudioSys.play('laserBoss', 0.35);
    } else {
      b.fireCd = 0.9;
      const aim = aimAtPlayer(b.x, b.y);
      for (let k = -3; k <= 3; k++) fireEnemyBullet(b.x, b.y + 90, aim + k * 0.13, 360);
      for (let k = 0; k < 8; k++) fireEnemyBullet(b.x, b.y + 40, b.spiral + k * Math.PI / 4, 210, 'laserBlue08');
      b.spiral += 0.35;
      AudioSys.play('laserBoss', 0.5);
    }
  }

  // invoca reforços
  if (b.phase >= 2) {
    b.summonCd -= dt;
    if (b.summonCd <= 0) {
      b.summonCd = b.phase === 3 ? 5 : 7;
      spawnEnemy(b.phase === 3 ? 'kamikaze' : 'fighter');
      spawnEnemy('fighter');
    }
  }

  // colisão corpo a corpo
  if (player && !player.dead && dist2(b.x, b.y, player.x, player.y) < (b.r + player.r - 10) ** 2) {
    damagePlayer(40);
  }
}

function drawBoss() {
  if (!boss) return;
  const b = boss;
  const wobble = Math.sin(b.t * 2) * 4;
  drawSprite(IMG['boss'], b.x, b.y + wobble, 0.85, Math.PI);
  if (b.flash > 0) {
    b.flash -= 1 / 60;
    ctx.globalCompositeOperation = 'lighter';
    drawSprite(IMG['boss'], b.x, b.y + wobble, 0.85, Math.PI, 0.5);
    ctx.globalCompositeOperation = 'source-over';
  }
  // barra de vida do chefe
  if (b.active && !b.dying) {
    const bw = W - 160, fr = clamp(b.hp / b.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(80, 28, bw, 16);
    const grad = ctx.createLinearGradient(80, 0, 80 + bw, 0);
    grad.addColorStop(0, '#ff4757'); grad.addColorStop(1, '#ff9f43');
    ctx.fillStyle = grad;
    ctx.fillRect(80, 28, bw * fr, 16);
    ctx.strokeStyle = 'rgba(255,255,255,.4)';
    ctx.strokeRect(80, 28, bw, 16);
    ctx.fillStyle = '#ffd9dc';
    ctx.font = '14px "Kenney Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NAVE-MÃE HEGEMONIA', W / 2, 60);
  }
}

// ------------------------------------------------------------
// Diretor de setores (spawn e progressão)
// ------------------------------------------------------------
function updateDirector(dt) {
  const sec = SECTORS[G.sector];
  G.sectorTime += dt;
  G.runTime += dt;

  if (sec.boss) {
    if (!G.bossSpawned) { G.bossSpawned = true; spawnBoss(); }
    return;
  }

  const progress = clamp(G.sectorTime / sec.dur, 0, 1);
  const intensity = 0.7 + 0.6 * progress;

  if (G.sectorTime < sec.dur) {
    for (const [type, rate] of Object.entries(sec.spawns)) {
      if (Math.random() < rate * intensity * dt) {
        if (type === 'meteor') spawnMeteor('big');
        else spawnEnemy(type);
      }
    }
  } else if (sec.miniboss && !G.minibossSpawned) {
    spawnEnemy('miniboss');
    G.minibossSpawned = true;
    spawnEnemy('miniboss');
  } else {
    // setor termina quando a tela esvazia (no setor 3, quando os minibosses caem)
    const minibossAlive = enemies.some(e => e.type === 'miniboss');
    if (!minibossAlive && enemies.length === 0 && G.sectorTime > sec.dur + 1.5) {
      nextSector();
    }
  }
}

function nextSector() {
  G.score += 1000;
  addFloater(W / 2, H / 2, 'SETOR LIMPO! +1000');
  AudioSys.play('confirm', 0.9);
  G.sector++;
  G.sectorTime = 0;
  G.minibossSpawned = false;
  enemies.length = 0; eBullets.length = 0; meteors.length = 0;
  startSectorIntro();
}

// ------------------------------------------------------------
// Fluxo de telas / estados
// ------------------------------------------------------------
function startGame(shipIdx) {
  G.shipIdx = shipIdx;
  G.score = 0; G.lives = 3; G.sector = 0; G.sectorTime = 0;
  G.minibossSpawned = false; G.bossSpawned = false;
  G.runTime = 0; G.kills = 0;
  bullets = []; eBullets = []; enemies = []; meteors = [];
  powerups = []; particles = []; floaters = [];
  boss = null;
  player = newPlayer(shipIdx);
  startSectorIntro();
}

function startSectorIntro() {
  state = ST.SECTOR_INTRO;
  storyPages = [SECTORS[G.sector].radio];
  storyPage = 0; storyChars = 0;
}

function startStory(pages, next) {
  state = ST.STORY;
  storyPages = pages; storyPage = 0; storyChars = 0; storyNext = next;
}

function triggerGameOver() {
  state = ST.GAME_OVER;
  gameOverTimer = 0;
  AudioSys.playMusic('gameover');
  saveHiScore();
}

function startVictory() {
  state = ST.VICTORY;
  gameOverTimer = 0;
  AudioSys.playMusic('menu');
  saveHiScore();
}

function saveHiScore() {
  if (G.score > hiScore) {
    hiScore = G.score;
    try { localStorage.setItem('novastrike_hiscore', String(hiScore)); } catch (e) {}
  }
}

// ------------------------------------------------------------
// Telas (desenho)
// ------------------------------------------------------------
function drawTitle(text, y, size = 54, color = '#ffffff', glow = '#7a5cff') {
  ctx.textAlign = 'center';
  ctx.font = size + 'px "Kenney Future", sans-serif';
  ctx.shadowColor = glow;
  ctx.shadowBlur = 24;
  ctx.fillStyle = color;
  ctx.fillText(text, W / 2, y);
  ctx.shadowBlur = 0;
}

function drawMenu(dt) {
  menuBlink += dt;
  drawTitle('NOVA', H * 0.26, 96, '#ffffff', '#7a5cff');
  drawTitle('STRIKE', H * 0.26 + 86, 96, '#ffd23e', '#ff6b35');
  ctx.font = '20px "Kenney Mono", monospace';
  ctx.fillStyle = '#9c92d8';
  ctx.fillText('— OPERAÇÃO ÚLTIMA FRONTEIRA —', W / 2, H * 0.26 + 140);

  // naves decorativas
  drawSprite(IMG['playerShip1_blue'], W / 2, H * 0.58 + Math.sin(time * 2) * 8, 0.9);
  drawSprite(IMG['enemyBlack1'], W * 0.16, H * 0.52 + Math.sin(time * 1.5 + 2) * 12, 0.5);
  drawSprite(IMG['enemyRed5'], W * 0.84, H * 0.5 + Math.sin(time * 1.8 + 4) * 12, 0.5);

  if (Math.floor(menuBlink * 1.6) % 2 === 0) {
    ctx.font = '26px "Kenney Future", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PRESSIONE ENTER', W / 2, H * 0.74);
  }

  ctx.font = '15px "Kenney Mono", monospace';
  ctx.fillStyle = '#7c74a8';
  ctx.fillText('SETAS/WASD mover · ESPAÇO atirar · P pausa · M som', W / 2, H * 0.84);
  ctx.fillText('RECORDE: ' + hiScore.toLocaleString('pt-BR'), W / 2, H * 0.88);
  ctx.fillText('arte e áudio: kenney.nl (CC0)', W / 2, H * 0.95);

  if (confirmPressed()) {
    AudioSys.play('click', 0.8);
    startStory(STORY_INTRO, ST.SHIP_SELECT);
  }
}

function drawStory(dt) {
  const fullText = storyPages[storyPage];
  storyChars = Math.min(fullText.length, storyChars + dt * 55);
  const text = fullText.slice(0, Math.floor(storyChars));

  ctx.textAlign = 'center';
  ctx.font = '15px "Kenney Mono", monospace';
  ctx.fillStyle = '#6c64a0';
  ctx.fillText('— TRANSMISSÃO —', W / 2, H * 0.2);

  // texto com quebra de linha
  ctx.font = '22px "Kenney Mono", monospace';
  ctx.fillStyle = '#e8e4ff';
  ctx.textAlign = 'left';
  const maxW = W - 160;
  let y = H * 0.3;
  for (const para of text.split('\n')) {
    if (para === '') { y += 18; continue; }
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW) {
        ctx.fillText(line, 80, y); y += 32; line = word;
      } else line = test;
    }
    if (line) { ctx.fillText(line, 80, y); y += 32; }
  }

  ctx.textAlign = 'center';
  if (storyChars >= fullText.length && Math.floor(time * 1.6) % 2 === 0) {
    ctx.font = '18px "Kenney Future", sans-serif';
    ctx.fillStyle = '#ffd23e';
    ctx.fillText(storyPage < storyPages.length - 1 ? 'ENTER — CONTINUAR' : 'ENTER — PROSSEGUIR', W / 2, H * 0.85);
  }

  if (confirmPressed()) {
    AudioSys.play('click', 0.7);
    if (storyChars < fullText.length) { storyChars = fullText.length; }
    else if (storyPage < storyPages.length - 1) { storyPage++; storyChars = 0; }
    else {
      if (storyNext === ST.SHIP_SELECT) { state = ST.SHIP_SELECT; }
      else if (storyNext === ST.MENU) { state = ST.MENU; AudioSys.playMusic('menu'); }
    }
  }
}

function drawShipSelect() {
  drawTitle('ESCOLHA SEU CAÇA', H * 0.14, 40);

  const cw = 200, spacing = 230;
  for (let i = 0; i < SHIPS.length; i++) {
    const sx = W / 2 + (i - 1) * spacing;
    const sy = H * 0.4;
    const sel = i === selIdx;

    ctx.fillStyle = sel ? 'rgba(122,92,255,.18)' : 'rgba(255,255,255,.04)';
    ctx.strokeStyle = sel ? '#7a5cff' : 'rgba(255,255,255,.15)';
    ctx.lineWidth = sel ? 3 : 1;
    ctx.beginPath();
    ctx.roundRect(sx - cw / 2 + 8, sy - 120, cw - 16, 300, 12);
    ctx.fill(); ctx.stroke();

    const bob = sel ? Math.sin(time * 3) * 6 : 0;
    drawSprite(IMG[SHIPS[i].img], sx, sy - 30 + bob, sel ? 0.85 : 0.65);

    ctx.textAlign = 'center';
    ctx.font = '20px "Kenney Future", sans-serif';
    ctx.fillStyle = sel ? '#ffd23e' : '#bbb';
    ctx.fillText(SHIPS[i].name, sx, sy + 70);

    // barras de atributos
    const stats = SHIPS[i].stats;
    const labels = [['VEL', stats.vel], ['DEF', stats.blind], ['ATQ', stats.fogo]];
    ctx.font = '13px "Kenney Mono", monospace';
    labels.forEach(([lab, val], k) => {
      const ly = sy + 100 + k * 24;
      ctx.fillStyle = '#8c84b8';
      ctx.textAlign = 'left';
      ctx.fillText(lab, sx - 70, ly);
      for (let d = 0; d < 5; d++) {
        ctx.fillStyle = d < val ? '#7a5cff' : 'rgba(255,255,255,.12)';
        ctx.fillRect(sx - 28 + d * 18, ly - 9, 13, 10);
      }
    });
  }

  ctx.textAlign = 'center';
  ctx.font = '17px "Kenney Mono", monospace';
  ctx.fillStyle = '#cfc8f0';
  ctx.fillText(SHIPS[selIdx].desc, W / 2, H * 0.78);
  ctx.fillStyle = '#7c74a8';
  ctx.font = '15px "Kenney Mono", monospace';
  ctx.fillText('◄ ► escolher  ·  ENTER confirmar', W / 2, H * 0.85);

  if (justPressed('ArrowLeft') || justPressed('a') || justPressed('A')) {
    selIdx = (selIdx + SHIPS.length - 1) % SHIPS.length; AudioSys.play('click', 0.6);
  }
  if (justPressed('ArrowRight') || justPressed('d') || justPressed('D')) {
    selIdx = (selIdx + 1) % SHIPS.length; AudioSys.play('click', 0.6);
  }
  if (confirmPressed()) {
    AudioSys.play('confirm', 0.9);
    startGame(selIdx);
  }
}

function drawSectorIntro(dt) {
  const sec = SECTORS[G.sector];
  drawTitle(sec.name, H * 0.3, 30, '#ffd23e', '#ff6b35');

  const fullText = storyPages[0];
  storyChars = Math.min(fullText.length, storyChars + dt * 60);
  const text = fullText.slice(0, Math.floor(storyChars));

  ctx.font = '19px "Kenney Mono", monospace';
  ctx.fillStyle = '#cfe8d8';
  ctx.textAlign = 'left';
  const maxW = W - 180;
  let y = H * 0.42;
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW) { ctx.fillText(line, 90, y); y += 30; line = word; }
    else line = test;
  }
  if (line) ctx.fillText(line, 90, y);

  ctx.textAlign = 'center';
  if (storyChars >= fullText.length && Math.floor(time * 1.6) % 2 === 0) {
    ctx.font = '20px "Kenney Future", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('ENTER — INICIAR COMBATE', W / 2, H * 0.7);
  }

  if (confirmPressed()) {
    if (storyChars < fullText.length) storyChars = fullText.length;
    else {
      state = ST.PLAYING;
      AudioSys.play('confirm', 0.8);
      if (!SECTORS[G.sector].boss) AudioSys.playMusic('game');
    }
  }
}

function drawGameOver(dt) {
  gameOverTimer += dt;
  ctx.fillStyle = 'rgba(10,5,15,.78)';
  ctx.fillRect(0, 0, W, H);
  drawTitle('FIM DE JOGO', H * 0.32, 64, '#ff4757', '#80101c');

  ctx.font = '22px "Kenney Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8e4ff';
  ctx.fillText('PONTUAÇÃO: ' + G.score.toLocaleString('pt-BR'), W / 2, H * 0.45);
  ctx.fillStyle = G.score >= hiScore && G.score > 0 ? '#ffd23e' : '#9c92d8';
  ctx.fillText((G.score >= hiScore && G.score > 0 ? '★ NOVO RECORDE: ' : 'RECORDE: ') + hiScore.toLocaleString('pt-BR'), W / 2, H * 0.5);
  ctx.fillStyle = '#9c92d8';
  ctx.fillText('ABATES: ' + G.kills + '  ·  SETOR ' + (G.sector + 1), W / 2, H * 0.55);

  ctx.font = '17px "Kenney Mono", monospace';
  ctx.fillStyle = '#cfc8f0';
  ctx.fillText('A Armada Vazia avança sobre Kepler...', W / 2, H * 0.63);

  if (gameOverTimer > 1.2 && Math.floor(time * 1.6) % 2 === 0) {
    ctx.font = '22px "Kenney Future", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('ENTER — TENTAR DE NOVO', W / 2, H * 0.75);
  }
  if (gameOverTimer > 1.2 && confirmPressed()) {
    AudioSys.play('click', 0.8);
    state = ST.MENU;
    AudioSys.playMusic('menu');
  }
}

function drawVictory(dt) {
  gameOverTimer += dt;
  drawTitle('VITÓRIA!', H * 0.2, 72, '#ffd23e', '#ff6b35');

  const fullText = STORY_VICTORY.join('\n\n');
  const text = fullText.slice(0, Math.floor(gameOverTimer * 50));
  ctx.font = '19px "Kenney Mono", monospace';
  ctx.fillStyle = '#e8e4ff';
  ctx.textAlign = 'left';
  const maxW = W - 160;
  let y = H * 0.32;
  for (const para of text.split('\n')) {
    if (para === '') { y += 14; continue; }
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW) { ctx.fillText(line, 80, y); y += 28; line = word; }
      else line = test;
    }
    if (line) { ctx.fillText(line, 80, y); y += 28; }
  }

  ctx.textAlign = 'center';
  ctx.font = '20px "Kenney Mono", monospace';
  ctx.fillStyle = '#ffd23e';
  ctx.fillText('PONTUAÇÃO FINAL: ' + G.score.toLocaleString('pt-BR'), W / 2, H * 0.78);
  ctx.fillStyle = '#9c92d8';
  ctx.font = '16px "Kenney Mono", monospace';
  const mins = Math.floor(G.runTime / 60), secs = Math.floor(G.runTime % 60);
  ctx.fillText('TEMPO: ' + mins + 'm' + String(secs).padStart(2, '0') + 's  ·  ABATES: ' + G.kills, W / 2, H * 0.82);

  if (gameOverTimer > 3 && Math.floor(time * 1.6) % 2 === 0) {
    ctx.font = '22px "Kenney Future", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('ENTER — VOLTAR AO MENU', W / 2, H * 0.9);
  }
  if (gameOverTimer > 3 && confirmPressed()) {
    AudioSys.play('click', 0.8);
    state = ST.MENU;
  }
}

// ------------------------------------------------------------
// HUD
// ------------------------------------------------------------
function drawHUD() {
  const p = player;
  ctx.textAlign = 'left';
  ctx.font = '22px "Kenney Future", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(G.score.toLocaleString('pt-BR'), 18, 36);
  ctx.font = '13px "Kenney Mono", monospace';
  ctx.fillStyle = '#9c92d8';
  ctx.fillText('RECORDE ' + Math.max(hiScore, G.score).toLocaleString('pt-BR'), 18, 56);

  // progresso do setor
  const sec = SECTORS[G.sector];
  if (!sec.boss) {
    const pw = 200, fr = clamp(G.sectorTime / sec.dur, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(W / 2 - pw / 2, 14, pw, 8);
    ctx.fillStyle = '#7a5cff';
    ctx.fillRect(W / 2 - pw / 2, 14, pw * fr, 8);
    ctx.textAlign = 'center';
    ctx.font = '12px "Kenney Mono", monospace';
    ctx.fillStyle = '#9c92d8';
    ctx.fillText('SETOR ' + (G.sector + 1) + '/5', W / 2, 38);
  }

  // vidas
  for (let i = 0; i < G.lives; i++)
    drawSprite(IMG[p.def.life], 30 + i * 38, H - 86, 1);

  // barra de casco
  const hw = 200;
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.fillRect(18, H - 52, hw, 14);
  const hpFr = clamp(p.hp / p.maxHp, 0, 1);
  ctx.fillStyle = hpFr > 0.5 ? '#3ddc84' : hpFr > 0.25 ? '#ffd23e' : '#ff4757';
  ctx.fillRect(18, H - 52, hw * hpFr, 14);
  ctx.strokeStyle = 'rgba(255,255,255,.3)';
  ctx.strokeRect(18, H - 52, hw, 14);
  ctx.font = '12px "Kenney Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#cfc8f0';
  ctx.fillText('CASCO', 18, H - 60);

  // arma e efeitos
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffd23e';
  ctx.fillText('ARMA NV.' + p.weapon, W - 18, H - 60);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < p.weapon ? '#ffd23e' : 'rgba(255,255,255,.12)';
    ctx.fillRect(W - 18 - (3 - i) * 26, H - 52, 20, 14);
  }
  if (p.shield > 0) {
    ctx.fillStyle = '#7fd4ff';
    ctx.fillText('ESCUDO ×' + p.shield, W - 18, H - 86);
  }
  if (p.rapid > 0) {
    ctx.fillStyle = '#8aff9c';
    ctx.fillText('RÁPIDO ' + p.rapid.toFixed(0) + 's', W - 18, H - 110);
  }

  if (AudioSys.isMuted()) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#7c74a8';
    ctx.fillText('[MUDO]', W - 18, 30);
  }
}

function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(5,5,15,.7)';
  ctx.fillRect(0, 0, W, H);
  drawTitle('PAUSADO', H * 0.45, 56);
  ctx.font = '17px "Kenney Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9c92d8';
  ctx.fillText('P — continuar  ·  M — som', W / 2, H * 0.53);
}

// ------------------------------------------------------------
// Loop principal
// ------------------------------------------------------------
let lastTime = 0;

function frame(ts) {
  const dt = Math.min(0.05, (ts - lastTime) / 1000 || 0.016);
  lastTime = ts;
  time += dt;

  // teclas globais
  if (justPressed('m') || justPressed('M')) AudioSys.toggleMute();
  if ((justPressed('p') || justPressed('P')) && state === ST.PLAYING) paused = !paused;

  // tremor de tela
  ctx.save();
  if (shake > 0 && state === ST.PLAYING && !paused) {
    ctx.translate(rand(-shake, shake) * 0.5, rand(-shake, shake) * 0.5);
    shake = Math.max(0, shake - 30 * dt);
  }

  const runWorld = state === ST.PLAYING && !paused;
  if (runWorld || state === ST.MENU || state === ST.STORY || state === ST.SHIP_SELECT ||
      state === ST.SECTOR_INTRO || state === ST.GAME_OVER || state === ST.VICTORY) {
    updateBackground(dt);
  }
  drawBackground();

  switch (state) {
    case ST.LOADING: {
      ctx.textAlign = 'center';
      ctx.font = '24px monospace';
      ctx.fillStyle = '#9c92d8';
      ctx.fillText('CARREGANDO... ' + Math.floor(assetsLoaded / assetsTotal * 100) + '%', W / 2, H / 2);
      break;
    }
    case ST.MENU: drawMenu(dt); break;
    case ST.STORY: drawStory(dt); break;
    case ST.SHIP_SELECT: drawShipSelect(); break;
    case ST.SECTOR_INTRO: drawSectorIntro(dt); break;
    case ST.PLAYING: {
      if (!paused) {
        updateDirector(dt);
        updatePlayer(dt);
        updateEnemies(dt);
        updateMeteors(dt);
        updateBullets(dt);
        updateBoss(dt);
        updatePowerups(dt);
        updateParticles(dt);
        updateFloaters(dt);
      }
      drawMeteors();
      drawEnemies();
      drawBoss();
      drawBullets();
      drawPowerups();
      if (player) drawPlayer();
      drawParticles();
      drawFloaters();
      if (player) drawHUD();
      if (paused) drawPauseOverlay();
      break;
    }
    case ST.GAME_OVER: {
      updateParticles(dt);
      drawParticles();
      drawGameOver(dt);
      break;
    }
    case ST.VICTORY: {
      updateParticles(dt);
      drawParticles();
      drawVictory(dt);
      break;
    }
  }

  ctx.restore();
  pressedOnce = {};
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------
// Inicialização
// ------------------------------------------------------------
AudioSys.load();
initStars();

// garante que as fontes customizadas estejam prontas
if (document.fonts && document.fonts.load) {
  document.fonts.load('20px "Kenney Future"');
  document.fonts.load('20px "Kenney Mono"');
}

loadImages(() => {
  state = ST.MENU;
  AudioSys.playMusic('menu');
  // atalhos de teste: index.html#select | #game | #boss
  if (location.hash === '#select') state = ST.SHIP_SELECT;
  else if (location.hash === '#game') { startGame(0); state = ST.PLAYING; }
  else if (location.hash === '#boss') { startGame(0); G.sector = 4; state = ST.PLAYING; }
});

requestAnimationFrame(frame);

// handle de inspeção para testes automatizados
window.__NS = {
  get state() { return state; },
  get score() { return G.score; },
  get sector() { return G.sector; },
  get enemies() { return enemies.length; },
  get meteors() { return meteors.length; },
  get bullets() { return bullets.length; },
  get player() { return player ? { x: player.x, y: player.y, hp: player.hp, dead: player.dead } : null; },
  get boss() { return boss ? { hp: boss.hp, active: boss.active } : null; },
};

})();
