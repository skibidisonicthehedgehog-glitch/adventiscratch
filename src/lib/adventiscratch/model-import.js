/**
 * Importação de modelos 3D com detecção de texturas.
 *
 * O navegador não consegue ler sozinho os arquivos que ficam "ao lado" do modelo no computador.
 * Por isso o fluxo é:
 *  1. o aluno escolhe o modelo (e, se quiser, as texturas junto) ou a pasta inteira do modelo;
 *  2. o modelo é lido uma vez para descobrir quais arquivos ele pede (texturas, .mtl, .bin);
 *  3. se faltar algo, aparece uma janela listando o que falta, com botões para escolher os arquivos;
 *  4. só os arquivos realmente usados são guardados no projeto (.asp).
 */
import {MODEL_EXTENSIONS, addModel, extOf} from './model-store.js';
import {obterEstado} from './conta/conta.js';
import {abrirCentral} from './conta/telas-nuvem.js';

const RESOURCE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tga', 'mtl', 'bin'];
const MAX_RESOURCE_BYTES = 50 * 1024 * 1024; // ignora arquivos auxiliares gigantes (50 MB)

let enginePromise = null;
const loadParser = () => {
    if (!enginePromise) {
        enginePromise = import(/* webpackChunkName: "adventiscratch-3d" */ './three-engine.js');
    }
    return enginePromise;
};

// ---------------------------------------------------------------- janela (modal)

const STYLE_ID = 'adventiscratch-import-style';
const injectStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
.adv-modal-fundo{position:fixed;inset:0;background:rgba(30,27,58,.55);z-index:10000;display:flex;
  align-items:center;justify-content:center;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif}
.adv-modal{background:#fff;border-radius:16px;width:min(520px,92vw);max-height:86vh;overflow:auto;
  box-shadow:0 20px 50px rgba(0,0,0,.3);color:#1E1B3A}
.adv-modal header{background:#0FA3B1;color:#fff;padding:14px 20px;font-weight:700;font-size:1.05rem;
  border-radius:16px 16px 0 0}
.adv-modal .corpo{padding:18px 20px;font-size:.92rem;line-height:1.5}
.adv-modal ul{list-style:none;margin:10px 0 0;padding:0;max-height:220px;overflow:auto;
  border:1px solid #E5E7EB;border-radius:10px}
.adv-modal li{padding:7px 12px;border-bottom:1px solid #F1F1F4;display:flex;gap:8px;align-items:center;
  word-break:break-all}
.adv-modal li:last-child{border-bottom:0}
.adv-modal .ok{color:#0B8A5A;font-weight:700}
.adv-modal .falta{color:#C2410C;font-weight:700}
.adv-modal footer{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;padding:0 20px 18px}
.adv-modal button{border:0;border-radius:999px;padding:9px 16px;font-weight:700;cursor:pointer;
  font-size:.88rem;background:#EEF2F7;color:#1E1B3A}
.adv-modal button.primario{background:#0FA3B1;color:#fff}
.adv-modal button:hover{filter:brightness(.95)}
.adv-modal li.mat{display:grid;grid-template-columns:1fr 1.3fr;gap:10px}
.adv-modal li.mat select{width:100%;padding:5px 6px;border:1px solid #CBD5E1;border-radius:8px;font-size:.85rem}
.adv-modal .dica{color:#64748B;font-size:.8rem;grid-column:2}
`;
    document.head.appendChild(style);
};

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

/**
 * Mostra uma janela com botões. Botões com `pick` abrem a seleção de arquivos
 * (dentro do clique, como o navegador exige).
 * @param {object} opts {title, html, buttons: [{label, value, primary, pick: {multiple, folder, accept}}]}
 * @returns {Promise<{value: string, files: File[], values: object}>} botão, arquivos e valores dos menus
 */
const showDialog = ({title, html, buttons}) => new Promise(resolve => {
    injectStyle();
    const fundo = document.createElement('div');
    fundo.className = 'adv-modal-fundo';
    fundo.innerHTML = `<div class="adv-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <header>${escapeHtml(title)}</header><div class="corpo">${html}</div><footer></footer></div>`;
    const footer = fundo.querySelector('footer');
    const close = result => {
        const values = {};
        fundo.querySelectorAll('select[data-mat]').forEach(sel => {
            values[sel.dataset.mat] = sel.value;
        });
        fundo.remove();
        resolve({...result, values});
    };
    buttons.forEach(b => {
        const btn = document.createElement('button');
        btn.textContent = b.label;
        if (b.primary) btn.className = 'primario';
        btn.onclick = () => {
            if (!b.pick) return close({value: b.value, files: []});
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = b.pick.multiple !== false;
            if (b.pick.folder) input.webkitdirectory = true;
            if (b.pick.accept) input.accept = b.pick.accept;
            input.onchange = () => close({value: b.value, files: Array.from(input.files || [])});
            input.click();
        };
        footer.appendChild(btn);
    });
    document.body.appendChild(fundo);
    const first = footer.querySelector('button.primario') || footer.querySelector('button');
    if (first) first.focus();
});

const listHtml = (ok, faltando) => `<ul>${
    ok.map(n => `<li><span class="ok">✓</span>${escapeHtml(n)}</li>`).join('')}${
    faltando.map(n => `<li><span class="falta">✗</span>${escapeHtml(n)}</li>`).join('')}</ul>`;

// ---------------------------------------------------------------- arquivos

const isModelFile = f => MODEL_EXTENSIONS.includes(extOf(f.name));
const isResourceFile = f => RESOURCE_EXTENSIONS.includes(extOf(f.name)) && f.size <= MAX_RESOURCE_BYTES;

/**
 * Lê arquivos auxiliares para dentro do "pool" (nome-em-minúsculas -> {name, data}).
 * @param {File[]} files arquivos
 * @param {object} pool destino
 */
const addToPool = async (files, pool) => {
    for (const f of files.filter(isResourceFile)) {
        const key = f.name.toLowerCase();
        if (!pool[key]) pool[key] = {name: f.name, data: await f.arrayBuffer()};
    }
};

const pick = (pool, names) => {
    const out = {};
    names.forEach(n => {
        if (pool[n]) out[n] = pool[n];
    });
    return out;
};

// ---------------------------------------------------------------- texturas por material

const IMAGE_FILE = /\.(png|jpe?g|gif|webp|bmp|tga)$/i;
const SUFFIX = /[_\-. ]?(d|dif|diff|diffuse|alb|albedo|col|color|colour|base|basecolor|basecolour|tex|texture|n|nrm|nor|norm|normal|normals|nml|s|spec|specular|r|rough|roughness|m|metal|metallic|ao|occ|occlusion|e|em|emi|emission|emissive|mask|h|height|disp|bump|op|opacity|alpha)$/;
const NORMAL_HINT = /[_\-. ](n|nrm|nor|norm|normal|normals|nml)$/;
const OTHER_HINT = /[_\-. ](s|spec|specular|r|rough|roughness|m|metal|metallic|ao|occ|occlusion|e|em|emi|emission|emissive|mask|h|height|disp|bump|op|opacity|alpha)$/;
const GENERIC = new Set(['chr', 'mat', 'material', 'tex', 'texture', 'mtl', 'obj', 'mesh', 'model', 'default']);

const stemOf = file => file.replace(/\.[^.]+$/, '').toLowerCase();
const normalizeMat = name => name.toLowerCase().replace(/material/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
const tokens = str => str.split(/[^a-z0-9]+/).filter(t => t.length > 1 && !GENERIC.has(t));

/**
 * Nota de 0 a 100 para "esta imagem parece ser deste material?".
 * @param {string} material nome do material
 * @param {string} file nome da imagem
 * @returns {number} nota
 */
const matchScore = (material, file) => {
    const mat = normalizeMat(material);
    const stem = stemOf(file).replace(/[^a-z0-9]+/g, '_');
    const core = stem.replace(SUFFIX, '');
    if (!mat) return 0;
    if (core === mat || stem === mat) return 100;
    if (mat.length >= 3 && (core.includes(mat) || mat.includes(core))) return 70;
    // palavras em comum, proporcional ao tamanho dos nomes:
    // "chr_sonic_eye" x "chr_sonic_body_nrm" divide só "sonic" (1 de 2) e não passa do mínimo
    const a = tokens(mat);
    const b = new Set(tokens(core));
    const shared = a.filter(t => b.has(t)).length;
    if (!shared) return 0;
    return Math.round(60 * shared / Math.max(a.length, b.size));
};

/**
 * Sugere textura de cor e normal map para cada material, pelo nome dos arquivos.
 * @param {string[]} materials nomes dos materiais
 * @param {string[]} images nomes-em-minúsculas das imagens disponíveis
 * @returns {object} material -> {map, normalMap}
 */
const autoMatch = (materials, images) => {
    const colorImgs = images.filter(f => !NORMAL_HINT.test(stemOf(f)) && !OTHER_HINT.test(stemOf(f)));
    const normalImgs = images.filter(f => NORMAL_HINT.test(stemOf(f)));
    const best = (mat, list) => {
        let top = null;
        let topScore = 39;
        list.forEach(f => {
            const sc = matchScore(mat, f);
            if (sc > topScore) {
                top = f;
                topScore = sc;
            }
        });
        return top;
    };
    const out = {};
    materials.forEach(mat => {
        out[mat] = {map: best(mat, colorImgs), normalMap: best(mat, normalImgs)};
    });
    // um material só e uma imagem de cor só: com certeza é ela
    if (materials.length === 1 && !out[materials[0]].map && colorImgs.length === 1) {
        out[materials[0]].map = colorImgs[0];
    }
    return out;
};

/**
 * Etapa "Texturas por material": para modelos que não dizem quais imagens usam
 * (muito comum em .fbx exportados de jogos), o aluno escolhe a imagem de cada material.
 * @param {string} fileName nome do modelo
 * @param {Array<{name, hasMap}>} materials materiais do modelo
 * @param {object} pool arquivos disponíveis
 * @returns {Promise<object|null>} material -> {map, normalMap}, ou null se pulou
 */
const askMaterialTextures = async (fileName, materials, pool) => {
    const semTextura = materials.filter(m => !m.hasMap).map(m => m.name);
    let chosen = null; // escolhas do aluno (sobrevivem quando ele adiciona mais imagens)
    for (;;) {
        const images = Object.keys(pool).filter(k => IMAGE_FILE.test(k))
            .sort();
        const auto = autoMatch(semTextura, images);
        const current = {};
        semTextura.forEach(mat => {
            current[mat] = chosen && chosen[mat] ? chosen[mat] : (auto[mat].map || '');
        });
        const options = sel => [
            `<option value=""${sel ? '' : ' selected'}>(sem textura)</option>`,
            ...images.map(k => `<option value="${escapeHtml(k)}"${k === sel ? ' selected' : ''}>${
                escapeHtml(pool[k].name)}</option>`)
        ].join('');
        const rows = semTextura.map(mat => {
            const normal = auto[mat].normalMap;
            const dica = normal ? `<span class="dica">+ relevo (normal map): ${escapeHtml(pool[normal].name)}</span>` : '';
            return `<li class="mat"><b>${escapeHtml(mat)}</b><select data-mat="${escapeHtml(mat)}">${
                options(current[mat])}</select>${dica}</li>`;
        }).join('');
        const intro = images.length ?
            'Este modelo não diz quais imagens usa. Escolha a textura de cada material ' +
                '(já tentei adivinhar pelos nomes dos arquivos):' :
            'Este modelo não diz quais imagens usa. Escolha as imagens das texturas (ou a pasta delas) ' +
                'e depois indique qual vai em cada material:';
        const answer = await showDialog({
            title: 'Texturas por material',
            html: `<p><b>${escapeHtml(fileName)}</b>: ${intro}</p><ul>${rows}</ul>`,
            buttons: [
                {label: 'Sem texturas', value: 'pular'},
                {label: 'Escolher pasta…', value: 'arquivos', pick: {folder: true}},
                {
                    label: 'Escolher imagens…',
                    value: 'arquivos',
                    pick: {accept: '.png,.jpg,.jpeg,.gif,.webp,.bmp,.tga'}
                },
                ...(images.length ? [{label: 'Aplicar', value: 'aplicar', primary: true}] : [])
            ]
        });
        if (answer.value === 'pular') return null;
        if (answer.value === 'arquivos') {
            // guarda só o que o aluno escolheu de fato; o resto volta a ser sugerido com as imagens novas
            chosen = {};
            Object.entries(answer.values).forEach(([mat, v]) => {
                if (v) chosen[mat] = v;
            });
            await addToPool(answer.files, pool);
            continue;
        }
        chosen = {...current, ...answer.values};
        const result = {};
        semTextura.forEach(mat => {
            if (chosen[mat]) {
                result[mat] = {map: chosen[mat]};
                if (auto[mat].normalMap) result[mat].normalMap = auto[mat].normalMap;
            }
        });
        return Object.keys(result).length ? result : null;
    }
};

/**
 * Importa um modelo, perguntando pelas texturas que faltarem.
 * @param {File} file arquivo do modelo
 * @param {object} pool arquivos auxiliares já disponíveis
 * @returns {Promise<{name, replaced, used: string[], missing: string[]}|null>} resultado (null se cancelado)
 */
const importOne = async (file, pool) => {
    const {parseModel} = await loadParser();
    const data = await file.arrayBuffer();
    const ext = extOf(file.name);
    let probe;
    for (;;) {
        probe = await parseModel(data, ext, pool);
        if (!probe.missing.length) break;
        const precisa = probe.missing.length === 1 ? 'precisa de 1 arquivo que não foi encontrado' :
            `precisa de ${probe.missing.length} arquivos que não foram encontrados`;
        const answer = await showDialog({
            title: 'Texturas do modelo',
            html: `<p><b>${escapeHtml(file.name)}</b> ${precisa}. ` +
                'Eles normalmente ficam na mesma pasta do modelo (ou numa subpasta como ' +
                '<i>textures</i> ou <i>.fbm</i>).</p>' +
                listHtml(probe.used.map(n => (pool[n] ? pool[n].name : n)), probe.missing) +
                '<p style="margin-top:10px">Escolha os arquivos que faltam, ou a pasta onde eles estão.</p>',
            buttons: [
                {label: 'Continuar sem elas', value: 'pular'},
                {label: 'Escolher pasta…', value: 'arquivos', pick: {folder: true}},
                {
                    label: 'Escolher arquivos…',
                    value: 'arquivos',
                    primary: true,
                    pick: {accept: RESOURCE_EXTENSIONS.map(e => `.${e}`).join(',')}
                }
            ]
        });
        if (answer.value !== 'arquivos' || !answer.files.length) break;
        const before = Object.keys(pool).length;
        await addToPool(answer.files, pool);
        if (Object.keys(pool).length === before) break; // nada novo: evita repetir a janela para sempre
    }
    // materiais sem textura: o modelo não disse quais imagens usa (comum em .fbx de jogos)
    let materialMaps = null;
    const semTextura = probe.materials.filter(m => !m.hasMap);
    const hasImages = Object.keys(pool).some(k => IMAGE_FILE.test(k) && !probe.used.includes(k));
    const nenhumaTextura = probe.materials.length && probe.materials.every(m => !m.hasMap);
    if (semTextura.length && (hasImages || (nenhumaTextura && ['fbx', 'obj', 'dae'].includes(ext)))) {
        materialMaps = await askMaterialTextures(file.name, probe.materials, pool);
        if (materialMaps) {
            probe = await parseModel(data, ext, pool, materialMaps);
        }
    }
    const {name, replaced} = addModel(file.name, data, {
        resources: pick(pool, probe.used),
        missing: probe.missing,
        materialMaps
    });
    return {name, replaced, used: probe.used, missing: probe.missing};
};

/**
 * Importa arquivos escolhidos pelo aluno (modelos + texturas, ou uma pasta inteira).
 * @param {File[]} files arquivos escolhidos
 * @returns {Promise<Array>} resultados
 */
const importFiles = async files => {
    const modelFiles = files.filter(isModelFile);
    if (!modelFiles.length) {
        await showDialog({
            title: 'Nenhum modelo encontrado',
            html: `<p>Não encontrei nenhum modelo 3D nos arquivos escolhidos.</p>
                <p>Formatos aceitos: ${MODEL_EXTENSIONS.map(e => `<b>.${e}</b>`).join(', ')}.</p>`,
            buttons: [{label: 'OK', value: 'ok', primary: true}]
        });
        return [];
    }
    if (modelFiles.length > 10) modelFiles.length = 10; // pasta com muitos modelos: só os 10 primeiros
    const pool = {};
    await addToPool(files, pool);
    const results = [];
    for (const f of modelFiles) {
        try {
            results.push(await importOne(f, pool));
        } catch (e) {
            results.push({error: `${f.name}: ${e.message}`});
        }
    }
    const linhas = results.map(r => {
        if (r.error) return `<li><span class="falta">✗</span>${escapeHtml(r.error)}</li>`;
        const tex = r.used.length ? `${r.used.length} arquivo(s) de textura/material` : 'sem texturas externas';
        const falta = r.missing.length ? `, <span class="falta">${r.missing.length} faltando</span>` : '';
        const acao = r.replaced ? 'atualizado' : 'importado';
        return `<li><span class="ok">✓</span><span><b>${escapeHtml(r.name)}</b> ${acao} (${tex}${falta})</span></li>`;
    });
    const primeiro = results.find(r => !r.error);
    const podePublicar = primeiro && obterEstado().fase === 'ok';
    const fim = await showDialog({
        title: 'Importação concluída',
        html: `<ul>${linhas.join('')}</ul><p style="margin-top:10px">Use o bloco ` +
            '<b>criar modelo … chamado …</b> para colocar o modelo na cena. Tudo fica salvo no arquivo .asp.</p>' +
            (podePublicar ? '<p>Foi você que criou este modelo? Você pode publicá-lo na <b>loja de modelos</b> ' +
                'para todas as turmas usarem.</p>' : ''),
        buttons: [
            ...(podePublicar ? [{label: 'Publicar na loja…', value: 'publicar'}] : []),
            {label: 'OK', value: 'ok', primary: true}
        ]
    });
    if (fim.value === 'publicar') abrirCentral('publicar', primeiro.name);
    return results;
};

/** Botão "Importar modelo 3D…": escolhe o modelo e, opcionalmente, as texturas junto. */
export const importModelFiles = () => new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = [...MODEL_EXTENSIONS, ...RESOURCE_EXTENSIONS].map(e => `.${e}`).join(',');
    input.onchange = () => resolve(importFiles(Array.from(input.files || [])));
    input.click();
});

/** Botão "Importar pasta do modelo…": escolhe a pasta inteira (modelo + texturas). */
export const importModelFolder = () => new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;
    input.onchange = () => resolve(importFiles(Array.from(input.files || [])));
    input.click();
});
