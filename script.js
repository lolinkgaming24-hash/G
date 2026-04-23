/**
 * JUJUTSU SHOWDOWN - CORE ENGINE v7.0 (THE "TURN-BASED SELECTION" PATCH)
 * ---------------------------------------------------------
 * FINAL SPECIFICATIONS:
 * 1. SELECTION UI: Explicitly states "PLAYER 1" or "PLAYER 2" turn.
 * 2. RYU NERF: Beam damage reduced to 1.2/tick. Refill is 0.5x vs non-Yuta.
 * 3. REFILL LOGIC: All characters start at 0% and fill UP to 100%.
 * 4. MEGUMI CAP: 180 frames (3s) max in shadow.
 * 5. HAKARI: 33% Jackpot chance.
 * ---------------------------------------------------------
 */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let mode = '1P';
let p1, p2;
let p1C = null, p2C = null;
let active = false;
let paused = false;
let selectionTurn = 1; // Tracks whose turn it is to pick

const held = { p1L: false, p1R: false, p2L: false, p2R: false };

const chars = {
    'Gojo':    { c: '#ffffff', d: 7,   s: 7  },
    'Sukuna':  { c: '#ff3333', d: 8,   s: 7  },
    'Itadori': { c: '#ffdd00', d: 11,  s: 8  },
    'Maki':    { c: '#44aa44', d: 12,  s: 10 },
    'Megumi':  { c: '#222222', d: 6,   s: 7  },
    'Yuta':    { c: '#ff00ff', d: 8,   s: 7  },
    'Ryu':     { c: '#00ccff', d: 7.2, s: 5.5 }, // Balanced Damage
    'Naoya':   { c: '#ddffdd', d: 7,   s: 12 },
    'Nobara':  { c: '#ff66aa', d: 8,   s: 6  },
    'Toji':    { c: '#777777', d: 14,  s: 9  },
    'Todo':    { c: '#885533', d: 10,  s: 8  },
    'Geto':    { c: '#444422', d: 8,   s: 6  },
    'Choso':   { c: '#aa4444', d: 7,   s: 7  },
    'Hakari':  { c: '#eeeeee', d: 9,   s: 8  },
    'Nanami':  { c: '#eeee00', d: 13,  s: 7  }
};

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
        this.spT = 0; // Starts at 0, fills UP
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
        this.frame = 0; 
    }

    draw() {
        ctx.save();
        this.frame++;
        let cx = this.x + 20, cy = this.y;
        if (this.stun > 0) ctx.translate(Math.random() * 4 - 2, 0);

        if (this.inShadow) {
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.beginPath();
            ctx.ellipse(cx, canvas.height - 108, 55, 18, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.35; 
        }

        if (this.rika.active) this.renderRika();
        this.renderProjectiles();
        this.renderSpecialFX(cx, cy);
        this.renderModel(cx, cy);
        ctx.restore();
    }

    renderRika() {
        ctx.save();
        ctx.fillStyle = '#444'; 
        let rx = this.rika.x, ry = this.rika.y;
        ctx.beginPath(); ctx.ellipse(rx, ry - 80, 42, 115, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(rx + (this.dir * 12), ry - 132, 7, 0, 7); ctx.fill();
        if (this.rika.type === 'PUNCH') {
            ctx.strokeStyle = '#000'; ctx.lineWidth = 24;
            ctx.beginPath(); ctx.moveTo(rx, ry - 60); ctx.lineTo(rx + (this.dir * 120), ry - 60); ctx.stroke();
        }
        ctx.restore();
    }

    renderProjectiles() {
        this.getoProjs.forEach(p => {
            ctx.fillStyle = '#900'; ctx.fillRect(p.x - 20, p.y - 10, 40, 20);
        });
        if (this.proj.active) {
            ctx.save(); ctx.fillStyle = (this.k === 'Gojo') ? '#70e' : this.s.c;
            ctx.shadowBlur = 40;
            if (this.proj.type === 'NAIL') ctx.fillRect(this.proj.x, this.proj.y - 45, 35 * this.dir, 8);
            else { ctx.beginPath(); let r = (this.proj.type === 'PURPLE') ? 68 : 26; ctx.arc(this.proj.x, this.proj.y - 45, r, 0, 7); ctx.fill(); }
            ctx.restore();
        }
    }

    renderSpecialFX(cx, cy) {
        if (this.fx <= 0) return;
        ctx.save(); ctx.shadowBlur = 30; ctx.shadowColor = this.s.c;
        if (this.k === 'Sukuna') {
            ctx.strokeStyle = '#f33'; ctx.lineWidth = 2;
            for (let i = 0; i < 12; i++) {
                ctx.beginPath(); let ox = (Math.random() - 0.5) * 500;
                ctx.moveTo(cx + ox, cy - 150); ctx.lineTo(cx + ox + 40, cy + 50); ctx.stroke();
            }
        }
        if (this.k === 'Ryu' || this.k === 'Yuta') {
            ctx.fillStyle = this.s.c; ctx.globalAlpha = 0.5;
            let bY = this.y - 55, bH = 48;
            let clash = (p1.fx > 0 && p2.fx > 0 && (p1.k === 'Ryu' || p1.k === 'Yuta') && (p2.k === 'Ryu' || p2.k === 'Yuta') && Math.abs(p1.y - p2.y) < 60);
            let bL = clash ? Math.abs(canvas.width / 2 - cx) : 4000;
            ctx.fillRect(cx, bY, bL * this.dir, bH);
            if (clash) {
                ctx.globalAlpha = 1; ctx.fillStyle = "#fff";
                ctx.beginPath(); ctx.arc(canvas.width/2, bY + bH/2, 55, 0, 7); ctx.fill();
            }
        }
        ctx.restore();
    }

    renderModel(cx, cy) {
        ctx.strokeStyle = (this.jackpot > 0) ? '#0f0' : this.s.c; ctx.lineWidth = 6;
        if (this.poison > 0) ctx.strokeStyle = '#80f';
        if (this.silence > 0) ctx.strokeStyle = '#222';
        ctx.beginPath(); ctx.arc(cx, cy - 92, 17, 0, 7); ctx.stroke(); 
        ctx.beginPath(); ctx.moveTo(cx, cy - 75); ctx.lineTo(cx, cy - 35); ctx.stroke(); 
        let aY = (this.m1T > 0 || this.fx > 0) ? cy - 40 : cy - 60;
        ctx.beginPath(); ctx.moveTo(cx, cy - 70); ctx.lineTo(cx + (this.dir * 35), aY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - 70); ctx.lineTo(cx - (this.dir * 25), cy - 55); ctx.stroke();
        let lW = (Math.abs(this.vx) > 0.1) ? Math.sin(this.frame * 0.4) * 22 : 14;
        ctx.beginPath(); ctx.moveTo(cx, cy - 35); ctx.lineTo(cx + lW, cy); ctx.stroke(); 
        ctx.beginPath(); ctx.moveTo(cx, cy - 35); ctx.lineTo(cx - lW, cy); ctx.stroke();
    }

    update(opp) {
        if (!active || paused) return;
        if (this.poison > 0) { this.poison--; if (this.poison % 60 === 0) this.hp -= 5; }
        if (this.jackpot > 0) { this.jackpot--; if (this.hp < 300) this.hp += 0.8; }
        if (this.inShadow) { this.shadowTimer--; if (this.shadowTimer <= 0) this.inShadow = false; }

        if (this.spT < this.spMax) {
            let rate = 1.0;
            if (this.k === 'Ryu' && opp.k !== 'Yuta') rate = 0.5; // RYU SLOW REFILL
            this.spT += rate;
        }

        this.handleProjs(opp);
        this.handleSpecials(opp);
        this.handleMovement();

        if (this.rika.active) {
            this.rika.frame--;
            if (this.rika.type === 'PUNCH' && !opp.inShadow) {
                if (Math.abs(this.rika.x - opp.x) < 120) { opp.hp -= 45; opp.stun = 110; opp.vx = this.dir * 30; }
            } else { this.rika.x = this.x - (this.dir * 90); this.rika.y = this.y; }
            if (this.rika.frame <= 0) this.rika.active = false;
        }

        if (this.stun > 0) this.stun--;
        if (this.m1T > 0) this.m1T--;
        if (this.silence > 0) this.silence--;
        if (this.cpu) this.ai(opp);
    }

    handleProjs(opp) {
        this.getoProjs = this.getoProjs.filter(p => {
            p.x += p.vx;
            if (Math.abs(p.x - (opp.x + 20)) < 60 && Math.abs(p.y - (opp.y - 40)) < 80 && !opp.inShadow) {
                opp.hp -= 32; opp.stun = 30; return false;
            } return p.x > -400 && p.x < canvas.width + 400;
        });
        if (this.proj.active) {
            this.proj.x += this.proj.vx;
            if (Math.abs(this.proj.x - (opp.x + 20)) < 75 && Math.abs(this.proj.y - 45 - (opp.y - 45)) < 110 && !opp.inShadow) {
                if (this.proj.type === 'NAIL') { opp.hp -= 42; opp.stun = 140; }
                else if (this.proj.type === 'PURPLE') { opp.hp -= 110; opp.stun = 90; }
                else if (this.proj.type === 'BLOOD') { opp.hp -= 38; opp.poison = 300; }
                this.proj.active = false;
            } if (this.proj.x < -800 || this.proj.x > canvas.width + 800) this.proj.active = false;
        }
    }

    handleSpecials(opp) {
        if (this.fx > 0) {
            this.fx--; if (opp.inShadow) return;
            let d = Math.abs(this.x - opp.x);
            if (this.k === 'Sukuna' && d < 240) { opp.hp -= 3.5; opp.stun = 4; }
            if (this.k === 'Itadori' && d < 100) { opp.hp -= 90; opp.stun = 60; this.fx = 0; }
            if (this.k === 'Nanami' && d < 100) { opp.hp -= 65; opp.silence = 250; this.fx = 0; }
            if ((this.k === 'Toji' || this.k === 'Maki') && d < 130) { opp.hp -= 8; opp.stun = 24; opp.vx = this.dir * 32; }
            if (this.k === 'Ryu' || this.k === 'Yuta') {
                let vMatch = Math.abs((this.y - 40) - (opp.y - 50)) < 80;
                let face = (this.dir === 1) ? (opp.x > this.x) : (opp.x < this.x);
                if (vMatch && face) { opp.hp -= (this.k === 'Ryu' ? 1.2 : 1.8); opp.stun = 4; }
            }
        }
    }

    handleMovement() {
        let beam = (this.fx > 0 && (this.k === 'Ryu' || this.k === 'Yuta'));
        if (beam) { this.vx = 0; this.vy = 0; }
        else if (this.stun <= 0) {
            let spd = this.s.s * (this.inShadow ? 1.9 : 1.0);
            if (this.pNum === 1) {
                if (held.p1L) { this.vx = -spd; this.dir = -1; }
                if (held.p1R) { this.vx = spd; this.dir = 1; }
            } else if (!this.cpu) {
                if (held.p2L) { this.vx = -spd; this.dir = -1; }
                if (held.p2R) { this.vx = spd; this.dir = 1; }
            }
        }
        this.x += this.vx; this.y += this.vy; this.vx *= 0.85;
        if (this.x < 0) this.x = 0; if (this.x > canvas.width - 50) this.x = canvas.width - 50;
        let flr = canvas.height - 110;
        if (!beam) { if (this.y < flr) this.vy += 1.1; else { this.y = flr; this.vy = 0; } }
    }

    atk(opp) {
        if (this.stun > 0 || this.m1T > 0 || this.silence > 0) return;
        this.m1T = 20;
        if (Math.abs(this.x - opp.x) < 115 && Math.abs(this.y - opp.y) < 140 && !opp.inShadow) {
            if (this.inShadow) { opp.hp -= (this.s.d + 30); opp.stun = 85; this.inShadow = false; }
            else { opp.hp -= this.s.d; opp.stun = 18; }
            opp.vx = this.dir * 10;
        } else if (this.inShadow) this.inShadow = false;
    }

    spec(opp) {
        if (this.spT < this.spMax || this.stun > 0 || this.silence > 0) return;
        this.spT = 0; // RESET FROM 0
        switch(this.k) {
            case 'Nobara': this.proj = { active: true, x: this.x, y: this.y, vx: this.dir * 32, type: 'NAIL' }; break;
            case 'Hakari': if (Math.random() < 0.33) this.jackpot = 720; break;
            case 'Gojo': this.proj = { active: true, x: this.x, y: this.y, vx: this.dir * 12, type: 'PURPLE' }; break;
            case 'Sukuna': this.fx = 70; break;
            case 'Megumi': this.inShadow = true; this.shadowTimer = 180; break;
            case 'Ryu': this.fx = 160; break;
            case 'Yuta': 
                if (opp.k === 'Ryu') { this.fx = 160; this.rika = { active: true, x: this.x - (this.dir * 80), y: this.y, frame: 160, type: 'BEAM' }; }
                else { this.rika = { active: true, x: this.x + (this.dir * 60), y: this.y, frame: 75, type: 'PUNCH' }; }
                break;
            case 'Naoya': this.vx = this.dir * 72; this.fx = 45; break;
            case 'Todo': let t = this.x; this.x = opp.x; opp.x = t; opp.stun = 50; break;
            case 'Choso': this.proj = { active: true, x: this.x, y: this.y, vx: this.dir * 38, type: 'BLOOD' }; break;
            case 'Nanami': this.vx = this.dir * 42; this.fx = 28; break;
            case 'Geto': this.getoProjs = [{x:this.x,y:this.y-100,vx:this.dir*11},{x:this.x,y:this.y-50,vx:this.dir*11},{x:this.x,y:this.y,vx:this.dir*11}]; break;
            default: this.vx = this.dir * 55; this.fx = 35; break;
        }
    }

    ai(opp) {
        if (this.stun > 0) return;
        let d = Math.abs(this.x - opp.x);
        this.dir = (opp.x < this.x) ? -1 : 1;
        if (d > 190) this.vx = (opp.x < this.x) ? -this.s.s : this.s.s;
        else if (d < 50) this.vx = (opp.x < this.x) ? this.s.s : -this.s.s;
        if (this.y >= canvas.height - 115) {
            if (opp.y < this.y - 120 || (opp.proj.active && Math.abs(opp.proj.x - this.x) < 350)) {
                if (Math.random() < 0.12) this.vy = -23;
            }
        }
        if (d < 120 && Math.random() < 0.2) this.atk(opp);
        if (this.spT >= this.spMax && Math.random() < 0.04) this.spec(opp);
    }
}

// --- CHARACTER SELECTION UI ---

function initMode(m) {
    mode = m; p1C = null; p2C = null; selectionTurn = 1;
    document.getElementById('m-start').style.display = 'none';
    document.getElementById('m-char').style.display = 'block';
    updateSelectionText();
    const grid = document.getElementById('char-grid');
    grid.innerHTML = '';
    Object.keys(chars).forEach(name => {
        const b = document.createElement('button');
        b.innerText = name;
        b.onpointerdown = (ev) => {
            ev.stopPropagation();
            if (selectionTurn === 1) {
                p1C = name;
                if (mode === '1P') {
                    p2C = Object.keys(chars)[Math.floor(Math.random() * 15)];
                    launch();
                } else {
                    selectionTurn = 2;
                    updateSelectionText();
                }
            } else if (selectionTurn === 2) {
                p2C = name;
                launch();
            }
        };
        grid.appendChild(b);
    });
}

function updateSelectionText() {
    const title = document.querySelector('#m-char h2');
    title.innerText = `PLAYER ${selectionTurn}: SELECT YOUR SORCERER`;
}

function launch() {
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    p1 = new Sorcerer(200, canvas.height - 110, p1C, 1, false);
    p2 = new Sorcerer(canvas.width - 350, canvas.height - 110, p2C, 2, (mode === '1P'));
    document.getElementById('menu').classList.remove('active-menu');
    document.getElementById('pause-btn').style.display = 'block';
    document.getElementById('controls').style.display = 'block';
    if (mode === '2P') document.getElementById('p2-pad').style.display = 'block';
    active = true; requestAnimationFrame(mainLoop);
}

function mainLoop() {
    if (!active) return;
    if (!paused) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        p1.update(p2); p2.update(p1);
        p1.draw(); p2.draw();
        updateHUD();
        if (p1.hp <= 0 || p2.hp <= 0) { 
            active = false; 
            document.getElementById('win-text').innerText = (p1.hp <= 0 ? "PLAYER 2" : "PLAYER 1") + " WINS"; 
            document.getElementById('win-screen').classList.add('active-menu');
        }
    }
    requestAnimationFrame(mainLoop);
}

function updateHUD() {
    document.getElementById('p1-hp').style.width = (p1.hp / 3) + '%';
    document.getElementById('p1-cd').style.width = (p1.spT / p1.spMax * 100) + '%';
    document.getElementById('p2-hp').style.width = (p2.hp / 3) + '%';
    document.getElementById('p2-cd').style.width = (p2.spT / p2.spMax * 100) + '%';
}

window.addEventListener('keydown', e => {
    if (!active || paused) return;
    if (e.code === 'KeyA') held.p1L = true; if (e.code === 'KeyD') held.p1R = true;
    if (e.code === 'KeyW' && p1.vy === 0) p1.vy = -23;
    if (e.code === 'KeyF') p1.atk(p2); if (e.code === 'KeyG') p1.spec(p2);
    if (e.code === 'ArrowLeft') held.p2L = true; if (e.code === 'ArrowRight') held.p2R = true;
    if (e.code === 'ArrowUp' && p2.vy === 0) p2.vy = -23;
    if (e.code === 'KeyK') p2.atk(p1); if (e.code === 'KeyL') p2.spec(p1);
    if (e.code === 'Escape') togglePause();
});

window.addEventListener('keyup', e => {
    if (e.code === 'KeyA') held.p1L = false; if (e.code === 'KeyD') held.p1R = false;
    if (e.code === 'ArrowLeft') held.p2L = false; if (e.code === 'ArrowRight') held.p2R = false;
});

function togglePause() {
    if (!active) return;
    paused = !paused;
    const p = document.getElementById('pause-screen');
    if (paused) p.classList.add('active-menu');
    else p.classList.remove('active-menu');
}

window.addEventListener('touchstart', ev => {
    if (ev.target.tagName !== 'BUTTON') ev.preventDefault();
    [...ev.touches].forEach(t => {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (!el || !el.dataset.v) return;
        const p = el.dataset.p, s = (p === '1' ? p1 : p2), e = (p === '1' ? p2 : p1);
        if (el.dataset.v === 'l') held['p'+p+'L'] = true; if (el.dataset.v === 'r') held['p'+p+'R'] = true;
        if (el.dataset.v === 'u' && s.vy === 0) s.vy = -23;
        if (el.dataset.v === 'a') s.atk(e); if (el.dataset.v === 's') s.spec(e);
    });
}, { passive: false });
window.addEventListener('touchend', () => { held.p1L = held.p1R = held.p2L = held.p2R = false; });
