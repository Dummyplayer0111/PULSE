"""
PULSE Core Pipeline — process_log()

Data flow (PULSE_Final_Plan_v2.md §9):

    ATM / Payment Channel generates log
                  │
                  ▼
        POST /api/logs/ingest/
                  │
                  ▼
          LogEntry saved to DB
                  │
                  ▼
      process_log()  ← this module
                  │
            ┌─────┴──────┐
            │             │
            ▼             ▼
      AI Root Cause   Anomaly Check
       Classifier      (Z-score)
            │
            ▼
      Incident Created
      (if ERROR/CRITICAL)
            │
            ▼
      Health Score Recalculated  (§11 algorithm)
            │
            ▼
      Alert Created
            │
       ┌────┼────────────┐
       │    │            │
       ▼    ▼            ▼
  WebSocket  Self-Heal   Customer Notification
  broadcast  triggered   (language auto-selected)
"""

import os
import uuid
from datetime import timedelta

import requests as http_requests
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

AI_SERVICE_URL = os.environ.get("AI_SERVICE_URL", "http://localhost:8001")

# ── Self-heal map (spec §8) ───────────────────────────────────────────────────
SELF_HEAL_MAP = {
    'NETWORK':  'SWITCH_NETWORK',
    'SWITCH':   'RESTART_SERVICE',
    'SERVER':   'RESTART_SERVICE',
    'TIMEOUT':  'FLUSH_CACHE',
    'CASH_JAM': 'ALERT_ENGINEER',
    'FRAUD':    'FREEZE_ATM',
    'HARDWARE': 'ALERT_ENGINEER',
    'UNKNOWN':  'ALERT_ENGINEER',
}

# Actions that can auto-resolve the incident remotely
AUTO_RESOLVE_ACTIONS = {'SWITCH_NETWORK', 'RESTART_SERVICE', 'FLUSH_CACHE', 'REROUTE_TRAFFIC'}

# Map root cause → notification template key
TEMPLATE_KEY_MAP = {
    'NETWORK':  'network_failure',
    'SWITCH':   'network_failure',
    'SERVER':   'upi_timeout',
    'TIMEOUT':  'upi_timeout',
    'CASH_JAM': 'cash_jam',
    'FRAUD':    'card_decline',
    'HARDWARE': 'atm_offline',
    'UNKNOWN':  'atm_offline',
}


# ── FastAPI helpers ───────────────────────────────────────────────────────────

def _call_classify(event_code, log_level):
    """Call FastAPI /classify. Returns dict or None (for INFO)."""
    resp = http_requests.post(
        f"{AI_SERVICE_URL}/classify",
        json={"eventCode": event_code, "logLevel": log_level},
        timeout=5,
    )
    resp.raise_for_status()
    return resp.json()


def _call_detect(source_id, source_type, log_entry):
    """
    Build Z-score payload from recent DB stats and call FastAPI /detect.
    Returns the response dict or None if insufficient data.
    """
    from .models import LogEntry

    now = timezone.now()
    hour_ago       = now - timedelta(hours=1)
    thirty_days_ago = now - timedelta(days=30)
    day_ago        = now - timedelta(hours=24)

    # Current 1-hour error window
    window_qs = LogEntry.objects.filter(
        sourceId=source_id, sourceType=source_type, timestamp__gte=hour_ago,
    )
    w_total  = window_qs.count()
    w_errors = window_qs.filter(logLevel__in=['ERROR', 'CRITICAL']).count()
    curr_error_rate = w_errors / max(w_total, 1)

    # Historical baseline: all logs older than the current 1-hour window
    baseline_qs = LogEntry.objects.filter(
        sourceId=source_id, sourceType=source_type,
        timestamp__lt=hour_ago,
    )
    b_total = baseline_qs.count()
    if b_total >= 5:
        b_errors = baseline_qs.filter(logLevel__in=['ERROR', 'CRITICAL']).count()
        b_mean = b_errors / max(b_total, 1)
        b_std  = max(b_mean * 0.3, 0.01)
    else:
        # Demo fallback: assume a 5 % normal error rate baseline
        b_mean = 0.05
        b_std  = 0.015

    recent_codes = list(
        LogEntry.objects.filter(
            sourceId=source_id, sourceType=source_type, timestamp__gte=hour_ago,
        ).values('eventCode')[:20]
    )

    payload = {
        "currentWindow":      {"errorRate": curr_error_rate},
        "historicalBaseline": {"meanErrorRate": b_mean, "stdDevErrorRate": b_std},
        "recentLogs":         [{"eventCode": r['eventCode']} for r in recent_codes],
    }
    resp = http_requests.post(f"{AI_SERVICE_URL}/detect", json=payload, timeout=3)
    resp.raise_for_status()
    return resp.json()


# ── Health score algorithm (spec §11) ─────────────────────────────────────────

def _recalculate_health_score(source_id, source_type):
    from .models import LogEntry, Incident

    window = timezone.now() - timedelta(hours=1)
    recent = LogEntry.objects.filter(
        sourceId=source_id, sourceType=source_type, timestamp__gte=window,
    )
    total = recent.count()
    if total == 0:
        return 100

    errors    = recent.filter(logLevel='ERROR').count()
    criticals = recent.filter(logLevel='CRITICAL').count()
    warns     = recent.filter(logLevel='WARN').count()

    error_rate = (errors + criticals * 2) / total

    open_incidents = Incident.objects.filter(
        sourceId=source_id, status__in=['OPEN', 'INVESTIGATING'],
    ).count()

    score  = 100
    score -= min(40, error_rate * 100)
    score -= min(30, warns * 2)       # cap warn penalty
    score -= open_incidents * 15
    return max(0, round(score))


# ── Customer notification dispatch ────────────────────────────────────────────

def _dispatch_customer_notifications(incident):
    """
    Auto-create CustomerNotification rows for the incident.
    Language auto-selected: English + Tamil for demo (spec §10 logic).
    """
    from .models import MessageTemplate, CustomerNotification

    template_key = TEMPLATE_KEY_MAP.get(incident.rootCauseCategory, 'atm_offline')

    for lang in ('en', 'ta'):
        tmpl = MessageTemplate.objects.filter(
            templateKey=template_key, language=lang, channel='SMS',
        ).first()
        if not tmpl:
            continue

        msg_text = tmpl.body.replace('{atm_id}', incident.incidentId)

        CustomerNotification.objects.create(
            recipientId=f'+91-DEMO-{lang.upper()}',
            channel='SMS',
            message=msg_text,
            language=lang,
            status='SENT',
            incidentDbId=incident.id,
            messageTemplateId=tmpl.id,
            messageSent=msg_text,
            sentAt=timezone.now(),
        )


# ── WebSocket broadcast ───────────────────────────────────────────────────────

def _broadcast_atm(atm):
    try:
        async_to_sync(get_channel_layer().group_send)(
            'dashboard',
            {
                'type': 'atm_update',
                'data': {
                    'type':           'atm_update',
                    'atm': {
                        'id':              atm.id,
                        'name':            atm.name,
                        'location':        atm.location,
                        'status':          atm.status,
                        'healthScore':     atm.healthScore,
                        'networkScore':    atm.networkScore,
                        'hardwareScore':   atm.hardwareScore,
                        'softwareScore':   atm.softwareScore,
                        'transactionScore':atm.transactionScore,
                        'latitude':        atm.latitude,
                        'longitude':       atm.longitude,
                    },
                },
            }
        )
    except Exception:
        pass


def _broadcast_pipeline_event(log_entry, classification, incident, heal_action):
    try:
        async_to_sync(get_channel_layer().group_send)(
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
                    'classification': classification,
                    'incident': {
                        'id':         incident.id,
                        'incidentId': incident.incidentId,
                        'title':      incident.title,
                        'severity':   incident.severity,
                        'category':   incident.rootCauseCategory,
                        'confidence': incident.aiConfidence,
                        'status':     incident.status,
                    } if incident else None,
                    'selfHealAction': heal_action.actionType if heal_action else None,
                    'timestamp':      timezone.now().isoformat(),
                },
            }
        )
    except Exception:
        pass


# ── Main pipeline entry point ─────────────────────────────────────────────────

def process_log(log_entry_id):
    """
    Full PULSE pipeline for a single LogEntry.
    Designed to run in a background thread (or Celery task).
    """
    from .models import (
        LogEntry, Incident, HealthSnapshot, Alert, SelfHealAction,
        AnomalyFlag, ATM,
    )

    try:
        log_entry = LogEntry.objects.get(id=log_entry_id)
    except LogEntry.DoesNotExist:
        return

    classification = None
    incident       = None
    heal_action    = None

    # Resolve ATM for health score updates
    atm = None
    try:
        atm = ATM.objects.get(id=log_entry.sourceId.int)
    except Exception:
        pass

    # ── STEP 1: AI Root Cause Classification ─────────────────────────────────
    if log_entry.logLevel in ('ERROR', 'CRITICAL', 'WARN'):
        try:
            classification = _call_classify(log_entry.eventCode, log_entry.logLevel)
        except Exception:
            pass

    # ── STEP 2: Anomaly Check (Z-score via FastAPI /detect) ──────────────────
    if log_entry.logLevel in ('ERROR', 'CRITICAL'):
        try:
            detect = _call_detect(log_entry.sourceId, log_entry.sourceType, log_entry)
            if detect and detect.get('isAnomaly'):
                AnomalyFlag.objects.create(
                    sourceId=log_entry.sourceId,
                    sourceType=log_entry.sourceType,
                    anomalyType=detect.get('anomalyType', 'RAPID_FAILURES'),
                    confidenceScore=min(1.0, detect.get('confidenceScore', 0.5)),
                    description=detect.get('explanation', 'Z-score anomaly detected.'),
                    logEntryId=log_entry.id,
                    status='FLAGGED',
                )
        except Exception:
            pass

    # ── STEP 3: Incident Created (ERROR/CRITICAL + confidence ≥ 0.65) ────────
    if classification and log_entry.logLevel in ('ERROR', 'CRITICAL'):
        confidence = classification.get('confidence', 0)
        category   = classification.get('category', 'UNKNOWN')
        detail     = classification.get('detail', f'{category} failure detected by AI classifier')

        if confidence >= 0.65 and category != 'UNKNOWN':
            severity_map = {'CRITICAL': 'CRITICAL', 'ERROR': 'HIGH', 'WARN': 'MEDIUM'}
            severity = 'CRITICAL' if category == 'FRAUD' else severity_map.get(log_entry.logLevel, 'MEDIUM')

            atm_name = atm.name if atm else f'ATM-{str(log_entry.sourceId.int)[:6]}'
            incident_number = f'INC-{uuid.uuid4().hex[:8].upper()}'

            incident = Incident.objects.create(
                incidentId=incident_number,
                title=f'{category} failure at {atm_name}',
                severity=severity,
                status='OPEN',
                sourceId=log_entry.sourceId,
                sourceType=log_entry.sourceType,
                rootCauseCategory=category,
                rootCauseDetail=detail,
                aiConfidence=confidence,
                triggeringLogId=uuid.UUID(int=log_entry.id),
                contributingLogIds=[log_entry.id],
            )

            # ── STEP 4: Health Score Recalculated ─────────────────────────────
            new_score = _recalculate_health_score(log_entry.sourceId, log_entry.sourceType)
            if atm:
                atm.healthScore = new_score
                if atm.status != 'MAINTENANCE':
                    if new_score < 30:
                        atm.status = 'OFFLINE'
                    elif new_score < 60:
                        atm.status = 'DEGRADED'
                    else:
                        atm.status = 'ONLINE'
                atm.lastSeen = timezone.now()
                atm.save()
                _broadcast_atm(atm)

                HealthSnapshot.objects.create(
                    sourceId=log_entry.sourceId,
                    sourceType=log_entry.sourceType,
                    healthScore=new_score,
                    status=atm.status,
                    networkScore=atm.networkScore,
                    hardwareScore=atm.hardwareScore,
                    softwareScore=atm.softwareScore,
                    transactionScore=atm.transactionScore,
                    timestamp=timezone.now(),
                )

            # ── STEP 5: Alert Created ──────────────────────────────────────────
            Alert.objects.create(
                incidentId=uuid.UUID(int=incident.id),
                alertType='REACTIVE',
                title=f'[{severity}] {category} detected at {atm_name}',
                message=(
                    f'AI classifier detected {category} failure with '
                    f'{round(confidence * 100)}% confidence. '
                    f'Incident {incident_number} created.'
                ),
                severity=severity,
                status='ACTIVE',
                sentAt=timezone.now(),
            )

            # ── STEP 6: Self-Heal Triggered ────────────────────────────────────
            action_type = SELF_HEAL_MAP.get(category, 'ALERT_ENGINEER')
            heal_action = SelfHealAction.objects.create(
                incidentId=uuid.UUID(int=incident.id),
                actionType=action_type,
                triggeredBy='AUTO',
                status='SUCCESS',
                result=f'Auto-executed {action_type} for {category} at {atm_name}.',
            )

            # Auto-resolve if the action fixes it remotely
            if action_type in AUTO_RESOLVE_ACTIONS:
                incident.status = 'AUTO_RESOLVED'
                incident.resolvedAt = timezone.now()
                incident.save(update_fields=['status', 'resolvedAt'])

            Alert.objects.create(
                incidentId=uuid.UUID(int=incident.id),
                alertType='SELF_HEAL',
                title=f'Self-Heal: {action_type}',
                message=f'Auto-remediation {action_type} triggered for {incident_number}.',
                severity='LOW',
                status='ACTIVE',
                sentAt=timezone.now(),
            )

            # ── STEP 7: Customer Notification ─────────────────────────────────
            try:
                _dispatch_customer_notifications(incident)
            except Exception:
                pass

    # INFO events: gradually recover ATM health
    elif log_entry.logLevel == 'INFO' and atm and atm.healthScore < 98:
        atm.networkScore      = min(100, atm.networkScore + 2)
        atm.hardwareScore     = min(100, atm.hardwareScore + 2)
        atm.softwareScore     = min(100, atm.softwareScore + 2)
        atm.transactionScore  = min(100, atm.transactionScore + 2)
        atm.healthScore = round(
            (atm.networkScore + atm.hardwareScore +
             atm.softwareScore + atm.transactionScore) / 4, 1
        )
        if atm.status == 'OFFLINE' and atm.healthScore >= 40:
            atm.status = 'DEGRADED'
        elif atm.status == 'DEGRADED' and atm.healthScore >= 75:
            atm.status = 'ONLINE'
        atm.lastSeen = timezone.now()
        atm.save()
        _broadcast_atm(atm)

    # ── STEP 8: WebSocket Broadcast ───────────────────────────────────────────
    _broadcast_pipeline_event(log_entry, classification, incident, heal_action)

    # Mark log as processed
    log_entry.processed = True
    log_entry.save(update_fields=['processed'])
