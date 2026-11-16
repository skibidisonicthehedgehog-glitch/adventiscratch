from django.urls import path

from . import views

urlpatterns = [
    path('saude', views.saude),
    path('registrar', views.registrar),
    path('entrar', views.entrar),
    path('sair', views.sair),
    path('eu', views.eu),
    path('categorias', views.categorias),
    path('advertencias/<int:sancao_id>/ciente', views.advertencia_ciente),
    path('denuncias', views.denunciar),
    path('recursos', views.pedir_revisao),
]
