/**
 * Importa mapas de outros jogos de ritmo (só as notas; o áudio você escolhe entre os sons do projeto):
 *  - .osu (osu!): círculos (sliders viram um círculo no começo, spinners são ignorados);
 *    osu!mania de 4 teclas vira setas (notas longas também).
 *  - .json do Friday Night Funkin': formato antigo/Psych ({song: {notes: [{sectionNotes, mustHitSection}]}})
 *    e o formato novo ({notes: {normal: [{t, d, l}]}}).
 */
import {mapaVazio, normalizarMapa} from './dados.js';

const secoes = texto => {
    const r = {};
    let atual = null;
    texto.split(/\r?\n/).forEach(linha => {
        const l = linha.trim();
        if (!l || l.startsWith('//')) return;
        const m = /^\[(.+)\]$/.exec(l);
        if (m) {
            atual = m[1];
            r[atual] = [];
        } else if (atual) {
            r[atual].push(l);
        }
    });
    return r;
};

const chaveValor = linhas => {
    const r = {};
    (linhas || []).forEach(l => {
        const i = l.indexOf(':');
        if (i > 0) r[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    });
    return r;
};

/**
 * @param {string} texto conteúdo do .osu
 * @param {string} nomeArquivo nome do arquivo
 * @returns {object} mapa
 */
export const lerOsu = (texto, nomeArquivo) => {
    if (!/osu file format/i.test(texto.slice(0, 200))) throw new Error('Isso não parece um arquivo .osu.');
    const s = secoes(texto);
    const geral = chaveValor(s.General);
    const meta = chaveValor(s.Metadata);
    const dif = chaveValor(s.Difficulty);
    const modo = Number(geral.Mode || 0);
    const titulo = [meta.Title, meta.Version ? `[${meta.Version}]` : ''].filter(Boolean).join(' ') ||
        nomeArquivo.replace(/\.osu$/i, '');
    const m = mapaVazio(titulo.slice(0, 40), modo === 3 ? 'setas' : 'circulos');
    const tempos = (s.TimingPoints || []).map(l => l.split(',').map(Number)).filter(p => p.length >= 2);
    const base = tempos.find(p => p[1] > 0 && (p.length < 7 || p[6] === 1));
    if (base) m.bpm = Math.round(60000 / base[1] * 100) / 100;
    if (modo === 3) {
        const teclas = Math.round(Number(dif.CircleSize || 4));
        if (teclas !== 4) throw new Error(`Esse mapa de osu!mania tem ${teclas} teclas. Só dá para importar os de 4 teclas.`);
        m.oponente = false;
        (s.HitObjects || []).forEach(l => {
            const p = l.split(',');
            const x = Number(p[0]);
            const t = Number(p[2]);
            const tipo = Number(p[3]);
            const pista = Math.max(0, Math.min(3, Math.floor(x * 4 / 512)));
            let dur = 0;
            if (tipo & 128) dur = Math.max(0, Number(String(p[5] || '').split(':')[0]) - t);
            m.notas.push({t, pista, quem: 'eu', dur});
        });
    } else if (modo === 0) {
        (s.HitObjects || []).forEach(l => {
            const p = l.split(',');
            const tipo = Number(p[3]);
            if (tipo & 8) return; // spinner
            // campo do osu! é 512 × 384: cabe no palco com escala 0,9
            m.circulos.push({t: Number(p[2]), x: Math.round((Number(p[0]) - 256) * 0.9), y: Math.round((192 - Number(p[1])) * 0.9)});
        });
    } else {
        throw new Error('Só dá para importar mapas de osu! normal e de osu!mania de 4 teclas.');
    }
    const r = normalizarMapa(m);
    if (!r.notas.length && !r.circulos.length) throw new Error('O mapa não tem notas.');
    return r;
};

/**
 * @param {string} texto conteúdo do .json do FNF
 * @param {string} nomeArquivo nome do arquivo
 * @returns {object} mapa
 */
/** Tipo de nota do FNF (Psych "Hurt Note", V-Slice "hurt"/"mine"…) → item do Adventiscratch. */
const itemDoTipoFnf = tipo => {
    const t = typeof tipo === 'string' ? tipo.trim() : '';
    if (!t) return '';
    if (/hurt|mine|bomb|danger|kill|death/i.test(t)) return 'perigo';
    if (/heal|health/i.test(t)) return 'vida';
    if (/^(normal|default)$/i.test(t)) return '';
    return t.slice(0, 30); // ex.: "Alt Animation", "GF Sing": vira item personalizado com o mesmo nome
};

export const lerFnf = (texto, nomeArquivo) => {
    let j;
    try {
        j = JSON.parse(texto);
    } catch (e) {
        throw new Error('O .json está com erro de formato.');
    }
    const nome = nomeArquivo.replace(/\.json$/i, '');
    const m = mapaVazio(nome.slice(0, 40), 'setas');
    m.oponente = true;
    if (j && j.notes && !Array.isArray(j.notes) && typeof j.notes === 'object') {
        // formato novo (V-Slice): notas por dificuldade; d 0-3 = jogador, 4-7 = oponente
        const dif = j.notes.normal || j.notes.hard || j.notes.easy || Object.values(j.notes)[0] || [];
        dif.forEach(n => m.notas.push({t: n.t, pista: n.d % 4, quem: n.d < 4 ? 'eu' : 'op', dur: n.l || 0,
            item: itemDoTipoFnf(n.k)}));
        const v = j.scrollSpeed && (j.scrollSpeed.normal || Object.values(j.scrollSpeed)[0]);
        if (v) m.velocidade = Math.max(0.5, Math.min(3, v / 1.5));
    } else {
        const song = (j && j.song && typeof j.song === 'object') ? j.song : j;
        if (!song || !Array.isArray(song.notes)) {
            throw new Error('Esse .json não é um gráfico do FNF (não tem "song.notes").');
        }
        if (song.bpm) m.bpm = Number(song.bpm) || 120;
        if (song.song) m.nome = String(song.song).slice(0, 40);
        if (song.speed) m.velocidade = Math.max(0.5, Math.min(3, Number(song.speed) / 1.5));
        song.notes.forEach(secao => {
            (secao.sectionNotes || []).forEach(n => {
                const [t, lane, dur, tipo] = n;
                if (!(lane >= 0) || lane > 7) return; // eventos usam lane -1
                // no formato antigo: 0-3 é quem "está cantando" na seção (mustHitSection = jogador)
                const primeiraMetade = lane < 4;
                const eu = secao.mustHitSection ? primeiraMetade : !primeiraMetade;
                m.notas.push({t, pista: lane % 4, quem: eu ? 'eu' : 'op', dur: Number(dur) || 0,
                    item: itemDoTipoFnf(tipo)});
            });
        });
    }
    const r = normalizarMapa(m);
    if (!r.notas.length) throw new Error('O gráfico não tem notas.');
    return r;
};

export const lerArquivoDeMapa = (texto, nomeArquivo) => {
    if (/\.osu$/i.test(nomeArquivo)) return lerOsu(texto, nomeArquivo);
    if (/\.json$/i.test(nomeArquivo)) return lerFnf(texto, nomeArquivo);
    throw new Error('Use um arquivo .osu (osu!) ou .json (Friday Night Funkin\').');
};
