/**
 * Extensão "3D" do Adventiscratch: blocos para Three.js e modelos 3D.
 */
import icone from './icone-3d.svg';
import {
    MODEL_EXTENSIONS, getModel, getModelNames, removeModel, onModelsChanged, extOf
} from './model-store.js';
import {importModelFiles, importModelFolder} from './model-import.js';

const A = {NUMBER: 'number', STRING: 'string', COLOR: 'color'};
const B = {COMMAND: 'command', REPORTER: 'reporter', BOOLEAN: 'Boolean', BUTTON: 'button'};

export const IMPORT_MODEL_CALLBACK = 'ADVENTISCRATCH_IMPORT_MODEL';
export const IMPORT_FOLDER_CALLBACK = 'ADVENTISCRATCH_IMPORT_FOLDER';
export const STORE_CALLBACK = 'ADVENTISCRATCH_MODEL_STORE';

const num = v => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
const round = v => Math.round(v * 1000) / 1000;

let enginePromise = null;
let engine = null;
let currentVm = null;

/** Carrega o Three.js só quando precisa (chunk separado). */
const loadEngine = runtime => {
    if (!enginePromise) {
        enginePromise = import(/* webpackChunkName: "adventiscratch-3d" */ './three-engine.js')
            .then(({Engine}) => {
                engine = new Engine(runtime);
                return engine;
            });
    }
    return enginePromise;
};

/**
 * Executa fn(engine). Se o motor já está pronto, roda na hora (sem esperar um quadro),
 * o que deixa laços com blocos 3D tão rápidos quanto os blocos normais.
 * @param {Runtime} runtime runtime
 * @param {function(Engine): *} fn ação
 * @returns {*} resultado ou Promise
 */
const withEngine = (runtime, fn) => {
    if (engine) return fn(engine);
    return loadEngine(runtime).then(fn);
};

const afterImport = results => {
    if (currentVm && results && results.some(r => r && !r.error)) currentVm.emit('PROJECT_CHANGED');
};

/** Botão "Importar modelo 3D…" da paleta. */
export const importModelFromComputer = () => importModelFiles().then(afterImport);

/** Botão "Importar pasta do modelo…" da paleta. */
export const importModelFromFolder = () => importModelFolder().then(afterImport);

class Adventiscratch3D {
    constructor (runtime) {
        this.runtime = runtime;
    }

    getInfo () {
        const xyz = (x, y, z) => ({
            X: {type: A.NUMBER, defaultValue: x},
            Y: {type: A.NUMBER, defaultValue: y},
            Z: {type: A.NUMBER, defaultValue: z}
        });
        const nome = (padrao = 'cubo1') => ({type: A.STRING, defaultValue: padrao});
        return {
            id: 'adventiscratch3d',
            name: '3D',
            color1: '#0FA3B1',
            color2: '#0B8A96',
            color3: '#08707A',
            menuIconURI: icone,
            blockIconURI: icone,
            blocks: [
                {func: IMPORT_MODEL_CALLBACK, blockType: B.BUTTON, text: 'Importar modelo 3D…'},
                {func: IMPORT_FOLDER_CALLBACK, blockType: B.BUTTON, text: 'Importar pasta do modelo (com texturas)…'},
                {func: STORE_CALLBACK, blockType: B.BUTTON, text: '🧩 Loja de modelos…'},
                '---',
                {opcode: 'ligar', blockType: B.COMMAND, text: 'ligar o 3D'},
                {opcode: 'desligar', blockType: B.COMMAND, text: 'desligar o 3D'},
                {
                    opcode: 'fundo',
                    blockType: B.COMMAND,
                    text: 'mudar fundo do 3D para [COR]',
                    arguments: {COR: {type: A.COLOR, defaultValue: '#87CEEB'}}
                },
                {opcode: 'fundoTransparente', blockType: B.COMMAND, text: 'deixar fundo do 3D transparente'},
                {opcode: 'limpar', blockType: B.COMMAND, text: 'apagar todos os objetos 3D'},
                '---',
                {
                    opcode: 'criarForma',
                    blockType: B.COMMAND,
                    text: 'criar [FORMA] chamado [NOME]',
                    arguments: {FORMA: {type: A.STRING, menu: 'formas', defaultValue: 'cubo'}, NOME: nome()}
                },
                {
                    opcode: 'criarModelo',
                    blockType: B.COMMAND,
                    text: 'criar modelo [MODELO] chamado [NOME]',
                    arguments: {MODELO: {type: A.STRING, menu: 'modelos'}, NOME: nome('modelo1')}
                },
                {
                    opcode: 'criarModeloURL',
                    blockType: B.COMMAND,
                    text: 'criar modelo da internet [URL] chamado [NOME]',
                    arguments: {
                        URL: {type: A.STRING, defaultValue: 'https://exemplo.com/modelo.glb'},
                        NOME: nome('modelo1')
                    }
                },
                {
                    opcode: 'apagar',
                    blockType: B.COMMAND,
                    text: 'apagar objeto [NOME]',
                    arguments: {NOME: nome()}
                },
                '---',
                {
                    opcode: 'moverPara',
                    blockType: B.COMMAND,
                    text: 'mover [NOME] para x: [X] y: [Y] z: [Z]',
                    arguments: {NOME: nome(), ...xyz(0, 0, 0)}
                },
                {
                    opcode: 'mudarEixoPor',
                    blockType: B.COMMAND,
                    text: 'adicionar [N] ao [EIXO] de [NOME]',
                    arguments: {
                        N: {type: A.NUMBER, defaultValue: 0.1},
                        EIXO: {type: A.STRING, menu: 'eixos', defaultValue: 'x'},
                        NOME: nome()
                    }
                },
                {
                    opcode: 'girarPara',
                    blockType: B.COMMAND,
                    text: 'girar [NOME] para x: [X] y: [Y] z: [Z] graus',
                    arguments: {NOME: nome(), ...xyz(0, 45, 0)}
                },
                {
                    opcode: 'girarPor',
                    blockType: B.COMMAND,
                    text: 'girar [NOME] no eixo [EIXO] por [N] graus',
                    arguments: {
                        NOME: nome(),
                        EIXO: {type: A.STRING, menu: 'eixos', defaultValue: 'y'},
                        N: {type: A.NUMBER, defaultValue: 5}
                    }
                },
                {
                    opcode: 'apontarPara',
                    blockType: B.COMMAND,
                    text: 'apontar [NOME] para x: [X] y: [Y] z: [Z]',
                    arguments: {NOME: nome(), ...xyz(0, 0, 0)}
                },
                {
                    opcode: 'tamanho',
                    blockType: B.COMMAND,
                    text: 'mudar tamanho de [NOME] para [N] %',
                    arguments: {NOME: nome(), N: {type: A.NUMBER, defaultValue: 100}}
                },
                {
                    opcode: 'cor',
                    blockType: B.COMMAND,
                    text: 'mudar cor de [NOME] para [COR]',
                    arguments: {NOME: nome(), COR: {type: A.COLOR, defaultValue: '#FF8C1A'}}
                },
                {
                    opcode: 'visibilidade',
                    blockType: B.COMMAND,
                    text: '[ACAO] objeto [NOME]',
                    arguments: {ACAO: {type: A.STRING, menu: 'mostrar', defaultValue: 'mostrar'}, NOME: nome()}
                },
                {
                    opcode: 'propriedade',
                    blockType: B.REPORTER,
                    text: '[PROP] de [NOME]',
                    arguments: {PROP: {type: A.STRING, menu: 'propriedades', defaultValue: 'x'}, NOME: nome()}
                },
                {
                    opcode: 'existe',
                    blockType: B.BOOLEAN,
                    text: 'objeto [NOME] existe?',
                    arguments: {NOME: nome()}
                },
                {
                    opcode: 'tocando',
                    blockType: B.BOOLEAN,
                    text: '[A] tocando [B]?',
                    arguments: {A: nome(), B: nome('cubo2')}
                },
                {
                    opcode: 'distancia',
                    blockType: B.REPORTER,
                    text: 'distância de [A] até [B]',
                    arguments: {A: nome(), B: nome('cubo2')}
                },
                {opcode: 'sobMouse', blockType: B.REPORTER, text: 'objeto 3D sob o mouse'},
                '---',
                {
                    opcode: 'tocarAnimacao',
                    blockType: B.COMMAND,
                    text: 'tocar animação [ANIM] de [NOME]',
                    arguments: {ANIM: {type: A.STRING, defaultValue: '1'}, NOME: nome('modelo1')}
                },
                {
                    opcode: 'pararAnimacoes',
                    blockType: B.COMMAND,
                    text: 'parar animações de [NOME]',
                    arguments: {NOME: nome('modelo1')}
                },
                {
                    opcode: 'animacoes',
                    blockType: B.REPORTER,
                    text: '[INFO] de [NOME]',
                    arguments: {
                        INFO: {type: A.STRING, menu: 'infoAnimacao', defaultValue: 'quantidade'},
                        NOME: nome('modelo1')
                    }
                },
                '---',
                {
                    opcode: 'fisicaTipo',
                    blockType: B.COMMAND,
                    text: 'física de [NOME]: [TIPO]',
                    arguments: {NOME: nome(), TIPO: {type: A.STRING, menu: 'tiposFisica', defaultValue: 'corpo'}}
                },
                {
                    opcode: 'gravidade',
                    blockType: B.COMMAND,
                    text: 'mudar gravidade para [G]',
                    arguments: {G: {type: A.NUMBER, defaultValue: -25}}
                },
                {
                    opcode: 'andarCamera',
                    blockType: B.COMMAND,
                    text: 'andar [NOME] pela câmera: lado [X] frente [Z] velocidade [V]',
                    arguments: {
                        NOME: nome('jogador'),
                        X: {type: A.NUMBER, defaultValue: 0},
                        Z: {type: A.NUMBER, defaultValue: 1},
                        V: {type: A.NUMBER, defaultValue: 8}
                    }
                },
                {
                    opcode: 'andarFrente',
                    blockType: B.COMMAND,
                    text: 'andar [NOME] para frente com velocidade [V]',
                    arguments: {NOME: nome('jogador'), V: {type: A.NUMBER, defaultValue: 5}}
                },
                {
                    opcode: 'pular',
                    blockType: B.COMMAND,
                    text: 'pular [NOME] com força [F]',
                    arguments: {NOME: nome('jogador'), F: {type: A.NUMBER, defaultValue: 10}}
                },
                {
                    opcode: 'noChao',
                    blockType: B.BOOLEAN,
                    text: '[NOME] está no chão?',
                    arguments: {NOME: nome('jogador')}
                },
                {
                    opcode: 'definirVelocidade',
                    blockType: B.COMMAND,
                    text: 'mudar velocidade de [NOME] para x: [X] y: [Y] z: [Z]',
                    arguments: {NOME: nome('jogador'), ...xyz(0, 0, 0)}
                },
                {
                    opcode: 'velocidade',
                    blockType: B.REPORTER,
                    text: 'velocidade [EIXO] de [NOME]',
                    arguments: {EIXO: {type: A.STRING, menu: 'eixosVel', defaultValue: 'y'}, NOME: nome('jogador')}
                },
                {
                    opcode: 'ajusteFrente',
                    blockType: B.COMMAND,
                    text: 'virar o modelo de [NOME] em [N] graus (ajuste de frente)',
                    arguments: {NOME: nome('jogador'), N: {type: A.NUMBER, defaultValue: 180}}
                },
                '---',
                {
                    opcode: 'cameraSeguir',
                    blockType: B.COMMAND,
                    text: 'câmera seguir [NOME] distância [D] altura [H]',
                    arguments: {
                        NOME: nome('jogador'),
                        D: {type: A.NUMBER, defaultValue: 7},
                        H: {type: A.NUMBER, defaultValue: 3}
                    }
                },
                {
                    opcode: 'cameraGirarSeguindo',
                    blockType: B.COMMAND,
                    text: 'girar câmera em volta do jogador por [N] graus',
                    arguments: {N: {type: A.NUMBER, defaultValue: 3}}
                },
                {opcode: 'cameraPararSeguir', blockType: B.COMMAND, text: 'parar de seguir com a câmera'},
                '---',
                {
                    opcode: 'cameraPara',
                    blockType: B.COMMAND,
                    text: 'mover câmera para x: [X] y: [Y] z: [Z]',
                    arguments: xyz(0, 2, 8)
                },
                {
                    opcode: 'cameraEixoPor',
                    blockType: B.COMMAND,
                    text: 'adicionar [N] ao [EIXO] da câmera',
                    arguments: {
                        N: {type: A.NUMBER, defaultValue: 0.1},
                        EIXO: {type: A.STRING, menu: 'eixos', defaultValue: 'z'}
                    }
                },
                {
                    opcode: 'cameraOlhar',
                    blockType: B.COMMAND,
                    text: 'apontar câmera para x: [X] y: [Y] z: [Z]',
                    arguments: xyz(0, 0, 0)
                },
                {
                    opcode: 'cameraOlharObjeto',
                    blockType: B.COMMAND,
                    text: 'apontar câmera para [NOME]',
                    arguments: {NOME: nome()}
                },
                {
                    opcode: 'cameraZoom',
                    blockType: B.COMMAND,
                    text: 'campo de visão da câmera para [N] graus',
                    arguments: {N: {type: A.NUMBER, defaultValue: 60}}
                },
                {
                    opcode: 'cameraProp',
                    blockType: B.REPORTER,
                    text: '[EIXO] da câmera',
                    arguments: {EIXO: {type: A.STRING, menu: 'eixos', defaultValue: 'x'}}
                },
                '---',
                {
                    opcode: 'luz',
                    blockType: B.COMMAND,
                    text: 'intensidade da luz [TIPO] para [N]',
                    arguments: {
                        TIPO: {type: A.STRING, menu: 'luzes', defaultValue: 'sol'},
                        N: {type: A.NUMBER, defaultValue: 1.8}
                    }
                },
                {
                    opcode: 'luzCor',
                    blockType: B.COMMAND,
                    text: 'cor da luz [TIPO] para [COR]',
                    arguments: {
                        TIPO: {type: A.STRING, menu: 'luzes', defaultValue: 'sol'},
                        COR: {type: A.COLOR, defaultValue: '#FFFFFF'}
                    }
                },
                {
                    opcode: 'solPara',
                    blockType: B.COMMAND,
                    text: 'mover sol para x: [X] y: [Y] z: [Z]',
                    arguments: xyz(5, 10, 7)
                },
                '---',
                {
                    opcode: 'removerModelo',
                    blockType: B.COMMAND,
                    text: 'remover modelo importado [MODELO] do projeto',
                    arguments: {MODELO: {type: A.STRING, menu: 'modelos'}}
                },
                {opcode: 'listaModelos', blockType: B.REPORTER, text: 'modelos importados'},
                {opcode: 'quantidadeModelos', blockType: B.REPORTER, text: 'quantidade de modelos importados'},
                {
                    opcode: 'modeloNumero',
                    blockType: B.REPORTER,
                    text: 'modelo importado número [N]',
                    arguments: {N: {type: A.NUMBER, defaultValue: 1}}
                },
                {
                    opcode: 'texturasModelo',
                    blockType: B.REPORTER,
                    text: '[INFO] do modelo [MODELO]',
                    arguments: {
                        INFO: {type: A.STRING, menu: 'infoTexturas', defaultValue: 'texturas'},
                        MODELO: {type: A.STRING, menu: 'modelos'}
                    }
                }
            ],
            menus: {
                formas: {
                    acceptReporters: true,
                    items: [
                        {text: 'cubo', value: 'cubo'},
                        {text: 'esfera', value: 'esfera'},
                        {text: 'cilindro', value: 'cilindro'},
                        {text: 'cone', value: 'cone'},
                        {text: 'plano (chão)', value: 'plano'},
                        {text: 'rosca', value: 'toro'},
                        {text: 'cápsula', value: 'capsula'}
                    ]
                },
                modelos: {acceptReporters: true, items: 'menuModelos'},
                eixos: {acceptReporters: false, items: ['x', 'y', 'z']},
                mostrar: {
                    acceptReporters: false,
                    items: [{text: 'mostrar', value: 'mostrar'}, {text: 'esconder', value: 'esconder'}]
                },
                propriedades: {
                    acceptReporters: false,
                    items: [
                        {text: 'x', value: 'x'},
                        {text: 'y', value: 'y'},
                        {text: 'z', value: 'z'},
                        {text: 'giro x', value: 'rx'},
                        {text: 'giro y', value: 'ry'},
                        {text: 'giro z', value: 'rz'},
                        {text: 'tamanho', value: 'tamanho'}
                    ]
                },
                infoAnimacao: {
                    acceptReporters: false,
                    items: [
                        {text: 'quantidade de animações', value: 'quantidade'},
                        {text: 'nomes das animações', value: 'nomes'}
                    ]
                },
                infoTexturas: {
                    acceptReporters: false,
                    items: [
                        {text: 'texturas', value: 'texturas'},
                        {text: 'texturas faltando', value: 'faltando'}
                    ]
                },
                tiposFisica: {
                    acceptReporters: false,
                    items: [
                        {text: 'corpo (cai e pula)', value: 'corpo'},
                        {text: 'sólido (chão, parede, plataforma)', value: 'solido'},
                        {text: 'terreno (chão com rampas)', value: 'terreno'},
                        {text: 'sem física', value: 'nenhum'}
                    ]
                },
                eixosVel: {
                    acceptReporters: false,
                    items: [
                        {text: 'x', value: 'x'},
                        {text: 'y', value: 'y'},
                        {text: 'z', value: 'z'},
                        {text: 'horizontal (rapidez)', value: 'h'}
                    ]
                },
                luzes: {
                    acceptReporters: false,
                    items: [{text: 'do sol', value: 'sol'}, {text: 'ambiente', value: 'ambiente'}]
                }
            }
        };
    }

    menuModelos () {
        const names = getModelNames();
        if (!names.length) return [{text: '(importe um modelo)', value: ''}];
        return names;
    }

    // ---------- cena ----------
    ligar () {
        return withEngine(this.runtime, e => e.setEnabled(true));
    }
    desligar () {
        if (engine) engine.setEnabled(false);
    }
    fundo ({COR}) {
        return withEngine(this.runtime, e => e.setBackground(COR));
    }
    fundoTransparente () {
        return withEngine(this.runtime, e => e.setTransparent());
    }
    limpar () {
        if (engine) engine.resetScene();
    }

    // ---------- objetos ----------
    criarForma ({FORMA, NOME}) {
        return withEngine(this.runtime, e => {
            e.createShape(String(FORMA), NOME);
            if (!e.enabled) e.setEnabled(true);
        });
    }
    criarModelo ({MODELO, NOME}) {
        const model = getModel(MODELO);
        if (!model) return;
        return withEngine(this.runtime, async e => {
            if (!e.enabled) e.setEnabled(true);
            try {
                await e.createModel(`modelo:${model.name}`, () => Promise.resolve(model), NOME);
            } catch (err) {
                console.warn('Adventiscratch 3D: erro ao abrir o modelo', err); // eslint-disable-line no-console
            }
        });
    }
    criarModeloURL ({URL, NOME}) {
        const url = String(URL).trim();
        const ext = extOf(url.split(/[?#]/)[0]);
        if (!/^https?:\/\//i.test(url) || !MODEL_EXTENSIONS.includes(ext)) return;
        return withEngine(this.runtime, async e => {
            if (!e.enabled) e.setEnabled(true);
            try {
                await e.createModel(`url:${url}`, async () => {
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return {data: await res.arrayBuffer(), ext};
                }, NOME);
            } catch (err) {
                console.warn('Adventiscratch 3D: não consegui baixar o modelo', err); // eslint-disable-line no-console
            }
        });
    }
    apagar ({NOME}) {
        if (engine) engine.remove(NOME);
    }

    _obj (NOME) {
        return engine ? engine.get(NOME) : null;
    }

    moverPara ({NOME, X, Y, Z}) {
        const o = this._obj(NOME);
        if (o) o.position.set(num(X), num(Y), num(Z));
    }
    mudarEixoPor ({N, EIXO, NOME}) {
        const o = this._obj(NOME);
        if (o && 'xyz'.includes(EIXO)) o.position[EIXO] += num(N);
    }
    girarPara ({NOME, X, Y, Z}) {
        const o = this._obj(NOME);
        if (o) o.rotation.set(num(X) * Math.PI / 180, num(Y) * Math.PI / 180, num(Z) * Math.PI / 180);
    }
    girarPor ({NOME, EIXO, N}) {
        const o = this._obj(NOME);
        if (o && 'xyz'.includes(EIXO)) o.rotation[EIXO] += num(N) * Math.PI / 180;
    }
    apontarPara ({NOME, X, Y, Z}) {
        const o = this._obj(NOME);
        if (o) o.lookAt(num(X), num(Y), num(Z));
    }
    tamanho ({NOME, N}) {
        const o = this._obj(NOME);
        if (o) o.scale.setScalar(Math.max(0, num(N)) / 100);
    }
    cor ({NOME, COR}) {
        if (engine) engine.setColor(NOME, COR);
    }
    visibilidade ({ACAO, NOME}) {
        const o = this._obj(NOME);
        if (o) o.visible = ACAO !== 'esconder';
    }
    propriedade ({PROP, NOME}) {
        const o = this._obj(NOME);
        if (!o) return 0;
        switch (PROP) {
        case 'x': return round(o.position.x);
        case 'y': return round(o.position.y);
        case 'z': return round(o.position.z);
        case 'rx': return round(o.rotation.x * 180 / Math.PI);
        case 'ry': return round(o.rotation.y * 180 / Math.PI);
        case 'rz': return round(o.rotation.z * 180 / Math.PI);
        case 'tamanho': return round(o.scale.x * 100);
        default: return 0;
        }
    }
    existe ({NOME}) {
        return !!this._obj(NOME);
    }
    tocando (args) {
        return engine ? engine.touching(args.A, args.B) : false;
    }
    distancia (args) {
        return engine ? round(engine.distance(args.A, args.B)) : 0;
    }
    sobMouse () {
        return engine && engine.enabled ? engine.objectUnderMouse() : '';
    }

    // ---------- animações ----------
    tocarAnimacao ({ANIM, NOME}) {
        if (engine) engine.playAnimation(NOME, ANIM);
    }
    pararAnimacoes ({NOME}) {
        if (engine) engine.stopAnimations(NOME);
    }
    animacoes ({INFO, NOME}) {
        if (!engine) return INFO === 'nomes' ? '' : 0;
        return INFO === 'nomes' ? engine.animationNames(NOME) : engine.animationCount(NOME);
    }

    // ---------- física ----------
    fisicaTipo ({NOME, TIPO}) {
        if (engine) engine.setPhysicsType(NOME, String(TIPO));
    }
    gravidade ({G}) {
        return withEngine(this.runtime, e => {
            e.gravity = num(G);
        });
    }
    andarCamera ({NOME, X, Z, V}) {
        if (engine) engine.walk(NOME, num(X), num(Z), num(V), true);
    }
    andarFrente ({NOME, V}) {
        if (engine) engine.walk(NOME, 0, 1, num(V), false);
    }
    pular ({NOME, F}) {
        if (engine) engine.jump(NOME, num(F));
    }
    noChao ({NOME}) {
        const b = engine && engine.getBody(NOME);
        return !!(b && b.onGround);
    }
    definirVelocidade ({NOME, X, Y, Z}) {
        const b = engine && engine.getBody(NOME);
        if (!b) return;
        b.vel.set(num(X), num(Y), num(Z));
        b.driven = true;
    }
    velocidade ({EIXO, NOME}) {
        const b = engine && engine.getBody(NOME);
        if (!b) return 0;
        if (EIXO === 'h') return round(Math.hypot(b.vel.x, b.vel.z));
        return round(b.vel[EIXO] || 0);
    }
    ajusteFrente ({NOME, N}) {
        if (engine) engine.setFacingOffset(NOME, num(N));
    }
    cameraSeguir ({NOME, D, H}) {
        return withEngine(this.runtime, e => e.setFollow(NOME, num(D), num(H)));
    }
    cameraGirarSeguindo ({N}) {
        if (engine && engine.follow) engine.follow.yaw += num(N) * Math.PI / 180;
    }
    cameraPararSeguir () {
        if (engine) engine.follow = null;
    }

    // ---------- câmera ----------
    cameraPara ({X, Y, Z}) {
        return withEngine(this.runtime, e => e.camera.position.set(num(X), num(Y), num(Z)));
    }
    cameraEixoPor ({N, EIXO}) {
        return withEngine(this.runtime, e => {
            if ('xyz'.includes(EIXO)) e.camera.position[EIXO] += num(N);
        });
    }
    cameraOlhar ({X, Y, Z}) {
        return withEngine(this.runtime, e => e.camera.lookAt(num(X), num(Y), num(Z)));
    }
    cameraOlharObjeto ({NOME}) {
        const o = this._obj(NOME);
        if (o) engine.camera.lookAt(o.position);
    }
    cameraZoom ({N}) {
        return withEngine(this.runtime, e => {
            e.camera.fov = Math.max(1, Math.min(170, num(N)));
            e.camera.updateProjectionMatrix();
        });
    }
    cameraProp ({EIXO}) {
        if (!engine) return {x: 0, y: 2, z: 8}[EIXO] || 0;
        return round(engine.camera.position[EIXO] || 0);
    }

    // ---------- luz ----------
    luz ({TIPO, N}) {
        return withEngine(this.runtime, e => {
            (TIPO === 'ambiente' ? e.ambient : e.sun).intensity = Math.max(0, num(N));
        });
    }
    luzCor ({TIPO, COR}) {
        return withEngine(this.runtime, e => {
            (TIPO === 'ambiente' ? e.ambient : e.sun).color.set(COR);
        });
    }
    solPara ({X, Y, Z}) {
        return withEngine(this.runtime, e => e.sun.position.set(num(X), num(Y), num(Z)));
    }

    // ---------- modelos importados ----------
    removerModelo ({MODELO}) {
        removeModel(MODELO);
        if (engine) engine.templates.delete(`modelo:${MODELO}`);
    }
    listaModelos () {
        return getModelNames().join(', ');
    }
    quantidadeModelos () {
        return getModelNames().length;
    }
    modeloNumero ({N}) {
        const nomes = getModelNames();
        if (!nomes.length) return '';
        const i = Math.round(num(N)) - 1;
        return nomes[((i % nomes.length) + nomes.length) % nomes.length];
    }
    texturasModelo ({INFO, MODELO}) {
        const model = getModel(MODELO);
        if (!model) return '';
        if (INFO === 'faltando') return model.missing.join(', ');
        return Object.values(model.resources).map(r => r.name)
            .join(', ');
    }
}

/** Chamado quando outro projeto é aberto: limpa a cena 3D e o cache. */
export const resetForNewProject = () => {
    if (engine) {
        engine.resetScene();
        engine.forgetTemplates();
        engine.setEnabled(false);
    }
};

/**
 * Liga a extensão à VM (para atualizar o menu de modelos ao importar).
 * @param {VirtualMachine} vm VM do Scratch
 */
export const attach3DToVm = vm => {
    currentVm = vm;
    onModelsChanged(() => {
        // um modelo pode ter sido reimportado com texturas: descarta o cache dos modelos já lidos
        if (engine) engine.forgetTemplates();
        if (vm.extensionManager.isExtensionLoaded('adventiscratch3d')) {
            vm.extensionManager.refreshBlocks();
        }
    });
};

export {Adventiscratch3D};
