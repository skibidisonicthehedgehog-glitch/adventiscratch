/**
 * Tamanho do palco do projeto (Opções do projeto → Palco).
 *
 * O padrão do Scratch é 480×360. Aqui dá para escolher outro tamanho (ex.: 960×540 para jogos 16:9).
 * As coordenadas do palco passam a ir de -largura/2 a +largura/2 e de -altura/2 a +altura/2.
 * No editor o palco continua com a mesma largura na tela; a altura acompanha a proporção.
 * O tamanho fica salvo no .asp em adventiscratch/palco.json.
 */
export const PALCO_PADRAO = {largura: 480, altura: 360};
export const PREDEFINIDOS = [
    {nome: 'Scratch (4:3)', largura: 480, altura: 360},
    {nome: 'Grande 4:3', largura: 640, altura: 480},
    {nome: 'Pequeno 4:3', largura: 320, altura: 240},
    {nome: 'Widescreen 16:9', largura: 640, altura: 360},
    {nome: 'HD 16:9 (Pizza Tower)', largura: 960, altura: 540},
    {nome: 'HD 720p', largura: 1280, altura: 720},
    {nome: 'Quadrado', largura: 480, altura: 480},
    {nome: 'Celular em pé (9:16)', largura: 360, altura: 640}
];

let largura = PALCO_PADRAO.largura;
let altura = PALCO_PADRAO.altura;
let instalado = false;

export const tamanhoPalco = () => ({largura, altura});
export const palcoEhPadrao = () => largura === PALCO_PADRAO.largura && altura === PALCO_PADRAO.altura;

const limitar = (v, min, max, padrao) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : padrao;
};

/**
 * Prepara o VM para aceitar outros tamanhos (uma vez só): tamanho do Runtime e conversão do mouse.
 * @param {object} vm VM do Scratch
 */
export const instalarPalco = vm => {
    if (instalado) return;
    instalado = true;
    const Runtime = vm.runtime.constructor;
    Object.defineProperty(Runtime, 'STAGE_WIDTH', {get: () => largura, configurable: true});
    Object.defineProperty(Runtime, 'STAGE_HEIGHT', {get: () => altura, configurable: true});
    vm.runtime.stageWidth = largura;
    vm.runtime.stageHeight = altura;
    // o mouse do VM converte para 480×360 fixo: passa a usar o tamanho atual
    const mouse = vm.runtime.ioDevices && vm.runtime.ioDevices.mouse;
    if (mouse) {
        const original = mouse.postData.bind(mouse);
        mouse.postData = data => {
            original(data);
            if (data.x) {
                mouse._scratchX = Math.round(Math.max(-largura / 2, Math.min(largura / 2,
                    largura * ((data.x / data.canvasWidth) - 0.5))));
            }
            if (data.y) {
                mouse._scratchY = Math.round(Math.max(-altura / 2, Math.min(altura / 2,
                    -altura * ((data.y / data.canvasHeight) - 0.5))));
            }
        };
    }
};

/**
 * Muda o tamanho do palco.
 * @param {object} vm VM do Scratch
 * @param {number} w largura (120 a 1920)
 * @param {number} h altura (90 a 1080)
 */
export const aplicarTamanhoPalco = (vm, w, h) => {
    instalarPalco(vm);
    largura = limitar(w, 120, 1920, PALCO_PADRAO.largura);
    altura = limitar(h, 90, 1080, PALCO_PADRAO.altura);
    vm.runtime.stageWidth = largura;
    vm.runtime.stageHeight = altura;
    if (vm.renderer) {
        vm.renderer.setStageSize(-largura / 2, largura / 2, -altura / 2, altura / 2);
    }
    // atores que ficaram fora do palco voltam para dentro
    for (const t of vm.runtime.targets) {
        if (!t.isStage && t.keepInFence) {
            const [x, y] = t.keepInFence(t.x, t.y);
            t.setXY(x, y);
        }
    }
    vm.runtime.emit('ADVENTISCRATCH_PALCO', largura, altura);
    window.dispatchEvent(new CustomEvent('adventiscratch-palco', {detail: {largura, altura}}));
    if (vm.runtime.requestRedraw) vm.runtime.requestRedraw();
    if (vm.renderer) vm.renderer.draw();
};

export const serializarPalco = () => (palcoEhPadrao() ? null : {largura, altura});

export const carregarPalco = (vm, dados) => {
    if (dados && dados.largura && dados.altura) aplicarTamanhoPalco(vm, dados.largura, dados.altura);
};
