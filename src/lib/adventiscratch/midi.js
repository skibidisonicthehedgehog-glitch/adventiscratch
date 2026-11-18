/**
 * Importador de MIDI (.mid / .midi, Standard MIDI File formatos 0 e 1).
 *
 *  - lerMidi(buffer)            → {ppq, tempos, compasso, faixas: [{nome, canal, programa, notas}]}
 *  - midiParaMusica(midi, nome) → música do Criador de Músicas (melodia, baixo, acordes e bateria)
 *  - midiParaMapa(midi, nome)   → mapa de setas para o Editor de mapas de ritmo
 *
 * As notas são arredondadas para semicolcheias (a grade do Criador de Músicas). O mapa de ritmo usa
 * os mesmos tempos da música gerada, então os dois ficam sincronizados.
 */
import {musicaVazia, LINHAS_BATERIA, PASSOS_POR_BATIDA, PASSOS_POR_COMPASSO, MAX_COMPASSOS} from './musica/dados.js';
import {mapaVazio} from './ritmo/dados.js';

const CANAL_BATERIA = 9; // canal 10 no General MIDI

const erro = msg => {
    throw new Error(msg);
};

/**
 * Lê o arquivo MIDI.
 * @param {ArrayBuffer} buffer conteúdo do .mid
 * @returns {object} dados do MIDI
 */
export const lerMidi = buffer => {
    const dv = new DataView(buffer);
    const tam = buffer.byteLength;
    const tag = p => String.fromCharCode(dv.getUint8(p), dv.getUint8(p + 1), dv.getUint8(p + 2), dv.getUint8(p + 3));
    let pos = 0;
    // alguns arquivos vêm embrulhados em RIFF (RMID)
    if (tam > 20 && tag(0) === 'RIFF' && tag(8) === 'RMID') {
        pos = 12;
        while (pos + 8 <= tam && tag(pos) !== 'data') pos += 8 + dv.getUint32(pos + 4, true);
        pos += 8;
    }
    if (pos + 14 > tam || tag(pos) !== 'MThd') erro('Este arquivo não é um MIDI (.mid) válido.');
    const formato = dv.getUint16(pos + 8);
    const nFaixas = dv.getUint16(pos + 10);
    const divisao = dv.getUint16(pos + 12);
    if (formato > 2) erro('Formato de MIDI desconhecido.');
    if (divisao & 0x8000) erro('MIDI com tempo em SMPTE não é suportado. Exporte com "ticks por batida".');
    const ppq = divisao || 480;
    pos += 8 + dv.getUint32(pos + 4);

    const tempos = []; // {tick, uspb}
    let compasso = null;
    const faixas = [];

    for (let f = 0; f < nFaixas && pos + 8 <= tam; f++) {
        if (tag(pos) !== 'MTrk') {
            pos += 8 + dv.getUint32(pos + 4);
            f--;
            continue;
        }
        const fim = Math.min(tam, pos + 8 + dv.getUint32(pos + 4));
        let p = pos + 8;
        pos = fim;
        let tick = 0;
        let status = 0;
        let nome = '';
        const abertas = new Map(); // canal*128+nota -> [notas abertas]
        const porCanal = new Map(); // canal -> {programa, notas}
        const canal = c => {
            if (!porCanal.has(c)) porCanal.set(c, {programa: -1, notas: []});
            return porCanal.get(c);
        };
        const vlq = () => {
            let v = 0;
            for (let i = 0; i < 4 && p < fim; i++) {
                const b = dv.getUint8(p++);
                v = (v << 7) | (b & 0x7f);
                if (!(b & 0x80)) break;
            }
            return v;
        };
        const fechar = (c, n) => {
            const lista = abertas.get((c * 128) + n);
            if (lista && lista.length) {
                const nota = lista.shift();
                nota.dur = Math.max(1, tick - nota.tick);
            }
        };
        while (p < fim) {
            tick += vlq();
            if (p >= fim) break;
            let b = dv.getUint8(p);
            if (b & 0x80) {
                p++;
                if (b < 0xf0) status = b;
            } else {
                b = status; // running status
            }
            if (b === 0xff) {
                const tipo = dv.getUint8(p++);
                const len = vlq();
                if (tipo === 0x51 && len >= 3) {
                    tempos.push({tick, uspb: (dv.getUint8(p) << 16) | (dv.getUint8(p + 1) << 8) | dv.getUint8(p + 2)});
                } else if (tipo === 0x58 && len >= 2 && !compasso) {
                    compasso = {num: dv.getUint8(p), den: Math.pow(2, dv.getUint8(p + 1))};
                } else if ((tipo === 0x03) && !nome) {
                    nome = new TextDecoder('latin1').decode(new Uint8Array(buffer, p, Math.min(len, fim - p)))
                        .trim();
                }
                p += len;
            } else if (b === 0xf0 || b === 0xf7) {
                p += vlq();
            } else if (b >= 0x80 && b < 0xf0) {
                const tipo = b & 0xf0;
                const c = b & 0x0f;
                const d1 = dv.getUint8(p++);
                const d2 = (tipo === 0xc0 || tipo === 0xd0) ? 0 : dv.getUint8(p++);
                if (tipo === 0x90 && d2 > 0) {
                    fechar(c, d1); // mesma nota de novo sem soltar
                    const nota = {tick, n: d1, vel: d2, dur: 0};
                    canal(c).notas.push(nota);
                    const k = (c * 128) + d1;
                    if (!abertas.has(k)) abertas.set(k, []);
                    abertas.get(k).push(nota);
                } else if (tipo === 0x80 || tipo === 0x90) {
                    fechar(c, d1);
                } else if (tipo === 0xc0) {
                    if (canal(c).programa < 0) canal(c).programa = d1;
                }
            } else {
                break; // byte inválido: para de ler esta faixa
            }
        }
        // notas sem "soltar": duram uma batida
        abertas.forEach(lista => lista.forEach(nota => {
            nota.dur = ppq;
        }));
        porCanal.forEach((info, c) => {
            if (info.notas.length) {
                faixas.push({
                    nome: nome || (c === CANAL_BATERIA ? 'Bateria' : `Faixa ${faixas.length + 1}`),
                    canal: c,
                    programa: Math.max(0, info.programa),
                    notas: info.notas
                });
            }
        });
    }
    if (!faixas.length) erro('Este MIDI não tem notas.');
    tempos.sort((a, b) => a.tick - b.tick);
    if (!tempos.length || tempos[0].tick > 0) tempos.unshift({tick: 0, uspb: 500000});
    return {ppq, tempos, compasso: compasso || {num: 4, den: 4}, faixas};
};

/** BPM principal (o tempo que dura mais tempo na música). */
export const bpmPrincipal = midi => {
    const fimTick = Math.max(...midi.faixas.map(f => Math.max(...f.notas.map(n => n.tick + n.dur))));
    const duracoes = new Map();
    midi.tempos.forEach((t, i) => {
        const ate = i + 1 < midi.tempos.length ? midi.tempos[i + 1].tick : fimTick;
        const bpm = Math.round(60000000 / t.uspb);
        duracoes.set(bpm, (duracoes.get(bpm) || 0) + Math.max(0, ate - t.tick));
    });
    let melhor = 120;
    let maior = -1;
    duracoes.forEach((d, bpm) => {
        if (d > maior) {
            maior = d;
            melhor = bpm;
        }
    });
    return melhor;
};

// instrumento do Criador de Músicas mais parecido com o programa General MIDI
const instrumentoGM = (programa, papel) => {
    if (programa < 8) return 'piano';
    if (programa < 16) return 'sinos';
    if (programa < 24) return 'orgao';
    if (programa < 32) return papel === 'baixo' ? 'baixo' : 'piano'; // violões e guitarras
    if (programa < 40) return 'baixo';
    if (programa < 56) return 'cordas';
    if (programa < 80) return 'flauta'; // metais, palhetas e flautas
    if (programa < 104) return 'synth';
    if (programa < 112) return 'cordas';
    return 'bit8';
};

// percussão General MIDI → linhas da bateria
const linhaDaBateria = n => {
    if (n === 35 || n === 36) return 'bumbo';
    if (n === 38 || n === 40 || n === 37) return 'caixa';
    if (n === 39) return 'palmas';
    if ([42, 44, 46, 54, 69, 70].includes(n)) return 'chimbal';
    if ([49, 51, 52, 53, 55, 57, 59].includes(n)) return 'prato';
    if ((n >= 41 && n <= 50) || (n >= 60 && n <= 68)) return 'tom';
    return null;
};

const media = notas => notas.reduce((s, x) => s + x.n, 0) / notas.length;

/** Separa as faixas melódicas em melodia (mais aguda), baixo (mais grave) e acordes (o resto). */
const papeis = midi => {
    const melodicas = midi.faixas.filter(f => f.canal !== CANAL_BATERIA);
    const r = {melodia: [], baixo: [], acordes: []};
    if (!melodicas.length) return r;
    const ordem = melodicas.slice().sort((a, b) => media(b.notas) - media(a.notas));
    if (ordem.length === 1) {
        r.melodia.push(ordem[0]);
    } else if (ordem.length === 2) {
        r.melodia.push(ordem[0]);
        if (media(ordem[1].notas) < 55) r.baixo.push(ordem[1]);
        else r.acordes.push(ordem[1]);
    } else {
        r.melodia.push(ordem[0]);
        r.baixo.push(ordem[ordem.length - 1]);
        r.acordes.push(...ordem.slice(1, -1));
    }
    return r;
};

/**
 * Converte o MIDI numa música do Criador de Músicas.
 * @param {object} midi resultado de lerMidi
 * @param {string} nome nome da música
 * @returns {{musica: object, cortou: boolean}} música e se precisou cortar o fim
 */
export const midiParaMusica = (midi, nome) => {
    const m = musicaVazia(nome);
    m.bpm = Math.max(40, Math.min(240, bpmPrincipal(midi)));
    const ticksPorPasso = midi.ppq / PASSOS_POR_BATIDA;
    const passo = t => Math.round(t / ticksPorPasso);
    let ultimo = 0;
    const p = papeis(midi);
    for (const faixa of m.faixas) {
        const fontes = p[faixa.id];
        if (!fontes.length) continue;
        faixa.instrumento = instrumentoGM(fontes[0].programa, faixa.id);
        const vistas = new Set();
        for (const f of fontes) {
            for (const x of f.notas) {
                const ps = passo(x.tick);
                const k = `${ps}:${x.n}`;
                if (vistas.has(k)) continue;
                vistas.add(k);
                const d = Math.max(1, passo(x.tick + x.dur) - ps);
                faixa.notas.push({p: ps, n: Math.max(21, Math.min(108, x.n)), d});
                ultimo = Math.max(ultimo, ps + d);
            }
        }
    }
    for (const f of midi.faixas.filter(x => x.canal === CANAL_BATERIA)) {
        for (const x of f.notas) {
            const l = linhaDaBateria(x.n);
            if (!l) continue;
            const ps = passo(x.tick);
            if (!m.bateria.linhas[l].includes(ps)) m.bateria.linhas[l].push(ps);
            ultimo = Math.max(ultimo, ps + 1);
        }
    }
    const compassos = Math.max(1, Math.ceil(ultimo / PASSOS_POR_COMPASSO));
    m.compassos = Math.min(MAX_COMPASSOS, compassos);
    const total = m.compassos * PASSOS_POR_COMPASSO;
    m.faixas.forEach(f => {
        f.notas = f.notas.filter(x => x.p < total).sort((a, b) => a.p - b.p);
        f.notas.forEach(x => {
            x.d = Math.min(x.d, total - x.p);
        });
    });
    LINHAS_BATERIA.forEach(l => {
        m.bateria.linhas[l] = m.bateria.linhas[l].filter(x => x < total).sort((a, b) => a - b);
    });
    return {musica: m, cortou: compassos > MAX_COMPASSOS};
};

/**
 * Converte o MIDI num mapa de setas. A melodia vira as suas setas; se houver outra faixa melódica,
 * ela vira as setas do oponente. A altura da nota escolhe a seta (graves à esquerda, agudas à direita).
 * @param {object} midi resultado de lerMidi
 * @param {string} nome nome do mapa
 * @param {number} [bpm] BPM usado (o mesmo da música gerada, para ficarem sincronizados)
 * @returns {object} mapa
 */
export const midiParaMapa = (midi, nome, bpm) => {
    const m = mapaVazio(nome, 'setas');
    m.bpm = bpm || Math.max(40, Math.min(240, bpmPrincipal(midi)));
    const ticksPorPasso = midi.ppq / PASSOS_POR_BATIDA;
    const msPorPasso = 60000 / m.bpm / PASSOS_POR_BATIDA;
    const ms = t => Math.round(Math.round(t / ticksPorPasso) * msPorPasso);
    const p = papeis(midi);
    const eu = p.melodia[0];
    const op = p.acordes[0] || p.baixo[0];
    const gerar = (faixa, quem) => {
        if (!faixa) return;
        const alturas = faixa.notas.map(x => x.n).sort((a, b) => a - b);
        // divide as alturas em 4 faixas com quantidades parecidas de notas
        const corte = [1, 2, 3].map(i => alturas[Math.floor(alturas.length * i / 4)]);
        const pista = n => corte.filter(c => n >= c).length;
        const porTempo = new Map();
        for (const x of faixa.notas) {
            const t = ms(x.tick);
            if (!porTempo.has(t)) porTempo.set(t, []);
            porTempo.get(t).push(x);
        }
        porTempo.forEach((lista, t) => {
            // acordes: no máximo 2 setas ao mesmo tempo
            const pistas = Array.from(new Set(lista.sort((a, b) => b.n - a.n).map(x => pista(x.n)))).slice(0, 2);
            pistas.forEach(ps => {
                const x = lista.find(y => pista(y.n) === ps);
                const dur = ms(x.tick + x.dur) - t;
                m.notas.push({t, pista: Math.min(3, ps), quem, dur: dur >= 450 ? dur : 0});
            });
        });
    };
    gerar(eu, 'eu');
    gerar(op, 'op');
    m.oponente = Boolean(op);
    // nada de notas muito grudadas na mesma seta (fica impossível de jogar)
    m.notas.sort((a, b) => a.t - b.t);
    const ultimoNaPista = {};
    m.notas = m.notas.filter(x => {
        const k = `${x.quem}${x.pista}`;
        if (ultimoNaPista[k] !== undefined && x.t - ultimoNaPista[k] < 90) return false;
        ultimoNaPista[k] = x.t + x.dur;
        return true;
    });
    return m;
};

export const ehMidi = nome => /\.(mid|midi|rmi|kar)$/i.test(nome || '');
