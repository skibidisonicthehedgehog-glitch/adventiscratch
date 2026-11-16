"""
Painel de moderação (admin do Django, em /moderacao/).

Fluxo típico:
 1. Denúncias → abrir a denúncia → "Aplicar sanção ao denunciado" (formulário já preenchido).
 2. Sanções → escolher tipo (advertência, temporária, indefinida, permanente), motivo e mensagem.
 3. Pedidos de revisão → aceitar (revoga a sanção) ou negar, com resposta para o aluno.
"""
from datetime import timedelta

from django.contrib import admin, messages
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin
from django.urls import reverse
from django.utils import timezone
from django.utils.html import format_html

from .models import (
    CodigoTurma, Denuncia, Perfil, Recurso, Sancao, StatusDenuncia, StatusRecurso, TipoSancao, TokenAcesso,
    sancao_atual,
)

User = get_user_model()

CORES = {
    TipoSancao.ADVERTENCIA: '#2563EB',
    TipoSancao.TEMPORARIA: '#D97706',
    TipoSancao.INDEFINIDA: '#7C3AED',
    TipoSancao.PERMANENTE: '#DC2626',
}


def selo(texto, cor):
    return format_html(
        '<span style="background:{};color:#fff;padding:2px 8px;border-radius:999px;font-weight:600;'
        'white-space:nowrap">{}</span>', cor, texto)


def link_sancionar(usuario_id, denuncia_id=None):
    url = reverse('admin:contas_sancao_add') + f'?usuario={usuario_id}'
    if denuncia_id:
        url += f'&denuncia={denuncia_id}'
    return url


# ---------------------------------------------------------------- usuários

class PerfilInline(admin.StackedInline):
    model = Perfil
    can_delete = False
    extra = 0


class SancaoInline(admin.TabularInline):
    model = Sancao
    fk_name = 'usuario'
    extra = 0
    fields = ('tipo', 'categoria', 'inicio', 'fim', 'revogada_em', 'link')
    readonly_fields = fields
    can_delete = False
    show_change_link = True
    verbose_name_plural = 'histórico de sanções'

    def link(self, obj):
        return format_html('<a href="{}">abrir</a>', reverse('admin:contas_sancao_change', args=[obj.id]))
    link.short_description = ''

    def has_add_permission(self, request, obj=None):
        return False


admin.site.unregister(User)


@admin.register(User)
class UsuarioAdmin(UserAdmin):
    inlines = [PerfilInline, SancaoInline]
    list_display = ('username', 'nome', 'turma', 'situacao', 'is_staff', 'date_joined', 'acoes')
    list_filter = ('is_staff', 'is_active', 'perfil__turma')
    search_fields = ('username', 'perfil__nome_exibicao')

    @admin.display(description='nome')
    def nome(self, obj):
        return getattr(getattr(obj, 'perfil', None), 'nome_exibicao', '')

    @admin.display(description='turma')
    def turma(self, obj):
        perfil = getattr(obj, 'perfil', None)
        return perfil.turma.turma if perfil and perfil.turma else ''

    @admin.display(description='situação')
    def situacao(self, obj):
        atual = sancao_atual(obj)
        if not atual:
            return selo('Ativa', '#16A34A')
        texto = atual.get_tipo_display()
        if atual.fim:
            texto += f' até {timezone.localtime(atual.fim):%d/%m %H:%M}'
        return selo(texto, CORES[atual.tipo])

    @admin.display(description='')
    def acoes(self, obj):
        return format_html('<a class="button" href="{}">Aplicar sanção</a>', link_sancionar(obj.id))


# ---------------------------------------------------------------- sanções

class EmVigorFilter(admin.SimpleListFilter):
    title = 'situação'
    parameter_name = 'vigor'

    def lookups(self, request, model_admin):
        return [('sim', 'Em vigor agora'), ('revogada', 'Revogadas'), ('encerrada', 'Encerradas')]

    def queryset(self, request, queryset):
        agora = timezone.now()
        if self.value() == 'sim':
            return queryset.em_vigor(agora)
        if self.value() == 'revogada':
            return queryset.filter(revogada_em__isnull=False)
        if self.value() == 'encerrada':
            return queryset.filter(revogada_em__isnull=True, fim__lte=agora)
        return queryset


@admin.register(Sancao)
class SancaoAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'tipo_colorido', 'categoria', 'inicio', 'fim', 'estado', 'criada_por')
    list_filter = (EmVigorFilter, 'tipo', 'categoria')
    search_fields = ('usuario__username', 'usuario__perfil__nome_exibicao', 'mensagem')
    autocomplete_fields = ('usuario',)
    raw_id_fields = ('denuncia',)
    actions = ['revogar']
    readonly_fields = ('criada_por', 'criada_em', 'ciente_em', 'revogada_em', 'revogada_por')
    fieldsets = (
        ('Quem e o quê', {'fields': ('usuario', 'tipo', 'categoria', 'mensagem', 'notas_internas', 'denuncia')}),
        ('Duração', {
            'fields': ('inicio', 'fim'),
            'description': 'Suspensão temporária: informe o fim (ex.: 1 dia, 7 dias). '
                           'Indefinida e permanente: deixe o fim vazio.',
        }),
        ('Revisão', {'fields': ('permite_recurso',)}),
        ('Registro', {'fields': ('criada_por', 'criada_em', 'ciente_em', 'revogada_em', 'revogada_por',
                                 'motivo_revogacao'), 'classes': ('collapse',)}),
    )

    def get_changeform_initial_data(self, request):
        inicial = super().get_changeform_initial_data(request)
        denuncia_id = request.GET.get('denuncia')
        if denuncia_id:
            denuncia = Denuncia.objects.filter(id=denuncia_id).first()
            if denuncia:
                inicial['categoria'] = denuncia.categoria
                inicial['usuario'] = denuncia.denunciado_id
        inicial.setdefault('tipo', TipoSancao.TEMPORARIA)
        inicial.setdefault('fim', timezone.now() + timedelta(days=1))
        return inicial

    def save_model(self, request, obj, form, change):
        if not change:
            obj.criada_por = request.user
        super().save_model(request, obj, form, change)
        if obj.denuncia and obj.denuncia.status in (StatusDenuncia.ABERTA, StatusDenuncia.ANALISE):
            obj.denuncia.status = StatusDenuncia.RESOLVIDA
            obj.denuncia.tratada_por = request.user
            obj.denuncia.save()
        if obj.tipo != TipoSancao.ADVERTENCIA and not change:
            # desconecta o aluno de outros computadores; ao entrar de novo, ele vê a tela de suspensão
            TokenAcesso.objects.filter(usuario=obj.usuario).delete()

    @admin.display(description='tipo')
    def tipo_colorido(self, obj):
        return selo(obj.get_tipo_display(), CORES[obj.tipo])

    @admin.display(description='estado')
    def estado(self, obj):
        if obj.revogada_em:
            return 'Revogada'
        if obj.tipo == TipoSancao.ADVERTENCIA:
            return 'Lida pelo aluno' if obj.ciente_em else 'Ainda não lida'
        return 'Em vigor' if obj.em_vigor else ('Agendada' if obj.inicio > timezone.now() else 'Encerrada')

    @admin.action(description='Revogar as sanções selecionadas (o aluno volta a usar)')
    def revogar(self, request, queryset):
        n = 0
        for s in queryset.filter(revogada_em__isnull=True):
            s.revogar(request.user, 'Revogada pelo moderador.')
            n += 1
        self.message_user(request, f'{n} sanção(ões) revogada(s).', messages.SUCCESS)


# ---------------------------------------------------------------- denúncias

@admin.register(Denuncia)
class DenunciaAdmin(admin.ModelAdmin):
    list_display = ('denunciado', 'tipo_alvo', 'categoria', 'status_colorido', 'denunciante', 'criada_em', 'sancionar')
    list_filter = ('status', 'categoria')
    search_fields = ('denunciado__username', 'denunciante__username', 'descricao')
    readonly_fields = ('denunciante', 'denunciado', 'conteudo', 'categoria', 'descricao', 'criada_em', 'historico')
    fields = ('denunciado', 'conteudo', 'historico', 'denunciante', 'categoria', 'descricao', 'criada_em',
              'status', 'nota_moderador', 'tratada_por')

    @admin.display(description='conteúdo denunciado')
    def conteudo(self, obj):
        if obj.projeto_id:
            return format_html('<a class="button" href="{}">Abrir projeto "{}"</a>',
                               reverse('admin:conteudo_projeto_change', args=[obj.projeto_id]), obj.projeto.titulo)
        if obj.modelo_id:
            return format_html('<a class="button" href="{}">Abrir modelo "{}"</a>',
                               reverse('admin:conteudo_modelo3d_change', args=[obj.modelo_id]), obj.modelo.titulo)
        return 'Denúncia sobre o usuário (sem conteúdo específico)'
    actions = ['marcar_analise', 'descartar']

    @admin.display(description='sobre')
    def tipo_alvo(self, obj):
        return 'Projeto' if obj.projeto_id else ('Modelo 3D' if obj.modelo_id else 'Usuário')

    @admin.display(description='situação')
    def status_colorido(self, obj):
        cores = {'aberta': '#DC2626', 'analise': '#D97706', 'resolvida': '#16A34A', 'descartada': '#6B7280'}
        return selo(obj.get_status_display(), cores[obj.status])

    @admin.display(description='')
    def sancionar(self, obj):
        return format_html('<a class="button" href="{}">Aplicar sanção</a>',
                           link_sancionar(obj.denunciado_id, obj.id))

    @admin.display(description='histórico do denunciado')
    def historico(self, obj):
        sancoes = obj.denunciado.sancoes.all()[:10]
        denuncias = obj.denunciado.denuncias_recebidas.exclude(id=obj.id).count()
        linhas = ''.join(
            f'<li>{timezone.localtime(s.criada_em):%d/%m/%Y} – {s.get_tipo_display()} '
            f'({s.get_categoria_display()}){" – revogada" if s.revogada_em else ""}</li>' for s in sancoes
        ) or '<li>Nenhuma sanção anterior.</li>'
        return format_html(
            '<ul style="margin:0">{}</ul><p>Outras denúncias recebidas: {}</p>'
            '<p><a class="button" href="{}">Aplicar sanção ao denunciado</a></p>',
            format_html(linhas), denuncias, link_sancionar(obj.denunciado_id, obj.id))

    def save_model(self, request, obj, form, change):
        if change and 'status' in form.changed_data:
            obj.tratada_por = request.user
        super().save_model(request, obj, form, change)

    @admin.action(description='Marcar como "em análise"')
    def marcar_analise(self, request, queryset):
        queryset.update(status=StatusDenuncia.ANALISE, tratada_por=request.user)

    @admin.action(description='Descartar (não houve problema)')
    def descartar(self, request, queryset):
        queryset.update(status=StatusDenuncia.DESCARTADA, tratada_por=request.user)

    def has_add_permission(self, request):
        return False


# ---------------------------------------------------------------- pedidos de revisão

@admin.register(Recurso)
class RecursoAdmin(admin.ModelAdmin):
    list_display = ('sancao', 'status', 'criado_em', 'respondido_por')
    list_filter = ('status',)
    readonly_fields = ('sancao', 'detalhes_sancao', 'texto', 'criado_em', 'respondido_por', 'respondido_em')
    fields = ('sancao', 'detalhes_sancao', 'texto', 'criado_em', 'resposta', 'status',
              'respondido_por', 'respondido_em')
    actions = ['aceitar', 'negar']

    @admin.display(description='sanção')
    def detalhes_sancao(self, obj):
        s = obj.sancao
        return format_html('<b>{}</b> – {}<br>{}<br><a href="{}">abrir sanção</a>', s.get_tipo_display(),
                           s.get_categoria_display(), s.mensagem,
                           reverse('admin:contas_sancao_change', args=[s.id]))

    def save_model(self, request, obj, form, change):
        if change and 'status' in form.changed_data and obj.status != StatusRecurso.PENDENTE:
            obj.responder(obj.status == StatusRecurso.ACEITO, request.user, obj.resposta)
        else:
            super().save_model(request, obj, form, change)

    @admin.action(description='Aceitar (revoga a sanção)')
    def aceitar(self, request, queryset):
        for r in queryset.filter(status=StatusRecurso.PENDENTE):
            r.responder(True, request.user, r.resposta or 'Seu pedido foi aceito.')
        self.message_user(request, 'Pedidos aceitos e sanções revogadas.', messages.SUCCESS)

    @admin.action(description='Negar (sanção mantida)')
    def negar(self, request, queryset):
        for r in queryset.filter(status=StatusRecurso.PENDENTE):
            r.responder(False, request.user, r.resposta or 'Depois de analisar, a decisão foi mantida.')
        self.message_user(request, 'Pedidos negados.', messages.INFO)

    def has_add_permission(self, request):
        return False


@admin.register(CodigoTurma)
class CodigoTurmaAdmin(admin.ModelAdmin):
    list_display = ('turma', 'codigo', 'ativo', 'contas', 'limite_contas')
    list_filter = ('ativo',)
    search_fields = ('turma', 'codigo')

    @admin.display(description='contas criadas')
    def contas(self, obj):
        return obj.alunos.count()
