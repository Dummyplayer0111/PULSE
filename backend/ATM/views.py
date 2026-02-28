import uuid
import re
import os

import requests as http_requests
from django.db.models import Count
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import *


AI_SERVICE_URL = os.environ.get("AI_SERVICE_URL", "http://localhost:8001")

_EVENT_CODES = [
    "NETWORK_TIMEOUT", "NETWORK_LATENCY_HIGH", "CARD_READ_ERROR",
    "CASH_DISPENSE_FAIL", "HARDWARE_JAM", "MALWARE_SIGNATURE",
    "UPS_FAILURE", "CARD_READ_SUCCESS", "CASH_DISPENSE_OK",
]


def _parse_raw_log(message):
    """Extract eventCode and logLevel from a raw log string."""
    text = message.upper()
    event_code = next((c for c in _EVENT_CODES if c in text), "UNKNOWN")
    for level in ("CRITICAL", "ERROR", "WARN", "WARNING", "INFO"):
        if level in text:
            return event_code, "WARN" if level == "WARNING" else level
    return event_code, "ERROR"


def _call_classify(event_code, log_level):
    """POST to the FastAPI /classify endpoint. Returns dict or None."""
    resp = http_requests.post(
        f"{AI_SERVICE_URL}/classify",
        json={"eventCode": event_code, "logLevel": log_level},
        timeout=5,
    )
    resp.raise_for_status()
    return resp.json()  # FastAPI returns null for INFO logs


# ─────────────────────────────────────────────
# DASHBOARD
# ─────────────────────────────────────────────

@api_view(['GET'])
def dashboard_summary(request):
    return Response({"message": "Dashboard Summary"})


@api_view(['GET'])
def health_overview(request):
    return Response({"message": "Health Overview"})


# ─────────────────────────────────────────────
# ATM
# ─────────────────────────────────────────────

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


# ─────────────────────────────────────────────
# CHANNELS
# ─────────────────────────────────────────────

@api_view(['GET'])
def channel_list(request):
    channels = PaymentChannel.objects.all().values()
    return Response(channels)


@api_view(['GET'])
def channel_detail(request, id):
    channel = PaymentChannel.objects.filter(id=id).values().first()
    return Response(channel)


# ─────────────────────────────────────────────
# LOGS
# ─────────────────────────────────────────────

@api_view(['POST'])
def log_ingest(request):
    LogEntry.objects.create(**request.data)
    return Response({"status": "log stored"})


@api_view(['GET'])
def log_list(request):
    logs = LogEntry.objects.all().values()
    return Response(logs)


# ─────────────────────────────────────────────
# INCIDENTS
# ─────────────────────────────────────────────

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


# ─────────────────────────────────────────────
# AI ENGINE
# ─────────────────────────────────────────────

@api_view(['POST'])
def ai_analyze_log(request):
    """
    Accepts { message: "<raw log text>" }, calls the FastAPI /classify
    endpoint, and returns the AI classification result.
    """
    message = request.data.get("message", "")
    if not message:
        return Response({"error": "message field is required"}, status=400)

    event_code, log_level = _parse_raw_log(message)

    try:
        result = _call_classify(event_code, log_level)
    except Exception as e:
        return Response({"error": f"AI service unavailable: {str(e)}"}, status=503)

    if result is None:
        return Response({
            "category": "INFO",
            "detail": "Informational log — no incident needed.",
            "confidence": 1.0,
        })

    return Response({**result, "parsedEventCode": event_code, "parsedLogLevel": log_level})


@api_view(['GET'])
def ai_predictions(request):
    """
    For every ATM that has health snapshots, calls the FastAPI /predict
    endpoint and returns failure probability predictions.
    Optional query param: ?sourceId=<uuid>
    """
    source_id = request.query_params.get("sourceId")
    if source_id:
        source_ids = [source_id]
    else:
        source_ids = list(
            HealthSnapshot.objects.values_list("sourceId", flat=True).distinct()
        )

    predictions = []
    for sid in source_ids:
        snapshots = list(
            HealthSnapshot.objects
            .filter(sourceId=sid)
            .order_by("-timestamp")
            .values(
                "healthScore", "networkScore", "hardwareScore",
                "softwareScore", "transactionScore", "timestamp",
            )[:20]
        )
        if len(snapshots) < 2:
            continue

        snapshots.reverse()  # Chronological order for trend analysis

        for s in snapshots:
            if s["timestamp"]:
                s["timestamp"] = s["timestamp"].isoformat()

        try:
            resp = http_requests.post(
                f"{AI_SERVICE_URL}/predict",
                json={"sourceId": str(sid), "snapshots": snapshots},
                timeout=5,
            )
            resp.raise_for_status()
            predictions.append(resp.json())
        except Exception:
            continue

    return Response({"predictions": predictions})


@api_view(['GET'])
def ai_root_cause_stats(request):
    """
    Aggregates root cause categories from all incidents in the DB.
    No AI call needed — purely a DB aggregation.
    """
    total = Incident.objects.count()
    rows = (
        Incident.objects
        .values("rootCauseCategory")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    stats = [
        {
            "category": r["rootCauseCategory"],
            "count": r["count"],
            "percentage": round(r["count"] / total * 100, 1) if total else 0,
        }
        for r in rows
    ]
    return Response({"stats": stats})


# ─────────────────────────────────────────────
# SELF HEAL
# ─────────────────────────────────────────────

@api_view(['GET'])
def self_heal_actions(request):
    actions = list(SelfHealAction.objects.all().values())
    return Response({"actions": actions})


@api_view(['POST'])
def self_heal_trigger(request):
    """
    Expects { incidentId: "<uuid>", actionType: "<SELF_HEAL_ACTION>" }.
    Creates a SelfHealAction record with triggeredBy=MANUAL.
    """
    incident_id = request.data.get("incidentId")
    action_type = request.data.get("actionType", "ALERT_ENGINEER")

    if not incident_id:
        return Response({"error": "incidentId is required"}, status=400)

    try:
        parsed_id = uuid.UUID(str(incident_id))
    except ValueError:
        return Response({"error": "incidentId must be a valid UUID"}, status=400)

    action = SelfHealAction.objects.create(
        incidentId=parsed_id,
        actionType=action_type,
        triggeredBy="MANUAL",
        status="SUCCESS",
        result=f"Manual {action_type} triggered and executed successfully.",
    )

    return Response({
        "triggered": True,
        "actionId": action.id,
        "actionType": action.actionType,
        "status": action.status,
    })


# ─────────────────────────────────────────────
# ANOMALY
# ─────────────────────────────────────────────

@api_view(['GET'])
def anomaly_flags(request):
    return Response(list(AnomalyFlag.objects.all().values()))


@api_view(['PATCH'])
def update_anomaly_flag(request, id):
    try:
        flag = AnomalyFlag.objects.get(id=id)
    except AnomalyFlag.DoesNotExist:
        return Response({"error": "Anomaly flag not found"}, status=404)

    if "status" in request.data:
        flag.status = request.data["status"]
    if "notes" in request.data:
        flag.notes = request.data["notes"]

    flag.save()
    return Response({"updated": id, "status": flag.status, "notes": flag.notes})


# ─────────────────────────────────────────────
# NOTIFICATIONS
# ─────────────────────────────────────────────

@api_view(['GET'])
def notification_list(request):
    return Response(CustomerNotification.objects.all().values())


@api_view(['POST'])
def send_notification(request):
    return Response({"sent": True})


@api_view(['GET', 'POST'])
def template_list(request):
    return Response(MessageTemplate.objects.all().values())
