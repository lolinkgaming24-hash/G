/**
 * JUJUTSU SHOWDOWN - CORE ENGINE v2.9 (FINAL STABILITY PATCH)
 * ---------------------------------------------------------
 * CORE FIXES:
 * 1. YUTA COOLDOWN LOCK: Fixed the 'Race Condition' where spT wouldn't trigger.
 * 2. MEGUMI SHADOW: Hard 180-frame (3s) limit with 35% opacity.
 * 3. HAKARI JACKPOT: Explicit 1/3 (33%) probability calculation.
 * 4. PC/MOBILE SYNC: Full keyboard mapping (WASD/Arrows) + 85px Touch Controls.
 * 5. ENGINE: Expanded collision resolution and state-handling for 430+ lines.
 * ---------------------------------------------------------
 */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let mode = '1P';
let p1, p2;
let p1C = null, p2C = null;
let active = false;
let paused = false;

// Global Input State
const held = {
    p1L: false, p1R: false,
    p2L: false, p2R: false
};

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
        
        // State Timers
        this.m1T = 0;       
        this.spT = 0;       
        this.fx = 0;        
        this.stun = 0;      
        this.silence = 0;   
        this.poison = 0;    
        this.shadowTimer = 0; 
        
        // Summons and Projectiles
        this.proj = { active: false, x: 0, y: 0, vx: 0, type: '' };
        this.getoProjs = [];
        this.rika = { active: false, x: 0, y: 0, frame: 0, type: '' };
        
        this.jackpot = 0;
        this.frame = 0;
        this.inShadow = false;
    }

    draw() {
        ctx.save();
        this.frame++;
        let cx = this.x + 20;
        let cy = this.y;

        // Shake if stunned
        if (this.stun > 0) ctx.translate(Math.random() * 8 - 4, 0);

        // --- MEGUMI VISUALS ---
        if (this.inShadow) {
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.beginPath();
            ctx.ellipse(cx, canvas.height - 108, 50, 15, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.35; // The requested visibility
        }

        // --- RIKA VISUALS ---
        if (this.rika.active) {
            ctx.save();
            ctx.fillStyle = '#555'; 
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#000';
            let rx = this.rika.x;
            let ry = this.rika.y;
            ctx.beginPath();
            ctx.ellipse(rx, ry - 80, 35, 110, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(rx + (this.dir * 10), ry - 130, 7, 0, Math.PI * 2);
            ctx.fill();
            if (this.rika.type === 'PUNCH') {
                ctx.strokeStyle = '#222';
                ctx.lineWidth = 18;
                ctx.beginPath();
                ctx.moveTo(rx, ry - 65);
                ctx.lineTo(rx + (this.dir * 110), ry - 65);
                ctx.stroke();
            }
            ctx.restore();
        }

        // --- SPECIAL FX RENDERING ---
        if (this.fx > 0) {
            ctx.save();
            ctx.shadowBlur = 25;
            ctx.shadowColor = this.s.c;
            if (this.k === 'Sukuna') {
                ctx.strokeStyle = '#f22';
                ctx.lineWidth = 2;
                for (let i = 0; i < 7; i++) {
                    ctx.beginPath();
                    let ox = Math.random() * 200 * this.dir;
                    ctx.moveTo(cx + ox, cy - 140);
                    ctx.lineTo(cx + ox + 40, cy + 40);
                    ctx.stroke();
                }
            }
            if (this.k === 'Ryu' || this.k === 'Yuta') {
                ctx.fillStyle = this.s.c;
                ctx.globalAlpha = 0.65;
                let bY = this.y - 54;
                let clashing = (p1.fx > 0 && p2.fx > 0 && 
                               (p1.k === 'Ryu' || p1.k === 'Yuta') && 
                               (p2.k === 'Ryu' || p2.k === 'Yuta') && 
                               Math.abs(p1.y - p2.y) < 60);
                let bLen = clashing ? Math.abs(canvas.width / 2 - cx) : 2600;
                ctx.fillRect(cx, bY, bLen * this.dir, 40);
                if (clashing) {
                    ctx.globalAlpha = 1; ctx.fillStyle = "#fff";
                    ctx.beginPath(); ctx.arc(canvas.width / 2, bY + 20, 35 + Math.random() * 20, 0, 7); ctx.fill();
                }
            }
            ctx.restore();
        }

        this.getoProjs.forEach(p => {
            ctx.fillStyle = '#e11';
            ctx.fillRect(p.x - 24, p.y - 14, 48, 28);
        });

        if (this.proj.active) {
            ctx.save();
            ctx.fillStyle = (this.k === 'Gojo') ? '#a0f' : this.s.c;
            ctx.shadowBlur = 30;
            if (this.proj.type === 'NAIL') ctx.fillRect(this.proj.x, this.proj.y - 45, 28 * this.dir, 8);
            else { 
                ctx.beginPath(); 
                let sz = (this.proj.type === 'PURPLE') ? 60 : 25; 
                ctx.arc(this.proj.x, this.proj.y - 45, sz, 0, Math.PI * 2); 
                ctx.fill(); 
            }
            ctx.restore();
        }

        // --- STICK FIGURE BODY ---
        ctx.strokeStyle = (this.jackpot > 0) ? '#0f0' : this.s.c;
        ctx.lineWidth = 5;
        if (this.poison > 0) ctx.strokeStyle = '#a0f';
        if (this.silence > 0) ctx.strokeStyle = '#333';
        
        ctx.beginPath(); ctx.arc(cx, cy - 90, 16, 0, 7); ctx.stroke(); 
        ctx.beginPath(); ctx.moveTo(cx, cy - 74); ctx.lineTo(cx, cy - 35); ctx.stroke(); 
        let armY = (this.m1T > 0 || this.fx > 0) ? cy - 45 : cy - 65;
        ctx.beginPath(); ctx.moveTo(cx, cy - 68); ctx.lineTo(cx + (this.dir * 35), armY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - 68); ctx.lineTo(cx - (this.dir * 25), cy - 55); ctx.stroke();
        let legW = (Math.abs(this.vx) > 0.2) ? Math.sin(this.frame * 0.3) * 20 : 12;
        ctx.beginPath(); ctx.moveTo(cx, cy - 35); ctx.lineTo(cx + legW, cy); ctx.stroke(); 
        ctx.beginPath(); ctx.moveTo(cx, cy - 35); ctx.lineTo(cx - legW, cy); ctx.stroke();
        ctx.restore();
    }

    spec(opp) {
        if (this.spT > 0 || this.stun > 0 || this.silence > 0) return;
        
        // --- MANDATORY COOLDOWN ASSIGNMENT (THE YUTA FIX) ---
        // By setting the cooldown here, before the switch, it cannot be skipped.
        this.spT = 600; 
        
        switch(this.k) {
            case 'Nobara': 
                this.proj = { active: true, x: this.x, y: this.y, vx: this.dir * 28, type: 'NAIL' }; 
                this.spT = 450; break;
            case 'Hakari': 
                if (Math.random() < 0.33) this.jackpot = 700; // 33% Jackpot
                this.spT = 420; break;
            case 'Gojo': 
                this.proj = { active: true, x: this.x, y: this.y, vx: this.dir * 9.5, type: 'PURPLE' }; 
                this.spT = 680; break;
            case 'Sukuna': this.fx = 60; this.spT = 500; break;
            case 'Itadori': this.vx = this.dir * 48; this.fx = 30; this.spT = 550; break;
            case 'Todo': 
                let tX = this.x; this.x = opp.x; opp.x = tX; 
                opp.stun = 55; this.spT = 550; break;
            case 'Choso': 
                this.proj = { active: true, x: this.x, y: this.y, vx: this.dir * 35, type: 'BLOOD' }; 
                this.spT = 480; break;
            case 'Nanami': this.vx = this.dir * 40; this.fx = 25; this.spT = 520; break;
            case 'Megumi': 
                this.inShadow = true; this.shadowTimer = 180; // 3 seconds
                this.spT = 650; break;
            case 'Naoya': this.vx = this.dir * 70; this.fx = 45; this.spT = 580; break;
            case 'Geto': 
                this.getoProjs = [
                    {x:this.x,y:this.y-100,vx:this.dir*10},
                    {x:this.x,y:this.y-50,vx:this.dir*10},
                    {x:this.x,y:this.y,vx:this.dir*10}
                ]; this.spT = 600; break;
            case 'Ryu': 
                this.fx = 150; this.spT = (opp.k === 'Yuta') ? 500 : 980; break;
            case 'Yuta': 
                this.spT = 720; // Explicitly ensure Yuta has his cooldown
                if (opp.k === 'Ryu') {
                    this.fx = 150; 
                    this.rika = { active: true, x: this.x - (this.dir * 80), y: this.y, frame: 150, type: 'BEAM' };
                } else {
                    this.rika = { active: true, x: this.x + (this.dir * 55), y: this.y, frame: 70, type: 'PUNCH' };
                }
                break;
            case 'Toji': 
            case 'Maki': this.vx = this.dir * 58; this.fx = 35; this.spT = 450; break;
        }
    }

    update(opp) {
        if (!active || paused) return;

        // Health/Status Processing
        if (this.poison > 0) { 
            this.poison--; 
            if (this.poison % 60 === 0) this.hp -= 5; 
        }

        // Megumi 3s Rule
        if (this.inShadow) {
            this.shadowTimer--;
            if (this.shadowTimer <= 0) this.inShadow = false;
        }

        // Rika Minion Management
        if (this.rika.active) {
            this.rika.frame--;
            if (this.rika.type === 'PUNCH' && !opp.inShadow) {
                if (Math.abs(this.rika.x - opp.x) < 110) { 
                    opp.hp -= 55; opp.stun = 125; opp.vx = this.dir * 35; 
                }
            } else { 
                this.rika.x = this.x - (this.dir * 80); 
                this.rika.y = this.y; 
            }
            if (this.rika.frame <= 0) this.rika.active = false;
        }

        // Geto Projectile Logic
        this.getoProjs = this.getoProjs.filter(p => {
            p.x += p.vx;
            if (Math.abs(p.x - (opp.x + 20)) < 50 && Math.abs(p.y - (opp.y - 45)) < 85 && !opp.inShadow) {
                opp.hp -= 35; opp.stun = 30; return false;
            }
            return p.x > -300 && p.x < canvas.width + 300;
        });

        // Beam & Special Hitbox
        let isBeaming = (this.fx > 0 && (this.k === 'Ryu' || this.k === 'Yuta'));
        if (this.fx > 0) {
            this.fx--;
            if (!opp.inShadow) {
                let d = Math.abs(this.x - opp.x);
                if (this.k === 'Sukuna' && d < 220) { opp.hp -= 3.8; opp.stun = 5; }
                if (this.k === 'Itadori' && d < 90) { opp.hp -= 90; opp.stun = 60; this.fx = 0; }
                if (this.k === 'Naoya' && d < 100) { opp.stun = 115; this.fx = 0; }
                if (this.k === 'Nanami' && d < 95) { opp.hp -= 70; opp.silence = 260; this.fx = 0; }
                if ((this.k === 'Toji' || this.k === 'Maki') && d < 120) { 
                    opp.hp -= 9; opp.stun = 20; opp.vx = this.dir * 35; 
                }
                if (isBeaming) {
                    let vMatch = Math.abs((this.y - 40) - (opp.y - 50)) < 75;
                    let frontal = (this.dir === 1) ? (opp.x > this.x) : (opp.x < this.x);
                    let clash = (p1.fx > 0 && p2.fx > 0 && (p1.k === 'Ryu' || p1.k === 'Yuta') && (p2.k === 'Ryu' || p2.k === 'Yuta') && Math.abs(p1.y - p2.y) < 65);
                    if (vMatch && frontal && !clash) { opp.hp -= 1.8; opp.stun = 5; }
                }
            }
        }

        // Projectile Processing
        if (this.proj.active) {
            this.proj.x += this.proj.vx;
            if (Math.abs(this.proj.x - (opp.x + 20)) < 80 && Math.abs(this.proj.y - 45 - (opp.y - 50)) < 120 && !opp.inShadow) {
                if (this.proj.type === 'NAIL') { opp.hp -= 45; opp.stun = 150; }
                else if (this.proj.type === 'PURPLE') { opp.hp -= 110; opp.stun = 100; }
                else if (this.proj.type === 'BLOOD') { opp.hp -= 40; opp.poison = 280; }
                this.proj.active = false;
            }
            if (this.proj.x < -1000 || this.proj.x > canvas.width + 1000) this.proj.active = false;
        }

        // Movement Physics
        if (isBeaming) {
            this.vx = 0; this.vy = 0;
        } else if (this.stun <= 0) {
            let spdFactor = this.inShadow ? 1.8 : 1.0;
            let moveSpd = this.s.s * spdFactor;
            if (this.pNum === 1) {
                if (held.p1L) { this.vx = -moveSpd; this.dir = -1; }
                if (held.p1R) { this.vx = moveSpd; this.dir = 1; }
            } else if (!this.cpu) {
                if (held.p2L) { this.vx = -moveSpd; this.dir = -1; }
                if (held.p2R) { this.vx = moveSpd; this.dir = 1; }
            }
        }

        this.x += this.vx; this.y += this.vy;
        this.vx *= 0.85; 
        if (this.x < 0) this.x = 0;
        if (this.x > canvas.width - 50) this.x = canvas.width - 50;

        let ground = canvas.height - 110;
        if (!isBeaming) {
            if (this.y < ground) this.vy += 1.0;
            else { this.y = ground; this.vy = 0; }
        }

        // Regen and Timers
        if (this.jackpot > 0) {
            this.jackpot--;
            if (this.hp < 300) this.hp += 0.9; 
        }
        if (this.stun > 0) this.stun--;
        if (this.spT > 0) this.spT--;
        if (this.m1T > 0) this.m1T--;
        if (this.silence > 0) this.silence--;

        if (this.cpu) this.ai(opp);
    }

    atk(opp) {
        if (this.stun > 0 || this.m1T > 0 || this.silence > 0 || (this.fx > 0 && (this.k === 'Ryu' || this.k === 'Yuta'))) return;
        this.m1T = 20;
        if (Math.abs(this.x - opp.x) < 105 && Math.abs(this.y - opp.y) < 125 && !opp.inShadow) {
            if (this.inShadow) { 
                opp.hp -= (this.s.d + 35); opp.stun = 90; this.inShadow = false; 
            } else { 
                opp.hp -= this.s.d; opp.stun = 20; 
            }
            opp.vx = this.dir * 10;
        } else if (this.inShadow) this.inShadow = false;
    }

    ai(opp) {
        if (this.stun > 0 || (this.fx > 0 && (this.k === 'Ryu' || this.k === 'Yuta'))) return;
        let d = Math.abs(this.x - opp.x);
        this.dir = (opp.x < this.x) ? -1 : 1;
        if (d > 170) this.vx = (opp.x < this.x) ? -this.s.s : this.s.s;
        else if (d < 55) this.vx = (opp.x < this.x) ? this.s.s : -this.s.s;
        if (this.y >= canvas.height - 110) {
            if ((opp.y < this.y - 90) || (opp.proj.active && Math.abs(opp.proj.x - this.x) < 280)) {
                if (Math.random() < 0.2) this.vy = -22;
            }
        }
        if (d < 120 && Math.random() < 0.15) this.atk(opp);
        if (this.spT === 0 && Math.random() < 0.04) this.spec(opp);
    }
}

// KEYBOARD HANDLING
window.addEventListener('keydown', e => {
    if (!active || paused) return;
    if (e.code === 'KeyA') held.p1L = true;
    if (e.code === 'KeyD') held.p1R = true;
    if (e.code === 'KeyW' && p1.vy === 0) p1.vy = -22;
    if (e.code === 'KeyF') p1.atk(p2);
    if (e.code === 'KeyG') p1.spec(p2);
    if (e.code === 'ArrowLeft') held.p2L = true;
    if (e.code === 'ArrowRight') held.p2R = true;
    if (e.code === 'ArrowUp' && p2.vy === 0) p2.vy = -22;
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

// UI FLOW
function initMode(m) {
    mode = m; p1C = null; p2C = null;
    document.getElementById('m-start').style.display = 'none';
    document.getElementById('m-char').style.display = 'block';
    const container = document.getElementById('char-grid');
    container.innerHTML = '';
    Object.keys(chars).forEach(name => {
        const btn = document.createElement('button');
        btn.innerText = name;
        btn.onpointerdown = (ev) => {
            ev.stopPropagation();
            if (!p1C) { 
                p1C = name; 
                if (mode === '1P') { 
                    const list = Object.keys(chars);
                    p2C = list[Math.floor(Math.random() * list.length)]; 
                    startMatch(); 
                }
            } else if (mode === '2P' && !p2C) { 
                p2C = name; 
                startMatch(); 
            }
        };
        container.appendChild(btn);
    });
}

function startMatch() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    p1 = new Sorcerer(200, canvas.height - 110, p1C, 1, false);
    p2 = new Sorcerer(canvas.width - 300, canvas.height - 110, p2C, 2, (mode === '1P'));
    document.getElementById('menu').classList.remove('active-menu');
    document.getElementById('pause-btn').style.display = 'block';
    document.getElementById('controls').style.display = 'block';
    if (mode === '2P') document.getElementById('p2-pad').style.display = 'block';
    active = true;
    requestAnimationFrame(gameLoop);
}

function gameLoop() {
    if (!active) return;
    if (!paused) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        p1.update(p2); p2.update(p1);
        p1.draw(); p2.draw();
        updateHUD();
        if (p1.hp <= 0 || p2.hp <= 0) {
            active = false;
            endGame(p1.hp <= 0 ? "PLAYER 2" : "PLAYER 1");
        }
    }
    requestAnimationFrame(gameLoop);
}

function updateHUD() {
    document.getElementById('p1-hp').style.width = (p1.hp / 3) + '%';
    document.getElementById('p1-cd').style.width = ((600 - p1.spT) / 6) + '%';
    document.getElementById('p1-stun').innerText = p1.stun > 0 ? "STUNNED" : (p1.silence > 0 ? "SILENCED" : "");
    document.getElementById('p2-hp').style.width = (p2.hp / 3) + '%';
    document.getElementById('p2-cd').style.width = ((600 - p2.spT) / 6) + '%';
    document.getElementById('p2-stun').innerText = p2.stun > 0 ? "STUNNED" : (p2.silence > 0 ? "SILENCED" : "");
}

function endGame(winner) {
    const endBox = document.getElementById('win-screen');
    const endText = document.getElementById('win-text');
    endText.innerText = winner + " WINS"; 
    endBox.classList.add('active-menu');
}

function togglePause() {
    if (!active) return;
    paused = !paused;
    const overlay = document.getElementById('pause-screen');
    if (paused) overlay.classList.add('active-menu');
    else overlay.classList.remove('active-menu');
}

// MOBILE TOUCH
window.addEventListener('touchstart', ev => {
    if (ev.target.tagName !== 'BUTTON') ev.preventDefault();
    [...ev.touches].forEach(t => {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (!el || !el.dataset.v) return;
        const p = el.dataset.p, s = (p === '1') ? p1 : p2, e = (p === '1') ? p2 : p1;
        if (el.dataset.v === 'l') held['p' + p + 'L'] = true;
        if (el.dataset.v === 'r') held['p' + p + 'R'] = true;
        if (el.dataset.v === 'u' && s.vy === 0) s.vy = -22;
        if (el.dataset.v === 'a') s.atk(e);
        if (el.dataset.v === 's') s.spec(e);
    });
}, { passive: false });

window.addEventListener('touchend', () => {
    held.p1L = held.p1R = held.p2L = held.p2R = false;
});

window.onresize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
};
