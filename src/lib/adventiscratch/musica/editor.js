/**
 * Criador de Músicas: tela cheia com grade de piano (Melodia, Baixo, Acordes) e grade de bateria.
 *
 * Ferramentas:
 *  - ✏️ Desenhar (B): clique põe nota, clique numa nota tira, arraste a nota para mover, puxe a ponta para alongar.
 *  - ⬚ Selecionar (V): arraste para fazer uma caixa de seleção; arraste notas selecionadas para mover.
 *  - Shift+arrastar faz caixa em qualquer ferramenta; Ctrl+clique liga/desliga uma nota na seleção.
 * Atalhos: Ctrl+C/X/V copiar/recortar/colar, Ctrl+D duplicar, Ctrl+A tudo, Delete apaga, Ctrl+Z/Ctrl+Y desfazer/
 * refazer, setas movem (← → passo, Shift = batida; ↑ ↓ meio tom, Shift = oitava), Esc limpa a seleção.
 * O "colar" põe as notas no marcador amarelo (clique na régua ou num lugar vazio da grade para mudar).
 */
import {
    PASSOS_POR_BATIDA, PASSOS_POR_COMPASSO, LINHAS_BATERIA, NOMES_BATERIA,
    nomesMusicas, obterMusica, copiarMusica, gravarMusica, apagarMusica, nomeLivre, totalPassos
} from './dados.js';
import {INSTRUMENTOS, Tocador, tocarNota, tocarBateria, nomeNota} from './sintetizador.js';
import {MODELOS} from './modelos.js';
import {instrumentosExtras, aoMudarInstrumentosExtras} from './soundfont-store.js';

const NOTA_MAX = 96; // Dó7
const NOTA_MIN = 36; // Dó2
const LINHAS = NOTA_MAX - NOTA_MIN + 1;
const TECLADO = 64;
const REGUA = 26;
const CEL = 24; // largura de um passo
const ALT = 16; // altura de uma linha do piano
const ALT_BAT = 40;
const PONTA = 7; // pixels na ponta direita da nota que servem para alongar
const MAX_HISTORICO = 100;
const PRETAS = new Set([1, 3, 6, 8, 10]);
const CORES = {melodia: '#B48CFF', baixo: '#FF9F5A', acordes: '#5BD1C9', bateria: '#FFC928'};
const DURACOES = [
    {d: 1, txt: '𝅘𝅥𝅯 1/16'}, {d: 2, txt: '♪ 1/8'}, {d: 4, txt: '♩ 1/4'}, {d: 8, txt: '𝅗𝅥 1/2'}, {d: 16, txt: '𝅝 inteira'}
];

const CSS = `
.adv-mus{position:fixed;inset:0;z-index:15000;background:#17112E;color:#fff;display:flex;flex-direction:column;
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:14px}
.adv-mus-topo{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 14px;background:linear-gradient(90deg,#6D4FC2,#C24BCF)}
.adv-mus-topo h2{margin:0 8px 0 0;font-size:19px;white-space:nowrap}
.adv-mus input,.adv-mus select{font:inherit;border-radius:8px;border:0;padding:6px 8px;background:#fff;color:#1B1338}
.adv-mus input[type=range]{padding:0;background:transparent}
.adv-mus button{font:inherit;font-weight:700;border:0;border-radius:9px;padding:7px 12px;cursor:pointer;
  background:rgba(255,255,255,.18);color:#fff}
.adv-mus button:hover{background:rgba(255,255,255,.3)}
.adv-mus button:disabled{opacity:.35;cursor:default;background:rgba(255,255,255,.12)}
.adv-mus button.ativo{background:#FFC928;color:#1B1338}
.adv-mus button.salvar{background:#5BBF4A}
.adv-mus button.perigo{background:rgba(255,90,90,.35)}
.adv-mus label{display:flex;align-items:center;gap:5px;white-space:nowrap}
.adv-mus .esp{flex:1}
.adv-mus-abas{display:flex;gap:4px;padding:8px 14px 0;background:#221A45}
.adv-mus-abas button{border-radius:10px 10px 0 0;background:#2E2560;padding:9px 16px}
.adv-mus-abas button.ativo{background:#3A2F78;color:#fff;box-shadow:inset 0 3px 0 var(--cor)}
.adv-mus-ferramentas{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:7px 14px;background:#3A2F78;
  border-bottom:1px solid rgba(255,255,255,.12)}
.adv-mus-ferramentas button{padding:6px 10px;font-size:13px}
.adv-mus-ferramentas .sep{width:1px;height:24px;background:rgba(255,255,255,.25);margin:0 4px}
.adv-mus-ferramentas .info{font-size:13px;color:#E3DAFF;margin-left:4px}
.adv-mus-faixa{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:8px 14px;background:#3A2F78}
.adv-mus-grade{flex:1;overflow:auto;position:relative;background:#120D26}
.adv-mus-grade .espaco{position:relative}
.adv-mus-grade canvas{position:sticky;top:0;left:0;display:block;cursor:crosshair}
.adv-mus-rodape{padding:6px 14px;font-size:12.5px;color:#CFC4F5;background:#221A45;display:flex;gap:16px;flex-wrap:wrap}
.adv-mus-rodape kbd{background:#3A2F78;border-radius:4px;padding:0 5px;font-family:inherit}
.adv-mus-aviso{position:absolute;left:50%;top:70px;transform:translateX(-50%);background:#1B1338;border:2px solid #FFC928;
  padding:8px 16px;border-radius:12px;z-index:5;pointer-events:none;transition:opacity .3s}
`;

let aberto = null;
// área de transferência do Criador de Músicas (continua entre aberturas do editor e entre músicas)
let areaTransferencia = null; // {tipo: 'notas', itens: [{p, n, d}], largura} | {tipo: 'bateria', itens: [{l, p}], largura}

const dentro = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * Abre o Criador de Músicas.
 * @param {VirtualMachine} vm VM do Scratch (usa o áudio dela)
 * @param {string} [nomeInicial] música para abrir
 */
export const abrirCriadorDeMusicas = (vm, nomeInicial) => {
    if (aberto) return;
    if (!document.getElementById('adv-mus-css')) {
        const st = document.createElement('style');
        st.id = 'adv-mus-css';
        st.textContent = CSS;
        document.head.appendChild(st);
    }
    const audio = vm.runtime.audioEngine;
    const ctx = () => audio.audioContext;
    const saida = () => audio.inputNode;
    const tocador = new Tocador(ctx, saida);
    tocador.repetir = true;

    let m;
    let nomeOriginal = null; // nome com que a música está gravada no projeto (null = nova)
    let alterado = false;
    let aba = 'melodia';
    let duracao = 2;
    let ferramenta = 'desenhar'; // desenhar | selecionar
    let arrastando = null;
    let sel = new Set(); // melódico: objetos de nota; bateria: chaves "linha:passo"
    let cursorPasso = 0; // onde o "colar" põe as notas
    let historico = [];
    let futuro = [];

    const raiz = document.createElement('div');
    raiz.className = 'adv-mus';
    raiz.innerHTML = `
      <div class="adv-mus-topo">
        <h2>🎼 Criador de Músicas</h2>
        <select class="lista" title="Músicas deste projeto"></select>
        <label>Nome <input class="nome" maxlength="40" style="width:150px"></label>
        <label>BPM <input class="bpm" type="number" min="40" max="240" style="width:64px"></label>
        <label>Compassos <select class="compassos"></select></label>
        <button class="tocar" title="Tocar / pausar (Espaço)">▶ Tocar</button>
        <button class="parar" title="Parar e voltar ao começo">⏹</button>
        <button class="repetir ativo" title="Repetir">🔁</button>
        <span class="esp"></span>
        <label>Começar de <select class="modelo" style="max-width:190px"></select></label>
        <button class="perigo apagar">🗑 Apagar música</button>
        <button class="salvar">✓ Salvar no projeto</button>
        <button class="fechar">✕ Fechar</button>
      </div>
      <div class="adv-mus-abas"></div>
      <div class="adv-mus-ferramentas">
        <button data-f="desenhar" title="Desenhar notas (B)">✏️ Desenhar</button>
        <button data-f="selecionar" title="Selecionar com caixa (V) — ou segure Shift e arraste">⬚ Selecionar</button>
        <span class="sep"></span>
        <button data-a="desfazer" title="Desfazer (Ctrl+Z)">↶ Desfazer</button>
        <button data-a="refazer" title="Refazer (Ctrl+Y)">↷ Refazer</button>
        <span class="sep"></span>
        <button data-a="copiar" title="Copiar (Ctrl+C)">⧉ Copiar</button>
        <button data-a="recortar" title="Recortar (Ctrl+X)">✂ Recortar</button>
        <button data-a="colar" title="Colar no marcador amarelo (Ctrl+V)">📋 Colar</button>
        <button data-a="duplicar" title="Duplicar logo depois (Ctrl+D)">⎘ Duplicar</button>
        <button data-a="apagar" title="Apagar seleção (Delete)">🗑 Apagar</button>
        <span class="sep tons"></span>
        <button class="tons" data-a="subir" title="Subir meio tom (↑)">♯ +1</button>
        <button class="tons" data-a="descer" title="Descer meio tom (↓)">♭ −1</button>
        <button class="tons" data-a="oitavaCima" title="Subir uma oitava (Shift+↑)">⇧ Oitava</button>
        <button class="tons" data-a="oitavaBaixo" title="Descer uma oitava (Shift+↓)">⇩ Oitava</button>
        <span class="info"></span>
      </div>
      <div class="adv-mus-faixa"></div>
      <div class="adv-mus-grade"><div class="espaco"><canvas></canvas></div></div>
      <div class="adv-mus-rodape">
        <span>✏️ clique põe/tira nota · arraste a nota para mover · puxe a ponta para alongar</span>
        <span>⬚ ou <kbd>Shift</kbd>+arrastar: caixa de seleção · <kbd>Ctrl</kbd>+clique: soma à seleção</span>
        <span><kbd>Ctrl+C</kbd> <kbd>Ctrl+X</kbd> <kbd>Ctrl+V</kbd> <kbd>Ctrl+D</kbd> <kbd>Ctrl+Z</kbd> · setas movem
          (<kbd>Shift</kbd> = batida/oitava) · <kbd>Delete</kbd> apaga · <kbd>Espaço</kbd> toca/pausa</span>
      </div>
      <div class="adv-mus-aviso" style="opacity:0"></div>`;
    document.body.appendChild(raiz);
    const $ = s => raiz.querySelector(s);
    const grade = $('.adv-mus-grade');
    const espaco = $('.espaco');
    const canvas = $('canvas');
    const g = canvas.getContext('2d');

    // botões não ficam com o foco (senão o Espaço "clicaria" neles de novo)
    raiz.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (b) b.blur();
    });

    const aviso = txt => {
        const a = $('.adv-mus-aviso');
        a.textContent = txt;
        a.style.opacity = 1;
        clearTimeout(aviso.t);
        aviso.t = setTimeout(() => {
            a.style.opacity = 0;
        }, 1800);
    };

    const marcarAlterado = () => {
        alterado = true;
        $('.salvar').textContent = '✓ Salvar no projeto *';
    };

    const ehBateria = () => aba === 'bateria';
    const faixaAtual = () => m.faixas.find(f => f.id === aba);
    const chaveBat = (l, p) => `${l}:${p}`;
    const lerChave = k => {
        const [l, p] = k.split(':').map(Number);
        return {l, p};
    };
    const temBatida = (l, p) => m.bateria.linhas[LINHAS_BATERIA[l]].includes(p);

    // ---------- desfazer / refazer ----------
    const registrar = () => {
        historico.push(JSON.stringify(m));
        if (historico.length > MAX_HISTORICO) historico.shift();
        futuro = [];
        marcarAlterado();
        atualizarFerramentas();
    };
    const restaurar = json => {
        const nome = m.nome;
        m = JSON.parse(json);
        m.nome = nome; // o nome digitado não volta atrás
        tocador.trocarMusica(m);
        sel = new Set();
        arrastando = null;
        preencherCampos();
        ajustarTamanho();
        marcarAlterado();
    };
    const desfazer = () => {
        if (!historico.length) {
            aviso('Nada para desfazer');
            return;
        }
        futuro.push(JSON.stringify(m));
        restaurar(historico.pop());
    };
    const refazer = () => {
        if (!futuro.length) {
            aviso('Nada para refazer');
            return;
        }
        historico.push(JSON.stringify(m));
        restaurar(futuro.pop());
    };

    // ---------- seleção ----------
    const limparSelecao = () => {
        sel = new Set();
        atualizarFerramentas();
    };
    const selecionados = () => {
        if (ehBateria()) return Array.from(sel).map(lerChave).filter(({l, p}) => temBatida(l, p));
        const f = faixaAtual();
        return f.notas.filter(n => sel.has(n));
    };
    const selecionarTudo = () => {
        if (ehBateria()) {
            sel = new Set();
            LINHAS_BATERIA.forEach((l, i) => m.bateria.linhas[l].forEach(p => sel.add(chaveBat(i, p))));
        } else {
            sel = new Set(faixaAtual().notas);
        }
        atualizarFerramentas();
    };

    const apagarSelecao = () => {
        const itens = selecionados();
        if (!itens.length) return;
        registrar();
        if (ehBateria()) {
            itens.forEach(({l, p}) => {
                const lista = m.bateria.linhas[LINHAS_BATERIA[l]];
                lista.splice(lista.indexOf(p), 1);
            });
        } else {
            const f = faixaAtual();
            f.notas = f.notas.filter(n => !sel.has(n));
        }
        limparSelecao();
    };

    const copiar = () => {
        const itens = selecionados();
        if (!itens.length) {
            aviso('Selecione notas para copiar');
            return false;
        }
        const ini = Math.min(...itens.map(i => i.p));
        if (ehBateria()) {
            areaTransferencia = {tipo: 'bateria', itens: itens.map(({l, p}) => ({l, p: p - ini})),
                largura: Math.max(...itens.map(i => i.p)) - ini + 1};
        } else {
            areaTransferencia = {tipo: 'notas', itens: itens.map(n => ({p: n.p - ini, n: n.n, d: n.d})),
                largura: Math.max(...itens.map(n => n.p + n.d)) - ini};
        }
        atualizarFerramentas();
        aviso(`${itens.length} ${itens.length === 1 ? 'nota copiada' : 'notas copiadas'}`);
        return true;
    };

    const recortar = () => {
        if (copiar()) apagarSelecao();
    };

    const colarEm = inicio => {
        const at = areaTransferencia;
        if (!at) {
            aviso('Copie algumas notas primeiro');
            return;
        }
        if ((at.tipo === 'bateria') !== ehBateria()) {
            aviso(at.tipo === 'bateria' ? 'Isso foi copiado da bateria: cole na aba Bateria' :
                'Notas de piano não podem ser coladas na bateria');
            return;
        }
        const total = totalPassos(m);
        registrar();
        const novos = new Set();
        if (at.tipo === 'bateria') {
            for (const it of at.itens) {
                const p = inicio + it.p;
                if (p >= total) continue;
                const lista = m.bateria.linhas[LINHAS_BATERIA[it.l]];
                if (!lista.includes(p)) lista.push(p);
                novos.add(chaveBat(it.l, p));
            }
        } else {
            const f = faixaAtual();
            for (const it of at.itens) {
                const p = inicio + it.p;
                if (p >= total) continue;
                let nota = f.notas.find(x => x.p === p && x.n === it.n);
                if (nota) {
                    nota.d = Math.max(nota.d, Math.min(it.d, total - p));
                } else {
                    nota = {p, n: it.n, d: Math.min(it.d, total - p)};
                    f.notas.push(nota);
                }
                novos.add(nota);
            }
        }
        sel = novos;
        cursorPasso = Math.min(total - 1, inicio + at.largura);
        atualizarFerramentas();
        if (!novos.size) aviso('Não coube nada: o marcador está no fim da música');
    };
    const colar = () => colarEm(cursorPasso);

    const duplicar = () => {
        const itens = selecionados();
        if (!itens.length) {
            aviso('Selecione notas para duplicar');
            return;
        }
        const guardada = areaTransferencia;
        copiar();
        const ini = Math.min(...itens.map(i => i.p));
        colarEm(ini + areaTransferencia.largura);
        areaTransferencia = guardada || areaTransferencia;
        atualizarFerramentas();
    };

    /** Move a seleção: dp passos para a direita; dv meio-tons para cima (ou linhas da bateria para baixo). */
    const moverSelecao = (dp, dv) => {
        const itens = selecionados();
        if (!itens.length) return;
        const total = totalPassos(m);
        registrar();
        if (ehBateria()) {
            const minP = Math.min(...itens.map(i => i.p));
            const maxP = Math.max(...itens.map(i => i.p));
            const minL = Math.min(...itens.map(i => i.l));
            const maxL = Math.max(...itens.map(i => i.l));
            const ddp = dentro(dp, -minP, total - 1 - maxP);
            const ddl = dentro(dv, -minL, LINHAS_BATERIA.length - 1 - maxL);
            itens.forEach(({l, p}) => {
                const lista = m.bateria.linhas[LINHAS_BATERIA[l]];
                lista.splice(lista.indexOf(p), 1);
            });
            sel = new Set();
            itens.forEach(({l, p}) => {
                const lista = m.bateria.linhas[LINHAS_BATERIA[l + ddl]];
                if (!lista.includes(p + ddp)) lista.push(p + ddp);
                sel.add(chaveBat(l + ddl, p + ddp));
            });
        } else {
            const minP = Math.min(...itens.map(n => n.p));
            const maxFim = Math.max(...itens.map(n => n.p + n.d));
            const minN = Math.min(...itens.map(n => n.n));
            const maxN = Math.max(...itens.map(n => n.n));
            const ddp = dentro(dp, -minP, total - maxFim);
            const ddn = dentro(dv, NOTA_MIN - minN, NOTA_MAX - maxN);
            itens.forEach(n => {
                n.p += ddp;
                n.n += ddn;
            });
            if (ddn && itens.length <= 6) {
                const f = faixaAtual();
                itens.forEach(n => tocarNota(ctx(), saida(), f.instrumento, n.n, ctx().currentTime + 0.01, 0.25, f.volume));
            }
        }
        atualizarFerramentas();
    };

    const ACOES = {
        desfazer, refazer, copiar, recortar, colar, duplicar,
        apagar: apagarSelecao,
        subir: () => moverSelecao(0, 1),
        descer: () => moverSelecao(0, -1),
        oitavaCima: () => moverSelecao(0, 12),
        oitavaBaixo: () => moverSelecao(0, -12)
    };

    const escolherFerramenta = f => {
        ferramenta = f;
        atualizarFerramentas();
    };

    function atualizarFerramentas () {
        if (!m) return;
        raiz.querySelectorAll('[data-f]').forEach(b => b.classList.toggle('ativo', b.dataset.f === ferramenta));
        const qtd = selecionados().length;
        const at = areaTransferencia;
        const podeColar = Boolean(at) && ((at.tipo === 'bateria') === ehBateria());
        const estado = {
            desfazer: historico.length > 0,
            refazer: futuro.length > 0,
            copiar: qtd > 0,
            recortar: qtd > 0,
            colar: podeColar,
            duplicar: qtd > 0,
            apagar: qtd > 0,
            subir: qtd > 0,
            descer: qtd > 0,
            oitavaCima: qtd > 0,
            oitavaBaixo: qtd > 0
        };
        raiz.querySelectorAll('[data-a]').forEach(b => {
            b.disabled = !estado[b.dataset.a];
        });
        raiz.querySelectorAll('.tons').forEach(b => {
            b.style.display = ehBateria() ? 'none' : '';
        });
        let info = qtd ? `${qtd} ${ehBateria() ? (qtd === 1 ? 'batida selecionada' : 'batidas selecionadas') :
            (qtd === 1 ? 'nota selecionada' : 'notas selecionadas')}` : '';
        if (at) info += `${info ? ' · ' : ''}📋 ${at.itens.length} na área de transferência`;
        $('.adv-mus-ferramentas .info').textContent = info;
    }

    raiz.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => escolherFerramenta(b.dataset.f)));
    raiz.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => ACOES[b.dataset.a]()));

    // ---------- interface ----------
    const preencherLista = () => {
        const s = $('.lista');
        const nomes = nomesMusicas();
        s.innerHTML = '';
        if (!nomeOriginal) s.add(new Option(`${m.nome} (nova)`, ''));
        nomes.forEach(n => s.add(new Option(`🎵 ${n}`, n)));
        s.add(new Option('＋ Nova música', '__nova__'));
        s.value = nomeOriginal || '';
    };

    const instrumentosOpcoes = atual => {
        const extras = instrumentosExtras();
        let html = INSTRUMENTOS.map(i => `<option value="${i.id}"${i.id === atual ? ' selected' : ''}>${i.nome}</option>`)
            .join('');
        if (extras.length) {
            html += '<optgroup label="SoundFont (.sf2)">' + extras.map(i =>
                `<option value="${i.id}"${i.id === atual ? ' selected' : ''}>🎚️ ${i.nome}</option>`).join('') + '</optgroup>';
        }
        html += '<option value="__importar__">📂 Importar instrumento .sf2…</option>';
        html += '<option value="__loja__">🛒 Loja de Instrumentos Virtuais…</option>';
        return html;
    };

    const montarAbas = () => {
        const abas = $('.adv-mus-abas');
        abas.innerHTML = '';
        [['melodia', '🎹 Melodia'], ['baixo', '🎸 Baixo'], ['acordes', '🎶 Acordes'], ['bateria', '🥁 Bateria']]
            .forEach(([id, txt]) => {
                const b = document.createElement('button');
                b.textContent = txt;
                b.style.setProperty('--cor', CORES[id]);
                if (id === aba) b.classList.add('ativo');
                b.addEventListener('click', () => {
                    if (aba === id) return;
                    aba = id;
                    sel = new Set();
                    montarAbas();
                    montarFaixa();
                    ajustarTamanho(true);
                    atualizarFerramentas();
                });
                abas.appendChild(b);
            });
    };

    const montarFaixa = () => {
        const div = $('.adv-mus-faixa');
        if (ehBateria()) {
            div.innerHTML = `<label>Volume da bateria <input class="vol" type="range" min="0" max="1" step="0.05"
                value="${m.bateria.volume}"></label><button class="limpar">Limpar bateria</button>
                <span style="opacity:.8">Clique nos quadradinhos para ligar e desligar cada som.</span>`;
            div.querySelector('.vol').addEventListener('change', () => marcarAlterado());
            div.querySelector('.vol').addEventListener('input', e => {
                m.bateria.volume = Number(e.target.value);
            });
            div.querySelector('.limpar').addEventListener('click', () => {
                registrar();
                LINHAS_BATERIA.forEach(l => {
                    m.bateria.linhas[l] = [];
                });
                limparSelecao();
            });
            return;
        }
        const f = faixaAtual();
        div.innerHTML = `<label>Instrumento <select class="inst">${instrumentosOpcoes(f.instrumento)}</select></label>
            <label>Volume <input class="vol" type="range" min="0" max="1" step="0.05" value="${f.volume}"></label>
            <span>Tamanho da nota:</span>${DURACOES.map(d =>
        `<button class="dur${d.d === duracao ? ' ativo' : ''}" data-d="${d.d}">${d.txt}</button>`).join('')}
            <button class="limpar">Limpar faixa</button>`;
        div.querySelector('.inst').addEventListener('change', e => {
            const v = e.target.value;
            if (v === '__importar__' || v === '__loja__') {
                e.target.value = f.instrumento;
                const evento = v === '__importar__' ? 'adventiscratch-importar-sf2' : 'adventiscratch-loja-instrumentos';
                window.dispatchEvent(new CustomEvent(evento, {detail: {aoEscolher: id => {
                    registrar();
                    f.instrumento = id;
                    montarFaixa();
                }}}));
                return;
            }
            registrar();
            f.instrumento = v;
            tocarNota(ctx(), saida(), f.instrumento, aba === 'baixo' ? 43 : 67, ctx().currentTime + 0.01, 0.4, f.volume);
        });
        div.querySelector('.vol').addEventListener('change', () => marcarAlterado());
        div.querySelector('.vol').addEventListener('input', e => {
            f.volume = Number(e.target.value);
        });
        div.querySelectorAll('.dur').forEach(b => b.addEventListener('click', () => {
            duracao = Number(b.dataset.d);
            montarFaixa();
        }));
        div.querySelector('.limpar').addEventListener('click', () => {
            registrar();
            f.notas = [];
            limparSelecao();
        });
    };

    const preencherCampos = () => {
        $('.nome').value = m.nome;
        $('.bpm').value = m.bpm;
        const sc = $('.compassos');
        sc.innerHTML = '';
        for (let i = 1; i <= 32; i++) sc.add(new Option(String(i), String(i)));
        sc.value = String(m.compassos);
        const sm = $('.modelo');
        sm.innerHTML = '<option value="">—</option>' + MODELOS.map(x => `<option value="${x.id}">${x.nome}</option>`).join('');
        preencherLista();
        montarAbas();
        montarFaixa();
        atualizarFerramentas();
    };

    // ---------- tamanho e rolagem ----------
    const larguraMundo = () => TECLADO + (totalPassos(m) * CEL);
    const alturaMundo = () => REGUA + (ehBateria() ? LINHAS_BATERIA.length * ALT_BAT : LINHAS * ALT);

    const ajustarTamanho = rolarParaNotas => {
        espaco.style.width = `${larguraMundo()}px`;
        espaco.style.height = `${alturaMundo()}px`;
        canvas.width = Math.max(100, grade.clientWidth);
        canvas.height = Math.max(100, grade.clientHeight);
        canvas.style.width = `${canvas.width}px`;
        canvas.style.height = `${canvas.height}px`;
        canvas.style.marginBottom = `-${canvas.height}px`;
        if (rolarParaNotas && !ehBateria()) {
            const f = faixaAtual();
            const media = f.notas.length ? f.notas.reduce((s, n) => s + n.n, 0) / f.notas.length :
                (aba === 'baixo' ? 43 : 67);
            grade.scrollTop = Math.max(0, ((NOTA_MAX - media) * ALT) - (canvas.height / 2));
        }
    };

    // ---------- coordenadas (mundo = posição dentro da grade inteira, sem a rolagem) ----------
    const posMouse = ev => {
        const r = canvas.getBoundingClientRect();
        return {x: ev.clientX - r.left, y: ev.clientY - r.top};
    };
    const paraMundo = ({x, y}) => ({x: x + grade.scrollLeft, y: y + grade.scrollTop});
    const passoDoMundo = wx => Math.floor((wx - TECLADO) / CEL);
    const notaDoMundo = wy => NOTA_MAX - Math.floor((wy - REGUA) / ALT);
    const linhaDoMundo = wy => Math.floor((wy - REGUA) / ALT_BAT);

    const notaNoPonto = (f, wx, wy) => {
        const p = passoDoMundo(wx);
        const n = notaDoMundo(wy);
        // a nota desenhada por último fica por cima: procura de trás para frente
        for (let i = f.notas.length - 1; i >= 0; i--) {
            const x = f.notas[i];
            if (x.n === n && p >= x.p && p < x.p + x.d) return x;
        }
        return null;
    };
    const naPonta = (nota, wx) => wx >= TECLADO + ((nota.p + nota.d) * CEL) - PONTA;

    const retanguloDaNota = n => ({x: TECLADO + (n.p * CEL), y: REGUA + ((NOTA_MAX - n.n) * ALT), w: n.d * CEL, h: ALT});
    const retanguloDaBatida = (l, p) => ({x: TECLADO + (p * CEL), y: REGUA + (l * ALT_BAT), w: CEL, h: ALT_BAT});
    const cruza = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    // ---------- mouse ----------
    canvas.addEventListener('mousedown', ev => {
        if (ev.button !== 0) return;
        const tela = posMouse(ev);
        const w = paraMundo(tela);
        const total = totalPassos(m);
        const p = passoDoMundo(w.x);
        const somar = ev.ctrlKey || ev.metaKey;
        const caixa = ferramenta === 'selecionar' || ev.shiftKey;

        // régua: toca dali e põe o marcador de colar
        if (tela.y < REGUA) {
            if (tela.x < TECLADO) return;
            const pp = dentro(p, 0, total - 1);
            cursorPasso = pp;
            if (tocador.estado === 'parada') {
                tocador.tocar(m, pp);
                atualizarBotaoTocar();
            } else {
                tocador.irPara(pp);
            }
            return;
        }

        if (ehBateria()) {
            const l = linhaDoMundo(w.y);
            const linha = LINHAS_BATERIA[l];
            if (!linha) return;
            if (tela.x < TECLADO) {
                tocarBateria(ctx(), saida(), linha, ctx().currentTime + 0.01, m.bateria.volume);
                return;
            }
            if (p < 0 || p >= total) return;
            const k = chaveBat(l, p);
            const tem = temBatida(l, p);
            if (tem && somar) {
                if (sel.has(k)) sel.delete(k);
                else sel.add(k);
                atualizarFerramentas();
                return;
            }
            if (tem) {
                const estavaSelecionada = sel.has(k) && sel.size > 1;
                if (!sel.has(k)) sel = new Set([k]);
                arrastando = {tipo: 'moverBat', inicio: {l, p}, clicado: k, estavaSelecionada, d: {p: 0, l: 0}, moveu: false,
                    flutuantes: null};
                atualizarFerramentas();
                return;
            }
            cursorPasso = p;
            if (caixa || somar) {
                arrastando = {tipo: 'caixa', a: w, b: w, base: (ev.shiftKey || somar) ? new Set(sel) : new Set()};
                if (!ev.shiftKey && !somar) limparSelecao();
                return;
            }
            // desenhar: liga o quadradinho e continua ligando enquanto arrasta
            registrar();
            limparSelecao();
            m.bateria.linhas[linha].push(p);
            tocarBateria(ctx(), saida(), linha, ctx().currentTime + 0.01, m.bateria.volume);
            arrastando = {tipo: 'pintarBat', l};
            return;
        }

        const f = faixaAtual();
        const n = notaDoMundo(w.y);
        if (n < NOTA_MIN || n > NOTA_MAX) return;
        if (tela.x < TECLADO) {
            tocarNota(ctx(), saida(), f.instrumento, n, ctx().currentTime + 0.01, 0.5, f.volume);
            return;
        }
        if (p < 0 || p >= total) return;
        const nota = notaNoPonto(f, w.x, w.y);
        if (nota && somar) {
            if (sel.has(nota)) sel.delete(nota);
            else sel.add(nota);
            atualizarFerramentas();
            return;
        }
        if (nota) {
            const estavaSelecionada = sel.has(nota) && sel.size > 1;
            if (!sel.has(nota)) sel = new Set([nota]);
            const grupo = f.notas.filter(x => sel.has(x));
            arrastando = {
                tipo: naPonta(nota, w.x) ? 'alongar' : 'mover',
                inicio: {p, n},
                clicada: nota,
                estavaSelecionada,
                originais: new Map(grupo.map(x => [x, {p: x.p, n: x.n, d: x.d}])),
                moveu: false,
                ultimoTom: nota.n
            };
            atualizarFerramentas();
            return;
        }
        cursorPasso = p;
        if (caixa || somar) {
            arrastando = {tipo: 'caixa', a: w, b: w, base: (ev.shiftKey || somar) ? new Set(sel) : new Set()};
            if (!ev.shiftKey && !somar) limparSelecao();
            return;
        }
        // desenhar: nova nota (arrastar deixa mais longa)
        registrar();
        const nova = {p, n, d: Math.min(duracao, total - p)};
        f.notas.push(nova);
        sel = new Set();
        tocarNota(ctx(), saida(), f.instrumento, n, ctx().currentTime + 0.01, Math.min(0.6, nova.d * 0.12), f.volume);
        arrastando = {tipo: 'nova', nota: nova};
        atualizarFerramentas();
    });

    const cursorDoMouse = w => {
        if (w.y - grade.scrollTop < REGUA) return 'pointer';
        if (ehBateria()) {
            const l = linhaDoMundo(w.y);
            const p = passoDoMundo(w.x);
            if (l >= 0 && l < LINHAS_BATERIA.length && temBatida(l, p)) return 'move';
            return ferramenta === 'selecionar' ? 'default' : 'crosshair';
        }
        const nota = notaNoPonto(faixaAtual(), w.x, w.y);
        if (nota) return naPonta(nota, w.x) ? 'ew-resize' : 'move';
        return ferramenta === 'selecionar' ? 'default' : 'crosshair';
    };

    const aoMover = ev => {
        const tela = posMouse(ev);
        const w = paraMundo(tela);
        if (!arrastando) {
            if (ev.target === canvas) canvas.style.cursor = cursorDoMouse(w);
            return;
        }
        const total = totalPassos(m);
        const p = dentro(passoDoMundo(w.x), 0, total - 1);
        const a = arrastando;
        if (a.tipo === 'nova') {
            a.nota.d = Math.max(1, p - a.nota.p + 1);
        } else if (a.tipo === 'pintarBat') {
            const lista = m.bateria.linhas[LINHAS_BATERIA[a.l]];
            if (linhaDoMundo(w.y) === a.l && !lista.includes(p)) lista.push(p);
        } else if (a.tipo === 'caixa') {
            a.b = w;
            const r = {x: Math.min(a.a.x, a.b.x), y: Math.min(a.a.y, a.b.y), w: Math.abs(a.b.x - a.a.x),
                h: Math.abs(a.b.y - a.a.y)};
            const novo = new Set(a.base);
            if (ehBateria()) {
                LINHAS_BATERIA.forEach((l, i) => m.bateria.linhas[l].forEach(pp => {
                    if (cruza(r, retanguloDaBatida(i, pp))) novo.add(chaveBat(i, pp));
                }));
            } else {
                faixaAtual().notas.forEach(x => {
                    if (cruza(r, retanguloDaNota(x))) novo.add(x);
                });
            }
            sel = novo;
            atualizarFerramentas();
        } else if (a.tipo === 'mover' || a.tipo === 'alongar') {
            const dp = passoDoMundo(w.x) - a.inicio.p;
            const dn = notaDoMundo(w.y) - a.inicio.n;
            if (!a.moveu && (dp || (a.tipo === 'mover' && dn))) {
                registrar();
                a.moveu = true;
            }
            if (!a.moveu) return;
            const orig = Array.from(a.originais.values());
            if (a.tipo === 'mover') {
                const ddp = dentro(dp, -Math.min(...orig.map(o => o.p)), total - Math.max(...orig.map(o => o.p + o.d)));
                const ddn = dentro(dn, NOTA_MIN - Math.min(...orig.map(o => o.n)), NOTA_MAX - Math.max(...orig.map(o => o.n)));
                a.originais.forEach((o, x) => {
                    x.p = o.p + ddp;
                    x.n = o.n + ddn;
                });
                if (a.clicada.n !== a.ultimoTom) {
                    a.ultimoTom = a.clicada.n;
                    const f = faixaAtual();
                    tocarNota(ctx(), saida(), f.instrumento, a.clicada.n, ctx().currentTime + 0.01, 0.2, f.volume);
                }
            } else {
                a.originais.forEach((o, x) => {
                    x.d = dentro(o.d + dp, 1, total - x.p);
                });
            }
        } else if (a.tipo === 'moverBat') {
            const dp = passoDoMundo(w.x) - a.inicio.p;
            const dl = linhaDoMundo(w.y) - a.inicio.l;
            if (!a.moveu && (dp || dl)) {
                registrar();
                a.moveu = true;
                // tira as batidas selecionadas da grade: elas "flutuam" até soltar o mouse
                a.flutuantes = selecionados();
                a.flutuantes.forEach(({l, p: pp}) => {
                    const lista = m.bateria.linhas[LINHAS_BATERIA[l]];
                    lista.splice(lista.indexOf(pp), 1);
                });
            }
            if (!a.moveu) return;
            const fl = a.flutuantes;
            a.d = {
                p: dentro(dp, -Math.min(...fl.map(i => i.p)), total - 1 - Math.max(...fl.map(i => i.p))),
                l: dentro(dl, -Math.min(...fl.map(i => i.l)), LINHAS_BATERIA.length - 1 - Math.max(...fl.map(i => i.l)))
            };
        }
    };

    const aoSoltar = () => {
        const a = arrastando;
        arrastando = null;
        if (!a) return;
        if ((a.tipo === 'mover' || a.tipo === 'alongar') && !a.moveu) {
            if (ferramenta === 'desenhar' && !a.estavaSelecionada) {
                // clique simples numa nota com o lápis: tira a nota
                registrar();
                const f = faixaAtual();
                f.notas.splice(f.notas.indexOf(a.clicada), 1);
                sel = new Set();
            } else {
                sel = new Set([a.clicada]);
            }
        } else if (a.tipo === 'moverBat') {
            if (!a.moveu) {
                if (ferramenta === 'desenhar' && !a.estavaSelecionada) {
                    registrar();
                    const {l, p} = lerChave(a.clicado);
                    const lista = m.bateria.linhas[LINHAS_BATERIA[l]];
                    lista.splice(lista.indexOf(p), 1);
                    sel = new Set();
                } else {
                    sel = new Set([a.clicado]);
                }
            } else {
                sel = new Set();
                a.flutuantes.forEach(({l, p}) => {
                    const lista = m.bateria.linhas[LINHAS_BATERIA[l + a.d.l]];
                    if (!lista.includes(p + a.d.p)) lista.push(p + a.d.p);
                    sel.add(chaveBat(l + a.d.l, p + a.d.p));
                });
            }
        }
        atualizarFerramentas();
    };
    window.addEventListener('mousemove', aoMover);
    window.addEventListener('mouseup', aoSoltar);

    // ---------- desenho ----------
    const desenhar = () => {
        const W = canvas.width;
        const H = canvas.height;
        const sx = grade.scrollLeft;
        const sy = grade.scrollTop;
        const total = totalPassos(m);
        g.fillStyle = '#120D26';
        g.fillRect(0, 0, W, H);
        const x0 = TECLADO - sx;
        const passoIni = Math.max(0, Math.floor(sx / CEL));
        const passoFim = Math.min(total, Math.ceil((sx + W) / CEL) + 1);

        if (ehBateria()) {
            LINHAS_BATERIA.forEach((l, i) => {
                const y = REGUA + (i * ALT_BAT) - sy;
                g.fillStyle = i % 2 ? '#1A1436' : '#1E1840';
                g.fillRect(TECLADO, y, W, ALT_BAT);
            });
        } else {
            for (let n = NOTA_MAX; n >= NOTA_MIN; n--) {
                const y = REGUA + ((NOTA_MAX - n) * ALT) - sy;
                if (y > H || y + ALT < REGUA) continue;
                g.fillStyle = PRETAS.has(n % 12) ? '#151030' : '#1C1640';
                g.fillRect(TECLADO, y, W, ALT);
                if (n % 12 === 0) {
                    g.fillStyle = 'rgba(255,255,255,.12)';
                    g.fillRect(TECLADO, y + ALT - 1, W, 1);
                }
            }
        }
        // linhas verticais
        for (let p = passoIni; p <= passoFim; p++) {
            const x = x0 + (p * CEL);
            if (x < TECLADO) continue;
            g.fillStyle = p % PASSOS_POR_COMPASSO === 0 ? 'rgba(255,255,255,.35)' :
                (p % PASSOS_POR_BATIDA === 0 ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.05)');
            g.fillRect(x, REGUA, 1, H);
        }
        g.save();
        g.beginPath();
        g.rect(TECLADO, REGUA, W, H);
        g.clip();
        if (ehBateria()) {
            const quadradinho = (i, p, selecionada, alfa = 1) => {
                const x = x0 + (p * CEL);
                const y = REGUA + (i * ALT_BAT) - sy;
                if (x < TECLADO - CEL || x > W) return;
                g.globalAlpha = alfa;
                g.fillStyle = CORES.bateria;
                g.beginPath();
                g.roundRect(x + 3, y + 6, CEL - 6, ALT_BAT - 12, 5);
                g.fill();
                if (selecionada) {
                    g.lineWidth = 2.5;
                    g.strokeStyle = '#fff';
                    g.stroke();
                }
                g.globalAlpha = 1;
            };
            LINHAS_BATERIA.forEach((l, i) => {
                for (const p of m.bateria.linhas[l]) quadradinho(i, p, sel.has(chaveBat(i, p)));
            });
            const a = arrastando;
            if (a && a.tipo === 'moverBat' && a.moveu) {
                a.flutuantes.forEach(({l, p}) => quadradinho(l + a.d.l, p + a.d.p, true, 0.85));
            }
        } else {
            // notas das outras faixas, bem clarinhas
            g.fillStyle = 'rgba(255,255,255,.12)';
            for (const f of m.faixas) {
                if (f.id === aba) continue;
                for (const n of f.notas) {
                    const x = x0 + (n.p * CEL);
                    const y = REGUA + ((NOTA_MAX - n.n) * ALT) - sy;
                    if (x > W || x + (n.d * CEL) < TECLADO || y > H || y + ALT < REGUA) continue;
                    g.fillRect(x + 1, y + 2, (n.d * CEL) - 2, ALT - 4);
                }
            }
            const f = faixaAtual();
            for (const n of f.notas) {
                const x = x0 + (n.p * CEL);
                const y = REGUA + ((NOTA_MAX - n.n) * ALT) - sy;
                if (x > W || x + (n.d * CEL) < TECLADO || y > H || y + ALT < REGUA) continue;
                const selecionada = sel.has(n);
                g.fillStyle = CORES[f.id];
                g.beginPath();
                g.roundRect(x + 1, y + 1, (n.d * CEL) - 2, ALT - 2, 4);
                g.fill();
                if (selecionada) {
                    g.lineWidth = 2.5;
                    g.strokeStyle = '#fff';
                    g.stroke();
                }
                g.fillStyle = selecionada ? '#fff' : 'rgba(0,0,0,.25)';
                g.fillRect(x + (n.d * CEL) - 5, y + 3, 2, ALT - 6);
            }
        }
        // caixa de seleção
        if (arrastando && arrastando.tipo === 'caixa') {
            const {a, b} = arrastando;
            const rx = Math.min(a.x, b.x) - sx;
            const ry = Math.min(a.y, b.y) - sy;
            g.fillStyle = 'rgba(255,201,40,.12)';
            g.fillRect(rx, ry, Math.abs(b.x - a.x), Math.abs(b.y - a.y));
            g.setLineDash([6, 4]);
            g.lineWidth = 1.5;
            g.strokeStyle = '#FFC928';
            g.strokeRect(rx + 0.5, ry + 0.5, Math.abs(b.x - a.x), Math.abs(b.y - a.y));
            g.setLineDash([]);
        }
        g.restore();

        // teclado / nomes da bateria
        g.fillStyle = '#0D0920';
        g.fillRect(0, REGUA, TECLADO, H);
        g.font = 'bold 11px Helvetica, Arial, sans-serif';
        g.textBaseline = 'middle';
        if (ehBateria()) {
            LINHAS_BATERIA.forEach((l, i) => {
                const y = REGUA + (i * ALT_BAT) - sy;
                g.fillStyle = '#2E2560';
                g.fillRect(2, y + 2, TECLADO - 4, ALT_BAT - 4);
                g.fillStyle = '#fff';
                g.fillText(NOMES_BATERIA[l], 8, y + (ALT_BAT / 2));
            });
        } else {
            for (let n = NOTA_MAX; n >= NOTA_MIN; n--) {
                const y = REGUA + ((NOTA_MAX - n) * ALT) - sy;
                if (y > H || y + ALT < REGUA) continue;
                const preta = PRETAS.has(n % 12);
                g.fillStyle = preta ? '#222' : '#F4F1FF';
                g.fillRect(0, y, preta ? TECLADO * 0.62 : TECLADO - 1, ALT - 1);
                if (n % 12 === 0) {
                    g.fillStyle = '#6D4FC2';
                    g.fillText(nomeNota(n), TECLADO - 34, y + (ALT / 2));
                }
            }
        }
        // régua
        g.fillStyle = '#2E2560';
        g.fillRect(0, 0, W, REGUA);
        for (let p = passoIni; p < passoFim; p++) {
            if (p % PASSOS_POR_BATIDA !== 0) continue;
            const x = x0 + (p * CEL);
            if (x < TECLADO - 4) continue;
            const batida = (p / PASSOS_POR_BATIDA) + 1;
            const compasso = p % PASSOS_POR_COMPASSO === 0;
            g.fillStyle = compasso ? '#FFC928' : 'rgba(255,255,255,.6)';
            g.fillText(compasso ? `${(p / PASSOS_POR_COMPASSO) + 1}` : `·${batida}`, x + 4, REGUA / 2);
        }
        // marcador de colar (amarelo)
        const xc = x0 + (cursorPasso * CEL);
        if (xc >= TECLADO && xc <= W) {
            g.fillStyle = 'rgba(255,201,40,.35)';
            g.fillRect(xc, REGUA, 1, H);
            g.fillStyle = '#FFC928';
            g.beginPath();
            g.moveTo(xc - 6, REGUA - 9);
            g.lineTo(xc + 6, REGUA - 9);
            g.lineTo(xc, REGUA);
            g.fill();
        }
        g.fillStyle = '#1B1338';
        g.fillRect(0, 0, TECLADO, REGUA);
        g.fillStyle = '#CFC4F5';
        g.fillText('compasso', 4, REGUA / 2);
        // agulha
        if (tocador.estado !== 'parada') {
            const x = x0 + (tocador.passoAtual() * CEL);
            if (x >= TECLADO) {
                g.fillStyle = '#FF5A5A';
                g.fillRect(x - 1, 0, 3, H);
            }
        }
        // fim da música
        const xf = x0 + (total * CEL);
        if (xf < W) {
            g.fillStyle = 'rgba(0,0,0,.45)';
            g.fillRect(xf, 0, W - xf, H);
        }
    };

    let quadro = null;
    const laco = () => {
        desenhar();
        quadro = requestAnimationFrame(laco);
    };

    // ---------- controles ----------
    const atualizarBotaoTocar = () => {
        $('.tocar').textContent = tocador.estado === 'tocando' ? '⏸ Pausar' : '▶ Tocar';
    };
    const tocarPausar = () => {
        if (tocador.estado === 'tocando') tocador.pausar();
        else if (tocador.estado === 'pausada') tocador.continuar();
        else tocador.tocar(m, 0);
        atualizarBotaoTocar();
    };
    $('.tocar').addEventListener('click', tocarPausar);
    $('.parar').addEventListener('click', () => {
        tocador.parar();
        atualizarBotaoTocar();
    });
    $('.repetir').addEventListener('click', e => {
        tocador.repetir = !tocador.repetir;
        e.target.classList.toggle('ativo', tocador.repetir);
    });
    $('.nome').addEventListener('input', e => {
        m.nome = e.target.value;
        if (!nomeOriginal) $('.lista').options[0].text = `${m.nome} (nova)`;
        marcarAlterado();
    });
    $('.bpm').addEventListener('change', e => {
        registrar();
        m.bpm = dentro(Math.round(Number(e.target.value) || 110), 40, 240);
        e.target.value = m.bpm;
        tocador.trocarMusica(m);
    });
    $('.compassos').addEventListener('change', e => {
        registrar();
        m.compassos = Number(e.target.value);
        const total = totalPassos(m);
        m.faixas.forEach(f => {
            f.notas = f.notas.filter(n => n.p < total);
            f.notas.forEach(n => {
                n.d = Math.min(n.d, total - n.p);
            });
        });
        LINHAS_BATERIA.forEach(l => {
            m.bateria.linhas[l] = m.bateria.linhas[l].filter(p => p < total);
        });
        cursorPasso = Math.min(cursorPasso, total - 1);
        sel = new Set();
        ajustarTamanho();
        atualizarFerramentas();
    });
    $('.modelo').addEventListener('change', e => {
        const mod = MODELOS.find(x => x.id === e.target.value);
        e.target.value = '';
        if (!mod) return;
        if (alterado && !window.confirm('Trocar as notas desta música pelo modelo escolhido?')) return; // eslint-disable-line no-alert
        registrar();
        const nome = m.nome;
        m = mod.criar();
        m.nome = nome;
        sel = new Set();
        tocador.trocarMusica(m);
        if (tocador.estado !== 'parada') tocador.tocar(m, 0);
        preencherCampos();
        ajustarTamanho(true);
        aviso(`Modelo "${mod.nome}" carregado. Mude o que quiser! (Ctrl+Z desfaz)`);
    });

    const carregar = nome => {
        tocador.parar();
        atualizarBotaoTocar();
        if (nome && obterMusica(nome)) {
            m = copiarMusica(obterMusica(nome));
            nomeOriginal = nome;
        } else {
            m = MODELOS[0].criar();
            m.nome = nomeLivre('minha música');
            nomeOriginal = null;
        }
        alterado = false;
        historico = [];
        futuro = [];
        sel = new Set();
        cursorPasso = 0;
        $('.salvar').textContent = '✓ Salvar no projeto';
        preencherCampos();
        ajustarTamanho(true);
    };

    const salvar = () => {
        const nome = (m.nome || '').trim() || 'minha música';
        if (nome !== nomeOriginal && obterMusica(nome)) {
            aviso(`Já existe uma música chamada "${nome}". Escolha outro nome.`);
            $('.nome').focus();
            return false;
        }
        m.nome = nome;
        gravarMusica(m, nomeOriginal);
        nomeOriginal = nome;
        alterado = false;
        $('.salvar').textContent = '✓ Salvo';
        preencherLista();
        aviso(`"${nome}" salva no projeto. Use os blocos de Músicas para tocar no jogo!`);
        return true;
    };
    $('.salvar').addEventListener('click', salvar);

    $('.lista').addEventListener('change', e => {
        const v = e.target.value;
        if (alterado && !window.confirm('Há mudanças não salvas nesta música. Trocar mesmo assim?')) { // eslint-disable-line no-alert
            preencherLista();
            return;
        }
        carregar(v === '__nova__' ? null : v);
    });
    $('.apagar').addEventListener('click', () => {
        if (!nomeOriginal) {
            carregar(null);
            return;
        }
        if (!window.confirm(`Apagar a música "${nomeOriginal}" do projeto?`)) return; // eslint-disable-line no-alert
        apagarMusica(nomeOriginal);
        const resto = nomesMusicas();
        carregar(resto[0] || null);
    });

    // ---------- teclado ----------
    const aoTeclar = ev => {
        // teclas digitadas em outra janela aberta por cima (loja, escolher instrumento) ficam com ela
        const alvo = ev.target;
        if (alvo && alvo !== document.body && alvo !== document.documentElement && !raiz.contains(alvo)) return;
        ev.stopPropagation(); // o palco do Scratch não recebe as teclas enquanto o editor está aberto
        const campo = alvo && /INPUT|SELECT|TEXTAREA/.test(alvo.tagName);
        if (ev.key === 'Escape') {
            limparSelecao(); // (para fechar o editor, use o botão ✕ Fechar)
            return;
        }
        if (campo) return;
        const ctrl = ev.ctrlKey || ev.metaKey;
        const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
        let feito = true;
        if (ctrl && k === 'z') {
            if (ev.shiftKey) refazer();
            else desfazer();
        } else if (ctrl && k === 'y') {
            refazer();
        } else if (ctrl && k === 'c') {
            copiar();
        } else if (ctrl && k === 'x') {
            recortar();
        } else if (ctrl && k === 'v') {
            colar();
        } else if (ctrl && k === 'd') {
            duplicar();
        } else if (ctrl && k === 'a') {
            selecionarTudo();
        } else if (ctrl) {
            feito = false;
        } else if (k === ' ') {
            tocarPausar();
        } else if (k === 'Delete' || k === 'Backspace') {
            apagarSelecao();
        } else if (k === 'b') {
            escolherFerramenta('desenhar');
        } else if (k === 'v') {
            escolherFerramenta('selecionar');
        } else if (k.startsWith('Arrow') && sel.size) {
            const passo = ev.shiftKey ? PASSOS_POR_BATIDA : 1;
            const tom = ev.shiftKey ? 12 : 1;
            if (k === 'ArrowLeft') moverSelecao(-passo, 0);
            if (k === 'ArrowRight') moverSelecao(passo, 0);
            // na bateria, ↑ ↓ trocam de linha (para cima = linha de cima)
            if (k === 'ArrowUp') moverSelecao(0, ehBateria() ? -1 : tom);
            if (k === 'ArrowDown') moverSelecao(0, ehBateria() ? 1 : -tom);
        } else {
            feito = false;
        }
        if (feito) ev.preventDefault();
    };
    window.addEventListener('keydown', aoTeclar, true);
    const aoRedimensionar = () => ajustarTamanho();
    window.addEventListener('resize', aoRedimensionar);
    const pararInstrumentos = aoMudarInstrumentosExtras(() => montarFaixa());

    const fechar = () => {
        if (alterado) {
            const r = window.confirm('Salvar as mudanças desta música antes de fechar?'); // eslint-disable-line no-alert
            if (r && !salvar()) return;
        }
        tocador.parar();
        cancelAnimationFrame(quadro);
        window.removeEventListener('keydown', aoTeclar, true);
        window.removeEventListener('mousemove', aoMover);
        window.removeEventListener('mouseup', aoSoltar);
        window.removeEventListener('resize', aoRedimensionar);
        pararInstrumentos();
        raiz.remove();
        aberto = null;
        delete window.adventiscratchCriador;
    };
    $('.fechar').addEventListener('click', fechar);

    aberto = {fechar};
    // para depurar pelo console (F12)
    window.adventiscratchCriador = {musica: () => m, selecao: () => sel.size, area: () => areaTransferencia};
    carregar(nomeInicial && obterMusica(nomeInicial) ? nomeInicial : (nomesMusicas()[0] || null));
    laco();
};

export const criadorAberto = () => Boolean(aberto);
