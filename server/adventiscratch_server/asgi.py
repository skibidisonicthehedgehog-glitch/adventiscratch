"""
ASGI do Adventiscratch: o Django (API, moderação, editor) e o Servidor Multiplayer (WebSocket).

Rode com o Daphne (um processo só, porque as salas ficam na memória):
    daphne -b 0.0.0.0 -p 8000 adventiscratch_server.asgi:application
Em desenvolvimento, "python manage.py runserver" já usa o Daphne.
"""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'adventiscratch_server.settings')

django_app = get_asgi_application()

from multiplayer.servidor import app_websocket  # noqa: E402  (precisa do Django configurado)


async def application(scope, receive, send):
    if scope['type'] == 'websocket':
        if scope.get('path', '').rstrip('/') == '/api/multiplayer':
            return await app_websocket(scope, receive, send)
        await receive()
        await send({'type': 'websocket.close', 'code': 4404})
        return None
    return await django_app(scope, receive, send)
