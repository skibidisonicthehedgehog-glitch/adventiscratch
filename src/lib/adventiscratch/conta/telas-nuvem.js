/**
 * Telas da nuvem e da loja: "Central" com abas (Meus projetos, Explorar, Loja de modelos, Meus modelos,
 * Publicar modelo) e a janela "Salvar na nuvem".
 */
import {getModelNames, getModel} from '../model-store.js';
import {chamar, urlImagem} from './api.js';
import {obterEstado} from './conta.js';
import {adicionarModeloDaLoja, publicarModelo} from './loja.js';
import {abrirDaNuvem, apagarProjeto, compartilhar, jaEstaNaNuvem, lerTitulo, obterNuvem, salvarNaNuvem} from './nuvem.js';
import {abrirTela, esc, fecharTela, mostrarErro, ocupado} from './telas.js';

const ESTILO_ID = 'adventiscratch-nuvem-estilo';
const injetarEstilo = () => {
    if (document.getElementById(ESTILO_ID)) return;
    const st = document.createElement('style');
    st.id = ESTILO_ID;
    st.textContent = `
.adv-central{background:#fff;border-radius:22px;width:min(1060px,100%);height:min(86vh,820px);display:flex;flex-direction:column;
  box-shadow:0 24px 60px rgba(0,0,0,.3);overflow:hidden;margin:auto}
.adv-central>header{display:flex;align-items:center;gap:6px;padding:12px 14px;background:#855CD6;flex-wrap:wrap}
.adv-central>header button.aba{border:0;background:none;color:#fff;font:inherit;font-weight:800;padding:8px 13px;border-radius:999px;
  cursor:pointer;font-size:.9rem}
.adv-central>header button.aba:hover{background:rgba(255,255,255,.15)}
.adv-central>header button.aba.ativa{background:#fff;color:#6D4FC2}
.adv-central>header .fechar{margin-left:auto;border:0;background:rgba(255,255,255,.2);color:#fff;width:34px;height:34px;
  border-radius:50%;font-size:1.1rem;cursor:pointer}
.adv-central .conteudo{flex:1;overflow:auto;padding:18px 20px;background:#F7F5FF}
.adv-barra{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
.adv-barra input,.adv-barra select{padding:9px 12px;border:2px solid #E2DDF5;border-radius:12px;font:inherit;font-size:.92rem}
.adv-barra input{flex:1;min-width:200px}
.adv-grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}
.adv-item{background:#fff;border-radius:16px;box-shadow:0 4px 14px rgba(46,30,110,.08);overflow:hidden;display:flex;flex-direction:column}
.adv-item .img{aspect-ratio:4/3;background:#EEEAFB center/cover no-repeat;display:grid;place-items:center;font-size:2.4rem;color:#B9A6F5}
.adv-item.modelo .img{aspect-ratio:1/1}
.adv-item .txt{padding:10px 12px 4px;font-size:.84rem;color:#4A4766;flex:1}
.adv-item .txt b{display:block;color:#1E1B3A;font-size:.95rem;line-height:1.25;margin-bottom:2px;word-break:break-word}
.adv-item .acoes{display:flex;gap:6px;padding:8px 10px 12px;flex-wrap:wrap}
.adv-item .acoes button{border:0;border-radius:999px;padding:7px 11px;font:inherit;font-weight:800;font-size:.8rem;cursor:pointer;
  background:#EEEAFB;color:#4A3290}
.adv-item .acoes button.primario{background:#6D4FC2;color:#fff}
.adv-item .acoes button.perigo{background:#FEE2E2;color:#991B1B}
.adv-item .acoes button:disabled{opacity:.6;cursor:wait}
.adv-etiqueta{display:inline-block;border-radius:999px;padding:1px 8px;font-size:.72rem;font-weight:800;margin:2px 4px 2px 0}
.adv-etiqueta.verde{background:#DCFCE7;color:#166534}.adv-etiqueta.cinza{background:#F1F0F6;color:#555}
.adv-etiqueta.vermelha{background:#FEE2E2;color:#991B1B}.adv-etiqueta.laranja{background:#FEF3C7;color:#92400E}
.adv-etiqueta.roxa{background:#EEEAFB;color:#4A3290}
.adv-vazio{text-align:center;color:#8A86A6;padding:50px 20px}
.adv-vazio .grande{font-size:2.6rem}
.adv-form{background:#fff;border-radius:16px;padding:18px 20px;max-width:640px}
.adv-regras{background:#FFF7DB;border:2px solid #FFE08A;border-radius:12px;padding:10px 14px;font-size:.86rem;margin:10px 0}
.adv-check{display:flex;gap:9px;align-items:flex-start;font-size:.9rem;margin:10px 0}
.adv-check input{margin-top:4px;width:18px;height:18px;flex:0 0 18px}
.adv-mais{display:block;margin:16px auto 0}
.adv-mais[hidden]{display:none}
.adv-denuncia{padding:8px 10px 12px;font-size:.8rem}
.adv-denuncia select,.adv-denuncia textarea{width:100%;box-sizing:border-box;border:2px solid #E2DDF5;border-radius:10px;
  padding:6px 8px;font:inherit;font-size:.8rem;margin-bottom:6px}
.adv-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#1E1B3A;color:#fff;padding:11px 18px;
  border-radius:999px;font-weight:700;z-index:30000;box-shadow:0 10px 30px rgba(0,0,0,.3);font-family:"Helvetica Neue",Arial,sans-serif;
  font-size:.92rem;max-width:90vw}
`;
    document.head.appendChild(st);
};

export const toast = (texto, ms = 3200) => {
    injetarEstilo();
    const el = document.createElement('div');
    el.className = 'adv-toast';
    el.setAttribute('role', 'status');
    el.textContent = texto;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
};

const data = iso => new Date(iso).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: '2-digit'});
const mb = n => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

const aplicarMiniatura = (el, caminho) => {
    urlImagem(caminho).then(url => {
        if (url) {
            el.style.backgroundImage = `url("${url}")`;
            el.textContent = '';
        }
    });
};

let categoriasCache = null;
const categorias = async () => {
    if (!categoriasCache) {
        try {
            categoriasCache = (await chamar('/categorias')).categorias;
        } catch (e) {
            categoriasCache = [{id: 'outro', nome: 'Outro motivo'}];
        }
    }
    return categoriasCache;
};

/** Troca as ações de um cartão por um formulário curto de denúncia. */
const formDenuncia = async (cartao, alvo) => {
    const cats = await categorias();
    const area = document.createElement('div');
    area.className = 'adv-denuncia';
    area.innerHTML = `<select aria-label="Motivo"><option value="">Motivo da denúncia…</option>${
        cats.map(c => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}</select>
      <textarea rows="3" maxlength="2000" placeholder="O que há de errado?"></textarea>
      <div class="acoes" style="padding:0"><button data-c>Cancelar</button><button class="primario" data-e>Enviar</button></div>
      <div class="msg" style="margin-top:6px"></div>`;
    const acoes = cartao.querySelector('.acoes');
    acoes.hidden = true;
    cartao.appendChild(area);
    area.querySelector('[data-c]').onclick = () => {
        area.remove();
        acoes.hidden = false;
    };
    const enviar = area.querySelector('[data-e]');
    enviar.onclick = () => ocupado(enviar, async () => {
        try {
            await chamar('/denuncias', {body: {
                ...alvo, categoria: area.querySelector('select').value, descricao: area.querySelector('textarea').value
            }});
            area.innerHTML = '<b style="color:#166534">Denúncia enviada. Obrigado!</b>';
            setTimeout(() => {
                area.remove();
                acoes.hidden = false;
            }, 2200);
        } catch (e) {
            area.querySelector('.msg').textContent = e.message;
            area.querySelector('.msg').style.color = '#991B1B';
        }
    });
};

const vazio = (icone, texto) => `<div class="adv-vazio"><div class="grande">${icone}</div><p>${texto}</p></div>`;

// ---------------------------------------------------------------- abas

const ABAS = [
    {id: 'meus', nome: '📁 Meus projetos'},
    {id: 'explorar', nome: '🌎 Explorar projetos'},
    {id: 'loja', nome: '🧩 Loja de modelos'},
    {id: 'meus-modelos', nome: '📦 Meus modelos'},
    {id: 'publicar', nome: '⬆️ Publicar modelo'}
];

let central = null;

const abaMeus = async conteudo => {
    conteudo.innerHTML = `<div class="adv-barra"><button class="adv-btn primario" data-salvar>☁ Salvar o projeto atual</button>
      <span style="color:#8A86A6;font-size:.86rem">Projetos privados só você vê. Compartilhados aparecem para todas as turmas.</span></div>
      <div class="adv-grade" data-grade><p>Carregando…</p></div>`;
    conteudo.querySelector('[data-salvar]').onclick = () => abrirSalvar();
    const {projetos} = await chamar('/projetos/meus');
    const grade = conteudo.querySelector('[data-grade]');
    if (!projetos.length) {
        grade.outerHTML = vazio('☁️', 'Você ainda não salvou nenhum projeto na nuvem.<br>Clique em <b>☁ Salvar</b> na barra do editor.');
        return;
    }
    grade.innerHTML = '';
    const atual = obterNuvem().projetoId;
    projetos.forEach(p => {
        const c = document.createElement('div');
        c.className = 'adv-item';
        const oculto = p.situacao === 'oculto';
        c.innerHTML = `<div class="img">💾</div><div class="txt"><b>${esc(p.titulo)}</b>
          ${p.id === atual ? '<span class="adv-etiqueta roxa">aberto agora</span>' : ''}
          ${oculto ? '<span class="adv-etiqueta vermelha">oculto pela moderação</span>' :
        (p.compartilhado ? '<span class="adv-etiqueta verde">compartilhado</span>' : '<span class="adv-etiqueta cinza">privado</span>')}
          <div>Salvo em ${data(p.atualizado_em)} · ${mb(p.tamanho)}</div>
          ${p.visualizacoes ? `<div>👁 aberto ${p.visualizacoes}× por outros</div>` : ''}
          ${oculto && p.nota_moderacao ? `<div style="color:#991B1B">Motivo: ${esc(p.nota_moderacao)}</div>` : ''}</div>
          <div class="acoes"><button class="primario" data-abrir>Abrir</button>
          ${oculto ? '' : `<button data-comp>${p.compartilhado ? 'Tornar privado' : 'Compartilhar'}</button>`}
          <button class="perigo" data-apagar>Apagar</button></div>`;
        if (p.tem_miniatura) aplicarMiniatura(c.querySelector('.img'), `/projetos/${p.id}/miniatura`);
        c.querySelector('[data-abrir]').onclick = e => ocupado(e.target, async () => {
            await abrirDaNuvem(p);
            fecharCentral();
            toast(`Projeto "${p.titulo}" aberto.`);
        });
        const comp = c.querySelector('[data-comp]');
        if (comp) {
            comp.onclick = () => ocupado(comp, async () => {
                await compartilhar(p.id, !p.compartilhado);
                toast(p.compartilhado ? 'Agora o projeto é privado.' : 'Projeto compartilhado com todas as turmas!');
                abaMeus(conteudo);
            });
        }
        const apagar = c.querySelector('[data-apagar]');
        apagar.onclick = () => {
            if (apagar.dataset.confirmar) {
                ocupado(apagar, async () => {
                    await apagarProjeto(p.id);
                    abaMeus(conteudo);
                });
            } else {
                apagar.dataset.confirmar = '1';
                apagar.textContent = 'Confirmar?';
                setTimeout(() => {
                    apagar.textContent = 'Apagar';
                    delete apagar.dataset.confirmar;
                }, 3500);
            }
        };
        grade.appendChild(c);
    });
};

const listaPaginada = (conteudo, {placeholder, extraBarra = '', caminho, chave, vazioHtml, cartao, ordem}) => {
    conteudo.innerHTML = `<div class="adv-barra"><input type="search" placeholder="${esc(placeholder)}" aria-label="Buscar">
      ${extraBarra}<button class="adv-btn primario" data-buscar>Buscar</button></div>
      <div class="adv-grade" data-grade></div><button class="adv-btn adv-mais" data-mais hidden>Carregar mais</button>`;
    const grade = conteudo.querySelector('[data-grade]');
    const mais = conteudo.querySelector('[data-mais]');
    const busca = conteudo.querySelector('input');
    let pagina = 1;
    const carregar = async (reiniciar) => {
        if (reiniciar) {
            pagina = 1;
            grade.innerHTML = '<p>Carregando…</p>';
        }
        const params = new URLSearchParams({q: busca.value, pagina});
        if (ordem) params.set('ordem', conteudo.querySelector('select[data-ordem]').value);
        const r = await chamar(`${caminho}?${params}`);
        if (reiniciar) grade.innerHTML = '';
        if (!r[chave].length && pagina === 1) grade.innerHTML = vazioHtml;
        r[chave].forEach(item => grade.appendChild(cartao(item)));
        mais.hidden = !r.tem_mais;
        pagina += 1;
    };
    conteudo.querySelector('[data-buscar]').onclick = () => carregar(true);
    busca.addEventListener('keydown', e => {
        if (e.key === 'Enter') carregar(true);
    });
    const sel = conteudo.querySelector('select[data-ordem]');
    if (sel) sel.onchange = () => carregar(true);
    mais.onclick = () => ocupado(mais, () => carregar(false));
    return carregar(true);
};

const abaExplorar = conteudo => listaPaginada(conteudo, {
    placeholder: 'Buscar projetos por nome, descrição ou autor…',
    caminho: '/explorar',
    chave: 'projetos',
    vazioHtml: vazio('🌎', 'Nenhum projeto compartilhado ainda. Seja o primeiro!'),
    cartao: p => {
        const c = document.createElement('div');
        c.className = 'adv-item';
        c.innerHTML = `<div class="img">🎮</div><div class="txt"><b>${esc(p.titulo)}</b>por ${esc(p.autor.nome)}
          ${p.meu ? '<span class="adv-etiqueta roxa">seu</span>' : ''}
          <div>${data(p.atualizado_em)}${p.visualizacoes ? ` · 👁 ${p.visualizacoes}` : ''}</div>
          ${p.descricao ? `<div style="margin-top:4px">${esc(p.descricao.slice(0, 120))}</div>` : ''}</div>
          <div class="acoes"><button class="primario" data-abrir>${p.meu ? 'Abrir' : 'Abrir e remixar'}</button>
          ${p.meu ? '' : '<button data-denunciar title="Denunciar">🚩</button>'}</div>`;
        if (p.tem_miniatura) aplicarMiniatura(c.querySelector('.img'), `/projetos/${p.id}/miniatura`);
        c.querySelector('[data-abrir]').onclick = e => ocupado(e.target, async () => {
            await abrirDaNuvem(p);
            fecharCentral();
            toast(p.meu ? `Projeto "${p.titulo}" aberto.` :
                `Projeto de ${p.autor.nome} aberto. Ao salvar, vira um remix seu.`, 4500);
        });
        const den = c.querySelector('[data-denunciar]');
        if (den) den.onclick = () => formDenuncia(c, {projeto: p.id});
        return c;
    }
});

const selosModelo = m => `<span class="adv-etiqueta roxa">.${esc(m.formato)}</span>${
    m.animacoes ? `<span class="adv-etiqueta laranja">${m.animacoes} animações</span>` : ''}${
    m.texturas ? `<span class="adv-etiqueta verde">${m.texturas} texturas</span>` : ''}`;

const abaLoja = conteudo => listaPaginada(conteudo, {
    placeholder: 'Buscar modelos (ex.: árvore, carro, personagem)…',
    extraBarra: '<select data-ordem aria-label="Ordem"><option value="novos">Mais novos</option>' +
        '<option value="populares">Mais usados</option></select>',
    ordem: true,
    caminho: '/modelos',
    chave: 'modelos',
    vazioHtml: vazio('🧩', 'A loja ainda está vazia. Publique o primeiro modelo na aba <b>Publicar modelo</b>!'),
    cartao: m => {
        const c = document.createElement('div');
        c.className = 'adv-item modelo';
        c.innerHTML = `<div class="img">🧊</div><div class="txt"><b>${esc(m.titulo)}</b>por ${esc(m.autor.nome)}
          <div>${selosModelo(m)}</div>
          <div title="Licença">📜 ${esc(m.licenca_nome)}${m.credito ? ` – ${esc(m.credito)}` : ''}</div>
          <div>⬇ usado ${m.downloads}× · ${mb(m.tamanho)}</div>
          ${m.descricao ? `<div style="margin-top:4px">${esc(m.descricao.slice(0, 120))}</div>` : ''}</div>
          <div class="acoes"><button class="primario" data-usar>Adicionar ao projeto</button>
          ${m.meu ? '' : '<button data-denunciar title="Denunciar">🚩</button>'}</div>`;
        if (m.tem_miniatura) aplicarMiniatura(c.querySelector('.img'), `/modelos/${m.id}/miniatura`);
        c.querySelector('[data-usar]').onclick = e => ocupado(e.target, async () => {
            const nome = await adicionarModeloDaLoja(m);
            toast(`"${nome}" foi adicionado ao projeto. Use o bloco "criar modelo … chamado …" na categoria 3D.`, 5000);
        });
        const den = c.querySelector('[data-denunciar]');
        if (den) den.onclick = () => formDenuncia(c, {modelo: m.id});
        return c;
    }
});

const abaMeusModelos = async conteudo => {
    conteudo.innerHTML = '<div class="adv-grade" data-grade><p>Carregando…</p></div>';
    const {modelos} = await chamar('/modelos/meus');
    const grade = conteudo.querySelector('[data-grade]');
    if (!modelos.length) {
        grade.outerHTML = vazio('📦', 'Você ainda não publicou modelos. Use a aba <b>Publicar modelo</b>.');
        return;
    }
    grade.innerHTML = '';
    const nomes = {publicado: ['verde', 'publicado'], pendente: ['laranja', 'aguardando aprovação'],
        oculto: ['vermelha', 'oculto pela moderação']};
    modelos.forEach(m => {
        const [cor, rotulo] = nomes[m.situacao];
        const c = document.createElement('div');
        c.className = 'adv-item modelo';
        c.innerHTML = `<div class="img">🧊</div><div class="txt"><b>${esc(m.titulo)}</b>
          <span class="adv-etiqueta ${cor}">${rotulo}</span><div>${selosModelo(m)}</div>
          <div>⬇ usado ${m.downloads}× · publicado em ${data(m.criado_em)}</div>
          ${m.nota_moderacao ? `<div style="color:#991B1B">Moderação: ${esc(m.nota_moderacao)}</div>` : ''}</div>
          <div class="acoes"><button class="perigo" data-apagar>Remover da loja</button></div>`;
        if (m.tem_miniatura) aplicarMiniatura(c.querySelector('.img'), `/modelos/${m.id}/miniatura`);
        const b = c.querySelector('[data-apagar]');
        b.onclick = () => {
            if (!b.dataset.confirmar) {
                b.dataset.confirmar = '1';
                b.textContent = 'Confirmar?';
                return;
            }
            ocupado(b, async () => {
                await chamar(`/modelos/${m.id}/apagar`, {body: {}});
                abaMeusModelos(conteudo);
            });
        };
        grade.appendChild(c);
    });
};

const abaPublicar = async (conteudo, modeloInicial) => {
    const nomes = getModelNames();
    if (!nomes.length) {
        conteudo.innerHTML = vazio('⬆️', 'Primeiro importe um modelo no projeto: categoria <b>3D</b> → ' +
            '<b>Importar modelo 3D…</b>. Depois volte aqui para publicar.');
        return;
    }
    const {licencas} = await chamar('/modelos?pagina=999');
    conteudo.innerHTML = `<form class="adv-form" novalidate>
      <div class="adv-msg-erro" hidden></div>
      <label class="adv-campo"><span>Modelo do projeto</span><select name="modelo">${
    nomes.map(n => `<option${n === modeloInicial ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>
        <small data-info></small></label>
      <label class="adv-campo"><span>Nome na loja</span><input name="titulo" maxlength="80" required></label>
      <label class="adv-campo"><span>Descrição</span><textarea name="descricao" rows="2" maxlength="1000"
        placeholder="O que é, para que serve, tem animações…"></textarea></label>
      <label class="adv-campo"><span>Licença</span><select name="licenca">
        <option value="">Escolha…</option>${licencas.map(l => `<option value="${esc(l.id)}">${esc(l.nome)}</option>`).join('')}
      </select></label>
      <label class="adv-campo"><span>Autor original / crédito</span><input name="credito" maxlength="160"
        placeholder="Obrigatório se o modelo não foi feito por você"></label>
      <label class="adv-campo"><span>Etiquetas</span><input name="tags" maxlength="160" placeholder="ex.: personagem, animal, cenário"></label>
      <div class="adv-regras"><b>Regras da loja</b><br>
        • A loja é vista por <b>todas as turmas</b>. Publique só modelos adequados para a escola.<br>
        • Só publique o que você criou ou que tem licença livre / permissão do autor.<br>
        • <b>Não</b> publique personagens ou modelos tirados de jogos, filmes ou desenhos de outras empresas.
          Você pode usá-los nos seus próprios projetos, mas não na loja.<br>
        • Modelos que quebrarem as regras são removidos pela moderação.</div>
      <label class="adv-check"><input type="checkbox" name="confirmo">
        <span>Eu criei este modelo ou tenho permissão para compartilhá-lo, e ele segue as regras acima.</span></label>
      <button class="adv-btn primario" type="submit">Publicar na loja</button>
    </form>`;
    const form = conteudo.querySelector('form');
    const atualizar = () => {
        const m = getModel(form.modelo.value);
        form.titulo.value = m ? m.name : '';
        conteudo.querySelector('[data-info]').textContent = m ?
            `.${m.ext} · ${Object.keys(m.resources || {}).length} arquivo(s) de textura` : '';
    };
    form.modelo.onchange = atualizar;
    atualizar();
    form.onsubmit = async e => {
        e.preventDefault();
        mostrarErro(conteudo, null);
        const d = Object.fromEntries(new FormData(form).entries());
        d.confirmo = form.confirmo.checked;
        try {
            await ocupado(form.querySelector('[type=submit]'), () => publicarModelo(d));
            toast('Modelo publicado na loja! 🎉');
            irPara('meus-modelos');
        } catch (err) {
            mostrarErro(conteudo, err);
            conteudo.scrollTop = 0;
        }
    };
};

const RENDER = {
    'meus': abaMeus,
    'explorar': abaExplorar,
    'loja': abaLoja,
    'meus-modelos': abaMeusModelos,
    'publicar': abaPublicar
};

const irPara = (aba, extra) => {
    if (!central) return;
    central.querySelectorAll('button.aba').forEach(b => b.classList.toggle('ativa', b.dataset.aba === aba));
    const conteudo = central.querySelector('.conteudo');
    conteudo.scrollTop = 0;
    Promise.resolve(RENDER[aba](conteudo, extra)).catch(e => {
        conteudo.innerHTML = vazio('⚠️', esc(e.message));
    });
};

export const fecharCentral = () => {
    central = null;
    fecharTela();
};

/**
 * Abre a Central da nuvem e da loja.
 * @param {string} [aba] meus | explorar | loja | meus-modelos | publicar
 * @param {string} [extra] na aba publicar: nome do modelo já selecionado
 */
export const abrirCentral = (aba = 'meus', extra) => {
    if (obterEstado().fase !== 'ok') {
        toast('Entre na sua conta para usar a nuvem e a loja.');
        return;
    }
    injetarEstilo();
    const tela = abrirTela(`<div class="adv-central" role="document">
      <header>${ABAS.map(a => `<button class="aba" data-aba="${a.id}">${a.nome}</button>`).join('')}
        <button class="fechar" aria-label="Fechar" data-fechar>✕</button></header>
      <div class="conteudo"></div></div>`, 'suave');
    central = tela;
    tela.querySelector('[data-fechar]').onclick = fecharCentral;
    tela.addEventListener('mousedown', e => {
        if (e.target === tela) fecharCentral();
    });
    tela.querySelectorAll('button.aba').forEach(b => {
        b.onclick = () => irPara(b.dataset.aba);
    });
    irPara(aba, extra);
};

// ---------------------------------------------------------------- salvar

/** Botão "☁ Salvar": salva direto se já está na nuvem; senão pergunta nome e compartilhamento. */
export const salvarRapido = async () => {
    if (obterEstado().fase !== 'ok') {
        toast('Entre na sua conta para salvar na nuvem.');
        return;
    }
    if (jaEstaNaNuvem()) {
        try {
            await salvarNaNuvem();
            toast('Salvo na nuvem ✓', 2000);
        } catch (e) {
            toast(`Não foi possível salvar: ${e.message}`, 5000);
        }
        return;
    }
    abrirSalvar();
};

export const abrirSalvar = () => {
    injetarEstilo();
    const n = obterNuvem();
    const remix = !!n.remixDe;
    const tela = abrirTela(`<div class="adv-cartao">
      <div class="adv-faixa" style="background:linear-gradient(135deg,#6D4FC2,#4C97FF)"><div class="icone">☁️</div>
        <h1>Salvar na nuvem</h1><p>${remix ? 'Você vai salvar uma cópia (remix) só sua' : 'Acesse de qualquer computador da escola'}</p></div>
      <div class="adv-corpo"><div class="adv-msg-erro" hidden></div>
        <form novalidate>
          <label class="adv-campo"><span>Nome do projeto</span><input name="titulo" maxlength="80" required
            value="${esc(n.titulo || lerTitulo())}"></label>
          <label class="adv-campo"><span>Descrição (opcional)</span><textarea name="descricao" rows="2" maxlength="1000"
            placeholder="Como jogar, controles, créditos…"></textarea></label>
          <label class="adv-check"><input type="checkbox" name="compartilhar">
            <span><b>Compartilhar com todas as turmas</b><br><small>Qualquer aluno logado poderá abrir e fazer um remix.
            Não coloque dados pessoais no projeto. Você pode deixar privado de novo quando quiser.</small></span></label>
          <div class="adv-acoes"><button type="button" class="adv-btn" data-cancelar>Cancelar</button>
            <button class="adv-btn primario" type="submit">☁ Salvar</button></div>
        </form></div></div>`, 'suave');
    tela.querySelector('[data-cancelar]').onclick = fecharTela;
    const form = tela.querySelector('form');
    form.onsubmit = async e => {
        e.preventDefault();
        mostrarErro(tela, null);
        if (!form.titulo.value.trim()) {
            mostrarErro(tela, {message: 'Dê um nome ao projeto.', campo: 'titulo'});
            return;
        }
        try {
            await ocupado(form.querySelector('[type=submit]'), () => salvarNaNuvem({
                titulo: form.titulo.value.trim(), descricao: form.descricao.value, compartilhar: form.compartilhar.checked
            }));
            fecharTela();
            toast(form.compartilhar.checked ? 'Salvo e compartilhado com todas as turmas! 🌎' : 'Salvo na nuvem ✓');
        } catch (err) {
            mostrarErro(tela, err);
        }
    };
    form.titulo.focus();
};
