/**
 * Telas da conta: entrar/criar conta, suspensão (temporária, indefinida, permanente), advertência,
 * denúncia e "sem conexão". São camadas HTML por cima do editor (não dependem do React).
 */

const ESTILO_ID = 'adventiscratch-conta-estilo';
const MASCOTE = 'static/adventiscratch/mascote.svg';

export const esc = s => String(s === null || typeof s === 'undefined' ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

export const injetarEstilo = () => {
    if (document.getElementById(ESTILO_ID)) return;
    const st = document.createElement('style');
    st.id = ESTILO_ID;
    st.textContent = `
.adv-tela{position:fixed;inset:0;z-index:20000;display:flex;align-items:center;justify-content:center;
  padding:20px;overflow:auto;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;color:#1E1B3A;
  background:linear-gradient(135deg,#6D4FC2 0%,#5b6ff0 55%,#4C97FF 100%)}
.adv-tela.suave{background:rgba(30,27,58,.6)}
.adv-cartao{background:#fff;border-radius:22px;width:min(480px,100%);box-shadow:0 24px 60px rgba(0,0,0,.3);
  overflow:hidden;margin:auto}
.adv-cartao.largo{width:min(600px,100%)}
.adv-topo{padding:26px 28px 6px;text-align:center}
.adv-topo img{width:84px;height:auto}
.adv-topo h1{font-size:1.45rem;margin:10px 0 4px;font-weight:800}
.adv-topo p{margin:0;color:#4A4766}
.adv-corpo{padding:16px 28px 26px;font-size:.95rem;line-height:1.5}
.adv-abas{display:flex;background:#F1EEFB;border-radius:999px;padding:4px;margin:6px 0 16px}
.adv-abas button{flex:1;border:0;background:none;padding:9px;border-radius:999px;font-weight:700;cursor:pointer;
  color:#4A4766;font-size:.92rem}
.adv-abas button.ativa{background:#fff;color:#6D4FC2;box-shadow:0 2px 6px rgba(0,0,0,.08)}
.adv-campo{display:block;margin-bottom:12px}
.adv-campo span{display:block;font-weight:700;font-size:.85rem;margin-bottom:4px}
.adv-campo input,.adv-campo select,.adv-campo textarea{width:100%;box-sizing:border-box;padding:10px 12px;
  border:2px solid #E2DDF5;border-radius:12px;font-size:.95rem;font-family:inherit}
.adv-campo input:focus,.adv-campo select:focus,.adv-campo textarea:focus{outline:none;border-color:#6D4FC2}
.adv-campo small{color:#6B7280}
.adv-campo.erro input,.adv-campo.erro select,.adv-campo.erro textarea{border-color:#DC2626}
.adv-msg-erro{background:#FEE2E2;color:#991B1B;border-radius:10px;padding:9px 12px;margin-bottom:12px;
  font-size:.88rem}
.adv-msg-ok{background:#DCFCE7;color:#166534;border-radius:10px;padding:9px 12px;margin-bottom:12px;
  font-size:.88rem}
.adv-btn{border:0;border-radius:999px;padding:11px 18px;font-weight:800;cursor:pointer;font-size:.93rem;
  background:#EEF2F7;color:#1E1B3A}
.adv-btn.primario{background:#6D4FC2;color:#fff}
.adv-btn.perigo{background:#DC2626;color:#fff}
.adv-btn:disabled{opacity:.6;cursor:wait}
.adv-btn.cheio{width:100%}
.adv-acoes{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:16px}
.adv-faixa{padding:22px 28px;color:#fff;text-align:center}
.adv-faixa .icone{font-size:2.4rem;line-height:1}
.adv-faixa h1{margin:8px 0 2px;font-size:1.4rem;font-weight:800}
.adv-faixa p{margin:0;opacity:.95}
.adv-faixa.temporaria{background:linear-gradient(135deg,#F59E0B,#D97706)}
.adv-faixa.indefinida{background:linear-gradient(135deg,#8B5CF6,#6D28D9)}
.adv-faixa.permanente{background:linear-gradient(135deg,#B91C1C,#7F1D1D)}
.adv-faixa.advertencia{background:linear-gradient(135deg,#3B82F6,#1D4ED8)}
.adv-caixa{background:#F8F7FD;border:1px solid #ECE8F8;border-radius:14px;padding:12px 14px;margin:12px 0}
.adv-caixa b{display:block;font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;color:#6B6790;
  margin-bottom:3px}
.adv-contagem{display:flex;justify-content:center;gap:8px;margin:6px 0 2px}
.adv-contagem div{background:#FFF7E6;border:1px solid #FDE3B0;border-radius:12px;padding:8px 10px;min-width:58px;
  text-align:center}
.adv-contagem strong{display:block;font-size:1.5rem;color:#B45309}
.adv-contagem span{font-size:.72rem;color:#92400E;text-transform:uppercase}
.adv-pequeno{font-size:.82rem;color:#6B7280;text-align:center}
`;
    document.head.appendChild(st);
};

let telaAtual = null;

/** Remove a tela aberta (se houver). */
export const fecharTela = () => {
    if (telaAtual) {
        if (telaAtual._limpar) telaAtual._limpar();
        telaAtual.remove();
        telaAtual = null;
    }
};

export const abrirTela = (html, classe = '') => {
    injetarEstilo();
    fecharTela();
    const tela = document.createElement('div');
    tela.className = `adv-tela ${classe}`;
    tela.setAttribute('role', 'dialog');
    tela.setAttribute('aria-modal', 'true');
    tela.innerHTML = html;
    // a tela bloqueia o editor: impede atalhos de teclado de chegarem ao Scratch
    tela.addEventListener('keydown', e => e.stopPropagation());
    document.body.appendChild(tela);
    telaAtual = tela;
    return tela;
};

export const mostrarErro = (tela, erro) => {
    const caixa = tela.querySelector('.adv-msg-erro');
    tela.querySelectorAll('.adv-campo.erro').forEach(c => c.classList.remove('erro'));
    if (!erro) {
        if (caixa) caixa.hidden = true;
        return;
    }
    if (caixa) {
        caixa.textContent = erro.message;
        caixa.hidden = false;
    }
    if (erro.campo) {
        const campo = tela.querySelector(`[name="${erro.campo}"]`);
        if (campo) {
            const caixa = campo.closest('.adv-campo');
            if (caixa) caixa.classList.add('erro');
            campo.focus();
        }
    }
};

export const ocupado = async (botao, fn) => {
    const texto = botao.textContent;
    botao.disabled = true;
    botao.textContent = 'Aguarde…';
    try {
        return await fn();
    } finally {
        botao.disabled = false;
        botao.textContent = texto;
    }
};

// ---------------------------------------------------------------- entrar / criar conta

/**
 * @param {object} acoes {entrar(usuario, senha), registrar(dados), semConta?: function, aba?: 'entrar'|'criar'}
 */
export const telaLogin = acoes => {
    const tela = abrirTela(`
<div class="adv-cartao">
  <div class="adv-topo"><img src="${MASCOTE}" alt=""><h1>Bem-vindo ao Adventiscratch</h1>
    <p>Entre na sua conta para começar a criar.</p></div>
  <div class="adv-corpo">
    <div class="adv-abas" role="tablist">
      <button type="button" class="ativa" data-aba="entrar" role="tab">Entrar</button>
      <button type="button" data-aba="criar" role="tab">Criar conta</button>
    </div>
    <div class="adv-msg-erro" hidden></div>
    <form data-form="entrar">
      <label class="adv-campo"><span>Usuário</span>
        <input name="usuario" autocomplete="username" autocapitalize="none" required></label>
      <label class="adv-campo"><span>Senha</span>
        <input name="senha" type="password" autocomplete="current-password" required></label>
      <button class="adv-btn primario cheio" type="submit">Entrar</button>
      <p class="adv-pequeno" style="margin-top:12px">Esqueceu a senha? Peça ao seu professor para trocá-la.</p>
    </form>
    <form data-form="criar" hidden>
      <label class="adv-campo"><span>Código da turma</span>
        <input name="codigo_turma" autocapitalize="characters" required placeholder="Ex.: 7ANO-B-2026">
        <small>O seu professor passa este código.</small></label>
      <label class="adv-campo"><span>Seu nome</span>
        <input name="nome" maxlength="40" required placeholder="Pode ser só o primeiro nome">
        <small>Não use sobrenome completo nem outros dados pessoais.</small></label>
      <label class="adv-campo"><span>Nome de usuário</span>
        <input name="usuario" autocomplete="username" autocapitalize="none" required placeholder="ex.: ana.coruja">
        <small>Letras minúsculas, números, ponto, _ ou -.</small></label>
      <label class="adv-campo"><span>Senha</span>
        <input name="senha" type="password" autocomplete="new-password" required minlength="6">
        <small>Pelo menos 6 caracteres. Não use a mesma senha de outros sites.</small></label>
      <button class="adv-btn primario cheio" type="submit">Criar conta</button>
    </form>
    ${acoes.semConta ? '<div class="adv-acoes"><button class="adv-btn" data-sem-conta>Usar sem conta</button></div>' : ''}
  </div>
</div>`);
    tela.querySelectorAll('[data-aba]').forEach(aba => {
        aba.onclick = () => {
            tela.querySelectorAll('[data-aba]').forEach(a => a.classList.toggle('ativa', a === aba));
            tela.querySelectorAll('[data-form]').forEach(f => {
                f.hidden = f.dataset.form !== aba.dataset.aba;
            });
            mostrarErro(tela, null);
            const primeiro = tela.querySelector(`[data-form="${aba.dataset.aba}"] input`);
            if (primeiro) primeiro.focus();
        };
    });
    if (acoes.aba === 'criar') tela.querySelector('[data-aba="criar"]').click();
    const formEntrar = tela.querySelector('[data-form="entrar"]');
    formEntrar.onsubmit = async e => {
        e.preventDefault();
        mostrarErro(tela, null);
        const d = new FormData(formEntrar);
        try {
            await ocupado(formEntrar.querySelector('button'), () => acoes.entrar(d.get('usuario'), d.get('senha')));
        } catch (err) {
            mostrarErro(tela, err);
        }
    };
    const formCriar = tela.querySelector('[data-form="criar"]');
    formCriar.onsubmit = async e => {
        e.preventDefault();
        mostrarErro(tela, null);
        const d = Object.fromEntries(new FormData(formCriar).entries());
        try {
            await ocupado(formCriar.querySelector('button'), () => acoes.registrar(d));
        } catch (err) {
            mostrarErro(tela, err);
        }
    };
    const sem = tela.querySelector('[data-sem-conta]');
    if (sem) sem.onclick = () => acoes.semConta();
    tela.querySelector('input').focus();
};

// ---------------------------------------------------------------- suspensão

const formatarData = iso => new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
});

const TEXTOS = {
    temporaria: {
        icone: '⏳',
        titulo: 'Sua conta está suspensa',
        sub: 'Suspensão temporária'
    },
    indefinida: {
        icone: '⏸️',
        titulo: 'Sua conta está suspensa',
        sub: 'Até um moderador revisar o seu caso'
    },
    permanente: {
        icone: '⛔',
        titulo: 'Esta conta foi encerrada',
        sub: 'Suspensão permanente'
    }
};

const blocoRevisao = sancao => {
    const r = sancao.recurso;
    if (r && r.status === 'pendente') {
        return `<div class="adv-caixa"><b>Pedido de revisão</b>Seu pedido foi enviado em ${
            esc(formatarData(r.criado_em))} e está aguardando um moderador. Você vai ver a resposta aqui.</div>`;
    }
    let anterior = '';
    if (r && r.status === 'negado') {
        anterior = `<div class="adv-caixa"><b>Resposta ao seu pedido de revisão</b>${
            esc(r.resposta || 'A decisão foi mantida.')}</div>`;
    }
    if (!sancao.permite_recurso) {
        return `${anterior}<p class="adv-pequeno">Esta decisão é final e não pode ser revisada pelo site.
            Se tiver dúvidas, converse com o seu professor ou a coordenação.</p>`;
    }
    if (r && r.status === 'negado') return anterior;
    return `${anterior}<details style="margin-top:6px"><summary style="cursor:pointer;font-weight:700;color:#6D4FC2">
        Acha que foi um engano? Pedir revisão</summary>
      <div class="adv-msg-erro" hidden style="margin-top:10px"></div>
      <div class="adv-msg-ok" hidden style="margin-top:10px"></div>
      <label class="adv-campo" style="margin-top:10px"><span>Explique o que aconteceu</span>
        <textarea name="texto" rows="4" maxlength="2000" placeholder="Conte com calma e com respeito."></textarea></label>
      <button class="adv-btn primario" data-recurso>Enviar pedido de revisão</button></details>`;
};

/**
 * @param {object} situacao resposta de /api/eu
 * @param {object} acoes {baixarProjeto, sair, pedirRevisao(texto), atualizar}
 */
export const telaSuspensao = (situacao, acoes) => {
    const s = situacao.sancao;
    const t = TEXTOS[s.tipo] || TEXTOS.indefinida;
    const contagem = s.tipo === 'temporaria' && s.fim ? `
      <div class="adv-caixa" style="text-align:center"><b>Você poderá voltar em</b>
        <div class="adv-contagem" data-contagem>
          <div><strong data-d>0</strong><span>dias</span></div><div><strong data-h>0</strong><span>horas</span></div>
          <div><strong data-m>0</strong><span>min</span></div><div><strong data-s>0</strong><span>seg</span></div>
        </div><span class="adv-pequeno">${esc(formatarData(s.fim))}</span></div>` : '';
    const tela = abrirTela(`
<div class="adv-cartao largo">
  <div class="adv-faixa ${esc(s.tipo)}"><div class="icone" aria-hidden="true">${t.icone}</div>
    <h1>${t.titulo}</h1><p>${t.sub}</p></div>
  <div class="adv-corpo">
    <p style="margin:0 0 4px">Olá, <b>${esc(situacao.conta.nome)}</b>.
      ${s.tipo === 'permanente' ?
        'Um moderador encerrou esta conta e ela não poderá mais ser usada no Adventiscratch.' :
        'Um moderador suspendeu esta conta. Enquanto isso, o editor fica bloqueado.'}</p>
    <div class="adv-caixa"><b>Motivo</b>${esc(s.categoria_nome)}</div>
    <div class="adv-caixa"><b>Mensagem do moderador</b>${esc(s.mensagem).replace(/\n/g, '<br>')}</div>
    ${contagem}
    ${blocoRevisao(s)}
    <div class="adv-acoes">
      <button class="adv-btn" data-baixar>Baixar meu projeto (.asp)</button>
      <button class="adv-btn" data-sair>Sair da conta</button>
    </div>
    <p class="adv-pequeno" style="margin-top:12px">Suspensa em ${esc(formatarData(s.inicio))}.
      Criar outra conta para continuar usando também é motivo de suspensão.</p>
  </div>
</div>`, 'suave');
    tela.querySelector('[data-baixar]').onclick = () => acoes.baixarProjeto();
    tela.querySelector('[data-sair]').onclick = () => acoes.sair();
    const botaoRecurso = tela.querySelector('[data-recurso]');
    if (botaoRecurso) {
        botaoRecurso.onclick = async () => {
            const texto = tela.querySelector('textarea[name="texto"]').value;
            mostrarErro(tela, null);
            try {
                await ocupado(botaoRecurso, () => acoes.pedirRevisao(s.id, texto));
            } catch (err) {
                mostrarErro(tela, err);
            }
        };
    }
    // contagem regressiva
    if (contagem) {
        const fim = new Date(s.fim).getTime();
        // compensa diferença entre o relógio do computador e o do servidor
        const ajuste = new Date(situacao.agora).getTime() - Date.now();
        const atualizar = () => {
            let resta = Math.max(0, Math.floor((fim - (Date.now() + ajuste)) / 1000));
            if (resta === 0) {
                clearInterval(timer);
                acoes.atualizar();
            }
            const d = Math.floor(resta / 86400);
            resta -= d * 86400;
            const h = Math.floor(resta / 3600);
            resta -= h * 3600;
            const m = Math.floor(resta / 60);
            tela.querySelector('[data-d]').textContent = d;
            tela.querySelector('[data-h]').textContent = h;
            tela.querySelector('[data-m]').textContent = m;
            tela.querySelector('[data-s]').textContent = resta - (m * 60);
        };
        const timer = setInterval(atualizar, 1000);
        tela._limpar = () => clearInterval(timer);
        atualizar();
    }
};

// ---------------------------------------------------------------- advertência

export const telaAdvertencia = (adv, nome, onCiente) => {
    const tela = abrirTela(`
<div class="adv-cartao">
  <div class="adv-faixa advertencia"><div class="icone" aria-hidden="true">⚠️</div>
    <h1>Você recebeu uma advertência</h1><p>Sua conta continua funcionando normalmente</p></div>
  <div class="adv-corpo">
    <p style="margin:0">Olá, <b>${esc(nome)}</b>. Um moderador deixou um aviso para você:</p>
    <div class="adv-caixa"><b>Motivo</b>${esc(adv.categoria_nome)}</div>
    <div class="adv-caixa"><b>Mensagem do moderador</b>${esc(adv.mensagem).replace(/\n/g, '<br>')}</div>
    <p class="adv-pequeno">Se isso se repetir, a conta pode ser suspensa.</p>
    <div class="adv-acoes"><button class="adv-btn primario" data-ok>Li e entendi</button></div>
  </div>
</div>`, 'suave');
    const botao = tela.querySelector('[data-ok]');
    botao.onclick = () => ocupado(botao, onCiente);
    botao.focus();
};

// ---------------------------------------------------------------- sem conexão

export const telaSemConexao = (mensagem, onTentar) => {
    const tela = abrirTela(`
<div class="adv-cartao">
  <div class="adv-topo"><img src="${MASCOTE}" alt=""><h1>Sem conexão com o servidor</h1>
    <p>${esc(mensagem)}</p></div>
  <div class="adv-corpo">
    <p class="adv-pequeno">Confira a internet. Se você é o responsável pelo servidor, verifique se ele está ligado
      (em desenvolvimento: <code>python manage.py runserver</code> na pasta <code>server</code>).</p>
    <div class="adv-acoes"><button class="adv-btn primario" data-tentar>Tentar de novo</button></div>
  </div>
</div>`);
    const botao = tela.querySelector('[data-tentar]');
    botao.onclick = () => ocupado(botao, onTentar);
};

// ---------------------------------------------------------------- denúncia

export const telaDenuncia = (categorias, enviar) => {
    const tela = abrirTela(`
<div class="adv-cartao">
  <div class="adv-faixa indefinida"><div class="icone" aria-hidden="true">🚩</div>
    <h1>Denunciar um usuário</h1><p>Um moderador vai analisar com cuidado</p></div>
  <div class="adv-corpo">
    <div class="adv-msg-erro" hidden></div>
    <div class="adv-msg-ok" hidden></div>
    <form>
      <label class="adv-campo"><span>Nome de usuário de quem você quer denunciar</span>
        <input name="usuario" autocapitalize="none" required></label>
      <label class="adv-campo"><span>Motivo</span><select name="categoria" required>
        <option value="">Escolha…</option>
        ${categorias.map(c => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}
      </select></label>
      <label class="adv-campo"><span>O que aconteceu?</span>
        <textarea name="descricao" rows="4" maxlength="2000" required
          placeholder="Conte onde e quando aconteceu. Não precisa copiar palavrões."></textarea></label>
      <div class="adv-acoes">
        <button class="adv-btn" type="button" data-fechar>Cancelar</button>
        <button class="adv-btn primario" type="submit">Enviar denúncia</button>
      </div>
    </form>
    <p class="adv-pequeno">Se alguém estiver em perigo ou você se sentir ameaçado, avise também um professor
      ou um adulto de confiança.</p>
  </div>
</div>`, 'suave');
    tela.querySelector('[data-fechar]').onclick = fecharTela;
    tela.addEventListener('click', e => {
        if (e.target === tela) fecharTela();
    });
    const form = tela.querySelector('form');
    form.onsubmit = async e => {
        e.preventDefault();
        mostrarErro(tela, null);
        const d = Object.fromEntries(new FormData(form).entries());
        try {
            await ocupado(form.querySelector('[type="submit"]'), () => enviar(d));
            form.hidden = true;
            const ok = tela.querySelector('.adv-msg-ok');
            ok.textContent = 'Denúncia enviada. Obrigado por ajudar a manter o Adventiscratch seguro!';
            ok.hidden = false;
            setTimeout(fecharTela, 2500);
        } catch (err) {
            mostrarErro(tela, err);
        }
    };
    tela.querySelector('input').focus();
};
