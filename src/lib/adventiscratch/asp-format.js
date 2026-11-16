/**
 * Formato .asp (AdventiScratch Project).
 *
 * Um .asp é um .sb3 (zip com project.json + fantasias + sons) com uma pasta extra:
 *   adventiscratch/manifest.json  -> {"format": "asp", "version": 1, "models": [...]}
 *   adventiscratch/models/<arquivo>  -> modelos 3D importados
 *
 * Por isso o Adventiscratch abre .asp e .sb3, e um .asp renomeado para .sb3 ainda abre
 * no Scratch comum (os blocos 3D só não funcionam lá).
 */
import JSZip from 'jszip';
import {addModel, clearModels, getAllModels} from './model-store.js';

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
            version: 1,
            editor: 'Adventiscratch',
            models: models.map(m => ({name: m.name, file: m.fileName, ext: m.ext}))
        }, null, 2));
        models.forEach(m => zip.file(`${ASP_DIR}models/${m.fileName}`, m.data));
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
        if (isZip(input)) {
            try {
                const zip = await JSZip.loadAsync(input);
                const manifestFile = zip.file(`${ASP_DIR}manifest.json`);
                if (manifestFile) {
                    const manifest = JSON.parse(await manifestFile.async('string'));
                    for (const m of manifest.models || []) {
                        const file = zip.file(`${ASP_DIR}models/${m.file}`);
                        if (file) addModel(m.file, await file.async('arraybuffer'), true);
                    }
                }
            } catch (e) {
                // projeto sem dados do Adventiscratch: segue normalmente
                console.warn('Adventiscratch: não foi possível ler os modelos 3D do projeto', e); // eslint-disable-line no-console
            }
        }
        if (onProjectChanged) onProjectChanged();
        return originalLoad(input);
    };
};
