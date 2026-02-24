from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import *


# DASHBOARD
@api_view(['GET'])
def dashboard_summary(request):
    return Response({"message": "Dashboard Summary"})


@api_view(['GET'])
def health_overview(request):
    return Response({"message": "Health Overview"})


# ATM
@api_view(['GET'])
def atm_list(request):
    atms = ATM.objects.all().values()
    return Response(atms)


@api_view(['GET'])
def atm_detail(request, id):
    atm = ATM.objects.filter(id=id).values().first()
    return Response(atm)


@api_view(['GET'])
def atm_logs(request, id):
    logs = LogEntry.objects.filter(source_id=id).values()
    return Response(logs)


@api_view(['GET'])
def atm_incidents(request, id):
    incidents = Incident.objects.filter(id=id).values()
    return Response(incidents)


@api_view(['GET'])
def atm_health_history(request, id):
    history = HealthSnapshot.objects.filter(source_id=id).values()
    return Response(history)


# CHANNELS
@api_view(['GET'])
def channel_list(request):
    channels = PaymentChannel.objects.all().values()
    return Response(channels)


@api_view(['GET'])
def channel_detail(request, id):
    channel = PaymentChannel.objects.filter(id=id).values().first()
    return Response(channel)


# LOGS
@api_view(['POST'])
def log_ingest(request):
    LogEntry.objects.create(**request.data)
    return Response({"status": "log stored"})


@api_view(['GET'])
def log_list(request):
    logs = LogEntry.objects.all().values()
    return Response(logs)


# INCIDENTS
@api_view(['GET'])
def incident_list(request):
    return Response(Incident.objects.all().values())


@api_view(['GET', 'PATCH'])
def incident_detail(request, id):
    return Response({"incident_id": id})


@api_view(['POST'])
def assign_incident(request, id):
    return Response({"assigned": id})


@api_view(['POST'])
def resolve_incident(request, id):
    return Response({"resolved": id})


# AI
@api_view(['POST'])
def ai_analyze_log(request):
    return Response({"prediction": "NETWORK_TIMEOUT"})


@api_view(['GET'])
def ai_predictions(request):
    return Response({"predictions": []})


@api_view(['GET'])
def ai_root_cause_stats(request):
    return Response({"stats": []})


# SELF HEAL
@api_view(['GET'])
def self_heal_actions(request):
    return Response({"actions": []})


@api_view(['POST'])
def self_heal_trigger(request):
    return Response({"triggered": True})


# ANOMALY
@api_view(['GET'])
def anomaly_flags(request):
    return Response(AnomalyFlag.objects.all().values())


@api_view(['PATCH'])
def update_anomaly_flag(request, id):
    return Response({"updated": id})


# NOTIFICATIONS
@api_view(['GET'])
def notification_list(request):
    return Response(CustomerNotification.objects.all().values())


@api_view(['POST'])
def send_notification(request):
    return Response({"sent": True})


@api_view(['GET', 'POST'])
def template_list(request):
    return Response(MessageTemplate.objects.all().values())