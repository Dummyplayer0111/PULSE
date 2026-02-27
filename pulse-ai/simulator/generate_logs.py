"""
PULSE Log Simulator — Standalone Python version
Generates synthetic ATM log data as CSV. No database needed.

Usage:
    python generate_logs.py                     # 3000 logs (default)
    python generate_logs.py --count 10000       # custom count
    python generate_logs.py --days 7            # logs spread over 7 days
    python generate_logs.py --output logs.csv   # custom output file
"""

import csv
import random
import hashlib
import argparse
from datetime import datetime, timedelta

# ─── ATM Fleet (matches our seeded data) ──────────────────────────────────────

ATMS = [
    {"atmId": "ATM-MUM-001", "name": "Andheri West Branch",    "city": "Mumbai",     "lat": 19.1136, "lng": 72.8311},
    {"atmId": "ATM-MUM-002", "name": "Bandra Kurla Complex",   "city": "Mumbai",     "lat": 19.0596, "lng": 72.8647},
    {"atmId": "ATM-MUM-003", "name": "Dadar Central",          "city": "Mumbai",     "lat": 19.0178, "lng": 72.8427},
    {"atmId": "ATM-MUM-004", "name": "Kurla Station",          "city": "Mumbai",     "lat": 19.0728, "lng": 72.8784},
    {"atmId": "ATM-MUM-005", "name": "Malad West Market",      "city": "Mumbai",     "lat": 19.1872, "lng": 72.8426},
    {"atmId": "ATM-MUM-006", "name": "Powai Tech Park",        "city": "Mumbai",     "lat": 19.1177, "lng": 72.9058},
    {"atmId": "ATM-DEL-001", "name": "Connaught Place",        "city": "Delhi",      "lat": 28.6317, "lng": 77.2167},
    {"atmId": "ATM-DEL-002", "name": "Lajpat Nagar",           "city": "Delhi",      "lat": 28.5672, "lng": 77.2431},
    {"atmId": "ATM-DEL-003", "name": "Rohini Sector 7",        "city": "Delhi",      "lat": 28.7243, "lng": 77.0688},
    {"atmId": "ATM-DEL-004", "name": "Dwarka Sector 10",       "city": "Delhi",      "lat": 28.5921, "lng": 77.0337},
    {"atmId": "ATM-BLR-001", "name": "MG Road Junction",       "city": "Bengaluru",  "lat": 12.9762, "lng": 77.6101},
    {"atmId": "ATM-BLR-002", "name": "Whitefield Tech",        "city": "Bengaluru",  "lat": 12.9698, "lng": 77.7480},
    {"atmId": "ATM-BLR-003", "name": "Koramangala 5th Block",  "city": "Bengaluru",  "lat": 12.9352, "lng": 77.6227},
    {"atmId": "ATM-BLR-004", "name": "Electronic City",        "city": "Bengaluru",  "lat": 12.8399, "lng": 77.6694},
    {"atmId": "ATM-CHN-001", "name": "Anna Nagar Tower",       "city": "Chennai",    "lat": 13.0858, "lng": 80.2099},
    {"atmId": "ATM-CHN-002", "name": "T Nagar Branch",         "city": "Chennai",    "lat": 13.0418, "lng": 80.2337},
    {"atmId": "ATM-HYD-001", "name": "HITEC City",             "city": "Hyderabad",  "lat": 17.4474, "lng": 78.3748},
    {"atmId": "ATM-HYD-002", "name": "Secunderabad Station",   "city": "Hyderabad",  "lat": 17.4399, "lng": 78.5011},
    {"atmId": "ATM-PUN-001", "name": "Koregaon Park",          "city": "Pune",       "lat": 18.5362, "lng": 73.8931},
    {"atmId": "ATM-PUN-002", "name": "Hinjewadi Phase 1",      "city": "Pune",       "lat": 18.5912, "lng": 73.7361},
]

# ─── Event Types (weighted distribution) ──────────────────────────────────────
# These match the real backend simulator exactly.
# Weight = relative probability. Higher weight = more frequent.

EVENT_TYPES = [
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

# ─── Ground Truth Labels (for supervised training) ───────────────────────────

LABELS = {
    "CARD_READ_SUCCESS":    {"category": None,       "is_failure": False},
    "CASH_DISPENSE_OK":     {"category": None,       "is_failure": False},
    "NETWORK_LATENCY_HIGH": {"category": "NETWORK",  "is_failure": True},
    "CARD_READ_ERROR":      {"category": "HARDWARE", "is_failure": True},
    "CASH_DISPENSE_FAIL":   {"category": "CASH_JAM", "is_failure": True},
    "NETWORK_TIMEOUT":      {"category": "NETWORK",  "is_failure": True},
    "HARDWARE_JAM":         {"category": "CASH_JAM", "is_failure": True},
    "MALWARE_SIGNATURE":    {"category": "FRAUD",    "is_failure": True},
    "UPS_FAILURE":          {"category": "HARDWARE", "is_failure": True},
}


def pick_event():
    """Weighted random selection of event type."""
    total = sum(e["weight"] for e in EVENT_TYPES)
    r = random.uniform(0, total)
    for e in EVENT_TYPES:
        r -= e["weight"]
        if r <= 0:
            return e
    return EVENT_TYPES[0]


def generate_logs(count=3000, days=2):
    """Generate synthetic ATM logs."""
    logs = []
    now = datetime.utcnow()

    for _ in range(count):
        atm = random.choice(ATMS)
        event = pick_event()
        timestamp = now - timedelta(seconds=random.randint(0, days * 86400))
        raw = f"[{timestamp.isoformat()}Z] {atm['atmId']} {event['code']}"
        label = LABELS[event["code"]]

        logs.append({
            "timestamp":       timestamp.isoformat() + "Z",
            "atmId":           atm["atmId"],
            "atmName":         atm["name"],
            "city":            atm["city"],
            "lat":             atm["lat"],
            "lng":             atm["lng"],
            "logLevel":        event["level"],
            "eventCode":       event["code"],
            "rawMessage":      raw,
            "message":         f"{event['code']} on {atm['name']}",
            # --- Labels for training ---
            "rootCauseCategory": label["category"] or "",
            "isFailure":       label["is_failure"],
            "dedupHash":       hashlib.sha256(raw.encode()).hexdigest(),
        })

    # Sort by timestamp
    logs.sort(key=lambda x: x["timestamp"])
    return logs


def main():
    parser = argparse.ArgumentParser(description="PULSE ATM Log Simulator")
    parser.add_argument("--count", type=int, default=3000, help="Number of logs to generate (default: 3000)")
    parser.add_argument("--days", type=int, default=2, help="Spread logs over N days (default: 2)")
    parser.add_argument("--output", type=str, default="logs_generated.csv", help="Output CSV file")
    args = parser.parse_args()

    print(f"Generating {args.count} logs over {args.days} days...")
    logs = generate_logs(count=args.count, days=args.days)

    # Write CSV
    fieldnames = list(logs[0].keys())
    with open(args.output, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(logs)

    # Stats
    from collections import Counter
    levels = Counter(l["logLevel"] for l in logs)
    categories = Counter(l["rootCauseCategory"] for l in logs if l["rootCauseCategory"])

    print(f"\nWrote {len(logs)} logs to {args.output}")
    print(f"\nBy level:    {dict(levels)}")
    print(f"By category: {dict(categories)}")
    print(f"Failures:    {sum(1 for l in logs if l['isFailure'])} / {len(logs)}")


if __name__ == "__main__":
    main()
