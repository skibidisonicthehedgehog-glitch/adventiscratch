/**
 * Exemplos prontos de cada extensão do Adventiblocks: um botão "📦 Abrir exemplo pronto" no topo da categoria
 * abre o projeto de exemplo (static/exemplos/<nome>.asp) numa aba nova, sem mexer no projeto atual.
 */
export const EXEMPLOS_PRONTOS = {
    adventiscratch: {arquivo: 'calculadora-coruja', titulo: 'Calculadora da Coruja'},
    adventiscratch3d: {arquivo: 'mundo-3d', titulo: 'Mundo 3D'},
    adventiscratch2d: {arquivo: 'coruja-saltitante', titulo: 'Coruja Saltitante'},
    adventiscratchmusica: {arquivo: 'show-da-coruja', titulo: 'Show da Coruja'},
    adventiscratchanim: {arquivo: 'coruja-animada', titulo: 'Coruja Animada'},
    adventiscratchritmo: {arquivo: 'batalha-da-coruja', titulo: 'Batalha da Coruja'},
    adventiscratchcamera: {arquivo: 'coruja-exploradora', titulo: 'Coruja Exploradora'},
    adventiscratchmulti: {arquivo: 'sala-dos-amigos', titulo: 'Sala dos Amigos'},
    adventiscratchtilemap: {arquivo: 'fase-de-blocos', titulo: 'Fase de Blocos'}
};

export const callbackExemplo = idExtensao => `ADVENTISCRATCH_EXEMPLO_${idExtensao}`;

/** Abre o exemplo numa aba nova (o projeto aberto agora continua aqui). */
export const abrirExemploPronto = idExtensao => {
    const ex = EXEMPLOS_PRONTOS[idExtensao];
    if (!ex) return;
    const url = new URL('editor.html', window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('exemplo', ex.arquivo);
    window.open(url.toString(), '_blank', 'noopener');
};

/** Põe o botão do exemplo pronto no topo da categoria (depois dos outros botões que já existirem). */
export const comBotaoDeExemplo = (idExtensao, info) => {
    const ex = EXEMPLOS_PRONTOS[idExtensao];
    if (!ex || !info || !Array.isArray(info.blocks)) return info;
    const botao = {func: callbackExemplo(idExtensao), blockType: 'button', text: `📦 Exemplo pronto: ${ex.titulo}`};
    const blocos = info.blocks.slice();
    let i = 0;
    while (i < blocos.length && blocos[i] && blocos[i].blockType === 'button') i++;
    blocos.splice(i, 0, botao);
    return {...info, blocks: blocos};
};
