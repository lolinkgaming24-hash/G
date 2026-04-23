/**
 * JUJUTSU SHOWDOWN - ULTIMATE SORCERY ENGINE v18.0
 * -------------------------------------------------------------------------
 * LINE COUNT OPTIMIZED FOR EXPLICIT LOGIC & CHARACTER UNIQUENESS
 * -------------------------------------------------------------------------
 */

// --- 1. CORE ENGINE CONSTANTS ---
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ENGINE = {
    GRAVITY: 1.15,
    FRICTION: 0.82,
    MAX_HP: 300,
    MAX_SP: 600,
    GROUND_Y: 110,
    SHAKE_DECAY: 0.90,
    UI_REFRESH: 16 // ms
};

// --- 2. GLOBAL STATE ---
let state = {
    active: false,
    paused: false,
    frame: 0,
    shake: 0,
    mode: '1P',
    turn: 1,
    p1Choice: null,
    p2Choice: null,
    p1: null,
    p2: null,
    vfx: []
};

const input = {
    p1L: false, p1R: false,
    p2L: false, p2R: false
};

// --- 3. CHARACTER DATABASE ---
const SORCERERS = {
    'Gojo': {
        color: '#ffffff',
        hp: 300,
        spd: 7.2,
        dmg: 8,
        desc: "Infinity & Hollow Purple",
        specialType: 'PROJECTILE'
    },
    'Sukuna': {
        color: '#ff3333',
        hp: 300,
        spd: 7.5,
        dmg: 9,
        desc: "Cleave & Malevolent Shrine",
        specialType: 'AURA'
    },
    'Itadori': {
        color: '#ffdd00',
        hp: 350,
        spd: 8.5,
        dmg: 12,
        desc: "Divergent Fist",
        specialType: 'DASH'
    },
    'Maki': {
        color: '#44aa44',
        hp: 280,
        spd: 10.5,
        dmg: 14,
        desc: "Physical Giftedness",
        specialType: 'DASH'
    },
    'Megumi': {
        color: '#111111',
        hp: 270,
        spd: 7.0,
        dmg: 6,
        desc: "Ten Shadows",
        specialType: 'STEALTH'
    },
    'Yuta': {
        color: '#ff00ff',
        hp: 300,
        spd: 7.0,
        dmg: 8,
        desc: "Pure Love Beam",
        specialType: 'BEAM'
    },
    'Ryu': {
        color: '#00ccff',
        hp: 320,
        spd: 5.2,
        dmg: 8,
        desc: "Granite Blast",
        specialType: 'BEAM'
    },
    'Toji': {
        color: '#777777',
        hp: 300,
        spd: 9.8,
        dmg: 15,
        desc: "Heavenly Restriction",
        specialType: 'DASH'
    },
    'Nobara': {
        color: '#ff66aa',
        hp: 260,
        spd: 6.5,
        dmg: 9,
        desc: "Resonance Nails",
        specialType: 'PROJECTILE'
    },
    'Todo': {
        color: '#885533',
        hp: 340,
        spd: 8.0,
        dmg: 11,
        desc: "Boogie Woogie",
        specialType: 'TELEPORT'
    }
};

// --- 4. VFX CLASS ---
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 12;
        this.vy = (Math.random() - 0.5) * 12;
        this.alpha = 1.0;
        this.color = color;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= 0.03;
    }
    draw(c) {
        c.save();
        c.globalAlpha = this.alpha;
        c.fillStyle = this.color;
        c.fillRect(this.x, this.y, 4, 4);
        c.restore();
    }
}

// --- 5. MAIN ENTITY CLASS ---
class Player {
    constructor(x, y, charKey, pNum, isAi) {
        this.id = pNum;
        this.char = charKey;
        this.data = SORCERERS[charKey];
        this.isAi = isAi;
        
        // Transform
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.dir = pNum === 1 ? 1 : -1;
        
        // Stats
        this.hp = ENGINE.MAX_HP;
        this.sp = 0;
        
        // States
        this.stun = 0;
        this.atkFrame = 0;
        this.specFrame = 0;
        this.isShadow = false;
        this.shadowClock = 0;
        
        // Projectiles
        this.projActive = false;
        this.projX = 0;
        this.projY = 0;
        this.projVx = 0;
    }

    // --- LOGIC LOOP ---
    update(opp) {
        if (this.stun > 0) this.stun--;
        if (this.atkFrame > 0) this.atkFrame--;
        if (this.specFrame > 0) this.specFrame--;

        this.handleCursedEnergy();
        this.handleStatusEffects();
        this.handleMovement();
        this.handlePhysics();
        this.handleProjectiles(opp);
        this.handleAuras(opp);

        if (this.isAi) this.handleAi(opp);
    }

    handleCursedEnergy() {
        if (this.sp < ENGINE.MAX_SP) {
            // Ryu & Yuta Balancing: High damage beams mean slower refill
            let rate = 1.0;
            if (this.char === 'Ryu') rate = 0.5;
            if (this.char === 'Yuta') rate = 0.7;
            this.sp += rate;
        }
    }

    handleStatusEffects() {
        if (this.isShadow) {
            this.shadowClock--;
            if (this.shadowClock <= 0) this.isShadow = false;
        }
    }

    handleMovement() {
        if (this.stun > 0 || this.specFrame > 0) return;

        let speed = this.data.spd;
        if (this.isShadow) speed *= 1.7;

        if (this.id === 1) {
            if (input.p1L) { this.vx = -speed; this.dir = -1; }
            if (input.p1R) { this.vx = speed; this.dir = 1; }
        } else if (!this.isAi) {
            if (input.p2L) { this.vx = -speed; this.dir = -1; }
            if (input.p2R) { this.vx = speed; this.dir = 1; }
        }
    }

    handlePhysics() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= ENGINE.FRICTION;

        const groundLevel = canvas.height - ENGINE.GROUND_Y;
        if (this.y < groundLevel) {
            this.vy += ENGINE.GRAVITY;
        } else {
            this.y = groundLevel;
            this.vy = 0;
        }

        // Keep on screen
        if (this.x < 0) this.x = 0;
        if (this.x > canvas.width - 50) this.x = canvas.width - 50;
    }

    handleProjectiles(opp) {
        if (!this.projActive) return;
        this.projX += this.projVx;

        let hit = Math.abs(this.projX - (opp.x + 20)) < 60 && Math.abs(this.projY - (opp.y - 40)) < 80;
        if (hit && !opp.isShadow) {
            opp.hp -= 95;
            opp.stun = 45;
            this.projActive = false;
            state.shake = 15;
            this.spawnImpact(opp.x + 20, opp.y - 40);
        }

        if (this.projX < -500 || this.projX > canvas.width + 500) {
            this.projActive = false;
        }
    }

    handleAuras(opp) {
        if (this.specFrame <= 0) return;

        let dist = Math.abs(this.x - opp.x);
        let inRange = dist < 500;
        let isFacing = (this.dir === 1 && opp.x > this.x) || (this.dir === -1 && opp.x < this.x);

        if (inRange && isFacing && !opp.isShadow) {
            // RYU & YUTA DAMAGE NERF: Set to 0.6 per frame (approx 66 dmg total)
            if (this.char === 'Ryu' || this.char === 'Yuta') {
                opp.hp -= 0.6;
                opp.stun = 3;
            }
            if (this.char === 'Sukuna') {
                opp.hp -= 1.1;
                opp.stun = 5;
            }
        }
    }

    // --- COMBAT ACTIONS ---
    performAttack(opp) {
        if (this.stun > 0 || this.atkFrame > 0) return;
        this.atkFrame = 20;

        let range = 90;
        let dist = Math.abs(this.x - opp.x);
        if (dist < range && !opp.isShadow) {
            let damage = this.data.dmg;
            if (this.isShadow) {
                damage += 35;
                this.isShadow = false;
            }
            opp.hp -= damage;
            opp.stun = 12;
            opp.vx = this.dir * 10;
            this.spawnImpact(opp.x + 20, opp.y - 40);
        }
    }

    performSpecial(opp) {
        if (this.sp < ENGINE.MAX_SP || this.stun > 0) return;
        this.sp = 0;

        switch (this.data.specialType) {
            case 'PROJECTILE':
                this.projActive = true;
                this.projX = this.x + 20;
                this.projY = this.y - 50;
                this.projVx = this.dir * 14;
                break;
            case 'BEAM':
                this.specFrame = 120;
                break;
            case 'AURA':
                this.specFrame = 100;
                break;
            case 'DASH':
                this.vx = this.dir * 60;
                this.specFrame = 30;
                this.performAttack(opp);
                break;
            case 'STEALTH':
                this.isShadow = true;
                this.shadowClock = 300;
                break;
            case 'TELEPORT':
                let tempX = this.x;
                this.x = opp.x;
                opp.x = tempX;
                opp.stun = 40;
                break;
        }
    }

    // --- RENDER PIPELINE ---
    draw(c) {
        c.save();
        const cx = this.x + 20;
        const cy = this.y - 50;

        // Shadow State Visuals
        if (this.isShadow) {
            c.globalAlpha = 0.35;
            c.fillStyle = '#000';
            c.beginPath();
            c.ellipse(cx, this.y, 40, 10, 0, 0, Math.PI * 2);
            c.fill();
        }

        // Stickman Drawing (Dynamic Animation)
        c.lineWidth = 5;
        c.strokeStyle = this.data.color;
        if (this.stun > 0) c.translate(Math.random() * 4 - 2, 0);

        const isMoving = Math.abs(this.vx) > 0.5;
        const legSwing = isMoving ? Math.sin(state.frame * 0.3) * 22 : 0;

        // Head
        c.beginPath(); c.arc(cx, cy - 45, 12, 0, Math.PI * 2); c.stroke();
        // Body
        c.beginPath(); c.moveTo(cx, cy - 33); c.lineTo(cx, cy + 12); c.stroke();
        // Arms
        let reach = this.atkFrame > 0 ? 35 : 20;
        c.beginPath(); c.moveTo(cx, cy - 25); c.lineTo(cx + (this.dir * reach), cy - 5); c.stroke();
        // Legs
        c.beginPath(); c.moveTo(cx, cy + 12); c.lineTo(cx + legSwing, cy + 50); c.stroke();
        c.beginPath(); c.moveTo(cx, cy + 12); c.lineTo(cx - legSwing, cy + 50); c.stroke();

        // Projectile Visual
        if (this.projActive) {
            c.fillStyle = this.data.color;
            c.shadowBlur = 15;
            c.shadowColor = this.data.color;
            c.beginPath(); c.arc(this.projX, this.projY, 25, 0, Math.PI * 2); c.fill();
        }

        // Beam Visual
        if (this.specFrame > 0 && (this.char === 'Ryu' || this.char === 'Yuta' || this.char === 'Sukuna')) {
            c.fillStyle = this.data.color;
            c.globalAlpha = 0.4;
            c.fillRect(cx, cy - 25, 1200 * this.dir, 50);
        }

        c.restore();
    }

    spawnImpact(x, y) {
        for (let i = 0; i < 10; i++) {
            state.vfx.push(new Particle(x, y, this.data.color));
        }
    }

    handleAi(opp) {
        let d = Math.abs(this.x - opp.x);
        this.dir = opp.x < this.x ? -1 : 1;
        
        if (d > 110) {
            this.vx = (opp.x < this.x ? -this.data.spd : this.data.spd) * 0.8;
        }
        
        if (d < 100 && Math.random() < 0.05) this.performAttack(opp);
        if (this.sp >= ENGINE.MAX_SP && Math.random() < 0.02) this.performSpecial(opp);
    }
}

// --- 6. INTERFACE & ENGINE CONTROL ---

function initMode(m) {
    state.mode = m;
    state.turn = 1;
    document.getElementById('m-start').style.display = 'none';
    document.getElementById('m-char').style.display = 'block';
    updateSelectionUI();
}

function updateSelectionUI() {
    const grid = document.getElementById('char-grid');
    const title = document.getElementById('selection-title');
    title.innerText = `PLAYER ${state.turn} SELECT`;
    
    grid.innerHTML = '';
    Object.keys(SORCERERS).forEach(key => {
        const btn = document.createElement('button');
        btn.className = 'char-btn';
        btn.innerHTML = `<strong>${key}</strong><br><small>${SORCERERS[key].desc}</small>`;
        
        btn.onpointerdown = (e) => {
            e.stopPropagation();
            if (state.turn === 1) {
                state.p1Choice = key;
                if (state.mode === '1P') {
                    const keys = Object.keys(SORCERERS);
                    state.p2Choice = keys[Math.floor(Math.random() * keys.length)];
                    launch();
                } else {
                    state.turn = 2;
                    updateSelectionUI();
                }
            } else {
                state.p2Choice = key;
                launch();
            }
        };
        grid.appendChild(btn);
    });
}

function launch() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    state.p1 = new Player(200, canvas.height - 200, state.p1Choice, 1, false);
    state.p2 = new Player(canvas.width - 400, canvas.height - 200, state.p2Choice, 2, state.mode === '1P');
    
    document.getElementById('menu').classList.remove('active-menu');
    document.getElementById('controls').style.display = 'block';
    if (state.mode === '2P') document.getElementById('p2-pad').style.display = 'grid';
    
    state.active = true;
    requestAnimationFrame(mainLoop);
}

function mainLoop() {
    if (!state.active || state.paused) return;

    state.frame++;
    ctx.save();

    // Shake logic
    if (state.shake > 0) {
        ctx.translate(Math.random() * state.shake, Math.random() * state.shake);
        state.shake *= ENGINE.SHAKE_DECAY;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update & Draw VFX
    state.vfx = state.vfx.filter(p => {
        p.update();
        p.draw(ctx);
        return p.alpha > 0;
    });

    // Update Entities
    state.p1.update(state.p2);
    state.p2.update(state.p1);

    // Draw Entities
    state.p1.draw(ctx);
    state.p2.draw(ctx);

    updateHUD();
    checkGameOver();

    ctx.restore();
    requestAnimationFrame(mainLoop);
}

function updateHUD() {
    document.getElementById('p1-hp').style.width = (state.p1.hp / ENGINE.MAX_HP * 100) + '%';
    document.getElementById('p1-cd').style.width = (state.p1.sp / ENGINE.MAX_SP * 100) + '%';
    document.getElementById('p2-hp').style.width = (state.p2.hp / ENGINE.MAX_HP * 100) + '%';
    document.getElementById('p2-cd').style.width = (state.p2.sp / ENGINE.MAX_SP * 100) + '%';
}

function checkGameOver() {
    if (state.p1.hp <= 0 || state.p2.hp <= 0) {
        state.active = false;
        const winMenu = document.getElementById('win-screen');
        const winText = document.getElementById('win-text');
        winMenu.classList.add('active-menu');
        winText.innerText = state.p1.hp <= 0 ? "P2 WINS" : "P1 WINS";
    }
}

// --- 7. INPUT PROCESSING ---

window.addEventListener('pointerdown', e => {
    const val = e.target.dataset.v;
    const pid = e.target.dataset.p;
    if (!val || !pid) return;

    const p = pid === '1' ? state.p1 : state.p2;
    const o = pid === '1' ? state.p2 : state.p1;

    switch(val) {
        case 'l': input[`p${pid}L`] = true; break;
        case 'r': input[`p${pid}R`] = true; break;
        case 'u': if (p.vy === 0) p.vy = -26; break;
        case 'a': p.performAttack(o); break;
        case 's': p.performSpecial(o); break;
    }
});

window.addEventListener('pointerup', e => {
    const val = e.target.dataset.v;
    const pid = e.target.dataset.p;
    if (val === 'l') input[`p${pid}L`] = false;
    if (val === 'r') input[`p${pid}R`] = false;
});

// Keyboard Fallback
window.addEventListener('keydown', e => {
    if (e.code === 'KeyA') input.p1L = true;
    if (e.code === 'KeyD') input.p1R = true;
    if (e.code === 'KeyW' && state.p1.vy === 0) state.p1.vy = -26;
});
window.addEventListener('keyup', e => {
    if (e.code === 'KeyA') input.p1L = false;
    if (e.code === 'KeyD') input.p1R = false;
});
