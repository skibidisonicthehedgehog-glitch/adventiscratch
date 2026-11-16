/**
 * Motor 3D do Adventiscratch (Three.js).
 * Este arquivo é carregado sob demanda (chunk separado) na primeira vez que um bloco 3D roda,
 * para não deixar o editor mais lento para quem não usa 3D.
 */
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {OBJLoader} from 'three/examples/jsm/loaders/OBJLoader.js';
import {STLLoader} from 'three/examples/jsm/loaders/STLLoader.js';
import {ColladaLoader} from 'three/examples/jsm/loaders/ColladaLoader.js';
import {PLYLoader} from 'three/examples/jsm/loaders/PLYLoader.js';
import {MTLLoader} from 'three/examples/jsm/loaders/MTLLoader.js';
import {TGALoader} from 'three/examples/jsm/loaders/TGALoader.js';
import {clone as cloneSkinned} from 'three/examples/jsm/utils/SkeletonUtils.js';

const STAGE_WIDTH = 480;
const STAGE_HEIGHT = 360;
const DEG = Math.PI / 180;

const textDecoder = new TextDecoder();

/** Extensões de arquivos auxiliares que um modelo pode usar (texturas, materiais, buffers). */
export const RESOURCE_EXTENSIONS = [
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tga', 'mtl', 'bin'
];

const MIME = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', bmp: 'image/bmp', tga: 'image/x-tga', bin: 'application/octet-stream'
};
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|tga)$/i;
// imagem 1x1 cinza no lugar de uma textura que não foi encontrada (evita erros 404)
const PLACEHOLDER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN89+7dfwAJdwPukgZD8AAAAABJRU5ErkJggg==';

/**
 * Nome do arquivo sem pastas, em minúsculas.
 * Funciona com caminhos de Windows (C:\texturas\a.png), Unix e URLs.
 * @param {string} url caminho ou URL
 * @returns {string} nome base
 */
export const baseName = url => {
    let clean = String(url).split(/[?#]/)[0];
    try {
        clean = decodeURIComponent(clean);
    } catch (e) { /* mantém como está */ }
    return clean.split(/[\\/]/).pop()
        .trim()
        .toLowerCase();
};

/** Igual a baseName, mas mantendo maiúsculas/minúsculas (para mostrar ao aluno). */
const originalName = url => {
    let clean = String(url).split(/[?#]/)[0];
    try {
        clean = decodeURIComponent(clean);
    } catch (e) { /* mantém como está */ }
    return clean.split(/[\\/]/).pop()
        .trim();
};

const extOfName = name => (/\.([a-z0-9]+)$/i.exec(name) || [])[1] || '';

/**
 * Cria um LoadingManager que entrega os arquivos auxiliares (texturas etc.) a partir da memória
 * e anota tudo o que o modelo pediu: o que foi encontrado e o que está faltando.
 * @param {object} resources mapa nome-em-minúsculas -> {name, data: ArrayBuffer}
 * @returns {{manager: THREE.LoadingManager, used: Set<string>, missing: Set<string>, done: Promise}} gerenciador
 */
const createResourceManager = resources => {
    const manager = new THREE.LoadingManager();
    const used = new Set();
    const missing = new Map(); // nome-em-minúsculas -> nome como o modelo escreveu
    const blobUrls = new Map();
    manager.setURLModifier(url => {
        if (/^(data|blob):/i.test(url)) return url;
        const base = baseName(url);
        if (!base) return url;
        const res = resources && resources[base];
        if (!res) {
            missing.set(base, originalName(url));
            return IMAGE_EXT.test(base) ? PLACEHOLDER : url;
        }
        used.add(base);
        if (!blobUrls.has(base)) {
            const blob = new Blob([res.data], {type: MIME[extOfName(base)] || 'application/octet-stream'});
            blobUrls.set(base, URL.createObjectURL(blob));
        }
        return blobUrls.get(base);
    });
    manager.addHandler(/\.tga$/i, new TGALoader(manager));
    // quando todas as texturas terminarem de carregar, libera as URLs temporárias
    let started = false;
    const done = new Promise(resolve => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            setTimeout(() => blobUrls.forEach(u => URL.revokeObjectURL(u)), 1000);
            resolve();
        };
        manager.onStart = () => {
            started = true;
        };
        manager.onLoad = finish;
        manager.onError = () => {}; // erro numa textura não impede o modelo de aparecer
        // se o modelo não pedir nenhum arquivo, onLoad nunca é chamado
        setTimeout(() => {
            if (!started) finish();
        }, 0);
    });
    return {manager, used, missing, done};
};

/**
 * Lê um arquivo de modelo e devolve o objeto 3D, as animações e as texturas usadas/faltando.
 * @param {ArrayBuffer} data conteúdo do arquivo
 * @param {string} ext extensão em minúsculas (glb, gltf, fbx, obj, stl, dae, ply)
 * @param {object} [resources] arquivos auxiliares: nome-em-minúsculas -> {name, data}
 * @returns {Promise<{object, animations, used: string[], missing: string[]}>} modelo
 */
export const parseModel = async (data, ext, resources) => {
    const {manager, used, missing, done} = createResourceManager(resources || {});
    const defaultMaterial = () => new THREE.MeshStandardMaterial({color: 0xcccccc, roughness: 0.6});
    let result;
    switch (ext) {
    case 'glb':
    case 'gltf':
        result = await new Promise((resolve, reject) => {
            new GLTFLoader(manager).parse(data, '', gltf => {
                resolve({object: gltf.scene, animations: gltf.animations || []});
            }, reject);
        });
        break;
    case 'fbx': {
        const group = new FBXLoader(manager).parse(data, '');
        result = {object: group, animations: group.animations || []};
        break;
    }
    case 'obj': {
        const text = textDecoder.decode(data);
        const loader = new OBJLoader(manager);
        let hasMtl = false;
        const mtllib = /^\s*mtllib\s+(.+?)\s*$/m.exec(text);
        if (mtllib) {
            const mtlName = baseName(mtllib[1]);
            const mtl = resources && resources[mtlName];
            if (mtl) {
                used.add(mtlName);
                const materials = new MTLLoader(manager).parse(textDecoder.decode(mtl.data), '');
                materials.preload();
                loader.setMaterials(materials);
                hasMtl = true;
            } else {
                missing.set(mtlName, originalName(mtllib[1]));
            }
        }
        const group = loader.parse(text);
        if (!hasMtl) {
            group.traverse(child => {
                if (child.isMesh) {
                    const color = child.material && child.material.color;
                    child.material = defaultMaterial();
                    if (color) child.material.color.copy(color);
                }
            });
        }
        result = {object: group, animations: []};
        break;
    }
    case 'stl': {
        const geometry = new STLLoader().parse(data);
        geometry.computeVertexNormals();
        result = {object: new THREE.Mesh(geometry, defaultMaterial()), animations: []};
        break;
    }
    case 'dae': {
        const collada = new ColladaLoader(manager).parse(textDecoder.decode(data), '');
        result = {object: collada.scene, animations: collada.scene.animations || []};
        break;
    }
    case 'ply': {
        const geometry = new PLYLoader().parse(data);
        geometry.computeVertexNormals();
        const material = defaultMaterial();
        if (geometry.hasAttribute('color')) material.vertexColors = true;
        result = {object: new THREE.Mesh(geometry, material), animations: []};
        break;
    }
    default:
        throw new Error(`Formato de modelo não suportado: .${ext}`);
    }
    // espera um pouco pelas texturas (o modelo já aparece mesmo se demorarem)
    await Promise.race([done, new Promise(r => setTimeout(r, 3000))]);
    return {...result, used: Array.from(used), missing: Array.from(missing.values())};
};

/**
 * Centraliza o modelo na origem (com a base no chão) e ajusta para caber em ~2 unidades.
 * Assim um modelo em centímetros (comum em .fbx) não aparece gigante.
 * @param {THREE.Object3D} object modelo carregado
 * @returns {THREE.Group} grupo normalizado
 */
const normalize = object => {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z) || 1;
    const scale = 2 / maxSize;
    const center = box.getCenter(new THREE.Vector3());
    object.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
    const inner = new THREE.Group();
    inner.add(object);
    inner.scale.setScalar(scale);
    return inner;
};

class Engine {
    /**
     * @param {Runtime} runtime runtime da VM do Scratch
     */
    constructor (runtime) {
        this.runtime = runtime;
        this.enabled = false;
        this.objects = new Map(); // nome -> {root, mixer, animations}
        this.templates = new Map(); // nome do modelo importado -> Promise<{object, animations}>
        this.clock = new THREE.Clock();

        this.renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: false});
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setClearColor(0x000000, 0);
        const el = this.renderer.domElement;
        el.className = 'adventiscratch-3d';
        el.style.position = 'absolute';
        el.style.pointerEvents = 'none';
        el.style.display = 'none';

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, STAGE_WIDTH / STAGE_HEIGHT, 0.1, 2000);

        this.ambient = new THREE.AmbientLight(0xffffff, 0.8);
        this.sun = new THREE.DirectionalLight(0xffffff, 1.8);
        this.scene.add(this.ambient, this.sun, this.sun.target);

        this.raycaster = new THREE.Raycaster();
        this._lastSize = '';
        this._loop = this._loop.bind(this);
        this.resetScene();
    }

    // ---------- cena ----------

    resetScene () {
        for (const name of Array.from(this.objects.keys())) this.remove(name);
        this.scene.background = null;
        this.renderer.setClearColor(0x000000, 0);
        this.camera.position.set(0, 2, 8);
        this.camera.fov = 60;
        this.camera.updateProjectionMatrix();
        this.camera.lookAt(0, 0, 0);
        this.ambient.intensity = 0.8;
        this.sun.intensity = 1.8;
        this.sun.position.set(5, 10, 7);
    }

    /** Apaga também o cache de modelos (ao abrir outro projeto ou remover um modelo). */
    forgetTemplates () {
        this.templates.clear();
    }

    setEnabled (on) {
        this.enabled = on;
        this.renderer.domElement.style.display = on ? 'block' : 'none';
        if (on) {
            this.clock.getDelta();
            if (!this._raf) this._raf = requestAnimationFrame(this._loop);
        }
    }

    setBackground (hex) {
        this.scene.background = new THREE.Color(hex);
    }

    setTransparent () {
        this.scene.background = null;
    }

    // ---------- loop de desenho ----------

    _attachToStage () {
        const renderer = this.runtime.renderer;
        const stageCanvas = renderer && renderer.canvas;
        if (!stageCanvas || !stageCanvas.parentElement) return false;
        const el = this.renderer.domElement;
        // o palco muda de lugar quando entra/sai da tela cheia: acompanhamos
        if (el.parentElement !== stageCanvas.parentElement || el.previousSibling !== stageCanvas) {
            stageCanvas.parentElement.insertBefore(el, stageCanvas.nextSibling);
        }
        const w = stageCanvas.clientWidth;
        const h = stageCanvas.clientHeight;
        const key = `${w}x${h}x${stageCanvas.offsetLeft}x${stageCanvas.offsetTop}x${window.devicePixelRatio}`;
        if (key !== this._lastSize && w > 0 && h > 0) {
            this._lastSize = key;
            el.style.left = `${stageCanvas.offsetLeft}px`;
            el.style.top = `${stageCanvas.offsetTop}px`;
            el.style.borderRadius = getComputedStyle(stageCanvas).borderRadius;
            this.renderer.setPixelRatio(window.devicePixelRatio || 1);
            this.renderer.setSize(w, h, true);
        }
        return true;
    }

    _loop () {
        this._raf = null;
        if (!this.enabled) return;
        const delta = Math.min(this.clock.getDelta(), 0.1);
        for (const entry of this.objects.values()) {
            if (entry.mixer) entry.mixer.update(delta);
        }
        if (this._attachToStage()) {
            this.renderer.render(this.scene, this.camera);
        }
        this._raf = requestAnimationFrame(this._loop);
    }

    // ---------- objetos ----------

    _put (name, root, animations) {
        this.remove(name);
        root.name = name;
        const entry = {root, animations: animations || [], mixer: null};
        if (entry.animations.length) entry.mixer = new THREE.AnimationMixer(root);
        this.objects.set(name, entry);
        this.scene.add(root);
        return entry;
    }

    get (name) {
        const entry = this.objects.get(String(name));
        return entry ? entry.root : null;
    }

    createShape (shape, name) {
        let geometry;
        switch (shape) {
        case 'esfera': geometry = new THREE.SphereGeometry(1, 48, 32); break;
        case 'cilindro': geometry = new THREE.CylinderGeometry(1, 1, 2, 48); break;
        case 'cone': geometry = new THREE.ConeGeometry(1, 2, 48); break;
        case 'plano':
            geometry = new THREE.PlaneGeometry(10, 10);
            geometry.rotateX(-Math.PI / 2);
            break;
        case 'toro': geometry = new THREE.TorusGeometry(1, 0.35, 24, 64); break;
        case 'capsula': geometry = new THREE.CapsuleGeometry(0.7, 1.2, 8, 24); break;
        default: geometry = new THREE.BoxGeometry(2, 2, 2);
        }
        const material = new THREE.MeshStandardMaterial({color: 0x6D4FC2, roughness: 0.5, metalness: 0.1});
        if (shape === 'plano') material.side = THREE.DoubleSide;
        const mesh = new THREE.Mesh(geometry, material);
        const group = new THREE.Group();
        group.add(mesh);
        this._put(String(name), group);
    }

    /**
     * @param {string} key chave de cache (nome do modelo importado ou URL)
     * @param {function(): Promise<{data: ArrayBuffer, ext: string}>} getFile busca o arquivo
     * @param {string} name nome do objeto na cena
     * @returns {Promise} resolvida quando o modelo aparece na cena
     */
    async createModel (key, getFile, name) {
        if (!this.templates.has(key)) {
            this.templates.set(key, getFile().then(({data, ext, resources}) => parseModel(data, ext, resources)));
        }
        let template;
        try {
            template = await this.templates.get(key);
        } catch (e) {
            this.templates.delete(key);
            throw e;
        }
        const copy = cloneSkinned(template.object);
        copy.traverse(child => {
            if (child.isMesh) {
                // material próprio para cada cópia, para "mudar cor" não afetar as outras
                child.material = Array.isArray(child.material) ?
                    child.material.map(m => m.clone()) : child.material.clone();
            }
        });
        const root = new THREE.Group();
        root.add(normalize(copy));
        this._put(String(name), root, template.animations);
    }

    remove (name) {
        const entry = this.objects.get(String(name));
        if (!entry) return;
        if (entry.mixer) entry.mixer.stopAllAction();
        this.scene.remove(entry.root);
        entry.root.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(m => m && m.dispose());
            }
        });
        this.objects.delete(String(name));
    }

    setColor (name, hex) {
        const obj = this.get(name);
        if (!obj) return;
        obj.traverse(child => {
            if (!child.isMesh) return;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => m && m.color && m.color.set(hex));
        });
    }

    // ---------- animações ----------

    playAnimation (name, which) {
        const entry = this.objects.get(String(name));
        if (!entry || !entry.mixer || !entry.animations.length) return;
        let clip = entry.animations.find(c => c.name === String(which));
        if (!clip) {
            const index = Math.round(Number(which)) - 1;
            clip = entry.animations[Math.max(0, Math.min(entry.animations.length - 1, isNaN(index) ? 0 : index))];
        }
        entry.mixer.stopAllAction();
        entry.mixer.clipAction(clip).reset()
            .play();
    }

    stopAnimations (name) {
        const entry = this.objects.get(String(name));
        if (entry && entry.mixer) entry.mixer.stopAllAction();
    }

    animationCount (name) {
        const entry = this.objects.get(String(name));
        return entry ? entry.animations.length : 0;
    }

    animationNames (name) {
        const entry = this.objects.get(String(name));
        return entry ? entry.animations.map(c => c.name).join(', ') : '';
    }

    // ---------- consultas ----------

    touching (a, b) {
        const objA = this.get(a);
        const objB = this.get(b);
        if (!objA || !objB || objA === objB) return false;
        const boxA = new THREE.Box3().setFromObject(objA);
        const boxB = new THREE.Box3().setFromObject(objB);
        return boxA.intersectsBox(boxB);
    }

    objectUnderMouse () {
        const mouse = this.runtime.ioDevices.mouse;
        const ndc = new THREE.Vector2(
            mouse.getScratchX() / (STAGE_WIDTH / 2),
            mouse.getScratchY() / (STAGE_HEIGHT / 2)
        );
        this.raycaster.setFromCamera(ndc, this.camera);
        const roots = Array.from(this.objects.values()).map(e => e.root)
            .filter(r => r.visible);
        const hits = this.raycaster.intersectObjects(roots, true);
        if (!hits.length) return '';
        let node = hits[0].object;
        while (node && !this.objects.has(node.name)) node = node.parent;
        return node ? node.name : '';
    }

    distance (a, b) {
        const objA = this.get(a);
        const objB = this.get(b);
        if (!objA || !objB) return 0;
        return objA.position.distanceTo(objB.position);
    }
}

export {Engine, DEG};
