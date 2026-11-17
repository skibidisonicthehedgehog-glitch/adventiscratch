/**
 * Extensão "Extras Adventiblocks".
 * Blocos que não existem no Scratch original, com textos em pt-BR.
 */
import icone from './icone.svg';

const ArgumentType = {NUMBER: 'number', STRING: 'string', BOOLEAN: 'Boolean'};
const BlockType = {REPORTER: 'reporter', BOOLEAN: 'Boolean'};

const toNumber = value => {
    const n = Number(value);
    return Number.isNaN(n) ? 0 : n;
};
const toBool = value => {
    if (typeof value === 'string') {
        const v = value.toLowerCase();
        return !(v === '' || v === '0' || v === 'false' || v === 'falso');
    }
    return Boolean(value);
};
const compare = (a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (a !== '' && b !== '' && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
};

class AdventiscratchExtras {
    constructor (runtime) {
        this.runtime = runtime;
    }

    getInfo () {
        return {
            id: 'adventiscratch',
            name: 'Extras Adventiblocks',
            color1: '#6D4FC2',
            color2: '#5B3FA8',
            color3: '#4A3290',
            menuIconURI: icone,
            blockIconURI: icone,
            blocks: [
                {
                    opcode: 'potencia',
                    blockType: BlockType.REPORTER,
                    text: '[A] elevado a [B]',
                    arguments: {
                        A: {type: ArgumentType.NUMBER, defaultValue: 2},
                        B: {type: ArgumentType.NUMBER, defaultValue: 3}
                    }
                },
                {
                    opcode: 'raiz',
                    blockType: BlockType.REPORTER,
                    text: 'raiz [N] de [X]',
                    arguments: {
                        N: {type: ArgumentType.NUMBER, defaultValue: 3},
                        X: {type: ArgumentType.NUMBER, defaultValue: 27}
                    }
                },
                '---',
                {opcode: 'verdadeiro', blockType: BlockType.BOOLEAN, text: 'verdadeiro'},
                {opcode: 'falso', blockType: BlockType.BOOLEAN, text: 'falso'},
                {
                    opcode: 'diferente',
                    blockType: BlockType.BOOLEAN,
                    text: '[A] ≠ [B]',
                    arguments: {
                        A: {type: ArgumentType.STRING, defaultValue: '10'},
                        B: {type: ArgumentType.STRING, defaultValue: '50'}
                    }
                },
                {
                    opcode: 'maiorIgual',
                    blockType: BlockType.BOOLEAN,
                    text: '[A] ≥ [B]',
                    arguments: {
                        A: {type: ArgumentType.STRING, defaultValue: '10'},
                        B: {type: ArgumentType.STRING, defaultValue: '50'}
                    }
                },
                {
                    opcode: 'menorIgual',
                    blockType: BlockType.BOOLEAN,
                    text: '[A] ≤ [B]',
                    arguments: {
                        A: {type: ArgumentType.STRING, defaultValue: '10'},
                        B: {type: ArgumentType.STRING, defaultValue: '50'}
                    }
                },
                {
                    opcode: 'seSenao',
                    blockType: BlockType.REPORTER,
                    text: 'se [COND] então [A] senão [B]',
                    arguments: {
                        COND: {type: ArgumentType.BOOLEAN},
                        A: {type: ArgumentType.STRING, defaultValue: 'sim'},
                        B: {type: ArgumentType.STRING, defaultValue: 'não'}
                    }
                },
                '---',
                {
                    opcode: 'caixa',
                    blockType: BlockType.REPORTER,
                    text: '[TEXTO] em [MODO]',
                    arguments: {
                        TEXTO: {type: ArgumentType.STRING, defaultValue: 'Adventiblocks'},
                        MODO: {type: ArgumentType.STRING, menu: 'modos', defaultValue: 'maiusculas'}
                    }
                },
                {
                    opcode: 'substituir',
                    blockType: BlockType.REPORTER,
                    text: 'substitua [DE] por [PARA] em [TEXTO]',
                    arguments: {
                        DE: {type: ArgumentType.STRING, defaultValue: 'mundo'},
                        PARA: {type: ArgumentType.STRING, defaultValue: 'turma'},
                        TEXTO: {type: ArgumentType.STRING, defaultValue: 'olá, mundo!'}
                    }
                },
                {
                    opcode: 'repetirTexto',
                    blockType: BlockType.REPORTER,
                    text: 'repita [TEXTO] [N] vezes',
                    arguments: {
                        TEXTO: {type: ArgumentType.STRING, defaultValue: 'ha'},
                        N: {type: ArgumentType.NUMBER, defaultValue: 3}
                    }
                },
                {
                    opcode: 'contem',
                    blockType: BlockType.BOOLEAN,
                    text: '[TEXTO] começa com [PARTE]?',
                    arguments: {
                        TEXTO: {type: ArgumentType.STRING, defaultValue: 'abacaxi'},
                        PARTE: {type: ArgumentType.STRING, defaultValue: 'aba'}
                    }
                },
                '---',
                {opcode: 'milissegundos', blockType: BlockType.REPORTER, text: 'milissegundos desde 1970'},
                {
                    opcode: 'dataHoje',
                    blockType: BlockType.REPORTER,
                    text: 'data de hoje'
                }
            ],
            menus: {
                modos: {
                    acceptReporters: false,
                    items: [
                        {text: 'MAIÚSCULAS', value: 'maiusculas'},
                        {text: 'minúsculas', value: 'minusculas'},
                        {text: 'Primeira Letra Maiúscula', value: 'titulo'}
                    ]
                }
            }
        };
    }

    potencia ({A, B}) {
        return Math.pow(toNumber(A), toNumber(B));
    }
    raiz ({N, X}) {
        const n = toNumber(N);
        const x = toNumber(X);
        if (n === 0) return 0;
        if (x < 0 && n % 2 === 1) return -Math.pow(-x, 1 / n);
        return Math.pow(x, 1 / n);
    }
    verdadeiro () {
        return true;
    }
    falso () {
        return false;
    }
    diferente ({A, B}) {
        return compare(A, B) !== 0;
    }
    maiorIgual ({A, B}) {
        return compare(A, B) >= 0;
    }
    menorIgual ({A, B}) {
        return compare(A, B) <= 0;
    }
    seSenao ({COND, A, B}) {
        return toBool(COND) ? A : B;
    }
    caixa ({TEXTO, MODO}) {
        const t = String(TEXTO);
        if (MODO === 'minusculas') return t.toLocaleLowerCase('pt-BR');
        if (MODO === 'titulo') {
            return t.toLocaleLowerCase('pt-BR').replace(/(^|\s)(\S)/g, (m, s, c) => s + c.toLocaleUpperCase('pt-BR'));
        }
        return t.toLocaleUpperCase('pt-BR');
    }
    substituir ({DE, PARA, TEXTO}) {
        if (String(DE) === '') return String(TEXTO);
        return String(TEXTO).split(String(DE)).join(String(PARA));
    }
    repetirTexto ({TEXTO, N}) {
        const n = Math.max(0, Math.min(10000, Math.floor(toNumber(N))));
        return String(TEXTO).repeat(n);
    }
    contem ({TEXTO, PARTE}) {
        return String(TEXTO).toLowerCase().startsWith(String(PARTE).toLowerCase());
    }
    milissegundos () {
        return Date.now();
    }
    dataHoje () {
        return new Date().toLocaleDateString('pt-BR');
    }
}

export {AdventiscratchExtras};
