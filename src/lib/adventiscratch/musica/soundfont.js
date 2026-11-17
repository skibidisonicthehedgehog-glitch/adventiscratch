/**
 * Leitor de SoundFont 2 (.sf2) e tocador dos instrumentos extraídos.
 *
 * Um .sf2 tem várias "presets" (instrumentos). Ao importar, o aluno escolhe uma e o Adventiblocks
 * extrai só as amostras usadas por ela (um "instrumento extraído"), que vai dentro do .asp:
 *   {nome, origem, regioes: [{amostra, keyLo, keyHi, velLo, velHi, raiz, ajuste (cents), loop, loopIni, loopFim,
 *     ataque, segura, decai, sustenta, solta (segundos / nível), volume, pan}],
 *    amostras: [{nome, taxa, inicio, fim}]}  +  um Int16Array com todas as amostras juntas.
 */

const MAX_SF2_MB = 64;

const texto = (dv, pos, tam) => {
    let s = '';
    for (let i = 0; i < tam; i++) {
        const c = dv.getUint8(pos + i);
        if (c === 0) break;
        s += String.fromCharCode(c);
    }
    return s.trim();
};

/** Lê os blocos de um RIFF: devolve {id: {pos, tam}} (para LIST, usa "LIST:tipo"). */
const lerBlocos = (dv, pos, fim) => {
    const blocos = {};
    while (pos + 8 <= fim) {
        const id = texto(dv, pos, 4);
        const tam = dv.getUint32(pos + 4, true);
        if (id === 'LIST') {
            const tipo = texto(dv, pos + 8, 4);
            blocos[`LIST:${tipo}`] = {pos: pos + 12, tam: tam - 4};
        } else {
            blocos[id] = {pos: pos + 8, tam};
        }
        pos += 8 + tam + (tam % 2);
    }
    return blocos;
};

// números dos geradores do SF2 que usamos
const G = {
    startAddrsOffset: 0, endAddrsOffset: 1, startloopAddrsOffset: 2, endloopAddrsOffset: 3,
    startAddrsCoarseOffset: 4, pan: 17, delayVolEnv: 33, attackVolEnv: 34, holdVolEnv: 35, decayVolEnv: 36,
    sustainVolEnv: 37, releaseVolEnv: 38, instrument: 41, keyRange: 43, velRange: 44, endAddrsCoarseOffset: 12,
    startloopAddrsCoarseOffset: 45, initialAttenuation: 48, endloopAddrsCoarseOffset: 50, coarseTune: 51,
    fineTune: 52, sampleID: 53, sampleModes: 54, overridingRootKey: 58
};

const lerZonas = (dv, bag, gen, ini, fim) => {
    // devolve lista de zonas: cada zona = Map(gerador -> {s: valor com sinal, lo, hi})
    const zonas = [];
    for (let b = ini; b < fim; b++) {
        const g0 = dv.getUint16(bag.pos + (b * 4), true);
        const g1 = dv.getUint16(bag.pos + ((b + 1) * 4), true);
        const z = new Map();
        for (let gi = g0; gi < g1; gi++) {
            const p = gen.pos + (gi * 4);
            z.set(dv.getUint16(p, true), {s: dv.getInt16(p + 2, true), lo: dv.getUint8(p + 2), hi: dv.getUint8(p + 3)});
        }
        zonas.push(z);
    }
    return zonas;
};

/**
 * Lê um .sf2.
 * @param {ArrayBuffer} buf conteúdo do arquivo
 * @returns {{nome: string, presets: Array, dv: DataView, smpl: object, ...}} soundfont lida
 */
export const lerSF2 = buf => {
    if (buf.byteLength > MAX_SF2_MB * 1024 * 1024) {
        throw new Error(`O arquivo .sf2 é grande demais (máximo ${MAX_SF2_MB} MB).`);
    }
    const dv = new DataView(buf);
    if (texto(dv, 0, 4) !== 'RIFF' || texto(dv, 8, 4) !== 'sfbk') throw new Error('Isso não é um arquivo .sf2 (SoundFont 2).');
    const topo = lerBlocos(dv, 12, Math.min(buf.byteLength, 8 + dv.getUint32(4, true)));
    const info = topo['LIST:INFO'] ? lerBlocos(dv, topo['LIST:INFO'].pos, topo['LIST:INFO'].pos + topo['LIST:INFO'].tam) : {};
    const sdta = lerBlocos(dv, topo['LIST:sdta'].pos, topo['LIST:sdta'].pos + topo['LIST:sdta'].tam);
    const pdta = lerBlocos(dv, topo['LIST:pdta'].pos, topo['LIST:pdta'].pos + topo['LIST:pdta'].tam);
    for (const k of ['phdr', 'pbag', 'pgen', 'inst', 'ibag', 'igen', 'shdr']) {
        if (!pdta[k]) throw new Error('Arquivo .sf2 incompleto ou danificado.');
    }
    if (!sdta.smpl) throw new Error('Este .sf2 não tem amostras de som.');

    const presets = [];
    const nP = (pdta.phdr.tam / 38) - 1;
    for (let i = 0; i < nP; i++) {
        const p = pdta.phdr.pos + (i * 38);
        presets.push({
            nome: texto(dv, p, 20) || `Preset ${i + 1}`,
            programa: dv.getUint16(p + 20, true),
            banco: dv.getUint16(p + 22, true),
            bag: dv.getUint16(p + 24, true),
            bagFim: dv.getUint16(p + 38 + 24, true),
            indice: i
        });
    }
    presets.sort((a, b) => (a.banco - b.banco) || (a.programa - b.programa));
    return {
        nome: (info.INAM && texto(dv, info.INAM.pos, info.INAM.tam)) || 'SoundFont',
        dv,
        pdta,
        smpl: sdta.smpl,
        presets
    };
};

const tc = v => Math.pow(2, v / 1200); // timecents -> segundos

/**
 * Extrai um preset do .sf2 como instrumento independente (só com as amostras usadas).
 * @param {object} sf soundfont lida por lerSF2
 * @param {object} preset item de sf.presets
 * @returns {{info: object, pcm: Int16Array}} instrumento extraído
 */
export const extrairPreset = (sf, preset) => {
    const {dv, pdta} = sf;
    const zonasP = lerZonas(dv, pdta.pbag, pdta.pgen, preset.bag, preset.bagFim);
    const globalP = zonasP.length && !zonasP[0].has(G.instrument) ? zonasP.shift() : new Map();
    const regioes = [];
    const amostrasUsadas = new Map(); // índice no sf2 -> índice novo
    const amostras = [];
    const pedacos = [];
    let totalPcm = 0;

    const pegar = (zona, global, cod, padrao) => {
        if (zona.has(cod)) return zona.get(cod);
        if (global.has(cod)) return global.get(cod);
        return padrao;
    };
    const num = (zona, global, cod, padrao) => {
        const v = pegar(zona, global, cod, null);
        return v ? v.s : padrao;
    };

    for (const zp of zonasP) {
        const inst = zp.get(G.instrument).s;
        const pi = pdta.inst.pos + (inst * 22);
        const ib0 = dv.getUint16(pi + 20, true);
        const ib1 = dv.getUint16(pi + 22 + 20, true);
        const zonasI = lerZonas(dv, pdta.ibag, pdta.igen, ib0, ib1);
        const globalI = zonasI.length && !zonasI[0].has(G.sampleID) ? zonasI.shift() : new Map();
        const kP = pegar(zp, globalP, G.keyRange, {lo: 0, hi: 127});
        const vP = pegar(zp, globalP, G.velRange, {lo: 0, hi: 127});
        for (const zi of zonasI) {
            const sid = zi.get(G.sampleID).s & 0xFFFF;
            const sh = pdta.shdr.pos + (sid * 46);
            const tipo = dv.getUint16(sh + 44, true);
            if (tipo & 0x8000) continue; // amostra em ROM: não existe no arquivo
            if (tipo === 2 && zonasI.some(z => z !== zi && z.has(G.sampleID) &&
                (dv.getUint16(pdta.shdr.pos + ((z.get(G.sampleID).s & 0xFFFF) * 46) + 44, true) === 4))) {
                continue; // estéreo: fica só com o lado esquerdo (som mono)
            }
            const kI = pegar(zi, globalI, G.keyRange, {lo: 0, hi: 127});
            const vI = pegar(zi, globalI, G.velRange, {lo: 0, hi: 127});
            const keyLo = Math.max(kP.lo, kI.lo);
            const keyHi = Math.min(kP.hi, kI.hi);
            if (keyLo > keyHi) continue;

            let ini = dv.getUint32(sh + 20, true);
            let fim = dv.getUint32(sh + 24, true);
            let lIni = dv.getUint32(sh + 28, true);
            let lFim = dv.getUint32(sh + 32, true);
            ini += num(zi, globalI, G.startAddrsOffset, 0) + (num(zi, globalI, G.startAddrsCoarseOffset, 0) * 32768);
            fim += num(zi, globalI, G.endAddrsOffset, 0) + (num(zi, globalI, G.endAddrsCoarseOffset, 0) * 32768);
            lIni += num(zi, globalI, G.startloopAddrsOffset, 0) +
                (num(zi, globalI, G.startloopAddrsCoarseOffset, 0) * 32768);
            lFim += num(zi, globalI, G.endloopAddrsOffset, 0) + (num(zi, globalI, G.endloopAddrsCoarseOffset, 0) * 32768);
            const maxAmostras = sf.smpl.tam / 2;
            ini = Math.max(0, Math.min(ini, maxAmostras));
            fim = Math.max(ini + 1, Math.min(fim, maxAmostras));

            // cada amostra (com seus limites) é copiada uma vez só
            const chave = `${sid}:${ini}:${fim}`;
            if (!amostrasUsadas.has(chave)) {
                const tam = fim - ini;
                const pcm = new Int16Array(tam);
                for (let i = 0; i < tam; i++) pcm[i] = dv.getInt16(sf.smpl.pos + ((ini + i) * 2), true);
                pedacos.push(pcm);
                amostras.push({nome: texto(dv, sh, 20), taxa: dv.getUint32(sh + 36, true) || 44100,
                    inicio: totalPcm, fim: totalPcm + tam});
                amostrasUsadas.set(chave, amostras.length - 1);
                totalPcm += tam;
            }
            const raizSf = dv.getUint8(sh + 40);
            const raizOver = num(zi, globalI, G.overridingRootKey, -1);
            const correcao = dv.getInt8(sh + 41);
            const modo = num(zi, globalI, G.sampleModes, 0) & 3;
            regioes.push({
                amostra: amostrasUsadas.get(chave),
                keyLo,
                keyHi,
                velLo: Math.max(vP.lo, vI.lo),
                velHi: Math.min(vP.hi, vI.hi),
                raiz: raizOver >= 0 ? raizOver : (raizSf > 127 ? 60 : raizSf),
                ajuste: ((num(zi, globalI, G.coarseTune, 0) + num(zp, globalP, G.coarseTune, 0)) * 100) +
                    num(zi, globalI, G.fineTune, 0) + num(zp, globalP, G.fineTune, 0) + correcao,
                loop: modo === 1 || modo === 3,
                loopIni: Math.max(0, lIni - ini),
                loopFim: Math.max(0, lFim - ini),
                ataque: tc(num(zi, globalI, G.attackVolEnv, -12000) + num(zp, globalP, G.attackVolEnv, 0)),
                segura: tc(num(zi, globalI, G.holdVolEnv, -12000)),
                decai: tc(num(zi, globalI, G.decayVolEnv, -12000) + num(zp, globalP, G.decayVolEnv, 0)),
                sustenta: Math.pow(10, -Math.max(0, num(zi, globalI, G.sustainVolEnv, 0) +
                    num(zp, globalP, G.sustainVolEnv, 0)) / 200),
                solta: tc(num(zi, globalI, G.releaseVolEnv, -12000) + num(zp, globalP, G.releaseVolEnv, 0)),
                volume: Math.pow(10, -Math.max(0, num(zi, globalI, G.initialAttenuation, 0) +
                    num(zp, globalP, G.initialAttenuation, 0)) * 0.4 / 200),
                pan: Math.max(-1, Math.min(1, num(zi, globalI, G.pan, 0) / 500))
            });
        }
    }
    if (!regioes.length) throw new Error('Este instrumento do .sf2 não tem sons que dê para usar.');
    const pcm = new Int16Array(totalPcm);
    let p = 0;
    for (const pd of pedacos) {
        pcm.set(pd, p);
        p += pd.length;
    }
    return {
        info: {nome: preset.nome, origem: sf.nome, banco: preset.banco, programa: preset.programa, regioes, amostras},
        pcm
    };
};

// ---------- tocar ----------

const buffers = new WeakMap(); // instrumento -> {ctx, lista de AudioBuffer}

const buffersDe = (ctx, inst) => {
    const c = buffers.get(inst);
    if (c && c.ctx === ctx) return c.lista;
    const lista = inst.info.amostras.map(a => {
        const tam = Math.max(1, a.fim - a.inicio);
        const b = ctx.createBuffer(1, tam, a.taxa);
        const d = b.getChannelData(0);
        for (let i = 0; i < tam; i++) d[i] = inst.pcm[a.inicio + i] / 32768;
        return b;
    });
    buffers.set(inst, {ctx, lista});
    return lista;
};

/**
 * Toca uma nota com um instrumento extraído.
 * @returns {number} tempo em que o som termina
 */
export const tocarSF2 = (ctx, destino, inst, n, t, dur, vol = 0.8, vel = 100) => {
    const regs = inst.info.regioes.filter(r => n >= r.keyLo && n <= r.keyHi && vel >= r.velLo && vel <= r.velHi);
    if (!regs.length) {
        // sem amostra para esta nota: usa a mais próxima
        let melhor = null;
        for (const r of inst.info.regioes) {
            const dist = n < r.keyLo ? r.keyLo - n : n - r.keyHi;
            if (!melhor || dist < melhor.d) melhor = {r, d: dist};
        }
        if (melhor) regs.push(melhor.r);
    }
    const lista = buffersDe(ctx, inst);
    let fimMax = t + dur;
    for (const r of regs) {
        const buf = lista[r.amostra];
        if (!buf) continue;
        const fonte = ctx.createBufferSource();
        fonte.buffer = buf;
        fonte.playbackRate.value = Math.pow(2, (((n - r.raiz) * 100) + r.ajuste) / 1200);
        if (r.loop && r.loopFim > r.loopIni + 8) {
            fonte.loop = true;
            fonte.loopStart = r.loopIni / buf.sampleRate;
            fonte.loopEnd = r.loopFim / buf.sampleRate;
        }
        const g = ctx.createGain();
        const pico = Math.max(0.0001, 0.5 * vol * r.volume);
        const ataque = Math.max(0.002, Math.min(r.ataque, 2));
        const decai = Math.max(0.01, Math.min(r.decai, 8));
        const solta = Math.max(0.03, Math.min(r.solta, 1.5));
        const nivelSus = Math.max(0.0001, pico * r.sustenta);
        const fimNota = t + Math.max(dur, 0.02);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(pico, t + ataque);
        g.gain.setTargetAtTime(nivelSus, t + ataque + Math.min(r.segura, 1), decai / 4);
        g.gain.cancelScheduledValues(fimNota);
        g.gain.setTargetAtTime(0.0001, fimNota, solta / 4);
        let saida = g;
        if (r.pan && ctx.createStereoPanner) {
            const pn = ctx.createStereoPanner();
            pn.pan.value = r.pan;
            g.connect(pn);
            saida = pn;
        }
        fonte.connect(g);
        saida.connect(destino);
        const fim = fimNota + solta;
        fonte.start(t);
        fonte.stop(fim + 0.05);
        fimMax = Math.max(fimMax, fim);
    }
    return fimMax;
};
