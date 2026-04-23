const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let mode = '1P', p1, p2, p1C = null, p2C = null, active = false, paused = false;
const held = { p1L: false, p1R: false, p2L: false, p2R: false };

const chars = {
    'Gojo': { c: '#fff', d: 7, s: 7 }, 'Sukuna': { c: '#f33', d: 8, s: 7 },
    'Itadori': { c: '#fd0', d: 11, s: 8 }, 'Maki': { c: '#4a4', d: 12, s: 10 },
    'Megumi': { c: '#222', d: 6, s: 7 }, 'Yuta': { c: '#f0f', d: 8, s: 7 },
    'Ryu': { c: '#0cf', d: 9, s: 5 }, 'Naoya': { c: '#dfd', d: 7, s: 12 },
    'Nobara': { c: '#f6a', d: 8, s: 6 }, 'Toji': { c: '#777', d: 14, s: 9 },
    'Todo': { c: '#853', d: 10, s: 8 }, 'Geto': { c: '#442', d: 8, s: 6 },
    'Choso': { c: '#a44', d: 7, s: 7 }, 'Hakari': { c: '#eee', d: 9, s: 8 },
    'Nanami': { c: '#ee0', d: 13, s: 7 }
};

class Sorcerer {
    constructor(x, y, k, pNum, cpu) {
        this.k = k; this.s = chars[k]; this.x = x; this.y = y; this.pNum = pNum;
        this.hp = 300; this.vx = 0; this.vy = 0; this.dir = pNum === 1 ? 1 : -1;
        this.cpu = cpu; this.m1T = 0; this.spT = 0; this.fx = 0; this.stun = 0;
        this.silence = 0; // Nanami's new mechanic
        this.proj = { active: false, x: 0, y: 0, vx: 0, type: '' };
        this.getoProjs = []; // Geto's 3 projectiles
        this.rika = { active: false, x: 0, y: 0, frame: 0, type: '' }; // Yuta's Rika
        this.jackpot = 0; this.frame = 0;
        this.poison = 0; 
        this.inShadow = false; 
    }

    draw() {
        ctx.save();
        this.frame++;
        let cx = this.x + 20, cy = this.y; 
        if (this.stun > 0) ctx.translate(Math.random() * 5 - 2.5, 0);

        if (this.inShadow) ctx.globalAlpha = 0.3;

        // Ground Line
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, canvas.height - 108); ctx.lineTo(canvas.width, canvas.height - 108); ctx.stroke();

        // Rika Rendering
        if (this.rika.active) {
            ctx.save();
            ctx.fillStyle = 'rgba(30, 0, 40, 0.8)';
            ctx.shadowBlur = 20; ctx.shadowColor = '#f0f';
            let rx = this.rika.x, ry = this.rika.y;
            ctx.beginPath();
            ctx.ellipse(rx, ry - 70, 50, 90, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff'; // Rika's Eye
            ctx.beginPath();
            ctx.arc(rx + (this.dir * 15), ry - 110, 8, 0, 7);
            ctx.fill();
            if (this.rika.type === 'PUNCH') {
                ctx.strokeStyle = '#222'; ctx.lineWidth = 20;
                ctx.beginPath(); ctx.moveTo(rx, ry - 60); ctx.lineTo(rx + (this.dir * 90), ry - 60); ctx.stroke();
            }
            ctx.restore();
        }

        if (this.fx > 0) {
            ctx.shadowBlur = 15; ctx.shadowColor = this.s.c;
            if (this.k === 'Sukuna') {
                ctx.strokeStyle = '#f00';
                for(let i=0; i<3; i++){
                    ctx.beginPath(); let ox = Math.random()*150*this.dir;
                    ctx.moveTo(cx+ox, cy-100); ctx.lineTo(cx+ox+20, cy); ctx.stroke();
                }
            }
            // Yuji Black Flash Visuals
            if (this.k === 'Itadori') {
                ctx.strokeStyle = '#f00'; ctx.lineWidth = 5; ctx.shadowColor = '#000';
                for(let i=0; i<8; i++) {
                    ctx.beginPath();
                    let bx = cx + (Math.random()-0.5)*120; let by = cy-50 + (Math.random()-0.5)*120;
                    ctx.moveTo(bx, by); ctx.lineTo(bx+(Math.random()-0.5)*50, by+(Math.random()-0.5)*50); ctx.stroke();
                }
            }
            if (this.k === 'Ryu' || this.k === 'Yuta') {
                ctx.fillStyle = this.s.c; ctx.globalAlpha = 0.5;
                let isClash = (p1.fx > 0 && p2.fx > 0 && (p1.k === 'Ryu' || p1.k === 'Yuta') && (p2.k === 'Ryu' || p2.k === 'Yuta'));
                let beamLen = isClash ? Math.abs(canvas.width/2 - cx) : 2000;
                ctx.fillRect(cx, cy-50, beamLen * this.dir, 30);
                if(isClash) {
                    ctx.globalAlpha = 1; ctx.fillStyle = "#fff"; ctx.shadowBlur = 30; ctx.shadowColor = "#fff";
                    ctx.beginPath(); ctx.arc(canvas.width/2, cy-35, 15 + Math.random()*20, 0, 7); ctx.fill();
                }
            }
        }

        // Geto's 3 Projectiles
        this.getoProjs.forEach(p => {
            ctx.fillStyle = '#442'; ctx.shadowBlur = 15; ctx.shadowColor = '#221';
            ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, 7); ctx.fill();
        });

        if (this.proj.active) {
            // Gojo Purple logic
            ctx.fillStyle = (this.k === 'Gojo') ? '#a0f' : this.s.c; 
            ctx.shadowBlur = 20; ctx.shadowColor = ctx.fillStyle;
            if (this.proj.type === 'NAIL') ctx.fillRect(this.proj.x, this.proj.y - 40, 18 * this.dir, 4);
            else { 
                ctx.beginPath(); 
                let size = (this.proj.type==='PURPLE'||this.proj.type==='UZUMAKI')?45:15; 
                ctx.arc(this.proj.x, this.proj.y-40, size,0,7); ctx.fill(); 
            }
            ctx.shadowBlur = 0;
        }

        ctx.strokeStyle = this.jackpot > 0 ? '#0f0' : this.s.c; ctx.lineWidth = 3;
        if (this.poison > 0) { ctx.strokeStyle = '#80f'; ctx.shadowBlur = 10; ctx.shadowColor = '#80f'; }
        if (this.silence > 0) { ctx.strokeStyle = '#555'; }

        ctx.beginPath(); ctx.arc(cx, cy - 85, 12, 0, 7); ctx.stroke(); 
        ctx.beginPath(); ctx.moveTo(cx, cy - 73); ctx.lineTo(cx, cy - 30); ctx.stroke(); 
        let armY = (this.m1T > 0 || this.fx > 0) ? cy - 45 : cy - 60;
        ctx.beginPath(); ctx.moveTo(cx, cy - 70); ctx.lineTo(cx + (this.dir * 25), armY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - 70); ctx.lineTo(cx - (this.dir * 15), cy - 50); ctx.stroke();
        let walk = (Math.abs(this.vx) > 0.1) ? Math.sin(this.frame * 0.2) * 12 : 5;
        ctx.beginPath(); ctx.moveTo(cx, cy - 30); ctx.lineTo(cx + walk, cy); ctx.stroke(); 
        ctx.beginPath(); ctx.moveTo(cx, cy - 30); ctx.lineTo(cx - walk, cy); ctx.stroke();
        ctx.restore();
    }

    spec(opp) {
        if (this.spT > 0 || this.stun > 0) return;
        switch(this.k) {
            case 'Nobara': this.proj = { active: true, x: this.x, y: this.y, vx: this.dir * 24, type: 'NAIL' }; this.spT = 450; break;
            case 'Hakari': if (Math.random() < 0.4) { this.jackpot = 600; this.spT = 225; } else { this.spT = 450; } break;
            case 'Gojo': this.proj = { active: true, x: this.x, y: this.y, vx: this.dir * 7, type: 'PURPLE' }; this.spT = 450; break;
            case 'Sukuna': this.fx = 40; this.spT = 450; break;
            case 'Itadori': this.vx = this.dir * 40; this.fx = 20; this.spT = 450; break;
            case 'Todo': let tx = this.x; this.x = opp.x; opp.x = tx; opp.stun = 30; this.spT = 250; break;
            case 'Choso': this.proj = { active: true, x: this.x, y: this.y, vx: this.dir * 30, type: 'BLOOD' }; this.spT = 450; break;
            case 'Nanami': this.vx = this.dir * 32; this.fx = 15; this.spT = 450; break;
            case 'Megumi': this.inShadow = true; this.spT = 500; break;
            case 'Naoya': this.vx = this.dir * 55; this.fx = 35; this.spT = 450; break;
            case 'Geto': 
                this.getoProjs = [
                    {x: this.x, y: this.y - 80, vx: this.dir * 7},
                    {x: this.x, y: this.y - 40, vx: this.dir * 7},
                    {x: this.x, y: this.y, vx: this.dir * 7}
                ];
                this.spT = 450; break;
            case 'Ryu': this.fx = 130; this.spT = 450; break;
            case 'Yuta': 
                if (opp.k === 'Ryu') {
                    this.fx = 130; 
                    this.rika = { active: true, x: this.x - (this.dir * 60), y: this.y, frame: 130, type: 'BEAM' };
                } else {
                    this.rika = { active: true, x: this.x + (this.dir * 30), y: this.y, frame: 45, type: 'PUNCH' };
                }
                this.spT = 550; break;
            case 'Toji': case 'Maki': this.vx = this.dir * 48; this.fx = 25; this.spT = 450; break;
        }
    }

    update(opp) {
        if (!active || paused) return;

        if (this.poison > 0) {
            this.poison--;
            if (this.poison % 60 === 0) this.hp -= 2;
        }

        // Rika logic
        if (this.rika.active) {
            this.rika.frame--;
            if (this.rika.type === 'PUNCH') {
                if (Math.abs(this.rika.x - opp.x) < 80) {
                    opp.hp -= 45; opp.stun = 120; // 2 sec stun
                    opp.vx = this.dir * 40; // Push far
                }
            } else {
                this.rika.x = this.x - (this.dir * 60);
            }
            if (this.rika.frame <= 0) this.rika.active = false;
        }

        // Geto Projs logic
        this.getoProjs = this.getoProjs.filter(p => {
            p.x += p.vx;
            if (Math.abs(p.x - (opp.x + 20)) < 40 && Math.abs(p.y - (opp.y - 40)) < 60) {
                opp.hp -= 25; opp.stun = 15; return false;
            }
            return p.x > 0 && p.x < canvas.width;
        });

        let isBeaming = (this.fx > 0 && (this.k === 'Ryu' || this.k === 'Yuta'));
        if (this.fx > 0) {
            this.fx--; let dist = Math.abs(this.x - opp.x);
            if (this.k === 'Sukuna' && dist < 180) { opp.hp -= 2.5; opp.stun = 5; }
            if (this.k === 'Itadori' && dist < 70) { opp.hp -= 70; opp.stun = 40; this.fx = 0; }
            if (this.k === 'Naoya' && dist < 80) { opp.stun = 80; this.fx = 0; }
            if (this.k === 'Nanami' && dist < 75) { opp.hp -= 50; opp.silence = 180; this.fx = 0; } // 3s silence
            if ((this.k === 'Toji' || this.k === 'Maki') && dist < 85) { 
                opp.hp -= 5; opp.stun = 12; opp.vx = this.dir * 25; // Toji pushback
            }
            let clashing = (p1.fx > 0 && p2.fx > 0 && (p1.k === 'Ryu' || p1.k === 'Yuta') && (p2.k === 'Ryu' || p2.k === 'Yuta'));
            if (isBeaming && !clashing && dist < 2000 && Math.abs(this.y - opp.y) < 100) { opp.hp -= 2.2; opp.stun = 3; }
        }

        if (this.proj.active) {
            this.proj.x += this.proj.vx;
            if (Math.abs(this.proj.x - (opp.x + 20)) < 60 && Math.abs(this.proj.y - 40 - (opp.y - 40)) < 90) {
                if (this.proj.type === 'NAIL') { opp.hp -= 35; opp.stun = 120; } // 2s stun
                else if (this.proj.type === 'PURPLE') { opp.hp -= 80; opp.stun = 60; }
                else if (this.proj.type === 'BLOOD') { opp.hp -= 35; opp.stun = 15; opp.poison = 180; }
                this.proj.active = false;
            }
            if (this.proj.x < -300 || this.proj.x > canvas.width + 300) this.proj.active = false;
        }

        if (isBeaming) { this.vx = 0; this.vy = 0; } 
        else if (this.stun <= 0) {
            let speed = this.inShadow ? this.s.s * 1.5 : this.s.s;
            if (this.pNum === 1) { if (held.p1L) { this.vx = -speed; this.dir = -1; } if (held.p1R) { this.vx = speed; this.dir = 1; } }
            else if (!this.cpu) { if (held.p2L) { this.vx = -speed; this.dir = -1; } if (held.p2R) { this.vx = speed; this.dir = 1; } }
        }

        this.x += this.vx; this.y += this.vy; this.vx *= 0.82;
        
        // WALL BORDERS
        if (this.x < 0) this.x = 0;
        if (this.x > canvas.width - 40) this.x = canvas.width - 40;

        let ground = canvas.height - 110;
        if (!isBeaming) { if (this.y < ground) this.vy += 0.85; else { this.y = ground; this.vy = 0; } }
        if (this.jackpot > 0) { this.jackpot--; if (this.hp < 300) this.hp += 0.6; }
        if (this.stun > 0) this.stun--; if (this.spT > 0) this.spT--; if (this.m1T > 0) this.m1T--;
        if (this.silence > 0) this.silence--;
        if (this.cpu) this.ai(opp);
    }

    atk(opp) {
        if (this.stun > 0 || this.m1T > 0 || this.silence > 0 || (this.fx > 0 && (this.k === 'Ryu' || this.k === 'Yuta'))) return;
        this.m1T = 18; 
        if (Math.abs(this.x - opp.x) < 90 && Math.abs(this.y - opp.y) < 100) {
            if (this.inShadow) {
                opp.hp -= (this.s.d + 20); opp.stun = 60; this.inShadow = false;
            } else {
                opp.hp -= this.s.d; opp.stun = 12; 
            }
            opp.vx = this.dir * 6;
        } else if (this.inShadow) {
            this.inShadow = false;
        }
    }

    ai(opp) {
        let dist = Math.abs(this.x - opp.x);
        if (dist > 160) this.vx = opp.x < this.x ? -this.s.s : this.s.s;
        else if (Math.random() < 0.07) this.atk(opp);
        if (Math.random() < 0.015) this.spec(opp);
    }
}

// RESTORED FULL BOILERPLATE
function initMode(m) {
    mode = m; p1C = null; p2C = null;
    document.getElementById('m-start').style.display = 'none';
    document.getElementById('m-char').style.display = 'block';
    updateSelectionTitle();
    const g = document.getElementById('char-grid'); g.innerHTML = '';
    Object.keys(chars).forEach(c => {
        const b = document.createElement('button'); b.innerText = c;
        b.onpointerdown = (e) => {
            e.stopPropagation();
            if (!p1C) { 
                p1C = c; 
                if (mode === '1P') { 
                    // CPU CHOOSES RANDOM CHARACTER (NOT JUST SUKUNA)
                    const roster = Object.keys(chars);
                    p2C = roster[Math.floor(Math.random() * roster.length)];
                    startGame(); 
                } else updateSelectionTitle(); 
            }
            else if (mode === '2P' && !p2C) { p2C = c; startGame(); }
        };
        g.appendChild(b);
    });
}

function updateSelectionTitle() {
    const t = document.getElementById('selection-title');
    if (!p1C) { t.innerText = "PLAYER 1: SELECT CHARACTER"; t.style.color = "#0af"; }
    else { t.innerText = "PLAYER 2: SELECT CHARACTER"; t.style.color = "#f33"; }
}

function startGame() {
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    p1 = new Sorcerer(100, canvas.height - 110, p1C, 1, false);
    p2 = new Sorcerer(canvas.width - 150, canvas.height - 110, p2C, 2, mode === '1P');
    document.getElementById('menu').classList.remove('active-menu');
    document.getElementById('pause-btn').style.display = 'block';
    document.getElementById('controls').style.display = 'block';
    if (mode === '2P') document.getElementById('p2-pad').style.display = 'block';
    active = true; loop();
}

function loop() {
    if (!active) return;
    if (!paused) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        p1.update(p2); p2.update(p1); p1.draw(); p2.draw();
        document.getElementById('p1-hp').style.width = (p1.hp / 3) + '%';
        document.getElementById('p1-cd').style.width = ((450 - p1.spT) / 4.5) + '%';
        document.getElementById('p1-stun').innerText = p1.stun > 0 ? "STUNNED" : (p1.silence > 0 ? "SILENCED" : "");
        document.getElementById('p2-hp').style.width = (p2.hp / 3) + '%';
        document.getElementById('p2-cd').style.width = ((450 - p2.spT) / 4.5) + '%';
        document.getElementById('p2-stun').innerText = p2.stun > 0 ? "STUNNED" : (p2.silence > 0 ? "SILENCED" : "");
        if (p1.hp <= 0 || p2.hp <= 0) { active = false; showWinScreen(p1.hp <= 0 ? "PLAYER 2" : "PLAYER 1"); }
    }
    requestAnimationFrame(loop);
}

function showWinScreen(w) {
    const screen = document.getElementById('win-screen');
    document.getElementById('win-text').innerText = w + " WINS";
    document.getElementById('win-text').style.color = w === "PLAYER 1" ? "#0af" : "#f33";
    screen.classList.add('active-menu');
}

function togglePause() {
    if(!active) return; paused = !paused;
    const screen = document.getElementById('pause-screen');
    if (paused) screen.classList.add('active-menu'); else screen.classList.remove('active-menu');
}

window.addEventListener('touchstart', e => {
    if (e.target.tagName !== 'BUTTON') e.preventDefault(); 
    [...e.touches].forEach(touch => {
        const b = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!b || !b.dataset.v) return;
        const pNum = b.dataset.p, p = (pNum === '1') ? p1 : p2, opp = (pNum === '1') ? p2 : p1;
        const isBeaming = (p.fx > 0 && (p.k === 'Ryu' || p.k === 'Yuta'));
        if (b.dataset.v === 'l') held['p'+pNum+'L'] = true;
        if (b.dataset.v === 'r') held['p'+pNum+'R'] = true;
        if (b.dataset.v === 'u' && p.vy === 0 && !isBeaming) p.vy = -19;
        if (b.dataset.v === 'a') p.atk(opp);
        if (b.dataset.v === 's') p.spec(opp);
    });
}, {passive: false});

window.addEventListener('touchend', e => {
    held.p1L = held.p1R = held.p2L = held.p2R = false;
    [...e.touches].forEach(touch => {
        const b = document.elementFromPoint(touch.clientX, touch.clientY);
        if (b && b.dataset.v === 'l') held['p'+b.dataset.p+'L'] = true;
        if (b && b.dataset.v === 'r') held['p'+b.dataset.p+'R'] = true;
    });
});

window.onresize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
window.onload = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
