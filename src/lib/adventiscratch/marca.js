/**
 * Marca do editor nas mensagens da interface: onde o Scratch escrevia "Scratch", o Adventiblocks escreve
 * "Screate". O nome do programa "Scratch Link" (necessário para micro:bit, LEGO etc.) continua igual,
 * porque é o nome do aplicativo que a pessoa precisa instalar.
 */
export const NOME_EDITOR = 'Screate';

const TROCAS = {
    'pt-br': {
        'gui.crashMessage.description': `Parece que o ${NOME_EDITOR} parou de funcionar. Atualize a página para tentar de novo.`,
        'gui.gui.defaultProjectTitle': `Projeto ${NOME_EDITOR}`,
        'gui.menuBar.joinScratch': 'Criar conta'
    },
    'en': {
        'gui.crashMessage.description': `We are so sorry, but it looks like ${NOME_EDITOR} has crashed. ` +
            'Please refresh your page to try again.',
        'gui.gui.defaultProjectTitle': `${NOME_EDITOR} Project`,
        'gui.menuBar.joinScratch': 'Create account'
    }
};

/** Troca "Scratch" por "Screate" num texto (menos "Scratch Link"). */
export const trocarMarca = texto => String(texto)
    .replace(/\bScratch 3\.0\b/g, NOME_EDITOR)
    .replace(/\bScratch\b(?! Link)/g, NOME_EDITOR);

/** Devolve as mensagens de todas as línguas com a marca trocada. */
export const mensagensComMarca = porLingua => {
    const r = {};
    Object.keys(porLingua).forEach(lingua => {
        const msgs = {};
        Object.entries(porLingua[lingua] || {}).forEach(([id, texto]) => {
            msgs[id] = typeof texto === 'string' ? trocarMarca(texto) : texto;
        });
        Object.assign(msgs, TROCAS[lingua] || {});
        r[lingua] = msgs;
    });
    return r;
};
