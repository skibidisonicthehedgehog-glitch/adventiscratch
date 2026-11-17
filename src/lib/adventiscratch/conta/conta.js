/**
 * Estado da conta no editor e qual tela mostrar.
 *
 * - Sem login (e login exigido)      -> tela de entrar / criar conta
 * - Conta suspensa                   -> tela de suspensão (bloqueia o editor)
 * - Advertência ainda não lida       -> aviso "Li e entendi"
 * - Servidor fora do ar (login exigido) -> tela "sem conexão"
 *
 * A situação é conferida de novo a cada minuto e quando a aba volta a ficar visível,
 * então uma suspensão aplicada pelo moderador aparece mesmo com o editor aberto.
 */
import {ErroApi, apiBase, chamar, exigeLogin, lerToken, salvarToken} from './api.js';
import {fecharTela, telaAdvertencia, telaDenuncia, telaLogin, telaSemConexao, telaSuspensao} from './telas.js';

const INTERVALO_MS = 60 * 1000;

const estado = {
    fase: 'carregando', // carregando | desligado | anonimo | ok | suspensa | offline
    situacao: null,
    semContaEscolhido: false
};
const ouvintes = new Set();
let vmAtual = null;
let telaChave = '';
let timer = null;

/**
 * Aba pedida pelo endereço (ex.: editor.html?conta=criar, vindo dos botões da página inicial).
 * Lida uma vez ao carregar; depois o parâmetro sai do endereço para não reabrir a janela no F5.
 */
const lerAbaDoEndereco = () => {
    try {
        const url = new URL(window.location.href);
        const pedido = url.searchParams.get('conta');
        if (!pedido) return null;
        url.searchParams.delete('conta');
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
        return pedido === 'criar' ? 'criar' : 'entrar';
    } catch (e) {
        return null;
    }
};
let abaPedida = 'entrar';
let abrirAoCarregar = false;

export const obterEstado = () => estado;

export const aoMudar = fn => {
    ouvintes.add(fn);
    return () => ouvintes.delete(fn);
};

const avisar = () => ouvintes.forEach(fn => fn(estado));

const baixarProjeto = async () => {
    if (!vmAtual) return;
    const blob = await vmAtual.saveProjectSb3();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'meu-projeto.asp';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};

/** Decide e mostra a tela certa para o estado atual (sem refazer a mesma tela à toa). */
const renderizar = () => {
    const {fase, situacao} = estado;
    let chave = fase;
    if (fase === 'suspensa') chave += JSON.stringify(situacao.sancao);
    if (fase === 'ok' && situacao.advertencias.length) chave += `adv${situacao.advertencias[0].id}`;
    if (chave === telaChave) return;
    telaChave = chave;

    if (fase === 'anonimo' && exigeLogin() && !estado.semContaEscolhido) {
        telaLogin({entrar, registrar, aba: abaPedida});
    } else if (fase === 'suspensa') {
        telaSuspensao(situacao, {baixarProjeto, sair, pedirRevisao, atualizar});
    } else if (fase === 'offline' && exigeLogin()) {
        telaSemConexao('Não foi possível falar com o servidor do Adventiscratch.', atualizar);
    } else if (fase === 'ok' && situacao.advertencias.length) {
        const adv = situacao.advertencias[0];
        telaAdvertencia(adv, situacao.conta.nome, async () => {
            aplicar(await chamar(`/advertencias/${adv.id}/ciente`, {method: 'POST', body: {}}));
        });
    } else {
        fecharTela();
    }
};

const aplicar = situacao => {
    estado.situacao = situacao;
    estado.fase = situacao.status === 'suspensa' ? 'suspensa' : 'ok';
    renderizar();
    avisar();
};

/** Confere a situação da conta no servidor. */
export const atualizar = async () => {
    if (!apiBase()) {
        estado.fase = 'desligado';
        renderizar();
        avisar();
        return;
    }
    if (!lerToken()) {
        estado.fase = 'anonimo';
        estado.situacao = null;
        renderizar();
        avisar();
        if (abrirAoCarregar) {
            abrirAoCarregar = false;
            if (!exigeLogin()) abrirLogin(abaPedida);
        }
        return;
    }
    abrirAoCarregar = false;
    try {
        aplicar(await chamar('/eu'));
    } catch (e) {
        if (e instanceof ErroApi && e.status === 401) {
            salvarToken(null);
            estado.fase = 'anonimo';
            estado.situacao = null;
        } else if (estado.fase === 'carregando' || estado.fase === 'offline') {
            estado.fase = 'offline';
        }
        // se já estava usando e a internet caiu por um momento, mantém a última situação conhecida
        renderizar();
        avisar();
    }
};

export const entrar = async (usuario, senha) => {
    const r = await chamar('/entrar', {body: {usuario, senha}});
    salvarToken(r.token);
    aplicar(r);
};

export const registrar = async dados => {
    const r = await chamar('/registrar', {body: dados});
    salvarToken(r.token);
    aplicar(r);
};

export const sair = async () => {
    try {
        await chamar('/sair', {method: 'POST', body: {}});
    } catch (e) { /* mesmo sem servidor, sai localmente */ }
    salvarToken(null);
    estado.fase = 'anonimo';
    estado.situacao = null;
    estado.semContaEscolhido = false;
    abaPedida = 'entrar';
    renderizar();
    avisar();
};

export const pedirRevisao = async (sancaoId, texto) => {
    aplicar(await chamar('/recursos', {body: {sancao: sancaoId, texto}}));
};

/** Abre a janela de denúncia (menu da conta). */
export const abrirDenuncia = async () => {
    let categorias = [];
    try {
        categorias = (await chamar('/categorias')).categorias;
    } catch (e) {
        categorias = [{id: 'outro', nome: 'Outro motivo'}];
    }
    telaChave = 'denuncia';
    telaDenuncia(categorias, async dados => {
        await chamar('/denuncias', {body: dados});
        telaChave = '';
    });
};

/** Mostra a tela de login (quando o login é opcional e o aluno clica em "Entrar"). */
export const abrirLogin = (aba = 'entrar') => {
    telaChave = 'login';
    telaLogin({
        entrar,
        registrar,
        aba: aba === 'criar' ? 'criar' : 'entrar',
        semConta: exigeLogin() ? null : () => {
            estado.semContaEscolhido = true;
            telaChave = '';
            fecharTela();
        }
    });
};

/**
 * Liga o sistema de contas ao editor.
 * @param {VirtualMachine} vm VM do Scratch (para baixar o projeto na tela de suspensão)
 */
export const iniciarContas = vm => {
    vmAtual = vm;
    if (timer) return;
    const aba = lerAbaDoEndereco();
    if (aba) {
        abaPedida = aba;
        abrirAoCarregar = true;
    }
    atualizar();
    timer = setInterval(atualizar, INTERVALO_MS);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') atualizar();
    });
};
