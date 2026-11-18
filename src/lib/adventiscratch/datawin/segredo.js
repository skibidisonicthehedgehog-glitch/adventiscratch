/**
 * Extensão secreta: digitar a palavra secreta em qualquer lugar do editor libera a extensão
 * "GameMaker (data.win)" (fica liberada neste navegador).
 */
import capa from './capa-datawin.png';
import icone from './icone-datawin.svg';
import {ID_DATAWIN} from './datawin-extension.js';

const PALAVRA = 'deltarunetomorrow';
const CHAVE = 'adventiblocks.segredo.datawin';

export const segredoLiberado = () => {
    try {
        return localStorage.getItem(CHAVE) === '1';
    } catch (e) {
        return false;
    }
};

export const ENTRADA_DATAWIN = {
    name: 'GameMaker (data.win) 🔓',
    extensionId: ID_DATAWIN,
    iconURL: capa,
    insetIconURL: icone,
    description: 'Extensão secreta! Abra o data.win de um jogo feito no GameMaker e jogue no palco.',
    featured: true
};

/** Coloca a extensão na biblioteca (se ainda não estiver). */
export const incluirNaBiblioteca = lista => {
    if (!lista.some(e => e.extensionId === ID_DATAWIN)) {
        const i = lista.findIndex(e => !String(e.extensionId || '').startsWith('adventiscratch'));
        lista.splice(i < 0 ? lista.length : i, 0, ENTRADA_DATAWIN);
    }
    return lista;
};

/**
 * Fica ouvindo o teclado. Ao completar a palavra, libera e já adiciona a extensão no projeto.
 * @param {object} vm VM do Scratch
 * @param {Array} biblioteca lista de extensões da biblioteca
 * @param {function} avisar mostra uma mensagem rápida
 */
export const ouvirPalavraSecreta = (vm, biblioteca, avisar) => {
    if (segredoLiberado()) incluirNaBiblioteca(biblioteca);
    let digitado = '';
    window.addEventListener('keydown', e => {
        if (!e.key || e.key.length !== 1) return;
        digitado = (digitado + e.key.toLowerCase()).slice(-PALAVRA.length);
        if (digitado !== PALAVRA) return;
        digitado = '';
        const primeiraVez = !segredoLiberado();
        try {
            localStorage.setItem(CHAVE, '1');
        } catch (err) {
            // sem localStorage: vale só nesta sessão
        }
        incluirNaBiblioteca(biblioteca);
        vm.extensionManager.loadExtensionURL(ID_DATAWIN).then(() => {
            avisar(primeiraVez ?
                '🔓 Extensão secreta desbloqueada: GameMaker (data.win)! Ela já está na lista de blocos.' :
                '🔓 GameMaker (data.win) adicionada ao projeto.');
        });
    }, true);
};
