/**
 * Projetos na nuvem: salvar, salvamento automático, abrir e remixar.
 *
 * - O projeto aberto pode ser "meu" (salvar atualiza o mesmo projeto) ou de outra pessoa
 *   (salvar cria uma cópia sua, marcada como remix do original).
 * - Abrir um arquivo do computador ou criar um projeto novo desliga o vínculo com a nuvem.
 */
import {apiBase, baixarBinario, chamar, enviarArquivos} from './api.js';
import {obterEstado} from './conta.js';

const AUTOSALVAR_MS = 2 * 60 * 1000;

const nuvem = {
    projetoId: null, // id do projeto na nuvem (só quando é meu)
    meu: false,
    remixDe: null, // id do projeto original, quando abri o projeto de outra pessoa
    titulo: '',
    compartilhado: false,
    alterado: false,
    salvando: false,
    salvoEm: null,
    erro: ''
};
const ouvintes = new Set();
let vmAtual = null;
let carregandoDaNuvem = false;

export const obterNuvem = () => nuvem;
export const aoMudarNuvem = fn => {
    ouvintes.add(fn);
    return () => ouvintes.delete(fn);
};
const avisar = () => ouvintes.forEach(fn => fn({...nuvem}));

export const nuvemDisponivel = () => apiBase() !== null && obterEstado().fase === 'ok';

// ---------------------------------------------------------------- título do projeto (campo do editor)

const campoTitulo = () => document.querySelector('input[class*="title-field"]');

export const lerTitulo = () => {
    const campo = campoTitulo();
    return (campo && campo.value.trim()) || nuvem.titulo || 'Meu projeto';
};

const definirTitulo = titulo => {
    const campo = campoTitulo();
    if (!campo) return;
    // o campo é controlado pelo React: muda o valor do jeito que o React percebe e confirma com blur
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(campo, titulo);
    campo.dispatchEvent(new Event('input', {bubbles: true}));
    campo.dispatchEvent(new FocusEvent('blur'));
    campo.dispatchEvent(new FocusEvent('focusout', {bubbles: true}));
};

// ---------------------------------------------------------------- miniatura do projeto

const miniaturaProjeto = () => new Promise(resolve => {
    const renderer = vmAtual && vmAtual.runtime.renderer;
    if (!renderer || !renderer.requestSnapshot) return resolve(null);
    renderer.requestSnapshot(dataUrl => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 240;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 320, 240);
            // a cena 3D fica numa camada por cima do palco: desenha junto
            const camada3d = document.querySelector('canvas.adventiscratch-3d');
            if (camada3d && camada3d.style.display !== 'none' && camada3d.width) {
                try {
                    ctx.drawImage(camada3d, 0, 0, 320, 240);
                } catch (e) { /* sem 3D na miniatura */ }
            }
            canvas.toBlob(resolve, 'image/png');
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
    });
});

// ---------------------------------------------------------------- salvar

/**
 * Salva o projeto atual na nuvem.
 * @param {object} [opcoes] {titulo, descricao, compartilhar, silencioso}
 * @returns {Promise<object>} projeto salvo
 */
export const salvarNaNuvem = async (opcoes = {}) => {
    if (!vmAtual || nuvem.salvando) return null;
    nuvem.salvando = true;
    nuvem.erro = '';
    avisar();
    try {
        const titulo = (opcoes.titulo || lerTitulo()).slice(0, 80);
        const arquivo = await vmAtual.saveProjectSb3();
        const miniatura = await miniaturaProjeto();
        const campos = {
            arquivo: {blob: arquivo, nome: 'projeto.asp'},
            miniatura: miniatura ? {blob: miniatura, nome: 'miniatura.png'} : null,
            titulo
        };
        if (typeof opcoes.descricao === 'string') campos.descricao = opcoes.descricao;
        let resposta;
        if (nuvem.projetoId && nuvem.meu) {
            resposta = await enviarArquivos(`/projetos/${nuvem.projetoId}`, campos);
        } else {
            campos.compartilhar = opcoes.compartilhar ? '1' : '';
            if (nuvem.remixDe) campos.remixado_de = nuvem.remixDe;
            resposta = await enviarArquivos('/projetos', campos);
        }
        const p = resposta.projeto;
        Object.assign(nuvem, {
            projetoId: p.id, meu: true, remixDe: null, titulo: p.titulo, compartilhado: p.compartilhado,
            alterado: false, salvoEm: new Date()
        });
        if (titulo !== lerTitulo()) definirTitulo(titulo);
        return p;
    } catch (e) {
        nuvem.erro = e.message;
        throw e;
    } finally {
        nuvem.salvando = false;
        avisar();
    }
};

/** O projeto atual já tem lugar na nuvem (salvar não precisa perguntar nada)? */
export const jaEstaNaNuvem = () => !!(nuvem.projetoId && nuvem.meu);

// ---------------------------------------------------------------- abrir

/**
 * Abre um projeto da nuvem no editor.
 * @param {object} p projeto (resposta da API)
 */
export const abrirDaNuvem = async p => {
    const dados = await baixarBinario(`/projetos/${p.id}/arquivo`);
    carregandoDaNuvem = true;
    try {
        await vmAtual.loadProject(dados);
    } finally {
        carregandoDaNuvem = false;
    }
    Object.assign(nuvem, {
        projetoId: p.meu ? p.id : null,
        meu: p.meu,
        remixDe: p.meu ? null : p.id,
        titulo: p.meu ? p.titulo : `Remix de ${p.titulo}`.slice(0, 80),
        compartilhado: p.meu ? p.compartilhado : false,
        alterado: false,
        salvoEm: p.meu ? new Date(p.atualizado_em) : null,
        erro: ''
    });
    setTimeout(() => {
        definirTitulo(nuvem.titulo);
        nuvem.alterado = false;
        avisar();
    }, 600);
    avisar();
};

/** Chamado sempre que um projeto é aberto (arquivo, exemplo, novo…). */
export const aoCarregarProjeto = () => {
    if (carregandoDaNuvem) return;
    Object.assign(nuvem, {
        projetoId: null, meu: false, remixDe: null, titulo: '', compartilhado: false,
        alterado: false, salvoEm: null, erro: ''
    });
    avisar();
};

export const compartilhar = async (id, sim) => {
    const r = await chamar(`/projetos/${id}/compartilhar`, {body: {compartilhar: !!sim}});
    if (id === nuvem.projetoId) {
        nuvem.compartilhado = r.projeto.compartilhado;
        avisar();
    }
    return r.projeto;
};

export const apagarProjeto = async id => {
    await chamar(`/projetos/${id}/apagar`, {body: {}});
    if (id === nuvem.projetoId) aoCarregarProjeto();
};

// ---------------------------------------------------------------- início

export const iniciarNuvem = vm => {
    vmAtual = vm;
    vm.on('PROJECT_CHANGED', () => {
        if (!nuvem.alterado) {
            nuvem.alterado = true;
            avisar();
        }
    });
    setInterval(() => {
        if (jaEstaNaNuvem() && nuvem.alterado && !nuvem.salvando && nuvemDisponivel()) {
            salvarNaNuvem({silencioso: true}).catch(() => { /* tenta de novo no próximo ciclo */ });
        }
    }, AUTOSALVAR_MS);
    // avisa antes de fechar a aba com alterações não salvas na nuvem
    window.addEventListener('beforeunload', e => {
        if (jaEstaNaNuvem() && nuvem.alterado) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
};
