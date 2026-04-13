"""
PULSE Multilingual Auto-Routing (Feature 11)
============================================
Maps an ATM's geographic region (state / city keywords) to the best-fit
customer notification language.

Single source of truth for the region → language mapping. Both the live
pipeline (pipeline._dispatch_customer_notifications) and the auditing
endpoint (views.language_routing) import from this module.

Supported languages
-------------------
    en — English  (default / fallback)
    hi — Hindi    (North India belt)
    ta — Tamil    (Tamil Nadu, Puducherry)
    te — Telugu   (Andhra Pradesh, Telangana)
    kn — Kannada  (Karnataka)
    mr — Marathi  (Maharashtra)
    bn — Bengali  (West Bengal)
    gu — Gujarati (Gujarat)

Design notes
------------
* Order matters — earlier rules win. Karnataka is listed BEFORE West
  Bengal because the token "BENGALURU" contains the substring "BENGAL".
* Matching is substring-based on the uppercased "{region} {location}"
  string so typos like "Bangalore" vs "Bengaluru" both resolve correctly.
* Falls back to English when nothing matches — safer than guessing.
"""

# ── Region → language mapping (order-sensitive) ──────────────────────────────
REGION_LANGUAGE_RULES = [
    (['TAMIL NADU', 'CHENNAI', 'COIMBATORE', 'MADURAI', 'TRICHY',
      'TIRUCHIRAPPALLI', 'SALEM', 'TIRUNELVELI', 'PONDICHERRY', 'PUDUCHERRY'], 'ta'),

    (['MAHARASHTRA', 'MUMBAI', 'PUNE', 'NASHIK', 'NAGPUR',
      'AURANGABAD', 'THANE', 'NAVI MUMBAI'],                                   'mr'),

    # Karnataka BEFORE West Bengal — 'BENGALURU' contains 'BENGAL'
    (['KARNATAKA', 'BANGALORE', 'BENGALURU', 'MYSORE', 'MYSURU',
      'HUBLI', 'DHARWAD', 'MANGALORE', 'MANGALURU', 'BELGAUM'],               'kn'),

    # Use 'WEST BENGAL' / 'KOLKATA' — never bare 'BENGAL' to avoid Bengaluru
    (['WEST BENGAL', 'KOLKATA', 'CALCUTTA', 'HOWRAH', 'SILIGURI'],            'bn'),

    (['ANDHRA PRADESH', 'TELANGANA', 'HYDERABAD', 'SECUNDERABAD',
      'VIJAYAWADA', 'VISAKHAPATNAM', 'VIZAG', 'WARANGAL', 'GUNTUR'],          'te'),

    (['GUJARAT', 'AHMEDABAD', 'SURAT', 'BARODA', 'VADODARA',
      'RAJKOT', 'GANDHINAGAR', 'BHAVNAGAR'],                                   'gu'),

    (['DELHI', 'NEW DELHI', 'RAJASTHAN', 'JAIPUR', 'JODHPUR',
      'UTTAR PRADESH', 'LUCKNOW', 'KANPUR', 'AGRA', 'VARANASI',
      'BIHAR', 'PATNA', 'MADHYA PRADESH', 'BHOPAL', 'INDORE',
      'HARYANA', 'GURGAON', 'FARIDABAD', 'CHANDIGARH',
      'PUNJAB', 'AMRITSAR', 'LUDHIANA', 'UTTARAKHAND', 'DEHRADUN'],            'hi'),
]

# Display metadata — used by the Communications UI and audit endpoint.
LANGUAGE_META = {
    'en': {'name': 'English',  'native': 'English',   'flag': 'IN'},
    'hi': {'name': 'Hindi',    'native': 'हिन्दी',     'flag': 'IN'},
    'ta': {'name': 'Tamil',    'native': 'தமிழ்',     'flag': 'IN'},
    'te': {'name': 'Telugu',   'native': 'తెలుగు',    'flag': 'IN'},
    'kn': {'name': 'Kannada',  'native': 'ಕನ್ನಡ',     'flag': 'IN'},
    'mr': {'name': 'Marathi',  'native': 'मराठी',     'flag': 'IN'},
    'bn': {'name': 'Bengali',  'native': 'বাংলা',      'flag': 'IN'},
    'gu': {'name': 'Gujarati', 'native': 'ગુજરાતી',    'flag': 'IN'},
}

SUPPORTED_LANGUAGES = list(LANGUAGE_META.keys())


def detect_language(atm) -> str:
    """
    Return the best-fit language code (en/hi/ta/te/kn/mr/bn/gu) by scanning
    ATM.region and ATM.location. Falls back to 'en' when no region matches.

    `atm` may be a full ATM model instance OR any object exposing .region
    and .location attributes. This keeps the function test-friendly.
    """
    region   = getattr(atm, 'region',   '') or ''
    location = getattr(atm, 'location', '') or ''
    text = f"{region} {location}".upper()

    for keywords, lang in REGION_LANGUAGE_RULES:
        if any(kw in text for kw in keywords):
            return lang
    return 'en'


def detect_language_from_text(region: str = '', location: str = '') -> str:
    """String-only version — handy for scripts, tests, and the admin UI."""
    text = f"{region or ''} {location or ''}".upper()
    for keywords, lang in REGION_LANGUAGE_RULES:
        if any(kw in text for kw in keywords):
            return lang
    return 'en'


def get_language_name(code: str) -> str:
    """'ta' → 'Tamil'. Returns the code itself for unknown languages."""
    return LANGUAGE_META.get(code, {}).get('name', code)


def get_language_meta(code: str) -> dict:
    """Full display metadata for a language code. Safe fallback for unknowns."""
    return LANGUAGE_META.get(code, {'name': code, 'native': code, 'flag': 'IN'})
