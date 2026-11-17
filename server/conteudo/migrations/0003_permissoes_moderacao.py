from django.db import migrations


def atualizar_moderadores(apps, schema_editor):
    alias = schema_editor.connection.alias
    Group = apps.get_model('auth', 'Group')
    Permission = apps.get_model('auth', 'Permission')
    ContentType = apps.get_model('contenttypes', 'ContentType')
    grupo = Group.objects.using(alias).filter(name='Moderadores').first()
    if grupo is None:
        return
    modelos = {
        'projeto': 'projeto',
        'modelo3d': 'modelo 3D',
        'instrumentosf2': 'instrumento SoundFont',
    }
    for modelo, nome in modelos.items():
        tipo, _ = ContentType.objects.using(alias).get_or_create(app_label='conteudo', model=modelo)
        for acao in ('view', 'change'):
            permissao, _ = Permission.objects.using(alias).get_or_create(
                content_type=tipo, codename=f'{acao}_{modelo}', defaults={'name': f'Can {acao} {nome}'}
            )
            grupo.permissions.add(permissao)


class Migration(migrations.Migration):
    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
        ('conteudo', '0002_instrumentosf2'),
    ]

    operations = [migrations.RunPython(atualizar_moderadores, migrations.RunPython.noop)]
