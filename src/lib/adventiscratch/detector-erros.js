/**
 * Detector de erros nos blocos do Adventiscratch.
 *
 * Analisa os scripts do ator/palco que está sendo editado e marca os blocos com problema:
 *  - erro  (vermelho): o código vai falhar ou fazer algo errado com certeza;
 *  - aviso (laranja):  provavelmente não é o que o aluno queria.
 * Cada bloco marcado brilha e ganha um símbolo ⚠ (passe o mouse para ler). Um contador no canto da área de
 * código lista os problemas; clicar num item leva até o bloco.
 */
import {getModel} from './model-store.js';

const ESTILO_ID = 'adventiscratch-detector-estilo';
const ANALISE_ATRASO_MS = 400;

// ---------------------------------------------------------------- leitura dos blocos da VM

const lerLiteral = (blocks, block, input) => {
    const entrada = block.inputs && block.inputs[input];
    if (!entrada) return {vazio: true};
    if (!entrada.block) return {vazio: true};
    if (entrada.block !== entrada.shadow) return {reporter: true}; // tem um bloco encaixado
    const sombra = blocks[entrada.block];
    if (!sombra || !sombra.fields) return {vazio: true};
    const campo = Object.values(sombra.fields)[0];
    return {literal: true, valor: campo ? campo.value : ''};
};

const entradaVazia = (block, input) => {
    const entrada = block.inputs && block.inputs[input];
    return !entrada || !entrada.block;
};

const campo = (block, nome) => (block.fields && block.fields[nome]) || null;

const NOMES_3D = ['NOME', 'A', 'B'];
const CRIA_3D = new Set(['adventiscratch3d_criarForma', 'adventiscratch3d_criarModelo',
    'adventiscratch3d_criarModeloURL']);
// blocos 3D que recebem um nome mas não exigem que o objeto exista (criam, apagam, consultam)
const NOME_LIVRE_3D = new Set([...CRIA_3D, 'adventiscratch3d_apagar', 'adventiscratch3d_existe']);

const CONDICOES = {
    control_if: ['CONDITION'],
    control_if_else: ['CONDITION'],
    control_wait_until: ['CONDITION'],
    control_repeat_until: ['CONDITION'],
    control_while: ['CONDITION'],
    operator_and: ['OPERAND1', 'OPERAND2'],
    operator_or: ['OPERAND1', 'OPERAND2'],
    operator_not: ['OPERAND'],
    adventiscratch_seSenao: ['COND']
};
const CORPOS = {
    control_if: 'SUBSTACK',
    control_if_else: 'SUBSTACK',
    control_forever: 'SUBSTACK',
    control_repeat: 'SUBSTACK',
    control_repeat_until: 'SUBSTACK'
};

const ESPECIAIS_CENARIO = new Set(['next backdrop', 'previous backdrop', 'random backdrop']);

/**
 * Junta informações do projeto inteiro (mensagens, objetos 3D criados) usadas pelas regras.
 * @param {Runtime} runtime runtime da VM
 * @returns {object} contexto
 */
const contextoProjeto = runtime => {
    const enviadas = new Set();
    const recebidas = new Set();
    const criados3d = new Set();
    let nomes3dDinamicos = false;
    for (const alvo of runtime.targets) {
        if (!alvo.isOriginal) continue;
        const blocks = alvo.blocks._blocks;
        for (const b of Object.values(blocks)) {
            if (b.opcode === 'event_whenbroadcastreceived') {
                const f = campo(b, 'BROADCAST_OPTION');
                if (f) recebidas.add(String(f.value).toLowerCase());
            } else if (b.opcode === 'event_broadcast' || b.opcode === 'event_broadcastandwait') {
                const lit = lerLiteral(blocks, b, 'BROADCAST_INPUT');
                if (lit.literal) enviadas.add(String(lit.valor).toLowerCase());
                else if (lit.reporter) enviadas.add('*');
            } else if (CRIA_3D.has(b.opcode)) {
                const lit = lerLiteral(blocks, b, 'NOME');
                if (lit.literal) criados3d.add(String(lit.valor));
                else nomes3dDinamicos = true;
            }
        }
    }
    return {enviadas, recebidas, criados3d, nomes3dDinamicos};
};

/**
 * Analisa os blocos de um alvo (ator ou palco).
 * @param {RenderedTarget} alvo alvo em edição
 * @param {Runtime} runtime runtime da VM
 * @returns {Array<{bloco: string, nivel: 'erro'|'aviso', msg: string}>} problemas
 */
export const analisar = (alvo, runtime) => {
    const problemas = [];
    const add = (bloco, nivel, msg) => problemas.push({bloco, nivel, msg});
    const blocks = alvo.blocks._blocks;
    const ctx = contextoProjeto(runtime);
    const definicoes = new Set();
    for (const b of Object.values(blocks)) {
        if (b.opcode === 'procedures_prototype' && b.mutation) definicoes.add(b.mutation.proccode);
    }
    const fantasias = new Set(alvo.getCostumes().map(c => c.name));
    const sons = new Set(alvo.getSounds().map(s => s.name));
    const palco = runtime.getTargetForStage();
    const cenarios = new Set(palco ? palco.getCostumes().map(c => c.name) : []);

    for (const [id, b] of Object.entries(blocks)) {
        if (b.shadow) continue;
        const op = b.opcode;

        // scripts soltos (não começam com um bloco de evento)
        // (avisa só pilhas com mais de um bloco: um bloco sozinho costuma ser só um teste ou rascunho)
        const temConteudo = b.next || (b.inputs && b.inputs.SUBSTACK && b.inputs.SUBSTACK.block);
        if (b.topLevel && temConteudo && !runtime.getIsHat(op) && op !== 'procedures_definition') {
            add(id, 'aviso', 'Este script não começa com um bloco de evento (ex.: "quando ⚑ for clicado"), ' +
                'então ele só roda se você clicar nele.');
        }

        // condições vazias
        (CONDICOES[op] || []).forEach(input => {
            if (entradaVazia(b, input)) {
                add(id, 'erro', 'Falta encaixar uma condição (um bloco hexagonal, como "tecla espaço pressionada?").');
            }
        });

        // "se" / "sempre" / "repita" sem nada dentro
        if (CORPOS[op] && entradaVazia(b, CORPOS[op])) {
            add(id, 'aviso', 'Este bloco está vazio: coloque outros blocos dentro dele.');
        }

        // divisão por zero
        if (op === 'operator_divide') {
            const d = lerLiteral(blocks, b, 'NUM2');
            if (d.literal && Number(d.valor) === 0 && String(d.valor).trim() !== '') {
                add(id, 'erro', 'Divisão por zero: o resultado vai ser "Infinity".');
            }
        }

        // variáveis e listas apagadas
        const fVar = campo(b, 'VARIABLE');
        if (fVar && fVar.id && !alvo.lookupVariableById(fVar.id)) {
            add(id, 'erro', `A variável "${fVar.value}" não existe mais. Escolha outra ou crie de novo.`);
        }
        const fLista = campo(b, 'LIST');
        if (fLista && fLista.id && !alvo.lookupVariableById(fLista.id)) {
            add(id, 'erro', `A lista "${fLista.value}" não existe mais. Escolha outra ou crie de novo.`);
        }

        // bloco personalizado sem definição
        if (op === 'procedures_call' && b.mutation && !definicoes.has(b.mutation.proccode)) {
            add(id, 'erro', `O bloco "${b.mutation.proccode.replace(/%[sbn]/g, '( )')}" não tem definição ` +
                'neste ator. Crie o bloco em "Meus Blocos" ou apague esta chamada.');
        }

        // fantasias, cenários e sons que não existem
        if (op === 'looks_switchcostumeto') {
            const c = lerLiteral(blocks, b, 'COSTUME');
            if (c.literal && c.valor && !fantasias.has(c.valor)) {
                add(id, 'erro', `A fantasia "${c.valor}" não existe neste ator.`);
            }
        }
        if (op === 'looks_switchbackdropto' || op === 'looks_switchbackdroptoandwait') {
            const c = lerLiteral(blocks, b, 'BACKDROP');
            if (c.literal && c.valor && !ESPECIAIS_CENARIO.has(c.valor) && !cenarios.has(c.valor)) {
                add(id, 'erro', `O cenário "${c.valor}" não existe.`);
            }
        }
        if (op === 'sound_play' || op === 'sound_playuntildone') {
            const c = lerLiteral(blocks, b, 'SOUND_MENU');
            if (c.literal && c.valor && !sons.has(c.valor)) {
                add(id, 'erro', `O som "${c.valor}" não existe neste ator.`);
            }
        }

        // mensagens
        if (op === 'event_broadcast' || op === 'event_broadcastandwait') {
            const m = lerLiteral(blocks, b, 'BROADCAST_INPUT');
            if (m.literal && !ctx.recebidas.has(String(m.valor).toLowerCase())) {
                add(id, 'aviso', `Ninguém recebe a mensagem "${m.valor}". ` +
                    'Use "quando eu receber" em algum ator.');
            }
        }
        if (op === 'event_whenbroadcastreceived') {
            const f = campo(b, 'BROADCAST_OPTION');
            if (f && !ctx.enviadas.has('*') && !ctx.enviadas.has(String(f.value).toLowerCase())) {
                add(id, 'aviso', `A mensagem "${f.value}" nunca é enviada, então este script não vai rodar.`);
            }
        }

        // 3D
        if (op.startsWith('adventiscratch3d_')) {
            if (op === 'adventiscratch3d_criarModelo') {
                const m = lerLiteral(blocks, b, 'MODELO');
                if (m.literal && (!m.valor || !getModel(m.valor))) {
                    add(id, 'erro', m.valor ?
                        `O modelo "${m.valor}" não foi importado neste projeto.` :
                        'Escolha um modelo. Importe um com o botão "Importar modelo 3D…".');
                }
            }
            if (!NOME_LIVRE_3D.has(op) && !ctx.nomes3dDinamicos) {
                NOMES_3D.forEach(input => {
                    const n = lerLiteral(blocks, b, input);
                    if (n.literal && n.valor !== '' && !ctx.criados3d.has(String(n.valor))) {
                        add(id, 'aviso', `O objeto 3D "${n.valor}" nunca é criado no projeto ` +
                            '(use "criar … chamado …" com esse nome).');
                    }
                });
            }
        }
    }
    return problemas;
};

// ---------------------------------------------------------------- desenho no editor

const injetarEstilo = () => {
    if (document.getElementById(ESTILO_ID)) return;
    const st = document.createElement('style');
    st.id = ESTILO_ID;
    st.textContent = `
.adv-brilho-erro > .blocklyPath{filter:drop-shadow(0 0 3px #ff1f1f) drop-shadow(0 0 6px #ff1f1f)}
.adv-brilho-aviso > .blocklyPath{filter:drop-shadow(0 0 3px #ff9a00) drop-shadow(0 0 6px #ff9a00)}
.adv-brilho-pulsar > .blocklyPath{animation:adv-pulsar .5s ease-in-out 4 alternate}
@keyframes adv-pulsar{to{filter:drop-shadow(0 0 2px #fff) drop-shadow(0 0 14px #ff1f1f)}}
.adv-marca{cursor:help}
.adv-painel-erros{position:absolute;top:8px;right:64px;z-index:40;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;
  font-size:12px}
.adv-painel-erros > button{border:0;border-radius:999px;padding:5px 11px;font-weight:700;cursor:pointer;
  box-shadow:0 2px 6px rgba(0,0,0,.18);font-size:12px;color:#fff}
.adv-painel-erros > button.ok{background:#16A34A}
.adv-painel-erros > button.aviso{background:#EA8A00}
.adv-painel-erros > button.erro{background:#DC2626}
.adv-painel-erros ul{list-style:none;margin:6px 0 0;padding:6px;background:#fff;border-radius:12px;width:300px;
  max-height:300px;overflow:auto;box-shadow:0 10px 26px rgba(0,0,0,.25);position:absolute;right:0}
.adv-painel-erros li{padding:7px 8px;border-radius:8px;cursor:pointer;display:flex;gap:7px;line-height:1.35;
  color:#1E1B3A}
.adv-painel-erros li:hover{background:#F3F0FF}
.adv-painel-erros li i{font-style:normal;font-weight:900}
.adv-painel-erros li.erro i{color:#DC2626}
.adv-painel-erros li.aviso i{color:#EA8A00}
`;
    document.head.appendChild(st);
};

const SVG_NS = 'http://www.w3.org/2000/svg';

const criarMarca = (nivel, mensagens) => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'adv-marca');
    g.setAttribute('transform', 'translate(-10,-10)');
    const titulo = document.createElementNS(SVG_NS, 'title');
    titulo.textContent = mensagens.join('\n');
    const circulo = document.createElementNS(SVG_NS, 'circle');
    circulo.setAttribute('r', '11');
    circulo.setAttribute('fill', nivel === 'erro' ? '#DC2626' : '#EA8A00');
    circulo.setAttribute('stroke', '#fff');
    circulo.setAttribute('stroke-width', '2');
    const texto = document.createElementNS(SVG_NS, 'text');
    texto.setAttribute('text-anchor', 'middle');
    texto.setAttribute('y', '5');
    texto.setAttribute('fill', '#fff');
    texto.setAttribute('font-size', '14');
    texto.setAttribute('font-weight', '900');
    texto.setAttribute('font-family', 'Arial, sans-serif');
    texto.textContent = '!';
    g.append(titulo, circulo, texto);
    return g;
};

let workspace = null;
let vmAtual = null;
let painel = null;
let painelAberto = false;
let ultimos = [];
let timer = null;

const limparMarcas = () => {
    if (!workspace) return;
    const svg = workspace.getParentSvg();
    svg.querySelectorAll('.adv-marca').forEach(m => m.remove());
    svg.querySelectorAll('.adv-brilho-erro,.adv-brilho-aviso').forEach(el => {
        el.classList.remove('adv-brilho-erro', 'adv-brilho-aviso');
    });
};

const irParaBloco = id => {
    if (!workspace) return;
    const bloco = workspace.getBlockById(id);
    if (!bloco) return;
    workspace.centerOnBlock(id);
    const raiz = bloco.getSvgRoot();
    raiz.classList.remove('adv-brilho-pulsar');
    // força o reinício da animação
    raiz.getBoundingClientRect();
    raiz.classList.add('adv-brilho-pulsar');
    setTimeout(() => raiz.classList.remove('adv-brilho-pulsar'), 2200);
};

const desenharPainel = problemas => {
    if (!workspace) return;
    const host = workspace.getParentSvg().parentNode;
    if (!painel || painel.parentNode !== host) {
        if (painel) painel.remove();
        painel = document.createElement('div');
        painel.className = 'adv-painel-erros';
        host.appendChild(painel);
    }
    const erros = problemas.filter(p => p.nivel === 'erro').length;
    const avisos = problemas.length - erros;
    let classe = 'ok';
    let rotulo = '✓ Nenhum problema';
    if (problemas.length) {
        classe = erros ? 'erro' : 'aviso';
        const partes = [];
        if (erros) partes.push(`${erros} erro${erros > 1 ? 's' : ''}`);
        if (avisos) partes.push(`${avisos} aviso${avisos > 1 ? 's' : ''}`);
        rotulo = `⚠ ${partes.join(', ')}`;
    } else {
        painelAberto = false;
    }
    painel.innerHTML = '';
    const botao = document.createElement('button');
    botao.className = classe;
    botao.textContent = rotulo;
    botao.title = problemas.length ? 'Ver os problemas encontrados nos blocos' : 'O detector não encontrou problemas';
    botao.onclick = () => {
        painelAberto = !painelAberto && problemas.length > 0;
        desenharPainel(ultimos);
    };
    painel.appendChild(botao);
    if (painelAberto) {
        const lista = document.createElement('ul');
        problemas.forEach(p => {
            const li = document.createElement('li');
            li.className = p.nivel;
            const icone = document.createElement('i');
            icone.textContent = '⚠';
            const texto = document.createElement('span');
            texto.textContent = p.msg;
            li.append(icone, texto);
            li.onclick = () => irParaBloco(p.bloco);
            lista.appendChild(li);
        });
        painel.appendChild(lista);
    }
};

const marcar = problemas => {
    limparMarcas();
    if (!workspace) return;
    const porBloco = new Map();
    problemas.forEach(p => {
        const atual = porBloco.get(p.bloco) || {nivel: 'aviso', msgs: []};
        if (p.nivel === 'erro') atual.nivel = 'erro';
        atual.msgs.push(p.msg);
        porBloco.set(p.bloco, atual);
    });
    porBloco.forEach(({nivel, msgs}, id) => {
        const bloco = workspace.getBlockById(id);
        if (!bloco) return;
        const raiz = bloco.getSvgRoot();
        raiz.classList.add(nivel === 'erro' ? 'adv-brilho-erro' : 'adv-brilho-aviso');
        raiz.appendChild(criarMarca(nivel, msgs));
    });
};

/** Roda a análise agora (depois de um pequeno atraso para o editor terminar de desenhar). */
export const analisarAgora = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
        if (!vmAtual || !workspace || !vmAtual.editingTarget) return;
        try {
            ultimos = analisar(vmAtual.editingTarget, vmAtual.runtime);
        } catch (e) {
            console.warn('Adventiscratch: erro no detector de erros', e); // eslint-disable-line no-console
            ultimos = [];
        }
        injetarEstilo();
        marcar(ultimos);
        desenharPainel(ultimos);
    }, ANALISE_ATRASO_MS);
};

/** Problemas encontrados na última análise (usado em testes e depuração). */
export const ultimosProblemas = () => ultimos;

/**
 * Liga o detector à VM.
 * @param {VirtualMachine} vm VM do Scratch
 */
export const iniciarDetector = vm => {
    vmAtual = vm;
    vm.on('PROJECT_CHANGED', analisarAgora);
    vm.on('workspaceUpdate', analisarAgora);
    vm.on('targetsUpdate', analisarAgora);
};

/**
 * Informa a área de blocos (chamado pelo container de blocos do editor).
 * @param {object} ws workspace do scratch-blocks
 */
export const definirWorkspaceDetector = ws => {
    workspace = ws;
    ws.addChangeListener(e => {
        // ao arrastar, o scratch-blocks redesenha os blocos: refaz as marcas no fim
        if (e.type === 'move' || e.type === 'endDrag' || e.type === 'change') analisarAgora();
    });
    analisarAgora();
};
