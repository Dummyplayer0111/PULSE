from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/dashboard/', consumers.DashboardConsumer.as_asgi()),
    re_path(r'ws/logs/(?P<atm_id>\d+)/', consumers.LogConsumer.as_asgi()),
    re_path(r'ws/customer/(?P<phone_hash>[a-f0-9]{64})/', consumers.CustomerConsumer.as_asgi()),
]
