"""
Cria (ou atualiza) um moderador.

    python manage.py criar_moderador professora.ana
    python manage.py criar_moderador diretor --admin     # acesso total (superusuário)

O moderador entra em /moderacao/ e pode ver denúncias, aplicar e revogar sanções e responder pedidos de revisão.
"""
import getpass

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand, CommandError

PERMISSOES = [
    ('contas', 'view_sancao'), ('contas', 'add_sancao'), ('contas', 'change_sancao'),
    ('contas', 'view_denuncia'), ('contas', 'change_denuncia'),
    ('contas', 'view_recurso'), ('contas', 'change_recurso'),
    ('contas', 'view_codigoturma'), ('contas', 'add_codigoturma'), ('contas', 'change_codigoturma'),
    ('contas', 'view_perfil'), ('auth', 'view_user'),
    ('conteudo', 'view_projeto'), ('conteudo', 'change_projeto'),
    ('conteudo', 'view_modelo3d'), ('conteudo', 'change_modelo3d'),
    ('conteudo', 'view_instrumentosf2'), ('conteudo', 'change_instrumentosf2'),
]


def grupo_moderadores():
    grupo, _ = Group.objects.get_or_create(name='Moderadores')
    perms = [Permission.objects.get(content_type__app_label=app, codename=cod) for app, cod in PERMISSOES]
    grupo.permissions.set(perms)
    return grupo


class Command(BaseCommand):
    help = 'Cria ou atualiza um moderador do Adventiblocks.'

    def add_arguments(self, parser):
        parser.add_argument('usuario')
        parser.add_argument('--senha', help='Senha (se não informar, será pedida no terminal)')
        parser.add_argument('--admin', action='store_true', help='Acesso total ao painel')

    def handle(self, usuario, senha=None, admin=False, **opts):
        User = get_user_model()
        usuario = usuario.strip().lower()
        conta, criado = User.objects.get_or_create(username=usuario)
        if criado or senha:
            if not senha:
                senha = getpass.getpass('Senha do moderador: ')
            if len(senha) < 8:
                raise CommandError('Use uma senha de pelo menos 8 caracteres para moderadores.')
            conta.set_password(senha)
        conta.is_staff = True
        conta.is_superuser = admin
        conta.save()
        conta.groups.add(grupo_moderadores())
        self.stdout.write(self.style.SUCCESS(
            f'Moderador "{usuario}" {"criado" if criado else "atualizado"}. Entre em /moderacao/.'))
