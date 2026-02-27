"""
PULSE Health Snapshot Simulator
Generates synthetic health score time series for the predictor model.

Simulates 3 ATM behavior patterns:
  - Healthy (stable 85-100)
  - Degrading (slow decline from 90 → 30 over hours)
  - Crashing (rapid drop from 80 → 0 in <2 hours)

Usage:
    python generate_health_snapshots.py                          # default
    python generate_health_snapshots.py --hours 48               # 48 hours of data
    python generate_health_snapshots.py --output snapshots.csv   # custom file
"""

import csv
import random
import argparse
from datetime import datetime, timedelta

ATMS = [
    {"atmId": "ATM-MUM-001", "name": "Andheri West Branch",    "city": "Mumbai",    "pattern": "healthy"},
    {"atmId": "ATM-MUM-002", "name": "Bandra Kurla Complex",   "city": "Mumbai",    "pattern": "healthy"},
    {"atmId": "ATM-MUM-003", "name": "Dadar Central",          "city": "Mumbai",    "pattern": "crashing"},
    {"atmId": "ATM-MUM-004", "name": "Kurla Station",          "city": "Mumbai",    "pattern": "degrading"},
    {"atmId": "ATM-MUM-005", "name": "Malad West Market",      "city": "Mumbai",    "pattern": "healthy"},
    {"atmId": "ATM-MUM-006", "name": "Powai Tech Park",        "city": "Mumbai",    "pattern": "healthy"},
    {"atmId": "ATM-DEL-001", "name": "Connaught Place",        "city": "Delhi",     "pattern": "healthy"},
    {"atmId": "ATM-DEL-002", "name": "Lajpat Nagar",           "city": "Delhi",     "pattern": "healthy"},
    {"atmId": "ATM-DEL-003", "name": "Rohini Sector 7",        "city": "Delhi",     "pattern": "degrading"},
    {"atmId": "ATM-DEL-004", "name": "Dwarka Sector 10",       "city": "Delhi",     "pattern": "healthy"},
    {"atmId": "ATM-BLR-001", "name": "MG Road Junction",       "city": "Bengaluru", "pattern": "healthy"},
    {"atmId": "ATM-BLR-002", "name": "Whitefield Tech",        "city": "Bengaluru", "pattern": "healthy"},
    {"atmId": "ATM-BLR-003", "name": "Koramangala 5th Block",  "city": "Bengaluru", "pattern": "crashing"},
    {"atmId": "ATM-BLR-004", "name": "Electronic City",        "city": "Bengaluru", "pattern": "degrading"},
    {"atmId": "ATM-CHN-001", "name": "Anna Nagar Tower",       "city": "Chennai",   "pattern": "healthy"},
    {"atmId": "ATM-CHN-002", "name": "T Nagar Branch",         "city": "Chennai",   "pattern": "healthy"},
    {"atmId": "ATM-HYD-001", "name": "HITEC City",             "city": "Hyderabad", "pattern": "healthy"},
    {"atmId": "ATM-HYD-002", "name": "Secunderabad Station",   "city": "Hyderabad", "pattern": "degrading"},
    {"atmId": "ATM-PUN-001", "name": "Koregaon Park",          "city": "Pune",      "pattern": "healthy"},
    {"atmId": "ATM-PUN-002", "name": "Hinjewadi Phase 1",      "city": "Pune",      "pattern": "healthy"},
]

SNAPSHOT_INTERVAL_MINUTES = 15


def clamp(val, lo=0, hi=100):
    return max(lo, min(hi, val))


def generate_sub_scores(health_score):
    """Generate component breakdown scores that roughly sum to the overall."""
    noise = lambda: random.uniform(-8, 8)
    network     = clamp(health_score + noise())
    hardware    = clamp(health_score + noise())
    software    = clamp(health_score + noise())
    transaction = clamp(health_score + noise())
    return {
        "networkScore":     round(network, 1),
        "hardwareScore":    round(hardware, 1),
        "softwareScore":    round(software, 1),
        "transactionScore": round(transaction, 1),
    }


def generate_snapshots(hours=24):
    """Generate health snapshots for all ATMs."""
    snapshots = []
    now = datetime.utcnow()
    num_points = (hours * 60) // SNAPSHOT_INTERVAL_MINUTES

    for atm in ATMS:
        pattern = atm["pattern"]
        score = 0.0

        for i in range(num_points):
            t = now - timedelta(minutes=(num_points - i) * SNAPSHOT_INTERVAL_MINUTES)
            progress = i / max(num_points - 1, 1)  # 0.0 → 1.0

            if pattern == "healthy":
                # Stable between 85-100 with small noise
                score = random.uniform(88, 100)

            elif pattern == "degrading":
                # Slow decline: starts ~85, ends ~30 over the full window
                base = 88 - (progress * 58)  # 88 → 30
                score = base + random.uniform(-3, 3)

            elif pattern == "crashing":
                # Normal for first 70%, then rapid crash in last 30%
                if progress < 0.7:
                    score = random.uniform(75, 95)
                else:
                    crash_progress = (progress - 0.7) / 0.3  # 0→1 in crash phase
                    base = 80 - (crash_progress * 80)  # 80 → 0
                    score = base + random.uniform(-5, 2)

            score = clamp(score)
            sub = generate_sub_scores(score)

            # For degrading/crashing, make one component drop faster
            if pattern == "degrading":
                sub["networkScore"] = clamp(sub["networkScore"] - progress * 20)
            elif pattern == "crashing" and progress > 0.7:
                sub["hardwareScore"] = clamp(sub["hardwareScore"] - 30)

            status = "ONLINE"
            if score < 10:
                status = "OFFLINE"
            elif score < 50:
                status = "DEGRADED"

            snapshots.append({
                "timestamp":        t.isoformat() + "Z",
                "atmId":            atm["atmId"],
                "atmName":          atm["name"],
                "city":             atm["city"],
                "healthScore":      round(score, 1),
                "status":           status,
                "networkScore":     sub["networkScore"],
                "hardwareScore":    sub["hardwareScore"],
                "softwareScore":    sub["softwareScore"],
                "transactionScore": sub["transactionScore"],
                # --- Labels for training ---
                "pattern":          pattern,
                "willFail":         pattern in ("degrading", "crashing"),
            })

    snapshots.sort(key=lambda x: x["timestamp"])
    return snapshots


def main():
    parser = argparse.ArgumentParser(description="PULSE Health Snapshot Simulator")
    parser.add_argument("--hours", type=int, default=24, help="Hours of data to generate (default: 24)")
    parser.add_argument("--output", type=str, default="health_snapshots.csv", help="Output CSV file")
    args = parser.parse_args()

    print(f"Generating {args.hours}h of snapshots for {len(ATMS)} ATMs (every {SNAPSHOT_INTERVAL_MINUTES} min)...")
    snapshots = generate_snapshots(hours=args.hours)

    fieldnames = list(snapshots[0].keys())
    with open(args.output, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(snapshots)

    from collections import Counter
    patterns = Counter(s["pattern"] for s in snapshots)
    total_points = len(snapshots)
    per_atm = total_points // len(ATMS)

    print(f"\nWrote {total_points} snapshots to {args.output}")
    print(f"Points per ATM: {per_atm}")
    print(f"Patterns: {dict(patterns)}")
    print(f"\nATMs that will fail:")
    for atm in ATMS:
        if atm["pattern"] != "healthy":
            print(f"  {atm['atmId']} ({atm['name']}) — {atm['pattern']}")


if __name__ == "__main__":
    main()
