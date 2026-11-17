from django.conf import settings
from django.http import JsonResponse

from contas.views import erro, requer_login

from .servidor import SALAS, resumo_salas


def info(request):
    """O editor pergunta se o multiplayer está ligado neste servidor."""
    return JsonResponse({
        'ligado': settings.ADVENTISCRATCH_MULTIPLAYER,
        'salas': len(SALAS),
        'maxJogadores': settings.ADVENTISCRATCH_MULTI_MAX_JOGADORES,
    })


@requer_login
def salas(request):
    """Salas abertas agora (só moderadores)."""
    if not request.usuario_api.is_staff:
        return erro('Só moderadores.', status=403)
    return JsonResponse({'salas': resumo_salas()})
