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
 * @returns {Promise<{value: string, files: File[]}>} botão clicado e arquivos escolhidos
 */
const showDialog = ({title, html, buttons}) => new Promise(resolve => {
    injectStyle();
    const fundo = document.createElement('div');
    fundo.className = 'adv-modal-fundo';
    fundo.innerHTML = `<div class="adv-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <header>${escapeHtml(title)}</header><div class="corpo">${html}</div><footer></footer></div>`;
    const footer = fundo.querySelector('footer');
    const close = result => {
        fundo.remove();
        resolve(result);
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
    const {name, replaced} = addModel(file.name, data, {
        resources: pick(pool, probe.used),
        missing: probe.missing
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
    await showDialog({
        title: 'Importação concluída',
        html: `<ul>${linhas.join('')}</ul><p style="margin-top:10px">Use o bloco ` +
            '<b>criar modelo … chamado …</b> para colocar o modelo na cena. Tudo fica salvo no arquivo .asp.</p>',
        buttons: [{label: 'OK', value: 'ok', primary: true}]
    });
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
