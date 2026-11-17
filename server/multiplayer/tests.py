import json

from asgiref.testing import ApplicationCommunicator
from django.contrib.auth.models import User
from django.test import TransactionTestCase

from contas.models import Sancao, TipoSancao, TokenAcesso
from multiplayer.servidor import SALAS, app_websocket


def conexao(token=''):
    scope = {'type': 'websocket', 'path': '/api/multiplayer', 'query_string': f'token={token}'.encode(),
             'headers': [(b'host', b'testserver')]}
    return ApplicationCommunicator(app_websocket, scope)


async def abrir(token):
    c = conexao(token)
    await c.send_input({'type': 'websocket.connect'})
    assert (await c.receive_output(2))['type'] == 'websocket.accept'
    return c


async def ler(c):
    return json.loads((await c.receive_output(2))['text'])


async def enviar(c, dados):
    await c.send_input({'type': 'websocket.receive', 'text': json.dumps(dados)})


class MultiplayerTestes(TransactionTestCase):
    def setUp(self):
        SALAS.clear()
        self.ana = User.objects.create_user('ana')
        self.bia = User.objects.create_user('bia')
        self.t_ana = TokenAcesso.criar(self.ana)
        self.t_bia = TokenAcesso.criar(self.bia)
        self.t_cau = TokenAcesso.criar(User.objects.create_user('cau'))

    async def test_so_membros(self):
        c = await abrir('')
        msg = await ler(c)
        self.assertEqual(msg['t'], 'erro')
        self.assertIn('membros', msg['motivo'])
        self.assertEqual((await c.receive_output(2))['type'], 'websocket.close')

    async def test_suspenso_nao_entra(self):
        from asgiref.sync import sync_to_async
        await sync_to_async(Sancao.objects.create)(usuario=self.bia, tipo=TipoSancao.PERMANENTE, categoria='outro',
                                                   mensagem='teste')
        c = await abrir(self.t_bia)
        self.assertIn('suspensa', (await ler(c))['motivo'])

    async def test_sala_mensagens_variaveis_estado(self):
        a = await abrir(self.t_ana)
        b = await abrir(self.t_bia)
        self.assertEqual((await ler(a))['t'], 'ola')
        self.assertEqual((await ler(b))['t'], 'ola')
        await enviar(a, {'t': 'entrar', 'sala': 'corrida', 'max': 2})
        self.assertEqual((await ler(a))['t'], 'entrou')
        await enviar(b, {'t': 'entrar', 'sala': 'corrida'})
        entrou = await ler(b)
        self.assertEqual(len(entrou['jogadores']), 2)
        self.assertEqual((await ler(a))['t'], 'chegou')
        await enviar(a, {'t': 'msg', 'nome': 'pulo', 'dado': 3})
        m = await ler(b)
        self.assertEqual((m['nome'], m['dado']), ('pulo', 3))
        await enviar(b, {'t': 'var', 'nome': 'placar', 'valor': '7'})
        self.assertEqual((await ler(a))['valor'], '7')
        await enviar(a, {'t': 'eu', 'dados': {'x': 10}})
        self.assertEqual((await ler(b))['dados'], {'x': 10})
        # sala cheia
        c = await abrir(self.t_cau)
        await ler(c)
        await enviar(c, {'t': 'entrar', 'sala': 'corrida'})
        self.assertIn('cheia', (await ler(c))['motivo'])
        # quem sai avisa os outros; sala vazia some
        await a.send_input({'type': 'websocket.disconnect', 'code': 1000})
        self.assertEqual((await ler(b))['t'], 'saiu')
        await b.send_input({'type': 'websocket.disconnect', 'code': 1000})
        await b.wait(2)
        self.assertNotIn('corrida', SALAS)
