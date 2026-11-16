/**
 * Corrida Infinita da Coruja: um jogo de plataforma que corre sozinho e vai ficando mais rápido.
 * Pule os buracos e os espinhos, pegue estrelas. Tem pulo duplo.
 */
import {texto, coruja, estrela, bip, telaFim, aleatorio} from './comum.js';

const GRAV = 2300;
const PULO = 820;
const PULO_AR = 700;
const LARG = 34;
const ALT = 58;

export default {
    id: 'corrida',
    nome: 'Corrida Infinita',
    emoji: '🏃⭐',
    cor: 'linear-gradient(135deg,#4CAF50,#1E88E5)',
    descricao: 'A coruja corre sozinha e cada vez mais rápido. Pule buracos e espinhos e pegue estrelas!',
    controles: '<span><kbd>Espaço</kbd>, <kbd>↑</kbd> ou <kbd>W</kbd> pulam (aperte de novo no ar para o pulo duplo)</span>',
    iniciar (ctx, api) {
        const L = api.largura;
        const A = api.altura;
        let rnd;
        let estado;
        let seg;
        let espinhos;
        let estrelas;
        let p;
        let camX;
        let vel;
        let dist;
        let qtdEstrelas;
        let fase;
        let novoRecorde = false;
        let fimEm = 0;
        let segurando = false;
        let particulas = [];

        const gerarAte = limite => {
            while (estado.fim < limite) {
                const ultimo = seg[seg.length - 1];
                const dificil = Math.min(1, dist / 6000);
                const vao = estado.inicio > 0 ? 0 : 70 + rnd() * (60 + 120 * dificil) + vel * 0.06;
                if (estado.inicio > 0) estado.inicio--;
                let y = ultimo.y + Math.round((rnd() - 0.5) * 130);
                y = Math.max(300, Math.min(470, y));
                if (y < ultimo.y - 80) y = ultimo.y - 80;
                const w = 260 + rnd() * (420 - 160 * dificil);
                const x = estado.fim + vao;
                seg.push({x, w, y});
                // estrelas em arco por cima do buraco
                if (vao > 60) {
                    for (let i = 0; i < 3; i++) {
                        const fx = (i + 1) / 4;
                        estrelas.push({x: estado.fim + vao * fx, y: Math.min(y, ultimo.y) - 70 - Math.sin(fx * Math.PI) * 60,
                            pego: false});
                    }
                }
                // espinhos no meio do chão (nunca logo no começo)
                if (dist > 400 && w > 300 && rnd() < 0.35 + 0.35 * dificil) {
                    const n = 1 + Math.floor(rnd() * 2);
                    espinhos.push({x: x + w * (0.4 + rnd() * 0.25), y, n});
                } else if (rnd() < 0.5) {
                    estrelas.push({x: x + w / 2, y: y - 40, pego: false});
                }
                estado.fim = x + w;
            }
        };

        const reiniciar = () => {
            rnd = aleatorio(Date.now());
            seg = [{x: -200, w: 900, y: 420}];
            espinhos = [];
            estrelas = [];
            estado = {fim: 700, inicio: 2};
            p = {x: 150, y: 420, vy: 0, noChao: true, pulosAr: 1, coyote: 0, buffer: 0};
            camX = 0;
            vel = 330;
            dist = 0;
            qtdEstrelas = 0;
            particulas = [];
            fase = 'pronto';
            gerarAte(L * 2);
        };
        reiniciar();

        const pontos = () => Math.floor(dist / 10) + qtdEstrelas * 50;

        const pular = () => {
            if (fase === 'pronto') {
                fase = 'jogando';
                api.audio();
            }
            if (fase === 'fim') {
                if (performance.now() - fimEm > 500) reiniciar();
                return;
            }
            p.buffer = 0.12;
        };

        const morrer = () => {
            fase = 'fim';
            fimEm = performance.now();
            novoRecorde = api.registrar(pontos());
            bip(api.audio(), 160, 0.35, 'sawtooth', 0.12);
        };

        const tecla = k => {
            if (k === ' ' || k === 'ArrowUp' || k === 'w') pular();
        };

        api.laco(dt => {
            segurando = api.apertada(' ', 'ArrowUp', 'w');
            if (fase === 'jogando') {
                vel = Math.min(760, vel + dt * 9);
                const dx = vel * dt;
                const antesPe = p.y;
                p.x += dx;
                dist += dx;
                camX = p.x - 180;
                // pulo (com "tempo de coiote" e memória do botão)
                if (p.buffer > 0) {
                    const audio = api.audio();
                    if (p.noChao || p.coyote > 0) {
                        p.vy = -PULO;
                        p.noChao = false;
                        p.coyote = 0;
                        p.buffer = 0;
                        bip(audio, 520, 0.08, 'square', 0.07);
                    } else if (p.pulosAr > 0) {
                        p.vy = -PULO_AR;
                        p.pulosAr--;
                        p.buffer = 0;
                        bip(audio, 700, 0.08, 'square', 0.07);
                        for (let i = 0; i < 8; i++) {
                            particulas.push({x: p.x, y: p.y, vx: (Math.random() - 0.5) * 200, vy: Math.random() * 120,
                                vida: 0.4});
                        }
                    }
                    p.buffer -= dt;
                }
                if (!segurando && p.vy < -300) p.vy = -300;
                p.vy += GRAV * dt;
                p.y += p.vy * dt;
                p.coyote -= dt;
                // chão
                const estava = p.noChao;
                p.noChao = false;
                for (const s of seg) {
                    if (p.x + LARG / 2 < s.x || p.x - LARG / 2 > s.x + s.w) continue;
                    if (p.vy >= 0 && antesPe <= s.y + 2 && p.y >= s.y) {
                        p.y = s.y;
                        p.vy = 0;
                        p.noChao = true;
                        p.pulosAr = 1;
                    } else if (p.y > s.y + 18 && p.y - ALT < s.y + 200 && p.x + LARG / 2 - dx <= s.x) {
                        morrer(); // bateu na parede de um degrau alto
                    }
                }
                if (estava && !p.noChao && p.vy >= 0) p.coyote = 0.1;
                // espinhos
                for (const e of espinhos) {
                    const larg = 28 * e.n;
                    if (p.x + LARG / 2 - 6 > e.x && p.x - LARG / 2 + 6 < e.x + larg && p.y > e.y - 24) morrer();
                }
                // estrelas
                for (const e of estrelas) {
                    if (!e.pego && Math.abs(e.x - p.x) < 34 && Math.abs(e.y - (p.y - ALT / 2)) < 44) {
                        e.pego = true;
                        qtdEstrelas++;
                        bip(api.audio(), 990, 0.1, 'triangle', 0.12);
                    }
                }
                if (p.y > A + 120) morrer();
                gerarAte(camX + L * 2);
                seg = seg.filter(s => s.x + s.w > camX - 200);
                espinhos = espinhos.filter(e => e.x > camX - 200);
                estrelas = estrelas.filter(e => e.x > camX - 200);
            }
            particulas.forEach(q => {
                q.x += q.vx * dt;
                q.y += q.vy * dt;
                q.vida -= dt;
            });
            particulas = particulas.filter(q => q.vida > 0);

            // ---- desenho ----
            const g = ctx.createLinearGradient(0, 0, 0, A);
            g.addColorStop(0, '#6EC6FF');
            g.addColorStop(1, '#D6F1FF');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, L, A);
            ctx.fillStyle = 'rgba(255,255,255,.9)';
            for (let i = 0; i < 6; i++) {
                const x = ((i * 260) - camX * 0.15) % (L + 300);
                const cx = x < -150 ? x + L + 300 : x;
                ctx.beginPath();
                ctx.ellipse(cx, 70 + (i % 3) * 40, 60, 18, 0, 0, Math.PI * 2);
                ctx.ellipse(cx + 30, 60 + (i % 3) * 40, 40, 20, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = '#8BD48A';
            for (let i = 0; i < 8; i++) {
                const base = ((i * 200) - camX * 0.35) % (L + 400);
                const x = base < -200 ? base + L + 400 : base;
                ctx.beginPath();
                ctx.ellipse(x, A, 160, 150 + (i % 3) * 30, 0, Math.PI, 0);
                ctx.fill();
            }
            ctx.save();
            ctx.translate(-camX, 0);
            for (const s of seg) {
                ctx.fillStyle = '#A0521D';
                ctx.fillRect(s.x, s.y, s.w, A - s.y + 10);
                ctx.fillStyle = '#5BBF4A';
                ctx.fillRect(s.x, s.y, s.w, 14);
                ctx.fillStyle = '#8E4518';
                for (let x = s.x + 20; x < s.x + s.w - 10; x += 60) ctx.fillRect(x, s.y + 40 + (x % 3) * 20, 18, 8);
            }
            for (const e of espinhos) {
                ctx.fillStyle = '#9AA1B5';
                ctx.strokeStyle = '#4A4F60';
                ctx.lineWidth = 2;
                for (let i = 0; i < e.n; i++) {
                    ctx.beginPath();
                    ctx.moveTo(e.x + i * 28, e.y);
                    ctx.lineTo(e.x + i * 28 + 14, e.y - 28);
                    ctx.lineTo(e.x + i * 28 + 28, e.y);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }
            }
            const giro = performance.now() / 300;
            for (const e of estrelas) if (!e.pego) estrela(ctx, e.x, e.y, 15, '#FFC928', giro);
            for (const q of particulas) {
                ctx.fillStyle = `rgba(255,255,255,${q.vida * 2})`;
                ctx.beginPath();
                ctx.arc(q.x, q.y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
            const corre = Math.sin(performance.now() / 60) * (p.noChao && fase === 'jogando' ? 3 : 0);
            coruja(ctx, p.x, p.y + corre, 0.6, {pose: p.noChao ? 'normal' : 'pulo'});
            ctx.restore();

            texto(ctx, `⭐ ${qtdEstrelas}`, 20, 30, {tam: 26, alinhar: 'left'});
            texto(ctx, `${Math.floor(dist / 10)} m`, L / 2, 30, {tam: 26});
            texto(ctx, `Pontos ${pontos()}`, L - 20, 30, {tam: 26, alinhar: 'right'});
            if (fase === 'pronto') {
                texto(ctx, 'Corrida Infinita', L / 2, 170, {tam: 56, cor: '#FFC928'});
                texto(ctx, 'Aperte ESPAÇO para começar e para pular', L / 2, 235, {tam: 24});
                texto(ctx, 'No ar, aperte de novo para o pulo duplo!', L / 2, 270, {tam: 20, cor: '#1B1338', contorno: null});
            }
            if (fase === 'fim') telaFim(ctx, api, 'Fim da corrida!', pontos(), novoRecorde);
        });

        return {tecla};
    }
};
