"""Painel de moderação: projetos na nuvem e modelos da loja."""
import base64

from django.contrib import admin, messages
from django.urls import reverse
from django.utils.html import format_html

from contas.admin import link_sancionar, selo

from .models import InstrumentoSF2, Modelo3D, Projeto, Situacao

CORES = {Situacao.PUBLICADO: '#16A34A', Situacao.PENDENTE: '#D97706', Situacao.OCULTO: '#DC2626'}


def mini(obj, tamanho=72):
    if not obj.miniatura:
        return '—'
    try:
        with obj.miniatura.open('rb') as f:
            dados = base64.b64encode(f.read()).decode()
    except OSError:
        return '—'
    return format_html('<img src="data:image/png;base64,{}" style="width:{}px;border-radius:8px;'
                       'background:#eee">', dados, tamanho)


class ConteudoAdmin(admin.ModelAdmin):
    list_filter = ('situacao',)
    search_fields = ('titulo', 'descricao', 'dono__username', 'dono__perfil__nome_exibicao')
    actions = ['ocultar', 'publicar']
    readonly_fields = ('dono', 'previa', 'baixar', 'criado_em', 'atualizado_em', 'tamanho', 'apagado_em',
                       'denuncias_recebidas', 'acoes_dono')

    @admin.display(description='')
    def miniatura_lista(self, obj):
        return mini(obj, 56)

    @admin.display(description='prévia')
    def previa(self, obj):
        return mini(obj, 240)

    @admin.display(description='situação')
    def situacao_colorida(self, obj):
        if obj.apagado_em:
            return selo('Apagado pelo dono', '#6B7280')
        return selo(obj.get_situacao_display(), CORES[obj.situacao])

    @admin.display(description='denúncias')
    def denuncias_recebidas(self, obj):
        n = obj.denuncias.count()
        if not n:
            return 'Nenhuma'
        url = reverse('admin:contas_denuncia_changelist') + f'?q={obj.dono.username}'
        return format_html('<a href="{}">{} denúncia(s)</a>', url, n)

    @admin.display(description='dono')
    def acoes_dono(self, obj):
        return format_html('<a class="button" href="{}">Aplicar sanção ao dono</a>', link_sancionar(obj.dono_id))

    @admin.action(description='Ocultar (sai da galeria/loja; o dono vê a nota da moderação)')
    def ocultar(self, request, queryset):
        n = queryset.update(situacao=Situacao.OCULTO)
        self.message_user(request, f'{n} item(ns) ocultado(s). Escreva o motivo em "nota da moderação".',
                          messages.WARNING)

    @admin.action(description='Publicar / aprovar')
    def publicar(self, request, queryset):
        n = queryset.update(situacao=Situacao.PUBLICADO)
        self.message_user(request, f'{n} item(ns) publicado(s).', messages.SUCCESS)

    def has_add_permission(self, request):
        return False


@admin.register(Projeto)
class ProjetoAdmin(ConteudoAdmin):
    list_display = ('miniatura_lista', 'titulo', 'dono', 'compartilhado', 'situacao_colorida', 'visualizacoes',
                    'atualizado_em')
    list_filter = ('situacao', 'compartilhado')
    readonly_fields = ConteudoAdmin.readonly_fields + ('remixado_de', 'visualizacoes', 'compartilhado_em')
    fields = ('titulo', 'descricao', 'previa', 'baixar', 'dono', 'acoes_dono', 'compartilhado', 'situacao',
              'nota_moderacao', 'denuncias_recebidas', 'remixado_de', 'visualizacoes', 'tamanho',
              'criado_em', 'atualizado_em', 'compartilhado_em', 'apagado_em')

    @admin.display(description='arquivo')
    def baixar(self, obj):
        if not obj.arquivo:
            return '—'
        return format_html('<a class="button" href="{}">Baixar .asp para conferir</a>',
                           reverse('moderacao_arquivo', args=['projeto', obj.id]))


@admin.register(Modelo3D)
class Modelo3DAdmin(ConteudoAdmin):
    list_display = ('miniatura_lista', 'titulo', 'dono', 'formato', 'licenca', 'situacao_colorida', 'downloads',
                    'criado_em')
    list_filter = ('situacao', 'licenca', 'formato')
    readonly_fields = ConteudoAdmin.readonly_fields + ('formato', 'animacoes', 'texturas', 'downloads')
    fields = ('titulo', 'descricao', 'previa', 'baixar', 'dono', 'acoes_dono', 'licenca', 'credito', 'tags',
              'situacao', 'nota_moderacao', 'denuncias_recebidas', 'formato', 'animacoes', 'texturas',
              'downloads', 'tamanho', 'criado_em', 'atualizado_em', 'apagado_em')

    @admin.display(description='arquivo')
    def baixar(self, obj):
        if not obj.pacote:
            return '—'
        return format_html('<a class="button" href="{}">Baixar pacote para conferir</a>',
                           reverse('moderacao_arquivo', args=['modelo', obj.id]))


@admin.register(InstrumentoSF2)
class InstrumentoSF2Admin(ConteudoAdmin):
    list_display = ('titulo', 'dono', 'presets', 'licenca', 'situacao_colorida', 'downloads', 'criado_em')
    list_filter = ('situacao', 'licenca')
    readonly_fields = ConteudoAdmin.readonly_fields + ('presets', 'nomes_presets', 'downloads')
    fields = ('titulo', 'descricao', 'baixar', 'dono', 'acoes_dono', 'licenca', 'credito', 'tags', 'situacao',
              'nota_moderacao', 'denuncias_recebidas', 'presets', 'nomes_presets', 'downloads', 'tamanho',
              'criado_em', 'atualizado_em', 'apagado_em')

    @admin.display(description='arquivo')
    def baixar(self, obj):
        if not obj.arquivo:
            return '—'
        return format_html('<a class="button" href="{}">Baixar .sf2 para conferir</a>',
                           reverse('moderacao_arquivo', args=['instrumento', obj.id]))
