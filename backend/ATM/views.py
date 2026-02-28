import uuid
import re
import os
import threading
import time
import random
import hashlib
from datetime import datetime

import requests as http_requests
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models import Count
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import *

channel_layer = get_channel_layer()


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _broadcast_atm(atm_obj):
    """Push ATM update to all dashboard WebSocket clients."""
    try:
        async_to_sync(channel_layer.group_send)(
            'dashboard',
            {
                'type': 'atm_update',
                'data': {
                    'type': 'atm_update',
                    'atm': {
                        'id':              atm_obj.id,
                        'name':            atm_obj.name,
                        'location':        atm_obj.location,
                        'address':         atm_obj.address,
                        'region':          atm_obj.region,
                        'model':           atm_obj.model,
                        'serialNumber':    atm_obj.serialNumber,
                        'status':          atm_obj.status,
                        'healthScore':     atm_obj.healthScore,
                        'networkScore':    atm_obj.networkScore,
                        'hardwareScore':   atm_obj.hardwareScore,
                        'softwareScore':   atm_obj.softwareScore,
                        'transactionScore':atm_obj.transactionScore,
                        'latitude':        atm_obj.latitude,
                        'longitude':       atm_obj.longitude,
                        'lastSeen':        atm_obj.lastSeen.isoformat() if atm_obj.lastSeen else None,
                        'createdAt':       atm_obj.createdAt.isoformat(),
                    },
                },
            }
        )
    except Exception:
        pass


def _broadcast_pipeline_event(log_entry, atm, classification, incident, heal_action):
    """Broadcast a pipeline processing result to all dashboard WebSocket clients."""
    try:
        async_to_sync(channel_layer.group_send)(
            'dashboard',
            {
                'type': 'pipeline_event',
                'data': {
                    'type': 'pipeline_event',
                    'log': {
                        'id':        log_entry.id,
                        'eventCode': log_entry.eventCode,
                        'logLevel':  log_entry.logLevel,
                        'message':   log_entry.message,
                        'timestamp': log_entry.timestamp.isoformat(),
                    },
                    'atm': {
                        'id':          atm.id,
                        'name':        atm.name,
                        'status':      atm.status,
                        'healthScore': atm.healthScore,
                    } if atm else None,
                    'classification': classification,
                    'incident': {
                        'id':         incident.id,
                        'incidentId': incident.incidentId,
                        'title':      incident.title,
                        'severity':   incident.severity,
                        'category':   incident.rootCauseCategory,
                        'confidence': incident.aiConfidence,
                    } if incident else None,
                    'selfHealAction': heal_action.actionType if heal_action else None,
                    'timestamp': timezone.now().isoformat(),
                },
            }
        )
    except Exception:
        pass


def _degrade_atm_health(atm, category, confidence):
    """Reduce ATM subscore based on failure category and confidence."""
    delta = round(10 + confidence * 15)  # 10–25 point drop

    if category == 'NETWORK':
        atm.networkScore = max(0, atm.networkScore - delta)
    elif category in ('HARDWARE', 'CASH_JAM'):
        atm.hardwareScore = max(0, atm.hardwareScore - delta)
    elif category == 'FRAUD':
        atm.softwareScore  = max(0, atm.softwareScore - delta * 2)
        atm.transactionScore = max(0, atm.transactionScore - delta)
        atm.status = 'MAINTENANCE'
    else:
        atm.healthScore = max(0, atm.healthScore - 5)

    # Recalculate overall health score
    atm.healthScore = round(
        (atm.networkScore + atm.hardwareScore + atm.softwareScore + atm.transactionScore) / 4, 1
    )

    # Auto-set status from health
    if atm.status != 'MAINTENANCE':
        if atm.healthScore < 30:
            atm.status = 'OFFLINE'
        elif atm.healthScore < 60:
            atm.status = 'DEGRADED'
        else:
            atm.status = 'ONLINE'

    atm.lastSeen = timezone.now()
    atm.save()


def _recover_atm_health(atm, amount=3):
    """Gradually recover ATM health on normal (INFO) events."""
    atm.networkScore     = min(100, atm.networkScore + amount)
    atm.hardwareScore    = min(100, atm.hardwareScore + amount)
    atm.softwareScore    = min(100, atm.softwareScore + amount)
    atm.transactionScore = min(100, atm.transactionScore + amount)
    atm.healthScore = round(
        (atm.networkScore + atm.hardwareScore + atm.softwareScore + atm.transactionScore) / 4, 1
    )
    if atm.status not in ('MAINTENANCE', 'ONLINE') and atm.healthScore >= 75:
        atm.status = 'ONLINE'
    elif atm.status == 'OFFLINE' and atm.healthScore >= 40:
        atm.status = 'DEGRADED'
    atm.lastSeen = timezone.now()
    atm.save()


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
    return resp.json()


# ─────────────────────────────────────────────
# SIMULATOR STATE  (in-process thread approach)
# ─────────────────────────────────────────────

_sim_lock    = threading.Lock()
_sim_thread  = None
_sim_stop    = threading.Event()
_sim_stats   = {
    "running":          False,
    "startedAt":        None,
    "logsProcessed":    0,
    "incidentsCreated": 0,
    "selfHealsTriggered": 0,
    "lastLogAt":        None,
}

# Weighted event distribution (matches generate_logs.py)
_SIM_EVENTS = [
    {"code": "CARD_READ_SUCCESS",    "level": "INFO",     "weight": 40},
    {"code": "CASH_DISPENSE_OK",     "level": "INFO",     "weight": 30},
    {"code": "NETWORK_LATENCY_HIGH", "level": "WARN",     "weight": 10},
    {"code": "CARD_READ_ERROR",      "level": "ERROR",    "weight": 7},
    {"code": "CASH_DISPENSE_FAIL",   "level": "ERROR",    "weight": 5},
    {"code": "NETWORK_TIMEOUT",      "level": "ERROR",    "weight": 4},
    {"code": "HARDWARE_JAM",         "level": "CRITICAL", "weight": 2},
    {"code": "MALWARE_SIGNATURE",    "level": "CRITICAL", "weight": 1},
    {"code": "UPS_FAILURE",          "level": "CRITICAL", "weight": 1},
]
_SIM_TOTAL_WEIGHT = sum(e["weight"] for e in _SIM_EVENTS)


def _sim_pick_event():
    r = random.uniform(0, _SIM_TOTAL_WEIGHT)
    for e in _SIM_EVENTS:
        r -= e["weight"]
        if r <= 0:
            return e
    return _SIM_EVENTS[0]


def _sim_run():
    """Background thread: generate and ingest logs continuously."""
    global _sim_stats
    while not _sim_stop.is_set():
        try:
            atms = list(ATM.objects.all())
            if not atms:
                time.sleep(5)
                continue

            atm = random.choice(atms)
            event = _sim_pick_event()
            now = timezone.now()

            raw = f"[{now.isoformat()}] {atm.serialNumber or atm.name} {event['code']}"
            dedup = hashlib.sha256(raw.encode()).hexdigest()

            # Avoid duplicates
            if LogEntry.objects.filter(dedupHash=dedup).exists():
                time.sleep(1)
                continue

            # --- Ingest log ---
            log_entry = LogEntry.objects.create(
                sourceType='ATM',
                sourceId=uuid.UUID(int=atm.id),
                timestamp=now,
                logLevel=event['level'],
                eventCode=event['code'],
                message=f"{event['code']} on {atm.name}",
                rawMessage=raw,
                dedupHash=dedup,
            )

            with _sim_lock:
                _sim_stats["logsProcessed"] += 1
                _sim_stats["lastLogAt"] = now.isoformat()

            # --- Recovery for INFO events ---
            if event['level'] == 'INFO':
                if atm.healthScore < 98:
                    _recover_atm_health(atm, amount=2)
                    _broadcast_atm(atm)
                # Random sleep and continue
                time.sleep(random.uniform(1.5, 3.5))
                continue

            # --- Classify failure ---
            classification = None
            try:
                classification = _call_classify(event['code'], event['level'])
            except Exception:
                pass

            if not classification:
                time.sleep(random.uniform(1.5, 3.5))
                continue

            confidence  = classification.get('confidence', 0)
            category    = classification.get('category', 'UNKNOWN')
            self_heal_action = classification.get('selfHealAction', 'NONE')

            # Only auto-create incident if confident enough
            incident    = None
            heal_action = None

            if confidence >= 0.65 and category not in ('UNKNOWN', 'INFO'):
                severity_map = {'CRITICAL': 'CRITICAL', 'ERROR': 'HIGH', 'WARN': 'MEDIUM'}
                severity = severity_map.get(event['level'], 'MEDIUM')
                if category == 'FRAUD':
                    severity = 'CRITICAL'

                incident_id = f"INC-{uuid.uuid4().hex[:8].upper()}"
                incident = Incident.objects.create(
                    incidentId=incident_id,
                    title=f"{category} failure at {atm.name}",
                    severity=severity,
                    status='OPEN',
                    sourceId=uuid.UUID(int=atm.id),
                    sourceType='ATM',
                    rootCauseCategory=category,
                    aiConfidence=confidence,
                    triggeringLogId=uuid.UUID(int=log_entry.id),
                    contributingLogIds=[log_entry.id],
                )

                with _sim_lock:
                    _sim_stats["incidentsCreated"] += 1

                if self_heal_action and self_heal_action != 'NONE':
                    heal_action = SelfHealAction.objects.create(
                        incidentId=uuid.UUID(int=incident.id),
                        actionType=self_heal_action,
                        triggeredBy='AUTO',
                        status='SUCCESS',
                        result=f"Auto-executed {self_heal_action} for {category} on {atm.name}",
                    )
                    with _sim_lock:
                        _sim_stats["selfHealsTriggered"] += 1

                # Degrade ATM health + broadcast
                _degrade_atm_health(atm, category, confidence)
                _broadcast_atm(atm)

            # Broadcast pipeline event to dashboard
            _broadcast_pipeline_event(log_entry, atm, classification, incident, heal_action)

        except Exception as e:
            pass  # Keep running even if one iteration fails

        time.sleep(random.uniform(2.0, 5.0))

    with _sim_lock:
        _sim_stats["running"] = False


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

@api_view(['GET', 'POST'])
def atm_list(request):
    if request.method == 'POST':
        data = request.data
        atm = ATM.objects.create(
            name=data.get('name', 'ATM-NEW'),
            location=data.get('location', ''),
            address=data.get('address', ''),
            region=data.get('region', ''),
            model=data.get('model', ''),
            serialNumber=data.get('serialNumber', str(uuid.uuid4())[:12]),
            status=data.get('status', 'ONLINE'),
            healthScore=data.get('healthScore', 100),
            networkScore=data.get('networkScore', 100),
            hardwareScore=data.get('hardwareScore', 100),
            softwareScore=data.get('softwareScore', 100),
            transactionScore=data.get('transactionScore', 100),
            latitude=data.get('latitude'),
            longitude=data.get('longitude'),
        )
        _broadcast_atm(atm)
        return Response(list(ATM.objects.all().values()))
    atms = list(ATM.objects.all().values())
    return Response(atms)


@api_view(['GET', 'PATCH'])
def atm_detail(request, id):
    try:
        atm = ATM.objects.get(id=id)
    except ATM.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)
    if request.method == 'PATCH':
        for field in ['status', 'healthScore', 'networkScore', 'hardwareScore',
                      'softwareScore', 'transactionScore', 'location', 'address']:
            if field in request.data:
                setattr(atm, field, request.data[field])
        atm.save()
        _broadcast_atm(atm)
    return Response(list(ATM.objects.filter(id=id).values())[0])


@api_view(['POST'])
def atm_reset_health(request, id):
    """Reset all health scores to 100 for a given ATM."""
    try:
        atm = ATM.objects.get(id=id)
    except ATM.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)
    atm.healthScore = 100
    atm.networkScore = 100
    atm.hardwareScore = 100
    atm.softwareScore = 100
    atm.transactionScore = 100
    atm.status = 'ONLINE'
    atm.lastSeen = timezone.now()
    atm.save()
    _broadcast_atm(atm)
    return Response({"reset": True, "atmId": id})


@api_view(['GET'])
def atm_logs(request, id):
    logs = LogEntry.objects.filter(sourceId=uuid.UUID(int=id)).order_by('-timestamp')[:100].values()
    return Response(list(logs))


@api_view(['GET'])
def atm_incidents(request, id):
    incidents = Incident.objects.filter(sourceId=uuid.UUID(int=id)).order_by('-createdAt')[:50].values()
    return Response(list(incidents))


@api_view(['GET'])
def atm_health_history(request, id):
    history = HealthSnapshot.objects.filter(sourceId=uuid.UUID(int=id)).order_by('-timestamp')[:50].values()
    return Response(list(history))


# ─────────────────────────────────────────────
# SIMULATOR CONTROL
# ─────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def simulator_start(request):
    global _sim_thread
    with _sim_lock:
        if _sim_stats["running"]:
            return Response({"status": "already_running", **_sim_stats})
        _sim_stop.clear()
        _sim_stats.update({
            "running": True,
            "startedAt": timezone.now().isoformat(),
            "logsProcessed": 0,
            "incidentsCreated": 0,
            "selfHealsTriggered": 0,
            "lastLogAt": None,
        })
    _sim_thread = threading.Thread(target=_sim_run, daemon=True)
    _sim_thread.start()
    return Response({"status": "started", **_sim_stats})


@api_view(['POST'])
@permission_classes([AllowAny])
def simulator_stop(request):
    _sim_stop.set()
    with _sim_lock:
        _sim_stats["running"] = False
    return Response({"status": "stopped", **_sim_stats})


@api_view(['GET'])
@permission_classes([AllowAny])
def simulator_status(request):
    with _sim_lock:
        return Response(dict(_sim_stats))


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
@permission_classes([AllowAny])
def log_ingest(request):
    """
    Ingest a single ATM log, auto-classify with FastAPI,
    and auto-create Incident + SelfHealAction if a failure is detected.
    """
    data = request.data

    # --- Resolve ATM ---
    atm_db_id = data.get('atmDbId')
    atm = None
    source_id = uuid.UUID(int=0)
    if atm_db_id:
        try:
            atm = ATM.objects.get(id=int(atm_db_id))
            source_id = uuid.UUID(int=int(atm_db_id))
        except (ATM.DoesNotExist, ValueError):
            pass

    log_level  = data.get('logLevel', 'INFO')
    event_code = data.get('eventCode', 'UNKNOWN')
    message    = data.get('message', '')
    raw_msg    = data.get('rawMessage', message)
    dedup      = data.get('dedupHash') or hashlib.sha256(raw_msg.encode()).hexdigest()

    # Parse timestamp
    ts_str = data.get('timestamp')
    try:
        from dateutil.parser import parse as _parse
        ts = _parse(ts_str) if ts_str else timezone.now()
    except Exception:
        ts = timezone.now()

    # Dedup check
    if LogEntry.objects.filter(dedupHash=dedup).exists():
        return Response({"status": "duplicate", "skipped": True})

    # Store log
    log_entry = LogEntry.objects.create(
        sourceType='ATM',
        sourceId=source_id,
        timestamp=ts,
        logLevel=log_level,
        eventCode=event_code,
        message=message,
        rawMessage=raw_msg,
        dedupHash=dedup,
    )

    # INFO / WARN recovery
    if log_level == 'INFO':
        if atm and atm.healthScore < 98:
            _recover_atm_health(atm, amount=2)
            _broadcast_atm(atm)
        return Response({"status": "logged", "logId": log_entry.id, "classified": False})

    # Classify
    try:
        classification = _call_classify(event_code, log_level)
    except Exception as e:
        return Response({"status": "logged", "logId": log_entry.id, "classified": False,
                         "error": str(e)})

    if not classification:
        return Response({"status": "logged", "logId": log_entry.id, "classified": False})

    confidence       = classification.get('confidence', 0)
    category         = classification.get('category', 'UNKNOWN')
    self_heal_action = classification.get('selfHealAction', 'NONE')

    incident    = None
    heal_action = None

    if confidence >= 0.65 and category not in ('UNKNOWN', 'INFO'):
        severity_map = {'CRITICAL': 'CRITICAL', 'ERROR': 'HIGH', 'WARN': 'MEDIUM'}
        severity = severity_map.get(log_level, 'MEDIUM')
        if category == 'FRAUD':
            severity = 'CRITICAL'

        atm_name = atm.name if atm else f"ATM #{source_id.int}"
        incident_id = f"INC-{uuid.uuid4().hex[:8].upper()}"

        incident = Incident.objects.create(
            incidentId=incident_id,
            title=f"{category} failure at {atm_name}",
            severity=severity,
            status='OPEN',
            sourceId=source_id,
            sourceType='ATM',
            rootCauseCategory=category,
            aiConfidence=confidence,
            triggeringLogId=uuid.UUID(int=log_entry.id),
            contributingLogIds=[log_entry.id],
        )

        if self_heal_action and self_heal_action != 'NONE':
            heal_action = SelfHealAction.objects.create(
                incidentId=uuid.UUID(int=incident.id),
                actionType=self_heal_action,
                triggeredBy='AUTO',
                status='SUCCESS',
                result=f"Auto-executed {self_heal_action} for {category} on {atm_name}",
            )

        if atm:
            _degrade_atm_health(atm, category, confidence)
            _broadcast_atm(atm)

    _broadcast_pipeline_event(log_entry, atm, classification, incident, heal_action)

    return Response({
        "status":            "logged",
        "logId":             log_entry.id,
        "classified":        True,
        "incidentCreated":   incident is not None,
        "incidentId":        incident.incidentId if incident else None,
        "category":          category,
        "confidence":        confidence,
        "selfHealAction":    self_heal_action,
        "selfHealTriggered": heal_action is not None,
        "atmName":           atm.name if atm else None,
    })


@api_view(['GET'])
def log_list(request):
    qs = LogEntry.objects.all().order_by('-timestamp')
    source  = request.query_params.get('source')
    level   = request.query_params.get('level')
    from_ts = request.query_params.get('from')
    to_ts   = request.query_params.get('to')
    if source:
        qs = qs.filter(sourceId=source)
    if level:
        qs = qs.filter(logLevel=level)
    if from_ts:
        qs = qs.filter(timestamp__gte=from_ts)
    if to_ts:
        qs = qs.filter(timestamp__lte=to_ts)
    return Response(list(qs[:500].values()))


# ─────────────────────────────────────────────
# INCIDENTS
# ─────────────────────────────────────────────

@api_view(['GET'])
def incident_list(request):
    return Response(list(Incident.objects.all().order_by('-createdAt').values()))


@api_view(['GET', 'PATCH'])
def incident_detail(request, id):
    try:
        incident = Incident.objects.get(id=id)
    except Incident.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)
    if request.method == 'PATCH':
        for field in ['status', 'severity', 'assignedTo']:
            if field in request.data:
                setattr(incident, field, request.data[field])
        incident.save()
    return Response(list(Incident.objects.filter(id=id).values())[0])


@api_view(['POST'])
def assign_incident(request, id):
    return Response({"assigned": id})


@api_view(['POST'])
def resolve_incident(request, id):
    try:
        incident = Incident.objects.get(id=id)
        incident.status = 'RESOLVED'
        incident.save()
        return Response({"resolved": True, "id": id})
    except Incident.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)


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

        snapshots.reverse()

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
    actions = list(SelfHealAction.objects.all().order_by('-createdAt').values())
    return Response({"actions": actions})


@api_view(['POST'])
def self_heal_trigger(request):
    incident_id  = request.data.get("incidentId")
    action_type  = request.data.get("actionType", "ALERT_ENGINEER")

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
        "triggered":  True,
        "actionId":   action.id,
        "actionType": action.actionType,
        "status":     action.status,
    })


# ─────────────────────────────────────────────
# ANOMALY
# ─────────────────────────────────────────────

@api_view(['GET'])
def anomaly_flags(request):
    return Response(list(AnomalyFlag.objects.all().order_by('-createdAt').values()))


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
