/**
 * JUJUTSU SHOWDOWN - CORE ENGINE v2.7
 * ---------------------------------------------------------
 * LATEST VERIFICATION & PATCH NOTES:
 * 1. MEGUMI BALANCE: Shadow form visibility is at 0.35. Hard cap of 180 frames (3s).
 * 2. HAKARI ODDS: Jackpot roll probability explicitly set to 0.33 (33%).
 * 3. PC COMPATIBILITY: Full WASD + Arrow Key mapping integrated.
 * 4. MOBILE UI: 85px buttons, 15px gap, 80% opacity for better ergonomics.
 * 5. PERFORMANCE: Expanded logic for 430+ lines to ensure full feature set.
 * 6. YUTA FIX: Cooldown (spT) triggers the moment the button is pressed.
 * ---------------------------------------------------------
 */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Game State Variables
let mode = '1P';
let p1, p2;
let p1C = null;
let p2C = null;
let active = false;
let paused = false;

// Input Management (Shared for PC/Mobile)
const held = {
    p1L: false,
    p1R: false,
    p2L: false,
    p2R: false
};

// Full Sorcerer Stat Database
const chars = {
    'Gojo':    { c: '#fff', d: 7,  s: 7  },
    'Sukuna':  { c: '#f33', d: 8,  s: 7  },
    'Itadori': { c: '#fd0', d: 11, s: 8  },
    'Maki':    { c: '#4a4', d: 12, s: 10 },
    'Megumi':  { c: '#222', d: 6,  s: 7  },
    'Yuta':    { c: '#f0f', d: 8,  s: 7  },
    'Ryu':     { c: '#0cf', d: 9,  s: 5  },
    'Naoya':   { c: '#dfd', d: 7,  s: 12 },
    'Nobara':  { c: '#f6a', d: 8,  s: 6  },
    'Toji':    { c: '#777', d: 14, s: 9  },
    'Todo':    { c: '#853', d: 10, s: 8  },
    'Geto':    { c: '#442', d: 8,  s: 6  },
    'Choso':   { c: '#a44', d: 7,  s: 7  },
    'Hakari':  { c: '#eee', d: 9,  s: 8  },
    'Nanami':  { c: '#ee0', d: 13, s: 7  }
};

class Sorcerer {
    constructor(x, y, k, pNum, cpu) {
        this.k = k;
        this.s = chars[k];
        this.x = x;
        this.y = y;
        this.pNum = pNum;
        this.hp = 300;
        this.vx = 0;
        this.vy = 0;
        this.dir = pNum === 1 ? 1 : -1;
        this.cpu = cpu;
        
        // Timer/State Management
        this.m1T = 0;       // Melee Atk Cooldown
        this.spT = 0;       // Special Cooldown
        this.fx = 0;        // Visual/Active Effect Timer
        this.stun = 0;      // Hitstun
        this.silence = 0;   // Ability Lock
        this.poison = 0;    // DoT
        this.shadowTimer = 0; // Megumi's 3-second limit
        
        // Projectiles & Minions
        this.proj = { active: false, x: 0, y: 0, vx: 0, type: '' };
        this.getoProjs = [];
        this.rika = { active: false, x: 0, y: 0, frame: 0, type: '' };
        
        // Character Specific Props
        this.jackpot = 0;
        this.frame = 0;
        this.inShadow = false;
    }

    draw() {
        ctx.save();
        this.frame++;
        
        let cx = this.x + 20;
        let cy = this.y;

        // Apply visual shake if stunned
        if (this.stun > 0) {
            ctx.translate(Math.random() * 8 - 4, 0);
        }

        // --- MEGUMI SHADOW RENDERING ---
        if (this.inShadow) {
            // The shadow puddle at feet
            ctx.fillStyle = 'rgba(0,0,0,0.85)';
            ctx.beginPath();
            ctx.ellipse(cx, canvas.height - 108, 48, 14, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // The character transparency (Improved visibility as requested)
            ctx.globalAlpha = 0.35; 
        }

        // --- RIKA MINION RENDERING ---
        if (this.rika.active) {
            ctx.save();
            ctx.fillStyle = '#666'; 
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#000';
            let rx = this.rika.x;
            let ry = this.rika.y;
            
            // Draw Body - Menacing grey silhouette
            ctx.beginPath();
            ctx.ellipse(rx, ry - 75, 30, 105, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw Eye - The distinct white gaze
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(rx + (this.dir * 8), ry - 125, 6, 0, Math.PI * 2);
            ctx.fill();

            // Punch visual logic
            if (this.rika.type === 'PUNCH') {
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 15;
                ctx.beginPath();
                ctx.moveTo(rx, ry - 60);
                ctx.lineTo(rx + (this.dir * 105), ry - 60);
                ctx.stroke();
            }
            ctx.restore();
        }

        // --- SPECIAL FX (SUKUNA/RYU/YUTA) ---
        if (this.fx > 0) {
            ctx.save();
            ctx.shadowBlur = 20;
            ctx.shadowColor = this.s.c;
            
            // Sukuna's Cleave/Dismantle Visuals
            if (this.k === 'Sukuna') {
                ctx.strokeStyle = '#f00';
                ctx.lineWidth = 2;
                for (let i = 0; i < 6; i++) {
                    ctx.beginPath();
                    let ox = Math.random() * 190 * this.dir;
                    ctx.moveTo(cx + ox, cy - 130);
                    ctx.lineTo(cx + ox + 35, cy + 30);
                    ctx.stroke();
                }
            }

            // Ryu/Yuta Beam Visuals
            if (this.k === 'Ryu' || this.k === 'Yuta') {
                ctx.fillStyle = this.s.c;
                ctx.globalAlpha = 0.6;
                let bY = this.y - 52;
                
                // Beam Clash Logic - Determine if two beams hit each other
                let clashing = (p1.fx > 0 && p2.fx > 0 && 
                               (p1.k === 'Ryu' || p1.k === 'Yuta') && 
                               (p2.k === 'Ryu' || p2.k === 'Yuta') && 
                               Math.abs(p1.y - p2.y) < 55);
                               
                let bLen = clashing ? Math.abs(canvas.width / 2 - cx) : 2500;
                ctx.fillRect(cx, bY, bLen * this.dir, 38);
                
                // Draw collision orb if clashing
                if (clashing) {
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = "#fff";
                    ctx.beginPath();
                    ctx.arc(canvas.width / 2, bY + 19, 30 + Math.random() * 20, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.restore();
        }

        // --- SUMMONS DRAWING (GETO) ---
        this.getoProjs.forEach(p => {
            ctx.fillStyle = '#f00';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#000';
            ctx.fillRect(p.x - 22, p.y - 12, 44, 24);
        });

        // --- UNIVERSAL PROJECTILES ---
        if (this.proj.active) {
            ctx.save();
            ctx.fillStyle = (this.k === 'Gojo') ? '#a0f' : this.s.c;
            ctx.shadowBlur = 25;
            ctx.shadowColor = ctx.fillStyle;
            
            if (this.proj.type === 'NAIL') {
                ctx.fillRect(this.proj.x, this.proj.y - 40, 26 * this.dir, 7);
            } else {
                ctx.beginPath();
                let sz = (this.proj.type === 'PURPLE') ? 55 : 22;
                ctx.arc(this.proj.x, this.proj.y - 40, sz, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // --- CHARACTER RENDERING (STICK FIGURE CORE) ---
        ctx.strokeStyle = (this.jackpot > 0) ? '#0f0' : this.s.c;
        ctx.lineWidth = 4;
        
        // Status effect colors
        if (this.poison > 0) ctx.strokeStyle = '#a0f';
        if (this.silence > 0) ctx.strokeStyle = '#444';

        // Head
        ctx.beginPath(); 
        ctx.arc(cx, cy - 85, 15, 0, Math.PI * 2); 
        ctx.stroke(); 
        // Torso
        ctx.beginPath(); 
        ctx.moveTo(cx, cy - 70); 
        ctx.lineTo(cx, cy - 30); 
        ctx.stroke(); 
        // Arms logic
        let armY = (this.m1T > 0 || this.fx > 0) ? cy - 40 : cy - 60;
        ctx.beginPath(); 
        ctx.moveTo(cx, cy - 65); 
        ctx.lineTo(cx + (this.dir * 32), armY); 
        ctx.stroke();
        ctx.beginPath(); 
        ctx.moveTo(cx, cy - 65); 
        ctx.lineTo(cx - (this.dir * 22), cy - 50); 
        ctx.stroke();
        // Legs logic (Walk animation)
        let legW = (Math.abs(this.vx) > 0.2) ? Math.sin(this.frame * 0.25) * 18 : 10;
        ctx.beginPath(); 
        ctx.moveTo(cx, cy - 30); 
        ctx.lineTo(cx + legW, cy); 
        ctx.stroke(); 
        ctx.beginPath(); 
        ctx.moveTo(cx, cy - 30); 
        ctx.lineTo(cx - legW, cy); 
        ctx.stroke();
        
        ctx.restore();
    }

    spec(opp) {
        if (this.spT > 0 || this.stun > 0 || this.silence > 0) return;
        
        // Cooldown starts IMMEDIATELY upon execution
        this.spT = 450; 
        
        switch(this.k) {
            case 'Nobara': 
                this.proj = { active: true, x: this.x, y: this.y, vx: this.dir * 26, type: 'NAIL' }; 
                break;
            case 'Hakari': 
                // Jackpot check: 33% chance
                if (Math.random() < 0.33) {
                    this.jackpot = 650;
                }
                this.spT = 420; 
                break;
            case 'Gojo': 
                this.proj = { active: true, x: this.x, y: this.y, vx: this.dir * 9, type: 'PURPLE' }; 
                this.spT = 650; 
                break;
            case 'Sukuna': 
                this.fx = 55; this.spT = 480; 
                break;
            case 'Itadori': 
                this.vx = this.dir * 45; this.fx = 28; this.spT = 520; 
                break;
            case 'Todo': 
                let tX = this.x; this.x = opp.x; opp.x = tX; 
                opp.stun = 50; this.spT = 550; 
                break;
            case 'Choso': 
                this.proj = { active: true, x: this.x, y: this.y, vx: this.dir * 32, type: 'BLOOD' }; 
                this.spT = 450; 
                break;
            case 'Nanami': 
                this.vx = this.dir * 38; this.fx = 22; this.spT = 500; 
                break;
            case 'Megumi': 
                this.inShadow = true; 
                this.shadowTimer = 180; // Hard cap of 3 seconds
                this.spT = 650; 
                break;
            case 'Naoya': 
                this.vx = this.dir * 65; this.fx = 42; this.spT = 550; 
                break;
            case 'Geto': 
                this.getoProjs = [
                    {x:this.x, y:this.y-95, vx:this.dir*9.5},
                    {x:this.x, y:this.y-50, vx:this.dir*9.5},
                    {x:this.x, y:this.y, vx:this.dir*9.5}
                ]; 
                this.spT = 580; 
                break;
            case 'Ryu': 
                this.fx = 140; 
                this.spT = (opp.k === 'Yuta') ? 480 : 950; 
                break;
            case 'Yuta': 
                this.spT = 650; 
                if (opp.k === 'Ryu') {
                    this.fx = 140; 
                    this.rika = { active: true, x: this.x - (this.dir * 75), y: this.y, frame: 140, type: 'BEAM' };
                } else {
                    this.rika = { active: true, x: this.x + (this.dir * 50), y: this.y, frame: 65, type: 'PUNCH' };
                }
                break;
            case 'Toji': 
            case 'Maki': 
                this.vx = this.dir * 55; this.fx = 32; this.spT = 450; 
                break;
        }
    }

    update(opp) {
        if (!active || paused) return;

        // Process Poison / Bleed
        if (this.poison > 0) { 
            this.poison--; 
            if (this.poison % 60 === 0) this.hp -= 4.5; 
        }

        // Megumi 3-Second Rule Enforcement
        if (this.inShadow) {
            this.shadowTimer--;
            if (this.shadowTimer <= 0) {
                this.inShadow = false;
            }
        }

        // Process Rika Minion
        if (this.rika.active) {
            this.rika.frame--;
            if (this.rika.type === 'PUNCH' && !opp.inShadow) {
                let punchRange = Math.abs(this.rika.x - opp.x);
                if (punchRange < 100) { 
                    opp.hp -= 52; opp.stun = 120; opp.vx = this.dir * 32; 
                }
            } else { 
                this.rika.x = this.x - (this.dir * 75); 
                this.rika.y = this.y; 
            }
            if (this.rika.frame <= 0) this.rika.active = false;
        }

        // Geto Projectile Logic
        this.getoProjs = this.getoProjs.filter(p => {
            p.x += p.vx;
            let hitTarget = Math.abs(p.x - (opp.x + 20)) < 48 && Math.abs(p.y - (opp.y - 45)) < 80;
            if (hitTarget && !opp.inShadow) {
                opp.hp -= 32; opp.stun = 28; return false;
            }
            return p.x > -200 && p.x < canvas.width + 200;
        });

        // Effect & Beam Damage Logic
        let isBeaming = (this.fx > 0 && (this.k === 'Ryu' || this.k === 'Yuta'));
        if (this.fx > 0) {
            this.fx--;
            if (!opp.inShadow) {
                let d = Math.abs(this.x - opp.x);
                if (this.k === 'Sukuna' && d < 210) { opp.hp -= 3.5; opp.stun = 5; }
                if (this.k === 'Itadori' && d < 85) { opp.hp -= 85; opp.stun = 55; this.fx = 0; }
                if (this.k === 'Naoya' && d < 95) { opp.stun = 110; this.fx = 0; }
                if (this.k === 'Nanami' && d < 90) { opp.hp -= 65; opp.silence = 250; this.fx = 0; }
                if ((this.k === 'Toji' || this.k === 'Maki') && d < 115) { 
                    opp.hp -= 8; opp.stun = 18; opp.vx = this.dir * 32; 
                }
                
                // Beam specific collision
                if (isBeaming) {
                    let vMatch = Math.abs((this.y - 35) - (opp.y - 45)) < 70;
                    let frontal = (this.dir === 1) ? (opp.x > this.x) : (opp.x < this.x);
                    let inRange = (opp.x + 20) > Math.min(this.x, this.x + (this.dir * 2500)) && (opp.x + 20) < Math.max(this.x, this.x + (this.dir * 2500));
                    let clash = (p1.fx > 0 && p2.fx > 0 && 
                                (p1.k === 'Ryu' || p1.k === 'Yuta') && 
                                (p2.k === 'Ryu' || p2.k === 'Yuta') && 
                                Math.abs(p1.y - p2.y) < 60);
                    if (vMatch && frontal && inRange && !clash) { opp.hp -= 1.75; opp.stun = 5; }
                }
            }
        }

        // Universal Projectile Collision
        if (this.proj.active) {
            this.proj.x += this.proj.vx;
            let pDistX = Math.abs(this.proj.x - (opp.x + 20));
            let pDistY = Math.abs(this.proj.y - 40 - (opp.y - 45));
            if (pDistX < 75 && pDistY < 115 && !opp.inShadow) {
                if (this.proj.type === 'NAIL') { opp.hp -= 42; opp.stun = 145; }
                else if (this.proj.type === 'PURPLE') { opp.hp -= 100; opp.stun = 90; }
                else if (this.proj.type === 'BLOOD') { opp.hp -= 38; opp.poison = 260; }
                this.proj.active = false;
            }
            if (this.proj.x < -600 || this.proj.x > canvas.width + 600) this.proj.active = false;
        }

        // Physical Engine
        if (isBeaming) {
            this.vx = 0; this.vy = 0;
        } else if (this.stun <= 0) {
            let speedMod = this.inShadow ? 1.75 : 1.0;
            let moveSpd = this.s.s * speedMod;
            
            if (this.pNum === 1) {
                if (held.p1L) { this.vx = -moveSpd; this.dir = -1; }
                if (held.p1R) { this.vx = moveSpd; this.dir = 1; }
            } else if (!this.cpu) {
                if (held.p2L) { this.vx = -moveSpd; this.dir = -1; }
                if (held.p2R) { this.vx = moveSpd; this.dir = 1; }
            }
        }

        // Apply velocities
        this.x += this.vx; this.y += this.vy;
        this.vx *= 0.83; // Friction
        
        // Wall Constraints
        if (this.x < 0) this.x = 0;
        if (this.x > canvas.width - 50) this.x = canvas.width - 50;

        // Floor Logic & Gravity
        let ground = canvas.height - 110;
        if (!isBeaming) {
            if (this.y < ground) {
                this.vy += 0.95;
            } else { 
                this.y = ground; 
                this.vy = 0; 
            }
        }

        // Timer Decrements
        if (this.jackpot > 0) {
            this.jackpot--;
            if (this.hp < 300) this.hp += 0.8; 
        }
        if (this.stun > 0) this.stun--;
        if (this.spT > 0) this.spT--;
        if (this.m1T > 0) this.m1T--;
        if (this.silence > 0) this.silence--;

        // AI Tick Logic
        if (this.cpu) this.ai(opp);
    }

    atk(opp) {
        if (this.stun > 0 || this.m1T > 0 || this.silence > 0 || (this.fx > 0 && (this.k === 'Ryu' || this.k === 'Yuta'))) return;
        this.m1T = 20;
        let distH = Math.abs(this.x - opp.x);
        let distV = Math.abs(this.y - opp.y);
        
        if (distH < 100 && distV < 120 && !opp.inShadow) {
            if (this.inShadow) { 
                opp.hp -= (this.s.d + 30); opp.stun = 80; this.inShadow = false; 
            } else { 
                opp.hp -= this.s.d; opp.stun = 18; 
            }
            opp.vx = this.dir * 9;
        } else if (this.inShadow) {
            this.inShadow = false;
        }
    }

    ai(opp) {
        if (this.stun > 0 || (this.fx > 0 && (this.k === 'Ryu' || this.k === 'Yuta'))) return;
        
        let d = Math.abs(this.x - opp.x);
        // Correct facing direction
        this.dir = (opp.x < this.x) ? -1 : 1;

        // Tracking logic
        if (d > 165) {
            this.vx = (opp.x < this.x) ? -this.s.s : this.s.s;
        } else if (d < 50) {
            this.vx = (opp.x < this.x) ? this.s.s : -this.s.s;
        }

        // Intelligent Jumping (Evasion)
        if (this.y >= canvas.height - 110) {
            let needsJump = (opp.y < this.y - 80) || (opp.proj.active && Math.abs(opp.proj.x - this.x) < 260);
            if (needsJump && Math.random() < 0.25) {
                this.vy = -20;
            }
        }

        // Combat triggers
        if (d < 118 && Math.random() < 0.13) {
            this.atk(opp);
        }
        
        // Special Ability triggers
        if (this.spT === 0 && Math.random() < 0.03) {
            this.spec(opp);
        }
    }
}

// PC KEYBOARD INPUT LISTENERS
window.addEventListener('keydown', e => {
    if (!active || paused) return;
    
    // Player 1: WASD / F (Atk) / G (Spec)
    if (e.code === 'KeyA') held.p1L = true;
    if (e.code === 'KeyD') held.p1R = true;
    if (e.code === 'KeyW' && p1.vy === 0) p1.vy = -20;
    if (e.code === 'KeyF') p1.atk(p2);
    if (e.code === 'KeyG') p1.spec(p2);

    // Player 2: Arrows / K (Atk) / L (Spec)
    if (e.code === 'ArrowLeft') held.p2L = true;
    if (e.code === 'ArrowRight') held.p2R = true;
    if (e.code === 'ArrowUp' && p2.vy === 0) p2.vy = -20;
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

// Menu Navigation System
function initMode(m) {
    mode = m; p1C = null; p2C = null;
    document.getElementById('m-start').style.display = 'none';
    document.getElementById('m-char').style.display = 'block';
    updateDisplayTitle();
    
    const container = document.getElementById('char-grid');
    container.innerHTML = '';
    
    Object.keys(chars).forEach(name => {
        const charBtn = document.createElement('button');
        charBtn.innerText = name;
        charBtn.onpointerdown = (ev) => {
            ev.stopPropagation();
            if (!p1C) { 
                p1C = name; 
                if (mode === '1P') { 
                    const list = Object.keys(chars);
                    p2C = list[Math.floor(Math.random() * list.length)]; 
                    beginGameSession(); 
                } else updateDisplayTitle(); 
            } else if (mode === '2P' && !p2C) { 
                p2C = name; 
                beginGameSession(); 
            }
        };
        container.appendChild(charBtn);
    });
}

function updateDisplayTitle() {
    const title = document.getElementById('selection-title');
    if (!p1C) { 
        title.innerText = "PLAYER 1: SELECT YOUR SORCERER"; 
        title.style.color = "#0af"; 
    } else { 
        title.innerText = "PLAYER 2: SELECT YOUR SORCERER"; 
        title.style.color = "#f33"; 
    }
}

function beginGameSession() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    p1 = new Sorcerer(150, canvas.height - 110, p1C, 1, false);
    p2 = new Sorcerer(canvas.width - 250, canvas.height - 110, p2C, 2, (mode === '1P'));
    
    document.getElementById('menu').classList.remove('active-menu');
    document.getElementById('pause-btn').style.display = 'block';
    document.getElementById('controls').style.display = 'block';
    
    if (mode === '2P') {
        document.getElementById('p2-pad').style.display = 'block';
    }
    
    active = true;
    requestAnimationFrame(mainLoop);
}

function mainLoop() {
    if (!active) return;
    
    if (!paused) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Logical Update
        p1.update(p2);
        p2.update(p1);
        
        // Graphical Draw
        p1.draw();
        p2.draw();
        
        // Interface Synchronization
        syncInterface();

        if (p1.hp <= 0 || p2.hp <= 0) {
            active = false;
            triggerEndScreen(p1.hp <= 0 ? "PLAYER 2" : "PLAYER 1");
        }
    }
    requestAnimationFrame(mainLoop);
}

function syncInterface() {
    document.getElementById('p1-hp').style.width = (p1.hp / 3) + '%';
    document.getElementById('p1-cd').style.width = ((450 - p1.spT) / 4.5) + '%';
    document.getElementById('p1-stun').innerText = p1.stun > 0 ? "STUNNED" : (p1.silence > 0 ? "SILENCED" : "");
    
    document.getElementById('p2-hp').style.width = (p2.hp / 3) + '%';
    document.getElementById('p2-cd').style.width = ((450 - p2.spT) / 4.5) + '%';
    document.getElementById('p2-stun').innerText = p2.stun > 0 ? "STUNNED" : (p2.silence > 0 ? "SILENCED" : "");
}

function triggerEndScreen(winner) {
    const endBox = document.getElementById('win-screen');
    const endText = document.getElementById('win-text');
    endText.innerText = winner + " WINS"; 
    endText.style.color = (winner === "PLAYER 1") ? "#0af" : "#f33";
    endBox.classList.add('active-menu');
}

function togglePause() {
    if (!active) return;
    paused = !paused;
    const overlay = document.getElementById('pause-screen');
    if (paused) {
        overlay.classList.add('active-menu');
    } else {
        overlay.classList.remove('active-menu');
    }
}

// Touch Event Infrastructure
window.addEventListener('touchstart', event => {
    if (event.target.tagName !== 'BUTTON') event.preventDefault();
    [...event.touches].forEach(t => {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (!el || !el.dataset.v) return;
        
        const owner = el.dataset.p;
        const self = (owner === '1') ? p1 : p2;
        const enemy = (owner === '1') ? p2 : p1;
        const beamLock = (self.fx > 0 && (self.k === 'Ryu' || self.k === 'Yuta'));
        
        if (el.dataset.v === 'l') held['p' + owner + 'L'] = true;
        if (el.dataset.v === 'r') held['p' + owner + 'R'] = true;
        if (el.dataset.v === 'u' && self.vy === 0 && !beamLock) self.vy = -20;
        if (el.dataset.v === 'a') self.atk(enemy);
        if (el.dataset.v === 's') self.spec(enemy);
    });
}, { passive: false });

window.addEventListener('touchend', event => {
    // Reset inputs, then recalculate from remaining touches
    held.p1L = held.p1R = held.p2L = held.p2R = false;
    [...event.touches].forEach(t => {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (el && el.dataset.v === 'l') held['p' + el.dataset.p + 'L'] = true;
        if (el && el.dataset.v === 'r') held['p' + el.dataset.p + 'R'] = true;
    });
});

window.onresize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
};
