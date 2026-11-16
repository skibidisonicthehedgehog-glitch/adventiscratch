/**
 * Empilha Blocos: peças caem, você gira e encaixa. Linha completa some e dá pontos.
 */
import {texto, retRedondo, bip, telaFim} from './comum.js';

const COLS = 10;
const LINHAS = 20;
const TAM = 25;
const PECAS = [
    {cor: '#00C4E8', f: [[0, 1], [1, 1], [2, 1], [3, 1]]},
    {cor: '#FFC928', f: [[1, 0], [2, 0], [1, 1], [2, 1]]},
    {cor: '#C24BCF', f: [[1, 0], [0, 1], [1, 1], [2, 1]]},
    {cor: '#5BBF4A', f: [[1, 0], [2, 0], [0, 1], [1, 1]]},
    {cor: '#F9393F', f: [[0, 0], [1, 0], [1, 1], [2, 1]]},
    {cor: '#3D6EF2', f: [[0, 0], [0, 1], [1, 1], [2, 1]]},
    {cor: '#E8742C', f: [[2, 0], [0, 1], [1, 1], [2, 1]]}
];

export default {
    id: 'empilha',
    nome: 'Empilha Blocos',
    emoji: '🟦🟨',
    cor: 'linear-gradient(135deg,#3D6EF2,#00C4E8)',
    descricao: 'Gire e encaixe as peças que caem. Complete linhas para elas sumirem!',
    controles: '<span><kbd>←</kbd><kbd>→</kbd> movem · <kbd>↑</kbd> gira · <kbd>↓</kbd> desce rápido · ' +
        '<kbd>Espaço</kbd> derruba</span>',
    iniciar (ctx, api) {
        const L = api.largura;
        const A = api.altura;
        const OX = L / 2 - (COLS * TAM) / 2;
        const OY = 20;
        let grade;
        let peca;
        let proxima;
        let pontos;
        let linhas;
        let nivel;
        let tempoQueda;
        let fase;
        let fimEm = 0;
        let novoRecorde = false;
        let saco = [];
        let piscando = null;

        const sortear = () => {
            if (!saco.length) saco = [0, 1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5);
            const i = saco.pop();
            return {tipo: i, f: PECAS[i].f.map(c => c.slice()), x: 3, y: 0};
        };
        const reiniciar = () => {
            grade = Array.from({length: LINHAS}, () => Array(COLS).fill(null));
            saco = [];
            peca = sortear();
            proxima = sortear();
            pontos = 0;
            linhas = 0;
            nivel = 1;
            tempoQueda = 0;
            fase = 'pronto';
        };
        reiniciar();

        const cabe = (f, x, y) => f.every(([cx, cy]) => {
            const gx = cx + x;
            const gy = cy + y;
            return gx >= 0 && gx < COLS && gy < LINHAS && (gy < 0 || !grade[gy][gx]);
        });
        const girar = () => {
            if (peca.tipo === 1) return;
            const tam = peca.tipo === 0 ? 4 : 3;
            const nova = peca.f.map(([x, y]) => [tam - 1 - y, x]);
            for (const chute of [0, -1, 1, -2, 2]) {
                if (cabe(nova, peca.x + chute, peca.y)) {
                    peca.f = nova;
                    peca.x += chute;
                    bip(api.audio(), 440, 0.04, 'square', 0.05);
                    return;
                }
            }
        };
        const fixar = () => {
            for (const [cx, cy] of peca.f) {
                if (cy + peca.y < 0) {
                    fase = 'fim';
                    fimEm = performance.now();
                    novoRecorde = api.registrar(pontos);
                    bip(api.audio(), 140, 0.4, 'sawtooth', 0.1);
                    return;
                }
                grade[cy + peca.y][cx + peca.x] = PECAS[peca.tipo].cor;
            }
            const cheias = [];
            for (let y = 0; y < LINHAS; y++) if (grade[y].every(Boolean)) cheias.push(y);
            if (cheias.length) {
                for (const y of cheias) {
                    grade.splice(y, 1);
                    grade.unshift(Array(COLS).fill(null));
                }
                linhas += cheias.length;
                pontos += [0, 100, 300, 500, 800][cheias.length] * nivel;
                nivel = 1 + Math.floor(linhas / 8);
                piscando = performance.now() + 200;
                bip(api.audio(), 880, 0.15, 'triangle', 0.12);
            } else {
                bip(api.audio(), 220, 0.04, 'square', 0.05);
            }
            peca = proxima;
            proxima = sortear();
            if (!cabe(peca.f, peca.x, peca.y)) {
                fase = 'fim';
                fimEm = performance.now();
                novoRecorde = api.registrar(pontos);
            }
        };
        const descer = () => {
            if (cabe(peca.f, peca.x, peca.y + 1)) {
                peca.y++;
                return true;
            }
            fixar();
            return false;
        };

        const tecla = k => {
            if (fase === 'pronto') {
                fase = 'jogando';
                api.audio();
                return;
            }
            if (fase === 'fim') {
                if (performance.now() - fimEm > 500 && (k === ' ' || k === 'Enter')) reiniciar();
                return;
            }
            if (k === 'ArrowLeft' && cabe(peca.f, peca.x - 1, peca.y)) peca.x--;
            if (k === 'ArrowRight' && cabe(peca.f, peca.x + 1, peca.y)) peca.x++;
            if (k === 'ArrowUp' || k === 'w') girar();
            if (k === 'ArrowDown') {
                if (descer()) pontos += 1;
                tempoQueda = 0;
            }
            if (k === ' ') {
                let n = 0;
                while (fase === 'jogando' && descer()) n++;
                pontos += n * 2;
            }
        };

        const quadrado = (x, y, cor) => {
            ctx.fillStyle = cor;
            ctx.fillRect(x + 1, y + 1, TAM - 2, TAM - 2);
            ctx.fillStyle = 'rgba(255,255,255,.3)';
            ctx.fillRect(x + 1, y + 1, TAM - 2, 5);
            ctx.fillStyle = 'rgba(0,0,0,.2)';
            ctx.fillRect(x + 1, y + TAM - 6, TAM - 2, 5);
        };

        api.laco(dt => {
            if (fase === 'jogando') {
                tempoQueda += dt;
                const intervalo = Math.max(0.08, 0.8 - (nivel - 1) * 0.07);
                if (tempoQueda >= intervalo) {
                    tempoQueda = 0;
                    descer();
                }
            }
            ctx.fillStyle = '#141032';
            ctx.fillRect(0, 0, L, A);
            ctx.fillStyle = piscando && piscando > performance.now() ? '#3A2C70' : '#1F1847';
            ctx.fillRect(OX, OY, COLS * TAM, LINHAS * TAM);
            ctx.strokeStyle = 'rgba(255,255,255,.05)';
            for (let x = 0; x <= COLS; x++) {
                ctx.beginPath();
                ctx.moveTo(OX + x * TAM, OY);
                ctx.lineTo(OX + x * TAM, OY + LINHAS * TAM);
                ctx.stroke();
            }
            for (let y = 0; y < LINHAS; y++) {
                for (let x = 0; x < COLS; x++) if (grade[y][x]) quadrado(OX + x * TAM, OY + y * TAM, grade[y][x]);
            }
            if (fase !== 'fim') {
                // sombra de onde a peça vai cair
                let sy = peca.y;
                while (cabe(peca.f, peca.x, sy + 1)) sy++;
                ctx.fillStyle = 'rgba(255,255,255,.12)';
                for (const [cx, cy] of peca.f) {
                    if (cy + sy >= 0) ctx.fillRect(OX + (cx + peca.x) * TAM + 1, OY + (cy + sy) * TAM + 1, TAM - 2, TAM - 2);
                }
                for (const [cx, cy] of peca.f) {
                    if (cy + peca.y >= 0) quadrado(OX + (cx + peca.x) * TAM, OY + (cy + peca.y) * TAM, PECAS[peca.tipo].cor);
                }
            }
            ctx.strokeStyle = '#6D4FC2';
            ctx.lineWidth = 4;
            ctx.strokeRect(OX - 2, OY - 2, COLS * TAM + 4, LINHAS * TAM + 4);
            // painel
            const px = OX + COLS * TAM + 40;
            ctx.fillStyle = '#1F1847';
            retRedondo(ctx, px, OY, 170, 120, 14);
            ctx.fill();
            texto(ctx, 'Próxima', px + 85, OY + 20, {tam: 18});
            for (const [cx, cy] of proxima.f) quadrado(px + 35 + cx * TAM, OY + 45 + cy * TAM, PECAS[proxima.tipo].cor);
            texto(ctx, `Pontos: ${pontos}`, px, OY + 160, {tam: 22, alinhar: 'left'});
            texto(ctx, `Linhas: ${linhas}`, px, OY + 195, {tam: 22, alinhar: 'left'});
            texto(ctx, `Nível: ${nivel}`, px, OY + 230, {tam: 22, alinhar: 'left'});
            texto(ctx, `🏆 ${api.recorde()}`, px, OY + 265, {tam: 20, alinhar: 'left', cor: '#7CFF8A'});
            texto(ctx, 'Empilha', OX - 140, 60, {tam: 36, cor: '#FFC928'});
            texto(ctx, 'Blocos', OX - 140, 100, {tam: 36, cor: '#FFC928'});
            if (fase === 'pronto') {
                ctx.fillStyle = 'rgba(15,8,40,.6)';
                ctx.fillRect(0, 0, L, A);
                texto(ctx, 'Aperte qualquer tecla para começar', L / 2, A / 2, {tam: 28});
            }
            if (fase === 'fim') telaFim(ctx, api, 'Fim de jogo!', pontos, novoRecorde);
        });
        return {tecla};
    }
};
