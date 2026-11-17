from django.urls import path

from . import views

urlpatterns = [
    path('multiplayer/info', views.info),
    path('multiplayer/salas', views.salas),
]
