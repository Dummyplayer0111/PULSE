from django.db import models
import uuid
from django.utils import timezone



# ─────────────────────────────────────────────
# ENUM CHOICES (MUST MATCH MERN BACKEND)
# ─────────────────────────────────────────────

ROOT_CAUSE_CHOICES = [
    ("NETWORK", "NETWORK"),
    ("CASH_JAM", "CASH_JAM"),
    ("SWITCH", "SWITCH"),
    ("SERVER", "SERVER"),
    ("FRAUD", "FRAUD"),
    ("TIMEOUT", "TIMEOUT"),
    ("HARDWARE", "HARDWARE"),
    ("UNKNOWN", "UNKNOWN"),
]

SEVERITY_CHOICES = [
    ("LOW", "LOW"),
    ("MEDIUM", "MEDIUM"),
    ("HIGH", "HIGH"),
    ("CRITICAL", "CRITICAL"),
]

INCIDENT_STATUS_CHOICES = [
    ("OPEN", "OPEN"),
    ("RESOLVED", "RESOLVED"),
]

SOURCE_TYPE_CHOICES = [
    ("ATM", "ATM"),
    ("PaymentChannel", "PaymentChannel"),
]

LOG_LEVEL_CHOICES = [
    ("INFO", "INFO"),
    ("WARN", "WARN"),
    ("ERROR", "ERROR"),
    ("CRITICAL", "CRITICAL"),
]

ANOMALY_TYPE_CHOICES = [
    ("UNUSUAL_WITHDRAWAL", "UNUSUAL_WITHDRAWAL"),
    ("CARD_SKIMMING", "CARD_SKIMMING"),
    ("RAPID_FAILURES", "RAPID_FAILURES"),
    ("MALWARE_PATTERN", "MALWARE_PATTERN"),
]

SELF_HEAL_ACTION_CHOICES = [
    ("RESTART_SERVICE", "RESTART_SERVICE"),
    ("SWITCH_NETWORK", "SWITCH_NETWORK"),
    ("FLUSH_CACHE", "FLUSH_CACHE"),
    ("REROUTE_TRAFFIC", "REROUTE_TRAFFIC"),
    ("ALERT_ENGINEER", "ALERT_ENGINEER"),
    ("FREEZE_ATM", "FREEZE_ATM"),
]

ALERT_TYPE_CHOICES = [
    ("PREDICTIVE", "PREDICTIVE"),
    ("REACTIVE", "REACTIVE"),
    ("ANOMALY", "ANOMALY"),
    ("SELF_HEAL", "SELF_HEAL"),
]

ALERT_STATUS_CHOICES = [
    ("ACTIVE", "ACTIVE"),
    ("ACKNOWLEDGED", "ACKNOWLEDGED"),
    ("RESOLVED", "RESOLVED"),
]


# ─────────────────────────────────────────────
# INCIDENT
# ─────────────────────────────────────────────

class Incident(models.Model):
    incidentId = models.CharField(max_length=50, unique=True)
    title = models.CharField(max_length=255)

    severity = models.CharField(
        max_length=10,
        choices=SEVERITY_CHOICES
    )

    status = models.CharField(
        max_length=20,
        choices=INCIDENT_STATUS_CHOICES,
        default="OPEN"
    )

    sourceId = models.UUIDField()
    sourceType = models.CharField(
        max_length=20,
        choices=SOURCE_TYPE_CHOICES
    )

    # FROM CLASSIFIER
    rootCauseCategory = models.CharField(
        max_length=20,
        choices=ROOT_CAUSE_CHOICES
    )

    aiConfidence = models.FloatField()

    triggeringLogId = models.UUIDField()
    contributingLogIds = models.JSONField(default=list)

    assignedTo = models.UUIDField(null=True, blank=True)

    createdAt = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.incidentId


# ─────────────────────────────────────────────
# LOG ENTRY
# ─────────────────────────────────────────────

class LogEntry(models.Model):
    sourceType = models.CharField(
        max_length=20,
        choices=SOURCE_TYPE_CHOICES
    )

    sourceId = models.UUIDField()
    timestamp = models.DateTimeField()

    logLevel = models.CharField(
        max_length=10,
        choices=LOG_LEVEL_CHOICES
    )

    eventCode = models.CharField(max_length=100)
    message = models.TextField()
    rawMessage = models.TextField()

    transactionId = models.CharField(max_length=100, null=True, blank=True)
    dedupHash = models.CharField(max_length=128)

    incidentId = models.UUIDField(null=True, blank=True)

    createdAt = models.DateTimeField(default=timezone.now)


# ─────────────────────────────────────────────
# HEALTH SNAPSHOT
# ─────────────────────────────────────────────

class HealthSnapshot(models.Model):
    sourceId = models.UUIDField()
    sourceType = models.CharField(
        max_length=20,
        choices=SOURCE_TYPE_CHOICES
    )

    healthScore = models.FloatField()

    status = models.CharField(
        max_length=20,
        choices=[
            ("ONLINE", "ONLINE"),
            ("OFFLINE", "OFFLINE"),
            ("DEGRADED", "DEGRADED"),
            ("MAINTENANCE", "MAINTENANCE"),
        ]
    )

    networkScore = models.FloatField()
    hardwareScore = models.FloatField()
    softwareScore = models.FloatField()
    transactionScore = models.FloatField()

    timestamp = models.DateTimeField()

    createdAt = models.DateTimeField(default=timezone.now)


# ─────────────────────────────────────────────
# ANOMALY FLAG
# ─────────────────────────────────────────────

class AnomalyFlag(models.Model):
    sourceId = models.UUIDField()
    sourceType = models.CharField(
        max_length=20,
        choices=SOURCE_TYPE_CHOICES
    )

    anomalyType = models.CharField(
        max_length=30,
        choices=ANOMALY_TYPE_CHOICES
    )

    confidenceScore = models.FloatField()

    status = models.CharField(
        max_length=20,
        default="ACTIVE"
    )

    contributingLogIds = models.JSONField(default=list)
    notes = models.TextField(null=True, blank=True)

    createdAt = models.DateTimeField(default=timezone.now)


# ─────────────────────────────────────────────
# ALERT
# ─────────────────────────────────────────────

class Alert(models.Model):
    incidentId = models.UUIDField()

    alertType = models.CharField(
        max_length=20,
        choices=ALERT_TYPE_CHOICES,
        default="REACTIVE"   # ← Add this
    )

    title = models.CharField(max_length=255)
    message = models.TextField()

    status = models.CharField(
        max_length=20,
        choices=ALERT_STATUS_CHOICES,
        default="ACTIVE"
    )

    createdAt = models.DateTimeField(default=timezone.now)


# ─────────────────────────────────────────────
# SELF HEAL ACTION
# ─────────────────────────────────────────────

class SelfHealAction(models.Model):
    incidentId = models.UUIDField()

    actionType = models.CharField(
        max_length=30,
        choices=SELF_HEAL_ACTION_CHOICES
    )

    triggeredBy = models.CharField(
        max_length=10,
        choices=[
            ("AUTO", "AUTO"),
            ("MANUAL", "MANUAL"),
        ]
    )

    status = models.CharField(
        max_length=20,
        choices=[
            ("PENDING", "PENDING"),
            ("SUCCESS", "SUCCESS"),
            ("FAILED", "FAILED"),
        ]
    )

    result = models.TextField(null=True, blank=True)

    createdAt = models.DateTimeField(default=timezone.now)