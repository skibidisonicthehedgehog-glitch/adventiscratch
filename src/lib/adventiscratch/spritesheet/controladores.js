/**
 * Controladores de animação (máquina de estados, como o "Animator" da Unity), um por ator.
 * Ficam no .asp em adventiscratch/controladores.json, guardados pelo nome do ator.
 *
 * Formato:
 * {
 *   parametros: [{nome, tipo: 'numero' | 'booleano' | 'gatilho', valor}],
 *   estados: [{id, nome, animacao, qps, loop, x, y}],
 *   inicial: id do estado inicial,
 *   transicoes: [{id, de: id | 'qualquer', para: id, aoTerminar: bool,
 *                 condicoes: [{param, op: '>' | '<' | '=' | '≠' | '≥' | '≤' | 'verdadeiro' | 'falso' | 'disparado', valor}]}]
 * }
 */

const controladores = new Map(); // nome do ator -> controlador
const ouvintes = new Set();

export const QUALQUER = 'qualquer';
export const OPS_NUMERO = ['>', '<', '=', '≠', '≥', '≤'];

export const aoMudarControladores = fn => {
    ouvintes.add(fn);
    return () => ouvintes.delete(fn);
};
export const avisarControladores = () => ouvintes.forEach(fn => fn());

export const controladorVazio = () => ({parametros: [], estados: [], inicial: null, transicoes: [], qualquer: {x: 40, y: 30}});

export const obterControlador = nomeAtor => controladores.get(nomeAtor) || null;

export const definirControlador = (nomeAtor, c, silencioso) => {
    if (c && (c.estados.length || c.parametros.length)) controladores.set(nomeAtor, c);
    else controladores.delete(nomeAtor);
    if (!silencioso) avisarControladores();
};

export const renomearControlador = (antigo, novo) => {
    if (!controladores.has(antigo) || antigo === novo) return;
    controladores.set(novo, controladores.get(antigo));
    controladores.delete(antigo);
};

export const apagarControlador = nomeAtor => {
    controladores.delete(nomeAtor);
    avisarControladores();
};

export const limparControladores = () => {
    controladores.clear();
};

/** Só os controladores de atores que existem no projeto. */
export const serializarControladores = runtime => {
    const nomes = new Set(runtime.targets.filter(t => t.isOriginal && !t.isStage).map(t => t.getName()));
    const r = {};
    controladores.forEach((c, nome) => {
        if (nomes.has(nome)) r[nome] = c;
    });
    return r;
};

const novoId = () => Math.random().toString(36)
    .slice(2, 9);
export {novoId};

/** Confere e corrige um controlador vindo de arquivo. */
export const normalizarControlador = c => {
    const r = controladorVazio();
    if (!c || typeof c !== 'object') return r;
    if (c.qualquer && Number.isFinite(c.qualquer.x) && Number.isFinite(c.qualquer.y)) {
        r.qualquer = {x: c.qualquer.x, y: c.qualquer.y};
    }
    r.parametros = (c.parametros || []).filter(p => p && p.nome).map(p => ({
        nome: String(p.nome).slice(0, 40),
        tipo: ['numero', 'booleano', 'gatilho'].includes(p.tipo) ? p.tipo : 'numero',
        valor: p.tipo === 'booleano' ? Boolean(p.valor) : (p.tipo === 'gatilho' ? false : Number(p.valor) || 0)
    }));
    r.estados = (c.estados || []).filter(e => e && e.id).map((e, i) => ({
        id: String(e.id), nome: String(e.nome || `estado ${i + 1}`).slice(0, 40), animacao: String(e.animacao || ''),
        qps: Math.max(0.1, Math.min(120, Number(e.qps) || 24)), loop: e.loop !== false,
        x: Number.isFinite(e.x) ? e.x : 60 + ((i % 4) * 200), y: Number.isFinite(e.y) ? e.y : 80 + (Math.floor(i / 4) * 120)
    }));
    const ids = new Set(r.estados.map(e => e.id));
    r.inicial = ids.has(c.inicial) ? c.inicial : (r.estados[0] ? r.estados[0].id : null);
    r.transicoes = (c.transicoes || []).filter(t => t && (ids.has(t.de) || t.de === QUALQUER) && ids.has(t.para))
        .map(t => ({
            id: String(t.id || novoId()), de: t.de, para: t.para, aoTerminar: Boolean(t.aoTerminar),
            condicoes: (t.condicoes || []).filter(k => k && k.param).map(k => ({param: String(k.param), op: String(k.op || '='),
                valor: k.valor}))
        }));
    return r;
};

export const carregarControladores = dados => {
    controladores.clear();
    if (!dados || typeof dados !== 'object') return;
    Object.keys(dados).forEach(nome => {
        const c = normalizarControlador(dados[nome]);
        if (c.estados.length || c.parametros.length) controladores.set(nome, c);
    });
};

/**
 * Confere as condições de uma transição.
 * @param {object} t transição
 * @param {Map} valores valores atuais dos parâmetros
 * @param {Set} gatilhos gatilhos disparados
 * @param {boolean} terminou a animação do estado atual já terminou (uma vez)?
 * @returns {boolean} pode passar
 */
export const transicaoPassa = (t, valores, gatilhos, terminou) => {
    if (t.aoTerminar && !terminou) return false;
    if (!t.condicoes.length && !t.aoTerminar) return false; // transição sem nenhuma regra nunca passa sozinha
    return t.condicoes.every(k => {
        const v = valores.get(k.param);
        const alvo = Number(k.valor);
        switch (k.op) {
        case 'verdadeiro': return v === true;
        case 'falso': return v !== true;
        case 'disparado': return gatilhos.has(k.param);
        case '>': return Number(v) > alvo;
        case '<': return Number(v) < alvo;
        case '≥': return Number(v) >= alvo;
        case '≤': return Number(v) <= alvo;
        case '≠': return Number(v) !== alvo;
        default: return Number(v) === alvo;
        }
    });
};
