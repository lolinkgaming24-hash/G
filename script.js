/**
 * JUJUTSU SHOWDOWN: ADVANCED SORCERY ENGINE v14.0
 * -------------------------------------------------------------------------
 * This engine uses a strictly modular architecture to ensure maximum 
 * stability and frame-perfect hit detection.
 * -------------------------------------------------------------------------
 */

// --- 1. CORE ENGINE CONSTANTS ---
const CONFIG = {
    SCREEN_WIDTH: window.innerWidth,
    SCREEN_HEIGHT: window.innerHeight,
    GRAVITY: 1.15,
    FRICTION: 0.82,
    GROUND_Y_OFFSET: 110,
    MAX_HP: 300,
    MAX_SP: 600,
    SHAKE_DECAY: 0.92,
    DEFAULT_SPEED: 7,
    JUMP_FORCE: -24,
    MELEE_RANGE: 110,
    BEAM_RANGE: 2500
};

const CHAR_PROFILES = {
    'Gojo':    { color: '#ffffff', power: 7,   speed: 7.0,  trait: "Infinity" },
    'Sukuna':  { color: '#ff3333', power: 8,   speed: 7.5,  trait: "Cleave" },
    'Itadori': { color: '#ffdd00', power: 11,  speed: 8.5,  trait: "Black Flash" },
    'Maki':    { color: '#44aa44', power: 13,  speed: 10.0, trait: "Heavenly" },
    'Megumi':  { color: '#222222', power: 6,   speed: 7.0,  trait: "Ten Shadows" },
    'Yuta':    { color: '#ff00ff', power: 8,   speed: 7.0,  trait: "Rika Summon" },
    'Ryu':     { color: '#00ccff', power: 7.2, speed: 5.5,  trait: "Granite Blast" },
    'Naoya':   { color: '#ddffdd', power: 7,   speed: 13.0, trait: "Projection" },
    'Nobara':  { color: '#ff66aa', power: 8,   speed: 6.5,  trait: "Resonance" },
    'Toji':    { color: '#777777', power: 15,  speed: 9.5,  trait: "Inverted Spear" },
    'Todo':    { color: '#885533', power: 10,  speed: 8.0,  trait: "Boogie Woogie" },
    'Geto':    { color: '#444422', power: 8,   speed: 6.0,  trait: "Manipulation" },
    'Choso':   { color: '#aa4444', power: 7,   speed: 7.5,  trait: "Supernova" },
    'Hakari':  { color: '#eeeeee', power: 9,   speed: 8.0,  trait: "Jackpot" },
    'Nanami':  { color: '#eeee00', power: 13,  speed: 7.0,  trait: "7:3 Ratio" }
};

// --- 2. GLOBAL SYSTEM STATE ---
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let gameState = {
    active: false,
    paused: false,
    selectionTurn: 1,
    gameMode: '1P',
    p1: null,
    p2: null,
    p1Choice: null,
    p2Choice: null,
    particles: [],
    shakeIntensity: 0,
    globalFrame: 0
};

const inputBuffer = {
    p1L: false, p1R: false,
    p2L: false, p2R: false
};

// --- 3. CLASS: VISUAL EFFECTS ---
class ParticleEffect {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 15;
        this.vy = (Math.random() - 0.5) * 15;
        this.alpha = 1.0;
        this.decay = 0.01 + Math.random() * 0.03;
        this.color = color;
        this.size = Math.random() * 5 + 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.3; // Gravity on particles
        this.alpha -= this.decay;
    }

    draw(renderContext) {
        renderContext.save();
        renderContext.globalAlpha = this.alpha;
        renderContext.fillStyle = this.color;
        renderContext.beginPath();
        renderContext.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        renderContext.fill();
        renderContext.restore();
    }
}

// --- 4. CLASS: SORCERER ENTITY (THE CORE) ---
class Sorcerer {
    constructor(x, y, charKey, pNum, isAi) {
        // Identity
        this.charKey = charKey;
        this.config = CHAR_PROFILES[charKey];
        this.pNum = pNum;
        this.isAi = isAi;

        // Transform
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.width = 40;
        this.height = 95;
        this.direction = (pNum === 1) ? 1 : -1;

        // Attributes
        this.hp = CONFIG.MAX_HP;
        this.sp = 0;

        // State Machine Timers
        this.stunTimer = 0;
        this.m1Cooldown = 0;
        this.specialDuration = 0;
        this.silenceTimer = 0;
        this.poisonTimer = 0;
        this.flashTimer = 0;

        // Character Specific States
        this.isShadowStealth = false;
        this.shadowTimeLeft = 0;
        this.isJackpot = false;
        this.jackpotTimeLeft = 0;

        // Object Managers
        this.projectile = { active: false, x: 0, y: 0, vx: 0, type: '', size: 20 };
        this.summon = { active: false, x: 0, y: 0, life: 0, type: '' };
        this.spirits = []; // For Geto/Curse Users
    }

    // MATH: VALIDATE IF OPPONENT IS IN FRONT
    isOpponentInFront(oppX) {
        const centerX = this.x + (this.width / 2);
        if (this.direction === 1) {
            return oppX > centerX - 15;
        } else {
            return oppX < centerX + 15;
        }
    }

    // --- PHYSICS PIPELINE ---
    applyPhysics() {
        if (this.stunTimer > 0) return;

        // Ryu/Yuta Beam Lock: Cannot move while firing massive energy
        const isFiringBeam = (this.specialDuration > 0 && (this.charKey === 'Ryu' || this.charKey === 'Yuta'));
        if (isFiringBeam) {
            this.vx = 0;
            return;
        }

        // Standard Movement
        let currentSpeed = this.config.speed;
        if (this.isShadowStealth) currentSpeed *= 1.8;

        if (this.pNum === 1) {
            if (inputBuffer.p1L) { this.vx = -currentSpeed; this.direction = -1; }
            if (inputBuffer.p1R) { this.vx = currentSpeed; this.direction = 1; }
        } else if (!this.isAi) {
            if (inputBuffer.p2L) { this.vx = -currentSpeed; this.direction = -1; }
            if (inputBuffer.p2R) { this.vx = currentSpeed; this.direction = 1; }
        }

        this.x += this.vx;
        this.y += this.vy;

        // Friction & Gravity
        this.vx *= CONFIG.FRICTION;
        const groundLevel = CONFIG.SCREEN_HEIGHT - CONFIG.GROUND_Y_OFFSET;

        if (this.y < groundLevel) {
            this.vy += CONFIG.GRAVITY;
        } else {
            this.y = groundLevel;
            this.vy = 0;
        }

        // Bound Checks
        if (this.x < 0) this.x = 0;
        if (this.x > CONFIG.SCREEN_WIDTH - this.width) this.x = CONFIG.SCREEN_WIDTH - this.width;
    }

    // --- UPDATE PIPELINE ---
    update(opponent) {
        if (!gameState.active || gameState.paused) return;

        // 1. Core State Processing
        this.processTimers();
        this.processStatusEffects();
        this.applyPhysics();

        // 2. Cursed Energy Refill Logic (Balanced)
        if (this.sp < CONFIG.MAX_SP) {
            let fillRate = 1.0;
            // Ryu penalised for being a high-output glass cannon
            if (this.charKey === 'Ryu' && opponent.charKey !== 'Yuta') {
                fillRate = 0.5;
            }
            this.sp += fillRate;
        }

        // 3. Combat Logic
        this.updateProjectiles(opponent);
        this.updateSpecialAuras(opponent);
        
        // 4. AI Logic (If applicable)
        if (this.isAi) this.handleAiBehavior(opponent);
    }

    processTimers() {
        if (this.stunTimer > 0) this.stunTimer--;
        if (this.m1Cooldown > 0) this.m1Cooldown--;
        if (this.silenceTimer > 0) this.silenceTimer--;
        if (this.flashTimer > 0) this.flashTimer--;
    }

    processStatusEffects() {
        // Poison Logic
        if (this.poisonTimer > 0) {
            this.poisonTimer--;
            if (this.poisonTimer % 60 === 0) {
                this.hp -= 6;
                this.spawnImpact(this.x + 20, this.y - 40, '#a0f');
            }
        }
        // Hakari Jackpot Logic
        if (this.isJackpot) {
            this.jackpotTimeLeft--;
            if (this.hp < CONFIG.MAX_HP) this.hp += 0.85; // Massive Regen
            if (this.jackpotTimeLeft <= 0) this.isJackpot = false;
        }
        // Megumi Stealth Logic
        if (this.isShadowStealth) {
            this.shadowTimeLeft--;
            if (this.shadowTimeLeft <= 0) this.isShadowStealth = false;
        }
    }

    updateProjectiles(opp) {
        // Geto's Spirits
        this.spirits = this.spirits.filter(s => {
            s.x += s.vx;
            const dist = Math.sqrt(Math.pow(s.x - (opp.x + 20), 2) + Math.pow(s.y - (opp.y - 40), 2));
            if (dist < 50 && !opp.isShadowStealth) {
                opp.hp -= 35;
                opp.stunTimer = 40;
                opp.flashTimer = 5;
                return false;
            }
            return s.x > -500 && s.x < CONFIG.SCREEN_WIDTH + 500;
        });

        // Main Projectiles
        if (this.projectile.active) {
            this.projectile.x += this.projectile.vx;
            const hitX = Math.abs(this.projectile.x - (opp.x + 20)) < 70;
            const hitY = Math.abs(this.projectile.y - (opp.y - 45)) < 100;

            if (hitX && hitY && !opp.isShadowStealth) {
                this.handleProjectileHit(opp);
                this.projectile.active = false;
            }
            // Screen Bounds Check
            if (this.projectile.x < -1000 || this.projectile.x > CONFIG.SCREEN_WIDTH + 1000) {
                this.projectile.active = false;
            }
        }
    }

    handleProjectileHit(opp) {
        opp.flashTimer = 5;
        switch(this.projectile.type) {
            case 'Purple':
                opp.hp -= 118;
                opp.stunTimer = 85;
                gameState.shakeIntensity = 22;
                break;
            case 'Blood':
                opp.hp -= 38;
                opp.poisonTimer = 350;
                break;
            case 'Nail':
                opp.hp -= 42;
                opp.stunTimer = 110;
                break;
        }
    }

    updateSpecialAuras(opp) {
        if (this.specialDuration <= 0) return;
        this.specialDuration--;

        // If opponent is hiding in shadows or behind, they are safe
        if (opp.isShadowStealth || !this.isOpponentInFront(opp.x + 20)) return;

        const gap = Math.abs(this.x - opp.x);

        // Sukuna: Cleave/Dismantle Aura
        if (this.charKey === 'Sukuna' && gap < 280) {
            opp.hp -= 3.8;
            opp.stunTimer = 5;
        }
        // Itadori: Black Flash Strike
        if (this.charKey === 'Itadori' && gap < 110) {
            opp.hp -= 105;
            opp.stunTimer = 75;
            this.specialDuration = 0;
            gameState.shakeIntensity = 20;
            this.spawnImpact(opp.x + 20, opp.y - 50, '#fff', 15);
        }
        // Ryu/Yuta Beam DPS
        if (this.charKey === 'Ryu' || this.charKey === 'Yuta') {
            const isLevel = Math.abs((this.y - 45) - (opp.y - 50)) < 90;
            if (isLevel) {
                opp.hp -= (this.charKey === 'Ryu' ? 1.3 : 1.9);
                opp.stunTimer = 6;
            }
        }
    }

    // --- RENDERING PIPELINE ---
    draw(renderContext) {
        renderContext.save();
        const drawX = this.x + 20;
        const drawY = this.y;

        // Screen Shake / Stun Vibration
        if (this.stunTimer > 0) {
            renderContext.translate(Math.random() * 4 - 2, 0);
        }

        // Shadows Trait (Megumi)
        if (this.isShadowStealth) {
            renderContext.fillStyle = 'rgba(0,0,0,0.85)';
            renderContext.beginPath();
            renderContext.ellipse(drawX, CONFIG.SCREEN_HEIGHT - 108, 55, 18, 0, 0, Math.PI * 2);
            renderContext.fill();
            renderContext.globalAlpha = 0.35; // The requested shadow transparency
        }

        this.drawVisuals(renderContext, drawX, drawY);
        this.drawStickman(renderContext, drawX, drawY);

        renderContext.restore();
    }

    drawVisuals(c, cx, cy) {
        // Beam Rendering
        if (this.specialDuration > 0 && (this.charKey === 'Ryu' || this.charKey === 'Yuta')) {
            c.save();
            c.fillStyle = this.config.color;
            c.shadowBlur = 40;
            c.shadowColor = this.config.color;
            c.globalAlpha = 0.6;
            c.fillRect(cx, cy - 65, CONFIG.BEAM_RANGE * this.direction, 55);
            c.restore();
        }

        // Projectile Rendering
        if (this.projectile.active) {
            c.save();
            c.fillStyle = this.projectile.type === 'Purple' ? '#a0f' : this.config.color;
            c.shadowBlur = 30;
            c.shadowColor = c.fillStyle;
            c.beginPath();
            const r = this.projectile.type === 'Purple' ? 70 : 25;
            c.arc(this.projectile.x, this.projectile.y - 45, r, 0, Math.PI * 2);
            c.fill();
            c.restore();
        }

        // Geto Spirits
        this.spirits.forEach(s => {
            c.fillStyle = '#500';
            c.fillRect(s.x - 20, s.y - 10, 40, 20);
        });
    }

    drawStickman(c, cx, cy) {
        c.lineWidth = 7;
        c.strokeStyle = this.isJackpot ? '#0f0' : this.config.color;
        if (this.flashTimer > 0) c.strokeStyle = '#fff';

        // Head
        c.beginPath(); c.arc(cx, cy - 95, 18, 0, 7); c.stroke();
        // Body Spine
        c.beginPath(); c.moveTo(cx, cy - 77); c.lineTo(cx, cy - 35); c.stroke();
        // Arms (Reacts to attack)
        const armEnd = this.m1Cooldown > 0 ? cy - 45 : cy - 65;
        c.beginPath(); c.moveTo(cx, cy - 70); c.lineTo(cx + (this.direction * 42), armEnd); c.stroke();
        // Legs
        const legWalk = Math.sin(gameState.globalFrame * 0.4) * 20;
        c.beginPath(); c.moveTo(cx, cy - 35); c.lineTo(cx + legWalk, cy + 5); c.stroke();
    }

    // --- COMBAT ACTIONS ---
    performAttack(opp) {
        if (this.stunTimer > 0 || this.m1Cooldown > 0 || this.silenceTimer > 0) return;

        this.m1Cooldown = 22;
        const inRange = Math.abs(this.x - opp.x) < CONFIG.MELEE_RANGE;
        const facing = this.isOpponentInFront(opp.x + 20);

        if (inRange && facing && !opp.isShadowStealth) {
            const finalDmg = this.isShadowStealth ? (this.config.power + 35) : this.config.power;
            opp.hp -= finalDmg;
            opp.stunTimer = this.isShadowStealth ? 90 : 20;
            opp.vx = this.direction * 15;
            opp.flashTimer = 4;
            this.spawnImpact(opp.x + 20, opp.y - 50, this.config.color);
            this.isShadowStealth = false; // Reveal on hit
        } else if (this.isShadowStealth) {
            this.isShadowStealth = false; // Reveal on whiff
        }
    }

    performSpecial(opp) {
        if (this.sp < CONFIG.MAX_SP || this.stunTimer > 0 || this.silenceTimer > 0) return;
        this.sp = 0; // Consume SP

        switch(this.charKey) {
            case 'Gojo':
                this.projectile = { active: true, x: this.x, y: this.y, vx: this.direction * 11, type: 'Purple' };
                break;
            case 'Sukuna':
                this.specialDuration = 90;
                break;
            case 'Megumi':
                this.isShadowStealth = true;
                this.shadowTimeLeft = 200;
                break;
            case 'Ryu':
            case 'Yuta':
                this.specialDuration = 165;
                break;
            case 'Nobara':
                this.projectile = { active: true, x: this.x, y: this.y, vx: this.direction * 35, type: 'Nail' };
                break;
            case 'Choso':
                this.projectile = { active: true, x: this.x, y: this.y, vx: this.direction * 40, type: 'Blood' };
                break;
            case 'Geto':
                this.spirits = [
                    {x: this.x, y: this.y - 20, vx: this.direction * 10},
                    {x: this.x, y: this.y + 20, vx: this.direction * 10}
                ];
                break;
            case 'Todo':
                // Boogie Woogie Swap
                let tempX = this.x;
                this.x = opp.x;
                opp.x = tempX;
                opp.stunTimer = 65;
                break;
            case 'Hakari':
                // Jackpot Gamble
                if (Math.random() < 0.35) {
                    this.isJackpot = true;
                    this.jackpotTimeLeft = 800;
                }
                break;
            case 'Nanami':
                this.specialDuration = 1; // Instant trigger
                if (Math.abs(this.x - opp.x) < 120) {
                    opp.hp -= 75;
                    opp.silenceTimer = 300;
                }
                break;
            default:
                // Generic Dash Special for others
                this.vx = this.direction * 65;
                this.specialDuration = 35;
                break;
        }
    }

    spawnImpact(x, y, color, count = 8) {
        for (let i = 0; i < count; i++) {
            gameState.particles.push(new ParticleEffect(x, y, color));
        }
    }

    handleAiBehavior(opp) {
        if (this.stunTimer > 0) return;
        const dist = Math.abs(this.x - opp.x);
        
        // Aiming
        this.direction = (opp.x < this.x) ? -1 : 1;

        // Simple Decision Tree
        if (dist > 200) {
            this.vx = (opp.x < this.x) ? -this.config.speed : this.config.speed;
        } else if (dist < 60) {
            this.vx = (opp.x < this.x) ? this.config.speed : -this.config.speed;
        }

        if (dist < 120 && Math.random() < 0.12) this.performAttack(opp);
        if (this.sp >= CONFIG.MAX_SP && Math.random() < 0.05) this.performSpecial(opp);
    }
}

// --- 5. UI & MENU MANAGEMENT ---

function initMode(mode) {
    gameState.gameMode = mode;
    gameState.selectionTurn = 1;
    gameState.p1Choice = null;
    gameState.p2Choice = null;

    document.getElementById('m-start').style.display = 'none';
    document.getElementById('m-char').style.display = 'block';
    
    refreshSelectionGrid();
}

function refreshSelectionGrid() {
    const grid = document.getElementById('char-grid');
    const header = document.getElementById('selection-title');
    header.innerText = `PLAYER ${gameState.selectionTurn}: SELECT YOUR SORCERER`;
    
    grid.innerHTML = '';
    Object.keys(CHAR_PROFILES).forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'char-btn';
        btn.innerHTML = `<strong>${name}</strong><br><small>${CHAR_PROFILES[name].trait}</small>`;
        
        btn.onpointerdown = (e) => {
            e.stopPropagation();
            if (gameState.selectionTurn === 1) {
                gameState.p1Choice = name;
                if (gameState.gameMode === '1P') {
                    // Auto-pick for CPU
                    const names = Object.keys(CHAR_PROFILES);
                    gameState.p2Choice = names[Math.floor(Math.random() * names.length)];
                    launchBattle();
                } else {
                    gameState.selectionTurn = 2;
                    refreshSelectionGrid();
                }
            } else {
                gameState.p2Choice = name;
                launchBattle();
            }
        };
        grid.appendChild(btn);
    });
}

function launchBattle() {
    // Canvas Sizing
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Entity Instantiation
    gameState.p1 = new Sorcerer(250, canvas.height - 250, gameState.p1Choice, 1, false);
    gameState.p2 = new Sorcerer(canvas.width - 450, canvas.height - 250, gameState.p2Choice, 2, (gameState.gameMode === '1P'));

    // UI State
    document.getElementById('menu').classList.remove('active-menu');
    document.getElementById('controls').style.display = 'block';
    document.getElementById('pause-btn').style.display = 'block';
    if (gameState.gameMode === '2P') document.getElementById('p2-pad').style.display = 'grid';

    gameState.active = true;
    requestAnimationFrame(mainEngineLoop);
}

function togglePause() {
    gameState.paused = !gameState.paused;
    const pauseMenu = document.getElementById('pause-screen');
    if (gameState.paused) pauseMenu.classList.add('active-menu');
    else pauseMenu.classList.remove('active-menu');
}

// --- 6. MAIN ENGINE RUNTIME ---

function mainEngineLoop() {
    if (!gameState.active) return;

    if (!gameState.paused) {
        gameState.globalFrame++;
        ctx.save();

        // 1. Camera Shake Logic
        if (gameState.shakeIntensity > 0) {
            ctx.translate((Math.random() - 0.5) * gameState.shakeIntensity, (Math.random() - 0.5) * gameState.shakeIntensity);
            gameState.shakeIntensity *= CONFIG.SHAKE_DECAY;
        }

        // 2. Clear Buffer
        ctx.clearRect(-200, -200, canvas.width + 400, canvas.height + 400);

        // 3. Update Entities
        gameState.p1.update(gameState.p2);
        gameState.p2.update(gameState.p1);

        // 4. Update Particles
        gameState.particles = gameState.particles.filter(p => {
            p.update();
            p.draw(ctx);
            return p.alpha > 0;
        });

        // 5. Draw Entities
        gameState.p1.draw(ctx);
        gameState.p2.draw(ctx);

        // 6. UI Synchronization
        updateHud();
        checkWinCondition();

        ctx.restore();
    }
    requestAnimationFrame(mainEngineLoop);
}

function updateHud() {
    document.getElementById('p1-hp').style.width = (gameState.p1.hp / CONFIG.MAX_HP * 100) + '%';
    document.getElementById('p1-cd').style.width = (gameState.p1.sp / CONFIG.MAX_SP * 100) + '%';
    document.getElementById('p2-hp').style.width = (gameState.p2.hp / CONFIG.MAX_HP * 100) + '%';
    document.getElementById('p2-cd').style.width = (gameState.p2.sp / CONFIG.MAX_SP * 100) + '%';
}

function checkWinCondition() {
    if (gameState.p1.hp <= 0 || gameState.p2.hp <= 0) {
        gameState.active = false;
        const winner = (gameState.p1.hp <= 0) ? "PLAYER 2" : "PLAYER 1";
        document.getElementById('win-text').innerText = `${winner} DOMINATES`;
        document.getElementById('win-screen').classList.add('active-menu');
    }
}

// --- 7. INPUT HANDLING ---

window.addEventListener('keydown', e => {
    if (!gameState.active || gameState.paused) return;
    switch(e.code) {
        case 'KeyA': inputBuffer.p1L = true; break;
        case 'KeyD': inputBuffer.p1R = true; break;
        case 'KeyW': if (gameState.p1.vy === 0) gameState.p1.vy = CONFIG.JUMP_FORCE; break;
        case 'KeyF': gameState.p1.performAttack(gameState.p2); break;
        case 'KeyG': gameState.p1.performSpecial(gameState.p2); break;
        
        case 'ArrowLeft': inputBuffer.p2L = true; break;
        case 'ArrowRight': inputBuffer.p2R = true; break;
        case 'ArrowUp': if (gameState.p2.vy === 0) gameState.p2.vy = CONFIG.JUMP_FORCE; break;
        case 'KeyK': gameState.p2.performAttack(gameState.p1); break;
        case 'KeyL': gameState.p2.performSpecial(gameState.p1); break;
        
        case 'Escape': togglePause(); break;
    }
});

window.addEventListener('keyup', e => {
    if (e.code === 'KeyA') inputBuffer.p1L = false;
    if (e.code === 'KeyD') inputBuffer.p1R = false;
    if (e.code === 'ArrowLeft') inputBuffer.p2L = false;
    if (e.code === 'ArrowRight') inputBuffer.p2R = false;
});

// Mobile/Touch Controller Logic
window.addEventListener('touchstart', e => {
    if (e.target.tagName !== 'BUTTON') e.preventDefault();
    [...e.touches].forEach(t => {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (!el || !el.dataset.v) return;
        
        const p = el.dataset.p;
        const self = (p === '1' ? gameState.p1 : gameState.p2);
        const opp = (p === '1' ? gameState.p2 : gameState.p1);
        const val = el.dataset.v;

        if (val === 'l') inputBuffer['p' + p + 'L'] = true;
        if (val === 'r') inputBuffer['p' + p + 'R'] = true;
        if (val === 'u' && self.vy === 0) self.vy = CONFIG.JUMP_FORCE;
        if (val === 'a') self.performAttack(opp);
        if (val === 's') self.performSpecial(opp);
    });
}, { passive: false });

window.addEventListener('touchend', () => {
    inputBuffer.p1L = inputBuffer.p1R = inputBuffer.p2L = inputBuffer.p2R = false;
});
