import json
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone

from .models import CodigoTurma, Denuncia, Recurso, Sancao, StatusRecurso, TipoSancao, sancao_atual

User = get_user_model()


class Base(TestCase):
    def setUp(self):
        cache.clear()
        self.turma = CodigoTurma.objects.create(codigo='7ano-b', turma='7º ano B')
        self.mod = User.objects.create_user('mod', password='senha-forte-123', is_staff=True)

    def post(self, url, dados, token=None):
        headers = {'HTTP_AUTHORIZATION': f'Token {token}'} if token else {}
        return self.client.post(url, json.dumps(dados), content_type='application/json', **headers)

    def get(self, url, token):
        return self.client.get(url, HTTP_AUTHORIZATION=f'Token {token}')

    def registrar(self, usuario='ana', senha='girassol-azul'):
        r = self.post('/api/registrar', {'usuario': usuario, 'senha': senha, 'nome': 'Ana',
                                         'codigo_turma': '7ANO-B'})
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()['token'], User.objects.get(username=usuario)


class ContasTests(Base):
    def test_registro_exige_codigo_valido(self):
        r = self.post('/api/registrar', {'usuario': 'bia', 'senha': 'girassol-azul', 'nome': 'Bia',
                                         'codigo_turma': 'ERRADO'})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()['campo'], 'codigo_turma')

    def test_registro_entrar_eu_sair(self):
        token, _ = self.registrar()
        self.assertEqual(self.get('/api/eu', token).json()['status'], 'ok')
        r = self.post('/api/entrar', {'usuario': 'ANA', 'senha': 'girassol-azul'})
        self.assertEqual(r.status_code, 200)
        token2 = r.json()['token']
        self.assertEqual(self.get('/api/eu', token2).json()['conta']['turma'], '7º ano B')
        self.post('/api/sair', {}, token2)
        self.assertEqual(self.get('/api/eu', token2).status_code, 401)

    def test_bloqueio_apos_muitas_tentativas(self):
        self.registrar()
        for _ in range(8):
            self.post('/api/entrar', {'usuario': 'ana', 'senha': 'errada'})
        r = self.post('/api/entrar', {'usuario': 'ana', 'senha': 'girassol-azul'})
        self.assertEqual(r.status_code, 429)


class SancoesTests(Base):
    def sancionar(self, usuario, tipo, **kw):
        return Sancao.objects.create(usuario=usuario, tipo=tipo, categoria='linguagem',
                                     mensagem='Mensagem de teste', criada_por=self.mod, **kw)

    def test_temporaria_bloqueia_e_expira(self):
        token, ana = self.registrar()
        s = self.sancionar(ana, TipoSancao.TEMPORARIA, fim=timezone.now() + timedelta(hours=2))
        eu = self.get('/api/eu', token).json()
        self.assertEqual(eu['status'], 'suspensa')
        self.assertEqual(eu['sancao']['tipo'], 'temporaria')
        s.fim = timezone.now() - timedelta(minutes=1)
        s.save()
        self.assertEqual(self.get('/api/eu', token).json()['status'], 'ok')

    def test_mais_grave_prevalece(self):
        token, ana = self.registrar()
        self.sancionar(ana, TipoSancao.TEMPORARIA, fim=timezone.now() + timedelta(days=3))
        self.sancionar(ana, TipoSancao.PERMANENTE, permite_recurso=False)
        self.sancionar(ana, TipoSancao.INDEFINIDA)
        self.assertEqual(sancao_atual(ana).tipo, TipoSancao.PERMANENTE)

    def test_suspenso_entra_mas_ve_suspensao(self):
        _, ana = self.registrar()
        self.sancionar(ana, TipoSancao.INDEFINIDA)
        r = self.post('/api/entrar', {'usuario': 'ana', 'senha': 'girassol-azul'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['sancao']['tipo'], 'indefinida')

    def test_advertencia_nao_bloqueia_e_precisa_ciencia(self):
        token, ana = self.registrar()
        adv = self.sancionar(ana, TipoSancao.ADVERTENCIA)
        eu = self.get('/api/eu', token).json()
        self.assertEqual(eu['status'], 'ok')
        self.assertEqual(len(eu['advertencias']), 1)
        eu = self.post(f'/api/advertencias/{adv.id}/ciente', {}, token).json()
        self.assertEqual(eu['advertencias'], [])

    def test_recurso_aceito_revoga(self):
        token, ana = self.registrar()
        s = self.sancionar(ana, TipoSancao.INDEFINIDA)
        r = self.post('/api/recursos', {'sancao': s.id, 'texto': 'Foi um mal-entendido, desculpa.'}, token)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()['sancao']['recurso']['status'], 'pendente')
        dup = self.post('/api/recursos', {'sancao': s.id, 'texto': 'De novo, por favor!!!'}, token)
        self.assertEqual(dup.status_code, 409)
        Recurso.objects.get().responder(True, self.mod, 'Ok, tudo certo.')
        self.assertEqual(self.get('/api/eu', token).json()['status'], 'ok')

    def test_permanente_sem_recurso(self):
        token, ana = self.registrar()
        s = self.sancionar(ana, TipoSancao.PERMANENTE, permite_recurso=False)
        r = self.post('/api/recursos', {'sancao': s.id, 'texto': 'Quero voltar a usar.'}, token)
        self.assertEqual(r.status_code, 403)

    def test_denuncia(self):
        token, _ = self.registrar()
        self.registrar('caio')
        r = self.post('/api/denuncias', {'usuario': 'caio', 'categoria': 'bullying',
                                         'descricao': 'Ficou xingando no projeto da turma.'}, token)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Denuncia.objects.get().denunciado.username, 'caio')

    def test_suspenso_nao_denuncia(self):
        token, ana = self.registrar()
        self.registrar('caio')
        self.sancionar(ana, TipoSancao.INDEFINIDA)
        r = self.post('/api/denuncias', {'usuario': 'caio', 'categoria': 'spam', 'descricao': 'xxxxxxxxxxxx'}, token)
        self.assertEqual(r.status_code, 403)

    def test_cors(self):
        r = self.client.options('/api/eu', HTTP_ORIGIN='http://localhost:8601')
        self.assertEqual(r['Access-Control-Allow-Origin'], 'http://localhost:8601')
        r = self.client.options('/api/eu', HTTP_ORIGIN='https://site-estranho.com')
        self.assertFalse(r.has_header('Access-Control-Allow-Origin'))

    def test_painel_moderacao_abre(self):
        _, ana = self.registrar()
        self.sancionar(ana, TipoSancao.TEMPORARIA, fim=timezone.now() + timedelta(days=1))
        Denuncia.objects.create(denunciante=self.mod, denunciado=ana, categoria='spam', descricao='teste teste')
        admin = User.objects.create_superuser('dir', password='senha-forte-123')
        self.client.force_login(admin)
        for url in ['/moderacao/', '/moderacao/contas/sancao/', '/moderacao/contas/denuncia/',
                    '/moderacao/contas/recurso/', '/moderacao/auth/user/', '/moderacao/contas/sancao/add/',
                    f'/moderacao/contas/denuncia/{Denuncia.objects.get().id}/change/']:
            self.assertEqual(self.client.get(url).status_code, 200, url)
        self.assertEqual(StatusRecurso.PENDENTE, 'pendente')
