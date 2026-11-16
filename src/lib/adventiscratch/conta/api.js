/**
 * Cliente da API do servidor do Adventiscratch (contas e moderação).
 */
const CHAVE_TOKEN = 'adventiscratch.token';

const config = () => window.ADVENTISCRATCH_CONFIG || {};

/** Endereço da API, ou null se as contas estiverem desligadas. */
export const apiBase = () => {
    const api = (config().api || '').trim();
    if (api === 'desligado') return null;
    if (api) return api.replace(/\/+$/, '');
    if (window.location.port === '8601') return `${window.location.protocol}//${window.location.hostname}:8000/api`;
    return '/api';
};

export const exigeLogin = () => apiBase() !== null && config().exigirLogin !== false;

/** Endereço do painel de moderação (mesmo servidor da API). */
export const painelModeracao = () => {
    const base = apiBase();
    return base ? base.replace(/\/api$/, '/moderacao/') : null;
};

export const lerToken = () => {
    try {
        return window.localStorage.getItem(CHAVE_TOKEN);
    } catch (e) {
        return null;
    }
};

export const salvarToken = token => {
    try {
        if (token) window.localStorage.setItem(CHAVE_TOKEN, token);
        else window.localStorage.removeItem(CHAVE_TOKEN);
    } catch (e) { /* navegador sem armazenamento: o login dura só até fechar a aba */ }
};

export class ErroApi extends Error {
    constructor (mensagem, status, campo) {
        super(mensagem);
        this.status = status;
        this.campo = campo;
    }
}

/**
 * Chama a API.
 * @param {string} caminho ex.: '/eu'
 * @param {object} [opcoes] {method, body}
 * @returns {Promise<object>} resposta em JSON
 */
export const chamar = async (caminho, opcoes = {}) => {
    const base = apiBase();
    if (!base) throw new ErroApi('Contas desligadas.', 0);
    const headers = {'Content-Type': 'application/json'};
    const token = lerToken();
    if (token) headers.Authorization = `Token ${token}`;
    let resposta;
    try {
        resposta = await fetch(base + caminho, {
            method: opcoes.method || (opcoes.body ? 'POST' : 'GET'),
            headers,
            body: opcoes.body ? JSON.stringify(opcoes.body) : undefined
        });
    } catch (e) {
        throw new ErroApi('Não foi possível conectar ao servidor do Adventiscratch.', 0);
    }
    let dados = {};
    try {
        dados = await resposta.json();
    } catch (e) { /* resposta sem JSON */ }
    if (!resposta.ok) {
        throw new ErroApi(dados.erro || `Erro ${resposta.status} no servidor.`, resposta.status, dados.campo);
    }
    return dados;
};
