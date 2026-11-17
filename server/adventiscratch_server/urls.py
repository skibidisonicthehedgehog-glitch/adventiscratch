from django.contrib import admin
from django.urls import include, path

from conteudo.views import arquivo_moderacao

admin.site.site_header = 'Adventiblocks – Moderação'
admin.site.site_title = 'Moderação Adventiblocks'
admin.site.index_title = 'Painel de moderação'

urlpatterns = [
    path('moderacao/arquivo/<str:tipo>/<int:oid>/', arquivo_moderacao, name='moderacao_arquivo'),
    path('moderacao/', admin.site.urls),
    path('api/', include('contas.urls')),
    path('api/', include('conteudo.urls')),
    path('api/', include('multiplayer.urls')),
]
