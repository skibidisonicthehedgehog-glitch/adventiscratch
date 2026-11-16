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
import {clone as cloneSkinned} from 'three/examples/jsm/utils/SkeletonUtils.js';

const STAGE_WIDTH = 480;
const STAGE_HEIGHT = 360;
const DEG = Math.PI / 180;

const textDecoder = new TextDecoder();

/**
 * Lê um arquivo de modelo e devolve {object, animations}.
 * @param {ArrayBuffer} data conteúdo do arquivo
 * @param {string} ext extensão em minúsculas (glb, gltf, fbx, obj, stl, dae, ply)
 * @returns {Promise<{object: THREE.Object3D, animations: THREE.AnimationClip[]}>} modelo
 */
const parseModel = (data, ext) => new Promise((resolve, reject) => {
    const defaultMaterial = () => new THREE.MeshStandardMaterial({color: 0xcccccc, roughness: 0.6});
    try {
        switch (ext) {
        case 'glb':
        case 'gltf':
            new GLTFLoader().parse(data, '', gltf => {
                resolve({object: gltf.scene, animations: gltf.animations || []});
            }, reject);
            return;
        case 'fbx': {
            const group = new FBXLoader().parse(data, '');
            resolve({object: group, animations: group.animations || []});
            return;
        }
        case 'obj': {
            const group = new OBJLoader().parse(textDecoder.decode(data));
            group.traverse(child => {
                if (child.isMesh && (!child.material || child.material.type === 'MeshPhongMaterial')) {
                    const color = child.material && child.material.color;
                    child.material = defaultMaterial();
                    if (color) child.material.color.copy(color);
                }
            });
            resolve({object: group, animations: []});
            return;
        }
        case 'stl': {
            const geometry = new STLLoader().parse(data);
            geometry.computeVertexNormals();
            resolve({object: new THREE.Mesh(geometry, defaultMaterial()), animations: []});
            return;
        }
        case 'dae': {
            const collada = new ColladaLoader().parse(textDecoder.decode(data), '');
            resolve({object: collada.scene, animations: collada.scene.animations || []});
            return;
        }
        case 'ply': {
            const geometry = new PLYLoader().parse(data);
            geometry.computeVertexNormals();
            const material = defaultMaterial();
            if (geometry.hasAttribute('color')) material.vertexColors = true;
            resolve({object: new THREE.Mesh(geometry, material), animations: []});
            return;
        }
        default:
            reject(new Error(`Formato de modelo não suportado: .${ext}`));
        }
    } catch (e) {
        reject(e);
    }
});

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
            this.templates.set(key, getFile().then(({data, ext}) => parseModel(data, ext)));
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
