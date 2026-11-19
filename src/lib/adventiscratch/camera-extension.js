/**
 * Extensão "Câmera": move, aproxima (zoom) e gira a visão do palco, segue um ator e treme.
 *
 * Como funciona: as posições dos atores continuam sendo as do "mundo" (x e y normais do Scratch); só o desenho
 * muda. A câmera troca a matriz de projeção do renderizador e, quando está em uso:
 *  - os atores podem sair da área do palco (sem a "cerca" que prende os atores na tela);
 *  - "tocando em ator/cor" funciona em qualquer lugar do mundo (não só dentro do palco);
 *  - cliques e "tocando no ponteiro do mouse" levam a câmera em conta.
 * O cenário pode ficar parado na tela (padrão) ou andar junto com o mundo, e atores podem ser "fixados na tela"
 * (placar, botões, vidas…), sem se mexer com a câmera.
 */

const A = {NUMBER: 'number', STRING: 'string'};
const B = {COMMAND: 'command', REPORTER: 'reporter', BOOLEAN: 'Boolean'};
export const ID_CAMERA = 'adventiscratchcamera';
const MUNDO = 100000; // limites usados nas checagens de toque quando a câmera está em uso

const icone = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
<circle cx="20" cy="20" r="19" fill="#fff"/>
<rect x="7" y="13" width="20" height="15" rx="3" fill="#2D9CDB" stroke="#155C8A" stroke-width="1.6"/>
<path d="M27 17 l7 -4 v14 l-7 -4z" fill="#2D9CDB" stroke="#155C8A" stroke-width="1.6" stroke-linejoin="round"/>
<circle cx="17" cy="20.5" r="4" fill="#fff"/><circle cx="17" cy="20.5" r="2" fill="#155C8A"/>
</svg>`)}`;

const num = (v, p = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : p;
};
const rad = g => g * Math.PI / 180;

class AdventiscratchCamera {
    constructor (runtime) {
        this.runtime = runtime;
        runtime.adventiscratchCamera = this; // acesso pelo console (F12)
        this.usada = false;
        this.resetar();
        runtime.on('PROJECT_START', () => this.resetar());
        runtime.on('PROJECT_LOADED', () => {
            this.resetar();
            this.usada = false;
        });
        this._ligarNoRenderizador();
    }

    resetar () {
        this.x = 0;
        this.y = 0;
        this.zoom = 1;
        this.direcao = 0; // graus, sentido horário
        this.alvo = null; // nome do ator seguido
        this.suavidade = 0;
        this.olhar = [0, 0]; // deslocamento do alvo seguido
        this.limites = null;
        this.tremor = null;
        this.cenarioFixo = true;
        this._tremorAgora = [0, 0];
        if (this.runtime.targets) {
            this.runtime.targets.forEach(t => {
                if (t.sprite) t.sprite.adventiscratchFixo = false;
            });
        }
        this.runtime.requestRedraw();
    }

    _usar () {
        this.usada = true;
        this.runtime.requestRedraw();
    }

    // ---------------------------------------------------------------- contas
    /** Centro da visão agora (com o tremor). */
    _centro () {
        return [this.x + this._tremorAgora[0], this.y + this._tremorAgora[1]];
    }

    /** Mundo -> tela (coordenadas do palco, -240..240). */
    paraTela (x, y) {
        const [cx, cy] = this._centro();
        const a = rad(this.direcao);
        const dx = x - cx;
        const dy = y - cy;
        // a câmera gira no sentido horário, então o mundo aparece girado no anti-horário
        return [
            this.zoom * ((Math.cos(a) * dx) - (Math.sin(a) * dy)),
            this.zoom * ((Math.sin(a) * dx) + (Math.cos(a) * dy))
        ];
    }

    /** Tela -> mundo. */
    paraMundo (x, y) {
        const [cx, cy] = this._centro();
        const a = rad(this.direcao);
        const sx = x / this.zoom;
        const sy = y / this.zoom;
        return [
            cx + (Math.cos(a) * sx) + (Math.sin(a) * sy),
            cy - (Math.sin(a) * sx) + (Math.cos(a) * sy)
        ];
    }

    /** Matriz de projeção (4×4, por colunas) que leva o mundo para o recorte da tela. */
    _matriz () {
        const r = this.runtime.renderer;
        const [w, h] = r.getNativeSize();
        const kx = 2 / w;
        const ky = 2 / h;
        const z = this.zoom;
        const a = rad(this.direcao);
        const c = Math.cos(a);
        const s = Math.sin(a);
        const [cx, cy] = this._centro();
        return new Float32Array([
            kx * z * c, ky * z * s, 0, 0,
            -kx * z * s, ky * z * c, 0, 0,
            0, 0, -1, 0,
            kx * z * ((-c * cx) + (s * cy)), ky * z * ((-s * cx) - (c * cy)), 0, 1
        ]);
    }

    /** Atualiza seguir/limites/tremor (uma vez por quadro, antes de desenhar). */
    _quadro () {
        if (this.alvo) {
            const t = this.runtime.getSpriteTargetByName(this.alvo);
            if (t) {
                const ax = t.x + this.olhar[0];
                const ay = t.y + this.olhar[1];
                const k = 1 - this.suavidade;
                this.x += (ax - this.x) * k;
                this.y += (ay - this.y) * k;
            }
        }
        if (this.limites) {
            // o centro fica dentro dos limites, contando a metade da visão
            const [w, h] = this.runtime.renderer.getNativeSize();
            const mw = w / 2 / this.zoom;
            const mh = h / 2 / this.zoom;
            const {x1, x2, y1, y2} = this.limites;
            this.x = (x2 - x1 <= mw * 2) ? (x1 + x2) / 2 : Math.max(x1 + mw, Math.min(x2 - mw, this.x));
            this.y = (y2 - y1 <= mh * 2) ? (y1 + y2) / 2 : Math.max(y1 + mh, Math.min(y2 - mh, this.y));
        }
        const agora = performance.now();
        if (this.tremor && this.tremor.ate > agora) {
            const resto = (this.tremor.ate - agora) / this.tremor.dur;
            const f = this.tremor.forca * resto;
            this._tremorAgora = [((Math.random() * 2) - 1) * f, ((Math.random() * 2) - 1) * f];
        } else {
            this.tremor = null;
            this._tremorAgora = [0, 0];
        }
    }

    /** Drawables que não andam com a câmera: cenário (se fixo), vídeo da webcam e atores fixados na tela. */
    _fixos () {
        const r = new Set();
        const rt = this.runtime;
        const palco = rt.getTargetForStage && rt.getTargetForStage();
        if (palco && this.cenarioFixo) r.add(palco.drawableID);
        const video = rt.ioDevices && rt.ioDevices.video;
        if (video && typeof video._drawable === 'number') r.add(video._drawable);
        for (const t of rt.targets) {
            if (t.sprite && t.sprite.adventiscratchFixo && !t.isStage) r.add(t.drawableID);
        }
        return r;
    }

    // ---------------------------------------------------------------- renderizador
    _ligarNoRenderizador () {
        const r = this.runtime.renderer;
        if (!r || r.__adventiscratchCamera) return;
        r.__adventiscratchCamera = this;
        const ext = this;

        const desenhar = r.draw.bind(r);
        r.draw = function () {
            if (!ext.usada) return desenhar();
            ext._quadro();
            this._doExitDrawRegion();
            const gl = this._gl;
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
            gl.clearColor(...this._backgroundColor4f);
            gl.clear(gl.COLOR_BUFFER_BIT);
            const fixos = ext._fixos();
            const camera = ext._matriz();
            const telaW = gl.canvas.width;
            const telaH = gl.canvas.height;
            // desenha em lotes, mantendo a ordem das camadas
            let lote = [];
            let loteFixo = null;
            const soltar = () => {
                if (!lote.length) return;
                const z = loteFixo ? 1 : ext.zoom;
                this._drawThese(lote, 'default', loteFixo ? this._projection : camera, {
                    // com zoom, as fantasias vetoriais são desenhadas com mais resolução
                    framebufferWidth: telaW * z,
                    framebufferHeight: telaH * z
                });
                lote = [];
            };
            for (const id of this._drawList) {
                const f = fixos.has(id);
                if (loteFixo !== null && f !== loteFixo) soltar();
                loteFixo = f;
                lote.push(id);
            }
            soltar();
            if (this._snapshotCallbacks.length > 0) {
                const foto = gl.canvas.toDataURL();
                this._snapshotCallbacks.forEach(cb => cb(foto));
                this._snapshotCallbacks = [];
            }
        };

        // sem a "cerca": com a câmera, os atores podem ir para fora da área do palco
        const cercar = r.getFencedPositionOfDrawable.bind(r);
        r.getFencedPositionOfDrawable = (id, pos) => {
            if (!ext.usada) return cercar(id, pos);
            const d = r._allDrawables[id];
            if (d && ext._fixos().has(id)) return cercar(id, pos);
            return [pos[0], pos[1]];
        };

        // "tocando em…" funciona no mundo todo, não só na área do palco
        const limitesToque = r._touchingBounds.bind(r);
        r._touchingBounds = id => {
            if (!ext.usada) return limitesToque(id);
            const salvo = [r._xLeft, r._xRight, r._yBottom, r._yTop];
            r._xLeft = -MUNDO;
            r._xRight = MUNDO;
            r._yBottom = -MUNDO;
            r._yTop = MUNDO;
            try {
                return limitesToque(id);
            } finally {
                [r._xLeft, r._xRight, r._yBottom, r._yTop] = salvo;
            }
        };

        // cliques e ponteiro do mouse: da tela para o mundo
        const paraBordas = r.clientSpaceToScratchBounds.bind(r);
        r.clientSpaceToScratchBounds = (cx, cy, w, h) => {
            const b = paraBordas(cx, cy, w, h);
            if (!ext.usada || ext._semCamera) return b;
            const mx = (b.left + b.right) / 2;
            const my = (b.top + b.bottom) / 2;
            const [wx, wy] = ext.paraMundo(mx, my);
            const hw = Math.max(0, (b.right - b.left) / 2 / ext.zoom);
            const hh = Math.max(0, (b.top - b.bottom) / 2 / ext.zoom);
            b.initFromBounds(Math.round(wx - hw), Math.round(wx + hw), Math.round(wy - hh), Math.round(wy + hh));
            return b;
        };
        const tocandoPonto = r.drawableTouching.bind(r);
        r.drawableTouching = (id, ...resto) => {
            if (!ext.usada || !ext._fixos().has(id)) return tocandoPonto(id, ...resto);
            ext._semCamera = true;
            try {
                return tocandoPonto(id, ...resto);
            } finally {
                ext._semCamera = false;
            }
        };
        const escolher = r.pick.bind(r);
        r.pick = (cx, cy, tw, th, candidatos) => {
            if (!ext.usada) return escolher(cx, cy, tw, th, candidatos);
            const lista = candidatos || r._drawList;
            const fixos = ext._fixos();
            const naTela = lista.filter(id => fixos.has(id));
            const noMundo = lista.filter(id => !fixos.has(id));
            // atores fixados na tela ficam por cima do mundo
            if (naTela.length) {
                ext._semCamera = true;
                let achou;
                try {
                    achou = escolher(cx, cy, tw, th, naTela);
                } finally {
                    ext._semCamera = false;
                }
                const palco = this.runtime.getTargetForStage();
                if (achou !== false && !(palco && achou === palco.drawableID)) return achou;
            }
            return escolher(cx, cy, tw, th, noMundo.length ? noMundo : lista);
        };
    }

    // ---------------------------------------------------------------- blocos
    getInfo () {
        return {
            id: ID_CAMERA,
            name: 'Câmera',
            color1: '#2D9CDB',
            color2: '#2183BC',
            color3: '#155C8A',
            menuIconURI: icone,
            blockIconURI: icone,
            blocks: [
                {
                    opcode: 'irPara', blockType: B.COMMAND, text: 'mover câmera para x: [X] y: [Y]',
                    arguments: {X: {type: A.NUMBER, defaultValue: 0}, Y: {type: A.NUMBER, defaultValue: 0}}
                },
                {
                    opcode: 'irParaAtor', blockType: B.COMMAND, text: 'mover câmera para [ATOR]',
                    arguments: {ATOR: {type: A.STRING, menu: 'atores'}}
                },
                {
                    opcode: 'mudarX', blockType: B.COMMAND, text: 'mudar x da câmera por [N]',
                    arguments: {N: {type: A.NUMBER, defaultValue: 10}}
                },
                {
                    opcode: 'mudarY', blockType: B.COMMAND, text: 'mudar y da câmera por [N]',
                    arguments: {N: {type: A.NUMBER, defaultValue: 10}}
                },
                {
                    opcode: 'definirX', blockType: B.COMMAND, text: 'definir x da câmera para [N]',
                    arguments: {N: {type: A.NUMBER, defaultValue: 0}}
                },
                {
                    opcode: 'definirY', blockType: B.COMMAND, text: 'definir y da câmera para [N]',
                    arguments: {N: {type: A.NUMBER, defaultValue: 0}}
                },
                '---',
                {
                    opcode: 'seguir', blockType: B.COMMAND, text: 'câmera seguir [ATOR] com suavidade [S] %',
                    arguments: {ATOR: {type: A.STRING, menu: 'atoresSeguir'}, S: {type: A.NUMBER, defaultValue: 80}}
                },
                {
                    opcode: 'desvio', blockType: B.COMMAND, text: 'olhar à frente do ator seguido x: [X] y: [Y]',
                    arguments: {X: {type: A.NUMBER, defaultValue: 0}, Y: {type: A.NUMBER, defaultValue: 40}}
                },
                {opcode: 'pararSeguir', blockType: B.COMMAND, text: 'câmera parar de seguir'},
                {
                    opcode: 'limitar', blockType: B.COMMAND,
                    text: 'limitar a câmera entre x: [X1] e [X2] y: [Y1] e [Y2]',
                    arguments: {
                        X1: {type: A.NUMBER, defaultValue: -240},
                        X2: {type: A.NUMBER, defaultValue: 1200},
                        Y1: {type: A.NUMBER, defaultValue: -180},
                        Y2: {type: A.NUMBER, defaultValue: 180}
                    }
                },
                {opcode: 'semLimites', blockType: B.COMMAND, text: 'tirar os limites da câmera'},
                '---',
                {
                    opcode: 'definirZoom', blockType: B.COMMAND, text: 'definir zoom da câmera para [Z] %',
                    arguments: {Z: {type: A.NUMBER, defaultValue: 150}}
                },
                {
                    opcode: 'mudarZoom', blockType: B.COMMAND, text: 'mudar zoom da câmera por [Z] %',
                    arguments: {Z: {type: A.NUMBER, defaultValue: 10}}
                },
                {
                    opcode: 'girarPara', blockType: B.COMMAND, text: 'girar câmera para [G] graus',
                    arguments: {G: {type: A.NUMBER, defaultValue: 0}}
                },
                {
                    opcode: 'girar', blockType: B.COMMAND, text: 'girar câmera [G] graus',
                    arguments: {G: {type: A.NUMBER, defaultValue: 15}}
                },
                {
                    opcode: 'tremer', blockType: B.COMMAND, text: 'tremer câmera com força [F] por [T] segundos',
                    arguments: {F: {type: A.NUMBER, defaultValue: 8}, T: {type: A.NUMBER, defaultValue: 0.4}}
                },
                {opcode: 'resetarCamera', blockType: B.COMMAND, text: 'voltar câmera ao normal'},
                '---',
                {
                    opcode: 'fixarAtor', blockType: B.COMMAND, text: 'fixar este ator na tela: [SIM]',
                    arguments: {SIM: {type: A.STRING, menu: 'simNao', defaultValue: 'sim'}}
                },
                {
                    opcode: 'cenario', blockType: B.COMMAND, text: 'cenário anda com a câmera: [SIM]',
                    arguments: {SIM: {type: A.STRING, menu: 'simNao', defaultValue: 'nao'}}
                },
                '---',
                {opcode: 'xCamera', blockType: B.REPORTER, text: 'x da câmera'},
                {opcode: 'yCamera', blockType: B.REPORTER, text: 'y da câmera'},
                {opcode: 'zoomCamera', blockType: B.REPORTER, text: 'zoom da câmera (%)'},
                {opcode: 'direcaoCamera', blockType: B.REPORTER, text: 'direção da câmera'},
                {opcode: 'mouseX', blockType: B.REPORTER, text: 'x do mouse no mundo'},
                {opcode: 'mouseY', blockType: B.REPORTER, text: 'y do mouse no mundo'},
                {
                    opcode: 'naTela', blockType: B.BOOLEAN, text: '[ATOR] aparece na câmera?',
                    arguments: {ATOR: {type: A.STRING, menu: 'atoresEu'}}
                }
            ],
            menus: {
                atores: {acceptReporters: true, items: 'menuAtores'},
                atoresSeguir: {acceptReporters: true, items: 'menuAtoresSeguir'},
                atoresEu: {acceptReporters: true, items: 'menuAtoresEu'},
                simNao: {acceptReporters: false, items: [{text: 'sim', value: 'sim'}, {text: 'não', value: 'nao'}]}
            }
        };
    }

    _nomes () {
        return this.runtime.targets.filter(t => t.isOriginal && !t.isStage).map(t => t.getName());
    }

    menuAtores () {
        const n = this._nomes();
        return n.length ? n : [{text: '(nenhum ator)', value: ''}];
    }

    menuAtoresSeguir () {
        return [{text: 'este ator', value: '_eu_'}].concat(this._nomes());
    }

    menuAtoresEu () {
        return [{text: 'este ator', value: '_eu_'}].concat(this._nomes());
    }

    _alvo (nome, util) {
        if (nome === '_eu_') return util && util.target && !util.target.isStage ? util.target : null;
        return this.runtime.getSpriteTargetByName(String(nome));
    }

    irPara (args) {
        this._usar();
        this.alvo = null;
        this.x = num(args.X);
        this.y = num(args.Y);
    }

    irParaAtor (args, util) {
        const t = this._alvo(args.ATOR, util);
        if (!t) return;
        this._usar();
        this.alvo = null;
        this.x = t.x;
        this.y = t.y;
    }

    mudarX (args) {
        this._usar();
        this.x += num(args.N);
    }

    mudarY (args) {
        this._usar();
        this.y += num(args.N);
    }

    definirX (args) {
        this._usar();
        this.x = num(args.N);
    }

    definirY (args) {
        this._usar();
        this.y = num(args.N);
    }

    seguir (args, util) {
        const t = this._alvo(args.ATOR, util);
        if (!t) return;
        this._usar();
        // segue o ator original (os clones têm o mesmo nome; o seguido é o original)
        this.alvo = t.getName();
        this.suavidade = Math.max(0, Math.min(0.98, num(args.S, 80) / 100));
        if (this.suavidade === 0) {
            this.x = t.x + this.olhar[0];
            this.y = t.y + this.olhar[1];
        }
    }

    desvio (args) {
        this.olhar = [num(args.X), num(args.Y)];
    }

    pararSeguir () {
        this.alvo = null;
    }

    limitar (args) {
        this._usar();
        const x1 = num(args.X1);
        const x2 = num(args.X2);
        const y1 = num(args.Y1);
        const y2 = num(args.Y2);
        this.limites = {x1: Math.min(x1, x2), x2: Math.max(x1, x2), y1: Math.min(y1, y2), y2: Math.max(y1, y2)};
    }

    semLimites () {
        this.limites = null;
    }

    definirZoom (args) {
        this._usar();
        this.zoom = Math.max(0.05, Math.min(20, num(args.Z, 100) / 100));
    }

    mudarZoom (args) {
        this._usar();
        this.zoom = Math.max(0.05, Math.min(20, this.zoom + (num(args.Z) / 100)));
    }

    girarPara (args) {
        this._usar();
        this.direcao = num(args.G) % 360;
    }

    girar (args) {
        this._usar();
        this.direcao = (this.direcao + num(args.G)) % 360;
    }

    tremer (args) {
        this._usar();
        const dur = Math.max(0, Math.min(10, num(args.T, 0.4))) * 1000;
        if (!dur) return;
        this.tremor = {forca: Math.max(0, Math.min(200, num(args.F, 8))), dur, ate: performance.now() + dur};
    }

    resetarCamera () {
        const fixos = this.runtime.targets.filter(t => t.sprite && t.sprite.adventiscratchFixo);
        this.resetar();
        // continua "em uso" (os atores podem estar fora do palco), mas na posição normal
        fixos.forEach(t => {
            t.sprite.adventiscratchFixo = true;
        });
    }

    fixarAtor (args, util) {
        if (!util.target || util.target.isStage) return;
        this._usar();
        util.target.sprite.adventiscratchFixo = args.SIM !== 'nao';
    }

    cenario (args) {
        this._usar();
        this.cenarioFixo = args.SIM === 'nao';
    }

    xCamera () {
        return Math.round(this.x * 100) / 100;
    }

    yCamera () {
        return Math.round(this.y * 100) / 100;
    }

    zoomCamera () {
        return Math.round(this.zoom * 1000) / 10;
    }

    direcaoCamera () {
        return this.direcao;
    }

    _mouseMundo () {
        const m = this.runtime.ioDevices.mouse;
        return this.paraMundo(m.getScratchX(), m.getScratchY());
    }

    mouseX () {
        return Math.round(this._mouseMundo()[0] * 100) / 100;
    }

    mouseY () {
        return Math.round(this._mouseMundo()[1] * 100) / 100;
    }

    naTela (args, util) {
        const t = this._alvo(args.ATOR, util);
        if (!t || !t.visible) return false;
        const b = this.runtime.renderer.getBounds(t.drawableID);
        if (!b) return false;
        const [w, h] = this.runtime.renderer.getNativeSize();
        if (t.sprite.adventiscratchFixo) return b.right > -w / 2 && b.left < w / 2 && b.top > -h / 2 && b.bottom < h / 2;
        const cantos = [[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]]
            .map(([x, y]) => this.paraTela(x, y));
        const xs = cantos.map(c => c[0]);
        const ys = cantos.map(c => c[1]);
        return Math.max(...xs) > -w / 2 && Math.min(...xs) < w / 2 && Math.max(...ys) > -h / 2 && Math.min(...ys) < h / 2;
    }
}

export {AdventiscratchCamera};
