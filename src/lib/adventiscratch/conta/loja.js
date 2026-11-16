/**
 * Loja de modelos: publicar um modelo do projeto e adicionar modelos da loja ao projeto.
 *
 * Pacote de modelo (.zip) = manifest.json + arquivo do modelo + texturas/materiais usados.
 * É o mesmo conteúdo que fica dentro do .asp, então o modelo chega ao outro aluno exatamente igual.
 */
import JSZip from 'jszip';

import {addModel, getModel} from '../model-store.js';
import {baixarBinario, enviarArquivos} from './api.js';

let vmAtual = null;
export const iniciarLoja = vm => {
    vmAtual = vm;
};

const carregarMotor = () => import(/* webpackChunkName: "adventiscratch-3d" */ '../three-engine.js');

/**
 * Publica um modelo do projeto atual na loja (global).
 * @param {object} dados {modelo, titulo, descricao, licenca, credito, tags, confirmo}
 * @returns {Promise<object>} modelo publicado
 */
export const publicarModelo = async dados => {
    const modelo = getModel(dados.modelo);
    if (!modelo) throw new Error('Escolha um modelo do projeto.');
    const zip = new JSZip();
    const recursos = Object.values(modelo.resources || {});
    zip.file('manifest.json', JSON.stringify({
        modelo: modelo.fileName,
        recursos: recursos.map(r => r.name),
        materialMaps: modelo.materialMaps || null,
        editor: 'Adventiscratch'
    }, null, 2));
    zip.file(modelo.fileName, modelo.data);
    recursos.forEach(r => zip.file(r.name, r.data));
    const pacote = await zip.generateAsync({type: 'blob', compression: 'DEFLATE', compressionOptions: {level: 6}});

    const {renderMiniatura} = await carregarMotor();
    let miniatura = null;
    let animacoes = 0;
    try {
        const r = await renderMiniatura(modelo.data, modelo.ext, modelo.resources, modelo.materialMaps);
        miniatura = r.png;
        animacoes = r.animacoes;
    } catch (e) {
        console.warn('Adventiscratch: não foi possível desenhar a miniatura do modelo', e); // eslint-disable-line no-console
    }
    const resposta = await enviarArquivos('/modelos', {
        pacote: {blob: pacote, nome: 'modelo.zip'},
        miniatura: miniatura ? {blob: miniatura, nome: 'miniatura.png'} : null,
        titulo: dados.titulo,
        descricao: dados.descricao || '',
        licenca: dados.licenca,
        credito: dados.credito || '',
        tags: dados.tags || '',
        animacoes,
        confirmo: dados.confirmo ? '1' : ''
    });
    return resposta.modelo;
};

/**
 * Baixa um modelo da loja e coloca no projeto atual.
 * @param {object} m modelo (resposta da API)
 * @returns {Promise<string>} nome do modelo no projeto
 */
export const adicionarModeloDaLoja = async m => {
    const dados = await baixarBinario(`/modelos/${m.id}/pacote`);
    const zip = await JSZip.loadAsync(dados);
    const manifesto = JSON.parse(await zip.file('manifest.json').async('string'));
    const resources = {};
    for (const nome of manifesto.recursos || []) {
        const f = zip.file(nome);
        if (f) resources[nome.toLowerCase()] = {name: nome, data: await f.async('arraybuffer')};
    }
    const arquivoModelo = zip.file(manifesto.modelo);
    if (!arquivoModelo) throw new Error('Pacote do modelo incompleto.');
    // usa o título da loja como nome do modelo no projeto
    const ext = manifesto.modelo.split('.').pop();
    const nomeArquivo = `${m.titulo.replace(/[\\/:*?"<>|]/g, '').trim() || 'modelo'}.${ext}`;
    const {name} = addModel(nomeArquivo, await arquivoModelo.async('arraybuffer'), {
        resources,
        materialMaps: manifesto.materialMaps || null,
        missing: []
    });
    if (vmAtual) {
        if (!vmAtual.extensionManager.isExtensionLoaded('adventiscratch3d')) {
            await vmAtual.extensionManager.loadExtensionURL('adventiscratch3d');
        }
        vmAtual.emit('PROJECT_CHANGED');
    }
    return name;
};
