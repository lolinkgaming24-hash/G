/**
 * JUJUTSU SHOWDOWN - CORE ENGINE
 * Features: 
 * - Megumi Shadow Invincibility Logic
 * - Geto Rectangle Projectile Rendering
 * - Ryu/Yuta Beam Clashing & Frontal-Only Hitbox
 * - Ryu Double Cooldown Penalty (non-Yuta opponents)
 * - Advanced CPU AI with Jump/Turn capabilities
 */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let mode = '1P', p1, p2, p1C = null, p2C = null, active = false, paused = false;
const held = { p1L: false, p1R: false, p2L: false, p2R: false };

const chars = {
    'Gojo': { c: '#fff', d: 7, s: 7 },
    'Sukuna': { c: '#f33', d: 8, s: 7 },
    'Itadori': { c: '#fd0', d: 11, s: 8 },
    'Maki': { c: '#4a4', d: 12, s: 10 },
    'Megumi': { c: '#222', d: 6, s: 7 },
    'Yuta': { c: '#f0f', d: 8, s: 7 },
    'Ryu': { c: '#0cf', d: 9, s: 5 },
    'Naoya': { c: '#dfd', d: 7, s: 12 },
    'Nobara': { c: '#f6a', d: 8, s: 6 },
    'Toji': { c: '#777', d: 14, s: 9 },
    'Todo': { c: '#853', d: 10, s: 8 },
    'Geto': { c: '#442', d: 8, s: 6 },
    'Choso': { c: '#a44', d: 7, s: 7 },
    'Hakari': { c: '#eee', d: 9, s: 8 },
    'Nanami': { c: '#ee0', d: 13, s: 7 }
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
        this.m1T = 0;
        this.spT = 0;
        this.fx = 0;
        this.stun = 0;
        this.silence = 0;
        this.proj = { active: false, x: 0, y: 0, vx: 0, type: '' };
        this.getoProjs = [];
        this.rika = { active: false, x: 0, y: 0, frame: 0, type: '' };
        this.jackpot = 0;
        this.frame = 0;
        this.poison = 0;
        this.inShadow = false;
    }

    draw() {
        ctx.save();
        this.frame++;
        let cx = this.x + 20;
        let cy = this.y;

        // Apply Stun Shake
        if (this.stun > 0) {
            ctx.translate(Math.random() * 5 - 2.5, 0);
        }

        // Draw Megumi Shadow State
        if (this.inShadow) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.beginPath();
            ctx.ellipse(cx, canvas.height - 108, 45, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.1; // Virtually invisible
        }

        // Floor Line
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height - 108);
        ctx.lineTo(canvas.width, canvas.height - 108);
        ctx.stroke();

        // Rika Logic
        if (this.rika.active) {
            ctx.save();
            ctx.fillStyle = 'rgba(40, 5, 50, 0.85)';
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#f0f';
            let rx = this.rika.x;
            let ry = this.rika.y;
            ctx.beginPath();
            ctx.ellipse(rx, ry - 70, 55, 95, 0, 0, Math.PI * 2);
            ctx.fill();
            if (this.rika.type === 'PUNCH') {
                ctx.strokeStyle = '#111';
                ctx.lineWidth = 22;
                ctx.beginPath();
                ctx.moveTo(rx, ry - 60);
                ctx.lineTo(rx + (this.dir * 100), ry - 60);
                ctx.stroke();
            }
            ctx.restore();
        }

        // Special Effects Logic (Beams/Slashes)
        if (this.fx > 0) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.s.c;
            if (this.k === 'Sukuna') {
                ctx.strokeStyle = '#f00';
                ctx.lineWidth = 1.5;
                for (let i = 0; i < 4; i++) {
                    ctx.beginPath();
                    let ox = Math.random() * 160 * this.dir;
                    ctx.moveTo(cx + ox, cy - 110);
                    ctx.lineTo(cx + ox + 25, cy + 10);
                    ctx.stroke();
                }
            }
            if (this.k === 'Ryu' || this.k === 'Yuta') {
                ctx.fillStyle = this.s.c;
                ctx.globalAlpha = 0.5;
                let bY = this.y - 50;
                let clashing = (p1.fx > 0 && p2.fx > 0 && 
                               (p1.k === 'Ryu' || p1.k === 'Yuta') && 
                               (p2.k === 'Ryu' || p2.k === 'Yuta') && 
                               Math.abs(p1.y - p2.y) < 45);
                let bLen = clashing ? Math.abs(canvas.width / 2 - cx) : 2000;
                ctx.fillRect(cx, bY, bLen * this.dir, 32);
                if (clashing) {
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = "#fff";
                    ctx.shadowBlur = 40;
                    ctx.beginPath();
                    ctx.arc(canvas.width / 2, bY + 16, 20 + Math.random() * 15, 0, 7);
                    ctx.fill();
                }
            }
        }

        // Geto Rectangle Projectiles
        this.getoProjs.forEach(p => {
            ctx.fillStyle = '#f00';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#000';
            ctx.fillRect(p.x - 22, p.y - 12, 44, 24);
        });

        // Simple Projectiles
        if (this.proj.active) {
            ctx.fillStyle = (this.k === 'Gojo') ? '#a0f' : this.s.c;
            ctx.shadowBlur = 25;
            if (this.proj.type === 'NAIL') {
                ctx.fillRect(this.proj.x, this.proj.y - 40, 20 * this.dir, 5);
            } else {
                ctx.beginPath();
                let sz = (this.proj.type === 'PURPLE') ? 48 : 18;
                ctx.arc(this.proj.x, this.proj.y - 40, sz, 0, 7);
                ctx.fill();
            }
        }

        // Character Stick Figure
        ctx.strokeStyle = this.jackpot > 0 ? '#0f0' : this.s.c;
        ctx.lineWidth = 3.5;
        if (this.poison > 0) ctx.strokeStyle = '#90f';
        if (this.silence > 0) ctx.strokeStyle = '#444';

        ctx.beginPath(); ctx.arc(cx, cy - 85, 13, 0, 7); ctx.stroke(); 
        ctx.beginPath(); ctx.moveTo(cx, cy - 72); ctx.lineTo(cx, cy - 30); ctx.stroke(); 
        let armY = (this.m1T > 0 || this.fx > 0) ? cy - 45 : cy - 62;
        ctx.beginPath(); ctx.moveTo(cx, cy - 68); ctx.lineTo(cx + (this.dir * 28), armY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - 68); ctx.lineTo(cx - (this.dir * 18), cy - 52); ctx.stroke();
        let legW = (Math.abs(this.vx) > 0.1) ? Math.sin(this.frame * 0.22) * 14 : 6;
        ctx.beginPath(); ctx.moveTo(cx, cy - 30); ctx.lineTo(cx + legW, cy); ctx.stroke(); 
        ctx.beginPath(); ctx.moveTo(cx, cy - 30); ctx.lineTo(cx - legW, cy); ctx.stroke();
        ctx.restore();
    }

    spec(opp) {
        if (this.spT > 0 || this.stun > 0 || this.silence > 0) return;
        switch(this.k) {
            case 'Nobara': 
                this.proj = { active: true, x: this.x, y: this.y, vx: this.dir * 22, type: 'NAIL' }; 
                this.spT = 450; 
                break;
            case 'Hakari': 
                if (Math.random() < 0.45) this.jackpot = 650;
                this.spT = 400; 
                break;
            case 'Gojo': 
                this.proj = { active: true, x: this.x, y: this.y, vx: this.dir * 8, type: 'PURPLE' }; 
                this.spT = 550; 
                break;
            case 'Sukuna': 
                this.fx = 45; this.spT = 450; 
                break;
            case 'Itadori': 
                this.vx = this.dir * 38; this.fx = 25; this.spT = 480; 
                break;
            case 'Todo': 
                let tempX = this.x; this.x = opp.x; opp.x = tempX; 
                opp.stun = 40; this.spT = 500; 
                break;
            case 'Choso': 
                this.proj = { active: true, x: this.x, y: this.y, vx: this.dir * 28, type: 'BLOOD' }; 
                this.spT = 420; 
                break;
            case 'Nanami': 
                this.vx = this.dir * 35; this.fx = 18; this.spT = 450; 
                break;
            case 'Megumi': 
                this.inShadow = true; this.spT = 550; 
                break;
            case 'Naoya': 
                this.vx = this.dir * 58; this.fx = 38; this.spT = 500; 
                break;
            case 'Geto': 
                this.getoProjs = [
                    {x:this.x, y:this.y-90, vx:this.dir*8}, 
                    {x:this.x, y:this.y-45, vx:this.dir*8}, 
                    {x:this.x, y:this.y, vx:this.dir*8}
                ]; 
                this.spT = 500; 
                break;
            case 'Ryu': 
                this.fx = 135; 
                // Double Cooldown logic: If opponent is not Yuta, penalty applies
                this.spT = (opp.k === 'Yuta') ? 450 : 900; 
                break;
            case 'Yuta': 
                if (opp.k === 'Ryu') {
                    this.fx = 135; 
                    this.rika = { active: true, x: this.x - (this.dir * 65), y: this.y, frame: 135, type: 'BEAM' };
                } else {
                    this.rika = { active: true, x: this.x + (this.dir * 40), y: this.y, frame: 50, type: 'PUNCH' };
                }
                this.spT = 600; 
                break;
            case 'Toji': 
            case 'Maki': 
                this.vx = this.dir * 50; this.fx = 28; this.spT = 450; 
                break;
        }
    }

    update(opp) {
        if (!active || paused) return;
        if (this.poison > 0) { 
            this.poison--; 
            if (this.poison % 60 === 0) this.hp -= 3; 
        }

        // Rika Damage Logic
        if (this.rika.active) {
            this.rika.frame--;
            if (this.rika.type === 'PUNCH' && !opp.inShadow) {
                if (Math.abs(this.rika.x - opp.x) < 85) {
                    opp.hp -= 48; opp.stun = 110; opp.vx = this.dir * 35;
                }
            } else {
                this.rika.x = this.x - (this.dir * 65);
                this.rika.y = this.y;
            }
            if (this.rika.frame <= 0) this.rika.active = false;
        }

        // Geto Projectile Collision (Rectangle check)
        this.getoProjs = this.getoProjs.filter(p => {
            p.x += p.vx;
            let hitX = Math.abs(p.x - (opp.x + 20)) < 45;
            let hitY = Math.abs(p.y - (opp.y - 40)) < 65;
            if (hitX && hitY && !opp.inShadow) {
                opp.hp -= 28; opp.stun = 20; return false;
            }
            return p.x > -50 && p.x < canvas.width + 50;
        });

        // Beam & Special FX Collision
        let isBeaming = (this.fx > 0 && (this.k === 'Ryu' || this.k === 'Yuta'));
        if (this.fx > 0) {
            this.fx--;
            if (!opp.inShadow) {
                let dist = Math.abs(this.x - opp.x);
                if (this.k === 'Sukuna' && dist < 190) { opp.hp -= 2.8; opp.stun = 6; }
                if (this.k === 'Itadori' && dist < 75) { opp.hp -= 75; opp.stun = 45; this.fx = 0; }
                if (this.k === 'Naoya' && dist < 85) { opp.stun = 90; this.fx = 0; }
                if (this.k === 'Nanami' && dist < 80) { opp.hp -= 55; opp.silence = 200; this.fx = 0; }
                if ((this.k === 'Toji' || this.k === 'Maki') && dist < 90) { 
                    opp.hp -= 6; opp.stun = 15; opp.vx = this.dir * 28; 
                }
                
                if (isBeaming) {
                    let bYCenter = this.y - 35;
                    let oppYCenter = opp.y - 40;
                    let vMatch = Math.abs(bYCenter - oppYCenter) < 55;
                    // Frontal Hitbox Check: Is opponent in the direction I am facing?
                    let frontal = (this.dir === 1) ? (opp.x > this.x) : (opp.x < this.x);
                    let bStart = this.x + 20;
                    let bEnd = this.dir === 1 ? bStart + 2000 : bStart - 2000;
                    let inRange = (opp.x + 20) > Math.min(bStart, bEnd) && (opp.x + 20) < Math.max(bStart, bEnd);
                    let clash = (p1.fx > 0 && p2.fx > 0 && 
                                (p1.k === 'Ryu' || p1.k === 'Yuta') && 
                                (p2.k === 'Ryu' || p2.k === 'Yuta') && 
                                Math.abs(p1.y - p2.y) < 45);
                    if (vMatch && frontal && inRange && !clash) {
                        opp.hp -= 2.5; opp.stun = 4;
                    }
                }
            }
        }

        // Projectile Update
        if (this.proj.active) {
            this.proj.x += this.proj.vx;
            let hitX = Math.abs(this.proj.x - (opp.x + 20)) < 65;
            let hitY = Math.abs(this.proj.y - 40 - (opp.y - 40)) < 95;
            if (hitX && hitY && !opp.inShadow) {
                if (this.proj.type === 'NAIL') { opp.hp -= 38; opp.stun = 130; }
                else if (this.proj.type === 'PURPLE') { opp.hp -= 85; opp.stun = 70; }
                else if (this.proj.type === 'BLOOD') { opp.hp -= 35; opp.poison = 200; }
                this.proj.active = false;
            }
            if (this.proj.x < -400 || this.proj.x > canvas.width + 400) this.proj.active = false;
        }

        // Movement Physics
        if (isBeaming) {
            this.vx = 0; this.vy = 0;
        } else if (this.stun <= 0) {
            let spd = this.inShadow ? this.s.s * 1.6 : this.s.s;
            if (this.pNum === 1) {
                if (held.p1L) { this.vx = -spd; this.dir = -1; }
                if (held.p1R) { this.vx = spd; this.dir = 1; }
            } else if (!this.cpu) {
                if (held.p2L) { this.vx = -spd; this.dir = -1; }
                if (held.p2R) { this.vx = spd; this.dir = 1; }
            }
        }

        this.x += this.vx; this.y += this.vy;
        this.vx *= 0.83;
        if (this.x < 0) this.x = 0;
        if (this.x > canvas.width - 45) this.x = canvas.width - 45;

        let floor = canvas.height - 110;
        if (!isBeaming) {
            if (this.y < floor) this.vy += 0.88;
            else { this.y = floor; this.vy = 0; }
        }

        // Passive Recovery/Cooldowns
        if (this.jackpot > 0) {
            this.jackpot--;
            if (this.hp < 300) this.hp += 0.65;
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
        let reach = 95;
        let vert = 100;
        if (Math.abs(this.x - opp.x) < reach && Math.abs(this.y - opp.y) < vert && !opp.inShadow) {
            if (this.inShadow) {
                opp.hp -= (this.s.d + 22); opp.stun = 65; this.inShadow = false;
            } else {
                opp.hp -= this.s.d; opp.stun = 14;
            }
            opp.vx = this.dir * 7;
        } else if (this.inShadow) {
            this.inShadow = false;
        }
    }

    ai(opp) {
        if (this.stun > 0 || (this.fx > 0 && (this.k === 'Ryu' || this.k === 'Yuta'))) return;
        let d = Math.abs(this.x - opp.x);
        
        // AI: Face the opponent (Fix turn around)
        this.dir = (opp.x < this.x) ? -1 : 1;

        // AI: Movement (Fix stuck behavior)
        if (d > 130) {
            this.vx = (opp.x < this.x) ? -this.s.s : this.s.s;
        } else if (d < 50) {
            this.vx = (opp.x < this.x) ? this.s.s : -this.s.s;
        }

        // AI: Jumping (Fix ground-stuck)
        if (this.y >= canvas.height - 110) {
            // Jump if opponent is higher, or to avoid projectiles, or randomly
            if (opp.y < this.y - 60 || (opp.proj.active && Math.abs(opp.proj.x - this.x) < 200) || Math.random() < 0.01) {
                if (Math.random() < 0.15) this.vy = -19.5;
            }
        }

        // AI: Combat
        if (d < 110 && Math.random() < 0.09) this.atk(opp);
        if (Math.random() < 0.018) this.spec(opp);
    }
}

// GUI and Input Handling
function initMode(m) {
    mode = m; p1C = null; p2C = null;
    document.getElementById('m-start').style.display = 'none';
    document.getElementById('m-char').style.display = 'block';
    updateHeader();
    const g = document.getElementById('char-grid'); g.innerHTML = '';
    Object.keys(chars).forEach(c => {
        const btn = document.createElement('button');
        btn.innerText = c;
        btn.onpointerdown = (e) => {
            e.stopPropagation();
            if (!p1C) {
                p1C = c;
                if (mode === '1P') {
                    const keys = Object.keys(chars);
                    p2C = keys[Math.floor(Math.random() * keys.length)];
                    startGame();
                } else updateHeader();
            } else if (mode === '2P' && !p2C) {
                p2C = c; startGame();
            }
        };
        g.appendChild(btn);
    });
}

function updateHeader() {
    const t = document.getElementById('selection-title');
    if (!p1C) { t.innerText = "PLAYER 1: SELECT YOUR SORCERER"; t.style.color = "#0af"; }
    else { t.innerText = "PLAYER 2: SELECT YOUR SORCERER"; t.style.color = "#f33"; }
}

function startGame() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    p1 = new Sorcerer(150, canvas.height - 110, p1C, 1, false);
    p2 = new Sorcerer(canvas.width - 200, canvas.height - 110, p2C, 2, mode === '1P');
    document.getElementById('menu').classList.remove('active-menu');
    document.getElementById('pause-btn').style.display = 'block';
    document.getElementById('controls').style.display = 'block';
    if (mode === '2P') document.getElementById('p2-pad').style.display = 'block';
    active = true;
    requestAnimationFrame(loop);
}

function loop() {
    if (!active) return;
    if (!paused) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        p1.update(p2); p2.update(p1);
        p1.draw(); p2.draw();
        
        // UI Updates
        document.getElementById('p1-hp').style.width = (p1.hp / 3) + '%';
        document.getElementById('p1-cd').style.width = ((450 - p1.spT) / 4.5) + '%';
        document.getElementById('p1-stun').innerText = p1.stun > 0 ? "STUNNED" : (p1.silence > 0 ? "SILENCED" : "");
        document.getElementById('p2-hp').style.width = (p2.hp / 3) + '%';
        document.getElementById('p2-cd').style.width = ((450 - p2.spT) / 4.5) + '%';
        document.getElementById('p2-stun').innerText = p2.stun > 0 ? "STUNNED" : (p2.silence > 0 ? "SILENCED" : "");

        if (p1.hp <= 0 || p2.hp <= 0) {
            active = false;
            showWin(p1.hp <= 0 ? "PLAYER 2" : "PLAYER 1");
        }
    }
    requestAnimationFrame(loop);
}

function showWin(winner) {
    const scr = document.getElementById('win-screen');
    const txt = document.getElementById('win-text');
    txt.innerText = winner + " IS THE STRONGEST";
    txt.style.color = (winner === "PLAYER 1") ? "#0af" : "#f33";
    scr.classList.add('active-menu');
}

function togglePause() {
    if (!active) return;
    paused = !paused;
    const ps = document.getElementById('pause-screen');
    if (paused) ps.classList.add('active-menu');
    else ps.classList.remove('active-menu');
}

// Controller Logic
window.addEventListener('touchstart', e => {
    if (e.target.tagName !== 'BUTTON') e.preventDefault();
    [...e.touches].forEach(t => {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (!el || !el.dataset.v) return;
        const n = el.dataset.p, p = (n === '1') ? p1 : p2, o = (n === '1') ? p2 : p1;
        const bming = (p.fx > 0 && (p.k === 'Ryu' || p.k === 'Yuta'));
        if (el.dataset.v === 'l') held['p' + n + 'L'] = true;
        if (el.dataset.v === 'r') held['p' + n + 'R'] = true;
        if (el.dataset.v === 'u' && p.vy === 0 && !bming) p.vy = -19.5;
        if (el.dataset.v === 'a') p.atk(o);
        if (el.dataset.v === 's') p.spec(o);
    });
}, { passive: false });

window.addEventListener('touchend', e => {
    held.p1L = held.p1R = held.p2L = held.p2R = false;
    [...e.touches].forEach(t => {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (el && el.dataset.v === 'l') held['p' + el.dataset.p + 'L'] = true;
        if (el && el.dataset.v === 'r') held['p' + el.dataset.p + 'R'] = true;
    });
});

window.onresize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
