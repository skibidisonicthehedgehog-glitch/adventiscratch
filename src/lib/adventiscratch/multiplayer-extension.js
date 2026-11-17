/**
 * Extensão "Servidor Multiplayer" (só para membros): jogos online com salas no servidor do Adventiscratch.
 *
 * Conecta por WebSocket em <api>/multiplayer usando a conta do aluno. Numa sala, cada jogador pode:
 *  - mandar mensagens (com um dado) para todos ou para um jogador;
 *  - mudar variáveis da sala (todos veem o mesmo valor);
 *  - ter o seu próprio estado ("meu x", "minha vida"…) que os outros leem, e compartilhar a posição de um ator.
 */
import {apiBase, lerToken} from './conta/api.js';

const A = {NUMBER: 'number', STRING: 'string'};
const B = {COMMAND: 'command', REPORTER: 'reporter', BOOLEAN: 'Boolean', HAT: 'hat'};
export const ID_MULTI = 'adventiscratchmulti';
const PREFIXO = `${ID_MULTI}_`;
const ENVIO_POSICAO_MS = 50; // até 20 atualizações de posição por segundo

const icone = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
<circle cx="20" cy="20" r="19" fill="#fff"/>
<circle cx="20" cy="20" r="10" fill="none" stroke="#0FA88C" stroke-width="2"/>
<path d="M10 20 h20 M20 10 c-5 6 -5 14 0 20 M20 10 c5 6 5 14 0 20" fill="none" stroke="#0FA88C" stroke-width="1.6"/>
<circle cx="9" cy="11" r="4" fill="#FF8C1A" stroke="#fff" stroke-width="1.2"/>
<circle cx="31" cy="11" r="4" fill="#9966FF" stroke="#fff" stroke-width="1.2"/>
<circle cx="20" cy="33" r="4" fill="#4C97FF" stroke="#fff" stroke-width="1.2"/>
</svg>`)}`;

const num = (v, p = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : p;
};

/** Valor que vai pela rede: números continuam números; o resto vira texto. */
const valorRede = v => {
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    const s = String(v);
    const n = Number(s);
    return s.trim() !== '' && Number.isFinite(n) && String(n) === s ? n : s;
};

const avisar = texto => window.dispatchEvent(new CustomEvent('adventiscratch-aviso', {detail: {texto}}));

class AdventiscratchMultiplayer {
    constructor (runtime) {
        this.runtime = runtime;
        runtime.adventiscratchMulti = this; // acesso pelo console (F12)
        this.ws = null;
        this.status = 'desconectado'; // desconectado | conectando | conectado | na sala
        this.erro = '';
        this.eu = null;
        this.sala = '';
        this.jogadores = new Map(); // id -> {id, nome, usuario, estado}
        this.variaveis = {};
        this.fila = [];
        this.ultimo = {nome: '', dado: '', de: '', deNome: '', jogador: ''};
        this.posicao = null; // {alvoId, enviado: {}, quando}
        runtime.on('PROJECT_STOP_ALL', () => this.desconectar());
        runtime.on('PROJECT_LOADED', () => this.desconectar());
        const passoOriginal = runtime._step.bind(runtime);
        runtime._step = () => {
            try {
                this._despachar();
                this._enviarPosicao();
            } catch (e) {
                console.warn('Adventiscratch: erro no multiplayer', e); // eslint-disable-line no-console
            }
            passoOriginal();
        };
    }

    // ---------------------------------------------------------------- conexão
    _url () {
        const base = apiBase();
        if (!base) return null;
        const u = new URL(`${base}/multiplayer`, window.location.href);
        u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
        u.searchParams.set('token', lerToken() || '');
        return u.toString();
    }

    _conectar () {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }
        const url = this._url();
        if (!url) {
            this._falhar('O multiplayer precisa do servidor do Adventiscratch (as contas estão desligadas aqui).');
            return;
        }
        if (!lerToken()) {
            this._falhar('Só membros podem jogar online: entre na sua conta.');
            return;
        }
        this.status = 'conectando';
        this.erro = '';
        let ws;
        try {
            ws = new WebSocket(url);
        } catch (e) {
            this._falhar('Não foi possível conectar ao servidor multiplayer.');
            return;
        }
        this.ws = ws;
        ws.onmessage = ev => {
            let dados;
            try {
                dados = JSON.parse(ev.data);
            } catch (e) {
                return;
            }
            this._receber(dados);
        };
        ws.onclose = () => {
            if (this.ws !== ws) return;
            this.ws = null;
            const estava = this.status === 'na sala';
            this.status = 'desconectado';
            this.sala = '';
            this.jogadores.clear();
            if (estava) this.fila.push({tipo: 'desconectou'});
            if (estava && !this.erro) this.erro = 'A conexão caiu.';
        };
        ws.onerror = () => {
            if (this.ws === ws && !this.erro) this.erro = 'Não foi possível conectar ao servidor multiplayer.';
        };
    }

    _falhar (motivo) {
        this.erro = motivo;
        this.status = 'desconectado';
        avisar(`🌐 ${motivo}`);
    }

    _mandar (dados) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(dados));
    }

    desconectar () {
        this.posicao = null;
        if (this.ws) {
            const ws = this.ws;
            this.ws = null;
            try {
                ws.close();
            } catch (e) { /* já fechou */ }
        }
        this.status = 'desconectado';
        this.sala = '';
        this.jogadores.clear();
        this.variaveis = {};
        this.fila = [];
    }

    _receber (d) {
        switch (d.t) {
        case 'ola':
            this.eu = d.eu;
            this.status = 'conectado';
            if (this._salaPedida) this._mandar({t: 'entrar', sala: this._salaPedida, max: this._maxPedido});
            break;
        case 'entrou':
            this.status = 'na sala';
            this.sala = d.sala;
            this.eu = d.eu;
            this.erro = '';
            this.jogadores = new Map(d.jogadores.map(j => [j.id, j]));
            this.variaveis = d.variaveis || {};
            this.fila.push({tipo: 'conectou'});
            break;
        case 'chegou':
            this.jogadores.set(d.jogador.id, d.jogador);
            this.fila.push({tipo: 'entrou', jogador: d.jogador.id, nome: d.jogador.nome});
            break;
        case 'saiu':
            if (this.eu && d.id === this.eu.id) {
                this.status = 'conectado';
                this.sala = '';
                this.jogadores.clear();
            } else {
                this.jogadores.delete(d.id);
                this.fila.push({tipo: 'saiu', jogador: d.id, nome: d.nome});
            }
            break;
        case 'msg':
            this.fila.push({tipo: 'msg', nome: d.nome, dado: d.dado, de: d.de, deNome: d.deNome});
            break;
        case 'var':
            this.variaveis[d.nome] = d.valor;
            this.fila.push({tipo: 'var', nome: d.nome, de: d.de});
            break;
        case 'estado': {
            const j = this.jogadores.get(d.id);
            if (j) Object.assign(j.estado, d.dados);
            break;
        }
        case 'erro':
            this.erro = d.motivo;
            avisar(`🌐 ${d.motivo}`);
            if (d.fatal) this._salaPedida = '';
            break;
        }
    }

    /** Dispara os chapéus. No máximo um evento de cada tipo por quadro, para nenhum se perder. */
    _despachar () {
        if (!this.fila.length) return;
        const vistos = new Set();
        const resto = [];
        for (const ev of this.fila) {
            const chave = ev.tipo === 'msg' || ev.tipo === 'var' ? `${ev.tipo}:${ev.nome}` : ev.tipo;
            if (vistos.has(chave)) {
                resto.push(ev);
                continue;
            }
            vistos.add(chave);
            this.ultimo = {
                nome: ev.nome || '', dado: ev.dado === undefined ? '' : ev.dado, de: ev.de || ev.jogador || '',
                deNome: ev.deNome || ev.nome || '', jogador: ev.jogador || ev.de || ''
            };
            const op = {conectou: 'quandoConectar', desconectou: 'quandoDesconectar', entrou: 'quandoEntrar',
                saiu: 'quandoSair', msg: 'quandoReceber', var: 'quandoVariavel'}[ev.tipo];
            // o chapéu é avaliado já dentro do startHats: ele lê o evento de this._atual
            this._atual = {...this.ultimo};
            const threads = this.runtime.startHats(PREFIXO + op) || [];
            for (const th of threads) th.adventiscratchMulti = this._atual;
            this._atual = null;
        }
        this.fila = resto;
    }

    _evento (util) {
        return (util && util.thread && util.thread.adventiscratchMulti) || this._atual || this.ultimo;
    }

    _enviarPosicao () {
        const p = this.posicao;
        if (!p || this.status !== 'na sala') return;
        const agora = performance.now();
        if (agora - p.quando < ENVIO_POSICAO_MS) return;
        const alvo = this.runtime.getTargetById(p.alvoId);
        if (!alvo) {
            this.posicao = null;
            return;
        }
        const atual = {
            x: Math.round(alvo.x * 10) / 10, y: Math.round(alvo.y * 10) / 10, direcao: alvo.direction,
            fantasia: alvo.getCostumes()[alvo.currentCostume].name, tamanho: Math.round(alvo.size), visivel: alvo.visible
        };
        const mudou = {};
        for (const k of Object.keys(atual)) {
            if (p.enviado[k] !== atual[k]) mudou[k] = atual[k];
        }
        if (Object.keys(mudou).length) {
            Object.assign(p.enviado, mudou);
            if (this.eu) {
                const eu = this.jogadores.get(this.eu.id);
                if (eu) Object.assign(eu.estado, mudou);
            }
            this._mandar({t: 'eu', dados: mudou});
        }
        p.quando = agora;
    }

    // ---------------------------------------------------------------- blocos
    getInfo () {
        return {
            id: ID_MULTI,
            name: 'Multiplayer',
            color1: '#0FA88C',
            color2: '#0C9178',
            color3: '#0A7562',
            menuIconURI: icone,
            blockIconURI: icone,
            blocks: [
                {
                    opcode: 'conectar', blockType: B.COMMAND, text: 'entrar na sala [SALA] (até [MAX] jogadores)',
                    arguments: {SALA: {type: A.STRING, defaultValue: 'minha sala'}, MAX: {type: A.NUMBER, defaultValue: 8}}
                },
                {opcode: 'sair', blockType: B.COMMAND, text: 'sair da sala'},
                {opcode: 'naSala', blockType: B.BOOLEAN, text: 'estou numa sala?'},
                {opcode: 'statusConexao', blockType: B.REPORTER, text: 'status da conexão'},
                {opcode: 'ultimoErro', blockType: B.REPORTER, text: 'último erro'},
                {opcode: 'nomeSala', blockType: B.REPORTER, text: 'nome da sala'},
                '---',
                {opcode: 'quandoConectar', blockType: B.HAT, isEdgeActivated: false, text: 'quando eu entrar na sala'},
                {opcode: 'quandoEntrar', blockType: B.HAT, isEdgeActivated: false, text: 'quando um jogador entrar'},
                {opcode: 'quandoSair', blockType: B.HAT, isEdgeActivated: false, text: 'quando um jogador sair'},
                {opcode: 'quandoDesconectar', blockType: B.HAT, isEdgeActivated: false, text: 'quando a conexão cair'},
                {opcode: 'jogadorEvento', blockType: B.REPORTER, text: 'id do jogador (do evento)'},
                '---',
                {opcode: 'meuId', blockType: B.REPORTER, text: 'meu id'},
                {opcode: 'meuNome', blockType: B.REPORTER, text: 'meu nome'},
                {opcode: 'quantos', blockType: B.REPORTER, text: 'quantidade de jogadores'},
                {
                    opcode: 'jogadorN', blockType: B.REPORTER, text: 'id do jogador número [N]',
                    arguments: {N: {type: A.NUMBER, defaultValue: 1}}
                },
                {
                    opcode: 'nomeJogador', blockType: B.REPORTER, text: 'nome do jogador [ID]',
                    arguments: {ID: {type: A.STRING, defaultValue: ''}}
                },
                {
                    opcode: 'jogadorExiste', blockType: B.BOOLEAN, text: 'jogador [ID] está na sala?',
                    arguments: {ID: {type: A.STRING, defaultValue: ''}}
                },
                {opcode: 'souPrimeiro', blockType: B.BOOLEAN, text: 'sou o anfitrião? (o primeiro da sala)'},
                '---',
                {
                    opcode: 'enviar', blockType: B.COMMAND, text: 'enviar mensagem [MSG] com [DADO] para todos',
                    arguments: {MSG: {type: A.STRING, defaultValue: 'pulo'}, DADO: {type: A.STRING, defaultValue: ''}}
                },
                {
                    opcode: 'enviarPara', blockType: B.COMMAND, text: 'enviar mensagem [MSG] com [DADO] para o jogador [ID]',
                    arguments: {
                        MSG: {type: A.STRING, defaultValue: 'oi'},
                        DADO: {type: A.STRING, defaultValue: ''},
                        ID: {type: A.STRING, defaultValue: ''}
                    }
                },
                {
                    opcode: 'quandoReceber', blockType: B.HAT, isEdgeActivated: false, text: 'quando receber mensagem [MSG]',
                    arguments: {MSG: {type: A.STRING, defaultValue: 'pulo'}}
                },
                {opcode: 'dadoRecebido', blockType: B.REPORTER, text: 'dado recebido'},
                {opcode: 'quemEnviou', blockType: B.REPORTER, text: 'id de quem enviou'},
                '---',
                {
                    opcode: 'definirVar', blockType: B.COMMAND, text: 'mudar variável da sala [NOME] para [VALOR]',
                    arguments: {NOME: {type: A.STRING, defaultValue: 'placar'}, VALOR: {type: A.STRING, defaultValue: '0'}}
                },
                {
                    opcode: 'variavel', blockType: B.REPORTER, text: 'variável da sala [NOME]',
                    arguments: {NOME: {type: A.STRING, defaultValue: 'placar'}}
                },
                {
                    opcode: 'quandoVariavel', blockType: B.HAT, isEdgeActivated: false,
                    text: 'quando a variável da sala [NOME] mudar',
                    arguments: {NOME: {type: A.STRING, defaultValue: 'placar'}}
                },
                '---',
                {
                    opcode: 'definirMeu', blockType: B.COMMAND, text: 'mudar meu [CHAVE] para [VALOR]',
                    arguments: {CHAVE: {type: A.STRING, defaultValue: 'vida'}, VALOR: {type: A.STRING, defaultValue: '3'}}
                },
                {
                    opcode: 'doJogador', blockType: B.REPORTER, text: '[CHAVE] do jogador [ID]',
                    arguments: {CHAVE: {type: A.STRING, defaultValue: 'x'}, ID: {type: A.STRING, defaultValue: ''}}
                },
                {
                    opcode: 'compartilharPosicao', blockType: B.COMMAND,
                    text: 'compartilhar a posição deste ator: [SIM]',
                    arguments: {SIM: {type: A.STRING, menu: 'simNao', defaultValue: 'sim'}}
                },
                {
                    opcode: 'imitar', blockType: B.COMMAND, text: 'ficar igual ao ator do jogador [ID]',
                    arguments: {ID: {type: A.STRING, defaultValue: ''}}
                }
            ],
            menus: {
                simNao: {acceptReporters: false, items: [{text: 'sim', value: 'sim'}, {text: 'não', value: 'nao'}]}
            }
        };
    }

    conectar (args, util) {
        const sala = String(args.SALA).trim().slice(0, 40);
        if (!util.stackFrame.pedido) {
            util.stackFrame.pedido = true;
            util.stackFrame.ate = performance.now() + 8000;
            if (!sala) {
                this._falhar('Escolha o nome da sala.');
                return;
            }
            if (this.status === 'na sala' && this.sala === sala) return;
            this._salaPedida = sala;
            this._maxPedido = Math.max(2, Math.min(50, Math.round(num(args.MAX, 8))));
            this.erro = '';
            if (this.status === 'conectado' || this.status === 'na sala') {
                this.status = 'conectado';
                this._mandar({t: 'entrar', sala, max: this._maxPedido});
            } else {
                this._conectar();
            }
            if (this.status === 'desconectado') return;
        }
        // espera entrar (ou dar erro), no máximo 8 s
        if (this.status === 'na sala' && this.sala === sala) return;
        if (this.erro || this.status === 'desconectado') return;
        if (performance.now() > util.stackFrame.ate) {
            this.erro = 'O servidor multiplayer não respondeu.';
            return;
        }
        util.yield();
    }

    sair () {
        this._salaPedida = '';
        this.posicao = null;
        this._mandar({t: 'sair'});
        this.status = this.ws ? 'conectado' : 'desconectado';
        this.sala = '';
        this.jogadores.clear();
        this.variaveis = {};
    }

    naSala () {
        return this.status === 'na sala';
    }

    statusConexao () {
        return this.status;
    }

    ultimoErro () {
        return this.erro;
    }

    nomeSala () {
        return this.sala;
    }

    quandoConectar () {
        return true;
    }

    quandoEntrar () {
        return true;
    }

    quandoSair () {
        return true;
    }

    quandoDesconectar () {
        return true;
    }

    jogadorEvento (args, util) {
        return this._evento(util).jogador;
    }

    meuId () {
        return this.eu ? this.eu.id : '';
    }

    meuNome () {
        return this.eu ? this.eu.nome : '';
    }

    quantos () {
        return this.status === 'na sala' ? this.jogadores.size : 0;
    }

    _lista () {
        return Array.from(this.jogadores.values());
    }

    jogadorN (args) {
        const j = this._lista()[Math.round(num(args.N, 1)) - 1];
        return j ? j.id : '';
    }

    nomeJogador (args) {
        const j = this.jogadores.get(String(args.ID));
        return j ? j.nome : '';
    }

    jogadorExiste (args) {
        return this.jogadores.has(String(args.ID));
    }

    souPrimeiro () {
        const primeiro = this._lista()[0];
        return Boolean(this.eu && primeiro && primeiro.id === this.eu.id);
    }

    enviar (args) {
        this._mandar({t: 'msg', nome: String(args.MSG), dado: valorRede(args.DADO)});
    }

    enviarPara (args) {
        this._mandar({t: 'msg', nome: String(args.MSG), dado: valorRede(args.DADO), para: String(args.ID)});
    }

    quandoReceber (args, util) {
        const ev = (util.thread && util.thread.adventiscratchMulti) || this._atual;
        return Boolean(ev) && ev.nome === String(args.MSG);
    }

    dadoRecebido (args, util) {
        return this._evento(util).dado;
    }

    quemEnviou (args, util) {
        return this._evento(util).de;
    }

    definirVar (args) {
        const nome = String(args.NOME);
        const valor = valorRede(args.VALOR);
        this.variaveis[nome] = valor;
        this._mandar({t: 'var', nome, valor});
    }

    variavel (args) {
        const v = this.variaveis[String(args.NOME)];
        return v === undefined ? '' : v;
    }

    quandoVariavel (args, util) {
        const ev = (util.thread && util.thread.adventiscratchMulti) || this._atual;
        return Boolean(ev) && ev.nome === String(args.NOME);
    }

    definirMeu (args) {
        const chave = String(args.CHAVE);
        const valor = valorRede(args.VALOR);
        if (this.eu) {
            const eu = this.jogadores.get(this.eu.id);
            if (eu) eu.estado[chave] = valor;
        }
        this._mandar({t: 'eu', dados: {[chave]: valor}});
    }

    doJogador (args) {
        const j = this.jogadores.get(String(args.ID));
        if (!j) return '';
        const v = j.estado[String(args.CHAVE)];
        return v === undefined ? '' : v;
    }

    compartilharPosicao (args, util) {
        if (args.SIM === 'nao') {
            this.posicao = null;
            return;
        }
        if (!util.target || util.target.isStage) return;
        this.posicao = {alvoId: util.target.id, enviado: {}, quando: 0};
    }

    /** Copia posição, direção, fantasia, tamanho e visibilidade compartilhados por outro jogador. */
    imitar (args, util) {
        const j = this.jogadores.get(String(args.ID));
        const t = util.target;
        if (!j || !t || t.isStage) return;
        const e = j.estado;
        if (e.x !== undefined && e.y !== undefined) t.setXY(num(e.x), num(e.y));
        if (e.direcao !== undefined) t.setDirection(num(e.direcao, 90));
        if (e.tamanho !== undefined) t.setSize(num(e.tamanho, 100));
        if (e.visivel !== undefined) t.setVisible(e.visivel !== false && e.visivel !== 'false');
        if (e.fantasia !== undefined) {
            const i = t.getCostumeIndexByName(String(e.fantasia));
            if (i >= 0) t.setCostume(i);
        }
    }
}

export {AdventiscratchMultiplayer};
