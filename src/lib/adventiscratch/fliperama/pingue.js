/**
 * Pingue-Coruja: tênis de mesa contra o computador (ou contra um amigo no mesmo teclado).
 */
import {texto, bip, retRedondo} from './comum.js';

const VENCE = 7;

export default {
    id: 'pingue',
    nome: 'Pingue-Coruja',
    emoji: '🏓',
    cor: 'linear-gradient(135deg,#1B1338,#3D6EF2)',
    descricao: 'Rebata a bola e marque 7 pontos primeiro. Jogue contra o computador ou contra um amigo!',
    controles: '<span>Você: <kbd>W</kbd><kbd>S</kbd> (ou <kbd>↑</kbd><kbd>↓</kbd> contra o computador)</span>' +
        '<span>Amigo: <kbd>↑</kbd><kbd>↓</kbd> · <kbd>1</kbd> computador · <kbd>2</kbd> dois jogadores</span>',
    iniciar (ctx, api) {
        const L = api.largura;
        const A = api.altura;
        const RAQ_A = 96;
        const RAQ_L = 16;
        let modo = 1;
        let esq;
        let dir;
        let bola;
        let placar;
        let fase = 'menu';
        let espera = 0;

        const saque = lado => {
            const ang = (Math.random() - 0.5) * 0.8;
            bola = {x: L / 2, y: A / 2, vx: Math.cos(ang) * 380 * lado, vy: Math.sin(ang) * 380, r: 10};
            espera = 0.8;
        };
        const reiniciar = () => {
            esq = {y: A / 2};
            dir = {y: A / 2};
            placar = [0, 0];
            saque(Math.random() < 0.5 ? -1 : 1);
            fase = 'jogando';
        };

        const tecla = k => {
            if (fase === 'menu' || fase === 'fim') {
                if (k === '1') modo = 1;
                if (k === '2') modo = 2;
                if (k === ' ' || k === 'Enter' || k === '1' || k === '2') {
                    api.audio();
                    reiniciar();
                }
            }
        };

        api.laco(dt => {
            if (fase === 'jogando') {
                const v = 460 * dt;
                const sobe1 = modo === 1 ? api.apertada('w', 'ArrowUp') : api.apertada('w');
                const desce1 = modo === 1 ? api.apertada('s', 'ArrowDown') : api.apertada('s');
                if (sobe1) esq.y -= v;
                if (desce1) esq.y += v;
                if (modo === 2) {
                    if (api.apertada('ArrowUp')) dir.y -= v;
                    if (api.apertada('ArrowDown')) dir.y += v;
                } else {
                    // computador: segue a bola com um pouco de atraso (dá para ganhar!)
                    const alvo = bola.vx > 0 ? bola.y : A / 2;
                    const vel = (300 + placar[0] * 25) * dt;
                    dir.y += Math.max(-vel, Math.min(vel, alvo - dir.y));
                }
                esq.y = Math.max(RAQ_A / 2, Math.min(A - RAQ_A / 2, esq.y));
                dir.y = Math.max(RAQ_A / 2, Math.min(A - RAQ_A / 2, dir.y));

                if (espera > 0) {
                    espera -= dt;
                } else {
                    bola.x += bola.vx * dt;
                    bola.y += bola.vy * dt;
                    if (bola.y < bola.r || bola.y > A - bola.r) {
                        bola.vy *= -1;
                        bola.y = Math.max(bola.r, Math.min(A - bola.r, bola.y));
                        bip(api.audio(), 300, 0.04, 'square', 0.05);
                    }
                    const rebater = (raq, x, lado) => {
                        if (Math.abs(bola.x - x) < RAQ_L / 2 + bola.r && Math.abs(bola.y - raq.y) < RAQ_A / 2 + bola.r &&
                            Math.sign(bola.vx) === -lado) {
                            const rel = (bola.y - raq.y) / (RAQ_A / 2);
                            const vel = Math.min(900, Math.hypot(bola.vx, bola.vy) * 1.06);
                            const ang = rel * 0.95;
                            bola.vx = Math.cos(ang) * vel * lado;
                            bola.vy = Math.sin(ang) * vel;
                            bip(api.audio(), 520 + Math.abs(rel) * 200, 0.05, 'square', 0.08);
                        }
                    };
                    rebater(esq, 40, 1);
                    rebater(dir, L - 40, -1);
                    if (bola.x < -30 || bola.x > L + 30) {
                        const quem = bola.x < 0 ? 1 : 0;
                        placar[quem]++;
                        bip(api.audio(), quem === 0 ? 880 : 200, 0.2, 'triangle', 0.12);
                        if (placar[quem] >= VENCE) {
                            fase = 'fim';
                            if (modo === 1 && quem === 0) {
                                api.registrar(api.recorde() + 1);
                            }
                        } else {
                            saque(quem === 0 ? 1 : -1);
                        }
                    }
                }
            }

            ctx.fillStyle = '#16304F';
            ctx.fillRect(0, 0, L, A);
            ctx.strokeStyle = 'rgba(255,255,255,.35)';
            ctx.lineWidth = 4;
            ctx.setLineDash([14, 14]);
            ctx.beginPath();
            ctx.moveTo(L / 2, 0);
            ctx.lineTo(L / 2, A);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.strokeRect(10, 10, L - 20, A - 20);
            if (fase !== 'menu') {
                texto(ctx, String(placar[0]), L / 2 - 80, 60, {tam: 56, cor: '#C9B6F0'});
                texto(ctx, String(placar[1]), L / 2 + 80, 60, {tam: 56, cor: '#FFB27A'});
                ctx.fillStyle = '#7A4FC8';
                retRedondo(ctx, 40 - RAQ_L / 2, esq.y - RAQ_A / 2, RAQ_L, RAQ_A, 8);
                ctx.fill();
                ctx.fillStyle = '#E8742C';
                retRedondo(ctx, L - 40 - RAQ_L / 2, dir.y - RAQ_A / 2, RAQ_L, RAQ_A, 8);
                ctx.fill();
                ctx.fillStyle = '#FFC928';
                ctx.beginPath();
                ctx.arc(bola.x, bola.y, bola.r, 0, Math.PI * 2);
                ctx.fill();
            }
            if (fase === 'menu' || fase === 'fim') {
                ctx.fillStyle = 'rgba(15,8,40,.65)';
                ctx.fillRect(0, 0, L, A);
                if (fase === 'fim') {
                    const ganhou = placar[0] > placar[1];
                    const msg = modo === 2 ? (ganhou ? 'Jogador da esquerda venceu!' : 'Jogador da direita venceu!') :
                        (ganhou ? 'Você venceu! 🎉' : 'O computador venceu…');
                    texto(ctx, msg, L / 2, 150, {tam: 46, cor: '#FFC928'});
                } else {
                    texto(ctx, 'Pingue-Coruja', L / 2, 150, {tam: 56, cor: '#FFC928'});
                }
                texto(ctx, `Aperte 1 para jogar contra o computador`, L / 2, 260, {tam: 26});
                texto(ctx, `Aperte 2 para jogar com um amigo`, L / 2, 305, {tam: 26});
                texto(ctx, `🏆 Vitórias contra o computador: ${api.recorde()}`, L / 2, 380, {tam: 20, cor: '#7CFF8A'});
            }
        });
        return {tecla};
    }
};
