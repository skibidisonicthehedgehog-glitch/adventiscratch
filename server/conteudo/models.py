"""
Conteúdo enviado pelos alunos: projetos salvos na nuvem, modelos 3D da loja e instrumentos (.sf2) da
Loja de Instrumentos Virtuais.

Tudo que é compartilhado é GLOBAL (todas as turmas veem), mas só para quem está logado neste servidor.
Moderadores podem ocultar qualquer item; conteúdo de contas com suspensão indefinida ou permanente
sai das listas públicas automaticamente.
"""
import os
import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

User = settings.AUTH_USER_MODEL


def _caminho(pasta, ext):
    return f'{pasta}/{timezone.now():%Y/%m}/{uuid.uuid4().hex}.{ext}'


def caminho_projeto(instancia, nome_original):
    return _caminho('projetos', 'asp')


def caminho_pacote(instancia, nome_original):
    return _caminho('modelos', 'zip')


def caminho_sf2(instancia, nome_original):
    return _caminho('instrumentos', 'sf2')


def caminho_miniatura(instancia, nome_original):
    return _caminho('miniaturas', 'png')


class Situacao(models.TextChoices):
    PUBLICADO = 'publicado', 'Publicado'
    PENDENTE = 'pendente', 'Aguardando aprovação'
    OCULTO = 'oculto', 'Oculto pela moderação'


class ConteudoQuerySet(models.QuerySet):
    def visiveis(self):
        """Itens que podem aparecer nas listas públicas (galeria e loja)."""
        from contas.models import Sancao, TipoSancao
        agora = timezone.now()
        bloqueados = Sancao.objects.em_vigor(agora).filter(
            tipo__in=[TipoSancao.INDEFINIDA, TipoSancao.PERMANENTE]
        ).values('usuario_id')
        return self.filter(situacao=Situacao.PUBLICADO, apagado_em__isnull=True).exclude(
            dono_id__in=bloqueados).exclude(dono__is_active=False)

    def ativos(self):
        return self.filter(apagado_em__isnull=True)

    def busca(self, termo):
        termo = (termo or '').strip()
        if not termo:
            return self
        return self.filter(Q(titulo__icontains=termo) | Q(descricao__icontains=termo) |
                           Q(dono__perfil__nome_exibicao__icontains=termo) | Q(dono__username__icontains=termo))


class Conteudo(models.Model):
    dono = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name='dono')
    titulo = models.CharField('título', max_length=80)
    descricao = models.TextField('descrição', max_length=1000, blank=True)
    miniatura = models.FileField('miniatura', upload_to=caminho_miniatura, blank=True)
    situacao = models.CharField('situação', max_length=12, choices=Situacao.choices, default=Situacao.PUBLICADO)
    nota_moderacao = models.TextField('nota da moderação', blank=True,
                                      help_text='Motivo de ocultar. O dono vê este texto.')
    tamanho = models.PositiveIntegerField('tamanho (bytes)', default=0)
    criado_em = models.DateTimeField('criado em', auto_now_add=True)
    atualizado_em = models.DateTimeField('atualizado em', auto_now=True)
    apagado_em = models.DateTimeField('apagado pelo dono em', null=True, blank=True)

    objects = ConteudoQuerySet.as_manager()

    class Meta:
        abstract = True
        ordering = ['-atualizado_em']

    def __str__(self):
        return self.titulo

    def apagar_arquivos(self):
        for campo in self.campos_arquivo():
            arq = getattr(self, campo)
            if arq and arq.name:
                try:
                    arq.storage.delete(arq.name)
                except OSError:
                    pass

    @staticmethod
    def campos_arquivo():
        return ['miniatura']


class Projeto(Conteudo):
    arquivo = models.FileField('arquivo .asp', upload_to=caminho_projeto)
    compartilhado = models.BooleanField('compartilhado com todos', default=False)
    compartilhado_em = models.DateTimeField('compartilhado em', null=True, blank=True)
    remixado_de = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='remixes', verbose_name='remix de')
    visualizacoes = models.PositiveIntegerField('visualizações', default=0)

    class Meta(Conteudo.Meta):
        verbose_name = 'projeto'
        verbose_name_plural = 'projetos'

    @staticmethod
    def campos_arquivo():
        return ['miniatura', 'arquivo']


class Licenca(models.TextChoices):
    MEU = 'meu', 'Feito por mim'
    CC0 = 'cc0', 'Domínio público (CC0)'
    CC_BY = 'cc-by', 'Livre com crédito ao autor (CC BY)'
    PERMISSAO = 'permissao', 'Tenho permissão do autor'


class Modelo3D(Conteudo):
    pacote = models.FileField('pacote (modelo + texturas)', upload_to=caminho_pacote)
    formato = models.CharField('formato', max_length=8)
    licenca = models.CharField('licença', max_length=12, choices=Licenca.choices)
    credito = models.CharField('crédito / autor original', max_length=160, blank=True)
    tags = models.CharField('etiquetas', max_length=160, blank=True, help_text='Separadas por vírgula')
    animacoes = models.PositiveIntegerField('animações', default=0)
    texturas = models.PositiveIntegerField('arquivos de textura', default=0)
    downloads = models.PositiveIntegerField('vezes usado', default=0)

    class Meta(Conteudo.Meta):
        verbose_name = 'modelo 3D da loja'
        verbose_name_plural = 'modelos 3D da loja'

    @staticmethod
    def campos_arquivo():
        return ['miniatura', 'pacote']


class InstrumentoSF2(Conteudo):
    """SoundFont (.sf2) da Loja de Instrumentos Virtuais. O aluno escolhe o instrumento (preset) ao usar."""
    arquivo = models.FileField('arquivo .sf2', upload_to=caminho_sf2)
    licenca = models.CharField('licença', max_length=12, choices=Licenca.choices)
    credito = models.CharField('crédito / autor original', max_length=160, blank=True)
    tags = models.CharField('etiquetas', max_length=160, blank=True, help_text='Separadas por vírgula')
    presets = models.PositiveIntegerField('instrumentos dentro do arquivo', default=0)
    nomes_presets = models.TextField('nomes dos instrumentos', blank=True, help_text='Um por linha')
    downloads = models.PositiveIntegerField('vezes usado', default=0)

    class Meta(Conteudo.Meta):
        verbose_name = 'instrumento (.sf2) da loja'
        verbose_name_plural = 'instrumentos (.sf2) da loja'

    @staticmethod
    def campos_arquivo():
        return ['miniatura', 'arquivo']


def nome_publico(usuario):
    perfil = getattr(usuario, 'perfil', None)
    return perfil.nome_exibicao if perfil else usuario.username


def extensao(nome):
    return os.path.splitext(nome or '')[1].lower().lstrip('.')
