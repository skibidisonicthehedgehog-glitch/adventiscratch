/**
 * Botão "Abrir data.win…": escolhe o data.win (e, se quiser, as músicas .ogg e os audiogroupN.dat
 * da mesma pasta), carrega e já começa o jogo no palco.
 */
const aviso = texto => window.dispatchEvent(new CustomEvent('adventiscratch-aviso', {detail: {texto}}));

export const abrirDataWin = vm => {
    const ext = vm.runtime.adventiscratchDataWin;
    if (!ext) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.win,.dat,.ogg,.wav,.unx,.droid,.ios';
    input.onchange = async () => {
        const arquivos = Array.from(input.files || []);
        if (!arquivos.length) return;
        aviso('Abrindo o jogo…');
        try {
            const msg = await ext.abrirArquivos(arquivos);
            ext.iniciar();
            aviso(`🎮 ${msg} Use as setas, Z, X e Enter para jogar.`);
        } catch (e) {
            aviso(`⚠ ${e.message}`);
        }
    };
    input.click();
};
