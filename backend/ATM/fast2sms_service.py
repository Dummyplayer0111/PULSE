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

# ── Region → language detection ───────────────────────────────────────────────
_LANG_MAP = [
    (['TAMIL NADU', 'CHENNAI', 'COIMBATORE', 'MADURAI', 'TRICHY',
      'TIRUCHIRAPPALLI', 'SALEM', 'TIRUNELVELI', 'PONDICHERRY', 'PUDUCHERRY'], 'ta'),

    (['MAHARASHTRA', 'MUMBAI', 'PUNE', 'NASHIK', 'NAGPUR',
      'AURANGABAD', 'THANE', 'NAVI MUMBAI'],                                   'mr'),

    # Karnataka BEFORE West Bengal — 'BENGALURU' contains 'BENGAL', must match 'kn' first
    (['KARNATAKA', 'BANGALORE', 'BENGALURU', 'MYSORE', 'MYSURU',
      'HUBLI', 'DHARWAD', 'MANGALORE', 'MANGALURU', 'BELGAUM'],               'kn'),

    # Use 'WEST BENGAL' / 'KOLKATA' — never bare 'BENGAL' to avoid Bengaluru collision
    (['WEST BENGAL', 'KOLKATA', 'CALCUTTA', 'HOWRAH', 'SILIGURI'],            'bn'),

    (['ANDHRA PRADESH', 'TELANGANA', 'HYDERABAD', 'SECUNDERABAD',
      'VIJAYAWADA', 'VISAKHAPATNAM', 'VIZAG', 'WARANGAL', 'GUNTUR'],          'te'),

    (['GUJARAT', 'AHMEDABAD', 'SURAT', 'BARODA', 'VADODARA',
      'RAJKOT', 'GANDHINAGAR', 'BHAVNAGAR'],                                   'gu'),

    (['DELHI', 'NEW DELHI', 'RAJASTHAN', 'JAIPUR', 'JODHPUR',
      'UTTAR PRADESH', 'LUCKNOW', 'KANPUR', 'AGRA', 'VARANASI',
      'BIHAR', 'PATNA', 'MADHYA PRADESH', 'BHOPAL', 'INDORE',
      'HARYANA', 'GURGAON', 'FARIDABAD', 'CHANDIGARH',
      'PUNJAB', 'AMRITSAR', 'LUDHIANA', 'UTTARAKHAND', 'DEHRADUN'], 'hi'),
]


def detect_language(atm) -> str:
    """
    Return the best-fit language code (ta/mr/bn/kn/te/gu/hi/en)
    by scanning ATM.region and ATM.location.
    Falls back to 'en' when no region matches.
    """
    region   = getattr(atm, 'region',   '') or ''
    location = getattr(atm, 'location', '') or ''
    text = f"{region} {location}".upper()

    for keywords, lang in _LANG_MAP:
        if any(kw in text for kw in keywords):
            return lang
    return 'en'


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
