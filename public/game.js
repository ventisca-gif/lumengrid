'use strict';
/* Dragon Mystery — RPG de mazmorras por turnos.
   Los gráficos se cargan desde assets/ según assets/assets.json;
   lo que falte se sustituye por marcadores dibujados por código. */
(() => {
const TS = 16, S = 3, VH = 10, CH = 480;
let CW = 720, rotated = false;   // el ancho lógico se adapta a la pantalla; el alto es fijo
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
const FONT = 'bold 20px monospace', FONT_S = 'bold 16px monospace';
const DIRS = [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]];
const SAVE_KEY = 'dragonmystery_save_v1';

// ───────────────────────── utilidades
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[ri(0, a.length - 1)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
function rng(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function mk(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; fn(x); return c; }
const R = (c, col, x, y, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(x, y, w, h); };

// ───────────────────────── configuración y carga de recursos
let CFG = { text: { title: 'Dragon Mystery', heroName: 'Kai', allyName: 'Niko', town: 'Villa Poniente', dungeon: 'Cañón Rojizo' }, characters: {}, enemies: {}, tiles: {}, ui: {} };
const ASSET_STATUS = [];   // {path, ok} — informe de gráficos presentes y ausentes
const SHEETS = {}, PORTRAIT_IMG = {}, UI_IMG = {};

function loadImage(path) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => { ASSET_STATUS.push({ path, ok: true }); res(im); };
    im.onerror = () => { ASSET_STATUS.push({ path, ok: false }); res(null); };
    im.src = 'assets/' + path;
  });
}
// Convierte un color de fondo sólido en transparencia ("auto" = píxel superior izquierdo).
function applyColorKey(img, key) {
  const c = mk(img.width, img.height, x => x.drawImage(img, 0, 0));
  if (!key) return c;
  const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  let kr, kg, kb;
  if (key === 'auto') { kr = p[0]; kg = p[1]; kb = p[2]; }
  else { const n = parseInt(key.replace('#', ''), 16); kr = n >> 16 & 255; kg = n >> 8 & 255; kb = n & 255; }
  for (let i = 0; i < p.length; i += 4) if (p[i] === kr && p[i + 1] === kg && p[i + 2] === kb) p[i + 3] = 0;
  x.putImageData(d, 0, 0);
  return c;
}
async function loadAssets() {
  try {
    const r = await fetch('assets/assets.json', { cache: 'no-cache' });
    if (r.ok) { const j = await r.json(); for (const k in j) CFG[k] = Object.assign(CFG[k] || {}, j[k]); }
  } catch (e) { console.warn('Sin assets.json: se usan gráficos de marcador.'); }
  const jobs = [];
  const sheetJob = (key, def) => {
    if (def.sheet) jobs.push(loadImage(def.sheet).then(im => { if (im) SHEETS[key] = { img: applyColorKey(im, def.colorKey), def }; }));
    if (def.portrait) jobs.push(loadImage(def.portrait).then(im => { if (im) PORTRAIT_IMG[key] = im; }));
  };
  for (const k in CFG.characters) sheetJob(k, CFG.characters[k]);
  for (const k in CFG.enemies) sheetJob(k, CFG.enemies[k]);
  for (const k in CFG.tiles) jobs.push(loadImage(CFG.tiles[k]).then(im => {
    if (!im) return;                       // tira horizontal de variantes de 16 px
    const n = Math.max(1, Math.floor(im.width / TS)), arr = [];
    for (let i = 0; i < n; i++) arr.push(mk(TS, TS, x => x.drawImage(im, i * TS, 0, TS, TS, 0, 0, TS, TS)));
    TILES[k] = arr;
  }));
  for (const k in CFG.ui) jobs.push(loadImage(CFG.ui[k]).then(im => { if (im) UI_IMG[k] = im; }));
  await Promise.all(jobs);
  ASSET_STATUS.sort((a, b) => a.path < b.path ? -1 : 1);
  const miss = ASSET_STATUS.filter(a => !a.ok).map(a => a.path);
  if (miss.length) console.info('Gráficos ausentes (se usan marcadores):\n' + miss.join('\n'));
}

// ───────────────────────── baldosas de marcador
function speck(base, cols, n, seed, extra) {
  return mk(TS, TS, c => { R(c, base, 0, 0, 16, 16); const r = rng(seed); for (let i = 0; i < n; i++) R(c, cols[(r() * cols.length) | 0], (r() * 16) | 0, (r() * 16) | 0, 1 + (r() < .3 ? 1 : 0), 1); extra && extra(c, r); });
}
const grassT = (s, ex) => speck('#5aa83c', ['#4c9632', '#6cbc48', '#7acc54'], 26, s, ex);
const pathT = (s, ex) => speck('#d9c08c', ['#c9ae78', '#e6d2a4'], 18, s, ex);
const floorT = (s, ex) => speck('#d8a868', ['#c89858', '#e4b878', '#b88848'], 22, s, ex);
const TILES = {
  grass: [1, 2, 3].map(s => grassT(s)),
  flower: [4, 5].map(s => grassT(s, (c, r) => { for (let i = 0; i < 3; i++) { const x = 2 + (r() * 11 | 0), y = 2 + (r() * 11 | 0); R(c, pick(['#ffd84a', '#ff8fb0', '#fff']), x, y, 2, 2); R(c, '#e8602c', x, y, 1, 1); } })),
  path: [11, 12].map(s => pathT(s)),
  water: [20, 21].map(s => speck('#3d8fd6', ['#62aeea', '#2f7cc4'], 10, s, (c, r) => { for (let i = 0; i < 3; i++) R(c, '#bfe2ff', (r() * 12) | 0, (r() * 15) | 0, 3, 1); })),
  tree: [grassT(30, c => { R(c, '#6b4424', 7, 11, 2, 4); R(c, '#1f6e2a', 2, 3, 12, 8); R(c, '#1f6e2a', 4, 1, 8, 12); R(c, '#2f8f3a', 4, 2, 7, 6); R(c, '#49b352', 5, 3, 3, 2); R(c, '#17561f', 3, 10, 10, 1); })],
  roof: [mk(16, 16, c => { R(c, '#d9622b', 0, 0, 16, 16); for (let y = 0; y < 16; y += 4) { R(c, '#b84a1c', 0, y + 3, 16, 1); for (let x = (y % 8 ? 0 : 4); x < 16; x += 8) R(c, '#b84a1c', x, y, 1, 3); } R(c, '#f0854a', 0, 0, 16, 1); })],
  wall: [mk(16, 16, c => { R(c, '#e8dcc0', 0, 0, 16, 16); R(c, '#cfc09c', 0, 15, 16, 1); R(c, '#5a4630', 4, 4, 8, 7); R(c, '#9fd4f0', 5, 5, 6, 5); R(c, '#5a4630', 8, 5, 1, 5); })],
  door: [mk(16, 16, c => { R(c, '#e8dcc0', 0, 0, 16, 16); R(c, '#5a3a1e', 3, 2, 10, 14); R(c, '#7d5530', 4, 3, 8, 13); R(c, '#f2c14e', 10, 9, 1, 2); })],
  fount: [pathT(40, c => { R(c, '#8f97a8', 1, 1, 14, 14); R(c, '#b8c0d0', 1, 1, 14, 2); R(c, '#3d8fd6', 3, 3, 10, 10); R(c, '#bfe2ff', 5, 5, 3, 1); R(c, '#bfe2ff', 8, 9, 3, 1); })],
  gate: [pathT(41, c => { R(c, '#6d6d7a', 0, 0, 3, 16); R(c, '#6d6d7a', 13, 0, 3, 16); R(c, '#8f8f9e', 0, 0, 16, 3); R(c, '#2a1a12', 3, 3, 10, 9); R(c, '#f2c14e', 7, 0, 2, 2); })],
  dfloor: [50, 51, 52].map(s => floorT(s)),
  dtop: [60, 61].map(s => speck('#b06a34', ['#a05c2a', '#c07a40', '#985626'], 20, s)),
  dcliff: [70, 71].map(s => mk(16, 16, c => { const r = rng(s); R(c, '#8a4a22', 0, 0, 16, 16); for (let x = 0; x < 16; x++) { const h = 4 + (r() * 10 | 0); R(c, r() < .5 ? '#73391a' : '#9c5a2c', x, 2 + (r() * 3 | 0), 1, h); } R(c, '#c98a4e', 0, 0, 16, 2); R(c, '#4a2410', 0, 14, 16, 2); })),
  stairs: [floorT(80, c => { R(c, '#5a3a1e', 2, 2, 12, 12); for (let i = 0; i < 4; i++) R(c, ['#b88848', '#946a34', '#6e4c22', '#3a260e'][i], 3, 3 + i * 3, 10 - i, 2); })],
};
const tileOf = (name, x, y) => { const a = TILES[name]; return a[(x * 7 + y * 13) % a.length]; };

// ───────────────────────── personajes de marcador
const CHARS = {
  hero: { hair: '#b03a2e', skin: '#f2c79a', top: '#2a9d8f', bot: '#3a3550', belt: '#f2c14e', style: 'spiky', bg: '#274060' },
  ally: { hair: '#3a6ea8', skin: '#e8b88a', top: '#6aa84f', bot: '#5a4630', belt: '#3a2a1a', style: 'cap', cap: '#e8e0c8', bg: '#3f5a2a' },
  npc_sora: { hair: '#c8c8d8', skin: '#f0d0b0', top: '#7a4a9a', bot: '#5a3478', belt: '#f2c14e', style: 'long', bg: '#4a3460' },
  npc_brok: { hair: '#5a3a1e', skin: '#d8a070', top: '#c8b890', bot: '#6b4424', belt: '#6b4424', style: 'cap', cap: '#8a5a2a', bg: '#5a4630' },
  npc_lia: { hair: '#f2d060', skin: '#f6d4b4', top: '#e87aa0', bot: '#a04a70', belt: '#fff', style: 'long', bg: '#7a3a58' },
};
function humanFrame(sp, dir, f) { // dir: 0 abajo, 1 arriba, 2 izquierda
  return mk(16, 16, c => {
    const dk = '#2a2030', { hair, skin, top, bot } = sp;
    R(c, 'rgba(0,0,0,.25)', 4, 14, 8, 2);
    const l1 = f ? 2 : 3, l2 = f ? 3 : 2;
    R(c, bot, 5, 12, 2, l1); R(c, bot, 9, 12, 2, l2); R(c, dk, 5, 11 + l1, 2, 1); R(c, dk, 9, 11 + l2, 2, 1);
    R(c, top, 4, 8, 8, 4); R(c, sp.belt || dk, 4, 11, 8, 1);
    if (dir < 2) { R(c, top, 3, 8, 1, 2); R(c, top, 12, 8, 1, 2); R(c, skin, 3, 10 - f, 1, 1); R(c, skin, 12, 9 + f, 1, 1); }
    else { R(c, top, 7, 8, 2, 2); R(c, skin, 7 - f, 10, 1, 1); }
    R(c, skin, 5, 3, 6, 5);
    if (dir === 0) { R(c, dk, 6, 5, 1, 2); R(c, dk, 9, 5, 1, 2); }
    if (dir === 2) R(c, dk, 6, 5, 1, 2);
    if (sp.style !== 'bald') {
      if (dir === 0) { R(c, hair, 4, 1, 8, 3); R(c, hair, 4, 4, 1, 2); R(c, hair, 11, 4, 1, 2); }
      else if (dir === 1) R(c, hair, 4, 1, 8, 6);
      else { R(c, hair, 5, 1, 7, 3); R(c, hair, 9, 4, 3, 3); }
      if (sp.style === 'spiky') { R(c, hair, 3, 2, 1, 2); R(c, hair, 12, 2, 1, 2); R(c, hair, 4, 0, 2, 1); R(c, hair, 7, 0, 2, 1); R(c, hair, 11, 0, 1, 1); }
      if (sp.style === 'long') { if (dir === 1) R(c, hair, 4, 1, 8, 9); else { R(c, hair, dir === 2 ? 10 : 4, 4, dir === 2 ? 2 : 1, 6); if (dir === 0) R(c, hair, 11, 4, 1, 6); } }
      if (sp.style === 'cap') { R(c, sp.cap, 4, 1, 8, 2); if (dir === 0) R(c, sp.cap, 4, 3, 8, 1); if (dir === 2) R(c, sp.cap, 3, 3, 4, 1); }
    }
  });
}
const flip = cn => mk(cn.width, cn.height, c => { c.translate(cn.width, 0); c.scale(-1, 1); c.drawImage(cn, 0, 0); });
function humanSprite(sp) {
  const fr = { down: [0, 1].map(f => humanFrame(sp, 0, f)), up: [0, 1].map(f => humanFrame(sp, 1, f)), left: [0, 1].map(f => humanFrame(sp, 2, f)) };
  fr.right = fr.left.map(flip);
  return { draw(c, x, y, dir, anim, t) { const f = anim === 'walk' ? Math.floor(t / 130) % 2 : anim === 'attack' ? 1 : 0; if (anim === 'hurt' && Math.floor(t / 60) % 2) c.globalAlpha = .4; c.drawImage(fr[dir][f], x, y); c.globalAlpha = 1; } };
}
const MON_DRAW = {
  slime: (c, f) => { R(c, '#c9a040', 3, 8 - f, 10, 7 + f); R(c, '#c9a040', 5, 6 - f, 6, 2); R(c, '#e8c468', 5, 7 - f, 3, 2); R(c, '#2a2030', 5, 10, 2, 2); R(c, '#2a2030', 9, 10, 2, 2); },
  bat: (c, f) => { R(c, '#4a3a6a', 6, 6, 4, 5); R(c, '#4a3a6a', 5, 4, 2, 2); R(c, '#4a3a6a', 9, 4, 2, 2); const wy = f ? 4 : 8; R(c, '#6a5a9a', 1, wy, 5, 3); R(c, '#6a5a9a', 10, wy, 5, 3); R(c, '#ff5050', 6, 7, 1, 1); R(c, '#ff5050', 9, 7, 1, 1); },
  scorp: (c, f) => { R(c, '#c0392b', 4, 9, 8, 4); R(c, '#e05a4a', 5, 9, 6, 1); R(c, '#c0392b', 1, 7 + f, 3, 3); R(c, '#c0392b', 12, 7 + f, 3, 3); R(c, '#8e2a20', 7, 3, 2, 6); R(c, '#8e2a20', 9, 2 + f, 2, 2); R(c, '#f2c14e', 11, 2 + f, 1, 1); R(c, '#2a2030', 5, 11, 1, 1); R(c, '#2a2030', 10, 11, 1, 1); R(c, '#8e2a20', 3, 13, 2, 1); R(c, '#8e2a20', 11, 13, 2, 1); },
  lizard: (c, f) => { R(c, '#5a8a4a', 4, 6, 8, 7); R(c, '#7ab068', 5, 8, 6, 4); R(c, '#5a8a4a', 5, 3, 6, 4); R(c, '#f2c14e', 6, 4, 1, 1); R(c, '#f2c14e', 9, 4, 1, 1); R(c, '#3a6030', 3, 12, 3, 2 + f); R(c, '#3a6030', 10, 12, 3, 3 - f); R(c, '#5a8a4a', 12, 10 - f, 3, 2); R(c, '#3a6030', 7, 2, 2, 1); },
  golem: (c, f) => { R(c, '#7a5a40', 3, 3 - f, 10, 11 + f); R(c, '#9a7a58', 4, 4 - f, 8, 3); R(c, '#5a3e2a', 0, 6, 3, 7); R(c, '#5a3e2a', 13, 6, 3, 7); R(c, '#ffe060', 5, 6 - f, 2, 2); R(c, '#ffe060', 9, 6 - f, 2, 2); R(c, '#3a2616', 6, 10, 4, 1); R(c, '#5a3e2a', 4, 14, 3, 2); R(c, '#5a3e2a', 9, 14, 3, 2); },
};
function monSprite(kind) {
  const fr = [0, 1].map(f => mk(16, 16, c => { R(c, 'rgba(0,0,0,.25)', 3, 14, 10, 2); MON_DRAW[kind](c, f); }));
  const big = kind === 'golem';
  return { draw(c, x, y, dir, anim, t) { if (anim === 'hurt' && Math.floor(t / 60) % 2) c.globalAlpha = .4; const im = fr[Math.floor(performance.now() / 300) % 2]; if (big) c.drawImage(im, x - 4, y - 8, 24, 24); else c.drawImage(im, x, y); c.globalAlpha = 1; } };
}
// Hoja PNG externa: filas = direcciones, columnas = fotogramas de cada animación.
function sheetSprite({ img, def }) {
  const fw = def.frameW || 32, fh = def.frameH || 32, sc = def.scale || 1, dirs = def.dirs || ['down', 'left', 'right', 'up'], anims = def.anims || { idle: { from: 0, count: 1, fps: 1 } };
  return {
    draw(c, x, y, dir, anim, t) {
      const a = anims[anim] || anims.idle || { from: 0, count: 1, fps: 1 };
      let row = dirs.indexOf(dir), mirror = false;
      if (row < 0) { const opp = dir === 'left' ? 'right' : dir === 'right' ? 'left' : 'down'; row = Math.max(0, dirs.indexOf(opp)); mirror = dir === 'left' || dir === 'right'; }
      let fi = Math.floor(t * (a.fps || 8) / 1000);
      fi = (anim === 'attack' || anim === 'hurt') ? Math.min(fi, a.count - 1) : fi % a.count;
      const sx = (a.from + fi) * fw + (def.offsetX || 0), sy = ((a.rowStart || 0) + row) * fh + (def.offsetY || 0);
      const dw = fw * sc, dh = fh * sc, dx = x + 8 - dw / 2, dy = y + 16 - dh + (def.footOffset || 0);
      if (mirror) { c.save(); c.translate(dx + dw, dy); c.scale(-1, 1); c.drawImage(img, sx, sy, fw, fh, 0, 0, dw, dh); c.restore(); }
      else c.drawImage(img, sx, sy, fw, fh, dx, dy, dw, dh);
    }
  };
}
const SPR = {}, PORTRAIT = {};
function buildSprites() {
  for (const k in CHARS) {
    SPR[k] = SHEETS[k] ? sheetSprite(SHEETS[k]) : humanSprite(CHARS[k]);
    PORTRAIT[k] = PORTRAIT_IMG[k] || portraitOf(CHARS[k]);
  }
  for (const k in MON_DRAW) SPR[k] = SHEETS[k] ? sheetSprite(SHEETS[k]) : monSprite(k);
}
function portraitOf(sp) {
  return mk(32, 32, c => {
    const dk = '#2a2030';
    R(c, sp.bg, 0, 0, 32, 32); R(c, 'rgba(255,255,255,.08)', 0, 0, 32, 12);
    R(c, sp.top, 4, 25, 24, 7); R(c, sp.skin, 13, 21, 6, 5); R(c, sp.skin, 8, 8, 16, 14);
    R(c, '#fff', 11, 14, 4, 3); R(c, '#fff', 17, 14, 4, 3); R(c, dk, 13, 14, 2, 3); R(c, dk, 19, 14, 2, 3);
    R(c, '#a04848', 14, 19, 4, 1); R(c, 'rgba(0,0,0,.12)', 8, 20, 16, 2);
    if (sp.style !== 'bald') {
      R(c, sp.hair, 7, 4, 18, 6); R(c, sp.hair, 6, 7, 3, 7); R(c, sp.hair, 23, 7, 3, 7);
      if (sp.style === 'spiky') for (let i = 0; i < 5; i++) { R(c, sp.hair, 5 + i * 5, 1 + (i % 2) * 2, 3, 4); }
      if (sp.style === 'long') { R(c, sp.hair, 5, 8, 4, 18); R(c, sp.hair, 23, 8, 4, 18); }
      if (sp.style === 'cap') { R(c, sp.cap, 6, 3, 20, 6); R(c, sp.cap, 5, 8, 22, 2); }
    }
  });
}
const ITEM_ICON = {
  use: col => mk(16, 16, c => { R(c, 'rgba(0,0,0,.25)', 4, 13, 8, 2); R(c, col, 5, 6, 6, 7); R(c, col, 4, 8, 8, 4); R(c, '#fff', 6, 7, 2, 2); R(c, '#3a7a2a', 7, 4, 2, 2); }),
  gear: col => mk(16, 16, c => { R(c, 'rgba(0,0,0,.25)', 3, 13, 10, 2); R(c, '#7a5a30', 3, 5, 10, 8); R(c, col, 4, 6, 8, 6); R(c, '#f2c14e', 7, 8, 2, 2); }),
  gold: () => mk(16, 16, c => { R(c, 'rgba(0,0,0,.25)', 4, 13, 8, 2); R(c, '#f2c14e', 5, 6, 6, 7); R(c, '#f2c14e', 4, 7, 8, 5); R(c, '#fff3a0', 6, 7, 2, 3); R(c, '#b8862a', 8, 8, 1, 3); }),
};

// ───────────────────────── datos de juego
const ITEMS = {
  baya: { n: 'Baya Roja', d: 'Recupera 30 PS.', price: 15, col: '#e04848' },
  elixir: { n: 'Elixir Azul', d: 'Recupera 20 EN.', price: 20, col: '#4a8ae8' },
  semilla: { n: 'Semilla Vital', d: 'Recupera todos los PS y la EN.', price: 60, col: '#58c058' },
  guantes: { n: 'Guantes de Cuero', slot: 'arma', atk: 2, d: 'Arma. ATQ +2.', price: 40, col: '#c88a4a' },
  vara: { n: 'Vara de Roble', slot: 'arma', atk: 4, d: 'Arma. ATQ +4.', price: 90, col: '#a06a30' },
  garras: { n: 'Garras de Dragón', slot: 'arma', atk: 7, d: 'Arma. ATQ +7.', price: 200, col: '#e05a4a' },
  tunica: { n: 'Túnica de Viaje', slot: 'ropa', def: 2, d: 'Ropa. DEF +2.', price: 40, col: '#6aa8c8' },
  chaleco: { n: 'Chaleco Reforzado', slot: 'ropa', def: 4, d: 'Ropa. DEF +4.', price: 90, col: '#4a6a8a' },
  manto: { n: 'Manto de Escamas', slot: 'ropa', def: 7, d: 'Ropa. DEF +7.', price: 200, col: '#3a9a7a' },
  banda: { n: 'Banda Carmesí', slot: 'acc', hp: 10, d: 'Accesorio. PS máx. +10.', price: 60, col: '#d83a3a' },
  amuleto: { n: 'Amuleto Lunar', slot: 'acc', en: 10, d: 'Accesorio. EN máx. +10.', price: 60, col: '#b0a0f0' },
  anillo: { n: 'Anillo del Dragón', slot: 'acc', atk: 3, def: 3, d: 'Accesorio. ATQ +3, DEF +3.', price: 250, col: '#f2c14e' },
};
for (const k in ITEMS) ITEMS[k].icon = (ITEMS[k].slot ? ITEM_ICON.gear : ITEM_ICON.use)(ITEMS[k].col);
const GOLD_ICON = ITEM_ICON.gold();
const SLOT_NAME = { arma: 'Arma', ropa: 'Ropa', acc: 'Accesorio' };
const TECHS = [
  { n: 'Golpe Veloz', c: 4, lv: 1, d: 'Golpe potente al enemigo de enfrente.' },
  { n: 'Onda de Energía', c: 8, lv: 1, d: 'Rayo en línea recta. Alcance 6.' },
  { n: 'Estallido', c: 12, lv: 3, d: 'Daña a todos los enemigos adyacentes.' },
  { n: 'Aura Dragón', c: 15, lv: 5, d: 'ATQ x1.5 durante 15 turnos.' },
];
const MONS = {
  slime: { n: 'Babosa de Arena', hp: 12, atk: 4, def: 1, xp: 6 },
  bat: { n: 'Murciélago', hp: 10, atk: 6, def: 0, xp: 8 },
  scorp: { n: 'Escorpión Rojo', hp: 18, atk: 7, def: 3, xp: 12 },
  lizard: { n: 'Lagarto de Roca', hp: 26, atk: 9, def: 4, xp: 18 },
  golem: { n: 'Gólem del Cañón', hp: 95, atk: 13, def: 6, xp: 100 },
};
const LAST_FLOOR = 5;

// ───────────────────────── estado
const G = { mode: 'boot', scene: null, map: null, ents: [], items: [], floor: 0, ally: null, msgs: [], fx: [], dialog: null, menu: null, flags: {}, time: 0, lock: 0, banner: null, turn: 0, pending: null };
let P = null;
function newPlayer(name) {
  return { kind: 'player', key: 'hero', name, lvl: 1, xp: 0, hp: 40, en: 30, bhp: 40, ben: 30, atk: 6, def: 2, gold: 30, inv: ['baya', 'baya', 'elixir'], eq: { arma: null, ropa: null, acc: null }, x: 0, y: 0, px: 0, py: 0, dx: 0, dy: 1, aura: 0, animT: 0 };
}
const eqSum = f => Object.values(P.eq).reduce((s, id) => s + (id ? ITEMS[id][f] || 0 : 0), 0);
const maxHp = e => e === P ? P.bhp + eqSum('hp') : e.maxhp;
const maxEn = () => P.ben + eqSum('en');
const atkOf = e => e === P ? Math.round((P.atk + eqSum('atk')) * (P.aura > 0 ? 1.5 : 1)) : e.atk;
const defOf = e => e === P ? P.def + eqSum('def') : e.def;
const nameOf = e => e === P ? P.name : e.name;
const allyStats = () => ({ maxhp: 26 + P.lvl * 5, atk: 4 + P.lvl, def: 1 + (P.lvl >> 1) });
function save() {
  const d = {}; for (const k of ['name', 'lvl', 'xp', 'hp', 'en', 'bhp', 'ben', 'atk', 'def', 'gold', 'inv', 'eq']) d[k] = P[k];
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ p: d, flags: G.flags })); } catch (e) { }
}
function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } }
function msg(t) { G.msgs.push({ t, time: G.time }); if (G.msgs.length > 4) G.msgs.shift(); }
function floatTxt(x, y, t, col) { G.fx.push({ type: 'txt', x: x * 16 + 8, y: y * 16, t, col, age: 0, life: 700 }); }

// ───────────────────────── mapas
const walkTown = new Set(['grass', 'flower', 'path', 'gate']);
function walk(x, y) {
  const m = G.map; if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
  const t = m.t[y * m.w + x]; return m.kind === 'town' ? walkTown.has(t) : t !== 0;
}
function buildTown() {
  const w = 30, h = 24, t = new Array(w * h).fill('grass'), set = (x, y, v) => { t[y * w + x] = v; }, get = (x, y) => t[y * w + x];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) set(x, y, 'tree');
  for (let y = 2; y <= 21; y++) { set(14, y, 'path'); set(15, y, 'path'); }
  for (let x = 3; x <= 26; x++) { set(x, 12, 'path'); set(x, 13, 'path'); }
  for (let y = 9; y <= 16; y++) for (let x = 11; x <= 18; x++) set(x, y, 'path');
  for (let y = 10; y <= 11; y++) for (let x = 16; x <= 17; x++) set(x, y, 'fount');
  set(14, 1, 'gate'); set(15, 1, 'gate');
  const house = (hx, hy) => { for (let x = hx; x < hx + 5; x++) { set(x, hy, 'roof'); set(x, hy + 1, 'roof'); set(x, hy + 2, 'wall'); } set(hx + 2, hy + 2, 'door'); };
  house(4, 5); house(21, 5); house(4, 15); house(21, 15);
  for (let y = 8; y <= 11; y++) { set(6, y, 'path'); set(23, y, 'path'); }
  for (const hx of [6, 23]) { set(hx, 18, 'path'); set(hx, 19, 'path'); }
  for (let x = 6; x <= 23; x++) set(x, 19, 'path');
  for (let y = 9; y <= 10; y++) for (let x = 25; x <= 27; x++) set(x, y, 'water');
  const r = rng(7);
  for (let i = 0; i < 400; i++) {
    const x = 2 + (r() * (w - 4) | 0), y = 2 + (r() * (h - 4) | 0);
    if (get(x, y) !== 'grass') continue;
    const nb = [[0, -1], [0, 1], [-1, 0], [1, 0]].every(([dx, dy]) => ['grass', 'flower', 'tree'].includes(get(x + dx, y + dy)));
    set(x, y, r() < .22 && nb ? 'tree' : r() < .5 ? 'flower' : 'grass');
  }
  return { kind: 'town', w, h, t };
}
function genDungeon(floor) {
  const w = 40, h = 30, t = new Array(w * h).fill(0), rooms = [], want = floor === LAST_FLOOR ? 5 : 7;
  for (let i = 0; i < 200 && rooms.length < want; i++) {
    const rw = ri(4, 8), rh = ri(3, 6), rx = ri(1, w - rw - 2), ry = ri(1, h - rh - 2);
    if (rooms.some(r => rx <= r.x + r.w + 1 && rx + rw + 1 >= r.x && ry <= r.y + r.h + 1 && ry + rh + 1 >= r.y)) continue;
    rooms.push({ x: rx, y: ry, w: rw, h: rh });
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) t[y * w + x] = 1;
  }
  const cen = r => ({ x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) });
  const link = (a, b) => { let { x, y } = cen(a); const e = cen(b); const hf = Math.random() < .5; const stepX = () => { while (x !== e.x) { t[y * w + x] = t[y * w + x] || 1; x += Math.sign(e.x - x); } }, stepY = () => { while (y !== e.y) { t[y * w + x] = t[y * w + x] || 1; y += Math.sign(e.y - y); } }; if (hf) { stepX(); stepY(); } else { stepY(); stepX(); } };
  for (let i = 1; i < rooms.length; i++) link(rooms[i - 1], rooms[i]);
  if (rooms.length > 3) link(rooms[0], rooms[rooms.length - 2]);
  return { kind: 'dun', w, h, t, rooms, seen: new Uint8Array(w * h), cen };
}
const entAt = (x, y) => G.ents.find(e => e.x === x && e.y === y && e.hp > 0);
function freeIn(room) { for (let i = 0; i < 50; i++) { const x = ri(room.x, room.x + room.w - 1), y = ri(room.y, room.y + room.h - 1); if (!entAt(x, y) && G.map.t[y * G.map.w + x] === 1 && !G.items.some(o => o.x === x && o.y === y)) return { x, y }; } return null; }
function place(e, x, y) { e.x = x; e.y = y; e.px = x * 16; e.py = y * 16; }

// ───────────────────────── escenas
function enterTown(first) {
  G.scene = 'town'; G.mode = 'play'; G.map = TOWN; G.items = []; G.fx = []; G.floor = 0;
  P.hp = maxHp(P); P.en = maxEn(); P.aura = 0; P.dx = 0; P.dy = -1;
  place(P, 14, 18);
  const npc = (key, x, y, talk) => ({ kind: 'npc', key, name: (CFG.characters[key] || {}).name || key, hp: 1, x, y, px: x * 16, py: y * 16, dx: 0, dy: 1, animT: 0, talk });
  G.ents = [P, npc('npc_sora', 13, 10, talkSora), npc('npc_brok', 7, 9, talkBrok), npc('npc_lia', 24, 11, talkLia)];
  const a = npc('ally', 17, 14, talkAlly); a.name = CFG.text.allyName; G.ents.push(a);
  G.banner = { t: CFG.text.town, age: 0 };
  save();
  if (first) say([
    { k: 'npc_sora', t: `¡Por fin despiertas, ${P.name}! Te encontramos desmayado junto a la puerta norte.` },
    { k: 'hero', t: 'Solo recuerdo una luz dorada... y el rugido de un dragón.' },
    { k: 'npc_sora', t: `Las criaturas del ${CFG.text.dungeon} se han vuelto agresivas. Algo las altera en el piso más profundo.` },
    { k: 'npc_sora', t: `Habla con ${CFG.text.allyName} en la plaza: conoce el cañón. Brok vende equipo, y yo curaré tus heridas siempre que vuelvas.` },
  ]);
}
function enterDungeon(floor) {
  G.scene = 'dun'; G.mode = 'play'; G.floor = floor; G.items = []; G.fx = []; G.ents = [P]; G.turn = 0;
  const m = G.map = genDungeon(floor), c0 = m.cen(m.rooms[0]);
  place(P, c0.x, c0.y);
  G.ally = null;
  if (G.flags.ally) {
    const st = allyStats(), a = G.ally = Object.assign({ kind: 'ally', key: 'ally', name: CFG.text.allyName, hp: st.maxhp, dx: 0, dy: 1, animT: 0 }, st);
    const d = DIRS.find(([dx, dy]) => walk(c0.x + dx, c0.y + dy)) || [0, 0];
    place(a, c0.x + d[0], c0.y + d[1]); G.ents.push(a);
  }
  const last = m.rooms[m.rooms.length - 1];
  const spawn = (kind, room) => { const p = freeIn(room); if (!p) return; const b = MONS[kind], k = 1 + .15 * (floor - 1); const e = { kind: 'enemy', key: kind, name: b.n, hp: Math.round(b.hp * k), maxhp: Math.round(b.hp * k), atk: Math.round(b.atk * (1 + .1 * (floor - 1))), def: b.def, xp: Math.round(b.xp * k), dx: 0, dy: 1, animT: 0, awake: false, boss: kind === 'golem' }; place(e, p.x, p.y); G.ents.push(e); return e; };
  if (floor === LAST_FLOOR) spawn('golem', last);
  else { const s = freeIn(last) || m.cen(last); m.t[s.y * m.w + s.x] = 2; }
  const pool = floor <= 2 ? ['slime', 'slime', 'bat'] : floor <= 4 ? ['slime', 'bat', 'scorp', 'scorp', 'lizard'] : ['scorp', 'lizard'];
  for (let i = 0; i < 3 + floor; i++) spawn(pick(pool), m.rooms[ri(1, m.rooms.length - 1)]);
  const loot = ['baya', 'baya', 'baya', 'elixir', 'elixir', 'semilla', 'gold', 'gold', 'gold', floor < 3 ? pick(['guantes', 'tunica', 'banda']) : pick(['vara', 'chaleco', 'amuleto', 'garras', 'manto'])];
  for (let i = 0; i < ri(4, 6); i++) { const p = freeIn(pick(m.rooms)); if (!p) continue; const id = pick(loot); G.items.push(id === 'gold' ? { x: p.x, y: p.y, gold: ri(8, 20) * floor } : { x: p.x, y: p.y, id }); }
  reveal();
  G.banner = { t: `${CFG.text.dungeon} — Piso ${floor}`, age: 0 };
  if (floor === LAST_FLOOR) msg('Sientes una presencia enorme en este piso...');
}
function reveal() { const m = G.map; if (m.kind !== 'dun') return; for (let y = P.y - 5; y <= P.y + 5; y++) for (let x = P.x - 8; x <= P.x + 8; x++) if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.seen[y * m.w + x] = 1; }

// ───────────────────────── diálogos y menús
function say(lines, cb) { G.dialog = { lines, i: 0, shown: 0, cb }; }
function advanceDialog() {
  const d = G.dialog, full = d.lines[d.i].t.length;
  if (d.shown < full) { d.shown = full; return; }
  d.i++; d.shown = 0;
  if (d.i >= d.lines.length) { G.dialog = null; d.cb && d.cb(); }
}
function openMenu(title, opts, extra) { G.menu = Object.assign({ title, opts, cur: Math.max(0, opts.findIndex(o => !o.dis)) }, extra); }
const closeMenu = () => { G.menu = null; };
function confirmMenu(title, yes, no) { openMenu(title, [{ l: 'Sí', fn: () => { closeMenu(); yes(); } }, { l: 'No', fn: () => { closeMenu(); no && no(); } }], { cancel: () => { closeMenu(); no && no(); } }); }
function menuInput(k) {
  const m = G.menu;
  if (k === 'up' || k === 'down') { const n = m.opts.length; m.cur = (m.cur + (k === 'up' ? n - 1 : 1)) % n; }
  else if (k === 'a') { const o = m.opts[m.cur]; if (o && o.fn && !o.dis) o.fn(); }
  else if (k === 'b') { m.cancel ? m.cancel() : closeMenu(); }
}
function openMain() {
  const o = [{ l: 'Objetos', fn: openInv }, { l: 'Estado y equipo', fn: openStatus }];
  if (G.scene === 'dun') { o.push({ l: 'Técnicas', fn: openTechs }); o.push({ l: 'Abandonar expedición', fn: () => confirmMenu('¿Volver al pueblo?', () => enterTown()) }); }
  else o.push({ l: 'Guardar partida', fn: () => { save(); closeMenu(); msg('Partida guardada.'); } });
  o.push({ l: 'Cerrar', fn: closeMenu });
  openMenu('Menú', o);
}
function openInv() {
  if (!P.inv.length) { openMenu('Objetos', [{ l: '(vacío)', dis: true }], { cancel: openMain }); return; }
  openMenu('Objetos', P.inv.map((id, i) => ({ l: ITEMS[id].n, d: ITEMS[id].d + (ITEMS[id].slot ? ' Pulsa A para equipar.' : ''), fn: () => useItem(i) })), { cancel: openMain });
}
function useItem(i) {
  const id = P.inv[i], it = ITEMS[id];
  if (it.slot) { const old = P.eq[it.slot]; P.eq[it.slot] = id; P.inv.splice(i, 1); if (old) P.inv.push(old); P.hp = Math.min(P.hp, maxHp(P)); P.en = Math.min(P.en, maxEn()); msg(`${P.name} se equipa ${it.n}.`); openInv(); return; }
  if (id === 'baya') heal(P, 30); else if (id === 'elixir') P.en = Math.min(maxEn(), P.en + 20); else { heal(P, 999); P.en = maxEn(); }
  P.inv.splice(i, 1); msg(`${P.name} usa ${it.n}.`); closeMenu();
  if (G.scene === 'dun') endTurn();
}
function heal(e, n) { const b = e.hp; e.hp = Math.min(maxHp(e), e.hp + n); if (e.hp > b) floatTxt(e.x, e.y, '+' + (e.hp - b), '#7dffa0'); }
function openStatus() {
  const o = [
    { l: `${P.name}  Nv ${P.lvl}`, dis: true }, { l: `PS ${P.hp}/${maxHp(P)}   EN ${P.en}/${maxEn()}`, dis: true },
    { l: `ATQ ${atkOf(P)}   DEF ${defOf(P)}`, dis: true }, { l: `EXP ${P.xp}/${P.lvl * 18}   Oro ${P.gold}`, dis: true },
  ];
  for (const s in P.eq) { const id = P.eq[s]; o.push({ l: `${SLOT_NAME[s]}: ${id ? ITEMS[id].n : '—'}`, d: id ? ITEMS[id].d + ' Pulsa A para quitar.' : 'Nada equipado.', dis: !id, fn: () => { P.inv.push(id); P.eq[s] = null; P.hp = Math.min(P.hp, maxHp(P)); P.en = Math.min(P.en, maxEn()); openStatus(); } }); }
  openMenu('Estado', o, { cancel: openMain });
}
function openTechs() {
  if (G.scene !== 'dun') { msg('Las técnicas solo se usan en la mazmorra.'); closeMenu(); return; }
  openMenu('Técnicas', TECHS.map((t, i) => ({ l: P.lvl >= t.lv ? `${t.n}  ${t.c} EN` : `??? (Nv ${t.lv})`, d: P.lvl >= t.lv ? t.d : 'Aún no la has aprendido.', dis: P.lvl < t.lv || P.en < t.c, fn: () => { closeMenu(); useTech(i); } })));
}
function openShop() {
  const stock = ['baya', 'elixir', 'semilla', 'guantes', 'tunica', 'banda', 'amuleto', 'vara', 'chaleco'];
  const build = () => openMenu(`Tienda — Oro ${P.gold}`, stock.map(id => ({ l: `${ITEMS[id].n}  ${ITEMS[id].price}`, d: ITEMS[id].d, dis: P.gold < ITEMS[id].price, fn: () => { if (P.inv.length >= 16) { msg('La mochila está llena.'); return; } P.gold -= ITEMS[id].price; P.inv.push(id); msg(`Compras ${ITEMS[id].n}.`); const c = G.menu.cur; build(); G.menu.cur = c; } })).concat([{ l: 'Salir', fn: closeMenu }]));
  build();
}
function talkSora() {
  P.hp = maxHp(P); P.en = maxEn();
  say(G.flags.cleared
    ? [{ k: 'npc_sora', t: `Has calmado el cañón, ${P.name}. Pero esa luz dorada que recuerdas... presiento que tu viaje apenas comienza.` }]
    : [{ k: 'npc_sora', t: 'Respira hondo... Listo, tus heridas están curadas y tu energía, restaurada.' }, { k: 'npc_sora', t: `La entrada al ${CFG.text.dungeon} está al norte. Baja con cuidado: son ${LAST_FLOOR} pisos.` }]);
}
function talkBrok() { say([{ k: 'npc_brok', t: '¡Bienvenido! Bayas, elixires y buen equipo. El equipo mejora tus estadísticas mientras lo lleves puesto.' }], openShop); }
function talkLia() { say([{ k: 'npc_lia', t: 'Un consejo: la energía (EN) se recupera sola al caminar. Usa TÉC para lanzar técnicas y ESP para esperar un turno.' }, { k: 'npc_lia', t: 'Al subir de nivel aprenderás técnicas nuevas. ¡Dicen que la última despierta un aura de dragón!' }]); }
function talkAlly() {
  const n = CFG.text.allyName;
  if (!G.flags.ally) say([{ k: 'ally', t: `¿Tú eres ${P.name}? La maestra me habló de ti. Conozco el cañón como la palma de mi mano.` }, { k: 'hero', t: '¿Me acompañarías? No sé qué voy a encontrar ahí dentro.' }, { k: 'ally', t: '¡Claro! Yo te cubro la espalda. Solo no me dejes atrás.' }], () => { G.flags.ally = true; save(); msg(`¡${n} se une al equipo!`); });
  else say([{ k: 'ally', t: pick(['Cuando quieras salimos. La puerta está al norte.', 'Si me debilito en un piso, me repondré al bajar al siguiente.', 'Los escorpiones pegan fuerte. Mejor atacarlos entre los dos.']) }]);
}

// ───────────────────────── combate y turnos
function setAnim(e, a, dur) { e.anim = a; e.animT = e.animDur = dur; }
function face(e, t) { e.dx = Math.sign(t.x - e.x); e.dy = Math.sign(t.y - e.y); }
function canStep(e, dx, dy) { if (!walk(e.x + dx, e.y + dy)) return false; return !(dx && dy && (!walk(e.x + dx, e.y) || !walk(e.x, e.y + dy))); }
function canHit(a, d) { const dx = d.x - a.x, dy = d.y - a.y; return Math.max(Math.abs(dx), Math.abs(dy)) === 1 && canStep(a, dx, dy); }
function attack(a, d, mult, lunge = true) {
  const dmg = Math.max(1, Math.round(atkOf(a) * mult - defOf(d) / 2 + ri(-1, 1)));
  if (lunge) { face(a, d); a.px += a.dx * 6; a.py += a.dy * 6; }
  setAnim(a, 'attack', 260); setAnim(d, 'hurt', 300);
  d.hp -= dmg; floatTxt(d.x, d.y, '-' + dmg, d.kind === 'enemy' ? '#fff' : '#ff7a7a');
  if (d.kind === 'enemy') d.awake = true;
  if (d.hp <= 0) kill(d);
}
function kill(d) {
  d.hp = 0;
  if (d.kind === 'enemy') {
    G.ents = G.ents.filter(e => e !== d); msg(`${d.name} cae derrotado. +${d.xp} EXP`);
    if (Math.random() < .25) G.items.push({ x: d.x, y: d.y, gold: ri(4, 10) * G.floor });
    gainXp(d.xp); if (d.boss) G.pending = ending;
  } else if (d.kind === 'ally') { G.ents = G.ents.filter(e => e !== d); msg(`${d.name} se ha debilitado...`); }
  else G.pending = defeat;
}
function gainXp(n) {
  P.xp += n;
  while (P.xp >= P.lvl * 18) {
    P.xp -= P.lvl * 18; P.lvl++; P.bhp += 6; P.ben += 3; P.atk++; if (P.lvl % 2 === 0) P.def++;
    P.hp = Math.min(maxHp(P), P.hp + 10); msg(`¡${P.name} sube al nivel ${P.lvl}!`); floatTxt(P.x, P.y - 1, '¡NIVEL!', '#ffe060');
    const t = TECHS.find(t => t.lv === P.lvl); if (t) msg(`¡Aprende ${t.n}!`);
    if (G.ally) { const st = allyStats(); G.ally.hp += st.maxhp - G.ally.maxhp; Object.assign(G.ally, st); }
  }
}
function useTech(i) {
  const t = TECHS[i]; if (P.en < t.c || P.lvl < t.lv) return;
  if (i === 0) { const o = entAt(P.x + P.dx, P.y + P.dy); if (!o || o.kind !== 'enemy' || !canHit(P, o)) { msg('No hay ningún enemigo enfrente.'); return; } P.en -= t.c; msg(`¡${P.name} usa ${t.n}!`); attack(P, o, 1.8); }
  else if (i === 1) {
    P.en -= t.c; msg(`¡${P.name} lanza ${t.n}!`); const cells = []; let x = P.x, y = P.y, hit = null;
    for (let s = 0; s < 6; s++) { x += P.dx; y += P.dy; if (!walk(x, y)) break; cells.push([x, y]); const o = entAt(x, y); if (o && o.kind === 'enemy') { hit = o; break; } }
    G.fx.push({ type: 'beam', cells, age: 0, life: 260 }); setAnim(P, 'attack', 300);
    if (hit) attack(P, hit, 1.6, false);
  } else if (i === 2) {
    P.en -= t.c; msg(`¡${P.name} desata ${t.n}!`); G.fx.push({ type: 'ring', x: P.x, y: P.y, age: 0, life: 320 });
    for (const [dx, dy] of DIRS) { const o = entAt(P.x + dx, P.y + dy); if (o && o.kind === 'enemy') attack(P, o, 1.4, false); }
    setAnim(P, 'attack', 300);
  } else { P.en -= t.c; P.aura = 15; msg(`¡Un aura dorada envuelve a ${P.name}!`); G.fx.push({ type: 'ring', x: P.x, y: P.y, age: 0, life: 400 }); }
  G.lock = 220; endTurn();
}
function bfsStep(e, tx, ty) {
  const m = G.map, w = m.w, prev = new Int16Array(w * m.h).fill(-1), start = e.y * w + e.x, goal = ty * w + tx;
  const occ = new Set(G.ents.filter(o => o !== e && o.hp > 0).map(o => o.y * w + o.x)); occ.delete(goal);
  const q = [start]; prev[start] = start;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi]; if (c === goal) break; const cx = c % w, cy = (c / w) | 0;
    for (const [dx, dy] of DIRS) { const nx = cx + dx, ny = cy + dy, n = ny * w + nx; if (!walk(nx, ny) || prev[n] !== -1 || occ.has(n)) continue; if (dx && dy && (!walk(cx + dx, cy) || !walk(cx, cy + dy))) continue; prev[n] = c; q.push(n); }
  }
  if (prev[goal] === -1 || goal === start) return null;
  let c = goal; while (prev[c] !== start) c = prev[c];
  return { x: c % w, y: (c / w) | 0 };
}
function stepTo(e, tx, ty) { const s = bfsStep(e, tx, ty); if (s && !entAt(s.x, s.y)) { e.dx = s.x - e.x; e.dy = s.y - e.y; e.x = s.x; e.y = s.y; return true; } return false; }
function allyAct() {
  const a = G.ally; if (!a || a.hp <= 0) return;
  const foes = G.ents.filter(e => e.kind === 'enemy'), adj = foes.find(f => canHit(a, f));
  if (adj) { attack(a, adj, 1); return; }
  const near = foes.filter(f => cheb(f, a) <= 4 && cheb(f, P) <= 5).sort((p, q) => cheb(p, a) - cheb(q, a))[0];
  if (near) { stepTo(a, near.x, near.y); return; }
  if (cheb(a, P) > 1) stepTo(a, P.x, P.y);
  if (G.turn % 6 === 0 && a.hp < a.maxhp) a.hp++;
}
function enemyAct(e) {
  const targets = [P, G.ally].filter(t => t && t.hp > 0).sort((p, q) => cheb(p, e) - cheb(q, e)), t = targets[0];
  if (!t) return;
  if (!e.awake && cheb(e, P) <= 6) e.awake = true;
  if (!e.awake) { if (Math.random() < .3) { const [dx, dy] = pick(DIRS); if (canStep(e, dx, dy) && !entAt(e.x + dx, e.y + dy)) { e.dx = dx; e.dy = dy; e.x += dx; e.y += dy; } } return; }
  if (canHit(e, t)) { attack(e, t, 1); return; }
  if (!stepTo(e, t.x, t.y) && targets[1] && canHit(e, targets[1])) attack(e, targets[1], 1);
}
function endTurn() {
  G.turn++;
  if (P.aura > 0 && --P.aura === 0) msg('El aura se desvanece.');
  if (!G.pending) allyAct();
  for (const e of G.ents.filter(e => e.kind === 'enemy')) { if (G.pending || P.hp <= 0) break; if (e.hp > 0) enemyAct(e); }
  if (G.turn % 2 === 0 && P.en < maxEn()) P.en++;
  if (G.turn % 5 === 0 && P.hp > 0 && P.hp < maxHp(P)) P.hp++;
  reveal();
  if (G.pending) { const f = G.pending; G.pending = null; f(); }
}
function defeat() {
  P.hp = 0;
  say([{ t: `${P.name} cae agotado... Todo se vuelve oscuro.` }], () => { const lost = P.gold >> 1; P.gold -= lost; enterTown(); say([{ k: 'npc_sora', t: `Te trajeron de vuelta inconsciente. Perdiste ${lost} de oro por el camino, pero estás a salvo. Prepárate mejor e inténtalo otra vez.` }]); });
}
function ending() {
  const first = !G.flags.cleared; G.flags.cleared = true;
  const l = [{ t: 'El Gólem del Cañón se desmorona. Entre los escombros brilla una esfera de luz dorada...' }, { k: 'hero', t: 'Esa luz... ¡es la misma que vi antes de despertar!' }];
  if (G.flags.ally) l.push({ k: 'ally', t: '¡Lo logramos! Aunque algo me dice que esto solo es el principio.' });
  l.push({ t: first ? 'Obtienes 150 de oro y el Anillo del Dragón. — Fin del primer capítulo —' : 'Obtienes 150 de oro.' });
  say(l, () => { P.gold += 150; if (first) P.inv.push('anillo'); enterTown(); });
}

// ───────────────────────── acciones del jugador
function playerDir(dx, dy) {
  P.dx = dx; P.dy = dy;
  const nx = P.x + dx, ny = P.y + dy, o = entAt(nx, ny);
  if (G.scene === 'dun' && o && o.kind === 'enemy') { if (!canHit(P, o)) return; attack(P, o, 1); G.lock = 200; endTurn(); return; }
  if (!canStep(P, dx, dy)) return;
  if (o) { if (o.kind !== 'ally' || G.scene !== 'dun') return; o.x = P.x; o.y = P.y; o.dx = -dx; o.dy = -dy; }
  P.x = nx; P.y = ny;
  if (G.scene === 'town') { if (G.map.t[ny * G.map.w + nx] === 'gate') confirmMenu(`¿Entrar al ${CFG.text.dungeon}?`, () => enterDungeon(1), () => { P.y++; P.dy = 1; }); return; }
  const it = G.items.findIndex(i => i.x === nx && i.y === ny);
  if (it >= 0) { const i = G.items[it]; if (i.gold) { P.gold += i.gold; msg(`Recoges ${i.gold} de oro.`); G.items.splice(it, 1); } else if (P.inv.length < 16) { P.inv.push(i.id); msg(`Recoges ${ITEMS[i.id].n}.`); G.items.splice(it, 1); } else msg('La mochila está llena.'); }
  endTurn();
  if (G.scene === 'dun' && !G.dialog && G.map.t[P.y * G.map.w + P.x] === 2) confirmMenu(`¿Bajar al piso ${G.floor + 1}?`, () => enterDungeon(G.floor + 1));
}
function actA() {
  const o = entAt(P.x + P.dx, P.y + P.dy);
  if (G.scene === 'town') { if (o && o.kind === 'npc') { o.dx = -P.dx; o.dy = -P.dy; o.talk(); } return; }
  if (o && o.kind === 'enemy' && canHit(P, o)) attack(P, o, 1);
  else if (G.map.t[P.y * G.map.w + P.x] === 2) { confirmMenu(`¿Bajar al piso ${G.floor + 1}?`, () => enterDungeon(G.floor + 1)); return; }
  else setAnim(P, 'attack', 200);
  G.lock = 200; endTurn();
}
function press(k) {
  if (nameOv.style.display === 'flex' || G.mode === 'boot') return;
  if (G.dialog) { if (k === 'a' || k === 'b') advanceDialog(); return; }
  if (G.menu) { menuInput(k); return; }
  if (G.mode !== 'play' || G.lock > 0 || !idle(P)) return;
  if (k === 'a') actA(); else if (k === 'b') openMain(); else if (k === 't') openTechs();
  else if (k === 'w' && G.scene === 'dun') { G.lock = 150; endTurn(); }
}
const idle = e => Math.abs(e.px - e.x * 16) < .5 && Math.abs(e.py - e.y * 16) < .5;

// ───────────────────────── título
function showTitle() {
  G.mode = 'title'; G.scene = null;
  const sv = loadSave(), o = [];
  if (sv) o.push({ l: 'Continuar', fn: () => { closeMenu(); P = Object.assign(newPlayer(sv.p.name), sv.p); G.flags = sv.flags || {}; enterTown(); } });
  o.push({ l: 'Nueva partida', fn: () => { nameOv.style.display = 'flex'; nameInp.value = CFG.text.heroName; } });
  o.push({ l: 'Gráficos cargados', fn: showAssets });
  openMenu('', o, { cancel: () => { } });
}
function showAssets() {
  const ok = ASSET_STATUS.filter(a => a.ok).length;
  const o = ASSET_STATUS.map(a => ({ l: (a.ok ? '✔ ' : '✖ ') + a.path, d: a.ok ? 'Cargado desde assets/.' : 'Falta: se usa un marcador. Súbelo a public/assets/' + a.path, fn: () => { } }));
  if (!o.length) o.push({ l: 'No se pudo leer assets.json', dis: true });
  openMenu(`Gráficos ${ok}/${ASSET_STATUS.length}`, o, { cancel: showTitle, wide: true });
}
const nameOv = document.getElementById('nameov'), nameInp = document.getElementById('nameinp');
document.getElementById('namebtn').addEventListener('click', () => {
  const n = nameInp.value.trim().slice(0, 10) || CFG.text.heroName;
  nameOv.style.display = 'none'; nameInp.blur(); closeMenu();
  P = newPlayer(n); G.flags = {}; enterTown(true);
});

// ───────────────────────── entrada
const keys = new Set(); let touchDir = null;
const KEYDIR = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
const KEYACT = { z: 'a', Enter: 'a', ' ': 'a', x: 'b', Escape: 'b', c: 't', v: 'w' };
addEventListener('keydown', e => {
  if (nameOv.style.display === 'flex') { if (e.key === 'Enter') document.getElementById('namebtn').click(); return; }
  if (KEYDIR[e.key]) { keys.add(e.key); const d = KEYDIR[e.key]; if (d[1] && (G.menu)) press(d[1] < 0 ? 'up' : 'down'); e.preventDefault(); }
  else if (KEYACT[e.key] && !e.repeat) { press(KEYACT[e.key]); e.preventDefault(); }
});
addEventListener('keyup', e => keys.delete(e.key));
function heldDir() {
  if (touchDir) return touchDir;
  let dx = 0, dy = 0; for (const k of keys) { dx += KEYDIR[k][0]; dy += KEYDIR[k][1]; }
  dx = Math.sign(dx); dy = Math.sign(dy); return dx || dy ? [dx, dy] : null;
}
const dpad = document.getElementById('dpad');
function dpadMove(e) {
  const r = dpad.getBoundingClientRect(), sx = e.clientX - r.left - r.width / 2, sy = e.clientY - r.top - r.height / 2;
  const x = rotated ? sy : sx, y = rotated ? -sx : sy;
  let d = null;
  if (Math.hypot(x, y) > r.width * .12) { const o = Math.round(Math.atan2(y, x) / (Math.PI / 4)); d = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]][(o + 8) % 8]; }
  const changed = !touchDir || !d || touchDir[0] !== d[0] || touchDir[1] !== d[1];
  touchDir = d;
  if (d && changed && G.menu && d[1]) press(d[1] < 0 ? 'up' : 'down');
}
dpad.addEventListener('pointerdown', e => { dpad.setPointerCapture(e.pointerId); dpad.classList.add('on'); dpadMove(e); e.preventDefault(); });
dpad.addEventListener('pointermove', e => { if (dpad.hasPointerCapture(e.pointerId)) dpadMove(e); });
for (const ev of ['pointerup', 'pointercancel']) dpad.addEventListener(ev, () => { touchDir = null; dpad.classList.remove('on'); });
for (const b of document.querySelectorAll('.bt')) {
  b.addEventListener('pointerdown', e => { b.classList.add('on'); press(b.dataset.k); e.preventDefault(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => b.classList.remove('on'));
}
cv.addEventListener('pointerdown', () => { if (G.dialog) press('a'); });
// Ajusta el lienzo a toda la pantalla; en un móvil en vertical la interfaz se gira a horizontal.
function resize() {
  const w = innerWidth, h = innerHeight, touch = matchMedia('(pointer:coarse)').matches;
  rotated = touch && h > w;
  document.body.classList.toggle('rot', rotated); document.body.classList.toggle('touch', touch);
  const asp = rotated ? h / w : w / h;
  CW = clamp(Math.round(CH * asp / 2) * 2, 640, 1200); cv.width = CW; cv.height = CH;
}
addEventListener('resize', resize); resize();
addEventListener('pointerdown', () => {
  if (!matchMedia('(pointer:coarse)').matches || document.fullscreenElement || window.__noFS) return;
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { })).catch(() => { });
}, { once: false });
addEventListener('contextmenu', e => e.preventDefault());

// ───────────────────────── bucle y dibujo
function update(dt) {
  G.time += dt; if (G.lock > 0) G.lock -= dt;
  for (const e of G.ents) {
    const sp = dt * .16, tx = e.x * 16, ty = e.y * 16;
    e.px += clamp(tx - e.px, -sp, sp); e.py += clamp(ty - e.py, -sp, sp);
    if (e.animT > 0) e.animT -= dt;
  }
  for (const f of G.fx) f.age += dt; G.fx = G.fx.filter(f => f.age < f.life);
  if (G.banner && (G.banner.age += dt) > 2200) G.banner = null;
  if (G.dialog) G.dialog.shown += dt * .05;
  if (G.mode === 'play' && !G.dialog && !G.menu && G.lock <= 0 && idle(P) && P.hp > 0) { const d = heldDir(); if (d) playerDir(d[0], d[1]); }
}
const dirName = e => e.dy > 0 && !e.dx ? 'down' : e.dy < 0 && !e.dx ? 'up' : e.dx < 0 ? 'left' : e.dx > 0 ? 'right' : 'down';
function txt(s, x, y, col = '#fff', font = FONT, align = 'left') { ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'top'; ctx.fillStyle = '#000'; ctx.fillText(s, x + 2, y + 2); ctx.fillStyle = col; ctx.fillText(s, x, y); }
function panel(x, y, w, h) { ctx.fillStyle = 'rgba(14,20,36,.94)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = 'rgba(255,255,255,.04)'; for (let i = y + 4; i < y + h - 2; i += 4) ctx.fillRect(x + 3, i, w - 6, 1); ctx.strokeStyle = '#e9b84a'; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3); ctx.strokeStyle = '#7a5418'; ctx.lineWidth = 1; ctx.strokeRect(x + 5.5, y + 5.5, w - 11, h - 11); }
function wrap(s, maxW, font) { ctx.font = font; const out = []; let line = ''; for (const w of s.split(' ')) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line); return out; }
function bar(x, y, w, v, max, col) { ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 2, w + 4, 14); ctx.fillStyle = '#333a4a'; ctx.fillRect(x, y, w, 10); ctx.fillStyle = col; ctx.fillRect(x, y, Math.max(0, w * v / max), 10); }

function drawWorld() {
  const m = G.map, camX = clamp(P.px + 8 - CW / S / 2, 0, m.w * 16 - CW / S), camY = clamp(P.py + 8 - VH * 8, 0, m.h * 16 - VH * 16);
  const cx = Math.round(camX * S) / S, cy = Math.round(camY * S) / S;
  ctx.setTransform(S, 0, 0, S, -cx * S, -cy * S); ctx.imageSmoothingEnabled = false;
  const x0 = Math.floor(cx / 16), y0 = Math.floor(cy / 16);
  for (let y = y0; y <= y0 + VH && y < m.h; y++) for (let x = x0; x <= x0 + Math.ceil(CW / 48) && x < m.w; x++) {
    const t = m.t[y * m.w + x];
    if (m.kind === 'town') ctx.drawImage(tileOf(t, x, y), x * 16, y * 16);
    else if (!m.seen[y * m.w + x]) R(ctx, '#0b0806', x * 16, y * 16, 16, 16);
    else ctx.drawImage(tileOf(t === 1 ? 'dfloor' : t === 2 ? 'stairs' : (y + 1 < m.h && m.t[(y + 1) * m.w + x] !== 0 ? 'dcliff' : 'dtop'), x, y), x * 16, y * 16);
  }
  const vis = e => m.kind === 'town' || e.kind !== 'enemy' || (cheb(e, P) <= 6 && m.seen[e.y * m.w + e.x]);
  for (const i of G.items) if (m.seen[i.y * m.w + i.x]) ctx.drawImage(i.gold ? GOLD_ICON : ITEMS[i.id].icon, i.x * 16, i.y * 16);
  for (const e of [...G.ents].sort((a, b) => a.py - b.py)) {
    if (!vis(e)) continue;
    const moving = !idle(e), anim = e.animT > 0 ? e.anim : moving ? 'walk' : 'idle', t = e.animT > 0 ? e.animDur - e.animT : G.time;
    if (e === P && P.aura > 0) { ctx.fillStyle = `rgba(255,220,80,${.25 + .15 * Math.sin(G.time / 80)})`; ctx.fillRect(e.px - 1, e.py - 3, 18, 19); }
    SPR[e.key].draw(ctx, Math.round(e.px), Math.round(e.py), dirName(e), anim, t);
    if (e.kind === 'enemy' && e.hp < e.maxhp) { R(ctx, '#000', e.px + 2, e.py - 3, 12, 2); R(ctx, '#e04848', e.px + 2, e.py - 3, 12 * e.hp / e.maxhp, 2); }
  }
  for (const f of G.fx) {
    const k = f.age / f.life;
    if (f.type === 'beam') { ctx.fillStyle = `rgba(255,236,120,${1 - k})`; for (const [x, y] of f.cells) ctx.fillRect(x * 16 + 3, y * 16 + 3, 10, 10); ctx.fillStyle = `rgba(255,255,255,${1 - k})`; for (const [x, y] of f.cells) ctx.fillRect(x * 16 + 6, y * 16 + 6, 4, 4); }
    if (f.type === 'ring') { ctx.strokeStyle = `rgba(255,220,90,${1 - k})`; ctx.lineWidth = 2; ctx.strokeRect(f.x * 16 + 8 - 24 * k, f.y * 16 + 8 - 24 * k, 48 * k, 48 * k); }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const f of G.fx) if (f.type === 'txt') txt(f.t, (f.x - cx) * S, (f.y - cy) * S - 30 * f.age / f.life, f.col, FONT, 'center');
}
function drawHud() {
  ctx.fillStyle = 'rgba(10,14,26,.7)'; ctx.fillRect(6, 6, 236, 74);
  txt(`${P.name} Nv${P.lvl}`, 14, 10); bar(50, 38, 120, P.hp, maxHp(P), P.hp < maxHp(P) * .3 ? '#e04848' : '#4ad06a'); bar(50, 58, 120, P.en, maxEn(), '#4a9af0');
  txt('PS', 14, 34, '#9fe8b0', FONT_S); txt('EN', 14, 54, '#9fc8ff', FONT_S);
  txt(`${P.hp}`, 178, 34, '#fff', FONT_S); txt(`${P.en}`, 178, 54, '#fff', FONT_S);
  if (G.scene === 'town') txt(`Oro ${P.gold}`, CW - 14, 10, '#ffe060', FONT, 'right');
  else {
    const m = G.map, ox = CW - m.w * 3 - 10, oy = 30;
    txt(`Piso ${G.floor}`, CW - 14, 6, '#ffe060', FONT_S, 'right');
    ctx.fillStyle = 'rgba(10,14,26,.6)'; ctx.fillRect(ox - 3, oy - 3, m.w * 3 + 6, m.h * 3 + 6);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const i = y * m.w + x; if (m.seen[i] && m.t[i]) { ctx.fillStyle = m.t[i] === 2 ? '#60e0ff' : '#b89868'; ctx.fillRect(ox + x * 3, oy + y * 3, 3, 3); } }
    for (const e of G.ents) { if (e.kind === 'enemy' && !(cheb(e, P) <= 6)) continue; ctx.fillStyle = e === P ? '#fff' : e.kind === 'ally' ? '#60ff80' : '#ff5050'; ctx.fillRect(ox + e.x * 3, oy + e.y * 3, 3, 3); }
    if (G.ally) { const a = G.ally; ctx.fillStyle = 'rgba(10,14,26,.7)'; ctx.fillRect(6, 84, 236, 28); txt(a.name, 14, 90, a.hp > 0 ? '#c8ffd0' : '#888', FONT_S); bar(110, 92, 80, Math.max(0, a.hp), a.maxhp, '#4ad06a'); }
  }
  let y = CH - 26; for (let i = G.msgs.length - 1; i >= 0; i--) { const a = G.msgs[i], age = G.time - a.time; if (age > 5000) continue; ctx.globalAlpha = clamp((5000 - age) / 800, 0, 1); txt(a.t, CW / 2, y, '#fff', FONT_S, 'center'); y -= 20; } ctx.globalAlpha = 1;
  if (G.banner) { ctx.globalAlpha = clamp((2200 - G.banner.age) / 500, 0, 1); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 150, CW, 50); txt(G.banner.t, CW / 2, 164, '#ffe9a0', 'bold 24px monospace', 'center'); ctx.globalAlpha = 1; }
}
function drawDialog() {
  const d = G.dialog, l = d.lines[d.i], w = Math.min(CW - 20, 780), x = (CW - w) / 2, y = 8, h = 140;
  if (UI_IMG.dialog) { ctx.imageSmoothingEnabled = false; ctx.drawImage(UI_IMG.dialog, x, y, w, h); } else panel(x, y, w, h);
  let tx = x + 22;
  if (l.k) {
    const im = PORTRAIT[l.k], sc = Math.min(96 / im.width, 96 / im.height), pw = im.width * sc, ph = im.height * sc;
    ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#000'; ctx.fillRect(x + 18, y + 20, 100, 100);
    ctx.drawImage(im, x + 20 + (96 - pw) / 2, y + 22 + (96 - ph) / 2, pw, ph);
    ctx.strokeStyle = '#e9b84a'; ctx.lineWidth = 2; ctx.strokeRect(x + 19, y + 21, 98, 98);
    tx = x + 134;
    const nm = l.k === 'hero' ? P.name : l.k === 'ally' ? CFG.text.allyName : (CFG.characters[l.k] || {}).name || '';
    txt(nm, tx, y + 14, '#ffe060');
  }
  const lines = wrap(l.t.slice(0, Math.floor(d.shown)), x + w - 24 - tx, FONT);
  lines.slice(0, 4).forEach((s, i) => txt(s, tx, y + (l.k ? 42 : 24) + i * 23));
  if (d.shown >= l.t.length && Math.floor(G.time / 350) % 2) txt('▼', x + w - 34, y + h - 30, '#ffe060');
}
function drawMenu() {
  const m = G.menu, n = Math.min(m.opts.length, 8), w = m.wide ? 520 : 340, x = (CW - w) / 2, y = G.mode === 'title' && !m.wide ? 270 : 92, h = n * 30 + (m.title ? 52 : 24);
  panel(x, y, w, h);
  if (m.title) txt(m.title, x + 18, y + 14, '#ffe060');
  const top = clamp(m.cur - 4, 0, Math.max(0, m.opts.length - n)), oy = y + (m.title ? 44 : 14);
  for (let i = 0; i < n; i++) { const o = m.opts[top + i]; if (top + i === m.cur) txt('▶', x + 14, oy + i * 30, '#ffe060'); txt(o.l, x + 40, oy + i * 30, o.dis ? '#8a93a8' : '#fff', m.wide ? FONT_S : FONT); }
  if (m.opts.length > n) txt(`${m.cur + 1}/${m.opts.length}`, x + w - 16, y + 14, '#8a93a8', FONT_S, 'right');
  const o = m.opts[m.cur];
  if (o && o.d) { const dw = Math.min(CW - 20, 600), dx = (CW - dw) / 2, ls = wrap(o.d, dw - 36, FONT_S).slice(0, 3); panel(dx, 6, dw, ls.length * 20 + 22); ls.forEach((s, i) => txt(s, dx + 18, 17 + i * 20, '#fff', FONT_S)); }
}
function drawTitle() {
  const g = ctx.createLinearGradient(0, 0, 0, CH); g.addColorStop(0, '#1a2a4a'); g.addColorStop(.6, '#b85a2a'); g.addColorStop(1, '#3a1a10'); ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
  ctx.imageSmoothingEnabled = false;
  for (let x = 0; x < CW; x += 48) { ctx.drawImage(TILES.dcliff[(x / 48) % TILES.dcliff.length], x, CH - 96, 48, 48); ctx.drawImage(TILES.dtop[(x / 48) % TILES.dtop.length], x, CH - 48, 48, 48); }
  ctx.save(); ctx.translate(CW / 2 - 48, 130 + Math.sin(G.time / 400) * 4); ctx.scale(6, 6); SPR.hero.draw(ctx, 0, 0, 'down', 'idle', G.time); ctx.restore();
  txt(CFG.text.title.toUpperCase(), CW / 2, 50, '#ffe060', 'bold 56px monospace', 'center');
  txt('Mazmorras misteriosas', CW / 2, 112, '#fff', FONT, 'center');
}
let lastT = 0;
function frame(t) {
  const dt = Math.min(50, t - lastT); lastT = t; update(dt);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, CW, CH);
  if (G.mode === 'boot') txt('Cargando...', CW / 2, CH / 2, '#fff', FONT, 'center');
  else if (G.mode === 'title') drawTitle();
  else { drawWorld(); if (!G.dialog) drawHud(); }
  if (G.menu) drawMenu();
  if (G.dialog) drawDialog();
  requestAnimationFrame(frame);
}

let TOWN;
requestAnimationFrame(frame);
loadAssets().then(() => { buildSprites(); TOWN = buildTown(); showTitle(); });
window.__DM = { G, get P() { return P; }, press, ASSET_STATUS };
})();
