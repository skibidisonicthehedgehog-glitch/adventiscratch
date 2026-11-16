"""CORS simples para a API: o editor (outra origem, ex. localhost:8601) pode chamar /api/."""
from django.conf import settings
from django.http import HttpResponse


class CorsApiMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.path.startswith('/api/'):
            return self.get_response(request)
        if request.method == 'OPTIONS':
            response = HttpResponse(status=204)
        else:
            response = self.get_response(request)
        origem = request.headers.get('Origin')
        if origem and origem in settings.ADVENTISCRATCH_ORIGENS:
            response['Access-Control-Allow-Origin'] = origem
            response['Vary'] = 'Origin'
            response['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
            response['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
            response['Access-Control-Max-Age'] = '600'
        return response
