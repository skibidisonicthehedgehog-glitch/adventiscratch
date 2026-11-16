"""
Modelos de contas e moderação do Adventiscratch.

- Perfil: dados extras do aluno (nome de exibição e turma). Não guardamos e-mail nem dados pessoais.
- CodigoTurma: código que o aluno usa para criar conta (dificulta criar contas para burlar suspensões).
- Sancao: advertência, suspensão temporária, indefinida ou permanente.
- Denuncia: um usuário denuncia outro.
- Recurso: o aluno pede revisão de uma sanção.
- TokenAcesso: login do editor (o editor guarda só a chave; o servidor guarda só o hash).
"""
import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

User = settings.AUTH_USER_MODEL


class CodigoTurma(models.Model):
    codigo = models.CharField('código', max_length=32, unique=True,
                              help_text='O aluno digita este código para criar a conta. Ex.: 7ANO-B-2026')
    turma = models.CharField('turma', max_length=80, help_text='Ex.: 7º ano B')
    ativo = models.BooleanField('ativo', default=True, help_text='Desmarque para impedir novos cadastros')
    limite_contas = models.PositiveIntegerField('limite de contas', null=True, blank=True,
                                                help_text='Deixe vazio para não limitar')
    criado_em = models.DateTimeField('criado em', auto_now_add=True)

    class Meta:
        verbose_name = 'código de turma'
        verbose_name_plural = 'códigos de turma'
        ordering = ['turma']

    def __str__(self):
        return f'{self.turma} ({self.codigo})'

    def save(self, *args, **kwargs):
        self.codigo = self.codigo.strip().upper()
        super().save(*args, **kwargs)


class Perfil(models.Model):
    usuario = models.OneToOneField(User, on_delete=models.CASCADE, related_name='perfil', verbose_name='usuário')
    nome_exibicao = models.CharField('nome de exibição', max_length=40)
    turma = models.ForeignKey(CodigoTurma, on_delete=models.SET_NULL, null=True, blank=True,
                              related_name='alunos', verbose_name='turma')
    criado_em = models.DateTimeField('criado em', auto_now_add=True)

    class Meta:
        verbose_name = 'perfil'
        verbose_name_plural = 'perfis'

    def __str__(self):
        return self.nome_exibicao


class CategoriaMotivo(models.TextChoices):
    LINGUAGEM = 'linguagem', 'Linguagem ofensiva ou palavrões'
    BULLYING = 'bullying', 'Bullying, assédio ou ameaças'
    IMPROPRIO = 'improprio', 'Conteúdo impróprio'
    DADOS_PESSOAIS = 'dados_pessoais', 'Compartilhar dados pessoais'
    SPAM = 'spam', 'Spam ou propaganda'
    COPIA = 'copia', 'Copiar trabalho de outra pessoa'
    BURLAR = 'burlar', 'Tentar burlar uma suspensão (outra conta)'
    SEGURANCA = 'seguranca', 'Risco à segurança da conta'
    OUTRO = 'outro', 'Outro motivo'


class TipoSancao(models.TextChoices):
    ADVERTENCIA = 'advertencia', 'Advertência'
    TEMPORARIA = 'temporaria', 'Suspensão temporária'
    INDEFINIDA = 'indefinida', 'Suspensão indefinida (até revisão)'
    PERMANENTE = 'permanente', 'Suspensão permanente (conta encerrada)'


# quanto maior, mais grave (decide qual sanção aparece quando há mais de uma ativa)
GRAVIDADE = {
    TipoSancao.ADVERTENCIA: 0,
    TipoSancao.TEMPORARIA: 1,
    TipoSancao.INDEFINIDA: 2,
    TipoSancao.PERMANENTE: 3,
}


class SancaoQuerySet(models.QuerySet):
    def em_vigor(self, agora=None):
        """Suspensões que bloqueiam a conta agora (advertências não bloqueiam)."""
        agora = agora or timezone.now()
        return self.filter(revogada_em__isnull=True, inicio__lte=agora).exclude(
            tipo=TipoSancao.ADVERTENCIA
        ).filter(Q(fim__isnull=True) | Q(fim__gt=agora))


class Sancao(models.Model):
    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sancoes', verbose_name='usuário')
    tipo = models.CharField('tipo', max_length=20, choices=TipoSancao.choices)
    categoria = models.CharField('motivo', max_length=20, choices=CategoriaMotivo.choices)
    mensagem = models.TextField(
        'mensagem para o aluno',
        help_text='O aluno vê este texto na tela. Explique com calma o que aconteceu e o que se espera dele.'
    )
    notas_internas = models.TextField('notas internas', blank=True,
                                      help_text='Só moderadores veem. Ex.: links, provas, conversa com a família.')
    inicio = models.DateTimeField('início', default=timezone.now)
    fim = models.DateTimeField('fim', null=True, blank=True,
                               help_text='Obrigatório na suspensão temporária. Vazio nos outros tipos.')
    permite_recurso = models.BooleanField('aluno pode pedir revisão', default=True)
    denuncia = models.ForeignKey('Denuncia', on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name='sancoes', verbose_name='denúncia de origem')
    criada_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='sancoes_aplicadas',
                                   verbose_name='aplicada por')
    criada_em = models.DateTimeField('aplicada em', auto_now_add=True)
    ciente_em = models.DateTimeField('aluno ciente em', null=True, blank=True)
    revogada_em = models.DateTimeField('revogada em', null=True, blank=True)
    revogada_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='sancoes_revogadas', verbose_name='revogada por')
    motivo_revogacao = models.TextField('motivo da revogação', blank=True)

    objects = SancaoQuerySet.as_manager()

    class Meta:
        verbose_name = 'sanção'
        verbose_name_plural = 'sanções'
        ordering = ['-criada_em']

    def __str__(self):
        return f'{self.get_tipo_display()} – {self.usuario}'

    def clean(self):
        if self.tipo == TipoSancao.TEMPORARIA:
            if not self.fim:
                raise ValidationError({'fim': 'Informe quando a suspensão temporária termina.'})
            if self.fim <= (self.inicio or timezone.now()):
                raise ValidationError({'fim': 'O fim precisa ser depois do início.'})
        elif self.fim:
            raise ValidationError({'fim': 'Só a suspensão temporária tem data de fim. Deixe este campo vazio.'})

    @property
    def em_vigor(self):
        agora = timezone.now()
        if self.revogada_em or self.inicio > agora:
            return False
        if self.tipo == TipoSancao.ADVERTENCIA:
            return False
        return self.fim is None or self.fim > agora

    def revogar(self, por, motivo=''):
        self.revogada_em = timezone.now()
        self.revogada_por = por
        self.motivo_revogacao = motivo
        self.save(update_fields=['revogada_em', 'revogada_por', 'motivo_revogacao'])

    def para_api(self):
        recurso = self.recursos.order_by('-criado_em').first()
        return {
            'id': self.id,
            'tipo': self.tipo,
            'tipo_nome': self.get_tipo_display(),
            'categoria': self.categoria,
            'categoria_nome': self.get_categoria_display(),
            'mensagem': self.mensagem,
            'inicio': self.inicio.isoformat(),
            'fim': self.fim.isoformat() if self.fim else None,
            'permite_recurso': self.permite_recurso and self.tipo != TipoSancao.ADVERTENCIA,
            'recurso': recurso.para_api() if recurso else None,
        }


def sancao_atual(usuario):
    """A suspensão mais grave em vigor (ou None). Entre duas iguais, a que termina por último."""
    ativas = list(Sancao.objects.em_vigor().filter(usuario=usuario))
    if not ativas:
        return None
    longe = timezone.now() + timedelta(days=365 * 1000)
    return max(ativas, key=lambda s: (GRAVIDADE[s.tipo], s.fim or longe))


class StatusDenuncia(models.TextChoices):
    ABERTA = 'aberta', 'Aberta'
    ANALISE = 'analise', 'Em análise'
    RESOLVIDA = 'resolvida', 'Resolvida (houve sanção)'
    DESCARTADA = 'descartada', 'Descartada (sem problema)'


class Denuncia(models.Model):
    denunciante = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='denuncias_feitas',
                                    verbose_name='quem denunciou')
    denunciado = models.ForeignKey(User, on_delete=models.CASCADE, related_name='denuncias_recebidas',
                                   verbose_name='denunciado')
    categoria = models.CharField('motivo', max_length=20, choices=CategoriaMotivo.choices)
    descricao = models.TextField('o que aconteceu', max_length=2000)
    status = models.CharField('situação', max_length=20, choices=StatusDenuncia.choices,
                              default=StatusDenuncia.ABERTA)
    criada_em = models.DateTimeField('criada em', auto_now_add=True)
    tratada_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='denuncias_tratadas', verbose_name='tratada por')
    nota_moderador = models.TextField('nota do moderador', blank=True)

    class Meta:
        verbose_name = 'denúncia'
        verbose_name_plural = 'denúncias'
        ordering = ['-criada_em']

    def __str__(self):
        return f'{self.get_categoria_display()} – {self.denunciado}'


class StatusRecurso(models.TextChoices):
    PENDENTE = 'pendente', 'Aguardando análise'
    ACEITO = 'aceito', 'Aceito (sanção revogada)'
    NEGADO = 'negado', 'Negado (sanção mantida)'


class Recurso(models.Model):
    sancao = models.ForeignKey(Sancao, on_delete=models.CASCADE, related_name='recursos', verbose_name='sanção')
    texto = models.TextField('pedido do aluno', max_length=2000)
    status = models.CharField('situação', max_length=20, choices=StatusRecurso.choices,
                              default=StatusRecurso.PENDENTE)
    resposta = models.TextField('resposta para o aluno', blank=True)
    criado_em = models.DateTimeField('enviado em', auto_now_add=True)
    respondido_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                       related_name='recursos_respondidos', verbose_name='respondido por')
    respondido_em = models.DateTimeField('respondido em', null=True, blank=True)

    class Meta:
        verbose_name = 'pedido de revisão'
        verbose_name_plural = 'pedidos de revisão'
        ordering = ['-criado_em']

    def __str__(self):
        return f'Revisão de {self.sancao}'

    def para_api(self):
        return {
            'status': self.status,
            'status_nome': self.get_status_display(),
            'resposta': self.resposta,
            'criado_em': self.criado_em.isoformat(),
        }

    def responder(self, aceito, por, resposta=''):
        self.status = StatusRecurso.ACEITO if aceito else StatusRecurso.NEGADO
        self.resposta = resposta
        self.respondido_por = por
        self.respondido_em = timezone.now()
        self.save()
        if aceito and not self.sancao.revogada_em:
            self.sancao.revogar(por, f'Pedido de revisão aceito. {resposta}'.strip())


def _hash(chave):
    return hashlib.sha256(chave.encode()).hexdigest()


class TokenAcesso(models.Model):
    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tokens', verbose_name='usuário')
    chave_hash = models.CharField(max_length=64, unique=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    usado_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'sessão do editor'
        verbose_name_plural = 'sessões do editor'

    @classmethod
    def criar(cls, usuario):
        chave = secrets.token_urlsafe(32)
        cls.objects.create(usuario=usuario, chave_hash=_hash(chave))
        return chave

    @classmethod
    def usuario_da_chave(cls, chave):
        limite = timezone.now() - timedelta(days=settings.ADVENTISCRATCH_TOKEN_DIAS)
        token = cls.objects.select_related('usuario').filter(
            chave_hash=_hash(chave), criado_em__gte=limite
        ).first()
        if not token or not token.usuario.is_active:
            return None
        if not token.usado_em or timezone.now() - token.usado_em > timedelta(minutes=5):
            token.usado_em = timezone.now()
            token.save(update_fields=['usado_em'])
        return token.usuario

    @classmethod
    def apagar_chave(cls, chave):
        cls.objects.filter(chave_hash=_hash(chave)).delete()
