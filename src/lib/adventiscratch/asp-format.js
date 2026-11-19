/**
 * Formato .asp (projeto Adventiblocks).
 *
 * Um .asp é um .sb3 (zip com project.json + fantasias + sons) com uma pasta extra:
 *   adventiscratch/manifest.json  -> {"format": "asp", "version": 1, "models": [...]}
 *   adventiscratch/models/<arquivo>  -> modelos 3D importados
 *   adventiscratch/models/<nome>.files/<arquivo>  -> texturas, .mtl e .bin de cada modelo
 *   adventiscratch/musicas/<n>.json  -> músicas do Criador de Músicas
 *   adventiscratch/instrumentos/<n>.json + <n>.pcm  -> instrumentos .sf2 (só o preset escolhido)
 *   adventiscratch/controladores.json  -> controladores de animação (pelo nome do ator)
 *   adventiscratch/mapas/<n>.json  -> mapas do Jogo de Ritmo
 *   adventiscratch/tilemaps.json  -> tilemaps (fases de blocos) e qual está no palco
 *
 * Por isso o Adventiblocks abre .asp e .sb3, e um .asp renomeado para .sb3 ainda abre
 * no Scratch comum (os blocos 3D só não funcionam lá).
 */
import JSZip from 'jszip';
import {addModel, clearModels, getAllModels} from './model-store.js';
import {gravarMusica, limparMusicas, normalizar, todasMusicas} from './musica/dados.js';
import {adicionarInstrumento, instrumentosExtras, limparInstrumentos} from './musica/soundfont-store.js';
import {carregarControladores, limparControladores, serializarControladores} from './spritesheet/controladores.js';
import {gravarMapa, limparMapas, normalizarMapa, todosMapas} from './ritmo/dados.js';
import {carregarTilemaps, limparTilemaps, serializarTilemaps, todosTilemaps} from './tilemap/dados.js';
import {PALCO_PADRAO, aplicarTamanhoPalco, serializarPalco} from './palco.js';

export const PROJECT_EXTENSION = 'asp';
export const ACCEPTED_PROJECT_EXTENSIONS = '.asp,.sb,.sb2,.sb3';
const ASP_DIR = 'adventiscratch/';

const isZip = input => {
    if (!input) return false;
    const bytes = input instanceof ArrayBuffer ? new Uint8Array(input, 0, Math.min(4, input.byteLength)) :
        (ArrayBuffer.isView(input) ? new Uint8Array(input.buffer, input.byteOffset, Math.min(4, input.byteLength)) :
            null);
    return !!bytes && bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK"
};

/**
 * Faz a VM salvar e abrir arquivos .asp com modelos 3D.
 * @param {VirtualMachine} vm VM do Scratch
 * @param {function(): void} onProjectChanged chamado quando outro projeto é aberto
 */
export const patchVmForAsp = (vm, onProjectChanged) => {
    if (vm.__aspPatched) return;
    vm.__aspPatched = true;

    const originalSave = vm.saveProjectSb3.bind(vm);
    vm.saveProjectSb3 = async () => {
        const blob = await originalSave();
        const models = getAllModels();
        const zip = await JSZip.loadAsync(blob);
        zip.file(`${ASP_DIR}manifest.json`, JSON.stringify({
            format: 'asp',
            version: 3,
            editor: 'Adventiblocks',
            musicas: todasMusicas().map((m, i) => ({nome: m.nome, arquivo: `musicas/${i}.json`})),
            mapas: todosMapas().map((m, i) => ({nome: m.nome, arquivo: `mapas/${i}.json`})),
            instrumentos: instrumentosExtras().map((inst, i) => ({id: inst.id, arquivo: `instrumentos/${i}`})),
            models: models.map(m => ({
                name: m.name,
                file: m.fileName,
                originalFile: m.originalFileName,
                ext: m.ext,
                resources: Object.values(m.resources).map(r => r.name),
                missing: m.missing,
                materialMaps: m.materialMaps
            }))
        }, null, 2));
        todasMusicas().forEach((m, i) => zip.file(`${ASP_DIR}musicas/${i}.json`, JSON.stringify(m)));
        todosMapas().forEach((m, i) => zip.file(`${ASP_DIR}mapas/${i}.json`, JSON.stringify(m)));
        if (todosTilemaps().length) zip.file(`${ASP_DIR}tilemaps.json`, JSON.stringify(serializarTilemaps()));
        if (serializarPalco()) zip.file(`${ASP_DIR}palco.json`, JSON.stringify(serializarPalco()));
        const controladores = serializarControladores(vm.runtime);
        if (Object.keys(controladores).length) {
            zip.file(`${ASP_DIR}controladores.json`, JSON.stringify(controladores));
        }
        instrumentosExtras().forEach((inst, i) => {
            zip.file(`${ASP_DIR}instrumentos/${i}.json`, JSON.stringify(inst.info));
            zip.file(`${ASP_DIR}instrumentos/${i}.pcm`, inst.pcm.buffer.slice(inst.pcm.byteOffset,
                inst.pcm.byteOffset + inst.pcm.byteLength));
        });
        models.forEach(m => {
            zip.file(`${ASP_DIR}models/${m.fileName}`, m.data);
            Object.values(m.resources).forEach(r => {
                zip.file(`${ASP_DIR}models/${m.name}.files/${r.name}`, r.data);
            });
        });
        return zip.generateAsync({
            type: 'blob',
            mimeType: 'application/x.adventiscratch.asp',
            compression: 'DEFLATE',
            compressionOptions: {level: 6}
        });
    };

    const originalLoad = vm.loadProject.bind(vm);
    vm.loadProject = async input => {
        clearModels(true);
        limparMusicas(true);
        limparInstrumentos(true);
        limparControladores();
        limparMapas();
        limparTilemaps();
        let palco = null;
        if (isZip(input)) {
            try {
                const zip = await JSZip.loadAsync(input);
                const manifestFile = zip.file(`${ASP_DIR}manifest.json`);
                if (manifestFile) {
                    const manifest = JSON.parse(await manifestFile.async('string'));
                    for (const m of manifest.models || []) {
                        const file = zip.file(`${ASP_DIR}models/${m.file}`);
                        if (!file) continue;
                        const resources = {};
                        for (const resName of m.resources || []) {
                            const resFile = zip.file(`${ASP_DIR}models/${m.name}.files/${resName}`);
                            if (resFile) {
                                resources[resName.toLowerCase()] = {
                                    name: resName,
                                    data: await resFile.async('arraybuffer')
                                };
                            }
                        }
                        addModel(m.originalFile || m.file, await file.async('arraybuffer'), {
                            silent: true,
                            name: m.name,
                            resources,
                            missing: m.missing || [],
                            materialMaps: m.materialMaps || null
                        });
                    }
                    for (const item of manifest.instrumentos || []) {
                        try {
                            const j = zip.file(`${ASP_DIR}${item.arquivo}.json`);
                            const p = zip.file(`${ASP_DIR}${item.arquivo}.pcm`);
                            if (!j || !p) continue;
                            adicionarInstrumento(JSON.parse(await j.async('string')),
                                new Int16Array(await p.async('arraybuffer')), {silencioso: true, id: item.id});
                        } catch (e) {
                            console.warn('Adventiblocks: instrumento .sf2 danificado no projeto', e); // eslint-disable-line no-console
                        }
                    }
                    const pal = zip.file(`${ASP_DIR}palco.json`);
                    if (pal) {
                        try {
                            palco = JSON.parse(await pal.async('string'));
                        } catch (e) {
                            console.warn('Adventiblocks: tamanho do palco danificado', e); // eslint-disable-line no-console
                        }
                    }
                    const tms = zip.file(`${ASP_DIR}tilemaps.json`);
                    if (tms) {
                        try {
                            carregarTilemaps(JSON.parse(await tms.async('string')));
                        } catch (e) {
                            console.warn('Adventiblocks: tilemaps danificados', e); // eslint-disable-line no-console
                        }
                    }
                    const ctrl = zip.file(`${ASP_DIR}controladores.json`);
                    if (ctrl) {
                        try {
                            carregarControladores(JSON.parse(await ctrl.async('string')));
                        } catch (e) {
                            console.warn('Adventiblocks: controladores de animação danificados', e); // eslint-disable-line no-console
                        }
                    }
                    for (const item of manifest.mapas || []) {
                        const f = zip.file(`${ASP_DIR}${item.arquivo}`);
                        if (!f) continue;
                        try {
                            gravarMapa(normalizarMapa(JSON.parse(await f.async('string'))), null, true);
                        } catch (e) {
                            console.warn('Adventiblocks: mapa de ritmo danificado', e); // eslint-disable-line no-console
                        }
                    }
                    for (const item of manifest.musicas || []) {
                        const f = zip.file(`${ASP_DIR}${item.arquivo}`);
                        if (!f) continue;
                        try {
                            gravarMusica(normalizar(JSON.parse(await f.async('string'))), null, true);
                        } catch (e) {
                            console.warn('Adventiblocks: música danificada no projeto', e); // eslint-disable-line no-console
                        }
                    }
                }
            } catch (e) {
                // projeto sem dados do Adventiblocks: segue normalmente
                console.warn('Adventiblocks: não foi possível ler os modelos 3D do projeto', e); // eslint-disable-line no-console
            }
        }
        if (onProjectChanged) onProjectChanged();
        const resultado = await originalLoad(input);
        // tamanho do palco do projeto (ou o padrão, se o projeto não tiver)
        const p = palco && palco.largura && palco.altura ? palco : PALCO_PADRAO;
        aplicarTamanhoPalco(vm, p.largura, p.altura);
        return resultado;
    };
};
