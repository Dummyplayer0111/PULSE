import uuid
import os
import threading
import time
import random
import hashlib

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models import Avg, Count
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import (
    ATM, Alert, AnomalyFlag, CustomerNotification, HealthSnapshot,
    Incident, LogEntry, MessageTemplate, PaymentChannel, SelfHealAction,
    Transaction, UserProfile,
)
from .pipeline import _auto_assign_engineer, _broadcast_atm, process_log

channel_layer = get_channel_layer()


# ─────────────────────────────────────────────
# FRAUD CHECK HELPER
# ─────────────────────────────────────────────

def _run_fraud_check(txn):
    """
    Call AI /fraud endpoint for a Transaction.
    Creates an AnomalyFlag and marks the transaction FLAGGED if fraud detected.
    Safe to run in a background thread.
    """
    from datetime import timedelta
    import requests as http_requests

    ai_url = os.environ.get("AI_SERVICE_URL", "http://localhost:8001")
    ten_min_ago = timezone.now() - timedelta(minutes=10)

    recent = list(
        Transaction.objects.filter(
            cardHash=txn.cardHash,
            timestamp__gte=ten_min_ago,
        ).exclude(id=txn.id).order_by('-timestamp')[:10].values(
            'amount', 'latitude', 'longitude', 'timestamp'
        )
    )
    for t in recent:
        if t['timestamp']:
            t['timestamp'] = t['timestamp'].isoformat()

    amounts = list(
        Transaction.objects.filter(cardHash=txn.cardHash)
        .exclude(id=txn.id).values_list('amount', flat=True)[:100]
    )
    if amounts:
        mean_amt = sum(amounts) / len(amounts)
        var      = sum((x - mean_amt) ** 2 for x in amounts) / max(len(amounts) - 1, 1)
        std_amt  = var ** 0.5 if var > 0 else 500.0
    else:
        mean_amt = 2500.0
        std_amt  = 800.0

    try:
        resp = http_requests.post(
            f"{ai_url}/fraud",
            json={
                "current": {
                    "amount":    txn.amount,
                    "latitude":  txn.latitude,
                    "longitude": txn.longitude,
                    "timestamp": txn.timestamp.isoformat(),
                },
                "recentTransactions": recent,
                "cardBaseline": {"meanAmount": mean_amt, "stdAmount": std_amt},
            },
            timeout=5,
        )
        result = resp.json()
    except Exception:
        return None

    if not result.get("isFraud"):
        return result

    fraud_map = {
        "RAPID_WITHDRAWAL":   "UNUSUAL_WITHDRAWAL",
        "UNUSUAL_WITHDRAWAL": "UNUSUAL_WITHDRAWAL",
        "GEOGRAPHIC_ANOMALY": "CARD_SKIMMING",
    }
    anomaly_type = fraud_map.get(result.get("fraudType", ""), "UNUSUAL_WITHDRAWAL")
    source_id    = uuid.UUID(int=txn.atm_id) if txn.atm_id else uuid.UUID(int=0)

    flag = AnomalyFlag.objects.create(
        sourceId=source_id,
        sourceType='ATM',
        anomalyType=anomaly_type,
        confidenceScore=min(1.0, result.get("confidence", 0.7)),
        description=result.get("explanation", "Transaction fraud detected."),
        status='FLAGGED',
    )
    Transaction.objects.filter(id=txn.id).update(status='FLAGGED', anomalyFlagId=flag.id)
    return result


# ─────────────────────────────────────────────
# AUTH / USER
# ─────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def auth_me(request):
    try:
        role = request.user.profile.role
    except UserProfile.DoesNotExist:
        role = 'ADMIN'
    return Response({
        'username': request.user.username,
        'email':    request.user.email,
        'role':     role,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_engineers(request):
    profiles = UserProfile.objects.filter(role='ENGINEER').select_related('user')
    return Response([
        {
            'username': p.user.username,
            'fullName': p.fullName or p.user.get_full_name() or p.user.username,
        }
        for p in profiles
    ])


# ─────────────────────────────────────────────
# SIMULATOR STATE
# ─────────────────────────────────────────────

_sim_lock   = threading.Lock()
_sim_thread = None
_sim_stop   = threading.Event()
_sim_stats  = {
    "running":            False,
    "startedAt":          None,
    "logsProcessed":      0,
    "incidentsCreated":   0,
    "selfHealsTriggered": 0,
    "lastLogAt":          None,
}

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

_SIM_CARD_POOL = [
    hashlib.sha256(f"CARD-{i}".encode()).hexdigest()[:16] for i in range(200)
]


def _sim_generate_transaction(atm):
    """Generate a synthetic ATM transaction and run fraud detection in a background thread."""
    card_hash    = random.choice(_SIM_CARD_POOL)
    is_fraud_amt = random.random() < 0.05
    amount       = float(round(random.uniform(30000, 50000))) if is_fraud_amt else float(round(random.uniform(500, 5000)))
    txn = Transaction.objects.create(
        atm=atm,
        cardHash=card_hash,
        amount=amount,
        transactionType='WITHDRAWAL',
        latitude=atm.latitude,
        longitude=atm.longitude,
        status='COMPLETED',
        timestamp=timezone.now(),
    )
    threading.Thread(target=_run_fraud_check, args=(txn,), daemon=True).start()


def _sim_pick_event():
    r = random.uniform(0, _SIM_TOTAL_WEIGHT)
    for e in _SIM_EVENTS:
        r -= e["weight"]
        if r <= 0:
            return e
    return _SIM_EVENTS[0]


def _sim_run():
    """Background thread: generate logs and run each through the full pipeline."""
    global _sim_stats
    while not _sim_stop.is_set():
        try:
            atms = list(ATM.objects.all())
            if not atms:
                time.sleep(5)
                continue

            atm   = random.choice(atms)
            event = _sim_pick_event()
            now   = timezone.now()

            raw   = f"[{now.isoformat()}] {atm.serialNumber or atm.name} {event['code']}"
            dedup = hashlib.sha256(raw.encode()).hexdigest()

            if LogEntry.objects.filter(dedupHash=dedup).exists():
                time.sleep(1)
                continue

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

            # Run the full pipeline (we're already in a background thread)
            process_log(log_entry.id)

            # Also generate a transaction for this ATM (~60% of events)
            if random.random() < 0.6:
                _sim_generate_transaction(atm)

            # Update sim stats from DB
            with _sim_lock:
                _sim_stats["incidentsCreated"]   = Incident.objects.count()
                _sim_stats["selfHealsTriggered"] = SelfHealAction.objects.filter(triggeredBy='AUTO').count()

        except Exception:
            pass

        time.sleep(random.uniform(2.0, 5.0))

    with _sim_lock:
        _sim_stats["running"] = False


# ─────────────────────────────────────────────
# DASHBOARD
# ─────────────────────────────────────────────

@api_view(['GET'])
def dashboard_summary(request):
    atms        = ATM.objects.all()
    total_atms  = atms.count()
    online      = atms.filter(status='ONLINE').count()
    offline     = atms.filter(status='OFFLINE').count()
    degraded    = atms.filter(status='DEGRADED').count()

    active_incidents = Incident.objects.filter(status__in=['OPEN', 'INVESTIGATING']).count()

    avg_health = atms.aggregate(avg=Avg('healthScore'))['avg'] or 100
    platform_health = round(avg_health, 1)

    # UPI success rate: ratio of INFO logs on PaymentChannel to total
    total_logs = LogEntry.objects.filter(sourceType='PaymentChannel').count()
    error_logs = LogEntry.objects.filter(
        sourceType='PaymentChannel', logLevel__in=['ERROR', 'CRITICAL']
    ).count()
    upi_success_rate = round((1 - error_logs / max(total_logs, 1)) * 100, 1)

    recent_incidents = list(
        Incident.objects.order_by('-createdAt')[:10].values(
            'id', 'incidentId', 'title', 'severity', 'status',
            'rootCauseCategory', 'aiConfidence', 'createdAt',
        )
    )
    recent_self_heals = list(
        SelfHealAction.objects.order_by('-createdAt')[:5].values(
            'id', 'incidentId', 'actionType', 'triggeredBy', 'status', 'createdAt',
        )
    )

    return Response({
        "atms": {
            "total":    total_atms,
            "online":   online,
            "offline":  offline,
            "degraded": degraded,
        },
        "activeIncidents":  active_incidents,
        "platformHealth":   platform_health,
        "upiSuccessRate":   upi_success_rate,
        "recentIncidents":  recent_incidents,
        "recentSelfHeals":  recent_self_heals,
    })


@api_view(['GET'])
def health_overview(request):
    atms = list(ATM.objects.all().values(
        'id', 'name', 'location', 'status', 'healthScore',
        'networkScore', 'hardwareScore', 'softwareScore', 'transactionScore',
        'latitude', 'longitude', 'lastSeen',
    ))
    channels = list(PaymentChannel.objects.all().values('id', 'name', 'type', 'status'))
    anomaly_count = AnomalyFlag.objects.filter(status='FLAGGED').count()

    return Response({
        "atms":          atms,
        "channels":      channels,
        "anomalyAlerts": anomaly_count,
    })


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
    return Response(list(ATM.objects.all().values()))


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
            "running":            True,
            "startedAt":          timezone.now().isoformat(),
            "logsProcessed":      0,
            "incidentsCreated":   0,
            "selfHealsTriggered": 0,
            "lastLogAt":          None,
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


@api_view(['GET'])
@permission_classes([AllowAny])
def recent_pipeline_events(request):
    """
    REST fallback for the Live Pipeline Feed.
    Returns the 40 most recent log entries joined with their incident + self-heal data.
    Used because InMemoryChannelLayer doesn't reliably cross thread boundaries.
    """
    logs = LogEntry.objects.order_by('-timestamp')[:40]
    result = []
    for log in logs:
        try:
            log_uuid = uuid.UUID(int=log.id)
            incident = Incident.objects.filter(triggeringLogId=log_uuid).first()
            heal = None
            if incident:
                heal = SelfHealAction.objects.filter(
                    incidentId=uuid.UUID(int=incident.id), triggeredBy='AUTO'
                ).first()
            result.append({
                'type': 'pipeline_event',
                'log': {
                    'id':        log.id,
                    'eventCode': log.eventCode,
                    'logLevel':  log.logLevel,
                    'message':   log.message or '',
                    'timestamp': log.timestamp.isoformat(),
                },
                'classification': {
                    'category':       incident.rootCauseCategory,
                    'confidence':     float(incident.aiConfidence or 0),
                    'detail':         incident.rootCauseDetail or '',
                    'selfHealAction': heal.actionType if heal else None,
                } if incident else None,
                'incident': {
                    'id':         incident.id,
                    'incidentId': incident.incidentId,
                    'title':      incident.title,
                    'severity':   incident.severity,
                    'category':   incident.rootCauseCategory,
                    'confidence': float(incident.aiConfidence or 0),
                } if incident else None,
                'selfHealAction': heal.actionType if heal else None,
                'timestamp':      log.timestamp.isoformat(),
            })
        except Exception:
            pass
    return Response(result)


# ─────────────────────────────────────────────
# PAYMENT CHANNELS
# ─────────────────────────────────────────────

@api_view(['GET'])
def channel_list(request):
    return Response(list(PaymentChannel.objects.all().values()))


@api_view(['GET'])
def channel_detail(request, id):
    return Response(PaymentChannel.objects.filter(id=id).values().first())


# ─────────────────────────────────────────────
# LOGS — ingest triggers the pipeline
# ─────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def log_ingest(request):
    """
    Ingest a single log entry, then kick off the full pipeline
    (AI classify → anomaly check → incident → health score →
     alert → self-heal → customer notification → WebSocket broadcast).
    """
    data = request.data

    # Resolve ATM
    atm_db_id = data.get('atmDbId')
    source_id = uuid.UUID(int=0)
    if atm_db_id:
        try:
            source_id = uuid.UUID(int=int(atm_db_id))
        except (ValueError, TypeError):
            pass

    log_level  = data.get('logLevel', 'INFO')
    event_code = data.get('eventCode', 'UNKNOWN')
    message    = data.get('message', '')
    raw_msg    = data.get('rawMessage', message)
    dedup      = data.get('dedupHash') or hashlib.sha256(raw_msg.encode()).hexdigest()

    ts_str = data.get('timestamp')
    try:
        from dateutil.parser import parse as _parse
        ts = _parse(ts_str) if ts_str else timezone.now()
    except Exception:
        ts = timezone.now()

    if LogEntry.objects.filter(dedupHash=dedup).exists():
        return Response({"status": "duplicate", "skipped": True})

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

    # Dispatch pipeline in a background thread (non-blocking response)
    threading.Thread(target=process_log, args=(log_entry.id,), daemon=True).start()

    return Response({
        "status":  "queued",
        "logId":   log_entry.id,
        "message": "Log saved. Pipeline running asynchronously.",
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
    qs = Incident.objects.all().order_by('-createdAt')
    assigned_to = request.query_params.get('assigned_to')
    status      = request.query_params.get('status')
    if assigned_to:
        qs = qs.filter(assignedTo=assigned_to)
    if status:
        qs = qs.filter(status=status)
    return Response(list(qs.values()))


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
    try:
        incident = Incident.objects.get(id=id)
        incident.assignedTo = request.data.get('username') or request.data.get('userId')
        incident.status = 'INVESTIGATING'
        incident.save()
        return Response({"assigned": True, "id": id})
    except Incident.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)


@api_view(['POST'])
def resolve_incident(request, id):
    try:
        incident = Incident.objects.get(id=id)
        incident.status = 'RESOLVED'
        incident.resolvedAt = timezone.now()
        incident.save()
        return Response({"resolved": True, "id": id})
    except Incident.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)


# ─────────────────────────────────────────────
# AI ENGINE
# ─────────────────────────────────────────────

_EVENT_CODES = [
    "NETWORK_TIMEOUT", "NETWORK_LATENCY_HIGH", "CARD_READ_ERROR",
    "CASH_DISPENSE_FAIL", "HARDWARE_JAM", "MALWARE_SIGNATURE",
    "UPS_FAILURE", "CARD_READ_SUCCESS", "CASH_DISPENSE_OK",
]

# Keyword heuristics — ordered most-specific first so fraud/cash win over generic network
_KEYWORD_MAP = [
    (["FRAUD", "MALWARE", "TAMPER", "SKIMM", "SUSPICIOUS", "UNAUTHORIZ",
      "CLONE", "PHISH", "ATTACK", "INTRUSION"],                         "MALWARE_SIGNATURE"),
    (["CASH", "JAM", "DISPENSE", "HOPPER", "CASSETTE", "STUCK",
      "BILL", "NOTE", "CURRENCY", "EMPTY"],                             "CASH_DISPENSE_FAIL"),
    (["CARD", "CHIP", "MAGNET", "READER", "EMV", "STRIPE", "SWIPE",
      "INSERT", "NFC"],                                                  "CARD_READ_ERROR"),
    (["UPS", "POWER", "VOLTAGE", "ELECTRIC", "BATTER"],                 "UPS_FAILURE"),
    (["LATENCY", "BANDWIDTH", "THROUGHPUT", "SLOW", "PACKET", "PING",
      "JITTER"],                                                         "NETWORK_LATENCY_HIGH"),
    (["HARDWARE", "SENSOR", "MOTOR", "ROLLER", "KEYPAD", "SCREEN",
      "DISPLAY", "THERMAL", "PRINTER", "SHUTTER", "DOOR"],              "HARDWARE_JAM"),
    (["NETWORK", "CONNECT", "TIMEOUT", "GATEWAY", "DNS", "SOCKET",
      "SWITCH", "LINK", "OFFLINE", "FIREWALL", "VPN",
      "SERVER", "SERVICE", "PROCESS", "CRASH", "RESTART",
      "MEMORY", "CPU", "DATABASE", "APPLICATION"],                      "NETWORK_TIMEOUT"),
]

def _parse_raw_log(message):
    text = message.upper()

    # 1. Exact known event-code token in text — highest priority
    for code in _EVENT_CODES:
        if code in text:
            for level in ("CRITICAL", "ERROR", "WARN", "WARNING", "INFO"):
                if level in text:
                    return code, "WARN" if level == "WARNING" else level
            return code, "ERROR"

    # 2. Keyword heuristics for free-form log text
    for keywords, event_code in _KEYWORD_MAP:
        if any(kw in text for kw in keywords):
            for level in ("CRITICAL", "ERROR", "WARN", "WARNING", "INFO"):
                if level in text:
                    return event_code, "WARN" if level == "WARNING" else level
            return event_code, "ERROR"

    # 3. Level-only fallback — use NETWORK_TIMEOUT as generic catch-all
    for level in ("CRITICAL", "ERROR", "WARN", "WARNING", "INFO"):
        if level in text:
            return "NETWORK_TIMEOUT", "WARN" if level == "WARNING" else level
    return "NETWORK_TIMEOUT", "ERROR"


@api_view(['POST'])
def ai_analyze_log(request):
    message = request.data.get("message", "")
    if not message:
        return Response({"error": "message field is required"}, status=400)

    event_code, log_level = _parse_raw_log(message)

    import requests as http_requests
    AI_SERVICE_URL = os.environ.get("AI_SERVICE_URL", "http://localhost:8001")
    try:
        resp = http_requests.post(
            f"{AI_SERVICE_URL}/classify",
            json={"eventCode": event_code, "logLevel": log_level},
            timeout=5,
        )
        resp.raise_for_status()
        result = resp.json()
    except Exception as e:
        return Response({"error": f"AI service unavailable: {e}"}, status=503)

    if result is None:
        return Response({
            "category": "INFO",
            "detail": "Informational log — no incident needed.",
            "confidence": 1.0,
        })

    return Response({**result, "parsedEventCode": event_code, "parsedLogLevel": log_level})


@api_view(['GET'])
def ai_predictions(request):
    import requests as http_requests
    AI_SERVICE_URL = os.environ.get("AI_SERVICE_URL", "http://localhost:8001")

    source_id = request.query_params.get("sourceId")
    source_ids = [source_id] if source_id else list(
        HealthSnapshot.objects.values_list("sourceId", flat=True).distinct()
    )

    predictions = []
    seen_atm_ids = set()

    for sid in source_ids:
        snapshots = list(
            HealthSnapshot.objects
            .filter(sourceId=sid)
            .order_by("-timestamp")
            .values("healthScore", "networkScore", "hardwareScore",
                    "softwareScore", "transactionScore", "timestamp")[:20]
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
            result = resp.json()
            # Find ATM name for this source UUID
            try:
                atm_obj = ATM.objects.get(id=uuid.UUID(str(sid)).int)
                result['atmName'] = atm_obj.name
                result['atmLocation'] = atm_obj.location
                seen_atm_ids.add(atm_obj.id)
            except Exception:
                pass
            predictions.append(result)
        except Exception:
            continue

    # Fallback: include at-risk ATMs with low health scores (no snapshot history needed)
    at_risk_atms = ATM.objects.exclude(id__in=seen_atm_ids).filter(
        healthScore__lt=60
    ).order_by('healthScore')[:5]

    for atm in at_risk_atms:
        h = atm.healthScore
        # Estimate failure probability from health score
        fail_prob = round(min(1.0, (100 - h) / 100 * 1.5), 2)
        weakest = min(
            [('network', atm.networkScore), ('hardware', atm.hardwareScore),
             ('software', atm.softwareScore), ('transaction', atm.transactionScore)],
            key=lambda x: x[1]
        )
        predictions.append({
            "sourceId": str(uuid.UUID(int=atm.id)),
            "atmName": atm.name,
            "atmLocation": atm.location,
            "currentHealth": h,
            "failureProbability": fail_prob,
            "trend": "declining" if h < 50 else "stable",
            "predictedIn": "< 24h" if h < 40 else "< 48h",
            "weakestComponent": weakest[0],
            "failureCategory": "HARDWARE" if weakest[0] == "hardware" else
                               "NETWORK" if weakest[0] == "network" else
                               "SERVER",
        })

    # Sort by failure probability descending
    predictions.sort(key=lambda p: p.get("failureProbability", 0), reverse=True)

    return Response({"predictions": predictions[:8]})


@api_view(['GET'])
def ai_root_cause_stats(request):
    total = Incident.objects.count()
    rows  = (
        Incident.objects
        .values("rootCauseCategory")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    stats = [
        {
            "category":   r["rootCauseCategory"],
            "count":      r["count"],
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
    return Response({"actions": list(SelfHealAction.objects.all().order_by('-createdAt').values())})


@api_view(['POST'])
def self_heal_trigger(request):
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
        return Response({"error": "Not found"}, status=404)
    if "status" in request.data:
        flag.status = request.data["status"]
    if "notes" in request.data:
        flag.notes = request.data["notes"]
    flag.save()
    return Response({"updated": id, "status": flag.status})


@api_view(['POST'])
def confirm_anomaly_flag(request, id):
    """
    Confirm an anomaly flag as a real threat.
    Marks the flag REVIEWED and opens a linked Incident.
    """
    try:
        flag = AnomalyFlag.objects.get(id=id)
    except AnomalyFlag.DoesNotExist:
        return Response({"error": "Not found"}, status=404)

    flag.status = 'REVIEWED'
    flag.save(update_fields=['status'])

    # Map anomaly type → root cause category
    category_map = {
        'UNUSUAL_WITHDRAWAL': 'FRAUD',
        'CARD_SKIMMING':      'FRAUD',
        'MALWARE_PATTERN':    'FRAUD',
        'RAPID_FAILURES':     'UNKNOWN',
    }
    category = category_map.get(flag.anomalyType, 'FRAUD')

    # Severity from confidence score
    c = flag.confidenceScore or 0
    if c >= 0.85:
        severity = 'CRITICAL'
    elif c >= 0.70:
        severity = 'HIGH'
    elif c >= 0.50:
        severity = 'MEDIUM'
    else:
        severity = 'LOW'

    # ATM name for title
    atm_name = f'ATM-{str(flag.sourceId.int)[:6]}'
    try:
        atm_obj = ATM.objects.get(id=flag.sourceId.int)
        atm_name = atm_obj.name
    except Exception:
        pass

    incident_number = f'INC-{uuid.uuid4().hex[:8].upper()}'
    incident = Incident.objects.create(
        incidentId=incident_number,
        title=f'{flag.anomalyType.replace("_", " ").title()} confirmed at {atm_name}',
        severity=severity,
        status='OPEN',
        sourceId=flag.sourceId,
        sourceType=flag.sourceType,
        rootCauseCategory=category,
        rootCauseDetail=flag.description or f'{flag.anomalyType} anomaly confirmed by operator.',
        aiConfidence=flag.confidenceScore or 0,
        triggeringLogId=uuid.UUID(int=flag.logEntryId) if flag.logEntryId else uuid.UUID(int=0),
        contributingLogIds=flag.contributingLogIds or [],
    )

    _auto_assign_engineer(incident)

    return Response({
        "confirmed": True,
        "flagId":    id,
        "incident": {
            "id":         incident.id,
            "incidentId": incident.incidentId,
            "title":      incident.title,
            "severity":   incident.severity,
            "status":     incident.status,
            "assignedTo": incident.assignedTo,
        },
    })


# ─────────────────────────────────────────────
# NOTIFICATIONS
# ─────────────────────────────────────────────

@api_view(['GET'])
def notification_list(request):
    return Response(list(CustomerNotification.objects.all().order_by('-createdAt').values()))


@api_view(['POST'])
def send_notification(request):
    """
    Manually send a customer notification for an active incident.
    Body: { incidentId, language, channel, recipientPhone }
    """
    data        = request.data
    incident_id = data.get('incidentId')
    language    = data.get('language', 'en')
    channel     = data.get('channel', 'SMS')
    phone       = data.get('recipientPhone', '+91-MANUAL')

    if not incident_id:
        return Response({"error": "incidentId is required"}, status=400)

    try:
        incident = Incident.objects.get(id=incident_id)
    except Incident.DoesNotExist:
        return Response({"error": "Incident not found"}, status=404)

    from .pipeline import TEMPLATE_KEY_MAP
    template_key = TEMPLATE_KEY_MAP.get(incident.rootCauseCategory, 'atm_offline')
    tmpl = MessageTemplate.objects.filter(
        templateKey=template_key, language=language, channel=channel,
    ).first()

    msg_text = (
        tmpl.body.replace('{atm_id}', incident.incidentId)
        if tmpl
        else f"[{incident.severity}] {incident.title}. Please check with your bank."
    )

    notif = CustomerNotification.objects.create(
        recipientId=phone,
        channel=channel,
        message=msg_text,
        language=language,
        status='SENT',
        incidentDbId=incident.id,
        messageTemplateId=tmpl.id if tmpl else None,
        messageSent=msg_text,
        sentAt=timezone.now(),
    )

    return Response({
        "sent":           True,
        "notificationId": notif.id,
        "language":       language,
        "channel":        channel,
        "message":        msg_text,
    })


@api_view(['GET', 'POST'])
def template_list(request):
    if request.method == 'POST':
        data = request.data
        tmpl = MessageTemplate.objects.create(
            name=data.get('name', ''),
            templateKey=data.get('templateKey', 'atm_offline'),
            language=data.get('language', 'en'),
            channel=data.get('channel', 'SMS'),
            body=data.get('body', ''),
            variablesSchema=data.get('variablesSchema', {}),
        )
        return Response({"created": True, "id": tmpl.id})
    return Response(list(MessageTemplate.objects.all().values()))


# ─────────────────────────────────────────────
# ATM TRANSACTION VOLUME (hourly)
# ─────────────────────────────────────────────

@api_view(['GET'])
def atm_transaction_volume(request, id):
    """
    Returns hourly log counts (success=INFO, failed=ERROR+CRITICAL, warned=WARN)
    for the given ATM for the last `hours` hours (default 24, max 48).
    """
    from datetime import timedelta
    try:
        atm = ATM.objects.get(id=id)
    except ATM.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)

    atm_uuid = uuid.UUID(int=atm.id)
    hours_param = max(1, min(48, int(request.query_params.get('hours', 24))))

    now = timezone.now()
    result = []

    for i in range(hours_param, 0, -1):
        start = now - timedelta(hours=i)
        end   = now - timedelta(hours=i - 1)
        qs = LogEntry.objects.filter(sourceId=atm_uuid, timestamp__gte=start, timestamp__lt=end)
        result.append({
            'hour':    start.strftime('%H:%M'),
            'success': qs.filter(logLevel='INFO').count(),
            'failed':  qs.filter(logLevel__in=['ERROR', 'CRITICAL']).count(),
            'warned':  qs.filter(logLevel='WARN').count(),
        })

    return Response({'volume': result, 'atmName': atm.name})


# ─────────────────────────────────────────────
# AI FAILURE TREND (7-day)
# ─────────────────────────────────────────────

@api_view(['GET'])
def ai_failure_trend(request):
    """
    Returns daily incident counts (total / critical / resolved) for the last 7 days.
    """
    from datetime import timedelta
    now = timezone.now()
    trend = []

    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end   = day_start + timedelta(days=1)
        base = Incident.objects.filter(createdAt__gte=day_start, createdAt__lt=day_end)
        trend.append({
            'date':     day_start.strftime('%d %b'),
            'dayShort': day_start.strftime('%a'),
            'count':    base.count(),
            'critical': base.filter(severity='CRITICAL').count(),
            'resolved': base.filter(status__in=['AUTO_RESOLVED', 'RESOLVED']).count(),
        })

    return Response({'trend': trend})


# ─────────────────────────────────────────────
# TRANSACTIONS
# ─────────────────────────────────────────────

@api_view(['GET'])
def transaction_list(request):
    """
    Returns recent transactions enriched with fraud flag data.
    ?flagged=true  — only FLAGGED/BLOCKED transactions
    ?limit=N       — max rows (default 100, max 500)
    """
    qs          = Transaction.objects.all().order_by('-timestamp')
    flagged_only = request.query_params.get('flagged') == 'true'
    limit        = min(int(request.query_params.get('limit', 100)), 500)

    if flagged_only:
        qs = qs.filter(status__in=['FLAGGED', 'BLOCKED'])

    txns = list(qs[:limit].values(
        'id', 'cardHash', 'amount', 'transactionType',
        'latitude', 'longitude', 'status', 'anomalyFlagId',
        'timestamp', 'createdAt', 'atm_id', 'atm__name', 'atm__location',
    ))

    flag_ids  = [t['anomalyFlagId'] for t in txns if t['anomalyFlagId']]
    flags_map = {}
    if flag_ids:
        for f in AnomalyFlag.objects.filter(id__in=flag_ids).values(
            'id', 'anomalyType', 'confidenceScore', 'description'
        ):
            flags_map[f['id']] = f

    for t in txns:
        flag = flags_map.get(t['anomalyFlagId'])
        t['fraudType']        = flag['anomalyType']     if flag else None
        t['fraudConfidence']  = flag['confidenceScore'] if flag else None
        t['fraudDescription'] = flag['description']     if flag else None

    return Response(txns)


@api_view(['POST'])
@permission_classes([AllowAny])
def transaction_ingest(request):
    """
    Ingest a single transaction and run fraud detection asynchronously.
    Body: { atmId, cardHash, amount, transactionType, latitude, longitude }
    """
    data      = request.data
    atm_id    = data.get('atmId')
    card_hash = data.get('cardHash') or hashlib.sha256(str(uuid.uuid4()).encode()).hexdigest()[:16]
    amount    = float(data.get('amount', 0))
    txn_type  = data.get('transactionType', 'WITHDRAWAL')
    lat       = data.get('latitude')
    lng       = data.get('longitude')

    atm = None
    if atm_id:
        try:
            atm = ATM.objects.get(id=atm_id)
        except ATM.DoesNotExist:
            pass

    txn = Transaction.objects.create(
        atm=atm,
        cardHash=card_hash,
        amount=amount,
        transactionType=txn_type,
        latitude=lat or (atm.latitude if atm else None),
        longitude=lng or (atm.longitude if atm else None),
        status='COMPLETED',
        timestamp=timezone.now(),
    )
    threading.Thread(target=_run_fraud_check, args=(txn,), daemon=True).start()

    return Response({
        'transactionId': txn.id,
        'status':        txn.status,
        'message':       'Transaction recorded. Fraud detection running.',
    })
