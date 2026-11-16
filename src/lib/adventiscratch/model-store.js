/**
 * Modelos 3D importados no projeto atual.
 * Eles são salvos dentro do arquivo .asp (pasta "adventiscratch/models/").
 */

export const MODEL_EXTENSIONS = ['glb', 'gltf', 'fbx', 'obj', 'stl', 'dae', 'ply'];

const models = new Map(); // nome -> {name, fileName, ext, data: ArrayBuffer}
const listeners = new Set();

const notify = () => listeners.forEach(fn => fn());

export const onModelsChanged = fn => listeners.add(fn);

export const getModelNames = () => Array.from(models.keys());

export const getModel = name => models.get(String(name)) || null;

export const getAllModels = () => Array.from(models.values());

export const extOf = fileName => {
    const m = /\.([a-z0-9]+)$/i.exec(fileName || '');
    return m ? m[1].toLowerCase() : '';
};

/**
 * Adiciona um modelo ao projeto. Se o nome já existir, ganha um número no fim.
 * @param {string} fileName nome original do arquivo
 * @param {ArrayBuffer} data conteúdo
 * @param {boolean} [silent] não avisa os ouvintes (usado ao abrir projeto)
 * @returns {string} nome final do modelo no projeto
 */
export const addModel = (fileName, data, silent) => {
    const ext = extOf(fileName);
    if (!MODEL_EXTENSIONS.includes(ext)) {
        throw new Error(`Formato não suportado: .${ext}`);
    }
    const base = fileName.replace(/\.[^.]+$/, '').trim() || 'modelo';
    let name = base;
    let n = 2;
    while (models.has(name)) name = `${base} ${n++}`;
    models.set(name, {name, fileName: `${name}.${ext}`, ext, data});
    if (!silent) notify();
    return name;
};

export const removeModel = name => {
    if (models.delete(String(name))) notify();
};

export const clearModels = silent => {
    models.clear();
    if (!silent) notify();
};
