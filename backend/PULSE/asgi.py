import os
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application
import ATM.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'PULSE.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": URLRouter(
        ATM.routing.websocket_urlpatterns
    ),
})