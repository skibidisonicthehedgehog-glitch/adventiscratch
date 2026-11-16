from django.contrib import admin
from django.urls import include, path

admin.site.site_header = 'Adventiscratch – Moderação'
admin.site.site_title = 'Moderação Adventiscratch'
admin.site.index_title = 'Painel de moderação'

urlpatterns = [
    path('moderacao/', admin.site.urls),
    path('api/', include('contas.urls')),
]
