#!/usr/bin/env python3
"""
Gera os projetos de exemplo do Adventiscratch (arquivos .asp em static/exemplos/).

    python scripts/exemplos/gerar_exemplos.py

Cada exemplo é montado com uma pequena "linguagem" em Python que cria os blocos no formato do Scratch 3
(project.json). Para mudar um exemplo, edite a função dele aqui embaixo e rode o script de novo.
"""
import hashlib
import json
import os
import zipfile

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SAIDA = os.path.join(RAIZ, 'static', 'exemplos')
PADRAO = os.path.join(RAIZ, 'src', 'lib', 'default-project')

CORUJA_SVG = 'f5f2cfb7a7c2b68338e584543145b416.svg'
CENARIO_SVG = 'cd21514d0531fdffb22204e0ec5ed84a.svg'
PIO_WAV = 'd9e233bcc4ae423dffebd2027a59019f.wav'


def ler(caminho):
    with open(caminho, 'rb') as f:
        return f.read()


def md5(dados):
    return hashlib.md5(dados).hexdigest()


# ------------------------------------------------------------------ construtor de blocos

class Projeto:
    def __init__(self):
        self.n = 0
        self.alvos = {}          # nome -> dict de blocos
        self.atual = None
        self.variaveis = {}      # nome -> id (todas no palco)
        self.mensagens = {}      # nome -> id
        self.monitores = []
        self.comentarios = {}
        self.extensoes = set()

    def novo_id(self, prefixo='b'):
        self.n += 1
        return f'{prefixo}{self.n}'

    def alvo(self, nome):
        self.alvos.setdefault(nome, {})
        self.comentarios.setdefault(nome, {})
        self.atual = nome
        return self

    def var(self, nome, valor=0, monitor=None):
        if nome not in self.variaveis:
            self.variaveis[nome] = [self.novo_id('v'), valor]
        if monitor:
            vid = self.variaveis[nome][0]
            self.monitores.append({
                'id': vid, 'mode': monitor.get('modo', 'default'), 'opcode': 'data_variable',
                'params': {'VARIABLE': nome}, 'spriteName': None, 'value': valor,
                'width': 0, 'height': 0, 'x': monitor.get('x', 5), 'y': monitor.get('y', 5),
                'visible': True, 'sliderMin': 0, 'sliderMax': 100, 'isDiscrete': True,
            })
        return self.variaveis[nome][0]

    def msg(self, nome):
        if nome not in self.mensagens:
            self.mensagens[nome] = self.novo_id('m')
        return self.mensagens[nome]

    # --- blocos crus
    def _bloco(self, opcode, inputs=None, fields=None, sombra=False, mutation=None):
        bid = self.novo_id()
        b = {'opcode': opcode, 'next': None, 'parent': None, 'inputs': inputs or {},
             'fields': fields or {}, 'shadow': sombra, 'topLevel': False}
        if mutation:
            b['mutation'] = mutation
        self.alvos[self.atual][bid] = b
        if opcode.startswith('adventiscratch3d_'):
            self.extensoes.add('adventiscratch3d')
        elif opcode.startswith('adventiscratch2d_'):
            self.extensoes.add('adventiscratch2d')
        elif opcode.startswith('adventiscratchmusica_'):
            self.extensoes.add('adventiscratchmusica')
        elif opcode.startswith('adventiscratchritmo_'):
            self.extensoes.add('adventiscratchritmo')
        elif opcode.startswith('adventiscratch_'):
            self.extensoes.add('adventiscratch')
        return bid

    def _sombra_num(self, v):
        return self._bloco('math_number', fields={'NUM': [str(v), None]}, sombra=True)

    def _sombra_txt(self, v):
        return self._bloco('text', fields={'TEXT': [str(v), None]}, sombra=True)

    def _entrada(self, pai, valor, tipo):
        """Transforma um valor Python numa entrada do Scratch e liga o pai."""
        blocos = self.alvos[self.atual]
        if isinstance(valor, Menu):
            sid = self._bloco(valor.opcode, fields={valor.campo: [valor.valor, valor.vid]}, sombra=True)
            blocos[sid]['parent'] = pai
            return [1, sid]
        if isinstance(valor, Cor):
            sid = self._bloco('colour_picker', fields={'COLOUR': [valor.hex, None]}, sombra=True)
            blocos[sid]['parent'] = pai
            return [1, sid]
        if isinstance(valor, Bloco):
            blocos[valor.id]['parent'] = pai
            if tipo == 'bool':
                return [2, valor.id]
            if isinstance(tipo, Menu):
                sid = self._bloco(tipo.opcode, fields={tipo.campo: [tipo.valor, None]}, sombra=True)
            else:
                sid = self._sombra_txt('') if tipo == 'txt' else self._sombra_num(0)
            blocos[sid]['parent'] = pai
            return [3, valor.id, sid]
        if isinstance(valor, Pilha):
            ids = valor.ids
            if not ids:
                return None
            self._encadear(ids, pai)
            return [2, ids[0]]
        sid = self._sombra_num(valor) if isinstance(valor, (int, float)) and tipo != 'txt' else self._sombra_txt(valor)
        blocos[sid]['parent'] = pai
        return [1, sid]

    def _encadear(self, ids, pai):
        blocos = self.alvos[self.atual]
        for i, bid in enumerate(ids):
            blocos[bid]['parent'] = pai if i == 0 else ids[i - 1]
            blocos[bid]['next'] = ids[i + 1] if i + 1 < len(ids) else None

    def b(self, opcode, entradas=None, campos=None, tipos=None, mutation=None):
        """Cria um bloco. entradas: nome -> valor; tipos: nome -> 'num'|'txt'|'bool'|Menu (padrão num)."""
        bid = self._bloco(opcode, fields={k: (v if isinstance(v, list) else [v, None]) for k, v in (campos or {}).items()},
                          mutation=mutation)
        tipos = tipos or {}
        ins = {}
        for nome, valor in (entradas or {}).items():
            e = self._entrada(bid, valor, tipos.get(nome, 'num'))
            if e:
                ins[nome] = e
        self.alvos[self.atual][bid]['inputs'] = ins
        return Bloco(bid)

    def script(self, x, y, *blocos):
        ids = [b.id for b in blocos]
        blocos_alvo = self.alvos[self.atual]
        self._encadear(ids, None)
        blocos_alvo[ids[0]]['topLevel'] = True
        blocos_alvo[ids[0]]['x'] = x
        blocos_alvo[ids[0]]['y'] = y
        blocos_alvo[ids[0]]['parent'] = None

    def comentario(self, x, y, texto, largura=320, altura=160):
        self.comentarios[self.atual][self.novo_id('c')] = {
            'blockId': None, 'x': x, 'y': y, 'width': largura, 'height': altura, 'minimized': False, 'text': texto}


class Bloco:
    def __init__(self, bid):
        self.id = bid


class Pilha:
    def __init__(self, *blocos):
        self.ids = [b.id for b in blocos if b is not None]


class Menu:
    def __init__(self, opcode, campo, valor, vid=None):
        self.opcode, self.campo, self.valor, self.vid = opcode, campo, valor, vid


class Cor:
    def __init__(self, hexa):
        self.hex = hexa


# ------------------------------------------------------------------ atalhos de blocos (em português)

class Blocos:
    """Atalhos para os blocos mais usados, para os exemplos ficarem legíveis."""

    def __init__(self, p):
        self.p = p

    # eventos
    def bandeira(self):
        return self.p.b('event_whenflagclicked')

    def quando_tecla(self, tecla):
        return self.p.b('event_whenkeypressed', campos={'KEY_OPTION': tecla})

    def quando_receber(self, nome):
        return self.p.b('event_whenbroadcastreceived', campos={'BROADCAST_OPTION': [nome, self.p.msg(nome)]})

    def envie(self, nome):
        return self.p.b('event_broadcast', {'BROADCAST_INPUT': Menu('event_broadcast_menu', 'BROADCAST_OPTION', nome,
                                                                    self.p.msg(nome))})

    # controle
    def sempre(self, *corpo):
        return self.p.b('control_forever', {'SUBSTACK': Pilha(*corpo)})

    def se(self, cond, *corpo):
        return self.p.b('control_if', {'CONDITION': cond, 'SUBSTACK': Pilha(*corpo)}, tipos={'CONDITION': 'bool'})

    def se_senao(self, cond, entao, senao):
        return self.p.b('control_if_else', {'CONDITION': cond, 'SUBSTACK': Pilha(*entao), 'SUBSTACK2': Pilha(*senao)},
                        tipos={'CONDITION': 'bool'})

    def repita_ate(self, cond, *corpo):
        return self.p.b('control_repeat_until', {'CONDITION': cond, 'SUBSTACK': Pilha(*corpo)}, tipos={'CONDITION': 'bool'})

    def espere(self, s):
        return self.p.b('control_wait', {'DURATION': s})

    # operadores
    def _op2(self, op, a, b, nomes=('NUM1', 'NUM2'), tipo='num'):
        return self.p.b(op, {nomes[0]: a, nomes[1]: b}, tipos={nomes[0]: tipo, nomes[1]: tipo})

    def soma(self, a, b):
        return self._op2('operator_add', a, b)

    def menos(self, a, b):
        return self._op2('operator_subtract', a, b)

    def vezes(self, a, b):
        return self._op2('operator_multiply', a, b)

    def resto(self, a, b):
        return self._op2('operator_mod', a, b)

    def igual(self, a, b):
        return self._op2('operator_equals', a, b, ('OPERAND1', 'OPERAND2'), 'txt')

    def maior(self, a, b):
        return self._op2('operator_gt', a, b, ('OPERAND1', 'OPERAND2'), 'txt')

    def menor(self, a, b):
        return self._op2('operator_lt', a, b, ('OPERAND1', 'OPERAND2'), 'txt')

    def e(self, a, b):
        return self.p.b('operator_and', {'OPERAND1': a, 'OPERAND2': b}, tipos={'OPERAND1': 'bool', 'OPERAND2': 'bool'})

    def ou(self, a, b):
        return self.p.b('operator_or', {'OPERAND1': a, 'OPERAND2': b}, tipos={'OPERAND1': 'bool', 'OPERAND2': 'bool'})

    def nao(self, a):
        return self.p.b('operator_not', {'OPERAND': a}, tipos={'OPERAND': 'bool'})

    def junte(self, *partes):
        partes = list(partes)
        atual = partes[-1]
        for parte in reversed(partes[:-1]):
            atual = self.p.b('operator_join', {'STRING1': parte, 'STRING2': atual}, tipos={'STRING1': 'txt', 'STRING2': 'txt'})
        return atual

    def mat(self, funcao, x):
        return self.p.b('operator_mathop', {'NUM': x}, campos={'OPERATOR': funcao})

    # variáveis
    def v(self, nome):
        return self.p.b('data_variable', campos={'VARIABLE': [nome, self.p.var(nome)]})

    def mude(self, nome, valor, tipo='txt'):
        return self.p.b('data_setvariableto', {'VALUE': valor}, campos={'VARIABLE': [nome, self.p.var(nome)]},
                        tipos={'VALUE': tipo})

    def adicione(self, nome, valor):
        return self.p.b('data_changevariableby', {'VALUE': valor}, campos={'VARIABLE': [nome, self.p.var(nome)]})

    # sensores
    def tecla(self, tecla):
        return self.p.b('sensing_keypressed', {'KEY_OPTION': Menu('sensing_keyoptions', 'KEY_OPTION', tecla)})

    def tocando(self, ator):
        return self.p.b('sensing_touchingobject',
                        {'TOUCHINGOBJECTMENU': Menu('sensing_touchingobjectmenu', 'TOUCHINGOBJECTMENU', ator)})

    def pergunte(self, texto):
        return self.p.b('sensing_askandwait', {'QUESTION': texto}, tipos={'QUESTION': 'txt'})

    def resposta(self):
        return self.p.b('sensing_answer')

    # movimento / aparência / som
    def va_para(self, x, y):
        return self.p.b('motion_gotoxy', {'X': x, 'Y': y})

    def va_aleatorio(self):
        return self.p.b('motion_goto', {'TO': Menu('motion_goto_menu', 'TO', '_random_')})

    def mude_x(self, n):
        return self.p.b('motion_changexby', {'DX': n})

    def mude_y(self, n):
        return self.p.b('motion_changeyby', {'DY': n})

    def aponte(self, graus):
        return self.p.b('motion_pointindirection', {'DIRECTION': graus})

    def gire(self, graus):
        return self.p.b('motion_turnright', {'DEGREES': graus})

    def estilo_rotacao(self, estilo):
        return self.p.b('motion_setrotationstyle', campos={'STYLE': estilo})

    def diga(self, texto, segundos=None):
        if segundos is None:
            return self.p.b('looks_say', {'MESSAGE': texto}, tipos={'MESSAGE': 'txt'})
        return self.p.b('looks_sayforsecs', {'MESSAGE': texto, 'SECS': segundos}, tipos={'MESSAGE': 'txt'})

    def mostre(self):
        return self.p.b('looks_show')

    def esconda(self):
        return self.p.b('looks_hide')

    def tamanho(self, pct):
        return self.p.b('looks_setsizeto', {'SIZE': pct})

    def toque_som(self, nome):
        return self.p.b('sound_play', {'SOUND_MENU': Menu('sound_sounds_menu', 'SOUND_MENU', nome)})

    # Extras Adventiscratch
    def x(self, opcode, menus=None, tipos=None, **entradas):
        """Bloco da extensão Extras. O menu "modos" não aceita reporters: vira campo do próprio bloco."""
        campos = {nome: valor for nome, (menu, valor) in (menus or {}).items()}
        return self.p.b(f'adventiscratch_{opcode}', entradas, campos=campos, tipos=tipos or {})

    def y_pos(self):
        return self.p.b('motion_yposition')

    def clone(self):
        return self.p.b('control_create_clone_of',
                        {'CLONE_OPTION': Menu('control_create_clone_of_menu', 'CLONE_OPTION', '_myself_')})

    def quando_clone(self):
        return self.p.b('control_start_as_clone')

    def apague_clone(self):
        return self.p.b('control_delete_this_clone')

    def deslize(self, s, x, y):
        return self.p.b('motion_glidesecstoxy', {'SECS': s, 'X': x, 'Y': y})

    # Plataforma 2D: todos os menus da extensão são campos do próprio bloco (não aceitam reporters)
    def p2(self, opcode, menus=None, tipos=None, **entradas):
        return self.p.b(f'adventiscratch2d_{opcode}', entradas, campos=dict(menus or {}), tipos=tipos or {})

    # Músicas: o menu de músicas aceita reporters (sombra); os outros menus são campos do bloco
    def mu(self, opcode, menus=None, musica=None, tipos=None, **entradas):
        entradas = dict(entradas)
        if musica is not None:
            entradas['MUSICA'] = Menu('adventiscratchmusica_menu_musicas', 'musicas', musica)
        return self.p.b(f'adventiscratchmusica_{opcode}', entradas, campos=dict(menus or {}), tipos=tipos or {})

    # Jogo de Ritmo: menu de mapas aceita reporters (sombra); os outros menus são campos
    def ri(self, opcode, menus=None, mapa=None, tipos=None, **entradas):
        entradas = dict(entradas)
        if mapa is not None:
            entradas['MAPA'] = Menu('adventiscratchritmo_menu_mapas', 'mapas', mapa)
        return self.p.b(f'adventiscratchritmo_{opcode}', entradas, campos=dict(menus or {}), tipos=tipos or {})

    def tamanho_mude(self, n):
        return self.p.b('looks_changesizeby', {'CHANGE': n})

    # 3D
    # menus da extensão 3D que NÃO aceitam reporters: no Scratch eles são campos do próprio bloco
    MENUS_CAMPO_3D = {'eixos', 'mostrar', 'propriedades', 'infoAnimacao', 'luzes', 'tiposFisica', 'eixosVel',
                      'infoTexturas'}

    def d(self, opcode, menus=None, tipos=None, **entradas):
        """Bloco da extensão 3D. menus: ARG -> (nome_do_menu, valor). Cores: use Cor('#hex')."""
        entradas = dict(entradas)
        tipos = dict(tipos or {})
        campos = {}
        for nome, (menu, valor) in (menus or {}).items():
            if menu in self.MENUS_CAMPO_3D:
                campos[nome] = valor
                continue
            m = Menu(f'adventiscratch3d_menu_{menu}', menu, valor)
            if isinstance(entradas.get(nome), Bloco):
                tipos[nome] = m  # reporter encaixado num menu que aceita reporters
            else:
                entradas[nome] = m
        for nome, valor in entradas.items():
            if isinstance(valor, str) and nome not in tipos:
                tipos[nome] = 'txt'
        return self.p.b(f'adventiscratch3d_{opcode}', entradas, campos=campos, tipos=tipos)


# ------------------------------------------------------------------ montagem do arquivo .asp

ESTRELA_SVG = ler(os.path.join(os.path.dirname(__file__), 'estrela.svg'))
JOGO_SVG = ler(os.path.join(os.path.dirname(__file__), 'jogo.svg'))


def ator_jogo():
    """Ator invisível que guarda o código dos exemplos 3D (abre selecionado no editor)."""
    return {'nome': 'Jogo', 'fantasias': [('controle', JOGO_SVG, 32, 24)], 'visivel': False}


def fantasia(nome, arquivo_svg, dados, cx, cy):
    h = md5(dados)
    return {'name': nome, 'dataFormat': 'svg', 'assetId': h, 'md5ext': f'{h}.svg',
            'bitmapResolution': 1, 'rotationCenterX': cx, 'rotationCenterY': cy}, (f'{h}.svg', dados)


def montar(p, nome_arquivo, atores, musicas=(), mapas=()):
    """atores: lista de dicts {nome, fantasias:[(nome, dados, cx, cy)], sons:bool, visivel, x, y, tamanho}"""
    arquivos = {}
    pio = ler(os.path.join(PADRAO, PIO_WAV))
    som_pio = {'name': 'Pio', 'assetId': md5(pio), 'dataFormat': 'wav', 'format': '', 'rate': 48000,
               'sampleCount': 35313, 'md5ext': f'{md5(pio)}.wav'}
    arquivos[f'{md5(pio)}.wav'] = pio
    cenario = ler(os.path.join(PADRAO, CENARIO_SVG))
    fc, (n, d) = fantasia('cenário1', CENARIO_SVG, cenario, 240, 180)
    arquivos[n] = d
    p.alvo('Palco')
    alvos = [{
        'isStage': True, 'name': 'Stage',
        'variables': {vid: [nome, valor] for nome, (vid, valor) in p.variaveis.items()},
        'lists': {}, 'broadcasts': {mid: nome for nome, mid in p.mensagens.items()},
        'blocks': p.alvos.get('Palco', {}), 'comments': p.comentarios.get('Palco', {}),
        'currentCostume': 0, 'costumes': [fc], 'sounds': [som_pio], 'volume': 100, 'layerOrder': 0,
        'tempo': 60, 'videoTransparency': 50, 'videoState': 'on', 'textToSpeechLanguage': None,
    }]
    for i, a in enumerate(atores, start=1):
        fs = []
        for (fn, dados, cx, cy) in a['fantasias']:
            f, (n, d) = fantasia(fn, None, dados, cx, cy)
            arquivos[n] = d
            fs.append(f)
        alvos.append({
            'isStage': False, 'name': a['nome'], 'variables': {}, 'lists': {}, 'broadcasts': {},
            'blocks': p.alvos.get(a['nome'], {}), 'comments': p.comentarios.get(a['nome'], {}),
            'currentCostume': 0, 'costumes': fs, 'sounds': [som_pio] if a.get('sons', True) else [],
            'volume': 100, 'layerOrder': i, 'visible': a.get('visivel', True), 'x': a.get('x', 0), 'y': a.get('y', 0),
            'size': a.get('tamanho', 100), 'direction': 90, 'draggable': False, 'rotationStyle': 'all around',
        })
    projeto = {'targets': alvos, 'monitors': p.monitores, 'extensions': sorted(p.extensoes),
               'meta': {'semver': '3.0.0', 'vm': '0.2.0', 'agent': 'Adventiscratch exemplos'}}
    os.makedirs(SAIDA, exist_ok=True)
    destino = os.path.join(SAIDA, nome_arquivo)
    with zipfile.ZipFile(destino, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('project.json', json.dumps(projeto, ensure_ascii=False))
        for n, d in arquivos.items():
            z.writestr(n, d)
        for i, m in enumerate(musicas):
            z.writestr(f'adventiscratch/musicas/{i}.json', json.dumps(m, ensure_ascii=False))
        for i, m in enumerate(mapas):
            z.writestr(f'adventiscratch/mapas/{i}.json', json.dumps(m, ensure_ascii=False))
        z.writestr('adventiscratch/manifest.json', json.dumps(
            {'format': 'asp', 'version': 3, 'editor': 'Adventiscratch', 'models': [], 'instrumentos': [],
             'musicas': [{'nome': m['nome'], 'arquivo': f'musicas/{i}.json'} for i, m in enumerate(musicas)],
             'mapas': [{'nome': m['nome'], 'arquivo': f'mapas/{i}.json'} for i, m in enumerate(mapas)]}))
    print(f'  {nome_arquivo}: {sum(len(b) for b in p.alvos.values())} blocos')


CORUJA = ler(os.path.join(PADRAO, CORUJA_SVG))


def coruja(visivel=True, x=0, y=0, tamanho=100):
    return {'nome': 'Coruja Sabida', 'fantasias': [('fantasia1', CORUJA, 27, 38)], 'visivel': visivel,
            'x': x, 'y': y, 'tamanho': tamanho}


# ------------------------------------------------------------------ 1. Coruja Coletora (2D)

def coruja_coletora():
    p = Projeto()
    k = Blocos(p)
    p.var('pontos', 0, {'x': 5, 'y': 5})
    p.var('tempo', 30, {'x': 5, 'y': 32})
    p.var('jogando', 0)

    p.alvo('Palco')
    p.script(20, 20,
             k.bandeira(),
             k.mude('pontos', 0), k.mude('tempo', 30), k.mude('jogando', 1),
             k.repita_ate(k.menor(k.v('tempo'), 1), k.espere(1), k.adicione('tempo', -1)),
             k.mude('jogando', 0),
             k.envie('fim de jogo'))
    p.comentario(320, 20, 'Cronômetro: conta 30 segundos e avisa todos os atores com a mensagem "fim de jogo".')

    p.alvo('Coruja Sabida')
    p.script(20, 20,
             k.bandeira(), k.va_para(0, 0), k.tamanho(70), k.estilo_rotacao('left-right'), k.diga(''),
             k.sempre(k.se(k.igual(k.v('jogando'), 1),
                           k.se(k.tecla('right arrow'), k.aponte(90), k.mude_x(6)),
                           k.se(k.tecla('left arrow'), k.aponte(-90), k.mude_x(-6)),
                           k.se(k.tecla('up arrow'), k.mude_y(6)),
                           k.se(k.tecla('down arrow'), k.mude_y(-6)))))
    p.script(20, 480,
             k.quando_receber('fim de jogo'),
             k.diga(k.junte('Fim de jogo! Você pegou ', k.v('pontos'), ' estrelas!')))
    p.comentario(420, 20, 'Use as SETAS do teclado para voar.\nDesafio: mude o 6 para um número maior e veja a coruja ficar mais rápida!')

    p.alvo('Estrela')
    p.script(20, 20,
             k.bandeira(), k.va_aleatorio(),
             k.sempre(k.gire(3),
                      k.se(k.e(k.tocando('Coruja Sabida'), k.igual(k.v('jogando'), 1)),
                           k.adicione('pontos', 1), k.toque_som('Pio'), k.va_aleatorio())))
    p.comentario(420, 20, 'Quando a estrela toca na coruja: ganha 1 ponto, toca o som e a estrela pula para outro lugar.')

    montar(p, 'coruja-coletora.asp', [coruja(tamanho=70), {
        'nome': 'Estrela', 'fantasias': [('estrela', ESTRELA_SVG, 24, 24)], 'x': 120, 'y': 80, 'tamanho': 100}])


# ------------------------------------------------------------------ 2. Calculadora da Coruja (Extras)

def calculadora():
    p = Projeto()
    k = Blocos(p)
    p.alvo('Coruja Sabida')
    p.script(20, 20,
             k.bandeira(), k.va_para(0, -40), k.tamanho(150),
             k.pergunte('Digite um número:'), k.mude('a', k.resposta()),
             k.pergunte('Agora digite outro número:'), k.mude('b', k.resposta()),
             k.diga(k.junte(k.v('a'), ' elevado a ', k.v('b'), ' = ', k.x('potencia', A=k.v('a'), B=k.v('b'))), 3),
             k.diga(k.junte('A raiz quadrada de ', k.v('a'), ' é ', k.x('raiz', N=2, X=k.v('a'))), 3),
             k.diga(k.x('seSenao', tipos={'COND': 'bool', 'A': 'txt', 'B': 'txt'},
                        COND=k.x('maiorIgual', tipos={'A': 'txt', 'B': 'txt'}, A=k.v('a'), B=k.v('b')),
                        A='O primeiro número é maior ou igual ao segundo!',
                        B='O segundo número é maior!'), 3),
             k.diga(k.junte('Em letras maiúsculas: ',
                            k.x('caixa', menus={'MODO': ('modos', 'maiusculas')}, tipos={'TEXTO': 'txt'},
                                TEXTO='coruja sabida')), 2),
             k.diga(k.junte('Hoje é ', k.x('dataHoje')), 3))
    p.comentario(520, 20, 'Este exemplo usa os blocos roxos da extensão "Extras Adventiscratch": potência, raiz, '
                          '≥, "se … então … senão …" e maiúsculas.\nClique na bandeira e responda às perguntas!')
    montar(p, 'calculadora-coruja.asp', [coruja(x=0, y=-40, tamanho=150)])


# ------------------------------------------------------------------ 3. Mundo 3D

def mundo_3d():
    p = Projeto()
    k = Blocos(p)
    p.alvo('Jogo')
    t = lambda: k.p.b('sensing_timer')  # noqa: E731
    p.script(20, 20,
             k.bandeira(),
             k.d('ligar'), k.d('limpar'), k.d('fundo', COR=Cor('#87CEEB')),
             k.d('criarForma', menus={'FORMA': ('formas', 'plano')}, NOME='chao'),
             k.d('tamanho', NOME='chao', N=300), k.d('cor', NOME='chao', COR=Cor('#5CB85C')),
             k.d('criarForma', menus={'FORMA': ('formas', 'cubo')}, NOME='cubo'),
             k.d('moverPara', NOME='cubo', X=-4, Y=1, Z=0), k.d('cor', NOME='cubo', COR=Cor('#6D4FC2')),
             k.d('criarForma', menus={'FORMA': ('formas', 'esfera')}, NOME='bola'),
             k.d('cor', NOME='bola', COR=Cor('#FF8C1A')),
             k.d('criarForma', menus={'FORMA': ('formas', 'toro')}, NOME='rosca'),
             k.d('moverPara', NOME='rosca', X=4, Y=1.5, Z=0), k.d('cor', NOME='rosca', COR=Cor('#FFD54A')),
             k.d('criarForma', menus={'FORMA': ('formas', 'cone')}, NOME='cone'),
             k.d('moverPara', NOME='cone', X=0, Y=1, Z=-5), k.d('cor', NOME='cone', COR=Cor('#E53935')),
             k.p.b('sensing_resettimer'),
             k.sempre(
                 k.d('girarPor', menus={'EIXO': ('eixos', 'y')}, NOME='cubo', N=2),
                 k.d('girarPor', menus={'EIXO': ('eixos', 'x')}, NOME='rosca', N=3),
                 k.d('moverPara', NOME='bola', X=0, Y=k.soma(1.5, k.mat('sin', k.vezes(t(), 200))), Z=0),
                 k.d('cameraPara', X=k.vezes(k.mat('sin', k.vezes(t(), 25)), 12), Y=5,
                     Z=k.vezes(k.mat('cos', k.vezes(t(), 25)), 12)),
                 k.d('cameraOlhar', X=0, Y=1, Z=0)))
    p.script(20, 1500, k.quando_tecla('space'), k.d('luz', menus={'TIPO': ('luzes', 'sol')}, N=0.3))
    p.script(420, 1500, k.quando_tecla('l'), k.d('luz', menus={'TIPO': ('luzes', 'sol')}, N=1.8))
    p.comentario(420, 20, 'Mundo 3D: cria formas, pinta, gira e faz a câmera dar a volta usando seno e cosseno '
                          'do cronômetro.\nESPAÇO apaga o sol, L acende de novo.\nDesafio: crie uma cápsula e '
                          'faça ela pular!')
    montar(p, 'mundo-3d.asp', [ator_jogo()])


# ------------------------------------------------------------------ 4. Visualizador de modelos

def visualizador():
    p = Projeto()
    k = Blocos(p)
    p.var('mensagem', '', {'x': 5, 'y': 5, 'modo': 'large'})
    p.var('modelo', '', {'x': 5, 'y': 300})
    p.var('animação', 1)
    p.var('animações', 0, {'x': 260, 'y': 300})
    p.var('número do modelo', 1)
    p.var('zoom', 5)
    p.var('girando', 1)
    p.alvo('Jogo')

    carregar = [
        k.d('apagar', NOME='modelo'),
        k.mude('modelo', k.d('modeloNumero', N=k.v('número do modelo'))),
        k.d('criarModelo', menus={'MODELO': ('modelos', '')}, MODELO=k.v('modelo'), NOME='modelo'),
        k.mude('animações', k.d('animacoes', menus={'INFO': ('infoAnimacao', 'quantidade')}, NOME='modelo')),
        k.mude('animação', 1),
        k.se(k.maior(k.v('animações'), 0), k.d('tocarAnimacao', ANIM='1', NOME='modelo')),
        k.mude('mensagem', k.junte('Modelo: ', k.v('modelo'))),
    ]
    p.script(20, 20,
             k.bandeira(),
             k.d('ligar'), k.d('limpar'), k.d('fundo', COR=Cor('#1E1B3A')),
             k.mude('zoom', 5), k.mude('girando', 1), k.mude('número do modelo', 1),
             k.d('criarForma', menus={'FORMA': ('formas', 'plano')}, NOME='palco'),
             k.d('tamanho', NOME='palco', N=40), k.d('cor', NOME='palco', COR=Cor('#3B3570')),
             k.se_senao(k.maior(k.d('quantidadeModelos'), 0),
                        [k.envie('carregar modelo')],
                        [k.d('criarForma', menus={'FORMA': ('formas', 'toro')}, NOME='modelo'),
                         k.d('moverPara', NOME='modelo', X=0, Y=1, Z=0),
                         k.d('cor', NOME='modelo', COR=Cor('#FFD54A')),
                         k.mude('modelo', '(nenhum)'),
                         k.mude('mensagem', 'Importe um modelo: Código → 3D → Importar modelo 3D… e clique na bandeira')]),
             k.d('cameraSeguir', NOME='modelo', D=k.v('zoom'), H=1.5),
             k.sempre(k.se(k.igual(k.v('girando'), 1),
                           k.d('girarPor', menus={'EIXO': ('eixos', 'y')}, NOME='modelo', N=1))))
    p.script(700, 20, k.quando_receber('carregar modelo'), *carregar)
    p.script(20, 1100, k.quando_tecla('left arrow'), k.d('cameraGirarSeguindo', N=-10))
    p.script(300, 1100, k.quando_tecla('right arrow'), k.d('cameraGirarSeguindo', N=10))
    p.script(20, 1250, k.quando_tecla('up arrow'),
             k.se(k.maior(k.v('zoom'), 1.5), k.adicione('zoom', -0.5)),
             k.d('cameraSeguir', NOME='modelo', D=k.v('zoom'), H=1.5))
    p.script(420, 1250, k.quando_tecla('down arrow'), k.adicione('zoom', 0.5),
             k.d('cameraSeguir', NOME='modelo', D=k.v('zoom'), H=1.5))
    p.script(20, 1450, k.quando_tecla('space'), k.mude('girando', k.menos(1, k.v('girando'))))
    p.script(20, 1600, k.quando_tecla('a'),
             k.se(k.maior(k.v('animações'), 0),
                  k.mude('animação', k.soma(k.resto(k.v('animação'), k.v('animações')), 1)),
                  k.d('tocarAnimacao', ANIM=k.v('animação'), NOME='modelo'),
                  k.mude('mensagem', k.junte('Animação ', k.v('animação'), ' de ', k.v('animações')))))
    p.script(20, 1850, k.quando_tecla('n'),
             k.se(k.maior(k.d('quantidadeModelos'), 0),
                  k.adicione('número do modelo', 1), k.envie('carregar modelo')))
    p.script(20, 2000, k.quando_tecla('t'),
             k.mude('mensagem', k.junte('Texturas: ', k.d('texturasModelo',
                                                          menus={'INFO': ('infoTexturas', 'texturas'), 'MODELO': ('modelos', '')},
                                                          MODELO=k.v('modelo')))))
    p.comentario(700, 520, 'VISUALIZADOR DE MODELOS\n1) Importe um modelo (.glb, .fbx, .obj…) no botão '
                           '"Importar modelo 3D…" da categoria 3D.\n2) Clique na bandeira.\n\n'
                           '← → giram a câmera   ↑ ↓ zoom\nESPAÇO para/continua a rotação\n'
                           'A = próxima animação   N = próximo modelo   T = mostra as texturas', 360, 260)
    montar(p, 'visualizador-modelos.asp', [ator_jogo()])


# ------------------------------------------------------------------ 5. Corrida 3D (plataforma)

ANEIS = [(0, 1.3, -6), (6, 3.3, -6), (12, 5.3, -12), (6, 7.3, -18), (-8, 2.8, -6), (-4, 1.3, 5)]


def corrida_3d():
    p = Projeto()
    k = Blocos(p)
    p.var('anéis', 0, {'x': 5, 'y': 5})
    p.var('mensagem', '', {'x': 5, 'y': 32, 'modo': 'large'})
    p.var('estado', '')
    p.var('novo estado', '')
    p.var('animação parado', 1)
    p.var('animação correndo', 2)
    p.var('animação pulando', 3)
    p.var('velocidade', 9)
    p.alvo('Jogo')

    def caixa(nome, x, y, z, cor, tipo='solido'):
        return [k.d('criarForma', menus={'FORMA': ('formas', 'cubo')}, NOME=nome),
                k.d('moverPara', NOME=nome, X=x, Y=y, Z=z), k.d('cor', NOME=nome, COR=Cor(cor)),
                k.d('fisicaTipo', menus={'TIPO': ('tiposFisica', tipo)}, NOME=nome)]

    aneis = []
    for i, (x, y, z) in enumerate(ANEIS, start=1):
        aneis += [k.d('criarForma', menus={'FORMA': ('formas', 'toro')}, NOME=f'anel{i}'),
                  k.d('tamanho', NOME=f'anel{i}', N=40), k.d('cor', NOME=f'anel{i}', COR=Cor('#FFD54A')),
                  k.d('moverPara', NOME=f'anel{i}', X=x, Y=y, Z=z)]

    p.script(20, 20,
             k.bandeira(),
             k.d('ligar'), k.d('limpar'), k.d('fundo', COR=Cor('#8FD3FF')), k.d('gravidade', G=-30),
             k.mude('anéis', 0), k.mude('estado', ''),
             k.mude('mensagem', 'Pegue os 6 anéis! Setas ou WASD andam, ESPAÇO pula, X corre, Q/E giram a câmera.'),
             k.d('criarForma', menus={'FORMA': ('formas', 'plano')}, NOME='chao'),
             k.d('tamanho', NOME='chao', N=400), k.d('cor', NOME='chao', COR=Cor('#4CAF50')),
             k.d('fisicaTipo', menus={'TIPO': ('tiposFisica', 'solido')}, NOME='chao'),
             *caixa('plataforma1', 6, 1, -6, '#8B5A2B'),
             *caixa('plataforma2', 12, 3, -12, '#A0522D'),
             *caixa('plataforma3', 6, 5, -18, '#8B5A2B'),
             k.d('criarForma', menus={'FORMA': ('formas', 'cubo')}, NOME='rampa'),
             k.d('moverPara', NOME='rampa', X=-8, Y=-0.3, Z=-6),
             k.d('girarPara', NOME='rampa', X=0, Y=0, Z=-20), k.d('tamanho', NOME='rampa', N=200),
             k.d('cor', NOME='rampa', COR=Cor('#9E9E9E')),
             k.d('fisicaTipo', menus={'TIPO': ('tiposFisica', 'terreno')}, NOME='rampa'),
             *aneis,
             k.se_senao(k.maior(k.d('quantidadeModelos'), 0),
                        [k.d('criarModelo', menus={'MODELO': ('modelos', '')},
                             MODELO=k.d('modeloNumero', N=1), NOME='jogador')],
                        [k.d('criarForma', menus={'FORMA': ('formas', 'capsula')}, NOME='jogador'),
                         k.d('cor', NOME='jogador', COR=Cor('#1E5BD6'))]),
             k.d('ajusteFrente', NOME='jogador', N=0),
             k.d('moverPara', NOME='jogador', X=0, Y=2, Z=2),
             k.d('fisicaTipo', menus={'TIPO': ('tiposFisica', 'corpo')}, NOME='jogador'),
             k.d('cameraSeguir', NOME='jogador', D=9, H=4),
             k.envie('começar'))
    p.comentario(560, 20, 'CORRIDA 3D – jogo de plataforma\n\nPara usar o SEU personagem (por exemplo, o seu '
                          'modelo do Sonic): importe o modelo com as texturas no botão "Importar modelo 3D…" '
                          'e clique na bandeira. Sem modelo, o jogador é uma cápsula azul.\n\n'
                          'Se o personagem andar de costas, mude o 0 de "virar o modelo de jogador" para 180.\n'
                          'As variáveis "animação parado/correndo/pulando" dizem qual animação do modelo usar.',
                520, 300)

    estados = k.sempre(
        # andar (relativo à câmera)
        k.mude('velocidade', k.x('seSenao', tipos={'COND': 'bool', 'A': 'txt', 'B': 'txt'},
                                 COND=k.tecla('x'), A='16', B='9')),
        k.d('andarCamera', NOME='jogador',
            X=k.menos(k.ou(k.tecla('right arrow'), k.tecla('d')), k.ou(k.tecla('left arrow'), k.tecla('a'))),
            Z=k.menos(k.ou(k.tecla('up arrow'), k.tecla('w')), k.ou(k.tecla('down arrow'), k.tecla('s'))),
            V=k.v('velocidade')),
        k.se(k.e(k.tecla('space'), k.d('noChao', NOME='jogador')), k.d('pular', NOME='jogador', F=12)),
        k.se(k.tecla('q'), k.d('cameraGirarSeguindo', N=-3)),
        k.se(k.tecla('e'), k.d('cameraGirarSeguindo', N=3)),
        # caiu do mundo
        k.se(k.menor(k.d('propriedade', menus={'PROP': ('propriedades', 'y')}, NOME='jogador'), -10),
             k.d('moverPara', NOME='jogador', X=0, Y=2, Z=2),
             k.d('definirVelocidade', NOME='jogador', X=0, Y=0, Z=0),
             k.mude('mensagem', 'Ops! Você caiu. Tente de novo!')),
        # animação conforme o estado
        k.mude('novo estado', 'parado'),
        k.se(k.maior(k.d('velocidade', menus={'EIXO': ('eixosVel', 'h')}, NOME='jogador'), 1),
             k.mude('novo estado', 'correndo')),
        k.se(k.nao(k.d('noChao', NOME='jogador')), k.mude('novo estado', 'pulando')),
        k.se(k.x('diferente', tipos={'A': 'txt', 'B': 'txt'}, A=k.v('novo estado'), B=k.v('estado')),
             k.mude('estado', k.v('novo estado')),
             k.d('tocarAnimacao', NOME='jogador',
                 ANIM=k.x('seSenao', tipos={'COND': 'bool', 'A': 'txt', 'B': 'txt'},
                          COND=k.igual(k.v('estado'), 'parado'), A=k.v('animação parado'),
                          B=k.x('seSenao', tipos={'COND': 'bool', 'A': 'txt', 'B': 'txt'},
                                COND=k.igual(k.v('estado'), 'correndo'),
                                A=k.v('animação correndo'), B=k.v('animação pulando'))))),
    )
    p.script(20, 2400, k.quando_receber('começar'), estados)

    pegar = []
    for i in range(1, len(ANEIS) + 1):
        pegar += [k.d('girarPor', menus={'EIXO': ('eixos', 'y')}, NOME=f'anel{i}', N=4),
                  k.se(k.d('tocando', A='jogador', B=f'anel{i}'),
                       k.d('apagar', NOME=f'anel{i}'), k.adicione('anéis', 1),
                       k.p.b('sound_play', {'SOUND_MENU': Menu('sound_sounds_menu', 'SOUND_MENU', 'Pio')}))]
    p.script(900, 2400, k.quando_receber('começar'),
             k.sempre(*pegar,
                      k.se(k.igual(k.v('anéis'), len(ANEIS)),
                           k.mude('mensagem', 'Você pegou todos os anéis! Parabéns!'))))
    montar(p, 'corrida-3d.asp', [ator_jogo()])


# ------------------------------------------------------------------ 6. Coruja Saltitante (Plataforma 2D)

def svg_retangulo(l, a, cor, topo=None, raio=4):
    faixa = f'<rect x="0" y="0" width="{l}" height="{min(6, a // 2)}" rx="{raio}" fill="{topo}"/>' if topo else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{l}" height="{a}" viewBox="0 0 {l} {a}">'
            f'<rect x="0" y="0" width="{l}" height="{a}" rx="{raio}" fill="{cor}"/>{faixa}</svg>').encode()


MOLA_SVG = (b'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="22" viewBox="0 0 40 22">'
            b'<rect x="0" y="16" width="40" height="6" rx="2" fill="#555"/>'
            b'<path d="M6 16 L34 12 L6 8 L34 4" fill="none" stroke="#999" stroke-width="3"/>'
            b'<rect x="0" y="0" width="40" height="5" rx="2" fill="#E33"/></svg>')
BANDEIRA_SVG = (b'<svg xmlns="http://www.w3.org/2000/svg" width="34" height="50" viewBox="0 0 34 50">'
                b'<rect x="2" y="0" width="4" height="50" fill="#666"/>'
                b'<path d="M6 2 L32 10 L6 19 Z" fill="#2CB24A"/></svg>')


def coruja_saltitante():
    p = Projeto()
    k = Blocos(p)
    p.var('estrelas', 0, {'x': 5, 'y': 5})
    INICIO = (-200, -100)

    p.alvo('Palco')
    p.script(20, 20, k.bandeira(),
             k.p2('gravidadeMundo', G=-1),
             k.p2('usarBordas', menus={'MODO': 'paredes'}))
    p.comentario(320, 20, 'Regras do mundo: gravidade -1 (puxa para baixo) e as bordas do palco viram paredes. '
                          'Sem chão nas bordas, quem cair no buraco sai pela parte de baixo!')

    p.alvo('Coruja Sabida')
    p.script(20, 20,
             k.bandeira(), k.va_para(*INICIO), k.tamanho(50), k.mude('estrelas', 0, 'num'),
             k.p2('tornar', menus={'TIPO': 'personagem'}),
             k.p2('pulosNoAr', N=1),
             k.sempre(
                 k.p2('controlar', menus={'TECLAS': 'ambos'}, V=5, F=13),
                 k.se(k.menor(k.y_pos(), -170),
                      k.va_para(*INICIO), k.p2('definirVel', menus={'EIXO': 'y'}, V=0),
                      k.p2('definirVel', menus={'EIXO': 'x'}, V=0)),
                 k.se(k.tocando('Bandeira'),
                      k.diga(k.junte('Cheguei! Peguei ', k.v('estrelas'), ' estrelas!'))))
             )
    p.script(20, 980,
             k.p2('quando', menus={'EVENTO': 'aterrissar'}),
             k.se(k.igual(k.p2('nomeChao'), 'Mola'),
                  k.p2('pular', F=21), k.toque_som('Pio')))
    p.comentario(480, 20, 'O bloco "controlar com setas e WASD" faz tudo sozinho: anda, pula, pula de novo no ar '
                          '(pulo duplo!) e desce das plataformas com a seta para baixo.\n'
                          'Solte a tecla de pulo cedo para dar um pulinho mais baixo.\n\n'
                          'Desafio: mude a velocidade 5 ou o pulo 13, ou "permitir 1 pulos no ar" para 0 ou 2.',
                 360, 220)
    p.comentario(480, 980, 'Quando a coruja pousa em cima da Mola, ela é lançada para cima.\n'
                           '"nome do que está embaixo" diz em qual ator a coruja está pisando.', 360, 120)

    p.alvo('Chão')
    p.script(20, 20, k.bandeira(), k.mostre(),
             k.p2('tornar', menus={'TIPO': 'solido'}),
             k.va_para(-140, -160), k.clone(), k.va_para(140, -160))
    p.comentario(320, 20, 'O chão é "sólido". O clone criado aqui herda o tipo, então os dois pedaços são chão. '
                          'Entre eles fica um buraco!')

    p.alvo('Plataforma')
    p.script(20, 20, k.bandeira(), k.mostre(),
             k.p2('tornar', menus={'TIPO': 'plataforma'}),
             k.va_para(-130, -50), k.clone(), k.va_para(20, 15), k.clone(), k.va_para(-175, 90))
    p.comentario(320, 20, 'Plataformas dão para atravessar pulando por baixo e pousar em cima. '
                          'Para descer, aperte a seta para baixo.')

    p.alvo('Elevador')
    p.script(20, 20, k.bandeira(), k.va_para(80, 110),
             k.p2('tornar', menus={'TIPO': 'solido'}),
             k.sempre(k.deslize(2, 190, 110), k.deslize(2, 80, 110)))
    p.comentario(320, 20, 'Um sólido que se move: quem estiver em cima anda junto!')

    p.alvo('Mola')
    p.script(20, 20, k.bandeira(), k.va_para(200, -131), k.p2('tornar', menus={'TIPO': 'solido'}))

    p.alvo('Estrela')
    posicoes = [(-130, -15), (20, 50), (-175, 125), (135, 150), (200, 60)]
    criar = []
    for (x, y) in posicoes:
        criar += [k.va_para(x, y), k.clone()]
    p.script(20, 20, k.bandeira(), k.esconda(), k.tamanho(60), *criar)
    p.script(20, 420, k.quando_clone(), k.mostre(),
             k.sempre(k.gire(4),
                      k.se(k.tocando('Coruja Sabida'),
                           k.adicione('estrelas', 1), k.toque_som('Pio'), k.apague_clone())))

    p.alvo('Bandeira')
    p.script(20, 20, k.bandeira(), k.va_para(-200, 122))

    montar(p, 'coruja-saltitante.asp', [
        coruja(x=INICIO[0], y=INICIO[1], tamanho=50),
        {'nome': 'Chão', 'fantasias': [('chão', svg_retangulo(200, 40, '#A0521D', '#5BBF4A', 0), 100, 20)],
         'x': 140, 'y': -160},
        {'nome': 'Plataforma', 'fantasias': [('plataforma', svg_retangulo(100, 14, '#E8742C', '#F9B26B'), 50, 7)],
         'x': -175, 'y': 90},
        {'nome': 'Elevador', 'fantasias': [('elevador', svg_retangulo(80, 14, '#5A6CC8', '#9AA8F0'), 40, 7)],
         'x': 80, 'y': 110},
        {'nome': 'Mola', 'fantasias': [('mola', MOLA_SVG, 20, 11)], 'x': 200, 'y': -131},
        {'nome': 'Estrela', 'fantasias': [('estrela', ESTRELA_SVG, 24, 24)], 'visivel': False},
        {'nome': 'Bandeira', 'fantasias': [('bandeira', BANDEIRA_SVG, 4, 25)], 'x': -200, 'y': 122},
    ])


# ------------------------------------------------------------------ 7. Show da Coruja (Músicas)

def show_da_coruja():
    p = Projeto()
    k = Blocos(p)
    musica = json.loads(ler(os.path.join(os.path.dirname(__file__), 'musica-tema-coruja.json')))
    nome = musica['nome']

    p.alvo('Palco')
    p.script(20, 20, k.bandeira(),
             k.mu('repetir', menus={'LIGA': 'sim'}),
             k.mu('volume', V=100),
             k.mu('tocar', musica=nome))
    p.comentario(360, 20, 'A música "Tema da Coruja" foi feita no Criador de Músicas e está salva dentro deste projeto.\n'
                          'Para mudar as notas: categoria Músicas → botão 🎼 Criador de Músicas…', 330, 130)

    p.alvo('Coruja Sabida')
    p.script(20, 20, k.bandeira(), k.va_para(0, -30), k.tamanho(120),
             k.diga('Espaço pausa e continua. Setas mudam a velocidade!', 3))
    p.script(20, 260, k.mu('aCadaBatida'),
             k.tamanho_mude(8), k.espere(0.08), k.tamanho_mude(-8))
    p.script(20, 420, k.mu('quandoBatida', N=9), k.diga('Agora vem o refrão! 🎶', 2))
    p.script(20, 560, k.quando_tecla('space'),
             k.p.b('control_if_else', {
                 'CONDITION': k.mu('esta', menus={'ESTADO': 'tocando'}),
                 'SUBSTACK': Pilha(k.mu('pausar'), k.diga('Pausei ⏸')),
                 'SUBSTACK2': Pilha(k.mu('continuar'), k.diga(''))}, tipos={'CONDITION': 'bool'}))
    p.script(480, 260, k.quando_tecla('up arrow'), k.mu('velocidade', V=150), k.diga('Mais rápido!', 1))
    p.script(480, 400, k.quando_tecla('down arrow'), k.mu('velocidade', V=70), k.diga('Mais devagar…', 1))
    p.script(480, 540, k.quando_tecla('right arrow'), k.mu('velocidade', V=100), k.diga('Normal', 1))
    p.script(480, 680, k.quando_tecla('n'),
             k.mu('nota', menus={'INST': 'sinos'}, NOTA=72, BAT=0.5),
             k.mu('nota', menus={'INST': 'sinos'}, NOTA=79, BAT=1))
    p.comentario(480, 20, '"a cada batida da música" faz a coruja pular no ritmo.\n'
                          '"quando a música chegar na batida 9" avisa o refrão.\n'
                          'Tecla N toca duas notas com o instrumento Sinos.', 320, 130)

    montar(p, 'show-da-coruja.asp', [coruja(x=0, y=-30, tamanho=120)], musicas=[musica])


# ------------------------------------------------------------------ 8. Batalha da Coruja (Jogo de Ritmo)

TUCANO_SVG = (b'<svg xmlns="http://www.w3.org/2000/svg" width="110" height="130" viewBox="0 0 110 130">'
              b'<ellipse cx="45" cy="75" rx="32" ry="50" fill="#18161F"/>'
              b'<ellipse cx="45" cy="62" rx="22" ry="20" fill="#FFF5D6"/>'
              b'<ellipse cx="45" cy="95" rx="16" ry="14" fill="#E8392C"/>'
              b'<path d="M55 45 Q105 40 108 58 Q85 58 55 57 Z" fill="#FF9F1C"/>'
              b'<path d="M55 57 Q85 60 104 62 Q80 70 55 64 Z" fill="#FFD23F"/>'
              b'<circle cx="47" cy="41" r="9" fill="#4FC3F7"/><circle cx="49" cy="41" r="4.5" fill="#18161F"/>'
              b'<path d="M18 40 A30 30 0 0 1 72 35" fill="none" stroke="#E8742C" stroke-width="6"/>'
              b'<rect x="9" y="33" width="12" height="22" rx="5" fill="#E8742C"/>'
              b'<rect x="30" y="122" width="10" height="6" fill="#FF9F1C"/><rect x="50" y="122" width="10" height="6" fill="#FF9F1C"/></svg>')


def mapa_da_melodia(musica, nome):
    """Mesma regra do botão ✨ Gerar do editor: o oponente canta 2 compassos, você responde nos 2 seguintes."""
    ms_passo = 60000 / musica['bpm'] / 4
    mb = 60000 / musica['bpm']
    mel = sorted(musica['faixas'][0]['notas'], key=lambda n: n['p'])
    vistos = set()
    notas = []
    for n in mel:
        if n['p'] in vistos:
            continue
        vistos.add(n['p'])
        t = round(n['p'] * ms_passo)
        d = n['d'] * ms_passo
        notas.append({'t': t, 'pista': n['n'] % 4, 'quem': 'op' if (t // (mb * 8)) % 2 == 0 else 'eu',
                      'dur': round(d - 40) if d >= mb else 0})
    # repete a melodia trocando os lados, para o jogador também cantar a primeira metade
    total = musica['compassos'] * 4 * mb
    for n in list(notas):
        notas.append({**n, 't': round(n['t'] + total), 'quem': 'eu' if n['quem'] == 'op' else 'op'})
    return {'nome': nome, 'modo': 'setas', 'audio': {'tipo': 'musica', 'nome': musica['nome']}, 'bpm': musica['bpm'],
            'offset': 0, 'velocidade': 1, 'oponente': True, 'notas': sorted(notas, key=lambda x: x['t']),
            'circulos': [], 'duracao': 0}


def batalha_da_coruja():
    p = Projeto()
    k = Blocos(p)
    musica = json.loads(ler(os.path.join(os.path.dirname(__file__), 'musica-tema-coruja.json')))
    musica = dict(musica, compassos=4)
    mapa = mapa_da_melodia(musica, 'Batalha da Coruja')
    # a música toca duas vezes (repetir) para cobrir o mapa inteiro: dobramos os compassos
    musica2 = json.loads(json.dumps(musica))
    passos = musica['compassos'] * 16
    for f in musica2['faixas']:
        f['notas'] = f['notas'] + [{**n, 'p': n['p'] + passos} for n in f['notas']]
    for linha, lista in musica2['bateria']['linhas'].items():
        musica2['bateria']['linhas'][linha] = lista + [x + passos for x in lista]
    musica2['compassos'] = musica['compassos'] * 2

    p.alvo('Palco')
    p.script(20, 20, k.bandeira(),
             k.ri('lado', menus={'LADO': 'direita'}),
             k.ri('teclas', menus={'TECLAS': 'setas-dfjk'}),
             k.ri('comecarEsperar', mapa='Batalha da Coruja'),
             k.envie('fim'))
    p.comentario(380, 20, 'O mapa "Batalha da Coruja" foi feito no 🎯 Editor de mapas de ritmo (categoria Jogo de Ritmo).\n'
                          'Ele toca a música "Tema da Coruja", feita no Criador de Músicas.\n'
                          'Jogue com as setas ou D F J K!', 330, 140)

    p.alvo('Coruja Sabida')
    p.script(20, 20, k.bandeira(), k.va_para(150, -80), k.tamanho(110), k.diga('Sua vez quando as setas subirem!', 2))
    p.script(20, 270, k.ri('quandoAcertar', menus={'PISTA': 'qualquer'}),
             k.tamanho_mude(8), k.espere(0.06), k.tamanho_mude(-8))
    p.script(20, 540, k.ri('quandoErrar', menus={'PISTA': 'qualquer'}), k.diga('Ops!', 0.4))
    p.script(20, 720, k.quando_receber('fim'),
             k.diga(k.junte('Fim! Precisão: ', k.junte(k.ri('precisao'), '%')), 3))
    p.script(480, 270, k.ri('quandoAcertar', menus={'PISTA': 'esquerda'}), k.mude_x(-6), k.espere(0.08), k.mude_x(6))
    p.script(480, 540, k.ri('quandoAcertar', menus={'PISTA': 'direita'}), k.mude_x(6), k.espere(0.08), k.mude_x(-6))
    p.comentario(20, 880, '"quando acertar" e "quando errar" animam a coruja. Troque por "tocar animação" '
                           '(extensão Animações) para usar uma spritesheet!', 300, 110)

    p.alvo('Tucano DJ')
    p.script(20, 20, k.bandeira(), k.va_para(-150, -80), k.tamanho(100))
    p.script(20, 230, k.ri('quandoOponente', menus={'PISTA': 'qualquer'}),
             k.tamanho_mude(8), k.espere(0.06), k.tamanho_mude(-8))
    p.comentario(420, 230, '"quando o oponente cantar" acontece em cada nota do lado do oponente.', 260, 80)

    montar(p, 'batalha-da-coruja.asp', [
        coruja(x=150, y=-80, tamanho=110),
        {'nome': 'Tucano DJ', 'fantasias': [('tucano', TUCANO_SVG, 55, 65)], 'x': -150, 'y': -80},
    ], musicas=[musica2], mapas=[mapa])


if __name__ == '__main__':
    print('Gerando exemplos em', SAIDA)
    coruja_coletora()
    calculadora()
    mundo_3d()
    visualizador()
    corrida_3d()
    coruja_saltitante()
    show_da_coruja()
    batalha_da_coruja()
