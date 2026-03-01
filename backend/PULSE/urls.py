from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from ATM import views as atm_views

urlpatterns = [
    path('admin/', admin.site.urls),

    # AUTH
    path('api/auth/login/', TokenObtainPairView.as_view()),
    path('api/auth/refresh/', TokenRefreshView.as_view()),
    path('api/auth/me/', atm_views.auth_me),

    # MAIN API
    path('api/', include('ATM.urls')),
]