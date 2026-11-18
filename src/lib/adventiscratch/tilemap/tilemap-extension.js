/**
 * Extensão "Tilemaps": fases feitas de blocos (tiles) desenhadas numa grade, com o Editor de tilemaps.
 *
 * - As figuras dos tiles são as fantasias de um ator (o tileset).
 * - Cada tile tem um tipo: "sólido" e "plataforma" funcionam sozinhos com a extensão Plataforma 2D;
 *   "perigo", "moeda", "escada", "água"… (ou qualquer nome) servem para os blocos "tocando em tile".
 * - Durante o jogo, os blocos podem trocar tiles (pegar moedas, quebrar blocos). Essas mudanças valem só até
 *   o projeto parar: o mapa salvo continua como foi desenhado no editor.
 */
import {
    aoMudarTilemaps, celulaDe, centroDe, definirAtivo, escreverTile, lerTile, nomeAtivo, obterTilemap,
    tilemapAtivo, tipoDoTile, todosTilemaps, NOMES_TIPOS
} from './dados.js';
import {RenderizadorTilemap} from './render.js';

const A = {NUMBER: 'number', STRING: 'string'};
const B = {COMMAND: 'command', REPORTER: 'reporter', BOOLEAN: 'Boolean', HAT: 'hat', BUTTON: 'button'};
export const ID_TILEMAP = 'adventiscratchtilemap';
export const EDITOR_TILEMAP_CALLBACK = 'ADVENTISCRATCH_EDITOR_TILEMAP';
const QUALQUER = '_qualquer_';

const icone = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
<circle cx="20" cy="20" r="19" fill="#fff"/>
<g stroke="#6B3E14" stroke-width="1.2">
<rect x="8" y="20" width="8" height="8" fill="#C07A3A"/><rect x="16" y="20" width="8" height="8" fill="#C07A3A"/>
<rect x="24" y="20" width="8" height="8" fill="#C07A3A"/><rect x="8" y="12" width="8" height="8" fill="#5BBF4B"/>
<rect x="24" y="12" width="8" height="8" fill="#F2C14E"/><rect x="8" y="28" width="8" height="4" fill="#8C5426"/>
<rect x="16" y="28" width="8" height="4" fill="#8C5426"/><rect x="24" y="28" width="8" height="4" fill="#8C5426"/>
</g></svg>`)}`;

const num = (v, p = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : p;
};

const copiarMapa = m => ({
    ...m,
    camadas: {fundo: m.camadas.fundo.slice(), principal: m.camadas.principal.slice()},
    tipos: {...m.tipos}
});

class AdventiscratchTilemap {
    constructor (runtime) {
        this.runtime = runtime;
        runtime.adventiscratchTilemap = this; // usado pela Plataforma 2D (e pelo console, F12)
        this.copia = null; // mapa mudado pelo jogo (some quando o projeto para)
        this.render = new RenderizadorTilemap(runtime, () => this.mapaEmJogo());
        this._quadro = 0;
        aoMudarTilemaps(detalhe => {
            if (detalhe && detalhe.tipo === 'tile') {
                // tile mudado no editor: só redesenha se for o mapa do palco (e o jogo não estiver mudando ele)
                if (detalhe.mapa === nomeAtivo() && !this.copia) this.render.redesenharTile(detalhe.col, detalhe.lin);
                return;
            }
            this.copia = null;
            this.render.atualizar();
        });
        runtime.on('PROJECT_LOADED', () => {
            this.copia = null;
            // espera as fantasias do tileset carregarem
            setTimeout(() => this.render.atualizar(), 0);
        });
        const voltarAoOriginal = () => {
            if (!this.copia) return;
            this.copia = null;
            this.render.atualizar();
        };
        runtime.on('PROJECT_START', voltarAoOriginal);
        runtime.on('PROJECT_STOP_ALL', voltarAoOriginal);
        const passoOriginal = runtime._step.bind(runtime);
        runtime._step = () => {
            // de vez em quando confere se o tileset (fantasias) ou o mapa mudou
            if (++this._quadro % 20 === 0 && this.render.precisaRefazer()) this.render.atualizar();
            passoOriginal();
        };
        this.render.atualizar();
    }

    /** O mapa que vale agora: a cópia mudada pelo jogo, ou o ativo. */
    mapaEmJogo () {
        const ativo = tilemapAtivo();
        if (this.copia && (!ativo || this.copia.nome !== ativo.nome)) this.copia = null;
        return this.copia || ativo;
    }

    temMapa () {
        return Boolean(this.mapaEmJogo());
    }

    /** Bordas do mapa ativo no palco. */
    limites () {
        const m = this.mapaEmJogo();
        if (!m) return null;
        return {l: m.x, r: m.x + (m.colunas * m.tamanho), t: m.y, b: m.y - (m.linhas * m.tamanho)};
    }

    /**
     * Retângulos dos tiles sólidos e plataformas numa área (para a Plataforma 2D).
     * Tiles iguais vizinhos na mesma linha viram um retângulo só.
     */
    solidosNaArea (l, r, b, t) {
        const m = this.mapaEmJogo();
        if (!m) return [];
        const s = m.tamanho;
        const c0 = Math.max(0, Math.floor((l - m.x) / s));
        const c1 = Math.min(m.colunas - 1, Math.floor((r - m.x) / s));
        const l0 = Math.max(0, Math.floor((m.y - t) / s));
        const l1 = Math.min(m.linhas - 1, Math.floor((m.y - b) / s));
        const lista = [];
        for (let lin = l0; lin <= l1; lin++) {
            let atual = null;
            for (let col = c0; col <= c1; col++) {
                const tipo = tipoDoTile(m, lerTile(m, 'principal', col, lin));
                const fisico = tipo === 'solido' || tipo === 'plataforma' ? tipo : null;
                if (atual && atual.tipo === fisico) {
                    atual.r += s;
                    continue;
                }
                if (atual) lista.push(atual);
                atual = fisico ? {
                    id: `tile:${fisico}`, tipo: fisico, dx: 0, dy: 0,
                    l: m.x + (col * s), r: m.x + ((col + 1) * s), t: m.y - (lin * s), b: m.y - ((lin + 1) * s)
                } : null;
            }
            if (atual) lista.push(atual);
        }
        return lista;
    }

    /** Muda um tile durante o jogo (numa cópia do mapa; o original volta quando o projeto para). */
    _mudar (camada, col, lin, valor) {
        const ativo = tilemapAtivo();
        if (!ativo) return;
        if (!this.copia) {
            this.copia = copiarMapa(ativo);
            this.render.mapa = this.copia; // o desenho já é igual: só passa a ler da cópia
        }
        if (escreverTile(this.copia, camada, col, lin, valor)) this.render.redesenharTile(col, lin);
    }

    /** Tiles da camada principal que encostam na caixa do ator. */
    _tilesDoAtor (target, folga = 0) {
        const m = this.mapaEmJogo();
        if (!m || !target || target.isStage || !target.visible) return [];
        const bx = target.getBounds();
        if (!bx) return [];
        const s = m.tamanho;
        const e = 0.01;
        const c0 = Math.max(0, Math.floor((bx.left - folga + e - m.x) / s));
        const c1 = Math.min(m.colunas - 1, Math.floor((bx.right + folga - e - m.x) / s));
        const l0 = Math.max(0, Math.floor((m.y - bx.top - folga + e) / s));
        const l1 = Math.min(m.linhas - 1, Math.floor((m.y - bx.bottom + folga - e) / s));
        const r = [];
        for (let lin = l0; lin <= l1; lin++) {
            for (let col = c0; col <= c1; col++) {
                const n = lerTile(m, 'principal', col, lin);
                if (n) r.push({col, lin, n, tipo: tipoDoTile(m, n)});
            }
        }
        return r;
    }

    _confere (tipo, info) {
        if (tipo === QUALQUER) return true;
        const t = String(tipo).trim()
            .toLowerCase();
        if (/^\d+$/.test(t)) return info.n === Number(t);
        return info.tipo.toLowerCase() === t || (NOMES_TIPOS[info.tipo] || '').toLowerCase() === t;
    }

    /** Tiles da camada principal de um tipo (ou número), linha por linha. */
    _procurar (tipo) {
        const m = this.mapaEmJogo();
        if (!m) return [];
        const r = [];
        for (let lin = 0; lin < m.linhas; lin++) {
            for (let col = 0; col < m.colunas; col++) {
                const n = lerTile(m, 'principal', col, lin);
                if (n && this._confere(tipo, {n, tipo: tipoDoTile(m, n)})) r.push({col, lin, n});
            }
        }
        return r;
    }

    // ---------------------------------------------------------------- blocos
    getInfo () {
        return {
            id: ID_TILEMAP,
            name: 'Tilemaps',
            color1: '#B5651D',
            color2: '#9A5418',
            color3: '#6B3E14',
            menuIconURI: icone,
            blockIconURI: icone,
            blocks: [
                {func: EDITOR_TILEMAP_CALLBACK, blockType: B.BUTTON, text: '🧱 Editor de tilemaps…'},
                {
                    opcode: 'mostrar', blockType: B.COMMAND, text: 'mostrar tilemap [MAPA]',
                    arguments: {MAPA: {type: A.STRING, menu: 'mapas'}}
                },
                {opcode: 'esconder', blockType: B.COMMAND, text: 'esconder tilemap'},
                {opcode: 'atual', blockType: B.REPORTER, text: 'tilemap atual'},
                {
                    opcode: 'moverMapa', blockType: B.COMMAND, text: 'mover tilemap para x: [X] y: [Y]',
                    arguments: {X: {type: A.NUMBER, defaultValue: -240}, Y: {type: A.NUMBER, defaultValue: 180}}
                },
                {
                    opcode: 'borda', blockType: B.REPORTER, text: 'borda [LADO] do tilemap',
                    arguments: {LADO: {type: A.STRING, menu: 'lados', defaultValue: 'direita'}}
                },
                '---',
                {
                    opcode: 'tocando', blockType: B.BOOLEAN, text: 'tocando em tile [TIPO]?',
                    arguments: {TIPO: {type: A.STRING, menu: 'tipos', defaultValue: 'perigo'}}
                },
                {
                    opcode: 'quandoTocar', blockType: B.HAT, isEdgeActivated: true, text: 'quando tocar em tile [TIPO]',
                    arguments: {TIPO: {type: A.STRING, menu: 'tipos', defaultValue: 'moeda'}}
                },
                {
                    opcode: 'pegarTocado', blockType: B.COMMAND, text: 'apagar os tiles [TIPO] que este ator toca',
                    arguments: {TIPO: {type: A.STRING, menu: 'tipos', defaultValue: 'moeda'}}
                },
                {opcode: 'tipoEmbaixo', blockType: B.REPORTER, text: 'tipo do tile embaixo deste ator'},
                '---',
                {
                    opcode: 'tileEm', blockType: B.REPORTER, text: 'tile em x: [X] y: [Y]',
                    arguments: {X: {type: A.NUMBER, defaultValue: 0}, Y: {type: A.NUMBER, defaultValue: 0}}
                },
                {
                    opcode: 'tipoEm', blockType: B.REPORTER, text: 'tipo do tile em x: [X] y: [Y]',
                    arguments: {X: {type: A.NUMBER, defaultValue: 0}, Y: {type: A.NUMBER, defaultValue: 0}}
                },
                {
                    opcode: 'mudarEm', blockType: B.COMMAND, text: 'mudar tile em x: [X] y: [Y] para [N]',
                    arguments: {
                        X: {type: A.NUMBER, defaultValue: 0},
                        Y: {type: A.NUMBER, defaultValue: 0},
                        N: {type: A.NUMBER, defaultValue: 0}
                    }
                },
                {
                    opcode: 'tileNa', blockType: B.REPORTER, text: 'tile na coluna [C] linha [L] da camada [CAMADA]',
                    arguments: {
                        C: {type: A.NUMBER, defaultValue: 1},
                        L: {type: A.NUMBER, defaultValue: 1},
                        CAMADA: {type: A.STRING, menu: 'camadas', defaultValue: 'principal'}
                    }
                },
                {
                    opcode: 'mudarNa', blockType: B.COMMAND,
                    text: 'mudar tile na coluna [C] linha [L] da camada [CAMADA] para [N]',
                    arguments: {
                        C: {type: A.NUMBER, defaultValue: 1},
                        L: {type: A.NUMBER, defaultValue: 1},
                        CAMADA: {type: A.STRING, menu: 'camadas', defaultValue: 'principal'},
                        N: {type: A.NUMBER, defaultValue: 1}
                    }
                },
                {
                    opcode: 'colunaDe', blockType: B.REPORTER, text: 'coluna de x: [X]',
                    arguments: {X: {type: A.NUMBER, defaultValue: 0}}
                },
                {
                    opcode: 'linhaDe', blockType: B.REPORTER, text: 'linha de y: [Y]',
                    arguments: {Y: {type: A.NUMBER, defaultValue: 0}}
                },
                {
                    opcode: 'xDaColuna', blockType: B.REPORTER, text: 'x do centro da coluna [C]',
                    arguments: {C: {type: A.NUMBER, defaultValue: 1}}
                },
                {
                    opcode: 'yDaLinha', blockType: B.REPORTER, text: 'y do centro da linha [L]',
                    arguments: {L: {type: A.NUMBER, defaultValue: 1}}
                },
                '---',
                {
                    opcode: 'quantos', blockType: B.REPORTER, text: 'quantidade de tiles [TIPO]',
                    arguments: {TIPO: {type: A.STRING, menu: 'tipos', defaultValue: 'moeda'}}
                },
                {
                    opcode: 'irPara', blockType: B.COMMAND, text: 'ir para o tile [TIPO] número [N]',
                    arguments: {
                        TIPO: {type: A.STRING, menu: 'tipos', defaultValue: 'inicio'},
                        N: {type: A.NUMBER, defaultValue: 1}
                    }
                },
                {
                    opcode: 'virarClones', blockType: B.COMMAND,
                    text: 'trocar cada tile [TIPO] por um clone deste ator',
                    arguments: {TIPO: {type: A.STRING, menu: 'tipos', defaultValue: 'moeda'}}
                }
            ],
            menus: {
                mapas: {acceptReporters: true, items: 'menuMapas'},
                tipos: {acceptReporters: true, items: 'menuTipos'},
                camadas: {acceptReporters: false, items: [
                    {text: 'principal', value: 'principal'}, {text: 'fundo', value: 'fundo'}]},
                lados: {acceptReporters: false, items: [
                    {text: 'esquerda', value: 'esquerda'}, {text: 'direita', value: 'direita'},
                    {text: 'de cima', value: 'cima'}, {text: 'de baixo', value: 'baixo'}]}
            }
        };
    }

    menuMapas () {
        const nomes = todosTilemaps().map(m => m.nome);
        return nomes.length ? nomes : [{text: '(crie no editor)', value: ''}];
    }

    menuTipos () {
        const tipos = new Set(['solido', 'plataforma', 'perigo', 'moeda', 'escada', 'agua', 'inicio', 'fim']);
        todosTilemaps().forEach(m => Object.values(m.tipos).forEach(t => tipos.add(t)));
        return [{text: 'qualquer', value: QUALQUER}].concat(Array.from(tipos).map(t => ({
            text: (NOMES_TIPOS[t] || t).replace(/ \(.*\)$/, ''), value: t
        })));
    }

    mostrar (args) {
        const m = obterTilemap(String(args.MAPA));
        if (!m) return;
        if (nomeAtivo() === m.nome) return;
        this.copia = null;
        definirAtivo(m.nome);
    }

    esconder () {
        if (!nomeAtivo()) return;
        this.copia = null;
        definirAtivo('');
    }

    atual () {
        return nomeAtivo();
    }

    moverMapa (args) {
        const ativo = tilemapAtivo();
        if (!ativo) return;
        // muda a posição no mapa do jogo; o salvo fica como no editor
        if (!this.copia) this.copia = copiarMapa(ativo);
        this.copia.x = num(args.X);
        this.copia.y = num(args.Y);
        this.render.atualizar();
    }

    borda (args) {
        const lim = this.limites();
        if (!lim) return 0;
        return {esquerda: lim.l, direita: lim.r, cima: lim.t, baixo: lim.b}[args.LADO] || 0;
    }

    tocando (args, util) {
        return this._tilesDoAtor(util.target).some(i => this._confere(args.TIPO, i));
    }

    quandoTocar (args, util) {
        return this.tocando(args, util);
    }

    pegarTocado (args, util) {
        for (const i of this._tilesDoAtor(util.target)) {
            if (this._confere(args.TIPO, i)) this._mudar('principal', i.col, i.lin, 0);
        }
    }

    tipoEmbaixo (args, util) {
        const m = this.mapaEmJogo();
        const t = util.target;
        if (!m || !t || t.isStage) return '';
        const b = t.getBounds();
        if (!b) return '';
        const lin = Math.floor((m.y - (b.bottom - 1)) / m.tamanho);
        // olha embaixo do meio e das pontas dos pés
        for (const x of [(b.left + b.right) / 2, b.left + 1, b.right - 1]) {
            const col = Math.floor((x - m.x) / m.tamanho);
            const n = lerTile(m, 'principal', col, lin);
            if (n) return tipoDoTile(m, n);
        }
        return '';
    }

    tileEm (args) {
        const m = this.mapaEmJogo();
        if (!m) return 0;
        const {col, lin} = celulaDe(m, num(args.X), num(args.Y));
        return lerTile(m, 'principal', col, lin);
    }

    tipoEm (args) {
        const m = this.mapaEmJogo();
        if (!m) return '';
        const {col, lin} = celulaDe(m, num(args.X), num(args.Y));
        const n = lerTile(m, 'principal', col, lin);
        return n ? tipoDoTile(m, n) : '';
    }

    mudarEm (args) {
        const m = this.mapaEmJogo();
        if (!m) return;
        const {col, lin} = celulaDe(m, num(args.X), num(args.Y));
        this._mudar('principal', col, lin, num(args.N));
    }

    tileNa (args) {
        const m = this.mapaEmJogo();
        if (!m) return 0;
        const camada = args.CAMADA === 'fundo' ? 'fundo' : 'principal';
        return lerTile(m, camada, Math.round(num(args.C)) - 1, Math.round(num(args.L)) - 1);
    }

    mudarNa (args) {
        const camada = args.CAMADA === 'fundo' ? 'fundo' : 'principal';
        this._mudar(camada, Math.round(num(args.C)) - 1, Math.round(num(args.L)) - 1, num(args.N));
    }

    colunaDe (args) {
        const m = this.mapaEmJogo();
        return m ? celulaDe(m, num(args.X), 0).col + 1 : 0;
    }

    linhaDe (args) {
        const m = this.mapaEmJogo();
        return m ? celulaDe(m, 0, num(args.Y)).lin + 1 : 0;
    }

    xDaColuna (args) {
        const m = this.mapaEmJogo();
        return m ? centroDe(m, Math.round(num(args.C)) - 1, 0).x : 0;
    }

    yDaLinha (args) {
        const m = this.mapaEmJogo();
        return m ? centroDe(m, 0, Math.round(num(args.L)) - 1).y : 0;
    }

    quantos (args) {
        return this._procurar(args.TIPO).length;
    }

    irPara (args, util) {
        const t = util.target;
        const m = this.mapaEmJogo();
        if (!m || !t || t.isStage) return;
        const i = this._procurar(args.TIPO)[Math.max(1, Math.round(num(args.N, 1))) - 1];
        if (!i) return;
        const c = centroDe(m, i.col, i.lin);
        t.setXY(c.x, c.y);
    }

    virarClones (args, util) {
        const t = util.target;
        const m = this.mapaEmJogo();
        if (!m || !t || t.isStage) return;
        for (const i of this._procurar(args.TIPO)) {
            if (!this.runtime.clonesAvailable()) break;
            const clone = t.makeClone();
            if (!clone) break;
            this.runtime.addTarget(clone);
            const c = centroDe(m, i.col, i.lin);
            clone.setXY(c.x, c.y);
            clone.goBehindOther(t);
            this._mudar('principal', i.col, i.lin, 0);
        }
    }
}

export {AdventiscratchTilemap};
