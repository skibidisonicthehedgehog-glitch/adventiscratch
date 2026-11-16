/**
 * Instrumentos .sf2 do projeto atual (já extraídos: só o preset escolhido, com as amostras dele).
 * Ficam no .asp em adventiscratch/instrumentos/<n>.json + <n>.pcm.
 * Também tem a janela "Escolha o instrumento" usada ao importar um .sf2 ou ao pegar um da loja.
 */
import {lerSF2, extrairPreset, tocarSF2} from './soundfont.js';
import {registrarInstrumentoExterno} from './sintetizador.js';

const instrumentos = new Map(); // id ("sf2:nome") -> {id, nome, info, pcm}
const ouvintes = new Set();
let vmAtual = null;

const avisar = () => ouvintes.forEach(fn => fn());

/** @returns {function} função que para de ouvir */
export const aoMudarInstrumentosExtras = fn => {
    ouvintes.add(fn);
    return () => ouvintes.delete(fn);
};

export const instrumentosExtras = () => Array.from(instrumentos.values());
export const obterInstrumentoExtra = id => instrumentos.get(id) || null;

export const adicionarInstrumento = (info, pcm, {silencioso, id} = {}) => {
    let novoId = id;
    if (!novoId) {
        const base = `sf2:${info.nome}`;
        novoId = base;
        let i = 2;
        while (instrumentos.has(novoId)) novoId = `${base} ${i++}`;
    }
    instrumentos.set(novoId, {id: novoId, nome: novoId.slice(4), info, pcm});
    if (!silencioso) {
        avisar();
        if (vmAtual) vmAtual.emit('PROJECT_CHANGED');
    }
    return novoId;
};

export const limparInstrumentos = silencioso => {
    instrumentos.clear();
    if (!silencioso) avisar();
};

registrarInstrumentoExterno((ctx, destino, id, n, t, dur, vol) => {
    const inst = instrumentos.get(id);
    return inst ? tocarSF2(ctx, destino, inst, n, t, dur, vol) : null;
});

// ---------------------------------------------------------------- janela "Escolha o instrumento"

const CSS = `
.adv-sf2{position:fixed;inset:0;z-index:21000;background:rgba(15,8,40,.7);display:flex;align-items:center;justify-content:center;
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif}
.adv-sf2 .caixa{background:#fff;color:#1B1338;border-radius:18px;width:min(560px,94vw);max-height:86vh;display:flex;flex-direction:column;
  box-shadow:0 20px 60px rgba(0,0,0,.4);overflow:hidden}
.adv-sf2 header{background:linear-gradient(90deg,#6D4FC2,#C24BCF);color:#fff;padding:14px 18px}
.adv-sf2 header h3{margin:0;font-size:18px}
.adv-sf2 header p{margin:4px 0 0;font-size:13px;opacity:.9}
.adv-sf2 input[type=search]{margin:12px 18px 6px;padding:8px 12px;border-radius:10px;border:2px solid #E3DAFF;font:inherit}
.adv-sf2 ul{list-style:none;margin:0;padding:0 10px 10px;overflow:auto;flex:1}
.adv-sf2 li{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px}
.adv-sf2 li:nth-child(odd){background:#F6F2FF}
.adv-sf2 li .n{flex:1;font-weight:600}
.adv-sf2 li small{color:#6B5FA0;font-weight:400}
.adv-sf2 button{font:inherit;font-weight:700;border:0;border-radius:9px;padding:6px 12px;cursor:pointer;background:#E3DAFF;color:#3A2C70}
.adv-sf2 button.usar{background:#6D4FC2;color:#fff}
.adv-sf2 footer{padding:10px 18px;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center;font-size:13px}
.adv-sf2 .erro{color:#B91C1C;padding:0 18px}
`;

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

/**
 * Mostra os instrumentos de um .sf2 para o aluno escolher. Devolve o id do instrumento adicionado (ou null).
 * @param {ArrayBuffer} buf conteúdo do .sf2
 * @param {string} nomeArquivo nome do arquivo (só para mostrar)
 * @returns {Promise<string|null>} id do instrumento no projeto
 */
export const escolherPresetDoSF2 = (buf, nomeArquivo) => new Promise((resolve, reject) => {
    let sf;
    try {
        sf = lerSF2(buf);
    } catch (e) {
        reject(e);
        return;
    }
    if (!document.getElementById('adv-sf2-css')) {
        const st = document.createElement('style');
        st.id = 'adv-sf2-css';
        st.textContent = CSS;
        document.head.appendChild(st);
    }
    const tela = document.createElement('div');
    tela.className = 'adv-sf2';
    tela.innerHTML = `<div class="caixa" role="dialog" aria-label="Escolha o instrumento">
      <header><h3>🎚️ Escolha o instrumento</h3>
        <p>${esc(nomeArquivo)} tem ${sf.presets.length} instrumento(s). Só o escolhido vai para o seu projeto.</p></header>
      ${sf.presets.length > 8 ? '<input type="search" placeholder="Buscar (ex.: piano, violão, flauta)…">' : ''}
      <div class="erro"></div>
      <ul></ul>
      <footer><span>${esc(sf.nome)}</span><button class="cancelar">Cancelar</button></footer></div>`;
    document.body.appendChild(tela);
    tela.addEventListener('keydown', e => e.stopPropagation());
    const ul = tela.querySelector('ul');
    const erroEl = tela.querySelector('.erro');
    const cache = new Map();
    const extrair = p => {
        if (!cache.has(p.indice)) cache.set(p.indice, extrairPreset(sf, p));
        return cache.get(p.indice);
    };
    const fechar = valor => {
        tela.remove();
        resolve(valor);
    };
    const desenhar = filtro => {
        ul.innerHTML = '';
        sf.presets.filter(p => !filtro || p.nome.toLowerCase().includes(filtro)).slice(0, 300).forEach(p => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="n">${esc(p.nome)} <small>banco ${p.banco} · nº ${p.programa}</small></span>
              <button class="ouvir" title="Ouvir">▶ Ouvir</button><button class="usar">Usar este</button>`;
            li.querySelector('.ouvir').onclick = () => {
                erroEl.textContent = '';
                try {
                    const inst = extrair(p);
                    const audio = vmAtual && vmAtual.runtime.audioEngine;
                    const ctx = audio ? audio.audioContext : null;
                    if (!ctx) return;
                    if (ctx.state === 'suspended') ctx.resume();
                    const t = ctx.currentTime + 0.05;
                    [60, 64, 67, 72].forEach((n, i) => tocarSF2(ctx, audio.inputNode, {info: inst.info, pcm: inst.pcm}, n,
                        t + (i * 0.22), 0.35, 0.9));
                } catch (e) {
                    erroEl.textContent = e.message;
                }
            };
            li.querySelector('.usar').onclick = () => {
                try {
                    const inst = extrair(p);
                    fechar(adicionarInstrumento(inst.info, inst.pcm));
                } catch (e) {
                    erroEl.textContent = e.message;
                }
            };
            ul.appendChild(li);
        });
    };
    const busca = tela.querySelector('input[type=search]');
    if (busca) {
        busca.addEventListener('input', () => desenhar(busca.value.trim().toLowerCase()));
        setTimeout(() => busca.focus(), 50);
    }
    tela.querySelector('.cancelar').onclick = () => fechar(null);
    tela.addEventListener('mousedown', e => {
        if (e.target === tela) fechar(null);
    });
    desenhar('');
});

/** Abre o seletor de arquivos para importar um .sf2 do computador. */
export const importarSF2DoComputador = () => new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.sf2';
    input.onchange = async () => {
        const arquivo = input.files && input.files[0];
        if (!arquivo) {
            resolve(null);
            return;
        }
        try {
            resolve(await escolherPresetDoSF2(await arquivo.arrayBuffer(), arquivo.name));
        } catch (e) {
            reject(e);
        }
    };
    input.click();
});

export const iniciarInstrumentos = vm => {
    vmAtual = vm;
    window.addEventListener('adventiscratch-importar-sf2', ev => {
        importarSF2DoComputador().then(id => {
            if (id && ev.detail && ev.detail.aoEscolher) ev.detail.aoEscolher(id);
        }).catch(e => {
            window.alert(`Não deu para importar o .sf2: ${e.message}`); // eslint-disable-line no-alert
        });
    });
};
