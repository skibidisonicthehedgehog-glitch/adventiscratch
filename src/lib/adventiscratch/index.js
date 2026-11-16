/**
 * Ponto de entrada das personalizações do Adventiscratch na VM.
 * Chamado uma vez pelo GUI (onVmInit).
 */
import {AdventiscratchExtras} from './extras-extension.js';
import {Adventiscratch3D, attach3DToVm, resetForNewProject} from './three-extension.js';
import {patchVmForAsp} from './asp-format.js';
import {iniciarContas} from './conta/conta.js';
import {iniciarDetector} from './detector-erros.js';
import {iniciarExemplos} from './exemplos.js';

const EXTENSIONS = {
    adventiscratch: AdventiscratchExtras,
    adventiscratch3d: Adventiscratch3D
};

/**
 * @param {VirtualMachine} vm VM do Scratch
 */
const setupAdventiscratch = vm => {
    const manager = vm.extensionManager;
    if (manager.__adventiscratchPatched) return;
    manager.__adventiscratchPatched = true;

    // ensina a VM a carregar nossas extensões pelo ID
    // (pela biblioteca de extensões e ao abrir projetos que as usam)
    const originalLoad = manager.loadExtensionURL.bind(manager);
    manager.loadExtensionURL = url => {
        const Extension = EXTENSIONS[url];
        if (Extension) {
            if (!manager.isExtensionLoaded(url)) {
                const serviceName = manager._registerInternalExtension(new Extension(vm.runtime));
                manager._loadedExtensions.set(url, serviceName);
            }
            return Promise.resolve();
        }
        return originalLoad(url);
    };

    patchVmForAsp(vm, resetForNewProject);
    // acesso pelo console do navegador (F12), útil para depurar
    window.adventiscratchVM = vm;
    attach3DToVm(vm);
    iniciarContas(vm);
    iniciarDetector(vm);
    iniciarExemplos(vm);
};

export default setupAdventiscratch;
