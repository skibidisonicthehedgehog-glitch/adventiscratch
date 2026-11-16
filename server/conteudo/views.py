"""
API de projetos na nuvem e da loja de modelos. Tudo exige login (cabeçalho "Authorization: Token ...").

Projetos
  GET  /api/projetos/meus                    meus projetos
  POST /api/projetos                         novo (multipart: arquivo, titulo, descricao, miniatura, compartilhar, remixado_de)
  POST /api/projetos/<id>                    atualizar (multipart: arquivo?, titulo?, descricao?, miniatura?)
  POST /api/projetos/<id>/compartilhar       {"compartilhar": true|false}
  POST /api/projetos/<id>/apagar
  GET  /api/projetos/<id>                    informações
  GET  /api/projetos/<id>/arquivo            baixar o .asp
  GET  /api/projetos/<id>/miniatura
  GET  /api/explorar?q=&pagina=              projetos compartilhados por todos (global)
Loja de modelos
  GET  /api/modelos?q=&pagina=&formato=      modelos publicados (global)
  GET  /api/modelos/meus
  POST /api/modelos                          publicar (multipart: pacote, miniatura, titulo, descricao, licenca, credito,
                                             tags, animacoes, texturas, confirmo=1)
  GET  /api/modelos/<id>/pacote              baixar (conta como "usado")
  GET  /api/modelos/<id>/miniatura
  POST /api/modelos/<id>/apagar
Loja de Instrumentos Virtuais (SoundFont .sf2)
  GET  /api/instrumentos?q=&pagina=&ordem=   instrumentos publicados (global)
  GET  /api/instrumentos/meus
  POST /api/instrumentos                     publicar (multipart: arquivo, titulo, descricao, licenca, credito, tags,
                                             confirmo=1)
  GET  /api/instrumentos/<id>/arquivo        baixar o .sf2 (conta como "usado")
  POST /api/instrumentos/<id>/apagar
"""
import json
from datetime import timedelta

from django.conf import settings
from django.db.models import F
from django.http import FileResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from contas.models import sancao_atual
from contas.views import erro, requer_login

from .models import InstrumentoSF2, Licenca, Modelo3D, Projeto, Situacao, nome_publico
from .validacao import ArquivoInvalido, validar_miniatura, validar_pacote_modelo, validar_projeto, validar_sf2

POR_PAGINA = 24


def requer_conta_ativa(view):
    @requer_login
    def interno(request, *args, **kwargs):
        if sancao_atual(request.usuario_api):
            return erro('Contas suspensas não podem usar a nuvem nem a loja.', status=403)
        return view(request, *args, **kwargs)
    interno.__name__ = view.__name__
    return interno


def limite_envios(usuario):
    desde = timezone.now() - timedelta(hours=1)
    n = (Projeto.objects.filter(dono=usuario, atualizado_em__gte=desde).count() +
         Modelo3D.objects.filter(dono=usuario, criado_em__gte=desde).count() +
         InstrumentoSF2.objects.filter(dono=usuario, criado_em__gte=desde).count())
    return n >= settings.ADVENTISCRATCH_ENVIOS_POR_HORA


def sim(valor):
    return str(valor).strip().lower() in ('1', 'true', 'sim', 'on')


def texto(request, campo, maximo, padrao=''):
    return str(request.POST.get(campo, padrao)).strip()[:maximo]


def autor(c):
    return {'usuario': c.dono.username, 'nome': nome_publico(c.dono)}


def paginar(qs, request):
    try:
        pagina = max(1, int(request.GET.get('pagina', 1)))
    except ValueError:
        pagina = 1
    inicio = (pagina - 1) * POR_PAGINA
    itens = list(qs[inicio:inicio + POR_PAGINA + 1])
    return itens[:POR_PAGINA], pagina, len(itens) > POR_PAGINA


def projeto_api(p, usuario):
    return {
        'id': p.id, 'titulo': p.titulo, 'descricao': p.descricao, 'autor': autor(p),
        'meu': p.dono_id == usuario.id, 'compartilhado': p.compartilhado,
        'situacao': p.situacao, 'nota_moderacao': p.nota_moderacao if p.dono_id == usuario.id else '',
        'tem_miniatura': bool(p.miniatura), 'tamanho': p.tamanho, 'visualizacoes': p.visualizacoes,
        'remixado_de': p.remixado_de_id, 'criado_em': p.criado_em.isoformat(),
        'atualizado_em': p.atualizado_em.isoformat(),
    }


def modelo_api(m, usuario):
    return {
        'id': m.id, 'titulo': m.titulo, 'descricao': m.descricao, 'autor': autor(m),
        'meu': m.dono_id == usuario.id, 'formato': m.formato, 'licenca': m.licenca,
        'licenca_nome': m.get_licenca_display(), 'credito': m.credito,
        'tags': [t.strip() for t in m.tags.split(',') if t.strip()], 'animacoes': m.animacoes,
        'texturas': m.texturas, 'downloads': m.downloads, 'tamanho': m.tamanho, 'situacao': m.situacao,
        'nota_moderacao': m.nota_moderacao if m.dono_id == usuario.id else '',
        'tem_miniatura': bool(m.miniatura), 'criado_em': m.criado_em.isoformat(),
    }


def instrumento_api(i, usuario):
    return {
        'id': i.id, 'titulo': i.titulo, 'descricao': i.descricao, 'autor': autor(i),
        'meu': i.dono_id == usuario.id, 'licenca': i.licenca, 'licenca_nome': i.get_licenca_display(),
        'credito': i.credito, 'tags': [t.strip() for t in i.tags.split(',') if t.strip()],
        'presets': i.presets, 'nomes_presets': [n for n in i.nomes_presets.split('\n') if n][:12],
        'downloads': i.downloads, 'tamanho': i.tamanho, 'situacao': i.situacao,
        'nota_moderacao': i.nota_moderacao if i.dono_id == usuario.id else '',
        'criado_em': i.criado_em.isoformat(),
    }


def pode_ver_projeto(p, usuario):
    if p.apagado_em:
        return False
    if p.dono_id == usuario.id or usuario.is_staff:
        return True
    return p.compartilhado and Projeto.objects.visiveis().filter(id=p.id).exists()


def pode_ver_modelo(m, usuario):
    if m.apagado_em:
        return False
    if m.dono_id == usuario.id or usuario.is_staff:
        return True
    return Modelo3D.objects.visiveis().filter(id=m.id).exists()


def arquivo_resposta(campo, nome, tipo):
    if not campo:
        return erro('Arquivo não encontrado.', status=404)
    resposta = FileResponse(campo.open('rb'), content_type=tipo)
    resposta['Content-Disposition'] = f'attachment; filename="{nome}"'
    resposta['Cache-Control'] = 'private, max-age=60'
    return resposta


def nome_arquivo(titulo, ext):
    seguro = ''.join(c if c.isalnum() or c in ' -_' else '_' for c in titulo).strip() or 'arquivo'
    return f'{seguro[:60]}.{ext}'


# ------------------------------------------------------------------ projetos

@require_http_methods(['GET'])
@requer_conta_ativa
def meus_projetos(request):
    qs = Projeto.objects.ativos().filter(dono=request.usuario_api).select_related('dono__perfil')
    return JsonResponse({'projetos': [projeto_api(p, request.usuario_api) for p in qs[:200]]})


@csrf_exempt
@require_http_methods(['POST'])
@requer_conta_ativa
def criar_projeto(request):
    u = request.usuario_api
    if limite_envios(u):
        return erro('Você salvou muitas vezes na última hora. Espere um pouco.', status=429)
    if Projeto.objects.ativos().filter(dono=u).count() >= settings.ADVENTISCRATCH_MAX_PROJETOS:
        return erro('Você atingiu o limite de projetos na nuvem. Apague algum antigo.', status=409)
    arquivo = request.FILES.get('arquivo')
    titulo = texto(request, 'titulo', 80)
    if not arquivo:
        return erro('Envie o arquivo do projeto.', campo='arquivo')
    if not titulo:
        return erro('Dê um nome ao projeto.', campo='titulo')
    miniatura = request.FILES.get('miniatura')
    try:
        validar_projeto(arquivo)
        validar_miniatura(miniatura)
    except ArquivoInvalido as e:
        return erro(str(e), campo='arquivo')
    origem = None
    if request.POST.get('remixado_de'):
        origem = Projeto.objects.filter(id=request.POST.get('remixado_de')).first()
        if origem and not pode_ver_projeto(origem, u):
            origem = None
    compartilhar = sim(request.POST.get('compartilhar', ''))
    p = Projeto(dono=u, titulo=titulo, descricao=texto(request, 'descricao', 1000), tamanho=arquivo.size,
                compartilhado=compartilhar, compartilhado_em=timezone.now() if compartilhar else None,
                remixado_de=origem)
    p.arquivo.save('projeto.asp', arquivo, save=False)
    if miniatura:
        p.miniatura.save('mini.png', miniatura, save=False)
    p.save()
    return JsonResponse({'projeto': projeto_api(p, u)}, status=201)


@csrf_exempt
@require_http_methods(['GET', 'POST'])
@requer_conta_ativa
def projeto(request, pid):
    u = request.usuario_api
    p = Projeto.objects.select_related('dono__perfil').filter(id=pid).first()
    if not p or not pode_ver_projeto(p, u):
        return erro('Projeto não encontrado.', status=404)
    if request.method == 'GET':
        return JsonResponse({'projeto': projeto_api(p, u)})
    if p.dono_id != u.id:
        return erro('Só o dono pode alterar este projeto. Salve uma cópia (remix).', status=403)
    if limite_envios(u):
        return erro('Você salvou muitas vezes na última hora. Espere um pouco.', status=429)
    arquivo = request.FILES.get('arquivo')
    miniatura = request.FILES.get('miniatura')
    try:
        if arquivo:
            validar_projeto(arquivo)
        validar_miniatura(miniatura)
    except ArquivoInvalido as e:
        return erro(str(e), campo='arquivo')
    if arquivo:
        antigo = p.arquivo.name
        p.arquivo.save('projeto.asp', arquivo, save=False)
        p.tamanho = arquivo.size
        if antigo:
            p.arquivo.storage.delete(antigo)
    if miniatura:
        antiga = p.miniatura.name
        p.miniatura.save('mini.png', miniatura, save=False)
        if antiga:
            p.miniatura.storage.delete(antiga)
    if 'titulo' in request.POST and texto(request, 'titulo', 80):
        p.titulo = texto(request, 'titulo', 80)
    if 'descricao' in request.POST:
        p.descricao = texto(request, 'descricao', 1000)
    p.save()
    return JsonResponse({'projeto': projeto_api(p, u)})


@csrf_exempt
@require_http_methods(['POST'])
@requer_conta_ativa
def compartilhar_projeto(request, pid):
    u = request.usuario_api
    p = Projeto.objects.ativos().filter(id=pid, dono=u).first()
    if not p:
        return erro('Projeto não encontrado.', status=404)
    try:
        dados = json.loads(request.body or b'{}')
    except ValueError:
        dados = {}
    p.compartilhado = bool(dados.get('compartilhar'))
    if p.compartilhado and not p.compartilhado_em:
        p.compartilhado_em = timezone.now()
    p.save(update_fields=['compartilhado', 'compartilhado_em', 'atualizado_em'])
    return JsonResponse({'projeto': projeto_api(p, u)})


@csrf_exempt
@require_http_methods(['POST'])
@requer_conta_ativa
def apagar_projeto(request, pid):
    p = Projeto.objects.ativos().filter(id=pid, dono=request.usuario_api).first()
    if not p:
        return erro('Projeto não encontrado.', status=404)
    p.apagado_em = timezone.now()
    p.compartilhado = False
    p.save(update_fields=['apagado_em', 'compartilhado'])
    return JsonResponse({'ok': True})


@require_http_methods(['GET'])
@requer_conta_ativa
def arquivo_projeto(request, pid):
    p = Projeto.objects.filter(id=pid).first()
    if not p or not pode_ver_projeto(p, request.usuario_api):
        return erro('Projeto não encontrado.', status=404)
    if p.dono_id != request.usuario_api.id:
        Projeto.objects.filter(id=p.id).update(visualizacoes=F('visualizacoes') + 1)
    return arquivo_resposta(p.arquivo, nome_arquivo(p.titulo, 'asp'), 'application/zip')


@require_http_methods(['GET'])
@requer_conta_ativa
def miniatura_projeto(request, pid):
    p = Projeto.objects.filter(id=pid).first()
    if not p or not pode_ver_projeto(p, request.usuario_api):
        return erro('Projeto não encontrado.', status=404)
    return arquivo_resposta(p.miniatura, 'miniatura.png', 'image/png')


@require_http_methods(['GET'])
@requer_conta_ativa
def explorar(request):
    qs = Projeto.objects.visiveis().filter(compartilhado=True).busca(request.GET.get('q')) \
        .select_related('dono__perfil').order_by('-compartilhado_em')
    itens, pagina, mais = paginar(qs, request)
    return JsonResponse({'projetos': [projeto_api(p, request.usuario_api) for p in itens],
                         'pagina': pagina, 'tem_mais': mais})


# ------------------------------------------------------------------ loja de modelos

@require_http_methods(['GET', 'POST'])
@csrf_exempt
@requer_conta_ativa
def modelos(request):
    if request.method == 'POST':
        return publicar_modelo(request)
    qs = Modelo3D.objects.visiveis().busca(request.GET.get('q')).select_related('dono__perfil')
    formato = request.GET.get('formato')
    if formato:
        qs = qs.filter(formato=formato)
    ordem = '-downloads' if request.GET.get('ordem') == 'populares' else '-criado_em'
    itens, pagina, mais = paginar(qs.order_by(ordem), request)
    return JsonResponse({'modelos': [modelo_api(m, request.usuario_api) for m in itens],
                         'pagina': pagina, 'tem_mais': mais,
                         'licencas': [{'id': c.value, 'nome': c.label} for c in Licenca]})


def publicar_modelo(request):
    u = request.usuario_api
    if limite_envios(u):
        return erro('Você enviou muitos arquivos na última hora. Espere um pouco.', status=429)
    if not sim(request.POST.get('confirmo', '')):
        return erro('Confirme que você criou o modelo ou tem permissão para compartilhá-lo.', campo='confirmo')
    titulo = texto(request, 'titulo', 80)
    if not titulo:
        return erro('Dê um nome ao modelo.', campo='titulo')
    licenca = request.POST.get('licenca')
    if licenca not in Licenca.values:
        return erro('Escolha a licença do modelo.', campo='licenca')
    credito = texto(request, 'credito', 160)
    if licenca in (Licenca.CC_BY, Licenca.PERMISSAO) and not credito:
        return erro('Informe o autor original para dar o crédito.', campo='credito')
    pacote = request.FILES.get('pacote')
    miniatura = request.FILES.get('miniatura')
    if not pacote:
        return erro('Envie o pacote do modelo.', campo='pacote')
    try:
        manifesto = validar_pacote_modelo(pacote)
        validar_miniatura(miniatura)
    except ArquivoInvalido as e:
        return erro(str(e), campo='pacote')

    def inteiro(campo):
        try:
            return max(0, min(10000, int(request.POST.get(campo, 0))))
        except ValueError:
            return 0
    m = Modelo3D(dono=u, titulo=titulo, descricao=texto(request, 'descricao', 1000), licenca=licenca,
                 credito=credito, tags=texto(request, 'tags', 160), formato=manifesto['ext'],
                 animacoes=inteiro('animacoes'), texturas=len(manifesto.get('recursos') or []),
                 tamanho=pacote.size,
                 situacao=Situacao.PENDENTE if settings.ADVENTISCRATCH_APROVAR_MODELOS else Situacao.PUBLICADO)
    m.pacote.save('pacote.zip', pacote, save=False)
    if miniatura:
        m.miniatura.save('mini.png', miniatura, save=False)
    m.save()
    return JsonResponse({'modelo': modelo_api(m, u)}, status=201)


@require_http_methods(['GET'])
@requer_conta_ativa
def meus_modelos(request):
    qs = Modelo3D.objects.ativos().filter(dono=request.usuario_api).select_related('dono__perfil')
    return JsonResponse({'modelos': [modelo_api(m, request.usuario_api) for m in qs[:200]]})


@require_http_methods(['GET'])
@requer_conta_ativa
def pacote_modelo(request, mid):
    m = Modelo3D.objects.filter(id=mid).first()
    if not m or not pode_ver_modelo(m, request.usuario_api):
        return erro('Modelo não encontrado.', status=404)
    if m.dono_id != request.usuario_api.id:
        Modelo3D.objects.filter(id=m.id).update(downloads=F('downloads') + 1)
    return arquivo_resposta(m.pacote, nome_arquivo(m.titulo, 'zip'), 'application/zip')


@require_http_methods(['GET'])
@requer_conta_ativa
def miniatura_modelo(request, mid):
    m = Modelo3D.objects.filter(id=mid).first()
    if not m or not pode_ver_modelo(m, request.usuario_api):
        return erro('Modelo não encontrado.', status=404)
    return arquivo_resposta(m.miniatura, 'miniatura.png', 'image/png')


@csrf_exempt
@require_http_methods(['POST'])
@requer_conta_ativa
def apagar_modelo(request, mid):
    m = Modelo3D.objects.ativos().filter(id=mid, dono=request.usuario_api).first()
    if not m:
        return erro('Modelo não encontrado.', status=404)
    m.apagado_em = timezone.now()
    m.save(update_fields=['apagado_em'])
    return JsonResponse({'ok': True})


# ------------------------------------------------------------------ Loja de Instrumentos Virtuais (.sf2)

def pode_ver_instrumento(i, usuario):
    if i.apagado_em:
        return False
    if i.dono_id == usuario.id or usuario.is_staff:
        return True
    return InstrumentoSF2.objects.visiveis().filter(id=i.id).exists()


@require_http_methods(['GET', 'POST'])
@csrf_exempt
@requer_conta_ativa
def instrumentos(request):
    if request.method == 'POST':
        return publicar_instrumento(request)
    qs = InstrumentoSF2.objects.visiveis().busca(request.GET.get('q')).select_related('dono__perfil')
    ordem = '-downloads' if request.GET.get('ordem') == 'populares' else '-criado_em'
    itens, pagina, mais = paginar(qs.order_by(ordem), request)
    return JsonResponse({'instrumentos': [instrumento_api(i, request.usuario_api) for i in itens],
                         'pagina': pagina, 'tem_mais': mais,
                         'max_mb': settings.ADVENTISCRATCH_MAX_SF2_MB,
                         'licencas': [{'id': c.value, 'nome': c.label} for c in Licenca]})


def publicar_instrumento(request):
    u = request.usuario_api
    if limite_envios(u):
        return erro('Você enviou muitos arquivos na última hora. Espere um pouco.', status=429)
    if not sim(request.POST.get('confirmo', '')):
        return erro('Confirme que você criou o instrumento ou tem permissão para compartilhá-lo.', campo='confirmo')
    titulo = texto(request, 'titulo', 80)
    if not titulo:
        return erro('Dê um nome ao instrumento.', campo='titulo')
    licenca = request.POST.get('licenca')
    if licenca not in Licenca.values:
        return erro('Escolha a licença do instrumento.', campo='licenca')
    credito = texto(request, 'credito', 160)
    if licenca in (Licenca.CC_BY, Licenca.PERMISSAO) and not credito:
        return erro('Informe o autor original para dar o crédito.', campo='credito')
    arquivo = request.FILES.get('arquivo')
    if not arquivo:
        return erro('Escolha o arquivo .sf2.', campo='arquivo')
    try:
        info = validar_sf2(arquivo)
    except ArquivoInvalido as e:
        return erro(str(e), campo='arquivo')
    nomes = [f'{nome}' for banco, programa, nome in info['presets']]
    i = InstrumentoSF2(dono=u, titulo=titulo, descricao=texto(request, 'descricao', 1000), licenca=licenca,
                       credito=credito, tags=texto(request, 'tags', 160), presets=len(nomes),
                       nomes_presets='\n'.join(n.replace('\n', ' ')[:40] for n in nomes[:300]),
                       tamanho=arquivo.size,
                       situacao=Situacao.PENDENTE if settings.ADVENTISCRATCH_APROVAR_MODELOS else Situacao.PUBLICADO)
    i.arquivo.save('instrumento.sf2', arquivo, save=False)
    i.save()
    return JsonResponse({'instrumento': instrumento_api(i, u)}, status=201)


@require_http_methods(['GET'])
@requer_conta_ativa
def meus_instrumentos(request):
    qs = InstrumentoSF2.objects.ativos().filter(dono=request.usuario_api).select_related('dono__perfil')
    return JsonResponse({'instrumentos': [instrumento_api(i, request.usuario_api) for i in qs[:200]]})


@require_http_methods(['GET'])
@requer_conta_ativa
def arquivo_instrumento(request, iid):
    i = InstrumentoSF2.objects.filter(id=iid).first()
    if not i or not pode_ver_instrumento(i, request.usuario_api):
        return erro('Instrumento não encontrado.', status=404)
    if i.dono_id != request.usuario_api.id:
        InstrumentoSF2.objects.filter(id=i.id).update(downloads=F('downloads') + 1)
    return arquivo_resposta(i.arquivo, nome_arquivo(i.titulo, 'sf2'), 'audio/x-soundfont')


@csrf_exempt
@require_http_methods(['POST'])
@requer_conta_ativa
def apagar_instrumento(request, iid):
    i = InstrumentoSF2.objects.ativos().filter(id=iid, dono=request.usuario_api).first()
    if not i:
        return erro('Instrumento não encontrado.', status=404)
    i.apagado_em = timezone.now()
    i.save(update_fields=['apagado_em'])
    return JsonResponse({'ok': True})


# ------------------------------------------------------------------ download para moderadores (painel)

def arquivo_moderacao(request, tipo, oid):
    """Moderadores logados no painel baixam o arquivo original para conferir."""
    if not request.user.is_authenticated or not request.user.is_staff:
        return erro('Somente moderadores.', status=403)
    if tipo == 'projeto':
        p = Projeto.objects.filter(id=oid).first()
        return arquivo_resposta(p.arquivo if p else None, nome_arquivo(p.titulo if p else 'x', 'asp'),
                                'application/zip')
    if tipo == 'instrumento':
        i = InstrumentoSF2.objects.filter(id=oid).first()
        return arquivo_resposta(i.arquivo if i else None, nome_arquivo(i.titulo if i else 'x', 'sf2'),
                                'audio/x-soundfont')
    m = Modelo3D.objects.filter(id=oid).first()
    return arquivo_resposta(m.pacote if m else None, nome_arquivo(m.titulo if m else 'x', 'zip'), 'application/zip')
