/**
 * Mapas de ritmo do projeto (feitos no Editor de mapas de ritmo). Ficam no .asp em adventiscratch/mapas/<n>.json.
 *
 * {
 *   nome, modo: 'setas' | 'circulos',
 *   audio: {tipo: 'musica' | 'som' | 'nenhum', nome},   // música do Criador de Músicas ou som de um ator/palco
 *   bpm, offset (ms: atraso do áudio em relação às notas), velocidade (1 = normal),
 *   oponente: bool,                                       // setas: tem o lado do oponente?
 *   notas: [{t (ms), pista 0-3 (← ↓ ↑ →), quem: 'eu' | 'op', dur (ms, 0 = nota normal)}],
 *   circulos: [{t (ms), x, y}],                           // posição no palco (-240..240, -180..180)
 *   duracao (ms, 0 = automático)
 * }
 */

export const PISTAS = ['esquerda', 'baixo', 'cima', 'direita'];
export const SIMBOLOS = ['←', '↓', '↑', '→'];

const mapas = new Map();
const ouvintes = new Set();

export const aoMudarMapas = fn => {
    ouvintes.add(fn);
    return () => ouvintes.delete(fn);
};
const avisar = () => ouvintes.forEach(fn => fn());

export const nomesMapas = () => Array.from(mapas.keys());
export const obterMapa = nome => mapas.get(String(nome)) || null;
export const todosMapas = () => Array.from(mapas.values());
export const copiarMapa = m => JSON.parse(JSON.stringify(m));

export const mapaVazio = (nome, modo = 'setas') => ({
    nome, modo, audio: {tipo: 'nenhum', nome: ''}, bpm: 120, offset: 0, velocidade: 1, oponente: true,
    notas: [], circulos: [], duracao: 0
});

const n = (v, padrao) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : padrao;
};

export const normalizarMapa = m => {
    const r = mapaVazio(String((m && m.nome) || 'mapa').slice(0, 40), m && m.modo === 'circulos' ? 'circulos' : 'setas');
    if (!m || typeof m !== 'object') return r;
    const a = m.audio || {};
    r.audio = {tipo: ['musica', 'som', 'nenhum'].includes(a.tipo) ? a.tipo : 'nenhum', nome: String(a.nome || '')};
    r.bpm = Math.max(20, Math.min(400, n(m.bpm, 120)));
    r.offset = Math.max(-5000, Math.min(5000, n(m.offset, 0)));
    r.velocidade = Math.max(0.2, Math.min(5, n(m.velocidade, 1)));
    r.oponente = m.oponente !== false;
    r.duracao = Math.max(0, n(m.duracao, 0));
    r.notas = (m.notas || []).filter(x => x && Number.isFinite(Number(x.t))).map(x => ({
        t: Math.max(0, Math.round(n(x.t, 0))), pista: Math.max(0, Math.min(3, Math.round(n(x.pista, 0)))),
        quem: x.quem === 'op' ? 'op' : 'eu', dur: Math.max(0, Math.round(n(x.dur, 0)))
    })).sort((a2, b) => a2.t - b.t);
    r.circulos = (m.circulos || []).filter(x => x && Number.isFinite(Number(x.t))).map(x => ({
        t: Math.max(0, Math.round(n(x.t, 0))), x: Math.max(-240, Math.min(240, n(x.x, 0))),
        y: Math.max(-180, Math.min(180, n(x.y, 0)))
    })).sort((a2, b) => a2.t - b.t);
    return r;
};

export const nomeLivreMapa = (base = 'mapa') => {
    let nome = base;
    let i = 2;
    while (mapas.has(nome)) nome = `${base} ${i++}`;
    return nome;
};

export const gravarMapa = (m, nomeAntigo, silencioso) => {
    if (nomeAntigo && nomeAntigo !== m.nome) mapas.delete(nomeAntigo);
    mapas.set(m.nome, copiarMapa(m));
    if (!silencioso) avisar();
};

export const apagarMapa = nome => {
    mapas.delete(nome);
    avisar();
};

export const limparMapas = () => {
    mapas.clear();
};

/** Último instante do mapa (ms), contando notas longas. */
export const fimDasNotas = m => {
    let fim = 0;
    for (const x of m.notas) fim = Math.max(fim, x.t + x.dur);
    for (const x of m.circulos) fim = Math.max(fim, x.t);
    return fim;
};
