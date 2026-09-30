document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('mainGameCanvas');
  if (!canvas) {
    console.error("Canvas introuvable ! Vérifie l'ID dans game.html");
    return;
  }
  const container = canvas.parentElement;
  const ctx = canvas.getContext('2d');

  /* =========================================================
     RÉGLAGES — tout ce qui se règle est ici
     ========================================================= */
  const CFG = {
    gravity: 1800,       // px/s² — plus petit = saut plus flottant
    jumpPower: 620,      // px/s — force du saut
    jumpCut: 400,        // relâcher tôt = saut plus court (petit hop)
    startSpeed: 300,     // px/s au départ
    maxSpeed: 1500,      // vitesse max
    accel: 8,            // px/s gagnés chaque seconde de jeu
    playerX: 90,
    playerH: 110,        // hauteur dessinée du perso
    footOffset: 6,       // marge transparente sous les pieds dans le sprite
    hitbox: { w: 0.3, h: 0.8 },
    pixelArt: true,      // true = rendu net sans lissage
    jumpFrame: 13,       // image figée pendant le saut (par rapport au 1er set)
    groundRatio: 0.74,   // position du sol (part de la hauteur)
    logicalW: { desktop: 1000, phone: 720 }, // largeur "monde" : plus petit = tout paraît plus gros
    font: '"Game-Font", sans-serif',

    // Animation : 1 cycle complet par seconde au départ, de plus en plus vite avec la vitesse
    cycleHzStart: 1,
    cycleExp: 0.8,       // 1 = proportionnel à la vitesse, < 1 = plus doux

    // Score "years" : monte de plus en plus vite avec la vitesse (quasi exponentiel)
    yearsPerSec: 1,
    yearsExp: 2,

    // Fond qui s'assombrit : début à x2, totalement sombre à x4
    darkFrom: 2,
    darkFull: 4,

    // Sets d'images. Pour ajouter un autre rendu (autre nombre de frames),
    // ajoute un objet : il prend le relais quand la vitesse dépasse minSpeed (en x).
    sets: [
      { minSpeed: 1, folder: 'images/walk/', prefix: 'RENDU_PIXEL_Walk', ext: '.png', count: 24 }
      // { minSpeed: 3, folder: 'images/run/', prefix: 'RENDU_PIXEL_Run', ext: '.png', count: 12 }
    ],
    obstacleImg: null    // ex: 'images/nez2.jpg'
  };

  const PINK = '#e65c7b';
  const L = { page: [251, 244, 246], bg: [255, 255, 255], fg: [17, 17, 19], mute: [119, 119, 119] };
  const D = { page: [10, 10, 13], bg: [24, 24, 30], fg: [244, 238, 240], mute: [150, 146, 152] };
  const mixC = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const col = { page: rgb(L.page), bg: L.bg, fg: L.fg, mute: L.mute };

  if (document.fonts && document.fonts.load) document.fonts.load(`16px ${CFG.font}`).catch(() => {});

  /* =========================================================
     IMAGES
     ========================================================= */
  const sets = CFG.sets.slice().sort((a, b) => a.minSpeed - b.minSpeed).map((s) => ({
    ...s,
    imgs: Array.from({ length: s.count }, (_, i) => {
      const img = new Image();
      img.src = s.folder + s.prefix + String(i).padStart(2, '0') + s.ext;
      if (i === 0) img.onerror = () => console.warn(`Sprite introuvable : ${img.src} — vérifie CFG.sets`);
      return img;
    })
  }));

  let obstacleImg = null;
  if (CFG.obstacleImg) {
    obstacleImg = new Image();
    obstacleImg.src = CFG.obstacleImg;
  }

  const ok = (img) => img && img.complete && img.naturalWidth > 0;
  const curSet = () => {
    let s = sets[0];
    for (const t of sets) if (speed / CFG.startSpeed >= t.minSpeed) s = t;
    return s;
  };
  const spriteW = () => {
    const img = curSet().imgs[0];
    return ok(img) ? CFG.playerH * img.naturalWidth / img.naturalHeight : 70;
  };

  /* =========================================================
     TAILLE RESPONSIVE : le monde s'adapte à la taille du conteneur
     ========================================================= */
  let LW = 1000, LH = 450, scale = 1, u = 1, groundY = 335;

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    LW = w >= 700 ? CFG.logicalW.desktop : CFG.logicalW.phone;
    scale = w / LW;
    u = 1 / scale;                       // 1 px écran en unités du monde (pour textes/traits)
    LH = Math.round(h / scale);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.imageSmoothingEnabled = !CFG.pixelArt;
    groundY = Math.round(LH * CFG.groundRatio);
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(container);

  /* =========================================================
     ÉTAT
     ========================================================= */
  let state = 'ready'; // 'ready' | 'running' | 'over'
  let elapsed = 0, years = 0, speed = CFG.startSpeed;
  let lift = 0, vy = 0, onGround = true;   // lift = hauteur au-dessus du sol
  let obstacles = [], nextGap = 0;
  let phase = 0, groundScroll = 0, dark = 0, overAt = 0, best = 0;
  try { best = parseInt(localStorage.getItem('dinoBestYears'), 10) || 0; } catch (e) {}

  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const hint = coarse ? "TOUCHE L'ÉCRAN" : 'ESPACE ou CLIC';
  const yrs = (n) => `${n} ${n === 1 ? 'YEAR' : 'YEARS'}`;

  function start() {
    state = 'running';
    elapsed = 0; years = 0; phase = 0;
    speed = CFG.startSpeed;
    lift = 0; vy = 0; onGround = true;
    obstacles = [];
    nextGap = 400;
  }

  function gameOver() {
    state = 'over';
    overAt = performance.now();
    const score = Math.floor(years);
    if (score > best) {
      best = score;
      try { localStorage.setItem('dinoBestYears', String(best)); } catch (e) {}
    }
  }

  /* =========================================================
     CONTRÔLES (espace, flèche haut, clic, tactile n'importe où)
     ========================================================= */
  function press() {
    if (state === 'ready') return start();
    if (state === 'over') {
      if (performance.now() - overAt > 400) start();
      return;
    }
    if (onGround) {
      vy = -CFG.jumpPower;
      onGround = false;
    }
  }

  function release() {
    if (state === 'running' && vy < -CFG.jumpCut) vy = -CFG.jumpCut;
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (!e.repeat) press();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') release();
  });
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a')) return; // le lien retour reste cliquable
    e.preventDefault();
    press();
  });
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);

  /* =========================================================
     OBSTACLES
     ========================================================= */
  function spawn() {
    const r = Math.random();
    let o;
    if (obstacleImg && ok(obstacleImg) && r < 0.35) {
      o = { kind: 'img', w: 45, h: 55 };
    } else if (r < 0.6) {
      o = { kind: 'pillar', w: 30, h: 70 + Math.random() * 20 };
    } else {
      const n = 1 + Math.floor(Math.random() * 3);
      o = { kind: 'spike', n, w: 34 * n, h: 42 + Math.random() * 12 };
    }
    o.x = LW + 10;
    obstacles.push(o);
    const jumpDist = speed * (2 * CFG.jumpPower / CFG.gravity);
    nextGap = jumpDist * (1.15 + Math.random() * 1.1) + o.w;
  }

  function drawObstacle(o) {
    const y = groundY;
    if (o.kind === 'img') {
      ctx.drawImage(obstacleImg, o.x, y - o.h, o.w, o.h);
    } else if (o.kind === 'pillar') {
      ctx.fillStyle = rgb(col.fg);
      ctx.fillRect(o.x, y - o.h, o.w, o.h);
      ctx.fillStyle = PINK;
      ctx.fillRect(o.x + o.w * 0.35, y - o.h + 8, 5, o.h - 16);
    } else {
      const sw = o.w / o.n;
      for (let i = 0; i < o.n; i++) {
        const x0 = o.x + i * sw;
        ctx.fillStyle = rgb(col.fg);
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + sw / 2, y - o.h);
        ctx.lineTo(x0 + sw, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = PINK;
        ctx.beginPath();
        ctx.arc(x0 + sw / 2, y - o.h + 6, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* =========================================================
     MISE À JOUR
     ========================================================= */
  function update(dt) {
    if (state !== 'running') return;

    elapsed += dt;
    speed = Math.min(CFG.maxSpeed, CFG.startSpeed + elapsed * CFG.accel);
    const ratio = speed / CFG.startSpeed;

    years += CFG.yearsPerSec * Math.pow(ratio, CFG.yearsExp) * dt;
    groundScroll += speed * dt;
    phase = (phase + CFG.cycleHzStart * Math.pow(ratio, CFG.cycleExp) * dt) % 1;

    vy += CFG.gravity * dt;
    lift -= vy * dt;
    if (lift <= 0) {
      lift = 0;
      vy = 0;
      onGround = true;
    }

    const last = obstacles[obstacles.length - 1];
    if (!last || LW - (last.x + last.w) >= nextGap) spawn();

    const pw = spriteW();
    const hbW = pw * CFG.hitbox.w;
    const px = CFG.playerX + (pw - hbW) / 2;

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= speed * dt;
      const m = 5; // tolérance : la collision est un peu plus petite que le dessin
      if (px < o.x + o.w - m && px + hbW > o.x + m && lift < o.h - m) gameOver();
      if (o.x + o.w < 0) obstacles.splice(i, 1);
    }
  }

  /* Fond + couleurs : plus on va vite (à partir de x2), plus ça s'assombrit */
  let lastTheme = '';
  function updateTheme(dt) {
    const target = clamp((speed / CFG.startSpeed - CFG.darkFrom) / (CFG.darkFull - CFG.darkFrom), 0, 1);
    dark += (target - dark) * (1 - Math.exp(-dt * 3));
    col.bg = mixC(L.bg, D.bg, dark);
    col.fg = mixC(L.fg, D.fg, dark);
    col.mute = mixC(L.mute, D.mute, dark);
    col.page = rgb(mixC(L.page, D.page, dark));
    const key = col.page + rgb(col.fg);
    if (key !== lastTheme) {
      lastTheme = key;
      document.documentElement.style.backgroundColor = col.page;
      document.body.style.backgroundColor = col.page;
      document.documentElement.style.setProperty('--fg', rgb(col.fg));
    }
  }

  /* =========================================================
     DESSIN
     ========================================================= */
  const font = (px) => `${Math.round(px * u)}px ${CFG.font}`;

  function drawPlayer() {
    const s = curSet();
    let idx = Math.floor(phase * s.count) % s.count;
    if (state === 'ready') idx = 0;
    else if (!onGround) idx = Math.min(s.count - 1, Math.floor(CFG.jumpFrame / sets[0].count * s.count));

    const img = s.imgs[idx];
    const feetY = groundY - lift;
    if (ok(img)) {
      ctx.drawImage(img, CFG.playerX, feetY - CFG.playerH + CFG.footOffset, spriteW(), CFG.playerH);
    } else {
      ctx.fillStyle = PINK; // secours si les images ne chargent pas
      ctx.fillRect(CFG.playerX + 20, feetY - CFG.playerH * 0.8, 30, CFG.playerH * 0.8);
    }
  }

  function draw() {
    ctx.fillStyle = rgb(col.bg);
    ctx.fillRect(0, 0, LW, LH);

    // sol + repères qui défilent
    ctx.strokeStyle = rgb(col.fg);
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(LW, groundY);
    ctx.stroke();
    ctx.strokeStyle = rgb(col.fg, 0.18);
    for (let x = -(groundScroll % 90); x < LW; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, groundY + 14 * u);
      ctx.lineTo(x + 24, groundY + 14 * u);
      ctx.stroke();
    }

    obstacles.forEach(drawObstacle);
    drawPlayer();

    // HUD
    const pad = 20 * u;
    ctx.textAlign = 'right';
    ctx.fillStyle = rgb(col.fg);
    ctx.font = font(18);
    ctx.fillText(yrs(Math.floor(years)), LW - pad, 34 * u);
    ctx.fillStyle = rgb(col.mute);
    ctx.font = font(13);
    ctx.fillText(`RECORD ${yrs(best)}`, LW - pad, 56 * u);
    ctx.textAlign = 'left';
    ctx.fillText(`VITESSE x${(speed / CFG.startSpeed).toFixed(1)}`, pad, 34 * u);

    if (state !== 'running') {
      ctx.textAlign = 'center';
      if (state === 'over') {
        ctx.fillStyle = rgb(col.bg, 0.85);
        ctx.fillRect(0, 0, LW, LH);
      }
      const cy = LH / 2;
      ctx.fillStyle = rgb(col.fg);
      ctx.font = font(24);
      ctx.fillText(state === 'over' ? 'PARTIE TERMINÉE' : 'PRÊT ?', LW / 2, cy - 40 * u);
      ctx.font = font(14);
      if (state === 'over') ctx.fillText(`Tu as tenu ${yrs(Math.floor(years))}`, LW / 2, cy - 12 * u);
      ctx.fillText(`${hint} pour ${state === 'over' ? 'rejouer' : 'commencer'}`, LW / 2, cy + 16 * u);
      ctx.textAlign = 'left';
    }
  }

  /* =========================================================
     BOUCLE (temps réel : même vitesse à 60 ou 144 Hz)
     ========================================================= */
  let lastT = performance.now();
  function loop(now) {
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    update(dt);
    updateTheme(dt);
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
});