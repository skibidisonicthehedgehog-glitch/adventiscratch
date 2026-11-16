/**
 * Batalha de Ritmo: a Coruja contra o Tucano DJ.
 * O Tucano canta uma frase, depois é a sua vez de repetir apertando as setas no tempo da música.
 * A música é composta e tocada na hora com Web Audio; as setas saem das notas da melodia.
 */
import {texto, coruja, retRedondo, bip} from './comum.js';

const BPM = 120;
const SPB = 60 / BPM; // segundos por batida
const INTRO = 8; // batidas antes da primeira frase
const FINAL = 4;

// escala pentatônica (C D E G A C D E), em Hz
const ESCALA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
// acordes por compasso de 2 batidas (Lá menor, Fá, Dó, Sol)
const ACORDES = [
    {raiz: 110.0, notas: [220.0, 261.63, 329.63]},
    {raiz: 87.31, notas: [174.61, 220.0, 261.63]},
    {raiz: 130.81, notas: [196.0, 261.63, 329.63]},
    {raiz: 98.0, notas: [196.0, 246.94, 293.66]}
];
// frases de 8 batidas: [batida, grau da escala]
const FRASES = [
    [[0, 4], [1, 3], [1.5, 4], [2, 5], [3, 4], [4, 2], [5, 3], [5.5, 2], [6, 1], [7, 0]],
    [[0, 0], [0.5, 1], [1, 2], [2, 4], [3, 3], [4, 4], [4.5, 5], [5, 6], [6, 5], [6.5, 4], [7, 3]],
    [[0, 5], [1, 5], [1.5, 4], [2, 3], [2.5, 2], [3, 3], [4, 7], [5, 6], [5.5, 5], [6, 4], [7, 5]],
    [[0, 2], [0.5, 3], [1, 4], [1.5, 5], [2, 6], [3, 5], [4, 4], [4.5, 3], [5, 2], [5.5, 1], [6, 0], [7, 0]]
];

const DIFICULDADES = [
    {nome: 'Fácil', vel: 380, janela: 0.16, cor: '#5BBF4A'},
    {nome: 'Normal', vel: 470, janela: 0.135, cor: '#FFC928'},
    {nome: 'Difícil', vel: 600, janela: 0.11, cor: '#FF5A5A'}
];
const SETAS_COR = ['#C24BCF', '#00C4E8', '#12FA05', '#F9393F'];
const SETAS_ANG = [Math.PI, Math.PI / 2, -Math.PI / 2, 0]; // ← ↓ ↑ →
const POSES = ['esquerda', 'baixo', 'cima', 'direita'];
const TECLAS = {ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3, d: 0, f: 1, j: 2, k: 3, a: 0, s: 1, w: 2};

const montarNotas = dif => {
    const notas = [];
    FRASES.forEach((frase, i) => {
        for (const quem of ['op', 'eu']) {
            const inicio = INTRO + i * 16 + (quem === 'eu' ? 8 : 0);
            for (const [b, grau] of frase) {
                if (dif === 0 && b % 1 !== 0) continue;
                notas.push({b: inicio + b, lane: grau % 4, grau, quem, estado: null});
                if (dif === 2 && (b === 0 || b === 4)) {
                    notas.push({b: inicio + b, lane: (grau + 2) % 4, grau: grau + 2 > 7 ? grau - 2 : grau + 2,
                        quem, estado: null, extra: true});
                }
            }
        }
    });
    notas.forEach(n => {
        n.t = n.b * SPB;
    });
    return notas;
};
const TOTAL_BATIDAS = INTRO + FRASES.length * 16 + FINAL;

// ---------- sons ----------

const tocarNota = (audio, saida, freq, t, dur, tipo, vol) => {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(saida);
    o.start(t);
    o.stop(t + dur + 0.05);
};

const ruido = audio => {
    const buf = audio.createBuffer(1, audio.sampleRate * 0.3, audio.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
};

const bumbo = (audio, saida, t) => {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(saida);
    o.start(t);
    o.stop(t + 0.3);
};

const caixa = (audio, saida, buf, t, vol = 0.35, dur = 0.16, freq = 1800) => {
    const s = audio.createBufferSource();
    s.buffer = buf;
    const f = audio.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = freq;
    const g = audio.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(saida);
    s.start(t);
    s.stop(t + dur + 0.02);
};

const agendarMusica = (audio, saida, t0, notas) => {
    const buf = ruido(audio);
    for (let b = 0; b < TOTAL_BATIDAS; b++) {
        const t = t0 + b * SPB;
        const fim = b >= TOTAL_BATIDAS - FINAL;
        // bateria
        if (b >= 4 || b % 2 === 0) bumbo(audio, saida, t);
        if (b >= INTRO && b % 2 === 1) caixa(audio, saida, buf, t);
        if (b >= 4) {
            caixa(audio, saida, buf, t, 0.08, 0.04, 7000);
            caixa(audio, saida, buf, t + SPB / 2, 0.06, 0.04, 7000);
        }
        if (b < INTRO - 4 || fim) continue;
        // baixo e acordes
        const acorde = ACORDES[Math.floor((b - INTRO + 8) / 2) % 4];
        tocarNota(audio, saida, acorde.raiz, t, SPB * 0.45, 'sawtooth', 0.12);
        tocarNota(audio, saida, acorde.raiz * 2, t + SPB / 2, SPB * 0.4, 'sawtooth', 0.08);
        if (b % 2 === 0) {
            for (const n of acorde.notas) tocarNota(audio, saida, n, t, SPB * 1.9, 'triangle', 0.035);
        }
    }
    // a voz do Tucano já fica agendada
    for (const n of notas) {
        if (n.quem === 'op') tocarNota(audio, saida, ESCALA[n.grau], t0 + n.t, 0.22, 'square', 0.07);
    }
};

// ---------- desenho ----------

const seta = (ctx, x, y, lane, tam, {cor = SETAS_COR[lane], alfa = 1, vazia = false, brilho = 0} = {}) => {
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.translate(x, y);
    ctx.rotate(SETAS_ANG[lane]);
    const s = tam / 2;
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.lineTo(0, -s);
    ctx.lineTo(0, -s * 0.45);
    ctx.lineTo(-s, -s * 0.45);
    ctx.lineTo(-s, s * 0.45);
    ctx.lineTo(0, s * 0.45);
    ctx.lineTo(0, s);
    ctx.closePath();
    ctx.lineJoin = 'round';
    if (brilho > 0) {
        ctx.shadowColor = cor;
        ctx.shadowBlur = 25 * brilho;
    }
    if (vazia) {
        ctx.fillStyle = 'rgba(160,160,190,.35)';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(30,20,60,.8)';
        ctx.stroke();
    } else {
        ctx.fillStyle = cor;
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#1B1338';
        ctx.stroke();
    }
    ctx.restore();
};

const tucano = (ctx, x, y, escala, pose) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(escala, escala);
    let inc = 0;
    let dy = 0;
    if (pose === 'esquerda') inc = -0.15;
    if (pose === 'direita') inc = 0.15;
    if (pose === 'baixo') dy = 8;
    if (pose === 'cima') dy = -10;
    ctx.translate(0, dy);
    ctx.rotate(inc);
    ctx.fillStyle = '#18161F';
    ctx.beginPath();
    ctx.ellipse(0, -50, 32, 50, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFF5D6';
    ctx.beginPath();
    ctx.ellipse(0, -62, 22, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#E8392C';
    ctx.beginPath();
    ctx.ellipse(0, -30, 16, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // bico grande
    const abre = pose && pose !== 'normal' ? 6 : 0;
    ctx.fillStyle = '#FF9F1C';
    ctx.beginPath();
    ctx.moveTo(10, -80);
    ctx.quadraticCurveTo(70, -84, 78, -66 - abre / 2);
    ctx.quadraticCurveTo(50, -66, 10, -68);
    ctx.fill();
    ctx.fillStyle = '#FFD23F';
    ctx.beginPath();
    ctx.moveTo(10, -68 + abre);
    ctx.quadraticCurveTo(50, -64 + abre, 74, -62 + abre);
    ctx.quadraticCurveTo(40, -54 + abre, 10, -60 + abre);
    ctx.fill();
    ctx.fillStyle = '#18161F';
    ctx.beginPath();
    ctx.ellipse(70, -64, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // olho
    ctx.fillStyle = '#4FC3F7';
    ctx.beginPath();
    ctx.arc(2, -84, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#18161F';
    ctx.beginPath();
    ctx.arc(4, -84, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // fones de DJ
    ctx.strokeStyle = '#E8742C';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, -82, 30, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.fillStyle = '#E8742C';
    retRedondo(ctx, -36, -92, 12, 22, 5);
    ctx.fill();
    // asa
    ctx.fillStyle = '#2C2838';
    ctx.save();
    ctx.translate(-26, -50);
    ctx.rotate(pose === 'cima' || pose === 'esquerda' ? -1 : 0.25);
    ctx.beginPath();
    ctx.ellipse(-6, 10, 10, 24, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#FF9F1C';
    ctx.fillRect(-15, -4, 10, 5);
    ctx.fillRect(5, -4, 10, 5);
    ctx.restore();
};

const caixaSom = (ctx, x, y, pulso) => {
    ctx.fillStyle = '#2B2148';
    retRedondo(ctx, x - 40, y - 110, 80, 110, 8);
    ctx.fill();
    for (const [cy, r] of [[-78, 22], [-30, 16]]) {
        ctx.fillStyle = '#120C26';
        ctx.beginPath();
        ctx.arc(x, y + cy, r + pulso * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4B3B85';
        ctx.beginPath();
        ctx.arc(x, y + cy, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }
};

// ---------- jogo ----------

export default {
    id: 'ritmo',
    nome: 'Batalha de Ritmo',
    emoji: '🎤🦉',
    cor: 'linear-gradient(135deg,#C24BCF,#6D4FC2)',
    descricao: 'O Tucano DJ canta, você responde! Aperte as setas no tempo certo da música.',
    controles: '<span><kbd>←</kbd><kbd>↓</kbd><kbd>↑</kbd><kbd>→</kbd> ou <kbd>D</kbd><kbd>F</kbd><kbd>J</kbd><kbd>K</kbd> ' +
        'tocam as setas</span><span><kbd>Espaço</kbd> começa</span>',
    iniciar (ctx, api) {
        const L = api.largura;
        const A = api.altura;
        const RECEP_Y = 80;
        const LANE_X = {op: [70, 150, 230, 310], eu: [L - 310, L - 230, L - 150, L - 70]};
        let fase = 'menu';
        let dif = 1;
        let notas = [];
        let audio = null;
        let mestre = null;
        let t0 = 0;
        let vida = 0.5;
        let pontos = 0;
        let combo = 0;
        let maiorCombo = 0;
        let acertos = {perfeito: 0, bom: 0, ok: 0, errou: 0};
        let julgamento = null; // {txt, cor, ate}
        let poseEu = {pose: 'normal', ate: 0};
        let poseOp = {pose: 'normal', ate: 0};
        const brilhoRecep = [0, 0, 0, 0];
        const apertada = [false, false, false, false];
        let novoRecorde = false;
        let fimEm = 0;

        const agora = () => {
            if (!audio) return 0;
            const lat = (audio.outputLatency || 0) + (audio.baseLatency || 0);
            return audio.currentTime - lat - t0;
        };

        const pararMusica = () => {
            if (mestre) {
                try {
                    mestre.disconnect();
                } catch (e) { /* já desligado */ }
                mestre = null;
            }
        };

        const comecar = () => {
            audio = api.audio();
            if (!audio) return;
            pararMusica();
            mestre = audio.createGain();
            mestre.gain.value = 0.8;
            mestre.connect(audio.destination);
            notas = montarNotas(dif);
            t0 = audio.currentTime + 0.4;
            agendarMusica(audio, mestre, t0, notas);
            vida = 0.5;
            pontos = 0;
            combo = 0;
            maiorCombo = 0;
            acertos = {perfeito: 0, bom: 0, ok: 0, errou: 0};
            julgamento = null;
            fase = 'jogando';
        };

        const terminar = venceu => {
            fase = venceu ? 'venceu' : 'perdeu';
            fimEm = performance.now();
            if (!venceu) pararMusica();
            novoRecorde = venceu ? api.registrar(pontos) : false;
        };

        const julgar = (n, erro) => {
            const d = DIFICULDADES[dif];
            const e = Math.abs(erro);
            let tipo;
            if (e <= d.janela * 0.35) tipo = ['perfeito', 'PERFEITO!', '#7CFF8A', 350, 0.045];
            else if (e <= d.janela * 0.65) tipo = ['bom', 'Bom!', '#7FD3FF', 200, 0.03];
            else tipo = ['ok', 'Ok', '#FFC928', 100, 0.012];
            n.estado = 'acertou';
            acertos[tipo[0]]++;
            combo++;
            maiorCombo = Math.max(maiorCombo, combo);
            pontos += tipo[3] + Math.min(combo, 50) * 4;
            vida = Math.min(1, vida + tipo[4]);
            julgamento = {txt: tipo[1], cor: tipo[2], ate: performance.now() + 450};
            // a voz da coruja só sai quando você acerta
            tocarNota(audio, mestre || audio.destination, ESCALA[n.grau] * 2, audio.currentTime, 0.2, 'triangle', 0.16);
        };

        const errou = n => {
            n.estado = 'errou';
            acertos.errou++;
            combo = 0;
            vida -= 0.08;
            julgamento = {txt: 'Errou', cor: '#FF5A5A', ate: performance.now() + 450};
            poseEu = {pose: 'errou', ate: performance.now() + 350};
            bip(audio, 110, 0.15, 'sawtooth', 0.08);
            if (vida <= 0) terminar(false);
        };

        const tecla = k => {
            if (fase === 'menu') {
                if (k === 'ArrowLeft') dif = (dif + 2) % 3;
                if (k === 'ArrowRight') dif = (dif + 1) % 3;
                if (k === ' ' || k === 'Enter') comecar();
                return;
            }
            if (fase === 'venceu' || fase === 'perdeu') {
                if ((k === ' ' || k === 'Enter') && performance.now() - fimEm > 600) {
                    pararMusica();
                    fase = 'menu';
                }
                return;
            }
            const lane = TECLAS[k];
            if (lane === undefined) return;
            apertada[lane] = true;
            setTimeout(() => {
                apertada[lane] = false;
            }, 110);
            const t = agora();
            const janela = DIFICULDADES[dif].janela;
            let melhor = null;
            for (const n of notas) {
                if (n.quem !== 'eu' || n.estado || n.lane !== lane) continue;
                const erro = t - n.t;
                if (Math.abs(erro) <= janela && (!melhor || Math.abs(erro) < Math.abs(t - melhor.t))) melhor = n;
            }
            poseEu = {pose: POSES[lane], ate: performance.now() + 250};
            if (melhor) {
                julgar(melhor, t - melhor.t);
                brilhoRecep[lane] = 1;
            }
        };

        const desenharFundo = (batida, pulso) => {
            const g = ctx.createLinearGradient(0, 0, 0, A);
            g.addColorStop(0, '#2B1A5E');
            g.addColorStop(1, '#5B2A7A');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, L, A);
            // luzes do palco
            for (let i = 0; i < 6; i++) {
                const x = 80 + i * 160;
                const a = 0.06 + 0.06 * pulso * ((i + Math.floor(batida)) % 2);
                ctx.fillStyle = `rgba(255,${180 + i * 10},80,${a})`;
                ctx.beginPath();
                ctx.moveTo(x - 10, 0);
                ctx.lineTo(x + 10, 0);
                ctx.lineTo(x + 90, A);
                ctx.lineTo(x - 90, A);
                ctx.fill();
            }
            ctx.fillStyle = '#1B1338';
            ctx.fillRect(0, A - 70, L, 70);
            ctx.fillStyle = '#3A2C70';
            ctx.fillRect(0, A - 70, L, 6);
            caixaSom(ctx, L / 2 - 70, A - 64, pulso);
            caixaSom(ctx, L / 2 + 70, A - 64, pulso);
        };

        const desenharFaixa = (quem, t) => {
            const xs = LANE_X[quem];
            const vel = DIFICULDADES[dif].vel;
            for (let i = 0; i < 4; i++) {
                const brilho = quem === 'eu' ? brilhoRecep[i] : 0;
                seta(ctx, xs[i], RECEP_Y, i, 68, {vazia: !(quem === 'eu' && apertada[i]) && brilho < 0.3,
                    brilho, cor: SETAS_COR[i]});
            }
            for (const n of notas) {
                if (n.quem !== quem) continue;
                const y = RECEP_Y + (n.t - t) * vel;
                if (y > A + 50 || y < RECEP_Y - 60) continue;
                if (n.estado === 'acertou') continue;
                if (quem === 'op' && n.t <= t) continue;
                seta(ctx, xs[n.lane], y, n.lane, 66, {alfa: n.estado === 'errou' ? 0.35 : 1});
            }
        };

        const desenharHud = () => {
            // barra de vida
            const bx = L / 2 - 200;
            const by = A - 40;
            ctx.fillStyle = '#1B1338';
            retRedondo(ctx, bx - 4, by - 4, 408, 22, 10);
            ctx.fill();
            ctx.fillStyle = '#E8742C';
            retRedondo(ctx, bx, by, 400, 14, 7);
            ctx.fill();
            ctx.fillStyle = '#7A4FC8';
            retRedondo(ctx, bx + 400 * (1 - vida), by, 400 * vida, 14, 7);
            ctx.fill();
            texto(ctx, `Pontos: ${pontos}`, L / 2, A - 58, {tam: 18});
            texto(ctx, `Combo ${combo}`, L - 20, A - 30, {tam: 18, alinhar: 'right'});
            texto(ctx, `Erros ${acertos.errou}`, 20, A - 30, {tam: 18, alinhar: 'left'});
        };

        api.laco(() => {
            const t = fase === 'jogando' || fase === 'venceu' ? agora() : performance.now() / 1000;
            const batida = t / SPB;
            const pulso = Math.max(0, 1 - (batida - Math.floor(batida)) * 3);

            if (fase === 'jogando') {
                for (const n of notas) {
                    if (n.estado) continue;
                    if (n.quem === 'eu' && t - n.t > DIFICULDADES[dif].janela) errou(n);
                    if (n.quem === 'op' && t >= n.t) {
                        n.estado = 'cantou';
                        poseOp = {pose: POSES[n.lane], ate: performance.now() + 250};
                    }
                    if (fase !== 'jogando') break;
                }
                if (fase === 'jogando' && batida >= TOTAL_BATIDAS) terminar(true);
            }
            for (let i = 0; i < 4; i++) brilhoRecep[i] = Math.max(0, brilhoRecep[i] - 0.08);

            desenharFundo(batida, pulso);
            const agoraMs = performance.now();
            const bob = 1 + 0.025 * pulso;
            tucano(ctx, 250, A - 64, 1.5 * bob, poseOp.ate > agoraMs ? poseOp.pose : 'normal');
            coruja(ctx, L - 250, A - 64, 1.5 * bob, {pose: poseEu.ate > agoraMs ? poseEu.pose : 'normal', virada: -1});

            if (fase === 'menu') {
                ctx.fillStyle = 'rgba(15,8,40,.6)';
                ctx.fillRect(0, 0, L, A);
                texto(ctx, 'Batalha de Ritmo', L / 2, 110, {tam: 60, cor: '#FFC928'});
                texto(ctx, 'O Tucano DJ canta uma frase. Depois é a sua vez de repetir!', L / 2, 175, {tam: 22});
                for (let i = 0; i < 4; i++) seta(ctx, L / 2 - 120 + i * 80, 245, i, 60);
                texto(ctx, 'Aperte a seta quando ela chegar na de cima', L / 2, 300, {tam: 20, cor: '#D9CCFF'});
                DIFICULDADES.forEach((d, i) => {
                    const x = L / 2 + (i - 1) * 190;
                    ctx.fillStyle = i === dif ? d.cor : 'rgba(255,255,255,.12)';
                    retRedondo(ctx, x - 80, 335, 160, 50, 14);
                    ctx.fill();
                    texto(ctx, d.nome, x, 360, {tam: 24, cor: i === dif ? '#1B1338' : '#fff', contorno: i === dif ? null : '#1B1338'});
                });
                texto(ctx, '← → escolhe · ESPAÇO começa', L / 2, 415, {tam: 20});
                texto(ctx, `🏆 Recorde: ${api.recorde()}`, L / 2, 455, {tam: 20, cor: '#7CFF8A'});
                return;
            }

            desenharFaixa('op', t);
            desenharFaixa('eu', t);

            // contagem e de quem é a vez
            if (batida >= 4 && batida < INTRO) {
                const c = ['3', '2', '1', 'Vai!'][Math.floor(batida) - 4];
                texto(ctx, c, L / 2, A / 2 - 40, {tam: 90 + pulso * 20, cor: '#FFC928'});
            } else if (batida >= INTRO && batida < TOTAL_BATIDAS - FINAL) {
                const sec = Math.floor((batida - INTRO) / 8) % 2;
                texto(ctx, sec === 0 ? 'Vez do Tucano 🎧' : 'Sua vez! 🦉', L / 2, 40,
                    {tam: 26, cor: sec === 0 ? '#FF9F1C' : '#C9B6F0'});
            }
            if (julgamento && julgamento.ate > agoraMs) {
                const sobe = (julgamento.ate - agoraMs) / 450;
                texto(ctx, julgamento.txt, L - 190, 190 + sobe * 12, {tam: 36, cor: julgamento.cor});
                if (combo >= 5) texto(ctx, `${combo}x`, L - 190, 232, {tam: 24});
            }
            desenharHud();

            if (fase === 'venceu' || fase === 'perdeu') {
                ctx.fillStyle = 'rgba(15,8,40,.75)';
                ctx.fillRect(0, 0, L, A);
                texto(ctx, fase === 'venceu' ? 'Você venceu a batalha! 🎉' : 'O Tucano venceu essa…', L / 2, 120,
                    {tam: 48, cor: fase === 'venceu' ? '#FFC928' : '#FF9F1C'});
                texto(ctx, `Pontos: ${pontos}`, L / 2, 195, {tam: 32});
                texto(ctx, `Perfeito ${acertos.perfeito} · Bom ${acertos.bom} · Ok ${acertos.ok} · Erros ${acertos.errou}`,
                    L / 2, 245, {tam: 22, cor: '#D9CCFF'});
                texto(ctx, `Maior combo: ${maiorCombo}`, L / 2, 285, {tam: 22, cor: '#D9CCFF'});
                if (novoRecorde) texto(ctx, '🏆 Novo recorde!', L / 2, 330, {tam: 26, cor: '#7CFF8A'});
                texto(ctx, 'ESPAÇO para voltar', L / 2, 400, {tam: 22});
            }
        });

        // para depurar pelo console (F12)
        window.adventiscratchRitmo = {notas: () => notas, agora, fase: () => fase, placar: () => ({pontos, acertos})};
        return {
            tecla,
            parar: () => {
                pararMusica();
                delete window.adventiscratchRitmo;
            }
        };
    }
};
