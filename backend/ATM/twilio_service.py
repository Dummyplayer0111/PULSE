"""
PULSE Twilio SMS Service
========================
Reads credentials from environment variables:

    TWILIO_ACCOUNT_SID   — Twilio Account SID (ACxxxxxxxx…)
    TWILIO_AUTH_TOKEN    — Twilio Auth Token
    TWILIO_FROM_NUMBER   — Your Twilio phone number in E.164 (+15005550006 for test)
    DEMO_CUSTOMER_PHONE  — The recipient number for demo SMS (+91XXXXXXXXXX)

If any of these are unset the SMS is skipped gracefully (status='SKIPPED').
The pipeline continues normally — no crashes, no retries.
"""

import os
import logging

logger = logging.getLogger(__name__)

# ── Credentials ───────────────────────────────────────────────────────────────
ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '').strip()
AUTH_TOKEN  = os.environ.get('TWILIO_AUTH_TOKEN',  '').strip()
FROM_NUMBER = os.environ.get('TWILIO_FROM_NUMBER', '').strip()
DEMO_PHONE  = os.environ.get('DEMO_CUSTOMER_PHONE','').strip()

# ── Region → language detection ───────────────────────────────────────────────
# Ordered most-specific first. Matched against ATM.region + ATM.location (uppercased).
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


# ── Twilio send ───────────────────────────────────────────────────────────────

def is_configured() -> bool:
    return bool(ACCOUNT_SID and AUTH_TOKEN and FROM_NUMBER)


def send_sms(to_number: str, body: str) -> dict:
    """
    Send an SMS via Twilio REST API.

    Returns:
        {'status': 'SENT',    'sid':   '<MessageSid>'}
        {'status': 'FAILED',  'error': '<reason>'}
        {'status': 'SKIPPED', 'reason':'<why>'}
    """
    if not to_number:
        logger.warning('[Twilio] DEMO_CUSTOMER_PHONE not set — SMS skipped.')
        return {'status': 'SKIPPED', 'reason': 'DEMO_CUSTOMER_PHONE not configured'}

    if not is_configured():
        logger.warning(
            '[Twilio] Credentials missing — SMS skipped. '
            'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.'
        )
        return {'status': 'SKIPPED', 'reason': 'Twilio credentials not configured'}

    try:
        from twilio.rest import Client
        client = Client(ACCOUNT_SID, AUTH_TOKEN)
        msg = client.messages.create(body=body, from_=FROM_NUMBER, to=to_number)
        logger.info('[Twilio] SMS sent to %s | SID: %s', to_number, msg.sid)
        return {'status': 'SENT', 'sid': msg.sid}

    except Exception as exc:
        logger.error('[Twilio] SMS failed to %s: %s', to_number, exc)
        return {'status': 'FAILED', 'error': str(exc)}
