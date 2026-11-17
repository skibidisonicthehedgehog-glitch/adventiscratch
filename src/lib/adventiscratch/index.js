/**
 * Ponto de entrada das personalizações do Adventiscratch na VM.
 * Chamado uma vez pelo GUI (onVmInit).
 */
import {AdventiscratchExtras} from './extras-extension.js';
import {Adventiscratch3D, attach3DToVm, resetForNewProject} from './three-extension.js';
import {AdventiscratchPlataforma2D} from './plataforma2d-extension.js';
import {AdventiscratchMusicas, ligarMusicasNaVm} from './musica/musica-extension.js';
import {iniciarInstrumentos} from './musica/soundfont-store.js';
import {AdventiscratchAnimacoes, ID_ANIM} from './spritesheet/animacoes-extension.js';
import {aoMudarControladores, renomearControlador} from './spritesheet/controladores.js';
import {patchVmForAsp} from './asp-format.js';
import {iniciarContas} from './conta/conta.js';
import {aoCarregarProjeto, iniciarNuvem} from './conta/nuvem.js';
import {iniciarLoja} from './conta/loja.js';
import {toast} from './conta/telas-nuvem.js';
import {iniciarDetector} from './detector-erros.js';
import {iniciarExemplos} from './exemplos.js';

const EXTENSIONS = {
    adventiscratch: AdventiscratchExtras,
    adventiscratch3d: Adventiscratch3D,
    adventiscratch2d: AdventiscratchPlataforma2D,
    adventiscratchmusica: AdventiscratchMusicas,
    adventiscratchanim: AdventiscratchAnimacoes
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

    patchVmForAsp(vm, () => {
        resetForNewProject();
        aoCarregarProjeto();
    });
    // acesso pelo console do navegador (F12), útil para depurar
    window.adventiscratchVM = vm;
    attach3DToVm(vm);
    iniciarContas(vm);
    iniciarNuvem(vm);
    iniciarLoja(vm);
    iniciarDetector(vm);
    iniciarExemplos(vm);
    iniciarInstrumentos(vm);
    ligarMusicasNaVm(vm);
    // controlador de animação: menus de parâmetros/estados atualizam e o projeto fica "alterado"
    aoMudarControladores(() => {
        if (vm.extensionManager.isExtensionLoaded(ID_ANIM)) vm.extensionManager.refreshBlocks();
        vm.emit('PROJECT_CHANGED');
    });
    // ao renomear um ator, o controlador dele vai junto
    const renomearOriginal = vm.renameSprite.bind(vm);
    vm.renameSprite = (id, novoNome) => {
        const alvo = vm.runtime.getTargetById(id);
        const antigo = alvo && alvo.getName();
        renomearOriginal(id, novoNome);
        if (alvo && antigo !== alvo.getName()) renomearControlador(antigo, alvo.getName());
    };
    // avisos rápidos pedidos por janelas que não dependem da Central (ex.: importar spritesheet)
    window.addEventListener('adventiscratch-aviso', e => toast(e.detail && e.detail.texto, 4500));
};

export default setupAdventiscratch;
