from django.urls import path

from . import views

urlpatterns = [
    path('projetos', views.criar_projeto),
    path('projetos/meus', views.meus_projetos),
    path('projetos/<int:pid>', views.projeto),
    path('projetos/<int:pid>/compartilhar', views.compartilhar_projeto),
    path('projetos/<int:pid>/apagar', views.apagar_projeto),
    path('projetos/<int:pid>/arquivo', views.arquivo_projeto),
    path('projetos/<int:pid>/miniatura', views.miniatura_projeto),
    path('explorar', views.explorar),
    path('modelos', views.modelos),
    path('modelos/meus', views.meus_modelos),
    path('modelos/<int:mid>/pacote', views.pacote_modelo),
    path('modelos/<int:mid>/miniatura', views.miniatura_modelo),
    path('modelos/<int:mid>/apagar', views.apagar_modelo),
    path('instrumentos', views.instrumentos),
    path('instrumentos/meus', views.meus_instrumentos),
    path('instrumentos/<int:iid>/arquivo', views.arquivo_instrumento),
    path('instrumentos/<int:iid>/apagar', views.apagar_instrumento),
]
