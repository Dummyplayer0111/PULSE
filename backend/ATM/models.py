from django.db import models
import uuid
from django.utils import timezone
from django.contrib.auth.models import User



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
    ("INVESTIGATING", "INVESTIGATING"),
    ("AUTO_RESOLVED", "AUTO_RESOLVED"),
    ("RESOLVED", "RESOLVED"),
    ("ESCALATED", "ESCALATED"),
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

    rootCauseDetail = models.TextField(blank=True, default='')
    resolvedAt = models.DateTimeField(null=True, blank=True)
    assignedTo = models.CharField(max_length=150, null=True, blank=True)

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
    processed = models.BooleanField(default=False)

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
    description = models.TextField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    logEntryId = models.IntegerField(null=True, blank=True)

    createdAt = models.DateTimeField(default=timezone.now)


# ─────────────────────────────────────────────
# ALERT
# ─────────────────────────────────────────────

class Alert(models.Model):
    incidentId = models.UUIDField()

    alertType = models.CharField(
        max_length=20,
        choices=ALERT_TYPE_CHOICES,
        default="REACTIVE"
    )

    title = models.CharField(max_length=255)
    message = models.TextField()

    severity = models.CharField(
        max_length=10,
        choices=SEVERITY_CHOICES,
        default="MEDIUM"
    )

    status = models.CharField(
        max_length=20,
        choices=ALERT_STATUS_CHOICES,
        default="ACTIVE"
    )

    acknowledged = models.BooleanField(default=False)
    sentAt = models.DateTimeField(null=True, blank=True)

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


# ─────────────────────────────────────────────
# ATM
# ─────────────────────────────────────────────

ATM_STATUS_CHOICES = [
    ("ONLINE", "ONLINE"),
    ("OFFLINE", "OFFLINE"),
    ("DEGRADED", "DEGRADED"),
    ("MAINTENANCE", "MAINTENANCE"),
]

class ATM(models.Model):
    name            = models.CharField(max_length=100)
    location        = models.CharField(max_length=255)
    address         = models.CharField(max_length=500, blank=True, default='')
    region          = models.CharField(max_length=100, blank=True, default='')
    model           = models.CharField(max_length=100, blank=True, default='')
    serialNumber    = models.CharField(max_length=100, blank=True, default='')
    status          = models.CharField(max_length=20, choices=ATM_STATUS_CHOICES, default='ONLINE')
    healthScore     = models.FloatField(default=100.0)
    networkScore    = models.FloatField(default=100.0)
    hardwareScore   = models.FloatField(default=100.0)
    softwareScore   = models.FloatField(default=100.0)
    transactionScore= models.FloatField(default=100.0)
    latitude        = models.FloatField(null=True, blank=True)
    longitude       = models.FloatField(null=True, blank=True)
    lastSeen        = models.DateTimeField(default=timezone.now)
    createdAt       = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────
# PAYMENT CHANNEL
# ─────────────────────────────────────────────

class PaymentChannel(models.Model):
    name    = models.CharField(max_length=100)
    type    = models.CharField(max_length=50)
    status  = models.CharField(max_length=20, default='ONLINE')
    endpoint= models.URLField(blank=True, default='')
    createdAt = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────
# CUSTOMER NOTIFICATION
# ─────────────────────────────────────────────

NOTIFICATION_STATUS_CHOICES = [
    ("PENDING", "PENDING"),
    ("SENT", "SENT"),
    ("FAILED", "FAILED"),
    ("DELIVERED", "DELIVERED"),
]

class CustomerNotification(models.Model):
    recipientId      = models.CharField(max_length=255)
    channel          = models.CharField(max_length=20, default='SMS')
    message          = models.TextField()
    language         = models.CharField(max_length=10, default='en')
    status           = models.CharField(max_length=20, choices=NOTIFICATION_STATUS_CHOICES, default='SENT')
    # Pipeline-linked fields
    incidentDbId     = models.IntegerField(null=True, blank=True)
    messageTemplateId= models.IntegerField(null=True, blank=True)
    messageSent      = models.TextField(null=True, blank=True)
    sentAt           = models.DateTimeField(null=True, blank=True)
    createdAt        = models.DateTimeField(default=timezone.now)


# ─────────────────────────────────────────────
# MESSAGE TEMPLATE
# ─────────────────────────────────────────────

class MessageTemplate(models.Model):
    name            = models.CharField(max_length=100)
    templateKey     = models.CharField(max_length=50, default='atm_offline')
    language        = models.CharField(max_length=10, default='en')
    channel         = models.CharField(max_length=20, default='SMS')
    body            = models.TextField()
    variablesSchema = models.JSONField(default=dict)
    createdAt       = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ('templateKey', 'language', 'channel')

    def __str__(self):
        return f"{self.templateKey}/{self.language}/{self.channel}"


# ─────────────────────────────────────────────
# USER PROFILE
# ─────────────────────────────────────────────

ROLE_CHOICES = [
    ("ADMIN", "ADMIN"),
    ("ENGINEER", "ENGINEER"),
]

class UserProfile(models.Model):
    user     = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role     = models.CharField(max_length=20, choices=ROLE_CHOICES, default='ENGINEER')
    fullName = models.CharField(max_length=255, blank=True, default='')

    def __str__(self):
        return f"{self.user.username} ({self.role})"