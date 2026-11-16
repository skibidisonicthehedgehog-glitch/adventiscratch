import io
import json
import shutil
import tempfile
import zipfile

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from contas.models import CodigoTurma, Denuncia, Sancao, TipoSancao

from .models import Modelo3D, Projeto, Situacao

User = get_user_model()
PNG = b'\x89PNG\r\n\x1a\n' + b'\x00' * 50
MIDIA = tempfile.mkdtemp()


def zip_bytes(arquivos):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z:
        for nome, dados in arquivos.items():
            z.writestr(nome, dados)
    return buf.getvalue()


def asp():
    return SimpleUploadedFile('p.asp', zip_bytes({'project.json': json.dumps({'targets': []})}))


def pacote(extra=None, modelo='heroi.glb'):
    arquivos = {'manifest.json': json.dumps({'modelo': modelo, 'recursos': ['pele.png']}),
                modelo: b'glTF....', 'pele.png': PNG}
    arquivos.update(extra or {})
    return SimpleUploadedFile('m.zip', zip_bytes(arquivos))


@override_settings(MEDIA_ROOT=MIDIA)
class Base(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MIDIA, ignore_errors=True)

    def setUp(self):
        cache.clear()
        CodigoTurma.objects.create(codigo='7A', turma='7º A')
        CodigoTurma.objects.create(codigo='8B', turma='8º B')
        self.ana = self.registrar('ana', '7A')
        self.caio = self.registrar('caio', '8B')
        self.mod = User.objects.create_superuser('mod', password='senha-forte-123')

    def registrar(self, usuario, turma):
        r = self.client.post('/api/registrar', json.dumps({
            'usuario': usuario, 'senha': 'girassol-azul', 'nome': usuario.title(), 'codigo_turma': turma}),
            content_type='application/json')
        return r.json()['token']

    def h(self, token):
        return {'HTTP_AUTHORIZATION': f'Token {token}'}

    def novo_projeto(self, token, compartilhar=False, titulo='Meu jogo'):
        r = self.client.post('/api/projetos', {'arquivo': asp(), 'titulo': titulo, 'compartilhar': compartilhar,
                                               'miniatura': SimpleUploadedFile('m.png', PNG)}, **self.h(token))
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()['projeto']['id']

    def publicar(self, token, **extra):
        dados = {'pacote': pacote(), 'titulo': 'Herói', 'licenca': 'meu', 'confirmo': '1',
                 'miniatura': SimpleUploadedFile('m.png', PNG)}
        dados.update(extra)
        return self.client.post('/api/modelos', dados, **self.h(token))


class ProjetosTests(Base):
    def test_salvar_e_listar_meus(self):
        pid = self.novo_projeto(self.ana)
        meus = self.client.get('/api/projetos/meus', **self.h(self.ana)).json()['projetos']
        self.assertEqual([p['id'] for p in meus], [pid])
        r = self.client.get(f'/api/projetos/{pid}/arquivo', **self.h(self.ana))
        self.assertEqual(r.status_code, 200)
        self.assertIn(b'project.json', b''.join(r.streaming_content))

    def test_privado_nao_aparece_para_outra_turma(self):
        pid = self.novo_projeto(self.ana)
        self.assertEqual(self.client.get(f'/api/projetos/{pid}/arquivo', **self.h(self.caio)).status_code, 404)
        self.assertEqual(self.client.get('/api/explorar', **self.h(self.caio)).json()['projetos'], [])

    def test_compartilhado_e_global(self):
        pid = self.novo_projeto(self.ana, compartilhar=True)
        lista = self.client.get('/api/explorar', **self.h(self.caio)).json()['projetos']
        self.assertEqual(lista[0]['id'], pid)
        self.assertEqual(lista[0]['autor']['nome'], 'Ana')
        self.assertNotIn('turma', lista[0]['autor'])
        self.assertEqual(self.client.get(f'/api/projetos/{pid}/arquivo', **self.h(self.caio)).status_code, 200)
        # outro aluno não altera, mas pode salvar um remix
        r = self.client.post(f'/api/projetos/{pid}', {'titulo': 'hackeado'}, **self.h(self.caio))
        self.assertEqual(r.status_code, 403)
        r = self.client.post('/api/projetos', {'arquivo': asp(), 'titulo': 'Remix', 'remixado_de': pid},
                             **self.h(self.caio))
        self.assertEqual(r.json()['projeto']['remixado_de'], pid)

    def test_atualizar_e_parar_de_compartilhar(self):
        pid = self.novo_projeto(self.ana, compartilhar=True)
        r = self.client.post(f'/api/projetos/{pid}', {'arquivo': asp(), 'titulo': 'Versão 2'}, **self.h(self.ana))
        self.assertEqual(r.json()['projeto']['titulo'], 'Versão 2')
        self.client.post(f'/api/projetos/{pid}/compartilhar', json.dumps({'compartilhar': False}),
                         content_type='application/json', **self.h(self.ana))
        self.assertEqual(self.client.get('/api/explorar', **self.h(self.caio)).json()['projetos'], [])

    def test_arquivo_invalido(self):
        r = self.client.post('/api/projetos', {'arquivo': SimpleUploadedFile('x.asp', b'nao sou zip'), 'titulo': 'x'},
                             **self.h(self.ana))
        self.assertEqual(r.status_code, 400)
        ruim = SimpleUploadedFile('x.asp', zip_bytes({'../../etc/passwd': 'x', 'project.json': '{}'}))
        self.assertEqual(self.client.post('/api/projetos', {'arquivo': ruim, 'titulo': 'x'},
                                          **self.h(self.ana)).status_code, 400)

    def test_apagar(self):
        pid = self.novo_projeto(self.ana, compartilhar=True)
        self.client.post(f'/api/projetos/{pid}/apagar', **self.h(self.ana))
        self.assertEqual(self.client.get('/api/projetos/meus', **self.h(self.ana)).json()['projetos'], [])
        self.assertEqual(self.client.get('/api/explorar', **self.h(self.caio)).json()['projetos'], [])

    def test_sem_login(self):
        self.assertEqual(self.client.get('/api/explorar').status_code, 401)


class LojaTests(Base):
    def test_publicar_e_outro_usar(self):
        r = self.publicar(self.ana)
        self.assertEqual(r.status_code, 201, r.content)
        mid = r.json()['modelo']['id']
        loja = self.client.get('/api/modelos', **self.h(self.caio)).json()
        self.assertEqual(loja['modelos'][0]['texturas'], 1)
        r = self.client.get(f'/api/modelos/{mid}/pacote', **self.h(self.caio))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Modelo3D.objects.get().downloads, 1)
        self.assertEqual(self.client.get(f'/api/modelos/{mid}/miniatura', **self.h(self.caio)).status_code, 200)

    def test_exige_confirmacao_e_credito(self):
        self.assertEqual(self.publicar(self.ana, confirmo='').json()['campo'], 'confirmo')
        self.assertEqual(self.publicar(self.ana, licenca='cc-by').json()['campo'], 'credito')
        self.assertEqual(self.publicar(self.ana, licenca='cc-by', credito='Fulano').status_code, 201)

    def test_pacote_invalido(self):
        self.assertEqual(self.publicar(self.ana, pacote=pacote({'virus.exe': b'MZ'})).status_code, 400)
        self.assertEqual(self.publicar(self.ana, pacote=pacote(modelo='x.txt')).status_code, 400)

    def test_ocultar_e_aprovacao(self):
        mid = self.publicar(self.ana).json()['modelo']['id']
        Modelo3D.objects.filter(id=mid).update(situacao=Situacao.OCULTO, nota_moderacao='Direitos autorais')
        self.assertEqual(self.client.get('/api/modelos', **self.h(self.caio)).json()['modelos'], [])
        self.assertEqual(self.client.get(f'/api/modelos/{mid}/pacote', **self.h(self.caio)).status_code, 404)
        meus = self.client.get('/api/modelos/meus', **self.h(self.ana)).json()['modelos']
        self.assertEqual(meus[0]['nota_moderacao'], 'Direitos autorais')
        with self.settings(ADVENTISCRATCH_APROVAR_MODELOS=True):
            self.assertEqual(self.publicar(self.ana).json()['modelo']['situacao'], 'pendente')

    def test_suspenso_sai_das_listas_e_nao_envia(self):
        self.publicar(self.ana)
        self.novo_projeto(self.ana, compartilhar=True)
        ana = User.objects.get(username='ana')
        Sancao.objects.create(usuario=ana, tipo=TipoSancao.INDEFINIDA, categoria='direitos', mensagem='x')
        self.assertEqual(self.client.get('/api/modelos', **self.h(self.caio)).json()['modelos'], [])
        self.assertEqual(self.client.get('/api/explorar', **self.h(self.caio)).json()['projetos'], [])
        token = self.client.post('/api/entrar', json.dumps({'usuario': 'ana', 'senha': 'girassol-azul'}),
                                 content_type='application/json').json()['token']
        self.assertEqual(self.publicar(token).status_code, 403)

    def test_denunciar_modelo(self):
        mid = self.publicar(self.ana).json()['modelo']['id']
        r = self.client.post('/api/denuncias', json.dumps({'modelo': mid, 'categoria': 'direitos',
                                                           'descricao': 'Esse modelo é de um jogo famoso.'}),
                             content_type='application/json', **self.h(self.caio))
        self.assertEqual(r.status_code, 201)
        d = Denuncia.objects.get()
        self.assertEqual((d.modelo_id, d.denunciado.username), (mid, 'ana'))

    def test_painel(self):
        mid = self.publicar(self.ana).json()['modelo']['id']
        pid = self.novo_projeto(self.ana, compartilhar=True)
        self.client.post('/api/denuncias', json.dumps({'projeto': pid, 'categoria': 'spam',
                                                       'descricao': 'Projeto cheio de propaganda.'}),
                         content_type='application/json', **self.h(self.caio))
        self.client.force_login(self.mod)
        for url in ['/moderacao/conteudo/projeto/', '/moderacao/conteudo/modelo3d/',
                    f'/moderacao/conteudo/projeto/{pid}/change/', f'/moderacao/conteudo/modelo3d/{mid}/change/',
                    f'/moderacao/contas/denuncia/{Denuncia.objects.get().id}/change/',
                    f'/moderacao/arquivo/modelo/{mid}/', f'/moderacao/arquivo/projeto/{pid}/']:
            self.assertEqual(self.client.get(url).status_code, 200, url)
        self.assertEqual(Projeto.objects.count(), 1)
