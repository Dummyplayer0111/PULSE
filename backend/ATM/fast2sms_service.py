"""
PULSE Fast2SMS Service
======================
Reads credentials from environment variables:

    FAST2SMS_API_KEY     — Fast2SMS API key (from fast2sms.com dashboard)
    DEMO_CUSTOMER_PHONE  — Recipient 10-digit Indian mobile number (without +91)

If any of these are unset the SMS is skipped gracefully (status='SKIPPED').
The pipeline continues normally — no crashes, no retries.
"""

import os
import logging

import requests

logger = logging.getLogger(__name__)

FAST2SMS_API_KEY = os.environ.get('FAST2SMS_API_KEY', '').strip()
DEMO_PHONE       = os.environ.get('DEMO_CUSTOMER_PHONE', '').strip()

FAST2SMS_URL = 'https://www.fast2sms.com/dev/bulkV2'

# ── Region → language detection (Feature 11) ──────────────────────────────────
# Region mapping lives in language_router.py — single source of truth shared
# with the audit endpoint and the management command. Re-exported here so that
# existing imports (`from .fast2sms_service import detect_language`) keep
# working.
from .language_router import detect_language, REGION_LANGUAGE_RULES as _LANG_MAP  # noqa: F401


def is_configured() -> bool:
    return bool(FAST2SMS_API_KEY)


def _normalize_number(number: str) -> str:
    """
    Normalize a single number: strip +91/91 prefix, return 10 digits.
    Also handles comma-separated lists — normalizes each entry and rejoins.
    """
    parts = [p.strip().replace(' ', '') for p in number.split(',') if p.strip()]
    normalized = []
    for n in parts:
        n = n.lstrip('+')
        if n.startswith('91') and len(n) == 12:
            n = n[2:]
        normalized.append(n)
    return ','.join(normalized)


def send_sms(to_number: str, body: str) -> dict:
    """
    Send an SMS via Fast2SMS bulk API.

    Returns:
        {'status': 'SENT',    'request_id': '<id>'}
        {'status': 'FAILED',  'error': '<reason>'}
        {'status': 'SKIPPED', 'reason': '<why>'}
    """
    if not to_number:
        logger.warning('[Fast2SMS] DEMO_CUSTOMER_PHONE not set — SMS skipped.')
        return {'status': 'SKIPPED', 'reason': 'DEMO_CUSTOMER_PHONE not configured'}

    if not is_configured():
        logger.warning('[Fast2SMS] FAST2SMS_API_KEY not set — SMS skipped.')
        return {'status': 'SKIPPED', 'reason': 'Fast2SMS API key not configured'}

    number = _normalize_number(to_number)

    try:
        resp = requests.get(
            FAST2SMS_URL,
            params={
                'authorization': FAST2SMS_API_KEY,
                'route':         'q',
                'message':       body,
                'language':      'english',
                'flash':         0,
                'numbers':       number,
            },
            timeout=10,
        )
        data = resp.json()
        if data.get('return') is True:
            request_id = data.get('request_id', '')
            logger.info('[Fast2SMS] SMS sent to %s | request_id: %s', number, request_id)
            return {'status': 'SENT', 'request_id': request_id}
        else:
            logger.error('[Fast2SMS] API error for %s: %s', number, data)
            return {'status': 'FAILED', 'error': str(data)}

    except Exception as exc:
        logger.error('[Fast2SMS] SMS failed to %s: %s', number, exc)
        return {'status': 'FAILED', 'error': str(exc)}
