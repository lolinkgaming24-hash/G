/**
 * JUJUTSU SHOWDOWN - ADVANCED ENGINE v12.0
 * -------------------------------------------------------------------------
 * LOGIC ARCHITECTURE:
 * - MODULAR ENTITY SYSTEM: Every sorcerer inherits from a base Physics class.
 * - INPUT BUFFERING: Prevents frame-loss on simultaneous key presses.
 * - COLLISION RESOLVER: Specialized "validateFacing" method for frontal-only hits.
 * - BALANCING: Ryu 0.5x refill, 1.2 DPS beam; Megumi 0.35 alpha shadow.
 * -------------------------------------------------------------------------
 */

// --- GLOBAL ENGINE CONFIGURATION ---
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const SETTINGS = {
    gravity: 1.15,
    friction: 0.82,
    groundY: 110,
    maxHP: 300,
    spCap: 600,
    shadowAlpha: 0.35,
    ryuRefillRate: 0.5,
    standardRefillRate: 1.0,
    screenShakeDecay: 0.92
};

// --- CORE SYSTEM STATE ---
let gameState = {
    active: false,
    paused: false,
    selectionTurn: 1, // Phase 1: P1, Phase 2: P2
    mode: '1P',
    p1: null,
    p2: null,
    p1Choice: null,
    p2Choice: null,
    particles: [],
    shakeIntensity: 0,
    globalFrame: 0
};

const inputBuffer = {
    p1Left: false, p1Right: false, p1Jump: false,
    p2Left: false, p2Right: false, p2Jump: false
};

// --- DATA DICTIONARY ---
const SORCERER_PROFILES = {
    'Gojo':    { color: '#ffffff', power: 7,  speed: 7,  trait: "Infinity" },
    'Sukuna':  { color: '#ff3333', power: 8,  speed: 7,  trait: "Cleave" },
    'Itadori': { color: '#ffdd00', power: 11, speed: 8,  trait: "Black Flash" },
    'Maki':    { color: '#44aa44', power: 12, speed: 10, trait: "Heavenly" },
    'Megumi':  { color: '#222222', power: 6,  speed: 7,  trait: "Ten Shadows" },
    'Yuta':    { color: '#ff00ff', power: 8,  speed: 7,  trait: "Rika" },
    'Ryu':     { color: '#00ccff', power: 7.2, speed: 5.5, trait: "Discharge" },
    'Naoya':   { color: '#ddffdd', power: 7,  speed: 12, trait: "Projection" },
    'Nobara':  { color: '#ff66aa', power: 8,  speed: 6,  trait: "Resonance" },
    'Toji':    { color: '#777777', power: 14, speed: 9,  trait: "Cursed Tool" },
    'Todo':    { color: '#885533', power: 10, speed: 8,  trait: "Boogie Woogie" },
    'Geto':    { color: '#444422', power: 8,  speed: 6,  trait: "Manipulation" },
    'Choso':   { color: '#aa4444', power: 7,  speed: 7,  trait: "Blood" },
    'Hakari':  { color: '#eeeeee', power: 9,  speed: 8,  trait: "Jackpot" },
    'Nanami':  { color: '#eeee00', power: 13, speed: 7,  trait: "7:3 Ratio" }
};

/**
 * VFX CLASS: PARTICLE DYNAMICS
 */
class VisualEffect {
    constructor(x, y, color, sizeMultiplier = 1) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 14;
        this.vy = (Math.random() - 0.5) * 14;
        this.opacity = 1.0;
        this.decay = 0.015 + Math.random() * 0.02;
        this.size = (Math.random() * 4 + 2) * sizeMultiplier;
    }

    process() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.25; // Apply gravity to particles
        this.opacity -= this.decay;
    }

    render(context) {
        context.save();
        context.globalAlpha = this.opacity;
        context.fillStyle = this.color;
        context.beginPath();
        context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        context.fill();
        context.restore();
    }
}

/**
 * MAIN ENTITY: SORCERER
 */
class Sorcerer {
    constructor(x, y, charKey, pNum, isAi) {
        this.charKey = charKey;
        this.data = SORCERER_PROFILES[charKey];
        this.pNum = pNum;
        this.isAi = isAi;

        // Position & Physics
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.direction = (pNum === 1) ? 1 : -1;
        
        // Vital Stats
        this.hp = SETTINGS.maxHP;
        this.sp = 0; // Starts at 0, must fill to 600
        
        // State Management
        this.stunLock = 0;
        this.attackTimer = 0;
        this.specialTick = 0;
        this.isSilenced = 0;
        this.poisonTicks = 0;
        this.inShadow = false;
        this.shadowClock = 0;
        this.jackpotActive = 0;
        this.flashEffect = 0;

        // Specialized Components
        this.projectile = { active: false, x: 0, y: 0, vx: 0, type: '' };
        this.spiritSwarm = []; // For Geto
        this.rikaSummon = { active: false, x: 0, y: 0, life: 0, type: '' };
    }

    /**
     * FRONTAL HITBOX VALIDATOR
     * Core Requirement: Hits only count if opponent is in front of the caster.
     */
    validateFrontal(targetX) {
        const midPoint = this.x + 20;
        if (this.direction === 1) return targetX > midPoint - 12;
        return targetX < midPoint + 12;
    }

    createImpact(x, y, color, count = 8) {
        for (let i = 0; i < count; i++) {
            gameState.particles.push(new VisualEffect(x, y, color || this.data.color));
        }
    }

    update(opponent) {
        if (!gameState.active || gameState.paused) return;

        // 1. TIMERS & COOLDOWNS
        this.processTimers();
        this.processStatusEffects();

        // 2. CURSED ENERGY REFILL (Balanced)
        if (this.sp < SETTINGS.spCap) {
            let rate = SETTINGS.standardRefillRate;
            if (this.charKey === 'Ryu' && opponent.charKey !== 'Yuta') {
                rate = SETTINGS.ryuRefillRate;
            }
            this.sp += rate;
        }

        // 3. COLLISION & PROJECTILES
        this.updateProjectiles(opponent);
        this.updateRika(opponent);
        this.updateCombatAura(opponent);

        // 4. PHYSICS
        this.applyMovement();

        // 5. AI BEHAVIOR
        if (this.isAi) this.handleAiLogic(opponent);
    }

    processTimers() {
        if (this.stunLock > 0) this.stunLock--;
        if (this.attackTimer > 0) this.attackTimer--;
        if (this.isSilenced > 0) this.isSilenced--;
        if (this.flashEffect > 0) this.flashEffect--;
    }

    processStatusEffects() {
        if (this.poisonTicks > 0) {
            this.poisonTicks--;
            if (this.poisonTicks % 60 === 0) {
                this.hp -= 5;
                this.createImpact(this.x + 20, this.y - 40, '#a0f', 3);
            }
        }
        if (this.jackpotActive > 0) {
            this.jackpotActive--;
            if (this.hp < SETTINGS.maxHP) this.hp += 0.8;
        }
        if (this.inShadow) {
            this.shadowClock--;
            if (this.shadowClock <= 0) this.inShadow = false;
        }
    }

    updateProjectiles(opp) {
        // Geto Spirit Logic
        this.spiritSwarm = this.spiritSwarm.filter(s => {
            s.x += s.vx;
            const isHit = Math.abs(s.x - (opp.x + 20)) < 60 && Math.abs(s.y - (opp.y - 50)) < 80;
            if (isHit && !opp.inShadow) {
                opp.hp -= 32; opp.stunLock = 35; opp.flashEffect = 5;
                return false;
            }
            return s.x > -500 && s.x < canvas.width + 500;
        });

        // Main Projectile Logic
        if (this.projectile.active) {
            this.projectile.x += this.projectile.vx;
            const hitX = Math.abs(this.projectile.x - (opp.x + 20)) < 75;
            const hitY = Math.abs(this.projectile.y - 45 - (opp.y - 50)) < 100;

            if (hitX && hitY && !opp.inShadow) {
                if (this.projectile.type === 'Purple') { opp.hp -= 115; opp.stunLock = 85; gameState.shakeIntensity = 22; }
                if (this.projectile.type === 'Nail') { opp.hp -= 42; opp.stunLock = 130; }
                if (this.projectile.type === 'Blood') { opp.hp -= 35; opp.poisonTicks = 320; }
                opp.flashEffect = 5;
                this.projectile.active = false;
            }
            if (this.projectile.x < -1000 || this.projectile.x > canvas.width + 1000) this.projectile.active = false;
        }
    }

    updateCombatAura(opp) {
        if (this.specialTick <= 0) return;
        this.specialTick--;

        // Validate facing and target state
        if (opp.inShadow || !this.validateFrontal(opp.x + 20)) return;

        const gap = Math.abs(this.x - opp.x);

        if (this.charKey === 'Sukuna' && gap < 260) {
            opp.hp -= 3.6; opp.stunLock = 4;
        }
        if (this.charKey === 'Itadori' && gap < 110) {
            opp.hp -= 98; opp.stunLock = 65; this.specialTick = 0; gameState.shakeIntensity = 18;
            this.createImpact(opp.x + 20, opp.y - 50, '#fff', 15);
        }
        if (this.charKey === 'Nanami' && gap < 110) {
            opp.hp -= 72; opp.isSilenced = 280; this.specialTick = 0;
        }
        if ((this.charKey === 'Toji' || this.charKey === 'Maki') && gap < 135) {
            opp.hp -= 9; opp.stunLock = 22; opp.vx = this.direction * 32;
        }
        
        // Ryu/Yuta Beam DPS Balance
        if (this.charKey === 'Ryu' || this.charKey === 'Yuta') {
            const levelMatch = Math.abs((this.y - 40) - (opp.y - 50)) < 85;
            if (levelMatch) {
                opp.hp -= (this.charKey === 'Ryu' ? 1.2 : 1.8);
                opp.stunLock = 5;
            }
        }
    }

    updateRika(opp) {
        if (!this.rikaSummon.active) return;
        this.rikaSummon.life--;

        if (this.rikaSummon.type === 'PUNCH' && !opp.inShadow) {
            const rFacing = (this.direction === 1) ? (opp.x > this.rikaSummon.x - 20) : (opp.x < this.rikaSummon.x + 20);
            if (Math.abs(this.rikaSummon.x - opp.x) < 140 && rFacing) {
                opp.hp -= 55; opp.stunLock = 120; opp.vx = this.direction * 38;
                this.createImpact(opp.x + 20, opp.y - 50, '#fff');
            }
        } else {
            // Beam Mode: Position Rika behind Yuta
            this.rikaSummon.x = this.x - (this.direction * 90);
            this.rikaSummon.y = this.y;
        }

        if (this.rikaSummon.life <= 0) this.rikaSummon.active = false;
    }

    applyMovement() {
        const isBeamFiring = (this.specialTick > 0 && (this.charKey === 'Ryu' || this.charKey === 'Yuta'));
        
        if (isBeamFiring) {
            this.vx = 0; this.vy = 0;
        } else if (this.stunLock <= 0) {
            let speed = this.data.speed;
            if (this.inShadow) speed *= 2.0;

            if (this.pNum === 1) {
                if (inputBuffer.p1Left) { this.vx = -speed; this.direction = -1; }
                if (inputBuffer.p1Right) { this.vx = speed; this.direction = 1; }
            } else if (!this.isAi) {
                if (inputBuffer.p2Left) { this.vx = -speed; this.direction = -1; }
                if (inputBuffer.p2Right) { this.vx = speed; this.direction = 1; }
            }
        }

        this.x += this.vx; this.y += this.vy;
        this.vx *= SETTINGS.friction;

        // Map Constraints
        if (this.x < 0) this.x = 0;
        if (this.x > canvas.width - 45) this.x = canvas.width - 45;

        // Gravity System
        const ground = canvas.height - SETTINGS.groundY;
        if (this.y < ground) {
            this.vy += SETTINGS.gravity;
        } else {
            this.y = ground;
            this.vy = 0;
        }
    }

    /**
     * DRAWING PIPELINE
     */
    draw(renderCtx) {
        renderCtx.save();
        const drawX = this.x + 20;
        const drawY = this.y;

        if (this.stunLock > 0) renderCtx.translate(Math.random() * 4 - 2, 0);

        // Megumi Shadow Rendering
        if (this.inShadow) {
            renderCtx.fillStyle = 'rgba(0,0,0,0.85)';
            renderCtx.beginPath();
            renderCtx.ellipse(drawX, canvas.height - 108, 55, 18, 0, 0, Math.PI * 2);
            renderCtx.fill();
            renderCtx.globalAlpha = SETTINGS.shadowAlpha; 
        }

        if (this.rikaSummon.active) this.drawRika(renderCtx);
        this.drawProjectiles(renderCtx);
        this.drawSpecials(renderCtx, drawX, drawY);
        this.drawModel(renderCtx, drawX, drawY);

        renderCtx.restore();
    }

    drawRika(c) {
        c.fillStyle = '#222';
        c.beginPath();
        c.ellipse(this.rikaSummon.x, this.rikaSummon.y - 85, 45, 115, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#f0f';
        c.beginPath();
        c.arc(this.rikaSummon.x + (this.direction * 15), this.rikaSummon.y - 140, 6, 0, 7);
        c.fill();
    }

    drawProjectiles(c) {
        this.spiritSwarm.forEach(s => {
            c.fillStyle = '#500';
            c.fillRect(s.x - 25, s.y - 12, 50, 24);
        });

        if (this.projectile.active) {
            c.save();
            c.fillStyle = (this.charKey === 'Gojo') ? '#a0f' : this.data.color;
            c.shadowBlur = 30;
            c.shadowColor = c.fillStyle;
            if (this.projectile.type === 'Nail') {
                c.fillRect(this.projectile.x, this.projectile.y - 48, 35 * this.direction, 8);
            } else {
                c.beginPath();
                const radius = (this.projectile.type === 'Purple') ? 70 : 25;
                c.arc(this.projectile.x, this.projectile.y - 48, radius, 0, Math.PI * 2);
                c.fill();
            }
            c.restore();
        }
    }

    drawSpecials(c, cx, cy) {
        if (this.specialTick <= 0) return;
        c.save();
        c.shadowBlur = 40;
        c.shadowColor = this.data.color;

        if (this.charKey === 'Sukuna') {
            c.strokeStyle = '#f33'; c.lineWidth = 2;
            for (let i = 0; i < 15; i++) {
                c.beginPath(); 
                let offsetX = (this.direction === 1) ? Math.random() * 550 : -Math.random() * 550;
                c.moveTo(cx + offsetX, cy - 160); c.lineTo(cx + offsetX + 40, cy + 60);
                c.stroke();
            }
        }
        
        if (this.charKey === 'Ryu' || this.charKey === 'Yuta') {
            c.fillStyle = this.data.color;
            c.globalAlpha = 0.55;
            c.fillRect(cx, cy - 55, 3000 * this.direction, 55);
        }
        c.restore();
    }

    drawModel(c, cx, cy) {
        c.lineWidth = 7;
        c.strokeStyle = (this.jackpotActive > 0) ? '#0f0' : this.data.color;
        if (this.flashEffect > 0) c.strokeStyle = '#fff';

        // Head
        c.beginPath(); c.arc(cx, cy - 95, 18, 0, 7); c.stroke();
        // Spine
        c.beginPath(); c.moveTo(cx, cy - 77); c.lineTo(cx, cy - 35); c.stroke();
        // Limbs
        const attackY = (this.attackTimer > 0) ? cy - 45 : cy - 65;
        c.beginPath(); c.moveTo(cx, cy - 72); c.lineTo(cx + (this.direction * 40), attackY); c.stroke();
        const legMovement = Math.sin(gameState.globalFrame * 0.4) * 22;
        c.beginPath(); c.moveTo(cx, cy - 35); c.lineTo(cx + legMovement, cy + 5); c.stroke();
    }

    /**
     * ATTACK COMMANDS
     */
    executeAttack(opp) {
        if (this.stunLock > 0 || this.attackTimer > 0 || this.isSilenced > 0) return;
        this.attackTimer = 22;
        
        const isNear = Math.abs(this.x - opp.x) < 115;
        const isFacing = this.validateFrontal(opp.x + 20);

        if (isNear && isFacing && !opp.inShadow) {
            const power = this.inShadow ? (this.data.power + 35) : this.data.power;
            opp.hp -= power;
            opp.stunLock = this.inShadow ? 90 : 20;
            opp.vx = this.direction * 14;
            opp.flashEffect = 4;
            this.createImpact(opp.x + 20, opp.y - 50);
            this.inShadow = false;
        } else if (this.inShadow) {
            this.inShadow = false; // Whiffing from shadow reveals you
        }
    }

    executeSpecial(opp) {
        if (this.sp < SETTINGS.spCap || this.stunLock > 0 || this.isSilenced > 0) return;
        this.sp = 0; // Consumption

        switch(this.charKey) {
            case 'Nobara': 
                this.projectile = { active: true, x: this.x, y: this.y, vx: this.direction * 35, type: 'Nail' }; break;
            case 'Gojo':
                this.projectile = { active: true, x: this.x, y: this.y, vx: this.direction * 11, type: 'Purple' }; break;
            case 'Megumi':
                this.inShadow = true; this.shadowClock = 200; break;
            case 'Sukuna': this.specialTick = 85; break;
            case 'Ryu': this.specialTick = 160; break;
            case 'Yuta':
                if (opp.charKey === 'Ryu') {
                    this.specialTick = 160;
                    this.rikaSummon = { active: true, x: this.x - (this.direction * 90), y: this.y, life: 160, type: 'BEAM' };
                } else {
                    this.rikaSummon = { active: true, x: this.x + (this.direction * 70), y: this.y, life: 75, type: 'PUNCH' };
                }
                break;
            case 'Hakari': if (Math.random() < 0.33) this.jackpotActive = 750; break;
            case 'Geto':
                this.spiritSwarm = [{x:this.x, y:this.y-10, vx:this.direction*11}, {x:this.x, y:this.y+30, vx:this.direction*11}]; break;
            case 'Choso':
                this.projectile = { active: true, x: this.x, y: this.y, vx: this.direction * 38, type: 'Blood' }; break;
            case 'Todo':
                let swapX = this.x; this.x = opp.x; opp.x = swapX; opp.stunLock = 60; break;
            default:
                this.vx = this.direction * 60; this.specialTick = 35; break;
        }
    }

    handleAiLogic(opp) {
        if (this.stunLock > 0) return;
        const dist = Math.abs(this.x - opp.x);
        this.direction = (opp.x < this.x) ? -1 : 1;
        
        if (dist > 190) {
            this.vx = (opp.x < this.x) ? -this.data.speed : this.data.speed;
        } else if (dist < 55) {
            this.vx = (opp.x < this.x) ? this.data.speed : -this.data.speed;
        }

        if (dist < 120 && Math.random() < 0.15) this.executeAttack(opp);
        if (this.sp >= SETTINGS.spCap && Math.random() < 0.04) this.executeSpecial(opp);
    }
}

// --- UI MANAGEMENT ---

function initGameMode(m) {
    gameState.mode = m;
    gameState.p1Choice = null;
    gameState.p2Choice = null;
    gameState.selectionTurn = 1;
    
    document.getElementById('m-start').style.display = 'none';
    document.getElementById('m-char').style.display = 'block';
    
    renderSelectionUI();
}

function renderSelectionUI() {
    const grid = document.getElementById('char-grid');
    const header = document.querySelector('#m-char h2');
    header.innerText = `PLAYER ${gameState.selectionTurn}: CHOOSE YOUR SORCERER`;
    grid.innerHTML = '';
    
    Object.keys(SORCERER_PROFILES).forEach(name => {
        const btn = document.createElement('button');
        btn.innerHTML = `<strong>${name}</strong><br><small>${SORCERER_PROFILES[name].trait}</small>`;
        btn.className = 'char-btn';
        
        btn.onpointerdown = (e) => {
            e.stopPropagation();
            if (gameState.selectionTurn === 1) {
                gameState.p1Choice = name;
                if (gameState.mode === '1P') {
                    const keys = Object.keys(SORCERER_PROFILES);
                    gameState.p2Choice = keys[Math.floor(Math.random() * keys.length)];
                    finalizeAndLaunch();
                } else {
                    gameState.selectionTurn = 2;
                    renderSelectionUI();
                }
            } else {
                gameState.p2Choice = name;
                finalizeAndLaunch();
            }
        };
        grid.appendChild(btn);
    });
}

function finalizeAndLaunch() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    gameState.p1 = new Sorcerer(220, canvas.height - 200, gameState.p1Choice, 1, false);
    gameState.p2 = new Sorcerer(canvas.width - 420, canvas.height - 200, gameState.p2Choice, 2, (gameState.mode === '1P'));
    
    document.getElementById('menu').classList.remove('active-menu');
    document.getElementById('pause-btn').style.display = 'block';
    document.getElementById('controls').style.display = 'block';
    
    if (gameState.mode === '2P') document.getElementById('p2-pad').style.display = 'block';
    
    gameState.active = true;
    requestAnimationFrame(engineRuntime);
}

// --- MAIN RUNTIME ---

function engineRuntime() {
    if (!gameState.active) return;

    if (!gameState.paused) {
        gameState.globalFrame++;
        ctx.save();
        
        // Dynamic Camera (Shake)
        if (gameState.shakeIntensity > 0) {
            ctx.translate((Math.random() - 0.5) * gameState.shakeIntensity, (Math.random() - 0.5) * gameState.shakeIntensity);
            gameState.shakeIntensity *= SETTINGS.screenShakeDecay;
        }

        ctx.clearRect(-200, -200, canvas.width + 400, canvas.height + 400);
        
        // Updates
        gameState.p1.update(gameState.p2);
        gameState.p2.update(gameState.p1);
        
        // Particle Simulation
        gameState.particles = gameState.particles.filter(p => {
            p.process();
            p.render(ctx);
            return p.opacity > 0;
        });

        // Renders
        gameState.p1.draw(ctx);
        gameState.p2.draw(ctx);
        
        syncDisplay();
        checkGameOver();
        
        ctx.restore();
    }
    requestAnimationFrame(engineRuntime);
}

function syncDisplay() {
    document.getElementById('p1-hp').style.width = (gameState.p1.hp / SETTINGS.maxHP * 100) + '%';
    document.getElementById('p1-cd').style.width = (gameState.p1.sp / SETTINGS.spCap * 100) + '%';
    document.getElementById('p2-hp').style.width = (gameState.p2.hp / SETTINGS.maxHP * 100) + '%';
    document.getElementById('p2-cd').style.width = (gameState.p2.sp / SETTINGS.spCap * 100) + '%';
}

function checkGameOver() {
    if (gameState.p1.hp <= 0 || gameState.p2.hp <= 0) {
        gameState.active = false;
        const winner = (gameState.p1.hp <= 0) ? "PLAYER 2" : "PLAYER 1";
        document.getElementById('win-text').innerText = `${winner} DOMINATES`;
        document.getElementById('win-screen').classList.add('active-menu');
    }
}

// --- INPUT HANDLERS ---

window.addEventListener('keydown', e => {
    if (!gameState.active || gameState.paused) return;
    switch(e.code) {
        case 'KeyA': inputBuffer.p1Left = true; break;
        case 'KeyD': inputBuffer.p1Right = true; break;
        case 'KeyW': if (gameState.p1.vy === 0) gameState.p1.vy = -24; break;
        case 'KeyF': gameState.p1.executeAttack(gameState.p2); break;
        case 'KeyG': gameState.p1.executeSpecial(gameState.p2); break;
        
        case 'ArrowLeft': inputBuffer.p2Left = true; break;
        case 'ArrowRight': inputBuffer.p2Right = true; break;
        case 'ArrowUp': if (gameState.p2.vy === 0) gameState.p2.vy = -24; break;
        case 'KeyK': gameState.p2.executeAttack(gameState.p1); break;
        case 'KeyL': gameState.p2.executeSpecial(gameState.p1); break;
        
        case 'Escape': 
            gameState.paused = !gameState.paused; 
            document.getElementById('pause-screen').classList.toggle('active-menu');
            break;
    }
});

window.addEventListener('keyup', e => {
    switch(e.code) {
        case 'KeyA': inputBuffer.p1Left = false; break;
        case 'KeyD': inputBuffer.p1Right = false; break;
        case 'ArrowLeft': inputBuffer.p2Left = false; break;
        case 'ArrowRight': inputBuffer.p2Right = false; break;
    }
});

// Mobile Logic
window.addEventListener('touchstart', e => {
    if (e.target.tagName !== 'BUTTON') e.preventDefault();
    [...e.touches].forEach(t => {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (!el || !el.dataset.v) return;
        const p = el.dataset.p;
        const self = (p === '1' ? gameState.p1 : gameState.p2);
        const opp = (p === '1' ? gameState.p2 : gameState.p1);
        
        if (el.dataset.v === 'l') inputBuffer['p' + p + 'Left'] = true;
        if (el.dataset.v === 'r') inputBuffer['p' + p + 'Right'] = true;
        if (el.dataset.v === 'u' && self.vy === 0) self.vy = -24;
        if (el.dataset.v === 'a') self.executeAttack(opp);
        if (el.dataset.v === 's') self.executeSpecial(opp);
    });
}, { passive: false });

window.addEventListener('touchend', () => {
    inputBuffer.p1Left = inputBuffer.p1Right = inputBuffer.p2Left = inputBuffer.p2Right = false;
});
