/**
 * Tilemaps (mapas de blocos) do Adventiblocks. Ficam no .asp em adventiscratch/tilemaps.json.
 *
 * Um tilemap é uma grade de "tiles" (blocos). As figuras dos tiles são as fantasias de um ator (o "tileset"):
 * tile 1 = 1ª fantasia, tile 2 = 2ª fantasia… (0 = vazio).
 *
 * {
 *   nome, tamanho (px do palco de cada tile), colunas, linhas,
 *   x, y: canto de cima à esquerda do mapa, no palco (padrão: canto do palco, -240, 180),
 *   tileset: nome do ator com as fantasias dos tiles,
 *   camadas: {fundo: [n…], principal: [n…]}  (linha por linha; "fundo" não colide),
 *   tipos: {"<n>": "solido" | "plataforma" | "perigo" | qualquer texto}  (tipo de cada tile da camada principal)
 * }
 */

export const CAMADAS = ['fundo', 'principal'];
export const TIPOS_PADRAO = ['nada', 'solido', 'plataforma', 'perigo', 'escada', 'agua', 'moeda', 'inicio', 'fim'];
export const NOMES_TIPOS = {
    nada: 'nada (só enfeite)', solido: 'sólido', plataforma: 'plataforma (atravessa por baixo)', perigo: 'perigo',
    escada: 'escada', agua: 'água', moeda: 'moeda', inicio: 'início', fim: 'fim'
};
const MAX_LADO = 1000;
const MAX_TILES = 250000;

const mapas = new Map(); // nome -> tilemap
let ativo = ''; // nome do tilemap mostrado no palco
const ouvintes = new Set();

export const aoMudarTilemaps = fn => {
    ouvintes.add(fn);
    return () => ouvintes.delete(fn);
};
/** @param {object} detalhe {tipo: 'tudo' | 'tile', mapa, col, lin} */
export const avisarTilemaps = (detalhe = {tipo: 'tudo'}) => ouvintes.forEach(fn => fn(detalhe));

const inteiro = (v, min, max, padrao) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : padrao;
};

export const tilemapVazio = (nome = 'mapa 1', colunas = 30, linhas = 12, tamanho = 32) => ({
    nome,
    tamanho,
    colunas,
    linhas,
    x: -240,
    y: 180,
    tileset: '',
    camadas: {
        fundo: new Array(colunas * linhas).fill(0),
        principal: new Array(colunas * linhas).fill(0)
    },
    tipos: {}
});

/** Confere e corrige um tilemap vindo de arquivo. */
export const normalizarTilemap = m => {
    const r = tilemapVazio();
    if (!m || typeof m !== 'object') return r;
    r.nome = String(m.nome || 'mapa').slice(0, 60);
    r.tamanho = inteiro(m.tamanho, 2, 512, 32);
    r.colunas = inteiro(m.colunas, 1, MAX_LADO, 30);
    r.linhas = inteiro(m.linhas, 1, MAX_LADO, 12);
    while (r.colunas * r.linhas > MAX_TILES) r.linhas--;
    r.x = Number.isFinite(Number(m.x)) ? Number(m.x) : -240;
    r.y = Number.isFinite(Number(m.y)) ? Number(m.y) : 180;
    r.tileset = String(m.tileset || '');
    const n = r.colunas * r.linhas;
    for (const c of CAMADAS) {
        const dados = (m.camadas && Array.isArray(m.camadas[c])) ? m.camadas[c] : [];
        r.camadas[c] = new Array(n);
        for (let i = 0; i < n; i++) r.camadas[c][i] = inteiro(dados[i], 0, 100000, 0);
    }
    r.tipos = {};
    if (m.tipos && typeof m.tipos === 'object') {
        for (const [k, v] of Object.entries(m.tipos)) {
            const id = inteiro(k, 1, 100000, 0);
            const tipo = String(v || '').trim()
                .slice(0, 30);
            if (id && tipo && tipo !== 'nada') r.tipos[id] = tipo;
        }
    }
    return r;
};

export const todosTilemaps = () => Array.from(mapas.values());
export const obterTilemap = nome => mapas.get(String(nome)) || null;
export const tilemapAtivo = () => (ativo ? mapas.get(ativo) || null : null);
export const nomeAtivo = () => ativo;

export const definirAtivo = (nome, silencioso) => {
    ativo = nome && mapas.has(nome) ? nome : '';
    if (!silencioso) avisarTilemaps();
};

/** Grava (cria ou troca). Se "nomeAntigo" for dado, renomeia. */
export const gravarTilemap = (m, nomeAntigo, silencioso) => {
    if (nomeAntigo && nomeAntigo !== m.nome) {
        mapas.delete(nomeAntigo);
        if (ativo === nomeAntigo) ativo = m.nome;
    }
    mapas.set(m.nome, m);
    if (!silencioso) avisarTilemaps();
};

export const apagarTilemap = nome => {
    mapas.delete(nome);
    if (ativo === nome) ativo = '';
    avisarTilemaps();
};

export const limparTilemaps = () => {
    mapas.clear();
    ativo = '';
};

export const nomeLivre = (base = 'mapa') => {
    let i = 1;
    while (mapas.has(`${base} ${i}`)) i++;
    return `${base} ${i}`;
};

export const serializarTilemaps = () => ({ativo, mapas: todosTilemaps()});

export const carregarTilemaps = dados => {
    limparTilemaps();
    if (!dados || !Array.isArray(dados.mapas)) return;
    dados.mapas.forEach(m => {
        const t = normalizarTilemap(m);
        mapas.set(t.nome, t);
    });
    ativo = dados.ativo && mapas.has(dados.ativo) ? dados.ativo : '';
};

export const renomearTileset = (antigo, novo) => {
    let mudou = false;
    mapas.forEach(m => {
        if (m.tileset === antigo) {
            m.tileset = novo;
            mudou = true;
        }
    });
    if (mudou) avisarTilemaps();
};

// ---------------------------------------------------------------- grade

export const lerTile = (m, camada, col, lin) => {
    if (col < 0 || lin < 0 || col >= m.colunas || lin >= m.linhas) return 0;
    return m.camadas[camada][(lin * m.colunas) + col] || 0;
};

export const escreverTile = (m, camada, col, lin, valor) => {
    if (col < 0 || lin < 0 || col >= m.colunas || lin >= m.linhas) return false;
    const i = (lin * m.colunas) + col;
    const v = Math.max(0, Math.round(Number(valor)) || 0);
    if (m.camadas[camada][i] === v) return false;
    m.camadas[camada][i] = v;
    return true;
};

/** Muda o tamanho da grade, guardando o que já existe (a partir do canto de cima à esquerda). */
export const redimensionar = (m, colunas, linhas) => {
    colunas = inteiro(colunas, 1, MAX_LADO, m.colunas);
    linhas = inteiro(linhas, 1, MAX_LADO, m.linhas);
    while (colunas * linhas > MAX_TILES) linhas--;
    for (const c of CAMADAS) {
        const novo = new Array(colunas * linhas).fill(0);
        for (let l = 0; l < Math.min(linhas, m.linhas); l++) {
            for (let k = 0; k < Math.min(colunas, m.colunas); k++) {
                novo[(l * colunas) + k] = m.camadas[c][(l * m.colunas) + k];
            }
        }
        m.camadas[c] = novo;
    }
    m.colunas = colunas;
    m.linhas = linhas;
};

/** Coluna e linha da posição (x, y) do palco. */
export const celulaDe = (m, x, y) => ({
    col: Math.floor((x - m.x) / m.tamanho),
    lin: Math.floor((m.y - y) / m.tamanho)
});

/** Centro do tile (col, lin) no palco. */
export const centroDe = (m, col, lin) => ({
    x: m.x + ((col + 0.5) * m.tamanho),
    y: m.y - ((lin + 0.5) * m.tamanho)
});

export const tipoDoTile = (m, n) => (n ? m.tipos[n] || 'nada' : 'nada');
