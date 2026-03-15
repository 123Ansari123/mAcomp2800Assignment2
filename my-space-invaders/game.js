// @ts-nocheck

class EventEmitter {
	constructor() {
		this.listeners = {};
	}

	on(message, listener) {
		if (!this.listeners[message]) this.listeners[message] = [];
		this.listeners[message].push(listener);
	}

	emit(message, payload = null) {
		if (this.listeners[message]) this.listeners[message].forEach((l) => l(message, payload));
	}
}

class GameObject {
	constructor(x, y) {
		this.x = x;
		this.y = y;
		this.dead = false;
		this.type = '';
		this.width = 0;
		this.height = 0;
		this.img = undefined;
	}

	draw(ctx) {
		if (this.img && !this.dead) ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
	}

	rectFromGameObject() {
		return {
			top: this.y,
			left: this.x,
			bottom: this.y + this.height,
			right: this.x + this.width,
		};
	}
}

class Hero extends GameObject {
	constructor(x, y) {
		super(x, y);
		this.width = 99;
		this.height = 75;
		this.type = 'Hero';
		this.speed = { x: 0, y: 0 };
		this.cooldown = 0;
		this.life = 3;
		this.points = 0;
	}

	fire() {
		gameObjects.push(new Laser(this.x + 45, this.y - 10));
		this.cooldown = 500;

		let id = setInterval(() => {
			if (this.cooldown > 0) {
				this.cooldown -= 100;
				if (this.cooldown === 0) clearInterval(id);
			}
		}, 200);
	}

	canFire() {
		return this.cooldown === 0;
	}

	decrementLife() {
		this.life--;
		if (this.life === 0) this.dead = true;
	}

	incrementPoints() {
		this.points += 100;
	}
}

class Enemy extends GameObject {
	constructor(x, y) {
		super(x, y);
		this.width = 98;
		this.height = 50;
		this.type = 'Enemy';
		this.speed = 0.8;
	}

	update() {
		this.y += this.speed;
		if (this.y > canvas.height) {
			this.y = 50;
			this.x = Math.random() * (canvas.width - this.width);
		}
	}
}

class Laser extends GameObject {
	constructor(x, y) {
		super(x, y);
		this.width = 9;
		this.height = 33;
		this.type = 'Laser';
		this.img = laserImg;
		this.speed = 10;
	}

	update() {
		this.y -= this.speed;
		if (this.y < 0) this.dead = true;
	}
}

function loadTexture(path) {
	return new Promise((resolve) => {
		const img = new Image();
		img.src = path;
		img.onload = () => resolve(img);
	});
}

function intersectRect(r1, r2) {
	return !(r2.left > r1.right || r2.right < r1.left || r2.top > r1.bottom || r2.bottom < r1.top);
}

const Messages = {
	KEY_EVENT_UP: 'KEY_EVENT_UP',
	KEY_EVENT_DOWN: 'KEY_EVENT_DOWN',
	KEY_EVENT_LEFT: 'KEY_EVENT_LEFT',
	KEY_EVENT_RIGHT: 'KEY_EVENT_RIGHT',
	KEY_EVENT_SPACE: 'KEY_EVENT_SPACE',
	KEY_EVENT_R: 'KEY_EVENT_R',
	COLLISION_ENEMY_LASER: 'COLLISION_ENEMY_LASER',
	COLLISION_ENEMY_HERO: 'COLLISION_ENEMY_HERO',
};

// Game variables
let heroImg, enemyImg, laserImg, lifeImg, canvas, ctx, gameObjects = [], hero;
let eventEmitter = new EventEmitter();
let gameOver = false;
let gameWin = false;

// Track pressed keys
let keys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };

window.addEventListener('keydown', (e) => {
	if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
	if (e.code === 'Space') eventEmitter.emit(Messages.KEY_EVENT_SPACE);
	if (e.key === 'r' || e.key === 'R') eventEmitter.emit(Messages.KEY_EVENT_R);
});

window.addEventListener('keyup', (e) => {
	if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

function handleInput() {
	if (gameOver || gameWin) return;

	if (keys.ArrowLeft && hero.x > 0) hero.x -= 7;
	if (keys.ArrowRight && hero.x < canvas.width - hero.width) hero.x += 7;
	if (keys.ArrowUp && hero.y > 0) hero.y -= 5;
	if (keys.ArrowDown && hero.y < canvas.height - hero.height) hero.y += 5;
}

function createEnemies() {
	for (let row = 0; row < 3; row++) {
		for (let col = 0; col < 5; col++) {
			const x = 200 + col * 120;
			const y = 80 + row * 70;
			const enemy = new Enemy(x, y);
			enemy.img = enemyImg;
			gameObjects.push(enemy);
		}
	}
}

function createHero() {
	hero = new Hero(canvas.width / 2 - 45, canvas.height - 120);
	hero.img = heroImg;
	gameObjects.push(hero);
}

function updateGameObjects() {
	if (gameOver || gameWin) return;

	gameObjects.forEach((obj) => { if (obj.update) obj.update(); });

	const enemies = gameObjects.filter((go) => go.type === 'Enemy');
	const lasers = gameObjects.filter((go) => go.type === 'Laser');

	if (enemies.length === 0) { gameWin = true; return; }

	enemies.forEach((enemy) => {
		if (intersectRect(hero.rectFromGameObject(), enemy.rectFromGameObject())) {
			eventEmitter.emit(Messages.COLLISION_ENEMY_HERO, { enemy });
		}
	});

	lasers.forEach((l) => {
		enemies.forEach((m) => {
			if (intersectRect(l.rectFromGameObject(), m.rectFromGameObject())) {
				eventEmitter.emit(Messages.COLLISION_ENEMY_LASER, { first: l, second: m });
			}
		});
	});

	gameObjects = gameObjects.filter((go) => !go.dead);
	if (hero.dead) gameOver = true;
}

function drawGameObjects(ctx) { gameObjects.forEach((go) => go.draw(ctx)); }

function drawLife() {
	for (let i = 0; i < hero.life; i++) {
		ctx.drawImage(lifeImg, canvas.width - 150 + i * 45, canvas.height - 60, 35, 35);
	}
}

function drawPoints() {
	ctx.font = '30px Arial';
	ctx.fillStyle = 'white';
	ctx.textAlign = 'left';
	const padding = 20; // move it right to avoid cutting
	ctx.fillText('Score: ' + hero.points, padding, canvas.height - 60);
}

function drawGameOverScreen() {
	ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
	ctx.fillRect(0, 0, canvas.width, canvas.height);


	// Center "GAME OVER"
	ctx.fillStyle = '#ff4444';
	ctx.font = '48px Arial';
	ctx.textAlign = 'center';
	ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 40);

	// Center "Final Score"
	ctx.fillStyle = 'white';
	ctx.font = '24px Arial';
	ctx.fillText('Final Score: ' + hero.points, canvas.width / 2, canvas.height / 2 + 20);

	ctx.fillText('Press R to Restart', canvas.width / 2, canvas.height / 2 + 60);
}

function drawWinScreen() {
	ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
	ctx.fillRect(0, 0, canvas.width, canvas.height);


	// Center "VICTORY!"
	ctx.fillStyle = '#00ff00';
	ctx.font = '48px Arial';
	ctx.textAlign = 'center';
	ctx.fillText('VICTORY!', canvas.width / 2, canvas.height / 2 - 40);

	// Center "Final Score"
	ctx.fillStyle = 'white';
	ctx.font = '24px Arial';
	ctx.fillText('Final Score: ' + hero.points, canvas.width / 2, canvas.height / 2 + 20);

	ctx.fillText('Press R to Play Again', canvas.width / 2, canvas.height / 2 + 60);
}

function resetGame() {
	gameOver = false;
	gameWin = false;
	gameObjects = [];
	createEnemies();
	createHero();
}

function initGame() {
	resetGame();

	eventEmitter.on(Messages.COLLISION_ENEMY_LASER, (_, { first, second }) => {
		first.dead = true;
		second.dead = true;
		hero.incrementPoints();
	});

	eventEmitter.on(Messages.COLLISION_ENEMY_HERO, (_, { enemy }) => {
		enemy.dead = true;
		hero.decrementLife();
	});

	eventEmitter.on(Messages.KEY_EVENT_SPACE, () => {
		if (!gameOver && !gameWin && hero.canFire()) hero.fire();
	});

	eventEmitter.on(Messages.KEY_EVENT_R, () => resetGame());
}

window.onload = async () => {
	canvas = document.getElementById('canvas');
	ctx = canvas.getContext('2d');

	canvas.width = 1000;
	canvas.height = 700;

	heroImg = await loadTexture('assets/player.png');
	enemyImg = await loadTexture('assets/enemyShip.png');
	laserImg = await loadTexture('assets/laserRed.png');
	lifeImg = await loadTexture('assets/life.png');

	initGame();

	function gameLoop() {
		handleInput();
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = 'black';
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		if (gameOver) drawGameOverScreen();
		else if (gameWin) drawWinScreen();
		else {
	updateGameObjects();
	drawGameObjects(ctx);
	drawPoints();  // <-- corner score
	drawLife();
}	

		requestAnimationFrame(gameLoop);
	}

	gameLoop();
};