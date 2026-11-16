"""
API JSON usada pelo editor. Autenticação: cabeçalho "Authorization: Token <chave>".

POST /api/registrar        {usuario, senha, nome, codigo_turma}
POST /api/entrar           {usuario, senha}                 -> {token, ...situação}
POST /api/sair
GET  /api/eu               -> conta, situação (ok / suspensa) e advertências não lidas
POST /api/advertencias/<id>/ciente
POST /api/denuncias        {usuario, categoria, descricao}
POST /api/recursos         {sancao, texto}
GET  /api/categorias       -> motivos de denúncia
"""
import json
import re
from datetime import timedelta
from functools import wraps

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, password_validation
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import (
    CategoriaMotivo, CodigoTurma, Denuncia, Perfil, Recurso, Sancao, StatusDenuncia, StatusRecurso, TipoSancao,
    TokenAcesso, sancao_atual,
)

User = get_user_model()
USUARIO_RE = re.compile(r'^[a-z0-9_.-]{3,30}$')


def erro(mensagem, status=400, **extra):
    return JsonResponse({'erro': mensagem, **extra}, status=status)


def ler_json(request):
    try:
        return json.loads(request.body or b'{}')
    except (ValueError, UnicodeDecodeError):
        return {}


def ip_de(request):
    return (request.headers.get('CF-Connecting-IP')
            or request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
            or request.META.get('REMOTE_ADDR', ''))


def usuario_do_token(request):
    cabecalho = request.headers.get('Authorization', '')
    if not cabecalho.startswith('Token '):
        return None, None
    chave = cabecalho[6:].strip()
    return TokenAcesso.usuario_da_chave(chave), chave


def requer_login(view):
    @wraps(view)
    def interno(request, *args, **kwargs):
        usuario, chave = usuario_do_token(request)
        if not usuario:
            return erro('Sua sessão expirou. Entre de novo.', status=401)
        request.usuario_api = usuario
        request.chave_api = chave
        return view(request, *args, **kwargs)
    return interno


def situacao(usuario):
    """Tudo o que o editor precisa saber sobre a conta para decidir o que mostrar."""
    perfil = getattr(usuario, 'perfil', None)
    atual = sancao_atual(usuario)
    advertencias = usuario.sancoes.filter(
        tipo=TipoSancao.ADVERTENCIA, revogada_em__isnull=True, ciente_em__isnull=True
    ).order_by('criada_em')
    return {
        'conta': {
            'usuario': usuario.username,
            'nome': perfil.nome_exibicao if perfil else usuario.username,
            'turma': perfil.turma.turma if perfil and perfil.turma else '',
            'moderador': usuario.is_staff,
        },
        'status': 'suspensa' if atual else 'ok',
        'sancao': atual.para_api() if atual else None,
        'advertencias': [a.para_api() for a in advertencias],
        'agora': timezone.now().isoformat(),
    }


@csrf_exempt
@require_http_methods(['POST'])
def registrar(request):
    dados = ler_json(request)
    usuario = str(dados.get('usuario', '')).strip().lower()
    senha = str(dados.get('senha', ''))
    nome = str(dados.get('nome', '')).strip()[:40]
    codigo = str(dados.get('codigo_turma', '')).strip().upper()

    if not USUARIO_RE.match(usuario):
        return erro('O nome de usuário precisa ter de 3 a 30 letras minúsculas, números, ponto, _ ou -.',
                    campo='usuario')
    if not nome:
        return erro('Escreva seu nome de exibição (pode ser só o primeiro nome).', campo='nome')
    turma = CodigoTurma.objects.filter(codigo=codigo, ativo=True).first()
    if not turma:
        return erro('Código da turma inválido. Peça o código ao seu professor.', campo='codigo_turma')
    if turma.limite_contas is not None and turma.alunos.count() >= turma.limite_contas:
        return erro('Esta turma já atingiu o limite de contas. Fale com o seu professor.', campo='codigo_turma')
    if User.objects.filter(username=usuario).exists():
        return erro('Esse nome de usuário já existe. Escolha outro.', campo='usuario')
    novo = User(username=usuario)
    try:
        password_validation.validate_password(senha, novo)
    except ValidationError as e:
        return erro(' '.join(e.messages), campo='senha')
    with transaction.atomic():
        novo.set_password(senha)
        novo.save()
        Perfil.objects.create(usuario=novo, nome_exibicao=nome, turma=turma)
    chave = TokenAcesso.criar(novo)
    return JsonResponse({'token': chave, **situacao(novo)}, status=201)


@csrf_exempt
@require_http_methods(['POST'])
def entrar(request):
    dados = ler_json(request)
    usuario = str(dados.get('usuario', '')).strip().lower()
    senha = str(dados.get('senha', ''))
    chave_bloqueio = f'login:{usuario}:{ip_de(request)}'
    tentativas = cache.get(chave_bloqueio, 0)
    if tentativas >= settings.ADVENTISCRATCH_LOGIN_TENTATIVAS:
        minutos = max(1, settings.ADVENTISCRATCH_LOGIN_BLOQUEIO_SEGUNDOS // 60)
        return erro(f'Muitas tentativas erradas. Espere {minutos} minuto(s) e tente de novo.', status=429)
    conta = authenticate(request, username=usuario, password=senha)
    if not conta:
        cache.set(chave_bloqueio, tentativas + 1, settings.ADVENTISCRATCH_LOGIN_BLOQUEIO_SEGUNDOS)
        return erro('Usuário ou senha incorretos.', status=401)
    cache.delete(chave_bloqueio)
    # Mesmo suspenso, o aluno entra: assim ele vê a tela explicando a suspensão e pode pedir revisão.
    chave = TokenAcesso.criar(conta)
    return JsonResponse({'token': chave, **situacao(conta)})


@csrf_exempt
@require_http_methods(['POST'])
@requer_login
def sair(request):
    TokenAcesso.apagar_chave(request.chave_api)
    return JsonResponse({'ok': True})


@require_http_methods(['GET'])
@requer_login
def eu(request):
    return JsonResponse(situacao(request.usuario_api))


@csrf_exempt
@require_http_methods(['POST'])
@requer_login
def advertencia_ciente(request, sancao_id):
    adv = Sancao.objects.filter(id=sancao_id, usuario=request.usuario_api, tipo=TipoSancao.ADVERTENCIA).first()
    if not adv:
        return erro('Advertência não encontrada.', status=404)
    if not adv.ciente_em:
        adv.ciente_em = timezone.now()
        adv.save(update_fields=['ciente_em'])
    return JsonResponse(situacao(request.usuario_api))


@require_http_methods(['GET'])
def categorias(request):
    return JsonResponse({'categorias': [{'id': c.value, 'nome': c.label} for c in CategoriaMotivo
                                        if c not in (CategoriaMotivo.BURLAR, CategoriaMotivo.SEGURANCA)]})


@csrf_exempt
@require_http_methods(['POST'])
@requer_login
def denunciar(request):
    autor = request.usuario_api
    if sancao_atual(autor):
        return erro('Contas suspensas não podem enviar denúncias.', status=403)
    dados = ler_json(request)
    alvo = User.objects.filter(username=str(dados.get('usuario', '')).strip().lower()).first()
    if not alvo:
        return erro('Não encontrei esse usuário.', campo='usuario')
    if alvo == autor:
        return erro('Você não pode denunciar a si mesmo.', campo='usuario')
    categoria = dados.get('categoria')
    if categoria not in CategoriaMotivo.values:
        return erro('Escolha o motivo da denúncia.', campo='categoria')
    descricao = str(dados.get('descricao', '')).strip()
    if len(descricao) < 10:
        return erro('Conte com um pouco mais de detalhes o que aconteceu (pelo menos 10 letras).',
                    campo='descricao')
    recentes = Denuncia.objects.filter(denunciante=autor,
                                       criada_em__gte=timezone.now() - timedelta(hours=1)).count()
    if recentes >= 5:
        return erro('Você já enviou várias denúncias na última hora. Tente mais tarde.', status=429)
    Denuncia.objects.create(denunciante=autor, denunciado=alvo, categoria=categoria,
                            descricao=descricao[:2000], status=StatusDenuncia.ABERTA)
    return JsonResponse({'ok': True}, status=201)


@csrf_exempt
@require_http_methods(['POST'])
@requer_login
def pedir_revisao(request):
    dados = ler_json(request)
    sancao = Sancao.objects.filter(id=dados.get('sancao'), usuario=request.usuario_api).first()
    if not sancao or sancao.tipo == TipoSancao.ADVERTENCIA:
        return erro('Sanção não encontrada.', status=404)
    if not sancao.permite_recurso:
        return erro('Esta decisão não pode ser revisada.', status=403)
    if sancao.recursos.filter(status=StatusRecurso.PENDENTE).exists():
        return erro('Você já tem um pedido de revisão aguardando resposta.', status=409)
    if sancao.recursos.count() >= 2:
        return erro('Você já pediu revisão desta sanção. Aguarde ou fale com o seu professor.', status=409)
    texto = str(dados.get('texto', '')).strip()
    if len(texto) < 10:
        return erro('Explique com um pouco mais de detalhes (pelo menos 10 letras).', campo='texto')
    Recurso.objects.create(sancao=sancao, texto=texto[:2000])
    return JsonResponse(situacao(request.usuario_api), status=201)


@require_http_methods(['GET'])
def saude(request):
    return JsonResponse({'ok': True, 'servico': 'adventiscratch'})
