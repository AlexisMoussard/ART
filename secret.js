(() => {
  const CFG = {
    total: 5,
    folder: 'images/',
    ext: '.png',
    counterImg: 'HIM_A',          // image du compteur 0/5
    size: 30,                     // taille des éléments cachés (px)
    restOpacity: 0.75,            // discrétion au repos (1 = bien visible)
    pink: '#f7b7c6',              // couleur du pulse
    pulseMs: 1800,

    // target = où il est caché (sélecteur CSS), index = n-ième élément de ce sélecteur,
    // x / y = position en % à l'intérieur de cet élément
    items: [
      { id: 'DERPESSED_A', target: '.hero-header',    x: 93, y: 72 },
      { id: 'TIRED_A',     target: '.hero-logo-zone', x: 6,  y: 78 },
      { id: 'CHILL_A',     target: '.artwork-card', index: 1, x: 90, y: 93 },
      { id: 'CHEER_A',     target: '.artwork-card', index: 4, x: 8,  y: 94 },
      { id: 'RESTFUL_A',   target: '.eyes-section-title', x: 97, y: 50 }
    ]
  };

  const KEY = 'secretFound';
  const FLAG = 'gameUnlocked';
  const src = (id) => CFG.folder + id + CFG.ext;
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  let found = read().filter((id) => CFG.items.some((i) => i.id === id));
  let counter = null;
  let label = null;
  let gameBtn = null;

  // pour retester : resetSecret() dans la console
  window.resetSecret = () => {
    try { localStorage.removeItem(KEY); localStorage.removeItem(FLAG); } catch (e) {}
    location.reload();
  };

  /* ---------- styles ---------- */
  const style = document.createElement('style');
  style.textContent = `
    .secret-counter { display:flex; align-items:center; gap:8px; font-family:'Mont-Bold',sans-serif;
      font-size:1.1rem; letter-spacing:0.05em; color:var(--text-main,#111113); user-select:none; }
    .secret-counter img { height:30px; width:auto; display:block; }
    .secret-counter.bump { animation:secretBump .35s ease; }
    @keyframes secretBump { 50% { transform:scale(1.18); } }
    .secret-item { position:absolute; transform:translate(-50%,-50%); width:${CFG.size + 10}px; height:${CFG.size + 10}px;
      padding:0; border:0; background:none; cursor:pointer; z-index:5; opacity:${CFG.restOpacity};
      transition:opacity .2s ease, transform .3s ease; -webkit-tap-highlight-color:transparent; }
    .secret-item img { width:${CFG.size}px; height:${CFG.size}px; object-fit:contain; display:block; margin:auto; pointer-events:none; }
    .secret-item:hover { opacity:1; transform:translate(-50%,-50%) scale(1.2); }
    .secret-item.taken { opacity:0; transform:translate(-50%,-50%) scale(1.8); pointer-events:none; }
    .secret-pulse { position:fixed; inset:0; z-index:-1; pointer-events:none; opacity:0; background:${CFG.pink}; }
  `;
  document.head.appendChild(style);

  /* ---------- pulse rose du fond : blanc → rose → blanc ---------- */
  function pulse() {
    const layer = document.createElement('div');
    layer.className = 'secret-pulse';
    document.body.appendChild(layer);
    const anim = layer.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }],
      { duration: CFG.pulseMs, easing: 'ease-in-out' }
    );
    anim.onfinish = () => layer.remove();
  }

  /* ---------- déblocage ---------- */
  function unlock() {
    write(FLAG, '1');
    pulse();
    // le bouton apparaît au plus fort du pulse, sans autre signal
    setTimeout(() => {
      if (counter) counter.remove();
      gameBtn.style.display = '';
      gameBtn.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, easing: 'ease-out' });
    }, CFG.pulseMs * 0.3);
  }

  function collect(id, el) {
    if (found.includes(id)) return;
    found.push(id);
    write(KEY, JSON.stringify(found));
    el.classList.add('taken');
    setTimeout(() => el.remove(), 350);
    if (found.length >= CFG.total) return unlock();
    label.textContent = `${found.length}/${CFG.total}`;
    counter.classList.remove('bump');
    void counter.offsetWidth;
    counter.classList.add('bump');
  }

  /* ---------- en-tête : bouton jeu caché, remplacé par le compteur ---------- */
  function setupHeader() {
    gameBtn = document.querySelector('.btn-game');
    if (!gameBtn) return console.warn('[secret] .btn-game introuvable dans la page');
    if (found.length >= CFG.total) { // déjà débloqué : on montre le bouton
      write(FLAG, '1');
      gameBtn.style.display = '';
      return;
    }

    gameBtn.style.display = 'none';
    counter = document.createElement('div');
    counter.className = 'secret-counter';
    counter.innerHTML = `<img src="${src(CFG.counterImg)}" alt=""><span>${found.length}/${CFG.total}</span>`;
    label = counter.querySelector('span');
    gameBtn.parentNode.insertBefore(counter, gameBtn);
  }

  /* ---------- éléments cachés ---------- */
  function placeItems() {
    if (!counter) return;
    CFG.items.forEach((item, n) => {
      if (found.includes(item.id)) return;
      const list = document.querySelectorAll(item.target);
      const host = list[Math.min(item.index || 0, list.length - 1)] || document.body;
      const onBody = host === document.body; // secours si la cible n'existe pas
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'secret-item';
      btn.setAttribute('aria-label', 'Élément caché');
      btn.style.left = (onBody ? 8 + n * 20 : item.x) + '%';
      btn.style.top = (onBody ? 15 + n * 16 : item.y) + '%';
      btn.innerHTML = `<img src="${src(item.id)}" alt="" draggable="false">`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // ne pas ouvrir la modale d'une peinture
        e.preventDefault();
        collect(item.id, btn);
      });
      host.appendChild(btn);
    });
  }

  function init() {
    setupHeader();
    // la galerie est parfois générée après le chargement : on attend qu'elle existe
    let tries = 0;
    const timer = setInterval(() => {
      if (document.querySelector('.artwork-card') || ++tries > 40) {
        clearInterval(timer);
        placeItems();
      }
    }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();