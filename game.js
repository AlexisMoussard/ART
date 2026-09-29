// Configuration du Canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Boutons & Modale
const openGameBtn = document.getElementById('openGame');
const closeGameBtn = document.getElementById('closeGameModal');
const gameModal = document.getElementById('gameModal');

// Sprites
const playerImg = new Image();
playerImg.src = 'images/CHAIR.gif'; // Ton personnage animé

const obstacleImg = new Image();
obstacleImg.src = 'images/nez2.jpg'; // Obstacle (ex: Nez)

// État du jeu
let isGameRunning = false;
let score = 0;
let gameSpeed = 5;
let animationFrameId;

// Joueur
const player = {
  x: 50,
  y: 200,
  width: 50,
  height: 60,
  velocityY: 0,
  gravity: 0.6,
  jumpPower: -12,
  isGrounded: false
};

// Obstacles
let obstacles = [];
let spawnTimer = 0;

// Ouverture/Fermeture Modale
openGameBtn.addEventListener('click', () => {
  gameModal.classList.add('active');
  resetGame();
  isGameRunning = true;
  loop();
});

closeGameBtn.addEventListener('click', () => {
  gameModal.classList.remove('active');
  isGameRunning = false;
  cancelAnimationFrame(animationFrameId);
});

// Contrôles (Espace ou Clic)
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && isGameRunning) {
    e.preventDefault();
    jump();
  }
});

canvas.addEventListener('mousedown', () => {
  if (isGameRunning) jump();
});

function jump() {
  if (player.isGrounded) {
    player.velocityY = player.jumpPower;
    player.isGrounded = false;
  }
}

// Reset du jeu
function resetGame() {
  score = 0;
  gameSpeed = 5;
  obstacles = [];
  player.y = 200;
  player.velocityY = 0;
  player.isGrounded = true;
}

// Boucle de jeu
function loop() {
  if (!isGameRunning) return;

  update();
  draw();

  animationFrameId = requestAnimationFrame(loop);
}

function update() {
  // Score & Augmentation progressive de la vitesse
  score++;
  if (score % 300 === 0) gameSpeed += 0.5;

  // Physique du joueur
  player.velocityY += player.gravity;
  player.y += player.velocityY;

  // Sol (Y = 200)
  if (player.y >= 200) {
    player.y = 200;
    player.velocityY = 0;
    player.isGrounded = true;
  }

  // Génération des obstacles
  spawnTimer++;
  if (spawnTimer > Math.max(60, 120 - Math.floor(score / 50))) {
    obstacles.push({
      x: canvas.width,
      y: 215,
      width: 45,
      height: 45
    });
    spawnTimer = 0;
  }

  // Déplacement et collisions
  for (let i = obstacles.length - 1; i >= 0; i--) {
    let obs = obstacles[i];
    obs.x -= gameSpeed;

    // Collision Hitbox AABB
    if (
      player.x < obs.x + obs.width &&
      player.x + player.width > obs.x &&
      player.y < obs.y + obs.height &&
      player.y + player.height > obs.y
    ) {
      // Game Over
      alert(`Game Over ! Score : ${Math.floor(score / 10)}`);
      resetGame();
    }

    // Supprimer les obstacles sortis de l'écran
    if (obs.x + obs.width < 0) {
      obstacles.splice(i, 1);
    }
  }
}

function draw() {
  // Effacer l'écran
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Ligne de sol
  ctx.beginPath();
  ctx.moveTo(0, 260);
  ctx.lineTo(canvas.width, 260);
  ctx.strokeStyle = '#111113';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Dessiner Joueur
  if (playerImg.complete) {
    ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
  } else {
    ctx.fillStyle = '#e65c7b';
    ctx.fillRect(player.x, player.y, player.width, player.height);
  }

  // Dessiner Obstacles
  for (let obs of obstacles) {
    if (obstacleImg.complete) {
      ctx.drawImage(obstacleImg, obs.x, obs.y, obs.width, obs.height);
    } else {
      ctx.fillStyle = '#333333';
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    }
  }

  // Affichage du Score
  ctx.fillStyle = '#111113';
  ctx.font = '16px "Mont-Bold", sans-serif';
  ctx.fillText(`SCORE: ${Math.floor(score / 10)}`, 680, 35);
}