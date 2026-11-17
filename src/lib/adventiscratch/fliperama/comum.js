/**
 * Coisas usadas por vários jogos do fliperama: desenho da coruja, textos e sons simples.
 */

const FONTE = '"Helvetica Neue", Helvetica, Arial, sans-serif';

/** Texto com contorno, fácil de ler em cima de qualquer fundo. */
const texto = (ctx, str, x, y, {tam = 28, cor = '#fff', contorno = '#1B1338', alinhar = 'center', peso = 'bold'} = {}) => {
    ctx.save();
    ctx.font = `${peso} ${tam}px ${FONTE}`;
    ctx.textAlign = alinhar;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (contorno) {
        ctx.lineWidth = Math.max(3, tam / 6);
        ctx.strokeStyle = contorno;
        ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = cor;
    ctx.fillText(str, x, y);
    ctx.restore();
};

const retRedondo = (ctx, x, y, l, a, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + l, y, x + l, y + a, r);
    ctx.arcTo(x + l, y + a, x, y + a, r);
    ctx.arcTo(x, y + a, x, y, r);
    ctx.arcTo(x, y, x + l, y, r);
    ctx.closePath();
};

/**
 * Coruja (mascote do Adventiblocks). (x, y) = pés. pose: 'normal' | 'esquerda' | 'baixo' | 'cima' | 'direita'
 * | 'errou' | 'pulo'. piscar: 0..1
 */
const coruja = (ctx, x, y, escala = 1, {pose = 'normal', cor = '#7A4FC8', barriga = '#C9B6F0', virada = 1,
    capelo = true} = {}) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(escala * virada, escala);
    let inclina = 0;
    let dy = 0;
    if (pose === 'esquerda') inclina = -0.18;
    if (pose === 'direita') inclina = 0.18;
    if (pose === 'baixo') dy = 8;
    if (pose === 'cima') dy = -10;
    ctx.translate(0, dy);
    ctx.rotate(inclina);
    // corpo
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.ellipse(0, -46, 34, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    // orelhas
    ctx.beginPath();
    ctx.moveTo(-28, -80);
    ctx.lineTo(-22, -100);
    ctx.lineTo(-10, -86);
    ctx.moveTo(28, -80);
    ctx.lineTo(22, -100);
    ctx.lineTo(10, -86);
    ctx.fill();
    // barriga
    ctx.fillStyle = barriga;
    ctx.beginPath();
    ctx.ellipse(0, -30, 22, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    // asas
    ctx.fillStyle = '#5E38A8';
    const asaE = pose === 'esquerda' || pose === 'cima' ? -0.9 : (pose === 'pulo' ? -0.6 : 0.2);
    const asaD = pose === 'direita' || pose === 'cima' ? -0.9 : (pose === 'pulo' ? -0.6 : 0.2);
    ctx.save();
    ctx.translate(-30, -50);
    ctx.rotate(asaE);
    ctx.beginPath();
    ctx.ellipse(-8, 8, 10, 22, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(30, -50);
    ctx.rotate(-asaD);
    ctx.beginPath();
    ctx.ellipse(8, 8, 10, 22, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // olhos
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-13, -66, 13, 0, Math.PI * 2);
    ctx.arc(13, -66, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1B1338';
    if (pose === 'errou') {
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#1B1338';
        for (const ox of [-13, 13]) {
            ctx.beginPath();
            ctx.moveTo(ox - 6, -72);
            ctx.lineTo(ox + 6, -60);
            ctx.moveTo(ox + 6, -72);
            ctx.lineTo(ox - 6, -60);
            ctx.stroke();
        }
    } else {
        let ox = 2;
        let oy = 0;
        if (pose === 'esquerda') ox = -3;
        if (pose === 'direita') ox = 5;
        if (pose === 'cima') oy = -4;
        if (pose === 'baixo') oy = 4;
        ctx.beginPath();
        ctx.arc(-13 + ox, -66 + oy, 6, 0, Math.PI * 2);
        ctx.arc(13 + ox, -66 + oy, 6, 0, Math.PI * 2);
        ctx.fill();
    }
    // bico
    ctx.fillStyle = '#FFB020';
    ctx.beginPath();
    ctx.moveTo(-6, -54);
    ctx.lineTo(6, -54);
    ctx.lineTo(0, pose === 'normal' || pose === 'errou' ? -45 : -42);
    ctx.fill();
    // pés
    ctx.fillStyle = '#FFB020';
    ctx.fillRect(-16, -4, 10, 5);
    ctx.fillRect(6, -4, 10, 5);
    // capelo de formatura
    if (capelo) {
        ctx.fillStyle = '#1B1338';
        ctx.beginPath();
        ctx.moveTo(-26, -96);
        ctx.lineTo(0, -106);
        ctx.lineTo(26, -96);
        ctx.lineTo(0, -86);
        ctx.fill();
        ctx.fillRect(-12, -96, 24, 8);
        ctx.strokeStyle = '#FFC928';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -96);
        ctx.lineTo(20, -92);
        ctx.lineTo(20, -80);
        ctx.stroke();
    }
    ctx.restore();
};

/** Estrela de 5 pontas */
const estrela = (ctx, x, y, r, cor = '#FFC928', giro = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(giro);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const rr = i % 2 ? r * 0.45 : r;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = cor;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#C99400';
    ctx.stroke();
    ctx.restore();
};

/** Bip curto (efeitos sonoros). */
const bip = (audio, freq = 660, dur = 0.08, tipo = 'square', vol = 0.12, quando = 0) => {
    if (!audio) return;
    const t = quando || audio.currentTime;
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
};

/** Tela de "fim de jogo" com recorde. */
const telaFim = (ctx, api, titulo, pontos, novoRecorde, dica = 'Aperte ESPAÇO para jogar de novo') => {
    ctx.save();
    ctx.fillStyle = 'rgba(15,8,40,.72)';
    ctx.fillRect(0, 0, api.largura, api.altura);
    texto(ctx, titulo, api.largura / 2, api.altura / 2 - 70, {tam: 54, cor: '#FFC928'});
    texto(ctx, `Pontos: ${Math.floor(pontos)}`, api.largura / 2, api.altura / 2, {tam: 34});
    texto(ctx, novoRecorde ? '🏆 Novo recorde!' : `Recorde: ${api.recorde()}`, api.largura / 2, api.altura / 2 + 46,
        {tam: 24, cor: novoRecorde ? '#7CFF8A' : '#D9CCFF'});
    texto(ctx, dica, api.largura / 2, api.altura / 2 + 100, {tam: 20, cor: '#fff'});
    ctx.restore();
};

/** Gerador pseudoaleatório com semente (para mundos que se repetem). */
const aleatorio = semente => {
    let s = semente >>> 0;
    return () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

export {FONTE, texto, retRedondo, coruja, estrela, bip, telaFim, aleatorio};
