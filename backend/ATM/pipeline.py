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
import random
from datetime import timedelta

import requests as http_requests
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

AI_SERVICE_URL = os.environ.get("AI_SERVICE_URL", "http://localhost:8001")

# Test customer phone for simulator
TEST_CUSTOMER_PHONE = '8374273580'
TEST_CUSTOMER_CARD_LAST4 = '8374'

# Human-readable failure reasons (English + Hindi)
FAILURE_REASONS = {
    'CASH_JAM': {
        'en': 'Cash jam — your ₹{amount} was debited but cash was not dispensed. Your money is safe and will be refunded within 5 working days as per RBI guidelines.',
        'hi': 'कैश जाम — आपका ₹{amount} डेबिट हो गया लेकिन नकद नहीं निकला। RBI नियमों के अनुसार आपका पैसा 5 कार्य दिवसों में वापस किया जाएगा।',
    },
    'PARTIAL_DISPENSE': {
        'en': 'Only ₹{dispensed} of ₹{amount} was dispensed. The remaining ₹{refund} will be refunded within 5 working days as per RBI guidelines.',
        'hi': '₹{amount} में से केवल ₹{dispensed} निकला। शेष ₹{refund} RBI नियमों के अनुसार 5 कार्य दिवसों में वापस किया जाएगा।',
    },
    'NETWORK_TIMEOUT': {
        'en': 'Transaction timed out during processing. We are verifying with your bank whether ₹{amount} was debited. If debited, auto-reversal will happen within 5 working days.',
        'hi': 'लेनदेन प्रोसेसिंग के दौरान समय समाप्त हो गया। हम आपके बैंक से जाँच कर रहे हैं कि ₹{amount} डेबिट हुआ या नहीं। यदि डेबिट हुआ तो 5 कार्य दिवसों में स्वतः वापसी होगी।',
    },
    'CARD_CAPTURED': {
        'en': 'ATM retained your card due to a hardware fault. No money was debited. Your card will be securely destroyed per RBI guidelines. Please visit your branch or call your bank to request a replacement card (5-7 working days).',
        'hi': 'हार्डवेयर गड़बड़ी के कारण ATM ने आपका कार्ड रख लिया। कोई पैसा डेबिट नहीं हुआ। RBI नियमों के अनुसार कार्ड सुरक्षित रूप से नष्ट किया जाएगा। नया कार्ड पाने के लिए अपनी शाखा जाएं (5-7 कार्य दिवस)।',
    },
}

# Indian engineer names for realistic demo
INDIAN_ENGINEER_NAMES = [
    'Rajesh K.', 'Priya S.', 'Arun M.', 'Deepa R.', 'Suresh P.',
    'Kavitha N.', 'Manoj T.', 'Lakshmi V.', 'Vikram B.', 'Anita G.',
]

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

def _dispatch_customer_notifications(incident, atm=None):
    """
    Detect the customer's regional language from the ATM location, pick the
    matching MessageTemplate, and send an SMS via Fast2SMS.

    Sends two messages per incident:
      1. Regional language (ta/mr/bn/kn/te/gu/hi) — customer's native tongue
      2. English — universal fallback (skipped when region is already 'en')

    A CustomerNotification row is created for each, with status reflecting the
    actual Fast2SMS response: SENT / FAILED / SKIPPED.
    """
    import time
    from .models import MessageTemplate, CustomerNotification
    from .fast2sms_service import detect_language, send_sms, DEMO_PHONE

    template_key = TEMPLATE_KEY_MAP.get(incident.rootCauseCategory, 'atm_offline')

    # Send ONE message only — regional language if available, English otherwise.
    # This conserves SMS credits and keeps notifications concise.
    regional_lang = detect_language(atm) if atm else 'en'
    langs_to_send = [regional_lang]

    recipient = DEMO_PHONE or ''

    for lang in langs_to_send:
        tmpl = MessageTemplate.objects.filter(
            templateKey=template_key, language=lang, channel='SMS',
        ).first()
        if not tmpl:
            continue

        msg_text = tmpl.body.replace('{atm_id}', incident.incidentId)
        result = send_sms(recipient, msg_text)

        CustomerNotification.objects.create(
            recipientId=recipient,
            channel='SMS',
            message=msg_text,
            language=lang,
            status=result.get('status', 'SKIPPED'),
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


def _broadcast_log_entry(log_entry):
    """
    Broadcast every processed log to its ATM-specific group so the
    frontend LIVE log stream (ws/logs/<atm_id>/) receives real-time rows.
    The group name mirrors LogConsumer: logs_{atm_int_id}.
    """
    try:
        atm_int_id = log_entry.sourceId.int
        async_to_sync(get_channel_layer().group_send)(
            f'logs_{atm_int_id}',
            {
                'type': 'log_entry',
                'data': {
                    'type':       'log_entry',
                    'id':         log_entry.id,
                    # camelCase + snake_case both included — frontend dedup key
                    # uses `l.eventCode ?? l.event_code`
                    'logLevel':   log_entry.logLevel,
                    'log_level':  log_entry.logLevel,
                    'eventCode':  log_entry.eventCode,
                    'event_code': log_entry.eventCode,
                    'message':    log_entry.message,
                    'timestamp':  log_entry.timestamp.isoformat(),
                    'sourceId':   str(log_entry.sourceId),
                    'sourceType': log_entry.sourceType,
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


# ── Auto-assign to least-loaded engineer ──────────────────────────────────────

def _auto_assign_engineer(incident):
    """
    Pick the ENGINEER with the fewest open/investigating incidents and assign them.
    Returns the chosen username or None if no engineers exist.
    """
    from .models import UserProfile, Incident as Inc

    engineers = list(
        UserProfile.objects.filter(role='ENGINEER').select_related('user')
    )
    if not engineers:
        return None

    def load(profile):
        return Inc.objects.filter(
            assignedTo=profile.user.username,
            status__in=['OPEN', 'INVESTIGATING'],
        ).count()

    chosen = min(engineers, key=load)
    incident.assignedTo = chosen.user.username
    incident.status     = 'INVESTIGATING'
    incident.save(update_fields=['assignedTo', 'status'])
    return chosen.user.username


# ── Customer WebSocket broadcast ──────────────────────────────────────────────

def broadcast_customer_update(phone_hash, failed_txn):
    """Push a transaction status update to the customer's WebSocket group."""
    from .customer_views import _serialize_failed_txn
    try:
        async_to_sync(get_channel_layer().group_send)(
            f'customer_{phone_hash}',
            {
                'type': 'transaction_update',
                'data': {
                    'type': 'transaction_update',
                    'transaction': _serialize_failed_txn(failed_txn, include_timeline=True),
                },
            }
        )
    except Exception:
        pass


def create_failed_transaction(incident, atm, failure_type='CASH_JAM',
                               phone=None, amount=None, card_last4=None):
    """
    Create a FailedTransaction linked to an Incident.
    Generates a status token for the SMS link.
    Returns the FailedTransaction instance.
    """
    from .models import FailedTransaction, StatusToken
    import hashlib

    phone = phone or TEST_CUSTOMER_PHONE
    card_last4 = card_last4 or TEST_CUSTOMER_CARD_LAST4
    amount = amount or random.choice([2000, 3000, 5000, 10000])
    phone_hash = hashlib.sha256(phone.strip().encode()).hexdigest()

    # Build transaction ref: TXN-YYYYMMDD-ATMNAME-NNN
    now = timezone.now()
    atm_short = (atm.name if atm else 'UNK').replace(' ', '').replace('-', '')[:8]
    seq = FailedTransaction.objects.filter(phone_hash=phone_hash).count() + 1
    txn_ref = f"TXN-{now.strftime('%Y%m%d')}-{atm_short}-{seq:03d}"

    # Failure-specific amounts — realistic for each scenario
    amount_dispensed = 0
    refund_amount = amount
    if failure_type == 'PARTIAL_DISPENSE':
        amount_dispensed = round(amount * 0.4)  # 40% came out
        refund_amount = amount - amount_dispensed
    elif failure_type == 'NETWORK_TIMEOUT':
        refund_amount = 0  # likely not debited; bank will confirm
    elif failure_type == 'CARD_CAPTURED':
        refund_amount = 0  # no money was debited, only card retained

    # Determine refund_status
    if failure_type in ('NETWORK_TIMEOUT', 'CARD_CAPTURED'):
        refund_status = 'NOT_APPLICABLE'
        refund_eta_dt = None
    else:
        refund_status = 'PENDING'
        refund_eta_dt = now + timedelta(days=5)  # RBI T+5 guideline

    reasons = FAILURE_REASONS.get(failure_type, FAILURE_REASONS['CASH_JAM'])
    reason_en = reasons['en'].format(
        amount=f"{amount:,.0f}",
        dispensed=f"{amount_dispensed:,.0f}",
        refund=f"{refund_amount:,.0f}",
    )
    reason_hi = reasons['hi'].format(
        amount=f"{amount:,.0f}",
        dispensed=f"{amount_dispensed:,.0f}",
        refund=f"{refund_amount:,.0f}",
    )

    engineer_name = incident.assignedTo or random.choice(INDIAN_ENGINEER_NAMES)
    engineer_eta = random.randint(25, 55)

    atm_display = f"ATM {atm.location}" if atm else "ATM"

    # Failure-type-specific initial timeline messages
    detect_msg_en = {
        'CASH_JAM': f"Cash jam detected. Your \u20b9{amount:,.0f} is safe — refund is being processed.",
        'PARTIAL_DISPENSE': f"Partial dispense: only \u20b9{amount_dispensed:,.0f} of \u20b9{amount:,.0f} came out. \u20b9{refund_amount:,.0f} refund in progress.",
        'NETWORK_TIMEOUT': f"Transaction timed out. Checking with your bank if \u20b9{amount:,.0f} was debited.",
        'CARD_CAPTURED': f"ATM retained your card due to hardware fault. No money was debited.",
    }
    detect_msg_hi = {
        'CASH_JAM': f"कैश जाम। आपका \u20b9{amount:,.0f} सुरक्षित है — रिफंड प्रक्रिया में है।",
        'PARTIAL_DISPENSE': f"आंशिक निकासी: \u20b9{amount:,.0f} में से केवल \u20b9{amount_dispensed:,.0f} निकला। \u20b9{refund_amount:,.0f} वापसी प्रक्रिया में।",
        'NETWORK_TIMEOUT': f"लेनदेन का समय समाप्त। बैंक से जाँच हो रही है कि \u20b9{amount:,.0f} डेबिट हुआ या नहीं।",
        'CARD_CAPTURED': f"हार्डवेयर गड़बड़ी के कारण ATM ने कार्ड रख लिया। कोई पैसा डेबिट नहीं हुआ।",
    }

    timeline = [
        {
            'time': now.isoformat(),
            'message': f"Withdrawal of \u20b9{amount:,.0f} attempted at {atm_display}",
            'message_hi': f"{atm_display} पर \u20b9{amount:,.0f} की निकासी का प्रयास",
            'status': 'DETECTED',
        },
        {
            'time': (now + timedelta(seconds=3)).isoformat(),
            'message': detect_msg_en.get(failure_type, detect_msg_en['CASH_JAM']),
            'message_hi': detect_msg_hi.get(failure_type, detect_msg_hi['CASH_JAM']),
            'status': 'DETECTED',
        },
    ]

    if incident:
        timeline.append({
            'time': (now + timedelta(seconds=10)).isoformat(),
            'message': f"Incident logged. Engineer {engineer_name} assigned. ETA: {engineer_eta} min.",
            'message_hi': f"घटना दर्ज। इंजीनियर {engineer_name} नियुक्त। अनुमानित समय: {engineer_eta} मिनट।",
            'status': 'INVESTIGATING',
        })

    ftxn = FailedTransaction.objects.create(
        transaction_ref=txn_ref,
        phone_hash=phone_hash,
        phone_last_four=phone[-4:],
        card_last_four=card_last4,
        amount=amount,
        amount_dispensed=amount_dispensed,
        refund_amount=refund_amount,
        atm=atm,
        incident=incident,
        transaction_type='WITHDRAWAL',
        failure_type=failure_type,
        failure_reason=reason_en,
        failure_reason_hi=reason_hi,
        status='DETECTED',
        refund_status=refund_status,
        refund_eta=refund_eta_dt,
        engineer_name=engineer_name,
        engineer_eta_minutes=engineer_eta,
        timeline=timeline,
    )

    # Create status token for SMS link (24-hour expiry)
    status_token = StatusToken.objects.create(
        token=StatusToken.generate_token(),
        failed_transaction=ftxn,
        expires_at=now + timedelta(hours=24),
    )

    # Mock SMS notification — realistic DLT-template-style message
    sms_link = f"http://localhost:3000/customer/status/{status_token.token}"
    sms_messages = {
        'CASH_JAM': f"PayGuard Alert: Your \u20b9{amount:,.0f} withdrawal at {atm_display} failed (cash jam). Your money is safe & refund is being processed. Track: {sms_link} — PayGuard",
        'PARTIAL_DISPENSE': f"PayGuard Alert: Only \u20b9{amount_dispensed:,.0f} of \u20b9{amount:,.0f} dispensed at {atm_display}. \u20b9{refund_amount:,.0f} refund in progress. Track: {sms_link} — PayGuard",
        'NETWORK_TIMEOUT': f"PayGuard Alert: Your transaction of \u20b9{amount:,.0f} at {atm_display} timed out. We're verifying with your bank. Track: {sms_link} — PayGuard",
        'CARD_CAPTURED': f"PayGuard Alert: {atm_display} retained your card (****{card_last4}) due to hardware issue. No money debited. Visit your branch for replacement. Track: {sms_link} — PayGuard",
    }
    sms_text = sms_messages.get(failure_type, sms_messages['CASH_JAM'])
    print(f"\n{'='*70}")
    print(f"  \U0001f4f1 SMS → +91 ***{phone[-4:]}:")
    print(f"  {sms_text}")
    print(f"{'='*70}\n")

    # Broadcast to customer WebSocket
    broadcast_customer_update(phone_hash, ftxn)

    return ftxn


def update_failed_transaction_status(ftxn, new_status, message_en, message_hi,
                                       refund_status=None):
    """Update a FailedTransaction status, append timeline, broadcast."""
    import hashlib
    now = timezone.now()

    ftxn.status = new_status
    if refund_status:
        ftxn.refund_status = refund_status

    timeline = ftxn.timeline or []
    timeline.append({
        'time': now.isoformat(),
        'message': message_en,
        'message_hi': message_hi,
        'status': new_status,
    })
    ftxn.timeline = timeline
    ftxn.save()

    # Broadcast
    broadcast_customer_update(ftxn.phone_hash, ftxn)

    # Resolution SMS — failure-type specific
    if new_status == 'RESOLVED':
        atm_display = f"ATM {ftxn.atm.location}" if ftxn.atm else "ATM"
        sms_map = {
            'CASH_JAM': f"PayGuard: Your \u20b9{ftxn.amount:,.0f} is safe. {atm_display} restored. Refund of \u20b9{ftxn.refund_amount:,.0f} will reach your account within 5 working days. — PayGuard",
            'PARTIAL_DISPENSE': f"PayGuard: {atm_display} restored. \u20b9{ftxn.refund_amount:,.0f} refund (balance of your \u20b9{ftxn.amount:,.0f} withdrawal) will reach your account within 5 working days. — PayGuard",
            'NETWORK_TIMEOUT': f"PayGuard: Good news! Your \u20b9{ftxn.amount:,.0f} transaction at {atm_display} was NOT debited. No action needed. — PayGuard",
            'CARD_CAPTURED': f"PayGuard: Your card (****{ftxn.card_last_four}) from {atm_display} has been securely destroyed. Visit your branch for a replacement (5-7 working days). — PayGuard",
        }
        sms_text = sms_map.get(ftxn.failure_type, sms_map['CASH_JAM'])
        print(f"\n{'='*70}")
        print(f"  \U0001f4f1 SMS → +91 ***{ftxn.phone_last_four}:")
        print(f"  {sms_text}")
        print(f"{'='*70}\n")


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

            # Auto-assign to least-loaded engineer (skipped if none exist)
            _auto_assign_engineer(incident)

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

            # ── STEP 7: Customer Notification (Fast2SMS) ──────────────────────
            NOTIFY_CATEGORIES = {'CASH_JAM', 'FRAUD', 'HARDWARE', 'NETWORK', 'TIMEOUT'}
            NOTIFY_SEVERITIES  = {'HIGH', 'CRITICAL'}
            should_notify = (
                severity in NOTIFY_SEVERITIES
                and category in NOTIFY_CATEGORIES
                and incident.status != 'AUTO_RESOLVED'
            )
            if should_notify:
                try:
                    _dispatch_customer_notifications(incident, atm=atm)
                except Exception:
                    pass

            # ── STEP 8: Create FailedTransaction for customer portal ─────────
            # ~50% of matching incidents affect the test customer (realistic:
            # not every ATM failure involves the same person)
            CUSTOMER_FAILURE_MAP = {
                'CASH_JAM': 'CASH_JAM',
                'HARDWARE': 'CARD_CAPTURED',
                'NETWORK': 'NETWORK_TIMEOUT',
                'TIMEOUT': 'NETWORK_TIMEOUT',
            }
            if category in CUSTOMER_FAILURE_MAP and random.random() < 0.50:
                try:
                    failure_type = CUSTOMER_FAILURE_MAP[category]
                    # 30% of cash jams are actually partial dispense
                    if failure_type == 'CASH_JAM' and random.random() < 0.30:
                        failure_type = 'PARTIAL_DISPENSE'
                    create_failed_transaction(
                        incident=incident,
                        atm=atm,
                        failure_type=failure_type,
                        phone=TEST_CUSTOMER_PHONE,
                        card_last4=TEST_CUSTOMER_CARD_LAST4,
                    )
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

    # ── STEP 9: WebSocket Broadcast ───────────────────────────────────────────
    # 9a. Broadcast to ATM-specific log stream (ws/logs/<atm_id>/) — all levels
    _broadcast_log_entry(log_entry)
    # 9b. Broadcast to dashboard group (pipeline_event + atm_update already sent above)
    _broadcast_pipeline_event(log_entry, classification, incident, heal_action)

    # Mark log as processed
    log_entry.processed = True
    log_entry.save(update_fields=['processed'])
