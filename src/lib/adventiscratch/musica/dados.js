/**
 * Músicas do projeto atual (feitas no Criador de Músicas).
 * Ficam salvas dentro do .asp, na pasta adventiscratch/musicas/.
 *
 * Formato de uma música:
 * {
 *   nome, bpm, compassos,            // 4 batidas por compasso, 4 passos (semicolcheias) por batida
 *   faixas: [{id, nome, instrumento, volume, notas: [{p: passo, n: nota MIDI, d: duração em passos}]}],
 *   bateria: {volume, linhas: {bumbo: [passos], caixa: [...], ...}}
 * }
 */

export const PASSOS_POR_BATIDA = 4;
export const BATIDAS_POR_COMPASSO = 4;
export const PASSOS_POR_COMPASSO = PASSOS_POR_BATIDA * BATIDAS_POR_COMPASSO;
export const LINHAS_BATERIA = ['bumbo', 'caixa', 'chimbal', 'palmas', 'tom', 'prato'];
export const NOMES_BATERIA = {
    bumbo: 'Bumbo', caixa: 'Caixa', chimbal: 'Chimbal', palmas: 'Palmas', tom: 'Tom', prato: 'Prato'
};

const musicas = new Map();
const ouvintes = new Set();

export const aoMudarMusicas = fn => ouvintes.add(fn);
const avisar = () => ouvintes.forEach(fn => fn());

export const nomesMusicas = () => Array.from(musicas.keys());
export const obterMusica = nome => musicas.get(String(nome)) || null;
export const todasMusicas = () => Array.from(musicas.values());

export const totalPassos = m => m.compassos * PASSOS_POR_COMPASSO;

/** Cópia profunda (o editor mexe numa cópia e só grava ao salvar). */
export const copiarMusica = m => JSON.parse(JSON.stringify(m));

export const musicaVazia = nome => ({
    nome,
    bpm: 110,
    compassos: 4,
    faixas: [
        {id: 'melodia', nome: 'Melodia', instrumento: 'piano', volume: 0.8, notas: []},
        {id: 'baixo', nome: 'Baixo', instrumento: 'baixo', volume: 0.75, notas: []},
        {id: 'acordes', nome: 'Acordes', instrumento: 'orgao', volume: 0.45, notas: []}
    ],
    bateria: {volume: 0.8, linhas: Object.fromEntries(LINHAS_BATERIA.map(l => [l, []]))}
});

/** Corrige músicas antigas ou incompletas (vindas de arquivo). */
export const normalizar = m => {
    const base = musicaVazia(String(m.nome || 'música'));
    const r = Object.assign(base, {
        bpm: Math.max(40, Math.min(240, Number(m.bpm) || 110)),
        compassos: Math.max(1, Math.min(32, Math.round(Number(m.compassos) || 4)))
    });
    if (Array.isArray(m.faixas)) {
        r.faixas = base.faixas.map(f => {
            const veio = m.faixas.find(x => x && x.id === f.id) || {};
            return {
                ...f,
                instrumento: typeof veio.instrumento === 'string' ? veio.instrumento : f.instrumento,
                volume: Number.isFinite(veio.volume) ? veio.volume : f.volume,
                notas: (veio.notas || []).filter(n => Number.isFinite(n.p) && Number.isFinite(n.n))
                    .map(n => ({p: n.p, n: n.n, d: Math.max(1, n.d || 1)}))
            };
        });
    }
    if (m.bateria && m.bateria.linhas) {
        r.bateria.volume = Number.isFinite(m.bateria.volume) ? m.bateria.volume : 0.8;
        for (const l of LINHAS_BATERIA) {
            r.bateria.linhas[l] = (m.bateria.linhas[l] || []).filter(Number.isFinite);
        }
    }
    return r;
};

export const nomeLivre = (base = 'música') => {
    let nome = base;
    let i = 2;
    while (musicas.has(nome)) nome = `${base} ${i++}`;
    return nome;
};

/**
 * Grava (cria ou substitui) uma música. Se renomeou, apaga o nome antigo.
 * @param {object} m música
 * @param {string} [nomeAntigo] nome anterior, quando a música foi renomeada
 * @param {boolean} [silencioso] não avisa (ao abrir projeto)
 */
export const gravarMusica = (m, nomeAntigo, silencioso) => {
    if (nomeAntigo && nomeAntigo !== m.nome) musicas.delete(nomeAntigo);
    musicas.set(m.nome, copiarMusica(m));
    if (!silencioso) avisar();
};

export const apagarMusica = nome => {
    musicas.delete(nome);
    avisar();
};

export const limparMusicas = silencioso => {
    musicas.clear();
    if (!silencioso) avisar();
};

export const avisarMudancas = avisar;
