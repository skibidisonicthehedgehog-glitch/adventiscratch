"""
Servidor Multiplayer do Adventiscratch (WebSocket em /api/multiplayer).

Só para membros: precisa de uma conta (token do editor) que não esteja suspensa.
As salas ficam na memória deste processo (por isso o servidor roda num processo só, com o Daphne).

Mensagens (JSON), do editor para o servidor:
  {"t": "entrar", "sala": "nome", "max": 8}          entra numa sala (sai da anterior)
  {"t": "sair"}                                       sai da sala
  {"t": "msg", "nome": "pulo", "dado": "...", "para": "id"?}   mensagem para todos (ou para um jogador)
  {"t": "var", "nome": "placar", "valor": "..."}      variável da sala (todos veem)
  {"t": "eu", "dados": {"x": 10, "y": 20}}           estado deste jogador (os outros veem)
  {"t": "ping"}
Do servidor para o editor:
  entrou {sala, eu, jogadores, variaveis} · chegou {jogador} · saiu {id} · msg {nome, dado, de}
  var {nome, valor, de} · estado {id, dados} · erro {motivo} · pong
"""
import json
import secrets
import time
from urllib.parse import parse_qs, urlparse

from asgiref.sync import sync_to_async
from django.conf import settings

# nome -> Sala
SALAS = {}


def _cfg(nome, padrao):
    return getattr(settings, nome, padrao)


def limpar_texto(v, limite):
    return str(v if v is not None else '')[:limite]


def limpar_valor(v):
    """Valores aceitos: número, booleano ou texto (curto)."""
    if isinstance(v, bool) or isinstance(v, (int, float)):
        return v
    return limpar_texto(v, _cfg('ADVENTISCRATCH_MULTI_MAX_TEXTO', 2000))


class Jogador:
    def __init__(self, usuario, nome, enviar):
        self.id = secrets.token_hex(3)
        self.usuario = usuario
        self.nome = nome
        self._enviar = enviar
        self.estado = {}
        self.sala = None
        self.entrou_em = time.time()
        # limite de mensagens por segundo (balde de fichas)
        self.fichas = float(_cfg('ADVENTISCRATCH_MULTI_MSG_SEG', 60)) * 2
        self.ultima_ficha = time.monotonic()

    def info(self):
        return {'id': self.id, 'nome': self.nome, 'usuario': self.usuario, 'estado': self.estado}

    def pode_enviar(self):
        por_seg = float(_cfg('ADVENTISCRATCH_MULTI_MSG_SEG', 60))
        agora = time.monotonic()
        self.fichas = min(por_seg * 2, self.fichas + ((agora - self.ultima_ficha) * por_seg))
        self.ultima_ficha = agora
        if self.fichas < 1:
            return False
        self.fichas -= 1
        return True

    async def enviar(self, dados):
        try:
            await self._enviar({'type': 'websocket.send', 'text': json.dumps(dados, ensure_ascii=False)})
        except Exception:  # noqa: BLE001 - conexão já fechada
            pass


class Sala:
    def __init__(self, nome, maximo):
        self.nome = nome
        self.maximo = maximo
        self.jogadores = {}
        self.variaveis = {}
        self.criada_em = time.time()

    async def para_todos(self, dados, menos=None):
        for j in list(self.jogadores.values()):
            if j is not menos:
                await j.enviar(dados)


def resumo_salas():
    """Para o painel de moderação."""
    return [{
        'sala': s.nome,
        'jogadores': [{'nome': j.nome, 'usuario': j.usuario} for j in s.jogadores.values()],
        'variaveis': len(s.variaveis),
        'criada_em': s.criada_em,
    } for s in SALAS.values()]


def _autenticar(chave):
    """(usuario, nome, motivo_da_recusa)"""
    from contas.models import TokenAcesso, sancao_atual
    if not chave:
        return None, None, 'Só membros podem jogar online: entre na sua conta.'
    usuario = TokenAcesso.usuario_da_chave(chave)
    if not usuario:
        return None, None, 'Sua sessão expirou. Entre de novo.'
    if sancao_atual(usuario):
        return None, None, 'Sua conta está suspensa.'
    perfil = getattr(usuario, 'perfil', None)
    nome = perfil.nome_exibicao if perfil else usuario.username
    return usuario.username, nome, None


def _origem_permitida(scope):
    cabecalhos = dict(scope.get('headers') or [])
    origem = cabecalhos.get(b'origin', b'').decode('latin-1')
    if not origem:
        return True
    if origem in _cfg('ADVENTISCRATCH_ORIGENS', []):
        return True
    host = cabecalhos.get(b'host', b'').decode('latin-1')
    return urlparse(origem).netloc == host


async def _sair_da_sala(j):
    sala = j.sala
    if not sala:
        return
    sala.jogadores.pop(j.id, None)
    j.sala = None
    if sala.jogadores:
        await sala.para_todos({'t': 'saiu', 'id': j.id, 'nome': j.nome})
    else:
        SALAS.pop(sala.nome, None)


async def _entrar(j, dados):
    nome = limpar_texto(dados.get('sala'), 40).strip()
    if not nome:
        return await j.enviar({'t': 'erro', 'motivo': 'Escolha o nome da sala.'})
    await _sair_da_sala(j)
    sala = SALAS.get(nome)
    if not sala:
        if len(SALAS) >= _cfg('ADVENTISCRATCH_MULTI_MAX_SALAS', 200):
            return await j.enviar({'t': 'erro', 'motivo': 'O servidor está cheio. Tente mais tarde.'})
        try:
            maximo = int(dados.get('max') or 0)
        except (TypeError, ValueError):
            maximo = 0
        limite = _cfg('ADVENTISCRATCH_MULTI_MAX_JOGADORES', 20)
        sala = Sala(nome, max(2, min(limite, maximo or limite)))
        SALAS[nome] = sala
    if len(sala.jogadores) >= sala.maximo:
        return await j.enviar({'t': 'erro', 'motivo': f'A sala "{nome}" está cheia ({sala.maximo} jogadores).'})
    j.estado = {}
    sala.jogadores[j.id] = j
    j.sala = sala
    await j.enviar({
        't': 'entrou', 'sala': sala.nome, 'max': sala.maximo, 'eu': j.info(),
        'jogadores': [x.info() for x in sala.jogadores.values()],
        'variaveis': sala.variaveis,
    })
    await sala.para_todos({'t': 'chegou', 'jogador': j.info()}, menos=j)


async def _tratar(j, dados):
    t = dados.get('t')
    if t == 'ping':
        return await j.enviar({'t': 'pong'})
    if t == 'entrar':
        return await _entrar(j, dados)
    if t == 'sair':
        await _sair_da_sala(j)
        return await j.enviar({'t': 'saiu', 'id': j.id, 'nome': j.nome})
    sala = j.sala
    if not sala:
        return None
    if t == 'msg':
        envio = {'t': 'msg', 'nome': limpar_texto(dados.get('nome'), 100), 'dado': limpar_valor(dados.get('dado')),
                 'de': j.id, 'deNome': j.nome}
        para = dados.get('para')
        if para:
            alvo = sala.jogadores.get(str(para))
            if alvo:
                await alvo.enviar(envio)
            return None
        return await sala.para_todos(envio, menos=j)
    if t == 'var':
        nome = limpar_texto(dados.get('nome'), 100)
        if not nome:
            return None
        if nome not in sala.variaveis and len(sala.variaveis) >= _cfg('ADVENTISCRATCH_MULTI_MAX_VARIAVEIS', 200):
            return await j.enviar({'t': 'erro', 'motivo': 'Muitas variáveis na sala.'})
        valor = limpar_valor(dados.get('valor'))
        sala.variaveis[nome] = valor
        return await sala.para_todos({'t': 'var', 'nome': nome, 'valor': valor, 'de': j.id}, menos=j)
    if t == 'eu':
        novos = dados.get('dados')
        if not isinstance(novos, dict):
            return None
        limite = _cfg('ADVENTISCRATCH_MULTI_MAX_VARIAVEIS', 200)
        mudou = {}
        for k, v in list(novos.items())[:50]:
            k = limpar_texto(k, 100)
            if k not in j.estado and len(j.estado) >= limite:
                continue
            j.estado[k] = mudou[k] = limpar_valor(v)
        if mudou:
            await sala.para_todos({'t': 'estado', 'id': j.id, 'dados': mudou}, menos=j)
    return None


async def app_websocket(scope, receive, send):
    """Aplicação ASGI de uma conexão WebSocket."""
    evento = await receive()
    if evento['type'] != 'websocket.connect':
        return
    if not _cfg('ADVENTISCRATCH_MULTIPLAYER', True) or not _origem_permitida(scope):
        await send({'type': 'websocket.close', 'code': 4403})
        return
    consulta = parse_qs(scope.get('query_string', b'').decode('latin-1'))
    chave = (consulta.get('token') or [''])[0]
    usuario, nome, motivo = await sync_to_async(_autenticar, thread_sensitive=True)(chave)
    await send({'type': 'websocket.accept'})
    if motivo:
        await send({'type': 'websocket.send', 'text': json.dumps({'t': 'erro', 'motivo': motivo, 'fatal': True},
                                                                ensure_ascii=False)})
        await send({'type': 'websocket.close', 'code': 4401})
        return
    j = Jogador(usuario, nome, send)
    await j.enviar({'t': 'ola', 'eu': j.info()})
    avisou_limite = False
    try:
        while True:
            evento = await receive()
            if evento['type'] == 'websocket.disconnect':
                break
            if evento['type'] != 'websocket.receive':
                continue
            texto = evento.get('text')
            if texto is None or len(texto) > _cfg('ADVENTISCRATCH_MULTI_MAX_MENSAGEM', 20000):
                continue
            if not j.pode_enviar():
                if not avisou_limite:
                    avisou_limite = True
                    await j.enviar({'t': 'erro', 'motivo': 'Mensagens demais por segundo: algumas foram ignoradas.'})
                continue
            try:
                dados = json.loads(texto)
            except ValueError:
                continue
            if isinstance(dados, dict):
                await _tratar(j, dados)
    finally:
        await _sair_da_sala(j)
