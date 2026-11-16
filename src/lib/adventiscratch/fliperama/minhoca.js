/**
 * Minhoca Faminha: coma as frutas e cresça, sem bater em você mesma nem nas bordas.
 */
import {texto, bip, telaFim} from './comum.js';

const C = 30;
const COLS = 32;
const LIN = 17;
const DIRS = {ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0]};

export default {
    id: 'minhoca',
    nome: 'Minhoca Faminha',
    emoji: '🐛🍎',
    cor: 'linear-gradient(135deg,#FF5A5A,#FFB020)',
    descricao: 'Coma as frutas para crescer. Não bata nas bordas nem no próprio corpo!',
    controles: '<span><kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> ou <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> viram</span>',
    iniciar (ctx, api) {
        const L = api.largura;
        const A = api.altura;
        const OY = A - LIN * C;
        let corpo;
        let dir;
        let filaDir;
        let fruta;
        let pontos;
        let tempo;
        let fase;
        let fimEm = 0;
        let novoRecorde = false;

        const novaFruta = () => {
            let f;
            do {
                f = {x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * LIN),
                    tipo: Math.floor(Math.random() * 3)};
            } while (corpo.some(c => c.x === f.x && c.y === f.y));
            return f;
        };
        const reiniciar = () => {
            corpo = [{x: 8, y: 8}, {x: 7, y: 8}, {x: 6, y: 8}];
            dir = [1, 0];
            filaDir = [];
            fruta = novaFruta();
            pontos = 0;
            tempo = 0;
            fase = 'pronto';
        };
        reiniciar();

        const tecla = k => {
            if (fase === 'fim') {
                if ((k === ' ' || k === 'Enter') && performance.now() - fimEm > 500) reiniciar();
                return;
            }
            const d = DIRS[k];
            if (!d) return;
            if (fase === 'pronto') {
                fase = 'jogando';
                api.audio();
            }
            const ultima = filaDir.length ? filaDir[filaDir.length - 1] : dir;
            if (d[0] === -ultima[0] && d[1] === -ultima[1]) return;
            if (filaDir.length < 3) filaDir.push(d);
        };

        api.laco(dt => {
            if (fase === 'jogando') {
                tempo += dt;
                const intervalo = Math.max(0.06, 0.13 - corpo.length * 0.0015);
                while (tempo >= intervalo && fase === 'jogando') {
                    tempo -= intervalo;
                    if (filaDir.length) dir = filaDir.shift();
                    const cab = {x: corpo[0].x + dir[0], y: corpo[0].y + dir[1]};
                    const bate = cab.x < 0 || cab.y < 0 || cab.x >= COLS || cab.y >= LIN ||
                        corpo.slice(0, -1).some(c => c.x === cab.x && c.y === cab.y);
                    if (bate) {
                        fase = 'fim';
                        fimEm = performance.now();
                        novoRecorde = api.registrar(pontos);
                        bip(api.audio(), 130, 0.4, 'sawtooth', 0.1);
                        break;
                    }
                    corpo.unshift(cab);
                    if (cab.x === fruta.x && cab.y === fruta.y) {
                        pontos += 10;
                        fruta = novaFruta();
                        bip(api.audio(), 760 + corpo.length * 4, 0.07, 'triangle', 0.12);
                    } else {
                        corpo.pop();
                    }
                }
            }
            ctx.fillStyle = '#1B1338';
            ctx.fillRect(0, 0, L, A);
            for (let y = 0; y < LIN; y++) {
                for (let x = 0; x < COLS; x++) {
                    ctx.fillStyle = (x + y) % 2 ? '#A7D948' : '#8ECC39';
                    ctx.fillRect(x * C, OY + y * C, C, C);
                }
            }
            // fruta
            const fx = fruta.x * C + C / 2;
            const fy = OY + fruta.y * C + C / 2;
            ctx.fillStyle = ['#E53935', '#FFB020', '#8E44AD'][fruta.tipo];
            ctx.beginPath();
            ctx.arc(fx, fy + 2, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#2E7D32';
            ctx.fillRect(fx - 1, fy - 13, 3, 7);
            // corpo
            corpo.forEach((c, i) => {
                const t = 1 - i / (corpo.length + 4);
                ctx.fillStyle = `rgb(${Math.round(232 * t + 120 * (1 - t))},${Math.round(116 * t + 60 * (1 - t))},200)`;
                ctx.beginPath();
                ctx.arc(c.x * C + C / 2, OY + c.y * C + C / 2, C / 2 - (i ? 2 : 0), 0, Math.PI * 2);
                ctx.fill();
            });
            const cab = corpo[0];
            ctx.fillStyle = '#fff';
            const ex = cab.x * C + C / 2 + dir[0] * 5;
            const ey = OY + cab.y * C + C / 2 + dir[1] * 5;
            for (const s of [-1, 1]) {
                ctx.beginPath();
                ctx.arc(ex + dir[1] * 6 * s, ey + dir[0] * 6 * s, 4.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = '#1B1338';
            for (const s of [-1, 1]) {
                ctx.beginPath();
                ctx.arc(ex + dir[1] * 6 * s + dir[0] * 1.5, ey + dir[0] * 6 * s + dir[1] * 1.5, 2.2, 0, Math.PI * 2);
                ctx.fill();
            }
            texto(ctx, `🍎 ${pontos}`, 16, OY / 2, {tam: 24, alinhar: 'left'});
            texto(ctx, 'Minhoca Faminha', L / 2, OY / 2, {tam: 26, cor: '#FFC928'});
            texto(ctx, `🏆 ${api.recorde()}`, L - 16, OY / 2, {tam: 22, alinhar: 'right', cor: '#7CFF8A'});
            if (fase === 'pronto') texto(ctx, 'Aperte uma seta para começar', L / 2, A / 2, {tam: 30});
            if (fase === 'fim') telaFim(ctx, api, 'Ops! A minhoca bateu', pontos, novoRecorde);
        });
        return {tecla};
    }
};
