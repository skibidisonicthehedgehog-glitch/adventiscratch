/**
 * Extensão "3D" do Adventiscratch: blocos para Three.js e modelos 3D.
 */
import icone from './icone-3d.svg';
import {
    MODEL_EXTENSIONS, addModel, getModel, getModelNames, removeModel, onModelsChanged, extOf
} from './model-store.js';

const A = {NUMBER: 'number', STRING: 'string', COLOR: 'color'};
const B = {COMMAND: 'command', REPORTER: 'reporter', BOOLEAN: 'Boolean', BUTTON: 'button'};

export const IMPORT_MODEL_CALLBACK = 'ADVENTISCRATCH_IMPORT_MODEL';

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

/** Abre a janela de arquivos para importar um modelo 3D (botão da paleta). */
export const importModelFromComputer = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = MODEL_EXTENSIONS.map(e => `.${e}`).join(',');
    input.onchange = async () => {
        const files = Array.from(input.files || []);
        const added = [];
        for (const file of files) {
            try {
                if (extOf(file.name) === 'gltf') {
                    // .gltf costuma depender de arquivos externos (.bin, texturas)
                    // eslint-disable-next-line no-alert
                    alert(`"${file.name}": arquivos .gltf podem precisar de outros arquivos. ` +
                        'Se o modelo não aparecer, use a versão .glb (tudo em um arquivo só).');
                }
                added.push(addModel(file.name, await file.arrayBuffer()));
            } catch (e) {
                // eslint-disable-next-line no-alert
                alert(`Não foi possível importar "${file.name}": ${e.message}`);
            }
        }
        if (added.length && currentVm) {
            currentVm.emit('PROJECT_CHANGED');
            // eslint-disable-next-line no-alert
            alert(`Modelo importado: ${added.join(', ')}\n` +
                'Use o bloco "criar modelo … chamado …" para colocá-lo na cena.');
        }
    };
    input.click();
};

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
                {opcode: 'listaModelos', blockType: B.REPORTER, text: 'modelos importados'}
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
        if (vm.extensionManager.isExtensionLoaded('adventiscratch3d')) {
            vm.extensionManager.refreshBlocks();
        }
    });
};

export {Adventiscratch3D};
