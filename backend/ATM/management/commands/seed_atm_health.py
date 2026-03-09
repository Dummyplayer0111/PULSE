"""
Management command: seed_atm_health

Seeds 20 Indian ATMs with a realistic health distribution:
  - 10 GREEN  (healthScore 85-98, ONLINE)
  -  5 YELLOW (healthScore 60-75, DEGRADED)
  -  5 RED    (healthScore 20-50, DEGRADED / OFFLINE)

For each ATM it also seeds:
  - 7 days of LogEntry history (error density ∝ health tier)
  - HealthSnapshot records every 4 h for the 7-day trend chart
  - Open Incidents for YELLOW / RED ATMs (explains the low score)

Run:
    python manage.py seed_atm_health
Add --flush to wipe existing ATMs / logs / snapshots / incidents first.
"""

import hashlib
import random
import uuid
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from ATM.models import ATM, HealthSnapshot, Incident, LogEntry

# ── ATM definitions ──────────────────────────────────────────────────────────

GREEN_ATMS = [
    dict(name="MU-BND-001", location="Bandra West Branch, Mumbai",
         region="Mumbai", model="NCR SelfServ 84", lat=19.0596, lon=72.8295),
    dict(name="MU-LPL-002", location="Lower Parel Hub, Mumbai",
         region="Mumbai", model="Diebold DN Series", lat=19.0072, lon=72.8281),
    dict(name="BL-IND-001", location="Indiranagar Centre, Bangalore",
         region="Bangalore", model="NCR SelfServ 84", lat=12.9716, lon=77.6401),
    dict(name="BL-KOR-002", location="Koramangala Hub, Bangalore",
         region="Bangalore", model="Wincor Nixdorf ProCash", lat=12.9352, lon=77.6245),
    dict(name="DL-CNP-001", location="Connaught Place, Delhi",
         region="Delhi", model="NCR SelfServ 84", lat=28.6315, lon=77.2167),
    dict(name="DL-SAK-002", location="Saket District, Delhi",
         region="Delhi", model="Diebold DN Series", lat=28.5253, lon=77.2090),
    dict(name="CH-TNG-001", location="T. Nagar Branch, Chennai",
         region="Chennai", model="Wincor Nixdorf ProCash", lat=13.0418, lon=80.2341),
    dict(name="HY-BNH-001", location="Banjara Hills, Hyderabad",
         region="Hyderabad", model="NCR SelfServ 84", lat=17.4126, lon=78.4488),
    dict(name="PU-VIM-001", location="Viman Nagar, Pune",
         region="Pune", model="Diebold DN Series", lat=18.5679, lon=73.9143),
    dict(name="KO-PKS-001", location="Park Street, Kolkata",
         region="Kolkata", model="NCR SelfServ 84", lat=22.5533, lon=88.3540),
]

YELLOW_ATMS = [
    dict(name="MU-DHR-003", location="Dharavi Junction, Mumbai",
         region="Mumbai", model="Diebold DN Series", lat=19.0411, lon=72.8518,
         weak_component="network"),
    dict(name="BL-WHT-003", location="Whitefield Tech Park, Bangalore",
         region="Bangalore", model="NCR SelfServ 84", lat=12.9698, lon=77.7499,
         weak_component="software"),
    dict(name="DL-LNR-003", location="Lajpat Nagar Market, Delhi",
         region="Delhi", model="Wincor Nixdorf ProCash", lat=28.5700, lon=77.2430,
         weak_component="hardware"),
    dict(name="CH-TBM-002", location="Tambaram Station, Chennai",
         region="Chennai", model="Diebold DN Series", lat=12.9249, lon=80.1000,
         weak_component="network"),
    dict(name="JA-CLL-001", location="Civil Lines, Jaipur",
         region="Jaipur", model="NCR SelfServ 84", lat=26.9124, lon=75.7873,
         weak_component="transaction"),
]

RED_ATMS = [
    dict(name="MU-KRL-004", location="Kurla East, Mumbai",
         region="Mumbai", model="Wincor Nixdorf ProCash", lat=19.0688, lon=72.8884,
         weak_component="hardware"),
    dict(name="DL-SHA-004", location="Shahdara Depot, Delhi",
         region="Delhi", model="NCR SelfServ 84", lat=28.6700, lon=77.2900,
         weak_component="network"),
    dict(name="LK-HZG-001", location="Hazratganj Branch, Lucknow",
         region="Lucknow", model="Diebold DN Series", lat=26.8500, lon=80.9462,
         weak_component="software"),
    dict(name="NG-STB-001", location="Sitabuldi Junction, Nagpur",
         region="Nagpur", model="Wincor Nixdorf ProCash", lat=21.1501, lon=79.0832,
         weak_component="hardware"),
    dict(name="PA-S17-001", location="Sector 17, Chandigarh",
         region="Chandigarh", model="NCR SelfServ 84", lat=30.7353, lon=76.7880,
         weak_component="network"),
]

# ── Log event catalog ─────────────────────────────────────────────────────────

# Each entry: (eventCode, logLevel, category_hint)
NETWORK_ERRORS = [
    ("NETWORK_TIMEOUT",      "ERROR",    "NETWORK"),
    ("NETWORK_LATENCY_HIGH", "WARN",     "NETWORK"),
]
HARDWARE_ERRORS = [
    ("CARD_READ_ERROR",    "ERROR",    "HARDWARE"),
    ("CASH_DISPENSE_FAIL", "ERROR",    "CASH_JAM"),
    ("HARDWARE_JAM",       "CRITICAL", "CASH_JAM"),
    ("UPS_FAILURE",        "CRITICAL", "HARDWARE"),
]
SOFTWARE_ERRORS = [
    ("NETWORK_TIMEOUT",      "ERROR",    "SERVER"),   # timeout → server bucket
    ("NETWORK_LATENCY_HIGH", "WARN",     "SERVER"),
]
TRANSACTION_ERRORS = [
    ("MALWARE_SIGNATURE",    "CRITICAL", "FRAUD"),
    ("CASH_DISPENSE_FAIL",   "ERROR",    "CASH_JAM"),
]
INFO_EVENTS = [
    ("CARD_READ_SUCCESS", "INFO"),
    ("CASH_DISPENSE_OK",  "INFO"),
    ("CARD_READ_SUCCESS", "INFO"),   # higher weight
    ("CASH_DISPENSE_OK",  "INFO"),
]

COMPONENT_ERROR_MAP = {
    "network":     NETWORK_ERRORS,
    "hardware":    HARDWARE_ERRORS,
    "software":    SOFTWARE_ERRORS,
    "transaction": TRANSACTION_ERRORS,
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _dedup(atm_id, ts, seq):
    raw = f"{atm_id}:{ts.isoformat()}:{seq}"
    return hashlib.sha256(raw.encode()).hexdigest()[:64]


def _atm_uuid(atm):
    return uuid.UUID(int=atm.id)


def _make_raw(atm, code, ts):
    return f"[{ts.isoformat()}] {atm.serialNumber} {code}"


def _make_msg(code, level, atm):
    templates = {
        "CARD_READ_SUCCESS":    "Card read completed successfully",
        "CASH_DISPENSE_OK":     "Cash dispensed successfully",
        "NETWORK_TIMEOUT":      "Connection to payment gateway timed out",
        "NETWORK_LATENCY_HIGH": "Network latency elevated above threshold",
        "CARD_READ_ERROR":      "Unable to read card — magnetic stripe failure",
        "CASH_DISPENSE_FAIL":   "Cash dispenser mechanism failed",
        "HARDWARE_JAM":         "Hardware jam detected in cash module",
        "UPS_FAILURE":          "UPS power unit failure detected",
        "MALWARE_SIGNATURE":    "Suspicious pattern matches known malware signature",
    }
    return templates.get(code, f"{code} event at {atm.location}")


def _sub_scores_for_tier(tier, weak_component=None):
    """Return (network, hardware, software, transaction) scores for a tier."""
    if tier == "green":
        return (
            round(random.uniform(90, 99), 1),
            round(random.uniform(90, 99), 1),
            round(random.uniform(90, 99), 1),
            round(random.uniform(90, 99), 1),
        )
    if tier == "yellow":
        base = round(random.uniform(78, 87), 1)
        weak = round(random.uniform(55, 68), 1)
        scores = {
            "network":     base,
            "hardware":    base,
            "software":    base,
            "transaction": base,
        }
        if weak_component in scores:
            scores[weak_component] = weak
        return (scores["network"], scores["hardware"],
                scores["software"], scores["transaction"])
    # red
    base = round(random.uniform(65, 78), 1)
    weak = round(random.uniform(35, 52), 1)
    scores = {
        "network":     base,
        "hardware":    base,
        "software":    base,
        "transaction": base,
    }
    if weak_component in scores:
        scores[weak_component] = weak
        # Optionally degrade a second component
        second = random.choice([k for k in scores if k != weak_component])
        scores[second] = round(random.uniform(55, 68), 1)
    return (scores["network"], scores["hardware"],
            scores["software"], scores["transaction"])


def _health_from_sub(n, h, s, t):
    return round((n + h + s + t) / 4, 1)


def _status_from_health(score):
    if score < 30:
        return "OFFLINE"
    if score < 60:
        return "DEGRADED"
    return "ONLINE"


def _pick_error_event(weak_component):
    pool = COMPONENT_ERROR_MAP.get(weak_component, HARDWARE_ERRORS)
    return random.choice(pool)


def _generate_logs_for_hour(atm, ts_start, n_info, n_warn, n_error, n_crit,
                             weak_component, seq_offset=0):
    """
    Return a list of LogEntry objects (unsaved) for a single hour window.
    ts_start is the beginning of the hour; logs are spread randomly within it.
    """
    entries = []
    source_id = _atm_uuid(atm)
    seq = seq_offset

    def _ts():
        return ts_start + timedelta(seconds=random.randint(0, 3599))

    # INFO logs
    for _ in range(n_info):
        code, level = random.choice(INFO_EVENTS)
        t = _ts()
        entries.append(LogEntry(
            sourceType="ATM",
            sourceId=source_id,
            timestamp=t,
            logLevel=level,
            eventCode=code,
            message=_make_msg(code, level, atm),
            rawMessage=_make_raw(atm, code, t),
            dedupHash=_dedup(atm.id, t, seq),
            processed=True,
        ))
        seq += 1

    # WARN logs
    for _ in range(n_warn):
        code, level, _ = random.choice(NETWORK_ERRORS + [
            ("NETWORK_LATENCY_HIGH", "WARN", "NETWORK")
        ])
        if level != "WARN":
            code, level = "NETWORK_LATENCY_HIGH", "WARN"
        t = _ts()
        entries.append(LogEntry(
            sourceType="ATM",
            sourceId=source_id,
            timestamp=t,
            logLevel=level,
            eventCode=code,
            message=_make_msg(code, level, atm),
            rawMessage=_make_raw(atm, code, t),
            dedupHash=_dedup(atm.id, t, seq),
            processed=True,
        ))
        seq += 1

    # ERROR logs
    for _ in range(n_error):
        ev = _pick_error_event(weak_component)
        code, level, _ = ev
        if level != "ERROR":
            level = "ERROR"
        t = _ts()
        entries.append(LogEntry(
            sourceType="ATM",
            sourceId=source_id,
            timestamp=t,
            logLevel=level,
            eventCode=code,
            message=_make_msg(code, level, atm),
            rawMessage=_make_raw(atm, code, t),
            dedupHash=_dedup(atm.id, t, seq),
            processed=True,
        ))
        seq += 1

    # CRITICAL logs
    for _ in range(n_crit):
        ev = _pick_error_event(weak_component)
        code, level, _ = ev
        if level != "CRITICAL":
            # force a critical event code
            crit_pool = [e for e in HARDWARE_ERRORS + TRANSACTION_ERRORS
                         if e[1] == "CRITICAL"]
            if crit_pool:
                code, level, _ = random.choice(crit_pool)
            else:
                level = "CRITICAL"
        t = _ts()
        entries.append(LogEntry(
            sourceType="ATM",
            sourceId=source_id,
            timestamp=t,
            logLevel=level,
            eventCode=code,
            message=_make_msg(code, level, atm),
            rawMessage=_make_raw(atm, code, t),
            dedupHash=_dedup(atm.id, t, seq),
            processed=True,
        ))
        seq += 1

    return entries, seq


def _hourly_mix(tier, hour_of_day, day_of_week, weak_component):
    """
    Returns (n_info, n_warn, n_error, n_crit) for one hour.
    Business hours (8-20) have higher volume; nights are quieter.
    """
    busy = (8 <= hour_of_day <= 20)
    if tier == "green":
        base = random.randint(12, 20) if busy else random.randint(3, 8)
        n_err  = random.choices([0, 1], weights=[90, 10])[0]
        n_crit = 0
        n_warn = random.choices([0, 1], weights=[75, 25])[0]
        n_info = max(0, base - n_err - n_warn)
        return n_info, n_warn, n_err, n_crit

    if tier == "yellow":
        base = random.randint(8, 15) if busy else random.randint(2, 6)
        n_crit = random.choices([0, 1], weights=[85, 15])[0]
        n_err  = random.choices([1, 2, 3], weights=[50, 30, 20])[0]
        n_warn = random.choices([1, 2], weights=[60, 40])[0]
        n_info = max(0, base - n_err - n_warn - n_crit)
        return n_info, n_warn, n_err, n_crit

    # red
    base = random.randint(5, 12) if busy else random.randint(2, 5)
    n_crit = random.choices([0, 1, 2], weights=[40, 40, 20])[0]
    n_err  = random.choices([2, 3, 4], weights=[40, 35, 25])[0]
    n_warn = random.choices([0, 1], weights=[60, 40])[0]
    n_info = max(0, base - n_err - n_warn - n_crit)
    return n_info, n_warn, n_err, n_crit


# ── Main command ──────────────────────────────────────────────────────────────

class Command(BaseCommand):
    help = "Seed ATMs with realistic 7-day health history (50% green, 25% yellow, 25% red)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete all existing ATMs, logs, snapshots, and incidents first",
        )

    def handle(self, *args, **options):
        random.seed(42)  # reproducible run
        now = timezone.now()

        if options["flush"]:
            self.stdout.write("Flushing existing data...")
            LogEntry.objects.all().delete()
            HealthSnapshot.objects.all().delete()
            Incident.objects.filter(sourceType="ATM").delete()
            ATM.objects.all().delete()
            self.stdout.write(self.style.WARNING("  All ATM data cleared."))

        # ── 1. Create / update ATMs ───────────────────────────────────────────
        atm_tiers = []   # list of (atm_obj, tier, weak_component)

        def _upsert_atm(defn, tier, health_score, net, hw, sw, tr, status):
            serial = f"SN-{defn['name']}-{random.randint(1000, 9999)}"
            obj, created = ATM.objects.update_or_create(
                name=defn["name"],
                defaults=dict(
                    location=defn["location"],
                    address=defn["location"],
                    region=defn["region"],
                    model=defn["model"],
                    serialNumber=serial,
                    status=status,
                    healthScore=health_score,
                    networkScore=net,
                    hardwareScore=hw,
                    softwareScore=sw,
                    transactionScore=tr,
                    latitude=defn["lat"],
                    longitude=defn["lon"],
                    lastSeen=now,
                ),
            )
            action = "Created" if created else "Updated"
            self.stdout.write(f"  [{tier.upper():6}] {action} {obj.name} "
                              f"health={health_score} status={status}")
            return obj

        self.stdout.write("\n── Seeding GREEN ATMs ──")
        for defn in GREEN_ATMS:
            net, hw, sw, tr = _sub_scores_for_tier("green")
            score = _health_from_sub(net, hw, sw, tr)
            atm = _upsert_atm(defn, "green", score, net, hw, sw, tr, "ONLINE")
            atm_tiers.append((atm, "green", None))

        self.stdout.write("\n── Seeding YELLOW ATMs ──")
        for defn in YELLOW_ATMS:
            wc = defn.get("weak_component", "network")
            net, hw, sw, tr = _sub_scores_for_tier("yellow", wc)
            score = round(random.uniform(62, 75), 1)
            atm = _upsert_atm(defn, "yellow", score, net, hw, sw, tr, "DEGRADED")
            atm_tiers.append((atm, "yellow", wc))

        self.stdout.write("\n── Seeding RED ATMs ──")
        for defn in RED_ATMS:
            wc = defn.get("weak_component", "hardware")
            net, hw, sw, tr = _sub_scores_for_tier("red", wc)
            score = round(random.uniform(22, 50), 1)
            status = "OFFLINE" if score < 30 else "DEGRADED"
            atm = _upsert_atm(defn, "red", score, net, hw, sw, tr, status)
            atm_tiers.append((atm, "red", wc))

        # ── 2. Seed log history (7 days, hour-by-hour) ────────────────────────
        self.stdout.write("\n── Seeding LogEntry history (7 days) ──")
        DAYS_BACK = 7

        for atm, tier, weak_component in atm_tiers:
            log_batch = []
            seq = 0
            for day in range(DAYS_BACK, 0, -1):
                for hour in range(24):
                    ts_start = now - timedelta(days=day) + timedelta(hours=hour)
                    n_info, n_warn, n_err, n_crit = _hourly_mix(
                        tier, hour, ts_start.weekday(), weak_component
                    )
                    entries, seq = _generate_logs_for_hour(
                        atm, ts_start, n_info, n_warn, n_err, n_crit,
                        weak_component or "network", seq_offset=seq,
                    )
                    log_batch.extend(entries)

            LogEntry.objects.bulk_create(log_batch, ignore_conflicts=True)
            self.stdout.write(f"  {atm.name}: {len(log_batch)} logs seeded")

        # ── 3. Seed HealthSnapshot history (every 4 h for 7 days) ────────────
        self.stdout.write("\n── Seeding HealthSnapshot history ──")
        for atm, tier, weak_component in atm_tiers:
            snap_batch = []
            final_score = atm.healthScore
            # Simulate gradual degradation for yellow/red over the 7 days
            for step in range(DAYS_BACK * 6):        # every 4 h
                hrs_ago = (DAYS_BACK * 24) - step * 4
                ts = now - timedelta(hours=hrs_ago)
                frac = step / (DAYS_BACK * 6)        # 0→1 over time

                if tier == "green":
                    score = round(random.uniform(max(80, final_score - 5),
                                                 min(100, final_score + 5)), 1)
                elif tier == "yellow":
                    # Starts near-green, degrades to current
                    start = min(100, final_score + 20)
                    score = round(start - (start - final_score) * frac
                                  + random.uniform(-3, 3), 1)
                    score = max(55, min(100, score))
                else:
                    # Red: starts degraded, worsens to current
                    start = min(100, final_score + 35)
                    score = round(start - (start - final_score) * frac
                                  + random.uniform(-4, 4), 1)
                    score = max(10, min(100, score))

                snap_batch.append(HealthSnapshot(
                    sourceId=_atm_uuid(atm),
                    sourceType="ATM",
                    healthScore=score,
                    status=_status_from_health(score),
                    networkScore=atm.networkScore,
                    hardwareScore=atm.hardwareScore,
                    softwareScore=atm.softwareScore,
                    transactionScore=atm.transactionScore,
                    timestamp=ts,
                ))

            HealthSnapshot.objects.bulk_create(snap_batch)
            self.stdout.write(f"  {atm.name}: {len(snap_batch)} snapshots seeded")

        # ── 4. Seed open Incidents for YELLOW / RED ───────────────────────────
        self.stdout.write("\n── Seeding open Incidents ──")

        # Find engineers to round-robin assign incidents to
        from django.contrib.auth.models import User
        engineers = list(
            User.objects.filter(profile__role='ENGINEER').values_list('username', flat=True)
        )
        if not engineers:
            engineers = ['engineer1']   # fallback if seed_engineer hasn't run
        eng_cycle = 0

        ROOT_CAUSE_FOR_COMPONENT = {
            "network":     ("NETWORK",  "NETWORK_TIMEOUT",   "HIGH"),
            "hardware":    ("HARDWARE", "HARDWARE_JAM",      "HIGH"),
            "software":    ("SERVER",   "NETWORK_TIMEOUT",   "MEDIUM"),
            "transaction": ("FRAUD",    "MALWARE_SIGNATURE", "CRITICAL"),
        }

        for atm, tier, weak_component in atm_tiers:
            if tier == "green":
                continue

            n_incidents = 1 if tier == "yellow" else random.randint(2, 3)
            wc = weak_component or "network"
            root_cause, trigger_code, severity = ROOT_CAUSE_FOR_COMPONENT.get(
                wc, ("NETWORK", "NETWORK_TIMEOUT", "HIGH")
            )

            for i in range(n_incidents):
                inc_id = f"INC-{uuid.uuid4().hex[:8].upper()}"
                created_at = now - timedelta(hours=random.randint(1, 48))
                assigned = engineers[eng_cycle % len(engineers)]
                eng_cycle += 1
                Incident.objects.create(
                    incidentId=inc_id,
                    title=f"{root_cause} failure at {atm.name}",
                    severity=severity,
                    status="OPEN" if i == 0 else "INVESTIGATING",
                    sourceId=_atm_uuid(atm),
                    sourceType="ATM",
                    rootCauseCategory=root_cause,
                    rootCauseDetail=(
                        f"Persistent {root_cause.lower()} failure detected by "
                        f"AI classifier at {atm.location}."
                    ),
                    aiConfidence=round(random.uniform(0.82, 0.97), 2),
                    triggeringLogId=uuid.UUID(int=random.randint(1, 999999)),
                    contributingLogIds=[],
                    assignedTo=assigned,
                    createdAt=created_at,
                )

            self.stdout.write(f"  {atm.name}: {n_incidents} incident(s) → {assigned}")

        # ── Summary ───────────────────────────────────────────────────────────
        self.stdout.write("\n" + "=" * 52)
        self.stdout.write(self.style.SUCCESS(
            f"Done!  ATMs: {ATM.objects.count()}"
            f"  Logs: {LogEntry.objects.count()}"
            f"  Snapshots: {HealthSnapshot.objects.count()}"
            f"  Incidents: {Incident.objects.count()}"
        ))
        green  = ATM.objects.filter(status="ONLINE").count()
        yellow = ATM.objects.filter(status="DEGRADED").count()
        red    = ATM.objects.filter(status="OFFLINE").count()
        self.stdout.write(
            f"  ONLINE={green}  DEGRADED={yellow}  OFFLINE={red}"
        )
