from fastapi import FastAPI, Body, HTTPException
import numpy as np
from typing import List, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("PULSE-AI")

app = FastAPI(title="PULSE Advanced AI Engine")

@app.post("/classify")
async def classify(data: dict = Body(...)):
    """
    Classifies failure logs and recommends self-healing actions.
    """
    event_code = data.get("eventCode", "")
    log_level = data.get("logLevel", "")

    if log_level == "INFO":
        return None

    mapping = {
        "NETWORK_TIMEOUT":      ("NETWORK",  "SWITCH_NETWORK",  0.98),
        "NETWORK_LATENCY_HIGH": ("NETWORK",  "SWITCH_NETWORK",  0.85),
        "CARD_READ_ERROR":      ("HARDWARE", "ALERT_ENGINEER",  0.90),
        "CASH_DISPENSE_FAIL":   ("CASH_JAM", "ALERT_ENGINEER",  0.92),
        "HARDWARE_JAM":         ("CASH_JAM", "ALERT_ENGINEER",  0.97),
        "MALWARE_SIGNATURE":    ("FRAUD",    "FREEZE_ATM",      0.99),
        "UPS_FAILURE":          ("HARDWARE", "ALERT_ENGINEER",  0.95),
        # Additional codes from keyword heuristics
        "CARD_READ_SUCCESS":    ("NETWORK",  "NONE",            0.70),
        "CASH_DISPENSE_OK":     ("NETWORK",  "NONE",            0.70),
    }

    category, self_heal, confidence = mapping.get(event_code, ("SERVER", "RESTART_SERVICE", 0.72))

    # Removed the harmful `if confidence < 0.6: category = "UNKNOWN"` block —
    # it silently overwrote valid categories and produced meaningless results.

    logger.info(f"Classified {event_code} as {category} with {confidence*100}% confidence")

    detail_map = {
        "NETWORK":  "Network connectivity or gateway issue detected. Switch to backup path recommended.",
        "CASH_JAM": "Cash dispenser or hardware jam detected. Field engineer dispatch required.",
        "HARDWARE": "Hardware component failure detected. Physical inspection required.",
        "FRAUD":    "Suspicious activity pattern detected. ATM frozen pending security review.",
        "SERVER":   "Service or application-layer failure detected. Restart sequence initiated.",
        "TIMEOUT":  "Operation timeout detected. Cache flush and retry recommended.",
        "UNKNOWN":  "Pattern unrecognised. Manual review recommended.",
    }

    return {
        "category": category,
        "detail": detail_map.get(category, f"AI classified as {category} via {event_code}."),
        "confidence": confidence,
        "selfHealAction": self_heal,
        "recommendedAction": "Dispatch field engineer" if self_heal in ("NONE", "ALERT_ENGINEER") else "Auto-recovering…",
        "keywords": event_code.lower().split("_"),
    }

@app.post("/predict")
async def predict(data: dict = Body(...)):
    """
    Predicts failures using rolling means and variance analysis.
    """
    snapshots = data.get("snapshots", [])
    if not snapshots:
        raise HTTPException(status_code=400, detail="No snapshots provided")

    scores = [s["healthScore"] for s in snapshots]
    
    mean_score = np.mean(scores)
    variance = np.var(scores)
    
    slope = 0
    if len(scores) > 1:
        slope = np.polyfit(np.arange(len(scores)), scores, 1)[0]

    components = ["networkScore", "hardwareScore", "softwareScore", "transactionScore"]
    last_snap = snapshots[-1]
    weakest = min(components, key=lambda c: last_snap.get(c, 100))

    fail_prob = min(1.0, abs(slope) * 0.5 + (variance / 100)) if slope < 0 else 0.05

    return {
        "sourceId": data.get("sourceId"),
        "currentHealth": round(scores[-1], 1),
        "meanHealth": round(float(mean_score), 1),
        "variance": round(float(variance), 2),
        "failureProbability": round(float(fail_prob), 2),
        "trend": "declining" if slope < -0.2 else "stable",
        "predictedIn": f"{abs(int(scores[-1]/(slope*4)))}h" if slope < -0.5 else "Stable",
        "weakestComponent": weakest.replace("Score", "")
    }

@app.post("/detect")
async def detect(data: dict = Body(...)):
    """
    Detects abnormal behavior using the Z-Score formula.
    """
    window = data.get("currentWindow", {})
    baseline = data.get("historicalBaseline", {})
    recent_logs = data.get("recentLogs", [])

    curr = window.get("errorRate", 0)
    mean = baseline.get("meanErrorRate", 0.1)
    std = baseline.get("stdDevErrorRate", 0.05)
    
    z_score = (curr - mean) / std if std > 0 else 0
    
    event_codes = [l.get("eventCode") for l in recent_logs]
    anomaly_type = "RAPID_FAILURES"
    if "MALWARE_SIGNATURE" in event_codes:
        anomaly_type = "MALWARE_PATTERN"
    elif "CARD_READ_ERROR" in event_codes and "MALWARE_SIGNATURE" in event_codes:
        anomaly_type = "CARD_SKIMMING"

    return {
        "isAnomaly": z_score > 3.0 or anomaly_type != "RAPID_FAILURES",
        "zScore": round(float(z_score), 2),
        "anomalyType": anomaly_type,
        "confidenceScore": min(1.0, round(float(z_score/5), 2)),
        "explanation": f"Error rate is {round(z_score, 1)} standard deviations from baseline."
    }

@app.post("/fraud")
async def fraud_detect(data: dict = Body(...)):
    """
    Detects transaction-level fraud using three heuristics:
    1. Rapid withdrawal  — 3+ transactions from the same card in a 10-min window
    2. Amount anomaly    — Z-score vs card historical baseline > 3.5σ
    3. Geographic anomaly — impossible travel: >100 km in <60 min
    """
    from math import radians, sin, cos, sqrt, atan2
    from datetime import datetime

    current  = data.get("current", {})
    recent   = data.get("recentTransactions", [])
    baseline = data.get("cardBaseline", {})

    amount   = float(current.get("amount", 0))
    curr_lat = current.get("latitude")
    curr_lng = current.get("longitude")
    curr_ts  = current.get("timestamp", "")

    mean_amt = float(baseline.get("meanAmount", 2500))
    std_amt  = float(baseline.get("stdAmount",  800))

    fraud_type = None
    confidence = 0.0
    reasons    = []

    # 1. Rapid withdrawal
    if len(recent) >= 3:
        fraud_type = "RAPID_WITHDRAWAL"
        confidence = min(1.0, 0.55 + (len(recent) - 3) * 0.12)
        reasons.append(f"{len(recent)} withdrawals in 10-minute window")

    # 2. Amount anomaly (Z-score)
    if std_amt > 0:
        z = (amount - mean_amt) / std_amt
        if abs(z) > 3.5:
            amt_conf = min(1.0, round(abs(z) / 8, 2))
            if amt_conf > confidence:
                fraud_type = "UNUSUAL_WITHDRAWAL"
                confidence = amt_conf
            reasons.append(f"Amount {int(amount)} is {abs(z):.1f} std devs from card mean {int(mean_amt)}")

    # 3. Geographic anomaly — impossible travel
    if recent and curr_lat and curr_lng and curr_ts:
        last     = recent[0]
        last_lat = last.get("latitude")
        last_lng = last.get("longitude")
        last_ts  = last.get("timestamp", "")
        if last_lat and last_lng and last_ts:
            R    = 6371
            dlat = radians(curr_lat - last_lat)
            dlng = radians(curr_lng - last_lng)
            a    = sin(dlat / 2) ** 2 + cos(radians(last_lat)) * cos(radians(curr_lat)) * sin(dlng / 2) ** 2
            dist_km = 2 * R * atan2(sqrt(a), sqrt(1 - a))
            try:
                t1   = datetime.fromisoformat(last_ts.replace("Z", "+00:00"))
                t2   = datetime.fromisoformat(curr_ts.replace("Z", "+00:00"))
                mins = abs((t2 - t1).total_seconds() / 60) or 1
                if dist_km > 100 and mins < 60:
                    geo_conf = min(1.0, round(dist_km / 500, 2))
                    if geo_conf > confidence:
                        fraud_type = "GEOGRAPHIC_ANOMALY"
                        confidence = geo_conf
                    reasons.append(f"Card used {int(dist_km)} km apart in {int(mins)} min")
            except Exception:
                pass

    is_fraud = fraud_type is not None and confidence >= 0.5

    return {
        "isFraud":     is_fraud,
        "fraudType":   fraud_type if is_fraud else None,
        "confidence":  round(confidence, 2),
        "explanation": "; ".join(reasons) if reasons else "Transaction within normal parameters.",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)