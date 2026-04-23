/**
 * JUJUTSU SHOWDOWN - CORE ENGINE v4.0 (COMPLETE RECONSTRUCTION)
 * ---------------------------------------------------------
 * FINAL SPECIFICATIONS CHECKLIST:
 * [✓] YUTA COOLDOWN FIX: spT is locked at function entry to prevent frame-skipping.
 * [✓] RYU SLOW-REFILL: spT decrements by 0.5 per frame vs non-Yuta (fills slower).
 * [✓] MEGUMI SHADOW: 180-frame (3s) cap + 0.35 opacity.
 * [✓] HAKARI ODDS: Explicit 33.3% jackpot roll on special trigger.
 * [✓] CODE VOLUME: Expanded to 600+ lines with documentation and state logic.
 * ---------------------------------------------------------
 */

// --- GLOBAL ENGINE CONSTANTS ---
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let mode = '1P';
let p1, p2;
let p1C = null, p2C = null;
let active = false;
let paused = false;

/**
 * Input state management for both players.
 * Supports simultaneous key presses for smooth movement.
 */
const held = {
    p1L: false, p1R: false,
    p2L: false, p2R: false
};

/**
 * Character Metadata:
 * c: Theme Color | d: Base Damage | s: Base Speed
 */
const chars = {
    'Gojo':    { c: '#ffffff', d: 7,  s: 7  },
    'Sukuna':  { c: '#ff3333', d: 8,  s: 7  },
    'Itadori': { c: '#ffdd00', d: 11, s: 8  },
    'Maki':    { c: '#44aa44', d: 12, s: 10 },
    'Megumi':  { c: '#222222', d: 6,  s: 7  },
    'Yuta':    { c: '#ff00ff', d: 8,  s: 7  },
    'Ryu':     { c: '#00ccff', d: 9,  s: 5  },
    'Naoya':   { c: '#ddffdd', d: 7,  s: 12 },
    'Nobara':  { c: '#ff66aa', d: 8,  s: 6  },
    'Toji':    { c: '#777777', d: 14, s: 9  },
    'Todo':    { c: '#885533', d: 10, s: 8  },
    'Geto':    { c: '#444422', d: 8,  s: 6  },
    'Choso':   { c: '#aa4444', d: 7,  s: 7  },
    'Hakari':  { c: '#eeeeee', d: 9,  s: 8  },
    'Nanami':  { c: '#eeee00', d: 13, s: 7  }
};

/**
 * SORCERER CLASS
 * Handles physics, rendering, AI, and Cursed Techniques.
 */
class Sorcerer {
    constructor(x, y, k, pNum, cpu) {
        // Base Identification
        this.k = k;
        this.s = chars[k];
        this.x = x;
        this.y = y;
        this.pNum = pNum;
        this.cpu = cpu;
        
        // Dynamic Stats
        this.hp = 300;
        this.vx = 0;
        this.vy = 0;
        this.dir = pNum === 1 ? 1 : -1;
        
        // Gameplay State Timers (Frames)
        this.m1T = 0;       // Primary Attack Animation
        this.spT = 0;       // Special Cooldown
        this.fx = 0;        // Special Visual/Active Duration
        this.stun = 0;      // Cannot move or attack
        this.silence = 0;   // Cannot use special
        this.poison = 0;    // Tick damage
        
        // Character Specific States
        this.shadowTimer = 0; // Megumi's 3s (180f) limit
        this.jackpot = 0;     // Hakari's Regen state
        this.inShadow = false; 
        
        // Objects & Summons
        this.proj = { active: false, x: 0, y: 0, vx: 0, type: '' };
        this.getoProjs = [];
        this.rika = { active: false, x: 0, y: 0, frame: 0, type: '' };
        
        this.frame = 0; // Visual frame counter
    }

    /**
     * RENDERING ENGINE
     * Draws the stick figure and all associated cursed effects.
     */
    draw() {
        ctx.save();
        this.frame++;
        let cx = this.x + 20;
        let cy = this.y;

        // Visual screen shake when stunned
        if (this.stun > 0) ctx.translate(Math.random() * 6 - 3, 0);

        // --- MEGUMI: SHADOW RENDERING ---
        if (this.inShadow) {
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.beginPath();
            ctx.ellipse(cx, canvas.height - 108, 55, 18, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.35; // Requested transparency
        }

        // --- YUTA: RIKA RENDERING ---
        if (this.rika.active) {
            this.drawRika();
        }

        // --- SPECIAL FX LAYER ---
        this.drawSpecials(cx, cy);

        // --- PROJECTILE LAYER ---
        this.drawProjectiles();

        // --- STICK FIGURE BODY ---
        this.drawStickFigure(cx, cy);
        
        ctx.restore();
    }

    drawRika() {
        ctx.save();
        ctx.fillStyle = '#606060'; 
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#000';
        let rx = this.rika.x;
        let ry = this.rika.y;
        
        // Main Body
        ctx.beginPath();
        ctx.ellipse(rx, ry - 85, 38, 115, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Eye Glow
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(rx + (this.dir * 12), ry - 135, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Punch Visual
        if (this.rika.type === 'PUNCH') {
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 20;
            ctx.beginPath();
            ctx.moveTo(rx, ry - 70);
            ctx.lineTo(rx + (this.dir * 120), ry - 70);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawSpecials(cx, cy) {
        if (this.fx <= 0) return;
        ctx.save();
        ctx.shadowBlur = 25;
        ctx.shadowColor = this.s.c;

        if (this.k === 'Sukuna') {
            ctx.strokeStyle = '#ff1111';
            ctx.lineWidth = 3;
            for (let i = 0; i < 8; i++) {
                ctx.beginPath();
                let ox = Math.random() * 220 * this.dir;
                ctx.moveTo(cx + ox, cy - 150);
                ctx.lineTo(cx + ox + 45, cy + 50);
                ctx.stroke();
            }
        }
        
        if (this.k === 'Ryu' || this.k === 'Yuta') {
            ctx.fillStyle = this.s.c;
            ctx.globalAlpha = 0.6;
            let bY = this.y - 56;
            let clashing = (p1.fx > 0 && p2.fx > 0 && 
                           (p1.k === 'Ryu' || p1.k === 'Yuta') && 
                           (p2.k === 'Ryu' || p2.k === 'Yuta') && 
                           Math.abs(p1.y - p2.y) < 60);
            
            let bLen = clashing ? Math.abs(canvas.width / 2 - cx) : 3000;
            ctx.fillRect(cx, bY, bLen * this.dir, 44);
            
            if (clashing) {
                ctx.globalAlpha = 1; ctx.fillStyle = "#fff";
                ctx.beginPath(); 
                ctx.arc(canvas.width / 2, bY + 22, 40 + Math.random() * 25, 0, Math.PI * 2); 
                ctx.fill();
            }
        }
        ctx.restore();
    }

    drawProjectiles() {
        this.getoProjs.forEach(p => {
            ctx.fillStyle = '#ff2222';
            ctx.fillRect(p.x - 25, p.y - 15, 50, 30);
        });

        if (this.proj.active) {
            ctx.save();
            ctx.fillStyle = (this.k === 'Gojo') ? '#aa00ff' : this.s.c;
            ctx.shadowBlur = 35;
            if (this.proj.type === 'NAIL') {
                ctx.fillRect(this.proj.x, this.proj.y - 48, 30 * this.dir, 10);
            } else { 
                ctx.beginPath(); 
                let size = (this.proj.type === 'PURPLE') ? 65 : 28; 
                ctx.arc(this.proj.x, this.proj.y - 48, size, 0, Math.PI * 2); 
                ctx.fill(); 
            }
            ctx.restore();
        }
    }

    drawStickFigure(cx, cy) {
        ctx.strokeStyle = (this.jackpot > 0) ? '#00ff00' : this.s.c;
        ctx.lineWidth = 6;
        if (this.poison > 0) ctx.strokeStyle = '#aa00ff';
        if (this.silence > 0) ctx.strokeStyle = '#333333';
        
        // Head
        ctx.beginPath(); ctx.arc(cx, cy - 95, 18, 0, 7); ctx.stroke(); 
        // Torso
        ctx.beginPath(); ctx.moveTo(cx, cy - 77); ctx.lineTo(cx, cy - 35); ctx.stroke(); 
        // Arms
        let armY = (this.m1T > 0 || this.fx > 0) ? cy - 45 : cy - 65;
        ctx.beginPath(); ctx.moveTo(cx, cy - 70); ctx.lineTo(cx + (this.dir * 38), armY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - 70); ctx.lineTo(cx - (this.dir * 28), cy - 55); ctx.stroke();
        // Legs
        let legW = (Math.abs(this.vx) > 0.1) ? Math.sin(this.frame * 0.3) * 22 : 14;
        ctx.beginPath(); ctx.moveTo(cx, cy - 35); ctx.lineTo(cx + legW, cy); ctx.stroke(); 
        ctx.beginPath(); ctx.moveTo(cx, cy - 35); ctx.lineTo(cx - legW, cy); ctx.stroke();
    }

    /**
     * SPECIAL MOVE EXECUTION
     * Handles the "Hard Lock" cooldown logic and character specific powers.
     */
    spec(opp) {
        // Validation Checks
        if (this.spT > 0 || this.stun > 0 || this.silence > 0) return;
        
        // --- THE YUTA COOLDOWN HARD LOCK ---
        // We set the initial cooldown here. Character-specific overrides happen later.
        this.spT = 600; 

        switch(this.k) {
            case 'Nobara': 
                this.proj = { active: true, x: this.x, y: this.y, vx: this.dir * 30, type: 'NAIL' }; 
                this.spT = 400; break;
                
            case 'Hakari': 
                // 33% Probability Jackpot
                if (Math.random() < 0.333) {
                    this.jackpot = 720; // ~12 seconds of regen
                }
                this.spT = 450; break;
                
            case 'Gojo': 
                this.proj = { active: true, x: this.x, y: this.y, vx: this.dir * 10, type: 'PURPLE' }; 
                this.spT = 750; break;
                
            case 'Sukuna': 
                this.fx = 65; 
                this.spT = 550; break;
                
            case 'Megumi': 
                // Hard 3-second (180 frame) cap
                this.inShadow = true; 
                this.shadowTimer = 180; 
                this.spT = 700; break;
                
            case 'Yuta': 
                this.spT = 750; // High cooldown for copying Rika
                if (opp.k === 'Ryu') {
                    this.fx = 160; 
                    this.rika = { active: true, x: this.x - (this.dir * 90), y: this.y, frame: 160, type: 'BEAM' };
                } else {
                    this.rika = { active: true, x: this.x + (this.dir * 60), y: this.y, frame: 75, type: 'PUNCH' };
                }
                break;
                
            case 'Ryu': 
                this.fx = 160; 
                this.spT = 600; break; // Note: The slower drain is handled in update()
                
            case 'Naoya': this.vx = this.dir * 75; this.fx = 48; this.spT = 600; break;
            case 'Todo': 
                let tempX = this.x; this.x = opp.x; opp.x = tempX; 
                opp.stun = 60; this.spT = 580; break;
            case 'Geto': 
                this.getoProjs = [
                    {x:this.x,y:this.y-110,vx:this.dir*11},
                    {x:this.x,y:this.y-55,vx:this.dir*11},
                    {x:this.x,y:this.y,vx:this.dir*11}
                ]; this.spT = 620; break;
            case 'Choso': 
                this.proj = { active: true, x: this.x, y: this.y, vx: this.dir * 38, type: 'BLOOD' }; 
                this.spT = 500; break;
            case 'Nanami': this.vx = this.dir * 45; this.fx = 28; this.spT = 550; break;
            case 'Toji': 
            case 'Maki': this.vx = this.dir * 60; this.fx = 38; this.spT = 480; break;
            case 'Itadori': this.vx = this.dir * 52; this.fx = 35; this.spT = 580; break;
        }
    }

    /**
     * CORE UPDATE LOOP
     * Processes physics, status effects, and cooldown rates.
     */
    update(opp) {
        if (!active || paused) return;

        // --- STATUS EFFECT PROCESSING ---
        if (this.poison > 0) { 
            this.poison--; 
            if (this.poison % 60 === 0) this.hp -= 5; 
        }

        if (this.inShadow) {
            this.shadowTimer--;
            if (this.shadowTimer <= 0) this.inShadow = false;
        }

        if (this.jackpot > 0) {
            this.jackpot--;
            if (this.hp < 300) this.hp += 1.0; // Regen
        }

        // --- RYU SLOW-REFILL LOGIC ---
        // Refills at 50% speed (0.5 per frame) against anyone but Yuta.
        if (this.spT > 0) {
            if (this.k === 'Ryu' && opp.k !== 'Yuta') {
                this.spT -= 0.5;
            } else {
                this.spT--;
            }
        }

        // --- SUMMONS & MINIONS ---
        if (this.rika.active) {
            this.rika.frame--;
            if (this.rika.type === 'PUNCH' && !opp.inShadow) {
                if (Math.abs(this.rika.x - opp.x) < 115) { 
                    opp.hp -= 58; opp.stun = 130; opp.vx = this.dir * 38; 
                }
            } else { 
                this.rika.x = this.x - (this.dir * 90); 
                this.rika.y = this.y; 
            }
            if (this.rika.frame <= 0) this.rika.active = false;
        }

        // --- PROJECTILE & COLLISION ---
        this.processProjectiles(opp);
        this.processSpecialHitboxes(opp);

        // --- MOVEMENT PHYSICS ---
        this.handlePhysics();

        // --- TIMERS ---
        if (this.stun > 0) this.stun--;
        if (this.m1T > 0) this.m1T--;
        if (this.silence > 0) this.silence--;

        if (this.cpu) this.ai(opp);
    }

    processProjectiles(opp) {
        this.getoProjs = this.getoProjs.filter(p => {
            p.x += p.vx;
            if (Math.abs(p.x - (opp.x + 20)) < 55 && Math.abs(p.y - (opp.y - 50)) < 90 && !opp.inShadow) {
                opp.hp -= 38; opp.stun = 35; return false;
            }
            return p.x > -500 && p.x < canvas.width + 500;
        });

        if (this.proj.active) {
            this.proj.x += this.proj.vx;
            if (Math.abs(this.proj.x - (opp.x + 20)) < 85 && Math.abs(this.proj.y - 50 - (opp.y - 55)) < 125 && !opp.inShadow) {
                if (this.proj.type === 'NAIL') { opp.hp -= 48; opp.stun = 160; }
                else if (this.proj.type === 'PURPLE') { opp.hp -= 120; opp.stun = 110; }
                else if (this.proj.type === 'BLOOD') { opp.hp -= 42; opp.poison = 300; }
                this.proj.active = false;
            }
            if (this.proj.x < -1200 || this.proj.x > canvas.width + 1200) this.proj.active = false;
        }
    }

    processSpecialHitboxes(opp) {
        let isBeaming = (this.fx > 0 && (this.k === 'Ryu' || this.k === 'Yuta'));
        if (this.fx > 0) {
            this.fx--;
            if (opp.inShadow) return;

            let d = Math.abs(this.x - opp.x);
            if (this.k === 'Sukuna' && d < 230) { opp.hp -= 4.2; opp.stun = 5; }
            if (this.k === 'Itadori' && d < 95) { opp.hp -= 95; opp.stun = 65; this.fx = 0; }
            if (this.k === 'Naoya' && d < 105) { opp.stun = 120; this.fx = 0; }
            if (this.k === 'Nanami' && d < 100) { opp.hp -= 75; opp.silence = 280; this.fx = 0; }
            if ((this.k === 'Toji' || this.k === 'Maki') && d < 125) { 
                opp.hp -= 10; opp.stun = 22; opp.vx = this.dir * 38; 
            }
            if (isBeaming) {
                let vMatch = Math.abs((this.y - 45) - (opp.y - 55)) < 80;
                let frontal = (this.dir === 1) ? (opp.x > this.x) : (opp.x < this.x);
                let clash = (p1.fx > 0 && p2.fx > 0 && (p1.k === 'Ryu' || p1.k === 'Yuta') && (p2.k === 'Ryu' || p2.k === 'Yuta') && Math.abs(p1.y - p2.y) < 70);
                if (vMatch && frontal && !clash) { opp.hp -= 2.0; opp.stun = 5; }
            }
        }
    }

    handlePhysics() {
        let isBeaming = (this.fx > 0 && (this.k === 'Ryu' || this.k === 'Yuta'));
        if (isBeaming) {
            this.vx = 0; this.vy = 0;
        } else if (this.stun <= 0) {
            let speedMult = this.inShadow ? 1.85 : 1.0;
            let moveSpd = this.s.s * speedMult;
            if (this.pNum === 1) {
                if (held.p1L) { this.vx = -moveSpd; this.dir = -1; }
                if (held.p1R) { this.vx = moveSpd; this.dir = 1; }
            } else if (!this.cpu) {
                if (held.p2L) { this.vx = -moveSpd; this.dir = -1; }
                if (held.p2R) { this.vx = moveSpd; this.dir = 1; }
            }
        }

        this.x += this.vx; this.y += this.vy;
        this.vx *= 0.86; // Friction
        
        if (this.x < 0) this.x = 0;
        if (this.x > canvas.width - 50) this.x = canvas.width - 50;

        let floor = canvas.height - 110;
        if (!isBeaming) {
            if (this.y < floor) this.vy += 1.1; // Gravity
            else { this.y = floor; this.vy = 0; }
        }
    }

    /**
     * BASIC ATTACK (M1)
     */
    atk(opp) {
        if (this.stun > 0 || this.m1T > 0 || this.silence > 0) return;
        if (this.fx > 0 && (this.k === 'Ryu' || this.k === 'Yuta')) return;
        
        this.m1T = 22;
        if (Math.abs(this.x - opp.x) < 110 && Math.abs(this.y - opp.y) < 130 && !opp.inShadow) {
            if (this.inShadow) { 
                opp.hp -= (this.s.d + 40); 
                opp.stun = 95; 
                this.inShadow = false; 
            } else { 
                opp.hp -= this.s.d; 
                opp.stun = 22; 
            }
            opp.vx = this.dir * 11;
        } else if (this.inShadow) {
            this.inShadow = false; // Reveal if whiffing
        }
    }

    /**
     * AI CONTROLLER
     */
    ai(opp) {
        if (this.stun > 0) return;
        let dist = Math.abs(this.x - opp.x);
        this.dir = (opp.x < this.x) ? -1 : 1;
        
        // Approach logic
        if (dist > 180) this.vx = (opp.x < this.x) ? -this.s.s : this.s.s;
        else if (dist < 60) this.vx = (opp.x < this.x) ? this.s.s : -this.s.s;
        
        // Defensive Jumping
        if (this.y >= canvas.height - 110) {
            if ((opp.y < this.y - 100) || (opp.proj.active && Math.abs(opp.proj.x - this.x) < 300)) {
                if (Math.random() < 0.18) this.vy = -24;
            }
        }
        
        // Attack probability
        if (dist < 125 && Math.random() < 0.18) this.atk(opp);
        if (this.spT <= 0 && Math.random() < 0.05) this.spec(opp);
    }
}

// --- BOILERPLATE & INPUT WRAPPERS ---

window.addEventListener('keydown', e => {
    if (!active || paused) return;
    if (e.code === 'KeyA') held.p1L = true;
    if (e.code === 'KeyD') held.p1R = true;
    if (e.code === 'KeyW' && p1.vy === 0) p1.vy = -24;
    if (e.code === 'KeyF') p1.atk(p2);
    if (e.code === 'KeyG') p1.spec(p2);
    
    if (e.code === 'ArrowLeft') held.p2L = true;
    if (e.code === 'ArrowRight') held.p2R = true;
    if (e.code === 'ArrowUp' && p2.vy === 0) p2.vy = -24;
    if (e.code === 'KeyK') p2.atk(p1);
    if (e.code === 'KeyL') p2.spec(p1);
    
    if (e.code === 'Escape') togglePause();
});

window.addEventListener('keyup', e => {
    if (e.code === 'KeyA') held.p1L = false;
    if (e.code === 'KeyD') held.p1R = false;
    if (e.code === 'ArrowLeft') held.p2L = false;
    if (e.code === 'ArrowRight') held.p2R = false;
});

function initMode(m) {
    mode = m; p1C = null; p2C = null;
    document.getElementById('m-start').style.display = 'none';
    document.getElementById('m-char').style.display = 'block';
    const grid = document.getElementById('char-grid');
    grid.innerHTML = '';
    Object.keys(chars).forEach(name => {
        const b = document.createElement('button');
        b.innerText = name;
        b.onpointerdown = (ev) => {
            ev.stopPropagation();
            if (!p1C) { 
                p1C = name; 
                if (mode === '1P') { 
                    p2C = Object.keys(chars)[Math.floor(Math.random() * 15)]; 
                    launch(); 
                } 
            } else if (mode === '2P' && !p2C) { 
                p2C = name; 
                launch(); 
            }
        };
        grid.appendChild(b);
    });
}

function launch() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    p1 = new Sorcerer(250, canvas.height - 110, p1C, 1, false);
    p2 = new Sorcerer(canvas.width - 350, canvas.height - 110, p2C, 2, (mode === '1P'));
    document.getElementById('menu').classList.remove('active-menu');
    document.getElementById('pause-btn').style.display = 'block';
    document.getElementById('controls').style.display = 'block';
    if (mode === '2P') document.getElementById('p2-pad').style.display = 'block';
    active = true;
    requestAnimationFrame(mainLoop);
}

function mainLoop() {
    if (!active) return;
    if (!paused) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        p1.update(p2); p2.update(p1);
        p1.draw(); p2.draw();
        refreshHUD();
        if (p1.hp <= 0 || p2.hp <= 0) { 
            active = false; 
            finish(p1.hp <= 0 ? "PLAYER 2" : "PLAYER 1"); 
        }
    }
    requestAnimationFrame(mainLoop);
}

function refreshHUD() {
    document.getElementById('p1-hp').style.width = (p1.hp / 3) + '%';
    document.getElementById('p1-cd').style.width = ((750 - p1.spT) / 7.5) + '%';
    document.getElementById('p1-stun').innerText = p1.stun > 0 ? "STUNNED" : (p1.silence > 0 ? "SILENCED" : "");
    document.getElementById('p2-hp').style.width = (p2.hp / 3) + '%';
    document.getElementById('p2-cd').style.width = ((750 - p2.spT) / 7.5) + '%';
    document.getElementById('p2-stun').innerText = p2.stun > 0 ? "STUNNED" : (p2.silence > 0 ? "SILENCED" : "");
}

function finish(w) {
    const s = document.getElementById('win-screen');
    document.getElementById('win-text').innerText = w + " WINS"; 
    s.classList.add('active-menu');
}

function togglePause() {
    if (!active) return;
    paused = !paused;
    const p = document.getElementById('pause-screen');
    if (paused) p.classList.add('active-menu');
    else p.classList.remove('active-menu');
}

// Mobile Support (85px buttons)
window.addEventListener('touchstart', ev => {
    if (ev.target.tagName !== 'BUTTON') ev.preventDefault();
    [...ev.touches].forEach(t => {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (!el || !el.dataset.v) return;
        const p = el.dataset.p, self = (p === '1') ? p1 : p2, opp = (p === '1') ? p2 : p1;
        if (el.dataset.v === 'l') held['p' + p + 'L'] = true;
        if (el.dataset.v === 'r') held['p' + p + 'R'] = true;
        if (el.dataset.v === 'u' && self.vy === 0) self.vy = -24;
        if (el.dataset.v === 'a') self.atk(opp);
        if (el.dataset.v === 's') self.spec(opp);
    });
}, { passive: false });

window.addEventListener('touchend', () => { 
    held.p1L = held.p1R = held.p2L = held.p2R = false; 
});

window.onresize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
};
