/**
 * JUJUTSU SHOWDOWN - CORE ENGINE v9.0 (ENTERPRISE EDITION)
 * ---------------------------------------------------------
 * ARCHITECTURE OVERVIEW:
 * - Entity: Sorcerer (Physics, Combat, AI)
 * - VFX: Particle System (Cursed Energy & Blood)
 * - Collision: Frontal-Only Directional Validation
 * - UI: Dual-Phase Turn-Based Selection
 * ---------------------------------------------------------
 * LINE COUNT TARGET: 750+
 */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// --- GLOBAL STATE ---
let mode = '1P';
let p1, p2;
let p1C = null, p2C = null;
let active = false;
let paused = false;
let selectionTurn = 1; 
let particles = [];

const held = {
    p1L: false, p1R: false, p1U: false,
    p2L: false, p2R: false, p2U: false
};

// --- DATA DICTIONARY ---
const chars = {
    'Gojo':    { c: '#ffffff', d: 7,   s: 7,   desc: "Infinity & Hollow Purple" },
    'Sukuna':  { c: '#ff3333', d: 8,   s: 7,   desc: "Cleave & Dismantle" },
    'Itadori': { c: '#ffdd00', d: 11,  s: 8,   desc: "Divergent Fist" },
    'Maki':    { c: '#44aa44', d: 12,  s: 10,  desc: "Heavenly Restriction" },
    'Megumi':  { c: '#222222', d: 6,   s: 7,   desc: "Ten Shadows Technique" },
    'Yuta':    { c: '#ff00ff', d: 8,   s: 7,   desc: "Copy & Rika" },
    'Ryu':     { c: '#00ccff', d: 7.2, s: 5.5, desc: "Cursed Energy Discharge" },
    'Naoya':   { c: '#ddffdd', d: 7,   s: 12,  desc: "Projection Sorcery" },
    'Nobara':  { c: '#ff66aa', d: 8,   s: 6,   desc: "Resonance & Hairpin" },
    'Toji':    { c: '#777777', d: 14,  s: 9,   desc: "Sorcerer Killer" },
    'Todo':    { c: '#885533', d: 10,  s: 8,   desc: "Boogie Woogie" },
    'Geto':    { c: '#444422', d: 8,   s: 6,   desc: "Cursed Spirit Manipulation" },
    'Choso':   { c: '#aa4444', d: 7,   s: 7,   desc: "Piercing Blood" },
    'Hakari':  { c: '#eeeeee', d: 9,   s: 8,   desc: "Idle Death Gamble" },
    'Nanami':  { c: '#eeee00', d: 13,  s: 7,   desc: "Ratio Technique" }
};

/**
 * PARTICLE VFX CLASS
 */
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.decay = 0.02 + Math.random() * 0.02;
        this.color = color;
        this.size = 2 + Math.random() * 4;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.vy += 0.1; // Gravity
    }

    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

/**
 * MAIN SORCERER ENTITY
 */
class Sorcerer {
    constructor(x, y, k, pNum, cpu) {
        this.k = k;
        this.s = chars[k];
        this.pNum = pNum;
        this.cpu = cpu;
        this.x = x; 
        this.y = y;
        this.vx = 0; 
        this.vy = 0;
        this.dir = pNum === 1 ? 1 : -1;
        
        this.hp = 300;
        this.m1T = 0;       
        this.spT = 0; // START FROM 0 (Request)
        this.spMax = 600;   
        this.fx = 0;        
        this.stun = 0;      
        this.silence = 0;   
        this.poison = 0;    
        
        this.shadowTimer = 0; 
        this.jackpot = 0;     
        this.inShadow = false; 
        
        this.proj = { active: false, x: 0, y: 0, vx: 0, type: '' };
        this.getoProjs = [];
        this.rika = { active: false, x: 0, y: 0, frame: 0, type: '' };
        
        this.frameCounter = 0; 
    }

    /**
     * CORE HITBOX VALIDATION
     * Ensures only things in front of the character take damage.
     */
    validateFrontalHit(targetX) {
        const charMid = this.x + 20;
        if (this.dir === 1) return targetX > charMid - 10;
        if (this.dir === -1) return targetX < charMid + 10;
        return false;
    }

    createImpactVFX(tx, ty, color) {
        for (let i = 0; i < 8; i++) {
            particles.push(new Particle(tx, ty, color || this.s.c));
        }
    }

    /**
     * DRAWING PIPELINE
     */
    draw() {
        ctx.save();
        this.frameCounter++;
        let cx = this.x + 20;
        let cy = this.y;

        // Visual Stun Shake
        if (this.stun > 0) ctx.translate(Math.random() * 6 - 3, 0);

        // Megumi Shadow Mechanic (0.35 opacity request)
        if (this.inShadow) {
            ctx.fillStyle = 'rgba(0,0,0,0.9)';
            ctx.beginPath();
            ctx.ellipse(cx, canvas.height - 108, 55, 18, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.35; 
        }

        if (this.rika.active) this.renderRikaInstance();
        this.renderProjectiles();
        this.renderSpecials(cx, cy);
        this.renderBody(cx, cy);
        ctx.restore();
    }

    renderRikaInstance() {
        ctx.save();
        ctx.fillStyle = '#333';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#000';
        let rx = this.rika.x;
        let ry = this.rika.y;
        
        // Massive Rika Silhouette
        ctx.beginPath();
        ctx.ellipse(rx, ry - 80, 45, 120, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Glowing Eyes
        ctx.fillStyle = '#ff00ff';
        ctx.beginPath();
        ctx.arc(rx + (this.dir * 12), ry - 140, 6, 0, 7);
        ctx.fill();
        
        if (this.rika.type === 'PUNCH') {
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 30;
            ctx.beginPath();
            ctx.moveTo(rx, ry - 70);
            ctx.lineTo(rx + (this.dir * 130), ry - 70);
            ctx.stroke();
        }
        ctx.restore();
    }

    renderProjectiles() {
        // Geto's Spirits
        this.getoProjs.forEach(p => {
            ctx.fillStyle = '#800000';
            ctx.shadowBlur = 10;
            ctx.fillRect(p.x - 25, p.y - 15, 50, 30);
        });

        if (this.proj.active) {
            ctx.save();
            ctx.fillStyle = (this.k === 'Gojo') ? '#a020f0' : this.s.c;
            ctx.shadowBlur = 35;
            if (this.proj.type === 'NAIL') {
                ctx.fillRect(this.proj.x, this.proj.y - 45, 35 * this.dir, 8);
            } else { 
                ctx.beginPath(); 
                let radius = (this.proj.type === 'PURPLE') ? 70 : 28; 
                ctx.arc(this.proj.x, this.proj.y - 45, radius, 0, Math.PI * 2); 
                ctx.fill(); 
            }
            ctx.restore();
        }
    }

    renderSpecials(cx, cy) {
        if (this.fx <= 0) return;
        ctx.save();
        ctx.shadowBlur = 40;
        ctx.shadowColor = this.s.c;

        if (this.k === 'Sukuna') {
            ctx.strokeStyle = '#ff2222';
            ctx.lineWidth = 3;
            for (let i = 0; i < 15; i++) {
                ctx.beginPath();
                let ox = (this.dir === 1) ? Math.random() * 600 : -Math.random() * 600;
                ctx.moveTo(cx + ox, cy - 160);
                ctx.lineTo(cx + ox + 50, cy + 60);
                ctx.stroke();
            }
        }
        
        // Ryu/Yuta Beam Rendering
        if (this.k === 'Ryu' || this.k === 'Yuta') {
            ctx.fillStyle = this.s.c;
            ctx.globalAlpha = 0.55;
            let bY = this.y - 60;
            let bH = 55;
            // Clash Logic
            let isClashing = (p1.fx > 0 && p2.fx > 0 && 
                             (p1.k === 'Ryu' || p1.k === 'Yuta') && 
                             (p2.k === 'Ryu' || p2.k === 'Yuta') && 
                             Math.abs(p1.y - p2.y) < 70);

            let beamLength = isClashing ? Math.abs(canvas.width / 2 - cx) : 5000;
            ctx.fillRect(cx, bY, beamLength * this.dir, bH);
            
            if (isClashing) {
                ctx.globalAlpha = 1; ctx.fillStyle = "#ffffff";
                ctx.shadowColor = "#fff";
                ctx.beginPath(); 
                ctx.arc(canvas.width / 2, bY + (bH/2), 65 + Math.random() * 20, 0, 7); 
                ctx.fill();
            }
        }
        ctx.restore();
    }

    renderBody(cx, cy) {
        ctx.strokeStyle = (this.jackpot > 0) ? '#00ff00' : this.s.c;
        ctx.lineWidth = 7;
        if (this.poison > 0) ctx.strokeStyle = '#9933ff';
        if (this.silence > 0) ctx.strokeStyle = '#111111';
        
        // Head
        ctx.beginPath(); ctx.arc(cx, cy - 95, 18, 0, 7); ctx.stroke(); 
        // Torso
        ctx.beginPath(); ctx.moveTo(cx, cy - 77); ctx.lineTo(cx, cy - 35); ctx.stroke(); 
        // Arm logic (Striking vs Idle)
        let armTargetY = (this.m1T > 0 || this.fx > 0) ? cy - 40 : cy - 65;
        ctx.beginPath(); ctx.moveTo(cx, cy - 70); ctx.lineTo(cx + (this.dir * 40), armTargetY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - 70); ctx.lineTo(cx - (this.dir * 30), cy - 55); ctx.stroke();
        // Walking/Physics animation
        let legSwing = (Math.abs(this.vx) > 0.1) ? Math.sin(this.frameCounter * 0.45) * 25 : 15;
        ctx.beginPath(); ctx.moveTo(cx, cy - 35); ctx.lineTo(cx + legSwing, cy); ctx.stroke(); 
        ctx.beginPath(); ctx.moveTo(cx, cy - 35); ctx.lineTo(cx - legSwing, cy); ctx.stroke();
    }

    /**
     * CORE UPDATE LOGIC
     */
    update(opp) {
        if (!active || paused) return;

        // 1. STATUS HANDLERS
        this.handleStatusEffects();

        // 2. COOLDOWN REFILL (Request Fix: Starts at 0, Fills UP)
        if (this.spT < this.spMax) {
            let refillModifier = 1.0;
            // RYU PENALTY: Half speed refill unless fighting Yuta
            if (this.k === 'Ryu' && opp.k !== 'Yuta') {
                refillModifier = 0.5;
            }
            this.spT += refillModifier;
        }

        // 3. HITBOX SYSTEM
        this.processProjectiles(opp);
        this.processAuraAndBeams(opp);

        // 4. PHYSICS & SUMMONS
        this.handleMovement();
        this.updateRika(opp);

        // 5. TIMERS
        if (this.stun > 0) this.stun--;
        if (this.m1T > 0) this.m1T--;
        if (this.silence > 0) this.silence--;

        if (this.cpu) this.runAI(opp);
    }

    handleStatusEffects() {
        if (this.poison > 0) { 
            this.poison--; 
            if (this.poison % 60 === 0) {
                this.hp -= 6;
                this.createImpactVFX(this.x + 20, this.y - 50, '#9933ff');
            }
        }
        if (this.inShadow) {
            this.shadowTimer--;
            if (this.shadowTimer <= 0) this.inShadow = false;
        }
        if (this.jackpot > 0) {
            this.jackpot--;
            if (this.hp < 300) this.hp += 0.95; 
        }
    }

    processProjectiles(opp) {
        // Geto spirit logic
        this.getoProjs = this.getoProjs.filter(p => {
            p.x += p.vx;
            if (Math.abs(p.x - (opp.x + 20)) < 65 && Math.abs(p.y - (opp.y - 45)) < 90 && !opp.inShadow) {
                opp.hp -= 34; opp.stun = 35; 
                this.createImpactVFX(p.x, p.y, '#800000');
                return false;
            }
            return p.x > -500 && p.x < canvas.width + 500;
        });

        if (this.proj.active) {
            this.proj.x += this.proj.vx;
            const hitX = Math.abs(this.proj.x - (opp.x + 20)) < 80;
            const hitY = Math.abs(this.proj.y - 45 - (opp.y - 50)) < 120;
            
            if (hitX && hitY && !opp.inShadow) {
                if (this.proj.type === 'NAIL') { opp.hp -= 44; opp.stun = 150; }
                else if (this.proj.type === 'PURPLE') { opp.hp -= 112; opp.stun = 95; }
                else if (this.proj.type === 'BLOOD') { opp.hp -= 42; opp.poison = 300; }
                this.createImpactVFX(this.proj.x, this.proj.y - 45);
                this.proj.active = false;
            }
            if (this.proj.x < -1000 || this.proj.x > canvas.width + 1000) this.proj.active = false;
        }
    }

    processAuraAndBeams(opp) {
        if (this.fx <= 0) return;
        
        // Frontal Check required for all Specials
        const isFacing = this.validateFrontalHit(opp.x + 20);

        if (opp.inShadow || !isFacing) return;

        let dist = Math.abs(this.x - opp.x);
        
        if (this.k === 'Sukuna' && dist < 260) { 
            opp.hp -= 3.8; opp.stun = 4; 
        }
        if (this.k === 'Itadori' && dist < 110) { 
            opp.hp -= 92; opp.stun = 65; 
            this.createImpactVFX(opp.x + 20, opp.y - 50, '#ffcc00');
            this.fx = 0; 
        }
        if (this.k === 'Nanami' && dist < 110) { 
            opp.hp -= 68; opp.silence = 280; 
            this.fx = 0; 
        }
        if ((this.k === 'Toji' || this.k === 'Maki') && dist < 135) { 
            opp.hp -= 9; opp.stun = 26; 
            opp.vx = this.dir * 36; 
        }
        
        // Ryu Beam Balance (1.2 Request)
        if (this.k === 'Ryu' || this.k === 'Yuta') {
            let heightMatch = Math.abs((this.y - 40) - (opp.y - 55)) < 85;
            if (heightMatch) { 
                opp.hp -= (this.k === 'Ryu' ? 1.2 : 1.7); 
                opp.stun = 5; 
            }
        }
    }

    handleMovement() {
        // Locked during beam discharge
        let isImmobile = (this.fx > 0 && (this.k === 'Ryu' || this.k === 'Yuta'));
        
        if (isImmobile) {
            this.vx = 0; 
            this.vy = 0;
        } else if (this.stun <= 0) {
            let baseSpeed = this.s.s * (this.inShadow ? 2.0 : 1.0);
            
            if (this.pNum === 1) {
                if (held.p1L) { this.vx = -baseSpeed; this.dir = -1; }
                if (held.p1R) { this.vx = baseSpeed; this.dir = 1; }
            } else if (!this.cpu) {
                if (held.p2L) { this.vx = -baseSpeed; this.dir = -1; }
                if (held.p2R) { this.vx = baseSpeed; this.dir = 1; }
            }
        }

        this.x += this.vx; this.y += this.vy;
        this.vx *= 0.84; // Friction
        
        // Boundaries
        if (this.x < 0) this.x = 0;
        if (this.x > canvas.width - 50) this.x = canvas.width - 50;

        let floor = canvas.height - 110;
        if (!isImmobile) {
            if (this.y < floor) this.vy += 1.05; // Gravity
            else { this.y = floor; this.vy = 0; }
        }
    }

    updateRika(opp) {
        if (!this.rika.active) return;
        this.rika.frame--;
        
        if (this.rika.type === 'PUNCH' && !opp.inShadow) {
            // Rika's punch is also Frontal
            const rikaFacing = (this.dir === 1) ? (opp.x > this.rika.x - 10) : (opp.x < this.rika.x + 10);
            if (Math.abs(this.rika.x - opp.x) < 135 && rikaFacing) { 
                opp.hp -= 58; 
                opp.stun = 140; 
                opp.vx = this.dir * 42; 
                this.createImpactVFX(opp.x + 20, opp.y - 50, '#ffffff');
            }
        } else { 
            // Position Rika behind Yuta during Beam
            this.rika.x = this.x - (this.dir * 95); 
            this.rika.y = this.y; 
        }

        if (this.rika.frame <= 0) this.rika.active = false;
    }

    /**
     * COMBAT ACTIONS
     */
    atk(opp) {
        if (this.stun > 0 || this.m1T > 0 || this.silence > 0) return;
        this.m1T = 22;
        
        // Frontal Check and Range check
        const inRange = Math.abs(this.x - opp.x) < 120 && Math.abs(this.y - opp.y) < 150;
        const isFacing = this.validateFrontalHit(opp.x + 20);

        if (inRange && isFacing && !opp.inShadow) {
            if (this.inShadow) { 
                opp.hp -= (this.s.d + 35); 
                opp.stun = 95; 
                this.inShadow = false; 
            } else { 
                opp.hp -= this.s.d; 
                opp.stun = 22; 
            }
            opp.vx = this.dir * 14;
            this.createImpactVFX(opp.x + 20, opp.y - 60);
        } else if (this.inShadow) {
            // Whiffing from shadow ends shadow
            this.inShadow = false;
        }
    }

    spec(opp) {
        if (this.spT < this.spMax || this.stun > 0 || this.silence > 0) return;
        
        // Cooldown Reset from 0
        this.spT = 0; 
        
        switch(this.k) {
            case 'Nobara': 
                this.proj = { active: true, x: this.x, y: this.y, vx: this.dir * 34, type: 'NAIL' }; break;
            case 'Hakari': 
                if (Math.random() < 0.33) { this.jackpot = 750; this.createImpactVFX(this.x, this.y, '#00ff00'); }
                break;
            case 'Gojo': 
                this.proj = { active: true, x: this.x, y: this.y, vx: this.dir * 12, type: 'PURPLE' }; break;
            case 'Sukuna': this.fx = 75; break;
            case 'Itadori': this.vx = this.dir * 48; this.fx = 35; break;
            case 'Megumi': 
                this.inShadow = true; this.shadowTimer = 180; break;
            case 'Ryu': 
                this.fx = 165; break;
            case 'Yuta': 
                if (opp.k === 'Ryu') {
                    this.fx = 165; 
                    this.rika = { active: true, x: this.x - (this.dir * 85), y: this.y, frame: 165, type: 'BEAM' };
                } else {
                    this.rika = { active: true, x: this.x + (this.dir * 65), y: this.y, frame: 80, type: 'PUNCH' };
                }
                break;
            case 'Naoya': this.vx = this.dir * 75; this.fx = 50; break;
            case 'Geto': 
                this.getoProjs = [
                    {x:this.x,y:this.y-110,vx:this.dir*11},
                    {x:this.x,y:this.y-55,vx:this.dir*11},
                    {x:this.x,y:this.y,vx:this.dir*11}
                ]; break;
            case 'Choso':
                this.proj = { active: true, x: this.x, y: this.y, vx: this.dir * 40, type: 'BLOOD' }; break;
            case 'Todo': 
                let tempX = this.x; this.x = opp.x; opp.x = tempX; 
                opp.stun = 65; break;
            default: // Toji/Maki/Nanami Dash
                this.vx = this.dir * 60; this.fx = 35; break;
        }
    }

    runAI(opp) {
        if (this.stun > 0) return;
        let dist = Math.abs(this.x - opp.x);
        
        // Auto-face
        this.dir = (opp.x < this.x) ? -1 : 1;
        
        if (dist > 200) {
            this.vx = (opp.x < this.x) ? -this.s.s : this.s.s;
        } else if (dist < 60) {
            this.vx = (opp.x < this.x) ? this.s.s : -this.s.s;
        }

        if (this.y >= canvas.height - 115) {
            if (opp.y < this.y - 110 || (opp.proj.active && Math.abs(opp.proj.x - this.x) < 300)) {
                if (Math.random() < 0.15) this.vy = -24;
            }
        }

        if (dist < 125 && Math.random() < 0.18) this.atk(opp);
        if (this.spT >= this.spMax && Math.random() < 0.06) this.spec(opp);
    }
}

// --- CHARACTER SELECTION UI MANAGER ---

function initSelection(selectedMode) {
    mode = selectedMode;
    p1C = null;
    p2C = null;
    selectionTurn = 1;
    
    document.getElementById('m-start').style.display = 'none';
    document.getElementById('m-char').style.display = 'block';
    
    renderCharacterGrid();
    refreshSelectionTitle();
}

function refreshSelectionTitle() {
    const title = document.querySelector('#m-char h2');
    title.innerText = `PLAYER ${selectionTurn}: CHOOSE YOUR SORCERER`;
}

function renderCharacterGrid() {
    const grid = document.getElementById('char-grid');
    grid.innerHTML = '';
    
    Object.keys(chars).forEach(name => {
        const btn = document.createElement('button');
        btn.innerHTML = `<strong>${name}</strong><br><small>${chars[name].desc}</small>`;
        
        btn.onpointerdown = (e) => {
            e.stopPropagation();
            if (selectionTurn === 1) {
                p1C = name;
                if (mode === '1P') {
                    // CPU random pick
                    const list = Object.keys(chars);
                    p2C = list[Math.floor(Math.random() * list.length)];
                    startGameplay();
                } else {
                    selectionTurn = 2;
                    refreshSelectionTitle();
                }
            } else if (selectionTurn === 2) {
                p2C = name;
                startGameplay();
            }
        };
        grid.appendChild(btn);
    });
}

function startGameplay() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    p1 = new Sorcerer(250, canvas.height - 110, p1C, 1, false);
    p2 = new Sorcerer(canvas.width - 350, canvas.height - 110, p2C, 2, (mode === '1P'));
    
    document.getElementById('menu').classList.remove('active-menu');
    document.getElementById('pause-btn').style.display = 'block';
    document.getElementById('controls').style.display = 'block';
    
    if (mode === '2P') document.getElementById('p2-pad').style.display = 'block';
    
    active = true;
    requestAnimationFrame(engineLoop);
}

// --- ENGINE PIPELINE ---

function engineLoop() {
    if (!active) return;

    if (!paused) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 1. Update Entities
        p1.update(p2);
        p2.update(p1);
        
        // 2. Update Particles
        particles = particles.filter(p => {
            p.update();
            p.draw();
            return p.life > 0;
        });

        // 3. Draw Entities
        p1.draw();
        p2.draw();
        
        syncHUD();
        
        // 4. Win Condition
        if (p1.hp <= 0 || p2.hp <= 0) { 
            active = false; 
            const winner = p1.hp <= 0 ? "PLAYER 2" : "PLAYER 1";
            document.getElementById('win-text').innerText = `${winner} DOMINATES`; 
            document.getElementById('win-screen').classList.add('active-menu');
        }
    }
    requestAnimationFrame(engineLoop);
}

function syncHUD() {
    document.getElementById('p1-hp').style.width = (p1.hp / 3) + '%';
    document.getElementById('p1-cd').style.width = (p1.spT / p1.spMax * 100) + '%';
    document.getElementById('p2-hp').style.width = (p2.hp / 3) + '%';
    document.getElementById('p2-cd').style.width = (p2.spT / p2.spMax * 100) + '%';
    
    // Status Text
    document.getElementById('p1-stun').innerText = p1.stun > 0 ? "STUNNED" : (p1.silence > 0 ? "SILENCED" : "");
    document.getElementById('p2-stun').innerText = p2.stun > 0 ? "STUNNED" : (p2.silence > 0 ? "SILENCED" : "");
}

// --- INPUT REGISTER ---

window.addEventListener('keydown', e => {
    if (!active || paused) return;
    switch(e.code) {
        case 'KeyA': held.p1L = true; break;
        case 'KeyD': held.p1R = true; break;
        case 'KeyW': if (p1.vy === 0) p1.vy = -24; break;
        case 'KeyF': p1.atk(p2); break;
        case 'KeyG': p1.spec(p2); break;
        case 'ArrowLeft': held.p2L = true; break;
        case 'ArrowRight': held.p2R = true; break;
        case 'ArrowUp': if (p2.vy === 0) p2.vy = -24; break;
        case 'KeyK': p2.atk(p1); break;
        case 'KeyL': p2.spec(p1); break;
        case 'Escape': togglePauseState(); break;
    }
});

window.addEventListener('keyup', e => {
    switch(e.code) {
        case 'KeyA': held.p1L = false; break;
        case 'KeyD': held.p1R = false; break;
        case 'ArrowLeft': held.p2L = false; break;
        case 'ArrowRight': held.p2R = false; break;
    }
});

function togglePauseState() {
    if (!active) return;
    paused = !paused;
    const overlay = document.getElementById('pause-screen');
    if (paused) overlay.classList.add('active-menu');
    else overlay.classList.remove('active-menu');
}

// --- MOBILE INPUT ---

window.addEventListener('touchstart', ev => {
    if (ev.target.tagName !== 'BUTTON') ev.preventDefault();
    [...ev.touches].forEach(t => {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (!el || !el.dataset.v) return;
        const p = el.dataset.p, self = (p === '1' ? p1 : p2), enemy = (p === '1' ? p2 : p1);
        if (el.dataset.v === 'l') held['p'+p+'L'] = true;
        if (el.dataset.v === 'r') held['p'+p+'R'] = true;
        if (el.dataset.v === 'u' && self.vy === 0) self.vy = -24;
        if (el.dataset.v === 'a') self.atk(enemy);
        if (el.dataset.v === 's') self.spec(enemy);
    });
}, { passive: false });

window.addEventListener('touchend', () => { 
    held.p1L = held.p1R = held.p2L = held.p2R = false; 
});
