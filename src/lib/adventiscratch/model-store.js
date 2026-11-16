/**
 * Modelos 3D importados no projeto atual, com seus arquivos auxiliares (texturas, .mtl, .bin).
 * Tudo é salvo dentro do arquivo .asp (pasta "adventiscratch/models/").
 */

export const MODEL_EXTENSIONS = ['glb', 'gltf', 'fbx', 'obj', 'stl', 'dae', 'ply'];

/**
 * Cada modelo:
 * {name, fileName, originalFileName, ext, data: ArrayBuffer,
 *  resources: {nome-em-minúsculas: {name, data: ArrayBuffer}}, missing: string[],
 *  materialMaps: {material: {map, normalMap}} | null}
 */
const models = new Map();
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
 * Adiciona um modelo ao projeto.
 * Se já existir um modelo importado do MESMO arquivo, ele é substituído (útil para reimportar com texturas).
 * Se só o nome coincidir, o novo ganha um número no fim.
 * @param {string} fileName nome original do arquivo
 * @param {ArrayBuffer} data conteúdo
 * @param {object} [options] opções
 * @param {boolean} [options.silent] não avisa os ouvintes (usado ao abrir projeto)
 * @param {object} [options.resources] arquivos auxiliares: nome-em-minúsculas -> {name, data}
 * @param {string[]} [options.missing] arquivos auxiliares que o modelo pede e não foram encontrados
 * @param {object} [options.materialMaps] texturas escolhidas por material (nome -> {map, normalMap})
 * @param {string} [options.name] nome fixo (usado ao abrir projeto)
 * @returns {{name: string, replaced: boolean}} nome final e se substituiu um existente
 */
export const addModel = (fileName, data, options = {}) => {
    const ext = extOf(fileName);
    if (!MODEL_EXTENSIONS.includes(ext)) {
        throw new Error(`Formato não suportado: .${ext}`);
    }
    let name = options.name;
    let replaced = false;
    if (!name) {
        const existing = Array.from(models.values()).find(
            m => m.originalFileName.toLowerCase() === fileName.toLowerCase()
        );
        if (existing) {
            name = existing.name;
            replaced = true;
        } else {
            const base = fileName.replace(/\.[^.]+$/, '').trim() || 'modelo';
            name = base;
            let n = 2;
            while (models.has(name)) name = `${base} ${n++}`;
        }
    }
    models.set(name, {
        name,
        fileName: `${name}.${ext}`,
        originalFileName: fileName,
        ext,
        data,
        resources: options.resources || {},
        missing: options.missing || [],
        materialMaps: options.materialMaps || null
    });
    if (!options.silent) notify();
    return {name, replaced};
};

export const removeModel = name => {
    if (models.delete(String(name))) notify();
};

export const clearModels = silent => {
    models.clear();
    if (!silent) notify();
};
