/**
 * Mundo de Blocos: um mundo 2D gerado por código, para quebrar e construir.
 * O mundo fica salvo neste navegador.
 */
import {texto, coruja, retRedondo, bip, aleatorio} from './comum.js';

const T = 30; // tamanho do bloco em pixels
const W = 140; // largura do mundo em blocos
const H = 40; // altura do mundo em blocos
const CHAVE = 'adventiscratch-mundo-blocos';
const ALCANCE = 5.5;

const BLOCOS = [
    null,
    {nome: 'Grama', cor: '#5BBF4A', baixo: '#8B5A2B'},
    {nome: 'Terra', cor: '#8B5A2B'},
    {nome: 'Pedra', cor: '#8D8F99'},
    {nome: 'Tronco', cor: '#7A4E25', listras: true},
    {nome: 'Folhas', cor: '#2E9B3E', furos: true},
    {nome: 'Areia', cor: '#E8D48B'},
    {nome: 'Tábuas', cor: '#C08A4A', tabuas: true},
    {nome: 'Vidro', cor: 'rgba(200,240,255,.35)', vidro: true},
    {nome: 'Tijolos', cor: '#B5462E', tijolo: true},
    {nome: 'Rocha', cor: '#3B3B44'}
];
const INQUEBRAVEL = 10;
const BARRA = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const gerarMundo = semente => {
    const r = aleatorio(semente);
    const m = new Uint8Array(W * H);
    const f = [r() * 6, r() * 6, r() * 6];
    const alturas = [];
    for (let x = 0; x < W; x++) {
        const h = 20 + Math.sin(x / 13 + f[0]) * 4 + Math.sin(x / 5.3 + f[1]) * 1.6 + Math.sin(x / 29 + f[2]) * 6;
        alturas.push(Math.round(h));
    }
    for (let x = 0; x < W; x++) {
        const topo = alturas[x];
        for (let y = 0; y < H; y++) {
            let b = 0;
            if (y === H - 1) b = INQUEBRAVEL;
            else if (y > topo + 4) b = 3;
            else if (y > topo) b = topo >= 24 ? 6 : 2;
            else if (y === topo) b = topo >= 24 ? 6 : 1;
            m[y * W + x] = b;
        }
    }
    // árvores
    for (let x = 4; x < W - 4; x++) {
        const topo = alturas[x];
        if (m[topo * W + x] !== 1 || r() > 0.12) continue;
        const h = 4 + Math.floor(r() * 3);
        for (let i = 1; i <= h; i++) m[(topo - i) * W + x] = 4;
        for (let dy = -2; dy <= 1; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                const yy = topo - h + dy;
                if (Math.abs(dx) + Math.abs(dy) > 3) continue;
                if (m[yy * W + x + dx] === 0) m[yy * W + x + dx] = 5;
            }
        }
        x += 4;
    }
    return {m, inicioX: Math.floor(W / 2), inicioY: alturas[Math.floor(W / 2)] - 2};
};

const codificar = m => {
    let s = '';
    for (let i = 0; i < m.length; i++) s += String.fromCharCode(m[i] + 48);
    return s;
};
const decodificar = s => {
    if (!s || s.length !== W * H) return null;
    const m = new Uint8Array(W * H);
    for (let i = 0; i < s.length; i++) m[i] = Math.max(0, Math.min(BLOCOS.length - 1, s.charCodeAt(i) - 48));
    return m;
};

const desenharBloco = (ctx, b, x, y) => {
    const d = BLOCOS[b];
    if (!d) return;
    if (d.baixo) {
        ctx.fillStyle = d.baixo;
        ctx.fillRect(x, y, T, T);
        ctx.fillStyle = d.cor;
        ctx.fillRect(x, y, T, 9);
    } else {
        ctx.fillStyle = d.cor;
        ctx.fillRect(x, y, T, T);
    }
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    if (d.listras) {
        ctx.fillRect(x + 6, y, 3, T);
        ctx.fillRect(x + 18, y, 3, T);
    } else if (d.tabuas) {
        ctx.fillRect(x, y + 9, T, 2);
        ctx.fillRect(x, y + 19, T, 2);
        ctx.fillRect(x + 14, y, 2, 9);
        ctx.fillRect(x + 6, y + 11, 2, 8);
    } else if (d.tijolo) {
        ctx.fillStyle = '#E5D6C8';
        ctx.fillRect(x, y + 9, T, 2);
        ctx.fillRect(x, y + 20, T, 2);
        ctx.fillRect(x + 14, y, 2, 9);
        ctx.fillRect(x + 6, y + 11, 2, 9);
        ctx.fillRect(x + 22, y + 11, 2, 9);
    } else if (d.vidro) {
        ctx.strokeStyle = 'rgba(255,255,255,.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
        ctx.beginPath();
        ctx.moveTo(x + 6, y + 14);
        ctx.lineTo(x + 14, y + 6);
        ctx.stroke();
    } else if (d.furos) {
        ctx.fillStyle = 'rgba(0,0,0,.18)';
        ctx.fillRect(x + 4, y + 5, 5, 5);
        ctx.fillRect(x + 18, y + 14, 5, 5);
        ctx.fillRect(x + 9, y + 21, 4, 4);
    } else {
        // pontinhos fixos para dar textura
        const s = (x * 7 + y * 13) & 15;
        ctx.fillRect(x + 4 + (s % 5), y + 6, 4, 4);
        ctx.fillRect(x + 17, y + 15 + (s % 6), 4, 4);
        ctx.fillRect(x + 8, y + 22 - (s % 4), 3, 3);
    }
    if (!d.vidro) {
        ctx.strokeStyle = 'rgba(0,0,0,.18)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
    }
};

export default {
    id: 'blocos',
    nome: 'Mundo de Blocos',
    emoji: '⛏️🧱',
    cor: 'linear-gradient(135deg,#5BBF4A,#8B5A2B)',
    descricao: 'Um mundo de blocos só seu: explore, quebre e construa casas, torres e pontes. Fica salvo!',
    controles: '<span><kbd>A</kbd><kbd>D</kbd> ou <kbd>←</kbd><kbd>→</kbd> andam · <kbd>Espaço</kbd>/<kbd>W</kbd> pula</span>' +
        '<span>🖱️ esquerdo quebra · direito coloca</span><span><kbd>1</kbd>…<kbd>9</kbd> ou rodinha escolhem o bloco</span>' +
        '<span><kbd>N</kbd> 2× = mundo novo</span>',
    iniciar (ctx, api) {
        const L = api.largura;
        const A = api.altura;
        const canvas = api.canvas;
        let mundo;
        let p;
        let escolhido = 0;
        const mouse = {x: L / 2, y: A / 2, esq: false, dir: false, dentro: false};
        let colocados = 0;
        let ultimoN = 0;
        let aviso = null;
        let salvarEm = 0;
        let cooldown = 0;

        const novoMundo = () => {
            const g = gerarMundo(Date.now());
            mundo = g.m;
            p = {x: g.inicioX + 0.5, y: g.inicioY, vx: 0, vy: 0, noChao: false, virada: 1};
            salvarEm = performance.now() + 500;
        };

        let salvo = null;
        try {
            salvo = JSON.parse(localStorage.getItem(CHAVE));
        } catch (e) { /* sem mundo salvo */ }
        const m = salvo && decodificar(salvo.m);
        if (m) {
            mundo = m;
            p = {x: salvo.px, y: salvo.py, vx: 0, vy: 0, noChao: false, virada: 1};
            colocados = salvo.colocados || 0;
        } else {
            novoMundo();
        }

        const salvar = () => {
            try {
                localStorage.setItem(CHAVE, JSON.stringify({m: codificar(mundo), px: p.x, py: p.y, colocados}));
            } catch (e) { /* armazenamento cheio */ }
        };

        const bloco = (x, y) => {
            if (x < 0 || x >= W) return INQUEBRAVEL;
            if (y < 0) return 0;
            if (y >= H) return INQUEBRAVEL;
            return mundo[y * W + x];
        };
        const solido = (x, y) => {
            const b = bloco(x, y);
            return b !== 0;
        };

        // o jogador é uma caixa de 0,7 × 1,7 blocos; (p.x, p.y) = meio dos pés
        const PW = 0.35;
        const PH = 1.7;
        const colide = (x, y) => {
            for (let ty = Math.floor(y - PH); ty <= Math.floor(y - 0.001); ty++) {
                for (let tx = Math.floor(x - PW); tx <= Math.floor(x + PW - 0.001); tx++) {
                    if (solido(tx, ty)) return true;
                }
            }
            return false;
        };

        const posMouse = ev => {
            const r = canvas.getBoundingClientRect();
            mouse.x = (ev.clientX - r.left) * (L / r.width);
            mouse.y = (ev.clientY - r.top) * (A / r.height);
        };
        const aoMover = ev => {
            posMouse(ev);
            mouse.dentro = true;
        };
        const aoApertar = ev => {
            posMouse(ev);
            if (ev.button === 0) mouse.esq = true;
            if (ev.button === 2) mouse.dir = true;
            cooldown = 0;
            ev.preventDefault();
        };
        const aoSoltar = ev => {
            if (ev.button === 0) mouse.esq = false;
            if (ev.button === 2) mouse.dir = false;
        };
        const aoRodar = ev => {
            escolhido = (escolhido + (ev.deltaY > 0 ? 1 : BARRA.length - 1)) % BARRA.length;
            ev.preventDefault();
        };
        const aoSair = () => {
            mouse.dentro = false;
            mouse.esq = false;
            mouse.dir = false;
        };
        canvas.addEventListener('mousemove', aoMover);
        canvas.addEventListener('mousedown', aoApertar);
        window.addEventListener('mouseup', aoSoltar);
        canvas.addEventListener('wheel', aoRodar, {passive: false});
        canvas.addEventListener('mouseleave', aoSair);

        const tecla = k => {
            if (/^[1-9]$/.test(k)) escolhido = Number(k) - 1;
            if (k === 'n') {
                if (performance.now() - ultimoN < 1500) {
                    novoMundo();
                    aviso = {txt: 'Mundo novo criado!', ate: performance.now() + 1500};
                    ultimoN = 0;
                } else {
                    ultimoN = performance.now();
                    aviso = {txt: 'Aperte N de novo para criar um mundo novo (este será apagado)', ate: ultimoN + 1500};
                }
            }
        };

        api.laco(dt => {
            // ---- movimento ----
            const esq = api.apertada('a', 'ArrowLeft');
            const dir = api.apertada('d', 'ArrowRight');
            const alvo = (dir ? 6 : 0) - (esq ? 6 : 0);
            p.vx += (alvo - p.vx) * Math.min(1, dt * 14);
            if (alvo) p.virada = alvo > 0 ? 1 : -1;
            if (api.apertada(' ', 'w', 'ArrowUp') && p.noChao) {
                p.vy = -10.5;
                p.noChao = false;
            }
            p.vy = Math.min(22, p.vy + 32 * dt);
            // eixo x em passos pequenos
            let dx = p.vx * dt;
            while (Math.abs(dx) > 0.0001) {
                const d = Math.max(-0.2, Math.min(0.2, dx));
                dx -= d;
                if (!colide(p.x + d, p.y)) {
                    p.x += d;
                } else {
                    p.vx = 0;
                    break;
                }
            }
            let dy = p.vy * dt;
            p.noChao = false;
            while (Math.abs(dy) > 0.0001) {
                const d = Math.max(-0.2, Math.min(0.2, dy));
                dy -= d;
                if (!colide(p.x, p.y + d)) {
                    p.y += d;
                } else {
                    if (d > 0) {
                        p.y = Math.floor(p.y + d) - 0.0001;
                        p.noChao = true;
                    } else {
                        p.y = Math.ceil(p.y - PH + d) + PH;
                    }
                    p.vy = 0;
                    break;
                }
            }
            if (p.y > H + 5) {
                p.y = 2;
                p.vy = 0;
            }

            // ---- câmera ----
            const camX = Math.max(0, Math.min(W * T - L, p.x * T - L / 2));
            const camY = Math.max(0, Math.min(H * T - A, (p.y - 1) * T - A / 2));

            // ---- mouse: quebrar e colocar ----
            const mx = Math.floor((mouse.x + camX) / T);
            const my = Math.floor((mouse.y + camY) / T);
            const cx = p.x;
            const cy = p.y - PH / 2;
            const perto = Math.hypot(mx + 0.5 - cx, my + 0.5 - cy) <= ALCANCE;
            cooldown -= dt;
            if (mouse.dentro && perto && cooldown <= 0) {
                const audio = mouse.esq || mouse.dir ? api.audio() : null;
                if (mouse.esq && bloco(mx, my) !== 0 && bloco(mx, my) !== INQUEBRAVEL) {
                    mundo[my * W + mx] = 0;
                    bip(audio, 180, 0.06, 'square', 0.06);
                    cooldown = 0.18;
                    salvarEm = performance.now() + 800;
                } else if (mouse.dir && bloco(mx, my) === 0 && mx >= 0 && mx < W && my >= 0 && my < H) {
                    mundo[my * W + mx] = BARRA[escolhido];
                    if (colide(p.x, p.y)) {
                        mundo[my * W + mx] = 0; // não dá para colocar em cima de você
                    } else {
                        colocados++;
                        bip(audio, 330, 0.05, 'triangle', 0.08);
                        cooldown = 0.18;
                        salvarEm = performance.now() + 800;
                        api.registrar(colocados);
                    }
                }
            }
            if (salvarEm && performance.now() > salvarEm) {
                salvar();
                salvarEm = 0;
            }

            // ---- desenho ----
            const g = ctx.createLinearGradient(0, 0, 0, A);
            g.addColorStop(0, '#7EC8FF');
            g.addColorStop(1, '#CDEBFF');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, L, A);
            ctx.fillStyle = '#FFE27A';
            ctx.beginPath();
            ctx.arc(L - 120 - camX * 0.02, 90, 40, 0, Math.PI * 2);
            ctx.fill();
            const x0 = Math.floor(camX / T);
            const y0 = Math.floor(camY / T);
            for (let ty = y0; ty <= y0 + Math.ceil(A / T); ty++) {
                for (let tx = x0; tx <= x0 + Math.ceil(L / T); tx++) {
                    const b = bloco(tx, ty);
                    if (b) desenharBloco(ctx, b, Math.round(tx * T - camX), Math.round(ty * T - camY));
                }
            }
            coruja(ctx, p.x * T - camX, p.y * T - camY, 0.48, {pose: p.noChao ? 'normal' : 'pulo', virada: p.virada});
            if (mouse.dentro) {
                ctx.strokeStyle = perto ? '#fff' : 'rgba(255,90,90,.8)';
                ctx.lineWidth = 3;
                ctx.strokeRect(mx * T - camX + 1.5, my * T - camY + 1.5, T - 3, T - 3);
            }
            // barra de blocos
            const bx = L / 2 - (BARRA.length * 46) / 2;
            ctx.fillStyle = 'rgba(27,19,56,.75)';
            retRedondo(ctx, bx - 8, A - 62, BARRA.length * 46 + 16, 56, 12);
            ctx.fill();
            BARRA.forEach((b, i) => {
                const x = bx + i * 46;
                if (i === escolhido) {
                    ctx.fillStyle = '#FFC928';
                    ctx.fillRect(x - 3, A - 57, 42, 42);
                }
                ctx.save();
                ctx.translate(x + 3, A - 51);
                ctx.scale(30 / T, 30 / T);
                desenharBloco(ctx, b, 0, 0);
                ctx.restore();
                texto(ctx, String(i + 1), x + 32, A - 20, {tam: 12});
            });
            texto(ctx, BLOCOS[BARRA[escolhido]].nome, L / 2, A - 78, {tam: 18});
            texto(ctx, `🧱 ${colocados} blocos colocados`, 16, 24, {tam: 18, alinhar: 'left'});
            if (aviso && aviso.ate > performance.now()) texto(ctx, aviso.txt, L / 2, 60, {tam: 22, cor: '#FFC928'});
        });

        return {
            tecla,
            parar: () => {
                salvar();
                canvas.removeEventListener('mousemove', aoMover);
                canvas.removeEventListener('mousedown', aoApertar);
                window.removeEventListener('mouseup', aoSoltar);
                canvas.removeEventListener('wheel', aoRodar);
                canvas.removeEventListener('mouseleave', aoSair);
            }
        };
    }
};
